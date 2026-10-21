// Radar Pro · recebe da coleta (GitHub Actions) os resultados oficiais de uma prova.
// Protegida pela chave "chave_coleta" guardada em radar_config (o GitHub manda no cabeçalho x-radar-chave).
// Depois de gravar, confere quem já tinha registrado a prova (regras em _comum/resultados.ts).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { conferirRegistros, gravarOficiais, real, type Linha } from '../_comum/resultados.ts';

const resp = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json' } });
/** Medalhas: a conta fica na função radar-coletar-resultados (um lugar só para as regras). */
const medalhasDe = async (ids: string[]): Promise<Record<string, string[]>> => {
  try {
    const r = await fetch(Deno.env.get('SUPABASE_URL') + '/functions/v1/radar-coletar-resultados', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-radar-interno': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! }, body: JSON.stringify({ medalhas: ids }) });
    return (await r.json()).novas ?? {};
  } catch { return {}; }
};
const int = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : null);

Deno.serve(async req => {
  if (req.method !== 'POST') return resp({ erro: 'Método não aceito' }, 405);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: cfg } = await db.from('radar_config').select('valor').eq('chave', 'chave_coleta').maybeSingle();
  const chave = req.headers.get('x-radar-chave') ?? '';
  if (!cfg?.valor || chave.length < 20 || chave !== cfg.valor) return resp({ erro: 'Sem permissão' }, 401);

  let b: { prova_id?: string; fonte_url?: string; resultados?: Record<string, unknown>[] };
  try { b = await req.json(); } catch { return resp({ erro: 'Envio inválido' }, 400); }
  const prova = String(b.prova_id ?? '').slice(0, 120);
  const lista = Array.isArray(b.resultados) ? b.resultados.slice(0, 20000) : [];
  if (!prova || !lista.length) return resp({ erro: 'Faltou prova_id ou resultados' }, 400);

  const linhas: Linha[] = lista.map(r => ({
    distancia_km: Number(r.distancia_km) > 0 ? real(Number(r.distancia_km)) : null,
    nome: String(r.nome ?? '').trim(),
    peito: String(r.peito ?? '').replace(/\D/g, '') || null,
    tempo_s: int(r.tempo_s) ?? 0,
    sexo: r.sexo === 'F' || r.sexo === 'M' ? (r.sexo as 'F' | 'M') : null,
    faixa: r.faixa ? String(r.faixa) : null,
    colocacao_geral: int(r.colocacao_geral),
    colocacao_faixa: int(r.colocacao_faixa),
  })).filter(r => r.nome && r.tempo_s);
  try {
    const gravados = await gravarOficiais(db, prova, String(b.fonte_url ?? ''), linhas);
    const conf = await conferirRegistros(db, prova);
    const { data: quem } = await db.from('radar_resultados').select('user_id').eq('prova_id', prova);
    if (quem?.length) await medalhasDe([...new Set(quem.map(q => q.user_id))]);
    return resp({ ok: true, gravados, ...conf });
  } catch (e) { return resp({ erro: String((e as Error).message) }, 500); }
});
