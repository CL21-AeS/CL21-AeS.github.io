# Growup Team — a che punto siamo

Ultimo aggiornamento: 16 ottobre 2026. Da leggere all'inizio di ogni nuova sessione con Claude Code.
Il metodo e la tecnica usati (da riusare per altre app) sono in `METODO.md`.

## Fatto

**Fase 1 pubblicata** su https://cl21-aes.github.io/growup-team/ (PR CL21-AeS/CL21-AeS.github.io#1, unita a `main`).

- **Database**: progetto Supabase **Growup-Team** (`mxpuvmggexjyieylmfss`), organizzazione "CL21-AeS's Org",
  regione Central EU (Francoforte). Installati schema, RLS, 8 tappe e impostazioni; i controlli dei permessi
  (`supabase/tests_rls.sql`) sono passati sul progetto.
- **Profilo radice**: un solo profilo **"Stefano e Alessia"** (admin). Il codice d'invito non si scrive qui: il repository è pubblico.
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

1. **Copia di sicurezza e skill pubblicate** (PR #36 unita il 17 ottobre). Da fare per Stefano: **prima copia** dei
   dati dall'app e **installare la skill** `metodo-app-stefano` nell'account claude.ai.
   **Import dei VPP: PR #37 unita.** **Rete dal report Amway** (struttura flessibile, vedi la sezione qui sotto):
   PR da unire + migrazione 016 da incollare nell'SQL Editor; poi primo import con il CSV vero.
   Verifica con l'upline: ok per Stefano (l'import mostra gli stessi dati che ognuno vede già sul sito).
2. **Collaudo dal telefono della Fase 2** (pagina Io con i calcoli, struttura con i numeri,
   scheda partner, partner senza app, Da confermare, in mezzo / cancella / cambia sponsor, imbuto ed etichette),
   del confronto col mese prima, di "Fissa una chiamata" e dello storico del gruppo
   (provare il file .ics sia su iPhone sia su Android). **Sull'iPhone di Alessia, dall'icona sulla Home**:
   Fissa una chiamata → Calendario, e tutto il percorso d'installazione (copia link → Aggiungi alla Home →
   Incolla il link personale). Stefano usa Android + Google Calendar; Alessia iPhone.
