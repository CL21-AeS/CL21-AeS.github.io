# Tornare indietro: la versione di Io prima della «strategia»

Da novembre 2026 in cima a Io arriva **«La tua strategia»** (le caselle di lavoro, il Path to Bronze, i due binari di
oggi). Arriva in più PR, una per punto. Se la nuova Io non ti piace, puoi tornare **esattamente** alla versione di prima.
Questo file dice come, in parole semplici, e si aggiorna a ogni PR della strategia.

## Il punto di partenza

- La versione di prima ha un nome su GitHub: il tag **`prima-della-strategia`**.
- È il `main` del 18 novembre 2026, commit **`2c12e40`** (dopo la PR #232, «chi ha invitato resta segnato anche per chi
  era già nella mappa»), app **v122**, database fino alla migrazione **066**.

## Le regole che rendono possibile tornare indietro

1. **Nel database solo tabelle nuove.** Nessuna tabella, colonna o funzione che c'era già viene cambiata. L'app di prima
   non guarda le tabelle nuove: anche se restano nel database, funziona come prima.
2. **Ogni migrazione ha il suo script per toglierla** (`supabase/NNN_..._togli.sql`), scritto nella stessa PR.
3. **Ogni PR si può annullare con il pulsante «Revert» di GitHub**, partendo dall'ultima. Le PR 3, 4 e 5 non dipendono
   l'una dall'altra e si possono annullare anche da sole; la PR 2 (la card) usa il calcolo della PR 1, quindi per
   annullare la 1 si annullano prima tutte quelle dopo.

## Come tornare alla versione di prima (tutto)

**1. L'app.** Due strade, scegline una:
- **Con GitHub, da solo**: apri le PR della tabella qui sotto, dall'**ultima alla prima**, e in ognuna tocca
  **«Revert»** → «Create pull request» → «Merge». Dopo un minuto GitHub Pages pubblica la versione di prima.
- **Con Claude**: scrivi a Claude Code «Riporta la cartella growup-team alla versione del tag prima-della-strategia e
  apri una PR». Claude copia la cartella com'era nel tag e tu unisci la PR.

Sul telefono l'app si aggiorna da sola alla prima apertura con la rete (se serve, chiudila e riaprila).

**2. Il database** (facoltativo: l'app di prima funziona anche con le tabelle nuove). Nell'**SQL Editor** di Supabase
incolla ed esegui gli script «per toglierla» della tabella qui sotto, **dall'ultimo al primo**. Attenzione: togliendo una
tabella si cancellano anche i dati salvati lì (per esempio le caselle scelte).

## Come togliere un pezzo solo

Annulla con «Revert» solo quella PR e, se ha una migrazione, esegui il suo script per toglierla. Vale per le PR 3, 4 e 5;
per la 1 e la 2 vedi la regola 3 qui sopra.

## Le PR della strategia

| Punto | PR | Cosa fa | Migrazione nel database | Script per toglierla |
|---|---|---|---|---|
| 0 | [#233](https://github.com/CL21-AeS/CL21-AeS.github.io/pull/233) | Il tag `prima-della-strategia` e questo file | nessuna | — |
| 1 | [#234](https://github.com/CL21-AeS/CL21-AeS.github.io/pull/234) | Il calcolo della strategia, senza schermate nuove | nessuna | — |
| 2 | [#235](https://github.com/CL21-AeS/CL21-AeS.github.io/pull/235) | La card «La tua strategia» in cima a Io e la schermata intera; le caselle si ricordano sul telefono | nessuna | — |
| 3 | [#236](https://github.com/CL21-AeS/CL21-AeS.github.io/pull/236) | Le caselle nel database, i suggerimenti, gli invitati che arrivano nella mappa | `067_strategia_caselle.sql` (tabella `strategia_caselle`) | `supabase/067_strategia_caselle_togli.sql` |
| 4 | (questa) | «Oggi per la tua strategia» al posto della lista di oggi: i binari Persone e Fatturato | nessuna | — |

La riga del punto 5 si aggiunge quando la PR è pronta.

Da sapere sulla 067: se si annulla la PR 3 ma la tabella resta nel database, l'app torna a ricordare le caselle sul
telefono (come nel punto 2) e le caselle salvate nella tabella non si vedono più; se si toglie la tabella e la PR 3 resta,
l'app se ne accorge e usa il telefono.
