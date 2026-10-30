// Meus descontos: cupons das empresas parceiras do Radar Pro. Cada nível libera com o Pro + um número de provas oficiais.
// Pra usar: mostra o cupom ao vivo no caixa e o caixa confirma digitando a senha da loja (guardada só criptografada no servidor).
import { useEffect, useRef, useState } from 'react';
import { BadgePercent, Check, KeyRound, Lock, Store, X } from 'lucide-react';
import { sb, type Perfil } from './sb';

type Nivel = { pct: number; provas: number; onde: string; liberado: boolean; gratis?: boolean };
type Parceiro = { id: string; nome: string; logo: string | null; cor?: string | null; descricao: string | null; endereco: string | null; niveis: Nivel[]; usos: { pct: number; quando: string }[] };
type Dados = { pro: boolean; provas: number; parceiros: Parceiro[] };

const dataBR = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');

export function MeusDescontos({ perfil }: { perfil: Perfil }) {
  const [d, setD] = useState<Dados | null>(null);
  const [sel, setSel] = useState(0);
  const [usando, setUsando] = useState<{ p: Parceiro; n: Nivel } | null>(null);
  const carregar = () => sb.rpc('radar_meus_descontos').then(({ data }) => setD((data as Dados) ?? null));
  useEffect(() => { carregar(); }, []);
  if (!d || !d.parceiros.length) return null;
  const p = d.parceiros[Math.min(sel, d.parceiros.length - 1)];
  const regra = (n: Nivel) => (n.gratis ? 'conta grátis' : n.provas ? `Pro + ${n.provas} provas oficiais` : 'assinante Pro');
  return (
    <section className="pro-card pro-desc">
      <div className="pro-linha"><p className="pro-k cinza"><BadgePercent size={14} aria-hidden="true" /> Meus descontos</p><small className="fine">{d.parceiros.length} {d.parceiros.length === 1 ? 'marca parceira' : 'marcas parceiras'}</small></div>
      <div className="pro-desc-marcas" role="tablist" aria-label="Marcas parceiras">
        {d.parceiros.map((x, k) => (
          <button key={x.id} role="tab" aria-selected={k === sel} className={'pro-desc-marca' + (k === sel ? ' on' : '')} style={{ '--cor': x.cor ?? '#1d3fbf' } as React.CSSProperties} onClick={() => setSel(k)}>
            {x.logo ? <img src={x.logo} alt={x.nome} /> : <b>{x.nome}</b>}
            <small>até {Math.max(...x.niveis.map(n => n.pct))}% OFF</small>
          </button>
        ))}
        <div className="pro-desc-marca breve" aria-label="Novas marcas em breve"><Store size={22} aria-hidden="true" /><b>Novas marcas</b><small>em breve</small></div>
      </div>
      <Cupons key={p.id} p={p} d={d} regra={regra} usar={n => setUsando({ p, n })} />
      <p className="fine pro-sem-margem">{d.pro ? <>Você tem <b>{d.provas}</b> {d.provas === 1 ? 'prova oficial' : 'provas oficiais'}. </> : (p.niveis.some(n => n.gratis) ? <>Com a conta grátis o primeiro já está liberado; assinando o Pro em <b>Conta</b>, os outros liberam. </> : <>Os descontos do {p.nome} são de quem assina o Pro: assine em <b>Conta</b>. </>)}Não acumulativos: um desconto por compra.</p>
      {p.usos.length > 0 && <p className="fine pro-sem-margem">Seus últimos usos no {p.nome}: {p.usos.map(u => `${u.pct}% em ${dataBR(u.quando)}`).join(' · ')}</p>}
      {usando && <UsarCupom p={usando.p} n={usando.n} perfil={perfil} fechar={() => setUsando(null)} feito={() => { setUsando(null); carregar(); }} />}
    </section>
  );
}

