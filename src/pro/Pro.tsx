// Radar Pro: temporada do atleta (login, perfil, assinatura via Pix e as telas do Pro).
// Abre em /?pro. Convite de duelo: /?pro=duelo&c=<código>.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ArrowLeft, Check, Users, Mail, Accessibility, LogOut, CalendarCheck, Swords as Espadas, Award, PlusCircle, BarChart3, Swords, UserRound, UsersRound, Shield, Radar, Trophy, CalendarDays, Tv, type LucideIcon } from 'lucide-react';
import { sb, chamar, ADMIN_EMAIL, souAdmin, zapLimpo, zapMascara, type Perfil, type Temporada , GENEROS} from './sb';
import { whatsappLink } from '../lib';
import InstallPrompt from '../InstallPrompt';
import CardDuelo, { tituloDuelo, type FimDuelo } from './CardDuelo';
import CIDADES from '../cidades-ma-geo.json';
import { TelaTemporada, TelaEuCorri, TelaRanking, TelaDuelos, TelaConta, TelaAdmin, ZapConta } from './Telas';
import { FotoConta } from './Foto';
import { TelaFeed } from './Feed';
import { TelaCampeonatos } from './Campeonatos';
import { TelaComunidades } from './Comunidades';
import { TelaAssista } from './Assista';
import { iniciarPresenca } from './online';
import { MEDALHAS as LISTA_MEDALHAS, medalhaSVG } from './medalhas';
import { TelaProvas } from './Provas';
import { PushConvite } from './Push';
import { terminarConexaoStrava } from './Strava';
import { Sino, PainelNotificacoes, useNotificacoes } from './Notificacoes';
import { provaPedida } from './Provas';
import { useVoltar, iniciarHistorico, irParaAba, abaDepoisDoVoltar, lerEndereco, telaInicialGeral } from './voltar';
import { TopoVoltar } from './Topo';
import PerfilPublico from './PerfilPublico';
import AssessoriaPublica from './Assessoria';
import './pro.css';

const ABAS_VALIDAS = ['temporada', 'campeonatos', 'feed', 'comunidades', 'assista', 'provas', 'corri', 'ranking', 'duelos', 'conta', 'admin'] as const;
const abaDoEndereco = (): Aba | null => { const h = lerEndereco().aba; return (ABAS_VALIDAS as readonly string[]).includes(h) ? h as Aba : null; };
type Aba = 'temporada' | 'campeonatos' | 'feed' | 'comunidades' | 'assista' | 'provas' | 'corri' | 'ranking' | 'duelos' | 'conta' | 'admin';
const qs = new URLSearchParams(window.location.search);
try { if (qs.get('pro') === 'duelo' && qs.get('c')) sessionStorage.setItem('radar-duelo', qs.get('c')!); } catch { /* sem armazenamento */ }
// Link de cortesia (/?pro=cortesia&k=código): libera o Radar Pro sem pagar, até o Vinik revogar
try { if (qs.get('pro') === 'cortesia' && qs.get('k')) localStorage.setItem('radar-cortesia', qs.get('k')!); } catch { /* sem armazenamento */ }
// Link de indicação (/?pro&ref=apelido ou /?ref=apelido): guarda até a pessoa criar o perfil
try { const ref = (qs.get('ref') ?? '').toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 20); if (ref) localStorage.setItem('radar-ref', ref); } catch { /* */ }
// Convite para comunidade (/?pro&comunidade=id): guarda até a pessoa entrar e criar o perfil; aí ela já entra na comunidade
try { const com = (qs.get('comunidade') ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 60); if (com) localStorage.setItem('radar-convite-comunidade', com); } catch { /* */ }
export const conviteComunidade = (): string | null => { try { return localStorage.getItem('radar-convite-comunidade'); } catch { return null; } };
const codigoCortesia = (): string | null => { let k = qs.get('pro') === 'cortesia' && new URLSearchParams(window.location.search).get('k') ? qs.get('k') : null; try { k ??= localStorage.getItem('radar-cortesia'); } catch { /* */ } return k; };

/** Logo do Radar Pro: o símbolo do Radar em dourado, no fundo azul-noite (a mesma do ícone do app). */
export const Logo = ({ tam = 30 }: { tam?: number }) => (
  <svg width={tam} height={tam} viewBox="0 0 32 32" aria-hidden="true">
    <defs>
      <linearGradient id="logo-pro-f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1a2a6c" /><stop offset="1" stopColor="#070d26" /></linearGradient>
      <linearGradient id="logo-pro-o" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff1b8" /><stop offset=".5" stopColor="#f2b705" /><stop offset="1" stopColor="#ffe28a" /></linearGradient>
    </defs>
    <rect width="32" height="32" rx="7" fill="url(#logo-pro-f)" />
    <g fill="none" stroke="url(#logo-pro-o)" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12a8 8 0 0 0 8-8M20 4a8 8 0 0 0 8 8M28 20a8 8 0 0 0-8 8M12 28a8 8 0 0 0-8-8" /><path d="M16 9l7 7-7 7-7-7z" /></g>
  </svg>
);

