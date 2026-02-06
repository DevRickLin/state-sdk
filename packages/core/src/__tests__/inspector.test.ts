import { describe, it, expect, beforeEach } from 'vitest';
import { create } from '../createStore';
import { registry } from '../registry';

beforeEach(() => {
  registry.clear();
});

describe('inspector middleware', () => {
  function createCounter() {
    return create<{ count: number; increment: () => void }>(
      (set) => ({
        count: 0,
        increment: () => set((draft: any) => { draft.count += 1; }),
      }),
      { name: 'counter', devtools: false }
    );
  }

  it('should log actions on set()', () => {
    const useStore = createCounter();
    const api = useStore as any;

    useStore.getState().increment();
    useStore.getState().increment();

    const log = api.inspector.getActionLog();
    expect(log.length).toBe(2);
  });

  it('should record action names', () => {
    const useStore = createCounter();
    const api = useStore as any;

    useStore.getState().increment();

    const log = api.inspector.getActionLog();
    expect(log[0].actionName).toBeDefined();
    expect(typeof log[0].actionName).toBe('string');
  });

  it('should record patches', () => {
    const useStore = createCounter();
    const api = useStore as any;

    useStore.getState().increment();

    const log = api.inspector.getActionLog();
    expect(Array.isArray(log[0].patches)).toBe(true);
  });

  it('should record timestamps', () => {
    const useStore = createCounter();
    const api = useStore as any;

    useStore.getState().increment();

    const log = api.inspector.getActionLog();
    expect(typeof log[0].timestamp).toBe('number');
    expect(log[0].timestamp).toBeGreaterThan(0);
  });

  it('should record unique ids', () => {
    const useStore = createCounter();
    const api = useStore as any;

    useStore.getState().increment();
    useStore.getState().increment();

    const log = api.inspector.getActionLog();
    expect(log[0].id).not.toBe(log[1].id);
  });

  it('should clear the action log', () => {
    const useStore = createCounter();
    const api = useStore as any;

    useStore.getState().increment();
    expect(api.inspector.getActionLog().length).toBe(1);

    api.inspector.clear();
    expect(api.inspector.getActionLog().length).toBe(0);
  });

  it('should subscribe to new log entries', () => {
    const useStore = createCounter();
    const api = useStore as any;

    const entries: any[] = [];
    api.inspector.subscribe((entry: any) => {
      entries.push(entry);
    });

    useStore.getState().increment();
    expect(entries.length).toBe(1);
    expect(entries[0].actionName).toBeDefined();
  });

  it('should limit log entries to MAX_LOG_ENTRIES', () => {
    const useStore = create<{ count: number }>(
      (set) => ({ count: 0 }),
      { name: 'limit-test', devtools: false }
    );
    const api = useStore as any;

    // Push more than 200 entries
    for (let i = 0; i < 210; i++) {
      useStore.setState({ count: i });
    }

    const log = api.inspector.getActionLog();
    expect(log.length).toBeLessThanOrEqual(200);
  });
});
