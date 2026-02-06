import { describe, it, expect } from 'vitest';
import { generateId, deepClone, deepDiff, extractActionName } from '../utils';

describe('generateId', () => {
  it('should generate unique ids', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

describe('deepClone', () => {
  it('should deep clone objects', () => {
    const obj = { a: 1, b: { c: [1, 2, 3] } };
    const cloned = deepClone(obj);
    expect(cloned).toEqual(obj);
    expect(cloned).not.toBe(obj);
    expect(cloned.b).not.toBe(obj.b);
    expect(cloned.b.c).not.toBe(obj.b.c);
  });
});

describe('deepDiff', () => {
  it('should detect added keys', () => {
    const diff = deepDiff({ a: 1 }, { a: 1, b: 2 });
    expect(diff.added).toEqual([{ path: ['b'], value: 2 }]);
    expect(diff.removed).toEqual([]);
    expect(diff.changed).toEqual([]);
  });

  it('should detect removed keys', () => {
    const diff = deepDiff({ a: 1, b: 2 }, { a: 1 });
    expect(diff.removed).toEqual([{ path: ['b'], value: 2 }]);
  });

  it('should detect changed values', () => {
    const diff = deepDiff({ a: 1 }, { a: 2 });
    expect(diff.changed).toEqual([{ path: ['a'], from: 1, to: 2 }]);
  });

  it('should handle nested objects', () => {
    const diff = deepDiff(
      { user: { name: 'Alice', age: 30 } },
      { user: { name: 'Bob', age: 30 } }
    );
    expect(diff.changed).toEqual([{ path: ['user', 'name'], from: 'Alice', to: 'Bob' }]);
  });

  it('should detect no differences for equal objects', () => {
    const diff = deepDiff({ a: 1, b: { c: 3 } }, { a: 1, b: { c: 3 } });
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.changed).toEqual([]);
  });
});

describe('extractActionName', () => {
  it('should extract function name', () => {
    function increment() {}
    expect(extractActionName(increment)).toBe('increment');
  });

  it('should handle anonymous functions', () => {
    expect(extractActionName(() => {})).toBe('anonymous');
  });

  it('should handle object partials', () => {
    expect(extractActionName({ count: 1 })).toBe('set(count)');
    expect(extractActionName({ a: 1, b: 2 })).toBe('set(a, b)');
  });
});
