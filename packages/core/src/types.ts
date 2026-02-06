import type { Patches } from 'mutative';
import type {
  TravelsControls,
  ManualTravelsControls,
  TravelPatches,
} from 'travels';
import type { StoreApi } from 'zustand';

// Re-export travels types for convenience
export type { TravelsControls, ManualTravelsControls, TravelPatches };

// ============================================
// Store Configuration Types
// ============================================

export interface TimelineConfig {
  /** Enable time travel. Default: true */
  enabled?: boolean;
  /** Max history entries. Default: 100 */
  maxHistory?: number;
  /** Auto archive every set() call. Default: true */
  autoArchive?: boolean;
}

export interface BranchingConfig {
  /** Enable state branching. Default: true */
  enabled?: boolean;
}

export interface StoreConfig {
  /** Store name (used in DevPanel and DevTools) */
  name?: string;
  /** Timeline (Time Travel) config */
  timeline?: TimelineConfig | boolean;
  /** Branching config */
  branching?: BranchingConfig | boolean;
  /** Enable Redux DevTools integration */
  devtools?: boolean;
}

// ============================================
// Timeline Types (powered by travels)
// ============================================

export interface TemporalApi<T = unknown> {
  /** Undo N steps (default 1) */
  back: (steps?: number) => void;
  /** Redo N steps (default 1) */
  forward: (steps?: number) => void;
  /** Jump to an absolute position in history */
  go: (position: number) => void;
  /** Reset to initial state */
  reset: () => void;
  /** Check if undo is possible */
  canBack: () => boolean;
  /** Check if redo is possible */
  canForward: () => boolean;
  /** Current position in history */
  readonly position: number;
  /** Get the full state history (reconstructed from patches) */
  getHistory: () => readonly T[];
  /** Get the raw patches */
  readonly patches: TravelPatches;
  /** Subscribe to timeline changes */
  subscribe: (listener: () => void) => () => void;
}

// ============================================
// Branching Types
// ============================================

export interface BranchData {
  id: string;
  name: string;
  parentBranchId: string | null;
  forkPoint: number;
  /** Full state snapshot at fork time (initial state for this branch) */
  snapshot: Record<string, unknown>;
  /** Current state at currentPosition (used for Travels reconstruction) */
  currentState: Record<string, unknown>;
  /** Patches accumulated on this branch */
  patches: TravelPatches;
  currentPosition: number;
  createdAt: number;
}

export interface BranchDiffResult {
  added: Array<{ path: string[]; value: unknown }>;
  removed: Array<{ path: string[]; value: unknown }>;
  changed: Array<{ path: string[]; from: unknown; to: unknown }>;
}

export interface BranchApi {
  fork: (name?: string) => BranchData;
  switch: (branchId: string) => void;
  list: () => BranchData[];
  active: () => BranchData;
  diff: (branchIdA: string, branchIdB: string) => BranchDiffResult;
  delete: (branchId: string) => void;
  rename: (branchId: string, newName: string) => void;
  subscribe: (listener: () => void) => () => void;
}

// ============================================
// Inspector Types
// ============================================

export interface ActionLogEntry {
  id: string;
  timestamp: number;
  actionName: string;
  patches: Patches;
}

export interface InspectorApi {
  getActionLog: () => ActionLogEntry[];
  clear: () => void;
  subscribe: (listener: (entry: ActionLogEntry) => void) => () => void;
}

// ============================================
// Enhanced Store Types
// ============================================

export interface EnhancedStoreApi<T> extends StoreApi<T> {
  temporal: TemporalApi<T>;
  branch: BranchApi;
  inspector: InspectorApi;
  __name: string;
  __id: string;
}

// ============================================
// Registry Types
// ============================================

export interface StoreRegistryEntry {
  id: string;
  name: string;
  store: EnhancedStoreApi<any>;
  createdAt: number;
}

// ============================================
// Bridge / Transport Types
// ============================================

export type BridgeEventType =
  | 'state:update'
  | 'timeline:update'
  | 'branch:update'
  | 'action:log'
  | 'store:register'
  | 'store:unregister';

export interface BridgeEvent {
  type: BridgeEventType;
  storeId?: string;
  payload?: unknown;
}
