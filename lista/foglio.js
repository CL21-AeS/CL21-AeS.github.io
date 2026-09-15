/* ══════════════════════════════════════════════════════════════════════
   Dalla Lista al Sì — memoria su foglio Google

   Sta accanto a index.html e si carica da lì con una riga in fondo:
       <script src="foglio.js"></script>

   La parola non è scritta qui: l'app la chiede la prima volta su ogni
   dispositivo e se la tiene lì. Così questa pagina può stare su un sito
   pubblico senza portarsi dietro nessun segreto.
   ══════════════════════════════════════════════════════════════════════ */

(() => {
  "use strict";

  /* L'indirizzo può stare in chiaro: da solo non apre niente, perché il
     programma sul foglio pretende anche la parola. */
  const INDIRIZZO = "https://script.google.com/macros/s/AKfycbxFObLZkQtuyUZRjcHsrVVISoBrp3i-F4XxtQldJYtp2I2hzqXHR66S25KT5ILhNu0mug/exec";

  const KEY = "dalla-lista-al-si.v1";
  /* La parola vive in una casella sua: fuori dall'archivio, così non finisce
     nei backup, nel testo da copiare, né sul foglio. */
  const CASSETTO = "dalla-lista-al-si.parola";

  if (!/^https:\/\/script\.google\.com\//.test(INDIRIZZO)) return;

  const scriviGrezzo = Storage.prototype.setItem;
  let PAROLA = "";
  try { PAROLA = localStorage.getItem(CASSETTO) || ""; } catch (e) {}

  const ricorda = p => { try { scriviGrezzo.call(localStorage, CASSETTO, p); } catch (e) {} };

  const vuoto = () => ({ v: 1, people: [], deleted: [],
    settings: { nome: "", goals: { contatto: 10, invito: 6, piano: 3, chiusura: 1 },
                lastBackup: "", snoozeBackup: "" } });

  const leggiLocale = () => {
    try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : vuoto(); }
    catch (e) { return vuoto(); }
  };
  const scriviLocale = st => {
    try { scriviGrezzo.call(localStorage, KEY, JSON.stringify(st)); } catch (e) {}
  };

  /* ── Fusione ─────────────────────────────────────────────────────────
     Stessa regola dell'app: i passi registrati si sommano perché hanno un
     id proprio, sulle schede vince chi è stato toccato più tardi, e le
     cancellazioni battono le versioni più vecchie di sé. Così telefono,
     computer e foglio si possono unire in qualunque ordine, quante volte
     si vuole, senza che nulla sparisca. */

  const FASI = ["lista", "contatto", "invito", "piano", "followup"];

  function ricalcola(p) {
    let fase = 0, esito = null, quando = null;
    for (const e of p.events || []) {
      const i = FASI.indexOf(e.type);
      if (i > 0) fase = Math.max(fase, i);
      if (e.type === "esito" || e.reopen) {
        if (quando === null || e.date >= quando) {
          quando = e.date;
          esito = e.reopen ? null : (e.outcome || null);
        }
      }
    }
    p.reached = fase;
    p.outcome = esito;
  }

  function unisci(a, b) {
    const tombe = new Map();
    for (const t of [...(a.deleted || []), ...(b.deleted || [])]) {
      if (t && t.id && (!tombe.has(t.id) || t.at > tombe.get(t.id))) tombe.set(t.id, t.at);
    }

    const coppie = new Map();
    for (const p of a.people || []) coppie.set(p.id, { x: p });
    for (const p of b.people || []) coppie.set(p.id, { ...(coppie.get(p.id) || {}), y: p });

    const people = [];
    for (const [id, { x, y }] of coppie) {
      const vince = !x ? y : !y ? x : ((y.updatedAt || "") > (x.updatedAt || "") ? y : x);
      const tomba = tombe.get(id);
      if (tomba && tomba > (vince.updatedAt || "")) continue;
      if (!x || !y) { people.push({ ...vince, events: [...(vince.events || [])] }); continue; }

      const perde = vince === y ? x : y;
      const ev = new Map();
      for (const e of [...(perde.events || []), ...(vince.events || [])]) ev.set(e.id, e);
      const p = { ...vince, events: [...ev.values()].sort((m, n) => (m.date < n.date ? -1 : m.date > n.date ? 1 : 0)) };
      ricalcola(p);
      people.push(p);
    }

    people.sort((m, n) => (m.id < n.id ? -1 : 1));

    /* Impostazioni: comanda il dispositivo, salvo che sia vuoto — è il caso
       del telefono nuovo, che deve prendersele dal foglio. */
    const impostazioni = (a.people && a.people.length) ? (a.settings || b.settings) : (b.settings || a.settings);

    return {
      v: 1,
      people,
      deleted: [...tombe].map(([id, at]) => ({ id, at })).sort((m, n) => (m.id < n.id ? -1 : 1)),
      settings: impostazioni || vuoto().settings,
    };
  }

  const firma = st => JSON.stringify(unisci(st, vuoto()));

  /* ── Foglio ──────────────────────────────────────────────────────────
     Tre risposte diverse, perché tre guasti diversi vogliono tre rimedi
     diversi: una parola sbagliata si corregge, la rete assente si aspetta. */

  async function scarica(parola) {
    try {
      const r = await fetch(`${INDIRIZZO}?token=${encodeURIComponent(parola)}&t=${Date.now()}`, { redirect: "follow" });
      const d = await r.json();
      if (d && Array.isArray(d.people)) return { esito: "ok", dati: d };
      return { esito: "parola" };
    } catch (e) { return { esito: "rete" }; }
  }

  /* Il tipo «text/plain» non è un capriccio: con «application/json» il
     browser manda prima una richiesta di controllo che Apps Script non sa
     ricevere, e la scrittura fallisce. */
  async function carica(st) {
    try {
      const r = await fetch(INDIRIZZO, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ token: PAROLA, state: st }),
      });
      const d = await r.json();
      return !!(d && d.ok);
    } catch (e) { return false; }
  }

  /* ── Spia in basso ──────────────────────────────────────────────────── */

  let spia = null;

  /* Su telefono le sezioni diventano una barra in fondo allo schermo: la
     pastiglia va appoggiata sopra quella, o ne copre il primo pulsante.
     L'altezza si misura invece di indovinarla, così torna anche sui
     telefoni che tengono una striscia libera in fondo. */
  function posiziona() {
    if (!spia) return;
    const barra = document.getElementById("rail");
    const stretto = window.innerWidth <= 900;
    const h = stretto && barra ? Math.round(barra.getBoundingClientRect().height) : 0;
    spia.style.bottom = (h ? h + 8 : 10) + "px";
  }

  function segna(testo, colore) {
    if (!spia) {
      spia = document.createElement("button");
      spia.type = "button";
      spia.style.cssText = "position:fixed;left:10px;bottom:10px;z-index:70;display:flex;" +
        "align-items:center;gap:6px;padding:7px 12px;border-radius:999px;cursor:pointer;" +
        "border:1px solid var(--rule,#ddd);background:var(--surface,#fff);color:var(--ink-3,#666);" +
        "font:500 11px/1.4 ui-monospace,Menlo,monospace;text-transform:uppercase;letter-spacing:.06em";
      spia.addEventListener("click", () => (PAROLA ? sincronizza() : chiedi()));
      document.body.appendChild(spia);
      window.addEventListener("resize", posiziona);
      window.addEventListener("orientationchange", () => setTimeout(posiziona, 250));
    }
    spia.title = PAROLA ? "Tocca per sincronizzare adesso" : "Tocca per collegare il foglio";
    spia.innerHTML = `<i style="width:6px;height:6px;border-radius:999px;background:${colore};display:block"></i>foglio: ${testo}`;
    posiziona();
  }
  const ok = () => segna("salvato", "var(--good,#0F7A45)");
  const attesa = () => segna("salvo…", "var(--warn,#8A6410)");
  const guasto = () => segna("non raggiungo", "var(--crit,#9E2B25)");
  const slegato = () => segna("da collegare", "var(--ink-3,#888)");

  /* ── La parola ─────────────────────────────────────────────────────── */

  function chiedi(avviso) {
    if (document.getElementById("fg-box")) return;
    const d = document.createElement("div");
    d.id = "fg-box";
    d.innerHTML = `
      <div style="position:fixed;inset:0;z-index:80;background:rgba(10,16,13,.5)"></div>
      <div role="dialog" aria-modal="true" style="position:fixed;z-index:81;left:50%;top:50%;
        transform:translate(-50%,-50%);width:min(390px,calc(100% - 24px));
        background:var(--surface,#fff);color:var(--ink,#131A16);border:1px solid var(--rule,#ddd);
        border-radius:12px;padding:20px;box-shadow:0 10px 30px rgba(0,0,0,.35)">
        <div style="font:500 10.5px/1.4 ui-monospace,Menlo,monospace;text-transform:uppercase;
          letter-spacing:.1em;color:var(--ink-3,#666)">Memoria sul foglio</div>
        <h2 style="margin:4px 0 0;font-size:17px;font-weight:600">Collega questo dispositivo</h2>
        <p style="margin:8px 0 0;font-size:13.5px;color:var(--ink-2,#4C5852);line-height:1.5">
          Scrivi la parola che hai messo nel programma del foglio. Te la chiedo una volta sola:
          resta su questo dispositivo, e da qui in poi la lista si salva da sola.</p>
        <input id="fg-in" type="text" autocapitalize="none" autocorrect="off" autocomplete="off"
          spellcheck="false" placeholder="la tua parola"
          style="width:100%;margin-top:14px;padding:10px 12px;border:1px solid var(--rule,#ddd);
            border-radius:7px;background:var(--surface-2,#F6F8F5);color:var(--ink,#131A16);
            font-size:16px;outline:none;box-sizing:border-box">
        <p id="fg-msg" style="margin:8px 0 0;font-size:12.5px;color:var(--crit,#9E2B25);min-height:17px">${avviso || ""}</p>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap">
          <button id="fg-no" style="padding:10px 14px;border:1px solid transparent;border-radius:7px;
            background:transparent;color:var(--ink-2,#4C5852);font-size:13.5px;cursor:pointer">Più tardi</button>
          <button id="fg-si" style="padding:10px 16px;border:1px solid var(--accent,#1D6A52);border-radius:7px;
            background:var(--accent,#1D6A52);color:var(--accent-ink,#fff);font-size:13.5px;font-weight:600;
            cursor:pointer">Collega</button>
        </div>
      </div>`;
    document.body.appendChild(d);

    const campo = d.querySelector("#fg-in");
    const msg = d.querySelector("#fg-msg");
    const chiudi = () => d.remove();

    d.querySelector("#fg-no").addEventListener("click", () => { chiudi(); slegato(); });

    async function prova() {
      /* La tastiera del telefono ama le maiuscole e gli spazi in coda: se
         non si puliscono, la parola giusta sembra sbagliata. */
      const p = campo.value.trim();
      if (!p) { campo.focus(); return; }
      msg.style.color = "var(--ink-3,#666)";
      msg.textContent = "Controllo…";
      const r = await scarica(p);
      if (r.esito === "rete") { msg.style.color = "var(--crit,#9E2B25)"; msg.textContent = "Nessuna rete. Riprova fra poco."; return; }
      if (r.esito === "parola") { msg.style.color = "var(--crit,#9E2B25)"; msg.textContent = "Non è la parola giusta."; campo.select(); return; }
      PAROLA = p;
      ricorda(p);
      chiudi();
      allinea(r.dati);
    }

    d.querySelector("#fg-si").addEventListener("click", prova);
    campo.addEventListener("keydown", e => { if (e.key === "Enter") prova(); });
    setTimeout(() => campo.focus(), 50);
  }

  /* ── Vita ───────────────────────────────────────────────────────────── */

  let attesaT = null, inCorso = false;

  function allinea(remoto) {
    const locale = leggiLocale();
    const fuso = unisci(locale, remoto);
    const testo = JSON.stringify(fuso);
    /* Il foglio aveva qualcosa che qui non c'era: lo si scrive e si ricarica
       la pagina, perché l'app ha già disegnato tutto con i dati vecchi. */
    if (testo !== firma(locale)) { scriviLocale(fuso); location.reload(); return; }
    if (testo !== firma(remoto)) { carica(fuso).then(b => (b ? ok() : guasto())); return; }
    ok();
  }

  async function sincronizza() {
    if (inCorso || !PAROLA) return;
    inCorso = true;
    attesa();
    const r = await scarica(PAROLA);
    if (r.esito === "rete") { guasto(); inCorso = false; return; }
    if (r.esito === "parola") { slegato(); inCorso = false; chiedi("La parola non funziona più: riscrivila."); return; }
    const locale = leggiLocale();
    const fuso = unisci(locale, r.dati);
    if (JSON.stringify(fuso) !== firma(locale)) scriviLocale(fuso);
    (await carica(fuso)) ? ok() : guasto();
    inCorso = false;
  }

  async function avvio() {
    if (!PAROLA) { slegato(); chiedi(); return; }
    attesa();
    const r = await scarica(PAROLA);
    if (r.esito === "rete") { guasto(); return; }
    if (r.esito === "parola") { slegato(); chiedi("La parola non funziona più: riscrivila."); return; }
    allinea(r.dati);
  }

  Storage.prototype.setItem = function (chiave) {
    scriviGrezzo.apply(this, arguments);
    if (this === localStorage && chiave === KEY) {
      clearTimeout(attesaT);
      attesaT = setTimeout(sincronizza, 1500);
    }
  };

  /* Sul telefono la pagina non si chiude: si mette da parte. È lì che va
     salvato quello che è appena stato scritto, e da lì che si riprende. */
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") { clearTimeout(attesaT); sincronizza(); }
    else if (PAROLA && !inCorso) sincronizza();
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", avvio);
  else avvio();
})();
