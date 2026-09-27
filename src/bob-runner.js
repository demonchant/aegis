const { spawn } = require('node:child_process');
const path = require('node:path');

const SEVERITIES = new Set(['critical', 'high', 'medium', 'low', 'informational']);
const FINDING_KEYS = new Set(['file', 'lineStart', 'lineEnd', 'severity', 'category', 'claim', 'remediation']);

function boundedNumber(value, fallback, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : fallback;
}

function requiredString(value, field, maximum) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) throw new Error(`Bob output field ${field} is invalid.`);
  return value.trim();
}

function parseContract(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Bob output must be a JSON object.');
  const unknown = Object.keys(value).filter((key) => !['summary', 'findings'].includes(key));
  if (unknown.length) throw new Error(`Bob output contains unsupported fields: ${unknown.join(', ')}.`);
  const summary = requiredString(value.summary, 'summary', 2000);
  if (!Array.isArray(value.findings) || value.findings.length > 100) throw new Error('Bob output findings must be an array of at most 100 items.');
  const findings = value.findings.map((finding, index) => {
    if (!finding || typeof finding !== 'object' || Array.isArray(finding)) throw new Error(`Bob finding ${index + 1} is invalid.`);
    const extra = Object.keys(finding).filter((key) => !FINDING_KEYS.has(key));
    if (extra.length) throw new Error(`Bob finding ${index + 1} contains unsupported fields.`);
    const file = requiredString(finding.file, `findings[${index}].file`, 300).replaceAll('\\', '/');
    if (path.posix.isAbsolute(file) || file.split('/').includes('..')) throw new Error(`Bob finding ${index + 1} contains an unsafe file path.`);
    const lineStart = Number(finding.lineStart);
    const lineEnd = finding.lineEnd === undefined ? lineStart : Number(finding.lineEnd);
    if (!Number.isInteger(lineStart) || !Number.isInteger(lineEnd) || lineStart < 1 || lineEnd < lineStart) throw new Error(`Bob finding ${index + 1} contains an invalid line range.`);
    const severity = requiredString(finding.severity, `findings[${index}].severity`, 20).toLowerCase();
    if (!SEVERITIES.has(severity)) throw new Error(`Bob finding ${index + 1} contains an unsupported severity.`);
    return {
      file,
      lineStart,
      lineEnd,
      severity,
      category: requiredString(finding.category, `findings[${index}].category`, 100),
      claim: requiredString(finding.claim, `findings[${index}].claim`, 1000),
      remediation: requiredString(finding.remediation, `findings[${index}].remediation`, 1000),
    };
  });
  return { summary, findings };
}

function parseJsonMessage(message) {
  if (typeof message !== 'string' || message.length > 1024 * 1024) throw new Error('Bob did not return a usable final message.');
  const trimmed = message.trim();
  const unfenced = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(unfenced); } catch {
    const start = unfenced.indexOf('{');
    const end = unfenced.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('Bob final message did not contain valid JSON.');
    try { return JSON.parse(unfenced.slice(start, end + 1)); } catch { throw new Error('Bob final message contained malformed JSON.'); }
  }
}

function parseBobResponse(stdout) {
  let envelope;
  try { envelope = JSON.parse(String(stdout).trim()); } catch { throw new Error('Bob process returned malformed JSON.'); }
  if (!envelope || envelope.type !== 'result' || envelope.status !== 'success') throw new Error('Bob process did not complete successfully.');
  const result = parseContract(parseJsonMessage(envelope.last_message));
  return {
    ...result,
    executionId: typeof envelope.stats?.task_id === 'string' ? envelope.stats.task_id : null,
    stats: envelope.stats && typeof envelope.stats === 'object' ? {
      durationMs: Number(envelope.stats.duration_ms) || null,
      sessionCost: Number(envelope.stats.session_costs) || null,
      totalTokens: Number(envelope.stats.total_tokens) || null,
      toolCalls: Number(envelope.stats.tool_calls) || null,
    } : null,
  };
}

