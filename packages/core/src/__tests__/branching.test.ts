import { describe, it, expect, beforeEach } from 'vitest';
import { create } from '../createStore';
import { registry } from '../registry';

beforeEach(() => {
  registry.clear();
});

describe('branching middleware', () => {
  function createCounter() {
    return create<{ count: number; increment: () => void }>(
      (set) => ({
        count: 0,
        increment: () => set((draft: any) => { draft.count += 1; }),
      }),
      { name: 'counter', devtools: false }
    );
  }

  it('should start with main branch', async () => {
    const useStore = createCounter();
    const api = useStore as any;

    // Wait for queueMicrotask to initialize main branch
    await new Promise((r) => queueMicrotask(r));

    const branches = api.branch.list();
    expect(branches.length).toBe(1);
    expect(branches[0].name).toBe('main');
  });

  it('should fork a new branch', async () => {
    const useStore = createCounter();
    const api = useStore as any;
    await new Promise((r) => queueMicrotask(r));

    const newBranch = api.branch.fork('experiment');
    expect(newBranch.name).toBe('experiment');

    const branches = api.branch.list();
    expect(branches.length).toBe(2);
  });

  it('should fork with auto-generated name', async () => {
    const useStore = createCounter();
    const api = useStore as any;
    await new Promise((r) => queueMicrotask(r));

    const newBranch = api.branch.fork();
    expect(newBranch.name).toMatch(/^branch-/);
  });

  it('should switch between branches', async () => {
    const useStore = createCounter();
    const api = useStore as any;
    await new Promise((r) => queueMicrotask(r));

    // Increment on main
    useStore.getState().increment();
    expect(useStore.getState().count).toBe(1);

    // Fork and switch to new branch
    const branch = api.branch.fork('experiment');

    // On the new branch, the state should match main's state at fork time
    api.branch.switch(branch.id);
    expect(useStore.getState().count).toBe(1);

    // Increment on experiment branch
    useStore.getState().increment();
    expect(useStore.getState().count).toBe(2);

    // Switch back to main — should restore main's state
    api.branch.switch('main');
    expect(useStore.getState().count).toBe(1);
  });

  it('should report active branch', async () => {
    const useStore = createCounter();
    const api = useStore as any;
    await new Promise((r) => queueMicrotask(r));

    expect(api.branch.active().name).toBe('main');

    const branch = api.branch.fork('dev');
    api.branch.switch(branch.id);
    expect(api.branch.active().name).toBe('dev');
  });

  it('should diff branches', async () => {
    const useStore = createCounter();
    const api = useStore as any;
    await new Promise((r) => queueMicrotask(r));

    useStore.getState().increment();
    const branch = api.branch.fork('experiment');
    api.branch.switch(branch.id);

    // Change state on experiment
    useStore.getState().increment();
    useStore.getState().increment();

    const diff = api.branch.diff('main', branch.id);
    expect(diff.changed.length).toBeGreaterThanOrEqual(1);
    // count should differ: main=1, experiment=3
    const countChange = diff.changed.find((c: any) => c.path.includes('count'));
    expect(countChange).toBeDefined();
  });

  it('should delete a branch', async () => {
    const useStore = createCounter();
    const api = useStore as any;
    await new Promise((r) => queueMicrotask(r));

    const branch = api.branch.fork('temp');
    expect(api.branch.list().length).toBe(2);

    api.branch.delete(branch.id);
    expect(api.branch.list().length).toBe(1);
  });

  it('should not delete main branch', async () => {
    const useStore = createCounter();
    const api = useStore as any;
    await new Promise((r) => queueMicrotask(r));

    expect(() => api.branch.delete('main')).toThrow('Cannot delete the main branch');
  });

  it('should not delete active branch', async () => {
    const useStore = createCounter();
    const api = useStore as any;
    await new Promise((r) => queueMicrotask(r));

    const branch = api.branch.fork('active-test');
    api.branch.switch(branch.id);

    expect(() => api.branch.delete(branch.id)).toThrow('Cannot delete the active branch');
  });

  it('should rename a branch', async () => {
    const useStore = createCounter();
    const api = useStore as any;
    await new Promise((r) => queueMicrotask(r));

    const branch = api.branch.fork('old-name');
    api.branch.rename(branch.id, 'new-name');

    const found = api.branch.list().find((b: any) => b.id === branch.id);
    expect(found.name).toBe('new-name');
  });

  it('should notify subscribers on changes', async () => {
    const useStore = createCounter();
    const api = useStore as any;
    await new Promise((r) => queueMicrotask(r));

    let callCount = 0;
    api.branch.subscribe(() => { callCount++; });

    api.branch.fork('test');
    expect(callCount).toBeGreaterThanOrEqual(1);
  });
});
