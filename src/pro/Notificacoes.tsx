// Sininho de notificações: avisos (resultado verificado, duelo, renovação) e convites de grupo (com aceitar/recusar).
import { useEffect, useState } from 'react';
import { Bell, X, Check, Trophy, Swords, Users, CreditCard, Sparkles } from 'lucide-react';
import { sb } from './sb';

export type Notif = { id: string; tipo: string; titulo: string; corpo: string; url: string | null; quando: string; lido: boolean; convite?: { grupo: string; pendente: boolean; aceito: boolean | null } | null };
type Dados = { nao_lidas: number; lista: Notif[] };

const quando = (iso: string) => { const d = (Date.now() - new Date(iso).getTime()) / 60000; if (d < 60) return `há ${Math.max(1, Math.round(d))} min`; if (d < 36 * 60) return `há ${Math.round(d / 60)} h`; return `há ${Math.round(d / 1440)} dias`; };
const Icone = ({ tipo }: { tipo: string }) => tipo === 'resultado_verificado' ? <Trophy size={18} aria-hidden="true" /> : tipo.startsWith('duelo') ? <Swords size={18} aria-hidden="true" /> : tipo === 'renovacao' ? <CreditCard size={18} aria-hidden="true" /> : tipo.includes('grupo') ? <Users size={18} aria-hidden="true" /> : <Sparkles size={18} aria-hidden="true" />;

/** Carrega as notificações; atualiza a cada 60 s enquanto o app está aberto. */
export function useNotificacoes() {
  const [d, setD] = useState<Dados>({ nao_lidas: 0, lista: [] });
  const carregar = () => sb.rpc('radar_minhas_notificacoes').then(({ data }) => { if (data) setD(data as Dados); });
  useEffect(() => { carregar(); const t = setInterval(carregar, 60_000); const v = () => { if (document.visibilityState === 'visible') carregar(); }; document.addEventListener('visibilitychange', v); return () => { clearInterval(t); document.removeEventListener('visibilitychange', v); }; }, []);
  return { ...d, carregar };
}

export function Sino({ n, onClick }: { n: number; onClick: () => void }) {
  return <button className="pro-sino" onClick={onClick} aria-label={n ? `${n} notificações novas` : 'Notificações'}><Bell size={22} aria-hidden="true" />{n > 0 && <i>{n > 9 ? '9+' : n}</i>}</button>;
}

export function PainelNotificacoes({ lista, fechar, recarregar, irPara }: { lista: Notif[]; fechar: () => void; recarregar: () => void; irPara: (aba: string) => void }) {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { sb.rpc('radar_notificacoes_lidas').then(() => setTimeout(recarregar, 300)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const responder = async (grupo: string, aceitar: boolean) => {
    const { data, error } = await sb.rpc('radar_convite_responder', { p_grupo: grupo, p_aceitar: aceitar });
    if (error) return setMsg(error.message.replace(/^.*?: /, ''));
    setMsg(aceitar ? `Você entrou no grupo ${data.grupo}. Agora vocês somam pontos juntos.` : 'Convite recusado.');
    recarregar();
  };
  const abrir = (n: Notif) => {
    const h = (n.url ?? '').split('#')[1];
    if (h && ['temporada', 'feed', 'corri', 'ranking', 'duelos', 'conta'].includes(h)) { irPara(h); fechar(); }
  };
  return (
    <div className="pro-notif-fundo" onClick={fechar}>
      <section className="pro-notif" onClick={e => e.stopPropagation()} role="dialog" aria-label="Notificações">
        <div className="pro-linha"><p className="pro-k cinza"><Bell size={14} aria-hidden="true" /> Notificações</p><button className="btn text" onClick={fechar} aria-label="Fechar"><X size={18} aria-hidden="true" /></button></div>
        {msg && <p className="pro-ok">{msg}</p>}
        {lista.length === 0 && <p className="fine">Nada por aqui ainda. Você recebe aviso quando um resultado oficial sai, quando aceitam o seu duelo, quando te chamam pra um grupo e antes do seu Pro vencer.</p>}
        <ul className="pro-notif-lista">
          {lista.map(n => (
            <li key={n.id} className={n.lido ? '' : 'nova'}>
              <span className="pro-notif-ic"><Icone tipo={n.tipo} /></span>
              <div onClick={() => abrir(n)}>
                <b>{n.titulo}</b>
                <p>{n.corpo}</p>
                <small>{quando(n.quando)}</small>
                {n.convite?.pendente && <div className="pro-linha pro-esq pro-notif-acoes"><button className="btn solid" onClick={() => responder(n.convite!.grupo, true)}><Check size={15} aria-hidden="true" />Entrar no grupo</button><button className="btn text" onClick={() => responder(n.convite!.grupo, false)}>Agora não</button></div>}
                {n.convite && !n.convite.pendente && <small className={n.convite.aceito ? 'pro-verde' : ''}>{n.convite.aceito ? 'Você entrou' : 'Recusado'}</small>}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
