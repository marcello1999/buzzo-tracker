// Uso offline. I file dell'app si prendono dalla rete quando c'è (così gli
// aggiornamenti arrivano subito) e dalla cache quando manca. I font, che non
// cambiano, si prendono dalla cache.

const CACHE_PREFIX = 'buzzo-tracker-';
const CACHE = `${CACHE_PREFIX}v1`;
const NETWORK_TIMEOUT_MS = 3000;
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/app.js',
  'js/dates.js',
  'js/stats.js',
  'js/store.js',
  'js/ui.js',
  'js/views/today.js',
  'js/views/stats.js',
  'js/views/activities.js',
  'icons/icon.svg',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  // `reload` scavalca la copia del browser: la cache offline parte dai file appena pubblicati.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const store = async (request, response) => {
  if (response.ok || response.type === 'opaque') {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request).then((res) => store(request, res))));
    return;
  }
  if (url.origin !== self.location.origin) return;

  const fromCache = () =>
    caches
      .match(request, { ignoreSearch: true })
      .then((hit) => hit || (request.mode === 'navigate' ? caches.match('index.html') : undefined));

  // Risposta di rete valida, altrimenti la copia in cache (anche per errori del server).
  // `no-cache` chiede sempre al server se il file è cambiato, invece di riusare per
  // 10 minuti la copia del browser: così un aggiornamento arriva alla prima riapertura.
  // Se il file non è cambiato il server risponde senza rimandarlo, quindi resta leggero.
  const network = fetch(request, { cache: 'no-cache' })
    .then((res) => (res.ok ? store(request, res) : fromCache().then((hit) => hit || res)))
    .catch(() => fromCache().then((hit) => hit || Response.error()));

  // Con rete lenta o bloccata non si aspetta oltre: si usa la cache.
  const slow = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT_MS))
    .then(fromCache)
    .then((hit) => hit || network);

  event.respondWith(Promise.race([network, slow]));
});
