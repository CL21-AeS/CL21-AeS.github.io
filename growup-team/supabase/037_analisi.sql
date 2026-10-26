-- Growup Team — 037: l'Analisi della persona e un solo interruttore per condividere (27 ottobre 2026).
-- Decisioni di Stefano (tavola «Analisi della persona» v3):
-- * l'Analisi si apre di sé e di chi è nel proprio gruppo; usa i numeri dei report dell'anno fiscale (da settembre):
--   per ogni linea solo percentuale e volume VP, mese per mese, senza calcoli; e la Stabilità Cum Laude 21 mese per mese
--   (i miei nuovi iscritti, i nuovi nel gruppo, i codici oltre 200 VP);
-- * un solo interruttore «Condividi i tuoi dati con il tuo sponsor e la tua upline» (colonna `condividi` di `seguimi`,
--   ora indipendente dal Seguimi): acceso, l'upline vede anche i numeri del Seguimi, i numeri scritti a mano (app
--   CumLaude21, Training Day, Convention) e le abitudini; mai i nomi, mai i VP degli ordini scritti a mano.
-- Solo "create or replace": nessuna tabella nuova, nessun drop, nessuna cancellazione.

/* l'inizio dell'anno fiscale (1° settembre) di un mese */
create or replace function public.inizio_py(p_mese date)
returns date
language sql
immutable
as $$
  select make_date(extract(year from p_mese)::int - case when extract(month from p_mese) >= 9 then 0 else 1 end, 9, 1)
$$;

/* L'analisi di una persona che vedo (o di me): un rigo per mese dell'anno fiscale con i numeri ufficiali, le linee
   (nome, VP di gruppo e percentuale della linea) e i conteggi della Stabilità. */
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
            and p.in_mappa_dal >= x.m::timestamp at time zone 'Europe/Rome'
            and p.in_mappa_dal < (x.m + interval '1 month')::timestamp at time zone 'Europe/Rome'),
         (select count(*)::int from public.numeri_mese q join giu on giu.id = q.partner_id where q.mese = x.m and q.vpp > 200)
    from mesi x
    left join public.numeri_mese n on n.partner_id = p_partner and n.mese = x.m
   order by x.m;
end;
$$;

/* i dati che un partner ha scelto di condividere con sponsor e upline: numeri scritti a mano e abitudini (mai nomi) */
create or replace function public.dati_condivisi(p_partner uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  io uuid := public.my_partner_id();
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  if p_partner = io or not public.vedo(p_partner)
     or not exists (select 1 from public.seguimi s where s.partner_id = p_partner and s.condividi) then
    return null;
  end if;
  return jsonb_build_object(
    'cl21', (select jsonb_build_object('app_cl21', c.app_cl21, 'training_day', c.training_day, 'convention', c.convention)
               from public.numeri_cl21 c where c.partner_id = p_partner),
    'obiettivi', coalesce((select jsonb_agg(jsonb_build_object('chiave', o.chiave, 'a_settimana', o.a_settimana))
                            from public.guida_obiettivi o where o.partner_id = p_partner), '[]'::jsonb),
    'fatti', coalesce((select jsonb_agg(jsonb_build_object('chiave', f.chiave, 'giorno', f.giorno) order by f.giorno)
                        from public.guida_fatti f where f.partner_id = p_partner
                         and f.giorno > (now() at time zone 'Europe/Rome')::date - 56), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.inizio_py(date), public.analisi_persona(uuid), public.dati_condivisi(uuid) from public, anon, authenticated;
grant execute on function public.inizio_py(date), public.analisi_persona(uuid), public.dati_condivisi(uuid) to authenticated;
