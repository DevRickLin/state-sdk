import type {
  PreviewHost,
  PreviewConnection,
  ConnectionStatus,
  ClientMessage,
  AppliedMessage,
  StateUpdateMessage,
  ConfigMessage,
  SnapshotData,
} from './types.js';

import {
  createInjectMessage,
  createSnapshotRequestMessage,
  createConfigMessage,
  parseMessage,
} from './protocol.js';

// ============================================================
// Constants
// ============================================================

const REQUEST_TIMEOUT_MS = 5000;

// ============================================================
// Pending Request Tracking
// ============================================================

interface PendingRequest<T = unknown> {
  resolve: (value: T) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

// ============================================================
// ConnectionImpl
// ============================================================

class ConnectionImpl implements PreviewConnection {
  readonly sceneId: string;
  readonly iframe: HTMLIFrameElement;

  private _status: ConnectionStatus = 'connecting';
  private _availableStores: string[] = [];
  private _stateUpdateListeners = new Set<(update: StateUpdateMessage['payload']) => void>();
  private _statusChangeListeners = new Set<(status: ConnectionStatus) => void>();
  private _pendingRequests = new Map<string, PendingRequest<unknown>>();

  constructor(iframe: HTMLIFrameElement, sceneId: string) {
    this.iframe = iframe;
    this.sceneId = sceneId;
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  get availableStores(): string[] {
    return this._availableStores;
  }

  // ----------------------------------------------------------
  // Message handling (called by the global router)
  // ----------------------------------------------------------

  handleMessage(msg: ClientMessage): void {
    switch (msg.type) {
      case 'hello':
        this._availableStores = msg.payload.stores;
        this._setStatus('ready');
        break;

      case 'applied':
        this._resolvePending<AppliedMessage['payload']>(msg.payload.requestId, msg.payload);
        if (msg.payload.success) {
          this._setStatus('injected');
        }
        break;

      case 'state-update':
        for (const cb of this._stateUpdateListeners) {
          cb(msg.payload);
        }
        break;

      case 'snapshot-response':
        this._resolvePending<SnapshotData>(msg.payload.requestId, msg.payload.snapshot);
        break;
    }
  }

  // ----------------------------------------------------------
  // Public API
  // ----------------------------------------------------------

  inject(
    stores: Record<string, Record<string, unknown>>,
    mode?: 'merge' | 'replace',
  ): Promise<AppliedMessage['payload']> {
    const message = createInjectMessage(stores, mode);
    this._postMessage(message);
    return this._createPendingRequest<AppliedMessage['payload']>(message.id);
  }

  requestSnapshot(): Promise<SnapshotData> {
    const message = createSnapshotRequestMessage();
    this._postMessage(message);
    return this._createPendingRequest<SnapshotData>(message.id);
  }

  configure(config: ConfigMessage['payload']): void {
    const message = createConfigMessage(config);
    this._postMessage(message);
  }

  onStateUpdate(callback: (update: StateUpdateMessage['payload']) => void): () => void {
    this._stateUpdateListeners.add(callback);
    return () => {
      this._stateUpdateListeners.delete(callback);
    };
  }

  onStatusChange(callback: (status: ConnectionStatus) => void): () => void {
    this._statusChangeListeners.add(callback);
    return () => {
      this._statusChangeListeners.delete(callback);
    };
  }

  dispose(): void {
    for (const [, pending] of this._pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Connection disposed'));
    }
    this._pendingRequests.clear();
    this._stateUpdateListeners.clear();
    this._statusChangeListeners.clear();
    this._status = 'connecting';
    this._availableStores = [];
  }

  // ----------------------------------------------------------
  // Private helpers
  // ----------------------------------------------------------

  private _setStatus(status: ConnectionStatus): void {
    if (this._status === status) return;
    this._status = status;
    for (const cb of this._statusChangeListeners) {
      cb(status);
    }
  }

  private _postMessage(message: unknown): void {
    this.iframe.contentWindow?.postMessage(message, '*');
  }

  private _createPendingRequest<T>(messageId: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pendingRequests.delete(messageId);
        reject(new Error(`Request ${messageId} timed out after ${REQUEST_TIMEOUT_MS}ms`));
      }, REQUEST_TIMEOUT_MS);

      this._pendingRequests.set(messageId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      });
    });
  }

  private _resolvePending<T>(requestId: string, value: T): void {
    const pending = this._pendingRequests.get(requestId);
    if (!pending) return;
    clearTimeout(pending.timer);
    this._pendingRequests.delete(requestId);
    pending.resolve(value);
  }
}

// ============================================================
// createPreviewHost
// ============================================================

export function createPreviewHost(): PreviewHost {
  const connections = new Map<string, ConnectionImpl>();

  function handleMessage(event: MessageEvent): void {
    const msg = parseMessage(event);
    if (!msg) return;

    // Only route client → host messages
    if (
      msg.type !== 'hello' &&
      msg.type !== 'applied' &&
      msg.type !== 'state-update' &&
      msg.type !== 'snapshot-response'
    ) {
      return;
    }

    // Find the connection whose iframe matches event.source
    for (const connection of connections.values()) {
      if (connection.iframe.contentWindow === event.source) {
        connection.handleMessage(msg as ClientMessage);
        return;
      }
    }
  }

  window.addEventListener('message', handleMessage);

  return {
    connect(iframe: HTMLIFrameElement, sceneId: string): PreviewConnection {
      const existing = connections.get(sceneId);
      if (existing) {
        existing.dispose();
      }
      const connection = new ConnectionImpl(iframe, sceneId);
      connections.set(sceneId, connection);
      return connection;
    },

    disconnect(sceneId: string): void {
      const connection = connections.get(sceneId);
      if (!connection) return;
      connection.dispose();
      connections.delete(sceneId);
    },

    getConnections(): Map<string, PreviewConnection> {
      return connections;
    },

    dispose(): void {
      for (const connection of connections.values()) {
        connection.dispose();
      }
      connections.clear();
      window.removeEventListener('message', handleMessage);
    },
  };
}
