import * as fs from 'fs';
import * as path from 'path';

const CLAUDE_RULES_CONTENT = `# State Management Rules for @anthropic/state-sdk

## Package
This project uses \`@anthropic/state-sdk\` for state management.
It is a Zustand-based SDK with built-in Time Travel, State Branching, and DevTools.

## Store Creation Pattern
Always use \`create\` from \`@anthropic/state-sdk\` (NOT from \`zustand\` directly):

\`\`\`typescript
import { create } from '@anthropic/state-sdk';

const useXxxStore = create((set, get) => ({
  // state
  items: [],
  loading: false,

  // actions — use Immer mutation syntax inside set() callbacks
  addItem: (item) => set((state) => { state.items.push(item); }),
  removeItem: (id) => set((state) => {
    state.items = state.items.filter(i => i.id !== id);
  }),
  setLoading: (v) => set({ loading: v }),
}), {
  name: 'xxx',  // Always provide a name for DevPanel display
});

export { useXxxStore };
\`\`\`

## Rules
1. NEVER import from 'zustand' directly — always use '@anthropic/state-sdk'
2. Use Immer mutation syntax inside set() callbacks (e.g., \`state.items.push(item)\`)
3. Keep stores in \`src/stores/\` directory
4. One store per domain concern (e.g., useAuthStore, useCartStore, useTodoStore)
5. Always provide a \`name\` option when creating stores
6. Export stores with \`useXxxStore\` naming convention
7. Always include \`<DevPanel />\` in the root App component:

\`\`\`tsx
import { DevPanel } from '@anthropic/state-sdk-react';

function App() {
  return (
    <>
      <YourAppContent />
      <DevPanel />
    </>
  );
}
\`\`\`

## Available Features (no extra setup needed)
- **Time Travel**: \`useStore.temporal.undo()\`, \`useStore.temporal.redo()\`, \`useStore.temporal.goto(n)\`
- **State Branching**: \`useStore.branch.fork('name')\`, \`useStore.branch.switch('id')\`, \`useStore.branch.diff('a', 'b')\`
- **Snapshots**: \`import { snapshot } from '@anthropic/state-sdk'\` then \`snapshot.exportAll()\`, \`snapshot.importAll(data)\`
- **Mock Injection**: \`import { mock } from '@anthropic/state-sdk'\` then \`mock.inject(useStore, { key: value })\`

## DevPanel
The DevPanel is a floating panel that appears in development mode. It provides:
- State tree viewer with inline editing
- Timeline slider for time travel
- Branch manager (fork, switch, diff)
- Mock data injection panel
`;

const ADD_STORE_COMMAND = `---
description: Create a new state store
---

Create a new Zustand store using @anthropic/state-sdk in src/stores/.

Store domain: $ARGUMENTS

Follow the patterns in .claude/rules/state-management.md:
- Import \`create\` from '@anthropic/state-sdk' (not from zustand)
- Use Immer mutation syntax inside set() callbacks
- Provide a \`name\` option matching the domain
- Export with useXxxStore naming convention
- Add TypeScript types for the store state
`;

const EXAMPLE_STORE = `import { create } from '@anthropic/state-sdk';

interface CounterState {
  count: number;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
}

export const useCounterStore = create<CounterState>((set) => ({
  count: 0,
  increment: () => set((state) => { state.count += 1; }),
  decrement: () => set((state) => { state.count -= 1; }),
  reset: () => set({ count: 0 }),
}), {
  name: 'counter',
});
`;

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'init') {
    init();
  } else if (command === 'help' || command === '--help') {
    printHelp();
  } else {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
  }
}

function init() {
  const cwd = process.cwd();
  console.log('Initializing @anthropic/state-sdk...\n');

  // 1. Create .claude/rules/ directory
  const rulesDir = path.join(cwd, '.claude', 'rules');
  fs.mkdirSync(rulesDir, { recursive: true });

  // 2. Write state management rules
  const rulesFile = path.join(rulesDir, 'state-management.md');
  fs.writeFileSync(rulesFile, CLAUDE_RULES_CONTENT);
  console.log('  Created .claude/rules/state-management.md');

  // 3. Create .claude/commands/ directory
  const commandsDir = path.join(cwd, '.claude', 'commands');
  fs.mkdirSync(commandsDir, { recursive: true });

  // 4. Write slash command
  const commandFile = path.join(commandsDir, 'add-store.md');
  fs.writeFileSync(commandFile, ADD_STORE_COMMAND);
  console.log('  Created .claude/commands/add-store.md');

  // 5. Create src/stores/ directory with example
  const storesDir = path.join(cwd, 'src', 'stores');
  fs.mkdirSync(storesDir, { recursive: true });

  const exampleFile = path.join(storesDir, 'counter.ts');
  if (!fs.existsSync(exampleFile)) {
    fs.writeFileSync(exampleFile, EXAMPLE_STORE);
    console.log('  Created src/stores/counter.ts (example store)');
  }

  console.log('\nDone! Next steps:');
  console.log('  1. Install dependencies:');
  console.log('     npm install @anthropic/state-sdk @anthropic/state-sdk-react');
  console.log('  2. Add <DevPanel /> to your root App component');
  console.log('  3. Use Claude Code to vibe — it will follow the rules automatically');
  console.log('');
}

function printHelp() {
  console.log(`
@anthropic/state-sdk CLI

Usage:
  npx @anthropic/state-sdk-cli init    Initialize project with Claude Code rules and example store
  npx @anthropic/state-sdk-cli help    Show this help message

Commands:
  init    Sets up .claude/rules/, .claude/commands/, and src/stores/ in your project
  help    Display help information
`);
}

main();
