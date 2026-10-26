// API finta in memoria; window.__DB è condiviso tra "dispositivi" dal test
(function(){
  const db = window.__DB;
  let session = null;
  try{ session = JSON.parse(localStorage.getItem("mock.session")); }catch(e){}
  const uid = () => "id" + Math.random().toString(36).slice(2, 10);
  const codiceInvito = () => Array.from({length:6}, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random()*32)]).join("");
  const hex = () => Array.from({length:32}, () => "0123456789abcdef"[Math.floor(Math.random()*16)]).join("");
  /* come my_partner_id(): un profilo bloccato non risponde */
  const mio = () => { const a = session && db.accessi.find(x => x.user_id === session.user.id); const p = a && db.partners.find(p => p.id === a.partner_id);
    return p && !p.bloccato_il ? p : null; };
  const pub = p => { if(!p) return null; const c = Object.assign({}, p); delete c.chiave; return c; };
  const salva = () => { window.__DBOUT = db; };
  /* come nel database (033): vedo me e, nella mia downline, chi è nella mappa: le persone senza app (di chiunque le abbia
     importate) e chi usa l'app confermato da un report. Chi è "in attesa" (confermato_il === null) resta solo suo. */
  const sotto = id => db.partners.filter(p => p.sponsor_id === id).flatMap(p => [p].concat(sotto(p.id)));
  const vedo = (io, p) => p.id === io.id || (sotto(io.id).some(x => x.id === p.id) && (p.stato === "gestito" || p.confermato_il !== null || !!p.is_admin));
  /* i numeri ufficiali condivisi: per persona e mese vale il report più aggiornato */
  const numeroDi = (id, m) => (db.numeri || []).filter(x => x.partner_id === id && x.mese === m)
    .sort((x, y) => String(x.dati_al || "") < String(y.dati_al || "") ? -1 : 1).pop();
  const salvaNumero = (io, pid, m, r, al) => {
    const pp = db.partners.find(y => y.id === pid); if(pp && pp.stato !== "gestito" && !pp.confermato_il) pp.confermato_il = new Date().toISOString();
    if(r.vpg == null) return false;
    const ora = numeroDi(pid, m); if(ora && String(ora.dati_al || "") > al) return false;
    db.numeri = (db.numeri || []).filter(x => !(x.partner_id === pid && x.mese === m))
      .concat([{ visto_da:io.id, partner_id:pid, mese:m, vpp:r.vpp, vpg:r.vpg, percentuale:r.percentuale, linee:r.linee || [], nascoste:!!r.nascoste, dati_al:al }]);
    return true; };
  const visibili = io => [io].concat(sotto(io.id).filter(p => vedo(io, p)));
  /* 034: ordini e correzioni di chi ha l'app li legge solo lui (gli altri tipi e chi non ha l'app restano visibili) */
  const leggoAtt = (io, a) => { if(!["ordine", "rettifica"].includes(a.tipo) || a.partner_id === io.id) return true;
    const p = db.partners.find(x => x.id === a.partner_id); return !!p && p.stato === "gestito"; };
  /* struttura "ricucita": ognuno sotto il primo sopra di lui che vedo */
  const sponsorVis = (io, p) => { if(p.id === io.id) return null;
    for(let s = db.partners.find(x => x.id === p.sponsor_id); s; s = db.partners.find(x => x.id === s.sponsor_id)) if(vedo(io, s)) return s.id;
    return null; };
  const visibiliRicuciti = io => visibili(io).map(p => Object.assign({}, p, { sponsor_id:sponsorVis(io, p) }));
  const antenatoConApp = p => { let s = db.partners.find(x => x.id === p.sponsor_id);
    while(s && s.stato === "gestito" && s.sponsor_id) s = db.partners.find(x => x.id === s.sponsor_id); return s ? s.id : p.sponsor_id; };
  const ricalcolaPersona = pe => { if(!pe) return;
    const ps = (db.passi || []).filter(x => x.persona_id === pe.id), ord = { contatto:1, invito:2, piano:3, followup:4 };
    const max = Math.max(0, ...ps.map(x => ord[x.tipo] || 0));
    pe.fase = ["lista", "contattato", "invitato", "piano", "followup"][max];
    const c = ps.filter(x => x.tipo === "chiusura" || x.tipo === "riapri").sort((x, y) => x.data < y.data ? 1 : x.data > y.data ? -1 : x.creato_il < y.creato_il ? 1 : -1)[0];
    pe.esito = c && c.tipo === "chiusura" ? c.esito : null; };
  window.GROWUP_API = {
    session: async () => session,
    signInAnon: async token => { if(db.anonDisattivo) throw new Error("Anonymous sign-ins are disabled");
      if(!token) throw new Error("captcha protection: request disallowed (no captcha response)");
      db.captcha = token;
      session = { user:{ id:"anon-" + uid() } }; localStorage.setItem("mock.session", JSON.stringify(session)); db.anon++; salva(); },
    signOut: async () => { session = null; localStorage.removeItem("mock.session"); },
    sponsorName: async c => { const i = (db.invitiAdmin || []).find(x => x.codice === c && !x.usato);
      const p = db.partners.find(p => p.codice_invito === c) || (i && db.partners.find(p => p.id === i.sponsor_id)); return p ? p.nome : null; },
    collega: async () => pub(mio()),
    accessiStruttura: async () => { const io = mio(); if(!io) return [];
      return db.partners.filter(p => p.stato !== "gestito" && vedo(io, p)).map(p => ({ id:p.id, confermato_il:p.confermato_il || null, bloccato_il:p.bloccato_il || null, is_admin:!!p.is_admin })); },
    statoAccesso: async () => { if(!session) return null;
      const a = db.accessi.find(x => x.user_id === session.user.id), p = a && db.partners.find(y => y.id === a.partner_id);
      return p && p.bloccato_il ? "bloccato" : (db.accessiTolti || []).includes(session.user.id) ? "tolto" : null; },
    togliDallaStruttura: async pid => { const io = mio(), t = db.partners.find(p => p.id === pid);
      if(!io || !t || t.stato === "gestito" || t.id === io.id || t.is_admin || !(io.is_admin || t.sponsor_id === io.id)) throw new Error("non_autorizzato");
      if(t.confermato_il) throw new Error("gia_confermato");
      const via = [t.id];
      db.partners.filter(p => via.includes(p.sponsor_id) && !via.includes(p.id)).forEach(p => { p.sponsor_id = t.sponsor_id; });
      if(t.codice_amway) db.codiciTolti = (db.codiciTolti || []).filter(c => c.codice_amway !== t.codice_amway)
        .concat([{ codice_amway:t.codice_amway, nome:t.nome, tolto_il:new Date().toISOString() }]);
      db.accessiTolti = (db.accessiTolti || []).concat(db.accessi.filter(x => x.partner_id === t.id).map(x => x.user_id));
      db.accessi = db.accessi.filter(x => !via.includes(x.partner_id));
      db.activities = db.activities.filter(x => !via.includes(x.partner_id));
      db.partners = db.partners.filter(p => !via.includes(p.id)); salva(); },
    bloccaApp: async (pid, blocca) => { const io = mio(), t = db.partners.find(p => p.id === pid);
      if(!io || !io.is_admin || !t || t.stato === "gestito" || t.id === io.id || t.is_admin) throw new Error("non_autorizzato");
      t.bloccato_il = blocca ? (t.bloccato_il || new Date().toISOString()) : null; salva(); },
    codiciTolti: async () => { const io = mio(); if(!io || !io.is_admin) throw new Error("non_autorizzato"); return (db.codiciTolti || []).slice(); },
    sbloccaCodice: async c => { const io = mio(); if(!io || !io.is_admin) throw new Error("non_autorizzato");
      db.codiciTolti = (db.codiciTolti || []).filter(x => x.codice_amway !== c); salva(); },
    entra: async k => {
      if(!session) throw new Error("non_autenticato");
      const p = db.partners.find(p => p.chiave === k); if(!p) throw new Error("chiave_non_valida");
      db.accessi = db.accessi.filter(a => a.user_id !== session.user.id); db.accessi.push({ user_id:session.user.id, partner_id:p.id });
      p.stato = "attivo"; salva(); return pub(p);
    },
    join: async a => {
      if(!session) throw new Error("non_autenticato");
      const invito = (db.invitiAdmin || []).find(x => x.codice === a.p_codice && !x.usato);
      const sp = db.partners.find(p => p.codice_invito === a.p_codice) || (invito && db.partners.find(p => p.id === invito.sponsor_id));
      if(!sp) throw new Error("codice_non_valido");
      if(!a.p_codice_amway) throw new Error("codice_amway_mancante");
      if(db.partners.some(p => p.codice_amway === a.p_codice_amway && p.stato !== "gestito")) throw new Error("codice_amway_attivo");
      if((db.codiciTolti || []).some(c => c.codice_amway === a.p_codice_amway)) throw new Error("codice_tolto");
      const dati = { nome:a.p_nome, chiave:hex(), stato:"attivo", data_iscrizione:a.p_data_iscrizione,
        qualifica_iniziale:a.p_qualifica, qualifica_iniziale_mese:a.p_qualifica_mese, pagamenti_iniziali:a.p_pagamenti,
        percentuale_iniziale:a.p_percentuale, privacy_accettata_il:new Date().toISOString(),
        partenza_confermata_il:(a.p_qualifica || a.p_percentuale) ? null : new Date().toISOString() };
      const copie = db.partners.filter(p => p.codice_amway === a.p_codice_amway && p.stato === "gestito");
      let p;
      if(copie.length){
        const sotto = copie.filter(c => { for(let x = db.partners.find(y => y.id === c.sponsor_id); x; x = db.partners.find(y => y.id === x.sponsor_id)) if(x.id === sp.id) return true; return false; });
        if(!sotto.length) throw new Error("codice_amway_altra_linea");
        p = sotto.find(c => c.gestore_id === sp.id) || sotto[0];
        for(const c of copie) if(c !== p){ db.partners.filter(x => x.sponsor_id === c.id).forEach(x => { x.sponsor_id = p.id; }); db.partners = db.partners.filter(x => x !== c); }
        Object.assign(p, dati, { gestore_id:null, sponsor_id:antenatoConApp(p), confermato_il:new Date().toISOString() });
      }else{
        p = Object.assign({ id:uid(), sponsor_id:sp.id, codice_amway:a.p_codice_amway, confermato_il:null,
          invitato_da:sp.id, invitato_il:new Date().toISOString(),
          codice_invito:"N" + Math.random().toString(36).slice(2,7).toUpperCase() }, dati);
        db.partners.push(p);
      }
      if(invito){ for(const x of db.partners) if(invito.sopra_di.includes(x.id) && x.sponsor_id === invito.sponsor_id && x.id !== p.id) x.sponsor_id = p.id;
        invito.usato = true; }
      db.accessi.push({ user_id:session.user.id, partner_id:p.id }); db.joins.push(a); salva();
      return { profilo:pub(p), chiave:p.chiave };
    },
    accettaPrivacy: async pid => { const p = db.partners.find(x => x.id === pid); p.privacy_accettata_il = new Date().toISOString(); salva(); },
    obiettivo: async pid => (db.obiettivi || []).find(o => o.partner_id === pid) || null,
    salvaObiettivo: async o => { db.obiettivi = (db.obiettivi || []).filter(x => x.partner_id !== o.partner_id).concat([o]); salva(); },
    obiettiviGruppo2: async () => { const io = mio(); if(!io) return [];
      const sotto = id => db.partners.filter(p => p.sponsor_id === id).flatMap(p => [p.id].concat(sotto(p.id)));
      const ids = sotto(io.id);
      return (db.obiettivi || []).filter(o => ids.includes(o.partner_id)).map(o => ({ partner_id:o.partner_id, cifra_mese:o.cifra_mese, entro:o.entro })); },
    copiaDati: async () => { if(!mio().is_admin) throw new Error("non_autorizzato");
      return { app:"Growup Team", creata_il:new Date().toISOString(), tabelle:{ partners:db.partners, activities:db.activities } }; },
    preferiti: async () => { const io = mio(); return (db.preferiti || []).filter(x => x.partner_id === io.id); },
    aggiungiPreferito: async (io, pid) => { db.preferiti = (db.preferiti || []).concat([{ partner_id:io, preferito_id:pid }]); salva(); },
    togliPreferito: async (io, pid) => { db.preferiti = (db.preferiti || []).filter(x => !(x.partner_id === io && x.preferito_id === pid)); salva(); },
    struttura: async () => { const io = mio(); if(!io) return []; return visibiliRicuciti(io).map(pub); },
    creaInvitoSopra: async (pid, altri) => { const io = mio(); if(!io.is_admin) throw new Error("non_autorizzato");
      const t = db.partners.find(x => x.id === pid); const codice = "S" + codiceInvito().slice(1);
      db.invitiAdmin = (db.invitiAdmin || []).concat([{ codice, sponsor_id:t.sponsor_id, sopra_di:[pid].concat(altri || []) }]); salva(); return codice; },
    esclusi: async () => (db.esclusi || []).filter(x => x.partner_id === mio().id),
    nascosti: async () => (db.nascosti || []).filter(x => x.partner_id === mio().id),
    nascondi: async (io, pid) => { db.nascosti = (db.nascosti || []).concat([{ partner_id:io, nascosto_id:pid }]); salva(); },
    nascondiTanti: async (io, ids) => { db.nascosti = (db.nascosti || []).concat(ids.map(id => ({ partner_id:io, nascosto_id:id }))); salva(); },
    mostraTanti: async (io, ids) => { db.nascosti = (db.nascosti || []).filter(x => !(x.partner_id === io && ids.includes(x.nascosto_id))); salva(); },
    mostra: async (io, pid) => { db.nascosti = (db.nascosti || []).filter(x => !(x.partner_id === io && x.nascosto_id === pid)); salva(); },
    riepilogo: async mese => { const io = mio(); if(!io) return []; const m = mese.slice(0, 7);
      const ric = visibiliRicuciti(io);
      const figliVis = id => ric.filter(p => p.sponsor_id === id);
      const num = id => numeroDi(id, m);
      /* 034: per me il report + i miei ordini dopo il report; per chi ha l'app solo il report; per chi non l'ha i VP scritti */
      const ordini = (id, n) => db.activities.filter(a => a.partner_id === id && (a.tipo === "ordine" || a.tipo === "rettifica") && a.data.slice(0, 7) === m
        && (!n || (n.dati_al && a.inserito_il > n.dati_al && a.inserito_da === id))).reduce((t, a) => t + Number(a.vp), 0);
      const pers = id => { const n = num(id), p = db.partners.find(x => x.id === id) || {};
        if(id === io.id) return (n && n.vpp != null ? Number(n.vpp) : 0) + ordini(id, n);
        if(n && n.vpp != null) return Number(n.vpp);
        return p.stato === "gestito" ? ordini(id, null) : 0; };
      const grp = id => pers(id) + figliVis(id).reduce((t, p) => t + grp(p.id), 0);
      return ric.map(p => { const n = num(p.id);
        return { partner_id:p.id, sponsor_id:p.sponsor_id || null, vp_personali:pers(p.id),
          vp_gruppo:n ? n.vpg + (p.id === io.id ? pers(p.id) - Number(n.vpp || 0) : 0) : grp(p.id),
          linee_attive:n ? n.linee.filter(l => l.vpg >= 100).length : 0, percentuale:n ? n.percentuale : null, qualifica:null, chiuso:false,
          da_report:!!n, linee_report:n ? n.linee : null, linee_nascoste:n ? !!n.nascoste : false }; }); },
    storico: async pid => (db.storico || []).filter(r => r.partner_id === pid),
    livelli: async () => [[3,200],[6,600],[9,1200],[12,2400],[15,4000],[18,7000],[21,10000]].map(([percentuale, vp_gruppo]) => ({ percentuale, vp_gruppo })),
    modificaPartenza: async a => { const p = mio(); if(!p) throw new Error("non_autenticato");
      const ord = k => (db.stages.find(x => x.chiave === k) || {}).ordine || 0;
      Object.assign(p, { qualifica_iniziale:a.p_qualifica, percentuale_iniziale:a.p_percentuale, qualifica_iniziale_mese:a.p_qualifica_mese,
        pagamenti_iniziali:a.p_pagamenti });
      if(!(ord(p.qualifica_iniziale) >= ord("platino") && ord(p.prossima_qualifica) > ord(p.qualifica_iniziale))) p.prossima_qualifica = null;
      salva(); return pub(p); },
    /* come nel database: solo per sé, da Platino in su, solo una qualifica sopra la propria */
    impostaProssima: async k => { const p = mio(); const ord = c => (db.stages.find(x => x.chiave === c) || {}).ordine || 0;
      if(k && (ord(p.qualifica_iniziale) < ord("platino") || ord(k) <= ord(p.qualifica_iniziale))) throw new Error("qualifica_non_valida");
      p.prossima_qualifica = k || null; salva(); return pub(p); },
    mesiReport: async pid => { const io = mio(); if(!io) throw new Error("non_autorizzato");
      if(!vedo(io, db.partners.find(p => p.id === pid) || {})) throw new Error("non_autorizzato");
      return (db.numeri || []).filter(x => x.partner_id === pid && x === numeroDi(pid, x.mese))
        .map(x => ({ mese:x.mese + "-01", percentuale:x.percentuale, vpg:x.vpg })).sort((a, b) => a.mese < b.mese ? -1 : 1); },
    /* come nel database: solo numeri, per me e per chi vedo; nessuno si sposta */
    salvaReportPassato: async a => { const io = mio(); const m = a.p_mese.slice(0, 7);
      if(!io.codice_amway) throw new Error("codice_mancante");
      if(a.p_io.codice !== io.codice_amway) throw new Error("import_di_altri");
      const metti = (pid, r) => { db.numeri = (db.numeri || []).filter(x => !(x.visto_da === io.id && x.partner_id === pid && x.mese === m))
        .concat([{ visto_da:io.id, partner_id:pid, mese:m, vpg:r.vpg, percentuale:r.percentuale, linee:r.linee || [], nascoste:!!r.nascoste }]); };
      metti(io.id, a.p_io);
      const vis = visibiliRicuciti(io);
      for(const r of a.p_altri){ const x = vis.find(p => p.id !== io.id && p.codice_amway === r.codice); if(x) metti(x.id, r); }
      salva(); return 1; },
    inAttesa: async () => { const io = mio(); if(!io) return [];
      return sotto(io.id).filter(p => p.stato !== "gestito" && p.confermato_il === null && !p.is_admin)
        .map(p => ({ id:p.id, nome:p.nome, sponsor_id:p.sponsor_id, sponsor_nome:(db.partners.find(x => x.id === p.sponsor_id) || {}).nome || null,
          creato_il:p.creato_il || null, mio:p.sponsor_id === io.id, codice_amway:p.codice_amway || null })); },
    mioReport: async (pid, dal) => (db.numeri || []).filter(x => x.partner_id === pid && x === numeroDi(pid, x.mese) && x.mese + "-01" >= dal)
      .map(x => ({ mese:x.mese + "-01", vpp:x.vpp, vpg:x.vpg, percentuale:x.percentuale, dati_al:x.dati_al || "9999-12-31T00:00:00Z", importato_da:x.visto_da })),
    /* 034: la bozza d'ordine e lo storico, solo miei */
    ordiniMiei: async () => (db.ordiniMiei || []).filter(x => x.proprietario === mio().id).map(x => Object.assign({}, x)),
    righeMie: async () => (db.righeMie || []).filter(x => x.proprietario === mio().id).map(x => Object.assign({}, x)),
    nuovaBozzaMia: async id => { const io = mio();
      if((db.ordiniMiei || []).some(x => x.proprietario === io.id && x.stato === "bozza")) throw new Error("duplicate key value");
      db.ordiniMiei = (db.ordiniMiei || []).concat([{ id, proprietario:io.id, stato:"bozza", data:new Date().toISOString().slice(0, 10), attivita_id:null, vp:null,
        creato_il:new Date().toISOString(), confermato_il:null }]); salva(); },
    nuovaRigaMia: async r => { const o = (db.ordiniMiei || []).find(x => x.id === r.ordine_id && x.proprietario === mio().id && x.stato === "bozza");
      if(!o) throw new Error("violates row-level security");
      db.righeMie = (db.righeMie || []).concat([Object.assign({ proprietario:mio().id }, r)]); salva(); },
    quantitaMia: async (id, quantita) => { const r = (db.righeMie || []).find(x => x.id === id && x.proprietario === mio().id);
      const o = r && db.ordiniMiei.find(x => x.id === r.ordine_id); if(r && o.stato === "bozza") r.quantita = quantita; salva(); },
    togliRigaMia: async id => { db.righeMie = (db.righeMie || []).filter(x => !(x.id === id && x.proprietario === mio().id)); salva(); },
    togliOrdineMio: async id => { const io = mio(); if(!(db.ordiniMiei || []).some(x => x.id === id && x.proprietario === io.id)) return;
      db.ordiniMiei = db.ordiniMiei.filter(x => x.id !== id); db.righeMie = (db.righeMie || []).filter(x => x.ordine_id !== id); salva(); },
    confermaOrdine: async (id, data) => { const io = mio(); const o = (db.ordiniMiei || []).find(x => x.id === id && x.proprietario === io.id && x.stato === "bozza");
      if(!o) throw new Error("non_autorizzato");
      const righe = (db.righeMie || []).filter(x => x.ordine_id === id); if(!righe.length) throw new Error("ordine_vuoto");
      const tot = Math.round(righe.reduce((t, r) => t + (Number(r.vp) || 0) * r.quantita, 0) * 100) / 100;
      let att = null;
      if(tot > 0){ att = uid(); db.activities.push({ id:att, partner_id:io.id, tipo:"ordine", vp:tot, quantita:1, data:data || new Date().toISOString().slice(0, 10),
        inserito_da:io.id, inserito_il:new Date().toISOString() }); }
      Object.assign(o, { stato:"confermato", data:data || o.data, attivita_id:att, vp:tot, confermato_il:new Date().toISOString() }); salva();
      return Object.assign({}, o); },
    /* 037: Analisi della persona e dati condivisi */
    analisiPersona: async pid => { const io = mio(); const t = db.partners.find(p => p.id === pid);
      if(!t || !vedo(io, t)) throw new Error("non_autorizzato");
      const ora = new Date().toISOString().slice(0, 7), [y, m] = ora.split("-").map(Number), inizio = (m >= 9 ? y : y - 1) + "-09";
      const mesi = []; for(let x = inizio; x <= ora; ){ mesi.push(x); const [a, b] = x.split("-").map(Number); x = b === 12 ? `${a + 1}-01` : `${a}-${String(b + 1).padStart(2, "0")}`; }
      const giu = [pid].concat(sotto(pid).map(x => x.id));
      return mesi.map(mm => { const n = numeroDi(pid, mm);
        return { mese:mm + "-01", vpp:n ? n.vpp : null, vpg:n ? n.vpg : null, percentuale:n ? n.percentuale : null,
          linee:(n ? n.linee || [] : []).map(l => { const q = db.partners.find(x => x.codice_amway === l.codice), nl = q ? numeroDi(q.id, mm) : null;
            return { codice:l.codice, nome:q ? q.nome : null, vpg:l.vpg, percentuale:nl ? nl.percentuale : null }; }),
          personali:db.partners.filter(x => x.invitato_da === pid && String(x.invitato_il || "").slice(0, 7) === mm).length,
          nuovi_gruppo:db.partners.filter(x => x.id !== pid && giu.includes(x.id) && String(x.in_mappa_dal || "").slice(0, 7) === mm).length,
          oltre_200:giu.filter(id => { const q = numeroDi(id, mm); return q && Number(q.vpp) > 200; }).length }; }); },
    datiCondivisi: async pid => { const io = mio(); const t = db.partners.find(p => p.id === pid);
      if(!t || pid === io.id || !vedo(io, t) || !(db.seguimi || []).some(x => x.partner_id === pid && x.condividi)) return null;
      const c = (db.numeriCl21 || []).find(x => x.partner_id === pid);
      return { cl21:c ? { app_cl21:c.app_cl21, training_day:c.training_day, convention:c.convention } : null,
        obiettivi:(db.guidaObiettivi || []).filter(x => x.partner_id === pid).map(x => ({ chiave:x.chiave, a_settimana:x.a_settimana })),
        fatti:(db.guidaFatti || []).filter(x => x.partner_id === pid).map(x => ({ chiave:x.chiave, giorno:x.giorno })) }; },
    /* 036: Seguimi giorno per giorno */
    seguimi: async () => (db.seguimi || []).filter(x => x.partner_id === mio().id).map(x => ({ attivo:x.attivo, condividi:x.condividi })),
    salvaSeguimi: async r => { const io = mio(); db.seguimi = (db.seguimi || []).filter(x => x.partner_id !== io.id).concat([Object.assign({ partner_id:io.id }, r)]); salva(); },
    seguimiGiorni: async dal => (db.seguimiGiorni || []).filter(x => x.partner_id === mio().id && x.giorno >= dal).map(x => JSON.parse(JSON.stringify(x))),
    salvaSeguimiGiorno: async r => { const io = mio(); if(r.giorno > new Date().toISOString().slice(0, 10)) throw new Error("violates row-level security");
      db.seguimiGiorni = (db.seguimiGiorni || []).filter(x => !(x.partner_id === io.id && x.giorno === r.giorno)).concat([Object.assign({ partner_id:io.id }, JSON.parse(JSON.stringify(r)))]); salva(); },
    seguimiDi: async pid => { const io = mio(); const t = db.partners.find(p => p.id === pid);
      if(!t || pid === io.id || !vedo(io, t) || !(db.seguimi || []).some(x => x.partner_id === pid && x.attivo && x.condividi)) return [];
      return (db.seguimiGiorni || []).filter(x => x.partner_id === pid).map(x => ({ giorno:x.giorno, proposte:x.proposte, fatte:x.fatte, per_tipo:x.per_tipo })); },
    /* 035: la Guida */
    guidaConteggi: async mese => { const io = mio(); if(!io) throw new Error("non_autenticato"); const m = mese.slice(0, 7);
      return { personali:db.partners.filter(p => p.invitato_da === io.id && String(p.invitato_il || "").slice(0, 7) === m).length,
        nuovi_gruppo:db.partners.filter(p => p.id !== io.id && String(p.in_mappa_dal || "").slice(0, 7) === m && vedo(io, p)).length,
        oltre_200:(db.numeri || []).filter(x => x.mese === m && x === numeroDi(x.partner_id, m) && Number(x.vpp) > 200
          && vedo(io, db.partners.find(p => p.id === x.partner_id) || {})).length }; },
    numeriCl21: async () => (db.numeriCl21 || []).filter(x => x.partner_id === mio().id).map(x => Object.assign({}, x)),
    salvaNumeriCl21: async r => { const io = mio(); db.numeriCl21 = (db.numeriCl21 || []).filter(x => x.partner_id !== io.id)
      .concat([Object.assign({ partner_id:io.id }, r)]); salva(); },
    guidaObiettivi: async () => (db.guidaObiettivi || []).filter(x => x.partner_id === mio().id).map(x => Object.assign({}, x)),
    salvaGuidaObiettivo: async (chiave, n) => { const io = mio(); db.guidaObiettivi = (db.guidaObiettivi || [])
      .filter(x => !(x.partner_id === io.id && x.chiave === chiave)).concat([{ partner_id:io.id, chiave, a_settimana:n }]); salva(); },
    guidaFatti: async dal => (db.guidaFatti || []).filter(x => x.partner_id === mio().id && x.giorno >= dal).map(x => Object.assign({}, x)),
    segnaFatto: async (chiave, giorno) => { const io = mio(); if(giorno > new Date().toISOString().slice(0, 10)) throw new Error("violates row-level security");
      db.guidaFatti = (db.guidaFatti || []).concat([{ partner_id:io.id, chiave, giorno }]); salva(); },
    togliFatto: async (chiave, giorno) => { const io = mio(); db.guidaFatti = (db.guidaFatti || [])
      .filter(x => !(x.partner_id === io.id && x.chiave === chiave && x.giorno === giorno)); salva(); },
    datiAl: async (pid, mese) => { const n = numeroDi(pid, mese.slice(0, 7)); return n && n.dati_al ? [{ dati_al:n.dati_al }] : []; },
    salvaMesePassato: async a => { const io = mio(); const m = a.p_mese.slice(0, 7), al = a.p_dati_al || new Date().toISOString();
      if(io.confermato_il === null && !io.is_admin) throw new Error("in_attesa");
      if(!io.codice_amway) throw new Error("codice_mancante");
      if(a.p_io.codice !== io.codice_amway) throw new Error("import_di_altri");
      let n = salvaNumero(io, io.id, m, a.p_io, al) ? 1 : 0;
      for(const r of a.p_altri){ const x = sotto(io.id).find(p => p.codice_amway === r.codice); if(x && salvaNumero(io, x.id, m, r, al)) n++; }
      salva(); return n; },
    /* come importa_mappa (033): tutto il mio gruppo, vince il report più aggiornato */
    importaMappa: async a => { const io = mio(); if(!io) throw new Error("non_autenticato");
      if(io.confermato_il === null && !io.is_admin) throw new Error("in_attesa");
      const m = a.p_mese.slice(0, 7), al = a.p_dati_al && a.p_dati_al < new Date().toISOString() ? a.p_dati_al : new Date().toISOString();
      if(!io.codice_amway && a.p_io.codice) io.codice_amway = a.p_io.codice;
      else if(a.p_io.codice !== io.codice_amway) throw new Error("import_di_altri");
      let aggiunte = 0, spostate = 0, fuori = 0, numeri = 0, vecchi = 0;
      /* 035: i codici nuovi contano nel gruppo solo dal secondo import di chi importa */
      const secondo = !!io.primo_import_il; if(!io.primo_import_il) io.primo_import_il = new Date().toISOString();
      if(salvaNumero(io, io.id, m, a.p_io, al)) numeri++; else vecchi++;
      const giu = id => [id].concat(sotto(id).map(x => x.id));
      for(const r of a.p_persone){
        const mia = sotto(io.id);
        const sp = (r.sponsor && r.sponsor !== io.codice_amway && (mia.find(p => p.codice_amway === r.sponsor) || {}).id) || io.id;
        let x = mia.filter(p => p.codice_amway === r.codice).sort((p, q) => (q.stato !== "gestito") - (p.stato !== "gestito"))[0];
        if(!x){
          if(db.partners.some(p => p.codice_amway === r.codice)) continue;
          x = { id:uid(), nome:r.nome, sponsor_id:sp, stato:"gestito", gestore_id:io.id, codice_amway:r.codice, codice_invito:codiceInvito(),
            partenza_confermata_il:new Date().toISOString(), creato_il:new Date().toISOString(), posizione_al:al,
            in_mappa_dal:secondo ? new Date().toISOString() : null };
          db.partners.push(x); aggiunte++;
          if((a.p_nascondi || []).includes(r.codice) || (db.esclusi || []).some(e => e.partner_id === io.id && e.codice === r.codice))
            db.nascosti = (db.nascosti || []).concat([{ partner_id:io.id, nascosto_id:x.id }]);
        } else if(!x.posizione_al || x.posizione_al <= al){
          if(x.sponsor_id !== sp && sp !== x.id && !giu(x.id).includes(sp)){ x.sponsor_id = sp; spostate++; }
          x.posizione_al = al; x.fuori_report_dal = null; if(x.stato === "gestito") x.gestore_id = io.id;
        }
        db.esclusi = (db.esclusi || []).filter(e => !(e.partner_id === io.id && e.codice === r.codice));
        if(salvaNumero(io, x.id, m, r, al)) numeri++; else vecchi++;
      }
      for(const pid of a.p_fuori || []){ const x = db.partners.find(y => y.id === pid);
        if(!x || x.stato !== "gestito" || !vedo(io, x)) throw new Error("non_autorizzato");
        if(!x.fuori_report_dal && (!x.posizione_al || x.posizione_al <= al)){ x.fuori_report_dal = a.p_mese; x.posizione_al = al;
          db.nascosti = (db.nascosti || []).concat([{ partner_id:io.id, nascosto_id:x.id }]); fuori++; } }
      salva();
      return { aggiunte, spostate, fuori, aggiornati:numeri, piu_vecchi:vecchi }; },
    prossime: async () => { const io = mio(); if(!io) return [];
      return visibiliRicuciti(io).filter(p => p.prossima_qualifica).map(p => ({ partner_id:p.id, prossima_qualifica:p.prossima_qualifica })); },
    nuovaChiavePer: async pid => { if(!mio().is_admin) throw new Error("non_autorizzato"); const p = db.partners.find(x => x.id === pid); p.chiave = hex();
      db.accessi = db.accessi.filter(a => a.partner_id !== pid); salva(); return p.chiave; },
    /* come nel database: il mio codice o quello di una persona che ho importato; unico tra chi usa l'app, e tra le mie importate */
    impostaCodice: async (pid, codice) => { const io = mio();
      const p = db.partners.find(x => x.id === pid);
      if(!p || !io.is_admin) throw new Error("non_autorizzato");
      if(db.partners.some(x => x.id !== pid && x.codice_amway === codice && (p.stato === "gestito" ? x.stato === "gestito" && x.gestore_id === p.gestore_id : x.stato !== "gestito")))
        throw new Error("codice_amway_usato");
      p.codice_amway = codice; salva(); return pub(p); },
    importaRete: async a => { const io = mio();
      if(io.codice_amway && io.codice_amway !== a.p_io.codice) throw new Error("import_di_altri");
      io.codice_amway = a.p_io.codice;
      const salvaNumeri = (pid, r) => { const pp = db.partners.find(y => y.id === pid);
        if(pp && pp.stato !== "gestito" && !pp.confermato_il) pp.confermato_il = new Date().toISOString();
        if(r.vpg == null) return; const m = a.p_mese.slice(0, 7);
        db.numeri = (db.numeri || []).filter(x => !(x.visto_da === io.id && x.partner_id === pid && x.mese === m))
          .concat([{ visto_da:io.id, partner_id:pid, mese:m, vpg:r.vpg, percentuale:r.percentuale, linee:r.linee || [], nascoste:!!r.nascoste }]); };
      salvaNumeri(io.id, a.p_io);
      const attivo = c => visibili(io).find(x => x.stato !== "gestito" && x.codice_amway === c);
      const mia = c => db.partners.find(x => x.stato === "gestito" && x.gestore_id === io.id && x.codice_amway === c);
      const giu = id => [id].concat(sotto(id).map(x => x.id));
      let aggiunte = 0, spostate = 0, fuori = 0;
      const nascondi = id => { if(!(db.nascosti || []).some(n => n.partner_id === io.id && n.nascosto_id === id))
        db.nascosti = (db.nascosti || []).concat([{ partner_id:io.id, nascosto_id:id }]); };
      const righe = [{ partner_id:io.id, vpp:a.p_io.vpp }];
      for(const r of a.p_persone){
        const sp = (r.sponsor && r.sponsor !== io.codice_amway && ((attivo(r.sponsor) || mia(r.sponsor) || {}).id)) || io.id;
        let x = mia(r.codice);
        if(x){ if(x.sponsor_id !== sp && !giu(x.id).includes(sp)){ x.sponsor_id = sp; spostate++; } }
        else{
          if(attivo(r.codice)) continue;
          x = { id:uid(), nome:r.nome, sponsor_id:sp, stato:"gestito", gestore_id:io.id, codice_amway:r.codice, codice_invito:codiceInvito(),
            partenza_confermata_il:new Date().toISOString(), creato_il:new Date().toISOString() };
          db.partners.push(x); aggiunte++;
          if(a.p_nascondi.includes(r.codice) || (db.esclusi || []).some(e => e.partner_id === io.id && e.codice === r.codice)) nascondi(x.id);
        }
        db.esclusi = (db.esclusi || []).filter(e => !(e.partner_id === io.id && e.codice === r.codice));
        x.fuori_report_dal = null;
        righe.push({ partner_id:x.id, vpp:r.vpp }); salvaNumeri(x.id, r);
      }
      for(const r of a.p_attivi){
        const x = attivo(r.codice); if(!x || x.id === io.id) continue;
        if(!vedo(io, x)) continue;
        salvaNumeri(x.id, r);
        const sp = !r.sponsor || r.sponsor === io.codice_amway ? io.id : (attivo(r.sponsor) || {}).id;
        if(!sp || sp === x.sponsor_id || giu(x.id).includes(sp)) continue;
        x.sponsor_id = sp; spostate++;
      }
      for(const pid of a.p_fuori){ const x = db.partners.find(y => y.id === pid);
        if(!x || x.stato !== "gestito" || x.gestore_id !== io.id) throw new Error("non_autorizzato");
        if(!x.fuori_report_dal){ x.fuori_report_dal = a.p_mese; nascondi(x.id); fuori++; } }
      const oggi = new Intl.DateTimeFormat("en-CA", { timeZone:"Europe/Rome" }).format(new Date());
      const m = a.p_mese.slice(0, 7), fine = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).toISOString().slice(0, 10);
      const giorno = m === oggi.slice(0, 7) ? oggi : fine;
      let aggiornati = 0, invariati = 0;
      for(const r of righe){
        const ora = db.activities.filter(x => x.partner_id === r.partner_id && (x.tipo === "ordine" || x.tipo === "rettifica") && x.data.slice(0, 7) === m)
          .reduce((t, x) => t + Number(x.vp), 0);
        const diff = Math.round((r.vpp - ora) * 100) / 100;
        if(!diff){ invariati++; continue; }
        db.activities.push({ id:uid(), partner_id:r.partner_id, tipo:"rettifica", vp:diff, quantita:1, data:giorno, inserito_da:io.id, inserito_il:new Date().toISOString() });
        aggiornati++;
      }
      db.importi = (db.importi || 0) + 1; salva();
      return { aggiornati, invariati, aggiunte, spostate, fuori }; },
    attivitaGruppo: async dal => { const io = mio(); if(!io) return [];
      const ids = new Set(visibili(io).map(p => p.id)); return db.activities.filter(a => ids.has(a.partner_id) && a.data >= dal && leggoAtt(io, a)); },
    obiettiviGruppo: async () => db.goals,
    obiettiviMeseGruppo: async () => db.mgoals,
    cambiaChiave: async () => { const p = mio(); p.chiave = hex();
      db.accessi = db.accessi.filter(a => a.partner_id !== p.id || a.user_id === session.user.id); salva(); return p.chiave; },
    stages: async () => db.stages,
    settings: async () => db.settings,
    activities: async (pid, dal) => db.activities.filter(a => a.partner_id === pid && (a.data >= dal || ["ordine","rettifica","cliente"].includes(a.tipo))
      && leggoAtt(mio(), a)),
    /* la Lista: solo mia; i passi contano le attività e aggiornano fase ed esito, come i trigger del database */
    persone: async () => (db.persone || []).filter(x => x.proprietario === mio().id).map(x => Object.assign({}, x)),
    passi: async () => (db.passi || []).filter(x => x.proprietario === mio().id).map(x => Object.assign({}, x)),
    nuovePersone: async righe => { db.persone = (db.persone || []).concat(righe.map(r => Object.assign({ fase:"lista", esito:null,
      proprietario:mio().id, creato_il:new Date().toISOString(), prossima_data:null, prossima_nota:null }, r))); salva(); },
    modificaPersona: async (id, campi) => { const x = (db.persone || []).find(y => y.id === id && y.proprietario === mio().id);
      if(x) Object.assign(x, campi); salva(); },
    cancellaPersona: async id => { db.persone = db.persone.filter(y => !(y.id === id && y.proprietario === mio().id));
      db.passi = (db.passi || []).filter(y => y.persona_id !== id);
      (db.inviti || []).forEach(y => { if(y.persona_id === id) y.persona_id = null; });
      const ord = (db.ordini || []).filter(y => y.persona_id === id).map(y => y.id);
      db.ordini = (db.ordini || []).filter(y => y.persona_id !== id); db.righe = (db.righe || []).filter(y => !ord.includes(y.ordine_id)); salva(); },
    nuoviPassi: async righe => {
      for(const r of righe){
        const pe = (db.persone || []).find(y => y.id === r.persona_id);
        if(!pe || pe.proprietario !== mio().id) throw new Error("non_autorizzato");
        const t = r.tipo === "contatto" ? "contatto" : r.tipo === "piano" ? "piano" : r.tipo === "chiusura" && r.esito === "cliente" ? "cliente" : null;
        const passo = Object.assign({ proprietario:pe.proprietario, creato_il:new Date().toISOString() + Math.random(), attivita_id:null }, r);
        if(t && !r.importato){ const a = { id:uid(), partner_id:pe.proprietario, tipo:t, quantita:1, data:r.data, inserito_da:pe.proprietario, inserito_il:new Date().toISOString() };
          db.activities.push(a); passo.attivita_id = a.id; }
        db.passi = (db.passi || []).concat([passo]);
        ricalcolaPersona(pe);
      }
      salva(); },
    cancellaPasso: async id => { const x = (db.passi || []).find(y => y.id === id);
      if(!x) return; db.passi = db.passi.filter(y => y.id !== id);
      if(x.attivita_id) db.activities = db.activities.filter(a => a.id !== x.attivita_id);
      ricalcolaPersona(db.persone.find(y => y.id === x.persona_id)); salva(); },
    invitiTarget: async () => (db.inviti || []).filter(x => x.proprietario === mio().id).map(x => Object.assign({}, x)),
    nuovoInvito: async r => { if((db.inviti || []).some(x => x.id === r.id)) throw new Error("duplicate key value violates unique constraint");
      db.inviti = (db.inviti || []).concat([Object.assign({ proprietario:mio().id, bloccato:false, risposte:null, risposto_il:null,
        persona_id:null, archiviato:false, creato_il:new Date().toISOString() }, r)]); salva(); },
    aggiornaInvito: async (id, campi) => { const x = (db.inviti || []).find(y => y.id === id && y.proprietario === mio().id);
      if(!x) return; if(campi.risposte) x.risposto_il = new Date().toISOString(); Object.assign(x, campi); salva(); },
    cancellaInvito: async id => { db.inviti = (db.inviti || []).filter(y => !(y.id === id && y.proprietario === mio().id)); salva(); },
    invitoTargetAperto: async id => { const x = (db.inviti || []).find(y => y.id === id);
      return !x ? "sconosciuto" : x.bloccato ? "bloccato" : x.risposte ? "usato" : x.scade && x.scade < new Date().toISOString().slice(0, 10) ? "scaduto" : "ok"; },
    ordini: async () => (db.ordini || []).filter(x => x.proprietario === mio().id).map(x => Object.assign({}, x)),
    righeOrdini: async () => (db.righe || []).filter(x => x.proprietario === mio().id).map(x => Object.assign({}, x)),
    listino: async () => { if(!mio()) throw new Error("non_autenticato"); return (db.listino || []).map(x => Object.assign({}, x)).sort((a, b) => a.nome < b.nome ? -1 : 1); },
    salvaListino: async righe => { const io = mio(); if(!io || !io.is_admin) throw new Error("new row violates row-level security policy");
      for(const r of righe){ db.listino = (db.listino || []).filter(x => x.codice !== r.codice).concat([Object.assign({}, r)]); } salva(); },
    durate: async () => (db.durate || []).filter(x => x.proprietario === mio().id).map(x => ({ codice:x.codice, giorni:x.giorni })),
    nuovoOrdine: async r => { const pe = (db.persone || []).find(y => y.id === r.persona_id);
      if(!pe || pe.proprietario !== mio().id) throw new Error("non_autorizzato");
      db.ordini = (db.ordini || []).concat([Object.assign({ proprietario:pe.proprietario, consegnato:null, pagato:null, verificato:null, creato_il:new Date().toISOString() + Math.random() }, r)]); salva(); },
    nuoviOrdini: async righe => { for(const r of righe){ const pe = (db.persone || []).find(y => y.id === r.persona_id);
      if(!pe || pe.proprietario !== mio().id) throw new Error("non_autorizzato");
      if(r.numero_amway && (db.ordini || []).some(y => y.proprietario === pe.proprietario && y.numero_amway === r.numero_amway)) throw new Error("duplicate key value");
      db.ordini = (db.ordini || []).concat([Object.assign({ proprietario:pe.proprietario, consegnato:null, pagato:null, verificato:null, creato_il:new Date().toISOString() + Math.random() }, r)]); } salva(); },
    nuoveRighe: async righe => { for(const r of righe){ const o = (db.ordini || []).find(y => y.id === r.ordine_id);
      if(!o || o.proprietario !== mio().id) throw new Error("non_autorizzato");
      db.righe = (db.righe || []).concat([Object.assign({ proprietario:o.proprietario }, r)]); } salva(); },
    aggiornaOrdine: async (id, campi) => { const o = (db.ordini || []).find(y => y.id === id && y.proprietario === mio().id); if(o) Object.assign(o, campi); salva(); },
    cancellaRighe: async ordineId => { db.righe = (db.righe || []).filter(y => y.ordine_id !== ordineId); salva(); },
    cancellaOrdine: async id => { db.ordini = (db.ordini || []).filter(y => y.id !== id); db.righe = (db.righe || []).filter(y => y.ordine_id !== id); salva(); },
    salvaDurata: async (codice, giorni) => { db.durate = (db.durate || []).filter(y => !(y.proprietario === mio().id && y.codice === codice))
      .concat([{ proprietario:mio().id, codice, giorni }]); salva(); },
    numeriPersone: async pid => { const io = mio(), t = db.partners.find(p => p.id === pid);
      if(!t || !vedo(io, t)) throw new Error("non_autorizzato");
      const l = (db.persone || []).filter(x => x.proprietario === pid), m = new Date().toISOString().slice(0, 7);
      return { in_lista:l.filter(x => !x.esito && x.fase === "lista").length, in_corso:l.filter(x => !x.esito && x.fase !== "lista").length,
        piani_mese:(db.passi || []).filter(x => x.proprietario === pid && x.tipo === "piano" && x.data.slice(0, 7) === m).length,
        si_mese:(db.passi || []).filter(x => x.proprietario === pid && x.tipo === "chiusura" && ["partner", "cliente"].includes(x.esito) && x.data.slice(0, 7) === m).length,
        partner_mese:(db.passi || []).filter(x => x.proprietario === pid && x.tipo === "chiusura" && x.esito === "partner" && x.data.slice(0, 7) === m).length,
        clienti_mese:(db.passi || []).filter(x => x.proprietario === pid && x.tipo === "chiusura" && x.esito === "cliente" && x.data.slice(0, 7) === m).length,
        clienti:l.filter(x => x.esito === "cliente" && !x.non_compra).length, totale:l.length }; },
    addActivity: async row => { const r = Object.assign({ id:uid(), inserito_il:new Date().toISOString(), inserito_da:mio().id }, row); db.activities.push(r); salva(); return r; },
    deleteActivity: async id => { db.activities = db.activities.filter(a => a.id !== id); salva(); },
    lastGoal: async (pid, fino) => db.goals.filter(g => g.partner_id === pid && g.settimana <= fino).sort((a,b) => a.settimana < b.settimana ? 1 : -1).slice(0,1),
    saveGoal: async row => { db.goals = db.goals.filter(g => !(g.partner_id === row.partner_id && g.settimana === row.settimana)); db.goals.push(row); salva(); return row; },
    lastMonthGoal: async (pid, fino) => db.mgoals.filter(g => g.partner_id === pid && g.mese <= fino).sort((a,b) => a.mese < b.mese ? 1 : -1).slice(0,1),
    saveMonthGoal: async row => { db.mgoals = db.mgoals.filter(g => !(g.partner_id === row.partner_id && g.mese === row.mese)); db.mgoals.push(row); salva(); return row; }
  };
})();
