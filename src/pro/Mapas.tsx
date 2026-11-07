// Radar · Mapas: criar rotas tocando no mapa (o caminho segue as ruas), salvar e usar no Gravar.
import { useEffect, useRef, useState } from 'react';
import { Plus, X, Undo2, Trash2, Repeat, Check, MapPin, ChevronRight, Play, Crosshair, Mountain, Share2, Link2, BookmarkPlus, Layers } from 'lucide-react';
import type { Map as MLMap, GeoJSONSource, Marker } from 'maplibre-gl';
import { sb, chamar } from './sb';
import { MapaCorrida, ESTILOS } from './MapaCorrida';

type P = [number, number];
export type Rota = { id: string; nome: string; pontos: P[]; geometria: P[]; distancia_m: number; subida_m: number | null; piso: { tipo: string; pct: number }[] | null; elevacao: number[] | null; ida_volta: boolean; criado_em: string; compartilhada?: boolean };
type Recebida = Rota & { autor: string | null; minha: boolean };
type Calculo = { geometria: P[]; distancia_m: number; subida_m: number | null; descida_m: number | null; piso: Rota['piso']; elevacao: number[] | null; fonte: string };

const kmTxt = (m: number) => (m / 1000).toFixed(m >= 10000 ? 1 : 2).replace('.', ',');
const NOME_PISO: Record<string, [string, string]> = { asfalto: ['Asfalto', '#1d3fbf'], concreto: ['Concreto', '#5b7cff'], paralelepipedo: ['Paralelepípedo', '#8fa6ff'], terra: ['Terra', '#b07a3b'], cascalho: ['Cascalho', '#c9a227'], areia: ['Areia', '#f2d58a'], grama: ['Grama', '#2fbf71'], madeira: ['Madeira', '#8d6e63'], metal: ['Metal', '#9aa4cc'], nao_informado: ['Não informado', '#d5d9e4'] };
const escuro = () => document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
const estiloMapa = () => { try { const v = localStorage.getItem('radar-mapa-estilo'); if (v === 'positron' || v === 'fiord' || v === 'bright') return v; } catch { /* */ } return escuro() ? 'fiord' : 'positron'; };

// link de rota compartilhada (/?rota=id) guardado até a pessoa entrar
export const rotaPedida = (): string | null => { try { return localStorage.getItem('radar-abrir-rota'); } catch { return null; } };
export const linkRota = (id: string) => `https://radarcorridasma.com.br/?rota=${id}`;

