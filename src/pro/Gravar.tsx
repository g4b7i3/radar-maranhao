// Radar Pro · "Gravar": correr sem relógio, pelo celular. Na rua (GPS) ou na esteira (velocidade do painel).
// Livre ou seguindo o treino que o treinador passou (aquecimento, parte principal ou séries, desaquecimento),
// com voz a cada etapa e a cada km. No fim vira uma atividade em "Minhas atividades", com resenha, card e feed.
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Footprints, Plus, Minus, Play, Pause, Square, SkipForward, Volume2, VolumeX, X, Trash2, Pencil, Lock, ChevronRight, Check } from 'lucide-react';
import { sb } from './sb';

/* ───────── ícone do menu: o círculo de gravar ───────── */
export function IconeGravar({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="12" cy="12" r="5.2" fill="currentColor" />
    </svg>
  );
}

/* ───────── treino montado (do treinador) ───────── */
type Med = 'min' | 'km' | 'm';
type Trecho = { v: number; med: Med };
export type Treino = {
  id: string; nome: string; tipo: string; obs?: string;
  aq?: Trecho | null; dq?: Trecho | null;
  principal: { modo: 'continuo'; corrida: Trecho } | { modo: 'series'; n: number; esforco: Trecho; rec: Trecho };
};
type Etapa = { k: 'aq' | 'co' | 'tiro' | 'rec' | 'dq'; t?: number; d?: number; rep?: number; nrep?: number };

export const TIPOS_TREINO = ['Rodagem', 'Intervalado', 'Tiros', 'Longão', 'Progressivo', 'Fartlek', 'Ritmo', 'Regenerativo', 'Subida'];
const CHAVE_TREINOS = 'radar-treinos';
const CHAVE_SESSAO = 'radar-gravando';
const ler = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : d; } catch { return d; } };
const gravarLocal = (k: string, v: unknown) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } };
const uid = () => (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36));

const alvo = (t: Trecho) => (t.med === 'min' ? { t: t.v * 60 } : { d: t.med === 'km' ? t.v * 1000 : t.v });
function etapasDe(tr: Treino | null): Etapa[] {
  if (!tr) return [];
  const out: Etapa[] = [];
  if (tr.aq) out.push({ k: 'aq', ...alvo(tr.aq) });
  if (tr.principal.modo === 'continuo') out.push({ k: 'co', ...alvo(tr.principal.corrida) });
  else for (let i = 1; i <= tr.principal.n; i++) {
    out.push({ k: 'tiro', ...alvo(tr.principal.esforco), rep: i, nrep: tr.principal.n });
    if (i < tr.principal.n) out.push({ k: 'rec', ...alvo(tr.principal.rec), rep: i, nrep: tr.principal.n });
  }
  if (tr.dq) out.push({ k: 'dq', ...alvo(tr.dq) });
  return out;
}
const NOME_ETAPA = { aq: 'Aquecimento', co: 'Corrida', tiro: 'Tiro', rec: 'Recuperação', dq: 'Desaquecimento' } as const;
const nomeEtapa = (e: Etapa) => (e.k === 'tiro' ? `Tiro ${e.rep} de ${e.nrep}` : e.k === 'rec' ? `Recuperação ${e.rep} de ${(e.nrep ?? 1) - 1}` : NOME_ETAPA[e.k]);
const trechoTxt = (t: Trecho) => (t.med === 'min' ? `${String(t.v).replace('.', ',')} min` : t.med === 'km' ? `${String(t.v).replace('.', ',')} km` : `${t.v} m`);
const alvoTxt = (e: Etapa) => (e.t ? `${Math.round(e.t / 60 * 10) / 10} min`.replace('.', ',') : e.d! >= 1000 ? `${(e.d! / 1000).toString().replace('.', ',')} km` : `${Math.round(e.d!)} m`);
export const resumoTreino = (tr: Treino) => [tr.aq && `${trechoTxt(tr.aq)} de aquecimento`, tr.principal.modo === 'continuo' ? trechoTxt(tr.principal.corrida) : `${tr.principal.n} × ${trechoTxt(tr.principal.esforco)} (rec. ${trechoTxt(tr.principal.rec)})`, tr.dq && `${trechoTxt(tr.dq)} de desaquecimento`].filter(Boolean).join(' · ');

