// "Assista agora": filmes e documentários de corrida em cards, como uma TV, e um card "Infantil".
// Só vídeos publicados no YouTube por quem tem os direitos (marcas, provas, federações, produtoras, canais oficiais infantis).
// O vídeo toca no player do próprio YouTube (nada passa pelo servidor do Radar) e só carrega quando a pessoa toca.
import { useState } from 'react';
import { ExternalLink, Play, Tv, X } from 'lucide-react';
import { useVoltar } from './voltar';

type Fonte = 'yt';
type Item = { f: Fonte; id: string; t: string; d?: string; canal?: string; aoVivo?: boolean; en?: boolean };
type Secao = { id: string; nome: string; sub?: string; itens: Item[] };

const yt = (id: string, t: string, canal: string, d?: string, o: { aoVivo?: boolean; en?: boolean } = {}): Item => ({ f: 'yt', id, t, canal, d, ...o });
const EN = { en: true };

// Sala principal: filmes e documentários de corrida, só dos canais de quem fez (marcas, provas, federações, produtoras).
const PT_HERO = yt('5oDtotEdHEc', 'MENTAL: a escola queniana de corrida', 'Olympikus', '36 min');
const SECOES: Secao[] = [
  { id: 'pt', nome: 'Corrida em português', itens: [
    PT_HERO,
    yt('gdSbHVcD4Mw', 'Brutal: UTMB CCC 2024', 'Olympikus', '24 min'),
    yt('WEcErdCit14', 'A vida é uma maratona: os novos limites da longevidade', 'Drauzio Varella', '1 h 54'),
    yt('INiR6aXJwyg', '240 km na Brazil 135: minha primeira prova de três dígitos', 'Daniel Canny', '23 min'),
    yt('eyU1S5VT3Jo', 'Do zero à minha primeira maratona', 'Bruna Ianhez', '32 min'),
  ] },
  { id: 'filmes', nome: 'Filmes de corrida', sub: 'Filmes completos e gratuitos', itens: [
    yt('W6XqqFbVL9Q', 'Rumo à Vitória', 'NetMovies Família', '1 h 39 · dublado'),
    yt('6JL6SYxlaJk', 'Freerunner: Corra por Sua Vida', 'Swen Action', '1 h 27'),
    yt('nv97RBG9LJc', 'The Perfect Race', 'Christian Movies', '1 h 37', EN),
    yt('zH0EGqlb7eg', 'Remember the Goal', 'Christian Movies', '1 h 28', EN),
    yt('F2nO-6mzCF8', 'Run for the Dream: a história de Gail Devers', 'FilmRise Movies', '1 h 40', EN),
    yt('CMK7e7uP-TY', 'Run for Your Life: a criação da Maratona de Nova York', 'Popcornflix', '1 h 35', EN),
    yt('cVdhRdehw9M', 'The Long Green Line: cross-country', 'Indie Rights Movies', '1 h 30', EN),
  ] },
  { id: 'ultra', nome: 'Ultramaratona e trail', sub: 'Filmes completos', itens: [
    yt('zy1as6CTYXI', 'Unbreakable: The Western States 100', 'Journeyfilm', '1 h 46', EN),
    yt('MbXwKTZoLQ4', 'Walmsley: o filme', 'Wahoo Fitness', '1 h 34', EN),
    yt('herA1iwUW8k', 'Conquistando o Mont-Blanc: o caminho até o UTMB', 'HOKA UTMB Mont-Blanc', '52 min', EN),
    yt('JOhQGe-tRPA', 'The Mirage: a corrida de Timothy Olson contra o tempo', 'National Geographic', '1 h', EN),
    yt('k0HkYULFVvA', 'The Chase: Cocodona 250', 'Aravaipa Running', '1 h 51', EN),
    yt('5ciEqPZsOCs', 'Transamericana: 6.000 km correndo pelos EUA', 'Salomon TV', '1 h 15', EN),
    yt('a5LJ36lFJuw', 'Running Out: 231 km na trilha Larapinta', 'Salomon TV', '43 min', EN),
    yt('yqOIPKt4m2Q', 'Courtney Dauwalter e François D’haene no Hardrock', 'Salomon TV', '52 min', EN),
    yt('r6O5vI0cmAI', 'François D’haene no Tor des Géants', 'Salomon TV', '29 min', EN),
    yt('PgTEsybXw-4', 'The Finisher: Jasmin Paris e a Barkley Marathons', 'Singletrack', '47 min', EN),
    yt('XOmCLl1z7c0', 'Kilian Jornet: desenhando o futuro', 'NNormal', '45 min', EN),
  ] },
  { id: 'maratona', nome: 'Maratona e pista', itens: [
    yt('k-XgKRJUEgQ', 'INEOS 1:59: Kipchoge abaixo de 2 horas (corrida completa)', 'INEOS 1:59 Challenge', '3 h 32', EN),
    yt('6rMjOzO5td0', 'O caminho até Viena: documentário do 1:59', 'INEOS 1:59 Challenge', '18 min', EN),
    yt('CGnL0c-g2rI', 'O homem mais rápido do mundo: Usain Bolt', 'Olympic Games', '18 min', EN),
    yt('ZhVl_gqnjxs', 'Ferro afia ferro: os bastidores de um grupo de treino', 'World Athletics', '45 min', EN),
    yt('tPM6UJFGkTs', 'Feito para a velocidade: a história de Letsile Tebogo', 'World Athletics', '18 min', EN),
  ] },
];

