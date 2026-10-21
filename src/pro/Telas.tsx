// Telas do Radar Pro para quem assina: temporada, "Eu corri!", ranking, duelos, conta e administração.
import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, MessageCircle, Download, Trash2, LogOut, Share2, Copy, Flag, Pencil, Image as ImageIcon, Crown, ExternalLink, Smartphone, CalendarPlus, Check, Clock, X as Fechar } from 'lucide-react';
import { sb, chamar, LIGAS, MEDALHAS, STATUS, relogio, pct, kmTxt, dataBR, zapLimpo, zapMascara, edicoesRestantes, type Perfil, type Resultado, type Temporada, type Liga } from './sb';
import { lerTempo, mascaraTempo } from '../CardTreino';
import { whatsappLink } from '../lib';
import TAB from '../idade-tabela.json';
import { Assinar, NOMES_CIDADES } from './Pro';
import { GRUPOS, medalhaSVG, type Medalha } from './medalhas';
import CardResultado from './CardResultado';
import CardDuelo, { type FimDuelo } from './CardDuelo';

const ANO = new Date().getFullYear();
const ehValido = (r: Resultado) => r.status === 'verificado' || r.status === 'aprovado';

const SeloLiga = ({ liga }: { liga: Liga | null }) => liga
  ? <span className={`pro-liga l-${liga}`}>◆ Liga {LIGAS.find(l => l.id === liga)!.nome}</span>
  : <span className="pro-liga l-sem">Sem liga ainda</span>;

const SeloStatus = ({ r }: { r: Resultado }) => <span className={`pro-st ${STATUS[r.status].cls}`} title={STATUS[r.status].dica}>{STATUS[r.status].txt}</span>;

const msgComprovante = (p: Perfil, r: { prova_nome: string; prova_data: string; distancia_km: number; tempo_s: number }) =>
  whatsappLink(`Comprovante Radar Pro\nApelido: @${p.apelido}\nNome na inscrição: ${p.nome_completo}\nProva: ${r.prova_nome} (${dataBR(r.prova_data)})\nDistância: ${kmTxt(Number(r.distancia_km))}\nTempo: ${relogio(r.tempo_s)}\n\nSegue o print ou link do resultado:`);

/* ───────── Rei e Rainha da prova ───────── */
type ReiLinha = { prova_id: string; prova_nome: string | null; prova_data: string | null; cidade: string | null; distancia_km: number; sexo: 'F' | 'M'; nome: string; idade: number | null; tempo_s: number; nota: number; user_id: string | null; atletas: number | null; apelido?: string | null };
const titulo = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, x => x.toUpperCase()).replace(/ (De|Da|Do|Das|Dos|E) /g, m => m.toLowerCase());
function Reis() {
  const [lista, setLista] = useState<ReiLinha[] | null>(null);
  useEffect(() => {
    sb.from('radar_reis').select('*').order('prova_data', { ascending: false }).limit(200).then(async ({ data }) => {
      const l = (data ?? []) as ReiLinha[];
      const ids = [...new Set(l.map(x => x.user_id).filter(Boolean))] as string[];
      if (ids.length) { const { data: a } = await sb.rpc('radar_apelidos', { ids }); const m = new Map(((a ?? []) as { user_id: string; apelido: string }[]).map(x => [x.user_id, x.apelido])); l.forEach(x => { x.apelido = x.user_id ? m.get(x.user_id) ?? null : null; }); }
      setLista(l);
    });
  }, []);
  const provas = useMemo(() => { const m = new Map<string, ReiLinha[]>(); for (const x of lista ?? []) { if (!m.has(x.prova_id)) m.set(x.prova_id, []); m.get(x.prova_id)!.push(x); } return [...m.values()]; }, [lista]);
  return (
    <>
      <p className="fine pro-sem-margem">A melhor <b>nota por idade</b> de cada prova, entre todos que correram (não só quem assina o Radar). Um atleta de 60 anos pode ser o Rei da prova.</p>
      {lista === null && <p className="fine">Carregando…</p>}
      {lista?.length === 0 && <p className="fine">Ainda sem provas com resultado oficial e idade dos atletas.</p>}
      {provas.map(ps => (
        <section key={ps[0].prova_id} className="pro-card pro-reis">
          <p className="pro-k cinza">{ps[0].prova_data ? dataBR(ps[0].prova_data) : ''} · {ps[0].cidade}</p>
          <b className="pro-reis-prova">{ps[0].prova_nome}</b>
          {[...ps].sort((a, b) => Number(a.distancia_km) - Number(b.distancia_km) || a.sexo.localeCompare(b.sexo)).map(x => (
            <div key={x.distancia_km + x.sexo} className="pro-rei">
              <span className={'pro-coroa ' + (x.sexo === 'F' ? 'f' : 'm')}><Crown size={18} aria-hidden="true" /></span>
              <div>
                <small>{x.sexo === 'F' ? 'Rainha' : 'Rei'} · {kmTxt(Number(x.distancia_km))}{x.atletas ? ` · ${x.atletas} atletas` : ''}</small>
                <p className="pro-sem-margem"><b>{x.apelido ? <a href={linkPerfil(x.apelido)}>@{x.apelido}</a> : titulo(x.nome)}</b>{x.idade ? `, ${x.idade} anos` : ''}</p>
              </div>
              <div className="pro-dir"><b>{pct(x.nota)}%</b><small>{relogio(x.tempo_s)}</small></div>
            </div>
          ))}
        </section>
      ))}
    </>
  );
}

/* ───────── Perfil público ───────── */
export const linkPerfil = (apelido: string) => `https://radarcorridasma.com.br/?atleta=${apelido}`;
function LinkPerfil({ perfil }: { perfil: Perfil }) {
  const [copiado, setCopiado] = useState(false);
  if (perfil.publico === false) return null;
  const link = linkPerfil(perfil.apelido);
  const copiar = async () => { try { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* */ } };
  return (
    <section className="pro-card pro-linkperfil">
      <div><p className="pro-k cinza">Seu perfil público</p><p className="pro-sem-margem"><b>radarcorridasma.com.br/?atleta={perfil.apelido}</b></p><p className="fine pro-sem-margem">Ponha na bio do Instagram: mostra suas medalhas, provas e liga.</p></div>
      <div className="pro-linha pro-quebra">
        <button className="btn outline pro-btn-p" onClick={copiar}><Copy size={16} aria-hidden="true" />{copiado ? 'Copiado!' : 'Copiar link'}</button>
        <a className="btn text pro-btn-p" href={link} target="_blank" rel="noopener"><ExternalLink size={16} aria-hidden="true" />Ver</a>
      </div>
    </section>
  );
}

/* ───────── Medalhas ───────── */
function Desenho({ m, ok = true, tam = 72 }: { m: Medalha; ok?: boolean; tam?: number }) {
  const svg = useMemo(() => medalhaSVG(m, ok, tam), [m, ok, tam]);
  return <span className="pro-med-svg" dangerouslySetInnerHTML={{ __html: svg }} />;
}
function Medalhas({ meds }: { meds: string[] }) {
  const [todas, setTodas] = useState(false);
  const tem = new Set(meds);
  const ganhas = MEDALHAS.filter(m => tem.has(m.id));
  const total = MEDALHAS.length;
  return (
    <section className="pro-card">
      <div className="pro-linha"><p className="pro-k cinza">Minhas medalhas</p><b>{ganhas.length} / {total}</b></div>
      <div className="pro-med-barra" aria-hidden="true"><i style={{ width: `${Math.max(2, (ganhas.length / total) * 100)}%` }} /></div>
      {ganhas.length
        ? <div className="pro-med">{ganhas.map(m => <div key={m.id} className="pro-med-item"><Desenho m={m} /><b>{m.nome}</b></div>)}</div>
        : <p className="fine pro-sem-margem">Registre a sua primeira prova para ganhar a primeira medalha.</p>}
      <button className="btn outline pro-btn" aria-expanded={todas} onClick={() => setTodas(!todas)}>{todas ? 'Esconder a coleção' : `Ver todas as ${total} medalhas`}</button>
      {todas && GRUPOS.map(g => (
        <div key={g.nome} className="pro-med-grupo">
          <p className="pro-k cinza">{g.nome} <small>{g.itens.filter(m => tem.has(m.id)).length}/{g.itens.length}</small></p>
          <div className="pro-med">{g.itens.map(m => { const ok = tem.has(m.id); return (
            <div key={m.id} className={'pro-med-item' + (ok ? '' : ' off')}><Desenho m={m} ok={ok} /><b>{m.nome}</b>{!ok && <small>{m.como}</small>}</div>
          ); })}</div>
        </div>
      ))}
    </section>
  );
}

