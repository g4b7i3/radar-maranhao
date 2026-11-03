// Admin · "Resultados não achados": quando o atleta tenta registrar só com o peito e o Radar não acha,
// a busca cai aqui. O admin procura nas cronometragens (ou cola o link), carrega o resultado na hora,
// marca como resolvida e, se quiser, avisa o atleta pra registrar de novo.
import { useEffect, useRef, useState } from 'react';
import { Search, Check, ExternalLink, Download } from 'lucide-react';
import { chamar, dataBR, kmTxt, relogio } from './sb';
import { telaInicial } from './voltar';
import { Arroba } from './Selo';

type Busca = { id: string; user_id: string; prova_id: string; prova_nome: string; data: string; km: number; peito: string | null; achou_resultado: boolean; criado_em: string; resultado: string | null; apelido: string | null; nome_completo: string | null; cidade: string | null; link_resultado: string | null; oficiais: number };
type Cand = { nome: string; data: string; url: string; parecenca: number };
type Carga = { resumo: string; peito: { nome: string; km: number | null; tempo_s: number; colocacao_geral: number | null } | null };

/** Pedido de abrir esta seção (notificação "não achou o resultado"). */
export const focoAdmin = { v: null as string | null };

export function AdminBuscas() {
  const [lista, setLista] = useState<Busca[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const ref = useRef<HTMLElement>(null);
  const pedido = useRef(telaInicial('admin') ?? focoAdmin.v);
  const carregar = () => chamar<{ buscas: Busca[] }>('radar-admin-buscas', { acao: 'buscas' }).then(r => (r.erro ? setMsg(r.erro) : setLista(r.buscas)));
  useEffect(() => { carregar(); }, []);
  useEffect(() => {
    focoAdmin.v = null;
    if (pedido.current === 'buscas' && lista?.length) { pedido.current = null; setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150); }
  }, [lista]);
  if (lista && !lista.length) return null;
  return (
    <section className="pro-card pro-buscas" ref={ref} id="adm-buscas">
      <p className="pro-k cinza"><Search size={14} aria-hidden="true" /> Resultados não achados ({lista?.length ?? '…'})</p>
      {msg && <p className="pro-aviso" role="status">{msg}</p>}
      <ul className="pro-provas">{lista?.map(b => <li key={b.id}><ItemBusca b={b} feito={m => { setMsg(m); carregar(); }} /></li>)}</ul>
    </section>
  );
}

