import { useEffect, useRef, useState } from 'react';
import { Camera, Download, Share2, Trash2, X } from 'lucide-react';
import { fmt, type Race } from './lib';
import { diasAte, horaLargada } from './Clima';

// Card "Eu vou!" para os stories do Instagram (1080×1920), desenhado no próprio celular, sem servidor.

const W = 1080, H = 1920, AZUL = '#1D3FBF';
const FONTE = '"Archivo Variable", system-ui, sans-serif';
const SIMBOLO = ['M4 12a8 8 0 0 0 8-8M20 4a8 8 0 0 0 8 8M28 20a8 8 0 0 0-8 8M12 28a8 8 0 0 0-8-8', 'M16 9l7 7-7 7-7-7z'];

type Ctx = CanvasRenderingContext2D & { fontStretch?: string; letterSpacing?: string };

function fonte(ctx: Ctx, peso: number, px: number, estreita: boolean) {
  ctx.font = `${peso} ${px}px ${FONTE}`;
  try { ctx.fontStretch = estreita ? 'extra-condensed' : 'normal'; } catch { /* navegador sem suporte: usa a largura normal */ }
}

/** Quebra o texto em linhas que cabem na largura, diminuindo a fonte se precisar. */
function caber(ctx: Ctx, texto: string, peso: number, px: number, min: number, largura: number, maxLinhas: number, estreita: boolean) {
  for (let s = px; s >= min; s -= 4) {
    fonte(ctx, peso, s, estreita);
    const linhas: string[] = []; let atual = '';
    for (const p of texto.split(/\s+/)) {
      const t = atual ? atual + ' ' + p : p;
      if (ctx.measureText(t).width <= largura) atual = t; else { if (atual) linhas.push(atual); atual = p; }
    }
    if (atual) linhas.push(atual);
    if (linhas.length <= maxLinhas && linhas.every(l => ctx.measureText(l).width <= largura)) return { linhas, px: s };
  }
  fonte(ctx, peso, min, estreita);
  return { linhas: [texto], px: min };
}

export type Foto = { img: CanvasImageSource; w: number; h: number } | null;

