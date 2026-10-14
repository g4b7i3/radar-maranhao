// Regras de validação e deduplicação da agenda (mesma lógica da versão original).
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const DATA_FILE = fileURLToPath(new URL('../public/data/radar.json', import.meta.url));

// Campos que, quando mudam, geram um aviso de "Alteração importante".
export const SIGNIFICANT = ['date', 'distances', 'location', 'registrationOpen', 'registrationClose', 'status', 'officialUrl'];
const FIELDS = ['id', 'name', 'edition', 'city', 'state', 'modality', 'date', 'distances', 'location', 'registrationOpen', 'registrationClose', 'status', 'officialUrl', 'sourceUrl', 'sourceName', 'publishedAt', 'confidence', 'notes'];
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
