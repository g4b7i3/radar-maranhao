import { useEffect, useRef, useState } from 'react';
import { Download, Share2, X } from 'lucide-react';
import { fmt, placeLabel, type Race } from './lib';
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

export async function desenharCard(canvas: HTMLCanvasElement, e: Race, dist: number | null) {
  try { await Promise.all([document.fonts.load(`800 100px ${FONTE}`), document.fonts.load(`500 40px ${FONTE}`)]); } catch { /* segue com a fonte do sistema */ }
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d') as Ctx;
  const M = 90;

  // fundo azul com o radar
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2449D6'); g.addColorStop(1, '#14278A');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 2;
  for (let r = 180; r <= 900; r += 180) { ctx.beginPath(); ctx.arc(W + 40, 720, r, 0, Math.PI * 2); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,255,255,.08)';
  ctx.beginPath(); ctx.moveTo(W + 40, 720); ctx.arc(W + 40, 720, 900, Math.PI * 1.02, Math.PI * 1.22); ctx.closePath(); ctx.fill();

  // marca
  ctx.save(); ctx.translate(M, 170);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(0, 0, 84, 84, 18); ctx.fill();
  ctx.scale(84 / 32, 84 / 32); ctx.strokeStyle = AZUL; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  SIMBOLO.forEach(d => ctx.stroke(new Path2D(d)));
  ctx.restore();
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic';
  fonte(ctx, 800, 38, true); ctx.fillText('RADAR CORRIDAS', M + 108, 207);
  fonte(ctx, 500, 24, false); try { ctx.letterSpacing = '8px'; } catch { /* */ }
  ctx.globalAlpha = .85; ctx.fillText('MARANHÃO', M + 108, 244); ctx.globalAlpha = 1;
  try { ctx.letterSpacing = '0px'; } catch { /* */ }

  // EU VOU!
  let y = dist != null ? 600 : 660;
  const eu = caber(ctx, 'EU VOU!', 800, 250, 150, W - 2 * M, 1, true);
  ctx.fillText(eu.linhas[0], M - 6, y); y += 50;

  // nome da prova
  const nome = caber(ctx, e.name, 750, 96, 56, W - 2 * M, 3, true);
  for (const l of nome.linhas) { y += nome.px * 1.02; ctx.fillText(l, M, y); }
  y += 70;

  // distância
  if (dist != null) {
    fonte(ctx, 800, 92, true);
    const txt = `${String(dist).replace('.', ',')} KM`; const tw = ctx.measureText(txt).width;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(M, y - 10, tw + 64, 124, 24); ctx.fill();
    ctx.fillStyle = AZUL; ctx.fillText(txt, M + 32, y + 86);
    y += 190;
  } else y += 20;

  // data, hora e local
  const { h, m, informada } = horaLargada(e);
  ctx.fillStyle = '#fff';
  const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  const quando = (e.date ? cap(fmt.long(e.date)) : 'Data a confirmar') + (e.date && informada ? ` · ${h}h${m ? String(m).padStart(2, '0') : ''}` : '');
  const q = caber(ctx, quando, 600, 46, 34, W - 2 * M, 2, false);
  for (const l of q.linhas) { ctx.fillText(l, M, y); y += q.px * 1.25; }
  ctx.globalAlpha = .82;
  const onde = caber(ctx, placeLabel(e), 400, 38, 30, W - 2 * M, 2, false);
  for (const l of onde.linhas) { ctx.fillText(l, M, y); y += onde.px * 1.3; }
  ctx.globalAlpha = 1;

  // contagem regressiva
  const n = diasAte(e.date);
  if (n != null && n >= 0) {
    const txt = n === 0 ? 'É HOJE!' : n === 1 ? 'É AMANHÃ!' : `FALTAM ${n} DIAS`;
    const cy = Math.min(y + 50, 1440);
    ctx.fillStyle = 'rgba(5,15,50,.35)'; ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 2;
    fonte(ctx, 800, 56, true); const tw = ctx.measureText(txt).width;
    ctx.beginPath(); ctx.roundRect(M, cy, tw + 120, 100, 50); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3CE07A'; ctx.beginPath(); ctx.arc(M + 50, cy + 50, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(txt, M + 84, cy + 70);
  }

  // faixa da bandeira e @
  const fy = 1600, cores = ['#d52b1e', '#ffffff', '#111111', '#ffffff', '#d52b1e'], fw = (W - 2 * M) / cores.length;
  cores.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(M + i * fw, fy, fw + 1, 10); });
  ctx.fillStyle = '#fff'; fonte(ctx, 700, 34, false);
  ctx.fillText('@radarcorridasma', M, fy + 72);
  ctx.textAlign = 'right'; ctx.globalAlpha = .8; fonte(ctx, 500, 28, false);
  ctx.fillText('agenda de corridas do MA', W - M, fy + 70); ctx.textAlign = 'left'; ctx.globalAlpha = 1;
}

export default function EuVou({ e, onClose }: { e: Race; onClose: () => void }) {
  const [dist, setDist] = useState<number | null>(e.distances.length === 1 ? e.distances[0] : null);
  const [url, setUrl] = useState('');
  const [aviso, setAviso] = useState('');
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const blob = useRef<Blob | null>(null);

  useEffect(() => {
    let vivo = true;
    const c = canvas.current ?? (canvas.current = document.createElement('canvas'));
    desenharCard(c, e, dist).then(() => c.toBlob(b => {
      if (!vivo || !b) return;
      blob.current = b;
      setUrl(old => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(b); });
    }, 'image/png'));
    return () => { vivo = false; };
  }, [e, dist]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const nomeArq = `eu-vou-${e.id}.png`;
  const track = (acao: string) => { try { (window as unknown as { umami?: { track: (n: string, d?: object) => void } }).umami?.track('Card Eu vou', { acao, prova: e.name }); } catch { /* */ } };

  async function compartilhar() {
    if (!blob.current) return;
    const f = new File([blob.current], nomeArq, { type: 'image/png' });
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
      <div className="euvou-preview">{url ? <img src={url} alt={`Prévia do card: eu vou na ${e.name}`} /> : <span>Montando o card…</span>}</div>
      <div className="euvou-actions">
        {podeCompartilhar && <button className="btn solid" onClick={compartilhar} disabled={!url}><Share2 size={16} aria-hidden="true" />Compartilhar no story</button>}
        <button className={podeCompartilhar ? 'btn outline' : 'btn solid'} onClick={baixar} disabled={!url}><Download size={16} aria-hidden="true" />Baixar imagem</button>
      </div>
      {aviso && <p className="fine" role="status">{aviso}</p>}
      <p className="fine">Marque o <b>@radarcorridasma</b> no story que a gente reposta.</p>
    </section>
  );
}
