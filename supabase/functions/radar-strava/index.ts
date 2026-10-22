// Radar Pro · conexão com o Strava (só dados da própria pessoa: perfil, totais, tênis e clubes).
// Ações: link (URL de autorização), conectar (troca o code por tokens), atualizar (recarrega os números), desconectar.
// Regra do Strava: esses dados aparecem só para quem conectou; nunca entram em ranking.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const resp = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const VOLTA = 'https://radarcorridasma.com.br/strava.html';
const ESCOPO = 'read,profile:read_all';

type Tot = { count: number; distance: number; moving_time: number; elevation_gain: number };
const tot = (t?: Tot) => ({ corridas: t?.count ?? 0, km: Math.round((t?.distance ?? 0) / 100) / 10, tempo_s: t?.moving_time ?? 0, subida_m: Math.round(t?.elevation_gain ?? 0) });

/** Busca no Strava o que a gente guarda: perfil, totais de corrida, tênis e clubes. */
async function montarDados(acesso: string, atletaId: number) {
  const h = { Authorization: `Bearer ${acesso}` };
  const [a, s, c] = await Promise.all([
    fetch('https://www.strava.com/api/v3/athlete', { headers: h }).then(r => r.ok ? r.json() : null),
    fetch(`https://www.strava.com/api/v3/athletes/${atletaId}/stats`, { headers: h }).then(r => r.ok ? r.json() : null),
    fetch('https://www.strava.com/api/v3/athlete/clubs', { headers: h }).then(r => r.ok ? r.json() : []).catch(() => []),
  ]);
  if (!a) throw new Error('strava_perfil');
  return {
    nome: [a.firstname, a.lastname].filter(Boolean).join(' ').trim(),
    foto: a.profile_medium && !String(a.profile_medium).includes('avatar/athlete') ? a.profile_medium : null,
    cidade: [a.city, a.state].filter(Boolean).join(', '),
    perfil_url: `https://www.strava.com/athletes/${atletaId}`,
    recentes: tot(s?.recent_run_totals), ano: tot(s?.ytd_run_totals), total: tot(s?.all_run_totals),
    tenis: ((a.shoes ?? []) as { name: string; distance: number; primary: boolean; retired?: boolean }[]).filter(t => !t.retired).map(t => ({ nome: t.name, km: Math.round(t.distance / 1000), principal: !!t.primary })).sort((x, y) => y.km - x.km).slice(0, 6),
    clubes: ((Array.isArray(c) ? c : []) as { id: number; name: string; member_count?: number; url?: string }[]).map(x => ({ nome: x.name, membros: x.member_count ?? null, url: `https://www.strava.com/clubs/${x.url ?? x.id}` })).slice(0, 6),
  };
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return resp({ erro: 'Método não aceito' }, 405);
  const ID = Deno.env.get('STRAVA_CLIENT_ID'); const SEGREDO = Deno.env.get('STRAVA_CLIENT_SECRET');
  if (!ID || !SEGREDO) return resp({ erro: 'Conexão com o Strava ainda não configurada.' }, 503);
  const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: { user } } = await anon.auth.getUser();
  if (!user) return resp({ erro: 'Faça login de novo.' }, 401);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  let b: Record<string, any>;
  try { b = await req.json(); } catch { return resp({ erro: 'Envio inválido.' }, 400); }

  const salvar = async (t: { access_token: string; refresh_token: string; expires_at: number }, atletaId: number, dados: unknown) =>
    db.from('radar_strava').upsert({ user_id: user.id, atleta_id: atletaId, acesso: t.access_token, renovacao: t.refresh_token, expira_em: new Date(t.expires_at * 1000).toISOString(), dados, atualizado_em: new Date().toISOString() });

  switch (b.acao) {
    case 'link':
      return resp({ url: `https://www.strava.com/oauth/authorize?client_id=${ID}&response_type=code&redirect_uri=${encodeURIComponent(VOLTA)}&approval_prompt=auto&scope=${ESCOPO}` });

    case 'conectar': {
      const code = String(b.code ?? '').replace(/[^a-f0-9]/gi, '').slice(0, 64);
      if (!code) return resp({ erro: 'Volta do Strava sem código.' }, 400);
      const r = await fetch('https://www.strava.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: ID, client_secret: SEGREDO, code, grant_type: 'authorization_code' }) });
      const t = await r.json().catch(() => ({}));
      if (!r.ok || !t.access_token) return resp({ erro: 'O Strava não aceitou a conexão. Tente de novo.', detalhe: t.message ?? null }, 400);
      const atletaId = Number(t.athlete?.id);
      // a mesma conta do Strava não pode ficar ligada a duas contas do Radar
      const { data: outro } = await db.from('radar_strava').select('user_id').eq('atleta_id', atletaId).neq('user_id', user.id).maybeSingle();
      if (outro) return resp({ erro: 'Essa conta do Strava já está ligada a outra conta do Radar Pro.' }, 409);
      let dados; try { dados = await montarDados(t.access_token, atletaId); } catch { return resp({ erro: 'Conectou, mas não deu para ler os dados. Toque em Atualizar.' }, 502); }
      const { error } = await salvar(t, atletaId, dados);
      if (error) return resp({ erro: 'Não deu para guardar a conexão.' }, 500);
      return resp({ ok: true, dados });
    }

    case 'atualizar': {
      const { data: s } = await db.from('radar_strava').select('*').eq('user_id', user.id).maybeSingle();
      if (!s) return resp({ erro: 'Strava não conectado.' }, 404);
      let t = { access_token: s.acesso, refresh_token: s.renovacao, expires_at: Math.floor(new Date(s.expira_em).getTime() / 1000) };
      if (t.expires_at * 1000 < Date.now() + 5 * 60_000) { // token vencendo: renova
        const r = await fetch('https://www.strava.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: ID, client_secret: SEGREDO, refresh_token: s.renovacao, grant_type: 'refresh_token' }) });
        const n = await r.json().catch(() => ({}));
        if (!r.ok || !n.access_token) { await db.from('radar_strava').delete().eq('user_id', user.id); return resp({ erro: 'A conexão com o Strava venceu. Conecte de novo.', reconectar: true }, 401); }
        t = { access_token: n.access_token, refresh_token: n.refresh_token, expires_at: n.expires_at };
      }
      let dados; try { dados = await montarDados(t.access_token, Number(s.atleta_id)); } catch { return resp({ erro: 'O Strava não respondeu agora. Tente daqui a pouco.' }, 502); }
      await salvar(t, Number(s.atleta_id), dados);
      return resp({ ok: true, dados });
    }

    case 'desconectar': {
      const { data: s } = await db.from('radar_strava').select('acesso').eq('user_id', user.id).maybeSingle();
      if (s) await fetch('https://www.strava.com/oauth/deauthorize', { method: 'POST', headers: { Authorization: `Bearer ${s.acesso}` } }).catch(() => null);
      await db.from('radar_strava').delete().eq('user_id', user.id);
      return resp({ ok: true });
    }

    default: return resp({ erro: 'Ação desconhecida.' }, 400);
  }
});
