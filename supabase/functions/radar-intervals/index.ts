// Radar · conexão com o Intervals.icu (OAuth) e importação das corridas.
// App próprio do Radar no Intervals.icu: segredos INTERVALS_CLIENT_ID e INTERVALS_CLIENT_SECRET no painel do Supabase do Radar.
// Endereço de retorno para cadastrar no app: https://<projeto>.supabase.co/functions/v1/radar-intervals/callback
// Nada aqui usa a Nexos.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { CORS, json, pagina, SITE, b64u, liberado, avisarCorrida, parciaisERota } from '../_comum/integracoes.ts';

const SUPA = Deno.env.get('SUPABASE_URL')!;
const CALLBACK = `${SUPA}/functions/v1/radar-intervals/callback`;
const API = 'https://intervals.icu/api/v1';
const CLIENT_ID = Deno.env.get('INTERVALS_CLIENT_ID') || '';
const CLIENT_SECRET = Deno.env.get('INTERVALS_CLIENT_SECRET') || '';
const SEGREDO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!; // assina o "state" da volta
const db = createClient(SUPA, SEGREDO, { auth: { persistSession: false } });

const deB64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
async function hmac(txt: string) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(SEGREDO), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode('radar-intervals:' + txt))));
}
async function assinar(obj: Record<string, unknown>) { const p = b64u(new TextEncoder().encode(JSON.stringify(obj))); return p + '.' + (await hmac(p)); }
async function verificar(st: string) {
  const [p, s] = String(st || '').split('.');
  if (!p || !s || (await hmac(p)) !== s) return null;
  const o = JSON.parse(new TextDecoder().decode(deB64u(p)));
  return o.exp > Date.now() ? o : null;
}
const TIPOS: Record<string, string> = { Run: 'corrida', TrailRun: 'trail', VirtualRun: 'esteira', Walk: 'caminhada', Hike: 'caminhada' };

async function detalhar(tk: string, id: string) {
  try {
    const r = await fetch(`${API}/activity/${id}/streams.json?types=time,distance,heartrate,latlng`, { headers: { Authorization: `Bearer ${tk}`, Accept: 'application/json' } });
    if (!r.ok) return {};
    const st = (await r.json()) as { type: string; data: number[]; data2?: number[] }[];
    const S: Record<string, { data: number[]; data2?: number[] }> = {}; for (const x of st || []) S[x.type] = x;
    const tm = S.time?.data || []; if (tm.length < 5) return {};
    return parciaisERota(tm.map((t, i) => ({ t, d: S.distance?.data?.[i] ?? null, fc: S.heartrate?.data?.[i] ?? null, lat: S.latlng?.data?.[i] ?? null, lon: S.latlng?.data2?.[i] ?? null })));
  } catch (e) { console.error('detalhar', id, e); return {}; }
}

