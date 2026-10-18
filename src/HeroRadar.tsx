import { useEffect, type RefObject } from 'react';

// Fundo do destaque "painel de radar": grade, anéis com o feixe girando, a bandeira do Maranhão
// apagadinha dentro do radar e a fita com as cores da bandeira. Tudo em CSS/SVG (sem imagens).
const LISTRAS = ['#d52b1e', '#fff', '#111', '#fff', '#d52b1e', '#fff', '#111', '#fff', '#d52b1e'];
const ESTRELA = 'M35 14l3.5 10.8h11.3l-9.2 6.6 3.5 10.8-9.1-6.7-9.1 6.7 3.5-10.8-9.2-6.6h11.3z';

export function BandeiraMA({ className, w, h }: { className?: string; w?: number; h?: number }) {
  return (
    <svg className={className} width={w} height={h} viewBox="0 0 140 90" preserveAspectRatio="xMinYMin slice" aria-hidden="true">
      {LISTRAS.map((c, i) => <rect key={i} x="0" y={i * 10} width="140" height="10" fill={c} />)}
      <rect width="70" height="50" fill="#1D3FBF" /><path d={ESTRELA} fill="#fff" />
    </svg>
  );
}

export function RadarFundo({ hostRef }: { hostRef: RefObject<HTMLElement> }) {
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // pausa a animação quando o destaque sai da tela (economiza bateria)
    const io = new IntersectionObserver(([e]) => host.classList.toggle('rh-pausa', !e.isIntersecting), { threshold: 0 });
    io.observe(host);
    return () => io.disconnect();
  }, [hostRef]);
  return (
    <div className="rh-fx" aria-hidden="true">
      <div className="rh-grade" />
      <div className="rh-radar">
        <BandeiraMA className="rh-bandeira" />
        <div className="rh-feixe" />
        <span className="rh-blip" style={{ left: '32%', top: '38%' }} />
        <span className="rh-blip b2" style={{ left: '55%', top: '24%' }} />
        <span className="rh-blip b3" style={{ left: '41%', top: '66%' }} />
        <span className="rh-blip" style={{ left: '69%', top: '52%' }} />
      </div>
      <div className="rh-fita" />
    </div>
  );
}
