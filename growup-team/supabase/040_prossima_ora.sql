-- Growup Team — 040: le notifiche, parte 2: l'ora del prossimo passo e l'avviso 30 minuti prima (28 ottobre 2026).
-- Decisioni di Stefano (tavola «Notifiche di Growup»): quando si segna il prossimo passo con una persona o un cliente si
-- può scrivere anche l'ora (facoltativa); con l'ora la notifica arriva 30 minuti prima, senza nomi («Hai un passo da fare
-- con una persona della tua Lista» / «con un tuo cliente»), e il tocco apre la sua scheda (l'indirizzo ha solo l'id).
-- Senza ora la persona resta nel riepilogo delle 8:30. Solo una colonna nuova e "create or replace".

alter table public.persone add column if not exists prossima_ora time;
grant insert (prossima_ora), update (prossima_ora) on public.persone to authenticated;

create or replace function public.notifiche_da_inviare(p_ora timestamptz default now())
returns table (telefono_id uuid, partner_id uuid, chiave text, endpoint text, p256dh text, auth text,
               titolo text, corpo text, url text)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  locale    timestamp := p_ora at time zone 'Europe/Rome';
  oggi      date := locale::date;
  chiusura  int := coalesce((select (valore #>> '{}')::int from public.settings where chiave = 'chiusura_mese_giorno'), 5);
  mesi      text[] := array['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre',
                            'novembre','dicembre'];
  fine_mese date := (date_trunc('month', oggi) + interval '1 month - 1 day')::date;
begin
  /* il riepilogo del mattino: dalle 8:30 alle 8:44 */
  if locale::time >= time '08:30' and locale::time < time '08:45' then
    return query
    with chi as (
      select distinct t.partner_id as id from public.notifiche_telefoni t
       where not exists (select 1 from public.notifiche_inviate i
                          where i.partner_id = t.partner_id and i.chiave = 'mattino-' || oggi)
    ),
    parti as (
      select c.id,
             array_remove(array[
               case when coalesce(pv.persone, 0) = 1 then '1 persona da risentire'
                    when coalesce(pv.persone, 0) > 1 then pv.persone || ' persone da risentire' end,
               case when coalesce(pv.clienti, 0) = 1 then '1 cliente da sentire'
                    when coalesce(pv.clienti, 0) > 1 then pv.clienti || ' clienti da sentire' end,
               case when pv.seguimi then 'le azioni del Seguimi sono pronte' end,
               case when coalesce(pv.vp_mancanti, 0) > 0 and oggi > fine_mese - 5
                    then 'mancano ' || replace(trim(to_char(pv.vp_mancanti, 'FM999990D99')), '.', ',')
                         || ' VP al tuo obiettivo' end,
               case when exists (select 1 from public.partners f where f.sponsor_id = c.id)
                     and exists (select 1 from public.numeri_mese n where n.importato_da = c.id)
                     and (select max(n.dati_al) from public.numeri_mese n where n.partner_id = c.id)
                         < p_ora - interval '7 days'
                    then 'il report mappe ha ' || (oggi - (select max(n.dati_al) from public.numeri_mese n
                                                             where n.partner_id = c.id)::date) || ' giorni' end,
               case when extract(day from oggi) <= chiusura
                    then 'il mese di ' || mesi[extract(month from oggi - interval '1 month')::int]
                         || ' si chiude il ' || chiusura end
             ], null) as p
        from chi c
        left join public.notifiche_previste pv on pv.partner_id = c.id and pv.giorno = oggi
    )
    select t.id, t.partner_id, 'mattino-' || oggi, t.endpoint, t.p256dh, t.auth,
           'Growup · oggi', array_to_string(x.p, ' · '), './'
      from parti x join public.notifiche_telefoni t on t.partner_id = x.id
     where cardinality(x.p) > 0
     order by t.partner_id;
  end if;
  /* 040: l'avviso del prossimo passo con l'ora, 30 minuti prima (finestra di 15 minuti come il pianificatore) */
  return query
  select t.id, t.partner_id, 'passo-' || p.id || '-' || p.prossima_data || '-' || to_char(p.prossima_ora, 'HH24:MI'),
         t.endpoint, t.p256dh, t.auth,
         'Growup · alle ' || to_char(p.prossima_ora, 'HH24:MI'),
         case when p.esito = 'cliente' then 'Hai un passo da fare con un tuo cliente. Tocca per aprire la sua scheda.'
              else 'Hai un passo da fare con una persona della tua Lista. Tocca per aprire la sua scheda.' end,
         './?persona=' || p.id
    from public.persone p
    join public.notifiche_telefoni t on t.partner_id = p.proprietario
   where p.prossima_data = oggi and p.prossima_ora is not null
     and (oggi + p.prossima_ora) >  locale + interval '25 minutes'
     and (oggi + p.prossima_ora) <= locale + interval '40 minutes'
     and not exists (select 1 from public.notifiche_inviate i where i.partner_id = p.proprietario
                      and i.chiave = 'passo-' || p.id || '-' || p.prossima_data || '-' || to_char(p.prossima_ora, 'HH24:MI'))
   order by t.partner_id;
end;
$$;

revoke execute on function public.notifiche_da_inviare(timestamptz) from public, anon, authenticated;
grant execute on function public.notifiche_da_inviare(timestamptz) to service_role;
