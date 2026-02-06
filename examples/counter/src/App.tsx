import React, { useState, useEffect } from 'react';
import { DevPanel } from '@vibe-stack/state-sdk-react';
import { useCounterStore } from './stores/counter';
import { useTodoStore } from './stores/todo';

const isEmbedded = window.self !== window.top;

export function App() {
  return (
    <div style={{ minHeight: '100dvh', background: '#09090b', color: '#fafafa' }}>
      {/* Header — hidden when embedded in iframe */}
      {!isEmbedded && (
        <header style={{
          padding: '16px 20px',
          borderBottom: '1px solid #27272a',
          background: '#18181b',
        }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>
            vibe-stack<span style={{ color: '#3b82f6' }}>/</span>state-sdk
          </h1>
          <p style={{ fontSize: 13, color: '#71717a', marginTop: 4 }}>
            Time Travel + State Branching + DevPanel
          </p>
        </header>
      )}

      <main style={{ padding: '16px 20px', maxWidth: 600, margin: '0 auto' }}>
        <CounterDemo />
        <div style={{ height: 1, background: '#27272a', margin: '20px 0' }} />
        <TodoDemo />

        {/* Hint — hidden when embedded */}
        {!isEmbedded && (
          <div style={{
            marginTop: 24,
            padding: '12px 16px',
            background: '#1e1b4b',
            border: '1px solid #312e81',
            borderRadius: 12,
            fontSize: 13,
            color: '#a5b4fc',
            lineHeight: 1.5,
          }}>
            <strong>Try it:</strong> Click the <span style={{
              background: '#27272a', padding: '2px 6px', borderRadius: 4,
              border: '1px solid #3f3f46', color: '#e4e4e7', fontSize: 12
            }}>State SDK</span> button at the bottom-right to open the DevPanel.
            Use <strong>Timeline</strong> to undo/redo, <strong>Branches</strong> to fork state,
            and <strong>Mock</strong> to inject data.
          </div>
        )}
      </main>

      {/* DevPanel — hidden when embedded */}
      {!isEmbedded && <DevPanel position="bottom-right" />}
    </div>
  );
}

// ============================================
// Counter
// ============================================

function CounterDemo() {
  const count = useCounterStore((s) => s.count);
  const increment = useCounterStore((s) => s.increment);
  const decrement = useCounterStore((s) => s.decrement);
  const reset = useCounterStore((s) => s.reset);

  return (
    <section>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: '#a1a1aa', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Counter
      </h2>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 16, padding: '20px 0',
      }}>
        <Button onClick={decrement} size="lg">-</Button>
        <span style={{
          fontSize: 48, fontWeight: 800, minWidth: 80, textAlign: 'center',
          fontVariantNumeric: 'tabular-nums',
          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          {count}
        </span>
        <Button onClick={increment} size="lg">+</Button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Button onClick={reset} variant="ghost">Reset Counter</Button>
      </div>
    </section>
  );
}

// ============================================
// Todos
// ============================================

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
    <section>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: '#a1a1aa', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Todos
      </h2>

      {/* Input */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="What needs to be done?"
          style={{
            flex: 1, padding: '10px 14px', fontSize: 14,
            background: '#18181b', color: '#fafafa',
            border: '1px solid #27272a', borderRadius: 10,
            outline: 'none',
          }}
        />
        <Button onClick={handleAdd}>Add</Button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {(['all', 'active', 'done'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              flex: 1, padding: '8px 0', fontSize: 13,
              background: filter === f ? '#27272a' : 'transparent',
              color: filter === f ? '#fafafa' : '#71717a',
              border: filter === f ? '1px solid #3f3f46' : '1px solid transparent',
              borderRadius: 8,
              fontWeight: filter === f ? 600 : 400,
              cursor: 'pointer',
              textTransform: 'capitalize',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Todo list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {filtered.map((todo) => (
          <div key={todo.id} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 14px',
            background: '#18181b',
            border: '1px solid #27272a',
            borderRadius: 10,
          }}>
            <input
              type="checkbox"
              checked={todo.done}
              onChange={() => toggleTodo(todo.id)}
              style={{ width: 18, height: 18, accentColor: '#3b82f6', cursor: 'pointer' }}
            />
            <span style={{
              flex: 1, fontSize: 14,
              textDecoration: todo.done ? 'line-through' : 'none',
              color: todo.done ? '#52525b' : '#fafafa',
            }}>
              {todo.text}
            </span>
            <button
              onClick={() => removeTodo(todo.id)}
              style={{
                background: 'none', border: 'none',
                color: '#52525b', cursor: 'pointer',
                fontSize: 18, padding: '0 4px',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              x
            </button>
          </div>
        ))}
      </div>

      {todos.length === 0 && (
        <p style={{ color: '#52525b', textAlign: 'center', padding: 20, fontSize: 14 }}>
          No todos yet. Add one above.
        </p>
      )}
    </section>
  );
}

// ============================================
// Button component
// ============================================

function Button({ children, onClick, size, variant }: {
  children: React.ReactNode;
  onClick: () => void;
  size?: 'lg';
  variant?: 'ghost';
}) {
  const isLg = size === 'lg';
  const isGhost = variant === 'ghost';

  return (
    <button
      onClick={onClick}
      style={{
        padding: isLg ? '12px 20px' : '8px 16px',
        fontSize: isLg ? 20 : 14,
        fontWeight: 600,
        background: isGhost ? 'transparent' : '#27272a',
        color: isGhost ? '#71717a' : '#fafafa',
        border: isGhost ? 'none' : '1px solid #3f3f46',
        borderRadius: isLg ? 14 : 10,
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        minWidth: isLg ? 56 : undefined,
      }}
    >
      {children}
    </button>
  );
}
