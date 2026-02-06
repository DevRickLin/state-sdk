import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { initPreviewClient } from '@vibe-stack/state-sdk-preview-runtime';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Preview runtime — replaces the hand-written postMessage bridge.
// No-ops when not embedded in an iframe.
initPreviewClient({ expectedStores: ['counter', 'todo'] });
