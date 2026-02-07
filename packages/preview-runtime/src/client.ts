import { registry, mock, bridge } from '@vibe-stack/state-sdk';
import type { PreviewClientOptions, HostMessage } from './types.js';
import {
  createHelloMessage,
  createAppliedMessage,
  createStateUpdateMessage,
  createSnapshotResponseMessage,
  parseMessage,
} from './protocol.js';

/**
 * Initialize the preview client inside an iframe app.
 * Handles store discovery, hello handshake, and Host message processing.
 * Returns a dispose function that cleans up all listeners.
 */
export function initPreviewClient(options?: PreviewClientOptions): () => void {
  // Not in iframe — bail with noop
  if (window.self === window.top) {
    return () => {};
  }

  const {
    expectedStores,
    collectWindowMs = 100,
    allowedOrigins = ['*'],
  } = options ?? {};

  // Cleanup bookkeeping
  const cleanups: Array<() => void> = [];
  let disposed = false;

  // State update forwarding
  let stateUpdateUnsub: (() => void) | null = null;
  let stateUpdateThrottleMs = 50;
  let lastUpdateSent = 0;
  let throttleTimer: ReturnType<typeof setTimeout> | null = null;

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  function postToHost(msg: unknown): void {
    if (!disposed) {
      window.parent.postMessage(msg, '*');
    }
  }

  function isOriginAllowed(origin: string): boolean {
    if (allowedOrigins.includes('*')) return true;
    return allowedOrigins.includes(origin);
  }

  /** Strip functions from state (not serializable via postMessage structured clone) */
  function serializableState(state: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(state)) {
      if (typeof value !== 'function') {
        result[key] = value;
      }
    }
    return result;
  }

  function getCurrentStoresState(): Record<string, Record<string, unknown>> {
    const result: Record<string, Record<string, unknown>> = {};
    for (const entry of registry.getAll()) {
      result[entry.name] = serializableState(entry.store.getState() as Record<string, unknown>);
    }
    return result;
  }

  // ------------------------------------------------------------------
  // State update forwarding (enabled via config message)
  // ------------------------------------------------------------------

  function enableStateUpdates(): void {
    if (stateUpdateUnsub) return; // already subscribed
    stateUpdateUnsub = bridge.on('state:update', (event) => {
      if (disposed) return;

      // Resolve store name from storeId
      const entry = event.storeId ? registry.get(event.storeId) : undefined;
      if (!entry) return;

      const now = Date.now();
      const elapsed = now - lastUpdateSent;

      const send = () => {
        lastUpdateSent = Date.now();
        postToHost(
          createStateUpdateMessage(
            entry.name,
            entry.store.getState() as Record<string, unknown>,
          ),
        );
      };

      if (elapsed >= stateUpdateThrottleMs) {
        send();
      } else {
        // Throttle: schedule trailing send
        if (throttleTimer !== null) clearTimeout(throttleTimer);
        throttleTimer = setTimeout(send, stateUpdateThrottleMs - elapsed);
      }
    });
  }

  function disableStateUpdates(): void {
    if (stateUpdateUnsub) {
      stateUpdateUnsub();
      stateUpdateUnsub = null;
    }
    if (throttleTimer !== null) {
      clearTimeout(throttleTimer);
      throttleTimer = null;
    }
  }

  // ------------------------------------------------------------------
  // Message handler
  // ------------------------------------------------------------------

  function handleMessage(event: MessageEvent): void {
    if (disposed) return;
    if (!isOriginAllowed(event.origin)) return;

    const msg = parseMessage(event);
    if (!msg) return;

    // Only process Host → Client message types
    const hostMsg = msg as HostMessage;

    switch (hostMsg.type) {
      case 'inject': {
        try {
          if (hostMsg.payload.mode === 'replace') {
            for (const [name, storeData] of Object.entries(hostMsg.payload.stores)) {
              const entry = registry.getByName(name);
              if (entry) {
                mock.replace(entry.store, storeData);
              }
            }
          } else {
            mock.injectAll(hostMsg.payload.stores);
          }
          postToHost(
            createAppliedMessage(hostMsg.id, true, undefined, getCurrentStoresState()),
          );
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          postToHost(createAppliedMessage(hostMsg.id, false, message));
        }
        break;
      }

      case 'snapshot-request': {
        const stores: Record<string, Record<string, unknown>> = {};
        for (const entry of registry.getAll()) {
          stores[entry.name] = serializableState(entry.store.getState() as Record<string, unknown>);
        }
        postToHost(createSnapshotResponseMessage(hostMsg.id, { version: 1, timestamp: Date.now(), stores }));
        break;
      }

      case 'config': {
        if (hostMsg.payload.stateUpdateThrottleMs !== undefined) {
          stateUpdateThrottleMs = hostMsg.payload.stateUpdateThrottleMs;
        }
        if (hostMsg.payload.enableStateUpdates === true) {
          enableStateUpdates();
        } else if (hostMsg.payload.enableStateUpdates === false) {
          disableStateUpdates();
        }
        break;
      }

      default:
        // Ignore unknown or client-originated message types
        break;
    }
  }

  // ------------------------------------------------------------------
  // Register message listener
  // ------------------------------------------------------------------

  window.addEventListener('message', handleMessage);
  cleanups.push(() => window.removeEventListener('message', handleMessage));

  // ------------------------------------------------------------------
  // Store discovery & hello
  // ------------------------------------------------------------------

  function sendHello(storeNames: string[]): void {
    if (!disposed) {
      postToHost(createHelloMessage(storeNames));
    }
  }

  if (expectedStores) {
    // Wait for all expected stores to appear
    const remaining = new Set(expectedStores);

    // Check already-registered stores
    for (const name of expectedStores) {
      if (registry.getByName(name)) {
        remaining.delete(name);
      }
    }

    if (remaining.size === 0) {
      sendHello(expectedStores);
    } else {
      const unsub = registry.subscribe((_event, entry) => {
        remaining.delete(entry.name);
        if (remaining.size === 0) {
          unsub();
          sendHello(expectedStores);
        }
      });
      cleanups.push(unsub);
    }
  } else {
    // Auto-discovery: collect stores, debounce with collectWindowMs
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleHello = () => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        const names = registry.getAll().map((e) => e.name);
        sendHello(names);
      }, collectWindowMs);
    };

    const unsub = registry.subscribe(() => {
      scheduleHello();
    });
    cleanups.push(unsub);
    cleanups.push(() => {
      if (timer !== null) clearTimeout(timer);
    });

    // Kick off initial collection window
    scheduleHello();
  }

  // ------------------------------------------------------------------
  // Dispose
  // ------------------------------------------------------------------

  return () => {
    if (disposed) return;
    disposed = true;
    disableStateUpdates();
    for (const cleanup of cleanups) {
      cleanup();
    }
    cleanups.length = 0;
  };
}
