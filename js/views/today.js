import { addDays, formatDay, todayKey } from '../dates.js';
import { weekCount } from '../stats.js';
import { esc } from '../ui.js';

const TICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';

export function mount(root, { store, state, render, go }) {
  const today = todayKey();
  const day = state.day > today ? today : state.day;
  const list = store.active();

  if (list.length === 0) {
    const anyPaused = store.activities().length > 0;
    root.innerHTML = `
      <div class="empty">
        <div class="big">🎯</div>
        <h2>${anyPaused ? 'Nessuna attività attiva' : 'Inizia da qui'}</h2>
        <p>${anyPaused
          ? 'Tutte le attività sono in pausa. Riattivane una o creane una nuova.'
          : 'Aggiungi la prima attività che vuoi tracciare: allenamento, lettura, studio…'}</p>
        <button type="button" class="btn btn-primary" data-act="add">${anyPaused ? 'Vai alle attività' : 'Aggiungi un\'attività'}</button>
      </div>`;
    root.onclick = (e) => {
      if (e.target.closest('[data-act="add"]')) go('activities');
    };
    return;
  }

  const done = list.filter((a) => store.isChecked(a.id, day)).length;

  const rows = list
    .map((a) => {
      const checked = store.isChecked(a.id, day);
      let pill = '';
      if (a.weeklyGoal) {
        const n = weekCount(store.datesOf(a.id), day);
        pill = `<span class="wk${n >= a.weeklyGoal ? ' hit' : ''}" aria-label="${n} su ${a.weeklyGoal} questa settimana">${n}/${a.weeklyGoal}</span>`;
      }
      return `
        <li>
          <button type="button" class="check${checked ? ' is-done' : ''}" data-id="${esc(a.id)}" aria-pressed="${checked}">
            <span class="ico" aria-hidden="true">${esc(a.icon)}</span>
            <span class="nm">${esc(a.name)}</span>
            ${pill}
            <span class="box">${TICK}</span>
          </button>
        </li>`;
    })
    .join('');

  root.innerHTML = `
    <div class="daybar">
      <button type="button" class="arrow" data-act="prev" aria-label="Giorno precedente">‹</button>
      <div class="mid">
        <h1>${day === today ? 'Oggi' : esc(formatDay(day))}</h1>
        <p>${day === today ? `${esc(formatDay(day))} · ` : ''}${done} di ${list.length} fatte</p>
      </div>
      <button type="button" class="arrow" data-act="next" aria-label="Giorno successivo" ${day >= today ? 'disabled' : ''}>›</button>
    </div>
    ${day === today ? '' : '<button type="button" class="back-today" data-act="today">Torna a oggi</button>'}
    <div class="progress" aria-hidden="true"><i style="width:${(done / list.length) * 100}%"></i></div>
    <ul class="checks">${rows}</ul>`;

  root.onclick = (e) => {
    const check = e.target.closest('.check');
    if (check) {
      const id = check.dataset.id;
      store.toggle(id, day);
      render();
      // La lista viene ricostruita: si riporta il focus sulla riga toccata.
      root.querySelector(`.check[data-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
      return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'prev') state.day = addDays(day, -1);
    else if (act === 'next' && day < today) state.day = addDays(day, 1);
    else if (act === 'today') state.day = today;
    else return;
    render();
  };
}
