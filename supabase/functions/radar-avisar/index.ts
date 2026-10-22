// Radar Pro · envia os avisos pendentes (tabela radar_avisos) por push (Web Push/VAPID) e, se houver, por e-mail (Resend).
// Chamado de hora em hora pelo GitHub Actions (junto com a coleta) com o cabeçalho x-radar-interno = service role.
// Antes de enviar, gera os lembretes de renovação do dia (radar_gerar_lembretes).
// Segredos: VAPID_PRIVATE_KEY (obrigatório para push), RESEND_API_KEY (opcional, e-mail), RADAR_INTERNO (token do agendador do banco).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const VAPID_PUBLIC = 'BL_ZVgJfCqE2Nir0YwSrJEUko4IkvkxoGwNMhb2--ZzhAzabIj4Dxuarm_QTzID9PIEnj5QFkYoL4n0AVOotv_o';
const CONTATO = 'mailto:vinikautor@gmail.com';
const resp = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json' } });

// ───────── base64url
type U8 = Uint8Array<ArrayBuffer>;
const b64u = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s: string): U8 => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)) as U8; };
const concat = (...a: Uint8Array[]): U8 => { const out = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let o = 0; for (const x of a) { out.set(x, o); o += x.length; } return out as U8; };
const enc = { encode: (s: string): U8 => new TextEncoder().encode(s) as U8 };

// ───────── VAPID (JWT ES256 assinado com a chave privada)
async function chaveVapid(privB64: string) {
  const pub = unb64u(VAPID_PUBLIC);
  const jwk = { kty: 'EC', crv: 'P-256', x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), d: privB64 };
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}
async function jwtVapid(priv: CryptoKey, aud: string) {
  const h = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const p = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: CONTATO })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, priv, enc.encode(`${h}.${p}`));
  return `${h}.${p}.${b64u(sig)}`;
}

// ───────── Cifra do payload (RFC 8291, aes128gcm)
async function hkdf(salt: U8, ikm: U8, info: U8, len: number): Promise<U8> {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8)) as U8;
}
async function cifrar(p256dh: string, auth: string, texto: string) {
  const uaPub = unb64u(p256dh), authS = unb64u(auth);
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const localPub = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey)) as U8;
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256)) as U8;
  const ikm = await hkdf(authS, shared, concat(enc.encode('WebPush: info\0'), uaPub, localPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16)) as U8;
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const dados = concat(enc.encode(texto), new Uint8Array([2]) as U8); // padding delimiter
  const cifra = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, dados)) as U8;
  const rs = new Uint8Array(4) as U8; new DataView(rs.buffer).setUint32(0, 4096);
  const header = concat(salt, rs, new Uint8Array([localPub.length]) as U8, localPub);
  return concat(header, cifra);
}

async function enviarPush(priv: CryptoKey, sub: { endpoint: string; p256dh: string; auth: string }, payload: string) {
  const corpo = await cifrar(sub.p256dh, sub.auth, payload);
  const jwt = await jwtVapid(priv, new URL(sub.endpoint).origin);
  const r = await fetch(sub.endpoint, { method: 'POST', headers: { Authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC}`, 'Content-Type': 'application/octet-stream', 'Content-Encoding': 'aes128gcm', TTL: '86400', Urgency: 'normal' }, body: corpo });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 150)}`);
  return r.status;
}

Deno.serve(async req => {
  const interno = req.headers.get('x-radar-interno') ?? '';
  if (!interno || (interno !== Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') && interno !== Deno.env.get('RADAR_INTERNO'))) return resp({ erro: 'Sem permissão.' }, 403);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const privB64 = Deno.env.get('VAPID_PRIVATE_KEY');
  const resend = Deno.env.get('RESEND_API_KEY');
  const remetente = Deno.env.get('EMAIL_REMETENTE') || 'Radar Corridas MA <radar@radarcorridasma.com.br>';

  const { data: lembretes } = await db.rpc('radar_gerar_lembretes');
  const { data: avisos } = await db.from('radar_avisos').select('*').is('enviado_em', null).order('criado_em').limit(200);
  if (!avisos?.length) return resp({ ok: true, lembretes, enviados: 0 });

  let erroVapid: string | null = null;
  const priv = privB64 ? await chaveVapid(privB64.trim()).catch(e => { erroVapid = String(e?.message ?? e); return null; }) : null;
  let erroEmail: string | null = null;
  const ids = [...new Set(avisos.map(a => a.user_id))];
  const { data: subs } = await db.from('radar_push').select('*').in('user_id', ids);
  const emails = new Map<string, string>();
  if (resend) for (const id of ids) { const { data } = await db.auth.admin.getUserById(id); if (data?.user?.email) emails.set(id, data.user.email); }

  let push = 0, mail = 0, mortos = 0; const erroPush: string[] = [];
  for (const a of avisos) {
    const payload = JSON.stringify({ titulo: a.titulo, corpo: a.corpo, url: a.url ?? 'https://radarcorridasma.com.br/?pro', tag: a.tipo });
    if (priv) for (const s of (subs ?? []).filter(x => x.user_id === a.user_id)) {
      try {
        const st = await enviarPush(priv, s, payload);
        if (st === 404 || st === 410) { await db.from('radar_push').delete().eq('endpoint', s.endpoint); mortos++; }
        else if (st >= 200 && st < 300) push++;
        else { erroPush.push(`${st} ${s.endpoint.slice(8, 30)}`); await db.from('radar_push').update({ falhas: (s.falhas ?? 0) + 1 }).eq('endpoint', s.endpoint); }
      } catch (e) { erroPush.push(String(e).slice(0, 120)); }
    }
    const email = emails.get(a.user_id);
    if (resend && email && ['renovacao', 'resultado_verificado', 'admin_resumo'].includes(a.tipo)) {
      const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#0f1a33"><p style="font-size:12px;letter-spacing:2px;color:#1D3FBF;font-weight:700">RADAR PRO · CORRIDAS MA</p><h2 style="margin:8px 0 12px">${a.titulo}</h2><p style="font-size:16px;line-height:1.5">${a.corpo}</p><p style="margin:24px 0"><a href="${a.url ?? 'https://radarcorridasma.com.br/?pro'}" style="background:#1D3FBF;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">Abrir o Radar Pro</a></p><p style="font-size:12px;color:#667">Você recebe este e-mail porque tem conta no Radar Pro. radarcorridasma.com.br</p></div>`;
      try {
        const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resend}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: remetente, to: [email], subject: a.titulo, html }) });
        if (r.ok) mail++; else erroEmail = `${r.status} ${(await r.text()).slice(0, 200)}`;
      } catch (e) { erroEmail = String(e); }
    }
    await db.from('radar_avisos').update({ enviado_em: new Date().toISOString() }).eq('id', a.id);
  }
  return resp({ ok: true, lembretes, avisos: avisos.length, push, email: mail, inscricoes_removidas: mortos, push_ativo: !!priv, email_ativo: !!resend, vapid_tam: privB64?.length ?? 0, erro_vapid: erroVapid, erro_email: erroEmail, erro_push: erroPush, remetente });
});
