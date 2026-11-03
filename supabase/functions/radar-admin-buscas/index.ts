// Radar Pro · Admin "Resultados não achados": o atleta tentou registrar só com o peito e o Radar não achou.
// buscas: lista as abertas · procurar: eventos das cronometragens perto da data, ou lê um link, grava e confere o peito
// resolver: fecha a busca e (se pedir) avisa o atleta no sininho.
// aprovar_pedido: aprova o pedido de prova (cria ou junta com a da agenda) e já registra o resultado do atleta
// (pelo link do resultado ou pelo tempo que ele informou), pra prova entrar na temporada e no feed. Só o e-mail do Vinik.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { acharNoOficial, conferirRegistros, gravarOficiais, lerLink, lerOficiais, listarEventos, norm, parecenca, real, HOSTS } from '../_comum/resultados.ts';
import { calcularReis, notaIdade } from '../_comum/reis.ts';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const resp = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const limpa = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return resp({ erro: 'Método não aceito' }, 405);
  const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const interno = req.headers.get('x-radar-interno') ?? '';
  const ehInterno = !!interno && (interno === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || interno === Deno.env.get('RADAR_INTERNO'));
  if (!ehInterno) {
    const { data: { user } } = await anon.auth.getUser();
    if (!user) return resp({ erro: 'Faça login de novo.' }, 401);
    if (user.email !== 'vinikautor@gmail.com') return resp({ erro: 'Sem permissão.' }, 403);
  }
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const b = await req.json().catch(() => ({}));

  if (b.acao === 'buscas') {
    const { data: bs } = await db.from('radar_buscas_falhas').select('*').is('resolvido_em', null).order('criado_em', { ascending: false }).limit(50);
    const ids = [...new Set((bs ?? []).map(x => x.user_id))], provas = [...new Set((bs ?? []).map(x => x.prova_id))];
    const { data: pf } = ids.length ? await db.from('radar_perfis').select('user_id, apelido, nome_completo').in('user_id', ids) : { data: [] };
    const { data: pv } = provas.length ? await db.from('radar_provas').select('id, cidade, link_resultado').in('id', provas) : { data: [] };
    const lista = [];
    for (const x of bs ?? []) {
      const { count } = await db.from('radar_resultados_oficiais').select('id', { count: 'exact', head: true }).eq('prova_id', x.prova_id);
      const p = (pf ?? []).find(y => y.user_id === x.user_id), v = (pv ?? []).find(y => y.id === x.prova_id);
      lista.push({ ...x, apelido: p?.apelido ?? null, nome_completo: p?.nome_completo ?? null, cidade: v?.cidade ?? null, link_resultado: v?.link_resultado ?? null, oficiais: count ?? 0 });
    }
    return resp({ buscas: lista, sites: HOSTS });
  }


  if (b.acao === 'aprovar_pedido') {
    const { data: sg } = await db.from('radar_sugestoes_provas').select('*').eq('id', String(b.sugestao_id ?? '')).maybeSingle();
    if (!sg) return resp({ erro: 'Pedido não encontrado.' }, 404);
    let provaId = sg.prova_id as string | null;
    if (sg.status === 'pendente') {
      const dists = String(b.distancias ?? '').split(/[;,\s]+/).map(x => Number(x.replace(',', '.'))).filter(x => x > 0 && x <= 250);
      const kmS = Number(sg.distancia_km);
      provaId = limpa(b.prova_id, 80) || null;
      if (provaId) { // a prova já existe: só garante a distância
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
    }
    if (!provaId) return resp({ erro: 'Esse pedido foi recusado.' }, 409);
    const reg = await registrarPedido(db, sg, provaId);
    // avisa o atleta
    const { data: pv } = await db.from('radar_provas').select('nome, data').eq('id', provaId).maybeSingle();
    const quando = String(pv?.data ?? sg.data).slice(0, 10).split('-').reverse().slice(0, 2).join('/');
    const corpo = reg.registrou
      ? `A ${pv?.nome ?? sg.nome} (${quando}) já está na sua temporada${reg.status === 'verificado' ? ', verificada pelo resultado oficial' : ''}: ${reg.pontos} pontos. Toque pra ver.`
      : `A ${pv?.nome ?? sg.nome} (${quando}) já está no Radar. Vai em Eu corri, escolhe a prova e lança o seu tempo.`;
    await db.from('radar_avisos').insert({ user_id: sg.user_id, tipo: 'novidade', titulo: 'Sua prova foi aprovada! 🏃', corpo, url: `https://radarcorridasma.com.br/?pro#${reg.registrou ? 'temporada' : 'corri'}`, chave: `prova-aprovada:${sg.id}:${reg.registrou ? "temporada" : "agenda"}` }).then(() => null, () => null);
    await fetch(Deno.env.get('SUPABASE_URL') + '/functions/v1/radar-avisar', { method: 'POST', headers: { 'x-radar-interno': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, 'Content-Type': 'application/json' }, body: '{}' }).catch(() => null);
    return resp({ ok: true, prova_id: provaId, ...reg });
  }

  const { data: bu } = await db.from('radar_buscas_falhas').select('*').eq('id', String(b.id ?? '')).maybeSingle();
  if (!bu) return resp({ erro: 'Busca não encontrada.' }, 404);

  if (b.acao === 'procurar') {
    const perto = (d: string, n = 1) => Math.abs(new Date(d.slice(0, 10)).getTime() - new Date(String(bu.data)).getTime()) <= n * 86400_000;
    const link = limpa(b.link, 500);
    if (!link) {
      const vistos = new Set<string>();
      const evs = (await listarEventos()).filter(e => perto(e.data, 2) && !vistos.has(e.url) && vistos.add(e.url))
        .map(e => ({ ...e, parecenca: Math.round(parecenca(e.nome, bu.prova_nome ?? '') * 100) / 100 }))
        .sort((x, y) => y.parecenca - x.parecenca || Number(perto(y.data, 0)) - Number(perto(x.data, 0)));
      return resp({ candidatos: evs.slice(0, 12) });
    }
    let lido;
    try { lido = await lerLink(link); } catch (e) { return resp({ erro: 'O site da cronometragem não respondeu: ' + String((e as Error).message).slice(0, 120) }); }
    if (!lido) return resp({ erro: `Esse link o Radar ainda não sabe ler. Sites que ele lê: ${HOSTS.join(', ')}.` });
    if (!lido.linhas.length) return resp({ erro: 'O link abriu, mas veio sem nenhum atleta.' });
    if (lido.data && !perto(lido.data) && !b.forcar) return resp({ erro: `Esse resultado é de ${lido.data.slice(0, 10).split('-').reverse().join('/')} (${lido.evento}), e a prova foi ${String(bu.data).split('-').reverse().join('/')}.`, pode_forcar: true });
    const n = await gravarOficiais(db, bu.prova_id, link, lido.linhas);
    const reis = await calcularReis(db, bu.prova_id).catch(() => 0);
    const conf = await conferirRegistros(db, bu.prova_id).catch(() => null);
    const km = real(Number(bu.km)), peito = String(bu.peito ?? '').replace(/\D/g, '');
    const pe = (l: { peito: string | null }) => (l.peito ?? '').replace(/\D/g, '') === peito;
    const dono = peito ? lido.linhas.filter(l => l.distancia_km == null || Math.abs(real(Number(l.distancia_km)) - km) < 0.2).find(pe) ?? lido.linhas.find(pe) ?? null : null;
    const resumo = `${n} atletas carregados (${lido.evento})` + (dono ? ` · peito ${peito}: ${dono.nome}, ${dono.distancia_km ?? '?'} km` : ` · peito ${peito || '?'} não está no resultado`);
    await db.from('radar_buscas_falhas').update({ resultado: resumo.slice(0, 300) }).eq('id', bu.id);
    return resp({ ok: true, linhas: n, evento: lido.evento, reis, conferidos: conf, peito: dono ? { nome: dono.nome, km: dono.distancia_km, tempo_s: dono.tempo_s, colocacao_geral: dono.colocacao_geral } : null, resumo });
  }

  if (b.acao === 'resolver') {
    await db.from('radar_buscas_falhas').update({ resolvido_em: new Date().toISOString() }).eq('id', bu.id);
    const texto = limpa(b.aviso, 400);
    if (b.avisar && texto) {
      await db.from('radar_avisos').insert({ user_id: bu.user_id, tipo: 'novidade', titulo: 'O resultado da sua prova chegou', corpo: texto, url: 'https://radarcorridasma.com.br/?pro#corri', chave: `busca-ok:${bu.id}` });
      await fetch(Deno.env.get('SUPABASE_URL') + '/functions/v1/radar-avisar', { method: 'POST', headers: { 'x-radar-interno': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, 'Content-Type': 'application/json' }, body: '{}' }).catch(() => null);
    }
    return resp({ ok: true });
  }
  return resp({ erro: 'Ação desconhecida.' }, 400);
});

