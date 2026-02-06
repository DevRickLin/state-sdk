/**
 * Inspector middleware — logs every state change with action name and patches.
 * Uses mutative to generate RFC 6902 patches for the log.
 */
import { create as mutativeCreate, type Patches } from 'mutative';
import type { StateCreator, StoreMutatorIdentifier } from 'zustand';
import type { ActionLogEntry, InspectorApi } from '../types.js';
import { extractActionName, generateId } from '../utils.js';
import { bridge } from '../bridge.js';

const MAX_LOG_ENTRIES = 200;

type Inspector = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
>(
  initializer: StateCreator<T, Mps, Mcs>
) => StateCreator<T, Mps, Mcs>;

type InspectorImpl = <T>(
  initializer: StateCreator<T, [], []>
) => StateCreator<T, [], []>;

const inspectorImpl: InspectorImpl = (initializer) => (set, get, api) => {
  const log: ActionLogEntry[] = [];
  const listeners = new Set<(entry: ActionLogEntry) => void>();

  const wrappedSet: typeof set = (partial: any, replace?: any) => {
    const actionName = extractActionName(partial);
    const prevState = get();

    (set as any)(partial, replace);

    const nextState = get();

    // Generate patches via mutative
    let patches: Patches = [];
    try {
      const [, p] = mutativeCreate(
        prevState as object,
        (draft: any) => {
          const next = nextState as Record<string, any>;
          for (const key of Object.keys(next)) {
            if (typeof next[key] !== 'function') {
              draft[key] = next[key];
            }
          }
        },
        { enablePatches: true }
      ) as [unknown, Patches, Patches];
      patches = p;
    } catch {
      // Fallback: no patches if mutative fails
    }

    const entry: ActionLogEntry = {
      id: generateId(),
      timestamp: Date.now(),
      actionName,
      patches,
    };

    log.push(entry);
    if (log.length > MAX_LOG_ENTRIES) {
      log.shift();
    }

    for (const listener of listeners) {
      listener(entry);
    }

    bridge.emit('action:log', (api as any).__id, entry);
  };

  const inspectorApi: InspectorApi = {
    getActionLog: () => [...log],
    clear: () => { log.length = 0; },
    subscribe(listener: (entry: ActionLogEntry) => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };

  (api as any).inspector = inspectorApi;

  return initializer(wrappedSet as any, get, api);
};

export const inspector = inspectorImpl as Inspector;
