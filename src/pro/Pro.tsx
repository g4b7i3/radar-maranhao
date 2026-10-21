// Radar Pro: temporada do atleta (login, perfil, assinatura via Pix e as telas do Pro).
// Abre em /?pro. Convite de duelo: /?pro=duelo&c=<código>.
import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ArrowLeft, Mail, LogOut } from 'lucide-react';
import { sb, chamar, ADMIN_EMAIL, zapLimpo, zapMascara, type Perfil, type Temporada } from './sb';
import { whatsappLink } from '../lib';
import CIDADES from '../cidades-ma-geo.json';
import { TelaTemporada, TelaEuCorri, TelaRanking, TelaDuelos, TelaConta, TelaAdmin } from './Telas';
import './pro.css';

type Aba = 'temporada' | 'corri' | 'ranking' | 'duelos' | 'conta' | 'admin';
const qs = new URLSearchParams(window.location.search);
try { if (qs.get('pro') === 'duelo' && qs.get('c')) sessionStorage.setItem('radar-duelo', qs.get('c')!); } catch { /* sem armazenamento */ }

export const Logo = () => (
  <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#1D3FBF" /><g fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12a8 8 0 0 0 8-8M20 4a8 8 0 0 0 8 8M28 20a8 8 0 0 0-8 8M12 28a8 8 0 0 0-8-8" /><path d="M16 9l7 7-7 7-7-7z" /></g></svg>
);

export default function Pro() {
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined);
  const [perfil, setPerfil] = useState<Perfil | null | undefined>(undefined);
  const [temp, setTemp] = useState<Temporada | null>(null);
  const [aba, setAba] = useState<Aba>('temporada');
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSessao(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const recarregar = useCallback(async () => {
    if (!sessao) return;
    const { data: p } = await sb.from('radar_perfis').select('*').eq('user_id', sessao.user.id).maybeSingle();
    setPerfil(p as Perfil | null);
    if (p) { const { data: t } = await sb.rpc('radar_minha_temporada', { temporada: new Date().getFullYear() }); setTemp(t as Temporada); }
  }, [sessao]);
  useEffect(() => { if (sessao) recarregar(); else if (sessao === null) setPerfil(undefined); }, [sessao, recarregar]);

  // convite de duelo guardado antes do login
  useEffect(() => {
    if (!perfil || !temp?.assinante) return;
    let c: string | null = null; try { c = sessionStorage.getItem('radar-duelo'); } catch { /* */ }
    if (!c) return;
    chamar('radar-acoes', { acao: 'duelo_aceitar', convite: c }).then(r => {
      try { sessionStorage.removeItem('radar-duelo'); } catch { /* */ }
      setAviso(r.erro ?? 'Duelo aceito! Agora é correr uma prova na distância do duelo neste mês.');
      if (!r.erro) setAba('duelos');
    });
  }, [perfil, temp?.assinante]);

  const topo = (titulo: string, extra?: React.ReactNode) => (
    <header className="pro-topo"><Logo /><b>{titulo}</b>{extra}</header>
  );

  if (sessao === undefined || (sessao && perfil === undefined)) return <main className="pro"><p className="pro-carregando">Carregando…</p></main>;

  if (!sessao) return <main className="pro"><a className="story-voltar" href="/"><ArrowLeft size={18} aria-hidden="true" />Voltar para o Radar</a><Convite /></main>;

  if (!perfil) return <main className="pro">{topo('Seu perfil de atleta')}<FormPerfil uid={sessao.user.id} email={sessao.user.email ?? ''} pronto={recarregar} /></main>;

  if (!temp) return <main className="pro"><p className="pro-carregando">Carregando…</p></main>;

  const admin = sessao.user.email === ADMIN_EMAIL;
  if (!temp.assinante && aba !== 'conta' && aba !== 'admin') return (
    <main className="pro">
      {topo('Assinar o Radar Pro')}
      <Assinar perfil={perfil} pronto={recarregar} />
      <div className="pro-rodape-links"><button className="btn text" onClick={() => setAba('conta')}>Minha conta</button>{admin && <button className="btn text" onClick={() => setAba('admin')}>Administração</button>}</div>
    </main>
  );

  const ABAS: { id: Aba; nome: string }[] = [
    { id: 'temporada', nome: 'Temporada' }, { id: 'corri', nome: 'Eu corri' }, { id: 'ranking', nome: 'Ranking' }, { id: 'duelos', nome: 'Duelos' }, { id: 'conta', nome: 'Conta' },
    ...(admin ? [{ id: 'admin' as Aba, nome: 'Admin' }] : []),
  ];
  return (
    <main className="pro">
      {topo(aba === 'temporada' ? `Minha temporada ${new Date().getFullYear()}` : ABAS.find(a => a.id === aba)!.nome, temp.assinante ? <span className="pro-selo">PRO</span> : null)}
      <nav className="ni-troca pro-abas" aria-label="Radar Pro">
        {ABAS.map(a => <a key={a.id} href={`#${a.id}`} aria-current={aba === a.id ? 'page' : undefined} onClick={e => { e.preventDefault(); setAba(a.id); window.scrollTo(0, 0); }}>{a.nome}</a>)}
      </nav>
      <AvisoVencimento validaAte={temp.valida_ate} renovar={() => { setAba('conta'); window.scrollTo(0, 0); }} />
      {aviso && <p className="pro-aviso" role="status">{aviso} <button className="btn text" onClick={() => setAviso(null)}>Ok</button></p>}
      {aba === 'temporada' && <TelaTemporada perfil={perfil} temp={temp} irCorri={() => setAba('corri')} />}
      {aba === 'corri' && <TelaEuCorri perfil={perfil} pronto={() => { recarregar(); }} irTemporada={() => setAba('temporada')} />}
      {aba === 'ranking' && <TelaRanking perfil={perfil} />}
      {aba === 'duelos' && <TelaDuelos perfil={perfil} />}
      {aba === 'conta' && <TelaConta perfil={perfil} temp={temp} email={sessao.user.email ?? ''} pronto={recarregar} />}
      {aba === 'admin' && admin && <TelaAdmin />}
    </main>
  );
}

