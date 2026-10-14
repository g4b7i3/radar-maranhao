export type Race = {
  id: string; name: string; edition: string; city: string; state: string;
  modality: 'Rua' | 'Trail'; date: string | null; distances: number[]; location: string;
  registrationOpen: string | null; registrationClose: string | null; status: string;
  officialUrl: string | null; sourceUrl: string; sourceName: string; publishedAt: string | null;
  confidence: string; notes: string; verifiedAt?: string; firstSeenAt?: string;
};
export type Change = { id: string; eventId: string; kind: string; at: string; notifiedAt: string | null };
export type State = { events: Race[]; changes: Change[]; lastChecked: string; monitoring: boolean; scheduleLabel: string | null };

const TZ = 'America/Sao_Paulo';
const asDate = (d: string) => new Date(d.length === 10 ? d + 'T12:00:00-03:00' : d);

export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

/** Dias de hoje até a data (AAAA-MM-DD), no fuso de São Luís. */
export function daysUntil(d: string | null) {
  if (!d) return null;
  const a = Date.parse(today() + 'T00:00:00Z'), b = Date.parse(d.slice(0, 10) + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}

export const fmt = {
  day: (d: string) => d.slice(8, 10).replace(/^0/, ''),
  weekdayShort: (d: string) => new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: TZ }).format(asDate(d)).replace('.', ''),
  monthKey: (d: string) => d.slice(0, 7),
  monthName: (key: string) => { const s = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: TZ }).format(asDate(key + '-15')); return s[0].toUpperCase() + s.slice(1); },
  year: (key: string) => key.slice(0, 4),
  long: (d: string | null) => d ? new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ }).format(asDate(d)) : 'Data a confirmar',
  short: (d: string | null) => d ? new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', timeZone: TZ }).format(asDate(d)).replace('.', '') : 'não divulgado',
  full: (d: string | null, time = false) => d ? new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', ...(time ? { hour: '2-digit', minute: '2-digit' } : {}), timeZone: TZ }).format(asDate(d)) : 'Não divulgado',
};

export type Status = 'Abertas' | 'Abrem em breve' | 'Consultar' | 'Encerradas' | 'Realizada' | 'Cancelada' | string;
export function status(e: Race): Status {
  const t = today();
  if (e.status === 'Cancelada') return 'Cancelada';
  if (e.date && e.date < t) return 'Realizada';
  if (e.registrationClose && e.registrationClose.slice(0, 10) < t) return 'Encerradas';
  if (e.status === 'Em breve') return e.registrationOpen && new Date(e.registrationOpen) <= new Date() ? 'Abertura anunciada' : 'Abrem em breve';
  return e.status;
}
export const isOpen = (e: Race) => ['Abertas', 'Abertura anunciada'].includes(status(e));

/** Frase curta sobre o prazo, com urgência quando faltam poucos dias. */
export function deadline(e: Race): { text: string; urgent: boolean } | null {
  const s = status(e);
  if (s === 'Realizada' || s === 'Cancelada') return null;
  if (s === 'Encerradas') return { text: 'Inscrições encerradas', urgent: false };
  if (s === 'Abrem em breve' && e.registrationOpen) return { text: 'Inscrições abrem ' + fmt.short(e.registrationOpen), urgent: false };
  if (!e.registrationClose) return { text: 'Prazo não divulgado', urgent: false };
  const n = daysUntil(e.registrationClose)!;
  if (n === 0) return { text: 'Inscrições encerram hoje', urgent: true };
  if (n === 1) return { text: 'Inscrições encerram amanhã', urgent: true };
  return { text: 'Inscrições até ' + fmt.short(e.registrationClose), urgent: n <= 5 };
}

export function countdown(d: string | null) {
  const n = daysUntil(d);
  if (n == null) return null;
  if (n === 0) return { n: 'Hoje', unit: '' };
  if (n === 1) return { n: '1', unit: 'dia' };
  return { n: String(n), unit: 'dias' };
}

export function icsFor(events: Race[]) {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/;/g, '\;').replace(/,/g, '\\,');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const items = events.filter(e => e.date).map(e => {
    const end = new Date(e.date + 'T12:00:00Z'); end.setUTCDate(end.getUTCDate() + 1);
    return ['BEGIN:VEVENT', `UID:${e.id}@radar-maranhao`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${e.date!.replace(/-/g, '')}`,
      `DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replace(/-/g, '')}`, `SUMMARY:${esc(e.name)}`,
      `LOCATION:${esc(placeLabel(e) + ' - MA')}`, `DESCRIPTION:${esc(e.notes + '\nFonte: ' + e.sourceUrl)}`,
      ...(e.officialUrl ? [`URL:${e.officialUrl}`] : []), 'END:VEVENT'].join('\r\n');
  });
  const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Radar Corridas Maranhao//Corridas//PT-BR', ...items, 'END:VCALENDAR'].join('\r\n');
  const url = URL.createObjectURL(new Blob([body], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = events.length === 1 ? events[0].id + '.ics' : 'minhas-corridas-maranhao.ics'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function load<T>(key: string, fallback: T): T { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } }
export function store(key: string, v: unknown) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* armazenamento indisponível */ } }

/** Local sem repetir a cidade (alguns anúncios já trazem "Cidade · local"). */
export function placeParts(e: Pick<Race, 'city' | 'location'>) {
  const city = e.city.trim();
  let rest = e.location.trim();
  if (norm(rest).startsWith(norm(city))) rest = rest.slice(city.length).replace(/^[\s·,–-]+/, '');
  if (norm(rest).endsWith(norm(city))) rest = rest.slice(0, rest.length - city.length).replace(/[\s·,–-]+$/, '');
  if (rest) rest = rest[0].toUpperCase() + rest.slice(1);
  return { city, rest };
}
/** "Local, Cidade" — para a ficha e o destaque. */
export const placeLabel = (e: Pick<Race, 'city' | 'location'>) => { const { city, rest } = placeParts(e); return rest ? `${rest}, ${city}` : city; };
/** "Cidade, local" — para a lista, onde a cidade vem primeiro. */
export const placeList = (e: Pick<Race, 'city' | 'location'>) => { const { city, rest } = placeParts(e); return rest ? `${city}, ${rest}` : city; };
