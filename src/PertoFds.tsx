import { useState } from 'react';
import { CalendarDays, ChevronRight, LocateFixed, MapPin, X } from 'lucide-react';
import GEO from './cidades-ma-geo.json';
import { fmt, norm, type Race } from './lib';

// Posição (latitude, longitude) das 217 cidades do MA — dados públicos do IBGE.
const POS = new Map(Object.entries(GEO as unknown as Record<string, [number, number]>).map(([n, p]) => [norm(n), { nome: n, p }]));
export const CIDADES_MA = Object.keys(GEO).sort((a, b) => a.localeCompare(b, 'pt-BR'));

/** Distância em km, em linha reta. */
function km(a: [number, number], b: [number, number]) {
  const r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLon = (b[1] - a[1]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}
export type Perto = { cidade: string; p: [number, number]; raio: number };
/** Distância da cidade da prova até a referência (null se a cidade não foi achada). */
export function distancia(perto: Perto, cidade: string) {
  const c = POS.get(norm(cidade));
  return c ? km(perto.p, c.p) : null;
}
export const kmTexto = (d: number) => (d < 5 ? 'na cidade' : `a ${Math.round(d)} km`);
function cidadeMaisPerto(p: [number, number]) {
  let melhor = { nome: 'São Luís', p: [-2.53, -44.3] as [number, number] }, dmin = Infinity;
  for (const c of POS.values()) { const d = km(p, c.p); if (d < dmin) { dmin = d; melhor = c; } }
  return melhor;
}
export const RAIOS = [30, 60, 100, 200];

/** Bloco "Perto de você": localização do celular ou cidade escolhida. Só a cidade fica guardada no aparelho. */
export function PertoDeVoce({ perto, mudar, total }: { perto: Perto | null; mudar: (p: Perto | null) => void; total: number }) {
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState('');
  const [escolher, setEscolher] = useState(false);
  function usarLocalizacao() {
    if (!navigator.geolocation) { setErro('Este navegador não informa a localização. Escolha a cidade.'); setEscolher(true); return; }
    setBuscando(true); setErro('');
    navigator.geolocation.getCurrentPosition(
      pos => { setBuscando(false); const c = cidadeMaisPerto([pos.coords.latitude, pos.coords.longitude]); mudar({ cidade: c.nome, p: c.p, raio: perto?.raio ?? 100 }); },
      () => { setBuscando(false); setErro('Não deu para pegar a localização. Escolha a cidade.'); setEscolher(true); },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 },
    );
  }
  function escolherCidade(nome: string) {
    const c = POS.get(norm(nome)); if (!c) return;
    setEscolher(false); setErro(''); mudar({ cidade: c.nome, p: c.p, raio: perto?.raio ?? 100 });
  }
  const seletor = (
    <select className="perto-sel" defaultValue="" autoFocus={escolher} onChange={e => escolherCidade(e.target.value)} aria-label="Escolher cidade">
      <option value="" disabled>Escolher cidade…</option>
      {CIDADES_MA.map(c => <option key={c}>{c}</option>)}
    </select>
  );
  if (!perto) return (
    <div className="perto">
      <div className="perto-txt"><MapPin size={20} aria-hidden="true" /><div><b>Perto de você</b><small>Veja só as provas mais perto e a distância de cada uma.</small></div></div>
      <div className="perto-acoes">
        <button className="btn solid" onClick={usarLocalizacao} disabled={buscando} data-umami-event="Perto: usar localização"><LocateFixed size={16} aria-hidden="true" />{buscando ? 'Localizando…' : 'Usar minha localização'}</button>
        {escolher ? seletor : <button className="btn outline" onClick={() => setEscolher(true)}>Escolher cidade</button>}
      </div>
      {erro && <p className="perto-erro">{erro}</p>}
      <p className="perto-priv">A localização serve só para achar a cidade mais próxima. Não é guardada; só o nome da cidade fica neste aparelho.</p>
    </div>
  );
  return (
    <div className="perto on">
      <div className="perto-txt"><MapPin size={20} aria-hidden="true" /><div><b>{total === 1 ? '1 prova' : `${total} provas`} perto de {perto.cidade}</b><small>Distância em linha reta até a cidade.</small></div>
        <button className="icon-btn" onClick={() => mudar(null)} aria-label="Ver todas as cidades de novo"><X size={18} /></button></div>
      <div className="perto-acoes">
        <div className="chips" role="group" aria-label="Até quantos km">
          {RAIOS.map(r => <button key={r} className="chip" aria-pressed={perto.raio === r} onClick={() => mudar({ ...perto, raio: r })}>até {r} km</button>)}
        </div>
        {escolher ? seletor : <button className="btn text" onClick={() => setEscolher(true)}>Trocar cidade</button>}
      </div>
    </div>
  );
}

/** Sábado e domingo deste fim de semana (no domingo, ainda é o fim de semana de hoje). */
export function fimDeSemana(hoje: string): [string, string] {
  const d = new Date(hoje + 'T12:00:00Z'), dow = d.getUTCDay();
  const add = (n: number) => new Date(d.getTime() + n * 86400000).toISOString().slice(0, 10);
  const sab = dow === 0 ? add(-1) : add(6 - dow);
  return [sab, add(dow === 0 ? 0 : 7 - dow)];
}
export const ehFimDeSemana = (e: Race, fds: [string, string]) => !!e.date && e.date.slice(0, 10) >= fds[0] && e.date.slice(0, 10) <= fds[1];

/** Faixa "Neste fim de semana" no início da agenda. */
export function FimDeSemana({ provas, fds, onAbrir, onVerTodas }: { provas: Race[]; fds: [string, string]; onAbrir: (e: Race) => void; onVerTodas: () => void }) {
  if (!provas.length) return null;
  const titulo = `${fmt.day(fds[0])} e ${fmt.day(fds[1])} de ${fmt.short(fds[1]).split(' ').pop()}`;
  return (
    <section className="fds" aria-labelledby="fds-titulo">
      <div className="fds-topo">
        <h2 id="fds-titulo"><CalendarDays size={20} aria-hidden="true" />Neste fim de semana<small>{titulo}</small></h2>
        {provas.length > 2 && <button className="btn text" onClick={onVerTodas}>Ver as {provas.length}<ChevronRight size={16} aria-hidden="true" /></button>}
      </div>
      <ul className="fds-lista">
        {provas.map(e => (
          <li key={e.id}><button onClick={() => onAbrir(e)} data-umami-event="Fim de semana: abriu prova" data-umami-event-prova={e.name}>
            <span className="fds-dia">{fmt.weekdayShort(e.date!)} {fmt.day(e.date!)}</span>
            <b>{e.name}</b>
            <span className="fds-onde">{e.city}{e.distances.length ? ' · ' + e.distances.map(d => String(d).replace('.', ',')).join(', ') + ' km' : ''}</span>
          </button></li>
        ))}
      </ul>
    </section>
  );
}
