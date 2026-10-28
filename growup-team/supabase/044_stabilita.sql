-- ============================================================
-- Growup Team — 044: i riferimenti della tabella «Verifica la tua attività - Stabilità» di Cum Laude 21 (28 ottobre 2026).
-- Sono i numeri che servono per SOSTENERE nel tempo la percentuale raggiunta con il fatturato (non per raggiungerla).
-- Stanno nelle impostazioni: se Cum Laude 21 li cambia si aggiornano dal Table editor (tabella settings, chiave
-- stabilita_cl21), senza toccare il codice. «livelli» sono le colonne; ogni riga ha una soglia per colonna.
-- Le chiavi delle righe dicono all'app da dove prende il numero: nuovi_gruppo e oltre_200 dalle mappe importate,
-- app_cl21, training_day e convention li scrive il partner.
-- ============================================================

insert into public.settings (chiave, valore, nota) values
  ('stabilita_cl21',
   '{"livelli": [3, 6, 9, 12, 15, 18, 21],
     "righe": [
       {"k": "nuovi_gruppo", "nome": "Nuovi iscritti nel gruppo del mese", "soglie": [1, 3, 5, 8, 10, 15, 20]},
       {"k": "oltre_200",    "nome": "Codici che fatturano più di 200 VP", "soglie": [1, 3, 5, 10, 17, 30, 42]},
       {"k": "app_cl21",     "nome": "Codici iscritti all''app CumLaude21", "soglie": [1, 2, 3, 7, 12, 21, 30]},
       {"k": "training_day", "nome": "Codici al Training Day",             "soglie": [1, 3, 5, 10, 17, 30, 42]},
       {"k": "convention",   "nome": "Codici alla Convention",             "soglie": [1, 2, 3, 7, 12, 21, 30]}]}',
   'Tabella «Verifica la tua attività - Stabilità» di Cum Laude 21: per ogni livello (colonne) i numeri che sostengono la qualifica')
on conflict (chiave) do update set valore = excluded.valore, nota = excluded.nota;