/* ───────── números ───────── */
const fmtT = (s: number) => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`; };
const fmtP = (sPorKm: number) => (sPorKm > 0 && sPorKm < 1800 ? fmtT(sPorKm) : '–:––');
const fmtKm = (m: number) => (m / 1000).toFixed(2).replace('.', ',');
const distGeo = (a: [number, number], b: [number, number]) => { const R = 6371000, r = Math.PI / 180, dLa = (b[0] - a[0]) * r, dLo = (b[1] - a[1]) * r; const x = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
const paceFala = (s: number) => { const r = Math.round(s), m = Math.floor(r / 60), x = r % 60; return `${m} ${m === 1 ? 'minuto' : 'minutos'}${x ? ` e ${x} ${x === 1 ? 'segundo' : 'segundos'}` : ''}`; };

/* ───────── voz ───────── */
let vozLigada = true;
function falar(txt: string) {
  if (!vozLigada || !('speechSynthesis' in window)) return;
  try { const u = new SpeechSynthesisUtterance(txt); u.lang = 'pt-BR'; u.rate = 1.05; const v = speechSynthesis.getVoices().find(x => x.lang?.toLowerCase().startsWith('pt')); if (v) u.voice = v; speechSynthesis.speak(u); } catch { /* */ }
}
let actx: AudioContext | null = null;
function bipe(n = 1) {
  try { actx ||= new AudioContext(); for (let i = 0; i < n; i++) { const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(actx.destination); const t0 = actx.currentTime + i * 0.25; g.gain.setValueAtTime(0.25, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18); o.start(t0); o.stop(t0 + 0.2); } } catch { /* */ }
}

/* ───────── sessão em andamento (fica salva no aparelho, pra não perder se a tela fechar) ───────── */
type Sessao = {
  ext: string; modo: 'rua' | 'esteira'; treino: Treino | null; inicio: number; estado: 'correndo' | 'pausado';
  mov: number; marca: number | null; dist: number; etapa: number; etapaIni: { t: number; d: number }; voltas: { k: Etapa['k']; t: number; d: number }[];
  parciais: { km: number; seg: number; parcial?: boolean }[]; ultKm: { t: number; d: number }; rota: [number, number][]; vel: number; salvoEm: number;
};
const movDe = (s: Sessao) => s.mov + (s.estado === 'correndo' && s.marca ? Date.now() - s.marca : 0) / 1000;

/* ═════════════════════════ tela ═════════════════════════ */
export function TelaGravar({ pro, assinar, irAtividades }: { pro: boolean; assinar: () => void; irAtividades: () => void }) {
  const [modo, setModo] = useState<'rua' | 'esteira'>(() => ler<'rua' | 'esteira'>('radar-gravar-modo', 'rua'));
  const [treinos, setTreinos] = useState<Treino[]>(() => ler<Treino[]>(CHAVE_TREINOS, []));
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [editando, setEditando] = useState<Treino | 'novo' | null>(null);
  const [sessao, setSessao] = useState<Sessao | null>(() => { const s = ler<Sessao | null>(CHAVE_SESSAO, null); return s && Date.now() - s.salvoEm < 8 * 3600e3 ? { ...s, estado: 'pausado', marca: null } : null; });
  const [fim, setFim] = useState<Sessao | null>(null);
  useEffect(() => gravarLocal('radar-gravar-modo', modo), [modo]);
  const salvarTreinos = (l: Treino[]) => { setTreinos(l); gravarLocal(CHAVE_TREINOS, l); };
  const treino = treinos.find(t => t.id === escolhido) ?? null;

  if (!pro) return (
    <div className="pro-cont">
      <section className="pro-card pro-grav-trava">
        <span className="pro-grav-trava-ic"><IconeGravar size={34} /></span>
        <h2>Corra sem relógio</h2>
        <p className="pro-sub">Grave a corrida pelo celular, na rua com GPS ou na esteira, livre ou seguindo o treino que o seu treinador passou. Voz a cada etapa e a cada km, e a corrida entra nas suas atividades com resenha e card.</p>
        <button className="btn solid" onClick={assinar}><Lock size={16} aria-hidden="true" />É do Radar Pro · Assinar</button>
      </section>
    </div>
  );

  if (sessao) return <Gravando s0={sessao} sair={s => { setSessao(null); if (s) setFim(s); }} />;
  if (fim) return <Concluir s={fim} pronto={ok => { setFim(null); gravarLocal(CHAVE_SESSAO, null); if (ok) irAtividades(); }} />;

  const iniciar = () => {
    const agora = Date.now();
    const s: Sessao = { ext: 'cel-' + uid(), modo, treino, inicio: agora, estado: 'correndo', mov: 0, marca: agora, dist: 0, etapa: 0, etapaIni: { t: 0, d: 0 }, voltas: [], parciais: [], ultKm: { t: 0, d: 0 }, rota: [], vel: ler<number>('radar-esteira-vel', 9), salvoEm: agora };
    gravarLocal(CHAVE_SESSAO, s); setSessao(s);
  };

  return (
    <div className="pro-cont pro-grav">
      <div className="pro-grav-modo" role="radiogroup" aria-label="Onde você vai correr">
        <button role="radio" aria-checked={modo === 'rua'} className={modo === 'rua' ? 'on' : ''} onClick={() => setModo('rua')}><MapPin size={22} aria-hidden="true" /><b>Na rua</b><small>GPS do celular</small></button>
        <button role="radio" aria-checked={modo === 'esteira'} className={modo === 'esteira' ? 'on' : ''} onClick={() => setModo('esteira')}><Footprints size={22} aria-hidden="true" /><b>Na esteira</b><small>Velocidade do painel</small></button>
      </div>

      <p className="pro-k cinza pro-sem-margem">Qual treino?</p>
      <div className="pro-grav-lista">
        <button className={'pro-grav-op' + (!escolhido ? ' on' : '')} onClick={() => setEscolhido(null)}>
          <span className="pro-grav-check">{!escolhido && <Check size={16} aria-hidden="true" />}</span>
          <span><b>Corrida livre</b><small>Sem etapas: só tempo, distância e pace</small></span>
        </button>
        {treinos.map(t => (
          <div key={t.id} className={'pro-grav-op' + (escolhido === t.id ? ' on' : '')}>
            <button className="pro-grav-op-corpo" onClick={() => setEscolhido(t.id)}>
              <span className="pro-grav-check">{escolhido === t.id && <Check size={16} aria-hidden="true" />}</span>
              <span><b>{t.nome}</b><small>{t.tipo} · {resumoTreino(t)}</small></span>
            </button>
            <button className="btn text pro-grav-ed" onClick={() => setEditando(t)} aria-label={`Editar ${t.nome}`}><Pencil size={17} aria-hidden="true" /></button>
          </div>
        ))}
        <button className="pro-grav-novo" onClick={() => setEditando('novo')}><Plus size={18} aria-hidden="true" />Montar treino do treinador</button>
      </div>

      {treino && <section className="pro-card pro-grav-etapas">
        <p className="pro-k cinza pro-sem-margem">{treino.nome} · {treino.tipo}</p>
        <ol>{etapasDe(treino).slice(0, 14).map((e, i) => <li key={i} className={'e-' + e.k}><span>{nomeEtapa(e)}</span><b>{alvoTxt(e)}</b></li>)}</ol>
        {etapasDe(treino).length > 14 && <small className="pro-sub">e mais {etapasDe(treino).length - 14} etapas</small>}
        {treino.obs && <p className="pro-grav-obs">“{treino.obs}”</p>}
      </section>}

      <button className="btn solid pro-btn pro-grav-iniciar" onClick={iniciar}><IconeGravar size={22} />Iniciar {modo === 'rua' ? 'na rua' : 'na esteira'}</button>
      <p className="fine pro-centro">{modo === 'rua' ? 'Deixe o app aberto com a tela ligada durante a corrida: o Radar mantém a tela acesa. Com a tela apagada, o celular pode parar o GPS.' : 'Na esteira o Radar calcula a distância pela velocidade que você informa (igual à do painel). No fim, confira com o painel.'}</p>

      {editando && <MontarTreino t={editando === 'novo' ? null : editando} fechar={() => setEditando(null)}
        salvar={t => { const l = treinos.some(x => x.id === t.id) ? treinos.map(x => (x.id === t.id ? t : x)) : [t, ...treinos]; salvarTreinos(l); setEscolhido(t.id); setEditando(null); }}
        apagar={id => { salvarTreinos(treinos.filter(x => x.id !== id)); if (escolhido === id) setEscolhido(null); setEditando(null); }} />}
    </div>
  );
}

/* ───────── montar o treino que o treinador passou ───────── */
function CampoTrecho({ rot, t, mudar, meds = ['min', 'km', 'm'] }: { rot: string; t: Trecho; mudar: (t: Trecho) => void; meds?: Med[] }) {
  return (
    <div className="pro-grav-trecho">
      <span>{rot}</span>
      <input type="number" inputMode="decimal" min={0} step="any" value={Number.isFinite(t.v) ? t.v : ''} onChange={e => mudar({ ...t, v: parseFloat(e.target.value.replace(',', '.')) })} aria-label={`${rot}: valor`} />
      <select value={t.med} onChange={e => mudar({ ...t, med: e.target.value as Med })} aria-label={`${rot}: unidade`}>{meds.map(m => <option key={m} value={m}>{m}</option>)}</select>
    </div>
  );
}
function MontarTreino({ t, fechar, salvar, apagar }: { t: Treino | null; fechar: () => void; salvar: (t: Treino) => void; apagar: (id: string) => void }) {
  const [nome, setNome] = useState(t?.nome ?? '');
  const [tipo, setTipo] = useState(t?.tipo ?? 'Intervalado');
  const [obs, setObs] = useState(t?.obs ?? '');
  const [comAq, setComAq] = useState(t ? !!t.aq : true);
  const [aq, setAq] = useState<Trecho>(t?.aq ?? { v: 10, med: 'min' });
  const [comDq, setComDq] = useState(t ? !!t.dq : true);
  const [dq, setDq] = useState<Trecho>(t?.dq ?? { v: 5, med: 'min' });
  const [pm, setPm] = useState<'continuo' | 'series'>(t?.principal.modo ?? 'series');
  const [corrida, setCorrida] = useState<Trecho>(t?.principal.modo === 'continuo' ? t.principal.corrida : { v: 5, med: 'km' });
  const [n, setN] = useState(t?.principal.modo === 'series' ? t.principal.n : 6);
  const [esf, setEsf] = useState<Trecho>(t?.principal.modo === 'series' ? t.principal.esforco : { v: 400, med: 'm' });
  const [rec, setRec] = useState<Trecho>(t?.principal.modo === 'series' ? t.principal.rec : { v: 1.5, med: 'min' });
  const [erro, setErro] = useState<string | null>(null);
  const ok = (x: Trecho) => Number.isFinite(x.v) && x.v > 0 && (x.med !== 'm' || x.v >= 20) && (x.med !== 'km' || x.v <= 100) && (x.med !== 'min' || x.v <= 600);
  const enviar = () => {
    if (!nome.trim()) return setErro('Dê um nome ao treino (ex.: 6 × 400 m).');
    const trechos = [comAq && aq, comDq && dq, ...(pm === 'continuo' ? [corrida] : [esf, rec])].filter(Boolean) as Trecho[];
    if (!trechos.every(ok)) return setErro('Confira os valores: todos precisam ser maiores que zero.');
    if (pm === 'series' && !(n >= 1 && n <= 50)) return setErro('As séries vão de 1 a 50 repetições.');
    salvar({ id: t?.id ?? uid(), nome: nome.trim().slice(0, 60), tipo, obs: obs.trim().slice(0, 200) || undefined, aq: comAq ? aq : null, dq: comDq ? dq : null,
      principal: pm === 'continuo' ? { modo: 'continuo', corrida } : { modo: 'series', n, esforco: esf, rec } });
  };
  return (
    <div className="pro-folha" role="dialog" aria-modal="true" aria-label="Montar treino" onClick={fechar}>
      <div className="pro-folha-caixa pro-grav-form" onClick={e => e.stopPropagation()}>
        <div className="pro-linha"><b>{t ? 'Editar treino' : 'Treino do treinador'}</b><button className="btn text" onClick={fechar} aria-label="Fechar"><X size={20} aria-hidden="true" /></button></div>
        <label className="pro-campo"><span>Nome do treino</span><input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: 6 × 400 m na pista" maxLength={60} /></label>
        <div><span className="pro-grav-rot">Tipo de treino</span>
          <div className="chips">{TIPOS_TREINO.map(x => <button key={x} className="chip" aria-pressed={tipo === x} onClick={() => setTipo(x)}>{x}</button>)}</div></div>

        <label className="pro-grav-liga"><input type="checkbox" checked={comAq} onChange={e => setComAq(e.target.checked)} />Aquecimento</label>
        {comAq && <CampoTrecho rot="Aquecimento" t={aq} mudar={setAq} meds={['min', 'km']} />}

        <div><span className="pro-grav-rot">Parte principal</span>
          <div className="pro-grav-seg"><button className={pm === 'series' ? 'on' : ''} onClick={() => setPm('series')}>Séries (tiros)</button><button className={pm === 'continuo' ? 'on' : ''} onClick={() => setPm('continuo')}>Contínuo</button></div></div>
        {pm === 'continuo' ? <CampoTrecho rot="Correr" t={corrida} mudar={setCorrida} /> : <>
          <div className="pro-grav-trecho"><span>Repetições</span>
            <span className="pro-grav-n"><button className="btn outline" onClick={() => setN(v => Math.max(1, v - 1))} aria-label="Menos"><Minus size={16} aria-hidden="true" /></button><b>{n}</b><button className="btn outline" onClick={() => setN(v => Math.min(50, v + 1))} aria-label="Mais"><Plus size={16} aria-hidden="true" /></button></span></div>
          <CampoTrecho rot="Cada tiro" t={esf} mudar={setEsf} />
          <CampoTrecho rot="Recuperação" t={rec} mudar={setRec} meds={['min', 'm']} />
        </>}

        <label className="pro-grav-liga"><input type="checkbox" checked={comDq} onChange={e => setComDq(e.target.checked)} />Desaquecimento</label>
        {comDq && <CampoTrecho rot="Desaquecimento" t={dq} mudar={setDq} meds={['min', 'km']} />}

        <label className="pro-campo"><span>Recado do treinador (opcional)</span><input value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex.: tiros a 4:30/km, recuperação trotando" maxLength={200} /></label>
        {erro && <p className="ct-erro" role="alert">{erro}</p>}
        <button className="btn solid" onClick={enviar}>Salvar treino</button>
        {t && <button className="btn text pro-grav-apagar" onClick={() => apagar(t.id)}><Trash2 size={16} aria-hidden="true" />Apagar este treino</button>}
      </div>
    </div>
  );
}

/* ───────── gravando ───────── */
function Gravando({ s0, sair }: { s0: Sessao; sair: (s: Sessao | null) => void }) {
  const s = useRef<Sessao>(s0);
  const [, tique] = useState(0);
  const [sinal, setSinal] = useState<'buscando' | 'ok' | 'fraco' | 'negado' | null>(s0.modo === 'rua' ? 'buscando' : null);
  const [voz, setVoz] = useState(vozLigada);
  const [confirmaFim, setConfirmaFim] = useState(false);
  const etapas = useMemo(() => etapasDe(s0.treino), [s0.treino]);
  const ult = useRef<{ p: [number, number]; t: number } | null>(null);
  const janela = useRef<{ t: number; d: number }[]>([]);
  const ultT = useRef<number | null>(null);
  const salvar = () => { s.current.salvoEm = Date.now(); gravarLocal(CHAVE_SESSAO, s.current); };

  const anunciarEtapa = (i: number) => { const e = etapas[i]; if (!e) return; bipe(2); falar(`${nomeEtapa(e)}. ${alvoTxt(e).replace(',', ' vírgula ').replace(/ km$/, ' quilômetros').replace(/ m$/, ' metros').replace(/ min$/, ' minutos')}.`); };
  // começo
  useEffect(() => {
    if (s.current.mov === 0 && s.current.dist === 0) { if (etapas.length) anunciarEtapa(0); else { bipe(); falar(s0.modo === 'rua' ? 'Corrida iniciada.' : 'Esteira iniciada.'); } }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // tela acesa
  useEffect(() => {
    let lock: WakeLockSentinel | null = null, vivo = true;
    const pedir = () => (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinel> } }).wakeLock?.request('screen').then(l => { if (vivo) lock = l; else l.release(); }).catch(() => null);
    pedir(); const vis = () => { if (document.visibilityState === 'visible') pedir(); };
    document.addEventListener('visibilitychange', vis);
    return () => { vivo = false; document.removeEventListener('visibilitychange', vis); lock?.release().catch(() => null); };
  }, []);

  // soma distância e confere etapas/km
  const avancar = (dd: number) => {
    const st = s.current; if (st.estado !== 'correndo') return;
    const d0 = st.dist, t = movDe(st), t0 = Math.min(ultT.current ?? t, t);
    st.dist += dd; ultT.current = t;
    janela.current.push({ t, d: st.dist }); janela.current = janela.current.filter(x => t - x.t <= 30);
    // km fechado: interpola o instante exato em que passou da marca
    while (st.dist - st.ultKm.d >= 1000) {
      const marca = st.ultKm.d + 1000, tKm = t0 + (t - t0) * Math.min(1, Math.max(0, (marca - d0) / Math.max(dd, 1e-6)));
      const seg = Math.max(1, Math.round(tKm - st.ultKm.t));
      st.parciais.push({ km: st.parciais.length + 1, seg }); st.ultKm = { t: tKm, d: marca };
      const k = etapas[st.etapa]?.k; // nos tiros a voz fala das etapas; nos trechos contínuos, de cada km
      if (!k || k === 'aq' || k === 'co' || k === 'dq') falar(`${st.parciais.length} ${st.parciais.length === 1 ? 'quilômetro' : 'quilômetros'}. Último quilômetro em ${paceFala(seg)}.`);
    }
    conferirEtapa();
  };
  const conferirEtapa = () => {
    const st = s.current, e = etapas[st.etapa]; if (!e) return;
    const t = movDe(st), feito = e.t ? t - st.etapaIni.t >= e.t : st.dist - st.etapaIni.d >= (e.d ?? Infinity);
    if (feito) proxima();
  };
  const proxima = () => {
    const st = s.current, e = etapas[st.etapa]; if (!e) return;
    const t = movDe(st);
    st.voltas.push({ k: e.k, t: Math.round(t - st.etapaIni.t), d: Math.round(st.dist - st.etapaIni.d) });
    st.etapa++; st.etapaIni = { t, d: st.dist };
    if (st.etapa < etapas.length) anunciarEtapa(st.etapa); else { bipe(3); falar('Treino concluído! Pode encerrar quando quiser.'); }
    salvar();
  };

  // GPS (rua)
  useEffect(() => {
    if (s0.modo !== 'rua') return;
    if (!('geolocation' in navigator)) { setSinal('negado'); return; }
    const id = navigator.geolocation.watchPosition(pos => {
      const { latitude, longitude, accuracy } = pos.coords; const p: [number, number] = [+latitude.toFixed(6), +longitude.toFixed(6)];
      setSinal(accuracy <= 25 ? 'ok' : 'fraco');
      if (accuracy > 35) return; // ponto ruim: ignora
      const st = s.current, ag = pos.timestamp;
      if (st.estado !== 'correndo') { ult.current = { p, t: ag }; return; }
      if (ult.current) {
        const d = distGeo(ult.current.p, p), dt = (ag - ult.current.t) / 1000;
        if (d < 2.5) return; // parado ou tremor do sinal
        if (dt > 0 && d / dt > 9) { ult.current = { p, t: ag }; return; } // salto impossível pra uma corrida
        avancar(d);
        const r = st.rota; if (!r.length || distGeo(r[r.length - 1], p) >= 8) r.push(p);
      } else if (!st.rota.length) st.rota.push(p);
      ult.current = { p, t: ag };
    }, err => setSinal(err.code === 1 ? 'negado' : 'fraco'), { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
    return () => navigator.geolocation.clearWatch(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // relógio: 1 vez por segundo (na esteira também soma a distância pela velocidade)
  useEffect(() => {
    let antes = Date.now();
    const iv = setInterval(() => {
      const ag = Date.now(), dt = (ag - antes) / 1000; antes = ag;
      const st = s.current;
      if (st.estado === 'correndo') { if (st.modo === 'esteira') avancar(st.vel / 3.6 * Math.min(dt, 5)); else conferirEtapa(); }
      if (Math.floor(ag / 1000) % 5 === 0) salvar();
      tique(x => x + 1);
    }, 1000);
    return () => clearInterval(iv);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const st = s.current, t = movDe(st), e = etapas[st.etapa], prox = etapas[st.etapa + 1];
  const jan = janela.current, pAtual = st.modo === 'esteira' ? (st.vel > 0 ? 3600 / st.vel : 0) : jan.length > 3 && jan[jan.length - 1].d - jan[0].d > 15 ? (jan[jan.length - 1].t - jan[0].t) / ((jan[jan.length - 1].d - jan[0].d) / 1000) : 0;
  const pMed = st.dist > 50 ? t / (st.dist / 1000) : 0;
  const falta = e ? (e.t ? e.t - (t - st.etapaIni.t) : (e.d ?? 0) - (st.dist - st.etapaIni.d)) : 0;
  const prog = e ? Math.min(1, Math.max(0, e.t ? (t - st.etapaIni.t) / e.t : (st.dist - st.etapaIni.d) / (e.d ?? 1))) : 0;
  const pausar = () => { if (st.estado === 'correndo') { st.mov = movDe(st); st.marca = null; st.estado = 'pausado'; falar('Pausado.'); } else { st.marca = Date.now(); st.estado = 'correndo'; ult.current = null; ultT.current = null; falar('Continuando.'); } salvar(); tique(x => x + 1); };
  const mudarVel = (dv: number) => { st.vel = Math.max(1, Math.min(25, Math.round((st.vel + dv) * 10) / 10)); gravarLocal('radar-esteira-vel', st.vel); salvar(); tique(x => x + 1); };
  const encerrar = () => {
    if (st.estado === 'correndo') { st.mov = movDe(st); st.marca = null; st.estado = 'pausado'; }
    if (e && st.dist - st.etapaIni.d + (t - st.etapaIni.t) > 0) st.voltas.push({ k: e.k, t: Math.round(t - st.etapaIni.t), d: Math.round(st.dist - st.etapaIni.d) });
    // pedaço do último km
    const resto = st.dist - st.ultKm.d; if (resto >= 100) st.parciais.push({ km: st.parciais.length + 1, seg: Math.round(st.mov - st.ultKm.t), parcial: true });
    salvar(); speechSynthesis?.cancel?.(); sair({ ...st });
  };
  const descartar = () => { gravarLocal(CHAVE_SESSAO, null); speechSynthesis?.cancel?.(); sair(null); };

  return (
    <div className={'pro-gravando' + (st.estado === 'pausado' ? ' pausado' : '')}>
      <div className="pro-gravando-topo">
        <span className="pro-gravando-tit"><b>{st.treino?.nome ?? (st.modo === 'rua' ? 'Corrida livre' : 'Esteira livre')}</b>
          <small>{st.modo === 'esteira' ? 'Esteira' : sinal === 'ok' ? '● GPS bom' : sinal === 'fraco' ? '● GPS fraco' : sinal === 'negado' ? 'GPS bloqueado: libere a localização' : 'Procurando GPS…'}</small></span>
        <button className="pro-gravando-voz" onClick={() => { vozLigada = !vozLigada; setVoz(vozLigada); if (!vozLigada) speechSynthesis?.cancel?.(); }} aria-label={voz ? 'Desligar voz' : 'Ligar voz'}>{voz ? <Volume2 size={20} /> : <VolumeX size={20} />}</button>
      </div>

      {e ? <div className={'pro-gravando-etapa e-' + e.k}>
        <span>{nomeEtapa(e)} · etapa {st.etapa + 1} de {etapas.length}</span>
        <b>{e.t ? fmtT(falta) : falta >= 1000 ? `${fmtKm(falta)} km` : `${Math.max(0, Math.round(falta))} m`}<small> faltando</small></b>
        <i><em style={{ width: `${prog * 100}%` }} /></i>
        <small>{prox ? <>Depois: <b>{nomeEtapa(prox)}</b> · {alvoTxt(prox)}</> : 'Última etapa'}</small>
      </div> : etapas.length ? <div className="pro-gravando-etapa fim"><b>Treino concluído ✓</b><small>Continue correndo livre ou encerre.</small></div> : null}

      <div className="pro-gravando-tempo"><small>Tempo</small><b>{fmtT(t)}</b></div>
      <div className="pro-gravando-nums">
        <div><small>Distância</small><b>{fmtKm(st.dist)}<em>km</em></b></div>
        <div><small>{st.modo === 'esteira' ? 'Pace' : 'Pace atual'}</small><b>{fmtP(pAtual)}<em>/km</em></b></div>
        <div><small>Pace médio</small><b>{fmtP(pMed)}<em>/km</em></b></div>
      </div>

      {st.modo === 'esteira' && <div className="pro-gravando-vel">
        <button onClick={() => mudarVel(-0.5)} aria-label="Diminuir velocidade">−0,5</button>
        <button onClick={() => mudarVel(-0.1)} aria-label="Diminuir 0,1">−</button>
        <span><b>{st.vel.toFixed(1).replace('.', ',')}</b><small>km/h na esteira</small></span>
        <button onClick={() => mudarVel(0.1)} aria-label="Aumentar 0,1">+</button>
        <button onClick={() => mudarVel(0.5)} aria-label="Aumentar velocidade">+0,5</button>
      </div>}

      <div className="pro-gravando-acoes">
        {e && <button className="pro-gravando-b sec" onClick={() => { proxima(); tique(x => x + 1); }} aria-label="Pular para a próxima etapa"><SkipForward size={22} /><small>Próxima</small></button>}
        <button className={'pro-gravando-b principal' + (st.estado === 'pausado' ? ' play' : '')} onClick={pausar} aria-label={st.estado === 'correndo' ? 'Pausar' : 'Continuar'}>{st.estado === 'correndo' ? <Pause size={34} /> : <Play size={34} />}</button>
        <button className="pro-gravando-b sec" onClick={() => setConfirmaFim(true)} aria-label="Encerrar"><Square size={20} /><small>Encerrar</small></button>
      </div>

      {confirmaFim && <div className="pro-folha" role="dialog" aria-modal="true" aria-label="Encerrar" onClick={() => setConfirmaFim(false)}>
        <div className="pro-folha-caixa" onClick={ev => ev.stopPropagation()}>
          <b>Encerrar a corrida?</b>
          <p className="pro-sub pro-sem-margem">{fmtKm(st.dist)} km em {fmtT(t)}.</p>
          <button className="btn solid" onClick={encerrar}>Encerrar e salvar</button>
          <button className="btn outline" onClick={() => setConfirmaFim(false)}>Continuar correndo</button>
          <button className="btn text pro-grav-apagar" onClick={descartar}><Trash2 size={16} aria-hidden="true" />Descartar sem salvar</button>
        </div>
      </div>}
    </div>
  );
}

/* ───────── fim: confere e salva ───────── */
function Concluir({ s, pronto }: { s: Sessao; pronto: (ok: boolean) => void }) {
  const [titulo, setTitulo] = useState(s.treino?.nome ?? (s.modo === 'rua' ? 'Corrida' : 'Esteira'));
  const [kmTxt, setKmTxt] = useState(fmtKm(s.dist));
  const [indo, setIndo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [descartando, setDescartando] = useState(false);
  const dist = Math.round(parseFloat(kmTxt.replace(',', '.')) * 1000) || 0;
  const pace = dist > 0 ? s.mov / (dist / 1000) : 0;
  const salvar = async () => {
    if (s.mov < 30) return setErro('A corrida precisa ter pelo menos 30 segundos.');
    setIndo(true); setErro(null);
    // na esteira, se a pessoa corrigiu a distância pelo painel, as parciais são reescaladas
    const fator = s.dist > 0 ? dist / s.dist : 1;
    const parciais = s.modo === 'esteira' && Math.abs(fator - 1) > 0.01 ? [] : s.parciais;
    const { error } = await sb.rpc('radar_atividade_gravar', { p: {
      ext_id: s.ext, tipo: s.modo === 'esteira' ? 'esteira' : 'corrida', titulo, data: new Date(s.inicio).toISOString(),
      distancia_m: dist, duracao_s: Math.round(s.mov), parciais, rota: s.modo === 'rua' ? s.rota : [],
      resumo_rel: { celular: true, treino: s.treino ? { nome: s.treino.nome, tipo: s.treino.tipo, resumo: resumoTreino(s.treino), obs: s.treino.obs ?? null } : null, etapas: s.voltas },
    } });
    setIndo(false);
    if (error) return setErro(error.message.includes('Pro') ? 'Gravar corridas é do Radar Pro.' : 'Não deu pra salvar agora. Confira a internet e tente de novo: a corrida continua guardada no aparelho.');
    window.dispatchEvent(new Event('radar-atividades-recarregar'));
    pronto(true);
  };
  return (
    <div className="pro-cont pro-grav">
      <section className="pro-card pro-grav-fim">
        <p className="pro-k cinza pro-sem-margem">Corrida encerrada</p>
        <h2>{fmtKm(dist)} km</h2>
        <div className="pro-grav-fim-nums"><span><small>Tempo</small><b>{fmtT(s.mov)}</b></span><span><small>Pace médio</small><b>{fmtP(pace)}/km</b></span>{s.treino && <span><small>Etapas</small><b>{s.voltas.length}</b></span>}</div>
        <label className="pro-campo"><span>Nome da atividade</span><input value={titulo} onChange={e => setTitulo(e.target.value)} maxLength={80} /></label>
        <label className="pro-campo"><span>{s.modo === 'esteira' ? 'Distância no painel da esteira (km)' : 'Distância (km)'}</span><input inputMode="decimal" value={kmTxt} onChange={e => setKmTxt(e.target.value)} /></label>
        {erro && <p className="ct-erro" role="alert">{erro}</p>}
        <button className="btn solid" onClick={salvar} disabled={indo}>{indo ? 'Salvando…' : 'Salvar nas minhas atividades'}</button>
        {descartando
          ? <div className="pro-grav-confirma"><span>Descartar esta corrida? Não dá pra desfazer.</span><button className="btn outline" onClick={() => setDescartando(false)}>Não</button><button className="btn text pro-grav-apagar" onClick={() => pronto(false)}>Sim, descartar</button></div>
          : <button className="btn text pro-grav-apagar" onClick={() => setDescartando(true)}><Trash2 size={16} aria-hidden="true" />Descartar</button>}
      </section>
      <p className="fine pro-centro">Depois de salvar, ela aparece em <b>Temporada → Minhas atividades</b>, com a resenha do treino, gráficos e o card. <ChevronRight size={12} aria-hidden="true" /></p>
    </div>
  );
}
