// Radar Pro · "Eu corri!": registra uma prova da agenda na temporada do atleta.
// O tempo vem do resultado oficial quando a cronometragem publicou (selo "verificado");
// senão fica "declarado" (só conta para a temporada pessoal) ou "em análise" (com comprovante).
// Calcula aqui no servidor a nota por idade, os pontos e as medalhas, para ninguém mexer pelo navegador.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { acharNoOficial, gravarOficiais, lerLink, lerOficiais, listarEventos, parecenca, semelhante, conferirRegistros, norm as normNome, type Lido } from '../_comum/resultados.ts';
import { lerComIA, type LeituraIA } from '../_comum/ia.ts';
const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO','EX'];

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const resp = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const SITE = 'https://radarcorridasma.com.br';
/** Medalhas: a conta fica na função radar-coletar-resultados (um lugar só para as regras). */
const medalhasDe = async (ids: string[]): Promise<Record<string, string[]>> => {
  try {
    const r = await fetch(Deno.env.get('SUPABASE_URL') + '/functions/v1/radar-coletar-resultados', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-radar-interno': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! }, body: JSON.stringify({ medalhas: ids }) });
    return (await r.json()).novas ?? {};
  } catch { return {}; }
};


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
const INICIO_TEMPORADA = '2026-10-15';
const limpa = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
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

  let b: { prova_id?: string; distancia_km?: number; tempo_s?: number; peito?: string; nome_inscricao?: string; link_resultado?: string; nova_prova?: { nome?: string; data?: string; cidade?: string; obs?: string; uf?: string } };
  try { b = await req.json(); } catch { return resp({ erro: 'Envio inválido.' }, 400); }

  if (!TAB) TAB = await fetch(SITE + '/data/idade-tabela.json').then(r => r.json()).catch(() => null);
  if (!TAB) return resp({ erro: 'Tente de novo em instantes.' }, 503);
  const { data: perfil } = await db.from('radar_perfis').select('*').eq('user_id', user.id).maybeSingle();
  if (!perfil) return resp({ erro: 'Complete seu perfil antes.' }, 400);
  const { data: ehPro } = await db.rpc('radar_eh_assinante', { uid: user.id }); // pago, cortesia ou plano assessoria
  // modo grátis: registra como "declarada" e não confere com o resultado oficial (verificar é do Pro)
  const gratis = !ehPro;

  // Prova que não está na agenda: com o link da cronometragem, o Radar confere e cria a prova na hora.
  // Sem link (ou link que o Radar não sabe ler), vira pedido para o administrador.
  let lidoNovo: Lido | null = null;
  let provaNova: { id: string; name: string; date: string; city: string; uf: string; distances: number[]; start: string | null } | null = null;
  if (b.nova_prova) {
    const np = b.nova_prova;
    const nome = limpa(np.nome, 120), cidade = limpa(np.cidade, 60), dia = String(np.data ?? '').slice(0, 10), kmN = Number(b.distancia_km);
    const lk = limpa(b.link_resultado, 400), obs = limpa(np.obs, 300);
    const uf = String(np.uf ?? 'MA').toUpperCase().slice(0, 2);
    if (!UFS.includes(uf)) return resp({ erro: 'Escolha o estado da prova.' }, 400);
    const hojeN = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
    if (nome.length < 5) return resp({ erro: 'Escreva o nome da prova.' }, 400);
    if (cidade.length < 3) return resp({ erro: 'Diga a cidade da prova.' }, 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return resp({ erro: 'Data inválida.' }, 400);
    if (dia < INICIO_TEMPORADA) return resp({ erro: 'A temporada 2026 conta só as provas a partir de 15/10/2026.' }, 400);
    if (dia > hojeN) return resp({ erro: 'A prova ainda não aconteceu.' }, 400);
    if (!(kmN >= 1 && kmN <= 250)) return resp({ erro: 'Escolha a distância que você correu.' }, 400);
    if (lk && !/^https?:\/\/\S+\.\S+/.test(lk)) return resp({ erro: 'O link do resultado precisa começar com http.' }, 400);
    const { count: hojeQtd } = await db.from('radar_sugestoes_provas').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('criado_em', new Date(Date.now() - 86400_000).toISOString());
    if ((hojeQtd ?? 0) >= 10) return resp({ erro: 'Muitos pedidos hoje. Tente amanhã.' }, 429);
    const pedido = async (motivo: string) => {
      const { count } = await db.from('radar_sugestoes_provas').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'pendente');
      if ((count ?? 0) >= 5) return resp({ erro: 'Você já tem 5 pedidos esperando. Aguarde a resposta do Radar.' }, 429);
      await db.from('radar_sugestoes_provas').insert({ user_id: user.id, nome, cidade, uf, data: dia, distancia_km: kmN, link: lk || null, obs: [obs, motivo].filter(Boolean).join(' · ').slice(0, 300) || null });
      return resp({ pedido: true, motivo });
    };
    if (!lk) return await pedido('');
    if (gratis) return await pedido('Modo grátis: a verificação pelo link é do Radar Pro');
    try { lidoNovo = await lerLink(lk); } catch { lidoNovo = null; }
    if (!lidoNovo?.linhas.length) return await pedido('Link não lido automaticamente');
    if (lidoNovo.data && Math.abs(new Date(lidoNovo.data.slice(0, 10)).getTime() - new Date(dia).getTime()) > 86400_000)
      return resp({ erro: `Esse link é de outro dia (${lidoNovo.data.slice(0, 10).split('-').reverse().join('/')}). Confira a data da prova ou o link.` }, 400);
    const distsLink = [...new Set(lidoNovo.linhas.map(l => l.distancia_km).filter((x): x is number => !!x && x > 0).map(x => Math.round(x * 10) / 10))].sort((x, y) => x - y);
    if (distsLink.length && !distsLink.some(d => Math.abs(real(d) - real(kmN)) < 0.2))
      return resp({ erro: `No resultado essa prova tem ${distsLink.map(d => String(d).replace('.', ',') + ' km').join(', ')}. Escolha a distância certa.` }, 400);
    // prova de verdade: precisa achar o atleta no resultado
    const pre = lidoNovo.linhas.map(l => ({ nome: l.nome, nome_norm: normNome(l.nome), peito: l.peito ? l.peito.replace(/\D/g, '') || null : null, tempo_s: l.tempo_s, distancia_km: l.distancia_km, colocacao_geral: l.colocacao_geral, colocacao_faixa: l.colocacao_faixa }));
    const nomeInsN = limpa(b.nome_inscricao, 120);
    const pPeito = String(b.peito ?? '').replace(/\D/g, '').slice(0, 8) || null;
    const achou = acharNoOficial(pre, real(kmN), { peito: pPeito, nomePerfil: perfil.nome_completo, nomeBusca: nomeInsN || perfil.nome_completo, tempo: Number(b.tempo_s) || null });
    if (achou.outroAtleta) return resp({ erro: 'Esse número de peito é de outro atleta no resultado.' }, 400);
    if (!achou.of) return await pedido('O Radar leu o link mas não achou o atleta');
    // junta com prova do mesmo dia que já exista (outra pessoa pediu, ou está na agenda)
    const nomeEvento = lidoNovo.evento && lidoNovo.evento.length >= 5 ? lidoNovo.evento : nome;
    const { data: doDia } = await db.from('radar_provas').select('*').gte('data', new Date(new Date(dia).getTime() - 86400_000).toISOString().slice(0, 10)).lte('data', new Date(new Date(dia).getTime() + 86400_000).toISOString().slice(0, 10));
    const igual = (doDia ?? []).find(p => p.link_resultado === lk) ?? (doDia ?? []).find(p => p.data === dia && (parecenca(p.nome, nomeEvento) >= 0.5 || parecenca(p.nome, nome) >= 0.5));
    const todas = (ds: number[]) => [...new Set([...ds.map(Number), ...distsLink, kmN])].sort((x, y) => x - y);
    let pid: string;
    if (igual) {
      pid = igual.id;
      await db.from('radar_provas').update({ distancias: todas(igual.distancias ?? []), atualizado_em: new Date().toISOString() }).eq('id', pid);
    } else {
      pid = 'pro-' + crypto.randomUUID().slice(0, 8);
      const { error: e1 } = await db.from('radar_provas').insert({ id: pid, nome: nome, data: dia, cidade, uf, distancias: todas([]), modalidade: 'corrida' });
      if (e1) return resp({ erro: 'Não deu para criar a prova agora.' }, 500);
    }
    const { data: pv } = await db.from('radar_provas').select('*').eq('id', pid).single();
    provaNova = { id: pv.id, name: pv.nome, date: pv.data, city: pv.cidade, uf: pv.uf ?? 'MA', distances: (pv.distancias ?? []).map(Number), start: pv.largada };
    await db.from('radar_sugestoes_provas').insert({ user_id: user.id, nome, cidade, uf, data: dia, distancia_km: kmN, link: lk, obs: obs || null, status: 'aprovada', prova_id: pid, resposta: 'Aprovada na hora pelo link do resultado.', decidido_em: new Date().toISOString() });
    b.prova_id = pid;
  }

  // A prova precisa estar na agenda do Radar e já ter acontecido.
  const agenda = await fetch(SITE + '/data/radar.json', { headers: { 'Cache-Control': 'no-cache' } }).then(r => r.json()).catch(() => null);
  const naAgenda = agenda?.events?.find((e: { id: string }) => e.id === b.prova_id);
  let prova: { id: string; name: string; date: string; city: string; uf: string; distances: number[]; start: string | null } | null = provaNova;
  if (prova) { /* prova criada agora pelo link */ }
  else if (naAgenda?.date) prova = { id: naAgenda.id, name: naAgenda.name, date: naAgenda.date, city: naAgenda.city, uf: 'MA', distances: naAgenda.distances ?? [], start: naAgenda.start ?? null };
  else { // prova antiga que já saiu da agenda: vem do arquivo de provas
    const { data: a } = await db.from('radar_provas').select('*').eq('id', String(b.prova_id ?? '')).maybeSingle();
    if (a) prova = { id: a.id, name: a.nome, date: a.data, city: a.cidade, uf: a.uf ?? 'MA', distances: (a.distancias ?? []).map(Number), start: a.largada };
  }
  if (!prova?.date) return resp({ erro: 'Escolha uma prova da agenda do Radar.' }, 400);
  if (prova.date.slice(0, 10) < new Date(Date.now() - 400 * 86400_000).toISOString().slice(0, 10)) return resp({ erro: 'Só valem provas dos últimos 12 meses.' }, 400);
  const hoje = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  if (prova.date.slice(0, 10) > hoje) return resp({ erro: 'Essa prova ainda não aconteceu.' }, 400);
  const km = real(Number(b.distancia_km));
  if (!(km > 0) || !prova.distances?.some((d: number) => Math.abs(real(d) - km) < 0.2)) return resp({ erro: 'Escolha uma das distâncias da prova.' }, 400);

  // 1) Procura no resultado oficial (número de peito + nome).
  const peito = (b.peito ?? '').toString().replace(/\D/g, '').slice(0, 8) || null;
  const nomeIns = (b.nome_inscricao ?? '').trim().slice(0, 120);
  // liberdade no nome da inscrição, mas com pelo menos um nome do nome completo do perfil
  if (nomeIns && !semelhante(nomeIns, perfil.nome_completo)) return resp({ erro: 'O nome da inscrição precisa ter pelo menos um nome do seu nome completo.' }, 400);
  const link = (b.link_resultado ?? '').trim().slice(0, 400) || null;

  let ofs = gratis ? [] : await lerOficiais(db, prova.id);
  // 1b) Link do resultado: o Radar lê na hora (Racezone, Wiclax). Se for da prova certa, vira o resultado oficial da prova.
  let linkLido = false, avisoLink: string | null = null;
  if (lidoNovo && link && !ofs?.length) { // prova nova: o link já foi conferido acima
    await gravarOficiais(db, prova.id, link, lidoNovo.linhas);
    ofs = await lerOficiais(db, prova.id); linkLido = true;
    await conferirRegistros(db, prova.id).catch(() => null);
  }
  if (link && !ofs?.length && !gratis) {
    try {
      const lido = await lerLink(link);
      if (lido?.linhas.length) {
        const diaOk = !!lido.data && Math.abs(new Date(lido.data.slice(0, 10)).getTime() - new Date(prova.date.slice(0, 10)).getTime()) <= 86400_000;
        const nomeOk = parecenca(lido.evento, prova.name) >= 0.5;
        if (nomeOk && (diaOk || !lido.data)) {
          await gravarOficiais(db, prova.id, link, lido.linhas);
          ofs = await lerOficiais(db, prova.id);
          linkLido = true;
          await conferirRegistros(db, prova.id).catch(() => null); // quem já tinha registrado essa prova também é conferido
        } else if (!diaOk) avisoLink = `O link é de outro evento (${lido.evento || 'sem nome'}${lido.data ? ', ' + lido.data.slice(0, 10).split('-').reverse().join('/') : ''}).`;
      }
    } catch { /* site da cronometragem fora do ar: segue como comprovante */ }
  }
  if (avisoLink) return resp({ erro: avisoLink + ' Cole o link do resultado desta prova.' }, 400);

  // 1a) Só o número de peito (sem link e sem tempo): o Radar procura o resultado nas cronometragens que sabe ler, na hora.
  const soPeito = !gratis && !link && !(Number(b.tempo_s) > 0);
  if (soPeito && peito && !ofs?.length) {
    try {
      const dataP = prova.date.slice(0, 10);
      const perto = (d: string) => Math.abs(new Date(d.slice(0, 10)).getTime() - new Date(dataP).getTime()) <= 86400_000;
      const cands = (await listarEventos()).filter(e => perto(e.data) && parecenca(e.nome, prova!.name) >= 0.5)
        .sort((x, y) => parecenca(y.nome, prova!.name) - parecenca(x.nome, prova!.name)).slice(0, 4);
      for (const c of cands) {
        const lido = await lerLink(c.url).catch(() => null);
        if (!lido?.linhas.length || (lido.data && !perto(lido.data))) continue;
        await gravarOficiais(db, prova.id, c.url, lido.linhas);
        ofs = await lerOficiais(db, prova.id); linkLido = true;
        await conferirRegistros(db, prova.id).catch(() => null);
        break;
      }
    } catch { /* cronometragens fora do ar: pede o link */ }
  }

  let oficial: { tempo_s: number; colocacao_geral: number | null; colocacao_faixa: number | null; nome: string } | null = null;
  if (ofs?.length) {
    const achado = acharNoOficial(ofs, km, { peito, nomePerfil: perfil.nome_completo, nomeBusca: nomeIns || perfil.nome_completo, tempo: Number(b.tempo_s) || null });
    if (achado.outroAtleta) return resp({ erro: 'Recusado: esse número de peito é de outro atleta no resultado oficial.' }, 400);
    oficial = achado.of;
  }
  // 1c) Link que o Radar não conhece (página, PDF, imagem): leitura com IA, aceita só se tudo conferir
  let viaIA: LeituraIA | null = null;
  if (!oficial && link && !gratis && !linkLido) {
    try { viaIA = await lerComIA(link, { nomePerfil: perfil.nome_completo, nomeInscricao: nomeIns || null, peito, km, dataProva: prova.date.slice(0, 10), nomeProva: prova.name }); } catch { viaIA = null; }
    if (viaIA) oficial = { tempo_s: viaIA.tempo_s, colocacao_geral: null, colocacao_faixa: null, nome: viaIA.nome }; // pódio só com cronometragem conhecida
  }

  // não achou só com o peito: a tela mostra o campo do link (nada é salvo)
  if (soPeito && !oficial) return resp({ precisa_link: true, achou_resultado: !!ofs?.length, motivo: ofs?.length ? `Achamos o resultado da prova, mas não o peito ${peito ?? ''} em ${String(Math.round(km * 10) / 10).replace('.', ',')} km com o seu nome. Confira o número ou cole o link do seu resultado aqui.` : 'Não achamos o resultado desta prova. Cole aqui o link do resultado (da cronometragem).' });
  const tempo = oficial ? oficial.tempo_s : Math.round(Number(b.tempo_s));
  if (!(tempo > 0)) return resp({ erro: ofs?.length ? 'Não achamos você no resultado oficial. Confira o nome da inscrição e o número de peito, ou informe o tempo.' : 'Informe o tempo líquido (do chip).' }, 400);
  const pace = tempo / km;
  if (pace < 150) return resp({ erro: 'Esse tempo não é possível para essa distância. Confira.' }, 400);
  if (pace > 1500) return resp({ erro: 'Esse tempo parece de caminhada longa demais. Confira.' }, 400);

  const idade = idadeEm(perfil.nascimento, prova.date.slice(0, 10));
  const n = Math.round(nota(perfil.sexo, km, idade, tempo) * 100) / 100;

  // Histórico do atleta (para recorde, cidade nova, alarmes e medalhas)
  const { data: hist } = await db.from('radar_resultados').select('*').eq('user_id', user.id).neq('status', 'recusado');
  if (hist?.some(h => h.prova_id === prova.id && Math.abs(Number(h.distancia_km) - km) < 0.2)) return resp({ erro: 'Você já registrou essa prova nessa distância.' }, 409);
  const mesmaDist = (hist ?? []).filter(h => Math.abs(Number(h.distancia_km) - km) < 0.2);
  const melhorAntes = mesmaDist.length ? Math.min(...mesmaDist.map(h => h.tempo_s)) : null;

  // 2) Status e alarmes contra fraude
  let status = oficial ? 'verificado' : link && !gratis ? 'em_analise' : 'declarado';
  let motivo: string | null = oficial ? null : gratis ? 'Verificar com o resultado oficial é do Radar Pro. Assine para validar esta prova.' : link ? (linkLido ? 'O Radar leu o resultado, mas não achou o seu nome/peito: conferir.' : 'Comprovante enviado: aguardando aprovação.') : null;
  if (!oficial && !gratis && n > 90) { status = 'em_analise'; motivo = 'Nota por idade acima de 90%: precisa do resultado oficial.'; }
  if (!oficial && !gratis && melhorAntes && tempo < melhorAntes * 0.92) { status = 'em_analise'; motivo = 'Melhora de mais de 8% sobre o seu melhor tempo: precisa do resultado oficial.'; }
  if (viaIA) {
    motivo = `Verificado por leitura automática do link (${viaIA.fonte}).`;
    if (n > 90) { status = 'em_analise'; motivo = 'Leitura automática com nota acima de 90%: o Radar confere.'; }
    else if (melhorAntes && tempo < melhorAntes * 0.92) { status = 'em_analise'; motivo = 'Leitura automática com melhora de mais de 8%: o Radar confere.'; }
  }

  // 3) Pontos
  const temporada = Number(prova.date.slice(0, 4));
  const d: Record<string, number> = { concluir: 10 };
  if (km >= 99.5) d.ultra_100 = 50; else if (km > 42.5) d.ultra = 30; else if (km >= 42) d.maratona = 20; else if (km >= 21) d.meia = 10; else if (km >= 10) d.dez_km = 5;
  if (melhorAntes && tempo < melhorAntes) d.recorde_pessoal = 5;
  if (!(hist ?? []).some(h => Number(String(h.prova_data).slice(0, 4)) === temporada && norm(h.cidade) === norm(prova.city))) d.cidade_nova = 3;
  const hLarg = /^\d{1,2}:\d{2}/.test(prova.start ?? '') ? Number(prova.start!.split(':')[0]) : -1;
  if (hLarg >= 17) d.noturna = 10; // prova à noite (largada a partir das 17h)
  const podio = status === 'verificado' && !!oficial && ((oficial.colocacao_geral ?? 99) <= 3 || (oficial.colocacao_faixa ?? 99) <= 3);
  if (podio) d.podio = 10;
  const pontos = Object.values(d).reduce((a, x) => a + x, 0);

  const { data: novo, error } = await db.from('radar_resultados').insert({
    user_id: user.id, prova_id: prova.id, prova_nome: prova.name, prova_data: prova.date.slice(0, 10), cidade: prova.city, uf: prova.uf,
    largada: prova.start, distancia_km: km, tempo_s: tempo, idade, nota: n, peito: status === 'verificado' ? peito : null, peito_declarado: peito, nome_inscricao: nomeIns || null, link_resultado: link,
    status, motivo_analise: motivo, podio, pontos, detalhes_pontos: d,
  }).select().single();
  if (error) return resp({ erro: error.code === '23505' ? 'Esse número de peito já foi confirmado para outro atleta nessa prova. Fale com o Radar pelo WhatsApp.' : 'Não deu para salvar agora.' }, 400);

  // 4) Medalhas: recalcula a partir do histórico (as regras ficam em _comum/medalhas.ts)
  const todos = [...(hist ?? []), novo];
  const validos = (x: { status: string }) => ['verificado', 'aprovado'].includes(x.status);

  // liga antes x depois (só com resultados válidos)
  const top3 = (lista: typeof todos) => { const v = lista.filter(validos).filter(h => new Date(h.prova_data) >= new Date(Date.now() - 365 * 86400_000)).map(h => Number(h.nota)).sort((a, b) => b - a).slice(0, 3); return v.length ? Math.round(v.reduce((a, x) => a + x, 0) / v.length * 10) / 10 : null; };
  const iAntes = top3(hist ?? []), iDepois = top3(todos);
  const subiu = !!liga(iDepois) && !!liga(iAntes) && LIGAS.indexOf(liga(iDepois)!) > LIGAS.indexOf(liga(iAntes)!);
  // quem correu a mesma prova também pode ganhar (em equipe, pelotão)
  const { data: junto } = await db.from('radar_resultados').select('user_id').eq('prova_id', prova.id).neq('status', 'recusado');
  const ids = [...new Set([user.id, ...(junto ?? []).map(x => x.user_id)])];
  const novas = (await medalhasDe(ids))[user.id] ?? [];
  const { data: final } = await db.from('radar_resultados').select('*').eq('id', novo.id).maybeSingle();

  return resp({ resultado: final ?? novo, nota: n, pontos, detalhes: d, status, motivo, medalhas_novas: novas, indice: iDepois, liga: liga(iDepois), subiu_de_liga: subiu, oficial: status === 'verificado', link_lido: linkLido, gratis });
});
