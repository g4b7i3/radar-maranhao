// Mapa da corrida (MapLibre + mapas abertos do OpenFreeMap, sem chave). Carrega só quando aparece.
// Ao vivo: trajeto em dourado, a posição do corredor e o botão 2D/3D. Parado: o percurso inteiro enquadrado.
// Estilos: Positron (claro, padrão no modo claro), Fiord (azul-escuro, padrão no modo escuro) e Bright (colorido).
import { useEffect, useRef, useState } from 'react';
import { Crosshair, Layers, Check } from 'lucide-react';
import type { Map as MLMap, GeoJSONSource } from 'maplibre-gl';

type Estilo = 'positron' | 'fiord' | 'bright';
export const ESTILOS: { id: Estilo; nome: string; d: string; cor: string }[] = [
  { id: 'positron', nome: 'Claro', d: 'Limpo, destaca o trajeto', cor: 'linear-gradient(135deg,#f3f4f6,#d9dde3)' },
  { id: 'fiord', nome: 'Azul-noite', d: 'Escuro, combina com o Radar', cor: 'linear-gradient(135deg,#2b3a55,#16203a)' },
  { id: 'bright', nome: 'Colorido', d: 'Ruas, parques e água', cor: 'linear-gradient(135deg,#bfe3a5 0 40%,#a8d4f0 40% 70%,#fbe5a6 70%)' },
];
const CHAVE = 'radar-mapa-estilo';
const escuro = () => document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
const escolhido = (): Estilo | null => { try { const v = localStorage.getItem(CHAVE); return v === 'positron' || v === 'fiord' || v === 'bright' ? v : null; } catch { return null; } };
const padrao = (): Estilo => escolhido() ?? (escuro() ? 'fiord' : 'positron');
const url = (e: Estilo) => `https://tiles.openfreemap.org/styles/${e}`;
const linha = (rota: [number, number][]) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: rota.map(p => [p[1], p[0]]) } });
const ponto = (p: [number, number] | null) => ({ type: 'FeatureCollection' as const, features: p ? [{ type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: [p[1], p[0]] } }] : [] });

