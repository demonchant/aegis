const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { canonicalJson, prepareReview, recordFinding, verifyReceipt, verifyReview } = require('../src/aegis-core');

function fixture() {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-test-'));
  fs.mkdirSync(path.join(workspaceRoot, 'src'));
  fs.writeFileSync(path.join(workspaceRoot, 'src', 'auth.js'), 'const role = request.body.role || user.role;\n');
  return { workspaceRoot, evidenceDirectory: path.join(workspaceRoot, 'evidence') };
}

test('canonical JSON is independent of object key order', () => {
  assert.equal(canonicalJson({ z: 1, a: { d: 2, b: 3 } }), canonicalJson({ a: { b: 3, d: 2 }, z: 1 }));
});

test('review is idempotent, anchored, and independently verifiable', () => {
  const context = fixture();
  const input = { ...context, sourceEventId: 'PR-42', title: 'Auth boundary', files: ['src/auth.js'] };
  const first = prepareReview(input);
  const second = prepareReview(input);
  assert.equal(second.reused, true);
  assert.equal(second.review.reviewId, first.review.reviewId);

  const finding = { file: 'src/auth.js', lineStart: 1, severity: 'high', category: 'authorization', claim: 'Request input controls authorization.', remediation: 'Use the server session role.' };
  assert.equal(recordFinding({ ...context, reviewId: first.review.reviewId, finding }).reused, false);
  assert.equal(recordFinding({ ...context, reviewId: first.review.reviewId, finding }).reused, true);
  const proof = verifyReview({ ...context, reviewId: first.review.reviewId });
  assert.equal(proof.postconditionPassed, true);
  assert.equal(proof.afterState.findingCount, 1);
  assert.equal(verifyReceipt(proof), true);
  assert.equal(verifyReview({ ...context, reviewId: first.review.reviewId }).receiptSha256, proof.receiptSha256);
});

test('verification blocks stale evidence', () => {
  const context = fixture();
  const prepared = prepareReview({ ...context, sourceEventId: 'PR-43', title: 'Stale review', files: ['src/auth.js'] });
  recordFinding({ ...context, reviewId: prepared.review.reviewId, finding: { file: 'src/auth.js', lineStart: 1, severity: 'medium', category: 'authorization', claim: 'Role is caller controlled.', remediation: 'Use session state.' } });
  fs.writeFileSync(path.join(context.workspaceRoot, 'src', 'auth.js'), 'const role = user.role;\n');
  const proof = verifyReview({ ...context, reviewId: prepared.review.reviewId });
  assert.equal(proof.postconditionPassed, false);
  assert.equal(proof.afterState.status, 'BLOCKED');
});

test('workspace traversal is refused', () => {
  const context = fixture();
  assert.throws(() => prepareReview({ ...context, sourceEventId: 'escape', title: 'Escape', files: ['../secret.txt'] }), /inside the workspace/);
});
