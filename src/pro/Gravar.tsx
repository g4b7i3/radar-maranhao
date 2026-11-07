// Radar Pro · "Gravar": correr sem relógio, pelo celular. Na rua (GPS) ou na esteira (velocidade do painel).
// Livre ou seguindo o treino que o treinador passou (aquecimento, parte principal ou séries, desaquecimento),
// com voz a cada etapa e a cada km. No fim vira uma atividade em "Minhas atividades", com resenha, card e feed.
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Footprints, Plus, Minus, Play, Pause, Square, SkipForward, Volume2, VolumeX, X, Trash2, Pencil, Lock, ChevronRight, Check, Map as IcMapa, EyeOff } from 'lucide-react';
import { MapaCorrida } from './MapaCorrida';
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
export type Ritmo = { modo: 'livre' } | { modo: 'zona'; z: number } | { modo: 'pace'; de: number; ate: number }; // pace em s/km (de = mais rápido)
type Trecho = { v: number; med: Med; ritmo?: Ritmo; jeito?: 'trote' | 'caminhada' | 'parado' };
export type Treino = {
  id: string; nome: string; tipo: string; obs?: string;
  aq?: Trecho | null; dq?: Trecho | null;
  principal: { modo: 'continuo'; corrida: Trecho } | { modo: 'series'; n: number; esforco: Trecho; rec: Trecho };
};
type Etapa = { k: 'aq' | 'co' | 'tiro' | 'rec' | 'dq'; t?: number; d?: number; rep?: number; nrep?: number; ritmo?: Ritmo; jeito?: Trecho['jeito'] };

export const ZONAS = [
  { z: 1, n: 'Muito leve', d: 'regenerativo, quase caminhando' },
  { z: 2, n: 'Leve', d: 'dá pra conversar' },
  { z: 3, n: 'Moderado', d: 'frases curtas' },
  { z: 4, n: 'Forte', d: 'ritmo de limiar, poucas palavras' },
  { z: 5, n: 'Muito forte', d: 'tiros, sem conversa' },
];
const JEITO = { trote: 'trotando', caminhada: 'caminhando', parado: 'parado' } as const;
const paceTxt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const lerPace = (t: string) => { const m = t.trim().match(/^(\d{1,2})[:.,'h ]?(\d{2})$/); if (!m) return NaN; const v = +m[1] * 60 + +m[2]; return +m[2] < 60 && v >= 150 && v <= 900 ? v : NaN; };
const kmh = (p: number) => (3600 / p).toFixed(1).replace('.', ',');
export const ritmoTxt = (r?: Ritmo, esteira = false) => !r || r.modo === 'livre' ? '' : r.modo === 'zona' ? `Z${r.z} · ${ZONAS[r.z - 1].n}`
  : esteira ? `${kmh(r.ate)} a ${kmh(r.de)} km/h` : r.de === r.ate ? `${paceTxt(r.de)}/km` : `${paceTxt(r.de)} a ${paceTxt(r.ate)}/km`;
const ritmoFala = (r?: Ritmo, esteira = false) => !r || r.modo === 'livre' ? '' : r.modo === 'zona' ? ` Zona ${r.z}, ${ZONAS[r.z - 1].n.toLowerCase()}.`
  : esteira ? ` Velocidade de ${kmh(r.ate).replace(',', ' vírgula ')} a ${kmh(r.de).replace(',', ' vírgula ')}.` : ` Pace de ${paceFala(r.de)}${r.de !== r.ate ? ` a ${paceFala(r.ate)}` : ''}.`;

export const TIPOS_TREINO = ['Rodagem', 'Intervalado', 'Tiros', 'Longão', 'Progressivo', 'Fartlek', 'Ritmo', 'Regenerativo', 'Subida'];
const CHAVE_TREINOS = 'radar-treinos';
const CHAVE_SESSAO = 'radar-gravando';
const ler = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : d; } catch { return d; } };
const gravarLocal = (k: string, v: unknown) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } };
const uid = () => (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36));

