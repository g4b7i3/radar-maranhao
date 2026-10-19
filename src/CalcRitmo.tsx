import { useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, Flag } from 'lucide-react';
import { lerTempo, mascaraTempo } from './CardTreino';

// Calculadora de ritmo: pace, tempo ou distância (com dois deles, acha o terceiro),
// parciais por km, hora de chegada e previsão para outras distâncias.
type Modo = 'pace' | 'tempo' | 'dist';
const DIST = [
  { km: 5, nome: '5 km' }, { km: 10, nome: '10 km' }, { km: 21.0975, nome: 'Meia (21 km)' }, { km: 42.195, nome: 'Maratona (42 km)' },
];
const nomeDist = (km: number) => DIST.find(d => Math.abs(d.km - km) < 0.01)?.nome ?? `${String(Math.round(km * 100) / 100).replace('.', ',')} km`;

/** 1:05:09 / 28:30 / 5:30 */
export function relogio(s: number) {
  s = Math.round(s);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`;
}
const kmTxt = (km: number) => String(Math.round(km * 100) / 100).replace('.', ',');
/** Hora do dia a partir de "05:30" + segundos. */
function horaMais(largada: string, s: number) {
  const m = largada.match(/^(\d{1,2}):?(\d{2})$/); if (!m) return null;
  const t = (Number(m[1]) * 3600 + Number(m[2]) * 60 + Math.round(s)) % 86400;
  return `${Math.floor(t / 3600)}h${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}`;
}
const mascaraHora = (t: string) => { const d = t.replace(/\D/g, '').slice(0, 4); return d.length <= 2 ? d : `${d.slice(0, -2)}:${d.slice(-2)}`; };
/** Previsão de Riegel (expoente 1,06): tempo em outra distância, com treino para ela. */
const riegel = (t: number, d1: number, d2: number) => t * Math.pow(d2 / d1, 1.06);

export default function CalcRitmo() {
  const [modo, setModo] = useState<Modo>('pace');
  const [km, setKm] = useState<number | null>(5);
  const [outra, setOutra] = useState('');
  const [tempo, setTempo] = useState('');
  const [pace, setPace] = useState('');
  const [largada, setLargada] = useState('');
  const [explica, setExplica] = useState(false);

  const distEscolhida = km ?? (Number(outra.replace(',', '.')) || null);
  const segTempo = lerTempo(tempo);
  const segPace = lerTempo(pace);

  const r = useMemo(() => {
    let d: number | null = null, t: number | null = null, p: number | null = null;
    if (modo === 'pace' && distEscolhida && segTempo) { d = distEscolhida; t = segTempo; p = t / d; }
    if (modo === 'tempo' && distEscolhida && segPace) { d = distEscolhida; p = segPace; t = p * d; }
    if (modo === 'dist' && segTempo && segPace) { t = segTempo; p = segPace; d = t / p; }
    if (d == null || t == null || p == null || d <= 0 || d > 300) return null;
    if (p < 120 || p > 1200) return { erro: true as const }; // menos de 2 min/km ou mais de 20 min/km: provavelmente digitou errado
    return { d, t, p, kmh: 3600 / p };
  }, [modo, distEscolhida, segTempo, segPace]);
  const ok = r && !('erro' in r) ? r : null;

  const parciais = useMemo(() => {
    if (!ok) return [];
    const passo = ok.d > 25 ? 5 : 1;
    const lista: { km: number; t: number }[] = [];
    for (let k = passo; k < ok.d - 0.05; k += passo) lista.push({ km: k, t: k * ok.p });
    lista.push({ km: ok.d, t: ok.t });
    if (ok.d > 21.2) lista.splice(lista.findIndex(x => x.km > 21.0975), 0, { km: 21.0975, t: 21.0975 * ok.p });
    return lista;
  }, [ok]);
  const previsoes = ok && ok.d >= 3 ? DIST.filter(x => Math.abs(x.km - ok.d) > 0.3).map(x => ({ ...x, t: riegel(ok.t, ok.d, x.km) })) : [];
  const chegada = ok && largada ? horaMais(largada, ok.t) : null;

  const distancia = (
    <>
      <div className="chips" role="group" aria-label="Distância">
        {DIST.map(x => <button key={x.km} className="chip" aria-pressed={km === x.km} onClick={() => setKm(x.km)}>{x.nome}</button>)}
        <button className="chip" aria-pressed={km === null} onClick={() => setKm(null)}>Outra</button>
      </div>
      {km === null && <label className="ct-cidade">Quantos km?<input inputMode="decimal" value={outra} onChange={e => setOutra(e.target.value)} placeholder="Ex.: 7,5" /></label>}
    </>
  );
  const campoTempo = (n: string) => (
    <label className="ct-cidade">{n}. Tempo total<input inputMode="numeric" value={tempo} onChange={e => setTempo(mascaraTempo(e.target.value))} placeholder="Ex.: 28:30" /></label>
  );
  const campoPace = (n: string) => (
    <label className="ct-cidade">{n}. Pace (minutos por km)<input inputMode="numeric" value={pace} onChange={e => setPace(mascaraTempo(e.target.value).slice(0, 5))} placeholder="Ex.: 5:30" /></label>
  );

  return (
    <main className="story-semana card-treino nota-idade calc-ritmo">
      <a className="story-voltar" href="/"><ArrowLeft size={18} aria-hidden="true" />Voltar para o Radar</a>
      <nav className="ni-troca" aria-label="Ferramentas de treino"><a href="/?card=treino">Card do treino</a><a href="/?nota=idade">Nota por idade</a><a href="/?calc=ritmo" aria-current="page">Ritmo</a></nav>
      <h1>Calculadora de ritmo</h1>
      <p className="fine">Descubra o seu pace, o tempo de prova ou a distância. Veja também as parciais de cada km e a hora em que você cruza a linha.</p>

      <p className="euvou-pergunta">O que você quer saber?</p>
      <div className="seg ni-seg cr-modo" role="group" aria-label="O que calcular">
        <button aria-pressed={modo === 'pace'} onClick={() => setModo('pace')}>Pace</button>
        <button aria-pressed={modo === 'tempo'} onClick={() => setModo('tempo')}>Tempo</button>
        <button aria-pressed={modo === 'dist'} onClick={() => setModo('dist')}>Distância</button>
      </div>

      {modo !== 'dist' && <><p className="euvou-pergunta">1. Distância</p>{distancia}</>}
      {modo === 'pace' && campoTempo('2')}
      {modo === 'tempo' && campoPace('2')}
      {modo === 'dist' && <>{campoTempo('1')}{campoPace('2')}</>}
      <p className="fine ct-dica">Só os números: <b>2830</b> vira <b>28:30</b>; <b>530</b> vira <b>5:30</b>; <b>15500</b> vira <b>1:55:00</b>.</p>

      {r && 'erro' in r && <p className="ct-erro" role="alert">Esse ritmo não parece certo (ficou fora de 2 a 20 minutos por km). Confira os números.</p>}
      {!r && <p className="ni-vazio">Preencha os campos e o resultado aparece aqui.</p>}

      {ok && (
        <section className="ni-res cr-res" aria-live="polite">
          <p className="cr-rot">{modo === 'pace' ? 'Seu pace' : modo === 'tempo' ? 'Seu tempo' : 'Você corre'}</p>
          <div className="ni-pct"><b>{modo === 'pace' ? relogio(ok.p) : modo === 'tempo' ? relogio(ok.t) : kmTxt(ok.d)}</b><span className="cr-un">{modo === 'pace' ? '/km' : modo === 'tempo' ? '' : 'km'}</span></div>
          <dl className="ni-dl cr-dl">
            <div><dt>Distância</dt><dd>{nomeDist(ok.d)}</dd></div>
            <div><dt>Tempo</dt><dd>{relogio(ok.t)}</dd></div>
            <div><dt>Pace</dt><dd>{relogio(ok.p)} <small>/km</small></dd></div>
            <div><dt>Velocidade</dt><dd>{ok.kmh.toFixed(1).replace('.', ',')} <small>km/h</small></dd></div>
          </dl>

          <label className="ct-cidade cr-larg">Horário da largada <small>(opcional)</small><input inputMode="numeric" value={largada} onChange={e => setLargada(mascaraHora(e.target.value))} placeholder="Ex.: 05:30" /></label>
          {chegada && <p className="cr-chegada"><Flag size={18} aria-hidden="true" /><span>Você cruza a linha de chegada por volta das <b>{chegada}</b>.</span></p>}

          <h2 className="cr-h2">Parciais</h2>
          <div className="cr-tab" role="table" aria-label="Parciais">
            <div className="cr-lin cr-cab" role="row"><span role="columnheader">km</span><span role="columnheader">Tempo</span>{chegada && <span role="columnheader">Hora</span>}</div>
            {parciais.map(x => (
              <div className={Math.abs(x.km - ok.d) < 0.01 ? 'cr-lin fim' : Math.abs(x.km - 21.0975) < 0.01 ? 'cr-lin meia' : 'cr-lin'} role="row" key={x.km}>
                <span role="cell">{Math.abs(x.km - ok.d) < 0.01 ? `${kmTxt(x.km)} (chegada)` : Math.abs(x.km - 21.0975) < 0.01 ? '21,1 (meia)' : kmTxt(x.km)}</span>
                <span role="cell">{relogio(x.t)}</span>
                {chegada && <span role="cell">{horaMais(largada, x.t)}</span>}
              </div>
            ))}
          </div>

          {previsoes.length > 0 && <>
            <h2 className="cr-h2">Nesse ritmo de prova, você faria…</h2>
            <ul className="cr-prev">
              {previsoes.map(x => <li key={x.km}><span>{x.nome}</span><b>{relogio(x.t)}</b><small>{relogio(x.t / x.km)}/km</small></li>)}
            </ul>
            <p className="fine">É uma estimativa (fórmula de Riegel) para quem treinou para aquela distância. Em distâncias maiores, o pace naturalmente fica um pouco mais lento.</p>
          </>}
        </section>
      )}

      <button className="ni-explica-btn" aria-expanded={explica} onClick={() => setExplica(!explica)}>Como funciona? <ChevronDown size={16} aria-hidden="true" /></button>
      {explica && (
        <div className="ni-explica">
          <p><b>Pace</b> é quanto tempo você leva para correr 1 km. Pace 6:00 = 6 minutos por km = 10 km/h.</p>
          <p>Com <b>distância e tempo</b>, achamos o pace. Com <b>distância e pace</b>, o tempo. Com <b>tempo e pace</b>, a distância.</p>
          <p>As parciais mostram o tempo em cada km se você mantiver o mesmo ritmo do começo ao fim. A previsão usa a fórmula de Pete Riegel, muito usada por treinadores.</p>
        </div>
      )}
    </main>
  );
}
