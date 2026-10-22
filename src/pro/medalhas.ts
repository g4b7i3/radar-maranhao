// Radar Pro · as medalhas: lista (por grupo) e desenho em SVG.
// As regras de quem ganha ficam no servidor (supabase/functions/_comum/medalhas.ts); os ids precisam bater.
type Tier = 'bronze' | 'prata' | 'ouro' | 'especial';
export type Medalha = { id: string; nome: string; como: string; tier: Tier; ic?: string; num?: string; sub?: string };
export const TIERS: Record<Tier, { a: string; b: string; c: string; fita1: string; fita2: string; txt: string }> = {
  bronze:   { a: '#f3c9a0', b: '#c27b43', c: '#7a4320', fita1: '#1d3fbf', fita2: '#3a5ce0', txt: '#4a250d' },
  prata:    { a: '#ffffff', b: '#b7c0cc', c: '#6b7685', fita1: '#0f1a33', fita2: '#2b3a5c', txt: '#2a3343' },
  ouro:     { a: '#fff1b8', b: '#e2b23a', c: '#94650e', fita1: '#c8102e', fita2: '#e5383b', txt: '#4d3300' },
  especial: { a: '#9fb4ff', b: '#2e52d6', c: '#0f1f6b', fita1: '#f2b705', fita2: '#ffd34d', txt: '#ffffff' },
};

