import { useSyncExternalStore, useCallback } from 'react';
import type { EnhancedStoreApi, TravelPatches } from '@vibe-stack/state-sdk';

interface UseTimelineResult {
  /** Current position in history */
  position: number;
  /** Whether undo is possible (reactive snapshot) */
  canBack: boolean;
  /** Whether redo is possible (reactive snapshot) */
  canForward: boolean;
  /** Undo N steps (default 1) */
  back: (steps?: number) => void;
  /** Redo N steps (default 1) */
  forward: (steps?: number) => void;
  /** Jump to absolute position */
  go: (position: number) => void;
  /** Reset to initial state */
  reset: () => void;
  /** Get full state history */
  getHistory: () => readonly unknown[];
  /** Get raw patches */
  patches: TravelPatches;
  /** Subscribe to timeline changes */
  subscribe: (listener: () => void) => () => void;
}

/**
 * React hook to access a store's timeline (time travel) state reactively.
 *
 * @example
 * ```tsx
 * const { position, canBack, canForward, back, forward, go } = useTimeline(useCounterStore);
 *
 * <button onClick={() => back()} disabled={!canBack}>Undo</button>
 * <button onClick={() => forward()} disabled={!canForward}>Redo</button>
 * <span>Position: {position}</span>
 * ```
 */
export function useTimeline(store: any): UseTimelineResult {
  const api = (store as unknown as EnhancedStoreApi<any>).temporal;

  const subscribe = useCallback(
    (callback: () => void) => api.subscribe(callback),
    [api]
  );

  const getSnapshot = useCallback(
    () => ({
      position: api.position,
      canBack: api.canBack(),
      canForward: api.canForward(),
    }),
    [api]
  );

  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    ...state,
    back: api.back,
    forward: api.forward,
    go: api.go,
    reset: api.reset,
    getHistory: api.getHistory,
    get patches() { return api.patches; },
    subscribe: api.subscribe,
  };
}
