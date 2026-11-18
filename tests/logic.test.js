import { test } from 'node:test';
import assert from 'node:assert/strict';

import { addDays, weekStart, isValidKey, daysInMonth } from '../js/dates.js';
import {
  weekCount, monthCount, yearCount, monthlyCounts, monthlyAverage,
  dayStreak, weekStreak, goalHitRate,
} from '../js/stats.js';
import { createStore, validateData, STORAGE_KEY } from '../js/store.js';

// Mercoledì 11 novembre 2026. La settimana va da lunedì 9 a domenica 15.
const TODAY = '2026-11-11';

const memoryStorage = (initial = {}) => {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    map,
  };
};

// ---------- date ----------

test('la settimana inizia di lunedì', () => {
  assert.equal(weekStart('2026-11-11'), '2026-11-09');
  assert.equal(weekStart('2026-11-09'), '2026-11-09');
  assert.equal(weekStart('2026-11-15'), '2026-11-09');
});

test('la settimana può iniziare nell\'anno precedente', () => {
  assert.equal(weekStart('2027-01-01'), '2026-12-28');
});

test('addDays attraversa mesi, anni e cambi d\'ora', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2026-03-28', 2), '2026-03-30'); // ora legale in Italia
  assert.equal(addDays('2026-10-24', 2), '2026-10-26'); // ora solare
});

test('isValidKey rifiuta date impossibili', () => {
  assert.ok(isValidKey('2026-02-28'));
  assert.ok(!isValidKey('2026-02-30'));
  assert.ok(!isValidKey('2026-2-3'));
  assert.ok(!isValidKey(20261111));
});

test('daysInMonth gestisce gli anni bisestili', () => {
  assert.equal(daysInMonth(2028, 2), 29);
  assert.equal(daysInMonth(2026, 2), 28);
});

// ---------- conteggi ----------

test('conteggi per settimana, mese e anno', () => {
  const dates = ['2025-12-31', '2026-01-01', '2026-11-02', '2026-11-08', '2026-11-09', '2026-11-11'];
  assert.equal(weekCount(dates, TODAY), 2);
  assert.equal(monthCount(dates, 2026, 11), 4);
  assert.equal(yearCount(dates, 2026), 5);
  assert.equal(yearCount(dates, 2025), 1);
  const months = monthlyCounts(dates, 2026);
  assert.equal(months.length, 12);
  assert.equal(months[0], 1);
  assert.equal(months[10], 4);
});

test('le ripetizioni contano, per sommare più attività', () => {
  assert.equal(weekCount(['2026-11-10', '2026-11-10'], TODAY), 2);
});

// ---------- media mensile ----------

test('media mensile: attività creata a metà anno divide per i mesi dalla creazione', () => {
  const dates = ['2026-10-05', '2026-10-06', '2026-11-01', '2026-11-02'];
  assert.equal(monthlyAverage(dates, 2026, TODAY, '2026-10-01'), 2); // 4 spunte / 2 mesi
});

test('media mensile: attività preesistente divide da gennaio al mese corrente', () => {
  const dates = Array.from({ length: 22 }, (_, i) => addDays('2026-01-01', i));
  assert.equal(monthlyAverage(dates, 2026, TODAY, '2025-06-01'), 2); // 22 / 11 mesi
});

test('media mensile: anno passato diviso per i mesi fino a dicembre', () => {
  const dates = ['2025-07-01', '2025-08-01', '2025-12-01'];
  assert.equal(monthlyAverage(dates, 2025, TODAY, '2025-07-01'), 0.5); // 3 / 6 mesi
});

test('media mensile: una spunta precedente alla creazione anticipa il primo mese', () => {
  assert.equal(monthlyAverage(['2026-10-31'], 2026, TODAY, '2026-11-11'), 0.5);
});

