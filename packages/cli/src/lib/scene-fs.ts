import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// Types
// ============================================================

export interface ProjectConfig {
  version: 1;
  appUrl: string;
  devCommand: string;
  scenesDir: string;
}

export interface SceneFile {
  version: 1;
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  route?: string;
  viewport?: {
    width: number;
    height: number;
    label?: string;
  };
  stores: Record<string, Record<string, unknown>>;
  injectMode?: 'merge' | 'replace';
  meta?: {
    createdAt: string;
    updatedAt: string;
    createdBy?: 'human' | 'ai';
    prompt?: string;
  };
}

// ============================================================
// Paths
// ============================================================

const VIBE_DIR = '.vibe-studio';
const CONFIG_FILE = 'config.json';
const SCENES_DIR = 'scenes';

export function getVibeDir(cwd: string): string {
  return path.join(cwd, VIBE_DIR);
}

export function getConfigPath(cwd: string): string {
  return path.join(cwd, VIBE_DIR, CONFIG_FILE);
}

export function getScenesDir(cwd: string): string {
  return path.join(cwd, VIBE_DIR, SCENES_DIR);
}

export function getScenePath(cwd: string, name: string): string {
  return path.join(getScenesDir(cwd), `${name}.scene.json`);
}

// ============================================================
// Config
// ============================================================

export function readConfig(cwd: string): ProjectConfig | null {
  const p = getConfigPath(cwd);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

export function writeConfig(cwd: string, config: ProjectConfig): void {
  const dir = getVibeDir(cwd);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getConfigPath(cwd), JSON.stringify(config, null, 2) + '\n');
}

export function createDefaultConfig(): ProjectConfig {
  return {
    version: 1,
    appUrl: 'http://localhost:5173',
    devCommand: 'npm run dev',
    scenesDir: '.vibe-studio/scenes',
  };
}

// ============================================================
// Scenes
// ============================================================

export function ensureScenesDir(cwd: string): void {
  fs.mkdirSync(getScenesDir(cwd), { recursive: true });
}

export function readScene(cwd: string, name: string): SceneFile | null {
  const p = getScenePath(cwd, name);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

export function writeScene(cwd: string, scene: SceneFile): void {
  ensureScenesDir(cwd);
  const p = getScenePath(cwd, scene.id);
  fs.writeFileSync(p, JSON.stringify(scene, null, 2) + '\n');
}

export function listScenes(cwd: string): SceneFile[] {
  const dir = getScenesDir(cwd);
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.scene.json'))
    .map((f) => {
      const content = fs.readFileSync(path.join(dir, f), 'utf-8');
      return JSON.parse(content) as SceneFile;
    })
    .sort((a, b) => {
      const aTime = a.meta?.updatedAt ?? a.meta?.createdAt ?? '';
      const bTime = b.meta?.updatedAt ?? b.meta?.createdAt ?? '';
      return aTime.localeCompare(bTime);
    });
}

export function deleteScene(cwd: string, name: string): boolean {
  const p = getScenePath(cwd, name);
  if (!fs.existsSync(p)) return false;
  fs.unlinkSync(p);
  return true;
}

export function sceneExists(cwd: string, name: string): boolean {
  return fs.existsSync(getScenePath(cwd, name));
}

export function createScene(
  id: string,
  name: string,
  stores: Record<string, Record<string, unknown>> = {},
  options?: {
    description?: string;
    tags?: string[];
    viewport?: SceneFile['viewport'];
    injectMode?: 'merge' | 'replace';
    createdBy?: 'human' | 'ai';
    prompt?: string;
  },
): SceneFile {
  const now = new Date().toISOString();
  return {
    version: 1,
    id,
    name,
    description: options?.description,
    tags: options?.tags,
    viewport: options?.viewport,
    stores,
    injectMode: options?.injectMode ?? 'merge',
    meta: {
      createdAt: now,
      updatedAt: now,
      createdBy: options?.createdBy ?? 'human',
      prompt: options?.prompt,
    },
  };
}

/**
 * Read a scene from an arbitrary file path (for import).
 * Validates basic structure.
 */
export function readSceneFromFile(filePath: string): SceneFile {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);

  if (data.version !== 1 || typeof data.id !== 'string' || typeof data.stores !== 'object') {
    throw new Error('Invalid scene file: must have version=1, id (string), and stores (object)');
  }

  return data as SceneFile;
}

/**
 * Write a scene to an arbitrary file path (for export).
 */
export function writeSceneToFile(scene: SceneFile, filePath: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(scene, null, 2) + '\n');
}

/**
 * Convert a string to kebab-case scene ID.
 */
export function toSceneId(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
