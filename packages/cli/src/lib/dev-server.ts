import { spawn, type ChildProcess } from 'child_process';
import * as http from 'http';

// ============================================================
// Types
// ============================================================

export type DevServerStatus = 'stopped' | 'starting' | 'running' | 'error';

export interface DevServerManager {
  readonly status: DevServerStatus;
  readonly pid: number | null;
  readonly url: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  onStatusChange(cb: (status: DevServerStatus) => void): () => void;
}

// ============================================================
// Implementation
// ============================================================

export function createDevServerManager(config: {
  devCommand: string;
  appUrl: string;
  cwd: string;
}): DevServerManager {
  let status: DevServerStatus = 'stopped';
  let proc: ChildProcess | null = null;
  const listeners = new Set<(status: DevServerStatus) => void>();

  function setStatus(next: DevServerStatus): void {
    if (status === next) return;
    status = next;
    for (const cb of listeners) cb(next);
  }

  function probeUrl(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(true);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(2000, () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  async function start(): Promise<void> {
    if (status === 'running' || status === 'starting') return;

    setStatus('starting');

    // Check if already reachable
    const alreadyUp = await probeUrl(config.appUrl);
    if (alreadyUp) {
      setStatus('running');
      return;
    }

    // Parse command
    const parts = config.devCommand.split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    proc = spawn(cmd, args, {
      shell: true,
      cwd: config.cwd,
      stdio: 'pipe',
    });

    proc.stdout?.on('data', (data: Buffer) => {
      for (const line of data.toString().split('\n')) {
        if (line.trim()) console.log(`[dev] ${line}`);
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      for (const line of data.toString().split('\n')) {
        if (line.trim()) console.error(`[dev] ${line}`);
      }
    });

    proc.on('exit', (code) => {
      proc = null;
      if (status !== 'stopped') {
        setStatus(code === 0 ? 'stopped' : 'error');
      }
    });

    // Poll until ready (30s max, 500ms interval)
    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (!proc) {
        setStatus('error');
        return;
      }
      const reachable = await probeUrl(config.appUrl);
      if (reachable) {
        setStatus('running');
        return;
      }
    }

    // Timed out
    setStatus('error');
  }

  async function stop(): Promise<void> {
    if (!proc) {
      setStatus('stopped');
      return;
    }

    const child = proc;
    proc = null;

    child.kill('SIGTERM');

    // Wait up to 3s for graceful exit
    const exited = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), 3000);
      child.on('exit', () => {
        clearTimeout(timer);
        resolve(true);
      });
    });

    if (!exited) {
      child.kill('SIGKILL');
    }

    setStatus('stopped');
  }

  return {
    get status() {
      return status;
    },
    get pid() {
      return proc?.pid ?? null;
    },
    get url() {
      return config.appUrl;
    },
    start,
    stop,
    onStatusChange(cb: (status: DevServerStatus) => void) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}
