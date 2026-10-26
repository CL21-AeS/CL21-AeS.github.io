-- Growup Team — 038: il mese da Argento con la linea al 21% (27 ottobre 2026).
-- Regola di Stefano: un mese conta come mese da Argento solo se, al 21%,
--   * nessuna linea frontale è al 21% (10.000 VP di gruppo propri), oppure
--   * due o più linee frontali sono al 21%, oppure
--   * una linea frontale è al 21% e i VP di gruppo rimanenti (VP di gruppo meno i VP di quella linea) sono almeno 4.000.
-- Altrimenti il mese è solo «21%». La percentuale di ogni linea viene dai numeri ufficiali del suo report (come
-- nell'Analisi, 037); se non c'è, la linea non conta come linea al 21%.
-- Solo "create or replace" di una funzione nuova: nessuna tabella, nessun drop, nessuna cancellazione.

create or replace function public.mesi_qualifica(p_partner uuid)
returns table (mese date, percentuale int, vpg numeric, argento boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.my_partner_id() is null or not public.vedo(p_partner) then
    raise exception 'non_autorizzato';
  end if;
  return query
    select n.mese, n.percentuale, n.vpg,
           coalesce(n.percentuale, 0) >= 21
             and (l.al21 = 0 or l.al21 >= 2 or coalesce(n.vpg, 0) - l.vp21 >= 4000)
      from public.numeri_mese n
      cross join lateral (
        select count(*)::int as al21, coalesce(sum((x->>'vpg')::numeric), 0) as vp21
          from jsonb_array_elements(case when jsonb_typeof(n.linee) = 'array' then n.linee else '[]'::jsonb end) x
         where (select nl.percentuale from public.numeri_mese nl
                  join public.partners q on q.id = nl.partner_id
                 where q.codice_amway = x->>'codice' and nl.mese = n.mese limit 1) >= 21
      ) l
     where n.partner_id = p_partner
       and n.mese >= (date_trunc('month', (now() at time zone 'Europe/Rome')::date) - interval '13 months')::date
     order by n.mese;
end;
$$;

revoke execute on function public.mesi_qualifica(uuid) from public, anon, authenticated;
grant execute on function public.mesi_qualifica(uuid) to authenticated;
