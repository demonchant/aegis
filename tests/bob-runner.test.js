const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const test = require('node:test');
const { BobRunner, parseBobResponse, parseContract } = require('../src/bob-runner');

const validFinding = {
  file: 'src/auth.js', lineStart: 2, lineEnd: 3, severity: 'high', category: 'authorization',
  claim: 'Caller controls the role.', remediation: 'Read the role from the session.',
};

test('Bob JSON response is parsed with its execution identifier', () => {
  const stdout = JSON.stringify({ type: 'result', status: 'success', stats: { task_id: 'task-123', session_costs: 0.1 }, last_message: JSON.stringify({ summary: 'One issue.', findings: [validFinding] }) });
  const parsed = parseBobResponse(stdout);
  assert.equal(parsed.executionId, 'task-123');
  assert.equal(parsed.findings[0].severity, 'high');
});

test('malformed and unsupported Bob responses are rejected', () => {
  assert.throws(() => parseBobResponse('not json'), /malformed/);
  assert.throws(() => parseContract({ summary: 'x', findings: [{ ...validFinding, severity: 'urgent' }] }), /unsupported severity/);
  assert.throws(() => parseContract({ summary: 'x', findings: [{ ...validFinding, file: '../secret' }] }), /unsafe file/);
  assert.throws(() => parseContract({ summary: 'x', findings: [{ ...validFinding, lineStart: 0 }] }), /line range/);
});

test('Bob process timeout is enforced without invoking a real Bob session', async () => {
  function stalledSpawn() {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.stdin = new PassThrough();
    child.kill = () => {};
    return child;
  }
  const runner = new BobRunner({ apiKey: 'test-key', timeoutMs: 1000, spawn: stalledSpawn });
  await assert.rejects(() => runner.run({ analysisRoot: process.cwd(), files: ['src/a.js'], repository: 'https://github.com/o/r', commitSha: 'a'.repeat(40) }), /timed out/);
});
