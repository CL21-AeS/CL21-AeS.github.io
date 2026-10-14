# Growup Team — come metterla in funzione (Fase 1)

Indirizzo dell'app: **https://cl21-aes.github.io/growup-team/**

Growup Team sostituisce `growup/` con login e database. In questa prima fase:

- entri con la tua email (link o codice di 6 cifre, senza password);
- un nuovo partner entra dal **link personale del suo sponsor** (mandato su WhatsApp o Telegram) e finisce sotto di lui;
- "La mia settimana": obiettivi di contatti, piani e VP, con **+ Contatto**, **+ Piano**, **+ Ordine** sempre in basso;
- il percorso base: visione Argento, tappa attuale, conto alla rovescia dei 30 giorni per il primo ordine;
- i dati sono sul database: li ritrovi da qualsiasi telefono o computer.

`growup/` resta com'è e continua a funzionare.

---

## 1. Creare il progetto Supabase (10 minuti)

1. Vai su <https://supabase.com>, crea un account e un **nuovo progetto**.
2. **Regione: Central EU (Frankfurt)** — i dati restano nell'Unione Europea.
3. Scegli una password del database e conservala (non serve all'app, serve a voi).

## 2. Creare le tabelle

Nel progetto: **SQL Editor → New query**. Incolla e lancia, **in quest'ordine**, il contenuto di:

1. `supabase/001_schema.sql` — tabelle e funzioni
2. `supabase/002_rls.sql` — le regole di sicurezza
3. `supabase/003_seed.sql` — requisiti delle tappe e guadagni. **Prima di lanciarlo**, in fondo al file
   sostituisci `EMAIL_DI_STEFANO@esempio.it` e `EMAIL_DI_ALESSIA@esempio.it` con le vostre email vere.
4. `supabase/tests_rls.sql` — controlla i permessi. Deve finire con **TUTTI I CONTROLLI SUPERATI**
   e non lascia dati di prova.

**Stefano e Alessia nell'albero.** Il seed vi crea entrambi come "radice", uno accanto all'altro: ognuno vede solo
chi ha sotto di sé. Se volete che Alessia stia sotto Stefano (così Stefano vede anche il gruppo di Alessia),
lanciate:

```sql
update public.partners
   set sponsor_id = (select id from public.partners where nome = 'Stefano')
 where nome = 'Alessia';
```

## 3. Email di accesso

L'email integrata di Supabase manda **pochissime email all'ora** ed è pensata solo per le prove: per il gruppo
serve un servizio di invio. Consiglio **Resend** (gratuito fino a 3.000 email al mese):

1. Crea un account su <https://resend.com>, aggiungi e verifica il dominio da cui spedire
   (per esempio `cumlaude21.it`: Resend ti dice quali record DNS aggiungere).
2. Crea una API key su Resend.
3. In Supabase: **Authentication → Emails → SMTP Settings → Enable custom SMTP**
   - Host `smtp.resend.com`, porta `465`, utente `resend`, password = la API key di Resend
   - Mittente: `growup@tuodominio.it`, nome mittente `Growup`

**Testo delle email.** In **Authentication → Emails → Templates**, sia in *Magic Link* sia in *Confirm signup*:

- Oggetto: `Il tuo codice Growup: {{ .Token }}`
- Corpo:

```html
<h2>Entra in Growup</h2>
<p>Il tuo codice è:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
<p>Scrivilo nell'app, oppure <a href="{{ .ConfirmationURL }}">tocca qui per entrare</a>.</p>
<p style="color:#888">Se non hai chiesto tu di entrare, ignora questa email.</p>
```

Il codice serve soprattutto su iPhone: se l'app è installata sulla schermata Home, il link si apre in Safari
e non nell'app; il codice invece si scrive direttamente nell'app.

## 4. Indirizzi consentiti

**Authentication → URL Configuration**:

- Site URL: `https://cl21-aes.github.io/growup-team/`
- Redirect URLs: aggiungi `https://cl21-aes.github.io/growup-team/`

## 5. Collegare l'app al progetto

In **Project Settings → API Keys** copia:

- l'**URL del progetto** (tipo `https://abcd1234.supabase.co`)
- la chiave **pubblica**: *publishable* (`sb_publishable_…`) oppure *anon*

e mettile in `growup-team/config.js` (oppure mandale a Claude Code e lo fa lui).

> ⚠️ **Mai** la chiave *secret* / *service_role*. Il repository è pubblico: nel codice può stare solo la
> chiave pubblica, che è sicura perché ogni tabella ha la Row Level Security attiva.
> GitHub Pages non ha "impostazioni segrete": tutto ciò che il browser usa è visibile, ed è giusto così.

## 6. Collaudo (criterio della Fase 1)

1. Stefano apre `https://cl21-aes.github.io/growup-team/` dal telefono, mette la sua email, scrive il codice:
   entra direttamente (il profilo esiste già dal seed).
2. Nel riquadro **Invita un nuovo partner** manda il link su WhatsApp o Telegram a un secondo account di prova.
3. Il secondo account apre il link, mette la sua email, il codice, completa "Due cose e sei dentro".
4. Registra un contatto: **un tocco** su *+ Contatto*.
5. Apre l'app da un altro dispositivo (o dal computer) con la stessa email: ritrova il contatto e gli obiettivi.
6. In Supabase → **Table editor → partners** il nuovo partner ha come `sponsor_id` quello di Stefano.

## Amministrazione

- **Requisiti delle tappe e guadagni**: tabella `stage_requirements` (Table editor). Cambiate i numeri lì:
  l'app li legge a ogni apertura. Le cifre vengono dal *Simulatore di reddito ufficiale Amway*.
- **Impostazioni**: tabella `settings` (obiettivi proposti, soglia della linea attiva, fonte e avviso dei guadagni).
- **Cancellare un partner** (diritto all'oblio): Table editor → `partners` → elimina la riga; le sue attività e i suoi
  obiettivi spariscono con lui. Se ha persone sotto, prima spostatele sotto un altro sponsor.

## Com'è fatta

| File | Cosa contiene |
|---|---|
| `index.html` | la pagina e lo stile (stessi colori e componenti di `growup/`) |
| `app.js` | tutta la logica: login, ingresso, settimana, percorso |
| `config.js` | indirizzo e chiave pubblica di Supabase |
| `manifest.webmanifest`, `sw.js`, `icon-*.png` | installazione sulla schermata Home |
| `supabase/` | tabelle, sicurezza, dati iniziali, controlli |

Unica dipendenza esterna: la libreria ufficiale `@supabase/supabase-js` 2.117.2 da jsDelivr, con controllo di integrità.

## Prossime fasi

- **Fase 2 — Visione upline**: Il mio gruppo, Scheda partner, Struttura; VP di gruppo e linee attive calcolati
  dall'albero; conferma dello sponsor sul punto di partenza.
- **Fase 3 — Partner gestiti e presa in carico**: inserimento per conto terzi, soglia dei 14 giorni, inviti a
  prendere possesso del profilo (stesso meccanismo WhatsApp/Telegram), email di avviso.
- **Fase 4 — Diagnosi e rifinitura**: punto debole automatico, azioni suggerite, serie di settimane, 90 giorni.
