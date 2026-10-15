#!/usr/bin/env node
// Calcula a altimetria de um percurso a partir de um GPX (arquivo ou link https).
// Uso: node scripts/altimetria.mjs <arquivo.gpx | https://...gpx> [link-do-percurso]
// Imprime o objeto "elevation" pronto para colar na prova.
// Se o GPX não tiver altitude, busca na API de elevação do Open-Meteo (grátis).
import { readFile } from 'node:fs/promises';
import { nivelSubida } from './radar-lib.mjs';

const [, , fonte, routeUrl] = process.argv;
if (!fonte) { console.error('Uso: node scripts/altimetria.mjs <arquivo.gpx | link> [link do percurso]'); process.exit(1); }

const xml = /^https:/.test(fonte) ? await (await fetch(fonte)).text() : await readFile(fonte, 'utf8');
const pts = [...xml.matchAll(/<(?:trkpt|rtept)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:trkpt|rtept)>)/g)].map(m => {
  const lat = +/lat="([^"]+)"/.exec(m[1])?.[1], lon = +/lon="([^"]+)"/.exec(m[1])?.[1];
  const ele = m[2] && /<ele>([^<]+)<\/ele>/.exec(m[2]);
  return { lat, lon, ele: ele ? +ele[1] : null };
}).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
if (pts.length < 2) { console.error('Não achei pontos de percurso (trkpt/rtept) nesse GPX.'); process.exit(1); }

// distância acumulada (km)
const R = 6371, rad = Math.PI / 180;
let acc = 0; const dist = [0];
for (let i = 1; i < pts.length; i++) {
  const a = pts[i - 1], b = pts[i];
  const h = Math.sin((b.lat - a.lat) * rad / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lon - a.lon) * rad / 2) ** 2;
  acc += 2 * R * Math.asin(Math.sqrt(h)); dist.push(acc);
}
const km = acc;

// reamostra a cada ~50 m
const passo = Math.max(0.05, km / 400), amostra = [];
for (let d = 0, j = 0; d <= km; d += passo) {
  while (j < dist.length - 2 && dist[j + 1] < d) j++;
  const t = dist[j + 1] === dist[j] ? 0 : (d - dist[j]) / (dist[j + 1] - dist[j]);
  const a = pts[j], b = pts[j + 1];
  amostra.push({ lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t, ele: a.ele != null && b.ele != null ? a.ele + (b.ele - a.ele) * t : null });
}

if (amostra.some(p => p.ele == null)) {
  for (let i = 0; i < amostra.length; i += 100) {
    const lote = amostra.slice(i, i + 100);
    const u = `https://api.open-meteo.com/v1/elevation?latitude=${lote.map(p => p.lat.toFixed(5)).join(',')}&longitude=${lote.map(p => p.lon.toFixed(5)).join(',')}`;
    const r = await (await fetch(u)).json();
    if (!r.elevation) { console.error('Falhou a busca de altitude no Open-Meteo:', JSON.stringify(r)); process.exit(1); }
    r.elevation.forEach((v, k) => { lote[k].ele = v; });
  }
}

// suaviza (média móvel de ~250 m) e soma subidas com tolerância de 1 m para ignorar ruído
const e = amostra.map(p => p.ele);
const jan = Math.max(1, Math.round(0.125 / passo));
const lisa = e.map((_, i) => { const s = e.slice(Math.max(0, i - jan), i + jan + 1); return s.reduce((x, y) => x + y, 0) / s.length; });
let gain = 0, loss = 0, ref = lisa[0];
for (const v of lisa) { if (v - ref >= 1) { gain += v - ref; ref = v; } else if (ref - v >= 1) { loss += ref - v; ref = v; } }

const N = 60, profile = Array.from({ length: N }, (_, i) => Math.round(lisa[Math.round(i * (lisa.length - 1) / (N - 1))]));
const level = nivelSubida(gain, km);
const min = Math.min(...profile), max = Math.max(...profile);
const elevation = {
  level, gain: Math.round(gain), km: Math.round(km * 100) / 100, profile, routeUrl: routeUrl ?? (/^https:/.test(fonte) ? fonte : null),
  summary: `Altitude entre ${min} e ${max} m, medida pelo GPX do percurso.`,
};
console.log(JSON.stringify({ elevation }, null, 2));
