// Radar Pro · Pix pelo Mercado Pago (R$ 10 = 30 dias).
// POST (com login)        → cria a cobrança Pix e devolve QR + copia e cola.
// POST ?aviso=mp (sem login) → aviso do Mercado Pago. Não confiamos no aviso: buscamos o pagamento
//                             direto na API do Mercado Pago com o nosso token e só liberamos se estiver "approved".
// O token fica no segredo MP_ACCESS_TOKEN (colocado pelo Vinik no painel do Supabase).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const resp = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const PRECO = 10, DIAS = 30;
const MP = 'https://api.mercadopago.com';

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const token = Deno.env.get('MP_ACCESS_TOKEN');
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const url = new URL(req.url);

  // ───────── Aviso do Mercado Pago
  if (url.searchParams.get('aviso') === 'mp') {
    if (!token) return resp({ ok: true });
    const corpo = await req.json().catch(() => ({}));
    const id = String(corpo?.data?.id ?? url.searchParams.get('data.id') ?? url.searchParams.get('id') ?? '').replace(/\D/g, '');
    if (!id) return resp({ ok: true });
    const p = await fetch(`${MP}/v1/payments/${id}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => null);
    if (!p?.id) return resp({ ok: true });
    const uid = String(p.external_reference ?? '');
    await db.from('radar_pagamentos').upsert({ id: String(p.id), user_id: uid || null, valor: p.transaction_amount, status: p.status, dados: { metodo: p.payment_method_id, criado: p.date_created, aprovado: p.date_approved } });
    if (p.status === 'approved' && uid && Number(p.transaction_amount) >= PRECO) {
      // libera uma vez só por pagamento
      const { data: pg } = await db.from('radar_pagamentos').select('aprovado_em').eq('id', String(p.id)).single();
      if (!pg?.aprovado_em) {
        await db.from('radar_pagamentos').update({ aprovado_em: new Date().toISOString() }).eq('id', String(p.id));
        const { data: a } = await db.from('radar_assinaturas').select('valida_ate').eq('user_id', uid).maybeSingle();
        const base = a?.valida_ate && new Date(a.valida_ate) > new Date() ? new Date(a.valida_ate) : new Date();
        await db.from('radar_assinaturas').upsert({ user_id: uid, valida_ate: new Date(base.getTime() + DIAS * 86400_000).toISOString(), atualizado_em: new Date().toISOString() });
      }
    }
    return resp({ ok: true });
  }

  // ───────── Atleta pede o Pix
  const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: { user } } = await anon.auth.getUser();
  if (!user) return resp({ erro: 'Faça login de novo.' }, 401);
  if (!token) return resp({ indisponivel: true });
  const corpo = await req.json().catch(() => ({}));

  if (corpo?.acao === 'status') { // a tela pergunta se já caiu
    const { data: a } = await db.from('radar_assinaturas').select('valida_ate').eq('user_id', user.id).maybeSingle();
    return resp({ ativo: !!a?.valida_ate && new Date(a.valida_ate) > new Date(), valida_ate: a?.valida_ate ?? null });
  }

  // reaproveita um Pix pendente criado há menos de 20 min (evita gerar vários)
  const { data: pend } = await db.from('radar_pagamentos').select('id, dados, criado_em').eq('user_id', user.id).eq('status', 'pending').gte('criado_em', new Date(Date.now() - 20 * 60_000).toISOString()).order('criado_em', { ascending: false }).limit(1).maybeSingle();
  if (pend?.dados?.qr) return resp({ id: pend.id, qr: pend.dados.qr, qr_img: pend.dados.qr_img, valor: PRECO });

  const r = await fetch(`${MP}/v1/payments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({
      transaction_amount: PRECO, description: 'Radar Pro · 30 dias', payment_method_id: 'pix',
      payer: { email: user.email }, external_reference: user.id,
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/radar-pix?aviso=mp`,
      date_of_expiration: new Date(Date.now() + 30 * 60_000).toISOString().replace('Z', '-00:00'),
    }),
  }).then(x => x.json()).catch(() => null);
  const td = r?.point_of_interaction?.transaction_data;
  if (!r?.id || !td?.qr_code) return resp({ erro: 'O Mercado Pago não respondeu. Tente de novo em instantes.' }, 502);
  await db.from('radar_pagamentos').upsert({ id: String(r.id), user_id: user.id, valor: PRECO, status: r.status, dados: { qr: td.qr_code, qr_img: td.qr_code_base64 } });
  return resp({ id: String(r.id), qr: td.qr_code, qr_img: td.qr_code_base64, valor: PRECO });
});
