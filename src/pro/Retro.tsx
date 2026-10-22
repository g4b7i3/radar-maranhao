// Retrospectiva da temporada: os números do ano num card pro story (1080×1920). Sempre disponível; em dezembro ganha destaque.
import { useEffect, useRef, useState } from 'react';
import { Share2, Download, Sparkles, X } from 'lucide-react';
import { AZUL, SIMBOLO, fonte, caber, type Ctx } from '../EuVou';
import { sb, MEDALHAS, relogio, pct, kmTxt, type Perfil, type Resultado, type Liga, LIGAS } from './sb';
import { fotoPerfil, fotoRedonda } from './CardResultado';
import { recordes } from './Recordes';
import { sequenciaMeses } from './Metas';
import { salvarImagem } from '../salvar';

const W = 1080, H = 1920;
type Num = { ano: number; provas: number; km: number; cidades: number; melhorNota: number | null; melhorProva: string | null; pontos: number; medalhas: number; reis: number; liga: Liga | null; indice: number | null; posicao: number | null; seq: number; recs: { rot: string; t: number }[] };

export function numeros(res: Resultado[], meds: string[], reis: number, liga: Liga | null, indice: number | null, posicao: number | null, ano: number): Num {
  const v = res.filter(r => r.status !== 'recusado' && Number(String(r.prova_data).slice(0, 4)) === ano);
  const ok = v.filter(r => r.status === 'verificado' || r.status === 'aprovado');
  const melhor = ok.slice().sort((a, b) => Number(b.nota) - Number(a.nota))[0];
  return {
    ano, provas: v.length, km: Math.round(v.reduce((a, r) => a + Number(r.distancia_km), 0)), cidades: new Set(v.map(r => r.cidade)).size,
    melhorNota: melhor ? Number(melhor.nota) : null, melhorProva: melhor?.prova_nome ?? null, pontos: ok.reduce((a, r) => a + r.pontos, 0),
    medalhas: meds.length, reis, liga, indice, posicao, seq: sequenciaMeses(v.map(r => ({ data: r.prova_data, cidade: r.cidade, status: r.status }))),
    recs: recordes(v.map(r => ({ prova: r.prova_nome, data: r.prova_data, km: Number(r.distancia_km), tempo: r.tempo_s, status: r.status }))).filter(x => x.r).map(x => ({ rot: x.rot, t: x.r!.tempo })),
  };
}

