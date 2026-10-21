// Radar Pro · Rei e Rainha da prova: a melhor nota por idade de TODA a prova (não só de quem assina),
// por distância, entre homens (Rei) e mulheres (Rainha). Usa a idade publicada no resultado oficial.
// deno-lint-ignore-file no-explicit-any
import { lerOficiais, real } from './resultados.ts';

const SITE = 'https://radarcorridasma.com.br';
type T = { idadeMin: number; dist: number[]; oc: number[]; f: number[][] };
let TAB: Record<'F' | 'M', T> | null = null;

/** Nota por idade (tabelas WMA, as mesmas do site). */
export async function notaIdade(sexo: 'F' | 'M', km: number, idade: number, seg: number) {
  if (!TAB) TAB = await fetch(SITE + '/data/idade-tabela.json').then(r => r.json()).catch(() => null);
  if (!TAB) return null;
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

/** Recalcula o Rei e a Rainha de uma prova a partir do resultado oficial gravado. */
export async function calcularReis(db: any, prova: string) {
  const ofs = (await lerOficiais(db, prova, 'nome, idade, sexo, tempo_s, distancia_km')).filter(o => o.idade != null && o.sexo);
  if (!ofs.length) return 0;
  const { data: p } = await db.from('radar_provas').select('nome, data, cidade').eq('id', prova).maybeSingle();
  const melhor = new Map<string, any>(), qtd = new Map<string, number>();
  for (const o of ofs) {
    const km = o.distancia_km == null ? null : real(Number(o.distancia_km));
    if (!km || km < 3 || !o.idade || o.idade < 10) continue;
    const n = await notaIdade(o.sexo, km, o.idade, o.tempo_s);
    if (n == null || !(n > 0) || n > 100) continue; // nota acima de 100% é erro de chip ou de idade
    const k = `${km}|${o.sexo}`;
    qtd.set(k, (qtd.get(k) ?? 0) + 1);
    if (!melhor.has(k) || n > melhor.get(k).nota) melhor.set(k, { ...o, km, nota: Math.round(n * 100) / 100 });
  }
  const linhas = [...melhor.entries()].filter(([k]) => (qtd.get(k) ?? 0) >= 5).map(([k, o]) => ({
    prova_id: prova, distancia_km: o.km, sexo: o.sexo, nome: String(o.nome).slice(0, 120), idade: o.idade, tempo_s: o.tempo_s, nota: o.nota,
    prova_nome: p?.nome ?? null, prova_data: p?.data ?? null, cidade: p?.cidade ?? null, atletas: qtd.get(k), calculado_em: new Date().toISOString(),
  }));
  await db.from('radar_reis').delete().eq('prova_id', prova);
  if (linhas.length) await db.from('radar_reis').insert(linhas);
  return linhas.length;
}
