# Growup Team — a che punto siamo

Ultimo aggiornamento: 12 novembre 2026. Da leggere all'inizio di ogni nuova sessione con Claude Code.
Il metodo e la tecnica usati (da riusare per altre app) sono in `METODO.md`.

## «La prossima cosa» dal percorso: sempre quello che manca (13 novembre 2026, app v119, database non toccato)

Idea proposta da Claude, scelta di Stefano. Per chi è nel percorso di partenza (anche oltre i 30 giorni, finché non lo
finisce) il riquadro «La prossima cosa» in Io mostra **sempre quello che manca nella fase in corso** (`prossimaPercorso`),
con i dati del percorso e senza dire come farlo. Prima c'era solo «Fissa l'incontro con il tuo sponsor»; dopo, il riquadro
spariva se non c'era una persona della Lista da sentire oggi.
- Fase 2, incontro senza data: «Fissa l'incontro con il tuo sponsor» (come prima).
- Fase 2, incontro fissato: «Scrivi i prossimi nomi nella Lista · 12 di 30 nomi · entro sabato 14» → «Lista ›».
- Fase 3: «Il tuo primo ordine · 0 di 50 VP · restano 27 giorni» (oltre: «oltre i 30 giorni») → «Ordini ›».
  Ordine confermato in attesa della mappa: niente dal percorso (non c'è niente da fare).
- Fase 4: «Il tuo primo piano» («mancano il primo piano e il primo cliente» / «manca solo il primo piano») → «+ Piano»;
  con il piano fatto «Il tuo primo cliente · manca solo il primo cliente» → «Clienti ›».
Le persone della Lista da sentire oggi restano sotto, come prima. Avviati e chi ha finito il percorso: niente cambia.
All'upline nessun dato nuovo. Service worker v119. Test dell'interfaccia: 1262 controlli superati (sezione 85: tutte le
fasi con il pulsante, ordine in attesa della mappa, avviato; anteprima `e2e/85-prossima-nomi-light.png` e `-dark.png`,
`85-prossima-ordine-light.png`).

## Versione semplificata per chi inizia (12 novembre 2026, app v118, database non toccato)

Quattro PR in fila, da unire in ordine (una per punto); la versione del service worker sale una volta sola, nell'ultima.
Scelte di Stefano. **Si nasconde e basta**: niente lucchetti, nessun dato cancellato o cambiato, nessuna modifica al database.
**La regola, in una sola funzione** (`versioneSemplice()`, usata da tutte le pagine): è attiva quando il percorso di partenza
è attivo (`percorsoAttivo()`), **non sono passati 30 giorni dal primo ingresso** (`privacy_accettata_il`, altrimenti
`creato_il`: giorni 0-29, `GIORNI_SEMPLICE`) e l'interruttore «Mostra tutta l'app» è spento. Gli **admin** vedono sempre
tutto; gli **avviati** non sono mai in percorso, quindi non cambiano; chi non è in partenza non vede nessuna differenza.
Dopo i 30 giorni l'app si apre tutta anche se il percorso non è finito: il riquadro del percorso resta in cima a Io come
prima, finché non è completato. Una pagina nascosta a cui si arriva lo stesso (un collegamento, la pagina ricaricata) si
apre comunque.
1. **Io**: restano il riquadro del percorso di partenza, «La prossima cosa», la lista di oggi / «Da fare oggi» e la serie
   (e, come prima, «Il mio mese» e il Diario di oggi). Si nascondono la **linguetta Verifica** (con la Guida e la tabella
   Stabilità: se ci si arriva lo stesso, le linguette tornano per uscirne), lo **Storico** in «Il mio mese» e il
   **promemoria dell'import** della mappa. Test dell'interfaccia: 1179 controlli superati (sezione 84: nuovo con «Inizio»,
   nuovo con un partner sotto, nuovo dopo 30 giorni con il percorso in cima, partenza completata, avviato, admin;
   anteprima di Io a 360 px, `e2e/84-io-semplice-light.png` e `-dark.png`).
2. **Obiettivo**: restano la card del suo obiettivo, una **riga compatta con la tappa che vale la cifra** (tappa e cifra,
   con la nota «Cifre indicative» come prima) e il riquadro **«La prossima tappa»** (la tappa a cui sta lavorando, con i
   requisiti ✓/○, `vProssimaTappa`). Il **percorso fino a Diamante** (`vPercorsoDiamante`, lo stesso di prima) e **«Come
   arrivarci»** stanno dietro **«Vedi tutto il percorso»** (si apre e si richiude sulla stessa pagina, `percorso-tutto`).
   Prossima qualifica e report da importare non riguardano chi inizia: non si vedono. **Persone non cambia**: Lista,
   Clienti e Target come per tutti. Test dell'interfaccia: 1197 controlli superati (sezione 84; anteprima
   `e2e/84-obiettivo-semplice-light.png` e `-dark.png`).
3. **Gruppo**: restano **«Invita»** (con i suoi inviti e le immagini, come prima) e la frase **«Qui vedrai le persone che
   inviterai.»** (`vGruppoSemplice`); non si vedono struttura, preferiti, in attesa, nuovi in partenza, storico del gruppo
   e, sotto il titolo, «N persone · VP: mappa…». Con **almeno un partner sotto** il Gruppo si vede intero
   (`haPartnerSotto`, scelta di Stefano: un partner sotto di lui nella mappa, un invitato entrato nell'app ma in attesa
   della mappa, oppure un suo nuovo in partenza). Test dell'interfaccia: 1209 controlli superati (sezione 84: anche nuovo
   con un partner nella mappa e con un invitato in attesa; anteprima `e2e/84-gruppo-semplice-light.png` e `-dark.png`).
4. **Profilo e uscita**:
   - Nel Profilo, sotto i dati, il riquadro «Per chi inizia» con l'interruttore **«Mostra tutta l'app»** (`vTuttaAppProfilo`,
     azione `tutta-app`): una **preferenza di questo telefono** (`growup-team.tutta-app.<id>`, letta e scritta con try/catch;
     nessuna colonna nuova). Compare **solo** nei primi 30 giorni del percorso e solo a chi all'ingresso ha dichiarato
     **almeno il 3%** (una percentuale, oppure una qualifica: anche Path to Bronze, scelta di Stefano; `puoMostrareTutto`).
     Chi ha scelto «Inizio» non lo vede e per lui una preferenza rimasta sul telefono non conta. Acceso: tutta l'app
     (il percorso resta in cima a Io); spento: di nuovo la versione semplificata.
   - **Festa** della partenza completata: se era nella versione semplificata dice anche **«Ora hai tutta l'app.»**.
   - **Finiti i 30 giorni** con il percorso non finito, una volta sola su questo telefono (`growup-team.tutta-app-avviso.<id>`),
     il messaggio in basso **«Da oggi vedi tutta l'app.»** per 6 secondi (`avvisoTuttaApp`, all'apertura dell'app);
     non a chi aveva già acceso l'interruttore.
   - Una pagina nascosta raggiunta lo stesso (es. dalla Verifica al Profilo, interruttore spento, Indietro) si apre comunque.
   All'upline nessun dato nuovo (vede già la fase del percorso). Service worker v118. Test dell'interfaccia: 1249 controlli
   superati (sezione 84: nuovo con «Inizio» senza interruttore, nuovo con il 3% con l'interruttore acceso e spento, anche
   ricaricando, nuovo con Path to Bronze, nuovo dopo 30 giorni con il percorso non finito e l'avviso una volta sola,
   partenza completata, avviato, admin, niente nel database; sezione 61: la festa con «Ora hai tutta l'app.»; anteprima
   `e2e/84-profilo-semplice-light.png` e `-dark.png`). `test/db.sh` non serve (database non toccato).
   Da sapere: interruttore e avviso valgono per telefono; su un telefono nuovo l'interruttore riparte spento.

## Avviati: meno cose all'inizio e il Seguimi acceso (12 novembre 2026, app v117, database non toccato)

Tre PR in fila, da unire in ordine; la versione del service worker sale una volta sola, nell'ultima. Solo per gli **avviati**
(iscritti da più di 30 giorni, `avviato()`): il **percorso di partenza dei nuovi non cambia**.
1. **Tolto «Il punto con la tua upline»** (scelta di Stefano): non c'è più in «Per iniziare» (`perIniziare`: restano il
   perché e, se ha un gruppo, «Importa la tua mappa»), in «La prossima cosa» (tolto `puntoDaFare`) e nella vista dello
   sponsor («I tuoi nuovi in partenza» e la scheda: «Per iniziare N di M» con il perché e la mappa, `partenzaDi`).
   Un avviato senza gruppo, con il perché scritto, non ha più «Per iniziare» e non compare tra i nuovi in partenza.
   Resta com'è «Il primo incontro con il tuo sponsor» della fase 2 del nuovo (il foglio è ora solo suo, `vSheetIncontro`).
   Tolti il foglio del punto, le azioni `punto-fissa` e `punto-fatto`, il modulo `punto`, `testoPunto` e `conUpline`
   (nessun altro li usava). **Database non toccato**: le colonne `punto_upline` e `punto_upline_fatto` restano, con i
   dati già salvati (`partenze()` li restituisce ancora, l'app non li mostra). Test dell'interfaccia: 1125 controlli
   superati (sezioni 60, 62 e 81: avviato senza gruppo, avviato con gruppo, vista dello sponsor, punto salvato prima
   che non si vede e resta nel database; il primo incontro del nuovo come prima).
2. **Tolto «Scrivi 30 nomi nella tua Lista» dai Primi passi** (scelta di Stefano): restano il link personale, «Installa
   l'app», l'obiettivo e (con un gruppo) il primo import. Con il resto fatto, il riquadro sparisce anche con meno di 30
   nomi. Restano come prima i 30 nomi della fase 2 del percorso dei nuovi (`NOMI_PARTENZA`, «Lista 12 / 30») e la
   tessera «Nomi nuovi questa settimana» nel cruscotto degli avviati. I Primi passi non li vede chi segue il percorso;
   la voce sparisce anche per chi l'ha già finito (che i 30 nomi li ha scritti nella fase 2). Test dell'interfaccia:
   1126 controlli superati (sezione 46: niente voce dei 30 nomi, sparisce con tutto fatto e 0 nomi, la × con un avviato
   che ha un gruppo; sezione 13: dopo l'installazione i Primi passi sono tutti fatti e spariscono).
3. **Seguimi acceso da solo per gli avviati al primo ingresso** (scelta di Stefano): subito dopo «Da dove parti?», se è
   avviato, è al **primo ingresso** (privacy accettata negli ultimi 7 giorni, lo stesso criterio di «Passo 2 di 2»:
   `primoIngresso`) e **non ha mai avuto una riga in «seguimi»** (letta dal database in quel momento; se la lettura non
   riesce non si accende niente), l'app accende il Seguimi con «condividi» spento (`seguimiAlPrimoIngresso`) e mostra
   per 6 secondi «Ogni mattina trovi le azioni del giorno in «Il mio giorno». Lo togli dal Profilo.» al posto di
   «Obiettivo salvato» (`toast` ha ora la durata facoltativa). Chi l'ha spento resta spento; chi è nell'app da tempo e
   scrive il perché solo ora non è al primo ingresso; i nuovi come prima (il Seguimi si accende alla festa della
   partenza). Nessuna regola nuova: la riga la scrive il partner sulla propria riga, come dall'interruttore del Profilo.
   Da sapere: per un avviato appena entrato, con la Lista vuota, «Da fare oggi» propone la formazione e la chiamata con
   lo sponsor della settimana (le abitudini del Seguimi, come prima). Test dell'interfaccia: 1146 controlli superati
   (sezione 83: avviato senza gruppo, avviato con gruppo, avviato che l'aveva spento, nuovo nel percorso, avviato
   nell'app da tempo; Io a 360 px in chiaro e scuro, screenshot `e2e/83-io-avviato-light.png` e `-dark.png`; sezione 7:
   la radice di prova, senza data di iscrizione, trova il Seguimi acceso). Service worker v117.

## Da quanto è nella Lista: data e giorni (11 novembre 2026, sera, app v116, database non toccato)

Scelte di Stefano. Per chi è ancora **«In lista»** (fase `lista`, nessun esito) si vede da quando è stato scritto nella
Lista, con la data e i giorni (`inListaDa`, dal giorno di `creato_il` in ora italiana; tra numero e «giorni» uno spazio
che non va a capo):
- **Lista** (Persone → Lista), sotto il nome: «In lista dal 5 ottobre (37 giorni)»; scritto oggi «In lista da oggi»,
  ieri «(1 giorno)».
- **«Da fare oggi»** (Seguimi), righe Contatto: **solo l'azione** che il partner deve fare, «Da contattare», senza data né
  giorni in lista (scelta di Stefano: quelli stanno nella Lista).
- **In agenda** (data fissata con il calendario a destra del nome): solo l'appuntamento, l'azione da fare. Nella Lista
  come prima («In lista · Domani · 12 novembre · telefono · contatto»), in «Da fare oggi» «Domani · 12 novembre ·
  telefono · contatto» (scelta di Stefano: righe troppo lunghe).
- Non cambia per chi ha già fatto un passo (Contattato, Invitato…: resta «fermo da N giorni», che conta dall'ultimo passo)
  né per i Clienti.
Test dell'interfaccia: 1121 controlli superati (sezione 82: data e giorni nella Lista, in «Da fare oggi» solo «Da contattare», da oggi, 1 giorno,
in agenda solo l'appuntamento, chi è già contattato senza giorni in lista; screenshot `e2e/82-lista-light.png` e `-dark.png`).
Service worker v116.

## «Da fare oggi»: tolto «come la conosci» dal motivo del contatto (11 novembre 2026, sera, app v115, database non toccato)

Scelta di Stefano dopo la v114: nelle azioni di «Da fare oggi» il motivo del contatto è solo «Da contattare · in lista dal
[data]», senza «· lo conoscevi già» / «incontrato di recente» / «dai social». «Come lo conosci?» resta dov'era (modulo
del nome, scheda della persona, conteggio del cruscotto). Follow-up e cliente come nella v114. Test dell'interfaccia: 1114 controlli superati (sezione 82
aggiornata).
Service worker v115.

## «Da fare oggi»: il motivo sotto il nome (11 novembre 2026, sera, app v114, database non toccato)

Io → «Da fare oggi» (`vOggiPerTe`, solo con il Seguimi attivo): sotto il nome di ogni azione con una persona, in piccolo,
il **motivo**, come già in «Anche da sentire» (`motivoAzione`, classe `.motivo-oggi`):
- **Contatto**: «Da contattare · in lista dal [data]» (giorno di `creato_il`, ora italiana) e, se c'è «Come lo conosci?»
  (`fonte`), le stesse parole del cruscotto: «· lo conoscevi già», «· incontrato di recente», «· dai social».
  Chi non è più «In lista» (già contattato o chiuso): solo il nome.
- **Follow-up**: lo stesso testo della lista di oggi (`motivoVoce`): «In ritardo dal [data] · [prossimo passo]», oppure la
  data con il prossimo passo; se è in agenda, il suo «per cosa» (`testoProssima`). Senza data o chiuso: solo il nome.
- **Cliente**: lo stesso motivo di «clienti da sentire» (`clientiDaSentire`: compleanno, come si è trovato, riordino atteso,
  doveva riordinare). Se non è più da sentire: solo il nome.
Il motivo si calcola **quando si disegna la riga**: nelle azioni salvate (`seguimi_giorni.azioni`) resta solo tipo e id,
quindi se nel frattempo è cambiato (data spostata, passo segnato) si vede quello di adesso. Nessun cambio al database e alle
azioni salvate; all'upline nessun dato in più (vede solo i numeri, come prima). Il nome resta il pulsante che apre la
scheda; il motivo sta fuori dal pulsante. A 360 px il motivo va a capo dentro la card e la spunta resta ferma.
Test dell'interfaccia: 1116 controlli superati (sezione 82: i tre motivi, motivo cambiato, solo il nome senza motivo,
niente motivo nel database, a 360 px chiaro e scuro dentro la card con la spunta al suo posto; screenshot
`e2e/82-motivi-light.png` e `-dark.png`). `test/db.sh` non serve (database non toccato). Service worker v114.

## Niente più clienti, piani e contatti «senza nome» (11 novembre 2026, app v113, database non toccato)

