import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import fs from "fs";
const S = process.env.S, BASE = "http://127.0.0.1:8765/growup-team/";
const mock = fs.readFileSync(S + "/../prova/api-prova.js", "utf8");   // la stessa API finta della versione di prova
const stages = [
 {ordine:1,chiave:"primo_ordine",nome:"Primo ordine",vp_personali:50,giorni_scadenza:30},
 {ordine:2,chiave:"primi_clienti",nome:"Primi clienti",vp_personali:0,clienti:3},
 {ordine:3,chiave:"path_to_bronze",nome:"Path to Bronze",vp_personali:100,linee:3,vp_linea:100,guadagno_mese:150,struttura_calcolo:"100 VP personali + 3 linee da 100 VP"},
 {ordine:4,chiave:"foundation_9",nome:"Bronze Foundation 9%",percentuale:9,vp_personali:100,vp_gruppo:1200,linee:3,vp_linea:200,pagamenti_max:12,mesi_finestra:18,guadagno_mese:360,struttura_calcolo:"100 VP personali + 3 linee da 400 VP"},
 {ordine:5,chiave:"foundation_12",nome:"Bronze Foundation 12%",percentuale:12,vp_personali:100,vp_gruppo:2400,linee:3,vp_linea:200,pagamenti_max:12,mesi_finestra:18,guadagno_mese:580,struttura_calcolo:"100 VP personali + 3 linee da 800 VP"},
 {ordine:6,chiave:"builder_15",nome:"Bronze Builder 15%",vp_personali:200,vp_gruppo:4000,linee:3,vp_linea:600,pagamenti_max:12,mesi_finestra:18,guadagno_mese:1050,struttura_calcolo:"x"},
 {ordine:7,chiave:"builder_18",nome:"Bronze Builder 18%",vp_personali:200,vp_gruppo:7000,linee:3,vp_linea:600,pagamenti_max:12,mesi_finestra:18,guadagno_mese:1980,struttura_calcolo:"x"},
 {ordine:8,chiave:"argento",nome:"Argento 21%",vp_personali:0,vp_gruppo:10000,linee:2,linee_obiettivo:3,guadagno_mese:2500,struttura_calcolo:"200 VP personali + 3 linee da 4.100 VP"},
 ...[["oro","Oro"],["platino","Platino"],["platino_fondatore","Platino Fondatore"],["rubino","Rubino"],["rubino_fondatore","Rubino Fondatore"],
   ["zaffiro","Zaffiro"],["zaffiro_fondatore","Zaffiro Fondatore"],["smeraldo","Smeraldo"],["smeraldo_fondatore","Smeraldo Fondatore"],
   ["diamante","Diamante"],["diamante_fondatore","Diamante Fondatore"]].map(([chiave, nome], i) =>
   ({ ordine:9 + i, chiave, nome, vp_personali:0, guadagno_mese:{ platino:3000, rubino:4000, zaffiro:5000, smeraldo:8000, diamante:18000 }[chiave.replace("_fondatore", "")] || null, descrizione:chiave === "smeraldo" ? "Da Platino: 3 linee frontali al 21% per almeno 6 mesi del Performance Year" : "Requisiti di prova" }))];
