// @ts-nocheck
// Cards da corrida para o story/post (modelos vindos do app de treino), com as cores e a letra do Radar, sem logo.
// Ainda bloqueado na seção "Em breve" do Radar Pro.
const dia = (d) => new Date(String(d).length === 10 ? d + 'T12:00:00' : d);
const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const fmtHora = (d) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const fmtDia = (d) => dia(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ de /g, ' ').replace('.', '');
const fmtDur = (s) => { if (s == null) return '–'; s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}h${String(m).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`; };
const fmtDurLongo = (s) => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
const fmtPace = (sPorKm) => { if (!sPorKm || !isFinite(sPorKm)) return '–'; const s = Math.round(sPorKm); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}/km`; };
const paceDe = (c) => c && c.distancia_m > 0 ? c.duracao_s / (c.distancia_m / 1000) : null;
const isoDia = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
/* ---------- card da corrida para compartilhar (minimalista, estilo Strava/Garmin) ---------- */
const CARD_STATS = [['dist', 'Distância'], ['pace', 'Pace'], ['tempo', 'Tempo'], ['fc', 'FC média'], ['elev', 'Subida'], ['cad', 'Cadência'], ['kcal', 'Calorias'], ['passos', 'Passos'], ['rota', 'Percurso'], ['data', 'Data']];
// modelos do card (inspirados nos stickers de corrida), com as cores do Radar e sem logo
const CARD_LAYOUTS = [
  ['ma_eguas', 'Éguas!'], ['ma_balao', 'Balão de fala'], ['ma_carimbo', 'Carimbo'], ['ma_azulejo', 'Azulejo'], ['ma_manchete', 'Manchete'], ['ma_lencois', 'Lençóis'],
  ['icones', 'Com ícones'], ['clima', 'Clima'], ['clima_faixa', 'Clima + números'], ['tiros', 'Tiros'], ['classico', 'Coluna'], ['faixa', 'Faixa'], ['percurso', 'Percurso'], ['lado', 'Lado a lado'], ['mapa', 'Só o mapa'],
  ['sobre', 'Mapa + números'], ['tabela', 'Ficha'], ['ficha_mapa', 'Ficha + mapa'], ['lateral', 'Diagonal'], ['pilulas', 'Número de peito'],
  ['parciais', 'Parciais'], ['recibo', 'Medalha'], ['destaque', 'Destaque'], ['linha', 'Na foto'],
];
/* ---------- falas maranhenses adaptadas ao treino (gírias de São Luís e do interior, antigas e de hoje) ---------- */
// cada frase tem o "grito" (a exclamação) e a frase; {km} {pace} {tempo} {temp} viram os números da corrida
const FALAS = {
  longo: [
    { g: 'Éguas, siô!', f: 'Fui na baixa da égua e voltei: {km} km no pé.' },
    { g: 'Armaria!', f: '{km} km de longão. Agora tô só a broca.' },
    { g: 'Marmenino!', f: '{tempo} correndo. Sem mentira nenhuma.' },
  ],
  rapido: [
    { g: 'Piqueno, tu é o raio!', f: '{pace}/km de média. Fui zilado do começo ao fim.' },
    { g: 'Só quer ser!', f: 'Diz que foi leve e vem com {pace}/km.' },
    { g: 'Éguas!', f: 'Passei zilado: {km} km a {pace}/km.' },
  ],
  forte: [
    { g: 'Té doido!', f: 'Esse treino foi louco: {km} km com o coração na boca.' },
    { g: 'Armaria!', f: 'Até a dor desse treino doeu. E eu fui até o fim.' },
    { g: 'Marrapaz!', f: 'Treino invocado. As pernas ainda tão tremendo.' },
  ],
  calor: [
    { g: 'Égua do calor!', f: 'O sol de São Luís tava remoso e eu fui correr assim mesmo.' },
    { g: 'Armaria!', f: '{temp}° na rua e eu lá, dando meus pulos.' },
  ],
  cedo: [
    { g: 'Sem mentira nenhuma:', f: 'corri {km} km antes do sol nascer.' },
    { g: 'Heheeein!', f: 'Acordei cedo, mermão: {km} km antes do café.' },
  ],
  leve: [
    { g: 'Kiu pra preguiça!', f: 'Rodagem de boa, mas coirento hoje não.' },
    { g: 'Aziado nada!', f: '{km} km leve, só pra manter o corpo ligado.' },
  ],
  geral: [
    { g: 'Heheeein!', f: 'Treino pago: {km} km em {tempo}.' },
    { g: 'Dá teus pulos!', f: 'Ninguém corre por ti. {km} km na conta.' },
    { g: 'Foi bom? Pior!', f: '{km} km a {pace}/km. Pior que foi bom demais.' },
    { g: 'Marrapaz!', f: '{km} km e ainda deu pra mangar da preguiça.' },
    { g: 'Perainda!', f: 'Deixa eu respirar: {km} km em {tempo}.' },
  ],
};
const sorteio = (t) => { let h = 7; for (const ch of String(t)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
function falaDe(c, clima, chave) {
  const km = c.distancia_m ? (c.distancia_m / 1000).toFixed(c.distancia_m >= 10000 ? 1 : 2).replace(/\.?0+$/, '').replace('.', ',') : null;
  const p = paceDe(c), h = new Date(c.data).getHours(), temp = clima && clima.temp != null ? clima.temp : null;
  const val = { km, pace: p ? fmtPace(p).replace('/km', '') : null, tempo: c.duracao_s ? fmtDurLongo(c.duracao_s) : null, temp };
  const tags = [];
  if (c.distancia_m >= 15000) tags.push('longo');
  if (p && p < 285) tags.push('rapido');
  if ((c.fc_media || 0) >= 160 || (c._serie && c._serie.qual)) tags.push('forte');
  if (temp != null && temp >= 29) tags.push('calor');
  if (h < 6) tags.push('cedo');
  if ((p && p > 390) || (c.distancia_m && c.distancia_m < 5000)) tags.push('leve');
  tags.push('geral');
  const encher = (t) => { let ok = true; const r = t.replace(/\{(\w+)\}/g, (_, k) => { if (val[k] == null) ok = false; return val[k] ?? ''; }); return ok ? r : null; };
  const pega = (banco) => {
    const lista = tags.flatMap((t) => banco[t] || []).map((x) => ({ ...x, f: x.f != null ? encher(x.f) : undefined, d: x.d != null ? encher(x.d) : undefined })).filter((x) => (x.f ?? x.d) != null);
    return lista[sorteio((c.id || '') + chave) % lista.length];
  };
  return { ...pega(FALAS), val };
}
const cardCarregarImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
const CARD_IMGS = {};
const DIAS_LONGOS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const cardImg = async (src) => (CARD_IMGS[src] || (CARD_IMGS[src] = await cardCarregarImg(src)));
function cardValores(c) {
  const pace = paceDe(c); const E = { ...(c.resumo_rel || {}), ...((c.analise && c.analise.extras) || {}) };
  return {
    dist: c.distancia_m ? { l: 'Distância', v: (c.distancia_m / 1000).toFixed(2).replace('.', ','), u: 'km' } : null,
    pace: pace ? { l: 'Pace', v: fmtPace(pace).replace('/km', ''), u: '/km' } : null,
    tempo: c.duracao_s ? { l: 'Tempo', v: fmtDurLongo(c.duracao_s), u: '' } : null,
    fc: c.fc_media ? { l: 'FC média', v: String(c.fc_media), u: 'bpm' } : null,
    elev: c.elevacao_m ? { l: 'Subida', v: String(Math.round(c.elevacao_m)), u: 'm' } : null,
    cad: c.cadencia ? { l: 'Cadência', v: String(c.cadencia), u: 'ppm' } : null,
    kcal: E.kcal ? { l: 'Calorias', v: Math.round(E.kcal).toLocaleString('pt-BR'), u: 'kcal' } : null,
    passos: E.passos ? { l: 'Passos', v: Math.round(E.passos).toLocaleString('pt-BR'), u: '' } : null,
  };
}
// voltas fortes (tiros): separa as voltas rápidas das de recuperação pelo pace
// tipo do treino de qualidade (pela planilha ou pelo título): o card de séries leva esse nome
function serieDe(c, plano) {
  const t = `${(plano && plano.titulo) || ''} ${c.titulo || ''}`.toLowerCase(), tp = plano && plano.tipo;
  if (/sub\s*-?\s*limiar/.test(t)) return { titulo: 'Sublimiar', qual: true };
  if (tp === 'fartlek' || /fartlek/.test(t)) return { titulo: 'Fartlek', qual: true };
  if (tp === 'ritmo' || /limiar|ritmo/.test(t)) return { titulo: 'Limiar', qual: true };
  if (tp === 'tiros' || /tiro/.test(t)) return { titulo: 'Tiros', qual: true };
  if (tp === 'intervalado' || /intervalad/.test(t)) return { titulo: 'Intervalado', qual: true };
  if (tp === 'teste') return { titulo: 'Teste', qual: true };
  if (tp) return { titulo: 'Tiros', qual: false, leve: ['rodagem', 'regenerativo', 'longao', 'folga'].includes(tp) };
  return { titulo: 'Tiros', qual: false };
}
function tirosDe(c) {
  const sr = c._serie || {};
  const vs = ((c.analise && c.analise.voltas) || []).filter((v) => v && v.d >= 100 && v.seg > 0).map((v, i) => ({ ...v, i, p: v.seg / (v.d / 1000) }));
  if (vs.length < 3 || sr.leve) return [];
  const ord = vs.map((v) => v.p).sort((a, b) => a - b);
  let corte = null, maior = 1;
  for (let i = 1; i < ord.length; i++) { const r = ord[i] / ord[i - 1]; if (r > maior) { maior = r; corte = (ord[i] + ord[i - 1]) / 2; } }
  if (maior < (sr.qual ? 1.06 : 1.12) || corte == null) return [];
  const fortes = vs.filter((v) => v.p < corte);
  return fortes.length >= (sr.qual ? 1 : 2) && fortes.length < vs.length ? fortes.slice(0, 10) : [];
}
// clima da hora e do lugar da corrida (Open-Meteo, sem chave); se não der, a temperatura do relógio
const CLIMA_CACHE = {};
async function climaDe(c) {
  if (CLIMA_CACHE[c.id] !== undefined) return CLIMA_CACHE[c.id];
  const E = (c.analise && c.analise.extras) || {};
  const doRelogio = E.temp_med != null ? { temp: Math.round(E.temp_med), fonte: 'relogio' } : null;
  let res = doRelogio;
  try {
    const p0 = c.rota && c.rota[0]; if (!p0) throw 0;
    const dt = new Date(c.data), dia = isoDia(dt), antigo = Date.now() - dt.getTime() > 80 * 864e5;
    const base = antigo ? 'https://archive-api.open-meteo.com/v1/archive' : 'https://api.open-meteo.com/v1/forecast';
    const url = `${base}?latitude=${p0[0]}&longitude=${p0[1]}&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day&start_date=${dia}&end_date=${dia}&timezone=auto`;
    const r = await fetch(url); if (!r.ok) throw 0; const j = await r.json();
    const meio = new Date(dt.getTime() + (c.duracao_s || 0) * 500); const hh = meio.getHours();
    const k = Math.max(0, Math.min(23, (j.hourly.time || []).findIndex((t) => +t.slice(11, 13) === hh)));
    const h = j.hourly;
    if (h.temperature_2m[k] != null) res = { temp: Math.round(h.temperature_2m[k]), sens: Math.round(h.apparent_temperature[k]), umid: Math.round(h.relative_humidity_2m[k]), vento: Math.round(h.wind_speed_10m[k]), cod: h.weather_code[k], dia: h.is_day[k] !== 0, fonte: 'clima' };
  } catch {}
  CLIMA_CACHE[c.id] = res; return res;
}
const climaTxt = (cod) => cod == null ? '' : cod === 0 ? 'Céu limpo' : cod <= 2 ? 'Poucas nuvens' : cod === 3 ? 'Nublado' : cod <= 48 ? 'Neblina' : cod <= 57 ? 'Garoa' : cod <= 67 ? 'Chuva' : cod <= 77 ? 'Neve' : cod <= 82 ? 'Pancadas de chuva' : 'Trovoada';
function cardRota(ctx, rota, x, y, w, h, cor, lw, brilho = false) {
  if (!rota || rota.length < 2) return false;
  const lats = rota.map((p) => p[0]), lons = rota.map((p) => p[1]);
  const la0 = Math.min(...lats), la1 = Math.max(...lats), lo0 = Math.min(...lons), lo1 = Math.max(...lons);
  const k = Math.cos(((la0 + la1) / 2) * Math.PI / 180);
  const rw = Math.max((lo1 - lo0) * k, 1e-6), rh = Math.max(la1 - la0, 1e-6);
  const s = Math.min(w / rw, h / rh), ox = x + (w - rw * s) / 2, oy = y + (h - rh * s) / 2;
  const caminho = () => { ctx.beginPath(); rota.forEach((p, i) => { const px = ox + (p[1] - lo0) * k * s, py = oy + rh * s - (p[0] - la0) * s; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); };
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (brilho) { ctx.shadowColor = cor; ctx.shadowBlur = lw * 3; }
  ctx.strokeStyle = cor; ctx.lineWidth = lw; caminho(); ctx.stroke();
  // ponto de largada
  const p0 = rota[0], sx = ox + (p0[1] - lo0) * k * s, sy = oy + rh * s - (p0[0] - la0) * s;
  ctx.shadowBlur = 0; ctx.fillStyle = cor; ctx.beginPath(); ctx.arc(sx, sy, lw * 1.25, 0, Math.PI * 2); ctx.fill();
  ctx.restore(); return true;
}
const ret = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
async function desenharCard(cv, c, o) {
  const W = 1080, H = o.formato === 'post' ? 1350 : 1920; const esc = o.escala || 1; cv.width = W * esc; cv.height = H * esc;
  const ctx = cv.getContext('2d'); ctx.setTransform(esc, 0, 0, esc, 0, 0); ctx.imageSmoothingQuality = 'high'; ctx.clearRect(0, 0, W, H);
  const branco = o.cor === 'branco', post = o.formato === 'post';
  const tx = branco ? '#ffffff' : '#0a1240', sub = branco ? 'rgba(255,255,255,.74)' : 'rgba(10,18,64,.6)';
  const AC = branco ? '#ffd34d' : '#1d3fbf'; // dourado do Radar (no texto escuro, o azul cobalto)
  if (o.fundo === 'foto' && o.img) {
    const im = o.img, sc = Math.max(W / im.width, H / im.height);
    ctx.drawImage(im, (W - im.width * sc) / 2, (H - im.height * sc) / 2, im.width * sc, im.height * sc);
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(0,0,0,.2)'); g.addColorStop(.5, 'rgba(0,0,0,.04)'); g.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  } else if (o.fundo === 'radar') {
    const g = ctx.createLinearGradient(0, 0, W * .4, H); g.addColorStop(0, '#14278a'); g.addColorStop(1, '#0a1240'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const r = ctx.createRadialGradient(W * .9, H * .08, 0, W * .9, H * .08, W * .9); r.addColorStop(0, 'rgba(255,211,77,.22)'); r.addColorStop(1, 'rgba(255,211,77,0)'); ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
  }
  const sombra = branco && o.fundo !== 'radar';
  // tamanho e posição escolhidos com os dedos (o fundo não mexe)
  const zz = o.zoom || 1; ctx.save(); ctx.translate(W / 2 + (o.dx || 0), H / 2 + (o.dy || 0)); ctx.scale(zz, zz); ctx.translate(-W / 2, -H / 2);
  const FB = "'Archivo Variable', system-ui, sans-serif", FH = "'Radar Cond', 'Archivo Variable', system-ui, sans-serif", FM = "'Archivo Variable', system-ui, sans-serif";
  const txt = (t, x, y, font, cor, al = 'center', esp = 0) => {
    ctx.save(); ctx.font = font; ctx.fillStyle = cor; ctx.textAlign = al; ctx.textBaseline = 'alphabetic';
    if ('letterSpacing' in ctx) ctx.letterSpacing = esp + 'px';
    if (sombra) { ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 2; }
    ctx.fillText(t, x, y); ctx.restore();
  };
  const larg = (t, font, esp = 0) => { ctx.save(); ctx.font = font; if ('letterSpacing' in ctx) ctx.letterSpacing = esp + 'px'; const w = ctx.measureText(t).width; ctx.restore(); return w; };
  const V = cardValores(c);
  const sel = ['dist', 'pace', 'tempo', 'fc', 'elev', 'cad', 'kcal', 'passos'].filter((k) => o.stats[k] && V[k]).map((k) => V[k]);
  const VAL = (px) => `700 ${Math.round(px * .84)}px ${FH}`, LBL = (px) => `700 ${px}px ${FB}`;
  // rótulo pequeno + número grande (unidade menor ao lado)
  const stat = (s, x, y, px, al = 'center', caixa = false) => {
    const fu = `700 ${Math.round(px * .42)}px ${FB}`, ev = -px * .035;
    const wv = larg(s.v, VAL(px), ev), wu = s.u ? larg(s.u, fu) + px * .12 : 0, tot = wv + wu;
    const x0 = al === 'center' ? x - tot / 2 : al === 'right' ? x - tot : x;
    txt(caixa ? s.l.toUpperCase() : s.l, al === 'center' ? x : al === 'right' ? x : x0, y, LBL(Math.max(24, Math.round(px * .34))), sub, al, caixa ? px * .05 : 0);
    txt(s.v, x0, y + px * 1.04, VAL(px), tx, 'left', ev);
    if (s.u) txt(s.u, x0 + wv + px * .12, y + px * 1.04, fu, sub, 'left');
    return wv + wu;
  };
  const grade = (lista, y, px, x0 = 80, x1 = W - 80, porLinha = 3, al = 'left') => {
    let yy = y;
    for (let i = 0; i < lista.length; i += porLinha) {
      const parte = lista.slice(i, i + porLinha), cw = (x1 - x0) / porLinha;
      parte.forEach((s, j) => stat(s, al === 'center' ? x0 + cw * j + cw / 2 : x0 + cw * j, yy, px, al));
      yy += px * 1.9;
    }
    return yy;
  };
  const comLogo = false; // sem logo nenhuma
  const wm = comLogo ? await cardImg(branco ? 'icons/wordmark.svg' : 'icons/wordmark-escuro.svg') : null;
  const sim = comLogo ? await cardImg(branco ? 'icons/simbolo.svg' : 'icons/simbolo-escuro.svg') : null;
  const desenha = (im, ar, x, y, w, al = 'left') => { if (!im) return 0; const h = w * ar; const xx = al === 'center' ? x - w / 2 : al === 'right' ? x - w : x; ctx.save(); if (sombra) { ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = 12; } ctx.drawImage(im, xx, y, w, h); ctx.restore(); return h; };
  const logoTexto = (x, y, w = 240, al = 'center') => desenha(wm, 937.1 / 5645, x, y, w, al);
  const simbolo = (x, y, w = 120, al = 'center') => desenha(sim, 2333.5 / 5528.6, x, y, w, al);
  // a marca principal nos cards é o símbolo (maior que o nome escrito)
  const logo = (x, y, w = 240, al = 'center') => simbolo(x, y - w * .05, w * .72, al);
  const dt = new Date(c.data);
  const dataTxt = o.stats.data ? `${fmtDia(c.data)} · ${fmtHora(c.data)}`.toUpperCase() : '';
  const temRota = o.stats.rota && c.rota && c.rota.length > 1;
  const rota = (x, y, w, h, lw = 9, br = false) => temRota && cardRota(ctx, c.rota, x, y, w, h, AC, lw, br);
  const L = o.layout;
  const assinatura = () => {}; // sem marca


  const clima = o.clima;
  const iconeClima = (cx, cy, r) => { // sol, lua, nuvem e chuva desenhados
    const cod = clima && clima.cod, dia = !clima || clima.dia !== false;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const sol = cod == null || cod <= 2;
    if (sol) {
      if (dia) { ctx.fillStyle = '#ffcf5c'; ctx.beginPath(); ctx.arc(cx, cy, r * .42, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#ffcf5c'; ctx.lineWidth = r * .09; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * .6, cy + Math.sin(a) * r * .6); ctx.lineTo(cx + Math.cos(a) * r * .82, cy + Math.sin(a) * r * .82); ctx.stroke(); } }
      else { ctx.fillStyle = '#dfe8ff'; ctx.beginPath(); ctx.arc(cx, cy, r * .5, 0, Math.PI * 2); ctx.fill(); ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(cx + r * .25, cy - r * .18, r * .45, 0, Math.PI * 2); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
    }
    if (cod == null || cod >= 1) { // nuvem
      const nx = sol ? cx + r * .25 : cx, ny = sol ? cy + r * .28 : cy; ctx.fillStyle = branco ? '#ffffff' : '#c9d6ea';
      ctx.beginPath(); ctx.arc(nx - r * .3, ny, r * .26, 0, Math.PI * 2); ctx.arc(nx, ny - r * .14, r * .34, 0, Math.PI * 2); ctx.arc(nx + r * .32, ny + r * .02, r * .24, 0, Math.PI * 2); ctx.rect(nx - r * .3, ny, r * .62, r * .26); ctx.fill();
      if (cod != null && cod >= 51) { ctx.strokeStyle = AC; ctx.lineWidth = r * .08; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(nx + k * r * .25, ny + r * .42); ctx.lineTo(nx + k * r * .25 - r * .08, ny + r * .66); ctx.stroke(); } }
    }
    ctx.restore();
  };
  // quebra o texto em linhas que cabem na largura
  const quebra = (t, font, mw) => { const ps = String(t).split(' '), ls = []; let l = ''; for (const p of ps) { const n = l ? l + ' ' + p : p; if (larg(n, font) > mw && l) { ls.push(l); l = p; } else l = n; } if (l) ls.push(l); return ls; };
  // os 6 cards no jeito maranhense
  const maranhense = () => {
    const F = falaDe(c, clima, L), lista = sel.slice(0, 3);
    const OURO = '#ffd34d', COB = '#1d3fbf', NAVY = '#0a1240';
    if (L === 'ma_eguas') { // a exclamação gigante, a frase e os números
      const fg = (px) => `800 ${px}px ${FH}`; let px = post ? 190 : 230, gl = quebra(F.g.toUpperCase(), fg(px), W - 140);
      while (gl.length > 2 && px > 110) { px -= 10; gl = quebra(F.g.toUpperCase(), fg(px), W - 140); }
      const ff = `600 ${post ? 44 : 50}px ${FB}`, fl = quebra(F.f, ff, W - 140), lf = post ? 60 : 68;
      const tot = gl.length * px * .9 + 50 + fl.length * lf + 70 + 76 * 1.9 + (dataTxt ? 70 : 0);
      let y = (H - tot) / 2;
      if (dataTxt) { txt(dataTxt, 70, y + 26, LBL(26), sub, 'left', 3); y += 70; }
      gl.forEach((l) => { y += px * .9; txt(l, 66, y, fg(px), branco ? OURO : COB, 'left', -px * .03); });
      y += 50; fl.forEach((l) => { y += lf; txt(l, 70, y, ff, tx, 'left'); });
      y += 50; ctx.save(); ctx.fillStyle = branco ? OURO : COB; ctx.fillRect(70, y, 120, 8); ctx.restore(); y += 50;
      grade(lista, y, 88, 70, W - 70, 3, 'left');
    } else if (L === 'ma_balao') { // balão de fala com a frase e os números embaixo
      const bx = 80, bw = W - 160, pad = 70;
      const fgt = `800 ${post ? 92 : 104}px ${FH}`, ffr = `600 ${post ? 50 : 56}px ${FB}`;
      const gl = quebra(F.g, fgt, bw - pad * 2), fl = quebra(F.f, ffr, bw - pad * 2), lg = post ? 96 : 108, lf = post ? 66 : 74;
      const bh = pad * 2 + gl.length * lg + 20 + fl.length * lf, tot = 60 + bh + 90 + 76 * 1.9 + 76 * 1.9;
      let y = (H - tot) / 2;
      txt('NO MARANHÊS', bx, y + 28, LBL(28), sub, 'left', 6); y += 60;
      ctx.save(); if (sombra || o.fundo === 'radar') { ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 30; }
      ctx.fillStyle = branco ? '#ffffff' : NAVY; ret(ctx, bx, y, bw, bh, 56); ctx.fill();
      ctx.beginPath(); ctx.moveTo(bx + 120, y + bh - 2); ctx.lineTo(bx + 110, y + bh + 80); ctx.lineTo(bx + 230, y + bh - 2); ctx.closePath(); ctx.fill(); ctx.restore();
      const tb = branco ? NAVY : '#ffffff', ab = branco ? COB : OURO; let yy = y + pad;
      gl.forEach((l) => { yy += lg * .82; ctx.save(); ctx.font = fgt; ctx.fillStyle = ab; if ('letterSpacing' in ctx) ctx.letterSpacing = '-2px'; ctx.fillText(l, bx + pad, yy); ctx.restore(); yy += lg * .18; });
      yy += 20; fl.forEach((l) => { yy += lf; ctx.save(); ctx.font = ffr; ctx.fillStyle = tb; ctx.fillText(l, bx + pad, yy - 14); ctx.restore(); });
      y += bh + 130;
      const y2 = grade(lista, y, 88, 80, W - 80, 3, 'left');
      if (dataTxt) txt(dataTxt, 80, y2 + 10, LBL(26), sub, 'left', 3);
    } else if (L === 'ma_carimbo') { // carimbo redondo, torto, com a fala na borda e a distância no meio
      const cx = W / 2, cy = H * (post ? .42 : .4), R = post ? 330 : 370, cor = branco ? OURO : COB;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.16);
      ctx.strokeStyle = cor; ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, R - 34, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, R * .56, 0, Math.PI * 2); ctx.stroke();
      // a fala escrita em volta, letra por letra
      const grito = F.g.toUpperCase().replace(/[:!?]+$/, '') + '!';
      let fs = 72; ctx.font = `800 ${fs}px ${FH}`; const rr = R - 100, arco = Math.PI * 1.15;
      while (ctx.measureText(grito).width > rr * arco && fs > 40) { fs -= 4; ctx.font = `800 ${fs}px ${FH}`; }
      const wt = ctx.measureText(grito).width; let ang = -Math.PI / 2 - (wt / rr) / 2;
      ctx.fillStyle = cor; ctx.textAlign = 'center';
      for (const ch of grito) { const wc = ctx.measureText(ch).width; ang += wc / rr / 2; ctx.save(); ctx.rotate(ang + Math.PI / 2); ctx.fillText(ch, 0, -rr + fs * .35); ctx.restore(); ang += wc / rr / 2; }
      // estrelinhas e o dia embaixo
      ctx.font = `800 34px ${FB}`; if ('letterSpacing' in ctx) ctx.letterSpacing = '8px';
      ctx.fillText(`★ ${dt.getDate()} ${MESES[dt.getMonth()]} ${dt.getFullYear()} ★`, 0, R * .78);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      const d0 = V.dist || sel[0];
      if (d0) { ctx.font = `800 ${R * .42}px ${FH}`; ctx.fillStyle = cor; if ('letterSpacing' in ctx) ctx.letterSpacing = '-6px'; ctx.fillText(d0.v, 0, R * .13); if ('letterSpacing' in ctx) ctx.letterSpacing = '10px'; ctx.font = `800 40px ${FB}`; ctx.fillText((d0.u || '').toUpperCase(), 0, R * .32); }
      ctx.restore();
      const ff = `600 ${post ? 46 : 52}px ${FB}`, fl = quebra(F.f, ff, W - 160), lf = post ? 62 : 70;
      let y = cy + R + (post ? 70 : 110);
      fl.forEach((l) => { y += lf; txt(l, W / 2, y, ff, tx, 'center'); });
      grade(sel.filter((s4) => s4 !== V.dist).slice(0, 3), y + 70, 88, 70, W - 70, 3, 'center');
    } else if (L === 'ma_azulejo') { // faixas de azulejo português do Centro Histórico de São Luís
      const azulejo = (x0, y0, s2) => {
        ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, s2, s2); ctx.clip();
        ctx.fillStyle = '#f4f6ff'; ctx.fillRect(x0, y0, s2, s2);
        ctx.fillStyle = COB; [[x0, y0], [x0 + s2, y0], [x0, y0 + s2], [x0 + s2, y0 + s2]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(a, b, s2 * .3, 0, Math.PI * 2); ctx.fill(); });
        ctx.fillStyle = '#f4f6ff'; [[x0, y0], [x0 + s2, y0], [x0, y0 + s2], [x0 + s2, y0 + s2]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(a, b, s2 * .14, 0, Math.PI * 2); ctx.fill(); });
        const cx = x0 + s2 / 2, cy = y0 + s2 / 2;
        ctx.strokeStyle = COB; ctx.lineWidth = s2 * .045; ctx.beginPath(); ctx.moveTo(cx, y0 + s2 * .16); ctx.lineTo(x0 + s2 * .84, cy); ctx.lineTo(cx, y0 + s2 * .84); ctx.lineTo(x0 + s2 * .16, cy); ctx.closePath(); ctx.stroke();
        for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; ctx.fillStyle = COB; ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * s2 * .16, cy + Math.sin(a) * s2 * .16, s2 * .1, s2 * .05, a, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = NAVY; ctx.beginPath(); ctx.arc(cx, cy, s2 * .07, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = OURO; ctx.beginPath(); ctx.arc(cx, cy, s2 * .03, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(10,18,64,.18)'; ctx.lineWidth = 2; ctx.strokeRect(x0, y0, s2, s2); ctx.restore();
      };
      const s2 = W / 6, filas = post ? 1 : 2;
      for (let r = 0; r < filas; r++) for (let k = 0; k < 6; k++) { azulejo(k * s2, r * s2, s2); azulejo(k * s2, H - (r + 1) * s2, s2); }
      const fg = `800 ${post ? 120 : 140}px ${FH}`, gl = quebra(F.g.toUpperCase(), fg, W - 160), lgg = post ? 112 : 130;
      const ff = `600 ${post ? 44 : 50}px ${FB}`, fl = quebra(F.f, ff, W - 200), lf = post ? 60 : 68;
      const tot = gl.length * lgg + 30 + fl.length * lf + 80 + 74 * 1.9 + (dataTxt ? 60 : 0);
      let y = (H - tot) / 2;
      gl.forEach((l) => { y += lgg; txt(l, W / 2, y, fg, branco ? OURO : COB, 'center', -2); });
      y += 30; fl.forEach((l) => { y += lf; txt(l, W / 2, y, ff, tx, 'center'); });
      y += 70; const y2 = grade(lista, y, 88, 70, W - 70, 3, 'center');
      if (dataTxt) txt(dataTxt, W / 2, y2 + 10, LBL(24), sub, 'center', 3);
    } else if (L === 'ma_manchete') { // capa de jornal: a corrida virou notícia
      const x = 60, w = W - 120, pad = 50, iw = w - pad * 2;
      const fh = (px) => `800 ${px}px ${FH}`, man = `${F.g} Atleta corre ${F.val.km} km${F.val.pace ? ` a ${F.val.pace}/km` : ''}`.toUpperCase();
      let ph = post ? 104 : 120, hl = quebra(man, fh(ph), iw); while (hl.length > 4 && ph > 70) { ph -= 8; hl = quebra(man, fh(ph), iw); }
      const fd = `500 ${post ? 40 : 44}px ${FB}`, dl = quebra(F.f, fd, iw), ld = post ? 56 : 62;
      const hFoto = temRota ? (post ? 300 : 460) : 0;
      const bh = pad + 110 + 50 + hl.length * ph * .95 + 40 + dl.length * ld + 50 + (hFoto ? hFoto + 50 : 0) + 160 + pad;
      let y = (H - bh) / 2;
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = 30; ctx.fillStyle = '#f7f4ea'; ctx.fillRect(x, y, w, bh); ctx.restore();
      const P = (t, xx, yy, font, cor, al = 'left', esp = 0) => { ctx.save(); ctx.font = font; ctx.fillStyle = cor; ctx.textAlign = al; if ('letterSpacing' in ctx) ctx.letterSpacing = esp + 'px'; ctx.fillText(t, xx, yy); ctx.restore(); };
      const regua = (yy, e = 3) => { ctx.save(); ctx.fillStyle = NAVY; ctx.fillRect(x + pad, yy, iw, e); ctx.restore(); };
      let yy = y + pad + 80;
      P('JORNAL DO TREINO', W / 2, yy, `800 ${post ? 74 : 84}px ${FH}`, NAVY, 'center', 2);
      yy += 30; regua(yy, 6); yy += 34;
      P(`SÃO LUÍS · ${DIAS_LONGOS[dt.getDay()].toUpperCase()}, ${dt.getDate()} ${MESES[dt.getMonth()]} ${dt.getFullYear()}`, x + pad, yy, `700 22px ${FB}`, 'rgba(10,18,64,.65)', 'left', 3);
      P('EDIÇÃO EXTRA', x + w - pad, yy, `800 22px ${FB}`, COB, 'right', 3);
      yy += 16; regua(yy, 2); yy += 20;
      hl.forEach((l) => { yy += ph * .95; P(l, x + pad, yy, fh(ph), NAVY, 'left', -1); });
      yy += 20; dl.forEach((l) => { yy += ld; P(l, x + pad, yy, fd, 'rgba(10,18,64,.8)'); });
      yy += 40;
      if (hFoto) { ctx.save(); ctx.fillStyle = '#dde3f3'; ctx.fillRect(x + pad, yy, iw, hFoto); ctx.restore(); cardRota(ctx, c.rota, x + pad + 40, yy + 30, iw - 80, hFoto - 60, COB, 9); yy += hFoto + 50; }
      regua(yy, 2);
      const cw = iw / Math.max(1, lista.length);
      lista.forEach((s3, k) => { const cx = x + pad + cw * k; if (k) { ctx.save(); ctx.fillStyle = 'rgba(10,18,64,.3)'; ctx.fillRect(cx - 20, yy + 30, 2, 110); ctx.restore(); }
        P(s3.l.toUpperCase(), cx, yy + 60, `700 24px ${FB}`, 'rgba(10,18,64,.6)', 'left', 3); P(s3.v, cx, yy + 130, `800 66px ${FH}`, NAVY, 'left', -1); if (s3.u) P(s3.u, cx + larg(s3.v, `800 66px ${FH}`, -1) + 8, yy + 130, `700 26px ${FB}`, 'rgba(10,18,64,.6)'); });
    } else { // 'ma_lencois': dunas e lagoas dos Lençóis Maranhenses embaixo
      const base = H * (post ? .64 : .66);
      const duna = (y0, amp, fase, c1, c2) => { const g = ctx.createLinearGradient(0, y0 - amp, 0, H); g.addColorStop(0, c1); g.addColorStop(1, c2); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, y0); for (let x = 0; x <= W; x += 20) ctx.lineTo(x, y0 - amp * Math.sin((x / W) * Math.PI * 1.6 + fase) - amp * .35 * Math.sin((x / W) * Math.PI * 4.2 + fase * 2)); ctx.lineTo(W, H); ctx.closePath(); ctx.fill(); };
      ctx.save();
      duna(base, 60, .4, '#f3e2ad', '#e6cd86');
      const lagoa = (x0, y0, rx, ry) => { const g = ctx.createLinearGradient(0, y0 - ry, 0, y0 + ry); g.addColorStop(0, '#43c4e6'); g.addColorStop(1, '#1d7fc4'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x0, y0, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); };
      lagoa(W * .3, base + 120, 210, 34); lagoa(W * .78, base + 100, 150, 26);
      duna(base + 170, 50, 2.1, '#f8ecc6', '#ead39a');
      lagoa(W * .55, base + 300, 260, 40);
      duna(base + 360, 44, 4.0, '#fbf3d9', '#efdcaa');
      ctx.restore();
      const fg = `800 ${post ? 140 : 160}px ${FH}`, gl = quebra(F.g.toUpperCase(), fg, W - 140), lgg = post ? 128 : 148;
      const ff = `600 ${post ? 44 : 50}px ${FB}`, fl = quebra(F.f, ff, W - 140), lf = post ? 60 : 68;
      let y = post ? 110 : 220;
      if (dataTxt) { txt(dataTxt, 70, y, LBL(26), sub, 'left', 3); y += 20; }
      gl.forEach((l) => { y += lgg; txt(l, 66, y, fg, branco ? OURO : COB, 'left', -2); });
      y += 20; fl.forEach((l) => { y += lf; txt(l, 70, y, ff, tx, 'left'); });
      grade(lista, Math.min(y + 70, base - 88 * 1.9 - 40), 88, 70, W - 70, 3, 'left');
    }
  };
  if (L.startsWith('ma_')) maranhense();
  else if (L === 'clima') { // temperatura em destaque, com sensação, umidade e vento
    let y = post ? 120 : 330;
    simbolo(W / 2, y, 220); y += 170;
    if (clima) {
      iconeClima(W / 2, y + 120, 130); y += 290;
      const tt = `${clima.temp}°`; txt(tt, W / 2 + 30, y + 190, `800 ${post ? 220 : 260}px ${FH}`, tx, 'center', -10); y += 240;
      if (clima.fonte === 'clima' && climaTxt(clima.cod)) { txt(climaTxt(clima.cod).toUpperCase(), W / 2, y, LBL(30), AC, 'center', 6); y += 70; } else y += 20;
      const det = [clima.sens != null ? { l: 'Sensação', v: `${clima.sens}°`, u: '' } : null, clima.umid != null ? { l: 'Umidade', v: `${clima.umid}`, u: '%' } : null, clima.vento != null ? { l: 'Vento', v: `${clima.vento}`, u: 'km/h' } : null].filter(Boolean);
      if (det.length) y = grade(det, y + 10, 60, 90, W - 90, 3, 'center');
    } else { txt('Buscando o clima…', W / 2, y + 200, LBL(34), sub, 'center'); y += 400; }
    ctx.save(); ctx.fillStyle = branco ? 'rgba(255,255,255,.25)' : 'rgba(10,18,64,.15)'; ctx.fillRect(140, y + 10, W - 280, 2); ctx.restore();
    grade(sel.slice(0, 3), y + 60, 64, 70, W - 70, 3, 'center');
  } else if (L === 'clima_faixa') { // números da corrida com uma etiqueta do clima
    const lista = sel.slice(0, 3); let y = (H - 620) / 2;
    simbolo(80, y, 200, 'left'); y += 150;
    if (clima) {
      const t = `${clima.temp}°C`, extra = [clima.fonte === 'clima' ? climaTxt(clima.cod) : '', clima.umid != null ? `${clima.umid}% umidade` : '', clima.vento != null ? `vento ${clima.vento} km/h` : ''].filter(Boolean).join(' · ');
      const fs = 36, wT = larg(t, `800 46px ${FH}`) + larg(extra, `600 ${fs}px ${FB}`) + 200;
      ctx.save(); ctx.strokeStyle = tx; ctx.globalAlpha = .55; ctx.lineWidth = 3; ret(ctx, 80, y, Math.min(W - 160, wT), 110, 55); ctx.stroke(); ctx.restore();
      iconeClima(140, y + 55, 70);
      txt(t, 200, y + 72, `800 46px ${FH}`, tx, 'left', -1);
      txt(extra, 200 + larg(t, `800 46px ${FH}`) + 26, y + 68, `600 ${fs}px ${FB}`, sub, 'left');
    }
    y += 190;
    grade(lista, y, 88, 80, W - 80, 3, 'left');
  } else if (L === 'tiros') { // só as voltas fortes (sem recuperação)
    const tr = tirosDe(c), pk = tr.map((v) => v.p), mn = Math.min(...pk), mx = Math.max(...pk);
    const dists = tr.map((v) => Math.round(v.d / 100) * 100), iguais = dists.every((d) => Math.abs(d - dists[0]) <= 100);
    const lh = Math.min(post ? 74 : 92, (H - (post ? 560 : 760)) / Math.max(1, tr.length));
    let y = (H - (190 + tr.length * lh + 260)) / 2;
    const tit = (c._serie && c._serie.titulo) || 'Tiros';
    txt(tit, 100, y + 70, `800 ${tit.length > 9 ? 70 : 84}px ${FH}`, tx, 'left', -2);
    txt(iguais ? `${tr.length} × ${dists[0] >= 1000 ? (dists[0] / 1000).toString().replace('.', ',') + ' km' : dists[0] + ' m'}` : `${tr.length} ${tr.length > 1 ? 'séries' : 'série'}`, W - 100, y + 66, `700 40px ${FB}`, AC, 'right'); y += 150;
    txt('#', 100, y + 10, LBL(24), sub, 'left', 3); txt('PACE', W - 100, y + 10, LBL(24), sub, 'right', 3); y += 30;
    tr.forEach((v, i) => {
      const yy = y + i * lh, w = mx > mn ? 120 + 200 * (mx - v.p) / (mx - mn) : 260, top = v.p === mn;
      ctx.save(); ctx.fillStyle = top ? AC : (branco ? 'rgba(255,255,255,.14)' : 'rgba(10,18,64,.1)'); ctx.beginPath(); ctx.arc(126, yy + lh * .5, lh * .32, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      txt(String(i + 1), 126, yy + lh * .5 + lh * .13, `800 ${Math.round(lh * .34)}px ${FB}`, top ? '#04122b' : tx, 'center');
      ctx.save(); ctx.fillStyle = top ? AC : (branco ? 'rgba(255,255,255,.85)' : 'rgba(10,18,64,.82)'); ret(ctx, 190, yy + lh * .3, w, lh * .4, lh * .2); ctx.fill(); ctx.restore();
      txt(`${iguais ? '' : (v.d >= 1000 ? (v.d / 1000).toFixed(1).replace('.', ',') + ' km · ' : Math.round(v.d) + ' m · ')}${fmtDur(v.seg)}${v.fc ? ' · ' + v.fc + ' bpm' : ''}`, 540, yy + lh * .5 + 12, `600 ${Math.round(lh * .3)}px ${FB}`, sub, 'left');
      txt(fmtPace(v.p).replace('/km', ''), W - 100, yy + lh * .5 + 14, `800 ${Math.round(lh * .4)}px ${FH}`, top ? AC : tx, 'right', -1);
    });
    y += tr.length * lh + 50;
    const med = tr.reduce((a, v) => a + v.seg, 0) / tr.reduce((a, v) => a + v.d / 1000, 0);
    grade([{ l: tit === 'Tiros' ? 'Pace médio dos tiros' : 'Pace médio das séries', v: fmtPace(med).replace('/km', ''), u: '/km' }, { l: 'Melhor', v: fmtPace(mn).replace('/km', ''), u: '/km' }], y, 64, 100, W - 100, 2, 'left');
    simbolo(W / 2, H - (post ? 150 : 230), 170);
  } else if (L === 'icones') { // grade 2 colunas com ícone em cima de cada número
    const IC = { dist: 'M6 21s-4-4.5-4-7.5A4 4 0 0 1 10 13.5C10 16.5 6 21 6 21zM6 13.5h.01M18 11s-3-3.4-3-5.6a3 3 0 0 1 6 0C21 7.6 18 11 18 11zM18 5.4h.01M9 19.5c3 0 4-1.5 5.5-4s2.5-3 3.5-3', tempo: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 1.5M10 2h4M12 2v3M19 6l1.5-1.5', pace: 'M3.5 17a9 9 0 1 1 17 0M12 13l4-4M12 13.5a1 1 0 1 0 0-.01M6.5 13H5M19 13h-1.5M12 6.5V5M7.6 8.6 6.6 7.6M16.4 8.6l1-1', elev: 'M2 20 9 8l4 6 3-4 6 10zM9 8l2 3', fc: 'M12 20s-7-4.4-9-9a4.7 4.7 0 0 1 9-3 4.7 4.7 0 0 1 9 3c-2 4.6-9 9-9 9zM3.5 12h4l2-3 2.5 6 2-3h6.5', passos: 'M7 4c1.7 0 2.5 1.8 2.5 4S8.7 12 7 12s-2.5-1.8-2.5-4S5.3 4 7 4zM5 14.5h4.5v2a2.3 2.3 0 0 1-4.5 0zM17 8c1.7 0 2.5 1.8 2.5 4s-.8 4-2.5 4-2.5-1.8-2.5-4S15.3 8 17 8zM15 18.5h4.5v.5a2.3 2.3 0 0 1-4.5 0z', cad: 'M7 4c1.7 0 2.5 1.8 2.5 4S8.7 12 7 12s-2.5-1.8-2.5-4S5.3 4 7 4zM5 14.5h4.5v2a2.3 2.3 0 0 1-4.5 0zM17 8c1.7 0 2.5 1.8 2.5 4s-.8 4-2.5 4-2.5-1.8-2.5-4S15.3 8 17 8zM15 18.5h4.5v.5a2.3 2.3 0 0 1-4.5 0z', kcal: 'M12 21c-4 0-6.5-2.6-6.5-6 0-4 3.5-5.5 4-10 2.5 1.5 4 4 4 6 1-1 1.5-2 1.5-3 2 1.7 3.5 4.4 3.5 7 0 3.4-2.5 6-6.5 6z' };
    // usa o que estiver marcado e completa com os outros números da corrida até 6
    const ordem = ['dist', 'tempo', 'pace', 'elev', 'fc', 'passos', 'cad', 'kcal'];
    const chaves = [...ordem.filter((k) => o.stats[k] && V[k]), ...ordem.filter((k) => !o.stats[k] && V[k])].slice(0, 6).sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b));
    const rows = Math.ceil(chaves.length / 2), rh = post ? 300 : 340;
    let y = (H - (rows * rh + 210)) / 2;
    simbolo(W / 2, y, 300); y += 210;
    const icone = (k, cx, cy, sz) => { if (!IC[k] || !window.Path2D) return; ctx.save(); ctx.translate(cx - sz / 2, cy); ctx.scale(sz / 24, sz / 24); ctx.strokeStyle = tx; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; if (sombra) { ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 6; } ctx.stroke(new Path2D(IC[k])); ctx.restore(); };
    chaves.forEach((k, i) => {
      const col = i % 2, row = Math.floor(i / 2), cx = col ? W * .72 : W * .28, cy = y + row * rh;
      icone(k, cx, cy, 84);
      const s2 = V[k]; txt(s2.l, cx, cy + 140, `600 38px ${FB}`, tx, 'center');
      const px = 86, wv = larg(s2.v, VAL(px), -px * .035), fu = `700 ${Math.round(px * .5)}px ${FB}`, wu = s2.u ? larg(s2.u, fu) + 12 : 0, x0 = cx - (wv + wu) / 2;
      txt(s2.v, x0, cy + 236, VAL(px), tx, 'left', -px * .035); if (s2.u) txt(s2.u, x0 + wv + 12, cy + 236, fu, tx, 'left');
      if (row < rows - 1) { ctx.save(); ctx.fillStyle = branco ? 'rgba(255,255,255,.22)' : 'rgba(10,18,64,.15)'; ctx.fillRect(cx - 190, cy + rh - 30, 380, 2); ctx.restore(); }
    });
  } else if (L === 'classico') { // coluna centrada: percurso, números e logo
    const px = post ? 84 : 100, passo = px * 1.95, hR = temRota ? (post ? 250 : 340) : 0;
    const tot = (hR ? hR + 70 : 0) + sel.length * passo + (dataTxt ? 70 : 0) + (wm ? 110 : 0);
    let y = (H - tot) / 2;
    if (temRota) { rota(W / 2 - 230, y, 460, hR, 10); y += hR + 70; }
    if (dataTxt) { txt(dataTxt, W / 2, y + 26, LBL(28), sub, 'center', 3); y += 70; }
    sel.forEach((s) => { stat(s, W / 2, y + 30, px, 'center'); y += passo; });
    logo(W / 2, y + 30, 250);
  } else if (L === 'faixa') { // símbolo + logo numa linha e os números lado a lado
    const lista = sel.slice(0, 6), px = lista.length > 3 ? 64 : 70;
    const alt = 140 + Math.ceil(lista.length / 3) * px * 1.9;
    let y = (H - alt) / 2;
    const hs = simbolo(80, y, 190, 'left'); logoTexto(80 + (sim ? 220 : 0), y + Math.max(0, (hs - 46) / 2), 270, 'left');
    if (dataTxt) txt(dataTxt, W - 80, y + 40, LBL(24), sub, 'right', 3);
    grade(lista, y + 150, px, 80, W - 80, 3, 'left');
  } else if (L === 'percurso') { // percurso grande, logo e números embaixo
    const hr = post ? 620 : 900, yr = post ? 150 : 240;
    rota(130, yr, W - 260, hr, 12);
    let y = yr + hr + (post ? 60 : 100);
    simbolo(W / 2, y, 230); y += 130;
    if (dataTxt) { txt(dataTxt, W / 2, y + 10, LBL(26), sub, 'center', 3); y += 60; }
    y = grade(sel.slice(0, 3), y, post ? 66 : 72, 70, W - 70, 3, 'center');
  } else if (L === 'lado') { // percurso à esquerda, logo e números em coluna à direita
    const yc = H / 2, hr = post ? 520 : 600;
    rota(70, yc - hr / 2, 470, hr, 12);
    const px = 66; let y = yc - (sel.slice(0, 4).length * px * 1.95 + 120) / 2;
    logo(600, y, 340, 'left'); y += 120;
    sel.slice(0, 4).forEach((s) => { stat(s, 600, y + 28, px, 'left'); y += px * 1.95; });
  } else if (L === 'mapa') { // só o percurso e a marca
    const hr = post ? 760 : 1050; const y0 = (H - hr - 160) / 2;
    rota(110, y0, W - 220, hr, 14, true);
    logo(W / 2, y0 + hr + 90, 300);
  } else if (L === 'sobre') { // números empilhados por cima do percurso
    ctx.save(); ctx.globalAlpha = .9; rota(110, post ? 180 : 300, W - 220, post ? 900 : 1250, 16); ctx.restore();
    const px = post ? 70 : 80, passo = px * 1.85, lista = sel.slice(0, 6);
    let y = (H - (lista.length * passo + 110)) / 2;
    logo(W / 2, y, 260); y += 110;
    lista.forEach((s) => { stat(s, W / 2, y + 26, px, 'center'); y += passo; });
  } else if (L === 'tabela' || L === 'ficha_mapa') { // ficha com pontilhado (estilo recibo de prova)
    const lista = sel.slice(0, 7), lh = post ? 64 : 72, fs = post ? 38 : 42;
    const alt = (wm ? 90 : 0) + lista.length * lh + (dataTxt ? 70 : 0);
    let y = L === 'ficha_mapa' ? H - (post ? 110 : 170) - alt : (H - alt) / 2;
    if (L === 'ficha_mapa') rota(160, post ? 110 : 200, W - 320, y - (post ? 190 : 300), 13);
    const x0 = 150, x1 = W - 150;
    if (wm) { logo(x0, y, 230, 'left'); y += 90; }
    if (dataTxt) { txt(dataTxt, x0, y + 30, LBL(24), sub, 'left', 3); y += 70; }
    lista.forEach((s) => {
      const vt = s.v + (s.u ? ' ' + s.u : ''); y += lh;
      txt(s.l, x0, y, `600 ${fs}px ${FB}`, tx, 'left'); txt(vt, x1, y, `800 ${fs}px ${FB}`, tx, 'right');
      const a = x0 + larg(s.l, `600 ${fs}px ${FB}`) + 22, b = x1 - larg(vt, `800 ${fs}px ${FB}`) - 22;
      ctx.save(); ctx.fillStyle = sub; for (let xx = a; xx < b; xx += 15) { ctx.beginPath(); ctx.arc(xx, y - fs * .32, 2.6, 0, Math.PI * 2); ctx.fill(); } ctx.restore();
    });
  } else if (L === 'lateral') { // faixa diagonal da marca atravessando o card, com os números dentro
    rota(W / 2 - 230, post ? 120 : 210, 460, post ? 330 : 470, 10);
    const yc = H * (post ? .58 : .56), bh = post ? 330 : 380, inc = 140;
    ctx.save(); ctx.translate(0, yc);
    const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, branco ? 'rgba(255,211,77,.22)' : 'rgba(29,63,191,.14)'); g.addColorStop(1, branco ? 'rgba(255,211,77,.32)' : 'rgba(29,63,191,.24)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-40, -bh / 2 + inc / 2); ctx.lineTo(W + 40, -bh / 2 - inc / 2); ctx.lineTo(W + 40, bh / 2 - inc / 2); ctx.lineTo(-40, bh / 2 + inc / 2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = AC; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-40, -bh / 2 + inc / 2); ctx.lineTo(W + 40, -bh / 2 - inc / 2); ctx.stroke();
    ctx.rotate(-Math.atan2(inc, W + 80));
    const lista = sel.slice(0, 3), cw = (W - 120) / Math.max(1, lista.length);
    lista.forEach((s, k) => stat(s, 60 + cw * k + cw / 2, -40, post ? 64 : 70, 'center', true));
    ctx.restore();
    if (dataTxt) txt(dataTxt, W / 2, yc + bh / 2 + 90, LBL(26), sub, 'center', 4);
    simbolo(W / 2, H - (post ? 260 : 360), 230);
  } else if (L === 'pilulas') { // número de peito: a "inscrição" da corrida
    const bw = 820, bh = post ? 760 : 860, x = (W - bw) / 2, y = (H - bh) / 2 - (post ? 0 : 40);
    ctx.save(); if (sombra) { ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 30; }
    ctx.fillStyle = branco ? 'rgba(255,255,255,.96)' : '#ffffff'; ret(ctx, x, y, bw, bh, 34); ctx.fill(); ctx.restore();
    const faixa = 180; ctx.save(); ret(ctx, x, y, bw, bh, 34); ctx.clip();
    const g = ctx.createLinearGradient(x, y, x + bw, y); g.addColorStop(0, '#14278a'); g.addColorStop(1, '#1d3fbf'); ctx.fillStyle = g; ctx.fillRect(x, y, bw, faixa);
    ctx.restore();
    // furos dos alfinetes
    ctx.save(); ctx.fillStyle = branco ? 'rgba(0,0,0,.0)' : 'rgba(0,0,0,0)'; ctx.globalCompositeOperation = 'destination-out'; [[x + 46, y + 46], [x + bw - 46, y + 46], [x + 46, y + bh - 46], [x + bw - 46, y + bh - 46]].forEach(([a, b2]) => { ctx.beginPath(); ctx.arc(a, b2, 16, 0, Math.PI * 2); ctx.fillStyle = '#000'; ctx.fill(); }); ctx.restore();
    const wmB = null, simE = null; // sem logo
    if (wmB) ctx.drawImage(wmB, x + 110, y + faixa / 2 - 26, 312, 312 * (937.1 / 5645));
    const d0 = V.dist || sel[0];
    const nb = d0 ? d0.v : '';
    ctx.save(); ctx.font = `800 ${post ? 230 : 260}px ${FH}`; ctx.fillStyle = '#0a1240'; ctx.textAlign = 'center'; if ('letterSpacing' in ctx) ctx.letterSpacing = '-10px'; ctx.fillText(nb, W / 2, y + faixa + (post ? 300 : 340)); ctx.restore();
    ctx.save(); ctx.font = `800 44px ${FB}`; ctx.fillStyle = '#1d3fbf'; ctx.textAlign = 'center'; if ('letterSpacing' in ctx) ctx.letterSpacing = '12px'; ctx.fillText('KM', W / 2, y + faixa + (post ? 380 : 430)); ctx.restore();
    const resto = sel.filter((s) => s !== d0).slice(0, 3); const cw = (bw - 120) / Math.max(1, resto.length);
    resto.forEach((s, k) => { const cx = x + 60 + cw * k + cw / 2, yy = y + bh - (post ? 150 : 170);
      ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(10,18,64,.55)'; ctx.font = `700 26px ${FB}`; if ('letterSpacing' in ctx) ctx.letterSpacing = '3px'; ctx.fillText(s.l.toUpperCase(), cx, yy); ctx.fillStyle = '#0a1240'; ctx.font = `700 52px ${FH}`; if ('letterSpacing' in ctx) ctx.letterSpacing = '-1px'; ctx.fillText(s.v + (s.u === '/km' ? '' : ''), cx, yy + 66); ctx.restore(); });
    if (simE) { const w2 = 96; ctx.drawImage(simE, x + bw - 60 - w2, y + bh - 60 - w2 * (2333.5 / 5528.6), w2, w2 * (2333.5 / 5528.6)); }
    ctx.save(); ctx.fillStyle = 'rgba(10,18,64,.45)'; ctx.font = `500 22px ${FM}`; if ('letterSpacing' in ctx) ctx.letterSpacing = '4px'; ctx.fillText(`${dt.getDate()} ${MESES[dt.getMonth()]} ${dt.getFullYear()}`, x + 60, y + bh - 50); ctx.restore();
  } else if (L === 'parciais') { // barras dos km (o mais rápido em destaque)
    const parc = (c.parciais || []).filter((p) => !p.parcial || p.km % 1 > .3).slice(0, post ? 16 : 24);
    const pk = (p) => p.seg / (p.parcial ? (p.km % 1 || 1) : 1);
    const vs = parc.map(pk), mn = Math.min(...vs), mx = Math.max(...vs);
    const lh = Math.min(post ? 56 : 66, (H - (post ? 520 : 700)) / Math.max(1, parc.length));
    let y = (H - (130 + parc.length * lh + 150)) / 2;
    txt('Parciais por km', 100, y + 60, `800 64px ${FH}`, tx, 'left', -1); y += 130;
    parc.forEach((p, i) => {
      const v = vs[i], w = mx > mn ? 220 + 440 * (mx - v) / (mx - mn) : 600, yy = y + i * lh;
      txt(p.parcial ? String(p.km).replace('.', ',') : String(p.km), 100, yy + lh * .62, `700 ${Math.round(lh * .5)}px ${FB}`, sub, 'left');
      ctx.save(); ctx.fillStyle = v === mn ? AC : (branco ? 'rgba(255,255,255,.88)' : 'rgba(10,18,64,.85)'); ret(ctx, 180, yy + lh * .2, w, lh * .56, lh * .28); ctx.fill(); ctx.restore();
      txt(fmtPace(v).replace('/km', ''), W - 100, yy + lh * .62, `800 ${Math.round(lh * .5)}px ${FB}`, v === mn ? AC : tx, 'right');
    });
    logo(W / 2, y + parc.length * lh + 60, 240);
  } else if (L === 'recibo') { // medalha: fita em V e o disco com a distância
    const cx = W / 2, cy = H * (post ? .56 : .54), R0 = post ? 250 : 280;
    ctx.save(); // fita
    const fita = (lado, cor) => { ctx.fillStyle = cor; ctx.beginPath(); ctx.moveTo(cx + lado * 40, cy - R0 + 20); ctx.lineTo(cx + lado * 260, cy - R0 - (post ? 420 : 560)); ctx.lineTo(cx + lado * 120, cy - R0 - (post ? 420 : 560)); ctx.lineTo(cx - lado * 60, cy - R0 + 30); ctx.closePath(); ctx.fill(); };
    fita(-1, '#1d3fbf'); fita(1, '#ffd34d');
    ctx.restore();
    ctx.save(); if (sombra) { ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 30; }
    const gm = ctx.createRadialGradient(cx - R0 * .3, cy - R0 * .3, R0 * .1, cx, cy, R0); gm.addColorStop(0, '#fff6cf'); gm.addColorStop(.6, '#ffd34d'); gm.addColorStop(1, '#d99a00');
    ctx.fillStyle = gm; ctx.beginPath(); ctx.arc(cx, cy, R0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.save(); ctx.strokeStyle = 'rgba(10,18,64,.25)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, R0 - 26, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    const simE = null; if (simE) ctx.drawImage(simE, cx - 70, cy - R0 + 60, 140, 140 * (2333.5 / 5528.6));
    const d0 = V.dist || sel[0];
    if (d0) { ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = '#0a1240'; ctx.font = `800 ${R0 * .52}px ${FH}`; if ('letterSpacing' in ctx) ctx.letterSpacing = '-6px'; ctx.fillText(d0.v, cx, cy + R0 * .16); ctx.font = `800 34px ${FB}`; ctx.fillStyle = '#1d3fbf'; if ('letterSpacing' in ctx) ctx.letterSpacing = '10px'; ctx.fillText((d0.u || '').toUpperCase(), cx, cy + R0 * .36); ctx.restore(); }
    ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(10,18,64,.6)'; ctx.font = `600 26px ${FM}`; if ('letterSpacing' in ctx) ctx.letterSpacing = '4px'; ctx.fillText(`${DIAS_LONGOS[dt.getDay()].toUpperCase()} · ${dt.getDate()} ${MESES[dt.getMonth()]}`, cx, cy + R0 * .62); ctx.restore();
    const resto = sel.filter((s) => s !== d0).slice(0, 2); const yy = cy + R0 + (post ? 90 : 130);
    resto.forEach((s, k) => stat(s, resto.length > 1 ? W / 2 + (k ? 200 : -200) : W / 2, yy, 70, 'center'));
    logo(W / 2, H - (post ? 130 : 220), 260);
  } else if (L === 'destaque') { // um número gigante e o resto pequeno embaixo
    const prim = sel[0], resto = sel.slice(1);
    let y = H * (post ? .26 : .3);
    if (dataTxt) txt(dataTxt, W / 2, y - 40, LBL(28), sub, 'center', 3);
    if (prim) {
      txt(prim.l.toUpperCase(), W / 2, y + 40, LBL(34), sub, 'center', 5);
      const px = post ? 230 : 270; txt(prim.v, W / 2, y + 40 + px * .98, `800 ${px}px ${FH}`, tx, 'center', -px * .05);
      if (prim.u) txt(prim.u.replace('/', '').toUpperCase(), W / 2, y + 40 + px * .98 + 80, `800 46px ${FB}`, AC, 'center', 10);
      y += 40 + px * .98 + 190;
    }
    y = grade(resto.slice(0, 3), y, post ? 66 : 74, 70, W - 70, 3, 'center');
    if (temRota && !post) rota(W / 2 - 160, y + 10, 320, 240, 8);
    logo(W / 2, H - (post ? 110 : 150), 250);
  } else { // 'linha': tudo numa faixa embaixo, a foto fica livre
    if (o.fundo === 'foto') { const g = ctx.createLinearGradient(0, H * .55, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.45)'); ctx.fillStyle = g; ctx.fillRect(0, H * .55, W, H * .45); }
    const lista = sel.slice(0, 3), px = 72;
    let y = H - (post ? 120 : 170) - px * 1.4;
    rota(80, y - 320, 260, 230, 7);
    simbolo(W - 80, y - 230, 190, 'right'); logoTexto(W - 80, y - 120, 210, 'right');
    if (dataTxt) txt(dataTxt, 80, y - 50 - 20, LBL(24), sub, 'left', 3);
    ctx.save(); ctx.fillStyle = branco ? 'rgba(255,255,255,.35)' : 'rgba(10,18,64,.2)'; ctx.fillRect(80, y - 40, W - 160, 2); ctx.restore();
    grade(lista, y + 10, px, 80, W - 80, 3, 'left');
  }
  ctx.restore();
  assinatura();
}

export { CARD_LAYOUTS, CARD_STATS, desenharCard, climaDe, serieDe, tirosDe, falaDe };
