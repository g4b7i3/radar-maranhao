// Detecção do aparelho/navegador e captura do pedido de instalação nativo (Android, Chrome, Edge, Samsung).

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

let deferred: BIPEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(f => f());

// Registrado o mais cedo possível: o navegador pode disparar o evento antes do React montar.
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e as BIPEvent; notify(); });
window.addEventListener('appinstalled', () => { deferred = null; installedNow = true; notify(); });
let installedNow = false;

export const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const canPromptNative = () => !!deferred;
export const wasJustInstalled = () => installedNow;

export async function promptNative(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable';
  const ev = deferred;
  deferred = null; // o navegador só aceita usar o pedido uma vez
  notify();
  await ev.prompt();
  const { outcome } = await ev.userChoice;
  return outcome;
}

export type Platform = {
  standalone: boolean;   // já está aberto como app instalado
  ios: boolean;
  android: boolean;
  mobile: boolean;
  inApp: string | null;  // nome do app (Instagram, WhatsApp…) quando aberto dentro dele
  iosBrowser: 'safari' | 'chrome' | 'firefox' | 'edge' | 'outro' | null;
};

const IN_APP: [RegExp, string][] = [
  [/Instagram/i, 'Instagram'], [/FBAN|FBAV|FB_IAB|FBIOS|FB4A/i, 'Facebook'], [/Messenger/i, 'Messenger'],
  [/WhatsApp/i, 'WhatsApp'], [/musical_ly|TikTok|BytedanceWebview|trill/i, 'TikTok'], [/Twitter/i, 'X (Twitter)'],
  [/Snapchat/i, 'Snapchat'], [/Pinterest/i, 'Pinterest'], [/LinkedInApp/i, 'LinkedIn'], [/Telegram/i, 'Telegram'],
  [/Line\//i, 'LINE'], [/GSA\//i, 'app do Google'],
];

export function detect(): Platform {
  const ua = navigator.userAgent || '';
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const nav = navigator as Navigator & { standalone?: boolean };
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches
    || window.matchMedia?.('(display-mode: fullscreen)').matches
    || window.matchMedia?.('(display-mode: minimal-ui)').matches
    || nav.standalone === true
    || document.referrer.startsWith('android-app://');
  let inApp: string | null = IN_APP.find(([re]) => re.test(ua))?.[1] ?? null;
  if (!inApp && android && /; wv\)/.test(ua)) inApp = 'navegador interno deste app';
  const iosBrowser = !ios ? null : /CriOS/.test(ua) ? 'chrome' : /FxiOS/.test(ua) ? 'firefox' : /EdgiOS/.test(ua) ? 'edge' : /Safari/.test(ua) && !inApp ? 'safari' : 'outro';
  return { standalone: !!standalone, ios, android, mobile: ios || android || /Mobi/i.test(ua), inApp, iosBrowser };
}

/** Link que, no Android, abre esta página direto no Chrome (sai do navegador do Instagram/WhatsApp). */
export function chromeIntentUrl() {
  const { host, pathname, search } = window.location;
  return `intent://${host}${pathname}${search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(window.location.href)};end`;
}