3. **Blocco 4 della Fase 2** (ultimo, vedi `FASE2.md`):
   - (FATTO il 16 ottobre, da pubblicare/collaudare) scheda partner: riquadro **"Questo mese e il mese prima"**,
     confronto con i **suoi numeri del mese prima** (non con la media del gruppo: scelta di Stefano), fino a oggi /
     mese prima allo stesso giorno / mese prima totale; ▼ in rosso dove è sotto; niente azioni suggerite;
   - (FATTO il 16 ottobre, da pubblicare/collaudare) **"Fissa una chiamata"** nella scheda partner: giorno, ora
     (proposta domani alle 21), durata, promemoria, note → **Calendario** scarica un file .ics da aprire e aggiungere;
     **WhatsApp** apre un messaggio neutro già scritto ("Ciao Marco, ci sentiamo sabato 17 ottobre alle 21:00?")
     e si sceglie a chi mandarlo (l'app non conserva numeri di telefono né le chiamate fissate);
     **Ritocco del 16 ottobre** (Stefano: il file .ics chiedeva ogni volta di essere riscaricato):
     su **Android** "Calendario" apre **Google Calendar** (pagina web) con la chiamata già compilata: si tocca Salva.
     (Collaudo di Stefano: Chrome non permette a una pagina web di aprire la scelta dell'app di calendario;
     l'intent provato con la PR #16 finiva comunque su Google Calendar, ora ci si va direttamente.)
     Il promemoria è quello predefinito di Google Calendar; per altri calendari c'è "Scarica il file"
     (nome del file sempre diverso, così Chrome non chiede di riscaricarlo). Su **iPhone** il file si apre direttamente
     ("Aggiungi al calendario") senza scaricarlo. Sul computer resta il download. Da provare sui telefoni veri;
   - (FATTO il 16 ottobre, da pubblicare/collaudare) **Storico del gruppo** (scelta C): riquadro nella pagina Gruppo
     con gli ultimi 12 mesi chiusi e i propri totali (VP di gruppo, linee, %); toccando un mese si apre il dettaglio
     di ogni persona (VP personali, VP di gruppo, linee, %, qualifica) con ▼ in rosso dove è sotto il mese prima.
     Usa `riepilogo_mese`, nessuna migrazione. Il primo mese chiuso sarà ottobre, il 5 novembre.
   **Con questo la Fase 2 è completa**: resta il collaudo.
- **Cambia sponsor anche verso il proprio gruppo** (16 ottobre, migrazione `011_cambia_sponsor_nel_gruppo.sql`
  già applicata al progetto; solo admin): se il nuovo sponsor scelto sta nel gruppo della persona (errore di
  inserimento, es. Marco risulta sopra Luca ma è Luca lo sponsor di Marco), quella persona con il suo gruppo sale
  al posto di Marco sotto il suo sponsor, poi Marco passa sotto di lei. Nell'elenco è segnata "(nel suo gruppo)".
- **Nuova grafica: stile H · Smeraldo e rame** (16 ottobre, scelto da Stefano tra 10 proposte): testata smeraldo,
  accenti rame e ambra, fondo avorio, titoli e numeri in Cormorant Garamond, tema scuro verde bosco; pulsanti
  + Contatto / + Piano / + Ordine in smeraldo, rame e verde. Dettagli e **alternative tenute per il futuro
  (B + D, E)** in `design/GRAFICA.md`; tavola con tutte le prove in `design/tavola-grafica.html`.
  **Icona nuova: G Smeraldo** (G avorio con la stanghetta che diventa una freccia ambra che sale), `icon.svg`
  e PNG per Android, iPhone e browser. Per vederla sul telefono va reinstallata l'app.
- **Livelli nella struttura** (17 ottobre, richiesta di Stefano: con tante persone non si capiva chi è sotto chi):
  come nei report Amway, accanto al nome un cerchio con il **livello** (1 = diretti, 2 = i loro, …, colore diverso
  per livello), sotto il nome **"sponsor Nome"**, rientro più piccolo; pulsante **▾ N / ▸ N** per richiudere
  o riaprire il gruppo di una persona (N = quante persone ha nel gruppo).
- **Ricerca nella struttura** (17 ottobre): casella "Cerca un nome nel tuo gruppo…" sopra la struttura; filtra mentre
  si scrive (senza badare agli accenti), mostra le persone trovate in rame con la loro linea fino a te, trova anche
  dentro i gruppi richiusi; svuotandola torna tutto com'era. Durante la ricerca **▸ N** sulla persona trovata (o su
  chiunque della sua linea) apre i suoi frontali, e ognuno ha la sua freccia per scendere di un livello alla volta;
  ▾ N richiude.
- **Preferiti al posto dell'imbuto** (17 ottobre, decisione di Stefano: l'imbuto sommava gli obiettivi di tutta la rete,
  ma solo pochi lavorano attivamente, quindi non sarebbe mai stato realistico). Nella scheda partner la stella **☆/★**
  segna una persona come preferita (tabella `preferiti`, migrazione `012_preferiti.sql` già applicata; RLS: solo
  persone del proprio gruppo, ognuno vede solo i suoi). Nella pagina Gruppo la sezione **Preferiti** mostra per ognuno
  contatti e piani delle ultime 4 settimane rispetto al suo obiettivo × 4 e i VP del mese rispetto al suo obiettivo,
  con evidenziata la parte sotto soglia (stessa regola delle etichette; niente etichetta per chi è senza app).
  **"Situazione per persona" tolta** (17 ottobre, decisione di Stefano): si sovrapponeva ai preferiti e con un gruppo
  grande sarebbe diventata una lista lunghissima; chi è fermo si vede già nella struttura ("fermo").
