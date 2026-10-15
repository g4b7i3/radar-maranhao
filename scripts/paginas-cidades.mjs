// Gera, a cada publicação, uma página simples por cidade (dist/corridas/<cidade>/index.html),
// a página com todas as cidades (dist/corridas/index.html), o sitemap.xml e o robots.txt.
// São páginas com o texto já pronto no HTML, para o Google entender e mostrar nas buscas
// ("corridas em Imperatriz 2026"). O site principal continua igual.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const SITE = 'https://radarcorridas.netlify.app';
const DIST = 'dist';
if (!existsSync(DIST)) { console.error('Rode depois do vite build (pasta dist não existe).'); process.exit(1); }

const radar = JSON.parse(readFileSync('public/data/radar.json', 'utf8'));
const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Fortaleza' }); // AAAA-MM-DD
const ANO = hoje.slice(0, 4);

const slug = v => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const dataLonga = d => { const x = new Date(d + 'T12:00:00Z'); return `${SEMANA[x.getUTCDay()]}, ${x.getUTCDate()} de ${MESES[x.getUTCMonth()]} de ${x.getUTCFullYear()}`; };
const STATUS = { Abertas: 'Inscrições abertas', 'Em breve': 'Inscrições em breve', Consultar: 'Confirmar inscrições', Encerradas: 'Inscrições encerradas', Esgotadas: 'Vagas esgotadas', Cancelada: 'Cancelada', Adiada: 'Adiada' };
const lista = (xs, e = 'e') => xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ` ${e} ` + xs.at(-1);
const km = d => `${String(d).replace('.', ',')} km`;
const local = e => { const l = (e.location || '').trim(); return !l || /a confirmar/i.test(l) ? 'Local a confirmar' : l; };
const atualizado = (() => { try { const d = new Date(radar.lastChecked); return `${d.toLocaleDateString('pt-BR', { timeZone: 'America/Fortaleza' })} às ${d.toLocaleTimeString('pt-BR', { timeZone: 'America/Fortaleza', hour: '2-digit', minute: '2-digit' })}`; } catch { return ''; } })();

const futuras = radar.events.filter(e => e.date && e.date >= hoje && e.status !== 'Cancelada').sort((a, b) => a.date.localeCompare(b.date));
const porCidade = new Map();
for (const e of futuras) { if (!porCidade.has(e.city)) porCidade.set(e.city, []); porCidade.get(e.city).push(e); }
const cidades = [...porCidade.keys()].sort((a, b) => porCidade.get(b).length - porCidade.get(a).length || a.localeCompare(b, 'pt-BR'));

const LOGO = '<svg width="34" height="34" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#1D3FBF"/><g fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 0 0 8-8M20 4a8 8 0 0 0 8 8M28 20a8 8 0 0 0-8 8M12 28a8 8 0 0 0-8-8"/><path d="M16 9l7 7-7 7-7-7z"/></g></svg>';
const CSS = `:root{--paper:#f3f5f9;--surface:#fff;--ink:#0f1a33;--muted:#55607a;--line:#dfe4ee;--cobalt:#1D3FBF;--tint:#e6ebfa;--open:#0b7a4b;--open-bg:#dff5ea;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{--paper:#0d1324;--surface:#141c31;--ink:#e8ecf6;--muted:#9aa5bd;--line:#26314b;--cobalt:#6f8cff;--tint:#1c2850;--open:#4cc795;--open-bg:#12352a}}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--cobalt)}.wrap{max-width:760px;margin:0 auto;padding:0 16px}
header{background:var(--surface);border-bottom:1px solid var(--line)}header .wrap{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:64px}
.marca{display:flex;align-items:center;gap:10px;color:var(--ink);text-decoration:none;font-weight:800;font-size:1.05rem}
.btn{display:inline-flex;align-items:center;min-height:44px;padding:0 18px;border-radius:999px;background:var(--cobalt);color:#fff;text-decoration:none;font-weight:700;white-space:nowrap}
h1{font-size:clamp(1.9rem,6vw,2.6rem);line-height:1.1;margin:28px 0 10px;letter-spacing:-.01em}.intro{color:var(--muted);margin:0 0 8px}
.atual{font-size:.85rem;color:var(--muted);margin:0 0 24px}h2{font-size:1.25rem;margin:32px 0 10px;padding-bottom:6px;border-bottom:2px solid var(--ink)}
ol{list-style:none;margin:0;padding:0}li.prova{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin:10px 0}
.quando{font-weight:700;color:var(--cobalt);font-size:.9rem;margin:0}.nome{font-size:1.15rem;margin:2px 0 4px}.nome a{color:var(--ink);text-decoration:none}.nome a:hover{text-decoration:underline}
.det{margin:0;color:var(--muted);font-size:.95rem}.tags{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 0;padding:0;list-style:none}
.tags li{font-size:.8rem;font-weight:650;padding:2px 9px;border-radius:999px;background:var(--tint);color:var(--cobalt)}.tags li.ab{background:var(--open-bg);color:var(--open)}
.acoes{display:flex;flex-wrap:wrap;gap:14px;margin-top:10px;font-weight:600;font-size:.95rem}.acoes a{min-height:32px;display:inline-flex;align-items:center}
.cidades{display:flex;flex-wrap:wrap;gap:8px;padding:0;list-style:none}.cidades a{display:inline-flex;align-items:center;min-height:44px;padding:0 14px;border:1.5px solid var(--line);border-radius:999px;background:var(--surface);color:var(--ink);text-decoration:none;font-weight:600}
.cidades a:hover{border-color:var(--cobalt)}.cidades small{color:var(--muted);margin-left:6px;font-weight:500}
.cta{margin:36px 0;padding:22px;border-radius:18px;background:var(--cobalt);color:#fff}.cta p{margin:0 0 14px}.cta .btn{background:#fff;color:#1D3FBF}
footer{color:var(--muted);font-size:.85rem;padding:24px 0 40px}`;