const DB = { partners:[{id:"R",nome:"Stefano e Alessia",codice_invito:"RRRR22",chiave:"a".repeat(32),stato:"gestito",is_admin:true,codice_amway:"1111111"}],
  /* il listino (prodotti inventati) */
  listino:[{codice:"900001",nome:"Double Prova (31 giorni)",formato:"140 g",categoria:"Integratori",prezzo_cliente:80,prezzo_partner:66.5,vp:26.5,attivo:true},
    {codice:"900002",nome:"Shampoo Prova",formato:"250 ml",categoria:"Capelli",prezzo_cliente:12.4,prezzo_partner:10.3,vp:4.1,attivo:true},
    {codice:"900003",nome:"Vecchio Prova",formato:"1 pz",categoria:"Casa",prezzo_cliente:5,prezzo_partner:4,vp:1.5,attivo:false}],
  accessi:[], aggiunti:[], anon:0, activities:[], goals:[], mgoals:[], joins:[], stages,
  settings:[{chiave:"obiettivi_proposti",valore:{contatti:10,piani:3,vp_mese:100}},{chiave:"fonte_guadagni",valore:"Simulatore di reddito ufficiale Amway, ottobre 2026"},{chiave:"avviso_guadagni",valore:"Cifre indicative."},
    /* 044: la tabella «Verifica la tua attività - Stabilità» di Cum Laude 21 */
    {chiave:"stabilita_cl21",valore:{livelli:[3,6,9,12,15,18,21],righe:[
      {k:"nuovi_gruppo",nome:"Nuovi iscritti nel gruppo del mese",soglie:[1,3,5,8,10,15,20]},
      {k:"oltre_200",nome:"Codici che fatturano più di 200 VP",soglie:[1,3,5,10,17,30,42]},
      {k:"app_cl21",nome:"Codici iscritti all'app CumLaude21",soglie:[1,2,3,7,12,21,30]},
      {k:"training_day",nome:"Codici al Training Day",soglie:[1,3,5,10,17,30,42]},
      {k:"convention",nome:"Codici alla Convention",soglie:[1,2,3,7,12,21,30]}]}}]};
