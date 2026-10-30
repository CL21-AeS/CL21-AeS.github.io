# Growup Team — a che punto siamo

Ultimo aggiornamento: 28 ottobre 2026 (sera). Da leggere all'inizio di ogni nuova sessione con Claude Code.
Il metodo e la tecnica usati (da riusare per altre app) sono in `METODO.md`.

## Ripartire da qui (fermi la sera del 28 ottobre 2026)

**Dove siamo** (aggiornato il 30 ottobre): migrazioni applicate su Supabase fino alla **046** (044b, 045 e 046 applicate
dal connettore il 30 ottobre); funzione `invia-notifiche` v2 pubblicata. PR unite fino alla **#137** (import mappe). I 7
codici esteri importati prima della regola «solo Italia» sono stati cancellati dal database il 30 ottobre (su ok di Stefano).
Gruppi A–D del controllo di sicurezza fatti e uniti. **Grafica** (skill frontend-design, una PR per punto, schermate
prima/dopo a 360 px chiaro e scuro nella pagina privata «Growup · grafica prima e dopo» di Stefano): punti **1–5 fatti**
(sotto-linguette scure, colori con significato fisso, colori della profondità, Stabilità della tua rete, filtri di Persone).

**Prossimi passi, in quest'ordine** (tutti già decisi con Stefano):
1. **Grafica 6 · Gruppo**: togliere il pulsante/chip «senza app» ripetuto; pallino grigio = senza app, pallino verde = usa
   l'app; spiegarlo nel «?» di «La mia struttura» insieme al significato dei colori della profondità (1 = tu, bianco; dal 2
   blu, viola, petrolio, rosa, nocciola e si riparte).
2. **Grafica 7 · contrasto e a capo**: testi grigi almeno WCAG AA nei due temi (oggi `--ink3` chiaro `#7a8781` non basta:
   3,74 sulla scheda, 3,38 sul fondo); nessun pulsante va a capo a 360 px, compresa la barra in basso e «Importa da Amway»
   nel Gruppo (e «‹ Settimana prima» nelle abitudini della Guida); il × di «Primi passi» arrotondato come gli altri; ricontrollare
   anche l'ambra delle caselle della Stabilità.
