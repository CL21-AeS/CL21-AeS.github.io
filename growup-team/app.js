/* ============================================================
   GROWUP TEAM — Fase 1
   Si entra senza email: con il link d'invito dello sponsor la prima volta, poi con il
   proprio LINK PERSONALE (…/#chiave=…), che si tiene su WhatsApp o Telegram.
   "La mia settimana" (contatti e piani), "Il mio mese" (VP e clienti),
   + Contatto / + Piano / + Ordine, e il percorso base: visione Argento e tappa attuale.
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
const INIZIO_NUOVE_ISCRIZIONI = "2026-06-01";
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
    join:         args => q(sb.rpc("join_with_code", args)),
    cambiaChiave: () => q(sb.rpc("cambia_chiave")),
    stages:       () => q(sb.from("stage_requirements").select("*").order("ordine")),
    settings:     () => q(sb.from("settings").select("chiave,valore")),
    /* la settimana e il mese in corso per intero; ordini e clienti di sempre (servono alle tappe) */
    activities:   (pid, dal) => q(sb.from("activities").select("*").eq("partner_id", pid)
                    .or(`data.gte.${dal},tipo.in.(ordine,cliente)`).order("inserito_il")),
    addActivity:  row => q(sb.from("activities").insert(row).select().single()),
    deleteActivity: id => q(sb.from("activities").delete().eq("id", id)),
    lastGoal:     (pid, finoA) => q(sb.from("goals").select("*").eq("partner_id", pid)
                    .lte("settimana", finoA).order("settimana", { ascending:false }).limit(1)),
    saveGoal:     row => q(sb.from("goals").upsert(row, { onConflict:"partner_id,settimana" }).select().single()),
    lastMonthGoal: (pid, finoA) => q(sb.from("monthly_goals").select("*").eq("partner_id", pid)
                    .lte("mese", finoA).order("mese", { ascending:false }).limit(1)),
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
function vpMese(m){ return somma(attivita("ordine").filter(a => meseDi(a.data) === m), "vp"); }
function clientiMese(m){ return somma(attivita("cliente").filter(a => meseDi(a.data) === m), "quantita"); }
function clientiTotali(){ return somma(attivita("cliente"), "quantita"); }

function finestraPrimoOrdine(tappa){
  const p = st.profilo;
  if(!p.data_iscrizione || !tappa.giorni_scadenza) return null;
  const fine = piuGiorni(p.data_iscrizione, tappa.giorni_scadenza);
  const vp = somma(attivita("ordine").filter(a => a.data >= p.data_iscrizione && a.data <= fine), "vp");
  return { fine, vp, restano: giorniTra(oggi(), fine) };
}

/* Una tappa è fatta se la qualifica dichiarata la comprende, oppure se i dati lo dicono.
   In Fase 1 i dati bastano solo per le tappe personali (primo ordine, primi clienti):
   dal Path to Bronze in su servono le linee, che arrivano con la Fase 2. */
function tappaFatta(t){
  if(t.chiave === "primo_ordine"){
    const f = finestraPrimoOrdine(t);
    if(f && f.vp >= t.vp_personali) return true;
    return Object.values(perMese(attivita("ordine"), "vp")).some(v => v >= t.vp_personali);
  }
  /* i PRIMI 3 clienti, in totale: chi si iscrive il 29 non ha il tempo di farli nel mese */
  if(t.chiave === "primi_clienti") return clientiTotali() >= (t.clienti || 0);
  return false;
}

function percorso(){
  const S = st.stages;
  let fatte = st.profilo ? S.findIndex(s => s.chiave === st.profilo.qualifica_iniziale) : -1;
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
  if(Number(t.vp_personali) > 0){
    const vp = vpMese(m);
    out.push({ ok: vp >= t.vp_personali, txt: `${num(t.vp_personali)} VP personali nel mese`, val: `${num(vp)} / ${num(t.vp_personali)}` });
  }
  if(t.linee){
    let txt = t.vp_linea ? `${t.linee} linee frontali da almeno ${num(t.vp_linea)} VP` : `Almeno ${t.linee} linee`;
    if(t.linee_nuove_dal) txt = `${t.linee} nuove prime linee (iscritte dal ${dataIt(t.linee_nuove_dal)}) da almeno ${num(t.vp_linea)} VP`;
    out.push({ attesa:true, txt });
  }
  if(t.vp_gruppo) out.push({ attesa:true, txt: `${num(t.vp_gruppo)} VP di gruppo nel mese` });
  return out;
}

