// Radar Pro · "Minhas atividades": as corridas que chegam do Garmin / Intervals.icu.
// Cada uma abre com gráficos (pace e FC por km, percurso), vira card pro story e pode ir pro feed.
import { useEffect, useRef, useState } from 'react';
import { Watch, ChevronRight, ChevronDown, X, Image as ImagemIc, Send, Download, Share2, RefreshCw, Trash2 } from 'lucide-react';
import { sb, relogio, dataBR, type Perfil } from './sb';
// @ts-expect-error módulo JS de desenho (canvas)
import { CARD_LAYOUTS, CARD_STATS, desenharCard, climaDe, tirosDe } from './cards/desenho.js';

export type Atividade = {
  id: string; fonte: string; data: string; titulo: string | null; tipo: string; distancia_m: number; duracao_s: number;
  elevacao_m: number | null; fc_media: number | null; fc_max: number | null; cadencia: number | null;
  resumo_rel: { kcal?: number | null; passos?: number | null } | null;
  parciais: { km: number; seg: number; fc?: number | null; parcial?: boolean }[] | null; rota: [number, number][] | null;
  feed_em: string | null; legenda: string | null; card_url: string | null;
};
const FONTE: Record<string, string> = { garmin: 'Garmin', intervals: 'Intervals.icu' };
const TIPO: Record<string, string> = { corrida: 'Corrida', trail: 'Trail', esteira: 'Esteira', caminhada: 'Caminhada' };
const km = (m: number) => (m / 1000).toFixed(2).replace('.', ',');
const pace = (s: number) => { const r = Math.round(s); return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`; };
const paceDe = (a: Atividade) => (a.distancia_m > 0 ? a.duracao_s / (a.distancia_m / 1000) : 0);
const hora = (d: string) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function MeusTreinos({ perfil }: { perfil: Perfil }) {
  const [lista, setLista] = useState<Atividade[] | null>(null);
  const [aberta, setAberta] = useState<Atividade | null>(null);
  const [todas, setTodas] = useState(false);
  // aberta ou fechada, como a pessoa deixou da última vez
  const [aberto, setAberto] = useState(() => { try { return localStorage.getItem('radar-atividades-aberto') === '1'; } catch { return false; } });
  const trocar = () => { const v = !aberto; setAberto(v); try { localStorage.setItem('radar-atividades-aberto', v ? '1' : '0'); } catch { /* */ } };
  const carregar = () => sb.from('radar_atividades').select('*').order('data', { ascending: false }).limit(60)
    .then(({ data }) => setLista((data ?? []) as Atividade[]));
  useEffect(() => { carregar(); }, []);
  const vis = todas ? (lista ?? []) : (lista ?? []).slice(0, 5);
  return (
    <section className="pro-card pro-treinos">
      <button className="pro-treinos-tit" onClick={trocar} aria-expanded={aberto}>
        <span><Watch size={16} aria-hidden="true" /> Minhas atividades</span>
        {lista && lista.length > 0 && <small>{lista.length}</small>}
        <ChevronDown size={18} aria-hidden="true" className={'pro-aniver-seta' + (aberto ? ' virado' : '')} />
      </button>
      {aberto && <>
        {lista === null && <p className="fine pro-sem-margem">Carregando…</p>}
        {lista?.length === 0 && <p className="pro-sub pro-sem-margem">Nenhuma atividade ainda. Conecte o Garmin aqui em cima e cada corrida do relógio aparece aqui sozinha.</p>}
        {!!lista?.length && <ul>
          {vis.map(a => (
            <li key={a.id}>
              <button className="pro-treino-linha" onClick={() => setAberta(a)}>
                <span><b>{a.titulo || TIPO[a.tipo] || 'Corrida'}</b><small>{dataBR(a.data)} · {hora(a.data)} · {FONTE[a.fonte] ?? a.fonte}{a.feed_em ? ' · no feed' : ''}</small></span>
                <span className="pro-treino-num"><b>{km(a.distancia_m)} km</b><small>{relogio(a.duracao_s)} · {pace(paceDe(a))}/km</small></span>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>}
        {lista && lista.length > 5 && <button className="btn text pro-btn-p" onClick={() => setTodas(!todas)}>{todas ? 'Ver menos' : `Ver todas (${lista.length})`}</button>}
      </>}
      {aberta && <DetalheTreino a={aberta} perfil={perfil} fechar={() => setAberta(null)} mudou={(n) => { setAberta(n); carregar(); }} />}
    </section>
  );
}

/* ───────── detalhe: números, gráficos e ações ───────── */
export function DetalheTreino({ a, perfil, fechar, mudou }: { a: Atividade; perfil: Perfil; fechar: () => void; mudou: (a: Atividade) => void }) {
  const [card, setCard] = useState(false);
  const [postar, setPostar] = useState(false);
  const parc = (a.parciais ?? []).filter(p => !p.parcial || (p.km % 1) > .3);
  const nums = [
    { l: 'Distância', v: `${km(a.distancia_m)} km` }, { l: 'Tempo', v: relogio(a.duracao_s) }, { l: 'Pace', v: `${pace(paceDe(a))}/km` },
    a.fc_media ? { l: 'FC média', v: `${a.fc_media} bpm` } : null, a.fc_max ? { l: 'FC máx', v: `${a.fc_max} bpm` } : null,
    a.elevacao_m ? { l: 'Subida', v: `${a.elevacao_m} m` } : null, a.cadencia ? { l: 'Cadência', v: `${a.cadencia} ppm` } : null,
    a.resumo_rel?.kcal ? { l: 'Calorias', v: `${Math.round(a.resumo_rel.kcal)} kcal` } : null,
  ].filter(Boolean) as { l: string; v: string }[];
  const tirar = async () => { if (!confirm('Tirar esta corrida do feed?')) return; await sb.rpc('radar_treino_tirar', { p_id: a.id }); mudou({ ...a, feed_em: null }); };
  return (
    <div className="pro-folha" role="dialog" aria-modal="true" aria-label="Treino">
      <div className="pro-folha-caixa">
        <div className="pro-linha"><div><b>{a.titulo || TIPO[a.tipo] || 'Corrida'}</b><p className="fine pro-sem-margem">{dataBR(a.data)} · {hora(a.data)} · via {FONTE[a.fonte] ?? a.fonte}</p></div><button className="btn text" onClick={fechar} aria-label="Fechar"><X size={20} aria-hidden="true" /></button></div>
        <div className="pro-treino-grade">{nums.map(n => <div key={n.l}><small>{n.l}</small><b>{n.v}</b></div>)}</div>
        {parc.length > 1 && <GraficoPace parc={parc} />}
        {parc.some(p => p.fc) && <GraficoFC parc={parc} />}
        {a.rota && a.rota.length > 1 && <Percurso rota={a.rota} />}
        <div className="pro-linha pro-quebra">
          <button className="btn solid" onClick={() => setCard(true)}><ImagemIc size={16} aria-hidden="true" />Gerar card</button>
          {a.feed_em
            ? <button className="btn outline" onClick={tirar}><Trash2 size={16} aria-hidden="true" />Tirar do feed</button>
            : <button className="btn outline" onClick={() => setPostar(true)}><Send size={16} aria-hidden="true" />Postar no feed</button>}
        </div>
        <p className="fine pro-sem-margem">Suas atividades aparecem só pra você. No feed vão só a distância, o tempo, o pace e a subida (e o card, se você postar com ele). Frequência cardíaca e percurso ficam com você, a não ser que estejam no card que você escolher.</p>
      </div>
      {card && <GeradorCard a={a} perfil={perfil} fechar={() => setCard(false)} postou={(url) => { setCard(false); mudou({ ...a, feed_em: a.feed_em ?? new Date().toISOString(), card_url: url }); }} />}
      {postar && <PostarTreino a={a} fechar={() => setPostar(false)} postou={() => { setPostar(false); mudou({ ...a, feed_em: new Date().toISOString() }); }} />}
    </div>
  );
}

function GraficoPace({ parc }: { parc: NonNullable<Atividade['parciais']> }) {
  const pk = parc.map(p => p.seg / (p.parcial ? (p.km % 1 || 1) : 1));
  const mn = Math.min(...pk), mx = Math.max(...pk);
  return (
    <div className="pro-treino-graf">
      <p className="pro-k cinza">Pace por km</p>
      <ul className="pro-treino-barras">
        {parc.map((p, i) => {
          const w = mx > mn ? 35 + 65 * (mx - pk[i]) / (mx - mn) : 80;
          return <li key={i} className={pk[i] === mn ? 'melhor' : ''}><small>{p.parcial ? String(p.km).replace('.', ',') : p.km}</small><span style={{ width: `${w}%` }} /><b>{pace(pk[i])}</b></li>;
        })}
      </ul>
    </div>
  );
}

function GraficoFC({ parc }: { parc: NonNullable<Atividade['parciais']> }) {
  const pts = parc.map((p, i) => ({ i, fc: p.fc ?? null })).filter(p => p.fc) as { i: number; fc: number }[];
  if (pts.length < 2) return null;
  const mn = Math.min(...pts.map(p => p.fc)) - 5, mx = Math.max(...pts.map(p => p.fc)) + 5, W = 300, H = 110;
  const x = (i: number) => 10 + (W - 20) * i / Math.max(1, parc.length - 1), y = (f: number) => H - 14 - (H - 28) * (f - mn) / (mx - mn);
  const d = pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.fc).toFixed(1)}`).join(' ');
  return (
    <div className="pro-treino-graf">
      <p className="pro-k cinza">Frequência cardíaca por km</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="pro-treino-svg" role="img" aria-label={`FC de ${Math.round(mn + 5)} a ${Math.round(mx - 5)} bpm`}>
        <path d={d} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map(p => <circle key={p.i} cx={x(p.i)} cy={y(p.fc)} r="3" fill="currentColor" />)}
        <text x="4" y="12" fontSize="10" fill="currentColor" opacity=".7">{Math.round(mx - 5)} bpm</text>
        <text x="4" y={H - 2} fontSize="10" fill="currentColor" opacity=".7">{Math.round(mn + 5)} bpm</text>
      </svg>
    </div>
  );
}

