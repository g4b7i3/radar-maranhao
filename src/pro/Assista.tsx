// "Assista agora": desenhos e filmes em cards, como uma TV. Só fontes legais:
//  - YouTube: vídeos dos canais OFICIAIS (Galinha Pintadinha, Mundo Bita, Peppa Pig BR, Show da Luna, Masha e o Urso, Turma da Mônica).
//  - Internet Archive: desenhos e filmes antigos em domínio público.
// O vídeo toca no player do próprio YouTube/Archive (nada passa pelo servidor do Radar) e só carrega quando a pessoa toca.
import { useState } from 'react';
import { ExternalLink, Play, Tv, X } from 'lucide-react';
import { useVoltar } from './voltar';

type Fonte = 'yt' | 'ia';
type Item = { f: Fonte; id: string; t: string; d?: string; canal?: string; aoVivo?: boolean };
type Secao = { id: string; nome: string; sub?: string; itens: Item[] };

const yt = (id: string, t: string, canal: string, d?: string, aoVivo = false): Item => ({ f: 'yt', id, t, canal, d, aoVivo });
const ia = (id: string, t: string, d?: string): Item => ({ f: 'ia', id, t, d });

const SECOES: Secao[] = [
  { id: 'aovivo', nome: 'Ao vivo agora', sub: 'Canal 24 horas', itens: [
    yt('OxvEX_G9LEI', 'Masha e o Urso · todos os melhores episódios', 'Masha e o Urso', '24 horas no ar', true),
  ] },
  { id: 'corrida', nome: 'Corrida em desenho', sub: 'Para correr junto com os pequenos', itens: [
    yt('fW_6ls9Rpqw', 'Papai Pig corre a Maratona de Londres', 'Peppa Pig Brasil', '2 h'),
    yt('j_7Kb6-govA', 'Treinando para a maratona', 'Peppa Pig Brasil', '2 h'),
    yt('_Whe25hRPI0', 'Peppa corre contra Rebecca: mini maratona', 'Peppa Pig Brasil', '2 h'),
  ] },
  { id: 'desenhos', nome: 'Desenhos', sub: 'Canais oficiais', itens: [
    yt('optbgi5LAB0', 'Galinha Pintadinha Mini · Episódio 1', 'Galinha Pintadinha', '12 min'),
    yt('3QLmXNSbA08', 'Galinha Pintadinha Mini · Episódio 2', 'Galinha Pintadinha', '12 min'),
    yt('JLfghDvWgTE', 'Galinha Pintadinha Mini · Episódio 3', 'Galinha Pintadinha', '12 min'),
    yt('dnOUR9ItBXo', 'Masha e o Urso · 1 hora de desenhos', 'Masha e o Urso', '1 h'),
    yt('-enPKaQPML4', 'Masha e o Urso · Curtir ou não curtir?', 'Masha e o Urso', '30 min'),
    yt('Nh_G9ZxGuQg', 'O Show da Luna · Maratona Sentimentos e Emoções', 'O Show da Luna!'),
    yt('nBTMLY0rABg', 'O Show da Luna · Maratona Chove Chuva', 'O Show da Luna!'),
    yt('EB2JdutJPvE', 'O Show da Luna · Maratona Forças Invisíveis', 'O Show da Luna!'),
    yt('YBxdLSwPmEM', 'Peppa Pig · A fábrica de donuts', 'Peppa Pig Brasil', '2 h'),
    yt('jJyIGdoqT1Q', 'Peppa Pig · Férias num navio de cruzeiro', 'Peppa Pig Brasil', '2 h'),
    yt('T6WGzj4rFU0', 'Turma da Mônica · WebTira Denise, cap. 35', 'Turma da Mônica'),
  ] },
  { id: 'musica', nome: 'Música para os pequenos', itens: [
    yt('8b8MX2TpCaQ', 'Bita e os Animais · álbum completo', 'Mundo Bita', '27 min'),
    yt('DqLrNhru-qE', 'Bita e as Brincadeiras · álbum completo', 'Mundo Bita', '31 min'),
    yt('kMyFG81dF70', 'Bita e o Corpo Humano · álbum completo', 'Mundo Bita', '33 min'),
    yt('l_F72X5FjBw', 'Bita e a Natureza · álbum completo', 'Mundo Bita', '34 min'),
    yt('uF9Qd34zZK8', 'Bita e os Sentimentos · álbum completo', 'Mundo Bita', '22 min'),
  ] },
  { id: 'classicos', nome: 'Desenhos clássicos', sub: 'Domínio público', itens: [
    ia('superman_the_mechanical_monsters', 'Superman: Os Monstros Mecânicos', '1941 · 9 min'),
    ia('superman_electric_earthquake', 'Superman: Terremoto Elétrico', '1942 · 9 min'),
    ia('superman_eleventh_hour', 'Superman: A Décima Primeira Hora', '1942 · 8 min'),
    ia('popeye_patriotic_popeye', 'Popeye patriota', '1957 · 6 min'),
    ia('popeye_big_bad_sinbad', 'Popeye contra Simbad', '1952 · 6 min'),
    ia('popeye_taxi-turvey', 'Popeye taxista', '1954 · 6 min'),
    ia('noveltoon_casper_tfg_theres_good_boos_tonight', 'Gasparzinho, o fantasminha camarada', '1948 · 8 min'),
    ia('woody_woodpecker_pantry_panic', 'Pica-Pau: Pânico na despensa', '1941 · 7 min'),
    ia('felix_the_cat_the_goos_that_laid_the_golden_egg', 'Gato Félix: A gansa dos ovos de ouro', '1936 · 7 min'),
    ia('mighty_mouse_wolf_wolf', 'Super Mouse: Lobo! Lobo!', '7 min'),
    ia('little_lulu_bargain_counter_attack', 'Luluzinha na liquidação', '1946 · 8 min'),
    ia('Betty_Boop_for_President_1932', 'Betty Boop para presidente', '1932 · 6 min'),
    ia('RudolphTheRed-nosedReindeer1948', 'Rudolph, a rena do nariz vermelho', '1948 · 8 min'),
    ia('gullivers_travels1939', 'As Viagens de Gulliver (filme)', '1939 · 1 h 12'),
  ] },
  { id: 'filmes', nome: 'Filmes clássicos', sub: 'Domínio público', itens: [
    ia('CC_1917_06_17_TheImmigrant', 'Chaplin: O Imigrante', '1917'),
    ia('CC_1916_10_02_ThePawnshop', 'Chaplin: O Prestamista', '1916'),
    ia('CC_1916_12_04_TheRink', 'Chaplin: O Patinador', '1916'),
    ia('CC_1917_04_16_TheCure', 'Chaplin: A Cura', '1917'),
    ia('The_General_Buster_Keaton', 'Buster Keaton: A General', '1926'),
    ia('steamboat_bill_ipod', 'Buster Keaton: Marinheiro de Encomenda', '1928'),
    ia('Cops1922', 'Buster Keaton: Polícias', '1922'),
    ia('OneWeek', 'Buster Keaton: Uma Semana', '1920'),
    ia('Levoyagedanslalune', 'Viagem à Lua (Méliès)', '1902'),
    ia('markofzorro-1920', 'A Marca do Zorro', '1920'),
    ia('FairbanksRobinHood1922', 'Robin Hood', '1922'),
    ia('ThiefOfBagdad1924', 'O Ladrão de Bagdá', '1924'),
    ia('JungleBook', 'Mogli, o Menino Lobo', '1942'),
    ia('little_princess', 'A Princesinha (Shirley Temple)', '1939'),
    ia('20000LeaguesUndertheSea', '20.000 Léguas Submarinas', '1916'),
  ] },
];

