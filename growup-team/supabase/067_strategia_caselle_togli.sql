-- ============================================================
-- Growup Team — per TOGLIERE la 067 (le caselle della strategia) e tornare a com'era prima.
-- Si incolla nell'SQL Editor di Supabase. Cancella anche le caselle salvate dai partner (non si recuperano).
-- Tocca solo quello che ha creato la 067: nessuna tabella o funzione di prima.
-- ============================================================
drop table if exists public.strategia_caselle;   -- con la tabella se ne vanno anche il trigger, la policy e gli indici
drop function if exists public.strategia_caselle_date();
drop function if exists public.strategia_caselle_max();
