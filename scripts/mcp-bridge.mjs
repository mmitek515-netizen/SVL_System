// Isolated, read-only Streamable HTTP MCP bridge: no command execution.
import { createServer } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import 'dotenv/config';

const SUPPORTED = ['2025-11-25', '2025-06-18', '2025-03-26'];
const TOOLS = [
  { name: 'svl_bridge_status', description: 'Read bridge status, without executing commands.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true } },
  { name: 'svl_agents', description: 'List configured chat roles, not live worker status.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true } },
  { name: 'svl_ai_status', description: 'Read an allowlisted subset of local SVL /api/ai/status.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true } },
];
const sha = value => createHash('sha256').update(value).digest();
const result = (id, data) => ({ jsonrpc: '2.0', id, result: data });
const error = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
const output = data => ({ content: [{ type: 'text', text: JSON.stringify(data) }] });
const short = value => typeof value === 'string' ? value.slice(0, 200) : null;

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(JSON.stringify(body));
}
async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 65536) throw new Error('too-large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export function createMcpServer({ token, appPort = 3000, allowedOrigins = [] }) {
  if (typeof token !== 'string' || token.length < 32)
    throw new Error('Set SVL_MCP_TOKEN to a random secret of at least 32 characters.');
  if (!Number.isInteger(Number(appPort)) || +appPort < 1 || +appPort > 65535)
    throw new Error('Invalid SVL_APP_PORT.');
  return createServer(async (req, res) => {
    if (req.url !== '/mcp' && req.url !== '/healthz')
      return send(res, 404, { error: 'Not found' });
    if (req.headers.origin && !allowedOrigins.includes(req.headers.origin))
      return send(res, 403, { error: 'Forbidden origin' });
    const auth = req.headers.authorization || '';
    const provided = typeof auth === 'string' && auth.startsWith('Bearer ')
      ? auth.slice(7).trim() : '';
    if (!timingSafeEqual(sha(provided), sha(token)))
      return send(res, 401, { error: 'Unauthorized' }, { 'WWW-Authenticate': 'Bearer realm="SVL MCP"' });
    if (req.url === '/healthz') return req.method === 'GET'
      ? send(res, 200, { ok: true, service: 'svl-mcp-bridge' })
      : send(res, 405, { error: 'Method not allowed' }, { Allow: 'GET' });
    if (req.method !== 'POST')
      return send(res, 405, { error: 'Method not allowed' }, { Allow: 'POST' });
    if (!String(req.headers['content-type'] || '').startsWith('application/json'))
      return send(res, 415, { error: 'Expected application/json' });
    const protocol = req.headers['mcp-protocol-version'];
    if (protocol && !SUPPORTED.includes(protocol))
      return send(res, 400, error(null, -32600, 'Unsupported MCP protocol version'));
    let msg;
    try { msg = await readBody(req); }
    catch (e) { return send(res, e.message === 'too-large' ? 413 : 400,
      error(null, -32700, 'Invalid JSON or oversized payload')); }
    if (!msg || typeof msg !== 'object' || Array.isArray(msg) ||
      msg.jsonrpc !== '2.0' || typeof msg.method !== 'string')
      return send(res, 400, error(msg?.id ?? null, -32600, 'Invalid request'));
    if (!Object.hasOwn(msg, 'id')) {
      res.writeHead(202, { 'Cache-Control': 'no-store' }); return res.end();
    }
    const id = msg.id;
    if (msg.method === 'initialize') return send(res, 200, result(id, {
      protocolVersion: SUPPORTED.includes(msg.params?.protocolVersion)
        ? msg.params.protocolVersion : SUPPORTED[0],
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'svl-mcp-readonly', version: '1.0.0' },
      instructions: 'Status-only MCP. No filesystem writes, shell, root or GitHub actions.',
    }));
    if (msg.method === 'ping') return send(res, 200, result(id, {}));
    if (msg.method === 'tools/list') return send(res, 200, result(id, { tools: TOOLS }));
    if (msg.method !== 'tools/call') return send(res, 200, error(id, -32601, 'Method not found'));
    const name = msg.params?.name, args = msg.params?.arguments ?? {};
    if (!TOOLS.some(t => t.name === name)) return send(res, 200, error(id, -32601, 'Unknown or forbidden tool'));
    if (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).length)
      return send(res, 200, error(id, -32602, 'Tool does not accept arguments'));
    if (name === 'svl_bridge_status') return send(res, 200, result(id, output({
      status: 'bridge-running', mode: 'read-only', dangerousActionsExposed: false,
    })));
    if (name === 'svl_agents') return send(res, 200, result(id, output({
      roles: ['Alex', 'Astyria', 'Aria', 'Aurelius'],
      source: 'SVL chat-role configuration', liveWorkersVerified: false,
    })));
    try {
      const url = 'http://127.0.0.1:' + Number(appPort) + '/api/ai/status';
      const response = await fetch(url, { signal: AbortSignal.timeout(3500) });
      if (!response.ok) throw new Error('Local SVL is unavailable');
      const body = await response.json();
      return send(res, 200, result(id, output({
        provider: short(body.provider), model: short(body.model),
        enabled: typeof body.enabled === 'boolean' ? body.enabled : null,
        connection: short(body.connection), sysVersion: short(body.sysVersion),
      })));
    } catch {
      return send(res, 200, result(id, { ...output({
        error: 'SVL application unavailable on configured local port',
      }), isError: true }));
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.SVL_MCP_PORT || 3100);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('Invalid SVL_MCP_PORT');
  const origins = [
    'http://localhost:' + port, 'http://127.0.0.1:' + port,
    ...(process.env.SVL_MCP_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
  ];
  const server = createMcpServer({
    token: process.env.SVL_MCP_TOKEN,
    appPort: Number(process.env.SVL_APP_PORT || 3000),
    allowedOrigins: origins,
  });
  server.listen(port, '127.0.0.1', () => {
    console.log('SVL MCP bridge listening on 127.0.0.1:' + port + '/mcp (read only)');
  });
}
