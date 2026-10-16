-- ============================================================
-- Growup Team — 011: cambiare sponsor anche verso qualcuno del proprio gruppo
-- Caso: per errore Marco risulta sopra Luca, ma è Luca lo sponsor di Marco.
-- "Metti Marco sotto Luca": Luca (con il suo gruppo) sale al posto di Marco, sotto lo sponsor
-- di Marco; poi Marco (con il resto del suo gruppo) passa sotto Luca. Niente giri.
-- Resta solo per Stefano e Alessia (admin). Sostituisce la funzione di 009.
-- ============================================================

create or replace function public.cambia_sponsor(p_partner uuid, p_sponsor uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  p          public.partners;
  vecchio    uuid;
begin
  if not public.sono_admin() then
    raise exception 'non_autorizzato';
  end if;
  select sponsor_id into vecchio from public.partners where id = p_partner;
  if p_partner = p_sponsor
     or not exists (select 1 from public.partners where id = p_sponsor)
     or vecchio is null then
    raise exception 'posizione_non_valida';
  end if;
  -- il nuovo sponsor sta nel gruppo della persona che sposto: prima sale lui al suo posto
  if exists (
    with recursive su(id, sponsor_id, livello) as (
      select x.id, x.sponsor_id, 0 from public.partners x where x.id = p_sponsor
      union all
      select x.id, x.sponsor_id, su.livello + 1 from public.partners x join su on x.id = su.sponsor_id
      where su.livello < 200
    )
    select 1 from su where su.id = p_partner
  ) then
    update public.partners set sponsor_id = vecchio where id = p_sponsor;
  end if;

  update public.partners set sponsor_id = p_sponsor where id = p_partner returning * into p;
  return to_jsonb(p) - 'chiave_hash';
end;
$$;

revoke execute on function public.cambia_sponsor(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cambia_sponsor(uuid, uuid) to authenticated;