/* 041: un invito personale pronto, come se l'avesse creato «da»: restituisce l'indirizzo da aprire */
const invitoPer = (da, nome, codice, extra) => {
  const c = Array.from({ length:32 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
  DB.invitiP = (DB.invitiP || []).concat([Object.assign({ id:"inv" + Math.random().toString(36).slice(2, 8), codice:c, creato_da:da, nome,
    codice_amway:codice, creato_il:new Date().toISOString(), scade_il:new Date(Date.now() + 7 * 864e5).toISOString(),
    annullato_il:null, usato_il:null, usato_da:null }, extra || {})]);
  return "#invito=" + c;
};
const errori = [];
/* se un passo si blocca (per esempio un file dell'app che non arriva), si vede perché e il test esce con errore */
process.on("uncaughtException", e => { console.log("FAIL: test interrotto:", String(e).split("\n")[0],
    ((e && e.stack || "").split("\n").find(r => r.includes("test.mjs")) || "").trim());
  if(errori.length) console.log("ERRORI CONSOLE:", errori); process.exit(1); });
let ok = 0; const check = (c, m) => { if(!c){ console.log("FAIL:", m); process.exitCode = 1; } else { ok++; } };
const browser = await chromium.launch();
/* i file dell'app devono arrivare tutti: un 404 sul nostro sito è un errore (la console dice solo "Failed to load resource") */
const fileMancanti = pg => pg.on("response", r => { if(r.status() >= 400 && r.url().startsWith(BASE)) errori.push(`HTTP ${r.status()} ${r.url()}`); });
async function apri(ctxOpts, hash){
  /* di base "riduci animazioni": i controlli non aspettano i movimenti; il movimento ha il suo test */
  const ctx = await browser.newContext(Object.assign({ viewport:{width:390,height:844}, locale:"it-IT", timezoneId:"Europe/Rome", bypassCSP:true, reducedMotion:"reduce" }, ctxOpts));
  await ctx.route(/cdn\.jsdelivr\.net/, r => r.abort());
  /* captcha finto: risponde subito con un gettone di prova (o con un errore se DB.captchaKo) */
  await ctx.route(/challenges\.cloudflare\.com/, r => r.fulfill({ contentType:"text/javascript", body:
    "window.turnstile={render:function(el,o){el.textContent='captcha';setTimeout(function(){window.__DB.captchaKo?o['error-callback']():o.callback('tok-prova')},50)}};" }));
  const page = await ctx.newPage();
  page.on("console", m => { if(m.type() === "error" && !/jsdelivr|ERR_FAILED|Failed to load resource/.test(m.text())) errori.push(m.text()); });
  page.on("pageerror", e => errori.push(String(e)));
  fileMancanti(page);
  page.on("dialog", d => d.accept());
  /* consegna 9: un traguardo grande copre la pagina a tutto schermo; nei test di prima si chiude da solo con «Continua»
     (il test 63 lo guarda prima di chiuderlo, con DB.traguardiAperti) */
  if(!DB.traguardiAperti) await page.addLocatorHandler(page.locator(".festa.traguardo"), async t => { await t.locator("button[data-act=traguardo-chiudi]").click(); });
  /* consegna 6: «Da dove parti?» blocca chi non ha l'obiettivo con il perché. Nei test chi entra già con il suo link (privacy
     accettata) ha un obiettivo di prova, salvo DB.senzaObiettivo o p.senzaObiettivo; chi entra con un invito lo scrive (perche()). */
  /* consegna 7, solo nei test: chi ha la data di iscrizione vicina all'ingresso seguirebbe il percorso di partenza; i test
     di prima guardano il cruscotto, quindi lo trovano già completato (salvo DB.conPercorso o p.conPercorso) */
  if(!DB.conPercorso) for(const p of DB.partners) if(p.data_iscrizione && !p.conPercorso && !p.partenza_completata_il) p.partenza_completata_il = "2026-01-01T00:00:00Z";
  if(!DB.senzaObiettivo) for(const p of DB.partners) if(p.chiave && p.privacy_accettata_il && !p.senzaObiettivo && !(DB.obiettivi || []).some(o => o.partner_id === p.id))
    DB.obiettivi = (DB.obiettivi || []).concat([{ partner_id:p.id, cifra_mese:300, entro:(new Date().getFullYear() + 1) + "-06-01", perche:"Per la famiglia" }]);
  /* riapri(): ricaricando la pagina si riparte dai dati di adesso (non da quelli dell'apertura) */
  await page.addInitScript(([db, m]) => { let x = null; try{ x = sessionStorage.getItem("__test_db"); sessionStorage.removeItem("__test_db"); }catch(e){}
    window.__DB = x ? JSON.parse(x) : db; window.GROWUP_TEST = {}; eval(m); }, [DB, mock]);
  await page.goto(BASE + (hash || ""));
  return { ctx, page };
}
/* 063: i VP vengono solo dalle mappe Amway. Una mappa per una persona (mese in corso, o extra.mese «AAAA-MM»):
   mappa() nei dati del test (per le pagine aperte dopo), mappaIn() nella pagina aperta (l'app ricarica i numeri) */
const meseOra = () => new Intl.DateTimeFormat("en-CA", { timeZone:"Europe/Rome" }).format(new Date()).slice(0, 7);
const rigaMappa = (pid, vpp, vpg, extra) => Object.assign({ visto_da:"R", partner_id:pid, mese:meseOra(), vpp, vpg:vpg == null ? vpp : vpg,
  percentuale:null, linee:[], nascoste:false, dati_al:new Date().toISOString() }, extra || {});
const mappa = (pid, vpp, vpg, extra) => { const r = rigaMappa(pid, vpp, vpg, extra);
  DB.numeri = (DB.numeri || []).filter(x => !(x.partner_id === pid && x.mese === r.mese)).concat([r]); return r; };
const mappaIn = async (pg, pid, vpp, vpg, extra) => { const r = rigaMappa(pid, vpp, vpg, extra);
  await pg.evaluate(r => { const db = window.__DB; db.numeri = (db.numeri || []).filter(x => !(x.partner_id === r.partner_id && x.mese === r.mese)).concat([r]);
    document.dispatchEvent(new Event("visibilitychange")); }, r);
  await pg.waitForTimeout(400); return r; };
/* «mappa del 10 novembre» per una data e ora */
const giornoMappaIt = d => new Intl.DateTimeFormat("it-IT", { timeZone:"Europe/Rome", day:"numeric", month:"long" }).format(new Date(d));
const delGiornoIt = d => { const g = giornoMappaIt(d), n = parseInt(g, 10); return n === 1 ? "del 1°" + g.slice(1) : n === 8 || n === 11 ? "dell'" + g : "del " + g; };
/* riapre l'app sullo stesso telefono (stessa memoria del telefono), con i dati di adesso */
const riapri = async page => { await page.evaluate(() => sessionStorage.setItem("__test_db", JSON.stringify(window.__DBOUT || window.__DB))); await page.reload(); };
const sync = async page => Object.assign(DB, await page.evaluate(() => JSON.parse(JSON.stringify(window.__DBOUT || window.__DB))));
/* ottimizzazione 1: tappa e diario si aprono toccandoli; gli ordini stanno nel foglio «Ordini» */
const apriRiga = async (pg, act) => { const b = pg.locator(`button[data-act=${act}]`).first();
  if(await pg.locator(".sheet").count()) return;
  if(await b.getAttribute("aria-expanded") === "false") await b.click(); };
const apriTappa = pg => apriRiga(pg, "apri-tappa");
/* consegna 2: «Il mio mese» e «Prossimi giorni e in corso» sono righe che si aprono */
const apriMese = async pg => { const b = pg.locator("button[data-act=apri-mese]").first();   // anche con un foglio aperto sopra
  if(await b.count() && await b.getAttribute("aria-expanded") === "false") await b.evaluate(x => x.click()); };
const apriDopo = pg => apriRiga(pg, "apri-dopo");
/* consegna 6: «Da dove parti?» è un blocco vero: cifra, mese e perché, poi «Inizia il mio percorso» */
const perche = async pg => {
  await pg.getByText("Da dove parti?").waitFor();
  await pg.fill("form[data-form=obiettivo] input[name=cifra]", "300");
  await pg.fill("form[data-form=obiettivo] input[name=entro]", (new Date().getFullYear() + 1) + "-06");
  await pg.fill("form[data-form=obiettivo] textarea[name=perche]", "Per la famiglia");
  await pg.click("form[data-form=obiettivo] button.primary");
  await pg.locator("form[data-form=obiettivo]").waitFor({ state:"detached" });
};
const apriDiario = pg => apriRiga(pg, "apri-diario");
const apriOrdini = async (pg, scelta) => { await pg.click(".azioni button[data-act=ordini]");
  if(scelta) await pg.click(`.sheet button[data-act=${scelta}]`); };
/* ottimizzazione 3: nella scheda partner chiamata, numeri da aggiornare, accesso, inviti e struttura stanno in «Azioni» */
const azioniScheda = async pg => { const b = pg.locator("button[data-act=scheda-tab][data-tab=azioni]");
  if(await b.count() && await b.getAttribute("aria-selected") !== "true") await b.click(); };
/* «Importa da Amway»: il file va nel selettore del foglio aperto, se c'è, altrimenti in quello della pagina */
const mettiFile = async (pg, files) => {
  const nelFoglio = pg.locator(".sheet input.file-amway, .sheet #file-report, .sheet #file-ordini");
  await (await nelFoglio.count() ? nelFoglio.first() : pg.locator("input.file-amway").first()).setInputFiles(files);
};
let ctx, page; const oggiStr = new Intl.DateTimeFormat("en-CA", { timeZone:"Europe/Rome" }).format(new Date());
// ---- Persone chiuse (27 novembre 2026, richiesta di Stefano, sezioni 110-113): le persone delle anteprime a 360 px ----
// Paola ha nella Lista: Anna chiusa come Partner senza passi, Bruno Partner con tutti i passi, Carla «No», Dino «Non ora»
// con il giorno in cui risentirlo, Elsa aperta in fase Piano (e Fabio chiuso senza risposta, solo per i controlli).
const idChiusi = n => "a5000000-0000-4000-8000-0000000000" + String(n).padStart(2, "0"), chiaveChiusi = "e7".repeat(16);
const ANTEPRIMA_CHIUSI = ["Anna Partner", "Bruno Completo", "Carla No", "Dino Nonora", "Elsa Piano"];
const dataPiu = n => new Intl.DateTimeFormat("en-CA", { timeZone:"Europe/Rome" }).format(new Date(Date.now() + n * 864e5));
const risentiChiusi = "da risentire il " + giornoMappaIt(dataPiu(90) + "T12:00:00");
/* «dal 27 novembre», «dall'8 novembre», «dal 1° dicembre» (come dalGiorno nell'app; le date dei test sono di quest'anno) */
const dalIt = d => { const g = giornoMappaIt(d + "T12:00:00"), n = parseInt(g, 10); return n === 1 ? "dal 1°" + g.slice(1) : n === 8 || n === 11 ? "dall'" + g : "dal " + g; };
function preparaChiusi(){
  const ora = new Date().toISOString(), pid = idChiusi(1);
  DB.partners = DB.partners.filter(p => p.id !== pid).concat([{ id:pid, nome:"Paola Percorsi", sponsor_id:"R", stato:"attivo", codice_invito:"PC110X",
    codice_amway:"7970001", chiave:chiaveChiusi, privacy_accettata_il:ora, confermato_il:ora, partenza_confermata_il:ora, creato_il:ora, data_iscrizione:"2024-01-10" }]);
  DB.persone = (DB.persone || []).filter(p => p.proprietario !== pid);
  DB.passi = (DB.passi || []).filter(p => p.proprietario !== pid);
  let k = 0;
  const persona = (n, nome, fase, esito, extra) => { DB.persone.push(Object.assign({ id:idChiusi(n), proprietario:pid, nome, fase, esito, prossima_data:null, prossima_nota:null,
    creato_il:new Date(Date.now() - (60 - n) * 864e5).toISOString() }, extra || {})); };
  const passo = (n, tipo, giorni, esito) => DB.passi.push({ id:idChiusi(n) + "-" + String(++k).padStart(2, "0"), persona_id:idChiusi(n), proprietario:pid, tipo,
    data:dataPiu(-giorni), esito:esito || null, importato:false, attivita_id:null, creato_il:new Date(Date.now() - 864e5 * giorni - (100 - k) * 1000).toISOString() });
  persona(10, "Anna Partner", "lista", "partner"); passo(10, "chiusura", 0, "partner");
  persona(11, "Bruno Completo", "followup", "partner");
  passo(11, "contatto", 20); passo(11, "invito", 15); passo(11, "piano", 10); passo(11, "followup", 5); passo(11, "chiusura", 0, "partner");
  persona(12, "Carla No", "contattato", "no"); passo(12, "contatto", 9); passo(12, "chiusura", 0, "no");
  persona(13, "Dino Nonora", "piano", "non_ora", { prossima_data:dataPiu(88), prossima_nota:risentiChiusi });
  passo(13, "contatto", 30); passo(13, "invito", 25); passo(13, "piano", 20); passo(13, "chiusura", 2, "non_ora");
  persona(14, "Elsa Piano", "piano", null); passo(14, "contatto", 12); passo(14, "invito", 8); passo(14, "piano", 3);
  persona(15, "Fabio Silenzio", "contattato", "senza_risposta"); passo(15, "contatto", 40); passo(15, "chiusura", 0, "senza_risposta");
  persona(16, "Gina Cliente", "contattato", "cliente"); passo(16, "contatto", 6); passo(16, "chiusura", 1, "cliente");
  // Bruno ha già l'invito Target collegato (la riga «Target: …» resta anche da Partner)
  DB.inviti = (DB.inviti || []).filter(x => x.proprietario !== pid).concat([{ id:idChiusi(90), proprietario:pid, nome:"Bruno Completo", persona_id:idChiusi(11),
    bloccato:false, risposte:null, risposto_il:null, creato_il:ora, scade:dataPiu(7) }]);
  DB.persone.find(p => p.id === idChiusi(11)).invito_target_id = idChiusi(90);
}
const togliChiusi = () => { const pid = idChiusi(1);
  DB.partners = DB.partners.filter(p => p.id !== pid); DB.persone = (DB.persone || []).filter(p => p.proprietario !== pid);
  DB.passi = (DB.passi || []).filter(p => p.proprietario !== pid); DB.activities = DB.activities.filter(a => a.partner_id !== pid);
  DB.inviti = (DB.inviti || []).filter(x => x.proprietario !== pid); };
const apriChiusi = async () => { const r = await apri({ viewport:{ width:360, height:780 } }, "#chiave=" + chiaveChiusi);
  await r.page.locator(".testata h1").waitFor(); if(await r.page.locator(".sheet").count()) await r.page.click(".sheet [data-act=chiudi]").catch(() => {});
  await r.page.click("button[data-act=vista-persone]"); return r; };
const schedaChiusi = async (pg, nome) => { if(await pg.locator("button[data-act=torna-lista]").count()) await pg.click("button[data-act=torna-lista]");
  await pg.locator("button[data-act=apri-persona]", { hasText:nome }).click(); await pg.locator("button[data-act=passo]").waitFor(); };
/* i pulsanti e le righe di una parte della pagina che vanno a capo (come la sezione 66: più righe di testo) */
const aCapoIn = (loc, sel) => loc.evaluate((root, sel) => [...root.querySelectorAll(sel)].filter(e => e.getBoundingClientRect().width > 0).filter(e => {
  const rg = document.createRange(); rg.selectNodeContents(e);
  const rr = [...rg.getClientRects()].filter(r => r.width > 1).sort((x, y) => x.top - y.top);
  let righe = rr.length ? 1 : 0, fondo = rr.length ? rr[0].bottom : 0;
  for(const r of rr){ if(r.top >= fondo - 2){ righe++; fondo = r.bottom; } else fondo = Math.max(fondo, r.bottom); }
  return righe > 1; }).map(e => e.textContent.replace(/\s+/g, " ").trim()), sel);
/* una tavola con più ritagli affiancati (le anteprime delle persone in un'immagine sola, in chiaro o in scuro) */
async function tavola(path, ritagli, scuro){
  const c = await browser.newContext({ viewport:{ width:400, height:400 }, colorScheme:scuro ? "dark" : "light" }), pg = await c.newPage();
  await pg.setContent(`<body style="margin:0;padding:16px;display:flex;gap:16px;align-items:flex-start;background:${scuro ? "#0b1712" : "#f3efe6"};font:600 13px system-ui;color:${scuro ? "#cfd8d3" : "#33443c"}">${
    ritagli.map(r => `<figure style="margin:0;width:360px"><figcaption style="margin:0 0 6px">${r.titolo}</figcaption><img style="display:block;width:360px" src="data:image/png;base64,${r.png.toString("base64")}"></figure>`).join("")}</body>`);
  await pg.screenshot({ path, fullPage:true }); await c.close();
}


// 115. I passi precedenti si spuntano da soli (27 novembre 2026, richiesta di Stefano, migrazione 071, che allarga la regola
//      della 070). Il database (qui l'API finta, che fa lo stesso) aggiunge i passi che mancano: invito → contatto; piano →
//      contatto, invito; follow-up → contatto, invito, piano; chiusura Partner come prima. Stessa data, un istante prima, in
//      ordine, collegati al passo che li crea; contatto e piano contano, l'invito no; mai il follow-up. Nel modulo, sotto la
//      scelta del tipo, «Segna anche il contatto.» (o quelli che mancano). Nella scheda «Contatto · segnato in automatico».
{
  preparaChiusi();
  const pid = idChiusi(1);
  const nuova = (n, nome, extra) => DB.persone.push(Object.assign({ id:idChiusi(n), proprietario:pid, nome, fase:"lista", esito:null, prossima_data:null,
    prossima_nota:null, prossima_per:null, prossima_come:null, creato_il:new Date(Date.now() - 5 * 864e5).toISOString() }, extra || {}));
  nuova(40, "Nico Nuovo"); nuova(41, "Olga Contattata", { fase:"contattato" }); nuova(42, "Pino Seguito", { prossima_data:dataPiu(0), prossima_per:"followup" });
  DB.passi.push({ id:idChiusi(41) + "-1", persona_id:idChiusi(41), proprietario:pid, tipo:"contatto", data:dataPiu(-3), esito:null, importato:false, attivita_id:null,
    creato_il:new Date(Date.now() - 3 * 864e5).toISOString() });
  ({ ctx, page } = await apriChiusi());
  const ritagli = { light:[], dark:[] };
  const nascondiToast = v => page.evaluate(v => { const t = document.getElementById("toast"); if(t) t.style.visibility = v; }, v);
  const foto = async (titolo, loc, alto) => { await nascondiToast("hidden"); if(alto) await page.setViewportSize({ width:360, height:2000 });
    for(const tema of ["light", "dark"]){ await page.emulateMedia({ colorScheme:tema }); await page.waitForTimeout(80);
      ritagli[tema].push({ titolo, png:await page.locator(loc).first().screenshot() }); }
    await page.emulateMedia({ colorScheme:"light" }); if(alto) await page.setViewportSize({ width:360, height:780 }); await nascondiToast(""); };
  const conta = tipo => DB.activities.filter(a => a.partner_id === pid && a.tipo === tipo).length;
  const riga = page.locator(".sheet p.passi-prima");
  const passiScheda = async () => (await page.locator(".card", { hasText:"I passi" }).locator("li .grow").allInnerTexts()).map(x => x.replace(/\s+/g, " ").trim());

  // Nico, in lista: la riga sotto la scelta del tipo dice cosa verrà segnato in più
  await schedaChiusi(page, "Nico Nuovo");
  await page.click("button[data-act=passo]");
  check(!(await riga.count()), "115: Contatto: nessuna riga (non manca niente)");
  const attese = { invito:"Segna anche il contatto.", piano:"Segna anche contatto e invito.", followup:"Segna anche contatto, invito e piano." };
  for(const [tipo, testo] of Object.entries(attese)){
    await page.click(`.sheet button[data-tipo=${tipo}]`);
    check(await riga.isVisible() && (await riga.innerText()).trim() === testo, `115: ${tipo}: «${testo}» (${await riga.count() ? await riga.innerText() : "niente"})`);
    check(!(await aCapoIn(page.locator(".sheet"), "p.passi-prima")).length, `115: ${tipo}: la riga non va a capo a 360 px`);
  }
  await page.click(".sheet button[data-tipo=chiusura]");
  check(!(await riga.count()), "115: Chiusura: la riga sotto il tipo non c'è (c'è quella sotto l'esito Partner, 070)");
  await page.click(".sheet button[data-tipo=piano]");
  await foto("Nico: Piano, cosa si segna in più", ".sheet-box", true);
  // Piano su una persona In lista = +1 contatto e +1 piano; contatto e invito automatici, collegati al piano
  await sync(page);
  const [c0, p0] = [conta("contatto"), conta("piano")];
  await page.click(".sheet button:has-text('Salva')"); await page.getByText("Piano segnato").waitFor(); await sync(page);
  const nico = DB.passi.filter(x => x.persona_id === idChiusi(40)), piano = nico.find(x => x.tipo === "piano" && !x.segnato_con);
  const auto = nico.filter(x => x.segnato_con === piano.id);
  check(nico.length === 3 && JSON.stringify(auto.map(x => x.tipo).sort()) === JSON.stringify(["contatto", "invito"])
    && auto.every(x => x.data === piano.data && x.creato_il < piano.creato_il), "115: Piano su Nico: contatto e invito automatici, stessa data, un istante prima");
  check(conta("contatto") === c0 + 1 && conta("piano") === p0 + 1 && auto.find(x => x.tipo === "invito").attivita_id === null,
    "115: Piano su una persona In lista = +1 contatto e +1 piano (l'invito non conta)");
  check(JSON.stringify(await passiScheda()) === JSON.stringify(["Piano", "Invito · segnato in automatico", "Contatto · segnato in automatico"]),
    "115: nella scheda «Invito / Contatto · segnato in automatico» (" + (await passiScheda()).join(" | ") + ")");
  check(!(await aCapoIn(page.locator(".card", { hasText:"I passi" }), "li .grow > b, li .grow > .segnato-auto")).length, "115: i passi automatici non vanno a capo a 360 px");
  check(await page.locator(".card", { hasText:"I passi" }).locator(".visually-hidden").first().evaluate(e => e.textContent) === " · ", "115: lo screen reader legge «Contatto · segnato in automatico»");
  await foto("Nico: la scheda dopo il Piano", "#app .card >> nth=1");
  // cancellando il piano spariscono anche contatto e invito automatici, con le attività
  const primo = page.locator(".card", { hasText:"I passi" }).locator("li").first();   // il piano, il più recente
  check((await primo.locator("b").innerText()).trim() === "Piano", "115: in cima ai passi c'è il piano");
  await primo.locator("button[data-act=togli-passo]").click();
  await page.getByText("Passo tolto").waitFor(); await sync(page);
  check(!DB.passi.some(x => x.persona_id === idChiusi(40)) && conta("contatto") === c0 && conta("piano") === p0, "115: cancellando il piano si cancellano i passi automatici e le loro attività");

  // Olga, con il contatto già segnato: Piano = solo +1 piano (si aggiunge l'invito)
  await schedaChiusi(page, "Olga Contattata");
  await page.click("button[data-act=passo]"); await page.click(".sheet button[data-tipo=piano]");
  check((await riga.innerText()).trim() === "Segna anche l'invito.", "115: Olga (contatto già segnato): «Segna anche l'invito.»");
  const [c1, p1] = [conta("contatto"), conta("piano")];
  await page.click(".sheet button:has-text('Salva')"); await page.getByText("Piano segnato").waitFor(); await sync(page);
  check(conta("contatto") === c1 && conta("piano") === p1 + 1 && DB.passi.filter(x => x.persona_id === idChiusi(41) && x.tipo === "contatto").length === 1
    && DB.passi.filter(x => x.persona_id === idChiusi(41) && x.segnato_con).map(x => x.tipo).join() === "invito", "115: Piano con il contatto già segnato = solo +1 piano");
  // il passo successivo non ripete la riga: dopo il piano il follow-up non deve segnare niente
  await page.click("button[data-act=passo]");
  check(await page.locator(".sheet button[data-tipo=followup].on").count() === 1 && !(await riga.count()), "115: Follow-up con contatto, invito e piano già segnati: nessuna riga");
  await page.click(".sheet [data-act=chiudi]");

  // «Com'è andata?» (Pino ha un follow-up in agenda oggi): «Fatto» segna il follow-up e il database spunta gli altri tre
  await schedaChiusi(page, "Pino Seguito");
  const c2 = conta("contatto"), p2 = conta("piano");
  await page.click(".prossima button[data-act=agenda-fatto]");
  await page.click(".sheet button[data-r=followup]"); await page.getByText("Follow-up segnato").waitFor(); await sync(page);
  check(JSON.stringify(DB.passi.filter(x => x.persona_id === idChiusi(42)).sort((a, b) => a.creato_il < b.creato_il ? -1 : 1).map(x => x.tipo)) === JSON.stringify(["contatto", "invito", "piano", "followup"])
    && conta("contatto") === c2 + 1 && conta("piano") === p2 + 1, "115: «Com'è andata?» → Fatto: follow-up più contatto, invito e piano automatici (+1 contatto, +1 piano)");
  check(!DB.passi.some(x => x.persona_id === idChiusi(42) && x.tipo === "followup" && x.segnato_con), "115: il follow-up non si aggiunge mai da solo");
  // «Riapri il percorso» non li toglie
  await page.click("button[data-act=passo]"); await page.click(".sheet button[data-tipo=chiusura]");
  await page.click(".sheet label.chip:has(span:text-is('No'))"); await page.click(".sheet button:has-text('Salva')"); await page.getByText("Chiusura · No segnato").waitFor();
  await page.click("button[data-act=riapri-persona]"); await page.locator("#app .card").first().locator(".percorso-persona").waitFor(); await sync(page);
  check(DB.passi.filter(x => x.persona_id === idChiusi(42) && x.segnato_con).length === 3, "115: «Riapri il percorso» lascia i passi automatici");
  check(await page.evaluate(() => document.documentElement.scrollWidth <= 360), "115: a 360 px niente scorrimento di lato");
  await tavola(S + "/e2e/115-passi-light.png", ritagli.light); await tavola(S + "/e2e/115-passi-dark.png", ritagli.dark, true);
  await ctx.close();
  togliChiusi();
}
await browser.close(); console.log("controlli superati: " + ok); if(errori.length){ console.log("ERRORI CONSOLE:", errori); process.exitCode = 1; }
