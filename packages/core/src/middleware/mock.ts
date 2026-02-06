import type { EnhancedStoreApi } from '../types.js';
import { registry } from '../registry.js';
import { deepClone } from '../utils.js';
import { bridge } from '../bridge.js';

export const mock = {
  /**
   * Inject mock data into a specific store, merging with current state.
   */
  inject<T>(store: EnhancedStoreApi<T>, data: Partial<T>): void {
    const current = store.getState();
    store.setState({ ...current, ...data } as T, true);
    bridge.emit('state:update', store.__id, store.getState());
  },

  /**
   * Replace entire store state with mock data.
   */
  replace<T>(store: EnhancedStoreApi<T>, data: T): void {
    store.setState(data, true);
    bridge.emit('state:update', store.__id, store.getState());
  },

  /**
   * Inject mock data into multiple stores by name.
   */
  injectAll(data: Record<string, Record<string, unknown>>): void {
    for (const [name, storeData] of Object.entries(data)) {
      const entry = registry.getByName(name);
      if (entry) {
        const current = entry.store.getState();
        entry.store.setState({ ...current, ...storeData }, true);
        bridge.emit('state:update', entry.id, entry.store.getState());
      }
    }
  },

  /**
   * Reset a store to its initial state via the temporal API.
   */
  reset<T>(store: EnhancedStoreApi<T>): void {
    const temporal = (store as any).temporal;
    if (temporal && typeof temporal.reset === 'function') {
      temporal.reset();
      bridge.emit('state:update', store.__id, store.getState());
    }
  },
};
