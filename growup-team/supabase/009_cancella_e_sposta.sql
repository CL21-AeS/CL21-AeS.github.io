-- ============================================================
-- Growup Team — 009: cancellare una persona e cambiare sponsor
--   - cancella_partner: per i codici che Amway cancella a fine anno (o una richiesta di
--     cancellazione dei dati). Lo fanno lo sponsor e tutta l'upline. Chi stava sotto la
--     persona cancellata sale al suo sponsor, con tutto il suo gruppo; i dati della persona
--     (attività, obiettivi, storico, telefoni collegati) vengono cancellati con lei.
--   - cambia_sponsor: sposta una persona (con tutto il suo gruppo) sotto un altro sponsor.
--     Solo Stefano e Alessia (admin).
-- ============================================================

create or replace function public.cancella_partner(p_partner uuid)
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  io    uuid := public.my_partner_id();
  t     public.partners;
  saliti int;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  select * into t from public.partners where id = p_partner;
  if not found then
    raise exception 'partner_inesistente';
  end if;
  if t.sponsor_id is null or t.id = io or not public.is_in_downline(t.id) then
    raise exception 'non_autorizzato';
  end if;

  -- chi stava sotto sale al suo sponsor
  update public.partners set sponsor_id = t.sponsor_id where sponsor_id = t.id;
  get diagnostics saliti = row_count;
  -- i riferimenti alla persona cancellata passano a chi cancella o si svuotano
  update public.partners set gestore_id = io where gestore_id = t.id;
  update public.partners set creato_da = null where creato_da = t.id;

  delete from public.partners where id = t.id;
  return saliti;
end;
$$;

create or replace function public.cambia_sponsor(p_partner uuid, p_sponsor uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  p public.partners;
begin
  if not public.sono_admin() then
    raise exception 'non_autorizzato';
  end if;
  if p_partner = p_sponsor
     or not exists (select 1 from public.partners where id = p_sponsor)
     or (select sponsor_id from public.partners where id = p_partner) is null then
    raise exception 'posizione_non_valida';
  end if;
  -- il nuovo sponsor non può stare nel gruppo della persona che sposto
  if exists (
    with recursive su(id, sponsor_id, livello) as (
      select x.id, x.sponsor_id, 0 from public.partners x where x.id = p_sponsor
      union all
      select x.id, x.sponsor_id, su.livello + 1 from public.partners x join su on x.id = su.sponsor_id
      where su.livello < 200
    )
    select 1 from su where su.id = p_partner
  ) then
    raise exception 'posizione_non_valida';
  end if;

  update public.partners set sponsor_id = p_sponsor where id = p_partner returning * into p;
  return to_jsonb(p) - 'chiave_hash';
end;
$$;

revoke execute on function public.cancella_partner(uuid), public.cambia_sponsor(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cancella_partner(uuid), public.cambia_sponsor(uuid, uuid) to authenticated;