function Percurso({ rota }: { rota: [number, number][] }) {
  const lats = rota.map(p => p[0]), lons = rota.map(p => p[1]);
  const la0 = Math.min(...lats), la1 = Math.max(...lats), lo0 = Math.min(...lons), lo1 = Math.max(...lons);
  const k = Math.cos(((la0 + la1) / 2) * Math.PI / 180), rw = Math.max((lo1 - lo0) * k, 1e-6), rh = Math.max(la1 - la0, 1e-6);
  const W = 300, H = 180, s = Math.min((W - 20) / rw, (H - 20) / rh), ox = (W - rw * s) / 2, oy = (H - rh * s) / 2;
  const d = rota.map((p, i) => `${i ? 'L' : 'M'}${(ox + (p[1] - lo0) * k * s).toFixed(1)},${(oy + rh * s - (p[0] - la0) * s).toFixed(1)}`).join(' ');
  return (
    <div className="pro-treino-graf">
      <p className="pro-k cinza">Percurso</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="pro-treino-svg mapa" role="img" aria-label="Desenho do percurso"><path d={d} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" /></svg>
    </div>
  );
}

/* ───────── postar no feed só com legenda ───────── */
function PostarTreino({ a, fechar, postou, cardUrl }: { a: Atividade; fechar: () => void; postou: (url?: string) => void; cardUrl?: string }) {
  const [txt, setTxt] = useState(a.legenda ?? '');
  const [indo, setIndo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const enviar = async () => {
    setIndo(true); setErro(null);
    const { data, error } = await sb.rpc('radar_treino_postar', { p_id: a.id, p_legenda: txt, p_card: cardUrl ?? null });
    setIndo(false);
    const r = (data ?? {}) as { erro?: string };
    if (error || r.erro) return setErro(r.erro ?? 'Não deu agora. Tente de novo.');
    postou(cardUrl);
  };
  return (
    <div className="pro-folha" role="dialog" aria-modal="true" aria-label="Postar no feed">
      <div className="pro-folha-caixa">
        <div className="pro-linha"><b>Postar no feed</b><button className="btn text" onClick={fechar} aria-label="Fechar"><X size={20} aria-hidden="true" /></button></div>
        {cardUrl && <img src={cardUrl} alt="Card da corrida" className="pro-treino-previa" />}
        <textarea value={txt} onChange={e => setTxt(e.target.value.slice(0, 500))} rows={3} placeholder="Conta como foi (opcional)" autoFocus />
        <div className="pro-linha"><small>{txt.length}/500</small><button className="btn solid" onClick={enviar} disabled={indo}><Send size={16} aria-hidden="true" />{indo ? 'Postando…' : 'Postar'}</button></div>
        {erro && <p className="ct-erro" role="alert">{erro}</p>}
      </div>
    </div>
  );
}

/* ───────── gerador do card ───────── */
const ROTULOS: Record<string, string> = Object.fromEntries(CARD_STATS as [string, string][]);
export function GeradorCard({ a, perfil, fechar, postou }: { a: Atividade; perfil: Perfil; fechar: () => void; postou: (url: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [layout, setLayout] = useState<string>((CARD_LAYOUTS as [string, string][])[0][0]);
  const [formato, setFormato] = useState<'story' | 'post'>('story');
  const [cor, setCor] = useState<'branco' | 'escuro'>('branco');
  const [foto, setFoto] = useState<HTMLImageElement | null>(null);
  const [stats, setStats] = useState<Record<string, boolean>>({ dist: true, pace: true, tempo: true, fc: false, elev: false, cad: false, kcal: false, passos: false, rota: true, data: true });
  const [fala, setFala] = useState(0);
  const [clima, setClima] = useState<unknown>(undefined); // undefined = buscando; null = sem clima
  // só os modelos que fazem sentido pra esta corrida (sem tiros, sem card de tiros; sem clima, sem card de clima)
  const modelos = (CARD_LAYOUTS as [string, string][]).filter(([k]) => (k !== 'tiros' || tirosDe(a).length > 0) && ((k !== 'clima' && k !== 'clima_faixa') || !!clima));
  const [envio, setEnvio] = useState<{ url: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => { climaDe(a).then((c: unknown) => setClima(c ?? null)).catch(() => setClima(null)); }, [a]);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const c = { ...a, id: fala ? `${a.id}#${fala}` : a.id };
    document.fonts.load("800 60px 'Radar Cond'").catch(() => null)
      .then(() => desenharCard(cv, c, { layout, formato, cor, fundo: foto ? 'foto' : 'radar', img: foto, stats, clima: clima ?? null, zoom: 1, dx: 0, dy: 0 }))
      .catch(() => null);
  }, [a, layout, formato, cor, foto, stats, clima, fala]);
  const escolherFoto = (f: File | null) => { if (!f) return; const im = new Image(); im.onload = () => setFoto(im); im.src = URL.createObjectURL(f); };
  const blob = () => new Promise<Blob | null>(res => ref.current?.toBlob(b => res(b), 'image/png'));
  const nomeArq = `radar-${a.data.slice(0, 10)}.png`;
  const baixar = async () => { const b = await blob(); if (!b) return; const u = URL.createObjectURL(b); const l = document.createElement('a'); l.href = u; l.download = nomeArq; l.click(); setTimeout(() => URL.revokeObjectURL(u), 4000); };
  const compartilhar = async () => {
    const b = await blob(); if (!b) return;
    const arq = new File([b], nomeArq, { type: 'image/png' });
    if (navigator.canShare?.({ files: [arq] })) { try { await navigator.share({ files: [arq] }); } catch { /* cancelou */ } } else baixar();
  };
  const paraFeed = async () => {
    setOcupado(true); setErro(null);
    const b = await blob(); if (!b) { setOcupado(false); return; }
    const caminho = `${perfil.user_id}/card-${a.id.slice(0, 8)}-${Date.now()}.png`;
    const { error } = await sb.storage.from('posts').upload(caminho, b, { contentType: 'image/png', cacheControl: '31536000', upsert: false });
    setOcupado(false);
    if (error) return setErro('Não deu para enviar o card. Tente de novo.');
    setEnvio({ url: sb.storage.from('posts').getPublicUrl(caminho).data.publicUrl });
  };
  const maranhense = layout.startsWith('ma_');
  return (
    <div className="pro-folha" role="dialog" aria-modal="true" aria-label="Gerar card">
      <div className="pro-folha-caixa pro-gerador">
        <div className="pro-linha"><b>Card da corrida</b><button className="btn text" onClick={fechar} aria-label="Fechar"><X size={20} aria-hidden="true" /></button></div>
        <div className="pro-gerador-previa"><canvas ref={ref} /></div>
        <div className="pro-gerador-modelos" role="group" aria-label="Modelo">
          {modelos.map(([k, n]) => <button key={k} className="chip" aria-pressed={layout === k} onClick={() => setLayout(k)}>{n}</button>)}
        </div>
        {maranhense && <button className="btn text pro-btn-p" onClick={() => setFala(f => f + 1)}><RefreshCw size={15} aria-hidden="true" />Trocar fala</button>}
        <div className="chips" role="group" aria-label="Formato">
          <button className="chip" aria-pressed={formato === 'story'} onClick={() => setFormato('story')}>Story</button>
          <button className="chip" aria-pressed={formato === 'post'} onClick={() => setFormato('post')}>Post</button>
          <button className="chip" aria-pressed={cor === 'branco'} onClick={() => setCor('branco')}>Letra clara</button>
          <button className="chip" aria-pressed={cor === 'escuro'} onClick={() => setCor('escuro')}>Letra escura</button>
        </div>
        <div className="chips" role="group" aria-label="Fundo">
          <label className="chip" aria-pressed={!!foto}><ImagemIc size={14} aria-hidden="true" /> {foto ? 'Trocar foto' : 'Foto de fundo'}<input type="file" accept="image/*" hidden onChange={e => escolherFoto(e.target.files?.[0] ?? null)} /></label>
          {foto && <button className="chip" onClick={() => setFoto(null)}>Fundo do Radar</button>}
        </div>
        <div className="chips" role="group" aria-label="O que aparece no card">
          {Object.keys(stats).map(k => <button key={k} className="chip" aria-pressed={stats[k]} onClick={() => setStats(s => ({ ...s, [k]: !s[k] }))}>{ROTULOS[k] ?? k}</button>)}
        </div>
        <div className="pro-linha pro-quebra">
          <button className="btn solid" onClick={compartilhar}><Share2 size={16} aria-hidden="true" />Compartilhar</button>
          <button className="btn outline" onClick={baixar}><Download size={16} aria-hidden="true" />Baixar</button>
          <button className="btn outline" onClick={paraFeed} disabled={ocupado}><Send size={16} aria-hidden="true" />{ocupado ? 'Enviando…' : 'Postar no feed'}</button>
        </div>
        {erro && <p className="ct-erro" role="alert">{erro}</p>}
      </div>
      {envio && <PostarTreino a={a} cardUrl={envio.url} fechar={() => setEnvio(null)} postou={() => postou(envio.url)} />}
    </div>
  );
}
