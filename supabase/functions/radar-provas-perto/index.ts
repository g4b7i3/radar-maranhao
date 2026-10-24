// Radar Pro · avisos de provas perto de cada atleta (cidade do perfil + vizinhas até 40 km).
// Roda 1x por dia (pg_cron, ~8h de São Luís). Momentos: prova nova publicada, inscrições fechando em até 3 dias, prova amanhã
// e, toda segunda, o resumo das provas das próximas 2 semanas.
// No máximo UM aviso por pessoa por dia (junta tudo). Quem desligou em Conta (avisos_perto = false) não recebe.
// O envio do push é feito pelo radar-avisar (pega os avisos com enviado_em nulo).
// Body opcional: { "teste": true } só mostra o que seria enviado, sem gravar nada.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const SITE = 'https://radarcorridasma.com.br';
const RAIO_KM = 40;
const resp = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json' } });
const norm = (s: string) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const km = (a: number[], b: number[]) => {
  const r = Math.PI / 180, dLa = (b[0] - a[0]) * r, dLo = (b[1] - a[1]) * r;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLo / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
const diaSP = (desloc = 0) => new Date(Date.now() - 3 * 3600_000 + desloc * 86400_000).toISOString().slice(0, 10);
const dataBR = (d: string) => d.split('-').reverse().slice(0, 2).join('/');
const dists = (a: number[]) => (a ?? []).length ? ' · ' + a.map(x => `${String(x).replace('.', ',')} km`).join(', ') : '';

type Ev = { id: string; name: string; city: string; state: string; date: string; start?: string | null; location?: string | null; status: string; registrationClose?: string | null; publishedAt?: string | null; firstSeenAt?: string | null; distances?: number[] };
type Item = { ev: Ev; momento: 'amanha' | 'fecha' | 'nova' | 'semana'; dist: number };

Deno.serve(async req => {
  const interno = req.headers.get('x-radar-interno') ?? '';
  if (!interno || (interno !== Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') && interno !== Deno.env.get('RADAR_INTERNO'))) return resp({ erro: 'Sem permissão.' }, 403);
  const corpoReq = await req.json().catch(() => ({}));
  const teste = !!corpoReq?.teste;
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const [radar, geoBruto] = await Promise.all([
    fetch(`${SITE}/data/radar.json?t=${Date.now()}`).then(r => r.json()),
    fetch(`${SITE}/data/cidades-ma-geo.json`).then(r => r.json()),
  ]).catch(e => { throw new Error('Falha ao baixar dados do site: ' + e); });
  const geo = new Map<string, number[]>(Object.entries(geoBruto as Record<string, number[]>).map(([k, v]) => [norm(k), v]));

  const hoje = diaSP(), amanha = diaSP(1), em3 = diaSP(3), em14 = diaSP(14), anteontem = diaSP(-2);
  const segunda = corpoReq?.semana === true || new Date(hoje + 'T12:00:00Z').getUTCDay() === 1;
  const momentos: { ev: Ev; momento: Item['momento'] }[] = [];
  for (const ev of (radar.events ?? []) as Ev[]) {
    if (ev.state !== 'MA' || !ev.date || ev.date < hoje || ['Cancelada', 'Adiada', 'Encerradas'].includes(ev.status) && ev.date !== amanha) continue;
    if (!geo.has(norm(ev.city))) continue;
    if (ev.date === amanha) momentos.push({ ev, momento: 'amanha' });
    else if (ev.status === 'Abertas' && ev.registrationClose && ev.registrationClose >= hoje && ev.registrationClose <= em3) momentos.push({ ev, momento: 'fecha' });
    const pub = (ev.publishedAt ?? ev.firstSeenAt ?? '').slice(0, 10);
    if (pub && pub >= anteontem && ev.date > amanha) momentos.push({ ev, momento: 'nova' });
    if (segunda && ev.date > amanha && ev.date <= em14 && !['Cancelada', 'Adiada', 'Encerradas', 'Esgotadas'].includes(ev.status)) momentos.push({ ev, momento: 'semana' });
  }
  if (!momentos.length) return resp({ ok: true, momentos: 0, avisos: 0 });

  const { data: perfis } = await db.from('radar_perfis').select('user_id, cidade').eq('avisos_perto', true);
  const { data: log } = await db.from('radar_perto_log').select('user_id, evento, momento');
  const ja = new Set((log ?? []).map(l => `${l.user_id}|${l.evento}|${l.momento}`));

  const ORDEM = { amanha: 0, fecha: 1, nova: 2, semana: 3 };
  const plano: { user_id: string; cidade: string; itens: Item[] }[] = [];
  for (const p of perfis ?? []) {
    const c = geo.get(norm(p.cidade));
    if (!c) continue;
    const itens: Item[] = [];
    for (const m of momentos) {
      if (ja.has(`${p.user_id}|${m.ev.id}|${m.momento === 'semana' ? 'semana:' + hoje : m.momento}`)) continue;
      const d = km(c, geo.get(norm(m.ev.city))!);
      if (d <= RAIO_KM) itens.push({ ...m, dist: d });
    }
    // a mesma prova só entra uma vez no aviso do dia (o momento mais urgente)
    const vistos = new Set<string>();
    const unicos = itens.sort((a, b) => ORDEM[a.momento] - ORDEM[b.momento] || a.dist - b.dist).filter(i => !vistos.has(i.ev.id) && vistos.add(i.ev.id));
    if (unicos.length) plano.push({ user_id: p.user_id, cidade: p.cidade.trim(), itens: unicos });
  }

  const linha = (i: Item) => {
    const onde = norm(i.ev.city) === '' ? '' : ` em ${i.ev.city}`;
    if (i.momento === 'amanha') return `Amanhã: ${i.ev.name}${onde}${i.ev.start ? ` às ${i.ev.start}` : ''}${i.ev.location ? `, ${i.ev.location}` : ''}`;
    if (i.momento === 'fecha') return `Inscrições fecham ${i.ev.registrationClose === hoje ? 'hoje' : `dia ${dataBR(i.ev.registrationClose!)}`}: ${i.ev.name}${onde}`;
    if (i.momento === 'semana') return `${dataBR(i.ev.date)} ${i.ev.name}${onde}`;
    return `Prova nova: ${i.ev.name}${onde}, ${dataBR(i.ev.date)}${dists(i.ev.distances ?? [])}`;
  };
  const avisos = plano.map(({ user_id, cidade, itens }) => {
    const p = itens[0];
    const resumo = itens.some(i => i.momento === 'semana');
    const titulo = resumo ? 'Provas das próximas 2 semanas perto de você' : itens.length > 1 ? `${itens.length} novidades de provas perto de você`
      : p.momento === 'amanha' ? `É amanhã: ${p.ev.name}` : p.momento === 'fecha' ? `Inscrições fechando: ${p.ev.name}` : `Prova nova perto de você: ${p.ev.name}`;
    const max = resumo ? 8 : 3;
    const corpo = itens.slice(0, max).map(linha).join(' · ') + (itens.length > max ? ` · e mais ${itens.length - max}` : '');
    return {
      user_id, tipo: 'provas_perto', titulo: titulo.slice(0, 120), corpo: corpo.slice(0, 600),
      url: itens.length === 1 && !resumo ? `${SITE}/?prova=${encodeURIComponent(p.ev.id)}` : `${SITE}/corridas/`,
      chave: `perto:${hoje}:${user_id}`, cidade, itens: itens.map(i => `${i.momento}:${i.ev.id}`),
    };
  });
  if (teste) return resp({ ok: true, teste: true, hoje, momentos: momentos.map(m => `${m.momento}:${m.ev.id}`), avisos });

  let gravados = 0;
  for (const a of avisos) {
    const { cidade: _c, itens, ...linhaAviso } = a;
    const { error } = await db.from('radar_avisos').insert(linhaAviso);
    if (error) continue; // já recebeu o aviso de hoje (chave única)
    gravados++;
    await db.from('radar_perto_log').upsert(itens.map(x => { const [momento, ...ev] = x.split(':'); return { user_id: a.user_id, evento: ev.join(':'), momento: momento === 'semana' ? 'semana:' + hoje : momento }; }), { ignoreDuplicates: true });
  }
  // dispara o envio na hora (não espera o próximo ciclo do radar-avisar)
  if (gravados) await fetch(Deno.env.get('SUPABASE_URL') + '/functions/v1/radar-avisar', { method: 'POST', headers: { 'x-radar-interno': interno, 'Content-Type': 'application/json' }, body: '{}' }).catch(() => null);
  return resp({ ok: true, momentos: momentos.length, avisos: gravados });
});
