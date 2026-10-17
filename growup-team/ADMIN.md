# Growup Team — cosa può fare un admin

Gli admin oggi sono **Stefano e Alessia**: un solo profilo, "Stefano e Alessia", usato da due telefoni.
Questo file elenca tutto quello che un admin può fare in più rispetto agli altri partner: serve se in futuro
si decide di dare il ruolo a un'altra persona. Va aggiornato ogni volta che si aggiunge o si toglie una
funzione da admin.

## Nell'app (pulsanti che vedono solo gli admin)

| Dove | Cosa | A cosa serve |
|---|---|---|
| Scheda di un partner → **Invita sotto questa persona** | link d'invito di quella persona (WhatsApp, Telegram, Copia) | far entrare qualcuno sotto una persona precisa, anche nei gruppi dei Platino che il report Amway non mostra |
| Scheda di un partner → **Invita chi manca sopra** | link speciale, valido una volta sola; si possono spuntare altri frontali dello stesso sponsor | far entrare qualcuno **tra** lo sponsor e la persona (che passa sotto di lui con il suo gruppo) |
| Scheda di un partner → **Correggi il codice Amway** | cambia il codice Amway di chi usa l'app (o il proprio, in fondo alla pagina Io) | solo per un errore di battitura all'ingresso: l'import di quella persona lo segnala ("chiedi a Stefano e Alessia di correggerlo") |
| Scheda di chi usa l'app → **Nuovo link personale** | crea un link personale nuovo; quello vecchio smette di funzionare | per chi ha perso il suo link |
| In fondo alle pagine → **Scarica la copia dei dati** | file `growup-copia-AAAA-MM-GG.json` con tutte le tabelle | copia di sicurezza mensile (procedura in `LEGGIMI.md`) |

Gli admin **vedono la struttura come tutti gli altri**: chi usa l'app nel proprio gruppo e le persone importate
da loro. Le persone importate dagli altri le trovano solo nella copia di sicurezza.

## In Supabase (Table editor / SQL Editor)

| Cosa | Dove |
|---|---|
| Requisiti delle tappe, guadagni, soglie delle percentuali | tabelle `stage_requirements`, `percent_levels` (le policy permettono di scrivere solo agli admin) |
| Impostazioni (giorno di chiusura del mese, soglie delle etichette, obiettivi proposti) | tabella `settings` |
| Migrazioni nuove (`supabase/0NN_*.sql`) | SQL Editor: quelle con cancellazioni il connettore di Claude non riesce ad applicarle, si incollano a mano |
| Link personale perso dell'admin stesso | `select public.nuova_chiave_per(id) from public.partners where is_admin;` (SQL Editor) |

## Come si nomina un nuovo admin

Nell'SQL Editor di Supabase (sostituire il nome):

```sql
update public.partners set is_admin = true where nome = 'Nome Cognome';
-- per togliere il ruolo:
update public.partners set is_admin = false where nome = 'Nome Cognome';
```

Dal telefono nessuno può darsi il ruolo da solo (il campo `is_admin` non si scrive dall'app).

## Funzioni del database riservate agli admin

`sono_admin()` è il controllo. Lo usano: `nuova_chiave_per`, `copia_dati`, `imposta_codice_amway` (per gli altri),
`crea_invito_sopra`, e le policy di scrittura di `stage_requirements`, `settings`, `percent_levels`.
Funzioni da admin tolte nel tempo: `cambia_sponsor` (17 ottobre 2026: la posizione la decide il report Amway).
