import { useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarPlus, Check, Copy, Download, X } from 'lucide-react';
import { detect } from './install';
import { horaLargada } from './Clima';
import { placeLabel, type Race } from './lib';

/** No iPhone, webcal:// abre o app Calendário direto, em qualquer navegador (Safari, Chrome, Instagram…). */
export const linkCalendario = (caminho: string) => detect().ios ? `webcal://${location.host}${caminho}` : caminho;

const p2 = (n: number) => String(n).padStart(2, '0');

/** Link de "Adicionar ao calendário" de uma prova, do jeito que cada celular entende:
 *  - Android: abre o Google Agenda com o evento preenchido (o app usa as notificações padrão dele);
 *  - iPhone no Safari: importa o .ics, com os dois lembretes;
 *  - iPhone em outro navegador (Chrome, Instagram…): webcal abre o app Calendário direto. */
export function linkProva(e: Race) {
  const p = detect();
  if (p.android) {
    const L = horaLargada(e);
    // sempre com horário (largada informada ou 6h), para o Google avisar antes
    const ini = `${e.date!.replace(/-/g, '')}T${p2(L.h)}${p2(L.m)}00`;
    const fimH = L.h + 3;
    const fim = `${e.date!.replace(/-/g, '')}T${p2(Math.min(23, fimH))}${p2(L.m)}00`;
    const det = [e.distances.length ? 'Distâncias: ' + e.distances.join(', ') + ' km' : '', e.notes, e.officialUrl ? 'Inscrição: ' + e.officialUrl : '', `Ver no Radar: https://radarcorridasma.com.br/?prova=${e.id}`].filter(Boolean).join('\n');
    const q = new URLSearchParams({ action: 'TEMPLATE', text: '🏃 ' + e.name, dates: `${ini}/${fim}`, ctz: 'America/Fortaleza', location: placeLabel(e) + ' - MA', details: det });
    return `https://calendar.google.com/calendar/render?${q}`;
  }
  return p.ios && p.iosBrowser !== 'safari' ? linkCalendario(`/calendario/${e.id}.ics`) : `/calendario/${e.id}.ics`;
}

/** Aviso que aparece embaixo do botão, quando o celular precisa de um toque a mais para o alarme. */
export function dicaAlarme() {
  const p = detect();
  if (p.ios && p.iosBrowser !== 'safari') return 'No Calendário, desligue "Remover alertas" antes de tocar em Adicionar, para receber os lembretes (véspera às 18h e no dia da prova).';
  if (p.android) return 'Abre no Google Agenda: toque em Salvar. O aviso vem pela notificação do Google Agenda (dá pra ajustar o horário no próprio evento).';
  return 'Com lembrete na véspera às 18h e outro no dia da prova.';
}

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
