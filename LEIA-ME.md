# Radar Corridas Maranhão

Agenda de corridas de rua e trail em São Luís e no Maranhão, com prazos de inscrição, fonte de cada informação e uma pesquisa automática todo dia às 8h.

## Como o site funciona

O site é estático: só HTML, CSS, JavaScript e um arquivo com as provas. Não tem servidor, banco de dados nem senha para proteger.

```
GitHub (código + public/data/radar.json)
   │  cada mudança no repositório
   ▼
Netlify (publica o site sozinho em 1 a 2 minutos)
   ▲
   │  todo dia às 8h
Pesquisa diária do Claude: confere as fontes, atualiza o radar.json,
envia para o GitHub e te avisa no celular se houver novidade
```

## Colocar no ar no Netlify (só uma vez)

1. Entre em **app.netlify.com** com sua conta.
2. Clique em **Add new site → Import an existing project**.
3. Escolha **GitHub** e autorize, se for pedido.
4. Selecione o repositório **radar-maranhao**.
5. Não precisa mudar nada: o arquivo `netlify.toml` já informa tudo (comando `npm run build`, pasta `dist`). Clique em **Deploy**.
6. Em um ou dois minutos o site estará no ar em um endereço como `nome-aleatorio.netlify.app`.
7. Para trocar o nome: **Site configuration → Change site name** (por exemplo, `radar-corridas-maranhao.netlify.app`). Se tiver um domínio próprio, use **Domain management → Add a domain**.

Pronto. A partir daí, toda atualização no GitHub vai para o ar sozinha.

## O que está em cada arquivo

| Arquivo | Para que serve |
| --- | --- |
| `public/data/radar.json` | A agenda: provas, novidades e data da última pesquisa. É o único arquivo que muda no dia a dia. |
| `src/App.tsx` | As telas: agenda, novidades, minha agenda, sobre e a ficha de cada prova. |
| `src/styles.css` | Visual do site (cores, letras, layout para computador e celular). |
| `src/lib.ts` | Datas, status das inscrições, contagem regressiva e exportação para o calendário. |
| `scripts/` | Ferramentas para atualizar e conferir a agenda (veja abaixo). |
| `PESQUISA.md` | Regras que a pesquisa diária segue para encontrar e registrar provas. |
| `netlify.toml` | Configuração do Netlify. |

## Corrigir uma prova à mão

Você pode editar `public/data/radar.json` direto no GitHub (abra o arquivo e clique no lápis). Ao salvar, o Netlify publica de novo.

Antes de publicar, o Netlify confere o arquivo. Se houver algum erro (uma data escrita errado, um campo vazio), a publicação é recusada e o site continua com a versão anterior, sem quebrar. O motivo aparece em **Deploys** no Netlify.

Regras principais de cada prova:

- `date`, `registrationClose`, `publishedAt`: no formato `2026-10-31`, ou `null` se não divulgado.
- `registrationOpen`: data e hora, como `2026-10-13T12:00:00-03:00`, ou `null`.
- `modality`: `"Rua"` ou `"Trail"`.
- `status`: `"Abertas"`, `"Em breve"`, `"Consultar"`, `"Encerradas"`, `"Esgotadas"`, `"Cancelada"` ou `"Adiada"`.
- `distances`: lista em km, como `[5, 10, 21]`.
- Links sempre começando com `https://`.

## App no celular

O Radar pode ser instalado como aplicativo, sem loja: ganha ícone na tela inicial (com o nome **Corridas MA**), abre em tela cheia e mostra a última agenda carregada mesmo sem internet.

Ao abrir o site no celular, uma janela flutuante aparece depois de 2 ou 3 segundos com o jeito certo de instalar para cada aparelho:

| Onde a pessoa abriu | O que a janela mostra |
| --- | --- |
| Android (Chrome, Samsung Internet, Edge) | Botão **Instalar app**, que abre a instalação do próprio celular |
| Android (Firefox e outros) | Passo a passo pelo menu ⋮ |
| iPhone (Safari, Chrome, Firefox, Edge) | Passo a passo do **Compartilhar → Adicionar à Tela de Início** (a Apple não deixa o site instalar sozinho) |
| Dentro do Instagram, WhatsApp, Facebook, TikTok… | Explica que por ali não dá, com botão **Abrir no Chrome** (Android) e **Copiar link** |
| Já instalado | Nada aparece |

A janela aparece toda vez que a pessoa abre ou recarrega o site, até instalar o app. Fechar a janela vale só para aquela visita. A qualquer momento dá para abrir de novo em **Sobre → Instalar o app**.

Arquivos envolvidos: `public/manifest.webmanifest` (nome, cores e ícones do app), `public/icons/`, `public/sw.js` (funcionamento sem internet), `src/install.ts` e `src/InstallPrompt.tsx` (a janela).

