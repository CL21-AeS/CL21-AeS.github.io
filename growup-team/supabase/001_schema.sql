-- ============================================================
-- Growup Team — schema (Fase 1)
-- Si lancia una volta sola nell'SQL editor di Supabase, prima di 002 e 003.
-- I nomi sono in italiano come nel brief; l'albero sta tutto in partners.sponsor_id.
--
-- ACCESSO SENZA EMAIL. Ogni partner ha una CHIAVE segreta che viaggia in un link
-- (…/growup-team/#chiave=…) mandato su WhatsApp o Telegram. Ogni telefono entra in
-- Supabase con un accesso anonimo e, presentando la chiave, viene collegato al profilo
-- (tabella accessi). Nel database c'è solo l'impronta della chiave, mai la chiave.
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
  clienti              int,                  -- i PRIMI N clienti in totale, non nel mese
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

-- Chiave d'accesso: 32 caratteri esadecimali da gen_random_uuid (casualità crittografica).
create or replace function public.nuova_chiave_segreta()
returns text
language sql
volatile
set search_path = public
as $$ select replace(gen_random_uuid()::text, '-', '') $$;

create or replace function public.impronta(p_chiave text)
returns text
language sql
immutable
set search_path = public
as $$ select encode(sha256(convert_to(lower(btrim(p_chiave)), 'UTF8')), 'hex') $$;

-- ---- Partner: un nodo per persona (o per coppia), un solo sponsor ----

create table public.partners (
  id                       uuid primary key default gen_random_uuid(),
  nome                     text not null check (length(btrim(nome)) between 1 and 80),
  email                    text,               -- facoltativa, non serve per entrare
  sponsor_id               uuid references public.partners(id),
  codice_invito            text not null unique default public.nuovo_codice(),
  chiave_hash              text unique,        -- impronta della chiave d'accesso
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

-- ---- Accessi: quali telefoni (utenti anonimi di Supabase) entrano in quale profilo ----
-- Più telefoni per lo stesso profilo: Stefano e Alessia, o lo stesso partner su telefono e computer.

create table public.accessi (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  partner_id   uuid not null references public.partners(id) on delete cascade,
  creato_il    timestamptz not null default now()
);
create index accessi_partner_idx on public.accessi (partner_id);

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

-- ---- Obiettivi: contatti e piani a settimana (lunedì), fatturato a mese ----

create table public.goals (
  partner_id          uuid not null references public.partners(id) on delete cascade,
  settimana           date not null check (extract(isodow from settimana) = 1),
  obiettivo_contatti  int not null default 0 check (obiettivo_contatti between 0 and 1000),
  obiettivo_piani     int not null default 0 check (obiettivo_piani between 0 and 1000),
  aggiornato_il       timestamptz not null default now(),
  primary key (partner_id, settimana)
);

create table public.monthly_goals (
  partner_id     uuid not null references public.partners(id) on delete cascade,
  mese           date not null check (extract(day from mese) = 1),
  obiettivo_vp   numeric(10,2) not null default 0 check (obiettivo_vp between 0 and 100000),
  aggiornato_il  timestamptz not null default now(),
  primary key (partner_id, mese)
);

-- ============================================================
-- Funzioni di supporto (security definer: leggono partners e accessi senza passare
-- dalla RLS, così le policy non si richiamano a vicenda)
-- ============================================================

create or replace function public.my_partner_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select partner_id from public.accessi where user_id = auth.uid()
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

create or replace function public.sono_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.partners where id = public.my_partner_id()), false)
$$;

