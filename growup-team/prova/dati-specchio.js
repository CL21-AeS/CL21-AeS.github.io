/* Growup Team · versione di prova: due situazioni PRONTE DA GUARDARE (20 novembre 2026, richiesta di Stefano), con dati
   INVENTATI. Nessun nome, codice Amway o numero vero: della situazione di Stefano e Alessia si copia solo la FORMA (quante
   linee, quante con un gruppo, una linea molto profonda, una linea con una persona al 21% dentro, circa un terzo che
   fattura), mai le persone o le cifre.
   - Carla e Bruno Valenti (id «X»), «in attività da anni, come Stefano e Alessia»: Platino Fondatore dichiarato, al 21%,
     15 linee frontali (6 con un gruppo), circa 140 persone su 20 livelli, 13 mesi di mappe (12 chiusi), l'app in uso da mesi (Lista, clienti,
     agenda, obiettivo, 7 caselle della strategia già scelte). Nella linea di Fausto Neri c'è Patrizia Gallo al 21%: Amway
     toglie i suoi VP dalla VPG di chi sta sopra, quindi nella mappa la linea di Fausto è quasi a 0 (l'analisi la conta
     con i VP veri). Il Path to Bronze nuovo (contano solo le linee iscritte dal 1° giugno 2026): Dario Conti l'ha fatto
     con 3 linee nuove (la festa), Gianni Rota ha 3 linee vecchie da 100 VP (non contano), Marisa Leone è già stata al 9%
     con 3 linee (la sua prossima tappa vera è Bronze Foundation), Nadia Serra lo sta facendo.
   - Nadia Serra (id «xn»), «ha appena iniziato»: iscritta da 45 giorni, percorso di partenza finito, frontale dei Valenti.
     Il suo Path to Bronze: 110 VP personali, una linea nuova da 120 VP e una da 60 (1 su 3).
   Si aggiungono ai dati della prova una volta sola (db._prova.specchio): Luca, Giulia e Stefano e Alessia della prova non
   cambiano. Le date sono relative a oggi; le linee «vecchie» hanno date fisse (prima del 1° giugno 2026). */