/** Quem abriu o link de um duelo vê quem desafiou, antes mesmo de entrar. */
function ConviteDuelo() {
  const [d, setD] = useState<{ apelido: string; distancia_km: number; mes: string; aceito: boolean } | null>(null);
  useEffect(() => {
    let c: string | null = qs.get('c'); try { c ??= sessionStorage.getItem('radar-duelo'); } catch { /* */ }
    if (c) sb.rpc('radar_convite_duelo', { p_convite: c }).then(({ data }) => setD((data as typeof d) ?? null));
  }, []);
  if (!d) return null;
  const mes = new Date(d.mes.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' });
  const km = Math.abs(Number(d.distancia_km) - 21.0975) < 0.1 ? '21 km' : Math.abs(Number(d.distancia_km) - 42.195) < 0.1 ? '42 km' : `${Number(d.distancia_km)} km`;
  return (
    <section className="pro-card pro-convite-duelo">
      <span className="pro-convite-duelo-ic"><Espadas size={26} aria-hidden="true" /></span>
      <div>
        <p className="pro-k">Desafio pra você</p>
        <b>@{d.apelido} te desafiou para um duelo de {km} em {mes}!</b>
        <p className="pro-sem-margem">{d.aceito ? 'Esse duelo já foi aceito.' : 'Vence quem tiver a maior nota por idade numa prova oficial do mês. Entre no Radar Pro para aceitar.'}</p>
      </div>
    </section>
  );
}

const GOOGLE_IC = <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>;

/** Radar Pro com o convite para instalar o app (igual ao do Radar, mas com a logo dourada). */
export default function Pro() {
  return <><ProTelas /><InstallPrompt blocked={false} onInstalled={() => { /* */ }} app="o Radar Pro" icone="/icons/pro-192.png" oQueMostra="a sua temporada" /></>;
}

function ProTelas() {
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined);
  const [perfil, setPerfil] = useState<Perfil | null | undefined>(undefined);
  const [temp, setTemp] = useState<Temporada | null>(null);
  // aba vem do endereço (#feed, #comunidades/feminina…): atualizar mantém a tela; o voltar leva à Temporada e depois sai
  const [aba, setAbaEstado] = useState<Aba>(() => { const a = provaPedida() ? 'provas' : abaDoEndereco() ?? (conviteComunidade() ? 'comunidades' : 'temporada'); iniciarHistorico(a); return a; });
  const abaRef = useRef(aba); abaRef.current = aba;
  const fecharCamadas = useRef<() => boolean>(() => false); // fecha perfil/assessoria/notificações abertos por cima
  const setAba = useCallback((a: Aba) => {
    if (a === abaRef.current) { if (fecharCamadas.current()) window.scrollTo(0, 0); return; } // tocar na aba atual com algo aberto por cima: fecha e volta pra aba
    irParaAba(a, x => { setAbaEstado(x as Aba); window.scrollTo(0, 0); });
  }, []);
  useEffect(() => {
    const onPop = () => { const a = abaDepoisDoVoltar(); setAbaEstado(((ABAS_VALIDAS as readonly string[]).includes(a) ? a : 'temporada') as Aba); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const [aviso, setAviso] = useState<string | null>(null);
  const [fimDuelos, setFimDuelos] = useState<FimDuelo[]>([]);
  const [cardDuelo, setCardDuelo] = useState<string | null>(null);
  const [resgatando, setResgatando] = useState(() => !!codigoCortesia());
  const [notifAberto, setNotifAberto] = useState(false);
  useVoltar(notifAberto, () => setNotifAberto(false));
  // perfil de atleta e página de assessoria abrem dentro do app (seta e voltar do celular trazem de volta)
  const [aberto, setAberto] = useState<{ tipo: 'atleta' | 'assessoria'; nome: string } | null>(() => {
    const a = telaInicialGeral('atleta'); if (a) return { tipo: 'atleta', nome: a };
    const s = telaInicialGeral('assessoria'); return s ? { tipo: 'assessoria', nome: s } : null;
  });
  useVoltar(!!aberto, () => setAberto(null), aberto ? `${aberto.tipo}/${aberto.nome}` : undefined);
  fecharCamadas.current = () => { const algo = !!aberto || notifAberto; if (aberto) setAberto(null); if (notifAberto) setNotifAberto(false); return algo; };
  // ao abrir outro perfil por dentro de um perfil (lista de seguidores, equipe), volta pro topo
  const sobreRef = useRef<HTMLDivElement>(null);
  useEffect(() => { sobreRef.current?.scrollTo(0, 0); }, [aberto?.tipo, aberto?.nome]);
  const abrirLinkInterno = (ev: React.MouseEvent) => {
    const a = (ev.target as HTMLElement).closest('a'); if (!a || ev.defaultPrevented || ev.metaKey || ev.ctrlKey) return;
    let u: URL; try { u = new URL(a.href); } catch { return; }
    if (u.hostname !== location.hostname && u.hostname !== 'radarcorridasma.com.br') return;
    const at = u.searchParams.get('atleta'), as = u.searchParams.get('assessoria');
    if (!at && !as) return;
    ev.preventDefault();
    setAberto(at ? { tipo: 'atleta', nome: at.toLowerCase() } : { tipo: 'assessoria', nome: as! });
  };
  // abertura: logo grande reluzindo, uma vez por abertura do app (1,5 s), depois entra
  const [abertura, setAbertura] = useState(() => { try { return !sessionStorage.getItem('radar-abertura'); } catch { return true; } });
  const [aberturaMin, setAberturaMin] = useState(false);
  useEffect(() => { if (!abertura) return; const t = setTimeout(() => setAberturaMin(true), 1500); try { sessionStorage.setItem('radar-abertura', '1'); } catch { /* */ } return () => clearTimeout(t); }, [abertura]);
  const carregou = sessao !== undefined && !(sessao && perfil === undefined);
  useEffect(() => { if (abertura && aberturaMin && carregou) { const t = setTimeout(() => setAbertura(false), 450); return () => clearTimeout(t); } }, [abertura, aberturaMin, carregou]);
  const telaAbertura = abertura ? <Abertura saindo={aberturaMin && carregou} /> : null;
  const [stravaVersao, setStravaVersao] = useState(0); // recarrega a Conta depois de conectar o Strava
  const [bemVindo, setBemVindo] = useState(false); // tela cheia na hora em que o Pro é liberado (Pix, cortesia ou equipe)
  const eraAssinante = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    if (!temp) return;
    if (eraAssinante.current === false && temp.assinante) setBemVindo(true);
    eraAssinante.current = temp.assinante;
  }, [temp]);
  const notif = useNotificacoes();
  const [fotoPulada, setFotoPulada] = useState(() => { try { return localStorage.getItem('radar-foto-pulada') === '1'; } catch { return true; } });
  const pularFoto = () => { try { localStorage.setItem('radar-foto-pulada', '1'); } catch { /* */ } setFotoPulada(true); };

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

  // novidades dos duelos: "fulano aceitou" e o resultado dos duelos do mês que acabou (aparecem uma vez)
  useEffect(() => {
    if (!perfil || !temp?.assinante) return;
    sb.rpc('radar_duelo_novidades').then(({ data }) => {
      const l = (data ?? []) as (FimDuelo & { tipo: 'aceito' | 'resultado' })[];
      const aceitos = l.filter(x => x.tipo === 'aceito' && x.adversario).map(x => '@' + x.adversario);
      if (aceitos.length) setAviso(`⚔️ ${aceitos.join(', ')} ${aceitos.length > 1 ? 'aceitaram' : 'aceitou'} o seu duelo! Veja na aba Duelos.`);
      setFimDuelos(l.filter(x => x.tipo === 'resultado' && x.resultado !== 'ninguem'));
    });
  }, [perfil, temp?.assinante]);

  // link de cortesia: assim que o perfil existe, libera o Pro
  const cortesiaFeita = useRef(false);
  useEffect(() => {
    if (!perfil || cortesiaFeita.current) return;
    const k = codigoCortesia();
    if (!k) { setResgatando(false); return; }
    cortesiaFeita.current = true; // uma vez só (antes repetia a cada recarga do perfil)
    try { localStorage.removeItem('radar-cortesia'); } catch { /* */ }
    try { window.history.replaceState(null, '', '/?pro'); } catch { /* */ }
    chamar<{ nome?: string }>('radar-acoes', { acao: 'cortesia_resgatar', codigo: k }).then(async r => {
      setAviso(r.erro ?? '🎁 Radar Pro liberado como cortesia. Bem-vindo ao Radar Pro!');
      await recarregar(); setResgatando(false);
    });
  }, [perfil, recarregar]);

  // volta do Strava (strava.html guardou o código): termina a conexão e abre a Conta
  const stravaFeito = useRef(false);
  useEffect(() => {
    if (!perfil || stravaFeito.current) return;
    let tem = false; try { tem = !!(sessionStorage.getItem('radar-strava-code') || sessionStorage.getItem('radar-strava-erro')); } catch { /* */ }
    if (!tem) return;
    stravaFeito.current = true;
    setAba('conta');
    terminarConexaoStrava().then(m => { if (m) setAviso(m); setStravaVersao(v => v + 1); });
  }, [perfil]);

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

  if (sessao === undefined || (sessao && perfil === undefined)) return <main className="pro">{telaAbertura}<p className="pro-carregando">Carregando…</p></main>;

  if (!sessao) return <main className="pro">{telaAbertura}<ConviteDuelo /><Convite /></main>;

  if (!perfil) return <main className="pro">{telaAbertura}{topo('Seu perfil de atleta')}<ConviteDuelo /><FormPerfil uid={sessao.user.id} email={sessao.user.email ?? ''} pronto={recarregar} /></main>;

  if (!temp || resgatando) return <main className="pro"><p className="pro-carregando">Carregando…</p></main>;

  // WhatsApp agora é obrigatório: quem criou a conta antes precisa completar
  
  // Foto opcional: oferecida uma vez, logo depois do cadastro (dá para pular; depois fica em Conta)
  if (perfil.whatsapp && !perfil.foto_url && !fotoPulada) return (
    <main className="pro">{topo('Sua foto')}<div className="pro-cont">
      <p className="pro-sem-margem">Quer aparecer com a sua foto no ranking e no seu perfil público? É opcional e você pode colocar ou trocar depois em Conta.</p>
      <FotoConta perfil={perfil} pronto={() => { pularFoto(); recarregar(); }} titulo="Foto do perfil" />
      <button className="btn text" onClick={pularFoto}>Agora não</button>
    </div></main>
  );

  if (!perfil.whatsapp) return <main className="pro">{topo('Falta só um dado')}<div className="pro-cont"><p className="pro-sem-margem">Para continuar no Radar Pro, informe o seu WhatsApp. É por ele que o Radar fala com você sobre os seus resultados.</p><ZapConta perfil={perfil} pronto={recarregar} /></div></main>;

  const admin = sessao.user.email === ADMIN_EMAIL;
  souAdmin.v = admin;
  iniciarPresenca(); // online/offline (liga uma vez só)
  const pro = temp.assinante;
  const irAssinar = () => { setAba('conta'); window.scrollTo(0, 0); };

  const ABAS: { id: Aba; nome: string; Icone: LucideIcon }[] = [
    { id: 'temporada', nome: 'Temporada', Icone: Award }, { id: 'provas', nome: 'Agenda', Icone: CalendarDays }, { id: 'feed', nome: 'Feed', Icone: Radar }, { id: 'campeonatos', nome: 'Campeonatos', Icone: Trophy }, { id: 'comunidades', nome: 'Comunidades', Icone: UsersRound }, { id: 'assista', nome: 'Assista', Icone: Tv }, { id: 'corri', nome: 'Eu corri', Icone: PlusCircle }, { id: 'ranking', nome: 'Ranking', Icone: BarChart3 },
    { id: 'duelos', nome: 'Duelos', Icone: Swords }, { id: 'conta', nome: 'Conta', Icone: UserRound },
    ...(admin ? [{ id: 'admin' as Aba, nome: 'Admin', Icone: Shield }] : []),
  ];
  return (
    <main className="pro" onClickCapture={abrirLinkInterno}>
      {telaAbertura}
      {topo(aba === 'temporada' ? (new Date().getFullYear() === 2026 ? 'Pré-temporada 2027' : `Minha temporada ${new Date().getFullYear()}`) : ABAS.find(a => a.id === aba)!.nome, <span className="pro-topo-dir">{temp.assinante ? <span className="pro-selo">PRO</span> : null}<Sino n={notif.nao_lidas} onClick={() => setNotifAberto(true)} /></span>)}
      {notifAberto && <PainelNotificacoes lista={notif.lista} fechar={() => setNotifAberto(false)} recarregar={() => { notif.carregar(); recarregar(); }} irPara={a => { setAba(a as Aba); window.scrollTo(0, 0); }} />}
      {/* menu fixo embaixo, como app: desliza de lado; a borda esfumada mostra que tem mais */}
      <MenuAbas abas={ABAS} aba={aba} ir={a => { setAba(a); window.scrollTo(0, 0); }} />
      <p className="pro-inicio-temporada"><CalendarCheck size={18} aria-hidden="true" /><span><b>Pré-temporada 2027:</b> já valem as provas desde 15/10. Em 1º de janeiro começa a <b>temporada 2027</b> e o ranking zera.</span></p>
      <PushConvite userId={perfil.user_id} />
      {!pro && <div className="pro-gratis" role="status"><span><b>Modo grátis:</b> você vê a agenda de provas, publica texto, segue e reage. Provas verificadas, pontos, ranking, duelos e foto abrem com o Pro.</span><button className="btn solid" onClick={irAssinar}>Assinar · R$ 10</button></div>}
      <AvisoVencimento validaAte={temp.valida_ate} renovar={irAssinar} />
      {bemVindo && <BemVindoPro fechar={() => { setBemVindo(false); setAba('temporada'); window.scrollTo(0, 0); }} />}
      {aviso && <p className="pro-aviso" role="status">{aviso} <button className="btn text" onClick={() => setAviso(null)}>Ok</button></p>}
      {fimDuelos.map(d => (
        <section key={d.id} className={'pro-card pro-fim-duelo ' + d.resultado}>
          <div className="pro-linha"><p className="pro-k">Duelo de {new Date(d.mes.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' })} contra @{d.adversario}</p><button className="btn text" onClick={() => setFimDuelos(f => f.filter(x => x.id !== d.id))} aria-label="Fechar">✕</button></div>
          <b className="pro-fim-duelo-tit">{d.resultado === 'venci' ? '🏆 ' : ''}{tituloDuelo(d)}</b>
          <p className="pro-sem-margem">Você {d.minha_nota != null ? `${String(Number(d.minha_nota).toFixed(1)).replace('.', ',')}%` : 'sem prova'} × @{d.adversario} {d.nota_adv != null ? `${String(Number(d.nota_adv).toFixed(1)).replace('.', ',')}%` : 'sem prova'}</p>
          {cardDuelo === d.id ? <CardDuelo d={d} eu={perfil.apelido} fechar={() => setCardDuelo(null)} /> : <button className="btn outline pro-btn" onClick={() => setCardDuelo(d.id)}>Card pro story</button>}
        </section>
      ))}
      {aba === 'campeonatos' && <TelaCampeonatos perfil={perfil} />}
      {aba === 'temporada' && <TelaTemporada perfil={perfil} temp={temp} irCorri={() => setAba('corri')} fotoMudou={recarregar} />}
      {aba === 'corri' && <TelaEuCorri perfil={perfil} pro={pro} assinar={irAssinar} pronto={() => { recarregar(); }} irTemporada={() => setAba('temporada')} />}
      {aba === 'feed' && <TelaFeed perfil={perfil} pro={pro} assinar={irAssinar} />}
      {aba === 'comunidades' && <TelaComunidades perfil={perfil} pro={pro} assinar={irAssinar} admin={admin} />}
      {aba === 'assista' && <TelaAssista />}
      {aba === 'provas' && <TelaProvas />}
      {aba === 'ranking' && <TelaRanking perfil={perfil} pro={pro} assinar={irAssinar} admin={admin} />}
      {aba === 'duelos' && (pro ? <TelaDuelos perfil={perfil} /> : <Travado tela="duelos" perfil={perfil} assinar={irAssinar} />)}
      {aba === 'conta' && <TelaConta key={stravaVersao} perfil={perfil} temp={temp} email={sessao.user.email ?? ''} pronto={recarregar} />}
      {aberto && <div ref={sobreRef} className="pro-sobre" role="dialog" aria-label={aberto.tipo === 'atleta' ? `Perfil de @${aberto.nome}` : aberto.nome}>
        <TopoVoltar titulo={aberto.tipo === 'atleta' ? `@${aberto.nome}` : aberto.nome} voltar={() => setAberto(null)} />
        {aberto.tipo === 'atleta' ? <PerfilPublico key={aberto.nome} apelido={aberto.nome} /> : <AssessoriaPublica key={aberto.nome} nome={aberto.nome} />}
      </div>}
      {aba === 'admin' && admin && <TelaAdmin />}
    </main>
  );
}

/* ───────── Menu de baixo: rola de lado, a aba ativa fica à vista, esfumado nas pontas quando tem mais ───────── */
function MenuAbas({ abas, aba, ir }: { abas: { id: Aba; nome: string; Icone: LucideIcon }[]; aba: Aba; ir: (a: Aba) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [borda, setBorda] = useState({ esq: false, dir: true });
  const medir = () => { const el = ref.current; if (!el) return; setBorda({ esq: el.scrollLeft > 6, dir: el.scrollLeft + el.clientWidth < el.scrollWidth - 6 }); };
  useEffect(() => { medir(); const el = ref.current; el?.addEventListener('scroll', medir, { passive: true }); window.addEventListener('resize', medir); return () => { el?.removeEventListener('scroll', medir); window.removeEventListener('resize', medir); }; }, []);
  useEffect(() => { ref.current?.querySelector<HTMLElement>('a[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); }, [aba]);
  return (
    <nav className={'pro-menu' + (borda.esq ? ' esq' : '') + (borda.dir ? ' dir' : '')} aria-label="Radar Pro">
      <div className="pro-menu-rol" ref={ref}>
        {abas.map(a => <a key={a.id} href={`#${a.id}`} aria-current={aba === a.id ? 'page' : undefined} onClick={e => { e.preventDefault(); ir(a.id); }}><a.Icone size={22} aria-hidden="true" /><span>{a.nome}</span></a>)}
      </div>
    </nav>
  );
}

/* ───────── Modo grátis: a tela existe, mas está trancada ───────── */
export function Travado({ tela, perfil, assinar }: { tela: 'temporada' | 'corri' | 'ranking' | 'duelos' | 'campeonatos'; perfil: Perfil; assinar: () => void }) {
  const T = {
    temporada: { t: 'Sua temporada', d: 'Índice, liga, pontos, medalhas e a sua posição no Maranhão. Cada prova que você corre entra aqui.', ex: ['Liga Ouro · índice 61,3', '4 provas · 3 cidades · 18º no MA', '12 medalhas'] },
    corri: { t: 'Eu corri uma prova', d: 'Cole o link do resultado e o Radar acha o seu tempo oficial, calcula a nota por idade e dá os pontos na hora.', ex: ['Corrida do Sol · 10 km · 48:12', 'Nota 68,4% · +18 pontos', 'Card pro story pronto'] },
    ranking: { t: 'Ranking do Maranhão', d: 'Por pontos, eficiência, cidade, sexo, faixa etária, assessoria e pelotão da sua liga.', ex: ['1  @zima · Caxias · 33', '2  @robe · Icatu · 23', '3  @…'] },
    campeonatos: { t: 'Liga Maranhense', d: 'A disputa prova a prova do Maranhão: pontos por colocação em cada prova com resultado oficial, valem as 6 melhores. Feminino e masculino.', ex: ['1  @zima · Caxias · 25', '2  @guilherme · 20', '3  @robe · Icatu · 16'] },
    duelos: { t: 'Duelos', d: 'Desafie um amigo: vence a maior nota por idade do mês. Dá pra duelar com quem tem idade diferente.', ex: ['Você 71,2% × @amigo 68,4%', 'Faltam 9 dias', '🏆 Você está na frente'] },
  }[tela];
  return (
    <div className="pro-cont">
      <section className="pro-card pro-travado" aria-label={`${T.t} (só no Pro)`}>
        <div className="pro-travado-ex" aria-hidden="true">{T.ex.map(x => <p key={x}>{x}</p>)}</div>
        <div className="pro-travado-capa"><span className="pro-travado-cadeado">🔒</span><b>{T.t}</b><p>{T.d}</p><button className="btn solid pro-btn" onClick={assinar}>Assinar o Radar Pro · R$ 10</button><small>Menos que uma inscrição de 5 km. Sem fidelidade.</small></div>
      </section>
      <p className="fine pro-centro">Oi, @{perfil.apelido}. No modo grátis você vê tudo, publica, segue e reage. Para competir, é o Pro.</p>
    </div>
  );
}

/* ───────── Vitrine: fotos dos atletas passando + quantos já estão no Radar (número real) ───────── */
function Vitrine() {
  const [d, setD] = useState<{ total: number; fotos: { foto: string; apelido: string }[] } | null>(null);
  useEffect(() => { sb.rpc('radar_vitrine').then(({ data }) => { if (data) setD(data as typeof d); }); }, []);
  if (!d || d.total < 1) return null;
  const dez = Math.floor(d.total / 10) * 10;
  const txt = d.total < 10 || d.total === dez ? `${d.total} atletas inscritos` : `Mais de ${dez} atletas inscritos`;
  const fotos = d.fotos.length >= 4 ? d.fotos : [];
  return (
    <section className="pro-vitrine" aria-label={`${txt} até o momento`}>
      {fotos.length > 0 && <div className="pro-vitrine-faixa" aria-hidden="true">
        <div className="pro-vitrine-trilho" style={{ animationDuration: `${Math.max(18, fotos.length * 2.2)}s` }}>
          {[...fotos, ...fotos].map((f, i) => <img key={i} src={f.foto} alt="" loading="lazy" decoding="async" />)}
        </div>
      </div>}
      <p><b>{txt}</b> até o momento</p>
    </section>
  );
}

/* ───────── Medalha Fundador: só quem assinar até 31/12/2026 (some sozinho em 2027) ───────── */
const FIM_FUNDADOR = new Date('2027-01-01T03:00:00Z');
function ChamadaFundador() {
  const agora = Date.now();
  if (agora >= FIM_FUNDADOR.getTime()) return null;
  const m = LISTA_MEDALHAS.find(x => x.id === 'fundador');
  const dias = Math.ceil((FIM_FUNDADOR.getTime() - agora) / 86400_000);
  return (
    <section className="pro-fundador">
      {m && <span className="pro-fundador-med" aria-hidden="true" dangerouslySetInnerHTML={{ __html: medalhaSVG(m, true, 84) }} />}
      <div>
        <p className="pro-fundador-k">Edição limitada</p>
        <b>Conquiste a medalha Fundador</b>
        <span>Só quem assinar o Radar Pro até <b>31/12/2026</b> leva. Depois disso, ninguém mais conquista: ela fica para sempre no perfil dos primeiros.</span>
        <small>{dias === 1 ? 'Último dia' : `Faltam ${dias} dias`}</small>
      </div>
    </section>
  );
}

/* ───────── 1 · Convite + login ───────── */
function Convite() {
  const [email, setEmail] = useState('');
  const cortesia = codigoCortesia();
  const [modo, setModo] = useState<'botoes' | 'email' | 'enviado'>('botoes');
  const [erro, setErro] = useState<string | null>(null);
  const [limite, setLimite] = useState(false); // e-mail de login esgotou por agora: o Google entra na hora
  const volta = window.location.origin + '/?pro' + (qs.get('c') ? `=duelo&c=${qs.get('c')}` : cortesia ? `=cortesia&k=${encodeURIComponent(cortesia)}` : '');
  const [comunidade, setComunidade] = useState<{ nome: string; descricao: string; foto: string | null; emoji: string; cor: string; membros: number } | null>(null);
  useEffect(() => { const id = conviteComunidade(); if (id) sb.rpc('radar_comunidade_convite', { p_id: id }).then(({ data }) => { if (data) setComunidade(data as typeof comunidade); }); }, []);
  const google = async () => {
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: volta } });
    if (error) setErro('O login com Google ainda não está disponível. Use o e-mail.');
  };
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault(); setErro(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) { setErro('Confira o e-mail.'); return; }
    const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: volta } });
    if (error) { if (/rate|limit/i.test(error.message)) { setLimite(true); setErro(null); } else setErro('Não deu para enviar o e-mail. Tente de novo.'); }
    else setModo('enviado');
  };
  return (
    <>
      {comunidade && <section className="pro-card pro-convite-com">
        <div className="pro-comun-capa" style={{ '--cor': comunidade.cor } as React.CSSProperties}>
          {comunidade.foto ? <img src={comunidade.foto} alt="" /> : <span className="pro-comun-semfoto" aria-hidden="true">{comunidade.emoji}</span>}
          <span className="pro-comun-veu" aria-hidden="true" />
          <div><p className="pro-k">Você foi convidado para a comunidade</p><p className="pro-comun-nome">{comunidade.nome}</p></div>
        </div>
        <p className="pro-sub pro-sem-margem">{comunidade.descricao}</p>
        <p className="pro-convite-com-gratis"><b>É grátis.</b> Entre com o Google, crie seu perfil de atleta e você já cai dentro da comunidade para ler e publicar.</p>
      </section>}
      <section className="pro-card azul pro-hero">
        <p className="pro-k">Radar Pro · a rede social do corredor maranhense</p>
        <h1>Sua corrida<br />vira <span>temporada.</span></h1>
        <p>Agenda de todas as provas do Maranhão, resultado oficial pelo número de peito, ranking, medalhas e a galera que corre com você.</p>
        <p className="pro-entrar-gratis">✓ Entrar é grátis · leva 10 segundos</p>
      </section>
      {modo === 'botoes' && <button className="btn solid pro-btn pro-cta" onClick={google}>{GOOGLE_IC}Entrar grátis com Google</button>}
      {provaPedida() && <div className="pro-card pro-cortesia"><b>📍 Falta só entrar</b><span>A agenda agora fica dentro do Radar Pro, de graça. Entre com o Google e a prova que você abriu já aparece.</span></div>}
      <Vitrine />
      <ol className="pro-lista">
        <li><i>1</i><span><b>Agenda de corridas do Maranhão, grátis</b><small>Todas as provas de rua e trail, com inscrição, kit, largada e clima.</small></span></li>
        <li><i>2</i><span><b>Seu nível e sua liga</b><small>Bronze, Prata, Ouro ou Elite, pela nota por idade.</small></span></li>
        <li><i>3</i><span><b>Medalhas e pontos</b><small>Toda prova que você corre entra na sua estante.</small></span></li>
        <li><i>4</i><span><b>Ranking do Maranhão</b><small>Por cidade, sexo, faixa etária, eficiência e assessoria.</small></span></li>
        <li><i>5</i><span><b>Duelo e pelotão</b><small>Desafie amigos e dispute com até 25 atletas do seu nível.</small></span></li>
      </ol>
      {cortesia && <div className="pro-card pro-cortesia"><b>🎁 Acesso cortesia</b><span>Entre com o Google e o Radar Pro já vem liberado, sem pagar.</span></div>}
      {modo === 'botoes' && <>
        <p className="fine pro-centro pro-aviso-google">A tela do Google mostra o endereço <b>xsijphfxcorjsuxiewch.supabase.co</b>: é o servidor do Radar, pode seguir. O Google só passa seu nome, foto e e-mail.</p>
        <button className="btn solid pro-btn pro-cta" onClick={google}>{GOOGLE_IC}Entrar grátis com Google</button>
      </>}
      {modo === 'email' && (
        <form className="pro-form" onSubmit={enviar}>
          <label className="ct-cidade">Seu e-mail<input type="email" inputMode="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" /></label>
          {limite
            ? <div className="pro-card pro-limite"><b>O envio por e-mail está cheio neste momento.</b><p className="pro-sem-margem">Entre com o Google: é na hora e sem e-mail.</p><button className="btn solid pro-btn" type="button" onClick={google}><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>Entrar com Google</button><small className="fine">Ou tente o e-mail de novo daqui a alguns minutos.</small></div>
            : <button className="btn solid pro-btn" type="submit">Receber link de acesso</button>}
          <button className="btn text" type="button" onClick={() => { setModo('botoes'); setLimite(false); }}>Voltar</button>
        </form>
      )}
      {modo === 'enviado' && <p className="pro-ok">Pronto! Abra o e-mail que mandamos para <b>{email}</b> e toque no link para entrar. Olhe também a caixa de spam.</p>}
      {erro && <p className="ct-erro" role="alert">{erro}</p>}
      <p className="fine pro-centro">Entrar é grátis e a agenda é de todo mundo. Ao entrar, você aceita os <a href="/termos.html">termos de uso e a política de privacidade</a>.</p>
    </>
  );
}

