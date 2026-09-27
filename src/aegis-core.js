const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const STATES = new Set(['PREPARED', 'VERIFIED', 'BLOCKED', 'DISPUTED']);
const SEVERITIES = new Set(['critical', 'high', 'medium', 'low', 'informational']);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(stable(value));
}

function digest(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : canonicalJson(value)).digest('hex');
}

function assertString(value, name, maximum = 500) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) {
    throw new Error(`${name} must be a non-empty string of at most ${maximum} characters.`);
  }
  return value.trim();
}

function resolveWorkspaceFile(workspaceRoot, relativePath) {
  const requested = assertString(relativePath, 'path', 300).replaceAll('\\', '/');
  if (path.isAbsolute(requested) || requested.split('/').includes('..')) throw new Error('File path must stay inside the workspace.');
  const root = path.resolve(workspaceRoot);
  const resolved = path.resolve(root, requested);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error('File path must stay inside the workspace.');
  const linkStat = fs.lstatSync(resolved, { throwIfNoEntry: false });
  if (!linkStat || !linkStat.isFile() || linkStat.isSymbolicLink()) throw new Error(`File does not exist or is not a regular file: ${requested}`);
  const realRoot = fs.realpathSync(root);
  const realFile = fs.realpathSync(resolved);
  if (realFile !== realRoot && !realFile.startsWith(`${realRoot}${path.sep}`)) throw new Error('File path must stay inside the workspace.');
  const stat = fs.statSync(realFile);
  if (stat.size > 512 * 1024) throw new Error(`File is too large to anchor safely: ${requested}`);
  return { requested, resolved };
}

function snapshotFile(workspaceRoot, relativePath) {
  const file = resolveWorkspaceFile(workspaceRoot, relativePath);
  const content = fs.readFileSync(file.resolved, 'utf8');
  return { path: file.requested, sha256: digest(content), bytes: Buffer.byteLength(content), lines: content.split(/\r?\n/).length };
}

function reviewPath(evidenceDirectory, reviewId) {
  return path.join(evidenceDirectory, 'reviews', `${reviewId}.json`);
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, file);
}

function readReview(evidenceDirectory, reviewId) {
  const id = assertString(reviewId, 'reviewId', 64);
  if (!/^[a-f0-9]{24}$/.test(id)) throw new Error('reviewId is invalid.');
  const review = JSON.parse(fs.readFileSync(reviewPath(evidenceDirectory, id), 'utf8'));
  if (!STATES.has(review.status)) throw new Error('Stored review state is invalid.');
  return review;
}

function prepareReview({ workspaceRoot, evidenceDirectory, sourceEventId, title, files, metadata = null }) {
  const source = assertString(sourceEventId, 'sourceEventId', 200);
  const safeTitle = assertString(title, 'title', 200);
  if (!Array.isArray(files) || files.length === 0 || files.length > 50) throw new Error('files must contain between 1 and 50 workspace-relative paths.');
  const normalizedFiles = [...new Set(files)].sort().map((file) => snapshotFile(workspaceRoot, file));
  const idempotencyKey = digest({ version: 1, sourceEventId: source, files: normalizedFiles.map(({ path: file, sha256 }) => ({ path: file, sha256 })) });
  const reviewId = idempotencyKey.slice(0, 24);
  const file = reviewPath(evidenceDirectory, reviewId);
  if (fs.existsSync(file)) return { review: readReview(evidenceDirectory, reviewId), reused: true };
  const review = {
    schemaVersion: 1,
    reviewId,
    sourceEventId: source,
    title: safeTitle,
    metadata: metadata && typeof metadata === 'object' ? stable(metadata) : null,
    status: 'PREPARED',
    idempotencyKey,
    preparedAt: new Date().toISOString(),
    files: normalizedFiles,
    findings: [],
    verification: null,
  };
  writeJson(file, review);
  return { review, reused: false };
}

