import * as fs from 'fs';
import {
  listScenes,
  readScene,
  writeScene,
  createScene,
  sceneExists,
  toSceneId,
  readSceneFromFile,
  writeSceneToFile,
  deleteScene,
  getScenePath,
} from '../lib/scene-fs.js';
import type { SceneFile } from '../lib/scene-fs.js';

// ============================================================
// Arg parsing helpers
// ============================================================

const BOOLEAN_FLAGS = new Set(['--open-if-missing']);

function parseFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function positionalArgs(args: string[]): string[] {
  const result: string[] = [];
  let i = 0;
  while (i < args.length) {
    if (args[i].startsWith('--')) {
      i += BOOLEAN_FLAGS.has(args[i]) ? 1 : 2;
    } else {
      result.push(args[i]);
      i++;
    }
  }
  return result;
}

function parsePort(raw: string | undefined, fallback = 4800): number {
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

// ============================================================
// Subcommands
// ============================================================

function sceneCreate(args: string[]): void {
  const positional = positionalArgs(args);
  const rawName = positional[0];
  if (!rawName) {
    console.error('Error: scene name is required.\nUsage: state-sdk scene create <name> [options]');
    process.exit(1);
  }

  const id = toSceneId(rawName);
  const description = parseFlag(args, '--description');
  const fromSnapshot = parseFlag(args, '--from-snapshot');
  const storesJson = parseFlag(args, '--stores');
  const tagsRaw = parseFlag(args, '--tags');

  if (fromSnapshot && storesJson) {
    console.error('Error: cannot use both --from-snapshot and --stores.');
    process.exit(1);
  }

  const cwd = process.cwd();

  if (sceneExists(cwd, id)) {
    console.error(`Error: scene "${id}" already exists.`);
    process.exit(1);
  }

  let stores: Record<string, Record<string, unknown>> = {};

  if (fromSnapshot) {
    if (!fs.existsSync(fromSnapshot)) {
      console.error(`Error: snapshot file not found: ${fromSnapshot}`);
      process.exit(1);
    }
    const snapshot = JSON.parse(fs.readFileSync(fromSnapshot, 'utf-8'));
    if (!snapshot.stores || typeof snapshot.stores !== 'object') {
      console.error('Error: snapshot file must contain a "stores" object.');
      process.exit(1);
    }
    stores = snapshot.stores;
  } else if (storesJson) {
    try {
      stores = JSON.parse(storesJson);
    } catch {
      console.error('Error: --stores must be valid JSON.');
      process.exit(1);
    }
  }

  const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : undefined;

  const scene = createScene(id, rawName, stores, {
    description,
    tags,
    createdBy: 'human',
  });

  writeScene(cwd, scene);
  const filePath = getScenePath(cwd, id);
  console.log(`Created scene "${id}" at ${filePath}`);
}

function sceneList(args: string[]): void {
  const cwd = process.cwd();
  const scenes = listScenes(cwd);
  const json = hasFlag(args, '--json');

  if (scenes.length === 0) {
    if (json) {
      console.log('[]');
    } else {
      console.log('No scenes found.');
    }
    return;
  }

  if (json) {
    console.log(JSON.stringify(scenes, null, 2));
    return;
  }

  // Table format
  const nameCol = 'NAME';
  const storesCol = 'STORES';
  const updatedCol = 'UPDATED';

  const rows = scenes.map((s) => {
    const storeNames = Object.keys(s.stores);
    const storesStr = storeNames.length > 0 ? storeNames.join(', ') : '-';
    const updated = (s.meta?.updatedAt ?? s.meta?.createdAt ?? '').slice(0, 10) || '-';
    return { name: s.id, stores: storesStr, updated };
  });

  const nameWidth = Math.max(nameCol.length, ...rows.map((r) => r.name.length));
  const storesWidth = Math.max(storesCol.length, ...rows.map((r) => r.stores.length));

  console.log(
    `${nameCol.padEnd(nameWidth + 2)}${storesCol.padEnd(storesWidth + 2)}${updatedCol}`,
  );
  for (const row of rows) {
    console.log(
      `${row.name.padEnd(nameWidth + 2)}${row.stores.padEnd(storesWidth + 2)}${row.updated}`,
    );
  }
}

function sceneExport(args: string[]): void {
  const positional = positionalArgs(args);
  const rawName = positional[0];
  if (!rawName) {
    console.error('Error: scene name is required.\nUsage: state-sdk scene export <name> --output <file>');
    process.exit(1);
    return;
  }

  const output = parseFlag(args, '--output');
  if (!output) {
    console.error('Error: --output <file> is required.');
    process.exit(1);
    return;
  }

  const cwd = process.cwd();
  const id = toSceneId(rawName);
  const scene = readScene(cwd, id);
  if (!scene) {
    console.error(`Error: scene "${id}" not found.`);
    process.exit(1);
    return;
  }

  writeSceneToFile(scene, output);
  console.log(`Exported scene "${id}" to ${output}`);
}

function sceneImport(args: string[]): void {
  const positional = positionalArgs(args);
  const filePath = positional[0];
  if (!filePath) {
    console.error('Error: file path is required.\nUsage: state-sdk scene import <file> [--name <name>]');
    process.exit(1);
  }

  const nameOverride = parseFlag(args, '--name');

  let scene: SceneFile;
  try {
    scene = readSceneFromFile(filePath);
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
    return;
  }

  if (nameOverride) {
    scene.id = toSceneId(nameOverride);
    scene.name = nameOverride;
  }

  const cwd = process.cwd();

  if (sceneExists(cwd, scene.id)) {
    console.error(
      `Error: scene "${scene.id}" already exists. Use --name to import with a different name.`,
    );
    process.exit(1);
  }

  writeScene(cwd, scene);
  console.log(`Imported scene "${scene.id}" from ${filePath}`);
}

function sceneDelete(args: string[]): void {
  const positional = positionalArgs(args);
  const rawName = positional[0];
  if (!rawName) {
    console.error('Error: scene name is required.\nUsage: state-sdk scene delete <name>');
    process.exit(1);
  }

  const cwd = process.cwd();
  const id = toSceneId(rawName);

  if (!sceneExists(cwd, id)) {
    console.error(`Error: scene "${id}" not found.`);
    process.exit(1);
  }

  deleteScene(cwd, id);
  console.log(`Deleted scene "${id}".`);
}

async function sceneApply(args: string[]): Promise<void> {
  const positional = positionalArgs(args);
  const rawName = positional[0];
  if (!rawName) {
    console.error('Error: scene name is required.\nUsage: state-sdk scene apply <name> [options]');
    process.exit(1);
    return;
  }

  const cwd = process.cwd();
  const id = toSceneId(rawName);
  const scene = readScene(cwd, id);
  if (!scene) {
    console.error(`Error: scene "${id}" not found.`);
    process.exit(1);
    return;
  }

  const modeRaw = parseFlag(args, '--mode');
  const mode = modeRaw === 'replace' ? 'replace' : 'merge';
  if (modeRaw && modeRaw !== 'merge' && modeRaw !== 'replace') {
    console.error('Error: --mode must be "merge" or "replace".');
    process.exit(1);
    return;
  }

  const port = parsePort(parseFlag(args, '--port'), 4800);
  const openIfMissing = hasFlag(args, '--open-if-missing');

  const endpoint = `http://127.0.0.1:${port}/api/scenes/${encodeURIComponent(id)}/apply`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, openIfMissing }),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: failed to connect to board server at port ${port}: ${msg}`);
    process.exit(1);
    return;
  }

  if (!response.ok) {
    let detail = '';
    try {
      detail = await response.text();
    } catch {
      detail = '';
    }

    const suffix = detail ? ` ${detail}` : '';
    console.error(`Error: apply failed with HTTP ${response.status}.${suffix}`.trim());
    process.exit(1);
    return;
  }

  let data: { broadcastClients?: number } | null = null;
  try {
    data = (await response.json()) as { broadcastClients?: number };
  } catch {
    data = null;
  }

  const count = data?.broadcastClients;
  if (typeof count === 'number') {
    console.log(`Applied scene "${id}" (mode=${mode}, broadcast=${count}).`);
  } else {
    console.log(`Applied scene "${id}" (mode=${mode}).`);
  }
}

function printSceneHelp(): void {
  console.log(`
