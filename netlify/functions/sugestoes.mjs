// "Enviar uma corrida": qualquer pessoa sugere uma prova pelo site e ela fica guardada aqui (Netlify Blobs).
// POST /api/sugestao  → guarda a sugestão (nome, cidade, data, link e observação; sem dados pessoais)
// GET  /api/sugestoes → lista as sugestões dos últimos 60 dias; a coleta do GitHub copia para coleta/sugestoes.json
//                       e a pesquisa diária confere cada uma antes de entrar na agenda.
import { getStore } from '@netlify/blobs';

const json = (dados, status = 200) => new Response(JSON.stringify(dados), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});
const txt = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

export default async (req) => {
  const store = getStore({ name: 'sugestoes', consistency: 'strong' });

  if (req.method === 'GET') {
    const limite = Date.now() - 60 * 86400_000;
    const { blobs } = await store.list();
    const itens = [];
    for (const b of blobs.slice(-300)) {
      const s = await store.get(b.key, { type: 'json' }).catch(() => null);
      if (s && Date.parse(s.enviadaEm) >= limite) itens.push({ id: b.key, ...s });
    }
    itens.sort((a, b) => b.enviadaEm.localeCompare(a.enviadaEm));
    return json({ total: itens.length, sugestoes: itens });
  }

  if (req.method !== 'POST') return json({ erro: 'Método não aceito' }, 405);
  let d;
  try { d = await req.json(); } catch { return json({ erro: 'Envio inválido' }, 400); }
  if (txt(d.site, 50)) return json({ ok: true }); // campo escondido preenchido: robô de spam
  const s = {
    prova: txt(d.prova, 120), cidade: txt(d.cidade, 80), data: txt(d.data, 40),
    link: txt(d.link, 400), obs: txt(d.obs, 600), enviadaEm: new Date().toISOString(),
  };
  if (s.prova.length < 3) return json({ erro: 'Informe o nome da prova.' }, 400);
  if (!s.cidade && !s.link) return json({ erro: 'Informe a cidade ou o link do anúncio.' }, 400);
  if (s.link && !/^https?:\/\/\S+$/i.test(s.link)) s.link = /^\S+\.\S+$/.test(s.link) ? 'https://' + s.link : '';
  await store.setJSON(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, s);
  return json({ ok: true });
};

export const config = { path: ['/api/sugestao', '/api/sugestoes'] };
