// Agenda: a agenda de provas, grátis pra quem entra na rede (Radar e Radar Pro são um app só). Toque abre a ficha da prova; "Inscrição" vai direto ao site oficial.
import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ExternalLink, MapPin, Search } from 'lucide-react';
import { status, norm, load, store, icsFor, type Race } from '../lib';
import { Sheet } from '../App';
import { useClimas } from '../Clima';
import { useVoltar, telaInicial } from './voltar';

type Filtro = 'proximas' | 'abertas' | 'mes' | 'trail' | 'salvas' | 'passadas';
/** Prova (ou filtro, com ":") pedida num link antigo do Radar, guardada até a pessoa entrar. */
export const provaPedida = (): string | null => { try { return localStorage.getItem('radar-abrir-prova'); } catch { return null; } };
const dataLonga = (d: string) => new Date(d.slice(0, 10) + 'T12:00:00-03:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).replace('.', '');
const tom = (s: string) => (s === 'Abertas' || s === 'Abertura anunciada' ? 'open' : s === 'Cancelada' ? 'bad' : s === 'Realizada' || s === 'Encerradas' ? 'done' : s === 'Abrem em breve' ? 'soon' : 'check');
const rotulo = (s: string) => (s === 'Consultar' ? 'Confirmar inscrições' : s === 'Abertura anunciada' ? 'Abertas' : s);

export function TelaProvas() {
  const [lista, setLista] = useState<Race[] | null>(null);
  const [erro, setErro] = useState(false);
  const pedidaLink = useRef(provaPedida());
  useEffect(() => { try { localStorage.removeItem('radar-abrir-prova'); } catch { /* */ } }, []);
  const [filtro, setFiltro] = useState<Filtro>(() => (pedidaLink.current?.startsWith(':') ? pedidaLink.current.slice(1) as Filtro : 'proximas'));
  const [busca, setBusca] = useState('');
  const [aberta, setAberta] = useState<Race | null>(null);
  useVoltar(!!aberta, () => setAberta(null), aberta?.id);
  const pedida = useRef(telaInicial('provas') ?? (pedidaLink.current && !pedidaLink.current.startsWith(':') ? pedidaLink.current : null));
  const [salvas, setSalvas] = useState<string[]>(() => load('radar-favorites', []));
  const salvar = (e: Race) => { const v = salvas.includes(e.id) ? salvas.filter(id => id !== e.id) : [...salvas, e.id]; setSalvas(v); store('radar-favorites', v); };
  useEffect(() => { fetch('/data/radar.json', { cache: 'no-store' }).then(r => r.json()).then(d => { const l = (d.events ?? []) as Race[]; setLista(l); if (pedida.current) { const e = l.find(x => x.id === pedida.current); pedida.current = null; if (e) setAberta(e); } }).catch(() => setErro(true)); }, []);
  const hoje = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  const mes = hoje.slice(0, 7);
  const vis = useMemo(() => {
    const q = norm(busca.trim());
    const base = (lista ?? []).filter(e => e.date).filter(e => {
      const st = status(e), passou = st === 'Realizada' || (e.date ?? '') < hoje;
      if (filtro === 'salvas') return salvas.includes(e.id);
      if (filtro === 'passadas') return passou;
      if (passou) return false;
      if (filtro === 'abertas') return st === 'Abertas' || st === 'Abertura anunciada';
      if (filtro === 'mes') return (e.date ?? '').startsWith(mes);
      if (filtro === 'trail') return e.modality === 'Trail';
      return true;
    }).filter(e => !q || norm(`${e.name} ${e.city} ${e.location}`).includes(q));
    return base.sort((a, b) => (filtro === 'passadas' ? b.date!.localeCompare(a.date!) : a.date!.localeCompare(b.date!)));
  }, [lista, filtro, busca, hoje, mes, salvas]);
  const previsoes = useClimas(useMemo(() => (lista ?? []).filter(e => e.date && e.date >= hoje), [lista, hoje]));
  const grupos = useMemo(() => { const g = new Map<string, Race[]>(); for (const e of vis) { const k = e.date!.slice(0, 7); if (!g.has(k)) g.set(k, []); g.get(k)!.push(e); } return [...g.entries()]; }, [vis]);
  const nomeMes = (k: string) => new Date(k + '-15T12:00:00-03:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return (
    <div className="pro-cont">
      <label className="pro-busca"><Search size={18} aria-hidden="true" /><input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar prova ou cidade" aria-label="Buscar prova" /></label>
      <div className="chips" role="group" aria-label="Filtro">
        {([['proximas', 'Próximas'], ['abertas', 'Inscrições abertas'], ['mes', 'Este mês'], ['trail', 'Trail'], ['salvas', `Minha agenda${salvas.length ? ' · ' + salvas.length : ''}`], ['passadas', 'Já aconteceram']] as [Filtro, string][]).map(([k, n]) => <button key={k} className="chip" aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{n}</button>)}
      </div>
      {erro && <p className="ct-erro" role="alert">Não consegui carregar a agenda. Confira a internet e tente de novo.</p>}
      {lista === null && !erro && <p className="fine">Carregando a agenda…</p>}
      {lista && vis.length === 0 && <p className="fine">{filtro === 'salvas' && !busca ? 'Sua agenda está vazia. Abra uma prova e toque em Salvar pra ela aparecer aqui.' : `Nenhuma prova aqui${busca ? ' com essa busca' : ''}.`}</p>}
      {grupos.map(([k, provas]) => (
        <section key={k} className="pro-provas-mes">
          <p className="pro-k cinza"><CalendarDays size={14} aria-hidden="true" /> {nomeMes(k)} · {provas.length}</p>
          {provas.map(e => { const st = status(e); return (
            <article key={e.id} className="pro-card pro-prova-card">
              <button className="pro-prova-corpo" onClick={() => setAberta(e)}>
                <div className="pro-prova-data"><b>{e.date!.slice(8, 10)}</b><small>{dataLonga(e.date!).split(' ')[0]}</small></div>
                <div className="pro-prova-info">
                  <b>{e.name}</b>
                  <small><MapPin size={12} aria-hidden="true" /> {e.city}{e.modality === 'Trail' ? ' · Trail' : ''}{e.start ? ` · ${e.start}` : ''}</small>
                  <small>{e.distances.map(d => `${d} km`).join(' · ')}{e.price?.text ? ` · ${e.price.text}` : ''}</small>
                  <span className={`tag ${tom(st)}`}>{rotulo(st)}</span>
                </div>
              </button>
              {e.officialUrl && (st === 'Abertas' || st === 'Abertura anunciada' || st === 'Consultar') && <a className="btn outline pro-btn-p" href={e.officialUrl} target="_blank" rel="noopener"><ExternalLink size={14} aria-hidden="true" />Inscrição</a>}
            </article>
          ); })}
        </section>
      ))}
      <p className="fine pro-centro">Agenda grátis do Radar: {lista?.length ?? '…'} provas do Maranhão, conferidas todo dia. Toque numa prova pra ver kit, largada, percurso e clima.</p>
      {aberta && <Sheet race={aberta} clima={previsoes[aberta.id]} saved={salvas.includes(aberta.id)} onClose={() => setAberta(null)} onSave={() => salvar(aberta)} onCalendar={() => icsFor([aberta])} seta />}
    </div>
  );
}
