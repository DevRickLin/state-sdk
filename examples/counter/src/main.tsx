import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { registry } from '@vibe-stack/state-sdk';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// --- Showcase postMessage bridge ---
// When embedded in an iframe, accept state injection from the parent page.

const isEmbedded = window.self !== window.top;

if (isEmbedded) {
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'state-sdk:inject') {
      const stores = event.data.stores as Record<string, Record<string, unknown>>;
      if (stores) {
        for (const [name, storeData] of Object.entries(stores)) {
          const entry = registry.getByName(name);
          if (entry) {
            const current = entry.store.getState() as Record<string, unknown>;
            entry.store.setState({ ...current, ...storeData } as any, true);
          }
        }
      }
    }
  });

  // Signal readiness once stores are registered
  const expectedStores = ['counter', 'todo'];
  const checkReady = () => {
    const allReady = expectedStores.every((name) => registry.getByName(name));
    if (allReady) {
      window.parent.postMessage({ type: 'state-sdk:ready' }, '*');
      return true;
    }
    return false;
  };

  if (!checkReady()) {
    const unsub = registry.subscribe(() => {
      if (checkReady()) unsub();
    });
  }
}