- **Il primo obiettivo, terza pagina** (17 ottobre; migrazione `013_obiettivo.sql` già applicata). Decisioni di Stefano:
  cifra **al mese**; sponsor e upline vedono **cifra, data e tappa, non il perché**; "primi passi" = il percorso come dati;
  terza pagina. Selettore **Obiettivo | Io | Gruppo** (ordine voluto da Stefano) (a tutta larghezza sotto il titolo; il dito passa per le tre pagine).
  - Primo ingresso (dopo l'iscrizione, o dopo la privacy per chi è stato aggiunto): "Il tuo primo obiettivo" — quanto
    al mese, entro quando (mese), perché ("lo vedi solo tu"); "Lo scrivo dopo" per saltare.
  - Pagina Obiettivo: cifra, data, mesi che restano, perché, Modifica; **la tappa che vale la cifra** (prima tappa dal
    Path to Bronze in su con guadagno_mese ≥ cifra; oltre Argento → Argento "e oltre"); **il percorso** dalle tappe fatte
    (✓) alla tappa attuale (con i requisiti veri) fino a quella dell'obiettivo; in fondo la visione Argento.
  - Su Io il riquadro "Il mio obiettivo" sostituisce "La visione"; nella scheda partner e nei Preferiti la riga
    "Obiettivo: 360 €/mese entro giugno 2027 · tappa" (funzione `obiettivi_gruppo()`, senza il perché).
- **Struttura come nei report Amway** (17 ottobre): in cima chi usa l'app (livello **1**, con i suoi numeri e ▾ per
  richiudere tutto), i frontali sono **2**, i loro **3**, e così via; anche negli elenchi a scelta i frontali sono 2.
  Tolta la dicitura "sponsor …" dalle righe della struttura e "Sponsor: …" dalla scheda partner (resta negli elenchi a scelta).
- **Copia di sicurezza** (17 ottobre; migrazione `014_copia_dati.sql` già applicata): funzione `copia_dati()` solo per
  admin, pulsante **Scarica la copia dei dati** in fondo alle pagine (solo admin), file `growup-copia-AAAA-MM-GG.json`
  da tenere su Google Drive; procedura mensile e ripristino in `LEGGIMI.md`.
- **Campi numerici** (17 ottobre): si aprono vuoti con lo 0 grigio (o il valore attuale in grigio, es. obiettivi e
  totale del mese); se non si scrive niente vale quello grigio; dopo un errore il campo torna vuoto.
- **Trascinare il dito** (17 ottobre): verso sinistra da Io a Gruppo, verso destra da Gruppo a Io (e da una scheda
  al gruppo), con un breve scorrimento; non scatta nei campi, nei fogli aperti né nei movimenti verticali.
- **Elenchi a scelta dello sponsor** (Aggiungi persona, Cambia sponsor; 17 ottobre): al posto dei trattini il livello
  e, dal 2 in giù, lo sponsor: "3 · Marcella Peyron (sponsor Elisa)".
1. **Pubblicare i livelli nella struttura** (invito nuovo già unito con la PR #22), approvato da Stefano): anteprima del link su WhatsApp/Telegram (`anteprima.png` + meta
  og: in `index.html`, frase "La tua crescita, settimana dopo settimana."); testo d'invito con il nome di chi invita
  ("Siamo Stefano e Alessia: ti mandiamo…" / "Sono Marco: ti mando…") e i tre passi (entra, salva il link personale,
  installa l'app); nel riquadro "Invita un nuovo partner" i pulsanti **Immagine** (`invito-quadrato.png`) e
  **Per lo stato** (`invito-stato.png`) che aprono la condivisione del telefono. WhatsApp può tenere in memoria la
  vecchia anteprima di un link per qualche giorno.
- **Installare l'app** (16 ottobre, da collaudare soprattutto sull'iPhone di Alessia):
  - pagina Io, dopo "Salva il tuo link personale": riquadro **"Installa Growup sul telefono"**. Android: pulsante
    **Installa** (proposta di Chrome) o istruzioni dal menu ⋮; iPhone: **Copia il mio link** → Condividi →
    Aggiungi alla schermata Home → apri dall'icona e **Incolla il link personale**. "Non ora" lo nasconde;
    in fondo alla pagina resta "Installa l'app". Non compare se l'app è già installata o sul computer;
  - schermata d'ingresso: pulsante **Incolla il link personale** (legge il link copiato); nell'app installata
    spiega che la prima volta serve il link. Perché: su iPhone l'app sulla Home ha una memoria separata da Safari.
  - Ordine giusto per un nuovo partner su iPhone: prima entra dal link d'invito, poi installa.
