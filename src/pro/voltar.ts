// Navegação do Radar Pro como em rede social:
//  - o endereço guarda onde a pessoa está (#comunidades/feminina, #campeonatos/liga-…, #provas/<id>): atualizar a página mantém tudo aberto;
//  - o voltar do celular fecha a tela de cima (comunidade, campeonato, ficha da prova, notificações);
//  - numa aba, o voltar leva pra Temporada (o início); na Temporada, sai do app.
// O histórico fica sempre curto: [Temporada] → [aba] → [tela aberta].
import { useEffect, useRef } from 'react';

const url = (caminho: string) => `${location.pathname}${location.search}#${caminho}`;
const prof = (): number => Number(history.state?.radarProf ?? 0);
const camadas = (): string[] => (history.state?.radarCamadas as string[] | undefined) ?? [];
let destino: string | null = null; // aba pedida enquanto o histórico ainda está voltando
let subInicial: { aba: string; sub: string } | null = null;
let iniciado = false;

/** Lê "#aba/sub" do endereço. */
export function lerEndereco(): { aba: string; sub: string } {
  const [aba = '', ...resto] = decodeURIComponent(location.hash.replace(/^#/, '')).split('/');
  return { aba, sub: resto.join('/') };
}

/** Monta o histórico no carregamento: Temporada embaixo, a aba do endereço por cima. Roda uma vez, antes das telas. */
export function iniciarHistorico(abaInicial: string) {
  if (iniciado) return; iniciado = true;
  if (/access_token=|error_description=/.test(location.hash)) return; // volta do login: o Supabase limpa o endereço
  const { sub } = lerEndereco();
  if (sub) subInicial = { aba: abaInicial, sub };
  if (history.state?.radarProf !== undefined) return; // atualizou a página: o histórico já está montado, a tela aberta reaproveita o passo dela
  history.replaceState({ radarProf: 0 }, '', url('temporada'));
  if (abaInicial !== 'temporada') history.pushState({ radarProf: 1 }, '', url(abaInicial));
}

/** A tela que estava aberta quando a página carregou (só uma vez). */
export function telaInicial(aba: string): string | null {
  if (subInicial?.aba !== aba) return null;
  const s = subInicial.sub; subInicial = null; return s;
}

/** Troca de aba sem empilhar: qualquer aba fica logo acima da Temporada. */
export function irParaAba(a: string, aplicar: (a: string) => void) {
  const d = prof();
  if (a === 'temporada') { if (d > 0) { destino = a; history.go(-d); } else aplicar(a); return; }
  if (d === 0) { history.pushState({ radarProf: 1 }, '', url(a)); aplicar(a); return; }
  if (d === 1) { history.replaceState({ radarProf: 1 }, '', url(a)); aplicar(a); return; }
  destino = a; history.go(-(d - 1)); // tinha tela aberta: volta até a aba e troca
}

/** Chamado no popstate pela tela principal. Devolve a aba a mostrar. */
export function abaDepoisDoVoltar(): string {
  if (destino) {
    const a = destino; destino = null;
    if (a !== 'temporada') history.replaceState({ radarProf: 1 }, '', url(a));
    return a;
  }
  return lerEndereco().aba || 'temporada';
}

/** Enquanto `aberto`, a tela fica no endereço (#aba/caminho) e o voltar do celular chama `fechar`. */
export function useVoltar(aberto: boolean, fechar: () => void, caminho?: string) {
  const fecharRef = useRef(fechar); fecharRef.current = fechar;
  useEffect(() => {
    if (!aberto) return;
    const base = lerEndereco().aba;
    const alvo = caminho ? `${base}/${caminho}` : null;
    // depois de atualizar a página, o passo desta tela já está no histórico: reaproveita em vez de empilhar outro
    const reuso = alvo && camadas().length && decodeURIComponent(location.hash.slice(1)) === alvo ? camadas().at(-1)! : null;
    const id = reuso ?? Math.random().toString(36).slice(2);
    if (!reuso) history.pushState({ radarProf: prof() + 1, radarCamadas: [...camadas(), id] }, '', url(caminho ? `${base}/${caminho}` : `${base}${location.hash.includes('/') ? location.hash.slice(location.hash.indexOf('/')) : ''}`));
    let saiu = false;
    const onPop = () => { if (!camadas().includes(id)) { saiu = true; window.removeEventListener('popstate', onPop); fecharRef.current(); } };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (!saiu && !destino && camadas().at(-1) === id) history.back(); // fechou pelo X
    };
  }, [aberto, caminho]);
}
