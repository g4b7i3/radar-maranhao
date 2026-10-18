import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Download, Share2, ChevronDown } from 'lucide-react';
import TABELA from './idade-tabela.json';
import { lerTempo, fmtTempo, mascaraTempo } from './CardTreino';
import { AZUL, SIMBOLO, fonte, type Ctx } from './EuVou';

// Tabelas de idade para corrida de rua 2025 (WMA / Alan Jones, domínio público CC0):
// github.com/AlanLyttonJones/Age-Grade-Tables
type Sexo = 'F' | 'M';
type T = { idadeMin: number; dist: number[]; oc: number[]; f: number[][] };
const TAB = TABELA as Record<Sexo, T>;

const DIST = [
  { km: 5, nome: '5 km' }, { km: 10, nome: '10 km' }, { km: 21.0975, nome: 'Meia (21 km)' }, { km: 42.195, nome: 'Maratona (42 km)' },
];

/** Recorde da distância (OC, em segundos) e fator da idade, interpolando distâncias fora da tabela. */
function padrao(sexo: Sexo, km: number, idade: number) {
  const t = TAB[sexo];
  const a = Math.min(100, Math.max(t.idadeMin, Math.round(idade))) - t.idadeMin;
  const d = t.dist;
  if (km <= d[0]) return { oc: t.oc[0] * km / d[0], f: t.f[0][a] };
  if (km >= d[d.length - 1]) { const i = d.length - 1; return { oc: t.oc[i] * km / d[i], f: t.f[i][a] }; }
  let i = d.findIndex(x => x >= km);
  if (Math.abs(d[i] - km) < 0.01) return { oc: t.oc[i], f: t.f[i][a] };
  const j = i - 1, p = Math.log(km / d[j]) / Math.log(d[i] / d[j]);
  return { oc: Math.exp(Math.log(t.oc[j]) + p * (Math.log(t.oc[i]) - Math.log(t.oc[j]))), f: t.f[j][a] + p * (t.f[i][a] - t.f[j][a]) };
}

const NIVEIS = [
  { min: 90, nome: 'Nível mundial', cor: '#ffd166', texto: 'Desempenho de elite mundial para a sua idade.' },
  { min: 80, nome: 'Nível nacional', cor: '#3CE07A', texto: 'Brigaria por pódio em provas nacionais da sua faixa.' },
  { min: 70, nome: 'Nível regional', cor: '#4cc9f0', texto: 'Brigaria por pódio em provas regionais da sua faixa.' },
  { min: 60, nome: 'Nível local', cor: '#a5b4fc', texto: 'Acima da média: bom corredor de provas locais.' },
  { min: 0, nome: 'Em evolução', cor: '#cbd5e1', texto: 'Todo mundo começa aqui. Cada treino sobe essa nota.' },
];
const nivel = (pct: number) => NIVEIS.find(n => pct >= n.min)!;
const fmtKmNome = (km: number) => DIST.find(d => Math.abs(d.km - km) < 0.01)?.nome ?? `${String(Math.round(km * 100) / 100).replace('.', ',')} km`;

