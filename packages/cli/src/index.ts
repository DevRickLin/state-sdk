import { init } from './commands/init.js';
import { scene } from './commands/scene.js';
import { board } from './commands/board.js';

function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const rest = args.slice(1);

  switch (command) {
    case undefined:
    case 'init':
      init(rest);
      break;
    case 'scene':
      scene(rest);
      break;
    case 'board':
      board(rest);
      break;
    case 'help':
    case '--help':
      printHelp();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

function printHelp() {
  console.log(`
@vibe-stack/state-sdk CLI

Usage:
  state-sdk <command> [options]

Commands:
  init [--app-url <url>]          Initialize project with rules, scenes, and preview config
  scene create <name> [options]   Create a new scene
  scene list [--json]             List all scenes
  scene export <name> --output <file>   Export a scene to a file
  scene import <file> [--name <name>]   Import a scene from a file
  scene delete <name>             Delete a scene
  board [--port <port>] [--open]  Start the preview board
  help                            Show this help message
`);
}

main();
