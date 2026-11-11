// Giorni di calendario nell'ora locale, rappresentati come chiavi 'AAAA-MM-GG'.
// Le chiavi si confrontano correttamente come stringhe.

export const pad = (n) => String(n).padStart(2, '0');

export const toKey = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const fromKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const todayKey = () => toKey(new Date());

export const isValidKey = (key) =>
  typeof key === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(key) &&
  toKey(fromKey(key)) === key;

export const addDays = (key, n) => {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
};

// Lunedì della settimana che contiene il giorno dato.
export const weekStart = (key) => addDays(key, -((fromKey(key).getDay() + 6) % 7));

export const yearOf = (key) => Number(key.slice(0, 4));
export const monthOf = (key) => Number(key.slice(5, 7));

export const daysInMonth = (year, month) => new Date(year, month, 0).getDate();

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export const formatDay = (key) =>
  cap(
    fromKey(key).toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
  );

export const formatMonth = (year, month) =>
  cap(
    new Date(year, month - 1, 1).toLocaleDateString('it-IT', {
      month: 'long',
      year: 'numeric',
    })
  );