/** Desenho pequeno do percurso (pra lista). */
function Miniatura({ g }: { g: P[] }) {
  if (g.length < 2) return null;
  const la = g.map(p => p[0]), lo = g.map(p => p[1]);
  const a0 = Math.min(...la), a1 = Math.max(...la), o0 = Math.min(...lo), o1 = Math.max(...lo);
  const k = Math.cos(((a0 + a1) / 2) * Math.PI / 180), w = Math.max((o1 - o0) * k, 1e-6), h = Math.max(a1 - a0, 1e-6), s = 52 / Math.max(w, h);
  const pts = g.map(p => `${(4 + ((p[1] - o0) * k) * s + (52 - w * s) / 2).toFixed(1)},${(4 + (a1 - p[0]) * s + (52 - h * s) / 2).toFixed(1)}`).join(' ');
  return <svg className="mp-mini" viewBox="0 0 60 60" aria-hidden="true"><polyline points={pts} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function BarraPiso({ piso }: { piso: Rota['piso'] }) {
  if (!piso?.length) return null;
  return (
    <div className="mp-piso">
      <div className="mp-piso-barra">{piso.map(p => <i key={p.tipo} style={{ width: `${p.pct}%`, background: (NOME_PISO[p.tipo] ?? NOME_PISO.nao_informado)[1] }} />)}</div>
      <div className="mp-piso-leg">{piso.filter(p => p.pct >= 1).map(p => <span key={p.tipo}><i style={{ background: (NOME_PISO[p.tipo] ?? NOME_PISO.nao_informado)[1] }} />{(NOME_PISO[p.tipo] ?? NOME_PISO.nao_informado)[0]} {Math.round(p.pct)}%</span>)}</div>
    </div>
  );
}

export function TelaMapas({ correr }: { correr: (r: Rota) => void }) {
  const [rotas, setRotas] = useState<Rota[] | null>(null);
  const [criando, setCriando] = useState(false);
  const [aberta, setAberta] = useState<Rota | null>(null);
  const [recebida, setRecebida] = useState<Recebida | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const carregar = () => sb.from('radar_rotas').select('*').order('criado_em', { ascending: false }).then(({ data }) => setRotas((data ?? []) as Rota[]));
  useEffect(() => {
    carregar();
    const id = rotaPedida(); if (!id) return;
    try { localStorage.removeItem('radar-abrir-rota'); } catch { /* */ }
    sb.rpc('radar_rota_publica', { p_id: id }).then(({ data }) => {
      const r = data as Recebida | null;
      if (!r) return setAviso('Essa rota não existe mais ou deixou de ser compartilhada.');
      if (r.minha) setAberta(r); else setRecebida(r);
    });
  }, []);
  return (
    <div className="pro-cont mp">
      <section className="pro-card mp-capa">
        <p className="pro-k cinza pro-sem-margem"><MapPin size={14} aria-hidden="true" /> Minhas rotas</p>
        <p className="pro-sub pro-sem-margem">Toque no mapa pra marcar o caminho: o Radar segue as ruas e calcula a distância. Depois é só correr a rota no <b>Gravar</b>.</p>
        <button className="btn solid pro-btn" onClick={() => setCriando(true)}><Plus size={18} aria-hidden="true" />Criar rota</button>
      </section>
      {aviso && <p className="ct-erro" role="alert">{aviso}</p>}
      {rotas === null && <p className="fine">Carregando…</p>}
      {rotas?.length === 0 && <p className="fine pro-centro">Nenhuma rota ainda. Crie a primeira: a sua volta na orla, o caminho do treino longo…</p>}
      {!!rotas?.length && <ul className="mp-lista">
        {rotas.map(r => (
          <li key={r.id}><button onClick={() => setAberta(r)}>
            <Miniatura g={r.geometria} />
            <span className="mp-lista-t"><b>{r.nome}</b><small>{kmTxt(r.distancia_m)} km{r.subida_m != null ? ` · ${r.subida_m} m de subida` : ''}{r.ida_volta ? ' · ida e volta' : ''}</small></span>
            <ChevronRight size={18} aria-hidden="true" />
          </button></li>
        ))}
      </ul>}
      {criando && <EditorRota fechar={() => setCriando(false)} salvou={r => { setCriando(false); carregar(); setAberta(r); }} />}
      {aberta && <DetalheRota r={aberta} fechar={() => setAberta(null)} correr={() => { setAberta(null); correr(aberta); }} apagou={() => { setAberta(null); carregar(); }} mudou={r => { setAberta(r); carregar(); }} />}
      {recebida && <RotaRecebida r={recebida} fechar={() => setRecebida(null)} correr={() => { const r = recebida; setRecebida(null); correr(r); }} salvou={r => { setRecebida(null); carregar(); setAberta(r); }} />}
    </div>
  );
}

function DetalheRota({ r, fechar, correr, apagou, mudou }: { r: Rota; fechar: () => void; correr: () => void; apagou: () => void; mudou: (r: Rota) => void }) {
  const [certeza, setCerteza] = useState(false);
  const [enviar, setEnviar] = useState(false);
  const apagar = async () => { await sb.from('radar_rotas').delete().eq('id', r.id); apagou(); };
  return (
    <div className="pro-folha" role="dialog" aria-modal="true" aria-label={r.nome} onClick={fechar}>
      <div className="pro-folha-caixa" onClick={e => e.stopPropagation()}>
        <div className="pro-linha"><b>{r.nome}</b><button className="btn text" onClick={fechar} aria-label="Fechar"><X size={20} aria-hidden="true" /></button></div>
        <MapaCorrida rota={r.geometria} />
        <div className="mp-nums"><span><small>Distância</small><b>{kmTxt(r.distancia_m)} km</b></span>{r.subida_m != null && <span><small>Subida</small><b>{r.subida_m} m</b></span>}<span><small>Tipo</small><b>{r.ida_volta ? 'Ida e volta' : 'Só ida'}</b></span></div>
        <BarraPiso piso={r.piso} />
        <div className="mp-acoes">
          <button className="btn solid pro-btn" onClick={correr}><Play size={18} aria-hidden="true" />Correr esta rota</button>
          <button className="btn outline pro-btn" onClick={() => setEnviar(true)}><Share2 size={18} aria-hidden="true" />Enviar</button>
        </div>
        {r.compartilhada && <small className="mp-status"><Link2 size={13} aria-hidden="true" /> Compartilhada: quem tem o link vê esta rota.</small>}
        {enviar && <EnviarRota r={r} fechar={() => setEnviar(false)} mudou={mudou} />}
        {certeza
          ? <div className="pro-grav-confirma"><span>Apagar esta rota?</span><button className="btn outline" onClick={() => setCerteza(false)}>Não</button><button className="btn text pro-grav-apagar" onClick={apagar}>Sim, apagar</button></div>
          : <button className="btn text pro-grav-apagar" onClick={() => setCerteza(true)}><Trash2 size={16} aria-hidden="true" />Apagar rota</button>}
      </div>
    </div>
  );
}

/* ───────── editor: toca no mapa, o caminho segue as ruas ───────── */
function EditorRota({ fechar, salvou }: { fechar: () => void; salvou: (r: Rota) => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  const mapa = useRef<MLMap | null>(null);
  const marcadores = useRef<Marker[]>([]);
  const ml = useRef<typeof import('maplibre-gl') | null>(null);
  const [pontos, setPontos] = useState<P[]>([]);
  const [calc, setCalc] = useState<Calculo | null>(null);
  const [idaVolta, setIdaVolta] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [salvando, setSalvando] = useState<'nome' | 'indo' | null>(null);
  const [pronto, setPronto] = useState(false);
  const [estilo, setEstilo] = useState(estiloMapa);
  const [menuEstilo, setMenuEstilo] = useState(false);
  const [p3d, setP3d] = useState(false);
  const pedido = useRef(0);
  const geomRef = useRef<P[]>([]);

  useEffect(() => {
    let vivo = true, m: MLMap | null = null;
    Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css')]).then(([lib]) => {
      if (!vivo || !caixa.current) return; ml.current = lib;
      m = new lib.Map({ container: caixa.current, style: `https://tiles.openfreemap.org/styles/${estiloMapa()}`, center: [-44.27, -2.5], zoom: 13, attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false, touchPitch: false });
      mapa.current = m;
      // camada do caminho (refeita a cada troca de estilo)
      const camadas = () => {
        if (!m || m.getSource('rota')) return;
        m.addSource('rota', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: geomRef.current.map(p => [p[1], p[0]]) } } });
        m.addLayer({ id: 'rota-borda', type: 'line', source: 'rota', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#0a1240', 'line-width': 9, 'line-opacity': .55 } });
        m.addLayer({ id: 'rota', type: 'line', source: 'rota', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffd34d', 'line-width': 5 } });
      };
      m.on('style.load', () => { if (vivo) camadas(); });
      m.on('load', () => { if (!vivo || !m) return; camadas(); setPronto(true); });
      m.on('click', e => setPontos(ps => (ps.length >= 40 ? ps : [...ps, [+e.lngLat.lat.toFixed(6), +e.lngLat.lng.toFixed(6)]])));
      navigator.geolocation?.getCurrentPosition(p => { if (vivo && m) m.jumpTo({ center: [p.coords.longitude, p.coords.latitude], zoom: 15 }); }, () => null, { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 });
    });
    return () => { vivo = false; m?.remove(); mapa.current = null; };
  }, []);

  // marcadores dos pontos tocados
  useEffect(() => {
    const m = mapa.current, lib = ml.current; if (!m || !lib) return;
    marcadores.current.forEach(x => x.remove());
    marcadores.current = pontos.map((p, i) => {
      const el = document.createElement('div'); el.className = 'mp-ponto' + (i === 0 ? ' ini' : i === pontos.length - 1 ? ' fim' : ''); el.textContent = i === 0 ? 'A' : i === pontos.length - 1 ? 'B' : '';
      return new lib.Marker({ element: el }).setLngLat([p[1], p[0]]).addTo(m);
    });
  }, [pontos, pronto]);

  // traça pelas ruas a cada ponto novo
  useEffect(() => {
    if (pontos.length < 2) { setCalc(null); return; }
    const n = ++pedido.current; setCalculando(true); setErro(null);
    const t = setTimeout(() => {
      chamar<Calculo>('radar-rotas', { pontos }).then(r => {
        if (n !== pedido.current) return; setCalculando(false);
        if (r.erro || !r.geometria) { setErro(r.erro ?? 'Não deu pra traçar a rota.'); return; }
        setCalc(r);
      });
    }, 350);
    return () => clearTimeout(t);
  }, [pontos]);

  // desenha
  const geom: P[] = calc ? (idaVolta ? [...calc.geometria, ...[...calc.geometria].reverse().slice(1)] : calc.geometria) : [];
  geomRef.current = geom;
  const dist = calc ? calc.distancia_m * (idaVolta ? 2 : 1) : 0;
  const subida = calc?.subida_m != null ? (idaVolta ? calc.subida_m + (calc.descida_m ?? 0) : calc.subida_m) : null;
  useEffect(() => {
    const m = mapa.current; if (!m || !pronto) return;
    (m.getSource('rota') as GeoJSONSource | undefined)?.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: geom.map(p => [p[1], p[0]]) } });
  }, [geom.length, pronto, idaVolta, calc]); // eslint-disable-line react-hooks/exhaustive-deps

  const trocarEstilo = (e: typeof estilo) => {
    setMenuEstilo(false); if (e === estilo) return;
    setEstilo(e); try { localStorage.setItem('radar-mapa-estilo', e); } catch { /* */ }
    mapa.current?.setStyle(`https://tiles.openfreemap.org/styles/${e}`, { diff: false });
  };
  const trocar3d = () => { const n = !p3d; setP3d(n); mapa.current?.easeTo({ pitch: n ? 60 : 0, duration: 600 }); };
  const minhaPosicao = () => navigator.geolocation?.getCurrentPosition(p => mapa.current?.easeTo({ center: [p.coords.longitude, p.coords.latitude], zoom: 15.5 }), () => setErro('Libere a localização pra centralizar no mapa.'));
  const salvar = async () => {
    if (!calc) return;
    if (!nome.trim()) return setErro('Dê um nome à rota.');
    setSalvando('indo');
    const { data, error } = await sb.from('radar_rotas').insert({ nome: nome.trim().slice(0, 60), pontos, geometria: geom, distancia_m: Math.max(1, Math.round(dist)), subida_m: subida, piso: calc.piso, elevacao: calc.elevacao, ida_volta: idaVolta }).select().single();
    setSalvando('nome');
    if (error || !data) return setErro(error?.message.includes('row-level') ? 'Você chegou ao limite de 100 rotas.' : 'Não deu pra salvar agora. Tente de novo.');
    salvou(data as Rota);
  };

  return (
    <div className="mp-editor" role="dialog" aria-modal="true" aria-label="Criar rota">
      <div ref={caixa} className="mp-editor-mapa" />
      <div className="mp-editor-topo">
        <button className="mp-redondo" onClick={fechar} aria-label="Fechar"><X size={20} /></button>
        <span className="mp-editor-dica">{pontos.length === 0 ? 'Toque no mapa onde a rota começa' : pontos.length === 1 ? 'Agora toque onde ela vai' : 'Toque pra continuar o caminho'}</span>
        <button className="mp-redondo" onClick={minhaPosicao} aria-label="Ir pra minha posição"><Crosshair size={19} /></button>
      </div>
      {pronto && <div className="mp-editor-lado">
        <button className="mp-redondo" onClick={() => setMenuEstilo(v => !v)} aria-label="Estilo do mapa" aria-expanded={menuEstilo}><Layers size={19} /></button>
        <button className="mp-redondo mp-3d" onClick={trocar3d} aria-label={p3d ? 'Ver o mapa de cima (2D)' : 'Ver o mapa inclinado (3D)'}>{p3d ? '2D' : '3D'}</button>
      </div>}
      {menuEstilo && <div className="pro-mapa-estilos mp-editor-estilos" role="menu" aria-label="Estilo do mapa">
        {ESTILOS.map(e => (
          <button key={e.id} role="menuitemradio" aria-checked={estilo === e.id} className={estilo === e.id ? 'on' : ''} onClick={() => trocarEstilo(e.id)}>
            <i style={{ background: e.cor }}>{estilo === e.id && <Check size={14} />}</i>
            <span><b>{e.nome}</b><small>{e.d}</small></span>
          </button>
        ))}
      </div>}
      <div className="mp-editor-painel">
        <div className="mp-nums">
          <span><small>Distância</small><b>{calc ? `${kmTxt(dist)} km` : '–'}</b></span>
          <span><small><Mountain size={12} aria-hidden="true" /> Subida</small><b>{subida != null ? `${subida} m` : '–'}</b></span>
          <span><small>Pontos</small><b>{pontos.length}</b></span>
        </div>
        <BarraPiso piso={calc?.piso ?? null} />
        {calculando && <small className="mp-status">Traçando pelas ruas…</small>}
        {erro && <p className="ct-erro" role="alert">{erro}</p>}
        <div className="mp-editor-bts">
          <button className="btn outline" onClick={() => setPontos(ps => ps.slice(0, -1))} disabled={!pontos.length}><Undo2 size={17} aria-hidden="true" />Desfazer</button>
          <button className={'btn outline' + (idaVolta ? ' on' : '')} onClick={() => setIdaVolta(v => !v)} disabled={!calc} aria-pressed={idaVolta}><Repeat size={17} aria-hidden="true" />Ida e volta</button>
          <button className="btn outline" onClick={() => { setPontos([]); setIdaVolta(false); }} disabled={!pontos.length}><Trash2 size={17} aria-hidden="true" />Limpar</button>
        </div>
        {salvando ? <div className="mp-salvar">
          <input autoFocus value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome da rota (ex.: Volta da Litorânea)" maxLength={60} aria-label="Nome da rota" />
          <button className="btn solid" onClick={salvar} disabled={salvando === 'indo'}><Check size={18} aria-hidden="true" />{salvando === 'indo' ? 'Salvando…' : 'Salvar'}</button>
        </div> : <button className="btn solid pro-btn" onClick={() => { setErro(null); setSalvando('nome'); }} disabled={!calc || calculando}><Check size={18} aria-hidden="true" />Salvar rota</button>}
        {calc?.fonte === 'osm' && <small className="mp-status">Caminho pelas ruas do OpenStreetMap.</small>}
      </div>
    </div>
  );
}

