# Pesquisa diária de provas

Instruções seguidas pela tarefa agendada que atualiza o Radar Corridas Maranhão todo dia às 8h (horário de São Luís). Servem também para quem for atualizar a agenda à mão.

## Objetivo

Encontrar corridas de rua e trail **no Maranhão** que foram anunciadas ou mudaram, registrar na agenda com fonte e avisar só quando houver novidade real.

## 0. Ler a coleta automática (comece por aqui)

De 2 em 2 horas (6h15 às 20h15) o GitHub Actions (`.github/workflows/coletar-plataformas.yml`) abre com navegador as plataformas que só funcionam com JavaScript e salva o texto em `coleta/`:

- `coleta/cronoesportes.json` — Crono Esportes (São Luís, Sesc, UEMA…): lista + página completa de cada prova (data, horário, largada, preços, "INSCRIÇÕES ENCERRADAS", "VAGAS ESGOTADAS").
- `coleta/sacrono.json` — SA Crono (Caxias, Coelho Neto, Coroatá, Barra do Corda…): lista + página de cada prova.
- `coleta/centraldacorrida.json` — Central da Corrida: lista nacional com data, cidade e status ("Inscreva-se", "Inscrições abertas", "Em breve", "Inscrições esgotadas"); pegue as linhas "- MA".
- `coleta/topchip.json` — calendário da Topchip (Imperatriz e região tocantina) até o ano seguinte; pegue as linhas "/ MA".
- `coleta/guardalugar.json` — GuardaLugar (sistema de inscrições/reservas usado por organizadores do Maranhão); confira as provas com `maranhao: true` e a página de cada evento.

Os calendários de terceiros que a sessão do Claude não consegue abrir (a rede da sessão bloqueia os sites) também vêm prontos, coletados no máximo a cada 8 horas:

- `coleta/roadrunners.json` — Road Runners (MA): lista do estado + página de cada prova; o campo `links` de cada prova traz os links externos (inscrição oficial, regulamento, Instagram).
- `coleta/runninglife.json` — running.life, páginas por cidade do Maranhão + página de cada prova, com `links` externos. Inclui cidades vizinhas de outros estados (Teresina/PI, Tocantinópolis/TO): confira a cidade.

- `coleta/sugestoes.json` — provas sugeridas pelo público no botão "Enviar uma corrida" do site (últimos 60 dias: `prova`, `cidade`, `data`, `link`, `obs`, `enviadaEm`). **Não são fonte**: para cada sugestão que ainda não está na agenda, procure a prova na web ou no link enviado e só inclua se confirmar; se não confirmar, cite a sugestão no resumo final ("Sugestões do site: …") com o que falta para conferir. Ignore sugestões fora do Maranhão ou que não sejam corrida.
- `coleta/oficiais.json` — a página oficial (`officialUrl`, e também `sourceUrl` quando for página da prova) de **todas** as provas futuras da agenda, inclusive as da SA Crono, Central da Corrida, Crono Esportes, Topchip e GuardaLugar, coletada no máximo a cada 6 horas pelo GitHub (que abre esses sites normalmente). Cada item traz até 20 mil caracteres de `texto`, os `links` externos (regulamento, GPX, Strava, mapas), em `pdfs` o texto dos regulamentos em PDF (inclusive do Google Drive) e, em `subpaginas`, o texto e os PDFs das páginas de inscrição ligadas a ela (Running Land, TF Sports, Ticket Sports, Sympla, Doity…). **Use este arquivo para premiação, altimetria, lotes e prazos: não tente abrir esses sites pelo WebFetch** (nightrun.com.br, runningland, tfsports, centraldacorrida, doity, sacrono e outros são bloqueados na sessão). Se uma página precisar ser lida e não estiver no arquivo, diga no resumo final qual é, para entrar na coleta.

Esses dois calendários servem para **descobrir** provas e mudanças; não são aplicados sozinhos na agenda. Para cada prova do Maranhão que não está na agenda, confirme pelo link oficial (campo `links`) ou por outra fonte; se só houver o calendário, registre como "Fonte única (calendário)".

O GitHub já aplica sozinho (`scripts/aplicar-coleta.mjs`) o status e as provas novas dessas plataformas; as novidades dele ficam pendentes de aviso (`npm run marcar-avisados`) — inclua-as no aviso do dia. Revise as provas que ele criou (nome, distâncias, local) e complete o que faltar. Compare com `public/data/radar.json`: prova nova, mudança de data/local/status (abertas → encerradas/esgotadas) entram pelo `npm run atualizar`. Confira `coletadoEm` de cada arquivo; se for de outro dia, a coleta falhou — siga só com a web e avise no resumo final. Ignore provas de outros estados (PI, TO, PA) e desafios virtuais.

## 1. Ler a agenda atual

