const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const required = ['index.html', 'workspace.html', 'proof.html', 'styles.css', 'app.js', '.bob/mcp.json', 'README.md', 'vercel.json'];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Required build artifact is missing: ${file}`);
}

const scanExtensions = new Set(['.js', '.json', '.html', '.css', '.md']);
const ignored = new Set(['.git', 'data', 'node_modules', 'evidence']);
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
console.log(`Build gate passed with ${required.length} required artifacts and no committed Bob key.`);
