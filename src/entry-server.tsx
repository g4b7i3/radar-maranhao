// Usado só no build (scripts/prerender.mjs): gera o HTML do início já com a agenda,
// para a página aparecer pronta antes do JavaScript terminar de carregar.
import { renderToString } from 'react-dom/server';
import App from './App';
import type { State } from './lib';
export function render(data: State) { return renderToString(<App inicial={data} />); }
