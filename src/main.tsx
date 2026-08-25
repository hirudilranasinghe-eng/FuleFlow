import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress harmless Vite HMR / WebSocket network noise in dev sandbox environment
if (typeof window !== 'undefined') {
  const originalWarn = console.warn;
  const originalError = console.error;

  console.warn = (...args: any[]) => {
    const msg = args[0]?.toString() || '';
    if (msg.includes('[vite]') || msg.includes('vite:ws') || msg.includes('WebSocket')) {
      return;
    }
    originalWarn.apply(console, args);
  };

  console.error = (...args: any[]) => {
    const msg = args[0]?.toString() || '';
    if (msg.includes('[vite]') || msg.includes('vite:ws') || msg.includes('WebSocket connection to')) {
      return;
    }
    originalError.apply(console, args);
  };
}

// Register lightweight Service Worker for Android/Tablet PWA installation
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.log('SW registration skipped:', err?.message || err);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