// Infantil: só abre pelo card "Infantil" (canais oficiais em português)
const INFANTIL: Secao[] = [
  { id: 'aovivo', nome: 'Ao vivo agora', sub: 'Canal 24 horas', itens: [
    yt('OxvEX_G9LEI', 'Masha e o Urso · todos os melhores episódios', 'Masha e o Urso', '24 horas no ar', { aoVivo: true }),
  ] },
  { id: 'corrida-kids', nome: 'Corrida em desenho', itens: [
    yt('fW_6ls9Rpqw', 'Papai Pig corre a Maratona de Londres', 'Peppa Pig Brasil', '2 h'),
    yt('j_7Kb6-govA', 'Treinando para a maratona', 'Peppa Pig Brasil', '2 h'),
    yt('_Whe25hRPI0', 'Peppa corre contra Rebecca: mini maratona', 'Peppa Pig Brasil', '2 h'),
  ] },
  { id: 'desenhos', nome: 'Desenhos', itens: [
    yt('optbgi5LAB0', 'Galinha Pintadinha Mini · Episódio 1', 'Galinha Pintadinha', '12 min'),
    yt('3QLmXNSbA08', 'Galinha Pintadinha Mini · Episódio 2', 'Galinha Pintadinha', '12 min'),
    yt('JLfghDvWgTE', 'Galinha Pintadinha Mini · Episódio 3', 'Galinha Pintadinha', '12 min'),
    yt('dnOUR9ItBXo', 'Masha e o Urso · 1 hora de desenhos', 'Masha e o Urso', '1 h'),
    yt('Nh_G9ZxGuQg', 'O Show da Luna · Maratona Sentimentos e Emoções', 'O Show da Luna!'),
    yt('nBTMLY0rABg', 'O Show da Luna · Maratona Chove Chuva', 'O Show da Luna!'),
    yt('YBxdLSwPmEM', 'Peppa Pig · A fábrica de donuts', 'Peppa Pig Brasil', '2 h'),
    yt('T6WGzj4rFU0', 'Turma da Mônica · WebTira Denise', 'Turma da Mônica'),
  ] },
  { id: 'musica', nome: 'Música', itens: [
    yt('8b8MX2TpCaQ', 'Bita e os Animais · álbum completo', 'Mundo Bita', '27 min'),
    yt('DqLrNhru-qE', 'Bita e as Brincadeiras · álbum completo', 'Mundo Bita', '31 min'),
    yt('kMyFG81dF70', 'Bita e o Corpo Humano · álbum completo', 'Mundo Bita', '33 min'),
    yt('l_F72X5FjBw', 'Bita e a Natureza · álbum completo', 'Mundo Bita', '34 min'),
  ] },
];

const capa = (x: Item) => `https://i.ytimg.com/vi/${x.id}/hqdefault.jpg`;
const player = (x: Item) => `https://www.youtube-nocookie.com/embed/${x.id}?autoplay=1&playsinline=1&rel=0&modestbranding=1${x.en ? '&cc_load_policy=1&cc_lang_pref=pt&hl=pt' : ''}`;
const fora = (x: Item) => `https://www.youtube.com/watch?v=${x.id}`;
const fonteTxt = (x: Item) => `Canal ${x.canal} · YouTube${x.en ? ' · em inglês (ative a legenda em ⚙ no player)' : ''}`;

