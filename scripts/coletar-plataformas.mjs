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
  { id: 'centraldacorrida', lista: ['https://centraldacorrida.com.br/', 'https://centraldacorrida.com.br/eventos'], prova: /centraldacorrida\.com\.br\/evento\/[^/?#]+$/, clicarMA: true, filtroEstado: 'MA',
    // provas avisadas pelo Vinik que não apareciam na vitrine da Central (20/10/2026)
    extra: ['https://centraldacorrida.com.br/evento/corridacombateaofeminicidioslz2026'] },
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
  // Páginas oficiais de TODAS as provas futuras da agenda (Topchip, SA Crono, Central da Corrida, Crono Esportes, Ticket Sports,
  // Sympla, Doity, Night Run, sites próprios…), que a sessão do Claude não consegue abrir. Servem para conferir status, premiação
  // e percurso: guarda os links (regulamento, GPX, Strava, mapas), lê os PDFs de regulamento (inclusive do Google Drive) e segue
  // os links de inscrição (Running Land, TF Sports, Ticket Sports…) em "subpaginas".
  { id: 'oficiais', intervaloHoras: 6, guardarLinks: true, semApi: true, max: 130, limiteTexto: 20_000, lerPdfs: true, seguirInscricao: true, rolagemCurta: true,
    lista: [], extra: provasOficiais(), prova: /^$/ },
];

function provasOficiais() {
  try {
    const hoje = new Date().toISOString().slice(0, 10);
    const { events } = JSON.parse(readFileSync('public/data/radar.json', 'utf8'));
    // calendários de terceiros não são página oficial; as plataformas de inscrição entram (as coletas delas não guardam regulamento)
    const calendario = /roadrunners\.run|running\.life|corridasbr|soucorredor|vamucorrer|corrida1|todascorridas|agendaoffroad\.com\.br\/calendario|\/calendario\/?$/i;
    return [...new Set(events.filter(e => e.date >= hoje).sort((a, b) => a.date.localeCompare(b.date))
      .flatMap(e => [e.officialUrl, e.sourceUrl]).filter(u => u && /^https?:\/\/[^/]+\/./.test(u) && !calendario.test(u)))];
  } catch { return []; }
}

// Chaves de API que os sites embutem nas páginas (ex.: token do Mapbox no Road Runners) não podem ir para o repositório:
// o GitHub recusa o push. Troca por [chave removida] em tudo o que for salvo.
const SEGREDOS = [/\b[ps]k\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, /\bAIza[0-9A-Za-z_-]{35}\b/g, /\b(access_token|api_key|apikey|token)=[A-Za-z0-9._-]{16,}/gi];
const semSegredos = t => SEGREDOS.reduce((s, re) => s.replace(re, m => (m.includes('=') ? m.split('=')[0] + '=' : '') + '[chave removida]'), t);

const limpa = t => (t || '').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();

async function abrir(ctx, url, coletarApi, rolagemCurta = false) {
  const page = await ctx.newPage();
  const api = [];
  if (coletarApi) page.on('response', async r => {
    const ct = r.headers()['content-type'] || '';
    if (!ct.includes('json')) return;
    try { const body = await r.text(); if (body.length < 3_000_000) api.push({ url: r.url(), status: r.status(), body: body.slice(0, 400_000) }); } catch { /* ignora */ }
  });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => page.waitForTimeout(5000));
  // rola até o fim para carregar listas preguiçosas
  for (let i = 0; i < (rolagemCurta ? 6 : 20); i++) {
    const h = await page.evaluate(() => document.body.scrollHeight);
    await page.mouse.wheel(0, 4000); await page.waitForTimeout(700);
    if (await page.evaluate(() => document.body.scrollHeight) === h && i > 3) break;
  }
  await page.waitForTimeout(1500);
  return { page, api };
}

// Escolhe o estado no filtro da página (caixa "Selecione o Estado") e recarrega a lista inteira.
async function filtrarEstado(page, uf) {
  try {
    const sel = page.locator('select', { has: page.locator('option', { hasText: new RegExp(`^\\s*${uf}\\s*$`) }) }).first();
    if (!(await sel.count())) return 'sem caixa de estado';
    await sel.selectOption({ label: uf }, { timeout: 10_000 });
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(2500);
    // alguns sites só filtram ao tocar em buscar/filtrar
    const botao = page.getByRole('button', { name: /^(buscar|pesquisar|filtrar)$/i }).first();
    if (await botao.count()) { await botao.click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(2500); }
    for (let i = 0; i < 20; i++) {
      const h = await page.evaluate(() => document.body.scrollHeight);
      await page.mouse.wheel(0, 4000); await page.waitForTimeout(700);
      if (await page.evaluate(() => document.body.scrollHeight) === h && i > 3) break;
    }
    const linhas = (await page.innerText('body')).split('\n').map(t => t.trim());
    const doEstado = linhas.filter(t => new RegExp(`[-/]\\s*${uf}$`, 'i').test(t)).length;
    const outros = linhas.filter(t => /\s-\s[A-Z]{2}$/.test(t) && !new RegExp(`-\\s*${uf}$`, 'i').test(t)).length;
    return `estado ${uf} aplicado: ${doEstado} do ${uf}, ${outros} de outros estados`;
  } catch (e) { return 'filtro falhou: ' + String(e).slice(0, 150); }
}

// Links para fora do site (inscrição, regulamento, Instagram), sem repetir e sem redes de compartilhamento.
const linksExternos = (hrefs, host) => [...new Set(hrefs.filter(h => /^https?:/.test(h) && !h.includes(host)
  && !/facebook\.com\/sharer|twitter\.com\/intent|x\.com\/intent|wa\.me\/\?|api\.whatsapp|linkedin\.com\/share|t\.me\/share|pinterest\.com\/pin/.test(h)))].slice(0, 40);

