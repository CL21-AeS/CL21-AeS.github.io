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

Gli admin **non vedono le liste** (pagina Persone) di nessuno, neanche nella copia di sicurezza: di ogni partner
vedono solo i numeri della lista nella sua scheda, come ogni upline.

Gli admin **vedono la struttura come tutti gli altri**: chi usa l'app nel proprio gruppo e le persone importate
da loro. Le persone importate dagli altri le trovano solo nella copia di sicurezza.

## In Supabase (Table editor / SQL Editor)

| Cosa | Dove |
|---|---|
| Requisiti delle tappe, guadagni, soglie delle percentuali | tabelle `stage_requirements`, `percent_levels` (le policy permettono di scrivere solo agli admin) |
| Impostazioni (giorno di chiusura del mese, soglie delle etichette, obiettivi proposti) | tabella `settings` |
| Migrazioni nuove (`supabase/0NN_*.sql`) | SQL Editor: quelle con cancellazioni il connettore di Claude non riesce ad applicarle, si incollano a mano |
| Captcha (Cloudflare Turnstile) | Authentication → Attack Protection: acceso con la Secret Key del widget "Growup Team" (account Cloudflare di Stefano). Se un giorno nessuno riesce a entrare per colpa del captcha, si spegne da qui e l'app continua a funzionare |
| Link personale perso dell'admin stesso | `select public.nuova_chiave_per(id) from public.partners where is_admin;` (SQL Editor) |

## Cosa NON può fare nessuno, neanche un admin

**Cancellare persone dall'app.** La struttura rispecchia il report Amway: chi non c'è più resta segnato "non più nel
report" e nascosto. Ognuno può solo nascondere chi vuole dalla propria struttura (i VP contano lo stesso).

## Richiesta di cancellazione dei dati (diritto all'oblio)

È l'unico caso in cui si cancella, e lo fa un admin dall'SQL Editor di Supabase dopo una richiesta scritta della persona.
Prima scaricare la copia di sicurezza. Sostituire il codice Amway della persona:

```sql
-- chi stava sotto passa al suo sponsor; con la persona spariscono le sue attività, obiettivi, storico e telefoni collegati
with t as (select id, sponsor_id from public.partners where codice_amway = '0000000')
update public.partners p set sponsor_id = t.sponsor_id from t where p.sponsor_id = t.id;
delete from public.partners where codice_amway = '0000000';
```

Se la persona era stata importata da più partner (copie), il comando le toglie tutte. Ai prossimi import tornerebbe
dal report: in quel caso va avvisato chi la importa.

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
