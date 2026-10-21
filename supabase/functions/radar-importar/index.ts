// Radar Pro · recebe da coleta (GitHub Actions) os resultados oficiais de uma prova.
// Protegida pela chave "chave_coleta" guardada em radar_config (o GitHub manda no cabeçalho x-radar-chave).
// Depois de gravar, confere quem já tinha registrado a prova no Radar Pro:
//   tempo bate com o oficial (±5 s) → "verificado"; tempo diferente → "em análise"; número de peito de outra pessoa → "recusado".
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const resp = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json' } });
const norm = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const real = (k: number) => (Math.abs(k - 21) < 0.2 ? 21.0975 : Math.abs(k - 42) < 0.3 ? 42.195 : k);
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

  const linhas = lista.map(r => ({
    prova_id: prova,
    distancia_km: Number(r.distancia_km) > 0 ? real(Number(r.distancia_km)) : null,
    nome: String(r.nome ?? '').trim().slice(0, 120),
    nome_norm: norm(String(r.nome ?? '')),
    peito: String(r.peito ?? '').replace(/\D/g, '').slice(0, 8) || null,
    tempo_s: int(r.tempo_s),
    sexo: ['F', 'M'].includes(String(r.sexo)) ? String(r.sexo) : null,
    faixa: r.faixa ? String(r.faixa).slice(0, 30) : null,
    colocacao_geral: int(r.colocacao_geral),
    colocacao_faixa: int(r.colocacao_faixa),
    fonte_url: b.fonte_url ? String(b.fonte_url).slice(0, 400) : null,
  })).filter(r => r.nome_norm && r.tempo_s);

  // troca o que já havia dessa prova (a cronometragem pode corrigir a lista)
  await db.from('radar_resultados_oficiais').delete().eq('prova_id', prova);
  for (let i = 0; i < linhas.length; i += 1000) {
    const { error } = await db.from('radar_resultados_oficiais').insert(linhas.slice(i, i + 1000));
    if (error) return resp({ erro: error.message }, 500);
  }

  // confere quem registrou essa prova antes do resultado sair
  const { data: regs } = await db.from('radar_resultados').select('id, user_id, distancia_km, tempo_s, peito_declarado, nome_inscricao, status, pontos, detalhes_pontos').eq('prova_id', prova).in('status', ['declarado', 'em_analise']);
  const batem = (a: string, c: string) => { const x = a.split(' '), y = c.split(' '); return x[0] === y[0] && (x[x.length - 1] === y[y.length - 1] || a.includes(c) || c.includes(a)); };
  let verificados = 0, divergentes = 0, recusados = 0;
  if (regs?.length) {
    const { data: perfis } = await db.from('radar_perfis').select('user_id, nome_completo').in('user_id', regs.map(r => r.user_id));
    const nomes = new Map((perfis ?? []).map(p => [p.user_id, norm(p.nome_completo)]));
    for (const r of regs) {
      const perfil = nomes.get(r.user_id) ?? '';
      const nm = r.nome_inscricao ? norm(r.nome_inscricao) : perfil;
      const outroNome = !!r.nome_inscricao && nm !== perfil;
      const naDist = linhas.filter(o => o.distancia_km == null || Math.abs(o.distancia_km - Number(r.distancia_km)) < 0.2);
      const dono = r.peito_declarado ? naDist.find(o => o.peito === r.peito_declarado) : null;
      if (dono && !batem(dono.nome_norm, perfil)) { // o número é de outra pessoa (vale o nome do perfil, não o digitado)
        await db.from('radar_resultados').update({ status: 'recusado', motivo_analise: 'O número de peito pertence a outro atleta no resultado oficial.' }).eq('id', r.id);
        await db.from('radar_medalhas').delete().eq('resultado_id', r.id);
        recusados++; continue;
      }
      const porNome = naDist.filter(o => o.nome_norm === nm);
      const of = dono ?? (porNome.length === 1 ? porNome[0] : null);
      if (!of) continue;
      if (outroNome) { await db.from('radar_resultados').update({ status: 'em_analise', motivo_analise: 'Achado no resultado oficial com nome diferente do perfil: conferir.' }).eq('id', r.id); divergentes++; continue; }
      const podio = (of.colocacao_geral ?? 99) <= 3 || (of.colocacao_faixa ?? 99) <= 3;
      if (Math.abs(of.tempo_s! - r.tempo_s) <= 5) {
        const det = { ...(r.detalhes_pontos ?? {}) } as Record<string, number>;
        if (podio && !det.podio) det.podio = 10;
        const pontos = Object.values(det).reduce((a, x) => a + Number(x), 0);
        const { error } = await db.from('radar_resultados').update({ status: 'verificado', motivo_analise: null, podio, detalhes_pontos: det, pontos, peito: of.peito ?? r.peito_declarado }).eq('id', r.id);
        if (error) { await db.from('radar_resultados').update({ status: 'em_analise', motivo_analise: 'Peito já confirmado para outro atleta: conferir.' }).eq('id', r.id); divergentes++; }
        else verificados++;
      } else {
        await db.from('radar_resultados').update({ status: 'em_analise', motivo_analise: `Tempo diferente do resultado oficial (${of.tempo_s} s).` }).eq('id', r.id);
        divergentes++;
      }
    }
  }
  return resp({ ok: true, gravados: linhas.length, verificados, divergentes, recusados });
});
