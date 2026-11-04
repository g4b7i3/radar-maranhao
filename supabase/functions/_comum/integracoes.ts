// Radar · peças comuns das integrações (Garmin e Intervals.icu). Tudo do Radar: nada da Nexos.
// deno-lint-ignore-file no-explicit-any
export const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
export const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
export const pagina = (titulo: string, msg: string) => new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title><body style="font-family:system-ui;padding:32px;max-width:520px;margin:auto;color:#0a1240"><h2>${titulo}</h2><p>${msg}</p></body>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
export const SITE = 'https://radarcorridasma.com.br';
export const ADMIN = 'vinikautor@gmail.com';
export const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** "Em breve": enquanto a chave radar_config.integracoes_liberadas não for "true", só o admin conecta. */
export async function liberado(db: any, email?: string | null) {
  if (email === ADMIN) return true;
  const { data } = await db.from('radar_config').select('valor').eq('chave', 'integracoes_liberadas').maybeSingle();
  return String(data?.valor) === 'true';
}

export const TIPO = (t: string) => {
  t = String(t || '').toUpperCase();
  if (/TRAIL/.test(t)) return 'trail';
  if (/TREADMILL|INDOOR_RUN|VIRTUAL_?RUN/.test(t)) return 'esteira';
  if (/RUN/.test(t)) return 'corrida';
  if (/WALK|HIK/.test(t)) return 'caminhada';
  return t ? 'outro' : null;
};
const durTxt = (s: number) => { const m = Math.round(s / 60); return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m} min`; };

/** Avisa o atleta no sininho (e no celular) que a corrida chegou. */
export async function avisarCorrida(db: any, userId: string, origem: string, a: { id: string; distancia_m: number; duracao_s: number }) {
  const km = (a.distancia_m / 1000).toFixed(1).replace('.', ',');
  await db.from('radar_avisos').insert({ user_id: userId, tipo: 'novidade', titulo: `Sua corrida chegou do ${origem}`, corpo: `${km} km em ${durTxt(a.duracao_s)}. Toque pra ver.`, url: `${SITE}/?pro#temporada`, chave: `ativ:${a.id}` }).then(() => null, () => null);
  await fetch(Deno.env.get('SUPABASE_URL') + '/functions/v1/radar-avisar', { method: 'POST', headers: { 'x-radar-interno': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, 'Content-Type': 'application/json' }, body: '{}' }).catch(() => null);
}

/** Parciais por km e percurso (até 400 pontos) a partir de amostras { d (m), t (s), fc, lat, lon }. */
export function parciaisERota(pts: { d: number | null; t: number; fc?: number | null; lat?: number | null; lon?: number | null }[]) {
  const ok = pts.filter((p) => p.d != null && p.t != null) as { d: number; t: number; fc?: number | null }[];
  const parciais: Record<string, unknown>[] = [];
  let km = 1, ini = { d: 0, t: 0 }, fcs: number[] = [];
  for (const p of ok) {
    if (p.fc) fcs.push(p.fc);
    if (p.d >= km * 1000) { parciais.push({ km, seg: Math.round(p.t - ini.t), fc: fcs.length ? Math.round(fcs.reduce((a, b) => a + b, 0) / fcs.length) : null }); ini = p; fcs = []; km++; }
  }
  const ult = ok[ok.length - 1];
  if (ult && ult.d - ini.d > 150) parciais.push({ km: +((km - 1) + (ult.d - ini.d) / 1000).toFixed(2), seg: Math.round(ult.t - ini.t), fc: fcs.length ? Math.round(fcs.reduce((a, b) => a + b, 0) / fcs.length) : null, parcial: true });
  const gps = pts.filter((p) => p.lat != null && p.lon != null).map((p) => [+Number(p.lat).toFixed(5), +Number(p.lon).toFixed(5)]);
  const passo = Math.max(1, Math.ceil(gps.length / 400));
  const rota = gps.filter((_, i) => i % passo === 0 || i === gps.length - 1);
  return { parciais: parciais.length ? parciais : null, rota: rota.length > 1 ? rota : null };
}
