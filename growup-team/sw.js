/* Growup Team — service worker.
   Tiene in cache solo la "scatola" dell'app, per aprirla in fretta e installarla sulla Home.
   I dati vengono sempre da Supabase, mai dalla cache. Prima la rete, così gli aggiornamenti
   arrivano subito; la cache serve solo quando la rete manca. */
const CACHE = "growup-team-v113";
const CONDIVISI = "growup-condivisi";   // i contatti condivisi con Growup, solo finché l'app li legge
const SCATOLA = ["./", "index.html", "app.js", "config.js", "listino.js", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png", "favicon-32.png", "badge-96.png", "icon.svg", "invito-quadrato.png", "invito-stato.png", "lib/supabase-2.117.2.js", "fonti/fonti.css", "fonti/manrope-latin-wght-normal.woff2", "fonti/cormorant-garamond-latin-600-normal.woff2", "fonti/cormorant-garamond-latin-700-normal.woff2", "fonti/source-serif-4-latin-700-normal.woff2"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SCATOLA)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(k => Promise.all(k.filter(x => x !== CACHE && x !== CONDIVISI).map(x => caches.delete(x))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  /* «Condividi → Growup» dall'app Contatti (share_target del manifest) */
  if(e.request.method === "POST" && url.origin === location.origin && url.pathname.endsWith("/condividi")){
    e.respondWith(riceviCondivisi(e.request)); return;
  }
  if(e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(r => { if(r.ok){ const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); } return r; })
      .catch(() => caches.match(e.request, { ignoreSearch:true }).then(r => r || caches.match("index.html")))
  );
});

/* 039: le notifiche. Il contenuto arriva cifrato dal server (mai nomi); il tocco apre Growup sulla pagina giusta. */
self.addEventListener("push", e => {
  let d = {};
  try{ d = e.data ? e.data.json() : {}; }catch(x){ d = { corpo:e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.titolo || "Growup", {
    body:d.corpo || "", icon:"icon-192.png", badge:"badge-96.png", tag:d.tag || "growup", data:{ url:d.url || "./" }
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const dove = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type:"window", includeUncontrolled:true }).then(l => {
    const aperta = l.find(c => c.url.startsWith(self.registration.scope));
    if(aperta){ return aperta.focus().then(c => c && c.navigate ? c.navigate(dove) : c); }
    return self.clients.openWindow(dove);
  }));
});

/* «Condividi → Growup»: l'app Contatti di Android manda uno o più contatti come file vCard (.vcf). Qui si leggono e si
   tengono SOLO nome e numeri di telefono (niente email, indirizzi, foto, note); il file non si salva. Nomi e numeri
   restano sul telefono, in una cache che l'app legge e cancella subito (prendiCondivisi in app.js). Poi si apre Growup. */
async function riceviCondivisi(richiesta){
  let contatti = [];
  try{
    const dati = await richiesta.formData(), testi = [];
    for(const f of dati.getAll("contatti")) if(f && typeof f.text === "function" && f.size < 10 * 1024 * 1024) testi.push(await f.text());
    for(const k of ["text", "title"]){ const t = dati.get(k); if(typeof t === "string" && /BEGIN:VCARD/i.test(t)) testi.push(t); }
    for(const t of testi) contatti = contatti.concat(contattiDaVcard(t));
  }catch(x){ contatti = []; }
  const c = await caches.open(CONDIVISI);
  await c.put(new URL("condivisi", self.registration.scope).href,
    new Response(JSON.stringify(contatti.slice(0, 500)), { headers:{ "Content-Type":"application/json" } }));
  return Response.redirect(new URL("./?condivisi=1", self.registration.scope).href, 303);
}

/* vCard 2.1, 3.0 e 4.0: righe ripiegate, quoted-printable (i nomi con gli accenti delle rubriche Samsung), testo con «\».
   Ogni contatto → { nome, tel:[...] }: il nome da FN, altrimenti da N (nome e cognome); i numeri da TEL così come sono
   (li pulisce l'app, come quelli della Rubrica). */
function contattiDaVcard(testo){
  const righe = [];
  for(const r of String(testo || "").replace(/\r\n?/g, "\n").split("\n")){
    if(/^[ \t]/.test(r) && righe.length){ righe[righe.length - 1] += r.slice(1); continue; }   // riga ripiegata
    righe.push(r);
  }
  /* quoted-printable: una riga che finisce con «=» continua nella successiva */
  for(let i = 0; i < righe.length; i++){
    while(/QUOTED-PRINTABLE/i.test(righe[i].split(":")[0]) && /=$/.test(righe[i]) && i + 1 < righe.length)
      righe[i] = righe[i].slice(0, -1) + righe.splice(i + 1, 1)[0];
  }
  const qp = v => { try{ const b = []; for(let i = 0; i < v.length; i++){
      if(v[i] === "=" && /^[0-9A-F]{2}$/i.test(v.substr(i + 1, 2))){ b.push(parseInt(v.substr(i + 1, 2), 16)); i += 2; } else b.push(v.charCodeAt(i) & 255); }
    return new TextDecoder("utf-8").decode(new Uint8Array(b)); }catch(x){ return v; } };
  const testoV = v => v.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();
  const out = []; let c = null;
  for(const r of righe){
    const due = r.indexOf(":");
    if(due < 0) continue;
    const testa = r.slice(0, due), parametri = testa.split(";"), nome = parametri[0].split(".").pop().toUpperCase();
    let v = r.slice(due + 1);
    if(nome === "BEGIN" && /^VCARD$/i.test(v.trim())){ c = { fn:"", n:"", tel:[] }; continue; }
    if(nome === "END" && /^VCARD$/i.test(v.trim())){
      if(c){ const n = (c.fn || c.n).replace(/\s+/g, " ").trim().slice(0, 80); if(n || c.tel.length) out.push({ nome:n, tel:c.tel.slice(0, 10) }); }
      c = null; continue;
    }
    if(!c) continue;
    if(/QUOTED-PRINTABLE/i.test(testa)) v = qp(v);
    if(nome === "FN") c.fn = testoV(v);
    else if(nome === "N"){ const p = v.split(/(?<!\\);/).map(testoV); c.n = [p[3], p[1], p[2], p[0], p[4]].filter(Boolean).join(" "); }
    else if(nome === "TEL"){ const t = v.trim().replace(/^tel:/i, ""); if(t) c.tel.push(t.slice(0, 40)); }
  }
  return out;
}
