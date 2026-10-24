// Feed "Aconteceu no Radar": provas verificadas, Rei/Rainha da prova e duelos, com a foto de cada atleta.
// Reações (👏 🔥 😮), comentários com @menções e filtro "Quem eu sigo".
import { linhaIdade } from './X1';
import { useEffect, useMemo, useState } from 'react';
import { Crown, Swords, Medal, Trophy, UserPlus, UserCheck, Image as ImagemIc, X, Send, Trash2, Flag, ChevronDown } from 'lucide-react';
import { sb, MEDALHAS, relogio, pct, kmTxt, dataBR, linkPerfil, type Perfil, souAdmin } from './sb';
import { Avatar, reduzirFoto } from './Foto';
import { medalhaSVG } from './medalhas';
import { TextoRico, CampoTexto, BotaoComentar, Comentarios, SugestoesSeguir, pegarItemPedido } from './Social';
import { useVoltar, telaInicial } from './voltar';

export type Evento = {
  quando: string; tipo: 'prova' | 'rei' | 'duelo' | 'post' | 'x1'; alvo: string; apelido: string; foto: string | null; cidade: string;
  dados: { prova?: string; data?: string; cidade?: string; km?: number; tempo?: number; nota?: number; pontos?: number; geral?: number | null; total?: number | null; podio?: boolean; recorde?: boolean; medalhas?: string[]; sexo?: 'F' | 'M'; atletas?: number | null; adversario?: string; foto_adv?: string | null; mes?: string; perdedor?: string; foto_perdedor?: string | null; local?: string | null; tempo_v?: number; tempo_p?: number; empate?: boolean; nota_v?: number | null; nota_p?: number | null };
  reacoes: Reacoes; minha: TipoReacao | null; comentarios?: number;
};
type DadosPost = { id?: string; texto?: string; foto?: string | null; meu?: boolean };

const quandoTxt = (iso: string) => {
  const d = (Date.now() - new Date(iso).getTime()) / 60000;
  if (d < 60) return `há ${Math.max(1, Math.round(d))} min`;
  if (d < 36 * 60) return `há ${Math.round(d / 60)} h`;
  if (d < 30 * 24 * 60) return `há ${Math.round(d / 1440)} dias`;
  return dataBR(iso);
};

export type Reacoes = { palma: number; fogo: number; uau: number };
export type TipoReacao = keyof Reacoes;
export const REACOES: { id: TipoReacao; e: string; nome: string }[] = [{ id: 'palma', e: '👏', nome: 'Palmas' }, { id: 'fogo', e: '🔥', nome: 'Fogo' }, { id: 'uau', e: '😮', nome: 'Uau' }];
const ZERO: Reacoes = { palma: 0, fogo: 0, uau: 0 };

