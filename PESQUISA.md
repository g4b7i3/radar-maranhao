# Pesquisa diária de provas

Instruções seguidas pela tarefa agendada que atualiza o Radar Corridas Maranhão todo dia às 8h (horário de São Luís). Servem também para quem for atualizar a agenda à mão.

## Objetivo

Encontrar corridas de rua e trail **no Maranhão** que foram anunciadas ou mudaram, registrar na agenda com fonte e avisar só quando houver novidade real.

## 1. Ler a agenda atual

Abra `public/data/radar.json`. Anote as provas que já existem (`id`, nome, cidade, edição) para não criar duplicatas.

## 2. Pesquisar

Fontes, em ordem de confiança:

1. Página ou regulamento do organizador e plataformas de inscrição: Central da Corrida, CronoEsportes, TicketSports, Running Land, PHB Crono, Doity, Sympla, Minhas Inscrições, MetaSport.
2. Órgãos e empresas organizadores (tribunais, portos, prefeituras, secretarias de esporte).
3. Notícias locais (Maranhão Esportes, portais de São Luís e Imperatriz) para descobrir links.
4. Calendários de terceiros (O2 Corre, Sou Corredor, Todas Corridas, CorridasBR): servem para descobrir provas, não para confirmar.

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
- `officialUrl`: só se for página do organizador ou da plataforma de inscrição. Calendário de terceiros vai em `sourceUrl`.
- `publishedAt`: data real do anúncio, quando encontrada. Não use a data da pesquisa.

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
