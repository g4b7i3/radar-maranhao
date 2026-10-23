// Radar Pro · leitor de resultado com IA, para links que o Radar não sabe ler (página, PDF, imagem/print).
// Pergunta fechada: "ache este atleta e devolva distância e tempo". O Radar só aceita se tudo conferir
// (nome do perfil, data da prova, distância, tempo possível e, em página de texto, o nome e o tempo escritos de verdade lá).
// Precisa do segredo ANTHROPIC_API_KEY no Supabase; sem ele, não faz nada.
// deno-lint-ignore-file no-explicit-any
import { comuns, norm, real, seg } from './resultados.ts';

export type LeituraIA = { tempo_s: number; nome: string; peito: string | null; distancia_km: number | null; colocacao_geral: number | null; colocacao_faixa: number | null; evento: string | null; data: string | null; fonte: string };

const UA = { 'User-Agent': 'Mozilla/5.0 (RadarCorridasMA; +https://radarcorridasma.com.br)' };
const MAX = 8 * 1024 * 1024;
const b64 = (u8: Uint8Array) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };

/** Texto limpo de uma página HTML. */
function textoDe(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n').replace(/<\/t[dh]>/gi, ' | ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

/** Corta o texto em volta de onde aparece o nome ou o peito (página grande custa caro e confunde). */
function recorte(texto: string, nomes: string[], peito: string | null) {
  if (texto.length <= 60_000) return texto;
  const linhas = texto.split('\n'); const n = linhas.map(l => norm(l));
  const alvo = new Set<number>();
  n.forEach((l, i) => { if ((peito && new RegExp(`\\b${peito}\\b`).test(l)) || nomes.filter(p => l.includes(p)).length >= 2) for (let k = Math.max(0, i - 3); k <= Math.min(linhas.length - 1, i + 3); k++) alvo.add(k); });
  const cab = linhas.slice(0, 40).join('\n');
  return (cab + '\n…\n' + [...alvo].sort((a, b) => a - b).map(i => linhas[i]).join('\n')).slice(0, 60_000);
}

export async function lerComIA(url: string, o: { nomePerfil: string; nomeInscricao?: string | null; peito?: string | null; km: number; dataProva: string; nomeProva: string }): Promise<LeituraIA | null> {
  const chave = Deno.env.get('ANTHROPIC_API_KEY');
  if (!chave) return null;
  let u: URL; try { u = new URL(url.trim()); } catch { return null; }
  if (!/^https?:$/.test(u.protocol) || /^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(u.hostname)) return null;

  const r = await fetch(u.href, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(25_000) }).catch(() => null);
  if (!r?.ok) return null;
  const tipo = (r.headers.get('content-type') ?? '').toLowerCase();
  const bytes = new Uint8Array(await r.arrayBuffer());
  if (!bytes.length || bytes.length > MAX) return null;

  const nomeBusca = o.nomeInscricao && o.nomeInscricao.trim().split(/\s+/).length >= 2 ? o.nomeInscricao : o.nomePerfil;
  const partes = norm(nomeBusca).split(' ').filter(p => p.length >= 3);
  const peito = o.peito ? o.peito.replace(/\D/g, '') : null;
  let bloco: any, textoPagina: string | null = null;
  if (tipo.includes('pdf') || /\.pdf($|\?)/i.test(u.pathname)) bloco = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64(bytes) } };
  else if (/image\/(png|jpe?g|webp|gif)/.test(tipo)) bloco = { type: 'image', source: { type: 'base64', media_type: tipo.split(';')[0], data: b64(bytes) } };
  else {
    textoPagina = textoDe(new TextDecoder().decode(bytes));
    if (textoPagina.length < 50) return null;
    bloco = { type: 'text', text: 'CONTEÚDO DA PÁGINA:\n' + recorte(textoPagina, partes, peito) };
  }

  const pergunta = `Este é um resultado oficial de corrida de rua. Ache a linha do atleta abaixo e responda SÓ com um JSON, sem texto em volta.
Atleta: nome "${nomeBusca}"${peito ? `, número de peito ${peito}` : ''}. Distância que ele diz ter corrido: ${String(o.km).replace('.', ',')} km.
Prova esperada: "${o.nomeProva}" em ${o.dataProva}.
Formato: {"achou": true|false, "nome": "como está escrito", "peito": "número ou null", "distancia_km": número ou null, "tempo_liquido": "hh:mm:ss ou null", "tempo_bruto": "hh:mm:ss ou null", "colocacao_geral": número ou null, "colocacao_faixa": número ou null, "evento": "nome do evento escrito no resultado ou null", "data": "AAAA-MM-DD ou null", "certeza": "alta"|"media"|"baixa"}
Regras: não invente nada. Se houver dois atletas parecidos e você não souber qual é, "achou": false. Copie o tempo exatamente como está.`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', signal: AbortSignal.timeout(60_000),
    headers: { 'x-api-key': chave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: Deno.env.get('RADAR_IA_MODELO') || 'claude-haiku-5-5', max_tokens: 400, messages: [{ role: 'user', content: [bloco, { type: 'text', text: pergunta }] }] }),
  }).catch(() => null);
  if (!resp?.ok) return null;
  const j = await resp.json().catch(() => null);
  const txt = String(j?.content?.find((c: any) => c.type === 'text')?.text ?? '');
  let d: any; try { d = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1)); } catch { return null; }
  if (!d?.achou || d.certeza === 'baixa') return null;

  // ---------- conferências: só aceita se tudo bater ----------
  const tempo = seg(d.tempo_liquido) ?? seg(d.tempo_bruto);
  if (!tempo) return null;
  const nomeLido = String(d.nome ?? '');
  const peitoLido = d.peito ? String(d.peito).replace(/\D/g, '') : null;
  const peitoBate = !!peito && peitoLido === peito;
  if (comuns(nomeLido, o.nomePerfil) < (peitoBate ? 1 : 2)) return null; // nome do perfil (2 nomes; 1 se o peito bate)
  const km = d.distancia_km ? real(Number(d.distancia_km)) : null;
  if (km && Math.abs(km - real(o.km)) > 0.3) return null; // outra distância
  if (tempo / real(o.km) < 150 || tempo / real(o.km) > 1500) return null; // tempo impossível
  if (d.data && /^\d{4}-\d{2}-\d{2}$/.test(d.data) && Math.abs(new Date(d.data).getTime() - new Date(o.dataProva).getTime()) > 86400_000) return null; // outro dia
  if (textoPagina) { // página de texto: o nome e o tempo têm que estar escritos lá de verdade
    const t = norm(textoPagina);
    if (!t.includes(norm(nomeLido))) return null;
    const hms = (s: number) => [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60];
    const [h, m, s2] = hms(tempo); const mm = String(m).padStart(2, '0'), ss = String(s2).padStart(2, '0');
    const formas = [`${h}:${mm}:${ss}`, `${String(h).padStart(2, '0')}:${mm}:${ss}`, `${h * 60 + m}:${ss}`, `${mm}:${ss}`, `${h}h${mm}`, `${mm}'${ss}`];
    if (!formas.some(f => textoPagina!.includes(f))) return null;
  } else if (d.certeza !== 'alta') return null; // PDF e imagem: só com certeza alta

  return { tempo_s: tempo, nome: nomeLido, peito: peitoLido, distancia_km: km, colocacao_geral: Number(d.colocacao_geral) || null, colocacao_faixa: Number(d.colocacao_faixa) || null, evento: d.evento ?? null, data: d.data ?? null, fonte: u.hostname };
}
