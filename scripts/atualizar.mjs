// Aplica o resultado de uma pesquisa à agenda.
// Uso: npm run atualizar -- caminho/para/provas.json
// O arquivo deve conter uma lista de provas (pode ser vazia: [] registra "pesquisa feita, sem novidades").
import { readFileSync } from 'node:fs';
import { readState, writeState, applyUpdate } from './radar-lib.mjs';

const file = process.argv[2];
if (!file) { console.error('Informe o arquivo: npm run atualizar -- provas.json'); process.exit(1); }
try {
  const events = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(events) || events.length > 100) throw Error('O arquivo deve ter uma lista de até 100 provas');
  const { next, changes } = applyUpdate(readState(), events, new Date().toISOString());
  writeState(next);
  console.log(`Agenda atualizada: ${events.length} provas conferidas, ${changes.length} novidades.`);
  for (const c of changes) console.log(`  ${c.kind}: ${next.events.find(e => e.id === c.eventId).name} (${c.id})`);
} catch (e) {
  console.error('Nada foi alterado. ' + e.message);
  process.exit(1);
}
