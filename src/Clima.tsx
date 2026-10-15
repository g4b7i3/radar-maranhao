import { useEffect, useState } from 'react';
import { Thermometer } from 'lucide-react';
import type { Race } from './lib';

// Previsão do tempo no horário da largada (Open-Meteo: grátis, sem chave, previsão de até 16 dias).
// Se a internet ou o serviço falharem, o bloco simplesmente não aparece.

type Coord = { lat: number; lon: number };
type Clima = { temp: number; sens: number; umid: number; chuva: number | null; hora: string; horaInformada: boolean };

/** Horário da largada a partir das notas ("Largada às 6h30"); sem isso, usa 6h, o mais comum no Maranhão. */
export function horaLargada(e: Race): { h: number; m: number; informada: boolean } {
  const r = /largada[^0-9]{0,12}(\d{1,2})\s*h\s*(\d{2})?/i.exec(e.notes || '');
  if (r) { const h = Number(r[1]), m = Number(r[2] || 0); if (h >= 0 && h < 24 && m < 60) return { h, m, informada: true }; }
  return { h: 6, m: 0, informada: false };
}

const CACHE = 'radar-coords-v1';
function lerCache(): Record<string, Coord> { try { return JSON.parse(localStorage.getItem(CACHE) || '{}'); } catch { return {}; } }
function gravarCache(c: Record<string, Coord>) { try { localStorage.setItem(CACHE, JSON.stringify(c)); } catch { /* sem armazenamento: tudo bem */ } }

async function coordenadas(cidade: string, signal: AbortSignal): Promise<Coord | null> {
  const cache = lerCache();
  if (cache[cidade]) return cache[cidade];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cidade)}&count=10&language=pt&country=BR`;
  const r = await fetch(url, { signal });
  if (!r.ok) return null;
  const j = await r.json();
  const hit = (j.results || []).find((x: { admin1?: string }) => /maranh/i.test(x.admin1 || ''));
  if (!hit) return null;
  const c = { lat: hit.latitude, lon: hit.longitude };
  gravarCache({ ...cache, [cidade]: c });
  return c;
}

export function diasAte(date: string | null) {
  if (!date) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  return Math.round((new Date(date + 'T00:00:00').getTime() - hoje.getTime()) / 864e5);
}

function dica(c: Clima) {
  if (c.sens >= 33) return 'Calor forte: beba água desde a véspera, use boné e segure o ritmo no começo.';
  if (c.sens >= 29) return 'Vai estar quente: hidrate-se bem antes e aproveite todos os postos de água.';
  if (c.chuva != null && c.chuva >= 50) return 'Chance de chuva: use meia que não encharque e um saco plástico para o pré-largada.';
  return 'Temperatura boa para correr. Mesmo assim, não pule os postos de água.';
}

export default function ClimaLargada({ e }: { e: Race }) {
  const [c, setC] = useState<Clima | null>(null);
  const n = diasAte(e.date);
  const dentro = n != null && n >= 0 && n <= 15;

  useEffect(() => {
    if (!dentro || !e.date) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        const coord = await coordenadas(e.city, ctrl.signal);
        if (!coord) return;
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${coord.lat}&longitude=${coord.lon}` +
          `&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability` +
          `&timezone=America%2FFortaleza&start_date=${e.date}&end_date=${e.date}`;
        const r = await fetch(url, { signal: ctrl.signal });
        if (!r.ok) return;
        const j = await r.json();
        const { h, m, informada } = horaLargada(e);
        const i = Math.min(23, h + (m >= 30 ? 1 : 0));
        const H = j.hourly;
        if (!H || H.temperature_2m?.[i] == null) return;
        setC({
          temp: Math.round(H.temperature_2m[i]), sens: Math.round(H.apparent_temperature[i]),
          umid: Math.round(H.relative_humidity_2m[i]), chuva: H.precipitation_probability?.[i] ?? null,
          hora: `${h}h${m ? String(m).padStart(2, '0') : ''}`, horaInformada: informada,
        });
      } catch { /* sem previsão: o bloco não aparece */ }
    })();
    return () => ctrl.abort();
  }, [e, dentro]);

  if (!dentro || !c) return null;
  const quente = c.sens >= 29;
  return (
    <section className={quente ? 'clima quente' : 'clima'} aria-label="Previsão do tempo na largada">
      <div className="clima-top">
        <Thermometer size={18} aria-hidden="true" />
        <span>Previsão na largada{c.horaInformada ? ` (${c.hora})` : ' (por volta das 6h)'}</span>
      </div>
      <div className="clima-nums">
        <div><b>{c.temp}°</b><small>temperatura</small></div>
        <div><b>{c.sens}°</b><small>sensação</small></div>
        <div><b>{c.umid}%</b><small>umidade</small></div>
        {c.chuva != null && <div><b>{c.chuva}%</b><small>chance de chuva</small></div>}
      </div>
      <p>{dica(c)}</p>
    </section>
  );
}
