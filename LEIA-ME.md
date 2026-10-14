# Radar Maranhão

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
7. Para trocar o nome: **Site configuration → Change site name** (por exemplo, `radar-maranhao.netlify.app`). Se tiver um domínio próprio, use **Domain management → Add a domain**.

Pronto. A partir daí, toda atualização no GitHub vai para o ar sozinha.

## O que está em cada arquivo

| Arquivo | Para que serve |
| --- | --- |
| `public/data/radar.json` | A agenda: provas, novidades e data da última pesquisa. É o único arquivo que muda no dia a dia. |
| `src/App.tsx` | As telas: agenda, novidades, provas salvas, sobre e a ficha de cada prova. |
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

- **Provas salvas e novidades lidas** ficam guardadas no navegador de cada pessoa. Quem trocar de celular ou de navegador começa do zero.
- **A pesquisa não acha tudo.** Provas anunciadas só no Instagram ou em grupos fechados podem demorar a aparecer. O site avisa isso aos visitantes.
- **Pausar a pesquisa diária:** peça ao Claude para pausar a tarefa agendada "Radar Maranhão". O site continua no ar, só para de atualizar sozinho.
- **O site antigo** (ChatGPT Sites / Cloudflare) e a rotina de lá continuam existindo até você desativá-los. Desative a rotina antiga para não receber avisos duplicados.

## O que mudou em relação à versão original

- Visual novo, pensado primeiro para o celular, com a contagem regressiva para a próxima largada em destaque.
- Saiu a hospedagem Cloudflare (Workers + R2) e o login do ChatGPT. O site agora é estático e roda em qualquer lugar, no Netlify de graça.
- A gravação pela internet (`POST /api/radar`) deixou de existir. Só quem tem acesso ao repositório do GitHub muda a agenda, o que resolve o problema de segurança que a versão anterior apontava.
- A agenda, o histórico de novidades e o controle de avisos foram mantidos (9 provas e 3 novidades em 14 de outubro de 2026).
- A regra que juntava provas com o mesmo link foi corrigida: provas diferentes que usam o mesmo site de inscrição não são mais confundidas.
