-- ============================================================
-- Growup Team — 005: "Aggiorna il totale del mese" (15 ottobre 2026)
-- Nuovo tipo di attività "rettifica": la differenza tra il totale VP del mese scritto
-- dal partner (o, in Fase 2, dal suo sponsor) e la somma degli ordini registrati.
-- Può essere negativa (un ordine reso, un totale corretto al ribasso).
-- Per un'installazione da zero non serve: 001 contiene già tutto.
-- ============================================================

alter table public.activities drop constraint activities_tipo_check;
alter table public.activities drop constraint activities_vp_check;
alter table public.activities drop constraint activities_check;

alter table public.activities add constraint activities_tipo_check
  check (tipo in ('contatto', 'piano', 'ordine', 'cliente', 'rettifica'));
alter table public.activities add constraint activities_vp_check check (
  (tipo = 'ordine' and vp is not null and vp > 0 and vp <= 100000) or
  (tipo = 'rettifica' and vp is not null and vp <> 0 and vp between -100000 and 100000) or
  (tipo not in ('ordine', 'rettifica') and vp is null));
