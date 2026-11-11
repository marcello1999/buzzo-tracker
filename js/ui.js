// Elementi di interfaccia condivisi: escape del testo, finestre e avvisi.

export const esc = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const sheet = () => document.getElementById('sheet');

// Vero solo per un tocco sullo sfondo scuro, non sul margine interno della finestra.
const isBackdropTap = (e, dlg) => {
  if (e.target !== dlg) return false;
  const r = dlg.getBoundingClientRect();
  return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
};

// Apre la finestra dal basso con il contenuto dato. `setup` riceve la finestra
// e la funzione per chiuderla. Un tocco fuori dalla finestra la chiude.
export function openSheet(html, setup) {
  const dlg = sheet();
  dlg.innerHTML = html;
  const close = () => dlg.close();
  dlg.onclick = (e) => {
    if (isBackdropTap(e, dlg)) close();
  };
  dlg.oncancel = null;
  setup(dlg, close);
  // Può essere già aperta: una conferma che sostituisce il modulo di modifica.
  if (!dlg.open) dlg.showModal();
  dlg.scrollTop = 0;
}

export function confirmDialog({ title, message, okLabel, danger = false }) {
  return new Promise((resolve) => {
    openSheet(
      `<h2>${esc(title)}</h2>
       <p class="msg">${esc(message)}</p>
       <div class="btn-row">
         <button type="button" class="btn btn-ghost" data-no>Annulla</button>
         <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes>${esc(okLabel)}</button>
       </div>`,
      (dlg, close) => {
        // La risposta non passa dall'evento "close" della finestra: arriva in
        // ritardo e potrebbe essere scambiato con quello di un'apertura precedente.
        let settled = false;
        const finish = (answer) => {
          if (settled) return;
          settled = true;
          close();
          resolve(answer);
        };
        dlg.querySelector('[data-yes]').onclick = () => finish(true);
        dlg.querySelector('[data-no]').onclick = () => finish(false);
        dlg.onclick = (e) => {
          if (isBackdropTap(e, dlg)) finish(false);
        };
        dlg.oncancel = (e) => {
          e.preventDefault();
          finish(false);
        };
      }
    );
  });
}

let toastTimer;
export function toast(message, isError = false) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = `toast${isError ? ' err' : ''}`;
  el.setAttribute('role', 'status');
  el.textContent = message;
  // Dentro la finestra aperta, se c'è, altrimenti resterebbe coperto.
  (sheet().open ? sheet() : document.body).append(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 3200);
}