3. **«Da riprendere»** (piano approvato, con le correzioni di Stefano): un contatto già avviato (in corso: fase oltre
   «lista», senza esito) senza passi da 14 giorni, contati dall'ultimo passo, va da solo in «Da riprendere» con la riga ambra;
   i nomi in Lista mai contattati non ci vanno mai e non diventano mai ambra. Toccando la riga ferma compaiono due azioni:
   «Ricordamelo più avanti» (toglie l'avviso, torna dopo 30 giorni) e «Chiudi contatto» (va in Chiusi con l'esito nuovo
   «Chiuso senza risposta», separato dai «No» veri). Quando si chiude un contatto l'app chiede «Vuoi che te lo ricordi tra
   6 mesi?»: se sì, dopo 6 mesi torna in «Da riprendere». Dati: colonna nuova su `persone` (data «ricordamelo dal») e il
   nuovo valore di esito; calcolo nell'app dai passi; all'upline solo i numeri; il riepilogo del mattino può contare i
   contatti fermi senza nomi. Migrazione nuova (il numero 045 è stato usato dall'import mappe) con i controlli in
   `tests_rls.sql` e i test e2e.
4. A parte, per Stefano: il compito suggerito sui campi dei fogli che si svuotano quando l'app ridisegna (render).

**Come si lavora alla grafica**: prima/dopo con la stessa API finta dei test, a 360 px; spiegare in due righe cosa cambia
per i partner prima di ogni PR; `sw.js` va alzato a ogni consegna (ora v60).

## Import delle mappe Amway, seconda revisione (30 ottobre 2026)

Principio di Stefano: **la mappa Amway fa fede**, per struttura e dati; Growup legge e mostra, non corregge niente.
- **Codici esteri** (migrazione **047**): le righe estere si scartano e basta, con qualsiasi import. Tolta la regola della
  045 (il database riceveva i codici esteri per cancellarli o nasconderli): l'app non li manda più e `p_esteri` è
  ignorato. Un codice che esce dalla mappa italiana segue la regola di tutti quelli che escono. App v66.
- **Import diretto e chi importa** (migrazione **048**): niente anteprima, niente spunta del consenso (chi importa è
  upline delle persone della sua mappa), niente scelte «nascondi» durante l'import (le persone nascoste a mano dal Gruppo
  restano). Scelto il file, l'import parte subito; alla fine il foglio mostra il riepilogo (nuove, numeri aggiornati,
  spostati, non più nella mappa, cancellati, mesi precedenti salvati come numeri, file con errori). Chi importa è la riga di
  livello 1 (la prima riga di dati): deve avere il mio codice Amway; senza quella riga, o senza codice nell'app, l'import è
  rifiutato (il codice non si prende più dal file: arriva sempre dall'invito). Nessun blocco sui file parziali: chi esce
  per errore rientra con i suoi dati al prossimo import giusto. App v67.
- **Perimetro** (migrazione **049**): una riga vale solo se, di sponsor in sponsor, risale a chi importa (nel file, o a una
  persona già nella sua downline); le altre si ignorano, nell'app (il riepilogo le conta: «N righe ignorate») e nel
  database. Tolta la vecchia `importa_rete` (018), che l'app non usava più e saltava tutte le regole nuove; i controlli
  in `tests_rls.sql` che la usavano ora usano `importa_mappa`. App v68.
- **Chi esce dalla mappa** (migrazioni **050** e **050b**): con qualsiasi import, chi non compare più nella mappa esce dalla
  struttura e non lo vede più nessuno (`struttura_visibile` e `vedo` lo escludono); se usa l'app, l'app gli si blocca
  (`blocco_mappa`, separato dal blocco dell'admin; schermata «App bloccata»). I dati restano: se ricompare in una mappa
  riprende posto e dati e l'app si sblocca da sola. Dopo 12 mesi fuori (da `fuori_mappa_il`, ora del server) li cancella
  `pulisci_fuori_mappa`, ogni notte alle 02:15 UTC (050b, solo su Supabase), con i telefoni che vedono «accesso tolto».
  Tolta la cancellazione «solo con l'import dell'admin» (046). Chi sta sotto un gruppo che la mappa non mostra (Platino)
  non conta come uscito. App v69.
- **Ordine degli import nello stesso mese** (migrazione **051**): riferimento = data e ora di scaricamento della mappa
  (ultima modifica del file; se manca, l'ora dell'import), salvata con l'ora dell'import (`posizione_importata_il`,
  `numeri_mese.aggiornato_il`). La mappa dell'admin, quando viene caricata, fa sempre fede su tutto; dopo, la mappa di un
  partner aggiorna posizioni e numeri della sua parte solo se scaricata dopo quella in vigore. Il riepilogo dice chi ha
  già i dati di una mappa scaricata dopo. Chi rientra nella mappa ritrova l'app solo se non l'ha bloccata un admin;
  `fuori_mappa_da` registra chi ha segnato una persona fuori. App v70.
- Il 30 ottobre: migrazioni 047–051 (e 050b) applicate su Supabase e PR #138–#142 unite (v70 online).
- **Gruppo di un Platino senza app** (migrazione **052**): Platino «nascosto» = senza app e con le linee nascoste nella
  mappa più recente. Solo l'admin, dalla scheda (Azioni, «Gruppo di un Platino senza app»): «Invita una persona del suo
  gruppo» (entra sotto il Platino) e, dalla scheda di chi usa l'app nel gruppo del Platino, «Inserisci lo sponsor sopra»
  (entra tra lui e il suo sponsor); altrove niente inserimenti in mezzo. Chi entra così (`area_platino`) importa subito la
  sua mappa anche se in attesa: lo conferma e lo mette sotto il suo sponsor vero se è già nel gruppo del Platino. Se il
  Platino usa l'app, la sua mappa rimette tutto a posto. I VP di gruppo del Platino restano quelli ufficiali (nessun
  cumulo, test). App v71.
- **Ritocchi a Persone** (30 ottobre): scorrere di lato i filtri di Lista e Clienti non cambia più pagina e non trascina
  la pagina; nella Lista l'ultimo nome inserito sta in cima e sotto il nome si legge «Come lo conosci». App v72.
- **Scheda partner, «Questo mese e il mese prima»** (30 ottobre): per chi non usa l'app ma è nella mappa del mese, i VP
  personali del mese in corso sono quelli della mappa (prima contavano solo gli ordini scritti a mano: 0). Il «?» spiega la
  colonna centrale («set al 30» = il mese prima fino allo stesso giorno). App v73.
- **«Questo mese e il mese prima» a due colonne** (30 ottobre, scelta di Stefano): tolta la colonna «al giorno» del mese prima
  e il ▼ rosso che ne dipendeva; restano il mese in corso fino a oggi e il totale del mese prima. App v74.

## Import delle mappe Amway (29 ottobre 2026, una PR per punto)

Regole decise da Stefano: si salvano solo le righe con Paese = Italia (le altre si scartano e i codici esteri già
salvati si cancellano con i loro dati); funzionano entrambi gli export (17 colonne «KPI selezionati» e 26 «tutti i KPI»),
colonne riconosciute dal nome, «Sponsorizzazione» ignorata; telefono, email e indirizzo della mappa mai salvati;
rifà la struttura solo la mappa con il «Mese di competenza» più recente, una mappa di un mese precedente salva solo i
numeri di quel mese; un italiano che esce dalla mappa resta nascosto e si cancella dopo 12 mesi.
- **Punto 6 · livello di profondità**: «Qualifica Amway Partner» contiene il livello (1 = chi ha scaricato il file), non
  la qualifica: serve solo a trovare la riga di chi importa, non si salva. Verificato con un test (riga 1 in fondo al file). App v61.
- **Punto 3 · privacy** (migrazione **044b**): dalla mappa si leggono solo codice, nome, sponsor, **data di ingresso**, VPP,
  VPG, percentuale, dimensioni del gruppo e livello; telefono, email, indirizzo e data di rinnovo non arrivano mai al
  database (test sui dati inviati, anche per i mesi chiusi; scritto nel foglio dell'import). La data di ingresso della
  mappa fa fede: va in `partners.data_iscrizione` per tutti (anche chi importa e chi usa l'app); una data non valida o
  fuori dal 2000-oggi si ignora. Nel database: `partners.email` esiste dal primo schema ma è vuota e l'app non
  la usa; `persone.contatto` viene da Lista e Clienti, non dalla mappa. App v62.
- **Punto 2 · i due formati**: funzionano l'export «KPI selezionati» (17 colonne) e «tutti i KPI» (26), colonne trovate per
  nome in qualsiasi ordine; obbligatorie codice, sponsor, nome e VPP (altrimenti il messaggio dice quale manca);
  «Sponsorizzazione» non si legge; «Utente riservato/non visualizzabile» entra come «Utente riservato». Senza «Dimensioni
  gruppo» (17 colonne) chi non ha nessuno sotto nel file può nascondere un gruppo: chi sta sotto di lui non va «fuori dal
  report». Test: stesse persone nei due formati → al database arrivano esattamente gli stessi dati. App v63.
- **Punto 1 · solo Italia** (migrazione **045**, da applicare): colonna «Paese» obbligatoria; si tengono solo le righe
  «Italia»; delle estere l'app tiene solo il codice e lo manda a `importa_mappa`, che cancella con tutti i dati i codici
  esteri già importati (solo persone senza app nella downline di chi importa, e solo se importa un admin: per gli altri
  restano nascosti e segnati, perché i codici arrivano dal telefono e non si possono verificare). L'import si ferma se un italiano ha come
  sponsor un codice estero presente nel file, o se la riga 1 è estera; lo sponsor della prima riga (fuori dal file) va
  bene. Anteprima: «N persone nel file (più M di altri Paesi, che non si salvano)» e la sezione «Di altri Paesi · si
  cancellano». App v64.
- **Punto 4 · ogni mappa sostituisce la precedente** (migrazione **046**, da applicare dopo la 045): decide il «Mese di
  competenza» del file, non la data del file né il giorno dell'import. `partners.mappa_mese` = mese della mappa che ha messo
  ognuno al suo posto: una mappa dello stesso mese o più recente rifà sempre struttura, VP e percentuali; una di un mese
  precedente salva solo i numeri di quel mese (servono a Stabilità e mesi da Argento). L'app rilegge il proprio
  `mappa_mese` prima di leggere i file (la upline può aver importato da poco); con più file insieme rifà la struttura il
  mese più recente. Chi esce dalla mappa resta nascosto («non più nel report») e se ricompare riprende i suoi dati; dopo 12
  mesi fuori si cancella con i suoi dati (solo con l'import di un admin; anteprima «Fuori dalla mappa da 12 mesi · si
  cancellano»). «Utente riservato» prende il nome vero quando il file lo mostra. Lista, obiettivi, inviti e «perché» di
  chi usa l'app non si toccano. Attenzione, scelta di Stefano: con più importatori nello stesso mese vince l'ultimo file
  importato, anche se scaricato prima. App v65.

## Fermi la sera del 21 ottobre 2026

**Dove siamo**: Target, Lista e Clienti sono dentro Growup (pagina Persone), con conferma dal report Amway, blocco
dell'app da admin e listino Amway nel database. Migrazioni applicate su Supabase fino alla **037** (027 e la parte 2 della 033 — `togli_dalla_struttura` e `importa_mappa` —
incollate da Stefano nell'SQL Editor; 028b: permesso sul codice del listino). PR unite fino alla **#105**, nessuna aperta; il ramo di
lavoro è ricreato da main. Il listino di aprile 2026 è caricato da Stefano dal PDF: funziona.

**Il 21 ottobre in breve** (dettagli sotto): «Come arrivarci» (consigli a richiesta in Obiettivo e nella scheda partner,
anche da Argento a Platino) · qualifiche oltre Argento fino a Diamante Fondatore, prossima qualifica da Platino in su,
Volume Rubino · percorso Argento → Oro → Platino contato sui mesi al 21% dei report mappe, con l'import "solo numeri" dei
report dei mesi chiusi e Platino riconosciuto dall'app.

**22 ottobre — «La tua qualifica oggi» e i mesi del Performance Year**: l'etichetta del menu della qualifica è ora «La tua
qualifica oggi» (Stefano e Alessia: stati Smeraldo, oggi Platino Fondatore → dichiarano Platino Fondatore). Da Platino in su,
in Obiettivo sotto la prossima qualifica: righe con i mesi del Performance Year (da settembre) dai report importati —
Platino Fondatore (mesi da Argento su 12), Rubino Fondatore (mesi Rubino su 12), Zaffiro (mesi Zaffiro su 6/12:
4.000 VPG e 2 linee al 21%, o 3 linee al 21%), Smeraldo (linee al 21% da almeno 6/12 mesi su 3), Diamante (su 6) — più
«Report importati da settembre» e la tabellina «Le tue linee nel Performance Year» (mesi al 21% per frontale). In Io una
riga breve. «Come arrivarci» da Platino in su: non ancora (servono testi).

**22 ottobre — più report insieme**: nella scelta del file del report mappe si possono selezionare più file. I mesi chiusi
si salvano "solo numeri" uno dopo l'altro (anteprima con % e VPG di ogni mese); se c'è anche il mese in corso, dopo si
apre il suo import completo con l'anteprima di sempre; i file sbagliati sono elencati e non fermano gli altri.

**22 ottobre — la cifra porta oltre Argento** (cifre di Stefano dal calcolatore dei guadagni Amway, migrazione 032):
Argento **2.500 €** al mese senza incentivi Bronze (circa 3.750 € se ci si arriva mentre si ricevono ancora) · Platino
3.000 · Rubino 4.000 · Zaffiro 5.000 · Smeraldo 8.000 · Diamante 18.000; i Fondatori hanno la stessa cifra della loro
qualifica e **come obiettivo si propone sempre la qualifica senza "Fondatore"**; Oro si salta. Strutture: linee
qualificate della qualifica più altre linee aperte (ideale 10.000 VP, almeno 4.000 VP). Esempio: 9% e 8.000 € → Smeraldo.
Arrivati a Platino, nella domanda della prossima qualifica è già scelta quella dell'obiettivo. La guida «Guadagnare
con Amway» PY25 è stata letta e scartata (vecchia, solo esempi Fondatori, non coerente).

**23 ottobre — una sola struttura, la mappa Amway** (migrazione 033; decisioni di Stefano): la struttura di Growup è sempre
la copia della mappa ufficiale. Ogni import aggiorna posizioni e numeri di **tutto il gruppo** di chi importa (anche chi usa
l'app, anche se qualcuno sotto aveva già importato). **Vince il report più aggiornato**: il CSV ha solo il mese, quindi conta la
**data e ora del file** scaricato; un file più vecchio non cambia niente di quello che viene da file più recenti (l'anteprima
lo dice). Numeri ufficiali condivisi (`numeri_mese`): li vede la persona e tutta la sua upline (anche quelli importati da un
Platino in downline). Persone senza app: una sola copia, visibile a tutta la upline. **I VP del report vincono** su quelli
scritti a mano ovunque (Io, Obiettivo, gruppo); prima del report contano gli ordini. Chi non è ancora nella mappa è **in attesa**:
usa l'app ma i suoi dati restano suoi, l'upline lo vede solo per nome in «In attesa della mappa»; lo toglie **solo lo sponsor
diretto** (o l'admin); non può importare. Le parti che il report non mostra (gruppo sotto un Platino) non si toccano.

**23 ottobre — i miei ordini restano miei, e la bozza d'ordine** (migrazione 034; decisioni di Stefano dalla tavola «Bozza
ordine e VP»): il partner può sempre scrivere i suoi ordini e correggere il totale, ma **lo vede solo lui**. Sponsor e upline
vedono **solo i numeri del report** Amway, anche nei mesi senza report (lì vedono zero); la RLS non fa leggere a nessun altro gli
ordini e le correzioni di chi ha l'app. Chi non ha l'app resta com'è (valgono i VP scritti da chi lo segue finché non c'è un
report). Per me: **VPP del report + gli ordini scritti da me dopo la data e ora del file**; con un report nuovo il totale torna
al dato ufficiale. Su Io la barra mostra in verde il report e in rame gli ordini scritti dopo, con la riga che lo spiega. Nel
Gruppo i VP di chi ha l'app vengono dal report (preferiti, etichette, confronto col mese prima senza la riga «Ordini»).
Nuove sezioni su Io: **Bozza ordine** (prodotti dal listino; per ogni prodotto e nel totale VP, prezzo Partner e prezzo al
pubblico; una sola bozza, salvata nel database, solo mia) e **I miei ordini** (storico; «Rifai» copia i prodotti in una nuova
bozza; «×» toglie l'ordine dopo la conferma e i suoi VP escono dal mese). Bozza e storico non entrano nella copia dei dati
(come Liste e Clienti, gli admin non li vedono). Idea per il team (fuori dall'app): ogni Platino importa il report una volta a
settimana, così il Gruppo è aggiornato. Stefano conferma: dopo un report contano solo gli ordini scritti dal partner stesso
(quelli scritti da chi lo seguiva prima che entrasse nell'app restano al report). **Prezzi e VP di prodotti e ordini con due
decimali** (96,30 € · 18,20 VP) in bozza, storico, clienti e listino; cifre degli obiettivi e totali del mese come prima.

**27 ottobre — Ottimizzazione 1 di 3: «Il mio giorno» e Ordini** (tavola «Il mio giorno e Ordini», scelte di Stefano;
solo interfaccia, nessuna migrazione, annullabile con «Revert» della PR). «Il mio giorno» in tre blocchi fissi:
**«Da fare oggi»** (solo con il Seguimi attivo: le azioni del Seguimi, sotto «Anche da sentire» con gli altri follow-up in
ritardo o di oggi e i clienti da sentire senza doppioni, e la riga «Altri N in corso nella Lista ›»; senza Seguimi restano i
due riquadri di prima, «Il tuo percorso con la lista» e «I tuoi clienti da sentire») · **«I miei numeri»** (riga
dell'obiettivo, riga della tappa che si apre su requisiti/linee/note, settimana e mese in un solo riquadro) · **«Diario di
oggi»** chiuso di base. **«+ Ordine»** nella barra in basso apre il foglio **«Ordini»**: Ordine veloce · Bozza ordine · I miei
ordini · Aggiorna il totale del mese · Ordini dal sito Amway (lo stesso import di Clienti, che resta anche lì; bozza e storico non sono più nella pagina Io). «Importa dal report Amway» solo in Gruppo;
in Io un promemoria se ho un gruppo, ho già importato e l'ultimo report ha più di 7 giorni. Prossime: PR 2 (C+D, «Primi
passi» con «Scrivi 30 nomi», spiegazioni a richiesta con «?») e PR 3 (E+F+G, Profilo, scheda partner a schede, parole
uniche), ognuna con la sua tavola prima del codice.

**27 ottobre — Ottimizzazione 2 di 3: «Primi passi» e spiegazioni a richiesta** (tavola «Primi passi e spiegazioni»,
scelte di Stefano; solo interfaccia). In cima a Io un solo riquadro **«Primi passi»** al posto di «Salva il link», «Installa
l'app», «Scrivi il tuo obiettivo» e «In attesa della mappa»: voci con ✓, contatore «N su M» e barra; ogni voce si apre lì
sotto (link personale aperto finché non è salvato; installa solo dal telefono, «Non ora» la segna fatta; obiettivo; **Scrivi
30 nomi nella tua Lista** con «12 / 30» e la frase «Senza decidere tu…»; primo import solo per chi ha persone sotto);
«In attesa della mappa» è una riga con «?». Sparisce a tutto fatto; la **×** lo nasconde su quel telefono (non finché il
link non è salvato). Le spiegazioni lunghe di Lista, Clienti, Target, Struttura, Preferiti, In attesa, Storico del gruppo,
scheda partner e Guida sono dietro un **«?»** accanto al titolo; restano visibili note sui guadagni, avvisi prima di
cancellare o bloccare, istruzioni dei fogli. Prossima: PR 3 (Profilo, scheda partner a schede, parole uniche).

**27 ottobre — Il mese da Argento con la linea al 21%** (migrazione 038, regola di Stefano): un mese al 21% conta come
mese da Argento solo senza linee al 21%, con 2 o più linee al 21%, o con una linea al 21% e almeno **4.000 VP di gruppo
rimanenti** fuori da quella linea; altrimenti è solo «21%». Vale per i mesi verso Oro e Platino, il Performance Year e
«Come arrivarci» (il consiglio «linea al 21%» ora conta i VP fuori dalla linea). Nuova funzione `mesi_qualifica`
(al posto di `mesi_report` nell'app). Glossario da correggere nella PR 3: Oro e Platino la prima volta sui 12 mesi dal
primo mese da Argento, poi sull'anno fiscale.

**27 ottobre — Ottimizzazione 3 di 3: Profilo, scheda partner e parole uniche** (tavola «Profilo e scheda partner»,
scelte di Stefano; solo interfaccia). L'**omino in alto a destra** apre «Il mio profilo»: nome, codice d'invito, codice
Amway, punto di partenza, link personale, «Installa l'app» e «Mostra di nuovo i Primi passi» quando servono, **Parole
dell'app** (glossario, con «Mese da Argento» e «Anno fiscale» corretti da Stefano), privacy, Esci e, solo per gli admin, la
sezione **Admin** (copia dei dati, listino, codici Amway tolti, Correggi). Il fondo delle pagine non c'è più. La **scheda
partner** ha due schede: **Numeri** (si apre sempre qui: numeri, linee, Come arrivarci, confronto, Analisi come pulsante,
Seguimi) e **Azioni** (chiamata, numeri da aggiornare, accesso, inviti, struttura, blocco). «VP fatturati» → **«VP
personali»**.

**28 ottobre — Grafica, punto 5 di 7: Persone** (scelte di Stefano): i filtri di Lista e Clienti stanno su una riga sola
che scorre di lato; i pulsanti in alto non vanno mai a capo e si accorciano in «Importa» e «+ Nome» (Lista), «Importa» e
«+ Cliente» (Clienti). Tolto anche il margine in più che spostava le righe di pulsanti con la classe `wrap` (anche nei
filtri dell'import). App v60.

**28 ottobre — Grafica, punto 4 di 7: Stabilità della tua rete** (migrazione 044, decisioni di Stefano): la scheda riproduce
la tabella «Verifica la tua attività - Stabilità» di Cum Laude 21. La percentuale si raggiunge solo con il fatturato; i numeri
della tabella servono a sostenerla nel tempo. I riferimenti stanno nelle impostazioni (`stabilita_cl21`). Mese di riferimento:
l'ultimo mese chiuso con la mappa importata (chi non ne ha guarda il mese in corso), scritto in evidenza; se manca la mappa del
mese appena chiuso, l'avviso «Importa la mappa di … per aggiornare». In cima «Livello raggiunto» (dal fatturato del mese) e
«La tua rete reale» (il livello più alto sostenuto in tutte le righe, altrimenti «in costruzione»); un numero non ancora inserito resta
neutro con «da inserire» e fuori da «Su cosa lavorare» («ne servono M per sostenere il X%»); per riga il numero e
le sette caselle (verde ✓ sostenuto, ambra ! raggiunto ma non sostenuto, neutro sopra, con ✓ se il numero c'è già),
«Questo mese finora» per nuovi iscritti e codici oltre 200 VP (il partner più la sua rete, solo dalle mappe: senza una mappa
del mese «disponibile dopo l'import della mappa», con `con_mappa` in `guida_conteggi`);
in fondo «Su cosa lavorare». Training Day e Convention: l'ultimo evento, scritto a mano. Tutti i numeri nel carattere del
testo. App v59.

**28 ottobre — Grafica, punto 3 di 7: colori della profondità** (palette approvata da Stefano): nel Gruppo il livello 1
(chi guarda) è bianco e non si ripete; dal 2 il ciclo blu, viola, petrolio, rosa, nocciola, poi si riparte. La numerazione
era già relativa a chi guarda. Il test del foglio «Invita» riscrive i campi se un ridisegno li svuota. App v58.

**28 ottobre — Grafica, punto 2 di 7: colori con significato fisso** (scelte di Stefano): pesca = selezione e azione
principale (pulsanti principali, scelte, filtri; i tre pulsanti in basso tutti pesca con icona persona/calendario/carrello,
«416,83 VP · mese» su una riga); verde = fatto e progresso (barre anche di Primi passi, puntini della Lista, tappa attuale,
mesi importati); ambra/terracotta solo per l'attenzione; etichette di sezione in grigio. Variabili `--scelta`, `--progresso`
(GRAFICA.md). App v57.

**28 ottobre — Grafica, punto 1 di 7: sotto-linguette nel tema scuro** (richiesta di Stefano, con la skill frontend-design,
stessa identità e colori): la sotto-linguetta scelta (Il mio giorno/Guida, Target/Lista/Clienti) nel tema scuro è chiara e
piena (avorio, testo smeraldo) come nel chiaro, non più scura delle altre. Variabili `--linguetta` e `--linguetta-ink`.
Schermate prima/dopo nella pagina privata «Growup · grafica prima e dopo». Seguono i punti 2-7 (colori con significato,
profondità, Stabilità, Persone, Gruppo, contrasto e a capo), una PR ciascuno. App v56.

**28 ottobre — Admin nel proprio gruppo e ritocchi** (gruppo D, migrazione **043** e Edge Function `invia-notifiche`
aggiornata, da applicare/pubblicare dopo l'unione): nuovo link personale, blocco, «Togli» e codici tolti solo nel gruppo
dell'admin; impostazioni, tappe e livelli solo con un profilo (l'ingresso riceve le qualifiche con l'invito); il punto di
partenza solo da «Modifica punto di partenza» (punto 6); notifiche solo dai servizi ufficiali e prova al massimo una al
minuto e 10 al giorno; indici sulle chiavi esterne e regole di accesso più veloci; `inizio_py` con search_path fisso.
pg_net resta in public (spostarlo è rischioso e non serve). App v55. Resta il gruppo E (grafica, sessione a parte).

**28 ottobre — Copia di sicurezza e «in attesa»** (gruppo C, migrazione **042**, da applicare su Supabase dopo l'unione):
dalla copia di sicurezza escono il «perché» dell'obiettivo, le email e l'impronta delle chiavi d'accesso; gli ordini e le
correzioni scritti a mano restano (scelta di Stefano: servono a ripristinare). Di chi è in attesa della mappa l'upline
riceve solo il nome; l'anteprima dell'import lo riconosce chiedendo al database (`attesa_nel_report`) chi è nel report
che si sta importando. La 041 è stata applicata per intero al secondo tentativo (al primo si era fermata dopo la tabella).
App v54. 042 applicata su Supabase. Poi **042b** (da applicare): al massimo 30 richieste e 20.000 codici al giorno
per `attesa_nel_report`, una alla volta, perché senza limite si potevano provare codici a caso (revisione automatica).

**28 ottobre — Si entra solo su invito** (gruppo B, migrazione **041**, decisioni di Stefano; **da applicare su Supabase
subito dopo l'unione della PR**): niente più link d'invito generico. In Gruppo la voce **«Invita»**: chi è già nella mappa
(o un admin) scrive nome e codice Amway del nuovo partner e ottiene un link con solo un codice casuale, che vale una volta
e 7 giorni; nella lista «I tuoi inviti» lo annulla o crea un nuovo link. Chi entra sceglie solo qualifica e data (nome e
codice li ha scritti chi invita). Se il codice è già nella mappa l'invito lo crea solo chi sta sopra quella persona, e chi
entra prende subito il suo posto; altrimenti resta «in attesa» sotto chi l'ha invitato finché un import di chi l'ha
invitato o della sua upline non lo mette sotto il suo sponsor vero (`importa_mappa` non cambia). Notifiche senza nomi
(`notifiche_eventi`, al giro dei 15 minuti): a chi ha invitato quando il nuovo entra e quando va al suo posto; allo
sponsor vero, se è un altro e usa l'app. Spariscono l'«invito sopra» e il link personale per chi non è mai entrato.
Dalla Lista, chi ha detto sì come partner ha «Invitalo in Growup» (apre Invita con il nome). Test: permessi (anche sul
riuso, la scadenza, l'annullo, la rigenerazione, gli avvisi) e interfaccia (593 controlli). App v53.

**28 ottobre — Controllo completo e test affidabili** (gruppo A di 4, richiesta di Stefano dopo il controllo di sicurezza,
RLS e interfaccia): i test del database si lanciano con `sh test/db.sh` e **si fermano al primo errore**. Prima, se
l'installazione si fermava a metà (a `stub_supabase.sql` mancava il ruolo `service_role`, quindi tutto dalla 039 in poi
non veniva installato) l'ultima riga di `tests_rls.sql` diceva comunque «TUTTI I CONTROLLI SUPERATI». Ora quella riga
lo dice solo se i controlli sono arrivati in fondo, e lo script controlla che ogni tabella e funzione esista. Il test
dell'interfaccia conta come errore anche un file dell'app che non arriva (404) e, se si blocca, dice perché.
Prossimi gruppi, una PR ciascuno: B) entrare solo con un invito personale (fatto, sopra); C) copia di sicurezza e «in attesa» (fatto, sopra);
D) poteri da admin nel proprio gruppo, tabelle di impostazioni solo con profilo, notifiche di prova, ritocchi tecnici (fatto, sopra);
E) grafica, in una sessione a parte.

**28 ottobre — «Prossima cosa» con la ×** (Stefano, dopo aver provato l'avviso: arriva giusto e apre la scheda): nella scheda della persona una × accanto alla prossima cosa toglie giorno, ora e nota (e quindi anche l'avviso non ancora suonato). App v52.

**28 ottobre — Notifiche, parte 2** (migrazione 040, già applicata): nel prossimo passo, accanto al giorno, l'**ora
facoltativa**; con l'ora arriva un avviso **30 minuti prima** («Growup · alle 18:30 — Hai un passo da fare con una persona
della tua Lista», o «con un tuo cliente»), senza nomi; il tocco apre la sua scheda (`?persona=<id>`). L'ora si vede con il
giorno nella scheda, nella Lista e in Io. App v51.

**28 ottobre — Icona delle notifiche**: nella barra in alto di Android la notifica mostrava un quadratino bianco; ora c'è la sagoma del logo (la «G» con la freccia, `badge-96.png`, bianca su trasparente). Notifiche provate da Stefano: funzionano. App v50.

**28 ottobre — Notifiche, parte 1** (migrazioni 039 e 039b, Edge Function `invia-notifiche`; tavola «Notifiche di Growup»;
costi: zero sul piano gratuito, anche con centinaia di utenti). La domanda «Vuoi un promemoria ogni mattina?» compare una
volta sola per telefono; nel Profilo l'interruttore «Notifiche su questo telefono» e «Manda una notifica di prova». Ogni
mattina alle 8:30 (ora italiana) un riepilogo senza nomi, solo se c'è qualcosa: persone da risentire, clienti da sentire,
azioni del Seguimi, VP mancanti (ultimi 5 giorni del mese), report mappe più vecchio di 7 giorni, chiusura del mese. L'app
salva per i prossimi 14 giorni solo i numeri; il server invia ogni 15 minuti (pg_cron). Chiavi e segreto generati e custoditi
da Supabase. iPhone: solo con l'app sulla Home (iOS 16.4+). Prossimo: parte 2, l'ora del prossimo passo e l'avviso 30 minuti
prima. App v49.

**28 ottobre — «Glossario»**: nel Profilo la voce «Parole dell'app» si chiama ora «Glossario» (Stefano). App v48.

**28 ottobre — Spiegazioni del «?» più chiare** (richiesta di Stefano dal telefono): riscritti tutti i testi dei «?» (cosa
vedi, da dove vengono i numeri, cosa puoi fare), per esempio «Il tuo piano» spiega i numeri di base (1 sì ogni 5 piani,
1 piano ogni 2-3 contatti) e che con 10 piani nella Lista l'app usa i propri; «Le tue abitudini» si apre in alto come gli
altri, non più in fondo. App v47.

**28 ottobre — Import più veloce: un solo «Importa da Amway»** (scelte di Stefano). Automatizzare del tutto non si può:
Amway non ha API né invio dei report per email, l'export sul sito è a richiesta (si chiede, si aspetta «Pronto», si
scarica), una web app non può leggere il sito Amway né la cartella Download del telefono (regole di sicurezza dei browser),
e un programma con la password Amway è escluso (sicurezza, regole Amway). Scartati anche «Condividi → Growup» (vantaggio
minimo) e un'estensione per Firefox su Android (da valutare solo se servirà). Fatto: **un solo pulsante «Importa da
Amway»** (Gruppo, promemoria in Io, «Report da importare», foglio «Ordini», Clienti, Primi passi) che apre subito la scelta
dei file; si scelgono insieme mappa, ordini e clienti, l'app riconosce quale è quale (`tipoFileAmway`), importa prima la
mappa e poi apre da sola l'import di ordini e clienti; i file non riconosciuti sono segnalati con il nome. Scorciatoia
sull'icona su Android (pressione lunga → «Importa da Amway», `?importa=1`). App v46, E2E 568 controlli.

**Dove siamo arrivati (27 ottobre, sera — si riprende il 28)**: tutte le PR sono unite fino alla **#112**, nessuna aperta;
il ramo di lavoro è ricreato da main. Migrazioni applicate su Supabase fino alla **038** (`mesi_qualifica`, mese da Argento con
la linea al 21%). App **v45** (service worker `growup-team-v45`). Fatti oggi, in ordine: PR #107 «Il mio giorno» in tre
blocchi e foglio «Ordini» · #108 «Ordini dal sito Amway» nel foglio · #109 correzione: «Ordine veloce» apriva l'ordine di un
cliente · #110 «Primi passi» (30 nomi) e spiegazioni con «?» · #111 regola del mese da Argento (4.000 VP rimanenti fuori dalla
linea al 21%; sui dati reali 1 mese su 5 al 21% non è più da Argento) · #112 Profilo dall'omino, scheda partner in Numeri e
Azioni, «VP personali», glossario. E2E: **565 controlli**; test RLS: tutti superati. Tavole su claude.ai: «Il mio giorno e
Ordini», «Primi passi e spiegazioni», «Profilo e scheda partner». Lasciato com'è per scelta di Stefano: «I miei ordini» solo
con gli ordini dalla Bozza (gli ordini importati stanno nella scheda di ogni cliente), nessun avviso tra Ordine veloce e
bozza aperta. Lavori possibili dopo, da scegliere con
Stefano: **notifiche vere** (un avviso al giorno, testo senza nomi: persone da risentire, Seguimi, clienti, scadenze; prove su
Android e sull'iPhone di Alessia); **«Come arrivarci» da Platino in su** (Rubino, Zaffiro, Smeraldo, Diamante; prima il foglio
di revisione); la **fase di prova** con 2-3 leader (messaggio d'invito, primo ingresso, primo import, riscontri dopo una
settimana). Pagina di riepilogo per i partner: «Da dove arrivano i dati di Growup» (artifact e PDF mandati a Stefano).

**Aperto, in attesa di Stefano**:
- Provare dal vivo la **v45** sul telefono: «Il mio giorno» (Da fare oggi con il Seguimi, I miei numeri con la tappa che si
  apre, Diario chiuso), foglio «Ordini» (5 scelte), «Primi passi» e la ×, i «?», l'omino e il Profilo (sezione Admin), la
  scheda partner con Numeri e Azioni, il conteggio dei mesi da Argento dopo la regola 038.
- Controllare sul sito Amway che la **%** delle linee frontali nei report importati sia quella giusta (serve a «Come arrivarci»
  da Argento a Platino).
- Provare dal vivo (app v40): bozza ordine → conferma → VP solo nella propria app (l'upline non li vede), «Rifai» e «×»,
  reimport di un report più nuovo che riporta il totale al report, due decimali, un nuovo partner che entra con il link e il
  codice (in attesa → al posto giusto con il primo import).
- Verifica in due passaggi su GitHub: controllare in github.com/settings/security.
- **Copie di sicurezza**: vedi la voce del 21 ottobre più sotto (la copia dall'app non contiene Liste e Clienti).

**24 ottobre — decisioni di Stefano**: il **Volume Rubino** non serve (è il VPG senza le linee qualificate 21%, con la regola
dell'anno fiscale): si conta sempre il **VPG delle mappe**. Report dei mesi passati importati da settembre. Niente pulsante
«Invitala nell'app»: si condivide il proprio link e l'import mette ognuno al posto giusto. Al primo ingresso il codice Amway
si scrive **due volte** («Riscrivi il codice»: se non sono uguali non si entra) con l'avviso di controllarlo bene (si trova sul sito o nell'app Amway, nell'icona del profilo in alto a destra). Ogni mese
copia dei dati e ZIP del codice; il piano Pro di Supabase si valuta **all'inizio della prova** con i Partner.

**27 ottobre — Analisi della persona** (migrazione 037; tavola «Analisi della persona» v3, decisioni di Stefano): pagina a
parte, aperta solo a richiesta, di sé («La mia analisi» nella Guida) e di chi è nel proprio gruppo («Analisi di …» nella
scheda partner). Anno fiscale (da settembre), dai report: riepilogo (mesi con il report, mesi al 21%, VP di gruppo medio, linea
più forte); **andamento delle linee** con nome, VP di gruppo e percentuale mese per mese, **senza calcoli** (niente
differenziale), peso sul gruppo, mesi al 21%, tendenza (ultimi 3 mesi sui 3 prima: oltre +10% in crescita, oltre −10% in calo,
altrimenti stabile); **Stabilità Cum Laude 21 mese per mese** (nuovi iscritti con il link, nuovi nel gruppo, codici oltre 200 VP,
con la soglia del livello del mese; da ottobre 2026) e i numeri scritti a mano. **Un solo interruttore** nella Guida, «Condividi
i tuoi dati con il tuo sponsor e la tua upline» (spento di base, indipendente dal Seguimi): acceso, l'upline vede i numeri del
Seguimi, i numeri scritti a mano e le abitudini; mai i nomi, e i VP restano sempre quelli dei report. Senza interruttore
l'upline vede solo struttura, numeri dei report, obiettivo (cifra e data), prossima qualifica, contatti e piani della
settimana con i suoi obiettivi, i numeri della Lista e l'ultimo aggiornamento.

**26 ottobre — usabilità** (richieste di Stefano): **indietro con il dito**: tra le pagine principali il dito scorre come
prima; chi arriva in una schermata da un collegamento (Lista o Gruppo dalla Guida, una persona da «Oggi per te» o da Io, una
scheda partner) trascinando verso destra torna dove era partito, allo stesso punto della pagina. **Barra fissa in alto**:
le pagine (Obiettivo · Io · Persone · Gruppo) e i pulsanti della sezione (Il mio giorno · Guida, Target · Lista · Clienti)
restano visibili scorrendo; il titolo con il nome scorre via. **Guida**: formazione e chiamata con lo sponsor si spuntano
anche nelle settimane prima («‹ Settimana prima», fino a 8 settimane; mai nel futuro).

**26 ottobre — Seguimi giorno per giorno** (migrazione 036; tavola «Seguimi giorno per giorno» v2): in fondo alla Guida due
interruttori, «Seguimi giorno per giorno» e «Fai vedere al tuo sponsor e alla tua upline cosa fai» (spento di base). Chi lo
attiva trova in cima a «Il mio giorno» **«Oggi per te»**: le azioni del giorno fissate al primo accesso (al massimo 3 contatti
dai primi «In lista», follow-up e piani da risentire oggi o in ritardo, clienti da sentire, i VP che mancano all'obiettivo del
mese, la formazione e la chiamata con lo sponsor se non ancora fatta nella settimana). Si spuntano da sole quando si segna il
passo o l'ordine; formazione e sponsor a mano. Sotto: «Oggi: N su M fatte» e i giorni di fila con almeno metà delle azioni.
Se il partner condivide, nella sua scheda sponsor e upline vedono la settimana **solo con i numeri**, mai i nomi; se no niente.
Niente pulsante «Ricordamelo» (deciso da Stefano). **Notifiche vere (da fare più avanti)**: Web Push (permesso sul telefono;
su iPhone solo con l'app installata e iOS 16.4+), chiavi VAPID (la privata solo su Supabase), tabella degli indirizzi di
notifica, funzione su Supabase con orario programmato; un solo avviso al giorno, testo generico senza nomi; si potranno
usare anche per le persone da risentire (date della Lista), appuntamenti, clienti da sentire, scadenze del mese.

**26 ottobre — la Guida per l'azione** (migrazione 035; tavola «Guida per l'azione» v4, decisioni di Stefano): in cima a Io
due pulsanti, «Il mio giorno» (la pagina di sempre, senza consigli) e «Guida». La Guida ha: **il tuo piano** (dalla cifra e
dalla tappa dell'obiettivo a quanto manca, e in attività: piani e contatti per un sì, con i rapporti della Lista dopo 10 piani,
altrimenti di base 1 piano ogni 2-3 contatti e 1 sì ogni 5 piani); la tabella **Stabilità di Cum Laude 21** (livello del mese e
successivo; i miei nuovi iscritti = entrati con il mio link nel mese, anche se poi vanno in profondità; nuovi nel gruppo = codici
nuovi nella mappa solo dal secondo import di chi importa; codici oltre 200 VP dai report; codici nell'app CumLaude21, al Training
Day e alla Convention scritti dal partner, restano finché non li cambia); **cosa fare adesso** (i passi della tappa, testi di
Stefano); **le abitudini** della settimana (contatti, piani e follow-up dalla Lista; formazione e chiamata con lo sponsor con
obiettivo scelto dal partner e spunta per giorno; eventi e audio: «apri l'app CumLaude21»). Obiettivi, spunte e numeri scritti
sono solo del partner. **Procedura d'ingresso confermata**: il nuovo partner entra con un link del suo gruppo e il suo codice
(scritto due volte); se il codice non è ancora nella mappa resta «in attesa» sotto chi ha mandato il link; il primo import che
lo mostra lo **sposta e lo conferma** da solo: nessuno conferma a mano (lo sponsor diretto può solo toglierlo da «In attesa»).
Prossimi: Fase B «Seguimi giorno per giorno» (il partner sceglie se l'upline vede cosa fa), poi Fase C «Analisi della persona».

**24 ottobre — storico e barra** (dalle prove di Stefano): nello storico personale la qualifica del mese si calcola fino ad
Argento; se nell'anno fiscale (da settembre fino a quel mese, dai report importati) è già raggiunta una qualifica annuale,
vale quella: Oro 3 mesi da Argento, Platino 6, Platino Fondatore 12; da Platino: Rubino (un mese Rubino), Zaffiro 6 mesi,
Smeraldo 3 linee al 21% per 6 mesi, Diamante 6 linee per 6 mesi (Fondatori: 12). Prima mostrava «Diamante Fondatore» per un
errore (le qualifiche annuali non hanno requisiti del mese). La barra di «Il mio mese» oltre l'obiettivo si divide in
proporzione al totale: la parte scritta dopo il report si vede sempre.

**21 ottobre — avviso di Supabase (email "Final notice", grants dal 30 ottobre)**: dal 30 ottobre 2026 Supabase non dà
più in automatico i permessi delle API alle **tabelle nuove** dello schema public (le esistenti non cambiano). Per Growup
non cambia niente: ogni tabella è sempre stata creata con `revoke all` e i `grant` espliciti (anche per colonna) nella
stessa migrazione, più la RLS; controllate tutte le 24 tabelle. Regola che resta: **ogni tabella nuova con i suoi grant
nella stessa migrazione** (vale anche per `installa_tutto.sql` su un progetto nuovo).

**21 ottobre — copie di sicurezza, il punto**: il **codice** è su GitHub e `installa_tutto.sql` ricrea tutto il database
vuoto. I **dati**: Supabase gratuito non fa copie automatiche; la copia dall'app («Scarica la copia dei dati», solo admin,
`copia_dati()`) contiene partner, attività, obiettivi, storico, numeri dei report, impostazioni, ma **non** le Liste, i
passi, il Target, i Clienti e gli ordini (per scelta: gli admin non li vedono) né il listino e i codici tolti. Decisioni
di Stefano: una copia l'ha già scaricata; il **piano Pro** di Supabase (copie automatiche giornaliere, comprese Liste e
Clienti) si attiva **al lancio ai Partner**. Ogni mese, insieme alla copia dei dati, si scarica lo **ZIP del codice** da
GitHub (procedura in `LEGGIMI.md`). Da fare: verifica in due passaggi sull'account GitHub.

**Fatto il 19-20 ottobre** (dettagli più sotto, in ordine di data): import da Amway degli ordini e dell'elenco clienti
(telefono, ultimo ordine, "Mai comprato" in Lista); Modifica dell'ordine e dei dati del cliente; etichette Da consegnare /
Da pagare; "Scrivigli" con tutti i prodotti che finiscono entro 7 giorni; + Contatto e + Piano di Io che aprono il nome e
il passo; scheda della persona (chiusura dopo il follow-up, Non ora con promemoria 2 giorni prima, Nota nei dati, dati
modificabili toccando il nome, anche per i clienti); "+ Un nome" resta nella lista; Target anche su Telegram; "Non ora"
solo in Da riprendere; Da confermare / Togli dalla struttura / Blocca l'app; listino nel database con prezzo Partner e
VP negli ordini e aggiornamento dal PDF.

**Fatto il 20 ottobre**: l'ultimo ordine dell'elenco clienti si somma agli ordini già presenti (anche con un ordine
"fatto da me" più recente), senza doppioni; decisione di Stefano: i partner caricano l'export **Ordini** (lo storico vero),
l'import accetta Clienti e Ordini insieme. **App in movimento**: tavola di prova "Growup Team in movimento" su claude.ai,
scelta **Vivace** con le pagine **Sobria**; coriandoli ai traguardi personali (contatti e piani della settimana, VP del
mese, nuova tappa, primo cliente e primo partner), una volta sola per periodo; "riduci animazioni" rispettato.

**21 ottobre — «Come arrivarci»** (testi dalla tavola "Come arrivarci", versione 2): un riquadro chiuso nella pagina
Obiettivo (per sé, "tu") e nella scheda partner (per sponsor e upline, in terza persona). Una situazione alla volta, la
prima che scatta: primo ordine · primi clienti (solo per sé) · fermo (0 VP personali) · VP personali · nessuna linea ·
manca una linea · linee sotto il VP della tappa · VP di gruppo · tutto a posto. La tappa guardata è la prima dal Path to
Bronze in su non ancora chiusa (qualifica dichiarata o mese chiuso). In cima, dal Path to Bronze in su, la riga fissa
"Ricorda: per X servono anche N VP personali nel mese". Sotto, la tabellina delle linee: VP, persone (chi apre la linea e
chi ha sotto), a 0, sotto 50, 50-99, 100-199, 200+, VP medio di chi fattura, quanto manca. **Mancano persone** se almeno
1 persona su 4 è attiva (100 VP e oltre) nelle linee considerate, altrimenti **fatturato basso**, con le persone tra 50 e
99 nominate a parte. I testi stanno in `CONSIGLI` (app.js): si cambiano lì. Nessun dato nuovo nel database.

**21 ottobre — qualifiche oltre Argento** (dal documento Amway "Livelli di Qualifica" 12-2025, letto e non salvato
nel repository): nel menu della qualifica più alta Oro, Platino, Platino Fondatore, Rubino, Rubino Fondatore, Zaffiro,
Zaffiro Fondatore, Smeraldo, Smeraldo Fondatore, Diamante, Diamante Fondatore. Sono annuali (mesi del Performance
Year, 1° settembre - 31 agosto): **si dichiarano** dal Punto di partenza (Oro e Platino poi sono diventati tappe del
percorso: vedi sotto). Chi dichiara **Platino o più** sceglie la **prossima qualifica** (all'ingresso e in Modifica; in Obiettivo
il riquadro con i requisiti); sponsor e upline la vedono nella scheda. **Volume Rubino** = VPG del report mappe (le linee
al 21% non ci sono, confermato da Stefano): "Volume Rubino questo mese: X su 20.000 VP", solo con il report del mese.
Per dopo: contare i mesi del Performance Year (Oro, Platino, Rubino Fondatore, Zaffiro) e le linee al 21% per mese
(Smeraldo, Diamante); Volume Equivalente ignorato; nessuna cifra in euro oltre Argento.

**21 ottobre — il percorso oltre Argento** (decisione di Stefano: "il percorso non si deve fermare ad Argento"):
… Builder 18% → **Argento → Oro → Platino**. Un **mese da Argento** è un mese in cui il report mappe importato dà la
persona al **21%**. Prima volta (regola Amway): si contano gli **ultimi 12 mesi**; Oro = 3 mesi, Platino = 6 mesi di cui 3
di fila. A Platino l'app lo **riconosce da sola** (la qualifica dichiarata diventa Platino, festa) e chiede la
**prossima qualifica**. Da Platino in su le qualifiche si dichiarano. Chi entra come **Argento o Oro** indica il mese
della prima qualifica Argento e importa i report **da quel mese** (al massimo 12); chi entra come **Platino o più** li
importa **da settembre**. In Io e Obiettivo il riquadro «Report da importare» (✓/○ per mese) finché ne manca uno. I report
dei **mesi chiusi** si importano "solo numeri" (21%, VPG, linee): la struttura e i VP non cambiano. Lo sponsor vede nella
scheda «Mesi da Argento: N su 3/6» (dai report che ha importato lui). Nota: il report ha anche una colonna "VP Rubino":
da verificare con Stefano se usarla al posto del VPG.

**21 ottobre — «Come arrivarci» da Argento a Platino** (tavola "Da Argento a Platino" v2, corretta da Stefano): per le
tappe Oro e Platino, in ordine: report mancanti (solo per sé) · questo mese al 21% · 6 mesi ma non 3 di fila (con la fila
in corso, sul mese in corso: «il mese scorso eri al 21%: questo mese è il secondo dei 3», PR #91) · una linea al 21% e meno di 4.000 VP · vicino al 21% (da **8.000** VPG) ·
una linea vicina al 21% (da 8.000) · lontano dal 21% (mancano persone / fatturato basso, regola di 1 su 4). Riga fissa
«Mesi da Argento negli ultimi 12 mesi: N su 3/6», tabellina con la **%** di ogni linea. Lo sponsor lo vede nella scheda
di chi è tra Argento e Platino (mesi dai report importati da lui).

**Da fare / in sospeso per Stefano**:
- **Importare subito il report mappe**: dalla 027 tutti (tranne gli admin) sono "Da confermare" e chi ha qualcuno sotto
  lo può togliere; il primo import conferma chi è nel report.
- Provare sul telefono le animazioni e i coriandoli (Android e iPhone di Alessia).
- Provare con dati veri Target, Lista, Clienti (import ordini e clienti) e i tempi (preavviso 7 giorni, fermo dopo 45,
  verifica dopo 8).
- Prima del lancio: prova su iPhone con Alessia, copia di sicurezza, pilota con 2-3 leader, messaggio al gruppo.
- Sicurezza: verifica in due passaggi su GitHub, Supabase e Google; privacy dell'email su GitHub; richiesta al supporto
  GitHub di pulire la storia (dati reali di prima e ora anche `catalogo.js`, il listino per l'incaricato).
- In futuro: una sezione "analisi della persona" (bonus per linea), fuori dalle schermate di tutti i giorni.

**20 ottobre — ultimo ordine dall'elenco clienti**: si somma agli ordini già nell'app. Prima, se il cliente aveva un
ordine "fatto da me" più recente, l'ultimo ordine del sito veniva saltato: ora contano solo gli ordini "dal sito" (con la
stessa data o dopo) e l'export Ordini; reimportando lo stesso file non si aggiunge due volte.

**20 ottobre — l'app in movimento** (tavola di prova "Growup Team in movimento" su claude.ai; scelta di Stefano:
**Vivace**, ma tra le pagine **Sobria**): cambio pagina e apertura/chiusura di una scheda scivolano brevi nella direzione del
tocco, con le card che compaiono una dopo l'altra; pulsanti che si premono e tornano su elastici; numeri che saltano e barre
che si riempiono scorrendo; fogli dal basso che salgono e scendono; messaggi che salgono. **Coriandoli** su tutto lo schermo
(disegnati nell'app, senza librerie) con un annuncio al centro e un "tic" del telefono (Android) ai traguardi personali:
piccola festa per gli obiettivi contatti e piani della settimana, grande festa (con due spari dai lati) per l'obiettivo VP
del mese, una nuova tappa del percorso, il primo cliente e il primo partner dalla lista. Solo nel momento in cui succede e
una volta sola per periodo (ricordato sul telefono). Con "riduci animazioni" attivo sul telefono non si muove niente
(l'annuncio del traguardo resta). Solo traguardi personali (decisione di Stefano).

**20 ottobre — il passaggio tra le schede "una sopra l'altra"** (scelta di Stefano dalla tavola di prova, al posto
dello scivolamento "Sobria"): andando avanti la pagina nuova scorre da destra sopra la vecchia, che si sposta un poco e si
scurisce; tornando indietro quella di sopra scivola via. Vale per le schede in alto, le sezioni di Persone e
l'apertura/chiusura di persone, clienti, inviti e partner, anche con il dito.

**21 ottobre**: nell'import dei clienti dal sito Amway, sopra "Nuovi clienti" e "Mai comprato" c'è **Seleziona tutti**
(mette o toglie tutte le spunte della sezione). In Io i **clienti da sentire** si tolgono con la × come le persone della
lista; tornano da soli con un ordine nuovo (a mano o importato) o con "Rimanda", oppure con **Rimetti in Io** dalla
scheda del cliente.

**21 ottobre — scheda partner**: sopra l'elenco delle linee c'è il titolo "Le sue linee frontali · VP di gruppo di ogni
linea, dal report Amway"; chi è nella mia struttura si apre toccando il nome (›). "Scarica il file" in Fissa una chiamata
resta com'è (per chi non usa Google Calendar; su iPhone il pulsante Calendario usa già il file).

**21 ottobre — Preferiti**: sotto le barre di ogni persona (che usa l'app) anche la riga "La sua lista" della scheda
partner (in lista, in corso, piani e sì del mese, clienti), solo numeri.

**21 ottobre — i "sì" divisi** (migrazione `029_si_divisi.sql`, applicata): nella riga "La sua lista" (scheda partner e
Preferiti) al posto di "N piani e N sì" ci sono "N piani, N partner e N clienti nuovi · N clienti in tutto". I clienti
aggiunti con "+ Un cliente" e quelli importati dal sito Amway restano contati tra i clienti nuovi (decisione di Stefano).

**21 ottobre — scendere lungo le linee**: nella scheda partner i VP delle linee frontali sono allineati a destra, con lo
stesso carattere dei nomi. Aprendo una linea da un'altra scheda, in alto ci sono **‹ Indietro** (la scheda di prima) e
**Il mio gruppo** (l'elenco); anche il dito verso destra torna alla scheda di prima, con il passaggio all'indietro.

**21 ottobre — "Solo Admin"**: sotto ogni pulsante che vedono solo gli admin c'è la scritta piccola **Solo Admin** (Scarica la
copia dei dati, Listino, Codici Amway tolti, Correggi il codice Amway, Nuovo link personale, Invita sotto / chi manca sopra,
Blocca/Sblocca l'app). "Togli dalla struttura" no: lo usano anche sponsor e upline.

**21 ottobre — Oggi con i nomi**: in Io → Oggi le attività contate da un passo della lista hanno il nome della persona
("Contatto: Nome", "Piano mostrato: Nome", e allo stesso modo "Nuovo cliente: Nome"); senza nome resta "Contatto".
Si vede solo nella propria pagina Io.

**Nota tecnica per Claude**: il connettore Supabase non applica le istruzioni con cancellazioni (`drop`, `delete`):
va in timeout. Si applicano a pezzi senza `drop` (oggetti nuovi) e il resto lo incolla Stefano nell'SQL Editor.

## Ripartire da qui (fermi la sera del 17 ottobre 2026)

**Fatto oggi**: rete dal report Amway (import sempre completo, nessuno cancella, ognuno nasconde chi vuole: migrazioni
015–018), inviti da admin, numeri ufficiali del report, controllo di sicurezza completo (`SICUREZZA.md`), storia di
GitHub ripulita dai dati reali, codice d'invito della radice rigenerato. Protezioni sugli accessi: **captcha Cloudflare
Turnstile** (nell'app e acceso in Supabase, provato sul telefono), limite 30 accessi anonimi/ora per rete, provider
Email spento in Supabase. Account Cloudflare di Stefano con verifica in due passaggi. Ultime PR unite: #44, #45, #46.

**Confermato da Stefano**: migrazione `018_niente_cancellazioni.sql` applicata; l'app funziona sul telefono con la
Content Security Policy e il captcha.

**18 ottobre**: Alessia non trovava "Aggiungi alla schermata Home" perché aveva aperto il link dentro Telegram.
Su iPhone la guida all'installazione ora riconosce Telegram, WhatsApp, Instagram e Facebook ("Sei dentro Telegram…
Apri in Safari"), dà i passi giusti anche in Chrome e, in Safari, ha la nota per chi è dentro un'altra app.

**18 ottobre — niente conferme** (migrazione `019_partenza_senza_conferma.sql`): decisione di Stefano, ognuno è
responsabile di dichiarare il giusto e i numeri veri arrivano dal report Amway. Tolti il riquadro "Da confermare",
il "!" nella struttura e "Conferma" nella scheda (resta "Punto di partenza dichiarato" come informazione);
`conferma_partenza` chiusa. Ognuno corregge il proprio dal fondo della pagina Io → "Modifica" (`modifica_partenza`).

**18 ottobre — nascondere una persona sola**: dopo l'import di Stefano con "Nascondi chi ha 0 VP" erano spariti
anche i gruppi attivi sotto i frontali a 0 VP (nessun dato perso: 170 importate, 134 nascoste). Ora chi è nascosto
sparisce da solo e chi sta sotto resta visibile. Poi, su richiesta di Stefano: al reimport la scelta **Lascia tutto
com'è** (di base, solo i VP) / **Riapplica i filtri a tutti** (anche chi hai nascosto a mano segue il filtro: poi lo si
rinasconde dall'elenco); struttura con **Mostra anche le nascoste** (albero completo, nascoste in grigio, Mostra /
Nascondi per riga); **Rivedi** = elenco Nascoste · Visibili con livello, sponsor e persone sotto, da cui si nasconde
anche chi è visibile.

**18 ottobre — bonus di performance tolto**: la scheda "Il tuo bonus di …" (PR #54) è stata tolta su richiesta di
Stefano ("non riempiamo le schermate"). Il calcolo (differenza di percentuale per linea, in VP, percentuale effettiva)
tornerà in una **sezione dedicata per analizzare e gestire la situazione di una persona**, da progettare. Il codice
di riferimento è nel commit "il bonus di performance in VP" della storia del repository.

**18 ottobre — Persone → Lista (fase 1 di "dal contatto al cliente")**. Il piano in breve:
Si integrano le mini app Target, Lista e Clienti in Growup, una fase per PR: prima la **Lista** (fatta), poi il
**Target** (porta d'ingresso per chi non conosci, a parte dalla Lista: "Metti in lista" / "Proponi come cliente";
testi del metodo in un riquadro "Il metodo" a richiesta), poi i **Clienti** (ordini, riordini, verifiche,
compleanni, messaggi). Decisioni: dati in Supabase visibili solo a chi li scrive; l'upline vede solo i numeri;
nuova scheda **Persone** (`Obiettivo | Io | Persone | Gruppo`); semplicità prima di tutto.
Fase 1 (migrazione `020_persone.sql`): tabelle `persone` e `passi`; percorso In lista → Contattato → Invitato →
Piano → Follow-up → Chiusura (Partner · Cliente · Non ora · No) con le voci di "Dalla Lista al Sì"; un passo
Contatto / Piano / Chiusura-Cliente **conta da solo** l'attività (trigger), togliendo il passo si toglie;
"Da fare con la tua lista" su Io (in ritardo, oggi, prossimi giorni, ferme da 2 settimane); nella scheda partner
"La sua lista: …" (solo numeri); "Scarica la mia lista" (l'importazione dalla vecchia app, usata solo in prova,
è stata tolta il 18 ottobre); Partner chiuso → "Mandagli il tuo link d'invito". Informativa aggiornata.

**18 ottobre — la Lista su Io** (migrazione `021_persone_io.sql`): su Io, "Il tuo percorso con la lista" mostra come
promemoria **tutte** le persone con cui è iniziato un percorso (da Contattato in poi; non chi è solo "In lista"; non le
chiuse, tranne "Non ora" con una data): prima in ritardo · oggi · prossimi giorni, poi "In corso" (le più avanti nel
percorso in cima). × toglie una persona da Io (colonna `nascosta_io`); torna da sola quando si segna un passo, si
fissa una data o si riapre il percorso, oppure dalla sua scheda con "Rimetti in Io".

**18 ottobre — Persone → Target (fase 2)** (migrazione `022_target.sql`): in Persone due sezioni, **Target · Lista**.
Il Target è per chi non conosci: "+ Nuovo invito" (nome, durata del link: 3 giorni … senza scadenza) → messaggio
WhatsApp con il link alle otto domande (pagina di Growup `#t&…`, senza accesso). Nel link il **numero WhatsApp del
partner** (chiesto nel "Nuovo invito", salvato solo sul suo telefono): "Invia su WhatsApp" del contatto apre
direttamente la sua chat (richiesta di Stefano, 18 ottobre); senza numero il contatto sceglie la chat. Il contatto non scrive nel database: rimanda il codice
`CL21-…` con il link "Apri le risposte" (`#r=…`, si legge appena il partner è dentro) o "Leggi una risposta".
Scheda dell'invito: esito (In target · Con riserve · Da coltivare · Fuori target), punteggio su 28, cosa cerca / cosa lo
trattiene, le risposte; **"Il metodo"** (cosa affrontare, promemoria per l'incontro, cosa dire se è no) si apre a
richiesta. "Metti in lista" → la persona entra in Lista già Contattato, con l'esito del Target nella sua scheda (senza
contare di nuovo il contatto). Blocca / riapri il link, archivia, elimina. Domande, punteggi e testi identici alla
mini app (versione 2026-09-14). La mini app Target resta online per i link già mandati; nessuna importazione.
Poi (023): dalla scheda di una persona della **Lista** "Manda le 8 domande (Target)" — l'invito nasce collegato a lei e
le risposte compaiono nella sua scheda; chi era solo "In lista" diventa **Contattato** (passo Contatto "Target", che conta
il contatto); se una persona arrivata dal Target si toglie dalla lista, l'invito resta e
torna "Metti in lista" (prima restava un "Apri nella lista" che non apriva niente).

**18 ottobre — Persone → Clienti (fase 3)** (migrazione `024_clienti.sql`, file `catalogo.js` con i 370 prodotti del
listino Amway): Persone ha tre sezioni **Target · Lista · Clienti**. Un cliente è una persona della Lista chiusa come
Cliente (una sola scheda); "+ Un cliente" lo crea direttamente (conta come nuovo cliente). Scheda cliente: stato (A posto ·
Sta finendo · Doveva riordinare · Fermo dopo 45 giorni · Mai ordinato · Da risentire · Non compra più), **+ Ordine** dal
catalogo (quantità, prezzo modificabile, quanto dura: 30 giorni di base, si cambia e vale per tutti i miei clienti),
"Dal sito" / "L'ho fatto io" (con Consegnato / Pagato), **Ripeti l'ultimo**, "Riordinato" sul singolo prodotto, ×
"non lo prende più", **Scrivigli** con i messaggi della mini app (Sta finendo · Come ti sei trovato · Auguri e
proposta) che si aprono nella chat WhatsApp del cliente, Rimanda (3 giorni … 1 mese), compleanno. Su Io "I tuoi clienti
da sentire" (sta finendo / in ritardo, come si è trovato 8 giorni dopo un prodotto nuovo, compleanno entro 7 giorni).
Gli ordini **non contano nei VP** (decisione di Stefano). All'upline il numero dei clienti nella scheda partner.
**19 ottobre — ordini dal sito Amway** (migrazione `025_ordini_amway.sql`): in Clienti "Ordini dal sito" carica l'export
"Ordini" del sito Amway (CSV: Nome "Cognome, Nome", Codice Cliente, Data ordine "18 agosto 2026", Numero ordine, VP, VV,
Tipo ordine; senza prodotti; parte sempre da settembre). Anteprima: già tra i clienti (per codice cliente, altrimenti per
nome), nuovi clienti con la spunta (entrano chiusi come Cliente alla data del primo ordine, senza contare oggi). Gli ordini
già importati (stesso numero) si saltano. Senza prodotti vale il **ritmo** (mediana degli intervalli tra gli ordini; con
un ordine solo 30 giorni): "di solito ordina ogni 40 giorni, prossimo atteso il …" e su Io quando è il momento.
"+ Aggiungi i prodotti" su un ordine importato (decisione di Stefano: i prodotti si possono sempre aggiungere a mano).
**19 ottobre — anche l'elenco dei clienti dal sito Amway** (migrazione `026_clienti_da_amway.sql`): il pulsante in
Clienti diventa "Dal sito Amway" e accetta l'export "Ordini", l'export "Clienti" o tutti e due insieme (li riconosce da
solo; si può rifare quante volte si vuole, niente doppioni). Dal file Clienti si tengono solo nome, codice cliente,
telefono (solo se manca, mai sovrascritto) e data dell'ultimo ordine: niente email, niente indirizzo. L'ultimo ordine
entra nello storico senza numero e si unisce all'ordine vero quando arriva l'export Ordini. Chi non ha mai comprato entra
nella **Lista con l'etichetta "Mai comprato"** (con la spunta, si sceglie chi); chi compare con due codici diventa una
persona sola. Nella scheda cliente: **Modifica** su ogni ordine (data, modo, prodotti, prezzi, nota, elimina; il numero
Amway resta), **Modifica i dati** (nome, telefono, come lo conosci, codice cliente, compleanno, note), le etichette
**Da consegnare / Da pagare** per gli ordini fatti dal partner non spuntati (in elenco Clienti e nella scheda; non su Io,
decisione di Stefano). Il report della rete resta un import separato.
**19 ottobre — "Scrivigli" con più prodotti**: il messaggio "Sta finendo" nomina tutti i prodotti che finiscono entro
i 7 giorni di preavviso (anche quelli già finiti), non solo il primo; se nessuno è così vicino, il primo che finisce
(decisione di Stefano).
**19 ottobre — pulsanti rapidi di Io**: **+ Contatto** apre l'inserimento di un nome (come "+ Un nome"): la persona entra
nella Lista già Contattato e il contatto conta nella settimana; se il nome è già nella lista il contatto si segna su di
lei. **+ Piano** chiede con chi (ricerca nella lista o un nome nuovo) e apre il passo Piano da compilare: conta nei piani
della settimana. Tutti e due restano su Io e hanno "Senza nome" per contare solo il numero. **+ Ordine** invariato.
In Clienti il primo filtro, selezionato all'apertura, è **Tutti**.
**19 ottobre — la scheda della persona nella Lista**: dopo il follow-up il passo proposto è la **Chiusura**. Nella
chiusura si vede solo quello che serve all'esito: **Partner** resta nella lista (con la prossima cosa e il link d'invito);
**Cliente** esce dalla Lista (anche dai Chiusi) e si apre la sua scheda nei Clienti; **Non ora** chiede tra quanto
risentirlo (1 mese · 3 mesi · 6 mesi · 1 anno o una data) e mette il promemoria 2 giorni prima, con la nota; **No** solo
la nota. Il passo **Nota** è solo una finestra per scrivere: la nota (con la data) va nelle Note dei dati della persona.
Il pulsante "Modifica i dati" in fondo non c'è più: i dati si modificano **toccando il nome** (✎). Lo stesso nella scheda del cliente.
**19 ottobre — conferma dal report e blocco dell'app** (migrazione `027_conferma_e_blocco.sql`): chi usa l'app è
**Da confermare** finché il suo codice Amway non compare in un report mappe importato (da lui, dal suo sponsor o da un
upline); chi prende il posto di una persona già importata è confermato subito. Decisione di Stefano: anche chi è già
nell'app riparte da confermare (gli admin no). Finché è da confermare, **sponsor, upline e admin** lo possono **togliere
dalla struttura**: si cancellano profilo e dati, il telefono vede "Accesso tolto", chi aveva invitato passa al suo
sponsor e il codice Amway non rientra finché un admin non lo sblocca ("Codici Amway tolti" in fondo alla pagina).
L'**admin blocca e sblocca l'app** di chiunque (non di sé né di un altro admin): il telefono vede "Accesso sospeso", i dati
restano e i VP contano; sponsor e upline vedono l'etichetta "Bloccato" (decisione di Stefano, per trasparenza).
**20 ottobre — il listino nel database** (migrazione `028_listino.sql`, file `listino.js` con la lettura del PDF): il listino
Amway è "per l'incaricato", quindi `catalogo.js` è tolto dal repository pubblico e i prodotti stanno nella tabella `listino`
(la leggono solo gli utenti dell'app; la scrive solo l'admin). Per ogni prodotto prezzo al cliente, prezzo Partner e VP
(decisione di Stefano); nell'ordine del cliente ogni riga li mostra e in fondo ci sono i totali (cliente · Partner · VP);
le righe li tengono. I VP del mese restano quelli dell'import delle mappe. In fondo alla pagina, solo admin, **Listino**:
cerca e correggi un prodotto, **+ Prodotto** (i nuovi, 5-6 volte l'anno), **Aggiorna dal PDF** (il "Listino prezzi per
l'incaricato": letto sul telefono con pdf.js, anteprima di nuovi, prezzi cambiati e usciti con la spunta; gli usciti non si
cancellano, diventano "non nel listino"). Provato sul PDF di aprile 2026: 348 prodotti su 348, con le varianti (colori,
gusti) e le descrizioni che vanno a capo.
**19 ottobre — ritocchi alla Lista e al Target**: con "+ Un nome" si resta nella lista (non si apre la scheda).
Il filtro **Aperti** non comprende più i "Non ora", che stanno solo in **Da riprendere**. La **Nota** compare anche tra i
passi della scheda (oltre che nelle Note dei dati). Nel **Target** l'invito si manda anche su **Telegram**, e il contatto
può rimandare le risposte anche su Telegram (sceglie lui la chat; su WhatsApp si apre direttamente quella del partner).

**Prima del lancio al gruppo** (Stefano sceglie da dove partire):
1. **Prova su iPhone con Alessia**: Claude prepara una lista di ~10 controlli (ingresso, installazione sulla Home,
   import, nascondi, scheda partner).
2. **Copia di sicurezza** dall'app (in fondo alla pagina) in una cartella privata di Google Drive.
3. **Gruppo pilota di 2-3 leader** per una settimana: rete grande, appena partito, poco pratico col telefono.
   Domanda aperta: chi coinvolgere.
4. **Messaggio per il gruppo** (lo scrive Claude): cos'è l'app, perché, tenere pronto il codice Amway.

**Da fare per Stefano (account)**: verifica in due passaggi su GitHub, Supabase e Google; su GitHub "Keep my email
addresses private" e "Block command line pushes that expose my email"; GitHub Support per togliere le vecchie
versioni delle PR chiuse (support.github.com → remove sensitive data / cached views).

## Fatto

**Fase 1 pubblicata** su https://cl21-aes.github.io/growup-team/ (PR CL21-AeS/CL21-AeS.github.io#1, unita a `main`).

- **Database**: progetto Supabase **Growup-Team** (`mxpuvmggexjyieylmfss`), organizzazione "CL21-AeS's Org",
  regione Central EU (Francoforte). Installati schema, RLS, 8 tappe e impostazioni; i controlli dei permessi
  (`supabase/tests_rls.sql`) sono passati sul progetto.
- **Profilo radice**: un solo profilo **"Stefano e Alessia"** (admin). Il codice d'invito non si scrive qui: il repository è pubblico.
  Il link personale è stato salvato da Stefano su WhatsApp (non è in nessun file: nel database c'è solo l'impronta).
- **Accesso anonimo** attivo in Supabase (Authentication → Sign In / Providers).
- `config.js` contiene URL e chiave publishable del progetto.
- Claude ha accesso al progetto tramite il connettore Supabase (MCP). Nota: le istruzioni SQL che contengono
  `delete` richiedono una conferma che dal connettore scade; quelle parti si lanciano dall'SQL Editor.

**Ritocchi dopo il primo collaudo (15 ottobre)**, migrazione `supabase/004_ritocchi.sql` già applicata al progetto:

- marchio **A&S** al posto di CumLaude21; "Due informazioni e iniziamo", pulsante "Inizia";
- tolte le opzioni prima/dopo il 1° giugno 2026: la data di iscrizione è obbligatoria solo per chi sceglie "Inizio";
  il Path to Bronze conta tutte le prime linee (vincolo di data tolto dal database);
- "Qualifica più alta raggiunta": Inizio, pin 3%…21% (campo `percentuale_iniziale`) e qualifiche Bronze/Argento;
  primo ordine e primi clienti non si dichiarano. Un pin senza Bronze fa partire dal Path to Bronze;
- "Entra con il tuo link personale" ora ha il ritorno all'invito;
- **La mia struttura**: albero della downline, **+ Aggiungi persona** (chi non usa l'app, posizione a scelta nella
  propria struttura, conferma del consenso) e **Manda il link** per farle prendere possesso del profilo
  (al primo ingresso accetta la privacy);
- l'iscrizione ora è la funzione `iscrivi_con_codice`; la vecchia `join_with_code` non è più richiamabile
  (si può eliminare dall'SQL Editor, vedi 004).
- Profili di prova nel database: "Prova uno" e "Prova due" (da cancellare a collaudo finito).

**Seconda tornata di ritocchi (15 ottobre)**, solo interfaccia:

- due pagine con selettore **Io / Gruppo** in alto a destra: "Io" = percorso, settimana, mese, oggi;
  "Gruppo" = La mia struttura + Invita un nuovo partner. Il menu ⋯ è sparito: link personale, privacy ed Esci
  stanno in fondo a ogni pagina;
- "Ancora nessuno nel tuo gruppo"; niente più "sotto di te": nell'aggiunta manuale si sceglie "Chi è il suo sponsor?";
- "Il mio mese": pulsanti **+ Ordine** e **Aggiorna il totale** (si scrive il totale VP del mese, per esempio
  dall'ufficio virtuale Amway; l'app registra la differenza come attività `rettifica`, anche negativa).
  Migrazione `supabase/005_totale_mese.sql` già applicata. In Fase 2 lo sponsor userà lo stesso meccanismo
  per i VP di chi non usa l'app.

**Fase 2 — piano approvato** (vedi `FASE2.md`). Profili di prova cancellati il 15 ottobre: nel database
c'è solo "Stefano e Alessia", senza attività.

**Fase 2, blocco 1 — calcoli e pagina Io** (migrazioni `006_fase2_calcoli.sql` e `006b_chiusura_pianificata.sql`
già applicate; attività pianificata `growup-chiusura-mese` attiva):

- soglie delle percentuali in `percent_levels` (3% = 200 … 21% = 10.000);
- `riepilogo_mese(mese)`: VP personali e di gruppo, linee attive, percentuale e qualifica di me e della mia downline;
- storico in `monthly_totals`, congelato da `chiudi_mese` il giorno 5 alle 23:30 UTC;
- il database accetta registrazioni solo nel mese in corso e, fino al giorno 5, nel precedente (`mese_chiuso`);
- pagina Io: requisiti veri di linee e VP di gruppo, "X% questo mese" separato dalla qualifica
  ("9% raggiunto · Bronze Foundation 9% non qualificato: …"), linee frontali con i loro VP,
  "Linee attive: 2 su 3. Manca 1 linea…" (era "Costruisci la terza linea", tolto il 16 ottobre), pagamenti Foundation/Builder contati dallo storico, Storico,
  "Aggiorna il totale" anche per il mese precedente fino al giorno 5.

**Fase 2, blocco 2 — struttura, partner senza app, conferme** (migrazione `007_fase2_gestiti.sql` già applicata):

- struttura: accanto a ogni nome VP del mese, VP di gruppo, linee attive e stato (attivo ≤ 7 giorni,
  rallenta ≤ 14, fermo oltre; "senza app" per i gestiti); "!" per i punti di partenza da confermare;
- scheda partner (si apre toccando un nome): numeri, linee frontali, punto di partenza;
  per chi è senza app + Contatto, + Piano, + Ordine, Aggiorna il totale, + Cliente, con "inserito da";
  per chi usa l'app, solo agli admin, "Nuovo link personale" (`nuova_chiave_per`);
- `posso_gestire`: su un partner gestito scrivono chi l'ha aggiunto e tutta la sua upline;
- riquadro "Da confermare" nella pagina Gruppo: il punto di partenza dichiarato si conferma o si corregge
  (`conferma_partenza`, da sponsor o upline; colonne `partenza_confermata_il/_da`). **Tolto il 18 ottobre** (019).

**Inserisci in mezzo** (migrazione `008_inserisci_in_mezzo.sql` già applicata): nella scheda partner
"Manca qualcuno sopra?" crea una persona senza app tra lo sponsor attuale e il partner (più eventuali "fratelli"
spuntati), che si spostano sotto di lei con tutto il loro gruppo. Lo fa chi sta sopra quel punto della linea.

**Cancellare e spostare** (`009_cancella_e_sposta.sql`: `cambia_sponsor` già applicata; `cancella_partner` da lanciare
dall'SQL Editor perché contiene un `delete`):

- "Cancella dalla struttura" nella scheda (sponsor e upline): per i codici che Amway non rinnova; chi stava nel gruppo
  della persona sale al suo sponsor; i dati della persona vengono cancellati con lei;
- "Cambia sponsor" nella scheda, solo admin: sposta una persona con tutto il suo gruppo (niente giri);
- "Manca qualcuno sopra?" più chiaro: la persona e il suo gruppo passano da soli; i "fratelli" si spuntano solo se serve.

**Fase 2, blocco 3 — imbuto ed elenco per urgenza** (migrazione `010_etichette.sql` già applicata), pagina Gruppo:

- **Imbuto del gruppo** (te escluso, ultime 4 settimane): contatti → piani → ordini, con obiettivo contatti del gruppo,
  % dei contatti che diventano piani, % dei piani che diventano ordini, VP. Il primo
  passaggio sotto soglia, evidenziato in giallo con il dato e la soglia (es. "Contatti: 75 su 240 di obiettivo del gruppo (31%), sotto la soglia
  del 50%"); dal 16 ottobre senza frasi su cosa allenare;
- **Situazione per persona** (era "Chi seguire adesso"): chi usa l'app, ordinato per urgenza, con un'etichetta e il perché
  (PR CL21-AeS/CL21-AeS.github.io#9 unita; poi il ritocco sotto):
  1. *Non aggiorna*: nessun aggiornamento da più di 7 giorni;
  2. *Contatti sotto soglia*: in 4 settimane meno della metà dei contatti dell'obiettivo;
  3. *Piani sotto soglia*: meno di 1 piano ogni 5 contatti;
  4. *VP sotto soglia*: almeno 2 piani ma meno della metà dei VP dell'obiettivo del mese;
  5. *In crescita*: tutto il resto.
  Le soglie si cambiano dal Table editor: `settings` → `soglie_etichette`. Toccando un nome si apre la scheda.
- **Ritocco della sera del 15 ottobre** (decisione di Stefano): chi è **senza app non ha etichetta** (i suoi numeri
  dipendono da quando lo sponsor li inserisce, quindi non sarebbe reale); sotto l'elenco una riga dice quante persone
  senza app ci sono. Restano nella struttura e i loro numeri contano nell'imbuto.
  Confermati: soglia dei piani 1 piano ogni 5 contatti (giusta per chi fa contatti a freddo), soglia misurata sui VP.
- **16 ottobre**: tolti i suggerimenti (vedi il principio); le etichette sono diventate descrizioni del dato
  (Non aggiorna, Contatti / Piani / VP sotto soglia, In crescita), "collo di bottiglia" è diventato "sotto soglia"
  e il riquadro "Chi seguire adesso" si chiama "Situazione per persona".
- I **test** ora stanno nel repository: `test/` (vedi `test/LEGGIMI.md`): 97 controlli dell'interfaccia
  e i controlli dei permessi del database.

## Decisioni prese con Stefano

- **Principio (16 ottobre 2026): l'app non dà suggerimenti.** Rende evidenti i dati, il percorso e le eventuali
  mancanze di quello che viene fatto; come muoversi lo decide ogni partner, da solo. Niente frasi del tipo "allenate…",
  "costruisci…", "lavorate su…", niente azioni suggerite: solo numeri, soglie e cosa manca.
  **Eccezione (21 ottobre)**: il riquadro «Come arrivarci», chiuso finché non lo si tocca, in Obiettivo e nella scheda
  partner. Resta valido tutto il resto: nessun consiglio in Io, Persone, Gruppo, Mese.

- **Niente email**: si entra dal link d'invito dello sponsor (`#CODICE`) e poi dal link personale (`#chiave=…`),
  che il partner si manda da solo su WhatsApp (chat con sé stesso) o Telegram (Messaggi salvati).
  Scelta confermata: niente custodia delle chiavi da parte dello sponsor (rispetta "nessuno modifica un partner attivo").
- **Stefano e Alessia**: un solo profilo e un solo codice per tutti e due.
- **Primi clienti**: valgono i primi 3 in totale, non nello stesso mese. Dopo, solo il conteggio dei nuovi clienti
  del mese, senza obiettivo.
- **Obiettivi**: contatti (10) e piani (3) a settimana; VP solo al mese (100, o di più se la tappa lo chiede).
- **Rimandati alla Fase 2**: inserire i numeri per conto di chi è aggiunto a mano; mostrare numeri (es. VP del mese)
  accanto ai nomi nella struttura.

## Prossimi passi (da qui si riparte)

1. **Copia di sicurezza e skill pubblicate** (PR #36 unita il 17 ottobre). Da fare per Stefano: **prima copia** dei
   dati dall'app e **installare la skill** `metodo-app-stefano` nell'account claude.ai.
   **Import dei VPP: PR #37 unita.** **Rete dal report Amway** (struttura flessibile, vedi la sezione qui sotto):
   PR da unire + migrazione 016 da incollare nell'SQL Editor; poi primo import con il CSV vero.
   Verifica con l'upline: ok per Stefano (l'import mostra gli stessi dati che ognuno vede già sul sito).
2. **Collaudo dal telefono della Fase 2** (pagina Io con i calcoli, struttura con i numeri,
   scheda partner, partner senza app, Da confermare, in mezzo / cancella / cambia sponsor, imbuto ed etichette),
   del confronto col mese prima, di "Fissa una chiamata" e dello storico del gruppo
   (provare il file .ics sia su iPhone sia su Android). **Sull'iPhone di Alessia, dall'icona sulla Home**:
   Fissa una chiamata → Calendario, e tutto il percorso d'installazione (copia link → Aggiungi alla Home →
   Incolla il link personale). Stefano usa Android + Google Calendar; Alessia iPhone.
3. **Blocco 4 della Fase 2** (ultimo, vedi `FASE2.md`):
   - (FATTO il 16 ottobre, da pubblicare/collaudare) scheda partner: riquadro **"Questo mese e il mese prima"**,
     confronto con i **suoi numeri del mese prima** (non con la media del gruppo: scelta di Stefano), fino a oggi /
     mese prima allo stesso giorno / mese prima totale; ▼ in rosso dove è sotto; niente azioni suggerite;
   - (FATTO il 16 ottobre, da pubblicare/collaudare) **"Fissa una chiamata"** nella scheda partner: giorno, ora
     (proposta domani alle 21), durata, promemoria, note → **Calendario** scarica un file .ics da aprire e aggiungere;
     **WhatsApp** apre un messaggio neutro già scritto ("Ciao Marco, ci sentiamo sabato 17 ottobre alle 21:00?")
     e si sceglie a chi mandarlo (l'app non conserva numeri di telefono né le chiamate fissate);
     **Ritocco del 16 ottobre** (Stefano: il file .ics chiedeva ogni volta di essere riscaricato):
     su **Android** "Calendario" apre **Google Calendar** (pagina web) con la chiamata già compilata: si tocca Salva.
     (Collaudo di Stefano: Chrome non permette a una pagina web di aprire la scelta dell'app di calendario;
     l'intent provato con la PR #16 finiva comunque su Google Calendar, ora ci si va direttamente.)
     Il promemoria è quello predefinito di Google Calendar; per altri calendari c'è "Scarica il file"
     (nome del file sempre diverso, così Chrome non chiede di riscaricarlo). Su **iPhone** il file si apre direttamente
     ("Aggiungi al calendario") senza scaricarlo. Sul computer resta il download. Da provare sui telefoni veri;
   - (FATTO il 16 ottobre, da pubblicare/collaudare) **Storico del gruppo** (scelta C): riquadro nella pagina Gruppo
     con gli ultimi 12 mesi chiusi e i propri totali (VP di gruppo, linee, %); toccando un mese si apre il dettaglio
     di ogni persona (VP personali, VP di gruppo, linee, %, qualifica) con ▼ in rosso dove è sotto il mese prima.
     Usa `riepilogo_mese`, nessuna migrazione. Il primo mese chiuso sarà ottobre, il 5 novembre.
   **Con questo la Fase 2 è completa**: resta il collaudo.
- **Cambia sponsor anche verso il proprio gruppo** (16 ottobre, migrazione `011_cambia_sponsor_nel_gruppo.sql`
  già applicata al progetto; solo admin): se il nuovo sponsor scelto sta nel gruppo della persona (errore di
  inserimento, es. Marco risulta sopra Luca ma è Luca lo sponsor di Marco), quella persona con il suo gruppo sale
  al posto di Marco sotto il suo sponsor, poi Marco passa sotto di lei. Nell'elenco è segnata "(nel suo gruppo)".
- **Nuova grafica: stile H · Smeraldo e rame** (16 ottobre, scelto da Stefano tra 10 proposte): testata smeraldo,
  accenti rame e ambra, fondo avorio, titoli e numeri in Cormorant Garamond, tema scuro verde bosco; pulsanti
  + Contatto / + Piano / + Ordine in smeraldo, rame e verde. Dettagli e **alternative tenute per il futuro
  (B + D, E)** in `design/GRAFICA.md`; tavola con tutte le prove in `design/tavola-grafica.html`.
  **Icona nuova: G Smeraldo** (G avorio con la stanghetta che diventa una freccia ambra che sale), `icon.svg`
  e PNG per Android, iPhone e browser. Per vederla sul telefono va reinstallata l'app.
- **Livelli nella struttura** (17 ottobre, richiesta di Stefano: con tante persone non si capiva chi è sotto chi):
  come nei report Amway, accanto al nome un cerchio con il **livello** (1 = diretti, 2 = i loro, …, colore diverso
  per livello), sotto il nome **"sponsor Nome"**, rientro più piccolo; pulsante **▾ N / ▸ N** per richiudere
  o riaprire il gruppo di una persona (N = quante persone ha nel gruppo).
- **Ricerca nella struttura** (17 ottobre): casella "Cerca un nome nel tuo gruppo…" sopra la struttura; filtra mentre
  si scrive (senza badare agli accenti), mostra le persone trovate in rame con la loro linea fino a te, trova anche
  dentro i gruppi richiusi; svuotandola torna tutto com'era. Durante la ricerca **▸ N** sulla persona trovata (o su
  chiunque della sua linea) apre i suoi frontali, e ognuno ha la sua freccia per scendere di un livello alla volta;
  ▾ N richiude.
- **Preferiti al posto dell'imbuto** (17 ottobre, decisione di Stefano: l'imbuto sommava gli obiettivi di tutta la rete,
  ma solo pochi lavorano attivamente, quindi non sarebbe mai stato realistico). Nella scheda partner la stella **☆/★**
  segna una persona come preferita (tabella `preferiti`, migrazione `012_preferiti.sql` già applicata; RLS: solo
  persone del proprio gruppo, ognuno vede solo i suoi). Nella pagina Gruppo la sezione **Preferiti** mostra per ognuno
  contatti e piani delle ultime 4 settimane rispetto al suo obiettivo × 4 e i VP del mese rispetto al suo obiettivo,
  con evidenziata la parte sotto soglia (stessa regola delle etichette; niente etichetta per chi è senza app).
  **"Situazione per persona" tolta** (17 ottobre, decisione di Stefano): si sovrapponeva ai preferiti e con un gruppo
  grande sarebbe diventata una lista lunghissima; chi è fermo si vede già nella struttura ("fermo").
- **Il primo obiettivo, terza pagina** (17 ottobre; migrazione `013_obiettivo.sql` già applicata). Decisioni di Stefano:
  cifra **al mese**; sponsor e upline vedono **cifra, data e tappa, non il perché**; "primi passi" = il percorso come dati;
  terza pagina. Selettore **Obiettivo | Io | Gruppo** (ordine voluto da Stefano) (a tutta larghezza sotto il titolo; il dito passa per le tre pagine).
  - Primo ingresso (dopo l'iscrizione, o dopo la privacy per chi è stato aggiunto): "Il tuo primo obiettivo" — quanto
    al mese, entro quando (mese), perché ("lo vedi solo tu"); "Lo scrivo dopo" per saltare.
  - Pagina Obiettivo: cifra, data, mesi che restano, perché, Modifica; **la tappa che vale la cifra** (prima tappa dal
    Path to Bronze in su con guadagno_mese ≥ cifra; oltre Argento → Argento "e oltre"); **il percorso** dalle tappe fatte
    (✓) alla tappa attuale (con i requisiti veri) fino a quella dell'obiettivo; in fondo la visione Argento.
  - Su Io il riquadro "Il mio obiettivo" sostituisce "La visione"; nella scheda partner e nei Preferiti la riga
    "Obiettivo: 360 €/mese entro giugno 2027 · tappa" (funzione `obiettivi_gruppo()`, senza il perché).
- **Struttura come nei report Amway** (17 ottobre): in cima chi usa l'app (livello **1**, con i suoi numeri e ▾ per
  richiudere tutto), i frontali sono **2**, i loro **3**, e così via; anche negli elenchi a scelta i frontali sono 2.
  Tolta la dicitura "sponsor …" dalle righe della struttura e "Sponsor: …" dalla scheda partner (resta negli elenchi a scelta).
- **Copia di sicurezza** (17 ottobre; migrazione `014_copia_dati.sql` già applicata): funzione `copia_dati()` solo per
  admin, pulsante **Scarica la copia dei dati** in fondo alle pagine (solo admin), file `growup-copia-AAAA-MM-GG.json`
  da tenere su Google Drive; procedura mensile e ripristino in `LEGGIMI.md`.
- **Campi numerici** (17 ottobre): si aprono vuoti con lo 0 grigio (o il valore attuale in grigio, es. obiettivi e
  totale del mese); se non si scrive niente vale quello grigio; dopo un errore il campo torna vuoto.
- **Trascinare il dito** (17 ottobre): verso sinistra da Io a Gruppo, verso destra da Gruppo a Io (e da una scheda
  al gruppo), con un breve scorrimento; non scatta nei campi, nei fogli aperti né nei movimenti verticali.
- **Elenchi a scelta dello sponsor** (Aggiungi persona, Cambia sponsor; 17 ottobre): al posto dei trattini il livello
  e, dal 2 in giù, lo sponsor: "3 · Marcella Peyron (sponsor Elisa)".
1. **Pubblicare i livelli nella struttura** (invito nuovo già unito con la PR #22), approvato da Stefano): anteprima del link su WhatsApp/Telegram (`anteprima.png` + meta
  og: in `index.html`, frase "La tua crescita, settimana dopo settimana."); testo d'invito con il nome di chi invita
  ("Siamo Stefano e Alessia: ti mandiamo…" / "Sono Marco: ti mando…") e i tre passi (entra, salva il link personale,
  installa l'app); nel riquadro "Invita un nuovo partner" i pulsanti **Immagine** (`invito-quadrato.png`) e
  **Per lo stato** (`invito-stato.png`) che aprono la condivisione del telefono. WhatsApp può tenere in memoria la
  vecchia anteprima di un link per qualche giorno.
- **Installare l'app** (16 ottobre, da collaudare soprattutto sull'iPhone di Alessia):
  - pagina Io, dopo "Salva il tuo link personale": riquadro **"Installa Growup sul telefono"**. Android: pulsante
    **Installa** (proposta di Chrome) o istruzioni dal menu ⋮; iPhone: **Copia il mio link** → Condividi →
    Aggiungi alla schermata Home → apri dall'icona e **Incolla il link personale**. "Non ora" lo nasconde;
    in fondo alla pagina resta "Installa l'app". Non compare se l'app è già installata o sul computer;
  - schermata d'ingresso: pulsante **Incolla il link personale** (legge il link copiato); nell'app installata
    spiega che la prima volta serve il link. Perché: su iPhone l'app sulla Home ha una memoria separata da Safari.
  - Ordine giusto per un nuovo partner su iPhone: prima entra dal link d'invito, poi installa.
4. **Prima del lancio a tutto il gruppo**: captcha (Cloudflare Turnstile) nell'app e acceso in Supabase, limite
   "anonymous sign-ins" a 30/ora, provider Email spento (fatto, 17 ottobre). Restano: prova su iPhone con Alessia,
   copia di sicurezza, gruppo pilota di 2-3 leader, messaggio per il gruppo.
5. Dopo la Fase 2: Fase 3 (presa in carico dopo 14 giorni, avvisi) e Fase 4 (diagnosi, serie di settimane, 90 giorni).

## La rete dal report Amway (17 ottobre: import dei VPP con la PR #37; struttura flessibile in questa PR)

Decisioni di Stefano:
- **Niente più inserimenti a mano**: tolti "+ Aggiungi persona", "Manca qualcuno sopra?", "Cambia sponsor" e
  "Manda il suo link personale". La rete rispecchia sempre quella di Amway.
- **Codice Amway obbligatorio** all'ingresso dal link d'invito. Codice già importato da qualcuno sopra → si entra nel
  proprio profilo (posizione e VPP); codice importato in un'altra linea → "chiedi il link al tuo sponsor"; codice di chi
  usa già l'app → "entra con il tuo link personale".
- **Chi usa l'app lo vede tutta la sua upline; le persone importate le vede solo chi le importa.** Così ognuno decide
  se importare tutta la rete (anche chi fa 0) o solo gli attivi.
- Chi usa l'app sta sempre sotto qualcuno che usa l'app: a ogni import va sotto il suo sponsor del report (o il primo
  antenato che usa l'app). Esempio di Stefano: chi è sponsorizzato da lui ma collegato in profondità entra con il suo
  link (sotto di lui) e al primo import va sotto lo sponsor vero.
- **VP di gruppo, linee, percentuale per chi guarda** (chi usa l'app + le proprie importate); storico congelato per chi
  guarda (`monthly_totals.visto_da`).
- Import: chi non è nell'app compare **non spuntato** (pulsanti Spunta chi ha VPP / tutti / Togli tutti, ricerca); chi
  resta senza spunta è **escluso** e non si ripropone ("Escluse · Rivedi"); agli import successivi solo i nuovi.
- **Nascondi dalla mia struttura** (chi usa l'app): solo per me, con il suo gruppo; **i VP contano lo stesso**.
- **Cancella dalla struttura** resta: le mie importate (cancellate ed escluse, anche "non fa più niente e non la voglio
  vedere"); chi usa l'app (per tutti, codici non rinnovati).
- Gli admin vedono come tutti (le importate degli altri solo nella copia di sicurezza).

Com'è fatto: migrazione `016_rete_da_amway.sql` (`vedo()`, `posso_gestire` = importate da me, `entra_con_invito`,
`diventa_attivo`, `importa_rete`, `calcola_mese(mese, radice, chi_guarda)`, tabelle `esclusi_import` e `nascosti`,
funzioni degli inserimenti a mano chiuse). **Da incollare nell'SQL Editor** (il connettore chiede una conferma che
scade, perché le funzioni contengono cancellazioni): subito prima o subito dopo l'unione della PR.
Formato del CSV Amway: UTF-8 con BOM, virgole; riga 1 avviso di riservatezza; riga 2 `"Mese di competenza","AAAAMM"`;
riga 3 le intestazioni; colonne usate "Qualifica Amway Partner" (= livello), "Codice Amway Partner Sponsor",
"Codice Amway Partner", "Nome", "VPP"; numeri "9.500,00" o "20996.38" con l'apostrofo davanti.

## Platino, inviti degli admin e numeri ufficiali (17 ottobre, dopo il primo import vero)

Decisioni di Stefano:
- **Gruppi dei Platino**: il report Amway non mostra chi sta sotto un Platino (per esempio una Platino del gruppo). Solo gli admin
  hanno nella scheda **Invita sotto questa persona** (link d'invito di quella persona, anche se importata) e
  **Invita chi manca sopra** (link speciale monouso: chi entra va tra lo sponsor e la persona, che passa sotto di lui).
- **Numeri ufficiali dal report per tutti gli importati** (e per sé): VPP, VPG, percentuale e i VPG delle linee frontali;
  pagina Io, struttura, scheda e storico usano questi; **la qualifica si calcola sulla struttura del report**.
  Prima un Platino aveva VPG 0 nell'app perché il suo gruppo non è nel report: ora mostra il VPG e la percentuale ufficiali.
- **Codice Amway**: nessuno lo modifica (viene dal report o dall'ingresso); solo gli admin lo **correggono** dalla scheda
  (errore di battitura all'ingresso); l'import lo segnala ("chiedi a Stefano e Alessia di correggerlo").
- Tolti dall'import gli abbinamenti per nome (servivano solo per le persone inserite a mano, cancellate da Stefano).
- Il pulsante di scelta rapida usato resta acceso (PR #39); ricerca per nome o codice anche tra le escluse (PR #40).
- **`ADMIN.md`**: elenco di tutto quello che può fare un admin e come si nomina un nuovo admin.

Com'è fatto: migrazione `017_inviti_e_numeri_report.sql` (tabelle `inviti_admin` e `numeri_report`, `struttura_visibile()`
"ricucita", `calcola_mese` sulla struttura ricucita, `qualifica_report`, `riepilogo_mese` con i numeri del report,
`crea_invito_sopra`, `imposta_codice_amway` solo admin). **Da incollare nell'SQL Editor** insieme all'unione della PR.

## Sicurezza (17 ottobre, sera)

- Controllo completo (`SICUREZZA.md`): RLS ovunque, nessun dato leggibile senza accesso, Content Security Policy
  nell'app, dati reali tolti dai file; **storia di GitHub riscritta** (nessun nome, codice, numero o email nei commit);
  **codice d'invito della radice rigenerato** (il vecchio era finito nella storia pubblica).
- Decisione di Stefano: **nessuno cancella niente** (migrazione `018_niente_cancellazioni.sql`, da incollare nell'SQL
  Editor): l'import è **sempre completo** (nell'anteprima si sceglie solo chi nascondere: *Nascondi chi ha 0 VP ·
  Nascondi tutti · Mostra tutti*); chi non è più nel report resta, segnato "non più nel report" e nascosto; ognuno
  nasconde chi vuole (anche le persone importate) e i VP contano sempre. Gli esclusi di prima diventano nascoste al
  primo import. Cancellazione solo per diritto all'oblio, dall'SQL Editor (`ADMIN.md`).
- **Captcha Cloudflare Turnstile** al primo ingresso di un telefono (account Cloudflare di Stefano, con verifica in
  due passaggi; Site Key in `config.js`, Secret Key solo in Supabase). Provider Email spento in Supabase.
- Captcha acceso anche in Supabase e provato sul telefono (17 ottobre).
- Restano da fare per Stefano: verifica in due passaggi (GitHub, Supabase, Google), email privata su GitHub.

## Proposte in sospeso (Stefano non ha ancora risposto)


## Domande aperte

- (Risolta: il link personale perso lo rigenerano solo Stefano e Alessia.)
- PIN di 4 cifre in più sul link personale? (Proposta: per ora no.)