Abra `public/data/radar.json`. Anote as provas que já existem (`id`, nome, cidade, edição) para não criar duplicatas.

## 2. Pesquisar

Fontes, em ordem de confiança:

1. Página ou regulamento do organizador e plataformas de inscrição: Central da Corrida, CronoEsportes, TicketSports, Running Land, PHB Crono, Doity, Sympla, Minhas Inscrições, MetaSport.
2. Órgãos e empresas organizadores (tribunais, portos, prefeituras, secretarias de esporte).
3. Notícias locais (Maranhão Esportes, portais de São Luís e Imperatriz) para descobrir links.
4. Calendários de terceiros (O2 Corre, Sou Corredor, Todas Corridas, CorridasBR): servem para descobrir provas, não para confirmar.

### Onde as provas do Maranhão realmente aparecem (testado em 14/10/2026)

Comece sempre pelos calendários, que juntos cobrem quase tudo, e depois confirme cada prova na página de inscrição:

| Fonte | Endereço | Observação |
| --- | --- | --- |
| **Road Runners (MA)** | https://roadrunners.run/estado/ma/ | Já vem pronto em `coleta/roadrunners.json`. **A fonte mais completa (50+ provas)**, puxa direto das plataformas de inscrição (Topchip, SA Crono, Doity, Sympla) e traz o link oficial de cada prova. Comece por aqui. |
| CorridasBR (MA) | https://www.corridasbr.com.br/MA/Calendario.asp | Lista mais completa do estado, inclusive cidades pequenas. As páginas de detalhe não abrem certo; use só a lista. |
| Vamu Correr | https://vamucorrer.com.br/corridas/maranhao | Traz o link de inscrição de cada prova. Já errou datas (ex.: Chapadinha). |
| running.life (por cidade) | https://running.life/running-calendar/brazil/maranhao/<cidade> | Já vem pronto em `coleta/runninglife.json` (20 cidades). **Use as páginas por cidade** (ex.: `/sao-luis`, `/imperatriz`, `/timon`, `/acailandia`, `/barra-do-corda`, `/coroata`, `/estreito`, `/chapadinha`, `/caxias`, `/joao-lisboa`). A página do estado só mostra as 20 primeiras. Cuidado: incluem cidades vizinhas de outros estados (Teresina/PI, Tocantinópolis/TO, Sítio Novo/TO). Cada página de prova traz o link oficial. |
| Sou Corredor (MA) | https://soucorredor.com.br/calendario?pais=31&localidade=nacional&estado=10 | Bom para São Luís; páginas de prova trazem local de largada. |
| GuardaLugar | https://guardalugar.com/evento/<código> | Plataforma de inscrição usada por organizadores do interior (ex.: 1ª VG Run, Vargem Grande). O site é um app e não abre texto: já vem pronto em `coleta/guardalugar.json` (campo `api`, lista pública de eventos com cidade, data, hora e descrição). |
| Topchip | https://topchip.com.br/<prova> | Cronometragem de Imperatriz e região tocantina. A lista geral não abre, mas cada página de prova abre (data, hora e status). |
| PHB Crono | https://phbcrono.com.br/ | Lista "Próximos eventos" com provas do leste do MA e Lençóis (trail). |
| SA Crono, Central da Corrida, Crono Esportes | — | Carregam por JavaScript: já vêm prontas em `coleta/` (passo 0). |
| Agenda Off Road | agendaoffroad.com.br | Provas e trails no leste do MA (Chapadinha, Timon). |
| Ticket Sports, Sympla, Doity | — | Páginas de prova abrem bem e mostram data, local e status (inclusive cancelamento). |
| Maranhão Esportes, O Imparcial, Imirante | — | Notícias com data de anúncio, local e entrega de kit. |

