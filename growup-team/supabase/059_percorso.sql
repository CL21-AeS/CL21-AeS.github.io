-- ============================================================
-- Growup Team — 059: il percorso di partenza dei nuovi (4 novembre 2026, consegna 7 del piano «nuova Io»)
-- Decisioni di Stefano: chi entra nell'app da nuovo (iscritto da 30 giorni o meno) segue il percorso in 5 fasi
-- (Il mio perché, Partenza con lo sponsor, Il primo ordine, I due binari, Via!) finché non lo finisce, anche oltre i
-- 30 giorni. Le fasi si spuntano dai dati che ci sono già; qui si aggiungono solo il giorno del primo incontro con lo
-- sponsor e quando la partenza è completata (la festa si vede una volta sola; nella consegna 8 lo vede lo sponsor).
-- Li scrive solo il partner stesso (policy partners_modifico_me: solo la propria riga); sponsor e upline li leggono.
-- Solo colonne nuove: nessuna tabella nuova, nessun drop, nessun dato toccato.
-- ============================================================

alter table public.partners add column if not exists incontro_sponsor date
  check (incontro_sponsor is null or incontro_sponsor between date '2020-01-01' and date '2100-01-01');
alter table public.partners add column if not exists partenza_completata_il timestamptz;
grant select (incontro_sponsor, partenza_completata_il), update (incontro_sponsor, partenza_completata_il) on public.partners to authenticated;
