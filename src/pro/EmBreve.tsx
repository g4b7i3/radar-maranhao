// Radar Pro · "Relógio e cards": conexão oficial com o Garmin Connect e a vitrine dos modelos de card da corrida.
import { useEffect, useRef, useState } from 'react';
import { Watch, Check, Plus, X } from 'lucide-react';
// @ts-expect-error módulo JS de desenho (canvas)
import { CARD_LAYOUTS, desenharCard } from './cards/desenho.js';
import { CORRIDA_DEMO, CLIMA_DEMO } from './cards/demo';
import { sb, chamar } from './sb';


const OPCOES = { fundo: 'radar', cor: 'branco', formato: 'story', img: null, clima: CLIMA_DEMO, zoom: 1, dx: 0, dy: 0,
  stats: { dist: true, pace: true, tempo: true, fc: true, elev: false, cad: false, kcal: false, passos: false, rota: true, data: true } };

function Miniatura({ layout, nome }: { layout: string; nome: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [visivel, setVisivel] = useState(false);
  useEffect(() => { // desenha só quando aparece na tela (são muitos cards grandes)
    const el = ref.current; if (!el) return;
    const ob = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisivel(true); ob.disconnect(); } }, { rootMargin: '200px' });
    ob.observe(el); return () => ob.disconnect();
  }, []);
  useEffect(() => {
    if (!visivel || !ref.current) return;
    const cv = ref.current, tmp = document.createElement('canvas');
    document.fonts.load("800 60px 'Radar Cond'").catch(() => null).then(() => desenharCard(tmp, { ...CORRIDA_DEMO, _serie: { titulo: 'Tiros', qual: true } }, { ...OPCOES, layout }))
      .then(() => { cv.width = 270; cv.height = Math.round(270 * tmp.height / tmp.width); cv.getContext('2d')!.drawImage(tmp, 0, 0, cv.width, cv.height); })
      .catch(() => null);
  }, [visivel, layout]);
  return (
    <div className="pro-breve-card" aria-label={`Modelo de card: ${nome}`}>
      <canvas ref={ref} width={270} height={480} />
      <small>{nome}</small>
    </div>
  );
}