export async function desenharCard(canvas: HTMLCanvasElement, e: Race, dist: number | null, foto: Foto = null, focoY = 0.35) {
  try { await Promise.all([document.fonts.load(`800 100px ${FONTE}`), document.fonts.load(`500 40px ${FONTE}`)]); } catch { /* segue com a fonte do sistema */ }
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d') as Ctx;
  const M = 90, FOTO_H = 1510;

  // fundo azul
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2449D6'); g.addColorStop(1, '#14278A');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // espaço da foto (parte de cima)
  if (foto) {
    const s = Math.max(W / foto.w, FOTO_H / foto.h);
    const dw = foto.w * s, dh = foto.h * s;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, FOTO_H); ctx.clip();
    ctx.drawImage(foto.img, (W - dw) / 2, (FOTO_H - dh) * Math.min(1, Math.max(0, focoY)), dw, dh);
    ctx.restore();
  } else {
    // sem foto: arte do radar no lugar
    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 2;
    for (let r = 120; r <= 720; r += 120) { ctx.beginPath(); ctx.arc(W / 2, 640, r, 0, Math.PI * 2); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(W / 2 - 640, 640); ctx.lineTo(W / 2 + 640, 640); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, FOTO_H); ctx.stroke();
    ctx.fillStyle = 'rgba(120,255,170,.16)';
    ctx.beginPath(); ctx.moveTo(W / 2, 640); ctx.arc(W / 2, 640, 720, -Math.PI * 0.5, -Math.PI * 0.18); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3CE07A'; ctx.shadowColor = '#3CE07A'; ctx.shadowBlur = 30;
    ctx.beginPath(); ctx.arc(W / 2 + 260, 440, 16, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  }
  // sombra em cima (para a marca) e degradê embaixo (a foto se funde com o azul)
  const top = ctx.createLinearGradient(0, 0, 0, 330); top.addColorStop(0, 'rgba(5,12,40,.55)'); top.addColorStop(1, 'rgba(5,12,40,0)');
  ctx.fillStyle = top; ctx.fillRect(0, 0, W, 330);
  // a cor do fim do degradê é exatamente a do fundo naquela altura, para não aparecer emenda
  const k = FOTO_H / H, mix = (a: number, b: number) => Math.round(a + (b - a) * k);
  const [r, gg, bb] = [mix(0x24, 0x14), mix(0x49, 0x27), mix(0xd6, 0x8a)];
  const fundo = ctx.createLinearGradient(0, FOTO_H - 460, 0, FOTO_H);
  fundo.addColorStop(0, `rgba(${r},${gg},${bb},0)`); fundo.addColorStop(0.6, `rgba(${r},${gg},${bb},.8)`); fundo.addColorStop(1, `rgb(${r},${gg},${bb})`);
  ctx.fillStyle = fundo; ctx.fillRect(0, FOTO_H - 460, W, 460);

  // marca
  ctx.save(); ctx.translate(M, 110);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(0, 0, 76, 76, 16); ctx.fill();
  ctx.scale(76 / 32, 76 / 32); ctx.strokeStyle = AZUL; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  SIMBOLO.forEach(d => ctx.stroke(new Path2D(d)));
  ctx.restore();
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic';
  fonte(ctx, 800, 34, true); ctx.fillText('RADAR CORRIDAS', M + 98, 144);
  fonte(ctx, 500, 22, false); try { ctx.letterSpacing = '7px'; } catch { /* */ }
  ctx.globalAlpha = .9; ctx.fillText('MARANHÃO', M + 98, 177); ctx.globalAlpha = 1;
  try { ctx.letterSpacing = '0px'; } catch { /* */ }

  // EU VOU! (encosta no fim da foto)
  let y = 1530;
  const eu = caber(ctx, 'EU VOU!', 800, 170, 120, W - 2 * M, 1, true);
  ctx.fillText(eu.linhas[0], M - 4, y);

  // nome da prova
  const nome = caber(ctx, e.name, 750, 64, 44, W - 2 * M, 2, true);
  y += 10;
  for (const l of nome.linhas) { y += nome.px * 1.04; ctx.fillText(l, M, y); }
  y += 30;

  // distância + contagem na mesma linha
  let x = M;
  if (dist != null) {
    fonte(ctx, 800, 64, true);
    const txt = `${String(dist).replace('.', ',')} KM`; const tw = ctx.measureText(txt).width;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(x, y, tw + 48, 82, 18); ctx.fill();
    ctx.fillStyle = AZUL; ctx.fillText(txt, x + 24, y + 65);
    x += tw + 48 + 16;
  }
  const n = diasAte(e.date);
  if (n != null && n >= 0) {
    const txt = n === 0 ? 'É HOJE!' : n === 1 ? 'É AMANHÃ!' : `FALTAM ${n} DIAS`;
    fonte(ctx, 800, 42, true); const tw = ctx.measureText(txt).width;
    ctx.fillStyle = 'rgba(5,15,50,.38)'; ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x, y, tw + 92, 82, 41); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3CE07A'; ctx.beginPath(); ctx.arc(x + 38, y + 41, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(txt, x + 62, y + 56);
  }
  y += 82 + 54;

  // data, hora e cidade
  const { h, m, informada } = horaLargada(e);
  const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  const quando = (e.date ? cap(fmt.long(e.date)) : 'Data a confirmar') + (e.date && informada ? ` · ${h}h${m ? String(m).padStart(2, '0') : ''}` : '');
  ctx.fillStyle = '#fff';
  const q = caber(ctx, `${quando} · ${e.city}`, 600, 40, 28, W - 2 * M, 1, false);
  ctx.fillText(q.linhas[0], M, y);

  // faixa da bandeira no alto e @ ao lado da marca (embaixo fica livre para a barra de mensagem do story)
  const cores = ['#d52b1e', '#ffffff', '#111111', '#ffffff', '#d52b1e'], fw = W / cores.length;
  cores.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(i * fw, 0, fw + 1, 12); });
  ctx.fillStyle = '#fff'; ctx.textAlign = 'right'; fonte(ctx, 700, 30, false);
  ctx.fillText('@radarcorridasma', W - M, 160); ctx.textAlign = 'left';
}

