// Foto de perfil do Radar Pro (opcional). Antes de enviar, o app reduz para 300 px (no ranking aparece com 36 px) e o navegador guarda por 1 ano, porque o nome do arquivo muda a cada troca (sobe rápido e ocupa pouco).
import { useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { sb, type Perfil } from './sb';
import { useOnline } from './online';


/** Foto redonda do atleta (ou a inicial do apelido, se ainda não tiver foto). */
export function Avatar({ foto, apelido, tam = 40 }: { foto?: string | null; apelido: string; tam?: number }) {
  const [erro, setErro] = useState(false);
  const on = useOnline(apelido);
  const img = foto && !erro
    ? <img className="pro-avatar" src={foto} alt="" width={tam} height={tam} loading="lazy" onError={() => setErro(true)} style={{ width: tam, height: tam }} />
    : <span className="pro-avatar pro-avatar-vazio" style={{ width: tam, height: tam, fontSize: tam * .42 }} aria-hidden="true">{(apelido || '?').slice(0, 1).toUpperCase()}</span>;
  if (!on) return img;
  return <span className="pro-av-on" style={{ width: tam, height: tam }}>{img}<i style={{ width: Math.max(10, tam * .26), height: Math.max(10, tam * .26) }} title="Online agora" /></span>;
}

/** Busca as fotos de uma lista de apelidos (para os rankings). */
export function useFotos(apelidos: string[]) {
  const [fotos, setFotos] = useState<Map<string, string>>(new Map());
  const chave = [...new Set(apelidos)].sort().join(',');
  useEffect(() => {
    const lista = chave ? chave.split(',') : [];
    if (!lista.length) return;
    sb.rpc('radar_fotos', { p_apelidos: lista }).then(({ data }) => setFotos(new Map(((data ?? []) as { apelido: string; foto: string }[]).map(x => [x.apelido, x.foto]))));
  }, [chave]);
  return fotos;
}

/** Reduz uma imagem para caber em `lado` px (sem recortar), JPEG. Se não for imagem, devolve o original. */
export async function reduzirFoto(arq: File, lado = 800, qualidade = .82): Promise<Blob> {
  const url = URL.createObjectURL(arq);
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = url; });
    const k = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>(ok => c.toBlob(b => ok(b ?? arq), 'image/jpeg', qualidade));
  } catch { return arq; } finally { URL.revokeObjectURL(url); }
}

async function reduzir(arq: File): Promise<Blob> {
  const url = URL.createObjectURL(arq);
  try {
    // tenta ler como imagem
    const img = await new Promise<HTMLImageElement>((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = url; });
    const lado = 300, k = Math.min(1, lado / Math.min(img.naturalWidth, img.naturalHeight));
    // recorte quadrado no centro
    const s = Math.min(img.naturalWidth, img.naturalHeight), c = document.createElement('canvas');
    c.width = c.height = Math.round(s * k);
    c.getContext('2d')!.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, c.width, c.height);
    return await new Promise<Blob>((ok) => c.toBlob(b => ok(b ?? arq), 'image/jpeg', .86)); // se não gerou blob, retorna o arquivo original
  } catch {
    return arq; // não é imagem, retorna o original
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Escolher ou trocar a foto do perfil. */
export function FotoConta({ perfil, pronto, titulo = 'Foto do perfil', compacto }: { perfil: Perfil; pronto: () => void; titulo?: string; compacto?: boolean }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const escolher = async (arq?: File) => {
    if (!arq) return;
    setMsg(null);
    if (!arq.type.startsWith('image/') && !/\.(heic|heif|jpe?g|png|webp)$/i.test(arq.name)) return setMsg('Escolha uma imagem (JPG, PNG, HEIC…).');
    setEnviando(true);
    try {
      const blob = await reduzir(arq).catch(() => arq); // se o navegador não conseguir reduzir (ex.: HEIC), sobe a original (até 5 MB)
      const ext = blob === arq ? (arq.name.split('.').pop() || 'jpg').toLowerCase() : 'jpg';
      const caminho = `${perfil.user_id}/${Date.now()}.${ext}`;
      const { error } = await sb.storage.from('avatares').upload(caminho, blob, { contentType: blob.type || 'image/jpeg', upsert: true, cacheControl: '31536000' });
      if (error) throw error;
      const url = sb.storage.from('avatares').getPublicUrl(caminho).data.publicUrl;
      const { error: e2 } = await sb.from('radar_perfis').update({ foto_url: url }).eq('user_id', perfil.user_id);
      if (e2) throw e2;
      // apaga a foto anterior
      const antiga = perfil.foto_url?.split('/avatares/')[1];
      if (antiga && antiga !== caminho) sb.storage.from('avatares').remove([decodeURIComponent(antiga)]).catch(() => null);
      setMsg('Foto salva!'); pronto();
    } catch { setMsg('Não deu para enviar a foto agora. Tente de novo.'); }
    setEnviando(false);
  };
  if (compacto) return (
    <section className="pro-foto-topo">
      <button className="pro-foto-topo-av" disabled={enviando} onClick={() => entrada.current?.click()} aria-label={perfil.foto_url ? 'Trocar foto do perfil' : 'Escolher foto do perfil'}>
        <Avatar foto={perfil.foto_url} apelido={perfil.apelido} tam={64} />
        <span className="pro-foto-topo-cam" aria-hidden="true"><Camera size={14} /></span>
      </button>
      <div>
        <b>@{perfil.apelido}</b>
        <button className="btn text pro-btn-p" disabled={enviando} onClick={() => entrada.current?.click()}>{enviando ? 'Enviando…' : perfil.foto_url ? 'Trocar foto' : 'Colocar foto'}</button>
        {msg && <small className={msg === 'Foto salva!' ? 'pro-ok' : 'ct-erro'} role="status">{msg}</small>}
      </div>
      <input ref={entrada} type="file" accept="image/*" hidden onChange={e => { escolher(e.target.files?.[0]); e.target.value = ''; }} />
    </section>
  );
  return (
    <section className="pro-card pro-foto-conta">
      <p className="pro-k cinza">{titulo}</p>
      <div className="pro-linha">
        <Avatar foto={perfil.foto_url} apelido={perfil.apelido} tam={84} />
        <div className="pro-foto-acoes">
          <button className="btn solid" disabled={enviando} onClick={() => entrada.current?.click()}><Camera size={18} aria-hidden="true" />{enviando ? 'Enviando…' : perfil.foto_url ? 'Trocar foto' : 'Escolher foto'}</button>
          <small className="fine">Opcional. Aparece no ranking e no seu perfil público.</small>
        </div>
      </div>
      <input ref={entrada} type="file" accept="image/*" hidden onChange={e => { escolher(e.target.files?.[0]); e.target.value = ''; }} />
      {msg && <p className={msg === 'Foto salva!' ? 'pro-ok' : 'ct-erro'} role="status">{msg}</p>}
    </section>
  );
}
