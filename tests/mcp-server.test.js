const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

test('MCP server initializes and exposes the four Aegis tools', async (t) => {
  const root = path.resolve(__dirname, '..');
  const child = spawn(process.execPath, ['mcp-server.js'], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] });
  t.after(() => child.kill());
  const responses = [];
  let buffer = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) responses.push(JSON.parse(line));
    }
  });
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })}\n`);
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })}\n`);
  await new Promise((resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error('MCP response timed out')), 3000);
    const poll = setInterval(() => {
      if (responses.length >= 2) {
        clearTimeout(deadline);
        clearInterval(poll);
        resolve();
      }
    }, 10);
  });
  assert.equal(responses[0].result.serverInfo.name, 'aegis');
  assert.deepEqual(responses[1].result.tools.map((tool) => tool.name), ['aegis_prepare_review', 'aegis_record_finding', 'aegis_verify_review', 'aegis_get_review']);
});
