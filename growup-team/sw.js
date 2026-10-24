/* Growup Team — service worker.
   Tiene in cache solo la "scatola" dell'app, per aprirla in fretta e installarla sulla Home.
   I dati vengono sempre da Supabase, mai dalla cache. Prima la rete, così gli aggiornamenti
   arrivano subito; la cache serve solo quando la rete manca. */
const CACHE = "growup-team-v36";
const SCATOLA = ["./", "index.html", "app.js", "config.js", "listino.js", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png", "favicon-32.png", "icon.svg", "invito-quadrato.png", "invito-stato.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SCATOLA)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if(e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(r => { if(r.ok){ const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); } return r; })
      .catch(() => caches.match(e.request, { ignoreSearch:true }).then(r => r || caches.match("index.html")))
  );
});
