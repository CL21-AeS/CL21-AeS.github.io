-- ============================================================
-- Growup Team — 069b: il pianificatore delle notifiche ogni 5 minuti invece che ogni 15 (solo su Supabase, come 039b)
-- Serve agli avvisi degli appuntamenti della 069: ogni avviso parte una volta sola, mai prima dell'orario scelto e al
-- massimo 5 minuti dopo. Cambia solo la frequenza del lavoro «growup-notifiche» creato dalla 039b (stesso comando, stesso
-- segreto in Vault). Da applicare DOPO la 069.
-- Per tornare a ogni 15 minuti: la stessa istruzione con '*/15 * * * *'.
-- ============================================================
select cron.alter_job(jobid, schedule := '*/5 * * * *') from cron.job where jobname = 'growup-notifiche';
