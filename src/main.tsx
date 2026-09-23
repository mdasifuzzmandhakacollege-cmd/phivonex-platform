import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Guard against unhandled transport rejections (e.g. dropped dev WebSockets)
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    const message = reason?.message || String(reason || '');
    if (message.includes('WebSocket') || message.includes('failed to connect') || message.includes('aborted')) {
      // Prevent noisy transport drops from terminating application state
      event.preventDefault();
    }
  });

  window.addEventListener('error', (event) => {
    const message = event?.message || '';
    if (message.includes('WebSocket') || message.includes('failed to connect')) {
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

