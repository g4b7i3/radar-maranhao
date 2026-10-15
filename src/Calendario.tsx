import { useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarPlus, Check, Copy, Download, X } from 'lucide-react';
import { detect } from './install';
import { type Race } from './lib';

/** No iPhone, webcal:// abre o app Calendário direto, em qualquer navegador (Safari, Chrome, Instagram…). */
export const linkCalendario = (caminho: string) => detect().ios ? `webcal://${location.host}${caminho}` : caminho;

/** Link de "Adicionar ao calendário" de uma prova (.ics com os dois lembretes):
 *  - Android e iPhone no Safari: abre o arquivo, que vai pro calendário do celular;
 *  - iPhone em outro navegador (Chrome, Instagram…): webcal abre o app Calendário direto. */
export function linkProva(e: Race) {
  const p = detect();
  return p.ios && p.iosBrowser !== 'safari' ? linkCalendario(`/calendario/${e.id}.ics`) : `/calendario/${e.id}.ics`;
}

/** Aviso que aparece embaixo do botão, quando o celular precisa de um toque a mais para o alarme. */
export function dicaAlarme() {
  const p = detect();
  if (p.ios && p.iosBrowser !== 'safari') return 'No Calendário, desligue "Remover alertas" antes de tocar em Adicionar, para receber os lembretes (véspera às 18h e no dia da prova).';
  if (p.android) return 'Toque em Abrir quando o arquivo baixar e escolha o Calendário. Vem com lembrete na véspera às 18h e outro no dia da prova.';
  return 'Com lembrete na véspera às 18h e outro no dia da prova.';
}

/** Assinar a agenda completa no calendário do celular. Atualiza sozinha quando entra prova nova. */
export default function AssinarAgenda({ onExportar, filtradas }: { onExportar: () => void; filtradas: number | null }) {
  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const p = detect();
  const https = `${location.origin}/calendario/radar.ics`;
  const webcal = https.replace(/^https?:/, 'webcal:');
  const copiar = async () => { try { await navigator.clipboard.writeText(https); setCopiado(true); setTimeout(() => setCopiado(false), 2500); } catch { prompt('Copie o link da agenda:', https); } };
  const botao = <a className="btn solid" href={p.ios ? webcal : https} data-umami-event="Assinar agenda: calendário">Pôr no calendário do celular</a>;
  return (
    <>
      <button className="btn outline" onClick={() => setAberto(true)} data-umami-event="Assinar agenda: abriu"><CalendarPlus size={15} aria-hidden="true" />Agenda no seu calendário</button>
      {aberto && createPortal(
        <div className="scrim" onClick={() => setAberto(false)}>
          <div className="sheet assinar" role="dialog" aria-modal="true" aria-labelledby="assinar-t" onClick={ev => ev.stopPropagation()}>
            <button className="close" onClick={() => setAberto(false)} aria-label="Fechar"><X size={20} /></button>
            <h2 id="assinar-t">Todas as corridas no calendário do seu celular</h2>
            <p>As provas do Maranhão aparecem no calendário do seu celular, ao lado dos seus compromissos. {p.ios && <strong>Quando entra prova nova ou muda uma data, ele atualiza sozinho.</strong>}</p>
            <div className="assinar-btns">{botao}</div>
            <ol className="assinar-passos">
              {p.android
                ? <li>Quando o arquivo baixar, toque em <b>Abrir</b> e escolha o <b>Calendário</b>. As provas entram de uma vez.</li>
                : <li>No iPhone, toque em <b>Assinar</b> e depois em <b>Adicionar</b>. Pronto: as provas aparecem no app Calendário.</li>}
              {p.ios && <li>Pra tirar depois, é só apagar a agenda "Corridas no Maranhão" no calendário.</li>}
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
