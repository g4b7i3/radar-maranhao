// Radar Pro · busca sozinho os resultados oficiais das provas que já aconteceram.
// Olha as listas de eventos das cronometragens (Racezone e Crono Esportes/Wiclax), casa por data + nome da prova,
// lê o resultado, grava e confere quem registrou. Pública, mas roda no máximo a cada 15 minutos.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { conferirRegistros, gravarOficiais, lerLink, listarEventos, parecenca } from '../_comum/resultados.ts';

const resp = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json' } });
const dias = (a: string, b: string) => Math.abs(new Date(a.slice(0, 10)).getTime() - new Date(b.slice(0, 10)).getTime()) / 86400_000;

Deno.serve(async req => {
  // ?teste=<link>: só lê e resume (para conferir um formato), não grava nada
  const teste = new URL(req.url).searchParams.get('teste');
  if (teste) {
    try {
      const l = await lerLink(teste);
      if (!l) return resp({ ok: false, erro: 'formato ou site não suportado' });
      const dist: Record<string, number> = {}; for (const x of l.linhas) dist[String(x.distancia_km)] = (dist[String(x.distancia_km)] ?? 0) + 1;
      return resp({ ok: true, evento: l.evento, data: l.data, fonte: l.fonte, linhas: l.linhas.length, distancias: dist, primeiros: l.linhas.filter(x => x.colocacao_geral === 1).map(x => ({ nome: x.nome, km: x.distancia_km, sexo: x.sexo, tempo_s: x.tempo_s })) });
    } catch (e) { return resp({ ok: false, erro: String((e as Error).message) }); }
  }
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: ult } = await db.from('radar_config').select('valor').eq('chave', 'coleta_resultados_em').maybeSingle();
  if (ult?.valor && Date.now() - new Date(ult.valor).getTime() < 15 * 60_000) return resp({ ok: true, pulou: 'rodou há pouco' });
  await db.from('radar_config').upsert({ chave: 'coleta_resultados_em', valor: new Date().toISOString() });

  const hoje = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  const desde = new Date(Date.now() - 60 * 86400_000).toISOString().slice(0, 10);
  const { data: provas } = await db.from('radar_provas').select('id, nome, data').is('link_resultado', null).gte('data', desde).lte('data', hoje).order('data', { ascending: false });
  if (!provas?.length) return resp({ ok: true, provas: 0 });

  const eventos = await listarEventos();
  const feitos: unknown[] = [];
  for (const p of provas.slice(0, 40)) {
    const cands = eventos.map(e => ({ e, s: parecenca(p.nome, e.nome) })).filter(x => dias(x.e.data, p.data) <= 1 && x.s >= 0.5).sort((a, b) => b.s - a.s);
    // empate entre eventos diferentes (ex.: duas etapas no mesmo fim de semana): não arrisca, fica para o link do atleta
    if (cands.length > 1 && cands[0].s === cands[1].s && cands[0].e.nome !== cands[1].e.nome) { feitos.push({ prova: p.id, empate: cands.slice(0, 2).map(c => c.e.nome) }); continue; }
    for (const { e, s } of cands.slice(0, 2)) {
      try {
        const lido = await lerLink(e.url);
        if (!lido?.linhas.length) continue;
        const n = await gravarOficiais(db, p.id, e.url, lido.linhas);
        feitos.push({ prova: p.id, evento: e.nome, url: e.url, parecenca: Math.round(s * 100) / 100, linhas: n, ...(await conferirRegistros(db, p.id)) });
        break;
      } catch (err) { feitos.push({ prova: p.id, url: e.url, erro: String((err as Error).message).slice(0, 120) }); }
    }
    if (feitos.length >= 6) break;
  }
  return resp({ ok: true, provas: provas.length, eventos: eventos.length, feitos });
});
