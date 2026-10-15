import { useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarPlus, Check, Copy, Download, X } from 'lucide-react';
import { detect } from './install';

/** Assinar a agenda completa no calendário do celular. Atualiza sozinha quando entra prova nova. */
export default function AssinarAgenda({ onExportar, filtradas }: { onExportar: () => void; filtradas: number | null }) {
  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const p = detect();
  const https = `${location.origin}/calendario/radar.ics`;
  const webcal = https.replace(/^https?:/, 'webcal:');
  const google = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`;
  const copiar = async () => { try { await navigator.clipboard.writeText(https); setCopiado(true); setTimeout(() => setCopiado(false), 2500); } catch { prompt('Copie o link da agenda:', https); } };
  const apple = <a className={p.ios ? 'btn solid' : 'btn outline'} href={webcal} data-umami-event="Assinar agenda: iPhone">iPhone ou Mac: Calendário</a>;
  const gg = <a className={p.android ? 'btn solid' : 'btn outline'} href={google} target="_blank" rel="noopener noreferrer" data-umami-event="Assinar agenda: Google">Android: Google Agenda</a>;
  return (
    <>
      <button className="btn outline" onClick={() => setAberto(true)} data-umami-event="Assinar agenda: abriu"><CalendarPlus size={15} aria-hidden="true" />Agenda no seu calendário</button>
      {aberto && createPortal(
        <div className="scrim" onClick={() => setAberto(false)}>
          <div className="sheet assinar" role="dialog" aria-modal="true" aria-labelledby="assinar-t" onClick={ev => ev.stopPropagation()}>
            <button className="close" onClick={() => setAberto(false)} aria-label="Fechar"><X size={20} /></button>
            <h2 id="assinar-t">Todas as corridas no calendário do seu celular</h2>
            <p>As provas do Maranhão aparecem no calendário do seu celular, ao lado dos seus compromissos. <strong>Quando entra prova nova ou muda uma data, ele atualiza sozinho.</strong></p>
            <div className="assinar-btns">{p.android ? <>{gg}{apple}</> : <>{apple}{gg}</>}</div>
            <ol className="assinar-passos">
              {p.android
                ? <li>No Google Agenda, toque em <b>Adicionar</b>. A agenda "Corridas no Maranhão" aparece no app do Google Agenda do celular (pode levar alguns minutos).</li>
                : <li>No iPhone, toque em <b>Assinar</b> e depois em <b>Adicionar</b>. Pronto: as provas aparecem no app Calendário.</li>}
              <li>Pra tirar depois, é só apagar a agenda "Corridas no Maranhão" no calendário.</li>
            </ol>
            <div className="assinar-extra">
              <button className="btn text" onClick={copiar}>{copiado ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}{copiado ? 'Link copiado' : 'Copiar link da agenda (Outlook e outros)'}</button>
              {filtradas != null && <button className="btn text" onClick={() => { onExportar(); setAberto(false); }}><Download size={15} aria-hidden="true" />Baixar só as {filtradas} provas filtradas (sem atualizar)</button>}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
