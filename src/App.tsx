import { useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, CalendarPlus, Check, ExternalLink, MapPin, Mountain, Search, X, Download, RotateCcw, Link2 } from 'lucide-react';
import { type Race, type State, countdown, deadline, fmt, icsFor, isOpen, load, norm, status, store, today, daysUntil, placeLabel, placeList } from './lib';

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

function StatusTag({ e }: { e: Race }) {
  const s = status(e);
  const tone = s === 'Abertas' || s === 'Abertura anunciada' ? 'open' : s === 'Cancelada' ? 'bad' : s === 'Realizada' || s === 'Encerradas' ? 'done' : s === 'Abrem em breve' ? 'soon' : 'check';
  const label = s === 'Consultar' ? 'Confirmar inscrições' : s === 'Abertura anunciada' ? 'Abertas' : s;
  return <span className={'tag ' + tone}>{label}</span>;
}

export default function App() {
  const [data, setData] = useState<State | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('agenda');
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'Todas' | 'Rua' | 'Trail'>('Todas');
  const [dist, setDist] = useState<number | null>(null);
  const [city, setCity] = useState('Todas');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => load('radar-favorites', []));
  const [seen, setSeen] = useState<string[]>(() => load('radar-seen', []));
  const [selected, setSelected] = useState<Race | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    fetch('/data/radar.json', { cache: 'no-store' })
      .then(r => { if (!r.ok) throw Error(); return r.json(); })
      .then(setData)
      .catch(() => setError('A agenda não carregou. Confira sua conexão e recarregue a página.'));
  }, []);
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
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 4000); return () => clearTimeout(t); }, [toast]);

  const events = data?.events ?? [];
  const t = today();
  const upcoming = useMemo(() => events.filter(e => !e.date || e.date >= t).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')), [events, t]);
  const next = upcoming.find(e => e.date && status(e) !== 'Cancelada');
  const unread = (data?.changes ?? []).filter(c => !seen.includes(c.id)).length;
  const cities = useMemo(() => [...new Set(events.map(e => e.city))].sort((a, b) => a === 'São Luís' ? -1 : b === 'São Luís' ? 1 : a.localeCompare(b)), [events]);
  const distances = useMemo(() => [...new Set(events.flatMap(e => e.distances))].sort((a, b) => a - b), [events]);

  const filtered = useMemo(() => events
    .filter(e => tab !== 'salvas' || favorites.includes(e.id))
    .filter(e => showPast || tab === 'salvas' || !e.date || e.date >= t)
    .filter(e => !query || norm(`${e.name} ${e.city} ${e.location}`).includes(norm(query)))
    .filter(e => mode === 'Todas' || e.modality === mode)
    .filter(e => dist == null || e.distances.includes(dist))
    .filter(e => city === 'Todas' || e.city === city)
    .filter(e => !onlyOpen || isOpen(e))
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')), [events, tab, favorites, showPast, query, mode, dist, city, onlyOpen, t]);

  const groups = useMemo(() => {
    const m = new Map<string, Race[]>();
    for (const e of filtered) { const k = e.date ? fmt.monthKey(e.date) : 'sem-data'; m.set(k, [...(m.get(k) ?? []), e]); }
    return [...m.entries()];
  }, [filtered]);

  const openCount = upcoming.filter(isOpen).length;
  const nextDeadline = upcoming.filter(e => isOpen(e) && e.registrationClose).sort((a, b) => a.registrationClose!.localeCompare(b.registrationClose!))[0];
  const filtersOn = query || mode !== 'Todas' || dist != null || city !== 'Todas' || onlyOpen || showPast;

  function toggleSave(e: Race) {
    const v = favorites.includes(e.id) ? favorites.filter(id => id !== e.id) : [...favorites, e.id];
    setFavorites(v); store('radar-favorites', v);
    setToast(v.includes(e.id) ? 'Prova salva na sua agenda.' : 'Prova removida da sua agenda.');
  }
  function markAllRead() { const v = (data?.changes ?? []).map(c => c.id); setSeen(v); store('radar-seen', v); }
  function clearFilters() { setQuery(''); setMode('Todas'); setDist(null); setCity('Todas'); setOnlyOpen(false); setShowPast(false); }
  async function copyAgendaLink() {
    const url = `${window.location.origin}/?agenda=${favorites.join(',')}`;
    try { await navigator.clipboard.writeText(url); setToast('Link copiado. Abra em outro aparelho ou envie para alguém.'); }
    catch { window.prompt('Copie o link da sua agenda:', url); }
  }
  function exportCalendar(list: Race[]) { icsFor(list); setToast(list.length === 1 ? 'Arquivo de calendário baixado.' : `${list.filter(e => e.date).length} provas exportadas para o calendário.`); }

  return (
    <>
      <header className="top">
        <div className="top-inner">
          <a className="brand" href="/" aria-label="Radar Corridas Maranhão, página inicial"><Logo /><span>Radar Corridas Maranhão</span></a>
          <nav className="tabs" aria-label="Seções">
            {TABS.map(x => (
              <button key={x.id} className={tab === x.id ? 'tab on' : 'tab'} aria-current={tab === x.id ? 'page' : undefined} onClick={ev => { setTab(x.id); window.scrollTo({ top: 0 }); ev.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }}>
                {x.label}
                {x.id === 'novidades' && unread > 0 && <span className="count" aria-label={unread + ' não lidas'}>{unread}</span>}
                {x.id === 'salvas' && favorites.length > 0 && <span className="count quiet">{favorites.length}</span>}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {error && <p className="alert" role="alert">{error}</p>}
      {!data && !error && <p className="loading">Carregando a agenda…</p>}

      {data && tab === 'agenda' && (
        <section className="hero" aria-labelledby="next-title">
          <div className="hero-inner">
            {next ? <>
              <div className="hero-text">
                <p className="hero-kicker">Próxima largada</p>
                <h1 id="next-title"><button onClick={() => setSelected(next)}>{next.name}</button></h1>
                <p className="hero-when">{fmt.long(next.date)}</p>
                <p className="hero-where"><MapPin size={16} aria-hidden="true" />{placeLabel(next)}</p>
                <div className="hero-actions">
                  <button className="btn light" onClick={() => setSelected(next)}>Ver detalhes</button>
                  <button className="btn ghost" onClick={() => toggleSave(next)} aria-pressed={favorites.includes(next.id)}>
                    <Bookmark size={16} fill={favorites.includes(next.id) ? 'currentColor' : 'none'} aria-hidden="true" />{favorites.includes(next.id) ? 'Salva' : 'Salvar'}
                  </button>
                </div>
              </div>
              <div className="clock" aria-label={'Faltam ' + (daysUntil(next.date) ?? '') + ' dias'}>
                <span className="clock-n">{countdown(next.date)!.n}</span>
                <span className="clock-unit">{countdown(next.date)!.unit ? countdown(next.date)!.unit + ' para a largada' : 'é dia de prova'}</span>
              </div>
            </> : <div className="hero-text"><h1 id="next-title">Nenhuma prova futura na agenda ainda.</h1><p className="hero-when">A pesquisa diária adiciona novas provas assim que forem anunciadas.</p></div>}
          </div>
          <p className="hero-sum">
            <span><strong>{upcoming.length}</strong> provas pela frente em {new Set(upcoming.map(e => e.city)).size} cidades</span>
            <span><strong>{openCount}</strong> com inscrições abertas</span>
            {nextDeadline && <span>Próximo prazo: <button className="link-inline" onClick={() => setSelected(nextDeadline)}>{nextDeadline.name}</button>, {daysUntil(nextDeadline.registrationClose) === 0 ? 'hoje' : daysUntil(nextDeadline.registrationClose) === 1 ? 'amanhã' : fmt.short(nextDeadline.registrationClose)}</span>}
          </p>
        </section>
      )}

      <main className="page" id="conteudo">
        {data && (tab === 'agenda' || tab === 'salvas') && <>
          {tab === 'salvas' && <div className="page-head"><h1>Minha agenda</h1><p>Monte sua agenda: toque no marcador das provas que você quer correr e exporte tudo para o calendário do celular (Google Agenda, iPhone ou Outlook). Sem cadastro: a lista fica guardada neste aparelho. Para levar para outro celular ou mandar para um amigo, use “Copiar link da minha agenda”.</p></div>}

          {tab === 'agenda' && (
            <div className="filters" role="search">
              <label className="search">
                <Search size={18} aria-hidden="true" />
                <input type="search" placeholder="Buscar prova, cidade ou local" value={query} onChange={e => setQuery(e.target.value)} aria-label="Buscar prova, cidade ou local" />
              </label>
              <div className="filter-row">
                <div className="seg" role="group" aria-label="Modalidade">
                  {(['Todas', 'Rua', 'Trail'] as const).map(m => <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>{m === 'Todas' ? 'Todas' : m === 'Rua' ? 'Rua' : 'Trail'}</button>)}
                </div>
                <div className="chips" role="group" aria-label="Distância">
                  {distances.map(d => <button key={d} className="chip" aria-pressed={dist === d} onClick={() => setDist(dist === d ? null : d)}>{d} km</button>)}
                </div>
                <select value={city} onChange={e => setCity(e.target.value)} aria-label="Cidade">
                  <option value="Todas">Todas as cidades</option>
                  {cities.map(c => <option key={c}>{c}</option>)}
                </select>
                <label className="check"><input type="checkbox" checked={onlyOpen} onChange={e => setOnlyOpen(e.target.checked)} />Só inscrições abertas</label>
                <label className="check"><input type="checkbox" checked={showPast} onChange={e => setShowPast(e.target.checked)} />Mostrar realizadas</label>
              </div>
            </div>
          )}

          <div className="list-bar">
            <p>{filtered.length === 1 ? '1 prova' : filtered.length + ' provas'}{filtersOn && tab === 'agenda' ? ' com esses filtros' : ''}</p>
            <div>
              {filtersOn && tab === 'agenda' && <button className="btn text" onClick={clearFilters}><RotateCcw size={15} aria-hidden="true" />Limpar filtros</button>}
              {filtered.some(e => e.date) && (tab === 'salvas'
                ? <><button className="btn outline" onClick={copyAgendaLink}><Link2 size={15} aria-hidden="true" />Copiar link da minha agenda</button><button className="btn solid" onClick={() => exportCalendar(filtered)}><Download size={15} aria-hidden="true" />Exportar minha agenda</button></>
                : <button className="btn text" onClick={() => exportCalendar(filtered)}><Download size={15} aria-hidden="true" />Exportar para o calendário</button>)}
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
                      <button className="race-main" onClick={() => setSelected(e)}>
                        <span className="race-date">{e.date ? <><b>{fmt.day(e.date)}</b><small>{fmt.weekdayShort(e.date)}</small></> : <b className="tbd">?</b>}</span>
                        <span className="race-body">
                          <span className="race-name">{e.name}</span>
                          <span className="race-place">{e.modality === 'Trail' && <Mountain size={14} aria-label="Trail" />}{placeList(e)}</span>
                          <span className="race-meta">
                            <span className="dists">{e.distances.length ? e.distances.map(d => <span key={d}>{d}k</span>) : <span>distâncias a confirmar</span>}</span>
                            <StatusTag e={e} />
                            {dl && <span className={dl.urgent ? 'due urgent' : 'due'}>{dl.text}</span>}
                          </span>
                        </span>
                      </button>
                      <button className={saved ? 'save on' : 'save'} onClick={() => toggleSave(e)} aria-pressed={saved} aria-label={(saved ? 'Remover das salvas: ' : 'Salvar: ') + e.name}>
                        <Bookmark size={20} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}

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
              <span className={data.monitoring ? 'pulse on' : 'pulse'} aria-hidden="true" />
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
          <p className="credit">Desenvolvido por <a href="https://www.instagram.com/gabriel_vinicius_jj/" target="_blank" rel="noopener noreferrer">@gabriel_vinicius_jj</a></p>
        </footer>
      )}

      {selected && <Sheet race={selected} saved={favorites.includes(selected.id)} onClose={() => setSelected(null)} onSave={() => toggleSave(selected)} onCalendar={() => exportCalendar([selected])} />}
      {toast && <div className="toast" role="status"><Check size={16} aria-hidden="true" />{toast}</div>}
    </>
  );
}

function Sheet({ race: e, saved, onClose, onSave, onCalendar }: { race: Race; saved: boolean; onClose: () => void; onSave: () => void; onCalendar: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
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
        <dl className="facts">
          <div><dt>Inscrições</dt><dd><StatusTag e={e} />{dl && <span className={dl.urgent ? 'due urgent' : 'due'}>{dl.text}</span>}</dd></div>
          <div><dt>Abertura</dt><dd>{fmt.full(e.registrationOpen, !!e.registrationOpen?.includes('T'))}</dd></div>
          <div><dt>Prazo final</dt><dd>{fmt.full(e.registrationClose)}</dd></div>
          <div><dt>Anunciada em</dt><dd>{fmt.full(e.publishedAt)}</dd></div>
          <div><dt>Conferida em</dt><dd>{fmt.full(e.verifiedAt ?? null, true)}</dd></div>
        </dl>
        <div className="note"><strong>{e.confidence}</strong><p>{e.notes}</p></div>
        <div className="sheet-actions">
          {e.officialUrl
            ? <a className="btn solid" href={e.officialUrl} target="_blank" rel="noopener noreferrer">Abrir página oficial<ExternalLink size={15} aria-hidden="true" /></a>
            : <p className="fine">Ainda sem link oficial confirmado.</p>}
          <button className="btn outline" onClick={onSave} aria-pressed={saved}><Bookmark size={16} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />{saved ? 'Salva' : 'Salvar'}</button>
          {e.date && <button className="btn outline" onClick={onCalendar}><CalendarPlus size={16} aria-hidden="true" />Adicionar ao calendário</button>}
        </div>
        <a className="source" href={e.sourceUrl} target="_blank" rel="noopener noreferrer">Fonte: {e.sourceName}<ExternalLink size={13} aria-hidden="true" /></a>
      </div>
    </div>
  );
}
