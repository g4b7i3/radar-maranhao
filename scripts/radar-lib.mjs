// Regras de validação e deduplicação da agenda (mesma lógica da versão original).
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const DATA_FILE = fileURLToPath(new URL('../public/data/radar.json', import.meta.url));

// Campos que, quando mudam, geram um aviso de "Alteração importante".
export const SIGNIFICANT = ['date', 'distances', 'location', 'registrationOpen', 'registrationClose', 'status', 'officialUrl'];
const FIELDS = ['id', 'name', 'edition', 'city', 'state', 'modality', 'date', 'distances', 'location', 'registrationOpen', 'registrationClose', 'status', 'officialUrl', 'sourceUrl', 'sourceName', 'publishedAt', 'confidence', 'notes', 'prize', 'elevation', 'price', 'start'];
// Premiação: null = ainda não conferida; 'dinheiro' (com o maior valor em top); 'trofeu' (troféu/brinde, sem dinheiro); 'sem' (conferida: só medalha de participação)
export const PRIZE_KINDS = ['dinheiro', 'trofeu', 'sem'];
// Altimetria: null = percurso ainda não conferido. Nível pela subida acumulada por km.
export const ELEVATION_LEVELS = ['plano', 'poucas', 'varias', 'muitas'];
export const nivelSubida = (gain, km) => { const r = gain / km; return r < 5 ? 'plano' : r < 12 ? 'poucas' : r < 25 ? 'varias' : 'muitas'; };
const STATUSES = ['Abertas', 'Em breve', 'Consultar', 'Encerradas', 'Esgotadas', 'Cancelada', 'Adiada'];

export const signature = e => JSON.stringify(SIGNIFICANT.map(k => e[k] ?? null));
export const slug = v => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function validateEvent(e) {
  if (!e || typeof e !== 'object') throw Error('Prova inválida');
  const who = e.name || e.id || '(sem nome)';
  for (const k of ['id', 'name', 'edition', 'city', 'state', 'modality', 'location', 'status', 'sourceUrl', 'sourceName', 'confidence', 'notes'])
    if (typeof e[k] !== 'string' || !e[k].trim() || e[k].length > 1500) throw Error(`${who}: campo "${k}" vazio ou inválido`);
  if (e.state !== 'MA') throw Error(`${who}: só entram provas no Maranhão (state "MA")`);
  if (!['Rua', 'Trail'].includes(e.modality)) throw Error(`${who}: modality deve ser "Rua" ou "Trail"`);
  if (!STATUSES.includes(e.status)) throw Error(`${who}: status deve ser um de ${STATUSES.join(', ')}`);
  if (!/^[a-z0-9-]{3,160}$/.test(e.id)) throw Error(`${who}: id deve ter só letras minúsculas, números e hífens`);
  if (!Array.isArray(e.distances) || e.distances.some(d => typeof d !== 'number' || d <= 0 || d > 1000)) throw Error(`${who}: distances deve ser uma lista de números em km`);
  for (const k of ['date', 'registrationOpen', 'registrationClose', 'publishedAt'])
    if (e[k] != null && (typeof e[k] !== 'string' || !/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(e[k]) || !Number.isFinite(Date.parse(e[k]))))
      throw Error(`${who}: data inválida em "${k}" (use AAAA-MM-DD ou null)`);
  for (const k of ['sourceUrl', 'officialUrl'])
    if (e[k] != null && new URL(e[k]).protocol !== 'https:') throw Error(`${who}: "${k}" precisa ser um link https`);
  if (e.prize != null) {
    const p = e.prize;
    if (typeof p !== 'object' || !PRIZE_KINDS.includes(p.kind)) throw Error(`${who}: prize.kind deve ser um de ${PRIZE_KINDS.join(', ')} (ou prize null se ainda não foi conferido)`);
    if (typeof p.summary !== 'string' || !p.summary.trim() || p.summary.length > 300) throw Error(`${who}: prize.summary precisa de um texto curto (até 300 caracteres)`);
    if (p.top != null && (typeof p.top !== 'number' || p.top <= 0 || p.top > 1e6)) throw Error(`${who}: prize.top deve ser o maior prêmio em reais (número) ou null`);
    if (p.kind === 'dinheiro' && p.top == null) throw Error(`${who}: premiação em dinheiro precisa do maior valor em prize.top`);
    e = { ...e, prize: { kind: p.kind, top: p.kind === 'dinheiro' ? p.top : null, summary: p.summary.trim() } };
  }
  if (e.elevation != null) {
    const a = e.elevation;
    if (typeof a !== 'object') throw Error(`${who}: elevation deve ser um objeto (ou null se o percurso ainda não foi conferido)`);
    const num = (v, max) => v == null || (typeof v === 'number' && v >= 0 && v <= max);
    if (!num(a.gain, 20000)) throw Error(`${who}: elevation.gain é a subida acumulada em metros (número) ou null`);
    if (!num(a.km, 1000) || a.km === 0) throw Error(`${who}: elevation.km é a distância do percurso medido (número) ou null`);
    if (a.profile != null && (!Array.isArray(a.profile) || a.profile.length < 2 || a.profile.length > 120 || a.profile.some(v => typeof v !== 'number' || v < -100 || v > 3000)))
      throw Error(`${who}: elevation.profile é uma lista de 2 a 120 altitudes em metros (use scripts/altimetria.mjs) ou null`);
    if (a.routeUrl != null && new URL(a.routeUrl).protocol !== 'https:') throw Error(`${who}: elevation.routeUrl precisa ser um link https`);
    if (typeof a.summary !== 'string' || !a.summary.trim() || a.summary.length > 300) throw Error(`${who}: elevation.summary precisa de um texto curto (até 300 caracteres)`);
    const level = a.gain != null && a.km ? nivelSubida(a.gain, a.km) : a.level;
    if (!ELEVATION_LEVELS.includes(level)) throw Error(`${who}: elevation.level deve ser um de ${ELEVATION_LEVELS.join(', ')} (ou informe gain e km)`);
    e = { ...e, elevation: { level, gain: a.gain == null ? null : Math.round(a.gain), km: a.km ?? null, profile: a.profile?.map(v => Math.round(v)) ?? null, routeUrl: a.routeUrl ?? null, summary: a.summary.trim() } };
  }
  // Valor da inscrição: min = menor valor em reais (0 = grátis ou solidária); text = como aparece no card ("R$ 80 + taxa").
  if (e.price != null) {
    const v = e.price;
    if (typeof v !== 'object' || typeof v.text !== 'string' || !v.text.trim() || v.text.length > 60) throw Error(`${who}: price.text precisa de um texto curto (até 60 caracteres), ex.: "R$ 80 + taxa"`);
    if (v.min != null && (typeof v.min !== 'number' || v.min < 0 || v.min > 5000)) throw Error(`${who}: price.min é o menor valor em reais (0 = grátis) ou null`);
    e = { ...e, price: { min: v.min ?? null, text: v.text.trim() } };
  }
  // Horário da largada (a primeira, se houver várias): "HH:MM"
  if (e.start != null && (typeof e.start !== 'string' || !/^([01]?\d|2[0-3]):[0-5]\d$/.test(e.start))) throw Error(`${who}: start é o horário da largada em "HH:MM" ou null`);
  if (e.start) e = { ...e, start: e.start.padStart(5, '0') };
  return Object.fromEntries(FIELDS.map(k => [k, e[k] ?? null]));
}