/** Reações: uma por pessoa e por item (tocar de novo tira; tocar outra troca). */
export function Aplauso({ alvo, reacoes, minha, travado, onTravado }: { alvo: string; reacoes?: Reacoes | null; minha?: TipoReacao | null; travado?: boolean; onTravado?: () => void }) {
  const [st, setSt] = useState<{ r: Reacoes; minha: TipoReacao | null }>({ r: reacoes ?? ZERO, minha: minha ?? null });
  const [indo, setIndo] = useState(false);
  useEffect(() => setSt({ r: reacoes ?? ZERO, minha: minha ?? null }), [reacoes, minha]);
  const toca = async (t: TipoReacao) => {
    if (travado) return onTravado?.();
    if (indo) return;
    setIndo(true);
    const tira = st.minha === t;
    const antes = st;
    setSt(s => { const r = { ...s.r }; if (s.minha) r[s.minha]--; if (!tira) r[t]++; return { r, minha: tira ? null : t }; }); // resposta na hora
    const { data, error } = await sb.rpc('radar_aplaudir', { p_alvo: alvo, p_aplaudir: !tira, p_tipo: t });
    if (!error && data) setSt({ r: { palma: data.palma, fogo: data.fogo, uau: data.uau }, minha: data.minha });
    else setSt(antes); // não gravou: volta como estava, em vez de mostrar uma reação que some ao atualizar
    setIndo(false);
  };
  return (
    <div className="pro-reacoes" role="group" aria-label="Reações">
      {REACOES.map(x => <button key={x.id} className={'pro-aplauso' + (st.minha === x.id ? ' on' : '')} onClick={() => toca(x.id)} aria-pressed={st.minha === x.id} aria-label={x.nome} title={travado ? 'Só no Pro' : x.nome}>{x.e} <b>{st.r[x.id]}</b></button>)}
      {travado && <small className="pro-reacoes-trava">só no Pro</small>}
    </div>
  );
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

export function ItemFeed({ e, eu, sigo, mudouSigo, pro = true, assinar, apagou, comentariosAbertos = false }: { e: Evento; eu: string; sigo?: boolean; mudouSigo?: (s: boolean) => void; pro?: boolean; assinar?: () => void; apagou?: () => void; comentariosAbertos?: boolean }) {
  const d = e.dados, meu = e.apelido === eu;
  const post = e.tipo === 'post' ? (e.dados as unknown as DadosPost) : null;
  const adm = souAdmin.v;
  // apagar: o próprio post; tirar do feed: duelo/X1 de quem participou. O admin pode tudo.
  const participa = e.tipo === 'duelo' ? (e.apelido === eu || d.adversario === eu) : e.tipo === 'x1' ? (e.apelido === eu || d.perdedor === eu) : false;
  const podeApagar = (post && (meu || post.meu || adm)) || ((e.tipo === 'duelo' || e.tipo === 'x1') && (participa || adm));
  const [sumiu, setSumiu] = useState(false);
  const [verComent, setVerComent] = useState(comentariosAbertos);
  const [nComent, setNComent] = useState(e.comentarios ?? 0);
  useEffect(() => setNComent(e.comentarios ?? 0), [e.comentarios]);
  const apagar = async () => {
    if (!confirm(post ? 'Apagar este post?' : 'Tirar do feed?')) return;
    const { data } = await sb.rpc('radar_feed_ocultar', { p_alvo: post?.id ? `post:${post.id}` : e.alvo });
    if (data) { setSumiu(true); apagou?.(); } else alert('Não deu para apagar agora.');
  };
  if (sumiu) return null;
  const nome = meu ? 'Você' : `@${e.apelido}`;
  return (
    <article className={'pro-card pro-feed-item ' + e.tipo}>
      <header className="pro-feed-topo">
        <a href={linkPerfil(e.apelido)}><Avatar foto={e.foto} apelido={e.apelido} tam={44} /></a>
        <div>
          <b><a href={linkPerfil(e.apelido)}>{nome}</a></b>
          <small>{e.cidade} · {quandoTxt(e.quando)}</small>
        </div>
        {!meu && sigo !== undefined && mudouSigo && <Seguir apelido={e.apelido} sigo={sigo} mudou={mudouSigo} />}
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
      {post && <>
        {post.texto && <p className="pro-feed-post"><TextoRico texto={post.texto} /></p>}
        {post.foto && <img className="pro-feed-foto" src={post.foto} alt="" loading="lazy" />}
      </>}
      {e.tipo === 'duelo' && (
        <p className="pro-feed-txt"><Swords size={16} aria-hidden="true" /> Duelo de <b>{kmTxt(Number(d.km))}</b> aceito contra <a href={linkPerfil(d.adversario!)}>@{d.adversario}</a>{d.mes ? ` em ${new Date(d.mes.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' })}` : ''}. Vence a maior nota por idade.</p>
      )}
      {e.tipo === 'x1' && (
        <div className="pro-feed-x1">
          <p className="pro-feed-txt"><Swords size={16} aria-hidden="true" /> {d.empate ? 'Empatou o X1' : 'Venceu o X1'} de <b>{kmTxt(Number(d.km))}</b> contra <a href={linkPerfil(d.perdedor!)}>@{d.perdedor}</a>{d.local ? ` · ${d.local}` : ''}{d.data ? ` · ${dataBR(d.data)}` : ''}</p>
          <div className="pro-feed-x1-placar">
            <span className="v"><Avatar foto={e.foto} apelido={e.apelido} tam={34} /><b>{relogio(Number(d.tempo_v))}</b><small>{d.empate ? 'empatou' : 'venceu'}</small></span>
            <em>vs</em>
            <span className={d.empate ? 'v' : 'p'}><Avatar foto={d.foto_perdedor ?? null} apelido={d.perdedor!} tam={34} /><b>{relogio(Number(d.tempo_p))}</b><small>{d.empate ? 'empatou' : 'foi derrotado'}</small></span>
          </div>
          {(() => { const l = linhaIdade(`@${e.apelido}`, d.nota_v, `@${d.perdedor}`, d.nota_p); return l ? <p className="pro-x1-idade">{l}</p> : null; })()}
        </div>
      )}
      <footer className="pro-feed-pe"><span className="pro-feed-acoes"><Aplauso alvo={e.alvo} reacoes={e.reacoes} minha={e.minha} /><BotaoComentar n={nComent} aberto={verComent} onClick={() => setVerComent(v => !v)} /></span>{e.tipo === 'prova' && d.pontos ? <small><Medal size={13} aria-hidden="true" /> +{d.pontos} pts</small> : null}{podeApagar ? <button className="btn text pro-feed-apagar" onClick={apagar} aria-label={post ? 'Apagar post' : 'Tirar do feed'} title={post ? 'Apagar post' : 'Tirar do feed'}><Trash2 size={15} aria-hidden="true" /></button> : post?.id ? <Sinalizar postId={post.id} /> : null}</footer>
      {verComent && <Comentarios alvo={e.alvo} mudouTotal={setNComent} />}
    </article>
  );
}

/** Sinalizar um post de outra pessoa: cai no Admin e no resumo diário. */
function Sinalizar({ postId }: { postId: string }) {
  const [feito, setFeito] = useState(false);
  const enviar = async () => {
    const motivo = prompt('O que tem de errado neste post? (opcional)') ?? null;
    if (motivo === null) return;
    const { error } = await sb.rpc('radar_sinalizar_post', { p_post: postId, p_motivo: motivo });
    if (error) alert(error.message.replace(/^.*?: /, '')); else setFeito(true);
  };
  return feito ? <small className="pro-feed-sinal">Sinalizado. Valeu.</small> : <button className="btn text pro-feed-apagar" onClick={enviar} aria-label="Sinalizar post" title="Sinalizar"><Flag size={14} aria-hidden="true" /></button>;
}

/* ───────── Aniversariantes do mês: a galera reage com 👏 🔥 😮 (o aniversariante recebe no sininho) ───────── */
type Aniver = { apelido: string; foto: string | null; cidade: string; dia: number; hoje: boolean; alvo: string; reacoes: Reacoes; minha: TipoReacao | null; eu: boolean };
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
function Aniversariantes() {
  const [lista, setLista] = useState<Aniver[] | null>(null);
  const [todos, setTodos] = useState(false);
  const [aberto, setAberto] = useState(() => { try { return localStorage.getItem('radar-aniver-aberto') === '1'; } catch { return false; } });
  const trocar = () => { const v = !aberto; setAberto(v); try { localStorage.setItem('radar-aniver-aberto', v ? '1' : '0'); } catch { /* */ } };
  useEffect(() => { sb.rpc('radar_aniversariantes').then(({ data }) => setLista((data ?? []) as Aniver[])); }, []);
  if (!lista?.length) return null;
  const mes = MESES[new Date(Date.now() - 3 * 3600_000).getUTCMonth()];
  const vis = todos ? lista : lista.slice(0, 5);
  return (
    <section className="pro-card pro-aniver">
      <button className="pro-aniver-tit" onClick={trocar} aria-expanded={aberto}>
        <span>🎂 Aniversariantes de {mes}</span>
        <small>{lista.length}</small>
        {lista.some(a => a.hoje) && <em>{lista.filter(a => a.hoje).length} hoje 🎉</em>}
        <ChevronDown size={18} aria-hidden="true" className={'pro-aniver-seta' + (aberto ? ' virado' : '')} />
      </button>
      {aberto && <>
      <ul>
        {vis.map(a => (
          <li key={a.apelido} className={a.hoje ? 'hoje' : ''}>
            <a href={`/?atleta=${encodeURIComponent(a.apelido)}`} className="pro-aniver-quem">
              <Avatar foto={a.foto} apelido={a.apelido} tam={40} />
              <span className="pro-aniver-txt"><b>{a.eu ? 'Você' : `@${a.apelido}`}</b><small>{a.hoje ? 'Hoje! 🎉' : `Dia ${a.dia}`} · {a.cidade}</small></span>
            </a>
            {!a.eu && <Aplauso alvo={a.alvo} reacoes={a.reacoes} minha={a.minha} />}
          </li>
        ))}
      </ul>
      {lista.length > 5 && <button className="btn text pro-btn-p" onClick={() => setTodos(!todos)}>{todos ? 'Ver menos' : `Ver todos (${lista.length})`}</button>}
      </>}
    </section>
  );
}

export function TelaFeed({ perfil, pro = true, assinar }: { perfil: Perfil; pro?: boolean; assinar?: () => void }) {
  const [soSigo, setSoSigo] = useState(false);
  const [lista, setLista] = useState<Evento[] | null>(null);
  const [sigo, setSigo] = useState<Set<string>>(new Set());
  useEffect(() => { sb.rpc('radar_sigo').then(({ data }) => setSigo(new Set((data as string[]) ?? []))); }, []);
  const carregar = () => sb.rpc('radar_feed', { p_so_sigo: soSigo }).then(({ data }) => setLista((data as Evento[]) ?? []));
  useEffect(() => { setLista(null); carregar(); }, [soSigo]); // eslint-disable-line react-hooks/exhaustive-deps
  const mudou = (ap: string) => (s: boolean) => setSigo(prev => { const n = new Set(prev); if (s) n.add(ap); else n.delete(ap); return n; });
  // item aberto pelo aviso de comentário/menção (#feed/ver/<alvo>)
  const [ver, setVer] = useState<string | null>(() => { const t = telaInicial('feed'); return t?.startsWith('ver/') ? t.slice(4) : pegarItemPedido(); });
  useEffect(() => { const f = (ev: Event) => { pegarItemPedido(); setVer((ev as CustomEvent<string>).detail); }; window.addEventListener('radar-ver-item', f); return () => window.removeEventListener('radar-ver-item', f); }, []);
  return (
    <div className="pro-cont">
      {ver && <ItemAberto alvo={ver} eu={perfil.apelido} fechar={() => setVer(null)} />}
      <div className="chips" role="group" aria-label="Filtro do feed">
        <button className="chip" aria-pressed={!soSigo} onClick={() => setSoSigo(false)}>Todo mundo</button>
        <button className="chip" aria-pressed={soSigo} onClick={() => setSoSigo(true)}>Quem eu sigo{sigo.size ? ` (${sigo.size})` : ''}</button>
      </div>
      <Aniversariantes />
      <SugestoesSeguir mudouSigo={(ap, v) => mudou(ap)(v)} />
      <Publicar perfil={perfil} pro={pro} assinar={assinar} publicou={carregar} />
      {lista === null && <p className="fine">Carregando…</p>}
      {lista?.length === 0 && <p className="fine">{soSigo ? 'Você ainda não segue ninguém. Toque em “Seguir” nos atletas do feed ou do ranking.' : 'Ainda não aconteceu nada. A primeira prova verificada aparece aqui.'}</p>}
      {lista?.map(e => <ItemFeed key={e.alvo} e={e} eu={perfil.apelido} sigo={sigo.has(e.apelido)} mudouSigo={mudou(e.apelido)} pro={pro} assinar={assinar} apagou={carregar} />)}
      {lista && lista.length > 0 && <p className="fine pro-centro">Aqui aparece o que a galera publica e o que vem do resultado oficial: provas verificadas, Rei e Rainha da prova e duelos. Reaja, comente e cite os amigos com @.</p>}
    </div>
  );
}

/* ───────── Um item só, por cima do feed (aviso de comentário ou menção), já com os comentários abertos ───────── */
function ItemAberto({ alvo, eu, fechar }: { alvo: string; eu: string; fechar: () => void }) {
  const [e, setE] = useState<Evento | null | undefined>(undefined);
  useVoltar(true, fechar, `ver/${alvo}`);
  useEffect(() => { setE(undefined); sb.rpc('radar_item', { p_alvo: alvo }).then(({ data, error }) => setE(error ? null : (data as Evento | null))); }, [alvo]);
  return (
    <div className="pro-notif-fundo pro-item-fundo" onClick={fechar}>
      <section className="pro-item-aberto" onClick={ev => ev.stopPropagation()} role="dialog" aria-label="Publicação">
        <div className="pro-linha"><p className="pro-k cinza">Publicação</p><button className="btn text" onClick={fechar} aria-label="Fechar"><X size={18} aria-hidden="true" /></button></div>
        {e === undefined && <p className="fine">Carregando…</p>}
        {e === null && <p className="fine">Essa publicação foi apagada ou não está mais disponível.</p>}
        {e && <ItemFeed e={e} eu={eu} comentariosAbertos apagou={fechar} />}
      </section>
    </div>
  );
}

/* ───────── Publicar: texto até 1000 caracteres (10 por dia) e foto a cada 2 dias, reduzida no celular. Só no Pro. ───────── */
export function Publicar({ perfil, pro, assinar, publicou, comunidade, dica }: { perfil: Perfil; pro: boolean; assinar?: () => void; publicou: () => void; comunidade?: { id: string; nome: string }; dica?: string }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const [foto, setFoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [proximaFoto, setProximaFoto] = useState<string | null>(null); // quando a próxima foto libera (null = agora)
  const [indo, setIndo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => { if (aberto && pro) sb.rpc('radar_post_proxima_foto').then(({ data }) => setProximaFoto((data as string | null) ?? null)); }, [aberto, pro]);
  const fotoLiberada = !proximaFoto || new Date(proximaFoto) <= new Date();
  const quandoLibera = proximaFoto ? new Date(proximaFoto).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' às') : '';
  const escolher = async (f: File | null) => { if (!f) return; setErro(null); const blob = await reduzirFoto(f, 800, .82); if (foto) URL.revokeObjectURL(foto.url); setFoto({ blob, url: URL.createObjectURL(blob) }); };
  const limpar = () => { if (foto) URL.revokeObjectURL(foto.url); setFoto(null); setTexto(''); setAberto(false); setErro(null); };
  const enviar = async () => {
    if (!texto.trim() && !foto) return setErro('Escreva algo ou escolha uma foto.');
    setIndo(true); setErro(null);
    let fotoUrl: string | null = null;
    if (foto) {
      const caminho = `${perfil.user_id}/${Date.now()}.jpg`;
      const { error } = await sb.storage.from('posts').upload(caminho, foto.blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });
      if (error) { setIndo(false); return setErro('Não deu para enviar a foto. Tente de novo.'); }
      fotoUrl = sb.storage.from('posts').getPublicUrl(caminho).data.publicUrl;
    }
    const { error } = await sb.rpc('radar_publicar', { p_texto: texto, p_foto_url: fotoUrl, p_comunidade: comunidade?.id ?? null });
    setIndo(false);
    if (error) return setErro(error.message.replace(/^.*?: /, ''));
    limpar(); publicou();
  };
  const max = pro ? 1000 : 600; // modo grátis: texto até 600, sem foto
  if (!aberto) return <button className="pro-card pro-publicar-fechado" onClick={() => setAberto(true)}><Avatar foto={perfil.foto_url ?? null} apelido={perfil.apelido} tam={36} /><span>{dica ?? 'Conta aí: como foi o treino, a prova, a cidade…'}</span><ImagemIc size={20} aria-hidden="true" /></button>;
  return (
    <section className="pro-card pro-publicar">
      <div className="pro-linha"><p className="pro-k cinza">{comunidade ? `Publicar em ${comunidade.nome}` : 'Publicar no feed'}</p><button className="btn text" onClick={limpar} aria-label="Fechar"><X size={18} aria-hidden="true" /></button></div>
      <CampoTexto valor={texto} mudou={setTexto} max={max} rows={4} placeholder={comunidade ? `Só quem está em ${comunidade.nome} vê. Treino, prova, dica, pergunta… Use @ para citar alguém.` : 'Como foi? Treino, prova, cidade… Use @ para citar alguém.'} autoFocus rotulo="Texto do post" />
      {foto && <div className="pro-publicar-previa"><img src={foto.url} alt="" /><button className="btn solid" onClick={() => { URL.revokeObjectURL(foto.url); setFoto(null); }} aria-label="Tirar foto"><X size={16} aria-hidden="true" /></button></div>}
      <div className="pro-linha">
        {!pro ? <button className="btn text pro-btn-p" onClick={assinar} title="Foto é do Radar Pro"><ImagemIc size={16} aria-hidden="true" />🔒 Foto</button> : fotoLiberada
          ? <label className="btn outline pro-btn-p"><ImagemIc size={16} aria-hidden="true" />{foto ? 'Trocar foto' : 'Foto'}<input type="file" accept="image/*" hidden onChange={e => escolher(e.target.files?.[0] ?? null)} /></label>
          : <small title={`Foto: uma a cada 2 dias. Libera em ${quandoLibera}.`}><ImagemIc size={14} aria-hidden="true" /> foto libera {quandoLibera}</small>}
        <small className={texto.length > max - 50 ? 'pro-vermelho-txt' : ''}>{texto.length}/{max}</small>
        <button className="btn solid pro-btn-p" disabled={indo || (!texto.trim() && !foto)} onClick={enviar}><Send size={16} aria-hidden="true" />{indo ? 'Publicando…' : 'Publicar'}</button>
      </div>
      {erro && <p className="ct-erro" role="alert">{erro}</p>}
      <p className="fine pro-sem-margem">{pro ? 'Texto até 1000 caracteres, 10 posts por dia. Foto: uma a cada 2 dias, reduzida pra 800 px antes de subir.' : 'Modo grátis: texto até 600 caracteres, 10 posts por dia. Foto (uma a cada 2 dias) é do Radar Pro.'} Pode colar links: eles ficam clicáveis. Escreva @apelido para citar alguém: a pessoa recebe no sininho. A galera reage com 👏 🔥 😮 e comenta.</p>
    </section>
  );
}

