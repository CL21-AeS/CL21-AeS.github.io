-- Growup Team — 039: le notifiche (Web Push), parte 1: il riepilogo del mattino (28 ottobre 2026).
-- Decisioni di Stefano (tavola «Notifiche di Growup»):
-- * un riepilogo ogni mattina alle 8:30 (ora italiana), solo se c'è qualcosa: persone da risentire, azioni del Seguimi,
--   clienti da sentire, VP che mancano all'obiettivo (solo negli ultimi 5 giorni del mese), report mappe più vecchio di
--   7 giorni (chi ha un gruppo e ha già importato), dal giorno 1 alla chiusura «il mese di … si chiude il 5»;
-- * mai nomi nelle notifiche; la domanda per attivarle una volta per telefono; si spengono dal Profilo.
-- Come funziona: il telefono salva la sua «iscrizione» (notifiche_telefoni); l'app salva per i prossimi giorni solo dei
-- numeri (notifiche_previste); ogni 15 minuti la Edge Function «invia-notifiche» (039b, pg_cron) chiede al database cosa
-- inviare (notifiche_da_inviare, solo per il server) e segna gli invii (notifiche_inviate) per non ripeterli.
-- Le chiavi VAPID le genera e le custodisce la funzione stessa (notifiche_chiavi, senza permessi per nessun utente):
-- nessuno le vede e non stanno nel repository.
-- Solo aggiunte e "create or replace": nessun drop, nessuna cancellazione di dati.

create table if not exists public.notifiche_telefoni (
  id             uuid primary key default gen_random_uuid(),
  partner_id     uuid not null default public.my_partner_id() references public.partners(id) on delete cascade,
  endpoint       text not null unique check (endpoint ~ '^https://' and length(endpoint) <= 1000),
  p256dh         text not null check (length(p256dh) <= 200),
  auth           text not null check (length(auth) <= 100),
  creato_il      timestamptz not null default now(),
  ultimo_errore  text
);
create table if not exists public.notifiche_previste (
  partner_id     uuid not null default public.my_partner_id() references public.partners(id) on delete cascade,
  giorno         date not null,
  persone        int not null default 0 check (persone between 0 and 10000),
  clienti        int not null default 0 check (clienti between 0 and 10000),
  seguimi        boolean not null default false,
  vp_mancanti    numeric(10,2) not null default 0 check (vp_mancanti between 0 and 100000),
  primary key (partner_id, giorno)
);
create table if not exists public.notifiche_inviate (
  partner_id     uuid not null references public.partners(id) on delete cascade,
  chiave         text not null,
  inviata_il     timestamptz not null default now(),
  primary key (partner_id, chiave)
);
create table if not exists public.notifiche_chiavi (
  id             int primary key default 1 check (id = 1),
  pubblica       text not null,
  privata        text not null,
  creata_il      timestamptz not null default now()
);

alter table public.notifiche_telefoni enable row level security;
alter table public.notifiche_previste enable row level security;
alter table public.notifiche_inviate enable row level security;
alter table public.notifiche_chiavi enable row level security;
revoke all on public.notifiche_telefoni, public.notifiche_previste, public.notifiche_inviate, public.notifiche_chiavi
  from anon, authenticated;
grant select, delete on public.notifiche_telefoni, public.notifiche_previste to authenticated;
grant insert (endpoint, p256dh, auth) on public.notifiche_telefoni to authenticated;
grant insert (giorno, persone, clienti, seguimi, vp_mancanti) on public.notifiche_previste to authenticated;
grant update (giorno, persone, clienti, seguimi, vp_mancanti) on public.notifiche_previste to authenticated;

create policy notifiche_telefoni_miei on public.notifiche_telefoni for all to authenticated
  using (partner_id = public.my_partner_id()) with check (partner_id = public.my_partner_id());
create policy notifiche_previste_mie on public.notifiche_previste for all to authenticated
  using (partner_id = public.my_partner_id())
  with check (partner_id = public.my_partner_id()
              and giorno between (now() at time zone 'Europe/Rome')::date - 1 and (now() at time zone 'Europe/Rome')::date + 31);

/* la chiave pubblica VAPID, che serve al telefono per iscriversi (null finché la funzione non l'ha generata) */
create or replace function public.chiave_pubblica_notifiche()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select pubblica from public.notifiche_chiavi where id = 1
$$;

/* Cosa inviare adesso (solo per il server). p_ora: l'istante del controllo (di solito now()). */
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
end;
$$;

/* il segno degli invii fatti (solo per il server) */
create or replace function public.notifiche_segna(p_partner uuid, p_chiave text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifiche_inviate (partner_id, chiave) values (p_partner, p_chiave) on conflict do nothing
$$;

revoke execute on function public.chiave_pubblica_notifiche(), public.notifiche_da_inviare(timestamptz),
  public.notifiche_segna(uuid, text) from public, anon, authenticated;
grant execute on function public.chiave_pubblica_notifiche() to authenticated;
grant execute on function public.notifiche_da_inviare(timestamptz), public.notifiche_segna(uuid, text) to service_role;
grant select, insert, update, delete on public.notifiche_telefoni, public.notifiche_previste, public.notifiche_inviate,
  public.notifiche_chiavi to service_role;
