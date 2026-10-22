// Mapa do Brasil: os estados onde a pessoa tem prova comprovada acendem e piscam; as regiões ficam com tons diferentes.
import { Map as MapaIc } from 'lucide-react';
import BR from './mapa-br.json';

type Estado = { d: string; cx: number; cy: number; regiao: string };
const M = BR as { w: number; h: number; estados: Record<string, Estado> };
export const REGIOES: Record<string, string> = { norte: 'Norte', nordeste: 'Nordeste', centro_oeste: 'Centro-Oeste', sudeste: 'Sudeste', sul: 'Sul' };

/** `ufs`: lista de UFs (uma por prova comprovada); repetidas contam. */
export function MapaBrasil({ ufs, titulo = 'Seu Brasil', compacto }: { ufs: string[]; titulo?: string; compacto?: boolean }) {
  const n = new Map<string, number>();
  for (const u of ufs) { const k = String(u || 'MA').toUpperCase(); if (M.estados[k]) n.set(k, (n.get(k) ?? 0) + 1); }
  const exterior = ufs.filter(u => String(u).toUpperCase() === 'EX').length;
  const fora = [...n.keys()].filter(u => u !== 'MA');
  const regioes = new Set([...n.keys()].map(u => M.estados[u].regiao));
  const acesos = [...n.keys()];
  return (
    <section className={'pro-card pro-mapa-br' + (compacto ? ' compacto' : '')}>
      <div className="pro-linha"><p className="pro-k cinza"><MapaIc size={14} aria-hidden="true" /> {titulo}</p><b>{n.size} de 27 estados</b></div>
      <svg viewBox={`0 0 ${M.w} ${M.h}`} role="img" aria-label={`Mapa do Brasil com ${n.size} estados onde já correu`}>
        {Object.entries(M.estados).map(([uf, e]) => <path key={uf} d={e.d} className={`uf r-${e.regiao}${n.has(uf) ? ' on' : ''}`} />)}
        {acesos.map((uf, k) => { const e = M.estados[uf]; const r = (n.get(uf) ?? 1) > 1 ? 6 : 5; const ini = `${(k * .41) % 2}s`; return (
          <g key={uf} className="pro-mapa-pin">
            <circle cx={e.cx} cy={e.cy} r={r} className="halo"><animate attributeName="r" values={`${r};${r * 3}`} dur="2s" begin={ini} repeatCount="indefinite" /><animate attributeName="opacity" values=".9;0" dur="2s" begin={ini} repeatCount="indefinite" /></circle>
            <circle cx={e.cx} cy={e.cy} r={r}><animate attributeName="opacity" values="1;.4;1" dur="2s" begin={ini} repeatCount="indefinite" /></circle>
            <text x={e.cx} y={e.cy - r - 4} className="uf-nome">{uf}</text>
          </g>
        ); })}
      </svg>
      <div className="pro-mapa-br-legenda" aria-hidden="true">{Object.entries(REGIOES).map(([k, nome]) => <span key={k} className={`r-${k}${regioes.has(k) ? ' on' : ''}`}><i />{nome}</span>)}</div>
      {fora.length > 0 || exterior > 0
        ? <p className="fine pro-sem-margem">Fora do Maranhão: {fora.sort().map(u => `${u}${(n.get(u) ?? 0) > 1 ? ` (${n.get(u)})` : ''}`).join(' · ')}{exterior ? `${fora.length ? ' · ' : ''}fora do Brasil (${exterior})` : ''}.</p>
        : <p className="fine pro-sem-margem">Correu fora do Maranhão? Registre a prova com o link do resultado e o estado acende aqui, com medalha.</p>}
    </section>
  );
}
