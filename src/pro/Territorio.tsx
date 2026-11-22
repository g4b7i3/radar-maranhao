// Radar · Território: o Maranhão em hexágonos. Quem corre domina; para tomar, precisa correr mais forte (nota por idade).
// A casa marcada esconde dos outros o que fica perto dela. As regras ficam no banco (radar_priv.terr_*).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, Home, Hexagon, Crown, Flame, Shield, Check, X, ChevronDown, ChevronUp, MapPin, Snowflake } from 'lucide-react';
import type { Map as MLMap, GeoJSONSource, Marker } from 'maplibre-gl';
import { sb } from './sb';
import './territorio.css';

type Hex = { hex: string; lat: number; lng: number; dono: string | null; dono_foto: string | null; eu: boolean; forca: number | null; desde: string | null; minha_forca: number | null; reacoes: Record<string, number>; minha_reacao: string | null };
type Meu = { hexagonos: number; ganhos_7d: number; perdidos_7d: number; esfriando: number; casa: { lat: number; lng: number; raio_m: number } | null };
type Placar = { posicao: number; nome: string; foto: string | null; hexagonos: number; eu: boolean };

const EMOJIS = ['🔥', '💪', '👀', '👑', '😂', '⚡'];
const S = 0.0015, K = 0.9986; // mesma grade do banco
const CORES = ['#1d3fbf', '#2f9e8f', '#5b7cff', '#0f766e', '#3b82c4', '#6d7fe0'];
const OURO = '#ffd34d';
const escuro = () => document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
const estilo = () => `https://tiles.openfreemap.org/styles/${escuro() ? 'fiord' : 'positron'}`;
const num = (n: number | null | undefined) => (n == null ? '–' : String(Number(n).toFixed(1)).replace('.', ','));
const corDe = (nome: string) => { let h = 0; for (const c of nome) h = (h * 31 + c.charCodeAt(0)) >>> 0; return CORES[h % CORES.length]; };
const dias = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000));
const haTempo = (iso: string) => { const d = dias(iso); return d === 0 ? 'hoje' : d === 1 ? 'ontem' : `há ${d} dias`; };

function poligono(hex: string, f = 0.92): [number, number][] {
  const [q, r] = hex.split('_').map(Number);
  const cx = S * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r), cy = S * 1.5 * r;
  const pts: [number, number][] = [];
  for (let i = 0; i <= 6; i++) { const a = Math.PI / 180 * (60 * i - 30); pts.push([(cx + S * f * Math.cos(a)) / K, cy + S * f * Math.sin(a)]); }
  return pts;
}
function circulo(lat: number, lng: number, m: number): [number, number][] {
  const out: [number, number][] = [], dLat = m / 111320, dLng = m / (111320 * Math.cos(lat * Math.PI / 180));
  for (let i = 0; i <= 48; i++) { const a = i / 48 * 2 * Math.PI; out.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]); }
  return out;
}
/** Blocos de território: hexágonos vizinhos do mesmo dono viram um bloco só (uma foto por bloco). */
type Bloco = { nome: string; foto: string | null; eu: boolean; tamanho: number; centro: Hex };
const VIZ = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
function blocos(lista: Hex[]): Bloco[] {
  const porHex = new Map(lista.filter(h => h.dono).map(h => [h.hex, h]));
  const dono = (h: Hex) => (h.eu ? '\u0000eu' : h.dono!);
  const visto = new Set<string>(), out: Bloco[] = [];
  for (const h of porHex.values()) {
    if (visto.has(h.hex)) continue;
    const grupo: Hex[] = [], fila = [h]; visto.add(h.hex);
    while (fila.length) {
      const a = fila.pop()!; grupo.push(a);
      const [q, r] = a.hex.split('_').map(Number);
      for (const [dq, dr] of VIZ) {
        const v = porHex.get(`${q + dq}_${r + dr}`);
        if (v && !visto.has(v.hex) && dono(v) === dono(h)) { visto.add(v.hex); fila.push(v); }
      }
    }
    const la = grupo.reduce((s, x) => s + x.lat, 0) / grupo.length, lo = grupo.reduce((s, x) => s + x.lng, 0) / grupo.length;
    const centro = grupo.reduce((m, x) => (Math.hypot(x.lat - la, x.lng - lo) < Math.hypot(m.lat - la, m.lng - lo) ? x : m), grupo[0]);
    out.push({ nome: h.dono!, foto: h.dono_foto, eu: h.eu, tamanho: grupo.length, centro });
  }
  return out;
}