async function desenhar(c: HTMLCanvasElement, r: { pct: number; km: number; tempo: number; idade: number; eq: number }) {
  await document.fonts.load(`800 100px "Archivo Variable"`).catch(() => {});
  const W = 1080, H = 1350; c.width = W; c.height = H;
  const ctx = c.getContext('2d') as Ctx;
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2449D6'); g.addColorStop(1, '#14278A');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 2;
  for (const rr of [160, 320, 480]) { ctx.beginPath(); ctx.arc(W - 90, 230, rr, 0, Math.PI * 2); ctx.stroke(); }
  // marca
  ctx.save(); ctx.translate(90, 90); ctx.scale(2.2, 2.2);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(0, 0, 32, 32, 7); ctx.fill();
  ctx.strokeStyle = AZUL; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const p of SIMBOLO) ctx.stroke(new Path2D(p));
  ctx.restore();
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  fonte(ctx, 800, 34, true); ctx.fillText('RADAR CORRIDAS', 180, 138);
  fonte(ctx, 600, 20, false); try { ctx.letterSpacing = '6px'; } catch { /* */ } ctx.fillText('NOTA POR IDADE', 182, 166); try { ctx.letterSpacing = '0px'; } catch { /* */ }
  const n = nivel(r.pct);
  // número grande
  fonte(ctx, 850, 330, true); ctx.fillText(`${r.pct.toFixed(1).replace('.', ',')}%`, 84, 560);
  ctx.fillStyle = n.cor;
  fonte(ctx, 800, 64, true); const tw = ctx.measureText(n.nome.toUpperCase()).width;
  ctx.beginPath(); ctx.roundRect(90, 605, tw + 60, 90, 45); ctx.fill();
  ctx.fillStyle = '#0b1530'; ctx.fillText(n.nome.toUpperCase(), 120, 672);
  // barra de níveis
  const bx = 90, by = 760, bw = 900;
  const escala = (p: number) => bx + bw * Math.max(0, Math.min(1, (p - 40) / 60));
  for (const [a, b, cor] of [[40, 60, '#cbd5e1'], [60, 70, '#a5b4fc'], [70, 80, '#4cc9f0'], [80, 90, '#3CE07A'], [90, 100, '#ffd166']] as [number, number, string][]) {
    ctx.fillStyle = cor; ctx.globalAlpha = .9; ctx.fillRect(escala(a), by, escala(b) - escala(a) - 4, 18);
  }
  ctx.globalAlpha = 1; const mx = escala(r.pct);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(mx, by - 6); ctx.lineTo(mx - 16, by - 32); ctx.lineTo(mx + 16, by - 32); ctx.fill();
  // detalhes
  ctx.fillStyle = '#fff'; fonte(ctx, 800, 76, true);
  ctx.fillText(`${fmtKmNome(r.km)} em ${fmtTempo(r.tempo)}`, 90, 920);
  fonte(ctx, 500, 40, false); ctx.globalAlpha = .9;
  ctx.fillText(`aos ${r.idade} anos`, 90, 980);
  ctx.fillText(`Se tivesse 25 anos, faria em ${fmtTempo(r.eq)}`, 90, 1040);
  ctx.globalAlpha = 1;
  fonte(ctx, 800, 40, true); ctx.fillText('radarcorridasma.com.br', 90, 1230);
  fonte(ctx, 600, 24, false); ctx.globalAlpha = .85; ctx.fillText('Faça a sua: Treino › Nota por idade · @radarcorridasma', 90, 1272); ctx.globalAlpha = 1;
}

