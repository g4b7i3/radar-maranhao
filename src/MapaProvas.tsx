import { useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, ZoomIn } from 'lucide-react';
import MAPA from './mapa-ma.json';
import { fmt, norm, type Race } from './lib';

// Contorno do Maranhão e posição das 217 cidades: malha e coordenadas públicas do IBGE,
// já projetadas e simplificadas (src/mapa-ma.json, ~14 KB). Nada de Google Maps.
const M = MAPA as unknown as { w: number; h: number; contorno: string; cidades: Record<string, [number, number]> };
const POS = new Map(Object.entries(M.cidades).map(([n, p]) => [norm(n), p]));
const raio = (n: number) => 5.5 + 2.3 * Math.sqrt(n);
const PERTO = 15; // bolinhas mais perto que isso viram "aglomerado": o toque dá zoom em vez de escolher

type Pino = { cidade: string; x: number; y: number; n: number; r: number };

export default function MapaProvas({ events, onAbrir, onVerLista }: { events: Race[]; onAbrir: (e: Race) => void; onVerLista: (cidade: string) => void }) {
  const [sel, setSel] = useState<string | null>(null);
  const [zoom, setZoom] = useState<{ x: number; y: number; s: number } | null>(null);

  const { pinos, semPosicao } = useMemo(() => {
    const cont = new Map<string, number>();
    for (const e of events) cont.set(e.city, (cont.get(e.city) ?? 0) + 1);
    const pinos: Pino[] = []; const semPosicao: string[] = [];
    for (const [cidade, n] of cont) {
      const p = POS.get(norm(cidade));
      if (p) pinos.push({ cidade, x: p[0], y: p[1], n, r: raio(n) }); else semPosicao.push(cidade);
    }
    pinos.sort((a, b) => a.r - b.r); // as maiores por cima
    return { pinos, semPosicao };
  }, [events]);

  const s = zoom?.s ?? 1;
  const vizinhos = (p: Pino) => pinos.filter(q => q !== p && Math.hypot(q.x - p.x, q.y - p.y) < PERTO);
  function tocar(p: Pino) {
    if (!zoom && vizinhos(p).length) {
      // centraliza o aglomerado e aproxima
      const grupo = [p, ...vizinhos(p)];
      const cx = grupo.reduce((a, q) => a + q.x, 0) / grupo.length, cy = grupo.reduce((a, q) => a + q.y, 0) / grupo.length;
      setZoom({ x: cx, y: cy, s: 3.2 });
      return;
    }
    setSel(p.cidade);
    setTimeout(() => document.getElementById('mapa-cidade')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  }
  const transform = zoom ? `translate(${M.w / 2} ${M.h / 2}) scale(${s}) translate(${-zoom.x} ${-zoom.y})` : undefined;
  const lista = sel ? events.filter(e => e.city === sel).sort((a, b) => (a.date ?? '9').localeCompare(b.date ?? '9')) : [];
  const cidades = pinos.length + semPosicao.length;

  return (
    <div className="mapa">
      <div className="mapa-cartao">
        <div className="mapa-topo">
          <div>
            <h2>{events.length} {events.length === 1 ? 'prova' : 'provas'} em {cidades} {cidades === 1 ? 'cidade' : 'cidades'}</h2>
            <p>{zoom ? 'Toque numa cidade para ver as provas.' : 'Toque numa cidade. Onde as bolinhas se juntam, o toque aproxima o mapa.'}</p>
          </div>
          {zoom && <button className="mapa-voltar" onClick={() => setZoom(null)}><ArrowLeft size={16} aria-hidden="true" />Estado todo</button>}
        </div>
        <svg viewBox={`-8 -8 ${M.w + 16} ${M.h + 16}`} role="img" aria-label="Mapa do Maranhão com as cidades que têm provas">
          <g className="mapa-g" transform={transform}>
            <path className="mapa-ma" d={M.contorno} style={{ strokeWidth: 1.2 / s }} />
            {pinos.map(p => {
              const ativo = sel === p.cidade, r = p.r / s;
              return (
                <g key={p.cidade} className={ativo ? 'pino sel' : 'pino'} role="button" tabIndex={0}
                  aria-label={`${p.cidade}: ${p.n} ${p.n === 1 ? 'prova' : 'provas'}`}
                  onClick={() => tocar(p)} onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); tocar(p); } }}>
                  <circle className="pino-pulso" cx={p.x} cy={p.y} r={r} />
                  <circle className="pino-bola" cx={p.x} cy={p.y} r={r} style={{ strokeWidth: 1.5 / s }} />
                  {p.n > 1 && <text x={p.x} y={p.y + 3.8 / s} style={{ fontSize: 11 / s }}>{p.n}</text>}
                  {(zoom || ativo) && (() => {
                    // se tem outra cidade logo à direita, o nome vai embaixo da bolinha para não encavalar
                    const apertado = pinos.some(q => q !== p && q.x > p.x && q.x - p.x < 90 / s && Math.abs(q.y - p.y) < 12 / s);
                    return apertado
                      ? <text className="pino-nome meio" x={p.x} y={p.y + r + 11 / s} style={{ fontSize: 10 / s, strokeWidth: 3 / s }}>{p.cidade.toUpperCase()}</text>
                      : <text className="pino-nome" x={p.x + r + 3 / s} y={p.y + 3.5 / s} style={{ fontSize: 10 / s, strokeWidth: 3 / s }}>{p.cidade.toUpperCase()}</text>;
                  })()}
                </g>
              );
            })}
          </g>
        </svg>
        <div className="mapa-leg"><span><i aria-hidden="true" />cidade com prova</span><span>número = quantas provas</span>{!zoom && <span><ZoomIn size={13} aria-hidden="true" />toque no aglomerado para aproximar</span>}</div>
        {semPosicao.length > 0 && <p className="mapa-sem">Fora do mapa (posição não encontrada): {semPosicao.map(c => <button key={c} onClick={() => setSel(c)}>{c}</button>)}</p>}
      </div>

      {sel && (
        <section className="mapa-cidade" id="mapa-cidade" aria-live="polite">
          <h3>{sel}</h3>
          <p className="mapa-sub">{lista.length} {lista.length === 1 ? 'prova pela frente' : 'provas pela frente'}</p>
          <ul>
            {lista.slice(0, 5).map(e => (
              <li key={e.id}><button onClick={() => onAbrir(e)}>
                <span className="mc-d">{e.date ? <><b>{fmt.day(e.date)}</b><small>{fmt.weekdayShort(e.date)}</small></> : <b>?</b>}</span>
                <span className="mc-t"><b>{e.name}</b><small>{e.date ? fmt.short(e.date) : 'data a confirmar'} · {e.distances.length ? e.distances.map(d => String(d).replace('.', ',')).join(', ') + ' km' : 'distâncias a confirmar'}</small></span>
                <ChevronRight size={18} aria-hidden="true" />
              </button></li>
            ))}
          </ul>
          <button className="mapa-mais" onClick={() => onVerLista(sel)}>Ver {lista.length > 1 ? `as ${lista.length} provas` : 'a prova'} de {sel} na lista →</button>
        </section>
      )}
    </div>
  );
}
