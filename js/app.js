import { createStore, STORAGE_KEY } from './store.js';
import { toast } from './ui.js';
import { todayKey } from './dates.js';
import * as today from './views/today.js';
import * as stats from './views/stats.js';
import * as activities from './views/activities.js';

const views = { today, stats, activities };
const root = document.getElementById('view');
const tabs = document.querySelector('.tabs');

const ctx = {
  store: createStore(localStorage),
  state: { tab: 'today', day: todayKey(), lastToday: todayKey() },
  render,
  go(tab) {
    ctx.state.tab = tab;
    window.scrollTo(0, 0);
    render();
  },
};

function render() {
  for (const btn of tabs.querySelectorAll('button')) {
    if (btn.dataset.tab === ctx.state.tab) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  }
  root.onclick = null;
  root.onchange = null;
  views[ctx.state.tab].mount(root, ctx);
}

tabs.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-tab]');
  if (btn) ctx.go(btn.dataset.tab);
});

const sheetOpen = () => document.getElementById('sheet').open;

// Quando cambia il giorno (app riaperta o lasciata accesa a mezzanotte),
// la scheda Oggi segue la data corrente se era rimasta su quella di ieri.
function followDate() {
  const now = todayKey();
  if (now === ctx.state.lastToday) return;
  if (ctx.state.day === ctx.state.lastToday) ctx.state.day = now;
  ctx.state.lastToday = now;
  if (!sheetOpen()) render();
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) followDate();
});
setInterval(followDate, 30000);

// Un'altra finestra dell'app ha salvato: si rileggono i dati per non
// sovrascrivere le sue modifiche con una copia vecchia.
window.addEventListener('storage', (e) => {
  if (e.key !== null && e.key !== STORAGE_KEY) return;
  ctx.store.reload();
  if (!sheetOpen()) render();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

render();

if (ctx.store.wasUnreadable()) {
  toast('I dati salvati non erano leggibili. Ne è stata conservata una copia: importa un backup per ripristinarli.', true);
}