Se mudar algo grande no `sw.js`, troque a linha `const VERSION = 'v1'` para `'v2'` para os celulares descartarem a versão antiga guardada.

## Coleta automática das plataformas

De 2 em 2 horas (6h37 às 20h37) o GitHub abre com navegador a Crono Esportes, a SA Crono, a Central da Corrida, o calendário da Topchip e o GuardaLugar (sites que só funcionam com JavaScript) e salva o texto em `coleta/`. Logo depois de cada coleta, o próprio GitHub roda `scripts/aplicar-coleta.mjs`, que atualiza a agenda **sem usar o Claude**: muda o status das provas (abertas, encerradas, esgotadas, em breve) e coloca provas novas do Maranhão. O site só republica **quando algo muda de verdade**, para não gastar os minutos do Netlify (plano grátis: 300 min/mês). A pesquisa completa do Claude roda uma vez por dia, às 7h47: ela procura também fora dessas plataformas e envia o aviso das mudanças. Mudanças só em `coleta/` não republicam o site.

**Se a notificação disser que a coleta falhou:**

1. O site continua no ar com a agenda anterior; nada quebra.
2. Para tentar de novo na hora: GitHub → repositório **radar-maranhao** → aba **Actions** → **Coletar plataformas de inscrição** → **Run workflow** → **Run workflow**. Leva uns 5 minutos.
3. Se falhar de novo, peça ao Claude: "a coleta falhou, veja o erro no GitHub Actions e conserte". Normalmente é uma plataforma que mudou o visual; o ajuste fica em `scripts/coletar-plataformas.mjs`.
4. Enquanto isso, provas daquela plataforma podem ser enviadas pelo botão "Falta alguma corrida?" do site.

## Rodar no computador (opcional)

Só é necessário se você quiser mexer no visual. Precisa do Node.js 20 ou mais novo.

```sh
npm install
npm run dev
```

Abra o endereço que aparecer (normalmente http://localhost:5173).

Outros comandos:

- `npm run validar`: confere se o `radar.json` está correto.
- `npm run atualizar -- provas.json`: aplica o resultado de uma pesquisa à agenda.
- `npm run marcar-avisados`: lista as novidades que ainda não foram avisadas.
- `npm run build`: gera a versão final na pasta `dist`.

## Bom saber

- **Minha agenda (provas salvas) e novidades lidas** ficam guardadas no navegador de cada pessoa, sem banco de dados nem cadastro. Cada pessoa exporta a própria agenda em "Minha agenda → Exportar minha agenda" (arquivo .ics, que abre no Google Agenda, no iPhone e no Outlook). Para levar a lista para outro aparelho (ou mandar para um amigo), a pessoa usa "Copiar link da minha agenda": ao abrir o link, as provas são somadas à agenda daquele aparelho. Quem limpar o navegador sem guardar o link perde a lista.
- **A pesquisa não acha tudo.** Provas anunciadas só no Instagram ou em grupos fechados podem demorar a aparecer. O site avisa isso aos visitantes.
- **Pausar a pesquisa diária:** peça ao Claude para pausar a tarefa agendada "Radar Maranhão: pesquisa diária". O site continua no ar, só para de atualizar sozinho.
- **O site antigo** (ChatGPT Sites / Cloudflare) e a rotina de lá continuam existindo até você desativá-los. Desative a rotina antiga para não receber avisos duplicados.

## O que mudou em relação à versão original

- Visual novo, pensado primeiro para o celular, com a contagem regressiva para a próxima largada em destaque.
- Saiu a hospedagem Cloudflare (Workers + R2) e o login do ChatGPT. O site agora é estático e roda em qualquer lugar, no Netlify de graça.
- A gravação pela internet (`POST /api/radar`) deixou de existir. Só quem tem acesso ao repositório do GitHub muda a agenda, o que resolve o problema de segurança que a versão anterior apontava.
- A agenda, o histórico de novidades e o controle de avisos foram mantidos (9 provas e 3 novidades em 14 de outubro de 2026).
- A regra que juntava provas com o mesmo link foi corrigida: provas diferentes que usam o mesmo site de inscrição não são mais confundidas.

## Endereços do site

- **Oficial:** https://radarcorridasma.com.br (domínio no Registro.br, apontado para o Netlify: registro A `75.2.60.5` e CNAME `www` → `radarcorridas.netlify.app`).
- **Antigo, que continua funcionando:** https://radarcorridas.netlify.app — não tem redirecionamento de propósito, para quem instalou o app por ele continuar recebendo tudo. As páginas dizem ao Google que o endereço oficial é o .com.br.
- O domínio vence uma vez por ano: renove no Registro.br, senão o .com.br sai do ar (o netlify.app continua).

