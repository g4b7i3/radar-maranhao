// Radar Pro · Pix pelo Mercado Pago. Planos: mensal (R$ 10 = 30 dias), anual (R$ 96 = 365 dias) e equipe (R$ 150 = 30 dias para o treinador e até 20 alunos).
// POST (com login)        → cria a cobrança Pix e devolve QR + copia e cola.
// POST ?aviso=mp (sem login) → aviso do Mercado Pago. Não confiamos no aviso: buscamos o pagamento
//                             direto na API do Mercado Pago com o nosso token e só liberamos se estiver "approved".
// O token fica no segredo MP_ACCESS_TOKEN (colocado pelo Vinik no painel do Supabase).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const resp = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const PLANOS = {
  mensal: { preco: 10, dias: 30, desc: 'Radar Pro · 30 dias' },
  anual: { preco: 96, dias: 365, desc: 'Radar Pro · 1 ano' },
  equipe: { preco: 150, dias: 30, desc: 'Radar Pro · equipe (30 dias)' },
} as const;
type Plano = keyof typeof PLANOS;
const planoDe = (v: unknown): Plano => (v === 'anual' || v === 'equipe' ? v : 'mensal');
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
    const { data: antes } = await db.from('radar_pagamentos').select('aprovado_em, dados').eq('id', String(p.id)).maybeSingle();
    const plano = planoDe(antes?.dados?.plano);
    await db.from('radar_pagamentos').upsert({ id: String(p.id), user_id: uid || null, valor: p.transaction_amount, status: p.status, dados: { ...(antes?.dados ?? {}), plano, metodo: p.payment_method_id, criado: p.date_created, aprovado: p.date_approved } });
    if (p.status === 'approved' && uid && Number(p.transaction_amount) >= PLANOS[plano].preco) {
      // libera uma vez só por pagamento
      if (!antes?.aprovado_em) {
        await db.from('radar_pagamentos').update({ aprovado_em: new Date().toISOString() }).eq('id', String(p.id));
        const soma = (v: string | null | undefined) => { const base = v && new Date(v) > new Date() ? new Date(v) : new Date(); return new Date(base.getTime() + PLANOS[plano].dias * 86400_000).toISOString(); };
        if (plano === 'equipe') {
          const { data: e } = await db.from('radar_equipes').select('id, valida_ate').eq('dono', uid).maybeSingle();
          if (e) await db.from('radar_equipes').update({ valida_ate: soma(e.valida_ate) }).eq('id', e.id);
          else { // sem equipe criada: vale como assinatura própria, para o atleta não perder o pagamento
            const { data: a } = await db.from('radar_assinaturas').select('valida_ate').eq('user_id', uid).maybeSingle();
            await db.from('radar_assinaturas').upsert({ user_id: uid, valida_ate: soma(a?.valida_ate), atualizado_em: new Date().toISOString() });
          }
        } else {
          const { data: a } = await db.from('radar_assinaturas').select('valida_ate').eq('user_id', uid).maybeSingle();
          await db.from('radar_assinaturas').upsert({ user_id: uid, valida_ate: soma(a?.valida_ate), atualizado_em: new Date().toISOString() });
        }
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

  const plano = planoDe(corpo?.plano);
  if (corpo?.acao === 'status') { // a tela pergunta se já caiu (assinatura própria ou equipe em dia)
    const { data: ok } = await db.rpc('radar_eh_assinante', { uid: user.id });
    const { data: a } = await db.from('radar_assinaturas').select('valida_ate').eq('user_id', user.id).maybeSingle();
    const { data: e } = await db.from('radar_equipes').select('valida_ate').eq('dono', user.id).maybeSingle();
    return resp({ ativo: !!ok, valida_ate: a?.valida_ate ?? null, equipe_valida_ate: e?.valida_ate ?? null });
  }

  // reaproveita um Pix pendente do mesmo plano criado há menos de 20 min (evita gerar vários)
  const { data: pend } = await db.from('radar_pagamentos').select('id, dados, criado_em').eq('user_id', user.id).eq('status', 'pending').gte('criado_em', new Date(Date.now() - 20 * 60_000).toISOString()).order('criado_em', { ascending: false }).limit(3);
  const mesmo = (pend ?? []).find(x => planoDe(x.dados?.plano) === plano && x.dados?.qr);
  if (mesmo) return resp({ id: mesmo.id, qr: mesmo.dados.qr, qr_img: mesmo.dados.qr_img, valor: PLANOS[plano].preco, plano });

  const r = await fetch(`${MP}/v1/payments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({
      transaction_amount: PLANOS[plano].preco, description: PLANOS[plano].desc, payment_method_id: 'pix',
      payer: { email: user.email }, external_reference: user.id,
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/radar-pix?aviso=mp`,
      date_of_expiration: new Date(Date.now() + 30 * 60_000).toISOString().replace('Z', '-00:00'),
    }),
  }).then(x => x.json()).catch(() => null);
  const td = r?.point_of_interaction?.transaction_data;
  if (!r?.id || !td?.qr_code) return resp({ erro: 'O Mercado Pago não respondeu. Tente de novo em instantes.' }, 502);
  await db.from('radar_pagamentos').upsert({ id: String(r.id), user_id: user.id, valor: PLANOS[plano].preco, status: r.status, dados: { qr: td.qr_code, qr_img: td.qr_code_base64, plano } });
  return resp({ id: String(r.id), qr: td.qr_code, qr_img: td.qr_code_base64, valor: PLANOS[plano].preco, plano });
});
