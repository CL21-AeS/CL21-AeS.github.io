# Growup Team — come metterla in funzione (Fase 1)

Indirizzo dell'app: **https://cl21-aes.github.io/growup-team/**

Growup Team sostituisce `growup/` con un database condiviso. **Non si usa l'email**: si entra con un link.

- **Link d'invito** (`…/growup-team/#ABC234`): ogni partner ha il suo e lo manda su WhatsApp o Telegram ai nuovi.
  Chi lo apre scrive nome, qualifica e (se sta iniziando) data di iscrizione, e inizia, sotto chi l'ha invitato.
- **Link personale** (`…/growup-team/#chiave=…`): è la chiave del proprio profilo. L'app lo consegna al primo
  ingresso e chiede di mandarlo **a sé stessi** (WhatsApp: chat con sé stessi · Telegram: Messaggi salvati).
  Toccandolo si rientra da qualsiasi telefono o computer. Non va inoltrato.
- "Primi passi" (finché non sono fatti, si può nascondere con ×): salva il link, installa, obiettivo, 30 nomi in Lista,
  primo import. Le spiegazioni lunghe si aprono con il «?» accanto al titolo.
- "I miei numeri": obiettivo, tappa (si apre toccandola), settimana (contatti e piani) e mese (VP e nuovi clienti);
  **+ Contatto**, **+ Piano**, **+ Ordine** sempre in basso (+ Ordine apre il foglio «Ordini»: ordine veloce, bozza,
  i miei ordini, totale del mese).
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
   (un solo profilo per tutti e due). Alla fine stampa il **link personale**: la vostra chiave. Apritelo su entrambi
   i telefoni e salvatelo nei vostri "Messaggi salvati". **Si vede solo adesso**: copiatelo subito.
   I partner si invitano poi dall'app, con «Invita» (041).
4. `supabase/006_fase2_calcoli.sql` — i calcoli del mese (VP di gruppo, linee, percentuali, storico)
5. `supabase/007_fase2_gestiti.sql` — numeri inseriti dall'upline per chi non usa l'app, conferma del punto di partenza
6. `supabase/008_inserisci_in_mezzo.sql` — inserire una persona mancante in mezzo alla linea
7. `supabase/009_cancella_e_sposta.sql` — cancellare una persona (il suo gruppo sale) e cambiare sponsor (admin)
8. `supabase/011_cambia_sponsor_nel_gruppo.sql` — cambiare sponsor anche verso qualcuno del proprio gruppo
9. `supabase/012_preferiti.sql` — le persone che ognuno segna come preferite per seguirle da vicino
10. `supabase/013_obiettivo.sql` — il primo obiettivo di ognuno (cifra al mese, entro quando, perché)
11. `supabase/014_copia_dati.sql` — la copia di sicurezza dei dati (solo admin)
12. `supabase/015_codice_amway.sql` — il codice Amway Partner di ognuno e l'import dei VPP dal report Amway (CSV)
13. `supabase/016_rete_da_amway.sql` — la rete dal report Amway: le persone importate le vede solo chi le importa,
    ingresso con il codice Amway, calcoli e storico per chi guarda, persone nascoste; niente più inserimenti a mano
14. `supabase/017_inviti_e_numeri_report.sql` — inviti degli admin (sotto una persona, chi manca sopra), struttura
    "ricucita", numeri ufficiali dal report Amway (VPG, percentuale, linee) e qualifica calcolata su quelli
15. `supabase/018_niente_cancellazioni.sql` — nessuno cancella dall'app; import sempre completo; chi non è più nel
    report resta segnato e nascosto
16. `supabase/019_partenza_senza_conferma.sql` — nessuno conferma il punto di partenza; ognuno corregge il proprio
17. `supabase/020_persone.sql` — la Lista (pagina Persone): nomi solo di chi li scrive, passi che contano le attività,
    all'upline solo i numeri
18. `supabase/021_persone_io.sql` — su Io le persone in percorso; ognuno può toglierne una da Io e rimetterla
19. `supabase/022_target.sql` — il Target (Persone → Target): inviti solo di chi li crea; il contatto chiede solo se
    il suo link è aperto
