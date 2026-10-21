import { createRoot } from 'react-dom/client';
import { TelaAdmin } from './pro/Telas';
import './styles.css';
import './pro/pro.css';
export function montar() { document.body.innerHTML = '<main class="pro" id="t"></main>'; createRoot(document.getElementById('t')!).render(<TelaAdmin />); }