Quattro PR in fila, da unire in ordine; la versione del service worker sale una volta sola, nell'ultima.
Decisione di Stefano: nell'app non si registrano più clienti, piani o contatti senza una persona. Un cliente si registra
solo da **Persone → Clienti** (`cliente-nuovo`) o chiudendo una persona della Lista come Cliente (il passo `chiusura`
con esito `cliente` lo conta il database, `passi_prima`); piani e contatti sempre con una persona.
1. **Io → «Il mio mese»**: tolto «+ Cliente»; «Nuovi clienti nel mese» è solo una riga con il numero (`clientiMese`, come prima).
2. **«+ Piano»** («Un piano: con chi?»): tolto «Senza nome: conta solo il piano». Si sceglie una persona della lista o si
   scrive il nome (vuoto: «Scrivi il nome, oppure scegli una persona qui sopra.»).
3. **«+ Contatto»**: tolto «Senza nome: conta solo il contatto». Si sceglie una persona dai suggerimenti o si scrive il
   nome. Tolta l'azione `senza-nome`, che non usava più nessuno.
4. **Percorso delle tappe**: tolto «+ Cliente» accanto a «I tuoi primi N clienti» (e il campo `cliente` del requisito);
   il requisito resta con il suo conteggio. Service worker v113, questo STATO.md.
Restano come prima: «+ Contatto», «+ Piano», «+ Cliente» nella scheda del partner senza app (griglia «I suoi numeri»:
lo sponsor scrive i numeri al posto di chi non usa l'app; azioni `contatto`, `piano`, `cliente` → `registra`).
Le attività già registrate senza nome restano nello storico e continuano a contare (nessun dato cancellato o cambiato).
Nessun testo «?» citava questi pulsanti. Test dell'interfaccia: 1096 controlli superati (Il mio mese con il numero dei
clienti registrati da Clienti, + Piano e + Contatto senza «Senza nome» e senza nome vuoto, requisito del percorso senza
pulsante); `test/db.sh` non serve (database non toccato).

## I VP solo dalla mappa Amway e più bozze d'ordine (10 novembre 2026, notte: migrazione 063, app v112)

Sei PR in fila (196-201), da unire in ordine. **Migrazione 063 applicata su Supabase da Claude il 10 novembre** (colonne,
indice tolto, regole, permessi delle funzioni e dati controllati: bozze, ordini e rettifiche vecchi, mappe e totali intatti).
Decisione di Stefano: i VP dell'app (personali, di gruppo, linee, percentuale; per me e per tutti, anche per chi non ha
l'app) sono **solo quelli ufficiali delle mappe Amway importate**. Nessun ordine, bozza o correzione scritta a mano cambia
più i VP. Restano le bozze d'ordine (anche più di una), che non toccano i VP; una bozza confermata va nello storico.
1. **Solo mappa (063)**: `calcola_mese`, `riepilogo_mese`, `chiudi_mese` leggono solo `numeri_mese` (la mappa che vale
   per ogni persona e mese, regole della 051: anche se l'ha importata un upline o l'admin). Senza la mappa del mese:
   **null**, «nessuna mappa di [mese]», mai uno zero. Si congelano solo i numeri di chi ha la mappa; lo Storico (mio e del
   gruppo) viene dalle mappe dei mesi passati, i totali congelati restano nel database ma non si mostrano. La regola sulle
   attività **rifiuta** nuovi `ordine` e `rettifica` (quelli vecchi restano e si vedono nel diario, ma non contano).
   `partenze.vp_dal_ingresso` = VPP della prima mappa (dal mese di iscrizione) che ne mostra (prima sommava gli ordini,
   anche quelli che la RLS nasconde allo sponsor). La notifica «mancano X VP» la calcola il database dalla mappa e
   l'obiettivo del mese, con la data: «(mappa dell'8 novembre)»; senza mappa non parte. App: VP, percorso, requisiti,
   Come arrivarci, Seguimi, traguardi, Gruppo, scheda, confronto, preferiti ed etichette solo dalla mappa; accanto ai VP
   «mappa del 3 novembre» (`testoMappa`, `delGiorno`: «dell'8», «dell'11», «del 1°»). In cima al Gruppo **una sola data**
   (la mia mappa del mese, cioè la più recente importata da me o da sopra). Test 063 in `tests_rls.sql`.
2. **Niente VP a mano**: tolti Ordine veloce, «Aggiorna il totale del mese» (anche nella scheda del partner senza app, con
   il suo «+ Ordine»: restano + Contatto, + Piano, + Cliente). Foglio «+ Ordine»: Le mie bozze · I miei ordini · Ordini
   dal sito Amway; il pulsante in basso resta «+ Ordine» con sotto i VP della mappa.
3. **Più bozze** (063: tolto `ordini_personali_una_bozza`; `nome` max 60, `persona_id` solo persone mie con RLS,
   `ordine_cliente_id`): elenco con nome, cliente, VP e prezzo; «+ Nuova bozza»; nella bozza «Con questa bozza
   arriveresti a X VP» (mappa + bozza, «stima: non conta finché non arriva la mappa»), con l'obiettivo «ti mancherebbero
   Y VP» o «obiettivo del mese raggiunto ✓». «Conferma ordine»: nello storico con la data, senza VP, **nessun limite di
   mese chiuso** (scelta di Stefano: le mappe passate non cambiano); con un cliente l'ordine entra anche nella sua scheda
   (riordino come gli altri ordini dei clienti); conta per la serie. «Rifai» = bozza nuova con gli stessi prodotti; «×»
   nello storico toglie anche l'ordine dalla scheda del cliente (scelta di Stefano).
4. **Il primo ordine** (percorso di partenza): fatto quando una mappa (dal mese di iscrizione) mostra il primo ordine;
   scelta di Stefano: anche sotto i 50 VP è fatto, con «sotto i 50: iscrizione a pagamento», e da lì sparisce il conto dei
   30 giorni (percorso, cruscotto, «Nuovo · ordine ✓» dello sponsor). Bozza confermata non ancora nella mappa: «Ordine
   confermato · in attesa della mappa» con «!», non spuntato. La tappa «Primo ordine» del cruscotto resta a 50 VP in un mese.
5. **Testi e «?»**: «?» dei VP (anello, Il mio mese, Ordini, Le mie bozze) con il testo di Stefano; aiuti senza numeri
   scritti a mano.
6. Service worker v112, questo STATO.md. Controllo /security-review fatto: nessun problema (calcola_mese e chiudi_mese
   restano chiuse ai telefoni; bozze: nome e cliente solo con permessi di colonna e `persona_mia`, il cliente solo tra le
   mie persone, `ordine_cliente_id` lo scrive solo `conferma_ordine`, che rifà il controllo e passa dal trigger
   `ordini_prima`; testi nuovi sempre con `esc()`).
Da sapere: dal giorno 1 al primo import del mese tutti vedono «nessuna mappa di [mese]»; più spesso i Platino importano,
più i numeri restano freschi. Test: `test/db.sh` superati; test dell'interfaccia 1088 controlli (i VP arrivano da mappe di
prova: `mappa()` e `mappaIn()` in `test/e2e/head.mjs`).

## Indietro su un foglio compilato: non esce più dall'app (10 novembre 2026, sera, app v111, database non toccato)

Dalla prova di Stefano su Android (v110): «+ Nome», scritto un nome, Indietro → «Uscire senza salvare?» → Annulla →
di nuovo Indietro: **l'app si chiudeva** senza chiedere. Causa: Chrome su Android salta con Indietro le voci della
cronologia aggiunte senza un tocco della persona (e la schermata da cui sono state aggiunte); la finestra di sistema
(`confirm`) non conta come tocco sulla pagina, quindi la voce rimessa dopo «Annulla» veniva saltata insieme alla Lista.
I test automatici non lo vedono (succede solo con il vero tasto Indietro del telefono). Ora:
- una voce si aggiunge **solo subito dopo un tocco o un tasto** (`conTocco`, `navigator.userActivation`); se non c'è,
  aspetta il prossimo tocco (`storiaInAttesa`);
- un foglio compilato ha una **voce di guardia** in più (`livelloVoluto`), aggiunta mentre si scrive: il primo Indietro
  toglie la guardia e chiede, il foglio ha ancora la sua voce;
- «Uscire senza salvare?» è una **finestra dell'app** (`chiediUscita`, Annulla / Esci): «Annulla» è un tocco vero e
  rimette la guardia, così l'Indietro dopo chiede di nuovo; un altro Indietro con la domanda aperta chiude il foglio
  senza salvare ma **resta nell'app**.
Test: sezione 78 aggiornata (anche: nessuna voce aggiunta senza tocco).

## Ritocchi di usabilità: Indietro, doppioni, linguette, testi (10 novembre 2026, app v110, database non toccato)

Cinque PR in fila (190-194), da unire in ordine; la versione del service worker sale una volta sola, nell'ultima.
1. **Tasto e gesto Indietro** (Android, Safari su iPhone): ogni foglio e ogni sotto-pagina (scheda di persona, cliente,
   invito Target, partner; Profilo; Analisi; Obiettivo aperto da Io) ha una voce nella cronologia (`history.pushState`).
   Il numero di voci si ricava dallo stato (`livelloDi`, `livelloApp`) e dopo ogni `render()` la cronologia si allinea
   (`allineaStoria`): un foglio o una scheda che si apre aggiunge la voce, un pulsante dell'app che chiude o torna indietro
   la toglie (`history.go`). Il `popstate` chiude il foglio o torna alla schermata di prima (`indietroPagina`, come lo
   scorrimento verso destra). Foglio con campi compilati (le ricerche no): «Uscire senza salvare?». Dalle schede
   principali Indietro fa come prima. La riga dell'obiettivo nel cruscotto di Io è `obiettivo-da-io` (sotto-pagina);
   `st.sotto` dice da che livello si è aperto Profilo, Analisi o Obiettivo. Lo scorrimento con il dito non parte dal bordo
   sinistro quando c'è una voce (è il gesto del telefono). Pagina ricaricata con un foglio aperto: la voce torna la base.
   `#chiave=`, `#invito=`, `?condivisi=1` non toccati. Test: sezione 78.
2. **«+ Contatto»**: mentre si scrive il nome, fino a 5 nomi della Lista e dei Clienti (`personeContatto`: ogni parola
   scritta, senza accenti, deve stare nel nome) con la fase in breve («· in lista», «· in corso», «· cliente»…); toccandone
   uno il contatto si segna su quella persona (`contatto-su`, `contattoSu`). Senza scelta come prima (nome identico →
   persona esistente). Tolta la frase «Se è già nella lista, scrivi il nome uguale…». **«+ Nome»** (Lista, Clienti,
   Rubrica): avviso ambra anche per il nome identico (`stessoNome`, `chiaveNome`: senza accenti, maiuscole e spazi doppi),
   un solo avviso se coincidono nome e telefono; gli omonimi si salvano lo stesso (secondo «Salva»). Test: sezione 79.
3. **Persone**: linguette Lista | Clienti | Target; si apre sempre la Lista. Test: sezione 80.
4. **Testi**: «Passo 2 di 2» sopra «Da dove parti?» per chi ha accettato la privacy negli ultimi 7 giorni. Percorso di
   partenza: «Primo incontro con il tuo sponsor» si spunta solo da quel giorno («fatto 10 novembre»); nel futuro
   «fissato per …» e «Cambia». Lo sblocco della fase non cambia (data fissata + 30 nomi). Scelte di Stefano: il punto con
   l'upline cambia solo nei testi (la ✓ resta «L'ho già fatto»; data passata senza conferma: «era fissato per il …»,
   `testoPunto`), «Partenza con te» vista dallo sponsor solo nel testo («Incontro fissato per …» / «Incontro fatto …»).
   Test: sezione 81 (e 61 aggiornata).
5. Service worker v110. Controllo /security-review fatto: nessun problema (testi nuovi sempre con `esc()`, nella
   cronologia solo un numero, niente dati nuovi sul telefono).
Da provare dal telefono (Android: app installata e Chrome; iPhone: Safari e app sulla Home): vedi la PR 194.

## Rubrica su Android 17: «Condividi → Growup» (9 novembre 2026, sera, app v109, database non toccato)

La riga di diagnosi (v108) ha mostrato la causa: sul telefono di Stefano (Samsung, One UI 9.0, **Android 17**), sia
dall'app sulla Home sia da una scheda di Chrome, `navigator.contacts.select` risponde **0 contatti dopo 0,6 secondi**,
appena si apre la nuova rubrica di sistema di Android 17 e prima della scelta. È Chrome, non Growup: da una pagina web
non si aggira. Decisione di Stefano: il pulsante «Rubrica» resta e, quando non funziona, spiega l'altra strada.
- **Riquadro**: se la rubrica risponde vuota in meno di 2 secondi (`RUBRICA_SUBITO_MS`), sotto il pulsante il riquadro
  ambra «Su questo telefono la rubrica non passa i contatti a Growup» con «apri l'app Contatti, spunta uno o più nomi,
  tocca Condividi e scegli Growup». Se la risposta vuota arriva dopo (chi annulla), solo l'avviso di prima.
- **Condividi → Growup** (`share_target` nel manifest, POST `./condividi`): il service worker legge il file vCard
  (2.1 con quoted-printable, 3.0, 4.0) e tiene **solo nome e numeri** (`contattiDaVcard`; niente email, indirizzi, foto,
  note), li mette nella cache `growup-condivisi` e apre `./?condivisi=1`. L'app (`prendiCondivisi`, da `vaiHome`) li legge,
  li cancella subito e apre «Nomi dalla rubrica» (o il modulo già compilato, se è uno solo). Massimo 50.
  «Growup» compare nel menu Condividi quando il telefono ha aggiornato l'app installata (Chrome lo fa da solo, entro un
  giorno circa; altrimenti si rimette l'icona sulla Home, **dopo aver salvato il link personale**).
- Tolta la riga di diagnosi. Test: sezioni 76 (riquadro) e 77 (manifest, lettore vCard, apertura dell'elenco).
- Da fare: segnalare il difetto a Chrome (issues.chromium.org) con i dati della diagnosi, senza nomi né numeri.

## Rubrica: la riga di diagnosi (9 novembre 2026, sera, app v108, database non toccato, TEMPORANEA)

Con la v107 sul telefono di Stefano stessa cosa: modulo vuoto e nessun avviso. Per capire dove si ferma, sotto il pulsante
«Rubrica» una riga grigia con la versione e i passaggi dell'ultimo tentativo con i secondi: clic, rubrica chiesta,
nascosta/visibile, pagehide/pageshow, congelata/ripresa, risposta (quanti contatti), nome sì/no e quanti numeri. Mai nomi
o numeri. Si azzera aprendo o chiudendo il modulo. Da togliere quando la Rubrica funziona (`passoRubrica`, `.rubrica-passi`).
Prova chiesta a Stefano: dall'app sulla Home e da una scheda di Chrome, con lo screenshot della riga. Test: sezione 76.

## Rubrica: il contatto nello stato e gli avvisi (9 novembre 2026, sera, app v107, database non toccato)

Dalla registrazione di Stefano (Android, app sulla Home, v106): rubrica di sistema → «Fine» → «Condividi contatti» di
Chrome con nome e numero → «Fine» → si torna al modulo, che resta vuoto, senza avvisi e senza ricaricare la pagina.
Causa non riprodotta (nessun problema noto di Chrome). Due cambi:
- il contatto scelto sta nello **stato** (`st.rubricaUno`: nome, numeri, numero scelto) e il modulo lo mostra nei suoi
  valori, quindi resta anche se l'app ridisegna; i campi si scrivono anche direttamente (il nome della rubrica prende il
  posto di quello scritto prima). «Quale numero?» viene dallo stato. Nome e numeri si leggono anche se arrivano come
  testo e non come elenco;
