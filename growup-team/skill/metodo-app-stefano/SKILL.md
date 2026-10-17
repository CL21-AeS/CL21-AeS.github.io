---
name: metodo-app-stefano
description: Il metodo di lavoro e la tecnica con cui Stefano e Alessia (A&S, gruppo Cum Laude 21) costruiscono le loro web app con Claude, provati con Growup Team. Usa questa skill ogni volta che Stefano chiede di creare, progettare, modificare o pubblicare un'app o una pagina web, anche se non lo dice esplicitamente ("facciamo un'app per…", "aggiungi una pagina", "serve un database", "come la pubblico", "fammi vedere prima la grafica"), quando si parla di GitHub Pages, Supabase, accesso con link senza email, RLS, PWA installabile, o del repository CL21-AeS/CL21-AeS.github.io. Vale anche per riprendere o estendere Growup Team.
---

# Il metodo delle app di Stefano e Alessia

Stefano (Italia, partner Amway da oltre 16 anni con la moglie Alessia, gruppo Cum Laude 21) costruisce con Claude
piccole web app per il proprio gruppo di network marketing. Il primo progetto completo è **Growup Team**
(repository GitHub `CL21-AeS/CL21-AeS.github.io`, cartella `growup-team/`, online su
`https://cl21-aes.github.io/growup-team/`). Questa skill raccoglie ciò che ha funzionato, perché un progetto nuovo
riparta da lì invece che da zero.

Stefano non è un programmatore: parla in italiano, vuole capire le scelte, decide lui. Ama le domande di
approfondimento e le idee da esperto del settore (network marketing), ma le decisioni restano sue.

## Come lavorare con Stefano

1. **Italiano ovunque**: testi dell'app, commenti nel codice, documenti, commit, PR, messaggi.
2. **Prima il piano, poi il codice.** Analizza, fai domande con 2-4 opzioni (indica quella raccomandata),
   scrivi il piano e aspetta l'ok. Se Stefano dice "non modificare nulla finché non ti do l'ok", rispettalo
   alla lettera. Il motivo: Stefano vuole capire e scegliere prima, e correggere dopo costa di più a lui.
3. **Per la grafica, prima si guarda**: prepara una **tavola di prova** (pagina privata su claude.ai) con le
   schermate vere e dati finti, in chiaro e scuro, e varie direzioni da confrontare; si applica solo la scelta.
   Lo stesso per icone e immagini (es. l'immagine d'invito per WhatsApp).
4. **Una consegna = una PR**, su un ramo di lavoro; la PR spiega in parole semplici cosa cambia e cosa è stato
   verificato. **Stefano unisce lui** le PR. Dopo l'unione, il ramo riparte dal principale.
5. **Diario del progetto**: un file `STATO.md` nella cartella dell'app (fatto, decisioni, prossimi passi),
   aggiornato a ogni consegna e letto per primo a ogni nuova sessione; il piano di una fase in un file a parte.
   Un `CLAUDE.md` nella cartella con le regole essenziali. Se l'app ha un ruolo **admin**, un file `ADMIN.md` elenca
   tutto quello che può fare un admin e come si nomina (esempio: `growup-team/ADMIN.md`); si aggiorna a ogni funzione
   da admin aggiunta o tolta, così un giorno si può dare il ruolo a un'altra persona sapendo cosa le si affida.
6. **Risposte**: brevi, concrete, con un consiglio da esperto quando serve e una domanda per il passo successivo.
   Niente gergo tecnico non spiegato.
7. **Collaudo dal telefono**: Stefano usa Android con Google Calendar, Alessia iPhone. Ricorda le differenze
   (vedi `references/tecnica.md`, "Telefoni").

## Principi delle app

- **L'app non dà suggerimenti**: mostra dati, percorso, mancanze e soglie ("sotto soglia", "▼ sotto il mese
  prima"); come muoversi lo decide la persona. Niente frasi tipo "allena…", "lavora su…", "costruisci…".
- **Semplicità d'uso**: un dato in 1-2 tocchi; campi numerici vuoti con lo 0 (o il valore attuale) in grigio.
- **Privacy**: ognuno vede i propri dati e quelli del proprio gruppo (downline), mai altre linee; i dati intimi
  solo la persona. Dati in Unione Europea.
- **Telefono prima di tutto**: 390 px, tema chiaro/scuro che segue il telefono, installabile sulla Home.

## Tecnica di base (dettagli in `references/tecnica.md`)

- **GitHub + GitHub Pages**: un repository, una cartella per app; pubblicazione gratuita a ogni PR unita.
- **HTML + JavaScript senza build**: `index.html` (stile), `app.js` (logica), `config.js` (URL e chiave pubblica).
  Unica libreria: `@supabase/supabase-js` da jsDelivr con versione fissa e SRI.
- **Supabase in UE (Francoforte)**, gestito con il connettore Supabase: tabelle, RLS su tutto, funzioni
  `security definer` per le operazioni delicate, migrazioni numerate + `installa_tutto.sql`.
- **Accesso senza email**: link d'invito dello sponsor + link personale con chiave (accessi anonimi Supabase).
- **Controlli prima di ogni PR**: test dei permessi in SQL e test dell'interfaccia con Playwright e un finto
  Supabase; screenshot guardati prima di consegnare.

Per la grafica in uso e le alternative tenute da parte leggi `references/grafica.md`.
Per l'inizio di un progetto nuovo segui la lista qui sotto.

## Iniziare un'app nuova

1. Chiedi: a cosa serve, chi la usa (solo voi, il gruppo, i clienti), quali dati, chi vede cosa.
2. Proponi il piano (fasi piccole, ognuna collaudabile da sola) e aspetta l'ok.
3. Cartella nuova nel repository `CL21-AeS/CL21-AeS.github.io` (o repository nuovo se Stefano preferisce);
   non toccare le cartelle delle altre app.
4. Database: nuovo progetto Supabase in UE o nuove tabelle nello stesso progetto (da decidere con Stefano).
5. Copia lo scheletro di Growup Team (accesso con link, RLS, PWA, test) invece di reinventarlo:
   i file di riferimento sono elencati in `references/tecnica.md`.
6. Prima consegna piccola, poi collaudo dal telefono, poi si prosegue.
