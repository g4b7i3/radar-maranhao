// X1 (desafio manual): dois atletas combinam uma corrida, lançam o tempo do relógio e o outro confirma.
// Confirmado, vai pro feed ("venceu" / "foi derrotado") e gera card pro story.
import { useEffect, useRef, useState } from 'react';
import { Download, Share2, Swords, X } from 'lucide-react';
import { sb, kmTxt, dataBR, relogio, pct } from './sb';
import { Avatar } from './Foto';
import { lerTempo, mascaraTempo } from '../CardTreino';
import { AZUL, SIMBOLO, fonte, type Ctx } from '../EuVou';
import { FUNDOS, fotoPerfil, fotoRedonda } from './CardResultado';
import { salvarImagem } from '../salvar';

type X1 = { id: string; km: number; data: string; local: string | null; status: 'convidado' | 'aceito' | 'lancado' | 'confirmado'; sou_criador: boolean; lancei: boolean; outro: string; foto_outro: string | null; eu_apelido: string; eu_foto: string | null; meu_tempo: number | null; tempo_outro: number | null; minha_nota: number | null; nota_outro: number | null };
const DISTS = [0.2, 0.4, 1, 3, 5, 10, 21.0975, 42.195, 50, 60, 70, 80, 100];
// Provas curtas: um número sozinho é segundos (ex.: 28 = 28 s); acima de 1 km, segue o padrão (25 = 25 min).
const lerX1 = (t: string, km: number) => { const p = t.trim(); if (km <= 1 && /^\d+$/.test(p)) return Number(p) > 0 ? Number(p) : null; return lerTempo(p); };
const exemplo = (km: number) => km <= 0.2 ? ['28', '30'] : km <= 0.4 ? ['1:05', '1:08'] : km <= 1 ? ['3:40', '3:52'] : ['25:30', '26:10'];
/** Linha informativa: quem venceria pela nota por idade (não muda o resultado do X1). */
export function linhaIdade(a: string, na: number | null | undefined, b: string, nb: number | null | undefined) {
  if (na == null || nb == null) return null;
  const quem = na === nb ? 'empate' : na > nb ? `${a} venceria` : `${b} venceria`;
  return `Pela nota por idade: ${quem} (${pct(na)}% x ${pct(nb)}%). Não conta, vale o tempo.`;
}
const hojeISO = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

