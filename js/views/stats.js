import { todayKey, yearOf, monthOf, daysInMonth, formatMonth, formatDay, fromKey, pad } from '../dates.js';
import {
  weekCount, monthCount, yearCount, monthlyCounts, monthlyAverage,
  dayStreak, weekStreak, goalHitRate, firstDay,
} from '../stats.js';
import { esc } from '../ui.js';

const MONTH_INITIALS = ['G', 'F', 'M', 'A', 'M', 'G', 'L', 'A', 'S', 'O', 'N', 'D'];
const WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
const BAR_MAX_PX = 100; // altezza della barra più alta; lascia spazio alle etichette
const TICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';

// Riquadro con le attività del giorno selezionato nel calendario.
function dayPanel(store, key) {
  const entries = store.dayEntries(key);
  const done = entries.filter((e) => e.done).length;
  const rows = entries
    .map(({ activity: a, done: isDone }) => `
      <li class="${isDone ? 'done' : ''}">
        <span class="ico" aria-hidden="true">${esc(a.icon)}</span>
        <span class="nm">${esc(a.name)}</span>
        <span class="st" role="img" aria-label="${isDone ? 'fatta' : 'non fatta'}">${isDone ? TICK : ''}</span>
      </li>`)
    .join('');
  return `
    <div class="card day-panel" aria-live="polite">
      <div class="dp-head">
        <h3>${esc(formatDay(key))}</h3>
        ${entries.length ? `<p>${done} di ${entries.length} fatte</p>` : ''}
      </div>
      ${entries.length
        ? `<ul class="day-list">${rows}</ul>`
        : '<p class="note">Nessuna attività tracciata in questo giorno.</p>'}
      ${store.active().length ? '<button type="button" class="btn btn-ghost" data-act="edit-day">Modifica questo giorno</button>' : ''}
    </div>`;
}

const fmtAvg = (n) => n.toLocaleString('it-IT', { maximumFractionDigits: 1 });
const plural = (n, one, many) => (n === 1 ? one : many);

const kpi = (label, value, { unit = '', sub = '', gold = false } = {}) => `
  <div class="card kpi${gold ? ' gold' : ''}">
    <div class="lb">${label}</div>
    <div class="val">${value}${unit ? `<small>${unit}</small>` : ''}</div>
    ${sub ? `<div class="sub">${sub}</div>` : ''}
  </div>`;

