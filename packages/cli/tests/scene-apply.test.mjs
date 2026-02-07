import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLI_ENTRY = path.resolve(__dirname, '..', 'dist', 'index.js');

function createTempProject({ sceneId = 'default' } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'state-sdk-cli-'));
  mkdirSync(path.join(root, '.vibe-studio', 'scenes'), { recursive: true });

  writeFileSync(
    path.join(root, '.vibe-studio', 'config.json'),
    JSON.stringify(
      {
        version: 1,
        appUrl: 'http://127.0.0.1:5173',
        devCommand: '',
        scenesDir: '.vibe-studio/scenes',
      },
      null,
      2,
    ) + '\n',
  );

  writeFileSync(
    path.join(root, '.vibe-studio', 'scenes', `${sceneId}.scene.json`),
    JSON.stringify(
      {
        version: 1,
        id: sceneId,
        name: sceneId,
        stores: { counter: { count: 1 } },
        injectMode: 'merge',
      },
      null,
      2,
    ) + '\n',
  );

  return root;
}

async function getFreePort() {
  const server = http.createServer((_req, res) => {
    res.statusCode = 204;
    res.end();
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const port = address.port;

  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });

  return port;
}

async function httpJson({ method, port, pathName, body }) {
  const payload = body ? JSON.stringify(body) : '';

  return await new Promise((resolve, reject) => {
    const req = http.request(
      {
        method,
        host: '127.0.0.1',
        port,
        path: pathName,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      async (res) => {
        const chunks = [];
        for await (const chunk of res) chunks.push(chunk);
        const text = Buffer.concat(chunks).toString();
        let data = null;
        if (text) {
          try {
            data = JSON.parse(text);
          } catch {
            data = null;
          }
        }
        resolve({ status: res.statusCode ?? 0, data });
      },
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function waitForLine(stream, pattern, timeoutMs = 8000) {
  const startedAt = Date.now();
  let buffer = '';

  for await (const chunk of stream) {
    buffer += chunk.toString();
    if (pattern.test(buffer)) return buffer;
    if (Date.now() - startedAt > timeoutMs) break;
  }

  throw new Error(`Timed out waiting for output matching ${pattern}`);
}

async function waitForApplyMessage(ws, timeoutMs = 5000) {
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.removeEventListener('message', onMessage);
      reject(new Error('Timed out waiting for scene:apply message'));
    }, timeoutMs);

    function onMessage(event) {
      try {
        const msg = JSON.parse(event.data.toString());
        if (msg.type === 'scene:apply') {
          clearTimeout(timer);
          ws.removeEventListener('message', onMessage);
          resolve(msg);
        }
      } catch {
        // ignore parse errors
      }
    }

    ws.addEventListener('message', onMessage);
  });
}

async function stopChildProcess(child) {
  if (child.exitCode !== null || child.killed) return;

  child.kill('SIGTERM');

  const graceful = await Promise.race([
    once(child, 'exit').then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 2000)),
  ]);

  if (!graceful) {
    child.kill('SIGKILL');
    await Promise.race([
      once(child, 'exit'),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
  }
}

async function runCli(args, cwd) {
  const child = spawn(process.execPath, [CLI_ENTRY, ...args], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  child.stdout?.on('data', (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr?.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const [exitCode] = await once(child, 'exit');
  return { exitCode: exitCode ?? -1, stdout, stderr };
}

test('scene apply posts an apply request to board server', { timeout: 10000 }, async () => {
  const cwd = createTempProject({ sceneId: 'checkout' });
  const requests = [];

  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);

    requests.push({
      method: req.method,
      url: req.url,
      body: Buffer.concat(chunks).toString(),
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  assert.ok(address && typeof address === 'object');

  try {
    const child = spawn(process.execPath, [CLI_ENTRY, 'scene', 'apply', 'checkout', '--port', String(address.port), '--mode', 'replace'], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const [exitCode] = await once(child, 'exit');

    assert.equal(exitCode, 0);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].method, 'POST');
    assert.equal(requests[0].url, '/api/scenes/checkout/apply');

    const parsed = JSON.parse(requests[0].body || '{}');
    assert.equal(parsed.mode, 'replace');
    assert.equal(parsed.openIfMissing, false);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('scene apply fails when the scene does not exist', { timeout: 10000 }, async () => {
  const cwd = createTempProject({ sceneId: 'default' });

  try {
    const result = await runCli(['scene', 'apply', 'missing-scene'], cwd);
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /scene "missing-scene" not found/i);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('scene apply rejects invalid mode values', { timeout: 10000 }, async () => {
  const cwd = createTempProject({ sceneId: 'checkout' });

  try {
    const result = await runCli(
      ['scene', 'apply', 'checkout', '--mode', 'invalid'],
      cwd,
    );
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /--mode must be "merge" or "replace"/i);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('scene apply surfaces board 404 responses', { timeout: 10000 }, async () => {
  const cwd = createTempProject({ sceneId: 'checkout' });

  const server = http.createServer((_req, res) => {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Scene not found' }));
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');

  try {
    const result = await runCli(
      ['scene', 'apply', 'checkout', '--port', String(address.port)],
      cwd,
    );
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /apply failed with HTTP 404/i);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('board API apply endpoint broadcasts scene:apply over WebSocket', { timeout: 20000 }, async () => {
  const cwd = createTempProject({ sceneId: 'checkout' });
  const boardDist = path.join(cwd, '__board_dist__');
  mkdirSync(boardDist, { recursive: true });
  writeFileSync(path.join(boardDist, 'index.html'), '<!doctype html><html><body>board</body></html>\n');

  const port = await getFreePort();
  const child = spawn(process.execPath, [CLI_ENTRY, 'board', '--port', String(port), '--board-path', boardDist], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let ws;

  try {
    await waitForLine(child.stdout, /Vibe Studio Board running at/);

    ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await once(ws, 'open');

    const applyMessagePromise = waitForApplyMessage(ws).catch((err) => err);

    const response = await httpJson({
      method: 'POST',
      port,
      pathName: '/api/scenes/checkout/apply',
      body: { mode: 'replace', openIfMissing: true },
    });

    assert.equal(response.status, 200);
    assert.equal(response.data?.ok, true);

    const message = await applyMessagePromise;
    assert.ok(!(message instanceof Error), message instanceof Error ? message.message : 'unknown apply message error');
    assert.equal(message.sceneId, 'checkout');
    assert.equal(message.mode, 'replace');
    assert.equal(message.openIfMissing, true);
  } finally {
    if (ws && ws.readyState <= WebSocket.OPEN) {
      ws.close();
      await Promise.race([
        once(ws, 'close'),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);
    }

    await stopChildProcess(child);
    rmSync(cwd, { recursive: true, force: true });
  }
});
