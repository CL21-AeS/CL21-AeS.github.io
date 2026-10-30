# Growup Team — cosa può fare un admin

Gli admin oggi sono **Stefano e Alessia**: un solo profilo, "Stefano e Alessia", usato da due telefoni.
Questo file elenca tutto quello che un admin può fare in più rispetto agli altri partner: serve se in futuro
si decide di dare il ruolo a un'altra persona. Va aggiornato ogni volta che si aggiunge o si toglie una
funzione da admin.

## Nell'app (pulsanti che vedono solo gli admin)

Nell'app ognuno di questi pulsanti ha sotto la scritta piccola **Solo Admin**.

| Dove | Cosa | A cosa serve |
|---|---|---|
| Scheda di un partner → Numeri → **Correggi il codice Amway** | cambia il codice Amway di chi usa l'app (o il proprio, nel Profilo: l'omino in alto a destra) | solo per un errore di battitura all'ingresso: l'import di quella persona lo segnala ("chiedi a Stefano e Alessia di correggerlo") |
| Scheda di chi usa l'app → Azioni → **Blocca l'app / Sblocca l'app** | blocca o sblocca l'app di chi è nel suo gruppo (non di sé né di un altro admin; 043) | chi è bloccato non vede più niente; i dati restano e i VP contano; sponsor e upline vedono "Bloccato" |
| Gruppo → **In attesa della mappa** → **Togli** | l'admin solo nel suo gruppo (043); lo può fare anche lo sponsor diretto (non l'upline) | cancella profilo e dati di chi non è ancora confermato dal report Amway; il suo telefono vede "accesso tolto" |
| Profilo (omino in alto a destra) → Admin → **Listino** | cerca, corregge e aggiunge prodotti (prezzo al cliente, prezzo Partner, VP); **Aggiorna dal PDF** legge il listino Amway sul telefono e mostra nuovi, prezzi cambiati e usciti prima di salvare | prodotti nuovi (5-6 volte l'anno) a mano; cambio prezzi annuale dal PDF |
| Profilo → Admin → **Codici Amway tolti** | elenco dei codici delle persone tolte da sé o dal suo gruppo (043), con **Sblocca** | con un codice tolto non si rientra finché non lo sblocchi |
| Scheda di chi usa l'app → Azioni → **Nuovo link personale** | crea un link personale nuovo per chi è nel suo gruppo (043); quello vecchio smette di funzionare | per chi ha perso il suo link. Solo per chi è già entrato almeno una volta: chi non è mai entrato (persona importata senza app) si invita con «Invita» (041) |
| Gruppo → **Importa da Amway** (mappa) | solo l'import di un admin **cancella** con tutti i dati i codici esteri già importati (045) e chi è fuori dalla mappa da 12 mesi (046), solo persone senza app del suo gruppo | per gli altri partner restano nascosti: i codici arrivano dal telefono e non si possono verificare |
| Profilo → Admin → **Scarica la copia dei dati** | file `growup-copia-AAAA-MM-GG.json` con tutte le tabelle, senza il «perché» dell'obiettivo, le email e l'impronta delle chiavi (042) | copia di sicurezza mensile (procedura in `LEGGIMI.md`) |

Gli admin **non vedono le liste, gli inviti Target né i clienti** (pagina Persone) di nessuno, neanche nella copia di sicurezza: di ogni partner
vedono solo i numeri della lista nella sua scheda, come ogni upline.

**Invitare** (Gruppo → «Invita») lo può fare ogni partner già nella mappa, non solo l'admin: l'admin può invitare anche
prima di essere nella mappa (la radice dell'installazione). Dal 28 ottobre 2026 (041) non ci sono più inviti speciali da admin.

Gli admin **vedono la struttura come tutti gli altri**: la mappa Amway del proprio gruppo (una sola per tutti, 033), e chi è
in attesa della mappa solo per nome.

## In Supabase (Table editor / SQL Editor)

| Cosa | Dove |
|---|---|
| Requisiti delle tappe, guadagni, soglie delle percentuali | tabelle `stage_requirements`, `percent_levels` (le policy permettono di scrivere solo agli admin) |
| Impostazioni (giorno di chiusura del mese, soglie delle etichette, obiettivi proposti, riferimenti della tabella Stabilità di Cum Laude 21 `stabilita_cl21`) | tabella `settings` |
| Migrazioni nuove (`supabase/0NN_*.sql`) | SQL Editor: quelle con cancellazioni il connettore di Claude non riesce ad applicarle, si incollano a mano |
| Captcha (Cloudflare Turnstile) | Authentication → Attack Protection: acceso con la Secret Key del widget "Growup Team" (account Cloudflare di Stefano). Se un giorno nessuno riesce a entrare per colpa del captcha, si spegne da qui e l'app continua a funzionare |
| Link personale perso dell'admin stesso | `select public.nuova_chiave_per(id) from public.partners where is_admin;` (SQL Editor) |

## Cosa NON può fare nessuno, neanche un admin

**Cancellare persone confermate dall'app.** La struttura rispecchia il report Amway: chi non c'è più resta segnato "non più nel
report" e nascosto. Ognuno può solo nascondere chi vuole dalla propria struttura (i VP contano lo stesso).
Unica eccezione (027): chi è entrato con un link d'invito ed è ancora **Da confermare** (il suo codice Amway non è mai
comparso in un report mappe importato, "in attesa della mappa") si può togliere dal suo sponsor diretto e dall'admin.

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

`sono_admin()` è il controllo; dal 28 ottobre 2026 (043) `nuova_chiave_per`, `blocca_app`, `togli_dalla_struttura`, `codici_tolti_elenco` e `sblocca_codice` valgono solo per sé e la propria downline (`is_in_downline`). La copia di sicurezza resta di tutti i dati. Lo usano: `nuova_chiave_per`, `copia_dati`, `imposta_codice_amway` (per gli altri),
la scrittura del `listino`, `blocca_app`, `codici_tolti_elenco`, `sblocca_codice`, e le policy di scrittura di `stage_requirements`, `settings`, `percent_levels`.
Funzioni da admin tolte nel tempo: `cambia_sponsor` (17 ottobre 2026: la posizione la decide il report Amway);
`crea_invito_sopra` e gli inviti sotto una persona (28 ottobre 2026, 041: si entra solo con un invito personale e il
posto lo decide la mappa).
