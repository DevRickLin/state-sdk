import { describe, it, expect, beforeEach } from 'vitest';
import { create } from '../createStore';
import { registry } from '../registry';

beforeEach(() => {
  registry.clear();
});

describe('create', () => {
  it('should create a store with initial state', () => {
    const useStore = create<{ count: number; increment: () => void }>(
      (set) => ({
        count: 0,
        increment: () => set((draft: any) => { draft.count += 1; }),
      }),
      { name: 'counter', devtools: false }
    );

    expect(useStore.getState().count).toBe(0);
  });

  it('should register the store in the registry', () => {
    create(
      (set) => ({ count: 0 }),
      { name: 'test-store', devtools: false }
    );

    expect(registry.size).toBe(1);
    expect(registry.getByName('test-store')).toBeDefined();
  });

  it('should attach temporal API to the store', () => {
    const useStore = create(
      (set) => ({ count: 0 }),
      { name: 'temporal-test', devtools: false }
    );

    const api = useStore as any;
    expect(api.temporal).toBeDefined();
    expect(typeof api.temporal.back).toBe('function');
    expect(typeof api.temporal.forward).toBe('function');
    expect(typeof api.temporal.go).toBe('function');
  });

  it('should attach branch API to the store', () => {
    const useStore = create(
      (set) => ({ count: 0 }),
      { name: 'branch-test', devtools: false }
    );

    const api = useStore as any;
    expect(api.branch).toBeDefined();
    expect(typeof api.branch.fork).toBe('function');
    expect(typeof api.branch.switch).toBe('function');
    expect(typeof api.branch.list).toBe('function');
  });

  it('should attach inspector API to the store', () => {
    const useStore = create(
      (set) => ({ count: 0 }),
      { name: 'inspector-test', devtools: false }
    );

    const api = useStore as any;
    expect(api.inspector).toBeDefined();
    expect(typeof api.inspector.getActionLog).toBe('function');
  });

  it('should support partial updates via set()', () => {
    const useStore = create<{ count: number; name: string }>(
      (set) => ({
        count: 0,
        name: 'hello',
      }),
      { name: 'partial-test', devtools: false }
    );

    useStore.setState({ count: 5 });
    expect(useStore.getState().count).toBe(5);
  });

  it('should support mutation-style updaters via set()', () => {
    const useStore = create<{ count: number; increment: () => void }>(
      (set) => ({
        count: 0,
        increment: () => set((draft: any) => { draft.count += 1; }),
      }),
      { name: 'mutation-test', devtools: false }
    );

    useStore.getState().increment();
    expect(useStore.getState().count).toBe(1);
  });

  it('should work with timeline disabled', () => {
    const useStore = create(
      (set) => ({ count: 0 }),
      { name: 'no-timeline', timeline: false, devtools: false }
    );

    const api = useStore as any;
    expect(api.temporal).toBeDefined();
    // noop temporal should not crash
    api.temporal.back();
    expect(api.temporal.canBack()).toBe(false);
  });

  it('should work with branching disabled', () => {
    const useStore = create(
      (set) => ({ count: 0 }),
      { name: 'no-branching', branching: false, devtools: false }
    );

    const api = useStore as any;
    expect(api.branch).toBeDefined();
    expect(api.branch.list().length).toBe(1); // noop main
  });
});
