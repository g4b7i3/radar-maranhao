import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './install'; // captura cedo o pedido de instalação do navegador
import App from './App';
import type { State } from './lib';
import "@fontsource-variable/archivo/wdth.css";
import "./styles.css";
// Páginas extras só baixam quando alguém abre (deixa o início mais leve).
const StorySemana = lazy(() => import('./StorySemana'));
const CardTreino = lazy(() => import('./CardTreino'));
const NotaIdade = lazy(() => import('./NotaIdade'));
// /?story=semana abre o gerador do story "Provas da semana"; o resto é o Radar normal.
const qs = new URLSearchParams(window.location.search);
const story = qs.get('story') === 'semana';
const treino = qs.get('card') === 'treino'; // /?card=treino abre o card do treino
const nota = qs.get('nota') === 'idade'; // /?nota=idade abre a calculadora de nota por idade
// A agenda já vem dentro do HTML (gerado no build), então o início aparece sem esperar outro download.
let inicial: State | null = null;
try { const el = document.getElementById('dados-iniciais'); if (el?.textContent) inicial = JSON.parse(el.textContent); } catch { /* sem dados embutidos: o App busca sozinho */ }
const raiz = document.getElementById('root')!;
if (story || treino || nota) raiz.innerHTML = ''; // a página pronta é do início; nas outras não mostra
createRoot(raiz).render(<StrictMode>{story || treino || nota
  ? <Suspense fallback={null}>{story ? <StorySemana /> : treino ? <CardTreino /> : <NotaIdade />}</Suspense>
  : <App inicial={inicial} />}</StrictMode>);

// App instalável e offline: registra o service worker só na versão publicada.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* sem offline, o site segue normal */ }); });
}
