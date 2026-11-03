// Selo do Radar Pro: aparece depois do @ de quem assina (pago, cortesia ou plano assessoria), em todo o app.
// A lista de quem tem selo vem uma vez do servidor (radar_selos) e fica guardada no aparelho; atualiza a cada 10 minutos.
import { useSyncExternalStore } from 'react';
import { sb } from './sb';

let selos: Set<string> = (() => { try { return new Set<string>(JSON.parse(localStorage.getItem('radar-selos') ?? '[]')); } catch { return new Set<string>(); } })();
const ouvintes = new Set<() => void>();
let ultimo = 0;
async function atualizar() {
  if (Date.now() - ultimo < 10 * 60_000) return;
  ultimo = Date.now();
  const { data, error } = await sb.rpc('radar_selos');
  if (error || !Array.isArray(data)) { ultimo = 0; return; }
  selos = new Set((data as string[]).map(x => x.toLowerCase()));
  try { localStorage.setItem('radar-selos', JSON.stringify([...selos])); } catch { /* */ }
  ouvintes.forEach(f => f());
}
const assinar = (f: () => void) => { ouvintes.add(f); atualizar(); return () => { ouvintes.delete(f); }; };
const foto = () => selos;

/** Marca na hora (ex.: acabou de assinar), sem esperar a próxima atualização. */
export function marcarSelo(apelido: string) { selos = new Set([...selos, apelido.toLowerCase()]); ouvintes.forEach(f => f()); }

/** O selo sozinho: roseta dourada com o losango do Radar. */
export function SeloPro({ tamanho = '1em' }: { tamanho?: string }) {
  return (
    <svg className="pro-selo" viewBox="0 0 24 24" width={tamanho} height={tamanho} role="img" aria-label="Radar Pro">
      <title>Radar Pro</title>
      <defs><linearGradient id="pro-selo-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffe58a" /><stop offset="1" stopColor="#f2b705" /></linearGradient></defs>
      <path fill="url(#pro-selo-g)" stroke="#0a1240" strokeWidth="1.1" d="M12 1.6l2.1 1.9 2.8-.5 1.2 2.6 2.6 1.2-.5 2.8L22.4 12l-1.9 2.1.5 2.8-2.6 1.2-1.2 2.6-2.8-.5L12 22.4l-2.1-1.9-2.8.5-1.2-2.6-2.6-1.2.5-2.8L1.6 12l1.9-2.1-.5-2.8 2.6-1.2 1.2-2.6 2.8.5z" />
      <path fill="#0a1240" d="M12 7.2l4.8 4.8L12 16.8 7.2 12z" />
      <path fill="#ffd34d" d="M12 10.1l1.9 1.9L12 13.9 10.1 12z" />
    </svg>
  );
}

/** O selo, só se o @apelido for Pro. */
export function Selo({ a }: { a?: string | null }) {
  const s = useSyncExternalStore(assinar, foto);
  if (!a || !s.has(String(a).replace(/^@/, '').toLowerCase())) return null;
  return <SeloPro />;
}

/** "@apelido" com o selo depois (use no lugar de @{apelido}). */
export function Arroba({ a }: { a?: string | null }) {
  return <span className="pro-arroba">@{a}<Selo a={a} /></span>;
}