/** Cupons da marca deslizando sozinhos (param quando a pessoa toca). */
function Cupons({ p, d, regra, usar }: { p: Parceiro; d: Dados; regra: (n: Nivel) => string; usar: (n: Nivel) => void }) {
  const trilho = useRef<HTMLDivElement>(null);
  const [ativo, setAtivo] = useState(0);
  const parado = useRef(false);
  useEffect(() => {
    const el = trilho.current; if (!el) return;
    const t = setInterval(() => {
      if (parado.current || !el.children.length) return;
      const prox = (ativo + 1) % el.children.length;
      el.scrollTo({ left: (el.children[prox] as HTMLElement).offsetLeft - el.offsetLeft, behavior: 'smooth' });
    }, 3200);
    return () => clearInterval(t);
  }, [ativo]);
  const aoRolar = () => { const el = trilho.current; if (!el) return; const w = (el.children[0] as HTMLElement)?.offsetWidth ?? 1; setAtivo(Math.round(el.scrollLeft / (w + 12))); };
  const parar = () => { parado.current = true; };
  return (
    <>
      <div className="pro-desc-trilho" ref={trilho} onScroll={aoRolar} onPointerDown={parar} onTouchStart={parar} style={{ '--cor': p.cor ?? '#1d3fbf' } as React.CSSProperties}>
        {p.niveis.map(n => {
          const falta = Math.max(0, n.provas - d.provas);
          return (
            <div key={n.pct} className={'pro-cupom-card' + (n.liberado ? ' on' : '')}>
              <div className="pro-cupom-topo">{p.logo ? <img src={p.logo} alt="" /> : <b>{p.nome}</b>}<span>{n.liberado ? 'Liberado' : 'Bloqueado'}</span></div>
              <b className="pro-cupom-pct">{n.pct}<small>% OFF</small></b>
              <span className="pro-cupom-onde">{n.onde}</span>
              <i className="pro-cupom-corte" aria-hidden="true" />
              <span className="pro-cupom-regra">{regra(n)}</span>
              {n.liberado
                ? <button className="btn solid pro-btn-p" onClick={() => usar(n)}>Usar cupom</button>
                : <span className="pro-desc-trava"><Lock size={12} aria-hidden="true" />{!d.pro ? 'Assine o Pro pra liberar' : `faltam ${falta} prova${falta === 1 ? '' : 's'}`}</span>}
              {!n.liberado && d.pro && n.provas > 0 && <span className="pro-desc-barra" aria-hidden="true"><i style={{ width: `${Math.min(100, (d.provas / n.provas) * 100)}%` }} /></span>}
            </div>
          );
        })}
      </div>
      <div className="pro-desc-pontos" aria-hidden="true">{p.niveis.map((n, k) => <i key={n.pct} className={k === ativo ? 'on' : ''} />)}</div>
    </>
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
  const [parc, setParc] = useState<{ id: string; nome: string }[]>([]);
  const [qual, setQual] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { sb.from('radar_parceiros').select('id, nome').order('criado_em').then(({ data }) => { const l = (data ?? []) as { id: string; nome: string }[]; setParc(l); setQual(q => q || l[0]?.id || ''); }); }, []);
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await sb.rpc('radar_admin_senha_parceiro', { p_parceiro: qual, p_senha: nova.trim() });
    const nome = parc.find(x => x.id === qual)?.nome ?? qual;
    setMsg(error ? error.message.replace(/^.*?: /, '') : `Senha do caixa do ${nome} salva. A anterior deixou de valer.`); if (!error) setNova('');
  }
  return (
    <form className="pro-form" onSubmit={salvar}>
      <p className="pro-k cinza">Senha do caixa</p>
      <select value={qual} onChange={e => setQual(e.target.value)} aria-label="Marca parceira">{parc.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}</select>
      <div className="pro-linha pro-quebra">
        <input type="password" value={nova} onChange={e => setNova(e.target.value)} placeholder="Nova senha do caixa" autoComplete="new-password" aria-label="Nova senha do caixa" />
        <button className="btn outline pro-btn-p" type="submit" disabled={nova.trim().length < 6 || !qual}>Salvar senha</button>
      </div>
      {msg && <small className="fine">{msg}</small>}
    </form>
  );
}
