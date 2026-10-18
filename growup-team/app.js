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
    creaInvitoSopra: (pid, altri) => q(sb.rpc("crea_invito_sopra", { p_partner:pid, p_altri:altri })),
    modificaPartenza: args => q(sb.rpc("modifica_partenza", args)),
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
    nuovoOrdine:  riga => q(sb.from("ordini").insert(riga)),
    nuoveRighe:   righe => q(sb.from("righe_ordine").insert(righe)),
    aggiornaOrdine: (id, campi) => q(sb.from("ordini").update(campi).eq("id", id)),
    cancellaOrdine: id => q(sb.from("ordini").delete().eq("id", id)),
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
  linkGestito: null,      // { nome, chiave }: nuovo link personale creato dall'admin per chi l'ha perso
  nascosti: new Set(),    // persone nascoste dalla mia struttura (solo loro: chi sta sotto resta)
  persone: [], passi: [], // la mia lista (solo mia) e i suoi passi
  personaId: null, filtroLista: "aperti", cercaLista: "", passoTipo: null,
  numeriLista: {},
  inviti: [], sezPersone: "lista", invitoId: null, archiviatiT: false,  // il Target (solo miei)
  ct: null,               // la pagina del contatto (le otto domande)
  ordini: [], righe: [], durate: new Map(), filtroClienti: "sentire",   // i Clienti (solo miei)
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
  toastT = setTimeout(() => { t.innerHTML = ""; toastAnnulla = null; }, annulla ? 5000 : 3000);
}

