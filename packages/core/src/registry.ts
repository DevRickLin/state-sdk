import type { EnhancedStoreApi, StoreRegistryEntry } from './types.js';

type RegistryListener = (
  event: 'register' | 'unregister',
  entry: StoreRegistryEntry
) => void;

class StoreRegistry {
  private stores = new Map<string, StoreRegistryEntry>();
  private listeners = new Set<RegistryListener>();

  register(store: EnhancedStoreApi<any>): void {
    const entry: StoreRegistryEntry = {
      id: store.__id,
      name: store.__name,
      store,
      createdAt: Date.now(),
    };
    this.stores.set(store.__id, entry);
    this.notify('register', entry);
  }

  unregister(storeId: string): void {
    const entry = this.stores.get(storeId);
    if (entry) {
      this.stores.delete(storeId);
      this.notify('unregister', entry);
    }
  }

  get(storeId: string): StoreRegistryEntry | undefined {
    return this.stores.get(storeId);
  }

  getAll(): StoreRegistryEntry[] {
    return Array.from(this.stores.values());
  }

  getByName(name: string): StoreRegistryEntry | undefined {
    for (const entry of this.stores.values()) {
      if (entry.name === name) return entry;
    }
    return undefined;
  }

  subscribe(listener: RegistryListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  clear(): void {
    this.stores.clear();
  }

  get size(): number {
    return this.stores.size;
  }

  private notify(event: 'register' | 'unregister', entry: StoreRegistryEntry): void {
    for (const listener of this.listeners) {
      listener(event, entry);
    }
  }
}

/** Global store registry singleton */
export const registry = new StoreRegistry();
