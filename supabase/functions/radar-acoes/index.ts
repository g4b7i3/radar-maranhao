// Radar Pro · ações do atleta e do administrador (uma função só, para gastar menos).
// Atleta: duelo_criar, duelo_aceitar, contestar, exportar, apagar_conta.
// Admin (só o e-mail do Vinik): admin_pendentes, admin_decidir, admin_contestacao, admin_liberar.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const resp = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const ADMIN = 'vinikautor@gmail.com';
const DISTS = [5, 10, 21.0975, 42.195];
const mesAtual = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 7) + '-01';

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return resp({ erro: 'Método não aceito' }, 405);
  const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: { user } } = await anon.auth.getUser();
  if (!user) return resp({ erro: 'Faça login de novo.' }, 401);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  let b: Record<string, any>;
  try { b = await req.json(); } catch { return resp({ erro: 'Envio inválido.' }, 400); }

  const assinante = async () => {
    const { data } = await db.from('radar_assinaturas').select('valida_ate').eq('user_id', user.id).maybeSingle();
    return !!data?.valida_ate && new Date(data.valida_ate) > new Date();
  };

  switch (b.acao) {
    // ───────── Duelo: crio o desafio e mando o link para o amigo
    case 'duelo_criar': {
      if (!(await assinante())) return resp({ erro: 'Duelo é do Radar Pro.' }, 402);
      const km = DISTS.find(d => Math.abs(d - Number(b.distancia_km)) < 0.3);
      if (!km) return resp({ erro: 'Escolha 5 km, 10 km, 21 km ou 42 km.' }, 400);
      const { count } = await db.from('radar_duelos').select('id', { count: 'exact', head: true }).eq('desafiante', user.id).eq('mes', mesAtual());
      if ((count ?? 0) >= 20) return resp({ erro: 'Limite de 20 duelos por mês.' }, 429);
      const { data, error } = await db.from('radar_duelos').insert({ desafiante: user.id, distancia_km: km, mes: mesAtual() }).select('id, convite, distancia_km, mes').single();
      if (error) return resp({ erro: 'Não deu para criar o duelo.' }, 400);
      return resp({ duelo: data, link: `https://radarcorridasma.com.br/?pro=duelo&c=${data.convite}` });
    }
    // ───────── Duelo: o amigo aceita pelo link
    case 'duelo_aceitar': {
      const convite = String(b.convite ?? '').replace(/[^a-f0-9]/g, '').slice(0, 12);
      const { data: d } = await db.from('radar_duelos').select('*').eq('convite', convite).maybeSingle();
      if (!d) return resp({ erro: 'Convite não encontrado.' }, 404);
      if (d.desafiante === user.id) return resp({ erro: 'Esse é o seu próprio convite. Mande o link para um amigo.' }, 400);
      if (d.desafiado && d.desafiado !== user.id) return resp({ erro: 'Esse duelo já foi aceito por outra pessoa.' }, 409);
      if (!(await assinante())) return resp({ erro: 'Para duelar você precisa do Radar Pro.', precisa_assinar: true }, 402);
      const { data: perfil } = await db.from('radar_perfis').select('user_id').eq('user_id', user.id).maybeSingle();
      if (!perfil) return resp({ erro: 'Complete seu perfil antes.', precisa_perfil: true }, 400);
      if (!d.desafiado) await db.from('radar_duelos').update({ desafiado: user.id, aceito_em: new Date().toISOString() }).eq('id', d.id);
      return resp({ ok: true, duelo_id: d.id });
    }
    // ───────── Contestar um resultado do ranking
    case 'contestar': {
      if (!(await assinante())) return resp({ erro: 'Contestar é do Radar Pro.' }, 402);
      const motivo = String(b.motivo ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);
      if (motivo.length < 10) return resp({ erro: 'Explique o motivo em poucas palavras.' }, 400);
      const { data: r } = await db.from('radar_resultados').select('id, user_id').eq('id', b.resultado_id).maybeSingle();
      if (!r) return resp({ erro: 'Resultado não encontrado.' }, 404);
      if (r.user_id === user.id) return resp({ erro: 'Não dá para contestar o próprio resultado.' }, 400);
      const { count } = await db.from('radar_contestacoes').select('id', { count: 'exact', head: true }).eq('autor_id', user.id).gte('criado_em', new Date(Date.now() - 86400_000).toISOString());
      if ((count ?? 0) >= 5) return resp({ erro: 'Limite de 5 contestações por dia.' }, 429);
      const { data: c, error } = await db.from('radar_contestacoes').insert({ resultado_id: r.id, autor_id: user.id, motivo }).select('id').single();
      if (error) return resp({ erro: 'Não deu para enviar.' }, 400);
      return resp({ ok: true, protocolo: c.id.slice(0, 8) });
    }
    // ───────── LGPD: baixar meus dados
    case 'exportar': {
      const tabelas = ['radar_perfis', 'radar_assinaturas', 'radar_pagamentos', 'radar_resultados', 'radar_medalhas'];
      const dados: Record<string, unknown> = { conta: { email: user.email, criada_em: user.created_at } };
      for (const t of tabelas) dados[t.replace('radar_', '')] = (await db.from(t).select('*').eq('user_id', user.id)).data;
      dados.duelos = (await db.from('radar_duelos').select('*').or(`desafiante.eq.${user.id},desafiado.eq.${user.id}`)).data;
      dados.contestacoes_feitas = (await db.from('radar_contestacoes').select('*').eq('autor_id', user.id)).data;
      return resp(dados);
    }
    // ───────── LGPD: apagar minha conta (tudo some junto, em cascata)
    case 'apagar_conta': {
      if (b.confirmo !== 'APAGAR') return resp({ erro: 'Digite APAGAR para confirmar.' }, 400);
      await db.from('radar_duelos').delete().or(`desafiante.eq.${user.id},desafiado.eq.${user.id}`);
      const { error } = await db.auth.admin.deleteUser(user.id);
      if (error) return resp({ erro: 'Não deu para apagar agora. Fale com o Radar pelo WhatsApp.' }, 500);
      return resp({ ok: true });
    }
  }

  // ───────── Daqui para baixo, só o administrador
  if (user.email !== ADMIN) return resp({ erro: 'Sem permissão.' }, 403);
  switch (b.acao) {
    case 'admin_pendentes': {
      const { data: res } = await db.from('radar_resultados').select('*').eq('status', 'em_analise').order('criado_em').limit(100);
      const { data: cont } = await db.from('radar_contestacoes').select('*, radar_resultados(*)').eq('status', 'aberta').order('criado_em').limit(100);
      const ids = [...new Set([...(res ?? []).map(r => r.user_id), ...(cont ?? []).flatMap(c => [c.autor_id, c.radar_resultados?.user_id])].filter(Boolean))];
      const { data: perfis } = ids.length ? await db.from('radar_perfis').select('user_id, apelido, nome_completo, cidade, whatsapp').in('user_id', ids) : { data: [] };
      return resp({ resultados: res ?? [], contestacoes: cont ?? [], perfis: perfis ?? [] });
    }
    case 'admin_decidir': { // aprova ou recusa um resultado em análise (ou qualquer um, após contestação)
      const st = b.decisao === 'aprovar' ? 'aprovado' : b.decisao === 'recusar' ? 'recusado' : null;
      if (!st) return resp({ erro: 'Decisão inválida.' }, 400);
      const { error } = await db.from('radar_resultados').update({ status: st, motivo_analise: String(b.obs ?? '').slice(0, 300) || null }).eq('id', b.resultado_id);
      if (error) return resp({ erro: error.message }, 400);
      if (st === 'recusado') await db.from('radar_medalhas').delete().eq('resultado_id', b.resultado_id);
      await db.from('radar_contestacoes').update({ status: st === 'recusado' ? 'procedente' : 'improcedente' }).eq('resultado_id', b.resultado_id).eq('status', 'aberta');
      return resp({ ok: true });
    }
    case 'admin_contestacao': { // encerra uma contestação sem mexer no resultado
      await db.from('radar_contestacoes').update({ status: 'improcedente' }).eq('id', b.contestacao_id);
      return resp({ ok: true });
    }
    case 'admin_liberar': { // libera dias de Pro na mão (pagamento por fora, cortesia, patrocinador)
      const dias = Math.min(400, Math.max(1, Number(b.dias) || 30));
      const { data: p } = await db.from('radar_perfis').select('user_id').eq('apelido', String(b.apelido ?? '').toLowerCase()).maybeSingle();
      if (!p) return resp({ erro: 'Apelido não encontrado.' }, 404);
      const { data: a } = await db.from('radar_assinaturas').select('valida_ate').eq('user_id', p.user_id).maybeSingle();
      const base = a?.valida_ate && new Date(a.valida_ate) > new Date() ? new Date(a.valida_ate) : new Date();
      const ate = new Date(base.getTime() + dias * 86400_000).toISOString();
      await db.from('radar_assinaturas').upsert({ user_id: p.user_id, valida_ate: ate, atualizado_em: new Date().toISOString() });
      return resp({ ok: true, valida_ate: ate });
    }
  }
  return resp({ erro: 'Ação desconhecida.' }, 400);
});
