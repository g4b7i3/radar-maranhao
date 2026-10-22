// Notificações no celular (Web Push). Botão na Conta; a inscrição vai para radar_push e o servidor (radar-avisar) envia.
import { useEffect, useState } from 'react';
import { BellRing, BellOff } from 'lucide-react';
import { sb } from './sb';

const VAPID_PUBLIC = 'BL_ZVgJfCqE2Nir0YwSrJEUko4IkvkxoGwNMhb2--ZzhAzabIj4Dxuarm_QTzID9PIEnj5QFkYoL4n0AVOotv_o';
const unb64u = (s: string) => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
const suporta = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const instalado = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
const ehIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);

/** Convite para ligar as notificações: aparece uma vez, logo no topo, para quem ainda não ligou. */
export function PushConvite({ userId }: { userId: string }) {
  const [mostrar, setMostrar] = useState(false);
  const [indo, setIndo] = useState(false);
  useEffect(() => {
    (async () => {
      try { if (localStorage.getItem('radar-push-convite') === '1') return; } catch { /* */ }
      if (!suporta() || Notification.permission !== 'default') return;
      if (ehIOS() && !instalado()) return;
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      if (await reg?.pushManager.getSubscription()) return;
      setMostrar(true);
    })();
  }, []);
  const fechar = () => { try { localStorage.setItem('radar-push-convite', '1'); } catch { /* */ } setMostrar(false); };
  const ligar = async () => {
    setIndo(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(VAPID_PUBLIC) });
        const j = sub.toJSON();
        await sb.from('radar_push').upsert({ endpoint: sub.endpoint, user_id: userId, p256dh: j.keys!.p256dh, auth: j.keys!.auth, falhas: 0 });
      }
    } catch { /* fica sem */ }
    fechar();
  };
  if (!mostrar) return null;
  return (
    <div className="pro-push-convite" role="status">
      <BellRing size={20} aria-hidden="true" />
      <span><b>Quer saber na hora quando seu resultado oficial sair?</b> Também avisamos de duelos, grupos e renovação.</span>
      <div className="pro-linha"><button className="btn solid" disabled={indo} onClick={ligar}>Ativar</button><button className="btn text" onClick={fechar}>Depois</button></div>
    </div>
  );
}

export function PushConta({ userId }: { userId: string }) {
  const [estado, setEstado] = useState<'carregando' | 'sem_suporte' | 'ios_instalar' | 'desligado' | 'ligado' | 'bloqueado'>('carregando');
  const [indo, setIndo] = useState(false);
  useEffect(() => {
    (async () => {
      if (!suporta()) return setEstado(ehIOS() && !instalado() ? 'ios_instalar' : 'sem_suporte');
      if (Notification.permission === 'denied') return setEstado('bloqueado');
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      const sub = await reg?.pushManager.getSubscription();
      setEstado(sub ? 'ligado' : 'desligado');
    })();
  }, []);
  const ligar = async () => {
    setIndo(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setEstado(perm === 'denied' ? 'bloqueado' : 'desligado'); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(VAPID_PUBLIC) });
      const j = sub.toJSON();
      await sb.from('radar_push').upsert({ endpoint: sub.endpoint, user_id: userId, p256dh: j.keys!.p256dh, auth: j.keys!.auth, falhas: 0 });
      setEstado('ligado');
    } catch { setEstado('desligado'); }
    setIndo(false);
  };
  const desligar = async () => {
    setIndo(true);
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) { await sb.from('radar_push').delete().eq('endpoint', sub.endpoint); await sub.unsubscribe(); }
    setEstado('desligado'); setIndo(false);
  };
  if (estado === 'carregando') return null;
  return (
    <section className="pro-card">
      <div className="pro-linha"><p className="pro-k cinza"><BellRing size={14} aria-hidden="true" /> Notificações no celular</p>{estado === 'ligado' && <span className="pro-st ok">Ligadas</span>}</div>
      {estado === 'ligado' && <><p className="fine pro-sem-margem">Você recebe aviso quando um resultado oficial sai, quando aceitam o seu duelo, quando te chamam pra um grupo e antes do Pro vencer.</p><button className="btn text pro-esq" disabled={indo} onClick={desligar}><BellOff size={15} aria-hidden="true" />Desligar</button></>}
      {estado === 'desligado' && <><p className="fine pro-sem-margem">Saiba na hora quando o seu resultado oficial sair, quando aceitarem o seu duelo ou te chamarem pra um grupo.</p><button className="btn solid pro-btn" disabled={indo} onClick={ligar}><BellRing size={16} aria-hidden="true" />Ativar notificações</button></>}
      {estado === 'ios_instalar' && <p className="fine pro-sem-margem">No iPhone, as notificações só funcionam com o app instalado: toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>. Abra por lá e volte aqui.</p>}
      {estado === 'bloqueado' && <p className="fine pro-sem-margem">As notificações estão bloqueadas pro Radar neste navegador. Libere nas configurações do site (cadeado na barra de endereço) e tente de novo.</p>}
      {estado === 'sem_suporte' && <p className="fine pro-sem-margem">Este navegador não aceita notificações. No celular, instale o app pelo botão abaixo.</p>}
    </section>
  );
}