/* ───────── enviar a rota (pros alunos, pro grupo do treino…) ───────── */
function EnviarRota({ r, fechar, mudou }: { r: Rota; fechar: () => void; mudou: (r: Rota) => void }) {
  const [estado, setEstado] = useState<'pronto' | 'abrindo' | 'copiado' | 'erro'>(r.compartilhada ? 'pronto' : 'abrindo');
  const url = linkRota(r.id);
  const texto = `Rota do treino: ${r.nome} (${kmTxt(r.distancia_m)} km). Abra no Radar pra ver no mapa e correr com ela:`;
  useEffect(() => {
    if (r.compartilhada) return;
    sb.from('radar_rotas').update({ compartilhada: true }).eq('id', r.id).then(({ error }) => {
      if (error) return setEstado('erro');
      setEstado('pronto'); mudou({ ...r, compartilhada: true });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const copiar = async () => { try { await navigator.clipboard.writeText(`${texto} ${url}`); setEstado('copiado'); } catch { setEstado('erro'); } };
  const outros = async () => { try { await navigator.share({ title: r.nome, text: texto, url }); } catch { /* cancelou */ } };
  const parar = async () => { await sb.from('radar_rotas').update({ compartilhada: false }).eq('id', r.id); mudou({ ...r, compartilhada: false }); fechar(); };
  const ok = estado !== 'abrindo' && estado !== 'erro';
  return (
    <div className="mp-enviar" role="group" aria-label="Enviar rota">
      <div className="pro-linha"><b>Enviar a rota</b><button className="btn text" onClick={fechar} aria-label="Fechar"><X size={18} aria-hidden="true" /></button></div>
      <p className="pro-sub pro-sem-margem">Mande pros alunos ou pro grupo do treino. Quem abrir vê a rota no mapa e pode salvar e correr com ela no Gravar.</p>
      {estado === 'erro' && <p className="ct-erro" role="alert">Não deu pra gerar o link agora. Tente de novo.</p>}
      <div className="mp-enviar-bts">
        <a className={'btn solid' + (ok ? '' : ' desab')} aria-disabled={!ok} href={ok ? `https://wa.me/?text=${encodeURIComponent(`${texto} ${url}`)}` : undefined} target="_blank" rel="noopener noreferrer">WhatsApp</a>
        <button className="btn outline" onClick={copiar} disabled={!ok}>{estado === 'copiado' ? <><Check size={17} aria-hidden="true" />Copiado</> : <><Link2 size={17} aria-hidden="true" />Copiar link</>}</button>
        {typeof navigator.share === 'function' && <button className="btn outline" onClick={outros} disabled={!ok}><Share2 size={17} aria-hidden="true" />Outros</button>}
      </div>
      {ok && <button className="btn text mp-parar" onClick={parar}>Parar de compartilhar</button>}
    </div>
  );
}

/* ───────── rota que alguém mandou ───────── */
function RotaRecebida({ r, fechar, correr, salvou }: { r: Recebida; fechar: () => void; correr: () => void; salvou: (r: Rota) => void }) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const salvar = async () => {
    setSalvando(true); setErro(null);
    const { data, error } = await sb.from('radar_rotas').insert({ nome: r.nome, pontos: r.pontos, geometria: r.geometria, distancia_m: r.distancia_m, subida_m: r.subida_m, piso: r.piso, elevacao: r.elevacao, ida_volta: r.ida_volta }).select().single();
    setSalvando(false);
    if (error || !data) return setErro(error?.message.includes('row-level') ? 'Você chegou ao limite de 100 rotas.' : 'Não deu pra salvar agora. Tente de novo.');
    salvou(data as Rota);
  };
  return (
    <div className="pro-folha" role="dialog" aria-modal="true" aria-label={r.nome} onClick={fechar}>
      <div className="pro-folha-caixa" onClick={e => e.stopPropagation()}>
        <div className="pro-linha"><span><small className="pro-k cinza">Rota enviada{r.autor ? ` por @${r.autor}` : ''}</small><b className="mp-rec-nome">{r.nome}</b></span><button className="btn text" onClick={fechar} aria-label="Fechar"><X size={20} aria-hidden="true" /></button></div>
        <MapaCorrida rota={r.geometria} />
        <div className="mp-nums"><span><small>Distância</small><b>{kmTxt(r.distancia_m)} km</b></span>{r.subida_m != null && <span><small>Subida</small><b>{r.subida_m} m</b></span>}<span><small>Tipo</small><b>{r.ida_volta ? 'Ida e volta' : 'Só ida'}</b></span></div>
        <BarraPiso piso={r.piso} />
        {erro && <p className="ct-erro" role="alert">{erro}</p>}
        <div className="mp-acoes">
          <button className="btn solid pro-btn" onClick={salvar} disabled={salvando}><BookmarkPlus size={18} aria-hidden="true" />{salvando ? 'Salvando…' : 'Salvar rota'}</button>
          <button className="btn outline pro-btn" onClick={correr}><Play size={18} aria-hidden="true" />Correr agora</button>
        </div>
      </div>
    </div>
  );
}
