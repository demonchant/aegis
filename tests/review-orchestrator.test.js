const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { FakeBobRunner } = require('../src/bob-runner');
const { ReviewOrchestrator } = require('../src/review-orchestrator');
const { ReviewStore, openDatabase, resolveDatabasePath } = require('../src/review-store');

function setup(t, bobResult, bobError = null) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-job-'));
  const analysisRoot = path.join(root, 'checkout');
  const repositoryRoot = path.join(analysisRoot, 'repository');
  fs.mkdirSync(path.join(repositoryRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repositoryRoot, 'src', 'auth.js'), 'const input = request.body.role;\nconst role = input || user.role;\n');
  const opened = openDatabase(root);
  const store = new ReviewStore(opened.database);
  const userId = crypto.randomUUID();
  opened.database.prepare('INSERT INTO users (id,name,email,password_hash,salt,created_at) VALUES (?,?,?,?,?,?)').run(userId, 'Test', userId + '@test.invalid', 'hash', 'salt', new Date().toISOString());
  const created = store.create({ id: crypto.randomUUID(), userId, repositoryUrl: 'https://github.com/owner/repo', requestedReference: null, scope: null, requestKey: null, now: new Date().toISOString() });
  let cleaned = false;
  const repositoryProvider = {
    acquire: async () => ({
      temporaryRoot: analysisRoot,
      repositoryRoot,
      repository: { owner: 'owner', repository: 'repo', canonicalUrl: 'https://github.com/owner/repo' },
      commitSha: 'a'.repeat(40),
      files: ['src/auth.js'],
      truncated: false,
      candidateCount: 1,
      cleanup: () => { cleaned = true; fs.rmSync(analysisRoot, { recursive: true, force: true }); },
    }),
  };
  const runner = new FakeBobRunner(bobResult, bobError);
  const orchestrator = new ReviewOrchestrator({ store, repositoryProvider, bobRunner: runner, evidenceDirectory: path.join(root, 'evidence'), logger: { error() {} } });
  t.after(() => { opened.database.close(); fs.rmSync(root, { recursive: true, force: true }); });
  return { store, orchestrator, reviewId: created.review.id, wasCleaned: () => cleaned, analysisRoot };
}

const valid = {
  summary: 'Authorization issue.',
  findings: [{ file: 'src/auth.js', lineStart: 1, lineEnd: 2, severity: 'high', category: 'authorization', claim: 'Request data controls the role.', remediation: 'Use the authenticated session role.' }],
};

test('review job connects Bob findings to Aegis verification and cleans the checkout', async (t) => {
  const context = setup(t, valid);
  await context.orchestrator.run(context.reviewId);
  const review = context.store.getInternal(context.reviewId);
  assert.equal(review.status, 'VERIFIED');
  assert.match(review.receipt_sha256, /^[a-f0-9]{64}$/);
  assert.equal(context.wasCleaned(), true);
  assert.equal(fs.existsSync(context.analysisRoot), false);
});

test('nonexistent Bob finding files are rejected and cannot produce VERIFIED', async (t) => {
  const context = setup(t, { summary: 'Bad file.', findings: [{ ...valid.findings[0], file: 'src/missing.js' }] });
  await context.orchestrator.run(context.reviewId);
  const review = context.store.getForUser(context.reviewId, context.store.getInternal(context.reviewId).user_id);
  assert.equal(review.status, 'BLOCKED');
  assert.equal(review.result.findings.length, 0);
  assert.match(review.result.rejectedFindings[0].reason, /not included/);
});

test('invalid Bob line ranges are rejected by Aegis Core', async (t) => {
  const context = setup(t, { summary: 'Bad lines.', findings: [{ ...valid.findings[0], lineStart: 99, lineEnd: 100 }] });
  await context.orchestrator.run(context.reviewId);
  const review = context.store.getInternal(context.reviewId);
  assert.equal(review.status, 'BLOCKED');
  assert.match(JSON.parse(review.result_json).rejectedFindings[0].reason, /line range/);
});

test('Bob process failure marks the job failed and still cleans temporary files', async (t) => {
  const context = setup(t, valid, new Error('Bob process exited 1'));
  await assert.rejects(() => context.orchestrator.run(context.reviewId), /exited 1/);
  assert.equal(context.store.getInternal(context.reviewId).status, 'FAILED');
  assert.equal(context.wasCleaned(), true);
});

test('database path configuration creates its parent and survives reopening', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-db-'));
  const configured = path.join(root, 'persistent', 'reviews.db');
  assert.equal(resolveDatabasePath(root, configured), path.resolve(configured));
  const first = openDatabase(root, configured);
  first.database.exec("INSERT INTO users (id,name,email,password_hash,salt,created_at) VALUES ('u','User','u@test.invalid','h','s','now')");
  first.database.close();
  const second = openDatabase(root, configured);
  assert.equal(second.database.prepare('SELECT count(*) AS count FROM users').get().count, 1);
  second.database.close();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
});
