-- ============================================================
-- Growup Team — per TOGLIERE la 071 (i passi precedenti si spuntano da soli) e tornare alla regola della 070 (solo la
-- chiusura come Partner segna contatto, invito e piano che mancano). Si incolla nell'SQL Editor di Supabase.
-- I passi già aggiunti in automatico da invito, piano e follow-up RESTANO, con le loro attività, collegati al passo che li
-- ha creati (cancellandolo spariscono ancora insieme a lui, come per la 070).
-- ============================================================
drop trigger if exists passi_precedenti on public.passi;
drop function if exists public.passi_precedenti();

create or replace function public.passi_chiusura_partner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t text;
  k int := 0;
begin
  -- una chiusura alla volta per persona: niente doppioni se due arrivano insieme
  perform 1 from public.persone where id = new.persona_id for update;
  foreach t in array array['contatto', 'invito', 'piano'] loop
    k := k + 1;
    if not exists (select 1 from public.passi s where s.persona_id = new.persona_id and s.tipo = t) then
      insert into public.passi (persona_id, tipo, data, segnato_con, creato_il)
      values (new.persona_id, t, new.data, new.id, new.creato_il - make_interval(secs => (4 - k) / 1000.0));
    end if;
  end loop;
  return null;
end;
$$;
drop trigger if exists passi_chiusura_partner on public.passi;
create trigger passi_chiusura_partner after insert on public.passi
for each row when (new.tipo = 'chiusura' and new.esito = 'partner' and not new.importato)
execute function public.passi_chiusura_partner();
revoke execute on function public.passi_chiusura_partner() from public, anon, authenticated;

comment on column public.passi.segnato_con is
  '070: passo aggiunto in automatico dalla chiusura come Partner (id della chiusura); vuoto per i passi segnati a mano';
