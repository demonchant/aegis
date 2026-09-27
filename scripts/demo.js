const path = require('node:path');
const { prepareReview, recordFinding, verifyReview } = require('../src/aegis-core');

const workspaceRoot = path.resolve(__dirname, '..');
const evidenceDirectory = path.join(workspaceRoot, 'evidence');
const prepared = prepareReview({
  workspaceRoot,
  evidenceDirectory,
  sourceEventId: 'aegis-demo-auth-boundary-v1',
  title: 'Request-controlled authorization role',
  files: ['examples/vulnerable-auth.js'],
});

recordFinding({
  workspaceRoot,
  evidenceDirectory,
  reviewId: prepared.review.reviewId,
  finding: {
    file: 'examples/vulnerable-auth.js',
    lineStart: 3,
    severity: 'high',
    category: 'CWE-639 Authorization Bypass Through User-Controlled Key',
    claim: 'A caller can choose the role used for authorization by supplying request.body.role.',
    remediation: 'Derive the authorization role only from the verified server-side session or user record.',
  },
});

const proof = verifyReview({ workspaceRoot, evidenceDirectory, reviewId: prepared.review.reviewId });
console.log(`Aegis demo ${proof.afterState.status}: ${proof.reviewId}`);
console.log(`Receipt: ${proof.receiptSha256}`);
