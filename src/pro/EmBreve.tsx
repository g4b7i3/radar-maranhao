// Radar Pro · "Em breve": o que está chegando, já visível mas bloqueado (cards da corrida, Garmin e Intervals.icu).
import { useEffect, useRef, useState } from 'react';
import { Lock, Sparkles, Watch, Activity } from 'lucide-react';
// @ts-expect-error módulo JS de desenho (canvas)
import { CARD_LAYOUTS, desenharCard } from './cards/desenho.js';
import { CORRIDA_DEMO, CLIMA_DEMO } from './cards/demo';

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

export function EmBreve() {
  return (
    <section className="pro-card pro-breve">
      <div className="pro-linha"><p className="pro-k cinza"><Sparkles size={14} aria-hidden="true" /> Em breve no Radar</p><span className="pro-st dec">Em breve</span></div>
      <p className="pro-sub pro-sem-margem">Card da corrida pro story, com {CARD_LAYOUTS.length} modelos, inclusive no jeito maranhense. Ainda bloqueado: está chegando.</p>
      <div className="pro-breve-galeria">{(CARD_LAYOUTS as [string, string][]).map(([k, n]) => <Miniatura key={k} layout={k} nome={n} />)}</div>
      <div className="pro-breve-con">
        <div className="pro-breve-item"><Watch size={20} aria-hidden="true" /><div><b>Garmin</b><small>Suas corridas do relógio chegam sozinhas no Radar.</small></div><button className="btn outline" disabled><Lock size={14} aria-hidden="true" />Em breve</button></div>
        <div className="pro-breve-item"><Activity size={20} aria-hidden="true" /><div><b>Intervals.icu</b><small>Importa as corridas do Intervals.icu.</small></div><button className="btn outline" disabled><Lock size={14} aria-hidden="true" />Em breve</button></div>
      </div>
    </section>
  );
}
