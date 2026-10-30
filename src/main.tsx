import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './install'; // captura cedo o pedido de instalação do navegador
// cada tela baixa só o que precisa (no Instagram, com internet fraca, a página abre bem mais rápido)
const StorySemana = lazy(() => import('./StorySemana'));
const CardTreino = lazy(() => import('./CardTreino'));
const NotaIdade = lazy(() => import('./NotaIdade'));
const CalcRitmo = lazy(() => import('./CalcRitmo')); // só baixa quando alguém abre
const Pro = lazy(() => import('./pro/Pro')); // Radar Pro: login e temporada, só baixa em /?pro
const PerfilPublico = lazy(() => import('./pro/PerfilPublico')); // /?atleta=apelido: perfil público do Radar Pro
const Assessoria = lazy(() => import('./pro/Assessoria')); // /?assessoria=nome: página pública da assessoria
import "@fontsource-variable/archivo/wdth.css";
import "./styles.css";
// /?story=semana abre o gerador do story "Provas da semana"; o resto é o Radar normal.
const qs = new URLSearchParams(window.location.search);
const story = qs.get('story') === 'semana';
const treino = qs.get('card') === 'treino'; // /?card=treino abre o card do treino
const nota = qs.get('nota') === 'idade'; // /?nota=idade abre a calculadora de nota por idade
const ritmo = qs.get('calc') === 'ritmo'; // /?calc=ritmo abre a calculadora de ritmo
// /?pro abre o Radar Pro; a volta do login (com #access_token ou ?code) também cai aqui
const assessoria = (qs.get('assessoria') ?? '').trim().slice(0, 60);
const atleta = (qs.get('atleta') ?? '').toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 20);
// Radar e Radar Pro agora são uma coisa só: o endereço principal abre a rede (com login) e a agenda fica na aba Agenda.
// Links antigos de prova (/?prova=id) e da "Minha agenda" (/?aba=salvas) abrem a mesma coisa lá dentro, depois do login.
{
  const prova = (qs.get('prova') ?? '').slice(0, 120);
  const abaVelha = qs.get('aba');
  try {
    if (prova) localStorage.setItem('radar-abrir-prova', prova);
    else if (abaVelha === 'salvas') localStorage.setItem('radar-abrir-prova', ':salvas');
    else if (abaVelha === 'novidades') localStorage.setItem('radar-abrir-prova', ':proximas');
  } catch { /* sem armazenamento */ }
  if (prova || abaVelha) { qs.delete('prova'); qs.delete('aba'); window.history.replaceState(null, '', window.location.pathname + (qs.toString() ? '?' + qs : '') + window.location.hash); }
}
const pro = true;
// enquanto a tela baixa, mantém a abertura que já veio no HTML (nada de tela branca)
const abertura = document.getElementById('abertura')?.outerHTML ?? '';
const Abertura = () => <div dangerouslySetInnerHTML={{ __html: abertura }} />;
createRoot(document.getElementById('root')!).render(<StrictMode><Suspense fallback={<Abertura />}>{atleta ? <PerfilPublico apelido={atleta} /> : assessoria ? <Assessoria nome={assessoria} /> : pro ? <Pro /> : story ? <StorySemana /> : treino ? <CardTreino /> : nota ? <NotaIdade /> : ritmo ? <CalcRitmo /> : null}</Suspense></StrictMode>);

// App instalável e offline: registra o service worker só na versão publicada.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* sem offline, o site segue normal */ }); });
}
