-- ============================================================
-- Growup Team — 050b: attività pianificata della pulizia di chi è fuori dalla mappa da 12 mesi (solo su Supabase)
-- Ogni notte alle 02:15 UTC (03:15 o 04:15 in Italia) cancella con tutti i dati chi non compare in nessuna mappa da
-- 12 mesi (public.pulisci_fuori_mappa, migrazione 050).
-- ============================================================

create extension if not exists pg_cron;

select cron.schedule(
  'growup-pulizia-fuori-mappa',
  '15 2 * * *',
  $$select public.pulisci_fuori_mappa()$$
);