/** Botão do Garmin: conectar (rápido, com o link já pronto) e desconectar. */
function GarminBotao() {
  const [conectado, setConectado] = useState<boolean | null>(null);
  const [msg, setMsg] = useState<string | null>(() => (location.hash.includes('garmin-erro') ? 'Não deu pra conectar o Garmin. Tente de novo.' : null));
  const [indo, setIndo] = useState(false);
  const pronto = useRef<{ url: string; em: number } | null>(null); // link da Garmin já preparado, pro toque abrir na hora
  // volta pro mesmo endereço em que o app está aberto (igual à Nexos)
  const preparar = () => chamar<{ url?: string }>('radar-garmin', { acao: 'iniciar', retorno: location.origin + location.pathname })
    .then(r => { if (r.url) pronto.current = { url: r.url, em: Date.now() }; return r; });
  useEffect(() => {
    const veioOk = location.hash.includes('garmin-ok');
    if (location.hash.includes('garmin-')) history.replaceState(null, '', location.pathname + location.search + '#temporada');
    sb.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      // voltando da Garmin: a conexão termina em 1 ou 2 segundos, então confere algumas vezes
      let voltou = veioOk; try { voltou ||= sessionStorage.getItem('radar-garmin-volta') === '1'; sessionStorage.removeItem('radar-garmin-volta'); } catch { /* */ }
      let n = 0;
      const conferir = () => sb.from('radar_minhas_integracoes').select('provedor').eq('provedor', 'garmin').then(({ data: d }) => {
        const c = !!d?.length;
        if (!c && voltou && ++n < 8) { setConectado(null); setMsg('Conectando o Garmin…'); setTimeout(conferir, 800); return; }
        setConectado(c);
        if (voltou) setMsg(c ? 'Garmin conectado! As próximas corridas do relógio chegam sozinhas.' : 'Não deu pra conectar o Garmin. Tente de novo.');
        if (!c) preparar();
      });
      conferir();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const conectar = async () => {
    setIndo(true);
    const p = pronto.current;
    try { sessionStorage.setItem('radar-garmin-volta', '1'); } catch { /* */ }
    if (p && Date.now() - p.em < 15 * 60000) { location.href = p.url; return; } // já pronto: vai direto
    const r = await preparar();
    if (r.url) { location.href = r.url; return; }
    setIndo(false); setMsg(r.erro ?? 'As chaves do Garmin ainda não estão configuradas.');
  };
  const desconectar = () => { // muda na hora; o servidor termina por trás
    setConectado(false); setMsg('Garmin desconectado.');
    chamar('radar-garmin', { acao: 'desconectar' }).then(r => { if (r.erro) { setConectado(true); setMsg(r.erro); } else preparar(); });
  };
  return (
    <span className="pro-breve-admin">
      {conectado
        ? <button className="btn outline" onClick={desconectar}>Desconectar</button>
        : <button className="btn solid" onClick={conectar} disabled={indo || conectado === null}>{indo ? 'Abrindo…' : 'Conectar'}</button>}
      {msg && <small role="status">{msg}</small>}
    </span>
  );
}

/** As outras marcas (como na Nexos): Coros, Polar, Suunto e Wahoo chegam pelo Intervals.icu, que ainda está a caminho. */
const MARCAS: [string, string][] = [['coros', 'Coros'], ['polar', 'Polar'], ['suunto', 'Suunto'], ['wahoo', 'Wahoo'], ['outro', 'Outro relógio']];
function Marcas() {
  const [aberta, setAberta] = useState<string | null>(null);
  const nome = MARCAS.find(m => m[0] === aberta)?.[1];
  return (
    <>
      <p className="pro-k cinza pro-sem-margem">Também compatível</p>
      <div className="pro-marcas">
        {MARCAS.map(([k, n]) => (
          <button key={k} className={'pro-marca' + (k === 'outro' ? ' outro' : '')} onClick={() => setAberta(k)}>
            {k === 'outro' ? <><Plus size={16} aria-hidden="true" /><small>{n}</small></> : <b>{n}</b>}
            {k !== 'outro' && <em>em breve</em>}
          </button>
        ))}
      </div>
      {aberta && (
        <div className="pro-folha" role="dialog" aria-modal="true" aria-label={nome} onClick={() => setAberta(null)}>
          <div className="pro-folha-caixa" onClick={e => e.stopPropagation()}>
            <div className="pro-linha"><b>{nome}</b><button className="btn text" onClick={() => setAberta(null)} aria-label="Fechar"><X size={20} aria-hidden="true" /></button></div>
            {aberta === 'outro'
              ? <p className="pro-sub pro-sem-margem">Amazfit, Apple Watch, Samsung, Xiaomi ou app de celular: por enquanto, registre suas provas em <b>Eu corri uma prova</b>. A importação desses relógios está nos planos do Radar.</p>
              : <p className="pro-sub pro-sem-margem">O {nome} vai se conectar ao Radar pelo <b>Intervals.icu</b>, um serviço gratuito que recebe as corridas do seu relógio. Essa conexão está chegando: assim que liberar, é só conectar uma vez e as corridas passam a chegar sozinhas, igual ao Garmin.</p>}
            <button className="btn solid" onClick={() => setAberta(null)}>Entendi</button>
          </div>
        </div>
      )}
    </>
  );
}

export function EmBreve() {
  return (
    <section className="pro-card pro-breve">
      <p className="pro-k cinza"><Watch size={14} aria-hidden="true" /> Relógio e cards</p>
      <div className="pro-breve-oficial">
        <span className="pro-breve-tag"><Check size={13} aria-hidden="true" />Integração oficial</span>
        <img src="/img/marcas/works-with-garmin-connect.png" width={211} height={48} alt="Works with the app Garmin Connect" />
      </div>
      <div className="pro-breve-con">
        <div className="pro-breve-item"><img className="pro-breve-logo" src="/img/marcas/garmin.png" width={40} height={40} alt="Garmin" /><div><b>Garmin</b><small>Conecte uma vez e cada corrida do relógio chega sozinha no Radar, com pace, frequência cardíaca, parciais e percurso.</small></div><GarminBotao /></div>
      </div>
      <Marcas />
      <p className="pro-sub pro-sem-margem">Card da corrida pro story: {CARD_LAYOUTS.length} modelos, inclusive no jeito maranhense. Abra uma atividade em <b>Minhas atividades</b>, logo abaixo, e toque em <b>Gerar card</b>.</p>
      <div className="pro-breve-galeria">{(CARD_LAYOUTS as [string, string][]).map(([k, n]) => <Miniatura key={k} layout={k} nome={n} />)}</div>
    </section>
  );
}