const alvo = (t: Trecho) => ({ ...(t.med === 'min' ? { t: t.v * 60 } : { d: t.med === 'km' ? t.v * 1000 : t.v }), ritmo: t.ritmo, jeito: t.jeito });
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
const comRitmo = (t: Trecho) => trechoTxt(t) + (ritmoTxt(t.ritmo) ? ` em ${ritmoTxt(t.ritmo)}` : '');
export const resumoTreino = (tr: Treino) => [tr.aq && `${trechoTxt(tr.aq)} de aquecimento`, tr.principal.modo === 'continuo' ? comRitmo(tr.principal.corrida) : `${tr.principal.n} × ${comRitmo(tr.principal.esforco)} (rec. ${trechoTxt(tr.principal.rec)}${tr.principal.rec.jeito ? ' ' + JEITO[tr.principal.rec.jeito] : ''})`, tr.dq && `${trechoTxt(tr.dq)} de desaquecimento`].filter(Boolean).join(' · ');

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
  const treino = pro ? treinos.find(t => t.id === escolhido) ?? null : null;
  const [trava, setTrava] = useState(false);

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
        {pro && treinos.map(t => (
          <div key={t.id} className={'pro-grav-op' + (escolhido === t.id ? ' on' : '')}>
            <button className="pro-grav-op-corpo" onClick={() => setEscolhido(t.id)}>
              <span className="pro-grav-check">{escolhido === t.id && <Check size={16} aria-hidden="true" />}</span>
              <span><b>{t.nome}</b><small>{t.tipo} · {resumoTreino(t)}</small></span>
            </button>
            <button className="btn text pro-grav-ed" onClick={() => setEditando(t)} aria-label={`Editar ${t.nome}`}><Pencil size={17} aria-hidden="true" /></button>
          </div>
        ))}
        <button className="pro-grav-novo" onClick={() => (pro ? setEditando('novo') : setTrava(true))}>{pro ? <Plus size={18} aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}Montar treino do treinador{!pro && <span className="pro-grav-tag">PRO</span>}</button>
      </div>

      {treino && <section className="pro-card pro-grav-etapas">
        <p className="pro-k cinza pro-sem-margem">{treino.nome} · {treino.tipo}</p>
        <ol>{etapasDe(treino).slice(0, 14).map((e, i) => <li key={i} className={'e-' + e.k}><span>{nomeEtapa(e)}{(ritmoTxt(e.ritmo) || (e.k === 'rec' && e.jeito)) && <small>{e.k === 'rec' && e.jeito ? JEITO[e.jeito] : ritmoTxt(e.ritmo, modo === 'esteira')}</small>}</span><b>{alvoTxt(e)}</b></li>)}</ol>
        {etapasDe(treino).length > 14 && <small className="pro-sub">e mais {etapasDe(treino).length - 14} etapas</small>}
        {treino.obs && <p className="pro-grav-obs">“{treino.obs}”</p>}
      </section>}

      <button className="btn solid pro-btn pro-grav-iniciar" onClick={iniciar}><IconeGravar size={22} />Iniciar {modo === 'rua' ? 'na rua' : 'na esteira'}</button>
      <p className="fine pro-centro">{modo === 'rua' ? 'Deixe o app aberto com a tela ligada durante a corrida: o Radar mantém a tela acesa. Com a tela apagada, o celular pode parar o GPS.' : 'Na esteira o Radar calcula a distância pela velocidade que você informa (igual à do painel). No fim, confira com o painel.'}</p>

      {trava && <div className="pro-folha" role="dialog" aria-modal="true" aria-label="Treino do treinador" onClick={() => setTrava(false)}>
        <div className="pro-folha-caixa pro-grav-trava" onClick={ev => ev.stopPropagation()}>
          <span className="pro-grav-trava-ic"><IconeGravar size={34} /></span>
          <h2>Treino do treinador</h2>
          <p className="pro-sub pro-sem-margem">Monte o treino que o seu treinador passou (aquecimento, tiros com recuperação, desaquecimento) e o Radar conduz cada etapa por voz: “Tiro 3 de 6, 400 metros”. É do <b>Radar Pro</b>.</p>
          <button className="btn solid" onClick={() => { setTrava(false); assinar(); }}>Assinar o Radar Pro · R$ 10</button>
          <button className="btn text" onClick={() => setTrava(false)}>Agora não, vou correr livre</button>
        </div>
      </div>}
      {editando && <MontarTreino t={editando === 'novo' ? null : editando} fechar={() => setEditando(null)}
        salvar={t => { const l = treinos.some(x => x.id === t.id) ? treinos.map(x => (x.id === t.id ? t : x)) : [t, ...treinos]; salvarTreinos(l); setEscolhido(t.id); setEditando(null); }}
        apagar={id => { salvarTreinos(treinos.filter(x => x.id !== id)); if (escolhido === id) setEscolhido(null); setEditando(null); }} />}
    </div>
  );
}