function ItemBusca({ b, feito }: { b: Busca; feito: (m: string) => void }) {
  const [link, setLink] = useState('');
  const [cands, setCands] = useState<Cand[] | null>(null);
  const [carga, setCarga] = useState<Carga | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [forcar, setForcar] = useState(false);
  const primeiro = (b.nome_completo ?? '').split(' ')[0] || (b.apelido ? '@' + b.apelido : '');
  const [aviso, setAviso] = useState(`Oi, ${primeiro}! O resultado da ${b.prova_nome} já está no Radar. Vai em Eu corri e registra de novo só com o número de peito${b.peito ? ` (${b.peito})` : ''}.`);
  const procurar = async () => {
    setOcupado('procurar'); setErro(null);
    const r = await chamar<{ candidatos: Cand[] }>('radar-admin-buscas', { acao: 'procurar', id: b.id });
    setOcupado(null);
    if (r.erro) return setErro(r.erro);
    setCands(r.candidatos);
  };
  const carregarLink = async (url: string, f = false) => {
    setOcupado(url); setErro(null); setForcar(false);
    const r = await chamar<Carga & { pode_forcar?: boolean }>('radar-admin-buscas', { acao: 'procurar', id: b.id, link: url, forcar: f });
    setOcupado(null);
    if (r.erro) { setErro(r.erro); setForcar(!!(r as { pode_forcar?: boolean }).pode_forcar); setLink(url); return; }
    setCarga(r);
  };
  const resolver = async (avisar: boolean) => {
    setOcupado('resolver');
    const r = await chamar('radar-admin-buscas', { acao: 'resolver', id: b.id, avisar, aviso });
    setOcupado(null);
    feito(r.erro ?? (avisar ? `Resolvido e @${b.apelido} avisado no sininho.` : 'Marcado como resolvido.'));
  };
  return (
    <>
      <div className="pro-linha"><b>{b.prova_nome}</b><span className={`pro-st ${b.oficiais ? 'ok' : 'dec'}`}>{b.oficiais ? `${b.oficiais} no resultado` : 'sem resultado'}</span></div>
      <p className="pro-sem-margem"><Arroba a={b.apelido ?? '?'} />{b.nome_completo ? ` (${b.nome_completo})` : ''} · {dataBR(b.data)}{b.cidade ? ` · ${b.cidade}` : ''} · {kmTxt(Number(b.km))} · peito <b>{b.peito ?? '?'}</b></p>
      <p className="fine pro-sem-margem">{b.achou_resultado ? 'O resultado está no Radar, mas o peito não bateu com o nome.' : 'O Radar não achou o resultado dessa prova.'} · {new Date(b.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
      {b.link_resultado && <p className="fine pro-sem-margem"><a href={b.link_resultado} target="_blank" rel="noopener noreferrer"><ExternalLink size={12} aria-hidden="true" /> Resultado carregado</a></p>}
      {b.resultado && !carga && <p className="fine pro-sem-margem">Última carga: {b.resultado}</p>}

      <div className="pro-linha pro-quebra">
        <button className="btn solid" onClick={procurar} disabled={!!ocupado}><Search size={16} aria-hidden="true" />{ocupado === 'procurar' ? 'Procurando…' : 'Procurar agora'}</button>
      </div>
      {cands && (cands.length
        ? <ul className="pro-buscas-cands">{cands.map(c => (
            <li key={c.url}>
              <span><b>{c.nome}</b><small>{dataBR(c.data)} · parecença {Math.round(c.parecenca * 100)}% · <a href={c.url} target="_blank" rel="noopener noreferrer">abrir</a></small></span>
              <button className="btn outline" onClick={() => carregarLink(c.url)} disabled={!!ocupado}><Download size={15} aria-hidden="true" />{ocupado === c.url ? 'Carregando…' : 'Carregar'}</button>
            </li>))}</ul>
        : <p className="fine">Nenhum evento nas cronometragens perto dessa data. Se achar o link, cole abaixo.</p>)}

      <div className="pro-linha pro-quebra">
        <input className="pro-input" value={link} onChange={e => setLink(e.target.value)} placeholder="Colar link do resultado" aria-label="Link do resultado" inputMode="url" />
        <button className="btn outline" onClick={() => carregarLink(link.trim(), forcar)} disabled={!link.trim() || !!ocupado}>{ocupado === link.trim() ? 'Carregando…' : forcar ? 'Carregar mesmo assim' : 'Carregar link'}</button>
      </div>
      {erro && <p className="pro-aviso" role="alert">{erro}</p>}
      {carga && <p className={carga.peito ? 'pro-ok' : 'pro-aviso'} role="status">{carga.peito ? <>✓ Peito {b.peito}: <b>{carga.peito.nome}</b> · {relogio(carga.peito.tempo_s)}{carga.peito.colocacao_geral ? ` · ${carga.peito.colocacao_geral}º geral` : ''}</> : carga.resumo}</p>}

      <label className="fine pro-sem-margem" htmlFor={`av-${b.id}`}>Aviso pro atleta (sininho)</label>
      <textarea id={`av-${b.id}`} className="pro-input pro-buscas-aviso" rows={3} value={aviso} onChange={e => setAviso(e.target.value)} />
      <div className="pro-linha pro-quebra">
        <button className="btn solid" onClick={() => resolver(true)} disabled={!!ocupado || !aviso.trim()}><Check size={16} aria-hidden="true" />Resolvido e avisar <Arroba a={b.apelido} /></button>
        <button className="btn text" onClick={() => resolver(false)} disabled={!!ocupado}>Só marcar resolvido</button>
      </div>
    </>
  );
}