export function MapaCorrida({ rota, eu = null, aoVivo = false, falhou, guia }: { rota: [number, number][]; eu?: [number, number] | null; aoVivo?: boolean; falhou?: () => void; guia?: [number, number][] | null }) {
  const caixa = useRef<HTMLDivElement>(null);
  const mapa = useRef<MLMap | null>(null);
  const dados = useRef({ rota, eu, guia }); dados.current = { rota, eu, guia };
  const [pronto, setPronto] = useState(false);
  const [msg, setMsg] = useState<string | null>('Carregando o mapa…');
  const [p3d, setP3d] = useState(false);
  const [seguir, setSeguir] = useState(true);
  const [estilo, setEstilo] = useState<Estilo>(padrao);
  const [menu, setMenu] = useState(false);
  const inicio = useRef<[number, number] | null>(eu ?? rota[rota.length - 1] ?? guia?.[0] ?? null);

  // trajeto e posição por cima do mapa (refeito a cada troca de estilo)
  const camadas = (m: MLMap) => {
    if (m.getSource('rota')) return;
    // a rota planejada (Mapas), por baixo, tracejada em azul
    m.addSource('guia', { type: 'geojson', data: linha(dados.current.guia ?? []) });
    m.addLayer({ id: 'guia', type: 'line', source: 'guia', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#1d3fbf', 'line-width': 6, 'line-opacity': .6, 'line-dasharray': [1.5, 1.2] } });
    m.addSource('rota', { type: 'geojson', data: linha(dados.current.rota) });
    m.addLayer({ id: 'rota-borda', type: 'line', source: 'rota', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#0a1240', 'line-width': 9, 'line-opacity': .55 } });
    m.addLayer({ id: 'rota', type: 'line', source: 'rota', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffd34d', 'line-width': 5 } });
    m.addSource('eu', { type: 'geojson', data: ponto(dados.current.eu) });
    m.addLayer({ id: 'eu-halo', type: 'circle', source: 'eu', paint: { 'circle-radius': 16, 'circle-color': '#1d3fbf', 'circle-opacity': .2 } });
    m.addLayer({ id: 'eu', type: 'circle', source: 'eu', paint: { 'circle-radius': 7, 'circle-color': '#1d3fbf', 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' } });
  };

  // cria o mapa (uma vez)
  useEffect(() => {
    let vivo = true, m: MLMap | null = null, ok = false;
    Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css')]).then(([ml]) => {
      if (!vivo || !caixa.current) return;
      const c = inicio.current ?? [-2.53, -44.3]; // sem posição ainda: São Luís
      m = new ml.Map({ container: caixa.current, style: url(estilo), center: [c[1], c[0]], zoom: aoVivo ? 15.5 : 13,
        attributionControl: { compact: true }, interactive: true, dragRotate: false, pitchWithRotate: false, touchPitch: false, fadeDuration: 0 });
      mapa.current = m;
      m.on('error', () => { if (vivo && !ok) { setMsg('Mapa indisponível agora. O GPS continua funcionando.'); falhou?.(); } });
      m.on('style.load', () => { if (vivo && m) camadas(m); });
      m.on('load', () => {
        if (!vivo || !m) return; ok = true;
        camadas(m);
        const r = dados.current.rota;
        if (!aoVivo && r.length > 1) {
          const b = r.reduce((a, p) => [Math.min(a[0], p[1]), Math.min(a[1], p[0]), Math.max(a[2], p[1]), Math.max(a[3], p[0])], [180, 90, -180, -90]);
          m.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 36, duration: 0 });
        }
        setPronto(true); setMsg(null);
      });
      m.on('dragstart', () => setSeguir(false));
    }).catch(() => { if (vivo) { setMsg('Mapa indisponível agora.'); falhou?.(); } });
    return () => { vivo = false; m?.remove(); mapa.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // atualiza o trajeto e a posição
  useEffect(() => {
    const m = mapa.current; if (!m || !pronto) return;
    (m.getSource('rota') as GeoJSONSource | undefined)?.setData(linha(rota));
    (m.getSource('eu') as GeoJSONSource | undefined)?.setData(ponto(eu));
    if (aoVivo && seguir && eu) m.easeTo({ center: [eu[1], eu[0]], duration: 800 });
  }, [rota.length, eu?.[0], eu?.[1], pronto, seguir]); // eslint-disable-line react-hooks/exhaustive-deps

  const trocarEstilo = (e: Estilo) => {
    setMenu(false); if (e === estilo) return;
    setEstilo(e); try { localStorage.setItem(CHAVE, e); } catch { /* */ }
    mapa.current?.setStyle(url(e), { diff: false }); // recarrega inteiro; as camadas do trajeto voltam no style.load
  };
  const trocar3d = () => { const m = mapa.current; if (!m) return; const n = !p3d; setP3d(n); m.easeTo({ pitch: n ? 60 : 0, zoom: n ? 16.5 : 15.5, duration: 600 }); };
  const centralizar = () => { setSeguir(true); const m = mapa.current; if (m && eu) m.easeTo({ center: [eu[1], eu[0]], duration: 500 }); };

  return (
    <div className={'pro-mapa' + (aoVivo ? ' vivo' : '')}>
      <div ref={caixa} className="pro-mapa-caixa" />
      {msg && <span className="pro-mapa-msg">{msg}</span>}
      {pronto && <div className="pro-mapa-bts">
        <button onClick={() => setMenu(v => !v)} aria-label="Estilo do mapa" aria-expanded={menu}><Layers size={18} /></button>
        {aoVivo && <button onClick={trocar3d} aria-label={p3d ? 'Ver o mapa de cima (2D)' : 'Ver o mapa inclinado (3D)'}>{p3d ? '2D' : '3D'}</button>}
        {aoVivo && !seguir && <button onClick={centralizar} aria-label="Voltar para a minha posição"><Crosshair size={18} /></button>}
      </div>}
      {menu && <div className="pro-mapa-estilos" role="menu" aria-label="Estilo do mapa">
        {ESTILOS.map(e => (
          <button key={e.id} role="menuitemradio" aria-checked={estilo === e.id} className={estilo === e.id ? 'on' : ''} onClick={() => trocarEstilo(e.id)}>
            <i style={{ background: e.cor }}>{estilo === e.id && <Check size={14} />}</i>
            <span><b>{e.nome}</b><small>{e.d}</small></span>
          </button>
        ))}
      </div>}
    </div>
  );
}
