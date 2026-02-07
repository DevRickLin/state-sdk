import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { WebSocketServer, type WebSocket } from 'ws';
import { readConfig, readScene, writeScene, listScenes, deleteScene } from '../lib/scene-fs.js';
import { createDevServerManager, type DevServerManager } from '../lib/dev-server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// Arg parsing
// ============================================================

function parseArgs(args: string[]): { port: number; open: boolean; boardPath?: string } {
  let port = 4800;
  let open = false;
  let boardPath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && i + 1 < args.length) {
      port = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--open') {
      open = true;
    } else if (args[i] === '--board-path' && i + 1 < args.length) {
      boardPath = args[i + 1];
      i++;
    }
  }

  return { port, open, boardPath };
}

// ============================================================
// Helpers
// ============================================================

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

function jsonResponse(res: http.ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

function probeUrl(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(url, (resp) => {
      resp.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// ============================================================
// board command
// ============================================================

export function board(args: string[]): void {
  const { port, open, boardPath } = parseArgs(args);
  const cwd = process.cwd();

  // Verify project is initialized
  const config = readConfig(cwd);
  if (!config) {
    console.error('Error: .vibe-studio/config.json not found.');
    console.error('Run "state-sdk init" first to initialize your project.');
    process.exit(1);
  }

  // Resolve board dist directory
  let distDir = boardPath;

  if (!distDir) {
    const candidates = [
      path.join(__dirname, '..', '..', 'board', 'dist'),
      path.resolve(cwd, 'node_modules', '@vibe-stack', 'board', 'dist'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(path.join(candidate, 'index.html'))) {
        distDir = candidate;
        break;
      }
    }
  }

  if (!distDir || !fs.existsSync(path.join(distDir, 'index.html'))) {
    console.log('Board UI not found locally. Starting in development proxy mode...');
    console.log('');
    console.log('To use the board, either:');
    console.log('  1. Clone vibe-studio and run: cd packages/board && pnpm dev');
    console.log(`  2. Pass --board-path <path-to-board-dist>`);
    console.log('');
    console.log(`Board will be available at: http://localhost:${port}`);
    console.log(`Your app URL (from config): ${config.appUrl}`);
    console.log(`Scenes directory: ${path.resolve(cwd, config.scenesDir)}`);
    return;
  }

  // Create dev server manager
  const devServer = createDevServerManager({
    devCommand: config.devCommand,
    appUrl: config.appUrl,
    cwd,
  });

  // Auto-start dev server if devCommand is configured
  if (config.devCommand) {
    probeUrl(config.appUrl).then((reachable) => {
      if (!reachable) {
        console.log(`[board] App not reachable at ${config.appUrl}, starting dev server...`);
        devServer.start().catch((err) => {
          console.error('[board] Failed to start dev server:', err);
        });
      } else {
        console.log(`[board] App already running at ${config.appUrl}`);
      }
    });
  }

  // Cleanup on exit
  const cleanup = () => {
    devServer.stop().finally(() => process.exit());
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  startServer(distDir, port, open, cwd, config, devServer);
}

// ============================================================
// HTTP server
// ============================================================

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.map': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function startServer(
  distDir: string,
  port: number,
  open: boolean,
  cwd: string,
  config: { appUrl: string; scenesDir: string },
  devServer: DevServerManager,
): void {
  const server = http.createServer();

  // ---- WebSocket server (shares HTTP port) ----
  const wss = new WebSocketServer({ server });

  function broadcastScenes(): void {
    const scenes = listScenes(cwd);
    const payload = JSON.stringify({ type: 'scenes:changed', scenes });
    for (const client of wss.clients) {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(payload);
      }
    }
  }

  server.on('request', async (req: http.IncomingMessage, res: http.ServerResponse) => {
    const pathname = new URL(req.url ?? '/', `http://localhost:${port}`).pathname;

    // ---- CORS preflight ----
    if (req.method === 'OPTIONS' && pathname.startsWith('/api/')) {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, PUT, PATCH, DELETE, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
      return;
    }

    // ---- API: list scenes ----
    if (pathname === '/api/scenes' && req.method === 'GET') {
      const scenes = listScenes(cwd);
      jsonResponse(res, 200, scenes);
      return;
    }

    // ---- API: get config ----
    if (pathname === '/api/config' && req.method === 'GET') {
      jsonResponse(res, 200, config);
      return;
    }

    // ---- API: single scene operations ----
    const scenesMatch = pathname.match(/^\/api\/scenes\/([^/]+)$/);
    if (scenesMatch) {
      const sceneId = decodeURIComponent(scenesMatch[1]);

      if (req.method === 'GET') {
        const scene = readScene(cwd, sceneId);
        if (!scene) {
          jsonResponse(res, 404, { error: 'Scene not found' });
          return;
        }
        jsonResponse(res, 200, scene);
        return;
      }

      if (req.method === 'PUT') {
        try {
          const body = await readBody(req);
          const scene = JSON.parse(body);
          writeScene(cwd, scene);
          broadcastScenes();
          jsonResponse(res, 200, scene);
        } catch (err) {
          jsonResponse(res, 400, { error: 'Invalid JSON body' });
        }
        return;
      }

      if (req.method === 'DELETE') {
        const deleted = deleteScene(cwd, sceneId);
        if (!deleted) {
          jsonResponse(res, 404, { error: 'Scene not found' });
          return;
        }
        broadcastScenes();
        jsonResponse(res, 200, { ok: true });
        return;
      }

      if (req.method === 'PATCH') {
        try {
          const existing = readScene(cwd, sceneId);
          if (!existing) {
            jsonResponse(res, 404, { error: 'Scene not found' });
            return;
          }
          const body = await readBody(req);
          const updates = JSON.parse(body);

          if (updates.name !== undefined) existing.name = updates.name;
          if (updates.description !== undefined) existing.description = updates.description;
          if (updates.tags !== undefined) existing.tags = updates.tags;
          if (existing.meta) {
            existing.meta.updatedAt = new Date().toISOString();
          }

          writeScene(cwd, existing);
          broadcastScenes();
          jsonResponse(res, 200, existing);
        } catch (err) {
          jsonResponse(res, 400, { error: 'Invalid JSON body' });
        }
        return;
      }
    }

    // ---- API: dev-server status ----
    if (pathname === '/api/dev-server/status' && req.method === 'GET') {
      jsonResponse(res, 200, {
        running: devServer.status === 'running',
        status: devServer.status,
        pid: devServer.pid,
        url: devServer.url,
      });
      return;
    }

    // ---- API: dev-server start ----
    if (pathname === '/api/dev-server/start' && req.method === 'POST') {
      try {
        await devServer.start();
        jsonResponse(res, 200, { ok: true, status: devServer.status });
      } catch (err) {
        jsonResponse(res, 500, { error: 'Failed to start dev server' });
      }
      return;
    }

    // ---- API: dev-server stop ----
    if (pathname === '/api/dev-server/stop' && req.method === 'POST') {
      try {
        await devServer.stop();
        jsonResponse(res, 200, { ok: true, status: devServer.status });
      } catch (err) {
        jsonResponse(res, 500, { error: 'Failed to stop dev server' });
      }
      return;
    }

    // ---- Static file serving ----
    let filePath = path.join(distDir, pathname === '/' ? 'index.html' : pathname);

    // SPA fallback
    if (!fs.existsSync(filePath)) {
      filePath = path.join(distDir, 'index.html');
    }

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    try {
      const content = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  wss.on('connection', (ws: WebSocket) => {
    // Send initial scene list
    const scenes = listScenes(cwd);
    ws.send(JSON.stringify({ type: 'scenes:init', scenes }));

    // Send dev server status
    ws.send(JSON.stringify({
      type: 'dev-server:status',
      status: devServer.status,
      url: devServer.url,
    }));

    // Handle client messages
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'scene:save' && msg.scene) {
          writeScene(cwd, msg.scene);
          broadcastScenes();
        } else if (msg.type === 'scene:delete' && msg.id) {
          deleteScene(cwd, msg.id);
          broadcastScenes();
        }
      } catch {}
    });
  });

  // Broadcast dev server status changes
  devServer.onStatusChange((status) => {
    const payload = JSON.stringify({
      type: 'dev-server:status',
      status,
      url: devServer.url,
    });
    for (const client of wss.clients) {
      if (client.readyState === 1) {
        client.send(payload);
      }
    }
  });

  // Watch scenes directory for external changes
  const scenesDir = path.resolve(cwd, config.scenesDir);
  if (fs.existsSync(scenesDir)) {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    fs.watch(scenesDir, { persistent: false }, () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        broadcastScenes();
      }, 100);
    });
  }

  server.listen(port, () => {
    console.log(`Vibe Studio Board running at http://localhost:${port}`);
    console.log(`App URL: ${config.appUrl}`);
    console.log(`Scenes: ${path.resolve(cwd, config.scenesDir)}`);
    console.log('');

    if (open) {
      const openCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
      exec(`${openCmd} http://localhost:${port}`);
    }
  });
}
