// Radar Pro · "Em breve": o que está chegando, já visível mas bloqueado (cards da corrida, Garmin e Intervals.icu).
import { useEffect, useRef, useState } from 'react';
import { Lock, Sparkles, Watch, Activity } from 'lucide-react';
// @ts-expect-error módulo JS de desenho (canvas)
import { CARD_LAYOUTS, desenharCard } from './cards/desenho.js';
import { CORRIDA_DEMO, CLIMA_DEMO } from './cards/demo';
import { sb, chamar } from './sb';

const ADMIN = 'vinikautor@gmail.com';

const OPCOES = { fundo: 'radar', cor: 'branco', formato: 'story', img: null, clima: CLIMA_DEMO, zoom: 1, dx: 0, dy: 0,
  stats: { dist: true, pace: true, tempo: true, fc: true, elev: false, cad: false, kcal: false, passos: false, rota: true, data: true } };

function Miniatura({ layout, nome }: { layout: string; nome: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [visivel, setVisivel] = useState(false);
  useEffect(() => { // desenha só quando aparece na tela (são muitos cards grandes)
    const el = ref.current; if (!el) return;
    const ob = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisivel(true); ob.disconnect(); } }, { rootMargin: '200px' });
    ob.observe(el); return () => ob.disconnect();
  }, []);
  useEffect(() => {
    if (!visivel || !ref.current) return;
    const cv = ref.current, tmp = document.createElement('canvas');
    document.fonts.load("800 60px 'Radar Cond'").catch(() => null).then(() => desenharCard(tmp, { ...CORRIDA_DEMO, _serie: { titulo: 'Tiros', qual: true } }, { ...OPCOES, layout }))
      .then(() => { cv.width = 270; cv.height = Math.round(270 * tmp.height / tmp.width); cv.getContext('2d')!.drawImage(tmp, 0, 0, cv.width, cv.height); })
      .catch(() => null);
  }, [visivel, layout]);
  return (
    <div className="pro-breve-card" aria-label={`${nome} (em breve)`}>
      <canvas ref={ref} width={270} height={480} />
      <span className="pro-breve-cadeado" aria-hidden="true"><Lock size={14} /></span>
      <small>{nome}</small>
    </div>
  );
}

/** Botão do Garmin: liberado só pro admin testar enquanto está "Em breve" pros atletas. */
function GarminBotao() {
  const [admin, setAdmin] = useState(false);
  const [conectado, setConectado] = useState(false);
  const [msg, setMsg] = useState<string | null>(() => (location.hash.includes('garmin-ok') ? 'Garmin conectado! As próximas corridas do relógio chegam sozinhas.' : location.hash.includes('garmin-erro') ? 'Não deu pra conectar o Garmin. Tente de novo.' : null));
  const [ocupado, setOcupado] = useState(false);
  const conferir = () => sb.from('radar_minhas_integracoes').select('provedor').eq('provedor', 'garmin').then(({ data: d }) => { const c = !!d?.length; setConectado(antes => { if (c && !antes && esperando.current) setMsg('Garmin conectado! As próximas corridas do relógio chegam sozinhas.'); return c; }); });
  const esperando = useRef(false);
  useEffect(() => {
    sb.auth.getUser().then(({ data }) => {
      if (data.user?.email !== ADMIN) return;
      setAdmin(true); conferir();
    });
    // voltou pro app depois de autorizar na aba da Garmin: confere de novo
    const volta = () => { if (document.visibilityState === 'visible' && esperando.current) conferir(); };
    document.addEventListener('visibilitychange', volta); window.addEventListener('focus', volta);
    return () => { document.removeEventListener('visibilitychange', volta); window.removeEventListener('focus', volta); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!admin) return <button className="btn outline" disabled><Lock size={14} aria-hidden="true" />Em breve</button>;
  const conectar = async () => {
    // no app instalado, a Garmin abre numa aba por cima e o app fica esperando; no navegador, vai e volta na mesma aba
    const instalado = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
    const aba = instalado ? window.open('about:blank', '_blank') : null;
    setOcupado(true);
    const r = await chamar<{ url?: string; configurado?: boolean }>('radar-garmin', { acao: 'iniciar', app: instalado });
    setOcupado(false);
    if (r.url) {
      if (instalado) { esperando.current = true; if (aba) aba.location.href = r.url; else window.open(r.url, '_blank'); setMsg('Autorize na Garmin e volte pra cá.'); }
      else location.href = r.url;
      return;
    }
    aba?.close();
    setMsg(r.erro ?? 'As chaves do Garmin ainda não estão configuradas.');
  };
  const desconectar = async () => { setOcupado(true); const r = await chamar('radar-garmin', { acao: 'desconectar' }); setOcupado(false); setConectado(false); setMsg(r.erro ?? 'Garmin desconectado.'); };
  return (
    <span className="pro-breve-admin">
      {conectado
        ? <button className="btn outline" onClick={desconectar} disabled={ocupado}>Desconectar</button>
        : <button className="btn solid" onClick={conectar} disabled={ocupado}>{ocupado ? 'Abrindo…' : 'Conectar (teste)'}</button>}
      {msg && <small role="status">{msg}</small>}
    </span>
  );
}

export function EmBreve() {
  return (
    <section className="pro-card pro-breve">
      <div className="pro-linha"><p className="pro-k cinza"><Sparkles size={14} aria-hidden="true" /> Em breve no Radar</p><span className="pro-st dec">Em breve</span></div>
      <p className="pro-sub pro-sem-margem">Card da corrida pro story, com {CARD_LAYOUTS.length} modelos, inclusive no jeito maranhense. Ainda bloqueado: está chegando.</p>
      <div className="pro-breve-galeria">{(CARD_LAYOUTS as [string, string][]).map(([k, n]) => <Miniatura key={k} layout={k} nome={n} />)}</div>
      <div className="pro-breve-con">
        <div className="pro-breve-item"><Watch size={20} aria-hidden="true" /><div><b>Garmin</b><small>Suas corridas do relógio chegam sozinhas no Radar.</small></div><GarminBotao /></div>
        <div className="pro-breve-item"><Activity size={20} aria-hidden="true" /><div><b>Intervals.icu</b><small>Importa as corridas do Intervals.icu.</small></div><button className="btn outline" disabled><Lock size={14} aria-hidden="true" />Em breve</button></div>
      </div>
    </section>
  );
}
