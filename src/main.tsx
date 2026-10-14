import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './install'; // captura cedo o pedido de instalação do navegador
import App from './App';
import "@fontsource-variable/archivo/wdth.css";
import "./styles.css";
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

// App instalável e offline: registra o service worker só na versão publicada.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* sem offline, o site segue normal */ }); });
}
