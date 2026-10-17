# Growup Team — istruzioni per Claude

- Leggi prima `STATO.md` (a che punto siamo) e `METODO.md` (come lavoriamo e la tecnica usata).
- `ADMIN.md` elenca tutto quello che può fare un admin: aggiornalo quando aggiungi o togli una funzione da admin.
- Tutto in italiano. Prima il piano e l'ok di Stefano, poi il codice; una PR per consegna, la unisce Stefano.
- Lavora solo in `growup-team/`: le altre cartelle del repository non si toccano.
- Sicurezza: RLS su ogni tabella, nel codice solo la chiave publishable, ogni regola nuova in `supabase/tests_rls.sql`.
- L'app non dà suggerimenti: mostra dati, percorso e mancanze.
