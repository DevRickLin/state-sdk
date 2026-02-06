import { useSyncExternalStore, useCallback } from 'react';
import type { EnhancedStoreApi, BranchData, BranchDiffResult } from '@anthropic/state-sdk';

interface BranchesState {
  branches: BranchData[];
  activeBranch: BranchData;
}

/**
 * React hook to access a store's branching state reactively.
 *
 * @example
 * ```tsx
 * const { branches, activeBranch, fork, switchTo, diff } = useBranches(useCounterStore);
 *
 * <button onClick={() => fork('experiment')}>Fork</button>
 * {branches.map(b => (
 *   <button key={b.id} onClick={() => switchTo(b.id)}>{b.name}</button>
 * ))}
 * ```
 */
export function useBranches(store: any): BranchesState & {
  fork: (name?: string) => BranchData;
  switchTo: (branchId: string) => void;
  diff: (branchIdA: string, branchIdB: string) => BranchDiffResult;
  deleteBranch: (branchId: string) => void;
  rename: (branchId: string, newName: string) => void;
} {
  const api = (store as unknown as EnhancedStoreApi<any>).branch;

  const subscribe = useCallback(
    (callback: () => void) => api.subscribe(callback),
    [api]
  );

  const getSnapshot = useCallback(
    () => ({
      branches: api.list(),
      activeBranch: api.active(),
    }),
    [api]
  );

  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    ...state,
    fork: api.fork,
    switchTo: api.switch,
    diff: api.diff,
    deleteBranch: api.delete,
    rename: api.rename,
  };
}
