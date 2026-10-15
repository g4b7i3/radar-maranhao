import { useEffect, useRef, useState } from 'react';
import { Download, Share2, ArrowLeft } from 'lucide-react';
import type { Race, State } from './lib';
import { AZUL, FONTE, SIMBOLO, caber, fonte, type Ctx } from './EuVou';

// Story "Provas da semana" (1080×1920), montado na hora com a agenda atual.
// Abra radarcorridas.netlify.app/?story=semana, baixe e poste. Sem servidor, sem custo.

const W = 1080, H = 1920, M = 80;
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Segunda a domingo: 0 = esta semana, 1 = a próxima. */
export function semana(offset: number) {
  const hoje = new Date(); hoje.setHours(12, 0, 0, 0);
  const seg = new Date(hoje); seg.setDate(hoje.getDate() - ((hoje.getDay() + 6) % 7) + 7 * offset);
  const dom = new Date(seg); dom.setDate(seg.getDate() + 6);
  return { ini: iso(seg), fim: iso(dom), seg, dom };
}
function rotuloSemana(seg: Date, dom: Date) {
  return seg.getMonth() === dom.getMonth()
    ? `${seg.getDate()} a ${dom.getDate()} de ${MESES[dom.getMonth()]}`
    : `${seg.getDate()} de ${MESES[seg.getMonth()]} a ${dom.getDate()} de ${MESES[dom.getMonth()]}`;
}
const STATUS: Record<string, [string, string, string]> = { // texto, fundo, cor
  Abertas: ['INSCRIÇÕES ABERTAS', '#3CE07A', '#05230f'],
  'Em breve': ['ABREM EM BREVE', 'rgba(255,255,255,.18)', '#fff'],
  Esgotadas: ['ESGOTADA', 'rgba(255,255,255,.18)', '#fff'],
  Encerradas: ['INSCRIÇÕES ENCERRADAS', 'rgba(255,255,255,.18)', '#fff'],
  Adiada: ['ADIADA', '#f0b552', '#2a1a00'],
};

export async function desenharSemana(canvas: HTMLCanvasElement, provas: Race[], seg: Date, dom: Date, total: number) {
  try { await Promise.all([document.fonts.load(`800 100px ${FONTE}`), document.fonts.load(`500 40px ${FONTE}`)]); } catch { /* fonte do sistema */ }
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d') as Ctx;

  // fundo
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2449D6'); g.addColorStop(1, '#14278A');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 2;
  for (let r = 160; r <= 800; r += 160) { ctx.beginPath(); ctx.arc(W + 60, 300, r, 0, Math.PI * 2); ctx.stroke(); }
  const cores = ['#d52b1e', '#ffffff', '#111111', '#ffffff', '#d52b1e'], fw = W / cores.length;
  cores.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(i * fw, 0, fw + 1, 12); });

  // marca
  ctx.save(); ctx.translate(M, 110);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(0, 0, 72, 72, 15); ctx.fill();
  ctx.scale(72 / 32, 72 / 32); ctx.strokeStyle = AZUL; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  SIMBOLO.forEach(d => ctx.stroke(new Path2D(d)));
  ctx.restore();
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic';
  fonte(ctx, 800, 32, true); ctx.fillText('RADAR CORRIDAS', M + 94, 142);
  fonte(ctx, 500, 21, false); try { ctx.letterSpacing = '7px'; } catch { /* */ }
  ctx.globalAlpha = .88; ctx.fillText('MARANHÃO', M + 94, 174); ctx.globalAlpha = 1;
  try { ctx.letterSpacing = '0px'; } catch { /* */ }
  ctx.textAlign = 'right'; fonte(ctx, 700, 28, false); ctx.fillText('@radarcorridasma', W - M, 156); ctx.textAlign = 'left';

  // título
  fonte(ctx, 800, 150, true); ctx.fillText('PROVAS', M - 4, 380);
  ctx.fillText('DA SEMANA', M - 4, 515);
  ctx.fillStyle = '#3CE07A'; ctx.beginPath(); ctx.arc(M + 12, 576, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; fonte(ctx, 600, 40, false); ctx.fillText(rotuloSemana(seg, dom), M + 40, 590);

  // lista
  const MAX = 5, mostrar = provas.slice(0, MAX);
  let y = 660;
  const linhaH = mostrar.length <= 3 ? 220 : mostrar.length === 4 ? 210 : 176;
  if (!mostrar.length) {
    fonte(ctx, 700, 54, true);
    const t = caber(ctx, 'Semana sem provas no radar. Já dá para planejar as próximas!', 700, 64, 44, W - 2 * M, 3, true);
    for (const l of t.linhas) { y += t.px * 1.1; ctx.fillText(l, M, y); }
  }
  for (const e of mostrar) {
    const d = new Date(e.date + 'T12:00:00');
    // bloco da data
    ctx.fillStyle = 'rgba(5,15,50,.35)'; ctx.beginPath(); ctx.roundRect(M, y, 130, linhaH - 26, 22); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    fonte(ctx, 800, linhaH > 170 ? 84 : 72, true); ctx.fillText(String(d.getDate()), M + 65, y + (linhaH - 26) / 2 + 18);
    fonte(ctx, 700, 26, false); ctx.globalAlpha = .85; ctx.fillText(DIAS[d.getDay()], M + 65, y + (linhaH - 26) / 2 + 54); ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    // nome, cidade e distâncias, status
    const x = M + 160, larg = W - M - x;
    const nome = caber(ctx, e.name, 750, 50, 36, larg, 2, true);
    let ty = y + nome.px * 0.95;
    for (const l of nome.linhas) { ctx.fillText(l, x, ty); ty += nome.px * 1.02; }
    ty += 4;
    const dist = e.distances.length ? e.distances.map(k => `${String(k).replace('.', ',')}k`).join(' · ') : 'distâncias a confirmar';
    const det = caber(ctx, `${e.city} · ${dist}`, 500, 30, 24, larg, 1, false);
    ctx.globalAlpha = .9; ctx.fillText(det.linhas[0], x, ty); ctx.globalAlpha = 1;
    const st = STATUS[e.status];
    if (st && ty + 52 < y + linhaH - 20) {
      fonte(ctx, 800, 20, false); try { ctx.letterSpacing = '1.5px'; } catch { /* */ }
      const tw = ctx.measureText(st[0]).width;
      ctx.fillStyle = st[1]; ctx.beginPath(); ctx.roundRect(x, ty + 14, tw + 28, 36, 18); ctx.fill();
      ctx.fillStyle = st[2]; ctx.fillText(st[0], x + 14, ty + 39);
      try { ctx.letterSpacing = '0px'; } catch { /* */ }
      ctx.fillStyle = '#fff';
    }
    y += linhaH;
  }
  if (provas.length > MAX) {
    fonte(ctx, 700, 34, false); ctx.globalAlpha = .9;
    ctx.fillText(`+ ${provas.length - MAX} ${provas.length - MAX === 1 ? 'prova' : 'provas'} nesta semana no site`, M, y + 22); ctx.globalAlpha = 1;
  }

  // rodapé
  const fy = 1690;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(M, fy - 64, W - 2 * M, 96, 48); ctx.fill();
  ctx.fillStyle = AZUL; ctx.textAlign = 'center'; fonte(ctx, 800, 40, true);
  ctx.fillText(total ? `AGENDA COMPLETA COM ${total} PROVAS: LINK NA BIO` : 'AGENDA COMPLETA: LINK NA BIO', W / 2, fy - 2);
  ctx.textAlign = 'left';
}

