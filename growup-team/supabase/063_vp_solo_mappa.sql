-- ============================================================
-- Growup Team — 063: i VP solo dalla mappa Amway, e più bozze d'ordine (10 novembre 2026)
-- Decisioni di Stefano:
-- * I VP dell'app (personali, di gruppo, linee, percentuale; per me e per tutti, anche per chi non ha l'app) sono solo
--   quelli ufficiali delle mappe Amway importate (numeri_mese: per ogni persona e mese la mappa che vale, con le regole
--   di ordine della 051). Nessun ordine, bozza o correzione scritta a mano cambia più i VP.
-- * Senza la mappa del mese i VP non sono disponibili: le funzioni danno null («nessuna mappa di …»), mai uno zero.
-- * Gli ordini e le rettifiche già registrati restano nel database e nel diario, ma non contano più; non se ne
--   scrivono di nuovi.
-- * I mesi già chiusi: lo storico mostra i numeri della mappa di quel mese; i totali congelati restano nel database.
--   Da ora si congelano solo i numeri di chi ha la mappa del mese.
-- * Le bozze d'ordine: anche più di una, con un nome (facoltativo, max 60) e un cliente collegato (facoltativo, solo
--   persone mie). Confermata, la bozza va nello storico «I miei ordini» senza VP; se ha un cliente, l'ordine entra anche
--   nella sua scheda. Nessun limite di mese chiuso sulla data (solo: non nel futuro).
-- * Il primo ordine di un nuovo (partenze): i VP della prima mappa, dal mese di iscrizione, che ne mostra (> 0).
-- * La notifica del mattino «mancano X VP» la calcola il database dalla mappa del mese, con la sua data.
-- Solo "create or replace", "alter", colonne e indici nuovi: nessun dato cancellato. L'unico drop è l'indice che
-- permetteva una sola bozza (lo chiede Stefano).
-- ============================================================

-- ---- I numeri del mese: solo dalla mappa ----
-- Per ogni persona della struttura visibile da p_radice: i numeri della mappa del mese (null senza mappa).
-- p_chi resta per compatibilità con le chiamate di prima (non cambia più niente).
create or replace function public.calcola_mese(p_mese date, p_radice uuid, p_chi uuid)
returns table (partner_id uuid, sponsor_id uuid, vp_personali numeric, vp_gruppo numeric,
               linee_attive int, percentuale int, qualifica text)
