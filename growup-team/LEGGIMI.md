# Growup Team — come metterla in funzione (Fase 1)

Indirizzo dell'app: **https://cl21-aes.github.io/growup-team/**

Growup Team sostituisce `growup/` con un database condiviso. **Non si usa l'email**: si entra con un link.

- **Link d'invito** (`…/growup-team/#ABC234`): ogni partner ha il suo e lo manda su WhatsApp o Telegram ai nuovi.
  Chi lo apre scrive nome, qualifica e (se sta iniziando) data di iscrizione, e inizia, sotto chi l'ha invitato.
- **Link personale** (`…/growup-team/#chiave=…`): è la chiave del proprio profilo. L'app lo consegna al primo
  ingresso e chiede di mandarlo **a sé stessi** (WhatsApp: chat con sé stessi · Telegram: Messaggi salvati).
  Toccandolo si rientra da qualsiasi telefono o computer. Non va inoltrato.
- "La mia settimana": obiettivi di contatti e piani; "Il mio mese": obiettivo VP e nuovi clienti;
  **+ Contatto**, **+ Piano**, **+ Ordine** sempre in basso.
- Il percorso base: visione Argento, tappa attuale, conto alla rovescia dei 30 giorni per il primo ordine.

`growup/` resta com'è e continua a funzionare.

### Come funziona la chiave (in breve)

Ogni telefono entra in Supabase con un **accesso anonimo** e, presentando la chiave, viene collegato al profilo.
Più telefoni possono stare sullo stesso profilo (Stefano e Alessia, o telefono + computer).
Nel database c'è solo l'**impronta** della chiave, mai la chiave: nemmeno chi vede il database può ricostruirla.
Dal menu ⋯ → *Il mio link personale* → *Crea un link nuovo*, il vecchio link smette di funzionare e gli altri
telefoni vengono scollegati (da usare se il link è finito a qualcun altro).

---

## 1. Creare il progetto Supabase (10 minuti)

