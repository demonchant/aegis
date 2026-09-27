const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const REVIEW_COLUMNS = {
  repository_url: 'TEXT', requested_ref: 'TEXT', review_scope: 'TEXT', commit_sha: 'TEXT', updated_at: 'TEXT', error: 'TEXT',
  bob_execution_id: 'TEXT', aegis_review_id: 'TEXT', receipt_sha256: 'TEXT', result_json: 'TEXT', request_key: 'TEXT',
};

function resolveDatabasePath(rootDirectory, configured = process.env.AEGIS_DB_PATH) {
  return path.resolve(configured || path.join(rootDirectory, 'data', 'aegis.db'));
}

function openDatabase(rootDirectory, configured) {
  const databaseFile = resolveDatabasePath(rootDirectory, configured);
  fs.mkdirSync(path.dirname(databaseFile), { recursive: true });
  const database = new DatabaseSync(databaseFile);
  database.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, salt TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS reviews (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, content TEXT NOT NULL, status TEXT NOT NULL, remediation TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS runbooks (id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, owner_id TEXT REFERENCES users(id), updated_at TEXT NOT NULL);
  `);
  const existing = new Set(database.prepare('PRAGMA table_info(reviews)').all().map((column) => column.name));
  for (const [name, type] of Object.entries(REVIEW_COLUMNS)) {
    if (!existing.has(name)) database.exec(`ALTER TABLE reviews ADD COLUMN ${name} ${type}`);
  }
  database.exec('CREATE UNIQUE INDEX IF NOT EXISTS reviews_user_request_key ON reviews(user_id, request_key) WHERE request_key IS NOT NULL; CREATE INDEX IF NOT EXISTS reviews_user_created ON reviews(user_id, created_at DESC);');
  database.prepare("UPDATE reviews SET status = 'QUEUED' WHERE status = 'queued'").run();
  return { database, databaseFile };
}

function parseResult(value) {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

function publicReview(row, includeResult = false) {
  if (!row) return null;
  const review = {
    id: row.id,
    repositoryUrl: row.repository_url || row.content,
    requestedReference: row.requested_ref,
    scope: row.review_scope,
    commitSha: row.commit_sha,
    status: String(row.status).toUpperCase(),
    error: row.error,
    bobExecutionId: row.bob_execution_id,
    aegisReviewId: row.aegis_review_id,
    receiptSha256: row.receipt_sha256,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  };
  if (includeResult) review.result = parseResult(row.result_json);
  return review;
}

class ReviewStore {
  constructor(database) { this.database = database; }

  create({ id, userId, repositoryUrl, requestedReference, scope, requestKey, now }) {
    if (requestKey) {
      const existing = this.database.prepare('SELECT * FROM reviews WHERE user_id = ? AND request_key = ?').get(userId, requestKey);
      if (existing) return { review: publicReview(existing, true), reused: true };
    }
    this.database.prepare(`INSERT INTO reviews
      (id,user_id,content,status,created_at,repository_url,requested_ref,review_scope,updated_at,request_key)
      VALUES (?,?,?,'QUEUED',?,?,?,?,?,?)`).run(id, userId, repositoryUrl, now, repositoryUrl, requestedReference, scope, now, requestKey);
    return { review: this.getForUser(id, userId), reused: false };
  }

  getInternal(id) { return this.database.prepare('SELECT * FROM reviews WHERE id = ?').get(id) || null; }
  getForUser(id, userId) { return publicReview(this.database.prepare('SELECT * FROM reviews WHERE id = ? AND user_id = ?').get(id, userId), true); }
  listForUser(userId) { return this.database.prepare('SELECT * FROM reviews WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').all(userId).map((row) => publicReview(row, false)); }
  pending() { return this.database.prepare("SELECT id FROM reviews WHERE status IN ('QUEUED','FETCHING','ANALYZING','VERIFYING') ORDER BY created_at").all(); }

  update(id, values) {
    const columns = {
      status: 'status', commitSha: 'commit_sha', error: 'error', bobExecutionId: 'bob_execution_id', aegisReviewId: 'aegis_review_id',
      receiptSha256: 'receipt_sha256', result: 'result_json', updatedAt: 'updated_at',
    };
    const assignments = [];
    const parameters = [];
    for (const [key, column] of Object.entries(columns)) {
      if (!Object.prototype.hasOwnProperty.call(values, key)) continue;
      assignments.push(`${column} = ?`);
      parameters.push(key === 'result' ? JSON.stringify(values[key]) : values[key]);
    }
    if (!Object.prototype.hasOwnProperty.call(values, 'updatedAt')) { assignments.push('updated_at = ?'); parameters.push(new Date().toISOString()); }
    if (!assignments.length) return;
    parameters.push(id);
    this.database.prepare(`UPDATE reviews SET ${assignments.join(', ')} WHERE id = ?`).run(...parameters);
  }

  recoverPending() {
    this.database.prepare("UPDATE reviews SET status = 'QUEUED', error = NULL, updated_at = ? WHERE status IN ('FETCHING','ANALYZING','VERIFYING')").run(new Date().toISOString());
  }
}

module.exports = { ReviewStore, openDatabase, publicReview, resolveDatabasePath };
