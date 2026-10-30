// Meus descontos: cupons das empresas parceiras do Radar Pro. Cada nível libera com o Pro + um número de provas oficiais.
// Pra usar: mostra o cupom ao vivo no caixa e registra a compra com uma foto (sacola da loja ou selfie com a dona).
import { useEffect, useRef, useState } from 'react';
import { BadgePercent, Camera, Check, Lock, X } from 'lucide-react';
import { sb, type Perfil } from './sb';
import { reduzirFoto } from './Foto';

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

/** Cupom ao vivo (relógio correndo, pra não valer print) + registro da compra com foto. */
function UsarCupom({ p, n, perfil, fechar, feito }: { p: Parceiro; n: Nivel; perfil: Perfil; fechar: () => void; feito: () => void }) {
  const [agora, setAgora] = useState(new Date());
  const [foto, setFoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  useEffect(() => { const t = setInterval(() => setAgora(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { const o = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = o; }; }, []);
  async function escolher(f?: File) {
    if (!f) return; setErro(null);
    try { const blob = await reduzirFoto(f, 1200, .82); setFoto(old => { if (old) URL.revokeObjectURL(old.url); return { blob, url: URL.createObjectURL(blob) }; }); }
    catch { setErro('Não consegui abrir essa foto. Tente outra.'); }
    finally { if (entrada.current) entrada.current.value = ''; }
  }
  async function registrar() {
    if (!foto) return; setEnviando(true); setErro(null);
    const caminho = `${perfil.user_id}/${p.id}-${Date.now()}.jpg`;
    const up = await sb.storage.from('descontos').upload(caminho, foto.blob, { contentType: 'image/jpeg', upsert: false });
    if (up.error) { setEnviando(false); return setErro('Não consegui enviar a foto. Confira a internet e tente de novo.'); }
    const { error } = await sb.rpc('radar_usar_desconto', { p_parceiro: p.id, p_pct: n.pct, p_foto: caminho });
    setEnviando(false);
    if (error) return setErro(error.message.replace(/^.*?: /, ''));
    setOk(true); setTimeout(feito, 1800);
  }
  const hora = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return (
    <div className="pro-cupom-fundo" role="dialog" aria-modal="true" aria-label={`Cupom de ${n.pct}% no ${p.nome}`}>
      <div className="pro-cupom">
        <button className="pro-cupom-x" onClick={fechar} aria-label="Fechar"><X size={20} aria-hidden="true" /></button>
        <div className="pro-cupom-vale">
          <span className="pro-cupom-vivo"><i aria-hidden="true" />Cupom ao vivo · {hora}</span>
          <b>{n.pct}% OFF</b>
          <span>{n.onde} · {p.nome}</span>
          <span className="pro-cupom-quem">@{perfil.apelido} · <em>PRO</em></span>
        </div>
        {ok ? <p className="pro-ok"><Check size={18} aria-hidden="true" /> Compra registrada. Bom proveito!</p> : <>
          <ol className="pro-cupom-passos">
            <li>Mostre esta tela no caixa do {p.nome}.</li>
            <li>Depois da compra, tire uma foto com a <b>sacola do {p.nome}</b> ou uma <b>selfie com a dona</b>.</li>
            <li>Envie a foto aqui pra registrar o uso.</li>
          </ol>
          {foto && <img className="pro-cupom-foto" src={foto.url} alt="Foto da compra" />}
          <input ref={entrada} type="file" accept="image/*" capture="environment" hidden onChange={e => escolher(e.target.files?.[0])} />
          <button className={foto ? 'btn outline pro-btn' : 'btn solid pro-btn'} onClick={() => entrada.current?.click()}><Camera size={18} aria-hidden="true" />{foto ? 'Trocar a foto' : 'Tirar a foto da compra'}</button>
          {foto && <button className="btn solid pro-btn" onClick={registrar} disabled={enviando}>{enviando ? 'Registrando…' : 'Registrar o uso do desconto'}</button>}
          {erro && <p className="ct-erro" role="alert">{erro}</p>}
          <p className="fine pro-centro pro-sem-margem">A foto fica guardada só pra conferência do Radar e do parceiro.</p>
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
      if (l.length) { const { data: s } = await sb.storage.from('descontos').createSignedUrls(l.map(x => x.foto), 3600); (s ?? []).forEach((x, i) => { if (x.signedUrl) l[i].url = x.signedUrl; }); }
      setLista(l);
    });
  }, []);
  return (
    <section className="pro-card">
      <p className="pro-k cinza"><BadgePercent size={14} aria-hidden="true" /> Descontos usados</p>
      {lista === null ? <p className="fine">Carregando…</p> : !lista.length ? <p className="fine pro-sem-margem">Ninguém usou desconto ainda.</p> :
        <div className="pro-desc-adm">{lista.map(u => (
          <a key={u.id} href={u.url} target="_blank" rel="noopener" className="pro-desc-adm-item">
            {u.url ? <img src={u.url} alt={`Foto de @${u.apelido}`} /> : <span />}
            <small><b>@{u.apelido}</b> · {u.pct}% · {u.parceiro}<br />{new Date(u.quando).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small>
          </a>
        ))}</div>}
    </section>
  );
}
