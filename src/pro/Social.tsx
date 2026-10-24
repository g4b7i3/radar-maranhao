// Radar Pro · rede social: comentários, menções (@apelido), "quem eu sigo vai" na ficha da prova e sugestões de quem seguir.
// Apagar: cada pessoa apaga só o que escreveu; o admin apaga de todo mundo (o servidor confere de novo).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MessageCircle, Send, Trash2, X, Check, Users } from 'lucide-react';
import { sb, linkPerfil, souAdmin } from './sb';
import { Avatar } from './Foto';
import { Seguir } from './Feed';
import type { Race } from '../lib';

const quandoTxt = (iso: string) => {
  const d = (Date.now() - new Date(iso).getTime()) / 60000;
  if (d < 1) return 'agora';
  if (d < 60) return `${Math.round(d)} min`;
  if (d < 36 * 60) return `${Math.round(d / 60)} h`;
  if (d < 30 * 24 * 60) return `${Math.round(d / 1440)} d`;
  return iso.slice(0, 10).split('-').reverse().slice(0, 2).join('/');
};
const erroTxt = (m?: string) => (m ?? 'Algo deu errado. Tente de novo.').replace(/^.*?: /, '');

/* ───────── Texto com links clicáveis e @menções que abrem o perfil ───────── */
const RE_LINK = /((?:https?:\/\/|www\.)[^\s<>"']+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|com\.br|br|net|org|app|io|me|info|blog|link|site|store|run)(?:\/[^\s<>"']*)?)/gi;
const RE_MENCAO = /(^|[^a-zA-Z0-9_.@])@([a-zA-Z0-9_.]{3,21})/g;

function SoLinks({ texto }: { texto: string }) {
  const partes: (string | { href: string; txt: string })[] = [];
  let i = 0;
  for (const m of texto.matchAll(RE_LINK)) {
    let bruto = m[0]; const ini = m.index ?? 0;
    const sobra = bruto.match(/[.,;:!?)\]]+$/)?.[0] ?? ''; // pontuação no fim da frase não faz parte do link
    if (sobra) bruto = bruto.slice(0, -sobra.length);
    if (ini > 0 && texto[ini - 1] === '@') continue; // e-mail
    let href = /^https?:\/\//i.test(bruto) ? bruto : 'https://' + bruto;
    try { const u = new URL(href); if (!/^https?:$/.test(u.protocol)) continue; href = u.href; } catch { continue; }
    partes.push(texto.slice(i, ini));
    const curto = bruto.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
    partes.push({ href, txt: curto.length > 40 ? curto.slice(0, 38) + '…' : curto });
    i = ini + bruto.length;
  }
  partes.push(texto.slice(i));
  return <>{partes.map((x, k) => typeof x === 'string' ? x : <a key={k} className="pro-feed-link" href={x.href} target="_blank" rel="noopener noreferrer nofollow ugc">{x.txt}</a>)}</>;
}

export function TextoRico({ texto }: { texto: string }) {
  const out: ReactNode[] = [];
  let i = 0, k = 0;
  for (const m of texto.matchAll(RE_MENCAO)) {
    const ap = m[2].replace(/\.+$/, '');
    const ini = (m.index ?? 0) + m[1].length;
    out.push(<SoLinks key={k++} texto={texto.slice(i, ini)} />);
    out.push(<a key={k++} className="pro-mencao" href={linkPerfil(ap.toLowerCase())}>@{ap}</a>);
    i = ini + 1 + ap.length;
  }
  out.push(<SoLinks key={k++} texto={texto.slice(i)} />);
  return <>{out}</>;
}