20. `supabase/023_target_da_lista.sql` — dalla scheda di una persona della lista si mandano le otto domande
21. `supabase/024_clienti.sql` — i Clienti (Persone → Clienti): ordini, righe, durate dei prodotti, compleanni; solo di
    chi li scrive; all'upline il numero dei clienti
22. `supabase/025_ordini_amway.sql` — gli ordini dei clienti importati dall'export "Ordini" del sito Amway (codice
    cliente, numero d'ordine per non importare due volte, importo e VP)
23. `supabase/026_clienti_da_amway.sql` — l'elenco dei clienti dal sito Amway: l'ultimo ordine si unisce all'ordine vero
    (numero, importo e VP modificabili, solo sui propri ordini)
24. `supabase/027_conferma_e_blocco.sql` — "Da confermare" finché il codice Amway non compare in un report importato;
    togliere dalla struttura chi non è confermato (sponsor, upline, admin); l'admin blocca l'app. Ha delle
    cancellazioni: si incolla nell'SQL Editor (si può rilanciare)
25. `supabase/028_listino.sql` — il listino Amway nel database (lo leggono gli utenti dell'app, lo scrive l'admin);
    prezzo Partner e VP anche sulle righe degli ordini
26. `supabase/029_si_divisi.sql` — per sponsor e upline i "sì" del mese divisi in nuovi partner e nuovi clienti
27. `supabase/030_qualifiche_annuali.sql` — le qualifiche oltre Argento (da Oro a Diamante Fondatore, si dichiarano),
    la prossima qualifica scelta da chi è Platino o più (la vedono sponsor e upline); la qualifica del mese si calcola
    solo fino ad Argento
28. `supabase/031_mesi_argento.sql` — i mesi da Argento: i numeri dei report degli ultimi 13 mesi (per sé e per chi si
    vede) e l'import "solo numeri" dei report dei mesi chiusi (non sposta persone, non tocca i VPP)
29. `supabase/032_guadagni_oltre_argento.sql` — le cifre al mese da Platino in su (Fondatori uguali alla qualifica) e
    Argento senza incentivi Bronze (2.500 €)
30. `supabase/033_struttura_unica.sql` — una sola struttura, la mappa Amway: ogni import aggiorna tutto il gruppo di chi
    importa, vince il report più aggiornato (data del file), numeri ufficiali condivisi con la upline (`numeri_mese`),
    chi è in attesa della mappa resta solo suo (lo toglie solo lo sponsor diretto), i VP del report vincono su quelli a mano
31. `supabase/034_ordini_miei.sql` — i miei ordini restano miei: gli ordini scritti a mano da chi ha l'app li vede solo lui
    (sponsor e upline vedono solo il report); per me contano il report più i miei ordini scritti dopo il file; la bozza
    d'ordine e lo storico dei miei ordini (`ordini_personali`, `righe_ordine_personale`, solo miei)
32. `supabase/035_guida.sql` — la Guida per l'azione: chi entra con il link di chi (`invitato_da`), i codici nuovi nella
    mappa dal secondo import (`in_mappa_dal`), i numeri Cum Laude 21 scritti dal partner, obiettivi e spunte delle
    abitudini (tutto solo suo), `guida_conteggi`
33. `supabase/036_seguimi.sql` — «Seguimi giorno per giorno»: la scelta del partner (`seguimi`) e le azioni di ogni giorno
    (`seguimi_giorni`), solo sue; all'upline solo i numeri, se lo condivide (`seguimi_di`)
34. `supabase/037_analisi.sql` — l'Analisi della persona (`analisi_persona`: numeri dei report dell'anno fiscale, linee
    con nome, VP e percentuale, conteggi della Stabilità) e i dati condivisi con l'upline (`dati_condivisi`)
35. `supabase/038_mese_argento.sql` — il mese da Argento con la linea al 21% (`mesi_qualifica`: al 21% conta come mese
    da Argento senza linee al 21%, con 2 o più, o con una e almeno 4.000 VP di gruppo rimanenti fuori da quella linea).
