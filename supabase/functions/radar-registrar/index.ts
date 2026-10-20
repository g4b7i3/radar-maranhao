// Radar Pro · "Eu corri!": registra uma prova da agenda na temporada do atleta.
// O tempo vem do resultado oficial quando a cronometragem publicou (selo "verificado");
// senão fica "declarado" (só conta para a temporada pessoal) ou "em análise" (com comprovante).
// Calcula aqui no servidor a nota por idade, os pontos e as medalhas, para ninguém mexer pelo navegador.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const resp = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const SITE = 'https://radarcorridasma.com.br';

type T = { idadeMin: number; dist: number[]; oc: number[]; f: number[][] };
let TAB: Record<'F' | 'M', T>; // tabela pública do site, carregada uma vez por instância
/** Nota por idade (tabelas WMA 2025, as mesmas do site). */
function nota(sexo: 'F' | 'M', km: number, idade: number, seg: number) {
  const t = TAB[sexo], d = t.dist, a = Math.min(100, Math.max(t.idadeMin, Math.round(idade))) - t.idadeMin;
  let oc: number, f: number;
  if (km <= d[0]) { oc = t.oc[0] * km / d[0]; f = t.f[0][a]; }
  else if (km >= d[d.length - 1]) { const i = d.length - 1; oc = t.oc[i] * km / d[i]; f = t.f[i][a]; }
  else {
    const i = d.findIndex(x => x >= km);
    if (Math.abs(d[i] - km) < 0.01) { oc = t.oc[i]; f = t.f[i][a]; }
    else { const j = i - 1, p = Math.log(km / d[j]) / Math.log(d[i] / d[j]); oc = Math.exp(Math.log(t.oc[j]) + p * (Math.log(t.oc[i]) - Math.log(t.oc[j]))); f = t.f[j][a] + p * (t.f[i][a] - t.f[j][a]); }
  }
  return (oc / f) / seg * 100;
}
const real = (k: number) => (Math.abs(k - 21) < 0.2 ? 21.0975 : Math.abs(k - 42) < 0.3 ? 42.195 : k);
const norm = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const idadeEm = (nasc: string, dia: string) => { const n = new Date(nasc + 'T12:00:00Z'), d = new Date(dia + 'T12:00:00Z'); let a = d.getUTCFullYear() - n.getUTCFullYear(); if (d.getUTCMonth() < n.getUTCMonth() || (d.getUTCMonth() === n.getUTCMonth() && d.getUTCDate() < n.getUTCDate())) a--; return a; };
const LIGAS = ['bronze', 'prata', 'ouro', 'elite'];
const liga = (i: number | null) => (i == null ? null : i >= 65 ? 'elite' : i >= 55 ? 'ouro' : i >= 45 ? 'prata' : 'bronze');

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return resp({ erro: 'Método não aceito' }, 405);
  const auth = req.headers.get('Authorization') ?? '';
  const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await anon.auth.getUser();
  if (!user) return resp({ erro: 'Faça login de novo.' }, 401);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let b: { prova_id?: string; distancia_km?: number; tempo_s?: number; peito?: string; nome_inscricao?: string; link_resultado?: string };
  try { b = await req.json(); } catch { return resp({ erro: 'Envio inválido.' }, 400); }

  if (!TAB) TAB = await fetch(SITE + '/data/idade-tabela.json').then(r => r.json()).catch(() => null);
  if (!TAB) return resp({ erro: 'Tente de novo em instantes.' }, 503);
  const { data: perfil } = await db.from('radar_perfis').select('*').eq('user_id', user.id).maybeSingle();
  if (!perfil) return resp({ erro: 'Complete seu perfil antes.' }, 400);
  const { data: ass } = await db.from('radar_assinaturas').select('valida_ate').eq('user_id', user.id).maybeSingle();
  if (!ass?.valida_ate || new Date(ass.valida_ate) < new Date()) return resp({ erro: 'Sua assinatura do Radar Pro não está ativa.' }, 402);

  // A prova precisa estar na agenda do Radar e já ter acontecido.
  const agenda = await fetch(SITE + '/data/radar.json', { headers: { 'Cache-Control': 'no-cache' } }).then(r => r.json()).catch(() => null);
  const naAgenda = agenda?.events?.find((e: { id: string }) => e.id === b.prova_id);
  let prova: { id: string; name: string; date: string; city: string; distances: number[]; start: string | null } | null = null;
  if (naAgenda?.date) prova = { id: naAgenda.id, name: naAgenda.name, date: naAgenda.date, city: naAgenda.city, distances: naAgenda.distances ?? [], start: naAgenda.start ?? null };
  else { // prova antiga que já saiu da agenda: vem do arquivo de provas
    const { data: a } = await db.from('radar_provas').select('*').eq('id', String(b.prova_id ?? '')).maybeSingle();
    if (a) prova = { id: a.id, name: a.nome, date: a.data, city: a.cidade, distances: (a.distancias ?? []).map(Number), start: a.largada };
  }
  if (!prova?.date) return resp({ erro: 'Escolha uma prova da agenda do Radar.' }, 400);
  if (prova.date.slice(0, 10) < new Date(Date.now() - 400 * 86400_000).toISOString().slice(0, 10)) return resp({ erro: 'Só valem provas dos últimos 12 meses.' }, 400);
  const hoje = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  if (prova.date.slice(0, 10) > hoje) return resp({ erro: 'Essa prova ainda não aconteceu.' }, 400);
  const km = real(Number(b.distancia_km));
  if (!(km > 0) || !prova.distances?.some((d: number) => Math.abs(real(d) - km) < 0.2)) return resp({ erro: 'Escolha uma das distâncias da prova.' }, 400);

  // 1) Procura no resultado oficial (número de peito ou nome da inscrição).
  const peito = (b.peito ?? '').toString().replace(/\D/g, '').slice(0, 8) || null;
  const nomeIns = norm(b.nome_inscricao || perfil.nome_completo);
  let oficial: { tempo_s: number; colocacao_geral: number | null; colocacao_faixa: number | null; nome: string; fonte_url: string | null } | null = null;
  const { data: ofs } = await db.from('radar_resultados_oficiais').select('tempo_s, colocacao_geral, colocacao_faixa, nome, nome_norm, peito, distancia_km, fonte_url').eq('prova_id', prova.id);
  if (ofs?.length) {
    const naDist = ofs.filter(o => o.distancia_km == null || Math.abs(real(Number(o.distancia_km)) - km) < 0.2);
    const porPeito = peito ? naDist.filter(o => o.peito && o.peito.replace(/\D/g, '') === peito) : [];
    const porNome = naDist.filter(o => o.nome_norm === nomeIns);
    // peito só vale se o nome bater (evita usar o peito de outra pessoa)
    const cand = porPeito.find(o => o.nome_norm.split(' ')[0] === nomeIns.split(' ')[0]) ?? (porNome.length === 1 ? porNome[0] : null);
    if (cand) oficial = cand;
  }

  const tempo = oficial ? oficial.tempo_s : Math.round(Number(b.tempo_s));
  if (!(tempo > 0)) return resp({ erro: ofs?.length ? 'Não achamos você no resultado oficial. Confira o nome e o número de peito, ou informe o tempo.' : 'Informe o tempo líquido (do chip).' }, 400);
  const pace = tempo / km;
  if (pace < 150) return resp({ erro: 'Esse tempo não é possível para essa distância. Confira.' }, 400);
  if (pace > 1500) return resp({ erro: 'Esse tempo parece de caminhada longa demais. Confira.' }, 400);

  const idade = idadeEm(perfil.nascimento, prova.date.slice(0, 10));
  const n = Math.round(nota(perfil.sexo, km, idade, tempo) * 100) / 100;
  const link = (b.link_resultado ?? '').trim().slice(0, 400) || null;

  // Histórico do atleta (para recorde, cidade nova, alarmes e medalhas)
  const { data: hist } = await db.from('radar_resultados').select('*').eq('user_id', user.id).neq('status', 'recusado');
  if (hist?.some(h => h.prova_id === prova.id && Math.abs(Number(h.distancia_km) - km) < 0.2)) return resp({ erro: 'Você já registrou essa prova nessa distância.' }, 409);
  const mesmaDist = (hist ?? []).filter(h => Math.abs(Number(h.distancia_km) - km) < 0.2);
  const melhorAntes = mesmaDist.length ? Math.min(...mesmaDist.map(h => h.tempo_s)) : null;

  // 2) Status e alarmes contra fraude
  let status = oficial ? 'verificado' : link ? 'em_analise' : 'declarado';
  let motivo: string | null = oficial ? null : link ? 'Comprovante enviado: aguardando aprovação.' : null;
  if (!oficial && n > 80) { status = 'em_analise'; motivo = 'Nota por idade acima de 80%: precisa do resultado oficial.'; }
  if (!oficial && melhorAntes && tempo < melhorAntes * 0.92) { status = 'em_analise'; motivo = 'Melhora de mais de 8% sobre o seu melhor tempo: precisa do resultado oficial.'; }

  // 3) Pontos
  const temporada = Number(prova.date.slice(0, 4));
  const d: Record<string, number> = { concluir: 10 };
  if (km >= 42) d.maratona = 20; else if (km >= 21) d.meia = 10; else if (km >= 10) d.dez_km = 5;
  if (melhorAntes && tempo < melhorAntes) d.recorde_pessoal = 5;
  if (!(hist ?? []).some(h => Number(String(h.prova_data).slice(0, 4)) === temporada && norm(h.cidade) === norm(prova.city))) d.cidade_nova = 3;
  const podio = !!oficial && ((oficial.colocacao_geral ?? 99) <= 3 || (oficial.colocacao_faixa ?? 99) <= 3);
  if (podio) d.podio = 10;
  const pontos = Object.values(d).reduce((a, x) => a + x, 0);

  const { data: novo, error } = await db.from('radar_resultados').insert({
    user_id: user.id, prova_id: prova.id, prova_nome: prova.name, prova_data: prova.date.slice(0, 10), cidade: prova.city,
    largada: prova.start, distancia_km: km, tempo_s: tempo, idade, nota: n, peito, link_resultado: link,
    status, motivo_analise: motivo, podio, pontos, detalhes_pontos: d,
  }).select().single();
  if (error) return resp({ erro: error.code === '23505' ? 'Esse número de peito já foi usado nessa prova. Fale com o Radar pelo WhatsApp.' : 'Não deu para salvar agora.' }, 400);

  // 4) Medalhas (participação conta mesmo declarada; "Subiu de liga" e "Recorde" só com tempo válido)
  const todos = [...(hist ?? []), novo];
  const daTemp = todos.filter(h => Number(String(h.prova_data).slice(0, 4)) === temporada);
  const validos = (x: { status: string }) => ['verificado', 'aprovado'].includes(x.status);
  const cidades = new Set(daTemp.map(h => norm(h.cidade))).size;
  const hora = (s: string | null) => (s && /^\d{2}:\d{2}/.test(s) ? Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5)) : null);
  const ganhou: string[] = [];
  const marca = (m: string, cond: boolean) => { if (cond) ganhou.push(m); };
  marca('primeira_prova', todos.length === 1);
  marca('primeiro_10k', km >= 10 && km < 21 && !(hist ?? []).some(h => Number(h.distancia_km) >= 10 && Number(h.distancia_km) < 21));
  marca('primeira_meia', km >= 21 && km < 42 && !(hist ?? []).some(h => Number(h.distancia_km) >= 21 && Number(h.distancia_km) < 42));
  marca('primeira_maratona', km >= 42 && !(hist ?? []).some(h => Number(h.distancia_km) >= 42));
  marca('5_provas', daTemp.length >= 5); marca('10_provas', daTemp.length >= 10); marca('20_provas', daTemp.length >= 20);
  marca('3_cidades', cidades >= 3); marca('5_cidades', cidades >= 5); marca('10_cidades', cidades >= 10);
  const h0 = hora(novo.largada);
  marca('madrugador', h0 != null && h0 < 6 * 60); marca('night_run', h0 != null && h0 >= 17 * 60);
  marca('recorde_pessoal', !!d.recorde_pessoal && validos(novo));
  marca('podio', podio);

  // liga antes x depois (só com resultados válidos)
  const top3 = (lista: typeof todos) => { const v = lista.filter(validos).filter(h => new Date(h.prova_data) >= new Date(Date.now() - 365 * 86400_000)).map(h => Number(h.nota)).sort((a, b) => b - a).slice(0, 3); return v.length ? Math.round(v.reduce((a, x) => a + x, 0) / v.length * 10) / 10 : null; };
  const iAntes = top3(hist ?? []), iDepois = top3(todos);
  const subiu = !!liga(iDepois) && !!liga(iAntes) && LIGAS.indexOf(liga(iDepois)!) > LIGAS.indexOf(liga(iAntes)!);
  marca('subiu_de_liga', subiu);

  let novas: string[] = [];
  if (ganhou.length) {
    const { data: ins } = await db.from('radar_medalhas').upsert(ganhou.map(m => ({ user_id: user.id, medalha: m, temporada, resultado_id: novo.id })), { onConflict: 'user_id,medalha,temporada', ignoreDuplicates: true }).select('medalha');
    novas = (ins ?? []).map(x => x.medalha);
  }

  return resp({ resultado: novo, nota: n, pontos, detalhes: d, status, motivo, medalhas_novas: novas, indice: iDepois, liga: liga(iDepois), subiu_de_liga: subiu, oficial: !!oficial });
});
