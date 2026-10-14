-- ============================================================
-- Growup Team — dati iniziali (Fase 1)
-- Requisiti delle tappe e guadagni come da brief (ottobre 2026).
-- Si aggiornano poi dal Table editor: stage_requirements e settings.
-- ============================================================

insert into public.stage_requirements
  (ordine, chiave, nome, percentuale, vp_personali, vp_gruppo, linee, vp_linea, linee_obiettivo,
   clienti, giorni_scadenza, linee_nuove_dal, pagamenti_max, mesi_finestra,
   guadagno_mese, struttura_calcolo, descrizione)
values
  (1, 'primo_ordine',  'Primo ordine',            null,  50, null, null, null, null,
   null, 30, null, null, null,
   null, null, 'Almeno 50 VP personali entro 30 giorni dall''iscrizione, per non pagare i 40 € di iscrizione'),
  (2, 'primi_clienti', 'Primi clienti',           null,   0, null, null, null, null,
   3, null, null, null, null,
   null, null, 'I primi 3 clienti, in totale e non nello stesso mese: chi si iscrive il 29 non ha il tempo di farli in due giorni'),
  (3, 'path_to_bronze','Path to Bronze',          null, 100, null, 3, 100, null,
   null, null, date '2026-06-01', null, null,
   150, '100 VP personali + 3 linee da 100 VP', '3 nuove prime linee da almeno 100 VP ciascuna, più 100 VP personali'),
  (4, 'foundation_9',  'Bronze Foundation 9%',      9, 100, 1200, 3, 200, null,
   null, null, null, 12, 18,
   360, '100 VP personali + 3 linee da 400 VP', '1.200 VP di gruppo, 3 linee frontali da almeno 200 VP, 100 VP personali'),
  (5, 'foundation_12', 'Bronze Foundation 12%',    12, 100, 2400, 3, 200, null,
   null, null, null, 12, 18,
   580, '100 VP personali + 3 linee da 800 VP', '2.400 VP di gruppo, 3 linee frontali da almeno 200 VP, 100 VP personali'),
  (6, 'builder_15',    'Bronze Builder 15%',       15, 200, 4000, 3, 600, null,
   null, null, null, 12, 18,
   1050, '200 VP personali + 3 linee da 1.300 VP', '4.000 VP di gruppo, 3 linee frontali da almeno 600 VP, 200 VP personali'),
  (7, 'builder_18',    'Bronze Builder 18%',       18, 200, 7000, 3, 600, null,
   null, null, null, 12, 18,
   1980, '200 VP personali + 3 linee da 2.600 VP', '7.000 VP di gruppo, 3 linee frontali da almeno 600 VP, 200 VP personali'),
  (8, 'argento',       'Argento 21%',              21,   0, 10000, 2, null, 3,
   null, null, null, null, null,
   3750, '200 VP personali + 3 linee da 4.100 VP', '10.000 VP di gruppo nel mese, su almeno 2 linee (obiettivo CL21: 3 linee attive)');

insert into public.settings (chiave, valore, nota) values
  ('soglia_linea_attiva',     '100',
   'VP di gruppo nel mese perché una linea frontale conti come attiva'),
  ('giorni_presa_in_carico',  '14',
   'Giorni senza aggiornamenti dopo cui compare "Prendi in carico" (Fase 3)'),
  ('obiettivi_proposti',      '{"contatti": 10, "piani": 3, "vp_mese": 100}',
   'Proposti a chi non ne ha ancora scelti: contatti e piani a settimana, VP al mese (se la tappa ne chiede di più, si propone quella)'),
  ('fonte_guadagni',          '"Simulatore di reddito ufficiale Amway, ottobre 2026"',
   'Citata accanto a ogni cifra'),
  ('avviso_guadagni',         '"Cifre indicative: i risultati dipendono dall''impegno di ciascuno e non sono garantiti."',
   'Mostrato sotto ogni cifra');

-- ------------------------------------------------------------
-- LA RADICE: Stefano e Alessia, un solo profilo e un solo codice d'invito.
-- Questo blocco stampa due link:
--   link_personale  → la vostra chiave: apritelo su entrambi i telefoni e tenetelo
--                     per voi (per esempio nei "Messaggi salvati" di Telegram)
--   link_invito     → da mandare ai vostri partner diretti
-- La chiave si vede SOLO adesso: nel database resta solo la sua impronta.
-- Se la perdete: select public.nuova_chiave_per(id) from public.partners where is_admin;
-- ------------------------------------------------------------
with nuova as (
  select public.nuova_chiave_segreta() as k
), radice as (
  insert into public.partners (nome, is_admin, stato, chiave_hash)
  select 'Stefano e Alessia', true, 'gestito', public.impronta(k) from nuova
  returning codice_invito
)
select 'https://cl21-aes.github.io/growup-team/#chiave=' || nuova.k as link_personale,
       'https://cl21-aes.github.io/growup-team/#' || radice.codice_invito as link_invito
from nuova, radice;
