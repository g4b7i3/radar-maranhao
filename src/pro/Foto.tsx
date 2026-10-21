// Foto de perfil do Radar Pro: obrigatória, até 5 MB. Antes de enviar, o app reduz para 600 px (sobe rápido e ocupa pouco).
import { useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { sb, type Perfil } from './sb';

const MAX = 5 * 1024 * 1024;

/** Foto redonda do atleta (ou a inicial do apelido, se ainda não tiver foto). */
export function Avatar({ foto, apelido, tam = 40 }: { foto?: string | null; apelido: string; tam?: number }) {
  const [erro, setErro] = useState(false);
  if (foto && !erro) return <img className="pro-avatar" src={foto} alt="" width={tam} height={tam} loading="lazy" onError={() => setErro(true)} style={{ width: tam, height: tam }} />;
  return <span className="pro-avatar pro-avatar-vazio" style={{ width: tam, height: tam, fontSize: tam * .42 }} aria-hidden="true">{(apelido || '?').slice(0, 1).toUpperCase()}</span>;
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

async function reduzir(arq: File): Promise<Blob> {
  const url = URL.createObjectURL(arq);
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = url; });
    const lado = 600, k = Math.min(1, lado / Math.min(img.naturalWidth, img.naturalHeight));
    // recorte quadrado no centro
    const s = Math.min(img.naturalWidth, img.naturalHeight), c = document.createElement('canvas');
    c.width = c.height = Math.round(s * k);
    c.getContext('2d')!.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, c.width, c.height);
    return await new Promise<Blob>((ok, erro) => c.toBlob(b => b ? ok(b) : erro(new Error('falhou')), 'image/jpeg', .86));
  } finally { URL.revokeObjectURL(url); }
}

/** Escolher ou trocar a foto do perfil. */
export function FotoConta({ perfil, pronto, titulo = 'Foto do perfil' }: { perfil: Perfil; pronto: () => void; titulo?: string }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const escolher = async (arq?: File) => {
    if (!arq) return;
    setMsg(null);
    if (!arq.type.startsWith('image/') && !/\.(heic|heif|jpe?g|png|webp)$/i.test(arq.name)) return setMsg('Escolha uma foto (JPG, PNG ou HEIC).');
    if (arq.size > MAX) return setMsg(`Essa foto tem ${(arq.size / 1024 / 1024).toFixed(1).replace('.', ',')} MB. O limite é 5 MB: escolha outra ou mande um print dela.`);
    setEnviando(true);
    try {
      const blob = await reduzir(arq).catch(() => arq); // se o navegador não conseguir reduzir (ex.: HEIC), sobe a original (até 5 MB)
      const ext = blob === arq ? (arq.name.split('.').pop() || 'jpg').toLowerCase() : 'jpg';
      const caminho = `${perfil.user_id}/${Date.now()}.${ext}`;
      const { error } = await sb.storage.from('avatares').upload(caminho, blob, { contentType: blob.type || 'image/jpeg', upsert: true });
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
  return (
    <section className="pro-card pro-foto-conta">
      <p className="pro-k cinza">{titulo}</p>
      <div className="pro-linha">
        <Avatar foto={perfil.foto_url} apelido={perfil.apelido} tam={84} />
        <div className="pro-foto-acoes">
          <button className="btn solid" disabled={enviando} onClick={() => entrada.current?.click()}><Camera size={18} aria-hidden="true" />{enviando ? 'Enviando…' : perfil.foto_url ? 'Trocar foto' : 'Escolher foto'}</button>
          <small className="fine">Até 5 MB. Aparece no ranking e no seu perfil público.</small>
        </div>
      </div>
      <input ref={entrada} type="file" accept="image/*" hidden onChange={e => { escolher(e.target.files?.[0]); e.target.value = ''; }} />
      {msg && <p className={msg === 'Foto salva!' ? 'pro-ok' : 'ct-erro'} role="status">{msg}</p>}
    </section>
  );
}