const geoHex = (lista: Hex[]) => ({
  type: 'FeatureCollection' as const,
  features: lista.map(h => ({
    type: 'Feature' as const, id: undefined,
    properties: { hex: h.hex, cor: h.eu ? OURO : h.dono ? corDe(h.dono) : '#9aa4cc', altura: h.forca != null ? 20 + h.forca * 4 : 8 },
    geometry: { type: 'Polygon' as const, coordinates: [poligono(h.hex)] },
  })),
});

export function TelaTerritorio({ pro, assinar }: { pro: boolean; assinar: () => void }) {
  const [hexes, setHexes] = useState<Hex[] | null>(null);
  const [meu, setMeu] = useState<Meu | null>(null);
  const [placar, setPlacar] = useState<Placar[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [marcandoCasa, setMarcandoCasa] = useState(false);
  const [depois, setDepois] = useState(() => { try { return sessionStorage.getItem('radar-terr-casa-depois') === '1'; } catch { return false; } });
  const [regras, setRegras] = useState(false);
  const carregar = () => {
    sb.rpc('radar_territorio_mapa').then(({ data }) => setHexes((data ?? []) as Hex[]));
    sb.rpc('radar_territorio_meu').then(({ data }) => setMeu(data as Meu));
    sb.rpc('radar_territorio_placar').then(({ data }) => setPlacar((data ?? []) as Placar[]));
  };
  useEffect(carregar, []);
  const h = hexes?.find(x => x.hex === sel) ?? null;
  const reagir = async (e: string) => {
    if (!h) return;
    const novo = h.minha_reacao === e ? null : e;
    setHexes(l => l?.map(x => {
      if (x.hex !== h.hex) return x;
      const r = { ...x.reacoes };
      if (x.minha_reacao) { r[x.minha_reacao] = (r[x.minha_reacao] ?? 1) - 1; if (r[x.minha_reacao] <= 0) delete r[x.minha_reacao]; }
      if (novo) r[novo] = (r[novo] ?? 0) + 1;
      return { ...x, reacoes: r, minha_reacao: novo };
    }) ?? null);
    await sb.rpc('radar_territorio_reagir', { p_hex: h.hex, p_emoji: novo });
  };
  const pularCasa = () => { setDepois(true); try { sessionStorage.setItem('radar-terr-casa-depois', '1'); } catch { /* */ } };

  return (
    <div className="pro-cont terr">
      {meu && !meu.casa && !depois && (
        <section className="pro-card azul terr-seguranca">
          <p className="pro-k"><Shield size={15} aria-hidden="true" /> Sua segurança vem primeiro</p>
          <p className="pro-sem-margem">Marque a sua casa e o Radar esconde dos outros tudo o que você dominar perto dela. Só você vê esse ponto.</p>
          <p className="fine pro-sem-margem">Mesmo assim, evite correr sempre no mesmo horário e no mesmo trajeto, e prefira lugares movimentados.</p>
          <div className="terr-bts">
            <button className="btn solid" onClick={() => setMarcandoCasa(true)}><Home size={17} aria-hidden="true" />Marcar minha casa</button>
            <button className="btn text" onClick={pularCasa}>Agora não</button>
          </div>
        </section>
      )}

      <section className="pro-card terr-topo">
        <p className="pro-k"><Hexagon size={15} aria-hidden="true" /> Território</p>
        <h2 className="terr-tit">Corra e domine o Maranhão</h2>
        <p className="pro-sem-margem terr-sub">Cada hexágono é de quem correu ali com mais força. Para tomar, corra mais forte que o dono.</p>
        <div className="terr-nums">
          <span className="ouro"><b>{meu?.hexagonos ?? '–'}</b><small>seus hexágonos</small></span>
          <span><b>{meu?.ganhos_7d ?? '–'}</b><small>conquistados na semana</small></span>
          <span><b>{meu?.perdidos_7d ?? '–'}</b><small>perdidos na semana</small></span>
          <span className={meu?.esfriando ? 'frio' : ''}><b>{meu?.esfriando ?? '–'}</b><small>esfriando</small></span>
        </div>
        {!pro && <div className="terr-pro"><span><b>Você já vê o mapa.</b> Para dominar território, é o Radar Pro.</span><button className="btn solid" onClick={assinar}>Assinar · R$ 10</button></div>}
      </section>

      <MapaTerritorio hexes={hexes} casa={meu?.casa ?? null} sel={sel} escolher={setSel} />

      {h && (
        <section className="pro-card terr-hex" aria-live="polite">
          <div className="pro-linha">
            <p className="pro-k">{h.eu ? <><Crown size={15} aria-hidden="true" /> Seu território</> : h.dono ? 'Território dominado' : 'Hexágono livre'}</p>
            <button className="btn text" onClick={() => setSel(null)} aria-label="Fechar"><X size={18} /></button>
          </div>
          {h.dono ? (
            <div className="terr-dono">
              {h.dono_foto ? <img src={h.dono_foto} alt="" /> : <i style={{ background: h.eu ? OURO : corDe(h.dono) }}>{h.dono.slice(0, 1).toUpperCase()}</i>}
              <div>
                <b>{h.eu ? 'Você' : `@${h.dono}`}</b>
                <small>força {num(h.forca)} · desde {h.desde ? haTempo(h.desde) : '–'}</small>
              </div>
            </div>
          ) : <p className="pro-sem-margem">Ninguém domina aqui. Corra por este hexágono e ele é seu.</p>}
          {h.eu && h.desde && (dias(h.desde) >= 14
            ? <p className="terr-alerta frio"><Snowflake size={15} aria-hidden="true" /> Esfriando: perde 1 ponto por dia até você correr aqui de novo.</p>
            : <p className="fine pro-sem-margem">Começa a esfriar em {14 - dias(h.desde)} {14 - dias(h.desde) === 1 ? 'dia' : 'dias'}. Corra aqui de novo para defender.</p>)}
          {!h.eu && h.dono && h.forca != null && (
            <p className="terr-alerta"><Flame size={15} aria-hidden="true" /> Para tomar: corra aqui com força acima de <b>{num(h.forca)}</b>.{h.minha_forca != null ? ` A sua aqui é ${num(h.minha_forca)}.` : ''}</p>
          )}
          <div className="terr-emojis" role="group" aria-label="Reagir a este lugar">
            {EMOJIS.map(e => (
              <button key={e} className={h.minha_reacao === e ? 'on' : ''} aria-pressed={h.minha_reacao === e} onClick={() => reagir(e)}>
                <span aria-hidden="true">{e}</span>{h.reacoes[e] ? <small>{h.reacoes[e]}</small> : null}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="pro-card terr-regras">
        <button className="terr-regras-bt" onClick={() => setRegras(v => !v)} aria-expanded={regras}>
          <span className="pro-k">Como funciona</span>{regras ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
        </button>
        {regras && <ol className="terr-passos">
          <li><b>Corra.</b> Grave pelo botão Gravar ou pelo relógio Garmin conectado. Os hexágonos por onde você passou entram sozinhos.</li>
          <li><b>Sua força é a sua nota por idade</b> naquela corrida. Assim quem tem 60 anos disputa de igual pra igual com quem tem 25.</li>
          <li><b>Para tomar um hexágono,</b> corra por ele com força maior que a do dono. Empate fica com quem já estava.</li>
          <li><b>Defenda.</b> Território sem corrida por 14 dias começa a esfriar: perde 1 ponto de força por dia. Correr ali de novo faz parar de esfriar.</li>
          <li><b>Vale corrida no Maranhão</b>, de 1 km pra cima, no ritmo de corrida (entre 2:30 e 15 min/km).</li>
        </ol>}
      </section>

      {placar.length > 0 && (
        <section className="pro-card terr-placar">
          <p className="pro-k"><Crown size={15} aria-hidden="true" /> Quem domina mais</p>
          <ol>
            {placar.slice(0, 10).map(p => (
              <li key={p.posicao + p.nome} className={p.eu ? 'eu' : ''}>
                <span className="pos">{p.posicao}º</span>
                {p.foto ? <img src={p.foto} alt="" /> : <i style={{ background: p.eu ? OURO : corDe(p.nome) }}>{p.nome.slice(0, 1).toUpperCase()}</i>}
                <span className="nome">{p.eu ? 'Você' : `@${p.nome}`}</span>
                <b>{p.hexagonos}</b>
              </li>
            ))}
          </ol>
        </section>
      )}

      {meu?.casa && (
        <section className="pro-card terr-casa">
          <p className="pro-k"><Home size={15} aria-hidden="true" /> Sua casa está protegida</p>
          <p className="pro-sem-margem">Tudo o que você dominar a até {meu.casa.raio_m >= 1000 ? `${String(meu.casa.raio_m / 1000).replace('.', ',')} km` : `${meu.casa.raio_m} m`} dela fica invisível para os outros. Conta nos seus pontos normalmente.</p>
          <div className="terr-bts">
            <button className="btn outline" onClick={() => setMarcandoCasa(true)}><MapPin size={17} aria-hidden="true" />Trocar</button>
            <button className="btn text" onClick={async () => { await sb.rpc('radar_territorio_casa', { p_lat: null, p_lng: null }); carregar(); }}>Tirar a proteção</button>
          </div>
        </section>
      )}

      {marcandoCasa && <MarcarCasa atual={meu?.casa ?? null} fechar={() => setMarcandoCasa(false)} salvou={() => { setMarcandoCasa(false); carregar(); }} />}
    </div>
  );
}

/* ───────── o mapa 3D dos hexágonos ───────── */
function MapaTerritorio({ hexes, casa, sel, escolher }: { hexes: Hex[] | null; casa: Meu['casa']; sel: string | null; escolher: (h: string | null) => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  const mapa = useRef<MLMap | null>(null);
  const lib = useRef<typeof import('maplibre-gl') | null>(null);
  const marcas = useRef<{ marker: Marker; peso: number; tipo: 'foto' | 'emoji' }[]>([]);
  const [pronto, setPronto] = useState(false);
  const [p3d, setP3d] = useState(true);
  const centrou = useRef(false);
  const dados = useMemo(() => geoHex(hexes ?? []), [hexes]);
  const dadosRef = useRef(dados); dadosRef.current = dados;

  useEffect(() => {
    let vivo = true, m: MLMap | null = null;
    Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css')]).then(([ml]) => {
      if (!vivo || !caixa.current) return; lib.current = ml;
      m = new ml.Map({ container: caixa.current, style: estilo(), center: [-44.27, -2.53], zoom: 12.3, pitch: 50, bearing: -12, attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false, touchPitch: false });
      mapa.current = m;
      m.on('load', () => {
        if (!vivo || !m) return;
        m.addSource('terr', { type: 'geojson', data: dadosRef.current });
        m.addSource('casa', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        m.addLayer({ id: 'casa-area', type: 'fill', source: 'casa', paint: { 'fill-color': OURO, 'fill-opacity': .12 } });
        m.addLayer({ id: 'casa-borda', type: 'line', source: 'casa', paint: { 'line-color': OURO, 'line-width': 2, 'line-dasharray': [2, 2] } });
        m.addLayer({ id: 'terr-3d', type: 'fill-extrusion', source: 'terr', paint: { 'fill-extrusion-color': ['get', 'cor'], 'fill-extrusion-height': ['get', 'altura'], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': .82 } });
        m.addLayer({ id: 'terr-sel', type: 'line', source: 'terr', filter: ['==', ['get', 'hex'], ''], paint: { 'line-color': '#0a1240', 'line-width': 4 } });
        m.on('click', 'terr-3d', e => { const f = e.features?.[0]; if (f) escolher(String(f.properties?.hex)); });
        m.on('click', e => { if (!m?.queryRenderedFeatures(e.point, { layers: ['terr-3d'] }).length) escolher(null); });
        m.on('mouseenter', 'terr-3d', () => { if (m) m.getCanvas().style.cursor = 'pointer'; });
        m.on('mouseleave', 'terr-3d', () => { if (m) m.getCanvas().style.cursor = ''; });
        setPronto(true);
      });
    });
    return () => { vivo = false; m?.remove(); mapa.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // atualiza os hexágonos e centraliza no começo (no seu território, se tiver)
  useEffect(() => {
    const m = mapa.current; if (!m || !pronto || !hexes) return;
    (m.getSource('terr') as GeoJSONSource | undefined)?.setData(dados);
    if (!centrou.current) {
      centrou.current = true;
      const meus = hexes.filter(x => x.eu), base = meus.length ? meus : hexes;
      if (base.length) {
        const la = base.map(x => x.lat), lo = base.map(x => x.lng);
        m.fitBounds([[Math.min(...lo), Math.min(...la)], [Math.max(...lo), Math.max(...la)]], { padding: 60, maxZoom: 14.5, pitch: 50, bearing: -12, duration: 0 });
      }
    }
    // fotos: uma por bloco de território (hexágonos colados do mesmo dono) + emojis mais usados
    marcas.current.forEach(x => x.marker.remove());
    const ml = lib.current; if (!ml) return;
    const novas: typeof marcas.current = [];
    for (const b of blocos(hexes)) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'terr-avatar' + (b.eu ? ' eu' : '');
      el.setAttribute('aria-label', `${b.eu ? 'Seu território' : `Território de @${b.nome}`}: ${b.tamanho} ${b.tamanho === 1 ? 'hexágono' : 'hexágonos'}`);
      el.style.setProperty('--cor', b.eu ? OURO : corDe(b.nome));
      const foto = document.createElement('span'); foto.className = 'terr-avatar-foto';
      if (b.foto) { const img = document.createElement('img'); img.src = b.foto; img.alt = ''; img.loading = 'lazy'; img.onerror = () => { img.remove(); foto.textContent = b.nome.slice(0, 1).toUpperCase(); }; foto.appendChild(img); }
      else foto.textContent = (b.eu ? 'Você' : b.nome).slice(0, 1).toUpperCase();
      el.appendChild(foto);
      el.onclick = ev => { ev.stopPropagation(); escolher(b.centro.hex); };
      novas.push({ marker: new ml.Marker({ element: el, anchor: 'bottom' }).setLngLat([b.centro.lng, b.centro.lat]).addTo(m), peso: (b.eu ? 1e6 : 0) + b.tamanho, tipo: 'foto' });
    }
    for (const x of hexes.filter(x => Object.keys(x.reacoes).length).slice(0, 80)) {
      const [e] = Object.entries(x.reacoes).sort((a, b) => b[1] - a[1])[0];
      const el = document.createElement('button'); el.type = 'button'; el.className = 'terr-emoji-mapa'; el.textContent = e; el.setAttribute('aria-label', `Reações neste lugar: ${e}`);
      el.onclick = ev => { ev.stopPropagation(); escolher(x.hex); };
      novas.push({ marker: new ml.Marker({ element: el }).setLngLat([x.lng, x.lat]).addTo(m), peso: -1, tipo: 'emoji' });
    }
    marcas.current = novas;
    arrumar();
  }, [dados, pronto]); // eslint-disable-line react-hooks/exhaustive-deps

  // sem bagunça: quando duas marcas ficam perto na tela, fica só a mais importante (a sua, depois o território maior)
  const arrumar = () => {
    const m = mapa.current; if (!m) return;
    const z = m.getZoom(), postas: { x: number; y: number }[] = [];
    for (const it of [...marcas.current].sort((a, b) => b.peso - a.peso)) {
      const el = it.marker.getElement();
      if (it.tipo === 'emoji' && z < 14) { el.style.visibility = 'hidden'; continue; }
      const p = m.project(it.marker.getLngLat()), raio = it.tipo === 'foto' ? 46 : 30;
      const bate = postas.some(q => Math.hypot(q.x - p.x, q.y - p.y) < raio);
      el.style.visibility = bate ? 'hidden' : 'visible';
      if (!bate) postas.push({ x: p.x, y: p.y });
    }
  };
  useEffect(() => {
    const m = mapa.current; if (!m || !pronto) return;
    let quadro = 0;
    const f = () => { cancelAnimationFrame(quadro); quadro = requestAnimationFrame(arrumar); };
    m.on('move', f);
    return () => { m.off('move', f); cancelAnimationFrame(quadro); };
  }, [pronto]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = mapa.current; if (!m || !pronto) return;
    m.setFilter('terr-sel', ['==', ['get', 'hex'], sel ?? '']);
  }, [sel, pronto]);

  useEffect(() => {
    const m = mapa.current; if (!m || !pronto) return;
    (m.getSource('casa') as GeoJSONSource | undefined)?.setData(casa
      ? { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [circulo(casa.lat, casa.lng, casa.raio_m)] } }
      : { type: 'FeatureCollection', features: [] });
  }, [casa, pronto]);

  const trocar3d = () => { const n = !p3d; setP3d(n); mapa.current?.easeTo({ pitch: n ? 50 : 0, bearing: n ? -12 : 0, duration: 600 }); };
  const minhaPosicao = () => navigator.geolocation?.getCurrentPosition(p => mapa.current?.easeTo({ center: [p.coords.longitude, p.coords.latitude], zoom: 14.5 }), () => null);
  return (
    <div className="terr-mapa-caixa">
      <div ref={caixa} className="terr-mapa" />
      <div className="terr-mapa-lado">
        <button className="mp-redondo mp-3d" onClick={trocar3d} aria-label={p3d ? 'Ver de cima (2D)' : 'Ver inclinado (3D)'}>{p3d ? '2D' : '3D'}</button>
        <button className="mp-redondo" onClick={minhaPosicao} aria-label="Ir para a minha posição"><Crosshair size={19} /></button>
      </div>
      <div className="terr-legenda" aria-hidden="true">
        <span><i style={{ background: OURO }} />Seu</span>
        <span><i style={{ background: CORES[0] }} />De outros atletas</span>
        <span className="alt">Mais alto = mais força</span>
      </div>
      {hexes && !hexes.length && <p className="terr-vazio">O mapa ainda está livre. A primeira corrida gravada aqui já conquista território.</p>}
    </div>
  );
}

/* ───────── marcar a casa (só a pessoa vê) ───────── */
function MarcarCasa({ atual, fechar, salvou }: { atual: Meu['casa']; fechar: () => void; salvou: () => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  const mapa = useRef<MLMap | null>(null);
  const [ponto, setPonto] = useState<[number, number] | null>(atual ? [atual.lat, atual.lng] : null);
  const [raio, setRaio] = useState(atual?.raio_m ?? 1000);
  const [pronto, setPronto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true, m: MLMap | null = null;
    Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css')]).then(([ml]) => {
      if (!vivo || !caixa.current) return;
      m = new ml.Map({ container: caixa.current, style: estilo(), center: atual ? [atual.lng, atual.lat] : [-44.27, -2.53], zoom: atual ? 14 : 12, attributionControl: { compact: true }, dragRotate: false, touchPitch: false });
      mapa.current = m;
      m.on('load', () => {
        if (!vivo || !m) return;
        m.addSource('zona', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        m.addLayer({ id: 'zona-area', type: 'fill', source: 'zona', paint: { 'fill-color': OURO, 'fill-opacity': .18 } });
        m.addLayer({ id: 'zona-borda', type: 'line', source: 'zona', paint: { 'line-color': '#c99a00', 'line-width': 2.5 } });
        m.addLayer({ id: 'zona-centro', type: 'circle', source: 'zona', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 8, 'circle-color': '#0a1240', 'circle-stroke-color': OURO, 'circle-stroke-width': 3 } });
        setPronto(true);
      });
      m.on('click', e => setPonto([+e.lngLat.lat.toFixed(5), +e.lngLat.lng.toFixed(5)]));
      if (!atual) navigator.geolocation?.getCurrentPosition(p => { if (vivo && m) m.jumpTo({ center: [p.coords.longitude, p.coords.latitude], zoom: 15 }); }, () => null, { timeout: 8000, maximumAge: 60000 });
    });
    return () => { vivo = false; m?.remove(); mapa.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = mapa.current; if (!m || !pronto) return;
    (m.getSource('zona') as GeoJSONSource | undefined)?.setData(ponto ? {
      type: 'FeatureCollection', features: [
        { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [circulo(ponto[0], ponto[1], raio)] } },
        { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [ponto[1], ponto[0]] } },
      ],
    } : { type: 'FeatureCollection', features: [] });
  }, [ponto, raio, pronto]);

  const salvar = async () => {
    if (!ponto) return;
    if (ponto[0] < -11 || ponto[0] > 0 || ponto[1] < -50 || ponto[1] > -40) return setErro('Marque um ponto no Maranhão.');
    setSalvando(true);
    const { error } = await sb.rpc('radar_territorio_casa', { p_lat: ponto[0], p_lng: ponto[1], p_raio: raio });
    setSalvando(false);
    if (error) return setErro('Não deu para salvar agora. Tente de novo.');
    salvou();
  };
  return (
    <div className="mp-editor" role="dialog" aria-modal="true" aria-label="Marcar minha casa">
      <div ref={caixa} className="mp-editor-mapa" />
      <div className="mp-editor-topo">
        <button className="mp-redondo" onClick={fechar} aria-label="Fechar"><X size={20} /></button>
        <span className="mp-editor-dica">{ponto ? 'Toque de novo para ajustar' : 'Toque no mapa onde fica a sua casa'}</span>
        <button className="mp-redondo" onClick={() => navigator.geolocation?.getCurrentPosition(p => { mapa.current?.easeTo({ center: [p.coords.longitude, p.coords.latitude], zoom: 15.5 }); setPonto([+p.coords.latitude.toFixed(5), +p.coords.longitude.toFixed(5)]); }, () => setErro('Libere a localização ou toque no mapa.'))} aria-label="Usar a minha posição"><Crosshair size={19} /></button>
      </div>
      <div className="mp-editor-painel">
        <p className="pro-sem-margem"><b>Só você vê este ponto.</b> O que você dominar dentro do círculo fica invisível para os outros atletas.</p>
        <div className="chips" role="group" aria-label="Tamanho da proteção">
          {[500, 1000, 2000].map(r => <button key={r} className="chip" aria-pressed={raio === r} onClick={() => setRaio(r)}>{r >= 1000 ? `${r / 1000} km` : `${r} m`}</button>)}
        </div>
        {erro && <p className="ct-erro" role="alert">{erro}</p>}
        <button className="btn solid pro-btn" onClick={salvar} disabled={!ponto || salvando}><Check size={18} aria-hidden="true" />{salvando ? 'Salvando…' : 'Proteger minha casa'}</button>
      </div>
    </div>
  );
}
