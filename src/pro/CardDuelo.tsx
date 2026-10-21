import { useEffect, useRef, useState } from 'react';
import { Download, Share2, X, Swords } from 'lucide-react';
import { AZUL, SIMBOLO, fonte, type Ctx } from '../EuVou';
import { pct, kmTxt } from './sb';
import { FUNDOS, fotoPerfil, fotoRedonda } from './CardResultado';

// Resultado do duelo (venceu, perdeu ou empatou) como card para o story (1080×1920).
export type FimDuelo = { id: string; adversario: string | null; distancia_km: number; mes: string; minha_nota: number | null; nota_adv: number | null; resultado: 'venci' | 'perdi' | 'empate' | 'ninguem' };
const W = 1080, H = 1920;
const carregar = (src: string) => new Promise<HTMLImageElement>((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = src; });
const mesNome = (m: string) => new Date(m.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' });

export const tituloDuelo = (d: FimDuelo) => d.resultado === 'venci' ? 'Você venceu o duelo!' : d.resultado === 'perdi' ? 'Desta vez não deu' : d.resultado === 'empate' ? 'Empate no duelo' : 'Duelo sem provas';

export async function desenhar(c: HTMLCanvasElement, d: FimDuelo, eu: string, fundo: string, fotos: Map<string, HTMLImageElement> = new Map()) {
  c.width = W; c.height = H;
  const ctx = c.getContext('2d') as Ctx;
  await document.fonts?.ready;
  const img = await carregar(`/img/ma/${fundo}.jpg`).catch(() => null);
  if (img) { const k = Math.max(W / img.naturalWidth, H / img.naturalHeight); ctx.drawImage(img, (W - img.naturalWidth * k) / 2, (H - img.naturalHeight * k) / 2, img.naturalWidth * k, img.naturalHeight * k); }
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(6,12,36,.75)'); g.addColorStop(.5, 'rgba(6,12,36,.55)'); g.addColorStop(1, 'rgba(6,12,36,.92)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const X = 84, venci = d.resultado === 'venci';
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 14;
  // marca
  ctx.save(); ctx.translate(X, 96); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(0, 0, 76, 76, 18); ctx.fill();
  ctx.shadowBlur = 0; ctx.translate(6, 6); ctx.scale(2, 2); ctx.strokeStyle = AZUL; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  SIMBOLO.forEach(p => ctx.stroke(new Path2D(p))); ctx.restore();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; fonte(ctx, 900, 38, true); ctx.fillText('RADAR PRO', X + 98, 132);
  fonte(ctx, 600, 26, false); ctx.globalAlpha = .9; ctx.fillText('Duelo', X + 98, 166); ctx.globalAlpha = 1;
  // título
  ctx.textAlign = 'center';
  fonte(ctx, 700, 34, false); ctx.globalAlpha = .9; ctx.fillText(`DUELO DE ${mesNome(d.mes).toUpperCase()} · ${kmTxt(Number(d.distancia_km)).toUpperCase()}`, W / 2, 470); ctx.globalAlpha = 1;
  const tit = venci ? 'VENCI O DUELO' : d.resultado === 'perdi' ? 'DUELO ENCERRADO' : d.resultado === 'empate' ? 'EMPATE' : 'DUELO';
  fonte(ctx, 900, venci ? 170 : 150, true);
  if (venci) { const gg = ctx.createLinearGradient(0, 520, 0, 700); gg.addColorStop(0, '#fff1b8'); gg.addColorStop(.6, '#f2b705'); gg.addColorStop(1, '#e2a400'); ctx.fillStyle = gg; } else ctx.fillStyle = '#fff';
  ctx.fillText(tit, W / 2, 680);
  ctx.fillStyle = '#fff';
  // placar
  const y = 1000, col = (W - 2 * X) / 2;
  const lado = (x: number, nome: string, nota: number | null, destaque: boolean) => {
    ctx.shadowBlur = 0; ctx.fillStyle = destaque ? 'rgba(242,183,5,.22)' : 'rgba(255,255,255,.1)';
    ctx.beginPath(); ctx.roundRect(x + 10, y - 150, col - 20, 380, 36); ctx.fill();
    if (destaque) { ctx.strokeStyle = '#f2b705'; ctx.lineWidth = 5; ctx.stroke(); }
    const av = fotos.get(nome); if (av) fotoRedonda(ctx, av, x + col / 2, y - 190, 70);
    ctx.shadowBlur = 14; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    fonte(ctx, 800, 44, true); ctx.fillText(`@${nome}`.slice(0, 18), x + col / 2, y - 60);
    fonte(ctx, 900, 140, true); ctx.fillText(nota != null ? `${pct(nota)}%` : '–', x + col / 2, y + 100);
    fonte(ctx, 700, 28, false); ctx.globalAlpha = .85; ctx.fillText('NOTA POR IDADE', x + col / 2, y + 170); ctx.globalAlpha = 1;
  };
  lado(X, eu, d.minha_nota, venci);
  lado(X + col, d.adversario ?? 'amigo', d.nota_adv, d.resultado === 'perdi');
  // VS
  ctx.shadowBlur = 0; ctx.fillStyle = '#f2b705'; ctx.beginPath(); ctx.arc(W / 2, y + 30, 58, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3a2600'; fonte(ctx, 900, 52, true); ctx.fillText('VS', W / 2, y + 48);
  // frase
  ctx.shadowBlur = 14; ctx.fillStyle = '#fff'; fonte(ctx, 600, 36, false);
  ctx.fillText('Vence a maior nota por idade: justo entre todas as idades.', W / 2, y + 340);
  // rodapé
  ctx.textAlign = 'left'; fonte(ctx, 900, 40, true); ctx.fillText('Desafie um amigo no Radar Pro', X, H - 140);
  fonte(ctx, 600, 30, false); ctx.globalAlpha = .9; ctx.fillText('radarcorridasma.com.br/pro', X, H - 92); ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

export default function CardDuelo({ d, eu, fechar }: { d: FimDuelo; eu: string; fechar: () => void }) {
  const [fundo, setFundo] = useState<string>('por-do-sol');
  const [url, setUrl] = useState<string | null>(null);
  const [fotos, setFotos] = useState<Map<string, HTMLImageElement> | null>(null);
  useEffect(() => { fotoPerfil([eu, d.adversario ?? ''].filter(Boolean)).then(setFotos).catch(() => setFotos(new Map())); }, [eu, d.adversario]);
  const blob = useRef<Blob | null>(null);
  useEffect(() => {
    if (!fotos) return;
    let ativo = true; const c = document.createElement('canvas');
    desenhar(c, d, eu, fundo, fotos).then(() => c.toBlob(b => { if (!ativo || !b) return; blob.current = b; setUrl(o => { if (o) URL.revokeObjectURL(o); return URL.createObjectURL(b); }); }, 'image/jpeg', .92));
    return () => { ativo = false; };
  }, [d, eu, fundo, fotos]);
  const nome = `duelo-${d.mes.slice(0, 7)}.jpg`;
  const baixar = () => { if (!url) return; const a = document.createElement('a'); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); };
  const compartilhar = async () => {
    if (!blob.current) return; const f = new File([blob.current], nome, { type: 'image/jpeg' });
    if (navigator.canShare?.({ files: [f] })) { try { await navigator.share({ files: [f] }); return; } catch (e) { if ((e as Error).name === 'AbortError') return; } }
    baixar();
  };
  return (
    <div className="pro-cardres">
      <div className="pro-linha"><p className="pro-k cinza"><Swords size={14} aria-hidden="true" /> Card do duelo</p><button className="btn text" onClick={fechar} aria-label="Fechar"><X size={18} aria-hidden="true" /></button></div>
      <div className="pro-cardres-previa">{url ? <img src={url} alt="Card do resultado do duelo" /> : <span>Montando o card…</span>}</div>
      <div className="chips pro-cardres-fundos" role="group" aria-label="Fundo">{FUNDOS.map(f => <button key={f.id} className="chip" aria-pressed={fundo === f.id} onClick={() => setFundo(f.id)}>{f.nome}</button>)}</div>
      <div className="pro-linha pro-quebra">
        <button className="btn solid" onClick={compartilhar} disabled={!url}><Share2 size={16} aria-hidden="true" />Compartilhar</button>
        <button className="btn outline" onClick={baixar} disabled={!url}><Download size={16} aria-hidden="true" />Baixar</button>
      </div>
    </div>
  );
}
