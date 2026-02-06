// Core API
export { create } from './createStore.js';
export { registry } from './registry.js';
export { bridge } from './bridge.js';
export { snapshot } from './snapshot.js';
export { mock } from './middleware/mock.js';

// Middleware (for advanced usage)
export { timeline } from './middleware/timeline.js';
export { branching } from './middleware/branching.js';
export { inspector } from './middleware/inspector.js';

// Types
export type {
  StoreConfig,
  TimelineConfig,
  BranchingConfig,
  TemporalApi,
  BranchData,
  BranchDiffResult,
  BranchApi,
  ActionLogEntry,
  InspectorApi,
  EnhancedStoreApi,
  StoreRegistryEntry,
  BridgeEvent,
  BridgeEventType,
  TravelPatches,
} from './types.js';

export type { SnapshotData } from './snapshot.js';