4. **Prima del lancio a tutto il gruppo**: captcha (Cloudflare Turnstile) nell'app e acceso in Supabase, limite
   "anonymous sign-ins" a 30/ora, provider Email spento (fatto, 17 ottobre). Restano: prova su iPhone con Alessia,
   copia di sicurezza, gruppo pilota di 2-3 leader, messaggio per il gruppo.
5. Dopo la Fase 2: Fase 3 (presa in carico dopo 14 giorni, avvisi) e Fase 4 (diagnosi, serie di settimane, 90 giorni).

## La rete dal report Amway (17 ottobre: import dei VPP con la PR #37; struttura flessibile in questa PR)

Decisioni di Stefano:
- **Niente più inserimenti a mano**: tolti "+ Aggiungi persona", "Manca qualcuno sopra?", "Cambia sponsor" e
  "Manda il suo link personale". La rete rispecchia sempre quella di Amway.
- **Codice Amway obbligatorio** all'ingresso dal link d'invito. Codice già importato da qualcuno sopra → si entra nel
  proprio profilo (posizione e VPP); codice importato in un'altra linea → "chiedi il link al tuo sponsor"; codice di chi
  usa già l'app → "entra con il tuo link personale".
- **Chi usa l'app lo vede tutta la sua upline; le persone importate le vede solo chi le importa.** Così ognuno decide
  se importare tutta la rete (anche chi fa 0) o solo gli attivi.
