-- ============================================================
-- Growup Team — schema (Fase 1)
-- Si lancia una volta sola nell'SQL editor di Supabase, prima di 002 e 003.
-- I nomi sono in italiano come nel brief; l'albero sta tutto in partners.sponsor_id.
-- ============================================================

-- ---- Amministrazione: requisiti delle tappe e impostazioni ----
-- Stefano e Alessia li aggiornano dal Table editor di Supabase, senza toccare il codice.

create table public.stage_requirements (
  ordine               int primary key,
  chiave               text not null unique,
  nome                 text not null,
  percentuale          numeric,              -- 9, 12, 15, 18, 21 (null per le prime tappe)
  vp_personali         numeric not null default 0,
  vp_gruppo            numeric,
  linee                int,                  -- linee frontali richieste
  vp_linea             numeric,              -- VP minimi per ciascuna di quelle linee
  linee_obiettivo      int,                  -- obiettivo CL21 (Argento: 3 linee attive)
  clienti              int,
  giorni_scadenza      int,                  -- solo il primo ordine: 30 giorni dall'iscrizione
  linee_nuove_dal      date,                 -- Path to Bronze: contano le prime linee iscritte da questa data
  pagamenti_max        int,                  -- Foundation e Builder: 12 pagamenti...
  mesi_finestra        int,                  -- ...entro 18 mesi
  guadagno_mese        numeric,              -- dal simulatore di reddito ufficiale Amway
  struttura_calcolo    text,                 -- la struttura con cui è calcolato il guadagno
  descrizione          text
);

create table public.settings (
  chiave  text primary key,
  valore  jsonb not null,
  nota    text
);

-- ---- Codici d'invito: 6 caratteri leggibili, senza 0/O/1/I ----

create or replace function public.nuovo_codice()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c text;
begin
  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    exit when not exists (select 1 from public.partners where codice_invito = c);
  end loop;
  return c;
end;
$$;

-- ---- Partner: un nodo per persona, un solo sponsor ----

create table public.partners (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid unique references auth.users(id) on delete set null,
  nome                     text not null check (length(btrim(nome)) between 1 and 80),
  email                    text,
  sponsor_id               uuid references public.partners(id),
  codice_invito            text not null unique default public.nuovo_codice(),
  stato                    text not null default 'attivo'
                             check (stato in ('attivo','gestito','preso_in_carico')),
  gestore_id               uuid references public.partners(id),
  data_iscrizione          date check (data_iscrizione between date '2000-01-01' and date '2100-01-01'),
  qualifica_iniziale       text references public.stage_requirements(chiave),
  qualifica_iniziale_mese  date,               -- primo giorno del mese della prima qualifica
  pagamenti_iniziali       int not null default 0 check (pagamenti_iniziali between 0 and 12),
  privacy_accettata_il     timestamptz,
  is_admin                 boolean not null default false,
  ultimo_aggiornamento     timestamptz,
  creato_da                uuid references public.partners(id),
  creato_il                timestamptz not null default now(),
  check (sponsor_id is null or sponsor_id <> id)
);
create index partners_sponsor_idx on public.partners (sponsor_id);
create unique index partners_email_idx on public.partners (lower(email)) where email is not null;

-- ---- Attività: i contatti sono numeri, mai anagrafiche ----

create table public.activities (
  id           uuid primary key default gen_random_uuid(),
  partner_id   uuid not null references public.partners(id) on delete cascade,
  tipo         text not null check (tipo in ('contatto','piano','ordine','cliente')),
  quantita     int not null default 1 check (quantita between 1 and 100),
  vp           numeric(10,2) check (vp is null or (vp > 0 and vp <= 100000)),
  data         date not null default (now() at time zone 'Europe/Rome')::date
                 check (data >= date '2020-01-01'),
  inserito_da  uuid references public.partners(id) on delete set null,
  inserito_il  timestamptz not null default now(),
  check ((tipo = 'ordine') = (vp is not null))
);
create index activities_partner_data_idx on public.activities (partner_id, data);

-- ---- Obiettivi settimanali: un record per partner e settimana (lunedì) ----

create table public.goals (
  partner_id          uuid not null references public.partners(id) on delete cascade,
  settimana           date not null check (extract(isodow from settimana) = 1),
  obiettivo_contatti  int not null default 0 check (obiettivo_contatti between 0 and 1000),
  obiettivo_piani     int not null default 0 check (obiettivo_piani between 0 and 1000),
  obiettivo_vp        numeric(10,2) not null default 0 check (obiettivo_vp between 0 and 100000),
  aggiornato_il       timestamptz not null default now(),
  primary key (partner_id, settimana)
);

-- ============================================================
-- Funzioni di supporto (security definer: leggono partners senza passare dalla RLS,
-- così le policy non si richiamano a vicenda)
-- ============================================================

create or replace function public.my_partner_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.partners where user_id = auth.uid()
$$;

