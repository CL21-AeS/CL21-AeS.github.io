-- ============================================================
-- Growup Team — 056: i nuovi iscritti del mese dalla data di ingresso della mappa (4 novembre 2026, scelta di Stefano)
-- Nella tabella Stabilità (Verifica) e nell'Analisi, «Nuovi iscritti nel gruppo» di un mese sono le persone del mio
-- gruppo che hanno iniziato in quel mese solare secondo la «Data di ingresso» delle mappe importate (044b: la mappa fa
-- fede e sostituisce la data scritta all'ingresso). Ognuno conta una volta sola, anche se nel mese si importa più volte,
-- e conta anche chi è arrivato con il primo import. Prima si contava chi compariva per la prima volta in una mappa
-- (in_mappa_dal), così il primo import non portava nuovi e chi era già entrato restava fuori.
-- Conta solo chi è in almeno una mappa importata: chi è entrato con un link e non è ancora nella mappa no.
-- «I tuoi nuovi iscritti» (entrati con il mio link, invitato_il) non cambia. Solo "create or replace": nessun drop.
-- ============================================================

create or replace function public.guida_conteggi(p_mese date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  io uuid := public.my_partner_id();
  m  date := date_trunc('month', p_mese)::date;
  f  timestamptz;
  t  timestamptz;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  f := m::timestamp at time zone 'Europe/Rome';
  t := (m + interval '1 month')::timestamp at time zone 'Europe/Rome';
  return jsonb_build_object(
    'personali', (select count(*) from public.partners p where p.invitato_da = io and p.invitato_il >= f and p.invitato_il < t),
    'nuovi_gruppo', (select count(*) from public.partners p
                      where p.data_iscrizione >= m and p.data_iscrizione < (m + interval '1 month')::date
                        and p.id <> io and public.vedo(p.id)
                        and exists (select 1 from public.numeri_mese n where n.partner_id = p.id)),
    'oltre_200', (select count(*) from public.numeri_mese n where n.mese = m and n.vpp > 200 and public.vedo(n.partner_id)),
    'con_mappa', exists (select 1 from public.numeri_mese n where n.mese = m and public.vedo(n.partner_id))
  );
end;
$$;
revoke execute on function public.guida_conteggi(date) from public, anon, authenticated;
grant execute on function public.guida_conteggi(date) to authenticated;

/* L'analisi di una persona che vedo (o di me): come in 037, con i nuovi nel gruppo dalla data di ingresso della mappa */
create or replace function public.analisi_persona(p_partner uuid)
returns table (mese date, vpp numeric, vpg numeric, percentuale int, linee jsonb,
               personali int, nuovi_gruppo int, oltre_200 int)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  io  uuid := public.my_partner_id();
  ora date := date_trunc('month', (now() at time zone 'Europe/Rome')::date)::date;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  if not public.vedo(p_partner) then
    raise exception 'non_autorizzato';
  end if;
  return query
  with recursive giu(id) as (
    select p_partner
    union all
    select p.id from public.partners p join giu on p.sponsor_id = giu.id
  ),
  mesi(m) as (
    select generate_series(public.inizio_py(ora), ora, interval '1 month')::date
  )
  select x.m, n.vpp, n.vpg, n.percentuale,
         coalesce((select jsonb_agg(jsonb_build_object(
                     'codice', l->>'codice',
                     'nome', (select q.nome from public.partners q where q.codice_amway = l->>'codice' limit 1),
                     'vpg', (l->>'vpg')::numeric,
                     'percentuale', (select nl.percentuale from public.numeri_mese nl
                                      join public.partners q on q.id = nl.partner_id
                                     where q.codice_amway = l->>'codice' and nl.mese = x.m limit 1)))
                     from jsonb_array_elements(case when n.linee is null then '[]'::jsonb else n.linee end) l), '[]'::jsonb),
         (select count(*)::int from public.partners p where p.invitato_da = p_partner
            and p.invitato_il >= x.m::timestamp at time zone 'Europe/Rome'
            and p.invitato_il < (x.m + interval '1 month')::timestamp at time zone 'Europe/Rome'),
         (select count(*)::int from public.partners p join giu on giu.id = p.id where p.id <> p_partner
            and p.data_iscrizione >= x.m and p.data_iscrizione < (x.m + interval '1 month')::date
            and exists (select 1 from public.numeri_mese q where q.partner_id = p.id)),
         (select count(*)::int from public.numeri_mese q join giu on giu.id = q.partner_id where q.mese = x.m and q.vpp > 200)
    from mesi x
    left join public.numeri_mese n on n.partner_id = p_partner and n.mese = x.m
   order by x.m;
end;
$$;
revoke execute on function public.analisi_persona(uuid) from public, anon, authenticated;
grant execute on function public.analisi_persona(uuid) to authenticated;