export function mount(root, { store, state, render, go }) {
  const all = store.activities();
  if (all.length === 0) {
    root.innerHTML = `
      <div class="empty">
        <div class="big">📊</div>
        <h2>Ancora nessun dato</h2>
        <p>Le statistiche compaiono quando aggiungi un'attività e inizi a spuntarla.</p>
        <button type="button" class="btn btn-primary" data-act="add">Aggiungi un'attività</button>
      </div>`;
    root.onclick = (e) => {
      if (e.target.closest('[data-act="add"]')) go('activities');
    };
    return;
  }

  const today = todayKey();
  const thisYear = yearOf(today);
  const thisMonth = monthOf(today);

  const activity = store.get(state.statsId);
  const isAll = !activity;
  const dates = isAll ? store.allDates() : store.datesOf(activity.id);
  const createdAt = isAll
    ? all.reduce((min, a) => (a.createdAt < min ? a.createdAt : min), today)
    : activity.createdAt;

  const firstYear = Math.min(yearOf(firstDay(dates, createdAt)), thisYear);
  const year = Math.min(Math.max(state.statsYear ?? thisYear, firstYear), thisYear);
  const cal = state.statsCal ?? { y: thisYear, m: thisMonth };

  // ---- KPI ----
  const goal = isAll ? null : activity.weeklyGoal;
  const week = weekCount(dates, today);
  const tiles = [
    kpi('Questa settimana', week, goal ? { unit: `/ ${goal}`, gold: week >= goal } : {}),
    kpi('Questo mese', monthCount(dates, thisYear, thisMonth)),
    kpi(`Nel ${year}`, yearCount(dates, year)),
    kpi('Media mensile', fmtAvg(monthlyAverage(dates, year, today, createdAt)), { sub: `nel ${year}` }),
  ];
  if (!isAll) {
    const streak = goal ? weekStreak(dates, goal, today, createdAt) : dayStreak(dates, today);
    const unit = (n) => (goal ? plural(n, 'settimana', 'settimane') : plural(n, 'giorno', 'giorni'));
    tiles.push(
      kpi('Serie attuale', streak.current, { unit: unit(streak.current) }),
      kpi('Serie record', streak.best, { unit: unit(streak.best) })
    );
    if (goal) {
      const rate = goalHitRate(dates, goal, today, createdAt);
      tiles.push(
        rate
          ? kpi('Obiettivo centrato', Math.round(rate.rate * 100), { unit: '%', sub: `${rate.hit} ${plural(rate.hit, 'settimana', 'settimane')} su ${rate.total}` })
          : kpi('Obiettivo centrato', '–', { sub: 'dalla prima settimana conclusa' })
      );
    }
  }

  // ---- Barre mensili ----
  const months = monthlyCounts(dates, year);
  const max = Math.max(...months, 1);
  const bars = months
    .map((n, i) => {
      const now = year === thisYear && i + 1 === thisMonth;
      return `
        <div class="bar${n ? ' has' : ''}${now ? ' now' : ''}">
          <span class="n">${n || ''}</span>
          <i style="height:${Math.round((n / max) * BAR_MAX_PX)}px"></i>
          <span class="m">${MONTH_INITIALS[i]}</span>
        </div>`;
    })
    .join('');

  // ---- Calendario ----
  const perDay = new Map();
  const prefix = `${cal.y}-${pad(cal.m)}-`;
  for (const d of dates) if (d.startsWith(prefix)) perDay.set(d, (perDay.get(d) || 0) + 1);
  // Con "Tutte" il colore pieno corrisponde a tutte le attività attive fatte
  // (o al giorno migliore del mese, se allora ce n'erano di più).
  const scale = isAll ? Math.max(store.active().length, ...perDay.values(), 1) : 1;
  const offset = (fromKey(`${prefix}01`).getDay() + 6) % 7;
  let cells = WEEKDAYS.map((d) => `<div class="dow">${d}</div>`).join('') + '<div></div>'.repeat(offset);
  for (let d = 1; d <= daysInMonth(cal.y, cal.m); d++) {
    const key = `${prefix}${pad(d)}`;
    const n = perDay.get(key) || 0;
    const lvl = n ? 0.15 + 0.85 * (n / scale) : 0;
    const selected = key === state.statsDay;
    const cls = ['d', n ? 'on' : '', lvl > 0.55 ? 'strong' : '', key === today ? 'today' : '', key > today ? 'future' : '', selected ? 'sel' : '']
      .filter(Boolean)
      .join(' ');
    const style = n ? ` style="--lvl:${lvl.toFixed(2)}"` : '';
    if (key > today) {
      cells += `<div class="${cls}">${d}</div>`;
    } else {
      const what = n ? (isAll ? `${n} ${plural(n, 'spunta', 'spunte')}` : 'fatto') : 'nessuna spunta';
      cells += `<button type="button" class="${cls}" data-day="${key}" aria-pressed="${selected}" aria-label="${d}: ${what}"${style}>${d}</button>`;
    }
  }
  const selDay = state.statsDay && state.statsDay.startsWith(prefix) && state.statsDay <= today ? state.statsDay : null;
  const calAtStart = cal.y < firstYear || (cal.y === firstYear && cal.m === 1);
  const calAtEnd = cal.y > thisYear || (cal.y === thisYear && cal.m >= thisMonth);

  const actOptions = [`<option value="">Tutte le attività</option>`]
    .concat(all.map((a) => `<option value="${esc(a.id)}"${!isAll && a.id === activity.id ? ' selected' : ''}>${esc(a.icon)} ${esc(a.name)}${a.paused ? ' (in pausa)' : ''}</option>`))
    .join('');
  let yearOptions = '';
  for (let y = thisYear; y >= firstYear; y--) yearOptions += `<option${y === year ? ' selected' : ''}>${y}</option>`;

  root.innerHTML = `
    <div class="filters">
      <select class="f-act" aria-label="Attività">${actOptions}</select>
      <select class="f-year" aria-label="Anno">${yearOptions}</select>
    </div>
    <div class="kpis">${tiles.join('')}</div>

    <h2 class="kicker">Mese per mese · ${year}</h2>
    <div class="card bars">${bars}</div>

    <h2 class="kicker">Calendario</h2>
    <div class="card cal">
      <div class="cal-head">
        <button type="button" class="arrow" data-cal="-1" aria-label="Mese precedente" ${calAtStart ? 'disabled' : ''}>‹</button>
        <h3>${esc(formatMonth(cal.y, cal.m))}</h3>
        <button type="button" class="arrow" data-cal="1" aria-label="Mese successivo" ${calAtEnd ? 'disabled' : ''}>›</button>
      </div>
      <div class="cal-grid">${cells}</div>
    </div>
    ${selDay ? dayPanel(store, selDay) : '<p class="cal-hint">Tocca un giorno per vedere cosa hai fatto.</p>'}`;

  root.onchange = (e) => {
    if (e.target.matches('.f-act')) {
      state.statsId = e.target.value || null;
      state.statsYear = null;
      state.statsCal = null;
      state.statsDay = null;
    } else if (e.target.matches('.f-year')) {
      state.statsYear = Number(e.target.value);
    } else return;
    render();
  };

  root.onclick = (e) => {
    const dayBtn = e.target.closest('[data-day]');
    if (dayBtn) {
      const key = dayBtn.dataset.day;
      state.statsDay = state.statsDay === key ? null : key;
      render();
      root.querySelector(`[data-day="${key}"]`)?.focus({ preventScroll: true });
      if (state.statsDay) root.querySelector('.day-panel')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }
    if (e.target.closest('[data-act="edit-day"]')) {
      state.day = selDay;
      go('today');
      return;
    }
    const btn = e.target.closest('[data-cal]');
    if (!btn || btn.disabled) return;
    const next = new Date(cal.y, cal.m - 1 + Number(btn.dataset.cal), 1);
    state.statsCal = { y: next.getFullYear(), m: next.getMonth() + 1 };
    state.statsDay = null;
    render();
  };
}
