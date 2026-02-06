import type { EnhancedStoreApi } from './types.js';
import { registry } from './registry.js';
import { deepClone } from './utils.js';

export interface SnapshotData {
  version: 1;
  timestamp: number;
  stores: Record<string, Record<string, unknown>>;
}

export const snapshot = {
  /**
   * Export state from a single store.
   */
  export<T>(store: EnhancedStoreApi<T>): Record<string, unknown> {
    return deepClone(store.getState() as Record<string, unknown>);
  },

  /**
   * Export all registered stores' state.
   */
  exportAll(): SnapshotData {
    const stores: Record<string, Record<string, unknown>> = {};
    for (const entry of registry.getAll()) {
      stores[entry.name] = deepClone(entry.store.getState() as Record<string, unknown>);
    }
    return {
      version: 1,
      timestamp: Date.now(),
      stores,
    };
  },

  /**
   * Import state into a single store.
   */
  import<T>(store: EnhancedStoreApi<T>, data: Record<string, unknown>): void {
    store.setState(data as T, true);
  },

  /**
   * Import state into all stores from a snapshot.
   */
  importAll(data: SnapshotData): void {
    if (data.version !== 1) {
      throw new Error(`Unsupported snapshot version: ${data.version}`);
    }
    for (const [name, storeData] of Object.entries(data.stores)) {
      const entry = registry.getByName(name);
      if (entry) {
        entry.store.setState(storeData, true);
      }
    }
  },

  /**
   * Download all stores' state as a JSON file (browser only).
   */
  downloadAll(filename = 'state-snapshot.json'): void {
    const data = snapshot.exportAll();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  /**
   * Upload and import a snapshot JSON file (browser only).
   * Returns a promise that resolves when import is complete.
   */
  uploadAndImportAll(): Promise<SnapshotData> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) {
          reject(new Error('No file selected'));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const data = JSON.parse(reader.result as string) as SnapshotData;
            snapshot.importAll(data);
            resolve(data);
          } catch (e) {
            reject(e);
          }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
      };
      input.click();
    });
  },

  /**
   * Serialize snapshot to JSON string.
   */
  stringify(data?: SnapshotData): string {
    return JSON.stringify(data ?? snapshot.exportAll(), null, 2);
  },

  /**
   * Parse a JSON string into a SnapshotData object.
   */
  parse(json: string): SnapshotData {
    return JSON.parse(json);
  },
};
