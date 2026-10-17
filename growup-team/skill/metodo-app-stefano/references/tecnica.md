# Tecnica — come è fatta Growup Team

File di riferimento nel repository `CL21-AeS/CL21-AeS.github.io`, cartella `growup-team/`:
`index.html`, `app.js`, `config.js`, `manifest.webmanifest`, `sw.js`, `supabase/*.sql`, `test/`, `LEGGIMI.md`,
`STATO.md`, `METODO.md`, `design/GRAFICA.md`.

## Struttura dell'app
- **Una pagina sola** (SPA) senza build: lo stato sta in un oggetto `st`, le viste sono funzioni che restituiscono
  stringhe HTML (`vHome`, `vScheda`, …); un `render()` riscrive `#app` solo se l'HTML cambia (così i moduli
  aperti non perdono quello che si sta scrivendo).
- **Azioni delegate**: i pulsanti hanno `data-act="nome"` e un unico listener chiama `AZIONI[nome](el)`;
  i moduli hanno `data-form="nome"` e il submit chiama `MODULI[nome](form)`.
- **Fogli in basso** (sheet) per gli inserimenti; toast con "Annulla".
- **Pagine**: selettore in alto (oggi Obiettivo | Io | Gruppo) e passaggio col dito (touchstart/touchend,
  soglia 70 px, solo movimenti orizzontali, non nei campi).
- **PWA**: manifest, service worker "prima la rete, poi la cache" (i dati vengono sempre dal database),
  icone 192/512 (disegno nell'area sicura dell'80% per Android), apple-touch-icon 180, meta og: per l'anteprima
  del link su WhatsApp/Telegram (immagine 1200×630).

## Supabase
- Progetto in **Central EU (Francoforte)**. Nel codice **solo la chiave publishable** (`sb_publishable_…`):
  è pubblica per costruzione; la sicurezza è la RLS. Mai la secret/service_role nel repository.
- **RLS su ogni tabella** e un controllo che lo verifica. Leggere "me e la mia downline" con una funzione
  `is_in_downline(target)` (CTE ricorsiva su `sponsor_id`).
- **Funzioni `security definer`** con `set search_path = public`, controlli all'inizio (`non_autorizzato`,
  `posizione_non_valida`, …) e `revoke … from public, anon` + `grant … to authenticated`.
- **Dati che l'upline vede solo in parte**: tabella con RLS "solo il proprio" + funzione che restituisce
  le sole colonne permesse (esempio: `obiettivi` e `obiettivi_gruppo()` senza il "perché").
- **Migrazioni numerate** (`001_schema.sql`, `002_rls.sql`, …), più `installa_tutto.sql` che le unisce e
  `LEGGIMI.md` con l'ordine di installazione. Si applicano con il connettore Supabase (`apply_migration`).
  Attenzione: le istruzioni con `delete`/`drop` dal connettore chiedono una conferma che scade; quelle parti
  le incolla Stefano nell'SQL Editor. Per evitare i `drop`, si rinomina o si usa `create or replace`.
- Calcoli mensili nel database; storico congelato da un'attività pianificata (pg_cron).
- **Admin**: colonna `is_admin` (non scrivibile dal telefono) e funzione `sono_admin()` dentro le funzioni riservate;
  l'elenco di cosa può fare un admin sta in `ADMIN.md`.
- **Dati da un gestionale esterno** (es. il report Amway in CSV): si leggono nel browser, al database arrivano solo
  i campi che servono; la struttura e i numeri ufficiali vengono da lì (`growup-team/supabase/016_*`, `017_*`).
- **Copia di sicurezza**: il piano gratuito non fa backup; funzione `copia_dati()` solo admin + pulsante
  nell'app che scarica un JSON da tenere su Google Drive ogni mese.

## Accesso senza email
- **Link d'invito** `…/#CODICE` (codice dello sponsor): la persona scrive nome e qualifica ed entra sotto lo sponsor.
- **Link personale** `…/#chiave=<32 esadecimali>`: la chiave del profilo; ognuno se la manda su WhatsApp
  (chat con sé stesso) o Telegram (Messaggi salvati). Nel database solo l'impronta sha256.
- Ogni telefono entra con un **accesso anonimo** Supabase; la tabella `accessi` collega l'utente anonimo al
  profilo. Più telefoni sullo stesso profilo (es. Stefano e Alessia) è normale.
- Il link d'invito e il link personale si tolgono dalla barra degli indirizzi appena letti.
- Prima del lancio pubblico: captcha (Cloudflare Turnstile) e limite "anonymous sign-ins" più alto.

## Telefoni (collaudo)
- **Android/Chrome**: l'app installata condivide i dati con Chrome; "Installa" dal menu o dalla proposta del
  browser. Chrome non apre da una pagina web la scelta dell'app di calendario: si usa Google Calendar web
  (`calendar.google.com/calendar/render?action=TEMPLATE…`) e il file .ics come riserva.
- **iPhone/Safari**: "Aggiungi alla schermata Home"; l'app sulla Home ha **memoria separata** da Safari, quindi
  al primo avvio serve "Incolla il link personale" (pulsante che legge gli appunti). Il file .ics si apre
  direttamente in "Aggiungi al calendario".
- La navigazione a gesti di Android usa i bordi dello schermo: il passaggio col dito va fatto da metà schermo.

## Controlli prima di ogni PR
- **Permessi**: `supabase/tests_rls.sql` è un unico blocco `do $$ … $$` con funzioni di appoggio in uno schema
  `growup_test`, che simula utenti diversi (`set role authenticated` + `request.jwt.claims`), controlla ogni
  regola con `ok(...)`/`deve_fallire(...)` e alla fine annulla tutto con un'eccezione; deve stampare
  "TUTTI I CONTROLLI SUPERATI". Si prova su Postgres locale con `test/stub_supabase.sql` (imita `auth` e ruoli).
- **Interfaccia**: `test/e2e/head.mjs` + `body.mjs` (Playwright con Chromium) e `mock.js` che sostituisce
  Supabase (`window.GROWUP_API`); si serve la cartella con `npx http-server`. Si controllano i flussi veri
  e si fanno screenshot a 390 px, chiaro e scuro, da guardare prima di consegnare.
- Nessun ID di modello o chiave segreta nei commit e nelle PR.
