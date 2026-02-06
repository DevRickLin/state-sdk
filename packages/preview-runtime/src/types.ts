import type { SnapshotData } from '@vibe-stack/state-sdk';

// Re-export for convenience
export type { SnapshotData };

// ============================================================
// Protocol Constants
// ============================================================

export const PROTOCOL_NS = 'state-sdk:preview' as const;
export const PROTOCOL_VERSION = 1 as const;

// ============================================================
// Base Message
// ============================================================

export interface BaseMessage {
  ns: typeof PROTOCOL_NS;
  version: typeof PROTOCOL_VERSION;
  id: string;
}

// ============================================================
// Client → Host Messages
// ============================================================

/** iframe 就绪通知，包含已注册的 store 列表 */
export interface HelloMessage extends BaseMessage {
  type: 'hello';
  payload: {
    stores: string[];
  };
}

/** 状态注入回执 */
export interface AppliedMessage extends BaseMessage {
  type: 'applied';
  payload: {
    requestId: string;
    success: boolean;
    error?: string;
    storesState?: Record<string, Record<string, unknown>>;
  };
}

/** 实时状态变更推送（由 Host 通过 config 开启） */
export interface StateUpdateMessage extends BaseMessage {
  type: 'state-update';
  payload: {
    storeName: string;
    state: Record<string, unknown>;
    actionName?: string;
  };
}

/** 快照响应 */
export interface SnapshotResponseMessage extends BaseMessage {
  type: 'snapshot-response';
  payload: {
    requestId: string;
    snapshot: SnapshotData;
  };
}

// ============================================================
// Host → Client Messages
// ============================================================

/** 场景状态注入 */
export interface InjectMessage extends BaseMessage {
  type: 'inject';
  payload: {
    stores: Record<string, Record<string, unknown>>;
    mode: 'merge' | 'replace';
  };
}

/** 请求快照 */
export interface SnapshotRequestMessage extends BaseMessage {
  type: 'snapshot-request';
  payload: Record<string, never>;
}

/** 运行时配置指令 */
export interface ConfigMessage extends BaseMessage {
  type: 'config';
  payload: {
    enableStateUpdates?: boolean;
    stateUpdateThrottleMs?: number;
  };
}

// ============================================================
// Union Types
// ============================================================

export type ClientMessage =
  | HelloMessage
  | AppliedMessage
  | StateUpdateMessage
  | SnapshotResponseMessage;

export type HostMessage =
  | InjectMessage
  | SnapshotRequestMessage
  | ConfigMessage;

export type PreviewMessage = ClientMessage | HostMessage;

export type PreviewMessageType = PreviewMessage['type'];

// ============================================================
// Client Options
// ============================================================

export interface PreviewClientOptions {
  /**
   * 手动指定 store 名称列表。
   * 默认：自动从 registry 发现，延迟 collectWindowMs 后发送 hello。
   */
  expectedStores?: string[];
  /**
   * 自动发现模式下，等待 store 注册的窗口期 (ms)。
   * 默认: 100
   */
  collectWindowMs?: number;
  /**
   * 握手超时 (ms)。超过后不再等待 Host inject。
   * 默认: 5000
   */
  handshakeTimeout?: number;
  /**
   * 允许的 Host origin 列表。'*' 表示不限制。
   * 默认: ['*']
   */
  allowedOrigins?: string[];
}

// ============================================================
// Host Types
// ============================================================

export type ConnectionStatus = 'connecting' | 'ready' | 'injected' | 'error';

export interface PreviewConnection {
  readonly sceneId: string;
  readonly iframe: HTMLIFrameElement;
  readonly status: ConnectionStatus;
  readonly availableStores: string[];

  inject(
    stores: Record<string, Record<string, unknown>>,
    mode?: 'merge' | 'replace',
  ): Promise<AppliedMessage['payload']>;

  requestSnapshot(): Promise<SnapshotData>;

  configure(config: ConfigMessage['payload']): void;

  onStateUpdate(
    callback: (update: StateUpdateMessage['payload']) => void,
  ): () => void;

  onStatusChange(
    callback: (status: ConnectionStatus) => void,
  ): () => void;

  dispose(): void;
}

export interface PreviewHost {
  connect(iframe: HTMLIFrameElement, sceneId: string): PreviewConnection;
  disconnect(sceneId: string): void;
  getConnections(): Map<string, PreviewConnection>;
  dispose(): void;
}
