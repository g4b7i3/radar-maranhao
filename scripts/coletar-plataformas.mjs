// Coleta diária das plataformas de inscrição que só funcionam com JavaScript
// (Crono Esportes, SA Crono, Central da Corrida, Topchip).
// Roda no GitHub Actions, que tem navegador e internet. Salva o texto de cada prova em coleta/<plataforma>.json.
// A pesquisa diária (PESQUISA.md) lê esses arquivos, confere e atualiza a agenda.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';
const MAX_PROVAS = Number(process.env.MAX_PROVAS || 150);
const MA = /\bMA\b|Maranh[aã]o|S[aã]o Lu[ií]s|Imperatriz|Timon|Caxias|Bacabal|Balsas|Cod[oó]|A[cç]ail[aâ]ndia|Barreirinhas|Pinheiro|Chapadinha|Santa In[eê]s|Ribamar|Pa[cç]o do Lumiar|Raposa/i;

const FONTES = [
  { id: 'cronoesportes', lista: ['https://www.cronoesportes.com.br/eventos'], prova: /cronoesportes\.com\.br\/evento\/\d+/ },
  { id: 'sacrono', lista: ['https://www.sacrono.com.br/'], prova: /sacrono\.com\.br\/evento\/\d{4}\// },
  { id: 'centraldacorrida', lista: ['https://centraldacorrida.com.br/', 'https://centraldacorrida.com.br/eventos'], prova: /centraldacorrida\.com\.br\/evento\/[^/?#]+$/ },
  { id: 'topchip', lista: ['https://topchip.com.br/', 'https://topchip.com.br/calendario'], prova: /^https:\/\/(www\.)?topchip\.com\.br\/(?!calendario|resultados|contato|sobre|login|cadastro|minha-conta|termos|politica|eventos?$)[a-z0-9-]{4,}\/?$/ },
];

const limpa = t => (t || '').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();

async function abrir(ctx, url, coletarApi) {
  const page = await ctx.newPage();
  const api = [];
  if (coletarApi) page.on('response', async r => {
    const ct = r.headers()['content-type'] || '';
    if (!ct.includes('json')) return;
    try { const body = await r.text(); if (body.length < 3_000_000) api.push({ url: r.url(), status: r.status(), body: body.slice(0, 400_000) }); } catch { /* ignora */ }
  });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => page.waitForTimeout(5000));
  // rola até o fim para carregar listas preguiçosas
  for (let i = 0; i < 20; i++) {
    const h = await page.evaluate(() => document.body.scrollHeight);
    await page.mouse.wheel(0, 4000); await page.waitForTimeout(700);
    if (await page.evaluate(() => document.body.scrollHeight) === h && i > 3) break;
  }
  await page.waitForTimeout(1500);
  return { page, api };
}

async function coletar(browser, fonte) {
  const ctx = await browser.newContext({ userAgent: UA, locale: 'pt-BR', timezoneId: 'America/Fortaleza' });
  const resultado = { fonte: fonte.id, listas: [], provas: [], api: [] };
  const links = new Set();
  for (const url of fonte.lista) {
    try {
      const { page, api } = await abrir(ctx, url, true);
      const hrefs = await page.$$eval('a[href]', as => as.map(a => a.href.split('#')[0].split('?')[0]));
      hrefs.filter(h => fonte.prova.test(h)).forEach(h => links.add(h));
      resultado.listas.push({ url, texto: limpa(await page.innerText('body')).slice(0, 40_000) });
      resultado.api.push(...api.slice(0, 20));
      await page.close();
    } catch (e) { resultado.listas.push({ url, erro: String(e).slice(0, 300) }); }
  }
  for (const url of [...links].slice(0, MAX_PROVAS)) {
    try {
      const { page } = await abrir(ctx, url, false);
      const texto = limpa(await page.innerText('body')).slice(0, 8000);
      resultado.provas.push({ url, titulo: await page.title(), maranhao: MA.test(texto), texto });
      await page.close();
    } catch (e) { resultado.provas.push({ url, erro: String(e).slice(0, 300) }); }
  }
  resultado.totalLinks = links.size;
  await ctx.close();
  return resultado;
}

const browser = await chromium.launch();
mkdirSync('coleta', { recursive: true });
const so = process.argv[2];
for (const fonte of FONTES.filter(f => !so || f.id === so)) {
  const r = await coletar(browser, fonte);
  r.coletadoEm = new Date().toISOString();
  writeFileSync(`coleta/${fonte.id}.json`, JSON.stringify(r, null, 1) + '\n');
  console.log(`${fonte.id}: ${r.totalLinks} provas encontradas, ${r.provas.filter(p => p.maranhao).length} no Maranhão`);
}
await browser.close();
