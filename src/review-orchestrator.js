const path = require('node:path');
const { prepareReview, readReview, recordFinding, verifyReview } = require('./aegis-core');

const ACTIVE_STATES = new Set(['QUEUED', 'FETCHING', 'ANALYZING', 'VERIFYING']);

class ReviewOrchestrator {
  constructor({ store, repositoryProvider, bobRunner, evidenceDirectory, logger = console }) {
    this.store = store;
    this.repositoryProvider = repositoryProvider;
    this.bobRunner = bobRunner;
    this.evidenceDirectory = path.resolve(evidenceDirectory);
    this.logger = logger;
    this.queue = [];
    this.queued = new Set();
    this.running = false;
  }

  enqueue(reviewId) {
    if (!this.queued.has(reviewId)) { this.queued.add(reviewId); this.queue.push(reviewId); }
    setImmediate(() => this.drain());
  }

  async drain() {
    if (this.running) return;
    this.running = true;
    while (this.queue.length) {
      const id = this.queue.shift();
      this.queued.delete(id);
      try { await this.run(id); } catch (error) { this.logger.error(`Review ${id} failed: ${error.message}`); }
    }
    this.running = false;
  }

  async run(reviewId) {
    const stored = this.store.getInternal(reviewId);
    if (!stored || !ACTIVE_STATES.has(String(stored.status).toUpperCase())) return;
    let acquisition;
    try {
      this.store.update(reviewId, { status: 'FETCHING', error: null });
      acquisition = await this.repositoryProvider.acquire({
        repositoryUrl: stored.repository_url || stored.content,
        reference: stored.requested_ref,
        scope: stored.review_scope,
      });
      this.store.update(reviewId, { status: 'ANALYZING', commitSha: acquisition.commitSha });
      const bob = await this.bobRunner.run({
        analysisRoot: acquisition.temporaryRoot,
        repositoryRoot: acquisition.repositoryRoot,
        files: acquisition.files,
        repository: acquisition.repository.canonicalUrl,
        commitSha: acquisition.commitSha,
      });
      this.store.update(reviewId, { status: 'VERIFYING', bobExecutionId: bob.executionId || null });
      const prepared = prepareReview({
        workspaceRoot: acquisition.repositoryRoot,
        evidenceDirectory: this.evidenceDirectory,
        sourceEventId: `${acquisition.repository.canonicalUrl}@${acquisition.commitSha}`,
        title: `Security review of ${acquisition.repository.owner}/${acquisition.repository.repository}`,
        files: acquisition.files,
        metadata: { repository: acquisition.repository.canonicalUrl, commitSha: acquisition.commitSha, hostedReviewId: reviewId },
      });
      const rejectedFindings = [];
      for (const finding of bob.findings) {
        try {
          recordFinding({ workspaceRoot: acquisition.repositoryRoot, evidenceDirectory: this.evidenceDirectory, reviewId: prepared.review.reviewId, finding });
        } catch (error) {
          rejectedFindings.push({ file: finding.file, reason: error.message });
        }
      }
      const proof = verifyReview({
        workspaceRoot: acquisition.repositoryRoot,
        evidenceDirectory: this.evidenceDirectory,
        reviewId: prepared.review.reviewId,
        sponsorExecutionId: bob.executionId || null,
        publishCanonical: false,
      });
      const evidenceReview = readReview(this.evidenceDirectory, prepared.review.reviewId);
      const status = proof.postconditionPassed ? 'VERIFIED' : 'BLOCKED';
      const error = status === 'BLOCKED'
        ? (evidenceReview.findings.length === 0 ? 'No Bob finding passed Aegis evidence validation.' : 'Evidence changed before verification completed.')
        : null;
      this.store.update(reviewId, {
        status,
        error,
        commitSha: acquisition.commitSha,
        bobExecutionId: bob.executionId || null,
        aegisReviewId: evidenceReview.reviewId,
        receiptSha256: proof.receiptSha256,
        result: {
          summary: bob.summary,
          findings: evidenceReview.findings,
          rejectedFindings,
          proof,
          reviewedFiles: acquisition.files,
          scopeTruncated: acquisition.truncated,
          candidateFileCount: acquisition.candidateCount,
          bobStats: bob.stats || null,
        },
      });
    } catch (error) {
      this.store.update(reviewId, { status: 'FAILED', error: String(error.message || 'Review failed.').slice(0, 1000) });
      throw error;
    } finally {
      if (acquisition?.cleanup) {
        try { acquisition.cleanup(); } catch (error) { this.logger.error(`Temporary review cleanup failed for ${reviewId}: ${error.message}`); }
      }
    }
  }

  recover() {
    this.store.recoverPending();
    for (const row of this.store.pending()) this.enqueue(row.id);
  }
}

module.exports = { ACTIVE_STATES, ReviewOrchestrator };
