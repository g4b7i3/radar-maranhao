// Aplica a coleta automática (coleta/*.json) à agenda, sem precisar do Claude.
// Roda no GitHub Actions logo depois da coleta, de 2 em 2 horas. Fontes: Crono Esportes, SA Crono, Central da Corrida, Topchip e GuardaLugar.
// - Prova já existente: atualiza só o status de inscrição (e data/horário se a plataforma mudou).
// - Prova nova do Maranhão: entra com os dados da plataforma.
// Só grava o radar.json se algo mudou de verdade (assim o Netlify só republica quando precisa).
// Uso: node scripts/aplicar-coleta.mjs [--simular]
import { readFileSync, existsSync } from 'node:fs';
import { readState, writeState, applyUpdate, slug } from './radar-lib.mjs';

const SIMULAR = process.argv.includes('--simular');
const KEYS = ['id', 'name', 'edition', 'city', 'state', 'modality', 'date', 'distances', 'location', 'registrationOpen', 'registrationClose', 'status', 'officialUrl', 'sourceUrl', 'sourceName', 'publishedAt', 'confidence', 'notes', 'prize', 'elevation', 'price', 'start'];
const ler = f => existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
const iso = dmy => { const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(dmy || ''); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
const PEQ = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o', 'na', 'no', 'com', 'para']);
const ROMANOS = /^(i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii)$/i;
const titulo = s => s.toLowerCase().replace(/\s+/g, ' ').trim().split(' ').map((w, i) =>
  ROMANOS.test(w) ? w.toUpperCase() : /^\d/.test(w) ? w : (i > 0 && PEQ.has(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  .replace(/\bMa\b/g, 'MA').replace(/\bUema\b/g, 'UEMA').replace(/\bSesc\b/g, 'Sesc').replace(/\bCrea\b/g, 'CREA');
const cidadeBonita = c => titulo(c).replace(/\bSao\b/g, 'São').replace(/\bLuis\b/g, 'Luís').replace(/\bJose\b/g, 'José').replace(/\bCoroata\b/g, 'Coroatá').replace(/\bAcailandia\b/g, 'Açailândia');
const PALAVRAS_FRACAS = new Set(['corrida', 'run', 'caminhada', 'etapa', 'edicao', 'circuito', 'de', 'da', 'do', 'e', 'sao', 'luis', 'maranhao', 'imperatriz']);
const tokens = s => new Set(slug(s).split('-').filter(w => w.length > 2 && !/^\d+$/.test(w) && !ROMANOS.test(w) && !PALAVRAS_FRACAS.has(w)));

const estado = readState();
const hoje = new Date().toISOString().slice(0, 10);

// encontra a prova já cadastrada: mesmo link, ou mesma cidade + data + alguma palavra do nome em comum
function achar(c) {
  const ev = estado.events;
  if (c.url) { const porLink = ev.find(e => e.officialUrl && e.officialUrl.replace(/\/$/, '') === c.url.replace(/\/$/, '')); if (porLink) return porLink; }
  const t = tokens(c.nome);
  return ev.find(e => slug(e.city) === slug(c.cidade) && e.date === c.data && ([...tokens(e.name)].some(x => t.has(x)) || slug(e.name) === slug(c.nome)))
      || ev.find(e => slug(e.name) === slug(c.nome) && slug(e.city) === slug(c.cidade));
}

const candidatos = [];

// Crono Esportes e SA Crono: página completa de cada prova
for (const [arq, fonte] of [['coleta/cronoesportes.json', 'Crono Esportes'], ['coleta/sacrono.json', 'SA Crono']]) {
  const d = ler(arq); if (!d) continue;
  for (const p of d.provas || []) {
    if (!p.texto || !p.maranhao) continue;
    const t = p.texto;
    const bloco = /\n([^\n]+)\nData: (\d{2}\/\d{2}\/\d{4})\nHorário: ([^\n]+)\nCidade: ([^\n]+?) - MA\nLargada: ([^\n]+)/.exec(t);
    if (!bloco) continue;
    const [, nome, dataTxt, hora, cidade, largada] = bloco;
    const precos = (/PREÇOS E CATEGORIAS\n([\s\S]*?)\*Taxa/.exec(t) || [, ''])[1];
    const dist = [...new Set([...precos.matchAll(/(\d+(?:[.,]\d+)?)\s*KM/gi)].map(m => Number(m[1].replace(',', '.'))))].filter(x => x > 0 && x < 200).sort((a, b) => a - b);
    const status = /VAGAS ESGOTADAS/i.test(t) ? 'Esgotadas' : /INSCRI[ÇC][ÕO]ES ENCERRADAS/i.test(t) ? 'Encerradas' : /INSCRI[ÇC][ÕO]ES EM BREVE/i.test(t) ? 'Em breve' : /\nINSCREVA-SE\n/.test(t) ? 'Abertas' : /\nINDISPON[ÍI]VEL\n/.test(t) ? 'Encerradas' : 'Consultar';
    const fim = iso((/INSCRI[ÇC][ÕO]ES ENCERRADAS EM: (\d{2}\/\d{2}\/\d{4})/i.exec(t) || [])[1]);
    candidatos.push({ fonte, url: p.url, nome, data: iso(dataTxt), hora, cidade: cidadeBonita(cidade), largada: largada.trim(), dist, status, fim, completo: true });
  }
}

// Central da Corrida: lista com data, cidade e status
{
  const d = ler('coleta/centraldacorrida.json');
  const texto = d?.listas?.[0]?.texto || '';
  const L = texto.split('\n');
  for (let i = 0; i < L.length - 3; i++) {
    const m = /^(\d{2}\/\d{2}\/\d{4}) - (\d{2}:\d{2})$/.exec(L[i + 1]?.trim() || '');
    const c = /^(.+?) - MA$/i.exec(L[i + 2]?.trim() || '');
    if (!m || !c) continue;
    const nome = L[i].trim(); const st = (L[i + 3] || '').trim().toLowerCase();
    if (/virtual|desafio .*no seu tempo|movalt/i.test(nome)) continue;
    const status = /esgotad/.test(st) ? 'Esgotadas' : /encerrad/.test(st) ? 'Encerradas' : /em breve/.test(st) ? 'Em breve' : /inscreva|abertas|últimas/.test(st) ? 'Abertas' : 'Consultar';
    // link da página da prova, quando a coleta conseguiu abrir o cartão
    const pag = (d.provas || []).find(p => p.texto && p.texto.toUpperCase().includes(nome.toUpperCase()));
    candidatos.push({ fonte: 'Central da Corrida', url: pag?.url || null, nome: titulo(nome.replace(/\s+-\s+[A-ZÁ-Ú/ ]+\/MA$/i, '')), data: iso(m[1]), hora: m[2].replace(':', 'h').replace('h00', 'h'), cidade: cidadeBonita(c[1]), status, completo: false });
  }
}

// Topchip: calendário com data e cidade (sem status de inscrição)
{
  const d = ler('coleta/topchip.json');
  const texto = (d?.listas || []).map(l => l.texto || '').join('\n');
  const re = /\n(CONFIRMADO|PREVISTO)\n([^\n]+)\n(Corrida de Rua|Trilha|Corrida com Obstáculos|Corrida em estrada de terra)\n(?:CRONOMETRADO\n)?CIDADE\n([^\n]+?) \/ MA\nHORÁRIO\n(\d{2}\/\d{2}\/\d{4}) (\d{2}:\d{2})/g;
  const vistos = new Set();
  for (const m of texto.matchAll(re)) {
    const k = m[2] + m[5]; if (vistos.has(k)) continue; vistos.add(k);
    candidatos.push({ fonte: 'Topchip', url: null, nome: titulo(m[2]), data: iso(m[5]), hora: m[6].replace(':', 'h').replace('h00', 'h'), cidade: cidadeBonita(m[4]), status: null, trilha: m[3] !== 'Corrida de Rua', previsto: m[1] === 'PREVISTO', completo: false });
  }
}

// GuardaLugar: lista pública da API (o site é um app Flutter, sem texto na página)
{
  const d = ler('coleta/guardalugar.json');
  const resp = (d?.api || []).find(a => /events\/public\/list\?is_test=false&ended=false/.test(a.url));
  let lista = []; try { lista = JSON.parse(resp?.body || '[]'); } catch { /* resposta cortada */ }
  const CORRIDA = /corrida|run\b|running|maratona|meia|trail|km\b|rústica|rustica/i;
  for (const e of lista) {
    if (e.state_code !== 'MA' || e.is_ended || e.is_test || !CORRIDA.test(`${e.name} ${e.description || ''}`)) continue;
    const desc = e.description || '';
    const dist = [...new Set(desc.split('\n').filter(l => !/caminhada/i.test(l)).flatMap(l => [...l.matchAll(/(\d+(?:[.,]\d+)?)\s*KM\b/gi)].map(m => Number(m[1].replace(',', '.')))))].filter(x => x > 0 && x < 200).sort((a, b) => a - b);
    const [h, m] = (e.date || '').slice(11, 16).split(':');
    candidatos.push({
      fonte: 'GuardaLugar', url: `https://guardalugar.com/evento/${e.event_link}`, nome: e.name.trim(), data: (e.date || '').slice(0, 10),
      hora: h ? `${Number(h)}h${m !== '00' ? m : ''}` : '', cidade: e.city_name, largada: e.address || '', dist,
      status: e.force_sold_out ? 'Esgotadas' : e.advance_sales_closed ? 'Encerradas' : e.has_registrations || e.has_ticketing ? 'Abertas' : 'Consultar', completo: true,
    });
  }
}

const entrada = [];
const novas = [], mudadas = [];
for (const c of candidatos) {
  if (!c.data || c.data < hoje) continue;
  const atual = achar(c);
  if (atual) {
    const x = Object.fromEntries(KEYS.map(k => [k, atual[k] ?? null]));
    let mudou = false;
    if (c.status && c.status !== x.status && !(x.status === 'Abertas' && c.status === 'Consultar')) { x.status = c.status; mudou = true; }
    if (c.fim && c.fim !== x.registrationClose) { x.registrationClose = c.fim; mudou = true; }
    if (c.completo && c.data !== x.date) { x.date = c.data; mudou = true; x.notes = `${x.notes} Data atualizada pela ${c.fonte}.`.trim(); }
    if (c.url && (!x.officialUrl || /calendario|centraldacorrida\.com\.br\/?$/.test(x.officialUrl))) { x.officialUrl = c.url; mudou = true; }
    if (c.completo && x.distances.length === 0 && c.dist.length) { x.distances = c.dist; mudou = true; }
    if (c.completo && /a confirmar/i.test(x.location) && c.largada) { x.location = c.largada; mudou = true; }
    if (mudou) { entrada.push(x); mudadas.push(`${x.name} (${x.city}, ${x.date}): ${x.status}`); }
    continue;
  }
  // prova nova
  const link = c.url || (c.fonte === 'Topchip' ? 'https://topchip.com.br/calendario' : 'https://centraldacorrida.com.br/');
  const id = `${slug(c.nome).slice(0, 60)}-${c.data.slice(0, 4)}-${slug(c.cidade)}`.replace(/-+/g, '-');
  if (estado.events.some(e => e.id === id) || entrada.some(e => e.id === id)) continue;
  entrada.push({
    id, name: c.nome, edition: c.data.slice(0, 4), city: c.cidade, state: 'MA', modality: c.trilha ? 'Trail' : 'Rua', date: c.data,
    distances: c.dist || [], location: c.largada || 'Local a confirmar', registrationOpen: null, registrationClose: c.fim || null,
    status: c.status || 'Consultar', officialUrl: link, sourceUrl: link, sourceName: c.fonte,
    publishedAt: null,
    confidence: c.completo ? 'Página de inscrição oficial' : c.fonte === 'Topchip' ? 'Calendário oficial da cronometragem (Topchip)' : 'Plataforma de inscrição (Central da Corrida)',
    notes: `Largada às ${c.hora}. Encontrada automaticamente na ${c.fonte}${c.previsto ? ' (data ainda prevista)' : ''}; detalhes na página da plataforma.`,
  });
  novas.push(`${c.nome} (${c.cidade}, ${c.data})`);
}

console.log(`Coleta: ${candidatos.length} provas do Maranhão lidas. Novas: ${novas.length}. Com mudança: ${mudadas.length}.`);
novas.forEach(n => console.log('  + ' + n));
mudadas.forEach(n => console.log('  ~ ' + n));
if (!entrada.length) { console.log('Nada mudou: agenda não foi alterada.'); process.exit(0); }
const { next, changes } = applyUpdate(estado, entrada, new Date().toISOString());
if (!changes.length && !novas.length) { console.log('Sem mudança relevante: agenda não foi alterada.'); process.exit(0); }
if (SIMULAR) { console.log(`(simulação) ${changes.length} novidade(s) seriam registradas.`); process.exit(0); }
writeState(next);
console.log(`Agenda atualizada: ${changes.length} novidade(s) registradas.`);