// Texto dos PDFs (regulamentos) ligados à página da prova: premiação, percurso e prazos costumam estar só neles.
let pdfjs;
async function textoPdf(ctx, url) {
  pdfjs ||= await import('pdfjs-dist/legacy/build/pdf.mjs');
  // Google Drive: troca o link de visualização pelo download direto do arquivo
  const drive = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?.*id=)([A-Za-z0-9_-]{20,})/);
  if (drive) url = `https://drive.google.com/uc?export=download&id=${drive[1]}`;
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
const ehPdf = u => /\.pdf($|[?#_])/i.test(u) || /\/regulamento\//i.test(u) || /drive\.google\.com\/(file\/d\/|open\?id=|uc\?)/.test(u);
// Links de inscrição para seguir a partir da página oficial (é lá que costumam estar lotes, premiação e regulamento).
const INSCRICAO = /runningland\.com\.br\/(?!$|\?|politica|faq|customer|redirect|login|cadastro)[a-z0-9-]{6,}|tfsports\.com\.br\/(events|tf-experience)\/|ticketsports\.com\.br\/e\/|sympla\.com\.br\/evento\/|doity\.com\.br\/[a-z0-9-]{6,}|uticket\.com\.br\/evento|minhasinscricoes\.com\.br\/evento|souatleta\.com\/[a-z0-9-]{6,}|brasilquecorre\.com\/|zeroumeventos|ativo\.com\/|centraldacorrida\.com\.br\/evento\/|sacrono\.com\.br\/evento\/|cronoesportes\.com\.br\/evento\/|topchip\.com\.br\/[a-z0-9-]{6,}|guardalugar\.com\/evento\//i;
async function lerPdfs(ctx, page) {
  const pdfs = [...new Set(await page.$$eval('a[href], iframe[src], embed[src]', as => as.map(a => a.href || a.src)))].filter(ehPdf).slice(0, 3);
  const out = [];
  for (const u of pdfs) {
    try { out.push({ url: u, texto: await textoPdf(ctx, u) }); } catch (e) { out.push({ url: u, erro: String(e).slice(0, 200) }); }
  }
  return out;
}

async function coletar(browser, fonte) {
  const ctx = await browser.newContext({ userAgent: UA, locale: 'pt-BR', timezoneId: 'America/Fortaleza' });
  const resultado = { fonte: fonte.id, listas: [], provas: [], api: [] };
  const links = new Set(fonte.extra || []);
  for (const url of fonte.lista) {
    try {
      const { page, api } = await abrir(ctx, url, !fonte.semApi);
      // Central da Corrida: a vitrine não mostra todas as provas; com o filtro de estado aparecem todas as do Maranhão.
      let filtro = null;
      if (fonte.filtroEstado) filtro = await filtrarEstado(page, fonte.filtroEstado);
      const hrefs = await page.$$eval('a[href]', as => as.map(a => a.href.split('#')[0].split('?')[0]));
      if (page.url() !== url && fonte.intervaloHoras && /\/page\/\d+/.test(url)) { await page.close(); continue; } // página da lista que não existe
      hrefs.filter(h => fonte.prova.test(h)).forEach(h => links.add(h));
      const textoLista = limpa(await page.innerText('body'));
      resultado.listas.push({ url, ...(filtro ? { filtro } : {}), texto: textoLista.slice(0, 40_000) });
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
      // PDF direto (regulamento como link oficial): lê o texto sem abrir página
      if (fonte.lerPdfs && ehPdf(url)) {
        try { const t = await textoPdf(ctx, url); resultado.provas.push({ url, titulo: 'PDF', maranhao: MA.test(t), texto: '', pdfs: [{ url, texto: t }] }); }
        catch (e) { resultado.provas.push({ url, erro: String(e).slice(0, 300) }); }
        continue;
      }
      const { page } = await abrir(ctx, url, false, fonte.rolagemCurta);
      const texto = limpa(await page.innerText('body')).slice(0, fonte.limiteTexto || 8000);
      const prova = { url, titulo: await page.title(), maranhao: MA.test(texto), texto };
      const hrefs = await page.$$eval('a[href]', as => as.map(a => a.href));
      if (fonte.guardarLinks) prova.links = linksExternos(hrefs, new URL(url).hostname.replace(/^www\./, ''));
      if (fonte.lerPdfs) prova.pdfs = await lerPdfs(ctx, page);
      if (prova.links && /^\s*$/.test(texto)) prova.aviso = 'página sem texto (o site pode ter bloqueado o robô)';
      await page.close();
      // Segue até 2 links de inscrição de outro site (lotes, premiação e regulamento costumam estar lá).
      if (fonte.seguirInscricao) {
        const host = new URL(url).hostname.replace(/^www\./, '');
        const alvos = [...new Set(hrefs.map(h => h.split('#')[0]))].filter(h => INSCRICAO.test(h) && !h.includes(host) && !links.has(h)).slice(0, 2);
        prova.subpaginas = [];
        for (const sub of alvos) {
          try {
            const { page: p2 } = await abrir(ctx, sub, false, true);
            const t2 = limpa(await p2.innerText('body')).slice(0, 12_000);
            prova.subpaginas.push({ url: sub, titulo: await p2.title(), texto: t2, pdfs: fonte.lerPdfs ? await lerPdfs(ctx, p2) : [] });
            await p2.close();
          } catch (e) { prova.subpaginas.push({ url: sub, erro: String(e).slice(0, 200) }); }
        }
      }
      resultado.provas.push(prova);
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