Usage: state-sdk scene <subcommand> [options]

Subcommands:
  create <name>    Create a new scene
                   [--description <desc>] [--from-snapshot <file>]
                   [--stores <json>] [--tags <tag1,tag2>]
  list             List all scenes [--json]
  export <name>    Export a scene to a file [--output <file>]
  import <file>    Import a scene from a file [--name <name>]
  delete <name>    Delete a scene
  apply <name>     Apply a scene to running board cards
                   [--port <port>] [--mode merge|replace] [--open-if-missing]
`);
}

// ============================================================
// Entry point
// ============================================================

export async function scene(args: string[]): Promise<void> {
  const subcommand = args[0];
  const rest = args.slice(1);

  switch (subcommand) {
    case 'create':
      sceneCreate(rest);
      break;
    case 'list':
    case 'ls':
      sceneList(rest);
      break;
    case 'export':
      sceneExport(rest);
      break;
    case 'import':
      sceneImport(rest);
      break;
    case 'delete':
    case 'rm':
      sceneDelete(rest);
      break;
    case 'apply':
      await sceneApply(rest);
      break;
    default:
      if (subcommand && subcommand !== 'help' && subcommand !== '--help') {
        console.error(`Unknown subcommand: ${subcommand}`);
      }
      printSceneHelp();
      if (subcommand && subcommand !== 'help' && subcommand !== '--help') {
        process.exit(1);
      }
      break;
  }
}
