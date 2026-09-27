const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createAegisServer } = require('../server');

async function json(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  return { response, body: await response.json() };
}

test('review APIs enforce ownership and idempotent creation', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-api-'));
  const application = createAegisServer({
    root: path.resolve(__dirname, '..'),
    databasePath: path.join(root, 'aegis.db'),
    evidenceDirectory: path.join(root, 'evidence'),
    orchestrator: { enqueue() {}, recover() {} },
  });
  await new Promise((resolve) => application.server.listen(0, '127.0.0.1', resolve));
  const address = application.server.address();
  const base = 'http://127.0.0.1:' + address.port;
  t.after(async () => {
    await new Promise((resolve) => application.server.close(resolve));
    application.database.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  async function signup(name, email) {
    const result = await json(base + '/api/auth/signup', { method: 'POST', body: JSON.stringify({ name, email, password: 'correct horse battery staple' }) });
    assert.equal(result.response.status, 201);
    return result.response.headers.get('set-cookie').split(';')[0];
  }
  const ownerCookie = await signup('Owner User', 'owner@test.invalid');
  const otherCookie = await signup('Other User', 'other@test.invalid');
  const payload = JSON.stringify({ repositoryUrl: 'https://github.com/owner/repository', idempotencyKey: 'request-key-1234' });
  const first = await json(base + '/api/reviews', { method: 'POST', headers: { Cookie: ownerCookie }, body: payload });
  assert.equal(first.response.status, 202);
  const duplicate = await json(base + '/api/reviews', { method: 'POST', headers: { Cookie: ownerCookie }, body: payload });
  assert.equal(duplicate.response.status, 200);
  assert.equal(duplicate.body.review.id, first.body.review.id);
  assert.equal(duplicate.body.reused, true);
  const forbidden = await json(base + '/api/reviews/' + first.body.review.id, { headers: { Cookie: otherCookie } });
  assert.equal(forbidden.response.status, 404);
  const owned = await json(base + '/api/reviews/' + first.body.review.id, { headers: { Cookie: ownerCookie } });
  assert.equal(owned.response.status, 200);
});
