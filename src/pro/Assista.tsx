// "Assista agora": filmes e documentários de corrida em cards, como uma TV, e um card "Infantil".
// Só vídeos publicados no YouTube por quem tem os direitos (marcas, provas, federações, produtoras, canais oficiais infantis).
// O vídeo toca no player do próprio YouTube (nada passa pelo servidor do Radar) e só carrega quando a pessoa toca.
import { useState } from 'react';
import { ExternalLink, Play, Search, Tv, X } from 'lucide-react';
import { useVoltar } from './voltar';
import { chamar } from './sb';

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
  // ───────── Filmes (distribuidoras que publicam filmes completos e gratuitos no YouTube: NetMovies, Bigtime, Booh!, Swen)
  { id: 'anos2000', nome: 'Destaques de 2000 pra cá', sub: 'Dublados', itens: [
    yt('YMbsC2J1R2o', 'Réquiem para um Sonho', 'NetMovies Romance', '2000 · drama'),
    yt('W7tZgGcMPUg', 'Mortdecai: A Arte da Trapaça (Johnny Depp)', 'NetMovies Comédia', '2015 · comédia'),
    yt('JyRhwOohMnM', 'Quebrando Regras', 'NetMovies Suspense', '2008 · ação'),
    yt('CD4uTmJJ3Cg', 'Xangai (John Cusack)', 'NetMovies', '2010 · drama'),
    yt('zlmWuf84vO0', 'Super-Herói: O Filme', 'NetMovies', '2008 · comédia'),
    yt('cUTDW3YMuUM', 'Down a Dark Hall (Uma Thurman)', 'NetMovies Suspense', '2018 · suspense'),
    yt('A4dLYkekQuE', 'Halloween 2', 'Booh!', 'terror'),
    yt('itMbWPsjhiw', 'Walt Antes de Mickey', 'Bigtime Filmes', '2015 · drama'),
  ] },
  { id: 'acao', nome: 'Ação e aventura', itens: [
    yt('hqoRGV9uZeM', 'Jack Hunter e o Tesouro Perdido de Ugarit', 'Bigtime Filmes', '1 h 38'),
    yt('hwjM4IPs3ko', 'Jack Hunter e a Busca pela Tumba de Akhenaton', 'Bigtime Filmes', '1 h 38'),
    yt('UGQuwICI5do', 'Jack Hunter e a Estrela do Céu', 'Bigtime Filmes', '1 h 38'),
    yt('lP_CSU6AZUk', 'El Dorado: Em Busca da Cidade de Ouro', 'Bigtime Filmes', '1 h 39'),
    yt('08LBSgyAkcM', 'Eldorado 2: Em Busca do Templo Perdido', 'Bigtime Filmes', '1 h 33'),
    yt('3WKGfL7QCfo', 'A Lenda do Dragão', 'Bigtime Filmes', '2011'),
    yt('SClsIAfQkIs', 'City God', 'NetMovies Ação', '2010'),
    yt('jiB8Gef0r7w', 'A Máfia Não Perdoa', 'NetMovies', '1 h 47'),
    yt('jqU7zumuop0', 'Viagem ao Centro da Terra', 'NetMovies', '1 h 30'),
    yt('Thj9zryZ3fw', 'Komodo vs. Cobra', 'Bigtime Filmes', '2005'),
    yt('uW8BE6C67pw', 'Zona de Desastre', 'Bigtime Filmes', '2015'),
  ] },
  { id: 'comedia', nome: 'Comédia', itens: [
    yt('W7tZgGcMPUg', 'Mortdecai: A Arte da Trapaça', 'NetMovies Comédia', '2015'),
    yt('zlmWuf84vO0', 'Super-Herói: O Filme', 'NetMovies', '2008'),
    yt('VDFrQNZaqdI', 'Mayberry Man', 'NetMovies Comédia', '1 h 39'),
    yt('Vg1ZZOLH3U8', 'Atraídos pelo Perigo', 'NetMovies Comédia', '1 h 40'),
    yt('TvhOx7j2oZE', 'O Tesouro Perdido', 'NetMovies Comédia', '1 h 23'),
    yt('HaC3-lYPeGc', 'Todos os Cães do Natal', 'Bigtime Filmes', '1 h 42'),
  ] },
  { id: 'drama', nome: 'Drama', itens: [
    yt('YMbsC2J1R2o', 'Réquiem para um Sonho', 'NetMovies Romance', '2000'),
    yt('ohUup_43uXM', 'O Som da Alma', 'NetMovies', '2 h 10'),
    yt('itMbWPsjhiw', 'Walt Antes de Mickey', 'Bigtime Filmes', '2015'),
    yt('u5P9JKhQpkk', 'À Espreita do Mal', 'NetMovies Drama', '2019'),
    yt('YRFduLk_Enc', 'Em Busca da Graça', 'Bigtime Filmes', '2019'),
    yt('QaRHMXMWc-0', 'A História de Fátima', 'Bigtime Filmes', '2020'),
    yt('Fvuu3--B4-Q', 'O Lado Simples da Vida', 'NetMovies Romance', '2021'),
    yt('keOMnDi54W4', 'A Luz da Liberdade', 'Swen Family', '2 h 04'),
    yt('bUzNgEynP-8', 'The Arrival (Charlie Sheen)', 'NetMovies Drama', '1 h 50'),
  ] },
  { id: 'romance', nome: 'Romance', itens: [
    yt('AdufX1bQSMg', 'Encontrando o Amor em Nebraska (Diogo Morgado)', 'NetMovies Romance', '2016'),
    yt('u7af5ZGUnC4', 'Siga Seu Coração', 'NetMovies Romance', '2020'),
    yt('VUhCMCsKaNI', 'Uma Paixão Inesperada', 'NetMovies Comédia', '1 h 56'),
    yt('V-e9QMBZPgw', 'Questões de Família', 'NetMovies Romance', '1 h 58'),
    yt('ihFiUd34tYE', 'A Lição do Amor', 'NetMovies Família', '1 h 34'),
    yt('7xB_SRxJX7Q', 'Eu Vou Te Amar Além de Tudo', 'Bigtime Filmes', '1 h 28'),
    yt('wk1KZvwFEOE', 'Receitas de Amor', 'Bigtime Filmes', '2011'),
  ] },
  { id: 'terror', nome: 'Terror e suspense', itens: [
    yt('A4dLYkekQuE', 'Halloween 2', 'Booh!', '1 h 37'),
    yt('BvEpDvPm040', 'O Assassino do Alfabeto', 'Booh!', '2008'),
    yt('cUTDW3YMuUM', 'Down a Dark Hall (Uma Thurman)', 'NetMovies Suspense', '2018'),
    yt('x4nqPjoVuh8', 'Vivendo Entre Nós', 'Bigtime Filmes', '2018'),
    yt('YRbLaIwmbaM', 'Saturno 3 (Kirk Douglas)', 'Bigtime Filmes', '1980'),
    yt('CkXXM4HT-38', 'Intenções Ocultas', 'Bigtime Filmes', '2009'),
    yt('PnmUgYAisL4', 'A Garota Misteriosa', 'NetMovies Suspense', '1 h 51'),
    yt('HgDKffqYH_o', 'Contrato Vital', 'NetMovies Suspense', '1 h 33'),
  ] },
  { id: 'nacional', nome: 'Cinema nacional: Mazzaropi', sub: 'Clássicos brasileiros', itens: [
    yt('1X4U8ctaCso', 'Jeca Tatu', 'NetMovies Comédia', '1959'),
    yt('kSyi4gIN89g', 'Chofer de Praça', 'NetMovies Comédia', '1959'),
    yt('AMRJS1ivRsI', 'O Jeca e a Freira', 'NetMovies Comédia', '1 h 37'),
    yt('sgycDtk212Y', 'Jeca e Seu Filho Preto', 'NetMovies Comédia', '1978'),
    yt('rZ6r6ns5c1Y', 'No Paraíso das Solteironas', 'NetMovies Velho Oeste', '1 h 37'),
    yt('Lrb5nafnXXc', 'Meu Japão Brasileiro', 'NetMovies Velho Oeste', '1 h 39'),
    yt('g_7ZafdFlp4', 'Casinha Pequenina', 'NetMovies Família', '1 h 34'),
  ] },
  { id: 'faroeste', nome: 'Faroeste', itens: [
    yt('V5J53CAm7AY', 'Uma Longa Fila de Cruzes', 'NetMovies Velho Oeste', '1 h 37'),
    yt('kxasUAe1R4s', 'Um Dólar Entre os Dentes', 'NetMovies Velho Oeste', '1 h 26'),
    yt('iaax9HxpdQQ', 'Joe, o Pistoleiro', 'NetMovies Velho Oeste', '1 h 32'),
    yt('JLBWv93WLv4', 'Luta pela Liberdade', 'NetMovies Velho Oeste', '1 h 36'),
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
const fonteTxt = (x: Item) => `${x.canal} · YouTube${x.en ? ' · em inglês (ative a legenda em ⚙ no player)' : ''}`;

/** Aba "Assista" do menu de baixo. */
export function TelaAssista() {
  return <Sala titulo="Assista agora" caminho="assista" secoes={SECOES} hero={PT_HERO} infantil aba />;
}

function Sala({ titulo, caminho, secoes, hero, infantil = false, aba = false, fechar }: { titulo: string; caminho: string; secoes: Secao[]; hero: Item; infantil?: boolean; aba?: boolean; fechar?: () => void }) {
  const [tocando, setTocando] = useState<{ item: Item; secao: Secao } | null>(null);
  const [kids, setKids] = useState(false);
  useVoltar(!aba, () => fechar?.(), caminho);
  const secaoHero = secoes.find(s => s.itens.includes(hero)) ?? secoes[0];
  return (
    <div className={aba ? 'pro-assista pro-assista-aba' : 'pro-sobre pro-assista'} role={aba ? undefined : 'dialog'} aria-label={titulo}>
      <div className="pro-assista-topo">
        {!aba && <button className="btn text" onClick={fechar} aria-label="Voltar"><X size={22} aria-hidden="true" /></button>}
        <b><Tv size={20} aria-hidden="true" /> {titulo}</b>
      </div>
      <div className="pro-assista-hero" onClick={() => setTocando({ item: hero, secao: secaoHero })} role="button" tabIndex={0}>
        <img src={capa(hero)} alt="" />
        <div>{hero.aoVivo ? <span className="pro-assista-vivo"><i />AO VIVO</span> : <span className="pro-assista-vivo novo">EM DESTAQUE</span>}<h2>{hero.t}</h2><p>{hero.canal}{hero.d ? ` · ${hero.d}` : ''}</p><span className="pro-assista-play"><Play size={18} aria-hidden="true" /> Assistir</span></div>
      </div>
      {infantil && <BuscaYT tocar={(item, secao) => setTocando({ item, secao })} />}
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

const GENEROS = [
  ['Comédia', 'filme de comédia completo dublado'], ['Terror', 'filme de terror completo dublado'], ['Romance', 'filme de romance completo dublado'],
  ['Drama', 'filme de drama completo dublado'], ['Ação', 'filme de ação completo dublado'], ['Suspense', 'filme de suspense completo dublado'],
  ['Animação', 'filme de animação completo dublado'], ['Corrida', 'filme de corrida a pé completo'], ['Nacional', 'filme brasileiro completo'],
] as const;

/** Busca do YouTube: a pessoa pesquisa e assiste aqui mesmo (só vídeos que o dono deixa tocar fora do YouTube). */
function BuscaYT({ tocar }: { tocar: (x: Item, s: Secao) => void }) {
  const [q, setQ] = useState('');
  const [longo, setLongo] = useState(true);
  const [r, setR] = useState<{ itens?: Item[]; erro?: string; desligado?: boolean } | null>(null);
  const [indo, setIndo] = useState(false);
  const [genero, setGenero] = useState<string | null>(null);
  const rodar = async (termo: string, lg: boolean) => {
    if (termo.trim().length < 2 || indo) return;
    setIndo(true);
    const res = await chamar<{ itens?: { id: string; t: string; canal: string; aoVivo?: boolean }[]; desligado?: boolean }>('radar-youtube', { q: termo.trim(), longo: lg });
    setIndo(false);
    setR({ itens: (res.itens ?? []).map(x => ({ f: 'yt' as const, id: x.id, t: x.t, canal: x.canal, aoVivo: x.aoVivo })), erro: res.erro, desligado: res.desligado });
  };
  const buscar = (e?: React.FormEvent) => { e?.preventDefault(); setGenero(null); rodar(q, longo); };
  const porGenero = (g: typeof GENEROS[number]) => { setGenero(g[0]); setQ(''); setLongo(true); rodar(g[1], true); };
  const secao: Secao = { id: 'busca', nome: 'Resultados da busca', itens: r?.itens ?? [] };
  return (
    <div className="pro-assista-busca">
      <form onSubmit={buscar}>
        <Search size={18} aria-hidden="true" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar filme ou vídeo" aria-label="Buscar filme ou vídeo" enterKeyHint="search" />
        <button className="btn solid" disabled={q.trim().length < 2 || indo}>{indo ? '…' : 'Buscar'}</button>
      </form>
      <div className="pro-assista-generos" role="group" aria-label="Gêneros">
        {GENEROS.map(g => <button key={g[0]} className={genero === g[0] ? 'on' : ''} onClick={() => porGenero(g)} disabled={indo}>{g[0]}</button>)}
      </div>
      <div className="pro-assista-filtro" role="group" aria-label="Tipo">
        <button className={longo ? 'on' : ''} onClick={() => setLongo(true)}>Filmes (longos)</button>
        <button className={!longo ? 'on' : ''} onClick={() => setLongo(false)}>Tudo</button>
      </div>
      {r?.desligado && <p className="pro-assista-aviso">A busca ainda está sendo ativada. Volte daqui a pouco.</p>}
      {r?.erro && <p className="pro-assista-aviso">{r.erro}</p>}
      {r?.itens && !r.itens.length && !r.erro && !r.desligado && <p className="pro-assista-aviso">Nada encontrado. Tente outro nome.</p>}
      {!!r?.itens?.length && (
        <section className="pro-assista-secao">
          <h3>{genero ?? 'Resultados'}<small>{r.itens.length} vídeos</small></h3>
          <div className="pro-assista-grade">
            {r.itens.map(x => (
              <button key={x.id} className="pro-assista-card" onClick={() => tocar(x, secao)}>
                <span className="pro-assista-capa"><img src={capa(x)} alt="" loading="lazy" /><i><Play size={16} aria-hidden="true" /></i>{x.aoVivo && <em>AO VIVO</em>}</span>
                <b>{x.t}</b><small>{x.canal}</small>
              </button>
            ))}
          </div>
        </section>
      )}
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
