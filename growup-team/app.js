/* ============================================================
   GROWUP TEAM — Fase 1
   Login con email (link + codice), profilo agganciato allo sponsor,
   "La mia settimana" con obiettivi, + Contatto / + Piano / + Ordine,
   e il percorso base: visione Argento e tappa attuale.
   I dati stanno in Supabase; la sicurezza sta nella RLS (supabase/002_rls.sql).
   ============================================================ */
(function(){
"use strict";

const CFG = window.GROWUP_CONFIG || {};
const TZ = "Europe/Rome";
const CHIAVE_INVITO = "growup-team.invito";
const FORMA_CODICE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
const INIZIO_NUOVE_ISCRIZIONI = "2026-06-01";
const PROPOSTA_BASE = { contatti:10, piani:3, vp:25 };

/* ---- 1. Accesso ai dati: tutto passa da qui ----
   I test sostituiscono questo oggetto con window.GROWUP_API. */
function creaApi(){
  if(window.GROWUP_API) return window.GROWUP_API;
  if(!CFG.supabaseUrl || !CFG.supabaseKey || !window.supabase) return null;
  const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {
    auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
  });
  const q = async p => { const { data, error } = await p; if(error) throw error; return data; };
  const indirizzo = location.origin + location.pathname;
  return {
    session:      async () => (await sb.auth.getSession()).data.session,
    onAuth:       cb => sb.auth.onAuthStateChange((ev, s) => cb(ev, s)),
    sendCode:     email => q(sb.auth.signInWithOtp({ email, options:{ emailRedirectTo:indirizzo, shouldCreateUser:true } })),
    verifyCode:   (email, token) => q(sb.auth.verifyOtp({ email, token, type:"email" })),
    signOut:      () => sb.auth.signOut(),
    sponsorName:  codice => q(sb.rpc("sponsor_da_codice", { p_codice:codice })),
    collega:      () => q(sb.rpc("collega_profilo")),
    join:         args => q(sb.rpc("join_with_code", args)),
    stages:       () => q(sb.from("stage_requirements").select("*").order("ordine")),
    settings:     () => q(sb.from("settings").select("chiave,valore")),
    /* la settimana e il mese in corso per intero; ordini e clienti di sempre (servono alle tappe) */
    activities:   (pid, dal) => q(sb.from("activities").select("*").eq("partner_id", pid)
                    .or(`data.gte.${dal},tipo.in.(ordine,cliente)`).order("inserito_il")),
    addActivity:  row => q(sb.from("activities").insert(row).select().single()),
    deleteActivity: id => q(sb.from("activities").delete().eq("id", id)),
    lastGoal:     (pid, finoA) => q(sb.from("goals").select("*").eq("partner_id", pid)
                    .lte("settimana", finoA).order("settimana", { ascending:false }).limit(1)),
    saveGoal:     row => q(sb.from("goals").upsert(row, { onConflict:"partner_id,settimana" }).select().single())
  };
}
const api = creaApi();

/* ---- 2. Stato ---- */
const st = {
  fase: "avvio",          // avvio | config | login | codice | senza_invito | ingresso | home | errore
  profilo: null,
  stages: [],
  settings: {},
  att: [],
  goal: null,             // { obiettivo_contatti, obiettivo_piani, obiettivo_vp, salvato:bool }
  invito: null,           // codice dello sponsor dal link
  sponsorNome: "",
  email: "",
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
function salvaLocale(k, v){ try{ v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); }catch(e){} }
function leggiLocale(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }

let toastT = null, toastAnnulla = null;
function toast(msg, annulla){
  const t = document.getElementById("toast");
  clearTimeout(toastT);
  toastAnnulla = annulla || null;
  t.innerHTML = `<div class="toast" role="status"><span>${esc(msg)}</span>${annulla ? `<button data-act="annulla">Annulla</button>` : ""}</div>`;
  toastT = setTimeout(() => { t.innerHTML = ""; toastAnnulla = null; }, annulla ? 5000 : 3000);
}

const MESSAGGI_ERRORE = {
  codice_non_valido: "Il link dello sponsor non è valido. Chiedigli di rimandartelo.",
  profilo_esistente: "Hai già un profilo: ricarica la pagina.",
  data_futura: "La data di iscrizione non può essere nel futuro.",
  qualifica_non_valida: "Qualifica non riconosciuta.",
  non_autenticato: "Sessione scaduta: entra di nuovo."
};
function messaggio(e){
  const m = (e && (e.message || e.error_description || e.msg)) || String(e || "");
  for(const k in MESSAGGI_ERRORE) if(m.includes(k)) return MESSAGGI_ERRORE[k];
  if(/token|otp|expired|invalid/i.test(m)) return "Codice non valido o scaduto. Controlla l'ultima email o fatti mandare un codice nuovo.";
  if(/rate|too many|seconds/i.test(m)) return "Troppe richieste ravvicinate: aspetta un minuto e riprova.";
  if(/fetch|network|failed/i.test(m)) return "Sembra che manchi la connessione. Riprova tra poco.";
  return "Qualcosa non è andato: " + m;
}

/* ---- 5. Percorso: tappe, requisiti, visione ---- */
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

function finestraPrimoOrdine(tappa){
  const p = st.profilo;
  if(!p.data_iscrizione || !tappa.giorni_scadenza) return null;
  const fine = piuGiorni(p.data_iscrizione, tappa.giorni_scadenza);
  const vp = somma(attivita("ordine").filter(a => a.data >= p.data_iscrizione && a.data <= fine), "vp");
  return { fine, vp, restano: giorniTra(oggi(), fine) };
}

/* Una tappa è fatta se la qualifica dichiarata la comprende, oppure se i dati lo dicono.
   In Fase 1 i dati bastano solo per le tappe personali (primo ordine, clienti):
   dal Path to Bronze in su servono le linee, che arrivano con la Fase 2. */
function tappaFatta(t){
  if(t.chiave === "primo_ordine"){
    const f = finestraPrimoOrdine(t);
    if(f && f.vp >= t.vp_personali) return true;
    return Object.values(perMese(attivita("ordine"), "vp")).some(v => v >= t.vp_personali);
  }
  if(t.chiave === "primi_clienti"){
    return Object.values(perMese(attivita("cliente"), "quantita")).some(v => v >= (t.clienti || 0));
  }
  return false;
}

function percorso(){
  const S = st.stages;
  let fatte = S.findIndex(s => s.chiave === st.profilo.qualifica_iniziale);
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
    const c = clientiMese(m);
    out.push({ ok: c >= t.clienti, txt: `${t.clienti} clienti nel mese`, val: `${num(c)} / ${t.clienti}`, cliente:true });
  }
  if(Number(t.vp_personali) > 0){
    const vp = vpMese(m);
    out.push({ ok: vp >= t.vp_personali, txt: `${num(t.vp_personali)} VP personali`, val: `${num(vp)} / ${num(t.vp_personali)}` });
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

/* ---- 6. Settimana ---- */
function settimana(){ return lunedi(oggi()); }
function nellaSettimana(a){ return a.data >= settimana() && a.data <= piuGiorni(settimana(), 6); }
function fattoSettimana(tipo){
  const l = st.att.filter(a => a.tipo === tipo && nellaSettimana(a));
  return tipo === "ordine" ? somma(l, "vp") : somma(l, "quantita");
}
function proposta(){ return Object.assign({}, PROPOSTA_BASE, cfg("obiettivi_proposti") || {}); }

/* ---- 7. Caricamento ---- */
async function caricaTutto(){
  const p = st.profilo;
  const dal = [settimana(), meseDi(oggi()) + "-01"].sort()[0];
  const [stages, settings, att, goals] = await Promise.all([
    api.stages(), api.settings(), api.activities(p.id, dal), api.lastGoal(p.id, settimana())
  ]);
  st.stages = stages || [];
  st.settings = {};
  for(const r of settings || []) st.settings[r.chiave] = r.valore;
  st.att = att || [];
  const g = (goals || [])[0];
  if(g && g.settimana === settimana()) st.goal = Object.assign({}, g, { salvato:true });
  else if(g){
    /* nuova settimana: si riparte dall'ultimo obiettivo scelto */
    st.goal = Object.assign({}, g, { settimana:settimana(), salvato:true });
    api.saveGoal({ partner_id:p.id, settimana:settimana(), obiettivo_contatti:g.obiettivo_contatti,
                   obiettivo_piani:g.obiettivo_piani, obiettivo_vp:g.obiettivo_vp }).catch(() => {});
  } else {
    const pr = proposta();
    st.goal = { obiettivo_contatti:pr.contatti, obiettivo_piani:pr.piani, obiettivo_vp:pr.vp, salvato:false };
  }
}

async function aggiornaAttivita(){
  if(st.fase !== "home" || !st.profilo) return;
  try{
    const dal = [settimana(), meseDi(oggi()) + "-01"].sort()[0];
    st.att = await api.activities(st.profilo.id, dal) || [];
    render();
  }catch(e){}
}

async function dopoLogin(){
  st.fase = "avvio"; render();
  try{
    const p = await api.collega();
    if(p && p.id){
      st.profilo = p;
      salvaLocale(CHIAVE_INVITO, null);
      await caricaTutto();
      st.fase = "home";
    } else if(st.invito){
      if(!st.stages.length) st.stages = await api.stages() || [];
      st.fase = "ingresso";
    } else {
      st.fase = "senza_invito";
    }
  }catch(e){
    st.errore = messaggio(e); st.fase = "errore";
  }
  render();
}

async function avvio(){
  if(!api){ st.fase = "config"; render(); return; }
  const h = location.hash.replace(/^#/, "").trim().toUpperCase();
  if(FORMA_CODICE.test(h)){ st.invito = h; salvaLocale(CHIAVE_INVITO, h); }
  else st.invito = leggiLocale(CHIAVE_INVITO);
  if(st.invito){ api.sponsorName(st.invito).then(n => { st.sponsorNome = n || ""; render(); }).catch(() => {}); }

  let entrato = false;
  api.onAuth((ev, s) => {
    /* fuori dal callback: dentro, le chiamate a Supabase restano in attesa del lock di auth */
    if(ev === "SIGNED_IN" && s && !entrato){ entrato = true; setTimeout(dopoLogin, 0); }
    if(ev === "SIGNED_OUT"){ entrato = false; st.profilo = null; st.fase = "login"; render(); }
  });
  try{
    const s = await api.session();
    if(s){ if(!entrato){ entrato = true; await dopoLogin(); } return; }
  }catch(e){}
  if(!entrato){ st.fase = "login"; render(); }
}

/* ---- 8. Viste ---- */
/* #app si riscrive solo se è cambiato: così aprire un foglio (es. la privacy) non cancella
   quello che si sta scrivendo in un modulo. */
let ultimoApp = "";
function render(){
  const app = document.getElementById("app");
  const viste = { avvio:vAvvio, config:vConfig, login:vLogin, codice:vCodice, senza_invito:vSenzaInvito,
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
    <div class="row" style="margin-top:12px"><button class="btn primary" data-act="ricarica">Riprova</button>
    <button class="btn ghost" data-act="esci">Esci</button></div></div>`;
}

function marchio(){ return `<div class="eyebrow">CumLaude21 · Growup Team</div>`; }

function vLogin(){
  const invitato = st.invito
    ? `<p class="muted">${st.sponsorNome ? `<b>${esc(st.sponsorNome)}</b> ti ha invitato in Growup.` : "Sei stato invitato in Growup."}
       Metti la tua email: ti mandiamo un codice per entrare, senza password.</p>`
    : `<p class="muted">Metti la tua email: ti mandiamo un codice per entrare, senza password.</p>`;
  return `<div class="centro">
    ${marchio()}
    <h1 style="margin-top:6px">${st.invito ? "Benvenuto in Growup" : "Entra in Growup"}</h1>
    ${invitato}
    <form data-form="email" class="card" novalidate>
      <label class="field"><span>La tua email</span>
        <input type="email" name="email" autocomplete="email" inputmode="email" required placeholder="nome@esempio.it" value="${esc(st.email)}"></label>
      <button class="btn primary wide" style="margin-top:14px" ${st.occupato ? "disabled" : ""}>Mandami il codice</button>
      ${st.errore ? `<p class="errore">${esc(st.errore)}</p>` : ""}
    </form>
    ${st.invito ? "" : `<p class="small">Sei nuovo? Per entrare la prima volta ti serve il link personale del tuo sponsor: chiediglielo su WhatsApp o Telegram.</p>`}
  </div>`;
}

function vCodice(){
  return `<div class="centro">
    ${marchio()}
    <h1 style="margin-top:6px">Controlla la tua email</h1>
    <p class="muted">Abbiamo scritto a <b>${esc(st.email)}</b>. Dentro trovi un codice: scrivilo qui sotto.
      In alternativa tocca il link nell'email.</p>
    <form data-form="codice" class="card" novalidate>
      <label class="field"><span>Codice</span>
        <input class="codice" name="codice" inputmode="numeric" autocomplete="one-time-code" maxlength="10" required placeholder="······"></label>
      <button class="btn primary wide" style="margin-top:14px" ${st.occupato ? "disabled" : ""}>Entra</button>
      ${st.errore ? `<p class="errore">${esc(st.errore)}</p>` : ""}
    </form>
    <p class="small">Non arriva? Guarda nello spam, poi
      <button class="btn link" data-act="rimanda">mandamene un altro</button> o
      <button class="btn link" data-act="cambia-email">cambia email</button>.</p>
  </div>`;
}

function vSenzaInvito(){
  return `<div class="centro">
    <h1>Ti manca il link dello sponsor</h1>
    <p class="muted">Sei entrato come <b>${esc(st.email || "")}</b>, ma per creare il tuo profilo serve il link personale
      del tuo sponsor: così l'app sa sotto chi metterti. Chiediglielo e aprilo da questo telefono.</p>
    <button class="btn ghost" data-act="esci" style="margin-top:12px">Esci</button>
  </div>`;
}

function vIngresso(){
  const opz = st.stages.map(s => `<option value="${esc(s.chiave)}">${esc(s.nome)}</option>`).join("");
  return `<div>
    ${marchio()}
    <h1 style="margin-top:6px">Due cose e sei dentro</h1>
    <p class="muted">${st.sponsorNome ? `Il tuo sponsor è <b>${esc(st.sponsorNome)}</b>. ` : ""}Servono per partire dal punto giusto del percorso.</p>
    <form data-form="ingresso" class="card" novalidate>
      <label class="field"><span>Nome e cognome</span>
        <input name="nome" autocomplete="name" required maxlength="80"></label>

      <div class="field" style="margin-top:14px"><span class="small">Quando ti sei iscritto ad Amway?</span>
        <div class="scelte">
          <label><input type="radio" name="quando" value="dopo"> Dal 1° giugno 2026 in poi</label>
          <label><input type="radio" name="quando" value="prima"> Prima del 1° giugno 2026</label>
        </div></div>
      <label class="field" data-mostra="data"><span>Data di iscrizione <i data-obbl>(obbligatoria)</i></span>
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
  </div>`;
}

function vHome(){
  const p = st.profilo;
  return `
  <div class="testata">
    <div>${marchio()}<h1>Ciao ${esc(String(p.nome).split(" ")[0])}</h1></div>
    <button class="menu-btn" data-act="menu" aria-label="Menu">⋯</button>
  </div>
  ${vVisione()}
  ${vTappa()}
  ${vSettimana()}
  ${vOggi()}
  ${vInvita()}`;
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
    <p class="nota">Tutti i requisiti valgono nello stesso mese di calendario (${nomeMese(meseDi(oggi()))}).${attuale.guadagno_mese ? " * " + notaGuadagni() : ""}</p>
  </div>`;
}

function vSettimana(){
  const g = st.goal;
  const righe = [
    { k:"contatto", nome:"Nuovi contatti", obj:g.obiettivo_contatti, fatto:fattoSettimana("contatto") },
    { k:"piano", nome:"Piani mostrati", obj:g.obiettivo_piani, fatto:fattoSettimana("piano") },
    { k:"ordine", nome:"VP fatturati", obj:g.obiettivo_vp, fatto:fattoSettimana("ordine") }
  ];
  const fine = piuGiorni(settimana(), 6);
  return `<div class="card">
    <div class="spread"><div><span class="eyebrow">La mia settimana</span>
      <h2 style="margin-top:2px">${dataIt(settimana())} – ${dataIt(fine)}</h2></div>
      <button class="btn small ghost" data-act="obiettivi">Modifica</button></div>
    ${g.salvato ? "" : `<p class="small" style="margin:8px 0 0">Ti proponiamo questi obiettivi per iniziare. Vanno bene?
      <button class="btn link small" data-act="conferma-obiettivi">Sì, confermo</button></p>`}
    <div style="margin-top:12px">${righe.map(r => {
      const obj = Number(r.obj) || 0, pct = obj ? Math.min(100, Math.round(r.fatto / obj * 100)) : 0;
      return `<div class="obiettivo"><div class="spread"><span>${r.nome}</span>
        <span class="num">${num(r.fatto)} <span class="faint">/ ${num(obj)}</span></span></div>
        <div class="bar ${obj && r.fatto >= obj ? "fatto" : ""}" role="progressbar" aria-label="${r.nome}" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div></div>`;
    }).join("")}</div>
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
    <div class="row" style="margin-top:8px"><button class="btn link small" data-act="cliente">+ Nuovo cliente</button></div>
  </div>`;
}

function linkInvito(){ return location.origin + location.pathname + "#" + st.profilo.codice_invito; }
function testoInvito(){
  return `Ciao! Ti mando Growup, l'app del nostro gruppo per pianificare la settimana e seguire il percorso fino ad Argento. `
       + `Apri il link, metti la tua email e sei dentro:`;
}
function vInvita(){
  return `<div class="card">
    <span class="eyebrow">Invita un nuovo partner</span>
    <p class="small" style="margin:4px 0 0">Chi entra con questo link viene messo sotto di te.</p>
    <div class="condividi">
      <a class="btn wa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(testoInvito() + " " + linkInvito())}">WhatsApp</a>
      <a class="btn tg" target="_blank" rel="noopener" href="https://t.me/share/url?url=${encodeURIComponent(linkInvito())}&text=${encodeURIComponent(testoInvito())}">Telegram</a>
      ${navigator.share ? `<button class="btn" data-act="condividi">Altro…</button>` : ""}
      <button class="btn" data-act="copia">Copia link</button>
    </div>
    <div class="linkbox">${esc(linkInvito())}</div>
  </div>`;
}

function vAzioni(){
  return `<div class="azioni"><div class="in">
    <button class="btn primary" data-act="contatto">+ Contatto<b>${num(fattoSettimana("contatto"))} questa sett.</b></button>
    <button class="btn primary" data-act="piano">+ Piano<b>${num(fattoSettimana("piano"))} questa sett.</b></button>
    <button class="btn primary" data-act="ordine">+ Ordine<b>${num(fattoSettimana("ordine"))} VP</b></button>
  </div></div>`;
}

/* ---- 9. Fogli in basso ---- */
function vSheet(){
  const s = st.sheet;
  if(s === "ordine") return `<h2>Nuovo ordine</h2>
    <form data-form="ordine" novalidate>
      <label class="field"><span>VP dell'ordine</span>
        <input name="vp" type="text" inputmode="decimal" autocomplete="off" required autofocus placeholder="es. 60 o 62,5"></label>
      <label class="field"><span>Data</span><input name="data" type="date" value="${oggi()}" max="${oggi()}"></label>
      <div class="row" style="margin-top:16px"><button type="button" class="btn ghost grow" data-act="chiudi">Annulla</button>
        <button class="btn primary grow">Salva</button></div>
      ${st.errore ? `<p class="errore">${esc(st.errore)}</p>` : ""}
    </form>`;
  if(s === "obiettivi"){
    const g = st.goal;
    return `<h2>Obiettivi della settimana</h2>
    <p class="small">Valgono da lunedì ${dataIt(settimana())}. La settimana prossima ripartono da questi.</p>
    <form data-form="obiettivi" novalidate>
      <label class="field"><span>Nuovi contatti</span><input name="contatti" type="number" inputmode="numeric" min="0" max="1000" value="${Number(g.obiettivo_contatti) || 0}"></label>
      <label class="field"><span>Piani mostrati</span><input name="piani" type="number" inputmode="numeric" min="0" max="1000" value="${Number(g.obiettivo_piani) || 0}"></label>
      <label class="field"><span>VP fatturati</span><input name="vp" type="text" inputmode="decimal" autocomplete="off" value="${num(g.obiettivo_vp)}"></label>
      <div class="row" style="margin-top:16px"><button type="button" class="btn ghost grow" data-act="chiudi">Annulla</button>
        <button class="btn primary grow">Salva</button></div>
      ${st.errore ? `<p class="errore">${esc(st.errore)}</p>` : ""}
    </form>`;
  }
  if(s === "menu") return `<h2>${esc(st.profilo ? st.profilo.nome : "")}</h2>
    <p class="small">${esc(st.profilo && st.profilo.email || "")}</p>
    <div class="stack" style="margin-top:12px">
      <button class="btn wide" data-act="privacy">Informativa privacy</button>
      <button class="btn wide" data-act="esci">Esci</button>
      <button class="btn wide ghost" data-act="chiudi">Chiudi</button>
    </div>
    <p class="nota">Il tuo codice: <b>${esc(st.profilo ? st.profilo.codice_invito : "")}</b> · Per cancellare il profilo e i tuoi dati scrivi al tuo sponsor o a Stefano e Alessia.</p>`;
  if(s === "privacy") return `<h2>Informativa privacy (breve)</h2>
    <div class="small stack" style="margin-top:10px">
      <p><b>Cosa raccogliamo.</b> Nome, email, data di iscrizione, qualifica e i tuoi numeri: quanti contatti,
        quanti piani, quanti VP. Dei tuoi contatti registriamo <b>solo il numero</b>: nessun nome né telefono.</p>
      <p><b>Chi li vede.</b> Tu e chi sta sopra di te nella tua organizzazione (la tua upline). Nessun altro.</p>
      <p><b>A cosa servono.</b> A pianificare la tua settimana e a farti aiutare da chi ti segue.</p>
      <p><b>Dove stanno.</b> In un database ospitato nell'Unione Europea (Supabase).</p>
      <p><b>I tuoi diritti.</b> Puoi chiedere in qualsiasi momento di vedere, correggere o cancellare il tuo
        profilo e tutti i tuoi dati: scrivi a Stefano e Alessia (CumLaude21).</p>
    </div>
    <button class="btn wide" style="margin-top:14px" data-act="chiudi">Ho capito</button>`;
  return "";
}

/* ---- 10. Azioni ---- */
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

async function salvaObiettivi(c, pi, vp){
  const row = { partner_id:st.profilo.id, settimana:settimana(),
                obiettivo_contatti:c, obiettivo_piani:pi, obiettivo_vp:vp };
  const g = await api.saveGoal(row);
  st.goal = Object.assign({}, g || row, { salvato:true });
}

const AZIONI = {
  async contatto(){ await registra("contatto"); },
  async piano(){ await registra("piano"); },
  async cliente(){ await registra("cliente"); },
  ordine(){ st.errore = ""; st.sheet = "ordine"; render(); focusSheet(); },
  obiettivi(){ st.errore = ""; st.sheet = "obiettivi"; render(); },
  menu(){ st.sheet = "menu"; render(); },
  privacy(){ st.sheet = "privacy"; render(); },
  chiudi(){ st.sheet = null; render(); },
  async "conferma-obiettivi"(){
    const g = st.goal;
    try{ await salvaObiettivi(g.obiettivo_contatti, g.obiettivo_piani, g.obiettivo_vp); render(); toast("Obiettivi confermati"); }
    catch(e){ toast(messaggio(e)); }
  },
  async elimina(el){
    const id = el.dataset.id;
    const a = st.att.find(x => x.id === id);
    if(!a || !confirm(`Eliminare "${ETICHETTE[a.tipo]}${a.tipo === "ordine" ? " " + num(a.vp) + " VP" : ""}"?`)) return;
    try{ await api.deleteActivity(id); st.att = st.att.filter(x => x.id !== id); render(); toast("Eliminato"); }
    catch(e){ toast(messaggio(e)); }
  },
  async copia(){
    try{ await navigator.clipboard.writeText(linkInvito()); toast("Link copiato"); }
    catch(e){ toast("Tieni premuto sul link per copiarlo"); }
  },
  async condividi(){
    try{ await navigator.share({ title:"Growup", text:testoInvito(), url:linkInvito() }); }catch(e){}
  },
  async rimanda(){
    try{ await api.sendCode(st.email); toast("Codice rimandato"); }catch(e){ st.errore = messaggio(e); render(); }
  },
  "cambia-email"(){ st.errore = ""; st.fase = "login"; render(); },
  async esci(){
    st.sheet = null;
    try{ await api.signOut(); }catch(e){}
    st.profilo = null; st.fase = "login"; render();
  },
  ricarica(){ location.reload(); },
  annulla(){ const f = toastAnnulla; document.getElementById("toast").innerHTML = ""; toastAnnulla = null; if(f) f(); }
};

function focusSheet(){ const i = document.querySelector(".sheet input"); if(i) setTimeout(() => i.focus(), 30); }

const MODULI = {
  async email(f){
    const email = f.email.value.trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ st.errore = "Controlla l'email: sembra incompleta."; render(); return; }
    st.email = email; st.errore = ""; st.occupato = true; render();
    try{ await api.sendCode(email); st.fase = "codice"; }
    catch(e){ st.errore = messaggio(e); }
    st.occupato = false; render();
    const c = document.querySelector("input.codice"); if(c) c.focus();
  },
  async codice(f){
    const token = f.codice.value.replace(/\D/g, "");
    if(token.length < 6){ st.errore = "Il codice ha almeno 6 cifre."; render(); return; }
    st.errore = ""; st.occupato = true; render();
    try{ await api.verifyCode(st.email, token); /* onAuth -> dopoLogin */ }
    catch(e){ st.errore = messaggio(e); st.occupato = false; render(); return; }
    st.occupato = false;
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
    st.errore = ""; st.occupato = true; render();
    try{
      st.profilo = await api.join({
        p_codice: st.invito, p_nome: nome, p_data_iscrizione: data, p_qualifica: qual,
        p_qualifica_mese: t && t.pagamenti_max && f.mese.value ? f.mese.value + "-01" : null,
        p_pagamenti: t && t.pagamenti_max ? Math.max(0, Math.min(12, Number(f.pagamenti.value) || 0)) : 0
      });
      salvaLocale(CHIAVE_INVITO, null);
      await caricaTutto();
      st.fase = "home";
    }catch(e){ st.errore = messaggio(e); }
    st.occupato = false; render();
  },
  async ordine(f){
    const vp = Number(String(f.vp.value).replace(",", "."));
    const data = f.data.value || oggi();
    if(!(vp > 0) || vp > 100000){ st.errore = "Scrivi i VP dell'ordine (un numero maggiore di zero)."; mostraErroreForm(f, st.errore); return; }
    if(data > oggi()){ st.errore = "La data non può essere nel futuro."; mostraErroreForm(f, st.errore); return; }
    st.sheet = null; st.errore = "";
    await registra("ordine", { vp:Math.round(vp * 100) / 100, data });
  },
  async obiettivi(f){
    const n = (v, max) => Math.max(0, Math.min(max, Math.round(Number(String(v).replace(/\./g, "").replace(",", ".")) || 0)));
    try{
      await salvaObiettivi(n(f.contatti.value, 1000), n(f.piani.value, 1000), n(f.vp.value, 100000));
      st.sheet = null; st.errore = ""; render(); toast("Obiettivi salvati");
    }catch(e){ st.errore = messaggio(e); render(); }
  }
};

/* Nei moduli lunghi l'errore si mostra senza ridisegnare, così non si perde quel che è scritto. */
function mostraErroreForm(f, msg){
  let p = f.querySelector(".errore");
  if(!p){ p = document.createElement("p"); p.className = "errore"; f.appendChild(p); }
  p.textContent = msg;
}

/* ---- 11. Eventi ---- */
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

if("serviceWorker" in navigator && location.protocol === "https:"){
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

avvio();
})();