/** Faixa que fica no topo do feed e abre a sala. */
export function FaixaAssista() {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button className="pro-assista-faixa" onClick={() => setAberto(true)}>
        <span className="pro-assista-faixa-ic"><Tv size={22} aria-hidden="true" /></span>
        <span><b>Assista agora</b><small>Filmes e documentários de corrida · Infantil</small></span>
        <span className="pro-assista-vivo novo">NOVO</span>
      </button>
      {aberto && <SalaAssista fechar={() => setAberto(false)} />}
    </>
  );
}

function SalaAssista({ fechar }: { fechar: () => void }) {
  return <Sala titulo="Assista agora" caminho="assista" secoes={SECOES} hero={PT_HERO} infantil fechar={fechar} />;
}

function Sala({ titulo, caminho, secoes, hero, infantil = false, fechar }: { titulo: string; caminho: string; secoes: Secao[]; hero: Item; infantil?: boolean; fechar: () => void }) {
  const [tocando, setTocando] = useState<{ item: Item; secao: Secao } | null>(null);
  const [kids, setKids] = useState(false);
  useVoltar(true, fechar, caminho);
  const secaoHero = secoes.find(s => s.itens.includes(hero)) ?? secoes[0];
  return (
    <div className="pro-sobre pro-assista" role="dialog" aria-label={titulo}>
      <div className="pro-assista-topo">
        <button className="btn text" onClick={fechar} aria-label="Voltar"><X size={22} aria-hidden="true" /></button>
        <b><Tv size={20} aria-hidden="true" /> {titulo}</b>
      </div>
      <div className="pro-assista-hero" onClick={() => setTocando({ item: hero, secao: secaoHero })} role="button" tabIndex={0}>
        <img src={capa(hero)} alt="" />
        <div>{hero.aoVivo ? <span className="pro-assista-vivo"><i />AO VIVO</span> : <span className="pro-assista-vivo novo">EM DESTAQUE</span>}<h2>{hero.t}</h2><p>{hero.canal}{hero.d ? ` · ${hero.d}` : ''}</p><span className="pro-assista-play"><Play size={18} aria-hidden="true" /> Assistir</span></div>
      </div>
      {infantil && (
        <button className="pro-assista-kids" onClick={() => setKids(true)}>
          <img src={capa(INFANTIL[0].itens[0])} alt="" loading="lazy" />
          <span><b>Infantil</b><small>Desenhos e músicas em português · canal ao vivo</small></span>
          <Play size={20} aria-hidden="true" />
        </button>
      )}
      {secoes.map(s => (
        <section key={s.id} className="pro-assista-secao">
          <h3>{s.nome}{s.sub && <small>{s.sub}</small>}</h3>
          <div className="pro-assista-trilho">
            {s.itens.map(x => (
              <button key={x.id} className="pro-assista-card" onClick={() => setTocando({ item: x, secao: s })}>
                <span className="pro-assista-capa"><img src={capa(x)} alt="" loading="lazy" /><i><Play size={16} aria-hidden="true" /></i>{x.d && <em>{x.d}</em>}{x.en && <u>EN</u>}</span>
                <b>{x.t}</b>
                <small>{x.canal}</small>
              </button>
            ))}
          </div>
        </section>
      ))}
      <p className="fine pro-centro pro-assista-nota">Vídeos publicados no YouTube pelos próprios donos: marcas, provas, federações, produtoras e distribuidoras de filmes gratuitos. Os anúncios, quando aparecem, são do YouTube.</p>
      {tocando && <Player item={tocando.item} secao={tocando.secao} trocar={item => setTocando(t => t && { ...t, item })} fechar={() => setTocando(null)} />}
      {kids && <Sala titulo="Infantil" caminho="assista/infantil" secoes={INFANTIL} hero={INFANTIL[0].itens[0]} fechar={() => setKids(false)} />}
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
        <a className="btn outline" href={fora(item)} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} aria-hidden="true" /> Não carregou? Abrir no YouTube</a>
      </div>
      {outros.length > 0 && <>
        <h3 className="pro-assista-mais">Mais em {secao.nome}</h3>
        <div className="pro-assista-lista">
          {outros.map(x => (
            <button key={x.id} onClick={() => trocar(x)}>
              <span className="pro-assista-capa"><img src={capa(x)} alt="" loading="lazy" />{x.d && <em>{x.d}</em>}</span>
              <span><b>{x.t}</b><small>{x.canal}{x.en ? ' · EN' : ''}</small></span>
            </button>
          ))}
        </div>
      </>}
    </div>
  );
}
