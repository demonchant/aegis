const path = require('node:path');
const { prepareReview, readReview, recordFinding, verifyReview } = require('./src/aegis-core');

const workspaceRoot = path.resolve(process.env.AEGIS_WORKSPACE_ROOT || process.cwd());
const evidenceDirectory = path.resolve(process.env.AEGIS_EVIDENCE_DIR || path.join(workspaceRoot, 'evidence'));

const tools = [
  {
    name: 'aegis_prepare_review',
    description: 'Create an idempotent, hash-anchored security review before reporting findings. Call this after inspecting the relevant repository files.',
    inputSchema: {
      type: 'object',
      properties: {
        sourceEventId: { type: 'string', description: 'Stable change identity, such as a PR number, commit, or named demo scenario.' },
        title: { type: 'string' },
        files: { type: 'array', minItems: 1, maxItems: 50, items: { type: 'string', description: 'Workspace-relative file path.' } },
      },
      required: ['sourceEventId', 'title', 'files'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'aegis_record_finding',
    description: 'Record one Bob security finding against an exact file hash and line range in a prepared review.',
    inputSchema: {
      type: 'object',
      properties: {
        reviewId: { type: 'string' },
        file: { type: 'string' },
        lineStart: { type: 'integer', minimum: 1 },
        lineEnd: { type: 'integer', minimum: 1 },
        severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'informational'] },
        category: { type: 'string' },
        claim: { type: 'string' },
        remediation: { type: 'string' },
      },
      required: ['reviewId', 'file', 'lineStart', 'severity', 'category', 'claim', 'remediation'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'aegis_verify_review',
    description: 'Re-read every scoped file, reject stale evidence, and publish a tamper-evident machine-readable receipt.',
    inputSchema: { type: 'object', properties: { reviewId: { type: 'string' } }, required: ['reviewId'], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'aegis_get_review',
    description: 'Read a stored Aegis review and its verification receipt.',
    inputSchema: { type: 'object', properties: { reviewId: { type: 'string' } }, required: ['reviewId'], additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
];

function reply(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`);
}

function error(id, code, message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } })}\n`);
}

function callTool(name, args) {
  if (name === 'aegis_prepare_review') return prepareReview({ workspaceRoot, evidenceDirectory, ...args });
  if (name === 'aegis_record_finding') return recordFinding({ workspaceRoot, evidenceDirectory, reviewId: args.reviewId, finding: args });
  if (name === 'aegis_verify_review') return verifyReview({ workspaceRoot, evidenceDirectory, reviewId: args.reviewId });
  if (name === 'aegis_get_review') return readReview(evidenceDirectory, args.reviewId);
  throw new Error(`Unknown tool: ${name}`);
}

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let newline;
  while ((newline = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    let request;
    try {
      request = JSON.parse(line);
      if (request.method === 'initialize') {
        reply(request.id, { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'aegis', version: '2.0.0' } });
      } else if (request.method === 'tools/list') {
        reply(request.id, { tools });
      } else if (request.method === 'tools/call') {
        try {
          const value = callTool(request.params?.name, request.params?.arguments || {});
          reply(request.id, { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }], structuredContent: value });
        } catch (toolError) {
          reply(request.id, { content: [{ type: 'text', text: toolError.message }], isError: true });
        }
      } else if (request.method === 'ping') {
        reply(request.id, {});
      } else if (!request.method?.startsWith('notifications/')) {
        error(request.id, -32601, 'Method not found');
      }
    } catch (parseError) {
      error(request?.id ?? null, -32700, 'Parse error');
    }
  }
});