const idadeEm = (nasc: string, dia: string) => { const n = new Date(nasc + 'T12:00:00Z'), d = new Date(dia + 'T12:00:00Z'); let a = d.getUTCFullYear() - n.getUTCFullYear(); if (d.getUTCMonth() < n.getUTCMonth() || (d.getUTCMonth() === n.getUTCMonth() && d.getUTCDate() < n.getUTCDate())) a--; return a; };

/** Registra o resultado do pedido: tempo oficial (link lido) ou o tempo que o atleta informou. Mesmas regras de pontos do radar-registrar. */
// deno-lint-ignore no-explicit-any
async function registrarPedido(db: any, sg: any, provaId: string): Promise<{ registrou: boolean; motivo?: string; status?: string; pontos?: number; tempo_s?: number; oficiais?: number }> {
  const { data: pf } = await db.from('radar_perfis').select('nome_completo, sexo, nascimento').eq('user_id', sg.user_id).maybeSingle();
  if (!pf?.sexo || !pf?.nascimento) return { registrou: false, motivo: 'perfil do atleta incompleto' };
  const { data: prova } = await db.from('radar_provas').select('*').eq('id', provaId).maybeSingle();
  if (!prova) return { registrou: false, motivo: 'prova não encontrada' };
  const km = real(Number(sg.distancia_km));
  const { data: hist } = await db.from('radar_resultados').select('prova_id, tempo_s, distancia_km, prova_data, cidade').eq('user_id', sg.user_id).neq('status', 'recusado');
  if ((hist ?? []).some((h: any) => h.prova_id === provaId && Math.abs(Number(h.distancia_km) - km) < 0.2)) return { registrou: false, motivo: 'o atleta já registrou essa prova' };
  let ofs = await lerOficiais(db, provaId);
  if (!ofs.length && sg.link) {
    try {
      const lido = await lerLink(sg.link);
      if (lido?.linhas.length) { await gravarOficiais(db, provaId, sg.link, lido.linhas); await calcularReis(db, provaId).catch(() => 0); ofs = await lerOficiais(db, provaId); }
    } catch { /* site fora do ar */ }
  }
  const peito = sg.peito ? String(sg.peito).replace(/\D/g, '') || null : null;
  let of = null;
  if (ofs.length) { const a = acharNoOficial(ofs, km, { peito, nomePerfil: pf.nome_completo ?? '', nomeBusca: pf.nome_completo ?? '', tempo: Number(sg.tempo_s) || null }); if (!a.outroAtleta) of = a.of; }
  const tempo = of?.tempo_s ?? (Number(sg.tempo_s) || 0);
  if (!(tempo > 0)) return { registrou: false, motivo: ofs.length ? 'o Radar leu o resultado, mas não achou o atleta' : 'o pedido não tem tempo nem resultado que o Radar leia', oficiais: ofs.length };
  const dia = String(prova.data).slice(0, 10);
  const idade = idadeEm(pf.nascimento, dia);
  const n = Math.round(((await notaIdade(pf.sexo, km, idade, tempo)) ?? 0) * 100) / 100;
  const { data: pro } = await db.rpc('radar_eh_assinante', { uid: sg.user_id });
  const mesma = (hist ?? []).filter((h: any) => Math.abs(Number(h.distancia_km) - km) < 0.2);
  const melhorAntes = mesma.length ? Math.min(...mesma.map((h: any) => h.tempo_s)) : null;
  const d: Record<string, number> = { concluir: 10 };
  if (km >= 99.5) d.ultra_100 = 50; else if (km > 42.5) d.ultra = 30; else if (km >= 42) d.maratona = 20; else if (km >= 21) d.meia = 10; else if (km >= 10) d.dez_km = 5;
  if (melhorAntes && tempo < melhorAntes) d.recorde_pessoal = 5;
  const temporada = Number(dia.slice(0, 4));
  if (!(hist ?? []).some((h: any) => Number(String(h.prova_data).slice(0, 4)) === temporada && norm(h.cidade) === norm(prova.cidade))) d.cidade_nova = 3;
  const larg = String(prova.largada ?? prova.horario ?? '');
  if (/^\d{1,2}:\d{2}/.test(larg) && Number(larg.split(':')[0]) >= 17) d.noturna = 10;
  let status = pro ? (of ? 'verificado' : 'aprovado') : 'declarado';
  let motivo: string | null = of ? null : pro ? 'Aprovado pelo Radar no pedido de prova.' : 'Verificar com o resultado oficial é do Radar Pro. Assine para validar esta prova.';
  if (!of && pro && n > 90) { status = 'em_analise'; motivo = 'Nota por idade acima de 90%: precisa do resultado oficial.'; }
  const podio = status === 'verificado' && !!of && ((of.colocacao_geral ?? 99) <= 3 || (of.colocacao_faixa ?? 99) <= 3);
  if (podio) d.podio = 10;
  const pontos = Object.values(d).reduce((a, x) => a + x, 0);
  const { error } = await db.from('radar_resultados').insert({
    user_id: sg.user_id, prova_id: provaId, prova_nome: prova.nome, prova_data: dia, cidade: prova.cidade, uf: prova.uf ?? 'MA', largada: larg || null,
    distancia_km: km, tempo_s: tempo, idade, nota: n, peito: status === 'verificado' ? (of?.peito ?? peito) : null, peito_declarado: peito, link_resultado: sg.link ?? null,
    status, motivo_analise: motivo, podio, pontos, detalhes_pontos: d,
  });
  if (error) return { registrou: false, motivo: 'não deu pra salvar: ' + error.message.slice(0, 120) };
  await fetch(Deno.env.get('SUPABASE_URL') + '/functions/v1/radar-coletar-resultados', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-radar-interno': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! }, body: JSON.stringify({ medalhas: [sg.user_id] }) }).catch(() => null);
  return { registrou: true, status, pontos, tempo_s: tempo, oficiais: ofs.length };
}