/* ───────── 3 · Minha temporada ───────── */
export function TelaTemporada({ perfil, temp, irCorri }: { perfil: Perfil; temp: Temporada; irCorri: () => void }) {
  const [res, setRes] = useState<Resultado[] | null>(null);
  const [card, setCard] = useState<string | null>(null);
  const [meds, setMeds] = useState<string[]>([]);
  useEffect(() => {
    // medalhas de provas recusadas não contam
    Promise.all([sb.from('radar_resultados').select('*').order('prova_data', { ascending: false }), sb.from('radar_medalhas').select('medalha, temporada, resultado_id')]).then(([r, m]) => {
      const lista = (r.data ?? []) as Resultado[]; setRes(lista);
      const recusados = new Set(lista.filter(x => x.status === 'recusado').map(x => x.id));
      setMeds((m.data ?? []).filter(x => !recusados.has(x.resultado_id)).map(x => x.medalha));
    });
  }, []);
  const liga = temp.liga, i = LIGAS.findIndex(l => l.id === liga), prox = LIGAS[i + 1];
  const evolucao = useMemo(() => (res ?? []).filter(ehValido).slice().reverse().map(r => Number(r.nota)), [res]);

  return (
    <div className="pro-cont">
      <section className="pro-card azul">
        <div className="pro-linha"><p className="pro-k">Seu índice</p><SeloLiga liga={liga} /></div>
        <p className="pro-big">{temp.indice == null ? '–' : pct(temp.indice)}</p>
        <div className="pro-trilha" aria-hidden="true">{LIGAS.map((l, k) => <span key={l.id} className={i >= k ? 'on' : ''} />)}</div>
        <div className="pro-trilha-nomes" aria-hidden="true">{LIGAS.map(l => <span key={l.id}>{l.nome}</span>)}</div>
        <p className="pro-sub">{temp.indice == null
          ? 'Sua liga aparece quando você tiver uma prova com resultado oficial (verificado).'
          : prox ? <>Faltam <b>{pct(prox.min - Number(temp.indice))} pontos de índice</b> para a liga {prox.nome}.</> : <>Você está na liga mais alta. Segure o nível!</>}</p>
      </section>

      <div className="pro-mini">
        <div><b>{temp.pontos}</b><small>pontos</small></div>
        <div><b>{temp.provas}</b><small>provas</small></div>
        <div><b>{temp.cidades}</b><small>cidades</small></div>
        <div><b>{temp.posicao_ma ? `${temp.posicao_ma}º` : '–'}</b><small>no Maranhão</small></div>
      </div>
      {temp.pontos_pendentes > 0 && <p className="fine pro-sem-margem">+{temp.pontos_pendentes} pontos esperando o resultado oficial ou o comprovante.</p>}

      <button className="btn solid pro-btn" onClick={irCorri}><Plus size={18} aria-hidden="true" />Eu corri uma prova</button>
      <LinkPerfil perfil={perfil} />

      {evolucao.length >= 2 && (
        <section className="pro-card"><p className="pro-k cinza">Sua evolução (nota por idade)</p><Grafico v={evolucao} /></section>
      )}

      <Medalhas meds={meds} />

      <section className="pro-card">
        <p className="pro-k cinza">Minhas provas</p>
        {res === null && <p className="fine">Carregando…</p>}
        {res?.length === 0 && <p className="fine">Nenhuma prova ainda. Toque em “Eu corri uma prova”.</p>}
        <ul className="pro-provas">
          {res?.map(r => (
            <li key={r.id}>
              <div className="pro-linha"><b>{r.prova_nome}</b><SeloStatus r={r} /></div>
              <p>{dataBR(r.prova_data)} · {r.cidade} · {kmTxt(Number(r.distancia_km))} · <b>{relogio(r.tempo_s)}</b> · nota {pct(r.nota)}% · {r.pontos} pts{r.podio ? ' · 🥇 pódio' : ''}</p>
              {r.colocacao_geral ? <p className="fine pro-sem-margem">{r.colocacao_geral}º no geral{r.total_dist ? ` de ${r.total_dist}` : ''}{r.colocacao_faixa ? ` · ${r.colocacao_faixa}º na faixa` : ''}</p> : null}
              {r.motivo_analise && <p className="fine pro-sem-margem">{r.motivo_analise}</p>}
              <div className="pro-linha pro-quebra pro-esq">
                {r.status !== 'recusado' && <button className="btn outline pro-btn-p" onClick={() => setCard(card === r.id ? null : r.id)}><ImageIcon size={16} aria-hidden="true" />Card pro story</button>}
                {(r.status === 'declarado' || r.status === 'em_analise') && <a className="btn whats pro-btn-p" href={msgComprovante(perfil, r)} target="_blank" rel="noopener"><MessageCircle size={16} aria-hidden="true" />Enviar comprovante</a>}
              </div>
              {card === r.id && <CardResultado r={r} apelido={perfil.apelido} fechar={() => setCard(null)} />}
            </li>
          ))}
        </ul>
      </section>

      <section className="pro-card">
        <p className="pro-k cinza">As ligas</p>
        <div className="pro-ligas">{LIGAS.map(l => <div key={l.id}><SeloLiga liga={l.id} /><span>{l.max == null ? `${pct(l.min)} ou mais` : l.min === 0 ? `até ${pct(l.max)}` : `${pct(l.min)} a ${pct(l.max)}`}{l.id === liga ? <b> · você</b> : null}</span></div>)}</div>
        <p className="fine">Índice = média das suas 3 melhores notas por idade em provas verificadas dos últimos 12 meses. Provas “declaradas” contam na sua temporada, mas não no ranking.</p>
      </section>
    </div>
  );
}

function Grafico({ v }: { v: number[] }) {
  const min = Math.min(...v) - 2, max = Math.max(...v) + 2, W = 320, H = 70;
  const pts = v.map((n, k) => [v.length === 1 ? W : (k / (v.length - 1)) * W, H - 6 - ((n - min) / (max - min || 1)) * (H - 12)]);
  const d = pts.map((p, k) => `${k ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const u = pts[pts.length - 1];
  return (
    <svg className="pro-graf" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Notas de ${pct(v[0])}% a ${pct(v[v.length - 1])}%`}>
      <path d={`${d} L${W} ${H} L0 ${H}Z`} className="area" /><path d={d} className="linha" /><circle cx={u[0]} cy={u[1]} r="5" className="ponto" />
    </svg>
  );
}

/* ───────── 4 · Eu corri! ───────── */
type Prova = { id: string; nome: string; data: string; cidade: string; distancias: number[]; largada: string | null };
type T = { idadeMin: number; dist: number[]; oc: number[]; f: number[][] };
function notaIdade(sexo: 'F' | 'M', km: number, idade: number, seg: number) {
  const t = (TAB as Record<string, T>)[sexo], d = t.dist, a = Math.min(100, Math.max(t.idadeMin, Math.round(idade))) - t.idadeMin;
  let oc: number, f: number;
  if (km <= d[0]) { oc = t.oc[0] * km / d[0]; f = t.f[0][a]; }
  else if (km >= d[d.length - 1]) { const i = d.length - 1; oc = t.oc[i] * km / d[i]; f = t.f[i][a]; }
  else { const i = d.findIndex(x => x >= km); if (Math.abs(d[i] - km) < 0.01) { oc = t.oc[i]; f = t.f[i][a]; } else { const j = i - 1, p = Math.log(km / d[j]) / Math.log(d[i] / d[j]); oc = Math.exp(Math.log(t.oc[j]) + p * (Math.log(t.oc[i]) - Math.log(t.oc[j]))); f = t.f[j][a] + p * (t.f[i][a] - t.f[j][a]); } }
  return (oc / f) / seg * 100;
}
const real = (k: number) => (Math.abs(k - 21) < 0.2 ? 21.0975 : Math.abs(k - 42) < 0.3 ? 42.195 : k);
const idadeEm = (nasc: string, dia: string) => { const n = new Date(nasc + 'T12:00:00Z'), d = new Date(dia + 'T12:00:00Z'); let a = d.getUTCFullYear() - n.getUTCFullYear(); if (d.getUTCMonth() < n.getUTCMonth() || (d.getUTCMonth() === n.getUTCMonth() && d.getUTCDate() < n.getUTCDate())) a--; return a; };
const PONTOS_TXT: Record<string, string> = { concluir: 'por concluir', dez_km: 'do 10 km', meia: 'da meia', maratona: 'da maratona', recorde_pessoal: 'do recorde', cidade_nova: 'da cidade nova', podio: 'do pódio' };

