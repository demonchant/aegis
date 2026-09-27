const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const SOURCE_EXTENSIONS = new Set([
  '.c', '.cc', '.cpp', '.cs', '.css', '.go', '.h', '.hpp', '.html', '.java', '.js', '.jsx',
  '.kt', '.kts', '.mjs', '.cjs', '.php', '.py', '.rb', '.rs', '.scala', '.sh', '.sql',
  '.swift', '.ts', '.tsx', '.vue', '.xml', '.yaml', '.yml',
]);
const IGNORED_DIRECTORIES = new Set(['.git', '.next', '.output', '.turbo', 'build', 'coverage', 'dist', 'node_modules', 'target', 'vendor']);
const SECRET_OR_GENERATED = /(^|\/)(?:\.env(?:\.|$)|.*\.(?:key|pem|p12|pfx|crt|min\.js|map|lock)$|credentials?(?:\.|$)|secrets?(?:\.|$))/i;

function positiveInteger(value, fallback, maximum) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 && number <= maximum ? number : fallback;
}

function validateGitHubUrl(value) {
  if (typeof value !== 'string' || value.length > 300) throw new Error('Provide a valid public GitHub repository URL.');
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error('Provide a valid public GitHub repository URL.'); }
  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'github.com' || url.port || url.username || url.password || url.search || url.hash) {
    throw new Error('Only https://github.com/owner/repository URLs are supported.');
  }
  const parts = url.pathname.replace(/\/$/, '').split('/').filter(Boolean);
  if (parts.length !== 2) throw new Error('GitHub repository URL must contain exactly an owner and repository.');
  const owner = parts[0];
  const repository = parts[1].replace(/\.git$/i, '');
  const component = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,99})$/;
  if (!component.test(owner) || !component.test(repository) || repository.endsWith('.')) throw new Error('GitHub owner or repository name is invalid.');
  return { owner, repository, canonicalUrl: `https://github.com/${owner}/${repository}` };
}

function validateBranch(value) {
  const branch = String(value || '').trim();
  if (!branch) return null;
  if (branch.length > 200 || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(branch) || branch.includes('..') || branch.includes('//') || branch.includes('@{') || branch.endsWith('/') || branch.endsWith('.') || branch.endsWith('.lock')) {
    throw new Error('Branch name is invalid.');
  }
  return branch;
}

function parseReviewTarget(repositoryUrl, input = {}) {
  const repository = validateGitHubUrl(repositoryUrl);
  const supplied = [input.branch, input.commitSha, input.prUrl, input.reference].filter((item) => String(item || '').trim());
  if (supplied.length > 1) throw new Error('Provide only one branch, commit SHA, or pull request URL.');
  let branch = input.branch ? validateBranch(input.branch) : null;
  let commitSha = input.commitSha ? String(input.commitSha).trim().toLowerCase() : null;
  let prNumber = null;
  let reference = String(input.reference || '').trim();
  let prUrl = String(input.prUrl || '').trim();
  if (reference.startsWith('http://') || reference.startsWith('https://')) prUrl = reference;
  else if (reference && /^[a-f0-9]{40}$/i.test(reference)) commitSha = reference.toLowerCase();
  else if (reference) branch = validateBranch(reference);
  if (commitSha && !/^[a-f0-9]{40}$/.test(commitSha)) throw new Error('Commit SHA must contain exactly 40 hexadecimal characters.');
  if (prUrl) {
    let parsed;
    try { parsed = new URL(prUrl); } catch { throw new Error('Pull request URL is invalid.'); }
    const match = parsed.pathname.replace(/\/$/, '').match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)$/);
    if (parsed.protocol !== 'https:' || parsed.hostname.toLowerCase() !== 'github.com' || parsed.search || parsed.hash || !match ||
        match[1].toLowerCase() !== repository.owner.toLowerCase() || match[2].replace(/\.git$/i, '').toLowerCase() !== repository.repository.toLowerCase()) {
      throw new Error('Pull request URL must belong to the submitted GitHub repository.');
    }
    prNumber = Number(match[3]);
    if (!Number.isSafeInteger(prNumber) || prNumber < 1) throw new Error('Pull request number is invalid.');
  }
  const fetchRef = prNumber ? `refs/pull/${prNumber}/head` : commitSha || branch || 'HEAD';
  return { ...repository, branch, commitSha, prNumber, fetchRef, requestedReference: prUrl || commitSha || branch || null };
}