36. `supabase/039_notifiche.sql` — le notifiche: telefoni iscritti, numeri dei prossimi giorni (senza nomi), invii fatti,
    chiavi VAPID (custodite dal server) e `notifiche_da_inviare` (il riepilogo delle 8:30, solo per il server).
    Su Supabase anche `039b_notifiche_cron.sql` (pg_net, segreto in Vault, chiamata ogni 15 minuti) e la Edge Function
    `supabase/functions/invia-notifiche` (pubblicata con `verify_jwt` spento: controlla da sola il segreto o il token).
37. `supabase/040_prossima_ora.sql` — l'ora facoltativa del prossimo passo (`persone.prossima_ora`) e, in
    `notifiche_da_inviare`, l'avviso 30 minuti prima (senza nomi; il tocco apre la scheda con `?persona=<id>`).
38. `supabase/041_invita.sql` — si entra solo con un invito personale (`inviti`): nome e codice Amway scritti da chi
    invita, link con un codice casuale, una volta sola, 7 giorni; avvisi a chi invita e allo sponsor vero
    (`notifiche_eventi`); via il link d'invito generico, l'«invito sopra» e il link personale per chi non è mai entrato
39. `supabase/042_copia_e_attesa.sql` — la copia di sicurezza senza il «perché» dell'obiettivo, le email e l'impronta
    delle chiavi; di chi è in attesa l'upline riceve solo il nome, e l'anteprima dell'import lo riconosce con
    `attesa_nel_report`
40. `supabase/042b_limite_attesa.sql` — al massimo 30 richieste e 20.000 codici al giorno per `attesa_nel_report`
41. `supabase/043_admin_e_ritocchi.sql` — i poteri da admin solo nel proprio gruppo; impostazioni, tappe e livelli solo
    con un profilo (l'ingresso riceve le qualifiche con l'invito); il punto di partenza solo da `modifica_partenza`;
    notifiche solo dai servizi ufficiali e prova limitata (`notifiche_prova_ok`, con la Edge Function aggiornata);
    indici e regole di accesso più veloci
41a. `supabase/044b_data_ingresso.sql` — la «Data di ingresso» della mappa va nella data di iscrizione (la mappa fa fede)
41b. `supabase/045_solo_italia.sql` — dalla mappa solo le righe con Paese = Italia: l'import riceve solo i codici esteri e
    cancella, con tutti i loro dati, i codici esteri già importati (persone senza app nella downline di chi importa; solo
    se importa un admin, per gli altri restano nascosti)
41c. `supabase/046_mappa_del_mese.sql` — ogni mappa sostituisce la precedente: rifà la struttura solo la mappa con il mese
    di competenza più recente (`partners.mappa_mese`), una mappa di un mese precedente salva solo i numeri; i numeri di un
    mese sono sempre quelli dell'ultimo file; chi è fuori dalla mappa da 12 mesi si cancella (import di un admin)
41d. `supabase/047_esteri_scartati.sql` — i codici esteri si scartano e basta: il database ignora `p_esteri` (va dopo la 046)
41e. `supabase/048_chi_importa.sql` — si importa solo la propria mappa; senza codice Amway nell'app non si importa
41f. `supabase/049_perimetro.sql` — le righe fuori dalla downline di chi importa si ignorano; via la vecchia `importa_rete`
41g. `supabase/050_fuori_mappa.sql` — chi esce dalla mappa esce dalla struttura (app bloccata se la usa), rientra con i suoi
    dati; la pulizia `pulisci_fuori_mappa` cancella chi è fuori da 12 mesi
41h. `supabase/050b_pulizia_cron.sql` — l'attività pianificata della pulizia, ogni notte (solo su Supabase, come la 006b)
42. `supabase/010_etichette.sql` — le soglie delle etichette del gruppo (Non aggiorna, Contatti / Piani / VP sotto soglia)
20. `supabase/006b_chiusura_pianificata.sql` — l'attività pianificata che il giorno 5 chiude il mese precedente
21. `supabase/tests_rls.sql` — controlla i permessi. Deve finire con **TUTTI I CONTROLLI SUPERATI**
   e non lascia dati di prova.

