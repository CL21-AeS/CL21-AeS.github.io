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
  /* dati di una versione di prova più vecchia: si ricomincia da capo (anche la sessione) */
  if(!db || !db._prova || db._prova.versione !== window.GROWUP_PROVA_VERSIONE){ db = window.GROWUP_PROVA_DATI(); for(const x of chiaviProva()) if(x !== K_DATI) scrivi(x, null); }
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

  /* ---- chi essere nella prova: Luca (il nuovo) e Giulia (in attività da tempo) ---- */
  const PERSONE = [
    { k:"luca", titolo:"Sono appena entrato", chi:"Luca Bassi",
      testo:"Il primo ingresso di un nuovo partner e il percorso di partenza, fase per fase, fino alla festa." },
    { k:"giulia", titolo:"Sono in attività da tempo", chi:"Giulia Martini",
      testo:"Il primo ingresso di chi è già in attività, l'import della mappa e dei clienti, poi l'app dopo due mesi." }];
  const K_CHI = "prova.chi";
  /* cambiando persona si esce come da un telefono che passa di mano: via la sessione, il link personale e le altre scelte
     senza nome di persona. Restano le scelte legate a una persona (feste viste, domanda sulla condivisione, «Fatto»…):
     tornando su Luca o su Giulia, quello che ha già visto non torna. Il link salvato si ricorda per persona. */
  const GLOBALI = ["invito", "chiave", "chiave-salvata", "installa-no", "ultima-copia", "risposta-target", "whatsapp"].map(k => "prova.growup-team." + k);
  function esci(){
    const chi = leggi(K_CHI);
    if(chi) scrivi("prova.salvata." + chi, leggi("prova.growup-team.chiave-salvata"));
    for(const x of [K_SESSIONE, K_CHI].concat(GLOBALI)) scrivi(x, null);
    try{ sessionStorage.clear(); }catch(e){}
  }
  const giulia = () => window.__DB.partners.find(p => p.id === "G");
  const luca = () => window.__DB.partners.find(p => p.codice_amway === window.__DB._prova.codiceLuca && p.stato !== "gestito");
  function vaiCome(k){
    const d = window.__DB;
    esci();
    let hash;
    if(k === "luca"){ const l = luca(); hash = l && l.chiave ? "#chiave=" + l.chiave : "#invito=" + d._prova.invitoLuca; }
    else {
      const g = giulia();
      hash = g && g.stato !== "gestito" && g.chiave ? "#chiave=" + g.chiave : "#invito=" + d._prova.invitoGiulia;
      /* dopo due mesi Giulia ha già salvato il suo link e risposto alla domanda delle notifiche */
      if(d._prova.dueMesi){ scrivi("prova.salvata." + k, "1"); scrivi("prova.growup-team.notifiche-chiesto.G", "1"); scrivi("prova.growup-team.primi-passi-no.G", "1"); }
    }
    if(leggi("prova.salvata." + k) === "1") scrivi("prova.growup-team.chiave-salvata", "1");
    scrivi(K_CHI, k);
    salvaDati();
    location.hash = hash;
    location.reload();
  }
  function ricomincia(){
    if(!confirm("Ricominciare la prova da capo?\n\nTutto quello che hai fatto nella prova si cancella e i dati inventati tornano come all'inizio.")) return;
    dimentica = true;
    for(const x of chiaviProva()) scrivi(x, null);
    try{ sessionStorage.clear(); }catch(e){}
    location.hash = ""; location.reload();
  }
  /* Luca: arriva la mappa con il suo primo ordine. Come un import della mappa di Giulia: Luca è al suo posto nella
     struttura (non più in attesa) e la mappa del mese mostra i VP del suo primo ordine (quelli della bozza confermata,
     altrimenti un primo ordine di 62 VP). */
  function arrivaMappa(){
    const d = window.__DB, l = luca();
    if(!l) return;
    const m = meseIso(), ora = new Date().toISOString();
    const vp = Math.round((d.ordiniMiei || []).filter(o => o.proprietario === l.id && o.stato === "confermato" && !o.persona_id)
      .reduce((t, o) => t + (Number(o.vp) || 0), 0) * 100) / 100 || 62;
    Object.assign(l, { confermato_il:l.confermato_il || ora, mappa_mese:m + "-01", posizione_al:ora });
    d.numeri = (d.numeri || []).filter(n => !(n.partner_id === l.id && n.mese === m))
      .concat([{ visto_da:"G", partner_id:l.id, mese:m, vpp:vp, vpg:vp, percentuale:0, linee:[], nascoste:false, dati_al:ora }]);
    /* i VP di gruppo di chi gli sta sopra, nella stessa mappa */
    for(let s = d.partners.find(p => p.id === l.sponsor_id); s; s = d.partners.find(p => p.id === s.sponsor_id)){
      const n = (d.numeri || []).find(x => x.partner_id === s.id && x.mese === m); if(n) n.vpg = Math.round((Number(n.vpg) + vp) * 100) / 100; }
    salvaDati();
    location.reload();
  }
  const ordineInMappa = () => { const d = window.__DB, l = luca(); if(!l) return false; const dal = String(l.data_iscrizione || "2000-01-01").slice(0, 7);
    return (d.numeri || []).some(n => n.partner_id === l.id && n.mese >= dal && Number(n.vpp) > 0); };
  /* ---- i file «del sito Amway» di prova, per far vedere gli import (tutto inventato) ---- */
  const MESI_L = ["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
  const oggiL = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); };
  const ggL = n => { const x = oggiL(); x.setDate(x.getDate() - n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
  const lunga = iso => { const [a, b, c] = String(iso || "2020-01-01").split("-"); return `${Number(c)} ${MESI_L[Number(b) - 1]} ${a}`; };
  const it = n => (Math.round(Number(n || 0) * 100) / 100).toLocaleString("it-IT", { minimumFractionDigits:2, maximumFractionDigits:2 });
  const q = v => `"${String(v).replace(/"/g, '""')}"`;
  const meseFile = () => { const m = oggiL(); return `${m.getFullYear()}${String(m.getMonth() + 1).padStart(2, "0")}`; };
  const meseIso = () => meseFile().slice(0, 4) + "-" + meseFile().slice(4);
  const amway = n => { const t = n.split(" "); return t.length > 1 && !/ e /.test(n) ? `${t.slice(1).join(" ")}, ${t[0]}`.toUpperCase() : n.toUpperCase(); };
  function scarica(nome, righe){
    const blob = new Blob(["﻿" + righe.join("\n") + "\n"], { type:"text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  const testaFile = titolo => [[q("Amway"), q("CONFIDENZIALE - " + titolo + " DI PROVA, DATI INVENTATI")].join(","), [q("Mese di competenza"), q(meseFile())].join(",")];

  /* la mappa (Linea di Sponsorizzazione) di Giulia: il suo gruppo con i VP di oggi e due iscritti nuovi. I VP: quelli della
     mappa del mese se c'è già (dopo un import, o il primo ordine di Luca), altrimenti quelli del mese preparati nei dati */
  function mappaProva(){
    const d = window.__DB, mm = meseFile(), mese = meseIso(), piano = d._prova.meseGiulia || {};
    const ultimo = id => (d.numeri || []).filter(x => x.partner_id === id && x.mese === mese).sort((a, b) => String(a.dati_al) < String(b.dati_al) ? -1 : 1).pop();
    const sotto = id => d.partners.filter(p => p.sponsor_id === id && !p.fuori_report_dal);
    const righe = [];
    const giro = (p, liv, sp) => { const n = ultimo(p.id), v = n ? Number(n.vpp) || 0 : Number(piano[p.codice_amway]) || 0;
      righe.push({ liv, sp, cod:p.codice_amway, nome:amway(p.nome), ingresso:p.data_iscrizione, vpp:v, vpg:0 });
      for(const f of sotto(p.id)) if(f.codice_amway) giro(f, liv + 1, p.codice_amway); };
    const radice = d.partners.find(p => p.id === "G"), sopra = d.partners.find(p => p.id === radice.sponsor_id);
    giro(radice, 1, sopra ? sopra.codice_amway : "7000000");
    /* due iscritti nuovi in questi giorni: nella mappa ci sono, nell'app non ancora */
    const liv = c => (righe.find(x => x.cod === c) || {}).liv || 1;
    const marco = d.partners.find(p => p.nome === "Marco Ferri"), teresa = d.partners.find(p => p.nome === "Teresa Villa");
    if(marco && !d.partners.some(p => p.codice_amway === "7199001")) righe.push({ liv:liv(marco.codice_amway) + 1, sp:marco.codice_amway, cod:"7199001", nome:"CONTE, LIA", ingresso:ggL(3), vpp:64.5, vpg:0 });
    if(teresa && !d.partners.some(p => p.codice_amway === "7199002")) righe.push({ liv:liv(teresa.codice_amway) + 1, sp:teresa.codice_amway, cod:"7199002", nome:"FANTI, ELIO", ingresso:ggL(2), vpp:58, vpg:0 });
    /* VPG: personali + tutto il gruppo sotto */
    const figli = c => righe.filter(x => x.sp === c);
    const vpg = x => x.vpp + figli(x.cod).reduce((t, f) => t + vpg(f), 0);
    for(const x of righe) x.vpg = vpg(x);
    const pct = v => [[10000, 21], [7000, 18], [4000, 15], [2400, 12], [1200, 9], [600, 6], [200, 3]].find(([s]) => v >= s)?.[1] || 0;
    const testa = ["Qualifica Amway Partner", "Codice Amway Partner Sponsor", "Codice Amway Partner", "Paese", "Nome", "Data di ingresso", "Telefono",
      "Email", "Indirizzo", "Data di rinnovo", "VPG", "VPP", "Percentuale di bonus", "VVG", "VP Cliente", " Clienti", "Punti al livello successivo"];
    scarica(`mappa-di-prova-giulia-${mm}.csv`, testaFile("MAPPA").concat([testa.map(q).join(",")])
      .concat(righe.map(x => [String(x.liv), "'" + x.sp, "'" + x.cod, "'Italia", "'" + x.nome, "'" + lunga(x.ingresso), "", "", "", "",
        "'" + it(x.vpg), "'" + it(x.vpp), "'" + pct(x.vpg) + "%", "0", "'0,00", "'0", "0"].map(q).join(","))));
  }

  /* i clienti di Giulia dal sito Amway (export «Clienti»): sei hanno comprato, due non hanno mai comprato. Basta questo file:
     l'import dei clienti non ha bisogno dell'export «Ordini» (l'ultimo ordine di ognuno va nello storico) */
  const CLIENTI_FILE = [
    ["MORETTI, ANNA", "7300000101", 300, "+39 333 000 0031", 2],
    ["FERRARO, CARLA", "7300000103", 150, "+39 333 000 0033", 1],
    ["LONGO, BEATRICE", "7300000102", 200, "+39 333 000 0032", 16],
    ["RUSSO, ELENA", "7300000201", 40, "+39 333 000 0041", 6],
    ["GALLI, TEO", "7300000202", 25, "+39 333 000 0042", 3],
    ["BERTONI, SONIA", "7300000203", 90, "+39 333 000 0043", 12],
    ["FUMAGALLI, ADA", "7300000204", 60, "+39 333 000 0044", null],
    ["PIRANI, UGO", "7300000205", 15, "", null]];
  function clientiProva(){
    const testa = ["Nome", "Codice Cliente", "Tipo", "Nuovo cliente", "Data di ingresso", "Telefono", "Email", "Indirizzo", "N. di ordini", "VP Cliente", "Data ultimo ordine"];
    scarica(`${meseFile()}_Cliente_prova.csv`, testaFile("CLIENTI").concat([testa.map(q).join(",")])
      .concat(CLIENTI_FILE.map(([nome, cod, ingresso, tel, ultimo]) => [nome, cod, "Preferito", ingresso < 31 ? "Sì" : "No", lunga(ggL(ingresso)),
        tel ? "Principale: " + tel : "", "", "", ultimo == null ? "0" : "1", "0,00", ultimo == null ? "--" : lunga(ggL(ultimo))]
        .map((v, i) => i === 5 && !v ? "" : q("'" + v)).join(","))));
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
.prova-barra{flex-wrap:wrap}
.prova-azioni{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end}
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
  /* la barra in cima: «Cambia persona» e, solo per Luca, «Arriva la mappa con il primo ordine» (dopo l'ingresso, finché
     la mappa non mostra il primo ordine) */
  function barra(){
    const chi = leggi(K_CHI);
    const extra = chi === "luca" && luca() && !ordineInMappa() ? `<button type="button" data-prova="arriva">Arriva la mappa con il primo ordine</button>`
 : "";
    const html = `<span>Versione di prova · dati inventati</span><span class="prova-azioni">${extra}<button type="button" data-prova="scegli">Cambia persona</button></span>`;
    let b = document.querySelector(".prova-barra");
    if(!b){ b = document.createElement("div"); b.className = "prova-barra"; document.body.insertBefore(b, document.body.firstChild); }
    if(b.innerHTML !== html) b.innerHTML = html;
  }
  function scelta(){
    document.body.innerHTML = `<main class="prova-scelta">
      <span class="eyebrow">A&amp;S · Growup Team</span>
      <h1>La versione di prova</h1>
      <p class="avviso"><b>Dati inventati.</b> Persone, numeri e nomi sono di fantasia. Niente va al database: tutto resta su questo telefono, e l'app vera non si tocca.</p>
      <p class="small" style="margin:4px 0 0">Chi vuoi essere?</p>
      ${PERSONE.map(p => `<button type="button" class="chi" data-prova="come" data-k="${p.k}"><i>${esc(p.chi)}</i><b>${esc(p.titolo)}</b><span>${esc(p.testo)}</span></button>`).join("")}
      <span class="eyebrow" style="margin-top:10px">I file del sito Amway, per gli import (inventati)</span>
      <p class="small" style="margin:0">Scaricali qui, poi entra come Giulia e importali dall'app: si sceglie il file scaricato.</p>
      <button type="button" class="chi" data-prova="mappa"><i>Giulia · «Per iniziare» o Gruppo → Importa da Amway</i><b>La mappa della rete di Giulia</b>
        <span>Il suo gruppo con i VP di oggi e due iscritti nuovi: il Gruppo si riempie da solo.</span></button>
      <button type="button" class="chi" data-prova="clienti"><i>Giulia · Persone → Clienti → Importa</i><b>I clienti di Giulia</b>
        <span>L'elenco «Clienti» del sito: sei clienti con il loro ultimo ordine e due che non hanno mai comprato.</span></button>
      <button type="button" class="btn small ghost" data-prova="ricomincia" style="align-self:flex-start;margin-top:6px">Ricomincia da capo</button>
    </main>`;
  }
  document.addEventListener("click", e => {
    const t = e.target.closest && e.target.closest("[data-prova]");
    if(!t) return;
    e.preventDefault(); e.stopPropagation();
    const a = t.dataset.prova;
    if(a === "scegli"){ esci(); salvaDati(); location.hash = ""; location.reload(); }
    else if(a === "come") vaiCome(t.dataset.k);
    else if(a === "ricomincia") ricomincia();
    else if(a === "mappa") mappaProva();
    else if(a === "clienti") clientiProva();
    else if(a === "arriva") arrivaMappa();
  }, true);

  /* Luca, appena entrato con l'invito di Giulia, trova già 29 nomi nella sua Lista (inventati, con «Come lo conosci?»):
     manca il trentesimo, per far vedere la festa della fase 2 */
  function nomiDiLuca(){
    const api = window.GROWUP_API, entra = api.join;
    api.join = async a => {
      const r = await entra(a), d = window.__DB, id = r && r.profilo && r.profilo.id;
      if(id && String(a.p_codice || "").toLowerCase() === d._prova.invitoLuca && !(d.persone || []).some(x => x.proprietario === id)){
        const t = Date.now();
        d.persone = (d.persone || []).concat(d._prova.nomiLuca.map(([nome, fonte, origine, contatto], i) => ({ id:"pl-" + (i + 1), proprietario:id, nome,
          contatto, origine, fonte, social:null, fase:"lista", esito:null, creato_il:new Date(t - (29 - i) * 60000).toISOString(), prossima_data:null,
          prossima_ora:null, prossima_nota:null, prossima_per:null, prossima_come:null, note:null })));
        salvaDati();
      }
      return r;
    };
  }

  const carica = src => new Promise((ok, ko) => { const s = document.createElement("script"); s.src = src; s.async = false; s.onload = ok; s.onerror = ko; document.body.appendChild(s); });
  (async () => {
    if(document.readyState === "loading") await new Promise(ok => document.addEventListener("DOMContentLoaded", ok));
    await prepara();
    const conLink = /^#(chiave|invito|r)=/.test(location.hash);
    if(!conLink && !leggi(K_SESSIONE)){ scelta(); return; }
    barra();
    setInterval(barra, 1000);   // Luca entra e conferma la bozza senza ricaricare la pagina: il pulsante compare da solo
    await carica("prova/api-prova.js");
    nomiDiLuca();
    for(const s of ["listino.js", "app.js"]) await carica(s);
  })().catch(e => { document.body.innerHTML = `<p style="padding:20px">La prova non si è aperta: ${esc(e && e.message || e)}. Ricarica la pagina.</p>`; });
})();
