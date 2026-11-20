-- ============================================================
-- Growup Team — 068: il Path to Bronze conta solo le linee nuove (20 novembre 2026, scelta di Stefano)
-- Per il Path to Bronze contano solo le linee frontali iscritte dal 1° giugno 2026 (data di ingresso della mappa), con
-- almeno i VP di linea della tappa (100). Le linee più vecchie non contano mai, anche se fatturano.
-- Cambia SOLO un valore che c'era già: stage_requirements.linee_nuove_dal della riga path_to_bronze (era vuoto dalla 004).
-- Nessuna tabella, colonna o funzione cambia. L'app legge il valore all'apertura.
-- Per rimetterlo vuoto (tutte le linee contano, come prima): 068_linee_nuove_dal_togli.sql.
-- ============================================================

update public.stage_requirements
   set linee_nuove_dal = date '2026-06-01'
 where chiave = 'path_to_bronze';
