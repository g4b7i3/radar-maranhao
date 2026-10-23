// Barra de cima com a seta de voltar, como no Instagram: aparece em toda tela que se abre por cima de uma aba.
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

export function TopoVoltar({ titulo, voltar, direita }: { titulo: ReactNode; voltar: () => void; direita?: ReactNode }) {
  return (
    <div className="pro-topo-voltar">
      <button onClick={voltar} aria-label="Voltar"><ArrowLeft size={24} aria-hidden="true" /></button>
      <b>{titulo}</b>
      {direita && <span className="pro-topo-voltar-dir">{direita}</span>}
    </div>
  );
}
