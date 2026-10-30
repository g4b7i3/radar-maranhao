// Meus descontos: cupons das empresas parceiras do Radar Pro. Cada nível libera com o Pro + um número de provas oficiais.
// Pra usar: mostra o cupom ao vivo no caixa e o caixa confirma digitando a senha da loja (guardada só criptografada no servidor).
import { useEffect, useState } from 'react';
import { BadgePercent, Check, KeyRound, Lock, X } from 'lucide-react';
import { sb, type Perfil } from './sb';

type Nivel = { pct: number; provas: number; onde: string; liberado: boolean };
type Parceiro = { id: string; nome: string; logo: string | null; descricao: string | null; endereco: string | null; niveis: Nivel[]; usos: { pct: number; quando: string }[] };
type Dados = { pro: boolean; provas: number; parceiros: Parceiro[] };

const dataBR = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');

export function MeusDescontos({ perfil }: { perfil: Perfil }) {
  const [d, setD] = useState<Dados | null>(null);
  const [usando, setUsando] = useState<{ p: Parceiro; n: Nivel } | null>(null);
  const carregar = () => sb.rpc('radar_meus_descontos').then(({ data }) => setD((data as Dados) ?? null));
  useEffect(() => { carregar(); }, []);
  if (!d || !d.parceiros.length) return null;
  return (
    <section className="pro-card pro-desc">
      <p className="pro-k cinza"><BadgePercent size={14} aria-hidden="true" /> Meus descontos</p>
      {!d.pro && <p className="fine pro-sem-margem">Os descontos são de quem assina o Radar Pro. Assine em <b>Conta</b> e o primeiro já libera na hora.</p>}
      {d.parceiros.map(p => (
        <div key={p.id} className="pro-desc-parc">
          <div className="pro-desc-cab">
            {p.logo ? <img src={p.logo} alt="" /> : <span className="pro-desc-semlogo" aria-hidden="true">{p.nome[0]}</span>}
            <div><b>{p.nome}</b>{p.endereco && <small>{p.endereco}</small>}</div>
          </div>
          <div className="pro-desc-niveis">
            {p.niveis.map(n => {
              const falta = Math.max(0, n.provas - d.provas);
              return (
                <div key={n.pct} className={'pro-desc-nivel' + (n.liberado ? ' on' : '')}>
                  <b>{n.pct}%</b>
                  <small>{n.onde}</small>
                  {n.liberado
                    ? <button className="btn solid pro-btn-p" onClick={() => setUsando({ p, n })}>Usar</button>
                    : <span className="pro-desc-trava"><Lock size={12} aria-hidden="true" />{!d.pro ? 'Só no Pro' : `faltam ${falta} prova${falta === 1 ? '' : 's'}`}</span>}
                  {!n.liberado && d.pro && n.provas > 0 && <span className="pro-desc-barra" aria-hidden="true"><i style={{ width: `${Math.min(100, (d.provas / n.provas) * 100)}%` }} /></span>}
                </div>
              );
            })}
          </div>
          <p className="fine pro-sem-margem">{d.pro ? <>Você tem <b>{d.provas}</b> {d.provas === 1 ? 'prova oficial' : 'provas oficiais'}. </> : null}10% com o Pro · 15% com 5 provas oficiais · 20% com 10 provas oficiais.</p>
          {p.usos.length > 0 && <p className="fine pro-sem-margem">Últimos usos: {p.usos.map(u => `${u.pct}% em ${dataBR(u.quando)}`).join(' · ')}</p>}
        </div>
      ))}
      {usando && <UsarCupom p={usando.p} n={usando.n} perfil={perfil} fechar={() => setUsando(null)} feito={() => { setUsando(null); carregar(); }} />}
    </section>
  );
}

