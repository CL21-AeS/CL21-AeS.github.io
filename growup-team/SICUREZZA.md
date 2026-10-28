# Growup Team — sicurezza dei dati

Controllo approfondito del 17 ottobre 2026 (app, Supabase, GitHub). Da ripetere dopo ogni modifica importante
al database e prima del lancio a tutto il gruppo.

## Come sono protetti i dati

| Dove | Protezione |
|---|---|
| **Supabase (database, UE)** | Row Level Security attiva su **tutte** le tabelle; chi non ha un profilo non legge niente. Ognuno vede sé e, nella propria downline, chi è nella mappa Amway (persone senza app, da chiunque importate, e chi usa l'app confermato da un report); mai chi sta sopra o di lato. Chi è «in attesa della mappa» resta solo suo: l'upline ne vede solo il nome (`in_attesa`). Le scritture delicate passano solo da funzioni che controllano chi le chiama. Nessuna tabella è leggibile senza accesso; le funzioni aperte a chi non è entrato sono `invito_aperto` (com'è un invito personale e, solo se è aperto, il nome dell'invitato e di chi invita, per la pagina d'ingresso) e `invito_target_aperto` (se un link del Target è ancora aperto). Nessun file caricato (storage vuoto). |
| **Captcha** | Cloudflare Turnstile al primo ingresso di un telefono: niente programmi che creano accessi finti a migliaia. La Site Key (pubblica) è in `config.js`; la Secret Key solo in Supabase → Authentication → Attack Protection. Limite di 30 accessi anonimi all'ora per indirizzo; provider Email spento. |
| **Accesso** | Niente password: link personale con una chiave casuale di 128 bit (nel database solo l'impronta sha256, non reversibile). Il link si toglie dalla barra degli indirizzi appena letto. Il link personale serve solo per rientrare: chi non è mai entrato non ne ha uno (041). |
| **Solo su invito (041)** | Si entra solo con un **invito personale**: chi invita (già nella mappa, o un admin) scrive nome e codice Amway del nuovo partner; il link ha solo un codice casuale di 128 bit (nel database l'impronta), quindi nome e codice non si vedono e non si cambiano. Vale **una volta** e **7 giorni**; chi l'ha creato lo annulla o lo rigenera (il vecchio smette di funzionare). Se il codice è già nella mappa l'invito lo crea solo chi sta sopra quella persona, e chi entra prende subito il suo posto; altrimenti resta «in attesa» sotto chi l'ha invitato (vede solo sé stesso) finché una mappa importata da chi l'ha invitato o dalla sua upline non contiene il suo codice. Gli inviti (`inviti`) li legge solo chi li crea; si creano, annullano e rigenerano solo con le funzioni. Il vecchio link generico (codice di 6 lettere), l'«invito sopra» degli admin e il link personale per chi non è mai entrato non esistono più. Gli avvisi (a chi invita quando il nuovo entra e quando va al suo posto; allo sponsor vero se è un altro) sono in `notifiche_eventi`, solo per il server, senza nomi. |
| **App (GitHub Pages)** | Content Security Policy: il browser esegue solo il codice dell'app, la libreria Supabase (con controllo di integrità) e il captcha di Cloudflare, e si collega solo al nostro progetto. Ogni testo che viene dal database è "sterilizzato" prima di essere mostrato (provato con un nome contenente codice HTML). La cache del telefono tiene solo l'app, mai i dati. `no-referrer`: i link non rivelano da dove si arriva. |
| **Report Amway (CSV)** | Si legge sul telefono, non viene caricato da nessuna parte; al database arrivano solo nome, codice e numeri di chi si importa. |
| **GitHub (pubblico)** | Contiene solo codice: nessuna chiave segreta (in `config.js` c'è solo la chiave pubblica, fatta per stare nel browser), nessun dato reale nei file (i test usano nomi e codici inventati). |
| **La Lista (pagina Persone)** | Nomi, telefoni e passi delle persone della lista li legge e scrive **solo chi li ha inseriti**: né sponsor, né upline, né admin (RLS "solo mio", controllata in `tests_rls.sql`). All'upline arrivano solo i numeri (`numeri_persone`). La copia degli admin non contiene le liste; ognuno scarica la propria. |
| **Il Target (pagina Persone)** | Gli inviti e le risposte li vede solo chi li crea (RLS "solo mio"). Il contatto apre una pagina di Growup **senza accesso** e senza scrivere niente nel database: le risposte tornano al partner su WhatsApp. L'unica cosa che la pagina chiede è se il link è ancora aperto (`invito_target_aperto`: risponde solo ok / scaduto / bloccato / usato, mai nomi o risposte). Nel link c'è, se il partner lo scrive, solo il **suo** numero WhatsApp (per ricevere le risposte nella sua chat): resta salvato solo sul suo telefono, non nel database. |
| **I Clienti (pagina Persone)** | Ordini, prodotti, prezzi, durate e compleanni dei clienti li vede solo chi li scrive (RLS "solo mio"; un trigger rifiuta ordini su persone di altri). All'upline arriva solo quanti clienti ha. Il listino Amway ("per l'incaricato") sta nella tabella `listino`: lo leggono solo gli utenti dell'app (non anon, non chi è bloccato), lo scrive solo l'admin (028); non è più nel repository. L'export "Ordini" del sito Amway si legge solo sul telefono: si salvano nome, codice cliente, data, numero, importo e VP degli ordini, mai il file. Dall'export "Clienti" si tengono solo nome, codice cliente, telefono e data dell'ultimo ordine: email e indirizzo non si salvano. |
| **Una sola struttura (033)** | La struttura è la mappa Amway, la stessa per tutti: ogni import aggiorna posizioni e numeri di tutto il gruppo di chi importa; i numeri ufficiali (`numeri_mese`, una riga per persona e mese) li leggono la persona e la sua upline. Vince il report più aggiornato (data e ora del file): un file più vecchio non cambia niente. Chi è in attesa della mappa non può importare. I VP del report vincono su quelli scritti a mano. |
| **I miei ordini (034)** | Ordini e correzioni del totale scritti a mano da chi ha l'app li legge solo lui (policy `activities_leggo`): sponsor e upline vedono solo i numeri del report. La bozza d'ordine e lo storico (`ordini_personali`, `righe_ordine_personale`) hanno RLS "solo il proprietario"; le righe si aggiungono o cambiano solo nella propria bozza; la conferma passa dalla funzione `conferma_ordine` (solo la propria bozza). Non entrano nella copia dei dati dell'admin. |
| **La Guida (035)** | I numeri Cum Laude 21 scritti dal partner (`numeri_cl21`), gli obiettivi delle abitudini (`guida_obiettivi`) e le spunte (`guida_fatti`, mai un giorno futuro) hanno RLS "solo il proprietario": né l'upline né l'admin li leggono dall'app. I conteggi (miei nuovi iscritti, nuovi nel gruppo, codici oltre 200 VP) li dà solo `guida_conteggi`, con `vedo`; le colonne nuove di `partners` (`invitato_da`, `in_mappa_dal`, `primo_import_il`) non sono leggibili dall'app e le scrivono solo i trigger. |
| **Seguimi (036)** | La scelta (`seguimi`) e le azioni di ogni giorno (`seguimi_giorni`, con i nomi delle persone) hanno RLS "solo il proprietario". Sponsor e upline leggono solo tramite `seguimi_di`, e solo se il partner ha attivo il Seguimi, ha scelto di condividere e lo vedono (`vedo`): ricevono solo giorno, azioni proposte e fatte e i conteggi per tipo, mai le azioni con i nomi. |
| **Analisi e condivisione (037)** | `analisi_persona` restituisce solo i numeri dei report di chi vedo (`vedo`) e i conteggi della Stabilità; un'altra linea e anon sono rifiutati. Un solo interruttore (`seguimi.condividi`, lo cambia solo il partner): acceso, sponsor e upline leggono con `dati_condivisi` i numeri scritti a mano (app CumLaude21, Training Day, Convention) e le abitudini, e con `seguimi_di` i numeri del Seguimi; mai i nomi della Lista e dei clienti, mai i VP degli ordini scritti a mano. |
| **Mese da Argento (038)** | `mesi_qualifica` restituisce mese, percentuale, VP di gruppo e «argento» solo per chi vedo (`vedo`); un'altra linea e anon sono rifiutati. Nessun dato nuovo, nessuna scrittura. |
| **Notifiche (039)** | `notifiche_telefoni` e `notifiche_previste` (solo numeri, mai nomi) li vede e scrive solo il partner; `notifiche_inviate`, `notifiche_chiavi`, `notifiche_eventi` (041) e `notifiche_da_inviare` solo il server (`service_role`). Le chiavi VAPID le genera la Edge Function e restano nel database; il segreto della chiamata pianificata è in Vault: nessuno dei due sta nel repository o passa dalla chat. La funzione accetta solo il segreto giusto (401 altrimenti) o il token di chi è entrato, e la prova va solo ai suoi telefoni. Il contenuto delle notifiche è cifrato fino al telefono. |
| **Ora del prossimo passo (040)** | `persone.prossima_ora` si scrive solo sulle proprie persone (stessa regola di `prossima_data`). L'avviso 30 minuti prima lo compone solo il server, senza nome («una persona della tua Lista» / «un tuo cliente»); l'indirizzo ha solo l'id della persona, che si apre solo nell'app del proprietario. |
| **Conferma e blocco (027, 033)** | Chi entra è "in attesa della mappa" finché il suo codice Amway non compare in un report importato dalla sua upline: i suoi dati non salgono. Solo il suo sponsor diretto e l'admin possono toglierlo (`togli_dalla_struttura`, controllo nel database): si cancellano profilo e dati, il codice non rientra finché un admin non lo sblocca, i suoi telefoni vedono "accesso tolto". L'admin blocca l'app (`blocca_app`): `my_partner_id()` non risponde più per un profilo bloccato, quindi la RLS non restituisce niente e nessuna funzione lavora. Nessuno può scrivere `confermato_il` o `bloccato_il` dall'app. |
| **Listino (028)** | Tabella `listino` con RLS: lettura solo con `my_partner_id()` (utenti dell'app non bloccati), scrittura solo `sono_admin()`, nessuna cancellazione (i prodotti usciti diventano non attivi). Il PDF Amway si legge sul telefono dell'admin con pdf.js (da jsDelivr, versione fissa 3.11.174 con controllo d'integrità SRI, senza eval né worker esterni) e non si salva. `catalogo.js` tolto dal repository pubblico (resta nella storia di GitHub finché non si chiede la pulizia). |
| **Niente cancellazioni** | Dall'app nessuno può cancellare persone (neanche gli admin): si possono solo nascondere. La cancellazione per diritto all'oblio si fa dall'SQL Editor (`ADMIN.md`). |
| **GitHub, storia** | 17 ottobre 2026: la storia del repository è stata riscritta per togliere ogni dato reale (nomi, codici Amway, numeri, codice d'invito, email dell'autore dei commit). |
| **Tabelle nuove** | Da ottobre 2026 Supabase non dà più permessi automatici alle tabelle nuove: in Growup ogni tabella nasce con `revoke all` e i `grant` espliciti nella stessa migrazione, più la RLS. |
| **Copia di sicurezza** | La scarica solo un admin; contiene i dati per ripristinare tutto (compresi gli ordini e le correzioni scritti a mano), ma **non** il «perché» dell'obiettivo, le email né l'impronta delle chiavi d'accesso (042); mai le liste, il Target, i clienti, la Guida, il Seguimi e gli ordini della bozza. Va tenuta in una cartella privata di Google Drive. |
| **Chi è in attesa (042)** | Di chi usa l'app ma non è ancora nella mappa, l'upline riceve solo il nome (`in_attesa`), non il codice Amway. L'anteprima dell'import lo riconosce con `attesa_nel_report`: l'app manda i codici del report che si sta importando e il database risponde solo per le persone in attesa del proprio gruppo che sono in quel report. |

## Controlli fatti

- Supabase Security Advisor: nessun problema reale (gli avvisi sulle funzioni sono voluti: ognuna controlla chi la
  chiama; quelli su `cron` riguardano tabelle interne non esposte).
- Permessi di ogni tabella e funzione per "anon" (chi non è entrato) e "authenticated": vedi la query in fondo.
- `supabase/tests_rls.sql`: visibilità, scritture, funzioni da admin, import, inviti → TUTTI I CONTROLLI SUPERATI.
- Test dell'interfaccia: nome con codice HTML mostrato come testo, Content Security Policy presente.
- Repository: nessun file CSV/Excel/JSON di dati nella storia; dati reali tolti dai file (sostituiti con dati inventati).

## Da fare (decisioni e impostazioni)

- [x] Limite "anonymous sign-ins" (30/ora per indirizzo) e provider Email spento in Supabase.
- [x] Captcha nell'app; account Cloudflare con verifica in due passaggi.
- [x] Captcha acceso in Supabase → Authentication → Attack Protection (Turnstile + Secret Key), provato sul
      telefono in incognito il 17 ottobre 2026.
- [ ] **Verifica in due passaggi** sugli account GitHub, Supabase e Google (Drive delle copie).
- [ ] Copie di sicurezza in una cartella **privata** di Google Drive.
- ~~Rischio residuo noto: chi ha un link d'invito di qualcuno sopra una persona importata e conosce il suo codice Amway
  potrebbe entrare al suo posto.~~ Chiuso il 28 ottobre 2026 (041): il controllo del 28 ottobre ha mostrato che l'impostore
  sarebbe stato subito confermato e avrebbe visto tutto il gruppo di quella persona. Ora si entra solo con un invito
  personale, creato da chi sta sopra, con nome e codice fissati da lui.

## Query di controllo dei permessi (SQL Editor)

```sql
select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as utenti
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' order by anon desc, utenti desc, proname;

select c.relname, c.relrowsecurity as rls, has_table_privilege('anon', c.oid, 'select') as anon_legge
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' order by c.relname;
```
Risultato atteso: `anon` solo su `invito_aperto` e `invito_target_aperto`; `rls` vero e `anon_legge` falso su tutte le tabelle.