const capa = (x: Item) => x.f === 'yt' ? `https://i.ytimg.com/vi/${x.id}/hqdefault.jpg` : `https://archive.org/services/img/${encodeURIComponent(x.id)}`;
const player = (x: Item) => x.f === 'yt'
  ? `https://www.youtube-nocookie.com/embed/${x.id}?autoplay=1&playsinline=1&rel=0&modestbranding=1`
  : `https://archive.org/embed/${encodeURIComponent(x.id)}?autoplay=1`;
const fora = (x: Item) => x.f === 'yt' ? `https://www.youtube.com/watch?v=${x.id}` : `https://archive.org/details/${encodeURIComponent(x.id)}`;
const fonteTxt = (x: Item) => x.f === 'yt' ? `Canal oficial ${x.canal} · YouTube` : 'Domínio público · Internet Archive';

/** Faixa que fica no topo do feed e abre a sala. */
export function FaixaAssista() {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button className="pro-assista-faixa" onClick={() => setAberto(true)}>
        <span className="pro-assista-faixa-ic"><Tv size={22} aria-hidden="true" /></span>
        <span><b>Assista agora</b><small>Desenhos, canal ao vivo e filmes clássicos</small></span>
        <span className="pro-assista-vivo"><i />AO VIVO</span>
      </button>
      {aberto && <SalaAssista fechar={() => setAberto(false)} />}
    </>
  );
}

