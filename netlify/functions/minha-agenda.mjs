// "Minha agenda" assinada no calendário: /calendario/minha.ics?ids=prova1,prova2
// O calendário do celular busca este endereço de tempos em tempos, então mudanças de data aparecem sozinhas.
import { cal, vevent } from '../../scripts/ics.mjs';

export default async (req) => {
  const url = new URL(req.url);
  const ids = new Set((url.searchParams.get('ids') || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 200));
  const r = await fetch(new URL('/data/radar.json', url.origin));
  if (!r.ok) return new Response('Agenda indisponível', { status: 503 });
  const { events } = await r.json();
  const lista = events.filter(e => ids.has(e.id) && e.date).sort((a, b) => a.date.localeCompare(b.date));
  const body = cal(lista.flatMap(e => vevent(e, true)), [
    'X-WR-CALNAME:Minha agenda de corridas', 'X-WR-TIMEZONE:America/Fortaleza',
    'REFRESH-INTERVAL;VALUE=DURATION:PT12H', 'X-PUBLISHED-TTL:PT12H',
  ]);
  return new Response(body, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'public, max-age=1800' } });
};

export const config = { path: '/calendario/minha.ics' };