In alternativa ai punti 1-16: `supabase/installa_tutto.sql` li contiene già tutti, in un solo incolla.
I file `004_*` e `005_*` servono solo al progetto già installato: il loro contenuto è già dentro 001-003.

## 3. Attivare l'accesso senza email

**Authentication → Sign In / Providers**:

- **Allow anonymous sign-ins: ON** (è quello che permette di entrare con il solo link)
- Le email non servono: provider **Email spento** (nessuno può creare account con email e password).

**Authentication → Rate Limits**: il limite *anonymous sign-ins* è per indirizzo IP, di default 30 all'ora.
Se fate entrare molte persone insieme alla stessa serata, sulla stessa rete Wi-Fi, alzatelo (per esempio a 100).

**Authentication → Attack Protection → Captcha protection**: Cloudflare Turnstile. Nell'app c'è la *Site Key*
(pubblica, in `config.js`); in Supabase va la *Secret Key* (dal pannello Turnstile di Cloudflare, widget
"Growup Team", hostname `cl21-aes.github.io`). Il captcha compare solo al primo ingresso di un telefono.

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
2. Nella pagina Gruppo toccate **Invita**, scrivete nome e codice Amway di prova e mandate il link a un secondo telefono
   su WhatsApp o Telegram (vale una volta e 7 giorni).
3. Il secondo telefono apre il link, sceglie qualifica e data: inizia.
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
- **Cancellare un partner** (solo per una richiesta di cancellazione dei dati, diritto all'oblio): dall'app nessuno
  cancella; si fa dall'SQL Editor, vedi `ADMIN.md` → "Richiesta di cancellazione dei dati".

## Copia di sicurezza dei dati (una volta al mese)

Il codice è al sicuro su GitHub; i **dati** (persone, attività, obiettivi, storico) stanno su Supabase, che nel piano
gratuito **non fa copie automatiche**. Per questo, una volta al mese:

1. **Quando**: dopo il giorno **5** (il mese precedente è chiuso e congelato nello storico).
2. **Dall'app**, con il vostro profilo (solo gli admin lo vedono): nel Profilo (l'omino in alto a destra), sezione Admin,
   **Scarica la copia dei dati**. Si scarica il file `growup-copia-AAAA-MM-GG.json` (su Android in *Download*).
   Sotto il pulsante l'app ricorda la data dell'ultima copia e avvisa se è passato più di un mese.
3. **Dove tenerla**: carica il file su **Google Drive**, in una cartella "Growup – copie". Tenete almeno le ultime 6.
   Il file contiene dati personali del gruppo: non inoltratelo e non mettetelo in cartelle condivise.
4. **Anche il codice**, nello stesso momento: sulla pagina GitHub del repository `CL21-AeS/CL21-AeS.github.io`, pulsante
   verde **Code → Download ZIP**. Carica lo ZIP nella stessa cartella "Growup – copie" (nome con la data, per esempio
   `growup-codice-AAAA-MM-GG.zip`). Contiene tutta l'app (pagine, grafica, database da ricreare con
   `supabase/installa_tutto.sql`, documenti): se GitHub non fosse più raggiungibile, codice e dati sono tutti lì.

**Riserva**: Supabase → *Table editor* → per ogni tabella, menu ⋯ → *Export to CSV*.

