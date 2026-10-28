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
