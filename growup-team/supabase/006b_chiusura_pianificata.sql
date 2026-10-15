-- ============================================================
-- Growup Team — 006b: attività pianificata della chiusura del mese (solo su Supabase)
-- Ogni giorno 5 alle 23:30 UTC (00:30 o 01:30 del 6 in Italia) congela il mese precedente.
-- Fino a fine giorno 5 il mese precedente resta correggibile, come deciso da Stefano.
-- ============================================================

create extension if not exists pg_cron;

select cron.schedule(
  'growup-chiusura-mese',
  '30 23 5 * *',
  $$select public.chiudi_mese((date_trunc('month', now() at time zone 'Europe/Rome') - interval '1 month')::date)$$
);
