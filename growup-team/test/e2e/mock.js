// API finta in memoria; window.__DB è condiviso tra "dispositivi" dal test
(function(){
  const db = window.__DB;
  let session = null;
  try{ session = JSON.parse(localStorage.getItem("mock.session")); }catch(e){}
  const uid = () => "id" + Math.random().toString(36).slice(2, 10);
  const hex = () => Array.from({length:32}, () => "0123456789abcdef"[Math.floor(Math.random()*16)]).join("");
  const mio = () => { const a = session && db.accessi.find(x => x.user_id === session.user.id); return a ? db.partners.find(p => p.id === a.partner_id) : null; };
  const pub = p => { if(!p) return null; const c = Object.assign({}, p); delete c.chiave; return c; };
  const salva = () => { window.__DBOUT = db; };
  window.GROWUP_API = {
    session: async () => session,
    signInAnon: async () => { if(db.anonDisattivo) throw new Error("Anonymous sign-ins are disabled");
      session = { user:{ id:"anon-" + uid() } }; localStorage.setItem("mock.session", JSON.stringify(session)); db.anon++; salva(); },
    signOut: async () => { session = null; localStorage.removeItem("mock.session"); },
    sponsorName: async c => { const p = db.partners.find(p => p.codice_invito === c); return p ? p.nome : null; },
    collega: async () => pub(mio()),
    entra: async k => {
      if(!session) throw new Error("non_autenticato");
      const p = db.partners.find(p => p.chiave === k); if(!p) throw new Error("chiave_non_valida");
      db.accessi = db.accessi.filter(a => a.user_id !== session.user.id); db.accessi.push({ user_id:session.user.id, partner_id:p.id });
      p.stato = "attivo"; salva(); return pub(p);
    },
    join: async a => {
      if(!session) throw new Error("non_autenticato");
      const sp = db.partners.find(p => p.codice_invito === a.p_codice);
      if(!sp) throw new Error("codice_non_valido");
      const p = { id:uid(), nome:a.p_nome, sponsor_id:sp.id, chiave:hex(),
        codice_invito:"N" + Math.random().toString(36).slice(2,7).toUpperCase(), stato:"attivo", data_iscrizione:a.p_data_iscrizione,
        qualifica_iniziale:a.p_qualifica, qualifica_iniziale_mese:a.p_qualifica_mese, pagamenti_iniziali:a.p_pagamenti,
        percentuale_iniziale:a.p_percentuale, privacy_accettata_il:new Date().toISOString(),
        partenza_confermata_il:(a.p_qualifica || a.p_percentuale) ? null : new Date().toISOString() };
      db.partners.push(p); db.accessi.push({ user_id:session.user.id, partner_id:p.id }); db.joins.push(a); salva();
      return { profilo:pub(p), chiave:p.chiave };
    },
    accettaPrivacy: async pid => { const p = db.partners.find(x => x.id === pid); p.privacy_accettata_il = new Date().toISOString(); salva(); },
    obiettivo: async pid => (db.obiettivi || []).find(o => o.partner_id === pid) || null,
    salvaObiettivo: async o => { db.obiettivi = (db.obiettivi || []).filter(x => x.partner_id !== o.partner_id).concat([o]); salva(); },
    obiettiviGruppo2: async () => { const io = mio(); if(!io) return [];
      const sotto = id => db.partners.filter(p => p.sponsor_id === id).flatMap(p => [p.id].concat(sotto(p.id)));
      const ids = sotto(io.id);
      return (db.obiettivi || []).filter(o => ids.includes(o.partner_id)).map(o => ({ partner_id:o.partner_id, cifra_mese:o.cifra_mese, entro:o.entro })); },
    preferiti: async () => { const io = mio(); return (db.preferiti || []).filter(x => x.partner_id === io.id); },
    aggiungiPreferito: async (io, pid) => { db.preferiti = (db.preferiti || []).concat([{ partner_id:io, preferito_id:pid }]); salva(); },
    togliPreferito: async (io, pid) => { db.preferiti = (db.preferiti || []).filter(x => !(x.partner_id === io && x.preferito_id === pid)); salva(); },
    struttura: async () => { const io = mio(); if(!io) return [];
      const sotto = id => db.partners.filter(p => p.sponsor_id === id).flatMap(p => [p].concat(sotto(p.id)));
      return [io].concat(sotto(io.id)).map(pub); },
    aggiungi: async a => { const io = mio();
      const p = { id:uid(), nome:a.p_nome, sponsor_id:a.p_sponsor, stato:"gestito", gestore_id:io.id, codice_invito:"G" + uid().slice(2,7).toUpperCase(),
        data_iscrizione:a.p_data_iscrizione, qualifica_iniziale:a.p_qualifica, percentuale_iniziale:a.p_percentuale, privacy_accettata_il:null,
        partenza_confermata_il:new Date().toISOString() };
      db.partners.push(p); db.aggiunti.push(a); salva(); return pub(p); },
    linkGestito: async pid => { const p = db.partners.find(x => x.id === pid); if(p.stato !== "gestito") throw new Error("non_gestito"); p.chiave = hex(); salva(); return p.chiave; },
    riepilogo: async mese => { const io = mio(); if(!io) return []; const m = mese.slice(0, 7);
      const sotto = id => db.partners.filter(p => p.sponsor_id === id).flatMap(p => [p].concat(sotto(p.id)));
      const pers = id => db.activities.filter(a => a.partner_id === id && (a.tipo === "ordine" || a.tipo === "rettifica") && a.data.slice(0, 7) === m).reduce((t, a) => t + Number(a.vp), 0);
      const grp = id => pers(id) + db.partners.filter(p => p.sponsor_id === id).reduce((t, p) => t + grp(p.id), 0);
      return [io].concat(sotto(io.id)).map(p => ({ partner_id:p.id, sponsor_id:p.sponsor_id || null, vp_personali:pers(p.id), vp_gruppo:grp(p.id),
        linee_attive:0, percentuale:null, qualifica:null, chiuso:false })); },
    storico: async pid => (db.storico || []).filter(r => r.partner_id === pid),
    livelli: async () => [[3,200],[6,600],[9,1200],[12,2400],[15,4000],[18,7000],[21,10000]].map(([percentuale, vp_gruppo]) => ({ percentuale, vp_gruppo })),
    conferma: async a => { const p = db.partners.find(x => x.id === a.p_partner);
      Object.assign(p, { qualifica_iniziale:a.p_qualifica, percentuale_iniziale:a.p_percentuale, qualifica_iniziale_mese:a.p_qualifica_mese,
        pagamenti_iniziali:a.p_pagamenti, partenza_confermata_il:new Date().toISOString() }); db.conferme = (db.conferme || []).concat([a]); salva(); return pub(p); },
    nuovaChiavePer: async pid => { if(!mio().is_admin) throw new Error("non_autorizzato"); const p = db.partners.find(x => x.id === pid); p.chiave = hex();
      db.accessi = db.accessi.filter(a => a.partner_id !== pid); salva(); return p.chiave; },
    inMezzo: async a => { const io = mio(); const sp = db.partners.find(x => x.id === a.p_sotto[0]).sponsor_id;
      const p = { id:uid(), nome:a.p_nome, sponsor_id:sp, stato:"gestito", gestore_id:io.id, codice_invito:"M" + uid().slice(2,7).toUpperCase(),
        qualifica_iniziale:a.p_qualifica, percentuale_iniziale:a.p_percentuale, partenza_confermata_il:new Date().toISOString() };
      db.partners.push(p); for(const id of a.p_sotto) db.partners.find(x => x.id === id).sponsor_id = p.id; salva(); return pub(p); },
    cancella: async pid => { const t = db.partners.find(x => x.id === pid); let n = 0;
      for(const x of db.partners) if(x.sponsor_id === pid){ x.sponsor_id = t.sponsor_id; n++; }
      db.partners = db.partners.filter(x => x.id !== pid); db.activities = db.activities.filter(a => a.partner_id !== pid); salva(); return n; },
    cambiaSponsor: async (pid, sp) => { if(!mio().is_admin) throw new Error("non_autorizzato");
      const x = db.partners.find(y => y.id === pid);
      const s = db.partners.find(y => y.id === sp);
      for(let u = s; u; u = db.partners.find(y => y.id === u.sponsor_id)) if(u.sponsor_id === pid){ s.sponsor_id = x.sponsor_id; break; }
      x.sponsor_id = sp; salva(); return {}; },
    attivitaGruppo: async dal => { const io = mio(); if(!io) return [];
      const sotto = id => db.partners.filter(p => p.sponsor_id === id).flatMap(p => [p.id].concat(sotto(p.id)));
      const ids = new Set([io.id].concat(sotto(io.id))); return db.activities.filter(a => ids.has(a.partner_id) && a.data >= dal); },
    obiettiviGruppo: async () => db.goals,
    obiettiviMeseGruppo: async () => db.mgoals,
    cambiaChiave: async () => { const p = mio(); p.chiave = hex();
      db.accessi = db.accessi.filter(a => a.partner_id !== p.id || a.user_id === session.user.id); salva(); return p.chiave; },
    stages: async () => db.stages,
    settings: async () => db.settings,
    activities: async (pid, dal) => db.activities.filter(a => a.partner_id === pid && (a.data >= dal || ["ordine","rettifica","cliente"].includes(a.tipo))),
    addActivity: async row => { const r = Object.assign({ id:uid(), inserito_il:new Date().toISOString(), inserito_da:mio().id }, row); db.activities.push(r); salva(); return r; },
    deleteActivity: async id => { db.activities = db.activities.filter(a => a.id !== id); salva(); },
    lastGoal: async (pid, fino) => db.goals.filter(g => g.partner_id === pid && g.settimana <= fino).sort((a,b) => a.settimana < b.settimana ? 1 : -1).slice(0,1),
    saveGoal: async row => { db.goals = db.goals.filter(g => !(g.partner_id === row.partner_id && g.settimana === row.settimana)); db.goals.push(row); salva(); return row; },
    lastMonthGoal: async (pid, fino) => db.mgoals.filter(g => g.partner_id === pid && g.mese <= fino).sort((a,b) => a.mese < b.mese ? 1 : -1).slice(0,1),
    saveMonthGoal: async row => { db.mgoals = db.mgoals.filter(g => !(g.partner_id === row.partner_id && g.mese === row.mese)); db.mgoals.push(row); salva(); return row; }
  };
})();
