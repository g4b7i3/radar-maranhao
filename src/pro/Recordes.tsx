// Recordes pessoais: melhor tempo oficial em 5, 10, 21 e 42 km, com a prova e a data.
import { Timer } from 'lucide-react';
import { relogio, dataBR } from './sb';

type ProvaMin = { prova: string; data: string; km: number; tempo: number; status: string };
const DIST: [number, string][] = [[5, '5 km'], [10, '10 km'], [21.0975, '21 km'], [42.195, '42 km']];
const perto = (a: number, b: number) => Math.abs(a - b) < (b >= 21 ? 0.3 : 0.2);
const ritmo = (s: number, km: number) => { const p = s / km; return `${Math.floor(p / 60)}:${String(Math.round(p % 60)).padStart(2, '0')}/km`; };

/** Melhor tempo por distância (só resultados oficiais). */
export function recordes(provas: ProvaMin[]) {
  const ok = provas.filter(p => p.status === 'verificado' || p.status === 'aprovado');
  return DIST.map(([km, rot]) => { const l = ok.filter(p => perto(Number(p.km), km)).sort((a, b) => a.tempo - b.tempo); return { km, rot, r: l[0] ?? null }; });
}

export function Recordes({ provas, titulo = 'Recordes pessoais' }: { provas: ProvaMin[]; titulo?: string }) {
  const lista = recordes(provas);
  if (!lista.some(x => x.r)) return null;
  return (
    <section className="pro-card">
      <p className="pro-k cinza"><Timer size={14} aria-hidden="true" /> {titulo}</p>
      <div className="pro-recordes">
        {lista.map(x => (
          <div key={x.km} className={x.r ? '' : 'vazio'}>
            <small>{x.rot}</small>
            <b>{x.r ? relogio(x.r.tempo) : '–'}</b>
            {x.r ? <span>{ritmo(x.r.tempo, x.km)}<br />{x.r.prova} · {dataBR(x.r.data)}</span> : <span>ainda sem prova oficial</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