/** Cupom ao vivo (relógio correndo, pra não valer print). Quem confirma é o caixa, digitando a senha da loja no celular do atleta. */
function UsarCupom({ p, n, perfil, fechar, feito }: { p: Parceiro; n: Nivel; perfil: Perfil; fechar: () => void; feito: () => void }) {
  const [agora, setAgora] = useState(new Date());
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  useEffect(() => { const t = setInterval(() => setAgora(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { const o = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = o; }; }, []);
  async function confirmar(e: React.FormEvent) {
    e.preventDefault(); if (!senha.trim()) return;
    setEnviando(true); setErro(null);
    const { data, error } = await sb.rpc('radar_usar_desconto_v2', { p_parceiro: p.id, p_pct: n.pct, p_senha: senha.trim() });
    setEnviando(false); setSenha('');
    if (error) return setErro(error.message.replace(/^.*?: /, ''));
    const r = data as { ok: boolean; erro?: string } | null;
    if (!r?.ok) return setErro(r?.erro ?? 'Não deu certo. Tente de novo.');
    setOk(new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }));
  }
  const hora = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return (
    <div className="pro-cupom-fundo" role="dialog" aria-modal="true" aria-label={`Cupom de ${n.pct}% no ${p.nome}`}>
      <div className="pro-cupom">
        <button className="pro-cupom-x" onClick={ok ? feito : fechar} aria-label="Fechar"><X size={20} aria-hidden="true" /></button>
        <div className={'pro-cupom-vale' + (ok ? ' ok' : '')}>
          <span className="pro-cupom-vivo"><i aria-hidden="true" />{ok ? 'Desconto confirmado' : 'Cupom ao vivo'} · {hora}</span>
          <b>{n.pct}% OFF</b>
          <span>{n.onde} · {p.nome}</span>
          <span className="pro-cupom-quem">@{perfil.apelido} · <em>PRO</em></span>
        </div>
        {ok ? <>
          <p className="pro-ok pro-centro"><Check size={20} aria-hidden="true" /> Confirmado pelo caixa em {ok}. Pode aplicar os {n.pct}%.</p>
          <button className="btn solid pro-btn" onClick={feito}>Pronto</button>
        </> : <>
          <ol className="pro-cupom-passos">
            <li>Mostre esta tela no caixa do {p.nome}.</li>
            <li>Entregue o celular: <b>o caixa digita a senha da loja</b> pra confirmar.</li>
          </ol>
          <form className="pro-form" onSubmit={confirmar}>
            <label className="ct-cidade">Senha do caixa <small>(quem digita é a loja)</small>
              <input type="password" value={senha} onChange={e => setSenha(e.target.value)} autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} inputMode="text" maxLength={60} placeholder="••••••••" />
            </label>
            <button className="btn solid pro-btn" type="submit" disabled={enviando || !senha.trim()}><KeyRound size={18} aria-hidden="true" />{enviando ? 'Conferindo…' : 'Confirmar desconto'}</button>
          </form>
          {erro && <p className="ct-erro" role="alert">{erro}</p>}
          <p className="fine pro-centro pro-sem-margem">Cada uso fica registrado com data e hora.</p>
        </>}
      </div>
    </div>
  );
}

/** Admin: últimos usos de desconto com a foto da compra. */
export function AdminDescontos() {
  const [lista, setLista] = useState<{ id: string; apelido: string; parceiro: string; pct: number; foto: string; quando: string; url?: string }[] | null>(null);
  useEffect(() => {
    sb.rpc('radar_admin_descontos').then(async ({ data }) => {
      const l = (data ?? []) as { id: string; apelido: string; parceiro: string; pct: number; foto: string; quando: string; url?: string }[];
      const comFoto = l.filter(x => x.foto);
      if (comFoto.length) { const { data: s } = await sb.storage.from('descontos').createSignedUrls(comFoto.map(x => x.foto), 3600); (s ?? []).forEach((x, i) => { if (x.signedUrl) comFoto[i].url = x.signedUrl; }); }
      setLista(l);
    });
  }, []);
  return (
    <section className="pro-card">
      <p className="pro-k cinza"><BadgePercent size={14} aria-hidden="true" /> Descontos usados</p>
      {lista === null ? <p className="fine">Carregando…</p> : !lista.length ? <p className="fine pro-sem-margem">Ninguém usou desconto ainda.</p> :
        <ul className="pro-desc-adm">{lista.map(u => (
          <li key={u.id}><b>@{u.apelido}</b> · {u.pct}% · {u.parceiro} · {new Date(u.quando).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}{u.url && <> · <a href={u.url} target="_blank" rel="noopener">foto</a></>}</li>
        ))}</ul>}
      <TrocarSenha />
    </section>
  );
}

function TrocarSenha() {
  const [nova, setNova] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await sb.rpc('radar_admin_senha_parceiro', { p_parceiro: 'emporio-doll', p_senha: nova.trim() });
    setMsg(error ? error.message.replace(/^.*?: /, '') : 'Senha do caixa trocada. A antiga deixou de valer.'); if (!error) setNova('');
  }
  return (
    <form className="pro-linha pro-quebra" onSubmit={salvar}>
      <input type="password" value={nova} onChange={e => setNova(e.target.value)} placeholder="Nova senha do caixa (Empório Doll)" autoComplete="new-password" aria-label="Nova senha do caixa" />
      <button className="btn outline pro-btn-p" type="submit" disabled={nova.trim().length < 6}>Trocar senha</button>
      {msg && <small className="fine">{msg}</small>}
    </form>
  );
}
