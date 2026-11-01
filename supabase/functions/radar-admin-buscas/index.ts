// Radar Pro · Admin "Resultados não achados": o atleta tentou registrar só com o peito e o Radar não achou.
// buscas: lista as abertas · procurar: eventos das cronometragens perto da data, ou lê um link, grava e confere o peito
// resolver: fecha a busca e (se pedir) avisa o atleta no sininho. Só o e-mail do Vinik.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { conferirRegistros, gravarOficiais, lerLink, listarEventos, parecenca, real, HOSTS } from '../_comum/resultados.ts';
import { calcularReis } from '../_comum/reis.ts';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const resp = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const limpa = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return resp({ erro: 'Método não aceito' }, 405);
  const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: { user } } = await anon.auth.getUser();
  if (!user) return resp({ erro: 'Faça login de novo.' }, 401);
  if (user.email !== 'vinikautor@gmail.com') return resp({ erro: 'Sem permissão.' }, 403);
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
