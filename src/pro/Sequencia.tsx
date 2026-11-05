// Sequência da semana e meta semanal (no estilo do Strava): conta as corridas do relógio e as provas do atleta.
import { useEffect, useMemo, useState } from 'react';
import { Flame, Footprints, Minus, Plus, X } from 'lucide-react';
import { sb, type Perfil } from './sb';

const DIAS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const CORRE = new Set(['corrida', 'trail', 'esteira']);
const segunda = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const chaveDia = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export function Sequencia({ perfil }: { perfil: Perfil & { meta_semana?: number | null } }) {
  const [dias, setDias] = useState<Date[] | null>(null);
  const [meta, setMeta] = useState<number | null>(perfil.meta_semana ?? null);
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(2);
  const [aba, setAba] = useState<'seq' | 'meta'>('seq');

  useEffect(() => {
    const desde = new Date(Date.now() - 26 * 7 * 864e5).toISOString();
    Promise.all([
      sb.from('radar_atividades').select('data, tipo').eq('user_id', perfil.user_id).gte('data', desde),
      sb.from('radar_resultados').select('prova_data, status').eq('user_id', perfil.user_id).gte('prova_data', desde.slice(0, 10)),
    ]).then(([a, r]) => {
      const l: Date[] = [];
      (a.data ?? []).forEach((x: { data: string; tipo: string }) => { if (CORRE.has(x.tipo)) l.push(new Date(x.data)); });
      (r.data ?? []).forEach((x: { prova_data: string; status: string }) => { if (x.status !== 'recusado') l.push(new Date(x.prova_data + 'T12:00:00')); });
      setDias(l);
    });
  }, [perfil.user_id]);

  const info = useMemo(() => {
    if (!dias) return null;
    const hoje = new Date(), ini = segunda(hoje);
    const porDia = new Map<string, number>(); dias.forEach(d => porDia.set(chaveDia(d), (porDia.get(chaveDia(d)) ?? 0) + 1));
    const semana = DIAS.map((_, k) => { const d = new Date(ini); d.setDate(ini.getDate() + k); return { d, n: porDia.get(chaveDia(d)) ?? 0 }; });
    const naSemana = (s: Date) => { const f = new Date(s); f.setDate(s.getDate() + 7); return dias.filter(d => d >= s && d < f).length; };
    // semanas seguidas com pelo menos uma corrida (a atual conta se já tiver corrida)
    let s = new Date(ini), seq = 0;
    if (!naSemana(s)) s.setDate(s.getDate() - 7);
    while (naSemana(s) > 0 && seq < 60) { seq++; s = new Date(s); s.setDate(s.getDate() - 7); }
    // sugestão de meta: a média das últimas 4 semanas fechadas (mínimo 2)
    const ult = [1, 2, 3, 4].map(k => { const x = new Date(ini); x.setDate(ini.getDate() - 7 * k); return naSemana(x); });
    const sugestao = Math.min(7, Math.max(2, Math.round(ult.reduce((a, b) => a + b, 0) / 4)));
    return { semana, seq, feitas: naSemana(ini), sugestao };
  }, [dias]);

  if (!info) return null;
  const alvo = meta ?? info.sugestao, feitas = info.feitas, cheio = Math.min(1, feitas / alvo);
  const R = 30, C = 2 * Math.PI * R;
  const salvar = async () => {
    setMeta(rascunho); setEditando(false);
    await sb.rpc('radar_meta_semana', { p: rascunho });
  };

  return (
    <section className="pro-card pro-seq">
      <div className="pro-seq-abas" role="tablist">
        <button role="tab" aria-selected={aba === 'seq'} className={aba === 'seq' ? 'on' : ''} onClick={() => setAba('seq')}>Sua sequência</button>
        <button role="tab" aria-selected={aba === 'meta'} className={aba === 'meta' ? 'on' : ''} onClick={() => setAba('meta')}>Meta da semana</button>
      </div>

      {aba === 'seq' ? (
        <div className="pro-seq-linha">
          <div className={'pro-seq-fogo' + (info.seq ? '' : ' apagado')}>
            <Flame size={44} aria-hidden="true" fill="currentColor" strokeWidth={1.2} />
            <b>{info.seq}</b>
            <small>{info.seq === 1 ? 'semana' : 'semanas'}</small>
          </div>
          <ol className="pro-seq-dias" aria-label="Corridas desta semana">
            {info.semana.map(({ d, n }, k) => {
              const hoje = chaveDia(d) === chaveDia(new Date()), futuro = d > new Date();
              return (
                <li key={k} className={(n ? 'feito' : '') + (hoje ? ' hoje' : '') + (futuro ? ' futuro' : '')} aria-label={`${d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric' })}${n ? ': correu' : ''}`}>
                  <small>{DIAS[k]}</small>
                  <span>{n ? <Footprints size={17} aria-hidden="true" /> : d.getDate()}</span>
                </li>
              );
            })}
          </ol>
        </div>
      ) : (
        <div className="pro-seq-meta">
          <div className="pro-seq-anel" aria-hidden="true">
          <svg width="76" height="76" viewBox="0 0 76 76">
            <circle cx="38" cy="38" r={R} className="fundo" />
            <circle cx="38" cy="38" r={R} className="cheio" strokeDasharray={C} strokeDashoffset={C * (1 - cheio)} transform="rotate(-90 38 38)" />
          </svg>
          <Footprints size={28} />
          </div>
          <div>
            <b>{alvo} por semana</b>
            <small>{feitas >= alvo ? `${feitas} de ${alvo} corridas. Meta batida! 🔥` : `${feitas} de ${alvo} corridas concluídas`}</small>
            {meta == null && <em>Meta sugerida pelo seu ritmo das últimas semanas</em>}
          </div>
          <button className="btn solid" onClick={() => { setRascunho(alvo); setEditando(true); }}>{meta == null ? 'Definir meta' : 'Mudar'}</button>
        </div>
      )}

      {editando && (
        <div className="pro-folha" role="dialog" aria-modal="true" aria-label="Meta da semana" onClick={() => setEditando(false)}>
          <div className="pro-folha-caixa" onClick={e => e.stopPropagation()}>
            <div className="pro-linha"><b>Quantas corridas por semana?</b><button className="btn text" onClick={() => setEditando(false)} aria-label="Fechar"><X size={20} aria-hidden="true" /></button></div>
            <div className="pro-seq-contador">
              <button className="btn outline" onClick={() => setRascunho(v => Math.max(1, v - 1))} aria-label="Menos"><Minus size={20} aria-hidden="true" /></button>
              <b>{rascunho}</b>
              <button className="btn outline" onClick={() => setRascunho(v => Math.min(14, v + 1))} aria-label="Mais"><Plus size={20} aria-hidden="true" /></button>
            </div>
            <p className="pro-sub pro-sem-margem">Contam as corridas que chegam do relógio e as provas que você registra.</p>
            <button className="btn solid" onClick={salvar}>Salvar meta</button>
          </div>
        </div>
      )}
    </section>
  );
}
