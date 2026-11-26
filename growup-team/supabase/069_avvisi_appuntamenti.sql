-- ============================================================
-- Growup Team — 069: gli avvisi degli appuntamenti con l'ora (26 novembre 2026, richiesta di Stefano)
-- Scelte di Stefano:
-- * Sotto l'ora di un appuntamento (agenda di Lista e Clienti, prossima cosa, incontro con lo sponsor) si sceglie
--   «Avvisami»: All'ora · 15 min · 30 min · 1 ora · Altro (5 min · 2 ore · Il giorno prima · Nessun avviso ·
--   Personalizza, al massimo 7 giorni). Predefinito 30 minuti; nel Profilo l'avviso predefinito di ogni partner.
-- * Le scelte si salvano con l'appuntamento. Gli appuntamenti già salvati (colonne vuote) restano a 30 minuti, senza
--   secondo avviso. Senza ora nessun avviso. Se si cambia ora, tipo o avviso vale l'ultima scelta.
-- * Solo per il piano (prossima_per = 'piano'): un secondo avviso il giorno prima alla stessa ora («Domani hai un piano:
--   conferma l'appuntamento.»), se acceso; mai se l'avviso scelto è già il giorno prima.
-- * Un avviso il cui orario è già passato quando si salva non parte mai (scelta di Stefano, 26 novembre 2026).
-- * Il pianificatore passa da 15 a 5 minuti (069b, solo su Supabase): ogni avviso parte una volta sola, mai prima
--   dell'orario scelto e al massimo 5 minuti dopo.
-- * Toccando la notifica si apre la schermata della persona da sentire: l'indirizzo ha solo il tipo e l'id interno
--   («./?apri=contatto&id=…», «./?apri=cliente&id=…», «./?apri=incontro»). Testi sempre senza nomi.
-- Solo aggiunte e «create or replace»: colonne nuove (vuote), un trigger nuovo per tabella, la funzione degli invii.
-- Nessuna tabella nuova, nessun dato cambiato o cancellato, RLS invariata (le colonne nuove seguono le regole di prima:
-- le persone solo il proprietario, la riga del partner solo il partner stesso).
-- Per tornare a com'era: 069_avvisi_appuntamenti_togli.sql.
-- ============================================================

-- ---- Le scelte dell'appuntamento (persone: Lista e Clienti) ----
-- prossima_avviso: minuti prima (0 = all'ora, -1 = nessun avviso, al massimo 7 giorni); vuoto = 30, come prima.
-- prossima_giorno_prima: il secondo avviso del piano, il giorno prima alla stessa ora.
-- prossima_avviso_dal: quando sono stati salvati giorno, ora, tipo o avviso (lo mette il database, non si scrive).
alter table public.persone add column if not exists prossima_avviso int
  check (prossima_avviso is null or prossima_avviso between -1 and 10080);
alter table public.persone add column if not exists prossima_giorno_prima boolean not null default false;
alter table public.persone add column if not exists prossima_avviso_dal timestamptz;
grant insert (prossima_avviso, prossima_giorno_prima), update (prossima_avviso, prossima_giorno_prima)
  on public.persone to authenticated;

-- ---- L'incontro con lo sponsor (partners, solo la propria riga) e le scelte predefinite del Profilo ----
alter table public.partners add column if not exists incontro_sponsor_ora time;
alter table public.partners add column if not exists incontro_avviso int
  check (incontro_avviso is null or incontro_avviso between -1 and 10080);
alter table public.partners add column if not exists incontro_avviso_dal timestamptz;
alter table public.partners add column if not exists avviso_predefinito int not null default 30
  check (avviso_predefinito between -1 and 10080);
alter table public.partners add column if not exists avviso_piano_ieri boolean not null default true;
-- solo scrittura: il profilo arriva intero da collega_profilo / entra_con_chiave; sponsor e upline non le leggono
grant update (incontro_sponsor_ora, incontro_avviso, avviso_predefinito, avviso_piano_ieri) on public.partners to authenticated;

-- ---- Quando è stato salvato l'appuntamento: lo segna il database ----
create or replace function public.persone_avviso_dal()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT'
     or (new.prossima_data, new.prossima_ora, new.prossima_per, new.prossima_avviso, new.prossima_giorno_prima)
        is distinct from (old.prossima_data, old.prossima_ora, old.prossima_per, old.prossima_avviso, old.prossima_giorno_prima) then
    new.prossima_avviso_dal := now();
  end if;
  return new;
end;
$$;
drop trigger if exists persone_avviso_dal on public.persone;
create trigger persone_avviso_dal before insert or update on public.persone
  for each row execute function public.persone_avviso_dal();

create or replace function public.partners_incontro_avviso_dal()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.incontro_sponsor, new.incontro_sponsor_ora, new.incontro_avviso)
     is distinct from (old.incontro_sponsor, old.incontro_sponsor_ora, old.incontro_avviso) then
    new.incontro_avviso_dal := now();
  end if;
  return new;
end;
$$;
drop trigger if exists partners_incontro_avviso_dal on public.partners;
create trigger partners_incontro_avviso_dal before update on public.partners
  for each row execute function public.partners_incontro_avviso_dal();

-- ---- Il titolo della notifica: «alle 10:30», «domani alle 10:30», «il 3 dicembre alle 10:30» ----
create or replace function public.titolo_avviso(p_giorno date, p_ora time, p_oggi date)
returns text
language sql
immutable
set search_path = public
as $$
  select 'Growup · ' || case when p_giorno = p_oggi then ''
                             when p_giorno = p_oggi + 1 then 'domani '
                             else 'il ' || case when extract(day from p_giorno) = 1 then '1°' else extract(day from p_giorno)::int::text end
                                  || ' ' || (array['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre',
                                                   'ottobre','novembre','dicembre'])[extract(month from p_giorno)::int] || ' ' end
         || 'alle ' || to_char(p_ora, 'HH24:MI')
$$;
revoke execute on function public.titolo_avviso(date, time, date) from public, anon, authenticated;

-- ---- Cosa inviare (solo per il server): il riepilogo del mattino, gli avvisi degli appuntamenti, gli eventi ----
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
  /* il riepilogo del mattino: dalle 8:30 alle 8:34 (069: con il pianificatore ogni 5 minuti c'è un solo giro in questa
     finestra; in più notifiche_inviate impedisce di mandarlo due volte) */
  if locale::time >= time '08:30' and locale::time < time '08:35' then
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

  /* 069: gli avvisi degli appuntamenti con l'ora (Lista, Clienti, incontro con lo sponsor).
     «alle» è l'orario dell'avviso (ora italiana): parte nel primo giro da quell'orario a 5 minuti dopo, mai prima, una
     volta sola (notifiche_inviate), e solo se a quell'orario l'appuntamento era già salvato così («dal»).
     La chiave dell'avviso a 30 minuti resta quella di prima (040): un avviso già partito non riparte. */
  return query
  with app as (
    select p.id, p.proprietario as chi, p.esito, p.prossima_per as per, p.prossima_data as giorno, p.prossima_ora as ora,
           coalesce(p.prossima_avviso, 30) as anticipo, p.prossima_giorno_prima as ieri_ok, p.prossima_avviso_dal as dal
      from public.persone p
     where p.prossima_ora is not null and p.prossima_data between oggi - 1 and oggi + 8
  ),
  avvisi as (
    select a.chi, a.giorno, a.ora,
           'passo-' || a.id || '-' || a.giorno || '-' || to_char(a.ora, 'HH24:MI')
             || case when a.anticipo <> 30 then '-' || a.anticipo else '' end as k,
           (a.giorno + a.ora) - make_interval(mins => a.anticipo) as alle, a.dal,
           case when a.anticipo = 0 then 'È l''ora del tuo appuntamento. Tocca per aprire la sua scheda.'
                when a.esito = 'cliente' then 'Hai un passo da fare con un tuo cliente. Tocca per aprire la sua scheda.'
                else 'Hai un passo da fare con una persona della tua Lista. Tocca per aprire la sua scheda.' end as testo,
           './?apri=' || case when a.esito = 'cliente' then 'cliente' else 'contatto' end || '&id=' || a.id as dove
      from app a
     where a.anticipo >= 0
    union all
    /* il secondo avviso, solo per il piano: il giorno prima alla stessa ora (mai se l'avviso scelto è già il giorno prima) */
    select a.chi, a.giorno, a.ora,
           'piano-ieri-' || a.id || '-' || a.giorno || '-' || to_char(a.ora, 'HH24:MI'),
           (a.giorno + a.ora) - interval '1 day', a.dal,
           'Domani hai un piano: conferma l''appuntamento.',
           './?apri=' || case when a.esito = 'cliente' then 'cliente' else 'contatto' end || '&id=' || a.id
      from app a
     where a.per = 'piano' and a.ieri_ok and a.anticipo <> 1440
    union all
    /* l'incontro con lo sponsor (percorso di partenza): solo il partner stesso */
    select p.id, p.incontro_sponsor, p.incontro_sponsor_ora,
           'incontro-' || p.id || '-' || p.incontro_sponsor || '-' || to_char(p.incontro_sponsor_ora, 'HH24:MI')
             || '-' || coalesce(p.incontro_avviso, 30),
           (p.incontro_sponsor + p.incontro_sponsor_ora) - make_interval(mins => coalesce(p.incontro_avviso, 30)),
           p.incontro_avviso_dal,
           case when coalesce(p.incontro_avviso, 30) = 0 then 'È l''ora del tuo appuntamento. Tocca per aprire il percorso.'
                else 'Hai l''incontro con il tuo sponsor. Tocca per aprire il percorso.' end,
           './?apri=incontro'
      from public.partners p
     where p.incontro_sponsor_ora is not null and p.incontro_sponsor between oggi - 1 and oggi + 8
       and coalesce(p.incontro_avviso, 30) >= 0
  )
  select t.id, t.partner_id, v.k, t.endpoint, t.p256dh, t.auth,
         public.titolo_avviso(v.giorno, v.ora, oggi), v.testo, v.dove
    from avvisi v
    join public.notifiche_telefoni t on t.partner_id = v.chi
   where v.alle <= locale and v.alle >= locale - interval '5 minutes'
     and (v.dal is null or (v.alle at time zone 'Europe/Rome') >= v.dal)
     and not exists (select 1 from public.notifiche_inviate i where i.partner_id = v.chi and i.chiave = v.k)
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
