-- ============================================================
-- Growup Team — 061: «Chiuso senza risposta» (4 novembre 2026, «Da riprendere»)
-- Decisioni di Stefano: un contatto avviato fermo da 14 giorni va in «Da riprendere» (lo calcola l'app dai passi).
-- Dalla scheda si può chiudere con un esito nuovo, «Chiuso senza risposta», separato dai «No» veri (non conta tra i
-- no). I promemoria («Ricordamelo tra 30 giorni», «Te lo ricordo tra 6 mesi») usano l'agenda che c'è già (057).
-- Qui solo il valore nuovo dell'esito, su persone e passi. Nessun drop di tabelle, nessun dato toccato.
-- ============================================================

alter table public.persone drop constraint if exists persone_esito_check;
alter table public.persone add constraint persone_esito_check
  check (esito in ('partner', 'cliente', 'non_ora', 'no', 'senza_risposta'));

alter table public.passi drop constraint if exists passi_esito_check;
alter table public.passi add constraint passi_esito_check
  check (esito in ('partner', 'cliente', 'non_ora', 'no', 'senza_risposta'));