test('media mensile: zero per anni futuri o precedenti ai dati', () => {
  assert.equal(monthlyAverage(['2026-11-01'], 2027, TODAY, '2026-11-01'), 0);
  assert.equal(monthlyAverage(['2026-11-01'], 2025, TODAY, '2026-11-01'), 0);
});

// ---------- serie in giorni ----------

test('serie in giorni: comprende oggi se spuntato', () => {
  assert.deepEqual(dayStreak(['2026-11-09', '2026-11-10', '2026-11-11'], TODAY), { current: 3, best: 3 });
});

test('serie in giorni: regge fino a ieri se oggi non è ancora spuntato', () => {
  assert.deepEqual(dayStreak(['2026-11-09', '2026-11-10'], TODAY), { current: 2, best: 2 });
});

test('serie in giorni: si azzera dopo un giorno saltato, ma il record resta', () => {
  const dates = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-09'];
  assert.deepEqual(dayStreak(dates, TODAY), { current: 0, best: 4 });
});

test('serie in giorni: attraversa il cambio d\'anno e ignora le ripetizioni', () => {
  const dates = ['2026-12-30', '2026-12-31', '2026-12-31', '2027-01-01'];
  assert.deepEqual(dayStreak(dates, '2027-01-01'), { current: 3, best: 3 });
});

test('serie in giorni: nessuna spunta', () => {
  assert.deepEqual(dayStreak([], TODAY), { current: 0, best: 0 });
});

// ---------- serie in settimane ----------

// Settimane: 19-25 ott, 26 ott-1 nov, 2-8 nov, 9-15 nov (in corso).
const twoPerWeek = ['2026-10-19', '2026-10-20', '2026-10-26', '2026-10-27', '2026-11-02', '2026-11-03'];

test('serie in settimane: la settimana in corso non raggiunta non interrompe la serie', () => {
  assert.deepEqual(weekStreak([...twoPerWeek, '2026-11-09'], 2, TODAY, '2026-10-19'), { current: 3, best: 3 });
});

test('serie in settimane: la settimana in corso conta appena raggiunta', () => {
  assert.deepEqual(weekStreak([...twoPerWeek, '2026-11-09', '2026-11-10'], 2, TODAY, '2026-10-19'), { current: 4, best: 4 });
});

test('serie in settimane: una settimana conclusa mancata azzera la serie attuale', () => {
  const dates = ['2026-10-19', '2026-10-20', '2026-10-26', '2026-10-27', '2026-11-02'];
  assert.deepEqual(weekStreak(dates, 2, TODAY, '2026-10-19'), { current: 0, best: 2 });
});

test('serie in settimane: attività appena creata', () => {
  assert.deepEqual(weekStreak([], 3, TODAY, TODAY), { current: 0, best: 0 });
});

// ---------- obiettivo centrato ----------

test('obiettivo centrato: conta solo le settimane concluse', () => {
  const dates = ['2026-10-19', '2026-10-20', '2026-10-26', '2026-11-02', '2026-11-03', '2026-11-09', '2026-11-10'];
  assert.deepEqual(goalHitRate(dates, 2, TODAY, '2026-10-19'), { hit: 2, total: 3, rate: 2 / 3 });
});

test('obiettivo centrato: nessun dato finché non si conclude una settimana', () => {
  assert.equal(goalHitRate(['2026-11-09', '2026-11-10'], 2, TODAY, '2026-11-09'), null);
});

test('obiettivo centrato: la prima settimana iniziata a metà non conta come mancata', () => {
  // Creata sabato 31 ottobre con obiettivo 5; settimana successiva 5 su 5.
  const dates = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'];
  assert.deepEqual(goalHitRate(dates, 5, TODAY, '2026-10-31'), { hit: 1, total: 1, rate: 1 });
});

test('obiettivo centrato: la prima settimana iniziata a metà conta se raggiunta', () => {
  const dates = ['2026-10-31', '2026-11-01'];
  assert.deepEqual(goalHitRate(dates, 2, TODAY, '2026-10-31'), { hit: 1, total: 2, rate: 0.5 });
});

