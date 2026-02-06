import type { BridgeEvent, BridgeEventType } from './types.js';

type BridgeListener = (event: BridgeEvent) => void;

class Bridge {
  private listeners = new Map<BridgeEventType, Set<BridgeListener>>();
  private globalListeners = new Set<BridgeListener>();

  emit(type: BridgeEventType, storeId?: string, payload?: unknown): void {
    const event: BridgeEvent = { type, storeId, payload };

    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      for (const listener of typeListeners) {
        listener(event);
      }
    }

    for (const listener of this.globalListeners) {
      listener(event);
    }
  }

  on(type: BridgeEventType, listener: BridgeListener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
    return () => {
      this.listeners.get(type)?.delete(listener);
    };
  }

  onAny(listener: BridgeListener): () => void {
    this.globalListeners.add(listener);
    return () => {
      this.globalListeners.delete(listener);
    };
  }

  off(type: BridgeEventType, listener: BridgeListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  removeAll(): void {
    this.listeners.clear();
    this.globalListeners.clear();
  }
}

/** Global bridge singleton for SDK <-> DevPanel communication */
export const bridge = new Bridge();
