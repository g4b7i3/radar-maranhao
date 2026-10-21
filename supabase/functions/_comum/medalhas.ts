// Radar Pro · medalhas. Recalcula tudo a partir do histórico e grava só as que faltam
// (nunca tira uma medalha já ganha, a não ser a que está presa a uma prova recusada).
// Participação (distância, cidades, momentos) vale com qualquer status que não seja "recusado".
// Desempenho (tempo, pódio, nota, liga, recorde) só com resultado oficial ("verificado" ou "aprovado").
// deno-lint-ignore-file no-explicit-any
import { acharNoOficial, norm, real } from './resultados.ts';

const SITE = 'https://radarcorridasma.com.br';
let COORD: Record<string, [number, number]> | null = null;

const VAL = (s: string) => s === 'verificado' || s === 'aprovado';
const ano = (d: string) => Number(d.slice(0, 4));
const dia = (d: string) => new Date(d.slice(0, 10) + 'T12:00:00Z');
const DIA = 86400_000;
const classe = (km: number) => (Math.abs(km - 5) <= 0.3 ? '5k' : Math.abs(km - 10) <= 0.3 ? '10k' : km >= 14.5 && km <= 16.5 ? '15k' : Math.abs(km - 21.0975) < 0.3 ? 'meia' : Math.abs(km - 42.195) < 0.3 ? 'maratona' : km > 42.5 ? 'ultra' : null);
const hora = (s: string | null) => (s && /^\d{1,2}:\d{2}/.test(s) ? Number(s.split(':')[0]) * 60 + Number(s.split(':')[1].slice(0, 2)) : null);

const ILHA = ['sao luis', 'sao jose de ribamar', 'paco do lumiar', 'raposa'];
const LENCOIS = ['barreirinhas', 'santo amaro do maranhao', 'santo amaro'];
const TOCANTINA = ['imperatriz', 'acailandia', 'joao lisboa', 'davinopolis', 'governador edison lobao', 'senador la rocque', 'buritirana', 'amarante do maranhao', 'ribamar fiquene', 'montes altos', 'sitio novo', 'cidelandia', 'vila nova dos martirios', 'sao pedro da agua branca', 'itinga do maranhao', 'porto franco', 'estreito', 'campestre do maranhao', 'lajeado novo', 'sao joao do paraiso'];
const LITORAL = ['raposa', 'sao jose de ribamar', 'paco do lumiar', 'alcantara', 'barreirinhas', 'tutoia', 'paulino neves', 'humberto de campos', 'primeira cruz', 'santo amaro do maranhao', 'cururupu', 'guimaraes', 'carutapera', 'luis domingues', 'godofredo viana', 'candido mendes', 'turiacu', 'bacuri', 'apicum acu', 'serrano do maranhao', 'porto rico do maranhao', 'cedral', 'mirinzal', 'central do maranhao', 'agua doce do maranhao', 'araioses', 'icatu', 'axixa', 'bacurituba', 'cajapio'];
const cid = (c: string) => norm(c).replace(/ ma$/, '').trim();

