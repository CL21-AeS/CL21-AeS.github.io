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
    signInAnon:   () => q(sb.auth.signInAnonymously()),
    signOut:      () => sb.auth.signOut(),
    sponsorName:  codice => q(sb.rpc("sponsor_da_codice", { p_codice:codice })),
    collega:      () => q(sb.rpc("collega_profilo")),
    entra:        chiave => q(sb.rpc("entra_con_chiave", { p_chiave:chiave })),
    join:         args => q(sb.rpc("iscrivi_con_codice", args)),
    cambiaChiave: () => q(sb.rpc("cambia_chiave")),
    accettaPrivacy: pid => q(sb.from("partners").update({ privacy_accettata_il:new Date().toISOString() }).eq("id", pid)),
    /* io e tutta la mia downline: la RLS restituisce solo quella */
    struttura:    () => q(sb.from("partners").select("id,nome,sponsor_id,stato,gestore_id,creato_il,ultimo_aggiornamento,"
                    + "qualifica_iniziale,percentuale_iniziale,qualifica_iniziale_mese,pagamenti_iniziali,partenza_confermata_il").order("creato_il")),
    conferma:     args => q(sb.rpc("conferma_partenza", args)),
    inMezzo:      args => q(sb.rpc("inserisci_in_mezzo", args)),
    cancella:     pid => q(sb.rpc("cancella_partner", { p_partner:pid })),
    cambiaSponsor: (pid, sp) => q(sb.rpc("cambia_sponsor", { p_partner:pid, p_sponsor:sp })),
    nuovaChiavePer: pid => q(sb.rpc("nuova_chiave_per", { p_partner:pid })),
    aggiungi:     args => q(sb.rpc("aggiungi_partner", args)),
    linkGestito:  pid => q(sb.rpc("link_per_gestito", { p_partner:pid })),
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
  linkGestito: null,      // { nome, chiave } da mandare a una persona aggiunta a mano
  riep: [],               // numeri del mese in corso: io e la mia downline (riepilogo_mese)
  riepPrec: [],           // lo stesso per il mese precedente, finché non è chiuso
  storico: [],            // i miei mesi chiusi (monthly_totals)
  livelli: [],            // soglie delle percentuali
  vista: "io",            // pagina della home: "io", "gruppo" (struttura, inviti) o "scheda" (un partner)
  schedaId: null,         // partner aperto nella scheda
  attScheda: [],          // le sue attività (mese aperto)
  target: null,           // per chi sto registrando: null = io; un id = partner senza app che gestisco
  confermaId: null,       // partner di cui confermo il punto di partenza
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
  non_autenticato: "Sessione scaduta: apri di nuovo il tuo link personale."
};
function messaggio(e){
  const m = (e && (e.message || e.error_description || e.msg)) || String(e || "");
  for(const k in MESSAGGI_ERRORE) if(m.includes(k)) return MESSAGGI_ERRORE[k];
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
function numeriMese(m){
  const righe = m === meseDi(oggi()) ? st.riep : m === mesePrecedente() ? st.riepPrec : [];
  const me = st.profilo.id, r = rigaDi(righe, me);
  const personali = vpMese(m);
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
  await caricaNumeri();

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
    precedenteAperto() ? api.riepilogo(mesePrecedente() + "-01").catch(() => []) : Promise.resolve([]),
    api.storico(pid).catch(() => []),
    api.livelli().catch(() => [])
  ]);
  st.riep = riep || []; st.riepPrec = prec || []; st.storico = storico || []; st.livelli = livelli || [];
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
  await api.signInAnon();
  return api.session();
}

async function vaiHome(profilo){
  st.profilo = profilo;
  salvaLocale(CHIAVE_INVITO, null); st.invito = null; st.invitoRiserva = null;
  await caricaTutto();
  /* chi è stato aggiunto a mano, la prima volta che entra, legge e accetta la privacy */
  st.fase = profilo.privacy_accettata_il ? "home" : "privacy_primo";
}

async function caricaStruttura(){ st.struttura = await api.struttura() || []; }

