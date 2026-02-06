import { describe, it, expect, beforeEach } from 'vitest';
import { create } from '../createStore';
import { registry } from '../registry';

beforeEach(() => {
  registry.clear();
});

describe('timeline middleware', () => {
  function createCounter() {
    return create<{ count: number; increment: () => void; set: (n: number) => void }>(
      (set) => ({
        count: 0,
        increment: () => set((draft: any) => { draft.count += 1; }),
        set: (n: number) => set({ count: n }),
      }),
      { name: 'counter', devtools: false }
    );
  }

  it('should track state changes and support undo', () => {
    const useStore = createCounter();
    const api = useStore as any;

    useStore.getState().increment();
    expect(useStore.getState().count).toBe(1);

    useStore.getState().increment();
    expect(useStore.getState().count).toBe(2);

    api.temporal.back();
    expect(useStore.getState().count).toBe(1);
  });

  it('should support redo after undo', () => {
    const useStore = createCounter();
    const api = useStore as any;

    useStore.getState().increment();
    useStore.getState().increment();
    expect(useStore.getState().count).toBe(2);

    api.temporal.back();
    expect(useStore.getState().count).toBe(1);

    api.temporal.forward();
    expect(useStore.getState().count).toBe(2);
  });

  it('should support go() to arbitrary position', () => {
    const useStore = createCounter();
    const api = useStore as any;

    useStore.getState().increment(); // count=1, pos=1
    useStore.getState().increment(); // count=2, pos=2
    useStore.getState().increment(); // count=3, pos=3

    api.temporal.go(0); // back to initial state
    expect(useStore.getState().count).toBe(0);

    api.temporal.go(2); // jump to position 2
    expect(useStore.getState().count).toBe(2);
  });

  it('should report canBack and canForward correctly', () => {
    const useStore = createCounter();
    const api = useStore as any;

    expect(api.temporal.canBack()).toBe(false);
    expect(api.temporal.canForward()).toBe(false);

    useStore.getState().increment();
    expect(api.temporal.canBack()).toBe(true);
    expect(api.temporal.canForward()).toBe(false);

    api.temporal.back();
    expect(api.temporal.canBack()).toBe(false);
    expect(api.temporal.canForward()).toBe(true);
  });

  it('should track position correctly', () => {
    const useStore = createCounter();
    const api = useStore as any;

    expect(api.temporal.position).toBe(0);

    useStore.getState().increment();
    expect(api.temporal.position).toBe(1);

    useStore.getState().increment();
    expect(api.temporal.position).toBe(2);

    api.temporal.back();
    expect(api.temporal.position).toBe(1);
  });

  it('should provide getHistory()', () => {
    const useStore = createCounter();
    const api = useStore as any;

    useStore.getState().increment();
    useStore.getState().increment();

    const history = api.temporal.getHistory();
    expect(history.length).toBeGreaterThanOrEqual(3); // initial + 2 changes
  });

  it('should support partial updates', () => {
    const useStore = createCounter();
    const api = useStore as any;

    useStore.getState().set(10);
    expect(useStore.getState().count).toBe(10);

    api.temporal.back();
    expect(useStore.getState().count).toBe(0);
  });

  it('should support reset()', () => {
    const useStore = createCounter();
    const api = useStore as any;

    useStore.getState().increment();
    useStore.getState().increment();
    expect(useStore.getState().count).toBe(2);

    api.temporal.reset();
    expect(useStore.getState().count).toBe(0);
  });

  it('should subscribe to timeline changes', () => {
    const useStore = createCounter();
    const api = useStore as any;

    let callCount = 0;
    const unsub = api.temporal.subscribe(() => { callCount++; });

    useStore.getState().increment();
    // The subscription fires on travels state changes (undo/redo/go),
    // not necessarily on every set(). Let's trigger an undo.
    api.temporal.back();
    expect(callCount).toBeGreaterThanOrEqual(1);

    unsub();
  });
});
