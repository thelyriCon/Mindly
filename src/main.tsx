import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { initTheme } from './lib/theme';
import './index.css';

// Initialize global theme from preferences/storage
initTheme();

// PWA Service Worker Registration & Background Sync
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        registration.update().catch(() => {});

        // Periodic background update check every 20 minutes
        setInterval(() => {
          registration.update().catch(() => {});
        }, 1000 * 60 * 20);
      })
      .catch((err) => {
        console.warn('[SW] Registration notice:', err);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
