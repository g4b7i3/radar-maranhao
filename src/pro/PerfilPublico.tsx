import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Crown, Share2, ShieldCheck } from 'lucide-react';
import { sb, LIGAS, pct, relogio, kmTxt, dataBR, type Liga, linkPerfil , generoTxt} from './sb';
import { GRUPOS, MEDALHAS, medalhaSVG, type Medalha } from './medalhas';
import './pro.css';
import { Avatar } from './Foto';
import { Aplauso, Seguir, type Reacoes, type TipoReacao } from './Feed';
import { Metas } from './Metas';
import { Recordes } from './Recordes';
import { MapaCidades } from './Mapa';
import { MapaBrasil } from './MapaBrasil';
import { linkAssessoria } from './Assessoria';
import { useOnline } from './online';
// painel do admin: só carrega quando o admin abre (não pesa no perfil público)
const AreaAdmin = lazy(() => import('./Telas').then(m => ({ default: m.AdminUsuarioArea })));

// Perfil público do atleta: radarcorridasma.com.br/?atleta=apelido
// Mostra só o que já aparece no ranking (apelido, cidade, liga, provas e medalhas). Nada de nome completo, idade ou contato.
type Prova = { id: string; prova: string; data: string; cidade: string; uf?: string; km: number; tempo: number; nota: number; status: string; geral: number | null; faixa: number | null; total: number | null };
type Dados = { foto?: string | null; apelido: string; cidade: string; assessoria: string | null; sexo: 'F' | 'M'; pcd?: boolean; genero?: string | null; faixa: string | null; indice: number | null; liga: Liga | null; resultados: Prova[]; medalhas: string[]; reis: { prova: string; data: string; km: number; nota: number }[]; seguidores: number; seguindo: number; reacoes: Reacoes; minha: TipoReacao | null; eu: boolean; sigo: boolean; logado: boolean; bio?: string | null; privado?: boolean; admin_uid?: string | null };

