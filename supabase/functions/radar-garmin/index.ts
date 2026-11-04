// Radar · conexão oficial com o Garmin Connect (OAuth 2.0 PKCE) e recebimento das corridas (push da Garmin).
// App próprio do Radar no portal de desenvolvedor da Garmin: segredos GARMIN_CLIENT_ID, GARMIN_CLIENT_SECRET e GARMIN_WEBHOOK_KEY
// ficam no painel do Supabase do Radar. Nada aqui usa a Nexos.
// Endereços para cadastrar no app da Garmin:
//   retorno (redirect) ......... https://<projeto>.supabase.co/functions/v1/radar-garmin
//   avisos (push/ping) ......... https://<projeto>.supabase.co/functions/v1/radar-garmin?k=<GARMIN_WEBHOOK_KEY>
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { CORS, json, pagina, SITE, b64u, liberado, TIPO, avisarCorrida, parciaisERota } from '../_comum/integracoes.ts';

const SUPA = Deno.env.get('SUPABASE_URL')!;
const CALLBACK = `${SUPA}/functions/v1/radar-garmin`;
const AUTH_URL = 'https://connect.garmin.com/oauth2Confirm';
const TOKEN_URL = 'https://diauth.garmin.com/di-oauth2-service/oauth/token';
const API = 'https://apis.garmin.com/wellness-api/rest';
const db = createClient(SUPA, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
// chaves: do painel (env) ou do cofre criptografado do banco do Radar (vault, via radar_segredo)
let CLIENT_ID = Deno.env.get('GARMIN_CLIENT_ID') || '';
let CLIENT_SECRET = Deno.env.get('GARMIN_CLIENT_SECRET') || '';
let WEBHOOK = Deno.env.get('GARMIN_WEBHOOK_KEY') || '';
async function carregarChaves() {
  if (CLIENT_ID && CLIENT_SECRET && WEBHOOK) return;
  const ler = async (n: string) => (await db.rpc('radar_segredo', { p: n })).data as string | null;
  CLIENT_ID ||= (await ler('garmin_client_id')) || '';
  CLIENT_SECRET ||= (await ler('garmin_client_secret')) || '';
  WEBHOOK ||= (await ler('garmin_webhook_key')) || '';
}

// trabalho que continua depois de responder (sem deixar a pessoa esperando)
const depois = (p: PromiseLike<unknown>) => { const er = (globalThis as any).EdgeRuntime; if (er?.waitUntil) er.waitUntil(Promise.resolve(p)); else Promise.resolve(p).catch(() => null); };
const aleatorio = (n: number) => b64u(crypto.getRandomValues(new Uint8Array(n)));
const sha256 = async (t: string) => b64u(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t))));

async function pedirToken(params: Record<string, string>) {
  const r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...params }) });
  if (!r.ok) throw new Error(`token ${r.status} ${await r.text()}`);
  return await r.json();
}
const validade = (t: Record<string, number>) => ({
  expira_em: new Date(Date.now() + (Number(t.expires_in) - 600) * 1000).toISOString(),
  refresh_expira_em: t.refresh_token_expires_in ? new Date(Date.now() + Number(t.refresh_token_expires_in) * 1000).toISOString() : null,
});
async function tokenValido(integ: Record<string, string>) {
  if (integ.expira_em && new Date(integ.expira_em).getTime() > Date.now()) return integ.token;
  const t = await pedirToken({ grant_type: 'refresh_token', refresh_token: integ.refresh_token });
  await db.from('radar_integracoes').update({ token: t.access_token, refresh_token: t.refresh_token, ...validade(t), erro: null }).eq('id', integ.id);
  return t.access_token as string;
}

