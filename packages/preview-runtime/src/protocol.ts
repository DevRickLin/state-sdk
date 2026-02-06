import {
  PROTOCOL_NS,
  PROTOCOL_VERSION,
  type PreviewMessage,
  type HelloMessage,
  type AppliedMessage,
  type StateUpdateMessage,
  type SnapshotResponseMessage,
  type InjectMessage,
  type SnapshotRequestMessage,
  type ConfigMessage,
  type SnapshotData,
} from './types.js';

// ============================================================
// Message ID Generator
// ============================================================

let counter = 0;

export function createMessageId(): string {
  return `${Date.now().toString(36)}_${(counter++).toString(36)}`;
}

// ============================================================
// Message Factories — Client → Host
// ============================================================

export function createHelloMessage(stores: string[]): HelloMessage {
  return {
    ns: PROTOCOL_NS,
    version: PROTOCOL_VERSION,
    id: createMessageId(),
    type: 'hello',
    payload: { stores },
  };
}

export function createAppliedMessage(
  requestId: string,
  success: boolean,
  error?: string,
  storesState?: Record<string, Record<string, unknown>>,
): AppliedMessage {
  return {
    ns: PROTOCOL_NS,
    version: PROTOCOL_VERSION,
    id: createMessageId(),
    type: 'applied',
    payload: { requestId, success, error, storesState },
  };
}

export function createStateUpdateMessage(
  storeName: string,
  state: Record<string, unknown>,
  actionName?: string,
): StateUpdateMessage {
  return {
    ns: PROTOCOL_NS,
    version: PROTOCOL_VERSION,
    id: createMessageId(),
    type: 'state-update',
    payload: { storeName, state, actionName },
  };
}

export function createSnapshotResponseMessage(
  requestId: string,
  snapshot: SnapshotData,
): SnapshotResponseMessage {
  return {
    ns: PROTOCOL_NS,
    version: PROTOCOL_VERSION,
    id: createMessageId(),
    type: 'snapshot-response',
    payload: { requestId, snapshot },
  };
}

// ============================================================
// Message Factories — Host → Client
// ============================================================

export function createInjectMessage(
  stores: Record<string, Record<string, unknown>>,
  mode: 'merge' | 'replace' = 'merge',
): InjectMessage {
  return {
    ns: PROTOCOL_NS,
    version: PROTOCOL_VERSION,
    id: createMessageId(),
    type: 'inject',
    payload: { stores, mode },
  };
}

export function createSnapshotRequestMessage(): SnapshotRequestMessage {
  return {
    ns: PROTOCOL_NS,
    version: PROTOCOL_VERSION,
    id: createMessageId(),
    type: 'snapshot-request',
    payload: {},
  };
}

export function createConfigMessage(
  config: ConfigMessage['payload'],
): ConfigMessage {
  return {
    ns: PROTOCOL_NS,
    version: PROTOCOL_VERSION,
    id: createMessageId(),
    type: 'config',
    payload: config,
  };
}

// ============================================================
// Message Validation
// ============================================================

const VALID_TYPES = new Set([
  'hello',
  'applied',
  'state-update',
  'snapshot-response',
  'inject',
  'snapshot-request',
  'config',
]);

/** 判断一个 MessageEvent.data 是否为合法的 preview 协议消息 */
export function isPreviewMessage(data: unknown): data is PreviewMessage {
  if (typeof data !== 'object' || data === null) return false;
  const msg = data as Record<string, unknown>;
  return (
    msg.ns === PROTOCOL_NS &&
    msg.version === PROTOCOL_VERSION &&
    typeof msg.id === 'string' &&
    typeof msg.type === 'string' &&
    VALID_TYPES.has(msg.type as string)
  );
}

/** 从 MessageEvent 中提取协议消息，返回 null 表示不是合法消息 */
export function parseMessage(event: MessageEvent): PreviewMessage | null {
  if (isPreviewMessage(event.data)) {
    return event.data;
  }
  return null;
}
