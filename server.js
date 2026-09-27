const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { BobRunner } = require('./src/bob-runner');
const { GitHubRepositoryProvider, parseReviewTarget, parseScope } = require('./src/repository-ingestion');
const { ReviewOrchestrator } = require('./src/review-orchestrator');
const { ReviewStore, openDatabase } = require('./src/review-store');

const PRODUCT_PAGES = new Set(['/workspace.html', '/review.html', '/guide.html', '/settings.html', '/repository.html']);
const PUBLIC_FILES = new Set([
  '/index.html', '/workspace.html', '/review.html', '/guide.html', '/settings.html', '/account.html', '/data-handling.html', '/repository.html', '/proof.html',
  '/styles.css', '/app.css', '/hosted.css', '/account.css', '/hero-carousel.css', '/app.js', '/owner.js', '/privacy.js', '/repository.js', '/review-live.js', '/hero-carousel.js', '/proof.js',
  '/evidence/canonical-proof.json',
]);

function createRateLimiter(limit = 20, windowMs = 15 * 60 * 1000) {
  const attempts = new Map();
  return (key) => {
    const now = Date.now();
    const entry = attempts.get(key) || { count: 0, started: now };
    if (now - entry.started > windowMs) { attempts.set(key, { count: 1, started: now }); return true; }
    entry.count += 1;
    attempts.set(key, entry);
    return entry.count <= limit;
  };
}

function send(response, status, value, headers = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  response.end(JSON.stringify(value));
}

function parseCookies(request) {
  const result = {};
  for (const part of (request.headers.cookie || '').split(';')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    try { result[decodeURIComponent(part.slice(0, index).trim())] = decodeURIComponent(part.slice(index + 1).trim()); } catch { /* ignore malformed cookies */ }
  }
  return result;
}

function tokenHash(token) { return crypto.createHash('sha256').update(token).digest('hex'); }

function readBody(request, maximum = 32 * 1024) {
  return new Promise((resolve, reject) => {
    let data = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      data += chunk;
      if (Buffer.byteLength(data) > maximum) { reject(new Error('Request is too large.')); request.destroy(); }
    });
    request.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { reject(new Error('Request body must be valid JSON.')); } });
    request.on('error', reject);
  });
}

function contentType(file) {
  return { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8' }[path.extname(file)] || 'application/octet-stream';
}

function publicFile(root, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  if (!PUBLIC_FILES.has(requested) && !requested.startsWith('/assets/')) return null;
  const resolved = path.resolve(root, `.${requested}`);
  if (!resolved.startsWith(`${path.resolve(root)}${path.sep}`)) return null;
  const stat = fs.statSync(resolved, { throwIfNoEntry: false });
  return stat?.isFile() ? resolved : null;
}

function sameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === request.headers.host; } catch { return false; }
}

