# Growup Team — a che punto siamo

Ultimo aggiornamento: 16 ottobre 2026. Da leggere all'inizio di ogni nuova sessione con Claude Code.

## Fatto

**Fase 1 pubblicata** su https://cl21-aes.github.io/growup-team/ (PR CL21-AeS/CL21-AeS.github.io#1, unita a `main`).

- **Database**: progetto Supabase **Growup-Team** (`mxpuvmggexjyieylmfss`), organizzazione "CL21-AeS's Org",
  regione Central EU (Francoforte). Installati schema, RLS, 8 tappe e impostazioni; i controlli dei permessi
  (`supabase/tests_rls.sql`) sono passati sul progetto.
- **Profilo radice**: un solo profilo **"Stefano e Alessia"** (admin), codice d'invito **ABCDEF**.
  Il link personale è stato salvato da Stefano su WhatsApp (non è in nessun file: nel database c'è solo l'impronta).
- **Accesso anonimo** attivo in Supabase (Authentication → Sign In / Providers).
- `config.js` contiene URL e chiave publishable del progetto.
- Claude ha accesso al progetto tramite il connettore Supabase (MCP). Nota: le istruzioni SQL che contengono
  `delete` richiedono una conferma che dal connettore scade; quelle parti si lanciano dall'SQL Editor.

**Ritocchi dopo il primo collaudo (15 ottobre)**, migrazione `supabase/004_ritocchi.sql` già applicata al progetto:

- marchio **A&S** al posto di CumLaude21; "Due informazioni e iniziamo", pulsante "Inizia";
- tolte le opzioni prima/dopo il 1° giugno 2026: la data di iscrizione è obbligatoria solo per chi sceglie "Inizio";
  il Path to Bronze conta tutte le prime linee (vincolo di data tolto dal database);
- "Qualifica più alta raggiunta": Inizio, pin 3%…21% (campo `percentuale_iniziale`) e qualifiche Bronze/Argento;
  primo ordine e primi clienti non si dichiarano. Un pin senza Bronze fa partire dal Path to Bronze;
- "Entra con il tuo link personale" ora ha il ritorno all'invito;
- **La mia struttura**: albero della downline, **+ Aggiungi persona** (chi non usa l'app, posizione a scelta nella
  propria struttura, conferma del consenso) e **Manda il link** per farle prendere possesso del profilo
  (al primo ingresso accetta la privacy);
