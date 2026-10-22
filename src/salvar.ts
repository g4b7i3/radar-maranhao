// Salvar imagem (cards e stories) do mesmo jeito em todo celular, no navegador ou no app instalado.
// Android: baixa e mostra "Imagem salva · Abrir" na tela (o app instalado não mostra a barra de download).
// iPhone/iPad: o download não vai pra galeria; abre a folha de compartilhar, onde "Salvar imagem" é um toque.
// "Abrir" mostra a foto em tela cheia dentro do app, com botão de compartilhar/salvar.

const IOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

let css = false;
function estilo() {
  if (css) return; css = true;
  const s = document.createElement('style');
  s.textContent = `
.sv-toast{position:fixed;left:50%;bottom:calc(84px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:9000;display:flex;align-items:center;gap:12px;padding:12px 14px 12px 16px;border-radius:999px;background:#0f1a33;color:#fff;font:600 .95rem/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.35);max-width:calc(100vw - 32px);animation:sv-sobe .25s ease-out}
.sv-toast span{white-space:nowrap}
.sv-toast b{color:#7ef0b2;font-weight:800}
.sv-toast button{border:0;border-radius:999px;padding:8px 14px;font:700 .9rem system-ui,-apple-system,"Segoe UI",sans-serif;background:#ffd34d;color:#0f1a33;cursor:pointer}
.sv-toast .sv-x{background:none;color:#aab4cc;padding:6px 4px}
.sv-ver{position:fixed;inset:0;z-index:9001;background:#000;display:flex;flex-direction:column;animation:sv-aparece .2s ease-out}
.sv-ver img{flex:1;min-height:0;width:100%;object-fit:contain;touch-action:pinch-zoom;-webkit-user-select:none;user-select:none}
.sv-ver .sv-barra{display:flex;gap:10px;padding:12px 16px calc(14px + env(safe-area-inset-bottom));background:#0f1a33}
.sv-ver .sv-barra button{flex:1;border:0;border-radius:14px;padding:14px;font:700 1rem system-ui,-apple-system,"Segoe UI",sans-serif;cursor:pointer}
.sv-ver .sv-share{background:#ffd34d;color:#0f1a33}
.sv-ver .sv-fechar{background:#273352;color:#fff}
.sv-ver .sv-dica{margin:0;padding:10px 16px 0;color:#aab4cc;font:.85rem/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center;background:#0f1a33}
@keyframes sv-sobe{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}
@keyframes sv-aparece{from{opacity:0}to{opacity:1}}`;
  document.head.appendChild(s);
}

async function compartilharArquivo(url: string, nome: string): Promise<boolean> {
  try {
    const b = await (await fetch(url)).blob();
    const f = new File([b], nome, { type: b.type || 'image/jpeg' });
    if (navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f] }); return true; }
  } catch (e) { if ((e as Error).name === 'AbortError') return true; }
  return false;
}

/** Mostra a imagem em tela cheia dentro do app, com Compartilhar/Salvar e Fechar. */
export function abrirImagem(url: string, nome: string) {
  estilo();
  const v = document.createElement('div'); v.className = 'sv-ver'; v.setAttribute('role', 'dialog'); v.setAttribute('aria-label', 'Imagem salva');
  const img = document.createElement('img'); img.src = url; img.alt = nome;
  const dica = document.createElement('p'); dica.className = 'sv-dica';
  dica.textContent = IOS ? 'Toque em Salvar e escolha "Salvar imagem" pra ela ir pra Fotos.' : 'Já está na sua galeria (pasta Downloads). Toque e segure pra salvar de novo.';
  const barra = document.createElement('div'); barra.className = 'sv-barra';
  const share = document.createElement('button'); share.className = 'sv-share'; share.textContent = IOS ? 'Salvar / compartilhar' : 'Compartilhar';
  const fechar = document.createElement('button'); fechar.className = 'sv-fechar'; fechar.textContent = 'Fechar';
  share.onclick = async () => { if (!(await compartilharArquivo(url, nome))) window.open(url, '_blank'); };
  fechar.onclick = () => v.remove();
  barra.append(share, fechar); v.append(img, dica, barra); document.body.appendChild(v);
  if (!navigator.canShare) share.style.display = 'none';
}

let toast: HTMLDivElement | null = null;
function avisar(url: string, nome: string) {
  estilo(); toast?.remove();
  const t = document.createElement('div'); t.className = 'sv-toast'; t.setAttribute('role', 'status');
  const txt = document.createElement('span'); txt.innerHTML = '<b>✓</b> Imagem salva';
  const abrir = document.createElement('button'); abrir.textContent = 'Abrir'; abrir.onclick = () => { t.remove(); abrirImagem(url, nome); };
  const x = document.createElement('button'); x.className = 'sv-x'; x.textContent = '✕'; x.setAttribute('aria-label', 'Fechar'); x.onclick = () => t.remove();
  t.append(txt, abrir, x); document.body.appendChild(t); toast = t;
  setTimeout(() => { if (toast === t) t.remove(); }, 12_000);
}

/** Salva a imagem no celular e avisa na tela. `url` é o blob URL já gerado; `nome` é o nome do arquivo. */
export async function salvarImagem(url: string, nome: string) {
  if (!url) return;
  if (IOS) { // iPhone não tem download pra galeria: vai direto pra folha de compartilhar ("Salvar imagem")
    if (await compartilharArquivo(url, nome)) return;
    abrirImagem(url, nome); return;
  }
  const a = document.createElement('a'); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  avisar(url, nome);
}