export function applyUpdate(state, events, now) {
  const next = structuredClone(state);
  const changes = [];
  for (const input of events) {
    const e = validateEvent(input);
    const old = next.events.find(x => x.id === e.id)
      || next.events.find(x => slug(x.name) === slug(e.name) && slug(x.city) === slug(e.city) && x.edition === e.edition)
      // Mesmo link oficial só junta se for a página da prova (não home/calendário), na mesma cidade e na MESMA DATA.
      // (Várias provas podem apontar para o mesmo calendário da plataforma.)
      || next.events.find(x => e.officialUrl && x.officialUrl === e.officialUrl && !/^\/(calendario|eventos?)?\/?$/.test(new URL(e.officialUrl).pathname)
           && slug(x.city) === slug(e.city) && x.date && x.date === e.date);
    if (old) e.id = old.id;
    // Quem não informa a premiação (ex.: coleta automática) não apaga a que já foi pesquisada.
    if (input.prize === undefined && old) e.prize = old.prize ?? null;
    if (input.elevation === undefined && old) e.elevation = old.elevation ?? null;
    if (input.price === undefined && old) e.price = old.price ?? null;
    if (input.start === undefined && old) e.start = old.start ?? null;
    const record = { ...e, verifiedAt: now, firstSeenAt: old?.firstSeenAt ?? now };
    const version = signature(record);
    if (old) next.events[next.events.findIndex(x => x.id === old.id)] = record; else next.events.push(record);
    if ((!old || signature(old) !== version) && !next.changes.some(c => c.eventId === record.id && c.version === version)) {
      const change = { id: randomUUID(), eventId: record.id, version, kind: old ? 'Alteração importante' : 'Nova prova', at: now, notifiedAt: null };
      next.changes.unshift(change);
      changes.push(change);
    }
  }
  next.lastChecked = now;
  return { next, changes };
}

export function validateState(s) {
  if (!s || !Array.isArray(s.events) || !Array.isArray(s.changes)) throw Error('radar.json precisa ter "events" e "changes"');
  const ids = new Set();
  for (const e of s.events) { validateEvent(e); if (ids.has(e.id)) throw Error('ID repetido: ' + e.id); ids.add(e.id); }
  for (const c of s.changes) if (!ids.has(c.eventId)) throw Error('Novidade aponta para prova inexistente: ' + c.eventId);
  if (!Number.isFinite(Date.parse(s.lastChecked))) throw Error('lastChecked inválido');
  return s;
}

export const readState = () => JSON.parse(readFileSync(DATA_FILE, 'utf8'));
export const writeState = s => writeFileSync(DATA_FILE, JSON.stringify(validateState(s), null, 2) + '\n');
