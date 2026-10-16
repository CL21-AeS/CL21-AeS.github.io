# Growup Team — Piano tecnico della Fase 2 (visione upline)

Approvato da Stefano il 15 ottobre 2026. Si lavora un blocco alla volta, ognuno collaudabile da solo
e pubblicato con una sua PR.

## Obiettivo

L'upline vede tutta e sola la propria organizzazione, a qualsiasi profondità; capisce dove si blocca
ciascun partner e tiene aggiornati i numeri di chi non usa l'app.
"Fatta quando" (brief): un upline vede tutta e sola la propria downline e un partner non vede i colleghi
di altre linee (già garantito dalla RLS della Fase 1).

## Decisioni di Stefano

**Principio (16 ottobre 2026): l'app non dà suggerimenti.** Rende evidenti i dati, il percorso e le eventuali
mancanze di quello che viene fatto; come muoversi lo decide ogni partner, da solo. Niente frasi del tipo "allenate…",
"costruisci…", "lavorate su…", niente azioni suggerite: solo numeri, soglie e cosa manca.

| Tema | Decisione |
|---|---|
| Soglie percentuali (VP di gruppo nel mese) | 3% = 200 · 6% = 600 · 9% = 1.200 · 12% = 2.400 · 15% = 4.000 · 18% = 7.000 · 21% = 10.000 (tabella di amministrazione) |
| Chiusura del mese | il giorno **5** del mese successivo: fino ad allora il mese precedente si può ancora correggere, poi viene congelato |
| Link personale perso | lo rigenerano **solo Stefano e Alessia** (admin), dall'app |
| Etichette del gruppo | **Non aggiorna · Contatti sotto soglia · Piani sotto soglia · VP sotto soglia · In crescita** (soglie nelle impostazioni; fino al 16 ottobre si chiamavano Da chiamare, Lista nomi, Invito, Follow-up) |
| Fissa una chiamata | **entrambi**: promemoria nel calendario del telefono e messaggio WhatsApp già scritto |
| Numeri di chi non usa l'app | li inserisce chi l'ha aggiunto e tutta la sua upline (anche "Aggiorna il totale") |

## Blocchi

1. **Calcoli e pagina Io**
   - VP personali e di gruppo del mese, VP di ogni linea frontale, linee attive (≥ 100 VP, impostazione),
     percentuale raggiunta (tabella `percent_levels`) e qualifica del mese, tutto calcolato nel database
     su "io e la mia downline".
   - Tappe dal Path to Bronze in su riconosciute dai numeri; percentuale e qualifica mostrate separate
     ("9% raggiunto · Bronze Foundation non qualificato: manca la terza linea"); "Linee attive: 2 su 3. Manca 1 linea".
   - Storico mensile: tabella `monthly_totals` congelata il giorno 5 da un'attività pianificata (pg_cron);
     il mese in corso e quello non ancora chiuso si calcolano dal vivo.
   - Pagamenti Foundation/Builder contati in automatico dai mesi qualificati (12 entro 18 mesi).
   - "Aggiorna il totale" anche per il mese precedente fino al giorno 5; dopo, il database rifiuta
     registrazioni nei mesi chiusi.
2. **Struttura con i numeri e partner senza app**
   - Accanto a ogni nome: stato attivo / rallenta / fermo (7 / 14 giorni), VP del mese, VP di gruppo, linee attive.
   - Per chi è senza app: inserire contatti, piani, ordini, "Aggiorna il totale", obiettivi; ogni dato mostra chi
     l'ha inserito.
   - Conferma dello sponsor sul punto di partenza (qualifica e pin dichiarati) con il riquadro "Da confermare".
   - Rigenerare il link personale di un partner (solo admin).
3. **Imbuto ed elenco per urgenza** (pagina Gruppo)
   - Imbuto contatti → piani → VP delle ultime 4 settimane, con tassi di passaggio e passaggio sotto soglia.
   - "Situazione per persona": elenco ordinato per urgenza con le etichette (vedi sopra).
   - Fatto: soglie in `settings.soglie_etichette` (migrazione `010_etichette.sql`), regole in STATO.md.
     Chi è senza app non ha etichetta (decisione di Stefano).
4. **Scheda partner e storico del gruppo**
   - **Confronto con i suoi numeri del mese prima** (scelta di Stefano, 16 ottobre: non con la media del gruppo):
     contatti, piani, ordini, nuovi clienti, VP personali di questo mese fino a oggi, del mese prima allo stesso
     giorno e del mese prima intero; VP di gruppo e linee attive col totale del mese prima. ▼ in rosso dove è sotto
     il mese prima allo stesso giorno, **senza azioni suggerite**. FATTO (16 ottobre).
   - Fissa una chiamata: evento di calendario (.ics) con promemoria e note, e messaggio WhatsApp già scritto.

## Regole di sicurezza nuove

- Su un partner **gestito** (senza app) scrivono chi l'ha inserito e tutta la sua upline; su un partner **attivo**
  nessun upline scrive (come in Fase 1).
- I calcoli passano da funzioni che restituiscono solo me e la mia downline.
- Ogni nuova regola entra in `supabase/tests_rls.sql`.

## Fuori dalla Fase 2

Presa in carico dopo 14 giorni e avvisi (Fase 3); diagnosi automatica più fine, serie di settimane,
obiettivi 90 giorni, grafica definitiva (Fase 4).
