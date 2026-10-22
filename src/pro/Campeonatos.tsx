// Campeonatos: disputa prova a prova (pontos por colocação na nota por idade). O primeiro é a Liga Maranhense.
import { useEffect, useState } from 'react';
import { Trophy, ChevronRight, ArrowLeft, Check, CalendarDays, Footprints } from 'lucide-react';
import { sb, linkPerfil, type Perfil } from './sb';
import { Avatar } from './Foto';

type Camp = { id: string; nome: string; rotulo: string | null; premio: string | null; descricao: string | null; temporada: number; inicio: string; fim: string; melhores: number; tipo: 'etapas' | 'constancia'; provas: number; realizadas: number; atletas: number };
type Linha = { sexo: 'F' | 'M'; posicao: number; apelido: string; cidade: string; foto: string | null; pontos: number; provas: number; cidades: number; sequencias: number; eu: boolean | null };
type Prova = { prova_id: string; nome: string; data: string; cidade: string; oficiais: number };
const dataBR = (d: string) => d.slice(0, 10).split('-').reverse().slice(0, 2).join('/');

export function TelaCampeonatos({ perfil }: { perfil: Perfil }) {
  const [lista, setLista] = useState<Camp[] | null>(null);
  const [aberto, setAberto] = useState<Camp | null>(null);
  useEffect(() => { sb.rpc('radar_campeonatos_v2').then(({ data }) => setLista((data ?? []) as Camp[])); }, []);
  const hoje = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  if (aberto) return <Campeonato c={aberto} perfil={perfil} voltar={() => setAberto(null)} />;
  return (
    <div className="pro-cont">
      {lista === null && <p className="fine">Carregando…</p>}
      {lista?.map(c => (
        <button key={c.id} className={'pro-card azul pro-camp-card' + (c.inicio > hoje ? ' futuro' : '')} onClick={() => setAberto(c)}>
          <div className="pro-linha"><p className="pro-k">{c.tipo === 'constancia' ? <Footprints size={14} aria-hidden="true" /> : <Trophy size={14} aria-hidden="true" />} {c.rotulo ?? `Campeonato ${c.temporada}`}</p><ChevronRight size={20} aria-hidden="true" /></div>
          <p className="pro-camp-nome">{c.nome}{c.nome.includes(String(c.temporada)) ? '' : ` ${c.temporada}`}</p>
          {c.inicio > hoje
            ? <p className="pro-sub">Começa em {dataBR(c.inicio)}/{c.inicio.slice(0, 4)}. Toda prova oficial do ano vai contar.</p>
            : <><p className="pro-sub">{c.realizadas} de {c.provas} provas realizadas · {c.atletas} {c.atletas === 1 ? 'atleta pontuou' : 'atletas pontuaram'}</p>
              <div className="pro-trilha" aria-hidden="true"><span className="on" style={{ flex: Math.max(c.realizadas, 0.02) }} /><span style={{ flex: Math.max(c.provas - c.realizadas, 0.02) }} /></div></>}
          {c.premio && <p className="pro-camp-premio">{c.premio}</p>}
        </button>
      ))}
      <p className="fine pro-sem-margem">Liga: pontos pela colocação na nota por idade em cada prova. Copa da Constância: pontos por aparecer, sem tempo nem nota. Os dois só contam prova com resultado oficial.</p>
    </div>
  );
}