window.GROWUP_PROVA_SPECCHIO = function(db){
  "use strict";
  if(!db || (db._prova && db._prova.specchio)) return db;
  const CHIAVE_X = "8b".repeat(16), CHIAVE_N = "9c".repeat(16);
  /* ---- tempo: tutto è relativo a oggi ---- */
  const adesso = Date.now(), giorno = 864e5;
  const oggi = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); })();
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const gg = n => { const d = new Date(oggi); d.setDate(d.getDate() - n); return iso(d); };
  const ts = n => new Date(adesso - n * giorno).toISOString();
  const mese = k => iso(new Date(oggi.getFullYear(), oggi.getMonth() - k, 1, 12)).slice(0, 7);
  const fineMese = m => { const [a, b] = m.split("-").map(Number); return iso(new Date(a, b, 0, 12)); };
  const lunedi = d => { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return iso(x); };
  const giornoDelMese = oggi.getDate(), giorniMese = new Date(oggi.getFullYear(), oggi.getMonth() + 1, 0).getDate();
  let seme = 20261120;
  const caso = () => { seme |= 0; seme = seme + 0x6D2B79F5 | 0; let t = Math.imul(seme ^ seme >>> 15, 1 | seme);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const tra = (a, b) => Math.round(a + caso() * (b - a));
  let nId = 0; const id = p => `x${p}-${(++nId).toString(36)}`;
  const X = "X", N = "xn";

  /* ---- i nomi inventati (combinazioni di nomi e cognomi comuni, senza ripetizioni) ---- */
  const NOMI = ["Adele", "Alberto", "Alessio", "Amalia", "Angelo", "Arianna", "Bianca", "Carlo", "Cinzia", "Corrado", "Debora", "Diego", "Edoardo",
    "Elena", "Emilio", "Enza", "Fabiola", "Filippo", "Flora", "Franco", "Gemma", "Gino", "Grazia", "Igor", "Ilenia", "Leandro", "Licia", "Loredana",
    "Mario", "Milena", "Mirco", "Nella", "Omar", "Ornella", "Pamela", "Renato", "Rosalba", "Sabrina", "Sandro", "Tiziana", "Ugo", "Vanessa", "Vito", "Wanda"];
  const COGNOMI = ["Amato", "Bassi", "Belli", "Brambilla", "Calò", "Cattani", "Cocco", "Dalla Valle", "Deiana", "Ferrante", "Florio", "Gentili", "Giordano",
    "Iacono", "Lanza", "Locatelli", "Longhi", "Martelli", "Massa", "Mazza", "Nardi", "Orsini", "Palumbo", "Pellegrini", "Porcu", "Ragusa", "Rinaldi",
    "Sacco", "Santini", "Serafini", "Tedesco", "Toscano", "Vairo", "Zanella", "Zucca"];
  const usati = new Set(["Ornella Ricci", "Fausto Neri", "Patrizia Gallo", "Nadia Serra", "Gianni Rota", "Marisa Leone", "Dario Conti", "Elena Sanna",
    "Ivo Cattani", "Sonia Lanza", "Renato Florio", "Licia Orsini", "Mirco Deiana", "Adele Martelli", "Corrado Nardi", "Gemma Porcu", "Wanda Toscano",
    "Omar Ragusa", "Flora Bassi"]);
  const nomeNuovo = () => { for(let i = 0; i < 500; i++){ const n = NOMI[tra(0, NOMI.length - 1)] + " " + COGNOMI[tra(0, COGNOMI.length - 1)];
    if(!usati.has(n)){ usati.add(n); return n; } } return "Persona " + (++nId); };

  /* ---- la struttura ---- */
  const partners = [];
  let codice = 7600000;
  /* vp: VP personali tipici; fattura: quanto spesso ordina (0-1); iscr: data di iscrizione */
  const nuova = (k, nome, sponsor, iscr, vp, fattura, x) => { const p = Object.assign({ id:k, nome, sponsor_id:sponsor, codice_amway:String(++codice),
    codice_invito:("V" + (++nId).toString(36).toUpperCase() + "XQZ").slice(0, 6), data_iscrizione:iscr, creato_il:ts(200), stato:"gestito", gestore_id:X,
    mappa_mese:mese(0) + "-01", posizione_al:ts(2), partenza_confermata_il:ts(200), _vp:vp, _f:fattura }, x); partners.push(p); return p; };
  const anni = () => { const y = tra(2014, 2024); return `${y}-${String(tra(1, 12)).padStart(2, "0")}-${String(tra(1, 28)).padStart(2, "0")}`; };
  const app = (p, x) => Object.assign(p, { stato:"attivo", gestore_id:null, confermato_il:ts(150), privacy_accettata_il:ts(150), partenza_completata_il:ts(120),
    ultimo_aggiornamento:ts(1) }, x);

  /* Carla e Bruno Valenti: Platino Fondatore dichiarato (la radice di questo gruppo) */
  nuova(X, "Carla e Bruno Valenti", null, "2008-04-15", 380, 1);
  app(partners[0], { chiave:CHIAVE_X, qualifica_iniziale:"platino_fondatore", percentuale_iniziale:21, primo_import_il:ts(330), prossima_qualifica:"rubino",
    confermato_il:ts(330), privacy_accettata_il:ts(330), partenza_completata_il:ts(330), creato_il:ts(330), ultimo_aggiornamento:ts(0) });

  /* 1. Ornella Ricci: la linea più grande, con una gamba molto profonda (20 livelli); usa l'app */
  app(nuova("xor", "Ornella Ricci", X, "2016-09-03", 240, 0.95), { ultimo_aggiornamento:ts(2) });
  let su = "xor";
  for(let i = 0; i < 19; i++){ const p = nuova(id("p"), nomeNuovo(), su, i > 14 ? gg(tra(15, 120)) : anni(), tra(50, 180), 0.4); su = p.id; }
  const lineaOrnella = () => { const giu = [], pila = ["xor"]; while(pila.length){ const s = pila.pop();
    for(const f of partners.filter(p => p.sponsor_id === s)){ giu.push(f.id); pila.push(f.id); } } return giu; };
  for(let i = 0; i < 88; i++){ const sotto = ["xor"].concat(lineaOrnella()); const sp = sotto[tra(0, Math.min(sotto.length - 1, 25))];
    nuova(id("p"), nomeNuovo(), sp, caso() < 0.15 ? gg(tra(10, 150)) : anni(), tra(30, 150), caso() < 0.45 ? 0.5 : 0.08); }
  /* una persona in profondità nella linea di Ornella, che i Valenti aiutano (casella «Persona che aiuti») */
  const elena = nuova("xes", "Elena Sanna", partners.find(p => p.sponsor_id === "xor").id, "2021-02-11", 160, 0.95);

  /* 2. Fausto Neri: la linea qualificata. Sotto c'è Patrizia Gallo, Platino senza app con il gruppo non visibile nella mappa */
  nuova("xfn", "Fausto Neri", X, "2012-06-20", 110, 0.9);
  nuova("xpg", "Patrizia Gallo", "xfn", "2013-10-02", 260, 1);

  /* 3. Nadia Serra: ha appena iniziato (45 giorni), usa l'app; due linee nuove (iscritte 20 e 10 giorni fa) */
  app(nuova(N, "Nadia Serra", X, gg(45), 110, 1), { chiave:CHIAVE_N, creato_il:ts(44), confermato_il:ts(40), privacy_accettata_il:ts(44),
    partenza_confermata_il:ts(44), partenza_completata_il:ts(5), incontro_sponsor:gg(38), invitato_da:X, invitato_il:ts(45), ultimo_aggiornamento:ts(0),
    primo_import_il:null });
  nuova("xn1", "Ivo Cattani", N, gg(20), 120, 1); nuova("xn2", "Sonia Lanza", N, gg(10), 60, 1);

  /* 4. Gianni Rota: tre linee VECCHIE (2023) da 100 VP: per il Path to Bronze non contano */
  nuova("xgr", "Gianni Rota", X, "2022-11-08", 120, 1);
  nuova("xg1", "Renato Florio", "xgr", "2023-02-14", 130, 1); nuova("xg2", "Licia Orsini", "xgr", "2023-05-30", 110, 1); nuova("xg3", "Mirco Deiana", "xgr", "2023-09-12", 100, 1);

  /* 5. Marisa Leone: tre mesi fa al 9% con 3 linee attive: la sua prossima tappa vera è Bronze Foundation, non il Path to Bronze */
  nuova("xml", "Marisa Leone", X, "2019-03-21", 160, 1);
  for(const [k, n] of [["xm1", "Adele Martelli"], ["xm2", "Corrado Nardi"], ["xm3", "Gemma Porcu"]]){
    nuova(k, n, "xml", anni(), 90, 0.7); for(let i = 0; i < 2; i++) nuova(id("p"), nomeNuovo(), k, anni(), tra(40, 120), 0.4); }

  /* 6. Dario Conti: iscritto da poco, tre linee NUOVE da almeno 100 VP: Path to Bronze fatto (la festa) */
  nuova("xdc", "Dario Conti", X, gg(110), 130, 1);
  nuova("xd1", "Wanda Toscano", "xdc", gg(80), 120, 1); nuova("xd2", "Omar Ragusa", "xdc", gg(60), 110, 1); nuova("xd3", "Flora Bassi", "xdc", gg(40), 105, 1);

  /* 7-15: frontali senza gruppo: qualcuno fattura, cinque mai (le «altre N senza fatturato») */
  for(let i = 0; i < 9; i++) nuova(id("f"), nomeNuovo(), X, i === 0 ? gg(50) : i === 1 ? gg(25) : anni(), i < 4 ? tra(50, 140) : 0, i < 4 ? 0.8 : 0);

  /* ---- 13 mesi di mappe (12 chiusi + quello in corso), come le importano i Valenti ---- */
  const figli = s => partners.filter(p => p.sponsor_id === s);
  const pct = v => [[10000, 21], [7000, 18], [4000, 15], [2400, 12], [1200, 9], [600, 6], [200, 3]].find(([s]) => v >= s)?.[1] || 0;
  /* i valori fissati: [persona][mesi fa] = VP personali */
  const forza = {
    xn:{ 1:70, 0:110 }, xn1:{ 0:120 }, xn2:{ 0:60 },
    xgr:{ 1:115, 0:120 }, xg1:{ 1:120, 0:130 }, xg2:{ 1:105, 0:110 }, xg3:{ 1:100, 0:100 },
    xml:{ 3:320, 0:150 }, xm1:{ 3:380, 0:70 }, xm2:{ 3:300, 0:40 }, xm3:{ 3:260, 0:0 },
    xdc:{ 1:120, 0:130 }, xd1:{ 1:60, 0:120 }, xd2:{ 1:40, 0:110 }, xd3:{ 0:105 }, xes:{ 1:150, 0:170 }
  };
  /* Patrizia: VPG del suo gruppo (non visibile nella mappa). Al 21% nei mesi chiusi da 1 a 4, al 18% negli altri */
  const vpgPatrizia = k => k >= 1 && k <= 4 ? 10200 + tra(0, 700) : k === 0 ? Math.round(9100 * Math.max(0.6, giornoDelMese / giorniMese)) : 8200 + tra(0, 1500);
  const numeri = [];
  for(let k = 12; k >= 0; k--){
    const m = mese(k), fine = fineMese(m), quota = k === 0 ? Math.max(0.35, giornoDelMese / giorniMese) : 1;
    const al = k === 0 ? ts(1) : new Date(new Date(fine + "T12:00:00").getTime() + 3 * giorno).toISOString();
    const vpp = new Map();
    for(const p of partners){
      if(p.data_iscrizione > fine) continue;
      if(forza[p.id] && forza[p.id][k] != null){ vpp.set(p.id, forza[p.id][k]); continue; }
      const primo = p.data_iscrizione.slice(0, 7) === m;
      let v = caso() < p._f ? p._vp * (0.8 + caso() * 0.6) : 0;
      if(primo) v = Math.max(55, v);
      vpp.set(p.id, Math.round(v * quota * 100) / 100);
    }
    /* la VPG come la scrive Amway: chi è al 21% o più non conta nella VPG di chi gli sta sopra */
    const vpg = new Map(), perc = new Map();
    const calcola = s => {
      if(vpg.has(s)) return vpg.get(s);
      let t = s === "xpg" ? vpgPatrizia(k) : vpp.get(s) || 0;
      if(s !== "xpg") for(const f of figli(s)) if(vpp.has(f.id)){ const g = calcola(f.id); if(perc.get(f.id) < 21) t += g; }
      t = Math.round(t * 100) / 100; vpg.set(s, t); perc.set(s, pct(t)); return t; };
    calcola(X);
    perc.set(X, 21);
    if(perc.get("xpg") >= 21 && vpp.has("xfn")) perc.set("xfn", 21);   // come nella mappa vera: la sponsor di una 21% risulta al 21%
    for(const p of partners){
      if(!vpp.has(p.id)) continue;
      const linee = p.id === "xpg" ? [] : figli(p.id).filter(f => vpp.has(f.id)).map(f => ({ codice:f.codice_amway, vpg:vpg.get(f.id) }));
      numeri.push({ visto_da:X, partner_id:p.id, mese:m, vpp:vpp.get(p.id), vpg:vpg.get(p.id), percentuale:perc.get(p.id), linee,
        nascoste:p.id === "xpg", dati_al:al });
    }
  }
  for(const p of partners){ delete p._vp; delete p._f; }

  /* ---- la Lista, i clienti e l'agenda (Valenti: l'app in uso da mesi; Nadia: le prime settimane) ---- */
  const persone = [], passi = [], activities = [], ordini = [], righe = [];
  const ORD = { contatto:1, invito:2, piano:3, followup:4 };
  const persona = (proprietario, nome, x) => { const p = Object.assign({ id:id("pe"), proprietario, nome, contatto:null, origine:null, fase:"lista", esito:null,
    creato_il:ts(x && x._creato != null ? x._creato : 60), prossima_data:null, prossima_ora:null, prossima_nota:null, prossima_per:null, prossima_come:null,
    note:null, fonte:null }, x); delete p._creato; persone.push(p); return p; };
  const COME = ["Telefono", "Messaggio", "Di persona"], REAZ = ["Aperto, incuriosito", "Interessato", "Ha fatto domande", "Tiepido"];
  const percorso = (p, tappe) => {
    for(const [tipo, d, x] of tappe){
      const r = Object.assign({ id:id("ps"), proprietario:p.proprietario, persona_id:p.id, tipo, data:gg(d), come:null, reazione:null, esito:null, nota:null,
        creato_il:ts(d) + Math.random(), attivita_id:null }, tipo === "chiusura" ? {} : { come:COME[tra(0, 2)], reazione:tipo === "piano" ? "Gli è piaciuto" : REAZ[tra(0, 3)] }, x);
      const t = tipo === "contatto" ? "contatto" : tipo === "piano" ? "piano" : tipo === "chiusura" && r.esito === "cliente" ? "cliente" : null;
      if(t){ const a = { id:id("at"), partner_id:p.proprietario, tipo:t, quantita:1, data:r.data, inserito_da:p.proprietario, inserito_il:ts(d) };
        activities.push(a); r.attivita_id = a.id; }
      passi.push(r);
    }
    const ps = passi.filter(x => x.persona_id === p.id);
    p.fase = ["lista", "contattato", "invitato", "piano", "followup"][Math.max(0, ...ps.map(x => ORD[x.tipo] || 0))];
    const c = ps.filter(x => x.tipo === "chiusura").sort((a, b) => a.data < b.data ? 1 : -1)[0];
    p.esito = c ? c.esito : null; return p; };
  const prodotto = c => (db.listino || []).find(x => x.codice === c);
  const ordine = (p, d, codici) => { const o = { id:id("or"), proprietario:p.proprietario, persona_id:p.id, data:gg(d), modo:"sito", nota:null,
      consegnato:gg(Math.max(0, d - 3)), pagato:gg(Math.max(0, d - 3)), verificato:null, creato_il:ts(d) + Math.random() }; ordini.push(o);
    for(const c of codici){ const r = prodotto(c); if(r) righe.push({ id:id("ri"), proprietario:p.proprietario, ordine_id:o.id, codice:c, nome:r.nome, quantita:1,
      prezzo:r.prezzo_cliente, prezzo_partner:r.prezzo_partner, vp:r.vp }); } };
  const cliente = (prop, nome, inizio, ordiniC, x) => { const p = percorso(persona(prop, nome, Object.assign({ _creato:inizio + 2 }, x)),
    [["contatto", inizio], ["chiusura", inizio - 2, { esito:"cliente" }]]); for(const [d, c] of ordiniC) ordine(p, d, c); return p; };

  /* Valenti */
  [["Lidia Carraro", "vicini"], ["Ettore Pace", "circolo del tennis"], ["Marta Ziliani", "ex colleghi"], ["Paolo Ferrero", "amici"], ["Teresa Bonomi", "palestra"]]
    .forEach(([n, o], i) => persona(X, n, { origine:o, contatto:"333 200 00" + (10 + i), _creato:15 + i * 4, fonte:"conoscenza" }));
  percorso(persona(X, "Roberta Gallina", { origine:"amici", contatto:"333 200 0021", _creato:9, prossima_data:gg(0), prossima_ora:"19:00:00", prossima_per:"fissare_piano", prossima_come:"telefono" }), [["contatto", 3]]);
  percorso(persona(X, "Luigi Brenna", { origine:"circolo del tennis", contatto:"333 200 0022", _creato:14, prossima_data:gg(-2), prossima_ora:"21:00:00", prossima_per:"piano", prossima_come:"persona" }), [["contatto", 10], ["invito", 5]]);
  percorso(persona(X, "Simona Rizzo", { origine:"social", _creato:20, fonte:"social" }), [["contatto", 16], ["invito", 12], ["piano", 7]]);
  percorso(persona(X, "Fabio Monaco", { origine:"ex colleghi", _creato:40 }), [["contatto", 33], ["invito", 27]]);
  percorso(persona(X, "Antonio Valle", { origine:"amici", _creato:70 }), [["contatto", 66], ["invito", 60], ["piano", 55], ["chiusura", 50, { esito:"no" }]]);
  cliente(X, "Giovanna Sala", 300, [[120, ["910001"]], [60, ["910001", "910002"]], [28, ["910001", "910002"]]], { contatto:"333 200 0031" });
  cliente(X, "Michele Fontana", 200, [[95, ["910008"]], [20, ["910008", "910010"]]], { contatto:"333 200 0032" });
  cliente(X, "Rita Marchesi", 150, [[70, ["910005", "910007"]], [12, ["910005", "910006"]]], { contatto:"333 200 0033" });
  cliente(X, "Beppe Usai", 90, [[40, ["910003"]], [6, ["910003", "910014"]]], { contatto:"333 200 0034" });
  cliente(X, "Noemi Valentini", 60, [[33, ["910011", "910013"]]], { contatto:"333 200 0035" });
  for(const [pid, n] of [["xor", 10], [N, 14]]) for(let i = 0; i < n; i++)
    activities.push({ id:id("at"), partner_id:pid, tipo:i % 4 === 3 ? "piano" : "contatto", quantita:1, data:gg(tra(0, 26)), inserito_da:pid, inserito_il:ts(tra(0, 26)) });

  /* Nadia: i suoi primi 32 nomi (la fase 2 del percorso è fatta), qualche contatto, i suoi primi 3 clienti */
  ["Mamma", "Zia Rosa", "Kevin Bassi", "Ilaria Dotti", "Marco (calcetto)", "Giada Morini", "Luca Fermi", "Sara Poli", "Elio Dessì", "Anna (vicina)", "Tea Masi",
   "Bruno Leoni", "Chiara Sella", "Dino Corti", "Erika Fusi", "Fede (palestra)", "Gaia Rota", "Hassan Amin", "Irma Gallo", "Jessica Pini", "Kira Neri", "Lino Sacchi",
   "Mia Belotti", "Nico Varese", "Ottavia Lupo", "Pino Grassi", "Rosa Casini", "Sandro Melis", "Tina Ferro"].forEach((n, i) => { const p = persona(N, n, { _creato:42 - Math.min(i, 30) });
    if(i < 9) percorso(p, i < 3 ? [["contatto", 30 - i * 3], ["invito", 24 - i * 3]] : [["contatto", 20 - i]]); });
  cliente(N, "Paola Dotti", 35, [[33, ["910001"]], [3, ["910001"]]]);
  cliente(N, "Giorgio Fermi", 25, [[22, ["910002"]]]);
  cliente(N, "Alice Morini", 15, [[12, ["910008"]]]);
  percorso(persona(N, "Sofia Biondi", { origine:"corso di yoga", _creato:6, prossima_data:gg(0), prossima_ora:"18:00:00", prossima_per:"contatto", prossima_come:"whatsapp" }), []);

  /* ---- obiettivi, settimane, caselle della strategia ---- */
  const goals = [], mgoals = [];
  for(let w = 0; w < 10; w++) for(const pid of [X, N, "xor"]) if(!(pid === N && w > 5)) goals.push({ partner_id:pid, settimana:lunedi(gg(w * 7)), obiettivo_contatti:pid === N ? 10 : 12, obiettivo_piani:3 });
  for(const pid of [X, N, "xor"]) mgoals.push({ partner_id:pid, mese:mese(0) + "-01", obiettivo_vp:pid === N ? 100 : pid === X ? 350 : 250 });
  const obiettivi = [
    { partner_id:X, cifra_mese:9000, entro:(oggi.getFullYear() + 2) + "-12-01", perche:"Più tempo per la famiglia e per far crescere i nostri leader" },
    { partner_id:N, cifra_mese:600, entro:(oggi.getFullYear() + 1) + "-09-01", perche:"Finire di pagare l'auto e mettere da parte qualcosa" },
    { partner_id:"xor", cifra_mese:2000, entro:(oggi.getFullYear() + 1) + "-12-01", perche:"Lavorare part-time" }];
  /* le 7 caselle dei Valenti (Platino: da 3 a 20) */
  const caselle = [["aiuta", N, N], ["aiuta", "xdc", "xdc"], ["aiuta", "xgr", "xgr"], ["aiuta", "xml", "xml"], ["aiuta", elena.id, "xor"],
    ["profondita", null, "xfn"], ["nuova_linea", null, null]]
    .map(([tipo, persona_id, linea_id], i) => ({ partner_id:X, posizione:i + 1, tipo, persona_id, linea_id, creato_il:ts(20) }));

  /* ---- dentro i dati della prova ---- */
  const unisci = (t, l) => { db[t] = (db[t] || []).concat(l); };
  unisci("partners", partners); unisci("numeri", numeri); unisci("persone", persone); unisci("passi", passi); unisci("activities", activities);
  unisci("ordini", ordini); unisci("righe", righe); unisci("goals", goals); unisci("mgoals", mgoals); unisci("obiettivi", obiettivi); unisci("caselle", caselle);
  unisci("seguimi", [{ partner_id:X, attivo:false, condividi:false }, { partner_id:N, attivo:false, condividi:true }]);
  unisci("invitiP", [{ id:"inv-nadia", codice:"9d".repeat(16), creato_da:X, nome:"Nadia Serra", codice_amway:partners.find(p => p.id === N).codice_amway,
    creato_il:ts(46), scade_il:ts(39), annullato_il:null, usato_il:ts(45), usato_da:N }]);
  db._prova = Object.assign(db._prova || {}, { specchio:{ chiaveValenti:CHIAVE_X, chiaveNadia:CHIAVE_N } });
  return db;
};