// resumo da atividade (activities) ou resumo + amostras (activityDetails)
async function receber(lista: Record<string, any>[], detalhes: boolean) {
  let n = 0;
  for (const a of lista) {
    const s = detalhes ? a.summary : a;
    if (!s) continue;
    const tipo = TIPO(String(s.activityType));
    if (!tipo || tipo === 'outro') continue; // o Radar é de corrida
    const { data: integ } = await db.from('radar_integracoes').select('user_id').eq('provedor', 'garmin').eq('athlete_id', String(a.userId)).maybeSingle();
    if (!integ) continue;
    const distancia_m = Math.round(Number(s.distanceInMeters) || 0), duracao_s = Math.round(Number(s.durationInSeconds) || 0);
    if (distancia_m < 500) continue;
    const cad = Number(s.averageRunCadenceInStepsPerMinute) || null;
    const row: Record<string, unknown> = {
      user_id: integ.user_id, fonte: 'garmin', ext_id: String(a.activityId ?? String(a.summaryId || '').replace(/-detail$/, '')),
      data: new Date(Number(s.startTimeInSeconds) * 1000).toISOString(), titulo: s.activityName ? String(s.activityName).slice(0, 120) : null, tipo,
      distancia_m, duracao_s, elevacao_m: s.totalElevationGainInMeters != null ? Math.round(Number(s.totalElevationGainInMeters)) : null,
      fc_media: s.averageHeartRateInBeatsPerMinute ? Math.round(Number(s.averageHeartRateInBeatsPerMinute)) : null,
      fc_max: s.maxHeartRateInBeatsPerMinute ? Math.round(Number(s.maxHeartRateInBeatsPerMinute)) : null,
      cadencia: cad ? Math.round(cad < 120 ? cad * 2 : cad) : null,
      resumo_rel: { kcal: s.activeKilocalories ?? null, passos: s.steps ?? null },
    };
    if (detalhes) Object.assign(row, parciaisERota((a.samples || []).map((p: any) => ({ d: p.totalDistanceInMeters ?? null, t: Number(p.timerDurationInSeconds ?? p.clockDurationInSeconds ?? 0), fc: p.heartRate ?? null, lat: p.latitudeInDegree ?? null, lon: p.longitudeInDegree ?? null }))));
    const { data: antes } = await db.from('radar_atividades').select('id').eq('user_id', integ.user_id).eq('fonte', 'garmin').eq('ext_id', row.ext_id).maybeSingle();
    const { data: salva, error } = await db.from('radar_atividades').upsert(row, { onConflict: 'user_id,fonte,ext_id' }).select('id, distancia_m, duracao_s').single();
    if (error || !salva) { console.error('salvar', error); continue; }
    n++;
    if (!antes) await avisarCorrida(db, integ.user_id, 'Garmin', salva);
  }
  return n;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const u = new URL(req.url);
  try {
    await carregarChaves();
    // 1) volta da tela de autorização da Garmin
    if (req.method === 'GET') {
      const state = u.searchParams.get('state') || '', code = u.searchParams.get('code');
      if (!state) return pagina('Radar · Garmin', 'Endereço de retorno da conexão do Radar com o Garmin Connect.');
      const { data: pk } = await db.from('radar_garmin_pkce').select('*').eq('state', state).maybeSingle();
      if (pk) await db.from('radar_garmin_pkce').delete().eq('state', state);
      if (!pk || Date.now() - new Date(pk.criado_em).getTime() > 20 * 60000) return pagina('Link expirado', 'Volte ao Radar e toque em “Conectar Garmin” de novo.');
      // volta pro mesmo endereço onde o app estava aberto (igual à Nexos): assim o celular reabre o app instalado
      const voltar = (ok: boolean) => Response.redirect(`${pk.retorno}#temporada/garmin-${ok ? 'ok' : 'erro'}`, 302);
      if (!code) return voltar(false);
      // volta pro app na hora; a troca do código e o cadastro da conexão terminam por trás (o app confere sozinho)
      depois((async () => {
        try {
          const t = await pedirToken({ grant_type: 'authorization_code', code, code_verifier: pk.verifier, redirect_uri: CALLBACK });
          const ur = await fetch(`${API}/user/id`, { headers: { Authorization: `Bearer ${t.access_token}` } });
          if (!ur.ok) { console.error('user id', ur.status, await ur.text()); return; }
          const gid = String((await ur.json()).userId);
          await db.from('radar_integracoes').delete().eq('provedor', 'garmin').eq('athlete_id', gid).neq('user_id', pk.user_id); // uma conta Garmin, um atleta
          const { error } = await db.from('radar_integracoes').upsert({ user_id: pk.user_id, provedor: 'garmin', athlete_id: gid, token: t.access_token, refresh_token: t.refresh_token, ...validade(t), conectado_em: new Date().toISOString(), ultima_sync: null, erro: null }, { onConflict: 'user_id,provedor' });
          if (error) console.error(error);
        } catch (e) { console.error('conectar', e); }
      })());
      return voltar(true);
    }
    if (req.method !== 'POST') return json({ erro: 'Método não suportado.' }, 405);

    // 2) avisos (push) da Garmin: só com a chave secreta no endereço
    if (u.searchParams.has('k')) {
      if (!WEBHOOK || u.searchParams.get('k') !== WEBHOOK) return json({ erro: 'não autorizado' }, 401);
      const body = await req.json().catch(() => ({}));
      const res: Record<string, unknown> = {};
      if (Array.isArray(body.activities)) res.atividades = await receber(body.activities, false);
      if (Array.isArray(body.activityDetails)) res.detalhes = await receber(body.activityDetails, true);
      if (Array.isArray(body.manuallyUpdatedActivities)) res.editadas = await receber(body.manuallyUpdatedActivities, false);
      for (const d of body.deregistrations || []) { // o atleta desligou o Radar no Garmin Connect: apaga a conexão e tudo o que veio de lá
        const { data: q } = await db.from('radar_integracoes').select('user_id').eq('provedor', 'garmin').eq('athlete_id', String(d.userId)).maybeSingle();
        if (q) await db.from('radar_atividades').delete().eq('user_id', q.user_id).eq('fonte', 'garmin');
        await db.from('radar_integracoes').delete().eq('provedor', 'garmin').eq('athlete_id', String(d.userId));
      }
      for (const p of body.userPermissionsChange || []) {
        const ok = (p.permissions || []).includes('ACTIVITY_EXPORT');
        await db.from('radar_integracoes').update({ erro: ok ? null : 'Permissão de atividades desligada no Garmin Connect.' }).eq('provedor', 'garmin').eq('athlete_id', String(p.userId));
      }
      const ids = [...new Set([...(body.activities || []), ...(body.activityDetails || [])].map((a: any) => String(a.userId)))];
      if (ids.length) await db.from('radar_integracoes').update({ ultima_sync: new Date().toISOString() }).eq('provedor', 'garmin').in('athlete_id', ids);
      return json({ ok: true, ...res });
    }

    // 3) ações do atleta logado
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: ud } = await db.auth.getUser(jwt);
    const eu = ud?.user;
    if (!eu) return json({ erro: 'Faça login de novo.' }, 401);
    const body = await req.json().catch(() => ({}));
    if (body.acao === 'iniciar') {
      if (!(await liberado(db, eu.email))) return json({ em_breve: true });
      if (!CLIENT_ID || !CLIENT_SECRET) return json({ configurado: false });
      let retorno = `${SITE}/?pro`;
      try { const r = new URL(String(body.retorno || '')); if (/(^|\.)radarcorridasma\.com\.br$|\.netlify\.app$/.test(r.hostname) && r.protocol === 'https:') retorno = `${r.origin}${r.pathname}?pro`; } catch { /* fica o padrão */ }
      const verifier = aleatorio(48), state = aleatorio(24);
      await db.from('radar_garmin_pkce').insert({ state, user_id: eu.id, verifier, retorno });
      depois(db.from('radar_garmin_pkce').delete().lt('criado_em', new Date(Date.now() - 3600e3).toISOString()));
      const url = `${AUTH_URL}?${new URLSearchParams({ response_type: 'code', client_id: CLIENT_ID, code_challenge: await sha256(verifier), code_challenge_method: 'S256', redirect_uri: CALLBACK, state })}`;
      return json({ configurado: true, url });
    }
    if (body.acao === 'desconectar') {
      const { data: integ } = await db.from('radar_integracoes').select('*').eq('user_id', eu.id).eq('provedor', 'garmin').maybeSingle();
      if (integ) {
        // responde na hora; o aviso pra Garmin e a limpeza das corridas seguem por trás
        await db.from('radar_integracoes').delete().eq('id', integ.id);
        depois((async () => {
          try { const tk = await tokenValido(integ); await fetch(`${API}/user/registration`, { method: 'DELETE', headers: { Authorization: `Bearer ${tk}` } }); } catch (e) { console.error('desregistrar', e); }
          await db.from('radar_atividades').delete().eq('user_id', eu.id).eq('fonte', 'garmin');
        })());
      }
      return json({ ok: true });
    }
    return json({ erro: 'Ação desconhecida.' }, 400);
  } catch (e) {
    console.error(e);
    return u.searchParams.has('k') ? json({ ok: false }, 200) : json({ erro: 'Erro na conexão com o Garmin.' }, 500);
  }
});