const podeCompartilhar = typeof navigator !== 'undefined' && 'canShare' in navigator;

export default function StorySemana() {
  const [data, setData] = useState<State | null>(null);
  const [erro, setErro] = useState('');
  const [offset, setOffset] = useState(() => (new Date().getDay() === 0 ? 1 : 0)); // no domingo, já sugere a próxima semana
  const [url, setUrl] = useState('');
  const blob = useRef<Blob | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    document.title = 'Story da semana · Radar Corridas Maranhão';
    fetch('/data/radar.json', { cache: 'no-store' }).then(r => r.json()).then(setData).catch(() => setErro('Não consegui carregar a agenda. Confira a internet e recarregue.'));
  }, []);

  const s = semana(offset);
  const hojeIso = iso(new Date());
  // nesta semana, só o que ainda vai acontecer (de hoje até domingo)
  const desde = offset === 0 && hojeIso > s.ini ? hojeIso : s.ini;
  const provas = (data?.events ?? []).filter(e => e.date && e.date >= desde && e.date <= s.fim && e.status !== 'Cancelada').sort((a, b) => a.date!.localeCompare(b.date!));
  const hoje = iso(new Date());
  const total = (data?.events ?? []).filter(e => e.date && e.date >= hoje && e.status !== 'Cancelada').length;
  const chave = provas.map(e => e.id + e.status).join('|') + offset;

  useEffect(() => {
    if (!data) return;
    let vivo = true;
    const c = canvas.current ?? (canvas.current = document.createElement('canvas'));
    desenharSemana(c, provas, s.seg, s.dom, total).then(() => c.toBlob(b => {
      if (!vivo || !b) return;
      blob.current = b;
      setUrl(old => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(b); });
    }, 'image/png'));
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, chave]);

  const nome = `provas-da-semana-${s.ini}.png`;
  async function compartilhar() {
    if (!blob.current) return;
    const f = new File([blob.current], nome, { type: 'image/png' });
    if (navigator.canShare?.({ files: [f] })) { try { await navigator.share({ files: [f] }); return; } catch (e) { if ((e as Error).name === 'AbortError') return; } }
    baixar();
  }
  function baixar() { if (!url) return; const a = document.createElement('a'); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); }

  return (
    <main className="story-semana">
      <a className="story-voltar" href="/"><ArrowLeft size={18} aria-hidden="true" />Voltar para o Radar</a>
      <h1>Story da semana</h1>
      <p className="fine">Montado agora com a agenda atualizada. Baixe e poste nos stories do @radarcorridasma, com o link do site.</p>
      <div className="seg" role="group" aria-label="Qual semana">
        <button aria-pressed={offset === 0} onClick={() => setOffset(0)}>Esta semana</button>
        <button aria-pressed={offset === 1} onClick={() => setOffset(1)}>Próxima semana</button>
      </div>
      <p className="story-info">{rotuloSemana(s.seg, s.dom)} · {provas.length === 1 ? '1 prova' : `${provas.length} provas`}{provas.length > 5 ? ` (as 5 primeiras entram no story; as outras aparecem como "+${provas.length - 5}")` : ''}</p>
      {erro ? <p role="alert">{erro}</p> : (
        <div className="euvou-preview story-preview">{url ? <img src={url} alt={`Story das provas da semana de ${rotuloSemana(s.seg, s.dom)}`} /> : <span>Montando…</span>}</div>
      )}
      <div className="euvou-actions">
        {podeCompartilhar && <button className="btn solid" onClick={compartilhar} disabled={!url}><Share2 size={16} aria-hidden="true" />Compartilhar</button>}
        <button className={podeCompartilhar ? 'btn outline' : 'btn solid'} onClick={baixar} disabled={!url}><Download size={16} aria-hidden="true" />Baixar imagem</button>
      </div>
    </main>
  );
}
