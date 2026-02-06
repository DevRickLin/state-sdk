import { create } from '@anthropic/state-sdk';

interface Todo {
  id: string;
  text: string;
  done: boolean;
}

interface TodoState {
  todos: Todo[];
  filter: 'all' | 'active' | 'done';
  addTodo: (text: string) => void;
  toggleTodo: (id: string) => void;
  removeTodo: (id: string) => void;
  setFilter: (filter: 'all' | 'active' | 'done') => void;
}

export const useTodoStore = create<TodoState>((set) => ({
  todos: [],
  filter: 'all',
  addTodo: (text: string) =>
    set((state) => {
      state.todos.push({
        id: Date.now().toString(36),
        text,
        done: false,
      });
    }),
  toggleTodo: (id: string) =>
    set((state) => {
      const todo = state.todos.find((t) => t.id === id);
      if (todo) todo.done = !todo.done;
    }),
  removeTodo: (id: string) =>
    set((state) => {
      state.todos = state.todos.filter((t) => t.id !== id);
    }),
  setFilter: (filter) => set({ filter }),
}), {
  name: 'todo',
});
