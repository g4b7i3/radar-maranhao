// Desafio do mês entre assessorias: soma dos km em provas oficiais. Lista + card pro story (1080×1920).
import { useEffect, useRef, useState } from 'react';
import { Share2, Download, Flag } from 'lucide-react';
import { AZUL, SIMBOLO, fonte, caber, type Ctx } from '../EuVou';
import { sb } from './sb';
import { Avatar } from './Foto';
import { linkAssessoria } from './Assessoria';
import { fotoPerfil, fotoRedonda } from './CardResultado';

type Equipe = { posicao: number; nome: string; km: number; atletas: number; provas: number; quem: { apelido: string; foto: string | null; km: number }[] };
type Dados = { mes: string; equipes: Equipe[] };
const mesNome = (m: string) => new Date(m.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const kmF = (k: number) => String(Math.round(k * 10) / 10).replace('.', ',');
const W = 1080, H = 1920;

async function desenhar(c: HTMLCanvasElement, d: Dados, destaque?: string) {
  c.width = W; c.height = H;
  const ctx = c.getContext('2d') as Ctx;
  await document.fonts?.ready;
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0d1a5c'); g.addColorStop(.55, AZUL); g.addColorStop(1, '#3a5ce0');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const rg = ctx.createRadialGradient(W * .85, 120, 10, W * .85, 120, 700); rg.addColorStop(0, 'rgba(255,211,77,.35)'); rg.addColorStop(1, 'rgba(255,211,77,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  const X = 84;
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 14;
  ctx.save(); ctx.translate(X, 96); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(0, 0, 76, 76, 18); ctx.fill();
  ctx.shadowBlur = 0; ctx.translate(6, 6); ctx.scale(2, 2); ctx.strokeStyle = AZUL; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  SIMBOLO.forEach(p => ctx.stroke(new Path2D(p))); ctx.restore();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; fonte(ctx, 900, 38, true); ctx.fillText('RADAR PRO', X + 98, 132);
  fonte(ctx, 600, 26, false); ctx.globalAlpha = .9; ctx.fillText('Corridas MA', X + 98, 166); ctx.globalAlpha = 1;
  fonte(ctx, 700, 34, false); ctx.globalAlpha = .9; try { ctx.letterSpacing = '4px'; } catch { /* */ } ctx.fillText(`DESAFIO DE ${mesNome(d.mes).toUpperCase()}`, X, 330); try { ctx.letterSpacing = '0px'; } catch { /* */ } ctx.globalAlpha = 1;
  fonte(ctx, 900, 96, true); ctx.fillText('Assessorias', X, 440); ctx.fillText('em km oficiais', X, 540);
  const top = d.equipes.slice(0, 6);
  const fotos = await fotoPerfil([...new Set(top.flatMap(e => e.quem.slice(0, 3).map(q => q.apelido)))]).catch(() => new Map<string, HTMLImageElement>());
  let y = 680;
  top.forEach((e, i) => {
    const meu = destaque && e.nome.toLowerCase().trim() === destaque.toLowerCase().trim();
    ctx.shadowBlur = 0; ctx.fillStyle = meu ? 'rgba(242,183,5,.22)' : 'rgba(255,255,255,.1)';
    ctx.beginPath(); ctx.roundRect(X, y, W - 2 * X, 150, 28); ctx.fill();
    if (meu) { ctx.strokeStyle = '#f2b705'; ctx.lineWidth = 5; ctx.stroke(); }
    ctx.shadowBlur = 14; ctx.fillStyle = i === 0 ? '#f2b705' : '#fff'; ctx.textAlign = 'left';
    fonte(ctx, 900, 64, true); ctx.fillText(`${e.posicao}º`, X + 30, y + 98);
    ctx.fillStyle = '#fff';
    const t = caber(ctx, e.nome, 800, 44, 30, 540, 1, true); ctx.fillText(t.linhas[0], X + 150, y + 70);
    fonte(ctx, 600, 26, false); ctx.globalAlpha = .85; ctx.fillText(`${e.atletas} ${e.atletas === 1 ? 'atleta' : 'atletas'} · ${e.provas} ${e.provas === 1 ? 'prova' : 'provas'}`, X + 150, y + 112); ctx.globalAlpha = 1;
    ctx.textAlign = 'right'; fonte(ctx, 900, 60, true); ctx.fillText(`${kmF(e.km)}`, W - X - 30, y + 90);
    fonte(ctx, 700, 22, false); ctx.globalAlpha = .85; ctx.fillText('KM', W - X - 30, y + 122); ctx.globalAlpha = 1;
    // fotos dos 3 que mais somaram
    e.quem.slice(0, 3).forEach((q, k) => { const im = fotos.get(q.apelido); if (im) fotoRedonda(ctx, im, W - X - 250 - k * 44, y + 75, 26); });
    y += 170;
  });
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.shadowBlur = 10;
  fonte(ctx, 900, 40, true); ctx.fillText('Sua equipe soma km a cada prova oficial', X, H - 140);
  fonte(ctx, 600, 30, false); ctx.globalAlpha = .9; ctx.fillText('radarcorridasma.com.br/pro', X, H - 92); ctx.globalAlpha = 1;
}

export function DesafioAssessorias({ minha }: { minha?: string | null }) {
  const [d, setD] = useState<Dados | null>(null);
  const [card, setCard] = useState<string | null>(null);
  const blob = useRef<Blob | null>(null);
  useEffect(() => { sb.rpc('radar_desafio_assessorias').then(({ data }) => setD((data as Dados) ?? { mes: new Date().toISOString(), equipes: [] })); }, []);
  const gerar = async () => {
    if (!d) return;
    const c = document.createElement('canvas');
    await desenhar(c, d, minha ?? undefined);
    c.toBlob(b => { if (!b) return; blob.current = b; setCard(u => { if (u) URL.revokeObjectURL(u); return URL.createObjectURL(b); }); }, 'image/jpeg', .92);
  };
  const nome = `desafio-assessorias-${(d?.mes ?? '').slice(0, 7)}.jpg`;
  const baixar = () => { if (!card) return; const a = document.createElement('a'); a.href = card; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); };
  const compartilhar = async () => {
    if (!blob.current) return; const f = new File([blob.current], nome, { type: 'image/jpeg' });
    if (navigator.canShare?.({ files: [f] })) { try { await navigator.share({ files: [f] }); return; } catch (e) { if ((e as Error).name === 'AbortError') return; } }
    baixar();
  };
  if (!d) return <p className="fine">Carregando…</p>;
  const dias = (() => { const h = new Date(); return new Date(h.getFullYear(), h.getMonth() + 1, 0).getDate() - h.getDate(); })();
  return (
    <section className="pro-card pro-desafio">
      <div className="pro-linha"><p className="pro-k cinza"><Flag size={14} aria-hidden="true" /> Desafio de {mesNome(d.mes)}</p>{dias > 0 && <span className="pro-liga l-ouro">Faltam {dias} dias</span>}</div>
      <p className="fine pro-sem-margem">Soma dos km em provas oficiais do mês. Cada atleta que registra prova soma pra equipe.</p>
      {d.equipes.length === 0 && <p className="fine">Nenhuma equipe com prova oficial neste mês ainda.</p>}
      <ol className="pro-desafio-lista">
        {d.equipes.map(e => (
          <li key={e.nome} className={minha && e.nome.toLowerCase().trim() === minha.toLowerCase().trim() ? 'eu' : ''}>
            <b className="pos">{e.posicao}º</b>
            <div><a href={linkAssessoria(e.nome)} target="_blank" rel="noopener">{e.nome}</a><small>{e.atletas} {e.atletas === 1 ? 'atleta' : 'atletas'} · {e.provas} {e.provas === 1 ? 'prova' : 'provas'}</small></div>
            <div className="pro-desafio-fotos" aria-hidden="true">{e.quem.slice(0, 3).map(q => <Avatar key={q.apelido} foto={q.foto} apelido={q.apelido} tam={26} />)}</div>
            <b className="km">{kmF(e.km)} km</b>
          </li>
        ))}
      </ol>
      {card
        ? <><div className="pro-cardres-previa"><img src={card} alt="Card do desafio das assessorias" /></div><div className="pro-linha pro-quebra"><button className="btn solid" onClick={compartilhar}><Share2 size={16} aria-hidden="true" />Compartilhar</button><button className="btn outline" onClick={baixar}><Download size={16} aria-hidden="true" />Baixar</button></div></>
        : d.equipes.length > 0 && <button className="btn outline pro-btn" onClick={gerar}>Card pro story</button>}
    </section>
  );
}
