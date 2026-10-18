import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, Download, Share2, Trash2 } from 'lucide-react';
import { AZUL, FONTE, SIMBOLO, caber, fonte, type Ctx, type Foto } from './EuVou';

// Card do treino para o story (estilo dos cards do Strava), montado no próprio celular.
// A pessoa põe distância e ritmo (ou tempo), escolhe a zona, e baixa o card pronto.

export const ZONAS = [
  { id: 'Z1', nome: 'Regenerativo', cor: '#7ec8ff' },
  { id: 'Z2', nome: 'Leve', cor: '#3CE07A' },
  { id: 'Z3', nome: 'Moderado', cor: '#ffd166' },
  { id: 'Z4', nome: 'Limiar', cor: '#ff9f43' },
  { id: 'Z5', nome: 'Forte', cor: '#ff5a5f' },
] as const;
const TIPOS = ['Rodagem', 'Longão', 'Intervalado', 'Fartlek', 'Tiro', 'Regenerativo', 'Prova'] as const;
type Fundo = 'transparente' | 'azul' | 'foto';

// ---------- contas ----------
/** "7:13", "7.13", "7'13" → segundos por km */
export function lerRitmo(t: string): number | null {
  const m = /^\s*(\d{1,2})\s*[:.'´h]\s*(\d{1,2})\s*"?\s*$/.exec(t) || /^\s*(\d{1,2})\s*$/.exec(t);
  if (!m) return null;
  const s = Number(m[1]) * 60 + Number(m[2] ?? 0);
  return m[2] != null && Number(m[2]) > 59 ? null : s > 0 ? s : null;
}
/** "32:31", "1:05:20", "45" (min) → segundos */
export function lerTempo(t: string): number | null {
  const p = t.trim().split(/[:.h]/).filter(Boolean).map(Number);
  if (!p.length || p.some(x => !Number.isFinite(x) || x < 0)) return null;
  if (p.length === 1) return p[0] > 0 ? p[0] * 60 : null;
  if (p.length === 2) return p[1] > 59 ? null : p[0] * 60 + p[1];
  if (p.length === 3) return p[1] > 59 || p[2] > 59 ? null : p[0] * 3600 + p[1] * 60 + p[2];
  return null;
}
export const lerKm = (t: string) => { const n = Number(t.replace(',', '.').replace(/[^\d.]/g, '')); return n > 0 && n < 400 ? n : null; };
export const fmtKm = (k: number) => k.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtRitmo = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
export function fmtTempo(s: number) {
  s = Math.round(s);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? `${h}h ${String(m).padStart(2, '0')}min` : `${m}min ${String(x).padStart(2, '0')}s`;
}
const tempoCampo = (s: number) => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`; };

/** Máscara: a pessoa digita só números e os dois-pontos entram sozinhos (415 → 4:15; 1013 → 10:13) */
export function mascaraRitmo(t: string) {
  const d = t.replace(/\D/g, '').slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, -2)}:${d.slice(-2)}`;
}
/** 3000 → 30:00; 12500 → 1:25:00; 325 → 3:25 (os dois últimos são sempre os segundos) */
export function mascaraTempo(t: string) {
  const d = t.replace(/\D/g, '').replace(/^0+(?=\d{3})/, '').slice(0, 6);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, -2)}:${d.slice(-2)}`;
  return `${d.slice(0, -4)}:${d.slice(-4, -2)}:${d.slice(-2)}`;
}

// ---------- desenho ----------
function percurso(ctx: Ctx, cx: number, cy: number, larg: number, semente: number, cor: string) {
  // traço estilizado e suave (não é o percurso real): muda conforme a distância
  let s = Math.floor(semente * 1000) || 7;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const n = 7, pts: [number, number][] = [];
  for (let i = 0; i < n; i++) pts.push([cx - larg / 2 + (larg * i) / (n - 1), cy + (rnd() - 0.5) * 70]);
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 12;
  ctx.strokeStyle = cor; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < n - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my); }
  ctx.lineTo(pts[n - 1][0], pts[n - 1][1]); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = cor; ctx.beginPath(); ctx.arc(pts[n - 1][0], pts[n - 1][1], 14, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.stroke();
  ctx.restore();
}

/** pos: deslocamento (px do card) e escala do bloco de informações, quando a pessoa arrasta por cima da foto */
export type Pos = { x: number; y: number; s: number };
export type DadosCard = { km: number; ritmo: number; tempo: number; zona: typeof ZONAS[number] | null; tipo: string | null; cidade: string; fundo: Fundo; foto: Foto; focoY: number; pos?: Pos };

export async function desenharTreino(canvas: HTMLCanvasElement, d: DadosCard) {
  try { await Promise.all([document.fonts.load(`800 100px ${FONTE}`), document.fonts.load(`500 40px ${FONTE}`)]); } catch { /* fonte do sistema */ }
  const transp = d.fundo === 'transparente';
  const W = 1080, H = transp ? 1300 : 1920;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d') as Ctx;
  ctx.clearRect(0, 0, W, H);

  // fundo
  if (d.fundo === 'azul' || (d.fundo === 'foto' && !d.foto)) {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2449D6'); g.addColorStop(1, '#14278A');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 2;
    for (let r = 160; r <= 960; r += 160) { ctx.beginPath(); ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2); ctx.stroke(); }
  } else if (d.fundo === 'foto' && d.foto) {
    const f = d.foto, sc = Math.max(W / f.w, H / f.h), dw = f.w * sc, dh = f.h * sc;
    ctx.drawImage(f.img, (W - dw) / 2, (H - dh) * Math.min(1, Math.max(0, d.focoY)), dw, dh);
    const v = ctx.createLinearGradient(0, 0, 0, H);
    v.addColorStop(0, 'rgba(5,12,40,.55)'); v.addColorStop(.3, 'rgba(5,12,40,.2)'); v.addColorStop(.55, 'rgba(5,12,40,.35)'); v.addColorStop(1, 'rgba(5,12,40,.8)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }
  if (!transp) {
    const cores = ['#d52b1e', '#ffffff', '#111111', '#ffffff', '#d52b1e'], fw = W / cores.length;
    cores.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(i * fw, 0, fw + 1, 12); });
  }

  // bloco de informações: na foto, a pessoa pode arrastar e mudar o tamanho
  const pos = d.fundo === 'foto' && d.pos ? d.pos : null;
  if (pos) { ctx.save(); ctx.translate(W / 2 + pos.x, H / 2 + pos.y); ctx.scale(pos.s, pos.s); ctx.translate(-W / 2, -H / 2); }

  // sombra no texto quando vai por cima de foto (transparente ou foto)
  const sombra = (on: boolean) => { ctx.shadowColor = on ? 'rgba(0,0,0,.45)' : 'transparent'; ctx.shadowBlur = on ? 18 : 0; ctx.shadowOffsetY = on ? 2 : 0; };
  const comSombra = d.fundo !== 'azul';
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';

  // bloco central: distância, ritmo, tempo (como no Strava)
  const blocoH = 3 * 200;
  let y = transp ? 120 : (H - blocoH) / 2 - 170;
  const linha = (rot: string, val: string) => {
    sombra(comSombra);
    fonte(ctx, 600, 40, false); ctx.globalAlpha = .9; ctx.fillText(rot, W / 2, y + 40); ctx.globalAlpha = 1;
    fonte(ctx, 800, 118, true); ctx.fillText(val, W / 2, y + 160);
    y += 200;
  };
  linha('Distância', `${fmtKm(d.km)} km`);
  linha('Ritmo', `${fmtRitmo(d.ritmo)} /km`);
  linha('Tempo', fmtTempo(d.tempo));
  sombra(false);

  // percursinho
  percurso(ctx, W / 2, y + 50, 420, d.km + d.ritmo / 100, d.zona?.cor ?? '#3CE07A');
  y += 150;

  // zona e tipo
  const pills: { t: string; bg: string; fg: string }[] = [];
  if (d.zona) pills.push({ t: `${d.zona.id} · ${d.zona.nome.toUpperCase()}`, bg: d.zona.cor, fg: '#0b1530' });
  if (d.tipo) pills.push({ t: d.tipo.toUpperCase(), bg: 'rgba(255,255,255,.18)', fg: '#fff' });
  if (pills.length) {
    fonte(ctx, 800, 34, false); try { ctx.letterSpacing = '2px'; } catch { /* */ }
    const ws = pills.map(p => ctx.measureText(p.t).width + 56), gap = 16, total = ws.reduce((a, b) => a + b, 0) + gap * (pills.length - 1);
    let x = (W - total) / 2;
    pills.forEach((p, i) => {
      sombra(comSombra && p.bg.startsWith('rgba'));
      ctx.fillStyle = p.bg.startsWith('rgba') && d.fundo === 'transparente' ? 'rgba(10,20,50,.55)' : p.bg;
      ctx.beginPath(); ctx.roundRect(x, y, ws[i], 70, 35); ctx.fill(); sombra(false);
      ctx.fillStyle = p.fg; ctx.textAlign = 'center'; ctx.fillText(p.t, x + ws[i] / 2, y + 47);
      x += ws[i] + gap;
    });
    try { ctx.letterSpacing = '0px'; } catch { /* */ }
    y += 120;
  }

  // local
  sombra(comSombra); ctx.fillStyle = '#fff';
  const loc = caber(ctx, `${d.cidade.trim() || 'São Luís'} · MA`, 600, 44, 30, W - 200, 1, false);
  ctx.textAlign = 'center'; ctx.fillText(loc.linhas[0], W / 2 + 22, y + 10);
  const lw = ctx.measureText(loc.linhas[0]).width;
  // alfinete
  const px = W / 2 + 22 - lw / 2 - 34, py = y - 4;
  ctx.beginPath(); ctx.arc(px, py - 8, 13, Math.PI, 0); ctx.lineTo(px, py + 18); ctx.closePath(); ctx.fill();
  ctx.fillStyle = d.fundo === 'azul' ? '#1d3fbf' : 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.arc(px, py - 8, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  y += 90;

  // marca do Radar
  const by = transp ? H - 110 : H - 250;
  sombra(comSombra);
  ctx.save(); ctx.translate(W / 2 - 200, by);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(0, 0, 64, 64, 14); ctx.fill();
  sombra(false);
  ctx.scale(64 / 32, 64 / 32); ctx.strokeStyle = AZUL; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  SIMBOLO.forEach(p => ctx.stroke(new Path2D(p)));
  ctx.restore();
  sombra(comSombra);
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
  fonte(ctx, 800, 32, true); ctx.fillText('RADAR CORRIDAS', W / 2 - 120, by + 30);
  fonte(ctx, 600, 26, false); ctx.globalAlpha = .9; ctx.fillText('@radarcorridasma', W / 2 - 120, by + 62); ctx.globalAlpha = 1;
  sombra(false);
  if (pos) ctx.restore();
}

// ---------- página ----------
export default function CardTreino() {
  const [km, setKm] = useState('5');
  const [ritmo, setRitmo] = useState('6:00');
  const [tempo, setTempo] = useState('30:00');
  const [manda, setManda] = useState<'ritmo' | 'tempo'>('ritmo'); // o último que a pessoa editou manda no outro
  const [zona, setZona] = useState<typeof ZONAS[number] | null>(ZONAS[1]);
  const [tipo, setTipo] = useState<string | null>(null);
  const [cidade, setCidade] = useState('São Luís');
  const [fundo, setFundo] = useState<Fundo>('transparente');
  const [foto, setFoto] = useState<Foto>(null);
  const [focoY, setFocoY] = useState(0.4);
  const [url, setUrl] = useState('');
  const [pos, setPos] = useState<Pos>({ x: 0, y: 0, s: 1 });
  const [arrastando, setArrastando] = useState(false);
  const vivo = useRef<HTMLCanvasElement>(null); // prévia que dá para arrastar (modo foto)
  const toque = useRef<{ id: number; cx: number; cy: number; x0: number; y0: number } | null>(null);
  const comFoto = fundo === 'foto' && !!foto;
  const [aviso, setAviso] = useState('');
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const blob = useRef<Blob | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => { document.title = 'Card do treino · Radar Corridas Maranhão'; }, []);

  const K = lerKm(km), R = lerRitmo(ritmo), T = lerTempo(tempo);
  // calcula o que falta
  const ritmoS = manda === 'ritmo' ? R : K && T ? T / K : null;
  const tempoS = manda === 'tempo' ? T : K && R ? K * R : null;
  const ok = !!(K && ritmoS && tempoS && ritmoS >= 120 && ritmoS <= 1800);
  // recalcula o outro campo na mesma hora em que a pessoa digita (sem ficar um passo atrasado)
  function mudarKm(v: string) {
    setKm(v);
    const k = lerKm(v); if (!k) return;
    if (manda === 'ritmo' && R) setTempo(tempoCampo(k * R));
    if (manda === 'tempo' && T) setRitmo(fmtRitmo(T / k));
  }
  function mudarRitmo(v: string) {
    const m = mascaraRitmo(v); setManda('ritmo'); setRitmo(m);
    const r = lerRitmo(m); if (K && r && r >= 120 && r <= 1800) setTempo(tempoCampo(K * r));
  }
  function mudarTempo(v: string) {
    const m = mascaraTempo(v); setManda('tempo'); setTempo(m);
    const t = lerTempo(m); if (K && t) { const r = t / K; if (r >= 120 && r <= 1800) setRitmo(fmtRitmo(r)); }
  }

  useEffect(() => {
    if (!ok) return;
    let ativo = true;
    // com foto, desenha direto na prévia (o arrasto aparece na hora); sem foto, num canvas fora da tela
    const c = (comFoto && vivo.current) || (canvas.current ??= document.createElement('canvas'));
    const t = setTimeout(() => desenharTreino(c, { km: K!, ritmo: ritmoS!, tempo: tempoS!, zona, tipo, cidade, fundo, foto, focoY, pos }).then(() => {
      if (!ativo || arrastando) return; // a imagem final só é gerada quando a pessoa solta o dedo
      c.toBlob(b => {
        if (!ativo || !b) return;
        blob.current = b;
        setUrl(old => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(b); });
      }, fundo === 'foto' ? 'image/jpeg' : 'image/png', 0.92);
    }), arrastando ? 0 : 120);
    return () => { ativo = false; clearTimeout(t); };
  }, [ok, K, ritmoS, tempoS, zona, tipo, cidade, fundo, foto, focoY, pos, arrastando, comFoto]);

  // arrastar o bloco com o dedo (ou o mouse) por cima da foto
  function inicioArrasto(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    toque.current = { id: e.pointerId, cx: e.clientX, cy: e.clientY, x0: pos.x, y0: pos.y };
    setArrastando(true);
  }
  function moverArrasto(e: React.PointerEvent<HTMLCanvasElement>) {
    const t = toque.current; if (!t || t.id !== e.pointerId) return;
    const k = 1080 / e.currentTarget.getBoundingClientRect().width;
    setPos(p => ({ ...p, x: Math.max(-540, Math.min(540, t.x0 + (e.clientX - t.cx) * k)), y: Math.max(-960, Math.min(960, t.y0 + (e.clientY - t.cy) * k)) }));
  }
  function fimArrasto() { if (!toque.current) return; toque.current = null; setArrastando(false); }

  async function escolherFoto(file: File | undefined) {
    if (!file) return;
    const src = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = src; await img.decode();
      const k = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      setFoto({ img: c, w: c.width, h: c.height }); setFundo('foto');
    } catch { setAviso('Não consegui abrir essa foto. Tente outra (JPG ou PNG).'); }
    finally { URL.revokeObjectURL(src); if (entrada.current) entrada.current.value = ''; }
  }
  const track = (acao: string) => { try { (window as unknown as { umami?: { track: (n: string, d?: object) => void } }).umami?.track('Card do treino', { acao, fundo, zona: zona?.id ?? '-' }); } catch { /* */ } };
  const nome = `treino-${K ? fmtKm(K).replace(',', '-') : ''}km.${fundo === 'foto' ? 'jpg' : 'png'}`;
  async function compartilhar() {
    if (!blob.current) return;
    const f = new File([blob.current], nome, { type: blob.current.type });
    if (navigator.canShare?.({ files: [f] })) { try { await navigator.share({ files: [f] }); track('compartilhou'); return; } catch (e) { if ((e as Error).name === 'AbortError') return; } }
    baixar();
  }
  function baixar() {
    if (!url) return; const a = document.createElement('a'); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
    setAviso(fundo === 'transparente' ? 'Imagem salva. No story, ponha sua foto e use o adesivo de foto (ou cole) para colocar o card por cima.' : 'Imagem salva. É só postar no story.');
    track('baixou');
  }
  const podeCompartilhar = typeof navigator !== 'undefined' && 'canShare' in navigator;

  return (
    <main className="story-semana card-treino">
      <a className="story-voltar" href="/"><ArrowLeft size={18} aria-hidden="true" />Voltar para o Radar</a>
      <nav className="ni-troca" aria-label="Ferramentas de treino"><a href="/?card=treino" aria-current="page">Card do treino</a><a href="/?nota=idade" data-umami-event="Nota por idade: abriu pelo card do treino">Nota por idade <b>novo</b></a></nav>
      <h1>Card do treino</h1>
      <p className="fine">Coloque a distância e o ritmo (ou o tempo): o resto a gente calcula. Depois é só postar no story.</p>

      <div className="ct-campos">
        <label>Distância (km)<input inputMode="decimal" value={km} onChange={e => mudarKm(e.target.value)} placeholder="4,5" /></label>
        <label>Ritmo (min/km)<input inputMode="numeric" pattern="[0-9:]*" value={ritmo} onChange={e => mudarRitmo(e.target.value)} placeholder="7:13" /></label>
        <label>Tempo<input inputMode="numeric" pattern="[0-9:]*" value={tempo} onChange={e => mudarTempo(e.target.value)} placeholder="32:31" /></label>
      </div>
      <p className="fine ct-dica">Digite só os números: os dois-pontos entram sozinhos (<b>713</b> vira <b>7:13</b>; <b>3231</b> vira <b>32:31</b>; <b>10520</b> vira <b>1:05:20</b>).</p>
      {!ok && <p className="ct-erro" role="alert">Confira os números: a distância em km (ex.: 4,5) e o ritmo entre 2:00 e 30:00 por km.</p>}

      <p className="euvou-pergunta">Zona do treino</p>
      <div className="chips ct-zonas" role="group" aria-label="Zona do treino">
        {ZONAS.map(z => <button key={z.id} className="chip" aria-pressed={zona?.id === z.id} onClick={() => setZona(zona?.id === z.id ? null : z)} style={{ ['--zona' as string]: z.cor }}><b>{z.id}</b> {z.nome}</button>)}
      </div>
      <p className="euvou-pergunta">Tipo de treino <small>(opcional)</small></p>
      <div className="chips" role="group" aria-label="Tipo de treino">
        {TIPOS.map(t => <button key={t} className="chip" aria-pressed={tipo === t} onClick={() => setTipo(tipo === t ? null : t)}>{t}</button>)}
      </div>
      <label className="ct-cidade">Cidade<input value={cidade} onChange={e => setCidade(e.target.value)} maxLength={40} /></label>

      <p className="euvou-pergunta">Fundo</p>
      <div className="seg" role="group" aria-label="Fundo do card">
        <button aria-pressed={fundo === 'transparente'} onClick={() => setFundo('transparente')}>Transparente</button>
        <button aria-pressed={fundo === 'azul'} onClick={() => setFundo('azul')}>Azul</button>
        <button aria-pressed={fundo === 'foto'} onClick={() => (foto ? setFundo('foto') : entrada.current?.click())}>Minha foto</button>
      </div>
      <input ref={entrada} type="file" accept="image/*" hidden onChange={e => escolherFoto(e.target.files?.[0])} />
      {fundo === 'foto' && foto && (
        <div className="euvou-foto">
          <button className="btn outline" onClick={() => entrada.current?.click()}><Camera size={16} aria-hidden="true" />Trocar foto</button>
          <button className="icon-btn" onClick={() => { setFoto(null); setFundo('transparente'); }} aria-label="Tirar a foto"><Trash2 size={18} /></button>
        </div>
      )}
      {comFoto && <label className="euvou-ajuste">Ajustar a posição da foto<input type="range" min={0} max={1} step={0.01} value={focoY} onChange={e => setFocoY(Number(e.target.value))} /></label>}
      {comFoto && <>
        <p className="fine"><b>Arraste as informações com o dedo</b> para onde ficar melhor na foto.</p>
        <div className="ct-tamanho">
          <label className="euvou-ajuste">Tamanho das informações<input type="range" min={0.5} max={1.3} step={0.01} value={pos.s} onChange={e => setPos(p => ({ ...p, s: Number(e.target.value) }))} /></label>
          <button className="btn outline" onClick={() => setPos({ x: 0, y: 0, s: 1 })}>Centralizar</button>
        </div>
      </>}
      {fundo === 'transparente' && <p className="fine">Transparente é como o card do Strava: você coloca por cima da sua própria foto no story.</p>}

      <div className={fundo === 'transparente' ? 'euvou-preview story-preview ct-xadrez' : 'euvou-preview story-preview'} style={fundo === 'transparente' ? { aspectRatio: '1080 / 1300' } : undefined}>
        {comFoto
          ? <canvas ref={vivo} className="ct-vivo" aria-label="Prévia do card: arraste as informações para posicionar" onPointerDown={inicioArrasto} onPointerMove={moverArrasto} onPointerUp={fimArrasto} onPointerCancel={fimArrasto} />
          : url && ok ? <img src={url} alt="Prévia do card do treino" /> : <span>Montando…</span>}
      </div>
      <div className="euvou-actions">
        {podeCompartilhar && <button className="btn solid" onClick={compartilhar} disabled={!url || !ok || arrastando}><Share2 size={16} aria-hidden="true" />Compartilhar</button>}
        <button className={podeCompartilhar ? 'btn outline' : 'btn solid'} onClick={baixar} disabled={!url || !ok || arrastando}><Download size={16} aria-hidden="true" />Baixar imagem</button>
      </div>
      {aviso && <p className="fine" role="status">{aviso}</p>}
      <p className="fine">Nada é enviado: o card e a foto ficam só no seu celular. Marque o <b>@radarcorridasma</b> no story.</p>
    </main>
  );
}
