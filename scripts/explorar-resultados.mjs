// Exploração (temporária): como cada cronometragem publica os resultados.
// Abre as páginas de resultados e as páginas de provas já realizadas, guarda texto, links e respostas JSON.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';
const ALVOS = [
  'https://centraldacorrida.com.br/resultados', 'https://centraldacorrida.com.br/', 
  'https://www.sacrono.com.br/resultados', 'https://www.sacrono.com.br/',
  'https://www.cronoesportes.com.br/resultados', 'https://www.cronoesportes.com.br/evento/8764/circuito-sesc-de-corridas-so-jos-de-ribamar-2026',
  'https://www.cronoesportes.com.br/evento/1569/corrida-dos-professores-itapecuru',
  'https://topchip.com.br/resultados', 'https://topchip.com.br/i-corrida-azul-marinho',
  'https://metasportoficial.com.br/eventos/maratona-hotbel-2026', 'https://www.brasilcorrida.com.br/',
];
const limpa = t => (t || '').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
const b = await chromium.launch();
const ctx = await b.newContext({ userAgent: UA, locale: 'pt-BR' });
const out = [];
for (const url of ALVOS) {
  const page = await ctx.newPage(); const api = [];
  page.on('response', async r => { const ct = r.headers()['content-type'] || ''; if (/json|csv|text\/plain/.test(ct)) { try { const t = await r.text(); api.push({ url: r.url(), ct, tam: t.length, ini: t.slice(0, 3000) }); } catch {} } });
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => page.waitForTimeout(5000));
    for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 4000); await page.waitForTimeout(600); }
    const links = await page.$$eval('a[href]', as => as.map(a => ({ h: a.href, t: (a.innerText || '').trim().slice(0, 80) })));
    const resLinks = links.filter(l => /result|classifica|tempo|ranking|\.pdf|\.xls|\.csv/i.test(l.h + ' ' + l.t)).slice(0, 80);
    out.push({ url, final: page.url(), titulo: await page.title(), texto: limpa(await page.innerText('body')).slice(0, 7000), resLinks, api: api.slice(0, 15) });
    // segue até 3 links de resultado
    for (const l of resLinks.filter(l => !/\.pdf/i.test(l.h)).slice(0, 3)) {
      const p2 = await ctx.newPage(); const api2 = [];
      p2.on('response', async r => { const ct = r.headers()['content-type'] || ''; if (/json|csv/.test(ct)) { try { const t = await r.text(); api2.push({ url: r.url(), tam: t.length, ini: t.slice(0, 3000) }); } catch {} } });
      try {
        await p2.goto(l.h, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => p2.waitForTimeout(5000));
        const l2 = await p2.$$eval('a[href]', as => as.map(a => ({ h: a.href, t: (a.innerText || '').trim().slice(0, 80) })));
        out.push({ de: url, url: l.h, final: p2.url(), titulo: await p2.title(), texto: limpa(await p2.innerText('body')).slice(0, 7000), resLinks: l2.filter(x => /result|classifica|\.pdf|\.xls|\.csv/i.test(x.h + ' ' + x.t)).slice(0, 60), api: api2.slice(0, 15) });
      } catch (e) { out.push({ de: url, url: l.h, erro: String(e).slice(0, 200) }); }
      await p2.close();
    }
  } catch (e) { out.push({ url, erro: String(e).slice(0, 300) }); }
  await page.close();
}
mkdirSync('coleta', { recursive: true });
writeFileSync('coleta/explora-resultados.json', JSON.stringify(out, null, 1));
await b.close();
