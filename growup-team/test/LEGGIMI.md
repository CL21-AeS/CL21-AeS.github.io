# Test di Growup Team (solo per lo sviluppo, l'app non li usa)

**Interfaccia** (Playwright, con un finto Supabase in `e2e/mock.js`), dalla radice del repository:

```sh
npx http-server -a 127.0.0.1 -p 8765 -s . &
T=growup-team/test; cat $T/e2e/head.mjs $T/e2e/body.mjs > $T/e2e/test.mjs && S=$T node $T/e2e/test.mjs
```

Deve stampare `controlli superati: N` senza righe `FAIL` e uscire con codice 0. Conta come errore anche un file
dell'app che non arriva (risposta 404 dal nostro sito); se un passo si blocca, il test si ferma con `FAIL: test interrotto`
e mostra gli errori raccolti. Gli screenshot finiscono in `e2e/*.png`.
`head.mjs` importa Playwright da `/opt/node22/lib/node_modules/playwright`: adattare il percorso se serve.

**Database** (Postgres 16 o più recente, locale), dalla cartella `growup-team`:

```sh
sh test/db.sh
```

Crea un database di prova vuoto, lancia `stub_supabase.sql` (simula lo schema `auth` e i ruoli di Supabase, compreso
`service_role`), `../supabase/installa_tutto.sql`, controlla che ogni tabella e funzione dell'installazione esista
davvero e poi lancia `../supabase/tests_rls.sql`; alla fine cancella il database di prova.
**Si ferma al primo errore** ed esce con codice 1 (`INSTALLAZIONE FALLITA`, `INSTALLAZIONE INCOMPLETA`,
`CONTROLLI FALLITI`). Solo se tutto è andato bene stampa **TUTTI I CONTROLLI SUPERATI** ed esce con codice 0.
Serve un utente Postgres che possa creare database (per esempio `PGDATABASE=postgres sh test/db.sh`).

Anche lanciando i file a mano, l'ultima riga di `tests_rls.sql` dice «TUTTI I CONTROLLI SUPERATI» solo se il blocco
dei controlli è arrivato in fondo; altrimenti dice «CONTROLLI NON COMPLETATI».