-- Prima di entrare: il nome di chi ha mandato il link d'invito.
create or replace function public.sponsor_da_codice(p_codice text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select btrim(nome) from public.partners where codice_invito = upper(btrim(p_codice))
$$;

-- Il mio profilo, se questo telefono è già collegato.
create or replace function public.collega_profilo()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(p) - 'chiave_hash' from public.partners p where p.id = public.my_partner_id()
$$;

-- Entrare con la chiave del link personale: collega questo telefono al profilo.
-- Vale anche per i profili creati da altri (Stefano e Alessia all'avvio, i partner
-- gestiti in Fase 3): chi entra con la chiave ne prende possesso e diventa Attivo,
-- con tutto il suo storico, senza duplicati.
create or replace function public.entra_con_chiave(p_chiave text)
returns jsonb
language plpgsql
volatile
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
  if not found then
    raise exception 'chiave_non_valida';
  end if;

  insert into public.accessi (user_id, partner_id) values (uid, p.id)
  on conflict (user_id) do update set partner_id = excluded.partner_id, creato_il = now();

  if p.stato <> 'attivo' then
    update public.partners set stato = 'attivo', gestore_id = null where id = p.id returning * into p;
  end if;
  return to_jsonb(p) - 'chiave_hash';
end;
$$;

-- Primo accesso dal link dello sponsor: crea il profilo agganciato a lui e
-- restituisce, UNA volta sola, la chiave del link personale.
create or replace function public.join_with_code(
  p_codice             text,
  p_nome               text,
  p_data_iscrizione    date,
  p_qualifica          text default null,
  p_qualifica_mese     date default null,
  p_pagamenti          int  default 0
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid     uuid := auth.uid();
  sponsor uuid;
  chiave  text := public.nuova_chiave_segreta();
  p       public.partners;
begin
  if uid is null then
    raise exception 'non_autenticato';
  end if;
  if exists (select 1 from public.accessi where user_id = uid) then
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
     and not exists (select 1 from public.stage_requirements s where s.chiave = p_qualifica) then
    raise exception 'qualifica_non_valida';
  end if;

  insert into public.partners (nome, sponsor_id, stato, chiave_hash, data_iscrizione,
                               qualifica_iniziale, qualifica_iniziale_mese, pagamenti_iniziali,
                               privacy_accettata_il, ultimo_aggiornamento)
  values (btrim(p_nome), sponsor, 'attivo', public.impronta(chiave), p_data_iscrizione,
          p_qualifica, date_trunc('month', p_qualifica_mese)::date, coalesce(p_pagamenti, 0),
          now(), now())
  returning * into p;

  update public.partners set creato_da = p.id where id = p.id returning * into p;
  insert into public.accessi (user_id, partner_id) values (uid, p.id);

  return jsonb_build_object('profilo', to_jsonb(p) - 'chiave_hash', 'chiave', chiave);
end;
$$;

-- Cambiare la propria chiave (link finito in mani sbagliate): il vecchio link smette
-- di funzionare e gli altri telefoni collegati vengono scollegati. Questo resta dentro.
create or replace function public.cambia_chiave()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid    uuid := auth.uid();
  pid    uuid := public.my_partner_id();
  chiave text := public.nuova_chiave_segreta();
begin
  if pid is null then
    raise exception 'non_autenticato';
  end if;
  update public.partners set chiave_hash = public.impronta(chiave) where id = pid;
  delete from public.accessi where partner_id = pid and user_id <> uid;
  return chiave;
end;
$$;

-- Chiave persa: un admin (o l'SQL editor) ne genera una nuova per quel partner e
-- scollega tutti i suoi telefoni. Il nuovo link si manda su WhatsApp o Telegram.
create or replace function public.nuova_chiave_per(p_partner uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  chiave text := public.nuova_chiave_segreta();
begin
  if auth.uid() is not null and not public.sono_admin() then
    raise exception 'non_autorizzato';
  end if;
  update public.partners set chiave_hash = public.impronta(chiave) where id = p_partner;
  if not found then
    raise exception 'partner_inesistente';
  end if;
  delete from public.accessi where partner_id = p_partner;
  return chiave;
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
set search_path = public
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

create or replace function public.obiettivi_mese_prima()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.aggiornato_il := now();
  if tg_op = 'UPDATE' then
    new.partner_id := old.partner_id;
    new.mese := old.mese;
  end if;
  return new;
end;
$$;

create trigger monthly_goals_prima
before insert or update on public.monthly_goals
for each row execute function public.obiettivi_mese_prima();