function Campeonato({ c, perfil, voltar }: { c: Camp; perfil: Perfil; voltar: () => void }) {
  const [sexo, setSexo] = useState<'F' | 'M'>(perfil.sexo);
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [provas, setProvas] = useState<Prova[] | null>(null);
  const [verProvas, setVerProvas] = useState(false);
  useEffect(() => {
    sb.rpc('radar_campeonato_tabela', { p_id: c.id }).then(({ data }) => setLinhas((data ?? []) as Linha[]));
    sb.rpc('radar_campeonato_provas', { p_id: c.id }).then(({ data }) => setProvas((data ?? []) as Prova[]));
  }, [c.id]);
  const tabela = (linhas ?? []).filter(l => l.sexo === sexo);
  const eu = (linhas ?? []).find(l => l.eu);
  const hoje = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  const feitas = (provas ?? []).filter(p => p.oficiais > 0), proximas = (provas ?? []).filter(p => p.data >= hoje && p.oficiais === 0);
  return (
    <div className="pro-cont">
      <button className="btn text pro-esq" onClick={voltar}><ArrowLeft size={16} aria-hidden="true" />Campeonatos</button>
      <section className="pro-card azul">
        <p className="pro-k">{c.tipo === 'constancia' ? <Footprints size={14} aria-hidden="true" /> : <Trophy size={14} aria-hidden="true" />} {c.rotulo ?? `Campeonato ${c.temporada}`}</p>
        <p className="pro-camp-nome">{c.nome}{c.nome.includes(String(c.temporada)) ? '' : ` ${c.temporada}`}</p>
        {eu ? <><p className="pro-big">{eu.posicao}º</p><p className="pro-sub">Você, no {eu.sexo === 'F' ? 'feminino' : 'masculino'}: <b>{eu.pontos} pontos</b> em {eu.provas} {eu.provas === 1 ? 'prova' : 'provas'}{c.tipo === 'constancia' ? ` · ${eu.cidades} ${eu.cidades === 1 ? 'cidade' : 'cidades'}${eu.sequencias ? ` · ${eu.sequencias} ${eu.sequencias === 1 ? 'sequência' : 'sequências'}` : ''}` : ''}.</p></>
          : <><p className="pro-medio">Entre na disputa</p><p className="pro-sub">Corra uma prova com resultado oficial e você já pontua.</p></>}
        <p className="pro-sub">{c.inicio > hoje ? `Começa em ${dataBR(c.inicio)}/${c.inicio.slice(0, 4)}.` : `${c.realizadas} de ${c.provas} provas realizadas.`}{c.tipo === 'etapas' ? ` Valem as ${c.melhores} melhores.` : ' Toda prova conta.'}</p>
      </section>
      {c.premio && <section className="pro-card pro-camp-premio-card"><p className="pro-k cinza"><Trophy size={14} aria-hidden="true" /> Em jogo</p><p className="pro-sem-margem">{c.premio}</p></section>}
      {c.descricao && <p className="fine pro-sem-margem">{c.descricao}{c.tipo === 'etapas' ? ' Pontos por prova: 25, 20, 16, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1 (do 15º em diante, 1 ponto). Empate: melhor etapa, depois mais etapas, depois a maior nota por idade.' : ' Sábado e domingo da mesma semana contam como um fim de semana só. Empate: mais provas, depois mais cidades.'}</p>}
      <div className="chips" role="group" aria-label="Tabela">
        <button className="chip" aria-pressed={sexo === 'F'} onClick={() => setSexo('F')}>Feminino</button>
        <button className="chip" aria-pressed={sexo === 'M'} onClick={() => setSexo('M')}>Masculino</button>
      </div>
      {linhas === null && <p className="fine">Carregando…</p>}
      {linhas && tabela.length === 0 && <p className="fine">Ninguém pontuou ainda nesta tabela. A primeira prova com resultado oficial abre a disputa.</p>}
      <ol className="pro-rank">
        {tabela.map(l => (
          <li key={l.apelido} className={(l.eu ? 'eu ' : '') + (l.posicao <= 3 ? `podio p${l.posicao}` : '')}>
            <button className="com-foto" disabled>
              <b>{l.posicao}</b>
              <Avatar foto={l.foto} apelido={l.apelido} tam={36} />
              <span>{l.eu ? <b>Você</b> : <a href={linkPerfil(l.apelido)} target="_blank" rel="noopener">@{l.apelido}</a>} <small>· {l.cidade} · {l.provas} {l.provas === 1 ? 'prova' : 'provas'}{c.tipo === 'constancia' ? ` · ${l.cidades} ${l.cidades === 1 ? 'cidade' : 'cidades'}${l.sequencias ? ` · ${l.sequencias}× 3 seguidos` : ''}` : ''}</small></span>
              <b>{l.pontos}</b>
            </button>
          </li>
        ))}
      </ol>
      <section className="pro-card">
        <div className="pro-linha"><p className="pro-k cinza"><CalendarDays size={14} aria-hidden="true" /> Provas do campeonato até agora</p><button className="btn text pro-btn-p" onClick={() => setVerProvas(v => !v)}>{verProvas ? 'Esconder' : 'Ver todas'}</button></div>
        {provas === null ? <p className="fine">Carregando…</p> : <ul className="pro-companheiros">
          {(verProvas ? provas : [...feitas.slice(-3), ...proximas.slice(0, 4)]).map(p => (
            <li key={p.prova_id}><span className={'pro-camp-ok' + (p.oficiais > 0 ? ' feita' : '')}>{p.oficiais > 0 ? <Check size={14} aria-hidden="true" /> : dataBR(p.data).slice(0, 2)}</span><div><b>{p.nome}</b><small>{dataBR(p.data)} · {p.cidade}{p.oficiais > 0 ? ` · ${p.oficiais} ${p.oficiais === 1 ? 'atleta pontuou' : 'atletas pontuaram'}` : ''}</small></div></li>
          ))}
        </ul>}
        <p className="fine pro-sem-margem">{!verProvas && provas && provas.length > 7 ? `Mostrando as últimas realizadas e as próximas; toque em "Ver todas" para a lista completa (${provas.length}). ` : ''}A lista cresce sozinha: toda prova do Maranhão que entra na agenda do Radar dentro do período passa a contar.</p>
      </section>
    </div>
  );
}