**Se un giorno servisse ripristinare**: aprite una sessione con Claude, allegate il file della copia (e, se GitHub non
c'è più, lo ZIP del codice) e chiedete di
ripristinare i dati in Supabase. Ogni tabella del file corrisponde a una tabella del database (le migrazioni in
`supabase/` ricreano la struttura vuota). I telefoni si ricollegano aprendo i link personali, che restano validi
perché nella copia c'è l'impronta delle chiavi.

## La rete dal report Amway

Nell'app non si inseriscono più persone a mano: la rete rispecchia sempre quella di Amway.
- **Chi usa l'app** entra solo con un **invito personale** (041): chi lo invita scrive nome e **codice Amway**, lui
  sceglie la qualifica. Se il suo codice era già stato importato, l'invito lo può creare solo chi gli sta sopra e lui
  entra nel suo profilo (posizione del report e VPP già inseriti); altrimenti resta «in attesa della mappa» finché un
  import di chi l'ha invitato o della sua upline non lo mette al suo posto.
- **Chi non usa l'app** arriva solo dall'import, e lo vede **solo chi l'ha importato**.

Ognuno importa il report della **propria** linea, quando vuole (pagina Gruppo → La mia
struttura → **Importa da Amway**). Lo stesso pulsante è nel promemoria di Io, nel foglio «Ordini» e in Clienti, e
sull'icona di Growup (Android, pressione lunga → «Importa da Amway»): si scelgono insieme i file CSV scaricati dal sito
(mappa, ordini, clienti) e l'app riconosce quale è quale; prima la mappa, poi da solo l'import di ordini e clienti.
Il file si sceglie sempre a mano: una pagina web non può leggere da sola la cartella Download del telefono.
1. Sul sito Amway: Business Centre → **Linea di Sponsorizzazione (LOS)** → togliere i filtri → pulsante di download →
   **Intera Linea di Sponsorizzazione con tutti i KPI disponibili** → formato **CSV**.
2. Nell'app scegliere il file. L'anteprima mostra:
   - **Nuovi nel report**: entrano **tutti** (l'import è sempre completo); si spunta chi **nascondere**, con i pulsanti
     *Nascondi chi ha 0 VP · Nascondi tutti · Mostra tutti* e la ricerca per nome o codice;
   - chi si aggiorna (io e le mie persone importate);
   - **non più nel report**: nessuno si cancella; restano con il segno "non più nel report" e vanno tra le nascoste;
   - **usano l'app**: non vengono toccati; se il report dice che il loro sponsor è un altro, vanno sotto di lui.
3. **Importa**. Si importa il mese scritto nel file: quello in corso (anche più volte, i valori si sostituiscono) o il
   precedente fino al giorno 5. Il file resta sul telefono: si salvano solo nome, codice e VPP di chi si importa.

Con l'import l'app salva anche i **numeri ufficiali** del report (VPP, VPG, percentuale e i VPG delle linee frontali)
di chi importa e delle persone del report che ha nell'app: pagina Io, struttura, scheda e storico usano quelli, e la
qualifica si calcola sulla struttura del report. Per i Platino il report non mostra il gruppo: VPG e percentuale ci
sono, le linee no ("linee non visibili nel report"). Chi non importa vede i numeri calcolati dall'app (chi usa l'app
più le proprie persone importate); lo storico dei mesi chiusi si congela allo stesso modo.

Cosa possono fare in più gli admin (inviti sotto una persona o "chi manca sopra", correzione del codice Amway, …):
vedi `ADMIN.md`. Dalla scheda di chiunque: **Nascondi dalla mia struttura** (sparisce solo per me, con il suo gruppo; i suoi VP contano
sempre nei numeri personali e di gruppo). Le nascoste si rivedono da "N persone nascoste · Rivedi" nella struttura.
Si nasconde **solo la persona**: chi sta sotto di lei resta visibile (sotto il primo sponsor visibile, con il suo
livello del report). Nella struttura, **Mostra anche le nascoste** fa vedere l'albero completo (le nascoste in
grigio, con Mostra / Nascondi su ogni riga; parte con i gruppi chiusi, ▸ li apre); **Rivedi** apre l'elenco Nascoste · Visibili con livello, sponsor e
persone sotto. Al reimport si sceglie: **Lascia tutto com'è** (si aggiornano solo i VP) oppure **Riapplica i filtri a
tutti** (Nascondi chi ha 0 VP / Nascondi tutti / Mostra tutti anche su chi c'è già).
**Nell'app nessuno cancella niente**, neanche gli admin.

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
  dall'albero. Il punto di partenza lo dichiara e lo corregge ognuno per sé (dal 18 ottobre nessuno lo conferma).
- **Fase 3 — Partner gestiti e presa in carico**: inserimento per conto terzi, soglia dei 14 giorni, link per
  prendere possesso del profilo (stesso link personale, mandato su WhatsApp/Telegram), avvisi.
- **Fase 4 — Diagnosi e rifinitura**: mancanze evidenziate (nessun suggerimento: decide il partner), serie di settimane, 90 giorni.
