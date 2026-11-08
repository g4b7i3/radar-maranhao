// Destaque de evento parceiro na Agenda: Corre Solidário da Fox Crew (13/11/2026).
// Fica em primeiro na Agenda até o fim do dia do evento e some sozinho depois.
import { CalendarDays, Clock, MapPin, Route, Ticket, Music2, Droplets, Zap, Gift, ArrowUpRight, Instagram, UsersRound, Check, Plus, MessageCircle } from 'lucide-react';
import './fox.css';

const FIM = new Date('2026-11-14T00:00:00-03:00').getTime();
const DIA = new Date('2026-11-13T12:00:00-03:00');
const LINK = 'https://forms.gle/yQV3iQozpQr2LQBN9';
const INSTA = 'https://instagram.com/foox.crew';
const MAPA = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Praça Nossa Senhora de Nazaré, Cohatrac II, São Luís - MA');

function falta() {
  const hoje = new Date(); hoje.setHours(12, 0, 0, 0);
  const d = Math.round((DIA.getTime() - hoje.getTime()) / 864e5);
  return d <= 0 ? 'É hoje!' : d === 1 ? 'É amanhã' : `Faltam ${d} dias`;
}

/** Raposa geométrica (marca d'água do card). */
const Raposa = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
    <path d="M10 8 L38 34 L62 34 L90 8 L84 52 L50 92 L16 52 Z" fill="currentColor" />
    <path d="M16 52 L50 62 L84 52 L50 92 Z" fill="#fff" opacity=".9" />
    <path d="M44 74 L56 74 L50 84 Z" fill="#141414" />
    <path d="M30 46 L42 50 L32 54 Z M70 46 L58 50 L68 54 Z" fill="#141414" />
  </svg>
);

export function DestaqueFox() {
  if (Date.now() >= FIM) return null;
  return (
    <article className="fox" aria-label="Evento em destaque: Corre Solidário Fox Crew">
      <Raposa className="fox-marca" />
      <div className="fox-topo">
        <span className="fox-selo">Evento em destaque</span>
        <span className="fox-falta">{falta()}</span>
      </div>
      <h2 className="fox-titulo"><span>Corre solidário</span><b>Fox Crew</b></h2>
      <p className="fox-lema">Vem correr. Vem somar. <b>Vem com a Fox.</b></p>

      <dl className="fox-info">
        <div><dt><CalendarDays size={15} aria-hidden="true" />Data</dt><dd>13/11 <small>sexta</small></dd></div>
        <div><dt><Clock size={15} aria-hidden="true" />Concentração</dt><dd>19h30</dd></div>
        <div><dt><Route size={15} aria-hidden="true" />Percurso</dt><dd>5 km</dd></div>
        <div><dt><Ticket size={15} aria-hidden="true" />Inscrição</dt><dd>R$ 20</dd></div>
      </dl>

      <a className="fox-local" href={MAPA} target="_blank" rel="noopener noreferrer">
        <MapPin size={18} aria-hidden="true" />
        <span><b>Praça Nossa Senhora de Nazaré</b><small>Cohatrac II · São Luís</small></span>
        <ArrowUpRight size={16} aria-hidden="true" />
      </a>

      <ul className="fox-prog" aria-label="Programação">
        <li><Music2 size={15} aria-hidden="true" />Paredão com DJ Rasec</li>
        <li><Droplets size={15} aria-hidden="true" />Hidratação</li>
        <li><Zap size={15} aria-hidden="true" />Pré-treino</li>
        <li><Gift size={15} aria-hidden="true" />Sorteios</li>
      </ul>

      <p className="fox-texto">Um encontro que nasceu de um momento difícil e virou união, solidariedade e energia boa.</p>

      <div className="fox-bts">
        <a className="fox-btn" href={LINK} target="_blank" rel="noopener noreferrer">Garantir minha vaga<ArrowUpRight size={18} aria-hidden="true" /></a>
        <a className="fox-insta" href={INSTA} target="_blank" rel="noopener noreferrer" aria-label="Instagram da Fox Crew"><Instagram size={18} aria-hidden="true" />@foox.crew</a>
      </div>
      <p className="fox-rodape">Quem corre junto, <b>corre com a Fox!</b></p>
    </article>
  );
}

/** Grupo da Fox Crew em Comunidades: card próprio, no visual da Fox, sempre em primeiro. */
export function CardFoxGrupo({ membros, posts, membro, indo, abrir }: { membros: number; posts: number; membro: boolean; indo: boolean; abrir: () => void }) {
  return (
    <article className="fox fox-grupo" aria-label="Grupo Fox Crew">
      <Raposa className="fox-grupo-raposa" />
      <div className="fox-topo">
        <span className="fox-selo">Grupo parceiro</span>
        {membro && <span className="fox-falta fox-dentro"><Check size={13} aria-hidden="true" /> Você está</span>}
      </div>
      <h2 className="fox-titulo"><b>Fox Crew</b></h2>
      <p className="fox-lema">A crew da raposa. Treinos, corres, paredão e <b>muita energia boa.</b></p>
      <div className="fox-grupo-nums">
        {membros > 0
          ? <span><UsersRound size={15} aria-hidden="true" /><b>{membros}</b> {membros === 1 ? 'membro' : 'membros'}</span>
          : <span><UsersRound size={15} aria-hidden="true" />Grupo novo: <b>chega junto</b></span>}
        {posts > 0 && <span><MessageCircle size={15} aria-hidden="true" /><b>{posts}</b> {posts === 1 ? 'post' : 'posts'} na semana</span>}
      </div>
      <div className="fox-bts">
        <button className="fox-btn" onClick={abrir} disabled={indo}>{indo ? 'Entrando…' : membro ? <>Abrir o grupo<ArrowUpRight size={18} aria-hidden="true" /></> : <><Plus size={18} aria-hidden="true" />Entrar na Fox Crew</>}</button>
        <a className="fox-insta" href={INSTA} target="_blank" rel="noopener noreferrer" aria-label="Instagram da Fox Crew"><Instagram size={18} aria-hidden="true" />@foox.crew</a>
      </div>
      <p className="fox-rodape">Quem corre junto, <b>corre com a Fox!</b></p>
    </article>
  );
}
