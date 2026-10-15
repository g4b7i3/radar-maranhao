#!/usr/bin/env node
// Gera os arquivos de calendário (.ics) depois do build:
//  - dist/calendario/radar.ics: agenda completa para ASSINAR (iPhone, Google Agenda, Outlook). Atualiza sozinha.
//  - dist/calendario/<id>.ics: uma prova, com lembrete na véspera (o iPhone abre "Adicionar ao Calendário").
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { cal, vevent } from './ics.mjs';

const { events } = JSON.parse(await readFile('public/data/radar.json', 'utf8'));

const limite = new Date(Date.now() - 45 * 864e5).toISOString().slice(0, 10);
const comData = events.filter(e => e.date && e.date >= limite).sort((a, b) => a.date.localeCompare(b.date));
await mkdir('dist/calendario', { recursive: true });
await writeFile('dist/calendario/radar.ics', cal(comData.flatMap(e => vevent(e, false)), [
  'X-WR-CALNAME:Corridas no Maranhão', 'X-WR-CALDESC:Agenda de corridas de rua e trail do Maranhão - Radar Corridas Maranhão',
  'X-WR-TIMEZONE:America/Fortaleza', 'REFRESH-INTERVAL;VALUE=DURATION:PT12H', 'X-PUBLISHED-TTL:PT12H',
]));
for (const e of comData) await writeFile(`dist/calendario/${e.id}.ics`, cal(vevent(e, true), [`X-WR-CALNAME:Corrida: ${e.name.replace(/[,;]/g, ' ')}`]));
console.log(`Calendário: agenda completa com ${comData.length} provas + ${comData.length} arquivos individuais.`);
