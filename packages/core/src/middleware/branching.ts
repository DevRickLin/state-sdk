/**
 * State Branching middleware — the core differentiating feature.
 *
 * Enables git-like branching for application state:
 * - fork: create a new branch from the current state
 * - switch: switch to a different branch (saves/restores travels state)
 * - diff: compare two branches
 * - delete/rename: manage branches
 *
 * Sits on top of the timeline middleware; reads/writes __travels internals
 * to save and restore undo/redo history per branch.
 */
import { Travels } from 'travels';
import type { StateCreator, StoreMutatorIdentifier } from 'zustand';
import type { BranchApi, BranchData, BranchDiffResult, BranchingConfig, TravelPatches } from '../types.js';
import { deepClone, deepDiff, generateId } from '../utils.js';
import { bridge } from '../bridge.js';

type Branching = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
>(
  initializer: StateCreator<T, Mps, Mcs>,
  config?: BranchingConfig
) => StateCreator<T, Mps, Mcs>;

type BranchingImpl = <T>(
  initializer: StateCreator<T, [], []>,
  config?: BranchingConfig
) => StateCreator<T, [], []>;

const branchingImpl: BranchingImpl = (initializer, config) => (set, get, api) => {
  const cfg = { enabled: true, ...config };

  if (!cfg.enabled) {
    (api as any).branch = createNoopBranch();
    return initializer(set, get, api);
  }

  const branches = new Map<string, BranchData>();
  let activeBranchId = 'main';
  const listeners = new Set<() => void>();

  function notify() {
    for (const listener of listeners) listener();
    bridge.emit('branch:update', (api as any).__id, {
      branches: Array.from(branches.values()),
      activeBranchId,
    });
  }

  // Get the travels instance attached by timeline middleware
  function getTravels(): Travels<any, false, true> | null {
    return (api as any).__travels ?? null;
  }

  function getActions(): Record<string, any> {
    return (api as any).__actions ?? {};
  }

  // Initialize the result first so timeline middleware creates __travels
  const result = initializer(set, get, api);

  /** Extract data-only state from the store (exclude functions) */
  function getDataState(): Record<string, unknown> {
    const fullState = get() as Record<string, any>;
    const dataState: Record<string, unknown> = {};
    for (const key in fullState) {
      if (typeof fullState[key] !== 'function') {
        dataState[key] = fullState[key];
      }
    }
    return dataState;
  }

  // Capture initial state for main branch after timeline has initialized
  queueMicrotask(() => {
    const travels = getTravels();
    if (!travels) return;

    const controls = travels.getControls();
    const dataState = getDataState();

    branches.set('main', {
      id: 'main',
      name: 'main',
      parentBranchId: null,
      forkPoint: 0,
      snapshot: deepClone(dataState),
      currentState: deepClone(dataState),
      patches: deepClone(controls.patches),
      currentPosition: controls.position,
      createdAt: Date.now(),
    });
  });

  /** Save current travels state into the active branch */
  function saveActiveBranch() {
    const travels = getTravels();
    if (!travels) return;

    const branch = branches.get(activeBranchId);
    if (!branch) return;

    const controls = travels.getControls();
    branch.patches = deepClone(controls.patches);
    branch.currentPosition = controls.position;
    // Save the current state at position (needed for Travels reconstruction)
    branch.currentState = deepClone(getDataState());
  }

  /** Restore a branch's state into the travels instance and zustand */
  function restoreBranch(branchId: string) {
    const travels = getTravels();
    if (!travels) return;

    const branch = branches.get(branchId);
    if (!branch) return;

    // Rebuild Travels from saved state + patches.
    // IMPORTANT: Travels constructor takes the CURRENT state (at position),
    // not the initial snapshot. This matches the travels persistence pattern:
    //   new Travels(travels.getState(), { initialPatches, initialPosition })
    const newTravels = new Travels(deepClone(branch.currentState), {
      maxHistory: 100,
      autoArchive: true,
      initialPatches: deepClone(branch.patches),
      initialPosition: branch.currentPosition,
    });

    // Replace the __travels instance on the api
    const actions = getActions();
    (api as any).__travels = newTravels;

    // Rewire the temporal API to use the new travels
    const temporal = (api as any).temporal;
    if (temporal) {
      const newControls = newTravels.getControls();
      temporal.back = (steps = 1) => newControls.back(steps);
      temporal.forward = (steps = 1) => newControls.forward(steps);
      temporal.go = (position: number) => newControls.go(position);
      temporal.reset = () => newControls.reset();
      temporal.canBack = () => newControls.canBack();
      temporal.canForward = () => newControls.canForward();
      Object.defineProperty(temporal, 'position', {
        get: () => newControls.position,
        configurable: true,
      });
      temporal.getHistory = () => newControls.getHistory();
      Object.defineProperty(temporal, 'patches', {
        get: () => newControls.patches,
        configurable: true,
      });
    }

    // Sync new travels state changes back to zustand
    newTravels.subscribe((state: any) => {
      const nextState = { ...state, ...actions };
      (api.setState as any)(nextState, true);
    });

    // Set the zustand store to the branch's saved current state
    const nextState = { ...deepClone(branch.currentState), ...actions };
    (api.setState as any)(nextState, true);
  }

  /** Get the current data state of a branch */
  function getBranchCurrentState(branchId: string): Record<string, unknown> {
    if (branchId === activeBranchId) {
      return getDataState();
    }

    const branch = branches.get(branchId);
    if (!branch) throw new Error(`Branch "${branchId}" not found`);

    // For inactive branches, return the saved current state
    return deepClone(branch.currentState);
  }

  const branchApi: BranchApi = {
    fork(name?: string) {
      saveActiveBranch();

      const id = generateId();
      const branchName = name || `branch-${id.slice(0, 6)}`;

      // Get current data state
      const currentData = getBranchCurrentState(activeBranchId);

      const newBranch: BranchData = {
        id,
        name: branchName,
        parentBranchId: activeBranchId,
        forkPoint: getTravels()?.getControls().position ?? 0,
        snapshot: deepClone(currentData),
        currentState: deepClone(currentData),
        patches: { patches: [], inversePatches: [] },
        currentPosition: 0,
        createdAt: Date.now(),
      };

      branches.set(id, newBranch);
      notify();
      return deepClone(newBranch);
    },

    switch(branchId: string) {
      if (branchId === activeBranchId) return;
      if (!branches.has(branchId)) {
        throw new Error(`Branch "${branchId}" not found`);
      }

      saveActiveBranch();
      activeBranchId = branchId;
      restoreBranch(branchId);
      notify();
    },

    list() {
      saveActiveBranch();
      return Array.from(branches.values()).map((b) => deepClone(b));
    },

    active() {
      saveActiveBranch();
      const branch = branches.get(activeBranchId);
      if (!branch) throw new Error('Active branch not found');
      return deepClone(branch);
    },

    diff(branchIdA: string, branchIdB: string): BranchDiffResult {
      saveActiveBranch();
      const stateA = getBranchCurrentState(branchIdA);
      const stateB = getBranchCurrentState(branchIdB);
      return deepDiff(stateA, stateB);
    },

    delete(branchId: string) {
      if (branchId === 'main') {
        throw new Error('Cannot delete the main branch');
      }
      if (branchId === activeBranchId) {
        throw new Error('Cannot delete the active branch. Switch first.');
      }
      branches.delete(branchId);
      notify();
    },

    rename(branchId: string, newName: string) {
      const branch = branches.get(branchId);
      if (!branch) throw new Error(`Branch "${branchId}" not found`);
      branch.name = newName;
      notify();
    },

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };

  (api as any).branch = branchApi;

  return result;
};

function createNoopBranch(): BranchApi {
  const noop: BranchData = {
    id: 'main', name: 'main', parentBranchId: null, forkPoint: 0,
    snapshot: {}, currentState: {},
    patches: { patches: [], inversePatches: [] },
    currentPosition: 0, createdAt: Date.now(),
  };
  return {
    fork: () => noop,
    switch: () => {},
    list: () => [noop],
    active: () => noop,
    diff: () => ({ added: [], removed: [], changed: [] }),
    delete: () => {},
    rename: () => {},
    subscribe: () => () => {},
  };
}

export const branching = branchingImpl as Branching;
