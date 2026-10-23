// Botão "voltar" do celular dentro do Radar Pro, como em app: volta de tela em tela em vez de sair.
// Abas: cada troca vira um passo no histórico (#temporada, #feed…). Da Temporada, o voltar sai do app.
// Telas por cima (notificações, ficha da prova, comunidade aberta, campeonato aberto): o voltar fecha a tela.
import { useEffect, useRef } from 'react';

/** Enquanto `aberto`, o voltar do celular chama `fechar` em vez de sair da aba. */
export function useVoltar(aberto: boolean, fechar: () => void) {
  const fecharRef = useRef(fechar); fecharRef.current = fechar;
  useEffect(() => {
    if (!aberto) return;
    const id = Math.random().toString(36).slice(2);
    history.pushState({ ...(history.state ?? {}), radarCamada: id }, '', location.href);
    let saiuPeloVoltar = false;
    const onPop = () => { saiuPeloVoltar = true; fecharRef.current(); };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      // fechou pelo X: tira o passo que a camada colocou no histórico
      if (!saiuPeloVoltar && history.state?.radarCamada === id) history.back();
    };
  }, [aberto]);
}
