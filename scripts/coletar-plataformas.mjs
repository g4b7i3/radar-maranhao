// Coleta diária das plataformas de inscrição que só funcionam com JavaScript
// (Crono Esportes, SA Crono, Central da Corrida, Topchip, GuardaLugar), as páginas oficiais das provas da agenda
// e dos calendários que a sessão do Claude não consegue abrir (Road Runners, running.life).
// Roda no GitHub Actions, que tem navegador e internet. Salva o texto de cada prova em coleta/<plataforma>.json.
// A pesquisa diária (PESQUISA.md) lê esses arquivos, confere e atualiza a agenda.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';
const MAX_PROVAS = Number(process.env.MAX_PROVAS || 150);
const MA = /\bMA\b|Maranh[aã]o|S[aã]o Lu[ií]s|Imperatriz|Timon|Caxias|Bacabal|Balsas|Cod[oó]|A[cç]ail[aâ]ndia|Barreirinhas|Pinheiro|Chapadinha|Santa In[eê]s|Ribamar|Pa[cç]o do Lumiar|Raposa/i;

const FONTES = [
  { id: 'cronoesportes', lista: ['https://www.cronoesportes.com.br/eventos'], prova: /cronoesportes\.com\.br\/evento\/\d+/ },
  { id: 'sacrono', lista: ['https://www.sacrono.com.br/'], prova: /sacrono\.com\.br\/evento\/(\d{4}\/|[a-z0-9-]+-\d{4}$)/ },
  { id: 'centraldacorrida', lista: ['https://centraldacorrida.com.br/', 'https://centraldacorrida.com.br/eventos'], prova: /centraldacorrida\.com\.br\/evento\/[^/?#]+$/, clicarMA: true },
  // GuardaLugar: sistema de reservas/inscrições usado por organizadores do Maranhão (indicado pelo Vinik em 15/10/2026)
  { id: 'guardalugar', lista: ['https://guardalugar.com/', 'https://guardalugar.com/eventos'], extra: ['https://guardalugar.com/evento/3fE0hu-6dzmimmjZC_1O-Q'], prova: /guardalugar\.com\/evento\/[A-Za-z0-9_-]{6,}$/ },
  { id: 'topchip', lista: ['https://topchip.com.br/', 'https://topchip.com.br/calendario'], prova: /^https:\/\/(www\.)?topchip\.com\.br\/(?!calendario|resultados|contato|sobre|login|cadastro|minha-conta|termos|politica|eventos?$)[a-z0-9-]{4,}\/?$/ },
  // Calendários de terceiros (só para descobrir provas; a confirmação é na página oficial).
  // Mudam devagar: coletados no máximo a cada 8 horas. Guardam os links externos de cada prova (link oficial de inscrição).
  { id: 'roadrunners', intervaloHoras: 8, guardarLinks: true, semApi: true, max: 120,
    lista: ['https://roadrunners.run/estado/ma/', 'https://roadrunners.run/estado/ma/page/2/', 'https://roadrunners.run/estado/ma/page/3/'],
    prova: /^https:\/\/(www\.)?roadrunners\.run\/evento\/[^/]+\/?$/ },
  { id: 'runninglife', intervaloHoras: 8, guardarLinks: true, semApi: true, max: 150,
    lista: ['sao-luis', 'sao-jose-de-ribamar', 'paco-do-lumiar', 'imperatriz', 'timon', 'caxias', 'acailandia', 'barra-do-corda', 'coroata', 'estreito',
      'chapadinha', 'joao-lisboa', 'balsas', 'bacabal', 'santa-ines', 'barreirinhas', 'codo', 'pinheiro', 'carolina', 'porto-franco']
      .map(c => `https://running.life/running-calendar/brazil/maranhao/${c}`).concat('https://running.life/running-calendar/brazil/maranhao'),
    prova: /^https:\/\/(www\.)?running\.life\/([a-z]{2}(-[a-z]{2})?\/)?event\/[^/]+\/?$/ },
  // Páginas oficiais das provas futuras da agenda (Topchip, Ticket Sports, Sympla, Doity, sites próprios…), que a sessão do Claude
  // não consegue abrir. Servem para conferir status, premiação e percurso (links de regulamento, GPX, Strava, mapas).
  // As plataformas acima já são coletadas por conta própria e ficam de fora.
  { id: 'oficiais', intervaloHoras: 6, guardarLinks: true, semApi: true, max: 120, limiteTexto: 20_000, lerPdfs: true, lista: [],
    extra: provasOficiais(), prova: /^$/ },
];

function provasOficiais() {
  try {
    const hoje = new Date().toISOString().slice(0, 10);
    const { events } = JSON.parse(readFileSync('public/data/radar.json', 'utf8'));
    const ja = /cronoesportes\.com\.br|sacrono\.com\.br|centraldacorrida\.com\.br|guardalugar\.com|roadrunners\.run|running\.life/;
    return [...new Set(events.filter(e => e.date >= hoje).sort((a, b) => a.date.localeCompare(b.date))
      .map(e => e.officialUrl).filter(u => u && /^https?:\/\/[^/]+\/./.test(u) && !ja.test(u) && !/\/calendario\/?$/.test(u)))];
  } catch { return []; }
}

// Chaves de API que os sites embutem nas páginas (ex.: token do Mapbox no Road Runners) não podem ir para o repositório:
// o GitHub recusa o push. Troca por [chave removida] em tudo o que for salvo.
const SEGREDOS = [/\b[ps]k\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, /\bAIza[0-9A-Za-z_-]{35}\b/g, /\b(access_token|api_key|apikey|token)=[A-Za-z0-9._-]{16,}/gi];
const semSegredos = t => SEGREDOS.reduce((s, re) => s.replace(re, m => (m.includes('=') ? m.split('=')[0] + '=' : '') + '[chave removida]'), t);

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

// Links para fora do site (inscrição, regulamento, Instagram), sem repetir e sem redes de compartilhamento.
const linksExternos = (hrefs, host) => [...new Set(hrefs.filter(h => /^https?:/.test(h) && !h.includes(host)
  && !/facebook\.com\/sharer|twitter\.com\/intent|x\.com\/intent|wa\.me\/\?|api\.whatsapp|linkedin\.com\/share|t\.me\/share|pinterest\.com\/pin/.test(h)))].slice(0, 40);

// Texto dos PDFs (regulamentos) ligados à página da prova: premiação, percurso e prazos costumam estar só neles.
let pdfjs;
async function textoPdf(ctx, url) {
  pdfjs ||= await import('pdfjs-dist/legacy/build/pdf.mjs');
  const r = await ctx.request.get(url, { timeout: 60_000 });
  const buf = await r.body();
  if (!r.ok() || buf.subarray(0, 5).toString() !== '%PDF-') throw new Error(`não é PDF (HTTP ${r.status()})`);
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true, isEvalSupported: false }).promise;
  let t = '';
  for (let i = 1; i <= Math.min(doc.numPages, 30) && t.length < 30_000; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    t += c.items.map(x => x.str + (x.hasEOL ? '\n' : ' ')).join('') + '\n';
  }
  return limpa(t).slice(0, 30_000);
}
const ehPdf = u => /\.pdf($|[?#_])/i.test(u) || /\/regulamento\//i.test(u);

async function coletar(browser, fonte) {
  const ctx = await browser.newContext({ userAgent: UA, locale: 'pt-BR', timezoneId: 'America/Fortaleza' });
  const resultado = { fonte: fonte.id, listas: [], provas: [], api: [] };
  const links = new Set(fonte.extra || []);
  for (const url of fonte.lista) {
    try {
      const { page, api } = await abrir(ctx, url, !fonte.semApi);
      const hrefs = await page.$$eval('a[href]', as => as.map(a => a.href.split('#')[0].split('?')[0]));
      if (page.url() !== url && fonte.intervaloHoras && /\/page\/\d+/.test(url)) { await page.close(); continue; } // página da lista que não existe
      hrefs.filter(h => fonte.prova.test(h)).forEach(h => links.add(h));
      const textoLista = limpa(await page.innerText('body'));
      resultado.listas.push({ url, texto: textoLista.slice(0, 40_000) });
      // Sites em que o cartão da prova não é um link (<a>): clica nos cartões do Maranhão para descobrir o endereço de cada prova.
      if (fonte.clicarMA) {
        const L = textoLista.split('\n');
        const titulos = [...new Set(L.filter((_, i) => /^\d{2}\/\d{2}\/\d{4}/.test(L[i + 1] || '') && /- MA$/i.test((L[i + 2] || '').trim())).map(t => t.trim()))];
        for (const t of titulos.slice(0, 60)) {
          if ([...links].some(h => h.includes('#' + t))) continue;
          try {
            const alvo = page.getByText(t, { exact: true }).first();
            await alvo.scrollIntoViewIfNeeded({ timeout: 5000 });
            await Promise.all([page.waitForURL(u => u.href !== url, { timeout: 15_000 }), alvo.click({ timeout: 5000 })]);
            const destino = page.url().split('#')[0].split('?')[0];
            if (destino !== url) links.add(destino);
            await page.goBack({ waitUntil: 'networkidle', timeout: 30_000 }).catch(() => page.goto(url, { waitUntil: 'networkidle' }));
            await page.waitForTimeout(800);
          } catch { /* cartão não clicável: segue */ }
        }
      }
      resultado.api.push(...api.slice(0, 20));
      await page.close();
    } catch (e) { resultado.listas.push({ url, erro: String(e).slice(0, 300) }); }
  }
  for (const url of [...links].slice(0, fonte.max || MAX_PROVAS)) {
    try {
      const { page } = await abrir(ctx, url, false);
      const texto = limpa(await page.innerText('body')).slice(0, fonte.limiteTexto || 8000);
      const prova = { url, titulo: await page.title(), maranhao: MA.test(texto), texto };
      if (fonte.guardarLinks) prova.links = linksExternos(await page.$$eval('a[href]', as => as.map(a => a.href)), new URL(url).hostname.replace(/^www\./, ''));
      if (fonte.lerPdfs) {
        const pdfs = [...new Set(await page.$$eval('a[href]', as => as.map(a => a.href)))].filter(ehPdf).slice(0, 3);
        prova.pdfs = [];
        for (const u of pdfs) {
          try { prova.pdfs.push({ url: u, texto: await textoPdf(ctx, u) }); } catch (e) { prova.pdfs.push({ url: u, erro: String(e).slice(0, 200) }); }
        }
      }
      resultado.provas.push(prova);
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
// Fonte com intervaloHoras: pula se a última coleta boa for recente (a não ser que seja pedida pelo nome).
const recente = fonte => {
  if (!fonte.intervaloHoras || so) return false;
  try {
    const f = `coleta/${fonte.id}.json`;
    if (!existsSync(f)) return false;
    const d = JSON.parse(readFileSync(f, 'utf8'));
    return d.provas?.length > 0 && Date.now() - Date.parse(d.coletadoEm) < fonte.intervaloHoras * 3600_000;
  } catch { return false; }
};
for (const fonte of FONTES.filter(f => !so || f.id === so)) {
  if (recente(fonte)) { console.log(`${fonte.id}: coletado há menos de ${fonte.intervaloHoras}h, fica para a próxima.`); continue; }
  const r = await coletar(browser, fonte);
  r.coletadoEm = new Date().toISOString();
  writeFileSync(`coleta/${fonte.id}.json`, semSegredos(JSON.stringify(r, null, 1)) + '\n');
  console.log(`${fonte.id}: ${r.totalLinks} provas encontradas, ${r.provas.filter(p => p.maranhao).length} no Maranhão`);
}
await browser.close();
