import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import fs from "fs";
const S = process.env.S, BASE = "http://127.0.0.1:8765/growup-team/";
const mock = fs.readFileSync(S + "/e2e/mock.js", "utf8");
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
  await page.addInitScript(([db, m]) => { window.__DB = db; eval(m); }, [DB, mock]);
  await page.goto(BASE + (hash || ""));
  return { ctx, page };
}
const sync = async page => Object.assign(DB, await page.evaluate(() => JSON.parse(JSON.stringify(window.__DBOUT || window.__DB))));
/* ottimizzazione 1: tappa e diario si aprono toccandoli; gli ordini stanno nel foglio «Ordini» */
const apriRiga = async (pg, act) => { const b = pg.locator(`button[data-act=${act}]`).first();
  if(await pg.locator(".sheet").count()) return;
  if(await b.getAttribute("aria-expanded") === "false") await b.click(); };
const apriTappa = pg => apriRiga(pg, "apri-tappa");
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
