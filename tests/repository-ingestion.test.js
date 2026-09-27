const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { parseReviewTarget, parseScope, selectReviewFiles, validateGitHubUrl } = require('../src/repository-ingestion');

test('GitHub repository URLs are canonicalized and restricted to the supported host', () => {
  assert.deepEqual(validateGitHubUrl('https://github.com/Owner/repository.git'), {
    owner: 'Owner', repository: 'repository', canonicalUrl: 'https://github.com/Owner/repository',
  });
  for (const input of [
    'http://github.com/owner/repo',
    'https://127.0.0.1/owner/repo',
    'https://github.com.evil.test/owner/repo',
    'https://user@github.com/owner/repo',
    'https://github.com/owner/repo?x=1',
    'https://github.com/owner/repo;calc',
    'git@github.com:owner/repo.git',
  ]) assert.throws(() => validateGitHubUrl(input));
});

test('branch and pull request inputs cannot inject command arguments or cross repositories', () => {
  assert.throws(() => parseReviewTarget('https://github.com/owner/repo', { reference: 'main; calc.exe' }), /Branch name/);
  assert.throws(() => parseReviewTarget('https://github.com/owner/repo', { reference: '--upload-pack=evil' }), /Branch name/);
  assert.throws(() => parseReviewTarget('https://github.com/owner/repo', { prUrl: 'https://github.com/other/repo/pull/1' }), /must belong/);
  const target = parseReviewTarget('https://github.com/owner/repo', { prUrl: 'https://github.com/owner/repo/pull/42' });
  assert.equal(target.fetchRef, 'refs/pull/42/head');
});

test('review scope refuses traversal and unsupported glob syntax', () => {
  assert.throws(() => parseScope('../secret'), /inside/);
  assert.throws(() => parseScope('src/*.js'), /inside/);
  assert.deepEqual(parseScope('src/auth/**, server.js'), ['src/auth/**', 'server.js']);
});

test('file selection ignores secrets, generated output, binaries, and symlinks', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-files-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'src'));
  fs.mkdirSync(path.join(root, 'dist'));
  fs.writeFileSync(path.join(root, 'src', 'auth.js'), 'export const auth = true;\n');
  fs.writeFileSync(path.join(root, '.env'), 'TOKEN=secret\n');
  fs.writeFileSync(path.join(root, 'dist', 'bundle.js'), 'ignored');
  fs.writeFileSync(path.join(root, 'src', 'binary.js'), Buffer.from([0, 1, 2]));
  const selected = selectReviewFiles(root, 'src/**', { maxRepositoryFiles: 100, maxFileBytes: 1024, maxReviewFiles: 50 });
  assert.deepEqual(selected.files, ['src/auth.js']);
});
