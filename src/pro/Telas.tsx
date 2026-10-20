// Telas do Radar Pro para quem assina: temporada, "Eu corri!", ranking, duelos, conta e administração.
import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, MessageCircle, Download, Trash2, LogOut, Share2, Copy, Flag } from 'lucide-react';
import { sb, chamar, LIGAS, MEDALHAS, STATUS, relogio, pct, kmTxt, dataBR, type Perfil, type Resultado, type Temporada, type Liga } from './sb';
import { lerTempo, mascaraTempo } from '../CardTreino';
import { whatsappLink } from '../lib';
import TAB from '../idade-tabela.json';
import { Assinar } from './Pro';

const ANO = new Date().getFullYear();
const ehValido = (r: Resultado) => r.status === 'verificado' || r.status === 'aprovado';

const SeloLiga = ({ liga }: { liga: Liga | null }) => liga
  ? <span className={`pro-liga l-${liga}`}>◆ Liga {LIGAS.find(l => l.id === liga)!.nome}</span>
  : <span className="pro-liga l-sem">Sem liga ainda</span>;

const SeloStatus = ({ r }: { r: Resultado }) => <span className={`pro-st ${STATUS[r.status].cls}`} title={STATUS[r.status].dica}>{STATUS[r.status].txt}</span>;

const msgComprovante = (p: Perfil, r: { prova_nome: string; prova_data: string; distancia_km: number; tempo_s: number }) =>
  whatsappLink(`Comprovante Radar Pro\nApelido: @${p.apelido}\nNome na inscrição: ${p.nome_completo}\nProva: ${r.prova_nome} (${dataBR(r.prova_data)})\nDistância: ${kmTxt(Number(r.distancia_km))}\nTempo: ${relogio(r.tempo_s)}\n\nSegue o print ou link do resultado:`);

