// Corrida de exemplo para mostrar os modelos de card (orla de São Luís, 10 km). Só para a prévia.
const ROTA: [number, number][] = [];
// ida e volta pela orla (Ponta d'Areia → Calhau), com uma curvinha
for (let i = 0; i <= 60; i++) { const t = i / 60; ROTA.push([-2.4930 + 0.0040 * Math.sin(t * Math.PI) - 0.004 * t, -44.3020 + 0.0420 * t]); }
for (let i = 0; i <= 60; i++) { const t = i / 60; ROTA.push([-2.4970 + 0.0015 * Math.sin(t * Math.PI * 2) + 0.004 * t * 0.2, -44.2600 - 0.0400 * t]); }
const PARC = [318, 312, 309, 314, 306, 311, 302, 308, 300, 291].map((seg, k) => ({ km: k + 1, seg, fc: 146 + k }));
const VOLTAS = [
  { d: 1000, seg: 340 }, { d: 400, seg: 92 }, { d: 200, seg: 80 }, { d: 400, seg: 91 }, { d: 200, seg: 82 },
  { d: 400, seg: 90 }, { d: 200, seg: 81 }, { d: 400, seg: 89 }, { d: 200, seg: 83 }, { d: 1000, seg: 345 },
];
export const CORRIDA_DEMO = {
  id: 'demo', data: '2026-11-01T05:30:00-03:00', titulo: 'Longão na orla', tipo: 'corrida',
  distancia_m: 10020, duracao_s: 3071, fc_media: 152, elevacao_m: 18, cadencia: 172,
  resumo_rel: { kcal: 640, passos: 9120 }, parciais: PARC, rota: ROTA,
  analise: { voltas: VOLTAS, extras: { temp_med: 27 } },
};
export const CLIMA_DEMO = { temp: 27, sens: 30, umid: 78, vento: 14, cod: 1, dia: true, fonte: 'clima' };
