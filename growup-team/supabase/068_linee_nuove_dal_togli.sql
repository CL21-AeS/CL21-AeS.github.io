-- ============================================================
-- Growup Team — per TOGLIERE la 068 e tornare a com'era prima: il Path to Bronze conta di nuovo tutte le linee frontali.
-- Si incolla nell'SQL Editor di Supabase. Rimette vuoto il valore linee_nuove_dal della riga path_to_bronze (come dalla 004).
-- Non cancella nessun dato.
-- ============================================================
update public.stage_requirements
   set linee_nuove_dal = null
 where chiave = 'path_to_bronze';