function buildPrompt(files, repository, commitSha) {
  const manifest = files.map((file) => `- repository/${file}`).join('\n');
  return `Perform a defensive security review of the exact source files listed below from ${repository} at commit ${commitSha}.

Important constraints:
- Read files only. Do not edit files, execute commands, run code, install dependencies, or access the network.
- Report only vulnerabilities supported by exact source lines.
- Use paths relative to the repository directory (for example src/auth.js), without the repository/ prefix.
- Return ONLY one JSON object. Do not use Markdown or commentary.
- The exact schema is: {"summary":"string","findings":[{"file":"string","lineStart":1,"lineEnd":1,"severity":"critical|high|medium|low|informational","category":"string","claim":"string","remediation":"string"}]}
- If no supported vulnerability is found, return an empty findings array and explain that in summary.

Files in scope:
${manifest}`;
}

function sanitizedEnvironment(apiKey) {
  const allowed = ['PATH', 'Path', 'SYSTEMROOT', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'LANG', 'LC_ALL', 'SSL_CERT_FILE', 'SSL_CERT_DIR', 'HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY'];
  const environment = {};
  for (const name of allowed) if (process.env[name]) environment[name] = process.env[name];
  environment.BOB_API_KEY = apiKey;
  return environment;
}

class BobRunner {
  constructor(options = {}) {
    this.command = options.command || process.env.BOB_COMMAND || 'bob';
    this.apiKey = options.apiKey || process.env.BOB_API_KEY;
    this.teamId = options.teamId || process.env.BOB_TEAM_ID || null;
    this.maxCost = boundedNumber(options.maxCost || process.env.BOB_MAX_COST, 0.25, 0.01, 100);
    this.maxTurns = Math.floor(boundedNumber(options.maxTurns || process.env.BOB_MAX_TURNS, 6, 1, 100));
    this.timeoutMs = Math.floor(boundedNumber(options.timeoutMs || process.env.BOB_TIMEOUT_MS, 180000, 1000, 900000));
    this.spawn = options.spawn || spawn;
  }

  async run({ analysisRoot, files, repository, commitSha }) {
    if (!this.apiKey) throw new Error('IBM Bob is not configured on the Aegis server.');
    const args = [
      'run', '--format', 'json', '--mode', 'ask', '--max-cost', String(this.maxCost), '--max-turns', String(this.maxTurns),
      '--disable-subagents', '--disable-tool-groups', 'edit,execute,mcp,skill,todo,mode,subagent', '--workspace', analysisRoot,
      '--trust', '--accept-license',
    ];
    if (this.teamId) args.push('--team-id', this.teamId);
    const prompt = buildPrompt(files, repository, commitSha);
    return new Promise((resolve, reject) => {
      const child = this.spawn(this.command, args, { cwd: analysisRoot, env: sanitizedEnvironment(this.apiKey), shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      let settled = false;
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        error ? reject(error) : resolve(value);
      };
      const append = (current, chunk, maximum) => {
        const next = current + chunk;
        if (Buffer.byteLength(next) > maximum) {
          child.kill('SIGKILL');
          finish(new Error('Bob process output exceeded the safety limit.'));
        }
        return next;
      };
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk) => { stdout = append(stdout, chunk, 2 * 1024 * 1024); });
      child.stderr.on('data', (chunk) => { stderr = append(stderr, chunk, 256 * 1024); });
      child.on('error', (error) => finish(new Error(`Could not start IBM Bob: ${error.message}`)));
      child.on('close', (code) => {
        if (code !== 0) return finish(new Error(`IBM Bob failed${stderr.trim() ? `: ${stderr.trim().slice(0, 500)}` : '.'}`));
        try { finish(null, parseBobResponse(stdout)); } catch (error) { finish(error); }
      });
      child.stdin.end(prompt);
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        finish(new Error('IBM Bob analysis timed out.'));
      }, this.timeoutMs);
    });
  }
}

class FakeBobRunner {
  constructor(result, error = null) { this.result = result; this.error = error; this.calls = []; }
  async run(input) { this.calls.push(input); if (this.error) throw this.error; return parseContract(this.result); }
}

module.exports = { BobRunner, FakeBobRunner, buildPrompt, parseBobResponse, parseContract, parseJsonMessage, sanitizedEnvironment };
