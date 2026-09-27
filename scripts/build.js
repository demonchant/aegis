const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const required = ['index.html', 'workspace.html', 'review.html', 'proof.html', 'styles.css', 'hosted.css', 'app.js', '.bob/mcp.json', 'README.md', 'Dockerfile', 'render.yaml'];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Required build artifact is missing: ${file}`);
}

const scanExtensions = new Set(['.js', '.json', '.html', '.css', '.md']);
const ignored = new Set(['.git', 'data', 'dist', 'node_modules', 'evidence']);
function scan(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) scan(full);
    else if (scanExtensions.has(path.extname(entry.name))) {
      const content = fs.readFileSync(full, 'utf8');
      if (/bob_prod_bob-apikey_[A-Za-z0-9_-]{20,}/.test(content)) throw new Error(`A Bob API key appears in ${path.relative(root, full)}.`);
    }
  }
}
scan(root);

const output = path.join(root, 'dist');
if (output !== path.join(root, 'dist')) throw new Error('Static output path escaped the workspace.');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
const publicFiles = [
  'index.html', 'workspace.html', 'review.html', 'guide.html', 'settings.html', 'account.html', 'data-handling.html', 'repository.html', 'proof.html',
  'styles.css', 'app.css', 'hosted.css', 'account.css', 'hero-carousel.css',
  'app.js', 'owner.js', 'privacy.js', 'repository.js', 'review-live.js', 'hero-carousel.js', 'proof.js',
  'assets', 'evidence/canonical-proof.json',
];
for (const item of publicFiles) {
  const source = path.join(root, item);
  const destination = path.join(output, item);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true });
}
console.log(`Build gate passed with ${required.length} required artifacts, no committed Bob key, and ${publicFiles.length} static export entries.`);