- l'iscrizione ora è la funzione `iscrivi_con_codice`; la vecchia `join_with_code` non è più richiamabile
  (si può eliminare dall'SQL Editor, vedi 004).
- Profili di prova nel database: "Prova uno" e "Prova due" (da cancellare a collaudo finito).

**Seconda tornata di ritocchi (15 ottobre)**, solo interfaccia:

- due pagine con selettore **Io / Gruppo** in alto a destra: "Io" = percorso, settimana, mese, oggi;
  "Gruppo" = La mia struttura + Invita un nuovo partner. Il menu ⋯ è sparito: link personale, privacy ed Esci
  stanno in fondo a ogni pagina;
- "Ancora nessuno nel tuo gruppo"; niente più "sotto di te": nell'aggiunta manuale si sceglie "Chi è il suo sponsor?";
- "Il mio mese": pulsanti **+ Ordine** e **Aggiorna il totale** (si scrive il totale VP del mese, per esempio
  dall'ufficio virtuale Amway; l'app registra la differenza come attività `rettifica`, anche negativa).
  Migrazione `supabase/005_totale_mese.sql` già applicata. In Fase 2 lo sponsor userà lo stesso meccanismo
  per i VP di chi non usa l'app.

**Fase 2 — piano approvato** (vedi `FASE2.md`). Profili di prova cancellati il 15 ottobre: nel database
c'è solo "Stefano e Alessia", senza attività.

**Fase 2, blocco 1 — calcoli e pagina Io** (migrazioni `006_fase2_calcoli.sql` e `006b_chiusura_pianificata.sql`
già applicate; attività pianificata `growup-chiusura-mese` attiva):

- soglie delle percentuali in `percent_levels` (3% = 200 … 21% = 10.000);
- `riepilogo_mese(mese)`: VP personali e di gruppo, linee attive, percentuale e qualifica di me e della mia downline;
- storico in `monthly_totals`, congelato da `chiudi_mese` il giorno 5 alle 23:30 UTC;
- il database accetta registrazioni solo nel mese in corso e, fino al giorno 5, nel precedente (`mese_chiuso`);
- pagina Io: requisiti veri di linee e VP di gruppo, "X% questo mese" separato dalla qualifica
  ("9% raggiunto · Bronze Foundation 9% non qualificato: …"), linee frontali con i loro VP,
  "Linee attive: 2 su 3. Manca 1 linea…" (era "Costruisci la terza linea", tolto il 16 ottobre), pagamenti Foundation/Builder contati dallo storico, Storico,
  "Aggiorna il totale" anche per il mese precedente fino al giorno 5.

**Fase 2, blocco 2 — struttura, partner senza app, conferme** (migrazione `007_fase2_gestiti.sql` già applicata):

- struttura: accanto a ogni nome VP del mese, VP di gruppo, linee attive e stato (attivo ≤ 7 giorni,
  rallenta ≤ 14, fermo oltre; "senza app" per i gestiti); "!" per i punti di partenza da confermare;
- scheda partner (si apre toccando un nome): numeri, linee frontali, punto di partenza;
  per chi è senza app + Contatto, + Piano, + Ordine, Aggiorna il totale, + Cliente, con "inserito da";
  per chi usa l'app, solo agli admin, "Nuovo link personale" (`nuova_chiave_per`);
- `posso_gestire`: su un partner gestito scrivono chi l'ha aggiunto e tutta la sua upline;
- riquadro "Da confermare" nella pagina Gruppo: il punto di partenza dichiarato si conferma o si corregge
  (`conferma_partenza`, da sponsor o upline; colonne `partenza_confermata_il/_da`).

**Inserisci in mezzo** (migrazione `008_inserisci_in_mezzo.sql` già applicata): nella scheda partner
"Manca qualcuno sopra?" crea una persona senza app tra lo sponsor attuale e il partner (più eventuali "fratelli"
spuntati), che si spostano sotto di lei con tutto il loro gruppo. Lo fa chi sta sopra quel punto della linea.

**Cancellare e spostare** (`009_cancella_e_sposta.sql`: `cambia_sponsor` già applicata; `cancella_partner` da lanciare
dall'SQL Editor perché contiene un `delete`):

- "Cancella dalla struttura" nella scheda (sponsor e upline): per i codici che Amway non rinnova; chi stava nel gruppo
  della persona sale al suo sponsor; i dati della persona vengono cancellati con lei;
- "Cambia sponsor" nella scheda, solo admin: sposta una persona con tutto il suo gruppo (niente giri);
- "Manca qualcuno sopra?" più chiaro: la persona e il suo gruppo passano da soli; i "fratelli" si spuntano solo se serve.

**Fase 2, blocco 3 — imbuto ed elenco per urgenza** (migrazione `010_etichette.sql` già applicata), pagina Gruppo:

- **Imbuto del gruppo** (te escluso, ultime 4 settimane): contatti → piani → ordini, con obiettivo contatti del gruppo,
  % dei contatti che diventano piani, % dei piani che diventano ordini, VP. Il primo
  passaggio sotto soglia, evidenziato in giallo con il dato e la soglia (es. "Contatti: 75 su 240 di obiettivo del gruppo (31%), sotto la soglia
  del 50%"); dal 16 ottobre senza frasi su cosa allenare;
- **Situazione per persona** (era "Chi seguire adesso"): chi usa l'app, ordinato per urgenza, con un'etichetta e il perché
  (PR CL21-AeS/CL21-AeS.github.io#9 unita; poi il ritocco sotto):
  1. *Non aggiorna*: nessun aggiornamento da più di 7 giorni;
  2. *Contatti sotto soglia*: in 4 settimane meno della metà dei contatti dell'obiettivo;
  3. *Piani sotto soglia*: meno di 1 piano ogni 5 contatti;
  4. *VP sotto soglia*: almeno 2 piani ma meno della metà dei VP dell'obiettivo del mese;
  5. *In crescita*: tutto il resto.
  Le soglie si cambiano dal Table editor: `settings` → `soglie_etichette`. Toccando un nome si apre la scheda.
- **Ritocco della sera del 15 ottobre** (decisione di Stefano): chi è **senza app non ha etichetta** (i suoi numeri
  dipendono da quando lo sponsor li inserisce, quindi non sarebbe reale); sotto l'elenco una riga dice quante persone
  senza app ci sono. Restano nella struttura e i loro numeri contano nell'imbuto.
  Confermati: soglia dei piani 1 piano ogni 5 contatti (giusta per chi fa contatti a freddo), soglia misurata sui VP.
- **16 ottobre**: tolti i suggerimenti (vedi il principio); le etichette sono diventate descrizioni del dato
  (Non aggiorna, Contatti / Piani / VP sotto soglia, In crescita), "collo di bottiglia" è diventato "sotto soglia"
  e il riquadro "Chi seguire adesso" si chiama "Situazione per persona".
- I **test** ora stanno nel repository: `test/` (vedi `test/LEGGIMI.md`): 97 controlli dell'interfaccia
  e i controlli dei permessi del database.

## Decisioni prese con Stefano

- **Principio (16 ottobre 2026): l'app non dà suggerimenti.** Rende evidenti i dati, il percorso e le eventuali
  mancanze di quello che viene fatto; come muoversi lo decide ogni partner, da solo. Niente frasi del tipo "allenate…",
  "costruisci…", "lavorate su…", niente azioni suggerite: solo numeri, soglie e cosa manca.

- **Niente email**: si entra dal link d'invito dello sponsor (`#CODICE`) e poi dal link personale (`#chiave=…`),
  che il partner si manda da solo su WhatsApp (chat con sé stesso) o Telegram (Messaggi salvati).
  Scelta confermata: niente custodia delle chiavi da parte dello sponsor (rispetta "nessuno modifica un partner attivo").
- **Stefano e Alessia**: un solo profilo e un solo codice per tutti e due.
- **Primi clienti**: valgono i primi 3 in totale, non nello stesso mese. Dopo, solo il conteggio dei nuovi clienti
  del mese, senza obiettivo.
- **Obiettivi**: contatti (10) e piani (3) a settimana; VP solo al mese (100, o di più se la tappa lo chiede).
- **Rimandati alla Fase 2**: inserire i numeri per conto di chi è aggiunto a mano; mostrare numeri (es. VP del mese)
  accanto ai nomi nella struttura.

## Prossimi passi (da qui si riparte)

1. **Pubblicare il confronto col mese prima nella scheda partner** (16 ottobre; "niente suggerimenti" ed
   "etichette come dati" già uniti con le PR #11 e #12) se non è ancora fatto: ramo `claude/fervent-pasteur-kil5mf`,
   PR da unire (controllare su GitHub se è aperta o unita). Nessuna migrazione da lanciare.
   ("Senza app senza etichetta" è già pubblicato: PR CL21-AeS/CL21-AeS.github.io#10 unita.)
2. **Collaudo dal telefono dei blocchi 1-3** della Fase 2 (pagina Io con i calcoli, struttura con i numeri,
   scheda partner, partner senza app, Da confermare, in mezzo / cancella / cambia sponsor, imbuto ed etichette) e del nuovo confronto col mese prima.
3. **Blocco 4 della Fase 2** (ultimo, vedi `FASE2.md`):
   - (FATTO il 16 ottobre, da pubblicare/collaudare) scheda partner: riquadro **"Questo mese e il mese prima"**,
     confronto con i **suoi numeri del mese prima** (non con la media del gruppo: scelta di Stefano), fino a oggi /
     mese prima allo stesso giorno / mese prima totale; ▼ in rosso dove è sotto; niente azioni suggerite;
   - "Fissa una chiamata": evento di calendario (.ics) con promemoria e note **e** messaggio WhatsApp già scritto;
   - storico del gruppo (mesi chiusi da `monthly_totals`).
4. **Prima del lancio a tutto il gruppo**: captcha (Cloudflare Turnstile) sugli accessi anonimi e limite
   "anonymous sign-ins" più alto in Authentication → Rate Limits.
5. Dopo la Fase 2: Fase 3 (presa in carico dopo 14 giorni, avvisi) e Fase 4 (diagnosi, serie di settimane, 90 giorni).

## Proposte in sospeso (Stefano non ha ancora risposto)

- Schermata **"Rinnovi"** per fine anno: elenco di chi non ha rinnovato il codice Amway da cancellare in blocco.
- Captcha prima del lancio (punto 4 sopra).

## Domande aperte

- (Risolta: il link personale perso lo rigenerano solo Stefano e Alessia.)
- PIN di 4 cifre in più sul link personale? (Proposta: per ora no.)
