// API finta in memoria; window.__DB è condiviso tra "dispositivi" dal test
(function(){
  const db = window.__DB;
  let session = null;
  try{ session = JSON.parse(localStorage.getItem("mock.session")); }catch(e){}
  const uid = () => "id" + Math.random().toString(36).slice(2, 10);
  const codiceInvito = () => Array.from({length:6}, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random()*32)]).join("");
  const hex = () => Array.from({length:32}, () => "0123456789abcdef"[Math.floor(Math.random()*16)]).join("");
  const mio = () => { const a = session && db.accessi.find(x => x.user_id === session.user.id); return a ? db.partners.find(p => p.id === a.partner_id) : null; };
  const pub = p => { if(!p) return null; const c = Object.assign({}, p); delete c.chiave; return c; };
  const salva = () => { window.__DBOUT = db; };
  /* come nel database: vedo me, chi usa l'app nel mio gruppo e le persone che ho importato io */
  const sotto = id => db.partners.filter(p => p.sponsor_id === id).flatMap(p => [p].concat(sotto(p.id)));
  const vedo = (io, p) => p.id === io.id || (sotto(io.id).some(x => x.id === p.id) && (p.stato !== "gestito" || p.gestore_id === io.id));
  const visibili = io => [io].concat(sotto(io.id).filter(p => vedo(io, p)));
  /* struttura "ricucita": ognuno sotto il primo sopra di lui che vedo */
  const sponsorVis = (io, p) => { if(p.id === io.id) return null;
    for(let s = db.partners.find(x => x.id === p.sponsor_id); s; s = db.partners.find(x => x.id === s.sponsor_id)) if(vedo(io, s)) return s.id;
    return null; };
  const visibiliRicuciti = io => visibili(io).map(p => Object.assign({}, p, { sponsor_id:sponsorVis(io, p) }));
  const antenatoConApp = p => { let s = db.partners.find(x => x.id === p.sponsor_id);
    while(s && s.stato === "gestito" && s.sponsor_id) s = db.partners.find(x => x.id === s.sponsor_id); return s ? s.id : p.sponsor_id; };
  window.GROWUP_API = {
    session: async () => session,
    signInAnon: async () => { if(db.anonDisattivo) throw new Error("Anonymous sign-ins are disabled");
      session = { user:{ id:"anon-" + uid() } }; localStorage.setItem("mock.session", JSON.stringify(session)); db.anon++; salva(); },
    signOut: async () => { session = null; localStorage.removeItem("mock.session"); },
    sponsorName: async c => { const i = (db.invitiAdmin || []).find(x => x.codice === c && !x.usato);
      const p = db.partners.find(p => p.codice_invito === c) || (i && db.partners.find(p => p.id === i.sponsor_id)); return p ? p.nome : null; },
    collega: async () => pub(mio()),
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
        Object.assign(p, dati, { gestore_id:null, sponsor_id:antenatoConApp(p) });
      }else{
        p = Object.assign({ id:uid(), sponsor_id:sp.id, codice_amway:a.p_codice_amway,
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
    mostra: async (io, pid) => { db.nascosti = (db.nascosti || []).filter(x => !(x.partner_id === io && x.nascosto_id === pid)); salva(); },
    riepilogo: async mese => { const io = mio(); if(!io) return []; const m = mese.slice(0, 7);
      const ric = visibiliRicuciti(io);
      const figliVis = id => ric.filter(p => p.sponsor_id === id);
      const num = id => (db.numeri || []).find(x => x.visto_da === io.id && x.partner_id === id && x.mese === m);
      const pers = id => db.activities.filter(a => a.partner_id === id && (a.tipo === "ordine" || a.tipo === "rettifica") && a.data.slice(0, 7) === m).reduce((t, a) => t + Number(a.vp), 0);
      const grp = id => pers(id) + figliVis(id).reduce((t, p) => t + grp(p.id), 0);
      return ric.map(p => { const n = num(p.id);
        return { partner_id:p.id, sponsor_id:p.sponsor_id || null, vp_personali:pers(p.id), vp_gruppo:n ? n.vpg : grp(p.id),
          linee_attive:n ? n.linee.filter(l => l.vpg >= 100).length : 0, percentuale:n ? n.percentuale : null, qualifica:null, chiuso:false,
          da_report:!!n, linee_report:n ? n.linee : null, linee_nascoste:n ? !!n.nascoste : false }; }); },
    storico: async pid => (db.storico || []).filter(r => r.partner_id === pid),
    livelli: async () => [[3,200],[6,600],[9,1200],[12,2400],[15,4000],[18,7000],[21,10000]].map(([percentuale, vp_gruppo]) => ({ percentuale, vp_gruppo })),
    conferma: async a => { const p = db.partners.find(x => x.id === a.p_partner);
      Object.assign(p, { qualifica_iniziale:a.p_qualifica, percentuale_iniziale:a.p_percentuale, qualifica_iniziale_mese:a.p_qualifica_mese,
        pagamenti_iniziali:a.p_pagamenti, partenza_confermata_il:new Date().toISOString() }); db.conferme = (db.conferme || []).concat([a]); salva(); return pub(p); },
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
      const salvaNumeri = (pid, r) => { if(r.vpg == null) return; const m = a.p_mese.slice(0, 7);
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
      const ids = new Set(visibili(io).map(p => p.id)); return db.activities.filter(a => ids.has(a.partner_id) && a.data >= dal); },
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
