let counter = 0;

/** Generate a simple unique ID */
export function generateId(): string {
  return `${Date.now().toString(36)}_${(counter++).toString(36)}`;
}

/** Deep clone a plain object via structured clone */
export function deepClone<T>(obj: T): T {
  return structuredClone(obj);
}

/** Extract a human-readable action name from a set() call */
export function extractActionName(partial: unknown): string {
  if (typeof partial === 'function') {
    return partial.name || 'anonymous';
  }
  if (typeof partial === 'object' && partial !== null) {
    const keys = Object.keys(partial);
    return keys.length > 0 ? `set(${keys.join(', ')})` : 'set()';
  }
  return 'set()';
}

/**
 * Separate state data from action functions.
 * Pattern from zustand-travel: only data gets tracked, functions are preserved.
 */
export function separateStateAndActions<T extends Record<string, any>>(
  obj: T
): { state: Partial<T>; actions: Partial<T> } {
  const state: Partial<T> = {};
  const actions: Partial<T> = {};

  for (const key in obj) {
    if (typeof obj[key] === 'function') {
      actions[key] = obj[key];
    } else {
      state[key] = obj[key];
    }
  }

  return { state, actions };
}

/** Deep diff two plain objects, returning paths of differences */
export function deepDiff(
  objA: Record<string, unknown>,
  objB: Record<string, unknown>,
  parentPath: string[] = []
): {
  added: Array<{ path: string[]; value: unknown }>;
  removed: Array<{ path: string[]; value: unknown }>;
  changed: Array<{ path: string[]; from: unknown; to: unknown }>;
} {
  const added: Array<{ path: string[]; value: unknown }> = [];
  const removed: Array<{ path: string[]; value: unknown }> = [];
  const changed: Array<{ path: string[]; from: unknown; to: unknown }> = [];

  const allKeys = new Set([...Object.keys(objA), ...Object.keys(objB)]);

  for (const key of allKeys) {
    const path = [...parentPath, key];
    const inA = key in objA;
    const inB = key in objB;
    const valA = objA[key];
    const valB = objB[key];

    if (!inA && inB) {
      added.push({ path, value: valB });
    } else if (inA && !inB) {
      removed.push({ path, value: valA });
    } else if (
      typeof valA === 'object' &&
      valA !== null &&
      typeof valB === 'object' &&
      valB !== null &&
      !Array.isArray(valA) &&
      !Array.isArray(valB)
    ) {
      const nested = deepDiff(
        valA as Record<string, unknown>,
        valB as Record<string, unknown>,
        path
      );
      added.push(...nested.added);
      removed.push(...nested.removed);
      changed.push(...nested.changed);
    } else if (!Object.is(valA, valB)) {
      changed.push({ path, from: valA, to: valB });
    }
  }

  return { added, removed, changed };
}