Armadilhas já encontradas: cidade homônima em outro estado (Paraíso Run é em São João do Paraíso/**BA**); evento que não é prova (PACER é programa de treino; Forge Beach é competição de fitness); prova cancelada que continua nos calendários (White Sand Running; Entre Mães Run 2026 de São Luís — o dono do Radar avisou em 19/10/2026 que ela não vai acontecer: não incluir de novo); a mesma prova com dois nomes (Corrida Sicoob = Hiper Farma, em Açailândia); data errada no CorridasBR (Corrida Unimed de Imperatriz é 29/11, não 20/11); cidade errada (Corrida da Saúde é em Presidente Vargas, não Dutra); distância inventada (BJ Running não tem 42 km) — a página da cronometragem vale mais que o calendário. Instagram não pode ser lido automaticamente; anúncios só de Instagram chegam pelo botão "Falta alguma corrida?" do site (WhatsApp do desenvolvedor). Prova vista em uma única fonte entra com `confidence` "Fonte única (calendário) · confirmar no organizador".

### Provas anuais para vigiar

Todo dia, confira se já saiu a edição nova destas provas tradicionais (data da última edição entre parênteses):

- **Corrida da UEMA**, São Luís, Campus Paulo VI (VII edição em 07/12/2025, inscrições pela Crono Esportes). A VIII edição deve sair para dezembro de 2026.
- Corrida São Luís (julho), Maratona Internacional de São Luís (julho), Meia Maratona Internacional SLZ (setembro, aniversário da cidade), Corrida do Aeroporto de São Luís (agosto), Circuito Corrida Vale (junho/julho), Cross Urbano CAIXA (julho), Corrida 100% Você (julho), Circuito Sesc de Corridas (Crono Esportes).

A Crono Esportes (cronoesportes.com.br/evento/<número>/<nome>) carrega por JavaScript: confirme data e status por notícia (UEMA Notícias, Jornal Pequeno, Imirante, O Imparcial) ou outro calendário.

Pesquise São Luís, a Grande Ilha (São José de Ribamar, Paço do Lumiar, Raposa) e as demais cidades (Imperatriz, Barreirinhas, Caxias, Timon, Bacabal, Balsas, Chapadinha, Santa Inês e outras). Inclua trail (Lençóis Maranhenses, Chapada das Mesas).

## 3. Conferir antes de registrar

- Ano/edição, cidade no Maranhão, modalidade e data precisam estar no texto da publicação ou no regulamento. Copyright do site ou data de acesso não comprovam o ano.
- Trecho de busca isolado ou calendário de terceiros não é confirmação oficial. Registre, mas deixe isso claro em `confidence`.
- Não classifique corrida de rua como trail só porque um agregador rotulou assim.
- Não invente local, prazo, link ou status. O que não foi encontrado fica `null` (ou "Local a confirmar").
- Quando a fonte nova trouxer menos detalhes que a anterior, mantenha os valores já conhecidos.
- Provas já realizadas não entram como novidade.

## 4. Formato de cada prova

```json
{
  "id": "cro-run-2026-sao-luis",
  "name": "CRO Run 2026",
  "edition": "2026",
  "city": "São Luís",
  "state": "MA",
  "modality": "Rua",
  "date": "2026-10-25",
  "distances": [5],
  "location": "Praça do Pescador, Avenida Litorânea",
  "registrationOpen": null,
  "registrationClose": "2026-10-15",
  "status": "Abertas",
  "officialUrl": "https://centraldacorrida.com.br/evento/crorun2026",
  "sourceUrl": "https://todascorridas.com.br/...",
  "sourceName": "Todas Corridas",
  "publishedAt": null,
  "confidence": "Plataforma de inscrição oficial",
  "notes": "Texto curto com o que foi confirmado e o que falta confirmar."
}
```

- `id`: nome curto + edição + cidade, só minúsculas, números e hífens. Para uma prova que já existe, **use o mesmo id**.
- `status`: `Abertas`, `Em breve`, `Consultar`, `Encerradas`, `Esgotadas`, `Cancelada` ou `Adiada`.
- `price`: valor da inscrição que aparece no card, ou `null` se não foi divulgado. `{ "min": 80, "text": "R$ 80 + taxa (1º lote)" }` — `min` é o menor valor em reais (0 = grátis ou solidária, ex.: `{ "min": 0, "text": "Solidária: 2 kg de alimento" }`), `text` tem até 60 caracteres. Atualize quando o lote mudar. Copie o que está escrito na página/regulamento; nunca estime.
- `start`: horário da largada (a primeira, se houver várias) em `"HH:MM"`, ou `null`. Ex.: `"06:30"`. Os horários por distância continuam em `notes`.
- `officialUrl`: só se for página do organizador ou da plataforma de inscrição. Calendário de terceiros vai em `sourceUrl`.
- `publishedAt`: data real do anúncio, quando encontrada. Não use a data da pesquisa.
- `prize` (premiação, opcional): deixe de fora ou `null` se não conferiu. Veja a seção 4.1.
- `elevation` (altimetria, opcional): deixe de fora ou `null` se não conferiu. Veja a seção 4.2.

### 4.1. Premiação (preencher aos poucos, até 10 provas por dia)

O site tem o botão "Premiação em dinheiro" e mostra um selo verde com o maior prêmio (ex.: "R$ 500") no card da prova.

Todo dia, depois da pesquisa normal, pegue **até 10 provas futuras com `prize` null**, das mais próximas para as mais distantes, e procure a premiação no **regulamento** (PDF ou página da prova), na página da plataforma de inscrição (a Crono Esportes e a SA Crono costumam ter a seção "PREMIAÇÃO") ou no post oficial do organizador. Registre assim:

- Dinheiro: `"prize": { "kind": "dinheiro", "top": 500, "summary": "R$ 500, R$ 300 e R$ 200 para os 3 primeiros dos 5 km, masculino e feminino." }` — `top` é o **maior valor em reais** (número).
- Troféu ou brinde, sem dinheiro: `"prize": { "kind": "trofeu", "top": null, "summary": "Troféus do 1º ao 5º lugar geral nos 5 e 10 km." }`
- Regulamento conferido e sem premiação (só medalha de participação): `"prize": { "kind": "sem", "top": null, "summary": "Só medalha de participação." }`
- Não achou o regulamento ou ele não fala de premiação: **deixe `null`** (tenta de novo em outro dia). Nunca deduza premiação de provas parecidas ou de edições passadas.

Para registrar, mande a prova inteira com o mesmo `id` na lista do `npm run atualizar`. Premiação não gera aviso de novidade sozinha. A coleta automática nunca apaga uma premiação já pesquisada.

### 4.2. Altimetria (preencher aos poucos, até 10 provas por dia)

O site mostra um selo ("Plano", "Poucas subidas", "Algumas subidas" ou "Muitas subidas") no card da prova e, na ficha, o gráfico de altimetria com a subida acumulada e o link do percurso.

Todo dia, junto com a premiação, pegue **até 10 provas futuras com `elevation` null**, das mais próximas para as mais distantes, e procure o **percurso oficial**: regulamento, página da inscrição, site do organizador, link de GPX, rota do Strava, Garmin Connect, Wikiloc ou Google Maps (My Maps).

1. **Achou um GPX** (arquivo ou link https que baixa o .gpx): rode `node scripts/altimetria.mjs <link-do-gpx> [link-da-página-do-percurso]`. Ele imprime o `elevation` pronto (nível, subida, km, gráfico). Copie para a prova. Se souber um detalhe útil do percurso (ex.: "subida da ponte no km 3 e no km 8"), acrescente no fim do `summary`. Use o GPX da distância mais longa da prova e diga isso no `summary` se houver mais de uma.
2. **Achou a subida acumulada escrita** (ex.: rota pública do Strava mostrando "Ganho de elevação 85 m", ou regulamento com a altimetria): `"elevation": { "gain": 85, "km": 10, "profile": null, "routeUrl": "<link>", "summary": "Rota oficial no Strava." }` — o nível é calculado sozinho pela subida por km.
3. **Só tem imagem do percurso ou o regulamento descreve o terreno** (ex.: "percurso plano pela Litorânea"): `"elevation": { "level": "plano", "gain": null, "km": null, "profile": null, "routeUrl": "<link da imagem ou da página>", "summary": "Regulamento: percurso plano pela Avenida Litorânea." }`. Só use isso quando a fonte oficial disser o tipo de terreno; nunca deduza pela cidade ou pela edição passada.
4. **Não achou o percurso:** deixe `null` (tenta de novo em outro dia). Organizadores costumam publicar o percurso na semana da prova, então vale repetir as provas dos próximos 10 dias.

Níveis pela subida acumulada por km: menos de 5 m/km = plano; 5 a 12 = poucas subidas; 12 a 25 = algumas subidas; 25 ou mais = muitas subidas. Altimetria não gera aviso de novidade e a coleta automática nunca apaga uma altimetria já pesquisada.

## 5. Aplicar

Salve as provas conferidas (novas e as que mudaram, até 100) numa lista em um arquivo e rode:

```sh
npm run atualizar -- caminho/provas.json
```

O script valida tudo, junta com o que já existe e cria as novidades sozinho. Se der erro, nada é alterado: corrija e rode de novo. Se a pesquisa não achou nada novo, rode com uma lista vazia (`[]`) para registrar a data da conferência.

Só mudanças de data, distâncias, local, abertura ou prazo de inscrição, status e link oficial geram novidade. Atualizar só a fonte ou a data de conferência não gera aviso.

Depois rode `npm run build` para garantir que o site continua montando.

## 6. Avisar

```sh
npm run marcar-avisados
```

lista as novidades ainda não avisadas. Para cada prova futura nessa lista, mande um aviso em português com: nome, data, distâncias, local, abertura e prazo de inscrição, link oficial (se houver) e o que ainda falta confirmar. Junte mudanças da mesma prova num aviso só. Links de terceiros aparecem como fonte, nunca como oficiais.

Só depois que o aviso for entregue, marque como avisadas:

```sh
npm run marcar-avisados -- <id> <id>
```

Se o aviso falhar, não marque. Sem novidades, não envie aviso.

## 7. Publicar

Envie as mudanças para o GitHub com uma mensagem como `Agenda: 2 novidades (14/10)` ou `Agenda: conferida, sem novidades (14/10)`. O Netlify publica sozinho.

## Limites

A pesquisa usa a web aberta. Anúncios feitos só em redes sociais fechadas podem não ser encontrados. Não prometa cobertura completa.
