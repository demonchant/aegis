const judgeMode = new URLSearchParams(window.location.search).get('judge') === '1';
const activeStatuses = new Set(['QUEUED', 'FETCHING', 'ANALYZING', 'VERIFYING']);
const statusLabels = {
  QUEUED: 'Waiting for an available review worker',
  FETCHING: 'Fetching repository',
  ANALYZING: 'Analyzing with IBM Bob',
  VERIFYING: 'Anchoring and verifying evidence',
  VERIFIED: 'Verified security review',
  BLOCKED: 'Review blocked',
  FAILED: 'Review failed',
};

if (document.body.classList.contains('appBody') && !document.querySelector('link[href="app.css"]')) {
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = 'app.css';
  document.head.append(stylesheet);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

async function request(endpoint, options = {}) {
  const response = await fetch(endpoint, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  let payload;
  try { payload = await response.json(); } catch { payload = {}; }
  if (!response.ok) {
    const error = new Error(payload.error || 'Aegis could not complete the request.');
    error.status = response.status;
    throw error;
  }
  return payload;
}

function announce(message) {
  const toast = document.querySelector('.toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(announce.timer);
  announce.timer = window.setTimeout(() => toast.classList.remove('show'), 2800);
}

function renderIdentity(user) {
  document.querySelectorAll('.sideProfile b').forEach((item) => { item.textContent = user.name; });
  const initials = user.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  document.querySelectorAll('.avatar').forEach((item) => { item.textContent = initials; });
}

async function requireSession() {
  if (judgeMode) return null;
  const session = await request('/api/session');
  if (!session.user) {
    window.location.replace('account.html?next=' + encodeURIComponent(window.location.pathname + window.location.search));
    return null;
  }
  renderIdentity(session.user);
  return session.user;
}

document.querySelectorAll('[data-logout]').forEach((button) => button.addEventListener('click', async () => {
  await request('/api/auth/logout', { method: 'POST', body: '{}' });
  window.location.replace('account.html');
}));

const accountForm = document.querySelector('#accountForm');
if (accountForm) {
  accountForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = accountForm.querySelector('button[type="submit"]');
    const mode = accountForm.dataset.mode || 'signup';
    const errorElement = document.querySelector('#accountError');
    button.disabled = true;
    errorElement.textContent = '';
    try {
      await request(mode === 'signup' ? '/api/auth/signup' : '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          name: document.querySelector('#name').value.trim(),
          email: document.querySelector('#email').value.trim(),
          password: document.querySelector('#password').value,
        }),
      });
      const next = new URLSearchParams(window.location.search).get('next');
      window.location.replace(next && next.startsWith('/') ? next : 'workspace.html');
    } catch (error) {
      errorElement.textContent = error.message;
      button.disabled = false;
    }
  });
  document.querySelectorAll('[data-account-mode]').forEach((button) => button.addEventListener('click', () => {
    const mode = button.dataset.accountMode;
    accountForm.dataset.mode = mode;
    document.querySelector('#nameField').style.display = mode === 'signup' ? 'block' : 'none';
    document.querySelector('#accountTitle').textContent = mode === 'signup' ? 'Create your secure workspace' : 'Welcome back';
    accountForm.querySelector('button[type="submit"]').textContent = mode === 'signup' ? 'Create account →' : 'Sign in →';
    document.querySelectorAll('[data-account-mode]').forEach((item) => item.classList.toggle('selected', item === button));
  }));
}

function statusClass(status) {
  if (status === 'VERIFIED') return 'clear';
  if (status === 'BLOCKED' || status === 'FAILED') return 'elevated';
  return 'review';
}

function renderReviewList(reviews) {
  const target = document.querySelector('#reviewList');
  if (!reviews.length) {
    target.innerHTML = '<div class="emptyState">No reviews yet. Submit a public GitHub repository above.</div>';
    return;
  }
  target.innerHTML = reviews.map((review) =>
    '<a class="reviewRow" href="review.html?id=' + encodeURIComponent(review.id) + '">' +
    '<span class="reviewIcon ' + (review.status === 'VERIFIED' ? 'cyan' : 'amber') + '">' + (review.status === 'VERIFIED' ? '✓' : '◌') + '</span>' +
    '<div><b>' + escapeHtml(review.repositoryUrl) + '</b><small>' + escapeHtml(review.commitSha || review.requestedReference || 'Resolving immutable commit') + ' · ' + escapeHtml(new Date(review.createdAt).toLocaleString()) + '</small></div>' +
    '<span class="riskTag ' + statusClass(review.status) + '">' + escapeHtml(review.status) + '</span><span class="rowArrow">→</span></a>'
  ).join('');
}

