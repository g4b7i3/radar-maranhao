// Feed "Aconteceu no Radar": provas verificadas, Rei/Rainha da prova e duelos, com a foto de cada atleta.
// Reação única (aplauso), sem comentários. Filtro "Quem eu sigo".
import { useEffect, useMemo, useState } from 'react';
import { Crown, Swords, Medal, Trophy, UserPlus, UserCheck } from 'lucide-react';
import { sb, MEDALHAS, relogio, pct, kmTxt, dataBR, linkPerfil, type Perfil } from './sb';
import { Avatar } from './Foto';
import { medalhaSVG } from './medalhas';

export type Evento = {
  quando: string; tipo: 'prova' | 'rei' | 'duelo'; alvo: string; apelido: string; foto: string | null; cidade: string;
  dados: { prova?: string; data?: string; cidade?: string; km?: number; tempo?: number; nota?: number; pontos?: number; geral?: number | null; total?: number | null; podio?: boolean; recorde?: boolean; medalhas?: string[]; sexo?: 'F' | 'M'; atletas?: number | null; adversario?: string; foto_adv?: string | null; mes?: string };
  aplausos: number; aplaudi: boolean;
};

const quandoTxt = (iso: string) => {
  const d = (Date.now() - new Date(iso).getTime()) / 60000;
  if (d < 60) return `há ${Math.max(1, Math.round(d))} min`;
  if (d < 36 * 60) return `há ${Math.round(d / 60)} h`;
  if (d < 30 * 24 * 60) return `há ${Math.round(d / 1440)} dias`;
  return dataBR(iso);
};

/** Botão de aplauso: uma reação por pessoa e por item. */
export function Aplauso({ alvo, n, feito, mudou }: { alvo: string; n: number; feito: boolean; mudou?: (n: number, feito: boolean) => void }) {
  const [st, setSt] = useState({ n, feito });
  const [indo, setIndo] = useState(false);
  useEffect(() => setSt({ n, feito }), [n, feito]);
  const toca = async () => {
    if (indo) return;
    setIndo(true);
    const novo = !st.feito;
    setSt(s => ({ n: s.n + (novo ? 1 : -1), feito: novo })); // resposta na hora
    const { data, error } = await sb.rpc('radar_aplaudir', { p_alvo: alvo, p_aplaudir: novo });
    if (!error && data) { setSt({ n: data.aplausos, feito: data.aplaudi }); mudou?.(data.aplausos, data.aplaudi); }
    setIndo(false);
  };
  return <button className={'pro-aplauso' + (st.feito ? ' on' : '')} onClick={toca} aria-pressed={st.feito} aria-label={st.feito ? 'Tirar aplauso' : 'Aplaudir'}>👏 <b>{st.n}</b></button>;
}

/** Botão seguir/seguindo. */
export function Seguir({ apelido, sigo, mudou }: { apelido: string; sigo: boolean; mudou: (sigo: boolean) => void }) {
  const [indo, setIndo] = useState(false);
  const toca = async () => {
    if (indo) return;
    setIndo(true);
    const { data, error } = await sb.rpc('radar_seguir', { p_apelido: apelido, p_seguir: !sigo });
    if (!error && data) mudou(data.sigo);
    setIndo(false);
  };
  return <button className={'btn ' + (sigo ? 'text' : 'outline') + ' pro-seguir'} disabled={indo} onClick={toca} aria-pressed={sigo}>{sigo ? <><UserCheck size={15} aria-hidden="true" />Seguindo</> : <><UserPlus size={15} aria-hidden="true" />Seguir</>}</button>;
}

function Meds({ ids }: { ids: string[] }) {
  const lista = ids.map(id => MEDALHAS.find(m => m.id === id)).filter(Boolean).slice(0, 4) as typeof MEDALHAS;
  const svgs = useMemo(() => lista.map(m => medalhaSVG(m, true, 34)), [lista]);
  if (!lista.length) return null;
  return (
    <div className="pro-feed-meds" title={ids.map(id => MEDALHAS.find(m => m.id === id)?.nome).filter(Boolean).join(', ')}>
      {svgs.map((s, i) => <span key={i} className="pro-med-svg" dangerouslySetInnerHTML={{ __html: s }} />)}
      <small>{ids.length > 4 ? `+${ids.length - 4} ${ids.length - 4 === 1 ? 'medalha' : 'medalhas'}` : ids.length === 1 ? 'medalha' : 'medalhas'}</small>
    </div>
  );
}