/* ───────── Perfil ───────── */
export const NOMES_CIDADES = Object.keys(CIDADES as Record<string, unknown>).sort((a, b) => a.localeCompare(b, 'pt-BR'));
/** Assessorias conhecidas (sugestão no campo; dá para digitar uma nova). */
export function useAssessorias() {
  const [lista, setLista] = useState<string[]>([]);
  useEffect(() => { sb.from('radar_assessorias').select('nome').order('nome').then(({ data }) => setLista((data ?? []).map(x => x.nome))); }, []);
  return lista;
}
export const CampoAssessoria = ({ value, onChange, id = 'pro-assessorias' }: { value: string; onChange: (v: string) => void; id?: string }) => {
  const lista = useAssessorias();
  const [aberto, setAberto] = useState(false);
  const q = value.trim().toLowerCase();
  const vis = aberto ? lista.filter(n => !q || n.toLowerCase().includes(q) || n.toLowerCase() === q) : [];
  const escolhida = lista.find(n => n.toLowerCase() === q);
  return (
    <div className="ct-cidade pro-campo-asse">
      <label htmlFor={id + '-in'}>Assessoria ou grupo <small>(opcional)</small></label>
      <input id={id + '-in'} list={id} value={value} onChange={e => onChange(e.target.value)} placeholder="Escreva a sua ou escolha abaixo" autoComplete="off" />
      <datalist id={id}>{lista.map(n => <option key={n} value={n} />)}</datalist>
      {lista.length > 0 && <button type="button" className="btn outline pro-btn-p pro-asse-btn" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
        <Users size={16} aria-hidden="true" />{aberto ? 'Fechar a lista' : `Selecionar assessorias disponíveis (${lista.length})`}
      </button>}
      {aberto && <div className="pro-asse-lista" role="group" aria-label="Assessorias disponíveis">
        {(vis.length ? vis : lista).map(n => <button type="button" key={n} className={'chip' + (escolhida === n ? ' on' : '')} aria-pressed={escolhida === n} onClick={() => { onChange(n); setAberto(false); }}>{escolhida === n && <Check size={14} aria-hidden="true" />}{n}</button>)}
        {q && !vis.length && <p className="fine pro-sem-margem">Nenhuma com “{value.trim()}”. Pode deixar escrito: ela entra como nova.</p>}
      </div>}
      {escolhida ? <small>✓ Você vai somar pontos com <b>{escolhida}</b>.</small> : <small>Escolha da lista ou escreva igual ao nome da sua equipe para somar pontos com ela.</small>}
    </div>
  );
};
function FormPerfil({ uid, email, pronto }: { uid: string; email: string; pronto: () => void }) {
  const [f, setF] = useState({ apelido: email.split('@')[0].toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 20), nome_completo: '', cidade: 'São Luís', sexo: '' as '' | 'F' | 'M', pcd: false, genero: '', nascimento: '', assessoria: '', whatsapp: '' });
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
    const zap = zapLimpo(f.whatsapp);
    if (!zap) return setErro(f.whatsapp.trim() ? 'Confira o WhatsApp: DDD + número, ex.: (98) 98765-4321.' : 'Informe o seu WhatsApp.');
    setSalvando(true);
    const { error } = await sb.from('radar_perfis').insert({ user_id: uid, apelido: ap, nome_completo: f.nome_completo.trim().replace(/\s+/g, ' '), cidade: f.cidade, sexo: f.sexo, pcd: f.pcd, genero: f.genero || null, nascimento: nasc, assessoria: f.assessoria.trim() || null, whatsapp: zap });
    setSalvando(false);
    if (error) return setErro(error.code === '23505' ? 'Esse apelido já existe. Escolha outro.' : 'Não deu para salvar. Tente de novo.');
    try { const ref = localStorage.getItem('radar-ref'); if (ref) { await sb.rpc('radar_indicar', { p_apelido: ref }); localStorage.removeItem('radar-ref'); } } catch { /* */ }
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
      <div className="chips" role="group" aria-label="Categoria"><button type="button" className="chip" aria-pressed={f.sexo === 'F'} onClick={() => setF({ ...f, sexo: 'F' })}>Feminino</button><button type="button" className="chip" aria-pressed={f.sexo === 'M'} onClick={() => setF({ ...f, sexo: 'M' })}>Masculino</button><button type="button" className={'chip pro-chip-pcd' + (f.pcd ? ' on' : '')} aria-pressed={f.pcd} onClick={() => setF({ ...f, pcd: !f.pcd })}><Accessibility size={14} aria-hidden="true" /> PCD</button></div>
      <p className="fine pro-sem-margem">Categoria é a da inscrição nas provas. Marque PCD se você corre na categoria PCD: você entra no ranking geral e também no recorte PCD.</p>
      <label className="ct-cidade">Gênero <small>(opcional, como você se identifica)</small><select value={f.genero} onChange={e => setF({ ...f, genero: e.target.value })}><option value="">Não informar</option>{GENEROS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
      <label className="ct-cidade">Data de nascimento<input inputMode="numeric" value={f.nascimento} onChange={e => setF({ ...f, nascimento: masc(e.target.value) })} placeholder="dd/mm/aaaa" /><small>Usada só para a nota por idade e a faixa etária.</small></label>
      <CampoAssessoria value={f.assessoria} onChange={v => setF({ ...f, assessoria: v })} />
      <label className="ct-cidade">WhatsApp<input type="tel" required inputMode="tel" autoComplete="tel" value={f.whatsapp} onChange={e => setF({ ...f, whatsapp: zapMascara(e.target.value) })} placeholder="(98) 98765-4321" /><small>Para o Radar falar com você sobre os seus resultados e provas. Não aparece para ninguém.</small></label>
      {erro && <p className="ct-erro" role="alert">{erro}</p>}
      <button className="btn solid pro-btn" disabled={salvando}>{salvando ? 'Salvando…' : 'Continuar'}</button>
      <button className="btn text" type="button" onClick={() => sb.auth.signOut()}><LogOut size={16} aria-hidden="true" />Sair</button>
    </form>
  );
}

