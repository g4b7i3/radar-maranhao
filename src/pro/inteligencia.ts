// Radar Inteligência: a leitura curta de cada treino, no estilo do Strava.
// Tudo por regras, aqui no app: compara a corrida com as suas dos últimos 90 dias. Nenhum dado vai pra serviço de IA.
export type Parcial = { km: number; seg: number; fc?: number | null; parcial?: boolean };
export type Corrida = { id: string; data: string; tipo: string; distancia_m: number; duracao_s: number; fc_media: number | null; elevacao_m?: number | null; parciais?: Parcial[] | null };
export type Leitura = { titulo: string; txt: string; destaques: string[]; detalhes: string[] };

const media = (v: number[]) => v.reduce((a, b) => a + b, 0) / (v.length || 1);
const paceDe = (c: Corrida) => (c.distancia_m > 0 ? c.duracao_s / (c.distancia_m / 1000) : 0);
const fp = (s: number) => { const r = Math.round(s); return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`; };
const seg = (s: number) => { const r = Math.round(Math.abs(s)); return r >= 60 ? `${Math.floor(r / 60)}min${String(r % 60).padStart(2, '0')}s` : `${r}s`; };
const km1 = (m: number) => (m / 1000).toFixed(m >= 10000 ? 1 : 2).replace(/\.?0+$/, '').replace('.', ',');
const NOME: Record<string, string> = { corrida: 'Corrida', trail: 'Trail', esteira: 'Corrida na esteira', caminhada: 'Caminhada' };
const corre = (t: string) => t === 'corrida' || t === 'trail' || t === 'esteira';

export function radarInteligencia(c: Corrida, hist: Corrida[]): Leitura | null {
  if (!c.distancia_m || !c.duracao_s || c.distancia_m < 1000) return null;
  const p = paceDe(c), km = c.distancia_m / 1000, t0 = new Date(c.data).getTime();
  const antes = hist.filter((h) => h.id !== c.id && corre(h.tipo) && new Date(h.data).getTime() < t0 && new Date(h.data).getTime() > t0 - 90 * 864e5 && h.distancia_m >= 1000);
  const frases: string[] = [], destaques: string[] = [], detalhes: string[] = [];

  // 1. ritmo ao longo da corrida (parciais por km)
  const sp = (c.parciais ?? []).filter((x) => !x.parcial && x.seg > 0);
  let ritmo = '';
  if (sp.length >= 4) {
    const h = Math.floor(sp.length / 2), m1 = media(sp.slice(0, h).map((x) => x.seg)), m2 = media(sp.slice(-h).map((x) => x.seg));
    const med = media(sp.map((x) => x.seg)), cv = Math.sqrt(media(sp.map((x) => (x.seg - med) ** 2))) / med;
    const fimN = Math.min(3, Math.ceil(sp.length / 4)), mFim = media(sp.slice(-fimN).map((x) => x.seg));
    const rap = sp.reduce((a, x) => (x.seg < a.seg ? x : a)), len = sp.reduce((a, x) => (x.seg > a.seg ? x : a));
    const dif = (m2 - m1) / m1;
    if (dif < -0.02) ritmo = 'terminou mais forte do que começou (split negativo)';
    else if (mFim > med * 1.05) ritmo = `perdeu ${seg(mFim - med)}/km nos últimos ${fimN} km`;
    else if (cv < 0.03) ritmo = 'ritmo muito constante do início ao fim';
    else if (dif > 0.04) ritmo = 'começou forte e foi caindo';
    else ritmo = 'ritmo regular';
    detalhes.push(`1ª metade em ${fp(m1)}/km e 2ª em ${fp(m2)}/km. Km mais rápido: o ${rap.km}º, em ${fp(rap.seg)}. Mais lento: o ${len.km}º, em ${fp(len.seg)}.`);
    // deriva cardíaca: FC sobe na 2ª metade sem ganho de ritmo
    const f1 = sp.slice(0, h).filter((x) => x.fc), f2 = sp.slice(-h).filter((x) => x.fc);
    if (f1.length >= 2 && f2.length >= 2 && c.duracao_s >= 1800) {
      const subiu = media(f2.map((x) => x.fc!)) - media(f1.map((x) => x.fc!));
      if (subiu >= 8 && m2 >= m1 * 0.99) detalhes.push(`A frequência subiu ${Math.round(subiu)} bpm da 1ª pra 2ª metade sem o ritmo melhorar. Isso é deriva cardíaca, comum no calor ou quando falta hidratação.`);
      else if (subiu >= 5 && m2 < m1 * 0.99) detalhes.push(`A frequência subiu ${Math.round(subiu)} bpm na 2ª metade, acompanhando o ritmo mais forte do fim.`);
      else if (subiu >= 5) detalhes.push(`A frequência subiu ${Math.round(subiu)} bpm na 2ª metade, dentro do normal pra essa duração.`);
      else detalhes.push(`A frequência ficou estável entre as metades (${subiu >= 0 ? '+' : ''}${Math.round(subiu)} bpm): boa base aeróbica pra esse ritmo.`);
    }
  }
  frases.push(`${NOME[c.tipo] ?? 'Corrida'} de ${km1(c.distancia_m)} km a ${fp(p)}/km${ritmo ? `, ${ritmo}` : ''}.`);

  // 2. comparação com corridas de distância parecida (90 dias)
  const pare = antes.filter((h) => Math.abs(h.distancia_m - c.distancia_m) / c.distancia_m <= 0.3);
  if (pare.length >= 2) {
    const pm = media(pare.map(paceDe)), d = pm - p;
    if (d >= 5) frases.push(`Foi ${seg(d)}/km mais rápida que a média das suas ${pare.length} corridas de distância parecida nos últimos 90 dias.`);
    else if (d <= -10) frases.push(`Ficou ${seg(-d)}/km mais lenta que a média das suas corridas parecidas, um dia mais tranquilo.`);
    else frases.push(`Ritmo no seu padrão pra essa distância (média de ${fp(pm)}/km nas últimas ${pare.length}).`);
    const comFc = pare.filter((h) => h.fc_media);
    if (c.fc_media && comFc.length >= 2) {
      const fm = media(comFc.map((h) => h.fc_media!)), df = c.fc_media - fm;
      if (df <= -4 && d >= -3) destaques.push(`Coração mais tranquilo: FC ${Math.round(-df)} bpm abaixo das corridas parecidas, com ritmo igual ou melhor. Sinal de evolução aeróbica.`);
      else if (df >= 6 && d <= 3) detalhes.push(`FC ${Math.round(df)} bpm acima do normal pra esse ritmo. Cansaço, calor ou pouco sono costumam explicar.`);
      else detalhes.push(`FC média de ${c.fc_media} bpm, perto do seu normal (${Math.round(fm)} bpm) nessa distância.`);
    }
  } else if (antes.length === 0) {
    detalhes.push('Primeira corrida registrada aqui nos últimos 90 dias. A partir das próximas, o Radar compara a sua evolução.');
  }

  // 3. recordes dos últimos 90 dias
  if (antes.length >= 3) {
    if (c.distancia_m > Math.max(...antes.map((h) => h.distancia_m)) * 1.02) destaques.push(`🏅 Corrida mais longa dos últimos 90 dias.`);
    const longas = antes.filter((h) => h.distancia_m >= 5000);
    if (c.distancia_m >= 5000 && longas.length >= 2 && p < Math.min(...longas.map(paceDe)) - 1) destaques.push(`🏅 Melhor pace em corrida de 5 km ou mais dos últimos 90 dias.`);
    const kms = antes.flatMap((h) => (h.parciais ?? []).filter((x) => !x.parcial && x.seg > 0).map((x) => x.seg));
    if (sp.length && kms.length >= 5) { const melhor = Math.min(...sp.map((x) => x.seg)); if (melhor < Math.min(...kms) - 1) destaques.push(`🏅 Km mais rápido dos últimos 90 dias: ${fp(melhor)}.`); }
  }

  // 4. semana e condições
  const dt = new Date(c.data), ini = new Date(dt); ini.setHours(0, 0, 0, 0); ini.setDate(ini.getDate() - ((ini.getDay() + 6) % 7));
  const semana = antes.filter((h) => new Date(h.data) >= ini);
  if (semana.length) detalhes.push(`${semana.length + 1}ª corrida da semana, ${km1(semana.reduce((s, h) => s + h.distancia_m, 0) + c.distancia_m)} km somados.`);
  if (c.elevacao_m && c.elevacao_m / km >= 8) detalhes.push(`Percurso com subida: ${c.elevacao_m} m (${(c.elevacao_m / km).toFixed(0)} m por km). Isso pesa no ritmo.`);

  return { titulo: 'Radar Inteligência', txt: frases.slice(0, 2).join(' '), destaques: destaques.slice(0, 3), detalhes };
}
