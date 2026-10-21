// Radar Pro · leitura dos resultados oficiais das cronometragens e conferência dos registros.
// Formatos lidos direto (sem navegador):
//  - Racezone (SA Crono, RaceTag, Meta Sport…): <base>/#/<prova> → <base>/data/events.json, data/<id>/event.json e results.json
//  - Wiclax .clax (Crono Esportes / resultadonline…): <host>/?f=<pasta>/<arquivo>.clax → <host>/<pasta>/<arquivo>.clax
// Só guardamos nome, peito, sexo, faixa, tempo e colocação (nada de CPF ou outros dados das planilhas).
// deno-lint-ignore-file no-explicit-any

export type Linha = { distancia_km: number | null; nome: string; peito: string | null; tempo_s: number; sexo: 'F' | 'M' | null; faixa: string | null; colocacao_geral: number | null; colocacao_faixa: number | null; idade?: number | null };
export type Lido = { fonte: string; evento: string; data: string | null; linhas: Linha[] };

const UA = { 'User-Agent': 'Mozilla/5.0 (RadarCorridasMA; +https://radarcorridasma.com.br)' };
const pegar = async (url: string, json = true) => {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(25_000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} em ${url}`);
  return json ? r.json() : r.text();
};
export const norm = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
export const real = (k: number) => (Math.abs(k - 21) < 0.2 ? 21.0975 : Math.abs(k - 42) < 0.3 ? 42.195 : k);

// ---------- nomes ----------
const MIUDAS = new Set(['de', 'da', 'do', 'das', 'dos', 'del', 'e', 'di', 'du']);
const partes = (s: string) => norm(s).split(' ').filter(p => p.length >= 2 && !MIUDAS.has(p));
/** Quantos nomes os dois têm em comum (ignora de/da/dos). */
export const comuns = (a: string, b: string) => { const B = new Set(partes(b)); return partes(a).filter(p => B.has(p)).length; };
/** Regra do Vinik: o nome tem que ter pelo menos um nome do nome completo da pessoa. */
export const semelhante = (a: string, b: string) => comuns(a, b) >= 1;

// ---------- tempos ----------
/** "00:38:48.189", "00h14'47,892", "1:05:20" → segundos inteiros */
export function seg(t: unknown): number | null {
  const m = String(t ?? '').trim().match(/^(?:(\d+)[h:])?(\d{1,2})[':](\d{1,2})(?:[.,'](\d+))?/);
  if (!m) return null;
  const s = Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  return s > 0 ? s : null;
}

/** Descarta tempos impossíveis (chip lido errado, desistência): mais rápido que 2:30/km. */
const possivel = (km: number | null, t: number) => !km || t / km >= 150;

/** Colocação geral (por distância + sexo) e na faixa (por distância + faixa). */
function colocar(linhas: Linha[]) {
  const ord = [...linhas].sort((a, b) => a.tempo_s - b.tempo_s);
  const g = new Map<string, number>(), f = new Map<string, number>();
  for (const l of ord) {
    const kg = `${l.distancia_km}|${l.sexo}`, kf = `${l.distancia_km}|${l.faixa}`;
    g.set(kg, (g.get(kg) ?? 0) + 1); l.colocacao_geral = g.get(kg)!;
    if (l.faixa) { f.set(kf, (f.get(kf) ?? 0) + 1); l.colocacao_faixa = f.get(kf)!; }
  }
  return linhas;
}

// ---------- Racezone ----------
async function racezone(url: string): Promise<Lido | null> {
  const [antes, slug] = url.split('#/');
  if (!slug) return null;
  const base = antes.replace(/[?].*$/, '').replace(/\/?$/, '/');
  const eventos: any[] = await pegar(base + 'data/events.json');
  const ev = eventos.find(e => e.link === slug.replace(/[/?].*$/, ''));
  if (!ev) return null;
  const [info, res]: any[] = await Promise.all([pegar(`${base}data/${ev.id}/event.json`), pegar(`${base}data/${ev.id}/results.json`)]);
  const rotas = new Map<string, number | null>((info.routes ?? []).map((r: any) => [r.i, r.d ? real(r.d / 1000) : null]));
  const cats = new Map<string, string>((info.categories ?? []).map((c: any) => [c.i, c.n]));
  const linhas: Linha[] = [];
  const temRank = res.some((r: any) => r.rg != null);
  for (const r of res) {
    const t = seg(r.tn) ?? seg(r.tg);
    if (!t || !r.nm || (temRank && r.rg == null)) continue; // sem colocação = não concluiu
    if (!possivel(rotas.get(r.r) ?? null, t)) continue;
    linhas.push({ distancia_km: rotas.get(r.r) ?? null, nome: String(r.nm).trim(), peito: r.n != null ? String(r.n) : null, tempo_s: t, sexo: r.g === 'F' || r.g === 'M' ? r.g : null, faixa: cats.get(r.c) ?? null, colocacao_geral: null, colocacao_faixa: null, idade: Number(r.a) >= 5 && Number(r.a) <= 100 ? Number(r.a) : null });
  }
  return { fonte: new URL(base).hostname, evento: ev.name, data: ev.startDate ?? null, linhas: colocar(linhas) };
}

// ---------- Wiclax (.clax) ----------
const attrs = (tag: string) => Object.fromEntries([...tag.matchAll(/(\w+)="([^"]*)"/g)].map(m => [m[1], m[2].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")]));
async function wiclax(url: string): Promise<Lido | null> {
  const u = new URL(url);
  const arq = u.searchParams.get('f') ? `${u.origin}/${u.searchParams.get('f')}` : /\.clax$/i.test(u.pathname) ? url : null;
  if (!arq) return null;
  const xml: string = await pegar(arq.replace(/ /g, '%20'), false);
  const ep = attrs(xml.match(/<Epreuve [^>]*>/)?.[0] ?? '');
  const pcs = new Map<string, { km: number | null; ok: boolean }>();
  for (const m of xml.matchAll(/<Pcs [^>]*\/?>/g)) { const a = attrs(m[0]); pcs.set(a.nom, { km: Number(a.distance) > 0 ? real(Number(a.distance) / 1000) : null, ok: !a.noPlaces && Number(a.distance) > 0 }); }
  const eng = new Map<string, Record<string, string>>();
  const blocoE = xml.match(/<Engages>([\s\S]*?)<\/Engages>/)?.[1] ?? '';
  for (const m of blocoE.matchAll(/<E [^>]*\/>/g)) { const a = attrs(m[0]); if (a.d) eng.set(a.d, a); }
  const blocoR = xml.match(/<Resultats>([\s\S]*?)<\/Resultats>/)?.[1] ?? '';
  const linhas: Linha[] = [];
  const anoProva = ep.date && /^\d+$/.test(ep.date) ? new Date(Date.UTC(1899, 11, 30) + Number(ep.date) * 86400_000).getUTCFullYear() : new Date().getUTCFullYear();
  for (const m of blocoR.matchAll(/<R [^>]*\/>/g)) {
    const r = attrs(m[0]); const e = eng.get(r.d); if (!e?.n) continue;
    const p = pcs.get(e.p); if (p && !p.ok) continue; // "análise", "tempo não oficial"
    const t = seg(r.re) ?? seg(r.t); if (!t || !possivel(p?.km ?? null, t)) continue;
    linhas.push({ distancia_km: p?.km ?? null, nome: e.n.trim(), peito: r.d, tempo_s: t, sexo: e.x === 'F' || e.x === 'M' ? e.x : null, faixa: e.ca || null, colocacao_geral: null, colocacao_faixa: null, idade: Number(e.a) > 1900 && anoProva - Number(e.a) >= 5 && anoProva - Number(e.a) <= 100 ? anoProva - Number(e.a) : null });
  }
  // data do Excel (dias desde 1899-12-30)
  const data = ep.date && /^\d+$/.test(ep.date) ? new Date(Date.UTC(1899, 11, 30) + Number(ep.date) * 86400_000).toISOString().slice(0, 10) : null;
  return { fonte: u.hostname, evento: ep.nom ?? '', data, linhas: colocar(linhas) };
}

/** Sites de cronometragem que o Radar sabe ler. */
export const HOSTS = ['resultadonline.com.br', 'racetag.com.br', 'sacrono.com.br', 'metasportoficial.com', 'cronoesportes.com.br'];
/** Lê um link de resultado. Devolve null se o formato não é conhecido. */
export async function lerLink(url: string): Promise<Lido | null> {
  let u: URL; try { u = new URL(url.trim()); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (!HOSTS.some(h => u.hostname === h || u.hostname.endsWith('.' + h))) return null; // só cronometragens conhecidas
  if (/\.clax/i.test(url) || u.searchParams.get('f')?.endsWith('.clax')) return wiclax(url);
  if (url.includes('#/')) return racezone(url);
  return null;
}

// ---------- onde as cronometragens listam os resultados ----------
export type EventoRes = { nome: string; data: string; url: string };
export async function listarEventos(): Promise<EventoRes[]> {
  const out: EventoRes[] = [];
  const rz = ['https://result.racetag.com.br/sacrono/', 'https://www.sacrono.com.br/resultados/racetag/', 'https://resultados.metasportoficial.com/'];
  await Promise.all(rz.map(async base => {
    try { for (const e of await pegar(base + 'data/events.json')) if (e.link && e.startDate) out.push({ nome: e.name, data: e.startDate, url: `${base}#/${e.link}` }); } catch { /* fonte fora do ar */ }
  }));
  const hoje = new Date(Date.now() - 3 * 3600_000);
  const dias = [0, 1].map(k => new Date(hoje.getTime() - k * 86400_000).toISOString().slice(0, 10).replace(/-/g, ''));
  await Promise.all(['cronoesportes', 'sacrono'].map(async cli => {
    for (const d of dias) {
      try {
        const j = await pegar(`https://www.${cli}.com.br/session/${d}_${cli}_events.json`);
        // percorre tudo: qualquer objeto com nome + data dd/mm/aaaa e links de resultado (.clax ou Racezone)
        const visitar = (o: any) => {
          if (!o || typeof o !== 'object') return;
          if (Array.isArray(o)) { o.forEach(visitar); return; }
          const nome = o.nome ?? o.eve_nome, data = String(o.data ?? o.eve_data_evento ?? '');
          const m = data.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
          if (nome && m) {
            const links = JSON.stringify(o).replace(/\\\//g, '/').match(/https?:\/\/[^"\s]+?(?:\.clax|#\/[^"\s]+)/g) ?? [];
            for (const l of new Set(links)) out.push({ nome: String(nome), data: `${m[3]}-${m[2]}-${m[1]}`, url: l });
            return;
          }
          Object.values(o).forEach(visitar);
        };
        visitar(j);
        break;
      } catch { /* tenta o dia anterior */ }
    }
  }));
  return out;
}

