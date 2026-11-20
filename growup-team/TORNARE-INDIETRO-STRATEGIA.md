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
| 4 | [#237](https://github.com/CL21-AeS/CL21-AeS.github.io/pull/237) | «Oggi per la tua strategia» al posto della lista di oggi: i binari Persone e Fatturato | nessuna | — |
| 5 | [#238](https://github.com/CL21-AeS/CL21-AeS.github.io/pull/238) | La festa del Path to Bronze e, dopo, le sue linee nuove come suggerimento; service worker v123 | nessuna | — |
| 6 | [#239](https://github.com/CL21-AeS/CL21-AeS.github.io/pull/239) | «Cambia» per linea: prima la linea, poi chi aiuti solo tra le persone di quella linea | nessuna | — |
| 7 | [#241](https://github.com/CL21-AeS/CL21-AeS.github.io/pull/241) | Path to Bronze: contano solo le linee nuove (dal 1° giugno 2026); prossima tappa vera per chi è già oltre | `068_linee_nuove_dal.sql` (solo il valore `linee_nuove_dal` del Path to Bronze) | `supabase/068_linee_nuove_dal_togli.sql` (lo rimette vuoto) |
| 8 | [#242](https://github.com/CL21-AeS/CL21-AeS.github.io/pull/242) | Tutte le linee che seguo nella card e, toccandole, «Come aiutarlo a qualificare» nella scheda partner | nessuna | — |
| 9 | [#243](https://github.com/CL21-AeS/CL21-AeS.github.io/pull/243) | «Linea più forte» dagli ultimi 12 mesi chiusi e i VP veri delle linee con persone al 21% nell'analisi; service worker v125 | nessuna | — |
| 10 | [#244](https://github.com/CL21-AeS/CL21-AeS.github.io/pull/244) | Correzione: toccando la persona in una casella si apre la sua scheda (non la strategia); service worker v126 | nessuna | — |
| 11 | [#245](https://github.com/CL21-AeS/CL21-AeS.github.io/pull/245) | Correzione: toccando una casella da trovare («Nuovo in profondità», «Nuova linea frontale», «Casella libera») non si apre niente, solo il suo pulsante; service worker v127 | nessuna | — |

Per tornare a tutto com'era: «Revert» delle PR dalla 11 alla 1 (o chiedere a Claude di riportare la cartella al tag),
poi, se si vuole, gli script della 068 e della 067.

La 068 è applicata al database vero dal 20 novembre 2026.

Da sapere sulla 068: non crea niente, cambia solo un valore della tabella delle tappe. **Per rimetterlo vuoto** incolla
nell'SQL Editor `supabase/068_linee_nuove_dal_togli.sql` (una riga: `update public.stage_requirements set linee_nuove_dal =
null where chiave = 'path_to_bronze';`). Con il valore vuoto anche l'app della PR 7 conta di nuovo tutte le linee; l'app di
prima, con il valore scritto, contava solo le linee nuove nella strategia (non nell'Obiettivo).

La 067 è applicata al database vero dal 18 novembre 2026: per toglierla serve lo script qui sopra.

Da sapere sulla 067: se si annulla la PR 3 ma la tabella resta nel database, l'app torna a ricordare le caselle sul
telefono (come nel punto 2) e le caselle salvate nella tabella non si vedono più; se si toglie la tabella e la PR 3 resta,
l'app se ne accorge e usa il telefono.
