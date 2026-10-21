// Conexão do Radar Pro com o Supabase (login, banco e funções do servidor).
// A chave abaixo é a pública (publishable): só funciona com as regras de segurança do banco.
import { createClient } from '@supabase/supabase-js';

export const SB_URL = 'https://xsijphfxcorjsuxiewch.supabase.co';
export const sb = createClient(SB_URL, 'sb_publishable_oWDv6oIHYdRlbCjDveP-7Q_5iXwUjJ1', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'radar-pro-auth' },
});

export const ADMIN_EMAIL = 'vinikautor@gmail.com';

/** Chama uma função do servidor e devolve o JSON (com "erro" quando der problema). */
export async function chamar<T = any>(fn: string, corpo?: unknown): Promise<T & { erro?: string }> {
  const { data: { session } } = await sb.auth.getSession();
  try {
    const r = await fetch(`${SB_URL}/functions/v1/${fn}`, {
      method: corpo === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    const j = await r.json().catch(() => ({}));
    return (r.ok ? j : { ...j, erro: j.erro ?? 'Algo deu errado. Tente de novo.' }) as T & { erro?: string };
  } catch {
    return { erro: 'Sem internet agora. Tente de novo.' } as T & { erro?: string };
  }
}

export type Perfil = { user_id: string; apelido: string; nome_completo: string; cidade: string; sexo: 'F' | 'M'; nascimento: string; assessoria: string | null; whatsapp?: string | null };
export type Resultado = {
  id: string; prova_id: string; prova_nome: string; prova_data: string; cidade: string; largada: string | null; distancia_km: number;
  tempo_s: number; idade: number; nota: number; status: 'verificado' | 'aprovado' | 'declarado' | 'em_analise' | 'recusado';
  motivo_analise: string | null; podio: boolean; pontos: number; detalhes_pontos: Record<string, number> | null; peito: string | null; peito_declarado?: string | null; nome_inscricao?: string | null; link_resultado: string | null;
};
export type Temporada = {
  assinante: boolean; valida_ate: string | null; indice: number | null; provas_indice: number; liga: Liga | null;
  pontos: number; pontos_pendentes: number; provas: number; cidades: number; km: number; posicao_ma: number | null;
};
export type Liga = 'bronze' | 'prata' | 'ouro' | 'elite';

export const LIGAS: { id: Liga; nome: string; min: number; max: number | null }[] = [
  { id: 'bronze', nome: 'Bronze', min: 0, max: 44.9 },
  { id: 'prata', nome: 'Prata', min: 45, max: 54.9 },
  { id: 'ouro', nome: 'Ouro', min: 55, max: 64.9 },
  { id: 'elite', nome: 'Elite', min: 65, max: null },
];

export const MEDALHAS: { id: string; icone: string; nome: string; como: string }[] = [
  { id: 'primeira_prova', icone: '🏁', nome: '1ª prova', como: 'Registre a sua primeira prova.' },
  { id: 'primeiro_10k', icone: '🔟', nome: '1º 10K', como: 'Complete uma prova de 10 km.' },
  { id: 'primeira_meia', icone: '🥈', nome: '1ª meia', como: 'Complete uma meia maratona.' },
  { id: 'primeira_maratona', icone: '🏆', nome: '1ª maratona', como: 'Complete uma maratona.' },
  { id: '5_provas', icone: '5️⃣', nome: '5 provas', como: '5 provas na temporada.' },
  { id: '10_provas', icone: '🔥', nome: '10 provas', como: '10 provas na temporada.' },
  { id: '20_provas', icone: '💯', nome: '20 provas', como: '20 provas na temporada.' },
  { id: '3_cidades', icone: '🗺️', nome: '3 cidades', como: 'Corra em 3 cidades na temporada.' },
  { id: '5_cidades', icone: '🧭', nome: '5 cidades', como: 'Corra em 5 cidades na temporada.' },
  { id: '10_cidades', icone: '🌎', nome: '10 cidades', como: 'Corra em 10 cidades na temporada.' },
  { id: 'madrugador', icone: '🌅', nome: 'Madrugador', como: 'Prova com largada antes das 6h.' },
  { id: 'night_run', icone: '🌙', nome: 'Night Run', como: 'Prova com largada a partir das 17h.' },
  { id: 'recorde_pessoal', icone: '⚡', nome: 'Recorde pessoal', como: 'Bata o seu melhor tempo numa distância (resultado oficial).' },
  { id: 'podio', icone: '🥇', nome: 'Pódio', como: 'Top 3 no geral ou na faixa etária (resultado oficial).' },
  { id: 'subiu_de_liga', icone: '⬆️', nome: 'Subiu de liga', como: 'Suba de liga com um resultado oficial.' },
];

export const STATUS: Record<Resultado['status'], { txt: string; cls: string; dica: string }> = {
  verificado: { txt: 'Verificado', cls: 'ok', dica: 'Conferido no resultado oficial da cronometragem.' },
  aprovado: { txt: 'Aprovado', cls: 'ok', dica: 'Comprovante aprovado pelo Radar.' },
  declarado: { txt: 'Declarado', cls: 'dec', dica: 'Conta na sua temporada. Para valer no ranking, o resultado oficial precisa sair ou você envia o comprovante.' },
  em_analise: { txt: 'Em análise', cls: 'ana', dica: 'O Radar está conferindo. Normalmente em até 2 dias.' },
  recusado: { txt: 'Recusado', cls: 'rec', dica: 'Não foi aceito. Fale com o Radar pelo WhatsApp.' },
};

export const relogio = (s: number) => {
  s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`;
};
export const pct = (n: number | null | undefined) => (n == null ? '–' : Number(n).toFixed(1).replace('.', ','));
export const kmTxt = (km: number) => (Math.abs(km - 21.0975) < 0.01 ? '21 km' : Math.abs(km - 42.195) < 0.01 ? '42 km' : `${String(Math.round(km * 100) / 100).replace('.', ',')} km`);
export const dataBR = (d: string) => d.slice(0, 10).split('-').reverse().slice(0, 2).join('/');

/** WhatsApp: guarda só números com 55 + DDD (ex.: 5598984334880). */
export const zapLimpo = (v: string) => { const d = v.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, ''); return /^\d{10,11}$/.test(d) ? '55' + d : null; };
export const zapMascara = (v: string) => { const d = v.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '').slice(0, 11); return d.length <= 2 ? d : d.length <= 7 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`; };