/* ───────── 2 · Assinar com Pix ───────── */
export const PLANOS = {
  diaria: { nome: 'Diária', preco: 'R$ 4,50', sub: '24 horas de Pro', dias: 1 },
  mensal: { nome: 'Mensal', preco: 'R$ 10', sub: '30 dias · sem fidelidade', dias: 30 },
  anual: { nome: 'Anual', preco: 'R$ 96', sub: '12 meses pelo preço de 10', dias: 365 },
  equipe: { nome: 'Assessoria', preco: 'R$ 150', sub: '30 dias · você + até 20 alunos', dias: 30 },
} as const;
export type Plano = keyof typeof PLANOS;

export function Assinar({ perfil, pronto, planoInicial = 'mensal', fixo = false }: { perfil: Perfil; pronto: () => void; planoInicial?: Plano; fixo?: boolean }) {
  const [plano, setPlano] = useState<Plano>(planoInicial);
  const [pix, setPix] = useState<{ qr: string; qr_img: string } | null>(null);
  const [estado, setEstado] = useState<'inicio' | 'gerando' | 'aguardando' | 'indisponivel' | 'pago'>('inicio');
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const P = PLANOS[plano];
  const gerar = async () => {
    setEstado('gerando'); setErro(null);
    const r = await chamar<{ qr: string; qr_img: string; indisponivel?: boolean }>('radar-pix', { plano });
    if (r.indisponivel) return setEstado('indisponivel');
    if (r.erro) { setErro(r.erro); return setEstado('inicio'); }
    setPix(r); setEstado('aguardando');
  };
  // confere sozinho a cada 5 s se o Pix caiu
  useEffect(() => {
    if (estado !== 'aguardando') return;
    const t = setInterval(async () => { const r = await chamar<{ ativo: boolean; equipe_valida_ate?: string | null }>('radar-pix', { acao: 'status' }); if (r.ativo || (plano === 'equipe' && r.equipe_valida_ate && new Date(r.equipe_valida_ate) > new Date())) { setEstado('pago'); clearInterval(t); setTimeout(pronto, 1800); } }, 5000);
    return () => clearInterval(t);
  }, [estado, pronto, plano]);
  const copiar = async () => { try { await navigator.clipboard.writeText(pix!.qr); setCopiado(true); setTimeout(() => setCopiado(false), 2500); } catch { /* */ } };
  return (
    <div className="pro-form">
      {!fixo && estado === 'inicio' && (
        <div className="pro-planos" role="group" aria-label="Plano">
          {(Object.keys(PLANOS) as Plano[]).map(k => <button key={k} className={'pro-plano' + (plano === k ? ' on' : '')} aria-pressed={plano === k} onClick={() => setPlano(k)}><small>{PLANOS[k].nome}</small><b>{PLANOS[k].preco}</b><span>{PLANOS[k].sub}</span>{k === 'anual' && <i>2 meses grátis</i>}</button>)}
        </div>
      )}
      <div className="pro-card pro-centro">
        <p className="pro-k cinza">Radar Pro · {P.nome} · {P.dias === 365 ? '1 ano' : P.dias === 1 ? '24 horas' : '30 dias'}</p>
        <p className="pro-valor">{P.preco.includes(',') ? P.preco : `${P.preco},00`}</p>
        {plano === 'equipe' && estado === 'inicio' && <p className="fine pro-sem-margem">Libera o Pro para você e até 20 alunos que tenham “{perfil.assessoria || 'sua assessoria'}” no perfil. Você escolhe quem entra, na aba Conta.</p>}
        {estado === 'aguardando' && pix && <><img className="pro-qr" src={`data:image/png;base64,${pix.qr_img}`} alt="QR Code do Pix" /><p className="fine">Aponte a câmera do app do seu banco</p></>}
        {estado === 'pago' && <p className="pro-ok">Pagamento recebido! Liberando o seu Radar Pro…</p>}
      </div>
      {estado === 'inicio' && <button className="btn solid pro-btn" onClick={gerar} disabled={plano === 'equipe' && !perfil.assessoria}>Gerar Pix de {P.preco}</button>}
      {estado === 'inicio' && plano === 'equipe' && !perfil.assessoria && <p className="ct-erro">Antes, escreva o nome da sua assessoria no seu perfil (Conta → Editar perfil).</p>}
      {estado === 'gerando' && <button className="btn solid pro-btn" disabled>Gerando…</button>}
      {estado === 'aguardando' && pix && <>
        <label className="ct-cidade">Pix copia e cola<textarea className="pro-copia" readOnly value={pix.qr} rows={3} onFocus={e => e.target.select()} /></label>
        <button className="btn pro-btn pro-pix" onClick={copiar}>{copiado ? 'Copiado!' : 'Copiar código Pix'}</button>
        <p className="pro-ok">Assim que o Pix cair, o acesso libera sozinho nesta tela.</p>
      </>}
      {estado === 'indisponivel' && <>
        <p className="pro-aviso">O pagamento automático está sendo ativado. Por enquanto, chame o Radar no WhatsApp que a gente libera o seu acesso na hora.</p>
        <a className="btn whats pro-btn" href={whatsappLink(`Oi! Quero assinar o Radar Pro (${P.nome}, ${P.preco}). Meu apelido é @${perfil.apelido}.`)} target="_blank" rel="noopener">Assinar pelo WhatsApp</a>
      </>}
      {erro && <p className="ct-erro" role="alert">{erro}</p>}
      <p className="fine pro-centro">Sem renovação automática: você paga um Pix e só renova se quiser continuar. A agenda segue grátis.</p>
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

/* ───────── Boas-vindas ao Pro: tela cheia, uma vez, na hora em que o acesso é liberado ───────── */
function BemVindoPro({ fechar }: { fechar: () => void }) {
  useEffect(() => { const t = setTimeout(() => document.getElementById('bemvindo-btn')?.focus(), 400); return () => clearTimeout(t); }, []);
  return (
    <div className="pro-bemvindo" role="dialog" aria-modal="true" aria-labelledby="bemvindo-titulo">
      <div className="pro-bemvindo-cx">
        <p className="pro-bemvindo-k">Bem-vindo ao</p>
        <h1 id="bemvindo-titulo">Radar Pro</h1>
        <p className="pro-bemvindo-frase">Cada prova que você correr agora vira ponto, medalha e lugar no ranking do Maranhão.<br />A largada é sua.</p>
        <button id="bemvindo-btn" className="btn solid pro-bemvindo-btn" onClick={fechar}>Vamos lá</button>
      </div>
    </div>
  );
}

/* ───────── Abertura: logo grande entra, um reflexo passa por ela, e o app aparece por baixo ───────── */
function Abertura({ saindo }: { saindo: boolean }) {
  return (
    <div className={'pro-abertura' + (saindo ? ' saindo' : '')} aria-hidden="true">
      <div className="pro-abertura-logo"><Logo tam={150} /><i /></div>
      <p className="pro-abertura-nome">Radar <span>Pro</span></p>
      <p className="pro-abertura-sub">Temporada do Maranhão</p>
    </div>
  );
}