function parseScope(value) {
  if (value === undefined || value === null || String(value).trim() === '') return [];
  if (String(value).length > 2000) throw new Error('Review scope is too long.');
  const entries = [...new Set(String(value).split(/[\n,]/).map((item) => item.trim().replaceAll('\\', '/')).filter(Boolean))];
  if (entries.length > 20) throw new Error('Review scope may contain at most 20 paths.');
  for (const entry of entries) {
    const normalized = entry.endsWith('/**') ? entry.slice(0, -3) : entry;
    if (!normalized || path.posix.isAbsolute(normalized) || normalized.split('/').includes('..') || /[*?\[\]{}]/.test(normalized)) {
      throw new Error('Review scope paths must stay inside the repository.');
    }
  }
  return entries.map((entry) => entry.replace(/\/$/, ''));
}

function matchesScope(relativePath, scopes) {
  if (!scopes.length) return true;
  return scopes.some((scope) => {
    const prefix = scope.endsWith('/**') ? scope.slice(0, -3) : scope;
    return relativePath === prefix || relativePath.startsWith(`${prefix}/`);
  });
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: options.cwd, env: options.env, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      error ? reject(error) : resolve(result);
    };
    const collect = (target, chunk, limit) => {
      const next = target + chunk;
      if (Buffer.byteLength(next) > limit) {
        child.kill('SIGKILL');
        finish(new Error('Repository command produced too much output.'));
      }
      return next;
    };
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout = collect(stdout, chunk, 1024 * 1024); });
    child.stderr.on('data', (chunk) => { stderr = collect(stderr, chunk, 1024 * 1024); });
    child.on('error', (error) => finish(new Error(`Could not start git: ${error.message}`)));
    child.on('close', (code) => code === 0 ? finish(null, { stdout, stderr }) : finish(new Error(`Git operation failed${stderr.trim() ? `: ${stderr.trim().slice(0, 500)}` : '.'}`)));
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(new Error('Repository acquisition timed out.'));
    }, options.timeoutMs || 120000);
  });
}

function directoryStats(root, limits) {
  let bytes = 0;
  let files = 0;
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      const stat = fs.lstatSync(full);
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) walk(full);
      else if (stat.isFile()) {
        files += 1;
        bytes += stat.size;
        if (files > limits.maxRepositoryFiles) throw new Error(`Repository exceeds the ${limits.maxRepositoryFiles} file limit.`);
        if (bytes > limits.maxRepositoryBytes) throw new Error(`Repository exceeds the ${Math.floor(limits.maxRepositoryBytes / 1024 / 1024)} MB limit.`);
      }
    }
  };
  walk(root);
  return { bytes, files };
}

function selectReviewFiles(repositoryRoot, scope, limits) {
  const scopes = parseScope(scope);
  const candidates = [];
  let visited = 0;
  const walk = (directory, relativeDirectory = '') => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === '.git' || (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name))) continue;
      const relative = path.posix.join(relativeDirectory.replaceAll('\\', '/'), entry.name);
      const full = path.join(directory, entry.name);
      const stat = fs.lstatSync(full);
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) { walk(full, relative); continue; }
      if (!stat.isFile()) continue;
      visited += 1;
      if (visited > limits.maxRepositoryFiles) throw new Error(`Repository exceeds the ${limits.maxRepositoryFiles} file limit.`);
      if (!matchesScope(relative, scopes) || stat.size === 0 || stat.size > limits.maxFileBytes || SECRET_OR_GENERATED.test(relative) || !SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      const sample = Buffer.alloc(Math.min(stat.size, 8192));
      const descriptor = fs.openSync(full, 'r');
      try { fs.readSync(descriptor, sample, 0, sample.length, 0); } finally { fs.closeSync(descriptor); }
      if (sample.includes(0)) continue;
      const priority = /(^|\/)(?:auth|security|middleware|route|controller|api|server|session|permission)/i.test(relative) ? 0 : 1;
      candidates.push({ relative, priority, size: stat.size });
    }
  };
  walk(repositoryRoot);
  candidates.sort((a, b) => a.priority - b.priority || a.relative.localeCompare(b.relative));
  const selected = candidates.slice(0, limits.maxReviewFiles).map((item) => item.relative);
  if (!selected.length) throw new Error('No supported source files matched the requested review scope.');
  return { files: selected, truncated: candidates.length > selected.length, candidateCount: candidates.length };
}