/* ───────── 3 · Minha temporada ───────── */
export function TelaTemporada({ perfil, temp, irCorri }: { perfil: Perfil; temp: Temporada; irCorri: () => void }) {
  const [res, setRes] = useState<Resultado[] | null>(null);
  const [meds, setMeds] = useState<string[]>([]);
  const [abre, setAbre] = useState<string | null>(null);
  useEffect(() => {
    sb.from('radar_resultados').select('*').order('prova_data', { ascending: false }).then(({ data }) => setRes((data ?? []) as Resultado[]));
    sb.from('radar_medalhas').select('medalha, temporada').then(({ data }) => setMeds((data ?? []).filter(m => m.temporada === ANO || m.medalha.startsWith('primeir')).map(m => m.medalha)));
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

      {evolucao.length >= 2 && (
        <section className="pro-card"><p className="pro-k cinza">Sua evolução (nota por idade)</p><Grafico v={evolucao} /></section>
      )}

      <section className="pro-card">
        <div className="pro-linha"><p className="pro-k cinza">Medalhas {ANO}</p><b>{new Set(meds).size} / {MEDALHAS.length}</b></div>
        <div className="pro-med">
          {MEDALHAS.map(m => { const ok = meds.includes(m.id); return (
            <button key={m.id} className={ok ? 'ok' : ''} aria-label={`${m.nome}: ${ok ? 'conquistada' : m.como}`} onClick={() => setAbre(abre === m.id ? null : m.id)}><span>{m.icone}</span>{m.nome}</button>
          ); })}
        </div>
        {abre && <p className="fine pro-sem-margem">{MEDALHAS.find(m => m.id === abre)!.como}</p>}
      </section>

      <section className="pro-card">
        <p className="pro-k cinza">Minhas provas</p>
        {res === null && <p className="fine">Carregando…</p>}
        {res?.length === 0 && <p className="fine">Nenhuma prova ainda. Toque em “Eu corri uma prova”.</p>}
        <ul className="pro-provas">
          {res?.map(r => (
            <li key={r.id}>
              <div className="pro-linha"><b>{r.prova_nome}</b><SeloStatus r={r} /></div>
              <p>{dataBR(r.prova_data)} · {r.cidade} · {kmTxt(Number(r.distancia_km))} · <b>{relogio(r.tempo_s)}</b> · nota {pct(r.nota)}% · {r.pontos} pts{r.podio ? ' · 🥇 pódio' : ''}</p>
              {r.motivo_analise && <p className="fine pro-sem-margem">{r.motivo_analise}</p>}
              {(r.status === 'declarado' || r.status === 'em_analise') && <a className="btn whats pro-btn-p" href={msgComprovante(perfil, r)} target="_blank" rel="noopener"><MessageCircle size={16} aria-hidden="true" />Enviar comprovante</a>}
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

type Resposta = { nota: number; pontos: number; detalhes: Record<string, number>; status: Resultado['status']; motivo: string | null; medalhas_novas: string[]; liga: Liga | null; subiu_de_liga: boolean; oficial: boolean; resultado: Resultado };

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
    setFeito(r); pronto();
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
          {feito.motivo && <p className="fine pro-sem-margem">{feito.motivo}</p>}
        </section>
        {feito.medalhas_novas.length > 0 && feito.medalhas_novas.map(m => { const x = MEDALHAS.find(y => y.id === m); return x ? <section key={m} className="pro-card pro-nova"><span>{x.icone}</span><div><b>Nova medalha: {x.nome}!</b><p className="fine pro-sem-margem">{x.como}</p></div></section> : null; })}
        {!feito.oficial && <a className="btn whats pro-btn" href={msgComprovante(perfil, r)} target="_blank" rel="noopener"><MessageCircle size={18} aria-hidden="true" />Enviar comprovante pelo WhatsApp</a>}
        {!feito.oficial && <p className="fine pro-sem-margem">Quando a cronometragem publicar o resultado, o Radar confere sozinho e muda para “Verificado”.</p>}
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
          {provas && !lista.length && <p className="fine">Nenhuma prova encontrada. Só valem provas da agenda do Radar que já aconteceram (últimos 12 meses). Faltou alguma? <a href={whatsappLink('Oi! Corri uma prova que não está no Radar Pro: ')} target="_blank" rel="noopener">Avise pelo WhatsApp</a>.</p>}
        </>
      )}

      {prova && <>
        <p className="euvou-pergunta">2. Distância</p>
        <div className="chips" role="group" aria-label="Distância">{prova.distancias.map(d => <button key={d} className="chip" aria-pressed={km === Number(d)} onClick={() => setKm(Number(d))}>{kmTxt(real(Number(d)))}</button>)}</div>
        <label className="ct-cidade">3. Tempo líquido (do chip)<input inputMode="numeric" value={tempo} onChange={e => setTempo(mascaraTempo(e.target.value))} placeholder="Ex.: 52:10" /><small>Se o resultado oficial já saiu, usamos o tempo de lá.</small></label>
        <label className="ct-cidade">Número de peito <small>(ajuda a achar você no resultado)</small><input inputMode="numeric" value={peito} onChange={e => setPeito(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="Ex.: 1234" /></label>
        <button className="btn text pro-esq" aria-expanded={mais} onClick={() => setMais(!mais)}>{mais ? 'Menos opções' : 'Inscrito com outro nome? Tem link do resultado?'}</button>
        {mais && <>
          <label className="ct-cidade">Nome usado na inscrição<input value={outroNome} onChange={e => setOutroNome(e.target.value)} placeholder={perfil.nome_completo} /></label>
          <label className="ct-cidade">Link do resultado <small>(opcional)</small><input inputMode="url" value={link} onChange={e => setLink(e.target.value)} placeholder="cole aqui o link da cronometragem" /></label>
        </>}
        {previa && <section className="pro-card azul pro-centro"><p className="pro-k">Prévia da nota por idade</p><p className="pro-big">{pct(previa)}%</p></section>}
        {erro && <p className="ct-erro" role="alert">{erro}</p>}
        <button className="btn solid pro-btn" disabled={!km || enviando} onClick={enviar}>{enviando ? 'Conferindo no resultado oficial…' : 'Salvar na minha temporada'}</button>
        <p className="fine pro-sem-margem">Para valer no ranking, o tempo precisa estar no resultado oficial (o Radar confere sozinho) ou você envia o comprovante.</p>
      </>}
    </div>
  );
}

/* ───────── Ranking do Maranhão ───────── */
type Linha = { posicao: number; apelido: string; cidade?: string; liga?: Liga; faixa?: string; pontos?: number; provas?: number; indice?: number; eu?: boolean; assessoria?: string; atletas?: number; tamanho?: number };
const FAIXAS = ['até 19', '20-24', '25-29', '30-34', '35-39', '40-44', '45-49', '50-54', '55-59', '60+'];
type Rec = 'geral' | 'eficiencia' | 'assessorias' | 'pelotao';

export function TelaRanking({ perfil }: { perfil: Perfil }) {
  const [rec, setRec] = useState<Rec>('geral');
  const [sexo, setSexo] = useState<'' | 'F' | 'M'>('');
  const [cidade, setCidade] = useState('');
  const [faixa, setFaixa] = useState('');
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);

  useEffect(() => {
    setLinhas(null); setAberto(null);
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
        {([['geral', 'Pontos'], ['eficiencia', 'Eficiência'], ['assessorias', 'Assessorias'], ['pelotao', 'Pelotão']] as [Rec, string][]).map(([k, n]) => <button key={k} aria-pressed={rec === k} onClick={() => setRec(k)}>{n}</button>)}
      </div>

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
          {d.adversario && (d.minha_nota != null || d.nota_adv != null) && <p className="pro-sub pro-centro">{ganho ? 'Você está na frente!' : 'Seu amigo está na frente.'} Vence a maior nota por idade.</p>}
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
      <section className="pro-card"><p className="pro-k cinza">Perfil público</p><p className="pro-medio">@{perfil.apelido}</p><p className="fine pro-sem-margem">{perfil.cidade}{temp.liga ? ` · Liga ${LIGAS.find(l => l.id === temp.liga)!.nome}` : ''}{perfil.assessoria ? ` · ${perfil.assessoria}` : ''}</p></section>
      <section className="pro-card"><p className="pro-k cinza">Usado só no cálculo (não aparece)</p><p className="pro-sem-margem">{perfil.nome_completo} · {perfil.sexo === 'F' ? 'Feminino' : 'Masculino'} · nascimento {perfil.nascimento.split('-').reverse().join('/')}</p><p className="fine pro-sem-margem">{email}</p><p className="fine pro-sem-margem">Algum dado errado? <a href={whatsappLink(`Oi! Quero corrigir meu perfil no Radar Pro (@${perfil.apelido}): `)} target="_blank" rel="noopener">Peça a correção pelo WhatsApp</a>.</p></section>
      <section className="pro-card">
        <p className="pro-k cinza">Assinatura</p>
        <p className="pro-sem-margem">{temp.assinante ? <><b className="pro-verde">Ativa</b> · vence em {vence} · R$ 10/mês</> : <><b>Inativa</b>{vence ? ` · venceu em ${vence}` : ''}</>}</p>
        {!renovar && <button className="btn outline pro-btn" onClick={() => setRenovar(true)}>{temp.assinante ? 'Renovar com Pix (+30 dias)' : 'Assinar com Pix'}</button>}
        {renovar && <Assinar perfil={perfil} pronto={() => { setRenovar(false); pronto(); }} />}
      </section>
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

/* ───────── Administração (só o Vinik) ───────── */
type Pend = { resultados: (Resultado & { user_id: string })[]; contestacoes: { id: string; motivo: string; autor_id: string; criado_em: string; radar_resultados: Resultado & { user_id: string } }[]; perfis: { user_id: string; apelido: string; nome_completo: string; cidade: string }[] };
export function TelaAdmin() {
  const [p, setP] = useState<Pend | null>(null);
  const [apelido, setApelido] = useState('');
  const [dias, setDias] = useState('30');
  const [msg, setMsg] = useState<string | null>(null);
  const carregar = () => chamar<Pend>('radar-acoes', { acao: 'admin_pendentes' }).then(r => (r.erro ? setMsg(r.erro) : setP(r)));
  useEffect(() => { carregar(); }, []);
  const quem = (uid: string) => { const x = p?.perfis.find(y => y.user_id === uid); return x ? `@${x.apelido} (${x.nome_completo}, ${x.cidade})` : '?'; };
  const decidir = async (id: string, decisao: 'aprovar' | 'recusar') => { const r = await chamar('radar-acoes', { acao: 'admin_decidir', resultado_id: id, decisao }); setMsg(r.erro ?? 'Feito.'); carregar(); };
  const liberar = async () => { const r = await chamar<{ valida_ate: string }>('radar-acoes', { acao: 'admin_liberar', apelido: apelido.replace('@', ''), dias: Number(dias) }); setMsg(r.erro ?? `Liberado até ${new Date(r.valida_ate).toLocaleDateString('pt-BR')}.`); };
  const Item = ({ r }: { r: Resultado & { user_id: string } }) => (
    <><div className="pro-linha"><b>{r.prova_nome}</b><SeloStatus r={r} /></div>
      <p>{quem(r.user_id)}<br />{dataBR(r.prova_data)} · {kmTxt(Number(r.distancia_km))} · {relogio(r.tempo_s)} · nota {pct(r.nota)}%{r.peito ? ` · peito ${r.peito}` : ''}</p>
      {r.motivo_analise && <p className="fine pro-sem-margem">{r.motivo_analise}</p>}
      {r.link_resultado && <p className="fine pro-sem-margem"><a href={r.link_resultado} target="_blank" rel="noopener noreferrer">Abrir link enviado</a></p>}
      <div className="pro-linha pro-quebra"><button className="btn solid" onClick={() => decidir(r.id, 'aprovar')}>Aprovar</button><button className="btn outline pro-vermelho-txt" onClick={() => decidir(r.id, 'recusar')}>Recusar</button></div></>
  );
  return (
    <div className="pro-cont">
      {msg && <p className="pro-aviso" role="status">{msg}</p>}
      <section className="pro-card">
        <p className="pro-k cinza">Liberar Radar Pro (pagamento por fora, cortesia)</p>
        <div className="pro-linha pro-quebra"><input className="pro-input" value={apelido} onChange={e => setApelido(e.target.value)} placeholder="@apelido" aria-label="Apelido" /><input className="pro-input pro-curto" inputMode="numeric" value={dias} onChange={e => setDias(e.target.value)} aria-label="Dias" /><button className="btn solid" onClick={liberar}>Liberar</button></div>
      </section>
      <section className="pro-card"><p className="pro-k cinza">Em análise ({p?.resultados.length ?? '…'})</p><ul className="pro-provas">{p?.resultados.map(r => <li key={r.id}><Item r={r} /></li>)}</ul>{p && !p.resultados.length && <p className="fine">Nada pendente.</p>}</section>
      <section className="pro-card"><p className="pro-k cinza">Contestações ({p?.contestacoes.length ?? '…'})</p>
        <ul className="pro-provas">{p?.contestacoes.map(c => <li key={c.id}><p className="pro-sem-margem"><b>Motivo:</b> {c.motivo}<br /><small>por {quem(c.autor_id)}</small></p>{c.radar_resultados && <Item r={c.radar_resultados} />}<button className="btn text pro-esq" onClick={async () => { await chamar('radar-acoes', { acao: 'admin_contestacao', contestacao_id: c.id }); carregar(); }}>Encerrar sem mudar</button></li>)}</ul>
        {p && !p.contestacoes.length && <p className="fine">Nenhuma contestação aberta.</p>}
      </section>
    </div>
  );
}
