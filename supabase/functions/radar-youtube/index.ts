// Radar Pro · busca do YouTube dentro da aba Assista.
// Usa a API oficial do YouTube (segredo YOUTUBE_API_KEY). Só traz vídeos que o dono deixa tocar fora do YouTube
// (videoEmbeddable) e com filtro de conteúdo. Cada pesquisa fica guardada 3 dias para economizar a cota diária.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const resp = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const dec = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const chave = Deno.env.get('YOUTUBE_API_KEY');
  if (!chave) return resp({ desligado: true });
  const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: { user } } = await anon.auth.getUser();
  if (!user) return resp({ erro: 'Faça login de novo.' }, 401);
  const corpo = await req.json().catch(() => ({}));
  const q = String(corpo?.q ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const longo = !!corpo?.longo; // só filmes (mais de 20 min)
  if (q.length < 2) return resp({ itens: [] });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const k = (longo ? 'L:' : 'T:') + q.toLowerCase();
  const { data: cache } = await db.rpc('radar_yt_cache_get', { p_q: k });
  if (cache) return resp({ itens: cache, cache: true });
  const u = new URL('https://www.googleapis.com/youtube/v3/search');
  const p: Record<string, string> = { part: 'snippet', type: 'video', videoEmbeddable: 'true', safeSearch: 'moderate', regionCode: 'BR', relevanceLanguage: 'pt', maxResults: '24', q, key: chave };
  if (longo) p.videoDuration = 'long';
  for (const [a, b] of Object.entries(p)) u.searchParams.set(a, b);
  const r = await fetch(u).then(x => x.json()).catch(() => null);
  if (!r || r.error) {
    const motivo = r?.error?.errors?.[0]?.reason ?? '';
    return resp({ erro: motivo === 'quotaExceeded' ? 'A busca atingiu o limite de hoje. Volta amanhã ou use os destaques.' : 'A busca do YouTube não respondeu agora.' });
  }
  // deno-lint-ignore no-explicit-any
  const itens = (r.items ?? []).filter((x: any) => x?.id?.videoId).map((x: any) => ({ id: x.id.videoId, t: dec(x.snippet?.title ?? ''), canal: dec(x.snippet?.channelTitle ?? ''), aoVivo: x.snippet?.liveBroadcastContent === 'live' }));
  await db.rpc('radar_yt_cache_set', { p_q: k, p_dados: itens });
  return resp({ itens });
});
