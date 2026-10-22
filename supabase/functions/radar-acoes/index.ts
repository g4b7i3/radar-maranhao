// Radar Pro · ações do atleta e do administrador (uma função só, para gastar menos).
// Atleta: duelo_criar, duelo_aceitar, contestar, prova_sugerir, cortesia_resgatar, exportar, apagar_conta.
// Admin (só o e-mail do Vinik): admin_pendentes, admin_decidir, admin_contestacao, admin_liberar, admin_prova, admin_cortesia_criar, admin_cortesia_revogar, admin_usuarios, admin_usuario.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const resp = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const ADMIN = 'vinikautor@gmail.com';
const DISTS = [5, 10, 21.0975, 42.195];
/** Medalhas: a conta fica na função radar-coletar-resultados (um lugar só para as regras). */
const medalhasDe = async (ids: string[]): Promise<Record<string, string[]>> => {
  try {
    const r = await fetch(Deno.env.get('SUPABASE_URL') + '/functions/v1/radar-coletar-resultados', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-radar-interno': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! }, body: JSON.stringify({ medalhas: ids }) });
    return (await r.json()).novas ?? {};
  } catch { return {}; }
};
const INICIO_TEMPORADA = '2026-10-15';
const hojeBR = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const limpa = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
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

  const assinante = async () => { // pago, cortesia ou liberado pela equipe (plano assessoria)
    const { data } = await db.rpc('radar_eh_assinante', { uid: user.id });
    return !!data;
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
    // ───────── Prova que não está na agenda: o atleta pede e o Vinik aprova
    case 'prova_sugerir': {
      if (!(await assinante())) return resp({ erro: 'Pedir prova é do Radar Pro.' }, 402);
      const nome = limpa(b.nome, 120), cidade = limpa(b.cidade, 60), data = String(b.data ?? '').slice(0, 10);
      const km = Number(b.distancia_km), link = limpa(b.link, 500), obs = limpa(b.obs, 300);
      if (nome.length < 5) return resp({ erro: 'Escreva o nome da prova.' }, 400);
      if (cidade.length < 3) return resp({ erro: 'Diga a cidade da prova.' }, 400);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return resp({ erro: 'Data inválida.' }, 400);
      if (data < INICIO_TEMPORADA) return resp({ erro: 'A temporada 2026 conta só as provas a partir de 15/10/2026.' }, 400);
      if (data > hojeBR()) return resp({ erro: 'A prova ainda não aconteceu. Peça depois do dia da prova.' }, 400);
      if (!(km >= 1 && km <= 250)) return resp({ erro: 'Distância inválida.' }, 400);
      if (link && !/^https?:\/\/\S+\.\S+/.test(link)) return resp({ erro: 'O link do resultado precisa começar com http.' }, 400);
      const { count } = await db.from('radar_sugestoes_provas').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'pendente');
      if ((count ?? 0) >= 5) return resp({ erro: 'Você já tem 5 pedidos esperando. Aguarde a resposta do Radar.' }, 429);
      const { data: s, error } = await db.from('radar_sugestoes_provas').insert({ user_id: user.id, nome, cidade, data, distancia_km: km, link: link || null, obs: obs || null }).select('*').single();
      if (error) return resp({ erro: 'Não deu para enviar agora.' }, 400);
      return resp({ ok: true, sugestao: s });
    }
    // ───────── Cortesia: link pessoal que libera o Radar Pro sem prazo (até o Vinik revogar)
    case 'cortesia_resgatar': {
      const codigo = String(b.codigo ?? '').replace(/[^a-z0-9]/gi, '').slice(0, 20).toLowerCase();
      const { data: c } = await db.from('radar_cortesias').select('*').eq('codigo', codigo).maybeSingle();
      if (!c || c.revogado_em) return resp({ erro: 'Esse link de cortesia não vale mais.' }, 404);
      if (c.user_id && c.user_id !== user.id) return resp({ erro: 'Esse link de cortesia já foi usado por outra conta.' }, 409);
      if (!c.user_id) await db.from('radar_cortesias').update({ user_id: user.id, usado_em: new Date().toISOString() }).eq('codigo', codigo).is('user_id', null);
      const { data: dono } = await db.from('radar_cortesias').select('user_id').eq('codigo', codigo).maybeSingle();
      if (dono?.user_id !== user.id) return resp({ erro: 'Esse link de cortesia já foi usado por outra conta.' }, 409);
      // com prazo: soma os dias ao que a pessoa já tem; sem prazo: vitalícia (até o Vinik revogar)
      let ate = '2099-12-31T23:59:59Z';
      if (c.dias) {
        const { data: a } = await db.from('radar_assinaturas').select('valida_ate').eq('user_id', user.id).maybeSingle();
        const base = a?.valida_ate && new Date(a.valida_ate) > new Date() && new Date(a.valida_ate).getFullYear() < 2090 ? new Date(a.valida_ate) : new Date();
        ate = new Date(base.getTime() + c.dias * 86400_000).toISOString();
      }
      await db.from('radar_assinaturas').upsert({ user_id: user.id, valida_ate: ate, atualizado_em: new Date().toISOString() });
      return resp({ ok: true, nome: c.nome, dias: c.dias ?? null });
    }
    // ───────── LGPD: baixar meus dados
    case 'exportar': {
      const tabelas = ['radar_perfis', 'radar_assinaturas', 'radar_pagamentos', 'radar_resultados', 'radar_medalhas'];
      const dados: Record<string, unknown> = { conta: { email: user.email, criada_em: user.created_at } };
      for (const t of tabelas) dados[t.replace('radar_', '')] = (await db.from(t).select('*').eq('user_id', user.id)).data;
      dados.duelos = (await db.from('radar_duelos').select('*').or(`desafiante.eq.${user.id},desafiado.eq.${user.id}`)).data;
      dados.provas_pedidas = (await db.from('radar_sugestoes_provas').select('*').eq('user_id', user.id)).data;
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
      const { data: sug } = await db.from('radar_sugestoes_provas').select('*').eq('status', 'pendente').order('criado_em').limit(100);
      const dias = [...new Set((sug ?? []).map(x => x.data))];
      const { data: mesmoDia } = dias.length ? await db.from('radar_provas').select('id, nome, data, cidade, distancias').in('data', dias) : { data: [] };
      const ids = [...new Set([...(res ?? []).map(r => r.user_id), ...(sug ?? []).map(x => x.user_id), ...(cont ?? []).flatMap(c => [c.autor_id, c.radar_resultados?.user_id])].filter(Boolean))];
      const { data: perfis } = ids.length ? await db.from('radar_perfis').select('user_id, apelido, nome_completo, cidade, whatsapp').in('user_id', ids) : { data: [] };
      const { data: cort } = await db.from('radar_cortesias').select('codigo, nome, user_id, usado_em, dias').is('revogado_em', null).order('criado_em');
      const idsC = (cort ?? []).map(c => c.user_id).filter(Boolean);
      const { data: apC } = idsC.length ? await db.from('radar_perfis').select('user_id, apelido').in('user_id', idsC) : { data: [] };
      const cortesias = (cort ?? []).map(c => ({ ...c, apelido: (apC ?? []).find(x => x.user_id === c.user_id)?.apelido ?? null }));
      return resp({ resultados: res ?? [], contestacoes: cont ?? [], perfis: perfis ?? [], sugestoes: sug ?? [], provas_mesmo_dia: mesmoDia ?? [], cortesias });
    }
    case 'admin_decidir': { // aprova ou recusa um resultado em análise (ou qualquer um, após contestação)
      const st = b.decisao === 'aprovar' ? 'aprovado' : b.decisao === 'recusar' ? 'recusado' : null;
      if (!st) return resp({ erro: 'Decisão inválida.' }, 400);
      const { error } = await db.from('radar_resultados').update({ status: st, motivo_analise: String(b.obs ?? '').slice(0, 300) || null }).eq('id', b.resultado_id);
      if (error) return resp({ erro: error.message }, 400);
      if (st === 'recusado') await db.from('radar_medalhas').delete().eq('resultado_id', b.resultado_id);
      await db.from('radar_contestacoes').update({ status: st === 'recusado' ? 'procedente' : 'improcedente' }).eq('resultado_id', b.resultado_id).eq('status', 'aberta');
      if (st === 'aprovado') { const { data: r } = await db.from('radar_resultados').select('user_id').eq('id', b.resultado_id).maybeSingle(); if (r) await medalhasDe([r.user_id]); }
      return resp({ ok: true });
    }
    case 'admin_contestacao': { // encerra uma contestação sem mexer no resultado
      await db.from('radar_contestacoes').update({ status: 'improcedente' }).eq('id', b.contestacao_id);
      return resp({ ok: true });
    }
    case 'admin_prova': { // aprova (cria a prova ou junta com uma que já existe) ou recusa o pedido de prova
      const { data: sg } = await db.from('radar_sugestoes_provas').select('*').eq('id', String(b.sugestao_id ?? '')).maybeSingle();
      if (!sg) return resp({ erro: 'Pedido não encontrado.' }, 404);
      if (sg.status !== 'pendente') return resp({ erro: 'Esse pedido já foi respondido.' }, 409);
      if (b.decisao === 'recusar') {
        await db.from('radar_sugestoes_provas').update({ status: 'recusada', resposta: limpa(b.resposta, 300) || null, decidido_em: new Date().toISOString() }).eq('id', sg.id);
        return resp({ ok: true });
      }
      if (b.decisao !== 'aprovar') return resp({ erro: 'Decisão inválida.' }, 400);
      const dists = String(b.distancias ?? '').split(/[;,\s]+/).map(x => Number(x.replace(',', '.'))).filter(x => x > 0 && x <= 250);
      const kmS = Number(sg.distancia_km);
      let provaId = limpa(b.prova_id, 80);
      if (provaId) { // a prova já existe (outra pessoa pediu ou entrou na agenda): só garante a distância
        const { data: pv } = await db.from('radar_provas').select('id, distancias').eq('id', provaId).maybeSingle();
        if (!pv) return resp({ erro: 'Prova não encontrada.' }, 404);
        const todas = [...new Set([...(pv.distancias ?? []).map(Number), ...dists, kmS])].sort((x, y) => x - y);
        await db.from('radar_provas').update({ distancias: todas, atualizado_em: new Date().toISOString() }).eq('id', pv.id);
      } else {
        provaId = 'pro-' + crypto.randomUUID().slice(0, 8);
        const todas = [...new Set([...dists, kmS])].sort((x, y) => x - y);
        const { error } = await db.from('radar_provas').insert({ id: provaId, nome: limpa(b.nome, 120) || sg.nome, data: sg.data, cidade: limpa(b.cidade, 60) || sg.cidade, uf: sg.uf ?? 'MA', distancias: todas, modalidade: 'corrida' });
        if (error) return resp({ erro: error.message }, 400);
      }
      await db.from('radar_sugestoes_provas').update({ status: 'aprovada', prova_id: provaId, resposta: limpa(b.resposta, 300) || null, decidido_em: new Date().toISOString() }).eq('id', sg.id);
      return resp({ ok: true, prova_id: provaId });
    }
    case 'admin_usuarios': { // todos os atletas, com e-mail, assinatura e quantas provas têm
      const { data: perfis } = await db.from('radar_perfis').select('user_id, apelido, nome_completo, cidade, assessoria, sexo, nascimento, whatsapp, criado_em').order('criado_em', { ascending: false });
      const { data: ass } = await db.from('radar_assinaturas').select('user_id, valida_ate');
      const { data: res } = await db.from('radar_resultados').select('user_id, status');
      const { data: cort } = await db.from('radar_cortesias').select('user_id').is('revogado_em', null);
      const emails = new Map<string, string>();
      for (let pg = 1; pg <= 20; pg++) {
        const { data } = await db.auth.admin.listUsers({ page: pg, perPage: 1000 });
        for (const u of data?.users ?? []) emails.set(u.id, u.email ?? '');
        if (!data?.users?.length || data.users.length < 1000) break;
      }
      const lista = (perfis ?? []).map(p => {
        const r = (res ?? []).filter(x => x.user_id === p.user_id);
        return { ...p, email: emails.get(p.user_id) ?? null, valida_ate: (ass ?? []).find(a => a.user_id === p.user_id)?.valida_ate ?? null,
          cortesia: (cort ?? []).some(c => c.user_id === p.user_id), provas: r.length, oficiais: r.filter(x => ['verificado', 'aprovado'].includes(x.status)).length };
      });
      return resp({ usuarios: lista, total_contas: emails.size });
    }
    case 'admin_usuario': { // a área de um atleta: perfil, provas, medalhas, pagamentos e pedidos
      const uid = String(b.user_id ?? '');
      if (!/^[0-9a-f-]{36}$/.test(uid)) return resp({ erro: 'Atleta inválido.' }, 400);
      const { data: perfil } = await db.from('radar_perfis').select('*').eq('user_id', uid).maybeSingle();
      if (!perfil) return resp({ erro: 'Atleta não encontrado.' }, 404);
      const { data: u } = await db.auth.admin.getUserById(uid);
      const [ass, res, med, pag, sug, due] = await Promise.all([
        db.from('radar_assinaturas').select('valida_ate').eq('user_id', uid).maybeSingle(),
        db.from('radar_resultados').select('*').eq('user_id', uid).order('prova_data', { ascending: false }),
        db.from('radar_medalhas').select('medalha, temporada, resultado_id').eq('user_id', uid),
        db.from('radar_pagamentos').select('status, valor, criado_em').eq('user_id', uid).order('criado_em', { ascending: false }),
        db.from('radar_sugestoes_provas').select('nome, data, cidade, status, criado_em, prova_id').eq('user_id', uid).order('criado_em', { ascending: false }),
        db.from('radar_duelos').select('id, mes, distancia_km, desafiante, desafiado').or(`desafiante.eq.${uid},desafiado.eq.${uid}`),
      ]);
      return resp({ perfil, email: u?.user?.email ?? null, valida_ate: ass.data?.valida_ate ?? null, resultados: res.data ?? [], medalhas: med.data ?? [], pagamentos: pag.data ?? [], pedidos: sug.data ?? [], duelos: (due.data ?? []).length });
    }
    case 'admin_reabrir': { // volta um resultado para "em análise" (ex.: recusado sem querer)
      const { error } = await db.from('radar_resultados').update({ status: 'em_analise', motivo_analise: 'Reaberto pelo administrador.' }).eq('id', b.resultado_id);
      if (error) return resp({ erro: error.message }, 400);
      return resp({ ok: true });
    }
    case 'admin_cortesia_criar': { // gera um link de cortesia novo
      const nome = String(b.nome ?? '').trim().slice(0, 60) || `Cortesia ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;
      const dias = b.dias === null || b.dias === '' || b.dias === undefined ? null : Math.min(3650, Math.max(1, Math.round(Number(b.dias)) || 60));
      const codigo = Array.from(crypto.getRandomValues(new Uint8Array(5))).map(x => x.toString(16).padStart(2, '0')).join('');
      const { error } = await db.from('radar_cortesias').insert({ codigo, nome, dias });
      if (error) return resp({ erro: error.message }, 400);
      return resp({ ok: true, codigo, link: `https://radarcorridasma.com.br/?pro=cortesia&k=${codigo}` });
    }
    case 'admin_cortesia_revogar': { // tira o acesso de cortesia (volta a precisar pagar)
      const { data: c } = await db.from('radar_cortesias').select('*').eq('codigo', String(b.codigo ?? '')).maybeSingle();
      if (!c) return resp({ erro: 'Cortesia não encontrada.' }, 404);
      await db.from('radar_cortesias').update({ revogado_em: new Date().toISOString() }).eq('codigo', c.codigo);
      if (c.user_id) await db.from('radar_assinaturas').update({ valida_ate: new Date().toISOString(), atualizado_em: new Date().toISOString() }).eq('user_id', c.user_id);
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
