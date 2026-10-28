-- Growup Team — 041: si entra solo con un invito personale (28 ottobre 2026).
-- Decisioni di Stefano, dopo il controllo di sicurezza del 28 ottobre:
-- * niente più link d'invito generico (il codice d'invito di 6 lettere): chi invita tocca «Invita», scrive nome e codice
--   Amway del nuovo partner e ottiene un link con solo un codice casuale (128 bit; nel database c'è solo l'impronta).
--   Nome e codice Amway restano nel database: nel link non si vedono e non si possono cambiare;
-- * il link vale una volta sola e scade dopo 7 giorni; chi l'ha creato lo annulla o lo rigenera (link nuovo, altri 7 giorni);
-- * può invitare solo chi è già nella mappa (confermato da un report) o un admin;
-- * se il codice Amway è già nella mappa (persona importata senza app), l'invito lo crea solo chi le sta sopra e chi entra
--   prende subito il suo posto, già confermato; altrimenti chi entra resta «in attesa» (vede solo sé stesso) sotto chi l'ha
--   invitato, finché una mappa importata da chi l'ha invitato o dalla sua upline non contiene il suo codice: allora va al suo
--   posto, sotto il suo sponsor vero (importa_mappa, invariata);
-- * notifiche (mai nomi): a chi ha invitato quando il nuovo entra e quando la mappa lo mette al suo posto; al suo sponsor
--   vero, se è un altro e usa l'app, quando la mappa lo mette al suo posto;
-- * spariscono anche l'«invito sopra» degli admin e il link personale per chi non è mai entrato: il link personale serve
--   solo per rientrare.
-- I vecchi link smettono di funzionare perché le funzioni che li leggevano non ci sono più.

-- ---- Gli inviti personali ----
create table if not exists public.inviti (
  id            uuid primary key default gen_random_uuid(),
  codice_hash   text not null unique,
  creato_da     uuid not null references public.partners(id) on delete cascade,
  nome          text not null check (length(btrim(nome)) between 1 and 80),
  codice_amway  text not null check (codice_amway ~ '^[0-9]{4,12}$'),
  creato_il     timestamptz not null default now(),
  scade_il      timestamptz not null,
  annullato_il  timestamptz,
  usato_il      timestamptz,
  usato_da      uuid references public.partners(id) on delete set null
);
create index if not exists inviti_creato_da on public.inviti (creato_da);
create index if not exists inviti_codice_amway on public.inviti (codice_amway);
create index if not exists inviti_usato_da on public.inviti (usato_da);

