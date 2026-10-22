// Mapa do Maranhão com as cidades onde o atleta já correu. Meta: "pintar o estado".
import { useMemo } from 'react';
import { MapPin } from 'lucide-react';
import MAPA from './mapa-ma.json';

type Dados = { w: number; h: number; d: string; cidades: Record<string, [number, number]> };
const M = MAPA as unknown as Dados;
const norm = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const acharCidade = (nome: string) => { const n = norm(nome); return Object.keys(M.cidades).find(c => norm(c) === n) ?? Object.keys(M.cidades).find(c => n.includes(norm(c)) || norm(c).includes(n)); };

export function MapaCidades({ cidades, titulo = 'Meu Maranhão', compacto = false }: { cidades: string[]; titulo?: string; compacto?: boolean }) {
  const pontos = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cidades) { const k = acharCidade(c); if (k) m.set(k, (m.get(k) ?? 0) + 1); }
    return [...m.entries()].map(([nome, n]) => ({ nome, n, xy: M.cidades[nome] }));
  }, [cidades]);
  const total = Object.keys(M.cidades).length;
  return (
    <section className={'pro-card pro-mapa' + (compacto ? ' compacto' : '')}>
      <div className="pro-linha"><p className="pro-k cinza"><MapPin size={14} aria-hidden="true" /> {titulo}</p><b>{pontos.length} de {total} cidades</b></div>
      <svg viewBox={`0 0 ${M.w} ${M.h}`} role="img" aria-label={`Mapa do Maranhão com ${pontos.length} cidades onde já correu`}>
        <path d={M.d} className="pro-mapa-estado" />
        {pontos.map((p, k) => { const r = p.n > 1 ? 5.5 : 4.5; const ini = `${(k * .37) % 2}s`; return (
          <g key={p.nome} className="pro-mapa-pin">
            {/* halo que se expande e some, e a bolinha que pisca; cada cidade começa num instante diferente */}
            <circle cx={p.xy[0]} cy={p.xy[1]} r={r} className="halo">
              <animate attributeName="r" values={`${r};${r * 3.2}`} dur="2s" begin={ini} repeatCount="indefinite" />
              <animate attributeName="opacity" values=".9;0" dur="2s" begin={ini} repeatCount="indefinite" />
            </circle>
            <circle cx={p.xy[0]} cy={p.xy[1]} r={r}>
              <animate attributeName="opacity" values="1;.35;1" dur="2s" begin={ini} repeatCount="indefinite" />
              <animate attributeName="r" values={`${r};${r * 1.25};${r}`} dur="2s" begin={ini} repeatCount="indefinite" />
            </circle>
          </g>
        ); })}
      </svg>
      {pontos.length > 0
        ? <p className="fine pro-sem-margem">{pontos.sort((a, b) => b.n - a.n).map(p => p.n > 1 ? `${p.nome} (${p.n})` : p.nome).join(' · ')}</p>
        : <p className="fine pro-sem-margem">Cada cidade onde você corre vira um ponto no mapa.</p>}
    </section>
  );
}
