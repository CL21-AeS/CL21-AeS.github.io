# Il metodo — come costruiamo le app di Stefano e Alessia

Questo file è la "ricetta" usata per Growup Team (ottobre 2026). Serve a ripartire con un'altra app senza
ridecidere tutto: **a inizio di un nuovo progetto, Claude legge questo file e lo segue**, salvo dove Stefano
dice diversamente. Gli esempi concreti stanno nei file di `growup-team/` citati qui sotto.

## 1. Come lavoriamo insieme

- **Lingua**: tutto in italiano (testi dell'app, commenti nel codice, documenti, messaggi dei commit e delle PR).
- **Prima il piano, poi il codice.** Per ogni cosa nuova: Claude analizza, fa domande, propone un piano e aspetta
  l'ok di Stefano. "Non modificare nulla finché non ti do l'ok" va rispettato alla lettera.
- **Per la grafica, prima si guarda e poi si applica**: Claude prepara una tavola di prova (pagina privata su
  claude.ai con le schermate vere e i dati finti, chiaro/scuro), Stefano sceglie, poi si modifica l'app.
  Esempi: `growup-team/design/tavola-grafica.html` (10 stili), la tavola delle icone, la tavola dell'invito.
- **Un ramo di lavoro, una PR per ogni consegna**; Stefano unisce lui le PR su GitHub. Claude non unisce.
- **Stato del progetto sempre aggiornato** in un file (`STATO.md`): cosa è fatto, decisioni prese, prossimi passi.
  A inizio sessione Claude lo legge per primo. Il piano di una fase va in un file a parte (es. `FASE2.md`).
- **Domande con le opzioni**: quando c'è una scelta, Claude propone 2-4 opzioni con la sua raccomandazione.
- **Collaudo dal telefono** di Stefano (Android) e di Alessia (iPhone) dopo ogni blocco importante.

## 2. Principi delle app

- **L'app non dà suggerimenti**: mostra dati, percorso, mancanze e soglie; come muoversi lo decide la persona.
  Niente "allena…", "costruisci…", "lavora su…".
- **Semplicità**: registrare un dato in 1-2 tocchi; campi numerici vuoti con lo 0 grigio (se non scrivi, vale quello).
- **Privacy**: ognuno vede i suoi dati e quelli del proprio gruppo, mai quelli di altre linee; i dati intimi
  (es. il "perché" dell'obiettivo) solo la persona. Dati in UE.
- **Pensata per il telefono**: larghezza 390 px, tema chiaro e scuro che segue il telefono, installabile sulla Home.

## 3. La tecnica che ha funzionato

| Pezzo | Scelta | Dove vederlo |
|---|---|---|
| Codice | **GitHub**, repository `CL21-AeS/CL21-AeS.github.io`, una cartella per app | `growup-team/` |
| Pubblicazione | **GitHub Pages** (gratis): ogni PR unita è online in un minuto | `https://cl21-aes.github.io/<cartella>/` |
| App | **HTML + JavaScript senza build** (niente npm/framework): `index.html` (stile), `app.js` (logica), `config.js` | `growup-team/app.js` |
| Database | **Supabase**, regione **Central EU (Francoforte)**; Claude ci lavora con il connettore Supabase | progetto `mxpuvmggexjyieylmfss` |
| Libreria | solo `@supabase/supabase-js` da jsDelivr con versione fissa e controllo di integrità (SRI) | `growup-team/index.html` |
| Installazione | PWA: `manifest.webmanifest` + `sw.js` (prima la rete, poi la cache) + icone 192/512 + apple-touch-icon 180 | `growup-team/` |
| Caratteri | Google Fonts (oggi Cormorant Garamond + Manrope) | `growup-team/index.html` |

### Accesso senza email
- Si entra dal **link d'invito** dello sponsor (`…/#CODICE`) e poi dal **link personale** (`…/#chiave=…`) che
  ognuno si manda su WhatsApp o Telegram. Supabase con **accessi anonimi** + tabella `accessi` che collega il
  telefono al profilo. Nel database solo l'**impronta** (sha256) della chiave, mai la chiave.
- Su iPhone l'app sulla Home ha memoria separata da Safari: serve "Incolla il link personale" al primo avvio.
- Prima del lancio pubblico: captcha Cloudflare Turnstile sul primo accesso anonimo (`controlloSicurezza()` in
  `app.js`: il gettone va a `signInAnonymously({ options:{ captchaToken } })`; CSP con `challenges.cloudflare.com`
  in `script-src` e `frame-src`), limite degli accessi anonimi, provider Email spento. Ordine: prima la PR con il
  captcha nell'app, poi lo si accende in Supabase (al contrario nessuno entrerebbe).

### Sicurezza (non negoziabile)
- **Row Level Security su ogni tabella**; nel codice **solo la chiave publishable**, mai la secret/service_role.
- Le operazioni delicate passano da **funzioni `security definer`** con `search_path` fissato e controlli dentro
  (es. `cancella_partner`, `cambia_sponsor`, `obiettivi_gruppo`).
- Ogni regola nuova entra in `supabase/tests_rls.sql`.

### Database: come si fanno le modifiche
- **Migrazioni numerate** in `supabase/` (`001_schema.sql`, `002_rls.sql`, … `019_partenza_senza_conferma.sql`), più
  `installa_tutto.sql` che le contiene tutte per installare da zero, e `LEGGIMI.md` con l'ordine.
- Claude le applica con il connettore Supabase. Le istruzioni con `delete`/`drop` dal connettore chiedono una
  conferma che scade: quelle parti le incolla Stefano nell'SQL Editor.
- Calcoli del mese nel database (`riepilogo_mese`, `calcola_mese`), storico congelato da un'attività pianificata
  (pg_cron) il giorno 5.

### Controlli prima di ogni PR
- **Permessi**: `tests_rls.sql` è un unico blocco che crea dati di prova, controlla tutto e annulla alla fine
  ("TUTTI I CONTROLLI SUPERATI"); si prova su Postgres locale con `test/stub_supabase.sql` e sul progetto.
- **Interfaccia**: test con Playwright e un finto Supabase (`test/e2e/mock.js`), istruzioni in `test/LEGGIMI.md`;
  screenshot di ogni schermata nuova, in chiaro e in scuro, guardati prima di consegnare.
- La PR spiega cosa cambia in parole semplici e cosa è stato verificato.

## 4. Grafica (stile in uso e alternative)

Stile **H · Smeraldo e rame**, icona **G Smeraldo**; colori, caratteri e alternative tenute (**B + D**, **E**) in
`growup-team/design/GRAFICA.md`. Per un'app nuova si può ripartire da questi colori o rifare una tavola di prova.

## 5. La skill

Lo stesso metodo è anche una **skill** di Claude: `growup-team/skill/metodo-app-stefano/` (sorgente; il file da
caricare nell'account si rigenera da qui). Installata nell'account claude.ai, Claude la usa da solo quando
Stefano chiede di creare o modificare un'app, anche in altri repository. Quando il metodo cambia, si aggiornano
insieme questo file e la skill.

## 6. Per iniziare un'app nuova (da dire a Claude)

> «Leggi `growup-team/METODO.md` nel repository CL21-AeS/CL21-AeS.github.io e usa lo stesso metodo
> per una nuova app che si chiama … e serve a …»

Claude poi: crea la cartella nuova nello stesso repository (o un repository nuovo, se Stefano lo preferisce),
propone il piano, e per il database un nuovo progetto Supabase in UE (o nuove tabelle nello stesso, da decidere).
