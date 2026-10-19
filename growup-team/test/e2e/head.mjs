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
 {ordine:8,chiave:"argento",nome:"Argento 21%",vp_personali:0,vp_gruppo:10000,linee:2,linee_obiettivo:3,guadagno_mese:3750,struttura_calcolo:"200 VP personali + 3 linee da 4.100 VP"}];
const DB = { partners:[{id:"R",nome:"Stefano e Alessia",codice_invito:"RRRR22",chiave:"a".repeat(32),stato:"gestito",is_admin:true}],
  /* il listino (prodotti inventati) */
  listino:[{codice:"900001",nome:"Double Prova (31 giorni)",formato:"140 g",categoria:"Integratori",prezzo_cliente:80,prezzo_partner:66.5,vp:26.5,attivo:true},
    {codice:"900002",nome:"Shampoo Prova",formato:"250 ml",categoria:"Capelli",prezzo_cliente:12.4,prezzo_partner:10.3,vp:4.1,attivo:true},
    {codice:"900003",nome:"Vecchio Prova",formato:"1 pz",categoria:"Casa",prezzo_cliente:5,prezzo_partner:4,vp:1.5,attivo:false}],
  accessi:[], aggiunti:[], anon:0, activities:[], goals:[], mgoals:[], joins:[], stages,
  settings:[{chiave:"obiettivi_proposti",valore:{contatti:10,piani:3,vp_mese:100}},{chiave:"fonte_guadagni",valore:"Simulatore di reddito ufficiale Amway, ottobre 2026"},{chiave:"avviso_guadagni",valore:"Cifre indicative."}]};
const errori = [];
let ok = 0; const check = (c, m) => { if(!c){ console.log("FAIL:", m); process.exitCode = 1; } else { ok++; } };
const browser = await chromium.launch();
async function apri(ctxOpts, hash){
  const ctx = await browser.newContext(Object.assign({ viewport:{width:390,height:844}, locale:"it-IT", timezoneId:"Europe/Rome", bypassCSP:true }, ctxOpts));
  await ctx.route(/cdn\.jsdelivr\.net/, r => r.abort());
  /* captcha finto: risponde subito con un gettone di prova (o con un errore se DB.captchaKo) */
  await ctx.route(/challenges\.cloudflare\.com/, r => r.fulfill({ contentType:"text/javascript", body:
    "window.turnstile={render:function(el,o){el.textContent='captcha';setTimeout(function(){window.__DB.captchaKo?o['error-callback']():o.callback('tok-prova')},50)}};" }));
  const page = await ctx.newPage();
  page.on("console", m => { if(m.type() === "error" && !/jsdelivr|ERR_FAILED|Failed to load resource/.test(m.text())) errori.push(m.text()); });
  page.on("pageerror", e => errori.push(String(e)));
  page.on("dialog", d => d.accept());
  await page.addInitScript(([db, m]) => { window.__DB = db; eval(m); }, [DB, mock]);
  await page.goto(BASE + (hash || ""));
  return { ctx, page };
}
const sync = async page => Object.assign(DB, await page.evaluate(() => JSON.parse(JSON.stringify(window.__DBOUT || window.__DB))));
