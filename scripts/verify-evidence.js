const fs = require('node:fs');
const path = require('node:path');
const { digest, verifyReceipt } = require('../src/aegis-core');

const root = path.resolve(__dirname, '..');
const proofFile = path.join(root, 'evidence', 'canonical-proof.json');
if (!fs.existsSync(proofFile)) throw new Error('No canonical proof. Run npm run demo first.');
const proof = JSON.parse(fs.readFileSync(proofFile, 'utf8'));
if (!verifyReceipt(proof)) throw new Error('Receipt digest does not match its canonical contents.');
for (const checked of proof.checkedFiles) {
  const file = path.resolve(root, checked.path);
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) throw new Error(`Unsafe evidence path: ${checked.path}`);
  const actual = digest(fs.readFileSync(file, 'utf8'));
  if (actual !== checked.expectedSha256) throw new Error(`Evidence is stale: ${checked.path}`);
}
if (!proof.postconditionPassed || proof.afterState.status !== 'VERIFIED') throw new Error('Proof postcondition did not pass.');
console.log(`Verified evidence receipt ${proof.receiptSha256}`);
