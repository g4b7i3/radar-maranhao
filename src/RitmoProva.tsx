import { useState } from 'react';
import { ChevronDown, Flag, Gauge } from 'lucide-react';
import { lerTempo, mascaraTempo } from './CardTreino';
import { horaLargada, type Race } from './lib';

// "Meu ritmo nesta prova": dentro da ficha, calcula pace ou tempo nas distâncias da prova,
// a hora de chegada (com a largada divulgada) e as parciais.
const relogio = (s: number) => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`; };
const hora = (min: number, s: number) => { const t = Math.round(min * 60 + s) % 86400; return `${Math.floor(t / 3600)}h${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}`; };
const kmTxt = (k: number) => String(Math.round(k * 100) / 100).replace('.', ',');
const real = (k: number) => (k === 21 ? 21.0975 : k === 42 ? 42.195 : k); // meia e maratona com a medida oficial

export default function RitmoProva({ e }: { e: Race }) {
  const dists = e.distances.length ? e.distances : [5, 10];
  const [aberto, setAberto] = useState(false);
  const [km, setKm] = useState(dists[dists.length > 1 ? 1 : 0]);
  const [modo, setModo] = useState<'tempo' | 'pace'>('tempo');
  const [valor, setValor] = useState('');
  // largada da distância escolhida ("10 km às 5h"), senão a largada geral da prova
  const porDist = (e.notes ?? '').match(new RegExp(`\\b${km}\\s*km[^.;,]*?\\b(\\d{1,2})\\s*h\\s*(\\d{2})?`, 'i'));
  const larg = porDist ? Number(porDist[1]) * 60 + Number(porDist[2] ?? 0) : horaLargada(e);
  const d = real(km), s = lerTempo(valor);
  const t = s ? (modo === 'tempo' ? s : s * d) : null;
  const p = s ? (modo === 'tempo' ? s / d : s) : null;
  const ok = t && p && p >= 120 && p <= 1200 ? { t, p } : null;
  const passo = d > 12 ? 5 : 1;
  const parciais: number[] = []; for (let k = passo; k < d - 0.05; k += passo) parciais.push(k);
  const link = `/?calc=ritmo&km=${d}${ok ? `&t=${Math.round(ok.t)}` : ''}${larg != null ? `&largada=${Math.floor(larg / 60)}:${String(larg % 60).padStart(2, '0')}` : ''}`;

  return (
    <section className={aberto ? 'rp aberto' : 'rp'}>
      <button className="rp-topo" aria-expanded={aberto} onClick={() => setAberto(!aberto)} data-umami-event={aberto ? undefined : 'Ritmo na ficha: abriu'}>
        <Gauge size={18} aria-hidden="true" /><span><b>Meu ritmo nesta prova</b><small>Pace, parciais e a hora em que você cruza a linha</small></span><ChevronDown size={18} aria-hidden="true" />
      </button>
      {aberto && (
        <div className="rp-corpo">
          {dists.length > 1 && <div className="chips" role="group" aria-label="Distância">{dists.map(k => <button key={k} className="chip" aria-pressed={km === k} onClick={() => setKm(k)}>{kmTxt(k)} km</button>)}</div>}
          <div className="seg rp-modo" role="group" aria-label="Eu sei o meu">
            <button aria-pressed={modo === 'tempo'} onClick={() => { setModo('tempo'); setValor(''); }}>Meu tempo-alvo</button>
            <button aria-pressed={modo === 'pace'} onClick={() => { setModo('pace'); setValor(''); }}>Meu pace</button>
          </div>
          <label className="ct-cidade">{modo === 'tempo' ? `Tempo nos ${kmTxt(km)} km` : 'Pace (min por km)'}<input inputMode="numeric" value={valor} onChange={ev => setValor(mascaraTempo(ev.target.value).slice(0, modo === 'pace' ? 5 : 8))} placeholder={modo === 'tempo' ? (d > 15 ? 'Ex.: 1:55:00' : 'Ex.: 28:30') : 'Ex.: 5:30'} /></label>
          {s && !ok && <p className="ct-erro">Esse ritmo não parece certo. Confira os números.</p>}
          {ok && <>
            <div className="rp-res">
              <div><small>{modo === 'tempo' ? 'Seu pace' : 'Seu tempo'}</small><b>{modo === 'tempo' ? `${relogio(ok.p)}/km` : relogio(ok.t)}</b></div>
              <div><small>Velocidade</small><b>{(3600 / ok.p).toFixed(1).replace('.', ',')} km/h</b></div>
            </div>
            {larg != null
              ? <p className="rp-chegada"><Flag size={16} aria-hidden="true" /><span>Com largada às {hora(larg, 0)}, você cruza a linha por volta das <b>{hora(larg, ok.t)}</b>.</span></p>
              : <p className="fine">O horário da largada ainda não foi divulgado.</p>}
            <ol className="rp-parc" aria-label="Parciais">
              {parciais.map(k => <li key={k}><small>km {k}</small><b>{relogio(k * ok.p)}</b></li>)}
              <li className="fim"><small>chegada</small><b>{relogio(ok.t)}</b></li>
            </ol>
          </>}
          <a className="btn text rp-link" href={link} data-umami-event="Ritmo na ficha: calculadora completa">Abrir a calculadora completa →</a>
        </div>
      )}
    </section>
  );
}
