// Mapa da corrida (MapLibre + mapas abertos do OpenFreeMap, sem chave). Carrega só quando aparece.
// Ao vivo: trajeto em dourado, a posição do corredor e o botão 2D/3D. Parado: o percurso inteiro enquadrado.
import { useEffect, useRef, useState } from 'react';
import { Crosshair } from 'lucide-react';
import type { Map as MLMap, GeoJSONSource } from 'maplibre-gl';

const escuro = () => document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
const linha = (rota: [number, number][]) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: rota.map(p => [p[1], p[0]]) } });
const ponto = (p: [number, number] | null) => ({ type: 'FeatureCollection' as const, features: p ? [{ type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: [p[1], p[0]] } }] : [] });

export function MapaCorrida({ rota, eu = null, aoVivo = false, falhou }: { rota: [number, number][]; eu?: [number, number] | null; aoVivo?: boolean; falhou?: () => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  const mapa = useRef<MLMap | null>(null);
  const [pronto, setPronto] = useState(false);
  const [msg, setMsg] = useState<string | null>('Carregando o mapa…');
  const [p3d, setP3d] = useState(false);
  const [seguir, setSeguir] = useState(true);
  const inicio = useRef<[number, number] | null>(eu ?? rota[rota.length - 1] ?? null);

  // cria o mapa (uma vez)
  useEffect(() => {
    let vivo = true, m: MLMap | null = null;
    Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css')]).then(([ml]) => {
      if (!vivo || !caixa.current) return;
      const c = inicio.current ?? [-2.53, -44.3]; // sem posição ainda: São Luís
      let trocou = false;
      m = new ml.Map({ container: caixa.current, style: `https://tiles.openfreemap.org/styles/${escuro() ? 'dark' : 'liberty'}`, center: [c[1], c[0]], zoom: aoVivo ? 15.5 : 13,
        attributionControl: { compact: true }, interactive: true, dragRotate: false, pitchWithRotate: false, touchPitch: false, fadeDuration: 0 });
      mapa.current = m;
      m.on('error', () => { if (!vivo) return; if (!trocou && escuro()) { trocou = true; try { m!.setStyle('https://tiles.openfreemap.org/styles/liberty'); } catch { /* */ } } else if (!pronto) { setMsg('Mapa indisponível agora. O GPS continua funcionando.'); falhou?.(); } });
      m.on('load', () => {
        if (!vivo || !m) return;
        m.addSource('rota', { type: 'geojson', data: linha(rota) });
        m.addLayer({ id: 'rota-borda', type: 'line', source: 'rota', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#0a1240', 'line-width': 9, 'line-opacity': .55 } });
        m.addLayer({ id: 'rota', type: 'line', source: 'rota', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffd34d', 'line-width': 5 } });
        m.addSource('eu', { type: 'geojson', data: ponto(eu) });
        m.addLayer({ id: 'eu-halo', type: 'circle', source: 'eu', paint: { 'circle-radius': 16, 'circle-color': '#1d3fbf', 'circle-opacity': .2 } });
        m.addLayer({ id: 'eu', type: 'circle', source: 'eu', paint: { 'circle-radius': 7, 'circle-color': '#1d3fbf', 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' } });
        if (!aoVivo && rota.length > 1) {
          const b = rota.reduce((a, p) => [Math.min(a[0], p[1]), Math.min(a[1], p[0]), Math.max(a[2], p[1]), Math.max(a[3], p[0])], [180, 90, -180, -90]);
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

  const trocar3d = () => { const m = mapa.current; if (!m) return; const n = !p3d; setP3d(n); m.easeTo({ pitch: n ? 60 : 0, zoom: n ? 16.5 : 15.5, duration: 600 }); };
  const centralizar = () => { setSeguir(true); const m = mapa.current; if (m && eu) m.easeTo({ center: [eu[1], eu[0]], duration: 500 }); };

  return (
    <div className={'pro-mapa' + (aoVivo ? ' vivo' : '')}>
      <div ref={caixa} className="pro-mapa-caixa" />
      {msg && <span className="pro-mapa-msg">{msg}</span>}
      {aoVivo && pronto && <div className="pro-mapa-bts">
        <button onClick={trocar3d} aria-label={p3d ? 'Ver o mapa de cima (2D)' : 'Ver o mapa inclinado (3D)'}>{p3d ? '2D' : '3D'}</button>
        {!seguir && <button onClick={centralizar} aria-label="Voltar para a minha posição"><Crosshair size={18} /></button>}
      </div>}
    </div>
  );
}
