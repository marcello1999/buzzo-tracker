// Lettura e scrittura dei dati. Ogni modifica viene salvata subito.

import { isValidKey, todayKey } from './dates.js';

export const STORAGE_KEY = 'buzzo-tracker-v1';
const CORRUPT_KEY = 'buzzo-tracker-v1-illeggibile';
const MAX_NAME = 40;

export const emptyData = () => ({ version: 1, activities: [], checks: {} });

const fail = (msg) => {
  throw new Error(msg);
};

// Controlla e normalizza dati letti dallo storage o da un file di backup.
// Lancia un errore con un messaggio leggibile se la struttura non è valida.
export function validateData(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('Il file non contiene dati del tracker.');
  if (raw.version !== 1) fail('Versione dei dati non riconosciuta.');
  if (!Array.isArray(raw.activities)) fail('Elenco delle attività mancante.');

  const ids = new Set();
  const activities = raw.activities.map((a) => {
    if (!a || typeof a !== 'object') fail('Attività non valida.');
    if (typeof a.id !== 'string' || !/^[A-Za-z0-9-]{1,40}$/.test(a.id) || a.id in {} || ids.has(a.id)) fail('Identificativo di attività non valido.');
    ids.add(a.id);
    const name = typeof a.name === 'string' ? a.name.trim() : '';
    if (!name) fail('Attività senza nome.');
    const goal = a.weeklyGoal ?? null;
    if (goal !== null && !(Number.isInteger(goal) && goal >= 1 && goal <= 7)) fail(`Obiettivo non valido per "${name}".`);
    if (!isValidKey(a.createdAt)) fail(`Data di creazione non valida per "${name}".`);
    return {
      id: a.id,
      name: name.slice(0, MAX_NAME),
      icon: typeof a.icon === 'string' && a.icon && a.icon.length <= 16 ? a.icon : '✅',
      weeklyGoal: goal,
      paused: a.paused === true,
      createdAt: a.createdAt,
    };
  });

  const rawChecks = raw.checks ?? {};
  if (typeof rawChecks !== 'object' || Array.isArray(rawChecks)) fail('Elenco delle spunte non valido.');
  const checks = {};
  for (const id of ids) {
    const list = Object.hasOwn(rawChecks, id) ? rawChecks[id] : [];
    if (!Array.isArray(list) || !list.every(isValidKey)) fail('Sono presenti spunte con date non valide.');
    checks[id] = [...new Set(list)].sort();
  }
  return { version: 1, activities, checks };
}

export function createStore(storage, today = todayKey) {
  let data = emptyData();
  let unreadable = false;

  const load = () => {
    const stored = storage.getItem(STORAGE_KEY);
    data = emptyData();
    if (!stored) return;
    try {
      data = validateData(JSON.parse(stored));
    } catch {
      // Dati illeggibili: si mettono da parte invece di sovrascriverli,
      // senza toccare una copia messa da parte in precedenza.
      unreadable = true;
      if (!storage.getItem(CORRUPT_KEY)) storage.setItem(CORRUPT_KEY, stored);
    }
  };
  load();

  const save = () => storage.setItem(STORAGE_KEY, JSON.stringify(data));
  const find = (id) => data.activities.find((a) => a.id === id);
  const clean = ({ name, icon, weeklyGoal }) => ({
    name: String(name).trim().slice(0, MAX_NAME),
    icon: icon || '✅',
    weeklyGoal: weeklyGoal || null,
  });

  return {
    // Rilegge i dati salvati: serve quando un'altra finestra dell'app li ha modificati.
    reload: load,
    wasUnreadable: () => unreadable,
    activities: () => data.activities,
    active: () => data.activities.filter((a) => !a.paused),
    get: find,
    datesOf: (id) => data.checks[id] || [],
    allDates: () => data.activities.flatMap((a) => data.checks[a.id] || []),
    isChecked: (id, key) => (data.checks[id] || []).includes(key),

    // Attività di un giorno, prima le fatte. Compaiono quelle fatte quel giorno
    // e quelle attive già esistenti; le altre non riguardano quella data.
    dayEntries(key) {
      const entries = data.activities
        .map((activity) => ({ activity, done: (data.checks[activity.id] || []).includes(key) }))
        .filter(({ activity, done }) => done || (!activity.paused && activity.createdAt <= key));
      return [...entries.filter((e) => e.done), ...entries.filter((e) => !e.done)];
    },

    add(fields) {
      const activity = {
        id: `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        ...clean(fields),
        paused: false,
        createdAt: today(),
      };
      data.activities.push(activity);
      data.checks[activity.id] = [];
      save();
      return activity;
    },

    update(id, fields) {
      Object.assign(find(id), clean(fields));
      save();
    },

    setPaused(id, paused) {
      find(id).paused = paused;
      save();
    },

    remove(id) {
      data.activities = data.activities.filter((a) => a.id !== id);
      delete data.checks[id];
      save();
    },

    toggle(id, key) {
      const list = data.checks[id] || [];
      data.checks[id] = list.includes(key)
        ? list.filter((d) => d !== key)
        : [...list, key].sort();
      save();
    },

    exportJSON: () => JSON.stringify(data, null, 2),

    // Sostituisce tutti i dati. Se il file non è valido lancia un errore
    // e lascia intatti i dati presenti.
    importJSON(text) {
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        fail('Il file non è un backup leggibile.');
      }
      data = validateData(parsed);
      save();
    },
  };
}
