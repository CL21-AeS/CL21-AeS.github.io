# Growup Team — a che punto siamo

Ultimo aggiornamento: 14 ottobre 2026. Da leggere all'inizio di ogni nuova sessione con Claude Code.

## Fatto

**Fase 1 pubblicata** su https://cl21-aes.github.io/growup-team/ (PR CL21-AeS/CL21-AeS.github.io#1, unita a `main`).

- **Database**: progetto Supabase **Growup-Team** (`mxpuvmggexjyieylmfss`), organizzazione "CL21-AeS's Org",
  regione Central EU (Francoforte). Installati schema, RLS, 8 tappe e impostazioni; i controlli dei permessi
  (`supabase/tests_rls.sql`) sono passati sul progetto.
- **Profilo radice**: un solo profilo **"Stefano e Alessia"** (admin), codice d'invito **ABCDEF**.
  Il link personale è stato salvato da Stefano su WhatsApp (non è in nessun file: nel database c'è solo l'impronta).
- **Accesso anonimo** attivo in Supabase (Authentication → Sign In / Providers).
- `config.js` contiene URL e chiave publishable del progetto.
- Claude ha accesso al progetto tramite il connettore Supabase (MCP). Nota: le istruzioni SQL che contengono
  `delete` richiedono una conferma che dal connettore scade; quelle parti si lanciano dall'SQL Editor.

## Decisioni prese con Stefano

- **Niente email**: si entra dal link d'invito dello sponsor (`#CODICE`) e poi dal link personale (`#chiave=…`),
  che il partner si manda da solo su WhatsApp (chat con sé stesso) o Telegram (Messaggi salvati).
  Scelta confermata: niente custodia delle chiavi da parte dello sponsor (rispetta "nessuno modifica un partner attivo").
- **Stefano e Alessia**: un solo profilo e un solo codice per tutti e due.
- **Primi clienti**: valgono i primi 3 in totale, non nello stesso mese. Dopo, solo il conteggio dei nuovi clienti
  del mese, senza obiettivo.
- **Obiettivi**: contatti (10) e piani (3) a settimana; VP solo al mese (100, o di più se la tappa lo chiede).

## Prossimi passi

1. **Collaudo Fase 1 dal telefono** (criterio del brief), con due account:
   - Stefano e Alessia entrano con il link personale dai loro telefoni.
   - Un secondo telefono entra da `https://cl21-aes.github.io/growup-team/#ABCDEF`, compila l'ingresso,
     salva il suo link personale, registra un contatto con un tocco e lo ritrova da un altro dispositivo.
   - In Supabase → Table editor → partners il nuovo partner ha `sponsor_id` = "Stefano e Alessia".
2. Raccogliere e sistemare quello che emerge dal collaudo.
3. **Piano tecnico della Fase 2** (visione upline: Il mio gruppo, Scheda partner, Struttura; VP di gruppo e linee
   attive calcolati dall'albero; conferma dello sponsor sul punto di partenza; rigenerare il link a un partner che
   l'ha perso direttamente dall'app). Da far approvare prima di scrivere codice.
4. Prima del lancio a tutto il gruppo: captcha (Cloudflare Turnstile) sugli accessi anonimi e limite
   "anonymous sign-ins" più alto in Authentication → Rate Limits.

## Domande aperte

- Chi può rigenerare il link personale di un partner che l'ha perso: solo Stefano e Alessia, o anche il suo sponsor?
- PIN di 4 cifre in più sul link personale? (Proposta: per ora no.)
