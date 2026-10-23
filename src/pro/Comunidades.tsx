// Comunidades: menu estilo WhatsApp. Cada uma é um feed fechado: só quem está dentro lê e publica.
// "Elas correm" e "Eles correm" entram pelo sexo do perfil (sem pedido, sem lista de membros). As outras, qualquer um entra e sai.
import { useEffect, useRef, useState } from 'react';
import { Lock, LogOut, Pencil, Plus, UsersRound } from 'lucide-react';
import { sb, type Perfil } from './sb';
import { ItemFeed, Publicar, type Evento } from './Feed';
import { useVoltar, telaInicial } from './voltar';
import { TopoVoltar } from './Topo';

type Comunidade = { id: string; nome: string; descricao: string; tipo: 'sexo' | 'aberta'; sexo: 'F' | 'M' | null; emoji: string; cor: string; membro: boolean; membros: number; posts_semana: number; ultimo: string | null };

export function TelaComunidades({ perfil, pro, assinar, admin = false }: { perfil: Perfil; pro: boolean; assinar: () => void; admin?: boolean }) {
  const [criando, setCriando] = useState(false);
  const [lista, setLista] = useState<Comunidade[] | null>(null);
  const [aberta, setAberta] = useState<Comunidade | null>(null);
  useVoltar(!!aberta, () => setAberta(null), aberta?.id);
  const pedida = useRef(telaInicial('comunidades')); // atualizou com uma comunidade aberta: reabre ela
  const [indo, setIndo] = useState<string | null>(null);
  const carregar = () => sb.rpc('radar_comunidades').then(({ data }) => { const l = (data ?? []) as Comunidade[]; setLista(l); if (pedida.current) { const c = l.find(x => x.id === pedida.current && x.membro); pedida.current = null; if (c) setAberta(c); } });
  useEffect(() => { carregar(); }, [aberta]);
  const entrar = async (c: Comunidade, sim: boolean) => { setIndo(c.id); await sb.rpc('radar_comunidade_entrar', { p_id: c.id, p_entrar: sim }); await carregar(); setIndo(null); if (sim) setAberta({ ...c, membro: true }); };
  if (aberta) return <ComunidadeFeed c={aberta} perfil={perfil} pro={pro} assinar={assinar} admin={admin} voltar={() => setAberta(null)} mudou={c => { if (c) setAberta(c); else { setAberta(null); carregar(); } }} sair={() => entrar(aberta, false).then(() => setAberta(null))} />;
  const minhas = (lista ?? []).filter(c => c.membro), outras = (lista ?? []).filter(c => !c.membro);
  const Card = ({ c }: { c: Comunidade }) => {
    const fechada = c.tipo === 'sexo' && !c.membro;
    const quem = c.tipo === 'sexo' ? (c.sexo === 'F' ? 'mulheres' : 'homens') : 'membros';
    return (
      <button className={'pro-card pro-comun-card' + (fechada ? ' fora' : '')} disabled={fechada} onClick={() => c.membro ? setAberta(c) : entrar(c, true)}>
        <span className="pro-comun-emoji" style={{ '--cor': c.cor } as React.CSSProperties} aria-hidden="true">{fechada ? '🔒' : c.emoji}</span>
        <div><b>{c.nome}</b><small>{c.membros} {quem}{c.posts_semana ? ` · ${c.posts_semana} ${c.posts_semana === 1 ? 'post' : 'posts'} na semana` : ''}</small><small>{fechada ? `Só quem é do ${c.sexo === 'F' ? 'feminino' : 'masculino'} entra.` : c.descricao}</small></div>
        {!fechada && (c.membro ? <span className="btn text pro-btn-p">Abrir</span> : <span className="btn outline pro-btn-p">{indo === c.id ? '…' : 'Entrar'}</span>)}
      </button>
    );
  };
  return (
    <div className="pro-cont">
      {admin && (criando
        ? <FormComunidade fechar={() => setCriando(false)} salvou={() => { setCriando(false); carregar(); }} />
        : <button className="btn outline pro-comun-nova" onClick={() => setCriando(true)}><Plus size={16} aria-hidden="true" />Nova comunidade <small>(só você vê)</small></button>)}
      {lista === null && <p className="fine">Carregando…</p>}
      {minhas.length > 0 && <><p className="pro-k cinza"><UsersRound size={14} aria-hidden="true" /> Suas comunidades</p><div className="pro-comun">{minhas.map(c => <Card key={c.id} c={c} />)}</div></>}
      {outras.length > 0 && <><p className="pro-k cinza">Para entrar</p><div className="pro-comun">{outras.map(c => <Card key={c.id} c={c} />)}</div></>}
      <p className="fine pro-sem-margem">Cada comunidade é um feed fechado: só quem está dentro lê e publica. "Elas correm" e "Eles correm" são pelo sexo do perfil, sem pedido e sem lista de membros. Sem comentários, só reações.</p>
    </div>
  );
}