-- true se target sono io o sta sotto di me, a qualsiasi profondità.
-- Si sale da target verso la radice: il percorso è uno solo, quindi costa poco.
create or replace function public.is_in_downline(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with recursive su(id, sponsor_id, livello) as (
    select p.id, p.sponsor_id, 0 from public.partners p where p.id = target
    union all
    select p.id, p.sponsor_id, su.livello + 1
    from public.partners p join su on p.id = su.sponsor_id
    where su.livello < 200
  )
  select exists (select 1 from su where su.id = public.my_partner_id())
$$;

-- Prima del login: il nome (solo il primo) di chi ha mandato il link.
create or replace function public.sponsor_da_codice(p_codice text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select split_part(btrim(nome), ' ', 1)
  from public.partners
  where codice_invito = upper(btrim(p_codice))
$$;

-- Dopo il login: il mio profilo. Se esiste un profilo senza account con la mia email
-- (Stefano e Alessia all'avvio, i partner gestiti in Fase 3) lo prendo in possesso:
-- trovo già tutto il mio storico, senza duplicati.
create or replace function public.collega_profilo()
returns public.partners
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid  uuid := auth.uid();
  mail text;
  p    public.partners;
begin
  if uid is null then
    raise exception 'non_autenticato';
  end if;

  select * into p from public.partners where user_id = uid;
  if found then
    return p;
  end if;

  select email into mail from auth.users where id = uid;
  if mail is null then
    return null;
  end if;

  update public.partners
     set user_id = uid,
         stato = 'attivo',
         gestore_id = null
   where user_id is null
     and lower(email) = lower(mail)
  returning * into p;

  if found then
    return p;
  end if;
  return null;
end;
$$;

-- Primo accesso dal link dello sponsor: crea il mio profilo agganciato a lui.
create or replace function public.join_with_code(
  p_codice             text,
  p_nome               text,
  p_data_iscrizione    date,
  p_qualifica          text default null,
  p_qualifica_mese     date default null,
  p_pagamenti          int  default 0
)
returns public.partners
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid     uuid := auth.uid();
  mail    text;
  sponsor uuid;
  nuovi   date;
  p       public.partners;
begin
  if uid is null then
    raise exception 'non_autenticato';
  end if;
  if exists (select 1 from public.partners where user_id = uid) then
    raise exception 'profilo_esistente';
  end if;

  select id into sponsor from public.partners where codice_invito = upper(btrim(p_codice));
  if sponsor is null then
    raise exception 'codice_non_valido';
  end if;

  if p_data_iscrizione is not null and p_data_iscrizione > (now() at time zone 'Europe/Rome')::date then
    raise exception 'data_futura';
  end if;
  if p_qualifica is not null
     and not exists (select 1 from public.stage_requirements where chiave = p_qualifica) then
    raise exception 'qualifica_non_valida';
  end if;

  select email into mail from auth.users where id = uid;

  insert into public.partners (user_id, nome, email, sponsor_id, stato, data_iscrizione,
                               qualifica_iniziale, qualifica_iniziale_mese, pagamenti_iniziali,
                               privacy_accettata_il, ultimo_aggiornamento)
  values (uid, btrim(p_nome), mail, sponsor, 'attivo', p_data_iscrizione,
          p_qualifica, date_trunc('month', p_qualifica_mese)::date, coalesce(p_pagamenti, 0),
          now(), now())
  returning * into p;

  update public.partners set creato_da = p.id where id = p.id returning * into p;
  return p;
end;
$$;

-- ---- Tracciabilità: chi ha scritto il dato lo decide il server, non il telefono ----

create or replace function public.attivita_prima()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.inserito_da := coalesce(public.my_partner_id(), new.inserito_da);
    new.inserito_il := now();
  else
    new.partner_id  := old.partner_id;
    new.inserito_da := old.inserito_da;
    new.inserito_il := old.inserito_il;
  end if;
  return new;
end;
$$;

create trigger activities_prima
before insert or update on public.activities
for each row execute function public.attivita_prima();

-- L'ultimo aggiornamento conta solo quando è il partner stesso a scrivere:
-- è il dato su cui, in Fase 3, scatta la soglia dei 14 giorni.
create or replace function public.attivita_dopo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid := coalesce(new.partner_id, old.partner_id);
begin
  if pid = public.my_partner_id() then
    update public.partners set ultimo_aggiornamento = now() where id = pid;
  end if;
  return null;
end;
$$;

create trigger activities_dopo
after insert or update or delete on public.activities
for each row execute function public.attivita_dopo();

create or replace function public.obiettivi_prima()
returns trigger
language plpgsql
as $$
begin
  new.aggiornato_il := now();
  if tg_op = 'UPDATE' then
    new.partner_id := old.partner_id;
    new.settimana  := old.settimana;
  end if;
  return new;
end;
$$;

create trigger goals_prima
before insert or update on public.goals
for each row execute function public.obiettivi_prima();
