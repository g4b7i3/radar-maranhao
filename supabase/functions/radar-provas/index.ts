// Radar Pro · arquivo de provas. A agenda (radar.json) tira as provas antigas;
// aqui elas ficam guardadas para o atleta poder registrar "Eu corri!" depois.
// GET: sincroniza com o radar.json do site e devolve as provas dos últimos 12 meses que já aconteceram.
// É pública (só dados da agenda). A coleta do GitHub também chama a cada rodada.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };
const SITE = 'https://radarcorridasma.com.br';
let ultimaSync = 0;

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  if (Date.now() - ultimaSync > 10 * 60_000) { // no máximo a cada 10 min por instância
    const agenda = await fetch(SITE + '/data/radar.json', { headers: { 'Cache-Control': 'no-cache' } }).then(r => r.json()).catch(() => null);
    const linhas = (agenda?.events ?? []).filter((e: any) => e?.id && /^\d{4}-\d{2}-\d{2}/.test(e.date ?? '') && !/cancel/i.test(e.status ?? ''))
      .map((e: any) => ({ id: e.id, nome: e.name, data: e.date.slice(0, 10), cidade: e.city, distancias: (e.distances ?? []).filter((d: unknown) => typeof d === 'number' && d > 0), largada: e.start ?? null, atualizado_em: new Date().toISOString() }));
    if (linhas.length) { await db.from('radar_provas').upsert(linhas); ultimaSync = Date.now(); }
  }
  const hoje = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  const desde = new Date(Date.now() - 400 * 86400_000).toISOString().slice(0, 10);
  const { data } = await db.from('radar_provas').select('id, nome, data, cidade, distancias, largada').lte('data', hoje).gte('data', desde).order('data', { ascending: false }).limit(500);
  return new Response(JSON.stringify({ provas: data ?? [] }), { headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' } });
});