function ComunidadeFeed({ c, perfil, pro, assinar, voltar, sair, admin, mudou: mudouCom }: { c: Comunidade; perfil: Perfil; pro: boolean; assinar: () => void; voltar: () => void; sair: () => void; admin: boolean; mudou: (c: Comunidade | null) => void }) {
  const [editando, setEditando] = useState(false);
  const [lista, setLista] = useState<Evento[] | null>(null);
  const [sigo, setSigo] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const carregar = () => sb.rpc('radar_comunidade_feed', { p_id: c.id }).then(({ data, error }) => { if (error) setErro(error.message.replace(/^.*?: /, '')); setLista((data ?? []) as Evento[]); });
  useEffect(() => { carregar(); sb.rpc('radar_sigo').then(({ data }) => setSigo(new Set((data as string[]) ?? []))); }, [c.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const mudou = (ap: string) => (s: boolean) => setSigo(prev => { const n = new Set(prev); if (s) n.add(ap); else n.delete(ap); return n; });
  return (
    <div className="pro-cont">
      <TopoVoltar titulo={c.nome} voltar={voltar} direita={c.tipo === 'aberta' ? <button className="btn text pro-btn-p" onClick={() => { if (confirm(`Sair de ${c.nome}?`)) sair(); }}><LogOut size={14} aria-hidden="true" />Sair</button> : undefined} />
      <section className="pro-card">
        <div className="pro-comun-topo"><span className="pro-comun-emoji" style={{ '--cor': c.cor } as React.CSSProperties} aria-hidden="true">{c.emoji}</span><div><p className="pro-k cinza"><Lock size={12} aria-hidden="true" /> Comunidade fechada</p><p className="pro-comun-nome">{c.nome}</p></div></div>
        <p className="pro-sub pro-sem-margem">{c.descricao}</p>
        {admin && !editando && <button className="btn text pro-btn-p" onClick={() => setEditando(true)}><Pencil size={14} aria-hidden="true" />Editar comunidade</button>}
      </section>
      {admin && editando && <FormComunidade c={c} fechar={() => setEditando(false)} salvou={d => { setEditando(false); mudouCom(d ? { ...c, ...d } : null); }} />}
      <Publicar perfil={perfil} pro={pro} assinar={assinar} publicou={carregar} comunidade={{ id: c.id, nome: c.nome }} dica={`Publicar em ${c.nome}…`} />
      {erro && <p className="ct-erro" role="alert">{erro}</p>}
      {lista === null && !erro && <p className="fine">Carregando…</p>}
      {lista?.length === 0 && <p className="fine">Ninguém publicou ainda. Começa você.</p>}
      {lista?.map(e => <ItemFeed key={e.alvo} e={e} eu={perfil.apelido} sigo={sigo.has(e.apelido)} mudouSigo={mudou(e.apelido)} pro={pro} assinar={assinar} apagou={carregar} />)}
      {lista && lista.length > 0 && <p className="fine pro-centro">Só quem está em {c.nome} vê isto.</p>}
    </div>
  );
}

const CORES = ['#dbe8ff', '#ffe1ec', '#dff5e6', '#fff1cc', '#ece3ff', '#ffe4d1'];
/** Admin: cria ou edita uma comunidade (o servidor confere se é o admin). */
function FormComunidade({ c, fechar, salvou }: { c?: Comunidade; fechar: () => void; salvou: (d?: { nome: string; descricao: string; emoji: string; cor: string } | null) => void }) {
  const [f, setF] = useState({ nome: c?.nome ?? '', descricao: c?.descricao ?? '', emoji: c?.emoji ?? '👥', cor: c?.cor ?? CORES[0], avisar: true });
  const [msg, setMsg] = useState<string | null>(null);
  const [indo, setIndo] = useState(false);
  const salvar = async () => {
    setIndo(true); setMsg(null);
    const { data, error } = await sb.rpc('radar_admin_comunidade_salvar', { p_dados: { id: c?.id ?? null, ...f } });
    setIndo(false);
    const r = (data ?? {}) as { erro?: string; avisados?: number };
    if (error || r.erro) return setMsg(r.erro ?? 'Não deu para salvar agora.');
    if (!c && r.avisados) alert(`Comunidade criada! ${r.avisados} pessoas foram avisadas no sininho.`);
    salvou({ nome: f.nome.trim(), descricao: f.descricao.trim(), emoji: f.emoji, cor: f.cor });
  };
  const apagar = async () => {
    if (!c || !confirm(`Tirar "${c.nome}" do ar? Ninguém mais vê a comunidade (as publicações ficam guardadas).`)) return;
    setIndo(true); const { data } = await sb.rpc('radar_admin_comunidade_apagar', { p_id: c.id }); setIndo(false);
    if ((data as { erro?: string })?.erro) return setMsg((data as { erro: string }).erro);
    salvou(null);
  };
  return (
    <section className="pro-card pro-comun-form">
      <p className="pro-k cinza">{c ? 'Editar comunidade' : 'Nova comunidade'}</p>
      <div className="pro-linha pro-comun-form-topo">
        <label className="ct-cidade pro-comun-emoji-campo">Emoji<input value={f.emoji} maxLength={8} onChange={e => setF({ ...f, emoji: e.target.value })} /></label>
        <label className="ct-cidade">Nome<input value={f.nome} maxLength={40} onChange={e => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Corredores de Imperatriz" /></label>
      </div>
      <label className="ct-cidade">Descrição<textarea rows={2} value={f.descricao} maxLength={160} onChange={e => setF({ ...f, descricao: e.target.value })} placeholder="Pra quem é essa comunidade" /></label>
      <div className="pro-comun-cores" role="group" aria-label="Cor">{CORES.map(cor => <button key={cor} type="button" aria-label={`Cor ${cor}`} aria-pressed={f.cor === cor} style={{ background: cor }} onClick={() => setF({ ...f, cor })} />)}</div>
      {!c && <label className="pro-check"><input type="checkbox" checked={f.avisar} onChange={e => setF({ ...f, avisar: e.target.checked })} /> Avisar todo mundo no sininho</label>}
      {msg && <p className="ct-erro" role="alert">{msg}</p>}
      <div className="pro-linha pro-quebra">
        <button className="btn solid" disabled={indo} onClick={salvar}>{indo ? 'Salvando…' : c ? 'Salvar' : 'Criar comunidade'}</button>
        <button className="btn text" disabled={indo} onClick={fechar}>Cancelar</button>
        {c && c.tipo === 'aberta' && <button className="btn outline pro-vermelho-txt" disabled={indo} onClick={apagar}>Tirar do ar</button>}
      </div>
    </section>
  );
}
