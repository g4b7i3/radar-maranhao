// Meu grupo: criar, convidar por @apelido, ver membros e convites pendentes. O grupo é a "assessoria" do perfil, então já soma pontos.
import { useEffect, useState } from 'react';
import { Users, UserPlus, Share2, Copy } from 'lucide-react';
import { sb, type Perfil } from './sb';
import { Avatar } from './Foto';
import { linkAssessoria } from './Assessoria';

type Meu = { nome: string; descricao: string | null; membros: { apelido: string; foto: string | null; cidade: string }[]; pendentes: { apelido: string; foto: string | null; quando: string }[]; recusados: number };

export function MeuGrupo({ perfil, pronto }: { perfil: Perfil; pronto: () => void }) {
  const [d, setD] = useState<Meu | null | undefined>(undefined);
  const [nome, setNome] = useState(perfil.assessoria ?? '');
  const [desc, setDesc] = useState('');
  const [ap, setAp] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [indo, setIndo] = useState(false);
  const carregar = () => sb.rpc('radar_grupo_meu').then(({ data }) => setD((data as Meu) ?? null));
  useEffect(() => { carregar(); }, []);
  const rpc = async (fn: string, args: Record<string, unknown>, ok: string) => {
    setErro(null); setMsg(null); setIndo(true);
    const { error } = await sb.rpc(fn, args);
    setIndo(false);
    if (error) return setErro(error.message.replace(/^.*?: /, ''));
    setMsg(ok); carregar(); pronto();
  };
  if (d === undefined) return null;
  if (d === null) return (
    <section className="pro-card">
      <p className="pro-k cinza"><Users size={14} aria-hidden="true" /> Criar meu grupo</p>
      <p className="fine pro-sem-margem">Chame os amigos: o grupo soma os pontos dos 5 melhores no ranking de assessorias, disputa o desafio do mês e ganha uma página própria.{perfil.assessoria ? ` Você já está em “${perfil.assessoria}”; criar um grupo troca a sua equipe.` : ''}</p>
      <label className="ct-cidade">Nome do grupo<input value={nome} onChange={e => setNome(e.target.value)} maxLength={60} placeholder="Ex.: Corre Ilha" /></label>
      <label className="ct-cidade">Descrição <small>(opcional)</small><input value={desc} onChange={e => setDesc(e.target.value)} maxLength={200} placeholder="Ex.: treinos no Calhau, terça e quinta" /></label>
      {erro && <p className="ct-erro" role="alert">{erro}</p>}
      <button className="btn solid pro-btn" disabled={indo || nome.trim().length < 3} onClick={() => rpc('radar_grupo_criar', { p_nome: nome, p_descricao: desc || null }, 'Grupo criado! Agora convide os amigos.')}>Criar grupo</button>
    </section>
  );
  const link = linkAssessoria(d.nome);
  const texto = `Entra no meu grupo ${d.nome} no Radar Pro! A gente soma pontos juntos no ranking do Maranhão. Crie sua conta em radarcorridasma.com.br/pro e escreva "${d.nome}" em assessoria, ou me manda seu @ que eu te convido.`;
  return (
    <section className="pro-card">
      <div className="pro-linha"><p className="pro-k cinza"><Users size={14} aria-hidden="true" /> Meu grupo · {d.nome}</p><a className="btn text pro-btn-p" href={link} target="_blank" rel="noopener">Ver página</a></div>
      {d.descricao && <p className="fine pro-sem-margem">{d.descricao}</p>}
      <label className="ct-cidade">Convidar pelo @apelido<div className="pro-linha"><input value={ap} onChange={e => setAp(e.target.value.replace(/^@/, '').toLowerCase())} placeholder="apelido" autoCapitalize="none" /><button className="btn solid" disabled={indo || ap.length < 3} onClick={() => rpc('radar_grupo_convidar', { p_apelido: ap }, `Convite enviado para @${ap}. Ele recebe uma notificação no app.`).then(() => setAp(''))}><UserPlus size={16} aria-hidden="true" />Convidar</button></div><small>A pessoa precisa ter conta no Radar Pro. Quem não tem, chame pelo WhatsApp.</small></label>
      <div className="pro-linha pro-quebra">
        <a className="btn whats pro-btn-p" href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener"><Share2 size={16} aria-hidden="true" />Chamar no WhatsApp</a>
        <button className="btn outline pro-btn-p" onClick={() => { navigator.clipboard?.writeText(link); setMsg('Link copiado.'); }}><Copy size={16} aria-hidden="true" />Copiar link</button>
      </div>
      {msg && <p className="pro-ok">{msg}</p>}
      {erro && <p className="ct-erro" role="alert">{erro}</p>}
      <p className="pro-k cinza">No grupo ({d.membros.length})</p>
      <ul className="pro-companheiros">{d.membros.map(m => <li key={m.apelido}><Avatar foto={m.foto} apelido={m.apelido} tam={36} /><div><b>@{m.apelido}{m.apelido === perfil.apelido ? ' (você)' : ''}</b><small>{m.cidade}</small></div>{m.apelido !== perfil.apelido && <button className="btn text" onClick={() => { if (confirm(`Tirar @${m.apelido} do grupo?`)) rpc('radar_grupo_remover', { p_apelido: m.apelido }, `@${m.apelido} saiu do grupo.`); }}>Tirar</button>}</li>)}</ul>
      {d.pendentes.length > 0 && <><p className="pro-k cinza">Convites esperando ({d.pendentes.length})</p>
        <ul className="pro-companheiros">{d.pendentes.map(m => <li key={m.apelido}><Avatar foto={m.foto} apelido={m.apelido} tam={32} /><div><b>@{m.apelido}</b><small>ainda não respondeu</small></div></li>)}</ul></>}
    </section>
  );
}