function pagamenti(t){
  const p = st.profilo;
  if(!t || !t.pagamenti_max || !p.qualifica_iniziale_mese) return "";
  const passati = mesiTra(meseDi(p.qualifica_iniziale_mese), meseDi(oggi()));
  const restano = Math.max(0, (t.mesi_finestra || 18) - passati);
  return `Pagamenti ${p.pagamenti_iniziali || 0} di ${t.pagamenti_max}, restano ${restano} mesi su ${t.mesi_finestra || 18}`;
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

async function aggiornaAttivita(){
  if(st.fase !== "home" || !st.profilo) return;
  try{
    st.att = await api.activities(st.profilo.id, [settimana(), primoDelMese()].sort()[0]) || [];
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
  salvaLocale(CHIAVE_INVITO, null); st.invito = null;
  await caricaTutto();
  st.fase = "home";
}

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
                  ingresso:vIngresso, home:vHome, errore:vErrore };
  const html = (viste[st.fase] || vAvvio)();
  if(html !== ultimoApp){ app.innerHTML = html; ultimoApp = html; }
  document.body.classList.toggle("con-azioni", st.fase === "home");
  document.getElementById("azioni").innerHTML = st.fase === "home" ? vAzioni() : "";
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

function marchio(){ return `<div class="eyebrow">CumLaude21 · Growup Team</div>`; }

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
    <p class="small"><b>Sei nuovo?</b> Chiedi al tuo sponsor il suo link d'invito.<br>
      <b>Hai perso il link?</b> Chiedi a Stefano e Alessia: te ne mandano uno nuovo.</p>
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

function vIngresso(){
  const opz = st.stages.map(s => `<option value="${esc(s.chiave)}">${esc(s.nome)}</option>`).join("");
  return `<div>
    ${marchio()}
    <h1 style="margin-top:6px">Benvenuto in Growup</h1>
    <p class="muted">${st.sponsorNome ? `Ti ha invitato <b>${esc(st.sponsorNome)}</b>. ` : ""}Due cose e sei dentro: servono per partire dal punto giusto del percorso.</p>
    <form data-form="ingresso" class="card" novalidate>
      <label class="field" style="margin-top:0"><span>Nome e cognome</span>
        <input name="nome" autocomplete="name" required maxlength="80"></label>

      <div class="field" style="margin-top:14px"><span class="small">Quando ti sei iscritto ad Amway?</span>
        <div class="scelte">
          <label><input type="radio" name="quando" value="dopo"> Dal 1° giugno 2026 in poi</label>
          <label><input type="radio" name="quando" value="prima"> Prima del 1° giugno 2026</label>
        </div></div>
      <label class="field"><span>Data di iscrizione <i data-obbl>(obbligatoria)</i></span>
        <input type="date" name="data" max="${oggi()}"></label>

      <label class="field"><span>Qualifica più alta già raggiunta</span>
        <select name="qualifica"><option value="">Nessuna, sto iniziando</option>${opz}</select></label>
      <div data-mostra="pagamenti" hidden>
        <label class="field"><span>Mese della prima qualifica</span>
          <input type="month" name="mese" max="${meseDi(oggi())}"></label>
        <label class="field"><span>Pagamenti già ricevuti (su 12)</span>
          <input type="number" name="pagamenti" min="0" max="12" inputmode="numeric" value="0"></label>
      </div>
      <p class="nota">Il punto di partenza lo conferma poi il tuo sponsor, così i numeri del gruppo restano affidabili.</p>

      <label class="check"><input type="checkbox" name="privacy" required>
        <span>Ho letto l'<button type="button" class="btn link" data-act="privacy" style="min-height:0;padding:0">informativa privacy</button>
        e accetto che i miei numeri (contatti, piani, VP) siano visibili a me e alla mia upline.</span></label>

      <button class="btn primary wide" style="margin-top:16px" ${st.occupato ? "disabled" : ""}>Entra</button>
      ${st.errore ? `<p class="errore">${esc(st.errore)}</p>` : ""}
    </form>
    <p class="small">Hai già un profilo? <button class="btn link" data-act="ho-gia">Entra con il tuo link personale</button></p>
  </div>`;
}

function vHome(){
  const p = st.profilo;
  return `
  <div class="testata">
    <div>${marchio()}<h1>Ciao ${esc(nomeSaluto(p.nome))}</h1></div>
    <button class="menu-btn" data-act="menu" aria-label="Menu">⋯</button>
  </div>
  ${leggiLocale(CHIAVE_SALVATA) === "1" || !st.chiave ? "" : vSalvaChiave()}
  ${vVisione()}
  ${vTappa()}
  ${vSettimana()}
  ${vMese()}
  ${vOggi()}
  ${vInvita()}`;
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
  const attesa = req.some(r => r.attesa);
  const nelMese = Number(attuale.vp_personali) > 0 && attuale.chiave !== "primo_ordine";
  return `<div class="card">
    <div class="spread"><span class="eyebrow">Tappa ${indice + 1} di ${st.stages.length}</span>
      ${raggiunta ? `<span class="pill v">✓ ${esc(raggiunta.nome)}</span>` : ""}</div>
    <h2 style="margin-top:4px">${esc(attuale.nome)}</h2>
    ${attuale.guadagno_mese ? `<p class="small" style="margin:2px 0 0">Circa ${euro(attuale.guadagno_mese)} al mese* con ${esc(attuale.struttura_calcolo || "")}</p>` : ""}
    ${scadenza}
    <ul class="req">${req.map(r => `<li class="${r.ok ? "ok" : ""} ${r.attesa ? "attesa" : ""}">
      <span class="mark">${r.ok ? "✓" : r.attesa ? "·" : "○"}</span>
      <span class="grow">${esc(r.txt)}${r.cliente ? ` <button class="btn link small" data-act="cliente" style="min-height:0">+ Cliente</button>` : ""}</span>
      ${r.val ? `<span class="num">${esc(r.val)}</span>` : ""}</li>`).join("")}</ul>
    ${attesa ? `<p class="nota">I punti grigi (linee e VP di gruppo) si calcolano da soli quando il tuo gruppo usa Growup Team.</p>` : ""}
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
      <button class="btn small ghost" data-act="obiettivo-mese">Modifica</button></div>
    <div style="margin-top:12px">${barra("VP fatturati", vpMese(m), st.goalMese.obiettivo_vp)}</div>
    <div class="spread" style="margin-top:12px">
      <span>Nuovi clienti nel mese <b class="num">${num(c)}</b></span>
      <button class="btn small" data-act="cliente" style="white-space:nowrap">+ Cliente</button>
    </div>
    ${primiFatti ? "" : `<p class="small" style="margin:4px 0 0">I tuoi primi 3 clienti (anche in mesi diversi) completano la tappa «Primi clienti»: ${num(clientiTotali())} su 3.</p>`}
  </div>`;
}

const ETICHETTE = { contatto:"Contatto", piano:"Piano mostrato", ordine:"Ordine", cliente:"Nuovo cliente" };
function vOggi(){
  const l = st.att.filter(a => a.data === oggi()).slice().reverse();
  return `<div class="card">
    <div class="spread"><span class="eyebrow">Oggi</span><span class="small">${dataIt(oggi())}</span></div>
    ${l.length ? `<ul class="oggi">${l.map(a => `<li>
      <span class="grow">${ETICHETTE[a.tipo]}${a.tipo === "ordine" ? ` · <b>${num(a.vp)} VP</b>` : a.quantita > 1 ? ` × ${a.quantita}` : ""}</span>
      <span class="small">${a.inserito_il ? fmtOra.format(new Date(a.inserito_il)) : ""}</span>
      ${String(a.id).startsWith("tmp") ? "" : `<button class="x" data-act="elimina" data-id="${esc(a.id)}" aria-label="Elimina">×</button>`}</li>`).join("")}</ul>`
      : `<p class="muted" style="margin:8px 0 0">Ancora niente oggi. Un contatto, un piano, un ordine: si registra con un tocco qui sotto.</p>`}
  </div>`;
}

function testoInvito(){
  return `Ciao! Ti mando Growup, l'app del nostro gruppo per pianificare la settimana e seguire il percorso fino ad Argento. `
       + `Apri il link e sei dentro, non serve nessuna registrazione:`;
}
function vInvita(){
  return `<div class="card">
    <span class="eyebrow">Invita un nuovo partner</span>
    <p class="small" style="margin:4px 0 0">Chi entra con questo link viene messo sotto di te. Non è il tuo link personale: questo si può girare.</p>
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
  if(s === "ordine") return `<h2>Nuovo ordine</h2>
    <form data-form="ordine" novalidate>
      <label class="field"><span>VP dell'ordine</span>
        <input name="vp" type="text" inputmode="decimal" autocomplete="off" required autofocus placeholder="es. 60 o 62,5"></label>
      <label class="field"><span>Data</span><input name="data" type="date" value="${oggi()}" max="${oggi()}"></label>
      ${piede}${err}
    </form>`;
  if(s === "obiettivi") return `<h2>Obiettivi della settimana</h2>
    <p class="small">Valgono da lunedì ${dataIt(settimana())}. La settimana prossima ripartono da questi.</p>
    <form data-form="obiettivi" novalidate>
      <label class="field"><span>Nuovi contatti</span><input name="contatti" type="number" inputmode="numeric" min="0" max="1000" value="${Number(st.goal.obiettivo_contatti) || 0}"></label>
      <label class="field"><span>Piani mostrati</span><input name="piani" type="number" inputmode="numeric" min="0" max="1000" value="${Number(st.goal.obiettivo_piani) || 0}"></label>
      ${piede}${err}
    </form>`;
  if(s === "obiettivo-mese") return `<h2>Obiettivo del mese</h2>
    <p class="small">VP fatturati in ${nomeMese(meseDi(oggi()))}. Il mese prossimo riparte da questo.</p>
    <form data-form="obiettivo-mese" novalidate>
      <label class="field"><span>VP fatturati nel mese</span><input name="vp" type="text" inputmode="decimal" autocomplete="off" value="${num(st.goalMese.obiettivo_vp)}"></label>
      ${piede}${err}
    </form>`;
  if(s === "menu") return `<h2>${esc(st.profilo ? st.profilo.nome : "")}</h2>
    <div class="stack" style="margin-top:12px">
      <button class="btn wide" data-act="mia-chiave">Il mio link personale</button>
      <button class="btn wide" data-act="privacy">Informativa privacy</button>
      <button class="btn wide" data-act="esci">Esci da questo telefono</button>
      <button class="btn wide ghost" data-act="chiudi">Chiudi</button>
    </div>
    <p class="nota">Il tuo codice d'invito: <b>${esc(st.profilo ? st.profilo.codice_invito : "")}</b> · Per cancellare il profilo e i tuoi dati scrivi a Stefano e Alessia.</p>`;
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
  if(s === "privacy") return `<h2>Informativa privacy (breve)</h2>
    <div class="small stack" style="margin-top:10px">
      <p><b>Cosa raccogliamo.</b> Nome, data di iscrizione, qualifica e i tuoi numeri: quanti contatti,
        quanti piani, quanti VP, quanti clienti. Dei tuoi contatti e clienti registriamo <b>solo il numero</b>: nessun nome né telefono.
        Non serve la tua email.</p>
      <p><b>Chi li vede.</b> Tu e chi sta sopra di te nella tua organizzazione (la tua upline). Nessun altro.</p>
      <p><b>A cosa servono.</b> A pianificare la tua settimana e a farti aiutare da chi ti segue.</p>
      <p><b>Dove stanno.</b> In un database ospitato nell'Unione Europea (Supabase).</p>
      <p><b>I tuoi diritti.</b> Puoi chiedere in qualsiasi momento di vedere, correggere o cancellare il tuo
        profilo e tutti i tuoi dati: scrivi a Stefano e Alessia (CumLaude21).</p>
    </div>
    <button class="btn wide" style="margin-top:14px" data-act="chiudi">Ho capito</button>`;
  return "";
}

/* ---- 11. Azioni ---- */
async function registra(tipo, extra){
  const p = st.profilo;
  const riga = Object.assign({ partner_id:p.id, tipo, quantita:1, data:oggi() }, extra || {});
  const tmp = Object.assign({ id:"tmp" + Math.random().toString(36).slice(2), inserito_il:new Date().toISOString() }, riga);
  st.att.push(tmp); render();
  const promessa = api.addActivity(riga);
  const msg = tipo === "ordine" ? `Ordine da ${num(riga.vp)} VP registrato` : `${ETICHETTE[tipo]} registrato`;
  toast(msg, async () => {
    try{
      const vero = await promessa;
      await api.deleteActivity(vero.id);
      st.att = st.att.filter(a => a.id !== vero.id && a.id !== tmp.id);
      render(); toast("Annullato");
    }catch(e){ toast(messaggio(e)); }
  });
  try{
    const vero = await promessa;
    const i = st.att.findIndex(a => a.id === tmp.id);
    if(i >= 0) st.att[i] = vero;
    render();
  }catch(e){
    st.att = st.att.filter(a => a.id !== tmp.id); render();
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
  menu(){ st.sheet = "menu"; render(); },
  "mia-chiave"(){ st.sheet = "mia-chiave"; render(); },
  privacy(){ st.sheet = "privacy"; render(); },
  chiudi(){ st.sheet = null; render(); },
  "ho-gia"(){ salvaLocale(CHIAVE_INVITO, null); st.invito = null; st.fase = "benvenuto"; render(); },
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
    const a = st.att.find(x => x.id === id);
    if(!a || !confirm(`Eliminare "${ETICHETTE[a.tipo]}${a.tipo === "ordine" ? " " + num(a.vp) + " VP" : ""}"?`)) return;
    try{ await api.deleteActivity(id); st.att = st.att.filter(x => x.id !== id); render(); toast("Eliminato"); }
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
  async ingresso(f){
    const nome = f.nome.value.trim();
    const quando = (f.querySelector("input[name=quando]:checked") || {}).value;
    const data = f.data.value || null;
    const qual = f.qualifica.value || null;
    const t = st.stages.find(s => s.chiave === qual);
    let err = "";
    if(!nome) err = "Scrivi il tuo nome.";
    else if(!quando) err = "Dicci quando ti sei iscritto.";
    else if(quando === "dopo" && !data) err = "Serve la data di iscrizione: fa partire il conto alla rovescia del primo ordine.";
    else if(quando === "dopo" && data < INIZIO_NUOVE_ISCRIZIONI) err = "Hai scelto «dal 1° giugno 2026»: la data deve essere da quel giorno in poi.";
    else if(quando === "prima" && data && data >= INIZIO_NUOVE_ISCRIZIONI) err = "Hai scelto «prima del 1° giugno 2026»: controlla la data.";
    else if(data && data > oggi()) err = "La data di iscrizione non può essere nel futuro.";
    else if(t && t.pagamenti_max && !f.mese.value) err = "Indica il mese della prima qualifica.";
    else if(!f.privacy.checked) err = "Per entrare serve accettare l'informativa privacy.";
    if(err){ mostraErroreForm(f, err); return; }
    st.occupato = true; f.querySelector("button.primary").disabled = true;
    try{
      await sessione();
      const r = await api.join({
        p_codice: st.invito, p_nome: nome, p_data_iscrizione: data, p_qualifica: qual,
        p_qualifica_mese: t && t.pagamenti_max && f.mese.value ? f.mese.value + "-01" : null,
        p_pagamenti: t && t.pagamenti_max ? Math.max(0, Math.min(12, Number(f.pagamenti.value) || 0)) : 0
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
    st.sheet = null;
    await registra("ordine", { vp:Math.round(vp * 100) / 100, data });
  },
  async obiettivi(f){
    const n = v => Math.max(0, Math.min(1000, Math.round(numIt(v) || 0)));
    try{ await salvaObiettivi(n(f.contatti.value), n(f.piani.value)); st.sheet = null; render(); toast("Obiettivi salvati"); }
    catch(e){ mostraErroreForm(f, messaggio(e)); }
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

document.addEventListener("change", e => {
  const f = e.target.closest("form[data-form=ingresso]");
  if(!f) return;
  const quando = (f.querySelector("input[name=quando]:checked") || {}).value;
  const obbl = f.querySelector("[data-obbl]");
  if(obbl) obbl.textContent = quando === "prima" ? "(facoltativa)" : "(obbligatoria)";
  const t = st.stages.find(s => s.chiave === f.qualifica.value);
  f.querySelector("[data-mostra=pagamenti]").hidden = !(t && t.pagamenti_max);
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