// ícones em traço (viewBox 0 0 24 24), desenhados no centro da medalha
const IC: Record<string, string> = {
  bandeira: '<path d="M6 21V4"/><path d="M6 4h11l-2.5 4L17 12H6"/>',
  sol: '<path d="M4 17h16"/><path d="M7 17a5 5 0 0 1 10 0"/><path d="M12 6v2.5M5.6 9.6l1.8 1.8M18.4 9.6l-1.8 1.8"/><path d="M6 20h12"/>',
  lua: '<path d="M19 14.5A7.5 7.5 0 1 1 10 4.5a6 6 0 0 0 9 10z"/><path d="M17 4.5v3M15.5 6h3"/>',
  raio: '<path d="M13 3 6 13.5h5L10 21l8-11h-5.5z"/>',
  podio: '<path d="M3 20h18"/><path d="M9 20v-9h6v9"/><path d="M3 20v-5h6M15 20v-7h6v7"/><path d="M12 4.5l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2L9.1 6.6l2-.3z"/>',
  trofeu: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5v1.5A3 3 0 0 0 8 10.5M16 6h3v1.5a3 3 0 0 1-3 3"/><path d="M12 13v4M8.5 20h7M10 17h4v3h-4z"/>',
  subir: '<path d="M6 14l6-6 6 6"/><path d="M6 19l6-6 6 6"/>',
  mapa: '<path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z"/><path d="M9 4v13.5M15 6.5V20"/>',
  bussola: '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5 13.3 13.3 8.5 15.5l2.2-4.8z"/>',
  globo: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.6 5.5 3.6 8.5s-1.1 5.9-3.6 8.5c-2.5-2.6-3.6-5.5-3.6-8.5S9.5 6.1 12 3.5z"/>',
  ilha: '<path d="M3 19.5c2 1.2 4 1.2 6 0s4-1.2 6 0 4 1.2 6 0"/><path d="M6 17c2-2 10-2 12 0"/><path d="M12 16V8.5"/><path d="M12 8.5c-1.5-2-4-2.5-6-1.5M12 8.5c1.5-2 4-2.5 6-1.5M12 8.5c-.5-2.2-2.2-3.6-4.5-4M12 8.5c.5-2.2 2.2-3.6 4.5-4"/>',
  fogo: '<path d="M12 21a6 6 0 0 0 6-6c0-4-3-6-4-9-1.5 2-2 3.5-2 5-1-.8-1.7-2-2-3-2 2.2-4 4.5-4 7a6 6 0 0 0 6 6z"/><path d="M12 21a2.5 2.5 0 0 1-2.5-2.5c0-1.7 2.5-3.5 2.5-3.5s2.5 1.8 2.5 3.5A2.5 2.5 0 0 1 12 21z"/>',
  estrada: '<path d="M8 3 4 21M16 3l4 18"/><path d="M12 4v2.5M12 10v2.5M12 16v2.5"/>',
  relogio: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 2"/><path d="M10 3h4M12 3v2.5"/>',
  calendario: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/><path d="M8 14h2M12 14h2M16 14h0M8 17h2M12 17h2"/>',
  bolo: '<path d="M4.5 20h15v-6.5a1.5 1.5 0 0 0-1.5-1.5H6a1.5 1.5 0 0 0-1.5 1.5z"/><path d="M4.5 16c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0 1.5-.7 1.5-.7"/><path d="M12 12V9"/><path d="M12 6.8c-.9-.7-.9-1.6 0-2.8.9 1.2.9 2.1 0 2.8z"/>',
  selo: '<path d="M12 3l2.4 1.7 2.9-.1.9 2.8 2.3 1.8-.9 2.8.9 2.8-2.3 1.8-.9 2.8-2.9-.1L12 21l-2.4-1.7-2.9.1-.9-2.8-2.3-1.8.9-2.8-.9-2.8 2.3-1.8.9-2.8 2.9.1z"/><path d="M8.5 12.2l2.4 2.3 4.6-4.8"/>',
  coroa: '<path d="M4 18h16l1-10-5 3.5L12 5l-4 6.5L3 8z"/><path d="M4 21h16"/>',
  dobro: '<path d="M7 5h10M7 19h10"/><path d="M9 5v3.5a3 3 0 0 0 6 0V5M9 19v-3.5a3 3 0 0 1 6 0V19"/>',
  gota: '<path d="M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/>',
  montanha: '<path d="M2.5 19.5 9 8l4 6.5 2.5-3.5 6 8z"/><path d="M7.3 11 9 12.5l1.7-1.5"/>',
  bandeirolas: '<path d="M3 5c6 3 12 3 18 0"/><path d="M5 6.2 6.5 11 8 7M10.3 7.3 12 12.3l1.7-5M16 7l1.5 4L19 6.2"/><path d="M4 21l2-5h12l2 5"/><path d="M9 16c.5-1.8 1.5-2.6 3-2.6s2.5.8 3 2.6"/>',
  presente: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3 9h18M12 9v11"/><path d="M12 9c-1-3-5-4-5-1.5S10.5 9 12 9zM12 9c1-3 5-4 5-1.5S13.5 9 12 9z"/>',
  fogos: '<path d="M12 21V12"/><path d="M12 12 8 8M12 12l4-4M12 12V6.5M12 12l-5.5 1M12 12l5.5 1"/><path d="M5 4.5l.7 1.4M19 4.5l-.7 1.4M4 18h2M18 18h2"/>',
  equipe: '<circle cx="8" cy="8" r="2.6"/><circle cx="16" cy="8" r="2.6"/><path d="M3 19c.5-3.4 2.4-5.2 5-5.2s4.5 1.8 5 5.2"/><path d="M13.5 14.6c.7-.5 1.6-.8 2.5-.8 2.6 0 4.5 1.8 5 5.2"/>',
  espadas: '<path d="M4 4l9.5 9.5M20 4l-9.5 9.5"/><path d="M4 4h3.5M4 4v3.5M20 4h-3.5M20 4v3.5"/><path d="M8 15.5 5.5 18M16 15.5l2.5 2.5M4.5 17l2.5 2.5M19.5 17 17 19.5"/>',
  escudo: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8 7.5 9.5 4.3-1.5 7.5-4.9 7.5-9.5V6z"/><path d="M8.7 12.2l2.3 2.3 4.4-4.6"/>',
  repetir: '<path d="M4 11a8 8 0 0 1 14-5.3L20 8"/><path d="M20 3.5V8h-4.5"/><path d="M20 13a8 8 0 0 1-14 5.3L4 16"/><path d="M4 20.5V16h4.5"/>',
  rota: '<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8 18h7.5a3 3 0 0 0 0-6h-7a3 3 0 0 1 0-6H16"/>',
  predio: '<path d="M4 21V9l5-3v15M9 21V4l8 3v14M3 21h18"/><path d="M12 9h2M12 12h2M12 15h2M6 12h1M6 15h1"/>',
  palmeira: '<path d="M12 21c0-5 .8-8.5 2-11"/><path d="M14 10c-2-2.3-5.2-2.6-7.5-1M14 10c2-2.3 5.2-2.6 7.5-1M14 10c-.3-3-2.3-4.8-5-5.3M14 10c.8-2.8 2.8-4.3 5.3-4.3"/><path d="M7 21h10"/>',
  ritmo: '<path d="M3.5 15a8.5 8.5 0 1 1 17 0"/><path d="M12 15l4.5-5"/><path d="M7 15h.01M17 15h.01M12 8.5V9"/>',
  colecao: '<rect x="3.5" y="4" width="7" height="7" rx="1.5"/><rect x="13.5" y="4" width="7" height="7" rx="1.5"/><rect x="3.5" y="14" width="7" height="7" rx="1.5"/><rect x="13.5" y="14" width="7" height="7" rx="1.5"/>',
  estrela: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  laco: '<path d="M12 12c-2.5-3.5-4-6-4-7.5a4 4 0 0 1 8 0C16 6 14.5 8.5 12 12z"/><path d="M12 12 7 20.5M12 12l5 8.5"/>',
  bigode: '<path d="M12 11c-1.5-1.8-4.5-2.4-6.5-.8-1.3 1-1.5 3-.5 3.8 1.6-1.6 4.6-1.4 7-3zM12 11c1.5-1.8 4.5-2.4 6.5-.8 1.3 1 1.5 3 .5 3.8-1.6-1.6-4.6-1.4-7-3z"/>',
  duna: '<path d="M2.5 18c3-4.5 6-6.5 9.5-6.5S18 13.5 21.5 18"/><path d="M8 18c1.5-2.3 3.3-3.5 5.5-3.5"/><circle cx="17" cy="6.5" r="2.5"/>',
  rio: '<path d="M3 7c2.5 1.6 4.5 1.6 7 0s4.5-1.6 7 0 3.5 1 4 .8"/><path d="M3 12c2.5 1.6 4.5 1.6 7 0s4.5-1.6 7 0 3.5 1 4 .8"/><path d="M3 17c2.5 1.6 4.5 1.6 7 0s4.5-1.6 7 0 3.5 1 4 .8"/>',
  seta_volta: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  grafico: '<path d="M4 20V4M4 20h16"/><path d="M7.5 15.5l3.5-4 3 2.5 5-6"/><path d="M15.5 8h3.5v3.5"/>',
  raio_duplo: '<path d="M9.5 3 4 12h4l-1 9 6-10.5H9z"/><path d="M17 6l-2.8 5H17l-.6 5 3.6-6.3h-2.8z"/>',
  pioneiro: '<path d="M5 21V4"/><path d="M5 4.5c3-1.8 5.5 1.8 9 0s3.5-.8 5-.2v8.5c-1.5-.6-2-1.6-5 .2s-6-1.8-9 0"/>',
  pelotao: '<circle cx="12" cy="7" r="2.5"/><circle cx="5.5" cy="10" r="2"/><circle cx="18.5" cy="10" r="2"/><path d="M8 20c.4-3.5 1.8-5.5 4-5.5s3.6 2 4 5.5"/><path d="M2.5 19c.3-2.6 1.3-4 3-4 .8 0 1.5.3 2 .9M21.5 19c-.3-2.6-1.3-4-3-4-.8 0-1.5.3-2 .9"/>',
  sol_forte: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  alvo: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
};

