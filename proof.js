const text = (id, value) => { document.getElementById(id).textContent = value; };
const reviewId = new URLSearchParams(window.location.search).get('review');
const source = reviewId ? '/api/reviews/' + encodeURIComponent(reviewId) + '/receipt' : 'evidence/canonical-proof.json';
fetch(source, { cache: 'no-store' })
  .then((response) => {
    if (!response.ok) throw new Error(reviewId ? 'Sign in to view this review receipt.' : 'Run npm run demo to create the canonical proof.');
    return response.json();
  })
  .then((proof) => {
    const current = proof.checkedFiles.filter((file) => file.current).length;
    const finding = proof.findings[0];
    text('proofState', proof.postconditionPassed ? 'PASS' : 'BLOCKED');
    text('proofTitle', proof.postconditionPassed ? 'Repository evidence is current and complete.' : 'Evidence requires reconciliation.');
    text('reviewId', proof.reviewId);
    text('findingCount', String(proof.findings.length));
    text('fileStatus', current + '/' + proof.checkedFiles.length);
    text('receipt', proof.receiptSha256);
    text('findingClaim', finding?.claim || 'No finding was recorded.');
    text('findingLocation', finding ? finding.file + ':' + finding.lineStart + '-' + finding.lineEnd : '—');
  })
  .catch((error) => {
    const element = document.getElementById('proofError');
    element.hidden = false;
    element.textContent = error.message;
    text('proofState', 'NONE');
    text('proofTitle', 'No verified evidence is available yet.');
  });
