// Confere se public/data/radar.json está correto. Roda sozinho antes de cada build.
import { readState, validateState } from './radar-lib.mjs';
try {
  const s = validateState(readState());
  console.log(`radar.json ok: ${s.events.length} provas, ${s.changes.length} novidades.`);
} catch (e) {
  console.error('radar.json com problema: ' + e.message);
  process.exit(1);
}
