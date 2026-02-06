/**
 * Timeline middleware — wraps zustand set() and delegates to `travels` library
 * for undo/redo/go(position) powered by RFC 6902 JSON Patches via Mutative.
 *
 * Pattern adapted from zustand-travel, with additions for our branching layer.
 */
import { Travels, type Updater } from 'travels';
import type { StateCreator, StoreMutatorIdentifier } from 'zustand';
import type { TemporalApi, TimelineConfig } from '../types.js';
import { separateStateAndActions } from '../utils.js';
import { bridge } from '../bridge.js';

const DEFAULT_CONFIG: Required<TimelineConfig> = {
  enabled: true,
  maxHistory: 100,
  autoArchive: true,
};

type Timeline = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
>(
  initializer: StateCreator<T, Mps, Mcs>,
  config?: TimelineConfig
) => StateCreator<T, Mps, Mcs>;

type TimelineImpl = <T>(
  initializer: StateCreator<T, [], []>,
  config?: TimelineConfig
) => StateCreator<T, [], []>;

const timelineImpl: TimelineImpl = (initializer, config) => (set, get, api) => {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (!cfg.enabled) {
    (api as any).temporal = createNoopTemporal();
    return initializer(set, get, api);
  }

  let travels: Travels<any, false, true>;
  let actions: Record<string, any> = {};
  let isInitializing = true;

  // Custom set that routes through travels (Mutative handles immutable updates internally)
  const travelSet: typeof set = (partial: any, replace?: any) => {
    if (isInitializing) {
      return (set as any)(partial, replace);
    }

    if (typeof partial === 'function') {
      // Mutation-style updater: set((state) => { state.count++ })
      travels.setState(partial as Updater<any>);
    } else if (replace) {
      // Full replacement: set(newState, true)
      travels.setState(partial as Updater<any>);
    } else {
      // Partial update: set({ count: 1 }) → convert to mutation
      travels.setState(((draft: any) => {
        Object.assign(draft, partial);
      }) as Updater<any>);
    }
  };

  // Timeline change listeners (for React hooks)
  const listeners = new Set<() => void>();
  function notifyListeners() {
    for (const listener of listeners) listener();
  }

  // Call the user's initializer with our wrapped set
  const initialState = initializer(travelSet as any, get, api);

  // Separate data from functions (zustand-travel pattern)
  const { state: dataState, actions: extractedActions } =
    separateStateAndActions(initialState as Record<string, any>);
  actions = extractedActions as Record<string, any>;

  // Create Travels instance — this is the core undo/redo engine
  travels = new Travels(dataState, {
    maxHistory: cfg.maxHistory,
    autoArchive: cfg.autoArchive,
  });

  isInitializing = false;

  // When travels changes state (via undo/redo/go), sync back to zustand store
  travels.subscribe((state) => {
    const nextState = { ...state, ...actions };
    (set as any)(nextState, true);
    notifyListeners();

    bridge.emit('timeline:update', (api as any).__id, {
      position: controls.position,
    });
  });

  const controls = travels.getControls();

  // Build temporal API (our public interface)
  const temporal: TemporalApi<any> = {
    back: (steps = 1) => controls.back(steps),
    forward: (steps = 1) => controls.forward(steps),
    go: (position) => controls.go(position),
    reset: () => controls.reset(),
    canBack: () => controls.canBack(),
    canForward: () => controls.canForward(),
    get position() {
      return controls.position;
    },
    getHistory: () => controls.getHistory(),
    get patches() {
      return controls.patches;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };

  (api as any).temporal = temporal;
  // Expose for branching layer to snapshot/restore
  (api as any).__travels = travels;
  (api as any).__actions = actions;

  return initialState;
};

function createNoopTemporal(): TemporalApi<any> {
  return {
    back() {},
    forward() {},
    go() {},
    reset() {},
    canBack: () => false,
    canForward: () => false,
    position: 0,
    getHistory: () => [],
    patches: { patches: [], inversePatches: [] },
    subscribe: () => () => {},
  };
}

export const timeline = timelineImpl as Timeline;