function SalaAssista({ fechar }: { fechar: () => void }) {
  const [tocando, setTocando] = useState<{ item: Item; secao: Secao } | null>(null);
  useVoltar(true, fechar, 'assista');
  return (
    <div className="pro-sobre pro-assista" role="dialog" aria-label="Assista agora">
      <div className="pro-assista-topo">
        <button className="btn text" onClick={fechar} aria-label="Voltar"><X size={22} aria-hidden="true" /></button>
        <b><Tv size={20} aria-hidden="true" /> Assista agora</b>
      </div>
      <div className="pro-assista-hero" onClick={() => setTocando({ item: SECOES[0].itens[0], secao: SECOES[0] })} role="button" tabIndex={0}>
        <img src={capa(SECOES[0].itens[0])} alt="" />
        <div><span className="pro-assista-vivo"><i />AO VIVO</span><h2>{SECOES[0].itens[0].t}</h2><p>{SECOES[0].itens[0].canal} · 24 horas</p><span className="pro-assista-play"><Play size={18} aria-hidden="true" /> Assistir</span></div>
      </div>
      {SECOES.slice(1).map(s => (
        <section key={s.id} className="pro-assista-secao">
          <h3>{s.nome}{s.sub && <small>{s.sub}</small>}</h3>
          <div className="pro-assista-trilho">
            {s.itens.map(x => (
              <button key={x.id} className="pro-assista-card" onClick={() => setTocando({ item: x, secao: s })}>
                <span className="pro-assista-capa"><img src={capa(x)} alt="" loading="lazy" /><i><Play size={16} aria-hidden="true" /></i>{x.d && <em>{x.d}</em>}</span>
                <b>{x.t}</b>
                <small>{x.f === 'yt' ? x.canal : 'Domínio público'}</small>
              </button>
            ))}
          </div>
        </section>
      ))}
      <p className="fine pro-centro pro-assista-nota">Vídeos dos canais oficiais no YouTube e obras em domínio público do Internet Archive. Os anúncios, quando aparecem, são do YouTube.</p>
      {tocando && <Player item={tocando.item} secao={tocando.secao} trocar={item => setTocando(t => t && { ...t, item })} fechar={() => setTocando(null)} />}
    </div>
  );
}

function Player({ item, secao, trocar, fechar }: { item: Item; secao: Secao; trocar: (x: Item) => void; fechar: () => void }) {
  useVoltar(true, fechar, `assista/${item.id}`);
  const outros = secao.itens.filter(x => x.id !== item.id);
  return (
    <div className="pro-sobre pro-assista pro-assista-tocando" role="dialog" aria-label={item.t}>
      <div className="pro-assista-topo">
        <button className="btn text" onClick={fechar} aria-label="Fechar"><X size={22} aria-hidden="true" /></button>
        <b>{secao.nome}</b>
      </div>
      <div className="pro-assista-tela">
        <iframe key={item.id} src={player(item)} title={item.t} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      </div>
      <div className="pro-assista-info">
        {item.aoVivo && <span className="pro-assista-vivo"><i />AO VIVO</span>}
        <h2>{item.t}</h2>
        <p>{fonteTxt(item)}{item.d ? ` · ${item.d}` : ''}</p>
        <a className="btn outline" href={fora(item)} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} aria-hidden="true" /> Não carregou? Abrir {item.f === 'yt' ? 'no YouTube' : 'no Archive'}</a>
      </div>
      {outros.length > 0 && <>
        <h3 className="pro-assista-mais">Mais em {secao.nome}</h3>
        <div className="pro-assista-lista">
          {outros.map(x => (
            <button key={x.id} onClick={() => trocar(x)}>
              <span className="pro-assista-capa"><img src={capa(x)} alt="" loading="lazy" />{x.d && <em>{x.d}</em>}</span>
              <span><b>{x.t}</b><small>{x.f === 'yt' ? x.canal : 'Domínio público'}</small></span>
            </button>
          ))}
        </div>
      </>}
    </div>
  );
}