- se non entra niente l'app lo **dice** (solo quanti, mai nomi o numeri): «Dalla rubrica non è arrivato nessun contatto»,
  «Il contatto è arrivato senza nome e senza numero», «La rubrica non ha risposto (tipo di errore)», «La rubrica non ha
  ancora risposto: riprova» (4 secondi dopo il ritorno all'app), «Il modulo si è chiuso: riapri «+ Nome» e riprova».
Al prossimo tentativo l'avviso dice dove si ferma. Test: sezione 76.

## Rubrica: più contatti insieme (9 novembre 2026, sera, app v106, database non toccato)

Migrazione 062 applicata su Supabase da Claude il 9 novembre (colonna, permessi e policy controllati).
Dal telefono di Stefano (Android, app sulla Home) la Rubrica «non inseriva» il contatto: scelto il contatto si vedeva una
schermata bianca con il nome (la scheda del contatto nella rubrica di Android, non Growup). Decisione di Stefano: si
possono scegliere **più contatti**. Ora `navigator.contacts.select(["name", "tel"], { multiple:true })`:
- **un contatto**: come prima, nome e numero nel modulo (cercato di nuovo nella pagina al ritorno dalla rubrica, così
  funziona anche se intanto l'app ha ridisegnato il modulo);
- **più contatti** (al massimo 50): il foglio diventa «Nomi dalla rubrica» / «Nuovi clienti dalla rubrica», un elenco con
  la spunta, nome e numero modificabili, i numeri alternativi da toccare e i doppioni con la barra ambra («È già nella
  tua lista: …», spuntati: si tolgono a mano). «Come li conosci?», «Dettaglio» e cerchie valgono per tutti.
  «Aggiungi N nomi» li salva insieme (`salvaRubricaMolti`); i nuovi clienti entrano chiusi come Cliente.
Test: sezione 75 (e 71 aggiornata). Da riprovare sul telefono di Stefano.

## Il modulo di un nome: Social, «Come lo conosci?», Rubrica, Incolla, doppioni (9 novembre 2026: migrazione 062, app v105)

Otto PR in fila (178-185), da unire in ordine; **prima la migrazione 062 su Supabase**. Riguardano il modulo «Un nome
nella tua lista» / «Un nuovo cliente» (`vSheetPersone`, foglio `persona-nuova`) e «Modifica i dati».
Regola generale: tutti i campi restano scrivibili a mano; Rubrica e Incolla compilano soltanto i campi, e quello che si
scrive a mano non viene mai trasformato.
1. **Social (062)**: colonna `persone.social` (facoltativa, max 80), `grant insert/update (social)`. Nessuna policy nuova
   (`persone_mie`: solo chi ha scritto la persona). Il social non è in `copia_dati`, `numeri_persone` né in altre funzioni;
   controlli 062 in `tests_rls.sql` (l'upline, anche admin, non legge né contatto né social). I valori già in «contatto»
   restano dove sono: il 9 novembre su 17 contatti salvati nessuno conteneva lettere o @.
2. **Telefono e Social**: «Telefono (facoltativo)» (`type=tel`, `autocomplete=tel`) e sotto «Social (facoltativo)»
   («es. @nome su Instagram»). Il social si vede nella scheda della persona e del cliente.
3. **«Come lo conosci?»** al posto di «Come lo conosci» + «Fonte»: chip a scelta singola facoltativa **Lo conoscevo ·
   Di recente · Dai social** (testi accorciati da Stefano perché stiano su una riga a 360 px; valori `conoscenza`,
   `dal_vivo`, `social` come prima) e sotto «Dettaglio (facoltativo)» (colonna `origine`). Per tutti (non più solo gli
   avviati) e per i nuovi clienti. «Dai social» porta il cursore al campo Social. Nel cruscotto (solo avviati) i nomi
   nuovi della settimana: «lo conoscevi già», «incontrati di recente» (uno: «incontrato di recente»), «dai social».
4. **Rubrica** (Contact Picker API, oggi Chrome su Android; dove non c'è non compare): pulsante a contorno in cima al
   modulo, solo per un nome nuovo (non in modifica né nel «+ Contatto» rapido). Chiede solo nome e telefono di un
   contatto; con più numeri «Quale numero?». Pulizia del numero (`numeroPulito`): via spazi, trattini, parentesi, punti
   e barre; 00 → +; +39 se manca il prefisso.
5. **Incolla** accanto al Telefono (pensato per iPhone), solo per un nome nuovo e solo se il browser legge gli appunti:
   li legge solo al tocco, prende il primo numero dal testo (le date no), altrimenti «Negli appunti non c'è un numero».
6. **Doppioni**: stesso numero già in `st.persone` (solo cifre, senza +39/0039; un prefisso estero resta diverso) →
   avviso ambra «È già nella tua lista: [nome]» con «Apri la sua scheda». Dopo Rubrica e Incolla, uscendo dal campo e
   al salvataggio (il primo «Salva» mostra l'avviso, il secondo salva). In modifica solo se il numero è cambiato.
7. **Nome**: `autocomplete="name"` al posto di `off`; il «+ Contatto» rapido trova ancora il nome uguale.
8. **Privacy e sicurezza**: dalla rubrica solo nome e telefono, il testo degli appunti non si tiene, nessun numero o
   social in console o log (lo stato dei doppioni resta in memoria). Controllo /security-review fatto.
Test: sezioni 69-74 (interfaccia) e 062 (database). Da provare dal telefono: Rubrica su Android, Incolla su iPhone.

## La versione di prova (4 novembre 2026, notte, app v103, database non toccato)

Per far vedere l'app senza dati veri (incontro del 7 novembre con un leader CL21): **`growup-team/prova/`**, link
`https://cl21-aes.github.io/growup-team/prova/`. È l'app vera (index.html, app.js, listino.js) con al posto del database
l'API finta dei test, spostata in `prova/api-prova.js` (i test la leggono da lì), e dati inventati generati da
`prova/dati-prova.js` con le date relative a oggi. `prova/avvio-prova.js` prende la pagina da `index.html`, toglie gli
script veri e carica quelli della prova. All'inizio si sceglie chi essere: Luca Bassi (entra con l'invito di Giulia e fa
il percorso di partenza), Giulia Martini (in attività da due anni: Lista, clienti, Target, Verifica, gruppo di 26; è la
sponsor di Sara e Luca), Sara Conti (12 giorni, a metà partenza), Stefano e Alessia (upline e admin). «Scarica la mappa
Amway di prova» fa un CSV del gruppo con due iscritti nuovi, da importare come Stefano e Alessia. «Ricomincia da capo».
Il 5 novembre (app v104) nella pagina di scelta si aggiungono i file del sito Amway, tutti inventati, per far vedere gli
import: la mappa della rete di Giulia (da importare come Giulia), quella di Stefano e Alessia, i clienti di Giulia
(export «Clienti»: tre nuovi, due mai comprato) e i loro ordini (export «Ordini»), da importare insieme in Clienti.
Sicurezza: la pagina ha `connect-src 'self'` (nessun collegamento al database); tutte le chiavi sul telefono hanno
«prova.» davanti (`salvaLocale`/`leggiLocale` in app.js, la sessione dell'API finta), così il link personale dell'app
vera sullo stesso telefono non si tocca; notifiche e captcha finti. Controlli nella sezione 68 dei test.

## VPP negativi nella mappa (4 novembre 2026, notte, app v102, database non toccato)

Spiegato da Stefano: dopo la prima qualifica Argento (10.000 VPG), per sei mesi Amway chiude il mese come qualificato
anche a 9.500 VPG; lo chiude a 10.000 e il mese dopo fa partire da meno i VP che mancavano (chiuso a 9.510,83 → il
mese dopo parte da -489,17). L'import rifiutava questi VPP («non sono un numero»). Ora i VPP (e i VPG) negativi si
leggono, anche con il segno «−», e si salvano così come sono (la mappa fa fede); un trattino o «N/D» valgono 0. Nella
struttura: «-489,17 VP da recuperare». Le barre non vanno mai sotto 0. Se un valore non è un numero, l'avviso dice cosa
c'è scritto nel file.

## I campi non si svuotano più (4 novembre 2026, sera, app v101, database non toccato)

Quando l'app ridisegna lo schermo (tornando sull'app da WhatsApp, dati che arrivano dopo, una scelta nel foglio) quello
che si stava scrivendo restava perso. Ora `render()` riscrive il foglio aperto solo se è cambiato; quando una parte
cambia davvero, prima si segnano i campi toccati dalla persona (valore diverso da quello proposto, spunte) e il cursore,
poi si rimettono (`fotoCampi` / `rimettiCampi`). Riaprendo un foglio si riparte da vuoto. Controlli nella sezione 67
dei test (falliscono con il codice di prima).

## Leggibilità, punti 2 e 3: niente a capo a 360 px, la × rotonda (4 novembre 2026, sera, app v100, database non toccato)

I pulsanti piccoli non vanno più a capo: se in una riga non c'è posto va a capo la riga (il pulsante scende sotto, a
destra), non il testo del pulsante («Importa da Amway», «Leggi una risposta», «+ Nuovo invito», «Per iniziare 1 di 2 ›»).
Nella struttura e negli inviti il nome non si stringe più: le etichette («Da confermare», «attivo», «Nuovo · ordine ✓»)
scendono sotto, a destra. La × è rotonda e uguale ovunque, anche in «Primi passi». Un controllo automatico (sezione 66
dei test) gira tutte le pagine a 360 px e segnala ogni pulsante, filtro o etichetta che va a capo e ogni nome stretto.

## Leggibilità, punto 1: i colori dei testi (4 novembre 2026, sera, app v99, database non toccato)

Testi grigi, ambra e verde almeno 4,5:1 (WCAG AA) su tutti i fondi (pagina, scheda, caselle chiare, verde chiaro) nei
due temi: chiaro `--ink3` #7a8781 → #5f6c66, `--giallo` #9a6a00 → #8a5f00, `--verde` #13795b → #127256; scuro
`--ink3` #7d8f85 → #869890. I suggerimenti grigi dentro i campi non sono più sbiaditi. Un controllo automatico (sezione
65 dei test) misura i contrasti a ogni consegna. Restano i punti 2 e 3 (niente a capo a 360 px, la × di «Primi passi»).

## Gruppo: il pallino dell'app (4 novembre 2026, sera, app v98, database non toccato)

Nella struttura e negli elenchi dei filtri, accanto al nome un pallino: verde usa l'app, grigio senza app. La scritta
«senza app» in fondo alla riga non c'è più; «attivo / rallenta / fermo» resta solo per chi usa l'app. Il «?» di «La mia
struttura» spiega i colori dei livelli con i cerchietti (1 tu, 2 blu, 3 viola, 4 petrolio, 5 rosa, 6 nocciola, poi si
riparte dal blu), il pallino e attivo/rallenta/fermo (aggiornato entro 7 giorni, entro 14, oltre).

## «Da riprendere» (4 novembre 2026, sera: migrazione 061, app v97)

Un contatto avviato (da Contattato in poi, senza esito) senza passi da 14 giorni e senza una data in agenda da oggi in
avanti è **fermo**: riga ambra con la barra a sinistra, «fermo da N giorni» (anche su Io, in «In corso»). I nomi mai
contattati non lo sono mai. Il filtro «Da riprendere» raccoglie i fermi, i «Non ora» e i chiusi senza risposta quando
arriva il promemoria. Nella scheda del fermo, riquadro ambra («Nessun passo da N giorni. L'ultimo è …») con
**Ricordamelo tra 30 giorni** (lo mette in agenda fra 30 giorni, per il passo che viene dopo) e **Chiudi contatto**
(esito nuovo «Chiuso senza risposta», che non è un «No»; «Te lo ricordo tra 6 mesi?» → in agenda fra 6 mesi). L'esito
nuovo c'è anche nella chiusura normale. I promemoria usano l'agenda (057): nessuna colonna nuova. 061 aggiunge solo
`senza_risposta` ai check di `persone.esito` e `passi.esito`; controlli in `tests_rls.sql`. L'upline vede solo i numeri.

## Ritocchi chiesti da Stefano il 4 novembre 2026 (PR «ritocchi», app v96, database non toccato)

1. **Obiettivo**: tolta «La visione». Il percorso si vede tutto, fino a Diamante (le qualifiche «Fondatore» non sono
   tappe a parte), con la tappa dell'obiettivo evidenziata («obiettivo») e la tappa attuale con i requisiti.
2. **Verifica · Stabilità**: si parte sempre dal mese in corso, con i numeri di adesso. Le frecce ‹ › accanto al mese
   portano ai mesi prima (fino a 12 mesi indietro): «dalla mappa» se la mappa di quel mese c'è (percentuale dalla mappa),
   altrimenti «senza mappa importata». I numeri scritti a mano (app CumLaude21, Training Day, Convention) sono quelli di
   oggi anche nei mesi prima, e lo dice. Tolti «questo mese finora» e l'avviso «Importa la mappa di…».
3. **Cerchie dalla scheda**: nella scheda di una persona della Lista e di un cliente, «+ Aggiungi a una cerchia» (o
   «Cambia le cerchie»): si spuntano le cerchie che ci sono (della Lista o dei Clienti, separate) e se ne crea una nuova
   con dentro la persona.

In attesa di Stefano: nomi e contatto dei titolari nell'informativa.

## Piano «nuova Io» (approvato il 3 novembre 2026, sera)

Il piano completo, con le decisioni e le 9 consegne, è in **`PIANO_IO.md`**: si riparte da lì. Consegna 1 (grafica di
base: pesca `#f08a4b` solo per l'azione, selezione verde scuro / avorio, numeri in Source Serif 4 ospitato nell'app,
spiegazioni di Preferiti, Invita e Nascondi nel «?», caselle nei colori dell'app, pulsanti in basso bianchi) unita
(PR #159), app v86. Consegna 2 («Il mio giorno» nuova, proposta D) unita (PR #160), app v87: cruscotto in cima (obiettivo,
anello dei VP personali del mese, tappa con i requisiti che si apre, contatti e piani della settimana), poi «La prossima
cosa» con la lista unica di oggi (Lista e Clienti insieme, etichetta e motivo; «Prossimi giorni e in corso» in una riga
che si apre). «Più tardi»: per la Lista si sceglie quando risentirlo, un cliente passa in fondo alla lista di oggi
(fino all'agenda, consegna 4). «Il mio mese» è una riga che si apre. Database non toccato. Serie e agenda arrivano
nelle consegne 4 e 5. Consegna 3 (Verifica, ex Guida) in PR, app v88: la linguetta si chiama «Verifica»; tabella
Stabilità CL21 con grafica nuova (livello raggiunto e rete reale, riga delle percentuali, «tu N» e 7 caselle per voce,
legenda, «Per sostenere il X%»), abitudini con barra e cerchi dei giorni, «La mia analisi» in fondo. Tolti «Il tuo
piano» e «Cosa fare adesso»; Seguimi e Condividi spostati nel Profilo. Database non toccato. Prossima: consegna 4,
Agenda (con il database: per cosa, come).
Consegna 3 unita (PR #161). Consegna 4 (Agenda, migrazione **057**) in PR, app v89: icona calendario su ogni riga di Lista
e Clienti → «In agenda · nome» (Per cosa, Quando: Oggi/Domani/dopodomani o un giorno, Come, Ora facoltativa con
l'avviso 30 minuti prima, Nota); il giorno scelto la persona entra nella lista di oggi (anche chi è ancora «In lista» e
i clienti). «Fatto» chiede com'è andata e solo la risposta segna il passo (Contatto → Contattato; Fissare il piano →
Piano fissato = un invito e subito «Quando è il piano?»; Piano → Piano mostrato = un piano e «Quando lo risenti?»;
Non risponde / Rimandato → un altro giorno, nessun passo). «Più tardi» apre l'agenda. Nella scheda «Prossima cosa»
diventa «In agenda». 057 aggiunge solo due colonne con i valori ammessi (`prossima_per`, `prossima_come`): da applicare
su Supabase dopo l'ok di Stefano. Consegna 4 unita (PR #163), 057 applicata su Supabase il 4 novembre.
Consegna 5 (Serie) in PR, app v91, database non toccato: in «Il mio giorno», sotto la lista di oggi, la card della serie
(«N settimane di fila», record dell'ultimo anno, i 7 cerchi della settimana con oggi, «Questa settimana: N giorni attivi
su 5»). Settimana valida = almeno 5 giorni attivi su 7 (lunedì-domenica); giorno attivo = almeno un contatto, invito,
piano, follow-up o altro passo, un cliente o un suo ordine scritto a mano, la formazione o la chiamata con lo sponsor.
Consegna 5 unita (PR #164, v91 con il cerchio di oggi allineato).
Consegna 6 (migrazione **058**) in PR, app v92. Scelte di Stefano del 4 novembre: il perché è obbligatorio («Da dove
parti?»: cifra, mese e perché, con il link da salvare; niente «Lo scrivo dopo»; chi è nell'app senza perché la vede una
volta); «Per iniziare» anche per chi c'è già; nomi nuovi senza obiettivo settimanale; punto con l'upline generico (si
segna solo il giorno, con chi lo sceglie il partner). Avviati = iscritti da più di 30 giorni (o senza data): «Per
iniziare · N di M» (il mio perché, il punto con la tua upline se ha uno sponsor, importa la mappa se ha un gruppo), che
sparisce quando è fatto; il giorno del punto è la prossima cosa con «Fatto»; nel cruscotto la tessera «Nomi nuovi» e la
riga delle fonti; la fonte (Conoscenza, Dal vivo, Social) nel nome nuovo. 058: `partners.punto_upline`,
`punto_upline_fatto` (solo la propria riga) e `persone.fonte`: da applicare su Supabase con l'ok di Stefano.
Consegna 6 unita (PR #165), 058 applicata su Supabase il 4 novembre.
Consegna 7 (Percorso dei nuovi, migrazione **059**) in PR, app v93. Scelte di Stefano: il percorso resta finché non è
finito (anche oltre i 30 giorni); binario Prodotto con i soli clienti. Chi entra nell'app da nuovo (iscritto da 30 giorni o
meno al momento dell'ingresso) vede «Percorso di partenza · Fase N di 5» al posto del cruscotto e dei Primi passi: 1 Il mio
perché (consegna 6), 2 Partenza con lo sponsor (giorno del primo incontro + 30 nomi, «entro» 48 ore dall'ingresso), 3 Il
primo ordine (50 VP, «restano N giorni» dei 30, poi «oltre i 30 giorni»), 4 I due binari (contattati, invitati, piani →
primo piano; clienti → primo cliente), poi la festa a tutto schermo una volta sola, con un solo pulsante «Vai al cruscotto»: il
Seguimi si accende da solo e si toglie dal Profilo (scelta di Stefano). Fasi dopo quella in corso con il lucchetto, il resto dell'app usabile. La prossima cosa del percorso:
«Fissa l'incontro con il tuo sponsor». 059: `partners.incontro_sponsor`, `partenza_completata_il` (solo la propria riga):
da applicare su Supabase con l'ok di Stefano. Nei test e2e chi entra ha la partenza già completata, salvo `conPercorso`.
Consegna 7 unita (PR #166), 059 applicata il 4 novembre; la festa ha un solo pulsante «Vai al cruscotto» e il Seguimi si
accende da solo (scelta di Stefano).
Consegna 8 (Gruppo per lo sponsor, migrazione **060**) in PR, app v94: in cima al Gruppo «I tuoi nuovi in partenza»
(solo chi ho invitato e usa l'app, finché non ha finito: nuovi «Fase N di 5» con barra e «Manca: …», avviati «Per
iniziare N di M»), × con Annulla, tornano se vanno avanti di fase; «Nuovo · N gg» / «Nuovo · ordine ✓» nella struttura
e filtro Nuovi = iscritti da meno di 30 giorni; scheda del nuovo con l'app (percorso, solo numeri) e senza app (primo
ordine dalla mappa, «Invitalo in Growup»). 060: `partenza_tolti` (righe solo mie), `partenze(p_partner)` (solo numeri e
date: mai nomi della Lista, mai il testo del perché), `invitato_da_me(uuid)`: da applicare con l'ok di Stefano.
Consegna 8 unita (PR #167), 060 applicata il 4 novembre (dopo l'unione: nel frattempo il Gruppo era come prima).
Consegna 9 (Ingresso che accoglie e traguardi a tutto schermo) in PR, app v95, database non toccato: l'ingresso con chi
invita (iniziali, «Ti ha/hanno invitato»), il saluto per tutti «Ciao Nome, ti diamo il benvenuto in Growup», tre righe su
cosa si trova e «Passo 1 di 2 · Da dove parti in Amway» con «Avanti» (il passo 2 è «Da dove parti?»); la privacy dice
«li vediamo io e la mia upline, mai i nomi della mia Lista». Traguardi grandi a tutto schermo con i coriandoli e un solo
«Continua», una volta sola: tappa raggiunta (con VP e la prossima tappa), obiettivo VP del mese, primo cliente, primo
partner, e la serie a 4, 8, 12, 26 e 52 settimane di fila; annuncio piccolo per gli altri record della serie, per la
serie che inizia e (come prima) per contatti e piani della settimana. Con questa il piano «nuova Io» è completo.

## Nuovi iscritti dalla mappa (4 novembre 2026, migrazione 056)

Scelta di Stefano: nella tabella Stabilità (Verifica) e nell'Analisi, «Nuovi iscritti nel gruppo» di un mese sono le
persone del gruppo con la **Data di ingresso della mappa** in quel mese solare (una volta sola, anche con più import nel
mese, anche dal primo import), contate solo se sono in almeno una mappa importata. Prima si contava chi compariva per la
prima volta in una mappa (`in_mappa_dal`), così ottobre restava a 0. «I tuoi nuovi iscritti» (con il tuo link) non
cambia: la persona entrata con il link è «nuova» per 30 giorni, da seguire per primo ordine e primi passi (consegna 8).
056 unita (PR #162) e applicata su Supabase il 4 novembre con l'ok di Stefano.

## Controllo sicurezza e privacy (3 novembre 2026)

**Contatti dopo 24 mesi** (migrazione **055**, app v85, scelta A per i clienti): Lista, Target e Clienti si cancellano 24
mesi dopo l'ultima cosa fatta sulla persona (inserimento, modifica, passo, ordine); ogni passo fa ripartire il conteggio.
30 giorni prima: «si cancella tra N giorni» nella riga e nella scheda. 055 e **055b** (attività della notte, 02:30 UTC)
applicate su Supabase il 3 novembre con l'ok di Stefano: nessun contatto da cancellare (il più vecchio è del 18 ottobre
2026), la prima cancellazione possibile è a ottobre 2028.

Controllo completo con la skill `sicurezza-privacy-app`: sicurezza a posto; font e libreria Supabase portati nell'app
(niente IP a Google e jsDelivr); informativa con conservazione, fornitori, reclamo al Garante e solo maggiorenni, app v84.
In attesa di Stefano: nomi e contatto dei titolari. Prossimo lavoro: cancellazione dei contatti 24 mesi dopo l'ultimo
passo (decisa). Scelte di Stefano: nessuna informativa extra per la mappa, nessun avviso sulle note.
Dettagli in `SICUREZZA.md`.

## Ripartire da qui (fermi la sera del 28 ottobre 2026)

**Dove siamo** (aggiornato il 30 ottobre): migrazioni applicate su Supabase fino alla **046** (044b, 045 e 046 applicate
dal connettore il 30 ottobre); funzione `invia-notifiche` v2 pubblicata. PR unite fino alla **#137** (import mappe). I 7
codici esteri importati prima della regola «solo Italia» sono stati cancellati dal database il 30 ottobre (su ok di Stefano).
Gruppi A–D del controllo di sicurezza fatti e uniti. **Grafica** (skill frontend-design, una PR per punto, schermate
prima/dopo a 360 px chiaro e scuro nella pagina privata «Growup · grafica prima e dopo» di Stefano): punti **1–5 fatti**
(sotto-linguette scure, colori con significato fisso, colori della profondità, Stabilità della tua rete, filtri di Persone).

**Prossimi passi, in quest'ordine** (tutti già decisi con Stefano):
1. **Grafica 6 · Gruppo**: togliere il pulsante/chip «senza app» ripetuto; pallino grigio = senza app, pallino verde = usa
   l'app; spiegarlo nel «?» di «La mia struttura» insieme al significato dei colori della profondità (1 = tu, bianco; dal 2
   blu, viola, petrolio, rosa, nocciola e si riparte).
2. **Grafica 7 · contrasto e a capo**: testi grigi almeno WCAG AA nei due temi (oggi `--ink3` chiaro `#7a8781` non basta:
   3,74 sulla scheda, 3,38 sul fondo); nessun pulsante va a capo a 360 px, compresa la barra in basso e «Importa da Amway»
   nel Gruppo (e «‹ Settimana prima» nelle abitudini della Guida); il × di «Primi passi» arrotondato come gli altri; ricontrollare
   anche l'ambra delle caselle della Stabilità.
3. **«Da riprendere»** (piano approvato, con le correzioni di Stefano): un contatto già avviato (in corso: fase oltre
   «lista», senza esito) senza passi da 14 giorni, contati dall'ultimo passo, va da solo in «Da riprendere» con la riga ambra;
   i nomi in Lista mai contattati non ci vanno mai e non diventano mai ambra. Toccando la riga ferma compaiono due azioni:
   «Ricordamelo più avanti» (toglie l'avviso, torna dopo 30 giorni) e «Chiudi contatto» (va in Chiusi con l'esito nuovo
   «Chiuso senza risposta», separato dai «No» veri). Quando si chiude un contatto l'app chiede «Vuoi che te lo ricordi tra
   6 mesi?»: se sì, dopo 6 mesi torna in «Da riprendere». Dati: colonna nuova su `persone` (data «ricordamelo dal») e il
   nuovo valore di esito; calcolo nell'app dai passi; all'upline solo i numeri; il riepilogo del mattino può contare i
   contatti fermi senza nomi. Migrazione nuova (il numero 045 è stato usato dall'import mappe) con i controlli in
   `tests_rls.sql` e i test e2e.
4. A parte, per Stefano: il compito suggerito sui campi dei fogli che si svuotano quando l'app ridisegna (render).

**Come si lavora alla grafica**: prima/dopo con la stessa API finta dei test, a 360 px; spiegare in due righe cosa cambia
per i partner prima di ogni PR; `sw.js` va alzato a ogni consegna (ora v60).

## Import delle mappe Amway, seconda revisione (30 ottobre 2026)

Principio di Stefano: **la mappa Amway fa fede**, per struttura e dati; Growup legge e mostra, non corregge niente.
- **Codici esteri** (migrazione **047**): le righe estere si scartano e basta, con qualsiasi import. Tolta la regola della
  045 (il database riceveva i codici esteri per cancellarli o nasconderli): l'app non li manda più e `p_esteri` è
  ignorato. Un codice che esce dalla mappa italiana segue la regola di tutti quelli che escono. App v66.
- **Import diretto e chi importa** (migrazione **048**): niente anteprima, niente spunta del consenso (chi importa è
  upline delle persone della sua mappa), niente scelte «nascondi» durante l'import (le persone nascoste a mano dal Gruppo
  restano). Scelto il file, l'import parte subito; alla fine il foglio mostra il riepilogo (nuove, numeri aggiornati,
  spostati, non più nella mappa, cancellati, mesi precedenti salvati come numeri, file con errori). Chi importa è la riga di
  livello 1 (la prima riga di dati): deve avere il mio codice Amway; senza quella riga, o senza codice nell'app, l'import è
  rifiutato (il codice non si prende più dal file: arriva sempre dall'invito). Nessun blocco sui file parziali: chi esce
  per errore rientra con i suoi dati al prossimo import giusto. App v67.
- **Perimetro** (migrazione **049**): una riga vale solo se, di sponsor in sponsor, risale a chi importa (nel file, o a una
  persona già nella sua downline); le altre si ignorano, nell'app (il riepilogo le conta: «N righe ignorate») e nel
  database. Tolta la vecchia `importa_rete` (018), che l'app non usava più e saltava tutte le regole nuove; i controlli
  in `tests_rls.sql` che la usavano ora usano `importa_mappa`. App v68.
- **Chi esce dalla mappa** (migrazioni **050** e **050b**): con qualsiasi import, chi non compare più nella mappa esce dalla
  struttura e non lo vede più nessuno (`struttura_visibile` e `vedo` lo escludono); se usa l'app, l'app gli si blocca
  (`blocco_mappa`, separato dal blocco dell'admin; schermata «App bloccata»). I dati restano: se ricompare in una mappa
  riprende posto e dati e l'app si sblocca da sola. Dopo 12 mesi fuori (da `fuori_mappa_il`, ora del server) li cancella
  `pulisci_fuori_mappa`, ogni notte alle 02:15 UTC (050b, solo su Supabase), con i telefoni che vedono «accesso tolto».
  Tolta la cancellazione «solo con l'import dell'admin» (046). Chi sta sotto un gruppo che la mappa non mostra (Platino)
  non conta come uscito. App v69.
- **Ordine degli import nello stesso mese** (migrazione **051**): riferimento = data e ora di scaricamento della mappa
  (ultima modifica del file; se manca, l'ora dell'import), salvata con l'ora dell'import (`posizione_importata_il`,
  `numeri_mese.aggiornato_il`). La mappa dell'admin, quando viene caricata, fa sempre fede su tutto; dopo, la mappa di un
  partner aggiorna posizioni e numeri della sua parte solo se scaricata dopo quella in vigore. Il riepilogo dice chi ha
  già i dati di una mappa scaricata dopo. Chi rientra nella mappa ritrova l'app solo se non l'ha bloccata un admin;
  `fuori_mappa_da` registra chi ha segnato una persona fuori. App v70.
- Il 30 ottobre: migrazioni 047–051 (e 050b) applicate su Supabase e PR #138–#142 unite (v70 online).
- **Gruppo di un Platino senza app** (migrazione **052**): Platino «nascosto» = senza app e con le linee nascoste nella
  mappa più recente. Solo l'admin, dalla scheda (Azioni, «Gruppo di un Platino senza app»): «Invita una persona del suo
  gruppo» (entra sotto il Platino) e, dalla scheda di chi usa l'app nel gruppo del Platino, «Inserisci lo sponsor sopra»
  (entra tra lui e il suo sponsor); altrove niente inserimenti in mezzo. Chi entra così (`area_platino`) importa subito la
  sua mappa anche se in attesa: lo conferma e lo mette sotto il suo sponsor vero se è già nel gruppo del Platino. Se il
  Platino usa l'app, la sua mappa rimette tutto a posto. I VP di gruppo del Platino restano quelli ufficiali (nessun
  cumulo, test). App v71.
- **Ritocchi a Persone** (30 ottobre): scorrere di lato i filtri di Lista e Clienti non cambia più pagina e non trascina
  la pagina; nella Lista l'ultimo nome inserito sta in cima e sotto il nome si legge «Come lo conosci». App v72.
- **Scheda partner, «Questo mese e il mese prima»** (30 ottobre): per chi non usa l'app ma è nella mappa del mese, i VP
  personali del mese in corso sono quelli della mappa (prima contavano solo gli ordini scritti a mano: 0). Il «?» spiega la
  colonna centrale («set al 30» = il mese prima fino allo stesso giorno). App v73.
- **«Questo mese e il mese prima» a due colonne** (30 ottobre, scelta di Stefano): tolta la colonna «al giorno» del mese prima
  e il ▼ rosso che ne dipendeva; restano il mese in corso fino a oggi e il totale del mese prima. App v74.
- **Filtri del Gruppo** (30 ottobre, scelte di Stefano): si importa tutta la mappa (sempre solo Italia) e nel Gruppo, sotto
  la ricerca, una riga di filtri con i conteggi: Tutti (l'albero), Con VP, Senza VP, Oltre 200 VP, Nuovi (data di ingresso
  nel mese in corso), Usano l'app, Senza app, Percentuale (dalla più alta). Con un filtro l'albero diventa un elenco con
  livello, numeri e «sotto chi»; la ricerca lavora dentro il filtro; le persone nascoste restano fuori. «Nascondi» resta.
  Frontali no (si vedono chiudendo le linee). Il filtro acceso resta in vista anche in Persone. App v75.
- 30 ottobre: tolti dal database i 111 «nascosto» del profilo di Stefano e Alessia (la scelta «Nascondi chi ha 0 VP»
  del primo import): l'import porta tutta la mappa, si nasconde a mano solo dalla scheda («Nascondi dalla mia struttura»).
- **Ricerca nel Gruppo** (scelta C di Stefano): compaiono solo le persone trovate, senza rientro e senza frecce; sotto ognuna
  «Linea di <frontale> › … › <sponsor> (sponsor)» («Tuo frontale» per il livello 2); toccando «…» si apre il percorso
  intero. Il percorso si aggiunge solo durante la ricerca (nessun ridisegno: il campo resta com'è). App v76.
- **«Chiudi ▴» nel percorso** (2 novembre): il percorso intero aperto con «…» si richiude e torna come prima. Reso il test dei
  pagamenti indipendente dalla data (usava luglio 2026 fisso). App v77.
- **Cerchie nella Lista** (2 novembre, migrazione **053**): in Persone → Lista si creano gruppi di nomi («Cerchie»: palestra,
  colleghi, famiglia…). Una persona può stare in più cerchie. Seconda riga di filtri sotto gli stati, combinabile (es.
  Aperti + Palestra); ritoccando la cerchia scelta si torna a tutta la lista. Dentro una cerchia: «Aggiungi nomi» (spunte),
  «Rinomina», «Elimina» (le persone restano). Le cerchie si scelgono anche in «+ Nome» (già spuntata quella aperta), nella
  modifica dei dati (toglierla la fa uscire) e in «Importa». La scheda dice «Cerchie: …». Solo del proprietario, come la
  Lista: l'upline non le vede. App v78.
- **Cerchie nei Clienti** (2 novembre, migrazione **054**): stessa cosa in Persone → Clienti (es. Bellezza, Casa,
  Nutrizione), con cerchie **separate** da quelle della Lista (scelta di Stefano): ogni cerchia ha un tipo, `lista` o
  `clienti`, fisso; il nome è unico per tipo. «Aggiungi clienti», «+ Cliente» con la cerchia aperta già spuntata, la scheda
  del cliente mostra le sue cerchie dei Clienti. Un cliente che veniva dalla Lista tiene le sue cerchie della Lista (non si
  vedono nei Clienti). Niente cerchie già pronte al primo uso (Stefano: no). App v79.
- **Cerchie, ritocco** (2 novembre, dopo la prova di Stefano): la cerchia appena creata non si accende più da sola (si
  vedevano solo zeri e non si trovava la lista). Dopo la creazione si apre «Aggiungi nomi» e poi si torna alla lista
  completa; la cerchia filtra solo quando la si tocca. Primo pulsante della riga: «Tutti i nomi» («Tutti i clienti»).
  Una cerchia scelta vuota lo dice, con «Aggiungi nomi» e «Mostra tutta la lista». App v80.
- **Lista: «Tutti» al posto di «Aperti»** (2 novembre, Stefano: «Aperti» = In lista + In corso, non serviva). La Lista si
  apre su «Tutti» (anche Da riprendere e Chiusi); filtri: Tutti, In lista, In corso, Da riprendere, Chiusi. App v81.
- **Lista: tolto «Tutti i nomi»** dalla riga delle cerchie (Stefano: doppione di «Tutti»); da una cerchia si torna
  ritoccandola. Nei Clienti «Tutti i clienti» resta (compare quando c'è almeno una cerchia dei clienti). App v82.

## Import delle mappe Amway (29 ottobre 2026, una PR per punto)

Regole decise da Stefano: si salvano solo le righe con Paese = Italia (le altre si scartano e i codici esteri già
salvati si cancellano con i loro dati); funzionano entrambi gli export (17 colonne «KPI selezionati» e 26 «tutti i KPI»),
colonne riconosciute dal nome, «Sponsorizzazione» ignorata; telefono, email e indirizzo della mappa mai salvati;
rifà la struttura solo la mappa con il «Mese di competenza» più recente, una mappa di un mese precedente salva solo i
numeri di quel mese; un italiano che esce dalla mappa resta nascosto e si cancella dopo 12 mesi.
- **Punto 6 · livello di profondità**: «Qualifica Amway Partner» contiene il livello (1 = chi ha scaricato il file), non
  la qualifica: serve solo a trovare la riga di chi importa, non si salva. Verificato con un test (riga 1 in fondo al file). App v61.
- **Punto 3 · privacy** (migrazione **044b**): dalla mappa si leggono solo codice, nome, sponsor, **data di ingresso**, VPP,
  VPG, percentuale, dimensioni del gruppo e livello; telefono, email, indirizzo e data di rinnovo non arrivano mai al
  database (test sui dati inviati, anche per i mesi chiusi; scritto nel foglio dell'import). La data di ingresso della
  mappa fa fede: va in `partners.data_iscrizione` per tutti (anche chi importa e chi usa l'app); una data non valida o
  fuori dal 2000-oggi si ignora. Nel database: `partners.email` esiste dal primo schema ma è vuota e l'app non
  la usa; `persone.contatto` viene da Lista e Clienti, non dalla mappa. App v62.
- **Punto 2 · i due formati**: funzionano l'export «KPI selezionati» (17 colonne) e «tutti i KPI» (26), colonne trovate per
  nome in qualsiasi ordine; obbligatorie codice, sponsor, nome e VPP (altrimenti il messaggio dice quale manca);
  «Sponsorizzazione» non si legge; «Utente riservato/non visualizzabile» entra come «Utente riservato». Senza «Dimensioni
  gruppo» (17 colonne) chi non ha nessuno sotto nel file può nascondere un gruppo: chi sta sotto di lui non va «fuori dal
  report». Test: stesse persone nei due formati → al database arrivano esattamente gli stessi dati. App v63.
- **Punto 1 · solo Italia** (migrazione **045**, da applicare): colonna «Paese» obbligatoria; si tengono solo le righe
  «Italia»; delle estere l'app tiene solo il codice e lo manda a `importa_mappa`, che cancella con tutti i dati i codici
  esteri già importati (solo persone senza app nella downline di chi importa, e solo se importa un admin: per gli altri
  restano nascosti e segnati, perché i codici arrivano dal telefono e non si possono verificare). L'import si ferma se un italiano ha come
  sponsor un codice estero presente nel file, o se la riga 1 è estera; lo sponsor della prima riga (fuori dal file) va
  bene. Anteprima: «N persone nel file (più M di altri Paesi, che non si salvano)» e la sezione «Di altri Paesi · si
  cancellano». App v64.
- **Punto 4 · ogni mappa sostituisce la precedente** (migrazione **046**, da applicare dopo la 045): decide il «Mese di
  competenza» del file, non la data del file né il giorno dell'import. `partners.mappa_mese` = mese della mappa che ha messo
  ognuno al suo posto: una mappa dello stesso mese o più recente rifà sempre struttura, VP e percentuali; una di un mese
  precedente salva solo i numeri di quel mese (servono a Stabilità e mesi da Argento). L'app rilegge il proprio
  `mappa_mese` prima di leggere i file (la upline può aver importato da poco); con più file insieme rifà la struttura il
  mese più recente. Chi esce dalla mappa resta nascosto («non più nel report») e se ricompare riprende i suoi dati; dopo 12
  mesi fuori si cancella con i suoi dati (solo con l'import di un admin; anteprima «Fuori dalla mappa da 12 mesi · si
  cancellano»). «Utente riservato» prende il nome vero quando il file lo mostra. Lista, obiettivi, inviti e «perché» di
  chi usa l'app non si toccano. Attenzione, scelta di Stefano: con più importatori nello stesso mese vince l'ultimo file
  importato, anche se scaricato prima. App v65.

## Fermi la sera del 21 ottobre 2026

**Dove siamo**: Target, Lista e Clienti sono dentro Growup (pagina Persone), con conferma dal report Amway, blocco
dell'app da admin e listino Amway nel database. Migrazioni applicate su Supabase fino alla **037** (027 e la parte 2 della 033 — `togli_dalla_struttura` e `importa_mappa` —
incollate da Stefano nell'SQL Editor; 028b: permesso sul codice del listino). PR unite fino alla **#105**, nessuna aperta; il ramo di
lavoro è ricreato da main. Il listino di aprile 2026 è caricato da Stefano dal PDF: funziona.

**Il 21 ottobre in breve** (dettagli sotto): «Come arrivarci» (consigli a richiesta in Obiettivo e nella scheda partner,
anche da Argento a Platino) · qualifiche oltre Argento fino a Diamante Fondatore, prossima qualifica da Platino in su,
Volume Rubino · percorso Argento → Oro → Platino contato sui mesi al 21% dei report mappe, con l'import "solo numeri" dei
report dei mesi chiusi e Platino riconosciuto dall'app.

**22 ottobre — «La tua qualifica oggi» e i mesi del Performance Year**: l'etichetta del menu della qualifica è ora «La tua
qualifica oggi» (Stefano e Alessia: stati Smeraldo, oggi Platino Fondatore → dichiarano Platino Fondatore). Da Platino in su,
in Obiettivo sotto la prossima qualifica: righe con i mesi del Performance Year (da settembre) dai report importati —
Platino Fondatore (mesi da Argento su 12), Rubino Fondatore (mesi Rubino su 12), Zaffiro (mesi Zaffiro su 6/12:
4.000 VPG e 2 linee al 21%, o 3 linee al 21%), Smeraldo (linee al 21% da almeno 6/12 mesi su 3), Diamante (su 6) — più
«Report importati da settembre» e la tabellina «Le tue linee nel Performance Year» (mesi al 21% per frontale). In Io una
riga breve. «Come arrivarci» da Platino in su: non ancora (servono testi).

**22 ottobre — più report insieme**: nella scelta del file del report mappe si possono selezionare più file. I mesi chiusi
si salvano "solo numeri" uno dopo l'altro (anteprima con % e VPG di ogni mese); se c'è anche il mese in corso, dopo si
apre il suo import completo con l'anteprima di sempre; i file sbagliati sono elencati e non fermano gli altri.

**22 ottobre — la cifra porta oltre Argento** (cifre di Stefano dal calcolatore dei guadagni Amway, migrazione 032):
Argento **2.500 €** al mese senza incentivi Bronze (circa 3.750 € se ci si arriva mentre si ricevono ancora) · Platino
3.000 · Rubino 4.000 · Zaffiro 5.000 · Smeraldo 8.000 · Diamante 18.000; i Fondatori hanno la stessa cifra della loro
qualifica e **come obiettivo si propone sempre la qualifica senza "Fondatore"**; Oro si salta. Strutture: linee
qualificate della qualifica più altre linee aperte (ideale 10.000 VP, almeno 4.000 VP). Esempio: 9% e 8.000 € → Smeraldo.
Arrivati a Platino, nella domanda della prossima qualifica è già scelta quella dell'obiettivo. La guida «Guadagnare
con Amway» PY25 è stata letta e scartata (vecchia, solo esempi Fondatori, non coerente).

**23 ottobre — una sola struttura, la mappa Amway** (migrazione 033; decisioni di Stefano): la struttura di Growup è sempre
la copia della mappa ufficiale. Ogni import aggiorna posizioni e numeri di **tutto il gruppo** di chi importa (anche chi usa
l'app, anche se qualcuno sotto aveva già importato). **Vince il report più aggiornato**: il CSV ha solo il mese, quindi conta la
**data e ora del file** scaricato; un file più vecchio non cambia niente di quello che viene da file più recenti (l'anteprima
lo dice). Numeri ufficiali condivisi (`numeri_mese`): li vede la persona e tutta la sua upline (anche quelli importati da un
Platino in downline). Persone senza app: una sola copia, visibile a tutta la upline. **I VP del report vincono** su quelli
scritti a mano ovunque (Io, Obiettivo, gruppo); prima del report contano gli ordini. Chi non è ancora nella mappa è **in attesa**:
usa l'app ma i suoi dati restano suoi, l'upline lo vede solo per nome in «In attesa della mappa»; lo toglie **solo lo sponsor
diretto** (o l'admin); non può importare. Le parti che il report non mostra (gruppo sotto un Platino) non si toccano.

**23 ottobre — i miei ordini restano miei, e la bozza d'ordine** (migrazione 034; decisioni di Stefano dalla tavola «Bozza
ordine e VP»): il partner può sempre scrivere i suoi ordini e correggere il totale, ma **lo vede solo lui**. Sponsor e upline
vedono **solo i numeri del report** Amway, anche nei mesi senza report (lì vedono zero); la RLS non fa leggere a nessun altro gli
ordini e le correzioni di chi ha l'app. Chi non ha l'app resta com'è (valgono i VP scritti da chi lo segue finché non c'è un
report). Per me: **VPP del report + gli ordini scritti da me dopo la data e ora del file**; con un report nuovo il totale torna
al dato ufficiale. Su Io la barra mostra in verde il report e in rame gli ordini scritti dopo, con la riga che lo spiega. Nel
Gruppo i VP di chi ha l'app vengono dal report (preferiti, etichette, confronto col mese prima senza la riga «Ordini»).
Nuove sezioni su Io: **Bozza ordine** (prodotti dal listino; per ogni prodotto e nel totale VP, prezzo Partner e prezzo al
pubblico; una sola bozza, salvata nel database, solo mia) e **I miei ordini** (storico; «Rifai» copia i prodotti in una nuova
bozza; «×» toglie l'ordine dopo la conferma e i suoi VP escono dal mese). Bozza e storico non entrano nella copia dei dati
(come Liste e Clienti, gli admin non li vedono). Idea per il team (fuori dall'app): ogni Platino importa il report una volta a
settimana, così il Gruppo è aggiornato. Stefano conferma: dopo un report contano solo gli ordini scritti dal partner stesso
(quelli scritti da chi lo seguiva prima che entrasse nell'app restano al report). **Prezzi e VP di prodotti e ordini con due
decimali** (96,30 € · 18,20 VP) in bozza, storico, clienti e listino; cifre degli obiettivi e totali del mese come prima.

**27 ottobre — Ottimizzazione 1 di 3: «Il mio giorno» e Ordini** (tavola «Il mio giorno e Ordini», scelte di Stefano;
solo interfaccia, nessuna migrazione, annullabile con «Revert» della PR). «Il mio giorno» in tre blocchi fissi:
**«Da fare oggi»** (solo con il Seguimi attivo: le azioni del Seguimi, sotto «Anche da sentire» con gli altri follow-up in
ritardo o di oggi e i clienti da sentire senza doppioni, e la riga «Altri N in corso nella Lista ›»; senza Seguimi restano i
due riquadri di prima, «Il tuo percorso con la lista» e «I tuoi clienti da sentire») · **«I miei numeri»** (riga
dell'obiettivo, riga della tappa che si apre su requisiti/linee/note, settimana e mese in un solo riquadro) · **«Diario di
oggi»** chiuso di base. **«+ Ordine»** nella barra in basso apre il foglio **«Ordini»**: Ordine veloce · Bozza ordine · I miei
ordini · Aggiorna il totale del mese · Ordini dal sito Amway (lo stesso import di Clienti, che resta anche lì; bozza e storico non sono più nella pagina Io). «Importa dal report Amway» solo in Gruppo;
in Io un promemoria se ho un gruppo, ho già importato e l'ultimo report ha più di 7 giorni. Prossime: PR 2 (C+D, «Primi
passi» con «Scrivi 30 nomi», spiegazioni a richiesta con «?») e PR 3 (E+F+G, Profilo, scheda partner a schede, parole
uniche), ognuna con la sua tavola prima del codice.

**27 ottobre — Ottimizzazione 2 di 3: «Primi passi» e spiegazioni a richiesta** (tavola «Primi passi e spiegazioni»,
scelte di Stefano; solo interfaccia). In cima a Io un solo riquadro **«Primi passi»** al posto di «Salva il link», «Installa
l'app», «Scrivi il tuo obiettivo» e «In attesa della mappa»: voci con ✓, contatore «N su M» e barra; ogni voce si apre lì
sotto (link personale aperto finché non è salvato; installa solo dal telefono, «Non ora» la segna fatta; obiettivo; **Scrivi
30 nomi nella tua Lista** con «12 / 30» e la frase «Senza decidere tu…»; primo import solo per chi ha persone sotto);
«In attesa della mappa» è una riga con «?». Sparisce a tutto fatto; la **×** lo nasconde su quel telefono (non finché il
link non è salvato). Le spiegazioni lunghe di Lista, Clienti, Target, Struttura, Preferiti, In attesa, Storico del gruppo,
scheda partner e Guida sono dietro un **«?»** accanto al titolo; restano visibili note sui guadagni, avvisi prima di
cancellare o bloccare, istruzioni dei fogli. Prossima: PR 3 (Profilo, scheda partner a schede, parole uniche).

**27 ottobre — Il mese da Argento con la linea al 21%** (migrazione 038, regola di Stefano): un mese al 21% conta come
mese da Argento solo senza linee al 21%, con 2 o più linee al 21%, o con una linea al 21% e almeno **4.000 VP di gruppo
rimanenti** fuori da quella linea; altrimenti è solo «21%». Vale per i mesi verso Oro e Platino, il Performance Year e
«Come arrivarci» (il consiglio «linea al 21%» ora conta i VP fuori dalla linea). Nuova funzione `mesi_qualifica`
(al posto di `mesi_report` nell'app). Glossario da correggere nella PR 3: Oro e Platino la prima volta sui 12 mesi dal
primo mese da Argento, poi sull'anno fiscale.

**27 ottobre — Ottimizzazione 3 di 3: Profilo, scheda partner e parole uniche** (tavola «Profilo e scheda partner»,
scelte di Stefano; solo interfaccia). L'**omino in alto a destra** apre «Il mio profilo»: nome, codice d'invito, codice
Amway, punto di partenza, link personale, «Installa l'app» e «Mostra di nuovo i Primi passi» quando servono, **Parole
dell'app** (glossario, con «Mese da Argento» e «Anno fiscale» corretti da Stefano), privacy, Esci e, solo per gli admin, la
sezione **Admin** (copia dei dati, listino, codici Amway tolti, Correggi). Il fondo delle pagine non c'è più. La **scheda
partner** ha due schede: **Numeri** (si apre sempre qui: numeri, linee, Come arrivarci, confronto, Analisi come pulsante,
Seguimi) e **Azioni** (chiamata, numeri da aggiornare, accesso, inviti, struttura, blocco). «VP fatturati» → **«VP
personali»**.

**28 ottobre — Grafica, punto 5 di 7: Persone** (scelte di Stefano): i filtri di Lista e Clienti stanno su una riga sola
che scorre di lato; i pulsanti in alto non vanno mai a capo e si accorciano in «Importa» e «+ Nome» (Lista), «Importa» e
«+ Cliente» (Clienti). Tolto anche il margine in più che spostava le righe di pulsanti con la classe `wrap` (anche nei
filtri dell'import). App v60.

**28 ottobre — Grafica, punto 4 di 7: Stabilità della tua rete** (migrazione 044, decisioni di Stefano): la scheda riproduce
la tabella «Verifica la tua attività - Stabilità» di Cum Laude 21. La percentuale si raggiunge solo con il fatturato; i numeri
della tabella servono a sostenerla nel tempo. I riferimenti stanno nelle impostazioni (`stabilita_cl21`). Mese di riferimento:
l'ultimo mese chiuso con la mappa importata (chi non ne ha guarda il mese in corso), scritto in evidenza; se manca la mappa del
mese appena chiuso, l'avviso «Importa la mappa di … per aggiornare». In cima «Livello raggiunto» (dal fatturato del mese) e
«La tua rete reale» (il livello più alto sostenuto in tutte le righe, altrimenti «in costruzione»); un numero non ancora inserito resta
neutro con «da inserire» e fuori da «Su cosa lavorare» («ne servono M per sostenere il X%»); per riga il numero e
le sette caselle (verde ✓ sostenuto, ambra ! raggiunto ma non sostenuto, neutro sopra, con ✓ se il numero c'è già),
«Questo mese finora» per nuovi iscritti e codici oltre 200 VP (il partner più la sua rete, solo dalle mappe: senza una mappa
del mese «disponibile dopo l'import della mappa», con `con_mappa` in `guida_conteggi`);
in fondo «Su cosa lavorare». Training Day e Convention: l'ultimo evento, scritto a mano. Tutti i numeri nel carattere del
testo. App v59.

**28 ottobre — Grafica, punto 3 di 7: colori della profondità** (palette approvata da Stefano): nel Gruppo il livello 1
(chi guarda) è bianco e non si ripete; dal 2 il ciclo blu, viola, petrolio, rosa, nocciola, poi si riparte. La numerazione
era già relativa a chi guarda. Il test del foglio «Invita» riscrive i campi se un ridisegno li svuota. App v58.

**28 ottobre — Grafica, punto 2 di 7: colori con significato fisso** (scelte di Stefano): pesca = selezione e azione
principale (pulsanti principali, scelte, filtri; i tre pulsanti in basso tutti pesca con icona persona/calendario/carrello,
«416,83 VP · mese» su una riga); verde = fatto e progresso (barre anche di Primi passi, puntini della Lista, tappa attuale,
mesi importati); ambra/terracotta solo per l'attenzione; etichette di sezione in grigio. Variabili `--scelta`, `--progresso`
(GRAFICA.md). App v57.

**28 ottobre — Grafica, punto 1 di 7: sotto-linguette nel tema scuro** (richiesta di Stefano, con la skill frontend-design,
stessa identità e colori): la sotto-linguetta scelta (Il mio giorno/Guida, Target/Lista/Clienti) nel tema scuro è chiara e
piena (avorio, testo smeraldo) come nel chiaro, non più scura delle altre. Variabili `--linguetta` e `--linguetta-ink`.
Schermate prima/dopo nella pagina privata «Growup · grafica prima e dopo». Seguono i punti 2-7 (colori con significato,
profondità, Stabilità, Persone, Gruppo, contrasto e a capo), una PR ciascuno. App v56.

**28 ottobre — Admin nel proprio gruppo e ritocchi** (gruppo D, migrazione **043** e Edge Function `invia-notifiche`
aggiornata, da applicare/pubblicare dopo l'unione): nuovo link personale, blocco, «Togli» e codici tolti solo nel gruppo
dell'admin; impostazioni, tappe e livelli solo con un profilo (l'ingresso riceve le qualifiche con l'invito); il punto di
partenza solo da «Modifica punto di partenza» (punto 6); notifiche solo dai servizi ufficiali e prova al massimo una al
minuto e 10 al giorno; indici sulle chiavi esterne e regole di accesso più veloci; `inizio_py` con search_path fisso.
pg_net resta in public (spostarlo è rischioso e non serve). App v55. Resta il gruppo E (grafica, sessione a parte).

**28 ottobre — Copia di sicurezza e «in attesa»** (gruppo C, migrazione **042**, da applicare su Supabase dopo l'unione):
dalla copia di sicurezza escono il «perché» dell'obiettivo, le email e l'impronta delle chiavi d'accesso; gli ordini e le
correzioni scritti a mano restano (scelta di Stefano: servono a ripristinare). Di chi è in attesa della mappa l'upline
riceve solo il nome; l'anteprima dell'import lo riconosce chiedendo al database (`attesa_nel_report`) chi è nel report
che si sta importando. La 041 è stata applicata per intero al secondo tentativo (al primo si era fermata dopo la tabella).
App v54. 042 applicata su Supabase. Poi **042b** (da applicare): al massimo 30 richieste e 20.000 codici al giorno
per `attesa_nel_report`, una alla volta, perché senza limite si potevano provare codici a caso (revisione automatica).

**28 ottobre — Si entra solo su invito** (gruppo B, migrazione **041**, decisioni di Stefano; **da applicare su Supabase
subito dopo l'unione della PR**): niente più link d'invito generico. In Gruppo la voce **«Invita»**: chi è già nella mappa
(o un admin) scrive nome e codice Amway del nuovo partner e ottiene un link con solo un codice casuale, che vale una volta
e 7 giorni; nella lista «I tuoi inviti» lo annulla o crea un nuovo link. Chi entra sceglie solo qualifica e data (nome e
codice li ha scritti chi invita). Se il codice è già nella mappa l'invito lo crea solo chi sta sopra quella persona, e chi
entra prende subito il suo posto; altrimenti resta «in attesa» sotto chi l'ha invitato finché un import di chi l'ha
invitato o della sua upline non lo mette sotto il suo sponsor vero (`importa_mappa` non cambia). Notifiche senza nomi
(`notifiche_eventi`, al giro dei 15 minuti): a chi ha invitato quando il nuovo entra e quando va al suo posto; allo
sponsor vero, se è un altro e usa l'app. Spariscono l'«invito sopra» e il link personale per chi non è mai entrato.
Dalla Lista, chi ha detto sì come partner ha «Invitalo in Growup» (apre Invita con il nome). Test: permessi (anche sul
riuso, la scadenza, l'annullo, la rigenerazione, gli avvisi) e interfaccia (593 controlli). App v53.

**28 ottobre — Controllo completo e test affidabili** (gruppo A di 4, richiesta di Stefano dopo il controllo di sicurezza,
RLS e interfaccia): i test del database si lanciano con `sh test/db.sh` e **si fermano al primo errore**. Prima, se
l'installazione si fermava a metà (a `stub_supabase.sql` mancava il ruolo `service_role`, quindi tutto dalla 039 in poi
non veniva installato) l'ultima riga di `tests_rls.sql` diceva comunque «TUTTI I CONTROLLI SUPERATI». Ora quella riga
lo dice solo se i controlli sono arrivati in fondo, e lo script controlla che ogni tabella e funzione esista. Il test
dell'interfaccia conta come errore anche un file dell'app che non arriva (404) e, se si blocca, dice perché.
Prossimi gruppi, una PR ciascuno: B) entrare solo con un invito personale (fatto, sopra); C) copia di sicurezza e «in attesa» (fatto, sopra);
D) poteri da admin nel proprio gruppo, tabelle di impostazioni solo con profilo, notifiche di prova, ritocchi tecnici (fatto, sopra);
E) grafica, in una sessione a parte.

**28 ottobre — «Prossima cosa» con la ×** (Stefano, dopo aver provato l'avviso: arriva giusto e apre la scheda): nella scheda della persona una × accanto alla prossima cosa toglie giorno, ora e nota (e quindi anche l'avviso non ancora suonato). App v52.

**28 ottobre — Notifiche, parte 2** (migrazione 040, già applicata): nel prossimo passo, accanto al giorno, l'**ora
facoltativa**; con l'ora arriva un avviso **30 minuti prima** («Growup · alle 18:30 — Hai un passo da fare con una persona
della tua Lista», o «con un tuo cliente»), senza nomi; il tocco apre la sua scheda (`?persona=<id>`). L'ora si vede con il
giorno nella scheda, nella Lista e in Io. App v51.

**28 ottobre — Icona delle notifiche**: nella barra in alto di Android la notifica mostrava un quadratino bianco; ora c'è la sagoma del logo (la «G» con la freccia, `badge-96.png`, bianca su trasparente). Notifiche provate da Stefano: funzionano. App v50.

**28 ottobre — Notifiche, parte 1** (migrazioni 039 e 039b, Edge Function `invia-notifiche`; tavola «Notifiche di Growup»;
costi: zero sul piano gratuito, anche con centinaia di utenti). La domanda «Vuoi un promemoria ogni mattina?» compare una
volta sola per telefono; nel Profilo l'interruttore «Notifiche su questo telefono» e «Manda una notifica di prova». Ogni
mattina alle 8:30 (ora italiana) un riepilogo senza nomi, solo se c'è qualcosa: persone da risentire, clienti da sentire,
azioni del Seguimi, VP mancanti (ultimi 5 giorni del mese), report mappe più vecchio di 7 giorni, chiusura del mese. L'app
salva per i prossimi 14 giorni solo i numeri; il server invia ogni 15 minuti (pg_cron). Chiavi e segreto generati e custoditi
da Supabase. iPhone: solo con l'app sulla Home (iOS 16.4+). Prossimo: parte 2, l'ora del prossimo passo e l'avviso 30 minuti
prima. App v49.

**28 ottobre — «Glossario»**: nel Profilo la voce «Parole dell'app» si chiama ora «Glossario» (Stefano). App v48.

**28 ottobre — Spiegazioni del «?» più chiare** (richiesta di Stefano dal telefono): riscritti tutti i testi dei «?» (cosa
vedi, da dove vengono i numeri, cosa puoi fare), per esempio «Il tuo piano» spiega i numeri di base (1 sì ogni 5 piani,
1 piano ogni 2-3 contatti) e che con 10 piani nella Lista l'app usa i propri; «Le tue abitudini» si apre in alto come gli
altri, non più in fondo. App v47.

**28 ottobre — Import più veloce: un solo «Importa da Amway»** (scelte di Stefano). Automatizzare del tutto non si può:
Amway non ha API né invio dei report per email, l'export sul sito è a richiesta (si chiede, si aspetta «Pronto», si
scarica), una web app non può leggere il sito Amway né la cartella Download del telefono (regole di sicurezza dei browser),
e un programma con la password Amway è escluso (sicurezza, regole Amway). Scartati anche «Condividi → Growup» (vantaggio
minimo) e un'estensione per Firefox su Android (da valutare solo se servirà). Fatto: **un solo pulsante «Importa da
Amway»** (Gruppo, promemoria in Io, «Report da importare», foglio «Ordini», Clienti, Primi passi) che apre subito la scelta
dei file; si scelgono insieme mappa, ordini e clienti, l'app riconosce quale è quale (`tipoFileAmway`), importa prima la
mappa e poi apre da sola l'import di ordini e clienti; i file non riconosciuti sono segnalati con il nome. Scorciatoia
sull'icona su Android (pressione lunga → «Importa da Amway», `?importa=1`). App v46, E2E 568 controlli.

**Dove siamo arrivati (27 ottobre, sera — si riprende il 28)**: tutte le PR sono unite fino alla **#112**, nessuna aperta;
il ramo di lavoro è ricreato da main. Migrazioni applicate su Supabase fino alla **038** (`mesi_qualifica`, mese da Argento con
la linea al 21%). App **v45** (service worker `growup-team-v45`). Fatti oggi, in ordine: PR #107 «Il mio giorno» in tre
blocchi e foglio «Ordini» · #108 «Ordini dal sito Amway» nel foglio · #109 correzione: «Ordine veloce» apriva l'ordine di un
cliente · #110 «Primi passi» (30 nomi) e spiegazioni con «?» · #111 regola del mese da Argento (4.000 VP rimanenti fuori dalla
linea al 21%; sui dati reali 1 mese su 5 al 21% non è più da Argento) · #112 Profilo dall'omino, scheda partner in Numeri e
Azioni, «VP personali», glossario. E2E: **565 controlli**; test RLS: tutti superati. Tavole su claude.ai: «Il mio giorno e
Ordini», «Primi passi e spiegazioni», «Profilo e scheda partner». Lasciato com'è per scelta di Stefano: «I miei ordini» solo
con gli ordini dalla Bozza (gli ordini importati stanno nella scheda di ogni cliente), nessun avviso tra Ordine veloce e
bozza aperta. Lavori possibili dopo, da scegliere con
Stefano: **notifiche vere** (un avviso al giorno, testo senza nomi: persone da risentire, Seguimi, clienti, scadenze; prove su
Android e sull'iPhone di Alessia); **«Come arrivarci» da Platino in su** (Rubino, Zaffiro, Smeraldo, Diamante; prima il foglio
di revisione); la **fase di prova** con 2-3 leader (messaggio d'invito, primo ingresso, primo import, riscontri dopo una
settimana). Pagina di riepilogo per i partner: «Da dove arrivano i dati di Growup» (artifact e PDF mandati a Stefano).

**Aperto, in attesa di Stefano**:
- Provare dal vivo la **v45** sul telefono: «Il mio giorno» (Da fare oggi con il Seguimi, I miei numeri con la tappa che si
  apre, Diario chiuso), foglio «Ordini» (5 scelte), «Primi passi» e la ×, i «?», l'omino e il Profilo (sezione Admin), la
  scheda partner con Numeri e Azioni, il conteggio dei mesi da Argento dopo la regola 038.
- Controllare sul sito Amway che la **%** delle linee frontali nei report importati sia quella giusta (serve a «Come arrivarci»
  da Argento a Platino).
- Provare dal vivo (app v40): bozza ordine → conferma → VP solo nella propria app (l'upline non li vede), «Rifai» e «×»,
  reimport di un report più nuovo che riporta il totale al report, due decimali, un nuovo partner che entra con il link e il
  codice (in attesa → al posto giusto con il primo import).
- Verifica in due passaggi su GitHub: controllare in github.com/settings/security.
- **Copie di sicurezza**: vedi la voce del 21 ottobre più sotto (la copia dall'app non contiene Liste e Clienti).

**24 ottobre — decisioni di Stefano**: il **Volume Rubino** non serve (è il VPG senza le linee qualificate 21%, con la regola
dell'anno fiscale): si conta sempre il **VPG delle mappe**. Report dei mesi passati importati da settembre. Niente pulsante
«Invitala nell'app»: si condivide il proprio link e l'import mette ognuno al posto giusto. Al primo ingresso il codice Amway
si scrive **due volte** («Riscrivi il codice»: se non sono uguali non si entra) con l'avviso di controllarlo bene (si trova sul sito o nell'app Amway, nell'icona del profilo in alto a destra). Ogni mese
copia dei dati e ZIP del codice; il piano Pro di Supabase si valuta **all'inizio della prova** con i Partner.

**27 ottobre — Analisi della persona** (migrazione 037; tavola «Analisi della persona» v3, decisioni di Stefano): pagina a
parte, aperta solo a richiesta, di sé («La mia analisi» nella Guida) e di chi è nel proprio gruppo («Analisi di …» nella
scheda partner). Anno fiscale (da settembre), dai report: riepilogo (mesi con il report, mesi al 21%, VP di gruppo medio, linea
più forte); **andamento delle linee** con nome, VP di gruppo e percentuale mese per mese, **senza calcoli** (niente
differenziale), peso sul gruppo, mesi al 21%, tendenza (ultimi 3 mesi sui 3 prima: oltre +10% in crescita, oltre −10% in calo,
altrimenti stabile); **Stabilità Cum Laude 21 mese per mese** (nuovi iscritti con il link, nuovi nel gruppo, codici oltre 200 VP,
con la soglia del livello del mese; da ottobre 2026) e i numeri scritti a mano. **Un solo interruttore** nella Guida, «Condividi
i tuoi dati con il tuo sponsor e la tua upline» (spento di base, indipendente dal Seguimi): acceso, l'upline vede i numeri del
Seguimi, i numeri scritti a mano e le abitudini; mai i nomi, e i VP restano sempre quelli dei report. Senza interruttore
l'upline vede solo struttura, numeri dei report, obiettivo (cifra e data), prossima qualifica, contatti e piani della
settimana con i suoi obiettivi, i numeri della Lista e l'ultimo aggiornamento.

**26 ottobre — usabilità** (richieste di Stefano): **indietro con il dito**: tra le pagine principali il dito scorre come
prima; chi arriva in una schermata da un collegamento (Lista o Gruppo dalla Guida, una persona da «Oggi per te» o da Io, una
scheda partner) trascinando verso destra torna dove era partito, allo stesso punto della pagina. **Barra fissa in alto**:
le pagine (Obiettivo · Io · Persone · Gruppo) e i pulsanti della sezione (Il mio giorno · Guida, Target · Lista · Clienti)
restano visibili scorrendo; il titolo con il nome scorre via. **Guida**: formazione e chiamata con lo sponsor si spuntano
anche nelle settimane prima («‹ Settimana prima», fino a 8 settimane; mai nel futuro).

**26 ottobre — Seguimi giorno per giorno** (migrazione 036; tavola «Seguimi giorno per giorno» v2): in fondo alla Guida due
interruttori, «Seguimi giorno per giorno» e «Fai vedere al tuo sponsor e alla tua upline cosa fai» (spento di base). Chi lo
attiva trova in cima a «Il mio giorno» **«Oggi per te»**: le azioni del giorno fissate al primo accesso (al massimo 3 contatti
dai primi «In lista», follow-up e piani da risentire oggi o in ritardo, clienti da sentire, i VP che mancano all'obiettivo del
mese, la formazione e la chiamata con lo sponsor se non ancora fatta nella settimana). Si spuntano da sole quando si segna il
passo o l'ordine; formazione e sponsor a mano. Sotto: «Oggi: N su M fatte» e i giorni di fila con almeno metà delle azioni.
Se il partner condivide, nella sua scheda sponsor e upline vedono la settimana **solo con i numeri**, mai i nomi; se no niente.
Niente pulsante «Ricordamelo» (deciso da Stefano). **Notifiche vere (da fare più avanti)**: Web Push (permesso sul telefono;
su iPhone solo con l'app installata e iOS 16.4+), chiavi VAPID (la privata solo su Supabase), tabella degli indirizzi di
notifica, funzione su Supabase con orario programmato; un solo avviso al giorno, testo generico senza nomi; si potranno
usare anche per le persone da risentire (date della Lista), appuntamenti, clienti da sentire, scadenze del mese.

**26 ottobre — la Guida per l'azione** (migrazione 035; tavola «Guida per l'azione» v4, decisioni di Stefano): in cima a Io
due pulsanti, «Il mio giorno» (la pagina di sempre, senza consigli) e «Guida». La Guida ha: **il tuo piano** (dalla cifra e
dalla tappa dell'obiettivo a quanto manca, e in attività: piani e contatti per un sì, con i rapporti della Lista dopo 10 piani,
altrimenti di base 1 piano ogni 2-3 contatti e 1 sì ogni 5 piani); la tabella **Stabilità di Cum Laude 21** (livello del mese e
successivo; i miei nuovi iscritti = entrati con il mio link nel mese, anche se poi vanno in profondità; nuovi nel gruppo = codici
nuovi nella mappa solo dal secondo import di chi importa; codici oltre 200 VP dai report; codici nell'app CumLaude21, al Training
Day e alla Convention scritti dal partner, restano finché non li cambia); **cosa fare adesso** (i passi della tappa, testi di
Stefano); **le abitudini** della settimana (contatti, piani e follow-up dalla Lista; formazione e chiamata con lo sponsor con
obiettivo scelto dal partner e spunta per giorno; eventi e audio: «apri l'app CumLaude21»). Obiettivi, spunte e numeri scritti
sono solo del partner. **Procedura d'ingresso confermata**: il nuovo partner entra con un link del suo gruppo e il suo codice
(scritto due volte); se il codice non è ancora nella mappa resta «in attesa» sotto chi ha mandato il link; il primo import che
lo mostra lo **sposta e lo conferma** da solo: nessuno conferma a mano (lo sponsor diretto può solo toglierlo da «In attesa»).
Prossimi: Fase B «Seguimi giorno per giorno» (il partner sceglie se l'upline vede cosa fa), poi Fase C «Analisi della persona».

**24 ottobre — storico e barra** (dalle prove di Stefano): nello storico personale la qualifica del mese si calcola fino ad
Argento; se nell'anno fiscale (da settembre fino a quel mese, dai report importati) è già raggiunta una qualifica annuale,
vale quella: Oro 3 mesi da Argento, Platino 6, Platino Fondatore 12; da Platino: Rubino (un mese Rubino), Zaffiro 6 mesi,
Smeraldo 3 linee al 21% per 6 mesi, Diamante 6 linee per 6 mesi (Fondatori: 12). Prima mostrava «Diamante Fondatore» per un
errore (le qualifiche annuali non hanno requisiti del mese). La barra di «Il mio mese» oltre l'obiettivo si divide in
proporzione al totale: la parte scritta dopo il report si vede sempre.

**21 ottobre — avviso di Supabase (email "Final notice", grants dal 30 ottobre)**: dal 30 ottobre 2026 Supabase non dà
più in automatico i permessi delle API alle **tabelle nuove** dello schema public (le esistenti non cambiano). Per Growup
non cambia niente: ogni tabella è sempre stata creata con `revoke all` e i `grant` espliciti (anche per colonna) nella
stessa migrazione, più la RLS; controllate tutte le 24 tabelle. Regola che resta: **ogni tabella nuova con i suoi grant
nella stessa migrazione** (vale anche per `installa_tutto.sql` su un progetto nuovo).

**21 ottobre — copie di sicurezza, il punto**: il **codice** è su GitHub e `installa_tutto.sql` ricrea tutto il database
vuoto. I **dati**: Supabase gratuito non fa copie automatiche; la copia dall'app («Scarica la copia dei dati», solo admin,
`copia_dati()`) contiene partner, attività, obiettivi, storico, numeri dei report, impostazioni, ma **non** le Liste, i
passi, il Target, i Clienti e gli ordini (per scelta: gli admin non li vedono) né il listino e i codici tolti. Decisioni
di Stefano: una copia l'ha già scaricata; il **piano Pro** di Supabase (copie automatiche giornaliere, comprese Liste e
Clienti) si attiva **al lancio ai Partner**. Ogni mese, insieme alla copia dei dati, si scarica lo **ZIP del codice** da
GitHub (procedura in `LEGGIMI.md`). Da fare: verifica in due passaggi sull'account GitHub.

**Fatto il 19-20 ottobre** (dettagli più sotto, in ordine di data): import da Amway degli ordini e dell'elenco clienti
(telefono, ultimo ordine, "Mai comprato" in Lista); Modifica dell'ordine e dei dati del cliente; etichette Da consegnare /
Da pagare; "Scrivigli" con tutti i prodotti che finiscono entro 7 giorni; + Contatto e + Piano di Io che aprono il nome e
il passo; scheda della persona (chiusura dopo il follow-up, Non ora con promemoria 2 giorni prima, Nota nei dati, dati
modificabili toccando il nome, anche per i clienti); "+ Un nome" resta nella lista; Target anche su Telegram; "Non ora"
solo in Da riprendere; Da confermare / Togli dalla struttura / Blocca l'app; listino nel database con prezzo Partner e
VP negli ordini e aggiornamento dal PDF.

**Fatto il 20 ottobre**: l'ultimo ordine dell'elenco clienti si somma agli ordini già presenti (anche con un ordine
"fatto da me" più recente), senza doppioni; decisione di Stefano: i partner caricano l'export **Ordini** (lo storico vero),
l'import accetta Clienti e Ordini insieme. **App in movimento**: tavola di prova "Growup Team in movimento" su claude.ai,
scelta **Vivace** con le pagine **Sobria**; coriandoli ai traguardi personali (contatti e piani della settimana, VP del
mese, nuova tappa, primo cliente e primo partner), una volta sola per periodo; "riduci animazioni" rispettato.

**21 ottobre — «Come arrivarci»** (testi dalla tavola "Come arrivarci", versione 2): un riquadro chiuso nella pagina
Obiettivo (per sé, "tu") e nella scheda partner (per sponsor e upline, in terza persona). Una situazione alla volta, la
prima che scatta: primo ordine · primi clienti (solo per sé) · fermo (0 VP personali) · VP personali · nessuna linea ·
manca una linea · linee sotto il VP della tappa · VP di gruppo · tutto a posto. La tappa guardata è la prima dal Path to
Bronze in su non ancora chiusa (qualifica dichiarata o mese chiuso). In cima, dal Path to Bronze in su, la riga fissa
"Ricorda: per X servono anche N VP personali nel mese". Sotto, la tabellina delle linee: VP, persone (chi apre la linea e
chi ha sotto), a 0, sotto 50, 50-99, 100-199, 200+, VP medio di chi fattura, quanto manca. **Mancano persone** se almeno
1 persona su 4 è attiva (100 VP e oltre) nelle linee considerate, altrimenti **fatturato basso**, con le persone tra 50 e
99 nominate a parte. I testi stanno in `CONSIGLI` (app.js): si cambiano lì. Nessun dato nuovo nel database.

**21 ottobre — qualifiche oltre Argento** (dal documento Amway "Livelli di Qualifica" 12-2025, letto e non salvato
nel repository): nel menu della qualifica più alta Oro, Platino, Platino Fondatore, Rubino, Rubino Fondatore, Zaffiro,
Zaffiro Fondatore, Smeraldo, Smeraldo Fondatore, Diamante, Diamante Fondatore. Sono annuali (mesi del Performance
Year, 1° settembre - 31 agosto): **si dichiarano** dal Punto di partenza (Oro e Platino poi sono diventati tappe del
percorso: vedi sotto). Chi dichiara **Platino o più** sceglie la **prossima qualifica** (all'ingresso e in Modifica; in Obiettivo
il riquadro con i requisiti); sponsor e upline la vedono nella scheda. **Volume Rubino** = VPG del report mappe (le linee
al 21% non ci sono, confermato da Stefano): "Volume Rubino questo mese: X su 20.000 VP", solo con il report del mese.
Per dopo: contare i mesi del Performance Year (Oro, Platino, Rubino Fondatore, Zaffiro) e le linee al 21% per mese
(Smeraldo, Diamante); Volume Equivalente ignorato; nessuna cifra in euro oltre Argento.

**21 ottobre — il percorso oltre Argento** (decisione di Stefano: "il percorso non si deve fermare ad Argento"):
… Builder 18% → **Argento → Oro → Platino**. Un **mese da Argento** è un mese in cui il report mappe importato dà la
persona al **21%**. Prima volta (regola Amway): si contano gli **ultimi 12 mesi**; Oro = 3 mesi, Platino = 6 mesi di cui 3
di fila. A Platino l'app lo **riconosce da sola** (la qualifica dichiarata diventa Platino, festa) e chiede la
**prossima qualifica**. Da Platino in su le qualifiche si dichiarano. Chi entra come **Argento o Oro** indica il mese
della prima qualifica Argento e importa i report **da quel mese** (al massimo 12); chi entra come **Platino o più** li
importa **da settembre**. In Io e Obiettivo il riquadro «Report da importare» (✓/○ per mese) finché ne manca uno. I report
dei **mesi chiusi** si importano "solo numeri" (21%, VPG, linee): la struttura e i VP non cambiano. Lo sponsor vede nella
scheda «Mesi da Argento: N su 3/6» (dai report che ha importato lui). Nota: il report ha anche una colonna "VP Rubino":
da verificare con Stefano se usarla al posto del VPG.

**21 ottobre — «Come arrivarci» da Argento a Platino** (tavola "Da Argento a Platino" v2, corretta da Stefano): per le
tappe Oro e Platino, in ordine: report mancanti (solo per sé) · questo mese al 21% · 6 mesi ma non 3 di fila (con la fila
in corso, sul mese in corso: «il mese scorso eri al 21%: questo mese è il secondo dei 3», PR #91) · una linea al 21% e meno di 4.000 VP · vicino al 21% (da **8.000** VPG) ·
una linea vicina al 21% (da 8.000) · lontano dal 21% (mancano persone / fatturato basso, regola di 1 su 4). Riga fissa
«Mesi da Argento negli ultimi 12 mesi: N su 3/6», tabellina con la **%** di ogni linea. Lo sponsor lo vede nella scheda
di chi è tra Argento e Platino (mesi dai report importati da lui).

**Da fare / in sospeso per Stefano**:
- **Importare subito il report mappe**: dalla 027 tutti (tranne gli admin) sono "Da confermare" e chi ha qualcuno sotto
  lo può togliere; il primo import conferma chi è nel report.
- Provare sul telefono le animazioni e i coriandoli (Android e iPhone di Alessia).
- Provare con dati veri Target, Lista, Clienti (import ordini e clienti) e i tempi (preavviso 7 giorni, fermo dopo 45,
  verifica dopo 8).
- Prima del lancio: prova su iPhone con Alessia, copia di sicurezza, pilota con 2-3 leader, messaggio al gruppo.
- Sicurezza: verifica in due passaggi su GitHub, Supabase e Google; privacy dell'email su GitHub; richiesta al supporto
  GitHub di pulire la storia (dati reali di prima e ora anche `catalogo.js`, il listino per l'incaricato).
- In futuro: una sezione "analisi della persona" (bonus per linea), fuori dalle schermate di tutti i giorni.

**20 ottobre — ultimo ordine dall'elenco clienti**: si somma agli ordini già nell'app. Prima, se il cliente aveva un
ordine "fatto da me" più recente, l'ultimo ordine del sito veniva saltato: ora contano solo gli ordini "dal sito" (con la
stessa data o dopo) e l'export Ordini; reimportando lo stesso file non si aggiunge due volte.

**20 ottobre — l'app in movimento** (tavola di prova "Growup Team in movimento" su claude.ai; scelta di Stefano:
**Vivace**, ma tra le pagine **Sobria**): cambio pagina e apertura/chiusura di una scheda scivolano brevi nella direzione del
tocco, con le card che compaiono una dopo l'altra; pulsanti che si premono e tornano su elastici; numeri che saltano e barre
che si riempiono scorrendo; fogli dal basso che salgono e scendono; messaggi che salgono. **Coriandoli** su tutto lo schermo
(disegnati nell'app, senza librerie) con un annuncio al centro e un "tic" del telefono (Android) ai traguardi personali:
piccola festa per gli obiettivi contatti e piani della settimana, grande festa (con due spari dai lati) per l'obiettivo VP
del mese, una nuova tappa del percorso, il primo cliente e il primo partner dalla lista. Solo nel momento in cui succede e
una volta sola per periodo (ricordato sul telefono). Con "riduci animazioni" attivo sul telefono non si muove niente
(l'annuncio del traguardo resta). Solo traguardi personali (decisione di Stefano).

**20 ottobre — il passaggio tra le schede "una sopra l'altra"** (scelta di Stefano dalla tavola di prova, al posto
dello scivolamento "Sobria"): andando avanti la pagina nuova scorre da destra sopra la vecchia, che si sposta un poco e si
scurisce; tornando indietro quella di sopra scivola via. Vale per le schede in alto, le sezioni di Persone e
l'apertura/chiusura di persone, clienti, inviti e partner, anche con il dito.

**21 ottobre**: nell'import dei clienti dal sito Amway, sopra "Nuovi clienti" e "Mai comprato" c'è **Seleziona tutti**
(mette o toglie tutte le spunte della sezione). In Io i **clienti da sentire** si tolgono con la × come le persone della
lista; tornano da soli con un ordine nuovo (a mano o importato) o con "Rimanda", oppure con **Rimetti in Io** dalla
scheda del cliente.

**21 ottobre — scheda partner**: sopra l'elenco delle linee c'è il titolo "Le sue linee frontali · VP di gruppo di ogni
linea, dal report Amway"; chi è nella mia struttura si apre toccando il nome (›). "Scarica il file" in Fissa una chiamata
resta com'è (per chi non usa Google Calendar; su iPhone il pulsante Calendario usa già il file).

**21 ottobre — Preferiti**: sotto le barre di ogni persona (che usa l'app) anche la riga "La sua lista" della scheda
partner (in lista, in corso, piani e sì del mese, clienti), solo numeri.

**21 ottobre — i "sì" divisi** (migrazione `029_si_divisi.sql`, applicata): nella riga "La sua lista" (scheda partner e
Preferiti) al posto di "N piani e N sì" ci sono "N piani, N partner e N clienti nuovi · N clienti in tutto". I clienti
aggiunti con "+ Un cliente" e quelli importati dal sito Amway restano contati tra i clienti nuovi (decisione di Stefano).

**21 ottobre — scendere lungo le linee**: nella scheda partner i VP delle linee frontali sono allineati a destra, con lo
stesso carattere dei nomi. Aprendo una linea da un'altra scheda, in alto ci sono **‹ Indietro** (la scheda di prima) e
**Il mio gruppo** (l'elenco); anche il dito verso destra torna alla scheda di prima, con il passaggio all'indietro.

**21 ottobre — "Solo Admin"**: sotto ogni pulsante che vedono solo gli admin c'è la scritta piccola **Solo Admin** (Scarica la
copia dei dati, Listino, Codici Amway tolti, Correggi il codice Amway, Nuovo link personale, Invita sotto / chi manca sopra,
Blocca/Sblocca l'app). "Togli dalla struttura" no: lo usano anche sponsor e upline.

**21 ottobre — Oggi con i nomi**: in Io → Oggi le attività contate da un passo della lista hanno il nome della persona
("Contatto: Nome", "Piano mostrato: Nome", e allo stesso modo "Nuovo cliente: Nome"); senza nome resta "Contatto".
Si vede solo nella propria pagina Io.

**Nota tecnica per Claude**: il connettore Supabase non applica le istruzioni con cancellazioni (`drop`, `delete`):
va in timeout. Si applicano a pezzi senza `drop` (oggetti nuovi) e il resto lo incolla Stefano nell'SQL Editor.

## Ripartire da qui (fermi la sera del 17 ottobre 2026)

**Fatto oggi**: rete dal report Amway (import sempre completo, nessuno cancella, ognuno nasconde chi vuole: migrazioni
015–018), inviti da admin, numeri ufficiali del report, controllo di sicurezza completo (`SICUREZZA.md`), storia di
GitHub ripulita dai dati reali, codice d'invito della radice rigenerato. Protezioni sugli accessi: **captcha Cloudflare
Turnstile** (nell'app e acceso in Supabase, provato sul telefono), limite 30 accessi anonimi/ora per rete, provider
Email spento in Supabase. Account Cloudflare di Stefano con verifica in due passaggi. Ultime PR unite: #44, #45, #46.

**Confermato da Stefano**: migrazione `018_niente_cancellazioni.sql` applicata; l'app funziona sul telefono con la
Content Security Policy e il captcha.

**18 ottobre**: Alessia non trovava "Aggiungi alla schermata Home" perché aveva aperto il link dentro Telegram.
Su iPhone la guida all'installazione ora riconosce Telegram, WhatsApp, Instagram e Facebook ("Sei dentro Telegram…
Apri in Safari"), dà i passi giusti anche in Chrome e, in Safari, ha la nota per chi è dentro un'altra app.

**18 ottobre — niente conferme** (migrazione `019_partenza_senza_conferma.sql`): decisione di Stefano, ognuno è
responsabile di dichiarare il giusto e i numeri veri arrivano dal report Amway. Tolti il riquadro "Da confermare",
il "!" nella struttura e "Conferma" nella scheda (resta "Punto di partenza dichiarato" come informazione);
`conferma_partenza` chiusa. Ognuno corregge il proprio dal fondo della pagina Io → "Modifica" (`modifica_partenza`).

**18 ottobre — nascondere una persona sola**: dopo l'import di Stefano con "Nascondi chi ha 0 VP" erano spariti
anche i gruppi attivi sotto i frontali a 0 VP (nessun dato perso: 170 importate, 134 nascoste). Ora chi è nascosto
sparisce da solo e chi sta sotto resta visibile. Poi, su richiesta di Stefano: al reimport la scelta **Lascia tutto
com'è** (di base, solo i VP) / **Riapplica i filtri a tutti** (anche chi hai nascosto a mano segue il filtro: poi lo si
rinasconde dall'elenco); struttura con **Mostra anche le nascoste** (albero completo, nascoste in grigio, Mostra /
Nascondi per riga); **Rivedi** = elenco Nascoste · Visibili con livello, sponsor e persone sotto, da cui si nasconde
anche chi è visibile.

**18 ottobre — bonus di performance tolto**: la scheda "Il tuo bonus di …" (PR #54) è stata tolta su richiesta di
Stefano ("non riempiamo le schermate"). Il calcolo (differenza di percentuale per linea, in VP, percentuale effettiva)
tornerà in una **sezione dedicata per analizzare e gestire la situazione di una persona**, da progettare. Il codice
di riferimento è nel commit "il bonus di performance in VP" della storia del repository.

**18 ottobre — Persone → Lista (fase 1 di "dal contatto al cliente")**. Il piano in breve:
Si integrano le mini app Target, Lista e Clienti in Growup, una fase per PR: prima la **Lista** (fatta), poi il
**Target** (porta d'ingresso per chi non conosci, a parte dalla Lista: "Metti in lista" / "Proponi come cliente";
testi del metodo in un riquadro "Il metodo" a richiesta), poi i **Clienti** (ordini, riordini, verifiche,
compleanni, messaggi). Decisioni: dati in Supabase visibili solo a chi li scrive; l'upline vede solo i numeri;
nuova scheda **Persone** (`Obiettivo | Io | Persone | Gruppo`); semplicità prima di tutto.
Fase 1 (migrazione `020_persone.sql`): tabelle `persone` e `passi`; percorso In lista → Contattato → Invitato →
Piano → Follow-up → Chiusura (Partner · Cliente · Non ora · No) con le voci di "Dalla Lista al Sì"; un passo
Contatto / Piano / Chiusura-Cliente **conta da solo** l'attività (trigger), togliendo il passo si toglie;
"Da fare con la tua lista" su Io (in ritardo, oggi, prossimi giorni, ferme da 2 settimane); nella scheda partner
"La sua lista: …" (solo numeri); "Scarica la mia lista" (l'importazione dalla vecchia app, usata solo in prova,
è stata tolta il 18 ottobre); Partner chiuso → "Mandagli il tuo link d'invito". Informativa aggiornata.

**18 ottobre — la Lista su Io** (migrazione `021_persone_io.sql`): su Io, "Il tuo percorso con la lista" mostra come
promemoria **tutte** le persone con cui è iniziato un percorso (da Contattato in poi; non chi è solo "In lista"; non le
chiuse, tranne "Non ora" con una data): prima in ritardo · oggi · prossimi giorni, poi "In corso" (le più avanti nel
percorso in cima). × toglie una persona da Io (colonna `nascosta_io`); torna da sola quando si segna un passo, si
fissa una data o si riapre il percorso, oppure dalla sua scheda con "Rimetti in Io".

**18 ottobre — Persone → Target (fase 2)** (migrazione `022_target.sql`): in Persone due sezioni, **Target · Lista**.
Il Target è per chi non conosci: "+ Nuovo invito" (nome, durata del link: 3 giorni … senza scadenza) → messaggio
WhatsApp con il link alle otto domande (pagina di Growup `#t&…`, senza accesso). Nel link il **numero WhatsApp del
partner** (chiesto nel "Nuovo invito", salvato solo sul suo telefono): "Invia su WhatsApp" del contatto apre
direttamente la sua chat (richiesta di Stefano, 18 ottobre); senza numero il contatto sceglie la chat. Il contatto non scrive nel database: rimanda il codice
`CL21-…` con il link "Apri le risposte" (`#r=…`, si legge appena il partner è dentro) o "Leggi una risposta".
Scheda dell'invito: esito (In target · Con riserve · Da coltivare · Fuori target), punteggio su 28, cosa cerca / cosa lo
trattiene, le risposte; **"Il metodo"** (cosa affrontare, promemoria per l'incontro, cosa dire se è no) si apre a
richiesta. "Metti in lista" → la persona entra in Lista già Contattato, con l'esito del Target nella sua scheda (senza
contare di nuovo il contatto). Blocca / riapri il link, archivia, elimina. Domande, punteggi e testi identici alla
mini app (versione 2026-09-14). La mini app Target resta online per i link già mandati; nessuna importazione.
Poi (023): dalla scheda di una persona della **Lista** "Manda le 8 domande (Target)" — l'invito nasce collegato a lei e
le risposte compaiono nella sua scheda; chi era solo "In lista" diventa **Contattato** (passo Contatto "Target", che conta
il contatto); se una persona arrivata dal Target si toglie dalla lista, l'invito resta e
torna "Metti in lista" (prima restava un "Apri nella lista" che non apriva niente).

**18 ottobre — Persone → Clienti (fase 3)** (migrazione `024_clienti.sql`, file `catalogo.js` con i 370 prodotti del
listino Amway): Persone ha tre sezioni **Target · Lista · Clienti**. Un cliente è una persona della Lista chiusa come
Cliente (una sola scheda); "+ Un cliente" lo crea direttamente (conta come nuovo cliente). Scheda cliente: stato (A posto ·
Sta finendo · Doveva riordinare · Fermo dopo 45 giorni · Mai ordinato · Da risentire · Non compra più), **+ Ordine** dal
catalogo (quantità, prezzo modificabile, quanto dura: 30 giorni di base, si cambia e vale per tutti i miei clienti),
"Dal sito" / "L'ho fatto io" (con Consegnato / Pagato), **Ripeti l'ultimo**, "Riordinato" sul singolo prodotto, ×
"non lo prende più", **Scrivigli** con i messaggi della mini app (Sta finendo · Come ti sei trovato · Auguri e
proposta) che si aprono nella chat WhatsApp del cliente, Rimanda (3 giorni … 1 mese), compleanno. Su Io "I tuoi clienti
da sentire" (sta finendo / in ritardo, come si è trovato 8 giorni dopo un prodotto nuovo, compleanno entro 7 giorni).
Gli ordini **non contano nei VP** (decisione di Stefano). All'upline il numero dei clienti nella scheda partner.
**19 ottobre — ordini dal sito Amway** (migrazione `025_ordini_amway.sql`): in Clienti "Ordini dal sito" carica l'export
"Ordini" del sito Amway (CSV: Nome "Cognome, Nome", Codice Cliente, Data ordine "18 agosto 2026", Numero ordine, VP, VV,
Tipo ordine; senza prodotti; parte sempre da settembre). Anteprima: già tra i clienti (per codice cliente, altrimenti per
nome), nuovi clienti con la spunta (entrano chiusi come Cliente alla data del primo ordine, senza contare oggi). Gli ordini
già importati (stesso numero) si saltano. Senza prodotti vale il **ritmo** (mediana degli intervalli tra gli ordini; con
un ordine solo 30 giorni): "di solito ordina ogni 40 giorni, prossimo atteso il …" e su Io quando è il momento.
"+ Aggiungi i prodotti" su un ordine importato (decisione di Stefano: i prodotti si possono sempre aggiungere a mano).
**19 ottobre — anche l'elenco dei clienti dal sito Amway** (migrazione `026_clienti_da_amway.sql`): il pulsante in
Clienti diventa "Dal sito Amway" e accetta l'export "Ordini", l'export "Clienti" o tutti e due insieme (li riconosce da
solo; si può rifare quante volte si vuole, niente doppioni). Dal file Clienti si tengono solo nome, codice cliente,
telefono (solo se manca, mai sovrascritto) e data dell'ultimo ordine: niente email, niente indirizzo. L'ultimo ordine
entra nello storico senza numero e si unisce all'ordine vero quando arriva l'export Ordini. Chi non ha mai comprato entra
nella **Lista con l'etichetta "Mai comprato"** (con la spunta, si sceglie chi); chi compare con due codici diventa una
persona sola. Nella scheda cliente: **Modifica** su ogni ordine (data, modo, prodotti, prezzi, nota, elimina; il numero
Amway resta), **Modifica i dati** (nome, telefono, come lo conosci, codice cliente, compleanno, note), le etichette
**Da consegnare / Da pagare** per gli ordini fatti dal partner non spuntati (in elenco Clienti e nella scheda; non su Io,
decisione di Stefano). Il report della rete resta un import separato.
**19 ottobre — "Scrivigli" con più prodotti**: il messaggio "Sta finendo" nomina tutti i prodotti che finiscono entro
i 7 giorni di preavviso (anche quelli già finiti), non solo il primo; se nessuno è così vicino, il primo che finisce
(decisione di Stefano).
**19 ottobre — pulsanti rapidi di Io**: **+ Contatto** apre l'inserimento di un nome (come "+ Un nome"): la persona entra
nella Lista già Contattato e il contatto conta nella settimana; se il nome è già nella lista il contatto si segna su di
lei. **+ Piano** chiede con chi (ricerca nella lista o un nome nuovo) e apre il passo Piano da compilare: conta nei piani
della settimana. Tutti e due restano su Io e hanno "Senza nome" per contare solo il numero. **+ Ordine** invariato.
In Clienti il primo filtro, selezionato all'apertura, è **Tutti**.
**19 ottobre — la scheda della persona nella Lista**: dopo il follow-up il passo proposto è la **Chiusura**. Nella
chiusura si vede solo quello che serve all'esito: **Partner** resta nella lista (con la prossima cosa e il link d'invito);
**Cliente** esce dalla Lista (anche dai Chiusi) e si apre la sua scheda nei Clienti; **Non ora** chiede tra quanto
risentirlo (1 mese · 3 mesi · 6 mesi · 1 anno o una data) e mette il promemoria 2 giorni prima, con la nota; **No** solo
la nota. Il passo **Nota** è solo una finestra per scrivere: la nota (con la data) va nelle Note dei dati della persona.
Il pulsante "Modifica i dati" in fondo non c'è più: i dati si modificano **toccando il nome** (✎). Lo stesso nella scheda del cliente.
**19 ottobre — conferma dal report e blocco dell'app** (migrazione `027_conferma_e_blocco.sql`): chi usa l'app è
**Da confermare** finché il suo codice Amway non compare in un report mappe importato (da lui, dal suo sponsor o da un
upline); chi prende il posto di una persona già importata è confermato subito. Decisione di Stefano: anche chi è già
nell'app riparte da confermare (gli admin no). Finché è da confermare, **sponsor, upline e admin** lo possono **togliere
dalla struttura**: si cancellano profilo e dati, il telefono vede "Accesso tolto", chi aveva invitato passa al suo
sponsor e il codice Amway non rientra finché un admin non lo sblocca ("Codici Amway tolti" in fondo alla pagina).
L'**admin blocca e sblocca l'app** di chiunque (non di sé né di un altro admin): il telefono vede "Accesso sospeso", i dati
restano e i VP contano; sponsor e upline vedono l'etichetta "Bloccato" (decisione di Stefano, per trasparenza).
**20 ottobre — il listino nel database** (migrazione `028_listino.sql`, file `listino.js` con la lettura del PDF): il listino
Amway è "per l'incaricato", quindi `catalogo.js` è tolto dal repository pubblico e i prodotti stanno nella tabella `listino`
(la leggono solo gli utenti dell'app; la scrive solo l'admin). Per ogni prodotto prezzo al cliente, prezzo Partner e VP
(decisione di Stefano); nell'ordine del cliente ogni riga li mostra e in fondo ci sono i totali (cliente · Partner · VP);
le righe li tengono. I VP del mese restano quelli dell'import delle mappe. In fondo alla pagina, solo admin, **Listino**:
cerca e correggi un prodotto, **+ Prodotto** (i nuovi, 5-6 volte l'anno), **Aggiorna dal PDF** (il "Listino prezzi per
l'incaricato": letto sul telefono con pdf.js, anteprima di nuovi, prezzi cambiati e usciti con la spunta; gli usciti non si
cancellano, diventano "non nel listino"). Provato sul PDF di aprile 2026: 348 prodotti su 348, con le varianti (colori,
gusti) e le descrizioni che vanno a capo.
**19 ottobre — ritocchi alla Lista e al Target**: con "+ Un nome" si resta nella lista (non si apre la scheda).
Il filtro **Aperti** non comprende più i "Non ora", che stanno solo in **Da riprendere**. La **Nota** compare anche tra i
passi della scheda (oltre che nelle Note dei dati). Nel **Target** l'invito si manda anche su **Telegram**, e il contatto
può rimandare le risposte anche su Telegram (sceglie lui la chat; su WhatsApp si apre direttamente quella del partner).

**Prima del lancio al gruppo** (Stefano sceglie da dove partire):
1. **Prova su iPhone con Alessia**: Claude prepara una lista di ~10 controlli (ingresso, installazione sulla Home,
   import, nascondi, scheda partner).
2. **Copia di sicurezza** dall'app (in fondo alla pagina) in una cartella privata di Google Drive.
3. **Gruppo pilota di 2-3 leader** per una settimana: rete grande, appena partito, poco pratico col telefono.
   Domanda aperta: chi coinvolgere.
4. **Messaggio per il gruppo** (lo scrive Claude): cos'è l'app, perché, tenere pronto il codice Amway.

**Da fare per Stefano (account)**: verifica in due passaggi su GitHub, Supabase e Google; su GitHub "Keep my email
addresses private" e "Block command line pushes that expose my email"; GitHub Support per togliere le vecchie
versioni delle PR chiuse (support.github.com → remove sensitive data / cached views).

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
  (`conferma_partenza`, da sponsor o upline; colonne `partenza_confermata_il/_da`). **Tolto il 18 ottobre** (019).

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
  **Eccezione (21 ottobre)**: il riquadro «Come arrivarci», chiuso finché non lo si tocca, in Obiettivo e nella scheda
  partner. Resta valido tutto il resto: nessun consiglio in Io, Persone, Gruppo, Mese.

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
