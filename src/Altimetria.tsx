import { ExternalLink, TrendingUp } from 'lucide-react';
import { SUBIDA, type Race } from './lib';

export function SeloSubida({ e }: { e: Race }) {
  const a = e.elevation;
  if (!a) return null;
  return <span className={`tag subida s-${a.level}`} title={a.summary}><TrendingUp size={13} aria-hidden="true" />{SUBIDA[a.level]}</span>;
}

/** Gráfico de altimetria + resumo, na ficha da prova. */
export default function Altimetria({ e }: { e: Race }) {
  const a = e.elevation;
  if (!a) return null;
  const p = a.profile;
  let grafico = null;
  if (p && p.length > 1) {
    const W = 320, H = 84, min = Math.min(...p), max = Math.max(...p);
    // escala mínima de 30 m pra prova plana não parecer montanha
    const faixa = Math.max(30, max - min), base = min - (faixa - (max - min)) / 2;
    const y = (v: number) => H - 6 - ((v - base) / faixa) * (H - 14);
    const linha = p.map((v, i) => `${(i / (p.length - 1)) * W},${y(v).toFixed(1)}`).join(' ');
    grafico = (
      <svg className="alti-graf" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Altimetria: de ${min} a ${max} metros`}>
        <polygon points={`0,${H} ${linha} ${W},${H}`} />
        <polyline points={linha} />
      </svg>
    );
  }
  return (
    <section className={`alti s-${a.level}`} aria-label="Altimetria">
      <div className="alti-top">
        <span className="alti-nivel"><TrendingUp size={16} aria-hidden="true" />{SUBIDA[a.level]}</span>
        {a.gain != null && <span className="alti-num"><b>↗ {a.gain} m</b> de subida{a.km ? ` em ${String(a.km).replace('.', ',')} km` : ''}</span>}
      </div>
      {grafico}
      {p && <div className="alti-eixo"><span>Largada</span><span>{Math.min(...p)} a {Math.max(...p)} m</span><span>Chegada</span></div>}
      <p>{a.summary}</p>
      {a.routeUrl && <a href={a.routeUrl} target="_blank" rel="noopener noreferrer" data-umami-event="Ver percurso" data-umami-event-prova={e.name}>Ver percurso<ExternalLink size={13} aria-hidden="true" /></a>}
    </section>
  );
}
