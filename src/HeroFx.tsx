import { useEffect, useRef, useState, type RefObject } from 'react';

// ---------- Bandeira do Maranhão ondulando ----------
// 9 faixas (vermelho, branco, preto, branco, vermelho, branco, preto, branco, vermelho) e o quadro azul com a estrela.
// As faixas são desenhadas onduladas com o dobro da largura e deslizam em loop: parece tremular,
// mas é só um "translate", o efeito mais barato que existe para o celular.
const STRIPES = ['#d52b1e', '#ffffff', '#111111', '#ffffff', '#d52b1e', '#ffffff', '#111111', '#ffffff', '#d52b1e'];
const H = 60, PERIOD = 600, AMP = 9, W = PERIOD * 2;
const wave = (x: number, y: number) => y + AMP * Math.sin((2 * Math.PI * x) / PERIOD);
function stripePath(i: number) {
  const top: string[] = [], bottom: string[] = [];
  for (let x = 0; x <= W; x += 20) top.push(`${x},${wave(x, i * H).toFixed(1)}`);
  for (let x = W; x >= 0; x -= 20) bottom.push(`${x},${wave(x, (i + 1) * H + 0.5).toFixed(1)}`);
  return `M${top.join('L')}L${bottom.join('L')}Z`;
}
const PATHS = STRIPES.map((_, i) => stripePath(i));
const STAR = (() => {
  const pts: string[] = [];
  for (let k = 0; k < 10; k++) {
    const r = k % 2 ? 22 : 54, a = -Math.PI / 2 + (k * Math.PI) / 5;
    pts.push(`${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
})();

function Flag() {
  return (
    <svg className="fx-flag" viewBox={`0 0 ${PERIOD} ${H * 9 + AMP * 2}`} preserveAspectRatio="xMinYMin slice" aria-hidden="true">
      <defs>
        {/* recorta o quadro da estrela: lá a bandeira é azul liso, e o azul do fundo aparece */}
        <mask id="fx-canton-cut" maskUnits="userSpaceOnUse" x="-50" y="-50" width={PERIOD + 100} height={H * 9 + 200}>
          <rect x="-50" y="-50" width={PERIOD + 100} height={H * 9 + 200} fill="#fff" />
          <rect x="-50" y="-50" width="300" height={H * 4 + 50 + AMP} fill="#000" />
        </mask>
      </defs>
      <g transform={`translate(0 ${AMP})`}>
        <g mask="url(#fx-canton-cut)">
          <g className="fx-flag-stripes">
            {PATHS.map((d, i) => <path key={i} d={d} fill={STRIPES[i]} />)}
          </g>
        </g>
        <g className="fx-flag-canton">
                    <polygon points={STAR} transform={`translate(125 ${H * 2 - 2})`} fill="#ffffff" />
        </g>
      </g>
    </svg>
  );
}

// ---------- Radar varrendo ----------
function Sweep() {
  return (
    <div className="fx-radar" aria-hidden="true">
      <div className="fx-radar-rings" />
      <div className="fx-radar-beam" />
      <span className="fx-blip" style={{ top: '30%', left: '64%' }} />
      <span className="fx-blip b2" style={{ top: '62%', left: '28%' }} />
    </div>
  );
}

/** Fundo animado do destaque: bandeira com parallax + radar. Pausa fora da tela e respeita "reduzir movimento". */
export function HeroBackdrop({ hostRef }: { hostRef: RefObject<HTMLElement> }) {
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = hostRef.current, el = layer.current;
    if (!host || !el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // pausa as animações quando o destaque sai da tela (economiza bateria)
    const io = new IntersectionObserver(([e]) => host.classList.toggle('fx-paused', !e.isIntersecting), { threshold: 0 });
    io.observe(host);
    if (reduce) return () => io.disconnect();
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = Math.min(window.scrollY, host.offsetHeight + 200);
        el.style.transform = `translate3d(0, ${(y * 0.35).toFixed(1)}px, 0)`;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => { io.disconnect(); window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [hostRef]);
  return (
    <div className="fx" aria-hidden="true">
      <div className="fx-parallax" ref={layer}><Flag /></div>
      <Sweep />
    </div>
  );
}

/** Número que sobe de 0 até o valor ao abrir a página (uma vez só). */
export function CountUp({ value }: { value: string }) {
  const target = Number(value);
  const [n, setN] = useState(() => (Number.isFinite(target) ? 0 : value));
  useEffect(() => {
    if (!Number.isFinite(target)) { setN(value); return; }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || target <= 1) { setN(String(target)); return; }
    const t0 = performance.now(), dur = Math.min(900, 300 + target * 25);
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur), eased = 1 - Math.pow(1 - p, 3);
      setN(String(Math.round(target * eased)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, value]);
  return <>{n}</>;
}

const REVEAL = '.race, .month h2, .missing, .feed li, .about-status, .about section, .page-head, .empty';

/**
 * Faz cada item aparecer suavemente quando entra na tela (uma vez só).
 * Um único IntersectionObserver para a página toda: leve mesmo com 80 provas.
 * Um MutationObserver percebe qualquer item que aparece depois (trocar Mapa/Lista,
 * filtros, abas...), então nada fica escondido por ter sido desenhado de novo.
 */
export function useReveal() {
  useEffect(() => {
    const root = document.documentElement;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window) || !('MutationObserver' in window)) { root.classList.remove('reveal-on'); return; }
    root.classList.add('reveal-on');
    const io = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      visible.forEach((e, i) => {
        const el = e.target as HTMLElement;
        el.style.setProperty('--rd', `${Math.min(i, 6) * 55}ms`);
        el.classList.add('in');
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
    const observar = (base: ParentNode) => base.querySelectorAll<HTMLElement>(REVEAL).forEach(el => { if (!el.classList.contains('in')) io.observe(el); });
    observar(document);
    const mo = new MutationObserver(lista => {
      for (const m of lista) m.addedNodes.forEach(n => {
        if (!(n instanceof HTMLElement)) return;
        if (n.matches(REVEAL) && !n.classList.contains('in')) io.observe(n);
        observar(n);
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
    // segurança: o que já está na tela aparece de qualquer jeito
    const seguro = () => document.querySelectorAll(REVEAL).forEach(el => { const r = el.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) el.classList.add('in'); });
    const t = setInterval(seguro, 1500);
    return () => { io.disconnect(); mo.disconnect(); clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
