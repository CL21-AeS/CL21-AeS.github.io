# Test di Growup Team (solo per lo sviluppo, l'app non li usa)

**Interfaccia** (Playwright, con un finto Supabase in `e2e/mock.js`), dalla radice del repository:

```sh
npx http-server -a 127.0.0.1 -p 8765 -s . &
T=growup-team/test; cat $T/e2e/head.mjs $T/e2e/body.mjs > $T/e2e/test.mjs && S=$T node $T/e2e/test.mjs
```

Deve stampare `controlli superati: N` senza righe `FAIL`. Gli screenshot finiscono in `e2e/*.png`.
`head.mjs` importa Playwright da `/opt/node22/lib/node_modules/playwright`: adattare il percorso se serve.

**Database** (Postgres 16 locale): creare un database vuoto, poi lanciare `stub_supabase.sql`
(simula lo schema `auth` e i ruoli di Supabase), `../supabase/installa_tutto.sql` e `../supabase/tests_rls.sql`.
Deve finire con **TUTTI I CONTROLLI SUPERATI**.
