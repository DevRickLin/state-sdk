import { create } from '@anthropic/state-sdk';

interface CounterState {
  count: number;
  history: number[];
  increment: () => void;
  decrement: () => void;
  reset: () => void;
  setCount: (n: number) => void;
}

export const useCounterStore = create<CounterState>((set) => ({
  count: 0,
  history: [],
  increment: () =>
    set((state) => {
      state.history.push(state.count);
      state.count += 1;
    }),
  decrement: () =>
    set((state) => {
      state.history.push(state.count);
      state.count -= 1;
    }),
  reset: () => set({ count: 0, history: [] }),
  setCount: (n: number) =>
    set((state) => {
      state.history.push(state.count);
      state.count = n;
    }),
}), {
  name: 'counter',
});
