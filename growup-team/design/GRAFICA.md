# Growup Team — grafica

**Stile in uso: H · Smeraldo e rame** (scelto da Stefano il 16 ottobre 2026).
Testata verde smeraldo con sfumatura e angoli in basso arrotondati, accenti rame e ambra, fondo avorio,
titoli e numeri in Cormorant Garamond (cifre allineate), testo in Manrope. Tema scuro: verde bosco con dettagli rame.
I colori stanno tutti nelle variabili su `:root` di `index.html` (chiaro) e nei due blocchi del tema scuro.

| Ruolo | Chiaro | Scuro |
|---|---|---|
| fondo / card | `#f6f3ec` / `#ffffff` | `#07130e` / `#0f1f18` |
| testata | sfumatura `#0a3a2c` → `#13604a` | `#04100b` → `#0b2c21` |
| accento (pulsanti principali) | smeraldo `#0a3a2c` | ambra `#e2a46f` |
| barre di avanzamento | rame `#c26a3d` → `#d98b4f` | `#e08a5a` → `#f0a76f` |
| sotto-linguetta scelta (Il mio giorno/Guida, Target/Lista/Clienti) | bianca `#ffffff`, testo `#10231c` | avorio `#f7f0e3`, testo `#0a3a2c` |
| + Contatto / + Piano / + Ordine | `#0a3a2c` / `#c26a3d` / `#13795b` | `#13604a` / `#b8602f` / `#1f8a68` |
| stato: ok · sotto soglia · ▼ | `#13795b` · `#9a6a00` · `#b42318` | `#34c08f` · `#e2b45a` · `#ff7b6b` |

## Colori con significato fisso (28 ottobre 2026, grafica punto 2)

| Significato | Variabili | Chiaro | Scuro |
|---|---|---|---|
| selezione e azione principale (pulsanti principali, scelte, i tre pulsanti in basso) | `--scelta` / `--scelta-ink` | pesca `#e2a46f` / `#0a3a2c` | `#e2a46f` / `#07130e` |
| fatto e progresso (barre, puntini, tappa attuale, Primi passi) | `--progresso` → `--progresso2` | `#13795b` → `#1f9a73` | `#2fae82` → `#4fd1a3` |
| solo attenzione | `--giallo`, `--rame` | come sopra | come sopra |
| etichette di sezione | `--ink2` | `#4f5f58` | `#a7b8ae` |

I tre pulsanti in basso sono tutti pesca (scelta A di Stefano), con un'icona ciascuno: persona, calendario, carrello.
`--accent` resta per link e testi evidenziati (smeraldo nel chiaro, pesca nello scuro).

## Profondità nella struttura (grafica punto 3)

Il numero nel cerchietto è il livello visto da chi guarda (1 = tu). Livello 1: bianco, solo per chi guarda (bordo
sottile nel tema chiaro, numero scuro). Dal 2 un ciclo di 5 colori, uguale nei due temi: blu `#396cc4`, viola `#7f59c0`,
petrolio `#19788b`, rosa `#b83d8b`, nocciola `#87684c`; dal 7 si riparte. Niente verde, ambra, rosso né grigio
(grigio = chi non ha l'app). Numero bianco a 5,1:1; cerchio sul fondo scuro a 3,3:1.

## Numeri e tabella Stabilità (grafica punto 4)

I numeri sono nel carattere del testo (Manrope) con cifre allineate (`tabular-nums`); Cormorant resta per titoli e
«perché». La Stabilità riproduce la tabella «Verifica la tua attività - Stabilità» di Cum Laude 21: sette caselle per riga
(una per livello): piena verde con ✓ (`--stab-ok`) dove la rete sostiene il livello, piena ambra con ! (`--stab-att`) per
i livelli già raggiunti con il fatturato ma non sostenuti, neutra sopra (con una piccola ✓ se il numero c'è già); la
colonna del livello raggiunto ha il contorno pesca (`--scelta`). Segni e colori insieme: si legge anche senza i colori.
Il mese di riferimento sta in una pillola pesca chiara. Niente barre: i numeri non sono un traguardo verso la percentuale.

## Filtri e titoli di sezione (grafica punto 5)

I filtri (`.filtri`) stanno su una riga sola che scorre di lato da bordo a bordo della scheda, senza barra di scorrimento.
Nei titoli di sezione (`.testa-sezione`) i pulsanti non vanno mai a capo: se non c'è posto scendono sotto, a destra.

## Icona

**G Smeraldo** (scelta da Stefano il 16 ottobre 2026): fondo sfumato smeraldo, G avorio la cui stanghetta diventa
una freccia ambra che sale. Disegno in `icon.svg`; da lì le PNG `icon-512.png`, `icon-192.png` (Android, anche
ritagliate a cerchio: il disegno sta nell'area sicura), `apple-touch-icon.png` (180, iPhone), `favicon-32.png`.
Per rifarle: aprire `icon.svg` in un browser e salvarne una cattura alle misure indicate.

## Immagini dell'invito

`anteprima.png` (1200×630, anteprima del link), `invito-quadrato.png` (1080×1080), `invito-stato.png` (1080×1920):
fondo smeraldo, icona, "A&S · Growup Team", "La tua crescita, settimana dopo settimana." in Cormorant avorio e ambra.
Sorgente: la pagina di prova dell'invito (SVG), resa in PNG.

## Alternative da tenere per il futuro (scelta di Stefano)

Sono nella tavola `design/tavola-grafica.html` (apribile nel browser, con chiaro/scuro), insieme alle altre provate.
Lì ci sono i valori completi; per passare a una di queste basta riportare i suoi colori nelle variabili di `index.html`.

- **B + D · Notte e oro con un colore per area** — testata blu notte `#0f172a` con scritte oro `#f5c84c`,
  fondo avorio `#fbf8f1`, titoli Fraunces + testo Manrope; un colore per area: settimana `#2f5bd3`,
  mese `#0f9f74`, percorso oro `#b8860b`, gruppo `#be185d`; pulsanti in basso nei tre colori.
- **E · Oceano di vetro** — fondo sfumato azzurro/lilla/rosa (`#dbeafe` → `#ede9fe` → `#fce7f3`), card
  semitrasparenti con sfocatura, testata integrata con titolo grande, carattere Sora; indaco `#4f46e5`,
  ciano `#06b6d4`, acqua `#0e9488`, rosa `#db2777`; pulsanti a pillola. Scuro: blu oceano `#0b1033` → `#2b0b31`.

Provate e scartate: A · Aurora, B · Notte e oro, C · Mediterraneo, D · Percorso a colori, F · Pop a blocchi,
G · Prugna e pesca, I · Anelli, J · Tessere.