export function ItemFeed({ e, eu, sigo, mudouSigo, pro = true, assinar }: { e: Evento; eu: string; sigo?: boolean; mudouSigo?: (s: boolean) => void; pro?: boolean; assinar?: () => void }) {
  const d = e.dados, meu = e.apelido === eu;
  const nome = meu ? 'Você' : `@${e.apelido}`;
  return (
    <article className={'pro-card pro-feed-item ' + e.tipo}>
      <header className="pro-feed-topo">
        <a href={linkPerfil(e.apelido)}><Avatar foto={e.foto} apelido={e.apelido} tam={44} /></a>
        <div>
          <b><a href={linkPerfil(e.apelido)}>{nome}</a></b>
          <small>{e.cidade} · {quandoTxt(e.quando)}</small>
        </div>
        {!meu && sigo !== undefined && mudouSigo && (pro ? <Seguir apelido={e.apelido} sigo={sigo} mudou={mudouSigo} /> : <button className="btn outline pro-seguir" onClick={assinar} title="Só no Pro">🔒 Seguir</button>)}
      </header>
      {e.tipo === 'prova' && (
        <>
          <p className="pro-feed-txt"><Trophy size={16} aria-hidden="true" /> {d.podio ? 'Subiu ao pódio na' : 'Correu a'} <b>{d.prova}</b> ({d.data ? dataBR(d.data) : ''}, {d.cidade}): <b>{kmTxt(Number(d.km))} em {relogio(Number(d.tempo))}</b>, nota {pct(d.nota)}%{d.geral ? ` · ${d.geral}º geral${d.total ? ` de ${d.total}` : ''}` : ''}{d.recorde ? ' · recorde pessoal' : ''}.</p>
          {d.medalhas?.length ? <Meds ids={d.medalhas} /> : null}
        </>
      )}
      {e.tipo === 'rei' && (
        <p className="pro-feed-txt"><Crown size={16} aria-hidden="true" /> É {d.sexo === 'F' ? <b>Rainha</b> : <b>Rei</b>} da prova nos {kmTxt(Number(d.km))} da <b>{d.prova}</b>: melhor nota por idade entre {d.atletas ? `${d.atletas} atletas` : 'todos'} ({pct(d.nota)}%, {relogio(Number(d.tempo))}).</p>
      )}
      {e.tipo === 'duelo' && (
        <p className="pro-feed-txt"><Swords size={16} aria-hidden="true" /> Duelo de <b>{kmTxt(Number(d.km))}</b> aceito contra <a href={linkPerfil(d.adversario!)}>@{d.adversario}</a>{d.mes ? ` em ${new Date(d.mes.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' })}` : ''}. Vence a maior nota por idade.</p>
      )}
      <footer className="pro-feed-pe">{pro ? <Aplauso alvo={e.alvo} n={e.aplausos} feito={e.aplaudi} /> : <button className="pro-aplauso" onClick={assinar} title="Só no Pro">👏 <b>{e.aplausos}</b> <small>só no Pro</small></button>}{e.tipo === 'prova' && d.pontos ? <small><Medal size={13} aria-hidden="true" /> +{d.pontos} pts</small> : null}</footer>
    </article>
  );
}

export function TelaFeed({ perfil, pro = true, assinar }: { perfil: Perfil; pro?: boolean; assinar?: () => void }) {
  const [soSigo, setSoSigo] = useState(false);
  const [lista, setLista] = useState<Evento[] | null>(null);
  const [sigo, setSigo] = useState<Set<string>>(new Set());
  useEffect(() => { sb.rpc('radar_sigo').then(({ data }) => setSigo(new Set((data as string[]) ?? []))); }, []);
  useEffect(() => { setLista(null); sb.rpc('radar_feed', { p_so_sigo: soSigo }).then(({ data }) => setLista((data as Evento[]) ?? [])); }, [soSigo]);
  const mudou = (ap: string) => (s: boolean) => setSigo(prev => { const n = new Set(prev); if (s) n.add(ap); else n.delete(ap); return n; });
  return (
    <div className="pro-cont">
      <div className="chips" role="group" aria-label="Filtro do feed">
        <button className="chip" aria-pressed={!soSigo} onClick={() => setSoSigo(false)}>Todo mundo</button>
        <button className="chip" aria-pressed={soSigo} onClick={() => pro ? setSoSigo(true) : assinar?.()}>{pro ? '' : '🔒 '}Quem eu sigo{sigo.size ? ` (${sigo.size})` : ''}</button>
      </div>
      {lista === null && <p className="fine">Carregando…</p>}
      {lista?.length === 0 && <p className="fine">{soSigo ? 'Você ainda não segue ninguém. Toque em “Seguir” nos atletas do feed ou do ranking.' : 'Ainda não aconteceu nada. A primeira prova verificada aparece aqui.'}</p>}
      {lista?.map(e => <ItemFeed key={e.alvo} e={e} eu={perfil.apelido} sigo={sigo.has(e.apelido)} mudouSigo={mudou(e.apelido)} pro={pro} assinar={assinar} />)}
      {lista && lista.length > 0 && <p className="fine pro-centro">Aqui aparece o que vem do resultado oficial: provas verificadas, Rei e Rainha da prova e duelos. Sem comentários, só aplausos.</p>}
    </div>
  );
}
