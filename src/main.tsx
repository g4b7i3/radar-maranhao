import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './install'; // captura cedo o pedido de instalação do navegador
import App from './App';
import StorySemana from './StorySemana';
import CardTreino from './CardTreino';
import "@fontsource-variable/archivo/wdth.css";
import "./styles.css";
// /?story=semana abre o gerador do story "Provas da semana"; o resto é o Radar normal.
const qs = new URLSearchParams(window.location.search);
const story = qs.get('story') === 'semana';
const treino = qs.get('card') === 'treino'; // /?card=treino abre o card do treino
createRoot(document.getElementById('root')!).render(<StrictMode>{story ? <StorySemana /> : treino ? <CardTreino /> : <App />}</StrictMode>);

// App instalável e offline: registra o service worker só na versão publicada.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* sem offline, o site segue normal */ }); });
}