async function entraConChiave(k){
  st.fase = "avvio"; render();
  try{
    await sessione();
    const p = await api.entra(k);
    ricordaChiave(k);
    await vaiHome(p);
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
      if(p && p.id){ await vaiHome(p); render(); return; }
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
function render(){
  const app = document.getElementById("app");
  const viste = { avvio:vAvvio, config:vConfig, benvenuto:vBenvenuto, chiave_errata:vChiaveErrata,
                  ingresso:vIngresso, privacy_primo:vPrivacyPrimo, home:vHome, errore:vErrore };
  const html = (viste[st.fase] || vAvvio)();
  if(html !== ultimoApp){ app.innerHTML = html; ultimoApp = html; }
  const conAzioni = st.fase === "home" && st.vista === "io";
  document.body.classList.toggle("con-azioni", conAzioni);
  document.getElementById("azioni").innerHTML = conAzioni ? vAzioni() : "";
  document.getElementById("sheet").innerHTML = st.sheet ? `<div class="sheet" data-act="chiudi-fuori"><div class="sheet-box" role="dialog" aria-modal="true">${vSheet()}</div></div>` : "";
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
    <label class="field" style="margin:0"><span>Incolla qui il tuo link personale</span>
      <input name="link" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://…/growup-team/#chiave=…"></label>
    <button class="btn primary wide" style="margin-top:12px">Entra</button>
  </form>`;
}

function vBenvenuto(){
  return `<div class="centro">
    ${marchio()}
    <h1 style="margin-top:6px">Entra in Growup</h1>
    <p class="muted">Per entrare apri il tuo <b>link personale</b>: quello che ti sei salvato su WhatsApp o Telegram
      quando sei entrato la prima volta. Toccalo da lì, oppure copialo e incollalo qui sotto.</p>
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
          <input type="number" name="pagamenti" min="0" max="12" inputmode="numeric" value="${Number(scelta.pagamenti) || 0}"></label>
      </div>
      ${scelta.senzaData ? "" : `<label class="field"><span>Data di iscrizione ad Amway <i data-obbl>${obbligoData ? "(obbligatoria per chi inizia)" : "(facoltativa)"}</i></span>
        <input type="date" name="data" max="${oggi()}"></label>`}
      ${obbligoData ? `<p class="nota" style="margin-top:6px">Serve al conto alla rovescia dei 30 giorni per il primo ordine.</p>` : ""}`;
}
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
      ${campiQualifica(true)}
      <p class="nota">Il punto di partenza lo conferma poi il tuo sponsor, così i numeri del gruppo restano affidabili.</p>

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
        quanti piani, quanti VP, quanti clienti. Dei tuoi contatti e clienti registriamo <b>solo il numero</b>: nessun nome né telefono.
        Non serve la tua email.</p>
      <p><b>Chi li vede.</b> Tu e chi sta sopra di te nella tua organizzazione (la tua upline). Nessun altro.</p>
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
    <button role="tab" aria-selected="${st.vista === "io"}" class="${st.vista === "io" ? "on" : ""}" data-act="vista-io">Io</button>
    <button role="tab" aria-selected="${st.vista !== "io"}" class="${st.vista !== "io" ? "on" : ""}" data-act="vista-gruppo">Gruppo</button>
  </div>`;
}

/* In fondo a ogni pagina: link personale, privacy, uscita (prima stavano nel menu ⋯). */
function vFondo(){
  return `<div class="fondo">
    <div class="row wrap" style="justify-content:center">
      <button class="btn small ghost" data-act="mia-chiave">Il mio link personale</button>
      <button class="btn small ghost" data-act="privacy">Privacy</button>
      <button class="btn small ghost" data-act="esci">Esci</button>
    </div>
    <p class="nota" style="text-align:center">${esc(st.profilo.nome)} · codice d'invito <b>${esc(st.profilo.codice_invito)}</b><br>
      Per cancellare il profilo e i tuoi dati scrivi a Stefano e Alessia.</p>
  </div>`;
}

function vHome(){
  const p = st.profilo;
  const gruppo = st.vista === "gruppo" || st.vista === "scheda";
  const persone = alberoSotto(p.id, 0).length;
  return `
  <div class="testata">
    <div>${marchio()}<h1>${st.vista === "scheda" ? "Scheda partner" : gruppo ? "Il mio gruppo" : `Ciao ${esc(nomeSaluto(p.nome))}`}</h1>
      ${st.vista === "gruppo" ? `<p class="small" style="margin:0">${persone === 1 ? "1 persona" : `${num(persone)} persone`}</p>` : ""}</div>
    ${vSelettore()}
  </div>
  ${st.vista === "scheda" ? vScheda() : gruppo ? `
  ${vDaConfermare()}
  ${vStruttura()}
  ${vInvita()}` : `
  ${leggiLocale(CHIAVE_SALVATA) === "1" || !st.chiave ? "" : vSalvaChiave()}
  ${vVisione()}
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
  const ordinale = ["la prima", "la seconda", "la terza"][n.attive];
  const terza = conLinee && n.attive < 3
    ? `<div class="spinta"><b>Costruisci ${ordinale} linea.</b> Hai ${n.attive === 1 ? "1 linea attiva" : `${n.attive} linee attive`} su 3:
        un nuovo partner frontale da accompagnare nel Path to Bronze.
        <button class="btn small" data-act="vista-gruppo" style="margin-top:8px">Invita un nuovo partner</button></div>` : "";
  const linee = conLinee && n.linee.length
    ? `<ul class="linee">${n.linee.map(l => `<li><span class="grow">${esc(l.nome)}</span>
        <span class="num ${l.vp >= soglia() ? "" : "faint"}">${num(l.vp)} VP</span></li>`).join("")}</ul>
       <p class="nota" style="margin-top:4px">Le tue linee frontali questo mese, con i VP di tutto il loro gruppo. Attiva da ${num(soglia())} VP.</p>` : "";
  return `<div class="card">
    <div class="spread"><span class="eyebrow">Tappa ${indice + 1} di ${st.stages.length}</span>
      <span class="row" style="gap:6px;flex-wrap:wrap;justify-content:flex-end">
      ${n.percentuale ? `<span class="pill s">${n.percentuale}% questo mese</span>` : ""}
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
    <p class="small" style="margin:6px 0 0">Registra ogni ordine, oppure scrivi il totale del mese (per esempio dall'ufficio virtuale Amway).
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
function vStruttura(){
  const righe = alberoSotto(st.profilo.id, 0);
  return `<div class="card">
    <div class="spread"><span class="eyebrow">La mia struttura</span>
      <button class="btn small" data-act="aggiungi">+ Aggiungi persona</button></div>
    ${righe.length ? `<ul class="albero">${righe.map(({ p, livello }) => {
      const r = rigaDi(st.riep, p.id) || {}, sp = statoDi(p);
      return `<li style="padding-left:${Math.min(livello, 6) * 16}px">
      <button class="nome" data-act="apri-scheda" data-id="${esc(p.id)}">
        <span>${livello ? `<span class="faint">└ </span>` : ""}${esc(p.nome)}</span>
        <span class="small">${num(r.vp_personali)} VP · gruppo ${num(r.vp_gruppo)}${r.linee_attive ? ` · ${r.linee_attive} ${r.linee_attive === 1 ? "linea" : "linee"}` : ""}</span>
      </button>
      ${p.partenza_confermata_il ? "" : `<span class="pill g" title="Punto di partenza da confermare">!</span>`}
      <span class="pill ${sp.cl}">${sp.txt}</span></li>`; }).join("")}</ul>
      <p class="nota">Tocca un nome per aprire la sua scheda. VP del mese e VP di gruppo.</p>`
      : `<p class="muted" style="margin:8px 0 0">Ancora nessuno nel tuo gruppo. Invita chi usa il telefono con il link qui sotto,
          oppure aggiungi a mano chi non usa l'app.</p>`}
  </div>`;
}

function vDaConfermare(){
  const l = alberoSotto(st.profilo.id, 0).map(x => x.p).filter(p => !p.partenza_confermata_il);
  if(!l.length) return "";
  return `<div class="card" style="border-color:var(--giallo)">
    <span class="eyebrow">Da confermare</span>
    <p class="small" style="margin:4px 0 0">Il punto di partenza che hanno dichiarato entrando. Confermalo o correggilo:
      così i numeri del gruppo restano affidabili.</p>
    <ul class="albero">${l.map(p => `<li><span class="grow"><b>${esc(p.nome)}</b><br><span class="small">${esc(testoPartenza(p))}</span></span>
      <button class="btn small" data-act="conferma" data-id="${esc(p.id)}">Conferma</button></li>`).join("")}</ul>
  </div>`;
}

/* ---- Scheda partner ---- */
function inseritoDa(a, p){
  if(!a.inserito_da || a.inserito_da === p.id) return "";
  if(a.inserito_da === st.profilo.id) return "inserito da te";
  const n = nomeDi(a.inserito_da);
  return n ? `inserito da ${n}` : "inserito dalla sua upline";
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
    <div class="spread"><h2>${esc(p.nome)}</h2><span class="pill ${sp.cl}">${sp.txt}</span></div>
    <p class="small" style="margin:2px 0 0">${sponsor ? `Sponsor: ${esc(sponsor)} · ` : ""}${gestito ? "non usa l'app: i suoi numeri li aggiorni tu"
      : sp.g === 0 ? "ha aggiornato oggi" : `ultimo aggiornamento ${plur(sp.g, "giorno", "giorni")} fa`}</p>
    <div class="dati-scheda">
      <div><span class="small">VP personali</span><b class="num">${num(r.vp_personali)}</b></div>
      <div><span class="small">VP di gruppo</span><b class="num">${num(r.vp_gruppo)}</b></div>
      <div><span class="small">Linee attive</span><b class="num">${r.linee_attive || 0}</b></div>
      <div><span class="small">Percentuale</span><b class="num">${r.percentuale ? r.percentuale + "%" : "–"}</b></div>
    </div>
    ${frontali.length ? `<ul class="linee">${frontali.map(x => `<li><span class="grow">${esc(nomeDi(x.partner_id))}</span>
      <span class="num ${Number(x.vp_gruppo) >= soglia() ? "" : "faint"}">${num(x.vp_gruppo)} VP</span></li>`).join("")}</ul>` : ""}
    <p class="small" style="margin:10px 0 0">Punto di partenza: <b>${esc(testoPartenza(p))}</b>
      ${p.partenza_confermata_il ? `<span class="pill v">confermato</span>`
        : `<button class="btn link small" data-act="conferma" data-id="${esc(p.id)}">Conferma</button>`}</p>
    <div class="spread" style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line)">
      <span class="small">Il suo sponsor vero non è ${p.sponsor_id === st.profilo.id ? "te" : esc(sponsor || "nell'app")}?</span>
      <button class="btn small" data-act="in-mezzo" data-id="${esc(p.id)}" style="white-space:nowrap">Manca qualcuno sopra?</button>
    </div>
  </div>
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
    <button class="btn wide" style="margin-top:12px" data-act="manda-link" data-id="${esc(p.id)}">Manda il suo link personale</button>
    <p class="nota">Quando apre il suo link prende in mano il profilo: da lì i suoi numeri li aggiorna lui.</p>
  </div>` : `<div class="card">
    <p class="small" style="margin:0">Usa l'app: i suoi numeri li aggiorna lui.</p>
    ${st.profilo.is_admin ? `<button class="btn wide" style="margin-top:12px" data-act="nuovo-link" data-id="${esc(p.id)}">Nuovo link personale</button>
      <p class="nota">Solo per chi ha perso il suo link: quello vecchio smette di funzionare e i suoi telefoni vanno ricollegati.</p>` : ""}
  </div>`}
  <div class="card">
    <span class="eyebrow">Struttura</span>
    ${st.profilo.is_admin ? `<button class="btn wide" style="margin-top:10px" data-act="cambia-sponsor" data-id="${esc(p.id)}">Cambia sponsor</button>` : ""}
    <button class="btn wide pericolo" style="margin-top:10px" data-act="cancella" data-id="${esc(p.id)}">Cancella dalla struttura</button>
    <p class="nota">Per i codici che Amway non rinnova. Chi è nel suo gruppo passa a ${esc(sponsor || "il suo sponsor")};
      i suoi dati vengono cancellati.</p>
  </div>`;
}

function testoInvito(){
  return `Ciao! Ti mando Growup, l'app del nostro gruppo per pianificare la settimana e seguire il percorso fino ad Argento. `
       + `Apri il link e inizi subito, non serve nessuna registrazione:`;
}
function vInvita(){
  return `<div class="card">
    <span class="eyebrow">Invita un nuovo partner</span>
    <p class="small" style="margin:4px 0 0">Chi entra con questo link entra nel tuo gruppo, con te come sponsor. Non è il tuo link personale: questo si può girare.</p>
    <div class="condividi">
      <a class="btn wa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(testoInvito() + " " + linkInvito())}">WhatsApp</a>
      <a class="btn tg" target="_blank" rel="noopener" href="https://t.me/share/url?url=${encodeURIComponent(linkInvito())}&text=${encodeURIComponent(testoInvito())}">Telegram</a>
      <button class="btn" data-act="copia">Copia link</button>
      ${navigator.share ? `<button class="btn" data-act="condividi">Altro…</button>` : ""}
    </div>
    <div class="linkbox">${esc(linkInvito())}</div>
  </div>`;
}

function vAzioni(){
  return `<div class="azioni"><div class="in">
    <button class="btn primary" data-act="contatto">+ Contatto<b>${num(fattoSettimana("contatto"))} questa sett.</b></button>
    <button class="btn primary" data-act="piano">+ Piano<b>${num(fattoSettimana("piano"))} questa sett.</b></button>
    <button class="btn primary" data-act="ordine">+ Ordine<b>${num(vpMese(meseDi(oggi())))} VP nel mese</b></button>
  </div></div>`;
}

/* ---- 10. Fogli in basso ---- */
function vSheet(){
  const s = st.sheet;
  const err = st.errore ? `<p class="errore">${esc(st.errore)}</p>` : "";
  const piede = `<div class="row" style="margin-top:16px"><button type="button" class="btn ghost grow" data-act="chiudi">Annulla</button>
        <button class="btn primary grow">Salva</button></div>`;
  if(s === "ordine") return `<h2>Nuovo ordine${st.target ? ` di ${esc(nomeSaluto(nomeDi(st.target)))}` : ""}</h2>
    <form data-form="ordine" novalidate>
      <label class="field"><span>VP dell'ordine</span>
        <input name="vp" type="text" inputmode="decimal" autocomplete="off" required autofocus placeholder="es. 60 o 62,5"></label>
      <label class="field"><span>Data</span><input name="data" type="date" value="${oggi()}" min="${primaDataAperta()}" max="${oggi()}"></label>
      ${piede}${err}
    </form>`;
  if(s === "obiettivi") return `<h2>Obiettivi della settimana</h2>
    <p class="small">Valgono da lunedì ${dataIt(settimana())}. La settimana prossima ripartono da questi.</p>
    <form data-form="obiettivi" novalidate>
      <label class="field"><span>Nuovi contatti</span><input name="contatti" type="number" inputmode="numeric" min="0" max="1000" value="${Number(st.goal.obiettivo_contatti) || 0}"></label>
      <label class="field"><span>Piani mostrati</span><input name="piani" type="number" inputmode="numeric" min="0" max="1000" value="${Number(st.goal.obiettivo_piani) || 0}"></label>
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
        <input name="vp" type="text" inputmode="decimal" autocomplete="off" autofocus value="${num(vpMese(m, lista()))}"></label>
      ${piede}${err}
    </form>`;
  }
  if(s === "storico") return vStorico();
  if(s === "obiettivo-mese") return `<h2>Obiettivo del mese</h2>
    <p class="small">VP fatturati in ${nomeMese(meseDi(oggi()))}. Il mese prossimo riparte da questo.</p>
    <form data-form="obiettivo-mese" novalidate>
      <label class="field"><span>VP fatturati nel mese</span><input name="vp" type="text" inputmode="decimal" autocomplete="off" value="${num(st.goalMese.obiettivo_vp)}"></label>
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
  if(s === "aggiungi"){
    const posti = [`<option value="${esc(st.profilo.id)}">Io</option>`]
      .concat(alberoSotto(st.profilo.id, 1).map(({ p, livello }) =>
        `<option value="${esc(p.id)}">${"— ".repeat(livello)}${esc(p.nome)}</option>`)).join("");
    return `<h2>Aggiungi una persona</h2>
    <p class="small">Per chi non usa l'app. Se un giorno vorrà usarla, le mandi il suo link e troverà già il suo profilo.</p>
    <form data-form="aggiungi" novalidate>
      <label class="field"><span>Nome e cognome</span><input name="nome" autocomplete="off" maxlength="80" required></label>
      <label class="field"><span>Chi è il suo sponsor?</span><select name="sponsor">${posti}</select></label>
      ${campiQualifica(false)}
      <label class="check"><input type="checkbox" name="consenso" required>
        <span>Ho il suo consenso (a voce o per messaggio) a inserire il suo nome e i suoi numeri nell'app.</span></label>
      ${piede}${err}
    </form>`;
  }
  if(s === "cambia-sponsor"){
    const x = st.struttura.find(y => y.id === st.spostaId);
    if(!x) return "";
    const esclusi = new Set([x.id, x.sponsor_id].concat(alberoSotto(x.id, 0).map(z => z.p.id)));
    const posti = [{ p:st.profilo, livello:0 }].concat(alberoSotto(st.profilo.id, 1)).filter(z => !esclusi.has(z.p.id));
    return `<h2>Cambia sponsor di ${esc(nomeSaluto(x.nome))}</h2>
    <p class="small">${esc(x.nome)} passa sotto il nuovo sponsor con tutto il suo gruppo. Lo storico dei mesi chiusi non cambia.</p>
    <form data-form="cambia-sponsor" novalidate>
      <label class="field"><span>Nuovo sponsor</span><select name="sponsor">${posti.map(({ p, livello }) =>
        `<option value="${esc(p.id)}">${"— ".repeat(livello)}${esc(p.id === st.profilo.id ? p.nome + " (noi)" : p.nome)}</option>`).join("")}</select></label>
      ${piede}${err}
    </form>`;
  }
  if(s === "in-mezzo"){
    const x = st.struttura.find(y => y.id === st.inMezzoId);
    if(!x) return "";
    const sopra = x.sponsor_id === st.profilo.id ? "te" : nomeDi(x.sponsor_id);
    const fratelli = st.struttura.filter(y => y.sponsor_id === x.sponsor_id && y.id !== x.id);
    return `<h2>Manca qualcuno sopra ${esc(nomeSaluto(x.nome))}?</h2>
    <p class="small">Inserisci la persona che manca tra <b>${esc(sopra)}</b> e <b>${esc(x.nome)}</b>. Entra come
      "senza app": puoi inserire i suoi numeri o mandarle il suo link.</p>
    <form data-form="in-mezzo" novalidate>
      <input type="hidden" name="sotto" value="${esc(x.id)}">
      <label class="field"><span>Nome e cognome</span><input name="nome" autocomplete="off" maxlength="80" required></label>
      <p class="avviso">${esc(x.nome)} e tutto il suo gruppo passano sotto questa persona.</p>
      ${fratelli.length ? `<div class="field" style="margin-top:14px"><span class="small">Facoltativo: anche altri di ${esc(sopra)} sono in realtà suoi?
        Spunta solo se è così.</span>
        <div class="scelte">${fratelli.map(y => `<label><input type="checkbox" name="sotto" value="${esc(y.id)}"> ${esc(y.nome)}</label>`).join("")}</div></div>` : ""}
      ${campiQualifica(false)}
      <label class="check"><input type="checkbox" name="consenso" required>
        <span>Ho il suo consenso (a voce o per messaggio) a inserire il suo nome e i suoi numeri nell'app.</span></label>
      ${piede}${err}
    </form>`;
  }
  if(s === "conferma"){
    const p = st.struttura.find(x => x.id === st.confermaId);
    if(!p) return "";
    return `<h2>Punto di partenza di ${esc(nomeSaluto(p.nome))}</h2>
    <p class="small">Ha dichiarato: <b>${esc(testoPartenza(p))}</b>. Se è giusto conferma; se no correggilo e poi conferma.</p>
    <form data-form="conferma" novalidate>
      ${campiQualifica(false, { valore:valoreQualifica(p), mese:p.qualifica_iniziale_mese ? meseDi(p.qualifica_iniziale_mese) : "",
                               pagamenti:p.pagamenti_iniziali, senzaData:true })}
      <div class="row" style="margin-top:16px"><button type="button" class="btn ghost grow" data-act="chiudi">Annulla</button>
        <button class="btn primary grow">Conferma</button></div>
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
  storico(){ st.sheet = "storico"; render(); },
  "vista-io"(){ st.vista = "io"; st.target = null; render(); window.scrollTo(0, 0); },
  "vista-gruppo"(){ st.vista = "gruppo"; st.target = null; st.schedaId = null; render(); window.scrollTo(0, 0); },
  async "apri-scheda"(el){
    const p = st.struttura.find(x => x.id === el.dataset.id);
    if(!p) return;
    st.schedaId = p.id; st.target = p.stato === "gestito" ? p.id : null; st.attScheda = [];
    st.vista = "scheda"; render(); window.scrollTo(0, 0);
    try{ st.attScheda = (await api.activities(p.id, primaDataAperta()) || []).filter(a => a.data >= primaDataAperta()); render(); }
    catch(e){ toast(messaggio(e)); }
  },
  conferma(el){ st.confermaId = el.dataset.id; st.sheet = "conferma"; render(); },
  "cambia-sponsor"(el){ st.spostaId = el.dataset.id; st.errore = ""; st.sheet = "cambia-sponsor"; render(); },
  async cancella(el){
    const p = st.struttura.find(x => x.id === el.dataset.id);
    if(!p) return;
    const sopra = p.sponsor_id === st.profilo.id ? "te" : nomeDi(p.sponsor_id);
    const sotto = figli(p.id).length;
    if(!confirm(`Cancellare ${p.nome} dalla struttura?\n\nI suoi dati (attività, obiettivi, storico) vengono cancellati.`
      + (sotto ? `\n${sotto === 1 ? "La persona del suo gruppo passa" : `Le ${sotto} persone dirette del suo gruppo passano`} a ${sopra}, con tutto il loro gruppo.` : "")
      + "\n\nNon si può annullare.")) return;
    try{
      await api.cancella(p.id);
      await caricaStruttura(); await caricaNumeri();
      st.vista = "gruppo"; st.schedaId = null; st.target = null; render(); window.scrollTo(0, 0);
      toast(`${p.nome} cancellato${sotto ? `: il suo gruppo ora è di ${sopra}` : ""}`);
    }catch(e){ toast(messaggio(e)); }
  },
  "in-mezzo"(el){ st.inMezzoId = el.dataset.id; st.errore = ""; st.sheet = "in-mezzo"; render(); },
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
  aggiungi(){ st.errore = ""; st.sheet = "aggiungi"; render(); },
  async "manda-link"(el){
    const p = st.struttura.find(x => x.id === el.dataset.id);
    if(!p) return;
    try{ st.linkGestito = { nome:p.nome, chiave: await api.linkGestito(p.id) }; st.sheet = "link-gestito"; render(); }
    catch(e){ toast(messaggio(e)); }
  },
  "copia-gestito"(){ copiaTesto(base() + "#chiave=" + st.linkGestito.chiave, "Link copiato"); },
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
  async incolla(f){
    const l = leggiLink(f.link.value);
    if(!l){ mostraErroreForm(f, "Non sembra un link di Growup. Copia tutto il messaggio con il link e riprova."); return; }
    if(l.chiave){ await entraConChiave(l.chiave); return; }
    await apriInvito(l.invito); render();
  },
  async "privacy-primo"(f){
    if(!f.privacy.checked){ mostraErroreForm(f, "Per iniziare serve accettare l'informativa privacy."); return; }
    try{
      await api.accettaPrivacy(st.profilo.id);
      st.profilo.privacy_accettata_il = new Date().toISOString();
      st.fase = "home"; render();
    }catch(e){ mostraErroreForm(f, messaggio(e)); }
  },
  async "cambia-sponsor"(f){
    const x = st.struttura.find(y => y.id === st.spostaId);
    try{
      await api.cambiaSponsor(st.spostaId, f.sponsor.value);
      await caricaStruttura(); await caricaNumeri();
      st.sheet = null; render();
      toast(`${x ? x.nome : ""} ora è ${f.sponsor.value === st.profilo.id ? "nel vostro gruppo diretto" : "nel gruppo di " + nomeDi(f.sponsor.value)}`);
    }catch(e){ mostraErroreForm(f, messaggio(e)); }
  },
  async "in-mezzo"(f){
    const nome = f.nome.value.trim();
    const sotto = Array.from(f.querySelectorAll("input[name=sotto][type=hidden], input[name=sotto]:checked")).map(i => i.value);
    const q = leggiQualifica(f);
    let err = "";
    if(!nome) err = "Scrivi il nome della persona.";
    else if(!sotto.length) err = "Spunta almeno una persona che sta sotto di lei.";
    else if(q.data && q.data > oggi()) err = "La data di iscrizione non può essere nel futuro.";
    else if(q.mancaMese) err = "Indica il mese della prima qualifica.";
    else if(!f.consenso.checked) err = "Serve il suo consenso per inserirla nell'app.";
    if(err){ mostraErroreForm(f, err); return; }
    st.occupato = true;
    try{
      await api.inMezzo({ p_nome:nome, p_sotto:sotto, p_data_iscrizione:q.data, p_qualifica:q.qualifica,
        p_percentuale:q.percentuale, p_qualifica_mese:q.mese, p_pagamenti:q.pagamenti });
      await caricaStruttura(); await caricaNumeri();
      st.sheet = null; st.vista = "gruppo"; st.target = null; st.schedaId = null;
      render(); window.scrollTo(0, 0);
      const nomi = sotto.map(nomeDi).map(nomeSaluto).join(", ");
      toast(`${nome} inserito: ora ${nomi} ${sotto.length === 1 ? "è" : "sono"} nel suo gruppo`);
    }catch(e){ mostraErroreForm(f, messaggio(e)); }
    st.occupato = false;
  },
  async conferma(f){
    const q = leggiQualifica(f);
    if(q.mancaMese){ mostraErroreForm(f, "Indica il mese della prima qualifica."); return; }
    try{
      await api.conferma({ p_partner:st.confermaId, p_qualifica:q.qualifica, p_percentuale:q.percentuale,
                           p_qualifica_mese:q.mese, p_pagamenti:q.pagamenti });
      await caricaStruttura();
      st.sheet = null; render(); toast("Punto di partenza confermato");
    }catch(e){ mostraErroreForm(f, messaggio(e)); }
  },
  async aggiungi(f){
    const nome = f.nome.value.trim();
    const q = leggiQualifica(f);
    let err = "";
    if(!nome) err = "Scrivi il nome della persona.";
    else if(q.data && q.data > oggi()) err = "La data di iscrizione non può essere nel futuro.";
    else if(q.mancaMese) err = "Indica il mese della prima qualifica.";
    else if(!f.consenso.checked) err = "Serve il suo consenso per inserirla nell'app.";
    if(err){ mostraErroreForm(f, err); return; }
    const sotto = st.struttura.find(p => p.id === f.sponsor.value);
    st.occupato = true;
    try{
      await api.aggiungi({ p_nome:nome, p_sponsor:f.sponsor.value, p_data_iscrizione:q.data, p_qualifica:q.qualifica,
        p_percentuale:q.percentuale, p_qualifica_mese:q.mese, p_pagamenti:q.pagamenti });
      await caricaStruttura();
      st.sheet = null; render();
      toast(`${nome} aggiunto ${sotto && sotto.id !== st.profilo.id ? "al gruppo di " + sotto.nome : "al tuo gruppo"}`);
    }catch(e){ mostraErroreForm(f, messaggio(e)); }
    st.occupato = false;
  },
  async ingresso(f){
    const nome = f.nome.value.trim();
    const q = leggiQualifica(f);
    const data = q.data, qual = q.qualifica, t = q.tappa;
    let err = "";
    if(!nome) err = "Scrivi il tuo nome.";
    else if(!qual && !q.percentuale && !data) err = "Se stai iniziando serve la data di iscrizione: fa partire il conto alla rovescia del primo ordine.";
    else if(data && data > oggi()) err = "La data di iscrizione non può essere nel futuro.";
    else if(q.mancaMese) err = "Indica il mese della prima qualifica.";
    else if(!f.privacy.checked) err = "Per iniziare serve accettare l'informativa privacy.";
    if(err){ mostraErroreForm(f, err); return; }
    st.occupato = true; f.querySelector("button.primary").disabled = true;
    try{
      await sessione();
      const r = await api.join({
        p_codice: st.invito, p_nome: nome, p_data_iscrizione: data, p_qualifica: qual,
        p_qualifica_mese: q.mese, p_pagamenti: q.pagamenti, p_percentuale: q.percentuale
      });
      ricordaChiave(r.chiave);
      salvaLocale(CHIAVE_SALVATA, null);
      await vaiHome(r.profilo);
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
  const fn = MODULI[f.dataset.form];
  if(fn) fn(f);
});

/* Qualifica scelta: mostra mese e pagamenti per Foundation e Builder; la data di iscrizione
   è obbligatoria solo per chi inizia (nel modulo d'ingresso). */
document.addEventListener("change", e => {
  if(e.target.name !== "qualifica") return;
  const f = e.target.form;
  const t = st.stages.find(s => s.chiave === f.qualifica.value);
  f.querySelector("[data-mostra=pagamenti]").hidden = !(t && t.pagamenti_max);
  const obbl = f.querySelector("[data-obbl]");
  if(obbl && f.dataset.form === "ingresso") obbl.textContent = f.qualifica.value ? "(facoltativa)" : "(obbligatoria per chi inizia)";
});

/* Appena si corregge un campo, l'errore del modulo sparisce. */
document.addEventListener("input", e => {
  const err = e.target.form && e.target.form.querySelector(".errore");
  if(err) err.remove();
});

document.addEventListener("keydown", e => {
  if(e.key === "Escape" && st.sheet){ st.sheet = null; render(); }
});

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