- Chi usa l'app sta sempre sotto qualcuno che usa l'app: a ogni import va sotto il suo sponsor del report (o il primo
  antenato che usa l'app). Esempio di Stefano: chi è sponsorizzato da lui ma collegato in profondità entra con il suo
  link (sotto di lui) e al primo import va sotto lo sponsor vero.
- **VP di gruppo, linee, percentuale per chi guarda** (chi usa l'app + le proprie importate); storico congelato per chi
  guarda (`monthly_totals.visto_da`).
- Import: chi non è nell'app compare **non spuntato** (pulsanti Spunta chi ha VPP / tutti / Togli tutti, ricerca); chi
  resta senza spunta è **escluso** e non si ripropone ("Escluse · Rivedi"); agli import successivi solo i nuovi.
- **Nascondi dalla mia struttura** (chi usa l'app): solo per me, con il suo gruppo; **i VP contano lo stesso**.
- **Cancella dalla struttura** resta: le mie importate (cancellate ed escluse, anche "non fa più niente e non la voglio
  vedere"); chi usa l'app (per tutti, codici non rinnovati).
- Gli admin vedono come tutti (le importate degli altri solo nella copia di sicurezza).

Com'è fatto: migrazione `016_rete_da_amway.sql` (`vedo()`, `posso_gestire` = importate da me, `entra_con_invito`,
`diventa_attivo`, `importa_rete`, `calcola_mese(mese, radice, chi_guarda)`, tabelle `esclusi_import` e `nascosti`,
funzioni degli inserimenti a mano chiuse). **Da incollare nell'SQL Editor** (il connettore chiede una conferma che
scade, perché le funzioni contengono cancellazioni): subito prima o subito dopo l'unione della PR.
Formato del CSV Amway: UTF-8 con BOM, virgole; riga 1 avviso di riservatezza; riga 2 `"Mese di competenza","AAAAMM"`;
riga 3 le intestazioni; colonne usate "Qualifica Amway Partner" (= livello), "Codice Amway Partner Sponsor",
"Codice Amway Partner", "Nome", "VPP"; numeri "9.500,00" o "20996.38" con l'apostrofo davanti.

## Platino, inviti degli admin e numeri ufficiali (17 ottobre, dopo il primo import vero)

Decisioni di Stefano:
- **Gruppi dei Platino**: il report Amway non mostra chi sta sotto un Platino (per esempio una Platino del gruppo). Solo gli admin
  hanno nella scheda **Invita sotto questa persona** (link d'invito di quella persona, anche se importata) e
  **Invita chi manca sopra** (link speciale monouso: chi entra va tra lo sponsor e la persona, che passa sotto di lui).
- **Numeri ufficiali dal report per tutti gli importati** (e per sé): VPP, VPG, percentuale e i VPG delle linee frontali;
  pagina Io, struttura, scheda e storico usano questi; **la qualifica si calcola sulla struttura del report**.
  Prima un Platino aveva VPG 0 nell'app perché il suo gruppo non è nel report: ora mostra il VPG e la percentuale ufficiali.
- **Codice Amway**: nessuno lo modifica (viene dal report o dall'ingresso); solo gli admin lo **correggono** dalla scheda
  (errore di battitura all'ingresso); l'import lo segnala ("chiedi a Stefano e Alessia di correggerlo").
- Tolti dall'import gli abbinamenti per nome (servivano solo per le persone inserite a mano, cancellate da Stefano).
- Il pulsante di scelta rapida usato resta acceso (PR #39); ricerca per nome o codice anche tra le escluse (PR #40).
- **`ADMIN.md`**: elenco di tutto quello che può fare un admin e come si nomina un nuovo admin.

Com'è fatto: migrazione `017_inviti_e_numeri_report.sql` (tabelle `inviti_admin` e `numeri_report`, `struttura_visibile()`
"ricucita", `calcola_mese` sulla struttura ricucita, `qualifica_report`, `riepilogo_mese` con i numeri del report,
`crea_invito_sopra`, `imposta_codice_amway` solo admin). **Da incollare nell'SQL Editor** insieme all'unione della PR.

## Sicurezza (17 ottobre, sera)

- Controllo completo (`SICUREZZA.md`): RLS ovunque, nessun dato leggibile senza accesso, Content Security Policy
  nell'app, dati reali tolti dai file; **storia di GitHub riscritta** (nessun nome, codice, numero o email nei commit);
  **codice d'invito della radice rigenerato** (il vecchio era finito nella storia pubblica).
- Decisione di Stefano: **nessuno cancella niente** (migrazione `018_niente_cancellazioni.sql`, da incollare nell'SQL
  Editor): l'import è **sempre completo** (nell'anteprima si sceglie solo chi nascondere: *Nascondi chi ha 0 VP ·
  Nascondi tutti · Mostra tutti*); chi non è più nel report resta, segnato "non più nel report" e nascosto; ognuno
  nasconde chi vuole (anche le persone importate) e i VP contano sempre. Gli esclusi di prima diventano nascoste al
  primo import. Cancellazione solo per diritto all'oblio, dall'SQL Editor (`ADMIN.md`).
- **Captcha Cloudflare Turnstile** al primo ingresso di un telefono (account Cloudflare di Stefano, con verifica in
  due passaggi; Site Key in `config.js`, Secret Key solo in Supabase). Provider Email spento in Supabase.
- Captcha acceso anche in Supabase e provato sul telefono (17 ottobre).
- Restano da fare per Stefano: verifica in due passaggi (GitHub, Supabase, Google), email privata su GitHub.

## Proposte in sospeso (Stefano non ha ancora risposto)


## Domande aperte

- (Risolta: il link personale perso lo rigenerano solo Stefano e Alessia.)
- PIN di 4 cifre in più sul link personale? (Proposta: per ora no.)
