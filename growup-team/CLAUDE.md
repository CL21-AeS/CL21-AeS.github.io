# Growup Team — istruzioni per Claude

- Leggi prima `STATO.md` (a che punto siamo) e `METODO.md` (come lavoriamo e la tecnica usata).
- `ADMIN.md` elenca tutto quello che può fare un admin: aggiornalo quando aggiungi o togli una funzione da admin.
- Tutto in italiano. Prima il piano e l'ok di Stefano, poi il codice; una PR per consegna, la unisce Stefano.
- Lavora solo in `growup-team/`: le altre cartelle del repository non si toccano.
- Sicurezza: RLS su ogni tabella, nel codice solo la chiave publishable, ogni regola nuova in `supabase/tests_rls.sql`.
- Il repository è pubblico: mai dati reali (nomi, codici Amway, numeri, codici d'invito) in file, test, commit o PR.
  Controlli di sicurezza in `SICUREZZA.md`.
- L'app non dà suggerimenti nelle schermate di tutti i giorni: mostra dati, percorso e mancanze. Eccezioni, che si
  aprono solo a richiesta: il riquadro «Come arrivarci» (pagina Obiettivo e scheda partner), chiuso finché non lo si
  apre, e la **Guida** (pulsante «Guida» in cima a Io, separata da «Il mio giorno»). «Da fare oggi» (le azioni del Seguimi) compare in «Il mio
  giorno» solo per chi ha scelto «Seguimi giorno per giorno» nella Guida. L'«Analisi della persona» è una pagina a parte,
  aperta solo a richiesta (dalla Guida e dalla scheda partner): solo dati, senza calcoli né consigli.