function pascoa(y: number) { // algoritmo de Meeus
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mes = Math.floor((h + l - 7 * m + 114) / 31), di = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, mes - 1, di, 12));
}
const feriado = (d: string) => {
  const md = d.slice(5, 10);
  if (['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'].includes(md)) return true;
  const sexta = new Date(pascoa(ano(d)).getTime() - 2 * DIA).toISOString().slice(0, 10);
  return sexta === d.slice(0, 10);
};
/** chave do fim de semana: sábado e domingo da mesma semana dão a mesma chave */
const fds = (d: string) => { const x = dia(d), w = x.getUTCDay(); return w === 6 ? d.slice(0, 10) : w === 0 ? new Date(x.getTime() - DIA).toISOString().slice(0, 10) : null; };
const MIUDAS = new Set(['corrida', 'run', 'de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'edicao', 'ed', 'etapa', 'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv']);
const serie = (nome: string) => new Set(norm(nome).split(' ').filter(p => p.length > 1 && !/\d/.test(p) && !MIUDAS.has(p)));
const mesmaSerie = (a: string, b: string) => { const A = serie(a), B = serie(b); if (A.size < 1 || B.size < 1) return false; let n = 0; for (const p of A) if (B.has(p)) n++; return n / Math.max(A.size, B.size) >= 0.75; };
const ligaDe = (i: number | null) => (i == null ? null : i >= 65 ? 'elite' : i >= 55 ? 'ouro' : i >= 45 ? 'prata' : 'bronze');
const LIGAS = ['bronze', 'prata', 'ouro', 'elite'];
/** índice da liga numa data: média das 3 melhores notas oficiais dos 12 meses anteriores */
const indiceEm = (rs: any[], ate: Date) => {
  const v = rs.filter(r => VAL(r.status) && dia(r.prova_data) <= ate && dia(r.prova_data) > new Date(ate.getTime() - 365 * DIA)).map(r => Number(r.nota)).sort((a, b) => b - a).slice(0, 3);
  return v.length ? v.reduce((a, x) => a + x, 0) / v.length : null;
};
const distKm = (a: [number, number], b: [number, number]) => { const R = 6371, r = Math.PI / 180, dl = (b[0] - a[0]) * r, dn = (b[1] - a[1]) * r; const h = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };

type Ganho = { medalha: string; temporada: number; resultado_id: string | null };

/**
 * Recalcula as medalhas dos atletas (todos, se ids não vier) e grava as que faltam.
 * Devolve, por atleta, as medalhas novas.
 */
export async function atualizarMedalhas(db: any, ids?: string[]): Promise<Map<string, string[]>> {
  if (!COORD) COORD = await fetch(SITE + '/data/cidades-ma-geo.json').then(r => r.json()).catch(() => null);
  const coord = new Map(Object.entries(COORD ?? {}).map(([k, v]) => [cid(k), v as [number, number]]));
  const [{ data: todos }, { data: perfis }, { data: ass }, { data: duelos }] = await Promise.all([
    db.from('radar_resultados').select('id, user_id, prova_id, prova_nome, prova_data, cidade, largada, distancia_km, tempo_s, nota, status, podio, peito, nome_inscricao, criado_em').neq('status', 'recusado').limit(50000),
    db.from('radar_perfis').select('user_id, nome_completo, nascimento, assessoria'),
    db.from('radar_assinaturas').select('user_id, valida_ate, atualizado_em'),
    db.from('radar_duelos').select('id, desafiante, desafiado, distancia_km, mes, aceito_em').not('aceito_em', 'is', null),
  ]);
  const porUser = new Map<string, any[]>();
  for (const r of todos ?? []) { if (!porUser.has(r.user_id)) porUser.set(r.user_id, []); porUser.get(r.user_id)!.push(r); }
  for (const l of porUser.values()) l.sort((a, b) => a.prova_data.localeCompare(b.prova_data) || String(a.criado_em).localeCompare(String(b.criado_em)));
  const perfil = new Map((perfis ?? []).map((p: any) => [p.user_id, p]));
  const alvo = ids ?? [...new Set([...porUser.keys(), ...(ass ?? []).map((a: any) => a.user_id)])];

  // modalidade (trail) vem do arquivo de provas
  const provaIds = [...new Set((todos ?? []).filter((r: any) => alvo.includes(r.user_id)).map((r: any) => r.prova_id))];
  const modal = new Map<string, string>();
  for (let i = 0; i < provaIds.length; i += 200) {
    const { data } = await db.from('radar_provas').select('id, modalidade').in('id', provaIds.slice(i, i + 200));
    for (const p of data ?? []) if (p.modalidade) modal.set(p.id, p.modalidade);
  }

  // colocação no resultado oficial (só para resultados verificados)
  const oficiais = new Map<string, any[]>();
  const colocacao = async (r: any, nomeCompleto: string) => {
    if (r.status !== 'verificado') return null;
    if (!oficiais.has(r.prova_id)) {
      const { data } = await db.from('radar_resultados_oficiais').select('nome, nome_norm, peito, tempo_s, distancia_km, sexo, colocacao_geral, colocacao_faixa').eq('prova_id', r.prova_id).limit(20000);
      oficiais.set(r.prova_id, data ?? []);
    }
    const ofs = oficiais.get(r.prova_id)!;
    if (!ofs.length) return null;
    const km = Number(r.distancia_km);
    const of = (r.peito && ofs.find(o => o.peito === r.peito && (o.distancia_km == null || Math.abs(real(Number(o.distancia_km)) - km) < 0.2)))
      || acharNoOficial(ofs, km, { peito: null, nomePerfil: nomeCompleto, nomeBusca: r.nome_inscricao || nomeCompleto, tempo: r.tempo_s }).of;
    if (!of) return null;
    const total = ofs.filter(o => o.sexo === (of as any).sexo && (o.distancia_km == null || Math.abs(real(Number(o.distancia_km)) - km) < 0.2)).length;
    return { geral: of.colocacao_geral as number | null, faixa: of.colocacao_faixa as number | null, total };
  };

  // pelotão atual: até 25 atletas da mesma liga, pela ordem do índice (igual ao ranking)
  const agora = new Date();
  const ativos = (ass ?? []).filter((a: any) => a.valida_ate && new Date(a.valida_ate) > agora).map((a: any) => a.user_id);
  const idx: { u: string; i: number | null }[] = ativos.map((u: string) => ({ u, i: indiceEm(porUser.get(u) ?? [], agora) }));
  const grupo = new Map<string, string>();
  for (const lg of LIGAS) {
    const doLiga = idx.filter(x => (ligaDe(x.i) ?? 'bronze') === lg).sort((a, b) => (b.i ?? -1) - (a.i ?? -1));
    doLiga.forEach((x, k) => grupo.set(x.u, `${lg}-${Math.floor(k / 25)}`));
  }
  const porProva = new Map<string, any[]>();
  for (const r of todos ?? []) { if (!porProva.has(r.prova_id)) porProva.set(r.prova_id, []); porProva.get(r.prova_id)!.push(r); }

  const novasPorUser = new Map<string, string[]>();
  for (const u of alvo) {
    const rs = porUser.get(u) ?? [];
    const p: any = perfil.get(u);
    const g: Ganho[] = [];
    const ja = new Set<string>();
    const dar = (m: string, temporada: number, r: any = null) => { const k = `${m}|${temporada}`; if (!ja.has(k)) { ja.add(k); g.push({ medalha: m, temporada, resultado_id: r?.id ?? null }); } };
    const darUmaVez = (m: string, temporada: number, r: any = null) => { if (![...ja].some(k => k.startsWith(m + '|'))) dar(m, temporada, r); };

    // ---------- por resultado ----------
    const vistos = new Set<string>();
    let melhor = new Map<string, number>(); // por distância: melhor tempo até aqui
    let ligaAntes: string | null = null;
    const recordesAno = new Map<number, Set<string>>();
    const recordesQtd = new Map<number, number>();
    const podiosAno = new Map<number, number>();
    let titulos = 0;
    for (const r of rs) {
      const y = ano(r.prova_data), km = Number(r.distancia_km), cl = classe(km), c = cid(r.cidade ?? ''), dt = r.prova_data.slice(0, 10), mes = Number(dt.slice(5, 7));
      if (!vistos.size) darUmaVez('primeira_prova', y, r);
      const primeira: Record<string, string> = { '5k': 'primeiro_5k', '10k': 'primeiro_10k', '15k': 'primeiro_15k', meia: 'primeira_meia', maratona: 'primeira_maratona', ultra: 'ultra' };
      if (cl && !vistos.has(cl)) darUmaVez(primeira[cl], y, r);
      if (cl) vistos.add(cl); vistos.add('x');
      if (/trail/i.test(modal.get(r.prova_id) ?? '')) darUmaVez('trilheiro', y, r);
      if (c === 'sao luis') dar('capital', y, r);
      if (c && !ILHA.includes(c)) dar('interior', y, r);
      if (LENCOIS.includes(c)) dar('lencois', y, r);
      if (TOCANTINA.includes(c)) dar('tocantina', y, r);
      if (LITORAL.includes(c)) dar('litoral', y, r);
      const h = hora(r.largada);
      if (h != null && h < 360) dar('madrugador', y, r);
      if (h != null && h >= 17 * 60) dar('night_run', y, r);
      if (h != null && h >= 450 && h < 720) dar('sol_forte', y, r);
      if (p?.nascimento) { const niver = new Date(`${y}-${p.nascimento.slice(5, 10)}T12:00:00Z`); if (Math.abs(dia(dt).getTime() - niver.getTime()) <= 3 * DIA) dar('aniversario', y, r); }
      if (mes === 12) dar('fecha_o_ano', y, r);
      if (mes === 1) dar('primeira_do_ano', y, r);
      if (mes === 6) dar('sao_joao', y, r);
      if (mes === 10) dar('outubro_rosa', y, r);
      if (mes === 11) dar('novembro_azul', y, r);
      if (c === 'sao luis' && Math.abs(dia(dt).getTime() - dia(`${y}-09-08`).getTime()) <= 3 * DIA) dar('aniversario_slz', y, r);
      if (feriado(dt)) dar('feriado', y, r);

      // em equipe: mais 2 atletas da mesma assessoria na mesma prova
      const ass0 = norm(p?.assessoria ?? '');
      if (ass0) {
        const colegas = new Set((porProva.get(r.prova_id) ?? []).filter(o => o.user_id !== u && norm((perfil.get(o.user_id) as any)?.assessoria ?? '') === ass0).map(o => o.user_id));
        if (colegas.size >= 2) dar('em_equipe', y, r);
      }
      // pelotão
      const meuGrupo = grupo.get(u);
      if (meuGrupo) {
        const naProva = (porProva.get(r.prova_id) ?? []).filter(o => grupo.get(o.user_id) === meuGrupo);
        if (naProva.some(o => o.user_id !== u)) dar('no_pelotao', y, r);
        const val = naProva.filter(o => VAL(o.status));
        if (VAL(r.status) && val.length >= 2 && val.every(o => o.user_id === u || Number(o.nota) < Number(r.nota))) dar('lider_pelotao', y, r);
      }

      // ---------- desempenho: só oficial ----------
      const chaveDist = cl ?? String(Math.round(km * 10) / 10);
      const antes = melhor.get(chaveDist);
      if (VAL(r.status)) {
        const t = r.tempo_s;
        if (cl === '5k') { if (t < 1800) dar('sub30_5k', y, r); if (t < 1500) dar('sub25_5k', y, r); if (t < 1320) dar('sub22_5k', y, r); if (t < 1200) dar('sub20_5k', y, r); }
        if (cl === '10k') { if (t < 3600) dar('sub60_10k', y, r); if (t < 3000) dar('sub50_10k', y, r); if (t < 2700) dar('sub45_10k', y, r); if (t < 2400) dar('sub40_10k', y, r); }
        if (cl === 'meia') { if (t < 7200) dar('sub2h_meia', y, r); if (t < 6300) dar('sub145_meia', y, r); }
        if (cl === 'maratona') { if (t < 14400) dar('sub4h_maratona', y, r); if (t < 12600) dar('sub330_maratona', y, r); }
        if (km >= 4.9 && t / km < 240) dar('pace_4', y, r);
        const n = Number(r.nota);
        if (n >= 50) dar('nota_50', y, r); if (n >= 60) dar('nota_60', y, r); if (n >= 70) dar('nota_70', y, r); if (n >= 80) dar('nota_80', y, r);
        if (antes != null && t < antes) {
          dar('recorde_pessoal', y, r);
          recordesQtd.set(y, (recordesQtd.get(y) ?? 0) + 1);
          if (!recordesAno.has(y)) recordesAno.set(y, new Set()); recordesAno.get(y)!.add(chaveDist);
          if (recordesQtd.get(y)! >= 3) dar('recorde_3', y, r);
          if (recordesAno.get(y)!.size >= 2) dar('recorde_duplo', y, r);
        }
        // voltei melhor: mesma prova, ano anterior, mesma distância, tempo menor
        if (rs.some(o => o !== r && ano(o.prova_data) < y && Math.abs(Number(o.distancia_km) - km) < 0.2 && o.tempo_s > t && mesmaSerie(o.prova_nome, r.prova_nome))) dar('voltei_melhor', y, r);
        // colocação
        const col = await colocacao(r, p?.nome_completo ?? '');
        const podioFaixa = (col?.faixa ?? 99) <= 3 || (!col && r.podio), podioGeral = (col?.geral ?? 99) <= 3, campeao = col?.geral === 1 || col?.faixa === 1;
        if (podioFaixa) dar('podio', y, r);
        if (podioGeral) dar('podio_geral', y, r);
        if (podioFaixa || podioGeral) { podiosAno.set(y, (podiosAno.get(y) ?? 0) + 1); if (podiosAno.get(y)! >= 3) dar('3_podios', y, r); }
        if (campeao) { dar('campeao', y, r); titulos++; if (titulos >= 2) darUmaVez('bicampeao', y, r); }
        if (col?.geral && col.geral <= 10) dar('top_10', y, r);
        if (col?.geral && col.total >= 20 && col.geral <= Math.ceil(col.total * 0.1)) dar('top_10pct', y, r);
        if (col?.geral && col.total >= 10 && col.geral <= col.total / 2) dar('metade_de_cima', y, r);
        // liga
        const i = indiceEm(rs, dia(dt)), lg = ligaDe(i);
        if (lg && ligaAntes && LIGAS.indexOf(lg) > LIGAS.indexOf(ligaAntes)) dar('subiu_de_liga', y, r);
        if (lg === 'ouro' || lg === 'elite') darUmaVez('liga_ouro', y, r);
        if (lg === 'elite') darUmaVez('liga_elite', y, r);
        if (lg) ligaAntes = lg;
      }
      melhor.set(chaveDist, Math.min(antes ?? Infinity, r.tempo_s));
    }

    // ---------- temporada ----------
    const anos = [...new Set(rs.map(r => ano(r.prova_data)))];
    for (const y of anos) {
      const ry = rs.filter(r => ano(r.prova_data) === y);
      const nth = (n: number) => ry[n - 1];
      for (const n of [5, 10, 20, 30]) if (ry.length >= n) dar(`${n}_provas`, y, nth(n));
      const cids: string[] = []; for (const r of ry) { const c = cid(r.cidade ?? ''); if (c && !cids.includes(c)) { cids.push(c); for (const n of [3, 5, 10]) if (cids.length === n) dar(`${n}_cidades`, y, r); } }
      let soma = 0; for (const r of ry) { const a = soma; soma += Number(r.distancia_km); for (const n of [100, 250, 500]) if (a < n && soma >= n) dar(`${n}_km`, y, r); }
      const meses = new Map<number, number>(); for (const r of ry) { const m = Number(r.prova_data.slice(5, 7)); meses.set(m, (meses.get(m) ?? 0) + 1); if (meses.get(m) === 3) dar('mes_cheio', y, r); if (meses.size === 6) dar('todo_mes', y, r); }
      const domingos = ry.filter(r => dia(r.prova_data).getUTCDay() === 0); if (domingos.length >= 5) dar('domingueiro', y, domingos[4]);
      const oficiaisY = ry.filter(r => VAL(r.status)); if (oficiaisY.length >= 5) dar('oficial_5', y, oficiaisY[4]);
      const meias = ry.filter(r => classe(Number(r.distancia_km)) === 'meia'); if (meias.length >= 2) dar('meia_dupla', y, meias[1]);
      const mar = ry.filter(r => classe(Number(r.distancia_km)) === 'maratona'); if (mar.length >= 2) dar('maratona_dupla', y, mar[1]);
      // fim de semana
      const porFds = new Map<string, any[]>(); for (const r of ry) { const k = fds(r.prova_data) ?? r.prova_data.slice(0, 10); if (!porFds.has(k)) porFds.set(k, []); porFds.get(k)!.push(r); }
      for (const l of porFds.values()) if (new Set(l.map(r => r.prova_id)).size >= 2) dar('dobradinha', y, l[1]);
      const sab = [...new Set(ry.map(r => fds(r.prova_data)).filter(Boolean) as string[])].sort();
      for (let k = 2; k < sab.length; k++) if (dia(sab[k]).getTime() - dia(sab[k - 1]).getTime() === 7 * DIA && dia(sab[k - 1]).getTime() - dia(sab[k - 2]).getTime() === 7 * DIA) { dar('trinca', y, ry.find(r => fds(r.prova_data) === sab[k])); break; }
    }

    // ---------- carreira ----------
    for (const n of [25, 50, 100]) if (rs.length >= n) darUmaVez(`carreira_${n}`, ano(rs[n - 1].prova_data), rs[n - 1]);
    { let s = 0; for (const r of rs) { s += Number(r.distancia_km); if (s >= 1000) { darUmaVez('carreira_1000km', ano(r.prova_data), r); break; } } }
    { const cs: string[] = []; for (const r of rs) { const c = cid(r.cidade ?? ''); if (c && !cs.includes(c)) { cs.push(c); if (cs.length === 20) darUmaVez('20_cidades', ano(r.prova_data), r); if (ILHA.every(x => cs.includes(x))) darUmaVez('ilha_completa', ano(r.prova_data), r); } } }
    { const pts: [number, number][] = []; for (const r of rs) { const xy = coord.get(cid(r.cidade ?? '')); if (!xy) continue; if (pts.some(q => distKm(q, xy) >= 400)) { darUmaVez('cruzou_o_ma', ano(r.prova_data), r); break; } pts.push(xy); } }
    { const as = [...new Set(rs.map(r => ano(r.prova_data)))]; if (as.length >= 2) { const r = rs.find(x => ano(x.prova_data) === as[1]); darUmaVez('duas_temporadas', as[1], r); } }
    { const d: number[] = []; for (const r of rs) { const k = Math.round(Number(r.distancia_km)); if (!d.includes(k)) { d.push(k); if (d.length === 4) darUmaVez('colecionador', ano(r.prova_data), r); } } }
    { const cl = new Set<string>(); for (const r of rs) { const c = classe(Number(r.distancia_km)); if (c) cl.add(c); if (['5k', '10k', 'meia', 'maratona'].every(x => cl.has(x))) { darUmaVez('grand_slam', ano(r.prova_data), r); break; } } }
    for (let k = 0; k < rs.length; k++) { const r = rs[k]; if (rs.slice(0, k).some(o => ano(o.prova_data) !== ano(r.prova_data) && mesmaSerie(o.prova_nome, r.prova_nome))) { darUmaVez('fiel', ano(r.prova_data), r); break; } }
    for (let k = 1; k < rs.length; k++) if (dia(rs[k].prova_data).getTime() - dia(rs[k - 1].prova_data).getTime() >= 90 * DIA) { dar('de_volta', ano(rs[k].prova_data), rs[k]); }
    { const ms = [...new Set(rs.map(r => r.prova_data.slice(0, 7)))].sort(); const n = (m: string) => { const [a, b] = m.split('-').map(Number); return a * 12 + b; };
      for (let k = 2; k < ms.length; k++) if (n(ms[k]) - n(ms[k - 1]) === 1 && n(ms[k - 1]) - n(ms[k - 2]) === 1) { dar('sequencia_3', Number(ms[k].slice(0, 4)), rs.find(r => r.prova_data.startsWith(ms[k]))); } }

    // ---------- Radar ----------
    const a0 = (ass ?? []).find((a: any) => a.user_id === u);
    if (a0?.valida_ate && new Date(a0.atualizado_em ?? a0.valida_ate) < new Date('2027-01-01T03:00:00Z')) darUmaVez('fundador', 2026);

    // ---------- duelos (só os aceitos; o resultado vale depois que o mês acaba) ----------
    const meus = (duelos ?? []).filter((d: any) => d.desafiante === u || d.desafiado === u).sort((a: any, b: any) => a.mes.localeCompare(b.mes));
    if (meus.length >= 10) darUmaVez('duelos_10', ano(meus[9].mes));
    const contra = new Map<string, number>();
    let seguidas = 0;
    for (const d of meus) {
      const adv = d.desafiante === u ? d.desafiado : d.desafiante, y = ano(d.mes);
      contra.set(adv, (contra.get(adv) ?? 0) + 1); if (contra.get(adv) === 5) dar('rival', y);
      const fim = new Date(dia(d.mes).getTime()); fim.setUTCMonth(fim.getUTCMonth() + 1);
      if (fim > agora) continue;
      const melhorNota = (uid: string) => { const v = (porUser.get(uid) ?? []).filter(r => VAL(r.status) && r.prova_data.slice(0, 7) === d.mes.slice(0, 7) && Math.abs(Number(r.distancia_km) - Number(d.distancia_km)) < 0.2).map(r => Number(r.nota)); return v.length ? Math.max(...v) : null; };
      const eu = melhorNota(u), ele = melhorNota(adv);
      const venci = eu != null && (ele == null || eu > ele);
      if (venci) {
        dar('duelista', y); seguidas++; if (seguidas >= 3) dar('invicto', y);
        const li = ligaDe(indiceEm(porUser.get(u) ?? [], fim)), la = ligaDe(indiceEm(porUser.get(adv) ?? [], fim));
        if (li && la && LIGAS.indexOf(la) > LIGAS.indexOf(li)) dar('virada', y);
      } else if (eu != null || ele != null) seguidas = 0;
    }

    // medalha presa a uma prova recusada sai, para poder ser ganha de novo com uma prova válida
    const { data: recusadas } = await db.from('radar_resultados').select('id').eq('user_id', u).eq('status', 'recusado');
    if (recusadas?.length) await db.from('radar_medalhas').delete().eq('user_id', u).in('resultado_id', recusadas.map((x: any) => x.id));
    if (g.length) {
      const { data: ins } = await db.from('radar_medalhas').upsert(g.map(x => ({ user_id: u, ...x })), { onConflict: 'user_id,medalha,temporada', ignoreDuplicates: true }).select('medalha');
      novasPorUser.set(u, (ins ?? []).map((x: any) => x.medalha));
    } else novasPorUser.set(u, []);
  }
  return novasPorUser;
}
