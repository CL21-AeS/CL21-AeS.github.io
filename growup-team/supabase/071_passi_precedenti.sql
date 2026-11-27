-- ============================================================
-- Growup Team — 071: i passi precedenti si spuntano da soli (27 novembre 2026, richiesta di Stefano)
-- Estende la regola della 070 (chiusura come Partner) a invito, piano e follow-up, con lo stesso trigger e lo stesso
-- collegamento (passi.segnato_con): una regola sola, non due.
-- * Quando si inserisce un passo non importato (e non a sua volta automatico), il database aggiunge i passi precedenti che
--   mancano, ciascuno SOLO se la persona non ha già almeno un passo di quel tipo (importati compresi):
--     invito → contatto;   piano → contatto, invito;   follow-up → contatto, invito, piano;
--     chiusura con esito Partner → contatto, invito, piano (come nella 070).
--   Il follow-up non si aggiunge mai. Le chiusure Cliente, No, Non ora e Chiuso senza risposta non aggiungono niente.
-- * Stessa data del passo che li crea, creati un istante prima (1, 2, 3 millesimi) e in ordine: contatto, invito, piano.
--   Segnati come automatici e collegati al passo che li ha creati (passi.segnato_con, la colonna della 070).
-- * Contatto e piano automatici contano l'attività come quelli segnati a mano (passi_prima, 020/070); l'invito no.
-- * Cancellando il passo che li ha creati si cancellano anche quelli automatici (on delete cascade, 070) con le loro attività
--   (passi_dopo, 020). «Riapri il percorso» non li toglie.
-- * Vale per tutte le strade dell'app («Segna un passo», «Com'è andata?», le scorciatoie come + Piano) perché lo fa il
--   database. Nessun dato cambiato: niente passi aggiunti all'indietro a quelli già segnati.
-- Solo «create or replace» di funzioni e un trigger al posto di quello della 070 (stessa funzione, allargata): nessuna
-- colonna nuova, RLS invariata (i passi automatici hanno il proprietario della persona). Per tornare a com'era:
-- 071_passi_precedenti_togli.sql (rimette la regola della 070, solo la chiusura come Partner).
-- ============================================================

comment on column public.passi.segnato_con is
  '070/071: passo aggiunto in automatico (id del passo che l''ha creato: invito, piano, follow-up o chiusura come Partner); vuoto per i passi segnati a mano';

-- ---- I passi precedenti che mancano (al posto di passi_chiusura_partner della 070) ----
create or replace function public.passi_precedenti()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prima text[];
  n int;
  k int := 0;
  t text;
begin
  prima := case when new.tipo = 'invito' then array['contatto']
                when new.tipo = 'piano' then array['contatto', 'invito']
                when new.tipo = 'followup' or (new.tipo = 'chiusura' and new.esito = 'partner') then array['contatto', 'invito', 'piano']
           end;
  if prima is null then return null; end if;
  n := array_length(prima, 1);
  -- un passo alla volta per persona: niente doppioni se due arrivano insieme
  perform 1 from public.persone where id = new.persona_id for update;
  foreach t in array prima loop
    k := k + 1;
    if not exists (select 1 from public.passi s where s.persona_id = new.persona_id and s.tipo = t) then
      insert into public.passi (persona_id, tipo, data, segnato_con, creato_il)
      values (new.persona_id, t, new.data, new.id, new.creato_il - make_interval(secs => (n + 1 - k) / 1000.0));
    end if;
  end loop;
  return null;
end;
$$;
drop trigger if exists passi_chiusura_partner on public.passi;
drop trigger if exists passi_precedenti on public.passi;
create trigger passi_precedenti after insert on public.passi
for each row when (not new.importato and new.segnato_con is null
                   and (new.tipo in ('invito', 'piano', 'followup') or (new.tipo = 'chiusura' and new.esito = 'partner')))
execute function public.passi_precedenti();
drop function if exists public.passi_chiusura_partner();

revoke execute on function public.passi_precedenti() from public, anon, authenticated;
