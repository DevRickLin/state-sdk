import React, { useState } from 'react';
import { DevPanel } from '@vibe-stack/state-sdk-react';
import { useCounterStore } from './stores/counter';
import { useTodoStore } from './stores/todo';

export function App() {
  return (
    <div style={{ fontFamily: 'system-ui', maxWidth: 600, margin: '40px auto', padding: '0 20px' }}>
      <h1>State SDK Demo</h1>
      <p style={{ color: '#666' }}>
        Open the DevPanel (bottom-right corner or <kbd>Ctrl+Shift+D</kbd>) to inspect state,
        time travel, create branches, and inject mock data.
      </p>

      <CounterDemo />
      <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid #eee' }} />
      <TodoDemo />

      {/* DevPanel — the magic happens here */}
      <DevPanel />
    </div>
  );
}

function CounterDemo() {
  const count = useCounterStore((s) => s.count);
  const increment = useCounterStore((s) => s.increment);
  const decrement = useCounterStore((s) => s.decrement);
  const reset = useCounterStore((s) => s.reset);

  return (
    <div>
      <h2>Counter</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={decrement}>-</button>
        <span style={{ fontSize: 24, fontWeight: 'bold', minWidth: 40, textAlign: 'center' }}>
          {count}
        </span>
        <button onClick={increment}>+</button>
        <button onClick={reset} style={{ marginLeft: 12 }}>Reset</button>
      </div>
    </div>
  );
}

function TodoDemo() {
  const todos = useTodoStore((s) => s.todos);
  const filter = useTodoStore((s) => s.filter);
  const addTodo = useTodoStore((s) => s.addTodo);
  const toggleTodo = useTodoStore((s) => s.toggleTodo);
  const removeTodo = useTodoStore((s) => s.removeTodo);
  const setFilter = useTodoStore((s) => s.setFilter);

  const [input, setInput] = useState('');

  const filtered = todos.filter((t) => {
    if (filter === 'active') return !t.done;
    if (filter === 'done') return t.done;
    return true;
  });

  const handleAdd = () => {
    if (input.trim()) {
      addTodo(input.trim());
      setInput('');
    }
  };

  return (
    <div>
      <h2>Todos</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Add todo..."
          style={{ flex: 1, padding: '4px 8px' }}
        />
        <button onClick={handleAdd}>Add</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {(['all', 'active', 'done'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              fontWeight: filter === f ? 'bold' : 'normal',
              textDecoration: filter === f ? 'underline' : 'none',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {filtered.map((todo) => (
          <li key={todo.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <input
              type="checkbox"
              checked={todo.done}
              onChange={() => toggleTodo(todo.id)}
            />
            <span style={{ textDecoration: todo.done ? 'line-through' : 'none', flex: 1 }}>
              {todo.text}
            </span>
            <button onClick={() => removeTodo(todo.id)} style={{ fontSize: 12, color: '#999' }}>
              x
            </button>
          </li>
        ))}
      </ul>

      {todos.length === 0 && <p style={{ color: '#999' }}>No todos yet.</p>}
    </div>
  );
}