async function importar(integ: Record<string, string>) {
  const desde = new Date(integ.ultima_sync ? new Date(integ.ultima_sync).getTime() - 3 * 864e5 : Date.now() - 30 * 864e5);
  const ate = new Date(Date.now() + 864e5);
  const r = await fetch(`${API}/athlete/0/activities?oldest=${desde.toISOString().slice(0, 10)}&newest=${ate.toISOString().slice(0, 10)}`, { headers: { Authorization: `Bearer ${integ.token}`, Accept: 'application/json' } });
  if (r.status === 401 || r.status === 403) { await db.from('radar_integracoes').update({ erro: 'Conexão expirada. Conecte de novo.' }).eq('id', integ.id); throw new Error('A conexão com o Intervals.icu expirou. Desconecte e conecte de novo.'); }
  if (!r.ok) throw new Error('O Intervals.icu não respondeu agora. Tente mais tarde.');
  const lista = ((await r.json()) as Record<string, any>[]).filter((a) => TIPOS[String(a.type)] && Number(a.distance) > 500);
  const { data: ja } = await db.from('radar_atividades').select('ext_id').eq('user_id', integ.user_id).eq('fonte', 'intervals').in('ext_id', lista.map((a) => String(a.id)).concat('-'));
  const existe = new Set((ja || []).map((x) => x.ext_id));
  let novas = 0;
  for (const a of lista.filter((x) => !existe.has(String(x.id))).slice(0, 30)) {
    const cad = Number(a.average_cadence) || null;
    const row = {
      user_id: integ.user_id, fonte: 'intervals', ext_id: String(a.id), data: new Date(String(a.start_date || a.start_date_local)).toISOString(),
      titulo: a.name ? String(a.name).slice(0, 120) : null, tipo: TIPOS[String(a.type)],
      distancia_m: Math.round(Number(a.distance) || 0), duracao_s: Math.round(Number(a.moving_time || a.elapsed_time) || 0),
      elevacao_m: a.total_elevation_gain != null ? Math.round(Number(a.total_elevation_gain)) : null,
      fc_media: a.average_heartrate ? Math.round(Number(a.average_heartrate)) : null, fc_max: a.max_heartrate ? Math.round(Number(a.max_heartrate)) : null,
      cadencia: cad ? Math.round(cad < 120 ? cad * 2 : cad) : null, resumo_rel: { kcal: a.calories ?? null },
      ...(await detalhar(integ.token, String(a.id))),
    };
    const { data: salva } = await db.from('radar_atividades').insert(row).select('id, distancia_m, duracao_s, data').single();
    if (salva) { novas++; if (Date.now() - new Date(salva.data).getTime() < 2 * 864e5) await avisarCorrida(db, integ.user_id, 'Intervals.icu', salva); }
  }
  await db.from('radar_integracoes').update({ ultima_sync: new Date().toISOString(), erro: null }).eq('id', integ.id);
  return novas;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const u = new URL(req.url);
  try {
    if (req.method === 'GET' && u.pathname.endsWith('/callback')) {
      const st = await verificar(u.searchParams.get('state') || '');
      if (!st) return pagina('Link expirado', 'Volte ao Radar e toque em “Conectar Intervals.icu” de novo.');
      const voltar = (ok: boolean) => Response.redirect(`${SITE}/?pro#temporada/intervals-${ok ? 'ok' : 'erro'}`, 302);
      const code = u.searchParams.get('code'); if (!code) return voltar(false);
      const tr = await fetch('https://intervals.icu/api/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code }) });
      if (!tr.ok) { console.error('token', tr.status, await tr.text()); return voltar(false); }
      const t = await tr.json();
      const { error } = await db.from('radar_integracoes').upsert({ user_id: st.u, provedor: 'intervals', athlete_id: t.athlete?.id ? String(t.athlete.id) : null, token: t.access_token, conectado_em: new Date().toISOString(), ultima_sync: null, erro: null }, { onConflict: 'user_id,provedor' });
      if (error) { console.error(error); return voltar(false); }
      const { data: integ } = await db.from('radar_integracoes').select('*').eq('user_id', st.u).eq('provedor', 'intervals').maybeSingle();
      if (integ) await importar(integ).catch((e) => console.error('primeira importação', e));
      return voltar(true);
    }
    if (req.method !== 'POST') return json({ erro: 'Método não suportado.' }, 405);
    // sincronização de todo mundo (chamada interna de hora em hora)
    const interno = req.headers.get('x-radar-interno') ?? '';
    if (interno && (interno === SEGREDO || interno === Deno.env.get('RADAR_INTERNO'))) {
      const { data: todos } = await db.from('radar_integracoes').select('*').eq('provedor', 'intervals').is('erro', null).limit(200);
      let n = 0; for (const i of todos || []) n += await importar(i).catch(() => 0);
      return json({ ok: true, novas: n });
    }
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: ud } = await db.auth.getUser(jwt);
    const eu = ud?.user;
    if (!eu) return json({ erro: 'Faça login de novo.' }, 401);
    const body = await req.json().catch(() => ({}));
    if (body.acao === 'iniciar') {
      if (!(await liberado(db, eu.email))) return json({ em_breve: true });
      if (!CLIENT_ID || !CLIENT_SECRET) return json({ configurado: false });
      const state = await assinar({ u: eu.id, exp: Date.now() + 15 * 60000 });
      return json({ configurado: true, url: `https://intervals.icu/oauth/authorize?${new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: CALLBACK, scope: 'ACTIVITY:READ', state })}` });
    }
    if (body.acao === 'sync') {
      const { data: integ } = await db.from('radar_integracoes').select('*').eq('user_id', eu.id).eq('provedor', 'intervals').maybeSingle();
      if (!integ) return json({ novas: 0 });
      return json({ ok: true, novas: await importar(integ) });
    }
    if (body.acao === 'desconectar') {
      const { data: integ } = await db.from('radar_integracoes').select('id, token').eq('user_id', eu.id).eq('provedor', 'intervals').maybeSingle();
      if (integ?.token) await fetch(`${API}/disconnect-app`, { method: 'DELETE', headers: { Authorization: `Bearer ${integ.token}` } }).catch(() => {});
      if (integ) await db.from('radar_integracoes').delete().eq('id', integ.id);
      return json({ ok: true });
    }
    return json({ erro: 'Ação desconhecida.' }, 400);
  } catch (e) {
    console.error(e);
    return json({ erro: e instanceof Error && /[ãçéíó]/.test(e.message) ? e.message : 'Erro na conexão com o Intervals.icu.' }, 500);
  }
});