async function loadReviews() {
  const payload = await request('/api/reviews');
  renderReviewList(payload.reviews);
}

async function initializeWorkspace() {
  const form = document.querySelector('#reviewForm');
  if (!form) return;
  if (judgeMode) {
    form.querySelectorAll('input,textarea,button').forEach((element) => { element.disabled = true; });
    document.querySelector('#reviewFormMessage').textContent = 'Judge Mode is a read-only preview. Sign in for live reviews.';
    document.querySelector('#reviewList').innerHTML = '<div class="emptyState">Live account data is hidden in Judge Mode.</div>';
    return;
  }
  if (!await requireSession()) return;
  await loadReviews();
  document.querySelector('#refreshReviews').addEventListener('click', () => loadReviews().catch((error) => announce(error.message)));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const message = document.querySelector('#reviewFormMessage');
    button.disabled = true;
    message.textContent = 'Creating the review job…';
    try {
      const payload = {
        repositoryUrl: document.querySelector('#repositoryUrl').value.trim(),
        reference: document.querySelector('#reviewReference').value.trim() || undefined,
        scope: document.querySelector('#reviewScope').value.trim() || undefined,
        idempotencyKey: crypto.randomUUID(),
      };
      const response = await request('/api/reviews', { method: 'POST', body: JSON.stringify(payload) });
      window.location.href = 'review.html?id=' + encodeURIComponent(response.review.id);
    } catch (error) {
      message.textContent = error.message;
      button.disabled = false;
    }
  });
}

function processingTimeline(status) {
  const order = ['FETCHING', 'ANALYZING', 'VERIFYING'];
  const current = order.indexOf(status);
  return '<div class="reviewTimeline">' + order.map((step, index) =>
    '<div class="' + (index < current ? 'done' : index === current ? 'active' : '') + '"><span>' + (index < current ? '✓' : index + 1) + '</span><b>' + escapeHtml(statusLabels[step]) + '</b></div>'
  ).join('') + '</div>';
}

function findingMarkup(finding) {
  return '<article class="findingCard hostedFinding"><div class="findingTop">' +
    '<span class="severityPill severity-' + escapeHtml(finding.severity) + '">' + escapeHtml(finding.severity.toUpperCase()) + '</span>' +
    '<div><h3>' + escapeHtml(finding.category) + '</h3><code>' + escapeHtml(finding.file) + ' : ' + finding.lineStart + '-' + finding.lineEnd + '</code></div></div>' +
    '<div class="findingBody"><small>Finding</small><p>' + escapeHtml(finding.claim) + '</p><small>Remediation</small><p>' + escapeHtml(finding.remediation) + '</p></div>' +
    '<div class="hashGrid"><div><small>File SHA256</small><code>' + escapeHtml(finding.fileSha256) + '</code></div><div><small>Evidence SHA256</small><code>' + escapeHtml(finding.evidenceSha256) + '</code></div></div>' +
    '<div class="verificationFlag">✓ VERIFIED EVIDENCE</div></article>';
}