function Desenho({ m, tam = 64 }: { m: Medalha; tam?: number }) {
  const svg = useMemo(() => medalhaSVG(m, true, tam), [m, tam]);
  return <span className="pro-med-svg" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export default function PerfilPublico({ apelido }: { apelido: string }) {
  const [d, setD] = useState<Dados | null | undefined>(undefined);
  const [lista, setLista] = useState<'seguidores' | 'seguindo' | 'equipe' | null>(null);
  const [todas, setTodas] = useState(false);
  const [painel, setPainel] = useState(false);
  const online = useOnline(apelido.toLowerCase());
  const [msgAdm, setMsgAdm] = useState('');
  useEffect(() => {
    document.title = `@${apelido} · Radar Pro`;
    sb.rpc('radar_perfil_publico', { p_apelido: apelido.toLowerCase() }).then(({ data }) => setD((data as Dados) ?? null));
  }, [apelido]);

  if (d === undefined) return <main className="pro pro-publico"><p className="fine pro-centro">Carregando…</p></main>;
  if (d === null) return (
    <main className="pro pro-publico"><div className="pro-cont">
      <section className="pro-card pro-centro"><p className="pro-medio">@{apelido}</p><p>Esse perfil não existe ou não é público.</p><a className="btn solid pro-btn" href="/pro/">Conhecer o Radar Pro</a></section>
    </div></main>
  );

  const validas = d.resultados.filter(r => r.status === 'verificado' || r.status === 'aprovado');
  const km = d.resultados.reduce((a, r) => a + Number(r.km), 0);
  const cidades = new Set(d.resultados.map(r => r.cidade)).size;
  const tem = new Set(d.medalhas);
  const ordem = ['especial', 'ouro', 'prata', 'bronze'];
  const ganhas = MEDALHAS.filter(m => tem.has(m.id)).sort((a, b) => ordem.indexOf(a.tier) - ordem.indexOf(b.tier));
  const ligaInfo = d.liga ? LIGAS.find(l => l.id === d.liga) : null;
  const compartilhar = async () => {
    const url = linkPerfil(d.apelido);
    if (navigator.share) { try { await navigator.share({ title: `@${d.apelido} no Radar Pro`, url }); return; } catch { /* */ } }
    try { await navigator.clipboard.writeText(url); alert('Link copiado.'); } catch { /* */ }
  };

  return (
    <main className="pro pro-publico">
      <div className="pro-cont">
        <section className="pro-card azul pro-pub-topo">
          <a href="/" className="pro-pub-marca">Radar Corridas MA · <b>PRO</b></a>
          <Avatar foto={d.foto} apelido={d.apelido} tam={112} />
          <p className="pro-medio">@{d.apelido}</p>
          {d.logado && !d.eu && <p className={'pro-status' + (online ? ' on' : '')}><i aria-hidden="true" />{online ? 'Online agora' : 'Offline'}</p>}
          <p className="pro-sub pro-sem-margem">{d.cidade}{d.faixa ? ` · ${d.faixa} anos` : ''}{d.pcd ? ' · PCD' : ''}{d.genero && d.genero !== 'prefiro_nao_dizer' ? ` · ${generoTxt(d.genero)}` : ''}{d.assessoria ? <> · <button type="button" className={'pro-pub-seg pro-pub-ass' + (lista === 'equipe' ? ' on' : '')} aria-expanded={lista === 'equipe'} onClick={() => setLista(l => l === 'equipe' ? null : 'equipe')}>{d.assessoria}</button></> : ''}</p>
          {d.bio && <p className="pro-pub-bio">{d.bio}</p>}
          <p className="pro-pub-social">
            <button type="button" className={'pro-pub-seg' + (lista === 'seguidores' ? ' on' : '')} aria-expanded={lista === 'seguidores'} onClick={() => setLista(l => l === 'seguidores' ? null : 'seguidores')}><b>{d.seguidores}</b> {d.seguidores === 1 ? 'seguidor' : 'seguidores'}</button>
            {' · '}
            <button type="button" className={'pro-pub-seg' + (lista === 'seguindo' ? ' on' : '')} aria-expanded={lista === 'seguindo'} onClick={() => setLista(l => l === 'seguindo' ? null : 'seguindo')}><b>{d.seguindo}</b> seguindo</button>
          </p>
          {lista === 'equipe' && d.assessoria ? <ListaEquipe nome={d.assessoria} /> : lista && lista !== 'equipe' ? <ListaSegue apelido={d.apelido} tipo={lista} logado={d.logado} /> : null}
          <div className="pro-linha pro-pub-acoes">
            {d.logado && !d.eu && <Seguir apelido={d.apelido} sigo={d.sigo} mudou={v => setD(x => x ? { ...x, sigo: v, seguidores: x.seguidores + (v ? 1 : -1) } : x)} />}
            {d.logado && !d.eu && <Aplauso alvo={`perfil:${d.apelido}`} reacoes={d.reacoes} minha={d.minha} />}
            {!d.logado && <a className="btn outline pro-seguir" href="/?pro">👏 {d.reacoes.palma} 🔥 {d.reacoes.fogo} 😮 {d.reacoes.uau} · Entrar para reagir</a>}
            {d.eu && <span className="pro-aplauso on">👏 {d.reacoes.palma} 🔥 {d.reacoes.fogo} 😮 {d.reacoes.uau}</span>}
          </div>
          <div className="pro-tags">
            {ligaInfo && <span className={`pro-liga l-${ligaInfo.id}`}>Liga {ligaInfo.nome}</span>}
            {d.indice != null && <span className="pro-liga l-verde">Índice {pct(d.indice)}</span>}
            {d.reis.length > 0 && <span className="pro-liga l-ouro"><Crown size={14} aria-hidden="true" /> {d.reis.length}× {d.sexo === 'F' ? 'Rainha' : 'Rei'} da prova</span>}
            {d.privado && <span className="pro-liga">Perfil privado (só você vê)</span>}
          </div>
          {d.admin_uid && <button className="btn outline pro-adm-btn" onClick={() => setPainel(!painel)} aria-expanded={painel}><ShieldCheck size={16} aria-hidden="true" />{painel ? 'Fechar painel do admin' : 'Painel do admin'}</button>}
        </section>
        {d.admin_uid && painel && <Suspense fallback={<p className="fine pro-centro">Carregando o painel…</p>}>
          {msgAdm && <p className="pro-adm-msg" role="status">{msgAdm}</p>}
          <AreaAdmin uid={d.admin_uid} voltar={() => setPainel(false)} aviso={m => setMsgAdm(m)} />
        </Suspense>}

        <div className="pro-mini">
          <div><b>{d.resultados.length}</b><small>provas</small></div>
          <div><b>{Math.round(km)}</b><small>km em provas</small></div>
          <div><b>{cidades}</b><small>cidades</small></div>
          <div><b>{ganhas.length}</b><small>medalhas</small></div>
        </div>

        {d.reis.length > 0 && (
          <section className="pro-card">
            <p className="pro-k cinza">{d.sexo === 'F' ? 'Rainha' : 'Rei'} da prova</p>
            {d.reis.map(k => <div key={k.prova + k.km} className="pro-rei"><span className={'pro-coroa ' + (d.sexo === 'F' ? 'f' : 'm')}><Crown size={18} aria-hidden="true" /></span><div><b>{k.prova}</b><small>{dataBR(k.data)} · {kmTxt(Number(k.km))}</small></div><div className="pro-dir"><b>{pct(k.nota)}%</b></div></div>)}
          </section>
        )}

        <Metas provas={d.resultados.map(r => ({ data: r.data, cidade: r.cidade, status: r.status }))} indice={d.indice} liga={d.liga} />
        {d.resultados.length > 0 && <MapaCidades cidades={d.resultados.map(r => r.cidade)} titulo={`O Maranhão de @${d.apelido}`} />}
        {d.resultados.some(r => (r.uf ?? 'MA') !== 'MA' && ['verificado', 'aprovado'].includes(r.status)) && <MapaBrasil ufs={d.resultados.filter(r => ['verificado', 'aprovado'].includes(r.status)).map(r => r.uf ?? 'MA')} titulo={`O Brasil de @${d.apelido}`} />}

        <section className="pro-card">
          <div className="pro-linha"><p className="pro-k cinza">Medalhas</p><b>{ganhas.length} / {MEDALHAS.length}</b></div>
          {ganhas.length ? <div className="pro-med">{(todas ? ganhas : ganhas.slice(0, 9)).map(m => <div key={m.id} className="pro-med-item"><Desenho m={m} /><b>{m.nome}</b></div>)}</div> : <p className="fine">Ainda sem medalhas.</p>}
          {ganhas.length > 9 && <button className="btn text pro-btn" onClick={() => setTodas(!todas)}>{todas ? 'Mostrar menos' : `Ver as ${ganhas.length} medalhas`}</button>}
          <p className="fine pro-sem-margem">{GRUPOS.length} categorias · {MEDALHAS.length} medalhas no Radar Pro.</p>
        </section>

        <Recordes provas={d.resultados.map(r => ({ prova: r.prova, data: r.data, km: Number(r.km), tempo: r.tempo, status: r.status }))} />

        <section className="pro-card">
          <p className="pro-k cinza">Provas</p>
          <ul className="pro-provas">
            {d.resultados.map(r => (
              <li key={r.id}>
                <div className="pro-linha"><b>{r.prova}</b>{(r.status === 'verificado' || r.status === 'aprovado') ? <span className="pro-st ok">Oficial</span> : <span className="pro-st dec">Declarado</span>}</div>
                <p>{dataBR(r.data)} · {r.cidade} · {kmTxt(Number(r.km))} · <b>{relogio(r.tempo)}</b> · nota {pct(r.nota)}%{r.geral ? ` · ${r.geral}º geral` : ''}{r.faixa ? ` · ${r.faixa}º na faixa` : ''}</p>
              </li>
            ))}
          </ul>
        </section>

        <button className="btn outline pro-btn" onClick={compartilhar}><Share2 size={16} aria-hidden="true" />Compartilhar este perfil</button>
        <section className="pro-card pro-centro">
          <p className="pro-sem-margem"><b>Quer o seu perfil assim?</b></p>
          <p className="fine">Resultado oficial verificado sozinho, nota por idade, ligas, ranking do Maranhão e {MEDALHAS.length} medalhas.</p>
          <a className="btn solid pro-btn" href="/pro/">Conhecer o Radar Pro</a>
        </section>
      </div>
    </main>
  );
}

type ItemSegue = { apelido: string; foto: string | null; cidade: string; sigo: boolean; eu: boolean };
/** Quem segue / quem é seguido: abre ao tocar no número e fecha ao tocar de novo. */
function ListaSegue({ apelido, tipo, logado }: { apelido: string; tipo: 'seguidores' | 'seguindo'; logado: boolean }) {
  const [r, setR] = useState<{ lista: ItemSegue[]; ocultos: number; privado?: boolean } | null>(null);
  useEffect(() => { setR(null); sb.rpc('radar_segue_lista', { p_apelido: apelido, p_tipo: tipo }).then(({ data }) => setR((data ?? { lista: [], ocultos: 0 }) as { lista: ItemSegue[]; ocultos: number })); }, [apelido, tipo]);
  const muda = (ap: string, v: boolean) => setR(x => x ? { ...x, lista: x.lista.map(i => i.apelido === ap ? { ...i, sigo: v } : i) } : x);
  return (
    <div className="pro-segue-lista">
      <p className="pro-k cinza">{tipo === 'seguidores' ? 'Seguidores' : 'Seguindo'}</p>
      {!r ? <p className="pro-sub pro-sem-margem">Carregando…</p>
        : r.privado ? <p className="pro-sub pro-sem-margem">Perfil privado.</p>
        : !r.lista.length && !r.ocultos ? <p className="pro-sub pro-sem-margem">{tipo === 'seguidores' ? 'Ninguém segue ainda.' : 'Não segue ninguém ainda.'}</p>
        : <ul>
            {r.lista.map(i => (
              <li key={i.apelido}>
                <a href={linkPerfil(i.apelido)}><Avatar foto={i.foto} apelido={i.apelido} tam={40} /><span><b>@{i.apelido}</b><small>{i.cidade}</small></span></a>
                {logado && !i.eu && <Seguir apelido={i.apelido} sigo={i.sigo} mudou={v => muda(i.apelido, v)} />}
              </li>
            ))}
          </ul>}
      {r && r.ocultos > 0 && <p className="pro-sub pro-sem-margem">+ {r.ocultos} com perfil privado</p>}
    </div>
  );
}

type AtletaEq = { apelido: string; foto: string | null; cidade: string; pontos: number; provas: number };
/** Todos da mesma assessoria/grupo, ao tocar no nome da equipe. */
function ListaEquipe({ nome }: { nome: string }) {
  const [at, setAt] = useState<AtletaEq[] | null>(null);
  useEffect(() => { setAt(null); sb.rpc('radar_assessoria_publica', { p_nome: nome }).then(({ data }) => setAt(((data as { atletas?: AtletaEq[] } | null)?.atletas) ?? [])); }, [nome]);
  return (
    <div className="pro-segue-lista">
      <p className="pro-k cinza">{nome}{at ? ` · ${at.length} ${at.length === 1 ? 'atleta' : 'atletas'}` : ''}</p>
      {!at ? <p className="pro-sub pro-sem-margem">Carregando…</p>
        : !at.length ? <p className="pro-sub pro-sem-margem">Ninguém com perfil público nessa equipe.</p>
        : <ul>{at.map(a => (
            <li key={a.apelido}><a href={linkPerfil(a.apelido)}><Avatar foto={a.foto} apelido={a.apelido} tam={40} /><span><b>@{a.apelido}</b><small>{a.cidade}{a.provas ? ` · ${a.provas} ${a.provas === 1 ? 'prova' : 'provas'} · ${a.pontos} pts` : ''}</small></span></a></li>
          ))}</ul>}
      <a className="pro-segue-mais" href={linkAssessoria(nome)}>Ver página da equipe →</a>
    </div>
  );
}
