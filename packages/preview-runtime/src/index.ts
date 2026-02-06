// Client — used inside the iframe (user's app)
export { initPreviewClient } from './client.js';

// Host — used by the board/canvas application
export { createPreviewHost } from './host.js';

// Protocol utilities
export {
  isPreviewMessage,
  parseMessage,
  createMessageId,
} from './protocol.js';

// Types
export type {
  PreviewClientOptions,
  PreviewHost,
  PreviewConnection,
  ConnectionStatus,
  SnapshotData,
  // Message types
  PreviewMessage,
  PreviewMessageType,
  ClientMessage,
  HostMessage,
  HelloMessage,
  AppliedMessage,
  StateUpdateMessage,
  SnapshotResponseMessage,
  InjectMessage,
  SnapshotRequestMessage,
  ConfigMessage,
} from './types.js';

export { PROTOCOL_NS, PROTOCOL_VERSION } from './types.js';
