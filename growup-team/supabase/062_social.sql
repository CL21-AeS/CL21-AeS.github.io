-- ============================================================
-- Growup Team — 062: il campo «Social» delle persone (9 novembre 2026)
-- Decisioni di Stefano: nella scheda di un nome (Lista e clienti) il telefono e il social stanno in due campi separati:
-- «Telefono» resta nella colonna contatto (i valori già salvati restano dove sono), il social (es. @nome su Instagram)
-- va nella colonna nuova social, facoltativa, al massimo 80 caratteri.
-- Nessuna policy nuova: vale persone_mie (solo chi ha scritto la persona la legge e la modifica). Il social non entra in
-- nessuna funzione che l'upline può leggere (numeri_persone conta soltanto; copia_dati non contiene le persone).
-- Solo una colonna nuova: nessuna tabella nuova, nessun drop, nessun dato toccato.
-- ============================================================

alter table public.persone add column if not exists social text check (length(social) <= 80);
grant insert (social), update (social) on public.persone to authenticated;
