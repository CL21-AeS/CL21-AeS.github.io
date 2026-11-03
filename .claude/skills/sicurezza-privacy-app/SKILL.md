---
name: "sicurezza-privacy-app"
description: "Controllo di sicurezza e privacy (GDPR) delle web app di Stefano e Alessia: falle, accessi non autorizzati, furto o modifica di dati, conformità alla legge. Usala prima di ogni PR, prima di un lancio o quando Stefano chiede se l'app è sicura."
---

# Sicurezza e privacy delle app di Stefano e Alessia

Stefano non è un programmatore: parla in italiano, vuole capire e decide lui. Le app (es. Growup Team) sono
fatte con **GitHub Pages + HTML/JavaScript senza build + Supabase in UE** e contengono dati di persone reali
del gruppo (partner, fatturato, obiettivi, contatti). Una falla qui significa: dati del gruppo visibili ad
altre linee o a estranei, dati modificati da chi non dovrebbe, oppure un problema con il Garante della Privacy.

Se esiste la skill `metodo-app-stefano`, seguila insieme a questa: valgono le sue regole (italiano, prima il
piano, una consegna = una PR, Stefano unisce lui).

## Le regole del controllo

1. **Trova e correggi da solo.** Stefano ha deciso così: fai il controllo e correggi tu i problemi di
   sicurezza, senza chiedere prima, in una PR dedicata con i test che dimostrano che la falla è chiusa. La
   rete di sicurezza è che **Stefano unisce lui la PR**: nel rapporto spiega cosa hai cambiato e perché.
   Chiedi prima solo quando la correzione cambia come le persone usano l'app (un passaggio in più per
   entrare, un campo tolto, dati visibili a meno persone), quando è una scelta privacy (tempi di
   conservazione, testi dell'informativa) o quando cancellerebbe dati reali: non cancellare mai dati dal
   database vero senza il suo ok. Se trovi una chiave segreta nel codice o un dato esposto a tutti in questo
   momento, avvisa subito in cima al messaggio: rigenerare la chiave in Supabase lo deve fare Stefano.
2. **Verifica, non supporre.** Ogni problema va dimostrato: con un test SQL che simula un altro utente, con
   una richiesta vera alla API, con una riga di codice citata. Se non riesci a dimostrarlo, scrivi "da
   verificare", non "grave".
3. **Spiega come a un non tecnico.** Per ogni problema: cosa succede, chi potrebbe farlo, cosa rischiamo
   davvero, come si corregge, quanto costa correggerlo.
4. **Sulla privacy non sei un avvocato.** Indica cosa dice il GDPR e dove l'app non è in linea, ma per i
   documenti ufficiali (informativa, nomine) consiglia una verifica di un consulente privacy.

## Due livelli di controllo

- **Controllo rapido** (prima di ogni PR): solo le parti toccate dalla modifica + punti A, B, C qui sotto.
- **Controllo completo** (prima del lancio, dopo una fase grossa, o quando Stefano lo chiede): tutta la lista,
  sicurezza e privacy.

## Parte 1 — Sicurezza

### A. Chiavi e segreti
- Nel codice e nella **storia** di git (`git log -p`, cerca `service_role`, `sb_secret_`, `eyJ`, `password`,
  token): solo la chiave **publishable**. Se una chiave segreta è mai stata nel repository, anche se poi
  cancellata, va considerata rubata: va **rigenerata** in Supabase, non basta toglierla.
- Nessun segreto in `config.js`, nei test, negli screenshot, nelle PR.

### B. Database Supabase (il punto più importante)
La chiave publishable è pubblica: chiunque può chiamare il database direttamente, saltando l'app. Quindi
**l'unica vera difesa sono le regole nel database**, non quello che l'interfaccia mostra o nasconde.
- Lancia gli **advisor di sicurezza** di Supabase (`get_advisors`, tipo security) e riporta ogni avviso.
- **RLS attiva su ogni tabella** dello schema `public` (e su eventuali bucket di Storage).
- Cerca regole troppo larghe: `using (true)`, `with check (true)`, regole `for all` dove servirebbe solo
  `select`, regole `to public` o `to anon`.
- **Attenzione agli accessi anonimi**: un utente anonimo di Supabase ha il ruolo `authenticated`. Una regola
  "tutti gli autenticati" vale quindi per **chiunque apra l'app**. Ogni regola deve legarsi al profilo
  (tabella `accessi`, `is_in_downline`), mai al solo essere autenticati.
- **Chi scrive cosa**: per ogni tabella controlla insert/update/delete separatamente. Un partner può cambiare
  il proprio `sponsor_id`, il proprio ruolo, i campi "chi l'ha inserito" o i dati di un'altra linea? Le colonne
  delicate si cambiano solo con funzioni dedicate.
- **Funzioni `security definer`**: `set search_path = public`, controlli all'inizio, `revoke … from public,
  anon` e `grant` solo a chi serve; nessuna funzione che accetta un ID e restituisce dati senza controllare
  che chi chiama possa vederli.
- **Viste**: devono essere `security_invoker = on`, altrimenti scavalcano la RLS.
- **Prova d'attacco**: il test dei permessi (es. `supabase/tests_rls.sql`) deve simulare almeno: un estraneo,
  un partner di un'altra linea, un downline che prova a leggere/modificare l'upline, chi prova a usare un
  link d'invito scaduto o già usato. Deve finire con "TUTTI I CONTROLLI SUPERATI".

### C. Il codice dell'app (browser)
- **Iniezione di codice (XSS)**: le viste costruiscono HTML con stringhe. Ogni testo scritto da un utente
  (nomi, note, obiettivi, nomi dei contatti) deve passare per una funzione di escape prima di finire in
  `innerHTML`. Cerca ogni `${...}` dentro l'HTML e ogni `innerHTML`, `insertAdjacentHTML`, `href` costruito con
  dati utente (blocca `javascript:`). Prova davvero con un nome tipo `<img src=x onerror=alert(1)>`.
  È la falla più probabile in questo tipo di app: un partner malintenzionato potrebbe rubare il link personale
  di chi guarda il suo nome.
- **Link personali e d'invito**: chiave abbastanza lunga e casuale (`crypto.getRandomValues`), nel database
  solo l'impronta, tolti dalla barra degli indirizzi appena letti, inviti monouso e con scadenza, un modo per
  **revocare** un link personale se un telefono viene perso.
- **Librerie esterne**: versione fissa e SRI (`integrity`), nessuno script caricato da siti non necessari.
- **Content Security Policy**: GitHub Pages non permette di impostare intestazioni HTTP, quindi si mette un
  `<meta http-equiv="Content-Security-Policy">` che limiti script e connessioni a sé stessi, jsDelivr e il
  dominio Supabase. Niente script in linea con `onclick` se la CSP lo vieta.
- **Service worker**: non deve mettere in cache le risposte del database con dati personali.
- **Dati nel telefono**: cosa resta in `localStorage`? Se il telefono viene prestato, cosa vede un altro?
  Serve un pulsante "Esci da questo telefono".

### D. Abusi e continuità
- Captcha (Cloudflare Turnstile) e limiti sugli accessi anonimi prima di aprire l'app a molte persone.
- Limiti sulle operazioni ripetibili (inviti generati, righe inserite) per evitare che qualcuno riempia il
  database.
- Copia di sicurezza: esiste, è recente, e la copia scaricata **non contiene dati che l'admin non dovrebbe
  vedere**; dove viene conservata (Google Drive con accesso limitato).
- Accessi a GitHub e Supabase di Stefano e Alessia con **verifica in due passaggi** attiva.

## Parte 2 — Privacy (GDPR e Codice Privacy italiano)

Controlla e riporta, per ognuno, "in linea / da sistemare / da decidere con Stefano":

1. **Chi è il titolare del trattamento**: chi decide perché e come si usano i dati. Per ora sono
   **Stefano e Alessia come persone fisiche, contitolari** (niente partita IVA dedicata): nell'informativa
   vanno i loro nomi e un'email di contatto per la privacy. Se un giorno l'app passa a un'attività o
   società, informativa e registro vanno aggiornati.
2. **Fornitori (responsabili del trattamento)**: Supabase (dati in UE, Francoforte; accordo DPA da accettare
   nel pannello), GitHub (ospita solo il codice, non i dati: verificare che sia vero), eventuali altri
   (Cloudflare, Google Fonts). Font o script caricati da server esterni passano l'indirizzo IP: meglio
   ospitarli nel repository.
3. **Informativa privacy**: una pagina nell'app, in italiano semplice, visibile **prima** di entrare con
   l'invito: quali dati, perché, chi li vede (sponsor e upline della propria linea), per quanto tempo, dove
   sono, come esercitare i diritti.
4. **Base giuridica**: per ogni tipo di dato, perché è lecito trattarlo (di solito consenso o interesse
   legittimo per l'organizzazione del gruppo). Se è consenso: va chiesto con una casella non pre-spuntata
   e registrato (chi, quando, quale versione dell'informativa).
5. **Dati inseriti da altri**: quando uno sponsor o upline inserisce un partner che non usa l'app, quella
   persona non ha letto l'informativa. Va previsto come e quando viene informata, e che al primo accesso
   veda l'informativa e cosa è stato inserito su di lei.
6. **Dati di persone esterne (contatti, prospect)**: nomi e note su persone che non sanno di essere
   nell'app sono il punto più delicato. Minimizza (solo nome e stato, niente note su salute, soldi,
   famiglia), visibili solo a chi li ha inseriti, cancellazione automatica secondo la regola dei 24 mesi
   (punto 10).
7. **Minimizzazione**: ogni campo serve davvero? Telefono, email, data di nascita, codice Amway: chiedere
   solo ciò che si usa.
8. **Dati particolari**: in un'app che parla di prodotti per il benessere possono finire nelle note dati sulla
   salute (peso, malattie). Vanno evitati: niente campi liberi che li invitano, avviso vicino alle note.
9. **Diritti delle persone**: dall'app o su richiesta, ognuno deve poter **vedere** i propri dati,
   **correggerli**, **scaricarli** (portabilità) e **cancellarsi**. La cancellazione deve togliere davvero i
   dati personali (o renderli anonimi nei calcoli del gruppo), non solo nascondere il profilo.
10. **Tempi di conservazione**: per partner che lasciano il gruppo, contatti, storico mensile, copie di
    sicurezza. Meglio se automatici (pg_cron).
    - **Contatti, deciso da Stefano**: un contatto si cancella **24 mesi dopo l'ultimo passo** (qualsiasi
      esito, anche "No" o "Chiuso senza risposta"); ogni nuovo contatto o passo fa **ripartire** i 24 mesi.
      Controlla che: la data dell'ultimo passo si aggiorni davvero a ogni passo; la cancellazione automatica
      esista, giri ogni giorno e tolga anche le note; le copie di sicurezza più vecchie di 24 mesi non tengano
      in vita contatti già cancellati; un promemoria "ricordamelo tra X mesi" non superi la scadenza;
      l'informativa dica la regola in parole semplici. Prima della cancellazione vera conviene un avviso a
      chi ha inserito il contatto (es. 30 giorni prima), così può fare un passo se lo sta ancora seguendo.
11. **Cookie e memoria del browser**: se l'app usa solo memoria tecnica (accesso, preferenze) e nessun
    sistema di statistiche o pubblicità, non serve il banner dei cookie; va però citata nell'informativa.
    Se si aggiungono statistiche, serve rivedere.
12. **Minori**: l'app è per maggiorenni; dirlo nell'informativa.
13. **Registro dei trattamenti e violazioni**: un documento semplice (`PRIVACY.md` nella cartella dell'app)
    con cosa si tratta, perché, dove, per quanto; e la procedura se c'è una violazione (es. link personali
    rubati): capire cosa è uscito, revocare gli accessi, valutare la notifica al Garante entro 72 ore e alle
    persone coinvolte.
14. **Regole Amway**: ricorda a Stefano di verificare che l'uso dei dati del gruppo e dei dati importati dalle
    mappe Amway sia compatibile con le regole e gli accordi Amway per gli incaricati.

## Il rapporto per Stefano

Scrivi un file `SICUREZZA.md` nella cartella dell'app (aggiornato a ogni controllo completo) e un riassunto
breve nel messaggio. Struttura:

```
# Controllo sicurezza e privacy — <app> — <data>
Livello: rapido / completo

## In sintesi
<2-3 frasi: com'è messa l'app, cosa fare per prima cosa>

## Problemi trovati (dal più grave)
### 🔴 Grave — <titolo semplice>
- Cosa succede: …
- Chi potrebbe farlo: (un estraneo / un partner di un'altra linea / un downline)
- Cosa rischiamo: …
- Come l'ho verificato: …
- Correzione proposta: … (tempo stimato: …)
### 🟠 Medio — …
### 🟡 Basso / migliorie — …

## Privacy
<tabella: punto | stato | cosa fare>

## Cosa è già a posto
<elenco breve: rassicura e serve per i controlli futuri>

## Da decidere con Stefano
<domande con 2-4 opzioni e quella consigliata>
```

Gravità: **Grave** = dati leggibili o modificabili da chi non deve, segreti esposti, iniezione di codice
sfruttabile. **Medio** = serve una condizione particolare (link rubato, telefono perso) o manca un obbligo
GDPR importante (informativa, cancellazione). **Basso** = migliorie di difesa e documentazione.

Le correzioni (regola 1) vanno in una PR dedicata, con i test che dimostrano che la falla è chiusa
(il test che prima falliva ora passa). Aggiorna `STATO.md` con l'esito del controllo.