function pagina({ caminho, titulo, descricao, corpo, jsonld }) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descricao)}">
<link rel="canonical" href="${SITE}${caminho}">
<meta property="og:type" content="website"><meta property="og:locale" content="pt_BR">
<meta property="og:title" content="${esc(titulo)}"><meta property="og:description" content="${esc(descricao)}">
<meta property="og:url" content="${SITE}${caminho}"><meta property="og:image" content="${SITE}/icons/icon-512.png">
<meta name="theme-color" content="#1D3FBF">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="manifest" href="/manifest.webmanifest">
<style>${CSS}</style>
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}
<script defer src="https://cloud.umami.is/script.js" data-website-id="b76ab5df-6ae1-413d-8502-e52632473f44"></script>
</head>
<body>
<header><div class="wrap"><a class="marca" href="/">${LOGO}Radar Corridas Maranhão</a><a class="btn" href="/" data-umami-event="Página da cidade: abrir o Radar">Abrir o Radar</a></div></header>
<main class="wrap">
${corpo}
</main>
<footer class="wrap">Radar Corridas Maranhão · agenda de corridas de rua e trail do Maranhão, conferida várias vezes por dia. Confirme sempre data, local e inscrição na página oficial da prova. · <a href="/corridas/">Corridas por cidade</a></footer>
</body>
</html>
`;
}

function itemProva(e) {
  const tags = [];
  if (e.status && STATUS[e.status]) tags.push(`<li${e.status === 'Abertas' ? ' class="ab"' : ''}>${esc(STATUS[e.status])}</li>`);
  if (e.modality === 'Trail') tags.push('<li>Trail</li>');
  if (e.prize?.kind === 'dinheiro' && e.prize.top) tags.push(`<li>Premiação em dinheiro</li>`);
  const largada = /largada[^0-9]{0,12}(\d{1,2})\s*h\s*(\d{2})?/i.exec(e.notes || '');
  const hora = largada ? ` · largada às ${largada[1]}h${largada[2] || ''}` : '';
  return `<li class="prova">
  <p class="quando">${esc(dataLonga(e.date))}${esc(hora)}</p>
  <h3 class="nome"><a href="/?prova=${encodeURIComponent(e.id)}">${esc(e.name)}</a></h3>
  <p class="det">${e.distances.length ? esc(lista(e.distances.map(km))) : 'Distâncias a confirmar'} · ${esc(local(e))}</p>
  ${tags.length ? `<ul class="tags">${tags.join('')}</ul>` : ''}
  <p class="acoes"><a href="/?prova=${encodeURIComponent(e.id)}" data-umami-event="Página da cidade: ver no Radar">Ver no Radar</a>${e.officialUrl ? `<a href="${esc(e.officialUrl)}" rel="noopener" target="_blank" data-umami-event="Página da cidade: página oficial">Página oficial e inscrição</a>` : ''}</p>
