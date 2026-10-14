// Registra que as novidades já foram avisadas, para não avisar de novo.
// Uso: npm run marcar-avisados -- <id> [<id> ...]   ou   npm run marcar-avisados -- --pendentes
import { readState, writeState } from './radar-lib.mjs';

const s = readState();
const args = process.argv.slice(2);
const now = new Date().toISOString();
if (!args.length) {
  const pend = s.changes.filter(c => !c.notifiedAt);
  console.log(pend.length ? 'Novidades ainda não avisadas:' : 'Nenhuma novidade pendente.');
  for (const c of pend) console.log(`  ${c.id}  ${c.kind}: ${s.events.find(e => e.id === c.eventId)?.name}`);
  process.exit(0);
}
const ids = args.includes('--pendentes') ? s.changes.filter(c => !c.notifiedAt).map(c => c.id) : args;
let n = 0;
s.changes = s.changes.map(c => ids.includes(c.id) && !c.notifiedAt ? (n++, { ...c, notifiedAt: now }) : c);
writeState(s);
console.log(`${n} novidade(s) marcadas como avisadas.`);
