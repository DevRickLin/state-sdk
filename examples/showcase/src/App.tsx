import React, { useRef, useEffect, useState } from 'react';
import config from './scenes.json';

interface Scene {
  id: string;
  title: string;
  description: string;
  stores: Record<string, Record<string, unknown>>;
}

export function App() {
  return (
    <div style={{ minHeight: '100dvh', background: '#09090b', color: '#fafafa' }}>
      {/* Header */}
      <header style={{
        padding: '24px 20px 20px',
        borderBottom: '1px solid #27272a',
        background: '#18181b',
        textAlign: 'center',
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
          vibe-stack<span style={{ color: '#3b82f6' }}>/</span>state-sdk
        </h1>
        <p style={{ fontSize: 14, color: '#71717a', marginTop: 6, maxWidth: 480, margin: '6px auto 0' }}>
          {config.description}
        </p>
        <div style={{
          display: 'inline-flex', gap: 6, marginTop: 12,
          padding: '6px 12px',
          background: '#1e1b4b',
          border: '1px solid #312e81',
          borderRadius: 8,
          fontSize: 12,
          color: '#a5b4fc',
        }}>
          Each card below is the <strong style={{ color: '#c7d2fe' }}>same app</strong> with different state injected via <code style={{
            background: '#27272a', padding: '1px 5px', borderRadius: 4, fontSize: 11,
          }}>postMessage</code>
        </div>
      </header>

      {/* Scene Grid */}
      <main style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
        gap: 16,
        padding: 16,
        maxWidth: 1400,
        margin: '0 auto',
      }}>
        {config.scenes.map((scene) => (
          <SceneCard key={scene.id} scene={scene as Scene} appUrl={config.appUrl} />
        ))}
      </main>

      {/* Footer */}
      <footer style={{
        padding: '20px',
        textAlign: 'center',
        fontSize: 12,
        color: '#52525b',
        borderTop: '1px solid #27272a',
      }}>
        Powered by <span style={{ color: '#71717a' }}>@vibe-stack/state-sdk</span> — AI-generated scene config + runtime state injection
      </footer>
    </div>
  );
}

function SceneCard({ scene, appUrl }: { scene: Scene; appUrl: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'injected'>('loading');
  const hasStores = Object.keys(scene.stores).length > 0;

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;

      if (event.data?.type === 'state-sdk:ready') {
        if (hasStores) {
          iframeRef.current?.contentWindow?.postMessage(
            { type: 'state-sdk:inject', stores: scene.stores },
            '*'
          );
          setStatus('injected');
        } else {
          setStatus('ready');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [scene.stores, hasStores]);

  const storeNames = Object.keys(scene.stores);
  const badgeColor = status === 'injected' ? '#22c55e' : status === 'ready' ? '#3b82f6' : '#71717a';
  const badgeText = status === 'injected' ? 'Injected' : status === 'ready' ? 'Default' : 'Loading';

  return (
    <div style={{
      background: '#18181b',
      border: '1px solid #27272a',
      borderRadius: 12,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Card header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #27272a',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 8,
      }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}>{scene.title}</h3>
          <p style={{ fontSize: 12, color: '#71717a', marginTop: 2 }}>{scene.description}</p>
        </div>
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          padding: '3px 8px',
          borderRadius: 6,
          background: `${badgeColor}18`,
          color: badgeColor,
          border: `1px solid ${badgeColor}33`,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          {badgeText}
        </span>
      </div>

      {/* Iframe */}
      <div style={{ position: 'relative', height: 420, background: '#09090b' }}>
        {status === 'loading' && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#52525b', fontSize: 13,
          }}>
            Loading app...
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={appUrl}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            opacity: status === 'loading' ? 0 : 1,
            transition: 'opacity 0.3s ease',
          }}
          title={scene.title}
        />
      </div>

      {/* Store injection preview */}
      <div style={{
        padding: '8px 14px',
        borderTop: '1px solid #27272a',
        fontSize: 11,
        color: '#52525b',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        {hasStores ? (
          <>
            <span style={{ color: '#71717a' }}>stores:</span>
            {storeNames.map((name) => (
              <span key={name} style={{
                padding: '1px 6px',
                background: '#27272a',
                border: '1px solid #3f3f46',
                borderRadius: 4,
                color: '#a1a1aa',
              }}>
                {name}
              </span>
            ))}
          </>
        ) : (
          <span>No injection — using default initial state</span>
        )}
      </div>
    </div>
  );
}
