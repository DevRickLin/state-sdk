import { describe, it, expect, beforeEach } from 'vitest';
import { registry } from '../registry';
import type { EnhancedStoreApi } from '../types';

function makeFakeStore(id: string, name: string): EnhancedStoreApi<any> {
  return {
    __id: id,
    __name: name,
    getState: () => ({}),
    setState: () => {},
    subscribe: () => () => {},
    getInitialState: () => ({}),
    temporal: {} as any,
    branch: {} as any,
    inspector: {} as any,
  };
}

describe('StoreRegistry', () => {
  beforeEach(() => {
    registry.clear();
  });

  it('should register and retrieve a store', () => {
    const store = makeFakeStore('s1', 'counter');
    registry.register(store);

    expect(registry.size).toBe(1);
    expect(registry.get('s1')?.name).toBe('counter');
  });

  it('should find store by name', () => {
    const store = makeFakeStore('s1', 'counter');
    registry.register(store);

    expect(registry.getByName('counter')?.id).toBe('s1');
    expect(registry.getByName('nonexistent')).toBeUndefined();
  });

  it('should unregister a store', () => {
    const store = makeFakeStore('s1', 'counter');
    registry.register(store);
    registry.unregister('s1');

    expect(registry.size).toBe(0);
    expect(registry.get('s1')).toBeUndefined();
  });

  it('should notify listeners on register/unregister', () => {
    const events: string[] = [];
    registry.subscribe((event, entry) => {
      events.push(`${event}:${entry.name}`);
    });

    const store = makeFakeStore('s1', 'counter');
    registry.register(store);
    registry.unregister('s1');

    expect(events).toEqual(['register:counter', 'unregister:counter']);
  });

  it('should list all stores', () => {
    registry.register(makeFakeStore('s1', 'counter'));
    registry.register(makeFakeStore('s2', 'todo'));

    const all = registry.getAll();
    expect(all.length).toBe(2);
    expect(all.map((e) => e.name).sort()).toEqual(['counter', 'todo']);
  });
});
