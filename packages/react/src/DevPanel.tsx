import React, { useEffect, useState } from 'react';
import { registry } from '@anthropic/state-sdk';
import type { StoreRegistryEntry } from '@anthropic/state-sdk';

// ============================================
// Types
// ============================================

interface DevPanelProps {
  /** Panel position. Default: 'bottom-right' */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /** Start open. Default: false */
  defaultOpen?: boolean;
  /** Keyboard shortcut to toggle. Default: 'ctrl+shift+d' */
  hotkey?: string;
}

type Tab = 'state' | 'timeline' | 'branches' | 'mock';

// ============================================
// DevPanel Component
// ============================================

export function DevPanel({
  position = 'bottom-right',
  defaultOpen = false,
  hotkey = 'ctrl+shift+d',
}: DevPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [activeTab, setActiveTab] = useState<Tab>('state');
  const [stores, setStores] = useState<StoreRegistryEntry[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [, forceUpdate] = useState(0);

  // Refresh store list
  useEffect(() => {
    const updateStores = () => {
      const all = registry.getAll();
      setStores(all);
      if (!selectedStoreId && all.length > 0) {
        setSelectedStoreId(all[0].id);
      }
    };
    updateStores();
    return registry.subscribe(() => updateStores());
  }, [selectedStoreId]);

  // Subscribe to state updates for rerender
  useEffect(() => {
    if (!selectedStoreId) return;
    const entry = registry.get(selectedStoreId);
    if (!entry) return;

    const unsub = entry.store.subscribe(() => {
      forceUpdate((n) => n + 1);
    });
    return unsub;
  }, [selectedStoreId]);

  // Hotkey listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const parts = hotkey.toLowerCase().split('+');
      const key = parts.pop();
      const ctrl = parts.includes('ctrl');
      const shift = parts.includes('shift');
      const alt = parts.includes('alt');
      const meta = parts.includes('meta');

      if (
        e.key.toLowerCase() === key &&
        e.ctrlKey === ctrl &&
        e.shiftKey === shift &&
        e.altKey === alt &&
        e.metaKey === meta
      ) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hotkey]);

  const selectedStore = selectedStoreId ? registry.get(selectedStoreId) : null;

  const positionStyles: Record<string, React.CSSProperties> = {
    'bottom-right': { bottom: 0, right: 0 },
    'bottom-left': { bottom: 0, left: 0 },
    'top-right': { top: 0, right: 0 },
    'top-left': { top: 0, left: 0 },
  };

  // Only render in development
  if (typeof globalThis !== 'undefined' && (globalThis as any).process?.env?.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        ...positionStyles[position],
        zIndex: 99999,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '13px',
        color: '#e4e4e7',
      }}
    >
      {/* Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            ...positionStyles[position],
            position: 'fixed',
            margin: '16px',
            padding: '8px 12px',
            background: '#18181b',
            color: '#a1a1aa',
            border: '1px solid #27272a',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '12px',
            zIndex: 99999,
          }}
        >
          State SDK
        </button>
      )}

      {/* Panel */}
      {isOpen && (
        <div
          style={{
            width: '480px',
            height: '420px',
            background: '#09090b',
            border: '1px solid #27272a',
            borderRadius: position.includes('bottom') ? '12px 12px 0 0' : '0 0 12px 12px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              borderBottom: '1px solid #27272a',
              background: '#18181b',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 600, color: '#fafafa', fontSize: '13px' }}>
                State SDK
              </span>
              {/* Store selector */}
              <select
                value={selectedStoreId || ''}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                style={{
                  background: '#27272a',
                  color: '#e4e4e7',
                  border: '1px solid #3f3f46',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  fontSize: '12px',
                }}
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#71717a',
                cursor: 'pointer',
                fontSize: '16px',
                padding: '0 4px',
              }}
            >
              x
            </button>
          </div>

          {/* Tabs */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid #27272a',
              background: '#18181b',
            }}
          >
            {(['state', 'timeline', 'branches', 'mock'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: '6px 0',
                  background: activeTab === tab ? '#27272a' : 'transparent',
                  color: activeTab === tab ? '#fafafa' : '#71717a',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: activeTab === tab ? 600 : 400,
                  textTransform: 'capitalize',
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
            {selectedStore && activeTab === 'state' && (
              <StateTreePanel store={selectedStore} />
            )}
            {selectedStore && activeTab === 'timeline' && (
              <TimelinePanel store={selectedStore} />
            )}
            {selectedStore && activeTab === 'branches' && (
              <BranchesPanel store={selectedStore} />
            )}
            {selectedStore && activeTab === 'mock' && (
              <MockPanel store={selectedStore} />
            )}
            {!selectedStore && (
              <div style={{ color: '#71717a', padding: '20px', textAlign: 'center' }}>
                No stores registered yet.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// StateTree Panel
// ============================================

function StateTreePanel({ store }: { store: StoreRegistryEntry }) {
  const state = store.store.getState() as Record<string, unknown>;
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleEdit = (key: string) => {
    setEditKey(key);
    setEditValue(JSON.stringify(state[key], null, 2));
  };

  const handleSave = () => {
    if (!editKey) return;
    try {
      const parsed = JSON.parse(editValue);
      store.store.setState({ [editKey]: parsed } as any);
      setEditKey(null);
    } catch {
      // invalid JSON, don't save
    }
  };

  return (
    <div>
      {Object.entries(state).map(([key, value]) => {
        if (typeof value === 'function') return null;

        return (
          <div
            key={key}
            style={{
              marginBottom: '4px',
              padding: '4px 8px',
              background: '#18181b',
              borderRadius: '4px',
              border: '1px solid #27272a',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ color: '#60a5fa', fontWeight: 500 }}>{key}</span>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <span style={{ color: '#a1a1aa', fontSize: '12px' }}>
                  {typeof value === 'object'
                    ? JSON.stringify(value).slice(0, 40) + (JSON.stringify(value).length > 40 ? '...' : '')
                    : String(value)}
                </span>
                <button
                  onClick={() => handleEdit(key)}
                  style={{
                    background: '#27272a',
                    border: '1px solid #3f3f46',
                    borderRadius: '3px',
                    color: '#a1a1aa',
                    cursor: 'pointer',
                    fontSize: '10px',
                    padding: '1px 4px',
                  }}
                >
                  edit
                </button>
              </div>
            </div>
            {editKey === key && (
              <div style={{ marginTop: '4px' }}>
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: '60px',
                    background: '#09090b',
                    color: '#e4e4e7',
                    border: '1px solid #3f3f46',
                    borderRadius: '4px',
                    padding: '4px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    resize: 'vertical',
                  }}
                />
                <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                  <button onClick={handleSave} style={btnStyle}>
                    Save
                  </button>
                  <button onClick={() => setEditKey(null)} style={btnStyle}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// Timeline Panel
// ============================================

function TimelinePanel({ store }: { store: StoreRegistryEntry }) {
  const temporal = (store.store as any).temporal;
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!temporal) return;
    return temporal.subscribe(() => setTick((n: number) => n + 1));
  }, [temporal]);

  if (!temporal) {
    return <div style={{ color: '#71717a', textAlign: 'center', padding: '20px' }}>Timeline not enabled</div>;
  }

  const pos = temporal.position;
  const history = temporal.getHistory();
  const historyLen = history.length;

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', alignItems: 'center' }}>
        <button onClick={() => temporal.back()} disabled={!temporal.canBack()} style={btnStyle}>
          Undo
        </button>
        <button onClick={() => temporal.forward()} disabled={!temporal.canForward()} style={btnStyle}>
          Redo
        </button>
        <span style={{ color: '#71717a', fontSize: '12px', marginLeft: '8px' }}>
          Position: {pos} / {historyLen}
        </span>
        <button onClick={() => temporal.reset()} style={{ ...btnStyle, marginLeft: 'auto' }}>
          Reset
        </button>
      </div>

      {/* Slider */}
      {historyLen > 0 && (
        <input
          type="range"
          min={0}
          max={historyLen - 1}
          value={pos}
          onChange={(e) => temporal.go(parseInt(e.target.value))}
          style={{ width: '100%', marginBottom: '8px' }}
        />
      )}

      {/* Action log from inspector */}
      <InspectorLog store={store} />
    </div>
  );
}

// ============================================
// Inspector Action Log (inside Timeline panel)
// ============================================

function InspectorLog({ store }: { store: StoreRegistryEntry }) {
  const inspectorApi = (store.store as any).inspector;
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!inspectorApi) return;
    return inspectorApi.subscribe(() => setTick((n: number) => n + 1));
  }, [inspectorApi]);

  if (!inspectorApi) return null;

  const log = inspectorApi.getActionLog();

  return (
    <div style={{ maxHeight: '250px', overflow: 'auto' }}>
      {log.map((entry: any, i: number) => (
        <div
          key={entry.id}
          style={{
            padding: '4px 8px',
            marginBottom: '2px',
            background: '#18181b',
            borderRadius: '4px',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '12px',
            border: '1px solid transparent',
          }}
        >
          <span style={{ color: '#e4e4e7' }}>
            #{i + 1} {entry.actionName}
          </span>
          <span style={{ color: '#71717a' }}>
            {entry.patches.length} patch{entry.patches.length !== 1 ? 'es' : ''}
          </span>
        </div>
      ))}
      {log.length === 0 && (
        <div style={{ color: '#71717a', textAlign: 'center', padding: '20px' }}>
          No actions recorded yet.
        </div>
      )}
    </div>
  );
}

// ============================================
// Branches Panel
// ============================================

function BranchesPanel({ store }: { store: StoreRegistryEntry }) {
  const branchApi = (store.store as any).branch;
  const [, setTick] = useState(0);
  const [newBranchName, setNewBranchName] = useState('');
  const [diffResult, setDiffResult] = useState<any>(null);
  const [diffPair, setDiffPair] = useState<[string, string] | null>(null);

  useEffect(() => {
    if (!branchApi) return;
    return branchApi.subscribe(() => setTick((n: number) => n + 1));
  }, [branchApi]);

  if (!branchApi) {
    return <div style={{ color: '#71717a', textAlign: 'center', padding: '20px' }}>Branching not enabled</div>;
  }

  const branches = branchApi.list();
  const active = branchApi.active();

  const handleFork = () => {
    branchApi.fork(newBranchName || undefined);
    setNewBranchName('');
  };

  const handleDiff = (branchId: string) => {
    const result = branchApi.diff(active.id, branchId);
    setDiffResult(result);
    setDiffPair([active.name, branches.find((b: any) => b.id === branchId)?.name ?? branchId]);
  };

  return (
    <div>
      {/* Fork control */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        <input
          placeholder="Branch name..."
          value={newBranchName}
          onChange={(e) => setNewBranchName(e.target.value)}
          style={{
            flex: 1,
            background: '#18181b',
            color: '#e4e4e7',
            border: '1px solid #3f3f46',
            borderRadius: '4px',
            padding: '4px 8px',
            fontSize: '12px',
          }}
        />
        <button onClick={handleFork} style={btnStyle}>
          Fork
        </button>
      </div>

      {/* Branch list */}
      {branches.map((branch: any) => (
        <div
          key={branch.id}
          style={{
            padding: '6px 8px',
            marginBottom: '4px',
            background: branch.id === active.id ? '#1e3a5f' : '#18181b',
            border: branch.id === active.id ? '1px solid #3b82f6' : '1px solid #27272a',
            borderRadius: '4px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <span style={{ color: '#e4e4e7', fontWeight: branch.id === active.id ? 600 : 400 }}>
              {branch.name}
            </span>
            <span style={{ color: '#71717a', fontSize: '11px', marginLeft: '8px' }}>
              pos:{branch.currentPosition}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {branch.id !== active.id && (
              <>
                <button onClick={() => branchApi.switch(branch.id)} style={btnStyle}>
                  Switch
                </button>
                <button onClick={() => handleDiff(branch.id)} style={btnStyle}>
                  Diff
                </button>
                {branch.id !== 'main' && (
                  <button
                    onClick={() => branchApi.delete(branch.id)}
                    style={{ ...btnStyle, color: '#ef4444' }}
                  >
                    Del
                  </button>
                )}
              </>
            )}
            {branch.id === active.id && (
              <span style={{ color: '#3b82f6', fontSize: '11px' }}>active</span>
            )}
          </div>
        </div>
      ))}

      {/* Diff view */}
      {diffResult && diffPair && (
        <div
          style={{
            marginTop: '8px',
            padding: '8px',
            background: '#18181b',
            border: '1px solid #27272a',
            borderRadius: '4px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#fafafa', fontSize: '12px', fontWeight: 600 }}>
              Diff: {diffPair[0]} vs {diffPair[1]}
            </span>
            <button onClick={() => setDiffResult(null)} style={btnStyle}>
              Close
            </button>
          </div>
          {diffResult.changed.map((c: any, i: number) => (
            <div key={i} style={{ fontSize: '11px', marginBottom: '2px' }}>
              <span style={{ color: '#fbbf24' }}>{c.path.join('.')}</span>
              <span style={{ color: '#ef4444', marginLeft: '8px' }}>
                {JSON.stringify(c.from)}
              </span>
              <span style={{ color: '#71717a' }}>{' -> '}</span>
              <span style={{ color: '#22c55e' }}>{JSON.stringify(c.to)}</span>
            </div>
          ))}
          {diffResult.added.map((a: any, i: number) => (
            <div key={`a${i}`} style={{ fontSize: '11px', color: '#22c55e' }}>
              + {a.path.join('.')}: {JSON.stringify(a.value)}
            </div>
          ))}
          {diffResult.removed.map((r: any, i: number) => (
            <div key={`r${i}`} style={{ fontSize: '11px', color: '#ef4444' }}>
              - {r.path.join('.')}: {JSON.stringify(r.value)}
            </div>
          ))}
          {diffResult.changed.length === 0 &&
            diffResult.added.length === 0 &&
            diffResult.removed.length === 0 && (
              <div style={{ color: '#71717a', fontSize: '11px' }}>No differences</div>
            )}
        </div>
      )}
    </div>
  );
}

// ============================================
// Mock Panel
// ============================================

function MockPanel({ store }: { store: StoreRegistryEntry }) {
  const [jsonInput, setJsonInput] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const handleInject = () => {
    try {
      const data = JSON.parse(jsonInput);
      const current = store.store.getState();
      store.store.setState({ ...current, ...data }, true);
      setStatus('Injected successfully');
      setTimeout(() => setStatus(null), 2000);
    } catch {
      setStatus('Invalid JSON');
    }
  };

  const handleExport = () => {
    const state = store.store.getState() as Record<string, unknown>;
    const serializable: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(state)) {
      if (typeof v !== 'function') serializable[k] = v;
    }
    setJsonInput(JSON.stringify(serializable, null, 2));
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        <button onClick={handleExport} style={btnStyle}>
          Load Current State
        </button>
        <button onClick={handleInject} style={btnStyle}>
          Inject
        </button>
      </div>
      <textarea
        value={jsonInput}
        onChange={(e) => setJsonInput(e.target.value)}
        placeholder="Paste JSON to inject..."
        style={{
          width: '100%',
          minHeight: '200px',
          background: '#18181b',
          color: '#e4e4e7',
          border: '1px solid #3f3f46',
          borderRadius: '4px',
          padding: '8px',
          fontSize: '12px',
          fontFamily: 'monospace',
          resize: 'vertical',
        }}
      />
      {status && (
        <div
          style={{
            marginTop: '4px',
            fontSize: '12px',
            color: status.includes('success') ? '#22c55e' : '#ef4444',
          }}
        >
          {status}
        </div>
      )}
    </div>
  );
}

// ============================================
// Shared Styles
// ============================================

const btnStyle: React.CSSProperties = {
  background: '#27272a',
  color: '#e4e4e7',
  border: '1px solid #3f3f46',
  borderRadius: '4px',
  padding: '3px 8px',
  fontSize: '11px',
  cursor: 'pointer',
};
