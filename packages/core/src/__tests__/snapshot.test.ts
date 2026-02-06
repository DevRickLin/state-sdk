import { describe, it, expect, beforeEach } from 'vitest';
import { registry } from '../registry';
import { snapshot } from '../snapshot';
import type { EnhancedStoreApi } from '../types';

function makeFakeStore(id: string, name: string, initialState: Record<string, unknown>): EnhancedStoreApi<any> {
  let state = { ...initialState };
  return {
    __id: id,
    __name: name,
    getState: () => state,
    setState: (newState: any, replace?: boolean) => {
      if (replace) {
        state = { ...newState };
      } else {
        state = { ...state, ...newState };
      }
    },
    subscribe: () => () => {},
    getInitialState: () => initialState,
    temporal: {} as any,
    branch: {} as any,
    inspector: {} as any,
  };
}

describe('snapshot', () => {
  beforeEach(() => {
    registry.clear();
  });

  it('should export a single store state', () => {
    const store = makeFakeStore('s1', 'counter', { count: 5 });
    const data = snapshot.export(store);
    expect(data).toEqual({ count: 5 });
  });

  it('should export all stores', () => {
    const s1 = makeFakeStore('s1', 'counter', { count: 5 });
    const s2 = makeFakeStore('s2', 'todo', { items: ['a', 'b'] });
    registry.register(s1);
    registry.register(s2);

    const data = snapshot.exportAll();
    expect(data.version).toBe(1);
    expect(data.stores.counter).toEqual({ count: 5 });
    expect(data.stores.todo).toEqual({ items: ['a', 'b'] });
  });

  it('should import into a single store', () => {
    const store = makeFakeStore('s1', 'counter', { count: 0 });
    snapshot.import(store, { count: 42 });
    expect(store.getState().count).toBe(42);
  });

  it('should import all stores', () => {
    const s1 = makeFakeStore('s1', 'counter', { count: 0 });
    const s2 = makeFakeStore('s2', 'todo', { items: [] });
    registry.register(s1);
    registry.register(s2);

    snapshot.importAll({
      version: 1,
      timestamp: Date.now(),
      stores: {
        counter: { count: 99 },
        todo: { items: ['x'] },
      },
    });

    expect(s1.getState().count).toBe(99);
    expect(s2.getState().items).toEqual(['x']);
  });

  it('should stringify and parse', () => {
    const s1 = makeFakeStore('s1', 'counter', { count: 5 });
    registry.register(s1);

    const json = snapshot.stringify();
    const parsed = snapshot.parse(json);
    expect(parsed.stores.counter).toEqual({ count: 5 });
  });
});