const PALAVRAS_COMUNS = new Set(['corrida', 'run', 'rua', 'edicao', 'etapa', 'circuito', 'de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', '1a', '2a', '3a', '4a', '5a', '6a', '7a', '8a', '9a', '10a', 'ma', 'maranhao', 'oficial', 'resultado', 'resultados', 'km', '5k', '10k', '21k']);
const raiz = (p: string) => (p.length > 5 && /[rzl]es$/.test(p) ? p.slice(0, -2) : p.length > 3 && p.endsWith('s') ? p.slice(0, -1) : p); // professores → professor
const chave = (s: string) => new Set(norm(s).split(' ').filter(p => p.length > 1 && !PALAVRAS_COMUNS.has(p) && !/^20\d\d$/.test(p)).map(raiz));
/** Parecença entre o nome da prova no Radar e o nome do evento na cronometragem (0 a 1). */
export function parecenca(a: string, b: string) {
  const A = chave(a), Bc = chave(b); if (!A.size || !Bc.size) return 0;
  let n = 0; for (const p of A) if (Bc.has(p)) n++;
  return n / Math.min(A.size, Bc.size);
}

// ---------- leitura em páginas (o banco devolve no máximo 1000 linhas por vez) ----------
export async function paginar(consulta: (de: number, ate: number) => any): Promise<any[]> {
  const out: any[] = [];
  for (let de = 0; de < 50000; de += 1000) {
    const { data, error } = await consulta(de, de + 999);
    if (error || !data?.length) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}
export const lerOficiais = (db: any, prova: string, cols = 'nome, nome_norm, peito, tempo_s, distancia_km, sexo, idade, colocacao_geral, colocacao_faixa, fonte_url') =>
  paginar((de, ate) => db.from('radar_resultados_oficiais').select(cols).eq('prova_id', prova).order('id').range(de, ate));

// ---------- gravar e conferir ----------
export async function gravarOficiais(db: any, prova: string, fonte_url: string, linhas: Linha[]) {
  const rows = linhas.slice(0, 20000).map(l => ({ prova_id: prova, distancia_km: l.distancia_km, nome: l.nome.slice(0, 120), nome_norm: norm(l.nome), peito: l.peito ? l.peito.replace(/\D/g, '').slice(0, 8) || null : null, tempo_s: l.tempo_s, sexo: l.sexo, faixa: l.faixa?.slice(0, 30) ?? null, colocacao_geral: l.colocacao_geral, colocacao_faixa: l.colocacao_faixa, idade: l.idade ?? null, fonte_url: fonte_url.slice(0, 400) }));
  await db.from('radar_resultados_oficiais').delete().eq('prova_id', prova);
  for (let i = 0; i < rows.length; i += 1000) {
    const { error } = await db.from('radar_resultados_oficiais').insert(rows.slice(i, i + 1000));
    if (error) throw new Error(error.message);
  }
  await db.from('radar_provas').update({ link_resultado: fonte_url, resultado_em: new Date().toISOString() }).eq('id', prova);
  return rows.length;
}

type Of = { nome: string; nome_norm: string; peito: string | null; tempo_s: number; distancia_km: number | null; colocacao_geral: number | null; colocacao_faixa: number | null };
/**
 * Acha a pessoa no resultado oficial.
 *  - com peito: o dono do número tem que ter pelo menos um nome do perfil; senão é "outro atleta".
 *  - sem peito: procura pelo nome (da inscrição, se tiver 2+ nomes, ou do perfil) com 2+ nomes em comum; o tempo declarado desempata.
 */
export function acharNoOficial(ofs: Of[], km: number, o: { peito: string | null; nomePerfil: string; nomeBusca: string; tempo?: number | null }): { of: Of | null; outroAtleta: boolean } {
  const naDist = ofs.filter(x => x.distancia_km == null || Math.abs(real(Number(x.distancia_km)) - km) < 0.2);
  if (o.peito) {
    const dono = naDist.find(x => x.peito && x.peito.replace(/\D/g, '') === o.peito);
    if (dono) return semelhante(dono.nome, o.nomePerfil) ? { of: dono, outroAtleta: false } : { of: null, outroAtleta: true };
  }
  // só um nome na inscrição é pouco para achar sem peito: aí procura pelo nome completo do perfil
  const busca = partes(o.nomeBusca).length >= 2 ? o.nomeBusca : o.nomePerfil;
  if (partes(busca).length < 2) return { of: null, outroAtleta: false };
  let cands = naDist.filter(x => comuns(x.nome, busca) >= 2 && semelhante(x.nome, o.nomePerfil));
  if (cands.length > 1 && o.tempo) cands = cands.filter(x => Math.abs(x.tempo_s - o.tempo!) <= 10);
  if (cands.length > 1) { const max = Math.max(...cands.map(x => comuns(x.nome, busca))); cands = cands.filter(x => comuns(x.nome, busca) === max); }
  return { of: cands.length === 1 ? cands[0] : null, outroAtleta: false };
}

/** Confere quem registrou a prova antes do resultado sair. */
export async function conferirRegistros(db: any, prova: string) {
  const ofs = await lerOficiais(db, prova);
  if (!ofs.length) return { verificados: 0, divergentes: 0, recusados: 0 };
  const { data: regs } = await db.from('radar_resultados').select('id, user_id, distancia_km, tempo_s, peito_declarado, nome_inscricao, status, detalhes_pontos').eq('prova_id', prova).in('status', ['declarado', 'em_analise']);
  let verificados = 0, divergentes = 0, recusados = 0;
  if (!regs?.length) return { verificados, divergentes, recusados };
  const { data: perfis } = await db.from('radar_perfis').select('user_id, nome_completo').in('user_id', regs.map((r: any) => r.user_id));
  const nomes = new Map((perfis ?? []).map((p: any) => [p.user_id, p.nome_completo]));
  for (const r of regs) {
    const nomePerfil = String(nomes.get(r.user_id) ?? '');
    const { of, outroAtleta } = acharNoOficial(ofs, Number(r.distancia_km), { peito: r.peito_declarado, nomePerfil, nomeBusca: r.nome_inscricao || nomePerfil, tempo: r.tempo_s });
    if (outroAtleta) {
      await db.from('radar_resultados').update({ status: 'recusado', motivo_analise: 'O número de peito pertence a outro atleta no resultado oficial.' }).eq('id', r.id);
      await db.from('radar_medalhas').delete().eq('resultado_id', r.id);
      recusados++; continue;
    }
    if (!of) continue;
    const podio = (of.colocacao_geral ?? 99) <= 3 || (of.colocacao_faixa ?? 99) <= 3;
    if (Math.abs(of.tempo_s - r.tempo_s) <= 5) {
      const det = { ...(r.detalhes_pontos ?? {}) } as Record<string, number>;
      if (podio && !det.podio) det.podio = 10;
      const pontos = Object.values(det).reduce((a, x) => a + Number(x), 0);
      const { error } = await db.from('radar_resultados').update({ status: 'verificado', motivo_analise: null, podio, detalhes_pontos: det, pontos, peito: of.peito ?? r.peito_declarado }).eq('id', r.id);
      if (error) { await db.from('radar_resultados').update({ status: 'em_analise', motivo_analise: 'Peito já confirmado para outro atleta: conferir.' }).eq('id', r.id); divergentes++; } else verificados++;
    } else {
      await db.from('radar_resultados').update({ status: 'em_analise', motivo_analise: `Tempo diferente do resultado oficial (${Math.floor(of.tempo_s / 60)}:${String(of.tempo_s % 60).padStart(2, '0')}).` }).eq('id', r.id);
      divergentes++;
    }
  }
  return { verificados, divergentes, recusados };
}