</li>`;
}

function eventoLd(e) {
  return {
    '@type': 'SportsEvent', name: e.name, startDate: e.date, sport: 'Corrida',
    eventStatus: e.status === 'Adiada' ? 'https://schema.org/EventPostponed' : 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: { '@type': 'Place', name: local(e) === 'Local a confirmar' ? e.city : local(e), address: { '@type': 'PostalAddress', addressLocality: e.city, addressRegion: 'MA', addressCountry: 'BR' } },
    url: e.officialUrl || `${SITE}/?prova=${encodeURIComponent(e.id)}`,
    ...(e.officialUrl ? { offers: { '@type': 'Offer', url: e.officialUrl, availability: e.status === 'Abertas' ? 'https://schema.org/InStock' : e.status === 'Esgotadas' ? 'https://schema.org/SoldOut' : 'https://schema.org/PreOrder' } } : {}),
  };
}

const outrasCidades = atual => `<h2>Corridas em outras cidades do Maranhão</h2>
<ul class="cidades">${cidades.filter(c => c !== atual).map(c => `<li><a href="/corridas/${slug(c)}/">${esc(c)}<small>${porCidade.get(c).length}</small></a></li>`).join('')}</ul>`;
const cta = `<div class="cta"><p><strong>Monte sua agenda de provas.</strong> No Radar você salva as corridas, leva para o calendário do celular, vê a previsão do tempo na largada e recebe as novidades.</p><a class="btn" href="/" data-umami-event="Página da cidade: abrir o Radar">Abrir o Radar Corridas Maranhão</a></div>`;

const urls = [`${SITE}/`, `${SITE}/corridas/`];
for (const c of cidades) {
  const evs = porCidade.get(c);
  const meses = new Map();
  for (const e of evs) { const k = e.date.slice(0, 7); if (!meses.has(k)) meses.set(k, []); meses.get(k).push(e); }
  const abertas = evs.filter(e => e.status === 'Abertas').length;
  const dists = [...new Set(evs.flatMap(e => e.distances))].sort((a, b) => a - b);
  const anos = [...new Set(evs.map(e => e.date.slice(0, 4)))].join(' e ');
  const titulo = `Corridas em ${c} ${anos} – calendário de corridas de rua | Radar Corridas MA`;
  const descricao = `${evs.length} ${evs.length === 1 ? 'corrida' : 'corridas'} de rua e trail em ${c} (MA): datas, distâncias${dists.length ? ` (${lista(dists.slice(0, 5).map(km))})` : ''}, local e inscrições${abertas ? `, ${abertas} com inscrições abertas` : ''}. Atualizado várias vezes por dia.`;
  const corpo = `<h1>Corridas em ${esc(c)} ${esc(anos)}</h1>
<p class="intro">${evs.length === 1 ? 'A próxima corrida de rua ou trail' : `As próximas ${evs.length} corridas de rua e trail`} em ${esc(c)}, no Maranhão, com data, distâncias, local e situação das inscrições${abertas ? `. ${abertas === 1 ? '1 está' : abertas + ' estão'} com inscrições abertas` : ''}.</p>
<p class="atual">Agenda conferida em ${esc(atualizado)}.</p>
${[...meses].map(([k, xs]) => `<h2>${MESES[Number(k.slice(5, 7)) - 1][0].toUpperCase() + MESES[Number(k.slice(5, 7)) - 1].slice(1)} de ${k.slice(0, 4)}</h2>\n<ol>${xs.map(itemProva).join('\n')}</ol>`).join('\n')}
${cta}
${outrasCidades(c)}`;
  const jsonld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Radar Corridas Maranhão', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Corridas por cidade', item: `${SITE}/corridas/` },
      { '@type': 'ListItem', position: 3, name: `Corridas em ${c}`, item: `${SITE}/corridas/${slug(c)}/` }] },
    ...evs.map(eventoLd)] };
  const pasta = `${DIST}/corridas/${slug(c)}`;
  mkdirSync(pasta, { recursive: true });
  writeFileSync(`${pasta}/index.html`, pagina({ caminho: `/corridas/${slug(c)}/`, titulo, descricao, corpo, jsonld }));
  urls.push(`${SITE}/corridas/${slug(c)}/`);
}

// página com todas as cidades
mkdirSync(`${DIST}/corridas`, { recursive: true });
writeFileSync(`${DIST}/corridas/index.html`, pagina({
  caminho: '/corridas/',
  titulo: `Corridas no Maranhão ${ANO} por cidade – calendário | Radar Corridas MA`,
  descricao: `Calendário de corridas de rua e trail no Maranhão por cidade: ${lista(cidades.slice(0, 6))} e mais. ${futuras.length} provas com data, distâncias e inscrições.`,
  corpo: `<h1>Corridas no Maranhão por cidade</h1>
<p class="intro">${futuras.length} corridas de rua e trail nas próximas semanas e meses, em ${cidades.length} cidades do Maranhão. Escolha a cidade para ver datas, distâncias, local e inscrições.</p>
<p class="atual">Agenda conferida em ${esc(atualizado)}.</p>
<ul class="cidades">${cidades.map(c => `<li><a href="/corridas/${slug(c)}/">${esc(c)}<small>${porCidade.get(c).length}</small></a></li>`).join('')}</ul>
${cta}`,
  jsonld: null,
}));

writeFileSync(`${DIST}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u}</loc><lastmod>${hoje}</lastmod></url>`).join('\n')}
</urlset>
`);
writeFileSync(`${DIST}/robots.txt`, `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`Páginas por cidade: ${cidades.length} cidades + índice; sitemap com ${urls.length} endereços.`);