/* ───────── 1 · Convite + login ───────── */
function Convite() {
  const [email, setEmail] = useState('');
  const [modo, setModo] = useState<'botoes' | 'email' | 'enviado'>('botoes');
  const [erro, setErro] = useState<string | null>(null);
  const volta = window.location.origin + '/?pro' + (qs.get('c') ? `=duelo&c=${qs.get('c')}` : '');
  const google = async () => {
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: volta } });
    if (error) setErro('O login com Google ainda não está disponível. Use o e-mail.');
  };
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault(); setErro(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) { setErro('Confira o e-mail.'); return; }
    const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: volta } });
    if (error) setErro(/rate|limit/i.test(error.message) ? 'Muitos pedidos agora. Espere alguns minutos e tente de novo.' : 'Não deu para enviar o e-mail. Tente de novo.');
    else setModo('enviado');
  };
  return (
    <>
      <section className="pro-card azul pro-hero">
        <p className="pro-k">Radar Pro</p>
        <h1>Sua corrida<br />vira <span>temporada.</span></h1>
        <p>Cada prova soma pontos, medalhas e te leva para a liga do seu nível.</p>
      </section>
      <ol className="pro-lista">
        <li><i>1</i><span><b>Seu nível e sua liga</b><small>Bronze, Prata, Ouro ou Elite, pela nota por idade.</small></span></li>
        <li><i>2</i><span><b>Medalhas e pontos</b><small>Toda prova que você corre entra na sua estante.</small></span></li>
        <li><i>3</i><span><b>Ranking do Maranhão</b><small>Por cidade, sexo, faixa etária, eficiência e assessoria.</small></span></li>
        <li><i>4</i><span><b>Duelo e pelotão</b><small>Desafie amigos e dispute com até 25 atletas do seu nível.</small></span></li>
      </ol>
      <div className="pro-card pro-preco"><span>Só</span> <b>R$ 10</b><span>/mês · sem fidelidade</span></div>
      {modo === 'botoes' && <>
        <button className="btn solid pro-btn" onClick={google}><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>Entrar com Google</button>
        <button className="btn outline pro-btn" onClick={() => setModo('email')}><Mail size={18} aria-hidden="true" />Entrar com e-mail</button>
      </>}
      {modo === 'email' && (
        <form className="pro-form" onSubmit={enviar}>
          <label className="ct-cidade">Seu e-mail<input type="email" inputMode="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" /></label>
          <button className="btn solid pro-btn" type="submit">Receber link de acesso</button>
          <button className="btn text" type="button" onClick={() => setModo('botoes')}>Voltar</button>
        </form>
      )}
      {modo === 'enviado' && <p className="pro-ok">Pronto! Abra o e-mail que mandamos para <b>{email}</b> e toque no link para entrar. Olhe também a caixa de spam.</p>}
      {erro && <p className="ct-erro" role="alert">{erro}</p>}
      <p className="fine pro-centro">A agenda de provas continua grátis para todo mundo. Ao entrar, você aceita os <a href="/termos.html">termos de uso e a política de privacidade</a>.</p>
    </>
  );
}

