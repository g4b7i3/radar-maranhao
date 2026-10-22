// Strava na conta: conectar, ver os próprios números (4 semanas, ano, total), tênis e clubes.
// Só a própria pessoa vê isso. Não entra em ranking (regra do Strava).
import { useEffect, useState } from 'react';
import { RefreshCw, ExternalLink, Unlink } from 'lucide-react';
import { sb, chamar } from './sb';

type Tot = { corridas: number; km: number; tempo_s: number; subida_m: number };
export type DadosStrava = { nome: string; foto: string | null; cidade: string; perfil_url: string; recentes: Tot; ano: Tot; total: Tot; tenis: { nome: string; km: number; principal: boolean }[]; clubes: { nome: string; membros: number | null; url: string }[]; atualizado_em?: string };

const horas = (s: number) => { const h = Math.floor(s / 3600); const m = Math.round((s % 3600) / 60); return h ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`; };
const km = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: n < 100 ? 1 : 0 });

/** Chamado uma vez quando a pessoa volta do Strava (strava.html guarda o código). Devolve a mensagem para mostrar. */
export async function terminarConexaoStrava(): Promise<string | null> {
  let code: string | null = null, erro: string | null = null;
  try { code = sessionStorage.getItem('radar-strava-code'); erro = sessionStorage.getItem('radar-strava-erro'); sessionStorage.removeItem('radar-strava-code'); sessionStorage.removeItem('radar-strava-erro'); } catch { /* */ }
  if (erro) return 'Você não autorizou o Strava. Se quiser, tente de novo na aba Conta.';
  if (!code) return null;
  const r = await chamar<{ ok?: boolean }>('radar-strava', { acao: 'conectar', code });
  return r.erro ?? '🟠 Strava conectado! Seus números estão na aba Conta.';
}

export function StravaConta() {
  const [d, setD] = useState<DadosStrava | null | undefined>(undefined);
  const [indo, setIndo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const carregar = () => sb.rpc('radar_strava_meu').then(({ data }) => setD((data as DadosStrava) ?? null));
  useEffect(() => { carregar(); }, []);
  const conectar = async () => {
    setIndo(true); setErro(null);
    const r = await chamar<{ url: string }>('radar-strava', { acao: 'link' });
    setIndo(false);
    if (r.erro) return setErro(r.erro);
    window.location.href = r.url;
  };
  const atualizar = async () => {
    setIndo(true); setErro(null);
    const r = await chamar<{ dados: DadosStrava; reconectar?: boolean }>('radar-strava', { acao: 'atualizar' });
    setIndo(false);
    if (r.erro) { setErro(r.erro); if (r.reconectar) setD(null); return; }
    setD({ ...r.dados, atualizado_em: new Date().toISOString() });
  };
  const desconectar = async () => {
    if (!confirm('Desconectar o Strava? Os números somem da sua conta no Radar (nada muda no Strava).')) return;
    setIndo(true); await chamar('radar-strava', { acao: 'desconectar' }); setIndo(false); setD(null);
  };
  if (d === undefined) return null;
  if (d === null) return (
    <section className="pro-card">
      <p className="pro-k cinza"><StravaLogo /> Strava</p>
      <p className="fine pro-sem-margem">Conecte e veja aqui seus km das últimas 4 semanas, do ano e da vida, seus tênis e seus clubes. Só você vê; isso não entra no ranking.</p>
      <button className="btn pro-btn pro-strava-btn" disabled={indo} onClick={conectar}><StravaLogo /> Conectar com Strava</button>
      {erro && <p className="ct-erro" role="alert">{erro}</p>}
    </section>
  );
  const blocos: [string, Tot][] = [['Últimas 4 semanas', d.recentes], ['Este ano', d.ano], ['Na vida', d.total]];
  return (
    <section className="pro-card">
      <div className="pro-linha"><p className="pro-k cinza"><StravaLogo /> Seus números no Strava</p><a className="btn text pro-btn-p" href={d.perfil_url} target="_blank" rel="noopener"><ExternalLink size={14} aria-hidden="true" />Ver no Strava</a></div>
      <div className="pro-strava-grade">
        {blocos.map(([t, x]) => <div key={t}><small>{t}</small><b>{km(x.km)} km</b><span>{x.corridas} {x.corridas === 1 ? 'corrida' : 'corridas'} · {horas(x.tempo_s)}{x.subida_m ? ` · ${x.subida_m} m de subida` : ''}</span></div>)}
      </div>
      {d.tenis.length > 0 && <><p className="pro-k cinza">Tênis</p><ul className="pro-companheiros">{d.tenis.map(t => <li key={t.nome}><div><b>{t.nome}{t.principal ? ' ★' : ''}</b><small>{t.km.toLocaleString('pt-BR')} km rodados{t.km >= 600 ? ' · hora de pensar em trocar' : ''}</small></div></li>)}</ul></>}
      {d.clubes.length > 0 && <><p className="pro-k cinza">Clubes</p><ul className="pro-companheiros">{d.clubes.map(c => <li key={c.url}><div><a href={c.url} target="_blank" rel="noopener"><b>{c.nome}</b></a>{c.membros != null && <small>{c.membros.toLocaleString('pt-BR')} membros</small>}</div></li>)}</ul></>}
      <div className="pro-linha pro-quebra">
        <button className="btn outline pro-btn-p" disabled={indo} onClick={atualizar}><RefreshCw size={15} aria-hidden="true" />{indo ? 'Atualizando…' : 'Atualizar'}</button>
        <button className="btn text pro-btn-p" disabled={indo} onClick={desconectar}><Unlink size={15} aria-hidden="true" />Desconectar</button>
      </div>
      {erro && <p className="ct-erro" role="alert">{erro}</p>}
      <p className="fine pro-sem-margem">Só você vê estes dados; eles não contam no ranking do Radar.{d.atualizado_em ? ` Atualizado em ${new Date(d.atualizado_em).toLocaleDateString('pt-BR')}.` : ''} Powered by Strava.</p>
    </section>
  );
}

/** Bolinha laranja (cor do Strava). O logo oficial deles entra depois, pelo kit de marca que o Strava fornece. */
function StravaLogo() {
  return <i className="pro-strava-ponto" aria-hidden="true" />;
}
