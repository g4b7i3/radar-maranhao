import { useEffect, useRef, useState } from 'react';
import { Download, X, Link2, ExternalLink, EllipsisVertical, Ellipsis, Share, SquarePlus } from 'lucide-react';
import { canPromptNative, chromeIntentUrl, detect, promptNative, subscribe, wasJustInstalled, type Platform } from './install';

const SHOW_AFTER_MS = 2500;
const ANDROID_WAIT_MS = 3500; // tempo para o Chrome avisar que o app pode ser instalado

type Mode = 'native' | 'ios' | 'inapp' | 'android-manual' | 'desktop-manual' | 'installed';

function chooseMode(p: Platform, nativeReady: boolean): Mode {
  if (p.standalone) return 'installed';
  if (p.inApp) return 'inapp';
  if (nativeReady) return 'native';
  if (p.ios) return 'ios';
  if (p.android) return 'android-manual';
  return 'desktop-manual';
}

export const openInstallPrompt = () => window.dispatchEvent(new Event('radar:instalar'));

export default function InstallPrompt({ blocked, onInstalled }: { blocked: boolean; onInstalled: () => void }) {
  const [platform] = useState(detect);
  const [nativeReady, setNativeReady] = useState(canPromptNative);
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const mode = chooseMode(platform, nativeReady);

  useEffect(() => subscribe(() => {
    setNativeReady(canPromptNative());
    if (wasJustInstalled()) { setOpen(false); onInstalled(); }
  }), [onInstalled]);

  // Abertura automática a cada visita (abrir ou recarregar o site), enquanto o app não estiver instalado.
  // Fechar vale só até a próxima visita.
  useEffect(() => {
    if (platform.standalone) return;
    const wait = platform.android && !platform.inApp ? ANDROID_WAIT_MS : SHOW_AFTER_MS;
    const t = setTimeout(() => {
      if (platform.mobile || canPromptNative()) setOpen(true);
    }, wait);
    return () => clearTimeout(t);
  }, [platform]);

  // Computador: se o Chrome/Edge avisar mais tarde que dá para instalar, mostra também.
  useEffect(() => {
    if (!nativeReady || platform.mobile || platform.standalone) return;
    setOpen(true);
  }, [nativeReady, platform]);

  // Aberto pelo botão "Instalar o app" na aba Sobre.
  useEffect(() => {
    const f = () => { setManual(true); setOpen(true); };
    window.addEventListener('radar:instalar', f);
    return () => window.removeEventListener('radar:instalar', f);
  }, []);

  // Reserva espaço para os avisos (toast) não ficarem por baixo da janela.
  useEffect(() => {
    const root = document.documentElement;
    if (!open || blocked || !ref.current) { root.style.removeProperty('--install-h'); return; }
    const ro = new ResizeObserver(() => root.style.setProperty('--install-h', (ref.current?.offsetHeight ?? 0) + 'px'));
    ro.observe(ref.current);
    return () => { ro.disconnect(); root.style.removeProperty('--install-h'); };
  }, [open, blocked]);

  function dismiss() {
    setOpen(false);
    setManual(false);
  }
  async function install() {
    const r = await promptNative();
    try { (window as unknown as { umami?: { track: (n: string, d?: object) => void } }).umami?.track('Instalar app', { resultado: r === 'accepted' ? 'instalou' : 'recusou' }); } catch { /* contador fora do ar não atrapalha */ }
    if (r === 'accepted') { setOpen(false); onInstalled(); }
    else if (r === 'dismissed') dismiss();
  }
  async function copyLink() {
    const url = window.location.origin + '/';
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { window.prompt('Copie o endereço e cole no navegador:', url); }
  }

  if (!open || blocked) return null;

  const iosWhere = platform.iosBrowser === 'chrome' || platform.iosBrowser === 'edge'
    ? <>no topo da tela, ao lado do endereço</>
    : platform.iosBrowser === 'firefox' ? <>no menu <Ellipsis size={15} aria-label="três pontos" className="ico" /> da barra de baixo</>
    : <>na barra do Safari. Nos iPhones mais novos, ele fica dentro do menu <Ellipsis size={15} aria-label="três pontos" className="ico" /></>;

  return (
    <div className="install" role="dialog" aria-modal="false" aria-labelledby="install-title" ref={ref}>
      <button className="install-close" onClick={dismiss} aria-label="Fechar"><X size={18} /></button>
      <div className="install-head">
        <img src="/icons/icon-192.png" alt="" width="48" height="48" />
        <div>
          <h2 id="install-title">{mode === 'installed' ? 'O app já está instalado' : (platform.mobile ? 'Instale o Radar no seu celular' : 'Instale o Radar no computador')}</h2>
          <p>{mode === 'installed' ? 'Você está usando a versão instalada.' : (platform.mobile ? 'Abre direto da tela inicial, em tela cheia, e mostra a agenda mesmo com a internet fraca.' : 'Abre numa janela própria, sem abas, e mostra a agenda mesmo com a internet fraca.')}</p>
        </div>
      </div>

      {mode === 'native' && (
        <div className="install-actions">
          <button className="btn solid" onClick={install}><Download size={16} aria-hidden="true" />Instalar app</button>
          <button className="btn text" onClick={dismiss}>Agora não</button>
        </div>
      )}

      {mode === 'ios' && (
        <>
          <ol className="install-steps">
            <li>Toque em <b>Compartilhar</b> <Share size={16} aria-hidden="true" className="ico" /> {iosWhere}.</li>
            <li>Role a lista e toque em <b>Adicionar à Tela de Início</b> <SquarePlus size={16} aria-hidden="true" className="ico" />.</li>
            <li>Toque em <b>Adicionar</b>, no canto de cima.</li>
          </ol>
          <div className="install-actions"><button className="btn outline" onClick={dismiss}>Entendi</button></div>
        </>
      )}

      {mode === 'android-manual' && (
        <>
          <ol className="install-steps">
            <li>Toque no menu <EllipsisVertical size={16} aria-label="três pontos" className="ico" /> do navegador.</li>
            <li>Escolha <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</li>
            <li>Confirme em <b>Instalar</b>.</li>
          </ol>
          <div className="install-actions"><button className="btn outline" onClick={dismiss}>Entendi</button></div>
        </>
      )}

      {mode === 'inapp' && (
        <>
          <p className="install-note">Você abriu o Radar pelo <b>{platform.inApp}</b>, e por aqui não dá para instalar. Abra no navegador do celular e a opção de instalar aparece.</p>
          <ol className="install-steps">
            {platform.ios
              ? <li>Toque em <Ellipsis size={15} aria-label="três pontos" className="ico" /> ou <Share size={15} aria-label="Compartilhar" className="ico" /> e escolha <b>Abrir no navegador</b> (ou <b>Abrir no Safari</b>).</li>
              : <li>Toque em <b>Abrir no Chrome</b> aqui embaixo, ou no menu <EllipsisVertical size={15} aria-label="três pontos" className="ico" /> e em <b>Abrir no navegador</b>.</li>}
            <li>Se não achar, copie o link e cole no {platform.ios ? 'Safari' : 'Chrome'}.</li>
          </ol>
          <div className="install-actions">
            {platform.android && <a className="btn solid" href={chromeIntentUrl()}><ExternalLink size={16} aria-hidden="true" />Abrir no Chrome</a>}
            <button className={platform.android ? 'btn outline' : 'btn solid'} onClick={copyLink}><Link2 size={16} aria-hidden="true" />{copied ? 'Link copiado' : 'Copiar link'}</button>
          </div>
        </>
      )}

      {mode === 'desktop-manual' && (
        <>
          <p className="install-note">No celular, abra este endereço e toque em instalar. No computador, use o Chrome ou o Edge e clique no ícone de instalar <Download size={14} aria-hidden="true" className="ico" /> na barra de endereço.</p>
          <div className="install-actions"><button className="btn outline" onClick={copyLink}><Link2 size={16} aria-hidden="true" />{copied ? 'Link copiado' : 'Copiar link'}</button></div>
        </>
      )}

      {mode === 'installed' && <div className="install-actions"><button className="btn outline" onClick={dismiss}>Fechar</button></div>}
    </div>
  );
}
