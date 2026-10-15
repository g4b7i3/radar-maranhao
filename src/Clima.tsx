import { useEffect, useMemo, useState } from 'react';
import { CloudRain, CloudSun, Sun, Thermometer } from 'lucide-react';
import type { Race } from './lib';

// Previsão do tempo no horário da largada (Open-Meteo: grátis, sem chave, previsão de até 16 dias).
// Uma única consulta traz a previsão de todas as cidades com prova nos próximos 15 dias.
// Se a internet ou o serviço falharem, nada de clima aparece e o resto do site segue normal.

export type Clima = { temp: number; sens: number; umid: number; chuva: number | null; hora: string; horaInformada: boolean };
type Coord = { lat: number; lon: number };

/** Horário da largada a partir das notas ("Largada às 6h30"); sem isso, usa 6h, o mais comum no Maranhão. */
export function horaLargada(e: Race): { h: number; m: number; informada: boolean } {
  const r = /largada[^0-9]{0,12}(\d{1,2})\s*h\s*(\d{2})?/i.exec(e.notes || '');
  if (r) { const h = Number(r[1]), m = Number(r[2] || 0); if (h >= 0 && h < 24 && m < 60) return { h, m, informada: true }; }
  return { h: 6, m: 0, informada: false };
}

export function diasAte(date: string | null) {
  if (!date) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  return Math.round((new Date(date + 'T00:00:00').getTime() - hoje.getTime()) / 864e5);
}
const noPrazo = (e: Race) => { const n = diasAte(e.date); return n != null && n >= 0 && n <= 15; };

// Cidades com mais provas já com as coordenadas (evita consultas); as outras são buscadas uma vez e guardadas.
const FIXAS: Record<string, Coord> = {
  'São Luís': { lat: -2.53, lon: -44.3 }, 'Imperatriz': { lat: -5.52, lon: -47.48 }, 'Caxias': { lat: -4.86, lon: -43.36 },
  'Timon': { lat: -5.09, lon: -42.84 }, 'Açailândia': { lat: -4.95, lon: -47.5 }, 'Carolina': { lat: -7.33, lon: -47.47 },
  'Chapadinha': { lat: -3.74, lon: -43.36 }, 'Santa Inês': { lat: -3.67, lon: -45.38 }, 'São José de Ribamar': { lat: -2.56, lon: -44.06 },
  'Paço do Lumiar': { lat: -2.53, lon: -44.11 }, 'Raposa': { lat: -2.42, lon: -44.1 }, 'Bacabal': { lat: -4.23, lon: -44.78 },
  'Balsas': { lat: -7.53, lon: -46.04 }, 'Codó': { lat: -4.46, lon: -43.89 }, 'Barreirinhas': { lat: -2.75, lon: -42.83 },
  'Pinheiro': { lat: -2.52, lon: -45.08 }, 'Presidente Dutra': { lat: -5.29, lon: -44.49 }, 'Porto Franco': { lat: -6.34, lon: -47.4 },
};
const CACHE = 'radar-coords-v1';
function lerCache(): Record<string, Coord> { try { return JSON.parse(localStorage.getItem(CACHE) || '{}'); } catch { return {}; } }
function gravarCache(c: Record<string, Coord>) { try { localStorage.setItem(CACHE, JSON.stringify(c)); } catch { /* sem armazenamento: tudo bem */ } }

async function coordenadas(cidade: string): Promise<Coord | null> {
  if (FIXAS[cidade]) return FIXAS[cidade];
  const cache = lerCache();
  if (cache[cidade]) return cache[cidade];
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cidade)}&count=10&language=pt&country=BR`);
    if (!r.ok) return null;
    const hit = ((await r.json()).results || []).find((x: { admin1?: string }) => /maranh/i.test(x.admin1 || ''));
    if (!hit) return null;
    const c = { lat: hit.latitude, lon: hit.longitude };
    gravarCache({ ...lerCache(), [cidade]: c });
    return c;
  } catch { return null; }
}

type Horaria = { time: string[]; temperature_2m: number[]; apparent_temperature: number[]; relative_humidity_2m: number[]; precipitation_probability?: (number | null)[] };

// Uma busca por visita, compartilhada por toda a página.
let pedido: { chave: string; promessa: Promise<Record<string, Clima>> } | null = null;

async function buscarTodas(events: Race[]): Promise<Record<string, Clima>> {
  const cidades = [...new Set(events.map(e => e.city))];
  const coords = (await Promise.all(cidades.map(async c => [c, await coordenadas(c)] as const))).filter((x): x is readonly [string, Coord] => !!x[1]);
  if (!coords.length) return {};
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.map(c => c[1].lat).join(',')}&longitude=${coords.map(c => c[1].lon).join(',')}` +
    `&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability&timezone=America%2FFortaleza&forecast_days=16`;
  const r = await fetch(url);
  if (!r.ok) return {};
  const j = await r.json();
  const lista: { hourly: Horaria }[] = Array.isArray(j) ? j : [j];
  const porCidade = new Map(coords.map(([c], i) => [c, lista[i]?.hourly]));
  const out: Record<string, Clima> = {};
  for (const e of events) {
    const H = porCidade.get(e.city);
    if (!H || !e.date) continue;
    const { h, m, informada } = horaLargada(e);
    const alvo = `${e.date}T${String(Math.min(23, h + (m >= 30 ? 1 : 0))).padStart(2, '0')}:00`;
    const i = H.time.indexOf(alvo);
    if (i < 0 || H.temperature_2m[i] == null) continue;
    out[e.id] = {
      temp: Math.round(H.temperature_2m[i]), sens: Math.round(H.apparent_temperature[i]), umid: Math.round(H.relative_humidity_2m[i]),
      chuva: H.precipitation_probability?.[i] ?? null, hora: `${h}h${m ? String(m).padStart(2, '0') : ''}`, horaInformada: informada,
    };
  }
  return out;
}

