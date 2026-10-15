import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, CalendarPlus, Check, ExternalLink, MapPin, Mountain, Search, X, Download, RotateCcw, Link2, Smartphone, MessageCircle, Instagram, Banknote, PartyPopper, Moon, Sun, SlidersHorizontal, ArrowUpRight, Activity } from 'lucide-react';
import InstallPrompt, { openInstallPrompt } from './InstallPrompt';
import { HeroBackdrop, CountUp, useReveal } from './HeroFx';
import { detect } from './install';
import { useTema } from './tema';
import ClimaLargada, { ClimaHero, SeloClima, useClimas, type Clima } from './Clima';
import EuVou from './EuVou';
import Altimetria, { SeloSubida } from './Altimetria';
import AssinarAgenda, { linkCalendario } from './Calendario';
import { type Race, type State, countdown, deadline, fmt, icsFor, isOpen, load, norm, status, store, today, daysUntil, placeLabel, placeList, isSingleSource, whatsappLink, hasCashPrize, money } from './lib';

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

type Tab = 'agenda' | 'novidades' | 'salvas' | 'sobre';
const TABS: { id: Tab; label: string }[] = [
  { id: 'agenda', label: 'Agenda' },
  { id: 'novidades', label: 'Novidades' },
  { id: 'salvas', label: 'Minha agenda' },
  { id: 'sobre', label: 'Sobre' },
];

const SOURCES = [
  { name: 'Central da Corrida', what: 'Plataforma de inscrições', url: 'https://centraldacorrida.com.br/' },
  { name: 'O2 Corre', what: 'Calendário nacional de provas', url: 'https://www.o2corre.com.br/' },
  { name: 'Sou Corredor', what: 'Calendário com links oficiais', url: 'https://soucorredor.com.br/' },
  { name: 'Maranhão Esportes', what: 'Notícias e anúncios locais', url: 'https://www.maranhaoesportes.com/' },
  { name: 'Todas Corridas', what: 'Detalhes de provas (fonte secundária)', url: 'https://todascorridas.com.br/' },
];

function Logo() {
  return (
    <svg className="logo" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" />
      <g fill="none" strokeWidth="2.2"><path d="M4 12a8 8 0 0 0 8-8M20 4a8 8 0 0 0 8 8M28 20a8 8 0 0 0-8 8M12 28a8 8 0 0 0-8-8" /><path d="M16 9l7 7-7 7-7-7z" /></g>
    </svg>
  );
}

function MissingRace() {
  return (
    <section className="missing" aria-labelledby="missing-title">
      <div>
        <h2 id="missing-title">Falta alguma corrida?</h2>
        <p>Viu uma prova no Maranhão que não está aqui? Mande o nome, a cidade e a data, ou o link do anúncio. Ela entra na agenda assim que for conferida.</p>
      </div>
      <a className="btn whats" data-umami-event="WhatsApp: falta corrida" href={whatsappLink('Olá! Tem uma corrida que não está no Radar Corridas Maranhão: ')} target="_blank" rel="noopener noreferrer">
        <MessageCircle size={18} aria-hidden="true" />Avisar pelo WhatsApp
      </a>
    </section>
  );
}

function StatusTag({ e }: { e: Race }) {
  const s = status(e);
  const tone = s === 'Abertas' || s === 'Abertura anunciada' ? 'open' : s === 'Cancelada' ? 'bad' : s === 'Realizada' || s === 'Encerradas' ? 'done' : s === 'Abrem em breve' ? 'soon' : 'check';
  const label = s === 'Consultar' ? 'Confirmar inscrições' : s === 'Abertura anunciada' ? 'Abertas' : s;
  return <span className={'tag ' + tone}>{label}</span>;
}

