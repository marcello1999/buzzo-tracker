// Calcolo dei KPI. Funzioni pure: ricevono un elenco di chiavi-giorno
// (anche con ripetizioni, quando si sommano più attività) e il giorno di oggi.

import { addDays, weekStart, yearOf, monthOf, pad } from './dates.js';

export const countInRange = (dates, from, to) =>
  dates.filter((d) => d >= from && d <= to).length;

export const weekCount = (dates, key) => {
  const start = weekStart(key);
  return countInRange(dates, start, addDays(start, 6));
};

export const monthCount = (dates, year, month) => {
  const prefix = `${year}-${pad(month)}-`;
  return dates.filter((d) => d.startsWith(prefix)).length;
};

export const yearCount = (dates, year) => {
  const prefix = `${year}-`;
  return dates.filter((d) => d.startsWith(prefix)).length;
};

export const monthlyCounts = (dates, year) =>
  Array.from({ length: 12 }, (_, i) => monthCount(dates, year, i + 1));

// Primo giorno rilevante: la creazione dell'attività o la prima spunta,
// se è stata registrata per un giorno precedente alla creazione.
export const firstDay = (dates, createdAt) =>
  dates.reduce((min, d) => (d < min ? d : min), createdAt);

// Spunte nell'anno divise per i mesi considerati: dal primo mese rilevante
// (o gennaio) al mese corrente (o dicembre per gli anni passati).
export const monthlyAverage = (dates, year, today, createdAt) => {
  const first = firstDay(dates, createdAt);
  const thisYear = yearOf(today);
  if (year > thisYear || year < yearOf(first)) return 0;
  const startMonth = yearOf(first) === year ? monthOf(first) : 1;
  const endMonth = year === thisYear ? monthOf(today) : 12;
  const months = endMonth - startMonth + 1;
  return months > 0 ? yearCount(dates, year) / months : 0;
};

// Giorni consecutivi spuntati. La serie attuale arriva fino a oggi,
// oppure fino a ieri se oggi non è ancora spuntato.
export const dayStreak = (dates, today) => {
  const days = [...new Set(dates)].sort();
  const set = new Set(days);

  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of days) {
    run = prev !== null && addDays(prev, 1) === d ? run + 1 : 1;
    if (run > best) best = run;
    prev = d;
  }

  let current = 0;
  let cursor = set.has(today) ? today : addDays(today, -1);
  while (set.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }
  return { current, best };
};

const weeklyTotals = (dates) => {
  const totals = new Map();
  for (const d of dates) {
    const w = weekStart(d);
    totals.set(w, (totals.get(w) || 0) + 1);
  }
  return totals;
};

// Settimane consecutive con obiettivo raggiunto. La settimana in corso
// conta se già raggiunta; se non lo è ancora, non interrompe la serie.
export const weekStreak = (dates, goal, today, createdAt) => {
  const totals = weeklyTotals(dates);
  const thisWeek = weekStart(today);
  let best = 0;
  let run = 0;
  for (let w = weekStart(firstDay(dates, createdAt)); w <= thisWeek; w = addDays(w, 7)) {
    if ((totals.get(w) || 0) >= goal) {
      run += 1;
      if (run > best) best = run;
    } else if (w !== thisWeek) {
      run = 0;
    }
  }
  return { current: run, best };
};

// Quota di settimane concluse in cui l'obiettivo è stato raggiunto.
// Restituisce null finché non c'è almeno una settimana conclusa.
// La prima settimana, se iniziata a metà, conta solo se l'obiettivo è stato
// raggiunto: non sarebbe giusto segnarla come mancata.
export const goalHitRate = (dates, goal, today, createdAt) => {
  const totals = weeklyTotals(dates);
  const thisWeek = weekStart(today);
  const first = firstDay(dates, createdAt);
  const firstWeek = weekStart(first);
  let total = 0;
  let hit = 0;
  for (let w = firstWeek; w < thisWeek; w = addDays(w, 7)) {
    const met = (totals.get(w) || 0) >= goal;
    if (w === firstWeek && first !== firstWeek && !met) continue;
    total += 1;
    if (met) hit += 1;
  }
  return total === 0 ? null : { hit, total, rate: hit / total };
};