// tipo: 'num' mostra um número grande (distâncias/marcas), 'ic' um ícone
export const GRUPOS: { nome: string; itens: Medalha[] }[] = [
  { nome: 'Distâncias', itens: [
    { id: 'primeira_prova', nome: '1ª prova', como: 'Registre a sua primeira prova.', tier: 'bronze', ic: 'bandeira' },
    { id: 'primeiro_5k', nome: '1º 5K', como: 'Complete uma prova de 5 km.', tier: 'bronze', num: '5', sub: 'KM' },
    { id: 'primeiro_10k', nome: '1º 10K', como: 'Complete uma prova de 10 km.', tier: 'prata', num: '10', sub: 'KM' },
    { id: 'primeira_meia', nome: '1ª meia', como: 'Complete uma meia maratona (21 km).', tier: 'ouro', num: '21', sub: 'KM' },
    { id: 'primeira_maratona', nome: '1ª maratona', como: 'Complete uma maratona (42 km).', tier: 'especial', num: '42', sub: 'KM' },
    { id: 'ultra', nome: 'Ultra', como: 'Complete uma prova acima de 42 km.', tier: 'especial', num: '50+', sub: 'ULTRA' },
    { id: 'primeiro_15k', nome: '1º 15K', como: 'Complete uma prova de 15 ou 16 km.', tier: 'prata', num: '15', sub: 'KM' },
    { id: 'colecionador', nome: 'Colecionador', como: 'Corra 4 distâncias diferentes (ex.: 5, 10, 15 e 21 km).', tier: 'ouro', ic: 'colecao' },
    { id: 'trilheiro', nome: 'Trilheiro', como: 'Complete uma prova de trail.', tier: 'prata', ic: 'montanha' },
    { id: 'meia_dupla', nome: 'Meia em dobro', como: '2 meias maratonas na temporada.', tier: 'ouro', num: '2x', sub: '21K' },
    { id: 'maratona_dupla', nome: 'Maratonista', como: '2 maratonas na temporada.', tier: 'especial', num: '2x', sub: '42K' },
    { id: 'grand_slam', nome: 'Grand Slam', como: 'Complete 5K, 10K, meia e maratona (na carreira).', tier: 'especial', num: '4/4', sub: 'GRAND SLAM' },
  ]},
  { nome: 'Tempo (resultado oficial)', itens: [
    { id: 'sub25_5k', nome: 'Sub 25 no 5K', como: '5 km abaixo de 25 minutos.', tier: 'bronze', num: '25', sub: 'SUB · 5K' },
    { id: 'sub20_5k', nome: 'Sub 20 no 5K', como: '5 km abaixo de 20 minutos.', tier: 'ouro', num: '20', sub: 'SUB · 5K' },
    { id: 'sub50_10k', nome: 'Sub 50 no 10K', como: '10 km abaixo de 50 minutos.', tier: 'prata', num: '50', sub: 'SUB · 10K' },
    { id: 'sub40_10k', nome: 'Sub 40 no 10K', como: '10 km abaixo de 40 minutos.', tier: 'ouro', num: '40', sub: 'SUB · 10K' },
    { id: 'sub2h_meia', nome: 'Sub 2h na meia', como: 'Meia maratona abaixo de 2 horas.', tier: 'ouro', num: '2h', sub: 'SUB · 21K' },
    { id: 'sub4h_maratona', nome: 'Sub 4h na maratona', como: 'Maratona abaixo de 4 horas.', tier: 'especial', num: '4h', sub: 'SUB · 42K' },
    { id: 'recorde_pessoal', nome: 'Recorde pessoal', como: 'Bata o seu melhor tempo numa distância.', tier: 'prata', ic: 'raio' },
    { id: 'sub30_5k', nome: 'Sub 30 no 5K', como: '5 km abaixo de 30 minutos.', tier: 'bronze', num: '30', sub: 'SUB · 5K' },
    { id: 'sub60_10k', nome: 'Sub 1h no 10K', como: '10 km abaixo de 1 hora.', tier: 'bronze', num: '1h', sub: 'SUB · 10K' },
    { id: 'sub145_meia', nome: 'Sub 1h45 na meia', como: 'Meia maratona abaixo de 1h45.', tier: 'especial', num: '1h45', sub: 'SUB · 21K' },
    { id: 'sub330_maratona', nome: 'Sub 3h30 na maratona', como: 'Maratona abaixo de 3h30.', tier: 'especial', num: '3h30', sub: 'SUB · 42K' },
    { id: 'pace_4', nome: 'Abaixo de 4 min/km', como: 'Ritmo médio abaixo de 4:00/km numa prova de 5 km ou mais.', tier: 'especial', ic: 'ritmo' },
    { id: 'recorde_3', nome: 'Em evolução', como: '3 recordes pessoais na temporada.', tier: 'ouro', ic: 'estrela' },
    { id: 'sub22_5k', nome: 'Sub 22 no 5K', como: '5 km abaixo de 22 minutos.', tier: 'prata', num: '22', sub: 'SUB · 5K' },
    { id: 'sub45_10k', nome: 'Sub 45 no 10K', como: '10 km abaixo de 45 minutos.', tier: 'prata', num: '45', sub: 'SUB · 10K' },
    { id: 'voltei_melhor', nome: 'Voltei melhor', como: 'Melhore o seu tempo na mesma prova de um ano para o outro.', tier: 'ouro', ic: 'grafico' },
    { id: 'recorde_duplo', nome: 'Recorde em dobro', como: 'Recorde pessoal em 2 distâncias diferentes na temporada.', tier: 'prata', ic: 'raio_duplo' },
  ]},
  { nome: 'Pódio e nota', itens: [
    { id: 'podio', nome: 'Pódio na faixa', como: 'Top 3 na sua faixa etária.', tier: 'prata', ic: 'podio' },
    { id: 'podio_geral', nome: 'Pódio geral', como: 'Top 3 no geral da sua distância.', tier: 'ouro', ic: 'trofeu' },
    { id: 'rei_da_prova', nome: 'Rei/Rainha da prova', como: 'Melhor nota por idade de toda a prova na sua distância (resultado oficial).', tier: 'especial', ic: 'coroa' },
    { id: 'campeao', nome: 'Campeão', como: '1º lugar no geral ou na faixa etária.', tier: 'especial', num: '1º', sub: 'LUGAR' },
    { id: 'nota_60', nome: 'Nota 60%', como: 'Nota por idade de 60% ou mais.', tier: 'prata', num: '60', sub: '% NOTA' },
    { id: 'nota_70', nome: 'Nota 70%', como: 'Nota por idade de 70% ou mais.', tier: 'ouro', num: '70', sub: '% NOTA' },
    { id: 'subiu_de_liga', nome: 'Subiu de liga', como: 'Suba de liga com um resultado oficial.', tier: 'prata', ic: 'subir' },
    { id: 'liga_elite', nome: 'Liga Elite', como: 'Chegue à liga Elite (índice 65+).', tier: 'especial', ic: 'alvo' },
    { id: '3_podios', nome: '3 pódios', como: '3 pódios na temporada.', tier: 'ouro', num: '3x', sub: 'PÓDIO' },
    { id: 'bicampeao', nome: 'Bicampeão', como: 'Vença 2 vezes (geral ou faixa etária).', tier: 'especial', num: '2x', sub: 'CAMPEÃO' },
    { id: 'nota_80', nome: 'Nota 80%', como: 'Nota por idade de 80% ou mais. Nível nacional.', tier: 'especial', num: '80', sub: '% NOTA' },
    { id: 'liga_ouro', nome: 'Liga Ouro', como: 'Chegue à liga Ouro (índice 55+).', tier: 'ouro', ic: 'escudo' },
    { id: 'nota_50', nome: 'Nota 50%', como: 'Nota por idade de 50% ou mais.', tier: 'bronze', num: '50', sub: '% NOTA' },
    { id: 'metade_de_cima', nome: 'Metade de cima', como: 'Chegue na primeira metade da sua distância.', tier: 'bronze', num: '50%', sub: 'DE CIMA' },
    { id: 'top_10pct', nome: 'Top 10%', como: 'Chegue entre os 10% primeiros da sua distância.', tier: 'ouro', num: '10%', sub: 'TOP' },
    { id: 'top_10', nome: 'Top 10', como: 'Fique entre os 10 primeiros do geral.', tier: 'prata', num: '10', sub: 'TOP GERAL' },
  ]},
  { nome: 'Temporada', itens: [
    { id: '5_provas', nome: '5 provas', como: '5 provas na temporada.', tier: 'bronze', num: '5', sub: 'PROVAS' },
    { id: '10_provas', nome: '10 provas', como: '10 provas na temporada.', tier: 'prata', num: '10', sub: 'PROVAS' },
    { id: '20_provas', nome: '20 provas', como: '20 provas na temporada.', tier: 'ouro', num: '20', sub: 'PROVAS' },
    { id: '30_provas', nome: '30 provas', como: '30 provas na temporada.', tier: 'especial', num: '30', sub: 'PROVAS' },
    { id: '100_km', nome: '100 km', como: 'Some 100 km em provas na temporada.', tier: 'prata', num: '100', sub: 'KM NO ANO' },
    { id: '250_km', nome: '250 km', como: 'Some 250 km em provas na temporada.', tier: 'ouro', num: '250', sub: 'KM NO ANO' },
    { id: 'sequencia_3', nome: 'Sem parar', como: 'Provas em 3 meses seguidos.', tier: 'bronze', ic: 'fogo' },
    { id: 'todo_mes', nome: 'O ano todo', como: 'Provas em 6 meses diferentes da temporada.', tier: 'ouro', ic: 'calendario' },
    { id: 'dobradinha', nome: 'Dobradinha', como: 'Duas provas no mesmo fim de semana.', tier: 'prata', num: '2x', sub: 'FIM DE SEMANA' },
    { id: '500_km', nome: '500 km', como: 'Some 500 km em provas na temporada.', tier: 'especial', num: '500', sub: 'KM NO ANO' },
    { id: 'trinca', nome: 'Trinca', como: 'Provas em 3 fins de semana seguidos.', tier: 'ouro', num: '3', sub: 'FDS SEGUIDOS' },
    { id: 'fiel', nome: 'Fiel à prova', como: 'Corra a mesma prova em duas edições (anos) diferentes.', tier: 'prata', ic: 'repetir' },
    { id: 'mes_cheio', nome: 'Mês cheio', como: '3 provas no mesmo mês.', tier: 'prata', num: '3', sub: 'NO MÊS' },
    { id: 'de_volta', nome: 'De volta', como: 'Volte a correr uma prova depois de 3 meses parado.', tier: 'bronze', ic: 'seta_volta' },
    { id: 'domingueiro', nome: 'Domingueiro', como: '5 provas em domingos na temporada.', tier: 'prata', num: '5', sub: 'DOMINGOS' },
  ]},
  { nome: 'Maranhão', itens: [
    { id: '3_cidades', nome: '3 cidades', como: 'Corra em 3 cidades na temporada.', tier: 'bronze', ic: 'mapa' },
    { id: '5_cidades', nome: '5 cidades', como: 'Corra em 5 cidades na temporada.', tier: 'prata', ic: 'bussola' },
    { id: '10_cidades', nome: '10 cidades', como: 'Corra em 10 cidades na temporada.', tier: 'ouro', ic: 'globo' },
    { id: 'ilha_completa', nome: 'Ilha completa', como: 'Corra em São Luís, Ribamar, Paço do Lumiar e Raposa (na carreira).', tier: 'especial', ic: 'ilha' },
    { id: 'capital', nome: 'Na capital', como: 'Corra uma prova em São Luís.', tier: 'bronze', ic: 'predio' },
    { id: 'interior', nome: 'Pé na estrada', como: 'Corra uma prova fora da Ilha de São Luís.', tier: 'bronze', ic: 'estrada' },
    { id: 'cruzou_o_ma', nome: 'Cruzou o Maranhão', como: 'Provas em duas cidades a mais de 400 km uma da outra.', tier: 'ouro', ic: 'rota' },
    { id: 'litoral', nome: 'Pé na areia', como: 'Corra numa cidade do litoral fora de São Luís (ex.: Raposa, Ribamar, Barreirinhas, Alcântara).', tier: 'prata', ic: 'palmeira' },
    { id: '20_cidades', nome: '20 cidades', como: 'Corra em 20 cidades do Maranhão (na carreira).', tier: 'especial', num: '20', sub: 'CIDADES' },
    { id: 'lencois', nome: 'Lençóis', como: 'Corra uma prova em Barreirinhas ou Santo Amaro.', tier: 'ouro', ic: 'duna' },
    { id: 'tocantina', nome: 'Região Tocantina', como: 'Corra uma prova em Imperatriz ou região.', tier: 'prata', ic: 'rio' },
  ]},
  { nome: 'Momentos', itens: [
    { id: 'madrugador', nome: 'Madrugador', como: 'Prova com largada antes das 6h.', tier: 'bronze', ic: 'sol' },
    { id: 'night_run', nome: 'Night Run', como: 'Prova com largada a partir das 17h.', tier: 'prata', ic: 'lua' },
    { id: 'aniversario', nome: 'Corri no meu dia', como: 'Corra uma prova na semana do seu aniversário.', tier: 'ouro', ic: 'bolo' },
    { id: 'fecha_o_ano', nome: 'Fecha o ano', como: 'Corra uma prova em dezembro.', tier: 'bronze', ic: 'fogos' },
    { id: 'em_equipe', nome: 'Em equipe', como: 'Corra a mesma prova com pelo menos mais 2 atletas da sua assessoria.', tier: 'prata', ic: 'equipe' },
    { id: 'oficial_5', nome: '100% oficial', como: '5 provas verificadas no resultado oficial.', tier: 'prata', ic: 'selo' },
    { id: 'sao_joao', nome: 'Arraiá', como: 'Corra uma prova em junho, mês de São João.', tier: 'prata', ic: 'bandeirolas' },
    { id: 'aniversario_slz', nome: 'Parabéns, São Luís', como: 'Corra em São Luís na semana de 8 de setembro.', tier: 'ouro', ic: 'presente' },
    { id: 'primeira_do_ano', nome: 'Abre o ano', como: 'Corra uma prova em janeiro.', tier: 'bronze', ic: 'fogos' },
    { id: 'feriado', nome: 'Feriadão', como: 'Corra uma prova num feriado nacional.', tier: 'bronze', ic: 'calendario' },
    { id: 'outubro_rosa', nome: 'Outubro Rosa', como: 'Corra uma prova em outubro.', tier: 'prata', ic: 'laco' },
    { id: 'novembro_azul', nome: 'Novembro Azul', como: 'Corra uma prova em novembro.', tier: 'prata', ic: 'bigode' },
    { id: 'sol_forte', nome: 'Sol do Maranhão', como: 'Prova com largada a partir das 7h30.', tier: 'bronze', ic: 'sol_forte' },
  ]},
  { nome: 'Duelos', itens: [
    { id: 'duelista', nome: 'Duelista', como: 'Vença o seu primeiro duelo (o duelo fecha no fim do mês).', tier: 'bronze', ic: 'espadas' },
    { id: 'invicto', nome: 'Invicto', como: 'Vença 3 duelos seguidos (o duelo fecha no fim do mês).', tier: 'ouro', ic: 'escudo' },
    { id: 'rival', nome: 'Rivalidade', como: 'Faça 5 duelos com o mesmo atleta.', tier: 'prata', num: '5x', sub: 'DUELOS' },
    { id: 'duelos_10', nome: '10 duelos', como: 'Participe de 10 duelos.', tier: 'prata', num: '10', sub: 'DUELOS' },
    { id: 'virada', nome: 'Virada', como: 'Vença um duelo contra alguém de liga acima da sua.', tier: 'especial', ic: 'raio' },
  ]},
  { nome: 'Carreira', itens: [
    { id: 'carreira_25', nome: '25 provas', como: '25 provas registradas no Radar (todas as temporadas).', tier: 'prata', num: '25', sub: 'CARREIRA' },
    { id: 'carreira_50', nome: '50 provas', como: '50 provas registradas no Radar.', tier: 'ouro', num: '50', sub: 'CARREIRA' },
    { id: 'carreira_100', nome: '100 provas', como: '100 provas registradas no Radar.', tier: 'especial', num: '100', sub: 'CARREIRA' },
    { id: 'carreira_1000km', nome: '1.000 km', como: 'Some 1.000 km em provas (todas as temporadas).', tier: 'especial', num: '1000', sub: 'KM' },
    { id: 'duas_temporadas', nome: 'Veterano', como: 'Provas em 2 temporadas diferentes no Radar.', tier: 'prata', ic: 'estrela' },
  ]},
  { nome: 'Brasil', itens: [
    { id: 'regiao_nordeste', nome: 'Nordestino', como: 'Comprovou prova em outro estado do Nordeste além do Maranhão.', tier: 'ouro', ic: 'sol' },
    { id: 'regiao_norte', nome: 'Rumo ao Norte', como: 'Comprovou prova num estado da região Norte.', tier: 'ouro', ic: 'bussola' },
    { id: 'regiao_centro_oeste', nome: 'Centro-Oeste', como: 'Comprovou prova num estado do Centro-Oeste.', tier: 'ouro', ic: 'bussola' },
    { id: 'regiao_sudeste', nome: 'Sudeste', como: 'Comprovou prova num estado do Sudeste.', tier: 'ouro', ic: 'bussola' },
    { id: 'regiao_sul', nome: 'Sul', como: 'Comprovou prova num estado do Sul.', tier: 'ouro', ic: 'bussola' },
    { id: 'cinco_regioes', nome: 'Cinco regiões', como: 'Prova comprovada nas cinco regiões do Brasil.', tier: 'especial', ic: 'mapa' },
    { id: 'brasil_3', nome: 'Viajante', como: 'Provas comprovadas em 3 estados fora do Maranhão.', tier: 'prata', num: '3', sub: 'UF' },
    { id: 'brasil_5', nome: 'Pé na estrada', como: 'Provas comprovadas em 5 estados fora do Maranhão.', tier: 'ouro', num: '5', sub: 'UF' },
    { id: 'brasil_10', nome: 'Brasil afora', como: 'Provas comprovadas em 10 estados fora do Maranhão.', tier: 'especial', num: '10', sub: 'UF' },
    { id: 'exterior', nome: 'Passaporte', como: 'Resultado comprovado numa prova fora do Brasil.', tier: 'especial', ic: 'globo' },
    { id: 'estado_ac', nome: 'Acre', como: 'Resultado comprovado numa prova no Acre.', tier: 'prata', num: 'AC' },
    { id: 'estado_al', nome: 'Alagoas', como: 'Resultado comprovado numa prova em Alagoas.', tier: 'prata', num: 'AL' },
    { id: 'estado_ap', nome: 'Amapá', como: 'Resultado comprovado numa prova no Amapá.', tier: 'prata', num: 'AP' },
    { id: 'estado_am', nome: 'Amazonas', como: 'Resultado comprovado numa prova no Amazonas.', tier: 'prata', num: 'AM' },
    { id: 'estado_ba', nome: 'Bahia', como: 'Resultado comprovado numa prova na Bahia.', tier: 'prata', num: 'BA' },
    { id: 'estado_ce', nome: 'Ceará', como: 'Resultado comprovado numa prova no Ceará.', tier: 'prata', num: 'CE' },
    { id: 'estado_df', nome: 'Distrito Federal', como: 'Resultado comprovado numa prova no Distrito Federal.', tier: 'prata', num: 'DF' },
    { id: 'estado_es', nome: 'Espírito Santo', como: 'Resultado comprovado numa prova no Espírito Santo.', tier: 'prata', num: 'ES' },
    { id: 'estado_go', nome: 'Goiás', como: 'Resultado comprovado numa prova em Goiás.', tier: 'prata', num: 'GO' },
    { id: 'estado_ma', nome: 'Maranhão', como: 'Resultado comprovado numa prova no Maranhão.', tier: 'bronze', num: 'MA' },
    { id: 'estado_mt', nome: 'Mato Grosso', como: 'Resultado comprovado numa prova no Mato Grosso.', tier: 'prata', num: 'MT' },
    { id: 'estado_ms', nome: 'Mato Grosso do Sul', como: 'Resultado comprovado numa prova no Mato Grosso do Sul.', tier: 'prata', num: 'MS' },
    { id: 'estado_mg', nome: 'Minas Gerais', como: 'Resultado comprovado numa prova em Minas Gerais.', tier: 'prata', num: 'MG' },
    { id: 'estado_pa', nome: 'Pará', como: 'Resultado comprovado numa prova no Pará.', tier: 'prata', num: 'PA' },
    { id: 'estado_pb', nome: 'Paraíba', como: 'Resultado comprovado numa prova na Paraíba.', tier: 'prata', num: 'PB' },
    { id: 'estado_pr', nome: 'Paraná', como: 'Resultado comprovado numa prova no Paraná.', tier: 'prata', num: 'PR' },
    { id: 'estado_pe', nome: 'Pernambuco', como: 'Resultado comprovado numa prova em Pernambuco.', tier: 'prata', num: 'PE' },
    { id: 'estado_pi', nome: 'Piauí', como: 'Resultado comprovado numa prova no Piauí.', tier: 'prata', num: 'PI' },
    { id: 'estado_rj', nome: 'Rio de Janeiro', como: 'Resultado comprovado numa prova no Rio de Janeiro.', tier: 'prata', num: 'RJ' },
    { id: 'estado_rn', nome: 'Rio Grande do Norte', como: 'Resultado comprovado numa prova no Rio Grande do Norte.', tier: 'prata', num: 'RN' },
    { id: 'estado_rs', nome: 'Rio Grande do Sul', como: 'Resultado comprovado numa prova no Rio Grande do Sul.', tier: 'prata', num: 'RS' },
    { id: 'estado_ro', nome: 'Rondônia', como: 'Resultado comprovado numa prova em Rondônia.', tier: 'prata', num: 'RO' },
    { id: 'estado_rr', nome: 'Roraima', como: 'Resultado comprovado numa prova em Roraima.', tier: 'prata', num: 'RR' },
    { id: 'estado_sc', nome: 'Santa Catarina', como: 'Resultado comprovado numa prova em Santa Catarina.', tier: 'prata', num: 'SC' },
    { id: 'estado_sp', nome: 'São Paulo', como: 'Resultado comprovado numa prova em São Paulo.', tier: 'prata', num: 'SP' },
    { id: 'estado_se', nome: 'Sergipe', como: 'Resultado comprovado numa prova em Sergipe.', tier: 'prata', num: 'SE' },
    { id: 'estado_to', nome: 'Tocantins', como: 'Resultado comprovado numa prova no Tocantins.', tier: 'prata', num: 'TO' },
  ] },
  { nome: 'Radar', itens: [
    { id: 'fundador', nome: 'Fundador', como: 'Assinou o Radar Pro até 31/12/2026, na pré-temporada 2027.', tier: 'especial', ic: 'pioneiro' },
    { id: 'no_pelotao', nome: 'No pelotão', como: 'Corra a mesma prova que alguém do seu pelotão.', tier: 'bronze', ic: 'pelotao' },
    { id: 'lider_pelotao', nome: 'Puxou o pelotão', como: 'Tenha a melhor nota do seu pelotão numa prova.', tier: 'ouro', ic: 'coroa' },
  ]},
];