/* ───────── Perfil ───────── */
const NOMES_CIDADES = Object.keys(CIDADES as Record<string, unknown>).sort((a, b) => a.localeCompare(b, 'pt-BR'));
function FormPerfil({ uid, email, pronto }: { uid: string; email: string; pronto: () => void }) {
  const [f, setF] = useState({ apelido: email.split('@')[0].toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 20), nome_completo: '', cidade: 'São Luís', sexo: '' as '' | 'F' | 'M', nascimento: '', assessoria: '', whatsapp: '' });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const muda = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const salvar = async (e: React.FormEvent) => {
    e.preventDefault(); setErro(null);
    const ap = f.apelido.trim().toLowerCase();
    if (!/^[a-z0-9_.]{3,20}$/.test(ap)) return setErro('Apelido: 3 a 20 letras sem acento, números, ponto ou _.');
    if (f.nome_completo.trim().split(/\s+/).length < 2) return setErro('Escreva o nome completo, igual ao da inscrição das provas.');
    if (!f.sexo) return setErro('Escolha o sexo da categoria em que você corre.');
    const nasc = f.nascimento.split('/').reverse().join('-');
    const idade = (Date.now() - Date.parse(nasc)) / (365.25 * 86400_000);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nasc) || !(idade >= 10 && idade <= 100)) return setErro('Confira a data de nascimento (dd/mm/aaaa).');
    const zap = f.whatsapp.trim() ? zapLimpo(f.whatsapp) : null;
    if (f.whatsapp.trim() && !zap) return setErro('Confira o WhatsApp: DDD + número, ex.: (98) 98765-4321.');
    setSalvando(true);
    const { error } = await sb.from('radar_perfis').insert({ user_id: uid, apelido: ap, nome_completo: f.nome_completo.trim().replace(/\s+/g, ' '), cidade: f.cidade, sexo: f.sexo, nascimento: nasc, assessoria: f.assessoria.trim() || null, whatsapp: zap });
    setSalvando(false);
    if (error) return setErro(error.code === '23505' ? 'Esse apelido já existe. Escolha outro.' : 'Não deu para salvar. Tente de novo.');
    pronto();
  };
  const masc = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 8); return d.length > 4 ? `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; };
  return (
    <form className="pro-form" onSubmit={salvar}>
      <p className="fine">Leva 1 minuto. O nome completo serve para achar você no resultado oficial das provas e não aparece para ninguém.</p>
      <label className="ct-cidade">Apelido público<input value={f.apelido} onChange={muda('apelido')} autoCapitalize="none" placeholder="ex.: vinikcorre" /><small>É o que aparece no ranking.</small></label>
      <label className="ct-cidade">Nome completo (como na inscrição)<input value={f.nome_completo} onChange={muda('nome_completo')} autoComplete="name" /></label>
      <label className="ct-cidade">Cidade<input list="pro-cidades" value={f.cidade} onChange={muda('cidade')} /><datalist id="pro-cidades">{NOMES_CIDADES.map(c => <option key={c} value={c} />)}</datalist></label>
      <p className="euvou-pergunta">Categoria</p>
      <div className="chips" role="group" aria-label="Categoria"><button type="button" className="chip" aria-pressed={f.sexo === 'F'} onClick={() => setF({ ...f, sexo: 'F' })}>Feminino</button><button type="button" className="chip" aria-pressed={f.sexo === 'M'} onClick={() => setF({ ...f, sexo: 'M' })}>Masculino</button></div>
      <label className="ct-cidade">Data de nascimento<input inputMode="numeric" value={f.nascimento} onChange={e => setF({ ...f, nascimento: masc(e.target.value) })} placeholder="dd/mm/aaaa" /><small>Usada só para a nota por idade e a faixa etária.</small></label>
      <label className="ct-cidade">Assessoria ou grupo <small>(opcional)</small><input value={f.assessoria} onChange={muda('assessoria')} placeholder="ex.: Equipe Corre Ilha" /></label>
      <label className="ct-cidade">WhatsApp <small>(opcional)</small><input type="tel" inputMode="tel" autoComplete="tel" value={f.whatsapp} onChange={e => setF({ ...f, whatsapp: zapMascara(e.target.value) })} placeholder="(98) 98765-4321" /><small>Só para o Radar te avisar se tiver algum problema com o seu resultado. Não aparece para ninguém.</small></label>
      {erro && <p className="ct-erro" role="alert">{erro}</p>}
      <button className="btn solid pro-btn" disabled={salvando}>{salvando ? 'Salvando…' : 'Continuar'}</button>
      <button className="btn text" type="button" onClick={() => sb.auth.signOut()}><LogOut size={16} aria-hidden="true" />Sair</button>
    </form>
  );
}

/* ───────── 2 · Assinar com Pix ───────── */
export function Assinar({ perfil, pronto }: { perfil: Perfil; pronto: () => void }) {
  const [pix, setPix] = useState<{ qr: string; qr_img: string } | null>(null);
  const [estado, setEstado] = useState<'inicio' | 'gerando' | 'aguardando' | 'indisponivel' | 'pago'>('inicio');
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const gerar = async () => {
    setEstado('gerando'); setErro(null);
    const r = await chamar<{ qr: string; qr_img: string; indisponivel?: boolean }>('radar-pix', {});
    if (r.indisponivel) return setEstado('indisponivel');
    if (r.erro) { setErro(r.erro); return setEstado('inicio'); }
    setPix(r); setEstado('aguardando');
  };
  // confere sozinho a cada 5 s se o Pix caiu
  useEffect(() => {
    if (estado !== 'aguardando') return;
    const t = setInterval(async () => { const r = await chamar<{ ativo: boolean }>('radar-pix', { acao: 'status' }); if (r.ativo) { setEstado('pago'); clearInterval(t); setTimeout(pronto, 1800); } }, 5000);
    return () => clearInterval(t);
  }, [estado, pronto]);
  const copiar = async () => { try { await navigator.clipboard.writeText(pix!.qr); setCopiado(true); setTimeout(() => setCopiado(false), 2500); } catch { /* */ } };
  return (
    <div className="pro-form">
      <div className="pro-card pro-centro">
        <p className="pro-k cinza">Radar Pro · 30 dias</p>
        <p className="pro-valor">R$ 10,00</p>
        {estado === 'aguardando' && pix && <><img className="pro-qr" src={`data:image/png;base64,${pix.qr_img}`} alt="QR Code do Pix" /><p className="fine">Aponte a câmera do app do seu banco</p></>}
        {estado === 'pago' && <p className="pro-ok">Pagamento recebido! Liberando o seu Radar Pro…</p>}
      </div>
      {estado === 'inicio' && <button className="btn solid pro-btn" onClick={gerar}>Gerar Pix</button>}
      {estado === 'gerando' && <button className="btn solid pro-btn" disabled>Gerando…</button>}
      {estado === 'aguardando' && pix && <>
        <label className="ct-cidade">Pix copia e cola<textarea className="pro-copia" readOnly value={pix.qr} rows={3} onFocus={e => e.target.select()} /></label>
        <button className="btn pro-btn pro-pix" onClick={copiar}>{copiado ? 'Copiado!' : 'Copiar código Pix'}</button>
        <p className="pro-ok">Assim que o Pix cair, o acesso libera sozinho nesta tela.</p>
      </>}
      {estado === 'indisponivel' && <>
        <p className="pro-aviso">O pagamento automático está sendo ativado. Por enquanto, chame o Radar no WhatsApp que a gente libera o seu acesso na hora.</p>
        <a className="btn whats pro-btn" href={whatsappLink(`Oi! Quero assinar o Radar Pro (R$ 10/mês). Meu apelido é @${perfil.apelido}.`)} target="_blank" rel="noopener">Assinar pelo WhatsApp</a>
      </>}
      {erro && <p className="ct-erro" role="alert">{erro}</p>}
      <p className="fine pro-centro">Sem renovação automática: você paga um Pix por mês, só se quiser continuar. A agenda segue grátis.</p>
    </div>
  );
}

/* Faixa de aviso nos últimos 3 dias da assinatura */
function AvisoVencimento({ validaAte, renovar }: { validaAte: string | null; renovar: () => void }) {
  if (!validaAte) return null;
  const ms = new Date(validaAte).getTime() - Date.now();
  if (ms <= 0 || ms > 3 * 86400_000) return null;
  // conta por dia do calendário (vence amanhã às 9h = "amanhã", mesmo faltando menos de 24 h)
  const meiaNoite = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((meiaNoite(new Date(validaAte)) - meiaNoite(new Date())) / 86400_000);
  const quando = dias <= 0 ? 'hoje' : dias === 1 ? 'amanhã' : `em ${dias} dias`;
  return (
    <div className="pro-vence" role="status">
      <span>Seu Radar Pro vence <b>{quando}</b> ({new Date(validaAte).toLocaleDateString('pt-BR')}). Renove para não perder o acesso.</span>
      <button className="btn solid" onClick={renovar}>Renovar com Pix</button>
    </div>
  );
}
