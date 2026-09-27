const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const files = [
  'server.js',
  'mcp-server.js',
  'src/aegis-core.js',
  'scripts/demo.js',
  'scripts/verify-evidence.js',
  'scripts/build.js',
  'tests/aegis-core.test.js',
  'tests/mcp-server.test.js',
];
for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  try {
    new Function('require', 'module', 'exports', '__dirname', '__filename', source);
  } catch (error) {
    throw new Error(`${file}: ${error.message}`);
  }
}
console.log(`Syntax checked ${files.length} JavaScript files.`);
