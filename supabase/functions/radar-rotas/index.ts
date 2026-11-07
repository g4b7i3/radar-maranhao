// Radar · Mapas: traça uma rota a pé pelas ruas a partir dos pontos tocados no mapa.
// Com a chave do OpenRouteService (vault "ors_key"), vem também a subida e o tipo de piso.
// Sem ela, usa o roteador a pé público do OpenStreetMap (FOSSGIS), só com o caminho e a distância.
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-radar-interno', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

const UA = 'RadarCorridasMA/1.0 (+https://radarcorridasma.com.br)';
type P = [number, number]; // [lat, lng]

// nomes do OpenRouteService para o tipo de piso (extra_info "surface")
const PISO: Record<number, string> = { 0: 'nao_informado', 1: 'asfalto', 2: 'terra', 3: 'asfalto', 4: 'asfalto', 5: 'concreto', 6: 'paralelepipedo', 7: 'metal', 8: 'madeira', 9: 'cascalho', 10: 'cascalho', 11: 'terra', 12: 'terra', 13: 'terra', 14: 'paralelepipedo', 15: 'grama', 16: 'grama', 17: 'areia', 18: 'grama' };

function enxugar(g: P[], max = 1500): P[] { if (g.length <= max) return g; const passo = g.length / max; const out: P[] = []; for (let i = 0; i < g.length; i += passo) out.push(g[Math.floor(i)]); out.push(g[g.length - 1]); return out; }

async function chaveOrs(db: any): Promise<string | null> {
  const env = Deno.env.get('ORS_KEY'); if (env) return env;
  try { const { data } = await db.rpc('radar_segredo', { p: 'ors_key' }); return data || null; } catch { return null; }
}

async function porOrs(pts: P[], key: string) {
  const r = await fetch('https://api.openrouteservice.org/v2/directions/foot-walking/geojson', {
    method: 'POST', headers: { Authorization: key, 'Content-Type': 'application/json', Accept: 'application/geo+json', 'User-Agent': UA },
    body: JSON.stringify({ coordinates: pts.map(p => [p[1], p[0]]), elevation: true, extra_info: ['surface'], instructions: false }),
  });
  if (!r.ok) throw new Error('ors ' + r.status);
  const d = await r.json(); const f = d.features?.[0]; if (!f) throw new Error('ors vazio');
  const coords: number[][] = f.geometry.coordinates; const geom: P[] = coords.map(c => [+c[1].toFixed(6), +c[0].toFixed(6)]);
  const sum = f.properties?.summary ?? {}; const asc = f.properties?.ascent, desc = f.properties?.descent;
  // piso: soma das distâncias por tipo
  const piso: Record<string, number> = {};
  for (const s of f.properties?.extras?.surface?.summary ?? []) { const k = PISO[s.value] ?? 'nao_informado'; piso[k] = (piso[k] ?? 0) + s.amount; }
  const elev = coords.map(c => c[2]).filter(v => typeof v === 'number');
  return { geometria: geom, distancia_m: Math.round(sum.distance ?? 0), subida_m: asc != null ? Math.round(asc) : null, descida_m: desc != null ? Math.round(desc) : null,
    piso: Object.entries(piso).map(([tipo, pct]) => ({ tipo, pct: Math.round(pct * 10) / 10 })).sort((a, b) => b.pct - a.pct), elevacao: elev.length ? enxugar(elev.map((e, i) => [i, e]) as P[], 120).map(x => Math.round(x[1])) : null, fonte: 'ors' };
}

async function porOsm(pts: P[]) {
  const coords = pts.map(p => `${p[1]},${p[0]}`).join(';');
  const r = await fetch(`https://routing.openstreetmap.de/routed-foot/route/v1/foot/${coords}?overview=full&geometries=geojson&steps=false`, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error('osm ' + r.status);
  const d = await r.json(); const rt = d.routes?.[0]; if (!rt) throw new Error('osm vazio');
  const geom: P[] = rt.geometry.coordinates.map((c: number[]) => [+c[1].toFixed(6), +c[0].toFixed(6)]);
  return { geometria: geom, distancia_m: Math.round(rt.distance), subida_m: null, descida_m: null, piso: null, elevacao: null, fonte: 'osm' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const url = Deno.env.get('SUPABASE_URL')!, db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const xi = req.headers.get('x-radar-interno');
    const interno = !!xi && (xi === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || xi === Deno.env.get('RADAR_INTERNO'));
    if (!interno) { // só quem está logado no Radar
      const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '');
      const { data } = await db.auth.getUser(jwt); if (!data?.user) return json({ erro: 'Faça login' }, 401);
    }
    const body = await req.json().catch(() => ({}));
    const pts: P[] = (Array.isArray(body.pontos) ? body.pontos : []).map((p: any) => [Number(p[0]), Number(p[1])] as P)
      .filter((p: P) => Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180);
    if (pts.length < 2) return json({ erro: 'Marque pelo menos dois pontos no mapa' }, 400);
    if (pts.length > 40) return json({ erro: 'No máximo 40 pontos por rota' }, 400);
    const key = await chaveOrs(db);
    let r: any = null;
    if (key) { try { r = await porOrs(pts, key); } catch (e) { console.log('ors falhou', String(e)); } }
    if (!r) r = await porOsm(pts);
    if (r.distancia_m > 150000) return json({ erro: 'Rota longa demais (máximo 150 km)' }, 400);
    r.geometria = enxugar(r.geometria);
    return json(r);
  } catch (e) {
    console.log('erro', String(e));
    return json({ erro: 'Não deu pra traçar a rota agora. Tente de novo em instantes.' }, 502);
  }
});