async function desenhar(c: HTMLCanvasElement, n: Num, apelido: string, avatar: HTMLImageElement | null, pre: boolean) {
  c.width = W; c.height = H;
  const ctx = c.getContext('2d') as Ctx;
  await document.fonts?.ready;
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#070d26'); g.addColorStop(.5, '#0d1a5c'); g.addColorStop(1, AZUL);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(255,211,77,${0.08 + (i % 5) * 0.04})`; ctx.beginPath(); ctx.arc((i * 263) % W, (i * 419) % H, 2 + (i % 4), 0, Math.PI * 2); ctx.fill(); }
  const rg = ctx.createRadialGradient(W * .5, 560, 10, W * .5, 560, 600); rg.addColorStop(0, 'rgba(255,211,77,.3)'); rg.addColorStop(1, 'rgba(255,211,77,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  const X = 84;
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 14;
  ctx.save(); ctx.translate(X, 96); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(0, 0, 76, 76, 18); ctx.fill();
  ctx.shadowBlur = 0; ctx.translate(6, 6); ctx.scale(2, 2); ctx.strokeStyle = AZUL; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  SIMBOLO.forEach(p => ctx.stroke(new Path2D(p))); ctx.restore();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; fonte(ctx, 900, 38, true); ctx.fillText('RADAR PRO', X + 98, 132);
  fonte(ctx, 600, 26, false); ctx.globalAlpha = .9; ctx.fillText('Corridas MA', X + 98, 166); ctx.globalAlpha = 1;
  // título
  ctx.textAlign = 'center';
  fonte(ctx, 700, 34, false); ctx.globalAlpha = .9; try { ctx.letterSpacing = '5px'; } catch { /* */ } ctx.fillText(pre ? `PRÉ-TEMPORADA ${n.ano + 1}` : `TEMPORADA ${n.ano}`, W / 2, 330); try { ctx.letterSpacing = '0px'; } catch { /* */ } ctx.globalAlpha = 1;
  if (avatar) fotoRedonda(ctx, avatar, W / 2, 470, 88);
  fonte(ctx, 900, 64, true); ctx.fillText(`@${apelido}`, W / 2, avatar ? 620 : 470);
  const gg = ctx.createLinearGradient(0, 640, 0, 760); gg.addColorStop(0, '#fff1b8'); gg.addColorStop(.6, '#f2b705'); gg.addColorStop(1, '#e2a400');
  ctx.fillStyle = gg; fonte(ctx, 900, 110, true); ctx.fillText('MINHA TEMPORADA', W / 2, avatar ? 740 : 590);
  ctx.fillStyle = '#fff';
  // grade de números
  const itens: [string, string][] = [[String(n.provas), n.provas === 1 ? 'PROVA' : 'PROVAS'], [String(n.km), 'KM EM PROVAS'], [String(n.cidades), n.cidades === 1 ? 'CIDADE' : 'CIDADES'], [String(n.pontos), 'PONTOS'], [String(n.medalhas), 'MEDALHAS'], [n.melhorNota != null ? `${pct(n.melhorNota)}%` : '–', 'MELHOR NOTA']];
  const y0 = avatar ? 830 : 680, cw = (W - 2 * X) / 3, ch = 200;
  itens.forEach(([v, rot], i) => {
    const x = X + (i % 3) * cw, y = y0 + Math.floor(i / 3) * ch;
    ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.roundRect(x + 8, y, cw - 16, ch - 16, 26); ctx.fill();
    ctx.shadowBlur = 14; ctx.fillStyle = '#fff'; fonte(ctx, 900, 84, true); ctx.fillText(v, x + cw / 2, y + 100);
    fonte(ctx, 700, 22, false); ctx.globalAlpha = .85; try { ctx.letterSpacing = '2px'; } catch { /* */ } ctx.fillText(rot, x + cw / 2, y + 150); try { ctx.letterSpacing = '0px'; } catch { /* */ } ctx.globalAlpha = 1;
  });
  let y = y0 + 2 * ch + 40;
  // liga + posição + reis
  const extras: string[] = [];
  if (n.liga) extras.push(`Liga ${LIGAS.find(l => l.id === n.liga)?.nome}${n.indice != null ? ` · índice ${pct(n.indice)}` : ''}`);
  if (n.posicao) extras.push(`${n.posicao}º no Maranhão`);
  if (n.reis) extras.push(`${n.reis}× Rei/Rainha da prova 👑`);
  if (n.seq >= 2) extras.push(`${n.seq} meses seguidos com prova 🔥`);
  fonte(ctx, 700, 36, false);
  extras.forEach(t => { ctx.fillText(t, W / 2, y); y += 54; });
  // recordes
  if (n.recs.length) {
    y += 30; fonte(ctx, 700, 24, false); ctx.globalAlpha = .85; try { ctx.letterSpacing = '4px'; } catch { /* */ } ctx.fillText('MELHORES TEMPOS', W / 2, y); try { ctx.letterSpacing = '0px'; } catch { /* */ } ctx.globalAlpha = 1; y += 60;
    const rw = (W - 2 * X) / n.recs.length;
    n.recs.forEach((r, i) => { const x = X + i * rw + rw / 2; fonte(ctx, 900, 56, true); ctx.fillText(relogio(r.t), x, y); fonte(ctx, 700, 24, false); ctx.globalAlpha = .85; ctx.fillText(r.rot, x, y + 40); ctx.globalAlpha = 1; });
  }
  // melhor prova
  if (n.melhorProva) { ctx.shadowBlur = 10; fonte(ctx, 600, 30, false); ctx.globalAlpha = .9; const t = caber(ctx, `Melhor prova: ${n.melhorProva}`, 600, 30, 24, W - 2 * X, 1, false); ctx.fillText(t.linhas[0], W / 2, H - 170); ctx.globalAlpha = 1; }
  fonte(ctx, 600, 28, false); ctx.globalAlpha = .9; ctx.fillText(`radarcorridasma.com.br/?atleta=${apelido}`, W / 2, H - 100); ctx.globalAlpha = 1;
}

export function Retro({ perfil, res, meds, reis, liga, indice, posicao }: { perfil: Perfil; res: Resultado[]; meds: string[]; reis: number; liga: Liga | null; indice: number | null; posicao: number | null }) {
  const ano = new Date().getFullYear();
  const [aberto, setAberto] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const blob = useRef<Blob | null>(null);
  const n = numeros(res, meds, reis, liga, indice, posicao, ano);
  const dezembro = new Date().getMonth() === 11;
  useEffect(() => {
    if (!aberto) return;
    let ativo = true;
    (async () => {
      const av = (await fotoPerfil([perfil.apelido]).catch(() => new Map())).get(perfil.apelido) ?? null;
      const c = document.createElement('canvas');
      await desenhar(c, n, perfil.apelido, av, ano === 2026);
      c.toBlob(b => { if (!ativo || !b) return; blob.current = b; setUrl(u => { if (u) URL.revokeObjectURL(u); return URL.createObjectURL(b); }); }, 'image/jpeg', .92);
    })();
    return () => { ativo = false; };
  }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps
  const nome = `radar-temporada-${ano}-${perfil.apelido}.jpg`;
  const baixar = () => { if (!url) return; salvarImagem(url, nome); };
  const compartilhar = async () => {
    if (!blob.current) return; const f = new File([blob.current], nome, { type: 'image/jpeg' });
    if (navigator.canShare?.({ files: [f] })) { try { await navigator.share({ files: [f] }); return; } catch (e) { if ((e as Error).name === 'AbortError') return; } }
    baixar();
  };
  if (n.provas === 0) return null;
  return (
    <section className={'pro-card pro-retro' + (dezembro ? ' dezembro' : '')}>
      <div className="pro-linha"><p className="pro-k cinza"><Sparkles size={14} aria-hidden="true" /> {ano === 2026 ? 'Minha pré-temporada 2027' : `Minha temporada ${ano}`} em números</p>{aberto && <button className="btn text" onClick={() => setAberto(false)} aria-label="Fechar"><X size={18} aria-hidden="true" /></button>}</div>
      {dezembro && <p className="pro-sem-margem"><b>O ano está acabando.</b> Poste a sua retrospectiva.</p>}
      <div className="pro-retro-nums"><div><b>{n.provas}</b><small>provas</small></div><div><b>{n.km}</b><small>km</small></div><div><b>{n.cidades}</b><small>cidades</small></div><div><b>{n.medalhas}</b><small>medalhas</small></div><div><b>{n.melhorNota != null ? `${pct(n.melhorNota)}%` : '–'}</b><small>melhor nota</small></div><div><b>{n.reis}</b><small>reis</small></div></div>
      {aberto
        ? <><div className="pro-cardres-previa">{url ? <img src={url} alt="Card da retrospectiva" /> : <span>Montando o card…</span>}</div><div className="pro-linha pro-quebra"><button className="btn solid" onClick={compartilhar} disabled={!url}><Share2 size={16} aria-hidden="true" />Compartilhar</button><button className="btn outline" onClick={baixar} disabled={!url}><Download size={16} aria-hidden="true" />Baixar</button></div></>
        : <button className={'btn pro-btn ' + (dezembro ? 'solid' : 'outline')} onClick={() => setAberto(true)}><Sparkles size={16} aria-hidden="true" />Card da retrospectiva</button>}
    </section>
  );
}
