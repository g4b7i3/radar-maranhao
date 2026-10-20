import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './install'; // captura cedo o pedido de instalação do navegador
import App from './App';
import StorySemana from './StorySemana';
import CardTreino from './CardTreino';
import NotaIdade from './NotaIdade';
const CalcRitmo = lazy(() => import('./CalcRitmo')); // só baixa quando alguém abre
const Pro = lazy(() => import('./pro/Pro')); // Radar Pro: login e temporada, só baixa em /?pro
import "@fontsource-variable/archivo/wdth.css";
import "./styles.css";
// /?story=semana abre o gerador do story "Provas da semana"; o resto é o Radar normal.
const qs = new URLSearchParams(window.location.search);
const story = qs.get('story') === 'semana';
const treino = qs.get('card') === 'treino'; // /?card=treino abre o card do treino
const nota = qs.get('nota') === 'idade'; // /?nota=idade abre a calculadora de nota por idade
const ritmo = qs.get('calc') === 'ritmo'; // /?calc=ritmo abre a calculadora de ritmo
// /?pro abre o Radar Pro; a volta do login (com #access_token ou ?code) também cai aqui
const pro = qs.has('pro') || /access_token=|error_description=/.test(window.location.hash);
createRoot(document.getElementById('root')!).render(<StrictMode>{pro ? <Suspense fallback={null}><Pro /></Suspense> : story ? <StorySemana /> : treino ? <CardTreino /> : nota ? <NotaIdade /> : ritmo ? <Suspense fallback={null}><CalcRitmo /></Suspense> : <App />}</StrictMode>);

// App instalável e offline: registra o service worker só na versão publicada.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* sem offline, o site segue normal */ }); });
}