export default function App() {
  const [data, setData] = useState<State | null>(null);
  const [error, setError] = useState('');
  // Atalhos do app instalado (?aba=salvas) abrem direto na aba certa.
  const [tab, setTab] = useState<Tab>(() => {
    const a = new URLSearchParams(window.location.search).get('aba');
    return a === 'novidades' || a === 'salvas' || a === 'sobre' ? a : 'agenda';
  });
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('aba') && !params.has('origem')) return;
    params.delete('aba'); params.delete('origem');
    window.history.replaceState(null, '', window.location.pathname + (params.toString() ? '?' + params : '') + window.location.hash);
  }, []);
  const [isApp] = useState(() => detect().standalone);
  const heroRef = useRef<HTMLElement>(null);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'Todas' | 'Rua' | 'Trail'>('Todas');
  const [dist, setDist] = useState<number | null>(null);
  const [city, setCity] = useState('Todas');
  const [year, setYear] = useState('Todos');
  const [month, setMonth] = useState('Todos');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [onlyPrize, setOnlyPrize] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false); // no celular os filtros ficam recolhidos
  // dica "use os Filtros" até a pessoa abrir os filtros pela primeira vez neste aparelho
  const [filtrosVistos, setFiltrosVistos] = useState(() => { try { return localStorage.getItem('radar-filtros-visto') === '1'; } catch { return false; } });
  // Contador: qual filtro as pessoas usam (para decidir atalhos depois)
  function rastrear(nome: string, valor?: string) { try { (window as unknown as { umami?: { track: (n: string, d?: object) => void } }).umami?.track(nome, valor ? { valor } : undefined); } catch { /* contador fora do ar não atrapalha */ } }
  function alternarFiltros() {
    setFiltrosAbertos(!filtrosAbertos);
    if (!filtrosVistos) { setFiltrosVistos(true); try { localStorage.setItem('radar-filtros-visto', '1'); } catch { /* */ } }
  }
  const [showPast, setShowPast] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => load('radar-favorites', []));
  const [seen, setSeen] = useState<string[]>(() => load('radar-seen', []));
  const [selected, setSelected] = useState<Race | null>(null);
  const tema = useTema();
  // "Eu vou!": a pessoa escolhe a prova na agenda e a ficha já abre com o card do story pronto
  const [escolhendo, setEscolhendo] = useState(false);
  const [abrirCard, setAbrirCard] = useState(false);
  const [semFabCard, setSemFabCard] = useState(false); // fechado pelo X: volta na próxima visita
  const [semFabTreino, setSemFabTreino] = useState(false);
  function abrirProva(e: Race) { setAbrirCard(escolhendo); setEscolhendo(false); setSelected(e); }
  function comecarEuVou() {
    setTab('agenda'); setEscolhendo(true);
    requestAnimationFrame(() => document.getElementById('escolha-prova')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
  const [toast, setToast] = useState('');

  useEffect(() => {
    fetch('/data/radar.json', { cache: 'no-store' })
      .then(r => { if (!r.ok) throw Error(); return r.json(); })
      .then((d: State) => {
        // Primeira visita: o que já existe não conta como novidade; o contador só mostra o que chegar depois.
        try { if (localStorage.getItem('radar-seen') === null) { const all = d.changes.map(c => c.id); store('radar-seen', all); setSeen(all); } } catch { /* sem armazenamento */ }
        setData(d);
      })
      .catch(() => setError('A agenda não carregou. Confira sua conexão e recarregue a página.'));
  }, []);
  // Link direto para uma prova (/?prova=id), usado pelas páginas de cada cidade: abre a ficha da prova.
  useEffect(() => {
    if (!data) return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get('prova');
    if (id == null) return;
    params.delete('prova');
    window.history.replaceState(null, '', window.location.pathname + (params.toString() ? '?' + params : '') + window.location.hash);
    const e = data.events.find(x => x.id === id);
    if (e) { setTab('agenda'); setSelected(e); } else setToast('Essa prova não está mais na agenda.');
  }, [data]);
  // Link de agenda compartilhada: /?agenda=id1,id2 soma as provas à agenda deste aparelho.
  useEffect(() => {
    if (!data) return;
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('agenda');
    if (raw == null) return;
    const ids = raw.split(',').map(x => x.trim()).filter(id => data.events.some(e => e.id === id));
    params.delete('agenda');
    window.history.replaceState(null, '', window.location.pathname + (params.toString() ? '?' + params : '') + window.location.hash);
    setFavorites(prev => {
      const added = ids.filter(id => !prev.includes(id));
      const v = [...prev, ...added];
      store('radar-favorites', v);
      setToast(!ids.length ? 'As provas desse link não estão mais na agenda.' : added.length ? `${added.length === 1 ? '1 prova adicionada' : added.length + ' provas adicionadas'} à sua agenda.` : 'Essas provas já estavam na sua agenda.');
      return v;
    });
    setTab('salvas');
  }, [data]);
  // Contador: registra cada aba aberta (as visitas ao site o Umami já conta sozinho)
  useEffect(() => {
    const nomes: Record<string, string> = { agenda: 'Agenda', novidades: 'Novidades', salvas: 'Minha agenda', sobre: 'Sobre' };
    const t = setTimeout(() => { try { (window as unknown as { umami?: { track: (n: string, d?: object) => void } }).umami?.track('Aba aberta', { aba: nomes[tab] ?? tab }); } catch { /* contador fora do ar não atrapalha */ } }, 1500);
    return () => clearTimeout(t);
  }, [tab]);
  // busca: registra o que foi procurado (só o texto, sem nada da pessoa), depois que ela para de digitar
  useEffect(() => {
    const termo = query.trim().toLowerCase();
    if (termo.length < 3) return;
    const t = setTimeout(() => rastrear('Busca', termo.slice(0, 40)), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 4000); return () => clearTimeout(t); }, [toast]);

  const events = data?.events ?? [];
  const t = today();
  const upcoming = useMemo(() => events.filter(e => !e.date || e.date >= t).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')), [events, t]);
  const next = upcoming.find(e => e.date && status(e) !== 'Cancelada');
  const previsoes = useClimas(upcoming);
  const cidadesFuturas = useMemo(() => {
    const m = new Map<string, number>();
    upcoming.filter(e => e.date && e.status !== 'Cancelada').forEach(e => m.set(e.city, (m.get(e.city) ?? 0) + 1));
    return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'));
  }, [upcoming]);
  const unread = (data?.changes ?? []).filter(c => !seen.includes(c.id)).length;
  const cities = useMemo(() => [...new Set(events.map(e => e.city))].sort((a, b) => a === 'São Luís' ? -1 : b === 'São Luís' ? 1 : a.localeCompare(b)), [events]);
  // Só as distâncias mais procuradas viram botão; as outras continuam na ficha de cada prova.
  const distances = useMemo(() => { const has = new Set(events.flatMap(e => e.distances)); return [3, 5, 10, 15, 21, 42].filter(d => has.has(d)); }, [events]);

  const filtered = useMemo(() => events
    .filter(e => tab !== 'salvas' || favorites.includes(e.id))
    .filter(e => showPast || tab === 'salvas' || !e.date || e.date >= t)
    .filter(e => !query || norm(`${e.name} ${e.city} ${e.location} ${e.date ? MESES[Number(e.date.slice(5, 7)) - 1] + ' ' + e.date.slice(0, 4) : ''}`).includes(norm(query)))
    .filter(e => mode === 'Todas' || e.modality === mode)
    .filter(e => dist == null || e.distances.includes(dist))
    .filter(e => city === 'Todas' || e.city === city)
    .filter(e => year === 'Todos' || e.date?.slice(0, 4) === year)
    .filter(e => month === 'Todos' || e.date?.slice(5, 7) === month)
    .filter(e => !onlyOpen || isOpen(e))
    .filter(e => !onlyPrize || hasCashPrize(e))
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')), [events, tab, favorites, showPast, query, mode, dist, city, year, month, onlyOpen, onlyPrize, t]);

  const groups = useMemo(() => {
    const m = new Map<string, Race[]>();
    for (const e of filtered) { const k = e.date ? fmt.monthKey(e.date) : 'sem-data'; m.set(k, [...(m.get(k) ?? []), e]); }
    return [...m.entries()];
  }, [filtered]);

  const openCount = upcoming.filter(isOpen).length;
  const nextDeadline = upcoming.filter(e => isOpen(e) && e.registrationClose).sort((a, b) => a.registrationClose!.localeCompare(b.registrationClose!))[0];
  // Anos e meses que têm prova (considera as realizadas só quando o filtro pede)
  const dated = useMemo(() => events.filter(e => e.date && (showPast || e.date >= t)), [events, showPast, t]);
  const years = useMemo(() => [...new Set(dated.map(e => e.date!.slice(0, 4)))].sort(), [dated]);
  const months = useMemo(() => [...new Set(dated.filter(e => year === 'Todos' || e.date!.startsWith(year)).map(e => e.date!.slice(5, 7)))].sort(), [dated, year]);
  useEffect(() => { if (month !== 'Todos' && !months.includes(month)) setMonth('Todos'); }, [months, month]);
  const prizeCount = useMemo(() => events.filter(e => hasCashPrize(e) && (showPast || !e.date || e.date >= t)).length, [events, showPast, t]);
  const filtrosAtivos = [mode !== 'Todas', dist != null, city !== 'Todas', year !== 'Todos', month !== 'Todos', onlyOpen, onlyPrize, showPast].filter(Boolean).length;
  const filtersOn = query || mode !== 'Todas' || dist != null || city !== 'Todas' || year !== 'Todos' || month !== 'Todos' || onlyOpen || onlyPrize || showPast;

  function toggleSave(e: Race) {
    const v = favorites.includes(e.id) ? favorites.filter(id => id !== e.id) : [...favorites, e.id];
    setFavorites(v); store('radar-favorites', v);
    setToast(v.includes(e.id) ? 'Prova salva na sua agenda.' : 'Prova removida da sua agenda.');
  }
  function markAllRead() { const v = (data?.changes ?? []).map(c => c.id); setSeen(v); store('radar-seen', v); }
  function clearFilters() { setQuery(''); setMode('Todas'); setDist(null); setCity('Todas'); setYear('Todos'); setMonth('Todos'); setOnlyOpen(false); setOnlyPrize(false); setShowPast(false); }
  async function copyAgendaLink() {
    const url = `${window.location.origin}/?agenda=${favorites.join(',')}`;
    try { await navigator.clipboard.writeText(url); setToast('Link copiado. Abra em outro aparelho ou envie para alguém.'); }
    catch { window.prompt('Copie o link da sua agenda:', url); }
  }
  useReveal([tab, filtered, data]);
  const onInstalled = useCallback(() => setToast('App instalado. Procure o ícone Corridas MA na tela inicial.'), []);
  function exportCalendar(list: Race[]) { icsFor(list); setToast(list.length === 1 ? 'Arquivo de calendário baixado.' : `${list.filter(e => e.date).length} provas exportadas para o calendário.`); }

  return (
    <>
      <header className="top">
        <div className="top-inner">
          <div className="brand-wrap">
            <a className="brand" href="/" aria-label="Radar Corridas Maranhão, página inicial"><Logo /><span>Radar Corridas Maranhão</span></a>
            <a className="byline" href="https://www.instagram.com/gabriel_vinicius_jj/" target="_blank" rel="noopener noreferrer">Desenvolvido por <strong>@gabriel_vinicius_jj</strong></a>
          </div>
          <nav className="tabs" aria-label="Seções">
            {TABS.map(x => (
              <button key={x.id} className={tab === x.id ? 'tab on' : 'tab'} aria-current={tab === x.id ? 'page' : undefined} onClick={ev => { setTab(x.id); window.scrollTo({ top: 0 }); ev.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }}>
                {x.label}
                {x.id === 'novidades' && unread > 0 && <span className="count" aria-label={unread + ' não lidas'}>{unread}</span>}
                {x.id === 'salvas' && favorites.length > 0 && <span className="count quiet">{favorites.length}</span>}
              </button>
            ))}
            <a className="tab tab-treino" href="/?card=treino" data-umami-event="Card do treino: abriu pelo menu"><Activity size={16} aria-hidden="true" /><span className="lbl-longo">Meu treino</span><span className="lbl-curto">Treino</span></a>
          </nav>
          <button className="tema-btn" onClick={tema.alternar} aria-label={tema.escuro ? 'Mudar para o modo claro' : 'Mudar para o modo escuro'} title={tema.escuro ? 'Modo claro' : 'Modo escuro'}>
            {tema.escuro ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
          </button>
        </div>
      </header>

      {error && <p className="alert" role="alert">{error}</p>}
      {!data && !error && <p className="loading">Carregando a agenda…</p>}

      {data && tab === 'agenda' && (
        <section className="hero" aria-labelledby="next-title" ref={heroRef}>
          <HeroBackdrop hostRef={heroRef} />
          <div className="hero-inner">
            {next ? <>
              <div className="hero-text">
                <p className="live"><span className="live-dot" aria-hidden="true" />Radar ativo, conferido {fmt.checked(data.lastChecked)}</p>
                <p className="hero-kicker">Próxima largada</p>
                <h1 id="next-title"><button onClick={() => setSelected(next)}>{next.name}</button></h1>
                <p className="hero-when">{fmt.long(next.date)}</p>
                <p className="hero-where"><MapPin size={16} aria-hidden="true" />{placeLabel(next)}</p>
                <ClimaHero c={previsoes[next.id]} />
                <div className="hero-actions">
                  <button className="btn light" onClick={() => setSelected(next)}>Ver detalhes</button>
                  <button className="btn ghost" onClick={() => toggleSave(next)} aria-pressed={favorites.includes(next.id)}>
                    <Bookmark size={16} fill={favorites.includes(next.id) ? 'currentColor' : 'none'} aria-hidden="true" />{favorites.includes(next.id) ? 'Salva' : 'Salvar'}
                  </button>
                </div>
              </div>
              <div className="clock" aria-label={'Faltam ' + (daysUntil(next.date) ?? '') + ' dias'}>
                <span className="clock-n"><CountUp value={countdown(next.date)!.n} /></span>
                <span className="clock-unit">{countdown(next.date)!.unit ? countdown(next.date)!.unit + ' para a largada' : 'é dia de prova'}</span>
              </div>
            </> : <div className="hero-text"><h1 id="next-title">Nenhuma prova futura na agenda ainda.</h1><p className="hero-when">A pesquisa diária adiciona novas provas assim que forem anunciadas.</p></div>}
          </div>
          <p className="hero-sum">
            <span><strong><CountUp value={String(upcoming.length)} /></strong> provas pela frente em {new Set(upcoming.map(e => e.city)).size} cidades</span>
            <span><strong><CountUp value={String(openCount)} /></strong> com inscrições abertas</span>
            {nextDeadline && <span>Próximo prazo: <button className="link-inline" onClick={() => setSelected(nextDeadline)}>{nextDeadline.name}</button>, {daysUntil(nextDeadline.registrationClose) === 0 ? 'hoje' : daysUntil(nextDeadline.registrationClose) === 1 ? 'amanhã' : fmt.short(nextDeadline.registrationClose)}</span>}
          </p>
        </section>
      )}

      <main className="page" id="conteudo" key={tab}>
        {data && (tab === 'agenda' || tab === 'salvas') && <>
          {tab === 'salvas' && <div className="page-head"><h1>Minha agenda</h1><p>Monte sua agenda: toque no marcador das provas que você quer correr e exporte tudo para o calendário do celular (Google Agenda, iPhone ou Outlook). Sem cadastro: a lista fica guardada neste aparelho. Para levar para outro celular ou mandar para um amigo, use “Copiar link da minha agenda”.</p></div>}

          {tab === 'agenda' && (
            <div className={filtrosAbertos ? 'filters aberto' : 'filters'} role="search">
              <div className="search-row">
              <label className="search">
                <Search size={18} aria-hidden="true" />
                <input type="search" placeholder="Buscar prova, cidade, local ou mês" value={query} onChange={e => setQuery(e.target.value)} aria-label="Buscar prova, cidade, local ou mês" />
              </label>
              <button className={filtrosVistos ? 'filtros-btn' : 'filtros-btn chamando'} onClick={alternarFiltros} aria-expanded={filtrosAbertos} aria-controls="filtros-painel">
                <SlidersHorizontal size={18} aria-hidden="true" />Filtros{filtrosAtivos > 0 && <span className="filtros-n" aria-label={`${filtrosAtivos} ligados`}>{filtrosAtivos}</span>}
              </button>
              </div>
              {!filtrosVistos && !filtrosAbertos && (
                <button className="filtros-dica" onClick={alternarFiltros}>
                  <span>Toque em <b>Filtros</b> para achar sua prova por <b>cidade</b>, <b>distância</b> e <b>mês</b></span>
                  <ArrowUpRight size={16} aria-hidden="true" />
                </button>
              )}
              <div className="filter-row" id="filtros-painel">
                <div className="seg" role="group" aria-label="Modalidade">
                  {(['Todas', 'Rua', 'Trail'] as const).map(m => <button key={m} aria-pressed={mode === m} onClick={() => { setMode(m); if (m !== 'Todas' && m !== mode) rastrear('Filtro: modalidade', m); }}>{m === 'Todas' ? 'Todas' : m === 'Rua' ? 'Rua' : 'Trail'}</button>)}
                </div>
                <div className="chips" role="group" aria-label="Distância">
                  {distances.map(d => <button key={d} className="chip" aria-pressed={dist === d} onClick={() => { setDist(dist === d ? null : d); if (dist !== d) rastrear('Filtro: distância', `${d} km`); }}>{d} km</button>)}
                </div>
                <select value={city} onChange={e => { setCity(e.target.value); if (e.target.value !== 'Todas') rastrear('Filtro: cidade', e.target.value); }} aria-label="Cidade">
                  <option value="Todas">Todas as cidades</option>
                  {cities.map(c => <option key={c}>{c}</option>)}
                </select>
                <select value={year} onChange={e => { setYear(e.target.value); if (e.target.value !== 'Todos') rastrear('Filtro: ano', e.target.value); }} aria-label="Ano">
                  <option value="Todos">Todos os anos</option>
                  {years.map(y => <option key={y}>{y}</option>)}
                </select>
                <select value={month} onChange={e => { setMonth(e.target.value); if (e.target.value !== 'Todos') rastrear('Filtro: mês', MESES[Number(e.target.value) - 1]); }} aria-label="Mês">
                  <option value="Todos">Todos os meses</option>
                  {months.map(m => <option key={m} value={m}>{MESES[Number(m) - 1]}</option>)}
                </select>
                <button className="chip prize-chip" aria-pressed={onlyPrize} onClick={() => setOnlyPrize(!onlyPrize)} data-umami-event={onlyPrize ? undefined : 'Filtro: premiação em dinheiro'}><Banknote size={16} aria-hidden="true" />Premiação em dinheiro{prizeCount > 0 && <small>{prizeCount}</small>}</button>
                <label className="check"><input type="checkbox" checked={onlyOpen} onChange={e => { setOnlyOpen(e.target.checked); if (e.target.checked) rastrear('Filtro: só inscrições abertas'); }} />Só inscrições abertas</label>
                <label className="check"><input type="checkbox" checked={showPast} onChange={e => { setShowPast(e.target.checked); if (e.target.checked) rastrear('Filtro: mostrar realizadas'); }} />Mostrar realizadas</label>
              </div>
            </div>
          )}

          {escolhendo && tab === 'agenda' && (
            <div className="escolha" id="escolha-prova" role="status">
              <PartyPopper size={24} aria-hidden="true" />
              <div><strong>Qual prova irá correr?</strong><span>Toque na prova aqui embaixo e monte o seu card "Eu vou!", com a sua foto, para postar nos stories do Instagram.</span></div>
              <button className="icon-btn" onClick={() => setEscolhendo(false)} aria-label="Cancelar"><X size={18} /></button>
            </div>
          )}
          <div className="list-bar">
            <p>{filtered.length === 1 ? '1 prova' : filtered.length + ' provas'}{filtersOn && tab === 'agenda' ? ' com esses filtros' : ''}</p>
            <div>
              {filtersOn && tab === 'agenda' && <button className="btn text" onClick={clearFilters}><RotateCcw size={15} aria-hidden="true" />Limpar filtros</button>}
              {filtered.some(e => e.date) && (tab === 'salvas'
                ? <><button className="btn outline" onClick={copyAgendaLink} data-umami-event="Copiar link da agenda"><Link2 size={15} aria-hidden="true" />Copiar link da minha agenda</button>{detect().ios
                  ? <a className="btn solid" href={linkCalendario('/calendario/minha.ics?ids=' + favorites.join(','))} data-umami-event="Exportar minha agenda"><CalendarPlus size={15} aria-hidden="true" />Pôr no Calendário do iPhone</a>
                  : <button className="btn solid" onClick={() => exportCalendar(filtered)} data-umami-event="Exportar minha agenda"><Download size={15} aria-hidden="true" />Exportar minha agenda</button>}</>
                : <AssinarAgenda onExportar={() => exportCalendar(filtered)} filtradas={filtersOn ? filtered.filter(e => e.date).length : null} />)}
            </div>
          </div>

          {groups.map(([key, list]) => (
            <section className="month" key={key} aria-labelledby={'m-' + key}>
              <h2 id={'m-' + key}>{key === 'sem-data' ? 'Data a confirmar' : fmt.monthName(key)}{key !== 'sem-data' && fmt.year(key) !== t.slice(0, 4) && <small> {fmt.year(key)}</small>}</h2>
              <ol className="races">
                {list.map(e => {
                  const dl = deadline(e); const past = status(e) === 'Realizada'; const saved = favorites.includes(e.id);
                  return (
                    <li key={e.id} className={past ? 'race past' : 'race'}>
                      <button className="race-main" onClick={() => abrirProva(e)} data-umami-event={escolhendo ? 'Eu vou: escolheu a prova' : 'Abrir prova'} data-umami-event-prova={e.name}>
                        <span className="race-date">{e.date ? <><b>{fmt.day(e.date)}</b><small>{fmt.weekdayShort(e.date)}</small></> : <b className="tbd">?</b>}</span>
                        <span className="race-body">
                          <span className="race-name">{e.name}</span>
                          <span className="race-place">{e.modality === 'Trail' && <Mountain size={14} aria-label="Trail" />}{placeList(e)}</span>
                          <span className="race-meta">
                            <span className="dists">{e.distances.length ? e.distances.map(d => <span key={d}>{d}k</span>) : <span>distâncias a confirmar</span>}</span>
                            <StatusTag e={e} />
                            <SeloClima c={previsoes[e.id]} />
                            <SeloSubida e={e} />
                            {hasCashPrize(e) && <span className="tag prize" title={e.prize!.summary}><Banknote size={13} aria-hidden="true" />{money(e.prize!.top!)}</span>}
                            {isSingleSource(e) && <span className="tag single" title="Encontrada em uma só fonte. Confirme com a organização.">Fonte única</span>}
                            {dl && <span className={dl.urgent ? 'due urgent' : 'due'}>{dl.text}</span>}
                          </span>
                        </span>
                      </button>
                      <button className={saved ? 'save on' : 'save'} onClick={() => toggleSave(e)} data-umami-event={saved ? 'Remover prova salva' : 'Salvar prova'} data-umami-event-prova={e.name} aria-pressed={saved} aria-label={(saved ? 'Remover das salvas: ' : 'Salvar: ') + e.name}>
                        <Bookmark size={20} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}

          {tab === 'agenda' && <MissingRace />}
          {tab === 'agenda' && cidadesFuturas.length > 0 && (
            <nav className="por-cidade" aria-labelledby="por-cidade-titulo">
              <h2 id="por-cidade-titulo">Corridas por cidade</h2>
              <ul>{cidadesFuturas.map(([c, n]) => <li key={c}><a href={`/corridas/${slugCidade(c)}/`}>{c}<small>{n}</small></a></li>)}</ul>
            </nav>
          )}

          {filtered.length === 0 && (
            <div className="empty">
              {tab === 'salvas'
                ? <><h2>Você ainda não salvou nenhuma prova.</h2><p>Toque no marcador ao lado de uma prova na agenda para guardá-la aqui.</p><button className="btn solid" onClick={() => setTab('agenda')}>Ir para a agenda</button></>
                : <><h2>{mode === 'Trail' ? 'Nenhuma prova de trail confirmada por enquanto.' : 'Nenhuma prova com esses filtros.'}</h2><p>{mode === 'Trail' ? 'Assim que um trail no Maranhão for anunciado, ele entra aqui.' : 'Tente outra distância ou cidade.'}</p><button className="btn solid" onClick={clearFilters}>Limpar filtros</button></>}
            </div>
          )}
        </>}

        {data && tab === 'novidades' && (
          <>
            <div className="page-head row">
              <div><h1>Novidades</h1><p>Provas novas e mudanças de data, local ou inscrições encontradas pela pesquisa diária.</p></div>
              <button className="btn outline" onClick={markAllRead} disabled={!unread}><Check size={16} aria-hidden="true" />Marcar todas como lidas</button>
            </div>
            {data.changes.length ? (
              <ol className="feed">
                {data.changes.map(c => {
                  const e = data.events.find(x => x.id === c.eventId);
                  return (
                    <li key={c.id} className={seen.includes(c.id) ? '' : 'unread'}>
                      <button onClick={() => e && setSelected(e)}>
                        <time dateTime={c.at}>{fmt.full(c.at, true)}</time>
                        <span className="feed-kind">{c.kind}</span>
                        <span className="feed-name">{e?.name ?? 'Prova removida'}</span>
                        {e && <span className="feed-detail">{e.city}, {fmt.long(e.date)}</span>}
                      </button>
                    </li>
                  );
                })}
              </ol>
            ) : <div className="empty"><h2>Nada novo por enquanto.</h2><p>Quando a pesquisa encontrar uma prova nova ou uma mudança, ela aparece aqui.</p></div>}
            <p className="fine">Marcar como lida vale só para este aparelho.</p>
          </>
        )}

        {data && tab === 'sobre' && (
          <div className="about">
            <div className="page-head"><h1>Como funciona</h1><p>O Radar reúne corridas de rua e trail de São Luís e de todo o Maranhão, com a fonte de cada informação.</p></div>
            <div className="about-status">
              <span className={data.monitoring ? 'live-dot big' : 'pulse'} aria-hidden="true" />
              <div>
                <h2>{data.monitoring ? 'Pesquisa diária ativa' : 'Pesquisa diária pausada'}</h2>
                <p>{data.monitoring ? 'Todo dia às 8h (horário de São Luís) as fontes são conferidas e a agenda é atualizada.' : 'A agenda mostra a última pesquisa feita.'} Última conferência em {fmt.full(data.lastChecked, true)}.</p>
              </div>
            </div>
            <div className="about-cols">
              <section>
                <h2>O que entra na agenda</h2>
                <ul className="ticks">
                  <li>Corridas de rua e trail realizadas no Maranhão.</li>
                  <li>Data, distâncias, local e inscrições, quando divulgados. O que não foi encontrado aparece como “não divulgado”.</li>
                  <li>O link da fonte e a data em que a informação foi conferida.</li>
                  <li>Provas vistas só em calendários de terceiros ficam marcadas para confirmação.</li>
                </ul>
              </section>
              <section>
                <h2>Antes de se inscrever</h2>
                <p>Confirme sempre no regulamento e na página oficial da prova. Anúncios feitos só no Instagram ou em grupos fechados podem demorar a aparecer aqui.</p>
                <p>Para montar sua agenda, salve as provas que quer correr e use “Exportar minha agenda” em Minha agenda. O arquivo abre no Google Agenda, no calendário do iPhone ou no Outlook. Tudo fica guardado só neste aparelho, sem cadastro. Para levar a lista para outro aparelho, copie o link da sua agenda e abra lá.</p>
              </section>
            </div>
            <MissingRace />
            <section className="about-install">
              <h2>Use como app</h2>
              {isApp
                ? <p>Você já está usando o Radar instalado. Ele se atualiza sozinho.</p>
                : <><p>Instale o Radar na tela inicial do celular: abre em tela cheia, como um aplicativo, e mostra a agenda mesmo com a internet fraca. Funciona no Android e no iPhone, sem loja de aplicativos.</p>
                  <button className="btn solid" onClick={openInstallPrompt}><Smartphone size={16} aria-hidden="true" />Instalar o app</button></>}
            </section>
            <section>
              <h2>Fontes consultadas</h2>
              <ul className="sources">
                {SOURCES.map(s => <li key={s.name}><a href={s.url} target="_blank" rel="noopener noreferrer"><strong>{s.name}</strong><span>{s.what}</span><ExternalLink size={15} aria-hidden="true" /></a></li>)}
              </ul>
            </section>
          </div>
        )}
      </main>

      {data && (
        <footer className="foot">
          <p>Radar Corridas Maranhão. Conferido em {fmt.full(data.lastChecked)}. Confirme as informações com a organização de cada prova.</p>
        </footer>
      )}

      <div className="fabs">
        {!escolhendo && !semFabTreino && <div className="euvou-wrap">
          <button className="euvou-fechar" onClick={() => setSemFabTreino(true)} aria-label="Fechar o botão do card do treino" data-umami-event="Card do treino: fechou o botão"><X size={12} strokeWidth={3} aria-hidden="true" /></button>
          <a className="euvou-fab treino-fab" href="/?card=treino" title="Monte o card do seu treino (distância, ritmo, tempo e zona) para os stories" data-umami-event="Card do treino: botão flutuante"><Activity size={18} aria-hidden="true" /><span><b>Meu treino</b><small>Card pro seu story</small></span></a>
        </div>}
        {!escolhendo && !semFabCard && <div className="euvou-wrap">
          <button className="euvou-fechar" onClick={() => setSemFabCard(true)} aria-label="Fechar o botão do card" data-umami-event="Eu vou: fechou o botão"><X size={12} strokeWidth={3} aria-hidden="true" /></button>
          <button className="euvou-fab" onClick={comecarEuVou} title="Monte um card com a sua foto e a prova que você vai correr, para postar nos stories" data-umami-event="Eu vou: botão flutuante"><PartyPopper size={18} aria-hidden="true" /><span><b>Eu vou!</b><small>Card pro seu story</small></span></button>
        </div>}
      <a className="insta-fab" data-umami-event="Instagram (botão flutuante)" href="https://www.instagram.com/radarcorridasma/" target="_blank" rel="noopener noreferrer" aria-label="Siga o Radar no Instagram: @radarcorridasma" title="@radarcorridasma no Instagram"><Instagram size={22} aria-hidden="true" /></a>
      </div>
      <InstallPrompt blocked={!!selected} onInstalled={onInstalled} />
      {selected && <Sheet race={selected} clima={previsoes[selected.id]} startCard={abrirCard} saved={favorites.includes(selected.id)} onClose={() => setSelected(null)} onSave={() => toggleSave(selected)} onCalendar={() => exportCalendar([selected])} />}
      {toast && <div className="toast" role="status"><Check size={16} aria-hidden="true" />{toast}</div>}
    </>
  );
}

/** Mesmo formato de endereço das páginas geradas em scripts/paginas-cidades.mjs */
const slugCidade = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function Sheet({ race: e, clima, startCard = false, saved, onClose, onSave, onCalendar }: { race: Race; clima?: Clima; startCard?: boolean; saved: boolean; onClose: () => void; onSave: () => void; onCalendar: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [card, setCard] = useState(startCard);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
      if (ev.key !== 'Tab' || !ref.current) return;
      // mantém o foco dentro da ficha enquanto ela está aberta
      const f = ref.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (ev.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const o = document.body.style.overflow; document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = o; prev?.focus?.(); };
  }, [onClose]);
  const cd = countdown(e.date); const n = daysUntil(e.date); const dl = deadline(e);
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabIndex={-1} ref={ref} onClick={ev => ev.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
        <p className="sheet-kind">{e.modality === 'Rua' ? 'Corrida de rua' : 'Trail'}, edição {e.edition}</p>
        <h2 id="sheet-title">{e.name}</h2>
        <div className="sheet-when">
          <div><strong>{fmt.long(e.date)}</strong><span><MapPin size={14} aria-hidden="true" />{placeLabel(e)}</span></div>
          {cd && n != null && n >= 0 && <div className="sheet-clock"><b>{cd.n}</b>{cd.unit && <small>{cd.unit}</small>}</div>}
        </div>
        <div className="sheet-dists">{e.distances.length ? e.distances.map(d => <span key={d}>{d} km</span>) : <span>Distâncias a confirmar</span>}</div>
        <ClimaLargada e={e} c={clima} />
        <Altimetria e={e} />
        <dl className="facts">
          <div><dt>Inscrições</dt><dd><StatusTag e={e} />{dl && <span className={dl.urgent ? 'due urgent' : 'due'}>{dl.text}</span>}</dd></div>
          {e.prize && e.prize.kind !== 'sem' && <div><dt>Premiação</dt><dd className="prize-dd">{e.prize.kind === 'dinheiro' && <Banknote size={16} aria-hidden="true" />}{e.prize.summary}</dd></div>}
          <div><dt>Abertura</dt><dd>{fmt.full(e.registrationOpen, !!e.registrationOpen?.includes('T'))}</dd></div>
          <div><dt>Prazo final</dt><dd>{fmt.full(e.registrationClose)}</dd></div>
          <div><dt>Anunciada em</dt><dd>{fmt.full(e.publishedAt)}</dd></div>
          <div><dt>Conferida em</dt><dd>{fmt.full(e.verifiedAt ?? null, true)}</dd></div>
        </dl>
        <div className={isSingleSource(e) ? 'note single' : 'note'}>
          <strong>{e.confidence}</strong>
          {isSingleSource(e) && <p className="note-warn">Encontramos esta prova em uma só fonte. Confirme data e local com a organização antes de se programar.</p>}
          <p>{e.notes}</p>
        </div>
        <div className="sheet-actions">
          {e.officialUrl
            ? <a className="btn solid" href={e.officialUrl} target="_blank" rel="noopener noreferrer" data-umami-event="Página oficial (inscrição)" data-umami-event-prova={e.name}>Abrir página oficial<ExternalLink size={15} aria-hidden="true" /></a>
            : <p className="fine">Ainda sem link oficial confirmado.</p>}
          <button className="btn outline" onClick={onSave} aria-pressed={saved} data-umami-event={saved ? 'Remover prova salva' : 'Salvar prova'} data-umami-event-prova={e.name}><Bookmark size={16} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />{saved ? 'Salva' : 'Salvar'}</button>
          {n != null && n >= 0 && !card && <button className="btn outline euvou-btn" onClick={() => setCard(true)} data-umami-event="Card Eu vou: abriu" data-umami-event-prova={e.name}><PartyPopper size={16} aria-hidden="true" />Eu vou! Card pro story</button>}
          {e.date && (n != null && n >= -45
            ? <a className="btn outline" href={linkCalendario(`/calendario/${e.id}.ics`)} data-umami-event="Adicionar ao calendário" data-umami-event-prova={e.name}><CalendarPlus size={16} aria-hidden="true" />Adicionar ao calendário</a>
            : <button className="btn outline" onClick={onCalendar} data-umami-event="Adicionar ao calendário" data-umami-event-prova={e.name}><CalendarPlus size={16} aria-hidden="true" />Adicionar ao calendário</button>)}
        </div>
        {card && <EuVou e={e} onClose={() => setCard(false)} />}
        <a className="source" href={e.sourceUrl} target="_blank" rel="noopener noreferrer">Fonte: {e.sourceName}<ExternalLink size={13} aria-hidden="true" /></a>
        <a className="report" data-umami-event="WhatsApp: corrigir prova" data-umami-event-prova={e.name} href={whatsappLink(`Olá! Sobre a prova "${e.name}" (${e.city}, ${fmt.short(e.date)}) no Radar Corridas Maranhão: `)} target="_blank" rel="noopener noreferrer"><MessageCircle size={15} aria-hidden="true" />Alguma informação errada? Avise pelo WhatsApp</a>
      </div>
    </div>
  );
}
