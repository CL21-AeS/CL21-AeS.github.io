-- ============================================================
-- Growup Team — per TOGLIERE la 070 (la chiusura come Partner segna contatto, invito e piano) e tornare a com'era prima.
-- Si incolla nell'SQL Editor di Supabase. Toglie il trigger e la sua funzione, rimette passi_prima com'era (020) e toglie
-- la colonna passi.segnato_con. I passi già aggiunti in automatico RESTANO (con le loro attività) come passi normali:
-- solo non sono più collegati alla chiusura (cancellandola non spariscono più insieme a lei).
-- ============================================================
drop trigger if exists passi_chiusura_partner on public.passi;
drop function if exists public.passi_chiusura_partner();

create or replace function public.passi_prima()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pr uuid;
  t  text;
begin
  select proprietario into pr from public.persone where id = new.persona_id;
  if pr is null or (auth.uid() is not null and pr is distinct from public.my_partner_id()) then
    raise exception 'non_autorizzato';
  end if;
  new.proprietario := pr;
  new.creato_il := clock_timestamp();  -- l'ordine dei passi dello stesso giorno
  -- il passo conta l'attività del giorno (mai per i passi importati)
  t := case new.tipo when 'contatto' then 'contatto' when 'piano' then 'piano'
         when 'chiusura' then case when new.esito = 'cliente' then 'cliente' end end;
  new.attivita_id := null;
  if t is not null and not new.importato then
    insert into public.activities (partner_id, tipo, data) values (pr, t, new.data) returning id into new.attivita_id;
  end if;
  return new;
end;
$$;
revoke execute on function public.passi_prima() from public, anon, authenticated;

drop index if exists public.passi_segnato_con_idx;
alter table public.passi drop column if exists segnato_con;
