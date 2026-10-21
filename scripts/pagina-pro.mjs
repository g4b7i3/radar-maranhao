// Página do Radar Pro (/pro/): o mesmo app, mas com título, descrição e imagem próprios,
// para o link mandado no WhatsApp/Instagram mostrar a temporada, e não a agenda.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const DIST = 'dist', SITE = 'https://radarcorridasma.com.br';
let h = readFileSync(`${DIST}/index.html`, 'utf8');
const titulo = 'Radar Pro · Sua corrida vira temporada';
const desc = 'Resultado oficial verificado sozinho, nota por idade, ligas, ranking do Maranhão, duelos, 97 medalhas e Rei da prova. A sua temporada de corrida no Maranhão.';
const troca = (re, novo) => { if (!re.test(h)) throw new Error('não achei ' + re); h = h.replace(re, novo); };
troca(/<title>[^<]*<\/title>/, `<title>${titulo}</title>`);
troca(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${desc}" />`);
troca(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${titulo}" />`);
troca(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${desc}" />`);
troca(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${SITE}/pro/" />`);
troca(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${SITE}/pro/" />`);
troca(/<link rel="manifest" href="[^"]*" \/>/, '<link rel="manifest" href="/pro.webmanifest" />');
mkdirSync(`${DIST}/pro`, { recursive: true });
writeFileSync(`${DIST}/pro/index.html`, h);
console.log('Página do Radar Pro: /pro/');