export function SecaoX1() {
  const [lista, setLista] = useState<X1[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const carregar = () => sb.rpc('radar_x1_meus').then(({ data }) => setLista((data ?? []) as X1[]));
  useEffect(() => { carregar(); }, []);
  const rpc = async (nome: string, args: Record<string, unknown>, ok?: string) => {
    setMsg(null);
    const { data, error } = await sb.rpc(nome, args);
    const r = (data ?? {}) as { erro?: string };
    if (error || r.erro) { setMsg(r.erro ?? 'Não deu agora. Tente de novo.'); return false; }
    if (ok) setMsg(ok);
    carregar(); return true;
  };
  return (
    <>
      <section className="pro-card pro-x1-cab">
        <p className="pro-k cinza"><Swords size={14} aria-hidden="true" /> X1 · desafio de corrida</p>
        <p className="pro-sem-margem">Combine uma corrida com alguém, corram e lancem o tempo do relógio. O outro confirma e o resultado vai pro feed, com card pro story.</p>
        <NovoX1 criado={() => { setMsg('X1 enviado! O atleta recebe o convite no sininho.'); carregar(); }} />
        {msg && <p className="pro-x1-msg" role="status">{msg}</p>}
      </section>
      {lista?.map(x => <CartaoX1 key={x.id} x={x} rpc={rpc} />)}
    </>
  );
}

type Sug = { apelido: string; nome: string; foto: string | null; cidade: string };
/** Campo do @ com sugestões: a cada letra mostra atletas pelo @ ou pelo nome. */
function BuscaAtleta({ valor, mudou }: { valor: string; mudou: (v: string) => void }) {
  const [sug, setSug] = useState<Sug[]>([]);
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    const t = valor.trim().replace(/^@/, '');
    if (!t || !aberto) { setSug([]); return; }
    let vivo = true;
    const id = setTimeout(() => sb.rpc('radar_atletas_sugerir', { p_txt: t }).then(({ data }) => { if (vivo) setSug((data ?? []) as Sug[]); }), 180);
    return () => { vivo = false; clearTimeout(id); };
  }, [valor, aberto]);
  return (
    <div className="pro-busca-at">
      <label className="ct-cidade">Desafiar <input value={valor} onChange={e => { mudou(e.target.value); setAberto(true); }} onFocus={() => setAberto(true)} onBlur={() => setTimeout(() => setAberto(false), 150)} placeholder="@ ou nome do atleta" autoCapitalize="none" autoComplete="off" /></label>
      {aberto && sug.length > 0 && (
        <ul className="pro-busca-at-lista" role="listbox">
          {sug.map(u => (
            <li key={u.apelido}><button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { mudou(u.apelido); setAberto(false); setSug([]); }}>
              <Avatar foto={u.foto} apelido={u.apelido} tam={34} />
              <span><b>@{u.apelido}</b><small>{u.nome}{u.cidade ? ` · ${u.cidade}` : ''}</small></span>
            </button></li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NovoX1({ criado }: { criado: () => void }) {
  const [ap, setAp] = useState('');
  const [km, setKm] = useState(5);
  const [data, setData] = useState(hojeISO());
  const [local, setLocal] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [indo, setIndo] = useState(false);
  const criar = async () => {
    setErro(null); setIndo(true);
    const { data: r, error } = await sb.rpc('radar_x1_criar', { p_apelido: ap, p_km: km, p_data: data, p_local: local || null });
    setIndo(false);
    const res = (r ?? {}) as { erro?: string };
    if (error || res.erro) return setErro(res.erro ?? 'Não deu agora.');
    setAp(''); setLocal(''); criado();
  };
  return (
    <div className="pro-x1-form">
      <BuscaAtleta valor={ap} mudou={setAp} />
      <div className="chips" role="group" aria-label="Distância">{DISTS.map(d => <button key={d} className="chip" aria-pressed={km === d} onClick={() => setKm(d)}>{kmTxt(d)}</button>)}</div>
      <div className="pro-linha pro-quebra">
        <label className="ct-cidade">Dia<input type="date" value={data} onChange={e => setData(e.target.value)} /></label>
        <label className="ct-cidade">Local <small>(opcional)</small><input value={local} maxLength={80} onChange={e => setLocal(e.target.value)} placeholder="Ex.: Litorânea" /></label>
      </div>
      {erro && <p className="ct-erro" role="alert">{erro}</p>}
      <button className="btn solid pro-btn" disabled={indo || ap.trim().length < 3} onClick={criar}><Swords size={16} aria-hidden="true" />{indo ? 'Enviando…' : 'Chamar pro X1'}</button>
    </div>
  );
}

function CartaoX1({ x, rpc }: { x: X1; rpc: (nome: string, args: Record<string, unknown>, ok?: string) => Promise<boolean> }) {
  const [meu, setMeu] = useState('');
  const [dele, setDele] = useState('');
  const [card, setCard] = useState(false);
  const hoje = hojeISO();
  const venci = x.meu_tempo != null && x.tempo_outro != null && x.meu_tempo < x.tempo_outro;
  const empate = x.meu_tempo != null && x.meu_tempo === x.tempo_outro;
  const placar = x.meu_tempo != null && x.tempo_outro != null && (
    <div className="pro-x1-placar">
      <div className={venci ? 'v' : empate ? '' : 'p'}><Avatar foto={x.eu_foto} apelido={x.eu_apelido} tam={48} /><b>Você</b><span>{relogio(x.meu_tempo)}</span></div>
      <em>vs</em>
      <div className={!venci && !empate ? 'v' : empate ? '' : 'p'}><Avatar foto={x.foto_outro} apelido={x.outro} tam={48} /><b>@{x.outro}</b><span>{relogio(x.tempo_outro)}</span></div>
    </div>
  );
  const idade = linhaIdade('você', x.minha_nota, `@${x.outro}`, x.nota_outro);
  return (
    <section className={'pro-card pro-x1' + (x.status === 'confirmado' ? (venci ? ' venci' : empate ? '' : ' perdi') : '')}>
      <div className="pro-linha"><p className="pro-k cinza">X1 · {kmTxt(Number(x.km))} · {dataBR(x.data)}{x.local ? ` · ${x.local}` : ''}</p><span className="pro-x1-contra">vs @{x.outro}</span></div>
      {x.status === 'convidado' && (x.sou_criador
        ? <><p className="pro-sub pro-sem-margem">Esperando @{x.outro} aceitar.</p><button className="btn text pro-btn-p" onClick={() => rpc('radar_x1_cancelar', { p_id: x.id }, 'X1 cancelado.')}>Cancelar</button></>
        : <><p className="pro-sem-margem"><b>@{x.outro}</b> te chamou pro X1.</p><div className="pro-linha pro-quebra"><button className="btn solid" onClick={() => rpc('radar_x1_responder', { p_id: x.id, p_aceitar: true }, 'X1 aceito! Depois da corrida, lancem os tempos.')}>Aceitar</button><button className="btn outline" onClick={() => rpc('radar_x1_responder', { p_id: x.id, p_aceitar: false })}>Recusar</button></div></>)}
      {x.status === 'aceito' && (x.data > hoje
        ? <p className="pro-sub pro-sem-margem">Marcado para {dataBR(x.data)}. Depois da corrida, qualquer um dos dois lança os tempos.</p>
        : <div className="pro-x1-form">
            <p className="pro-sem-margem">Lance os tempos do relógio{Number(x.km) <= 1 ? ' (em segundos ou min:seg)' : ''}:</p>
            <div className="pro-linha pro-quebra">
              <label className="ct-cidade">Seu tempo<input inputMode="numeric" value={meu} onChange={e => setMeu(mascaraTempo(e.target.value))} placeholder={exemplo(Number(x.km))[0]} /></label>
              <label className="ct-cidade">Tempo de @{x.outro}<input inputMode="numeric" value={dele} onChange={e => setDele(mascaraTempo(e.target.value))} placeholder={exemplo(Number(x.km))[1]} /></label>
            </div>
            <button className="btn solid pro-btn" disabled={!lerX1(meu, Number(x.km)) || !lerX1(dele, Number(x.km))} onClick={() => rpc('radar_x1_lancar', { p_id: x.id, p_meu: lerX1(meu, Number(x.km)), p_dele: lerX1(dele, Number(x.km)) }, `Tempos enviados. Agora @${x.outro} confirma.`)}>Enviar para @{x.outro} confirmar</button>
          </div>)}
      {x.status === 'lancado' && <>
        {placar}
        {idade && <p className="pro-x1-idade">{idade}</p>}
        {x.lancei
          ? <p className="pro-sub pro-sem-margem pro-centro">Esperando @{x.outro} confirmar os tempos.</p>
          : <><p className="pro-sem-margem pro-centro">@{x.outro} lançou esses tempos. Está certo?</p>
            <div className="pro-linha pro-quebra"><button className="btn solid" onClick={() => rpc('radar_x1_confirmar', { p_id: x.id, p_ok: true }, 'Confirmado! O resultado foi pro feed.')}>Confirmar</button><button className="btn outline" onClick={() => rpc('radar_x1_confirmar', { p_id: x.id, p_ok: false }, 'Ok, os tempos voltaram para serem lançados de novo.')}>Não está certo</button></div></>}
      </>}
      {x.status === 'confirmado' && <>
        <p className="pro-x1-res">{venci ? '🏆 Você venceu o X1!' : empate ? 'Empate!' : `@${x.outro} venceu. Revanche?`}</p>
        {placar}
        {idade && <p className="pro-x1-idade">{idade}</p>}
        {card ? <CardX1 x={x} fechar={() => setCard(false)} /> : <button className="btn outline pro-btn" onClick={() => setCard(true)}>Card pro story</button>}
      </>}
    </section>
  );
}

/* ───────── Card do X1 para o story (1080×1920) ───────── */
const W = 1080, H = 1920;
const carregar = (src: string) => new Promise<HTMLImageElement>((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = src; });

async function desenhar(c: HTMLCanvasElement, x: X1, fundo: string, fotos: Map<string, HTMLImageElement>) {
  c.width = W; c.height = H;
  const ctx = c.getContext('2d') as Ctx;
  await document.fonts?.ready;
  const img = await carregar(`/img/ma/${fundo}.jpg`).catch(() => null);
  if (img) { const k = Math.max(W / img.naturalWidth, H / img.naturalHeight); ctx.drawImage(img, (W - img.naturalWidth * k) / 2, (H - img.naturalHeight * k) / 2, img.naturalWidth * k, img.naturalHeight * k); }
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(6,12,36,.75)'); g.addColorStop(.5, 'rgba(6,12,36,.55)'); g.addColorStop(1, 'rgba(6,12,36,.92)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const X = 84;
  const venci = (x.meu_tempo ?? 0) < (x.tempo_outro ?? 0), empate = x.meu_tempo === x.tempo_outro;
  const [vNome, vTempo, pNome, pTempo] = venci || empate ? [x.eu_apelido, x.meu_tempo!, x.outro, x.tempo_outro!] : [x.outro, x.tempo_outro!, x.eu_apelido, x.meu_tempo!];
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 14;
  ctx.save(); ctx.translate(X, 96); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(0, 0, 76, 76, 18); ctx.fill();
  ctx.shadowBlur = 0; ctx.translate(6, 6); ctx.scale(2, 2); ctx.strokeStyle = AZUL; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  SIMBOLO.forEach(p => ctx.stroke(new Path2D(p))); ctx.restore();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; fonte(ctx, 900, 38, true); ctx.fillText('RADAR PRO', X + 98, 132);
  fonte(ctx, 600, 26, false); ctx.globalAlpha = .9; ctx.fillText('X1', X + 98, 166); ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  fonte(ctx, 700, 34, false); ctx.globalAlpha = .9;
  ctx.fillText(`X1 · ${kmTxt(Number(x.km)).toUpperCase()} · ${dataBR(x.data)}${x.local ? ` · ${x.local.toUpperCase()}` : ''}`.slice(0, 48), W / 2, 470); ctx.globalAlpha = 1;
  fonte(ctx, 900, 170, true);
  const gg = ctx.createLinearGradient(0, 520, 0, 700); gg.addColorStop(0, '#fff1b8'); gg.addColorStop(.6, '#f2b705'); gg.addColorStop(1, '#e2a400'); ctx.fillStyle = empate ? '#fff' : gg;
  ctx.fillText(empate ? 'EMPATE' : 'VENCEU O X1', W / 2, 680);
  const y = 1000, col = (W - 2 * X) / 2;
  const lado = (px: number, nome: string, tempo: number, ganhou: boolean) => {
    ctx.shadowBlur = 0; ctx.fillStyle = ganhou ? 'rgba(242,183,5,.22)' : 'rgba(255,255,255,.1)';
    ctx.beginPath(); ctx.roundRect(px + 10, y - 150, col - 20, 400, 36); ctx.fill();
    if (ganhou) { ctx.strokeStyle = '#f2b705'; ctx.lineWidth = 5; ctx.stroke(); }
    const av = fotos.get(nome); if (av) fotoRedonda(ctx, av, px + col / 2, y - 190, 70);
    ctx.shadowBlur = 14; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    fonte(ctx, 800, 42, true); ctx.fillText(`@${nome}`.slice(0, 18), px + col / 2, y - 60);
    fonte(ctx, 900, 120, true); ctx.fillText(relogio(tempo), px + col / 2, y + 90);
    fonte(ctx, 800, 30, false); ctx.fillStyle = ganhou ? '#ffd34d' : 'rgba(255,255,255,.75)';
    ctx.fillText(empate ? 'EMPATOU' : ganhou ? 'VENCEU' : 'FOI DERROTADO', px + col / 2, y + 170); ctx.fillStyle = '#fff';
  };
  lado(X, vNome, vTempo, !empate);
  lado(X + col, pNome, pTempo, false);
  ctx.shadowBlur = 0; ctx.fillStyle = '#f2b705'; ctx.beginPath(); ctx.arc(W / 2, y + 30, 58, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3a2600'; fonte(ctx, 900, 52, true); ctx.fillText('VS', W / 2, y + 48);
  ctx.shadowBlur = 14; ctx.fillStyle = '#fff'; fonte(ctx, 600, 34, false);
  ctx.fillText(empate ? 'Ninguém cedeu. Revanche?' : `Diferença: ${relogio(Math.abs(pTempo - vTempo))}`, W / 2, y + 340);
  const [vNota, pNota] = venci || empate ? [x.minha_nota, x.nota_outro] : [x.nota_outro, x.minha_nota];
  if (vNota != null && pNota != null) {
    fonte(ctx, 500, 26, false); ctx.globalAlpha = .75;
    ctx.fillText(`Nota por idade: ${pct(vNota)}% x ${pct(pNota)}%${vNota === pNota ? '' : ` (${vNota > pNota ? '@' + vNome : '@' + pNome} na frente)`} · não conta`, W / 2, y + 392);
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'left'; fonte(ctx, 900, 40, true); ctx.fillText('Chame um amigo pro X1 no Radar Pro', X, H - 140);
  fonte(ctx, 600, 30, false); ctx.globalAlpha = .9; ctx.fillText('radarcorridasma.com.br/pro', X, H - 92); ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function CardX1({ x, fechar }: { x: X1; fechar: () => void }) {
  const [fundo, setFundo] = useState<string>('calhau');
  const [url, setUrl] = useState<string | null>(null);
  const [fotos, setFotos] = useState<Map<string, HTMLImageElement> | null>(null);
  useEffect(() => { fotoPerfil([x.eu_apelido, x.outro]).then(setFotos).catch(() => setFotos(new Map())); }, [x.eu_apelido, x.outro]);
  const blob = useRef<Blob | null>(null);
  useEffect(() => {
    if (!fotos) return;
    let ativo = true; const c = document.createElement('canvas');
    desenhar(c, x, fundo, fotos).then(() => c.toBlob(b => { if (!ativo || !b) return; blob.current = b; setUrl(o => { if (o) URL.revokeObjectURL(o); return URL.createObjectURL(b); }); }, 'image/jpeg', .92));
    return () => { ativo = false; };
  }, [x, fundo, fotos]);
  const nome = `x1-${x.outro}-${x.data}.jpg`;
  const baixar = () => { if (url) salvarImagem(url, nome); };
  const compartilhar = async () => {
    if (!blob.current) return; const f = new File([blob.current], nome, { type: 'image/jpeg' });
    if (navigator.canShare?.({ files: [f] })) { try { await navigator.share({ files: [f] }); return; } catch (e) { if ((e as Error).name === 'AbortError') return; } }
    baixar();
  };
  return (
    <div className="pro-cardres">
      <div className="pro-linha"><p className="pro-k cinza"><Swords size={14} aria-hidden="true" /> Card do X1</p><button className="btn text" onClick={fechar} aria-label="Fechar"><X size={18} aria-hidden="true" /></button></div>
      <div className="pro-cardres-previa">{url ? <img src={url} alt="Card do resultado do X1" /> : <span>Montando o card…</span>}</div>
      <div className="chips pro-cardres-fundos" role="group" aria-label="Fundo">{FUNDOS.map(f => <button key={f.id} className="chip" aria-pressed={fundo === f.id} onClick={() => setFundo(f.id)}>{f.nome}</button>)}</div>
      <div className="pro-linha pro-quebra">
        <button className="btn solid" onClick={compartilhar} disabled={!url}><Share2 size={16} aria-hidden="true" />Compartilhar</button>
        <button className="btn outline" onClick={baixar} disabled={!url}><Download size={16} aria-hidden="true" />Baixar</button>
      </div>
    </div>
  );
}