function renderReview(review) {
  const target = document.querySelector('#reviewDetail');
  document.querySelector('#reviewCrumb').textContent = review.repositoryUrl || 'Security review';
  if (activeStatuses.has(review.status)) {
    target.innerHTML = '<section class="reviewHero hostedHero"><div><div class="eyebrow"><span class="pulse"></span> ' + escapeHtml(review.status) + '</div>' +
      '<h1>' + escapeHtml(statusLabels[review.status]) + '</h1><p>' + escapeHtml(review.repositoryUrl) + '</p>' +
      '<div class="metaLine"><span>Review #' + escapeHtml(review.id.slice(0, 8)) + '</span><span>' + escapeHtml(review.commitSha || 'Commit pending') + '</span></div></div><span class="spinner large"></span></section>' +
      processingTimeline(review.status);
    return;
  }
  if (review.status === 'FAILED' || review.status === 'BLOCKED') {
    const rejected = review.result?.rejectedFindings || [];
    target.innerHTML = '<section class="reviewHero hostedHero blockedReview"><div><div class="eyebrow">' + escapeHtml(review.status) + '</div><h1>' + escapeHtml(statusLabels[review.status]) + '</h1>' +
      '<p>' + escapeHtml(review.error || 'Aegis could not verify this review.') + '</p><div class="metaLine"><span>' + escapeHtml(review.repositoryUrl) + '</span><span>' + escapeHtml(review.commitSha || 'No commit resolved') + '</span></div></div></section>' +
      (rejected.length ? '<section class="workspaceSection"><h2>Rejected Bob findings</h2>' + rejected.map((item) => '<p><code>' + escapeHtml(item.file) + '</code> — ' + escapeHtml(item.reason) + '</p>').join('') + '</section>' : '') +
      '<p><a class="button buttonGhost" href="workspace.html">Start another review</a></p>';
    return;
  }
  const result = review.result || {};
  const findings = result.findings || [];
  target.innerHTML = '<section class="verifiedBanner"><span>✓</span><div><p class="eyebrow">Cryptographic postcondition passed</p><h1>VERIFIED SECURITY REVIEW</h1><p>' + escapeHtml(result.summary || 'IBM Bob findings are anchored to current repository bytes.') + '</p></div></section>' +
    '<section class="proofMetadata">' +
    '<div><small>Repository</small><b>' + escapeHtml(review.repositoryUrl) + '</b></div><div><small>Commit</small><code>' + escapeHtml(review.commitSha) + '</code></div>' +
    '<div><small>Reviewed</small><b>' + escapeHtml(new Date(review.updatedAt).toLocaleString()) + '</b></div><div><small>IBM Bob execution</small><code>' + escapeHtml(review.bobExecutionId || 'Not reported') + '</code></div>' +
    '<div><small>Aegis Review ID</small><code>' + escapeHtml(review.aegisReviewId) + '</code></div><div><small>Receipt SHA256</small><code>' + escapeHtml(review.receiptSha256) + '</code></div></section>' +
    '<div class="receiptActions"><a class="button" href="proof.html?review=' + encodeURIComponent(review.id) + '">View Proof</a><a class="button buttonGhost" href="/api/reviews/' + encodeURIComponent(review.id) + '/receipt?download=1">Download JSON Receipt</a></div>' +
    '<section class="workspaceSection findingsResults"><div class="sectionBar"><div><p class="eyebrow">' + findings.length + ' verified ' + (findings.length === 1 ? 'finding' : 'findings') + '</p><h2>Evidence-backed results.</h2></div></div>' + findings.map(findingMarkup).join('') + '</section>';
}

async function initializeReview() {
  const target = document.querySelector('#reviewDetail');
  if (!target) return;
  if (judgeMode) {
    target.innerHTML = '<div class="emptyState">Judge Mode shows the canonical public proof. <a href="proof.html?judge=1">Open canonical proof →</a></div>';
    return;
  }
  if (!await requireSession()) return;
  let id = new URLSearchParams(window.location.search).get('id');
  if (!id) {
    const response = await request('/api/reviews');
    if (!response.reviews.length) { window.location.replace('workspace.html'); return; }
    id = response.reviews[0].id;
    window.history.replaceState({}, '', 'review.html?id=' + encodeURIComponent(id));
  }
  const refresh = async () => {
    try {
      const response = await request('/api/reviews/' + encodeURIComponent(id));
      renderReview(response.review);
      if (activeStatuses.has(response.review.status)) window.setTimeout(refresh, 2000);
    } catch (error) {
      target.innerHTML = '<div class="emptyState">' + escapeHtml(error.status === 404 ? 'This review does not exist or belongs to another account.' : error.message) + '</div>';
    }
  };
  await refresh();
}

document.querySelectorAll('[data-toast]').forEach((button) => button.addEventListener('click', () => announce(button.dataset.toast)));
document.querySelectorAll('[data-copy]').forEach((button) => button.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(button.dataset.copy); announce('Safe pattern copied.'); }
  catch { announce('Copy is unavailable in this browser.'); }
}));
document.querySelectorAll('.task>button').forEach((button) => button.addEventListener('click', () => {
  const task = button.closest('.task');
  task.classList.toggle('done');
  button.querySelector('span').textContent = task.classList.contains('done') ? '✓' : '';
}));
function loadPageScript(source) {
  const script = document.createElement('script');
  script.src = source;
  document.body.append(script);
}
if (document.querySelector('#repositoryInput')) loadPageScript('repository.js');
if (document.querySelector('.ownerCard')) loadPageScript('owner.js');
if (document.body.classList.contains('appBody')) loadPageScript('privacy.js');
if (document.body.classList.contains('appBody') && !document.querySelector('#reviewForm') && !document.querySelector('#reviewDetail')) {
  requireSession().catch((error) => announce(error.message));
}
initializeWorkspace().catch((error) => announce(error.message));
initializeReview().catch((error) => announce(error.message));
