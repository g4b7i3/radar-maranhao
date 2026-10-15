// Gera eventos de calendário (.ics) das provas. Usado no build (scripts/calendario.mjs)
// e na função da "Minha agenda" (netlify/functions/minha-agenda.mjs).
export const SITE = 'https://radarcorridasma.com.br';
const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function lugar(e) {
  const city = e.city.trim(); let rest = e.location.trim();
  const n = norm(rest), c = norm(city);
  if (n === c) rest = '';
  else if (n.startsWith(c) && /^\s*[·,–-]/.test(rest.slice(city.length))) rest = rest.slice(city.length).replace(/^[\s·,–-]+/, '');
  else if (n.endsWith(c) && /[·,–-]\s*$/.test(rest.slice(0, rest.length - city.length))) rest = rest.slice(0, rest.length - city.length).replace(/[\s·,–-]+$/, '');
  return (rest ? `${rest}, ${city}` : city) + ' - MA';
}
// mesma regra do site (src/Clima.tsx)
function largada(e) {
  const r = /largada[^0-9]{0,12}(\d{1,2})\s*h\s*(\d{2})?/i.exec(e.notes || '');
  if (r) { const h = +r[1], m = +(r[2] || 0); if (h < 24 && m < 60) return { h, m }; }
  return null;
}
const esc = s => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
// dobra linhas longas (limite de 75 bytes do formato)
const fold = l => { const out = []; let cur = '', bytes = 0; for (const ch of l) { const b = new TextEncoder().encode(ch).length; if (bytes + b > 73) { out.push(cur); cur = ' '; bytes = 1; } cur += ch; bytes += b; } out.push(cur); return out.join('\r\n'); };
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const ymd = d => d.toISOString().slice(0, 10).replace(/-/g, '');
const utc = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export function vevent(e, lembrete) {
  const L = largada(e);
  const quando = [];
  if (L) {
    const ini = new Date(`${e.date}T${String(L.h).padStart(2, '0')}:${String(L.m).padStart(2, '0')}:00-03:00`);
    quando.push(`DTSTART:${utc(ini)}`, `DTEND:${utc(new Date(+ini + 3 * 3600e3))}`);
  } else {
    const fim = new Date(e.date + 'T12:00:00Z'); fim.setUTCDate(fim.getUTCDate() + 1);
    quando.push(`DTSTART;VALUE=DATE:${e.date.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${ymd(fim)}`);
  }
  const desc = [
    e.distances.length ? 'Distâncias: ' + e.distances.map(d => String(d).replace('.', ',') + ' km').join(', ') : null,
    'Inscrições: ' + e.status, e.notes, e.officialUrl ? 'Inscrição: ' + e.officialUrl : null,
    `Ver no Radar: ${SITE}/?prova=${e.id}`,
  ].filter(Boolean).join('\n');
  // véspera às 18h (dia inteiro: 6h antes da meia-noite; com horário: 12h antes da largada)
  // Dois alarmes: véspera às 18h e no dia (2h antes da largada; sem horário, 5h da manhã).
  const al = (gatilho, txt) => ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(txt)}`, `TRIGGER:${gatilho}`, 'END:VALARM'];
  const alarme = !lembrete ? [] : [
    ...al(L ? `-PT${L.h + 6}H${L.m ? L.m + 'M' : ''}` : '-PT6H', 'Amanhã tem prova: ' + e.name),
    ...al(L ? '-PT2H' : 'PT5H', 'Hoje tem prova: ' + e.name),
  ];
  return ['BEGIN:VEVENT', `UID:${e.id}@radarcorridasma.com.br`, `DTSTAMP:${stamp()}`, ...quando,
    `SUMMARY:${esc('🏃 ' + e.name)}`, `LOCATION:${esc(lugar(e))}`, `DESCRIPTION:${esc(desc)}`,
    `URL:${e.officialUrl || `${SITE}/?prova=${e.id}`}`, ...(e.status === 'Cancelada' ? ['STATUS:CANCELLED'] : []), ...alarme, 'END:VEVENT'];
}
export const cal = (linhas, extra = []) => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Radar Corridas Maranhao//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', ...extra, ...linhas, 'END:VCALENDAR'].map(fold).join('\r\n') + '\r\n';

