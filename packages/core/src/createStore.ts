import { create as zustandCreate, type StateCreator } from 'zustand';
import { devtools } from 'zustand/middleware';
import { timeline } from './middleware/timeline.js';
import { branching } from './middleware/branching.js';
import { inspector } from './middleware/inspector.js';
import { registry } from './registry.js';
import { generateId } from './utils.js';
import type {
  StoreConfig,
  EnhancedStoreApi,
  TimelineConfig,
  BranchingConfig,
} from './types.js';

/**
 * Create an enhanced Zustand store with Time Travel, Branching, and Inspector.
 *
 * Uses `travels` (Mutative-based) internally for undo/redo/goto — no need
 * for a separate Immer middleware layer.
 *
 * set() supports both partial updates and mutation-style updaters:
 *   set({ count: 1 })                  // partial merge
 *   set((state) => { state.count++ })  // mutative draft (handled by travels)
 *
 * @example
 * ```ts
 * const useCounterStore = create((set) => ({
 *   count: 0,
 *   increment: () => set((state) => { state.count += 1; }),
 * }), {
 *   name: 'counter',
 * });
 * ```
 */
export function create<T>(
  initializer: StateCreator<T, [], []>,
  config?: StoreConfig
) {
  const storeId = generateId();
  const storeName = config?.name || `store-${storeId.slice(0, 6)}`;

  // Resolve config
  const timelineConfig: TimelineConfig =
    config?.timeline === false
      ? { enabled: false }
      : config?.timeline === true || config?.timeline === undefined
        ? { enabled: true }
        : config.timeline;

  const branchingConfig: BranchingConfig =
    config?.branching === false
      ? { enabled: false }
      : config?.branching === true || config?.branching === undefined
        ? { enabled: true }
        : config.branching;

  const enableDevtools = config?.devtools !== false;

  // Build middleware chain (inside-out):
  // timeline → branching → inspector → devtools
  //
  // timeline wraps set() to route through Travels (mutative drafts)
  // branching reads __travels to save/restore per-branch history
  // inspector logs every set() call with RFC 6902 patches
  let composed: any = timeline(initializer as any, timelineConfig);
  composed = branching(composed, branchingConfig);
  composed = inspector(composed);

  if (enableDevtools && typeof window !== 'undefined') {
    composed = devtools(composed, { name: storeName });
  }

  // Create the Zustand store
  const useStore = zustandCreate(composed);
  const api = useStore as any;

  // Attach metadata
  api.__id = storeId;
  api.__name = storeName;

  // Propagate metadata to the underlying store api
  const storeApi: EnhancedStoreApi<T> = api;

  // Register in global registry
  registry.register(storeApi);

  return useStore;
}
