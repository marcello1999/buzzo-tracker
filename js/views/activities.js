import { todayKey } from '../dates.js';
import { esc, openSheet, confirmDialog, toast } from '../ui.js';

const ICONS = [
  '🏋️', '🏊', '🏃', '🚴', '🧘', '⚽', '🥾', '🎾',
  '📖', '📚', '✍️', '🧠', '💻', '🌍', '🎸', '🎨',
  '💧', '🥗', '😴', '💊', '🧹', '💰', '📵', '✅',
];

const goalText = (a) =>
  a.weeklyGoal ? `${a.weeklyGoal} ${a.weeklyGoal === 1 ? 'volta' : 'volte'} a settimana` : 'Nessun obiettivo';

const row = (a) => `
  <li>
    <button type="button" class="act${a.paused ? ' paused' : ''}" data-id="${esc(a.id)}">
      <span class="ico" aria-hidden="true">${esc(a.icon)}</span>
      <span class="txt">
        <span class="nm">${esc(a.name)}</span><br>
        <span class="meta">${goalText(a)}</span>
      </span>
      <span class="go" aria-hidden="true">›</span>
    </button>
  </li>`;

export function mount(root, ctx) {
  const { store, render } = ctx;
  const active = store.active();
  const paused = store.activities().filter((a) => a.paused);
  const hasData = store.activities().length > 0;

  root.innerHTML = `
    <h2 class="kicker">Attive</h2>
    ${active.length
      ? `<ul class="acts">${active.map(row).join('')}</ul>`
      : '<p class="note">Nessuna attività attiva. Aggiungine una per iniziare a tracciarla.</p>'}
    <button type="button" class="btn btn-primary add-btn" data-act="new">+ Nuova attività</button>

    ${paused.length
      ? `<h2 class="kicker">In pausa</h2>
         <p class="note">Non compaiono in “Oggi”, ma lo storico resta nelle statistiche.</p>
         <ul class="acts">${paused.map(row).join('')}</ul>`
      : ''}

    <h2 class="kicker">Backup</h2>
    <p class="note">I dati restano solo su questo dispositivo. Esporta ogni tanto un backup per non perderli se cambi telefono o cancelli i dati del browser.</p>
    <div class="btn-row">
      <button type="button" class="btn btn-ghost" data-act="export" ${hasData ? '' : 'disabled style="opacity:.45"'}>Esporta</button>
      <button type="button" class="btn btn-ghost" data-act="import">Importa</button>
    </div>
    <input type="file" accept="application/json,.json" hidden>`;

  const fileInput = root.querySelector('input[type="file"]');
  fileInput.onchange = async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    let text;
    try {
      text = await file.text();
    } catch {
      toast('Non è stato possibile leggere il file.', true);
      return;
    }
    if (hasData) {
      const ok = await confirmDialog({
        title: 'Importare il backup?',
        message: 'I dati presenti su questo dispositivo verranno sostituiti da quelli del file.',
        okLabel: 'Sostituisci',
        danger: true,
      });
      if (!ok) return;
    }
    try {
      store.importJSON(text);
      render();
      toast('Backup importato.');
    } catch (err) {
      toast(err.message, true);
    }
  };

  root.onclick = (e) => {
    const act = e.target.closest('.act');
    if (act) return openForm(ctx, store.get(act.dataset.id));
    const action = e.target.closest('[data-act]')?.dataset.act;
    if (action === 'new') openForm(ctx, null);
    else if (action === 'export') exportBackup(store);
    else if (action === 'import') fileInput.click();
  };
}

async function exportBackup(store) {
  const name = `buzzo-tracker-backup-${todayKey()}.json`;
  const file = new File([store.exportJSON()], name, { type: 'application/json' });
  // Sul telefono si passa dal menu di condivisione (Salva su File, ecc.).
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Backup BUZZO Tracker' });
    } catch (err) {
      if (err.name !== 'AbortError') toast('Esportazione non riuscita.', true);
    }
    return;
  }
  const url = URL.createObjectURL(file);
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Backup scaricato.');
}

function openForm({ store, render }, activity) {
  const editing = Boolean(activity);
  const current = activity ?? { name: '', icon: ICONS[0], weeklyGoal: null, paused: false };
  const icons = ICONS.includes(current.icon) ? ICONS : [current.icon, ...ICONS.slice(0, -1)];

  const iconPick = icons
    .map((i) => `<label><input type="radio" name="icon" value="${esc(i)}"${i === current.icon ? ' checked' : ''}><span>${esc(i)}</span></label>`)
    .join('');
  const goalPick = [0, 1, 2, 3, 4, 5, 6, 7]
    .map((g) => `<label><input type="radio" name="goal" value="${g}"${g === (current.weeklyGoal ?? 0) ? ' checked' : ''} aria-label="${g ? `${g} a settimana` : 'Nessun obiettivo'}"><span>${g || '–'}</span></label>`)
    .join('');

  openSheet(
    `<form novalidate>
       <h2>${editing ? 'Modifica attività' : 'Nuova attività'}</h2>
       <div class="field">
         <label for="f-name">Nome</label>
         <input type="text" id="f-name" name="name" maxlength="40" autocomplete="off" enterkeyhint="done" placeholder="Es. Palestra" value="${esc(current.name)}">
         <p class="err" hidden>Scrivi un nome per l'attività.</p>
       </div>
       <div class="field">
         <span class="lbl">Icona</span>
         <div class="pick emoji">${iconPick}</div>
       </div>
       <div class="field">
         <span class="lbl">Obiettivo settimanale</span>
         <div class="pick goal">${goalPick}</div>
         <p class="hint">Quante volte a settimana vuoi farla. Scegli “–” per contare soltanto.</p>
       </div>
       <div class="stack">
         <button type="submit" class="btn btn-primary">${editing ? 'Salva' : 'Aggiungi'}</button>
         <button type="button" class="btn btn-ghost" data-do="cancel">Annulla</button>
       </div>
       ${editing
         ? `<div class="sep"></div>
            <div class="stack">
              <button type="button" class="btn btn-ghost" data-do="pause">${current.paused ? 'Riattiva' : 'Metti in pausa'}</button>
              <button type="button" class="btn btn-danger" data-do="delete">Elimina</button>
            </div>`
         : ''}
     </form>`,
    (dlg, close) => {
      const form = dlg.querySelector('form');
      const nameInput = form.elements.name;
      const error = form.querySelector('.err');

      form.onsubmit = (e) => {
        e.preventDefault();
        const name = nameInput.value.trim();
        if (!name) {
          error.hidden = false;
          nameInput.focus();
          return;
        }
        const fields = { name, icon: form.elements.icon.value, weeklyGoal: Number(form.elements.goal.value) || null };
        if (editing) store.update(activity.id, fields);
        else store.add(fields);
        close();
        render();
      };
      nameInput.oninput = () => (error.hidden = true);

      form.onclick = async (e) => {
        const action = e.target.closest('[data-do]')?.dataset.do;
        if (action === 'cancel') close();
        else if (action === 'pause') {
          store.setPaused(activity.id, !activity.paused);
          close();
          render();
        } else if (action === 'delete') {
          const ok = await confirmDialog({
            title: `Eliminare “${activity.name}”?`,
            message: 'Verrà cancellato anche tutto lo storico delle spunte. Se vuoi conservarlo, mettila in pausa.',
            okLabel: 'Elimina',
            danger: true,
          });
          if (ok) {
            store.remove(activity.id);
            render();
          }
        }
      };
    }
  );
}