export default function EuVou({ e, onClose }: { e: Race; onClose: () => void }) {
  const [dist, setDist] = useState<number | null>(e.distances.length === 1 ? e.distances[0] : null);
  const [url, setUrl] = useState('');
  const [aviso, setAviso] = useState('');
  const [foto, setFoto] = useState<Foto>(null);
  const [focoY, setFocoY] = useState(0.35);
  const [lendo, setLendo] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const blob = useRef<Blob | null>(null);

  useEffect(() => {
    let vivo = true;
    const c = canvas.current ?? (canvas.current = document.createElement('canvas'));
    // pequena espera para não redesenhar a cada pixel enquanto a pessoa arrasta o ajuste da foto
    const t = setTimeout(() => desenharCard(c, e, dist, foto, focoY).then(() => c.toBlob(b => {
      if (!vivo || !b) return;
      blob.current = b;
      setUrl(old => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(b); });
    }, 'image/jpeg', 0.92)), 90);
    return () => { vivo = false; clearTimeout(t); };
  }, [e, dist, foto, focoY]);

  /** Lê a foto escolhida (fica só no celular da pessoa) e reduz para no máximo 1600 px, para não pesar. */
  async function escolherFoto(file: File | undefined) {
    if (!file) return;
    setLendo(true); setAviso('');
    const src = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async'; img.src = src;
      await img.decode();
      const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      setFoto({ img: c, w: c.width, h: c.height }); setFocoY(0.35);
      track('pôs foto');
    } catch {
      setAviso('Não consegui abrir essa foto. Tente outra (JPG ou PNG).');
    } finally {
      URL.revokeObjectURL(src); setLendo(false);
      if (entrada.current) entrada.current.value = '';
    }
  }
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const nomeArq = `eu-vou-${e.id}.jpg`;
  const track = (acao: string) => { try { (window as unknown as { umami?: { track: (n: string, d?: object) => void } }).umami?.track('Card Eu vou', { acao, prova: e.name }); } catch { /* */ } };

  async function compartilhar() {
    if (!blob.current) return;
    const f = new File([blob.current], nomeArq, { type: 'image/jpeg' });
    if (navigator.canShare?.({ files: [f] })) {
      try { await navigator.share({ files: [f] }); track('compartilhou'); return; }
      catch (err) { if ((err as Error).name === 'AbortError') return; }
    }
    baixar();
  }
  function baixar() {
    if (!url) return;
    const a = document.createElement('a'); a.href = url; a.download = nomeArq; document.body.appendChild(a); a.click(); a.remove();
    setAviso('Imagem salva. Abra o Instagram, crie um story e escolha a imagem na galeria.');
    track('baixou');
  }

  const podeCompartilhar = typeof navigator !== 'undefined' && !!navigator.canShare;
  return (
    <section className="euvou" aria-label="Card Eu vou para os stories">
      <div className="euvou-head">
        <h3>Card para o seu story</h3>
        <button className="icon-btn" onClick={onClose} aria-label="Fechar o card"><X size={18} /></button>
      </div>
      {e.distances.length > 1 && (
        <div className="chips" role="group" aria-label="Qual distância você vai correr?">
          {e.distances.map(d => <button key={d} className="chip" aria-pressed={dist === d} onClick={() => setDist(d)}>{d} km</button>)}
        </div>
      )}
      <div className="euvou-foto">
        <input ref={entrada} type="file" accept="image/*" hidden onChange={ev => escolherFoto(ev.target.files?.[0])} />
        <button className="btn outline" onClick={() => entrada.current?.click()} disabled={lendo}><Camera size={16} aria-hidden="true" />{lendo ? 'Abrindo a foto…' : foto ? 'Trocar foto' : 'Pôr minha foto'}</button>
        {foto && <button className="icon-btn" onClick={() => setFoto(null)} aria-label="Tirar a foto"><Trash2 size={18} /></button>}
      </div>
      {foto && (
        <label className="euvou-ajuste">Ajustar a posição da foto
          <input type="range" min={0} max={1} step={0.01} value={focoY} onChange={ev => setFocoY(Number(ev.target.value))} />
        </label>
      )}
      <div className="euvou-preview">{url ? <img src={url} alt={`Prévia do card: eu vou na ${e.name}`} /> : <span>Montando o card…</span>}</div>
      <div className="euvou-actions">
        {podeCompartilhar && <button className="btn solid" onClick={compartilhar} disabled={!url}><Share2 size={16} aria-hidden="true" />Compartilhar no story</button>}
        <button className={podeCompartilhar ? 'btn outline' : 'btn solid'} onClick={baixar} disabled={!url}><Download size={16} aria-hidden="true" />Baixar imagem</button>
      </div>
      {aviso && <p className="fine" role="status">{aviso}</p>}
      <p className="fine">A foto fica só no seu celular: nada é enviado para o site. Marque o <b>@radarcorridasma</b> no story que a gente reposta.</p>
    </section>
  );
}
