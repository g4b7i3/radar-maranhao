import { useEffect, useRef, useState } from 'react';
import { Download, Share2, X, Camera } from 'lucide-react';
import { AZUL, SIMBOLO, caber, fonte, type Ctx } from '../EuVou';
import { sb, relogio, kmTxt, type Resultado } from './sb';
import { MEDALHAS, medalhaSVG, type Medalha } from './medalhas';
import { salvarImagem } from '../salvar';

// Card do resultado para os stories (1080×1920): tempo oficial, nota por idade, colocação e as medalhas da prova.
const W = 1080, H = 1920;
export const FUNDOS = [
  { id: 'calhau', nome: 'Calhau' }, { id: 'por-do-sol', nome: 'Pôr do sol' }, { id: 'telhados', nome: 'Centro' },
  { id: 'rua-do-giz', nome: 'Rua do Giz' }, { id: 'lagoa-da-jansen', nome: 'Lagoa' }, { id: 'catedral', nome: 'Catedral' },
] as const;
type Fundo = typeof FUNDOS[number]['id'] | 'azul' | 'minha';
type Rei = { sexo: 'F' | 'M'; atletas: number | null } | null;

const carregar = (src: string) => new Promise<HTMLImageElement>((ok, erro) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => ok(i); i.onerror = erro; i.src = src; });
/** Foto do perfil (ou nada, se não tiver ou não carregar). */
export const fotoPerfil = async (apelidos: string[]) => {
  const { data } = await sb.rpc('radar_fotos', { p_apelidos: apelidos });
  const m = new Map(((data ?? []) as { apelido: string; foto: string }[]).map(x => [x.apelido, x.foto]));
  const out = new Map<string, HTMLImageElement>();
  await Promise.all(apelidos.map(async a => { const u = m.get(a); if (u) { const i = await carregar(u).catch(() => null); if (i) out.set(a, i); } }));
  return out;
};
/** Desenha a foto redonda com borda branca. */
export function fotoRedonda(ctx: Ctx, img: HTMLImageElement, cx: number, cy: number, raio: number) {
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 16; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, raio + 5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, raio, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
  const s = Math.min(img.naturalWidth, img.naturalHeight);
  ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, cx - raio, cy - raio, raio * 2, raio * 2); ctx.restore();
}
const svgImg = (m: Medalha) => carregar('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(medalhaSVG(m, true, 200).replace(/'Archivo Variable',sans-serif/g, "'Arial Black',Arial,sans-serif")));
const ritmo = (s: number, km: number) => { const p = s / km; return `${Math.floor(p / 60)}:${String(Math.round(p % 60)).padStart(2, '0')}`; };
const dataLonga = (d: string) => new Date(d.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function cobrir(ctx: Ctx, img: CanvasImageSource, w: number, h: number) {
  const k = Math.max(W / w, H / h), dw = w * k, dh = h * k;
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
}
function coroa(ctx: Ctx, x: number, y: number, s: number, cor: string) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = cor;
  ctx.beginPath(); ctx.moveTo(0, 18); ctx.lineTo(4, 4); ctx.lineTo(10, 11); ctx.lineTo(16, 0); ctx.lineTo(22, 11); ctx.lineTo(28, 4); ctx.lineTo(32, 18); ctx.closePath(); ctx.fill();
  ctx.fillRect(0, 20, 32, 4); ctx.restore();
}

export async function desenharResultado(c: HTMLCanvasElement, r: Resultado, apelido: string, meds: Medalha[], rei: Rei, fundo: Fundo, foto: HTMLCanvasElement | null, avatar: HTMLImageElement | null = null) {
  c.width = W; c.height = H;
  const ctx = c.getContext('2d') as Ctx;
  await document.fonts?.ready;
  // fundo
  if (fundo === 'azul' || (fundo === 'minha' && !foto)) {
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0d1a5c'); g.addColorStop(.55, AZUL); g.addColorStop(1, '#3a5ce0');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const rg = ctx.createRadialGradient(W * .85, 120, 10, W * .85, 120, 700); rg.addColorStop(0, 'rgba(255,211,77,.35)'); rg.addColorStop(1, 'rgba(255,211,77,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  } else {
    const img = fundo === 'minha' ? foto! : await carregar(`/img/ma/${fundo}.jpg`);
    cobrir(ctx, img, (img as HTMLImageElement).naturalWidth || img.width, (img as HTMLImageElement).naturalHeight || img.height);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(6,12,36,.55)'); g.addColorStop(.28, 'rgba(6,12,36,.08)'); g.addColorStop(.48, 'rgba(6,12,36,.35)'); g.addColorStop(1, 'rgba(6,12,36,.92)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  const X = 84;
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 14;

  // topo: marca + selo
  ctx.save(); ctx.translate(X, 96);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(0, 0, 76, 76, 18); ctx.fill();
  ctx.shadowBlur = 0; ctx.translate(6, 6); ctx.scale(2, 2); ctx.strokeStyle = AZUL; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  SIMBOLO.forEach(p => ctx.stroke(new Path2D(p))); ctx.restore();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
  fonte(ctx, 900, 38, true); ctx.fillText('RADAR PRO', X + 98, 132);
  fonte(ctx, 600, 26, false); ctx.globalAlpha = .9; ctx.fillText('Corridas MA', X + 98, 166); ctx.globalAlpha = 1;
  const oficial = r.status === 'verificado' || r.status === 'aprovado';
  const selo = oficial ? '✓ RESULTADO OFICIAL' : 'TEMPO DECLARADO';
  fonte(ctx, 800, 26, false); const sw = ctx.measureText(selo).width + 44;
  ctx.shadowBlur = 0; ctx.fillStyle = oficial ? '#18a957' : 'rgba(255,255,255,.22)';
  ctx.beginPath(); ctx.roundRect(W - X - sw, 108, sw, 56, 28); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(selo, W - X - sw / 2, 145);
  ctx.shadowBlur = 14;

  // Rei / Rainha
  let y = 330;
  if (rei) {
    const txt = rei.sexo === 'F' ? 'RAINHA DA PROVA' : 'REI DA PROVA';
    fonte(ctx, 900, 52, true); const tw = ctx.measureText(txt).width + 150;
    ctx.shadowBlur = 0;
    const g = ctx.createLinearGradient(W / 2 - tw / 2, 0, W / 2 + tw / 2, 0); g.addColorStop(0, '#f2b705'); g.addColorStop(.5, '#ffe28a'); g.addColorStop(1, '#e2a400');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(W / 2 - tw / 2, y - 64, tw, 92, 46); ctx.fill();
    coroa(ctx, W / 2 - tw / 2 + 34, y - 40, 1.5, '#4d3300');
    ctx.fillStyle = '#3a2600'; ctx.textAlign = 'left'; ctx.fillText(txt, W / 2 - tw / 2 + 98, y);
    fonte(ctx, 600, 28, false); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.shadowBlur = 14;
    ctx.fillText(`Melhor nota por idade ${rei.sexo === 'F' ? 'entre as mulheres' : 'entre os homens'}${rei.atletas ? ` · ${rei.atletas} atletas` : ''}`, W / 2, y + 74);
  }

  // bloco do resultado (de baixo para cima)
  const temMeds = meds.length > 0;
  let base = temMeds ? H - 560 : H - 330;
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
  // colocação
  const col: string[] = [];
  if (r.colocacao_geral) col.push(`${r.colocacao_geral}º no geral${r.total_dist ? ` de ${r.total_dist}` : ''}`);
  if (r.colocacao_faixa) col.push(`${r.colocacao_faixa}º na faixa etária`);
  if (col.length) { fonte(ctx, 700, 36, false); ctx.fillText(col.join('  ·  '), X, base); base -= 110; }
  // três números
  const km = Number(r.distancia_km);
  const itens: [string, string][] = [[kmTxt(km).replace(' km', ''), 'KM'], [ritmo(r.tempo_s, km), 'RITMO /KM'], [`${String(Number(r.nota).toFixed(1)).replace('.', ',')}%`, 'NOTA POR IDADE']];
  const colW = (W - 2 * X) / 3;
  itens.forEach(([v, rot], i) => {
    const x = X + i * colW;
    fonte(ctx, 900, 80, true); ctx.fillText(v, x, base);
    fonte(ctx, 700, 24, false); ctx.globalAlpha = .85; try { ctx.letterSpacing = '3px'; } catch { /* */ } ctx.fillText(rot, x, base + 40); try { ctx.letterSpacing = '0px'; } catch { /* */ } ctx.globalAlpha = 1;
  });
  ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(X, base - 120, W - 2 * X, 3); ctx.shadowBlur = 14; ctx.fillStyle = '#fff';
  base -= 160;
  // tempo grande
  fonte(ctx, 900, 230, true); ctx.fillText(relogio(r.tempo_s), X - 6, base);
  base -= 240;
  fonte(ctx, 600, 34, false); ctx.globalAlpha = .92; ctx.fillText(`${dataLonga(r.prova_data)} · ${r.cidade}`, X, base); ctx.globalAlpha = 1;
  const t = caber(ctx, r.prova_nome, 900, 70, 46, W - 2 * X, 2, true);
  t.linhas.slice().reverse().forEach((l, k) => ctx.fillText(l, X, base - 62 - k * (t.px + 6)));

  // medalhas da prova
  if (temMeds) {
    const lista = meds.slice(0, 4), tam = 190, gap = (W - 2 * X - lista.length * tam) / Math.max(1, lista.length - 1);
    const y0 = H - 470;
    ctx.shadowBlur = 0;
    fonte(ctx, 800, 26, false); ctx.globalAlpha = .9; try { ctx.letterSpacing = '4px'; } catch { /* */ } ctx.fillText(meds.length > 4 ? `MEDALHAS DA PROVA  +${meds.length - 4}` : 'MEDALHAS DA PROVA', X, y0 - 20); try { ctx.letterSpacing = '0px'; } catch { /* */ } ctx.globalAlpha = 1;
    const imgs = await Promise.all(lista.map(m => svgImg(m).catch(() => null)));
    lista.forEach((m, i) => {
      const x = lista.length === 1 ? X : X + i * (tam + (lista.length > 1 ? gap : 0));
      const im = imgs[i]; if (im) { ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 18; ctx.drawImage(im, x, y0, tam, tam * 1.12); ctx.shadowBlur = 0; }
      fonte(ctx, 800, 26, true); ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      const n = caber(ctx, m.nome, 800, 28, 20, tam + 20, 2, true);
      n.linhas.forEach((l, k) => ctx.fillText(l, x + tam / 2, y0 + tam * 1.12 + 30 + k * (n.px + 2)));
      ctx.textAlign = 'left';
    });
  }

  // rodapé: foto, @apelido e o link do perfil público
  let xr = X;
  if (avatar) { fotoRedonda(ctx, avatar, X + 44, H - 108, 44); xr = X + 108; }
  ctx.shadowBlur = 10; ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
  fonte(ctx, 900, 40, true); ctx.fillText(`@${apelido}`, xr, H - 118 + (avatar ? 6 : 26));
  fonte(ctx, 600, 24, false); ctx.globalAlpha = .88; ctx.fillText(avatar ? `radarcorridasma.com.br/?atleta=${apelido}` : '', xr, H - 76);
  if (!avatar) { ctx.textAlign = 'right'; ctx.fillText(`radarcorridasma.com.br/?atleta=${apelido}`, W - X, H - 94); }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
}

export default function CardResultado({ r, apelido, fechar }: { r: Resultado; apelido: string; fechar: () => void }) {
  const [meds, setMeds] = useState<Medalha[] | null>(null);
  const [rei, setRei] = useState<Rei>(null);
  const [fundo, setFundo] = useState<Fundo>('calhau');
  const [foto, setFoto] = useState<HTMLCanvasElement | null>(null);
  const [avatar, setAvatar] = useState<HTMLImageElement | null | undefined>(undefined);
  useEffect(() => { fotoPerfil([apelido]).then(m => setAvatar(m.get(apelido) ?? null)).catch(() => setAvatar(null)); }, [apelido]);
  const [url, setUrl] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const blob = useRef<Blob | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      sb.from('radar_medalhas').select('medalha').eq('resultado_id', r.id),
      sb.from('radar_reis').select('sexo, atletas, distancia_km').eq('prova_id', r.prova_id).eq('user_id', r.user_id),
    ]).then(([m, k]) => {
      const ids = new Set((m.data ?? []).map(x => x.medalha));
      setMeds(MEDALHAS.filter(x => ids.has(x.id)).sort((a, b) => ['especial', 'ouro', 'prata', 'bronze'].indexOf(a.tier) - ['especial', 'ouro', 'prata', 'bronze'].indexOf(b.tier)));
      const meu = (k.data ?? []).find(x => Math.abs(Number(x.distancia_km) - Number(r.distancia_km)) < 0.2);
      setRei(meu ? { sexo: meu.sexo as 'F' | 'M', atletas: meu.atletas } : null);
    });
  }, [r]);

  useEffect(() => {
    if (!meds || avatar === undefined) return;
    let ativo = true;
    const c = document.createElement('canvas');
    desenharResultado(c, r, apelido, meds, rei, fundo, foto, avatar).then(() => c.toBlob(b => {
      if (!ativo || !b) return;
      blob.current = b; setUrl(old => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(b); });
    }, 'image/jpeg', 0.92)).catch(() => setAviso('Não consegui montar o card. Tente outro fundo.'));
    return () => { ativo = false; };
  }, [meds, rei, fundo, foto, r, apelido, avatar]);

  async function escolherFoto(file: File | undefined) {
    if (!file) return;
    const src = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = src; await img.decode();
      const k = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      setFoto(c); setFundo('minha');
    } catch { setAviso('Não consegui abrir essa foto. Tente outra.'); }
    finally { URL.revokeObjectURL(src); if (entrada.current) entrada.current.value = ''; }
  }
  const nome = `radar-${r.prova_id}.jpg`;
  async function compartilhar() {
    if (!blob.current) return;
    const f = new File([blob.current], nome, { type: 'image/jpeg' });
    if (navigator.canShare?.({ files: [f] })) { try { await navigator.share({ files: [f] }); return; } catch (e) { if ((e as Error).name === 'AbortError') return; } }
    baixar();
  }
  function baixar() {
    if (!url) return; salvarImagem(url, nome);
    setAviso('Imagem salva. É só postar no story.');
  }

  return (
    <div className="pro-card pro-cardres">
      <div className="pro-linha"><p className="pro-k cinza">Card do resultado</p><button className="btn text" onClick={fechar} aria-label="Fechar"><X size={18} aria-hidden="true" /></button></div>
      <div className="pro-cardres-previa">{url ? <img src={url} alt={`Card do resultado: ${r.prova_nome}`} /> : <span>Montando o card…</span>}</div>
      <div className="chips pro-cardres-fundos" role="group" aria-label="Fundo">
        {FUNDOS.map(f => <button key={f.id} className="chip" aria-pressed={fundo === f.id} onClick={() => setFundo(f.id)}>{f.nome}</button>)}
        <button className="chip" aria-pressed={fundo === 'azul'} onClick={() => setFundo('azul')}>Azul</button>
        <button className="chip" aria-pressed={fundo === 'minha'} onClick={() => entrada.current?.click()}><Camera size={14} aria-hidden="true" /> Minha foto</button>
        <input ref={entrada} type="file" accept="image/*" hidden onChange={e => escolherFoto(e.target.files?.[0])} />
      </div>
      <div className="pro-linha pro-quebra">
        <button className="btn solid" onClick={compartilhar} disabled={!url}><Share2 size={16} aria-hidden="true" />Compartilhar</button>
        <button className="btn outline" onClick={baixar} disabled={!url}><Download size={16} aria-hidden="true" />Baixar</button>
      </div>
      {aviso && <p className="fine pro-sem-margem">{aviso}</p>}
    </div>
  );
}
