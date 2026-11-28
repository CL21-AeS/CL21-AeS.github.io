# Growup Team — istruzioni per Claude

- Leggi prima `STATO.md` (a che punto siamo) e `METODO.md` (come lavoriamo e la tecnica usata).
- `ADMIN.md` elenca tutto quello che può fare un admin: aggiornalo quando aggiungi o togli una funzione da admin.
- Tutto in italiano. Prima il piano e l'ok di Stefano, poi il codice; una PR per consegna, la unisce Stefano.
- Lavora solo in `growup-team/`: le altre cartelle del repository non si toccano.
- **Chi usa l'app oggi** (12 novembre 2026): solo Stefano (admin). Nessun partner ha ancora fatto il primo ingresso:
  entreranno tutti più avanti, prima alcuni tester e poi tutti. Non servono passaggi, adattamenti o migrazioni per
  utenti già esistenti; il primo ingresso (nuovi iscritti e partner in attività da anni) è l'esperienza più importante.
- Sicurezza: RLS su ogni tabella, nel codice solo la chiave publishable, ogni regola nuova in `supabase/tests_rls.sql`.
- Il repository è pubblico: mai dati reali (nomi, codici Amway, numeri, codici d'invito) in file, test, commit o PR.
  Controlli di sicurezza in `SICUREZZA.md`.
- L'app non dà suggerimenti nelle schermate di tutti i giorni: mostra dati, percorso e mancanze. Eccezioni, che si
  aprono solo a richiesta: il riquadro «Come arrivarci» (pagina Obiettivo e scheda partner), chiuso finché non lo si
  apre, e la **Verifica** (ex Guida: pulsante «Verifica» in cima a Io, separata da «Il mio giorno»), con la tabella
  Stabilità CL21, le abitudini e «La mia analisi» in fondo. «Da fare oggi» (le azioni del Seguimi) compare in «Il mio
  giorno» solo per chi ha scelto «Seguimi giorno per giorno» nel **Profilo** (dove c'è anche la scelta di condividere
  con l'upline). L'«Analisi della persona» è una pagina a parte, aperta solo a richiesta (dalla Verifica e dalla scheda
  partner): solo dati, senza calcoli né consigli.
  Eccezione voluta da Stefano (13 novembre 2026): **«Da seguire oggi»** in «Il mio giorno», solo per chi ha qualcuno sotto
  (`haPartnerSotto`): le persone che segue e che oggi hanno un motivo, compreso **un complimento da fare**. Mostra solo il
  fatto (chi e perché), mai come fare; il testo non deve far credere che contatti o piani facciano ottenere la percentuale.
  Eccezione voluta da Stefano (18 novembre 2026): **«La tua strategia»** in cima a Io (a partenza completata; dal 28 novembre
  2026 subito sotto «Oggi per la tua strategia», e con il Seguimi acceso sopra c'è «Da fare oggi»): le caselle di
  lavoro proposte dalla mappa (nuove linee frontali, persone da aiutare a fare il Path to Bronze, nuovi in profondità).
  Nella card niente premi, niente cifre in euro, niente proiezioni. Come tornare alla Io di prima:
  `TORNARE-INDIETRO-STRATEGIA.md`.
  Eccezione voluta da Stefano (20 novembre 2026), accanto a «Come arrivarci»: **«Come aiutarlo a qualificare»** nella scheda
  partner (si apre toccando una persona nell'elenco delle linee della card «La tua strategia», o dal Gruppo): la strategia
  calcolata per quella persona con la stessa funzione (`strategia(null, pid)`), solo dai dati della mappa: la sua
  situazione, la sua prossima tappa vera, cosa manca con i numeri e la strada consigliata con la logica delle caselle. Le
  caselle salvate da quella persona non si vedono mai (restano solo sue); niente cifre in euro, niente proiezioni.
- **Versione semplificata per chi inizia**: nei primi 30 giorni del percorso di partenza una parte dell'app si nasconde
  (Verifica, Storico, promemoria dell'import, percorso completo dell'Obiettivo, Gruppo senza partner sotto). La regola sta
  in una sola funzione, `versioneSemplice()` in `app.js`: ogni cosa nuova da nascondere a chi inizia passa da lì. Si
  nasconde e basta (niente lucchetti, niente database); admin, avviati e chi ha finito il percorso vedono tutto.