function recordFinding({ workspaceRoot, evidenceDirectory, reviewId, finding }) {
  const review = readReview(evidenceDirectory, reviewId);
  const relativePath = assertString(finding.file, 'finding.file', 300).replaceAll('\\', '/');
  const snapshot = review.files.find((item) => item.path === relativePath);
  if (!snapshot) throw new Error('Finding file was not included in the prepared scope.');
  const current = snapshotFile(workspaceRoot, relativePath);
  if (current.sha256 !== snapshot.sha256) throw new Error('File changed after preparation. Prepare a new review before recording findings.');
  const start = Number(finding.lineStart);
  const end = finding.lineEnd === undefined ? start : Number(finding.lineEnd);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > snapshot.lines) throw new Error('Finding line range is outside the prepared file.');
  const severity = assertString(finding.severity, 'finding.severity', 20).toLowerCase();
  if (!SEVERITIES.has(severity)) throw new Error('Finding severity is invalid.');
  const category = assertString(finding.category, 'finding.category', 100);
  const claim = assertString(finding.claim, 'finding.claim', 1000);
  const remediation = assertString(finding.remediation, 'finding.remediation', 1000);
  const content = fs.readFileSync(resolveWorkspaceFile(workspaceRoot, relativePath).resolved, 'utf8');
  const excerpt = content.split(/\r?\n/).slice(start - 1, end).join('\n');
  const anchored = { file: relativePath, lineStart: start, lineEnd: end, severity, category, claim, remediation, evidenceSha256: digest(excerpt), fileSha256: current.sha256 };
  const findingId = digest(anchored).slice(0, 24);
  const existing = review.findings.find((item) => item.findingId === findingId);
  if (existing) return { finding: existing, reused: true };
  const stored = { findingId, ...anchored, recordedAt: new Date().toISOString() };
  review.findings.push(stored);
  review.status = 'PREPARED';
  review.verification = null;
  writeJson(reviewPath(evidenceDirectory, review.reviewId), review);
  return { finding: stored, reused: false };
}

function verifyReview({ workspaceRoot, evidenceDirectory, reviewId, sponsorExecutionId, publishCanonical = true }) {
  const review = readReview(evidenceDirectory, reviewId);
  const checkedFiles = review.files.map((snapshot) => {
    try {
      const current = snapshotFile(workspaceRoot, snapshot.path);
      return { path: snapshot.path, expectedSha256: snapshot.sha256, actualSha256: current.sha256, current: current.sha256 === snapshot.sha256 };
    } catch (error) {
      return { path: snapshot.path, expectedSha256: snapshot.sha256, actualSha256: null, current: false, error: error.message };
    }
  });
  const postconditionPassed = checkedFiles.every((item) => item.current) && review.findings.length > 0;
  const nextStatus = postconditionPassed ? 'VERIFIED' : 'BLOCKED';
  const executionId = sponsorExecutionId || process.env.BOB_SESSION_ID || null;
  if (review.verification && review.verification.afterState?.status === nextStatus &&
      review.verification.sponsorExecutionId === executionId &&
      canonicalJson(review.verification.checkedFiles) === canonicalJson(checkedFiles) &&
      canonicalJson(review.verification.findings) === canonicalJson(review.findings)) {
    return review.verification;
  }
  review.status = nextStatus;
  const proof = {
    schemaVersion: 1,
    sourceEventId: review.sourceEventId,
    reviewId: review.reviewId,
    idempotencyKey: review.idempotencyKey,
    sponsor: 'IBM Bob 2.0 via MCP',
    sponsorExecutionId: executionId,
    source: review.metadata,
    beforeState: { status: 'PREPARED', fileCount: review.files.length },
    afterState: { status: review.status, findingCount: review.findings.length },
    checkedFiles,
    findings: review.findings,
    postconditionPassed,
    verifiedAt: new Date().toISOString(),
  };
  proof.receiptSha256 = digest(proof);
  review.verification = proof;
  writeJson(reviewPath(evidenceDirectory, review.reviewId), review);
  if (publishCanonical) writeJson(path.join(evidenceDirectory, 'canonical-proof.json'), proof);
  return proof;
}

function verifyReceipt(proof) {
  const { receiptSha256, ...unsigned } = proof;
  return typeof receiptSha256 === 'string' && digest(unsigned) === receiptSha256;
}

module.exports = { canonicalJson, digest, prepareReview, readReview, recordFinding, verifyReceipt, verifyReview };