language sql
stable
security definer
set search_path = public
as $$
  with recursive
  tutto(id, visibile, sponsor_visibile) as (
    select p.id, true, null::uuid from public.partners p where p.id = p_radice
    union all
    select p.id, (p.stato = 'gestito' or p.confermato_il is not null or p.is_admin),
           case when t.visibile then t.id else t.sponsor_visibile end
    from public.partners p join tutto t on p.sponsor_id = t.id
  ),
  albero(id, sponsor_id) as (
    select id, sponsor_visibile from tutto where visibile
  ),
  soglia as (
    select coalesce((select (valore #>> '{}')::numeric from public.settings where chiave = 'soglia_linea_attiva'), 100) as v
  )
  select a.id, a.sponsor_id, n.vpp, n.vpg,
         case when n.partner_id is null then null
              else (select count(*)::int from jsonb_array_elements(n.linee) l, soglia where (l->>'vpg')::numeric >= soglia.v) end,
         case when n.partner_id is null then null
              else coalesce(n.percentuale, (select max(l.percentuale) from public.percent_levels l where l.vp_gruppo <= n.vpg)) end,
         case when n.partner_id is null then null else public.qualifica_report(n.vpp, n.vpg, n.linee) end
  from albero a
  left join public.numeri_mese n on n.partner_id = a.id and n.mese = date_trunc('month', p_mese)::date
$$;

-- Il riepilogo di un mese (anche già chiuso): la mia struttura di oggi con i numeri della mappa di quel mese.
-- «chiuso» dice se il mese è già stato congelato per me.
create or replace function public.riepilogo_mese(p_mese date)
returns table (partner_id uuid, sponsor_id uuid, vp_personali numeric, vp_gruppo numeric,
               linee_attive int, percentuale int, qualifica text, chiuso boolean,
               da_report boolean, linee_report jsonb, linee_nascoste boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  io     uuid := public.my_partner_id();
  m      date := date_trunc('month', p_mese)::date;
  chiuso boolean;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  chiuso := exists (select 1 from public.monthly_totals t where t.visto_da = io and t.mese = m);
  return query
    select c.partner_id, c.sponsor_id, c.vp_personali, c.vp_gruppo, c.linee_attive, c.percentuale, c.qualifica,
           chiuso, n.partner_id is not null, n.linee, coalesce(n.linee_nascoste, false)
      from public.calcola_mese(m, io, io) c
      left join public.numeri_mese n on n.partner_id = c.partner_id and n.mese = m;
end;
$$;

-- Il congelamento del mese (il giorno 5): solo i numeri di chi ha la mappa di quel mese.
create or replace function public.chiudi_mese(p_mese date)
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  m date := date_trunc('month', p_mese)::date;
  n int;
begin
  insert into public.monthly_totals (visto_da, partner_id, mese, vp_personali, vp_gruppo, linee_attive, percentuale, qualifica)
  select v.id, c.partner_id, m, c.vp_personali, c.vp_gruppo, c.linee_attive, c.percentuale, c.qualifica
    from public.partners v
    cross join lateral public.calcola_mese(m, v.id, v.id) c
   where v.stato <> 'gestito' and c.vp_personali is not null
  on conflict (visto_da, partner_id, mese) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---- Niente più ordini e rettifiche scritti a mano: il database non li accetta (quelli vecchi restano) ----
alter policy activities_inserisco_mie on public.activities
  with check ((((partner_id = (select public.my_partner_id())) OR posso_gestire(partner_id)))
              and tipo <> all (array['ordine'::text, 'rettifica'::text]));
alter policy activities_modifico_mie on public.activities
  using (((partner_id = (select public.my_partner_id())) OR posso_gestire(partner_id)))
  with check ((((partner_id = (select public.my_partner_id())) OR posso_gestire(partner_id)))
              and tipo <> all (array['ordine'::text, 'rettifica'::text]));

-- ---- Il primo ordine di un nuovo: dalla mappa ----
-- vp_dal_ingresso: i VP personali della prima mappa (dal mese di iscrizione) che ne mostra; null finché non c'è.
create or replace function public.partenze(p_partner uuid default null)
returns table (id uuid, nome text, stato text, data_iscrizione date, ingresso date, incontro_sponsor date,
               partenza_completata_il timestamptz, punto_upline date, punto_upline_fatto date, ha_perche boolean,
               nomi_lista int, vp_dal_ingresso numeric, contatti int, invitati int, piani int, clienti int,
               ha_gruppo boolean, mappa_importata boolean, invitato_da_me boolean)
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
  /* chi ho invitato lo vedo anche mentre è «in attesa della mappa» (ancora fuori dalla struttura) */
  if p_partner is not null and not public.vedo(p_partner) and not public.invitato_da_me(p_partner) then
    raise exception 'non_autorizzato';
  end if;
  return query
  select p.id, p.nome, p.stato, p.data_iscrizione,
         coalesce(p.privacy_accettata_il, p.creato_il)::date,
         p.incontro_sponsor, p.partenza_completata_il, p.punto_upline, p.punto_upline_fatto,
         exists (select 1 from public.obiettivi o where o.partner_id = p.id and length(btrim(coalesce(o.perche, ''))) > 0),
         (select count(*)::int from public.persone x where x.proprietario = p.id and x.esito is distinct from 'cliente'),
         (select n.vpp from public.numeri_mese n
           where n.partner_id = p.id and n.vpp > 0
             and n.mese >= date_trunc('month', coalesce(p.data_iscrizione, '2000-01-01'::date))::date
           order by n.mese limit 1),
         (select coalesce(sum(a.quantita), 0)::int from public.activities a where a.partner_id = p.id and a.tipo = 'contatto'),
         (select count(*)::int from public.passi s where s.proprietario = p.id and s.tipo = 'invito'),
         (select coalesce(sum(a.quantita), 0)::int from public.activities a where a.partner_id = p.id and a.tipo = 'piano'),
         (select coalesce(sum(a.quantita), 0)::int from public.activities a where a.partner_id = p.id and a.tipo = 'cliente'),
         exists (select 1 from public.partners f where f.sponsor_id = p.id),
         exists (select 1 from public.numeri_mese n where n.importato_da = p.id),
         p.invitato_da = io
    from public.partners p
   where p.stato <> 'gestito'
     and (case when p_partner is null then p.invitato_da = io else p.id = p_partner end);
end;
$$;
revoke execute on function public.partenze(uuid) from public, anon, authenticated;
grant execute on function public.partenze(uuid) to authenticated;

-- ---- Più bozze d'ordine, con un nome e un cliente ----
drop index if exists public.ordini_personali_una_bozza;
alter table public.ordini_personali add column if not exists nome text check (length(nome) between 1 and 60);
alter table public.ordini_personali add column if not exists persona_id uuid references public.persone(id) on delete set null;
alter table public.ordini_personali add column if not exists ordine_cliente_id uuid references public.ordini(id) on delete set null;
create index if not exists ordini_personali_persona_idx on public.ordini_personali (persona_id);
create index if not exists ordini_personali_ordine_cliente_idx on public.ordini_personali (ordine_cliente_id);

/* la persona collegata a una bozza è sempre una mia persona */
create or replace function public.persona_mia(p_persona uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_persona is null
      or exists (select 1 from public.persone x where x.id = p_persona and x.proprietario = public.my_partner_id())
$$;
revoke execute on function public.persona_mia(uuid) from public, anon, authenticated;
grant execute on function public.persona_mia(uuid) to authenticated;

grant insert (nome, persona_id), update (nome, persona_id) on public.ordini_personali to authenticated;
alter policy ordini_personali_creo on public.ordini_personali
  with check (proprietario = public.my_partner_id() and stato = 'bozza' and public.persona_mia(persona_id));
drop policy if exists ordini_personali_cambio on public.ordini_personali;
create policy ordini_personali_cambio on public.ordini_personali for update to authenticated
  using (proprietario = public.my_partner_id() and stato = 'bozza')
  with check (proprietario = public.my_partner_id() and stato = 'bozza' and public.persona_mia(persona_id));

/* confermo la mia bozza: passa nello storico con la data, senza VP nel mese; con un cliente, l'ordine entra anche
   nella sua scheda (con i prodotti), come gli ordini dei clienti fatti da me */
create or replace function public.conferma_ordine(p_ordine uuid, p_data date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  io   uuid := public.my_partner_id();
  o    public.ordini_personali;
  d    date := coalesce(p_data, (now() at time zone 'Europe/Rome')::date);
  tot  numeric;
  oc   uuid;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  select * into o from public.ordini_personali where id = p_ordine and proprietario = io and stato = 'bozza' for update;
  if o.id is null then
    raise exception 'non_autorizzato';
  end if;
  if not exists (select 1 from public.righe_ordine_personale where ordine_id = o.id) then
    raise exception 'ordine_vuoto';
  end if;
  if d < date '2020-01-01' or d > (now() at time zone 'Europe/Rome')::date then
    raise exception 'data_non_valida';
  end if;
  select round(coalesce(sum(coalesce(r.vp, 0) * r.quantita), 0), 2) into tot
    from public.righe_ordine_personale r where r.ordine_id = o.id;
  if o.persona_id is not null
     and exists (select 1 from public.persone x where x.id = o.persona_id and x.proprietario = io) then
    insert into public.ordini (proprietario, persona_id, data, modo, vp)
    values (io, o.persona_id, d, 'io', least(tot, 100000)) returning id into oc;
    insert into public.righe_ordine (ordine_id, proprietario, codice, nome, quantita, prezzo, prezzo_partner, vp)
    select oc, io, r.codice, r.nome, r.quantita, r.prezzo_cliente, r.prezzo_partner, r.vp
      from public.righe_ordine_personale r where r.ordine_id = o.id;
  end if;
  update public.ordini_personali
     set stato = 'confermato', data = d, vp = tot, confermato_il = now(), ordine_cliente_id = oc
   where id = o.id returning * into o;
  return to_jsonb(o);
end;
$$;
revoke execute on function public.conferma_ordine(uuid, date) from public, anon, authenticated;
grant execute on function public.conferma_ordine(uuid, date) to authenticated;

-- ---- La notifica del mattino: «mancano X VP» dalla mappa del mese, con la sua data ----
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
