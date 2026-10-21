// Sequências e metas: motivo para voltar entre uma prova e outra.
// Calculado no aparelho a partir das provas (as mesmas que aparecem no perfil), sem tabela nova.
import { Flame, Target } from 'lucide-react';
import { LIGAS, pct, type Liga } from './sb';

type ProvaMin = { data: string; cidade: string; status: string };
const mesIdx = (iso: string) => { const [a, m] = iso.slice(0, 7).split('-').map(Number); return a * 12 + (m - 1); };

/** Meses seguidos com pelo menos uma prova, contando até o mês atual (ou o anterior, se este ainda não teve prova). */
export function sequenciaMeses(provas: ProvaMin[]) {
  const meses = new Set(provas.filter(p => p.status !== 'recusado').map(p => mesIdx(p.data)));
  const hoje = new Date(), atual = hoje.getFullYear() * 12 + hoje.getMonth();
  let m = meses.has(atual) ? atual : atual - 1, n = 0;
  while (meses.has(m)) { n++; m--; }
  return n;
}

export function Metas({ provas, indice, liga, titulo = 'Sequências e metas' }: { provas: ProvaMin[]; indice: number | null; liga: Liga | null; titulo?: string }) {
  const validas = provas.filter(p => p.status !== 'recusado');
  const seq = sequenciaMeses(provas);
  const cidades = new Set(validas.map(p => p.cidade)).size;
  const i = LIGAS.findIndex(l => l.id === liga), prox = LIGAS[i + 1];
  const metas: { nome: string; v: number; alvo: number; txt: string; fogo?: boolean }[] = [
    { nome: 'Meses seguidos com prova', v: seq, alvo: 3, txt: seq >= 3 ? `${seq} meses seguidos 🔥` : seq === 0 ? 'Corra uma prova este mês para começar' : `${seq} de 3 · não deixe o mês passar em branco`, fogo: seq >= 2 },
    { nome: 'Cidades diferentes', v: cidades, alvo: 5, txt: cidades >= 5 ? `${cidades} cidades · explorador do Maranhão` : `${cidades} de 5` },
    { nome: 'Provas na temporada', v: validas.length, alvo: 10, txt: validas.length >= 10 ? `${validas.length} provas` : `${validas.length} de 10` },
    indice == null
      ? { nome: 'Primeira liga', v: 0, alvo: 1, txt: 'Uma prova com resultado oficial define a sua liga' }
      : prox
        ? { nome: `Chegar à liga ${prox.nome}`, v: Number(indice) - LIGAS[i].min, alvo: prox.min - LIGAS[i].min, txt: `Índice ${pct(indice)} · faltam ${pct(prox.min - Number(indice))} pontos` }
        : { nome: 'Liga Elite', v: 1, alvo: 1, txt: `Índice ${pct(indice)} · a liga mais alta. Segure o nível!` },
  ];
  return (
    <section className="pro-card">
      <p className="pro-k cinza"><Target size={14} aria-hidden="true" /> {titulo}</p>
      <ul className="pro-metas">
        {metas.map(m => { const ok = m.v >= m.alvo, w = Math.max(3, Math.min(100, (m.v / m.alvo) * 100)); return (
          <li key={m.nome} className={ok ? 'ok' : ''}>
            <div className="pro-linha"><b>{m.fogo && !ok ? <Flame size={15} aria-hidden="true" /> : null}{m.nome}</b>{ok ? <span className="pro-st ok">Feito</span> : null}</div>
            <div className="pro-med-barra" aria-hidden="true"><i style={{ width: `${w}%` }} /></div>
            <small>{m.txt}</small>
          </li>
        ); })}
      </ul>
    </section>
  );
}
