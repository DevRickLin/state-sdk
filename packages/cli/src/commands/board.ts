import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { readConfig } from '../lib/scene-fs.js';

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

  startServer(distDir, port, open, cwd, config);
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
): void {
  const scenesDir = path.resolve(cwd, config.scenesDir);

  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url ?? '/', `http://localhost:${port}`).pathname;

    // API: list scenes
    if (pathname === '/api/scenes' && req.method === 'GET') {
      const scenes = listScenesFromDir(scenesDir);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(scenes));
      return;
    }

    // API: get config
    if (pathname === '/api/config' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(config));
      return;
    }

    // Static file serving
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

  server.listen(port, () => {
    console.log(`Vibe Studio Board running at http://localhost:${port}`);
    console.log(`App URL: ${config.appUrl}`);
    console.log(`Scenes: ${scenesDir}`);
    console.log('');

    if (open) {
      const openCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
      exec(`${openCmd} http://localhost:${port}`);
    }
  });
}

function listScenesFromDir(scenesDir: string): unknown[] {
  if (!fs.existsSync(scenesDir)) return [];
  return fs.readdirSync(scenesDir)
    .filter((f) => f.endsWith('.scene.json'))
    .map((f) => {
      const content = fs.readFileSync(path.join(scenesDir, f), 'utf-8');
      return JSON.parse(content);
    });
}
