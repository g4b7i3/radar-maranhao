import { useEffect, useState } from 'react';
import { Crown, Share2, Users } from 'lucide-react';
import { sb, LIGAS, pct, kmTxt, dataBR, linkPerfil, type Liga } from './sb';
import { Avatar } from './Foto';
import './pro.css';
import { DesafioAssessorias } from './Desafio';

// Página pública da assessoria ou grupo: radarcorridasma.com.br/?assessoria=nome
// Mostra só o que o ranking já mostra (apelido, foto, cidade, liga, pontos). O dono da equipe divulga, o Radar ganha atletas.
type Atleta = { apelido: string; foto: string | null; cidade: string; liga: Liga | null; indice: number | null; pontos: number; provas: number; conta: boolean };
type Dados = { nome: string; temporada: number; atletas: Atleta[]; posicao: number | null; pontos: number; total_assessorias: number | null; reis: { apelido: string; foto: string | null; prova: string; data: string; km: number; sexo: 'F' | 'M'; nota: number }[] };

export const linkAssessoria = (nome: string) => `https://radarcorridasma.com.br/?assessoria=${encodeURIComponent(nome.trim())}`;

export default function Assessoria({ nome }: { nome: string }) {
  const [d, setD] = useState<Dados | null | undefined>(undefined);
  useEffect(() => {
    document.title = `${nome} · Radar Pro`;
    sb.rpc('radar_assessoria_publica', { p_nome: nome }).then(({ data }) => setD((data as Dados) ?? null));
  }, [nome]);
  if (d === undefined) return <main className="pro pro-publico"><p className="fine pro-centro">Carregando…</p></main>;
  if (d === null) return (
    <main className="pro pro-publico"><div className="pro-cont">
      <section className="pro-card pro-centro"><p className="pro-medio">{nome}</p><p>Nenhum atleta do Radar Pro com esse nome de assessoria ou grupo. O nome precisa ser escrito igual no perfil de cada atleta.</p><a className="btn solid pro-btn" href="/pro/">Conhecer o Radar Pro</a></section>
    </div></main>
  );
  const comProva = d.atletas.filter(a => a.provas > 0).length;
  const compartilhar = async () => {
    const url = linkAssessoria(d.nome);
    if (navigator.share) { try { await navigator.share({ title: `${d.nome} no Radar Pro`, url }); return; } catch { /* */ } }
    try { await navigator.clipboard.writeText(url); alert('Link copiado.'); } catch { /* */ }
  };
  return (
    <main className="pro pro-publico">
      <div className="pro-cont">
        <section className="pro-card azul pro-pub-topo">
          <a href="/" className="pro-pub-marca">Radar Corridas MA · <b>PRO</b></a>
          <div className="pro-ass-fotos" aria-hidden="true">{d.atletas.slice(0, 5).map(a => <Avatar key={a.apelido} foto={a.foto} apelido={a.apelido} tam={56} />)}</div>
          <p className="pro-medio">{d.nome}</p>
          <p className="pro-sub pro-sem-margem"><Users size={15} aria-hidden="true" /> {d.atletas.length} {d.atletas.length === 1 ? 'atleta' : 'atletas'} no Radar Pro{comProva ? ` · ${comProva} com prova na ${d.temporada === 2026 ? 'pré-temporada 2027' : `temporada ${d.temporada}`}` : ''}</p>
          <div className="pro-tags">
            {d.posicao ? <span className="pro-liga l-ouro">{d.posicao}º entre {d.total_assessorias} assessorias</span> : <span className="pro-liga l-sem">Ainda sem pontos no ranking</span>}
            <span className="pro-liga l-verde">{Math.round(Number(d.pontos))} pontos</span>
          </div>
        </section>

        {d.reis.length > 0 && (
          <section className="pro-card">
            <p className="pro-k cinza">Reis e Rainhas da prova</p>
            {d.reis.map(k => <div key={k.apelido + k.prova + k.km} className="pro-rei"><Avatar foto={k.foto} apelido={k.apelido} tam={40} /><div><b><a href={linkPerfil(k.apelido)}>@{k.apelido}</a> · {k.sexo === 'F' ? 'Rainha' : 'Rei'} da prova</b><small>{k.prova} · {dataBR(k.data)} · {kmTxt(Number(k.km))}</small></div><div className="pro-dir"><b>{pct(k.nota)}%</b></div></div>)}
          </section>
        )}

        <DesafioAssessorias minha={d.nome} />

        <section className="pro-card">
          <p className="pro-k cinza">Atletas</p>
          <ol className="pro-rank">
            {d.atletas.map((a, i) => (
              <li key={a.apelido}>
                <a className="com-foto pro-ass-linha" href={linkPerfil(a.apelido)}>
                  <b>{i + 1}</b>
                  <Avatar foto={a.foto} apelido={a.apelido} tam={36} />
                  <span>@{a.apelido}{a.conta ? <span className="pro-coroa-mini" title="Entre os 5 que somam para a equipe"> ★</span> : null} <small>· {a.cidade}{a.liga ? ` · Liga ${LIGAS.find(l => l.id === a.liga)?.nome}` : ''}</small></span>
                  <b>{Math.round(Number(a.pontos))}</b>
                </a>
              </li>
            ))}
          </ol>
          <p className="fine pro-sem-margem">★ Os 5 melhores somam os pontos da equipe no ranking de assessorias. Equipe grande e pequena disputam de igual pra igual.</p>
        </section>

        <button className="btn outline pro-btn" onClick={compartilhar}><Share2 size={16} aria-hidden="true" />Compartilhar esta página</button>
        <section className="pro-card pro-centro">
          <p className="pro-sem-margem"><b>É da {d.nome}?</b></p>
          <p className="fine">Entre no Radar Pro e escreva “{d.nome}” no campo assessoria do seu perfil. Você aparece aqui e soma pontos para a equipe.</p>
          <a className="btn solid pro-btn" href="/pro/">Entrar no Radar Pro</a>
          <p className="fine pro-sem-margem"><Crown size={13} aria-hidden="true" /> Só aparecem atletas com perfil público.</p>
        </section>
      </div>
    </main>
  );
}
