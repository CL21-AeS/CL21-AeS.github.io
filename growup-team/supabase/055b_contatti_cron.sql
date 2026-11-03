-- ============================================================
-- Growup Team — 055b: attività pianificata della cancellazione dei contatti dopo 24 mesi (solo su Supabase)
-- Ogni notte alle 02:30 UTC (03:30 o 04:30 in Italia) cancella i contatti fermi da 24 mesi
-- (public.pulisci_contatti_scaduti, migrazione 055). Si applica solo dopo l'ok di Stefano.
-- ============================================================

create extension if not exists pg_cron;

select cron.schedule(
  'growup-contatti-24-mesi',
  '30 2 * * *',
  $$select public.pulisci_contatti_scaduti()$$
);
