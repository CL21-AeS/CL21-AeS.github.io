/* ============================================================
   GROWUP TEAM — Fase 1
   Si entra senza email: con il link d'invito dello sponsor la prima volta, poi con il
   proprio LINK PERSONALE (…/#chiave=…), che si tiene su WhatsApp o Telegram.
   "La mia settimana" (contatti e piani), "Il mio mese" (VP e clienti),
   + Contatto / + Piano / + Ordine, il percorso base (visione Argento e tappa attuale)
   e "La mia struttura", dove si aggiungono a mano le persone che non usano l'app.
   I dati stanno in Supabase; la sicurezza sta nella RLS (supabase/002_rls.sql).
   ============================================================ */
(function(){
"use strict";

const CFG = window.GROWUP_CONFIG || {};
const TZ = "Europe/Rome";
const CHIAVE_INVITO = "growup-team.invito";
const CHIAVE_LOCALE = "growup-team.chiave";
const CHIAVE_SALVATA = "growup-team.chiave-salvata";
const CHIAVE_INSTALLA_NO = "growup-team.installa-no";
const CHIAVE_ULTIMA_COPIA = "growup-team.ultima-copia";
const CHIAVE_RISPOSTA_T = "growup-team.risposta-target";
const CHIAVE_LISTINO = "growup-team.listino";          // l'ultimo listino letto, per cercare i prodotti anche con poco segnale
const CHIAVE_WA = "growup-team.whatsapp";              // il mio numero WhatsApp (solo su questo telefono) per le risposte del Target  // risposte Target aperte prima di entrare
const FORMA_CODICE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
const FORMA_CHIAVE = /^[0-9a-f]{32}$/;
const PIN = [3, 6, 9, 12, 15, 18, 21];   // percentuali raggiungibili anche senza qualifica Bronze
const TAPPE_DI_PERCORSO = ["primo_ordine", "primi_clienti"];   // tappe, non qualifiche: non si dichiarano
const PROPOSTA_BASE = { contatti:10, piani:3, vp_mese:100 };

/* ---- 1. Accesso ai dati: tutto passa da qui ----
   I test sostituiscono questo oggetto con window.GROWUP_API. */
function creaApi(){
  if(window.GROWUP_API) return window.GROWUP_API;
  if(!CFG.supabaseUrl || !CFG.supabaseKey || !window.supabase) return null;
  const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {
    auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:false }
  });
  const q = async p => { const { data, error } = await p; if(error) throw error; return data; };
  return {
    session:      async () => (await sb.auth.getSession()).data.session,
    signInAnon:   captchaToken => q(sb.auth.signInAnonymously(captchaToken ? { options:{ captchaToken } } : undefined)),
    signOut:      () => sb.auth.signOut(),
    sponsorName:  codice => q(sb.rpc("sponsor_da_codice", { p_codice:codice })),
    collega:      () => q(sb.rpc("collega_profilo")),
    entra:        chiave => q(sb.rpc("entra_con_chiave", { p_chiave:chiave })),
    join:         args => q(sb.rpc("entra_con_invito", args)),
    cambiaChiave: () => q(sb.rpc("cambia_chiave")),
    accettaPrivacy: pid => q(sb.from("partners").update({ privacy_accettata_il:new Date().toISOString() }).eq("id", pid)),
    /* io e tutta la mia downline: la RLS restituisce solo quella */
    /* io e chi vedo, ognuno sotto il primo sopra di lui che vedo (struttura "ricucita" nel database) */
    struttura:    () => q(sb.rpc("struttura_visibile")),
    /* chi è da confermare dal report Amway e chi è bloccato (per chi vedo) */
    accessiStruttura: () => q(sb.rpc("accessi_struttura")),
    statoAccesso: () => q(sb.rpc("stato_accesso")),
    togliDallaStruttura: pid => q(sb.rpc("togli_dalla_struttura", { p_partner:pid })),
    bloccaApp:    (pid, blocca) => q(sb.rpc("blocca_app", { p_partner:pid, p_blocca:blocca })),
    codiciTolti:  () => q(sb.rpc("codici_tolti_elenco")),
    sbloccaCodice: codice => q(sb.rpc("sblocca_codice", { p_codice:codice })),
    creaInvitoSopra: (pid, altri) => q(sb.rpc("crea_invito_sopra", { p_partner:pid, p_altri:altri })),
    modificaPartenza: args => q(sb.rpc("modifica_partenza", args)),
    impostaProssima: chiave => q(sb.rpc("imposta_prossima_qualifica", { p_chiave:chiave })),
    prossime:     () => q(sb.rpc("prossime_qualifiche")),
    mesiReport:   pid => q(sb.rpc("mesi_qualifica", { p_partner:pid })),
    salvaReportPassato: args => q(sb.rpc("salva_report_passato", args)),
    preferiti:    () => q(sb.from("preferiti").select("preferito_id")),
    copiaDati:    () => q(sb.rpc("copia_dati")),
    /* il primo obiettivo: il proprio per intero; del gruppo solo cifra e data (il perché resta personale) */
    obiettivo:    pid => q(sb.from("obiettivi").select("cifra_mese,entro,perche").eq("partner_id", pid).maybeSingle()),
    salvaObiettivo: o => q(sb.from("obiettivi").upsert(o)),
    obiettiviGruppo2: () => q(sb.rpc("obiettivi_gruppo")),
    aggiungiPreferito: (io, pid) => q(sb.from("preferiti").insert({ partner_id:io, preferito_id:pid })),
    togliPreferito: (io, pid) => q(sb.from("preferiti").delete().eq("partner_id", io).eq("preferito_id", pid)),
    /* ultime 4 settimane di me e della mia downline (la RLS restituisce solo quelle) */
    attivitaGruppo: dal => q(sb.from("activities").select("partner_id,tipo,quantita,vp,data,inserito_il").gte("data", dal)),
    obiettiviGruppo: dal => q(sb.from("goals").select("partner_id,settimana,obiettivo_contatti,obiettivo_piani").gte("settimana", dal)),
    obiettiviMeseGruppo: dal => q(sb.from("monthly_goals").select("partner_id,mese,obiettivo_vp").gte("mese", dal)),
    nuovaChiavePer: pid => q(sb.rpc("nuova_chiave_per", { p_partner:pid })),
    /* codice Amway Partner: il mio o di una persona che ho importato */
    impostaCodice: (pid, codice) => q(sb.rpc("imposta_codice_amway", { p_partner:pid, p_codice:codice })),
    /* import della rete dal report Amway: le persone importate le vede solo chi le importa */
    importaRete:  a => q(sb.rpc("importa_rete", a)),
    /* 033: una sola struttura, la mappa Amway: l'import aggiorna tutto il mio gruppo, vince il report più aggiornato */
    importaMappa: a => q(sb.rpc("importa_mappa", a)),
    salvaMesePassato: a => q(sb.rpc("salva_mese_passato", a)),
    inAttesa:     () => q(sb.rpc("in_attesa")),
    datiAl:       (pid, mese) => q(sb.from("numeri_mese").select("dati_al").eq("partner_id", pid).eq("mese", mese)),
    /* 034: i miei numeri ufficiali (per sommare i miei ordini scritti dopo il report) */
    mioReport:    (pid, dal) => q(sb.from("numeri_mese").select("mese,vpp,vpg,percentuale,dati_al,importato_da").eq("partner_id", pid).gte("mese", dal)),
    /* 034: la bozza d'ordine e lo storico dei miei ordini (solo miei, RLS) */
    ordiniMiei:   () => q(sb.from("ordini_personali").select("*").order("creato_il")),
    righeMie:     () => q(sb.from("righe_ordine_personale").select("*")),
    nuovaBozzaMia: id => q(sb.from("ordini_personali").insert({ id })),
    nuovaRigaMia: riga => q(sb.from("righe_ordine_personale").insert(riga)),
    quantitaMia:  (id, quantita) => q(sb.from("righe_ordine_personale").update({ quantita }).eq("id", id)),
    togliRigaMia: id => q(sb.from("righe_ordine_personale").delete().eq("id", id)),
    togliOrdineMio: id => q(sb.from("ordini_personali").delete().eq("id", id)),
    confermaOrdine: (id, data) => q(sb.rpc("conferma_ordine", { p_ordine:id, p_data:data })),
    /* 035: la Guida per l'azione (numeri scritti, obiettivi e spunte: solo miei) */
    guidaConteggi: mese => q(sb.rpc("guida_conteggi", { p_mese:mese })),
    numeriCl21:   () => q(sb.from("numeri_cl21").select("app_cl21,training_day,convention")),
    salvaNumeriCl21: r => q(sb.from("numeri_cl21").upsert(r, { onConflict:"partner_id" })),
    guidaObiettivi: () => q(sb.from("guida_obiettivi").select("chiave,a_settimana")),
    salvaGuidaObiettivo: (chiave, n) => q(sb.from("guida_obiettivi").upsert({ chiave, a_settimana:n }, { onConflict:"partner_id,chiave" })),
    guidaFatti:   dal => q(sb.from("guida_fatti").select("chiave,giorno").gte("giorno", dal)),
    segnaFatto:   (chiave, giorno) => q(sb.from("guida_fatti").insert({ chiave, giorno })),
    togliFatto:   (chiave, giorno) => q(sb.from("guida_fatti").delete().eq("chiave", chiave).eq("giorno", giorno)),
    /* 036: Seguimi giorno per giorno (solo mio; all'upline solo i numeri, se lo condivido) */
    seguimi:      () => q(sb.from("seguimi").select("attivo,condividi")),
    salvaSeguimi: r => q(sb.from("seguimi").upsert(r, { onConflict:"partner_id" })),
    seguimiGiorni: dal => q(sb.from("seguimi_giorni").select("giorno,azioni,proposte,fatte,per_tipo").gte("giorno", dal).order("giorno")),
    salvaSeguimiGiorno: r => q(sb.from("seguimi_giorni").upsert(r, { onConflict:"partner_id,giorno" })),
    /* 039: notifiche */
    chiaveNotifiche: () => q(sb.rpc("chiave_pubblica_notifiche")),
    salvaTelefono: async t => { await q(sb.from("notifiche_telefoni").delete().eq("endpoint", t.endpoint)); return q(sb.from("notifiche_telefoni").insert(t)); },
    togliTelefono: endpoint => q(sb.from("notifiche_telefoni").delete().eq("endpoint", endpoint)),
    salvaPreviste: righe => q(sb.from("notifiche_previste").upsert(righe, { onConflict:"partner_id,giorno" })),
    notificaProva: async () => { const { data, error } = await sb.functions.invoke("invia-notifiche", { body:{ prova:true } }); if(error) throw error; return data; },
    seguimiDi:    pid => q(sb.rpc("seguimi_di", { p_partner:pid })),
    /* 037: l'Analisi della persona (numeri dei report) e i dati che un partner condivide (mai nomi) */
    analisiPersona: pid => q(sb.rpc("analisi_persona", { p_partner:pid })),
    datiCondivisi: pid => q(sb.rpc("dati_condivisi", { p_partner:pid })),
    esclusi:      () => q(sb.from("esclusi_import").select("codice")),
    /* persone nascoste dalla mia struttura (i loro VP contano lo stesso) */
    nascosti:     () => q(sb.from("nascosti").select("nascosto_id")),
    nascondi:     (io, pid) => q(sb.from("nascosti").insert({ partner_id:io, nascosto_id:pid })),
    mostra:       (io, pid) => q(sb.from("nascosti").delete().eq("partner_id", io).eq("nascosto_id", pid)),
    nascondiTanti:(io, ids) => q(sb.from("nascosti").insert(ids.map(id => ({ partner_id:io, nascosto_id:id })))),
    persone:      () => q(sb.from("persone").select("*")),
    passi:        () => q(sb.from("passi").select("*")),
    nuovePersone: righe => q(sb.from("persone").insert(righe)),
    modificaPersona: (id, campi) => q(sb.from("persone").update(campi).eq("id", id)),
    cancellaPersona: id => q(sb.from("persone").delete().eq("id", id)),
    nuoviPassi:   righe => q(sb.from("passi").insert(righe)),
    cancellaPasso: id => q(sb.from("passi").delete().eq("id", id)),
    invitiTarget: () => q(sb.from("inviti_target").select("*")),
    nuovoInvito:  riga => q(sb.from("inviti_target").insert(riga)),
    aggiornaInvito: (id, campi) => q(sb.from("inviti_target").update(campi).eq("id", id)),
    cancellaInvito: id => q(sb.from("inviti_target").delete().eq("id", id)),
    invitoTargetAperto: id => q(sb.rpc("invito_target_aperto", { p_id:id })),
    ordini:       () => q(sb.from("ordini").select("*")),
    righeOrdini:  () => q(sb.from("righe_ordine").select("*")),
    durate:       () => q(sb.from("durate").select("codice, giorni")),
    /* il listino Amway: lo leggono gli utenti dell'app, lo scrive solo l'admin (RLS) */
    listino:      () => q(sb.from("listino").select("codice, nome, formato, categoria, prezzo_cliente, prezzo_partner, vp, attivo").order("nome").range(0, 4999)),
    salvaListino: righe => q(sb.from("listino").upsert(righe, { onConflict:"codice" })),
    nuovoOrdine:  riga => q(sb.from("ordini").insert(riga)),
    nuoviOrdini:  righe => q(sb.from("ordini").insert(righe)),
    nuoveRighe:   righe => q(sb.from("righe_ordine").insert(righe)),
    aggiornaOrdine: (id, campi) => q(sb.from("ordini").update(campi).eq("id", id)),
    cancellaOrdine: id => q(sb.from("ordini").delete().eq("id", id)),
    cancellaRighe: ordineId => q(sb.from("righe_ordine").delete().eq("ordine_id", ordineId)),
    salvaDurata:  async (codice, giorni) => {
      const r = await q(sb.from("durate").update({ giorni }).eq("codice", codice).select("codice"));
      if(!r || !r.length) await q(sb.from("durate").insert({ codice, giorni }));
    },
    numeriPersone: pid => q(sb.rpc("numeri_persone", { p_partner:pid })),
    mostraTanti:  (io, ids) => q(sb.from("nascosti").delete().eq("partner_id", io).in("nascosto_id", ids)),
    stages:       () => q(sb.from("stage_requirements").select("*").order("ordine")),
    settings:     () => q(sb.from("settings").select("chiave,valore")),
    /* la settimana e il mese in corso per intero; ordini e clienti di sempre (servono alle tappe) */
    activities:   (pid, dal) => q(sb.from("activities").select("*").eq("partner_id", pid)
                    .or(`data.gte.${dal},tipo.in.(ordine,rettifica,cliente)`).order("inserito_il")),
    addActivity:  row => q(sb.from("activities").insert(row).select().single()),
    deleteActivity: id => q(sb.from("activities").delete().eq("id", id)),
    lastGoal:     (pid, finoA) => q(sb.from("goals").select("*").eq("partner_id", pid)
                    .lte("settimana", finoA).order("settimana", { ascending:false }).limit(1)),
    saveGoal:     row => q(sb.from("goals").upsert(row, { onConflict:"partner_id,settimana" }).select().single()),
    lastMonthGoal: (pid, finoA) => q(sb.from("monthly_goals").select("*").eq("partner_id", pid)
                    .lte("mese", finoA).order("mese", { ascending:false }).limit(1)),
    /* Fase 2: i numeri del mese di me e della mia downline (calcolati nel database) */
    riepilogo:    mese => q(sb.rpc("riepilogo_mese", { p_mese:mese })),
    storico:      pid => q(sb.from("monthly_totals").select("*").eq("partner_id", pid).order("mese")),
    livelli:      () => q(sb.from("percent_levels").select("*").order("percentuale")),
    saveMonthGoal: row => q(sb.from("monthly_goals").upsert(row, { onConflict:"partner_id,mese" }).select().single())
  };
}
const api = creaApi();

/* ---- 2. Stato ---- */
const st = {
  fase: "avvio",          // avvio | config | benvenuto | chiave_errata | ingresso | home | errore
  profilo: null,
  chiave: null,           // la chiave del link personale, se questo dispositivo la conosce
  stages: [],
  settings: {},
  att: [],
  goal: null,             // settimana: { obiettivo_contatti, obiettivo_piani, salvato }
  goalMese: null,         // mese: { obiettivo_vp, salvato }
  invito: null,           // codice dello sponsor dal link d'invito
  invitoRiserva: null,    // l'invito lasciato per "entra con il tuo link": si può tornare indietro
  struttura: [],          // io e la mia downline
  accessi: new Map(),     // chi è da confermare o bloccato, tra chi vedo
  linkGestito: null,      // { nome, chiave }: nuovo link personale creato dall'admin per chi l'ha perso
  nascosti: new Set(),    // persone nascoste dalla mia struttura (solo loro: chi sta sotto resta)
  persone: [], passi: [], // la mia lista (solo mia) e i suoi passi
  personaId: null, filtroLista: "aperti", cercaLista: "", passoTipo: null,
  numeriLista: {},
  schedaPila: [],          // le schede aperte scendendo lungo le linee, per "Indietro"
  consigliAperti: new Set(),
  prossime: new Map(),     // la prossima qualifica di chi vedo (da Platino in su)
  mesiReport: [],          // i miei numeri dei report degli ultimi 13 mesi (percentuale per i mesi da Argento)
  mesiScheda: {},          // gli stessi, per le schede del gruppo
  mesiLinee: new Map(),
  inAttesa: [],            // chi usa l'app nella mia downline ma non è ancora nella mappa (solo il nome)    // da Platino in su: i mesi dei report delle mie linee frontali (per Smeraldo, Diamante, Zaffiro)  // "Come arrivarci" aperto (per persona), così resta aperto quando la pagina si ridisegna
  inviti: [], sezPersone: "lista", invitoId: null, archiviatiT: false,  // il Target (solo miei)
  ct: null,               // la pagina del contatto (le otto domande)
  listino: [],            // il listino Amway (dal database; una copia sul telefono)
  ordini: [], righe: [], durate: new Map(), filtroClienti: "tutti",   // i Clienti (solo miei)
  impOrdini: null,         // l'import degli ordini dal sito Amway (anteprima)
  bozza: null, cercaProdotto: "", tipoMsg: "finendo", varianteMsg: 0, durataCodice: null, nuovoCliente: false,        // per la scheda partner: solo i numeri della sua lista
  conNascoste: false,     // struttura completa: le nascoste al loro posto, in grigio
  filtroNascoste: "nascoste", // elenco "Chi vedi": nascoste | visibili
  esclusi: new Set(),     // codici esclusi dagli import
  riep: [],               // numeri del mese in corso: io e la mia downline (riepilogo_mese)
  chiusi: new Set(),
  cerca: "",               // ricerca nella struttura
  preferiti: new Set(),    // persone del gruppo da seguire da vicino
  obiettivo: null,         // il mio primo obiettivo { cifra_mese, entro, perche }
  obiettiviGruppo: new Map(), // cifra e data degli obiettivi del mio gruppo
  espansi: new Set(),      // durante la ricerca: persone di cui mostrare anche il gruppo       // nella struttura: persone con il gruppo richiuso
  gruppo4: { att:[], goals:[], mgoals:[] },  // ultime 4 settimane del gruppo: imbuto ed etichette
  riepPrec: [],           // lo stesso per il mese precedente, finché non è chiuso
  storico: [],            // i miei mesi chiusi (monthly_totals)
  livelli: [],            // soglie delle percentuali
  aiuti: new Set(),       // le spiegazioni aperte con il «?» (ottimizzazione 2)
  passoAperto: null,      // la voce aperta di «Primi passi»
  sezIo: "giorno",        // in Io: "giorno" (la pagina di sempre) o "guida" (la Guida per l'azione)
  guida: { conteggi:{}, cl21:{}, obiettivi:new Map(), fatti:[] },
  seguimi: { attivo:false, condividi:false }, seguimiGiorni: [], seguimiScheda: {},
  analisi: {}, condivisi: {}, analisiId: null,
  vista: "io",            // pagina della home: "io", "gruppo" (struttura, inviti) o "scheda" (un partner)
  schedaId: null,         // partner aperto nella scheda
  attScheda: [],          // le sue attività (mese aperto)
  target: null,           // per chi sto registrando: null = io; un id = partner senza app che gestisco
  sponsorNome: "",
  errore: "",
  occupato: false,
  sheet: null
};

/* ---- 3. Date, sempre nel fuso di Roma ---- */
const fmtGiorno = new Intl.DateTimeFormat("en-CA", { timeZone:TZ, year:"numeric", month:"2-digit", day:"2-digit" });
const fmtOra = new Intl.DateTimeFormat("it-IT", { timeZone:TZ, hour:"2-digit", minute:"2-digit" });
function oggi(){ return fmtGiorno.format(new Date()); }
function piuGiorni(s, n){ const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0,10); }
function lunedi(s){ const d = new Date(s + "T00:00:00Z"); return piuGiorni(s, -((d.getUTCDay() + 6) % 7)); }
function giorniTra(a, b){ return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5); }
function meseDi(s){ return String(s).slice(0,7); }
function mesiTra(a, b){ const [ya,ma] = a.split("-").map(Number), [yb,mb] = b.split("-").map(Number); return (yb-ya)*12 + (mb-ma); }
const MESI = ["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
function dataIt(s){ const [y,m,d] = s.split("-").map(Number); return `${d} ${MESI[m-1]}${y !== Number(oggi().slice(0,4)) ? " " + y : ""}`; }
function nomeMese(m){ const [y,mm] = m.split("-").map(Number); return `${MESI[mm-1]} ${y}`; }

/* ---- 4. Utilità (come in growup/) ---- */
function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }
function num(n){ const x = Math.round((Number(n) || 0) * 100) / 100; const [i, d] = String(x).split("."); return i.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (d ? "," + d : ""); }
function euro(n){ return num(n) + " €"; }
/* prezzi e VP di prodotti e ordini: sempre con due decimali, come nel listino Amway (96,30 € · 18,20 VP) */
function num2(n){ const [i, d] = (Math.round((Number(n) || 0) * 100) / 100).toFixed(2).split("."); return i.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + d; }
function prezzo(n){ return num2(n) + " €"; }
function plur(n, uno, molti){ return n === 1 ? `${n} ${uno}` : `${num(n)} ${molti}`; }
function numIt(v){ return Number(String(v).trim().replace(/\./g, "").replace(",", ".")); }
function salvaLocale(k, v){ try{ v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); }catch(e){} }
function leggiLocale(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
/* "Stefano e Alessia" resta intero; "Anna Bianchi" diventa "Anna" */
function nomeSaluto(n){ n = String(n || "").trim(); return / e /i.test(n) ? n : n.split(" ")[0]; }

let toastT = null, toastAnnulla = null;
function toast(msg, annulla){
  const t = document.getElementById("toast");
  clearTimeout(toastT);
  toastAnnulla = annulla || null;
  t.innerHTML = `<div class="toast" role="status"><span>${esc(msg)}</span>${annulla ? `<button data-act="annulla">Annulla</button>` : ""}</div>`;
  const el = t.firstElementChild;
  anima(el, [{ opacity:0, transform:"translate(-50%, 18px)" }, { opacity:1, transform:"translate(-50%, 0)" }], VIVACE);
  toastT = setTimeout(() => { anima(el, [{ opacity:1 }, { opacity:0 }], { dur:180 }).then(() => { if(t.firstElementChild === el){ t.innerHTML = ""; toastAnnulla = null; } }); },
    annulla ? 5000 : 3000);
}

const MESSAGGI_ERRORE = {
  chiave_non_valida: "Questo link personale non è valido o è stato sostituito con uno nuovo.",
  codice_non_valido: "Il link d'invito non è valido. Chiedi al tuo sponsor di rimandartelo.",
  profilo_esistente: "Questo telefono è già collegato a un profilo: ricarica la pagina.",
  data_futura: "La data di iscrizione non può essere nel futuro.",
  qualifica_non_valida: "Qualifica non riconosciuta.",
  ordine_vuoto: "La bozza è vuota: aggiungi almeno un prodotto.",
  data_non_valida: "La data dell'ordine non può essere nel futuro.",
  in_attesa: "Sei ancora in attesa della mappa: potrai importare dopo che un report della tua upline ti avrà inserito nella struttura.",
  codice_mancante: "Prima importa il report del mese in corso: salva il tuo codice Amway nell'app.",
  percentuale_non_valida: "Percentuale non riconosciuta.",
  posizione_non_valida: "Puoi aggiungere persone solo nel tuo gruppo.",
  nome_mancante: "Scrivi il nome della persona.",
  non_gestito: "Questa persona usa già l'app: entra con il suo link personale.",
  non_autorizzato: "Non puoi farlo per questa persona.",
  partner_inesistente: "Questa persona non c'è più nella struttura.",
  mese_chiuso: "Quel mese è già chiuso: si registrano il mese in corso e, fino al giorno 5, il mese precedente.",
  codice_amway_usato: "Questo codice Amway è già di un'altra persona nell'app.",
  codice_amway_non_valido: "Il codice Amway è fatto di sole cifre (es. 1234567).",
  codice_amway_mancante: "Scrivi il codice Amway Partner della persona.",
  import_non_valido: "Il file non è stato letto bene: scaricalo di nuovo dal sito Amway e riprova.",
  import_di_altri: "Questo report non è il tuo: ognuno importa il report scaricato dal proprio accesso al sito Amway.",
  codice_amway_attivo: "Con questo codice Amway c'è già qualcuno che usa l'app: entra con il tuo link personale (quello che ti eri salvato).",
  codice_amway_altra_linea: "Questo codice Amway è nella struttura di un altro gruppo: chiedi il link d'invito al tuo sponsor.",
  codice_tolto: "Questo codice Amway è stato tolto dalla struttura: per rientrare chiedi a Stefano e Alessia di sbloccarlo.",
  gia_confermato: "È già confermata dal report Amway: non si può più togliere dalla struttura.",
  non_autenticato: "Sessione scaduta: apri di nuovo il tuo link personale."
};
function messaggio(e){
  const m = (e && (e.message || e.error_description || e.msg)) || String(e || "");
  for(const k in MESSAGGI_ERRORE) if(m.includes(k)) return MESSAGGI_ERRORE[k];
  if(/captcha/i.test(m)) return "Il controllo di sicurezza non è riuscito. Ricarica la pagina e riprova.";
  if(/anonymous/i.test(m)) return "L'accesso senza email non è ancora attivo su Supabase (vedi LEGGIMI, punto 3).";
  if(/rate|too many|seconds/i.test(m)) return "Troppi ingressi ravvicinati dalla stessa rete: aspetta qualche minuto e riprova.";
  if(/fetch|network|failed/i.test(m)) return "Sembra che manchi la connessione. Riprova tra poco.";
  return "Qualcosa non è andato: " + m;
}

/* ---- 5. Link: invito, chiave personale ---- */
function base(){ return location.origin + location.pathname; }
function linkPersonale(){ return st.chiave ? base() + "#chiave=" + st.chiave : ""; }
function linkInvito(){ return base() + "#" + st.profilo.codice_invito; }

/* Legge un link (o il solo codice) incollato o arrivato nell'indirizzo. */
function leggiLink(testo){
  const t = String(testo || "").trim();
  const k = t.match(/chiave=([0-9a-fA-F]{32})/) || t.match(/^([0-9a-fA-F]{32})$/);
  if(k) return { chiave:k[1].toLowerCase() };
  const c = t.replace(/^.*#/, "").trim().toUpperCase();
  if(FORMA_CODICE.test(c)) return { invito:c };
  return null;
}
function ricordaChiave(k){ st.chiave = k; salvaLocale(CHIAVE_LOCALE, k); }

/* ---- 6. Percorso: tappe, requisiti, visione ---- */
function cfg(k){ return st.settings[k]; }
function attivita(tipo){ return st.att.filter(a => a.tipo === tipo); }
function somma(lista, campo){ return lista.reduce((t, a) => t + Number(a[campo] || 0), 0); }
function perMese(lista, campo){
  const out = {};
  for(const a of lista) out[meseDi(a.data)] = (out[meseDi(a.data)] || 0) + Number(a[campo] || 0);
  return out;
}
/* I VP: ordini più le correzioni fatte con "Aggiorna il totale del mese" (anche negative). */
function movimentiVp(){ return st.att.filter(a => a.tipo === "ordine" || a.tipo === "rettifica"); }
/* I miei VP del mese (034): il VPP del report Amway quando il mese ne ha uno (anche importato dalla upline) più i miei
   ordini scritti dopo la data e ora del file; senza report, gli ordini registrati nell'app. Gli ordini a mano li vedo
   solo io: sponsor e upline vedono solo il report. Con una lista esplicita (un partner senza app) contano gli ordini. */
function reportMio(m){ return (st.mioReport && st.mioReport.get(m)) || null; }
function vpReport(m){ const r = reportMio(m); return r ? Number(r.vpp) || 0 : null; }
function dopoReport(a, r){ return !r || (new Date(a.inserito_il || 0) > new Date(r.dati_al) && a.inserito_da === st.profilo.id); }
function vpDopoReport(m){
  const r = reportMio(m);
  return somma(movimentiVp().filter(a => meseDi(a.data) === m && dopoReport(a, r)), "vp");
}
function vpMese(m, lista){
  if(!lista){ const v = vpReport(m); if(v != null) return v + vpDopoReport(m); }
  return somma((lista || st.att).filter(a => (a.tipo === "ordine" || a.tipo === "rettifica") && meseDi(a.data) === m), "vp");
}
/* il totale che vedo e correggo: il mio (report + dopo) o quello del partner senza app aperto nella scheda */
function vpAttuale(m){ return st.target ? vpMese(m, lista()) : vpMese(m); }
/* Le attività su cui sto lavorando: le mie, o quelle del partner senza app aperto nella scheda */
function lista(){ return st.target ? st.attScheda : st.att; }
function clientiMese(m){ return somma(attivita("cliente").filter(a => meseDi(a.data) === m), "quantita"); }
function clientiTotali(){ return somma(attivita("cliente"), "quantita"); }

/* ---- Fase 2: i numeri del gruppo ----
   Il database calcola VP di gruppo e linee al caricamento (riepilogo_mese). I miei VP personali
   li ricalcolo dal vivo, così un ordine appena registrato si vede subito anche nel gruppo. */
function soglia(){ return Number(cfg("soglia_linea_attiva")) || 100; }
function giornoChiusura(){ return Number(cfg("chiusura_mese_giorno")) || 5; }
function mesePrecedente(){ return meseDi(piuGiorni(primoDelMese(), -1)); }
function precedenteAperto(){ return Number(oggi().slice(8, 10)) <= giornoChiusura(); }
function primaDataAperta(){ return precedenteAperto() ? mesePrecedente() + "-01" : primoDelMese(); }
function rigaDi(righe, id){ return righe.find(r => r.partner_id === id); }
function nomeDi(id){ const p = st.struttura.find(x => x.id === id); return p ? p.nome : ""; }
/* { personali, gruppo, linee:[{ id, nome, vp }], attive, percentuale } per un mese (m) */
/* le linee frontali di una persona dal report Amway: per chi è nell'app il suo nome, per gli altri il codice */
function lineeReport(r){
  return (r.linee_report || []).map(l => { const p = st.struttura.find(x => x.codice_amway === l.codice);
    return { id:p ? p.id : null, nome:p ? p.nome : `Codice ${l.codice} (non nell'app)`, vp:Number(l.vpg) || 0 }; })
    .sort((a, b) => b.vp - a.vp);
}
function numeriMese(m){
  const righe = m === meseDi(oggi()) ? st.riep : m === mesePrecedente() ? st.riepPrec : [];
  const me = st.profilo.id, r = rigaDi(righe, me);
  const personali = vpMese(m);
  /* con un import del report: VP di gruppo, linee e percentuale ufficiali di Amway */
  if(r && r.da_report){
    const linee = lineeReport(r), rep = reportMio(m);
    /* il gruppo del report più i miei ordini scritti dopo il report (solo nella mia app) */
    const extra = rep ? personali - (Number(rep.vpp) || 0) : 0;
    const gruppo = rep ? (Number(rep.vpg) || 0) + extra : Number(r.vp_gruppo);
    return { personali, gruppo, linee, attive:linee.filter(l => l.vp >= soglia()).length,
             percentuale:extra || r.percentuale == null ? percentualeDa(gruppo) : Number(r.percentuale), daReport:true };
  }
  const gruppo = (r ? Number(r.vp_gruppo) - Number(r.vp_personali) : 0) + personali;
  const linee = righe.filter(x => x.sponsor_id === me)
    .map(x => ({ id:x.partner_id, nome:nomeDi(x.partner_id), vp:Number(x.vp_gruppo) }))
    .sort((a, b) => b.vp - a.vp);
  return { personali, gruppo, linee, attive: linee.filter(l => l.vp >= soglia()).length, percentuale: percentualeDa(gruppo) };
}
function percentualeDa(vpGruppo){
  let pct = null;
  for(const l of st.livelli) if(vpGruppo >= Number(l.vp_gruppo)) pct = l.percentuale;
  return pct;
}
/* Requisiti di una tappa (dal Path to Bronze in su) nel mese m: cosa manca */
function mancanze(t, n){
  const out = [];
  if(Number(t.vp_personali) > n.personali) out.push(`mancano ${num(t.vp_personali - n.personali)} VP personali`);
  if(t.vp_gruppo && n.gruppo < t.vp_gruppo) out.push(`mancano ${num(t.vp_gruppo - n.gruppo)} VP di gruppo`);
  if(t.linee){
    const min = Number(t.vp_linea) || soglia(), ok = n.linee.filter(l => l.vp >= min).length;
    if(ok < t.linee) out.push(t.linee - ok === 1 && t.linee === 3 ? "manca la terza linea"
      : `mancano ${t.linee - ok} ${t.linee - ok === 1 ? "linea" : "linee"} da almeno ${num(min)} VP`);
  }
  return out;
}
function ordineDi(chiave){ const t = st.stages.find(s => s.chiave === chiave); return t ? t.ordine : 0; }
/* Oltre Argento le qualifiche sono annuali (mesi del Performance Year). Oro e Platino sono tappe del percorso,
   contate sui mesi da Argento (21% nel report mappe); da Platino in su si dichiarano. */
function oltreArgento(s){ return !!s && ordineDi("argento") > 0 && s.ordine > ordineDi("argento"); }
function oltrePlatino(s){ return !!s && ordineDi("platino") > 0 && s.ordine > ordineDi("platino"); }
const MESI_ARGENTO = { oro:3, platino:6 };   // la prima volta: in 12 mesi consecutivi; Platino con 3 mesi di fila
/* Un mese da Argento (038, regola di Stefano): al 21% senza linee al 21%, oppure con 2 o più linee al 21%, oppure con una
   linea al 21% e almeno 4.000 VP di gruppo rimanenti (fuori da quella linea). Altrimenti è solo «21%». Il calcolo lo fa il
   database (mesi_qualifica: «argento»); per i numeri del mese in corso c'è argentoDaNumeri. */
const ARGENTO_RIMANENTI = 4000;
function daArgento(x){ return !!x && (x.argento != null ? !!x.argento : Number(x.percentuale) >= 21); }
function argentoDaNumeri(pct, vpg, linee){
  if(!(Number(pct) >= 21)) return false;
  const l21 = (linee || []).filter(l => Number(l.pct) >= 21);
  return l21.length !== 1 || (Number(vpg) || 0) - (Number(l21[0].vp) || 0) >= ARGENTO_RIMANENTI;
}
/* i mesi da Argento negli ultimi 12 mesi (compreso quello in corso): { mesi, fila, conReport } */
function mesiArgento(righe){
  const fine = meseDi(oggi()), inizio = spostaMese(fine, -11);
  const per = new Map((righe || []).map(x => [meseDi(x.mese), daArgento(x)]));
  let mesi = 0, fila = 0, run = 0, conReport = 0;
  for(let m = inizio; m <= fine; m = spostaMese(m, 1)){
    if(per.has(m)) conReport++;
    if(per.get(m)){ mesi++; run++; fila = Math.max(fila, run); } else run = 0;
  }
  return { mesi, fila, conReport };
}
function spostaMese(m, n){ const [y, mm] = m.split("-").map(Number), t = y * 12 + mm - 1 + n; return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, "0")}`; }
function tappaAnnualeFatta(t, righe){
  const x = mesiArgento(righe), min = MESI_ARGENTO[t.chiave];
  return !!min && x.mesi >= min && (t.chiave !== "platino" || x.fila >= 3);
}
/* chi ha dichiarato Platino o più sceglie la prossima qualifica */
function daPlatino(chiave){ return ordineDi("platino") > 0 && ordineDi(chiave) >= ordineDi("platino"); }
const RUBINO_VP = 20000;   // Volume Rubino del mese: il VPG del report mappe (senza le linee al 21%)
function nomeQualifica(chiave){ const t = st.stages.find(s => s.chiave === chiave); return t ? t.nome : ""; }

function finestraPrimoOrdine(tappa){
  const p = st.profilo;
  if(!p.data_iscrizione || !tappa.giorni_scadenza) return null;
  const fine = piuGiorni(p.data_iscrizione, tappa.giorni_scadenza);
  const vp = somma(movimentiVp().filter(a => a.data >= p.data_iscrizione && a.data <= fine), "vp");
  return { fine, vp, restano: giorniTra(oggi(), fine) };
}

/* Una tappa è fatta se la qualifica dichiarata la comprende, oppure se i numeri lo dicono. */
function tappaFatta(t){
  if(oltrePlatino(t)) return false;
  if(oltreArgento(t)) return tappaAnnualeFatta(t, st.mesiReport);
  /* Argento: anche un mese al 21% in un report mappe importato (anche di un mese passato) */
  if(t.chiave === "argento" && st.mesiReport.some(daArgento)) return true;
  if(t.chiave === "primo_ordine"){
    const f = finestraPrimoOrdine(t);
    if(f && f.vp >= t.vp_personali) return true;
    return Object.values(perMese(movimentiVp(), "vp")).some(v => v >= t.vp_personali);
  }
  /* i PRIMI 3 clienti, in totale: chi si iscrive il 29 non ha il tempo di farli nel mese */
  if(t.chiave === "primi_clienti") return clientiTotali() >= (t.clienti || 0);
  /* dal Path to Bronze in su: un mese chiuso con quella qualifica (o una più alta), oppure il mese
     in corso o il precedente ancora aperto con tutti i requisiti soddisfatti */
  if(st.storico.some(r => ordineDi(r.qualifica) >= t.ordine)) return true;
  if(!mancanze(t, numeriMese(meseDi(oggi()))).length) return true;
  return precedenteAperto() && st.riepPrec.length > 0 && !mancanze(t, numeriMese(mesePrecedente())).length;
}

function percorso(){
  const S = st.stages;
  let fatte = st.profilo ? S.findIndex(s => s.chiave === st.profilo.qualifica_iniziale) : -1;
  /* un pin senza qualifica Bronze: primo ordine e primi clienti sono alle spalle */
  if(fatte < 0 && st.profilo && st.profilo.percentuale_iniziale) fatte = S.findIndex(s => s.chiave === "primi_clienti");
  while(fatte + 1 < S.length && tappaFatta(S[fatte + 1])) fatte++;
  const attuale = S[fatte + 1] && !oltrePlatino(S[fatte + 1]) ? S[fatte + 1] : null;
  return { raggiunta: fatte >= 0 ? S[fatte] : null, attuale, indice: fatte + 1 };
}

function requisiti(t){
  const m = meseDi(oggi()), out = [];
  if(oltreArgento(t)){
    const x = mesiArgento(st.mesiReport), min = MESI_ARGENTO[t.chiave] || 0;
    out.push({ ok: x.mesi >= min, txt: "Mesi da Argento (21%) negli ultimi 12 mesi", val: `${Math.min(x.mesi, min)} / ${min}` });
    if(t.chiave === "platino") out.push({ ok: x.fila >= 3, txt: "Di cui 3 mesi di fila", val: `${Math.min(x.fila, 3)} / 3` });
    out.push({ ok: x.conReport >= 12, attesa: x.conReport < 12, txt: "Report mappe importati negli ultimi 12 mesi", val: `${x.conReport} / 12` });
    return out;
  }
  if(t.chiave === "primo_ordine"){
    const f = finestraPrimoOrdine(t);
    const vp = f ? f.vp : vpMese(m);
    out.push({ ok: vp >= t.vp_personali,
      txt: `Almeno ${num(t.vp_personali)} VP personali${f ? " entro il " + dataIt(f.fine) : " nel mese"}`,
      val: `${num(vp)} / ${num(t.vp_personali)}` });
    return out;
  }
  if(t.clienti){
    const c = clientiTotali();
    out.push({ ok: c >= t.clienti, txt: `I tuoi primi ${t.clienti} clienti`, val: `${num(Math.min(c, t.clienti))} / ${t.clienti}`, cliente:true });
  }
  const n = numeriMese(m);
  if(Number(t.vp_personali) > 0){
    out.push({ ok: n.personali >= t.vp_personali, txt: `${num(t.vp_personali)} VP personali nel mese`, val: `${num(n.personali)} / ${num(t.vp_personali)}` });
  }
  if(t.linee){
    const min = Number(t.vp_linea) || soglia(), ok = n.linee.filter(l => l.vp >= min).length;
    out.push({ ok: ok >= t.linee, txt: `${t.linee} linee frontali da almeno ${num(min)} VP di gruppo`, val: `${Math.min(ok, t.linee)} / ${t.linee}` });
  }
  if(t.vp_gruppo) out.push({ ok: n.gruppo >= t.vp_gruppo, txt: `${num(t.vp_gruppo)} VP di gruppo nel mese`, val: `${num(n.gruppo)} / ${num(t.vp_gruppo)}` });
  return out;
}

/* ---- "Come arrivarci": i consigli, solo a richiesta (pagina Obiettivo e scheda partner) ----
   È l'unica parte dell'app che dà suggerimenti. Una situazione alla volta, la prima che scatta. */
const ATTIVE_MIN = 0.25;   // almeno 1 persona su 4 a 100 VP e oltre: "mancano persone", sotto: "fatturato basso"
const CONSIGLI = {
  primo_ordine:{
    io:["Il primo passo è usare tu i prodotti: scegli quelli che ti servono davvero in casa e arriva ai {manca} VP che mancano entro il {entro}.",
      "Fallo con il tuo sponsor: ti aiuta a scegliere e a capire come ordinare dal sito."] },
  primi_clienti:{
    io:["Ti {mancano} {manca_clienti}. Parti da chi ti conosce bene e da chi ha già visto i prodotti in casa tua: amici, parenti, colleghi.",
      "Proponi un prodotto che usi tu e racconta come ti trovi: è il modo più semplice per iniziare."] },
  fermo:{
    io:["Questo mese non ci sono ancora VP personali: si riparte dal tuo ordine e da quelli dei tuoi clienti.",
      "Guarda i clienti da sentire nella pagina Io: chi sta finendo un prodotto è il primo da chiamare."],
    lui:["Questo mese non ha ancora VP personali.", "Più che i numeri, conta capire come sta: fissa una chiamata e ascolta prima di proporre."] },
  personali:{
    io:["Per la tappa servono {vp_personali} VP personali: te ne mancano {manca}.",
      "Il fatturato personale si costruisce con i clienti: chi ha già comprato e chi sta finendo un prodotto. Un nuovo cliente al mese cambia la base."],
    lui:["Gli mancano {manca} VP personali per la tappa ({vp_personali}).", "Guardate insieme i suoi clienti: chi sta finendo un prodotto, chi non ha mai comprato."] },
  linee_zero:{
    io:["Per {tappa} servono {linee} frontali con almeno {vp_linea} VP di gruppo ciascuno. Inizia dai primi {linee} frontali.",
      "Parti dalla tua lista: le persone in corso sono le più vicine. Mostra il piano a chi ha detto sì all'incontro."],
    lui:["Non ha ancora linee attive: gli servono i primi {linee} frontali.", "Aiutalo a scegliere dalla sua lista le persone a cui mostrare il piano e affiancalo nei primi incontri."] },
  linee_crescere:{
    io:["Ti {mancano} {manca_linee} da {vp_linea} VP. Hai due strade: far crescere la linea più vicina alla soglia, oppure aprire una linea nuova.",
      "Nella tabella sotto vedi a quanto è ogni linea: la più vicina è quella che si sblocca prima."],
    lui:["Gli {mancano} {manca_linee} da {vp_linea} VP.", "Guardate insieme la linea più vicina alla soglia: lì spesso basta un cliente o un ordine in più. Se nessuna è vicina, serve una linea nuova."] },
  "linea_vp.persone":{
    io:["Le persone nelle tue linee fatturano già bene: quello che manca è il numero di persone.",
      "Aiuta i tuoi frontali a portare nuove persone (clienti e partner) nella loro linea: è l'espansione che fa crescere il gruppo."],
    lui:["Nelle sue linee chi c'è fattura già bene: mancano persone.", "Il lavoro è aiutare i suoi frontali ad allargare la loro linea, con nuovi clienti e nuovi partner."] },
  "linea_vp.fatturato":{
    io:["Nelle tue linee ci sono già persone, ma molte hanno fatturato basso o zero.",
      "Prima di cercare persone nuove, aiuta chi c'è: i loro primi clienti, il loro ordine personale. Ogni persona che arriva a 100 VP sposta la linea.",
      "{vicine} tra 50 e 99 VP: con un cliente in più si arriva a 100. Partirei da lì."],
    lui:["Nelle sue linee ci sono persone, ma tante a 0 o sotto 50 VP.", "Il lavoro è sul fatturato di chi c'è già: clienti e ordine personale delle persone, più che nuovi ingressi.",
      "{vicine} tra 50 e 99 VP: è da lì che conviene partire."] },
  "gruppo.persone":{
    io:["Ti mancano {manca} VP di gruppo. Chi c'è nelle tue linee fattura già bene: serve allargare il gruppo.",
      "Aiuta le tue linee a trovare nuovi clienti e nuovi partner: è il numero di persone che fa la differenza adesso."],
    lui:["Gli mancano {manca} VP di gruppo; nelle sue linee chi c'è fattura già bene.", "Il lavoro è l'espansione: aiutarlo ad allargare le sue linee."] },
  "gruppo.fatturato":{
    io:["Ti mancano {manca} VP di gruppo, e nel tuo gruppo ci sono tante persone a 0 o sotto 50 VP.",
      "La strada più breve è il fatturato di chi c'è già: aiuta ognuno a fare il suo ordine e a trovare i primi clienti. Il VP medio di chi fattura ti dice quanto vale una persona attiva in più.",
      "{vicine} tra 50 e 99 VP: con un cliente in più si arriva a 100. Partirei da lì."],
    lui:["Gli mancano {manca} VP di gruppo; nel suo gruppo tante persone sono a 0 o sotto 50 VP.", "Il lavoro è sul fatturato di chi c'è: ordine personale e clienti delle persone.",
      "{vicine} tra 50 e 99 VP: è da lì che conviene partire."] },
  /* da Argento a Platino: i mesi al 21% (testi approvati da Stefano, tavola "Da Argento a Platino" v2) */
  report_mancanti:{
    io:["Prima di tutto importa {report_di}: finché manca, quei mesi non si contano e potresti essere più avanti di quanto vedi."] },
  mese_ok:{
    io:["Questo mese sei al 21%: con questo mese arrivi a {mesi} su {servono} per {tappa}.",
      "Il lavoro che ti ha portato qui (clienti, ordini, linee che crescono) va ripetuto ogni mese: è la costanza che fa Platino."],
    lui:["Questo mese è al 21%: con questo arriva a {mesi} su {servono} per {tappa}.", "È il momento di riconoscerglielo e di aiutarlo a tenere il ritmo il mese prossimo."] },
  fila:{
    io:["Hai {mesi} mesi da Argento, ma non ancora 3 di fila: per Platino ne servono 3 consecutivi al 21%. {fila_testo}"],
    lui:["Ha {mesi} mesi da Argento ma non ancora 3 di fila. {fila_testo}", "Aiutalo a pianificare i prossimi mesi insieme, mese per mese."] },
  linea_21:{
    io:["La linea di {nome_linea} è al 21%: con una linea al 21% per il tuo mese da Argento servono almeno 4.000 VP di gruppo fuori da quella linea. Ne hai {rimanenti}: ne mancano {manca}.",
      "Guarda le altre linee nella tabella: la più vicina è quella da sentire per prima."],
    lui:["La linea di {nome_linea} è al 21%: gli servono almeno 4.000 VP di gruppo fuori da quella linea. Ne ha {rimanenti}, ne mancano {manca}.", "Guardate insieme le sue altre linee: la più vicina è la prima da aiutare."] },
  mese_vicino:{
    io:["Questo mese sei a {vpg} VP di gruppo: per il 21% ne mancano {manca}. Lavora con le tue linee: un ordine o un cliente in più per linea fa la differenza.",
      "{vicine} tra 50 e 99 VP: con un cliente in più si arriva a 100. Partirei da lì."],
    lui:["Questo mese è a {vpg} VP di gruppo: per il 21% ne mancano {manca}.", "Lavorate insieme con le sue linee: basta poco per linea.",
      "{vicine} tra 50 e 99 VP: è da lì che conviene partire."] },
  linea_verso_21:{
    io:["La linea di {nome_linea} è a {vpg_linea} VP, vicina al 21%. Affiancala: aiutare {nome_linea} a diventare Argento è il traguardo più importante per lei e per tutta la sua linea.",
      "Lavora con le persone della sua linea: i loro clienti e i loro ordini sono i passi che la portano al 21%."],
    lui:["La linea di {nome_linea} è a {vpg_linea} VP, vicina al 21%: al 21% diventa la sua prima linea Argento."] },
  "mese_lontano.persone":{
    io:["Ti mancano {manca} VP di gruppo per il 21%. Chi c'è nelle tue linee fattura già bene: servono persone nuove.",
      "Aiuta i tuoi frontali ad allargare la loro linea, con nuovi clienti e nuovi partner: è il numero di persone che porta ai 10.000."],
    lui:["Gli mancano {manca} VP di gruppo per il 21%; nelle sue linee chi c'è fattura già bene.", "Il lavoro è l'espansione: aiutarlo ad allargare le sue linee."] },
  "mese_lontano.fatturato":{
    io:["Ti mancano {manca} VP di gruppo per il 21%, e nelle tue linee tante persone sono a 0 o sotto 50 VP.",
      "La strada più breve è il fatturato di chi c'è già: il loro ordine personale e i loro primi clienti.",
      "{vicine} tra 50 e 99 VP: con un cliente in più si arriva a 100. Partirei da lì."],
    lui:["Gli mancano {manca} VP di gruppo per il 21%; nel suo gruppo tante persone sono a 0 o sotto 50 VP.", "Il lavoro è sul fatturato di chi c'è: ordine personale e clienti delle persone.",
      "{vicine} tra 50 e 99 VP: è da lì che conviene partire."] },
  pronto:{
    io:["Questo mese i numeri della tappa ci sono tutti. Tienili fino a fine mese: la qualifica conta i numeri di chiusura.",
      "Intanto guarda la tappa dopo, nel percorso qui sopra: ti dice cosa servirà."],
    lui:["Questo mese ha tutti i numeri della tappa.", "È il momento di riconoscerglielo e di guardare insieme la tappa dopo."] }
};
/* i paragrafi con un dato che manca (per esempio nessuna persona tra 50 e 99) non si mostrano */
function riempi(s, dati){
  let manca = false;
  const out = s.replace(/\{(\w+)\}/g, (x, k) => { if(dati[k] == null || dati[k] === "") { manca = true; return ""; } return dati[k]; });
  return manca ? "" : out;
}
/* le linee frontali di una persona: dal report Amway se c'è, altrimenti dai suoi frontali nell'app */
function lineeDi(pid, r){
  return r && r.da_report ? lineeReport(r)
    : st.riep.filter(x => x.sponsor_id === pid).map(x => ({ id:x.partner_id, nome:nomeDi(x.partner_id), vp:Number(x.vp_gruppo) || 0 }))
      .sort((a, b) => b.vp - a.vp);
}
/* { personali, gruppo, linee } del mese in corso: per me dal vivo, per gli altri dal riepilogo */
function numeriDi(pid){
  if(pid === st.profilo.id) return numeriMese(meseDi(oggi()));
  const r = rigaDi(st.riep, pid);
  if(!r) return null;
  return { personali:Number(r.vp_personali) || 0, gruppo:Number(r.vp_gruppo) || 0, linee:lineeDi(pid, r) };
}
/* una linea vista persona per persona: chi la apre e tutto il suo gruppo nella mia struttura (VP personali del mese) */
function analisiLinea(l, vpLinea){
  const out = { id:l.id, nome:l.nome, vp:l.vp, manca:Math.max(0, vpLinea - l.vp), persone:null };
  if(!l.id || !st.struttura.some(p => p.id === l.id)) return out;
  const vp = [l.id].concat(alberoSotto(l.id, 0).map(x => x.p.id)).map(id => Number((rigaDi(st.riep, id) || {}).vp_personali) || 0);
  const fatt = vp.filter(v => v > 0);
  return Object.assign(out, { persone:vp.length, zero:vp.length - fatt.length,
    fasce:[vp.filter(v => v > 0 && v < 50).length, vp.filter(v => v >= 50 && v < 100).length,
           vp.filter(v => v >= 100 && v < 200).length, vp.filter(v => v >= 200).length],
    media:fatt.length ? Math.round(totale(fatt) / fatt.length) : null });
}
function totale(n){ return n.reduce((t, x) => t + x, 0); }
/* "mancano persone" o "fatturato basso" nelle linee indicate */
function tipoLinee(linee){
  const conPersone = linee.filter(l => l.persone != null);
  const tot = totale(conPersone.map(l => l.persone));
  const attive = totale(conPersone.map(l => l.fasce[2] + l.fasce[3]));
  const vicine = totale(conPersone.map(l => l.fasce[1]));
  return { tipo: !tot || attive / tot >= ATTIVE_MIN ? "persone" : "fatturato", vicine };
}
/* la tappa da guardare: la prima dal Path to Bronze in su non ancora chiusa (qualifica dichiarata o mesi chiusi) */
function tappaDaGuardare(pid){
  const S = st.stages, p = st.struttura.find(x => x.id === pid) || (pid === st.profilo.id ? st.profilo : {});
  let chiusa = ordineDi(p.qualifica_iniziale);
  if(pid === st.profilo.id) for(const r of st.storico) chiusa = Math.max(chiusa, ordineDi(r.qualifica));
  return S.find(s => !TAPPE_DI_PERCORSO.includes(s.chiave) && !oltreArgento(s) && s.ordine > chiusa) || null;
}
/* { chiave, tappa, dati, sintesi, linee, vpLinea } oppure null (percorso finito o numeri non disponibili) */
function situazione(pid){
  const io = pid === st.profilo.id;
  if(io){
    const a = percorso().attuale;
    if(!a) return null;
    if(oltreArgento(a)) return situazioneArgento(pid, a, st.mesiReport);
    if(a.chiave === "primo_ordine"){
      const f = finestraPrimoOrdine(a), vp = f ? f.vp : vpMese(meseDi(oggi()));
      return { chiave:"primo_ordine", tappa:a, linee:[], dati:{ manca:num(Math.max(0, a.vp_personali - vp)), entro:f ? dataIt(f.fine) : "fine mese" },
        sintesi:`${num(vp)} VP personali su ${num(a.vp_personali)}` };
    }
    if(a.chiave === "primi_clienti"){
      const c = clientiTotali(), m = Math.max(0, (a.clienti || 0) - c);
      return { chiave:"primi_clienti", tappa:a, linee:[], dati:{ mancano:m === 1 ? "manca" : "mancano", manca_clienti:plur(m, "cliente", "clienti") },
        sintesi:`${num(Math.min(c, a.clienti))} clienti su ${a.clienti}` };
    }
  }
  if(!io){
    /* nella scheda: chi è tra Argento e Platino (dichiarato o con un mese al 21% nei miei report) */
    const p = st.struttura.find(x => x.id === pid) || {}, righe = st.mesiScheda[pid] || [];
    if(daPlatino(p.qualifica_iniziale)) return null;
    if(ordineDi(p.qualifica_iniziale) >= ordineDi("argento") || righe.some(daArgento)){
      const x = mesiArgento(righe), t = st.stages.find(s => s.chiave === (x.mesi >= MESI_ARGENTO.oro || p.qualifica_iniziale === "oro" ? "platino" : "oro"));
      return t ? situazioneArgento(pid, t, righe) : null;
    }
  }
  const t = tappaDaGuardare(pid), n = numeriDi(pid);
  if(!t || !n) return null;
  const vpLinea = Number(t.vp_linea) || soglia();
  const linee = n.linee.map(l => analisiLinea(l, vpLinea));
  const manc = mancanze(t, n);
  const dati = { tappa:t.nome, linee:t.linee, vp_linea:num(vpLinea), vp_personali:num(t.vp_personali) };
  const s = { tappa:t, linee, vpLinea, personali:n.personali, dati,
    sintesi:manc.length ? manc.join(" · ") : "tutti i numeri del mese ci sono" };
  const okSoglia = n.linee.filter(l => l.vp >= soglia()).length, okLinea = n.linee.filter(l => l.vp >= vpLinea).length;
  if(!n.personali) s.chiave = "fermo";
  else if(Number(t.vp_personali) > n.personali){ s.chiave = "personali"; dati.manca = num(t.vp_personali - n.personali); }
  else if(t.linee && okSoglia < t.linee){
    const m = t.linee - okLinea;
    s.chiave = n.linee.some(l => l.vp > 0) ? "linee_crescere" : "linee_zero";
    Object.assign(dati, { mancano:m === 1 ? "manca" : "mancano", manca_linee:plur(m, "linea", "linee") });
  }
  else if(t.linee && okLinea < t.linee){
    const k = tipoLinee(linee.filter(l => l.manca > 0));
    s.chiave = "linea_vp." + k.tipo; dati.vicine = k.vicine ? plur(k.vicine, "persona è", "persone sono") : "";
  }
  else if(t.vp_gruppo && n.gruppo < t.vp_gruppo){
    const k = tipoLinee(linee);
    s.chiave = "gruppo." + k.tipo; dati.manca = num(t.vp_gruppo - n.gruppo); dati.vicine = k.vicine ? plur(k.vicine, "persona è", "persone sono") : "";
  }
  else s.chiave = "pronto";
  return s;
}

/* Foundation e Builder: dal primo mese qualificato, massimo 12 pagamenti entro 18 mesi.
   Conta i pagamenti dichiarati all'ingresso più i mesi chiusi qualificati in quel programma. */
function pagamenti(t){
  const p = st.profilo;
  if(!t || !t.pagamenti_max) return "";
  const famiglia = t.chiave.split("_")[0];                    // foundation | builder
  const qualificati = st.storico.filter(r => String(r.qualifica || "").startsWith(famiglia)).map(r => meseDi(r.mese));
  const dichiarato = String(p.qualifica_iniziale || "").startsWith(famiglia) && p.qualifica_iniziale_mese;
  const inizio = dichiarato ? meseDi(p.qualifica_iniziale_mese) : qualificati[0];
  if(!inizio) return "";
  const finestra = t.mesi_finestra || 18;
  const contati = qualificati.filter(m => (dichiarato ? m > inizio : m >= inizio) && mesiTra(inizio, m) < finestra).length;
  const fatti = Math.min(t.pagamenti_max, (dichiarato ? Number(p.pagamenti_iniziali) || 0 : 0) + contati);
  const restano = Math.max(0, finestra - mesiTra(inizio, meseDi(oggi())));
  return `Pagamenti ${fatti} di ${t.pagamenti_max}, restano ${restano} mesi su ${finestra}`;
}

function notaGuadagni(){
  return `Fonte: ${esc(cfg("fonte_guadagni") || "Simulatore di reddito ufficiale Amway")}. ${esc(cfg("avviso_guadagni") || "Cifre indicative, non garantite.")}`;
}

/* ---- 7. Settimana e mese ---- */
function settimana(){ return lunedi(oggi()); }
function primoDelMese(){ return meseDi(oggi()) + "-01"; }
function nellaSettimana(a){ return a.data >= settimana() && a.data <= piuGiorni(settimana(), 6); }
function fattoSettimana(tipo){ return somma(st.att.filter(a => a.tipo === tipo && nellaSettimana(a)), "quantita"); }
function proposta(){ return Object.assign({}, PROPOSTA_BASE, cfg("obiettivi_proposti") || {}); }
/* VP del mese proposti: quelli della proposta, o di più se la tappa attuale ne chiede di più */
function vpProposti(){
  const { attuale } = percorso();
  return Math.max(Number(proposta().vp_mese) || 0, attuale ? Number(attuale.vp_personali) || 0 : 0);
}

/* ---- 8. Caricamento ---- */
async function caricaTutto(){
  const p = st.profilo;
  const dal = [settimana(), primoDelMese()].sort()[0];
  const [stages, settings, att, goals, mgoals] = await Promise.all([
    api.stages(), api.settings(), api.activities(p.id, dal), api.lastGoal(p.id, settimana()), api.lastMonthGoal(p.id, primoDelMese())
  ]);
  st.stages = stages || [];
  st.settings = {};
  for(const r of settings || []) st.settings[r.chiave] = r.valore;
  st.att = att || [];
  try{ await caricaStruttura(); }catch(e){ st.struttura = []; }
  try{ st.obiettivo = await api.obiettivo(p.id) || null; }catch(e){ st.obiettivo = null; }
  try{ st.obiettiviGruppo = new Map((await api.obiettiviGruppo2() || []).map(o => [o.partner_id, o])); }catch(e){}
  await caricaNumeri();
  await caricaPersone();
  await caricaInviti();
  await caricaClienti();
  await caricaListino();
  await caricaOrdiniMiei();
  await caricaGuida();

  /* nuova settimana / nuovo mese: si riparte dall'ultimo obiettivo scelto */
  const g = (goals || [])[0];
  if(g){
    st.goal = { obiettivo_contatti:g.obiettivo_contatti, obiettivo_piani:g.obiettivo_piani, salvato:true };
    if(g.settimana !== settimana()) api.saveGoal(Object.assign({ partner_id:p.id, settimana:settimana() }, obiettiviSett())).catch(() => {});
  } else {
    const pr = proposta();
    st.goal = { obiettivo_contatti:pr.contatti, obiettivo_piani:pr.piani, salvato:false };
  }
  const mg = (mgoals || [])[0];
  if(mg){
    st.goalMese = { obiettivo_vp:Number(mg.obiettivo_vp), salvato:true };
    if(mg.mese !== primoDelMese()) api.saveMonthGoal({ partner_id:p.id, mese:primoDelMese(), obiettivo_vp:mg.obiettivo_vp }).catch(() => {});
  } else {
    st.goalMese = { obiettivo_vp:vpProposti(), salvato:false };
  }
  await preparaOggi();   // il Seguimi fissa le azioni di oggi quando ci sono gli obiettivi
}
function obiettiviSett(){ return { obiettivo_contatti:st.goal.obiettivo_contatti, obiettivo_piani:st.goal.obiettivo_piani }; }

/* Numeri del gruppo, storico e soglie: se qualcosa non risponde l'app va avanti con i numeri personali. */
async function caricaNumeri(){
  const pid = st.profilo.id;
  const [riep, prec, storico, livelli] = await Promise.all([
    api.riepilogo(primoDelMese()).catch(() => []),
    api.riepilogo(mesePrecedente() + "-01").catch(() => []),  // serve anche al confronto nella scheda partner
    api.storico(pid).catch(() => []),
    api.livelli().catch(() => [])
  ]);
  st.riep = riep || []; st.riepPrec = prec || []; st.storico = storico || []; st.livelli = livelli || [];
  try{ st.mesiReport = await api.mesiReport(pid) || []; }catch(e){ st.mesiReport = []; }
  try{ st.mioReport = new Map((await api.mioReport(pid, mesePrecedente() + "-01") || []).map(r => [meseDi(r.mese), r])); }
  catch(e){ st.mioReport = new Map(); }
  st.mesiLinee = new Map();
  if(daPlatino(st.profilo.qualifica_iniziale)){
    const frontali = lineeDi(pid, rigaDi(st.riep, pid)).filter(l => l.id && l.id !== pid && st.struttura.some(p => p.id === l.id));
    st.mesiLinee = new Map(await Promise.all(frontali.map(l => api.mesiReport(l.id)
      .then(righe => [l.id, { nome:l.nome, righe:righe || [] }]).catch(() => [l.id, { nome:l.nome, righe:[] }]))));
  }
  const dal = [inizio4(), mesePrecedente() + "-01"].sort()[0];  // 4 settimane e tutto il mese prima
  const [att, goals, mgoals] = await Promise.all([
    api.attivitaGruppo(dal).catch(() => []),
    api.obiettiviGruppo(lunedi(piuGiorni(dal, -7))).catch(() => []),
    api.obiettiviMeseGruppo(meseDi(piuGiorni(dal, -31)) + "-01").catch(() => [])
  ]);
  st.gruppo4 = { att:att || [], goals:goals || [], mgoals:mgoals || [] };
}

async function aggiornaAttivita(){
  if(st.fase !== "home" || !st.profilo) return;
  try{
    st.att = await api.activities(st.profilo.id, [settimana(), primoDelMese()].sort()[0]) || [];
    await caricaNumeri();
    render();
  }catch(e){}
}

async function sessione(){
  const s = await api.session();
  if(s) return s;
  await api.signInAnon(await controlloSicurezza());
  return api.session();
}

/* Captcha Cloudflare Turnstile: solo quando un telefono entra la prima volta (nuovo accesso anonimo).
   Così nessun programma può creare migliaia di accessi finti. Supabase controlla il gettone. */
const TURNSTILE = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let turnstilePronto = null;
function caricaTurnstile(){
  if(window.turnstile) return Promise.resolve(window.turnstile);
  if(!turnstilePronto) turnstilePronto = new Promise((ok, ko) => {
    const s = document.createElement("script");
    s.src = TURNSTILE; s.async = true;
    s.onload = () => window.turnstile ? ok(window.turnstile) : ko(new Error("captcha_non_caricato"));
    s.onerror = () => { turnstilePronto = null; ko(new Error("captcha_non_caricato")); };
    document.head.appendChild(s);
  });
  return turnstilePronto;
}
async function controlloSicurezza(){
  if(!CFG.turnstileSiteKey) return null;
  const ts = await caricaTurnstile();
  return new Promise((ok, ko) => {
    const velo = document.createElement("div");
    velo.className = "captcha";
    velo.innerHTML = '<div class="captcha-box"><b>Un attimo</b><p>Controllo di sicurezza, solo al primo ingresso.</p><div class="captcha-widget"></div></div>';
    document.body.appendChild(velo);
    const fine = (f, v) => { velo.remove(); f(v); };
    ts.render(velo.querySelector(".captcha-widget"), {
      sitekey: CFG.turnstileSiteKey, language: "it", action: "ingresso",
      callback: t => fine(ok, t),
      "error-callback": () => fine(ko, new Error("captcha_non_riuscito")),
      "expired-callback": () => fine(ko, new Error("captcha_scaduto"))
    });
  });
}

async function vaiHome(profilo){
  st.profilo = profilo;
  salvaLocale(CHIAVE_INVITO, null); st.invito = null; st.invitoRiserva = null;
  await caricaTutto();
  /* chi è stato aggiunto a mano, la prima volta che entra, legge e accetta la privacy */
  st.fase = profilo.privacy_accettata_il ? "home" : "privacy_primo";
  if(st.fase === "home") setTimeout(riconosciPlatino, 0);
  if(st.fase === "home") statoNotifiche().then(() => { render(); aggiornaPreviste(); });
  /* la scorciatoia sull'icona (pressione lunga): «Importa da Amway» */
  if(st.fase === "home" && /[?&]importa=1/.test(location.search)){
    st.sheet = "importa-amway";
    try{ history.replaceState(null, "", location.pathname + location.hash); }catch(e){}
  }
}

async function caricaStruttura(){
  st.struttura = await api.struttura() || [];
  try{ st.accessi = new Map((await api.accessiStruttura() || []).map(r => [r.id, r])); }catch(e){ st.accessi = new Map(); }
  try{ st.preferiti = new Set((await api.preferiti() || []).map(r => r.preferito_id)); }catch(e){}
  try{ st.nascosti = new Set((await api.nascosti() || []).map(r => r.nascosto_id)); }catch(e){}
  try{ st.prossime = new Map((await api.prossime() || []).map(r => [r.partner_id, r.prossima_qualifica])); }catch(e){ st.prossime = new Map(); }
  try{ st.inAttesa = await api.inAttesa() || []; }catch(e){ st.inAttesa = []; }
}

async function entraConChiave(k){
  st.fase = "avvio"; render();
  try{
    await sessione();
    const p = await api.entra(k);
    ricordaChiave(k);
    await vaiHome(p);
    rispostaInAttesa();
  }catch(e){
    const m = messaggio(e);
    if(m === MESSAGGI_ERRORE.chiave_non_valida){ st.fase = "chiave_errata"; }
    else { st.errore = m; st.fase = "errore"; }
  }
  render();
}

async function apriInvito(codice){
  st.invito = codice; salvaLocale(CHIAVE_INVITO, codice);
  st.sponsorNome = "";
  api.sponsorName(codice).then(n => { st.sponsorNome = n || ""; render(); }).catch(() => {});
  if(!st.stages.length){
    try{ await sessione(); st.stages = await api.stages() || []; }catch(e){}
  }
  st.fase = "ingresso";
}

async function avvio(){
  /* il link del Target per il contatto: le otto domande, senza accesso */
  if(/^#t&/.test(location.hash)){ avviaContatto(location.hash); return; }
  /* le risposte del Target rimandate dal contatto: si leggono appena si è dentro */
  const r = location.hash.match(/^#r=(CL21-[0-9A-Za-z-]+)/);
  if(r){ salvaLocale(CHIAVE_RISPOSTA_T, r[1]); history.replaceState(null, "", location.pathname + location.search); }
  if(!api){ st.fase = "config"; render(); return; }
  const dalLink = leggiLink(location.hash.replace(/^#/, ""));
  /* la chiave non resta nella barra degli indirizzi: non si vede e non finisce negli screenshot */
  if(location.hash) history.replaceState(null, "", location.pathname + location.search);
  st.chiave = leggiLocale(CHIAVE_LOCALE);

  try{
    if(dalLink && dalLink.chiave){ await entraConChiave(dalLink.chiave); return; }
    const s = await api.session();
    if(s){
      const p = await api.collega();
      if(p && p.id){ await vaiHome(p); render(); rispostaInAttesa(); return; }
      /* tolto dalla struttura o bloccato da un admin: il telefono non entra più */
      if(await accessoNegato()) return;
    }
    const invito = (dalLink && dalLink.invito) || leggiLocale(CHIAVE_INVITO);
    if(invito) await apriInvito(invito);
    else st.fase = "benvenuto";
  }catch(e){
    st.errore = messaggio(e); st.fase = "errore";
  }
  render();
}

/* ---- 9. Viste ---- */
/* #app si riscrive solo se è cambiato: così aprire un foglio (es. la privacy) non cancella
   quello che si sta scrivendo in un modulo. */
let ultimoApp = "";
/* Ricerca nella struttura: si filtra sulla pagina senza ridisegnarla, così la tastiera resta aperta.
   Restano visibili le persone trovate e la loro linea fino a te. */
function senzaAccenti(s){ return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }
function applicaRicerca(){
  const ul = document.querySelector(".albero.struttura"), esito = document.getElementById("cerca-esito");
  if(!ul) return;
  const q = senzaAccenti(st.cerca), lis = [...ul.querySelectorAll("li")];
  ul.classList.toggle("in-ricerca", !!q);
  if(!q){ lis.forEach(li => li.classList.remove("fuori", "trovato")); if(esito) esito.textContent = ""; st.espansi.clear(); etichettePiega(false); return; }
  const trovati = lis.filter(li => li.dataset.nome.includes(q)), visibili = new Set();
  for(const li of trovati){ visibili.add(li.dataset.id); li.dataset.path.split(" ").filter(Boolean).forEach(id => visibili.add(id)); }
  /* ▸ N su una persona visibile apre i suoi frontali; ognuno ha la sua freccia per scendere ancora */
  for(const li of lis){
    const sopra = li.dataset.path.split(" ").filter(Boolean), sponsor = sopra[sopra.length - 1];
    if(sponsor && st.espansi.has(sponsor) && visibili.has(sponsor)) visibili.add(li.dataset.id);
  }
  for(const li of lis){ li.classList.toggle("fuori", !visibili.has(li.dataset.id)); li.classList.toggle("trovato", trovati.includes(li)); }
  etichettePiega(true);
  if(esito) esito.textContent = !trovati.length ? "Nessuno con questo nome nel tuo gruppo."
    : (trovati.length === 1 ? "1 persona trovata" : `${trovati.length} persone trovate`) + ", con la linea fino a te.";
}
/* L'etichetta ▾ N / ▸ N: fuori dalla ricerca segue i gruppi richiusi, durante la ricerca i gruppi aperti */
function etichettePiega(inRicerca){
  document.querySelectorAll(".albero.struttura .piega").forEach(b => {
    const aperto = inRicerca ? st.espansi.has(b.dataset.id) : !st.chiusi.has(b.dataset.id);
    b.textContent = `${aperto ? "▾" : "▸"} ${b.dataset.quanti}`;
    b.setAttribute("aria-expanded", aperto);
  });
}
function render(){
  const app = document.getElementById("app");
  const viste = { avvio:vAvvio, config:vConfig, benvenuto:vBenvenuto, chiave_errata:vChiaveErrata,
                  ingresso:vIngresso, privacy_primo:vPrivacyPrimo, obiettivo_primo:vObiettivoPrimo, home:vHome, errore:vErrore,
                  contatto:vContatto, bloccato:vAccessoNegato, tolto:vAccessoNegato };
  const html = (viste[st.fase] || vAvvio)();
  const prima = fotoMovimento();
  prima.pagina = cambioPagina() ? fotoPagina(app) : null;
  if(html !== ultimoApp){ app.innerHTML = html; ultimoApp = html; }
  const conAzioni = st.fase === "home" && st.vista === "io";
  document.body.classList.toggle("con-azioni", conAzioni);
  document.getElementById("azioni").innerHTML = conAzioni ? vAzioni() : "";
  const foglio = document.getElementById("sheet");
  if(!st.sheet) chiudiFoglioPiano(foglio);
  foglio.innerHTML = st.sheet ? `<div class="sheet" data-act="chiudi-fuori"><div class="sheet-box" role="dialog" aria-modal="true">${vSheet()}</div></div>` : "";
  applicaRicerca();
  muoviDopo(prima);
  aggiornaPreviste();
}

function vAvvio(){ return `<div class="centro"><p class="muted">Caricamento…</p></div>`; }
function vConfig(){
  return `<div class="centro"><h1>Growup Team</h1>
    <p class="muted">L'app non è ancora collegata al database. Manca l'indirizzo o la chiave pubblica di Supabase in <code>config.js</code> (vedi LEGGIMI.md).</p></div>`;
}
function vErrore(){
  return `<div class="centro"><h1>Ops</h1><p class="muted">${esc(st.errore)}</p>
    <div class="row" style="margin-top:12px"><button class="btn primary" data-act="ricarica">Riprova</button></div></div>`;
}

function marchio(){ return `<div class="eyebrow">A&amp;S · Growup Team</div>`; }

function formIncolla(){
  return `<form data-form="incolla" class="card" novalidate>
    ${navigator.clipboard && navigator.clipboard.readText ? `<button type="button" class="btn primary wide" data-act="incolla-appunti">Incolla il link personale</button>
    <p class="small" style="margin:8px 0 4px">Prima copia il link dal messaggio che ti sei mandato su WhatsApp o Telegram
      (tieni premuto sul messaggio → Copia). Oppure incollalo qui:</p>` : ""}
    <label class="field" style="margin:0"><span>Incolla qui il tuo link personale</span>
      <input name="link" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://…/growup-team/#chiave=…"></label>
    <button class="btn wide${navigator.clipboard && navigator.clipboard.readText ? "" : " primary"}" style="margin-top:12px">Entra</button>
  </form>`;
}

function vBenvenuto(){
  return `<div class="centro">
    ${marchio()}
    <h1 style="margin-top:6px">Entra in Growup</h1>
    ${installata() ? `<p class="muted">Growup è installata: la prima volta entra con il tuo <b>link personale</b>, quello che ti sei
      salvato su WhatsApp o Telegram. Copialo dal messaggio e tocca «Incolla il link personale». Poi resti dentro.</p>` : `<p class="muted">Per entrare apri il tuo <b>link personale</b>: quello che ti sei salvato su WhatsApp o Telegram
      quando sei entrato la prima volta. Toccalo da lì, oppure copialo e incollalo qui sotto.</p>`}
    ${formIncolla()}
    ${st.invitoRiserva ? `<button class="btn ghost wide" data-act="torna-invito">‹ Torna all'invito${st.sponsorNome ? " di " + esc(st.sponsorNome) : ""}</button>`
      : `<p class="small"><b>Sei nuovo?</b> Chiedi al tuo sponsor il suo link d'invito.</p>`}
    <p class="small"><b>Hai perso il link?</b> Chiedi a Stefano e Alessia: te ne mandano uno nuovo.</p>
  </div>`;
}

async function accessoNegato(){
  let stato = null;
  try{ stato = await api.statoAccesso(); }catch(e){}
  if(stato !== "bloccato" && stato !== "tolto") return false;
  st.fase = stato; st.sheet = null; st.profilo = null; render();
  return true;
}
function vAccessoNegato(){
  const bloccato = st.fase === "bloccato";
  return `<div class="centro">
    ${marchio()}
    <h1 style="margin-top:6px">${bloccato ? "Accesso sospeso" : "Accesso tolto"}</h1>
    <p class="muted">${bloccato ? "Il tuo accesso a Growup è sospeso. Per sapere di più parla con Stefano e Alessia."
      : "Questo accesso a Growup è stato tolto. Parla con chi ti ha invitato."}</p>
  </div>`;
}
/* "Da confermare" (il suo codice Amway non è ancora comparso in un report importato) e "Bloccato" */
function accessoDi(p){ return p && p.stato !== "gestito" && st.accessi ? st.accessi.get(p.id) : null; }
function daConfermare(p){ const a = accessoDi(p); return !!a && !a.confermato_il && !a.is_admin && p.id !== st.profilo.id; }
function bloccato(p){ const a = accessoDi(p); return !!a && !!a.bloccato_il; }
function etichetteAccesso(p){
  return `${bloccato(p) ? `<span class="pill r" title="App bloccata da un admin">Bloccato</span>` : ""}${daConfermare(p) ? `<span class="pill g" title="Il suo codice Amway non è ancora comparso in un report importato">Da confermare</span>` : ""}`;
}
function vChiaveErrata(){
  return `<div class="centro">
    <h1>Link non più valido</h1>
    <p class="muted">Questo link personale non funziona: forse è stato sostituito con uno nuovo.
      Cerca il più recente su WhatsApp o Telegram, oppure chiedi a Stefano e Alessia di mandartene uno nuovo.</p>
    ${formIncolla()}
  </div>`;
}

/* "La tua qualifica oggi": Inizio, i pin (3%…21%) e le qualifiche Bronze/Argento.
   Primo ordine e primi clienti sono tappe del percorso, non qualifiche: non si dichiarano. */
function campiQualifica(obbligoData, scelta){
  scelta = scelta || {};
  const sel = v => v === (scelta.valore || "") ? " selected" : "";
  const qual = st.stages.filter(s => !TAPPE_DI_PERCORSO.includes(s.chiave))
    .map(s => `<option value="${esc(s.chiave)}"${sel(s.chiave)}>${esc(s.nome)}</option>`).join("");
  const pin = PIN.map(n => `<option value="pin:${n}"${sel("pin:" + n)}>${n}%</option>`).join("");
  const tappa = st.stages.find(s => s.chiave === scelta.valore);
  return `
      <label class="field"><span>La tua qualifica oggi</span>
        <select name="qualifica"><option value=""${sel("")}>Inizio (nessuna qualifica)</option>
          <optgroup label="Percentuale raggiunta">${pin}</optgroup>
          <optgroup label="Qualifiche">${qual}</optgroup></select></label>
      <div data-mostra="prossima" ${daPlatino(scelta.valore) ? "" : "hidden"}>
        <label class="field"><span>Prossima qualifica che vuoi ottenere</span>
          <select name="prossima">${opzioniProssima(scelta.valore, scelta.prossima)}</select></label>
      </div>
      <div data-mostra="mese" ${tappa && (tappa.pagamenti_max || conMeseArgento(tappa.chiave)) ? "" : "hidden"}>
        <label class="field"><span data-etichetta-mese>${etichettaMese(scelta.valore)}</span>
          <input type="month" name="mese" max="${meseDi(oggi())}" value="${esc(scelta.mese || "")}"></label>
      </div>
      <div data-mostra="pagamenti" ${tappa && tappa.pagamenti_max ? "" : "hidden"}>
        <label class="field"><span>Pagamenti già ricevuti (su 12)</span>
          <input type="number" name="pagamenti" min="0" max="12" inputmode="numeric" value="" placeholder="${Number(scelta.pagamenti) || 0}" data-vuoto></label>
      </div>
      ${scelta.senzaData ? "" : `<label class="field"><span>Data di iscrizione ad Amway <i data-obbl>${obbligoData ? "(obbligatoria per chi inizia)" : "(facoltativa)"}</i></span>
        <input type="date" name="data" max="${oggi()}"></label>`}
      ${obbligoData ? `<p class="nota" style="margin-top:6px">Serve al conto alla rovescia dei 30 giorni per il primo ordine.</p>` : ""}`;
}
/* Argento e Oro: serve il mese della prima qualifica Argento, da cui si importano i report per contare i mesi */
function conMeseArgento(chiave){ return chiave === "argento" || chiave === "oro"; }
function etichettaMese(chiave){ return conMeseArgento(chiave) ? "Mese della prima qualifica Argento" : "Mese della prima qualifica"; }
/* le qualifiche sopra quella dichiarata (da Platino in su) */
function opzioniProssima(qualifica, scelta){
  const o = ordineDi(qualifica);
  return `<option value="">Non ancora scelta</option>` + st.stages.filter(s => o && s.ordine > o)
    .map(s => `<option value="${esc(s.chiave)}"${s.chiave === scelta ? " selected" : ""}>${esc(s.nome)}</option>`).join("");
}
/* Codice Amway Partner (il numero IBO): solo cifre. Serve ad abbinare le persone del report Amway. */
function campoCodice(obbligatorio, valore){
  return `<label class="field"><span>Codice Amway Partner${obbligatorio ? "" : ` <i>(facoltativo)</i>`}</span>
        <input name="codice_amway" type="text" inputmode="numeric" autocomplete="off" maxlength="14" placeholder="es. 1234567" value="${esc(valore || "")}"></label>`;
}
function soloCifre(v){ return String(v || "").replace(/\D/g, ""); }
function codiceValido(c){ return /^\d{4,12}$/.test(c); }
function valoreQualifica(p){ return p.qualifica_iniziale || (p.percentuale_iniziale ? "pin:" + p.percentuale_iniziale : ""); }
function testoPartenza(p){
  const t = st.stages.find(x => x.chiave === p.qualifica_iniziale);
  return [t ? t.nome : "", p.percentuale_iniziale ? p.percentuale_iniziale + "%" : ""].filter(Boolean).join(" · ") || "Inizio";
}
/* Dal modulo: { qualifica, percentuale, tappa, mese, pagamenti, data } */
function leggiQualifica(f){
  const v = f.qualifica.value || "";
  const percentuale = v.startsWith("pin:") ? Number(v.slice(4)) : null;
  const qualifica = v && !percentuale ? v : null;
  const t = st.stages.find(s => s.chiave === qualifica);
  const conPagamenti = !!(t && t.pagamenti_max), conMese = conPagamenti || conMeseArgento(qualifica);
  const prossima = daPlatino(qualifica) && f.prossima && f.prossima.value && ordineDi(f.prossima.value) > ordineDi(qualifica) ? f.prossima.value : null;
  return { qualifica, percentuale, tappa:t, prossima, data: f.data ? f.data.value || null : null,
    mese: conMese && f.mese.value ? f.mese.value + "-01" : null,
    pagamenti: conPagamenti ? Math.max(0, Math.min(12, Number(f.pagamenti.value) || 0)) : 0,
    mancaMese: conMese && !f.mese.value };
}

function vIngresso(){
  return `<div>
    ${marchio()}
    <h1 style="margin-top:6px">Benvenuto in Growup</h1>
    <p class="muted">${st.sponsorNome ? `Ti ha invitato <b>${esc(st.sponsorNome)}</b>. ` : ""}Due informazioni e iniziamo: servono per partire dal punto giusto del percorso.</p>
    <form data-form="ingresso" class="card" novalidate>
      <label class="field" style="margin-top:0"><span>Nome e cognome</span>
        <input name="nome" autocomplete="name" required maxlength="80"></label>
      ${campoCodice(true)}
      <label class="field"><span>Riscrivi il codice</span>
        <input name="codice_amway2" type="text" inputmode="numeric" autocomplete="off" maxlength="14" placeholder="es. 1234567"></label>
      <p class="avviso-interno avviso-codice"><b>Controlla bene il tuo codice Amway Partner.</b> Lo trovi sul sito o nell'app
        Amway, toccando l'icona del profilo (l'omino) in alto a destra; se non lo trovi, chiedilo al tuo sponsor. L'app lo usa per metterti al posto giusto nel gruppo: se è sbagliato resti «in attesa della mappa» e i tuoi
        numeri non arrivano a chi ti segue.</p>
      ${campiQualifica(true)}
      <p class="nota">Dichiara il punto giusto: è una tua responsabilità e lo potrai correggere tu dalla pagina Io.</p>

      <label class="check"><input type="checkbox" name="privacy" required>
        <span>Ho letto l'<button type="button" class="btn link" data-act="privacy" style="min-height:0;padding:0">informativa privacy</button>
        e accetto che i miei numeri (contatti, piani, VP) siano visibili a me e alla mia upline.</span></label>

      <button class="btn primary wide" style="margin-top:16px" ${st.occupato ? "disabled" : ""}>Inizia</button>
      ${st.errore ? `<p class="errore">${esc(st.errore)}</p>` : ""}
    </form>
    <p class="small">Hai già un profilo? <button class="btn link" data-act="ho-gia">Entra con il tuo link personale</button></p>
  </div>`;
}

function testoPrivacy(){
  return `<div class="small stack" style="margin-top:10px">
      <p><b>Cosa raccogliamo.</b> Nome, data di iscrizione, qualifica e i tuoi numeri: quanti contatti,
        quanti piani, quanti VP, quanti clienti. Non serve la tua email.</p>
      <p><b>Chi li vede.</b> Tu e chi sta sopra di te nella tua organizzazione (la tua upline). Nessun altro.</p>
      <p><b>La tua lista e i tuoi clienti.</b> I nomi e i dati che scrivi nella pagina Persone (lista, Target, clienti e
        loro ordini) li vedi <b>solo tu</b>: né la tua upline né Stefano e Alessia. A chi ti segue arrivano soltanto i numeri
        (quanti in lista, piani, sì, clienti). Inserisci solo persone
        che conosci, con i dati che servono a ricontattarle; le togli quando vuoi.</p>
      <p><b>A cosa servono.</b> A pianificare la tua settimana e a farti aiutare da chi ti segue.</p>
      <p><b>Dove stanno.</b> In un database ospitato nell'Unione Europea (Supabase).</p>
      <p><b>I tuoi diritti.</b> Puoi chiedere in qualsiasi momento di vedere, correggere o cancellare il tuo
        profilo e tutti i tuoi dati: scrivi a Stefano e Alessia (A&amp;S).</p>
    </div>`;
}

function vPrivacyPrimo(){
  return `<div>
    ${marchio()}
    <h1 style="margin-top:6px">Ciao ${esc(nomeSaluto(st.profilo.nome))}</h1>
    <p class="muted">Il tuo profilo è già pronto: l'ha preparato chi ti segue. Prima di iniziare, leggi come usiamo i tuoi dati.</p>
    <form data-form="privacy-primo" class="card" novalidate>
      ${testoPrivacy()}
      <label class="check"><input type="checkbox" name="privacy" required>
        <span>Ho letto e accetto che i miei numeri siano visibili a me e alla mia upline.</span></label>
      <button class="btn primary wide" style="margin-top:16px">Inizia</button>
    </form>
  </div>`;
}

/* Due pagine, scelte dal selettore in alto a destra: "Io" e "Gruppo". */
/* La barra in alto resta fissa scorrendo: le pagine principali e, sotto, i pulsanti della sezione
   (Il mio giorno · Guida in Io; Target · Lista · Clienti in Persone). Il titolo con il nome scorre via. */
function vBarraFissa(){
  const sez = st.vista === "io" ? vSezioniIo() : st.vista === "persone" && (st.sezPersone === "target" ? !st.invitoId : !st.personaId) ? vSezioniPersone() : "";
  return `<div class="barra-fissa">${vSelettore()}${sez}</div>`;
}
function vSelettore(){
  return `<div class="schede" role="tablist" aria-label="Pagina">
    <button role="tab" aria-selected="${st.vista === "obiettivo"}" class="${st.vista === "obiettivo" ? "on" : ""}" data-act="vista-obiettivo">Obiettivo</button>
    <button role="tab" aria-selected="${st.vista === "io"}" class="${st.vista === "io" ? "on" : ""}" data-act="vista-io">Io</button>
    <button role="tab" aria-selected="${st.vista === "persone"}" class="${st.vista === "persone" ? "on" : ""}" data-act="vista-persone">Persone</button>
    <button role="tab" aria-selected="${st.vista === "gruppo" || st.vista === "scheda"}" class="${st.vista === "gruppo" || st.vista === "scheda" ? "on" : ""}" data-act="vista-gruppo">Gruppo</button>
  </div>`;
}

/* I pulsanti che vedono solo gli admin: sotto, in piccolo, "Solo Admin" (largo: per i pulsanti a tutta larghezza) */
function soloAdmin(html, largo){ return `<span class="solo-admin-box${largo ? " largo" : ""}">${html}<span class="solo-admin">Solo Admin</span></span>`; }
/* In fondo a ogni pagina: link personale, privacy, uscita (prima stavano nel menu ⋯). */
/* Copia di sicurezza (solo admin): un file con tutti i dati, da scaricare una volta al mese e tenere su Google Drive */
function vCopiaDati(){
  const ultima = leggiLocale(CHIAVE_ULTIMA_COPIA), giorni = ultima ? giorniTra(ultima, oggi()) : null;
  return `<div class="copia-dati">
    ${soloAdmin(`<button class="btn small" data-act="copia-dati">Scarica la copia dei dati</button>`)}
    <p class="nota" style="margin:6px 0 0">${ultima ? `Ultima copia da questo telefono: ${dataIt(ultima)}${giorni > 35 ? " · è passato più di un mese" : ""}.`
      : "Nessuna copia scaricata da questo telefono."} Una volta al mese, dopo la chiusura del giorno 5.</p>
  </div>`;
}
/* L'omino in alto a destra (ottimizzazione 3, come nell'app Amway): apre «Il mio profilo» */
function omino(){
  return `<button class="omino${st.vista === "profilo" ? " on" : ""}" data-act="vista-profilo" aria-label="Il mio profilo">
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg></button>`;
}
/* Il glossario (testi approvati da Stefano) */
const GLOSSARIO = [
  ["VP personali (VPP)", "I punti volume dei tuoi ordini e di quelli dei tuoi clienti nel mese."],
  ["VP di gruppo (VPG)", "I tuoi VP personali più quelli di tutte le persone sotto di te."],
  ["Linea / linea attiva", "Una persona che hai sponsorizzato tu, con tutto il suo gruppo. È attiva quando il suo gruppo fa almeno la soglia di VP del mese."],
  ["Mese da Argento", "Un mese al 21%: senza linee al 21%, con due o più linee al 21%, oppure con una linea al 21% e almeno 4.000 VP di gruppo fuori da quella linea. Altrimenti è solo «21%»."],
  ["Report mappe", "Il file CSV della tua linea che scarichi dal sito Amway: da lì l'app prende i numeri ufficiali."],
  ["Follow-up", "Risentire chi ha visto il piano, per rispondere alle sue domande e capire se vuole partire."],
  ["Anno fiscale", "Da settembre ad agosto. Oro e Platino, la prima volta, si contano sui 12 mesi che partono dal primo mese da Argento; dal secondo anno sull'anno fiscale, come le qualifiche sopra."]];
/* «Il mio profilo» (ottimizzazione 3): i dati del profilo, il link, le cose da fare una volta sola, il glossario, privacy ed
   Esci; per gli admin la sezione Admin. Prima stava in fondo a ogni pagina. */
function vProfilo(){
  const p = st.profilo, adm = p.is_admin;
  const voce = (act, testo, extra) => `<button class="voce-profilo" data-act="${act}"${extra || ""}><span class="grow">${testo}</span><span class="fr" aria-hidden="true">›</span></button>`;
  const ppNascosti = leggiLocale(chiavePrimiPassiNo()) === "1" && primiPassi().some(x => !x.fatto);
  const gloss = st.aiuti.has("glossario");
  return `<button class="btn link" data-act="profilo-indietro" style="padding:0">‹ Indietro</button>
  <div class="card profilo">
    <h2>${esc(p.nome)}</h2>
    <div class="riga-profilo"><span>Codice d'invito</span><b>${esc(p.codice_invito)}</b></div>
    <div class="riga-profilo"><span>Codice Amway Partner</span><span>${p.codice_amway ? `<b>${esc(p.codice_amway)}</b>` : "non ancora scritto"}
      ${adm ? soloAdmin(`<button class="btn link small" data-act="codice" data-id="${esc(p.id)}" style="min-height:0;padding:0 4px">Correggi</button>`) : ""}</span></div>
    <div class="riga-profilo"><span>Punto di partenza <b>${esc(testoPartenza(p))}</b></span>
      <button class="btn small ghost" data-act="partenza">Modifica</button></div>
  </div>
  <div class="card voci-profilo">
    ${vNotificheProfilo()}
    ${voce("mia-chiave", "Il mio link personale")}
    ${puoInstallare() && leggiLocale(CHIAVE_INSTALLA_NO) === "1" ? voce("installa-si", "Installa l'app") : ""}
    ${ppNascosti ? voce("primi-passi-si", "Mostra di nuovo i Primi passi") : ""}
    <button class="voce-profilo" data-act="aiuto" data-k="glossario" aria-expanded="${gloss}"><span class="grow">Glossario</span>
      <span class="fr" aria-hidden="true">${gloss ? "▴" : "▾"}</span></button>
    ${gloss ? `<dl class="glossario">${GLOSSARIO.map(([t, d]) => `<dt>${esc(t)}</dt><dd>${esc(d)}</dd>`).join("")}</dl>` : ""}
    ${voce("privacy", "Privacy")}
  </div>
  ${adm ? `<div class="card admin-profilo">
    <span class="eyebrow">Admin</span>
    ${vCopiaDati()}
    <div class="row" style="margin-top:8px;gap:6px">${soloAdmin(`<button class="btn small ghost" data-act="listino">Listino</button>`)}
      ${soloAdmin(`<button class="btn small ghost" data-act="codici-tolti">Codici Amway tolti</button>`)}</div>
  </div>` : ""}
  <p class="nota" style="text-align:center">Per cancellare il profilo e i tuoi dati scrivi a Stefano e Alessia.</p>
  <div class="row" style="justify-content:center"><button class="btn ghost" data-act="esci">Esci</button></div>`;
}

function vHome(){
  const p = st.profilo;
  const gruppo = st.vista === "gruppo" || st.vista === "scheda";
  const persone = alberoSotto(p.id, 0).length;
  if(st.vista === "persone") return `
  <div class="testata">
    <div>${marchio()}<h1>${st.invitoId ? "Target" : st.personaId ? (st.sezPersone === "clienti" ? "I miei clienti" : "La mia lista") : "Persone"}</h1></div>
    ${omino()}
  </div>
  ${vBarraFissa()}
  ${vPersone()}
  `;
  if(st.vista === "analisi") return `
  <div class="testata">
    <div>${marchio()}<h1>${st.analisiId === p.id ? "La mia analisi" : "Analisi"}</h1></div>
    ${omino()}
  </div>
  ${vBarraFissa()}
  ${vAnalisi()}
  `;
  if(st.vista === "profilo") return `
  <div class="testata">
    <div>${marchio()}<h1>Il mio profilo</h1></div>
    ${omino()}
  </div>
  ${vBarraFissa()}
  ${vProfilo()}`;
  if(st.vista === "obiettivo") return `
  <div class="testata">
    <div>${marchio()}<h1>Il mio obiettivo</h1></div>
    ${omino()}
  </div>
  ${vBarraFissa()}
  ${vObiettivo()}
  `;
  return `
  <div class="testata">
    <div>${marchio()}<h1>${st.vista === "scheda" ? "Scheda partner" : gruppo ? "Il mio gruppo" : `Ciao ${esc(nomeSaluto(p.nome))}`}</h1>
      ${st.vista === "gruppo" ? `<p class="small" style="margin:0">${persone === 1 ? "1 persona" : `${num(persone)} persone`}</p>` : ""}</div>
    ${omino()}
  </div>
  ${vBarraFissa()}
  ${st.vista === "scheda" ? vScheda() : gruppo ? `
  ${vPreferiti()}
  ${vStruttura()}
  ${vInAttesa()}
  ${vStoricoGruppo()}
  ${vInvita()}` : st.sezIo === "guida" ? vGuida() : `
  ${vDomandaNotifiche()}
  ${vPrimiPassi()}
  ${vPromemoriaImport()}
  ${st.seguimi.attivo && oggiSeguimi() ? vOggiPerTe() : `${vDaFare()}${vClientiDaSentire()}`}
  ${vMieiNumeri()}
  ${vOggi()}`}
  `;
}

function testoChiave(){ return "La mia chiave per entrare in Growup Team. È personale, non inoltrarla:"; }
function bottoniChiave(){
  return `<div class="condividi">
      <a class="btn wa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(testoChiave() + " " + linkPersonale())}">WhatsApp</a>
      <a class="btn tg" target="_blank" rel="noopener" href="https://t.me/share/url?url=${encodeURIComponent(linkPersonale())}&text=${encodeURIComponent(testoChiave())}">Telegram</a>
      <button class="btn" data-act="copia-chiave">Copia link</button>
      ${navigator.share ? `<button class="btn" data-act="condividi-chiave">Altro…</button>` : ""}
    </div>`;
}
/* ---- Installare l'app: guida per Android e iPhone ---- */
function installata(){
  try{ return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; }catch(e){ return false; }
}
let promptInstalla = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); promptInstalla = e; if(st.fase === "home") render(); });
window.addEventListener("appinstalled", () => { promptInstalla = null; salvaLocale(CHIAVE_INSTALLA_NO, "1"); if(st.fase === "home") render(); });
function puoInstallare(){ return !installata() && (suAndroid() || suIos()); }
/* Su iPhone "Aggiungi alla schermata Home" c'è solo in Safari (e in Chrome): non nei browser interni delle app
   da cui spesso si aprono i link. Quelli riconoscibili si nominano; per gli altri resta la nota in fondo. */
function browserInterno(){
  const u = navigator.userAgent;
  if(/Instagram/i.test(u)) return "Instagram";
  if(/FBAN|FBAV|FB_IAB/i.test(u)) return "Facebook";
  if(/Telegram/i.test(u)) return "Telegram";
  if(/WhatsApp/i.test(u)) return "WhatsApp";
  return "";
}
/* la guida per installare (dentro «Primi passi») */
function corpoInstalla(){
  const interno = suIos() ? browserInterno() : "", chrome = /CriOS/.test(navigator.userAgent);
  const corpo = suIos() ? `
    ${interno ? `<p class="avviso-interno">Sei dentro <b>${interno}</b>: da qui l'app non si può installare. Copia il link e apri la pagina in <b>Safari</b>.</p>` : ""}
    <ol class="passi">
      <li>Tocca <b>Copia il mio link</b> qui sotto: ti servirà tra un attimo.</li>
      ${interno ? `<li>Tocca <b>•••</b> in alto (o l'icona della bussola) e scegli <b>Apri in Safari</b>.</li>` : ""}
      <li>${chrome ? "In Chrome tocca <b>Condividi</b> (in alto, nella barra dell'indirizzo)" : "In Safari tocca <b>Condividi</b> (il quadrato con la freccia in su)"}, scorri in basso e tocca <b>Aggiungi alla schermata Home</b>.</li>
      <li>Apri Growup dalla nuova icona e tocca <b>Incolla il link personale</b>: sei dentro, una volta per sempre.</li>
    </ol>
    ${interno ? "" : `<p class="nota">Non trovi «Aggiungi alla schermata Home»? Forse hai aperto il link dentro WhatsApp o Telegram:
      tocca <b>•••</b> in alto (o la bussola) e scegli <b>Apri in Safari</b>, poi riprova.</p>`}
    <p class="nota">Su iPhone l'app sulla Home non vede quello che hai fatto in Safari: per questo la prima volta ti chiede il link.</p>
    <div class="row" style="margin-top:10px"><button class="btn primary grow" data-act="copia-chiave">Copia il mio link</button>
      <button class="btn ghost" data-act="installa-no">Non ora</button></div>`
  : `
    ${promptInstalla ? "" : `<ol class="passi">
      <li>Tocca il menu <b>⋮</b> di Chrome in alto a destra.</li>
      <li>Tocca <b>Installa app</b> (o <b>Aggiungi a schermata Home</b> → <b>Installa</b>).</li>
    </ol>`}
    <p class="nota">Si apre a schermo intero, come un'app, ed entri già con il tuo profilo.</p>
    <div class="row" style="margin-top:10px">${promptInstalla ? `<button class="btn primary grow" data-act="installa">Installa</button>` : ""}
      <button class="btn ghost${promptInstalla ? "" : " grow"}" data-act="installa-no">${promptInstalla ? "Non ora" : "Fatto"}</button></div>`;
  return `<p class="small" style="margin:0">Avrai l'icona sulla Home e l'app a schermo intero, senza la barra del browser.</p>${corpo}`;
}

/* ---- «Primi passi» (ottimizzazione 2): le cose da fare una volta sola, in un riquadro solo che sparisce a tutto fatto.
   Con la × si nasconde su questo telefono (tranne se il link personale non è ancora salvato). ---- */
const NOMI_PRIMI_PASSI = 30;
const chiavePrimiPassiNo = () => "growup-team.primi-passi-no." + st.profilo.id;
function nomiInLista(){ return (st.persone || []).filter(p => p.esito !== "cliente").length; }
function primiPassi(){
  const io = st.profilo.id, l = [];
  if(st.chiave) l.push({ k:"link", nome:"Salva il tuo link personale", fatto:leggiLocale(CHIAVE_SALVATA) === "1",
    sotto:"La tua chiave per rientrare da qualsiasi telefono o computer", corpo:() => `<p class="small" style="margin:0">Mandalo <b>a te stesso</b>:
      su WhatsApp scegli la chat con te stesso, su Telegram i «Messaggi salvati». Non inoltrarlo a nessuno.</p>
      ${bottoniChiave()}
      <button class="btn wide primary" style="margin-top:10px" data-act="chiave-salvata">Fatto, l'ho salvato</button>` });
  if(puoInstallare())
    l.push({ k:"installa", nome:"Installa l'app", fatto:leggiLocale(CHIAVE_INSTALLA_NO) === "1",
      sotto:"Un'icona sul telefono, come le altre app", corpo:corpoInstalla });
  l.push({ k:"obiettivo", nome:"Scrivi il tuo obiettivo", fatto:!!st.obiettivo, sotto:"Quanto vorresti guadagnare al mese, e per quando",
    corpo:() => `<button class="btn primary wide" data-act="obiettivo-modifica">Scrivi il tuo obiettivo</button>` });
  const n = nomiInLista();
  l.push({ k:"lista", nome:`Scrivi ${NOMI_PRIMI_PASSI} nomi nella tua Lista`, fatto:n >= NOMI_PRIMI_PASSI, sotto:`${num(Math.min(n, NOMI_PRIMI_PASSI))} / ${NOMI_PRIMI_PASSI}`,
    corpo:() => `<p class="small" style="margin:0">Senza decidere tu chi potrebbe essere interessato: parenti, amici, colleghi, vicini.</p>
      <button class="btn primary" style="margin-top:8px" data-act="guida-vai" data-dove="lista">Apri la Lista</button>` });
  if(figli(io).length) l.push({ k:"import", nome:"Importa il tuo primo report", sotto:"Il report mappe dal sito Amway",
    fatto:[...(st.mioReport || new Map()).values()].some(r => r.importato_da === io),
    corpo:() => btnAmway("Importa da Amway", "primary") });
  return l;
}
/* ---- 039. Le notifiche: un riepilogo alle 8:30 (e, con la 040, l'avviso del prossimo passo), mai nomi.
   La domanda compare una volta sola per telefono; si accendono e spengono dal Profilo. Il telefono salva la sua
   iscrizione; l'app salva per i prossimi giorni solo dei numeri (notifiche_previste); invia il server. ---- */
const chiaveNotificheChiesto = () => "growup-team.notifiche-chiesto." + st.profilo.id;
function pushSupportato(){ return !!window.GROWUP_PUSH || ("serviceWorker" in navigator && "PushManager" in window && "Notification" in window); }
function permessoNotifiche(){ try{ return window.GROWUP_PUSH ? window.GROWUP_PUSH.permesso() : Notification.permission; }catch(e){ return "default"; } }
function iosSenzaHome(){ return suIos() && !installata(); }
async function registrazionePush(){
  if(window.GROWUP_PUSH) return window.GROWUP_PUSH;
  return Promise.race([navigator.serviceWorker.ready, new Promise((_, no) => setTimeout(() => no(new Error("sw")), 8000))]);
}
async function statoNotifiche(){
  if(!pushSupportato() || iosSenzaHome()){ st.pushAttivo = false; return; }
  try{ const r = await registrazionePush(); st.pushAttivo = !!(await r.pushManager.getSubscription()) && permessoNotifiche() === "granted"; }
  catch(e){ st.pushAttivo = false; }
}
function daBase64url(s){ const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)); return Uint8Array.from(b, c => c.charCodeAt(0)); }
async function attivaNotifiche(){
  salvaLocale(chiaveNotificheChiesto(), "1");
  if(iosSenzaHome()){ toast("Prima installa Growup sulla Home: poi le notifiche si attivano dal Profilo"); render(); return; }
  try{
    const permesso = window.GROWUP_PUSH ? await window.GROWUP_PUSH.chiedi() : await Notification.requestPermission();
    if(permesso !== "granted"){ st.pushAttivo = false; render(); toast("Notifiche non permesse: si cambiano dalle impostazioni del telefono"); return; }
    const chiave = await api.chiaveNotifiche();
    if(!chiave){ toast("Le notifiche non sono ancora pronte: riprova tra qualche minuto dal Profilo"); render(); return; }
    const r = await registrazionePush();
    const sub = (await r.pushManager.getSubscription()) || await r.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:daBase64url(chiave) });
    const j = sub.toJSON ? sub.toJSON() : sub;
    await api.salvaTelefono({ endpoint:j.endpoint, p256dh:j.keys.p256dh, auth:j.keys.auth });
    st.pushAttivo = true; ultimePreviste = ""; aggiornaPreviste(); render(); toast("Notifiche attive: ogni mattina alle 8:30");
  }catch(e){ st.pushAttivo = false; render(); toast("Non riesco ad attivare le notifiche: riprova dal Profilo"); }
}
async function spegniNotifiche(){
  try{
    const r = await registrazionePush(), sub = await r.pushManager.getSubscription();
    if(sub){ const j = sub.toJSON ? sub.toJSON() : sub; await api.togliTelefono(j.endpoint); await sub.unsubscribe(); }
    st.pushAttivo = false; render(); toast("Notifiche spente su questo telefono");
  }catch(e){ toast(messaggio(e)); }
}
function vDomandaNotifiche(){
  if(!pushSupportato() || leggiLocale(chiaveNotificheChiesto()) === "1" || permessoNotifiche() !== "default" || st.pushAttivo) return "";
  return `<div class="card domanda-notifiche">
    <span class="eyebrow">Notifiche</span>
    <h3 style="margin-top:4px">Vuoi un promemoria ogni mattina?</h3>
    <p class="small" style="margin:6px 0 0">${iosSenzaHome()
      ? "Su iPhone le notifiche arrivano solo con Growup installata sulla Home (e iOS 16.4 o più). Installala, poi attivale dal Profilo."
      : "Alle 8:30 ti diciamo cosa c'è da fare oggi, e 30 minuti prima di un passo con l'ora ti avvisiamo. Senza nomi. Le spegni quando vuoi dal Profilo."}</p>
    <div class="row" style="gap:8px;margin-top:10px">${iosSenzaHome()
      ? `<button class="btn grow" data-act="notifiche-no">Ho capito</button>`
      : `<button class="btn primary grow" data-act="notifiche-si">Sì, attiva</button><button class="btn grow" data-act="notifiche-no">Non ora</button>`}</div>
  </div>`;
}
function vNotificheProfilo(){
  if(!pushSupportato()) return "";
  const negato = permessoNotifiche() === "denied", on = !!st.pushAttivo;
  return `<button class="interruttore notifiche-interruttore" role="switch" aria-checked="${on}" data-act="${on ? "notifiche-spegni" : "notifiche-si"}"${negato || iosSenzaHome() ? " disabled" : ""}>
    <span class="grow" style="text-align:left">Notifiche su questo telefono<br><span class="small">${iosSenzaHome() ? "Su iPhone serve Growup installata sulla Home"
      : negato ? "Bloccate dalle impostazioni del telefono: permettile da lì" : "Ogni mattina alle 8:30 e prima dei passi con l'ora"}</span></span>
    <span class="toggle${on ? " on" : ""}" aria-hidden="true"></span></button>
  ${on ? `<button class="voce-profilo" data-act="notifiche-prova"><span class="grow">Manda una notifica di prova</span><span class="fr" aria-hidden="true">›</span></button>` : ""}`;
}
/* i numeri dei prossimi 14 giorni per il riepilogo del mattino: solo numeri, mai nomi */
let ultimePreviste = "", previsteT = null;
function calcolaPreviste(){
  const l = st.persone.filter(p => !p.nascosta_io && p.fase !== "lista" && (!p.esito || (p.esito === "non_ora" && p.prossima_data)));
  const clientiOggi = clientiDaSentire().length, m = meseDi(oggi());
  const manca = Math.max(0, Math.round(((Number(st.goalMese.obiettivo_vp) || 0) - vpMese(m)) * 100) / 100);
  return Array.from({ length:14 }, (_, i) => { const g = piuGiorni(oggi(), i);
    return { giorno:g, persone:l.filter(p => p.prossima_data && p.prossima_data <= g).length, clienti:clientiOggi,
      seguimi:!!st.seguimi.attivo, vp_mancanti:meseDi(g) === m ? manca : 0 }; });
}
function aggiornaPreviste(){
  if(!st.pushAttivo || st.fase !== "home") return;
  clearTimeout(previsteT);
  previsteT = setTimeout(async () => {
    let righe; try{ righe = calcolaPreviste(); }catch(e){ return; }
    const j = JSON.stringify(righe);
    if(j === ultimePreviste) return;
    try{ await api.salvaPreviste(righe); ultimePreviste = j; }catch(e){}
  }, 1500);
}
function vPrimiPassi(){
  const l = primiPassi(), fatti = l.filter(x => x.fatto).length, linkDaSalvare = l.some(x => x.k === "link" && !x.fatto);
  const attesa = !st.profilo.is_admin && !st.profilo.confermato_il;
  if(fatti === l.length && !attesa) return "";
  if(leggiLocale(chiavePrimiPassiNo()) === "1" && !linkDaSalvare) return attesa ? vAttesaIo() : "";
  const pct = Math.round(fatti / l.length * 100);
  return `<div class="card primi-passi">
    <div class="spread"><span class="eyebrow">Primi passi</span><span class="row" style="gap:8px"><span class="pill">${fatti} su ${l.length}</span>
      ${linkDaSalvare ? "" : `<button class="x" data-act="primi-passi-no" aria-label="Nascondi i primi passi">×</button>`}</span></div>
    <div class="bar${pct === 100 ? " fatto" : ""}" role="progressbar" aria-label="Primi passi" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
    <ul class="voci-passi">${l.map(x => { const aperta = (st.passoAperto || (linkDaSalvare ? "link" : null)) === x.k && !x.fatto;
      return `<li class="${x.fatto ? "fatta" : ""}"><button class="riga-apri prima" data-act="passo-apri" data-k="${x.k}" aria-expanded="${aperta}"${x.fatto ? " disabled" : ""}>
        <span class="spunta-oggi${x.fatto ? " si" : ""}" aria-hidden="true">${x.fatto ? "✓" : ""}</span>
        <span class="grow"><b>${esc(x.nome)}</b>${x.fatto ? "" : `<br><span class="small">${esc(x.sotto)}</span>`}</span>
        ${x.fatto ? "" : `<span class="fr" aria-hidden="true">${aperta ? "▴" : "▾"}</span>`}</button>
        ${aperta ? `<div class="passo-aperto">${x.corpo()}</div>` : ""}</li>`; }).join("")}</ul>
    ${attesa ? `<div class="stato-attesa"><span class="grow">In attesa della mappa: i tuoi numeri restano solo tuoi.</span>${aiutoBtn("attesa-io")}</div>
      ${aiutoTesto("attesa-io", `Non sei ancora nel report mappe importato dalla tua upline. Puoi già usare tutta l'app, ma i tuoi numeri li
        vedi solo tu. Quando la tua upline importa una mappa in cui ci sei, entri nella struttura al tuo posto.`)}` : ""}
  </div>`;
}
/* ---- Le spiegazioni a richiesta (ottimizzazione 2): un «?» accanto al titolo apre e chiude il testo ---- */
function aiutoBtn(k){ const on = st.aiuti.has(k);
  return `<button class="aiuto-btn${on ? " on" : ""}" data-act="aiuto" data-k="${k}" aria-expanded="${on}" aria-label="${on ? "Chiudi la spiegazione" : "Spiegazione"}">?</button>`; }
function aiutoTesto(k, html){ return st.aiuti.has(k) ? `<p class="nota aiuto-testo">${html}</p>` : ""; }

/* ---- Il primo obiettivo: cifra al mese, entro quando, perché ---- */
/* la prima tappa dal Path to Bronze in su che vale almeno la cifra (oltre l'ultima con una cifra: l'ultima) */
/* la qualifica che vale la cifra del mio obiettivo, se è oltre Platino (per proporla come prossima) */
function qualificaObiettivo(){
  const t = st.obiettivo ? tappaPerCifra(st.obiettivo.cifra_mese) : null;
  return t && oltrePlatino(t.tappa) ? t.tappa.chiave : null;
}
function tappaPerCifra(cifra){
  /* Oro si salta (stessi riconoscimenti di Argento) e i Fondatori pure: hanno la cifra della loro qualifica, che è
     sempre l'obiettivo proposto (decisioni di Stefano) */
  const t = st.stages.filter(s => s.ordine >= 3 && s.chiave !== "oro" && !s.chiave.endsWith("_fondatore") && Number(s.guadagno_mese) > 0)
    .sort((a, b) => a.ordine - b.ordine);
  if(!t.length) return null;
  const c = t.find(s => Number(s.guadagno_mese) >= Number(cifra));
  return c ? { tappa:c, oltre:false } : { tappa:t[t.length - 1], oltre:true };
}
function mesiAlTraguardo(entro){ return Math.max(0, mesiTra(meseDi(oggi()), meseDi(entro))); }
function testoTraguardo(entro){
  const m = mesiAlTraguardo(entro);
  return `entro ${nomeMese(meseDi(entro))} · ${m === 0 ? "è questo mese" : m === 1 ? "manca 1 mese" : `mancano ${m} mesi`}`;
}
/* la riga "Obiettivo: …" di una persona del gruppo (cifra e data, mai il perché) */
function rigaObiettivoDi(pid){
  const pq = st.prossime.get(pid);
  const prossima = pq ? `Prossima qualifica: <b>${esc(nomeQualifica(pq))}</b>` : "";
  const o = st.obiettiviGruppo.get(pid);
  if(!o) return prossima || "Obiettivo: non ancora scritto";
  const t = tappaPerCifra(o.cifra_mese);
  return `Obiettivo: <b>${euro(o.cifra_mese)}/mese</b> ${esc(testoTraguardo(o.entro))}${t && !prossima ? ` · ${esc(t.tappa.nome)}` : ""}${prossima ? "<br>" + prossima : ""}`;
}
function campiObiettivo(o){
  o = o || {};
  const min = meseDi(oggi());
  return `<label class="field"><span>Quanto vorresti guadagnare al mese? (€)</span>
      <input name="cifra" type="text" inputmode="numeric" autocomplete="off" value="" placeholder="${o.cifra_mese ? esc(String(Number(o.cifra_mese))) : "0"}" data-vuoto></label>
    <label class="field"><span>Entro quando?</span>
      <input name="entro" type="month" min="${min}" value="${o.entro ? meseDi(o.entro) : ""}"></label>
    <label class="field"><span>Perché è importante per te? <span class="faint">(lo vedi solo tu)</span></span>
      <textarea name="perche" rows="3" maxlength="1000">${esc(o.perche || "")}</textarea></label>`;
}
function vObiettivoPrimo(){
  return `<div>
    ${marchio()}
    <h1 style="margin-top:6px">Il tuo primo obiettivo</h1>
    <p class="muted">Da dove vuoi partire? Scrivi quanto vorresti guadagnare al mese e per quando: l'app ti mostra la tappa
      che vale quella cifra e il percorso per arrivarci. Puoi cambiarlo quando vuoi.</p>
    <form data-form="obiettivo" class="card" novalidate>
      ${campiObiettivo()}
      <button class="btn primary wide" style="margin-top:16px">Salva il mio obiettivo</button>
      <button type="button" class="btn ghost wide" style="margin-top:8px" data-act="obiettivo-dopo">Lo scrivo dopo</button>
    </form>
  </div>`;
}
/* una tappa futura descritta dai suoi requisiti */
function requisitiTesto(t){
  const r = [];
  if(t.clienti) r.push(`i primi ${t.clienti} clienti`);
  if(Number(t.vp_personali) > 0) r.push(`${num(t.vp_personali)} VP personali`);
  if(t.linee) r.push(`${t.linee} linee da ${num(Number(t.vp_linea) || soglia())} VP`);
  if(t.vp_gruppo) r.push(`${num(t.vp_gruppo)} VP di gruppo`);
  return r.join(" · ");
}
function vObiettivo(){
  const o = st.obiettivo;
  if(!o) return `<div class="card">
    <span class="eyebrow">Il mio obiettivo</span>
    <h2 style="margin-top:4px">Quanto vorresti guadagnare al mese?</h2>
    <p class="small">Scrivi la cifra e per quando: qui vedrai la tappa che la vale e il percorso per arrivarci.</p>
    <button class="btn primary wide" style="margin-top:8px" data-act="obiettivo-modifica">Scrivi il tuo obiettivo</button>
  </div>${vProssimaQualifica()}${vReportDaImportare()}${vComeArrivarci(st.profilo.id, "io")}${vVisione()}`;
  const t = tappaPerCifra(o.cifra_mese), S = st.stages, { indice, attuale } = percorso();
  const fino = t ? S.findIndex(s => s.chiave === t.tappa.chiave) : -1;
  const giaFatto = fino >= 0 && indice > fino;
  const mancano = fino >= indice ? fino - indice + 1 : 0;
  return `<div class="card tight visione">
    <span class="eyebrow">Il mio obiettivo</span>
    <h2 style="margin-top:2px"><span class="num">${euro(o.cifra_mese)}</span> al mese</h2>
    <p class="small" style="margin:2px 0 0">${esc(testoTraguardo(o.entro))}</p>
    ${o.perche ? `<p class="perche">«${esc(o.perche)}»</p><p class="nota" style="margin-top:2px">Il perché lo vedi solo tu.</p>` : ""}
    <button class="btn" style="margin-top:10px;min-height:38px" data-act="obiettivo-modifica">Modifica</button>
  </div>
  ${t ? `<div class="card">
    <span class="eyebrow">La tappa che vale la tua cifra</span>
    <div class="spread" style="margin-top:4px"><h2>${esc(t.tappa.nome)}</h2><span class="num">${euro(t.tappa.guadagno_mese)}<span class="small"> /mese*</span></span></div>
    ${t.oltre ? `<p class="small" style="margin:4px 0 0">La tua cifra è oltre ${esc(t.tappa.nome)}: ${esc(t.tappa.nome)} vale circa ${euro(t.tappa.guadagno_mese)} al mese.</p>` : ""}
    ${t.tappa.struttura_calcolo ? `<p class="small" style="margin:4px 0 0">Calcolato su: ${esc(t.tappa.struttura_calcolo)}</p>` : ""}
    <p class="small" style="margin:8px 0 0">${giaFatto ? "Hai già raggiunto questa tappa." : !attuale ? `Da qui: ${plur(mancano, "qualifica", "qualifiche")} da raggiungere.`
      : mancano === 1 ? "È la tua tappa attuale." : `Da qui: ${mancano} tappe, compresa quella attuale.`}</p>
    <p class="nota">* ${notaGuadagni()}</p>
  </div>
  <div class="card">
    <span class="eyebrow">Il percorso fino all'obiettivo</span>
    <ol class="percorso">${S.slice(0, Math.max(fino, indice - 1) + 1).map((s, i) => {
      /* oltre Platino non c'è una tappa "attuale": le qualifiche si dichiarano */
      const stato = i < indice ? "fatta" : i === indice && attuale ? "attuale" : "dopo";
      const req = stato === "attuale" ? requisiti(s) : [];
      return `<li class="${stato}${i === fino ? " meta" : ""}">
        <span class="mark">${stato === "fatta" ? "✓" : i + 1}</span>
        <div class="grow"><b>${esc(s.nome)}</b>${i === fino ? ` <span class="pill s">obiettivo</span>` : ""}
          ${stato === "attuale" ? `<span class="pill">tappa attuale</span>` : ""}
          ${s.guadagno_mese ? `<span class="small"> · ${euro(s.guadagno_mese)}/mese*</span>` : ""}
          ${stato === "attuale" ? `<ul class="req">${req.map(r => `<li class="${r.ok ? "ok" : ""}"><span class="mark">${r.ok ? "✓" : "○"}</span>
              <span class="grow">${esc(r.txt)}</span>${r.val ? `<span class="num">${esc(r.val)}</span>` : ""}</li>`).join("")}</ul>`
            : stato === "dopo" ? `<p class="small" style="margin:2px 0 0">${esc(requisitiTesto(s) || s.descrizione || "")}</p>` : ""}</div></li>`; }).join("")}</ol>
  </div>` : ""}
  ${vProssimaQualifica()}
  ${vReportDaImportare()}
  ${vComeArrivarci(st.profilo.id, "io")}
  ${vVisione()}`;
}

/* Volume Rubino del mese (da Platino in su): il VPG del report mappe importato, che non conta le linee al 21% */
function vRubino(pid){
  const p = pid === st.profilo.id ? st.profilo : st.struttura.find(x => x.id === pid);
  if(!p || !daPlatino(p.qualifica_iniziale)) return "";
  const r = rigaDi(st.riep, pid);
  if(!r || !r.da_report) return `<p class="small rubino" style="margin:6px 0 0">Volume Rubino questo mese: ${pid === st.profilo.id
    ? "importa il report mappe per vederlo" : "si vede quando importi il report mappe"}.</p>`;
  const v = Number(r.vp_gruppo) || 0;
  return `<p class="small rubino" style="margin:6px 0 0">Volume Rubino questo mese: <b class="num">${num(v)}</b> su ${num(RUBINO_VP)} VP${v >= RUBINO_VP ? " ✓" : ""}</p>`;
}
/* nella scheda partner, per chi è tra Argento e Platino: i mesi da Argento dai report che ho importato io */
function vMesiArgentoScheda(p){
  const righe = st.mesiScheda[p.id];
  if(!righe || daPlatino(p.qualifica_iniziale)) return "";
  const x = mesiArgento(righe);
  if(!x.mesi && !conMeseArgento(p.qualifica_iniziale)) return "";
  const prossima = x.mesi >= MESI_ARGENTO.oro ? "Platino" : "Oro", min = MESI_ARGENTO[prossima.toLowerCase()];
  return `<p class="small mesi-argento" style="margin:6px 0 0">Mesi da Argento: <b>${x.mesi} su ${min}</b> per ${prossima}
    <span class="faint">(ultimi 12 mesi, dai report che hai importato)</span></p>`;
}
/* Il Performance Year in corso: da settembre al mese in corso (o fino al mese indicato) */
function annoPY(fino){
  const ora = fino || meseDi(oggi()), out = [];
  for(let m = `${Number(ora.slice(5)) >= 9 ? ora.slice(0, 4) : Number(ora.slice(0, 4)) - 1}-09`; m <= ora; m = spostaMese(m, 1)) out.push(m);
  return out;
}
/* I mesi del Performance Year dai report importati: mesi da Argento (21%), Rubino (VPG ≥ 20.000), Zaffiro (VPG ≥ 4.000
   e 2 linee al 21%, oppure 3 linee al 21%) e, per ogni linea frontale, i mesi al 21% */
function contaPY(fino){
  const mesi = annoPY(fino), mio = new Map(st.mesiReport.map(x => [meseDi(x.mese), x]));
  const linee = [...st.mesiLinee.values()].map(l => {
    const per = new Map(l.righe.map(x => [meseDi(x.mese), Number(x.percentuale) || 0]));
    return { nome:l.nome, per, mesi21:mesi.filter(m => (per.get(m) || 0) >= 21).length, ora:per.get(meseDi(oggi())) };
  }).sort((a, b) => b.mesi21 - a.mesi21);
  let argento = 0, rubino = 0, zaffiro = 0;
  for(const m of mesi){
    const x = mio.get(m); if(!x) continue;
    const vpg = Number(x.vpg) || 0, l21 = linee.filter(l => (l.per.get(m) || 0) >= 21).length;
    if(daArgento(x)) argento++;
    if(vpg >= RUBINO_VP) rubino++;
    if((vpg >= 4000 && l21 >= 2) || l21 >= 3) zaffiro++;
  }
  return { mesi:mesi.length, report:mesi.filter(m => mio.has(m)).length, argento, rubino, zaffiro, linee };
}
/* La qualifica dell'anno fiscale raggiunta fino al mese m (dai report importati da settembre): Oro 3 mesi da Argento,
   Platino 6, Platino Fondatore 12; da Platino: Rubino (un mese Rubino; 12 Fondatore), Zaffiro 6 (12), Smeraldo 3 linee
   al 21% per 6 mesi (12), Diamante 6 linee per 6 mesi (12). Null se non ne ha ancora nessuna. */
function qualificaPY(m){
  const c = contaPY(m), lineeDa = min => c.linee.filter(l => l.mesi21 >= min).length;
  const platino = c.argento >= MESI_ARGENTO.platino || daPlatino(st.profilo.qualifica_iniziale);
  const regole = [
    ["diamante_fondatore", platino && lineeDa(12) >= 6], ["diamante", platino && lineeDa(6) >= 6],
    ["smeraldo_fondatore", platino && lineeDa(12) >= 3], ["smeraldo", platino && lineeDa(6) >= 3],
    ["zaffiro_fondatore", platino && c.zaffiro >= 12], ["zaffiro", platino && c.zaffiro >= 6],
    ["rubino_fondatore", platino && c.rubino >= 12], ["rubino", platino && c.rubino >= 1],
    ["platino_fondatore", c.argento >= 12], ["platino", c.argento >= MESI_ARGENTO.platino], ["oro", c.argento >= MESI_ARGENTO.oro]];
  const x = regole.find(([k, ok]) => ok && ordineDi(k) > 0);
  return x ? x[0] : null;
}
/* l'avanzamento verso la prossima qualifica: righe { ok, txt, val } */
function avanzamentoPY(chiave){
  const c = contaPY(), out = [];
  const lineeDa = min => c.linee.filter(l => l.mesi21 >= min).length;
  const riga = (n, su, txt) => out.push({ ok:n >= su, txt, val:`${Math.min(n, su)} / ${su}` });
  if(chiave === "platino_fondatore") riga(c.argento, 12, "Mesi da Argento nel Performance Year");
  if(chiave === "rubino_fondatore") riga(c.rubino, 12, "Mesi Rubino (20.000 VP di Volume Rubino)");
  if(chiave === "zaffiro") riga(c.zaffiro, 6, "Mesi Zaffiro nel Performance Year");
  if(chiave === "zaffiro_fondatore") riga(c.zaffiro, 12, "Mesi Zaffiro nel Performance Year");
  if(chiave === "smeraldo") riga(lineeDa(6), 3, "Linee al 21% per almeno 6 mesi");
  if(chiave === "smeraldo_fondatore") riga(lineeDa(12), 3, "Linee al 21% per 12 mesi");
  if(chiave === "diamante") riga(lineeDa(6), 6, "Linee al 21% per almeno 6 mesi");
  if(chiave === "diamante_fondatore") riga(lineeDa(12), 6, "Linee al 21% per 12 mesi");
  if(out.length) out.push({ ok:c.report >= c.mesi, attesa:c.report < c.mesi, txt:"Report mappe importati da settembre", val:`${c.report} / ${c.mesi}` });
  return { righe:out, c };
}
function vAvanzamentoPY(chiave){
  const { righe, c } = avanzamentoPY(chiave);
  const lista = righe.length ? `<ul class="req">${righe.map(r => `<li class="${r.ok ? "ok" : ""} ${r.attesa ? "attesa" : ""}">
      <span class="mark">${r.ok ? "✓" : r.attesa ? "·" : "○"}</span><span class="grow">${esc(r.txt)}</span><span class="num">${esc(r.val)}</span></li>`).join("")}</ul>` : "";
  const tabella = c.linee.length ? `<p class="small" style="margin:12px 0 0"><b>Le tue linee nel Performance Year</b> · mesi al 21% da settembre</p>
    <div class="tab-consigli linee-py"><table><thead><tr><th>Linea</th><th>mesi al 21%</th><th>questo mese</th></tr></thead>
      <tbody>${c.linee.map(l => `<tr><td>${esc(l.nome)}</td><td class="num">${l.mesi21}</td><td class="num">${l.ora != null ? l.ora + "%" : "–"}</td></tr>`).join("")}</tbody></table></div>` : "";
  return lista + tabella + (righe.length || c.linee.length ? `<p class="nota">Dai report mappe che hai importato: un mese senza report non si conta.</p>` : "");
}
/* la prossima qualifica (da Platino in su): nome, requisiti, Volume Rubino */
function vProssimaQualifica(){
  const p = st.profilo;
  if(!daPlatino(p.qualifica_iniziale)) return "";
  const t = st.stages.find(s => s.chiave === p.prossima_qualifica);
  return `<div class="card prossima-qualifica">
    <span class="eyebrow">La prossima qualifica</span>
    ${t ? `<h2 style="margin-top:4px">${esc(t.nome)}</h2>${t.descrizione ? `<p class="small" style="margin:4px 0 0">${esc(t.descrizione)}</p>` : ""}`
      : `<p class="small" style="margin:6px 0 0">Non l'hai ancora scelta.</p>`}
    ${vRubino(p.id)}
    ${t ? vAvanzamentoPY(t.chiave) : ""}
    <p class="nota">Hai dichiarato: ${esc(testoPartenza(p))}. Le qualifiche oltre Argento si aggiornano da qui quando le raggiungi.</p>
    <button class="btn" style="margin-top:10px;min-height:38px" data-act="partenza">${t ? "Modifica" : "Scegli la prossima qualifica"}</button>
  </div>`;
}

/* "Come arrivarci": chiuso finché non lo si tocca. chi: "io" (per me, in Obiettivo) o "lui" (per lo sponsor, nella scheda) */
/* Da Argento a Platino: un mese da Argento = 21% nel report (10.000 VP di gruppo, o 1 linea al 21% e 4.000 VP,
   o 2 linee al 21%). Vince la prima situazione che scatta. */
const ARGENTO_VPG = 10000, ARGENTO_VICINO = 8000;
function filaInCorso(righe){
  const per = new Map((righe || []).map(x => [meseDi(x.mese), daArgento(x)]));
  let n = 0;
  for(let m = spostaMese(meseDi(oggi()), -1); per.get(m) && n < 12; m = spostaMese(m, -1)) n++;
  return n;
}
function situazioneArgento(pid, t, righe){
  const io = pid === st.profilo.id, n = numeriDi(pid);
  if(!n) return null;
  const r = rigaDi(st.riep, pid) || {};
  const x = mesiArgento(righe), servono = MESI_ARGENTO[t.chiave] || 0;
  const pct = Math.max(Number(io ? n.percentuale : r.percentuale) || 0,
    Number(((righe || []).find(y => meseDi(y.mese) === meseDi(oggi())) || {}).percentuale) || 0);
  const linee = n.linee.map(l => Object.assign(analisiLinea(l, 0), { pct:l.id ? Number((rigaDi(st.riep, l.id) || {}).percentuale) || null : null }));
  const dati = { tappa:t.nome, mesi:x.mesi, servono, vpg:num(n.gruppo) };
  const s = { tappa:t, linee, annuale:true, personali:n.personali, dati, mesi:x,
    sintesi:`questo mese ${num(n.gruppo)} VP di gruppo${pct ? ` (${pct}%)` : ""}` };
  const mancanti = io ? mesiDaImportare().filter(m => !m.fatto) : [];
  const l21 = linee.find(l => l.pct >= 21), verso = linee.find(l => l.vp >= ARGENTO_VICINO && !(l.pct >= 21));
  const vicine = k => k.vicine ? plur(k.vicine, "persona è", "persone sono") : "";
  if(mancanti.length){
    s.chiave = "report_mancanti";
    dati.report_di = (mancanti.length === 1 ? "il report di " : "i report di ") + mancanti.map(m => nomeMese(m.mese)).join(", ");
  }
  else if(argentoDaNumeri(pct, n.gruppo, linee)){
    /* il mese in corso conta già se il suo report da Argento è importato, altrimenti si aggiunge */
    const giaContato = (righe || []).some(y => meseDi(y.mese) === meseDi(oggi()) && daArgento(y));
    s.chiave = "mese_ok"; dati.mesi = Math.min(x.mesi + (giaContato ? 0 : 1), servono);
  }
  else if(t.chiave === "platino" && x.mesi >= servono && x.fila < 3){
    /* conta il mese in corso (ancora aperto): è il primo, il secondo o il terzo della fila */
    const f = Math.min(filaInCorso(righe), 2), eri = io ? "eri" : "era", arrivi = io ? "arrivi" : "arriva";
    s.chiave = "fila";
    dati.fila_testo = f === 0 ? `Il mese scorso non ${eri} al 21%: questo mese, se ${arrivi} al 21%, è il primo dei 3.`
      : f === 1 ? `Il mese scorso ${eri} al 21%: questo mese è il secondo dei 3.` : `Gli ultimi 2 mesi ${eri} al 21%: questo mese è il terzo, quello che fa Platino.`;
  }
  else if(l21 && linee.filter(l => l.pct >= 21).length === 1 && n.gruppo - l21.vp < ARGENTO_RIMANENTI){
    const rimanenti = Math.max(0, n.gruppo - l21.vp);
    s.chiave = "linea_21"; Object.assign(dati, { nome_linea:l21.nome, rimanenti:num(rimanenti), manca:num(ARGENTO_RIMANENTI - rimanenti) });
  }
  else if(n.gruppo >= ARGENTO_VICINO){
    s.chiave = "mese_vicino"; Object.assign(dati, { manca:num(ARGENTO_VPG - n.gruppo), vicine:vicine(tipoLinee(linee)) });
  }
  else if(verso){ s.chiave = "linea_verso_21"; Object.assign(dati, { nome_linea:verso.nome, vpg_linea:num(verso.vp) }); }
  else{
    const k = tipoLinee(linee);
    s.chiave = "mese_lontano." + k.tipo; Object.assign(dati, { manca:num(ARGENTO_VPG - n.gruppo), vicine:vicine(k) });
  }
  return s;
}
function vComeArrivarci(pid, chi){
  const s = situazione(pid);
  if(!s) return "";
  const testi = (CONSIGLI[s.chiave] || {})[chi] || [];
  const t = s.tappa, vpp = Number(t.vp_personali) || 0;
  const promemoria = s.annuale
    ? `<p class="promemoria">Mesi da Argento negli ultimi 12 mesi: ${s.mesi.mesi} su ${s.dati.servono} per ${esc(t.nome)}${s.mesi.mesi >= s.dati.servono ? " ✓" : ""}${
        t.chiave === "platino" ? ` · 3 di fila ${s.mesi.fila >= 3 ? "✓" : `○ (${Math.min(s.mesi.fila, 3)} su 3)`}` : ""}</p>`
    : !TAPPE_DI_PERCORSO.includes(t.chiave) && vpp > 0
    ? `<p class="promemoria">Ricorda: per ${esc(t.nome)} servono anche ${num(vpp)} VP personali nel mese ·
        ${chi === "io" ? "ne hai" : "ne ha"} ${num(s.personali)}${s.personali >= vpp ? " ✓" : `, mancano ${num(vpp - s.personali)}`}</p>` : "";
  const cella = v => `<td class="num">${v == null ? "–" : num(v)}</td>`;
  const an = !!s.annuale;   // da Argento a Platino: la % della linea al posto di "manca"
  const tabella = s.linee.length ? `<div class="tab-consigli"><table>
      <thead><tr><th>Linea</th>${an ? "<th>%</th>" : ""}<th>VP</th><th>persone</th><th>a 0</th><th>&lt; 50</th><th>50-99</th><th>100-199</th><th>200+</th><th>VP medio</th>${an ? "" : "<th>manca</th>"}</tr></thead>
      <tbody>${s.linee.map(l => { const f = l.fasce || [];
        return `<tr><td>${esc(l.nome)}</td>${an ? `<td class="num">${l.pct ? l.pct + "%" : "–"}</td>` : ""}${cella(l.vp)}${cella(l.persone)}${cella(l.zero)}${cella(f[0])}${cella(f[1])}${cella(f[2])}${cella(f[3])}${cella(l.media)}
        ${an ? "" : `<td class="num${l.manca ? " sotto" : ""}">${l.manca ? num(l.manca) + " VP" : "✓"}</td>`}</tr>`; }).join("")}</tbody>
    </table></div>` : "";
  const aperto = st.consigliAperti.has(pid);
  return `<details class="card metodo consigli" data-chiave="${esc(s.chiave)}" data-id="${esc(pid)}"${aperto ? " open" : ""}>
    <summary><span class="eyebrow">Come arrivarci</span></summary>
    ${promemoria}
    <p class="small" style="margin:8px 0 0">${TAPPE_DI_PERCORSO.includes(t.chiave) ? "Tappa" : "Prossima tappa"}: <b>${esc(t.nome)}</b> · ${esc(s.sintesi)}</p>
    ${testi.map(x => riempi(x, s.dati)).filter(Boolean).map(x => `<p>${esc(x)}</p>`).join("")}
    ${tabella}
    <p class="nota">Calcolato sui numeri del mese fino a oggi. Sono spunti: la strada la decidete voi.</p>
  </details>`;
}

function vVisione(){
  const a = st.stages.find(s => s.chiave === "argento");
  if(!a) return "";
  return `<div class="card tight visione">
    <span class="eyebrow">La visione</span>
    <div class="spread" style="margin-top:2px">
      <h2>${esc(a.nome)}</h2>
      ${a.guadagno_mese ? `<span class="num">${euro(a.guadagno_mese)}<span class="small"> /mese*</span></span>` : ""}
    </div>
    ${a.struttura_calcolo ? `<p class="small" style="margin:2px 0 0">Calcolato su: ${esc(a.struttura_calcolo)}</p>` : ""}
    <p class="nota" style="margin-top:6px">* ${notaGuadagni()}</p>
  </div>`;
}

/* La tappa del percorso, dentro «I miei numeri»: una riga (nome e requisiti fatti) che si apre su tutto il dettaglio */
function datiTappa(){
  const { raggiunta, attuale, indice } = percorso();
  const pag = pagamenti(raggiunta);
  if(!attuale){
    const pq = st.profilo.prossima_qualifica;
    return { riga:`<b>${esc(raggiunta ? raggiunta.nome : "Argento")}</b> raggiunto 🎉`, sempre:"", corpo:`
      ${pq ? `<p class="small" style="margin:4px 0 0">Prossima qualifica: <b>${esc(nomeQualifica(pq))}</b>${(() => {
          const x = avanzamentoPY(pq).righe[0]; return x && !x.attesa ? ` · ${esc(x.txt.toLowerCase())}: ${esc(x.val)}` : ""; })()}</p>`
        : `<button class="btn" style="margin-top:10px;min-height:38px" data-act="scegli-prossima">Scegli la prossima qualifica</button>`}
      ${vRubino(st.profilo.id)}
      <p class="muted">Hai completato il percorso fino a Platino. Ora l'obiettivo è aiutare le tue linee a fare lo stesso.</p>` };
  }
  const req = requisiti(attuale);
  let scadenza = "";
  if(attuale.chiave === "primo_ordine"){
    const f = finestraPrimoOrdine(attuale);
    if(f && f.restano >= 0) scadenza = `<p class="pill g" style="margin:8px 0 0">${f.restano === 0 ? "Ultimo giorno" : `Mancano ${plur(f.restano, "giorno", "giorni")}`} per non pagare i 40 € di iscrizione</p>`;
    else if(!st.profilo.data_iscrizione) scadenza = `<p class="small">Aggiungi la data di iscrizione per vedere il conto alla rovescia dei 30 giorni.</p>`;
  }
  const nelMese = Number(attuale.vp_personali) > 0 && attuale.chiave !== "primo_ordine";
  const n = numeriMese(meseDi(oggi()));
  const conLinee = attuale.ordine >= 3 && !oltreArgento(attuale);
  /* percentuale e qualifica sono due cose distinte */
  const manca = conLinee ? mancanze(attuale, n) : [];
  const pinMax = Math.max(Number(st.profilo.percentuale_iniziale) || 0, ...st.storico.map(r => Number(r.percentuale) || 0));
  const distinti = conLinee && n.percentuale && attuale.percentuale && n.percentuale >= attuale.percentuale && manca.length
    ? `<p class="avviso">${n.percentuale}% raggiunto · ${esc(attuale.nome)} non qualificato: ${esc(manca.join(", "))}.</p>` : "";
  /* solo il dato: come muoversi lo decide il partner */
  const terza = conLinee && n.attive < 3
    ? `<div class="spinta"><b>Linee attive: ${n.attive} su 3.</b> ${3 - n.attive === 1 ? "Manca 1 linea" : `Mancano ${3 - n.attive} linee`}
        da ${num(soglia())} VP per il Path to Bronze.</div>` : "";
  const linee = conLinee && n.linee.length
    ? `<ul class="linee">${n.linee.map(l => `<li><span class="grow">${esc(l.nome)}</span>
        <span class="num ${l.vp >= soglia() ? "" : "faint"}">${num(l.vp)} VP</span></li>`).join("")}</ul>
       <p class="nota" style="margin-top:4px">Le tue linee frontali questo mese, con i VP di tutto il loro gruppo. Attiva da ${num(soglia())} VP.</p>` : "";
  const fatti = req.filter(r => r.ok).length;
  return { riga:`Tappa ${indice + 1} di ${(st.stages.findIndex(s => s.chiave === "platino") + 1) || st.stages.length} · <b>${esc(attuale.nome)}</b>
      <span class="small">· ${fatti} su ${req.length} requisiti</span>`, sempre:scadenza, corpo:`
    <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:8px">
      ${n.percentuale ? `<span class="pill s">${n.percentuale}% questo mese</span>` : ""}
      ${n.daReport ? `<span class="pill">dal report Amway</span>` : ""}
      ${pinMax && pinMax > (n.percentuale || 0) ? `<span class="pill">${pinMax}% raggiunto</span>` : ""}
      ${raggiunta ? `<span class="pill v">✓ ${esc(raggiunta.nome)}</span>` : ""}</div>
    ${attuale.guadagno_mese ? `<p class="small" style="margin:6px 0 0">Circa ${euro(attuale.guadagno_mese)} al mese* con ${esc(attuale.struttura_calcolo || "")}</p>` : ""}
    <ul class="req">${req.map(r => `<li class="${r.ok ? "ok" : ""} ${r.attesa ? "attesa" : ""}">
      <span class="mark">${r.ok ? "✓" : r.attesa ? "·" : "○"}</span>
      <span class="grow">${esc(r.txt)}${r.cliente ? ` <button class="btn link small" data-act="cliente" style="min-height:0">+ Cliente</button>` : ""}</span>
      ${r.val ? `<span class="num">${esc(r.val)}</span>` : ""}</li>`).join("")}</ul>
    ${distinti}
    ${linee}
    ${terza}
    ${pag ? `<p class="small" style="margin-top:8px">${esc(raggiunta.nome)}: ${esc(pag)}</p>` : ""}
    ${nelMese ? `<p class="nota">Tutti i requisiti valgono nello stesso mese di calendario (${nomeMese(meseDi(oggi()))}).</p>` : ""}
    ${oltreArgento(attuale) ? `<p class="nota">Un mese da Argento è un mese in cui il report mappe importato ti dà al 21%.
      La prima volta Oro e Platino si contano su 12 mesi consecutivi.</p>` : ""}
    ${attuale.guadagno_mese ? `<p class="nota">* ${notaGuadagni()}</p>` : ""}` };
}

/* «I miei numeri» (ottimizzazione 1): obiettivo, tappa, settimana e mese in un solo riquadro. Gli ordini stanno nel
   foglio «Ordini» (+ Ordine nella barra in basso), l'import in Gruppo. */
function vMieiNumeri(){
  const o = st.obiettivo, t = datiTappa(), aperta = !!st.tappaAperta;
  const g = st.goal, m = meseDi(oggi()), c = clientiMese(m), nm = numeriMese(m);
  return `<div class="card miei-numeri">
    <span class="eyebrow">I miei numeri</span>
    ${o ? `<button class="riga-apri prima" data-act="vista-obiettivo"><span class="grow"><b class="num">${euro(o.cifra_mese)}</b> al mese
      <span class="small">· ${esc(testoTraguardo(o.entro))}</span></span><span class="fr" aria-hidden="true">›</span></button>` : ""}
    <button class="riga-apri${o ? "" : " prima"}" data-act="apri-tappa" aria-expanded="${aperta}"><span class="grow">${t.riga}</span>
      <span class="fr" aria-hidden="true">${aperta ? "▴" : "▾"}</span></button>
    ${t.sempre}
    ${aperta ? `<div class="tappa-aperta">${t.corpo}</div>` : ""}
    <div class="blocco-numeri">
      <div class="spread"><h3>La mia settimana <span class="small">${dataIt(settimana())} – ${dataIt(piuGiorni(settimana(), 6))}</span></h3>
        <button class="btn small ghost" data-act="obiettivi">Modifica</button></div>
      ${g.salvato && st.goalMese.salvato ? "" : `<p class="small" style="margin:6px 0 0">Ti proponiamo questi obiettivi per iniziare. Vanno bene?
        <button class="btn link small" data-act="conferma-obiettivi">Sì, confermo</button></p>`}
      ${barra("Nuovi contatti", fattoSettimana("contatto"), g.obiettivo_contatti)}
      ${barra("Piani mostrati", fattoSettimana("piano"), g.obiettivo_piani)}
    </div>
    <div class="blocco-numeri">
      <div class="spread"><h3>Il mio mese <span class="small">${nomeMese(m).replace(/^./, x => x.toUpperCase())}</span></h3>
        <span class="row" style="gap:6px"><button class="btn small ghost" data-act="storico">Storico</button>
        <button class="btn small ghost" data-act="obiettivo-mese">Obiettivo</button></span></div>
      ${barraVp(m)}
      ${rigaVp(m)}
      ${nm.gruppo > nm.personali || nm.linee.length
        ? `<div class="spread" style="margin-top:10px"><span>VP di gruppo</span><b class="num">${num(nm.gruppo)}</b></div>` : ""}
      <div class="spread" style="margin-top:10px">
        <span>Nuovi clienti nel mese <b class="num">${num(c)}</b></span>
        <button class="btn small" data-act="cliente" style="white-space:nowrap">+ Cliente</button>
      </div>
      ${clientiTotali() >= 3 ? "" : `<p class="small" style="margin:4px 0 0">I tuoi primi 3 clienti (anche in mesi diversi) completano la tappa «Primi clienti»: ${num(clientiTotali())} su 3.</p>`}
    </div>
  </div>
  ${vReportDaImportare()}`;
}

/* Il promemoria dell'import (solo per chi ha un gruppo e ha già importato): l'ultimo report ha più di 7 giorni */
const GIORNI_PROMEMORIA_IMPORT = 7;
function vPromemoriaImport(){
  const io = st.profilo.id, righe = [...(st.mioReport || new Map()).values()];
  if(!figli(io).length || !righe.some(r => r.importato_da === io)) return "";
  const ultimo = righe.map(r => String(r.dati_al || "")).sort().pop();
  const giorno = ultimo ? ultimo.slice(0, 10) : "";
  const giorni = giorno ? giorniTra(giorno, oggi()) : 99;
  if(giorni <= GIORNI_PROMEMORIA_IMPORT) return "";
  return `<div class="card tight promemoria-import"><div class="spread">
    <span>${giorno ? `L'ultimo report è del <b>${dataIt(giorno)}</b>: ${plur(giorni, "giorno", "giorni")} fa.` : "Questo mese non hai ancora importato il report."}</span>
    ${btnAmway("Importa da Amway", "small primary")}</div></div>`;
}

/* I report mappe da importare per contare i mesi: chi ha dichiarato Argento o Oro dal mese della prima qualifica
   Argento (al massimo gli ultimi 12 mesi), chi ha dichiarato Platino o più da settembre (Performance Year).
   Fino al mese scorso: il mese in corso si importa come sempre. */
function mesiDaImportare(){
  const p = st.profilo, q = p.qualifica_iniziale, ora = meseDi(oggi());
  let da = null;
  if(conMeseArgento(q) && p.qualifica_iniziale_mese) da = [meseDi(p.qualifica_iniziale_mese), spostaMese(ora, -11)].sort()[1];
  else if(daPlatino(q)) da = `${Number(ora.slice(5)) >= 9 ? ora.slice(0, 4) : Number(ora.slice(0, 4)) - 1}-09`;
  if(!da) return [];
  const fatti = new Set(st.mesiReport.map(x => meseDi(x.mese)));
  const out = [];
  for(let m = da; m < ora; m = spostaMese(m, 1)) out.push({ mese:m, fatto:fatti.has(m) });
  return out;
}
/* 6 mesi da Argento (3 di fila): l'app riconosce Platino, la qualifica dichiarata diventa Platino e chiede la prossima */
async function riconosciPlatino(){
  const p = st.profilo;
  if(!p || !ordineDi("platino") || ordineDi(p.qualifica_iniziale) >= ordineDi("platino") || (percorso().raggiunta || {}).chiave !== "platino") return;
  try{
    st.profilo = await api.modificaPartenza({ p_qualifica:"platino", p_percentuale:null,
      p_qualifica_mese:p.qualifica_iniziale_mese || null, p_pagamenti:Number(p.pagamenti_iniziali) || 0 });
  }catch(e){ return; }
  const k = `growup-team.festa.${p.id}.tappa.${percorso().indice}`;
  if(!leggiLocale(k)){ salvaLocale(k, "1"); festeggia("grande", "Platino!", "6 mesi da Argento: il percorso è completo"); }
  if(!st.profilo.prossima_qualifica){ st.platinoNuovo = true; st.sheet = "prossima"; }
  render();
}
function vReportDaImportare(){
  const elenco = mesiDaImportare();
  if(!elenco.length || elenco.every(x => x.fatto)) return "";
  return `<div class="card report-da-importare">
    <span class="eyebrow">Report da importare</span>
    <p class="small" style="margin:6px 0 0">Per contare i tuoi mesi da Argento importa il report mappe di ogni mese
      (sul sito Amway scegli il mese, poi scarica il CSV come sempre).</p>
    <ul class="mesi-report">${elenco.map(x => `<li class="${x.fatto ? "ok" : ""}"><span class="mark">${x.fatto ? "✓" : "○"}</span>${esc(nomeMese(x.mese))}</li>`).join("")}</ul>
    ${btnAmway("Importa da Amway", "wide", "margin-top:10px")}
  </div>`;
}

function barra(nome, fatto, obj){
  obj = Number(obj) || 0;
  const pct = obj ? Math.min(100, Math.round(fatto / obj * 100)) : 0;
  return `<div class="obiettivo"><div class="spread"><span>${nome}</span>
    <span class="num">${num(fatto)} <span class="faint">/ ${num(obj)}</span></span></div>
    <div class="bar ${obj && fatto >= obj ? "fatto" : ""}" role="progressbar" aria-label="${nome}" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div></div>`;
}

/* VP del mese (034): in verde la parte del report Amway, in rame i miei ordini scritti dopo (li vedo solo io) */
function barraVp(m){
  const rep = vpReport(m);
  if(rep == null) return barra("VP personali", vpMese(m), st.goalMese.obiettivo_vp);
  const fatto = vpMese(m), obj = Number(st.goalMese.obiettivo_vp) || 0;
  /* oltre l'obiettivo la barra si divide in proporzione al totale, così la parte scritta dopo il report si vede sempre */
  const scala = Math.max(obj, fatto);
  const w = v => scala ? Math.min(100, Math.round(v / scala * 100)) : 0, wRep = w(Math.max(0, Math.min(rep, fatto)));
  const pct = obj ? Math.min(100, Math.round(fatto / obj * 100)) : 0, piena = w(fatto);
  return `<div class="obiettivo"><div class="spread"><span>VP personali</span>
    <span class="num">${num(fatto)} <span class="faint">/ ${num(obj)}</span></span></div>
    <div class="bar doppia ${obj && fatto >= obj ? "fatto" : ""}" role="progressbar" aria-label="VP personali" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i class="rep" style="width:${wRep}%"></i><i style="width:${Math.max(0, piena - wRep)}%"></i></div></div>`;
}
function rigaVp(m){
  const rep = vpReport(m), r = reportMio(m), dopo = vpMese(m) - (rep || 0);
  if(rep == null) return vpMese(m) ? `<p class="small vp-report" style="margin:4px 0 0">I VP scritti da te: li vedi solo tu.
    Sponsor e upline vedono i tuoi numeri quando arriva il report Amway.</p>` : "";
  return `<p class="small vp-report" style="margin:4px 0 0">${num(rep)} VP dal report del ${esc(fmtDataOra.format(new Date(r.dati_al)))}${dopo
    ? ` · ${dopo > 0 ? "+" : "−"} ${num(Math.abs(dopo))} VP dei tuoi ordini scritti dopo: li vedi solo tu.` : "."}</p>`;
}

/* Storico: i mesi chiusi (congelati il giorno 5) e quelli ancora aperti, dal più recente */
function vStorico(){
  const nome = chiave => { const t = st.stages.find(x => x.chiave === chiave); return t ? t.nome : ""; };
  const righe = st.storico.map(r => ({ mese:meseDi(r.mese), personali:Number(r.vp_personali), gruppo:Number(r.vp_gruppo),
    attive:r.linee_attive, pct:r.percentuale, qual:nome(r.qualifica), aperto:false }));
  const aperti = [meseDi(oggi())].concat(precedenteAperto() && !righe.some(r => r.mese === mesePrecedente()) ? [mesePrecedente()] : []);
  for(const m of aperti){
    const n = numeriMese(m);
    /* la qualifica del mese si calcola fino ad Argento (le annuali si contano sull'anno fiscale, qui sotto) */
    const q = st.stages.filter(t => t.ordine >= 3 && t.ordine <= ordineDi("argento") && !mancanze(t, n).length).pop();
    righe.push({ mese:m, personali:n.personali, gruppo:n.gruppo, attive:n.attive, pct:n.percentuale, qual:q ? q.nome : "", aperto:true });
  }
  /* se nell'anno fiscale, fino a quel mese, è già raggiunta una qualifica annuale (Oro, Platino, …), vale quella */
  for(const r of righe){ const a = qualificaPY(r.mese); if(a) r.qual = nome(a); }
  righe.sort((a, b) => a.mese < b.mese ? 1 : -1);
  return `<h2>Il mio storico</h2>
    <p class="small">Ogni mese si chiude il giorno ${giornoChiusura()} del mese dopo: da lì i numeri restano quelli.</p>
    <ul class="storico">${righe.map(r => `<li>
      <div class="spread"><b>${nomeMese(r.mese).replace(/^./, c => c.toUpperCase())}</b>
        <span class="pill ${r.aperto ? "g" : ""}">${r.aperto ? "in corso" : "chiuso"}</span></div>
      <div class="dati">
        <span>VP personali <b class="num">${num(r.personali)}</b></span>
        <span>VP di gruppo <b class="num">${num(r.gruppo)}</b></span>
        <span>Linee attive <b class="num">${r.attive}</b></span>
        <span>Percentuale <b class="num">${r.pct ? r.pct + "%" : "–"}</b></span>
      </div>
      ${r.qual ? `<p class="small" style="margin:4px 0 0">Qualifica: <b>${esc(r.qual)}</b></p>` : ""}</li>`).join("")}</ul>
    <button class="btn wide ghost" style="margin-top:12px" data-act="chiudi">Chiudi</button>`;
}

/* ---- Storico del gruppo: i mesi chiusi; toccando un mese, il dettaglio per persona ---- */
function meseAvanti(m, n){ const [y, mm] = m.split("-").map(Number), d = new Date(Date.UTC(y, mm - 1 + n, 1)); return d.toISOString().slice(0, 7); }
function vStoricoGruppo(){
  if(!figli(st.profilo.id).length) return "";
  const righe = st.storico.map(r => ({ mese:meseDi(r.mese), gruppo:Number(r.vp_gruppo) || 0, attive:r.linee_attive || 0, pct:r.percentuale }))
    .sort((a, b) => a.mese < b.mese ? 1 : -1).slice(0, 12);
  const prossima = meseAvanti(meseDi(oggi()), precedenteAperto() ? 0 : 1) + "-" + String(giornoChiusura()).padStart(2, "0");
  return `<div class="card">
    <span class="con-aiuto"><span class="eyebrow">Storico del gruppo</span>${righe.length ? aiutoBtn("storico-gruppo") : ""}</span>
    ${aiutoTesto("storico-gruppo", `Ogni riga è un mese chiuso (si chiude il ${giornoChiusura()} del mese dopo) con i totali del tuo gruppo.
      Tocca un mese per vedere i numeri di ogni persona.`)}
    ${righe.length ? `<table class="confronto mesi">
      <thead><tr><th></th><th>VP di gruppo</th><th>Linee</th><th>%</th></tr></thead>
      <tbody>${righe.map(r => `<tr data-act="mese-gruppo" data-mese="${r.mese}"><td><button class="btn link" data-act="mese-gruppo" data-mese="${r.mese}">${nomeMese(r.mese).replace(/^./, c => c.toUpperCase())}</button></td>
        <td class="num">${num(r.gruppo)}</td><td class="num">${r.attive}</td><td class="num">${r.pct ? r.pct + "%" : "–"}</td></tr>`).join("")}</tbody>
    </table>`
    : `<p class="muted" style="margin:8px 0 0">Ancora nessun mese chiuso: il primo si chiude il ${dataIt(prossima)}.</p>`}
  </div>`;
}
function vMeseGruppo(){
  const g = st.meseGruppo;
  if(!g) return "";
  const titolo = `<h2>${nomeMese(g.mese).replace(/^./, c => c.toUpperCase())}</h2>`;
  const chiudi = `<button class="btn wide ghost" style="margin-top:12px" data-act="chiudi">Chiudi</button>`;
  if(g.errore) return `${titolo}<p class="errore">${esc(g.errore)}</p>${chiudi}`;
  if(!g.righe) return `${titolo}<p class="muted">Carico i numeri…</p>${chiudi}`;
  const prima = new Map((g.prima || []).map(r => [r.partner_id, r]));
  const nomeQ = chiave => { const t = st.stages.find(x => x.chiave === chiave); return t ? t.nome : ""; };
  const persone = g.righe.filter(r => r.partner_id !== st.profilo.id && nomeDi(r.partner_id))
    .sort((a, b) => Number(b.vp_gruppo) - Number(a.vp_gruppo) || nomeDi(a.partner_id).localeCompare(nomeDi(b.partner_id)));
  const freccia = (v, rif) => rif != null && Number(v) < Number(rif) ? `<b class="num sotto">▼ ${num(v)}</b>` : `<b class="num">${num(v)}</b>`;
  return `${titolo}
    <p class="small">Ogni persona del gruppo in ${nomeMese(g.mese)}. ▼ in rosso: sotto il mese prima.</p>
    ${persone.length ? `<ul class="storico">${persone.map(r => { const p = prima.get(r.partner_id) || {}; return `<li>
      <div class="spread"><b>${esc(nomeDi(r.partner_id))}</b>${r.percentuale ? `<span class="pill">${r.percentuale}%</span>` : ""}</div>
      <div class="dati">
        <span>VP personali ${freccia(r.vp_personali, p.vp_personali)}</span>
        <span>VP di gruppo ${freccia(r.vp_gruppo, p.vp_gruppo)}</span>
        <span>Linee attive ${freccia(r.linee_attive || 0, p.linee_attive)}</span>
        <span>${MESI[Number(meseAvanti(g.mese, -1).slice(5)) - 1].replace(/^./, c => c.toUpperCase())} <b class="num faint">${p.vp_gruppo != null ? num(p.vp_gruppo) + " VP" : "–"}</b></span>
      </div>
      ${r.qualifica ? `<p class="small" style="margin:4px 0 0">Qualifica: <b>${esc(nomeQ(r.qualifica))}</b></p>` : ""}</li>`; }).join("")}</ul>`
      : `<p class="muted">Nessuno nel gruppo quel mese.</p>`}
    ${chiudi}`;
}

const ETICHETTE = { contatto:"Contatto", piano:"Piano mostrato", ordine:"Ordine", cliente:"Nuovo cliente", rettifica:"Totale del mese aggiornato" };
function vpFirmati(v){ return (v > 0 ? "+" : "") + num(v); }
/* l'attività contata da un passo della lista: il nome della persona (solo nella mia pagina Io) */
function nomeDiAttivita(a){
  const s = (st.passi || []).find(x => x.attivita_id && x.attivita_id === a.id), p = s && (st.persone || []).find(x => x.id === s.persona_id);
  return p ? p.nome : "";
}
/* Diario di oggi: chiuso di base, si apre toccandolo (resta aperto finché non lo richiudi) */
function vOggi(){
  const l = st.att.filter(a => a.data === oggi()).slice().reverse(), aperto = !!st.diarioAperto;
  return `<div class="card diario">
    <button class="riga-apri prima" data-act="apri-diario" aria-expanded="${aperto}"><span class="grow"><span class="eyebrow">Diario di oggi · ${l.length}</span>
      <span class="small">${dataIt(oggi())}</span></span><span class="fr" aria-hidden="true">${aperto ? "▴" : "▾"}</span></button>
    ${!aperto ? "" : l.length ? `<ul class="oggi">${l.map(a => `<li>
      <span class="grow">${ETICHETTE[a.tipo]}${nomeDiAttivita(a) ? `: <b>${esc(nomeDiAttivita(a))}</b>` : ""}${a.tipo === "ordine" ? ` · <b>${num(a.vp)} VP</b>` : a.tipo === "rettifica" ? ` · <b>${vpFirmati(a.vp)} VP</b>` : a.quantita > 1 ? ` × ${a.quantita}` : ""}</span>
      <span class="small">${a.inserito_il ? fmtOra.format(new Date(a.inserito_il)) : ""}</span>
      ${String(a.id).startsWith("tmp") ? "" : `<button class="x" data-act="elimina" data-id="${esc(a.id)}" aria-label="Elimina">×</button>`}</li>`).join("")}</ul>`
      : `<p class="muted" style="margin:8px 0 0">Ancora niente oggi. Un contatto, un piano, un ordine: si registra con un tocco qui sotto.</p>`}
  </div>`;
}

/* ---- La mia struttura: l'albero del mio gruppo ---- */
function figli(id){ return st.struttura.filter(p => p.sponsor_id === id); }
/* [{ p, livello }] in ordine di albero, me escluso */
function alberoSotto(id, livello, out){
  out = out || [];
  for(const p of figli(id)){ out.push({ p, livello }); alberoSotto(p.id, livello + 1, out); }
  return out;
}
/* attivo / rallenta / fermo: giorni dall'ultimo aggiornamento fatto dal partner stesso (7 e 14) */
function statoDi(p){
  if(p.stato === "gestito") return { txt:"senza app", cl:"" };
  const g = giorniTra(String(p.ultimo_aggiornamento || p.creato_il || oggi()).slice(0, 10), oggi());
  return g <= 7 ? { txt:"attivo", cl:"v", g } : g <= 14 ? { txt:"rallenta", cl:"g", g } : { txt:"fermo", cl:"r", g };
}
/* Dove sta una persona nella mia struttura: livello del report, sponsor e quante persone ha sotto */
function posizioni(){
  const m = new Map(), perId = new Map(st.struttura.map(p => [p.id, p]));
  for(const { p, livello } of alberoSotto(st.profilo.id, 0))
    m.set(p.id, { livello:livello + 2, sponsor:p.sponsor_id === st.profilo.id ? "te" : nomeDi(p.sponsor_id), sotto:0 });
  for(const id of m.keys()){
    let s = (perId.get(id) || {}).sponsor_id;
    for(let n = 0; s && m.has(s) && n < 200; n++){ m.get(s).sotto++; s = (perId.get(s) || {}).sponsor_id; }
  }
  return m;
}
function testoPosizione(x){
  return x ? `Livello ${x.livello} · sotto ${esc(x.sponsor)}${x.sotto ? ` · ${plur(x.sotto, "persona sotto", "persone sotto")}` : ""}` : "";
}
/* Chi usa l'app nel mio gruppo ma non è ancora nella mappa Amway: solo il nome, nessun dato.
   Lo può togliere solo il suo sponsor diretto (o un admin). */
function vInAttesa(){
  const l = st.inAttesa || [];
  if(!l.length) return "";
  return `<div class="card in-attesa">
    <span class="con-aiuto"><span class="eyebrow">In attesa della mappa · ${l.length}</span>${aiutoBtn("in-attesa")}</span>
    ${aiutoTesto("in-attesa", `Persone entrate nell'app con un link ma che non sono ancora nel report Amway che hai importato. Finché non ci
      sono, i loro numeri restano solo nella loro app e non contano nel tuo gruppo. Entrano al loro posto con il primo import
      che le contiene.`)}
    <ul class="oggi">${l.map(x => `<li><span class="grow"><b>${esc(x.nome)}</b><br>
      <span class="small">${x.mio ? "invitata da te" : `sponsor indicato: ${esc(x.sponsor_nome || "–")}`}</span></span>
      ${x.mio || st.profilo.is_admin ? `<button class="btn small" data-act="togli-attesa" data-id="${esc(x.id)}">Togli</button>` : ""}</li>`).join("")}</ul>
  </div>`;
}
/* io in attesa: avviso in Io */
function vAttesaIo(){
  const p = st.profilo;
  if(!p || p.is_admin || p.confermato_il) return "";
  return `<div class="card tight avviso-attesa">
    <span class="eyebrow">In attesa della mappa</span>
    <p class="small" style="margin:6px 0 0">Non sei ancora in un report mappe importato. Puoi usare l'app (obiettivi, lista, clienti,
      ordini), ma i tuoi dati restano solo tuoi finché la mappa Amway non ti mostra: al primo import della tua upline entri nella struttura.</p>
  </div>`;
}
function vStruttura(){
  /* Come nei report Amway: in cima chi usa l'app (livello 1), poi i suoi frontali (2), i loro (3) e così via;
     il gruppo di una persona si può richiudere. Tutte le righe sono nella pagina: quelle dei gruppi richiusi
     sono solo nascoste, così la ricerca le trova. */
  const io = st.profilo.id;
  const tutte = alberoSotto(io, 0), sopra = [io];
  for(const r of tutte){ sopra.length = r.livello + 1; r.path = sopra.slice(); sopra.push(r.p.id); }
  /* una persona nascosta sparisce da sola (solo per me): chi sta sotto di lei resta, sotto il primo sponsor
     visibile. Il numero resta il livello vero del report; il rientro e il percorso seguono le righe visibili. */
  const nascoste = [...st.nascosti].filter(id => nomeDi(id)).length;
  /* "Mostra anche le nascoste": l'albero completo come nel report, le nascoste in grigio al loro posto */
  const completa = st.conNascoste && nascoste;
  const righe = completa ? tutte : tutte.filter(r => !st.nascosti.has(r.p.id));
  if(!completa) for(const r of righe) r.path = r.path.filter(id => !st.nascosti.has(id));
  const rIo = rigaDi(st.riep, io) || {}, chiusoIo = st.chiusi.has(io);
  const rigaIo = `<li class="liv io" style="--rientro:0px" data-id="${esc(io)}" data-path="" data-nome="${esc(senzaAccenti(st.profilo.nome))}">
      <span class="livello l0" title="Livello 1">1</span>
      <div class="nome"><span>${esc(st.profilo.nome)}</span>
        <span class="small">${num(rIo.vp_personali)} VP · gruppo ${num(rIo.vp_gruppo)}${rIo.linee_attive ? ` · ${rIo.linee_attive} ${rIo.linee_attive === 1 ? "linea" : "linee"}` : ""}</span></div>
      <button class="piega" data-act="piega" data-id="${esc(io)}" data-quanti="${righe.length}" aria-expanded="${!chiusoIo}"
        aria-label="${chiusoIo ? "Mostra" : "Nascondi"} il tuo gruppo">${chiusoIo ? "▸" : "▾"} ${righe.length}</button></li>`;
  return `<div class="card">
    <div class="spread"><span class="con-aiuto"><span class="eyebrow">La mia struttura</span>${tutte.length ? aiutoBtn("struttura") : ""}</span>
      ${btnAmway("Importa da Amway", "small")}</div>
    ${tutte.length ? aiutoTesto("struttura", `Il tuo gruppo come nel report Amway. Il numero a sinistra è il livello: 1 sei tu, 2 chi hai sponsorizzato tu,
      3 chi hanno sponsorizzato loro, e così via. ▾ chiude o apre il gruppo di una persona; tocca un nome per aprire la sua
      scheda.${completa ? " In grigio le persone nascoste, al loro posto: Mostra o Nascondi su ogni riga." : ""}`) : ""}
    ${righe.length > 1 ? `<input type="search" id="cerca-struttura" class="cerca" placeholder="Cerca un nome nel tuo gruppo…"
        autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Cerca un nome nel tuo gruppo" value="${esc(st.cerca || "")}">
      <p class="small" id="cerca-esito" aria-live="polite" style="margin:6px 0 0"></p>` : ""}
    ${tutte.length ? `<ul class="albero struttura">${rigaIo}${righe.map(({ p, livello, path }) => {
      const r = rigaDi(st.riep, p.id) || {}, sp = statoDi(p);
      const quanti = righe.filter(x => x.path.includes(p.id)).length, chiuso = st.chiusi.has(p.id);
      const piegato = path.some(id => st.chiusi.has(id)), nascosta = st.nascosti.has(p.id);
      return `<li class="liv${piegato ? " piegato" : ""}${nascosta ? " nascosta" : ""}" style="--rientro:${Math.min(path.length, 4) * 10}px"
        data-id="${esc(p.id)}" data-path="${esc(path.join(" "))}" data-nome="${esc(senzaAccenti(p.nome))}">
      <span class="livello l${(livello + 1) % 4}" title="Livello ${livello + 2}">${livello + 2}</span>
      <button class="nome" data-act="apri-scheda" data-id="${esc(p.id)}">
        <span>${esc(p.nome)}</span>
        <span class="small">${num(r.vp_personali)} VP · gruppo ${num(r.vp_gruppo)}${r.linee_attive ? ` · ${r.linee_attive} ${r.linee_attive === 1 ? "linea" : "linee"}` : ""}</span>
      </button>
      ${quanti ? `<button class="piega" data-act="piega" data-id="${esc(p.id)}" data-quanti="${quanti}" aria-expanded="${!chiuso}"
        aria-label="${chiuso ? "Mostra" : "Nascondi"} il gruppo di ${esc(p.nome)}">${chiuso ? "▸" : "▾"} ${quanti}</button>` : ""}
      ${p.fuori_report_dal ? `<span class="pill g" title="Non più nel report Amway">fuori</span>` : ""}
      ${etichetteAccesso(p)}
      ${completa ? (nascosta ? `<button class="btn small" data-act="mostra" data-id="${esc(p.id)}">Mostra</button>`
        : `<button class="btn small ghost" data-act="nascondi-qui" data-id="${esc(p.id)}">Nascondi</button>`)
        : `<span class="pill ${sp.cl}">${sp.txt}</span>`}</li>`; }).join("")}</ul>
      <p class="small" style="margin:6px 0 0">${nascoste ? plur(nascoste, "persona nascosta", "persone nascoste") : "Nessuna persona nascosta"}
        <button class="btn link small" data-act="nascoste" style="min-height:0;padding:0 4px">${nascoste ? "Rivedi" : "Scegli chi nascondere"}</button></p>
      ${nascoste ? `<button class="btn small ghost${completa ? " on" : ""}" data-act="con-nascoste" aria-pressed="${!!completa}" style="margin-top:8px">
        ${completa ? "Torna alla mia struttura" : "Mostra anche le nascoste"}</button>` : ""}`
      : `<p class="muted" style="margin:8px 0 0">Ancora nessuno nel tuo gruppo. Invita chi vuole usare l'app con il link qui sotto,
          oppure importa il report Amway per vedere anche chi non la usa.</p>`}
  </div>`;
}

/* ---- Blocco 3: imbuto del gruppo ed etichette (ultime 4 settimane) ---- */
const SOGLIE_BASE = { giorni_da_chiamare:7, quota_contatti:0.5, piani_per_contatti:0.2, piani_min_followup:2,
                      quota_vp_followup:0.5, ordini_per_piani:0.3 };
function soglieEtichette(){ return Object.assign({}, SOGLIE_BASE, cfg("soglie_etichette") || {}); }
function inizio4(){ return piuGiorni(oggi(), -27); }
const ETICHETTE_GRUPPO = {
  chiamare: { nome:"Non aggiorna", cl:"r", ordine:1 },
  lista:    { nome:"Contatti sotto soglia", cl:"g", ordine:2 },
  invito:   { nome:"Piani sotto soglia", cl:"g", ordine:3 },
  followup: { nome:"VP sotto soglia", cl:"g", ordine:4 },
  crescita: { nome:"In crescita", cl:"v", ordine:5 }
};
/* 034: di chi usa l'app (non io) sponsor e upline vedono solo i VP del report Amway, mai gli ordini scritti a mano */
function soloReport(pid){ const p = st.struttura.find(x => x.id === pid); return pid !== st.profilo.id && !!p && p.stato !== "gestito"; }
/* I numeri di una persona nelle ultime 4 settimane (i VP di chi usa l'app: quelli del report del mese) */
function numeri4(pid){
  const dal = inizio4();
  const l = st.gruppo4.att.filter(a => a.partner_id === pid && a.data >= dal);
  const q = tipo => somma(l.filter(a => a.tipo === tipo), "quantita");
  const ultima = l.reduce((m, a) => a.data > m ? a.data : m, "");
  return { contatti:q("contatto"), piani:q("piano"), ordini:q("ordine"),
           vp:soloReport(pid) ? Number((rigaDi(st.riep, pid) || {}).vp_personali) || 0
             : somma(l.filter(a => a.tipo === "ordine" || a.tipo === "rettifica"), "vp"), ultima };
}
function obiettiviDi(pid){
  const pr = proposta();
  const g = st.gruppo4.goals.filter(x => x.partner_id === pid).sort((a, b) => a.settimana < b.settimana ? 1 : -1)[0];
  const m = st.gruppo4.mgoals.filter(x => x.partner_id === pid).sort((a, b) => a.mese < b.mese ? 1 : -1)[0];
  return { contatti: g ? Number(g.obiettivo_contatti) : pr.contatti, piani: g ? Number(g.obiettivo_piani) : Number(pr.piani) || 3,
           vp: m ? Number(m.obiettivo_vp) : Number(pr.vp_mese) || 100 };
}
/* L'etichetta dice chi ha bisogno di te adesso e che tipo di aiuto serve */
function etichettaDi(p){
  const s = soglieEtichette(), n = numeri4(p.id), o = obiettiviDi(p.id);
  const rif = String(p.ultimo_aggiornamento || p.creato_il || "").slice(0, 10);
  const giorni = rif ? giorniTra(rif, oggi()) : 99;
  const minContatti = Math.ceil(o.contatti * 4 * s.quota_contatti);
  let k, perche;
  if(giorni > s.giorni_da_chiamare){
    k = "chiamare"; perche = `ultimo aggiornamento ${plur(giorni, "giorno", "giorni")} fa`;
  } else if(n.contatti < minContatti){
    k = "lista"; perche = `${plur(n.contatti, "contatto", "contatti")} in 4 settimane (obiettivo ${o.contatti} a settimana)`;
  } else if(n.piani < n.contatti * s.piani_per_contatti){
    k = "invito"; perche = `${plur(n.contatti, "contatto", "contatti")}, ${plur(n.piani, "piano", "piani")}: 1 piano ogni ${Math.round(n.contatti / Math.max(n.piani, 1))} contatti`;
  } else if(n.piani >= s.piani_min_followup && n.vp < o.vp * s.quota_vp_followup){
    k = "followup"; perche = `${plur(n.piani, "piano", "piani")} mostrati, ${num(n.vp)} VP su ${num(o.vp)} di obiettivo`;
  } else {
    k = "crescita"; perche = `${plur(n.contatti, "contatto", "contatti")}, ${plur(n.piani, "piano", "piani")}, ${num(n.vp)} VP`;
  }
  return Object.assign({ k, perche, giorni, n }, ETICHETTE_GRUPPO[k]);
}
/* chi è senza app non ha etichetta: i suoi numeri dipendono da quando lo sponsor li inserisce */
/* ---- Preferiti: le persone da seguire da vicino, con i loro numeri rispetto ai loro obiettivi ---- */
function vPreferiti(){
  const l = alberoSotto(st.profilo.id, 0).map(x => x.p).filter(p => st.preferiti.has(p.id));
  const vuoto = `<p class="small" style="margin:6px 0 0">Segna le persone che vuoi seguire da vicino: apri la loro scheda e tocca
    <b>☆</b> accanto al nome. Qui vedi i loro numeri delle ultime 4 settimane rispetto ai loro obiettivi.</p>`;
  if(!l.length) return `<div class="card"><span class="eyebrow">Preferiti</span>${vuoto}</div>`;
  const schede = l.map(p => {
    const n = numeri4(p.id), o = obiettiviDi(p.id), sp = statoDi(p), r = rigaDi(st.riep, p.id) || {};
    const e = p.stato === "gestito" ? null : etichettaDi(p);
    const vp = Number(r.vp_personali) || 0;
    /* la riga dove sta sotto la soglia è evidenziata, come le etichette (solo per chi usa l'app) */
    const debole = e ? { lista:"contatti", invito:"piani", followup:"vp" }[e.k] : null;
    const righe = [
      { k:"contatti", nome:"Contatti", v:n.contatti, ob:o.contatti * 4, nota:"4 settimane" },
      { k:"piani", nome:"Piani", v:n.piani, ob:o.piani * 4, nota:"4 settimane" },
      { k:"vp", nome:"VP del mese", v:vp, ob:o.vp, nota:nomeMese(meseDi(oggi())).split(" ")[0] }
    ];
    return { p, e, ordine: e ? e.ordine : 9, html:`<li class="preferito">
      <div class="spread"><button class="nome" data-act="apri-scheda" data-id="${esc(p.id)}"><span>${esc(p.nome)}</span>
        <span class="small">${p.stato === "gestito" ? "senza app · numeri inseriti dallo sponsor" : sp.g === 0 ? "ha aggiornato oggi" : `ultimo aggiornamento ${plur(sp.g, "giorno", "giorni")} fa`}</span></button>
        ${e ? `<span class="pill ${e.cl}">${e.nome}</span>` : `<span class="pill ${sp.cl}">${sp.txt}</span>`}</div>
      ${p.stato === "gestito" ? "" : `<p class="small" style="margin:2px 0 0">${rigaObiettivoDi(p.id)}</p>`}
      ${righe.map(x => `<div class="obiettivo${debole === x.k ? " debole" : ""}"><div class="spread"><span>${x.nome} <span class="small">${x.nota}</span></span>
        <span class="num">${num(x.v)} / ${num(x.ob)}</span></div>
        <div class="bar${x.v >= x.ob ? " fatto" : ""}"><i style="width:${Math.min(100, x.ob ? Math.round(x.v / x.ob * 100) : 0)}%"></i></div></div>`).join("")}
      ${p.stato === "gestito" ? "" : vNumeriLista(chiediNumeriLista(p.id))}
    </li>` };
  }).sort((a, b) => a.ordine - b.ordine || a.p.nome.localeCompare(b.p.nome));
  return `<div class="card">
    <div class="spread"><span class="con-aiuto"><span class="eyebrow">Preferiti</span>${aiutoBtn("preferiti")}</span><span class="small">${l.length === 1 ? "1 persona" : `${l.length} persone`}</span></div>
    ${aiutoTesto("preferiti", `Le persone che segui da vicino (le aggiungi o togli con ★ nella loro scheda). Per ognuna: contatti e piani delle
      ultime 4 settimane rispetto al suo obiettivo, e VP del mese rispetto al suo obiettivo del mese. In colore la parte che
      manca.`)}
    <ul class="preferiti">${schede.map(x => x.html).join("")}</ul>
  </div>`;
}

/* ---- Scheda partner ---- */
function inseritoDa(a, p){
  if(!a.inserito_da || a.inserito_da === p.id) return "";
  if(a.inserito_da === st.profilo.id) return "inserito da te";
  const n = nomeDi(a.inserito_da);
  return n ? `inserito da ${n}` : "inserito dalla sua upline";
}
/* ---- Fissa una chiamata: evento di calendario (.ics) e messaggio WhatsApp neutro ---- */
const GIORNI_SETT = ["domenica","lunedì","martedì","mercoledì","giovedì","venerdì","sabato"];
function quandoIt(d, ora){
  const g = new Date(d + "T00:00:00Z").getUTCDay();
  return `${GIORNI_SETT[g]} ${dataIt(d)} alle ${ora}`;
}
function testoChiamata(nome, d, ora){ return `Ciao ${nomeSaluto(nome)}, ci sentiamo ${quandoIt(d, ora)}?`; }
function icsTesto(t){ return String(t || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n"); }
function icsUtc(dt){ return dt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }
/* L'ora è quella del telefono: chi la fissa e il calendario stanno sullo stesso telefono. */
function creaIcs({ nome, data, ora, minuti, avviso, note }){
  const inizio = new Date(`${data}T${ora}:00`), fine = new Date(inizio.getTime() + minuti * 60000);
  const titolo = `Chiamata con ${nome}`;
  const righe = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//A&S//Growup Team//IT", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}@growup-team`,
    `DTSTAMP:${icsUtc(new Date())}`, `DTSTART:${icsUtc(inizio)}`, `DTEND:${icsUtc(fine)}`,
    `SUMMARY:${icsTesto(titolo)}`].concat(note ? [`DESCRIPTION:${icsTesto(note)}`] : [],
    avviso ? ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsTesto(titolo)}`, `TRIGGER:-PT${avviso}M`, "END:VALARM"] : [],
    ["END:VEVENT", "END:VCALENDAR"]);
  return righe.join("\r\n") + "\r\n";
}
function scaricaIcs(testo, nome){
  const url = URL.createObjectURL(new Blob([testo], { type:"text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = "chiamata-" + String(nome).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36).slice(-5) + ".ics";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
/* Su Android Chrome non lascia aprire da una pagina web la scelta dell'app di calendario: si apre Google Calendar
   con la chiamata già compilata (basta "Salva"); per gli altri calendari c'è il file .ics. */
function suAndroid(){ return /Android/i.test(navigator.userAgent); }
function suIos(){ return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); }
function vaiA(u, nuova){ (window.GROWUP_VAI || (x => { if(nuova) window.open(x, "_blank", "noopener"); else location.href = x; }))(u); }
function googleCalendar({ nome, data, ora, minuti, note }){
  const inizio = new Date(`${data}T${ora}:00`), fine = new Date(inizio.getTime() + minuti * 60000);
  return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(`Chiamata con ${nome}`)
    + "&dates=" + icsUtc(inizio) + "/" + icsUtc(fine) + (note ? "&details=" + encodeURIComponent(note) : "");
}
/* Su iPhone il file si apre direttamente nella schermata "Aggiungi al calendario", senza scaricarlo */
function apriIcs(testo, nome){
  if(!suIos()) return scaricaIcs(testo, nome);
  vaiA(URL.createObjectURL(new Blob([testo], { type:"text/calendar;charset=utf-8" })));
}
function datiChiamata(f){
  return { data:f.data.value, ora:f.ora.value, minuti:Number(f.durata.value) || 30, avviso:f.avviso ? Number(f.avviso.value) || 0 : 30, note:f.note.value.trim() };
}
function erroreChiamata(c){
  if(!c.data || !c.ora) return "Scegli giorno e ora.";
  if(new Date(`${c.data}T${c.ora}:00`).getTime() < Date.now() - 60000) return "Il giorno e l'ora sono già passati.";
  return "";
}

/* Questo mese fino a oggi, il mese prima fino allo stesso giorno e il mese prima intero.
   Solo i dati: in rosso con ▼ dove è sotto il mese prima allo stesso giorno. */
function confrontoMese(pid){
  const m = meseDi(oggi()), mp = mesePrecedente();
  const giorniPrec = Number(piuGiorni(m + "-01", -1).slice(8, 10));
  const stessoGiorno = mp + "-" + String(Math.min(Number(oggi().slice(8, 10)), giorniPrec)).padStart(2, "0");
  const att = st.gruppo4.att.filter(a => a.partner_id === pid);
  const conta = (dal, al) => {
    const l = att.filter(a => a.data >= dal && a.data <= al);
    const q = tipo => somma(l.filter(a => a.tipo === tipo), "quantita");
    return { contatti:q("contatto"), piani:q("piano"), ordini:q("ordine"), clienti:q("cliente"),
             vp:somma(l.filter(a => a.tipo === "ordine" || a.tipo === "rettifica"), "vp") };
  };
  const ora = conta(m + "-01", oggi()), allora = conta(mp + "-01", stessoGiorno), prima = conta(mp + "-01", mp + "-31");
  const r = rigaDi(st.riep, pid) || {}, rp = rigaDi(st.riepPrec, pid) || {};
  return { m, mp, stessoGiorno, righe: [
    { nome:"Contatti", ora:ora.contatti, allora:allora.contatti, prima:prima.contatti },
    { nome:"Piani", ora:ora.piani, allora:allora.piani, prima:prima.piani },
    soloReport(pid) ? null : { nome:"Ordini", ora:ora.ordini, allora:allora.ordini, prima:prima.ordini },
    { nome:"Nuovi clienti", ora:ora.clienti, allora:allora.clienti, prima:prima.clienti },
    soloReport(pid)
      ? { nome:"VP personali", ora:Number(r.vp_personali) || 0, allora:null, prima:Number(rp.vp_personali) || 0 }
      : { nome:"VP personali", ora:ora.vp, allora:allora.vp, prima: rp.vp_personali != null ? Number(rp.vp_personali) : prima.vp },
    { nome:"VP di gruppo", ora:Number(r.vp_gruppo) || 0, allora:null, prima:Number(rp.vp_gruppo) || 0 },
    { nome:"Linee attive", ora:Number(r.linee_attive) || 0, allora:null, prima:Number(rp.linee_attive) || 0 }
  ].filter(Boolean)};
}
function vConfronto(p){
  const c = confrontoMese(p.id);
  const breve = m => MESI[Number(m.slice(5, 7)) - 1].slice(0, 3);
  const cella = (v, rif) => rif != null && v < rif ? `<td class="num sotto">▼ ${num(v)}</td>` : `<td class="num">${num(v)}</td>`;
  return `<div class="card">
    <span class="con-aiuto"><span class="eyebrow">Questo mese e il mese prima</span>${aiutoBtn("confronto")}</span>
    ${aiutoTesto("confronto", `Questo mese fino a oggi, confrontato con lo stesso giorno del mese prima. ▼ in rosso: è sotto il mese prima.
      L'ultima colonna è il totale di tutto il mese prima.${soloReport(p.id) ? " I VP sono quelli del report Amway." : ""}`)}
    <table class="confronto">
      <thead><tr><th></th><th>${breve(c.m)}<br><span>fino a oggi</span></th><th>${breve(c.mp)}<br><span>al ${Number(c.stessoGiorno.slice(8))}</span></th><th>${breve(c.mp)}<br><span>totale</span></th></tr></thead>
      <tbody>${c.righe.map(x => `<tr><td>${x.nome}</td>${cella(x.ora, x.allora)}
        <td class="num faint">${x.allora == null ? "–" : num(x.allora)}</td><td class="num faint">${num(x.prima)}</td></tr>`).join("")}</tbody>
    </table>
  </div>`;
}
function vScheda(){
  const p = st.struttura.find(x => x.id === st.schedaId);
  if(!p) return `<p class="muted">Partner non trovato.</p>`;
  const r = rigaDi(st.riep, p.id) || {}, sp = statoDi(p);
  const sponsor = p.sponsor_id === st.profilo.id ? "te" : nomeDi(p.sponsor_id);
  const gestito = p.stato === "gestito";
  const m = meseDi(oggi());
  const recenti = st.attScheda.slice().sort((a, b) => a.inserito_il < b.inserito_il ? 1 : -1).slice(0, 12);
  const azioni = st.schedaTab === "azioni";   // ottimizzazione 3: la scheda si apre su «Numeri»
  /* scendendo lungo le linee: "‹ Indietro" torna alla scheda di prima, "Il mio gruppo" all'elenco */
  return `${st.schedaPila.length ? `<div class="spread"><button class="btn link" data-act="scheda-indietro" style="padding:0">‹ Indietro</button>
    <button class="btn link" data-act="vista-gruppo" style="padding:0">Il mio gruppo</button></div>`
    : `<button class="btn link" data-act="vista-gruppo" style="padding:0">‹ Il mio gruppo</button>`}
  <div class="card">
    <div class="spread"><h2>${esc(p.nome)}</h2><span class="row" style="gap:8px">
      <button class="stella${st.preferiti.has(p.id) ? " on" : ""}" data-act="preferito" data-id="${esc(p.id)}" aria-pressed="${st.preferiti.has(p.id)}"
        aria-label="${st.preferiti.has(p.id) ? "Togli dai preferiti" : "Aggiungi ai preferiti"}" title="Preferiti">${st.preferiti.has(p.id) ? "★" : "☆"}</button>
      ${etichetteAccesso(p)}<span class="pill ${sp.cl}">${sp.txt}</span></span></div>
    <p class="small" style="margin:2px 0 0">${gestito ? "importata da te dal report Amway: la vedi solo tu, i suoi numeri li aggiorni tu"
      : sp.g === 0 ? "ha aggiornato oggi" : `ultimo aggiornamento ${plur(sp.g, "giorno", "giorni")} fa`}</p>
    <div class="schede-scheda" role="tablist" aria-label="Scheda">
      <button role="tab" class="${azioni ? "" : "on"}" aria-selected="${!azioni}" data-act="scheda-tab" data-tab="numeri">Numeri</button>
      <button role="tab" class="${azioni ? "on" : ""}" aria-selected="${azioni}" data-act="scheda-tab" data-tab="azioni">Azioni</button></div>
  </div>
  ${azioni ? "" : `<div class="card">
    ${p.stato === "gestito" ? "" : `<p class="small" style="margin:0">${rigaObiettivoDi(p.id)}</p>`}
    ${vRubino(p.id)}
    ${vMesiArgentoScheda(p)}
    <p class="small" style="margin:6px 0 0">${p.codice_amway ? `Codice Amway <b>${esc(p.codice_amway)}</b>` : "Codice Amway non scritto"}
      ${st.profilo.is_admin && !gestito ? soloAdmin(`<button class="btn link small" data-act="codice" data-id="${esc(p.id)}" style="min-height:0;padding:0 4px">Correggi</button>`) : ""}</p>
    <div class="dati-scheda">
      <div><span class="small">VP personali</span><b class="num">${num(r.vp_personali)}</b></div>
      <div><span class="small">VP di gruppo</span><b class="num">${num(r.vp_gruppo)}</b></div>
      <div><span class="small">Linee attive</span><b class="num">${r.linee_attive || 0}</b></div>
      <div><span class="small">Percentuale</span><b class="num">${r.percentuale ? r.percentuale + "%" : "–"}</b></div>
    </div>
    ${r.da_report ? `<p class="nota" style="margin:6px 0 0">VP di gruppo, linee e percentuale dal report Amway${r.linee_nascoste
      ? ". Linee non visibili nel report (il suo gruppo Amway non lo mostra): la qualifica non può contarle" : ""}.</p>` : ""}
    ${(() => { const l = lineeDi(p.id, r);
      /* le linee frontali: chi è nella mia struttura si apre toccando il nome */
      return l.length ? `<p class="small" style="margin:12px 0 0"><b>Le sue linee frontali</b> · VP di gruppo di ogni linea${r.da_report ? ", dal report Amway" : ""}</p>
      <ul class="linee">${l.map(x => { const apri = x.id && x.id !== p.id && st.struttura.some(y => y.id === x.id);
        return `<li>${apri ? `<button class="grow nome-linea" data-act="apri-scheda" data-id="${esc(x.id)}">${esc(x.nome)} ›</button>` : `<span class="grow">${esc(x.nome)}</span>`}
      <span class="num ${x.vp >= soglia() ? "" : "faint"}">${num(x.vp)} VP</span></li>`; }).join("")}</ul>` : ""; })()}
    <p class="small" style="margin:10px 0 0">Punto di partenza dichiarato: <b>${esc(testoPartenza(p))}</b></p>
    ${gestito ? "" : vNumeriLista(p.id)}
  </div>
  ${vComeArrivarci(p.id, "lui")}
  ${vConfronto(p)}
  <button class="btn wide" style="margin-top:4px" data-act="apri-analisi" data-id="${esc(p.id)}">Analisi di ${esc(nomeSaluto(p.nome))} ›</button>
  ${vSeguimiScheda(p)}`}
  ${!azioni ? "" : `<button class="btn wide primary" style="margin:4px 0 12px" data-act="chiamata" data-id="${esc(p.id)}">Fissa una chiamata</button>
  ${gestito ? `<div class="card">
    <span class="con-aiuto"><span class="eyebrow">I suoi numeri · ${nomeMese(m)}</span>${aiutoBtn("gestito")}</span>
    ${aiutoTesto("gestito", `Questa persona non usa l'app: i suoi numeri li scrivi tu con i pulsanti qui sotto. Se vuole usarla, mandale il
      tuo link d'invito: entrando con il suo codice Amway ritrova il suo profilo e da lì i numeri li aggiorna lei.`)}
    <div class="griglia-azioni">
      <button class="btn" data-act="contatto">+ Contatto</button>
      <button class="btn" data-act="piano">+ Piano</button>
      <button class="btn" data-act="ordine">+ Ordine</button>
      <button class="btn" data-act="totale-mese">Aggiorna il totale</button>
      <button class="btn" data-act="cliente">+ Cliente</button>
    </div>
    ${recenti.length ? `<ul class="oggi">${recenti.map(a => `<li>
      <span class="grow">${ETICHETTE[a.tipo]}${a.vp != null ? ` · <b>${a.tipo === "rettifica" ? vpFirmati(a.vp) : num(a.vp)} VP</b>` : ""}
        <br><span class="small">${dataIt(a.data)}${inseritoDa(a, p) ? " · " + esc(inseritoDa(a, p)) : ""}</span></span>
      ${String(a.id).startsWith("tmp") ? "" : `<button class="x" data-act="elimina" data-id="${esc(a.id)}" aria-label="Elimina">×</button>`}</li>`).join("")}</ul>`
      : `<p class="muted" style="margin:8px 0 0">Ancora niente questo mese.</p>`}
  </div>` : `<div class="card">
    <p class="small" style="margin:0">Usa l'app: i suoi numeri li aggiorna lui.</p>
    ${st.profilo.is_admin ? `<div style="margin-top:12px">${soloAdmin(`<button class="btn wide" data-act="nuovo-link" data-id="${esc(p.id)}">Nuovo link personale</button>`, true)}</div>
      <p class="nota">Solo per chi ha perso il suo link: quello vecchio smette di funzionare e i suoi telefoni vanno ricollegati.</p>` : ""}
  </div>`}
  ${st.profilo.is_admin ? vInvitiAdmin(p) : ""}
  ${vAccessoScheda(p)}
  <div class="card">
    <span class="eyebrow">Struttura</span>
    ${p.fuori_report_dal ? `<p class="small" style="margin:6px 0 0"><span class="pill g">non più nel report</span> da ${nomeMese(meseDi(p.fuori_report_dal))}</p>` : ""}
    ${st.nascosti.has(p.id)
      ? `<button class="btn wide" style="margin-top:10px" data-act="mostra" data-id="${esc(p.id)}">Mostra di nuovo nella mia struttura</button>`
      : `<button class="btn wide" style="margin-top:10px" data-act="nascondi" data-id="${esc(p.id)}">Nascondi dalla mia struttura</button>`}
    <p class="nota">Nascosta sparisce solo per te, e solo lei: chi sta sotto di lei resta visibile. I suoi VP contano lo stesso
      nei numeri personali e di gruppo.
      La rimetti quando vuoi da «Nascoste». Nell'app nessuno si cancella: la struttura rispecchia il report Amway.</p>
  </div>`}`;
}

/* Da confermare: sponsor, upline e admin la possono togliere. Bloccare l'app: solo admin. */
function vAccessoScheda(p){
  const a = accessoDi(p);
  if(!a || p.id === st.profilo.id) return "";
  const togli = daConfermare(p), blocca = st.profilo.is_admin && !a.is_admin;
  if(!togli && !blocca && !a.bloccato_il) return "";
  return `<div class="card">
    <span class="eyebrow">Accesso all'app</span>
    ${togli ? `<p class="small" style="margin:6px 0 0"><span class="pill g">Da confermare</span> il suo codice Amway non è ancora comparso in un
      report mappe importato. Finché non lo è, puoi toglierla dalla struttura.</p>
      <button class="btn wide" style="margin-top:10px" data-act="togli-struttura" data-id="${esc(p.id)}">Togli dalla struttura</button>
      <p class="nota">Si cancellano il suo profilo e tutti i suoi dati, l'app sul suo telefono si blocca e con lo stesso codice Amway non può
        rientrare finché un admin non lo sblocca. Chi ha invitato passa sotto ${p.sponsor_id === st.profilo.id ? "di te" : "il suo sponsor"}.</p>` : ""}
    ${a.bloccato_il ? `<p class="small" style="margin:8px 0 0"><span class="pill r">Bloccato</span> l'app è bloccata dal ${dataIt(String(a.bloccato_il).slice(0, 10))}.</p>` : ""}
    ${blocca ? `<div style="margin-top:10px">${soloAdmin(`<button class="btn wide${a.bloccato_il ? "" : " ghost"}" data-act="blocca-app" data-id="${esc(p.id)}" data-blocca="${a.bloccato_il ? "" : "1"}">${a.bloccato_il ? "Sblocca l'app" : "Blocca l'app"}</button>`, true)}</div>
      <p class="nota">Chi è bloccato non vede più niente; i suoi dati restano e i suoi VP contano. Sponsor e upline vedono "Bloccato".</p>` : ""}
  </div>`;
}

/* Solo admin: far entrare qualcuno sotto una persona precisa (anche nei gruppi dei Platino, che il report non mostra)
   o tra lo sponsor e la persona (link speciale, valido una volta) */
function bottoniLink(link){
  return `<div class="condividi">
      <a class="btn wa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(testoInvito() + "\n\n" + link)}">WhatsApp</a>
      <a class="btn tg" target="_blank" rel="noopener" href="https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(testoInvito())}">Telegram</a>
      <button class="btn" data-act="copia-link" data-link="${esc(link)}">Copia link</button>
    </div>
    <div class="linkbox">${esc(link)}</div>`;
}
function vInvitiAdmin(p){
  return `<div class="card">
    <span class="eyebrow">Inviti · solo admin</span>
    <p class="small" style="margin:4px 0 0"><b>Invita sotto ${esc(nomeSaluto(p.nome))}</b>: chi entra con questo link va nel suo gruppo, sotto di lei.</p>
    ${p.codice_invito ? soloAdmin(bottoniLink(base() + "#" + p.codice_invito), true) : ""}
    <div style="margin-top:12px">${soloAdmin(`<button class="btn wide" data-act="invito-sopra" data-id="${esc(p.id)}">Invita chi manca sopra di ${esc(nomeSaluto(p.nome))}</button>`, true)}</div>
    <p class="nota">Un link valido una volta sola: chi lo apre entra tra ${esc(p.sponsor_id === st.profilo.id ? "voi" : nomeDi(p.sponsor_id) || "il suo sponsor")}
      e ${esc(nomeSaluto(p.nome))}, che passa sotto di lui con il suo gruppo.</p>
  </div>`;
}

/* Il messaggio d'invito: con il nome di chi invita e i tre passi per entrare, salvare il link e installare l'app */
function testoInvito(){
  const n = nomeSaluto(st.profilo && st.profilo.nome), noi = / e /i.test(n);
  return `Ciao! ${n ? `${noi ? "Siamo" : "Sono"} ${n}: ` : ""}${noi ? "ti mandiamo" : "ti mando"} Growup, l'app del nostro gruppo A&S `
       + `per pianificare la settimana e seguire il percorso fino ad Argento.\n\n`
       + `1. Apri il link qui sotto e scrivi nome, codice Amway e qualifica: in un minuto sei dentro, senza registrazione.\n`
       + `2. L'app ti dà il tuo link personale: mandalo a te stesso su WhatsApp e tienilo, è la tua chiave.\n`
       + `3. Installa l'app: su Android menu ⋮ → Installa app; su iPhone Condividi → Aggiungi alla schermata Home.`;
}
function vInvita(){
  return `<div class="card">
    <span class="eyebrow">Invita un nuovo partner</span>
    <p class="small" style="margin:4px 0 0">Chi entra con questo link entra nel tuo gruppo, con te come sponsor. Non è il tuo link personale: questo si può girare.</p>
    <div class="condividi">
      <a class="btn wa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(testoInvito() + "\n\n" + linkInvito())}">WhatsApp</a>
      <a class="btn tg" target="_blank" rel="noopener" href="https://t.me/share/url?url=${encodeURIComponent(linkInvito())}&text=${encodeURIComponent(testoInvito())}">Telegram</a>
      <button class="btn" data-act="copia">Copia link</button>
      ${navigator.share ? `<button class="btn" data-act="condividi">Altro…</button>` : ""}
    </div>
    <div class="linkbox">${esc(linkInvito())}</div>
    <p class="small" style="margin:14px 0 0"><b>Immagini da inviare</b>: mandale prima del link quando presenti l'app,
      o mettile nello stato di WhatsApp.</p>
    <div class="immagini-invito">
      <button data-act="condividi-immagine" data-file="invito-quadrato.png"><img src="invito-quadrato.png" alt="">Immagine</button>
      <button class="stato" data-act="condividi-immagine" data-file="invito-stato.png"><img src="invito-stato.png" alt="">Per lo stato</button>
    </div>
  </div>`;
}

function vAzioni(){
  return `<div class="azioni"><div class="in">
    <button class="btn primary c1" data-act="contatto-rapido">+ Contatto<b>${num(fattoSettimana("contatto"))} questa sett.</b></button>
    <button class="btn primary c2" data-act="piano-rapido">+ Piano<b>${num(fattoSettimana("piano"))} questa sett.</b></button>
    <button class="btn primary c3" data-act="${st.target ? "ordine" : "ordini"}">+ Ordine<b>${num(vpMese(meseDi(oggi())))} VP nel mese</b></button>
  </div></div>`;
}

/* ---- 9b. Import dal report Amway ----
   Ognuno importa il CSV della propria linea (Business Centre → Linea di Sponsorizzazione → Esporta →
   "Intera Linea di Sponsorizzazione con tutti i KPI", senza filtri). Il file si legge qui, sul telefono:
   al database arrivano solo persona e VPP, per me e per le persone senza app che gestisco.
   Chi usa l'app non viene mai toccato. */
function righeCsv(testo){
  const righe = []; let riga = [], campo = "", virg = false;
  testo = String(testo || "").replace(/^﻿/, "");
  for(let i = 0; i < testo.length; i++){
    const c = testo[i];
    if(virg){
      if(c === '"' && testo[i + 1] === '"'){ campo += '"'; i++; }
      else if(c === '"') virg = false;
      else campo += c;
    }else if(c === '"') virg = true;
    else if(c === "," || c === ";"){ riga.push(campo); campo = ""; }
    else if(c === "\n" || c === "\r"){
      if(c === "\r" && testo[i + 1] === "\n") i++;
      riga.push(campo); righe.push(riga); riga = []; campo = "";
    }else campo += c;
  }
  if(campo || riga.length){ riga.push(campo); righe.push(riga); }
  return righe;
}
/* i valori del report hanno spesso un apostrofo davanti; i numeri sono "9.500,00" oppure "20996.38" */
function pulito(v){ return String(v == null ? "" : v).trim().replace(/^'/, "").trim(); }
function numReport(v){
  v = pulito(v).replace(/\s/g, "");
  if(!v) return 0;
  if(v.includes(",")) v = v.replace(/\./g, "").replace(",", ".");
  const n = Number(v);
  return isFinite(n) ? n : NaN;
}
function maiuscole(n){ return n.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (x, a, b) => a + b.toUpperCase()); }
function nomeReport(n){ const [cognome, nome] = pulito(n).split(/,\s*/); return maiuscole(nome ? `${nome} ${cognome}` : cognome); }

function leggiReport(testo){
  const tutte = righeCsv(testo);
  const iMese = tutte.findIndex(r => /mese di competenza/i.test(pulito(r[0])));
  const mm = iMese >= 0 ? pulito(tutte[iMese][1]).match(/^(\d{4})(\d{2})$/) : null;
  const iTesta = tutte.findIndex(r => r.some(x => pulito(x) === "Codice Amway Partner"));
  if(iTesta < 0) return { errore:"Questo file non sembra il report della Linea di Sponsorizzazione di Amway. Scegli il file CSV esportato con «Intera Linea di Sponsorizzazione con tutti i KPI»." };
  if(!mm) return { errore:"Nel file non c'è il mese di competenza: scaricalo di nuovo dal sito Amway." };
  const testa = tutte[iTesta].map(pulito), col = n => testa.indexOf(n);
  const c = { livello:col("Qualifica Amway Partner"), sponsor:col("Codice Amway Partner Sponsor"),
              codice:col("Codice Amway Partner"), nome:col("Nome"), vpp:col("VPP"), vpg:col("VPG"),
              perc:col("Percentuale di bonus"), dimensione:col("Dimensioni gruppo") };
  if(c.codice < 0 || c.nome < 0 || c.vpp < 0) return { errore:"Nel file mancano le colonne del codice, del nome o dei VPP: esporta «con tutti i KPI disponibili»." };
  const righe = [];
  for(const r of tutte.slice(iTesta + 1)){
    const codice = soloCifre(pulito(r[c.codice]));
    if(!codice) continue;
    const vpp = numReport(r[c.vpp]);
    if(!(vpp >= 0)) return { errore:`I VPP di ${nomeReport(r[c.nome])} non sono un numero: scarica di nuovo il file.` };
    const vpg = c.vpg >= 0 ? numReport(r[c.vpg]) : NaN, perc = c.perc >= 0 ? parseInt(soloCifre(pulito(r[c.perc])), 10) : NaN;
    righe.push({ codice, livello:c.livello >= 0 ? Number(pulito(r[c.livello])) || 0 : 0,
      sponsor:c.sponsor >= 0 ? soloCifre(pulito(r[c.sponsor])) : "", nome:nomeReport(r[c.nome]), vpp:Math.round(vpp * 100) / 100,
      vpg:vpg >= 0 ? Math.round(vpg * 100) / 100 : null, perc:isFinite(perc) ? perc : null,
      dimensione:c.dimensione >= 0 ? Number(soloCifre(pulito(r[c.dimensione]))) || 0 : 0 });
  }
  if(!righe.length) return { errore:"Nel file non c'è nessuna persona." };
  return { mese:`${mm[1]}-${mm[2]}`, righe };
}

/* Confronta il report con la struttura dell'app e prepara l'anteprima.
   Nell'app: io, chi usa l'app nel mio gruppo, le persone che ho importato io. */
function analizzaReport(rep){
  const io = st.profilo, m = rep.mese;
  const passato = m < meseDi(oggi()) && !(m === mesePrecedente() && precedenteAperto());
  if(m > meseDi(oggi())) return { errore:`Il report è di ${nomeMese(m)}, un mese che non è ancora iniziato.` };
  if(passato && m < spostaMese(meseDi(oggi()), -24)) return { errore:`Il report è di ${nomeMese(m)}: troppo vecchio, servono solo gli ultimi 12 mesi.` };
  const prima = rep.righe.find(r => r.livello === 1) || rep.righe[0];
  if(io.codice_amway && io.codice_amway !== prima.codice)
    return { errore:`Questo report è di ${prima.nome} (${prima.codice}), ma il tuo codice nell'app è ${io.codice_amway}. `
      + `Ognuno importa il report scaricato dal proprio accesso al sito Amway. Se il report è tuo, il codice nell'app è sbagliato: `
      + (io.is_admin ? "correggilo in fondo alla pagina Io." : "chiedi a Stefano e Alessia di correggerlo.") };
  const perCodice = new Map(rep.righe.map(r => [r.codice, r]));
  /* un mese chiuso: si salvano solo i numeri (21%, VPG, linee) per contare i mesi da Argento */
  if(passato){
    if(!io.codice_amway) return { errore:MESSAGGI_ERRORE.codice_mancante };
    return { passato:true, mese:m, prima, perCodice, totale:rep.righe.length };
  }
  /* 033: anche chi è in attesa della mappa (usa l'app ma non è nella struttura): l'import lo trova e lo conferma */
  const altri = alberoSotto(io.id, 0).map(x => x.p)
    .concat((st.inAttesa || []).filter(x => x.codice_amway).map(x => ({ id:x.id, nome:x.nome, sponsor_id:x.sponsor_id, stato:"attivo", codice_amway:x.codice_amway })));
  const attivi = new Map(altri.filter(p => p.stato !== "gestito" && p.codice_amway).map(p => [p.codice_amway, p]));
  const mie = altri.filter(p => p.stato === "gestito");
  const a = { mese:m, prima, codiceMio:!io.codice_amway, perCodice, aggiorna:[], mancanti:[], usanoApp:[], usanoAppMancanti:[],
              spostati:[], nuovi:[], totale:rep.righe.length };
  const usati = new Set([prima.codice]);
  for(const p of altri.filter(p => p.stato !== "gestito")){
    const r = p.codice_amway ? perCodice.get(p.codice_amway) : null;
    if(r){ a.usanoApp.push({ p, r }); usati.add(r.codice); }
    else if(p.codice_amway) a.usanoAppMancanti.push(p);
  }
  /* le mie persone importate: il codice viene dal report, quindi si abbinano sempre per codice */
  /* chi sta sotto un gruppo che il report non mostra (per esempio un Platino) non è "fuori dal report" */
  const nascostiReport = new Set(rep.righe.filter(r => r.dimensione > 1 && !rep.righe.some(x => x.sponsor === r.codice)).map(r => r.codice));
  const sottoNascosto = p => { for(let s = st.struttura.find(x => x.id === p.sponsor_id), n = 0; s && n < 200; s = st.struttura.find(x => x.id === s.sponsor_id), n++)
    if(s.codice_amway && nascostiReport.has(s.codice_amway)) return true; return false; };
  for(const p of mie){
    const r = p.codice_amway ? perCodice.get(p.codice_amway) : null;
    if(r){ a.aggiorna.push({ p, r }); usati.add(r.codice); }
    else if(p.codice_amway && !p.fuori_report_dal && !sottoNascosto(p)) a.mancanti.push(p);
  }
  /* l'import è sempre completo: tutte le persone del report entrano nella mia struttura */
  for(const r of rep.righe) if(!usati.has(r.codice)) a.nuovi.push(r);
  /* chi usa l'app va sotto il primo antenato del report che usa l'app (o sotto di me) */
  for(const { p, r } of a.usanoApp){
    const sopra = antenatoNelReport(r, perCodice, c => c === prima.codice || attivi.has(c));
    const nuovo = !sopra || sopra === prima.codice ? io.id : attivi.get(sopra).id;
    if(nuovo !== p.sponsor_id && !alberoSotto(p.id, 0).some(x => x.p.id === nuovo))
      a.spostati.push({ p, da:p.sponsor_id === io.id ? "te" : nomeDi(p.sponsor_id) || (altri.find(x => x.id === p.sponsor_id) || {}).nome || "",
        a:nuovo === io.id ? "te" : nomeDi(nuovo) || (altri.find(x => x.id === nuovo) || {}).nome || "" });
  }
  /* reimport: chi è già nella mia struttura (importato o con l'app), per riapplicare i filtri a tutti */
  a.esistenti = a.aggiorna.concat(a.usanoApp);
  /* tante persone che mancano insieme: forse il file è parziale (filtri, "Vista corrente") */
  const conCodice = mie.filter(p => p.codice_amway).length;
  a.troppiMancanti = a.mancanti.length > Math.max(3, Math.round(conCodice * 0.1));
  return a;
}
/* risale la catena degli sponsor del report fino al primo codice che soddisfa la condizione */
function antenatoNelReport(r, perCodice, va){
  const visti = new Set();
  for(let c = r.sponsor; c && !visti.has(c); c = perCodice.has(c) ? perCodice.get(c).sponsor : null){
    if(va(c)) return c;
    visti.add(c);
  }
  return null;
}

function vImporta(){
  const a = st.imp;
  const chiudi = `<button type="button" class="btn ghost wide" style="margin-top:12px" data-act="chiudi">Chiudi</button>`;
  if(!a || a.errore) return `<h2>Importa dal report Amway</h2>
    <p class="small">Sul sito Amway: <b>Linea di Sponsorizzazione (LOS)</b> → pulsante di download →
      <b>Intera Linea di Sponsorizzazione con tutti i KPI disponibili</b>, formato <b>CSV</b>. Prima togli i filtri.</p>
    <p class="small">La struttura dell'app è la mappa Amway, la stessa per tutti: il tuo import aggiorna posizioni e numeri di
      tutto il tuo gruppo (anche di chi usa l'app) e li vede anche la tua upline. Vale il report più aggiornato: conta la data
      del file scaricato. Puoi nascondere chi vuoi (solo per te, resta nei numeri).
      Il file resta sul telefono: si salvano solo nome, codice e numeri.</p>
    <label class="btn primary wide" style="margin-top:12px">Scegli il file CSV
      <input type="file" id="file-report" accept=".csv,text/csv,text/comma-separated-values" multiple hidden></label>
    <p class="nota">Puoi scegliere più file insieme (per esempio i mesi passati): dei mesi chiusi si salvano solo i numeri.</p>
    ${a && a.errore ? `<p class="errore">${esc(a.errore)}</p>` : ""}
    ${chiudi}`;
  if(a.multi) return `<h2>Report di più mesi</h2>
  ${a.passati.length ? `<p class="small">Mesi chiusi: salvo solo i numeri (percentuale, VP di gruppo, linee). La tua struttura e i VP non cambiano.</p>
  <ul class="imp">${a.passati.map(x => `<li><span class="grow">${esc(nomeMese(x.mese))}</span>
    <b class="num">${x.prima.perc != null ? x.prima.perc + "%" : "–"} · ${num(x.prima.vpg)} VPG</b></li>`).join("")}</ul>` : ""}
  ${a.corrente ? `<p class="small">${a.passati.length ? "Poi" : "Ora"} il report di <b>${esc(nomeMese(a.corrente.mese))}</b> (mese in corso): l'import completo, con la sua anteprima.</p>` : ""}
  ${a.errori.length ? `<div class="avviso">${a.errori.map(e => `<p style="margin:2px 0">${esc(e)}</p>`).join("")}</div>` : ""}
  <form data-form="importa" novalidate>
    <div class="row" style="margin-top:16px"><button type="button" class="btn ghost grow" data-act="chiudi">${a.passati.length || a.corrente ? "Annulla" : "Chiudi"}</button>
      ${a.passati.length ? `<button class="btn primary grow"${st.occupato ? " disabled" : ""}>Salva i numeri</button>`
        : a.corrente ? `<button class="btn primary grow">Continua</button>` : ""}</div>
  </form>`;
  if(a.passato) return `<h2>Report di ${nomeMese(a.mese)}</h2>
  ${a.datiAl ? rigaDataReport(a) : ""}
  <p class="small">È un mese chiuso: salvo solo i numeri (percentuale, VP di gruppo, linee) per contare i mesi da Argento.
    La tua struttura e i VP non cambiano.</p>
  <ul class="imp"><li><span class="grow">${esc(st.profilo.nome)} (tu)</span>
    <b class="num">${a.prima.perc != null ? a.prima.perc + "%" : "–"} · ${num(a.prima.vpg)} VPG</b></li></ul>
  <form data-form="importa" novalidate>
    <div class="row" style="margin-top:16px"><button type="button" class="btn ghost grow" data-act="chiudi">Annulla</button>
      <button class="btn primary grow"${st.occupato ? " disabled" : ""}>Salva i numeri</button></div>
  </form>`;
  const riga = (p, extra) => `<span class="grow">${esc(p.nome)}${extra ? `<br><span class="small">${extra}</span>` : ""}</span>`;
  const sezione = (titolo, corpo, nota, cl) => `<div class="imp-sezione${cl ? " " + cl : ""}"><h3>${titolo}</h3>${nota ? `<p class="small">${nota}</p>` : ""}${corpo}</div>`;
  const sponsorDi = r => { const s = a.perCodice.get(r.sponsor); return s ? `sponsor ${esc(s.nome)}` : ""; };
  const scelta = r => `<label data-nome="${esc(senzaAccenti(r.nome) + " " + r.codice)}"><input type="checkbox" name="nascondi" value="${esc(r.codice)}" data-vpp="${r.vpp > 0 ? 1 : 0}"${st.esclusi.has(r.codice) ? " checked" : ""}>
      <span>${esc(r.nome)} · <b>${num(r.vpp)} VP</b><br><span class="small">${esc(r.codice)}${sponsorDi(r) ? " · " + sponsorDi(r) : ""}</span></span></label>`;
  const aggiorna = [{ p:st.profilo, r:a.prima, io:true }].concat(a.aggiorna);
  const pos = posizioni(); [...pos.values()].forEach((x, i) => { x.ordine = i; });
  return `<h2>Report di ${nomeMese(a.mese)}</h2>
  ${a.datiAl ? rigaDataReport(a) : ""}
  <p class="small">${plur(a.totale, "persona", "persone")} nel file. L'import aggiorna la struttura e i numeri di <b>tutto il tuo gruppo</b>,
    anche per chi usa l'app: vale il report più aggiornato.</p>
  <form data-form="importa" novalidate>
    ${a.esistenti.length ? sezione("Chi vuoi vedere dopo l'import?",
      `<label class="check"><input type="radio" name="modo" value="tieni" checked>
        <span><b>Lascia tutto com'è</b>: si aggiornano solo i VP; chi hai nascosto resta nascosto, chi vedi resta visibile.</span></label>
      <label class="check"><input type="radio" name="modo" value="filtri">
        <span><b>Riapplica i filtri a tutti</b>: scegli di nuovo chi nascondere, anche tra chi è già nella tua struttura.</span></label>
      <div class="imp-filtri">
        <div class="row wrap scelte-rapide" style="gap:6px;margin-top:8px">
          <button type="button" class="btn small" data-act="nascondi-zero" aria-pressed="false">Nascondi chi ha 0 VP</button>
          <button type="button" class="btn small" data-act="nascondi-tutti" aria-pressed="false">Nascondi tutti</button>
          <button type="button" class="btn small" data-act="mostra-tutti" aria-pressed="false">Mostra tutti</button></div>
        <p class="small">Valgono per tutti: chi è già nella struttura e i nuovi. Spuntato = nascosto.</p>
        ${a.esistenti.length > 8 ? `<input type="search" class="cerca" data-cerca=".imp-esistenti" placeholder="Cerca per nome o codice…" autocomplete="off" aria-label="Cerca per nome o codice">` : ""}
        <div class="scelte imp-esistenti">${a.esistenti.slice().sort((x, y) => (pos.get(x.p.id) || {}).ordine - (pos.get(y.p.id) || {}).ordine).map(({ p, r }) =>
          `<label data-nome="${esc(senzaAccenti(p.nome) + " " + r.codice)}"><input type="checkbox" name="nascondi-es" value="${esc(p.id)}" data-vpp="${r.vpp > 0 ? 1 : 0}"${st.nascosti.has(p.id) ? " checked" : ""}>
          <span>${esc(p.nome)} · <b>${num(r.vpp)} VP</b><br><span class="small">${testoPosizione(pos.get(p.id))}</span></span></label>`).join("")}</div>
      </div>`) : ""}
    ${a.nuovi.length ? sezione(`Nuovi nel report · ${a.nuovi.length}`,
      `<div class="row wrap scelte-rapide" style="gap:6px;margin-top:8px">
        <button type="button" class="btn small" data-act="nascondi-zero" aria-pressed="false">Nascondi chi ha 0 VP</button>
        <button type="button" class="btn small" data-act="nascondi-tutti" aria-pressed="false">Nascondi tutti</button>
        <button type="button" class="btn small" data-act="mostra-tutti" aria-pressed="false">Mostra tutti</button></div>
      ${a.nuovi.length > 8 ? `<input type="search" class="cerca" data-cerca=".imp-nuovi" placeholder="Cerca per nome o codice…" autocomplete="off" aria-label="Cerca per nome o codice">` : ""}
      <div class="scelte imp-nuovi">${a.nuovi.map(scelta).join("")}</div>
      <label class="check"><input type="checkbox" name="consenso">
        <span>Ho il consenso delle persone della mia linea a inserire il loro nome e i loro numeri nell'app.</span></label>`,
      "Entrano tutti nella tua struttura, nella posizione del report. Spunta chi vuoi <b>nascondere</b>: lo vedi solo nell'elenco «Nascoste» e i suoi VP contano lo stesso.",
      "imp-da-scegliere") : ""}
    ${sezione(`Si aggiornano i numeri · ${aggiorna.length}`, `<ul class="imp">${aggiorna.map(x => `<li>${riga(x.io ? { nome:`${st.profilo.nome} (tu)` } : x.p,
        x.io && a.codiceMio ? `il tuo codice ${esc(x.r.codice)} viene salvato` : "")}<b class="num">${num(x.r.vpp)} VP</b></li>`).join("")}</ul>`)}
    ${a.mancanti.length ? sezione(`Non più nel report · ${a.mancanti.length}`,
      `${a.troppiMancanti ? `<p class="avviso">Mancano molte persone insieme: controlla di aver esportato <b>l'intera linea senza filtri</b>.</p>` : ""}
      <p class="small">${a.mancanti.map(p => `${esc(p.nome)} (${esc(p.codice_amway)})`).join(", ")}</p>`,
      "Codici che Amway non ha più (per esempio non rinnovati). Nessuno si cancella: restano nella tua struttura con il segno «non più nel report» e vanno tra le nascoste. Se tornano nel report, il segno sparisce.") : ""}
    ${a.usanoApp.length || a.usanoAppMancanti.length ? sezione("Usano l'app: posizione e numeri dal report",
      `<p class="small">${plur(a.usanoApp.length, "persona trovata", "persone trovate")} nel report.
        ${a.spostati.length ? `<br>Vanno sotto il loro sponsor del report: ${a.spostati.map(x => `<b>${esc(x.p.nome)}</b> (da ${esc(x.da)} a ${esc(x.a)})`).join(", ")}.` : ""}
        ${a.usanoAppMancanti.length ? `<br>Non sono nel report: ${a.usanoAppMancanti.map(p => esc(p.nome)).join(", ")}.` : ""}</p>`) : ""}
    <div class="row" style="margin-top:16px"><button type="button" class="btn ghost grow" data-act="chiudi">Annulla</button>
      <button class="btn primary grow"${st.occupato ? " disabled" : ""}>Importa</button></div>
  </form>`;
}

function accendiRapida(el){
  document.querySelectorAll(".scelte-rapide .btn").forEach(b => { const on = b === el; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
}
function sceltaRapida(el, spunta){
  const tutti = el.closest(".imp-filtri");
  document.querySelectorAll(tutti ? ".imp-da-scegliere input[name=nascondi], .imp-esistenti input[name=nascondi-es]"
    : ".imp-da-scegliere input[name=nascondi]").forEach(i => { i.checked = spunta(i); });
  accendiRapida(el);
}

/* Più file insieme: i mesi chiusi si salvano solo come numeri, uno dopo l'altro; il mese in corso (al massimo uno)
   resta l'import completo, con la sua anteprima, dopo i mesi chiusi. */
/* ---- «Importa da Amway» (un solo pulsante): si scelgono insieme i file scaricati dal sito Amway e l'app riconosce
   quale è quale. Prima la mappa (Linea di Sponsorizzazione), poi da sola l'import di ordini e clienti. Il file si sceglie
   sempre a mano: una pagina web non può leggere da sola la cartella Download del telefono. ---- */
function tipoFileAmway(testo){
  const righe = righeCsv(testo).slice(0, 40);
  if(righe.some(r => r.some(x => pulito(x) === "Codice Amway Partner"))) return "mappa";
  if(righe.some(r => r.some(x => /codice cliente/i.test(x)))) return "ordini";
  return null;
}
async function smistaFileAmway(files){
  if(!files || !files.length) return;
  const mappe = [], ordini = [], errori = [];
  for(const file of files){
    if(/\.xlsx?$/i.test(file.name)){ errori.push(`${file.name}: è il file Excel, sul sito Amway scegli il formato CSV.`); continue; }
    let tipo = null;
    try{ tipo = tipoFileAmway(await file.text()); }catch(e){}
    if(tipo === "mappa") mappe.push(file);
    else if(tipo === "ordini") ordini.push(file);
    else errori.push(`${file.name}: non sembra un export Amway (mappa, ordini o clienti). Sul sito scegli il formato CSV.`);
  }
  st.erroriAmway = errori;
  if(errori.length && (mappe.length || ordini.length)) toast(errori.join(" · "));
  if(mappe.length){
    st.ordiniInAttesa = ordini.length ? ordini : null;
    st.imp = null; st.errore = ""; st.sheet = "importa"; render();
    return leggiFileReport(mappe);
  }
  if(ordini.length){ st.ordiniInAttesa = null; return apriImportOrdini(ordini); }
  st.sheet = "importa-amway"; render();
}
/* il pulsante «Importa da Amway»: il tocco apre subito la scelta dei file del telefono */
function btnAmway(testo, cls, stile){
  return `<label class="btn ${cls || ""}"${stile ? ` style="${stile}"` : ""}>${testo}<input type="file" class="file-amway"
    accept=".csv,text/csv,text/comma-separated-values" multiple hidden></label>`;
}
function apriImportOrdini(files, dopoMappa){
  st.impOrdini = null; st.errore = ""; st.ordiniDopoMappa = !!dopoMappa; st.sheet = "importa-ordini"; render();
  return leggiFileOrdini(files);
}
/* salvata la mappa: se c'erano anche ordini o clienti, si apre il loro import */
function poiOrdini(){
  const f = st.ordiniInAttesa;
  if(!f) return;
  st.ordiniInAttesa = null;
  apriImportOrdini(f, true);
}
function vImportaAmway(){
  const e = st.erroriAmway || [];
  return `<h2>Importa da Amway</h2>
    <p class="small">Scegli i file CSV che hai scaricato dal sito Amway: la mappa (Intera Linea di Sponsorizzazione con tutti i
      KPI), gli Ordini e i Clienti. Anche tutti insieme: l'app riconosce quale è quale.</p>
    ${e.length ? `<div class="avviso">${e.map(x => `<p style="margin:2px 0">${esc(x)}</p>`).join("")}</div>` : ""}
    ${btnAmway("Scegli i file", "primary wide", "margin-top:12px")}
    <button type="button" class="btn ghost wide" style="margin-top:8px" data-act="chiudi">Chiudi</button>`;
}
async function leggiFileReport(files){
  if(!files || !files.length) return;
  if(files.length === 1) return leggiUnReport(files[0]);
  const m = { multi:true, passati:[], corrente:null, errori:[] };
  try{ st.esclusi = new Set((await api.esclusi() || []).map(x => x.codice)); }catch(e){}
  for(const file of files){
    let a;
    if(/\.xlsx?$/i.test(file.name)) a = { errore:"è il file Excel: sul sito Amway scegli il formato CSV." };
    else try{ const rep = leggiReport(await file.text()); a = rep.errore ? rep : await conData(analizzaReport(rep), file); }
    catch(e){ a = { errore:"non riesco a leggerlo: scaricalo di nuovo dal sito Amway." }; }
    if(a.errore) m.errori.push(`${file.name}: ${a.errore}`);
    else if(a.passato){ if(!m.passati.some(x => x.mese === a.mese)) m.passati.push(a); }
    else if(m.corrente) m.errori.push(`${file.name}: c'è già un report del mese in corso, si importa uno alla volta.`);
    else m.corrente = a;
  }
  m.passati.sort((x, y) => x.mese < y.mese ? -1 : 1);
  if(!m.passati.length && !m.errori.length) st.imp = m.corrente;
  else st.imp = m;
  render();
}
async function salvaReportPassati(m, f){
  st.occupato = true; render();
  const fatti = [];
  for(const a of m.passati){
    try{ await api.salvaMesePassato(argomentiPassato(a)); fatti.push(nomeMese(a.mese)); }
    catch(e){ m.errori.push(`${nomeMese(a.mese)}: ${messaggio(e)}`); }
  }
  await caricaNumeri();
  st.occupato = false;
  if(fatti.length) toast(`Numeri salvati: ${fatti.join(", ")}`);
  /* il mese in corso, se c'era, si importa adesso con la sua anteprima */
  if(m.corrente && !m.errori.length){ st.imp = m.corrente; render(); }
  else if(m.errori.length){ st.imp = { multi:true, passati:[], corrente:m.corrente, errori:m.errori }; render(); }
  else { st.sheet = null; st.imp = null; render(); poiOrdini(); }
  riconosciPlatino();
}
async function leggiUnReport(file){
  if(!file) return;
  let a;
  if(/\.xlsx?$/i.test(file.name)) a = { errore:"Questo è il file Excel: sul sito Amway scegli il formato CSV." };
  else{
    try{
      const rep = leggiReport(await file.text());
      if(!rep.errore) try{ st.esclusi = new Set((await api.esclusi() || []).map(x => x.codice)); }catch(e){}
      a = rep.errore ? rep : await conData(analizzaReport(rep), file);
    }catch(e){ a = { errore:"Non riesco a leggere il file: scaricalo di nuovo dal sito Amway." }; }
  }
  st.imp = a; render();
}
/* La data dei dati: il report Amway ha solo il mese, quindi vale la data e ora del file scaricato (mai nel futuro).
   Si confronta con quella dei miei numeri già salvati per quel mese: un report più vecchio non cambia niente di
   quello che viene da report più recenti. */
async function conData(a, file){
  if(!a || a.errore) return a;
  const t = Number(file && file.lastModified) || Date.now();
  a.datiAl = new Date(Math.min(t, Date.now())).toISOString();
  try{
    const r = (await api.datiAl(st.profilo.id, a.mese + "-01") || [])[0];
    if(r && r.dati_al && r.dati_al > a.datiAl) a.piuVecchio = r.dati_al;
  }catch(e){}
  return a;
}
const fmtDataOra = new Intl.DateTimeFormat("it-IT", { timeZone:TZ, day:"numeric", month:"long", hour:"2-digit", minute:"2-digit" });
function rigaDataReport(a){
  return `<p class="small data-report" style="margin:4px 0 0">File del ${esc(fmtDataOra.format(new Date(a.datiAl)))}${a.piuVecchio
    ? ` · <b>più vecchio dell'ultimo importato (${esc(fmtDataOra.format(new Date(a.piuVecchio)))})</b>: aggiorna solo chi non ha dati più recenti` : ""}</p>`;
}

/* i numeri ufficiali di ognuno: VPP, VPG, percentuale e i VPG delle sue linee frontali del report
   (se il report non mostra il suo gruppo, come per i Platino, le linee sono "nascoste") */
function numeriDelReport(perCodice){
  const figliReport = new Map();
  for(const r of perCodice.values()) if(r.sponsor) figliReport.set(r.sponsor, (figliReport.get(r.sponsor) || []).concat([r]));
  return r => r.vpg == null ? {} : { vpg:r.vpg, percentuale:r.perc,
    linee:(figliReport.get(r.codice) || []).map(x => ({ codice:x.codice, vpg:x.vpg || 0 })),
    nascoste:!figliReport.has(r.codice) && r.dimensione > 1 };
}
function argomentiPassato(a){
  const numeri = numeriDelReport(a.perCodice);
  const altri = [...a.perCodice.values()].filter(r => r.codice !== a.prima.codice && r.vpg != null)
    .map(r => Object.assign({ codice:r.codice, vpp:r.vpp }, numeri(r)));
  return { p_mese:a.mese + "-01", p_dati_al:a.datiAl || new Date().toISOString(),
    p_io:Object.assign({ codice:a.prima.codice, vpp:a.prima.vpp }, numeri(a.prima)), p_altri:altri };
}
async function salvaReportPassato(a, f){
  st.occupato = true;
  try{
    await api.salvaMesePassato(argomentiPassato(a));
    await caricaNumeri();
    st.sheet = null; st.imp = null; st.occupato = false; render();
    toast(`Numeri di ${nomeMese(a.mese)} salvati`);
    riconosciPlatino(); poiOrdini();
  }catch(e){ st.occupato = false; mostraErroreForm(f, messaggio(e)); }
}
async function eseguiImport(f){
  const a = st.imp, io = st.profilo;
  if(a.multi){
    if(a.passati.length) return salvaReportPassati(a, f);
    if(a.corrente){ st.imp = a.corrente; render(); return; }
    st.sheet = null; st.imp = null; render(); return;
  }
  if(a.passato) return salvaReportPassato(a, f);
  const scelti = nome => new Set([...f.querySelectorAll(`input[name=${nome}]:checked`)].map(i => i.value));
  const nascondi = scelti("nascondi");
  /* "Riapplica i filtri": chi c'è già si nasconde o si rimette secondo le caselle; "Lascia tutto com'è": nessun cambio */
  const filtri = !!f.querySelector("input[name=modo][value=filtri]:checked"), voglio = scelti("nascondi-es");
  const elencati = filtri ? [...f.querySelectorAll("input[name=nascondi-es]")].map(i => i.value) : [];
  const daNascondere = elencati.filter(id => voglio.has(id) && !st.nascosti.has(id));
  const daMostrare = elencati.filter(id => !voglio.has(id) && st.nascosti.has(id));
  if(a.nuovi.length && !f.consenso.checked){ mostraErroreForm(f, "Conferma di avere il consenso delle persone della tua linea."); return; }
  /* 033: una sola struttura. Tutte le persone del report, dalla più vicina a me: posizione e numeri di tutto il mio
     gruppo (chi usa l'app e chi no). Il database tiene il report più aggiornato per ognuno. */
  const numeri = numeriDelReport(a.perCodice);
  const profondita = r => { let n = 0; for(let c = r.sponsor; c && a.perCodice.has(c) && n < 200; c = a.perCodice.get(c).sponsor) n++; return n; };
  const persone = [...a.perCodice.values()].filter(r => r.codice !== a.prima.codice)
    .sort((x, y) => profondita(x) - profondita(y))
    .map(r => Object.assign({ codice:r.codice, nome:r.nome, vpp:r.vpp, sponsor:r.sponsor || null }, numeri(r)));
  st.occupato = true;
  try{
    const esito = await api.importaMappa({ p_mese:a.mese + "-01", p_dati_al:a.datiAl || new Date().toISOString(),
      p_io:Object.assign({ codice:a.prima.codice, vpp:a.prima.vpp }, numeri(a.prima)), p_persone:persone,
      p_nascondi:[...nascondi], p_fuori:a.mancanti.map(p => p.id) }) || {};
    if(a.codiceMio) st.profilo = Object.assign({}, io, { codice_amway:a.prima.codice });
    if(daNascondere.length) await api.nascondiTanti(io.id, daNascondere);
    if(daMostrare.length) await api.mostraTanti(io.id, daMostrare);
    await caricaStruttura();
    st.att = await api.activities(io.id, [settimana(), primoDelMese()].sort()[0]) || [];
    await caricaNumeri();
    st.sheet = null; st.imp = null; st.occupato = false; render();
    riconosciPlatino();
    const n = k => Number(esito[k]) || 0;
    setTimeout(poiOrdini, 50);
    toast(`Import di ${nomeMese(a.mese).split(" ")[0]}: ${[n("aggiunte") ? plur(n("aggiunte"), "persona aggiunta", "persone aggiunte") : "",
      plur(n("aggiornati"), "persona aggiornata", "persone aggiornate"), n("piu_vecchi") ? plur(n("piu_vecchi"), "già più aggiornata", "già più aggiornate") : "", n("spostate") ? plur(n("spostate"), "spostata", "spostate") : "",
      n("fuori") ? plur(n("fuori"), "persona non più nel report", "persone non più nel report") : "",
      daNascondere.length ? plur(daNascondere.length, "nascosta", "nascoste") : "",
      daMostrare.length ? plur(daMostrare.length, "di nuovo visibile", "di nuovo visibili") : ""].filter(Boolean).join(", ")}`);
  }catch(e){
    st.occupato = false;
    try{ await caricaStruttura(); }catch(x){}
    mostraErroreForm(f, messaggio(e));
  }
}

/* ---- 10. Fogli in basso ---- */
function vSheet(){
  const s = st.sheet;
  const sp = vSheetPersone(s) || vSheetTarget(s) || vSheetClienti(s) || vSheetOrdiniAmway(s) || vSheetListino(s) || vSheetMiei(s) || vSheetGuida(s);
  if(sp) return sp;
  if(s === "codici-tolti") return `<h2>Codici Amway tolti</h2>
    <p class="small">Le persone tolte dalla struttura prima della conferma: con questi codici non si entra finché non li sblocchi.</p>
    ${(st.codiciTolti || []).length ? `<ul class="oggi">${st.codiciTolti.map(c => `<li><span class="grow"><b>${esc(c.nome || "")}</b><br>
      <span class="small">${esc(c.codice_amway)} · tolto il ${dataIt(String(c.tolto_il).slice(0, 10))}</span></span>
      <button class="btn small" data-act="sblocca-codice" data-codice="${esc(c.codice_amway)}">Sblocca</button></li>`).join("")}</ul>`
      : `<p class="muted">Nessun codice tolto.</p>`}
    <button class="btn ghost wide" style="margin-top:8px" data-act="chiudi">Chiudi</button>`;
  const err = st.errore ? `<p class="errore">${esc(st.errore)}</p>` : "";
  const piede = `<div class="row" style="margin-top:16px"><button type="button" class="btn ghost grow" data-act="chiudi">Annulla</button>
        <button class="btn primary grow">Salva</button></div>`;
  if(s === "ordine") return `<h2>Nuovo ordine${st.target ? ` di ${esc(nomeSaluto(nomeDi(st.target)))}` : ""}</h2>
    <form data-form="ordine" novalidate>
      <label class="field"><span>VP dell'ordine</span>
        <input name="vp" type="text" inputmode="decimal" autocomplete="off" required autofocus value="" placeholder="0" data-vuoto></label>
      <label class="field"><span>Data</span><input name="data" type="date" value="${oggi()}" min="${primaDataAperta()}" max="${oggi()}"></label>
      ${piede}${err}
    </form>`;
  if(s === "obiettivi") return `<h2>Obiettivi della settimana</h2>
    <p class="small">Valgono da lunedì ${dataIt(settimana())}. La settimana prossima ripartono da questi.</p>
    <form data-form="obiettivi" novalidate>
      <label class="field"><span>Nuovi contatti</span><input name="contatti" type="number" inputmode="numeric" min="0" max="1000" value="" placeholder="${Number(st.goal.obiettivo_contatti) || 0}" data-vuoto></label>
      <label class="field"><span>Piani mostrati</span><input name="piani" type="number" inputmode="numeric" min="0" max="1000" value="" placeholder="${Number(st.goal.obiettivo_piani) || 0}" data-vuoto></label>
      ${piede}${err}
    </form>`;
  if(s === "totale-mese"){
    const m = st.meseTotale || meseDi(oggi());
    const scelta = precedenteAperto() ? `<div class="scelte" style="margin-top:10px">
        ${[meseDi(oggi()), mesePrecedente()].map(x => `<label><input type="radio" name="mese" value="${x}" ${x === m ? "checked" : ""} data-act="scegli-mese">
          ${nomeMese(x).replace(/^./, c => c.toUpperCase())}${x === mesePrecedente() ? ` <span class="small">(si chiude il ${giornoChiusura()})</span>` : ""}</label>`).join("")}
      </div>` : "";
    const chi = st.target ? ` di ${esc(nomeSaluto(nomeDi(st.target)))}` : "";
    return `<h2>VP di ${nomeMese(m).split(" ")[0]}${chi}</h2>
    <p class="small">Scrivi il totale dei VP personali del mese${st.target ? chi : ""}, per esempio quello dell'ufficio virtuale Amway.
      L'app registra solo la differenza con quanto è già inserito (${num(vpAttuale(m))} VP).</p>
    <form data-form="totale-mese" novalidate>
      ${scelta}
      <label class="field"><span>Totale VP del mese</span>
        <input name="vp" type="text" inputmode="decimal" autocomplete="off" autofocus value="" placeholder="${num(vpAttuale(m))}" data-vuoto></label>
      ${piede}${err}
    </form>`;
  }
  if(s === "storico") return vStorico();
  if(s === "importa") return vImporta();
  if(s === "invito-sopra"){
    const x = st.struttura.find(y => y.id === st.invitoSopra.id);
    if(!x) return "";
    if(st.invitoSopra.codice) return `<h2>Link per chi manca sopra di ${esc(nomeSaluto(x.nome))}</h2>
      <p class="small">Mandalo alla persona che deve entrare tra ${esc(x.sponsor_id === st.profilo.id ? "voi" : nomeDi(x.sponsor_id))} e
        ${esc(x.nome)}. Vale una volta sola.</p>
      ${bottoniLink(base() + "#" + st.invitoSopra.codice)}
      <button class="btn ghost wide" style="margin-top:12px" data-act="chiudi">Chiudi</button>`;
    const fratelli = st.struttura.filter(y => y.sponsor_id === x.sponsor_id && y.id !== x.id);
    return `<h2>Chi manca sopra di ${esc(nomeSaluto(x.nome))}?</h2>
    <p class="small">L'app crea un link valido una volta sola: chi lo apre entra tra ${esc(x.sponsor_id === st.profilo.id ? "voi" : nomeDi(x.sponsor_id))}
      e ${esc(x.nome)}, che passa sotto di lui con tutto il suo gruppo.</p>
    <form data-form="invito-sopra" novalidate>
      ${fratelli.length ? `<div class="field" style="margin-top:14px"><span class="small">Facoltativo: anche altri sono in realtà suoi? Spunta solo se è così.</span>
        <div class="scelte">${fratelli.map(y => `<label><input type="checkbox" name="altri" value="${esc(y.id)}"> ${esc(y.nome)}</label>`).join("")}</div></div>` : ""}
      <div class="row" style="margin-top:16px"><button type="button" class="btn ghost grow" data-act="chiudi">Annulla</button>
        <button class="btn primary grow">Crea il link</button></div>${err}
    </form>`;
  }
  if(s === "nascoste"){
    /* tutta la mia struttura in ordine di report, con dove sta ognuno: si nasconde o si rimette da qui */
    const pos = posizioni(), nasc = st.filtroNascoste === "nascoste";
    const tutte = alberoSotto(st.profilo.id, 0).map(x => x.p), quanteN = tutte.filter(p => st.nascosti.has(p.id)).length;
    const l = tutte.filter(p => st.nascosti.has(p.id) === nasc);
    return `<h2>Chi vedi nella struttura</h2>
    <p class="small">Le nascoste le vedi solo tu così: per gli altri non cambia niente, e i loro VP contano nei tuoi numeri.
      Tocca un nome per aprire la scheda.</p>
    <div class="row scelte-rapide" style="gap:6px;margin:8px 0">
      <button class="btn small${nasc ? " on" : ""}" data-act="filtro-nascoste" data-filtro="nascoste" aria-pressed="${nasc}">Nascoste · ${quanteN}</button>
      <button class="btn small${nasc ? "" : " on"}" data-act="filtro-nascoste" data-filtro="visibili" aria-pressed="${!nasc}">Visibili · ${tutte.length - quanteN}</button></div>
    ${l.length > 8 ? `<input type="search" class="cerca" data-cerca=".imp-nascoste" placeholder="Cerca per nome o codice…" autocomplete="off" aria-label="Cerca per nome o codice">` : ""}
    ${l.length ? `<ul class="imp imp-nascoste">${l.map(p => `<li data-nome="${esc(senzaAccenti(p.nome) + " " + (p.codice_amway || ""))}">
      <span class="grow"><button class="btn link" style="text-align:left;padding:0;min-height:0" data-act="apri-nascosta" data-id="${esc(p.id)}">${esc(p.nome)}${p.fuori_report_dal ? ` <span class="pill g">fuori</span>` : ""}</button>
        <br><span class="small">${testoPosizione(pos.get(p.id))}</span></span>
      ${nasc ? `<button class="btn small" data-act="mostra" data-id="${esc(p.id)}">Mostra</button>`
        : `<button class="btn small ghost" data-act="nascondi-qui" data-id="${esc(p.id)}">Nascondi</button>`}</li>`).join("")}</ul>`
      : `<p class="muted">${nasc ? "Nessuna persona nascosta." : "Nessuna persona visibile."}</p>`}
    <button class="btn ghost wide" style="margin-top:12px" data-act="chiudi">Chiudi</button>`;
  }
  if(s === "codice"){
    const p = st.codiceId === st.profilo.id ? st.profilo : st.struttura.find(x => x.id === st.codiceId);
    if(!p) return "";
    const mio = p.id === st.profilo.id;
    return `<h2>Correggi il codice Amway${mio ? "" : ` di ${esc(nomeSaluto(p.nome))}`}</h2>
    <p class="small">Solo per un errore di battitura all'ingresso: il codice giusto è quello del report della
      Linea di Sponsorizzazione sul sito Amway. Serve ad abbinare le persone quando si importa il report.</p>
    <form data-form="codice" novalidate>
      ${campoCodice(true, p.codice_amway)}
      ${piede}${err}
    </form>`;
  }
  if(s === "mese-gruppo") return vMeseGruppo();
  if(s === "obiettivo-mese") return `<h2>Obiettivo del mese</h2>
    <p class="small">VP personali di ${nomeMese(meseDi(oggi()))}. Il mese prossimo riparte da questo.</p>
    <form data-form="obiettivo-mese" novalidate>
      <label class="field"><span>VP personali del mese</span><input name="vp" type="text" inputmode="decimal" autocomplete="off" value="" placeholder="${num(st.goalMese.obiettivo_vp)}" data-vuoto></label>
      ${piede}${err}
    </form>`;
  if(s === "mia-chiave") return `<h2>Il mio link personale</h2>
    ${st.chiave ? `<p class="small">Con questo link entri da qualsiasi telefono o computer. È personale: tienilo per te
      (WhatsApp: chat con te stesso · Telegram: Messaggi salvati).</p>
      ${bottoniChiave()}
      <div class="linkbox">${esc(linkPersonale())}</div>`
    : `<p class="small">Questo telefono non conosce il tuo link personale. Puoi crearne uno nuovo qui sotto.</p>`}
    <div class="stack" style="margin-top:14px">
      <button class="btn wide" data-act="cambia-chiave">Crea un link nuovo</button>
      <button class="btn wide ghost" data-act="chiudi">Chiudi</button>
    </div>
    <p class="nota">Crea un link nuovo se pensi che il tuo sia finito a qualcun altro: quello vecchio smette di funzionare
      e gli altri telefoni dovranno rientrare con il nuovo.</p>`;
  if(s === "obiettivo") return `<h2>Il mio obiettivo</h2>
    <form data-form="obiettivo" novalidate>${campiObiettivo(st.obiettivo)}${piede}${err}</form>`;
  if(s === "chiamata"){
    const x = st.struttura.find(y => y.id === st.chiamataId);
    if(!x) return "";
    return `<h2>Chiamata con ${esc(nomeSaluto(x.nome))}</h2>
    <form data-form="chiamata" novalidate>
      <div class="row">
        <label class="field grow"><span>Giorno</span><input name="data" type="date" value="${piuGiorni(oggi(), 1)}" min="${oggi()}"></label>
        <label class="field grow"><span>Ora</span><input name="ora" type="time" value="21:00" step="300"></label>
      </div>
      <div class="row">
        <label class="field grow"><span>Durata</span><select name="durata">
          ${[15, 30, 45, 60].map(m => `<option value="${m}"${m === 30 ? " selected" : ""}>${m} minuti</option>`).join("")}</select></label>
        ${suAndroid() ? "" : `<label class="field grow"><span>Promemoria</span><select name="avviso">
          <option value="10">10 minuti prima</option><option value="30" selected>30 minuti prima</option>
          <option value="60">1 ora prima</option><option value="1440">1 giorno prima</option><option value="0">nessuno</option></select></label>`}
      </div>
      ${suAndroid() ? `<p class="nota">Il promemoria è quello che usi di solito in Google Calendar: puoi cambiarlo prima di salvare.</p>` : ""}
      <label class="field"><span>Note (restano solo nel tuo calendario)</span><textarea name="note" rows="3" maxlength="1000"></textarea></label>
      <div class="condividi" style="margin-top:16px">
        <button class="btn primary">Calendario</button>
        <button type="button" class="btn wa" data-act="chiamata-wa">WhatsApp</button>
      </div>
      ${suAndroid() ? `<p class="nota">"Calendario" apre Google Calendar con la chiamata già compilata: tocca Salva.
        Usi un altro calendario? <button type="button" class="btn link small" data-act="chiamata-ics">Scarica il file</button> e aprilo.</p>` : ""}
      <p class="nota">Su WhatsApp parte un messaggio già scritto, per esempio: "${esc(testoChiamata(x.nome, piuGiorni(oggi(), 1), "21:00"))}".
        Scegli tu a chi mandarlo.</p>
      <button type="button" class="btn ghost wide" style="margin-top:8px" data-act="chiudi">Chiudi</button>${err}
    </form>`;
  }
  if(s === "prossima"){
    const q = st.profilo.qualifica_iniziale;
    return `<h2>${st.platinoNuovo ? "Platino! Qual è la tua prossima qualifica?" : "La tua prossima qualifica"}</h2>
    ${st.platinoNuovo ? `<p class="small">Sei arrivato a 6 mesi da Argento: il percorso è completo. Scegli la prossima qualifica che vuoi ottenere:
      la vedono anche il tuo sponsor e la tua upline.</p>` : ""}
    <form data-form="prossima-qualifica" novalidate>
      <label class="field"><span>Prossima qualifica che vuoi ottenere</span>
        <select name="prossima">${opzioniProssima(q, st.profilo.prossima_qualifica || qualificaObiettivo())}</select></label>
      <div class="row" style="margin-top:16px"><button type="button" class="btn ghost grow" data-act="chiudi">Dopo</button>
        <button class="btn primary grow">Salva</button></div>
    </form>`;
  }
  if(s === "partenza"){
    const p = st.profilo;
    return `<h2>Il mio punto di partenza</h2>
    <p class="small">Hai dichiarato: <b>${esc(testoPartenza(p))}</b>. Se non è giusto, correggilo: è una tua responsabilità
      e nessuno lo conferma al posto tuo. I numeri del mese arrivano dal report Amway.</p>
    <form data-form="partenza" novalidate>
      ${campiQualifica(false, { valore:valoreQualifica(p), mese:p.qualifica_iniziale_mese ? meseDi(p.qualifica_iniziale_mese) : "",
                               pagamenti:p.pagamenti_iniziali, senzaData:true, prossima:p.prossima_qualifica })}
      <div class="row" style="margin-top:16px"><button type="button" class="btn ghost grow" data-act="chiudi">Annulla</button>
        <button class="btn primary grow">Salva</button></div>
    </form>`;
  }
  if(s === "link-gestito"){
    const g = st.linkGestito, link = base() + "#chiave=" + g.chiave;
    const testo = `Ciao ${nomeSaluto(g.nome)}! Ti ho preparato il profilo su Growup, l'app del nostro gruppo. `
      + `Apri questo link: è la tua chiave personale, salvala nella chat con te stesso e non inoltrarla.`;
    return `<h2>Il link di ${esc(g.nome)}</h2>
    <p class="small">Mandalo <b>a ${esc(nomeSaluto(g.nome))}</b>: ${g.nuovo ? "il link vecchio non funziona più; con questo rientra nel suo profilo, con tutti i suoi dati."
      : "aprendolo entra nell'app e trova il suo profilo già pronto. Da quel momento i suoi dati li aggiorna lui."}</p>
    <div class="condividi">
      <a class="btn wa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(testo + " " + link)}">WhatsApp</a>
      <a class="btn tg" target="_blank" rel="noopener" href="https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(testo)}">Telegram</a>
      <button class="btn" data-act="copia-gestito">Copia link</button>
    </div>
    <div class="linkbox">${esc(link)}</div>
    <p class="nota">Se crei un altro link per ${esc(nomeSaluto(g.nome))}, questo smette di funzionare.</p>
    <button class="btn wide ghost" style="margin-top:12px" data-act="chiudi">Chiudi</button>`;
  }
  if(s === "privacy") return `<h2>Informativa privacy (breve)</h2>
    ${testoPrivacy()}
    <button class="btn wide" style="margin-top:14px" data-act="chiudi">Ho capito</button>`;
  return "";
}

/* ---- 11. Azioni ---- */
/* Registra per me o, se st.target è impostato, per il partner senza app aperto nella scheda. */
async function registra(tipo, extra){
  const perAltri = !!st.target;
  const pid = st.target || st.profilo.id;
  const prendi = () => perAltri ? st.attScheda : st.att;
  const metti = l => { if(perAltri) st.attScheda = l; else st.att = l; };
  const riga = Object.assign({ partner_id:pid, tipo, quantita:1, data:oggi() }, extra || {});
  const tmp = Object.assign({ id:"tmp" + Math.random().toString(36).slice(2), inserito_il:new Date().toISOString(),
                              inserito_da:st.profilo.id }, riga);
  metti(prendi().concat([tmp])); render();
  const promessa = api.addActivity(riga);
  const per = perAltri ? ` per ${nomeSaluto(nomeDi(pid))}` : "";
  const msg = tipo === "ordine" ? `Ordine da ${num(riga.vp)} VP registrato${per}`
    : tipo === "rettifica" ? `Totale di ${nomeMese(meseDi(riga.data)).split(" ")[0]} aggiornato${per}: ${num(perAltri ? vpMese(meseDi(riga.data), prendi()) : vpMese(meseDi(riga.data)))} VP`
    : `${ETICHETTE[tipo]} registrato${per}`;
  const dopo = () => { if(perAltri) caricaNumeri().then(render).catch(() => {}); };
  toast(msg, async () => {
    try{
      const vero = await promessa;
      await api.deleteActivity(vero.id);
      metti(prendi().filter(a => a.id !== vero.id && a.id !== tmp.id));
      render(); toast("Annullato"); dopo();
    }catch(e){ toast(messaggio(e)); }
  });
  try{
    const vero = await promessa;
    metti(prendi().map(a => a.id === tmp.id ? vero : a));
    render(); dopo();
  }catch(e){
    metti(prendi().filter(a => a.id !== tmp.id)); render();
    toast(messaggio(e));
  }
}

async function salvaObiettivi(c, pi){
  await api.saveGoal({ partner_id:st.profilo.id, settimana:settimana(), obiettivo_contatti:c, obiettivo_piani:pi });
  st.goal = { obiettivo_contatti:c, obiettivo_piani:pi, salvato:true };
}
async function salvaObiettivoMese(vp){
  await api.saveMonthGoal({ partner_id:st.profilo.id, mese:primoDelMese(), obiettivo_vp:vp });
  st.goalMese = { obiettivo_vp:vp, salvato:true };
}

async function copiaTesto(t, ok){
  try{ await navigator.clipboard.writeText(t); toast(ok); }
  catch(e){ toast("Tieni premuto sul link per copiarlo"); }
}

const AZIONI = {
  async contatto(){ await registra("contatto"); },
  async piano(){ await registra("piano"); },
  async cliente(){ await registra("cliente"); },
  ordine(){ st.errore = ""; st.sheet = "ordine"; render(); focusSheet(); },
  obiettivi(){ st.errore = ""; st.sheet = "obiettivi"; render(); },
  "obiettivo-mese"(){ st.errore = ""; st.sheet = "obiettivo-mese"; render(); },
  "totale-mese"(){ st.errore = ""; st.meseTotale = meseDi(oggi()); st.sheet = "totale-mese"; render(); focusSheet(); },
  "scegli-mese"(el){ st.meseTotale = el.value; render(); },
  importa(){ st.imp = null; st.errore = ""; st.sheet = "importa"; render(); },
  "invito-sopra"(el){ st.invitoSopra = { id:el.dataset.id, codice:null }; st.errore = ""; st.sheet = "invito-sopra"; render(); },
  "copia-link"(el){ copiaTesto(el.dataset.link, "Link copiato"); },
  /* pulsanti rapidi dell'import: agiscono sulle caselle "Non ancora nell'app" senza ridisegnare il foglio;
     il pulsante usato resta acceso finché non si cambia una casella a mano */
  "nascondi-zero"(el){ sceltaRapida(el, i => i.dataset.vpp !== "1"); },
  "nascondi-tutti"(el){ sceltaRapida(el, () => true); },
  "mostra-tutti"(el){ sceltaRapida(el, () => false); },
  codice(el){ st.codiceId = el.dataset.id; st.errore = ""; st.sheet = "codice"; render(); focusSheet(); },
  storico(){ st.sheet = "storico"; render(); },
  async "mese-gruppo"(el){
    const mese = el.dataset.mese;
    if(st.sheet === "mese-gruppo" && st.meseGruppo && st.meseGruppo.mese === mese) return;
    st.meseGruppo = { mese, righe:null }; st.sheet = "mese-gruppo"; render();
    try{
      const [righe, prima] = await Promise.all([api.riepilogo(mese + "-01"), api.riepilogo(meseAvanti(mese, -1) + "-01").catch(() => [])]);
      if(st.meseGruppo && st.meseGruppo.mese === mese){ st.meseGruppo.righe = righe || []; st.meseGruppo.prima = prima || []; render(); }
    }catch(e){ if(st.meseGruppo && st.meseGruppo.mese === mese){ st.meseGruppo.errore = messaggio(e); render(); } }
  },
  "vista-io"(){ st.vista = "io"; st.target = null; render(); window.scrollTo(0, 0); },
  "vista-gruppo"(){ st.vista = "gruppo"; st.target = null; st.schedaId = null; st.schedaPila = []; render(); window.scrollTo(0, 0); },
  "scheda-indietro"(){
    const id = st.schedaPila.pop();
    if(!id){ AZIONI["vista-gruppo"](); return; }
    st.versoNav = -1;
    AZIONI["apri-scheda"]({ dataset:{ id, indietro:"1" } });
  },
  "vista-obiettivo"(){ st.vista = "obiettivo"; st.target = null; render(); window.scrollTo(0, 0); },
  "scheda-tab"(el){ st.schedaTab = el.dataset.tab; render(); },
  "vista-profilo"(){ if(st.vista === "profilo") return; st.vista = "profilo"; st.target = null; render(); window.scrollTo(0, 0); },
  "profilo-indietro"(){ if(!tornaIndietro()){ st.vista = "io"; render(); window.scrollTo(0, 0); } },
  "primi-passi-si"(){ salvaLocale(chiavePrimiPassiNo(), null); st.vista = "io"; st.sezIo = "giorno"; render(); window.scrollTo(0, 0); },
  "obiettivo-modifica"(){ st.errore = ""; st.sheet = "obiettivo"; render(); },
  "obiettivo-dopo"(){ st.fase = "home"; render(); },
  async "copia-dati"(){
    try{
      const dati = await api.copiaDati();
      const url = URL.createObjectURL(new Blob([JSON.stringify(dati, null, 1)], { type:"application/json" }));
      const a = document.createElement("a");
      a.href = url; a.download = `growup-copia-${oggi()}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      salvaLocale(CHIAVE_ULTIMA_COPIA, oggi()); render();
      toast("Copia scaricata: salvala su Google Drive");
    }catch(e){ toast(messaggio(e)); }
  },
  async preferito(el){
    const id = el.dataset.id, era = st.preferiti.has(id), nome = nomeDi(id);
    if(era) st.preferiti.delete(id); else st.preferiti.add(id);
    render();
    try{
      if(era) await api.togliPreferito(st.profilo.id, id); else await api.aggiungiPreferito(st.profilo.id, id);
      toast(era ? `${nome} tolto dai preferiti` : `${nome} nei preferiti: lo trovi nella pagina Gruppo`);
    }catch(e){
      if(era) st.preferiti.add(id); else st.preferiti.delete(id);
      render(); toast(messaggio(e));
    }
  },
  piega(el){
    const id = el.dataset.id, insieme = senzaAccenti(st.cerca) ? st.espansi : st.chiusi;
    if(insieme.has(id)) insieme.delete(id); else insieme.add(id);
    render();
  },
  async "apri-scheda"(el){
    const p = st.struttura.find(x => x.id === el.dataset.id);
    if(!p) return;
    /* da una scheda a un'altra (le linee frontali): si ricorda la strada per tornare indietro */
    if(el.dataset.indietro){}
    else if(st.vista === "scheda" && st.schedaId && st.schedaId !== p.id) st.schedaPila.push(st.schedaId);
    else st.schedaPila = [];
    st.schedaId = p.id; st.schedaTab = "numeri"; st.target = p.stato === "gestito" ? p.id : null; st.attScheda = [];
    st.vista = "scheda"; render(); window.scrollTo(0, 0);
    try{ st.attScheda = (await api.activities(p.id, primaDataAperta()) || []).filter(a => a.data >= primaDataAperta()); render(); }
    catch(e){ toast(messaggio(e)); }
    if(p.stato !== "gestito") api.numeriPersone(p.id).then(n => { st.numeriLista[p.id] = n; render(); }).catch(() => {});
    if(p.stato !== "gestito") api.seguimiDi(p.id).then(g => { st.seguimiScheda[p.id] = g || []; render(); }).catch(() => {});
    api.mesiReport(p.id).then(m => { st.mesiScheda[p.id] = m || []; render(); }).catch(() => {});
  },
  partenza(){ st.sheet = "partenza"; render(); },
  "scegli-prossima"(){ st.platinoNuovo = false; st.sheet = "prossima"; render(); },
  chiamata(el){ st.chiamataId = el.dataset.id; st.errore = ""; st.sheet = "chiamata"; render(); },
  "chiamata-ics"(el){
    const f = el.form, x = st.struttura.find(y => y.id === st.chiamataId);
    if(!f || !x) return;
    const c = datiChiamata(f), err = erroreChiamata(c);
    if(err){ mostraErroreForm(f, err); return; }
    scaricaIcs(creaIcs(Object.assign({ nome:x.nome }, c)), x.nome);
  },
  "chiamata-wa"(el){
    const f = el.form, x = st.struttura.find(y => y.id === st.chiamataId);
    if(!f || !x) return;
    const c = datiChiamata(f), err = erroreChiamata(c);
    if(err){ mostraErroreForm(f, err); return; }
    window.open("https://wa.me/?text=" + encodeURIComponent(testoChiamata(x.nome, c.data, c.ora)), "_blank", "noopener");
  },
  async nascondi(el){
    const p = st.struttura.find(x => x.id === el.dataset.id);
    if(!p) return;
    try{
      await api.nascondi(st.profilo.id, p.id);
      st.nascosti.add(p.id);
      st.vista = "gruppo"; st.schedaId = null; st.target = null; render(); window.scrollTo(0, 0);
      toast(`${p.nome} nascosto dalla tua struttura`);
    }catch(e){ toast(messaggio(e)); }
  },
  nascoste(){ st.filtroNascoste = st.nascosti.size ? "nascoste" : "visibili"; st.sheet = "nascoste"; render(); },
  "filtro-nascoste"(el){ st.filtroNascoste = el.dataset.filtro; render(); },
  /* la struttura completa parte con i gruppi chiusi (si vedono i frontali, ▸ apre un gruppo);
     tornando alla mia struttura, i gruppi tornano aperti o chiusi come prima */
  "con-nascoste"(){
    st.conNascoste = !st.conNascoste;
    if(st.conNascoste){
      st.chiusiPrima = new Set(st.chiusi);
      st.chiusi = new Set(st.struttura.filter(p => p.id !== st.profilo.id && figli(p.id).length).map(p => p.id));
    }else if(st.chiusiPrima){ st.chiusi = st.chiusiPrima; st.chiusiPrima = null; }
    render();
  },
  async "nascondi-qui"(el){
    try{
      await api.nascondi(st.profilo.id, el.dataset.id);
      st.nascosti.add(el.dataset.id);
      render(); toast(`${nomeDi(el.dataset.id)} nascosto dalla tua struttura`);
    }catch(e){ toast(messaggio(e)); }
  },
  "apri-nascosta"(el){ st.sheet = null; AZIONI["apri-scheda"](el); },
  async mostra(el){
    try{
      await api.mostra(st.profilo.id, el.dataset.id);
      st.nascosti.delete(el.dataset.id);
      if(!st.nascosti.size && st.conNascoste){ st.conNascoste = false; if(st.chiusiPrima){ st.chiusi = st.chiusiPrima; st.chiusiPrima = null; } }
      render(); toast(`${nomeDi(el.dataset.id)} di nuovo nella tua struttura`);
    }catch(e){ toast(messaggio(e)); }
  },
  async "nuovo-link"(el){
    const p = st.struttura.find(x => x.id === el.dataset.id);
    if(!p || !confirm(`Creare un nuovo link personale per ${p.nome}? Quello vecchio smetterà di funzionare.`)) return;
    try{ st.linkGestito = { nome:p.nome, chiave: await api.nuovaChiavePer(p.id), nuovo:true }; st.sheet = "link-gestito"; render(); }
    catch(e){ toast(messaggio(e)); }
  },
  async "togli-attesa"(el){
    const p = (st.inAttesa || []).find(x => x.id === el.dataset.id);
    if(!p || !confirm(`Togliere ${p.nome}?\n\nNon è nella mappa Amway: si cancellano il suo profilo e i suoi dati e l'app sul suo telefono si blocca. Non si può annullare.`)) return;
    try{ await api.togliDallaStruttura(p.id); await caricaStruttura(); render(); toast(`${p.nome} tolta`); }
    catch(e){ toast(messaggio(e)); }
  },
  async "togli-struttura"(el){
    const p = st.struttura.find(x => x.id === el.dataset.id);
    if(!p || !confirm(`Togliere ${p.nome} dalla struttura?\n\nSi cancellano il suo profilo e tutti i suoi dati e l'app sul suo telefono si blocca. Non si può annullare.`)) return;
    try{
      await api.togliDallaStruttura(p.id);
      st.schedaId = null; st.vista = "gruppo";
      await caricaTutto(); render(); toast(`${p.nome} tolta dalla struttura`);
    }catch(e){ toast(messaggio(e)); }
  },
  async "blocca-app"(el){
    const p = st.struttura.find(x => x.id === el.dataset.id), blocca = !!el.dataset.blocca;
    if(!p || (blocca && !confirm(`Bloccare l'app di ${p.nome}? Non vedrà più niente finché non la sblocchi.`))) return;
    try{ await api.bloccaApp(p.id, blocca); await caricaStruttura(); render(); toast(blocca ? `App di ${p.nome} bloccata` : `App di ${p.nome} sbloccata`); }
    catch(e){ toast(messaggio(e)); }
  },
  async "codici-tolti"(){
    try{ st.codiciTolti = await api.codiciTolti() || []; st.sheet = "codici-tolti"; render(); }catch(e){ toast(messaggio(e)); }
  },
  async "sblocca-codice"(el){
    if(!confirm(`Sbloccare il codice ${el.dataset.codice}? Con questo codice si potrà di nuovo entrare con un link d'invito.`)) return;
    try{ await api.sbloccaCodice(el.dataset.codice); st.codiciTolti = await api.codiciTolti() || []; render(); toast("Codice sbloccato"); }
    catch(e){ toast(messaggio(e)); }
  },
  "mia-chiave"(){ st.sheet = "mia-chiave"; render(); },
  privacy(){ st.sheet = "privacy"; render(); },
  chiudi(){ chiudiSheet(); render(); },
  "ho-gia"(){ st.invitoRiserva = st.invito; st.invito = null; st.fase = "benvenuto"; render(); },
  "torna-invito"(){ st.invito = st.invitoRiserva; st.invitoRiserva = null; st.fase = "ingresso"; render(); },
  "copia-gestito"(){ copiaTesto(base() + "#chiave=" + st.linkGestito.chiave, "Link copiato"); },
  async installa(){
    if(!promptInstalla) return;
    const e = promptInstalla; promptInstalla = null;
    try{ e.prompt(); const r = await e.userChoice; if(r && r.outcome === "accepted") salvaLocale(CHIAVE_INSTALLA_NO, "1"); }catch(x){}
    render();
  },
  "installa-no"(){ salvaLocale(CHIAVE_INSTALLA_NO, "1"); render(); },
  "installa-si"(){ salvaLocale(CHIAVE_INSTALLA_NO, null); salvaLocale(chiavePrimiPassiNo(), null); st.passoAperto = "installa";
    st.vista = "io"; st.sezIo = "giorno"; render(); window.scrollTo(0, 0); },
  "notifiche-si"(){ attivaNotifiche(); },
  "notifiche-no"(){ salvaLocale(chiaveNotificheChiesto(), "1"); render(); },
  "notifiche-spegni"(){ spegniNotifiche(); },
  async "notifiche-prova"(){ try{ const r = await api.notificaProva(); toast(r && r.inviate ? "Notifica di prova inviata" : "Nessun telefono attivo: riattiva le notifiche"); }
    catch(e){ toast("Non riesco a mandare la prova: riprova tra poco"); } },
  "primi-passi-no"(){ salvaLocale(chiavePrimiPassiNo(), "1"); render(); toast("Primi passi nascosti"); },
  "passo-apri"(el){ st.passoAperto = el.getAttribute("aria-expanded") === "true" ? "nessuno" : el.dataset.k; render(); },
  aiuto(el){ const k = el.dataset.k; if(st.aiuti.has(k)) st.aiuti.delete(k); else st.aiuti.add(k); render(); },
  "copia-chiave"(){ copiaTesto(linkPersonale(), "Link copiato: ora aggiungi Growup alla schermata Home"); },
  async "incolla-appunti"(el){
    const f = el.closest("form");
    let t = "";
    try{ t = await navigator.clipboard.readText(); }
    catch(e){ mostraErroreForm(f, "Non riesco a leggere il link copiato: tienilo premuto nel campo qui sotto e scegli Incolla."); return; }
    const l = leggiLink(t);
    if(!l || !l.chiave){ if(f.link) f.link.value = t.slice(0, 300); mostraErroreForm(f, "Quello che hai copiato non è il tuo link personale. Copia il messaggio con il link e riprova."); return; }
    salvaLocale(CHIAVE_SALVATA, "1");
    await entraConChiave(l.chiave);
  },
  "chiave-salvata"(){ salvaLocale(CHIAVE_SALVATA, "1"); render(); toast("Perfetto: ora puoi entrare da qualsiasi telefono"); },
  async "conferma-obiettivi"(){
    try{
      if(!st.goal.salvato) await salvaObiettivi(st.goal.obiettivo_contatti, st.goal.obiettivo_piani);
      if(!st.goalMese.salvato) await salvaObiettivoMese(st.goalMese.obiettivo_vp);
      render(); toast("Obiettivi confermati");
    }catch(e){ toast(messaggio(e)); }
  },
  async elimina(el){
    const id = el.dataset.id;
    const a = lista().find(x => x.id === id);
    if(!a || !confirm(`Eliminare "${ETICHETTE[a.tipo]}${a.vp != null ? " " + num(a.vp) + " VP" : ""}"?`)) return;
    try{
      await api.deleteActivity(id);
      if(st.target){ st.attScheda = st.attScheda.filter(x => x.id !== id); caricaNumeri().then(render).catch(() => {}); }
      else st.att = st.att.filter(x => x.id !== id);
      render(); toast("Eliminato");
    }
    catch(e){ toast(messaggio(e)); }
  },
  copia(){ copiaTesto(linkInvito(), "Link d'invito copiato"); },
  "copia-chiave"(){ copiaTesto(linkPersonale(), "Link personale copiato"); },
  /* l'immagine va nella condivisione del telefono (WhatsApp, Telegram…); se non si può, si apre per salvarla */
  async "condividi-immagine"(el){
    const nome = el.dataset.file;
    try{
      const blob = await (await fetch(nome)).blob();
      const file = new File([blob], nome, { type:"image/png" });
      if(navigator.canShare && navigator.canShare({ files:[file] })){ await navigator.share({ files:[file] }); return; }
    }catch(e){ if(e && e.name === "AbortError") return; }
    window.open(nome, "_blank", "noopener");
    toast("Tieni premuto sull'immagine per salvarla");
  },
  async condividi(){ try{ await navigator.share({ title:"Growup", text:testoInvito(), url:linkInvito() }); }catch(e){} },
  async "condividi-chiave"(){ try{ await navigator.share({ title:"La mia chiave Growup", text:testoChiave(), url:linkPersonale() }); }catch(e){} },
  async "cambia-chiave"(){
    if(!confirm("Creare un link personale nuovo? Quello vecchio smetterà di funzionare e gli altri telefoni dovranno rientrare con il nuovo.")) return;
    try{
      ricordaChiave(await api.cambiaChiave());
      salvaLocale(CHIAVE_SALVATA, null);
      st.sheet = "mia-chiave"; render(); toast("Link nuovo creato: salvalo su WhatsApp o Telegram");
    }catch(e){ toast(messaggio(e)); }
  },
  async esci(){
    const msg = st.chiave
      ? "Uscire da questo telefono? Per rientrare ti servirà il tuo link personale."
      : "Uscire da questo telefono? Questo telefono non ha il tuo link personale: senza, per rientrare dovrai chiederne uno nuovo a Stefano e Alessia.";
    if(!confirm(msg)) return;
    st.sheet = null;
    try{ await api.signOut(); }catch(e){}
    salvaLocale(CHIAVE_LOCALE, null); salvaLocale(CHIAVE_SALVATA, null);
    st.profilo = null; st.chiave = null; st.fase = "benvenuto"; render();
  },
  ricarica(){ location.reload(); },
  annulla(){ const f = toastAnnulla; document.getElementById("toast").innerHTML = ""; toastAnnulla = null; if(f) f(); }
};

function focusSheet(){ const i = document.querySelector(".sheet input"); if(i) setTimeout(() => i.focus(), 30); }

const MODULI = {
  async "invito-sopra"(f){
    const altri = [...f.querySelectorAll("input[name=altri]:checked")].map(i => i.value);
    try{ st.invitoSopra.codice = await api.creaInvitoSopra(st.invitoSopra.id, altri); render(); }
    catch(e){ mostraErroreForm(f, messaggio(e)); }
  },
  importa(f){ return eseguiImport(f); },
  async codice(f){
    const codice = soloCifre(f.codice_amway.value);
    if(!codiceValido(codice)){ mostraErroreForm(f, codice ? MESSAGGI_ERRORE.codice_amway_non_valido : MESSAGGI_ERRORE.codice_amway_mancante); return; }
    try{
      const p = await api.impostaCodice(st.codiceId, codice);
      if(st.codiceId === st.profilo.id) st.profilo = Object.assign({}, st.profilo, { codice_amway:p.codice_amway });
      await caricaStruttura();
      st.sheet = null; render(); toast("Codice Amway salvato");
    }catch(e){ mostraErroreForm(f, messaggio(e)); }
  },
  async incolla(f){
    const l = leggiLink(f.link.value);
    if(!l){ mostraErroreForm(f, "Non sembra un link di Growup. Copia tutto il messaggio con il link e riprova."); return; }
    if(l.chiave){ salvaLocale(CHIAVE_SALVATA, "1"); await entraConChiave(l.chiave); return; }
    await apriInvito(l.invito); render();
  },
  async obiettivo(f){
    const cifra = Number(String(f.cifra.value).replace(/[^\d,.]/g, "").replace(/\./g, "").replace(",", "."));
    const entro = f.entro.value, perche = f.perche.value.trim();
    if(!(cifra > 0)) return mostraErroreForm(f, "Scrivi quanto vorresti guadagnare al mese, per esempio 400.");
    if(!/^\d{4}-\d{2}$/.test(entro)) return mostraErroreForm(f, "Scegli il mese entro cui vuoi arrivarci.");
    if(entro < meseDi(oggi())) return mostraErroreForm(f, "Il mese è già passato: scegline uno da adesso in avanti.");
    const o = { partner_id:st.profilo.id, cifra_mese:cifra, entro:entro + "-01", perche:perche || null, aggiornato_il:new Date().toISOString() };
    try{
      await api.salvaObiettivo(o);
      st.obiettivo = { cifra_mese:cifra, entro:o.entro, perche:o.perche };
      if(st.fase === "obiettivo_primo") st.fase = "home";
      st.sheet = null; st.vista = "obiettivo"; render(); window.scrollTo(0, 0);
      toast("Obiettivo salvato");
    }catch(e){ mostraErroreForm(f, messaggio(e)); }
  },
  async "privacy-primo"(f){
    if(!f.privacy.checked){ mostraErroreForm(f, "Per iniziare serve accettare l'informativa privacy."); return; }
    try{
      await api.accettaPrivacy(st.profilo.id);
      st.profilo.privacy_accettata_il = new Date().toISOString();
      st.fase = st.obiettivo ? "home" : "obiettivo_primo"; render();
    }catch(e){ mostraErroreForm(f, messaggio(e)); }
  },
  chiamata(f){
    const x = st.struttura.find(y => y.id === st.chiamataId);
    if(!x) return;
    const c = datiChiamata(f), err = erroreChiamata(c);
    if(err){ mostraErroreForm(f, err); return; }
    const dati = Object.assign({ nome:x.nome }, c);
    if(suAndroid()){ vaiA(googleCalendar(dati), true); return; }
    apriIcs(creaIcs(dati), x.nome);
    if(!suIos()) toast("Apri il file per aggiungere la chiamata al calendario");
  },
  async "prossima-qualifica"(f){
    if(!f.prossima.value){ mostraErroreForm(f, "Scegli una qualifica."); return; }
    try{
      st.profilo = await api.impostaProssima(f.prossima.value);
      await caricaStruttura();
      st.sheet = null; st.platinoNuovo = false; render(); toast("Prossima qualifica salvata");
    }catch(e){ mostraErroreForm(f, messaggio(e)); }
  },
  async partenza(f){
    const q = leggiQualifica(f);
    if(q.mancaMese){ mostraErroreForm(f, `Indica il ${etichettaMese(q.qualifica).toLowerCase()}.`); return; }
    try{
      st.profilo = await api.modificaPartenza({ p_qualifica:q.qualifica, p_percentuale:q.percentuale,
                           p_qualifica_mese:q.mese, p_pagamenti:q.pagamenti });
      if((q.prossima || null) !== (st.profilo.prossima_qualifica || null)) st.profilo = await api.impostaProssima(q.prossima);
      await caricaStruttura();
      await caricaNumeri();
      st.sheet = null; render(); toast("Punto di partenza aggiornato");
    }catch(e){ mostraErroreForm(f, messaggio(e)); }
  },
  async ingresso(f){
    const nome = f.nome.value.trim();
    const q = leggiQualifica(f);
    const data = q.data, qual = q.qualifica, t = q.tappa;
    let err = "";
    const codice = soloCifre(f.codice_amway.value);
    if(!nome) err = "Scrivi il tuo nome.";
    else if(!codice) err = "Scrivi il tuo codice Amway Partner.";
    else if(!codiceValido(codice)) err = MESSAGGI_ERRORE.codice_amway_non_valido;
    else if(soloCifre(f.codice_amway2.value) !== codice) err = "I due codici non sono uguali: controllali.";
    else if(!qual && !q.percentuale && !data) err = "Se stai iniziando serve la data di iscrizione: fa partire il conto alla rovescia del primo ordine.";
    else if(data && data > oggi()) err = "La data di iscrizione non può essere nel futuro.";
    else if(q.mancaMese) err = `Indica il ${etichettaMese(q.qualifica).toLowerCase()}.`;
    else if(!f.privacy.checked) err = "Per iniziare serve accettare l'informativa privacy.";
    if(err){ mostraErroreForm(f, err); return; }
    st.occupato = true; f.querySelector("button.primary").disabled = true;
    try{
      await sessione();
      const r = await api.join({
        p_codice: st.invito, p_nome: nome, p_codice_amway: codice, p_data_iscrizione: data, p_qualifica: qual,
        p_qualifica_mese: q.mese, p_pagamenti: q.pagamenti, p_percentuale: q.percentuale
      });
      ricordaChiave(r.chiave);
      salvaLocale(CHIAVE_SALVATA, null);
      if(q.prossima){ try{ r.profilo = await api.impostaProssima(q.prossima); }catch(e){} }
      await vaiHome(r.profilo);
      if(st.fase === "home" && !st.obiettivo) st.fase = "obiettivo_primo";
      st.occupato = false; render();
    }catch(e){
      st.occupato = false; f.querySelector("button.primary").disabled = false;
      mostraErroreForm(f, messaggio(e));
    }
  },
  async ordine(f){
    const vp = numIt(f.vp.value);
    const data = f.data.value || oggi();
    if(!(vp > 0) || vp > 100000){ mostraErroreForm(f, "Scrivi i VP dell'ordine (un numero maggiore di zero)."); return; }
    if(data > oggi()){ mostraErroreForm(f, "La data non può essere nel futuro."); return; }
    if(data < primaDataAperta()){ mostraErroreForm(f, MESSAGGI_ERRORE.mese_chiuso); return; }
    st.sheet = null;
    await registra("ordine", { vp:Math.round(vp * 100) / 100, data });
  },
  async obiettivi(f){
    const n = v => Math.max(0, Math.min(1000, Math.round(numIt(v) || 0)));
    try{ await salvaObiettivi(n(f.contatti.value), n(f.piani.value)); st.sheet = null; render(); toast("Obiettivi salvati"); }
    catch(e){ mostraErroreForm(f, messaggio(e)); }
  },
  async "totale-mese"(f){
    const totale = numIt(f.vp.value);
    if(!(totale >= 0) || totale > 100000){ mostraErroreForm(f, "Scrivi il totale dei VP del mese (un numero, anche con la virgola)."); return; }
    const m = st.meseTotale || meseDi(oggi());
    const diff = Math.round((totale - vpAttuale(m)) * 100) / 100;
    st.sheet = null;
    if(diff === 0){ render(); toast("Il totale era già questo"); return; }
    /* nel mese precedente la correzione va all'ultimo giorno di quel mese */
    await registra("rettifica", { vp:diff, data: m === meseDi(oggi()) ? oggi() : piuGiorni(primoDelMese(), -1) });
  },
  async "obiettivo-mese"(f){
    const vp = Math.max(0, Math.min(100000, Math.round((numIt(f.vp.value) || 0) * 100) / 100));
    try{ await salvaObiettivoMese(vp); st.sheet = null; render(); toast("Obiettivo del mese salvato"); }
    catch(e){ mostraErroreForm(f, messaggio(e)); }
  }
};

/* L'errore si mostra senza ridisegnare, così non si perde quel che è scritto. */
function mostraErroreForm(f, msg){
  let p = f.querySelector(".errore");
  if(!p){ p = document.createElement("p"); p.className = "errore"; f.appendChild(p); }
  p.textContent = msg;
}

/* ---- 11b. Persone: la Lista (dalla mini app "Dalla Lista al Sì") ----
   Ognuno ha qui i nomi della sua lista e il percorso fino al sì. Nomi e dettagli li vede solo lui (RLS "solo mio");
   allo sponsor e all'upline arrivano soltanto i numeri. Segnare un passo conta da solo l'attività
   (Contatto, Piano, Chiusura "Cliente"): lo fa il database. */
const FASI = [
  { id:"lista", nome:"In lista" }, { id:"contattato", nome:"Contattato" }, { id:"invitato", nome:"Invitato" },
  { id:"piano", nome:"Piano fatto" }, { id:"followup", nome:"Follow-up" }];
const ESITI = { partner:"Partner", cliente:"Cliente", non_ora:"Non ora", no:"No" };
const TIPI_PASSO = {
  contatto: { nome:"Contatto", come:["Telefono", "Messaggio", "Di persona", "Social"],
    reazione:["Aperto, incuriosito", "Gentile ma tiepido", "Dice che ha poco tempo", "Non ha risposto"], prossima:"Quando ci ritorni sopra" },
  invito: { nome:"Invito", come:["Piano a casa", "Videochiamata", "Uno-a-uno al bar", "Evento"],
    reazione:["Sì, appuntamento fissato", "Deve confermare", "Ha rimandato", "No"], prossima:"Data dell'appuntamento" },
  piano: { nome:"Piano", come:["A casa sua", "A casa mia", "Videochiamata", "Al bar", "Evento"],
    reazione:["Molto interessato", "Interessato", "Deve pensarci", "Poco interessato", "Non si è presentato"], prossima:"Quando lo risenti" },
  followup: { nome:"Follow-up", come:["Telefono", "Messaggio", "Di persona", "Videochiamata"],
    reazione:["Vuole partire", "Ha ancora dubbi", "Deve parlarne in famiglia", "Ha rimandato", "Non ha risposto"], prossima:"Quando lo risenti" },
  chiusura: { nome:"Chiusura", prossima:"" },
  nota: { nome:"Nota", prossima:"Prossima cosa da fare" }
};
const PROSSIMA_CHIUSURA = { partner:"Primo passo insieme", cliente:"Quando risentirlo", non_ora:"Quando riprovare", no:"" };
/* "Non ora": tra quanti mesi risentirlo (il promemoria arriva 2 giorni prima) */
const RISENTI = [["1", "1 mese"], ["3", "3 mesi"], ["6", "6 mesi"], ["12", "1 anno"]], RISENTI_PRIMA = 2;
function piuMesi(d, m){ const x = new Date(d + "T00:00:00Z"); x.setUTCMonth(x.getUTCMonth() + m); return x.toISOString().slice(0, 10); }
const FILTRI_LISTA = [
  { id:"aperti", nome:"Aperti", ok:p => !p.esito },
  { id:"lista", nome:"In lista", ok:p => !p.esito && p.fase === "lista" },
  { id:"corso", nome:"In corso", ok:p => !p.esito && p.fase !== "lista" },
  { id:"riprendere", nome:"Da riprendere", ok:p => p.esito === "non_ora" },
  { id:"chiusi", nome:"Chiusi", ok:p => p.esito && p.esito !== "non_ora" }];

function uuid(){ return crypto.randomUUID ? crypto.randomUUID()
  : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)); }
async function caricaPersone(){
  try{
    const [persone, passi] = await Promise.all([api.persone(), api.passi()]);
    st.persone = persone || []; st.passi = passi || [];
  }catch(e){ st.persone = st.persone || []; st.passi = st.passi || []; }
}
function passiDi(id){ return st.passi.filter(s => s.persona_id === id).sort((a, b) => a.data < b.data ? 1 : a.data > b.data ? -1 : a.creato_il < b.creato_il ? 1 : -1); }
function indiceFase(f){ return Math.max(0, FASI.findIndex(x => x.id === f)); }
function aperta(p){ return !p.esito || p.esito === "non_ora"; }
function passoProposto(p){
  return p.esito ? "nota" : { lista:"contatto", contattato:"invito", invitato:"piano", piano:"followup", followup:"chiusura" }[p.fase] || "contatto";
}
function testoProssima(p){
  if(!p.prossima_data) return "";
  const g = giorniTra(oggi(), p.prossima_data);
  return `${g < 0 ? "In ritardo · " : g === 0 ? "Oggi · " : g === 1 ? "Domani · " : ""}${dataIt(p.prossima_data)}${p.prossima_nota ? " · " + p.prossima_nota : ""}`;
}
/* Su Io, come promemoria: tutte le persone con cui è iniziato un percorso (da Contattato in poi), aperte o "Non ora"
   con una data, tranne quelle che ho tolto da Io. Prima chi ha una data (in ritardo, oggi, prossimi giorni), poi le altre. */
function ultimoPasso(p){ const s = passiDi(p.id)[0]; return s ? s.data : String(p.creato_il || oggi()).slice(0, 10); }
function daFare(){
  const l = st.persone.filter(p => !p.nascosta_io && p.fase !== "lista" && (!p.esito || (p.esito === "non_ora" && p.prossima_data)));
  const conData = l.filter(p => p.prossima_data).sort((a, b) => a.prossima_data < b.prossima_data ? -1 : 1);
  return {
    ritardo: conData.filter(p => p.prossima_data < oggi()),
    oggi: conData.filter(p => p.prossima_data === oggi()),
    presto: conData.filter(p => p.prossima_data > oggi() && p.prossima_data <= piuGiorni(oggi(), 4)),
    corso: l.filter(p => !p.prossima_data || p.prossima_data > piuGiorni(oggi(), 4))
      .sort((a, b) => indiceFase(b.fase) - indiceFase(a.fase) || (ultimoPasso(a) < ultimoPasso(b) ? -1 : 1))
  };
}

function vDaFare(){
  const d = daFare(), gruppi = [["In ritardo", d.ritardo], ["Oggi", d.oggi], ["Prossimi giorni", d.presto], ["In corso", d.corso]]
    .filter(([, l]) => l.length);
  if(!gruppi.length) return "";
  return `<div class="card">
    <span class="con-aiuto"><span class="eyebrow">Il tuo percorso con la lista</span>${aiutoBtn("lista-io")}</span>
    ${aiutoTesto("lista-io", `Le persone della tua Lista da risentire: prima chi è in ritardo, poi chi ha la data oggi o nei prossimi giorni.
      Con × togli una persona solo da qui (resta nella Lista): ricompare quando segni un passo o fissi una nuova data, oppure
      dalla sua scheda con «Rimetti in Io».`)}
    ${gruppi.map(([t, l]) => `<p class="small da-fare-t">${t}</p>
      <ul class="persone">${l.map(p => rigaPersona(p, true)).join("")}</ul>`).join("")}
  </div>`;
}
/* registrato come cliente sul sito Amway (ha il codice cliente) ma senza nessun ordine */
function maiComprato(p){ return !!p.codice_cliente && p.esito !== "cliente" && !st.ordini.some(o => o.persona_id === p.id); }
function rigaPersona(p, suIo){
  const f = FASI[indiceFase(p.fase)], fermo = !p.prossima_data && !p.esito && p.fase !== "lista" ? giorniTra(ultimoPasso(p), oggi()) : 0;
  return `<li class="${suIo ? "su-io" : ""}"><button class="persona" data-act="apri-persona" data-id="${esc(p.id)}">
      <span class="grow"><b>${esc(p.nome)}</b>${maiComprato(p) ? ` <span class="pill g mini">Mai comprato</span>` : ""}<br><span class="small">${p.esito ? ESITI[p.esito] : f.nome}${p.prossima_data ? " · " + esc(testoProssima(p))
        : fermo >= 14 ? ` · nessun passo da ${fermo} giorni` : ""}</span></span>
      <span class="punti" aria-hidden="true">${FASI.map((x, i) => `<i class="${i <= indiceFase(p.fase) ? "on" : ""}"></i>`).join("")}</span>
    </button>${suIo ? `<button class="x" data-act="togli-da-io" data-id="${esc(p.id)}" aria-label="Togli ${esc(p.nome)} da Io">×</button>` : ""}</li>`;
}

function vPersone(){
  if(st.sezPersone === "clienti") return vClienti();
  if(st.sezPersone === "target") return vTarget();
  if(st.personaId) return vPersona();
  const filtro = FILTRI_LISTA.find(x => x.id === st.filtroLista) || FILTRI_LISTA[0];
  const q = senzaAccenti(st.cercaLista || "");
  /* i clienti stanno in Clienti, non nella lista */
  const nellaLista = st.persone.filter(p => p.esito !== "cliente");
  const l = nellaLista.filter(filtro.ok).filter(p => !q || senzaAccenti(p.nome + " " + (p.origine || "")).includes(q))
    .sort((a, b) => (a.prossima_data || "9999") < (b.prossima_data || "9999") ? -1 : (a.prossima_data || "9999") > (b.prossima_data || "9999") ? 1
      : a.nome.localeCompare(b.nome, "it"));
  return `<div class="card">
    <div class="spread"><span class="con-aiuto"><span class="eyebrow">La mia lista</span>${aiutoBtn("lista")}</span>
      <span class="row" style="gap:6px"><button class="btn small" data-act="persone-tante">Più nomi</button>
      <button class="btn small primary" data-act="persona-nuova">+ Un nome</button></span></div>
    ${aiutoTesto("lista", `Qui scrivi i nomi delle persone che conosci e segui ogni contatto passo per passo. I nomi li vedi solo tu:
      alla tua upline arrivano solo i numeri (quanti contatti, quanti piani).`)}
    ${st.persone.length ? `
    <input type="search" id="cerca-lista" class="cerca" placeholder="Cerca un nome…" autocomplete="off" aria-label="Cerca un nome" value="${esc(st.cercaLista || "")}">
    <div class="row wrap scelte-rapide" style="gap:6px;margin-top:8px">${FILTRI_LISTA.map(x => {
      const n = nellaLista.filter(x.ok).length;
      return `<button class="btn small${x.id === filtro.id ? " on" : ""}" data-act="filtro-lista" data-filtro="${x.id}" aria-pressed="${x.id === filtro.id}">${x.nome} · ${n}</button>`; }).join("")}</div>
    ${l.length ? `<ul class="persone">${l.map(p => rigaPersona(p)).join("")}</ul>` : `<p class="muted" style="margin:10px 0 0">Nessun nome qui.</p>`}`
    : `<p class="muted" style="margin:8px 0 0">La tua lista è vuota. Scrivi i nomi delle persone che conosci: amici, parenti,
        colleghi, vicini. Basta il nome; il resto lo aggiungi quando serve.</p>`}
    ${st.persone.length ? `<p class="nota"><button class="btn link small" data-act="scarica-persone" style="min-height:0;padding:0">Scarica una copia della mia lista</button></p>` : ""}
  </div>`;
}

function vPersona(){
  const p = st.persone.find(x => x.id === st.personaId);
  if(!p) return `<button class="btn link" data-act="torna-lista" style="padding:0">‹ La mia lista</button><p class="muted">Nome non trovato.</p>`;
  const i = indiceFase(p.fase), passi = passiDi(p.id), tel = String(p.contatto || "").replace(/[^\d+]/g, "");
  const telefono = tel.replace(/\D/g, "").length >= 6;
  return `<button class="btn link" data-act="torna-lista" style="padding:0">‹ La mia lista</button>
  <div class="card">
    <div class="spread"><h2><button class="nome-modifica" data-act="persona-modifica" aria-label="Modifica i dati di ${esc(p.nome)}">${esc(p.nome)} <span aria-hidden="true">✎</span></button></h2>${maiComprato(p) ? `<span class="pill g">Mai comprato</span>` : ""}${p.esito ? `<span class="pill ${p.esito === "partner" || p.esito === "cliente" ? "v" : p.esito === "no" ? "r" : "g"}">${ESITI[p.esito]}</span>` : ""}</div>
    ${p.contatto || p.origine ? `<p class="small" style="margin:2px 0 0">${[p.contatto, p.origine].filter(Boolean).map(esc).join(" · ")}</p>` : ""}
    ${(() => { const x = p.invito_target_id && st.inviti.find(y => y.id === p.invito_target_id);
      return x ? `<p class="small" style="margin:6px 0 0">Target: <b>${esc(statoInvito(x).txt)}</b>
        <button class="btn link small" data-act="apri-invito" data-id="${esc(x.id)}" style="min-height:0;padding:0 4px">${x.risposte ? "Vedi le risposte" : "Apri l'invito"}</button></p>`
        : `<button class="btn small ghost" style="margin-top:8px" data-act="target-da-persona">Manda le 8 domande (Target)</button>`; })()}
    ${telefono ? `<div class="row" style="gap:6px;margin-top:8px">
      <a class="btn small" href="tel:${esc(tel)}">Chiama</a>
      <a class="btn small wa" target="_blank" rel="noopener" href="https://wa.me/${esc(tel.replace(/^\+/, "").replace(/^(?=3)/, "39"))}">WhatsApp</a></div>` : ""}
    <ol class="percorso-persona" aria-label="Percorso">${FASI.map((x, k) => `<li class="${k < i ? "fatta" : k === i ? "qui" : ""}"><i></i><span>${x.nome}</span></li>`).join("")}</ol>
    <div class="prossima">
      <span class="small">Prossima cosa</span>
      <b>${p.prossima_data ? esc(testoProssima(p)) : "Nessuna data"}</b>
      <span class="row" style="gap:6px;margin-top:6px">
        <button class="btn small" data-act="prossima">${p.prossima_data ? "Cambia" : "Fissa una data"}</button>
        ${p.prossima_data ? `<button class="btn small ghost" data-act="persona-calendario">Nel calendario</button>` : ""}</span>
    </div>
    <button class="btn primary wide" style="margin-top:12px" data-act="passo">Segna un passo · ${TIPI_PASSO[passoProposto(p)].nome}</button>
    ${p.esito === "partner" ? `<a class="btn wa wide" style="margin-top:8px" target="_blank" rel="noopener"
        href="https://wa.me/?text=${encodeURIComponent(testoInvito() + "\n\n" + linkInvito())}">Mandagli il tuo link d'invito</a>` : ""}
    ${p.esito === "cliente" ? `<button class="btn wide" style="margin-top:8px" data-act="apri-cliente" data-id="${esc(p.id)}">Apri nei Clienti</button>` : ""}
    ${p.esito ? `<button class="btn ghost wide" style="margin-top:8px" data-act="riapri-persona">Riapri il percorso</button>` : ""}
    ${p.note ? `<p class="small" style="margin:10px 0 0;white-space:pre-wrap">${esc(p.note)}</p>` : ""}
  </div>
  <div class="card">
    <span class="eyebrow">I passi</span>
    ${passi.length ? `<ul class="oggi">${passi.map(s => `<li>
      <span class="grow"><b>${s.tipo === "chiusura" ? `Chiusura · ${ESITI[s.esito]}` : s.tipo === "riapri" ? "Percorso riaperto" : TIPI_PASSO[s.tipo].nome}</b>
        ${[s.come, s.reazione].filter(Boolean).length ? `<br><span class="small">${[s.come, s.reazione].filter(Boolean).map(esc).join(" · ")}</span>` : ""}
        ${s.nota ? `<br><span class="small">${esc(s.nota)}</span>` : ""}</span>
      <span class="small">${dataIt(s.data)}</span>
      <button class="x" data-act="togli-passo" data-id="${esc(s.id)}" aria-label="Togli il passo">×</button></li>`).join("")}</ul>`
      : `<p class="muted" style="margin:6px 0 0">Ancora nessun passo. Il primo è il contatto.</p>`}
  </div>
  <div class="row" style="gap:6px;justify-content:center">
    ${p.fase !== "lista" ? `<button class="btn small ghost" data-act="${p.nascosta_io ? "rimetti-in-io" : "togli-da-io"}" data-id="${esc(p.id)}">${p.nascosta_io ? "Rimetti in Io" : "Togli da Io"}</button>` : ""}
    <button class="btn small ghost" data-act="persona-cancella">Togli dalla lista</button>
  </div>`;
}

/* I numeri della lista di chi è nei Preferiti: si chiedono una volta sola, poi si ridisegna */
const numeriChiesti = new Set();
function chiediNumeriLista(pid){
  if(!numeriChiesti.has(pid)){
    numeriChiesti.add(pid);
    api.numeriPersone(pid).then(n => { st.numeriLista[pid] = n; render(); }).catch(() => {});
  }
  return pid;
}
/* Il numero della lista di una persona del gruppo (per sponsor e upline: mai i nomi) */
function vNumeriLista(pid){
  const n = st.numeriLista[pid];
  if(!n || !Number(n.totale)) return "";
  return `<p class="small" style="margin:8px 0 0">La sua lista: <b>${num(n.in_lista)}</b> in lista · <b>${num(n.in_corso)}</b> in corso ·
    questo mese <b>${num(n.piani_mese)}</b> ${Number(n.piani_mese) === 1 ? "piano" : "piani"}${n.partner_mese != null
      ? `, <b>${num(n.partner_mese)}</b> partner e <b>${num(n.clienti_mese)}</b> ${Number(n.clienti_mese) === 1 ? "cliente nuovo" : "clienti nuovi"}`
      : ` e <b>${num(n.si_mese)}</b> sì`}${n.clienti != null ? ` · <b>${num(n.clienti)}</b> ${Number(n.clienti) === 1 ? "cliente" : "clienti"} in tutto` : ""}</p>`;
}

function opzioni(nome, valori, scelto){
  return `<div class="opzioni">${valori.map(v => `<label class="chip"><input type="radio" name="${nome}" value="${esc(v)}"${v === scelto ? " checked" : ""}><span>${esc(v)}</span></label>`).join("")}</div>`;
}
function campiProssima(titolo, p){
  return `<fieldset class="field"><legend>${esc(titolo)}</legend>
      <div class="opzioni">${[["", "Nessuna"], ["1", "Domani"], ["3", "Tra 3 giorni"], ["7", "Tra una settimana"]].map(([v, t]) =>
        `<label class="chip"><input type="radio" name="tra" value="${v}"${v === "" && !p ? " checked" : ""}><span>${t}</span></label>`).join("")}</div>
      <input type="date" name="prossima_data" min="${oggi()}" value="${esc(p && p.prossima_data || "")}" aria-label="Oppure scegli il giorno">
      <input name="prossima_nota" maxlength="200" placeholder="Cosa (facoltativo)" value="${esc(p && p.prossima_nota || "")}"></fieldset>`;
}
function leggiProssima(f){
  const tra = (f.querySelector("input[name=tra]:checked") || {}).value || "";
  const data = f.prossima_data.value || (tra ? piuGiorni(oggi(), Number(tra)) : null);
  return { prossima_data:data, prossima_nota:data ? f.prossima_nota.value.trim() || null : null };
}

/* per + Piano: le persone ancora in percorso, prima quelle più avanti (invitate), poi per nome */
function personePiano(q){
  const t = senzaAccenti(q || "");
  const l = st.persone.filter(p => aperta(p) && (!t || senzaAccenti(p.nome).includes(t)))
    .sort((a, b) => indiceFase(b.fase) - indiceFase(a.fase) || a.nome.localeCompare(b.nome, "it")).slice(0, 8);
  return l.length ? l.map(p => `<li><button type="button" class="persona" data-act="piano-con" data-id="${esc(p.id)}">
      <span class="grow"><b>${esc(p.nome)}</b><br><span class="small">${FASI[indiceFase(p.fase)].nome}</span></span><b>›</b></button></li>`).join("")
    : `<li class="muted small">${t ? "Nessun nome così nella lista." : "La lista è vuota."}</li>`;
}
document.addEventListener("input", e => {
  if(e.target && e.target.id === "cerca-piano"){ st.cercaPiano = e.target.value; const u = document.getElementById("risultati-piano"); if(u) u.innerHTML = personePiano(e.target.value); }
});
function vSheetPersone(s){
  const p = st.persone.find(x => x.id === st.personaId);
  const annulla = `<button type="button" class="btn ghost grow" data-act="chiudi">Annulla</button>`;
  if(s === "persona-nuova" || (s === "persona-modifica" && p)){
    const m = s === "persona-modifica" ? p : {};
    const rapido = !m.id && st.rapido === "contatto";
    return `<h2>${m.id ? "Modifica i dati" : st.nuovoCliente ? "Un nuovo cliente" : rapido ? "Un contatto" : "Un nome nella tua lista"}</h2>
    ${rapido ? `<p class="small">Entra nella tua lista già come Contattato e conta nei contatti della settimana.
      Se è già nella lista, scrivi il nome uguale: il contatto si segna su di lei.</p>` : ""}
    <form data-form="${s}" novalidate>
      <label class="field"><span>Nome</span><input name="nome" maxlength="80" required value="${esc(m.nome || "")}" autocomplete="off"></label>
      <label class="field"><span>Telefono o contatto <i>(facoltativo)</i></span><input name="contatto" maxlength="80" inputmode="tel" value="${esc(m.contatto || "")}"></label>
      <label class="field"><span>Come lo conosci <i>(facoltativo)</i></span><input name="origine" maxlength="80" placeholder="es. collega, palestra, cugino" value="${esc(m.origine || "")}"></label>
      ${m.id && (m.esito === "cliente" || m.codice_cliente) ? (() => { const [mm, gg] = (m.compleanno || "-").split("-");
        return `<label class="field"><span>Codice cliente Amway <i>(facoltativo)</i></span><input name="codice_cliente" inputmode="numeric" maxlength="15" value="${esc(m.codice_cliente || "")}"></label>
        <div class="row" style="gap:8px">
          <label class="field grow"><span>Compleanno: giorno</span><input name="giorno" type="number" min="1" max="31" inputmode="numeric" value="${esc(gg ? Number(gg) : "")}"></label>
          <label class="field grow"><span>Mese</span><select name="mese"><option value=""></option>${MESI_LUNGHI.map((x, i) => `<option value="${i + 1}"${Number(mm) === i + 1 ? " selected" : ""}>${x}</option>`).join("")}</select></label></div>`; })() : ""}
      ${m.id ? `<label class="field"><span>Note</span><textarea name="note" rows="3" maxlength="2000">${esc(m.note || "")}</textarea></label>` : ""}
      <div class="row" style="margin-top:16px">${annulla}<button class="btn primary grow">Salva</button></div>
      ${rapido ? `<button type="button" class="btn ghost wide" style="margin-top:8px" data-act="senza-nome" data-tipo="contatto">Senza nome: conta solo il contatto</button>` : ""}
    </form>`;
  }
  if(s === "piano-chi") return `<h2>Un piano: con chi?</h2>
    <p class="small">Scegli la persona e compila il piano: conta nei piani della settimana.</p>
    <input type="search" id="cerca-piano" class="cerca" placeholder="Cerca nella tua lista…" autocomplete="off" value="${esc(st.cercaPiano || "")}">
    <ul class="persone" id="risultati-piano">${personePiano(st.cercaPiano)}</ul>
    <form data-form="piano-nuovo" novalidate style="margin-top:10px">
      <label class="field"><span>Non è nella lista? Scrivi il nome</span><input name="nome" maxlength="80" autocomplete="off"></label>
      <div class="row" style="margin-top:8px">${annulla}<button class="btn primary grow">Avanti</button></div>
    </form>
    <button type="button" class="btn ghost wide" style="margin-top:8px" data-act="senza-nome" data-tipo="piano">Senza nome: conta solo il piano</button>`;
  if(s === "persone-tante") return `<h2>Più nomi insieme</h2>
    <p class="small">Uno per riga. Se vuoi, dopo una virgola il telefono e come lo conosci: <i>Mario Rossi, 333 1234567, collega</i></p>
    <form data-form="persone-tante" novalidate>
      <textarea name="righe" rows="8" maxlength="20000" aria-label="Nomi, uno per riga"></textarea>
      <div class="row" style="margin-top:16px">${annulla}<button class="btn primary grow">Aggiungi</button></div>
    </form>`;
  if(s === "passo" && p){
    const tipo = st.passoTipo || passoProposto(p), t = TIPI_PASSO[tipo];
    return `<h2>${esc(nomeSaluto(p.nome))}: segna un passo</h2>
    <div class="opzioni tipi">${Object.keys(TIPI_PASSO).map(k => `<button type="button" class="btn small${k === tipo ? " on" : ""}" data-act="tipo-passo" data-tipo="${k}" aria-pressed="${k === tipo}">${TIPI_PASSO[k].nome}</button>`).join("")}</div>
    ${tipo === "nota" ? `<form data-form="passo" novalidate>
      <label class="field"><span>La nota</span><textarea name="nota" rows="5" maxlength="1000" aria-label="La nota"></textarea></label>
      <p class="nota">La nota compare tra i passi della scheda e nelle Note dei suoi dati (toccando il nome).</p>
      <div class="row" style="margin-top:16px">${annulla}<button class="btn primary grow">Salva</button></div>
    </form>` : `<form data-form="passo" novalidate>
      <label class="field"><span>Quando</span><input type="date" name="data" max="${oggi()}" value="${oggi()}"></label>
      ${t.come ? `<fieldset class="field"><legend>Come</legend>${opzioni("come", t.come)}</fieldset>
        <fieldset class="field"><legend>${tipo === "piano" ? "Com'è andato" : "Come ha reagito"}</legend>${opzioni("reazione", t.reazione)}</fieldset>` : ""}
      ${tipo === "chiusura" ? `<fieldset class="field"><legend>Com'è finita</legend>${opzioni("esito", Object.values(ESITI))}</fieldset>` : ""}
      <label class="field"><span>Nota <i>(facoltativa)</i></span><input name="nota" maxlength="1000"></label>
      ${tipo === "chiusura" ? `<div data-per-esito="partner" hidden>${campiProssima("Prossima cosa", null)}</div>
        <fieldset class="field" data-per-esito="non_ora" hidden><legend>Tra quanto lo risenti</legend>
          <div class="opzioni">${RISENTI.map(([v, t]) => `<label class="chip"><input type="radio" name="risenti" value="${v}"${v === "3" ? " checked" : ""}><span>${t}</span></label>`).join("")}</div>
          <input type="date" name="risenti_data" min="${piuGiorni(oggi(), 3)}" aria-label="Oppure scegli il giorno">
          <p class="nota">Te lo ricordo 2 giorni prima.</p></fieldset>`
        : campiProssima(t.prossima, null)}
      <div class="row" style="margin-top:16px">${annulla}<button class="btn primary grow">Salva</button></div>
    </form>`}`;
  }
  if(s === "prossima" && p) return `<h2>Prossima cosa con ${esc(nomeSaluto(p.nome))}</h2>
    <form data-form="prossima" novalidate>
      ${campiProssima("Quando", p)}
      <div class="row" style="margin-top:16px">${annulla}<button class="btn primary grow">Salva</button></div>
    </form>`;
  return "";
}

/* chiudendo un foglio aperto dai pulsanti rapidi di Io non resta niente di mezzo */
function chiudiSheet(){ st.sheet = null; st.ordiniInAttesa = null; st.erroriAmway = []; if(st.rapido === "piano"){ st.personaId = null; st.passoTipo = null; } st.rapido = null; }
async function dopoPersone(msg){
  /* + Piano da Io: finito il passo si resta su Io, senza una scheda aperta in Persone */
  if(st.rapido === "piano"){ st.rapido = null; st.personaId = null; }
  await caricaPersone();
  aggiornaAttivita();     // i passi contano contatti e piani della settimana
  await caricaInviti();   // togliendo una persona, il suo invito Target si scollega
  await caricaClienti();  // e i suoi ordini
  st.sheet = null; st.passoTipo = null; render();
  if(msg) toast(msg);
  aggiornaAttivita();  // i passi contano contatti, piani e clienti: si aggiornano anche i numeri di Io
}

Object.assign(AZIONI, {
  "vista-persone"(){ st.vista = "persone"; st.personaId = null; st.invitoId = null; st.target = null; render(); window.scrollTo(0, 0); },
  "apri-persona"(el){ st.vista = "persone"; st.sezPersone = "lista"; st.invitoId = null; st.personaId = el.dataset.id; render(); window.scrollTo(0, 0); },
  "torna-lista"(){ st.personaId = null; render(); window.scrollTo(0, 0); },
  "filtro-lista"(el){ st.filtroLista = el.dataset.filtro; render(); },
  "persona-nuova"(){ st.errore = ""; st.nuovoCliente = false; st.rapido = null; st.sheet = "persona-nuova"; render(); },
  /* i pulsanti rapidi di Io: + Contatto apre "un nome", + Piano apre il passo Piano di una persona */
  "contatto-rapido"(){ st.errore = ""; st.nuovoCliente = false; st.rapido = "contatto"; st.sheet = "persona-nuova"; render(); },
  "piano-rapido"(){ st.errore = ""; st.rapido = "piano"; st.cercaPiano = ""; st.sheet = "piano-chi"; render(); },
  "piano-con"(el){ st.personaId = el.dataset.id; st.passoTipo = "piano"; st.sheet = "passo"; render(); },
  async "senza-nome"(el){ const tipo = el.dataset.tipo; st.rapido = null; st.sheet = null; render(); await registra(tipo); },
  "persone-tante"(){ st.errore = ""; st.sheet = "persone-tante"; render(); },
  "persona-modifica"(){ st.errore = ""; st.sheet = "persona-modifica"; render(); },
  passo(){ st.passoTipo = null; st.errore = ""; st.sheet = "passo"; render(); },
  "tipo-passo"(el){ st.passoTipo = el.dataset.tipo; render(); },
  async "togli-da-io"(el){
    try{ await api.modificaPersona(el.dataset.id, { nascosta_io:true }); await dopoPersone(`${nomeSaluto((st.persone.find(x => x.id === el.dataset.id) || {}).nome || "")} tolto da Io`); }
    catch(e){ toast(messaggio(e)); }
  },
  async "rimetti-in-io"(el){
    try{ await api.modificaPersona(el.dataset.id, { nascosta_io:false }); await dopoPersone("Di nuovo in Io"); }
    catch(e){ toast(messaggio(e)); }
  },
  prossima(){ st.errore = ""; st.sheet = "prossima"; render(); },
  async "persona-cancella"(){
    const p = st.persone.find(x => x.id === st.personaId);
    if(!p || !confirm(`Togliere ${p.nome} dalla tua lista? Si cancellano anche i suoi passi (i numeri già contati restano).`)) return;
    try{ await api.cancellaPersona(p.id); st.personaId = null; await dopoPersone(`${p.nome} tolto dalla lista`); }catch(e){ toast(messaggio(e)); }
  },
  async "togli-passo"(el){
    if(!confirm("Togliere questo passo? Se aveva contato un contatto, un piano o un cliente, si toglie anche quello.")) return;
    try{ await api.cancellaPasso(el.dataset.id); await dopoPersone("Passo tolto"); }catch(e){ toast(messaggio(e)); }
  },
  async "riapri-persona"(){
    try{
      await api.nuoviPassi([{ id:uuid(), persona_id:st.personaId, tipo:"riapri", data:oggi() }]);
      await api.modificaPersona(st.personaId, { nascosta_io:false });
      await dopoPersone("Percorso riaperto");
    }
    catch(e){ toast(messaggio(e)); }
  },
  "persona-calendario"(){
    const p = st.persone.find(x => x.id === st.personaId);
    if(!p || !p.prossima_data) return;
    const dati = { nome:p.nome, data:p.prossima_data, ora:"10:00", minuti:15, avviso:15, note:p.prossima_nota || "" };
    if(suAndroid()){ vaiA(googleCalendar(dati), true); return; }
    apriIcs(creaIcs(dati), p.nome);
  },
  "scarica-persone"(){
    const dati = JSON.stringify({ app:"Growup Team · la mia lista", creata_il:new Date().toISOString(), persone:st.persone, passi:st.passi }, null, 2);
    const url = URL.createObjectURL(new Blob([dati], { type:"application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = `growup-lista-${oggi()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
});

Object.assign(MODULI, {
  async "persona-nuova"(f){
    const nome = f.nome.value.trim();
    if(!nome){ mostraErroreForm(f, "Scrivi il nome."); return; }
    try{
      /* + Contatto da Io: la persona entra già contattata (il passo conta il contatto della settimana) e si resta su Io;
         se il nome è già nella lista il contatto si segna su di lei */
      if(st.rapido === "contatto"){
        const gia = st.persone.find(p => senzaAccenti(p.nome) === senzaAccenti(nome)), pid = gia ? gia.id : uuid();
        if(!gia) await api.nuovePersone([{ id:pid, nome, contatto:f.contatto.value.trim() || null, origine:f.origine.value.trim() || null }]);
        await api.nuoviPassi([{ id:uuid(), persona_id:pid, tipo:"contatto", data:oggi() }]);
        if(gia && gia.nascosta_io) await api.modificaPersona(pid, { nascosta_io:false });
        st.rapido = null;
        await dopoPersone(`Contatto con ${nomeSaluto(nome)} registrato`);
        return;
      }
      const id = uuid();
      await api.nuovePersone([{ id, nome, contatto:f.contatto.value.trim() || null, origine:f.origine.value.trim() || null }]);
      st.vista = "persone";
      if(st.nuovoCliente){
        st.personaId = id;
        /* un cliente nuovo: nella lista è chiuso come Cliente (e conta nei nuovi clienti del mese) */
        await api.nuoviPassi([{ id:uuid(), persona_id:id, tipo:"chiusura", esito:"cliente", data:oggi() }]);
        st.nuovoCliente = false; st.sezPersone = "clienti";
        await dopoPersone(`${nome} tra i tuoi clienti`);
        return;
      }
      await dopoPersone(`${nome} nella tua lista`);
    }catch(e){ mostraErroreForm(f, messaggio(e)); }
  },
  async "piano-nuovo"(f){
    const nome = f.nome.value.trim();
    if(!nome){ mostraErroreForm(f, "Scrivi il nome, oppure scegli una persona qui sopra."); return; }
    try{
      const gia = st.persone.find(p => senzaAccenti(p.nome) === senzaAccenti(nome)), id = gia ? gia.id : uuid();
      if(!gia){ await api.nuovePersone([{ id, nome }]); await caricaPersone(); }
      st.personaId = id; st.passoTipo = "piano"; st.sheet = "passo"; render();
    }catch(e){ mostraErroreForm(f, messaggio(e)); }
  },
  async "persona-modifica"(f){
    const nome = f.nome.value.trim();
    if(!nome){ mostraErroreForm(f, "Scrivi il nome."); return; }
    const campi = { nome, contatto:f.contatto.value.trim() || null, origine:f.origine.value.trim() || null, note:f.note.value.trim() || null };
    if(f.codice_cliente){
      const cod = f.codice_cliente.value.replace(/\D/g, "");
      if(cod && !/^\d{4,15}$/.test(cod)){ mostraErroreForm(f, "Il codice cliente sono solo cifre (da 4 a 15)."); return; }
      const g = Number(f.giorno.value), m = Number(f.mese.value);
      if((g || m) && !(g >= 1 && g <= 31 && m >= 1 && m <= 12)){ mostraErroreForm(f, "Per il compleanno scegli giorno e mese."); return; }
      Object.assign(campi, { codice_cliente:cod || null, compleanno:g && m ? `${String(m).padStart(2, "0")}-${String(g).padStart(2, "0")}` : null });
    }
    try{
      await api.modificaPersona(st.personaId, campi);
      await dopoPersone("Dati salvati");
    }catch(e){ mostraErroreForm(f, messaggio(e)); }
  },
  async "persone-tante"(f){
    const presenti = new Set(st.persone.map(p => senzaAccenti(p.nome)));
    const righe = f.righe.value.split(/\r?\n/).map(r => r.split(",").map(x => x.trim())).filter(r => r[0]);
    const nuove = [];
    for(const [nome, contatto, ...resto] of righe){
      const k = senzaAccenti(nome);
      if(presenti.has(k)) continue;
      presenti.add(k);
      nuove.push({ id:uuid(), nome:nome.slice(0, 80), contatto:(contatto || "").slice(0, 80) || null, origine:resto.join(", ").slice(0, 80) || null });
    }
    if(!nuove.length){ mostraErroreForm(f, righe.length ? "Questi nomi sono già nella tua lista." : "Scrivi almeno un nome."); return; }
    try{
      for(let i = 0; i < nuove.length; i += 200) await api.nuovePersone(nuove.slice(i, i + 200));
      await dopoPersone(plur(nuove.length, "nome aggiunto", "nomi aggiunti"));
    }catch(e){ mostraErroreForm(f, messaggio(e)); }
  },
  async passo(f){
    const p = st.persone.find(x => x.id === st.personaId);
    if(!p) return;
    const tipo = st.passoTipo || passoProposto(p);
    /* la nota va nei dati della persona (con la data davanti), non tra i passi */
    if(tipo === "nota"){
      const t = f.nota.value.trim();
      if(!t){ mostraErroreForm(f, "Scrivi la nota."); return; }
      try{
        /* la nota compare tra i passi della scheda e nelle Note dei dati */
        await api.nuoviPassi([{ id:uuid(), persona_id:p.id, tipo:"nota", data:oggi(), nota:t }]);
        await api.modificaPersona(p.id, { note:(`${dataIt(oggi())}: ${t}` + (p.note ? "\n" + p.note : "")).slice(0, 2000) });
        await dopoPersone("Nota salvata");
      }catch(e){ mostraErroreForm(f, messaggio(e)); }
      return;
    }
    const scelto = n => (f.querySelector(`input[name=${n}]:checked`) || {}).value || null;
    const esitoTesto = scelto("esito"), esito = esitoTesto ? Object.keys(ESITI).find(k => ESITI[k] === esitoTesto) : null;
    if(tipo === "chiusura" && !esito){ mostraErroreForm(f, "Scegli com'è finita."); return; }
    const data = f.data.value || oggi();
    if(data > oggi()){ mostraErroreForm(f, "Il passo non può essere nel futuro: per quello c'è la prossima cosa."); return; }
    let pr = { prossima_data:null, prossima_nota:null };
    if(tipo !== "chiusura" || esito === "partner") pr = leggiProssima(f);
    if(tipo === "chiusura" && esito === "non_ora"){
      const quando = f.risenti_data.value || piuMesi(oggi(), Number(scelto("risenti") || 3));
      if(quando <= oggi()){ mostraErroreForm(f, "Scegli un giorno nel futuro."); return; }
      const ricordo = piuGiorni(quando, -RISENTI_PRIMA);
      pr = { prossima_data:ricordo > oggi() ? ricordo : oggi(), prossima_nota:`da risentire il ${dataIt(quando)}` };
    }
    try{
      await api.nuoviPassi([{ id:uuid(), persona_id:p.id, tipo, data, come:scelto("come"), reazione:scelto("reazione"),
        esito:tipo === "chiusura" ? esito : null, nota:f.nota.value.trim() || null }]);
      /* un passo nuovo riporta la persona su Io, se l'avevo tolta */
      await api.modificaPersona(p.id, Object.assign(pr, { nascosta_io:false }));
      /* chiuso come Cliente: esce dalla lista ed entra nei Clienti, con la sua scheda */
      if(tipo === "chiusura" && esito === "cliente"){ st.vista = "persone"; st.sezPersone = "clienti"; st.filtroClienti = "tutti"; }
      await dopoPersone(tipo === "chiusura" && esito === "cliente" ? `${nomeSaluto(p.nome)} è tra i tuoi clienti`
        : `${TIPI_PASSO[tipo].nome}${tipo === "chiusura" ? " · " + ESITI[esito] : ""} segnato`);
    }catch(e){ mostraErroreForm(f, messaggio(e)); }
  },
  async prossima(f){
    try{ await api.modificaPersona(st.personaId, Object.assign(leggiProssima(f), { nascosta_io:false })); await dopoPersone("Prossima cosa salvata"); }
    catch(e){ mostraErroreForm(f, messaggio(e)); }
  }
});

document.addEventListener("change", e => {
  /* nella chiusura si vede solo quello che serve all'esito scelto */
  if(e.target && e.target.name === "esito" && e.target.form){
    const k = Object.keys(ESITI).find(x => ESITI[x] === e.target.value);
    e.target.form.querySelectorAll("[data-per-esito]").forEach(d => { d.hidden = d.dataset.perEsito !== k; });
  }
  if(e.target && e.target.name === "risenti" && e.target.form) e.target.form.risenti_data.value = "";
  if(e.target && e.target.name === "risenti_data" && e.target.value && e.target.form)
    e.target.form.querySelectorAll("input[name=risenti]").forEach(r => { r.checked = false; });
  /* scegliendo "Domani / Tra 3 giorni…" la data scritta a mano si svuota, e viceversa */
  if(e.target && e.target.name === "tra" && e.target.form) e.target.form.prossima_data.value = "";
  if(e.target && e.target.name === "prossima_data" && e.target.value && e.target.form){
    const n = e.target.form.querySelector("input[name=tra][value='']"); if(n) n.checked = true;
  }
});
document.addEventListener("input", e => {
  if(e.target && e.target.id === "cerca-lista"){
    st.cercaLista = e.target.value;
    const q = senzaAccenti(st.cercaLista);
    document.querySelectorAll(".persone li").forEach(li => { li.style.display = !q || senzaAccenti(li.textContent).includes(q) ? "" : "none"; });
  }
});

/* ---- 11c. Persone: il Target (dalla mini app "Target") ----
   Le otto domande per chi NON conosci: lo incontri, ti sembra in gamba, e prima di parlargli dell'attività vedi se
   è in linea. Il partner crea un invito e lo manda su WhatsApp; il contatto risponde da una pagina di Growup senza
   accesso (#t&…) e rimanda il codice delle risposte su WhatsApp; aprendolo, le risposte si attaccano all'invito.
   Il contatto non scrive niente nel database. Gli inviti li vede solo chi li crea. */
const VERSIONE_DOMANDE = "2026-09-14";
/* p = punti (0-4); ko = la condizione di base che quella risposta fa cadere. La prima domanda non dà punti. */
const DOMANDE = [
  { tema:"La priorità", senzaPunti:true,
    t:"Se nei prossimi due anni potessi cambiare una di queste due situazioni — soldi o tempo — quale avrebbe la priorità?",
    o:[{ t:"Un'entrata economica maggiore", p:0, s:"più soldi" },
       { t:"Non cambierei niente, va bene così", p:0, s:"nessun motivo", ko:"motivo" },
       { t:"Avere più tempo a mia disposizione", p:0, s:"più tempo" }] },
  { tema:"Il tempo", t:"Quanto tempo potresti dedicare a migliorare quella situazione?",
    o:[{ t:"Dedicare 8-10 ore alla settimana", p:4 }, { t:"Tutti i giorni, nei ritagli che riesco a trovare", p:2 },
       { t:"Niente: non ho tempo", p:0, ko:"tempo" }] },
  { tema:"Le aspettative", t:"Quando inizi qualcosa di nuovo, quale di queste situazioni ti rappresenta meglio?",
    o:[{ t:"Preferisco sapere fin dall'inizio cosa otterrò e avere risultati sicuri nel breve periodo", p:0, ko:"aspettative" },
       { t:"Sono disposto a costruire qualcosa che possa crescere nel tempo, anche se all'inizio i risultati sono graduali", p:4 },
       { t:"Voglio una base sicura e allo stesso tempo valuto opportunità di crescita", p:2 }] },
  { tema:"I no", t:"Quanto ti pesa sentirti dire no? Pensa a quando proponi qualcosa ad amici o al lavoro.",
    o:[{ t:"Niente: è un loro diritto, io vado avanti", p:4 }, { t:"Tanto: mi dispiace e la prendo sul personale", p:0 },
       { t:"Mi pesa lì per lì, poi mi passa e riprovo", p:2 }] },
  { tema:"Squadra e metodo", t:"Quanto ti va di lavorare in squadra e seguire un metodo condiviso?",
    o:[{ t:"Bene, se capisco il perché di quello che mi viene chiesto", p:2 }, { t:"Poco: preferisco fare a modo mio", p:0 },
       { t:"Molto: se una strada funziona per altri, la seguo volentieri", p:4 }] },
  { tema:"Un'attività basata sulle relazioni",
    t:"L'attività si costruisce parlando con le persone che conosci — familiari e amici — e conoscendone di nuove nel tempo.",
    o:[{ t:"È la cosa che meno mi va di fare", p:0 }, { t:"Sono estroverso: stare con le persone mi viene naturale", p:4 },
       { t:"Non sono molto estroverso, ma posso imparare a gestirlo", p:2 }] },
  { tema:"Le opinioni degli altri",
    t:"Se decidessi di intraprendere qualcosa di nuovo e le persone intorno a te non ti appoggiassero, come la vivresti?",
    o:[{ t:"Mi dispiacerebbe, ma andrei avanti: le scelte le faccio io", p:4 },
       { t:"Ci proverei lo stesso, ma senza il loro appoggio farei fatica", p:2 },
       { t:"Mi fermerei: se chi mi sta intorno non ci crede, non me la sentirei", p:0 }] },
  { tema:"L'avvio", t:"Quanto saresti disposto a investire per iniziare una tua attività?",
    o:[{ t:"Meno di 55 €", p:0 }, { t:"Da 55 € a 150 €", p:2 }, { t:"Oltre 150 €", p:4 }] }
];
/* Cosa affrontare, punto per punto, quando una risposta vale 0 (il metodo di A&S). */
const SCOPERTI = [
  "Nessuna priorità da cambiare. Senza un perché suo, nessun piano regge: prima di parlare di attività, fallo raccontare (cosa vorrebbe, cosa gli manca). Se non emerge nulla, non forzare.",
  "Ritagli quotidiani, ma poche ore in tutto. Il ritmo è quello giusto — è il monte ore a essere sottile. Prima del piano metti in chiaro quanto serve davvero: circa un'ora al giorno vera, non cinque minuti fra una cosa e l'altra. Se dichiara zero, non è il momento suo.",
  "Cerca sicurezza e risultati certi nel breve. È l'aspettativa che rompe al terzo mese. Metti in chiaro i numeri veri dei primi mesi prima del piano: se quello che cerca è una certezza immediata, è più onesto dirglielo che venderglielo.",
  "Il no lo prende sul personale. Va preparato: il no è statistica, non giudizio. Da seguire da vicino nelle prime settimane, o non parte.",
  "Vuole fare a modo suo. Qui il valore sono la squadra e il metodo: chi va per conto proprio brucia la lista e si ferma. Verifica quanto è disposto a farsi affiancare, prima di aprire il piano.",
  "Chiuso o riservato sul contatto con le persone. Non è squalificante di per sé — si impara — ma serve accertarsi che sia disposto a imparare, non solo a evitare.",
  "Le opinioni intorno a lui lo condizionano. Chiarisci presto la posizione di partner e famiglia: se una persona vicina lo frena, si ferma dopo poche settimane.",
  "Oggi metterebbe meno di quanto serve per partire. Non è un giudizio sulla persona, è il momento — e spesso è una cifra detta al buio, senza sapere cosa riceve in cambio. Affrontalo prima del piano: se il resto regge, spiegagli com'è fatta la partenza; se la cifra resta un problema, fallo partire da cliente e riparlane più avanti."
];
const MASSIMO_TARGET = DOMANDE.reduce((n, q) => n + (q.senzaPunti ? 0 : 4), 0);
const ALFABETO_T = "ACDEFGHJKLMNPQRTUVWXY2346789";   // niente caratteri che si confondono
const DURATE_T = [["3", "3 giorni"], ["7", "1 settimana"], ["14", "2 settimane"], ["30", "1 mese"], ["", "Senza scadenza"]];

function valutaTarget(a){
  let tot = 0;
  const ko = [], zeri = [], riserve = [];
  a.forEach((k, qi) => {
    const o = DOMANDE[qi].o[k];
    if(o.ko) ko.push(o.ko);
    if(DOMANDE[qi].senzaPunti){ if(o.ko) zeri.push(qi); return; }
    tot += o.p;
    if(o.p === 0) zeri.push(qi); else if(o.p === 2) riserve.push(qi);
  });
  /* il punteggio dà la fascia, ma un "no" secco la abbassa; una condizione di base che manca mette fuori target */
  let livello = tot >= 23 ? 3 : tot >= 16 ? 2 : tot >= 10 ? 1 : 0;
  if(zeri.length >= 3) livello = 0; else if(zeri.length === 2) livello = Math.min(livello, 1); else if(zeri.length === 1) livello = Math.min(livello, 2);
  let band, titolo, breve, azione;
  if(ko.length){
    band = "no"; titolo = breve = "Fuori target";
    azione = `Non dare il piano. Manca una condizione di base (${ko.join(", ")}): un piano qui non convince, e se convince porta dentro una persona che si ferma in poche settimane. Chiudi con onestà — «guarda, per come me l'hai raccontata questa cosa non fa per te» — e, se i prodotti gli possono servire, proponigli di restare come cliente. Il rapporto resta intatto, e fra un anno la situazione può essere diversa.`;
  } else if(livello === 3){
    band = "go"; titolo = "In target — dagli il piano"; breve = "In target";
    azione = "Fissa l'incontro entro pochi giorni, mentre l'interesse è caldo. Parti dal suo motivo, poi il metodo, poi i numeri. Non gonfiare niente: con questo profilo l'onestà è il tuo argomento migliore.";
  } else if(livello === 2){
    band = "go"; titolo = "In target, con riserve — dagli il piano, ma prima chiarisci"; breve = "In target, con riserve";
    azione = "Vale l'incontro. Prima di aprire il piano, però, affronta i punti qui sotto: se li lasci lì, tornano fuori dopo l'iscrizione, quando costano di più.";
  } else if(livello === 1){
    band = "care"; titolo = "Da coltivare — piano non ancora"; breve = "Da coltivare";
    azione = "Troppe cose in sospeso per un piano che regga. Non chiudere: fallo provare come cliente, mandagli qualcosa da ascoltare, risentitevi fra qualche settimana. Le persone cambiano quando cambia la loro situazione, non quando insisti.";
  } else {
    band = "no"; titolo = breve = "Fuori target";
    azione = "Non dare il piano. Il quadro complessivo dice che questa attività non è cosa sua: più rifiuti secchi su punti che non si aggirano. Dillo chiaramente — è la cosa che ti farà rispettare — e proponigli il ruolo di cliente se i prodotti gli interessano.";
  }
  return { tot, band, titolo, breve, azione, zeri, riserve };
}
/* Il codice delle risposte: CL21-<8 cifre 1..3>-<controllo>-<id invito> (lo stesso della mini app) */
function controlloT(cifre){ let s = 0; for(let k = 0; k < cifre.length; k++) s += (cifre.charCodeAt(k) - 48) * (k + 1); return String(s % 9 + 1); }
function codificaT(risposte, id){ const d = risposte.map(x => x + 1).join(""); return `CL21-${d}-${controlloT(d)}${id ? "-" + id : ""}`; }
function decodificaT(txt){
  const m = String(txt || "").toUpperCase().match(/CL21-([1-3]{8})-([1-9])(?:-([A-Z0-9]{4,8}))?/);
  if(!m || controlloT(m[1]) !== m[2]) return null;
  return { risposte:m[1].split("").map(c => Number(c) - 1), id:m[3] || null };
}
function compattaT(iso){ return String(iso || "").slice(0, 10).replace(/-/g, ""); }
function firmaT(id, aaaammgg){
  const s = String(id) + "|" + String(aaaammgg); let n = 7;
  for(let k = 0; k < s.length; k++) n = (n * 31 + s.charCodeAt(k)) % 99991;
  return ALFABETO_T.charAt(n % 28) + ALFABETO_T.charAt(Math.floor(n / 28) % 28);
}
function nuovoIdT(){ let s = ""; for(let k = 0; k < 6; k++) s += ALFABETO_T.charAt(Math.floor(Math.random() * ALFABETO_T.length)); return s; }
/* Il numero WhatsApp per wa.me: solo cifre, con il prefisso (un cellulare italiano scritto senza prende il 39) */
function numeroWa(v){
  let n = String(v || "").replace(/[^\d+]/g, "").replace(/^\+/, "").replace(/^00/, "");
  if(/^3\d{8,9}$/.test(n)) n = "39" + n;
  return /^\d{8,15}$/.test(n) ? n : "";
}
function linkTarget(inv){
  const p = ["c=" + encodeURIComponent(inv.nome), "s=" + encodeURIComponent(nomeSaluto(st.profilo.nome)), "i=" + inv.id];
  /* il mio numero: la risposta del contatto si apre direttamente nella mia chat */
  const tel = numeroWa(leggiLocale(CHIAVE_WA));
  if(tel) p.push("t=" + tel);
  if(inv.scade){ const e = compattaT(inv.scade); p.push("e=" + e, "k=" + firmaT(inv.id, e)); }
  return base() + "#t&" + p.join("&");
}
function messaggioTarget(inv, link = linkTarget(inv)){
  return `Ciao ${inv.nome.split(" ")[0]}, come ci siamo detti.\n\n`
    + "Prima di vederci, ti mando otto domande: tre minuti. Servono a capire se quello che cerchi e quello che questa attività può darti coincidono.\n\n"
    + "Non c'è una risposta giusta e non devi dimostrare di essere adatto: rispondi di istinto. Se viene fuori che non fa per te lo vediamo subito e ci siamo risparmiati del tempo tutti e due.\n\n"
    + (link ? link + "\n\n" : "") + "Alla fine ti compare un pulsante che mi rimanda le risposte. A dopo,\n" + nomeSaluto(st.profilo.nome);
}
/* Telegram: il link va a parte (lo mette in cima al messaggio), il testo senza il link */
function telegram(link, testo){ return `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(testo)}`; }
function statoInvito(inv){
  if(inv.risposte){ const v = valutaTarget(inv.risposte); return { cl:v.band === "go" ? "v" : v.band === "care" ? "g" : "r", txt:`${v.breve} · ${v.tot}/${MASSIMO_TARGET}`, v }; }
  if(inv.bloccato) return { cl:"r", txt:"link bloccato" };
  if(inv.scade && inv.scade < oggi()) return { cl:"r", txt:"scaduto" };
  return { cl:"", txt:"in attesa" };
}

/* ---- Il contatto: la pagina delle otto domande (senza accesso, niente dati nel database) ---- */
function leggiLinkTarget(h){
  const q = new URLSearchParams(h.replace(/^#?t&/, ""));
  return { nome:(q.get("c") || "").slice(0, 80), sponsor:(q.get("s") || "").slice(0, 80), id:(q.get("i") || "").toUpperCase(), tel:numeroWa(q.get("t")),
           scade:q.get("e") || "", firma:q.get("k") || "", passo:"intro", i:0, ans:[], libero:"" };
}
function avviaContatto(h){
  const c = leggiLinkTarget(h);
  st.ct = c; st.fase = "contatto";
  if(!/^[A-Z0-9]{4,8}$/.test(c.id)) c.passo = "chiuso", c.motivo = "manomesso";
  else if(c.scade && (!/^\d{8}$/.test(c.scade) || c.firma !== firmaT(c.id, c.scade))) c.passo = "chiuso", c.motivo = "manomesso";
  else if(c.scade && compattaT(oggi()) > c.scade) c.passo = "chiuso", c.motivo = "scaduto";
  render();
  /* il link è ancora aperto? (bloccato dal partner, già usato, scaduto) — non ferma chi ha già cominciato */
  if(api && c.passo === "intro") api.invitoTargetAperto(c.id).then(r => {
    if(r && r !== "ok" && st.ct.passo === "intro"){ st.ct.passo = "chiuso"; st.ct.motivo = r; render(); }
  }).catch(() => {});
}
function messaggioContatto(){
  const c = st.ct, codice = codificaT(c.ans, c.id);
  return [`Ciao${c.sponsor ? " " + c.sponsor : ""}, ho risposto alle otto domande.`, "", c.nome, ""]
    .concat(c.ans.map((k, qi) => `${qi + 1}. ${DOMANDE[qi].tema}: ${DOMANDE[qi].o[k].t}`))
    .concat(c.libero.trim() ? ["", "Nota: " + c.libero.trim()] : [])
    .concat(["", "Apri le risposte: " + base() + "#r=" + codice]).join("\n");
}
function vContatto(){
  const c = st.ct;
  if(c.passo === "chiuso"){
    const t = { scaduto:["Questo link è scaduto", "Le domande non sono più aperte."], usato:["Hai già risposto", "Le tue risposte sono già arrivate. Grazie!"],
      bloccato:["Questo link è stato chiuso", "Le domande non sono più aperte."], sconosciuto:["Link non trovato", "Il link non è valido."],
      manomesso:["Link non valido", "Il link sembra modificato o incompleto."] }[c.motivo] || ["Link non valido", ""];
    return `<div class="centro"><h1>${t[0]}</h1><p class="muted">${t[1]}</p>
      <p class="muted">${c.motivo === "usato" ? (c.sponsor ? `Se qualcosa non ti torna, scrivi a ${esc(c.sponsor)}.` : "")
        : `Se vuoi rispondere, chiedi a ${c.sponsor ? esc(c.sponsor) : "chi te l'ha mandato"} di rimandartelo.`}</p></div>`;
  }
  if(c.passo === "intro") return `<div class="contatto">
    <p class="eyebrow">Otto domande · circa 3 minuti</p>
    <h1>${c.nome ? `Ciao ${esc(c.nome.split(" ")[0])}` : "Prima di parlarne davvero"}</h1>
    ${c.sponsor ? `<p class="muted">Te le manda ${esc(c.sponsor)}.</p>` : ""}
    <div class="card">
      <p>Queste otto domande non servono a valutarti: servono a capire se c'è un incastro reale fra quello che cerchi e quello che questa attività può offrirti.</p>
      <p>Per questo non cercare la risposta giusta, e non cercare di compiacere nessuno — più sei diretto, più è facile capirlo.</p>
      <p>Se emerge che non fa al caso tuo lo capiamo subito e ci siamo risparmiati del tempo entrambi. Se invece l'incastro c'è, abbiamo una base concreta da cui partire.</p>
      <button class="btn primary wide" data-act="ct-via">Comincia</button>
      <p class="nota">Le risposte restano su questo telefono finché non le invii tu.</p>
    </div></div>`;
  if(c.passo === "quiz"){
    const q = DOMANDE[c.i];
    return `<div class="contatto">
      <div class="avanzamento" aria-hidden="true"><i style="width:${Math.round(c.i / DOMANDE.length * 100)}%"></i></div>
      <div class="card">
        <p class="eyebrow">Domanda ${c.i + 1} di ${DOMANDE.length}</p>
        <h2>${esc(q.t)}</h2>
        <div class="risposte-ct">${q.o.map((o, k) => `<button class="btn wide${c.ans[c.i] === k ? " on" : ""}" data-act="ct-risposta" data-k="${k}">${esc(o.t)}</button>`).join("")}</div>
        ${c.i > 0 ? `<button class="btn ghost" style="margin-top:12px" data-act="ct-indietro">Indietro</button>` : ""}
      </div></div>`;
  }
  const codice = codificaT(c.ans, c.id);
  return `<div class="contatto">
    <p class="eyebrow">Fatto</p>
    <h1>${c.nome ? `Grazie, ${esc(c.nome.split(" ")[0])}.` : "Grazie."}</h1>
    <div class="card">
      <p class="muted">Le tue risposte sono pronte. Mandamele e ci sentiamo: se ha senso vederci, ti spiego come funziona nel dettaglio; se secondo me non è cosa tua, te lo dico con la stessa sincerità con cui hai risposto.</p>
      <label class="field"><span>C'è qualcosa che vorresti cambiare nella tua situazione, o una domanda che ti porti dietro? <i>(facoltativo)</i></span>
        <textarea id="ct-libero" rows="3" maxlength="600" placeholder="Due righe, se ti va">${esc(c.libero)}</textarea></label>
      <div class="row" style="gap:8px;margin-top:12px">
        <button class="btn wa grow" data-act="ct-invia">Invia su WhatsApp</button>
        <button class="btn tg grow" data-act="ct-invia-tg">Invia su Telegram</button></div>
      <button class="btn ghost wide" style="margin-top:8px" data-act="ct-copia">Copia le risposte</button>
      <p class="nota">${c.tel ? `Su WhatsApp il messaggio si apre nella chat di ${c.sponsor ? esc(c.sponsor) : "chi ti ha mandato il link"}: basta inviarlo.`
        : `Su WhatsApp scegli la chat di ${c.sponsor ? esc(c.sponsor) : "chi ti ha mandato il link"}.`} Su Telegram scegli la sua chat. Codice: <b>${codice}</b></p>
    </div>
    <div class="card">
      <h2>Una cosa sola, prima di lasciarti</h2>
      <p class="muted">Questa è un'attività: non è un premio, non è un passatempo e soprattutto non è qualcosa che funziona da sola. I soldi non li regala nessuno, né qui né in qualsiasi altro lavoro.</p>
      <p class="muted">Quello che cambia è una cosa sola: qui hai la possibilità di costruire un risultato tuo. Ma per farlo servono tempo, costanza e responsabilità.</p>
      <p class="muted">Non devi fare tutto subito, non devi essere perfetto e non devi avere tutto sotto controllo. Devi solo decidere di esserci e fare la tua parte, anche un piccolo passo alla volta. Perché alla fine non conta quanto sei motivato il primo giorno: conta quello che fai giorno per giorno, con costanza.</p>
    </div></div>`;
}

/* ---- Il partner: Persone → Target ---- */
async function caricaInviti(){ try{ st.inviti = await api.invitiTarget() || []; }catch(e){ st.inviti = st.inviti || []; } }
function vSezioniPersone(){
  return `<div class="row scelte-rapide sezioni-persone" style="gap:6px">
    <button class="btn small${st.sezPersone === "target" ? " on" : ""}" data-act="sez-persone" data-sez="target" aria-pressed="${st.sezPersone === "target"}">Target</button>
    <button class="btn small${st.sezPersone === "lista" ? " on" : ""}" data-act="sez-persone" data-sez="lista" aria-pressed="${st.sezPersone === "lista"}">Lista</button>
    <button class="btn small${st.sezPersone === "clienti" ? " on" : ""}" data-act="sez-persone" data-sez="clienti" aria-pressed="${st.sezPersone === "clienti"}">Clienti</button></div>`;
}
function vTarget(){
  if(st.invitoId) return vInvito();
  const tutti = st.inviti.slice().sort((a, b) => (a.risposto_il || a.creato_il) < (b.risposto_il || b.creato_il) ? 1 : -1);
  const l = tutti.filter(x => !!x.archiviato === !!st.archiviatiT), archiviati = tutti.filter(x => x.archiviato).length;
  return `<div class="card">
    <div class="spread"><span class="eyebrow">Target</span>
      <span class="row" style="gap:6px"><button class="btn small" data-act="target-leggi">Leggi una risposta</button>
      <button class="btn small primary" data-act="target-nuovo">+ Nuovo invito</button></span></div>
    <p class="small" style="margin:6px 0 0">Le otto domande per chi non conosci: prima di parlargli dell'attività, vedi se è in linea.</p>
    ${l.length ? `<ul class="persone">${l.map(x => { const s = statoInvito(x);
      return `<li><button class="persona" data-act="apri-invito" data-id="${esc(x.id)}">
        <span class="grow"><b>${esc(x.nome)}</b><br><span class="small">${x.risposte ? "ha risposto il " + dataIt(String(x.risposto_il).slice(0, 10)) : "invito del " + dataIt(String(x.creato_il).slice(0, 10))}${x.persona_id && st.persone.some(p => p.id === x.persona_id) ? " · in lista" : ""}</span></span>
        <span class="pill ${s.cl}">${esc(s.txt)}</span></button></li>`; }).join("")}</ul>`
      : `<p class="muted" style="margin:10px 0 0">${st.archiviatiT ? "Nessun invito archiviato." : "Ancora nessun invito."}</p>`}
    ${archiviati || st.archiviatiT ? `<button class="btn link small" data-act="target-archiviati" style="min-height:0;padding:0;margin-top:8px">${st.archiviatiT ? "‹ Gli inviti in corso" : `Archiviati · ${archiviati}`}</button>` : ""}
    <p class="nota">Gli inviti e le risposte li vedi solo tu.</p>
  </div>`;
}
function vInvito(){
  const x = st.inviti.find(y => y.id === st.invitoId);
  if(!x) return `<button class="btn link" data-act="torna-target" style="padding:0">‹ Target</button><p class="muted">Invito non trovato.</p>`;
  const s = statoInvito(x);
  const indietro = `<button class="btn link" data-act="torna-target" style="padding:0">‹ Target</button>`;
  if(!x.risposte) return `${indietro}
  <div class="card">
    <div class="spread"><span class="con-aiuto"><h2>${esc(x.nome)}</h2>${aiutoBtn("target-attesa")}</span><span class="pill ${s.cl}">${esc(s.txt)}</span></div>
    ${aiutoTesto("target-attesa", `Hai mandato l'invito: ora aspetti le risposte. Quando risponde ti arriva un messaggio con il link «Apri le
      risposte»: aprilo da qui, oppure usa «Leggi una risposta».`)}
    <p class="small" style="margin:4px 0 0">Invito del ${dataIt(String(x.creato_il).slice(0, 10))} · ${x.scade ? `il link vale fino al ${dataIt(x.scade)}` : "il link non scade"}</p>
    <div class="row" style="gap:8px;margin-top:12px">
      <a class="btn wa grow" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(messaggioTarget(x))}">WhatsApp</a>
      <a class="btn tg grow" target="_blank" rel="noopener" href="${esc(telegram(linkTarget(x), messaggioTarget(x, "")))}">Telegram</a>
      <button class="btn grow" data-act="target-copia">Copia</button></div>
  </div>
  <div class="row" style="gap:6px;justify-content:center">
    <button class="btn small ghost" data-act="target-blocca">${x.bloccato ? "Riapri il link" : "Blocca il link"}</button>
    <button class="btn small ghost" data-act="target-elimina">Elimina</button></div>`;
  const v = s.v, a = x.risposte, fuori = v.band === "no";
  return `${indietro}
  <div class="card">
    <div class="spread"><h2>${esc(x.nome)}</h2><span class="pill ${s.cl}">${esc(v.breve)}</span></div>
    <p class="small" style="margin:2px 0 0">Ha risposto il ${dataIt(String(x.risposto_il).slice(0, 10))}</p>
    <div class="esito-t ${v.band}"><b>${esc(v.titolo)}</b>
      <span class="num">${v.tot}<span class="small"> su ${MASSIMO_TARGET} punti</span></span>
      <div class="barra-t"><i style="width:${Math.round(v.tot / MASSIMO_TARGET * 100)}%"></i></div></div>
    <p class="small" style="margin:10px 0 0"><b>Cosa cerca:</b> ${esc(DOMANDE[0].o[a[0]].s)}</p>
    <p class="small" style="margin:4px 0 0"><b>Cosa lo trattiene:</b> ${esc(v.zeri.length ? v.zeri.map(qi => DOMANDE[qi].tema).join(" · ")
      : v.riserve.length ? "nessun no secco; riserve su " + v.riserve.map(qi => DOMANDE[qi].tema).join(" · ") : "niente di evidente dalle risposte")}</p>
    ${x.persona_id && st.persone.some(p => p.id === x.persona_id) ? `<button class="btn wide" style="margin-top:12px" data-act="apri-persona" data-id="${esc(x.persona_id)}">Apri nella lista</button>`
      : `<button class="btn primary wide" style="margin-top:12px" data-act="target-in-lista">Metti in lista</button>`}
  </div>
  <div class="card">
    <span class="con-aiuto"><span class="eyebrow">Le risposte</span>${aiutoBtn("target-punti")}</span>
    ${aiutoTesto("target-punti", `Ogni risposta vale da 0 a 4 punti: 0 è un no secco, 2 un sì con riserva, 4 un sì pieno. La prima domanda serve
      a conoscere la persona e non dà punti.`)}
    <ul class="risposte-t">${a.map((k, qi) => { const o = DOMANDE[qi].o[k], senza = DOMANDE[qi].senzaPunti;
      return `<li><span class="grow"><b>${esc(DOMANDE[qi].tema)}</b><br><span class="small">${esc(o.t)}</span></span>
        <span class="num${!senza && o.p === 0 ? " zero" : ""}">${senza ? "–" : o.p}</span></li>`; }).join("")}</ul>
  </div>
  <details class="card metodo"><summary><span class="eyebrow">Il metodo</span></summary>
    <p class="small">${esc(v.azione)}</p>
    <h3>${fuori ? "Cosa manca" : "Cosa affrontare prima del piano"}</h3>
    ${v.zeri.length ? `<ul class="small">${v.zeri.map(qi => `<li><b>${esc(DOMANDE[qi].tema)}.</b> ${esc(fuori ? (SCOPERTI[qi].match(/^[^.]+\./) || [SCOPERTI[qi]])[0] : SCOPERTI[qi])}</li>`).join("")}</ul>`
      : `<p class="small">Nessun no secco. ${v.riserve.length ? "Le riserve si sciolgono parlando, non sono ostacoli." : "Profilo pulito: vai di piano, e non riempirlo di entusiasmo — a questa persona serve sostanza."}</p>`}
    ${fuori ? "" : `<h3>Promemoria per l'incontro</h3>
    <p class="small"><b>Cosa si fa davvero.</b> Si usano i prodotti (il consumo personale è la base). Si costruisce una base di clienti che riordinano da soli sull'e-commerce, senza magazzino. Si parla con le persone, circa un'ora al giorno presa dai ritagli. Si segue il metodo e la formazione (app CumLaude21, i tre incontri iniziali con lo sponsor, gli audio). Si aiutano gli altri a fare le stesse cose: il bonus differenziale premia chi fa crescere i suoi.</p>
    <p class="small"><b>Cosa si può ottenere, con che tempi.</b> Primi mesi: margine del 20% lordo (circa 16% netto) sulla vendita diretta. Il mattone base: 10 clienti da circa 50 € al mese fanno 500 € di fatturato ricorrente. Il bonus sale col volume del gruppo, dal 3% (200 VP) al 21% (10.000 VP). Quando un gruppo raggiunge il 21% scatta un 6% fisso sul suo fatturato. L'attività si può trasmettere agli eredi.</p>
    <p class="nota">Cifre indicative, di riferimento per te: non sono una promessa di guadagno e non vanno presentate come tale.</p>`}
    <h3>Cosa dire se l'esito è no</h3>
    <p class="small">«Ti ringrazio di aver risposto con sincerità. Da quello che mi hai detto, secondo me questa attività adesso non fa per te: chiede tempo ogni giorno e mesi di costanza prima di dare qualcosa di serio, e non voglio venderti un'illusione. Se invece i prodotti ti incuriosiscono, quelli te li faccio provare volentieri.»</p>
  </details>
  <div class="row" style="gap:6px;justify-content:center">
    <button class="btn small ghost" data-act="target-archivia">${x.archiviato ? "Riporta tra gli inviti" : "Archivia"}</button>
    <button class="btn small ghost" data-act="target-elimina">Elimina</button></div>`;
}

function vSheetTarget(s){
  const annulla = `<button type="button" class="btn ghost grow" data-act="chiudi">Annulla</button>`;
  if(s === "target-nuovo"){ const pl = st.targetPersona && st.persone.find(p => p.id === st.targetPersona);
    return `<h2>${pl ? `Le 8 domande a ${esc(nomeSaluto(pl.nome))}` : "Nuovo invito Target"}</h2>
    <p class="small">${pl ? "Le risposte arriveranno nella sua scheda della lista." : "Per chi non conosci bene: gli mandi le otto domande su WhatsApp e ti rimanda le risposte."}</p>
    <form data-form="target-nuovo" novalidate>
      <label class="field"><span>Nome e cognome del contatto</span><input name="nome" maxlength="80" required autocomplete="off" value="${esc(pl ? pl.nome : "")}"></label>
      <label class="field"><span>Il tuo numero WhatsApp <i>(per ricevere le risposte direttamente nella tua chat)</i></span>
        <input name="whatsapp" type="tel" inputmode="tel" maxlength="20" placeholder="es. 333 1234567" value="${esc(leggiLocale(CHIAVE_WA) || "")}"></label>
      <p class="nota" style="margin-top:4px">Resta solo su questo telefono e va nel link che mandi al contatto. Senza numero, il contatto sceglie la chat da solo.</p>
      <fieldset class="field"><legend>Il link vale</legend>
        <div class="opzioni">${DURATE_T.map(([v, t]) => `<label class="chip"><input type="radio" name="durata" value="${v}"${v === "14" ? " checked" : ""}><span>${t}</span></label>`).join("")}</div></fieldset>
      <div class="row" style="margin-top:16px">${annulla}<button class="btn primary grow">Crea l'invito</button></div>
    </form>`; }
  if(s === "target-leggi") return `<h2>Leggi una risposta</h2>
    <p class="small">Su WhatsApp tieni premuto sul messaggio del contatto, «Copia», e incollalo qui: il codice lo trovo io.</p>
    <form data-form="target-leggi" novalidate>
      <textarea name="testo" rows="4" aria-label="Il messaggio del contatto"></textarea>
      <div class="row" style="margin-top:16px">${annulla}<button class="btn primary grow">Leggi</button></div>
    </form>`;
  return "";
}

/* Le risposte arrivate (dal link "Apri le risposte" o incollate): si attaccano all'invito */
async function applicaRispostaTarget(testo){
  const d = decodificaT(testo);
  if(!d) return "Non trovo il codice delle risposte (CL21-…) in questo testo.";
  const x = d.id && st.inviti.find(y => y.id === d.id);
  if(!x) return "Questa risposta non corrisponde a nessuno dei tuoi inviti (forse è di un invito fatto con la vecchia app Target).";
  if(!x.risposte) await api.aggiornaInvito(x.id, { risposte:d.risposte, versione:VERSIONE_DOMANDE });
  await caricaInviti();
  st.vista = "persone"; st.sezPersone = "target"; st.invitoId = x.id; st.personaId = null;
  return "";
}
async function rispostaInAttesa(){
  const r = leggiLocale(CHIAVE_RISPOSTA_T);
  if(!r) return;
  salvaLocale(CHIAVE_RISPOSTA_T, null);
  try{ const err = await applicaRispostaTarget(r); if(err) toast(err); else { render(); window.scrollTo(0, 0); } }catch(e){ toast(messaggio(e)); }
}

Object.assign(AZIONI, {
  "ct-via"(){ st.ct.passo = "quiz"; st.ct.i = 0; render(); window.scrollTo(0, 0); },
  "ct-risposta"(el){
    const c = st.ct; c.ans[c.i] = Number(el.dataset.k);
    if(c.i < DOMANDE.length - 1) c.i++; else { c.ans = c.ans.slice(0, DOMANDE.length); c.passo = "fine"; }
    render(); window.scrollTo(0, 0);
  },
  "ct-indietro"(){ if(st.ct.i > 0){ st.ct.i--; render(); } },
  "ct-invia"(){ window.open(`https://wa.me/${st.ct.tel || ""}?text=` + encodeURIComponent(messaggioContatto()), "_blank", "noopener"); },
  "ct-invia-tg"(){ const m = messaggioContatto(), i = m.lastIndexOf("\n\nApri le risposte: ");
    window.open(telegram(base() + "#r=" + codificaT(st.ct.ans, st.ct.id), m.slice(0, i) + "\n\nApri le risposte dal link qui sopra."), "_blank", "noopener"); },
  async "ct-copia"(){ try{ await navigator.clipboard.writeText(messaggioContatto()); toast("Copiato: incollalo nella chat"); }catch(e){ toast("Non riesco a copiare: usa Invia su WhatsApp"); } },
  "sez-persone"(el){ st.sezPersone = el.dataset.sez; st.personaId = null; st.invitoId = null; render(); },
  "apri-invito"(el){ st.vista = "persone"; st.sezPersone = "target"; st.invitoId = el.dataset.id; render(); window.scrollTo(0, 0); },
  "torna-target"(){ st.invitoId = null; render(); window.scrollTo(0, 0); },
  "target-archiviati"(){ st.archiviatiT = !st.archiviatiT; render(); },
  "target-nuovo"(){ st.errore = ""; st.targetPersona = null; st.sheet = "target-nuovo"; render(); },
  /* dalla scheda di una persona della lista: l'invito nasce già collegato a lei */
  "target-da-persona"(){ st.errore = ""; st.targetPersona = st.personaId; st.sheet = "target-nuovo"; render(); },
  "target-leggi"(){ st.errore = ""; st.sheet = "target-leggi"; render(); },
  async "target-copia"(){
    const x = st.inviti.find(y => y.id === st.invitoId);
    try{ await navigator.clipboard.writeText(messaggioTarget(x)); toast("Messaggio copiato"); }catch(e){ toast(messaggio(e)); }
  },
  async "target-blocca"(){
    const x = st.inviti.find(y => y.id === st.invitoId);
    try{ await api.aggiornaInvito(x.id, { bloccato:!x.bloccato }); await caricaInviti(); render(); toast(x.bloccato ? "Link riaperto" : "Link bloccato: al contatto non si apre più"); }
    catch(e){ toast(messaggio(e)); }
  },
  async "target-archivia"(){
    const x = st.inviti.find(y => y.id === st.invitoId);
    try{ await api.aggiornaInvito(x.id, { archiviato:!x.archiviato }); await caricaInviti(); st.invitoId = null; render(); toast(x.archiviato ? "Di nuovo tra gli inviti" : "Archiviato"); }
    catch(e){ toast(messaggio(e)); }
  },
  async "target-elimina"(){
    const x = st.inviti.find(y => y.id === st.invitoId);
    if(!x || !confirm(`Eliminare l'invito di ${x.nome} e le sue risposte?`)) return;
    try{ await api.cancellaInvito(x.id); await caricaInviti(); st.invitoId = null; render(); toast("Invito eliminato"); }catch(e){ toast(messaggio(e)); }
  },
  async "target-in-lista"(){
    const x = st.inviti.find(y => y.id === st.invitoId);
    if(!x) return;
    try{
      const id = uuid(), v = valutaTarget(x.risposte);
      await api.nuovePersone([{ id, nome:x.nome, invito_target_id:x.id, origine:"Target" }]);
      /* le otto domande sono già un contatto: la persona entra "Contattato" (senza contare di nuovo l'attività) */
      await api.nuoviPassi([{ id:uuid(), persona_id:id, tipo:"contatto", data:String(x.risposto_il || oggi()).slice(0, 10), importato:true,
        come:"Target", reazione:v.breve.slice(0, 80) }]);
      await api.aggiornaInvito(x.id, { persona_id:id });
      await caricaInviti();
      st.sezPersone = "lista"; st.invitoId = null; st.personaId = id;
      await dopoPersone(`${x.nome} nella tua lista`);
    }catch(e){ toast(messaggio(e)); }
  }
});

Object.assign(MODULI, {
  async "target-nuovo"(f){
    const nome = f.nome.value.trim();
    if(!nome){ mostraErroreForm(f, "Scrivi il nome del contatto."); return; }
    const wa = f.whatsapp.value.trim();
    if(wa && !numeroWa(wa)){ mostraErroreForm(f, "Il numero WhatsApp non sembra giusto: scrivilo con il prefisso, per esempio +39 333 1234567."); return; }
    salvaLocale(CHIAVE_WA, wa ? numeroWa(wa) : null);
    const durata = (f.querySelector("input[name=durata]:checked") || {}).value || "";
    const scade = durata ? piuGiorni(oggi(), Number(durata)) : null;
    try{
      let id = null;
      for(let t = 0; t < 4 && !id; t++){
        const prova = nuovoIdT();
        try{ await api.nuovoInvito({ id:prova, nome, scade }); id = prova; }
        catch(e){ if(!/duplicate|unique|23505/i.test(e.message || e.code || "")) throw e; }
      }
      const pl = st.targetPersona && st.persone.find(p => p.id === st.targetPersona);
      if(pl){
        await api.aggiornaInvito(id, { persona_id:pl.id });
        await api.modificaPersona(pl.id, { invito_target_id:id, nascosta_io:false });
        /* mandare le otto domande è il primo contatto: chi era solo "In lista" diventa Contattato (e conta il contatto) */
        if(pl.fase === "lista" && !pl.esito)
          await api.nuoviPassi([{ id:uuid(), persona_id:pl.id, tipo:"contatto", data:oggi(), come:"Target", reazione:"Gli ho mandato le 8 domande" }]);
        await caricaPersone();
        aggiornaAttivita();
      }
      st.targetPersona = null;
      await caricaInviti();
      st.sheet = null; st.vista = "persone"; st.sezPersone = "target"; st.invitoId = id; render(); window.scrollTo(0, 0);
      toast("Invito pronto: mandalo su WhatsApp");
    }catch(e){ mostraErroreForm(f, messaggio(e)); }
  },
  async "target-leggi"(f){
    try{
      const err = await applicaRispostaTarget(f.testo.value);
      if(err){ mostraErroreForm(f, err); return; }
      st.sheet = null; render(); window.scrollTo(0, 0); toast("Risposte lette");
    }catch(e){ mostraErroreForm(f, messaggio(e)); }
  }
});

/* "Come arrivarci" aperto o chiuso: lo ricordo, perché la pagina si ridisegna */
document.addEventListener("toggle", e => { const d = e.target;
  if(d && d.classList && d.classList.contains("consigli")) d.open ? st.consigliAperti.add(d.dataset.id) : st.consigliAperti.delete(d.dataset.id); }, true);
document.addEventListener("input", e => { if(e.target && e.target.id === "ct-libero" && st.ct) st.ct.libero = e.target.value; });

/* ---- 11d. Persone: i Clienti (dalla mini app "Clienti e Riordini") ----
   Un cliente è una persona della lista chiusa come "Cliente": una sola scheda per tutto il percorso.
   Si segna cosa ha preso e quando; l'app calcola quando finisce e chi è da sentire (riordino, "come ti sei trovato",
   compleanno). Gli ordini non contano nei VP del mese: quelli arrivano dal report Amway. Tutto visibile solo a me. */
const DURATA_BASE = 30, PREAVVISO = 7, FERMO_DOPO = 45, VERIFICA_DOPO = 8, FINESTRA_VERIFICA = 30, COMPLEANNO_PRIMA = 7;
const MESI_LUNGHI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const FILTRI_CLIENTI = [
  { id:"tutti", nome:"Tutti", ok:p => !p.non_compra },
  { id:"sentire", nome:"Da sentire", ok:p => !p.non_compra && ["ritardo", "ora", "fermo", "mai"].includes(statoCliente(p).key) },
  { id:"fermi", nome:"Fermi", ok:p => !p.non_compra && statoCliente(p).key === "fermo" },
  { id:"mai", nome:"Mai ordinato", ok:p => !p.non_compra && statoCliente(p).key === "mai" },
  { id:"persi", nome:"Non comprano più", ok:p => p.non_compra }];

async function caricaListino(){
  try{ st.listino = await api.listino() || []; salvaLocale(CHIAVE_LISTINO, JSON.stringify(st.listino)); }
  catch(e){ try{ st.listino = JSON.parse(leggiLocale(CHIAVE_LISTINO) || "[]"); }catch(x){ st.listino = []; } }
}
async function caricaClienti(){
  try{
    const [ordini, righe, durate] = await Promise.all([api.ordini(), api.righeOrdini(), api.durate()]);
    st.ordini = ordini || []; st.righe = righe || [];
    st.durate = new Map((durate || []).map(d => [d.codice, Number(d.giorni)]));
  }catch(e){ st.ordini = st.ordini || []; st.righe = st.righe || []; st.durate = st.durate || new Map(); }
}
function clientiTutti(){ return st.persone.filter(p => p.esito === "cliente"); }
function ordiniDi(pid){ return st.ordini.filter(o => o.persona_id === pid).sort((a, b) => a.data < b.data ? 1 : a.data > b.data ? -1 : a.creato_il < b.creato_il ? 1 : -1); }
function righeDi(oid){ return st.righe.filter(r => r.ordine_id === oid); }
function giorniDi(codice){ return st.durate.get(codice) || DURATA_BASE; }
function prodottoCatalogo(codice){ const r = st.listino.find(x => x.codice === codice);
  return r ? { codice:r.codice, nome:r.nome, formato:r.formato, prezzo:numOrNull(r.prezzo_cliente), prezzo_partner:numOrNull(r.prezzo_partner), vp:numOrNull(r.vp) } : null; }
function numOrNull(v){ return v == null || v === "" || isNaN(Number(v)) ? null : Number(v); }
/* i totali di un ordine: al cliente, Partner e VP (VP e prezzo Partner dal listino: informazione, i VP del mese restano quelli del report) */
function totaliRighe(righe){
  const t = { cliente:0, partner:0, vp:0, conPartner:false, conVp:false };
  for(const r of righe){ const q = Number(r.quantita) || 0;
    t.cliente += (numOrNull(r.prezzo) || 0) * q;
    if(numOrNull(r.prezzo_partner) != null){ t.partner += Number(r.prezzo_partner) * q; t.conPartner = true; }
    if(numOrNull(r.vp) != null){ t.vp += Number(r.vp) * q; t.conVp = true; } }
  return t;
}
function testoTotali(t){ return [`Cliente <b>${prezzo(t.cliente)}</b>`, t.conPartner ? `Partner <b>${prezzo(t.partner)}</b>` : "", t.conVp ? `<b>${num2(t.vp)}</b> VP` : ""].filter(Boolean).join(" · "); }
/* i prodotti che segue: per ognuno l'ultimo acquisto, e quando finisce (giorni × quantità) */
function scaffale(p){
  const ultimo = new Map();
  for(const o of ordiniDi(p.id).slice().reverse()) for(const r of righeDi(o.id)) ultimo.set(r.codice, { r, data:o.data });
  const lasciati = new Set(p.lasciati || []);
  return [...ultimo.values()].filter(x => !lasciati.has(x.r.codice)).map(({ r, data }) => {
    const finisce = piuGiorni(data, giorniDi(r.codice) * r.quantita);
    return { codice:r.codice, nome:r.nome, quantita:r.quantita, prezzo:r.prezzo, data, finisce, tra:giorniTra(oggi(), finisce) };
  }).sort((a, b) => a.finisce < b.finisce ? -1 : 1);
}
/* Senza prodotti segnati (ordini importati dal sito Amway): ogni quanto ordina. È la mediana degli intervalli tra
   un ordine e l'altro; con un ordine solo vale la durata di base. Il prossimo è atteso dopo l'ultimo + il ritmo. */
function ritmoDi(p){
  const date = [...new Set(ordiniDi(p.id).map(o => o.data))].sort();
  if(!date.length) return null;
  const salti = date.slice(1).map((d, i) => giorniTra(date[i], d)).filter(g => g > 0).sort((a, b) => a - b);
  const giorni = salti.length ? salti[Math.floor((salti.length - 1) / 2)] : DURATA_BASE;
  const finisce = piuGiorni(date[date.length - 1], giorni);
  return { giorni, stimato:!salti.length, finisce, tra:giorniTra(oggi(), finisce), nome:"il solito ordine", codice:"" };
}
/* lo stato in una parola: chi non compra più, chi non ha mai ordinato, chi è rimandato, fermo, in ritardo, sta finendo, a posto */
function statoCliente(p){
  if(p.non_compra) return { key:"perso", txt:"Non compra più", cl:"" };
  const o = ordiniDi(p.id);
  if(!o.length) return { key:"mai", txt:"Mai ordinato", cl:"g" };
  let s = scaffale(p);
  /* nessun prodotto segnato: vale il ritmo degli ordini */
  if(!s.length && !o.some(x => righeDi(x.id).length)) s = [ritmoDi(p)];
  if(!s.length) return { key:"senza", txt:"Nessun prodotto seguito", cl:"" };
  if(p.prossima_data && p.prossima_data > oggi()) return { key:"rinviato", txt:`Da risentire il ${dataIt(p.prossima_data)}`, cl:"", primo:s[0] };
  const ultima = s.reduce((m, x) => x.finisce > m ? x.finisce : m, s[0].finisce);
  if(giorniTra(ultima, oggi()) > FERMO_DOPO) return { key:"fermo", txt:"Fermo", cl:"r", primo:s[0] };
  if(s[0].tra < 0) return { key:"ritardo", txt:"Doveva riordinare", cl:"r", primo:s[0] };
  if(s[0].tra <= PREAVVISO) return { key:"ora", txt:"Sta finendo", cl:"g", primo:s[0] };
  return { key:"ok", txt:"A posto", cl:"v", primo:s[0] };
}
/* gli ordini fatti da me ancora da consegnare o da pagare: un'etichetta finché non si spunta */
function etichetteOrdini(p){
  const io = ordiniDi(p.id).filter(o => o.modo === "io");
  return [io.some(o => !o.consegnato) ? "Da consegnare" : "", io.some(o => !o.pagato) ? "Da pagare" : ""].filter(Boolean)
    .map(t => `<span class="pill g">${t}</span>`).join("");
}
function abitudine(p){ const n = ordiniDi(p.id).length; return n === 1 ? "Ha provato" : n > 1 ? "Ricompra" : ""; }
/* "come ti sei trovato": qualche giorno dopo un ordine con un prodotto mai preso prima, per 30 giorni */
function verificaDi(p){
  if(p.non_compra) return null;
  const visti = new Set();
  let trovata = null;
  for(const o of ordiniDi(p.id).slice().reverse()){
    const nuovi = righeDi(o.id).filter(r => !visti.has(r.codice));
    righeDi(o.id).forEach(r => visti.add(r.codice));
    if(!nuovi.length || o.verificato) continue;
    const quando = piuGiorni(o.data, VERIFICA_DOPO), tra = giorniTra(oggi(), quando);
    if(tra <= 0 && tra >= -FINESTRA_VERIFICA) trovata = { o, nuovi, giorni:giorniTra(o.data, oggi()) };
  }
  return trovata;
}
function compleannoDi(p){
  if(!p.compleanno || p.non_compra) return null;
  const [mm, gg] = p.compleanno.split("-").map(Number), anno = Number(oggi().slice(0, 4));
  let quando = `${anno}-${p.compleanno}`, festa = anno;
  if(quando < oggi()){ festa = anno + 1; quando = `${festa}-${p.compleanno}`; }
  return { quando, tra:giorniTra(oggi(), quando), anno:festa, testo:`${gg} ${MESI_LUNGHI[mm - 1]}`, fatto:Number(p.auguri_anno) === festa };
}
/* su Io: i clienti da sentire, con il perché */
function clientiDaSentire(){
  const out = [];
  for(const p of clientiTutti()){
    if(p.non_compra || p.nascosta_io) continue;
    const s = statoCliente(p), v = verificaDi(p), c = compleannoDi(p);
    if(c && !c.fatto && c.tra <= COMPLEANNO_PRIMA) out.push({ p, ordine:c.tra, motivo:c.tra === 0 ? "Compleanno oggi" : `Compleanno il ${c.testo}` });
    else if(v) out.push({ p, ordine:1, motivo:`Come si è trovato con ${v.nuovi[0].nome}` });
    else if(s.key === "ritardo" || s.key === "ora") out.push({ p, ordine:s.primo.tra,
      motivo:s.primo.codice ? `${s.txt}: ${s.primo.nome}` : `${s.key === "ritardo" ? "Doveva riordinare" : "Riordino atteso"}: di solito ordina ogni ${s.primo.giorni} giorni` });
  }
  return out.sort((a, b) => a.ordine - b.ordine);
}
function vClientiDaSentire(){
  const l = clientiDaSentire();
  if(!l.length) return "";
  return `<div class="card">
    <span class="eyebrow">I tuoi clienti da sentire</span>
    <ul class="persone">${l.map(x => `<li class="su-io"><button class="persona" data-act="apri-cliente" data-id="${esc(x.p.id)}">
      <span class="grow"><b>${esc(x.p.nome)}</b><br><span class="small">${esc(x.motivo)}</span></span></button>
      <button class="x" data-act="togli-da-io" data-id="${esc(x.p.id)}" aria-label="Togli ${esc(x.p.nome)} da Io">×</button></li>`).join("")}</ul>
  </div>`;
}

function vClienti(){
  if(st.personaId) return vCliente();
  const filtro = FILTRI_CLIENTI.find(x => x.id === st.filtroClienti) || FILTRI_CLIENTI[0];
  const tutti = clientiTutti(), l = tutti.filter(filtro.ok).sort((a, b) => {
    const sa = statoCliente(a), sb = statoCliente(b);
    return (sa.primo ? sa.primo.finisce : "9999") < (sb.primo ? sb.primo.finisce : "9999") ? -1 : 1; });
  return `<div class="card">
    <div class="spread"><span class="con-aiuto"><span class="eyebrow">I miei clienti</span>${aiutoBtn("clienti")}</span>
      <span class="row" style="gap:6px">${btnAmway("Da Amway", "small")}
      <button class="btn small primary" data-act="cliente-nuovo">+ Un cliente</button></span></div>
    ${aiutoTesto("clienti", `I tuoi clienti e i loro ordini: l'app ti avvisa quando un prodotto sta per finire o è ora di risentirli. Li vedi
      solo tu. Gli ordini scritti qui servono per i riordini e non cambiano i tuoi VP: i VP arrivano dal report Amway.`)}
    ${tutti.length ? `<div class="row wrap scelte-rapide" style="gap:6px;margin-top:10px">${FILTRI_CLIENTI.map(x =>
      `<button class="btn small${x.id === filtro.id ? " on" : ""}" data-act="filtro-clienti" data-filtro="${x.id}" aria-pressed="${x.id === filtro.id}">${x.nome} · ${tutti.filter(x.ok).length}</button>`).join("")}</div>
    ${l.length ? `<ul class="persone">${l.map(p => { const s = statoCliente(p);
      return `<li><button class="persona" data-act="apri-cliente" data-id="${esc(p.id)}">
        <span class="grow"><b>${esc(p.nome)}</b><br><span class="small">${s.primo && s.key !== "fermo" ? (s.primo.codice ? `${esc(s.primo.nome)} · finisce il ${dataIt(s.primo.finisce)}` : `prossimo ordine atteso il ${dataIt(s.primo.finisce)}`) : esc(abitudine(p) || "nessun ordine")}</span></span>
        <span class="etichette">${etichetteOrdini(p)}<span class="pill ${s.cl}">${esc(s.txt)}</span></span></button></li>`; }).join("")}</ul>`
      : `<p class="muted" style="margin:10px 0 0">${filtro.id === "sentire" ? "Nessuno da sentire adesso." : "Nessun cliente qui."}</p>`}`
    : `<p class="muted" style="margin:8px 0 0">Ancora nessun cliente. Entrano da qui con "+ Un cliente", oppure dalla Lista quando chiudi una persona come Cliente.</p>`}
  </div>`;
}

function vCliente(){
  const p = st.persone.find(x => x.id === st.personaId);
  const indietro = `<button class="btn link" data-act="torna-clienti" style="padding:0">‹ I miei clienti</button>`;
  if(!p) return `${indietro}<p class="muted">Cliente non trovato.</p>`;
  const s = statoCliente(p), sc = scaffale(p), ord = ordiniDi(p.id), v = verificaDi(p), c = compleannoDi(p);
  const tel = numeroWa(p.contatto);
  return `${indietro}
  <div class="card">
    <div class="spread"><h2><button class="nome-modifica" data-act="persona-modifica" aria-label="Modifica i dati di ${esc(p.nome)}">${esc(p.nome)} <span aria-hidden="true">✎</span></button></h2><span class="etichette">${etichetteOrdini(p)}<span class="pill ${s.cl}">${esc(s.txt)}</span></span></div>
    <p class="small" style="margin:2px 0 0">${[p.contatto, abitudine(p), c ? `compleanno ${c.testo}` : "", p.codice_cliente ? `codice cliente ${p.codice_cliente}` : ""].filter(Boolean).map(esc).join(" · ")}</p>
    ${tel ? `<div class="row" style="gap:6px;margin-top:8px">
      <a class="btn small" href="tel:+${esc(tel)}">Chiama</a>
      <a class="btn small wa" target="_blank" rel="noopener" href="https://wa.me/${esc(tel)}">WhatsApp</a></div>` : ""}
    <div class="row" style="gap:8px;margin-top:12px">
      <button class="btn primary grow" data-act="ordine-nuovo">+ Ordine</button>
      ${ord.length ? `<button class="btn grow" data-act="ordine-ripeti">Ripeti l'ultimo</button>` : ""}</div>
    <div class="row wrap" style="gap:6px;margin-top:8px">
      <button class="btn small" data-act="messaggio-cliente">Scrivigli</button>
      <button class="btn small ghost" data-act="rimanda-cliente">Rimanda</button>
      <button class="btn small ghost" data-act="compleanno-cliente">${p.compleanno ? "Compleanno" : "+ Compleanno"}</button></div>
  </div>
  ${v ? `<div class="card avviso-cliente"><b>Come si è trovato?</b>
    <p class="small" style="margin:4px 0 8px">Sono passati ${v.giorni} giorni da quando ha preso ${esc(v.nuovi.map(r => r.nome).join(" e "))}: è il momento di chiederglielo.</p>
    <div class="row" style="gap:6px"><button class="btn small" data-act="messaggio-cliente" data-tipo="checkin">Scrivigli</button>
      <button class="btn small ghost" data-act="verifica-fatta" data-id="${esc(v.o.id)}">Fatto, gliel'ho chiesto</button></div></div>` : ""}
  ${c && !c.fatto && c.tra <= COMPLEANNO_PRIMA ? `<div class="card avviso-cliente"><b>${c.tra === 0 ? "Oggi è il suo compleanno" : `Compleanno il ${c.testo}`}</b>
    <div class="row" style="gap:6px;margin-top:8px"><button class="btn small" data-act="messaggio-cliente" data-tipo="auguri">Auguri</button>
      <button class="btn small ghost" data-act="auguri-fatti">Fatti</button></div></div>` : ""}
  <div class="card">
    <span class="eyebrow">Cosa usa</span>
    ${sc.length ? `<ul class="oggi">${sc.map(x => `<li>
      <span class="grow"><b>${esc(x.nome)}</b>${x.quantita > 1 ? ` × ${x.quantita}` : ""}<br>
        <span class="small">${x.tra < 0 ? `finito ${-x.tra === 1 ? "ieri" : `${-x.tra} giorni fa`}` : x.tra === 0 ? "finisce oggi" : `finisce il ${dataIt(x.finisce)}`} · dura ${giorniDi(x.codice)} giorni
          <button class="btn link small" data-act="durata-prodotto" data-codice="${esc(x.codice)}" style="min-height:0;padding:0 2px">cambia</button></span></span>
      <button class="btn small" data-act="riordinato" data-codice="${esc(x.codice)}">Riordinato</button>
      <button class="x" data-act="lascia-prodotto" data-codice="${esc(x.codice)}" aria-label="Non lo prende più">×</button></li>`).join("")}</ul>`
      : ord.length && !ord.some(o => righeDi(o.id).length) ? (() => { const r = ritmoDi(p);
          return `<p class="small" style="margin:6px 0 0">${r.stimato ? "Un ordine solo: il prossimo lo aspetto dopo" : "Di solito ordina ogni"} <b>${r.giorni} giorni</b>:
            prossimo atteso il <b>${dataIt(r.finisce)}</b>.</p><p class="nota">Gli ordini dal sito Amway non hanno i prodotti: se li aggiungi, l'app ti dice anche cosa finisce.</p>`; })()
      : `<p class="muted" style="margin:6px 0 0">${ord.length ? "Nessun prodotto seguito." : "Ancora nessun ordine: segna il primo con + Ordine."}</p>`}
  </div>
  ${ord.length ? `<div class="card">
    <span class="eyebrow">Ordini</span>
    <ul class="oggi">${ord.map(o => { const rr = righeDi(o.id), tr = totaliRighe(rr);
      /* con i prodotti: i totali dalle righe (i VP dell'ordine importato restano quelli di Amway); senza: valore e VP del sito */
      const totali = rr.length ? ` · ${prezzo(tr.cliente)}${tr.conPartner ? ` · Partner ${prezzo(tr.partner)}` : ""}${o.vp ? ` · ${num2(o.vp)} VP` : tr.conVp ? ` · ${num2(tr.vp)} VP` : ""}`
        : `${Number(o.importo) ? ` · ${prezzo(o.importo)}` : ""}${o.vp ? ` · ${num2(o.vp)} VP` : ""}`;
      return `<li><span class="grow"><b>${dataIt(o.data)}</b> · ${o.modo === "io" ? "fatto da me" : "dal sito"}${totali}<br>
        <span class="small">${rr.length ? rr.map(r => esc(r.nome) + (r.quantita > 1 ? ` × ${r.quantita}` : "")).join(", ")
          : `<button class="btn link small" data-act="ordine-modifica" data-id="${esc(o.id)}" style="min-height:0;padding:0">+ Aggiungi i prodotti</button>`}
          ${o.nota ? `<br>${esc(o.nota)}` : ""}</span>
        ${o.modo === "io" ? `<br><span class="row" style="gap:6px;margin-top:4px">
          <button class="btn small${o.consegnato ? " on" : " ghost"}" data-act="ordine-consegnato" data-id="${esc(o.id)}">${o.consegnato ? "✓ Consegnato" : "Consegnato?"}</button>
          <button class="btn small${o.pagato ? " on" : " ghost"}" data-act="ordine-pagato" data-id="${esc(o.id)}">${o.pagato ? "✓ Pagato" : "Pagato?"}</button></span>` : ""}</span>
        <button class="btn small ghost" data-act="ordine-modifica" data-id="${esc(o.id)}">Modifica</button></li>`; }).join("")}</ul>
  </div>` : ""}
  <div class="row wrap" style="gap:6px;justify-content:center">
    <button class="btn small ghost" data-act="apri-persona" data-id="${esc(p.id)}">Il suo percorso nella lista</button>
    <button class="btn small ghost" data-act="${p.nascosta_io ? "rimetti-in-io" : "togli-da-io"}" data-id="${esc(p.id)}">${p.nascosta_io ? "Rimetti in Io" : "Togli da Io"}</button>
    <button class="btn small ghost" data-act="cliente-non-compra">${p.non_compra ? "Torna cliente" : "Non compra più"}</button>
  </div>`;
}

/* ---- I messaggi pronti (come nella mini app) ---- */
function messaggiCliente(p, tipo){
  const n = p.nome.split(" ")[0], sc = scaffale(p);
  if(tipo === "checkin"){
    const v = verificaDi(p), prod = v ? v.nuovi.map(r => r.nome).join(" e ") : "quello che hai preso", gg = v ? v.giorni : VERIFICA_DOPO;
    return { titolo:"Come ti sei trovato", fatto:v ? "verifica" : "",
      guida:"Questo messaggio non chiede niente — ed è per questo che funziona: è il punto in cui uno che ha provato diventa uno che ricompra.",
      varianti:[{ label:"Aperto", testo:`Ciao ${n}, sono passati ${gg} giorni da quando hai preso ${prod}: come ti stai trovando?\n\nSe c'è qualcosa che non ti torna dimmelo pure — mi interessa più sapere com'è andata che venderti altro.` },
        { label:"Pratico", testo:`Ciao ${n}, ti scrivo per sapere come va con ${prod}. Riesci a usarlo tutti i giorni? Se hai dubbi su quanto prenderne o su quando, chiedimi: sono due minuti.` },
        { label:"Corto", testo:`Ciao ${n}, tutto bene con ${prod}?` }] };
  }
  if(tipo === "auguri"){
    const suggerito = sc.length ? sc[0].nome : "quello che usi di solito";
    return { titolo:"Auguri", fatto:"auguri",
      guida:"Gli auguri restano auguri: la proposta, se vuoi farla, va qualche giorno dopo (Il regalo · Sul prodotto).",
      varianti:[{ label:"Semplice", testo:`Buon compleanno ${n}! Ti auguro una giornata come la vuoi tu.` },
        { label:"Caldo", testo:`Tanti auguri ${n}! Spero che oggi ti facciano festeggiare come si deve. Un abbraccio.` },
        { label:"Il regalo (dopo)", testo:`Ciao ${n}, ti devo ancora il regalo di compleanno. Ho pensato a [scrivi cosa: un campione, un prodotto in omaggio, lo sconto che puoi fare]: se ti va te lo porto con il prossimo ordine.` },
        { label:"Sul prodotto (dopo)", testo:`Ciao ${n}, per il tuo compleanno volevo farti un pensiero: su ${suggerito} posso lasciarti [scrivi cosa] fino a [data]. Dimmi se ti interessa e te lo metto da parte.` }] };
  }
  /* tutti i prodotti che finiscono entro il preavviso (anche quelli già finiti); se nessuno, il primo che finisce */
  const vicini = sc.filter(x => x.tra <= PREAVVISO), l = vicini.length ? vicini : sc.slice(0, 1), tanti = l.length > 1;
  const elenco = l.map(x => x.nome), prod = l.length ? (tanti ? elenco.slice(0, -1).join(", ") + " e " + elenco[elenco.length - 1] : elenco[0]) : "quello che prendi di solito";
  const quanti = !tanti && l[0] && l[0].quantita > 1 ? ` Te ne riporto ${l[0].quantita} come l'altra volta?`
    : tanti && l.some(x => x.quantita > 1) ? " Te li riporto nelle stesse quantità dell'altra volta?" : "";
  return { titolo:"Sta finendo", fatto:"",
    guida:"Chiedere non è insistere: se dice che ne ha ancora, usa «Rimanda» e la data si sposta senza perdere niente.",
    varianti:[{ label:"Diretto", testo:`Ciao ${n}, se non ho sbagliato i conti ${prod} ${tanti ? "ti stanno finendo" : "ti sta finendo"} in questi giorni. ${tanti ? "Ti servono" : "Te ne serve"} ancora?${quanti}` },
      { label:"Con l'ordine", testo:`Ciao ${n}, sto per fare un ordine: ti aggiungo ${prod}? Dovrebbe essere più o meno il momento in cui ${tanti ? "finiscono" : "finisce"}.` },
      { label:"Dopo un silenzio", testo:`Ciao ${n}, mi sono accorto che non ci sentiamo da un po'. Come stai?\n\n${tanti ? `${prod}: li hai finiti o hai deciso di lasciarli?` : `Il ${prod} l'hai finito o hai deciso di lasciarlo?`} Dimmelo tranquillamente, non me la prendo — mi serve solo per non farti telefonate a vuoto.` }] };
}
function tipoMessaggio(p){
  const c = compleannoDi(p);
  if(c && !c.fatto && c.tra <= COMPLEANNO_PRIMA) return "auguri";
  if(verificaDi(p)) return "checkin";
  return "finendo";
}

function vSheetClienti(s){
  const p = st.persone.find(x => x.id === st.personaId);
  const annulla = `<button type="button" class="btn ghost grow" data-act="chiudi">Annulla</button>`;
  if(s === "ordine-cliente" && p){
    const b = st.bozza;
    return `<h2>${b.ordineId ? "Modifica l'ordine" : `Ordine di ${esc(nomeSaluto(p.nome))}`}</h2>
    <form data-form="ordine-cliente" novalidate>
      ${b.numero ? `<p class="small">Ordine n. ${esc(b.numero)} dal sito Amway${b.vp ? ` · ${num(b.vp)} VP` : ""}: il numero resta quello.
        Aggiungi cosa ha preso, così l'app sa quando finisce.</p>` : ""}
      <label class="field"><span>Quando</span><input type="date" name="data" max="${oggi()}" value="${esc(b.data)}" data-bozza="data"></label>
      <fieldset class="field"><legend>Come ha ordinato</legend>
        <div class="opzioni">${[["sito", "Da solo, dal sito Amway"], ["io", "L'ho fatto io"]].map(([v, t]) =>
          `<label class="chip"><input type="radio" name="modo" value="${v}" data-bozza="modo"${b.modo === v ? " checked" : ""}><span>${t}</span></label>`).join("")}</div></fieldset>
      <fieldset class="field"><legend>Prodotti</legend>
        ${b.righe.length ? `<ul class="righe-ordine">${b.righe.map((r, i) => `<li>
          <span class="grow"><b>${esc(r.nome)}</b>${r.prezzo_partner != null || r.vp != null ? `<br><span class="small">${[r.prezzo_partner != null ? "Partner " + prezzo(r.prezzo_partner) : "",
            r.vp != null ? num2(r.vp) + " VP" : ""].filter(Boolean).join(" · ")}</span>` : ""}<br><span class="small">dura <input class="mini" type="number" min="1" max="3650" inputmode="numeric" value="${r.giorni}" data-riga="${i}" data-campo="giorni" aria-label="Giorni che dura"> giorni</span></span>
          <span class="qta"><button type="button" class="btn small ghost" data-act="riga-meno" data-i="${i}" aria-label="Uno in meno">−</button><b>${r.quantita}</b>
            <button type="button" class="btn small ghost" data-act="riga-piu" data-i="${i}" aria-label="Uno in più">+</button></span>
          <input class="mini prezzo" type="text" inputmode="decimal" value="${r.prezzo != null ? String(r.prezzo).replace(".", ",") : ""}" placeholder="€" data-riga="${i}" data-campo="prezzo" aria-label="Prezzo"></li>`).join("")}</ul>
          <p class="small" style="margin:6px 0 0" id="totale-ordine">Totale · ${testoTotali(totaliRighe(b.righe))}</p>` : `<p class="small muted">Cerca i prodotti qui sotto.</p>`}
        <input type="search" id="cerca-prodotto" class="cerca" placeholder="Cerca un prodotto Amway (nome o codice)…" autocomplete="off" value="${esc(st.cercaProdotto || "")}">
        <ul class="risultati-prodotto" id="risultati-prodotto">${risultatiProdotto(st.cercaProdotto)}</ul>
      </fieldset>
      <label class="field"><span>Nota <i>(facoltativa)</i></span><input name="nota" maxlength="500" value="${esc(b.nota || "")}" data-bozza="nota"></label>
      <div class="row" style="margin-top:16px">${annulla}<button class="btn primary grow">Salva l'ordine</button></div>
      ${b.ordineId ? `<button type="button" class="btn ghost wide" style="margin-top:8px" data-act="ordine-togli" data-id="${esc(b.ordineId)}">Elimina l'ordine</button>` : ""}
    </form>`;
  }
  if(s === "messaggio-cliente" && p){
    const m = messaggiCliente(p, st.tipoMsg), v = m.varianti[st.varianteMsg] || m.varianti[0], tel = numeroWa(p.contatto);
    return `<h2>${esc(m.titolo)}</h2>
    <div class="opzioni tipi">${[["finendo", "Sta finendo"], ["checkin", "Come ti sei trovato"], ["auguri", "Auguri"]].map(([k, t]) =>
      `<button type="button" class="btn small${k === st.tipoMsg ? " on" : ""}" data-act="tipo-msg" data-tipo="${k}">${t}</button>`).join("")}</div>
    <p class="small">${esc(m.guida)}</p>
    <div class="opzioni">${m.varianti.map((x, i) => `<button type="button" class="btn small${x === v ? " on" : " ghost"}" data-act="variante-msg" data-i="${i}">${esc(x.label)}</button>`).join("")}</div>
    <textarea id="testo-msg" rows="7" style="margin-top:10px">${esc(v.testo)}</textarea>
    <div class="row" style="gap:8px;margin-top:10px">
      <button class="btn wa grow" data-act="manda-msg" data-tel="${esc(tel)}">${tel ? "Apri la sua chat WhatsApp" : "WhatsApp"}</button>
      <button class="btn grow" data-act="copia-msg">Copia</button></div>
    ${m.fatto ? `<button class="btn ghost wide" style="margin-top:8px" data-act="${m.fatto === "auguri" ? "auguri-fatti" : "verifica-fatta"}"${m.fatto === "verifica" ? ` data-id="${esc(verificaDi(p).o.id)}"` : ""}>Fatto</button>` : ""}
    <button class="btn ghost wide" style="margin-top:8px" data-act="chiudi">Chiudi</button>`;
  }
  if(s === "rimanda-cliente" && p) return `<h2>Rimanda ${esc(nomeSaluto(p.nome))}</h2>
    <p class="small">Se ne ha ancora: fino a quella data non compare tra quelli da sentire.</p>
    <form data-form="rimanda-cliente" novalidate>
      <div class="opzioni">${[["3", "3 giorni"], ["7", "1 settimana"], ["14", "2 settimane"], ["30", "1 mese"]].map(([v, t]) =>
        `<label class="chip"><input type="radio" name="giorni" value="${v}"${v === "7" ? " checked" : ""}><span>${t}</span></label>`).join("")}</div>
      <label class="field"><span>Perché <i>(facoltativo)</i></span><input name="nota" maxlength="200" placeholder="es. ne ha ancora mezzo flacone"></label>
      ${p.prossima_data && p.prossima_data > oggi() ? `<button type="button" class="btn ghost wide" style="margin-top:8px" data-act="rimanda-togli">Togli il rinvio (oggi è da risentire il ${dataIt(p.prossima_data)})</button>` : ""}
      <div class="row" style="margin-top:16px">${annulla}<button class="btn primary grow">Rimanda</button></div>
    </form>`;
  if(s === "compleanno-cliente" && p){ const [mm, gg] = (p.compleanno || "-").split("-");
    return `<h2>Il compleanno di ${esc(nomeSaluto(p.nome))}</h2>
    <form data-form="compleanno-cliente" novalidate>
      <div class="row" style="gap:8px">
        <label class="field grow"><span>Giorno</span><input name="giorno" type="number" min="1" max="31" inputmode="numeric" value="${esc(gg ? Number(gg) : "")}"></label>
        <label class="field grow"><span>Mese</span><select name="mese"><option value=""></option>${MESI_LUNGHI.map((x, i) => `<option value="${i + 1}"${Number(mm) === i + 1 ? " selected" : ""}>${x}</option>`).join("")}</select></label></div>
      <p class="nota">Senza anno. Qualche giorno prima te lo ricordo su Io, con gli auguri pronti.</p>
      <div class="row" style="margin-top:16px">${annulla}<button class="btn primary grow">Salva</button></div>
    </form>`; }
  if(s === "durata" && st.durataCodice){ const nome = (st.righe.find(r => r.codice === st.durataCodice) || {}).nome || st.durataCodice;
    return `<h2>Quanto dura</h2><p class="small">${esc(nome)}: vale per tutti i tuoi clienti.</p>
    <form data-form="durata" novalidate>
      <label class="field"><span>Giorni (una confezione)</span><input name="giorni" type="number" min="1" max="3650" inputmode="numeric" value="${giorniDi(st.durataCodice)}"></label>
      <div class="row" style="margin-top:16px">${annulla}<button class="btn primary grow">Salva</button></div>
    </form>`; }
  return "";
}
function risultatiProdotto(q){
  const t = senzaAccenti(q || "");
  if(t.length < 2) return "";
  const cat = st.listino.filter(r => r.attivo !== false && senzaAccenti(r.codice + " " + r.nome).includes(t)).slice(0, 8);
  return cat.map(r => `<li><button type="button" class="persona" data-act="aggiungi-prodotto" data-codice="${esc(r.codice)}">
      <span class="grow">${esc(r.nome)}<br><span class="small">${esc([r.codice, r.formato, r.prezzo_cliente != null ? prezzo(r.prezzo_cliente) : "",
        r.prezzo_partner != null ? "Partner " + prezzo(r.prezzo_partner) : "", r.vp != null ? num2(r.vp) + " VP" : ""].filter(Boolean).join(" · "))}</span></span><b>+</b></button></li>`).join("")
    + `<li><button type="button" class="persona" data-act="aggiungi-libero"><span class="grow"><i>Non c'è: aggiungi "${esc(q.trim())}"</i></span><b>+</b></button></li>`;
}
function nuovaBozza(righe){
  return { data:oggi(), modo:"sito", nota:"", righe:(righe || []).map(r => { const c = prodottoCatalogo(r.codice) || {};
    return { codice:r.codice, nome:r.nome, quantita:r.quantita || 1,
      prezzo:r.prezzo != null ? Number(r.prezzo) : c.prezzo ?? null,
      prezzo_partner:r.prezzo_partner != null ? Number(r.prezzo_partner) : c.prezzo_partner ?? null,
      vp:r.vp != null ? Number(r.vp) : c.vp ?? null, giorni:giorniDi(r.codice) }; }) };
}
async function salvaOrdine(pid, b){
  /* un ordine che c'è già (anche importato dal sito): si cambiano data, modo e nota, e i prodotti si riscrivono */
  const id = b.ordineId || uuid(), campi = { data:b.data, modo:b.modo, nota:(b.nota || "").trim() || null };
  if(b.ordineId){ await api.aggiornaOrdine(id, campi); await api.cancellaRighe(id); }
  else await api.nuovoOrdine(Object.assign({ id, persona_id:pid }, campi));
  if(b.righe.length) await api.nuoveRighe(b.righe.map(r => ({ id:uuid(), ordine_id:id, codice:r.codice, nome:r.nome.slice(0, 160), quantita:r.quantita,
    prezzo:numOrNull(r.prezzo), prezzo_partner:numOrNull(r.prezzo_partner), vp:numOrNull(r.vp) })));
  /* la durata scelta vale per tutti i miei clienti */
  for(const r of b.righe){ const g = Math.max(1, Math.min(3650, Number(r.giorni) || DURATA_BASE));
    if(g !== giorniDi(r.codice)) await api.salvaDurata(r.codice, g); }
  /* un ordine nuovo: niente più rinvio */
  if(!b.ordineId) await api.modificaPersona(pid, { prossima_data:null, prossima_nota:null, nascosta_io:false });   // un ordine nuovo la riporta su Io
}
async function dopoClienti(msg){ await caricaClienti(); await caricaPersone(); st.sheet = null; render(); if(msg) toast(msg); }
function apriWa(tel, testo){ window.open(`https://wa.me/${tel || ""}?text=` + encodeURIComponent(testo), "_blank", "noopener"); }

Object.assign(AZIONI, {
  "apri-cliente"(el){ st.vista = "persone"; st.sezPersone = "clienti"; st.invitoId = null; st.personaId = el.dataset.id; render(); window.scrollTo(0, 0); },
  "torna-clienti"(){ st.personaId = null; render(); window.scrollTo(0, 0); },
  "filtro-clienti"(el){ st.filtroClienti = el.dataset.filtro; render(); },
  "cliente-nuovo"(){ st.errore = ""; st.nuovoCliente = true; st.sheet = "persona-nuova"; render(); },
  "ordine-nuovo"(){ st.bozza = nuovaBozza([]); st.cercaProdotto = ""; st.sheet = "ordine-cliente"; render(); },
  "ordine-modifica"(el){
    const o = st.ordini.find(x => x.id === el.dataset.id);
    if(!o) return;
    st.bozza = Object.assign(nuovaBozza(righeDi(o.id)), { ordineId:o.id, data:o.data, modo:o.modo, nota:o.nota || "", numero:o.numero_amway, vp:o.vp });
    st.cercaProdotto = ""; st.sheet = "ordine-cliente"; render();
  },
  "importa-ordini"(){ st.errore = ""; st.impOrdini = null; st.sheet = "importa-ordini"; render(); },
  "ordine-ripeti"(){
    const o = ordiniDi(st.personaId)[0];
    st.bozza = nuovaBozza(righeDi(o.id)); st.bozza.modo = o.modo; st.cercaProdotto = ""; st.sheet = "ordine-cliente"; render();
  },
  async riordinato(el){
    const x = scaffale(st.persone.find(p => p.id === st.personaId)).find(y => y.codice === el.dataset.codice);
    if(!x) return;
    const b = nuovaBozza([x]); b.modo = (ordiniDi(st.personaId)[0] || {}).modo || "sito";
    try{ await salvaOrdine(st.personaId, b); await dopoClienti(`${x.nome}: riordinato oggi`); }catch(e){ toast(messaggio(e)); }
  },
  "aggiungi-prodotto"(el){
    const c = prodottoCatalogo(el.dataset.codice);
    if(!c) return;
    const r = st.bozza.righe.find(y => y.codice === c.codice);
    if(r) r.quantita = Math.min(99, r.quantita + 1);
    else st.bozza.righe.push({ codice:c.codice, nome:c.nome + (c.formato ? ` (${c.formato})` : ""), quantita:1, prezzo:c.prezzo,
      prezzo_partner:c.prezzo_partner, vp:c.vp, giorni:giorniDi(c.codice) });
    st.cercaProdotto = ""; render();
  },
  "aggiungi-libero"(){
    const nome = (st.cercaProdotto || "").trim();
    if(!nome) return;
    const codice = "P-" + senzaAccenti(nome).replace(/[^a-z0-9]+/g, "").slice(0, 18);
    st.bozza.righe.push({ codice, nome:nome.slice(0, 160), quantita:1, prezzo:null, prezzo_partner:null, vp:null, giorni:giorniDi(codice) });
    st.cercaProdotto = ""; render();
  },
  "riga-piu"(el){ const r = st.bozza.righe[Number(el.dataset.i)]; r.quantita = Math.min(99, r.quantita + 1); render(); },
  "riga-meno"(el){ const i = Number(el.dataset.i), r = st.bozza.righe[i]; if(r.quantita > 1) r.quantita--; else st.bozza.righe.splice(i, 1); render(); },
  async "ordine-consegnato"(el){ const o = st.ordini.find(x => x.id === el.dataset.id);
    try{ await api.aggiornaOrdine(o.id, { consegnato:o.consegnato ? null : oggi() }); await dopoClienti(); }catch(e){ toast(messaggio(e)); } },
  async "ordine-pagato"(el){ const o = st.ordini.find(x => x.id === el.dataset.id);
    try{ await api.aggiornaOrdine(o.id, { pagato:o.pagato ? null : oggi() }); await dopoClienti(); }catch(e){ toast(messaggio(e)); } },
  async "ordine-togli"(el){
    if(!confirm("Togliere questo ordine?")) return;
    try{ await api.cancellaOrdine(el.dataset.id); await dopoClienti("Ordine tolto"); }catch(e){ toast(messaggio(e)); }
  },
  async "lascia-prodotto"(el){
    const p = st.persone.find(x => x.id === st.personaId);
    if(!confirm("Non lo prende più? Smetto di ricordartelo (resta nello storico degli ordini).")) return;
    try{ await api.modificaPersona(p.id, { lasciati:(p.lasciati || []).concat([el.dataset.codice]) }); await dopoClienti("Non lo segue più"); }catch(e){ toast(messaggio(e)); }
  },
  "durata-prodotto"(el){ st.durataCodice = el.dataset.codice; st.sheet = "durata"; render(); },
  "messaggio-cliente"(el){
    const p = st.persone.find(x => x.id === st.personaId);
    st.tipoMsg = el.dataset.tipo || tipoMessaggio(p); st.varianteMsg = 0; st.sheet = "messaggio-cliente"; render();
  },
  "tipo-msg"(el){ st.tipoMsg = el.dataset.tipo; st.varianteMsg = 0; render(); },
  "variante-msg"(el){ st.varianteMsg = Number(el.dataset.i); render(); },
  "manda-msg"(el){ apriWa(el.dataset.tel, document.getElementById("testo-msg").value); },
  async "copia-msg"(){ try{ await navigator.clipboard.writeText(document.getElementById("testo-msg").value); toast("Messaggio copiato"); }catch(e){ toast(messaggio(e)); } },
  async "verifica-fatta"(el){ try{ await api.aggiornaOrdine(el.dataset.id, { verificato:oggi() }); await dopoClienti("Fatto: gli hai chiesto come si è trovato"); }catch(e){ toast(messaggio(e)); } },
  async "auguri-fatti"(){ const p = st.persone.find(x => x.id === st.personaId), c = compleannoDi(p);
    try{ await api.modificaPersona(p.id, { auguri_anno:c ? c.anno : Number(oggi().slice(0, 4)) }); await dopoClienti("Auguri fatti"); }catch(e){ toast(messaggio(e)); } },
  "rimanda-cliente"(){ st.sheet = "rimanda-cliente"; render(); },
  async "rimanda-togli"(){ try{ await api.modificaPersona(st.personaId, { prossima_data:null, prossima_nota:null }); await dopoClienti("Rinvio tolto"); }catch(e){ toast(messaggio(e)); } },
  "compleanno-cliente"(){ st.sheet = "compleanno-cliente"; render(); },
  async "cliente-non-compra"(){ const p = st.persone.find(x => x.id === st.personaId);
    try{ await api.modificaPersona(p.id, { non_compra:!p.non_compra }); await dopoClienti(p.non_compra ? "Di nuovo tra i clienti" : "Segnato: non compra più"); }catch(e){ toast(messaggio(e)); } }
});

Object.assign(MODULI, {
  async "ordine-cliente"(f){
    const b = st.bozza;
    if(!b.righe.length && !b.ordineId){ mostraErroreForm(f, "Aggiungi almeno un prodotto."); return; }
    if(!b.data || b.data > oggi()){ mostraErroreForm(f, "Scegli il giorno dell'ordine (non nel futuro)."); return; }
    try{ await salvaOrdine(st.personaId, b); st.bozza = null; await dopoClienti(b.ordineId ? "Ordine modificato" : "Ordine salvato"); }catch(e){ mostraErroreForm(f, messaggio(e)); }
  },
  async "rimanda-cliente"(f){
    const g = Number((f.querySelector("input[name=giorni]:checked") || {}).value || 7);
    try{ await api.modificaPersona(st.personaId, { prossima_data:piuGiorni(oggi(), g), prossima_nota:f.nota.value.trim() || null, nascosta_io:false }); await dopoClienti("Rimandato"); }
    catch(e){ mostraErroreForm(f, messaggio(e)); }
  },
  async "compleanno-cliente"(f){
    const g = Number(f.giorno.value), m = Number(f.mese.value);
    const v = !g && !m ? null : (g >= 1 && g <= 31 && m >= 1 && m <= 12) ? `${String(m).padStart(2, "0")}-${String(g).padStart(2, "0")}` : "x";
    if(v === "x"){ mostraErroreForm(f, "Scegli giorno e mese."); return; }
    try{ await api.modificaPersona(st.personaId, { compleanno:v }); await dopoClienti("Compleanno salvato"); }catch(e){ mostraErroreForm(f, messaggio(e)); }
  },
  async durata(f){
    const g = Number(f.giorni.value);
    if(!(g >= 1 && g <= 3650)){ mostraErroreForm(f, "Scrivi i giorni (da 1 a 3650)."); return; }
    try{ await api.salvaDurata(st.durataCodice, g); await dopoClienti("Durata salvata"); }catch(e){ mostraErroreForm(f, messaggio(e)); }
  }
});

document.addEventListener("input", e => {
  const t = e.target;
  if(!t || !st.bozza) return;
  if(t.id === "cerca-prodotto"){ st.cercaProdotto = t.value; const u = document.getElementById("risultati-prodotto"); if(u) u.innerHTML = risultatiProdotto(t.value); return; }
  if(t.dataset && t.dataset.bozza) st.bozza[t.dataset.bozza] = t.value;
  if(t.dataset && t.dataset.riga != null){
    const r = st.bozza.righe[Number(t.dataset.riga)];
    if(t.dataset.campo === "prezzo") r.prezzo = t.value.trim() ? numIt(t.value) : null; else r.giorni = Number(t.value) || DURATA_BASE;
    const tot = document.getElementById("totale-ordine");
    if(tot) tot.innerHTML = "Totale · " + testoTotali(totaliRighe(st.bozza.righe));
  }
});
document.addEventListener("change", e => { const t = e.target; if(t && st.bozza && t.dataset && t.dataset.bozza) st.bozza[t.dataset.bozza] = t.value; });

/* ---- 11e. Clienti dal sito Amway: l'export "Ordini" e l'export "Clienti" (letti solo sul telefono) ----
   Ordini: Nome ("Cognome, Nome"), Codice Cliente, Data ordine ("18 agosto 2026"), Numero ordine, VP, VV, Tipo ordine.
   L'export parte sempre da settembre: gli ordini già importati (stesso numero d'ordine) si saltano.
   Clienti: Nome, Codice Cliente, Data di ingresso, Telefono ("Principale: +39 …"), Data ultimo ordine ("--" se mai).
   Del file Clienti si tengono solo nome, codice, telefono (se manca) e ultimo ordine: niente email, niente indirizzo.
   Si possono scegliere i due file insieme, e rifarlo quante volte si vuole: niente doppioni. */
function dataLunga(v){
  const m = pulito(v).toLowerCase().match(/^(\d{1,2})\s+([a-zà]+)\s+(\d{4})$/);
  if(!m) return null;
  const mese = MESI_LUNGHI.indexOf(m[2]);
  return mese < 0 ? null : `${m[3]}-${String(mese + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}
function nomeAmway(v){ const t = pulito(v); const [cognome, nome] = t.split(",").map(x => x.trim()); return nome ? `${nome} ${cognome}` : t; }
function maiuscole(t){ return t.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()); }
function telefonoAmway(v){ const m = pulito(v).match(/\+?\d[\d\s./-]{5,}\d/); return m ? m[0].replace(/[^\d+]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) : ""; }
/* riconosce da solo che file è (ordini o clienti) */
function leggiFileAmway(testo){
  const righe = righeCsv(testo);
  const h = righe.findIndex(r => r.some(c => /codice cliente/i.test(c)));
  if(h < 0) return { errore:"Questo file non sembra un export del sito Amway (manca il Codice Cliente)." };
  const col = n => righe[h].findIndex(c => c.trim().toLowerCase() === n);
  const corpo = righe.slice(h + 1);
  if(col("numero ordine") >= 0){
    const c = { nome:col("nome"), codice:col("codice cliente"), data:col("data ordine"), numero:col("numero ordine"), vp:col("vp"), vv:col("vv") };
    if(Object.values(c).slice(0, 4).some(i => i < 0)) return { errore:"Nel file degli ordini mancano alcune colonne (Nome, Codice Cliente, Data ordine, Numero ordine)." };
    const ordini = [];
    for(const r of corpo){
      const codice = pulito(r[c.codice]).replace(/\D/g, ""), numero = pulito(r[c.numero]).replace(/\D/g, ""), data = dataLunga(r[c.data]);
      if(!codice || !numero || !data) continue;
      ordini.push({ nome:maiuscole(nomeAmway(r[c.nome])), codice, numero, data,
        vp:c.vp >= 0 ? numReport(r[c.vp]) || 0 : 0, vv:c.vv >= 0 ? numReport(r[c.vv]) || 0 : 0 });
    }
    return ordini.length ? { ordini, anagrafica:[] } : { errore:"Nel file non ci sono ordini." };
  }
  const c = { nome:col("nome"), codice:col("codice cliente"), ingresso:col("data di ingresso"), tel:col("telefono"), ultimo:col("data ultimo ordine") };
  if(c.nome < 0 || c.ultimo < 0) return { errore:"Questo file non sembra l'export degli ordini né quello dei clienti del sito Amway." };
  const anagrafica = [];
  for(const r of corpo){
    const codice = pulito(r[c.codice]).replace(/\D/g, "");
    if(!codice || !pulito(r[c.nome])) continue;
    anagrafica.push({ nome:maiuscole(nomeAmway(r[c.nome])), codice, ingresso:c.ingresso >= 0 ? dataLunga(r[c.ingresso]) : null,
      tel:c.tel >= 0 ? telefonoAmway(r[c.tel]) : "", ultimo:dataLunga(r[c.ultimo]) });
  }
  return anagrafica.length ? { ordini:[], anagrafica } : { errore:"Nel file non ci sono clienti." };
}
/* Per ogni cliente del file (una persona sola anche se compare con più codici): chi è già in Growup (per codice,
   altrimenti per nome), cosa manca (ordini, ultimo ordine, telefono, codice), chi è nuovo e chi non ha mai comprato. */
function analizzaAmway(r){
  const gia = new Set(st.ordini.map(o => o.numero_amway).filter(Boolean));
  const gruppi = new Map(), perNome = new Map();
  const gruppo = (codice, nome) => {
    if(gruppi.has(codice)) return gruppi.get(codice);
    const k = senzaAccenti(nome);
    let g = perNome.get(k);
    if(!g){ g = { nome, codici:[], ordini:[], tel:"", ingresso:null, ultimo:null }; perNome.set(k, g); }
    if(!g.codici.includes(codice)) g.codici.push(codice);
    gruppi.set(codice, g);
    return g;
  };
  for(const o of r.ordini) gruppo(o.codice, o.nome).ordini.push(o);
  for(const a of r.anagrafica){
    const g = gruppo(a.codice, a.nome);
    g.tel = g.tel || a.tel;
    if(a.ingresso && (!g.ingresso || a.ingresso < g.ingresso)) g.ingresso = a.ingresso;
    if(a.ultimo && (!g.ultimo || a.ultimo > g.ultimo)){ g.ultimo = a.ultimo; g.codiceUltimo = a.codice; }
  }
  const trovati = [], nuovi = [], mai = [];
  let ordiniNuovi = 0;
  for(const g of perNome.values()){
    /* il codice da tenere: quello dell'ultimo ordine */
    const recente = g.ordini.slice().sort((a, b) => a.data < b.data ? 1 : -1)[0];
    g.codice = recente ? recente.codice : g.codiceUltimo || g.codici[0];
    g.doppio = g.codici.length > 1;
    g.daImportare = g.ordini.filter(o => !gia.has(o.numero));
    const k = senzaAccenti(g.nome);
    let p = st.persone.find(y => y.codice_cliente && g.codici.includes(y.codice_cliente)), dalNome = false;
    if(!p){ p = st.persone.find(y => senzaAccenti(y.nome) === k && !y.codice_cliente) || st.persone.find(y => senzaAccenti(y.nome) === k); dalNome = !!p; }
    const date = g.ordini.map(o => o.data);
    if(g.ultimo) date.push(g.ultimo);
    g.primo = date.sort()[0] || null;
    g.compra = !!date.length;
    /* l'ultimo ordine dall'elenco clienti entra nello storico se non c'è già un ordine da quella data in poi */
    /* si guardano solo gli ordini fatti sul sito: quelli "fatti da me" non sono nell'elenco Amway del cliente e non lo sostituiscono */
    const giaDopo = (p ? ordiniDi(p.id).filter(o => o.modo === "sito").map(o => o.data) : []).concat(g.ordini.map(o => o.data)).some(d => d >= g.ultimo);
    g.ultimoDaAggiungere = g.ultimo && !giaDopo ? g.ultimo : null;
    ordiniNuovi += g.daImportare.length + (g.ultimoDaAggiungere ? 1 : 0);
    if(p){
      g.p = p; g.dalNome = dalNome;
      g.telDaAggiungere = !p.contatto && g.tel ? g.tel : "";
      g.diventaCliente = g.compra && p.esito !== "cliente";
      g.cambia = !!(g.daImportare.length || g.ultimoDaAggiungere || g.telDaAggiungere || !p.codice_cliente || g.diventaCliente);
      trovati.push(g);
    } else (g.compra ? nuovi : mai).push(g);
  }
  return { trovati, nuovi, mai, ordini:r.ordini.length, clienti:r.anagrafica.length, ordiniNuovi,
    cambi:trovati.filter(g => g.cambia).length + nuovi.length + mai.length };
}
function vSheetOrdiniAmway(s){
  if(s !== "importa-ordini") return "";
  const a = st.impOrdini;
  if(!a) return `<h2>Clienti e ordini dal sito Amway</h2>
    <p class="small">Sul sito Amway scarica in CSV l'export degli <b>Ordini</b>, quello dei <b>Clienti</b>, o tutti e due, e sceglili qui
      (anche insieme). I file restano sul telefono: si salvano solo nome, codice cliente, telefono e gli ordini (data, numero, valore, VP).
      Email e indirizzo no. Quello che c'è già si salta: puoi rifarlo quando vuoi.</p>
    <label class="btn primary wide" style="margin-top:12px">Scegli i file CSV
      <input type="file" id="file-ordini" accept=".csv,text/csv,text/comma-separated-values" multiple hidden></label>
    ${st.errore ? `<p class="errore">${esc(st.errore)}</p>` : ""}
    <button class="btn ghost wide" style="margin-top:8px" data-act="chiudi">Chiudi</button>`;
  const riga = g => `${g.doppio ? `<br><span class="small">compare con ${g.codici.length} codici cliente: una scheda sola</span>` : ""}`;
  const scelta = (nome, g, extra) => `<label><input type="checkbox" name="${nome}" value="${esc(g.codice)}" checked>
    <span>${esc(g.nome)}<br><span class="small">${esc(extra)}</span>${riga(g)}</span></label>`;
  const cosa = g => [g.daImportare.length ? plur(g.daImportare.length, "ordine nuovo", "ordini nuovi") : "", g.ultimoDaAggiungere ? "ultimo ordine" : "",
    g.telDaAggiungere ? "telefono" : "", g.diventaCliente ? "diventa cliente" : ""].filter(Boolean).join(", ");
  const cambiano = a.trovati.filter(g => g.cambia);
  /* una spunta sola per mettere o togliere tutte le spunte della sezione */
  const tutti = nome => `<label class="check tutti"><input type="checkbox" data-tutti="${nome}" checked> Seleziona tutti</label>`;
  return `${st.ordiniDopoMappa ? `<p class="avviso" style="margin:0 0 8px">Mappa importata. Ora gli ordini e i clienti.</p>` : ""}<h2>Dal sito Amway</h2>
    <p class="small">${[a.ordini ? plur(a.ordini, "ordine", "ordini") : "", a.clienti ? plur(a.clienti, "cliente", "clienti") : ""].filter(Boolean).join(" e ")} nei file ·
      <b>${plur(a.ordiniNuovi, "ordine nuovo", "ordini nuovi")}</b> da aggiungere allo storico.</p>
    <form data-form="importa-ordini" novalidate>
      ${a.trovati.length ? `<div class="imp-sezione"><h3>Già in Growup · ${a.trovati.length}</h3>
        <p class="small">${cambiano.length ? cambiano.map(g => `${esc(g.p.nome)}${g.dalNome ? " <i>(riconosciuto dal nome)</i>" : ""}${cosa(g) ? ` · ${esc(cosa(g))}` : ""}`).join("; ")
          : "Per loro non c'è niente di nuovo."}</p></div>` : ""}
      ${a.nuovi.length ? `<div class="imp-sezione"><h3>Nuovi clienti · ${a.nuovi.length}</h3>
        <p class="small">Hanno ordinato con il tuo link ma non sono in Growup. Togli la spunta a chi non vuoi aggiungere.</p>
        ${tutti("nuovo")}<div class="scelte">${a.nuovi.map(g => scelta("nuovo", g, `${g.ordini.length ? plur(g.ordini.length, "ordine", "ordini") + " · " : ""}l'ultimo il ${dataIt([g.ultimo, ...g.ordini.map(o => o.data)].filter(Boolean).sort().pop())}`)).join("")}</div></div>` : ""}
      ${a.mai.length ? `<div class="imp-sezione"><h3>Mai comprato · ${a.mai.length}</h3>
        <p class="small">Registrati come tuoi clienti ma senza nessun ordine: entrano nella Lista con l'etichetta "Mai comprato". Togli la spunta a chi non vuoi.</p>
        ${tutti("mai")}<div class="scelte">${a.mai.map(g => scelta("mai", g, g.ingresso ? `registrato il ${dataIt(g.ingresso)}` : "")).join("")}</div></div>` : ""}
      <div class="row" style="margin-top:16px"><button type="button" class="btn ghost grow" data-act="chiudi">Annulla</button>
        <button class="btn primary grow"${a.cambi ? "" : " disabled"}>Importa</button></div>
      ${a.cambi ? "" : `<p class="nota">Niente di nuovo: è già tutto in Growup.</p>`}
    </form>`;
}
async function leggiFileOrdini(files){
  if(!files || !files.length) return;
  const tutto = { ordini:[], anagrafica:[] };
  for(const file of files){
    let r;
    try{ r = /\.xlsx?$/i.test(file.name) ? { errore:"Questo è il file Excel: sul sito Amway scegli il formato CSV." } : leggiFileAmway(await file.text()); }
    catch(e){ r = { errore:"Non riesco a leggere il file." }; }
    if(r.errore){ st.errore = files.length > 1 ? `${file.name}: ${r.errore}` : r.errore; st.impOrdini = null; render(); return; }
    tutto.ordini.push(...r.ordini); tutto.anagrafica.push(...r.anagrafica);
  }
  st.errore = ""; st.impOrdini = analizzaAmway(tutto); render();
}

Object.assign(MODULI, {
  async "importa-ordini"(f){
    const a = st.impOrdini, spunte = n => new Set([...f.querySelectorAll(`input[name=${n}]:checked`)].map(i => i.value));
    const sNuovi = spunte("nuovo"), sMai = spunte("mai");
    const passo = (id, data) => ({ id:uuid(), persona_id:id, tipo:"chiusura", esito:"cliente", importato:true, data, come:"Sito Amway" });
    st.occupato = true;
    try{
      /* i nuovi: chi ha comprato è cliente dal primo ordine (passo importato: non conta oggi), chi non ha mai comprato va in Lista */
      const nuovi = a.nuovi.filter(g => sNuovi.has(g.codice)).concat(a.mai.filter(g => sMai.has(g.codice))).map(g => Object.assign(g, { id:uuid() }));
      for(let i = 0; i < nuovi.length; i += 200)
        await api.nuovePersone(nuovi.slice(i, i + 200).map(g => ({ id:g.id, nome:g.nome.slice(0, 80), contatto:g.tel || null, codice_cliente:g.codice, origine:"Sito Amway" })));
      const passi = nuovi.filter(g => g.compra).map(g => passo(g.id, g.ingresso && g.ingresso < g.primo ? g.ingresso : g.primo));
      for(const g of a.trovati){
        const campi = {};
        if(!g.p.codice_cliente) campi.codice_cliente = g.codice;
        if(g.telDaAggiungere) campi.contatto = g.telDaAggiungere;
        if(g.p.nascosta_io && (g.daImportare.length || g.ultimoDaAggiungere)) campi.nascosta_io = false;   // ordini nuovi: di nuovo su Io
        if(Object.keys(campi).length) await api.modificaPersona(g.p.id, campi);
        /* era nella lista ma non ancora cliente: ha comprato, quindi è cliente (dalla data del primo ordine) */
        if(g.diventaCliente) passi.push(passo(g.p.id, g.primo));
      }
      if(passi.length) await api.nuoviPassi(passi);
      /* gli ordini: quello che era l'ultimo ordine dell'elenco clienti (senza numero) prende numero, valore e VP */
      const ordini = [];
      let uniti = 0;
      for(const g of a.trovati.concat(nuovi)){
        const pid = g.p ? g.p.id : g.id;
        const senzaNumero = g.p ? ordiniDi(pid).filter(o => !o.numero_amway && o.modo === "sito") : [];
        for(const o of g.daImportare){
          const x = senzaNumero.find(y => y.data === o.data);
          if(x){ senzaNumero.splice(senzaNumero.indexOf(x), 1);
            await api.aggiornaOrdine(x.id, { numero_amway:o.numero, importo:o.vv || null, vp:o.vp || null }); uniti++; }
          else ordini.push({ id:uuid(), persona_id:pid, data:o.data, modo:"sito", numero_amway:o.numero, importo:o.vv || null, vp:o.vp || null });
        }
        if(g.ultimoDaAggiungere) ordini.push({ id:uuid(), persona_id:pid, data:g.ultimoDaAggiungere, modo:"sito" });
      }
      for(let i = 0; i < ordini.length; i += 200) await api.nuoviOrdini(ordini.slice(i, i + 200));
      st.occupato = false; st.impOrdini = null;
      await caricaPersone(); await caricaClienti();
      st.sheet = null; st.vista = "persone"; st.sezPersone = "clienti"; st.personaId = null; render();
      const nc = nuovi.filter(g => g.compra).length, nm = nuovi.length - nc;
      toast([plur(ordini.length + uniti, "ordine", "ordini") + " nello storico", nc ? plur(nc, "nuovo cliente", "nuovi clienti") : "",
        nm ? `${nm} in Lista (mai comprato)` : ""].filter(Boolean).join(", "));
    }catch(e){ st.occupato = false; mostraErroreForm(f, messaggio(e)); }
  }
});
document.addEventListener("change", e => {
  const t = e.target;
  if(!t || !t.form) return;
  if(t.dataset.tutti) t.form.querySelectorAll(`input[name=${t.dataset.tutti}]`).forEach(i => { i.checked = t.checked; });
  else if(t.name === "nuovo" || t.name === "mai"){
    const tutte = [...t.form.querySelectorAll(`input[name=${t.name}]`)], capo = t.form.querySelector(`input[data-tutti=${t.name}]`);
    if(capo){ const n = tutte.filter(i => i.checked).length; capo.checked = n === tutte.length; capo.indeterminate = n > 0 && n < tutte.length; }
  }
});
document.addEventListener("change", e => { if(e.target && e.target.id === "file-ordini") smistaFileAmway(e.target.files ? [...e.target.files] : []); });

/* ---- 11f. Il listino Amway (solo admin): prodotti a mano e aggiornamento dal PDF ----
   Il PDF si legge sul telefono con pdf.js (caricato solo qui, con il controllo d'integrità); non si salva.
   I prodotti usciti dal listino non si cancellano: diventano "non nel listino" e spariscono dalla ricerca. */
const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/";
const PDFJS_FILE = [["pdf.min.js", "sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e"],
                    ["pdf.worker.min.js", "sha384-SnzOobpRMLXZ52iJvZm/C0fYw0OQemTXzTjIsdsfMcrCtCEe9qgzxTd3RSklO5x2"]];
function caricaScript(src, integrity){
  return new Promise((ok, ko) => { const el = document.createElement("script");
    el.src = src; el.integrity = integrity; el.crossOrigin = "anonymous"; el.onload = ok; el.onerror = () => ko(new Error("pdfjs"));
    document.head.appendChild(el); });
}
/* il lettore e il suo "worker" nella pagina stessa (niente worker separati: la sicurezza della pagina non li permette) */
async function caricaPdfJs(){
  if(window.pdfjsLib && window.pdfjsWorker) return;
  for(const [f, h] of PDFJS_FILE) await caricaScript(PDFJS + f, h);
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js";
}
const PREZZI_LISTINO = ["prezzo_cliente", "prezzo_partner", "vp"];
function rigaListino(p, attivo){ return { codice:p.codice, nome:String(p.nome).slice(0, 200), formato:(p.formato || "").slice(0, 80) || null,
  categoria:(p.categoria || "").slice(0, 120) || null, prezzo_cliente:numOrNull(p.prezzo_cliente), prezzo_partner:numOrNull(p.prezzo_partner),
  vp:numOrNull(p.vp), attivo }; }
function confrontaListino(prodotti){
  const ora = new Map(st.listino.map(x => [x.codice, x])), nelPdf = new Set(prodotti.map(p => p.codice));
  const nuovi = prodotti.filter(p => !ora.has(p.codice) || ora.get(p.codice).attivo === false);
  const cambiati = prodotti.filter(p => { const x = ora.get(p.codice);
    return x && x.attivo !== false && PREZZI_LISTINO.some(k => numOrNull(x[k]) !== numOrNull(p[k])); });
  const usciti = st.listino.filter(x => x.attivo !== false && !nelPdf.has(x.codice));
  return { prodotti, nuovi, cambiati, usciti };
}
async function leggiPdfListino(file){
  if(!file) return;
  st.errore = ""; st.occupato = true; render();
  try{
    await caricaPdfJs();
    const doc = await window.pdfjsLib.getDocument({ data:new Uint8Array(await file.arrayBuffer()), isEvalSupported:false, disableFontFace:true }).promise;
    const righe = [];
    for(let i = 1; i <= doc.numPages; i++){ const c = await (await doc.getPage(i)).getTextContent(); righe.push(...righePdf(c.items)); }
    const r = leggiListino(righe);
    if(r.prodotti.length < 50) throw new Error("non_listino");
    st.impListino = Object.assign(confrontaListino(r.prodotti), { dubbi:r.dubbi });
    st.sheet = "listino-pdf";
  }catch(e){
    st.errore = /pdfjs/.test(e.message) ? "Non riesco a caricare il lettore dei PDF: controlla la connessione e riprova."
      : e.message === "non_listino" ? "Questo PDF non sembra il listino prezzi Amway (non trovo le righe dei prodotti)."
      : "Non riesco a leggere il PDF.";
  }
  st.occupato = false; render();
}
function rigaProdotto(x){
  return `<li><button type="button" class="persona" data-act="prodotto-apri" data-codice="${esc(x.codice)}">
    <span class="grow"><b>${esc(x.nome)}</b>${x.attivo === false ? ` <span class="pill mini">non nel listino</span>` : ""}<br>
      <span class="small">${esc([x.codice, x.formato, x.prezzo_cliente != null ? prezzo(x.prezzo_cliente) : "", x.prezzo_partner != null ? "Partner " + prezzo(x.prezzo_partner) : "",
        x.vp != null ? num2(x.vp) + " VP" : ""].filter(Boolean).join(" · "))}</span></span><b>›</b></button></li>`;
}
function risultatiListino(q){
  const t = senzaAccenti(q || "");
  if(t.length < 2) return "";
  const l = st.listino.filter(x => senzaAccenti(x.codice + " " + x.nome).includes(t)).slice(0, 12);
  return l.length ? l.map(rigaProdotto).join("") : `<li class="muted small">Nessun prodotto così.</li>`;
}
function vSheetListino(s){
  if(s === "listino") return `<h2>Listino Amway</h2>
    <p class="small">${plur(st.listino.filter(x => x.attivo !== false).length, "prodotto", "prodotti")} nel listino. Lo vedono solo gli utenti dell'app;
      lo cambi solo tu. Prezzo al cliente, prezzo Partner e VP finiscono negli ordini dei clienti.</p>
    <input type="search" id="cerca-listino" class="cerca" placeholder="Cerca un prodotto (nome o codice)…" autocomplete="off" value="${esc(st.cercaListino || "")}">
    <ul class="persone" id="risultati-listino">${risultatiListino(st.cercaListino)}</ul>
    <div class="row" style="gap:8px;margin-top:12px">
      <button class="btn grow" data-act="prodotto-nuovo">+ Prodotto</button>
      <label class="btn primary grow">${st.occupato ? "Leggo il PDF…" : "Aggiorna dal PDF"}<input type="file" id="file-listino" accept=".pdf,application/pdf" hidden></label></div>
    <p class="nota">Aggiorna dal PDF: scegli il "Listino prezzi per l'incaricato" di Amway. Il file resta sul telefono; prima di cambiare
      qualcosa vedi cosa cambia.</p>
    ${st.errore ? `<p class="errore">${esc(st.errore)}</p>` : ""}
    <button class="btn ghost wide" style="margin-top:8px" data-act="chiudi">Chiudi</button>`;
  if(s === "prodotto"){
    const x = st.listino.find(y => y.codice === st.prodottoCodice) || {}, nuovo = !x.codice;
    const campo = (n, t, v, extra) => `<label class="field grow"><span>${t}</span><input name="${n}" value="${esc(v == null ? "" : String(v).replace(".", ","))}" ${extra || ""}></label>`;
    return `<h2>${nuovo ? "Un prodotto nuovo" : "Il prodotto"}</h2>
    <form data-form="prodotto" novalidate>
      ${campo("codice", "Codice Amway", x.codice, `inputmode="numeric" maxlength="10"${nuovo ? "" : " readonly"}`)}
      ${campo("nome", "Nome", x.nome, `maxlength="200"`)}
      <div class="row" style="gap:8px">${campo("formato", "Contenuto", x.formato, `maxlength="80" placeholder="es. 140 g"`)}
        ${campo("categoria", "Categoria", x.categoria, `maxlength="120"`)}</div>
      <div class="row" style="gap:8px">${campo("prezzo_cliente", "Prezzo al cliente €", x.prezzo_cliente, `inputmode="decimal"`)}
        ${campo("prezzo_partner", "Prezzo Partner €", x.prezzo_partner, `inputmode="decimal"`)}
        ${campo("vp", "VP", x.vp, `inputmode="decimal"`)}</div>
      <label class="check"><input type="checkbox" name="attivo"${x.attivo === false ? "" : " checked"}> Nel listino (si trova negli ordini)</label>
      <div class="row" style="margin-top:16px"><button type="button" class="btn ghost grow" data-act="listino">Indietro</button><button class="btn primary grow">Salva</button></div>
    </form>`;
  }
  if(s === "listino-pdf" && st.impListino){
    const a = st.impListino, quanti = (l, n) => l.slice(0, n).map(p => esc(p.nome)).join(", ") + (l.length > n ? ` e altri ${l.length - n}` : "");
    const prima = new Map(st.listino.map(x => [x.codice, x]));
    return `<h2>Listino dal PDF</h2>
    <p class="small">${plur(a.prodotti.length, "prodotto letto", "prodotti letti")} nel PDF.</p>
    <form data-form="listino-pdf" novalidate>
      <div class="imp-sezione"><h3>Nuovi · ${a.nuovi.length}</h3>${a.nuovi.length ? `<p class="small">${quanti(a.nuovi, 12)}</p>` : ""}</div>
      <div class="imp-sezione"><h3>Prezzi cambiati · ${a.cambiati.length}</h3>${a.cambiati.length ? `<ul class="oggi">${a.cambiati.slice(0, 8).map(p => { const x = prima.get(p.codice);
        return `<li><span class="grow">${esc(p.nome)}<br><span class="small">${PREZZI_LISTINO.filter(k => numOrNull(x[k]) !== numOrNull(p[k])).map(k =>
          `${{ prezzo_cliente:"cliente", prezzo_partner:"Partner", vp:"VP" }[k]} ${x[k] != null ? (k === "vp" ? num2(x[k]) : prezzo(x[k])) : "–"} → ${p[k] != null ? (k === "vp" ? num2(p[k]) : prezzo(p[k])) : "–"}`).join(" · ")}</span></span></li>`; }).join("")}</ul>
        ${a.cambiati.length > 8 ? `<p class="small">e altri ${a.cambiati.length - 8}</p>` : ""}` : ""}</div>
      ${a.usciti.length ? `<div class="imp-sezione"><h3>Non più nel listino · ${a.usciti.length}</h3>
        <p class="small">Spariscono dalla ricerca dei nuovi ordini (restano negli ordini già fatti). Togli la spunta a chi vuoi tenere.</p>
        <div class="scelte">${a.usciti.map(x => `<label><input type="checkbox" name="esce" value="${esc(x.codice)}" checked><span>${esc(x.nome)}<br><span class="small">${esc(x.codice)}</span></span></label>`).join("")}</div></div>` : ""}
      ${a.dubbi.length ? `<p class="nota">${plur(a.dubbi.length, "riga non letta", "righe non lette")} (senza prezzi): controllale nel PDF.</p>` : ""}
      <div class="row" style="margin-top:16px"><button type="button" class="btn ghost grow" data-act="listino">Annulla</button>
        <button class="btn primary grow">Aggiorna il listino</button></div>
    </form>`;
  }
  return "";
}

Object.assign(AZIONI, {
  listino(){ st.errore = ""; st.impListino = null; st.sheet = "listino"; render(); },
  "prodotto-nuovo"(){ st.prodottoCodice = null; st.errore = ""; st.sheet = "prodotto"; render(); },
  "prodotto-apri"(el){ st.prodottoCodice = el.dataset.codice; st.errore = ""; st.sheet = "prodotto"; render(); }
});
Object.assign(MODULI, {
  async prodotto(f){
    const prezzo = n => { const v = f[n].value.trim(); return v ? numIt(v) : null; };
    const x = { codice:f.codice.value.replace(/\D/g, ""), nome:f.nome.value.trim(), formato:f.formato.value.trim(), categoria:f.categoria.value.trim(),
      prezzo_cliente:prezzo("prezzo_cliente"), prezzo_partner:prezzo("prezzo_partner"), vp:prezzo("vp") };
    if(!/^\d{4,10}$/.test(x.codice)){ mostraErroreForm(f, "Il codice Amway è fatto di cifre (es. 121576)."); return; }
    if(!x.nome){ mostraErroreForm(f, "Scrivi il nome del prodotto."); return; }
    if(PREZZI_LISTINO.some(k => x[k] != null && !(x[k] >= 0))){ mostraErroreForm(f, "Controlla i prezzi e i VP (es. 87,66)."); return; }
    if(!st.prodottoCodice && st.listino.some(y => y.codice === x.codice)){ mostraErroreForm(f, "Questo codice è già nel listino: cercalo e modificalo."); return; }
    try{
      await api.salvaListino([rigaListino(x, f.attivo.checked)]);
      await caricaListino(); st.cercaListino = x.nome; st.sheet = "listino"; render(); toast("Prodotto salvato");
    }catch(e){ mostraErroreForm(f, messaggio(e)); }
  },
  async "listino-pdf"(f){
    const a = st.impListino, escono = new Set([...f.querySelectorAll("input[name=esce]:checked")].map(i => i.value));
    const righe = a.prodotti.map(p => rigaListino(p, true)).concat(a.usciti.filter(x => escono.has(x.codice)).map(x => rigaListino(x, false)));
    st.occupato = true;
    try{
      for(let i = 0; i < righe.length; i += 500) await api.salvaListino(righe.slice(i, i + 500));
      st.occupato = false; st.impListino = null;
      await caricaListino(); st.sheet = "listino"; render();
      toast(`Listino aggiornato: ${plur(a.nuovi.length, "nuovo", "nuovi")}, ${plur(a.cambiati.length, "prezzo cambiato", "prezzi cambiati")}`);
    }catch(e){ st.occupato = false; mostraErroreForm(f, messaggio(e)); }
  }
});
document.addEventListener("change", e => { if(e.target && e.target.id === "file-listino") leggiPdfListino(e.target.files && e.target.files[0]); });
document.addEventListener("input", e => {
  if(e.target && e.target.id === "cerca-listino"){ st.cercaListino = e.target.value; const u = document.getElementById("risultati-listino"); if(u) u.innerHTML = risultatiListino(e.target.value); }
});

/* ---- 11h. I miei ordini (034): la bozza d'ordine e lo storico, solo miei ----
   La bozza resta nel database (una sola alla volta) finché non la confermo: allora il totale VP diventa un ordine del
   mese, che vedo solo io finché non arriva il report Amway. Dallo storico si rifà un ordine o lo si toglie. */
async function caricaOrdiniMiei(){
  try{
    const [ordini, righe] = await Promise.all([api.ordiniMiei(), api.righeMie()]);
    st.mieiOrdini = ordini || []; st.mieRighe = righe || [];
  }catch(e){ st.mieiOrdini = st.mieiOrdini || []; st.mieRighe = st.mieRighe || []; }
}
function bozzaMia(){ return (st.mieiOrdini || []).find(o => o.stato === "bozza") || null; }
function righeMie(oid){ return (st.mieRighe || []).filter(r => r.ordine_id === oid).sort((a, b) => a.nome < b.nome ? -1 : 1); }
function storicoMio(){ return (st.mieiOrdini || []).filter(o => o.stato === "confermato")
  .sort((a, b) => a.data < b.data ? 1 : a.data > b.data ? -1 : a.confermato_il < b.confermato_il ? 1 : -1); }
function totaliMiei(righe){
  const t = { vp:0, partner:0, pubblico:0 };
  for(const r of righe){ const q = Number(r.quantita) || 0;
    t.vp += (Number(r.vp) || 0) * q; t.partner += (Number(r.prezzo_partner) || 0) * q; t.pubblico += (Number(r.prezzo_cliente) || 0) * q; }
  return t;
}
function testoPrezzi(x){ return `${num2(x.vp)} VP · Partner ${prezzo(x.partner)} · Pubblico ${prezzo(x.pubblico)}`; }
function testoTotaliMiei(t){ return `<b>${num2(t.vp)}</b> VP · Partner <b>${prezzo(t.partner)}</b> · Pubblico <b>${prezzo(t.pubblico)}</b>`; }
function prezziRiga(r){ return { vp:Number(r.vp) || 0, partner:Number(r.prezzo_partner) || 0, pubblico:Number(r.prezzo_cliente) || 0 }; }
function prodotti(n){ return plur(n, "prodotto", "prodotti"); }

/* La bozza ordine, nel foglio «Ordini» (ottimizzazione 1: non più nella pagina Io) */
function vBozzaOrdine(){
  const b = bozzaMia(), righe = b ? righeMie(b.id) : [];
  return `<div id="bozza-ordine">
    <div class="spread"><div><h2>Bozza ordine</h2>
      <p class="small" style="margin:2px 0 0">${righe.length ? prodotti(righe.length) : "Vuota"}</p></div>
      ${righe.length ? `<span class="pill">Salvata</span>` : ""}</div>
    <input type="search" id="cerca-mio" class="cerca" style="margin-top:10px" placeholder="Cerca un prodotto (nome o codice)…" autocomplete="off" value="${esc(st.cercaMio || "")}">
    <ul class="risultati-prodotto" id="risultati-mio">${risultatiMio(st.cercaMio)}</ul>
    ${righe.length ? `<ul class="righe-ordine" style="margin-top:6px">${righe.map(r => `<li>
      <span class="grow"><b>${esc(r.nome)}</b><br><span class="small">${testoPrezzi(prezziRiga(r))}</span></span>
      <span class="qta"><button type="button" class="btn small ghost" data-act="mio-meno" data-id="${esc(r.id)}" aria-label="Uno in meno">−</button><b>${r.quantita}</b>
        <button type="button" class="btn small ghost" data-act="mio-piu" data-id="${esc(r.id)}" aria-label="Uno in più">+</button></span></li>`).join("")}</ul>
    <p class="tot-mio" style="margin:8px 0 0">${testoTotaliMiei(totaliMiei(righe))}</p>
    <div class="row" style="margin-top:10px;gap:8px"><button class="btn small grow" data-act="mio-svuota">Svuota</button>
      <button class="btn small primary grow" data-act="mio-conferma">Conferma ordine</button></div>` : ""}
    <p class="small" style="margin:8px 0 0">La bozza la vedi solo tu.</p>
    <button class="btn ghost wide" style="margin-top:12px" data-act="ordini">Indietro</button>
  </div>`;
}
function risultatiMio(q){
  const t = senzaAccenti(q || "");
  if(t.length < 2) return "";
  const cat = st.listino.filter(r => r.attivo !== false && senzaAccenti(r.codice + " " + r.nome).includes(t)).slice(0, 8);
  if(!cat.length) return `<li class="small muted">Nessun prodotto del listino con «${esc(q.trim())}».</li>`;
  return cat.map(r => `<li><button type="button" class="persona" data-act="mio-aggiungi" data-codice="${esc(r.codice)}">
      <span class="grow">${esc(r.nome)}${r.formato ? ` (${esc(r.formato)})` : ""}<br><span class="small">${esc(r.codice)} · ${testoPrezzi({ vp:Number(r.vp) || 0,
        partner:Number(r.prezzo_partner) || 0, pubblico:Number(r.prezzo_cliente) || 0 })}</span></span><b>+</b></button></li>`).join("");
}
function vMieiOrdini(){
  const lista = storicoMio();
  const tutti = st.mieiTutti || lista.length <= 5, vedi = tutti ? lista : lista.slice(0, 5);
  const indietro = `<button class="btn ghost wide" style="margin-top:12px" data-act="ordini">Indietro</button>`;
  if(!lista.length) return `<div id="miei-ordini"><h2>I miei ordini</h2>
    <p class="muted">Ancora nessun ordine confermato dalla Bozza ordine.</p>${indietro}</div>`;
  return `<div id="miei-ordini">
    <h2>I miei ordini</h2>
    <ul class="righe-ordine" style="margin-top:6px">${vedi.map(o => { const righe = righeMie(o.id), t = totaliMiei(righe), aperto = st.mioAperto === o.id;
      return `<li style="flex-wrap:wrap">
      <button type="button" class="apri-mio" data-act="mio-apri" data-id="${esc(o.id)}" aria-expanded="${aperto}">
        <b>${esc(dataIt(o.data))}</b> · <b class="num">${num2(o.vp != null ? o.vp : t.vp)} VP</b><br>
        <span class="small">${prodotti(righe.length)} · Partner ${prezzo(t.partner)} · Pubblico ${prezzo(t.pubblico)}</span></button>
      <button type="button" class="btn small ghost" data-act="mio-rifai" data-id="${esc(o.id)}">Rifai</button>
      <button type="button" class="btn small ghost" data-act="mio-togli" data-id="${esc(o.id)}" aria-label="Togli l'ordine del ${esc(dataIt(o.data))}">×</button>
      ${aperto ? `<ul class="small" style="flex-basis:100%;margin:4px 0 0;padding-left:18px">${righe.map(r =>
        `<li style="display:list-item;border:0;padding:2px 0">${r.quantita} × ${esc(r.nome)} · ${testoPrezzi(prezziRiga(r))}</li>`).join("")}</ul>` : ""}
    </li>`; }).join("")}</ul>
    ${tutti ? "" : `<button class="btn small ghost wide" style="margin-top:8px" data-act="miei-tutti">Tutti gli ordini (${lista.length})</button>`}
    ${indietro}
  </div>`;
}
/* Il foglio «Ordini» (+ Ordine nella barra in basso): un solo posto per ordine veloce, bozza, storico e totale del mese */
function vOrdini(){
  const m = meseDi(oggi()), b = bozzaMia(), nb = b ? righeMie(b.id).length : 0, lista = storicoMio();
  const scelta = (act, titolo, sotto) => `<button class="scelta-ordini" data-act="${act}"><span class="grow"><b>${titolo}</b>
    <span class="small">${sotto}</span></span><span class="fr" aria-hidden="true">›</span></button>`;
  return `<h2>Ordini</h2>
    <p class="small" style="margin:2px 0 0">${nomeMese(m).replace(/^./, x => x.toUpperCase())} · ${num(vpMese(m))} VP nel mese</p>
    <div class="scelte-ordini">
      ${scelta("ordine", "Ordine veloce", "Scrivi solo i VP")}
      ${scelta("apri-bozza", "Bozza ordine", nb ? `${prodotti(nb)} · salvata` : "Prepara l'ordine con i prodotti del listino")}
      ${scelta("apri-miei", "I miei ordini", lista.length ? `${plur(lista.length, "ordine", "ordini")} · l'ultimo il ${dataIt(lista[0].data)}` : "Ancora nessuno")}
      ${scelta("totale-mese", "Aggiorna il totale del mese", "La cifra dall'ufficio virtuale Amway")}
      <label class="scelta-ordini"><span class="grow"><b>Importa da Amway</b>
        <span class="small">Mappa, ordini e clienti: i file CSV scaricati dal sito Amway</span></span><span class="fr" aria-hidden="true">›</span>
        <input type="file" class="file-amway" accept=".csv,text/csv,text/comma-separated-values" multiple hidden></label>
    </div>
    ${precedenteAperto() ? `<p class="small" style="margin:10px 0 0">Fino al ${giornoChiusura()} puoi ancora correggere ${nomeMese(mesePrecedente()).split(" ")[0]}.</p>` : ""}
    <button class="btn ghost wide" style="margin-top:12px" data-act="chiudi">Chiudi</button>`;
}
function vSheetMiei(s){
  if(s === "importa-amway") return vImportaAmway();
  if(s === "ordini") return vOrdini();
  if(s === "bozza") return vBozzaOrdine();
  if(s === "miei") return vMieiOrdini();
  if(s === "conferma-mio"){
    const b = bozzaMia(); if(!b) return "";
    const righe = righeMie(b.id), t = totaliMiei(righe), m = meseDi(st.dataMio || oggi());
    return `<h2>Confermi l'ordine?</h2>
    <p class="small">${prodotti(righe.length)} · ${testoTotaliMiei(t)}</p>
    <form data-form="conferma-mio" novalidate>
      <label class="field"><span>Data dell'ordine</span><input type="date" name="data" min="${primaDataAperta()}" max="${oggi()}" value="${esc(st.dataMio || oggi())}"></label>
      <p class="small" id="testo-conferma-mio">I ${num2(t.vp)} VP vanno nel tuo mese di ${nomeMese(m).split(" ")[0]}. Li vedi solo tu finché non arriva il report Amway.</p>
      ${st.errore ? `<p class="errore">${esc(st.errore)}</p>` : ""}
      <div class="row" style="margin-top:16px"><button type="button" class="btn ghost grow" data-act="apri-bozza">Indietro</button><button class="btn primary grow">Conferma</button></div>
    </form>`;
  }
  if(s === "togli-mio"){
    const o = (st.mieiOrdini || []).find(x => x.id === st.mioDaTogliere); if(!o) return "";
    const righe = righeMie(o.id), vp = o.vp != null ? Number(o.vp) : totaliMiei(righe).vp;
    return `<h2>Togli l'ordine del ${esc(dataIt(o.data))}?</h2>
    <p class="small">${prodotti(righe.length)} · ${num2(vp)} VP.${o.attivita_id ? ` I ${num2(vp)} VP escono dal tuo mese di ${nomeMese(meseDi(o.data)).split(" ")[0]}.` : ""}</p>
    ${st.errore ? `<p class="errore">${esc(st.errore)}</p>` : ""}
    <div class="row" style="margin-top:16px"><button type="button" class="btn ghost grow" data-act="apri-miei">Indietro</button>
      <button class="btn primary grow" data-act="mio-togli-ok">Togli</button></div>`;
  }
  return "";
}
/* aggiungo un prodotto (o ne aumento la quantità) nella bozza, creandola se non c'è */
async function aggiungiMio(c, quantita){
  let b = bozzaMia();
  if(!b){ const id = uuid(); await api.nuovaBozzaMia(id); b = { id, stato:"bozza", data:oggi(), creato_il:new Date().toISOString() }; st.mieiOrdini.push(b); }
  const r = righeMie(b.id).find(x => x.codice === c.codice);
  if(r){ const qn = Math.min(99, r.quantita + quantita); await api.quantitaMia(r.id, qn); r.quantita = qn; return; }
  const riga = { id:uuid(), ordine_id:b.id, codice:c.codice, nome:String(c.nome).slice(0, 160), quantita:Math.min(99, quantita),
    vp:numOrNull(c.vp), prezzo_partner:numOrNull(c.prezzo_partner), prezzo_cliente:numOrNull(c.prezzo_cliente) };
  await api.nuovaRigaMia(riga);
  st.mieRighe.push(riga);
}
Object.assign(AZIONI, {
  ordini(){ st.errore = null; st.sheet = "ordini"; render(); },
  "apri-bozza"(){ st.errore = null; st.sheet = "bozza"; render(); },
  "apri-miei"(){ st.errore = null; st.sheet = "miei"; render(); },
  "apri-tappa"(){ st.tappaAperta = !st.tappaAperta; render(); },
  "apri-diario"(){ st.diarioAperto = !st.diarioAperto; render(); },
  async "mio-aggiungi"(el){
    const r = st.listino.find(x => x.codice === el.dataset.codice);
    if(!r) return;
    try{ await aggiungiMio({ codice:r.codice, nome:r.nome + (r.formato ? ` (${r.formato})` : ""), vp:r.vp, prezzo_partner:r.prezzo_partner,
      prezzo_cliente:r.prezzo_cliente }, 1); st.cercaMio = ""; render(); }
    catch(e){ toast(messaggio(e)); }
  },
  async "mio-piu"(el){ const r = st.mieRighe.find(x => x.id === el.dataset.id); if(!r || r.quantita >= 99) return;
    try{ await api.quantitaMia(r.id, r.quantita + 1); r.quantita++; render(); }catch(e){ toast(messaggio(e)); } },
  async "mio-meno"(el){ const r = st.mieRighe.find(x => x.id === el.dataset.id); if(!r) return;
    try{
      if(r.quantita > 1){ await api.quantitaMia(r.id, r.quantita - 1); r.quantita--; }
      else { await api.togliRigaMia(r.id); st.mieRighe = st.mieRighe.filter(x => x.id !== r.id); }
      render();
    }catch(e){ toast(messaggio(e)); } },
  async "mio-svuota"(){ const b = bozzaMia(); if(!b) return;
    try{ await api.togliOrdineMio(b.id); st.mieiOrdini = st.mieiOrdini.filter(x => x.id !== b.id); st.mieRighe = st.mieRighe.filter(x => x.ordine_id !== b.id);
      render(); toast("Bozza svuotata"); }catch(e){ toast(messaggio(e)); } },
  "mio-conferma"(){ st.dataMio = oggi(); st.errore = null; st.sheet = "conferma-mio"; render(); },
  "mio-apri"(el){ st.mioAperto = st.mioAperto === el.dataset.id ? null : el.dataset.id; render(); },
  "miei-tutti"(){ st.mieiTutti = true; render(); },
  async "mio-rifai"(el){
    try{ for(const r of righeMie(el.dataset.id)) await aggiungiMio(r, r.quantita); render(); toast("Prodotti copiati nella bozza ordine"); }
    catch(e){ await caricaOrdiniMiei(); render(); toast(messaggio(e)); }
  },
  "mio-togli"(el){ st.mioDaTogliere = el.dataset.id; st.errore = null; st.sheet = "togli-mio"; render(); },
  async "mio-togli-ok"(){
    const o = st.mieiOrdini.find(x => x.id === st.mioDaTogliere); if(!o) return;
    try{
      /* prima i VP dal mese (se il mese è chiuso si ferma qui), poi l'ordine con i suoi prodotti */
      if(o.attivita_id){ await api.deleteActivity(o.attivita_id); st.att = st.att.filter(a => a.id !== o.attivita_id); }
      await api.togliOrdineMio(o.id);
      st.mieiOrdini = st.mieiOrdini.filter(x => x.id !== o.id); st.mieRighe = st.mieRighe.filter(x => x.ordine_id !== o.id);
      st.sheet = "miei"; render(); toast("Ordine tolto");
    }catch(e){ st.errore = messaggio(e); render(); }
  }
});
Object.assign(MODULI, {
  async "conferma-mio"(f){
    const b = bozzaMia(); if(!b) return;
    const data = f.data.value || oggi();
    if(data > oggi()){ mostraErroreForm(f, MESSAGGI_ERRORE.data_non_valida); return; }
    if(data < primaDataAperta()){ mostraErroreForm(f, MESSAGGI_ERRORE.mese_chiuso); return; }
    try{
      const o = await api.confermaOrdine(b.id, data);
      Object.assign(b, o);
      st.att = await api.activities(st.profilo.id, [settimana(), primoDelMese()].sort()[0]) || st.att;
      st.sheet = "miei"; render(); toast(`Ordine confermato: ${num2(o.vp)} VP nel mese`);
    }catch(e){ mostraErroreForm(f, messaggio(e)); }
  }
});
document.addEventListener("input", e => {
  const t = e.target;
  if(t && t.id === "cerca-mio"){ st.cercaMio = t.value; const u = document.getElementById("risultati-mio"); if(u) u.innerHTML = risultatiMio(t.value); }
  if(t && t.name === "data" && t.closest && t.closest('[data-form="conferma-mio"]')){
    st.dataMio = t.value; const b = bozzaMia(), p = document.getElementById("testo-conferma-mio");
    if(b && p && t.value) p.textContent = `I ${num2(totaliMiei(righeMie(b.id)).vp)} VP vanno nel tuo mese di ${nomeMese(meseDi(t.value)).split(" ")[0]}. Li vedi solo tu finché non arriva il report Amway.`;
  }
});

/* ---- 11i. La Guida per l'azione (035): il piano dall'obiettivo, la tabella «Stabilità» di Cum Laude 21, i passi
   della tappa e le abitudini. Sta in «Guida», in cima a Io: la pagina di tutti i giorni resta senza consigli.
   I numeri vengono da quello che il partner compila nell'app; obiettivi delle abitudini e spunte sono solo suoi. */
const LIVELLI_CL21 = [3, 6, 9, 12, 15, 18, 21];
const STABILITA_CL21 = [
  { k:"nuovi_gruppo", nome:"Nuovi nel gruppo del mese", soglie:[1, 3, 5, 8, 10, 15, 20] },
  { k:"oltre_200", nome:"Codici oltre 200 VP", soglie:[1, 3, 5, 10, 17, 30, 42] },
  { k:"app_cl21", nome:"Codici nell'app CumLaude21", soglie:[1, 2, 3, 7, 12, 21, 30], scritto:true },
  { k:"training_day", nome:"Codici al Training Day", soglie:[1, 3, 5, 10, 17, 30, 42], scritto:true },
  { k:"convention", nome:"Codici alla Convention", soglie:[1, 2, 3, 7, 12, 21, 30], scritto:true }];
/* i rapporti di base (Stefano): 1 piano ogni 2-3 contatti, 1 sì ogni 5 piani; con 10 piani nella Lista si usano i suoi */
const RAPPORTI_BASE = { contatti_per_piano:2.5, piani_per_si:5 };
const ABITUDINI = {
  followup:{ nome:"Follow-up", base:5, spiega:"(risentire chi ha visto il piano, per rispondere alle sue domande e capire se vuole partire)" },
  formazione:{ nome:"Formazione", base:5, spiega:"15 minuti, un audio o 10 pagine di un libro. Eventi e audio consigliati: apri l'app CumLaude21.", giorni:true },
  sponsor:{ nome:"Chiamata con il tuo sponsor", base:1, spiega:"", giorni:true } };
const VAI_GUIDA = { lista:"La mia Lista ›", clienti:"I miei clienti ›", gruppo:"Il mio gruppo ›", obiettivo:"Il mio obiettivo ›" };
/* i passi per ogni tappa (testi di Stefano, tavola «Guida per l'azione» v4) */
const GUIDA_TAPPE = {
  inizio:{ nome:"Inizio", passi:[
    ["Usa i prodotti: scegli con il tuo sponsor quelli che ti servono in casa e fai il primo ordine entro i 30 giorni."],
    ["Scrivi la tua Lista: almeno 50 nomi in 48 ore, senza decidere tu chi potrebbe essere interessato.", "lista"],
    ["Fissa con il tuo sponsor il tuo primo piano entro due settimane e invita 3-5 persone della Lista."],
    ["Vai al prossimo evento: è lì che si capisce dove si può arrivare."]] },
  primi_clienti:{ nome:"Primi clienti", passi:[
    ["Parla dei prodotti che usi a chi ti conosce meglio: 10 persone della Lista questa settimana.", "lista"],
    ["Fai provare un prodotto e risenti la persona dopo 3 giorni per sapere come si è trovata."],
    ["Quando qualcuno compra, segnalo in Clienti: l'app ti ricorda quando il prodotto sta finendo.", "clienti"]] },
  path_to_bronze:{ nome:"Path to Bronze", passi:[
    ["Tieni i tuoi 100 VP con il tuo ordine e quello dei clienti: prepara la Bozza ordine a inizio mese."],
    ["Mostra il piano a 3 persone a settimana: le prime 3 che dicono sì sono le tue 3 linee.", "lista"],
    ["Chi entra fa il suo primo ordine e i suoi primi clienti: sono i 100 VP della sua linea."],
    ["Insegna a ogni nuovo partner a scrivere la sua Lista e fai il suo primo piano insieme a lui."]] },
  foundation:{ nome:"Bronze Foundation", passi:[
    ["Ogni linea cresce con 3-4 persone attive, ognuna con i suoi clienti.", "gruppo"],
    ["Una sera a settimana per linea: un piano o un follow-up insieme al frontale."],
    ["A metà mese guarda «Come arrivarci»: la linea più vicina alla soglia ha la precedenza."],
    ["Non dimenticare di continuare a lavorare i tuoi contatti.", "lista"]] },
  builder:{ nome:"Bronze Builder", passi:[
    ["Aiuta i tuoi frontali a trovare i loro primi 3 frontali: la crescita adesso è in profondità.", "gruppo"],
    ["Una volta a settimana fai il punto con il gruppo, anche online: numeri, riconoscimenti, prossimo evento."],
    ["Porta il gruppo agli eventi: chi ci va resta e cresce."],
    ["Non dimenticare di continuare a lavorare i tuoi contatti.", "lista"]] },
  argento:{ nome:"Argento", passi:[
    ["In ogni linea forte cerca una persona che punti a sua volta al 21%: è il leader di quella linea.", "gruppo"],
    ["Entro il 15 del mese dovresti avere almeno metà dei VP: importa il report ogni lunedì e controlla."],
    ["Ogni partner con almeno 10 clienti: la base di clienti tiene il gruppo nei mesi difficili."],
    ["Sempre anche il tuo lavoro personale: contatti, piani e clienti tuoi.", "lista"]] },
  argento_platino:{ nome:"Da Argento a Platino", passi:[
    ["Ogni mese al 21%: controlla il VP di gruppo settimana per settimana, non a fine mese."],
    ["Fai crescere un frontale verso il suo 21%: con una linea al 21% sotto di te i tuoi mesi diventano più facili.", "gruppo"],
    ["Finché non hai 3 mesi di fila, nessun mese di pausa."],
    ["Sempre anche il tuo lavoro personale: contatti, piani e clienti tuoi.", "lista"]] },
  platino:{ nome:"Da Platino in su", passi:[
    ["Scegli i frontali che possono arrivare al 21% quest'anno: per Smeraldo ne servono 3 per 6 mesi.", "gruppo"],
    ["Con ognuno fai un piano mese per mese, e una chiamata a settimana."],
    ["Il sistema lavora per te: eventi, formazione e riconoscimenti, ogni mese."],
    ["Inizia a lavorare anche altri frontali personali.", "lista"]] } };
function gruppoGuida(chiave){
  if(!chiave) return "platino";
  if(chiave === "primo_ordine") return "inizio";
  if(chiave.startsWith("foundation")) return "foundation";
  if(chiave.startsWith("builder")) return "builder";
  if(chiave === "oro" || chiave === "platino") return "argento_platino";
  return GUIDA_TAPPE[chiave] ? chiave : "platino";
}
async function caricaGuida(){
  st.guida = st.guida || { conteggi:{}, cl21:{}, obiettivi:new Map(), fatti:[] };
  try{
    const [c, n, o, f] = await Promise.all([api.guidaConteggi(primoDelMese()), api.numeriCl21(), api.guidaObiettivi(), api.guidaFatti(piuGiorni(settimana(), -7 * SETTIMANE_INDIETRO))]);
    st.guida = { conteggi:c || {}, cl21:(n || [])[0] || {}, obiettivi:new Map((o || []).map(x => [x.chiave, Number(x.a_settimana)])), fatti:f || [] };
  }catch(e){}
  try{
    const [sg, gg] = await Promise.all([api.seguimi(), api.seguimiGiorni(piuGiorni(oggi(), -30))]);
    st.seguimi = (sg || [])[0] || { attivo:false, condividi:false }; st.seguimiGiorni = gg || [];
  }catch(e){}
}
function obiettivoAbitudine(k){ const v = st.guida.obiettivi.get(k); return v != null ? v : ABITUDINI[k].base; }
function fattoIl(k, g){ return st.guida.fatti.some(x => x.chiave === k && x.giorno === g); }
function settimanaGiorni(spost){ const l = piuGiorni(settimana(), 7 * (spost || 0)); return [0, 1, 2, 3, 4, 5, 6].map(i => piuGiorni(l, i)); }
const SETTIMANE_INDIETRO = 8;   // formazione e sponsor si possono spuntare anche nelle settimane prima (mai nel futuro)
function vSezioniIo(){
  const b = (k, t) => `<button class="btn small${(st.sezIo || "giorno") === k ? " on" : ""}" data-act="sez-io" data-sez="${k}" aria-pressed="${(st.sezIo || "giorno") === k}">${t}</button>`;
  return `<div class="row scelte-rapide sezioni-io" style="gap:6px">${b("giorno", "Il mio giorno")}${b("guida", "Guida")}</div>`;
}
/* i rapporti della mia Lista (contatti → piani → sì partner), o quelli di base finché ci sono meno di 10 piani */
function rapportiLista(){
  const pp = (st.passi || []).filter(x => !x.importato);
  const contatti = pp.filter(x => x.tipo === "contatto").length, piani = pp.filter(x => x.tipo === "piano").length;
  const si = pp.filter(x => x.esito === "partner").length;
  const miei = piani >= 10 && si > 0 && contatti > 0;
  return { contatti, piani, si, miei,
    cpp: miei ? Math.max(1, contatti / piani) : RAPPORTI_BASE.contatti_per_piano,
    pps: miei ? Math.max(1, piani / si) : RAPPORTI_BASE.piani_per_si };
}
function vGuidaPiano(){
  const o = st.obiettivo, t = o ? tappaPerCifra(o.cifra_mese) : null;
  if(!t) return `<div class="card guida-piano"><span class="eyebrow">Il tuo piano</span>
    <p style="margin:6px 0 0">Il piano parte dalla tua cifra: scrivila nella pagina Obiettivo.</p>
    <button class="btn small" style="margin-top:8px" data-act="guida-vai" data-dove="obiettivo">${VAI_GUIDA.obiettivo}</button></div>`;
  const tp = t.tappa, n = numeriMese(meseDi(oggi()));
  let numeri = "";
  if(oltreArgento(tp)){
    const righe = oltrePlatino(tp) ? avanzamentoPY(tp.chiave).righe : requisiti(tp);
    numeri = `<ul class="req">${righe.map(r => `<li class="${r.ok ? "ok" : ""}"><span class="mark">${r.ok ? "✓" : "○"}</span>
      <span class="grow">${esc(r.txt)}</span><span class="num">${esc(r.val)}</span></li>`).join("")}</ul>`;
  } else {
    const min = Number(tp.vp_linea) || soglia(), ok = n.linee.filter(l => l.vp >= min).length;
    const g = Math.max(0, (Number(tp.vp_gruppo) || 0) - n.gruppo), l = Math.max(0, (Number(tp.linee) || 0) - ok);
    const vp = Math.max(0, (Number(tp.vp_personali) || 0) - n.personali);
    numeri = `<div class="numeri-guida">
      <div><b class="num">${num(g)}</b><span>VP di gruppo che mancano</span></div>
      <div><b class="num">${num(l)}</b><span>${l === 1 ? `linea da ${num(min)} VP che manca` : `linee da ${num(min)} VP che mancano`}</span></div>
      <div><b class="num">${num(vp)}</b><span>VP personali che mancano</span></div></div>`;
  }
  const r = rapportiLista(), piani = Math.ceil(r.pps), contatti = Math.ceil(r.pps * r.cpp);
  const fmt = x => num(Math.round(x * 10) / 10);
  return `<div class="card guida-piano">
    <span class="con-aiuto"><span class="eyebrow">Il tuo piano</span>${aiutoBtn("guida-piano")}</span>
    <h2 style="margin-top:2px">Verso ${esc(tp.nome)}</h2>
    ${aiutoTesto("guida-piano", `Qui vedi quanto lavoro serve per arrivare alla tua cifra. Una linea nuova nasce da un sì, e per un sì servono in
      media 5 piani; per un piano, 2-3 contatti. Sono numeri di base. Quando nella tua Lista avrai segnato almeno 10 piani,
      l'app userà i tuoi numeri veri (oggi: ${plur(r.contatti, "contatto", "contatti")}, ${plur(r.piani, "piano", "piani")}, ${plur(r.si, "sì", "sì")}).`)}
    <p class="small" style="margin:2px 0 0">La tua cifra: ${euro(o.cifra_mese)} al mese ${esc(testoTraguardo(o.entro))}</p>
    ${numeri}
    <p class="small" style="margin:10px 0 0"><b>Cosa vuol dire in attività.</b> Una linea nuova parte da un sì. ${r.miei
      ? `Dalla tua Lista: 1 sì ogni ${fmt(r.pps)} piani e 1 piano ogni ${fmt(r.cpp)} contatti.`
      : "Con i numeri di base (1 piano ogni 2-3 contatti, 1 sì ogni 5 piani)."} Per un sì servono circa
      <b>${piani} piani</b> e <b>${contatti} contatti</b>.</p>
  </div>`;
}
function vGuidaStabilita(){
  const n = numeriMese(meseDi(oggi())), pct = Number(n.percentuale) || 0;
  const i = LIVELLI_CL21.reduce((x, l, j) => pct >= l ? j : x, -1), prossimo = Math.min(i + 1, LIVELLI_CL21.length - 1);
  const c = st.guida.conteggi || {}, w = st.guida.cl21 || {};
  const val = r => r.scritto ? w[r.k] : c[r.k];
  const cella = (r, j) => { const v = Number(val(r)) || 0, s = r.soglie[j];
    return v >= s ? `<td class="num ok">${num(s)} ✓</td>` : `<td class="num manca">${num(s)} · −${num(s - v)}</td>`; };
  const tu = r => r.scritto ? `<button class="campo-cl21" data-act="guida-cl21">${val(r) != null ? num(val(r)) : "–"}</button>` : num(Number(val(r)) || 0);
  return `<div class="card guida-stabilita">
    <span class="con-aiuto"><span class="eyebrow">Verifica la tua attività · Stabilità</span>${aiutoBtn("stabilita")}</span>
    ${aiutoTesto("stabilita", `È la tabella «Stabilità» di Cum Laude 21: per ogni livello (3%, 6% … 21%) i numeri da fare ogni mese.
      I tuoi nuovi iscritti sono le persone entrate nell'app con il tuo link questo mese. I nuovi nel gruppo e i codici oltre
      200 VP arrivano dai report che importi (i nuovi si contano dal secondo import). Le ultime tre righe (app CumLaude21,
      Training Day, Convention) le scrivi tu: tocca il numero.`)}
    <p class="small" style="margin:2px 0 0">${i >= 0 ? `Questo mese sei al ${LIVELLI_CL21[i]}%` : "Questo mese non hai ancora una percentuale"}${
      i < LIVELLI_CL21.length - 1 ? `: per una qualifica solida al ${LIVELLI_CL21[prossimo]}% servono` : ": i numeri per una qualifica solida al 21%"}</p>
    <div class="tab-consigli"><table class="stabilita">
      <thead><tr><th></th><th>tu</th>${i >= 0 && i !== prossimo ? `<th>${LIVELLI_CL21[i]}%</th>` : ""}<th>${LIVELLI_CL21[prossimo]}%</th></tr></thead>
      <tbody>
        <tr class="personali"><td><b>I tuoi nuovi iscritti del mese</b><br><span class="small">entrati con il tuo link</span></td>
          <td class="num"><b>${num(Number(c.personali) || 0)}</b></td>${i >= 0 && i !== prossimo ? "<td>–</td>" : ""}<td>–</td></tr>
        ${STABILITA_CL21.map(r => `<tr><td>${esc(r.nome)}</td><td class="num">${tu(r)}</td>${i >= 0 && i !== prossimo
          ? `<td class="num">${num(r.soglie[i])}</td>` : ""}${cella(r, prossimo)}</tr>`).join("")}
      </tbody></table></div>

  </div>`;
}
function vGuidaPassi(){
  const p = percorso(), k = gruppoGuida(p.attuale && p.attuale.chiave), g = GUIDA_TAPPE[k];
  return `<div class="card guida-passi" data-tappa="${esc(k)}">
    <span class="eyebrow">Cosa fare adesso · ${esc(g.nome)}</span>
    <ol class="passi">${g.passi.map(([t, dove]) => `<li>${esc(t)}${dove
      ? `<br><button class="btn link small" data-act="guida-vai" data-dove="${dove}" style="min-height:0;padding:0">${VAI_GUIDA[dove]}</button>` : ""}</li>`).join("")}</ol>
  </div>`;
}
function vGuidaAbitudini(){
  const sp = st.guidaSett || 0, sett = settimanaGiorni(sp), pp = (st.passi || []).filter(x => !x.importato && x.tipo === "followup" && x.data >= settimana());
  const riga = (nome, fatto, obj, spiega, extra, k) => `<div class="abitudine" data-k="${esc(k)}">
      <div class="spread"><span>${esc(nome)}</span><b class="num">${num(fatto)} / ${k === "contatti" || k === "piani"
        ? num(obj) : `<button class="campo-cl21" data-act="guida-obiettivo" data-k="${esc(k)}" aria-label="Il tuo obiettivo">${num(obj)}</button>`}${
        k === "formazione" ? " giorni" : ""}</b></div>
      ${spiega ? `<p class="small" style="margin:2px 0 0">${esc(spiega)}</p>` : ""}${extra || ""}</div>`;
  const giorni = k => `<div class="giorni-guida">${sett.map((g, i) => `<button class="${fattoIl(k, g) ? "si" : ""}" data-act="guida-spunta" data-k="${k}" data-giorno="${g}"
      ${g > oggi() ? "disabled" : ""} aria-pressed="${fattoIl(k, g)}" aria-label="${esc(GIORNI_SETT[(i + 1) % 7])}">${"LMMGVSD"[i]}</button>`).join("")}</div>`;
  const fatti = k => sett.filter(g => fattoIl(k, g)).length;
  return `<div class="card guida-abitudini">
    <div class="spread"><span class="con-aiuto"><span class="eyebrow">Le tue abitudini · ${sp ? `settimana dal ${esc(dataIt(sett[0]))}` : "questa settimana"}</span>${aiutoBtn("abitudini")}</span>
      <span class="row" style="gap:4px">${sp > -SETTIMANE_INDIETRO ? `<button class="btn small ghost" data-act="guida-sett" data-d="-1">‹ Settimana prima</button>` : ""}${
        sp < 0 ? `<button class="btn small ghost" data-act="guida-sett" data-d="1">Dopo ›</button>` : ""}</span></div>
    ${aiutoTesto("abitudini", `Quante volte hai fatto ogni abitudine questa settimana, rispetto al tuo obiettivo. Contatti, piani e follow-up si
      contano da soli da quello che segni nella Lista. Formazione e chiamata con lo sponsor le segni tu toccando il giorno.
      Per cambiare un obiettivo tocca il numero (contatti e piani: «Modifica» in La mia settimana). Meglio un obiettivo
      piccolo che rispetti. Lo vedi solo tu.`)}
    ${sp ? `<p class="small" style="margin:6px 0 0">Contatti, piani e follow-up si vedono nella settimana in corso. Qui puoi spuntare
      formazione e chiamata con lo sponsor dei giorni che ti eri dimenticato.</p>` : `
    ${riga("Contatti nuovi", fattoSettimana("contatto"), st.goal.obiettivo_contatti, "Dalla tua Lista · consigliato 2 al giorno", "", "contatti")}
    ${riga("Piani", fattoSettimana("piano"), st.goal.obiettivo_piani, "Dalla tua Lista · consigliato 3 a settimana", "", "piani")}
    ${riga("Follow-up", pp.length, obiettivoAbitudine("followup"), `${ABITUDINI.followup.spiega} · dalla tua Lista · consigliato 1 al giorno`, "", "followup")}`}
    ${riga("Formazione", fatti("formazione"), obiettivoAbitudine("formazione"), ABITUDINI.formazione.spiega, giorni("formazione"), "formazione")}
    ${riga("Chiamata con il tuo sponsor", fatti("sponsor"), obiettivoAbitudine("sponsor"), "Consigliato 1 a settimana", giorni("sponsor"), "sponsor")}
  </div>`;
}
function vGuida(){ return `${vGuidaPiano()}${vGuidaStabilita()}${vGuidaPassi()}${vGuidaAbitudini()}${vGuidaSeguimi()}`; }
function vSheetGuida(s){
  if(s === "guida-cl21"){ const w = st.guida.cl21 || {};
    const campo = (k, t) => `<label class="field"><span>${t}</span><input name="${k}" type="number" min="0" max="100000" inputmode="numeric" value="${w[k] != null ? w[k] : ""}"></label>`;
    return `<h2>I tuoi numeri Cum Laude 21</h2>
    <p class="small">Quanti codici del tuo gruppo: il numero resta finché non lo cambi.</p>
    <form data-form="guida-cl21" novalidate>
      ${campo("app_cl21", "Codici nell'app CumLaude21")}${campo("training_day", "Codici all'ultimo Training Day")}${campo("convention", "Codici all'ultima Convention")}
      ${st.errore ? `<p class="errore">${esc(st.errore)}</p>` : ""}
      <div class="row" style="margin-top:16px"><button type="button" class="btn ghost grow" data-act="chiudi">Annulla</button><button class="btn primary grow">Salva</button></div>
    </form>`; }
  if(s === "guida-obiettivo" && ABITUDINI[st.guidaK]){ const a = ABITUDINI[st.guidaK];
    return `<h2>${esc(a.nome)}</h2>
    <p class="small">Il tuo obiettivo per la settimana${a.giorni ? " (giorni)" : ""}. Consigliato: ${a.base}. Meglio un obiettivo più basso, scelto da te e rispettato.</p>
    <form data-form="guida-obiettivo" novalidate>
      <label class="field"><span>Ogni settimana</span><input name="n" type="number" min="0" max="${a.giorni ? 7 : 50}" inputmode="numeric" value="${obiettivoAbitudine(st.guidaK)}"></label>
      ${st.errore ? `<p class="errore">${esc(st.errore)}</p>` : ""}
      <div class="row" style="margin-top:16px"><button type="button" class="btn ghost grow" data-act="chiudi">Annulla</button><button class="btn primary grow">Salva</button></div>
    </form>`; }
  return "";
}
Object.assign(AZIONI, {
  "guida-sett"(el){ st.guidaSett = Math.max(-SETTIMANE_INDIETRO, Math.min(0, (st.guidaSett || 0) + Number(el.dataset.d))); render(); },
  "sez-io"(el){ st.sezIo = el.dataset.sez; render(); window.scrollTo(0, 0); },
  "guida-vai"(el){ const d = el.dataset.dove;
    if(d === "lista" || d === "clienti"){ st.vista = "persone"; st.sezPersone = d; st.personaId = null; st.invitoId = null; }
    else st.vista = d === "gruppo" ? "gruppo" : "obiettivo";
    render(); window.scrollTo(0, 0); },
  "guida-cl21"(){ st.errore = null; st.sheet = "guida-cl21"; render(); },
  "guida-obiettivo"(el){ st.guidaK = el.dataset.k; st.errore = null; st.sheet = "guida-obiettivo"; render(); },
  async "guida-spunta"(el){ const k = el.dataset.k, g = el.dataset.giorno;
    if(g > oggi()) return;
    try{
      if(fattoIl(k, g)){ await api.togliFatto(k, g); st.guida.fatti = st.guida.fatti.filter(x => !(x.chiave === k && x.giorno === g)); }
      else { await api.segnaFatto(k, g); st.guida.fatti.push({ chiave:k, giorno:g }); }
      render();
    }catch(e){ toast(messaggio(e)); } }
});
Object.assign(MODULI, {
  async "guida-cl21"(f){
    const v = x => { const t = String(x.value).trim(); if(t === "") return null; const n = Math.round(Number(t)); return n >= 0 && n <= 100000 ? n : NaN; };
    const r = { app_cl21:v(f.app_cl21), training_day:v(f.training_day), convention:v(f.convention) };
    if(Object.values(r).some(x => Number.isNaN(x))){ mostraErroreForm(f, "Scrivi dei numeri interi (anche 0)."); return; }
    try{ await api.salvaNumeriCl21(r); st.guida.cl21 = r; st.sheet = null; render(); toast("Numeri salvati"); }catch(e){ mostraErroreForm(f, messaggio(e)); }
  },
  async "guida-obiettivo"(f){
    const k = st.guidaK, max = ABITUDINI[k].giorni ? 7 : 50, n = Math.round(Number(f.n.value));
    if(!(n >= 0 && n <= max)){ mostraErroreForm(f, `Scrivi un numero da 0 a ${max}.`); return; }
    try{ await api.salvaGuidaObiettivo(k, n); st.guida.obiettivi.set(k, n); st.sheet = null; render(); toast("Obiettivo salvato"); }catch(e){ mostraErroreForm(f, messaggio(e)); }
  }
});

/* ---- 11j. Seguimi giorno per giorno (036): chi lo attiva trova in «Il mio giorno» le azioni del giorno, prese dai suoi
   dati e fissate al mattino (al massimo 3 contatti, 3 follow-up e piani, 3 clienti, i VP del mese, formazione e sponsor).
   Si spuntano da sole quando segna il passo o l'ordine; formazione e sponsor a mano. All'upline solo i numeri, se lo sceglie. */
const SEGUIMI_TIPI = { contatto:"Contatto", followup:"Follow-up", cliente:"Cliente", vp:"VP del mese", formazione:"Formazione", sponsor:"Chiamata con il tuo sponsor" };
const SEGUIMI_GRUPPO = { contatto:"contatti", followup:"followup", cliente:"clienti", vp:"vp", formazione:"crescita", sponsor:"crescita" };
function oggiSeguimi(){ return st.seguimiGiorni.find(g => g.giorno === oggi()) || null; }
function azioniDelGiorno(){
  const out = [], sett = settimanaGiorni(), restano = sett.filter(g => g >= oggi()).length || 1;
  const manca = Math.max(0, (Number(st.goal.obiettivo_contatti) || 0) - fattoSettimana("contatto"));
  const n = Math.min(3, Math.ceil(manca / restano));
  (st.persone || []).filter(p => p.fase === "lista" && !p.esito && !p.nascosta_io)
    .sort((a, b) => String(a.creato_il || "") < String(b.creato_il || "") ? -1 : 1).slice(0, n)
    .forEach(p => out.push({ tipo:"contatto", id:p.id }));
  const d = daFare();
  d.ritardo.concat(d.oggi).slice(0, 3).forEach(p => out.push({ tipo:"followup", id:p.id }));
  clientiDaSentire().slice(0, 3).forEach(x => out.push({ tipo:"cliente", id:x.p.id }));
  const vpManca = (Number(st.goalMese.obiettivo_vp) || 0) - vpMese(meseDi(oggi()));
  if(vpManca > 0) out.push({ tipo:"vp", manca:Math.round(vpManca * 100) / 100 });
  if(obiettivoAbitudine("formazione") > 0) out.push({ tipo:"formazione" });
  if(obiettivoAbitudine("sponsor") > sett.filter(g => fattoIl("sponsor", g)).length) out.push({ tipo:"sponsor" });
  return out;
}
/* il primo accesso del giorno fissa le azioni di oggi */
async function preparaOggi(){
  if(!st.seguimi.attivo || oggiSeguimi()) return;
  const azioni = azioniDelGiorno();
  const r = { giorno:oggi(), azioni, proposte:azioni.length, fatte:0, per_tipo:{} };
  try{ await api.salvaSeguimiGiorno(r); st.seguimiGiorni = st.seguimiGiorni.filter(g => g.giorno !== oggi()).concat([r]); }catch(e){}
}
function passoOggi(id){ return (st.passi || []).some(x => x.persona_id === id && x.data === oggi()); }
function azioneFatta(a){
  if(a.tipo === "contatto" || a.tipo === "followup") return passoOggi(a.id);
  if(a.tipo === "cliente") return passoOggi(a.id) || (st.ordini || []).some(o => o.persona_id === a.id && o.data === oggi())
    || !clientiDaSentire().some(x => x.p.id === a.id);
  if(a.tipo === "vp") return vpMese(meseDi(oggi())) >= (Number(st.goalMese.obiettivo_vp) || 0)
    || movimentiVp().some(x => x.data === oggi() && Number(x.vp) > 0);
  return fattoIl(a.tipo, oggi());
}
function riepilogoOggi(g){
  const per = {}; let fatte = 0;
  for(const a of g.azioni || []){ if(azioneFatta(a)){ fatte++; const k = SEGUIMI_GRUPPO[a.tipo]; per[k] = (per[k] || 0) + 1; } }
  return { fatte, per };
}
/* giorni di fila (fino a oggi) con almeno metà delle azioni fatte */
function serieSeguimi(fatteOggi){
  let n = 0;
  const g0 = oggiSeguimi();
  if(g0 && g0.proposte && fatteOggi * 2 >= g0.proposte) n++;
  for(let d = piuGiorni(oggi(), -1); ; d = piuGiorni(d, -1)){
    const g = st.seguimiGiorni.find(x => x.giorno === d);
    if(!g || !g.proposte || g.fatte * 2 < g.proposte) break;
    n++;
  }
  return n;
}
let salvaOggiT = null;
function vOggiPerTe(){
  const g = st.seguimi.attivo ? oggiSeguimi() : null;
  if(!g) return "";
  const r = riepilogoOggi(g);
  if(r.fatte !== g.fatte || JSON.stringify(r.per) !== JSON.stringify(g.per_tipo || {})){
    g.fatte = r.fatte; g.per_tipo = r.per;
    clearTimeout(salvaOggiT);
    salvaOggiT = setTimeout(() => api.salvaSeguimiGiorno({ giorno:g.giorno, azioni:g.azioni, proposte:g.proposte, fatte:g.fatte, per_tipo:g.per_tipo }).catch(() => {}), 300);
  }
  const nome = id => { const p = (st.persone || []).find(x => x.id === id); return p ? p.nome : ""; };
  const riga = a => {
    const fatta = azioneFatta(a), manuale = a.tipo === "formazione" || a.tipo === "sponsor";
    const segno = manuale
      ? `<button class="spunta-oggi${fatta ? " si" : ""}" data-act="guida-spunta" data-k="${a.tipo}" data-giorno="${oggi()}" aria-pressed="${fatta}" aria-label="Fatto">${fatta ? "✓" : ""}</button>`
      : `<span class="spunta-oggi${fatta ? " si" : ""}" aria-label="${fatta ? "Fatto" : "Da fare"}">${fatta ? "✓" : ""}</span>`;
    let testo = "";
    if(a.tipo === "contatto" || a.tipo === "followup" || a.tipo === "cliente"){
      const n = nome(a.id); if(!n) return "";
      testo = `<button class="btn link" style="padding:0;min-height:0" data-act="${a.tipo === "cliente" ? "apri-cliente" : "apri-persona"}" data-id="${esc(a.id)}">${esc(n)}</button>`;
    } else if(a.tipo === "vp") testo = `Mancano ${num(a.manca)} VP al tuo obiettivo del mese ·
      <button class="btn link" style="padding:0;min-height:0" data-act="apri-bozza">apri la Bozza ordine</button>`;
    else if(a.tipo === "formazione") testo = "15 minuti: un audio o 10 pagine di un libro";
    else testo = "Una chiamata questa settimana";
    return `<li class="${fatta ? "fatta" : ""}">${segno}<span class="grow"><span class="tipo-oggi">${SEGUIMI_TIPI[a.tipo]}</span><br>${testo}</span></li>`;
  };
  const serie = serieSeguimi(r.fatte);
  /* le altre persone da sentire oggi (in ritardo, con la data di oggi, clienti) senza ripetere chi è già nelle azioni */
  const gia = new Set((g.azioni || []).filter(a => a.id).map(a => a.id)), d = daFare();
  const anche = d.ritardo.concat(d.oggi).filter(p => !gia.has(p.id)).map(p => ({ p, tipo:"followup", cliente:false,
      etichetta:p.prossima_data < oggi() ? "Follow-up · in ritardo" : "Follow-up · oggi", motivo:testoProssima(p) }))
    .concat(clientiDaSentire().filter(x => !gia.has(x.p.id)).map(x => ({ p:x.p, cliente:true, etichetta:"Cliente", motivo:x.motivo })));
  const altri = d.presto.length + d.corso.length;
  return `<div class="card oggi-per-te da-fare-oggi">
    <div class="spread"><span class="eyebrow">Da fare oggi · ${esc(GIORNI_SETT[new Date(oggi() + "T12:00:00Z").getUTCDay()])} ${esc(dataIt(oggi()))}</span>
      <span class="pill">${r.fatte} su ${g.proposte}</span></div>
    <ul>${(g.azioni || []).map(riga).join("")}</ul>
    <p class="small" style="margin:8px 0 0"><b>Oggi: ${r.fatte} su ${g.proposte} fatte</b>${serie >= 2 ? ` · da ${serie} giorni di fila almeno metà delle azioni` : ""}</p>
    ${anche.length ? `<div class="blocco-numeri anche"><h3>Anche da sentire</h3>
      <ul class="persone">${anche.map(x => `<li class="su-io"><button class="persona" data-act="${x.cliente ? "apri-cliente" : "apri-persona"}" data-id="${esc(x.p.id)}">
        <span class="grow"><span class="tipo-oggi">${esc(x.etichetta)}</span><br><b>${esc(x.p.nome)}</b>${x.motivo ? `<br><span class="small">${esc(x.motivo)}</span>` : ""}</span></button>
        <button class="x" data-act="togli-da-io" data-id="${esc(x.p.id)}" aria-label="Togli ${esc(x.p.nome)} da Io">×</button></li>`).join("")}</ul></div>` : ""}
    ${altri ? `<button class="riga-apri" data-act="guida-vai" data-dove="lista"><span class="grow">${altri === 1 ? "Un'altra persona in corso" : `Altri ${altri} in corso`} nella Lista</span>
      <span class="fr" aria-hidden="true">›</span></button>` : ""}
  </div>`;
}
function vGuidaSeguimi(){
  const s = st.seguimi, sw = (act, on, testo, sotto) => `<button class="interruttore" data-act="${act}" role="switch" aria-checked="${on}">
      <span class="grow" style="text-align:left">${testo}${sotto ? `<br><span class="small">${sotto}</span>` : ""}</span><span class="toggle${on ? " on" : ""}"></span></button>`;
  return `<div class="card guida-seguimi">
    <span class="eyebrow">Fatti seguire giorno per giorno</span>
    <p class="small" style="margin:4px 0 0">Ogni mattina, in cima a «Il mio giorno», le azioni del giorno prese dai tuoi dati. Lo togli quando vuoi.</p>
    ${sw("seguimi-attivo", !!s.attivo, "Seguimi giorno per giorno", "")}
  </div>
  <div class="card guida-condividi">
    <span class="eyebrow">Condividere con la tua upline</span>
    ${sw("seguimi-condividi", !!s.condividi, "Condividi i tuoi dati con il tuo sponsor e la tua upline",
      "Vedono i numeri del Seguimi, i numeri che scrivi a mano e le tue abitudini. Mai i nomi, e i VP restano quelli dei report.")}
    <button class="btn wide" style="margin-top:10px" data-act="apri-analisi" data-id="${esc(st.profilo.id)}">La mia analisi ›</button>
  </div>`;
}
function vSeguimiScheda(p){
  const g = st.seguimiScheda[p.id];
  if(!g || !g.length) return "";
  const sett = settimanaGiorni(), di = d => g.find(x => x.giorno === d);
  const cella = (d, f) => { const x = di(d); return `<td class="num">${x ? f(x) : d > oggi() ? "" : "–"}</td>`; };
  const tipo = k => x => num(Number((x.per_tipo || {})[k]) || 0);
  return `<div class="card seguimi-scheda">
    <span class="eyebrow">Si fa seguire giorno per giorno</span>
    <div class="tab-consigli"><table class="sette">
      <thead><tr><th></th>${sett.map((d, i) => `<th>${"LMMGVSD"[i]}</th>`).join("")}</tr></thead>
      <tbody>
        <tr><td>Fatte / proposte</td>${sett.map(d => cella(d, x => `${x.fatte}/${x.proposte}`)).join("")}</tr>
        <tr><td>Contatti</td>${sett.map(d => cella(d, tipo("contatti"))).join("")}</tr>
        <tr><td>Follow-up e piani</td>${sett.map(d => cella(d, tipo("followup"))).join("")}</tr>
        <tr><td>Clienti e VP</td>${sett.map(d => cella(d, x => num((Number((x.per_tipo || {}).clienti) || 0) + (Number((x.per_tipo || {}).vp) || 0)))).join("")}</tr>
        <tr><td>Formazione e sponsor</td>${sett.map(d => cella(d, tipo("crescita"))).join("")}</tr>
      </tbody></table></div>
    <p class="nota">Questa settimana. Solo i numeri: i nomi della sua Lista e dei suoi clienti restano suoi.</p>
  </div>`;
}
Object.assign(AZIONI, {
  async "seguimi-attivo"(){
    const r = { attivo:!st.seguimi.attivo, condividi:!!st.seguimi.condividi };
    try{ await api.salvaSeguimi(r); st.seguimi = r; if(r.attivo) await preparaOggi(); render();
      toast(r.attivo ? "Seguimi attivo: trovi le azioni di oggi in «Il mio giorno»" : "Seguimi tolto"); }catch(e){ toast(messaggio(e)); }
  },
  async "seguimi-condividi"(){
    const r = { attivo:!!st.seguimi.attivo, condividi:!st.seguimi.condividi };
    try{ await api.salvaSeguimi(r); st.seguimi = r; render();
      toast(r.condividi ? "Il tuo sponsor e la tua upline vedono i tuoi dati (mai i nomi)" : "I tuoi dati li vedi solo tu"); }catch(e){ toast(messaggio(e)); }
  }
});

/* ---- 11k. Analisi della persona (037): di sé (dalla Guida) e di chi è nel gruppo (dalla scheda partner). Pagina a parte,
   aperta solo a richiesta. Numeri dei report dell'anno fiscale: per ogni linea solo percentuale e volume VP, mese per mese
   (senza calcoli), peso sul gruppo, mesi al 21% e tendenza; poi la Stabilità Cum Laude 21 mese per mese. I numeri scritti
   a mano e le abitudini di un altro si vedono solo se li ha condivisi. */
async function apriAnalisi(pid){
  st.analisiId = pid; st.vista = "analisi"; render(); window.scrollTo(0, 0);
  try{
    const [righe, cond] = await Promise.all([api.analisiPersona(pid), pid === st.profilo.id ? Promise.resolve(null) : api.datiCondivisi(pid)]);
    st.analisi[pid] = righe || []; st.condivisi[pid] = cond || null; render();
  }catch(e){ st.analisi[pid] = []; toast(messaggio(e)); render(); }
}
function tendenzaDi(valori){
  const v = valori.filter(x => x != null);
  if(v.length < 4) return null;
  const ultimi = v.slice(-3), prima = v.slice(-6, -3);
  const a = somma(ultimi.map(x => ({ x })), "x") / ultimi.length, b = somma(prima.map(x => ({ x })), "x") / prima.length;
  if(!b) return a > 0 ? "in crescita" : "stabile";
  return a > b * 1.1 ? "in crescita" : a < b * 0.9 ? "in calo" : "stabile";
}
const INIZIO_STABILITA = "2026-10";
function sogliaCl21(r, pct){ const i = LIVELLI_CL21.reduce((x, l, j) => (Number(pct) || 0) >= l ? j : x, 0); return r.soglie[i]; }
function vAnalisi(){
  const pid = st.analisiId, mio = pid === st.profilo.id, righe = st.analisi[pid];
  const indietro = `<button class="btn link" data-act="analisi-indietro" style="padding:0">‹ Indietro</button>`;
  if(!righe) return `${indietro}<p class="muted">Carico i numeri…</p>`;
  const nome = mio ? "" : nomeDi(pid);
  const breve = m => MESI[Number(meseDi(m).slice(5)) - 1].slice(0, 3);
  const conReport = righe.filter(r => r.vpg != null);
  if(!conReport.length) return `${indietro}<div class="card"><span class="eyebrow">${mio ? "La mia analisi" : `Analisi di ${esc(nome)}`}</span>
    <p class="small" style="margin:6px 0 0">Ancora nessun report importato in questo anno fiscale (da settembre).</p></div>`;
  /* le linee frontali: per codice, con nome, VP di gruppo e percentuale di ogni mese */
  const linee = new Map();
  righe.forEach((r, i) => (r.linee || []).forEach(l => {
    const k = l.codice; if(!linee.has(k)) linee.set(k, { nome:l.nome || `Codice ${l.codice}`, mesi:righe.map(() => null) });
    const vp = Number(l.vpg) || 0;
    linee.get(k).mesi[i] = { vp, pct:l.percentuale != null ? Number(l.percentuale) : percentualeDa(vp) };
  }));
  const ultimo = righe.length - 1 - [...righe].reverse().findIndex(r => r.vpg != null);
  const gruppoUltimo = Number(righe[ultimo].vpg) || 0;
  const lista = [...linee.values()].sort((a, b) => ((b.mesi[ultimo] || {}).vp || 0) - ((a.mesi[ultimo] || {}).vp || 0));
  const forte = lista.slice().sort((a, b) => somma(b.mesi.map(x => ({ v:x ? x.vp : 0 })), "v") - somma(a.mesi.map(x => ({ v:x ? x.vp : 0 })), "v"))[0];
  const mesi21 = conReport.filter(r => Number(r.percentuale) >= 21).length;
  const media = somma(conReport.map(r => ({ v:Number(r.vpg) || 0 })), "v") / conReport.length;
  const cella = x => x ? `<td class="num p${x.pct || 0}"><b>${num(x.vp)}</b><br><span>${x.pct ? x.pct + "%" : "–"}</span></td>` : `<td class="num faint">–</td>`;
  const tend = t => t ? `<td class="t-${t.split(" ").pop()}">${{ "in crescita":"↗", "in calo":"↘", stabile:"→" }[t]} ${t}</td>` : "<td>–</td>";
  const testa = `<tr><th class="nome"></th>${righe.map(r => `<th>${breve(r.mese)}</th>`).join("")}`;
  const tabLinee = `<div class="tab-consigli"><table class="analisi">
      <thead>${testa}<th>peso</th><th>mesi 21%</th><th>tendenza</th></tr></thead>
      <tbody>${lista.map(l => `<tr><td class="nome">${esc(l.nome)}</td>${l.mesi.map(cella).join("")}
        <td class="num">${gruppoUltimo && l.mesi[ultimo] ? Math.round(l.mesi[ultimo].vp / gruppoUltimo * 100) + "%" : "–"}</td>
        <td class="num">${l.mesi.filter(x => x && x.pct >= 21).length}</td>${tend(tendenzaDi(l.mesi.map(x => x ? x.vp : null)))}</tr>`).join("")}
        <tr class="totale"><td class="nome">${mio ? "Tutto il tuo gruppo" : "Tutto il gruppo"}</td>${righe.map(r => cella(r.vpg != null
          ? { vp:Number(r.vpg) || 0, pct:r.percentuale != null ? Number(r.percentuale) : percentualeDa(Number(r.vpg) || 0) } : null)).join("")}
          <td class="num">100%</td><td class="num">${mesi21}</td>${tend(tendenzaDi(righe.map(r => r.vpg != null ? Number(r.vpg) : null)))}</tr></tbody>
    </table></div>`;
  const stab = [{ k:"personali", nome:mio ? "I tuoi nuovi iscritti (con il tuo link)" : "Nuovi iscritti con il suo link" }]
    .concat(STABILITA_CL21.filter(r => !r.scritto));
  const tabStab = `<div class="tab-consigli"><table class="analisi">
      <thead>${testa}</tr></thead>
      <tbody>${stab.map(r => `<tr><td class="nome">${esc(r.nome)}</td>${righe.map(x => { const v = Number(x[r.k]) || 0;
        /* i conteggi ci sono da quando c'è la Guida (fine ottobre 2026); senza report del mese niente soglia */
        if(meseDi(x.mese) < INIZIO_STABILITA || (r.soglie && x.vpg == null)) return `<td class="num faint">–</td>`;
        if(!r.soglie) return `<td class="num">${num(v)}</td>`;
        const s = sogliaCl21(r, x.percentuale);
        return `<td class="num ${v >= s ? "ok" : "manca"}">${num(v)}<br><span>su ${num(s)}</span></td>`; }).join("")}</tr>`).join("")}</tbody>
    </table></div>`;
  const cond = mio ? { cl21:st.guida.cl21, obiettivi:[...st.guida.obiettivi].map(([chiave, a_settimana]) => ({ chiave, a_settimana })), fatti:st.guida.fatti } : st.condivisi[pid];
  const scritti = STABILITA_CL21.filter(r => r.scritto);
  const blocco = cond ? `<ul class="req">${scritti.map(r => `<li><span class="grow">${esc(r.nome)}</span><span class="num">${
      cond.cl21 && cond.cl21[r.k] != null ? num(cond.cl21[r.k]) : "–"}</span></li>`).join("")}</ul>
    ${mio ? "" : `<p class="small" style="margin:8px 0 0"><b>Abitudini di questa settimana</b>: ${["formazione", "sponsor"].map(k => {
      const o = (cond.obiettivi || []).find(x => x.chiave === k), f = (cond.fatti || []).filter(x => x.chiave === k && x.giorno >= settimana()).length;
      return `${ABITUDINI[k].nome.toLowerCase()} ${f} su ${o ? o.a_settimana : ABITUDINI[k].base}`; }).join(" · ")}</p>`}`
    : `<p class="small" style="margin:6px 0 0">Non li ha condivisi: li vede solo ${esc(nome)}.</p>`;
  return `${indietro}
  <div class="card analisi-riep">
    <span class="eyebrow">${mio ? "La mia analisi" : `Analisi di ${esc(nome)}`} · anno fiscale</span>
    <div class="numeri-guida analisi-numeri">
      <div><b class="num">${conReport.length} su ${righe.length}</b><span>mesi con il report</span></div>
      <div><b class="num">${mesi21}</b><span>mesi al 21%</span></div>
      <div><b class="num">${num(Math.round(media))}</b><span>VP di gruppo medio</span></div>
      <div><b style="font-size:16px">${forte ? esc(forte.nome) : "–"}</b><span>linea più forte</span></div>
    </div>
  </div>
  <div class="card analisi-linee">
    <span class="eyebrow">Andamento delle linee</span>
    <p class="small" style="margin:4px 0 0">VP di gruppo e percentuale di ogni linea frontale, mese per mese. Peso: quanto conta la linea sul
      gruppo nell'ultimo mese. Tendenza: ultimi 3 mesi rispetto ai 3 prima.</p>
    ${lista.length ? tabLinee : `<p class="muted" style="margin:8px 0 0">Nei report non ci sono linee frontali.</p>`}
  </div>
  <div class="card analisi-stabilita">
    <span class="eyebrow">Stabilità Cum Laude 21 mese per mese</span>
    <p class="small" style="margin:4px 0 0">Sotto ogni numero, quello che serve per una qualifica solida alla percentuale di quel mese.</p>
    ${tabStab}
    <p class="small" style="margin:10px 0 0"><b>Scritti a mano</b> (il valore di oggi)</p>
    ${blocco}
  </div>`;
}
Object.assign(AZIONI, {
  "apri-analisi"(el){ apriAnalisi(el.dataset.id || st.profilo.id); },
  "analisi-indietro"(){ if(tornaIndietro()) return;
    st.vista = st.analisiId === st.profilo.id ? "io" : "scheda"; render(); window.scrollTo(0, 0); }
});

/* ---- 11g. Il movimento (scelte di Stefano dalla tavola di prova: "Vivace"; tra le schede "Una sopra l'altra") ----
   Tra le pagine e le schede: andando avanti la nuova scorre da destra sopra la vecchia, che si sposta un poco e si
   scurisce; tornando indietro quella di sopra scivola via e lascia vedere quella sotto. Tutto il resto (pulsanti, numeri, barre,
   finestre dal basso, messaggi) ha un leggero rimbalzo. Ai traguardi personali i coriandoli, una volta sola per periodo.
   Con "riduci animazioni" attivo sul telefono non si muove niente (il traguardo si scrive e basta). */
const SOBRIA = { dur:180, ease:"cubic-bezier(.2,.7,.2,1)" };
const SCORRE = { dur:340, ease:"cubic-bezier(.32,.72,0,1)" };
const VIVACE = { dur:280, ease:"cubic-bezier(.34,1.56,.64,1)", salto:1.32 };
const FESTE = { piccola:{ pezzi:130, misura:[7, 12], tempo:1900, cannoni:false }, grande:{ pezzi:240, misura:[7, 13], tempo:2600, cannoni:true } };
const ORDINE_PAGINE = ["obiettivo", "io", "persone", "gruppo", "scheda"], ORDINE_SEZIONI = ["target", "lista", "clienti"];
const fermo = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
function anima(el, frame, m, opz){
  if(!el || !el.animate || fermo()) return Promise.resolve();
  m = m || SOBRIA;
  return el.animate(frame, Object.assign({ duration:m.dur, easing:m.ease || "ease-out" }, opz)).finished.catch(() => {});
}
/* prima di ridisegnare: dove eravamo, le barre e i numeri, il foglio aperto */
function fotoMovimento(){
  const f = { barre:new Map(), numeri:new Map(), foglio:st.foglioPrima || null };
  document.querySelectorAll("#app .bar[aria-label]").forEach(b => f.barre.set(b.getAttribute("aria-label"), Number(b.getAttribute("aria-valuenow"))));
  document.querySelectorAll("#app .obiettivo, #azioni button[data-act]").forEach(el => {
    const k = el.dataset.act || (el.querySelector(".bar") || {}).getAttribute?.("aria-label"), n = el.querySelector(".num, b");
    if(k && n) f.numeri.set(k, n.textContent); });
  return f;
}
/* dove eravamo all'ultimo disegno (lo stato cambia prima di render, quindi si confronta con questo) */
let vistaPrima = null;
function muoviDopo(prima){
  const dettaglio = !!(st.personaId || st.invitoId || st.schedaId);
  const ora = { chiave:[st.fase, st.vista, st.sezPersone, st.personaId, st.schedaId, st.invitoId].join("|"), pagina:st.vista, sez:st.sezPersone, dettaglio };
  const app = document.getElementById("app"), v = vistaPrima;
  if(v && v.chiave !== ora.chiave && st.fase === "home" && v.chiave.startsWith("home|")){
    /* la direzione: verso destra si va avanti (pagina dopo, una scheda che si apre), verso sinistra si torna */
    let verso = ORDINE_PAGINE.indexOf(st.vista) - ORDINE_PAGINE.indexOf(v.pagina);
    if(!verso && st.vista === "persone") verso = dettaglio !== v.dettaglio ? (dettaglio ? 1 : -1) : ORDINE_SEZIONI.indexOf(st.sezPersone) - ORDINE_SEZIONI.indexOf(v.sez);
    if(prima.pagina) unaSopraLAltra(app, prima.pagina, Math.sign(verso) || st.versoNav || 1);
  }
  /* le barre si riempiono scorrendo (anche quando si apre la pagina), i numeri cambiati fanno un salto */
  document.querySelectorAll("#app .bar[aria-label]").forEach(b => {
    const k = b.getAttribute("aria-label"), adesso = Number(b.getAttribute("aria-valuenow")), dPrima = prima.barre.has(k) ? prima.barre.get(k) : 0;
    if(dPrima !== adesso) anima(b.firstElementChild, [{ width:dPrima + "%" }, { width:adesso + "%" }], { dur:VIVACE.dur * 2.4, ease:VIVACE.ease });
  });
  document.querySelectorAll("#app .obiettivo, #azioni button[data-act]").forEach(el => {
    const k = el.dataset.act || (el.querySelector(".bar") || {}).getAttribute?.("aria-label"), n = el.querySelector(".num, b");
    if(k && n && prima.numeri.has(k) && prima.numeri.get(k) !== n.textContent)
      anima(n, [{ transform:"scale(1)" }, { transform:`scale(${VIVACE.salto})`, offset:.4 }, { transform:"scale(1)" }], { dur:VIVACE.dur * 2.2, ease:VIVACE.ease });
  });
  /* il foglio dal basso: sale quando si apre */
  const box = document.querySelector("#sheet .sheet-box");
  if(st.sheet && !prima.foglio && box){
    anima(box.parentNode, [{ opacity:0 }, { opacity:1 }], { dur:200 });
    anima(box, [{ transform:"translateY(100%)" }, { transform:"none" }], { dur:VIVACE.dur * 1.5, ease:"cubic-bezier(.34,1.25,.64,1)" });
  }
  st.foglioPrima = st.sheet || null;
  st.versoNav = null;
  vistaPrima = ora;
  controllaTraguardi();
}
/* la pagina di prima: se ne tiene una copia ferma dove era (con lo scorrimento), per farle passare sopra la nuova */
function cambioPagina(){
  const v = vistaPrima;
  return !!v && st.fase === "home" && v.chiave.startsWith("home|") && !fermo()
    && v.chiave !== [st.fase, st.vista, st.sezPersone, st.personaId, st.schedaId, st.invitoId].join("|");
}
function fotoPagina(app){
  document.querySelectorAll(".pagina-prima").forEach(x => x.remove());
  const copia = document.createElement("div");
  copia.className = "pagina-prima"; copia.setAttribute("aria-hidden", "true");
  const dentro = app.cloneNode(true); dentro.removeAttribute("id"); dentro.style.marginTop = -window.scrollY + "px";
  dentro.querySelectorAll("[id]").forEach(x => x.removeAttribute("id"));
  copia.appendChild(dentro);
  return copia;
}
function unaSopraLAltra(app, copia, verso){
  document.body.appendChild(copia);
  const fine = () => { copia.remove(); app.classList.remove("in-cima", "sotto"); };
  if(verso > 0){
    /* avanti: la nuova scorre sopra */
    app.classList.add("in-cima");
    anima(app, [{ transform:"translateX(100%)" }, { transform:"none" }], SCORRE);
    anima(copia, [{ transform:"none", filter:"brightness(1)" }, { transform:"translateX(-25%)", filter:"brightness(.8)" }], SCORRE).then(fine);
  } else {
    /* indietro: quella di sopra scivola via */
    copia.classList.add("sopra"); app.classList.add("sotto");
    anima(app, [{ transform:"translateX(-25%)", filter:"brightness(.8)" }, { transform:"none", filter:"brightness(1)" }], SCORRE);
    anima(copia, [{ transform:"none" }, { transform:"translateX(100%)" }], SCORRE).then(fine);
  }
}
/* il foglio chiuso scende: se ne fa una copia che scivola via mentre l'app va avanti */
function chiudiFoglioPiano(contenitore){
  const vecchio = contenitore.firstElementChild;
  if(!vecchio || fermo()) return;
  const copia = vecchio.cloneNode(true);
  copia.removeAttribute("data-act"); copia.style.pointerEvents = "none"; copia.setAttribute("aria-hidden", "true");
  document.body.appendChild(copia);
  anima(copia.firstElementChild, [{ transform:"none" }, { transform:"translateY(100%)" }], { dur:220, ease:"cubic-bezier(.4,0,1,1)" });
  anima(copia, [{ opacity:1 }, { opacity:0 }], { dur:240 }).then(() => copia.remove());
}

/* I traguardi personali: obiettivo contatti e piani della settimana (piccola festa), VP del mese, nuova tappa del
   percorso, primo cliente e primo partner dalla lista (grande festa). Si festeggia solo nel momento in cui succede. */
let traguardiPrima = null;
function valoriTraguardi(){
  const p = percorso(), m = meseDi(oggi());
  return { contatti:fattoSettimana("contatto"), piani:fattoSettimana("piano"), vp:vpMese(m), tappa:p.indice, nomeTappa:(p.raggiunta || {}).nome,
    clienti:st.persone.filter(x => x.esito === "cliente").length, partner:st.persone.filter(x => x.esito === "partner").length,
    obContatti:Number(st.goal.obiettivo_contatti) || 0, obPiani:Number(st.goal.obiettivo_piani) || 0, obVp:Number(st.goalMese.obiettivo_vp) || 0, settimana:settimana(), mese:m };
}
function controllaTraguardi(){
  if(st.fase !== "home" || !st.profilo || !st.goal || !st.goalMese){ traguardiPrima = null; return; }
  const v = valoriTraguardi(), a = traguardiPrima;
  traguardiPrima = v;
  if(!a || a.settimana !== v.settimana && a.mese !== v.mese) return;
  const una = (chiave, tipo, titolo, sotto) => {
    const k = `growup-team.festa.${st.profilo.id}.${chiave}`;
    if(leggiLocale(k)) return;
    salvaLocale(k, "1"); festeggia(tipo, titolo, sotto);
  };
  const passato = (x, y, ob) => ob > 0 && x < ob && y >= ob;
  if(passato(a.vp, v.vp, v.obVp) && a.mese === v.mese) una(`vp.${v.mese}`, "grande", "Obiettivo VP del mese raggiunto!", `${num(v.vp)} VP personali a ${nomeMese(v.mese).split(" ")[0]}`);
  else if(v.tappa > a.tappa && v.nomeTappa) una(`tappa.${v.tappa}`, "grande", `Nuova tappa: ${v.nomeTappa}!`, "Il tuo percorso va avanti");
  else if(a.clienti === 0 && v.clienti > 0) una("primo-cliente", "grande", "Il tuo primo cliente!", "Dalla tua lista");
  else if(a.partner === 0 && v.partner > 0) una("primo-partner", "grande", "Il tuo primo partner!", "Dalla tua lista");
  else if(passato(a.contatti, v.contatti, v.obContatti) && a.settimana === v.settimana)
    una(`contatti.${v.settimana}`, "piccola", "Obiettivo contatti raggiunto!", `${plur(v.contatti, "contatto", "contatti")} questa settimana`);
  else if(passato(a.piani, v.piani, v.obPiani) && a.settimana === v.settimana)
    una(`piani.${v.settimana}`, "piccola", "Obiettivo piani raggiunto!", `${plur(v.piani, "piano", "piani")} questa settimana`);
}

/* I coriandoli: disegnati qui, senza librerie, nei colori dell'app; con un "tic" del telefono (Android) */
const COLORI_FESTA = ["#13795b", "#34c08f", "#c26a3d", "#e08a5a", "#e2a46f", "#f3d9a8", "#0a3a2c"];
function festeggia(tipo, titolo, sotto){
  const f = FESTE[tipo] || FESTE.piccola;
  const avviso = document.createElement("div");
  avviso.className = "annuncio-festa"; avviso.setAttribute("role", "status");
  avviso.innerHTML = `<b>${esc(titolo)}</b><span>${esc(sotto || "")}</span>`;
  document.body.appendChild(avviso);
  anima(avviso, [{ opacity:0, transform:`translate(-50%, -50%) scale(${tipo === "grande" ? .8 : .9})` }, { opacity:1, transform:"translate(-50%, -50%) scale(1)" }],
    { dur:VIVACE.dur * 1.8, ease:VIVACE.ease });
  setTimeout(() => anima(avviso, [{ opacity:1 }, { opacity:0 }], { dur:220 }).then(() => avviso.remove()), f.tempo);
  /* la vibrazione solo dopo un tocco (il Platino si può riconoscere all'apertura dell'app) */
  try{ if(navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(tipo === "grande" ? [30, 40, 30] : 25); }catch(e){}
  if(fermo()) return;
  const cv = document.createElement("canvas"), k = window.devicePixelRatio || 1;
  cv.className = "coriandoli"; cv.setAttribute("aria-hidden", "true"); document.body.appendChild(cv);
  const W = cv.width = innerWidth * k, H = cv.height = innerHeight * k, ctx = cv.getContext("2d"), pezzi = [], rnd = (a, b) => a + Math.random() * (b - a);
  if(!ctx){ cv.remove(); return; }
  const spara = (x, y, n, ang, apertura, forza) => { for(let i = 0; i < n; i++){ const a = ang + rnd(-apertura, apertura), v = rnd(.55, 1) * forza * k;
    pezzi.push({ x, y, vx:Math.cos(a) * v, vy:Math.sin(a) * v, r:rnd(0, 6.28), vr:rnd(-.25, .25), m:rnd(f.misura[0], f.misura[1]) * k,
      c:COLORI_FESTA[i % COLORI_FESTA.length], forma:Math.random() < .25 ? "nastro" : Math.random() < .3 ? "tondo" : "foglio", oscilla:rnd(0, 6.28) }); } };
  spara(W / 2, H * .36, f.pezzi, -Math.PI / 2, Math.PI, 15);
  if(f.cannoni){ spara(0, H * .8, 70, -Math.PI / 3.2, .35, 21); spara(W, H * .8, 70, -Math.PI + Math.PI / 3.2, .35, 21); }
  const inizio = performance.now();
  (function giro(t){
    const p = (t - inizio) / f.tempo;
    ctx.clearRect(0, 0, W, H);
    for(const q of pezzi){
      q.vx *= .985; q.vy = q.vy * .985 + .32 * k; q.oscilla += .12; q.x += q.vx + Math.sin(q.oscilla) * .6 * k; q.y += q.vy; q.r += q.vr;
      ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, (1 - p) * 2.2)); ctx.translate(q.x, q.y); ctx.rotate(q.r); ctx.fillStyle = q.c;
      if(q.forma === "tondo"){ ctx.beginPath(); ctx.arc(0, 0, q.m * .4, 0, 6.28); ctx.fill(); }
      else if(q.forma === "nastro") ctx.fillRect(-q.m * .15, -q.m * 1.2, q.m * .3, q.m * 2.4);
      else ctx.fillRect(-q.m / 2, -q.m * .3 * Math.abs(Math.cos(q.oscilla)) - .5, q.m, q.m * .6 * Math.abs(Math.cos(q.oscilla)) + 1);
      ctx.restore();
    }
    if(p < 1) requestAnimationFrame(giro); else cv.remove();
  })(inizio);
}

/* ---- 12. Eventi ---- */
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]");
  if(!el) return;
  const act = el.dataset.act;
  if(act === "chiudi-fuori"){ if(e.target === el){ chiudiSheet(); render(); } return; }
  if(AZIONI[act]){ e.preventDefault(); const prima = statoPagina(); AZIONI[act](el); ricordaRitorno(act, prima); }
});
/* Tornare indietro con il dito: chi arriva in una schermata da un collegamento (la Lista dalla Guida, una persona da
   «Oggi per te», una scheda partner) trascinando verso destra torna da dove era partito, allo stesso punto della pagina.
   Le schede principali e i pulsanti di sezione (Il mio giorno · Guida, Target · Lista · Clienti) azzerano la strada. */
const AZIONI_MENU = new Set(["vista-obiettivo", "vista-io", "vista-persone", "vista-gruppo", "sez-io", "sez-persone"]);
const CAMPI_PAGINA = ["vista", "sezIo", "sezPersone", "personaId", "invitoId", "schedaId", "target"];
function statoPagina(){ const f = { y:window.scrollY, schedaPila:(st.schedaPila || []).slice() }; for(const k of CAMPI_PAGINA) f[k] = st[k]; return f; }
function ricordaRitorno(act, prima){
  st.ritorni = st.ritorni || [];
  if(AZIONI_MENU.has(act)){ st.ritorni = []; return; }
  if(CAMPI_PAGINA.some(k => st[k] !== prima[k])){ prima.dopo = statoPagina(); st.ritorni.push(prima); if(st.ritorni.length > 20) st.ritorni.shift(); }
}
/* si torna indietro solo se si è ancora nella schermata a cui aveva portato il collegamento */
function tornaIndietro(){
  const f = (st.ritorni || [])[st.ritorni.length - 1];
  if(!f || CAMPI_PAGINA.some(k => st[k] !== f.dopo[k])){ st.ritorni = []; return false; }
  st.ritorni.pop();
  for(const k of CAMPI_PAGINA) st[k] = f[k];
  st.schedaPila = f.schedaPila;
  render(); window.scrollTo(0, f.y);
  return true;
}

document.addEventListener("submit", e => {
  const f = e.target.closest("form[data-form]");
  if(!f) return;
  e.preventDefault();
  if(st.occupato) return;
  /* nei campi numerici il valore grigio (0 o quello attuale) vale se non si scrive niente;
     se il modulo dà un errore, il campo torna vuoto con il grigio */
  const riempiti = [...f.querySelectorAll("input[data-vuoto]")].filter(i => !i.value.trim());
  riempiti.forEach(i => { i.value = i.placeholder; });
  const fn = MODULI[f.dataset.form];
  if(fn) Promise.resolve(fn(f)).finally(() => {
    if(f.isConnected && f.querySelector(".errore")) riempiti.forEach(i => { if(i.value === i.placeholder) i.value = ""; });
  });
});

/* Qualifica scelta: mostra mese e pagamenti per Foundation e Builder; la data di iscrizione
   è obbligatoria solo per chi inizia (nel modulo d'ingresso). */
document.addEventListener("change", e => {
  if(e.target.id === "file-report" || e.target.classList.contains("file-amway")){ smistaFileAmway(e.target.files ? [...e.target.files] : []); return; }
  if(e.target.name === "nascondi" && e.target.closest(".imp-da-scegliere")){ accendiRapida(null); return; }
  if(e.target.name !== "qualifica") return;
  const f = e.target.form;
  const t = st.stages.find(s => s.chiave === f.qualifica.value);
  f.querySelector("[data-mostra=pagamenti]").hidden = !(t && t.pagamenti_max);
  f.querySelector("[data-mostra=mese]").hidden = !(t && (t.pagamenti_max || conMeseArgento(t.chiave)));
  f.querySelector("[data-etichetta-mese]").textContent = etichettaMese(f.qualifica.value);
  const pr = f.querySelector("[data-mostra=prossima]");
  if(pr){ const prima = f.prossima.value; pr.hidden = !daPlatino(f.qualifica.value);
    f.prossima.innerHTML = opzioniProssima(f.qualifica.value, prima); }
  const obbl = f.querySelector("[data-obbl]");
  if(obbl && f.dataset.form === "ingresso") obbl.textContent = f.qualifica.value ? "(facoltativa)" : "(obbligatoria per chi inizia)";
});

/* Appena si corregge un campo, l'errore del modulo sparisce. */
document.addEventListener("input", e => {
  if(e.target.id === "cerca-struttura"){ st.cerca = e.target.value; applicaRicerca(); return; }
  /* ricerca nell'import: per nome o per codice, tra i nuovi o tra le escluse */
  if(e.target.dataset && e.target.dataset.cerca){
    const q = senzaAccenti(e.target.value);
    document.querySelectorAll(e.target.dataset.cerca + " [data-nome]").forEach(l => { l.style.display = q && !l.dataset.nome.includes(q) ? "none" : ""; });
    return;
  }
  const err = e.target.form && e.target.form.querySelector(".errore");
  if(err) err.remove();
});

document.addEventListener("keydown", e => {
  if(e.key === "Escape" && st.sheet){ st.sheet = null; render(); }
});

/* Trascinando il dito: verso sinistra da Io a Gruppo, verso destra da Gruppo (o da una scheda) a Io / al gruppo.
   Non scatta nei campi da scrivere, nei fogli aperti, nelle tabelle che scorrono di lato e nei movimenti in verticale. */
let tocco = null;
document.addEventListener("touchstart", e => {
  tocco = null;
  if(st.fase !== "home" || st.sheet || e.touches.length !== 1) return;
  if(e.target.closest("input, select, textarea, .sheet, [data-no-swipe]")) return;
  const t = e.touches[0];
  tocco = { x:t.clientX, y:t.clientY, quando:Date.now() };
}, { passive:true });
document.addEventListener("touchend", e => {
  if(!tocco || !e.changedTouches.length) return;
  const t = e.changedTouches[0], dx = t.clientX - tocco.x, dy = t.clientY - tocco.y, ms = Date.now() - tocco.quando;
  tocco = null;
  if(Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8 || ms > 800) return;
  /* arrivato da un collegamento: si torna da dove si era partiti */
  if(dx > 0 && (st.ritorni || []).length && tornaIndietro()) return;
  if(dx < 0) st.ritorni = [];
  /* ordine delle pagine: Obiettivo | Io | Gruppo */
  if(dx < 0 && st.vista === "obiettivo") scorri("vista-io");
  else if(dx < 0 && st.vista === "io") scorri("vista-persone");
  else if(dx < 0 && st.vista === "persone" && !st.personaId && !st.invitoId) scorri("vista-gruppo");
  else if(dx > 0 && st.vista === "persone" && st.invitoId) scorri("torna-target");
  else if(dx > 0 && st.vista === "persone" && st.personaId) scorri(st.sezPersone === "clienti" ? "torna-clienti" : "torna-lista");
  else if(dx > 0 && st.vista === "persone") scorri("vista-io");
  else if(dx > 0 && st.vista === "io") scorri("vista-obiettivo");
  else if(dx > 0 && st.vista === "gruppo") scorri("vista-persone");
  else if(dx > 0 && st.vista === "scheda") scorri("scheda-indietro");
  else if(dx > 0 && st.vista === "profilo") scorri("profilo-indietro");   // alla scheda di prima, o al gruppo
}, { passive:true });
function scorri(azione){ AZIONI[azione](); }   // il movimento della pagina lo fa render (muoviDopo)

/* Tornando sull'app (da un altro dispositivo si è magari scritto qualcosa) si ricarica. */
document.addEventListener("visibilitychange", async () => {
  if(document.visibilityState !== "visible") return;
  /* tornando sull'app: se nel frattempo l'accesso è stato tolto o bloccato, si vede subito */
  if(st.fase === "home" && st.profilo){ try{ if(!(await api.collega()) && await accessoNegato()) return; }catch(e){} }
  aggiornaAttivita();
});

/* Un link aperto mentre l'app è già aperta (es. il link personale toccato in WhatsApp). */
window.addEventListener("hashchange", () => {
  const l = leggiLink(location.hash.replace(/^#/, ""));
  if(!l) return;
  history.replaceState(null, "", location.pathname + location.search);
  if(l.chiave) entraConChiave(l.chiave);
  else if(st.fase !== "home") apriInvito(l.invito).then(render);
});

if("serviceWorker" in navigator && location.protocol === "https:"){
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

avvio();
})();