const MESSAGGI_ERRORE = {
  chiave_non_valida: "Questo link personale non è valido o è stato sostituito con uno nuovo.",
  codice_non_valido: "Il link d'invito non è valido. Chiedi al tuo sponsor di rimandartelo.",
  profilo_esistente: "Questo telefono è già collegato a un profilo: ricarica la pagina.",
  data_futura: "La data di iscrizione non può essere nel futuro.",
  qualifica_non_valida: "Qualifica non riconosciuta.",
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
function vpMese(m, lista){
  return somma((lista || st.att).filter(a => (a.tipo === "ordine" || a.tipo === "rettifica") && meseDi(a.data) === m), "vp");
}
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
    const linee = lineeReport(r);
    return { personali, gruppo:Number(r.vp_gruppo), linee, attive:linee.filter(l => l.vp >= soglia()).length,
             percentuale:r.percentuale != null ? Number(r.percentuale) : percentualeDa(Number(r.vp_gruppo)), daReport:true };
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

function finestraPrimoOrdine(tappa){
  const p = st.profilo;
  if(!p.data_iscrizione || !tappa.giorni_scadenza) return null;
  const fine = piuGiorni(p.data_iscrizione, tappa.giorni_scadenza);
  const vp = somma(movimentiVp().filter(a => a.data >= p.data_iscrizione && a.data <= fine), "vp");
  return { fine, vp, restano: giorniTra(oggi(), fine) };
}

/* Una tappa è fatta se la qualifica dichiarata la comprende, oppure se i numeri lo dicono. */
function tappaFatta(t){
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
  return { raggiunta: fatte >= 0 ? S[fatte] : null, attuale: S[fatte + 1] || null, indice: fatte + 1 };
}

function requisiti(t){
  const m = meseDi(oggi()), out = [];
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
}

async function caricaStruttura(){
  st.struttura = await api.struttura() || [];
  try{ st.preferiti = new Set((await api.preferiti() || []).map(r => r.preferito_id)); }catch(e){}
  try{ st.nascosti = new Set((await api.nascosti() || []).map(r => r.nascosto_id)); }catch(e){}
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
                  contatto:vContatto };
  const html = (viste[st.fase] || vAvvio)();
  if(html !== ultimoApp){ app.innerHTML = html; ultimoApp = html; }
  const conAzioni = st.fase === "home" && st.vista === "io";
  document.body.classList.toggle("con-azioni", conAzioni);
  document.getElementById("azioni").innerHTML = conAzioni ? vAzioni() : "";
  document.getElementById("sheet").innerHTML = st.sheet ? `<div class="sheet" data-act="chiudi-fuori"><div class="sheet-box" role="dialog" aria-modal="true">${vSheet()}</div></div>` : "";
  applicaRicerca();
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

function vChiaveErrata(){
  return `<div class="centro">
    <h1>Link non più valido</h1>
    <p class="muted">Questo link personale non funziona: forse è stato sostituito con uno nuovo.
      Cerca il più recente su WhatsApp o Telegram, oppure chiedi a Stefano e Alessia di mandartene uno nuovo.</p>
    ${formIncolla()}
  </div>`;
}

/* "Qualifica più alta raggiunta": Inizio, i pin (3%…21%) e le qualifiche Bronze/Argento.
   Primo ordine e primi clienti sono tappe del percorso, non qualifiche: non si dichiarano. */
function campiQualifica(obbligoData, scelta){
  scelta = scelta || {};
  const sel = v => v === (scelta.valore || "") ? " selected" : "";
  const qual = st.stages.filter(s => !TAPPE_DI_PERCORSO.includes(s.chiave))
    .map(s => `<option value="${esc(s.chiave)}"${sel(s.chiave)}>${esc(s.nome)}</option>`).join("");
  const pin = PIN.map(n => `<option value="pin:${n}"${sel("pin:" + n)}>${n}%</option>`).join("");
  const tappa = st.stages.find(s => s.chiave === scelta.valore);
  return `
      <label class="field"><span>Qualifica più alta raggiunta</span>
        <select name="qualifica"><option value=""${sel("")}>Inizio (nessuna qualifica)</option>
          <optgroup label="Percentuale raggiunta">${pin}</optgroup>
          <optgroup label="Qualifiche">${qual}</optgroup></select></label>
      <div data-mostra="pagamenti" ${tappa && tappa.pagamenti_max ? "" : "hidden"}>
        <label class="field"><span>Mese della prima qualifica</span>
          <input type="month" name="mese" max="${meseDi(oggi())}" value="${esc(scelta.mese || "")}"></label>
        <label class="field"><span>Pagamenti già ricevuti (su 12)</span>
          <input type="number" name="pagamenti" min="0" max="12" inputmode="numeric" value="" placeholder="${Number(scelta.pagamenti) || 0}" data-vuoto></label>
      </div>
      ${scelta.senzaData ? "" : `<label class="field"><span>Data di iscrizione ad Amway <i data-obbl>${obbligoData ? "(obbligatoria per chi inizia)" : "(facoltativa)"}</i></span>
        <input type="date" name="data" max="${oggi()}"></label>`}
      ${obbligoData ? `<p class="nota" style="margin-top:6px">Serve al conto alla rovescia dei 30 giorni per il primo ordine.</p>` : ""}`;
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
  const conPagamenti = !!(t && t.pagamenti_max);
  return { qualifica, percentuale, tappa:t, data: f.data ? f.data.value || null : null,
    mese: conPagamenti && f.mese.value ? f.mese.value + "-01" : null,
    pagamenti: conPagamenti ? Math.max(0, Math.min(12, Number(f.pagamenti.value) || 0)) : 0,
    mancaMese: conPagamenti && !f.mese.value };
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
      <p class="nota" style="margin-top:6px">È il numero del tuo accesso al sito Amway. Se il tuo sponsor ti ha già nella sua
        struttura, con il codice ritrovi il tuo profilo con i tuoi numeri.</p>
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
function vSelettore(){
  return `<div class="schede" role="tablist" aria-label="Pagina">
    <button role="tab" aria-selected="${st.vista === "obiettivo"}" class="${st.vista === "obiettivo" ? "on" : ""}" data-act="vista-obiettivo">Obiettivo</button>
    <button role="tab" aria-selected="${st.vista === "io"}" class="${st.vista === "io" ? "on" : ""}" data-act="vista-io">Io</button>
    <button role="tab" aria-selected="${st.vista === "persone"}" class="${st.vista === "persone" ? "on" : ""}" data-act="vista-persone">Persone</button>
    <button role="tab" aria-selected="${st.vista === "gruppo" || st.vista === "scheda"}" class="${st.vista === "gruppo" || st.vista === "scheda" ? "on" : ""}" data-act="vista-gruppo">Gruppo</button>
  </div>`;
}

/* In fondo a ogni pagina: link personale, privacy, uscita (prima stavano nel menu ⋯). */
/* Copia di sicurezza (solo admin): un file con tutti i dati, da scaricare una volta al mese e tenere su Google Drive */
function vCopiaDati(){
  const ultima = leggiLocale(CHIAVE_ULTIMA_COPIA), giorni = ultima ? giorniTra(ultima, oggi()) : null;
  return `<div class="copia-dati">
    <button class="btn small" data-act="copia-dati">Scarica la copia dei dati</button>
    <p class="nota" style="margin:6px 0 0">${ultima ? `Ultima copia da questo telefono: ${dataIt(ultima)}${giorni > 35 ? " · è passato più di un mese" : ""}.`
      : "Nessuna copia scaricata da questo telefono."} Una volta al mese, dopo la chiusura del giorno 5.</p>
  </div>`;
}
function vFondo(){
  return `<div class="fondo">
    <div class="row wrap" style="justify-content:center">
      <button class="btn small ghost" data-act="mia-chiave">Il mio link personale</button>
      <button class="btn small ghost" data-act="privacy">Privacy</button>
      ${puoInstallare() && leggiLocale(CHIAVE_INSTALLA_NO) === "1" ? `<button class="btn small ghost" data-act="installa-si">Installa l'app</button>` : ""}
      <button class="btn small ghost" data-act="esci">Esci</button>
    </div>
    ${st.profilo.is_admin ? vCopiaDati() : ""}
    <p class="nota" style="text-align:center">${esc(st.profilo.nome)} · codice d'invito <b>${esc(st.profilo.codice_invito)}</b><br>
      ${st.profilo.codice_amway ? `Codice Amway Partner <b>${esc(st.profilo.codice_amway)}</b>` : "Codice Amway Partner non ancora scritto"}
      ${st.profilo.is_admin ? `<button class="btn link small" data-act="codice" data-id="${esc(st.profilo.id)}" style="min-height:0;padding:0 4px">Correggi</button>` : ""}<br>
      Punto di partenza <b>${esc(testoPartenza(st.profilo))}</b>
      <button class="btn link small" data-act="partenza" style="min-height:0;padding:0 4px">Modifica</button><br>
      Per cancellare il profilo e i tuoi dati scrivi a Stefano e Alessia.</p>
  </div>`;
}

function vHome(){
  const p = st.profilo;
  const gruppo = st.vista === "gruppo" || st.vista === "scheda";
  const persone = alberoSotto(p.id, 0).length;
  if(st.vista === "persone") return `
  <div class="testata">
    <div>${marchio()}<h1>${st.invitoId ? "Target" : st.personaId ? (st.sezPersone === "clienti" ? "I miei clienti" : "La mia lista") : "Persone"}</h1></div>
    ${vSelettore()}
  </div>
  ${vPersone()}
  ${vFondo()}`;
  if(st.vista === "obiettivo") return `
  <div class="testata">
    <div>${marchio()}<h1>Il mio obiettivo</h1></div>
    ${vSelettore()}
  </div>
  ${vObiettivo()}
  ${vFondo()}`;
  return `
  <div class="testata">
    <div>${marchio()}<h1>${st.vista === "scheda" ? "Scheda partner" : gruppo ? "Il mio gruppo" : `Ciao ${esc(nomeSaluto(p.nome))}`}</h1>
      ${st.vista === "gruppo" ? `<p class="small" style="margin:0">${persone === 1 ? "1 persona" : `${num(persone)} persone`}</p>` : ""}</div>
    ${vSelettore()}
  </div>
  ${st.vista === "scheda" ? vScheda() : gruppo ? `
  ${vPreferiti()}
  ${vStruttura()}
  ${vStoricoGruppo()}
  ${vInvita()}` : `
  ${leggiLocale(CHIAVE_SALVATA) === "1" || !st.chiave ? "" : vSalvaChiave()}
  ${vInstalla()}
  ${vObiettivoBreve()}
  ${vDaFare()}
  ${vClientiDaSentire()}
  ${vTappa()}
  ${vSettimana()}
  ${vMese()}
  ${vOggi()}`}
  ${vFondo()}`;
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
function vInstalla(){
  if(!puoInstallare() || leggiLocale(CHIAVE_SALVATA) !== "1" || leggiLocale(CHIAVE_INSTALLA_NO) === "1") return "";
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
  return `<div class="card">
    <span class="eyebrow">Consigliato</span>
    <h2 style="margin-top:4px">Installa Growup sul telefono</h2>
    <p class="small" style="margin:6px 0 0">Avrai l'icona sulla Home e l'app a schermo intero, senza la barra del browser.</p>
    ${corpo}
  </div>`;
}

function vSalvaChiave(){
  return `<div class="card" style="border-color:var(--accent)">
    <span class="eyebrow">Importante · una volta sola</span>
    <h2 style="margin-top:4px">Salva il tuo link personale</h2>
    <p class="small" style="margin:6px 0 0">È la tua chiave: con questo link rientri da qualsiasi telefono o computer.
      Mandalo <b>a te stesso</b>: su WhatsApp scegli la chat con te stesso, su Telegram i «Messaggi salvati».
      Non inoltrarlo a nessuno.</p>
    ${bottoniChiave()}
    <button class="btn wide primary" style="margin-top:10px" data-act="chiave-salvata">Fatto, l'ho salvato</button>
  </div>`;
}

/* ---- Il primo obiettivo: cifra al mese, entro quando, perché ---- */
/* la prima tappa dal Path to Bronze in su che vale almeno la cifra (oltre Argento: Argento) */
function tappaPerCifra(cifra){
  const t = st.stages.filter(s => s.ordine >= 3 && Number(s.guadagno_mese) > 0).sort((a, b) => a.ordine - b.ordine);
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
  const o = st.obiettiviGruppo.get(pid);
  if(!o) return "Obiettivo: non ancora scritto";
  const t = tappaPerCifra(o.cifra_mese);
  return `Obiettivo: <b>${euro(o.cifra_mese)}/mese</b> ${esc(testoTraguardo(o.entro))}${t ? ` · ${esc(t.tappa.nome)}` : ""}`;
}
function vObiettivoBreve(){
  const o = st.obiettivo;
  if(!o) return `<div class="card tight visione">
    <span class="eyebrow">Il mio obiettivo</span>
    <h2 style="margin-top:2px">Quanto vorresti guadagnare al mese?</h2>
    <p class="small" style="margin:4px 0 0">Scrivi la cifra e per quando: l'app ti mostra la tappa che la vale e il percorso per arrivarci.</p>
    <button class="btn wide" style="margin-top:12px" data-act="obiettivo-modifica">Scrivi il tuo obiettivo</button>
  </div>`;
  const t = tappaPerCifra(o.cifra_mese);
  return `<div class="card tight visione obiettivo-breve" data-act="vista-obiettivo" role="button" tabindex="0">
    <span class="eyebrow">Il mio obiettivo</span>
    <div class="spread" style="margin-top:2px"><h2><span class="num">${euro(o.cifra_mese)}</span> al mese</h2><span class="small">›</span></div>
    <p class="small" style="margin:2px 0 0">${esc(testoTraguardo(o.entro))}</p>
    ${t ? `<p class="small" style="margin:6px 0 0">Tappa: <b>${esc(t.tappa.nome)}</b>${t.oltre ? " e oltre" : ""}</p>` : ""}
  </div>`;
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
  </div>${vVisione()}`;
  const t = tappaPerCifra(o.cifra_mese), S = st.stages, { indice } = percorso();
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
    ${t.oltre ? `<p class="small" style="margin:4px 0 0">La tua cifra è oltre Argento: Argento vale circa ${euro(t.tappa.guadagno_mese)} al mese.</p>` : ""}
    ${t.tappa.struttura_calcolo ? `<p class="small" style="margin:4px 0 0">Calcolato su: ${esc(t.tappa.struttura_calcolo)}</p>` : ""}
    <p class="small" style="margin:8px 0 0">${giaFatto ? "Hai già raggiunto questa tappa." : mancano === 1 ? "È la tua tappa attuale." : `Da qui: ${mancano} tappe, compresa quella attuale.`}</p>
    <p class="nota">* ${notaGuadagni()}</p>
  </div>
  <div class="card">
    <span class="eyebrow">Il percorso fino all'obiettivo</span>
    <ol class="percorso">${S.slice(0, Math.max(fino, indice - 1) + 1).map((s, i) => {
      const stato = i < indice ? "fatta" : i === indice ? "attuale" : "dopo";
      const req = stato === "attuale" ? requisiti(s) : [];
      return `<li class="${stato}${i === fino ? " meta" : ""}">
        <span class="mark">${stato === "fatta" ? "✓" : i + 1}</span>
        <div class="grow"><b>${esc(s.nome)}</b>${i === fino ? ` <span class="pill s">obiettivo</span>` : ""}
          ${stato === "attuale" ? `<span class="pill">tappa attuale</span>` : ""}
          ${s.guadagno_mese ? `<span class="small"> · ${euro(s.guadagno_mese)}/mese*</span>` : ""}
          ${stato === "attuale" ? `<ul class="req">${req.map(r => `<li class="${r.ok ? "ok" : ""}"><span class="mark">${r.ok ? "✓" : "○"}</span>
              <span class="grow">${esc(r.txt)}</span>${r.val ? `<span class="num">${esc(r.val)}</span>` : ""}</li>`).join("")}</ul>`
            : stato === "dopo" ? `<p class="small" style="margin:2px 0 0">${esc(requisitiTesto(s))}</p>` : ""}</div></li>`; }).join("")}</ol>
  </div>` : ""}
  ${vVisione()}`;
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

function vTappa(){
  const { raggiunta, attuale, indice } = percorso();
  const pag = pagamenti(raggiunta);
  if(!attuale){
    return `<div class="card"><span class="eyebrow">Il tuo percorso</span><h2 style="margin-top:4px">Argento raggiunto 🎉</h2>
      <p class="muted">Hai completato il percorso. Ora l'obiettivo è aiutare le tue linee a fare lo stesso.</p></div>`;
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
  const conLinee = attuale.ordine >= 3;
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
  return `<div class="card">
    <div class="spread"><span class="eyebrow">Tappa ${indice + 1} di ${st.stages.length}</span>
      <span class="row" style="gap:6px;flex-wrap:wrap;justify-content:flex-end">
      ${n.percentuale ? `<span class="pill s">${n.percentuale}% questo mese</span>` : ""}
      ${n.daReport ? `<span class="pill">dal report Amway</span>` : ""}
      ${pinMax && pinMax > (n.percentuale || 0) ? `<span class="pill">${pinMax}% raggiunto</span>` : ""}
      ${raggiunta ? `<span class="pill v">✓ ${esc(raggiunta.nome)}</span>` : ""}</span></div>
    <h2 style="margin-top:4px">${esc(attuale.nome)}</h2>
    ${attuale.guadagno_mese ? `<p class="small" style="margin:2px 0 0">Circa ${euro(attuale.guadagno_mese)} al mese* con ${esc(attuale.struttura_calcolo || "")}</p>` : ""}
    ${scadenza}
    <ul class="req">${req.map(r => `<li class="${r.ok ? "ok" : ""} ${r.attesa ? "attesa" : ""}">
      <span class="mark">${r.ok ? "✓" : r.attesa ? "·" : "○"}</span>
      <span class="grow">${esc(r.txt)}${r.cliente ? ` <button class="btn link small" data-act="cliente" style="min-height:0">+ Cliente</button>` : ""}</span>
      ${r.val ? `<span class="num">${esc(r.val)}</span>` : ""}</li>`).join("")}</ul>
    ${distinti}
    ${linee}
    ${terza}
    ${pag ? `<p class="small" style="margin-top:8px">${esc(raggiunta.nome)}: ${esc(pag)}</p>` : ""}
    ${nelMese ? `<p class="nota">Tutti i requisiti valgono nello stesso mese di calendario (${nomeMese(meseDi(oggi()))}).</p>` : ""}
    ${attuale.guadagno_mese ? `<p class="nota">* ${notaGuadagni()}</p>` : ""}
  </div>`;
}

function barra(nome, fatto, obj){
  obj = Number(obj) || 0;
  const pct = obj ? Math.min(100, Math.round(fatto / obj * 100)) : 0;
  return `<div class="obiettivo"><div class="spread"><span>${nome}</span>
    <span class="num">${num(fatto)} <span class="faint">/ ${num(obj)}</span></span></div>
    <div class="bar ${obj && fatto >= obj ? "fatto" : ""}" role="progressbar" aria-label="${nome}" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div></div>`;
}

function vSettimana(){
  const g = st.goal;
  return `<div class="card">
    <div class="spread"><div><span class="eyebrow">La mia settimana</span>
      <h2 style="margin-top:2px">${dataIt(settimana())} – ${dataIt(piuGiorni(settimana(), 6))}</h2></div>
      <button class="btn small ghost" data-act="obiettivi">Modifica</button></div>
    ${g.salvato && st.goalMese.salvato ? "" : `<p class="small" style="margin:8px 0 0">Ti proponiamo questi obiettivi per iniziare. Vanno bene?
      <button class="btn link small" data-act="conferma-obiettivi">Sì, confermo</button></p>`}
    <div style="margin-top:12px">
      ${barra("Nuovi contatti", fattoSettimana("contatto"), g.obiettivo_contatti)}
      ${barra("Piani mostrati", fattoSettimana("piano"), g.obiettivo_piani)}
    </div>
  </div>`;
}

function vMese(){
  const m = meseDi(oggi());
  const c = clientiMese(m);
  const primiFatti = clientiTotali() >= 3;
  return `<div class="card">
    <div class="spread"><div><span class="eyebrow">Il mio mese</span>
      <h2 style="margin-top:2px">${nomeMese(m).replace(/^./, x => x.toUpperCase())}</h2></div>
      <span class="row" style="gap:6px"><button class="btn small ghost" data-act="storico">Storico</button>
      <button class="btn small ghost" data-act="obiettivo-mese">Obiettivo</button></span></div>
    <div style="margin-top:12px">${barra("VP fatturati", vpMese(m), st.goalMese.obiettivo_vp)}</div>
    <div class="row" style="margin-top:10px;gap:8px">
      <button class="btn small grow" data-act="ordine">+ Ordine</button>
      <button class="btn small grow" data-act="totale-mese">Aggiorna il totale</button>
    </div>
    <button class="btn small wide" style="margin-top:8px" data-act="importa">Importa dal report Amway</button>
    <p class="small" style="margin:6px 0 0">Registra ogni ordine, oppure scrivi il totale del mese (per esempio dall'ufficio virtuale Amway),
      oppure importa il file CSV della tua linea scaricato dal sito Amway.
      ${precedenteAperto() ? `Fino al ${giornoChiusura()} puoi ancora correggere ${nomeMese(mesePrecedente()).split(" ")[0]}.` : ""}</p>
    ${(() => { const n = numeriMese(m); return n.gruppo > n.personali || n.linee.length
      ? `<div class="spread" style="margin-top:12px"><span>VP di gruppo</span><b class="num">${num(n.gruppo)}</b></div>` : ""; })()}
    <div class="spread" style="margin-top:12px">
      <span>Nuovi clienti nel mese <b class="num">${num(c)}</b></span>
      <button class="btn small" data-act="cliente" style="white-space:nowrap">+ Cliente</button>
    </div>
    ${primiFatti ? "" : `<p class="small" style="margin:4px 0 0">I tuoi primi 3 clienti (anche in mesi diversi) completano la tappa «Primi clienti»: ${num(clientiTotali())} su 3.</p>`}
  </div>`;
}

/* Storico: i mesi chiusi (congelati il giorno 5) e quelli ancora aperti, dal più recente */
function vStorico(){
  const nome = chiave => { const t = st.stages.find(x => x.chiave === chiave); return t ? t.nome : ""; };
  const righe = st.storico.map(r => ({ mese:meseDi(r.mese), personali:Number(r.vp_personali), gruppo:Number(r.vp_gruppo),
    attive:r.linee_attive, pct:r.percentuale, qual:nome(r.qualifica), aperto:false }));
  const aperti = [meseDi(oggi())].concat(precedenteAperto() && !righe.some(r => r.mese === mesePrecedente()) ? [mesePrecedente()] : []);
  for(const m of aperti){
    const n = numeriMese(m);
    const q = st.stages.filter(t => t.ordine >= 3 && !mancanze(t, n).length).pop();
    righe.push({ mese:m, personali:n.personali, gruppo:n.gruppo, attive:n.attive, pct:n.percentuale, qual:q ? q.nome : "", aperto:true });
  }
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
    <span class="eyebrow">Storico del gruppo</span>
    ${righe.length ? `<table class="confronto mesi">
      <thead><tr><th></th><th>VP di gruppo</th><th>Linee</th><th>%</th></tr></thead>
      <tbody>${righe.map(r => `<tr data-act="mese-gruppo" data-mese="${r.mese}"><td><button class="btn link" data-act="mese-gruppo" data-mese="${r.mese}">${nomeMese(r.mese).replace(/^./, c => c.toUpperCase())}</button></td>
        <td class="num">${num(r.gruppo)}</td><td class="num">${r.attive}</td><td class="num">${r.pct ? r.pct + "%" : "–"}</td></tr>`).join("")}</tbody>
    </table>
    <p class="nota">Mesi chiusi, i tuoi totali. Tocca un mese per vedere ogni persona del gruppo.</p>`
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
function vOggi(){
  const l = st.att.filter(a => a.data === oggi()).slice().reverse();
  return `<div class="card">
    <div class="spread"><span class="eyebrow">Oggi</span><span class="small">${dataIt(oggi())}</span></div>
    ${l.length ? `<ul class="oggi">${l.map(a => `<li>
      <span class="grow">${ETICHETTE[a.tipo]}${a.tipo === "ordine" ? ` · <b>${num(a.vp)} VP</b>` : a.tipo === "rettifica" ? ` · <b>${vpFirmati(a.vp)} VP</b>` : a.quantita > 1 ? ` × ${a.quantita}` : ""}</span>
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
    <div class="spread"><span class="eyebrow">La mia struttura</span>
      <button class="btn small" data-act="importa">Importa dal report Amway</button></div>
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
      ${completa ? (nascosta ? `<button class="btn small" data-act="mostra" data-id="${esc(p.id)}">Mostra</button>`
        : `<button class="btn small ghost" data-act="nascondi-qui" data-id="${esc(p.id)}">Nascondi</button>`)
        : `<span class="pill ${sp.cl}">${sp.txt}</span>`}</li>`; }).join("")}</ul>
      <p class="nota">Il numero è il livello, come nei report Amway: 1 sei tu, 2 i tuoi frontali, 3 i loro, e così via.
        ▾ chiude o riapre il gruppo di una persona.
        Tocca un nome per aprire la sua scheda.</p>
      <p class="small" style="margin:6px 0 0">${nascoste ? plur(nascoste, "persona nascosta", "persone nascoste") : "Nessuna persona nascosta"}
        <button class="btn link small" data-act="nascoste" style="min-height:0;padding:0 4px">${nascoste ? "Rivedi" : "Scegli chi nascondere"}</button></p>
      ${nascoste ? `<button class="btn small ghost${completa ? " on" : ""}" data-act="con-nascoste" aria-pressed="${!!completa}" style="margin-top:8px">
        ${completa ? "Torna alla mia struttura" : "Mostra anche le nascoste"}</button>
        ${completa ? `<p class="nota">Le nascoste sono in grigio, al loro posto. I gruppi partono chiusi: ▸ apre il gruppo di una persona.
          Mostra o Nascondi su ogni riga.</p>` : ""}` : ""}`
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
/* I numeri di una persona nelle ultime 4 settimane */
function numeri4(pid){
  const dal = inizio4();
  const l = st.gruppo4.att.filter(a => a.partner_id === pid && a.data >= dal);
  const q = tipo => somma(l.filter(a => a.tipo === tipo), "quantita");
  const ultima = l.reduce((m, a) => a.data > m ? a.data : m, "");
  return { contatti:q("contatto"), piani:q("piano"), ordini:q("ordine"),
           vp:somma(l.filter(a => a.tipo === "ordine" || a.tipo === "rettifica"), "vp"), ultima };
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
    </li>` };
  }).sort((a, b) => a.ordine - b.ordine || a.p.nome.localeCompare(b.p.nome));
  return `<div class="card">
    <div class="spread"><span class="eyebrow">Preferiti</span><span class="small">${l.length === 1 ? "1 persona" : `${l.length} persone`}</span></div>
    <ul class="preferiti">${schede.map(x => x.html).join("")}</ul>
    <p class="nota">Contatti e piani delle ultime 4 settimane rispetto al loro obiettivo settimanale × 4; VP del mese rispetto
      al loro obiettivo del mese. Evidenziata la parte sotto soglia. Per togliere una persona: ★ nella sua scheda.</p>
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
    { nome:"Ordini", ora:ora.ordini, allora:allora.ordini, prima:prima.ordini },
    { nome:"Nuovi clienti", ora:ora.clienti, allora:allora.clienti, prima:prima.clienti },
    { nome:"VP personali", ora:ora.vp, allora:allora.vp, prima: rp.vp_personali != null ? Number(rp.vp_personali) : prima.vp },
    { nome:"VP di gruppo", ora:Number(r.vp_gruppo) || 0, allora:null, prima:Number(rp.vp_gruppo) || 0 },
    { nome:"Linee attive", ora:Number(r.linee_attive) || 0, allora:null, prima:Number(rp.linee_attive) || 0 }
  ]};
}
function vConfronto(p){
  const c = confrontoMese(p.id);
  const breve = m => MESI[Number(m.slice(5, 7)) - 1].slice(0, 3);
  const cella = (v, rif) => rif != null && v < rif ? `<td class="num sotto">▼ ${num(v)}</td>` : `<td class="num">${num(v)}</td>`;
  return `<div class="card">
    <span class="eyebrow">Questo mese e il mese prima</span>
    <table class="confronto">
      <thead><tr><th></th><th>${breve(c.m)}<br><span>fino a oggi</span></th><th>${breve(c.mp)}<br><span>al ${Number(c.stessoGiorno.slice(8))}</span></th><th>${breve(c.mp)}<br><span>totale</span></th></tr></thead>
      <tbody>${c.righe.map(x => `<tr><td>${x.nome}</td>${cella(x.ora, x.allora)}
        <td class="num faint">${x.allora == null ? "–" : num(x.allora)}</td><td class="num faint">${num(x.prima)}</td></tr>`).join("")}</tbody>
    </table>
    <p class="nota">▼ in rosso: sotto il mese prima allo stesso giorno. VP di gruppo e linee attive del mese prima ci sono solo come totale.</p>
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
  const frontali = st.riep.filter(x => x.sponsor_id === p.id);
  return `<button class="btn link" data-act="vista-gruppo" style="padding:0">‹ Il mio gruppo</button>
  <div class="card">
    <div class="spread"><h2>${esc(p.nome)}</h2><span class="row" style="gap:8px">
      <button class="stella${st.preferiti.has(p.id) ? " on" : ""}" data-act="preferito" data-id="${esc(p.id)}" aria-pressed="${st.preferiti.has(p.id)}"
        aria-label="${st.preferiti.has(p.id) ? "Togli dai preferiti" : "Aggiungi ai preferiti"}" title="Preferiti">${st.preferiti.has(p.id) ? "★" : "☆"}</button>
      <span class="pill ${sp.cl}">${sp.txt}</span></span></div>
    <p class="small" style="margin:2px 0 0">${gestito ? "importata da te dal report Amway: la vedi solo tu, i suoi numeri li aggiorni tu"
      : sp.g === 0 ? "ha aggiornato oggi" : `ultimo aggiornamento ${plur(sp.g, "giorno", "giorni")} fa`}</p>
    ${p.stato === "gestito" ? "" : `<p class="small" style="margin:6px 0 0">${rigaObiettivoDi(p.id)}</p>`}
    <p class="small" style="margin:6px 0 0">${p.codice_amway ? `Codice Amway <b>${esc(p.codice_amway)}</b>` : "Codice Amway non scritto"}
      ${st.profilo.is_admin && !gestito ? `<button class="btn link small" data-act="codice" data-id="${esc(p.id)}" style="min-height:0;padding:0 4px">Correggi</button>` : ""}</p>
    <div class="dati-scheda">
      <div><span class="small">VP personali</span><b class="num">${num(r.vp_personali)}</b></div>
      <div><span class="small">VP di gruppo</span><b class="num">${num(r.vp_gruppo)}</b></div>
      <div><span class="small">Linee attive</span><b class="num">${r.linee_attive || 0}</b></div>
      <div><span class="small">Percentuale</span><b class="num">${r.percentuale ? r.percentuale + "%" : "–"}</b></div>
    </div>
    ${r.da_report ? `<p class="nota" style="margin:6px 0 0">VP di gruppo, linee e percentuale dal report Amway${r.linee_nascoste
      ? ". Linee non visibili nel report (il suo gruppo Amway non lo mostra): la qualifica non può contarle" : ""}.</p>` : ""}
    ${(() => { const l = r.da_report ? lineeReport(r) : frontali.map(x => ({ nome:nomeDi(x.partner_id), vp:Number(x.vp_gruppo) }));
      return l.length ? `<ul class="linee">${l.map(x => `<li><span class="grow">${esc(x.nome)}</span>
      <span class="num ${x.vp >= soglia() ? "" : "faint"}">${num(x.vp)} VP</span></li>`).join("")}</ul>` : ""; })()}
    <p class="small" style="margin:10px 0 0">Punto di partenza dichiarato: <b>${esc(testoPartenza(p))}</b></p>
    ${gestito ? "" : vNumeriLista(p.id)}
    <button class="btn wide" style="margin-top:12px" data-act="chiamata" data-id="${esc(p.id)}">Fissa una chiamata</button>
  </div>
  ${vConfronto(p)}
  ${gestito ? `<div class="card">
    <span class="eyebrow">I suoi numeri · ${nomeMese(m)}</span>
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
    <p class="nota">Se vuole usare l'app, mandale il tuo link d'invito: scrivendo il suo codice Amway ritrova il suo profilo
      e da lì i suoi numeri li aggiorna lei.</p>
  </div>` : `<div class="card">
    <p class="small" style="margin:0">Usa l'app: i suoi numeri li aggiorna lui.</p>
    ${st.profilo.is_admin ? `<button class="btn wide" style="margin-top:12px" data-act="nuovo-link" data-id="${esc(p.id)}">Nuovo link personale</button>
      <p class="nota">Solo per chi ha perso il suo link: quello vecchio smette di funzionare e i suoi telefoni vanno ricollegati.</p>` : ""}
  </div>`}
  ${st.profilo.is_admin ? vInvitiAdmin(p) : ""}
  <div class="card">
    <span class="eyebrow">Struttura</span>
    ${p.fuori_report_dal ? `<p class="small" style="margin:6px 0 0"><span class="pill g">non più nel report</span> da ${nomeMese(meseDi(p.fuori_report_dal))}</p>` : ""}
    ${st.nascosti.has(p.id)
      ? `<button class="btn wide" style="margin-top:10px" data-act="mostra" data-id="${esc(p.id)}">Mostra di nuovo nella mia struttura</button>`
      : `<button class="btn wide" style="margin-top:10px" data-act="nascondi" data-id="${esc(p.id)}">Nascondi dalla mia struttura</button>`}
    <p class="nota">Nascosta sparisce solo per te, e solo lei: chi sta sotto di lei resta visibile. I suoi VP contano lo stesso
      nei numeri personali e di gruppo.
      La rimetti quando vuoi da «Nascoste». Nell'app nessuno si cancella: la struttura rispecchia il report Amway.</p>
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
    ${p.codice_invito ? bottoniLink(base() + "#" + p.codice_invito) : ""}
    <button class="btn wide" style="margin-top:12px" data-act="invito-sopra" data-id="${esc(p.id)}">Invita chi manca sopra di ${esc(nomeSaluto(p.nome))}</button>
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
    <button class="btn primary c1" data-act="contatto">+ Contatto<b>${num(fattoSettimana("contatto"))} questa sett.</b></button>
    <button class="btn primary c2" data-act="piano">+ Piano<b>${num(fattoSettimana("piano"))} questa sett.</b></button>
    <button class="btn primary c3" data-act="ordine">+ Ordine<b>${num(vpMese(meseDi(oggi())))} VP nel mese</b></button>
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
  if(m !== meseDi(oggi()) && !(m === mesePrecedente() && precedenteAperto()))
    return { errore: m > meseDi(oggi()) ? `Il report è di ${nomeMese(m)}, un mese che non è ancora iniziato.`
      : `Il report è di ${nomeMese(m)}: nell'app quel mese è già chiuso (si chiude il giorno ${giornoChiusura()} del mese dopo). Scarica il report del mese in corso.` };
  const prima = rep.righe.find(r => r.livello === 1) || rep.righe[0];
  if(io.codice_amway && io.codice_amway !== prima.codice)
    return { errore:`Questo report è di ${prima.nome} (${prima.codice}), ma il tuo codice nell'app è ${io.codice_amway}. `
      + `Ognuno importa il report scaricato dal proprio accesso al sito Amway. Se il report è tuo, il codice nell'app è sbagliato: `
      + (io.is_admin ? "correggilo in fondo alla pagina Io." : "chiedi a Stefano e Alessia di correggerlo.") };
  const perCodice = new Map(rep.righe.map(r => [r.codice, r]));
  const altri = alberoSotto(io.id, 0).map(x => x.p);
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
  for(const p of mie){
    const r = p.codice_amway ? perCodice.get(p.codice_amway) : null;
    if(r){ a.aggiorna.push({ p, r }); usati.add(r.codice); }
    else if(p.codice_amway && !p.fuori_report_dal) a.mancanti.push(p);
  }
  /* l'import è sempre completo: tutte le persone del report entrano nella mia struttura */
  for(const r of rep.righe) if(!usati.has(r.codice)) a.nuovi.push(r);
  /* chi usa l'app va sotto il primo antenato del report che usa l'app (o sotto di me) */
  for(const { p, r } of a.usanoApp){
    const sopra = antenatoNelReport(r, perCodice, c => c === prima.codice || attivi.has(c));
    const nuovo = !sopra || sopra === prima.codice ? io.id : attivi.get(sopra).id;
    if(nuovo !== p.sponsor_id && !alberoSotto(p.id, 0).some(x => x.p.id === nuovo))
      a.spostati.push({ p, da:p.sponsor_id === io.id ? "te" : nomeDi(p.sponsor_id), a:nuovo === io.id ? "te" : nomeDi(nuovo) });
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
    <p class="small">Tutta la tua linea entra nell'app; chi non la usa lo vedi solo tu, e puoi nascondere chi vuoi (resta nei numeri).
      L'app aggiorna i VPP del mese tuoi e delle persone importate; chi usa l'app non viene toccato, i suoi numeri li aggiorna lui.
      Il file resta sul telefono: si salvano solo nome, codice e numeri.</p>
    <label class="btn primary wide" style="margin-top:12px">Scegli il file CSV
      <input type="file" id="file-report" accept=".csv,text/csv,text/comma-separated-values" hidden></label>
    ${a && a.errore ? `<p class="errore">${esc(a.errore)}</p>` : ""}
    ${chiudi}`;
  const riga = (p, extra) => `<span class="grow">${esc(p.nome)}${extra ? `<br><span class="small">${extra}</span>` : ""}</span>`;
  const sezione = (titolo, corpo, nota, cl) => `<div class="imp-sezione${cl ? " " + cl : ""}"><h3>${titolo}</h3>${nota ? `<p class="small">${nota}</p>` : ""}${corpo}</div>`;
  const sponsorDi = r => { const s = a.perCodice.get(r.sponsor); return s ? `sponsor ${esc(s.nome)}` : ""; };
  const scelta = r => `<label data-nome="${esc(senzaAccenti(r.nome) + " " + r.codice)}"><input type="checkbox" name="nascondi" value="${esc(r.codice)}" data-vpp="${r.vpp > 0 ? 1 : 0}"${st.esclusi.has(r.codice) ? " checked" : ""}>
      <span>${esc(r.nome)} · <b>${num(r.vpp)} VP</b><br><span class="small">${esc(r.codice)}${sponsorDi(r) ? " · " + sponsorDi(r) : ""}</span></span></label>`;
  const aggiorna = [{ p:st.profilo, r:a.prima, io:true }].concat(a.aggiorna);
  const pos = posizioni(); [...pos.values()].forEach((x, i) => { x.ordine = i; });
  return `<h2>Report di ${nomeMese(a.mese)}</h2>
  <p class="small">${plur(a.totale, "persona", "persone")} nel file${a.mese === meseDi(oggi()) ? " · mese in corso: puoi reimportarlo quando vuoi, i valori si sostituiscono" : ""}.</p>
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
    ${sezione(`Si aggiornano i VPP · ${aggiorna.length}`, `<ul class="imp">${aggiorna.map(x => `<li>${riga(x.io ? { nome:`${st.profilo.nome} (tu)` } : x.p,
        x.io && a.codiceMio ? `il tuo codice ${esc(x.r.codice)} viene salvato` : "")}<b class="num">${num(x.r.vpp)} VP</b></li>`).join("")}</ul>`)}
    ${a.mancanti.length ? sezione(`Non più nel report · ${a.mancanti.length}`,
      `${a.troppiMancanti ? `<p class="avviso">Mancano molte persone insieme: controlla di aver esportato <b>l'intera linea senza filtri</b>.</p>` : ""}
      <p class="small">${a.mancanti.map(p => `${esc(p.nome)} (${esc(p.codice_amway)})`).join(", ")}</p>`,
      "Codici che Amway non ha più (per esempio non rinnovati). Nessuno si cancella: restano nella tua struttura con il segno «non più nel report» e vanno tra le nascoste. Se tornano nel report, il segno sparisce.") : ""}
    ${a.usanoApp.length || a.usanoAppMancanti.length ? sezione("Usano l'app: i loro numeri li aggiornano loro",
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

async function leggiFileReport(file){
  if(!file) return;
  let a;
  if(/\.xlsx?$/i.test(file.name)) a = { errore:"Questo è il file Excel: sul sito Amway scegli il formato CSV." };
  else{
    try{
      const rep = leggiReport(await file.text());
      if(!rep.errore) try{ st.esclusi = new Set((await api.esclusi() || []).map(x => x.codice)); }catch(e){}
      a = rep.errore ? rep : analizzaReport(rep);
    }catch(e){ a = { errore:"Non riesco a leggere il file: scaricalo di nuovo dal sito Amway." }; }
  }
  st.imp = a; render();
}

async function eseguiImport(f){
  const a = st.imp, io = st.profilo;
  const scelti = nome => new Set([...f.querySelectorAll(`input[name=${nome}]:checked`)].map(i => i.value));
  const nascondi = scelti("nascondi");
  /* "Riapplica i filtri": chi c'è già si nasconde o si rimette secondo le caselle; "Lascia tutto com'è": nessun cambio */
  const filtri = !!f.querySelector("input[name=modo][value=filtri]:checked"), voglio = scelti("nascondi-es");
  const elencati = filtri ? [...f.querySelectorAll("input[name=nascondi-es]")].map(i => i.value) : [];
  const daNascondere = elencati.filter(id => voglio.has(id) && !st.nascosti.has(id));
  const daMostrare = elencati.filter(id => !voglio.has(id) && st.nascosti.has(id));
  if(a.nuovi.length && !f.consenso.checked){ mostraErroreForm(f, "Conferma di avere il consenso delle persone della tua linea."); return; }
  /* l'import è completo: le mie persone sono quelle già importate più tutte le nuove */
  const mie = a.aggiorna.map(x => x.r).concat(a.nuovi);
  /* i numeri ufficiali di ognuno: VPP, VPG, percentuale e i VPG delle sue linee frontali del report
     (se il report non mostra il suo gruppo, come per i Platino, le linee sono "nascoste") */
  const figliReport = new Map();
  for(const r of a.perCodice.values()) if(r.sponsor) figliReport.set(r.sponsor, (figliReport.get(r.sponsor) || []).concat([r]));
  const numeri = r => r.vpg == null ? {} : { vpg:r.vpg, percentuale:r.perc,
    linee:(figliReport.get(r.codice) || []).map(x => ({ codice:x.codice, vpg:x.vpg || 0 })),
    nascoste:!figliReport.has(r.codice) && r.dimensione > 1 };
  const codiciMie = new Set(mie.map(r => r.codice));
  const attivi = new Set(a.usanoApp.map(x => x.r.codice));
  const profondita = r => { let n = 0; for(let c = r.sponsor; c && a.perCodice.has(c) && n < 200; c = a.perCodice.get(c).sponsor) n++; return n; };
  const persone = mie.slice().sort((x, y) => profondita(x) - profondita(y)).map(r => Object.assign({ codice:r.codice, nome:r.nome, vpp:r.vpp,
    sponsor:antenatoNelReport(r, a.perCodice, c => c === a.prima.codice || attivi.has(c) || codiciMie.has(c)) }, numeri(r)));
  const usanoApp = a.usanoApp.map(({ r }) => Object.assign({ codice:r.codice, vpp:r.vpp,
    sponsor:antenatoNelReport(r, a.perCodice, c => c === a.prima.codice || attivi.has(c)) }, numeri(r)));
  st.occupato = true;
  try{
    const esito = await api.importaRete({ p_mese:a.mese + "-01", p_io:Object.assign({ codice:a.prima.codice, vpp:a.prima.vpp }, numeri(a.prima)), p_persone:persone,
      p_attivi:usanoApp, p_nascondi:[...nascondi], p_fuori:a.mancanti.map(p => p.id) }) || {};
    if(a.codiceMio) st.profilo = Object.assign({}, io, { codice_amway:a.prima.codice });
    if(daNascondere.length) await api.nascondiTanti(io.id, daNascondere);
    if(daMostrare.length) await api.mostraTanti(io.id, daMostrare);
    await caricaStruttura();
    st.att = await api.activities(io.id, [settimana(), primoDelMese()].sort()[0]) || [];
    await caricaNumeri();
    st.sheet = null; st.imp = null; st.occupato = false; render();
    const n = k => Number(esito[k]) || 0;
    toast(`Import di ${nomeMese(a.mese).split(" ")[0]}: ${[n("aggiunte") ? plur(n("aggiunte"), "persona aggiunta", "persone aggiunte") : "",
      plur(n("aggiornati"), "VPP aggiornato", "VPP aggiornati"), n("spostate") ? plur(n("spostate"), "spostata", "spostate") : "",
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
  const sp = vSheetPersone(s) || vSheetTarget(s) || vSheetClienti(s);
  if(sp) return sp;
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
      L'app registra solo la differenza con quanto è già inserito (${num(vpMese(m, lista()))} VP).</p>
    <form data-form="totale-mese" novalidate>
      ${scelta}
      <label class="field"><span>Totale VP del mese</span>
        <input name="vp" type="text" inputmode="decimal" autocomplete="off" autofocus value="" placeholder="${num(vpMese(m, lista()))}" data-vuoto></label>
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
    <p class="small">VP fatturati in ${nomeMese(meseDi(oggi()))}. Il mese prossimo riparte da questo.</p>
    <form data-form="obiettivo-mese" novalidate>
      <label class="field"><span>VP fatturati nel mese</span><input name="vp" type="text" inputmode="decimal" autocomplete="off" value="" placeholder="${num(st.goalMese.obiettivo_vp)}" data-vuoto></label>
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
  if(s === "partenza"){
    const p = st.profilo;
    return `<h2>Il mio punto di partenza</h2>
    <p class="small">Hai dichiarato: <b>${esc(testoPartenza(p))}</b>. Se non è giusto, correggilo: è una tua responsabilità
      e nessuno lo conferma al posto tuo. I numeri del mese arrivano dal report Amway.</p>
    <form data-form="partenza" novalidate>
      ${campiQualifica(false, { valore:valoreQualifica(p), mese:p.qualifica_iniziale_mese ? meseDi(p.qualifica_iniziale_mese) : "",
                               pagamenti:p.pagamenti_iniziali, senzaData:true })}
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
    : tipo === "rettifica" ? `Totale di ${nomeMese(meseDi(riga.data)).split(" ")[0]} aggiornato${per}: ${num(vpMese(meseDi(riga.data), prendi()))} VP`
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
  "vista-gruppo"(){ st.vista = "gruppo"; st.target = null; st.schedaId = null; render(); window.scrollTo(0, 0); },
  "vista-obiettivo"(){ st.vista = "obiettivo"; st.target = null; render(); window.scrollTo(0, 0); },
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
    st.schedaId = p.id; st.target = p.stato === "gestito" ? p.id : null; st.attScheda = [];
    st.vista = "scheda"; render(); window.scrollTo(0, 0);
    try{ st.attScheda = (await api.activities(p.id, primaDataAperta()) || []).filter(a => a.data >= primaDataAperta()); render(); }
    catch(e){ toast(messaggio(e)); }
    if(p.stato !== "gestito") api.numeriPersone(p.id).then(n => { st.numeriLista[p.id] = n; render(); }).catch(() => {});
  },
  partenza(){ st.sheet = "partenza"; render(); },
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
  "mia-chiave"(){ st.sheet = "mia-chiave"; render(); },
  privacy(){ st.sheet = "privacy"; render(); },
  chiudi(){ st.sheet = null; render(); },
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
  "installa-si"(){ salvaLocale(CHIAVE_INSTALLA_NO, null); st.vista = "io"; render(); window.scrollTo(0, 0); },
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
  async partenza(f){
    const q = leggiQualifica(f);
    if(q.mancaMese){ mostraErroreForm(f, "Indica il mese della prima qualifica."); return; }
    try{
      st.profilo = await api.modificaPartenza({ p_qualifica:q.qualifica, p_percentuale:q.percentuale,
                           p_qualifica_mese:q.mese, p_pagamenti:q.pagamenti });
      await caricaStruttura();
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
    else if(!qual && !q.percentuale && !data) err = "Se stai iniziando serve la data di iscrizione: fa partire il conto alla rovescia del primo ordine.";
    else if(data && data > oggi()) err = "La data di iscrizione non può essere nel futuro.";
    else if(q.mancaMese) err = "Indica il mese della prima qualifica.";
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
    const diff = Math.round((totale - vpMese(m, lista())) * 100) / 100;
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
const FILTRI_LISTA = [
  { id:"aperti", nome:"Aperti", ok:p => !p.esito || p.esito === "non_ora" },
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
  return p.esito ? "nota" : { lista:"contatto", contattato:"invito", invitato:"piano", piano:"followup", followup:"followup" }[p.fase] || "contatto";
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
    <span class="eyebrow">Il tuo percorso con la lista</span>
    ${gruppi.map(([t, l]) => `<p class="small da-fare-t">${t}</p>
      <ul class="persone">${l.map(p => rigaPersona(p, true)).join("")}</ul>`).join("")}
    <p class="nota">× toglie una persona da qui (non dalla lista). Torna da sola quando segni un passo o fissi una data,
      oppure dalla sua scheda con "Rimetti in Io".</p>
  </div>`;
}
function rigaPersona(p, suIo){
  const f = FASI[indiceFase(p.fase)], fermo = !p.prossima_data && !p.esito && p.fase !== "lista" ? giorniTra(ultimoPasso(p), oggi()) : 0;
  return `<li class="${suIo ? "su-io" : ""}"><button class="persona" data-act="apri-persona" data-id="${esc(p.id)}">
      <span class="grow"><b>${esc(p.nome)}</b><br><span class="small">${p.esito ? ESITI[p.esito] : f.nome}${p.prossima_data ? " · " + esc(testoProssima(p))
        : fermo >= 14 ? ` · nessun passo da ${fermo} giorni` : ""}</span></span>
      <span class="punti" aria-hidden="true">${FASI.map((x, i) => `<i class="${i <= indiceFase(p.fase) ? "on" : ""}"></i>`).join("")}</span>
    </button>${suIo ? `<button class="x" data-act="togli-da-io" data-id="${esc(p.id)}" aria-label="Togli ${esc(p.nome)} da Io">×</button>` : ""}</li>`;
}

function vPersone(){
  if(st.sezPersone === "clienti") return vClienti();
  if(st.sezPersone === "target") return st.invitoId ? vTarget() : vSezioniPersone() + vTarget();
  if(st.personaId) return vPersona();
  const filtro = FILTRI_LISTA.find(x => x.id === st.filtroLista) || FILTRI_LISTA[0];
  const q = senzaAccenti(st.cercaLista || "");
  const l = st.persone.filter(filtro.ok).filter(p => !q || senzaAccenti(p.nome + " " + (p.origine || "")).includes(q))
    .sort((a, b) => (a.prossima_data || "9999") < (b.prossima_data || "9999") ? -1 : (a.prossima_data || "9999") > (b.prossima_data || "9999") ? 1
      : a.nome.localeCompare(b.nome, "it"));
  return `${vSezioniPersone()}<div class="card">
    <div class="spread"><span class="eyebrow">La mia lista</span>
      <span class="row" style="gap:6px"><button class="btn small" data-act="persone-tante">Più nomi</button>
      <button class="btn small primary" data-act="persona-nuova">+ Un nome</button></span></div>
    ${st.persone.length ? `
    <input type="search" id="cerca-lista" class="cerca" placeholder="Cerca un nome…" autocomplete="off" aria-label="Cerca un nome" value="${esc(st.cercaLista || "")}">
    <div class="row wrap scelte-rapide" style="gap:6px;margin-top:8px">${FILTRI_LISTA.map(x => {
      const n = st.persone.filter(x.ok).length;
      return `<button class="btn small${x.id === filtro.id ? " on" : ""}" data-act="filtro-lista" data-filtro="${x.id}" aria-pressed="${x.id === filtro.id}">${x.nome} · ${n}</button>`; }).join("")}</div>
    ${l.length ? `<ul class="persone">${l.map(p => rigaPersona(p)).join("")}</ul>` : `<p class="muted" style="margin:10px 0 0">Nessun nome qui.</p>`}`
    : `<p class="muted" style="margin:8px 0 0">La tua lista è vuota. Scrivi i nomi delle persone che conosci: amici, parenti,
        colleghi, vicini. Basta il nome; il resto lo aggiungi quando serve.</p>`}
    <p class="nota">I nomi della tua lista li vedi solo tu. A chi ti segue arrivano soltanto i numeri.
      ${st.persone.length ? `<button class="btn link small" data-act="scarica-persone" style="min-height:0;padding:0">Scarica una copia della mia lista</button>` : ""}</p>
  </div>`;
}

function vPersona(){
  const p = st.persone.find(x => x.id === st.personaId);
  if(!p) return `<button class="btn link" data-act="torna-lista" style="padding:0">‹ La mia lista</button><p class="muted">Nome non trovato.</p>`;
  const i = indiceFase(p.fase), passi = passiDi(p.id), tel = String(p.contatto || "").replace(/[^\d+]/g, "");
  const telefono = tel.replace(/\D/g, "").length >= 6;
  return `<button class="btn link" data-act="torna-lista" style="padding:0">‹ La mia lista</button>
  <div class="card">
    <div class="spread"><h2>${esc(p.nome)}</h2>${p.esito ? `<span class="pill ${p.esito === "partner" || p.esito === "cliente" ? "v" : p.esito === "no" ? "r" : "g"}">${ESITI[p.esito]}</span>` : ""}</div>
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
    <button class="btn small ghost" data-act="persona-modifica">Modifica i dati</button>
    <button class="btn small ghost" data-act="persona-cancella">Togli dalla lista</button>
  </div>`;
}

/* Il numero della lista di una persona del gruppo (per sponsor e upline: mai i nomi) */
function vNumeriLista(pid){
  const n = st.numeriLista[pid];
  if(!n || !Number(n.totale)) return "";
  return `<p class="small" style="margin:8px 0 0">La sua lista: <b>${num(n.in_lista)}</b> in lista · <b>${num(n.in_corso)}</b> in corso ·
    questo mese <b>${num(n.piani_mese)}</b> ${Number(n.piani_mese) === 1 ? "piano" : "piani"} e <b>${num(n.si_mese)}</b> sì${n.clienti != null ? ` · <b>${num(n.clienti)}</b> ${Number(n.clienti) === 1 ? "cliente" : "clienti"}` : ""}</p>`;
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

function vSheetPersone(s){
  const p = st.persone.find(x => x.id === st.personaId);
  const annulla = `<button type="button" class="btn ghost grow" data-act="chiudi">Annulla</button>`;
  if(s === "persona-nuova" || (s === "persona-modifica" && p)){
    const m = s === "persona-modifica" ? p : {};
    return `<h2>${m.id ? "Modifica i dati" : st.nuovoCliente ? "Un nuovo cliente" : "Un nome nella tua lista"}</h2>
    <form data-form="${s}" novalidate>
      <label class="field"><span>Nome</span><input name="nome" maxlength="80" required value="${esc(m.nome || "")}" autocomplete="off"></label>
      <label class="field"><span>Telefono o contatto <i>(facoltativo)</i></span><input name="contatto" maxlength="80" inputmode="tel" value="${esc(m.contatto || "")}"></label>
      <label class="field"><span>Come lo conosci <i>(facoltativo)</i></span><input name="origine" maxlength="80" placeholder="es. collega, palestra, cugino" value="${esc(m.origine || "")}"></label>
      ${m.id ? `<label class="field"><span>Note</span><textarea name="note" rows="3" maxlength="2000">${esc(m.note || "")}</textarea></label>` : ""}
      <div class="row" style="margin-top:16px">${annulla}<button class="btn primary grow">Salva</button></div>
    </form>`;
  }
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
    <form data-form="passo" novalidate>
      <label class="field"><span>Quando</span><input type="date" name="data" max="${oggi()}" value="${oggi()}"></label>
      ${t.come ? `<fieldset class="field"><legend>Come</legend>${opzioni("come", t.come)}</fieldset>
        <fieldset class="field"><legend>${tipo === "piano" ? "Com'è andato" : "Come ha reagito"}</legend>${opzioni("reazione", t.reazione)}</fieldset>` : ""}
      ${tipo === "chiusura" ? `<fieldset class="field"><legend>Com'è finita</legend>${opzioni("esito", Object.values(ESITI))}</fieldset>` : ""}
      <label class="field"><span>Nota <i>(facoltativa)</i></span><input name="nota" maxlength="1000"></label>
      ${tipo === "chiusura" ? campiProssima("Prossima cosa (per Partner, Cliente o Non ora)", null) : campiProssima(t.prossima, null)}
      <div class="row" style="margin-top:16px">${annulla}<button class="btn primary grow">Salva</button></div>
    </form>`;
  }
  if(s === "prossima" && p) return `<h2>Prossima cosa con ${esc(nomeSaluto(p.nome))}</h2>
    <form data-form="prossima" novalidate>
      ${campiProssima("Quando", p)}
      <div class="row" style="margin-top:16px">${annulla}<button class="btn primary grow">Salva</button></div>
    </form>`;
  return "";
}

async function dopoPersone(msg){
  await caricaPersone();
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
  "persona-nuova"(){ st.errore = ""; st.nuovoCliente = false; st.sheet = "persona-nuova"; render(); },
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
      const id = uuid();
      await api.nuovePersone([{ id, nome, contatto:f.contatto.value.trim() || null, origine:f.origine.value.trim() || null }]);
      st.personaId = id; st.vista = "persone";
      if(st.nuovoCliente){
        /* un cliente nuovo: nella lista è chiuso come Cliente (e conta nei nuovi clienti del mese) */
        await api.nuoviPassi([{ id:uuid(), persona_id:id, tipo:"chiusura", esito:"cliente", data:oggi() }]);
        st.nuovoCliente = false; st.sezPersone = "clienti";
        await dopoPersone(`${nome} tra i tuoi clienti`);
        return;
      }
      await dopoPersone(`${nome} nella tua lista`);
    }catch(e){ mostraErroreForm(f, messaggio(e)); }
  },
  async "persona-modifica"(f){
    const nome = f.nome.value.trim();
    if(!nome){ mostraErroreForm(f, "Scrivi il nome."); return; }
    try{
      await api.modificaPersona(st.personaId, { nome, contatto:f.contatto.value.trim() || null, origine:f.origine.value.trim() || null,
        note:f.note.value.trim() || null });
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
    const scelto = n => (f.querySelector(`input[name=${n}]:checked`) || {}).value || null;
    const esitoTesto = scelto("esito"), esito = esitoTesto ? Object.keys(ESITI).find(k => ESITI[k] === esitoTesto) : null;
    if(tipo === "chiusura" && !esito){ mostraErroreForm(f, "Scegli com'è finita."); return; }
    const data = f.data.value || oggi();
    if(data > oggi()){ mostraErroreForm(f, "Il passo non può essere nel futuro: per quello c'è la prossima cosa."); return; }
    const pr = leggiProssima(f);
    try{
      await api.nuoviPassi([{ id:uuid(), persona_id:p.id, tipo, data, come:scelto("come"), reazione:scelto("reazione"),
        esito:tipo === "chiusura" ? esito : null, nota:f.nota.value.trim() || null }]);
      /* un passo nuovo riporta la persona su Io, se l'avevo tolta */
      await api.modificaPersona(p.id, Object.assign((tipo === "chiusura" && esito === "no") ? { prossima_data:null, prossima_nota:null } : pr, { nascosta_io:false }));
      await dopoPersone(`${TIPI_PASSO[tipo].nome}${tipo === "chiusura" ? " · " + ESITI[esito] : ""} segnato`);
    }catch(e){ mostraErroreForm(f, messaggio(e)); }
  },
  async prossima(f){
    try{ await api.modificaPersona(st.personaId, Object.assign(leggiProssima(f), { nascosta_io:false })); await dopoPersone("Prossima cosa salvata"); }
    catch(e){ mostraErroreForm(f, messaggio(e)); }
  }
});

document.addEventListener("change", e => {
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
function messaggioTarget(inv){
  return `Ciao ${inv.nome.split(" ")[0]}, come ci siamo detti.\n\n`
    + "Prima di vederci, ti mando otto domande: tre minuti. Servono a capire se quello che cerchi e quello che questa attività può darti coincidono.\n\n"
    + "Non c'è una risposta giusta e non devi dimostrare di essere adatto: rispondi di istinto. Se viene fuori che non fa per te lo vediamo subito e ci siamo risparmiati del tempo tutti e due.\n\n"
    + linkTarget(inv) + "\n\nAlla fine ti compare un pulsante che mi rimanda le risposte. A dopo,\n" + nomeSaluto(st.profilo.nome);
}
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
        <button class="btn grow" data-act="ct-copia">Copia le risposte</button></div>
      <p class="nota">${c.tel ? `Il messaggio si apre nella chat di ${c.sponsor ? esc(c.sponsor) : "chi ti ha mandato il link"}: basta inviarlo.`
        : `Su WhatsApp scegli la chat di ${c.sponsor ? esc(c.sponsor) : "chi ti ha mandato il link"}.`} Codice: <b>${codice}</b></p>
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
    <div class="spread"><h2>${esc(x.nome)}</h2><span class="pill ${s.cl}">${esc(s.txt)}</span></div>
    <p class="small" style="margin:4px 0 0">Invito del ${dataIt(String(x.creato_il).slice(0, 10))} · ${x.scade ? `il link vale fino al ${dataIt(x.scade)}` : "il link non scade"}</p>
    <div class="row" style="gap:8px;margin-top:12px">
      <a class="btn wa grow" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(messaggioTarget(x))}">Manda su WhatsApp</a>
      <button class="btn grow" data-act="target-copia">Copia il messaggio</button></div>
    <p class="nota">Quando risponde ti arriva un messaggio con il link "Apri le risposte": aprilo da qui, oppure usa "Leggi una risposta".</p>
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
    <span class="eyebrow">Le risposte</span>
    <ul class="risposte-t">${a.map((k, qi) => { const o = DOMANDE[qi].o[k], senza = DOMANDE[qi].senzaPunti;
      return `<li><span class="grow"><b>${esc(DOMANDE[qi].tema)}</b><br><span class="small">${esc(o.t)}</span></span>
        <span class="num${!senza && o.p === 0 ? " zero" : ""}">${senza ? "–" : o.p}</span></li>`; }).join("")}</ul>
    <p class="nota">0 è un no secco, 2 un sì con riserva, 4 un sì pieno. La prima domanda non dà punti.</p>
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

document.addEventListener("input", e => { if(e.target && e.target.id === "ct-libero" && st.ct) st.ct.libero = e.target.value; });

/* ---- 11d. Persone: i Clienti (dalla mini app "Clienti e Riordini") ----
   Un cliente è una persona della lista chiusa come "Cliente": una sola scheda per tutto il percorso.
   Si segna cosa ha preso e quando; l'app calcola quando finisce e chi è da sentire (riordino, "come ti sei trovato",
   compleanno). Gli ordini non contano nei VP del mese: quelli arrivano dal report Amway. Tutto visibile solo a me. */
const DURATA_BASE = 30, PREAVVISO = 7, FERMO_DOPO = 45, VERIFICA_DOPO = 8, FINESTRA_VERIFICA = 30, COMPLEANNO_PRIMA = 7;
const MESI_LUNGHI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const FILTRI_CLIENTI = [
  { id:"sentire", nome:"Da sentire", ok:p => !p.non_compra && ["ritardo", "ora", "fermo", "mai"].includes(statoCliente(p).key) },
  { id:"tutti", nome:"Tutti", ok:p => !p.non_compra },
  { id:"fermi", nome:"Fermi", ok:p => !p.non_compra && statoCliente(p).key === "fermo" },
  { id:"mai", nome:"Mai ordinato", ok:p => !p.non_compra && statoCliente(p).key === "mai" },
  { id:"persi", nome:"Non comprano più", ok:p => p.non_compra }];

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
function prodottoCatalogo(codice){ const r = (window.CATALOGO_AMWAY || []).find(x => x[0] === codice); return r ? { codice:r[0], nome:r[1], formato:r[2], prezzo:r[4] } : null; }
function totaleOrdine(o){ return righeDi(o.id).reduce((t, r) => t + (Number(r.prezzo) || 0) * r.quantita, 0); }
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
/* lo stato in una parola: chi non compra più, chi non ha mai ordinato, chi è rimandato, fermo, in ritardo, sta finendo, a posto */
function statoCliente(p){
  if(p.non_compra) return { key:"perso", txt:"Non compra più", cl:"" };
  const o = ordiniDi(p.id);
  if(!o.length) return { key:"mai", txt:"Mai ordinato", cl:"g" };
  const s = scaffale(p);
  if(!s.length) return { key:"senza", txt:"Nessun prodotto seguito", cl:"" };
  if(p.prossima_data && p.prossima_data > oggi()) return { key:"rinviato", txt:`Da risentire il ${dataIt(p.prossima_data)}`, cl:"", primo:s[0] };
  const ultima = s.reduce((m, x) => x.finisce > m ? x.finisce : m, s[0].finisce);
  if(giorniTra(ultima, oggi()) > FERMO_DOPO) return { key:"fermo", txt:"Fermo", cl:"r", primo:s[0] };
  if(s[0].tra < 0) return { key:"ritardo", txt:"Doveva riordinare", cl:"r", primo:s[0] };
  if(s[0].tra <= PREAVVISO) return { key:"ora", txt:"Sta finendo", cl:"g", primo:s[0] };
  return { key:"ok", txt:"A posto", cl:"v", primo:s[0] };
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
    if(p.non_compra) continue;
    const s = statoCliente(p), v = verificaDi(p), c = compleannoDi(p);
    if(c && !c.fatto && c.tra <= COMPLEANNO_PRIMA) out.push({ p, ordine:c.tra, motivo:c.tra === 0 ? "Compleanno oggi" : `Compleanno il ${c.testo}` });
    else if(v) out.push({ p, ordine:1, motivo:`Come si è trovato con ${v.nuovi[0].nome}` });
    else if(s.key === "ritardo" || s.key === "ora") out.push({ p, ordine:s.primo.tra, motivo:`${s.txt}: ${s.primo.nome}` });
  }
  return out.sort((a, b) => a.ordine - b.ordine);
}
function vClientiDaSentire(){
  const l = clientiDaSentire();
  if(!l.length) return "";
  return `<div class="card">
    <span class="eyebrow">I tuoi clienti da sentire</span>
    <ul class="persone">${l.map(x => `<li><button class="persona" data-act="apri-cliente" data-id="${esc(x.p.id)}">
      <span class="grow"><b>${esc(x.p.nome)}</b><br><span class="small">${esc(x.motivo)}</span></span></button></li>`).join("")}</ul>
  </div>`;
}

function vClienti(){
  if(st.personaId) return vCliente();
  const filtro = FILTRI_CLIENTI.find(x => x.id === st.filtroClienti) || FILTRI_CLIENTI[0];
  const tutti = clientiTutti(), l = tutti.filter(filtro.ok).sort((a, b) => {
    const sa = statoCliente(a), sb = statoCliente(b);
    return (sa.primo ? sa.primo.finisce : "9999") < (sb.primo ? sb.primo.finisce : "9999") ? -1 : 1; });
  return `${vSezioniPersone()}<div class="card">
    <div class="spread"><span class="eyebrow">I miei clienti</span>
      <button class="btn small primary" data-act="cliente-nuovo">+ Un cliente</button></div>
    ${tutti.length ? `<div class="row wrap scelte-rapide" style="gap:6px;margin-top:10px">${FILTRI_CLIENTI.map(x =>
      `<button class="btn small${x.id === filtro.id ? " on" : ""}" data-act="filtro-clienti" data-filtro="${x.id}" aria-pressed="${x.id === filtro.id}">${x.nome} · ${tutti.filter(x.ok).length}</button>`).join("")}</div>
    ${l.length ? `<ul class="persone">${l.map(p => { const s = statoCliente(p);
      return `<li><button class="persona" data-act="apri-cliente" data-id="${esc(p.id)}">
        <span class="grow"><b>${esc(p.nome)}</b><br><span class="small">${s.primo && s.key !== "fermo" ? `${esc(s.primo.nome)} · finisce il ${dataIt(s.primo.finisce)}` : esc(abitudine(p) || "nessun ordine")}</span></span>
        <span class="pill ${s.cl}">${esc(s.txt)}</span></button></li>`; }).join("")}</ul>`
      : `<p class="muted" style="margin:10px 0 0">${filtro.id === "sentire" ? "Nessuno da sentire adesso." : "Nessun cliente qui."}</p>`}`
    : `<p class="muted" style="margin:8px 0 0">Ancora nessun cliente. Entrano da qui con "+ Un cliente", oppure dalla Lista quando chiudi una persona come Cliente.</p>`}
    <p class="nota">I tuoi clienti li vedi solo tu. Gli ordini servono ai riordini: non cambiano i tuoi VP.</p>
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
    <div class="spread"><h2>${esc(p.nome)}</h2><span class="pill ${s.cl}">${esc(s.txt)}</span></div>
    <p class="small" style="margin:2px 0 0">${[p.contatto, abitudine(p), c ? `compleanno ${c.testo}` : ""].filter(Boolean).map(esc).join(" · ")}</p>
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
      : `<p class="muted" style="margin:6px 0 0">${ord.length ? "Nessun prodotto seguito." : "Ancora nessun ordine: segna il primo con + Ordine."}</p>`}
  </div>
  ${ord.length ? `<div class="card">
    <span class="eyebrow">Ordini</span>
    <ul class="oggi">${ord.map(o => { const t = totaleOrdine(o);
      return `<li><span class="grow"><b>${dataIt(o.data)}</b> · ${o.modo === "io" ? "fatto da me" : "dal sito"}${t ? ` · ${euro(t)}` : ""}<br>
        <span class="small">${righeDi(o.id).map(r => esc(r.nome) + (r.quantita > 1 ? ` × ${r.quantita}` : "")).join(", ")}</span>
        ${o.modo === "io" ? `<br><span class="row" style="gap:6px;margin-top:4px">
          <button class="btn small${o.consegnato ? " on" : " ghost"}" data-act="ordine-consegnato" data-id="${esc(o.id)}">${o.consegnato ? "✓ Consegnato" : "Consegnato?"}</button>
          <button class="btn small${o.pagato ? " on" : " ghost"}" data-act="ordine-pagato" data-id="${esc(o.id)}">${o.pagato ? "✓ Pagato" : "Pagato?"}</button></span>` : ""}</span>
        <button class="x" data-act="ordine-togli" data-id="${esc(o.id)}" aria-label="Togli l'ordine">×</button></li>`; }).join("")}</ul>
  </div>` : ""}
  <div class="row wrap" style="gap:6px;justify-content:center">
    <button class="btn small ghost" data-act="apri-persona" data-id="${esc(p.id)}">Il suo percorso nella lista</button>
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
  const x = sc[0], prod = x ? x.nome : "quello che prendi di solito", quanti = x && x.quantita > 1 ? ` Te ne riporto ${x.quantita} come l'altra volta?` : "";
  return { titolo:"Sta finendo", fatto:"",
    guida:"Chiedere non è insistere: se dice che ne ha ancora, usa «Rimanda» e la data si sposta senza perdere niente.",
    varianti:[{ label:"Diretto", testo:`Ciao ${n}, se non ho sbagliato i conti ${prod} ti sta finendo in questi giorni. Te ne serve ancora?${quanti}` },
      { label:"Con l'ordine", testo:`Ciao ${n}, sto per fare un ordine: ti aggiungo ${prod}? Dovrebbe essere più o meno il momento in cui finisce.` },
      { label:"Dopo un silenzio", testo:`Ciao ${n}, mi sono accorto che non ci sentiamo da un po'. Come stai?\n\nIl ${prod} l'hai finito o hai deciso di lasciarlo? Dimmelo tranquillamente, non me la prendo — mi serve solo per non farti telefonate a vuoto.` }] };
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
  if(s === "ordine" && p){
    const b = st.bozza, tot = b.righe.reduce((t, r) => t + (Number(r.prezzo) || 0) * r.quantita, 0);
    return `<h2>Ordine di ${esc(nomeSaluto(p.nome))}</h2>
    <form data-form="ordine-cliente" novalidate>
      <label class="field"><span>Quando</span><input type="date" name="data" max="${oggi()}" value="${esc(b.data)}" data-bozza="data"></label>
      <fieldset class="field"><legend>Come ha ordinato</legend>
        <div class="opzioni">${[["sito", "Da solo, dal sito Amway"], ["io", "L'ho fatto io"]].map(([v, t]) =>
          `<label class="chip"><input type="radio" name="modo" value="${v}" data-bozza="modo"${b.modo === v ? " checked" : ""}><span>${t}</span></label>`).join("")}</div></fieldset>
      <fieldset class="field"><legend>Prodotti</legend>
        ${b.righe.length ? `<ul class="righe-ordine">${b.righe.map((r, i) => `<li>
          <span class="grow"><b>${esc(r.nome)}</b><br><span class="small">dura <input class="mini" type="number" min="1" max="3650" inputmode="numeric" value="${r.giorni}" data-riga="${i}" data-campo="giorni" aria-label="Giorni che dura"> giorni</span></span>
          <span class="qta"><button type="button" class="btn small ghost" data-act="riga-meno" data-i="${i}" aria-label="Uno in meno">−</button><b>${r.quantita}</b>
            <button type="button" class="btn small ghost" data-act="riga-piu" data-i="${i}" aria-label="Uno in più">+</button></span>
          <input class="mini prezzo" type="text" inputmode="decimal" value="${r.prezzo != null ? String(r.prezzo).replace(".", ",") : ""}" placeholder="€" data-riga="${i}" data-campo="prezzo" aria-label="Prezzo"></li>`).join("")}</ul>
          <p class="small" style="margin:6px 0 0">Totale <b id="totale-ordine">${euro(tot)}</b></p>` : `<p class="small muted">Cerca i prodotti qui sotto.</p>`}
        <input type="search" id="cerca-prodotto" class="cerca" placeholder="Cerca un prodotto Amway (nome o codice)…" autocomplete="off" value="${esc(st.cercaProdotto || "")}">
        <ul class="risultati-prodotto" id="risultati-prodotto">${risultatiProdotto(st.cercaProdotto)}</ul>
      </fieldset>
      <label class="field"><span>Nota <i>(facoltativa)</i></span><input name="nota" maxlength="500" value="${esc(b.nota || "")}" data-bozza="nota"></label>
      <div class="row" style="margin-top:16px">${annulla}<button class="btn primary grow">Salva l'ordine</button></div>
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
  const cat = (window.CATALOGO_AMWAY || []).filter(r => senzaAccenti(r[0] + " " + r[1]).includes(t)).slice(0, 8);
  return cat.map(r => `<li><button type="button" class="persona" data-act="aggiungi-prodotto" data-codice="${esc(r[0])}">
      <span class="grow">${esc(r[1])}<br><span class="small">${esc([r[0], r[2], euro(r[4])].filter(Boolean).join(" · "))}</span></span><b>+</b></button></li>`).join("")
    + `<li><button type="button" class="persona" data-act="aggiungi-libero"><span class="grow"><i>Non c'è: aggiungi "${esc(q.trim())}"</i></span><b>+</b></button></li>`;
}
function nuovaBozza(righe){
  return { data:oggi(), modo:"sito", nota:"", righe:(righe || []).map(r => ({ codice:r.codice, nome:r.nome, quantita:r.quantita || 1,
    prezzo:r.prezzo != null ? Number(r.prezzo) : (prodottoCatalogo(r.codice) || {}).prezzo ?? null, giorni:giorniDi(r.codice) })) };
}
async function salvaOrdine(pid, b){
  const id = uuid();
  await api.nuovoOrdine({ id, persona_id:pid, data:b.data, modo:b.modo, nota:(b.nota || "").trim() || null });
  await api.nuoveRighe(b.righe.map(r => ({ id:uuid(), ordine_id:id, codice:r.codice, nome:r.nome.slice(0, 160), quantita:r.quantita,
    prezzo:r.prezzo === "" || r.prezzo == null || isNaN(Number(r.prezzo)) ? null : Number(r.prezzo) })));
  /* la durata scelta vale per tutti i miei clienti */
  for(const r of b.righe){ const g = Math.max(1, Math.min(3650, Number(r.giorni) || DURATA_BASE));
    if(g !== giorniDi(r.codice)) await api.salvaDurata(r.codice, g); }
  /* un ordine nuovo: niente più rinvio */
  await api.modificaPersona(pid, { prossima_data:null, prossima_nota:null });
}
async function dopoClienti(msg){ await caricaClienti(); await caricaPersone(); st.sheet = null; render(); if(msg) toast(msg); }
function apriWa(tel, testo){ window.open(`https://wa.me/${tel || ""}?text=` + encodeURIComponent(testo), "_blank", "noopener"); }

Object.assign(AZIONI, {
  "apri-cliente"(el){ st.vista = "persone"; st.sezPersone = "clienti"; st.invitoId = null; st.personaId = el.dataset.id; render(); window.scrollTo(0, 0); },
  "torna-clienti"(){ st.personaId = null; render(); window.scrollTo(0, 0); },
  "filtro-clienti"(el){ st.filtroClienti = el.dataset.filtro; render(); },
  "cliente-nuovo"(){ st.errore = ""; st.nuovoCliente = true; st.sheet = "persona-nuova"; render(); },
  "ordine-nuovo"(){ st.bozza = nuovaBozza([]); st.cercaProdotto = ""; st.sheet = "ordine"; render(); },
  "ordine-ripeti"(){
    const o = ordiniDi(st.personaId)[0];
    st.bozza = nuovaBozza(righeDi(o.id)); st.bozza.modo = o.modo; st.cercaProdotto = ""; st.sheet = "ordine"; render();
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
    else st.bozza.righe.push({ codice:c.codice, nome:c.nome + (c.formato ? ` (${c.formato})` : ""), quantita:1, prezzo:c.prezzo, giorni:giorniDi(c.codice) });
    st.cercaProdotto = ""; render();
  },
  "aggiungi-libero"(){
    const nome = (st.cercaProdotto || "").trim();
    if(!nome) return;
    const codice = "P-" + senzaAccenti(nome).replace(/[^a-z0-9]+/g, "").slice(0, 18);
    st.bozza.righe.push({ codice, nome:nome.slice(0, 160), quantita:1, prezzo:null, giorni:giorniDi(codice) });
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
    if(!b.righe.length){ mostraErroreForm(f, "Aggiungi almeno un prodotto."); return; }
    if(!b.data || b.data > oggi()){ mostraErroreForm(f, "Scegli il giorno dell'ordine (non nel futuro)."); return; }
    try{ await salvaOrdine(st.personaId, b); st.bozza = null; await dopoClienti("Ordine salvato"); }catch(e){ mostraErroreForm(f, messaggio(e)); }
  },
  async "rimanda-cliente"(f){
    const g = Number((f.querySelector("input[name=giorni]:checked") || {}).value || 7);
    try{ await api.modificaPersona(st.personaId, { prossima_data:piuGiorni(oggi(), g), prossima_nota:f.nota.value.trim() || null }); await dopoClienti("Rimandato"); }
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
    if(tot) tot.textContent = euro(st.bozza.righe.reduce((s, x) => s + (Number(x.prezzo) || 0) * x.quantita, 0));
  }
});
document.addEventListener("change", e => { const t = e.target; if(t && st.bozza && t.dataset && t.dataset.bozza) st.bozza[t.dataset.bozza] = t.value; });

/* ---- 12. Eventi ---- */
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]");
  if(!el) return;
  const act = el.dataset.act;
  if(act === "chiudi-fuori"){ if(e.target === el){ st.sheet = null; render(); } return; }
  if(AZIONI[act]){ e.preventDefault(); AZIONI[act](el); }
});

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
  if(e.target.id === "file-report"){ leggiFileReport(e.target.files && e.target.files[0]); return; }
  if(e.target.name === "nascondi" && e.target.closest(".imp-da-scegliere")){ accendiRapida(null); return; }
  if(e.target.name !== "qualifica") return;
  const f = e.target.form;
  const t = st.stages.find(s => s.chiave === f.qualifica.value);
  f.querySelector("[data-mostra=pagamenti]").hidden = !(t && t.pagamenti_max);
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
  /* ordine delle pagine: Obiettivo | Io | Gruppo */
  if(dx < 0 && st.vista === "obiettivo") scorri("vista-io", "da-destra");
  else if(dx < 0 && st.vista === "io") scorri("vista-persone", "da-destra");
  else if(dx < 0 && st.vista === "persone" && !st.personaId && !st.invitoId) scorri("vista-gruppo", "da-destra");
  else if(dx > 0 && st.vista === "persone" && st.invitoId) scorri("torna-target", "da-sinistra");
  else if(dx > 0 && st.vista === "persone" && st.personaId) scorri(st.sezPersone === "clienti" ? "torna-clienti" : "torna-lista", "da-sinistra");
  else if(dx > 0 && st.vista === "persone") scorri("vista-io", "da-sinistra");
  else if(dx > 0 && st.vista === "io") scorri("vista-obiettivo", "da-sinistra");
  else if(dx > 0 && st.vista === "gruppo") scorri("vista-persone", "da-sinistra");
  else if(dx > 0 && st.vista === "scheda") scorri("vista-gruppo", "da-sinistra");
}, { passive:true });
function scorri(azione, verso){
  AZIONI[azione]();
  const app = document.getElementById("app");
  app.classList.remove("da-destra", "da-sinistra"); void app.offsetWidth; app.classList.add(verso);
}

/* Tornando sull'app (da un altro dispositivo si è magari scritto qualcosa) si ricarica. */
document.addEventListener("visibilitychange", () => { if(document.visibilityState === "visible") aggiornaAttivita(); });

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
