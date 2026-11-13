/* Growup Team · versione di prova: i dati INVENTATI.
   Nessun nome, codice Amway, numero o contatto vero: sono tutti di fantasia. Le date partono da oggi, così la prova è
   sempre «fresca» (il mese in corso, la settimana, l'agenda di oggi). Le persone della prova:
   - Stefano e Alessia: upline e admin, importano la mappa;
   - Giulia Martini: in attività da due anni, con Lista, clienti, gruppo, Verifica; è la sponsor di Sara e di Luca;
   - Luca Bassi: iscritto ad Amway da pochi giorni, non ancora in una mappa importata; entra con l'invito di Giulia
     (resta «in attesa della mappa») e trova già 29 nomi nella Lista (li mette avvio-prova.js all'ingresso);
   - Sara Conti: entrata 12 giorni fa con l'invito di Giulia, a metà del percorso di partenza. */
/* la versione dei dati: se cambia, chi aveva una prova più vecchia sul telefono ricomincia da capo */
window.GROWUP_PROVA_VERSIONE = 3;
window.GROWUP_PROVA_DATI = function(){
  "use strict";
  /* ---- tempo: tutto è relativo a oggi ---- */
  const adesso = Date.now(), giorno = 864e5;
  const oggi = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); })();
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const gg = n => { const d = new Date(oggi); d.setDate(d.getDate() - n); return iso(d); };          // n giorni fa (n < 0: tra -n giorni)
  const ts = n => new Date(adesso - n * giorno).toISOString();                                        // n giorni fa, con l'ora
  const mese = k => { const d = new Date(oggi.getFullYear(), oggi.getMonth() - k, 1, 12); return iso(d).slice(0, 7); };   // k mesi fa
  const fineMese = m => { const [a, b] = m.split("-").map(Number); return iso(new Date(a, b, 0, 12)); };
  const lunedi = d => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return iso(x); };
  const mesiFa = k => { const d = new Date(oggi); d.setMonth(d.getMonth() - k); return iso(d); };
  const giornoDelMese = oggi.getDate(), giorniMese = new Date(oggi.getFullYear(), oggi.getMonth() + 1, 0).getDate();
  /* un caso «fisso»: con lo stesso seme gli stessi numeri */
  let seme = 20261107;
  const caso = () => { seme |= 0; seme = seme + 0x6D2B79F5 | 0; let t = Math.imul(seme ^ seme >>> 15, 1 | seme);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const tra = (a, b) => Math.round(a + caso() * (b - a));
  let nId = 0; const id = p => `${p}-${(++nId).toString(36)}`;

  /* ---- le chiavi della prova (pubbliche: servono solo a scegliere chi essere nella prova) ---- */
  const CHIAVE = { R:"5a".repeat(16), G:"6b".repeat(16), S:"7d".repeat(16) }, INVITO_LUCA = "7c".repeat(16);
  /* il codice Amway di Luca: non è in nessuna mappa importata (si è iscritto da pochi giorni) */
  const CODICE_LUCA = "7199010";

  /* ---- tappe e impostazioni: le stesse dell'app vera (non sono dati personali) ---- */
  const T = (ordine, chiave, nome, x) => Object.assign({ ordine, chiave, nome, percentuale:null, vp_personali:0, vp_gruppo:null, linee:null, vp_linea:null,
    linee_obiettivo:null, clienti:null, giorni_scadenza:null, linee_nuove_dal:null, pagamenti_max:null, mesi_finestra:null, guadagno_mese:null,
    struttura_calcolo:null, descrizione:null }, x);
  const ARG = "Argento ogni mese più altre linee aperte (ideale 10.000 VP, almeno 4.000 VP)", ALTRE = " più altre linee aperte (ideale 10.000 VP, almeno 4.000 VP)";
  const stages = [
    T(1, "primo_ordine", "Primo ordine", { vp_personali:50, giorni_scadenza:30, descrizione:"Almeno 50 VP personali entro 30 giorni dall'iscrizione, per non pagare i 40 € di iscrizione" }),
    T(2, "primi_clienti", "Primi clienti", { clienti:3, descrizione:"I primi 3 clienti, in totale e non nello stesso mese: chi si iscrive il 29 non ha il tempo di farli in due giorni" }),
    T(3, "path_to_bronze", "Path to Bronze", { vp_personali:100, linee:3, vp_linea:100, guadagno_mese:150, struttura_calcolo:"100 VP personali + 3 linee da 100 VP", descrizione:"3 prime linee da almeno 100 VP ciascuna, più 100 VP personali" }),
    T(4, "foundation_9", "Bronze Foundation 9%", { percentuale:9, vp_personali:100, vp_gruppo:1200, linee:3, vp_linea:200, pagamenti_max:12, mesi_finestra:18, guadagno_mese:360, struttura_calcolo:"100 VP personali + 3 linee da 400 VP", descrizione:"1.200 VP di gruppo, 3 linee frontali da almeno 200 VP, 100 VP personali" }),
    T(5, "foundation_12", "Bronze Foundation 12%", { percentuale:12, vp_personali:100, vp_gruppo:2400, linee:3, vp_linea:200, pagamenti_max:12, mesi_finestra:18, guadagno_mese:580, struttura_calcolo:"100 VP personali + 3 linee da 800 VP", descrizione:"2.400 VP di gruppo, 3 linee frontali da almeno 200 VP, 100 VP personali" }),
    T(6, "builder_15", "Bronze Builder 15%", { percentuale:15, vp_personali:200, vp_gruppo:4000, linee:3, vp_linea:600, pagamenti_max:12, mesi_finestra:18, guadagno_mese:1050, struttura_calcolo:"200 VP personali + 3 linee da 1.300 VP", descrizione:"4.000 VP di gruppo, 3 linee frontali da almeno 600 VP, 200 VP personali" }),
    T(7, "builder_18", "Bronze Builder 18%", { percentuale:18, vp_personali:200, vp_gruppo:7000, linee:3, vp_linea:600, pagamenti_max:12, mesi_finestra:18, guadagno_mese:1980, struttura_calcolo:"200 VP personali + 3 linee da 2.600 VP", descrizione:"7.000 VP di gruppo, 3 linee frontali da almeno 600 VP, 200 VP personali" }),
    T(8, "argento", "Argento 21%", { percentuale:21, vp_gruppo:10000, linee:2, linee_obiettivo:3, guadagno_mese:2500, struttura_calcolo:"200 VP personali + 3 linee da 4.100 VP, senza incentivi Bronze (circa 3.750 € se arrivi ad Argento mentre ricevi ancora gli incentivi Bronze)", descrizione:"10.000 VP di gruppo nel mese, su almeno 2 linee (obiettivo CL21: 3 linee attive)" }),
    T(9, "oro", "Oro", { descrizione:"3 mesi da Argento nel Performance Year, anche non consecutivi (la prima volta: in 12 mesi consecutivi)" }),
    T(10, "platino", "Platino", { guadagno_mese:3000, struttura_calcolo:ARG, descrizione:"6 mesi da Argento nel Performance Year (la prima volta: in 12 mesi consecutivi, 3 dei quali consecutivi)" }),
    T(11, "platino_fondatore", "Platino Fondatore", { guadagno_mese:3000, struttura_calcolo:ARG, descrizione:"12 mesi da Argento nel Performance Year, oppure 10-11 mesi e 144.000 VP di Volume Equivalente" }),
    T(12, "rubino", "Rubino", { guadagno_mese:4000, struttura_calcolo:"20.000 VP di Volume Rubino al mese" + ALTRE, descrizione:"Da Platino: almeno 20.000 VP di Volume Rubino in un mese" }),
    T(13, "rubino_fondatore", "Rubino Fondatore", { guadagno_mese:4000, struttura_calcolo:"20.000 VP di Volume Rubino al mese" + ALTRE, descrizione:"Da Platino: Rubino in tutti i 12 mesi del Performance Year" }),
    T(14, "zaffiro", "Zaffiro", { guadagno_mese:5000, struttura_calcolo:"2 linee al 21%" + ALTRE, descrizione:"6 mesi Zaffiro nel Performance Year: 4.000 VP di gruppo e 2 linee al 21%, oppure 3 linee al 21%" }),
    T(15, "zaffiro_fondatore", "Zaffiro Fondatore", { guadagno_mese:5000, struttura_calcolo:"2 linee al 21%" + ALTRE, descrizione:"12 mesi Zaffiro nel Performance Year, oppure 10-11 mesi e 345.600 VP di Volume Equivalente" }),
    T(16, "smeraldo", "Smeraldo", { guadagno_mese:8000, struttura_calcolo:"3 linee al 21%" + ALTRE, descrizione:"Da Platino: 3 linee frontali al 21% per almeno 6 mesi del Performance Year" }),
    T(17, "smeraldo_fondatore", "Smeraldo Fondatore", { guadagno_mese:8000, struttura_calcolo:"3 linee al 21%" + ALTRE, descrizione:"Da Platino: 3 linee frontali al 21% per tutti i 12 mesi del Performance Year" }),
    T(18, "diamante", "Diamante", { guadagno_mese:18000, struttura_calcolo:"6 linee al 21%" + ALTRE, descrizione:"Da Smeraldo: 6 linee frontali al 21% per almeno 6 mesi del Performance Year" }),
    T(19, "diamante_fondatore", "Diamante Fondatore", { guadagno_mese:18000, struttura_calcolo:"6 linee al 21%" + ALTRE, descrizione:"Da Smeraldo: 6 linee frontali al 21% per tutti i 12 mesi del Performance Year" })];
  const settings = [
    { chiave:"avviso_guadagni", valore:"Cifre indicative: i risultati dipendono dall'impegno di ciascuno e non sono garantiti." },
    { chiave:"chiusura_mese_giorno", valore:5 },
    { chiave:"fonte_guadagni", valore:"Simulatore di reddito ufficiale Amway, ottobre 2026" },
    { chiave:"giorni_presa_in_carico", valore:14 },
    { chiave:"obiettivi_proposti", valore:{ piani:3, vp_mese:100, contatti:10 } },
    { chiave:"soglia_linea_attiva", valore:100 },
    { chiave:"soglie_etichette", valore:{ quota_contatti:0.5, ordini_per_piani:0.3, quota_vp_followup:0.5, giorni_da_chiamare:7, piani_min_followup:2, piani_per_contatti:0.2 } },
    { chiave:"stabilita_cl21", valore:{ livelli:[3, 6, 9, 12, 15, 18, 21], righe:[
      { k:"nuovi_gruppo", nome:"Nuovi iscritti nel gruppo del mese", soglie:[1, 3, 5, 8, 10, 15, 20] },
      { k:"oltre_200", nome:"Codici che fatturano più di 200 VP", soglie:[1, 3, 5, 10, 17, 30, 42] },
      { k:"app_cl21", nome:"Codici iscritti all'app CumLaude21", soglie:[1, 2, 3, 7, 12, 21, 30] },
      { k:"training_day", nome:"Codici al Training Day", soglie:[1, 3, 5, 10, 17, 30, 42] },
      { k:"convention", nome:"Codici alla Convention", soglie:[1, 2, 3, 7, 12, 21, 30] }] } }];

  /* ---- il listino (prodotti inventati) ---- */
  const listino = [
    ["910001", "Multivitaminico Prova (31 giorni)", "186 compresse", "Integratori", 46.9, 38.9, 15.5],
    ["910002", "Omega Prova (60 giorni)", "120 capsule", "Integratori", 39.5, 32.8, 13.1],
    ["910003", "Proteine vegetali Prova", "450 g", "Integratori", 52.0, 43.1, 17.2],
    ["910004", "Probiotico Prova", "30 bustine", "Integratori", 34.9, 28.9, 11.5],
    ["910005", "Detergente multiuso Prova", "1 l", "Casa", 15.9, 13.2, 5.3],
    ["910006", "Detersivo lavatrice Prova", "3 kg", "Casa", 39.9, 33.1, 13.2],
    ["910007", "Piatti Prova", "1 l", "Casa", 12.5, 10.4, 4.1],
    ["910008", "Crema viso Prova", "50 ml", "Bellezza", 54.0, 44.8, 17.9],
    ["910009", "Siero viso Prova", "30 ml", "Bellezza", 68.0, 56.4, 22.5],
    ["910010", "Struccante Prova", "200 ml", "Bellezza", 22.5, 18.7, 7.5],
    ["910011", "Shampoo Prova", "250 ml", "Capelli", 13.9, 11.5, 4.6],
    ["910012", "Dentifricio Prova", "200 ml", "Corpo", 9.9, 8.2, 3.3],
    ["910013", "Bagnoschiuma Prova", "750 ml", "Corpo", 16.5, 13.7, 5.5],
    ["910014", "Barrette Prova", "14 pezzi", "Alimentazione", 29.9, 24.8, 9.9]
  ].map(([codice, nome, formato, categoria, prezzo_cliente, prezzo_partner, vp]) => ({ codice, nome, formato, categoria, prezzo_cliente, prezzo_partner, vp, attivo:true }));
  const prodotto = c => listino.find(x => x.codice === c);

  /* ---- le persone della struttura (mappa Amway inventata) ---- */
  /* [chiave, nome, sponsor, mesi fa dall'iscrizione, VP personali tipici, con l'app] */
  const albero = [
    ["R", "Stefano e Alessia", null, 190, 320, true],
    ["G", "Giulia Martini", "R", 25, 230, true],
      ["mf", "Marco Ferri", "G", 20, 180, true],
        ["ef", "Elena Ferri", "mf", 18, 110],
          ["dc", "Davide Costa", "ef", 10, 90],
        ["sr", "Simone Riva", "mf", 14, 150, true],
          ["cr", "Chiara Riva", "sr", 9, 120],
          ["nl", "Nadia Leone", "sr", 6, 210],
            ["fl", "Fabio Leone", "nl", 2, 80],
        ["ig", "Irene Galli", "mf", 5, 60],
      ["pg", "Paola Greco", "G", 16, 240, true],
        ["ag", "Andrea Greco", "pg", 15, 130],
        ["tv", "Teresa Villa", "pg", 11, 260, true],
          ["uv", "Ugo Villa", "tv", 8, 100],
          ["bs", "Bruno Sala", "tv", 3, 140],
          ["rs", "Rita Sala", "tv", 0, 70],
        ["gm", "Gianni Monti", "pg", 7, 90],
      ["rf", "Roberto Fontana", "G", 13, 160],
        ["af", "Alice Fontana", "rf", 12, 210],
        ["pm", "Pietro Marini", "rf", 4, 110],
      ["vt", "Valeria Testa", "G", 9, 130],
        ["it", "Ivo Testa", "vt", 2, 60],
      ["mb", "Matteo Bruno", "G", 19, 0],
      ["lp", "Laura Pace", "G", 22, 120],
        ["mp", "Mirko Pace", "lp", 17, 90],
        ["sn", "Silvia Neri", "lp", 6, 150],
      ["S", "Sara Conti", "G", 0, 60, true],
    ["pr", "Paolo Ricci", "R", 30, 320, true],
      ["al", "Anna Lodi", "pr", 21, 520],
      ["cl", "Carlo Lodi", "pr", 15, 410],
        ["om", "Olga Mele", "cl", 8, 300],
    ["fb", "Franca Bellini", "R", 26, 280],
      ["dm", "Dario Moro", "fb", 11, 450],
      ["gv", "Gloria Vitale", "fb", 5, 320]];
  /* le date di iscrizione «del mese»: Rita Sala (dalla mappa) all'inizio del mese, Sara 12 giorni fa */
  const iscritto = { S:gg(12), rs:gg(Math.min(giornoDelMese - 1, 9)) };
  let codice = 7100000;
  const partners = albero.map(([k, nome, sp, mesi, vpTipo, app]) => {
    const p = { id:k === "R" || k === "G" || k === "S" ? k : "p-" + k, nome, sponsor_id:sp ? (["R", "G", "S"].includes(sp) ? sp : "p-" + sp) : null,
      codice_amway:String(++codice), codice_invito:("P" + k.toUpperCase() + "RV00").slice(0, 6), data_iscrizione:iscritto[k] || mesiFa(mesi),
      creato_il:ts(Math.max(30, mesi * 30)), stato:app ? "attivo" : "gestito", gestore_id:app ? null : "R",
      mappa_mese:mese(0) + "-01", posizione_al:ts(2), partenza_confermata_il:ts(Math.max(1, mesi * 30)), _vp:vpTipo, _k:k };
    if(app){ Object.assign(p, { confermato_il:ts(Math.max(1, mesi * 30 - 5)), privacy_accettata_il:ts(Math.max(1, mesi * 30 - 6)),
      partenza_completata_il:ts(Math.max(1, mesi * 30 - 40)), ultimo_aggiornamento:ts(1) }); }
    return p; });
  const P = k => partners.find(p => p._k === k);
  Object.assign(P("R"), { chiave:CHIAVE.R, is_admin:true, codice_amway:"7000001", qualifica_iniziale:"platino", percentuale_iniziale:21, primo_import_il:ts(400) });
  Object.assign(P("G"), { chiave:CHIAVE.G, qualifica_iniziale:"foundation_12", percentuale_iniziale:12, qualifica_iniziale_mese:mese(7) + "-01", invitato_da:"R", invitato_il:ts(760), incontro_sponsor:gg(755), punto_upline_fatto:gg(740), primo_import_il:ts(300) });
  Object.assign(P("mf"), { invitato_da:"G", invitato_il:ts(600), ultimo_aggiornamento:ts(2) });
  Object.assign(P("sr"), { ultimo_aggiornamento:ts(10) });
  Object.assign(P("pg"), { invitato_da:"G", invitato_il:ts(480), ultimo_aggiornamento:ts(1) });
  Object.assign(P("tv"), { ultimo_aggiornamento:ts(19) });
  Object.assign(P("pr"), { ultimo_aggiornamento:ts(3) });
  /* Sara: entrata 12 giorni fa con il link di Giulia, a metà del percorso di partenza */
  Object.assign(P("S"), { chiave:CHIAVE.S, invitato_da:"G", invitato_il:ts(12), privacy_accettata_il:ts(12), confermato_il:ts(10), partenza_completata_il:null,
    partenza_confermata_il:ts(12), incontro_sponsor:gg(10), punto_upline:null, ultimo_aggiornamento:ts(1) });

  /* ---- i numeri delle mappe: 12 mesi (11 chiusi + quello in corso) ---- */
  const figli = id => partners.filter(p => p.sponsor_id === id);
  const percentuale = vpg => [[10000, 21], [7000, 18], [4000, 15], [2400, 12], [1200, 9], [600, 6], [200, 3]].find(([s]) => vpg >= s)?.[1] || 0;
  const numeri = [], storico = [];
  const dentroG = id => { for(let x = partners.find(p => p.id === id); x; x = partners.find(p => p.id === x.sponsor_id)) if(x.id === "G") return true; return false; };
  for(let k = 11; k >= 0; k--){
    const m = mese(k), fine = fineMese(m), quota = k === 0 ? Math.max(0.35, giornoDelMese / giorniMese) : 1;
    const vpp = new Map();
    for(const p of partners){
      if(p.data_iscrizione > fine){ continue; }
      const primo = p.data_iscrizione.slice(0, 7) === m;
      let v = p._vp * (1.15 + caso() * 0.6);
      if(primo) v = Math.max(55, v * 0.8);
      if(p._k === "mb") v = 0;                               // fermo da mesi
      if(caso() < 0.08 && !["R", "G"].includes(p._k)) v = 0;   // un mese senza ordini, ogni tanto
            vpp.set(p.id, Math.round(v * quota * 100) / 100);
    }
    const vpg = new Map();
    const calcola = id => { if(vpg.has(id)) return vpg.get(id); let t = vpp.get(id) || 0;
      for(const f of figli(id)) if(vpp.has(f.id)) t += calcola(f.id); t = Math.round(t * 100) / 100; vpg.set(id, t); return t; };
    calcola("R");
    const al = k === 0 ? ts(2) : new Date(new Date(fine + "T12:00:00").getTime() + 3 * giorno).toISOString();
    for(const p of partners){
      if(!vpp.has(p.id)) continue;
      const g = vpg.get(p.id), linee = figli(p.id).filter(f => vpp.has(f.id)).map(f => ({ codice:f.codice_amway, vpg:vpg.get(f.id) }));
      /* Giulia importa la mappa del suo gruppo; Stefano e Alessia quella di tutti gli altri */
      numeri.push({ visto_da:dentroG(p.id) ? "G" : "R", partner_id:p.id, mese:m, vpp:vpp.get(p.id), vpg:g, percentuale:percentuale(g), linee, nascoste:false, dati_al:al });
      if(k > 0 && (p.id === "R" || p.id === "G")){
        const pc = percentuale(g), att = linee.filter(l => l.vpg >= 100).length;
        storico.push({ partner_id:p.id, mese:m + "-01", vp_personali:vpp.get(p.id), vp_gruppo:g, linee_attive:att, percentuale:pc,
          qualifica:{ 21:"argento", 18:"builder_18", 15:"builder_15", 12:"foundation_12", 9:"foundation_9" }[pc] || (att >= 3 && vpp.get(p.id) >= 100 ? "path_to_bronze" : null) });
      }
    }
  }
  const codiceDi = { S:P("S").codice_amway };
  for(const p of partners){ delete p._vp; delete p._k; }

  /* ---- la Lista e i clienti di Giulia (e qualche nome di Sara) ---- */
  const persone = [], passi = [], activities = [], ordini = [], righe = [], cerchie = [], pc = [];
  const ORD = { contatto:1, invito:2, piano:3, followup:4 };
  const persona = (proprietario, nome, x) => { const p = Object.assign({ id:id("pe"), proprietario, nome, contatto:null, origine:null, fase:"lista", esito:null,
    creato_il:ts(x && x._creato != null ? x._creato : 60), prossima_data:null, prossima_ora:null, prossima_nota:null, prossima_per:null, prossima_come:null,
    note:null, fonte:null }, x); delete p._creato; persone.push(p); return p; };
  const passo = (p, tipo, giorniFa, x) => {
    const r = Object.assign({ id:id("ps"), proprietario:p.proprietario, persona_id:p.id, tipo, data:gg(giorniFa), come:null, reazione:null, esito:null, nota:null,
      creato_il:ts(giorniFa) + Math.random(), attivita_id:null }, x);
    const t = tipo === "contatto" ? "contatto" : tipo === "piano" ? "piano" : tipo === "chiusura" && r.esito === "cliente" ? "cliente" : null;
    if(t){ const a = { id:id("at"), partner_id:p.proprietario, tipo:t, quantita:1, data:r.data, inserito_da:p.proprietario, inserito_il:ts(giorniFa) };
      activities.push(a); r.attivita_id = a.id; }
    passi.push(r); return r; };
  const ricalcola = p => { const ps = passi.filter(x => x.persona_id === p.id);
    p.fase = ["lista", "contattato", "invitato", "piano", "followup"][Math.max(0, ...ps.map(x => ORD[x.tipo] || 0))];
    const c = ps.filter(x => x.tipo === "chiusura" || x.tipo === "riapri").sort((a, b) => a.data < b.data ? 1 : -1)[0];
    p.esito = c && c.tipo === "chiusura" ? c.esito : null; };
  const COME = ["Telefono", "Messaggio", "Di persona"], REAZ = ["Aperto, incuriosito", "Interessato", "Ha fatto domande", "Tiepido"];
  /* un percorso: [tipo, giorni fa] in ordine */
  const percorso = (p, tappe) => { for(const [tipo, d, x] of tappe) passo(p, tipo, d, Object.assign(tipo === "chiusura" || tipo === "nota" ? {}
    : { come:COME[tra(0, 2)], reazione:tipo === "piano" ? "Gli è piaciuto" : REAZ[tra(0, 3)] }, x)); ricalcola(p); return p; };

  const G = "G";
  /* mai contattati (in Lista) */
  [["Ottavio Bianco", "palestra"], ["Rebecca Serra", "colleghi"], ["Pamela Cattaneo", "scuola dei figli"], ["Ernesto Grassi", "vicini"],
   ["Ludovica Fiore", "palestra"], ["Walter Basile", "ex colleghi"]].forEach(([n, o], i) => persona(G, n, { origine:o, contatto:"333 000 00" + (10 + i), _creato:20 + i * 3, fonte:"conoscenza" }));
  /* in corso, con l'agenda */
  percorso(persona(G, "Federica Sartori", { origine:"palestra", contatto:"333 000 0021", _creato:12, prossima_data:gg(0), prossima_ora:"18:30:00", prossima_per:"fissare_piano", prossima_come:"telefono" }),
    [["contatto", 2]]);
  percorso(persona(G, "Massimo Gatti", { origine:"colleghi", contatto:"333 000 0022", _creato:15, prossima_data:gg(-1), prossima_ora:"20:45:00", prossima_per:"piano", prossima_come:"persona" }),
    [["contatto", 9], ["invito", 4]]);
  percorso(persona(G, "Lorenzo Pini", { origine:"amici", contatto:"333 000 0023", _creato:25, prossima_data:gg(-2), prossima_per:"followup", prossima_come:"whatsapp" }),
    [["contatto", 14], ["invito", 8], ["piano", 3]]);
  percorso(persona(G, "Elisa Rinaldi", { origine:"social", contatto:"333 000 0024", _creato:10, fonte:"social" }), [["contatto", 6]]);
  percorso(persona(G, "Tommaso Fabbri", { origine:"cugino di Marco", _creato:40 }), [["contatto", 30], ["invito", 22], ["piano", 15], ["followup", 8]]);
  /* fermi: avviati e senza passi da più di 14 giorni (riga ambra, «Da riprendere») */
  percorso(persona(G, "Cristina Bassani", { origine:"scuola dei figli", contatto:"333 000 0025", _creato:35 }), [["contatto", 24], ["invito", 16]]);
  percorso(persona(G, "Giorgio Valli", { origine:"ex colleghi", _creato:45 }), [["contatto", 33], ["invito", 28], ["piano", 21]]);
  /* chiusi */
  percorso(persona(G, "Serena Colombo", { origine:"palestra", _creato:70, prossima_data:gg(-38), prossima_nota:"da risentire il " + gg(-40).split("-").reverse().join("/") }),
    [["contatto", 50], ["invito", 44], ["piano", 40], ["chiusura", 35, { esito:"non_ora", nota:"ora ha il trasloco" }]]);
  percorso(persona(G, "Nicola Barbieri", { origine:"amici", _creato:80 }), [["contatto", 70], ["invito", 63], ["piano", 60], ["chiusura", 55, { esito:"no" }]]);
  percorso(persona(G, "Michela Orlando", { origine:"social", _creato:90, prossima_data:gg(-150), prossima_per:"contatto" }),
    [["contatto", 75], ["invito", 60], ["chiusura", 30, { esito:"senza_risposta" }]]);
  /* Sara è diventata partner: da qui il suo invito in Growup */
  percorso(persona(G, "Sara Conti", { origine:"palestra", _creato:40 }), [["contatto", 30], ["invito", 26], ["piano", 21], ["followup", 16], ["chiusura", 13, { esito:"partner" }]]);

  /* i clienti, con i loro ordini (lo scaffale: quando finisce un prodotto, l'app ricorda di sentirli) */
  const ordine = (p, giorniFa, prodotti, x) => { const o = Object.assign({ id:id("or"), proprietario:p.proprietario, persona_id:p.id, data:gg(giorniFa), modo:"sito",
      nota:null, consegnato:gg(Math.max(0, giorniFa - 3)), pagato:gg(Math.max(0, giorniFa - 3)), verificato:null, creato_il:ts(giorniFa) + Math.random() }, x);
    ordini.push(o);
    for(const [c, q] of prodotti){ const r = prodotto(c);
      righe.push({ id:id("ri"), proprietario:p.proprietario, ordine_id:o.id, codice:c, nome:r.nome, quantita:q || 1, prezzo:r.prezzo_cliente, prezzo_partner:r.prezzo_partner, vp:r.vp }); }
    return o; };
  const cliente = (nome, x, inizio, ordiniC) => { const p = percorso(persona(G, nome, Object.assign({ _creato:inizio + 5 }, x)),
      [["contatto", inizio], ["chiusura", inizio - 2, { esito:"cliente" }]]);
    for(const [d, prodotti] of ordiniC) ordine(p, d, prodotti); return p; };
  /* l'ultimo ordine di ognuno ha tutti i suoi prodotti: lo scaffale dice quando finiscono (30 giorni, o la durata scritta) */
  const clienti = [
    cliente("Anna Moretti", { contatto:"333 000 0031", compleanno:gg(-3).slice(5) }, 300, [[280, [["910001"]]], [248, [["910001"]]], [57, [["910001"], ["910002"]]], [27, [["910001"], ["910002"]]]]),
    cliente("Beatrice Longo", { contatto:"333 000 0032" }, 200, [[190, [["910008"]]], [80, [["910008"], ["910010"]]], [16, [["910008"], ["910010"]]]]),
    cliente("Carla Ferraro", { contatto:"333 000 0033" }, 150, [[140, [["910005"], ["910007"]]], [84, [["910005"], ["910006"], ["910007"]]], [24, [["910005"], ["910006"], ["910007"]]]]),
    cliente("Daniela Marchetti", { contatto:"333 000 0034" }, 90, [[85, [["910003"]]], [5, [["910003"], ["910014"]]]]),
    cliente("Enrico Gallo", { contatto:"333 000 0035" }, 70, [[64, [["910002"], ["910004"]]], [6, [["910002"], ["910004"]]]]),
    cliente("Francesca Lombardi", { contatto:"333 000 0036", compleanno:gg(-20).slice(5) }, 400, [[390, [["910011"], ["910013"]]], [100, [["910011"], ["910013"]]], [12, [["910011"], ["910013"], ["910012"]]]]),
    cliente("Gabriella Santoro", { contatto:"333 000 0037" }, 60, [[9, [["910008"]]]]),
    cliente("Ilaria Mariani", { contatto:"333 000 0038" }, 250, [[240, [["910001"]]], [180, [["910001"]]]]),
    cliente("Lucia De Luca", { contatto:"333 000 0039" }, 120, [[110, [["910006"]]], [42, [["910006"], ["910007"]]]])];
  /* quanto durano: i prodotti per la casa più di un mese */
  const durate = [["910005", 60], ["910006", 75], ["910007", 45], ["910011", 45], ["910012", 40], ["910013", 50], ["910003", 30], ["910014", 14]]
    .map(([codice, giorni]) => ({ proprietario:G, codice, giorni }));

  /* le cerchie: della Lista e dei Clienti */
  const cerchia = (nome, tipo, chi) => { const c = { id:id("ce"), proprietario:G, nome, tipo, creato_il:ts(60) }; cerchie.push(c);
    for(const n of chi){ const p = persone.find(x => x.proprietario === G && x.nome === n); if(p) pc.push({ persona_id:p.id, cerchia_id:c.id, proprietario:G }); } };
  cerchia("Palestra", "lista", ["Ottavio Bianco", "Ludovica Fiore", "Federica Sartori", "Serena Colombo"]);
  cerchia("Colleghi", "lista", ["Rebecca Serra", "Walter Basile", "Massimo Gatti", "Giorgio Valli"]);
  cerchia("Bellezza", "clienti", ["Beatrice Longo", "Gabriella Santoro"]);
  cerchia("Nutrizione", "clienti", ["Anna Moretti", "Daniela Marchetti", "Enrico Gallo", "Ilaria Mariani"]);

  /* la serie: Giulia è attiva almeno 5 giorni su 7 da 9 settimane (un contatto, un messaggio, un passo) */
  const nomiNuovi = ["Aurora Pellegrino", "Bianca Sorrentino", "Claudio Riccardi", "Dalia Ferrara", "Emma Benedetti", "Flavio Caputo", "Greta Parisi",
    "Hugo Messina", "Ivana Fumagalli", "Jacopo Monti", "Katia Rizzi", "Leo Morelli", "Marta Bellucci", "Nico Silvestri", "Olivia Gentile", "Pio Farina",
    "Quinto Ruggiero", "Rosa Cirillo", "Sergio Donati", "Tina Marino", "Umberto Sala", "Vera Piras", "Zeno Carbone", "Alba Negri", "Bruna Pace",
    "Cesare Vitali", "Delia Russo", "Ennio Fadda", "Fiamma Ricci", "Guido Bonetti", "Ines Caruso", "Lino Zanetti", "Mara Pagano", "Nora Melis",
    "Oscar Fontana", "Pia Bernardi", "Remo Gatti", "Sofia Ventura", "Tullio Marras", "Ugo Leoni"];
  const giaAttivi = new Set(passi.filter(x => x.proprietario === G).map(x => x.data));
  let iNome = 0;
  for(let d = 63; d >= 1; d--){
    const data = gg(d), dow = new Date(data + "T12:00:00").getDay();
    if(giaAttivi.has(data) || dow === 0 || (dow === 3 && d > 30 && caso() < 0.5)) continue;
    const nome = nomiNuovi[iNome++ % nomiNuovi.length];
    const p = persona(G, nome, { _creato:d + 2, origine:["conoscenza", "palestra", "social", "dal vivo"][tra(0, 3)], fonte:["conoscenza", "dal_vivo", "social"][tra(0, 2)] });
    const tappe = [["contatto", d]];
    if(caso() < 0.35 && d > 4) tappe.push(["invito", d - tra(2, 4)]);
    if(tappe.length > 1 && caso() < 0.4 && d > 9) tappe.push(["piano", tappe[1][1] - tra(2, 5)]);
    /* chi è stato contattato da più di due settimane, quasi sempre ha avuto un seguito: chiuso, o un passo recente.
       Ne restano fermi pochi (riga ambra, «Da riprendere»), come succede davvero */
    const ultimo = tappe[tappe.length - 1][1];
    if(ultimo > 14){ const x = caso();
      if(x < 0.5) tappe.push(["chiusura", Math.max(1, ultimo - tra(3, 8)), { esito:caso() < 0.6 ? "no" : "non_ora" }]);
      else if(x < 0.85 && tappe.length < 3) tappe.push([tappe.length === 1 ? "invito" : "piano", tra(1, 10)]); }
    percorso(p, tappe);
    giaAttivi.add(data);
  }
  /* oggi: già un contatto */
  percorso(persona(G, "Vittoria Esposito", { origine:"dal vivo", _creato:0, fonte:"dal_vivo" }), [["contatto", 0]]);

  /* Sara: i suoi primi nomi della Lista e i primi contatti */
  ["Mamma", "Giorgia (vicina)", "Alessio Corsi", "Viola Neri", "Diego Fumagalli", "Teresa Lenzi", "Paolo (calcetto)", "Silvia Moro", "Franco Giusti",
   "Anita Basso", "Rocco Sanna", "Lara Fadda"].forEach((n, i) => { const p = persona("S", n, { _creato:11 - Math.min(i, 9) });
    if(i < 4) percorso(p, [["contatto", 9 - i * 2]]); });

  /* i VP «dopo la mappa»: un ordine di Giulia di ieri (l'app li somma a quelli della mappa) */
  activities.push({ id:id("at"), partner_id:G, tipo:"ordine", vp:38.5, quantita:1, data:gg(1), inserito_da:G, inserito_il:ts(1) });
  activities.push({ id:id("at"), partner_id:"S", tipo:"ordine", vp:62, quantita:1, data:gg(9), inserito_da:"S", inserito_il:ts(9) });
  /* qualche contatto e piano di chi usa l'app nel gruppo (le etichette nella scheda) */
  for(const [pid, n] of [["p-mf", 9], ["p-pg", 12], ["p-sr", 3], ["p-tv", 1], ["p-pr", 7]])
    for(let i = 0; i < n; i++) activities.push({ id:id("at"), partner_id:pid, tipo:i % 4 === 3 ? "piano" : "contatto", quantita:1, data:gg(tra(0, 26)), inserito_da:pid, inserito_il:ts(tra(0, 26)) });

  /* obiettivi: settimana e mese */
  const goals = [], mgoals = [];
  for(let w = 0; w < 12; w++) for(const pid of ["G", "R", "S", "p-mf", "p-pg"]) goals.push({ partner_id:pid, settimana:lunedi(gg(w * 7)), obiettivo_contatti:pid === "S" ? 10 : 12, obiettivo_piani:3 });
  for(const pid of ["G", "R", "S", "p-mf", "p-pg"]) mgoals.push({ partner_id:pid, mese:mese(0) + "-01", obiettivo_vp:pid === "S" ? 100 : pid === "R" ? 300 : 250 });
  const obiettivi = [
    { partner_id:"R", cifra_mese:8000, entro:(oggi.getFullYear() + 2) + "-12-01", perche:"Fare crescere i leader del nostro gruppo" },
    { partner_id:"G", cifra_mese:2500, entro:(oggi.getFullYear() + 1) + "-09-01", perche:"Lasciare il turno di notte e stare con i miei figli" },
    { partner_id:"S", cifra_mese:500, entro:(oggi.getFullYear() + 1) + "-03-01", perche:"Pagarmi il corso di fotografia da sola" },
    { partner_id:"p-mf", cifra_mese:1000, entro:(oggi.getFullYear() + 1) + "-06-01", perche:"Un'entrata in più per la famiglia" },
    { partner_id:"p-pg", cifra_mese:1500, entro:(oggi.getFullYear() + 1) + "-06-01", perche:"Viaggiare di più" },
    { partner_id:"p-pr", cifra_mese:2500, entro:(oggi.getFullYear() + 1) + "-12-01", perche:"Libertà di tempo" }];

  /* la Verifica di Giulia: i numeri scritti a mano, le abitudini, il Seguimi */
  const numeriCl21 = [{ partner_id:G, app_cl21:6, training_day:9, convention:4 }, { partner_id:"R", app_cl21:14, training_day:21, convention:11 }];
  const guidaObiettivi = [{ partner_id:G, chiave:"formazione", a_settimana:5 }, { partner_id:G, chiave:"sponsor", a_settimana:2 }, { partner_id:G, chiave:"followup", a_settimana:4 }];
  const guidaFatti = [];
  for(let d = 20; d >= 1; d--){ const dow = new Date(gg(d) + "T12:00:00").getDay();
    if(dow !== 0 && dow !== 6) guidaFatti.push({ partner_id:G, chiave:"formazione", giorno:gg(d) });
    if(dow === 2 || dow === 5) guidaFatti.push({ partner_id:G, chiave:"sponsor", giorno:gg(d) }); }
  const seguimi = [{ partner_id:G, attivo:true, condividi:true }, { partner_id:"p-mf", attivo:true, condividi:true }, { partner_id:"S", attivo:true, condividi:true }];

  /* il Target di Giulia: le otto domande (risposte: l'indice della risposta scelta, da 0) */
  const inviti = [
    { id:"PR0VA1", proprietario:G, nome:"Carla Nuova", bloccato:false, risposte:[0, 0, 1, 0, 0, 0, 0, 0], versione:"2026-09-14", risposto_il:ts(3),
      persona_id:null, archiviato:false, creato_il:ts(6), scade:gg(-8) },
    { id:"PR0VA2", proprietario:G, nome:"Dario Conosciuto", bloccato:false, risposte:null, risposto_il:null, persona_id:null, archiviato:false, creato_il:ts(1), scade:gg(-13) },
    { id:"PR0VA3", proprietario:G, nome:"Mirta Dubbiosa", bloccato:false, risposte:[1, 2, 0, 2, 1, 2, 1, 2], versione:"2026-09-14", risposto_il:ts(9),
      persona_id:null, archiviato:false, creato_il:ts(12), scade:gg(2) }];

  /* gli inviti personali in Growup: quello di Luca (aperto) e quello di Sara (usato) */
  const invitiP = [
    { id:"inv-luca", codice:INVITO_LUCA, creato_da:G, nome:"Luca Bassi", codice_amway:CODICE_LUCA, creato_il:ts(1), scade_il:new Date(adesso + 6 * giorno).toISOString(),
      annullato_il:null, usato_il:null, usato_da:null },
    { id:"inv-sara", codice:"8e".repeat(16), creato_da:G, nome:"Sara Conti", codice_amway:codiceDi.S, creato_il:ts(13), scade_il:ts(6),
      annullato_il:null, usato_il:ts(12), usato_da:"S" }];

  /* i 29 nomi che Luca trova nella Lista appena entrato (li scrive avvio-prova.js all'ingresso, con la data di quel momento):
     [nome, come lo conosci (fonte), dove (origine), telefono] */
  const nomiLuca = [
    ["Marco Sartori", "conoscenza", "amico d'infanzia", "333 100 0001"], ["Elena Bassi", "conoscenza", "cugina", "333 100 0002"],
    ["Davide Ricci", "conoscenza", "calcetto del giovedì", "333 100 0003"], ["Chiara Lupi", "conoscenza", "ex collega", "333 100 0004"],
    ["Federico Gallo", "conoscenza", "vicino di casa", null], ["Silvia Mancini", "dal_vivo", "corso di yoga", "333 100 0006"],
    ["Giorgio Neri", "conoscenza", "zio", "333 100 0007"], ["Martina Costa", "social", "gruppo di cucina su Facebook", null],
    ["Andrea Fontana", "conoscenza", "compagno di università", "333 100 0009"], ["Valentina Rossi", "dal_vivo", "palestra", "333 100 0010"],
    ["Stefano Greco", "conoscenza", "collega di lavoro", "333 100 0011"], ["Paola Marchi", "conoscenza", "mamma di un compagno di scuola", "333 100 0012"],
    ["Lorenzo Villa", "social", "Instagram", null], ["Giada Ferri", "dal_vivo", "festa di un amico", "333 100 0014"],
    ["Matteo Conti", "conoscenza", "amico del calcetto", "333 100 0015"], ["Sofia Moretti", "conoscenza", "cugina", "333 100 0016"],
    ["Riccardo Bianchi", "dal_vivo", "barbiere", "333 100 0017"], ["Alessandra Pini", "conoscenza", "ex compagna di classe", "333 100 0018"],
    ["Nicolò Ferrari", "conoscenza", "collega di lavoro", "333 100 0019"], ["Irene Marino", "social", "gruppo del quartiere su WhatsApp", "333 100 0020"],
    ["Tommaso Galli", "conoscenza", "amico di famiglia", "333 100 0021"], ["Beatrice Leone", "dal_vivo", "corso di inglese", null],
    ["Simone De Luca", "conoscenza", "cognato", "333 100 0023"], ["Camilla Testa", "conoscenza", "vicina di casa", "333 100 0024"],
    ["Pietro Barbieri", "dal_vivo", "papà al parco giochi", "333 100 0025"], ["Laura Sala", "social", "LinkedIn", null],
    ["Fabio Rinaldi", "conoscenza", "allenatore di calcetto", "333 100 0027"], ["Monica Fabbri", "conoscenza", "collega della moglie", "333 100 0028"],
    ["Gabriele Monti", "dal_vivo", "fiera del paese", "333 100 0029"]];

  return {
    /* Giulia qui è nell'app da tempo (dueMesi) */
    _prova:{ versione:window.GROWUP_PROVA_VERSIONE, creata_il:new Date().toISOString(), chiavi:CHIAVE, invitoLuca:INVITO_LUCA, codiceLuca:CODICE_LUCA, nomiLuca, invitoGiulia:null, dueMesi:true },
    partners, stages, settings, listino, numeri, storico, persone, passi, activities, ordini, righe, cerchie, pc, goals, mgoals, obiettivi,
    numeriCl21, guidaObiettivi, guidaFatti, seguimi, seguimiGiorni:[], inviti, invitiP, preferiti:[{ partner_id:"R", preferito_id:"G" }, { partner_id:"G", preferito_id:"p-pg" }],
    accessi:[], aggiunti:[], anon:0, joins:[], nascosti:[], esclusi:[], ordiniMiei:[], righeMie:[], partenzaTolti:[], telefoni:[], previste:[],
    codiciTolti:[], accessiTolti:[], scadenze:[], conPercorso:true, durate };
};