type Resposta = { nota: number; pontos: number; detalhes: Record<string, number>; status: Resultado['status']; motivo: string | null; medalhas_novas: string[]; liga: Liga | null; subiu_de_liga: boolean; oficial: boolean; link_lido?: boolean; resultado: Resultado };

/* ───────── Prova que não está na agenda: o atleta pede, o Vinik aprova ───────── */
type Sugestao = { id: string; nome: string; data: string; cidade: string; distancia_km: number; link: string | null; obs: string | null; status: 'pendente' | 'aprovada' | 'recusada'; prova_id: string | null; resposta: string | null; criado_em: string };
const INICIO = '2026-10-15';
const hojeBR = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
function PedirProva({ fechar, enviado }: { fechar: () => void; enviado: (r: Resposta & { pedido?: boolean; motivo?: string }) => void }) {
  const [f, setF] = useState({ nome: '', data: '', cidade: '', link: '', obs: '' });
  const [km, setKm] = useState<number | null>(null);
  const [outra, setOutra] = useState('');
  const [peito, setPeito] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [indo, setIndo] = useState(false);
  const muda = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const dist = km ?? (Number(outra.replace(',', '.')) || null);
  const enviar = async () => {
    setErro(null);
    if (f.nome.trim().length < 5) return setErro('Escreva o nome da prova.');
    if (!f.data) return setErro('Escolha a data da prova.');
    if (f.data < INICIO) return setErro('A temporada 2026 conta só as provas a partir de 15/10/2026.');
    if (f.cidade.trim().length < 3) return setErro('Diga a cidade.');
    if (!dist) return setErro('Escolha a distância que você correu.');
    setIndo(true);
    const r = await chamar<Resposta & { pedido?: boolean; motivo?: string }>('radar-registrar', { nova_prova: { nome: f.nome, data: f.data, cidade: f.cidade, obs: f.obs }, distancia_km: dist, link_resultado: f.link || undefined, peito: peito || undefined });
    setIndo(false);
    if (r.erro) return setErro(r.erro);
    enviado(r);
  };
  return (
    <section className="pro-card pro-pedir">
      <div className="pro-linha"><p className="pro-k cinza"><CalendarPlus size={14} aria-hidden="true" /> Pedir uma prova</p><button className="btn text" onClick={fechar} aria-label="Fechar"><Fechar size={18} aria-hidden="true" /></button></div>
      <p className="fine pro-sem-margem"><b>Com o link do resultado, é na hora:</b> o Radar lê o link, acha você e já registra a prova com o tempo oficial. Sem o link, o pedido vai para conferência.</p>
      <label className="ct-cidade">Nome da prova<input value={f.nome} onChange={muda('nome')} placeholder="Ex.: Corrida do Sol 2026" maxLength={120} /></label>
      <label className="ct-cidade">Data<input type="date" min={INICIO} max={hojeBR()} value={f.data} onChange={muda('data')} /></label>
      <label className="ct-cidade">Cidade<input list="pro-cidades-pedir" value={f.cidade} onChange={muda('cidade')} /><datalist id="pro-cidades-pedir">{NOMES_CIDADES.map(c => <option key={c} value={c} />)}</datalist></label>
      <p className="ct-cidade pro-sem-margem">Distância que você correu</p>
      <div className="chips" role="group" aria-label="Distância">{[3, 5, 7, 10, 15, 21, 42].map(d => <button key={d} className="chip" aria-pressed={km === d} onClick={() => { setKm(km === d ? null : d); setOutra(''); }}>{d} km</button>)}</div>
      <label className="ct-cidade">Outra distância <small>(em km)</small><input inputMode="decimal" value={outra} onChange={e => { setOutra(e.target.value.replace(/[^\d.,]/g, '').slice(0, 6)); setKm(null); }} placeholder="Ex.: 8" /></label>
      <label className="ct-cidade">Link do resultado <small>(página da cronometragem)</small><input inputMode="url" value={f.link} onChange={e => setF({ ...f, link: e.target.value.trim() })} placeholder="cole aqui o link do resultado" /><small>Funciona na hora com SA Crono, RaceTag, Meta Sport e Crono Esportes.</small></label>
      {f.link && <label className="ct-cidade">Número de peito <small>(ajuda a achar você)</small><input inputMode="numeric" value={peito} onChange={e => setPeito(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="Ex.: 1234" /></label>}
      <label className="ct-cidade">Observação <small>(opcional)</small><input value={f.obs} onChange={muda('obs')} placeholder="Ex.: organizada pela assessoria X" maxLength={300} /></label>
      {erro && <p className="ct-erro" role="alert">{erro}</p>}
      <button className="btn solid pro-btn" disabled={indo} onClick={enviar}>{indo ? (f.link ? 'Lendo o resultado…' : 'Enviando…') : f.link ? 'Conferir e registrar' : 'Enviar pedido'}</button>
    </section>
  );
}

export function TelaEuCorri({ perfil, pronto, irTemporada }: { perfil: Perfil; pronto: () => void; irTemporada: () => void }) {
  const [provas, setProvas] = useState<Prova[] | null>(null);
  const [busca, setBusca] = useState('');
  const [prova, setProva] = useState<Prova | null>(null);
  const [km, setKm] = useState<number | null>(null);
  const [tempo, setTempo] = useState('');
  const [peito, setPeito] = useState('');
  const [outroNome, setOutroNome] = useState('');
  const [link, setLink] = useState('');
  const [mais, setMais] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState<Resposta | null>(null);

  useEffect(() => { chamar<{ provas: Prova[] }>('radar-provas').then(r => setProvas(r.provas ?? [])); }, []);
  const [pedir, setPedir] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [sugs, setSugs] = useState<Sugestao[]>([]);
  const [jaFeitas, setJaFeitas] = useState<Set<string>>(new Set());
  const carregarSugs = () => {
    sb.from('radar_sugestoes_provas').select('*').order('criado_em', { ascending: false }).limit(10).then(({ data }) => setSugs((data as Sugestao[]) ?? []));
    sb.from('radar_resultados').select('prova_id').eq('user_id', perfil.user_id).then(({ data }) => setJaFeitas(new Set((data ?? []).map(x => x.prova_id as string))));
  };
  useEffect(carregarSugs, [perfil.user_id]);
  const visiveis = sugs.filter(x => x.status === 'pendente' || (x.status === 'aprovada' && x.prova_id && !jaFeitas.has(x.prova_id)) || (x.status === 'recusada' && Date.now() - new Date(x.criado_em).getTime() < 15 * 86400_000));
  const registrarSug = (x: Sugestao) => {
    const p = provas?.find(y => y.id === x.prova_id) ?? { id: x.prova_id!, nome: x.nome, data: x.data, cidade: x.cidade, distancias: [Number(x.distancia_km)], largada: null };
    setProva(p); setKm(Number(x.distancia_km)); if (x.link) setLink(x.link); setPedir(false); window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const lista = useMemo(() => (provas ?? []).filter(p => !busca || norm(`${p.nome} ${p.cidade}`).includes(norm(busca))).slice(0, 30), [provas, busca]);
  const seg = lerTempo(tempo);
  const previa = prova && km && seg ? notaIdade(perfil.sexo, real(km), idadeEm(perfil.nascimento, prova.data), seg) : null;

  const enviar = async () => {
    if (!prova || !km) return;
    setErro(null); setEnviando(true);
    const r = await chamar<Resposta>('radar-registrar', { prova_id: prova.id, distancia_km: km, tempo_s: seg ?? undefined, peito: peito || undefined, nome_inscricao: outroNome || undefined, link_resultado: link || undefined });
    setEnviando(false);
    if (r.erro) return setErro(r.erro);
    setFeito(r); pronto(); carregarSugs();
  };

  if (feito) {
    const r = feito.resultado;
    return (
      <div className="pro-cont">
        <section className="pro-card azul pro-centro">
          <p className="pro-k">Sua nota por idade</p>
          <p className="pro-big">{pct(feito.nota)}%</p>
          <div className="pro-tags"><span className="pro-liga l-ouro">+ {feito.pontos} pontos</span>{feito.detalhes.recorde_pessoal ? <span className="pro-liga l-verde">Recorde pessoal</span> : null}{feito.subiu_de_liga && <span className="pro-liga l-verde">Subiu de liga!</span>}</div>
          <p className="pro-sub">{Object.entries(feito.detalhes).map(([k, v]) => `${v} ${PONTOS_TXT[k] ?? k}`).join(' + ')}</p>
        </section>
        <section className="pro-card">
          <div className="pro-linha"><b>{r.prova_nome}</b><SeloStatus r={r} /></div>
          <p className="fine pro-sem-margem">{kmTxt(Number(r.distancia_km))} · {relogio(r.tempo_s)} · {STATUS[r.status].dica}</p>
          {feito.oficial && feito.link_lido && <p className="fine pro-sem-margem">O Radar leu o link e achou você no resultado oficial.</p>}
          {feito.motivo && <p className="fine pro-sem-margem">{feito.motivo}</p>}
        </section>
        {[...new Set(feito.medalhas_novas)].map(m => { const x = MEDALHAS.find(y => y.id === m); return x ? <section key={m} className="pro-card pro-nova"><Desenho m={x} tam={76} /><div><span className="pro-k">Nova medalha!</span><b>{x.nome}</b><p className="pro-sem-margem">{x.como}</p></div></section> : null; })}
        {!feito.oficial && <a className="btn whats pro-btn" href={msgComprovante(perfil, r)} target="_blank" rel="noopener"><MessageCircle size={18} aria-hidden="true" />Enviar comprovante pelo WhatsApp</a>}
        {!feito.oficial && <p className="fine pro-sem-margem">Quando a cronometragem publicar o resultado, o Radar confere sozinho e muda para “Verificado”.</p>}
        <CardResultado r={r} apelido={perfil.apelido} fechar={() => { /* fica aberto */ }} />
        <button className="btn solid pro-btn" onClick={irTemporada}>Ver minha temporada</button>
        <button className="btn outline pro-btn" onClick={() => { setFeito(null); setProva(null); setKm(null); setTempo(''); setPeito(''); setLink(''); setOutroNome(''); }}>Registrar outra prova</button>
      </div>
    );
  }

  return (
    <div className="pro-cont">
      <p className="euvou-pergunta">1. Qual prova?</p>
      {prova ? (
        <div className="pro-card pro-escolhida"><div><b>{prova.nome}</b><p className="fine pro-sem-margem">{dataBR(prova.data)} · {prova.cidade}</p></div><button className="btn text" onClick={() => { setProva(null); setKm(null); }}>Trocar</button></div>
      ) : (
        <>
          <label className="pro-busca"><Search size={18} aria-hidden="true" /><input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nome da prova ou cidade" aria-label="Buscar prova" /></label>
          {provas === null && <p className="fine">Carregando provas…</p>}
          <ul className="pro-escolha">
            {lista.map(p => <li key={p.id}><button onClick={() => { setProva(p); setKm(p.distancias.length === 1 ? Number(p.distancias[0]) : null); }}><b>{p.nome}</b><span>{dataBR(p.data)} · {p.cidade}</span></button></li>)}
          </ul>
          {provas && !lista.length && <p className="fine">Nenhuma prova encontrada. Valem as provas da agenda do Radar que já aconteceram, a partir de 15/10/2026.</p>}
          {aviso && <p className="pro-aviso" role="status">{aviso}</p>}
          {visiveis.length > 0 && (
            <section className="pro-card">
              <p className="pro-k cinza">Provas que você pediu</p>
              <ul className="pro-pedidas">
                {visiveis.map(x => (
                  <li key={x.id}>
                    <div><b>{x.nome}</b><small>{dataBR(x.data)} · {x.cidade} · {kmTxt(Number(x.distancia_km))}</small>{x.resposta && <small>Radar: {x.resposta}</small>}</div>
                    {x.status === 'pendente' && <span className="pro-st ana"><Clock size={12} aria-hidden="true" /> Esperando</span>}
                    {x.status === 'aprovada' && <button className="btn solid" onClick={() => registrarSug(x)}><Check size={16} aria-hidden="true" />Registrar</button>}
                    {x.status === 'recusada' && <span className="pro-st rec">Não aprovada</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {pedir
            ? <PedirProva fechar={() => setPedir(false)} enviado={r => { setPedir(false); carregarSugs(); if (r.resultado) { setFeito(r); pronto(); window.scrollTo({ top: 0 }); return; } setAviso(r.motivo === 'Link não lido automaticamente' ? 'Esse link o Radar ainda não lê sozinho. O pedido foi para conferência e, quando aprovar, a prova aparece aqui para você registrar.' : r.motivo ? 'O Radar leu o link mas não achou o seu nome. O pedido foi para conferência; quando aprovar, a prova aparece aqui.' : 'Pedido enviado! Quando o Radar aprovar, a prova aparece aqui para você registrar.'); }} />
            : <button className="btn outline pro-btn" onClick={() => { setPedir(true); setAviso(null); }}><CalendarPlus size={18} aria-hidden="true" />Minha prova não está aqui</button>}
        </>
      )}

      {prova && <>
        <p className="euvou-pergunta">2. Distância</p>
        <div className="chips" role="group" aria-label="Distância">{prova.distancias.map(d => <button key={d} className="chip" aria-pressed={km === Number(d)} onClick={() => setKm(Number(d))}>{kmTxt(real(Number(d)))}</button>)}</div>
        <label className="ct-cidade">3. Link do resultado <small>(página da cronometragem)</small><input inputMode="url" value={link} onChange={e => setLink(e.target.value.trim())} placeholder="cole aqui o link do resultado" /><small>O Radar lê na hora e pega o seu tempo oficial. Funciona com SA Crono, RaceTag, Meta Sport e Crono Esportes.</small></label>
        <label className="ct-cidade">Número de peito <small>(ajuda a achar você no resultado)</small><input inputMode="numeric" value={peito} onChange={e => setPeito(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="Ex.: 1234" /></label>
        <label className="ct-cidade">Tempo líquido (do chip) <small>{link ? '(opcional com o link)' : ''}</small><input inputMode="numeric" value={tempo} onChange={e => setTempo(mascaraTempo(e.target.value))} placeholder="Ex.: 52:10" /><small>Se o resultado oficial já saiu, usamos o tempo de lá.</small></label>
        <button className="btn text pro-esq" aria-expanded={mais} onClick={() => setMais(!mais)}>{mais ? 'Menos opções' : 'Inscrito com outro nome?'}</button>
        {mais && <label className="ct-cidade">Nome usado na inscrição<input value={outroNome} onChange={e => setOutroNome(e.target.value)} placeholder={perfil.nome_completo} /><small>Pode ser diferente (apelido, nome abreviado), mas precisa ter pelo menos um nome do seu nome completo.</small></label>}
        {previa && <section className="pro-card azul pro-centro"><p className="pro-k">Prévia da nota por idade</p><p className="pro-big">{pct(previa)}%</p></section>}
        {erro && <p className="ct-erro" role="alert">{erro}</p>}
        <button className="btn solid pro-btn" disabled={!km || enviando} onClick={enviar}>{enviando ? (link ? 'Lendo o resultado…' : 'Conferindo no resultado oficial…') : 'Salvar na minha temporada'}</button>
        <p className="fine pro-sem-margem">Para valer no ranking, o tempo precisa estar no resultado oficial (o Radar confere sozinho) ou você envia o comprovante.</p>
      </>}
    </div>
  );
}

/* ───────── Ranking do Maranhão ───────── */
type Linha = { posicao: number; apelido: string; cidade?: string; liga?: Liga; faixa?: string; pontos?: number; provas?: number; indice?: number; eu?: boolean; assessoria?: string; atletas?: number; tamanho?: number };
const FAIXAS = ['até 19', '20-24', '25-29', '30-34', '35-39', '40-44', '45-49', '50-54', '55-59', '60+'];
type Rec = 'geral' | 'eficiencia' | 'assessorias' | 'pelotao' | 'reis';

export function TelaRanking({ perfil }: { perfil: Perfil }) {
  const [rec, setRec] = useState<Rec>('geral');
  const [sexo, setSexo] = useState<'' | 'F' | 'M'>('');
  const [cidade, setCidade] = useState('');
  const [faixa, setFaixa] = useState('');
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);

  useEffect(() => {
    setLinhas(null); setAberto(null);
    if (rec === 'reis') return;
    const q = rec === 'geral' ? sb.rpc('radar_ranking', { temporada: ANO, recorte_sexo: sexo || null, recorte_cidade: cidade || null, recorte_faixa: faixa || null })
      : rec === 'eficiencia' ? sb.rpc('radar_ranking_eficiencia', { temporada: ANO })
      : rec === 'assessorias' ? sb.rpc('radar_ranking_assessorias', { temporada: ANO })
      : sb.rpc('radar_pelotao', {});
    q.then(({ data }) => setLinhas((data ?? []) as Linha[]));
  }, [rec, sexo, cidade, faixa]);

  const eu = linhas?.find(l => l.eu);
  return (
    <div className="pro-cont">
      <div className="seg pro-seg" role="group" aria-label="Tipo de ranking">
        {([['geral', 'Pontos'], ['eficiencia', 'Eficiência'], ['reis', 'Reis 👑'], ['assessorias', 'Assessorias'], ['pelotao', 'Pelotão']] as [Rec, string][]).map(([k, n]) => <button key={k} aria-pressed={rec === k} onClick={() => setRec(k)}>{n}</button>)}
      </div>
      {rec === 'reis' ? <Reis /> : <>

      {rec === 'geral' && <>
        <div className="chips" role="group" aria-label="Recorte">
          <button className="chip" aria-pressed={!sexo} onClick={() => setSexo('')}>Todos</button>
          <button className="chip" aria-pressed={sexo === 'F'} onClick={() => setSexo('F')}>Feminino</button>
          <button className="chip" aria-pressed={sexo === 'M'} onClick={() => setSexo('M')}>Masculino</button>
          <button className="chip" aria-pressed={cidade === perfil.cidade} onClick={() => setCidade(cidade ? '' : perfil.cidade)}>{perfil.cidade}</button>
        </div>
        <label className="ct-cidade pro-sel">Faixa etária<select value={faixa} onChange={e => setFaixa(e.target.value)}><option value="">Todas</option>{FAIXAS.map(f => <option key={f} value={f}>{f} anos</option>)}</select></label>
      </>}
      {rec === 'pelotao' && eu && <section className="pro-card azul pro-linha"><div><p className="pro-k">Você está em</p><p className="pro-medio">{eu.posicao}º de {eu.tamanho}</p></div><p className="pro-sub pro-dir">Pelotão {LIGAS.find(l => l.id === eu.liga)?.nome ?? ''}<br />Top 3 do mês<br />ganha destaque 👑</p></section>}

      <p className="fine pro-sem-margem">{{
        geral: `Temporada ${ANO}: soma dos pontos de provas verificadas.`,
        eficiencia: 'Índice (nota por idade): compara atletas de idades e sexos diferentes de forma justa.',
        assessorias: 'Média dos pontos dos 5 melhores atletas de cada assessoria.',
        pelotao: 'Até 25 atletas da sua liga. Pontos do mês, recomeça todo dia 1º.',
        reis: '',
      }[rec]}</p>

      {linhas === null && <p className="fine">Carregando…</p>}
      {linhas?.length === 0 && <p className="fine">Ainda não há atletas com provas verificadas neste recorte.</p>}
      <ol className="pro-rank">
        {linhas?.map((l, k) => (
          <li key={k} className={l.eu ? 'eu' : ''}>
            <button disabled={rec === 'assessorias'} onClick={() => setAberto(aberto === l.apelido ? null : l.apelido)} aria-expanded={rec !== 'assessorias' ? aberto === l.apelido : undefined}>
              <b>{l.posicao}</b>
              <span>{rec === 'assessorias' ? <>{l.assessoria} <small>· {l.atletas} atletas</small></> : <>{l.eu ? <b>Você</b> : `@${l.apelido}`} <small>· {l.cidade}{l.faixa ? ` · ${l.faixa}` : ''}</small></>}</span>
              <b>{rec === 'eficiencia' ? `${pct(l.indice)}` : Math.round(Number(l.pontos ?? 0))}</b>
            </button>
            {aberto === l.apelido && rec !== 'assessorias' && <ProvasDe apelido={l.apelido} meu={!!l.eu} />}
          </li>
        ))}
      </ol>
      <p className="fine">No ranking aparecem só apelido, cidade e faixa etária. Viu algo estranho? Abra o atleta e toque em “Contestar”.</p>
      </>}
    </div>
  );
}

function ProvasDe({ apelido, meu }: { apelido: string; meu: boolean }) {
  const [lista, setLista] = useState<Resultado[] | null>(null);
  const [contesta, setContesta] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { sb.rpc('radar_resultados_de', { p_apelido: apelido, p_temporada: ANO }).then(({ data }) => setLista((data ?? []) as Resultado[])); }, [apelido]);
  const enviar = async (id: string) => {
    const r = await chamar('radar-acoes', { acao: 'contestar', resultado_id: id, motivo });
    setMsg(r.erro ?? `Contestação enviada (protocolo ${r.protocolo}). O Radar vai conferir.`); if (!r.erro) { setContesta(null); setMotivo(''); }
  };
  if (!lista) return <p className="fine pro-dentro">Carregando…</p>;
  return (
    <ul className="pro-provas pro-dentro">
      {lista.map(r => (
        <li key={r.id}>
          <div className="pro-linha"><b>{r.prova_nome}</b><SeloStatus r={r} /></div>
          <p>{dataBR(r.prova_data)} · {kmTxt(Number(r.distancia_km))} · {relogio(r.tempo_s)} · nota {pct(r.nota)}% · {r.pontos} pts</p>
          {!meu && contesta !== r.id && <button className="btn text pro-esq" onClick={() => { setContesta(r.id); setMsg(null); }}><Flag size={15} aria-hidden="true" />Contestar</button>}
          {contesta === r.id && (
            <div className="pro-form">
              <label className="ct-cidade">O que está errado?<textarea rows={2} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex.: o tempo não bate com o resultado oficial" /></label>
              <div className="pro-linha"><button className="btn solid" onClick={() => enviar(r.id)}>Enviar</button><a className="btn whats" href={whatsappLink(`Contestação Radar Pro\nAtleta: @${apelido}\nProva: ${r.prova_nome} (${dataBR(r.prova_data)}) · ${kmTxt(Number(r.distancia_km))} · ${relogio(r.tempo_s)}\nMotivo: ${motivo}`)} target="_blank" rel="noopener"><MessageCircle size={16} aria-hidden="true" />WhatsApp</a></div>
            </div>
          )}
        </li>
      ))}
      {msg && <li className="fine">{msg}</li>}
    </ul>
  );
}

/* ───────── 6 · Duelos ───────── */
type Duelo = { id: string; convite: string; distancia_km: number; mes: string; eu_desafiante: boolean; adversario: string | null; minha_nota: number | null; minha_tempo: number | null; nota_adv: number | null; tempo_adv: number | null };
const DIST_DUELO = [5, 10, 21.0975, 42.195];

export function TelaDuelos({ perfil }: { perfil: Perfil }) {
  const [duelos, setDuelos] = useState<Duelo[] | null>(null);
  const [res, setRes] = useState<Resultado[]>([]);
  const [km, setKm] = useState(5);
  const [novo, setNovo] = useState<{ link: string } | null>(null);
  const [cardD, setCardD] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const carregar = () => sb.rpc('radar_meus_duelos').then(({ data }) => setDuelos((data ?? []) as Duelo[]));
  useEffect(() => { carregar(); sb.from('radar_resultados').select('*').neq('status', 'recusado').order('prova_data', { ascending: false }).then(({ data }) => setRes((data ?? []) as Resultado[])); }, []);

  // Fantasma: sua prova mais recente contra o seu melhor tempo anterior na mesma distância
  const fantasmas = useMemo(() => {
    const out: { km: number; hoje: Resultado; antes: number }[] = [];
    for (const d of DIST_DUELO) {
      const l = res.filter(r => Math.abs(Number(r.distancia_km) - d) < 0.2);
      if (l.length >= 2) out.push({ km: d, hoje: l[0], antes: Math.min(...l.slice(1).map(r => r.tempo_s)) });
    }
    return out;
  }, [res]);

  const criar = async () => {
    setErro(null);
    const r = await chamar<{ link: string }>('radar-acoes', { acao: 'duelo_criar', distancia_km: km });
    if (r.erro) return setErro(r.erro);
    setNovo(r); carregar();
  };
  const textoConvite = (link: string) => `Te desafio no Radar Pro! Duelo de ${kmTxt(km)} neste mês: vence a maior nota por idade. Aceita? ${link}`;
  const mesTxt = (m: string) => new Date(m + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long' });
  const diasFim = () => { const h = new Date(); return new Date(h.getFullYear(), h.getMonth() + 1, 0).getDate() - h.getDate(); };

  return (
    <div className="pro-cont">
      {fantasmas.map(f => { const dif = f.hoje.tempo_s - f.antes; return (
        <section key={f.km} className="pro-card">
          <div className="pro-linha"><p className="pro-k cinza">Fantasma · {kmTxt(f.km)}</p><span className={`pro-st ${dif <= 0 ? 'ok' : 'rec'}`}>{dif <= 0 ? '−' : '+'}{relogio(Math.abs(dif))}</span></div>
          <div className="pro-vs"><div><small>Sua última</small><b>{relogio(f.hoje.tempo_s)}</b></div><em>vs</em><div><small>Seu melhor antes</small><b className="cinza">{relogio(f.antes)}</b></div></div>
        </section>
      ); })}

      {duelos?.map(d => { const ganho = d.minha_nota != null && (d.nota_adv == null || d.minha_nota > d.nota_adv); return (
        <section key={d.id} className="pro-card azul">
          <div className="pro-linha"><p className="pro-k">Duelo de {mesTxt(d.mes)} · {kmTxt(Number(d.distancia_km))}</p>{d.mes.slice(0, 7) === new Date().toISOString().slice(0, 7) && <span className="pro-liga l-ouro">Faltam {diasFim()} dias</span>}</div>
          {d.adversario ? (
            <div className="pro-vs"><div><small>Você</small><b>{d.minha_nota != null ? `${pct(d.minha_nota)}%` : '–'}</b><small>{d.minha_tempo ? relogio(d.minha_tempo) : 'sem prova'}</small></div><em>vs</em><div><small>@{d.adversario}</small><b>{d.nota_adv != null ? `${pct(d.nota_adv)}%` : '–'}</b><small>{d.tempo_adv ? relogio(d.tempo_adv) : 'sem prova'}</small></div></div>
          ) : (
            <p className="pro-sub">Esperando o amigo aceitar. <a href={`https://wa.me/?text=${encodeURIComponent(`Te desafio no Radar Pro! Duelo de ${kmTxt(Number(d.distancia_km))}: https://radarcorridasma.com.br/?pro=duelo&c=${d.convite}`)}`} target="_blank" rel="noopener">Mandar o convite de novo</a></p>
          )}
          {d.adversario && (() => {
            const fim = new Date(d.mes.slice(0, 10) + 'T12:00:00Z'); fim.setUTCMonth(fim.getUTCMonth() + 1);
            if (fim > new Date()) return null;
            const r: FimDuelo['resultado'] = d.minha_nota == null && d.nota_adv == null ? 'ninguem' : d.nota_adv == null || (d.minha_nota != null && d.minha_nota > d.nota_adv) ? 'venci' : d.minha_nota == null || d.minha_nota < d.nota_adv ? 'perdi' : 'empate';
            const fd: FimDuelo = { id: d.id, adversario: d.adversario, distancia_km: Number(d.distancia_km), mes: d.mes, minha_nota: d.minha_nota, nota_adv: d.nota_adv, resultado: r };
            return <>
              <p className="pro-sub pro-centro"><b>{r === 'venci' ? '🏆 Você venceu!' : r === 'perdi' ? 'Duelo encerrado: @' + d.adversario + ' venceu.' : r === 'empate' ? 'Empate!' : 'Ninguém correu na distância.'}</b></p>
              {r !== 'ninguem' && (cardD === d.id ? <CardDuelo d={fd} eu={perfil.apelido} fechar={() => setCardD(null)} /> : <button className="btn outline pro-btn" onClick={() => setCardD(d.id)}>Card pro story</button>)}
            </>;
          })()}
          {d.adversario && d.mes.slice(0, 7) >= new Date().toISOString().slice(0, 7) && (d.minha_nota != null || d.nota_adv != null) && <p className="pro-sub pro-centro">{ganho ? 'Você está na frente!' : 'Seu amigo está na frente.'} Vence a maior nota por idade.</p>}
        </section>
      ); })}

      <section className="pro-card">
        <p className="pro-k cinza">Desafiar um amigo</p>
        <div className="chips" role="group" aria-label="Distância do duelo">{DIST_DUELO.map(d => <button key={d} className="chip" aria-pressed={km === d} onClick={() => { setKm(d); setNovo(null); }}>{kmTxt(d)}</button>)}</div>
        {!novo && <button className="btn solid pro-btn" onClick={criar}>Criar duelo de {kmTxt(km)}</button>}
        {novo && <div className="pro-linha pro-quebra">
          <a className="btn whats" href={`https://wa.me/?text=${encodeURIComponent(textoConvite(novo.link))}`} target="_blank" rel="noopener"><Share2 size={16} aria-hidden="true" />Enviar no WhatsApp</a>
          <button className="btn outline" onClick={() => navigator.clipboard?.writeText(textoConvite(novo.link))}><Copy size={16} aria-hidden="true" />Copiar link</button>
        </div>}
        {erro && <p className="ct-erro" role="alert">{erro}</p>}
        <p className="fine">Vale a melhor prova de cada um no mês, na distância do duelo. Ganha a maior nota por idade, então dá para duelar com quem tem idade diferente. Seu amigo também precisa ser Pro{perfil ? '' : ''}.</p>
      </section>
    </div>
  );
}

/* ───────── 8 · Minha conta ───────── */
export function TelaConta({ perfil, temp, email, pronto }: { perfil: Perfil; temp: Temporada; email: string; pronto: () => void }) {
  const [renovar, setRenovar] = useState(false);
  const [editando, setEditando] = useState(false);
  const [apagar, setApagar] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const baixar = async () => {
    const r = await chamar('radar-acoes', { acao: 'exportar' });
    if (r.erro) return setMsg(r.erro);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' }));
    a.download = `radar-pro-${perfil.apelido}.json`; a.click();
  };
  const confirmarApagar = async () => {
    const r = await chamar('radar-acoes', { acao: 'apagar_conta', confirmo: apagar });
    if (r.erro) return setMsg(r.erro);
    await sb.auth.signOut(); window.location.href = '/';
  };
  const vence = temp.valida_ate ? new Date(temp.valida_ate).toLocaleDateString('pt-BR') : null;
  return (
    <div className="pro-cont">
      {editando ? <EditarPerfil perfil={perfil} fechar={() => setEditando(false)} pronto={pronto} /> : <>
        <section className="pro-card"><p className="pro-k cinza">Perfil público</p><p className="pro-medio">@{perfil.apelido}</p><p className="fine pro-sem-margem">{perfil.cidade}{temp.liga ? ` · Liga ${LIGAS.find(l => l.id === temp.liga)!.nome}` : ''}{perfil.assessoria ? ` · ${perfil.assessoria}` : ''}</p></section>
        <section className="pro-card"><p className="pro-k cinza">Usado só no cálculo (não aparece)</p><p className="pro-sem-margem">{perfil.nome_completo} · {perfil.sexo === 'F' ? 'Feminino' : 'Masculino'} · nascimento {perfil.nascimento.split('-').reverse().join('/')}</p><p className="fine pro-sem-margem">{email}</p></section>
        {edicoesRestantes(perfil) > 0
          ? <button className="btn outline pro-btn" onClick={() => setEditando(true)}><Pencil size={16} aria-hidden="true" />Editar perfil <small>({edicoesRestantes(perfil) === 1 ? 'resta 1 edição' : 'restam 2 edições'} este mês)</small></button>
          : <p className="fine pro-sem-margem">Você já usou as 2 edições de perfil deste mês. Libera de novo no dia 1º. Precisa corrigir algo agora? <a href={whatsappLink(`Oi! Quero corrigir meu perfil no Radar Pro (@${perfil.apelido}): `)} target="_blank" rel="noopener">Fale com o Radar</a>.</p>}
      </>}
      <ZapConta perfil={perfil} pronto={pronto} />
      <PublicoConta perfil={perfil} pronto={pronto} />
      <section className="pro-card">
        <p className="pro-k cinza">Assinatura</p>
        <p className="pro-sem-margem">{temp.assinante ? <><b className="pro-verde">Ativa</b> · vence em {vence} · R$ 10/mês</> : <><b>Inativa</b>{vence ? ` · venceu em ${vence}` : ''}</>}</p>
        {!renovar && <button className="btn outline pro-btn" onClick={() => setRenovar(true)}>{temp.assinante ? 'Renovar com Pix (+30 dias)' : 'Assinar com Pix'}</button>}
        {renovar && <Assinar perfil={perfil} pronto={() => { setRenovar(false); pronto(); }} />}
      </section>
      <button className="btn solid pro-btn pro-instalar" onClick={() => window.dispatchEvent(new Event('radar:instalar'))}><Smartphone size={18} aria-hidden="true" />Instalar o app Radar Pro</button>
      <button className="btn outline pro-btn" onClick={baixar}><Download size={18} aria-hidden="true" />Baixar meus dados</button>
      <details className="pro-card pro-perigo"><summary><Trash2 size={16} aria-hidden="true" /> Apagar minha conta</summary>
        <p className="fine">Apaga perfil, provas, medalhas, duelos e pagamentos registrados. Não dá para desfazer.</p>
        <label className="ct-cidade">Digite APAGAR para confirmar<input value={apagar} onChange={e => setApagar(e.target.value.toUpperCase())} /></label>
        <button className="btn pro-btn pro-vermelho" disabled={apagar !== 'APAGAR'} onClick={confirmarApagar}>Apagar para sempre</button>
      </details>
      {msg && <p className="ct-erro" role="alert">{msg}</p>}
      <button className="btn text" onClick={() => sb.auth.signOut()}><LogOut size={16} aria-hidden="true" />Sair</button>
      <p className="fine pro-centro"><a href="/termos.html">Termos de uso e política de privacidade</a></p>
    </div>
  );
}

function EditarPerfil({ perfil, fechar, pronto }: { perfil: Perfil; fechar: () => void; pronto: () => void }) {
  const dataBRp = (iso: string) => iso.split('-').reverse().join('/');
  const [f, setF] = useState({ apelido: perfil.apelido, nome_completo: perfil.nome_completo, cidade: perfil.cidade, sexo: perfil.sexo, nascimento: dataBRp(perfil.nascimento), assessoria: perfil.assessoria ?? '' });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const muda = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const masc = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 8); return d.length > 4 ? `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; };
  const resta = edicoesRestantes(perfil);
  const salvar = async (e: React.FormEvent) => {
    e.preventDefault(); setErro(null);
    const ap = f.apelido.trim().toLowerCase();
    if (!/^[a-z0-9_.]{3,20}$/.test(ap)) return setErro('Apelido: 3 a 20 letras sem acento, números, ponto ou _.');
    const nome = f.nome_completo.trim().replace(/\s+/g, ' ');
    if (nome.split(' ').length < 2) return setErro('Escreva o nome completo, igual ao da inscrição das provas.');
    const nasc = f.nascimento.split('/').reverse().join('-');
    const idade = (Date.now() - Date.parse(nasc)) / (365.25 * 86400_000);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nasc) || !(idade >= 10 && idade <= 100)) return setErro('Confira a data de nascimento (dd/mm/aaaa).');
    const novo = { apelido: ap, nome_completo: nome, cidade: f.cidade.trim() || perfil.cidade, sexo: f.sexo, nascimento: nasc, assessoria: f.assessoria.trim() || null };
    const igual = (Object.keys(novo) as (keyof typeof novo)[]).every(k => (novo[k] ?? null) === (perfil[k] ?? null));
    if (igual) return fechar();
    setSalvando(true);
    const { error } = await sb.from('radar_perfis').update(novo).eq('user_id', perfil.user_id);
    setSalvando(false);
    if (error) return setErro(error.message.includes('LIMITE_EDICOES') ? 'Você já usou as 2 edições de perfil deste mês.' : error.code === '23505' ? 'Esse apelido já existe. Escolha outro.' : 'Não deu para salvar. Tente de novo.');
    fechar(); pronto();
  };
  return (
    <form className="pro-card pro-form" onSubmit={salvar}>
      <p className="pro-k cinza">Editar perfil</p>
      <p className="fine pro-sem-margem">Você pode editar o perfil 2 vezes por mês. {resta === 1 ? 'Esta é a última deste mês.' : 'Esta conta como uma.'}</p>
      <label className="ct-cidade">Apelido público<input value={f.apelido} onChange={muda('apelido')} autoCapitalize="none" /></label>
      <label className="ct-cidade">Nome completo (como na inscrição)<input value={f.nome_completo} onChange={muda('nome_completo')} autoComplete="name" /><small>É por ele que o Radar acha você no resultado oficial. Provas já verificadas não mudam.</small></label>
      <label className="ct-cidade">Cidade<input list="pro-cidades-ed" value={f.cidade} onChange={muda('cidade')} /><datalist id="pro-cidades-ed">{NOMES_CIDADES.map(c => <option key={c} value={c} />)}</datalist></label>
      <p className="euvou-pergunta">Categoria</p>
      <div className="chips" role="group" aria-label="Categoria"><button type="button" className="chip" aria-pressed={f.sexo === 'F'} onClick={() => setF({ ...f, sexo: 'F' })}>Feminino</button><button type="button" className="chip" aria-pressed={f.sexo === 'M'} onClick={() => setF({ ...f, sexo: 'M' })}>Masculino</button></div>
      <label className="ct-cidade">Data de nascimento<input inputMode="numeric" value={f.nascimento} onChange={e => setF({ ...f, nascimento: masc(e.target.value) })} placeholder="dd/mm/aaaa" /></label>
      <label className="ct-cidade">Assessoria ou grupo <small>(opcional)</small><input value={f.assessoria} onChange={muda('assessoria')} /></label>
      {erro && <p className="ct-erro" role="alert">{erro}</p>}
      <button className="btn solid pro-btn" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar alterações'}</button>
      <button className="btn text" type="button" onClick={fechar}>Cancelar</button>
    </form>
  );
}

function PublicoConta({ perfil, pronto }: { perfil: Perfil; pronto: () => void }) {
  const [salvando, setSalvando] = useState(false);
  const pub = perfil.publico !== false;
  const trocar = async () => { setSalvando(true); await sb.from('radar_perfis').update({ publico: !pub }).eq('user_id', perfil.user_id); setSalvando(false); pronto(); };
  return (
    <section className="pro-card">
      <div className="pro-linha"><p className="pro-k cinza">Perfil público</p><button className="btn outline" disabled={salvando} onClick={trocar}>{pub ? 'Desligar' : 'Ligar'}</button></div>
      <p className="fine pro-sem-margem">{pub ? <>Ligado: <a href={linkPerfil(perfil.apelido)} target="_blank" rel="noopener">radarcorridasma.com.br/?atleta={perfil.apelido}</a> mostra apelido, cidade, liga, provas e medalhas. Nunca seu nome completo, idade ou contato.</> : 'Desligado: ninguém vê seu perfil pelo link.'}</p>
    </section>
  );
}

function ZapConta({ perfil, pronto }: { perfil: Perfil; pronto: () => void }) {
  const [v, setV] = useState(perfil.whatsapp ? zapMascara(perfil.whatsapp) : '');
  const [msg, setMsg] = useState<string | null>(null);
  const salvar = async () => {
    const zap = v.trim() ? zapLimpo(v) : null;
    if (v.trim() && !zap) return setMsg('Confira: DDD + número, ex.: (98) 98765-4321.');
    const { error } = await sb.from('radar_perfis').update({ whatsapp: zap }).eq('user_id', perfil.user_id);
    setMsg(error ? 'Não deu para salvar. Tente de novo.' : 'Salvo!'); if (!error) pronto();
  };
  return (
    <section className="pro-card">
      <p className="pro-k cinza">WhatsApp para contato</p>
      <div className="pro-linha pro-quebra"><input className="pro-input" type="tel" inputMode="tel" value={v} onChange={e => { setV(zapMascara(e.target.value)); setMsg(null); }} placeholder="(98) 98765-4321" aria-label="WhatsApp" /><button className="btn outline" onClick={salvar}>Salvar</button></div>
      <p className="fine pro-sem-margem">{msg ?? 'Só para o Radar te avisar se tiver algum problema com o seu resultado. Não aparece para ninguém.'}</p>
    </section>
  );
}

/* ───────── Administração (só o Vinik) ───────── */
type ProvaDia = { id: string; nome: string; data: string; cidade: string; distancias: number[] };
type Pend = { sugestoes: (Sugestao & { user_id: string })[]; provas_mesmo_dia: ProvaDia[]; resultados: (Resultado & { user_id: string })[]; contestacoes: { id: string; motivo: string; autor_id: string; criado_em: string; radar_resultados: Resultado & { user_id: string } }[]; perfis: { user_id: string; apelido: string; nome_completo: string; cidade: string; whatsapp?: string | null }[] };
export function TelaAdmin() {
  const [p, setP] = useState<Pend | null>(null);
  const [apelido, setApelido] = useState('');
  const [dias, setDias] = useState('30');
  const [msg, setMsg] = useState<string | null>(null);
  const carregar = () => chamar<Pend>('radar-acoes', { acao: 'admin_pendentes' }).then(r => (r.erro ? setMsg(r.erro) : setP(r)));
  useEffect(() => { carregar(); }, []);
  const zapDe = (uid: string) => p?.perfis.find(y => y.user_id === uid)?.whatsapp ?? null;
  const quem = (uid: string) => { const x = p?.perfis.find(y => y.user_id === uid); return x ? `@${x.apelido} (${x.nome_completo}, ${x.cidade})` : '?'; };
  const decidir = async (id: string, decisao: 'aprovar' | 'recusar') => { const r = await chamar('radar-acoes', { acao: 'admin_decidir', resultado_id: id, decisao }); setMsg(r.erro ?? 'Feito.'); carregar(); };
  const liberar = async () => { const r = await chamar<{ valida_ate: string }>('radar-acoes', { acao: 'admin_liberar', apelido: apelido.replace('@', ''), dias: Number(dias) }); setMsg(r.erro ?? `Liberado até ${new Date(r.valida_ate).toLocaleDateString('pt-BR')}.`); };
  const Item = ({ r }: { r: Resultado & { user_id: string } }) => (
    <><div className="pro-linha"><b>{r.prova_nome}</b><SeloStatus r={r} /></div>
      <p>{quem(r.user_id)}<br />{dataBR(r.prova_data)} · {kmTxt(Number(r.distancia_km))} · {relogio(r.tempo_s)} · nota {pct(r.nota)}%{(r.peito ?? r.peito_declarado) ? ` · peito ${r.peito ?? r.peito_declarado}` : ''}{r.nome_inscricao ? ` · inscrito como ${r.nome_inscricao}` : ''}</p>
      {r.motivo_analise && <p className="fine pro-sem-margem">{r.motivo_analise}</p>}
      {r.link_resultado && <p className="fine pro-sem-margem"><a href={r.link_resultado} target="_blank" rel="noopener noreferrer">Abrir link enviado</a></p>}
      <div className="pro-linha pro-quebra"><button className="btn solid" onClick={() => decidir(r.id, 'aprovar')}>Aprovar</button><button className="btn outline pro-vermelho-txt" onClick={() => decidir(r.id, 'recusar')}>Recusar</button>{zapDe(r.user_id) && <a className="btn whats" href={`https://wa.me/${zapDe(r.user_id)}?text=${encodeURIComponent(`Oi, @${p?.perfis.find(y => y.user_id === r.user_id)?.apelido}! Aqui é o Radar Corridas Maranhão. Sobre a sua prova ${r.prova_nome} (${dataBR(r.prova_data)}, ${kmTxt(Number(r.distancia_km))}, ${relogio(r.tempo_s)}) no Radar Pro: ${r.motivo_analise ?? 'precisamos conferir o seu resultado.'} Pode me mandar o print ou o link do resultado oficial?`)}`} target="_blank" rel="noopener"><MessageCircle size={16} aria-hidden="true" />Chamar no WhatsApp</a>}</div></>
  );
  return (
    <div className="pro-cont">
      {msg && <p className="pro-aviso" role="status">{msg}</p>}
      <section className="pro-card">
        <p className="pro-k cinza">Liberar Radar Pro (pagamento por fora, cortesia)</p>
        <div className="pro-linha pro-quebra"><input className="pro-input" value={apelido} onChange={e => setApelido(e.target.value)} placeholder="@apelido" aria-label="Apelido" /><input className="pro-input pro-curto" inputMode="numeric" value={dias} onChange={e => setDias(e.target.value)} aria-label="Dias" /><button className="btn solid" onClick={liberar}>Liberar</button></div>
      </section>
      <section className="pro-card"><p className="pro-k cinza">Provas pedidas ({p?.sugestoes.length ?? '…'})</p>
        <ul className="pro-provas">{p?.sugestoes.map(x => <li key={x.id}><PedidoAdmin x={x} quem={quem(x.user_id)} mesmoDia={p.provas_mesmo_dia.filter(y => y.data === x.data)} feito={m => { setMsg(m); carregar(); }} /></li>)}</ul>
        {p && !p.sugestoes.length && <p className="fine">Nenhum pedido.</p>}
      </section>
      <section className="pro-card"><p className="pro-k cinza">Em análise ({p?.resultados.length ?? '…'})</p><ul className="pro-provas">{p?.resultados.map(r => <li key={r.id}><Item r={r} /></li>)}</ul>{p && !p.resultados.length && <p className="fine">Nada pendente.</p>}</section>
      <section className="pro-card"><p className="pro-k cinza">Contestações ({p?.contestacoes.length ?? '…'})</p>
        <ul className="pro-provas">{p?.contestacoes.map(c => <li key={c.id}><p className="pro-sem-margem"><b>Motivo:</b> {c.motivo}<br /><small>por {quem(c.autor_id)}</small></p>{c.radar_resultados && <Item r={c.radar_resultados} />}<button className="btn text pro-esq" onClick={async () => { await chamar('radar-acoes', { acao: 'admin_contestacao', contestacao_id: c.id }); carregar(); }}>Encerrar sem mudar</button></li>)}</ul>
        {p && !p.contestacoes.length && <p className="fine">Nenhuma contestação aberta.</p>}
      </section>
    </div>
  );
}

function PedidoAdmin({ x, quem, mesmoDia, feito }: { x: Sugestao; quem: string; mesmoDia: ProvaDia[]; feito: (m: string) => void }) {
  const [nome, setNome] = useState(x.nome);
  const [cidade, setCidade] = useState(x.cidade);
  const [dists, setDists] = useState(String(Number(x.distancia_km)));
  const [resposta, setResposta] = useState('');
  const [indo, setIndo] = useState(false);
  const decidir = async (decisao: 'aprovar' | 'recusar', prova_id?: string) => {
    setIndo(true);
    const r = await chamar('radar-acoes', { acao: 'admin_prova', sugestao_id: x.id, decisao, prova_id, nome, cidade, distancias: dists, resposta });
    setIndo(false); feito(r.erro ?? (decisao === 'aprovar' ? `Prova aprovada. O atleta já pode registrar.` : 'Pedido recusado.'));
  };
  return (
    <>
      <div className="pro-linha"><b>{x.nome}</b><span className="pro-st dec">Pedido</span></div>
      <p>{quem}<br />{dataBR(x.data)} · {x.cidade} · correu {kmTxt(Number(x.distancia_km))}{x.obs ? ` · ${x.obs}` : ''}</p>
      {x.link && <p className="fine pro-sem-margem"><a href={x.link} target="_blank" rel="noopener noreferrer">Abrir link do resultado</a></p>}
      {mesmoDia.length > 0 && <div className="pro-mesmo-dia"><p className="fine pro-sem-margem">Já existe prova neste dia. É a mesma?</p>{mesmoDia.map(y => <button key={y.id} className="btn outline" disabled={indo} onClick={() => decidir('aprovar', y.id)}>Juntar com “{y.nome}” ({y.cidade})</button>)}</div>}
      <label className="ct-cidade">Nome da prova<input value={nome} onChange={e => setNome(e.target.value)} /></label>
      <div className="pro-linha pro-quebra">
        <label className="ct-cidade pro-flex">Cidade<input value={cidade} onChange={e => setCidade(e.target.value)} /></label>
        <label className="ct-cidade pro-flex">Distâncias (km)<input value={dists} onChange={e => setDists(e.target.value)} placeholder="5, 10" /></label>
      </div>
      <label className="ct-cidade">Resposta ao atleta <small>(opcional)</small><input value={resposta} onChange={e => setResposta(e.target.value)} placeholder="Ex.: não achamos o resultado oficial" /></label>
      <div className="pro-linha pro-quebra"><button className="btn solid" disabled={indo} onClick={() => decidir('aprovar')}>Aprovar como prova nova</button><button className="btn outline pro-vermelho-txt" disabled={indo} onClick={() => decidir('recusar')}>Recusar</button></div>
    </>
  );
}
