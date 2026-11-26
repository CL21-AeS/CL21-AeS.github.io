-- ============================================================
-- Growup Team — per TOGLIERE la 069 (gli avvisi degli appuntamenti) e tornare a com'era prima.
-- Si incolla nell'SQL Editor di Supabase. Prima rimette il pianificatore a ogni 15 minuti (069b), poi la funzione degli
-- invii com'era (063: avviso sempre 30 minuti prima, indirizzo «./?persona=<id>»), poi toglie trigger, funzioni e
-- colonne della 069. Le scelte salvate (avvisi, ora dell'incontro, predefiniti del Profilo) si perdono.
-- ============================================================
select cron.alter_job(jobid, schedule := '*/15 * * * *') from cron.job where jobname = 'growup-notifiche';

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
    vp as (
      select c.id,
             g.obiettivo_vp - n.vpp as manca,
             (n.dati_al at time zone 'Europe/Rome')::date as mappa_del
        from chi c
        join public.numeri_mese n on n.partner_id = c.id and n.mese = date_trunc('month', oggi)::date
        join public.monthly_goals g on g.partner_id = c.id and g.mese = date_trunc('month', oggi)::date
    ),
    parti as (
      select c.id,
             array_remove(array[
               case when coalesce(pv.persone, 0) = 1 then '1 persona da risentire'
                    when coalesce(pv.persone, 0) > 1 then pv.persone || ' persone da risentire' end,
               case when coalesce(pv.clienti, 0) = 1 then '1 cliente da sentire'
                    when coalesce(pv.clienti, 0) > 1 then pv.clienti || ' clienti da sentire' end,
               case when pv.seguimi then 'le azioni del Seguimi sono pronte' end,
               case when coalesce(v.manca, 0) > 0 and oggi > fine_mese - 5
                    then 'mancano ' || replace(rtrim(to_char(v.manca, 'FM999990.99'), '.'), '.', ',')
                         || ' VP al tuo obiettivo (mappa '
                         || case extract(day from v.mappa_del)::int when 1 then 'del 1°' when 8 then 'dell''8' when 11 then 'dell''11'
                                 else 'del ' || extract(day from v.mappa_del)::int end
                         || ' ' || mesi[extract(month from v.mappa_del)::int] || ')' end,
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
        left join vp v on v.id = c.id
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
  /* 041: gli avvisi degli eventi (inviti usati, persone messe al loro posto), al primo giro dopo l'evento */
  return query
  select t.id, t.partner_id, 'evento-' || e.chiave, t.endpoint, t.p256dh, t.auth, e.titolo, e.corpo, e.url
    from public.notifiche_eventi e
    join public.notifiche_telefoni t on t.partner_id = e.partner_id
   where e.creato_il > p_ora - interval '2 days'
     and not exists (select 1 from public.notifiche_inviate i where i.partner_id = e.partner_id
                      and i.chiave = 'evento-' || e.chiave)
   order by t.partner_id;
end;
$$;
revoke execute on function public.notifiche_da_inviare(timestamptz) from public, anon, authenticated;
grant execute on function public.notifiche_da_inviare(timestamptz) to service_role;

drop trigger if exists persone_avviso_dal on public.persone;
drop trigger if exists partners_incontro_avviso_dal on public.partners;
drop function if exists public.persone_avviso_dal();
drop function if exists public.partners_incontro_avviso_dal();
drop function if exists public.titolo_avviso(date, time, date);
alter table public.persone drop column if exists prossima_avviso, drop column if exists prossima_giorno_prima,
  drop column if exists prossima_avviso_dal;
alter table public.partners drop column if exists incontro_sponsor_ora, drop column if exists incontro_avviso,
  drop column if exists incontro_avviso_dal, drop column if exists avviso_predefinito, drop column if exists avviso_piano_ieri;