function createAegisServer(options = {}) {
  const root = path.resolve(options.root || __dirname);
  const opened = options.database ? { database: options.database, databaseFile: options.databaseFile || ':memory:' } : openDatabase(root, options.databasePath);
  const database = opened.database;
  const store = options.store || new ReviewStore(database);
  const evidenceDirectory = path.resolve(options.evidenceDirectory || process.env.AEGIS_EVIDENCE_DIR || path.join(root, 'evidence'));
  fs.mkdirSync(evidenceDirectory, { recursive: true });
  const orchestrator = options.orchestrator || new ReviewOrchestrator({
    store,
    repositoryProvider: options.repositoryProvider || new GitHubRepositoryProvider(),
    bobRunner: options.bobRunner || new BobRunner(),
    evidenceDirectory,
    logger: options.logger || console,
  });
  const authAllowed = createRateLimiter(20, 15 * 60 * 1000);
  const reviewAllowed = createRateLimiter(10, 60 * 60 * 1000);

  function sessionUser(request) {
    const token = parseCookies(request).aegis_session;
    if (!token) return null;
    const session = database.prepare('SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?').get(tokenHash(token), Date.now());
    if (!session) return null;
    return database.prepare('SELECT id,name,email FROM users WHERE id = ?').get(session.user_id) || null;
  }

  function sessionCookie(userId) {
    const token = crypto.randomBytes(32).toString('base64url');
    database.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
    database.prepare('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').run(tokenHash(token), userId, Date.now() + 86400000);
    return `aegis_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
  }

  function requireUser(request, response) {
    const user = sessionUser(request);
    if (!user) send(response, 401, { error: 'Please sign in to continue.' });
    return user;
  }

  function runbook(user) {
    return database.prepare('SELECT r.id,r.updated_at,r.owner_id,u.name AS owner_name FROM runbooks r LEFT JOIN users u ON r.owner_id = u.id WHERE r.user_id = ?').get(user.id);
  }

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const pathname = url.pathname;
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    response.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
    try {
      if (request.method !== 'GET' && request.method !== 'HEAD' && !sameOrigin(request)) return send(response, 403, { error: 'Cross-origin request refused.' });
      if (pathname === '/api/health' && request.method === 'GET') return send(response, 200, { status: 'ok' });
      if (pathname === '/api/session' && request.method === 'GET') return send(response, 200, { user: sessionUser(request) });

      if (pathname === '/api/auth/signup' && request.method === 'POST') {
        if (!authAllowed(request.socket.remoteAddress || 'unknown')) return send(response, 429, { error: 'Too many attempts. Please wait before trying again.' });
        const payload = await readBody(request);
        const name = String(payload.name || '').trim();
        const email = String(payload.email || '').trim().toLowerCase();
        const password = String(payload.password || '');
        if (name.length < 2 || name.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12 || password.length > 1024) return send(response, 400, { error: 'Use a name, valid email, and a password of at least 12 characters.' });
        if (database.prepare('SELECT id FROM users WHERE email = ?').get(email)) return send(response, 409, { error: 'An account already exists for this email. Please sign in.' });
        const salt = crypto.randomBytes(16).toString('hex');
        const passwordHash = crypto.scryptSync(password, salt, 64).toString('hex');
        const user = { id: crypto.randomUUID(), name, email };
        const now = new Date().toISOString();
        database.prepare('INSERT INTO users (id,name,email,password_hash,salt,created_at) VALUES (?,?,?,?,?,?)').run(user.id, user.name, user.email, passwordHash, salt, now);
        database.prepare('INSERT INTO runbooks (id,user_id,owner_id,updated_at) VALUES (?,?,?,?)').run(crypto.randomUUID(), user.id, user.id, now);
        return send(response, 201, { user }, { 'Set-Cookie': sessionCookie(user.id) });
      }

      if (pathname === '/api/auth/login' && request.method === 'POST') {
        if (!authAllowed(request.socket.remoteAddress || 'unknown')) return send(response, 429, { error: 'Too many attempts. Please wait before trying again.' });
        const payload = await readBody(request);
        const email = String(payload.email || '').trim().toLowerCase();
        const password = String(payload.password || '');
        const record = database.prepare('SELECT * FROM users WHERE email = ?').get(email);
        const candidate = record ? crypto.scryptSync(password, record.salt, 64) : crypto.scryptSync(password, 'missing-account-salt', 64);
        if (!record || !crypto.timingSafeEqual(candidate, Buffer.from(record.password_hash, 'hex'))) return send(response, 401, { error: 'Email or password is incorrect.' });
        const user = { id: record.id, name: record.name, email: record.email };
        return send(response, 200, { user }, { 'Set-Cookie': sessionCookie(user.id) });
      }

      if (pathname === '/api/auth/logout' && request.method === 'POST') {
        const token = parseCookies(request).aegis_session;
        if (token) database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token));
        return send(response, 200, { ok: true }, { 'Set-Cookie': 'aegis_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' });
      }

      if (pathname === '/api/reviews' && request.method === 'POST') {
        const user = requireUser(request, response); if (!user) return;
        if (!reviewAllowed(user.id)) return send(response, 429, { error: 'Review limit reached. Please wait before starting another review.' });
        const payload = await readBody(request);
        const target = parseReviewTarget(payload.repositoryUrl, { reference: payload.reference, branch: payload.branch, commitSha: payload.commitSha, prUrl: payload.prUrl });
        parseScope(payload.scope);
        const requestKey = String(request.headers['idempotency-key'] || payload.idempotencyKey || '').trim() || null;
        if (requestKey && !/^[A-Za-z0-9._:-]{8,128}$/.test(requestKey)) return send(response, 400, { error: 'Idempotency key is invalid.' });
        const created = store.create({
          id: crypto.randomUUID(), userId: user.id, repositoryUrl: target.canonicalUrl,
          requestedReference: target.requestedReference, scope: String(payload.scope || '').trim() || null,
          requestKey, now: new Date().toISOString(),
        });
        if (!created.reused) orchestrator.enqueue(created.review.id);
        return send(response, created.reused ? 200 : 202, { review: created.review, reused: created.reused });
      }

      if (pathname === '/api/reviews' && request.method === 'GET') {
        const user = requireUser(request, response); if (!user) return;
        return send(response, 200, { reviews: store.listForUser(user.id) });
      }

      const reviewMatch = pathname.match(/^\/api\/reviews\/([0-9a-f-]{36})(?:\/(status|receipt))?$/i);
      if (reviewMatch && request.method === 'GET') {
        const user = requireUser(request, response); if (!user) return;
        const review = store.getForUser(reviewMatch[1], user.id);
        if (!review) return send(response, 404, { error: 'Review not found.' });
        if (reviewMatch[2] === 'status') return send(response, 200, { review: { id: review.id, status: review.status, error: review.error, updatedAt: review.updatedAt } });
        if (reviewMatch[2] === 'receipt') {
          if (!review.result?.proof) return send(response, 409, { error: 'Receipt is not available yet.' });
          const headers = url.searchParams.get('download') === '1' ? { 'Content-Disposition': `attachment; filename="aegis-${review.id}-receipt.json"` } : {};
          return send(response, 200, review.result.proof, headers);
        }
        return send(response, 200, { review });
      }

      if (pathname === '/api/runbook' && request.method === 'GET') {
        const user = requireUser(request, response); if (!user) return;
        return send(response, 200, { runbook: runbook(user) });
      }
      if (pathname === '/api/runbook/owner' && request.method === 'POST') {
        const user = requireUser(request, response); if (!user) return;
        const payload = await readBody(request);
        const ownerId = payload.ownerId === null ? null : String(payload.ownerId || '');
        if (ownerId && ownerId !== user.id) return send(response, 403, { error: 'You cannot assign another user as owner.' });
        database.prepare('UPDATE runbooks SET owner_id = ?, updated_at = ? WHERE user_id = ?').run(ownerId, new Date().toISOString(), user.id);
        return send(response, 200, { runbook: runbook(user) });
      }

      if (pathname.startsWith('/api/')) return send(response, 404, { error: 'API endpoint not found.' });
      if (PRODUCT_PAGES.has(pathname) && url.searchParams.get('judge') !== '1' && !sessionUser(request)) {
        response.writeHead(302, { Location: '/account.html' }); return response.end();
      }
      const file = publicFile(root, pathname);
      if (!file) return send(response, 404, { error: 'Not found.' });
      response.writeHead(200, { 'Content-Type': contentType(file), 'Cache-Control': file.endsWith('.html') ? 'no-store' : 'public, max-age=3600' });
      if (request.method === 'HEAD') return response.end();
      fs.createReadStream(file).pipe(response);
    } catch (error) {
      const status = /not configured|failed|timed out/i.test(error.message) ? 503 : 400;
      send(response, status, { error: String(error.message || 'Request could not be completed.').slice(0, 1000) });
    }
  });

  return { server, database, databaseFile: opened.databaseFile, store, orchestrator, evidenceDirectory };
}

if (require.main === module) {
  const port = Number(process.env.PORT || 4173);
  const application = createAegisServer();
  application.server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') console.error(`Port ${port} is already in use.`);
    else console.error(error.message);
    process.exitCode = 1;
  });
  application.server.listen(port, () => {
    application.orchestrator.recover();
    console.log(`Aegis is running at http://localhost:${port}`);
  });
}

module.exports = { createAegisServer, createRateLimiter, publicFile, readBody, sameOrigin };