// ---------- store ----------

test('store: reload riprende le modifiche salvate da un\'altra finestra', () => {
  const storage = memoryStorage();
  const a = createStore(storage, () => TODAY);
  const act = a.add({ name: 'Palestra', icon: '🏋️', weeklyGoal: 3 });
  const b = createStore(storage, () => TODAY);
  b.toggle(act.id, '2026-11-10');
  b.add({ name: 'Lettura', icon: '📖', weeklyGoal: null });

  a.reload();
  a.toggle(act.id, TODAY);
  const fresh = createStore(storage, () => TODAY);
  assert.equal(fresh.activities().length, 2);
  assert.deepEqual(fresh.datesOf(act.id), ['2026-11-10', TODAY]);
});

test('store: una copia messa da parte non viene sovrascritta da una seconda lettura fallita', () => {
  const storage = memoryStorage({ [STORAGE_KEY]: '{rotto' });
  const store = createStore(storage, () => TODAY);
  assert.ok(store.wasUnreadable());
  storage.setItem(STORAGE_KEY, '{rotto di nuovo');
  createStore(storage, () => TODAY);
  assert.equal(storage.map.get(`${STORAGE_KEY}-illeggibile`), '{rotto');
});

test('store: elenco del giorno con prima le attività fatte', () => {
  const storage = memoryStorage();
  let day = '2026-11-01';
  const store = createStore(storage, () => day);
  const palestra = store.add({ name: 'Palestra', icon: '🏋️', weeklyGoal: 3 });
  const lettura = store.add({ name: 'Lettura', icon: '📖', weeklyGoal: null });
  const pausa = store.add({ name: 'Piscina', icon: '🏊', weeklyGoal: null });
  day = '2026-11-10';
  const nuova = store.add({ name: 'Studio', icon: '📚', weeklyGoal: null });

  store.toggle(lettura.id, '2026-11-05');
  store.toggle(pausa.id, '2026-11-05');
  store.setPaused(pausa.id, true);
  store.toggle(nuova.id, '2026-11-05'); // spunta registrata prima della creazione

  const view = (key) => store.dayEntries(key).map((e) => `${e.activity.name}:${e.done ? 'si' : 'no'}`);

  // Fatte prima; la pausa compare perché fatta; Studio perché spuntato.
  assert.deepEqual(view('2026-11-05'), ['Lettura:si', 'Piscina:si', 'Studio:si', 'Palestra:no']);
  // In pausa e non fatta: non compare. Creata dopo: non compare.
  assert.deepEqual(view('2026-11-06'), ['Palestra:no', 'Lettura:no']);
  // Prima della creazione di tutte: elenco vuoto.
  assert.deepEqual(view('2026-10-20'), []);
  assert.equal(palestra.createdAt, '2026-11-01');
});

test('validateData: rifiuta identificativi che collidono con proprietà interne', () => {
  const act = (id) => ({ id, name: 'X', icon: '✅', weeklyGoal: null, paused: false, createdAt: TODAY });
  for (const id of ['__proto__', 'constructor', 'toString', 'a b', '']) {
    assert.throws(() => validateData({ version: 1, activities: [act(id)], checks: {} }), /Identificativo/);
  }
});

test('store: aggiunge, spunta e salva subito', () => {
  const storage = memoryStorage();
  const store = createStore(storage, () => TODAY);
  const a = store.add({ name: '  Palestra  ', icon: '🏋️', weeklyGoal: 3 });
  assert.equal(a.name, 'Palestra');
  assert.equal(a.createdAt, TODAY);

  store.toggle(a.id, '2026-11-11');
  store.toggle(a.id, '2026-11-09');
  assert.deepEqual(store.datesOf(a.id), ['2026-11-09', '2026-11-11']);
  store.toggle(a.id, '2026-11-11');
  assert.deepEqual(store.datesOf(a.id), ['2026-11-09']);

  const reloaded = createStore(storage, () => TODAY);
  assert.equal(reloaded.activities().length, 1);
  assert.ok(reloaded.isChecked(a.id, '2026-11-09'));
});

