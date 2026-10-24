// Conexão do Radar Pro com o Supabase (login, banco e funções do servidor).
// A chave abaixo é a pública (publishable): só funciona com as regras de segurança do banco.
import { createClient } from '@supabase/supabase-js';

export const SB_URL = 'https://xsijphfxcorjsuxiewch.supabase.co';
export const sb = createClient(SB_URL, 'sb_publishable_oWDv6oIHYdRlbCjDveP-7Q_5iXwUjJ1', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'radar-pro-auth' },
});

export const ADMIN_EMAIL = 'vinikautor@gmail.com';
/** Quem está logado é o admin (o servidor confere de novo em cada ação). */
export const souAdmin = { v: false };

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

export type Perfil = { user_id: string; apelido: string; foto_url?: string | null; nome_completo: string; cidade: string; sexo: 'F' | 'M'; nascimento: string; assessoria: string | null; whatsapp?: string | null; publico?: boolean; bio?: string | null; edicoes_mes?: string | null; edicoes_qtd?: number; avisos_perto?: boolean };
export type Resultado = {
  id: string; user_id: string; colocacao_geral?: number | null; colocacao_faixa?: number | null; total_dist?: number | null; prova_id: string; prova_nome: string; prova_data: string; cidade: string; uf?: string; largada: string | null; distancia_km: number;
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

export { MEDALHAS, GRUPOS } from './medalhas';

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
export const kmTxt = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : Math.abs(km - 21.0975) < 0.01 ? '21 km' : Math.abs(km - 42.195) < 0.01 ? '42 km' : `${String(Math.round(km * 100) / 100).replace('.', ',')} km`);
export const dataBR = (d: string) => d.slice(0, 10).split('-').reverse().slice(0, 2).join('/');

/** WhatsApp: guarda só números com 55 + DDD (ex.: 5598984334880). */
export const zapLimpo = (v: string) => { const d = v.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, ''); return /^\d{10,11}$/.test(d) ? '55' + d : null; };
export const zapMascara = (v: string) => { const d = v.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '').slice(0, 11); return d.length <= 2 ? d : d.length <= 7 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`; };

/** Edições de perfil que ainda restam no mês (limite de 2 por mês, contado no servidor). */
export const edicoesRestantes = (p: Perfil) => {
  const mes = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 7);
  return Math.max(0, 2 - (p.edicoes_mes === mes ? p.edicoes_qtd ?? 0 : 0));
};

export const linkPerfil = (apelido: string) => `https://radarcorridasma.com.br/?atleta=${apelido}`;