export default function NotaIdade() {
  const [sexo, setSexo] = useState<Sexo | null>(null);
  const [idade, setIdade] = useState('');
  const [km, setKm] = useState<number | null>(5);
  const [outra, setOutra] = useState('');
  const [tempo, setTempo] = useState('');
  const [explica, setExplica] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [url, setUrl] = useState<string | null>(null);

  const anos = Number(idade);
  const dist = km ?? (Number(outra.replace(',', '.')) || null);
  const seg = lerTempo(tempo);
  const r = useMemo(() => {
    if (!sexo || !(anos >= 5 && anos <= 100) || !dist || dist < 1 || dist > 200 || !seg) return null;
    const { oc, f } = padrao(sexo, dist, anos);
    const pct = (oc / f) / seg * 100;
    if (pct > 105 || pct < 10) return { erro: true as const };
    return { pct, km: dist, tempo: seg, idade: anos, eq: seg * f, recorde: oc / f };
  }, [sexo, anos, dist, seg]);
  const ok = r && !('erro' in r) ? r : null;

  useEffect(() => {
    if (!ok || !canvas.current) { setUrl(null); return; }
    let vivo = true;
    desenhar(canvas.current, ok).then(() => canvas.current!.toBlob(b => { if (vivo && b) setUrl(old => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(b); }); }, 'image/png'));
    return () => { vivo = false; };
  }, [ok?.pct, ok?.km, ok?.tempo, ok?.idade]); // eslint-disable-line react-hooks/exhaustive-deps

  const track = (n: string) => { try { (window as unknown as { umami?: { track: (e: string) => void } }).umami?.track('Nota por idade: ' + n); } catch { /* */ } };
  async function compartilhar() {
    if (!url) return;
    const b = await (await fetch(url)).blob(); const f = new File([b], 'nota-por-idade.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [f] })) { try { await navigator.share({ files: [f] }); track('compartilhou'); return; } catch (e) { if ((e as Error).name === 'AbortError') return; } }
    baixar();
  }
  function baixar() { if (!url) return; const a = document.createElement('a'); a.href = url; a.download = 'nota-por-idade.png'; document.body.appendChild(a); a.click(); a.remove(); track('baixou'); }
  const n = ok ? nivel(ok.pct) : null;

  return (
    <main className="story-semana card-treino nota-idade">
      <a className="story-voltar" href="/"><ArrowLeft size={18} aria-hidden="true" />Voltar para o Radar</a>
      <nav className="ni-troca" aria-label="Ferramentas de treino"><a href="/?card=treino">Card do treino</a><a href="/?nota=idade" aria-current="page">Nota por idade</a></nav>
      <h1>Nota por idade</h1>
      <p className="fine">Descubra quanto vale o seu tempo levando em conta a sua idade. Assim dá pra comparar de igual pra igual um corredor de 25 com um de 60 anos.</p>

      <p className="euvou-pergunta">1. Você é</p>
      <div className="seg ni-seg" role="group" aria-label="Sexo">
        <button aria-pressed={sexo === 'F'} onClick={() => setSexo('F')}>Mulher</button>
        <button aria-pressed={sexo === 'M'} onClick={() => setSexo('M')}>Homem</button>
      </div>

      <label className="ct-cidade ni-idade">2. Sua idade no dia da prova<input inputMode="numeric" value={idade} onChange={e => setIdade(e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="Ex.: 35" /></label>

      <p className="euvou-pergunta">3. Distância</p>
      <div className="chips" role="group" aria-label="Distância">
        {DIST.map(d => <button key={d.km} className="chip" aria-pressed={km === d.km} onClick={() => setKm(d.km)}>{d.nome}</button>)}
        <button className="chip" aria-pressed={km === null} onClick={() => setKm(null)}>Outra</button>
      </div>
      {km === null && <label className="ct-cidade">Quantos km?<input inputMode="decimal" value={outra} onChange={e => setOutra(e.target.value)} placeholder="Ex.: 7,5" /></label>}

      <label className="ct-cidade">4. Seu tempo<input inputMode="numeric" pattern="[0-9:]*" value={tempo} onChange={e => setTempo(mascaraTempo(e.target.value))} placeholder="Ex.: 28:30" /></label>
      <p className="fine ct-dica">Só os números: <b>2830</b> vira <b>28:30</b>; <b>15500</b> vira <b>1:55:00</b>.</p>

      {r && 'erro' in r && <p className="ct-erro" role="alert">Esse tempo não parece certo para essa distância. Confira o tempo e os km.</p>}
      {!r && <p className="ni-vazio">Preencha os 4 campos e a sua nota aparece aqui.</p>}

      {ok && n && (
        <section className="ni-res" aria-live="polite" style={{ ['--nivel' as string]: n.cor }}>
          <div className="ni-pct"><b>{ok.pct.toFixed(1).replace('.', ',')}%</b><span className="ni-nivel">{n.nome}</span></div>
          <p className="ni-frase">{n.texto}</p>
          <div className="ni-barra" aria-hidden="true">
            {[[40, 60, 'Em evolução'], [60, 70, 'Local'], [70, 80, 'Regional'], [80, 90, 'Nacional'], [90, 100, 'Mundial']].map(([a, b, t]) => <span key={t as string} style={{ flex: (b as number) - (a as number) }}><i>{t}</i></span>)}
            <em style={{ left: `${Math.max(0, Math.min(100, (ok.pct - 40) / 60 * 100))}%` }} />
          </div>
          <dl className="ni-dl">
            <div><dt>Se você tivesse 25 anos, com o mesmo preparo, faria em</dt><dd>{fmtTempo(ok.eq)}</dd></div>
            <div><dt>Recorde mundial pra sua idade</dt><dd>{fmtTempo(ok.recorde)} <small>= 100%</small></dd></div>
          </dl>
          <div className="ni-card">
            <canvas ref={canvas} hidden />
            {url && <img src={url} alt={`Card: ${ok.pct.toFixed(1)}%, ${n.nome}`} />}
            <div className="sheet-actions">
              {'canShare' in navigator && <button className="btn solid" onClick={compartilhar} disabled={!url}><Share2 size={16} aria-hidden="true" />Postar no story</button>}
              <button className={'canShare' in navigator ? 'btn outline' : 'btn solid'} onClick={baixar} disabled={!url}><Download size={16} aria-hidden="true" />Baixar imagem</button>
            </div>
          </div>
        </section>
      )}
      {!ok && <canvas ref={canvas} hidden />}

      <button className="ni-explica-btn" aria-expanded={explica} onClick={() => setExplica(!explica)}>Como funciona? <ChevronDown size={16} aria-hidden="true" /></button>
      {explica && (
        <div className="ni-explica">
          <p>Com a idade, todo mundo fica naturalmente mais lento. A nota compara o seu tempo com o <b>melhor tempo já possível para alguém da sua idade e sexo</b> naquela distância (isso vale 100%).</p>
          <p><b>60%</b> já é um bom corredor de prova local. <b>70%</b>, nível regional. <b>80%</b>, nacional. Acima de <b>90%</b>, elite mundial.</p>
          <p>Usamos as tabelas oficiais de corrida de rua de 2025, adotadas pela associação mundial de atletismo master (WMA) e pela USATF. Provas com muito calor ou subida dão notas um pouco menores.</p>
        </div>
      )}
    </main>
  );
}
