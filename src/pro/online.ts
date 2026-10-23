// Online / offline: o app avisa que a pessoa está aqui ao abrir e a cada minuto; ao sair (aba escondida ou fechada), avisa que saiu.
// Online = apareceu nos últimos 2,5 minutos. A lista de quem está online é buscada a cada minuto e qualquer Avatar mostra a bolinha verde.
import { useEffect, useState } from 'react';
import { sb } from './sb';

let online = new Set<string>();
const ouvintes = new Set<() => void>();
let iniciado = false;

async function atualizarLista() {
  const { data } = await sb.rpc('radar_online');
  online = new Set((data as string[] | null) ?? []);
  ouvintes.forEach(f => f());
}
const avisar = (on: boolean) => { sb.rpc('radar_presenca', { p_on: on }).then(() => { if (on) atualizarLista(); }, () => null); };

/** Liga a presença (chamado uma vez, depois do login com perfil). */
export function iniciarPresenca() {
  if (iniciado || typeof document === 'undefined') return;
  iniciado = true;
  avisar(true);
  setInterval(() => { if (document.visibilityState === 'visible') { avisar(true); } }, 60_000);
  document.addEventListener('visibilitychange', () => avisar(document.visibilityState === 'visible'));
  window.addEventListener('pagehide', () => avisar(false));
}

/** true se o atleta está online agora (atualiza sozinho). */
export function useOnline(apelido?: string | null) {
  const [, re] = useState(0);
  useEffect(() => { const f = () => re(x => x + 1); ouvintes.add(f); return () => { ouvintes.delete(f); }; }, []);
  return !!apelido && online.has(apelido);
}
