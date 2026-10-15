// Calcula o "clima típico" de cada cidade com prova: média de 5 anos de histórico (Open-Meteo, grátis),
// por mês e por hora de largada. Gera public/data/clima-tipico.json, que o site usa nas provas
// que ainda estão longe demais para ter previsão (mais de 15 dias).
// Roda no GitHub Actions junto com a coleta. Só busca cidades novas; use --tudo para refazer todas.
// Uso: node scripts/clima-tipico.mjs [--tudo]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const ARQ = 'public/data/clima-tipico.json';
const TUDO = process.argv.includes('--tudo');
const ANOS = [2021, 2025];
const HORAS = [4, 5, 6, 7, 8, 9, 15, 16, 17, 18, 19, 20, 21]; // largadas de manhã cedo e de fim de tarde/noite

// mesmas coordenadas fixas do site (src/Clima.tsx); as outras vêm da busca de cidades
const FIXAS = {
  'São Luís': [-2.53, -44.3], 'Imperatriz': [-5.52, -47.48], 'Caxias': [-4.86, -43.36], 'Timon': [-5.09, -42.84],
  'Açailândia': [-4.95, -47.5], 'Carolina': [-7.33, -47.47], 'Chapadinha': [-3.74, -43.36], 'Santa Inês': [-3.67, -45.38],
  'São José de Ribamar': [-2.56, -44.06], 'Paço do Lumiar': [-2.53, -44.11], 'Raposa': [-2.42, -44.1], 'Bacabal': [-4.23, -44.78],
  'Balsas': [-7.53, -46.04], 'Codó': [-4.46, -43.89], 'Barreirinhas': [-2.75, -42.83], 'Pinheiro': [-2.52, -45.08],
  'Presidente Dutra': [-5.29, -44.49], 'Porto Franco': [-6.34, -47.4],
};

const espera = ms => new Promise(r => setTimeout(r, ms));
async function json(url, tentativas = 3) {
  for (let i = 1; i <= tentativas; i++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); console.log(`  resposta ${r.status}, tentando de novo…`); }
    catch (e) { console.log(`  falha (${e.message}), tentando de novo…`); }
    await espera(3000 * i);
  }
  return null;
}

async function coord(cidade) {
  if (FIXAS[cidade]) return FIXAS[cidade];
  const j = await json(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cidade)}&count=10&language=pt&country=BR`);
  const hit = (j?.results || []).find(x => /maranh/i.test(x.admin1 || ''));
  return hit ? [hit.latitude, hit.longitude] : null;
}

async function normais(lat, lon) {
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
    `&start_date=${ANOS[0]}-01-01&end_date=${ANOS[1]}-12-31` +
    `&hourly=temperature_2m,apparent_temperature,relative_humidity_2m&daily=precipitation_sum&timezone=America%2FFortaleza`;
  const j = await json(url);
  if (!j?.hourly?.time) return null;
  const soma = {}; // soma[mes][hora] = [t, s, u, n]
  const H = j.hourly;
  for (let i = 0; i < H.time.length; i++) {
    const mes = Number(H.time[i].slice(5, 7)), hora = Number(H.time[i].slice(11, 13));
    if (!HORAS.includes(hora) || H.temperature_2m[i] == null) continue;
    const a = ((soma[mes] ??= {})[hora] ??= [0, 0, 0, 0]);
    a[0] += H.temperature_2m[i]; a[1] += H.apparent_temperature[i]; a[2] += H.relative_humidity_2m[i]; a[3]++;
  }
  const chuva = {}; // % de dias com 1 mm de chuva ou mais
  const D = j.daily;
  for (let i = 0; i < (D?.time?.length || 0); i++) {
    if (D.precipitation_sum[i] == null) continue;
    const mes = Number(D.time[i].slice(5, 7));
    const c = (chuva[mes] ??= [0, 0]); c[1]++; if (D.precipitation_sum[i] >= 1) c[0]++;
  }
  const m = {};
  for (let mes = 1; mes <= 12; mes++) {
    if (!soma[mes]) continue;
    const h = {};
    for (const [hora, [t, s, u, n]] of Object.entries(soma[mes])) h[hora] = [Math.round(t / n), Math.round(s / n), Math.round(u / n)];
    m[mes] = { h, chuva: chuva[mes] ? Math.round((100 * chuva[mes][0]) / chuva[mes][1]) : null };
  }
  return m;
}

const radar = JSON.parse(readFileSync('public/data/radar.json', 'utf8'));
const atual = existsSync(ARQ) && !TUDO ? JSON.parse(readFileSync(ARQ, 'utf8')) : { cidades: {} };
const cidades = [...new Set(radar.events.map(e => e.city))].sort();
const faltam = cidades.filter(c => !atual.cidades[c]);
console.log(`Clima típico: ${cidades.length} cidades na agenda, ${faltam.length} para calcular.`);
let novas = 0;
for (const c of faltam) {
  const xy = await coord(c);
  if (!xy) { console.log(`  ${c}: não achei as coordenadas, fica sem clima típico.`); continue; }
  const m = await normais(xy[0], xy[1]);
  if (!m) { console.log(`  ${c}: histórico indisponível agora, tenta na próxima.`); continue; }
  atual.cidades[c] = { lat: xy[0], lon: xy[1], m };
  novas++;
  console.log(`  ${c}: ok (novembro às 6h: ${m[11]?.h?.[6]?.join('°/')}%)`);
  await espera(1500); // educado com o serviço gratuito
}
if (!novas && !TUDO) { console.log('Nada novo.'); process.exit(0); }
writeFileSync(ARQ, JSON.stringify({ fonte: 'Open-Meteo, histórico ERA5', anos: `${ANOS[0]}–${ANOS[1]}`, horas: HORAS, cidades: atual.cidades }) + '\n');
console.log(`Gravado: ${Object.keys(atual.cidades).length} cidades.`);