alter table public.inviti enable row level security;
revoke all on public.inviti from anon, authenticated;
-- chi invita legge i suoi inviti (mai l'impronta); si creano, annullano e rigenerano solo con le funzioni qui sotto
grant select (id, creato_da, nome, codice_amway, creato_il, scade_il, annullato_il, usato_il, usato_da)
  on public.inviti to authenticated;
drop policy if exists inviti_miei on public.inviti;
create policy inviti_miei on public.inviti for select to authenticated using (creato_da = public.my_partner_id());

-- ---- Gli avvisi per gli eventi (solo per il server; mai nomi) ----
create table if not exists public.notifiche_eventi (
  id          bigint generated always as identity primary key,
  partner_id  uuid not null references public.partners(id) on delete cascade,
  chiave      text not null,
  titolo      text not null,
  corpo       text not null,
  url         text not null default './',
  creato_il   timestamptz not null default now(),
  unique (partner_id, chiave)
);
alter table public.notifiche_eventi enable row level security;
revoke all on public.notifiche_eventi from anon, authenticated;
grant select, insert, update, delete on public.notifiche_eventi to service_role;

create or replace function public.avvisa(p_partner uuid, p_chiave text, p_corpo text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifiche_eventi (partner_id, chiave, titolo, corpo)
  select p_partner, p_chiave, 'Growup · il tuo gruppo', p_corpo
   where p_partner is not null
  on conflict (partner_id, chiave) do nothing
$$;

-- ---- Creare, annullare e rigenerare un invito ----
create or replace function public.crea_invito(p_nome text, p_codice_amway text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  io     uuid := public.my_partner_id();
  me     public.partners;
  codice text := nullif(regexp_replace(coalesce(p_codice_amway, ''), '[^0-9]', '', 'g'), '');
  chiave text := public.nuova_chiave_segreta();
  i      public.inviti;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  select * into me from public.partners where id = io;
  if me.confermato_il is null and not me.is_admin then
    raise exception 'in_attesa';
  end if;
  if length(btrim(coalesce(p_nome, ''))) = 0 then
    raise exception 'nome_mancante';
  end if;
  if codice is null then
    raise exception 'codice_amway_mancante';
  end if;
  if codice !~ '^[0-9]{4,12}$' then
    raise exception 'codice_amway_non_valido';
  end if;
  if exists (select 1 from public.codici_tolti where codice_amway = codice) then
    raise exception 'codice_tolto';
  end if;
  if exists (select 1 from public.partners where codice_amway = codice and stato <> 'gestito') then
    raise exception 'codice_amway_attivo';
  end if;
  -- già nella mappa: l'invito lo crea solo chi le sta sopra
  if exists (select 1 from public.partners where codice_amway = codice and stato = 'gestito')
     and not exists (select 1 from public.partners x where x.codice_amway = codice and x.stato = 'gestito'
                      and x.id <> io and public.is_in_downline(x.id)) then
    raise exception 'codice_amway_altra_linea';
  end if;
  if (select count(*) from public.inviti where creato_da = io and usato_il is null and annullato_il is null
        and scade_il > now()) >= 50 then
    raise exception 'troppi_inviti';
  end if;
  insert into public.inviti (codice_hash, creato_da, nome, codice_amway, scade_il)
  values (public.impronta(chiave), io, left(btrim(p_nome), 80), codice, now() + interval '7 days')
  returning * into i;
  return jsonb_build_object('id', i.id, 'codice', chiave, 'scade_il', i.scade_il);
end;
$$;

create or replace function public.annulla_invito(p_invito uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.my_partner_id() is null then
    raise exception 'non_autenticato';
  end if;
  update public.inviti set annullato_il = coalesce(annullato_il, now())
   where id = p_invito and creato_da = public.my_partner_id() and usato_il is null;
  if not found then
    raise exception 'non_autorizzato';
  end if;
end;
$$;

-- un link nuovo per lo stesso invito: il vecchio smette di funzionare e si riparte con 7 giorni
create or replace function public.rigenera_invito(p_invito uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  io     uuid := public.my_partner_id();
  chiave text := public.nuova_chiave_segreta();
  i      public.inviti;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  select * into i from public.inviti where id = p_invito and creato_da = io for update;
  if not found then
    raise exception 'non_autorizzato';
  end if;
  if i.usato_il is not null then
    raise exception 'invito_usato';
  end if;
  if exists (select 1 from public.partners where codice_amway = i.codice_amway and stato <> 'gestito') then
    raise exception 'codice_amway_attivo';
  end if;
  update public.inviti set codice_hash = public.impronta(chiave), scade_il = now() + interval '7 days', annullato_il = null
   where id = i.id returning * into i;
  return jsonb_build_object('id', i.id, 'codice', chiave, 'scade_il', i.scade_il);
end;
$$;

-- per la pagina d'ingresso, anche senza accesso: com'è il link e, solo se è aperto, il nome dell'invitato e di chi invita
create or replace function public.invito_aperto(p_codice text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  i public.inviti;
begin
  if coalesce(p_codice, '') !~* '^[0-9a-f]{32}$' then
    return jsonb_build_object('stato', 'sconosciuto');
  end if;
  select * into i from public.inviti where codice_hash = public.impronta(p_codice);
  if not found or not exists (select 1 from public.partners s where s.id = i.creato_da and s.bloccato_il is null) then
    return jsonb_build_object('stato', 'sconosciuto');
  end if;
  if i.usato_il is not null then return jsonb_build_object('stato', 'usato'); end if;
  if i.annullato_il is not null then return jsonb_build_object('stato', 'annullato'); end if;
  if i.scade_il <= now() then return jsonb_build_object('stato', 'scaduto'); end if;
  return jsonb_build_object('stato', 'ok', 'nome', i.nome,
                            'da', (select btrim(s.nome) from public.partners s where s.id = i.creato_da));
end;
$$;

-- ---- Entrare con l'invito ----
drop function if exists public.entra_con_invito(text, text, text, date, text, date, integer, integer);
create or replace function public.entra_con_invito(p_codice text, p_data_iscrizione date default null,
  p_qualifica text default null, p_qualifica_mese date default null, p_pagamenti integer default 0,
  p_percentuale integer default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid     uuid := auth.uid();
  chiave  text := public.nuova_chiave_segreta();
  i       public.inviti;
  copia   uuid;
  p       public.partners;
begin
  if uid is null then
    raise exception 'non_autenticato';
  end if;
  if exists (select 1 from public.accessi where user_id = uid) then
    raise exception 'profilo_esistente';
  end if;
  if coalesce(p_codice, '') !~* '^[0-9a-f]{32}$' then
    raise exception 'invito_non_valido';
  end if;
  select * into i from public.inviti where codice_hash = public.impronta(p_codice) for update;
  if not found or not exists (select 1 from public.partners s where s.id = i.creato_da and s.bloccato_il is null) then
    raise exception 'invito_non_valido';
  end if;
  if i.usato_il is not null then raise exception 'invito_usato'; end if;
  if i.annullato_il is not null then raise exception 'invito_annullato'; end if;
  if i.scade_il <= now() then raise exception 'invito_scaduto'; end if;
  if p_data_iscrizione is not null and p_data_iscrizione > (now() at time zone 'Europe/Rome')::date then
    raise exception 'data_futura';
  end if;
  if p_qualifica is not null
     and not exists (select 1 from public.stage_requirements s where s.chiave = p_qualifica) then
    raise exception 'qualifica_non_valida';
  end if;
  if p_percentuale is not null and p_percentuale not in (3, 6, 9, 12, 15, 18, 21) then
    raise exception 'percentuale_non_valida';
  end if;
  if exists (select 1 from public.partners where codice_amway = i.codice_amway and stato <> 'gestito') then
    raise exception 'codice_amway_attivo';
  end if;

  if exists (select 1 from public.partners where codice_amway = i.codice_amway and stato = 'gestito') then
    -- già nella mappa: prende il suo posto, solo se chi ha invitato le sta sopra
    select x.id into copia from public.partners x
     where x.codice_amway = i.codice_amway and x.stato = 'gestito'
       and exists (
         with recursive su(id, sponsor_id, livello) as (
           select y.id, y.sponsor_id, 0 from public.partners y where y.id = x.sponsor_id
           union all
           select y.id, y.sponsor_id, su.livello + 1 from public.partners y join su on y.id = su.sponsor_id
           where su.livello < 200
         )
         select 1 from su where su.id = i.creato_da)
     order by (x.gestore_id = i.creato_da) desc, public.profondita(x.gestore_id) desc, x.creato_il, x.id
     limit 1;
    if copia is null then
      raise exception 'codice_amway_altra_linea';
    end if;
    -- l'invito si segna prima: partners_avvisi lo legge per avvisare chi ha invitato
    update public.inviti set usato_il = now(), usato_da = copia where id = i.id;
    update public.partners
       set nome = i.nome, chiave_hash = public.impronta(chiave), data_iscrizione = p_data_iscrizione,
           qualifica_iniziale = p_qualifica, percentuale_iniziale = p_percentuale,
           qualifica_iniziale_mese = date_trunc('month', p_qualifica_mese)::date,
           pagamenti_iniziali = coalesce(p_pagamenti, 0), privacy_accettata_il = now(), ultimo_aggiornamento = now(),
           partenza_confermata_il = case when p_qualifica is null and p_percentuale is null then now() end,
           partenza_confermata_da = null
     where id = copia;
    perform public.diventa_attivo(copia);   -- confermato subito; l'avviso «al suo posto» parte da partners_avvisi
    select * into p from public.partners where id = copia;
  else
    -- non ancora nella mappa: resta in attesa sotto chi l'ha invitato
    insert into public.partners (nome, sponsor_id, stato, chiave_hash, codice_amway, data_iscrizione,
                                 qualifica_iniziale, percentuale_iniziale, qualifica_iniziale_mese, pagamenti_iniziali,
                                 privacy_accettata_il, ultimo_aggiornamento)
    values (i.nome, i.creato_da, 'attivo', public.impronta(chiave), i.codice_amway, p_data_iscrizione,
            p_qualifica, p_percentuale, date_trunc('month', p_qualifica_mese)::date, coalesce(p_pagamenti, 0),
            now(), now())
    returning * into p;
    update public.partners set creato_da = p.id where id = p.id returning * into p;
    perform public.avvisa(i.creato_da, 'entrato-' || p.id,
      'Una persona che hai invitato è entrata in Growup. Resta in attesa finché una mappa importata non la mette al suo posto.');
  end if;

  update public.inviti set usato_il = now(), usato_da = p.id where id = i.id;
  -- gli altri inviti aperti con lo stesso codice non servono più
  update public.inviti set annullato_il = now()
   where codice_amway = i.codice_amway and id <> i.id and usato_il is null and annullato_il is null;
  insert into public.accessi (user_id, partner_id) values (uid, p.id);
  return jsonb_build_object('profilo', to_jsonb(p) - 'chiave_hash', 'chiave', chiave);
end;
$$;

-- ---- Quando la mappa mette qualcuno al suo posto: gli avvisi ----
create or replace function public.partners_avvisi()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- chi ha invitato: dall'invito usato (041) o, per chi è entrato prima, da invitato_da (035)
  chi uuid := coalesce((select i.creato_da from public.inviti i where i.usato_da = new.id order by i.usato_il desc limit 1),
                       new.invitato_da);
begin
  if old.confermato_il is null and new.confermato_il is not null and new.stato <> 'gestito' then
    perform public.avvisa(chi, 'al-posto-' || new.id,
      'Una persona che hai invitato è ora al suo posto nella mappa.');
    if new.sponsor_id is distinct from chi
       and exists (select 1 from public.partners s where s.id = new.sponsor_id and s.stato <> 'gestito') then
      perform public.avvisa(new.sponsor_id, 'al-posto-' || new.id,
        'Un nuovo partner del tuo gruppo è entrato in Growup ed è al suo posto nella mappa, sotto di te.');
    end if;
  end if;
  return null;
end;
$$;
drop trigger if exists partners_avvisi on public.partners;
-- senza «of confermato_il»: la conferma la scrive anche il trigger partners_conferma (persona importata che entra)
create trigger partners_avvisi after update on public.partners
  for each row when (old.confermato_il is null and new.confermato_il is not null)
  execute function public.partners_avvisi();

-- ---- Il link personale serve solo per rientrare ----
-- chi non è mai entrato (persona importata senza app) non ha un link personale: entra con un invito
create or replace function public.entra_con_chiave(p_chiave text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p   public.partners;
begin
  if uid is null then
    raise exception 'non_autenticato';
  end if;
  select * into p from public.partners where chiave_hash = public.impronta(p_chiave);
  if not found or (p.stato = 'gestito' and not p.is_admin) then
    raise exception 'chiave_non_valida';
  end if;

  insert into public.accessi (user_id, partner_id) values (uid, p.id)
  on conflict (user_id) do update set partner_id = excluded.partner_id, creato_il = now();

  if p.stato = 'gestito' then
    perform public.diventa_attivo(p.id);
  elsif p.stato <> 'attivo' then
    update public.partners set stato = 'attivo', gestore_id = null where id = p.id;
  end if;
  select * into p from public.partners where id = p.id;
  return to_jsonb(p) - 'chiave_hash';
end;
$$;

create or replace function public.nuova_chiave_per(p_partner uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  chiave text := public.nuova_chiave_segreta();
begin
  if auth.uid() is not null and not public.sono_admin() then
    raise exception 'non_autorizzato';
  end if;
  if exists (select 1 from public.partners where id = p_partner and stato = 'gestito' and not is_admin) then
    raise exception 'mai_entrato';
  end if;
  update public.partners set chiave_hash = public.impronta(chiave) where id = p_partner;
  if not found then
    raise exception 'partner_inesistente';
  end if;
  delete from public.accessi where partner_id = p_partner;
  return chiave;
end;
$$;
-- nessuna persona senza app conserva un link personale (la radice dell'installazione sì: entra così la prima volta)
update public.partners set chiave_hash = null where stato = 'gestito' and not is_admin and chiave_hash is not null;

-- ---- Via i vecchi ingressi ----
drop function if exists public.sponsor_da_codice(text);
drop function if exists public.crea_invito_sopra(uuid, uuid[]);
drop function if exists public.iscrivi_con_codice(text, text, date, text, date, integer, integer);
drop function if exists public.link_per_gestito(uuid);
update public.inviti_admin set usato_il = now() where usato_il is null;   -- gli inviti speciali ancora aperti non valgono più

-- ---- Permessi delle funzioni ----
revoke execute on function public.avvisa(uuid, text, text), public.partners_avvisi() from public, anon, authenticated;
revoke execute on function public.crea_invito(text, text), public.annulla_invito(uuid), public.rigenera_invito(uuid),
  public.invito_aperto(text), public.entra_con_invito(text, date, text, date, integer, integer),
  public.entra_con_chiave(text), public.nuova_chiave_per(uuid) from public, anon;
grant execute on function public.crea_invito(text, text), public.annulla_invito(uuid), public.rigenera_invito(uuid),
  public.entra_con_invito(text, date, text, date, integer, integer), public.entra_con_chiave(text),
  public.nuova_chiave_per(uuid) to authenticated;
grant execute on function public.invito_aperto(text) to anon, authenticated;

-- ---- Le notifiche: anche gli avvisi degli eventi (039, 040 + questo) ----
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
