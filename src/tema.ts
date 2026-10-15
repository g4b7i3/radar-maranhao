import { useEffect, useState } from 'react';

// Tema claro/escuro: segue o celular até a pessoa escolher no botão; a escolha fica salva neste aparelho.
type Tema = 'light' | 'dark';
const CHAVE = 'radar-tema';
const doSistema = (): Tema => (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
const salvo = (): Tema | null => { try { const t = localStorage.getItem(CHAVE); return t === 'dark' || t === 'light' ? t : null; } catch { return null; } };

function aplicar(t: Tema, escolhido: boolean) {
  const root = document.documentElement;
  if (escolhido) root.dataset.theme = t; else delete root.dataset.theme;
  const cs = document.querySelector('meta[name="color-scheme"]');
  if (cs) cs.setAttribute('content', escolhido ? t : 'light dark');
  // barra do navegador no celular acompanha o tema
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', (escolhido ? t === 'dark' : m.getAttribute('media')?.includes('dark')) ? '#141c31' : '#ffffff'));
}

export function useTema() {
  const [escolhido, setEscolhido] = useState<Tema | null>(salvo);
  const [sistema, setSistema] = useState<Tema>(doSistema);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const f = () => setSistema(mq.matches ? 'dark' : 'light');
    mq?.addEventListener?.('change', f);
    return () => mq?.removeEventListener?.('change', f);
  }, []);
  const atual = escolhido ?? sistema;
  useEffect(() => { aplicar(atual, !!escolhido); }, [atual, escolhido]);
  function alternar() {
    const novo: Tema = atual === 'dark' ? 'light' : 'dark';
    setEscolhido(novo);
    try { localStorage.setItem(CHAVE, novo); } catch { /* sem armazenamento: vale só nesta visita */ }
    try { (window as unknown as { umami?: { track: (n: string, d?: object) => void } }).umami?.track('Tema', { tema: novo === 'dark' ? 'escuro' : 'claro' }); } catch { /* */ }
  }
  return { escuro: atual === 'dark', alternar };
}