1. Vai su <https://supabase.com>, crea un account e un **nuovo progetto**.
2. **Regione: Central EU (Frankfurt)** — i dati restano nell'Unione Europea.
3. Scegli una password del database e conservala (non serve all'app, serve a voi).

## 2. Creare le tabelle

Nel progetto: **SQL Editor → New query**. Incolla e lancia, **in quest'ordine**, il contenuto di:

1. `supabase/001_schema.sql` — tabelle e funzioni
2. `supabase/002_rls.sql` — le regole di sicurezza
3. `supabase/003_seed.sql` — requisiti delle tappe, guadagni e il vostro profilo **"Stefano e Alessia"**
   (un solo profilo e un solo codice d'invito per tutti e due). Alla fine stampa **due link**:
   - `link_personale`: la vostra chiave. Apritelo su entrambi i telefoni e salvatelo nei vostri
     "Messaggi salvati". **Si vede solo adesso**: copiatelo subito.
   - `link_invito`: da mandare ai vostri partner diretti.
4. `supabase/006_fase2_calcoli.sql` — i calcoli del mese (VP di gruppo, linee, percentuali, storico)
5. `supabase/007_fase2_gestiti.sql` — numeri inseriti dall'upline per chi non usa l'app, conferma del punto di partenza
6. `supabase/008_inserisci_in_mezzo.sql` — inserire una persona mancante in mezzo alla linea
7. `supabase/009_cancella_e_sposta.sql` — cancellare una persona (il suo gruppo sale) e cambiare sponsor (admin)
8. `supabase/011_cambia_sponsor_nel_gruppo.sql` — cambiare sponsor anche verso qualcuno del proprio gruppo
9. `supabase/012_preferiti.sql` — le persone che ognuno segna come preferite per seguirle da vicino
10. `supabase/013_obiettivo.sql` — il primo obiettivo di ognuno (cifra al mese, entro quando, perché)
11. `supabase/010_etichette.sql` — le soglie delle etichette del gruppo (Non aggiorna, Contatti / Piani / VP sotto soglia)
12. `supabase/006b_chiusura_pianificata.sql` — l'attività pianificata che il giorno 5 chiude il mese precedente
13. `supabase/tests_rls.sql` — controlla i permessi. Deve finire con **TUTTI I CONTROLLI SUPERATI**
   e non lascia dati di prova.

In alternativa ai punti 1-11: `supabase/installa_tutto.sql` li contiene già tutti, in un solo incolla.
I file `004_*` e `005_*` servono solo al progetto già installato: il loro contenuto è già dentro 001-003.

## 3. Attivare l'accesso senza email

**Authentication → Sign In / Providers**:

- **Allow anonymous sign-ins: ON** (è quello che permette di entrare con il solo link)
- Le email non servono: non c'è niente da configurare per l'invio di email.

**Authentication → Rate Limits**: il limite *anonymous sign-ins* è per indirizzo IP, di default 30 all'ora.
Se fate entrare molte persone insieme alla stessa serata, sulla stessa rete Wi-Fi, alzatelo (per esempio a 100).

## 4. Indirizzi consentiti

**Authentication → URL Configuration** → Site URL: `https://cl21-aes.github.io/growup-team/`

## 5. Collegare l'app al progetto

In **Project Settings → API Keys** copia:

- l'**URL del progetto** (tipo `https://abcd1234.supabase.co`)
- la chiave **pubblica**: *publishable* (`sb_publishable_…`) oppure *anon*

e mettile in `growup-team/config.js` (oppure mandale a Claude Code e lo fa lui).

> ⚠️ **Mai** la chiave *secret* / *service_role*. Il repository è pubblico: nel codice può stare solo la
> chiave pubblica, che è sicura perché ogni tabella ha la Row Level Security attiva.
> GitHub Pages non ha "impostazioni segrete": tutto ciò che il browser usa è visibile, ed è giusto così.

## 6. Collaudo (criterio della Fase 1)

1. Stefano apre il `link_personale` dal telefono: entra come "Stefano e Alessia". Alessia fa lo stesso dal suo.
2. Nel riquadro **Invita un nuovo partner** mandate il link d'invito su WhatsApp o Telegram a un secondo telefono di prova.
3. Il secondo telefono apre il link, scrive nome, qualifica e data: inizia.
   L'app gli chiede di salvare il suo link personale: lo manda a sé stesso.
4. Registra un contatto: **un tocco** su *+ Contatto*.
5. Apre il suo link personale da un altro dispositivo (o dal computer): ritrova il contatto e gli obiettivi.
6. In Supabase → **Table editor → partners** il nuovo partner ha come `sponsor_id` il vostro profilo.

## Amministrazione

- **Requisiti delle tappe e guadagni**: tabella `stage_requirements` (Table editor). Cambiate i numeri lì:
  l'app li legge a ogni apertura. Le cifre vengono dal *Simulatore di reddito ufficiale Amway*.
- **Impostazioni**: tabella `settings` (obiettivi proposti, soglia della linea attiva, fonte e avviso dei guadagni,
  `soglie_etichette` per le etichette del gruppo e i passaggi sotto soglia dell'imbuto).
- **Un partner ha perso il suo link personale**: nell'SQL editor

  ```sql
  select 'https://cl21-aes.github.io/growup-team/#chiave=' || public.nuova_chiave_per(id)
  from public.partners where nome = 'Nome Cognome';
  ```

  e mandategli il link su WhatsApp. I suoi vecchi telefoni vengono scollegati. (In Fase 2 lo farete dall'app.)
- **Cancellare un partner** (diritto all'oblio): Table editor → `partners` → elimina la riga; le sue attività e i suoi
  obiettivi spariscono con lui. Se ha persone sotto, prima spostatele sotto un altro sponsor.

## Com'è fatta

| File | Cosa contiene |
|---|---|
| `index.html` | la pagina e lo stile (stessi colori e componenti di `growup/`) |
| `app.js` | tutta la logica: link, ingresso, settimana, mese, percorso |
| `config.js` | indirizzo e chiave pubblica di Supabase |
| `manifest.webmanifest`, `sw.js`, `icon-*.png` | installazione sulla schermata Home |
| `supabase/` | tabelle, sicurezza, dati iniziali, controlli |

Unica dipendenza esterna: la libreria ufficiale `@supabase/supabase-js` 2.117.2 da jsDelivr, con controllo di integrità.

## Prossime fasi

- **Fase 2 — Visione upline**: Il mio gruppo, Scheda partner, Struttura; VP di gruppo e linee attive calcolati
  dall'albero; conferma dello sponsor sul punto di partenza.
- **Fase 3 — Partner gestiti e presa in carico**: inserimento per conto terzi, soglia dei 14 giorni, link per
  prendere possesso del profilo (stesso link personale, mandato su WhatsApp/Telegram), avvisi.
- **Fase 4 — Diagnosi e rifinitura**: mancanze evidenziate (nessun suggerimento: decide il partner), serie di settimane, 90 giorni.