test('store: la pausa nasconde dalle attive ma conserva lo storico', () => {
  const store = createStore(memoryStorage(), () => TODAY);
  const a = store.add({ name: 'Lettura', icon: '📖', weeklyGoal: null });
  store.toggle(a.id, TODAY);
  store.setPaused(a.id, true);
  assert.equal(store.active().length, 0);
  assert.equal(store.activities().length, 1);
  assert.deepEqual(store.datesOf(a.id), [TODAY]);
});

test('store: eliminare cancella anche lo storico', () => {
  const store = createStore(memoryStorage(), () => TODAY);
  const a = store.add({ name: 'Studio', icon: '📚', weeklyGoal: null });
  store.toggle(a.id, TODAY);
  store.remove(a.id);
  assert.equal(store.activities().length, 0);
  assert.deepEqual(store.allDates(), []);
});

test('store: esporta e reimporta gli stessi dati', () => {
  const store = createStore(memoryStorage(), () => TODAY);
  const a = store.add({ name: 'Piscina', icon: '🏊', weeklyGoal: 2 });
  store.toggle(a.id, TODAY);
  const backup = store.exportJSON();

  const other = createStore(memoryStorage(), () => TODAY);
  other.add({ name: 'Da sostituire', icon: '✅', weeklyGoal: null });
  other.importJSON(backup);
  assert.equal(other.activities().length, 1);
  assert.equal(other.activities()[0].name, 'Piscina');
  assert.deepEqual(other.datesOf(a.id), [TODAY]);
});

test('store: un import non valido viene rifiutato senza toccare i dati', () => {
  const store = createStore(memoryStorage(), () => TODAY);
  store.add({ name: 'Palestra', icon: '🏋️', weeklyGoal: 3 });
  assert.throws(() => store.importJSON('non è json'));
  assert.throws(() => store.importJSON('{"version":1}'));
  assert.throws(() => store.importJSON('[]'));
  assert.equal(store.activities().length, 1);
});

test('store: dati salvati illeggibili vengono messi da parte, non persi', () => {
  const storage = memoryStorage({ [STORAGE_KEY]: '{rotto' });
  const store = createStore(storage, () => TODAY);
  assert.equal(store.activities().length, 0);
  assert.equal(storage.map.get(`${STORAGE_KEY}-illeggibile`), '{rotto');
});

test('validateData: rifiuta obiettivi, date e identificativi non validi', () => {
  const base = { id: 'a1', name: 'X', icon: '✅', weeklyGoal: null, paused: false, createdAt: TODAY };
  const wrap = (activity, checks = {}) => ({ version: 1, activities: [activity], checks });
  assert.throws(() => validateData(wrap({ ...base, weeklyGoal: 9 })));
  assert.throws(() => validateData(wrap({ ...base, createdAt: '2026-13-01' })));
  assert.throws(() => validateData(wrap({ ...base, name: '   ' })));
  assert.throws(() => validateData(wrap(base, { a1: ['ieri'] })));
  assert.throws(() => validateData({ version: 1, activities: [base, base], checks: {} }));
  assert.throws(() => validateData({ version: 2, activities: [], checks: {} }));
});

test('validateData: normalizza le spunte e scarta quelle di attività inesistenti', () => {
  const data = validateData({
    version: 1,
    activities: [{ id: 'a1', name: 'X', icon: '', weeklyGoal: 2, createdAt: TODAY }],
    checks: { a1: ['2026-11-11', '2026-11-09', '2026-11-11'], fantasma: ['2026-11-01'] },
  });
  assert.deepEqual(data.checks, { a1: ['2026-11-09', '2026-11-11'] });
  assert.equal(data.activities[0].paused, false);
  assert.equal(data.activities[0].icon, '✅');
});