/** Previsões de todas as provas dos próximos 15 dias, numa consulta só. */
export function usePrevisoes(events: Race[]) {
  const alvo = useMemo(() => events.filter(noPrazo), [events]);
  const chave = alvo.map(e => e.id + e.date + e.city).join('|');
  const [mapa, setMapa] = useState<Record<string, Clima>>({});
  useEffect(() => {
    if (!alvo.length) return;
    let vivo = true;
    if (!pedido || pedido.chave !== chave) pedido = { chave, promessa: buscarTodas(alvo).catch(() => ({})) };
    pedido.promessa.then(m => { if (vivo) setMapa(m); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  return mapa;
}

export const quente = (c: Clima) => c.sens >= 29;

function dica(c: Clima) {
  if (c.sens >= 33) return 'Calor forte: beba água desde a véspera, use boné e segure o ritmo no começo.';
  if (c.sens >= 29) return 'Vai estar quente: hidrate-se bem antes e aproveite todos os postos de água.';
  if (c.chuva != null && c.chuva >= 50) return 'Chance de chuva: use meia que não encharque e um saco plástico para o pré-largada.';
  return 'Temperatura boa para correr. Mesmo assim, não pule os postos de água.';
}

function Icone({ c, size }: { c: Clima; size: number }) {
  if (c.chuva != null && c.chuva >= 50) return <CloudRain size={size} aria-hidden="true" />;
  return quente(c) ? <Sun size={size} aria-hidden="true" /> : <CloudSun size={size} aria-hidden="true" />;
}

/** Selo pequeno na lista da agenda: ☀ 31° */
export function SeloClima({ c }: { c: Clima | undefined }) {
  if (!c) return null;
  return (
    <span className={quente(c) ? 'tag clima-tag quente' : 'tag clima-tag'} title={`Previsão na largada: ${c.temp}°, sensação de ${c.sens}°`}>
      <Icone c={c} size={13} />{c.sens}°
    </span>
  );
}

/** Linha no destaque azul do topo. */
export function ClimaHero({ c }: { c: Clima | undefined }) {
  if (!c) return null;
  return (
    <p className="hero-clima">
      <Icone c={c} size={16} />
      <span><b>{c.temp}° na largada</b> · sensação {c.sens}°{c.chuva != null && c.chuva >= 30 ? ` · ${c.chuva}% de chuva` : ''}</span>
    </p>
  );
}

/** Quadro completo na ficha da prova. */
export default function ClimaLargada({ e, c }: { e: Race; c?: Clima }) {
  const mapa = usePrevisoes(c || !noPrazo(e) ? [] : [e]);
  const clima = c ?? mapa[e.id];
  if (!noPrazo(e) || !clima) return null;
  return (
    <section className={quente(clima) ? 'clima quente' : 'clima'} aria-label="Previsão do tempo na largada">
      <div className="clima-top">
        <Thermometer size={18} aria-hidden="true" />
        <span>Previsão na largada{clima.horaInformada ? ` (${clima.hora})` : ' (por volta das 6h)'}</span>
      </div>
      <div className="clima-nums">
        <div><b>{clima.temp}°</b><small>temperatura</small></div>
        <div><b>{clima.sens}°</b><small>sensação</small></div>
        <div><b>{clima.umid}%</b><small>umidade</small></div>
        {clima.chuva != null && <div><b>{clima.chuva}%</b><small>chance de chuva</small></div>}
      </div>
      <p>{dica(clima)}</p>
    </section>
  );
}
