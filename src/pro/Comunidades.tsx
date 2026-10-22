// Comunidades: menu estilo WhatsApp. Cada uma é um feed fechado: só quem está dentro lê e publica.
// "Elas correm" e "Eles correm" entram pelo sexo do perfil (sem pedido, sem lista de membros). As outras, qualquer um entra e sai.
import { useEffect, useState } from 'react';
import { ArrowLeft, Lock, LogOut, UsersRound } from 'lucide-react';
import { sb, type Perfil } from './sb';
import { ItemFeed, Publicar, type Evento } from './Feed';

type Comunidade = { id: string; nome: string; descricao: string; tipo: 'sexo' | 'aberta'; sexo: 'F' | 'M' | null; emoji: string; cor: string; membro: boolean; membros: number; posts_semana: number; ultimo: string | null };

export function TelaComunidades({ perfil, pro, assinar }: { perfil: Perfil; pro: boolean; assinar: () => void }) {
  const [lista, setLista] = useState<Comunidade[] | null>(null);
  const [aberta, setAberta] = useState<Comunidade | null>(null);
  const [indo, setIndo] = useState<string | null>(null);
  const carregar = () => sb.rpc('radar_comunidades').then(({ data }) => setLista((data ?? []) as Comunidade[]));
  useEffect(() => { carregar(); }, [aberta]);
  const entrar = async (c: Comunidade, sim: boolean) => { setIndo(c.id); await sb.rpc('radar_comunidade_entrar', { p_id: c.id, p_entrar: sim }); await carregar(); setIndo(null); if (sim) setAberta({ ...c, membro: true }); };
  if (aberta) return <ComunidadeFeed c={aberta} perfil={perfil} pro={pro} assinar={assinar} voltar={() => setAberta(null)} sair={() => entrar(aberta, false).then(() => setAberta(null))} />;
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
      {lista === null && <p className="fine">Carregando…</p>}
      {minhas.length > 0 && <><p className="pro-k cinza"><UsersRound size={14} aria-hidden="true" /> Suas comunidades</p><div className="pro-comun">{minhas.map(c => <Card key={c.id} c={c} />)}</div></>}
      {outras.length > 0 && <><p className="pro-k cinza">Para entrar</p><div className="pro-comun">{outras.map(c => <Card key={c.id} c={c} />)}</div></>}
      <p className="fine pro-sem-margem">Cada comunidade é um feed fechado: só quem está dentro lê e publica. "Elas correm" e "Eles correm" são pelo sexo do perfil, sem pedido e sem lista de membros. Sem comentários, só reações.</p>
    </div>
  );
}

function ComunidadeFeed({ c, perfil, pro, assinar, voltar, sair }: { c: Comunidade; perfil: Perfil; pro: boolean; assinar: () => void; voltar: () => void; sair: () => void }) {
  const [lista, setLista] = useState<Evento[] | null>(null);
  const [sigo, setSigo] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const carregar = () => sb.rpc('radar_comunidade_feed', { p_id: c.id }).then(({ data, error }) => { if (error) setErro(error.message.replace(/^.*?: /, '')); setLista((data ?? []) as Evento[]); });
  useEffect(() => { carregar(); sb.rpc('radar_sigo').then(({ data }) => setSigo(new Set((data as string[]) ?? []))); }, [c.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const mudou = (ap: string) => (s: boolean) => setSigo(prev => { const n = new Set(prev); if (s) n.add(ap); else n.delete(ap); return n; });
  return (
    <div className="pro-cont">
      <div className="pro-linha"><button className="btn text pro-esq" onClick={voltar}><ArrowLeft size={16} aria-hidden="true" />Comunidades</button>{c.tipo === 'aberta' && <button className="btn text pro-btn-p" onClick={() => { if (confirm(`Sair de ${c.nome}?`)) sair(); }}><LogOut size={14} aria-hidden="true" />Sair</button>}</div>
      <section className="pro-card">
        <div className="pro-comun-topo"><span className="pro-comun-emoji" style={{ '--cor': c.cor } as React.CSSProperties} aria-hidden="true">{c.emoji}</span><div><p className="pro-k cinza"><Lock size={12} aria-hidden="true" /> Comunidade fechada</p><p className="pro-comun-nome">{c.nome}</p></div></div>
        <p className="pro-sub pro-sem-margem">{c.descricao}</p>
      </section>
      <Publicar perfil={perfil} pro={pro} assinar={assinar} publicou={carregar} comunidade={{ id: c.id, nome: c.nome }} dica={`Publicar em ${c.nome}…`} />
      {erro && <p className="ct-erro" role="alert">{erro}</p>}
      {lista === null && !erro && <p className="fine">Carregando…</p>}
      {lista?.length === 0 && <p className="fine">Ninguém publicou ainda. Começa você.</p>}
      {lista?.map(e => <ItemFeed key={e.alvo} e={e} eu={perfil.apelido} sigo={sigo.has(e.apelido)} mudouSigo={mudou(e.apelido)} pro={pro} assinar={assinar} apagou={carregar} />)}
      {lista && lista.length > 0 && <p className="fine pro-centro">Só quem está em {c.nome} vê isto.</p>}
    </div>
  );
}
