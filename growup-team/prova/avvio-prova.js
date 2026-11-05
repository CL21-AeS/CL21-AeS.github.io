/* Growup Team · versione di prova.
   È l'app vera (index.html, app.js, listino.js) con una sola parte sostituita: al posto del database c'è l'API finta
   (prova/api-prova.js, la stessa dei test) con dati inventati (prova/dati-prova.js). Quindi:
   - nessun collegamento al database: la pagina stessa lo vieta (connect-src 'self' in prova/index.html);
   - tutto resta su questo telefono, con le chiavi «prova.»: il link personale e le scelte dell'app vera non si toccano;
   - notifiche e captcha sono finti: non si chiede nessun permesso al telefono. */
(function(){
  "use strict";
  window.GROWUP_PROVA = true;
  const K_DATI = "prova.dati", K_SESSIONE = "prova.mock.session";
  const leggi = k => { try{ return localStorage.getItem(k); }catch(e){ return null; } };
  const scrivi = (k, v) => { try{ v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); }catch(e){} };
  const chiaviProva = () => { const l = []; try{ for(let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); if(k && k.indexOf("prova.") === 0) l.push(k); } }catch(e){} return l; };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

  /* ---- i dati inventati: quelli salvati su questo telefono, o nuovi ---- */
  let db = null;
  try{ db = JSON.parse(leggi(K_DATI)); }catch(e){ db = null; }
  if(!db || !db._prova) db = window.GROWUP_PROVA_DATI();
  window.__DB = db;
  let dimentica = false;   // «Ricomincia»: i dati di adesso non si salvano più (neanche uscendo dalla pagina)
  const salvaDati = () => { if(!dimentica) scrivi(K_DATI, JSON.stringify(window.__DB)); };
  salvaDati();
  setInterval(salvaDati, 2000);
  addEventListener("pagehide", salvaDati);
  document.addEventListener("visibilitychange", () => { if(document.visibilityState === "hidden") salvaDati(); });

  /* ---- niente Supabase, captcha finto, notifiche finte ---- */
  window.GROWUP_CONFIG = { turnstileSiteKey:"prova" };
  window.turnstile = { render(el, o){ setTimeout(() => o.callback("prova"), 60); return "prova"; }, reset(){}, remove(){} };
  let iscrizione = null, permesso = "default";
  window.GROWUP_PUSH = {
    permesso:() => permesso,
    chiedi:async () => (permesso = "granted"),
    pushManager:{
      getSubscription:async () => iscrizione,
      subscribe:async () => (iscrizione = { endpoint:"prova://questo-telefono", keys:{ p256dh:"prova", auth:"prova" },
        toJSON(){ return { endpoint:this.endpoint, keys:this.keys }; }, unsubscribe:async () => { iscrizione = null; } })
    }
  };

  /* ---- chi essere nella prova ---- */
  const PERSONE = [
    { k:"luca", titolo:"Sono appena entrato", chi:"Luca Bassi",
      testo:"Riceve l'invito di Giulia: l'ingresso, da dove parte, l'obiettivo con il perché, il percorso di partenza fase per fase, fino alla festa." },
    { k:"giulia", titolo:"Sono in attività da due anni", chi:"Giulia Martini",
      testo:"La sua giornata, la serie, l'agenda, la Lista con chi è da riprendere, i clienti, il Target, la Verifica con la tabella Stabilità. È la sponsor di Sara e di Luca: in Gruppo li segue nella partenza." },
    { k:"sara", titolo:"Sono entrata da 12 giorni", chi:"Sara Conti",
      testo:"A metà del percorso di partenza: cosa le manca, i primi nomi della Lista, i primi contatti." },
    { k:"stefano", titolo:"Siamo la sua upline (e admin)", chi:"Stefano e Alessia",
      testo:"Vedono il gruppo con i numeri, mai i nomi delle Liste né il perché di nessuno. Importano la mappa Amway: scarica qui sotto quella di prova." }];
  function vaiCome(k){
    const d = window.__DB, ch = d._prova.chiavi;
    /* si entra come da un telefono nuovo: via la sessione e le scelte della prova, i dati restano */
    for(const x of chiaviProva()) if(x !== K_DATI) scrivi(x, null);
    let hash;
    if(k === "luca"){
      const l = d.partners.find(p => p.id === "L");
      hash = l && l.stato !== "gestito" && l.chiave ? "#chiave=" + l.chiave : "#invito=" + d._prova.invitoLuca;
    } else {
      hash = "#chiave=" + ({ giulia:ch.G, sara:ch.S, stefano:ch.R })[k];
      /* chi è nell'app da tempo ha già salvato il suo link e risposto alla domanda delle notifiche */
      const pid = ({ giulia:"G", sara:"S", stefano:"R" })[k];
      scrivi("prova.growup-team.chiave-salvata", "1");
      if(k !== "sara") scrivi("prova.growup-team.notifiche-chiesto." + pid, "1");
      if(k !== "sara") scrivi("prova.growup-team.primi-passi-no." + pid, "1");
    }
    salvaDati();
    location.hash = hash;
    location.reload();
  }
  function ricomincia(){
    if(!confirm("Ricominciare la prova da capo?\n\nTutto quello che hai fatto nella prova si cancella e i dati inventati tornano come all'inizio.")) return;
    dimentica = true;
    for(const x of chiaviProva()) scrivi(x, null);
    location.hash = ""; location.reload();
  }

  /* ---- la mappa Amway di prova (CSV), per far vedere l'import: il gruppo di Stefano e Alessia con due iscritti nuovi ---- */
  function mappaProva(){
    const d = window.__DB, m = new Date(), mm = `${m.getFullYear()}${String(m.getMonth() + 1).padStart(2, "0")}`, mese = mm.slice(0, 4) + "-" + mm.slice(4);
    const MESI = ["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
    const lunga = iso => { const [a, b, c] = String(iso || "2020-01-01").split("-"); return `${Number(c)} ${MESI[Number(b) - 1]} ${a}`; };
    const it = n => (Math.round(Number(n || 0) * 100) / 100).toLocaleString("it-IT", { minimumFractionDigits:2, maximumFractionDigits:2 });
    const amway = n => { const t = n.split(" "); return t.length > 1 && !/ e /.test(n) ? `${t.slice(1).join(" ")}, ${t[0]}`.toUpperCase() : n.toUpperCase(); };
    const ultimo = id => (d.numeri || []).filter(x => x.partner_id === id && x.mese === mese).sort((a, b) => String(a.dati_al) < String(b.dati_al) ? -1 : 1).pop();
    const sotto = id => d.partners.filter(p => p.sponsor_id === id && !p.fuori_report_dal);
    const righe = [];
    const giro = (p, liv, sp) => { const n = ultimo(p.id) || {};
      righe.push({ liv, sp, cod:p.codice_amway, nome:amway(p.nome), ingresso:p.data_iscrizione, vpp:(Number(n.vpp) || 0) * 1.08, vpg:0, id:p.id });
      for(const f of sotto(p.id)) if(f.codice_amway) giro(f, liv + 1, p.codice_amway); };
    const r = d.partners.find(p => p.id === "R");
    giro(r, 1, "7000000");
    /* due iscritti nuovi in questi giorni: nella mappa ci sono, nell'app non ancora */
    const oggi = new Date(), gg = n => { const x = new Date(oggi); x.setDate(x.getDate() - n); return x.toISOString().slice(0, 10); };
    const marco = d.partners.find(p => p.nome === "Marco Ferri"), teresa = d.partners.find(p => p.nome === "Teresa Villa");
    if(marco && !d.partners.some(p => p.codice_amway === "7199001")) righe.push({ liv:4, sp:marco.codice_amway, cod:"7199001", nome:"CONTE, LIA", ingresso:gg(3), vpp:64.5, vpg:0 });
    if(teresa && !d.partners.some(p => p.codice_amway === "7199002")) righe.push({ liv:5, sp:teresa.codice_amway, cod:"7199002", nome:"FANTI, ELIO", ingresso:gg(2), vpp:58, vpg:0 });
    /* VPG: personali + tutto il gruppo sotto */
    const figli = c => righe.filter(x => x.sp === c);
    const vpg = x => x.vpp + figli(x.cod).reduce((t, f) => t + vpg(f), 0);
    for(const x of righe) x.vpg = vpg(x);
    const pct = v => [[10000, 21], [7000, 18], [4000, 15], [2400, 12], [1200, 9], [600, 6], [200, 3]].find(([s]) => v >= s)?.[1] || 0;
    const testa = ["Qualifica Amway Partner", "Codice Amway Partner Sponsor", "Codice Amway Partner", "Paese", "Nome", "Data di ingresso", "Telefono",
      "Email", "Indirizzo", "Data di rinnovo", "VPG", "VPP", "Percentuale di bonus", "VVG", "VP Cliente", " Clienti", "Punti al livello successivo"];
    const q = v => `"${String(v).replace(/"/g, '""')}"`;
    const linee = [[q("Amway"), q("CONFIDENZIALE - MAPPA DI PROVA, DATI INVENTATI")].join(","), [q("Mese di competenza"), q(mm)].join(","), testa.map(q).join(",")]
      .concat(righe.map(x => [String(x.liv), "'" + x.sp, "'" + x.cod, "'Italia", "'" + x.nome, "'" + lunga(x.ingresso), "", "", "", "",
        "'" + it(x.vpg), "'" + it(x.vpp), "'" + pct(x.vpg) + "%", "0", "'0,00", "'0", "0"].map(q).join(",")));
    const blob = new Blob(["﻿" + linee.join("\n")], { type:"text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `mappa-di-prova-${mm}.csv`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  /* ---- la pagina: quella vera (index.html), senza i suoi script; poi la scelta o l'app ---- */
  async function prepara(){
    const testo = await (await fetch("index.html", { cache:"no-store" })).text();
    const vera = new DOMParser().parseFromString(testo, "text/html");
    for(const el of vera.head.querySelectorAll("style, link[rel=stylesheet], link[rel=icon], link[rel=apple-touch-icon], meta[name=theme-color]"))
      document.head.appendChild(document.importNode(el, true));
    vera.body.querySelectorAll("script").forEach(s => s.remove());
    document.body.innerHTML = vera.body.innerHTML;
    const st = document.createElement("style");
    st.textContent = `
.prova-barra{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 12px;padding-top:calc(6px + env(safe-area-inset-top, 0px));
  background:#fde4d3;color:#5c2a0c;font:700 12px/1.3 var(--f-testo, sans-serif);position:relative;z-index:27}
.prova-barra button{border:1px solid rgba(92,42,12,.35);background:#fff;color:#5c2a0c;border-radius:99px;padding:4px 10px;font:700 12px var(--f-testo, sans-serif);cursor:pointer;white-space:nowrap}
.prova-scelta{max-width:560px;margin:0 auto;padding:calc(20px + env(safe-area-inset-top, 0px)) 16px 40px;display:flex;flex-direction:column;gap:12px}
.prova-scelta h1{margin:0;font:700 32px/1.1 var(--f-titoli, serif)}
.prova-scelta .chi{display:flex;flex-direction:column;align-items:flex-start;gap:4px;text-align:left;width:100%;padding:14px 16px;border-radius:16px;
  border:1px solid var(--line);background:var(--card);color:var(--ink);font:inherit;cursor:pointer}
.prova-scelta .chi b{font-size:17px}.prova-scelta .chi i{font-style:normal;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--ink2)}
.prova-scelta .chi span{font-size:14px;color:var(--ink2);line-height:1.45}
.prova-scelta .chi:active{transform:translateY(1px)}
.prova-scelta .avviso{background:#fde4d3;color:#5c2a0c;border-radius:14px;padding:10px 12px;font-size:13px;line-height:1.45;margin:0}`;
    document.head.appendChild(st);
  }
  function barra(){
    const b = document.createElement("div");
    b.className = "prova-barra";
    b.innerHTML = `<span>Versione di prova · dati inventati</span><button type="button" data-prova="scegli">Cambia persona</button>`;
    document.body.insertBefore(b, document.body.firstChild);
  }
  function scelta(){
    document.body.innerHTML = `<main class="prova-scelta">
      <span class="eyebrow">A&amp;S · Growup Team</span>
      <h1>La versione di prova</h1>
      <p class="avviso"><b>Dati inventati.</b> Persone, numeri e nomi sono di fantasia. Niente va al database: tutto resta su questo telefono, e l'app vera non si tocca.</p>
      <p class="small" style="margin:4px 0 0">Chi vuoi essere?</p>
      ${PERSONE.map(p => `<button type="button" class="chi" data-prova="come" data-k="${p.k}"><i>${esc(p.chi)}</i><b>${esc(p.titolo)}</b><span>${esc(p.testo)}</span></button>`).join("")}
      <div class="row wrap" style="gap:8px;margin-top:6px">
        <button type="button" class="btn small" data-prova="mappa">Scarica la mappa Amway di prova</button>
        <button type="button" class="btn small ghost" data-prova="ricomincia">Ricomincia da capo</button></div>
      <p class="small" style="margin:0">La mappa di prova serve a Stefano e Alessia: in Gruppo, «Importa da Amway», e si sceglie il file scaricato. Ci sono due iscritti nuovi.</p>
    </main>`;
  }
  document.addEventListener("click", e => {
    const t = e.target.closest && e.target.closest("[data-prova]");
    if(!t) return;
    e.preventDefault(); e.stopPropagation();
    const a = t.dataset.prova;
    if(a === "scegli"){ for(const x of chiaviProva()) if(x !== K_DATI) scrivi(x, null); salvaDati(); location.hash = ""; location.reload(); }
    else if(a === "come") vaiCome(t.dataset.k);
    else if(a === "ricomincia") ricomincia();
    else if(a === "mappa") mappaProva();
  }, true);

  const carica = src => new Promise((ok, ko) => { const s = document.createElement("script"); s.src = src; s.async = false; s.onload = ok; s.onerror = ko; document.body.appendChild(s); });
  (async () => {
    if(document.readyState === "loading") await new Promise(ok => document.addEventListener("DOMContentLoaded", ok));
    await prepara();
    const conLink = /^#(chiave|invito|r)=/.test(location.hash);
    if(!conLink && !leggi(K_SESSIONE)){ scelta(); return; }
    barra();
    for(const s of ["prova/api-prova.js", "listino.js", "app.js"]) await carica(s);
  })().catch(e => { document.body.innerHTML = `<p style="padding:20px">La prova non si è aperta: ${esc(e && e.message || e)}. Ricarica la pagina.</p>`; });
})();
