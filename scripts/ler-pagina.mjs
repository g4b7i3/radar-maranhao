// Lê uma página (com navegador) e salva o texto e os links em coleta/pagina.json. Uso pontual.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const url = process.argv[2];
const b = await chromium.launch(); const p = await b.newPage({ locale: 'pt-BR' });
await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => null);
await p.waitForTimeout(4000);
const texto = (await p.evaluate(() => document.body.innerText)).slice(0, 40000);
const links = await p.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => ({ t: a.innerText.trim().slice(0, 80), h: a.href })).filter(x => !x.h.startsWith('javascript')).slice(0, 200));
const meta = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('meta[property],meta[name]')].map(m => [m.getAttribute('property') || m.getAttribute('name'), m.content])));
writeFileSync('coleta/pagina.json', JSON.stringify({ url, lidoEm: new Date().toISOString(), titulo: await p.title(), meta, texto, links }, null, 1));
await b.close();