let uid = 0;
/** borda serrilhada das medalhas de ouro e especiais */
function roseta(cx: number, cy: number, R: number, r: number, n: number) {
  let d = '';
  for (let i = 0; i < n * 2; i++) { const a = Math.PI * i / n - Math.PI / 2, q = i % 2 ? r : R; d += (i ? 'L' : 'M') + (cx + q * Math.cos(a)).toFixed(2) + ' ' + (cy + q * Math.sin(a)).toFixed(2); }
  return d + 'Z';
}
export function medalhaSVG(m: Medalha, ok = true, tam = 96) {
  const t = TIERS[m.tier], k = 'm' + (uid++);
  const cinza = !ok;
  const A = cinza ? '#eef1f5' : t.a, B = cinza ? '#c9d0da' : t.b, C = cinza ? '#9aa4b2' : t.c;
  const F1 = cinza ? '#c3cad4' : t.fita1, F2 = cinza ? '#d6dce4' : t.fita2;
  const tinta = cinza ? '#8a94a3' : t.txt;
  const centro = m.num
    ? `<text x="50" y="${m.num.length > 2 ? 69 : 70}" text-anchor="middle" font-family="'Archivo Variable',sans-serif" font-weight="900" font-size="${m.num.length > 3 ? 17 : m.num.length > 2 ? 21 : 27}" fill="${tinta}" letter-spacing="-0.5">${m.num}</text>
       <text x="50" y="${m.num.length > 2 ? 81 : 83}" text-anchor="middle" font-family="'Archivo Variable',sans-serif" font-weight="800" font-size="6.2" fill="${tinta}" letter-spacing="1.2" opacity=".85">${m.sub}</text>`
    : `<g transform="translate(32 48) scale(1.5)" fill="none" stroke="${tinta}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${IC[m.ic ?? 'bandeira']}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 112" width="${tam}" height="${tam * 1.12}" role="img" aria-label="${m.nome}">
  <defs>
    <linearGradient id="${k}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${A}"/><stop offset=".5" stop-color="${B}"/><stop offset="1" stop-color="${C}"/></linearGradient>
    <linearGradient id="${k}h" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${A}"/><stop offset=".55" stop-color="${B}"/><stop offset="1" stop-color="${A}"/></linearGradient>
    <radialGradient id="${k}r" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></radialGradient>
  </defs>
  <!-- fita -->
  <path d="M22 0h24l14 46H36z" fill="${F1}"/><path d="M54 0h24L64 46H40z" fill="${F2}"/>
  <path d="M28 0h5l14.5 46h-5z" fill="#fff" opacity="${cinza ? .35 : .45}"/><path d="M67 0h5L57.5 46h-5z" fill="#fff" opacity="${cinza ? .35 : .45}"/>
  <path d="M40 40h20v8H40z" fill="${C}" opacity=".9"/>
  <!-- disco -->
  <circle cx="50" cy="66" r="36" fill="${C}" opacity=".35" transform="translate(0 2.2)"/>
  ${(m.tier === 'ouro' || m.tier === 'especial') ? `<path d="${roseta(50, 66, 38.5, 35, 28)}" fill="url(#${k}g)" stroke="${C}" stroke-opacity=".5" stroke-width=".6"/>` : ''}
  <circle cx="50" cy="66" r="36" fill="url(#${k}g)"/>
  <circle cx="50" cy="66" r="31" fill="url(#${k}h)" stroke="${C}" stroke-opacity=".55" stroke-width=".8"/>
  <circle cx="50" cy="66" r="27.5" fill="none" stroke="${tinta}" stroke-opacity=".28" stroke-width=".8" stroke-dasharray="1.2 2.2"/>
  <circle cx="50" cy="66" r="36" fill="url(#${k}r)"/>
  ${centro}
  ${m.tier === 'especial' && !cinza ? `<g fill="${t.fita2}"><path d="M50 36.2l1.1 2.3 2.5.3-1.8 1.7.5 2.5-2.3-1.2-2.3 1.2.5-2.5-1.8-1.7 2.5-.3z"/></g>` : ''}
  ${cinza ? `<g transform="translate(70 34)"><circle r="9" fill="#fff" stroke="#c9d0da"/><g transform="translate(-5 -5.6) scale(.45)" fill="none" stroke="#8a94a3" stroke-width="2.6" stroke-linecap="round"><rect x="4" y="11" width="16" height="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></g></g>` : ''}
</svg>`;
}
export const MEDALHAS: Medalha[] = GRUPOS.flatMap(g => g.itens);