/* ───────── Campo de texto com sugestão de @apelido enquanto digita ───────── */
type Sugestao = { apelido: string; nome: string; foto: string | null; cidade: string };
export function CampoTexto({ valor, mudou, max, rows = 3, placeholder, autoFocus, rotulo }: { valor: string; mudou: (v: string) => void; max: number; rows?: number; placeholder?: string; autoFocus?: boolean; rotulo?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [sug, setSug] = useState<{ lista: Sugestao[]; ini: number; fim: number } | null>(null);
  const pedido = useRef(0);
  const olhar = (texto: string, cursor: number) => {
    const antes = texto.slice(0, cursor);
    const m = antes.match(/(^|\s)@([a-zA-Z0-9_.]{1,20})$/);
    if (!m) { setSug(null); return; }
    const termo = m[2], ini = cursor - termo.length - 1, n = ++pedido.current;
    setTimeout(async () => {
      if (n !== pedido.current) return; // digitou de novo: espera parar
      const { data } = await sb.rpc('radar_atletas_sugerir', { p_txt: termo });
      if (n !== pedido.current) return;
      const lista = (data as Sugestao[] | null) ?? [];
      setSug(lista.length ? { lista, ini, fim: cursor } : null);
    }, 220);
  };
  const escolher = (ap: string) => {
    if (!sug) return;
    const novo = valor.slice(0, sug.ini) + '@' + ap + ' ' + valor.slice(sug.fim);
    mudou(novo.slice(0, max)); setSug(null);
    requestAnimationFrame(() => { const el = ref.current; if (!el) return; const p = Math.min(sug.ini + ap.length + 2, el.value.length); el.focus(); el.setSelectionRange(p, p); });
  };
  return (
    <div className="pro-campo-mencao">
      <textarea ref={ref} value={valor} rows={rows} placeholder={placeholder} autoFocus={autoFocus} aria-label={rotulo}
        onChange={e => { const v = e.target.value.slice(0, max); mudou(v); olhar(v, e.target.selectionStart ?? v.length); }}
        onKeyDown={e => { if (e.key === 'Escape' && sug) { e.stopPropagation(); setSug(null); } }}
        onBlur={() => setTimeout(() => setSug(null), 200)} />
      {sug && (
        <ul className="pro-mencao-lista" role="listbox" aria-label="Atletas">
          {sug.lista.map(s => (
            <li key={s.apelido}><button type="button" onMouseDown={e => e.preventDefault()} onClick={() => escolher(s.apelido)}>
              <Avatar foto={s.foto} apelido={s.apelido} tam={28} /><span><b>@{s.apelido}</b><small>{s.nome} · {s.cidade}</small></span>
            </button></li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ───────── Comentários de um item do feed ───────── */
type Comentario = { id: string; apelido: string; foto: string | null; texto: string; quando: string; meu: boolean; pode_apagar: boolean };
export const MAX_COMENTARIO = 1000;

export function BotaoComentar({ n, aberto, onClick }: { n: number; aberto: boolean; onClick: () => void }) {
  return <button className={'pro-aplauso pro-comentar-btn' + (aberto ? ' on' : '')} onClick={onClick} aria-expanded={aberto} aria-label={n ? `${n} comentários` : 'Comentar'} title="Comentar"><MessageCircle size={16} aria-hidden="true" />{n > 0 && <b>{n}</b>}</button>;
}

export function Comentarios({ alvo, mudouTotal }: { alvo: string; mudouTotal?: (n: number) => void }) {
  const [lista, setLista] = useState<Comentario[] | null>(null);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [indo, setIndo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const total = useRef(mudouTotal); total.current = mudouTotal;
  useEffect(() => {
    let vivo = true;
    sb.rpc('radar_comentarios', { p_alvo: alvo }).then(({ data, error }) => {
      if (!vivo) return;
      if (error) { setErroLista(/function|does not exist|schema cache/i.test(error.message) ? 'Os comentários ainda estão sendo ligados. Tente mais tarde.' : erroTxt(error.message)); setLista([]); return; }
      const l = (data as Comentario[]) ?? []; setLista(l); total.current?.(l.length);
    });
    return () => { vivo = false; };
  }, [alvo]);
  const enviar = async () => {
    const t = texto.trim();
    if (!t || indo) return;
    setIndo(true); setErro(null);
    const { data, error } = await sb.rpc('radar_comentar', { p_alvo: alvo, p_texto: t });
    setIndo(false);
    if (error) return setErro(erroTxt(error.message));
    setTexto('');
    setLista(l => { const n = [...(l ?? []), data as Comentario]; total.current?.(n.length); return n; });
  };
  const apagar = async (c: Comentario) => {
    if (!confirm(c.meu ? 'Apagar o seu comentário?' : `Apagar o comentário de @${c.apelido}?`)) return;
    const { data } = await sb.rpc('radar_comentario_apagar', { p_id: c.id });
    if (!data) return alert('Não deu para apagar agora.');
    setLista(l => { const n = (l ?? []).filter(x => x.id !== c.id); total.current?.(n.length); return n; });
  };
  return (
    <div className="pro-comentarios">
      {lista === null && <p className="fine">Carregando…</p>}
      {erroLista && <p className="fine">{erroLista}</p>}
      {lista && lista.length > 0 && (
        <ul>
          {lista.map(c => (
            <li key={c.id}>
              <a href={linkPerfil(c.apelido)} className="pro-coment-av"><Avatar foto={c.foto} apelido={c.apelido} tam={30} /></a>
              <div className="pro-coment-balao">
                <p className="pro-coment-quem"><a href={linkPerfil(c.apelido)}>{c.meu ? 'Você' : `@${c.apelido}`}</a><small>{quandoTxt(c.quando)}</small>
                  {(c.pode_apagar || souAdmin.v) && <button className="btn text pro-coment-apagar" onClick={() => apagar(c)} aria-label="Apagar comentário" title="Apagar"><Trash2 size={14} aria-hidden="true" /></button>}</p>
                <p className="pro-coment-txt"><TextoRico texto={c.texto} /></p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {lista && !erroLista && (
        <div className="pro-coment-novo">
          <CampoTexto valor={texto} mudou={setTexto} max={MAX_COMENTARIO} rows={2} placeholder={lista.length ? 'Responder… use @ para citar alguém' : 'Seja o primeiro a comentar. Use @ para citar alguém'} rotulo="Escrever comentário" />
          <div className="pro-linha">
            <small className={texto.length > MAX_COMENTARIO - 50 ? 'pro-vermelho-txt' : ''}>{texto.length}/{MAX_COMENTARIO}</small>
            <button className="btn solid pro-btn-p" disabled={indo || !texto.trim()} onClick={enviar}><Send size={15} aria-hidden="true" />{indo ? 'Enviando…' : 'Comentar'}</button>
          </div>
          {erro && <p className="ct-erro" role="alert">{erro}</p>}
        </div>
      )}
    </div>
  );
}

/* ───────── Abrir um item pelo aviso de comentário/menção (#feed/ver/<alvo>) ───────── */
let itemPedido: string | null = null;
export function pedirItem(alvo: string) { itemPedido = alvo; window.dispatchEvent(new CustomEvent('radar-ver-item', { detail: alvo })); }
export function pegarItemPedido(): string | null { const a = itemPedido; itemPedido = null; return a; }

/* ───────── Ficha da prova (dentro do Pro): "Eu vou" e quem eu sigo vai ───────── */
type Gente = { apelido: string; foto: string | null; cidade: string };
type QuemVaiDados = { eu: boolean; total: number; sigo: Gente[]; outros: Gente[] };
const nomes = (l: Gente[], n = 2) => l.slice(0, n).map(g => `@${g.apelido}`).join(', ').replace(/, ([^,]*)$/, ' e $1');

export function QuemVai({ prova }: { prova: Race }) {
  const [d, setD] = useState<QuemVaiDados | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [indo, setIndo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => { sb.rpc('radar_quem_vai', { p_prova: prova.id }).then(({ data, error }) => { if (error || !data) setFalhou(true); else setD(data as QuemVaiDados); }); }, [prova.id]);
  if (falhou || !d || !prova.date) return null;
  const marcar = async () => {
    setIndo(true); setErro(null);
    const { data, error } = await sb.rpc('radar_vou_marcar', { p_prova: prova.id, p_data: prova.date, p_vou: !d.eu });
    setIndo(false);
    if (error) return setErro(erroTxt(error.message));
    setD(data as QuemVaiDados);
  };
  const outrosN = d.total - d.sigo.length;
  const rosto = [...d.sigo, ...d.outros].slice(0, 6);
  return (
    <section className="pro-quem-vai" aria-label="Quem vai">
      <div className="pro-quem-vai-topo">
        <p><Users size={16} aria-hidden="true" /><b>Quem vai</b></p>
        <button className={'btn ' + (d.eu ? 'text' : 'solid') + ' pro-btn-p'} disabled={indo} onClick={marcar} aria-pressed={d.eu}>{d.eu ? <><Check size={15} aria-hidden="true" />Você vai</> : 'Eu vou nessa'}</button>
      </div>
      {rosto.length > 0 && <div className="pro-quem-vai-rostos">{rosto.map(g => <a key={g.apelido} href={linkPerfil(g.apelido)} title={`@${g.apelido}`}><Avatar foto={g.foto} apelido={g.apelido} tam={34} /></a>)}</div>}
      <p className="pro-quem-vai-txt">
        {d.sigo.length > 0
          ? <>{nomes(d.sigo)}{d.sigo.length > 2 ? ` e mais ${d.sigo.length - 2}` : ''} que você segue {d.sigo.length === 1 ? 'vai' : 'vão'}{outrosN > 0 ? `, junto com ${outrosN} ${outrosN === 1 ? 'atleta' : 'atletas'} do Radar` : ''}.</>
          : d.total > 0 ? <>{d.total} {d.total === 1 ? 'atleta do Radar vai' : 'atletas do Radar vão'}. Ninguém que você segue marcou ainda.</>
          : <>Ninguém marcou ainda. Marque e quem te segue vê que você vai.</>}
        {d.eu && d.total === 0 && ' Você é o primeiro!'}
      </p>
      {erro && <p className="ct-erro" role="alert">{erro}</p>}
    </section>
  );
}

/* ───────── Sugestões de quem seguir (no feed) ───────── */
type Sug = { apelido: string; foto: string | null; cidade: string; motivo: string };
const CHAVE_DISPENSADOS = 'radar-sug-dispensados';
const lerDispensados = (): string[] => { try { return JSON.parse(localStorage.getItem(CHAVE_DISPENSADOS) ?? '[]'); } catch { return []; } };

export function SugestoesSeguir({ mudouSigo }: { mudouSigo: (apelido: string, sigo: boolean) => void }) {
  const [lista, setLista] = useState<Sug[] | null>(null);
  const [seguidos, setSeguidos] = useState<Set<string>>(new Set());
  const [fora, setFora] = useState<string[]>(lerDispensados);
  useEffect(() => { sb.rpc('radar_sugestoes_seguir').then(({ data, error }) => setLista(error ? [] : (data as Sug[]) ?? [])); }, []);
  const vis = (lista ?? []).filter(s => !fora.includes(s.apelido));
  if (!vis.length) return null;
  const dispensar = (ap: string) => { const n = [...fora, ap].slice(-200); setFora(n); try { localStorage.setItem(CHAVE_DISPENSADOS, JSON.stringify(n)); } catch { /* */ } };
  return (
    <section className="pro-card pro-sugestoes">
      <p className="pro-k cinza">Sugestões pra seguir</p>
      <ul>
        {vis.map(s => (
          <li key={s.apelido}>
            <button className="btn text pro-sug-fora" onClick={() => dispensar(s.apelido)} aria-label={`Não sugerir @${s.apelido}`}><X size={14} aria-hidden="true" /></button>
            <a href={linkPerfil(s.apelido)} className="pro-sug-quem"><Avatar foto={s.foto} apelido={s.apelido} tam={56} /><b>@{s.apelido}</b></a>
            <small>{s.motivo}</small>
            <Seguir apelido={s.apelido} sigo={seguidos.has(s.apelido)} mudou={v => { setSeguidos(p => { const n = new Set(p); if (v) n.add(s.apelido); else n.delete(s.apelido); return n; }); mudouSigo(s.apelido, v); }} />
          </li>
        ))}
      </ul>
    </section>
  );
}