/* ───────── montar o treino que o treinador passou ───────── */
function Duracao({ t, mudar, meds = ['min', 'km', 'm'] }: { t: Trecho; mudar: (t: Trecho) => void; meds?: Med[] }) {
  const NOME = { min: 'minutos', km: 'km', m: 'metros' } as const;
  return (
    <div className="mt-linha">
      <span className="mt-rot">Duração</span>
      <div className="mt-dur">
        <input type="number" inputMode="decimal" min={0} step="any" value={Number.isFinite(t.v) ? t.v : ''} onChange={e => mudar({ ...t, v: parseFloat(e.target.value.replace(',', '.')) })} aria-label="Quanto" />
        <div className="mt-seg pequeno" role="radiogroup" aria-label="Unidade">{meds.map(m => <button key={m} role="radio" aria-checked={t.med === m} className={t.med === m ? 'on' : ''} onClick={() => mudar({ ...t, med: m })}>{NOME[m]}</button>)}</div>
      </div>
    </div>
  );
}
function CampoRitmo({ r, mudar }: { r?: Ritmo; mudar: (r: Ritmo) => void }) {
  const at = r ?? { modo: 'livre' as const };
  const [de, setDe] = useState(at.modo === 'pace' ? paceTxt(at.de) : '');
  const [ate, setAte] = useState(at.modo === 'pace' ? paceTxt(at.ate) : '');
  const aplicarPace = (a: string, b: string) => { const x = lerPace(a), y = lerPace(b || a); if (Number.isFinite(x) && Number.isFinite(y)) mudar({ modo: 'pace', de: Math.min(x, y), ate: Math.max(x, y) }); };
  return (
    <div className="mt-linha">
      <span className="mt-rot">Ritmo</span>
      <div className="mt-seg" role="radiogroup" aria-label="Como medir o ritmo">
        {([['livre', 'Livre'], ['zona', 'Zona'], ['pace', 'Pace']] as const).map(([k, n]) => <button key={k} role="radio" aria-checked={at.modo === k} className={at.modo === k ? 'on' : ''}
          onClick={() => mudar(k === 'livre' ? { modo: 'livre' } : k === 'zona' ? { modo: 'zona', z: at.modo === 'zona' ? at.z : 2 } : (Number.isFinite(lerPace(de)) ? { modo: 'pace', de: lerPace(de), ate: Number.isFinite(lerPace(ate)) ? lerPace(ate) : lerPace(de) } : { modo: 'pace', de: NaN, ate: NaN }))}>{n}</button>)}
      </div>
      {at.modo === 'zona' && <div className="mt-zonas" role="radiogroup" aria-label="Zona">
        {ZONAS.map(z => <button key={z.z} role="radio" aria-checked={at.z === z.z} className={'z' + z.z + (at.z === z.z ? ' on' : '')} onClick={() => mudar({ modo: 'zona', z: z.z })}><b>Z{z.z}</b><span>{z.n}</span></button>)}
        <small className="mt-ajuda">{ZONAS[at.z - 1].n}: {ZONAS[at.z - 1].d}</small>
      </div>}
      {at.modo === 'pace' && <div className="mt-pace">
        <label><span>de</span><input inputMode="numeric" placeholder="4:20" value={de} onChange={e => { setDe(e.target.value); aplicarPace(e.target.value, ate); }} aria-label="Pace mais rápido" /></label>
        <label><span>até</span><input inputMode="numeric" placeholder="4:30" value={ate} onChange={e => { setAte(e.target.value); aplicarPace(de, e.target.value); }} aria-label="Pace mais lento (opcional)" /></label>
        <span className="mt-un">/km</span>
        <small className="mt-ajuda">Escreva o pace como no relógio, ex.: 4:20. O "até" é opcional.</small>
      </div>}
    </div>
  );
}
function Bloco({ cor, titulo, sub, ligado, ligar, children }: { cor: string; titulo: string; sub?: string; ligado?: boolean; ligar?: (v: boolean) => void; children: React.ReactNode }) {
  const aberto = ligado ?? true;
  return (
    <section className={'mt-bloco' + (aberto ? '' : ' desl')} style={{ ['--c' as string]: cor }}>
      <header>
        <i aria-hidden="true" />
        <span><b>{titulo}</b>{sub && <small>{sub}</small>}</span>
        {ligar && <label className="mt-chave"><input type="checkbox" checked={aberto} onChange={e => ligar(e.target.checked)} aria-label={`Incluir ${titulo.toLowerCase()}`} /><em /></label>}
      </header>
      {aberto && <div className="mt-corpo">{children}</div>}
    </section>
  );
}
function MontarTreino({ t, fechar, salvar, apagar }: { t: Treino | null; fechar: () => void; salvar: (t: Treino) => void; apagar: (id: string) => void }) {
  const [nome, setNome] = useState(t?.nome ?? '');
  const [tipo, setTipo] = useState(t?.tipo ?? 'Intervalado');
  const [obs, setObs] = useState(t?.obs ?? '');
  const [comAq, setComAq] = useState(t ? !!t.aq : true);
  const [aq, setAq] = useState<Trecho>(t?.aq ?? { v: 10, med: 'min', ritmo: { modo: 'zona', z: 2 } });
  const [comDq, setComDq] = useState(t ? !!t.dq : true);
  const [dq, setDq] = useState<Trecho>(t?.dq ?? { v: 5, med: 'min', ritmo: { modo: 'zona', z: 1 } });
  const [pm, setPm] = useState<'continuo' | 'series'>(t?.principal.modo ?? 'series');
  const [corrida, setCorrida] = useState<Trecho>(t?.principal.modo === 'continuo' ? t.principal.corrida : { v: 5, med: 'km', ritmo: { modo: 'zona', z: 3 } });
  const [n, setN] = useState(t?.principal.modo === 'series' ? t.principal.n : 6);
  const [esf, setEsf] = useState<Trecho>(t?.principal.modo === 'series' ? t.principal.esforco : { v: 400, med: 'm', ritmo: { modo: 'zona', z: 5 } });
  const [rec, setRec] = useState<Trecho>(t?.principal.modo === 'series' ? t.principal.rec : { v: 1.5, med: 'min', jeito: 'trote' });
  const [erro, setErro] = useState<string | null>(null);
  const okDur = (x: Trecho) => Number.isFinite(x.v) && x.v > 0 && (x.med !== 'm' || x.v >= 20) && (x.med !== 'km' || x.v <= 100) && (x.med !== 'min' || x.v <= 600);
  const okRit = (x: Trecho) => !x.ritmo || x.ritmo.modo !== 'pace' || (Number.isFinite(x.ritmo.de) && Number.isFinite(x.ritmo.ate));
  const enviar = () => {
    if (!nome.trim()) return setErro('Dê um nome ao treino (ex.: 6 × 400 m).');
    const trechos = [comAq && aq, comDq && dq, ...(pm === 'continuo' ? [corrida] : [esf, rec])].filter(Boolean) as Trecho[];
    if (!trechos.every(okDur)) return setErro('Confira as durações: todas precisam ser maiores que zero.');
    if (!trechos.every(okRit)) return setErro('Confira o pace: escreva como no relógio, ex.: 4:20.');
    if (pm === 'series' && !(n >= 1 && n <= 50)) return setErro('As séries vão de 1 a 50 repetições.');
    salvar({ id: t?.id ?? uid(), nome: nome.trim().slice(0, 60), tipo, obs: obs.trim().slice(0, 200) || undefined, aq: comAq ? aq : null, dq: comDq ? dq : null,
      principal: pm === 'continuo' ? { modo: 'continuo', corrida } : { modo: 'series', n, esforco: esf, rec } });
  };
  const rascunho: Treino = { id: '', nome, tipo, aq: comAq ? aq : null, dq: comDq ? dq : null, principal: pm === 'continuo' ? { modo: 'continuo', corrida } : { modo: 'series', n, esforco: esf, rec } };
  return (
    <div className="pro-folha" role="dialog" aria-modal="true" aria-label="Montar treino" onClick={fechar}>
      <div className="pro-folha-caixa mt" onClick={e => e.stopPropagation()}>
        <div className="mt-topo"><b>{t ? 'Editar treino' : 'Treino do treinador'}</b><button className="btn text" onClick={fechar} aria-label="Fechar"><X size={20} aria-hidden="true" /></button></div>

        <section className="mt-cartao">
          <label className="mt-campo"><span>Nome do treino</span><input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: 6 × 400 m na pista" maxLength={60} /></label>
          <div className="mt-campo"><span>Tipo</span><div className="mt-tipos">{TIPOS_TREINO.map(x => <button key={x} className={tipo === x ? 'on' : ''} aria-pressed={tipo === x} onClick={() => setTipo(x)}>{x}</button>)}</div></div>
        </section>

        <div className="mt-linha-tempo">
          <Bloco cor="#1f9d5c" titulo="Aquecimento" sub={comAq ? trechoTxt(aq) : 'sem aquecimento'} ligado={comAq} ligar={setComAq}>
            <Duracao t={aq} mudar={setAq} meds={['min', 'km']} />
            <CampoRitmo r={aq.ritmo} mudar={r => setAq({ ...aq, ritmo: r })} />
          </Bloco>

          <Bloco cor="#1d3fbf" titulo="Parte principal" sub={pm === 'series' ? `${n} × ${trechoTxt(esf)}` : trechoTxt(corrida)}>
            <div className="mt-seg largo" role="radiogroup" aria-label="Formato"><button role="radio" aria-checked={pm === 'series'} className={pm === 'series' ? 'on' : ''} onClick={() => setPm('series')}>Séries (tiros)</button><button role="radio" aria-checked={pm === 'continuo'} className={pm === 'continuo' ? 'on' : ''} onClick={() => setPm('continuo')}>Contínuo</button></div>
            {pm === 'continuo' ? <>
              <Duracao t={corrida} mudar={setCorrida} />
              <CampoRitmo r={corrida.ritmo} mudar={r => setCorrida({ ...corrida, ritmo: r })} />
            </> : <>
              <div className="mt-linha"><span className="mt-rot">Repetições</span>
                <div className="mt-contador"><button onClick={() => setN(v => Math.max(1, v - 1))} aria-label="Menos uma"><Minus size={18} aria-hidden="true" /></button><b>{n}×</b><button onClick={() => setN(v => Math.min(50, v + 1))} aria-label="Mais uma"><Plus size={18} aria-hidden="true" /></button></div></div>
              <div className="mt-sub"><p className="mt-sub-t">Cada tiro</p>
                <Duracao t={esf} mudar={setEsf} />
                <CampoRitmo r={esf.ritmo} mudar={r => setEsf({ ...esf, ritmo: r })} />
              </div>
              <div className="mt-sub rec"><p className="mt-sub-t">Recuperação entre os tiros</p>
                <Duracao t={rec} mudar={setRec} meds={['min', 'm']} />
                <div className="mt-linha"><span className="mt-rot">Como</span>
                  <div className="mt-seg" role="radiogroup" aria-label="Jeito da recuperação">{(['trote', 'caminhada', 'parado'] as const).map(j => <button key={j} role="radio" aria-checked={(rec.jeito ?? 'trote') === j} className={(rec.jeito ?? 'trote') === j ? 'on' : ''} onClick={() => setRec({ ...rec, jeito: j })}>{j === 'trote' ? 'Trotando' : j === 'caminhada' ? 'Caminhando' : 'Parado'}</button>)}</div></div>
              </div>
            </>}
          </Bloco>

          <Bloco cor="#1f9d5c" titulo="Desaquecimento" sub={comDq ? trechoTxt(dq) : 'sem desaquecimento'} ligado={comDq} ligar={setComDq}>
            <Duracao t={dq} mudar={setDq} meds={['min', 'km']} />
            <CampoRitmo r={dq.ritmo} mudar={r => setDq({ ...dq, ritmo: r })} />
          </Bloco>
        </div>

        <label className="mt-campo mt-cartao"><span>Recado do treinador <em>(opcional)</em></span><textarea rows={2} value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex.: soltar os braços no fim dos tiros" maxLength={200} /></label>

        <div className="mt-resumo"><small>Resumo</small><span>{resumoTreino(rascunho)}</span></div>
        {erro && <p className="ct-erro" role="alert">{erro}</p>}
        <div className="mt-pe">
          <button className="btn solid" onClick={enviar}><Check size={18} aria-hidden="true" />Salvar treino</button>
          {t && <button className="btn text pro-grav-apagar" onClick={() => apagar(t.id)}><Trash2 size={16} aria-hidden="true" />Apagar este treino</button>}
        </div>
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
  const [verMapa, setVerMapa] = useState(() => ler<boolean>('radar-gravar-mapa', true));
  const trocarMapa = () => { const v = !verMapa; setVerMapa(v); gravarLocal('radar-gravar-mapa', v); };
  const etapas = useMemo(() => etapasDe(s0.treino), [s0.treino]);
  const ult = useRef<{ p: [number, number]; t: number } | null>(null);
  const janela = useRef<{ t: number; d: number }[]>([]);
  const ultT = useRef<number | null>(null);
  const avisoRitmo = useRef<{ qual: string | null; t: number }>({ qual: null, t: 0 });
  const salvar = () => { s.current.salvoEm = Date.now(); gravarLocal(CHAVE_SESSAO, s.current); };

  const anunciarEtapa = (i: number) => { const e = etapas[i]; if (!e) return; bipe(2); falar(`${nomeEtapa(e)}. ${alvoTxt(e).replace(',', ' vírgula ').replace(/ km$/, ' quilômetros').replace(/ m$/, ' metros').replace(/ min$/, ' minutos')}.${e.k === 'rec' && e.jeito ? ` ${JEITO[e.jeito]}.` : ritmoFala(e.ritmo, s0.modo === 'esteira')}`); avisoRitmo.current = { qual: null, t: movDe(s.current) }; };
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
  // no ritmo? (só na rua e com pace alvo; espera 20 s de etapa pra estabilizar)
  const noRitmo = st.modo === 'rua' && e?.ritmo?.modo === 'pace' && pAtual > 0 && t - st.etapaIni.t > 20 ? (pAtual < e.ritmo.de - 5 ? 'rapido' : pAtual > e.ritmo.ate + 5 ? 'lento' : 'ok') : null;
  if (noRitmo && noRitmo !== 'ok' && st.estado === 'correndo' && (avisoRitmo.current.qual !== noRitmo || t - avisoRitmo.current.t > 60) && t - avisoRitmo.current.t > 25) {
    avisoRitmo.current = { qual: noRitmo, t }; falar(noRitmo === 'rapido' ? 'Rápido demais. Segure um pouco.' : 'Abaixo do ritmo. Acelere.');
  }
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
          <small className={sinal === 'ok' ? 'ok' : sinal === 'fraco' || sinal === 'negado' ? 'ruim' : ''}>{st.modo === 'esteira' ? 'Esteira' : sinal === 'ok' ? '● GPS bom' : sinal === 'fraco' ? '● GPS fraco' : sinal === 'negado' ? 'GPS bloqueado: libere a localização' : 'Procurando GPS…'}</small></span>
        <span className="pro-gravando-bts">{st.modo === 'rua' && <button className="pro-gravando-voz" onClick={trocarMapa} aria-label={verMapa ? 'Esconder o mapa' : 'Mostrar o mapa'} title={verMapa ? 'Esconder o mapa' : 'Mostrar o mapa'}>{verMapa ? <EyeOff size={19} /> : <IcMapa size={19} />}</button>}
        <button className="pro-gravando-voz" onClick={() => { vozLigada = !vozLigada; setVoz(vozLigada); if (!vozLigada) speechSynthesis?.cancel?.(); }} aria-label={voz ? 'Desligar voz' : 'Ligar voz'}>{voz ? <Volume2 size={20} /> : <VolumeX size={20} />}</button></span>
      </div>

      {st.modo === 'rua' && verMapa && <MapaCorrida rota={st.rota} eu={ult.current?.p ?? null} aoVivo />}

      {e ? <div className={'pro-gravando-etapa e-' + e.k}>
        <span>{nomeEtapa(e)} · etapa {st.etapa + 1} de {etapas.length}</span>
        <b>{e.t ? fmtT(falta) : falta >= 1000 ? `${fmtKm(falta)} km` : `${Math.max(0, Math.round(falta))} m`}<small> faltando</small></b>
        {(e.ritmo && e.ritmo.modo !== 'livre') || (e.k === 'rec' && e.jeito) ? <span className="pro-gravando-alvo">{e.k === 'rec' && e.jeito ? `Recupere ${JEITO[e.jeito]}` : `Alvo: ${ritmoTxt(e.ritmo, st.modo === 'esteira')}`}{noRitmo && <em className={'r-' + noRitmo}>{noRitmo === 'ok' ? 'No ritmo' : noRitmo === 'rapido' ? 'Rápido demais' : 'Acelere'}</em>}</span> : null}
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
    if (error) return setErro(error.message.includes('Pro') ? 'Treino do treinador é do Radar Pro.' : error.message.includes('Limite') ? 'No modo grátis dá pra salvar até 3 corridas por dia.' : error.message.includes('perfil') ? 'Complete o seu perfil antes de salvar.' : 'Não deu pra salvar agora. Confira a internet e tente de novo: a corrida continua guardada no aparelho.');
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