class GitHubRepositoryProvider {
  constructor(options = {}) {
    this.command = options.gitCommand || process.env.GIT_COMMAND || 'git';
    this.run = options.runProcess || runProcess;
    this.limits = {
      maxRepositoryBytes: positiveInteger(options.maxRepositoryBytes || process.env.AEGIS_MAX_REPO_BYTES, 100 * 1024 * 1024, 1024 * 1024 * 1024),
      maxRepositoryFiles: positiveInteger(options.maxRepositoryFiles || process.env.AEGIS_MAX_REPO_FILES, 5000, 50000),
      maxFileBytes: positiveInteger(options.maxFileBytes || process.env.AEGIS_MAX_FILE_BYTES, 512 * 1024, 5 * 1024 * 1024),
      maxReviewFiles: Math.min(50, positiveInteger(options.maxReviewFiles || process.env.AEGIS_MAX_REVIEW_FILES, 50, 50)),
      timeoutMs: positiveInteger(options.timeoutMs || process.env.AEGIS_FETCH_TIMEOUT_MS, 120000, 600000),
    };
  }

  async acquire(input) {
    const target = parseReviewTarget(input.repositoryUrl, input);
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-review-'));
    const repositoryRoot = path.join(temporaryRoot, 'repository');
    const hooksDirectory = path.join(temporaryRoot, 'disabled-hooks');
    fs.mkdirSync(repositoryRoot);
    fs.mkdirSync(hooksDirectory);
    const env = { ...process.env, GIT_LFS_SKIP_SMUDGE: '1', GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1' };
    const git = (...args) => this.run(this.command, ['-c', `core.hooksPath=${hooksDirectory}`, '-c', 'protocol.file.allow=never', '-c', 'protocol.ext.allow=never', ...args], { cwd: temporaryRoot, env, timeoutMs: this.limits.timeoutMs });
    try {
      await git('init', '--quiet', repositoryRoot);
      await git('-C', repositoryRoot, 'remote', 'add', 'origin', `${target.canonicalUrl}.git`);
      await git('-C', repositoryRoot, 'fetch', '--quiet', '--depth=1', '--filter=blob:none', '--no-tags', '--no-recurse-submodules', 'origin', target.fetchRef);
      directoryStats(repositoryRoot, this.limits);
      await git('-C', repositoryRoot, 'checkout', '--quiet', '--detach', 'FETCH_HEAD');
      const commit = (await git('-C', repositoryRoot, 'rev-parse', '--verify', 'HEAD')).stdout.trim().toLowerCase();
      if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Git did not resolve an immutable commit SHA.');
      directoryStats(repositoryRoot, this.limits);
      const selected = selectReviewFiles(repositoryRoot, input.scope, this.limits);
      return {
        temporaryRoot,
        repositoryRoot,
        repository: target,
        commitSha: commit,
        ...selected,
        cleanup: () => fs.rmSync(temporaryRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }),
      };
    } catch (error) {
      fs.rmSync(temporaryRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      throw error;
    }
  }
}

module.exports = { GitHubRepositoryProvider, matchesScope, parseReviewTarget, parseScope, runProcess, selectReviewFiles, validateBranch, validateGitHubUrl };
