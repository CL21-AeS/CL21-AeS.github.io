# Growup Team — a che punto siamo

Ultimo aggiornamento: 21 ottobre 2026. Da leggere all'inizio di ogni nuova sessione con Claude Code.
Il metodo e la tecnica usati (da riusare per altre app) sono in `METODO.md`.

## Ripartire da qui (fermi la sera del 21 ottobre 2026)

**Dove siamo**: Target, Lista e Clienti sono dentro Growup (pagina Persone), con conferma dal report Amway, blocco
dell'app da admin e listino Amway nel database. Migrazioni applicate su Supabase fino alla **033** (027 e la parte 2 della 033 — `togli_dalla_struttura` e `importa_mappa` —
incollate da Stefano nell'SQL Editor; 028b: permesso sul codice del listino). PR unite fino alla **#97**, nessuna aperta; il ramo di
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

**Aperto, in attesa di Stefano**:
- Confrontare nel report mappe la colonna **"VP Rubino"** con il VPG: se sono diversi, il Volume Rubino si prende da lì.
- Controllare sul sito Amway che la **%** delle linee frontali nei report importati sia quella giusta (serve a «Come arrivarci»
  da Argento a Platino).
- Indicare il proprio mese della prima qualifica Argento e importare i report dei mesi passati (riquadro «Report da importare»).
- **Copie di sicurezza**: vedi la voce del 21 ottobre più sotto (la copia dall'app non contiene Liste e Clienti).

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
