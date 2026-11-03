# Growup Team — registro dei trattamenti (bozza)

Bozza preparata con il controllo del 3 novembre 2026. **Non è un parere legale**: va fatta verificare da un consulente
privacy prima del lancio a tutto il gruppo. I punti segnati «da decidere» aspettano una scelta di Stefano e Alessia.

## Chi decide sui dati (titolari)

Stefano e Alessia (A&S), **come persone fisiche, contitolari**. Contatto per la privacy: *email da decidere* (da scrivere
nell'informativa dell'app, non in questo file pubblico se è un indirizzo personale).

Da chiarire con il consulente: i nomi della **Lista, del Target e dei Clienti** li decide e li scrive ogni partner, e
Stefano e Alessia non li vedono. Probabilmente per quei dati il titolare è il partner stesso e A&S forniscono solo lo
strumento: va scritto nelle condizioni d'uso dell'app.

## Cosa si tratta

| Dati | Di chi | Perché | Chi li vede | Per quanto |
|---|---|---|---|---|
| Nome, codice Amway, data di ingresso, qualifica, numeri del mese (VP, percentuale), obiettivi, abitudini | Partner che usano l'app | Pianificare il proprio lavoro e farsi aiutare dall'upline | La persona; l'upline solo i numeri (le parti private restano sue, vedi `SICUREZZA.md`) | Finché è nella mappa Amway; fuori dalla mappa si cancella dopo 12 mesi (050) |
| Nome, codice Amway, sponsor, data di ingresso, VP, percentuale, dimensione del gruppo | Persone della mappa Amway **senza l'app** | Mostrare all'upline la struttura del suo gruppo | Chi sta sopra di loro nella mappa | Come sopra |
| Nome, contatto, «come lo conosci», note, passi, compleanno, ordini e codice cliente | Persone della Lista, del Target e Clienti (esterni) | Ricordarsi chi ricontattare e seguire i clienti | **Solo** il partner che li ha scritti | Regola decisa: 24 mesi dall'ultimo passo, il conteggio riparte a ogni passo (**da realizzare**). Clienti: da decidere (proposta: 24 mesi dall'ultimo ordine o passo) |
| Indirizzo del telefono per le notifiche | Partner che le attivano | Mandare i promemoria | Solo il server | Finché le notifiche restano attive |
| Indirizzo IP al primo ingresso | Chi entra | Captcha contro gli accessi automatici | Cloudflare | Secondo le regole di Cloudflare |

L'app non chiede email, telefono, indirizzo, dati di pagamento né dati sulla salute. Dalla mappa Amway telefono,
email, indirizzo e Paesi esteri non arrivano mai al database.

## Base giuridica (da confermare con il consulente)

- Partner che usano l'app: **consenso** dato al primo ingresso (casella non spuntata, salvato in
  `partners.privacy_accettata_il`).
- Persone della mappa senza app: **interesse legittimo** dell'organizzazione del gruppo. Queste persone oggi **non
  ricevono l'informativa**: vedi «Da fare».
- Persone della Lista e Clienti: interesse legittimo del partner a ricontattare chi conosce; niente dati che non
  servono.

## Fornitori (responsabili del trattamento)

| Fornitore | Cosa fa | Dove | Da fare |
|---|---|---|---|
| Supabase | Database e accessi | UE (Francoforte) | Controllare che l'accordo DPA sia accettato (Organization → Legal) |
| GitHub Pages | Ospita il codice dell'app; registra l'indirizzo IP di chi apre la pagina | USA (Data Privacy Framework) | Citarlo nell'informativa |
| Cloudflare Turnstile | Captcha al primo ingresso | USA (Data Privacy Framework) | Citarlo nell'informativa |
| Google, Apple, Mozilla, Microsoft | Consegnano le notifiche (contenuto cifrato, senza nomi) | USA | Citarli nell'informativa |
| jsDelivr | Solo per l'admin che importa il listino Amway (lettore PDF) | CDN mondiale | Nessuno |

Dal 3 novembre 2026 font e libreria Supabase stanno nell'app: aprendo Growup nessun indirizzo IP arriva a Google o a
jsDelivr.

## Diritti delle persone

Vedere, correggere, scaricare e cancellare i propri dati: oggi su richiesta a Stefano e Alessia. La cancellazione la fa
un admin dall'SQL Editor (`ADMIN.md`). La Lista si scarica dall'app («Scarica una copia della mia lista»).

## Se i dati vengono rubati o esposti (violazione)

1. Capire cosa è uscito e di chi (log di Supabase, `SICUREZZA.md`).
2. Fermare la falla: rigenerare le chiavi in Supabase, nuovi link personali (`nuova_chiave_per`), bloccare i profili
   coinvolti (`blocca_app`).
3. Entro **72 ore** valutare la notifica al Garante della Privacy, e avvisare le persone coinvolte se il rischio è alto.
4. Scrivere qui cosa è successo e cosa si è fatto.

## Da fare

- [ ] Informativa completa nell'app e in una pagina pubblica (proposta nel controllo del 3 novembre).
- [ ] Informare le persone della mappa senza app (pagina pubblica dell'informativa + chi importa avvisa il suo gruppo).
- [ ] Cancellazione automatica dei contatti dopo 24 mesi dall'ultimo passo, con avviso 30 giorni prima.
- [ ] Decidere per quanto tenere i clienti e le copie di sicurezza.
- [ ] Verificare con le regole Amway per gli incaricati l'uso dei dati del gruppo e delle mappe.
- [ ] Far rileggere questo file e l'informativa da un consulente privacy.
