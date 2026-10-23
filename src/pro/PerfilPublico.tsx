import { useEffect, useMemo, useState } from 'react';
import { Crown, Share2 } from 'lucide-react';
import { sb, LIGAS, pct, relogio, kmTxt, dataBR, type Liga, linkPerfil } from './sb';
import { GRUPOS, MEDALHAS, medalhaSVG, type Medalha } from './medalhas';
import './pro.css';
import { Avatar } from './Foto';
import { Aplauso, Seguir, type Reacoes, type TipoReacao } from './Feed';
import { Metas } from './Metas';
import { Recordes } from './Recordes';
import { MapaCidades } from './Mapa';
import { MapaBrasil } from './MapaBrasil';
import { linkAssessoria } from './Assessoria';

// Perfil público do atleta: radarcorridasma.com.br/?atleta=apelido
// Mostra só o que já aparece no ranking (apelido, cidade, liga, provas e medalhas). Nada de nome completo, idade ou contato.
type Prova = { id: string; prova: string; data: string; cidade: string; uf?: string; km: number; tempo: number; nota: number; status: string; geral: number | null; faixa: number | null; total: number | null };
type Dados = { foto?: string | null; apelido: string; cidade: string; assessoria: string | null; sexo: 'F' | 'M'; faixa: string | null; indice: number | null; liga: Liga | null; resultados: Prova[]; medalhas: string[]; reis: { prova: string; data: string; km: number; nota: number }[]; seguidores: number; seguindo: number; reacoes: Reacoes; minha: TipoReacao | null; eu: boolean; sigo: boolean; logado: boolean };

function Desenho({ m, tam = 64 }: { m: Medalha; tam?: number }) {
  const svg = useMemo(() => medalhaSVG(m, true, tam), [m, tam]);
  return <span className="pro-med-svg" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export default function PerfilPublico({ apelido }: { apelido: string }) {
  const [d, setD] = useState<Dados | null | undefined>(undefined);
  const [todas, setTodas] = useState(false);
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
          <p className="pro-sub pro-sem-margem">{d.cidade}{d.faixa ? ` · ${d.faixa} anos` : ''}{d.assessoria ? <> · <a href={linkAssessoria(d.assessoria)}>{d.assessoria}</a></> : ''}</p>
          <p className="pro-pub-social"><b>{d.seguidores}</b> {d.seguidores === 1 ? 'seguidor' : 'seguidores'} · <b>{d.seguindo}</b> seguindo</p>
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
          </div>
        </section>

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
