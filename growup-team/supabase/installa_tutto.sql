-- ============================================================
-- Growup Team — INSTALLAZIONE COMPLETA (001 + 002 + 003 + 006 + 007 + 008 + 009 + 010 + 011 + 012 + 013 + 014 in un file solo)
-- Incolla tutto nell'SQL Editor di Supabase e premi Run, una volta sola.
-- Alla fine compaiono DUE LINK: copiali subito (il link personale si vede solo ora).
-- Generato da 001_schema.sql, 002_rls.sql, 003_seed.sql, 006_fase2_calcoli.sql, 007_fase2_gestiti.sql, 008_inserisci_in_mezzo.sql, 009_cancella_e_sposta.sql, 010_etichette.sql, 011_cambia_sponsor_nel_gruppo.sql, 012_preferiti.sql, 013_obiettivo.sql, 014_copia_dati.sql: si modificano quelli.
-- ============================================================

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
  percentuale_iniziale     int check (percentuale_iniziale in (3, 6, 9, 12, 15, 18, 21)),  -- pin raggiunto anche senza qualifica Bronze
  qualifica_iniziale_mese  date,               -- primo giorno del mese della prima qualifica
  pagamenti_iniziali       int not null default 0 check (pagamenti_iniziali between 0 and 12),
  privacy_accettata_il     timestamptz,
  consenso_confermato_il   timestamptz,        -- per chi è aggiunto a mano: lo sponsor conferma di avere il consenso
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
  tipo         text not null check (tipo in ('contatto','piano','ordine','cliente','rettifica')),
  quantita     int not null default 1 check (quantita between 1 and 100),
  vp           numeric(10,2),
  data         date not null default (now() at time zone 'Europe/Rome')::date
                 check (data >= date '2020-01-01'),
  inserito_da  uuid references public.partners(id) on delete set null,
  inserito_il  timestamptz not null default now(),
  -- ordine: VP positivi; rettifica: "aggiorna il totale del mese", la differenza (anche negativa)
  constraint activities_vp_check check (
    (tipo = 'ordine' and vp is not null and vp > 0 and vp <= 100000) or
    (tipo = 'rettifica' and vp is not null and vp <> 0 and vp between -100000 and 100000) or
    (tipo not in ('ordine', 'rettifica') and vp is null))
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
create or replace function public.iscrivi_con_codice(
  p_codice             text,
  p_nome               text,
  p_data_iscrizione    date,
  p_qualifica          text default null,
  p_qualifica_mese     date default null,
  p_pagamenti          int  default 0,
  p_percentuale        int  default null
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
  if p_percentuale is not null and p_percentuale not in (3, 6, 9, 12, 15, 18, 21) then
    raise exception 'percentuale_non_valida';
  end if;

  insert into public.partners (nome, sponsor_id, stato, chiave_hash, data_iscrizione,
                               qualifica_iniziale, percentuale_iniziale, qualifica_iniziale_mese, pagamenti_iniziali,
                               privacy_accettata_il, ultimo_aggiornamento)
  values (btrim(p_nome), sponsor, 'attivo', public.impronta(chiave), p_data_iscrizione,
          p_qualifica, p_percentuale, date_trunc('month', p_qualifica_mese)::date, coalesce(p_pagamenti, 0),
          now(), now())
  returning * into p;

  update public.partners set creato_da = p.id where id = p.id returning * into p;
  insert into public.accessi (user_id, partner_id) values (uid, p.id);

  return jsonb_build_object('profilo', to_jsonb(p) - 'chiave_hash', 'chiave', chiave);
end;
$$;

-- Aggiungere a mano una persona che non usa l'app, sotto di me o sotto chiunque della mia
-- downline. Diventa "gestita": chi la inserisce ne è il gestore. Chi la inserisce conferma
-- di avere il suo consenso (a voce o per messaggio).
create or replace function public.aggiungi_partner(
  p_nome               text,
  p_sponsor            uuid,
  p_data_iscrizione    date default null,
  p_qualifica          text default null,
  p_percentuale        int  default null,
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
  io uuid := public.my_partner_id();
  p  public.partners;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  if p_sponsor is null or not public.is_in_downline(p_sponsor) then
    raise exception 'posizione_non_valida';
  end if;
  if length(btrim(coalesce(p_nome, ''))) = 0 then
    raise exception 'nome_mancante';
  end if;
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

  insert into public.partners (nome, sponsor_id, stato, gestore_id, data_iscrizione,
                               qualifica_iniziale, percentuale_iniziale, qualifica_iniziale_mese,
                               pagamenti_iniziali, consenso_confermato_il, creato_da)
  values (btrim(p_nome), p_sponsor, 'gestito', io, p_data_iscrizione,
          p_qualifica, p_percentuale, date_trunc('month', p_qualifica_mese)::date,
          coalesce(p_pagamenti, 0), now(), io)
  returning * into p;
  return to_jsonb(p) - 'chiave_hash';
end;
$$;

-- Il link personale per una persona aggiunta a mano, da mandarle su WhatsApp o Telegram
-- quando vuole iniziare a usare l'app: aprendolo prende possesso del suo profilo.
-- Lo genera il suo gestore o chiunque le stia sopra. Solo per chi non ha mai usato l'app.
create or replace function public.link_per_gestito(p_partner uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  io     uuid := public.my_partner_id();
  t      public.partners;
  chiave text := public.nuova_chiave_segreta();
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  select * into t from public.partners where id = p_partner;
  if not found or t.stato <> 'gestito' then
    raise exception 'non_gestito';
  end if;
  if not (t.gestore_id = io or (t.id <> io and public.is_in_downline(t.id))) then
    raise exception 'non_autorizzato';
  end if;
  update public.partners set chiave_hash = public.impronta(chiave) where id = p_partner;
  return chiave;
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

-- ============================================================
-- Growup Team — Row Level Security (Fase 1)
-- Il repository è pubblico e la chiave pubblica di Supabase sta nel codice:
-- è sicura SOLO perché ogni tabella qui sotto ha la RLS attiva.
-- Gli accessi anonimi di Supabase hanno il ruolo "authenticated": vedono qualcosa
-- solo dopo che entra_con_chiave o iscrivi_con_codice li ha collegati a un profilo.
-- ============================================================

alter table public.partners           enable row level security;
alter table public.accessi            enable row level security;
alter table public.activities         enable row level security;
alter table public.goals              enable row level security;
alter table public.monthly_goals      enable row level security;
alter table public.stage_requirements enable row level security;
alter table public.settings           enable row level security;

-- ---- Permessi di base: chi non è collegato a un profilo non legge niente ----

revoke all on public.partners, public.accessi, public.activities, public.goals, public.monthly_goals,
              public.stage_requirements, public.settings from anon, authenticated;

grant select on public.stage_requirements, public.settings to authenticated;
grant insert, update, delete on public.stage_requirements, public.settings to authenticated; -- filtrati dalle policy admin

-- Sul profilo si possono cambiare solo i campi propri: sponsor, stato, gestore,
-- chiave, admin e codice d'invito non si toccano dal telefono.
grant select (id, nome, email, sponsor_id, codice_invito, stato, gestore_id, data_iscrizione,
              qualifica_iniziale, percentuale_iniziale, qualifica_iniziale_mese, pagamenti_iniziali,
              privacy_accettata_il, consenso_confermato_il, is_admin, ultimo_aggiornamento, creato_da, creato_il)
  on public.partners to authenticated;                      -- chiave_hash resta fuori
grant update (nome, email, data_iscrizione, qualifica_iniziale, percentuale_iniziale, qualifica_iniziale_mese,
              pagamenti_iniziali, privacy_accettata_il)
  on public.partners to authenticated;

-- accessi: nessun permesso diretto, si passa solo dalle funzioni.

grant select, delete on public.activities to authenticated;
grant insert (partner_id, tipo, quantita, vp, data) on public.activities to authenticated;
grant update (quantita, vp, data) on public.activities to authenticated;

-- partner_id, settimana e mese servono all'upsert dell'app; i trigger li bloccano comunque.
grant select, delete on public.goals, public.monthly_goals to authenticated;
grant insert (partner_id, settimana, obiettivo_contatti, obiettivo_piani) on public.goals to authenticated;
grant update (partner_id, settimana, obiettivo_contatti, obiettivo_piani) on public.goals to authenticated;
grant insert (partner_id, mese, obiettivo_vp) on public.monthly_goals to authenticated;
grant update (partner_id, mese, obiettivo_vp) on public.monthly_goals to authenticated;

-- ---- Funzioni ----

revoke execute on function public.my_partner_id(), public.is_in_downline(uuid), public.sono_admin(),
  public.collega_profilo(), public.entra_con_chiave(text),
  public.iscrivi_con_codice(text, text, date, text, date, int, int),
  public.aggiungi_partner(text, uuid, date, text, int, date, int), public.link_per_gestito(uuid),
  public.cambia_chiave(), public.nuova_chiave_per(uuid),
  public.sponsor_da_codice(text), public.nuovo_codice(), public.nuova_chiave_segreta(), public.impronta(text)
  from public, anon, authenticated;

-- le funzioni dei trigger girano da sole: nessuno le chiama a mano
revoke execute on function public.attivita_prima(), public.attivita_dopo(),
  public.obiettivi_prima(), public.obiettivi_mese_prima()
  from public, anon, authenticated;

grant execute on function public.sponsor_da_codice(text) to anon, authenticated;
grant execute on function public.my_partner_id(), public.is_in_downline(uuid), public.sono_admin(),
  public.collega_profilo(), public.entra_con_chiave(text),
  public.iscrivi_con_codice(text, text, date, text, date, int, int),
  public.aggiungi_partner(text, uuid, date, text, int, date, int), public.link_per_gestito(uuid),
  public.cambia_chiave(), public.nuova_chiave_per(uuid)
  to authenticated;

-- ---- partners: io e la mia downline, a qualsiasi profondità. Mai chi sta sopra. ----

create policy partners_leggo_me_e_downline on public.partners
  for select to authenticated
  using (public.is_in_downline(id));

create policy partners_modifico_me on public.partners
  for update to authenticated
  using (id = public.my_partner_id())
  with check (id = public.my_partner_id());
-- Nessuna policy di insert/delete: il profilo nasce solo da iscrivi_con_codice.

-- ---- activities: scrivo solo le mie; leggo le mie e quelle della mia downline ----

create policy activities_leggo on public.activities
  for select to authenticated
  using (public.is_in_downline(partner_id));

create policy activities_inserisco_mie on public.activities
  for insert to authenticated
  with check (partner_id = public.my_partner_id());

create policy activities_modifico_mie on public.activities
  for update to authenticated
  using (partner_id = public.my_partner_id())
  with check (partner_id = public.my_partner_id());

create policy activities_cancello_mie on public.activities
  for delete to authenticated
  using (partner_id = public.my_partner_id());

-- ---- goals e monthly_goals: come le attività ----

create policy goals_leggo on public.goals
  for select to authenticated using (public.is_in_downline(partner_id));
create policy goals_inserisco_miei on public.goals
  for insert to authenticated with check (partner_id = public.my_partner_id());
create policy goals_modifico_miei on public.goals
  for update to authenticated
  using (partner_id = public.my_partner_id()) with check (partner_id = public.my_partner_id());
create policy goals_cancello_miei on public.goals
  for delete to authenticated using (partner_id = public.my_partner_id());

create policy mgoals_leggo on public.monthly_goals
  for select to authenticated using (public.is_in_downline(partner_id));
create policy mgoals_inserisco_miei on public.monthly_goals
  for insert to authenticated with check (partner_id = public.my_partner_id());
create policy mgoals_modifico_miei on public.monthly_goals
  for update to authenticated
  using (partner_id = public.my_partner_id()) with check (partner_id = public.my_partner_id());
create policy mgoals_cancello_miei on public.monthly_goals
  for delete to authenticated using (partner_id = public.my_partner_id());

-- ---- Amministrazione: tutti leggono, solo gli admin scrivono ----

create policy stage_leggo on public.stage_requirements
  for select to authenticated using (true);
create policy stage_admin_ins on public.stage_requirements
  for insert to authenticated with check (public.sono_admin());
create policy stage_admin_upd on public.stage_requirements
  for update to authenticated using (public.sono_admin()) with check (public.sono_admin());
create policy stage_admin_del on public.stage_requirements
  for delete to authenticated using (public.sono_admin());

create policy settings_leggo on public.settings
  for select to authenticated using (true);
create policy settings_admin_ins on public.settings
  for insert to authenticated with check (public.sono_admin());
create policy settings_admin_upd on public.settings
  for update to authenticated using (public.sono_admin()) with check (public.sono_admin());
create policy settings_admin_del on public.settings
  for delete to authenticated using (public.sono_admin());

-- ============================================================
-- Growup Team — 006: Fase 2, blocco 1 — i calcoli del mese
-- Si lancia dopo 001, 002 e 003 (anche in un'installazione da zero).
--   - percent_levels: le soglie delle percentuali (amministrazione)
--   - calcola_mese: VP personali e di gruppo, linee attive, percentuale e qualifica
--     di un partner e di tutta la sua downline, per un mese
--   - riepilogo_mese: lo stesso per "io e la mia downline", dal vivo o dai totali congelati
--   - monthly_totals + chiudi_mese: lo storico, congelato il giorno 5 del mese successivo
--   - mese aperto: si registra solo nel mese in corso e, fino al giorno 5, nel precedente
-- ============================================================

-- ---- Soglie delle percentuali: VP di gruppo nel mese (Stefano, 15 ottobre 2026) ----

create table public.percent_levels (
  percentuale  int primary key check (percentuale between 1 and 30),
  vp_gruppo    numeric not null check (vp_gruppo >= 0)
);
insert into public.percent_levels (percentuale, vp_gruppo) values
  (3, 200), (6, 600), (9, 1200), (12, 2400), (15, 4000), (18, 7000), (21, 10000);

insert into public.settings (chiave, valore, nota) values
  ('chiusura_mese_giorno', '5',
   'Fino a questo giorno del mese si possono ancora correggere i numeri del mese precedente; poi il mese viene congelato')
on conflict (chiave) do nothing;

-- ---- Storico: i totali di ogni mese chiuso, per partner ----

create table public.monthly_totals (
  partner_id    uuid not null references public.partners(id) on delete cascade,
  mese          date not null check (extract(day from mese) = 1),
  vp_personali  numeric(12,2) not null default 0,
  vp_gruppo     numeric(12,2) not null default 0,
  linee_attive  int not null default 0,
  percentuale   int,
  qualifica     text references public.stage_requirements(chiave),
  chiuso_il     timestamptz not null default now(),
  primary key (partner_id, mese)
);

-- ---- Il calcolo: un sottoalbero, un mese ----
-- Per ogni partner del sottoalbero di p_radice: VP personali (ordini + rettifiche del mese),
-- VP di gruppo (i suoi più quelli di tutta la sua downline), linee attive (prime linee con
-- almeno "soglia_linea_attiva" VP di gruppo), percentuale (soglia più alta raggiunta con i VP
-- di gruppo) e qualifica (la tappa più alta, dal Path to Bronze in su, con tutti i requisiti
-- soddisfatti nel mese). Percentuale e qualifica sono distinte: si può avere il 9% senza
-- essere Bronze Foundation.
create or replace function public.calcola_mese(p_mese date, p_radice uuid)
returns table (partner_id uuid, sponsor_id uuid, vp_personali numeric, vp_gruppo numeric,
               linee_attive int, percentuale int, qualifica text)
language sql
stable
security definer
set search_path = public
as $$
  with recursive
  albero(id, sponsor_id) as (
    select p.id, p.sponsor_id from public.partners p where p.id = p_radice
    union all
    select p.id, p.sponsor_id from public.partners p join albero a on p.sponsor_id = a.id
  ),
  -- ogni partner con sé stesso e tutti i suoi discendenti
  sotto(antenato, discendente) as (
    select id, id from albero
    union all
    select s.antenato, a.id from sotto s join albero a on a.sponsor_id = s.discendente
  ),
  personali as (
    select a.id, a.sponsor_id,
           coalesce((select sum(x.vp) from public.activities x
                      where x.partner_id = a.id and x.tipo in ('ordine', 'rettifica')
                        and x.data >= date_trunc('month', p_mese)::date
                        and x.data < (date_trunc('month', p_mese) + interval '1 month')::date), 0) as vp
    from albero a
  ),
  gruppo as (
    select s.antenato as id, sum(p.vp) as vp
    from sotto s join personali p on p.id = s.discendente
    group by s.antenato
  ),
  soglia as (
    select coalesce((select (valore #>> '{}')::numeric from public.settings where chiave = 'soglia_linea_attiva'), 100) as v
  ),
  base as (
    select p.id, p.sponsor_id, p.vp as vp_personali, g.vp as vp_gruppo
    from personali p join gruppo g on g.id = p.id
  )
  select b.id, b.sponsor_id, b.vp_personali, b.vp_gruppo,
         (select count(*)::int from base f, soglia where f.sponsor_id = b.id and f.vp_gruppo >= soglia.v),
         (select max(l.percentuale) from public.percent_levels l where l.vp_gruppo <= b.vp_gruppo),
         (select s.chiave from public.stage_requirements s, soglia
           where s.ordine >= 3
             and b.vp_personali >= s.vp_personali
             and (s.vp_gruppo is null or b.vp_gruppo >= s.vp_gruppo)
             and (s.linee is null or
                  (select count(*) from base f where f.sponsor_id = b.id
                     and f.vp_gruppo >= coalesce(s.vp_linea, soglia.v)) >= s.linee)
           order by s.ordine desc limit 1)
  from base b
$$;

-- ---- Io e la mia downline, per un mese: congelato se il mese è chiuso, dal vivo altrimenti ----

create or replace function public.riepilogo_mese(p_mese date)
returns table (partner_id uuid, sponsor_id uuid, vp_personali numeric, vp_gruppo numeric,
               linee_attive int, percentuale int, qualifica text, chiuso boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  io uuid := public.my_partner_id();
  m  date := date_trunc('month', p_mese)::date;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  if exists (select 1 from public.monthly_totals t where t.partner_id = io and t.mese = m) then
    return query
      select t.partner_id, p.sponsor_id, t.vp_personali, t.vp_gruppo, t.linee_attive,
             t.percentuale, t.qualifica, true
      from public.monthly_totals t join public.partners p on p.id = t.partner_id
      where t.mese = m and public.is_in_downline(t.partner_id);
  else
    return query
      select c.partner_id, c.sponsor_id, c.vp_personali, c.vp_gruppo, c.linee_attive,
             c.percentuale, c.qualifica, false
      from public.calcola_mese(m, io) c;
  end if;
end;
$$;

-- ---- Chiusura del mese: congela i totali di tutti (la lancia l'attività pianificata) ----

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
  insert into public.monthly_totals (partner_id, mese, vp_personali, vp_gruppo, linee_attive, percentuale, qualifica)
  select c.partner_id, m, c.vp_personali, c.vp_gruppo, c.linee_attive, c.percentuale, c.qualifica
  from public.partners r
  cross join lateral public.calcola_mese(m, r.id) c
  where r.sponsor_id is null
  on conflict (partner_id, mese) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---- Mese aperto: si registra solo nel mese in corso e, fino al giorno di chiusura, nel precedente ----

create or replace function public.mese_aperto(p_data date)
returns boolean
language sql
stable
set search_path = public
as $$
  with oggi as (select (now() at time zone 'Europe/Rome')::date as d),
       giorno as (select coalesce((select (valore #>> '{}')::int from public.settings
                                    where chiave = 'chiusura_mese_giorno'), 5) as g)
  select p_data <= oggi.d
     and (date_trunc('month', p_data) = date_trunc('month', oggi.d)
          or (date_trunc('month', p_data) = date_trunc('month', oggi.d) - interval '1 month'
              and extract(day from oggi.d) <= giorno.g))
  from oggi, giorno
$$;

create or replace function public.attivita_mese_aperto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- l'amministratore del database (attività pianificate, correzioni dall'SQL editor) non ha limiti
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  if tg_op in ('UPDATE', 'DELETE') and not public.mese_aperto(old.data) then
    raise exception 'mese_chiuso';
  end if;
  if tg_op in ('INSERT', 'UPDATE') and not public.mese_aperto(new.data) then
    raise exception 'mese_chiuso';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger activities_mese_aperto
before insert or update or delete on public.activities
for each row execute function public.attivita_mese_aperto();

-- ---- Permessi ----

alter table public.percent_levels enable row level security;
alter table public.monthly_totals enable row level security;
revoke all on public.percent_levels, public.monthly_totals from anon, authenticated;

grant select on public.percent_levels to authenticated;
grant insert, update, delete on public.percent_levels to authenticated;   -- filtrati dalle policy admin
create policy livelli_leggo on public.percent_levels for select to authenticated using (true);
create policy livelli_admin_ins on public.percent_levels for insert to authenticated with check (public.sono_admin());
create policy livelli_admin_upd on public.percent_levels for update to authenticated
  using (public.sono_admin()) with check (public.sono_admin());
create policy livelli_admin_del on public.percent_levels for delete to authenticated using (public.sono_admin());

-- lo storico si legge (io e la mia downline) ma non si scrive dal telefono
grant select on public.monthly_totals to authenticated;
create policy totali_leggo on public.monthly_totals for select to authenticated
  using (public.is_in_downline(partner_id));

revoke execute on function public.calcola_mese(date, uuid), public.riepilogo_mese(date),
  public.chiudi_mese(date), public.mese_aperto(date), public.attivita_mese_aperto()
  from public, anon, authenticated;
grant execute on function public.riepilogo_mese(date), public.mese_aperto(date) to authenticated;

-- ============================================================
-- Growup Team — 007: Fase 2, blocco 2 — partner senza app e conferma del punto di partenza
-- Si lancia dopo 006 (anche in un'installazione da zero).
--   - chi non usa l'app (stato "gestito"): i suoi numeri li inseriscono chi l'ha aggiunto e
--     tutta la sua upline; appena prende possesso del profilo (stato "attivo") nessun upline
--     scrive più per lui
--   - punto di partenza (qualifica e pin dichiarati all'ingresso): lo conferma o lo corregge
--     lo sponsor, o chiunque gli stia sopra
-- ============================================================

-- ---- Chi può scrivere per un altro: solo per i partner gestiti della mia downline ----

create or replace function public.posso_gestire(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.partners p
    where p.id = target
      and p.stato = 'gestito'
      and p.id <> coalesce(public.my_partner_id(), '00000000-0000-0000-0000-000000000000'::uuid)
      and public.is_in_downline(p.id)
  )
$$;

alter policy activities_inserisco_mie on public.activities
  with check (partner_id = public.my_partner_id() or public.posso_gestire(partner_id));
alter policy activities_modifico_mie on public.activities
  using (partner_id = public.my_partner_id() or public.posso_gestire(partner_id))
  with check (partner_id = public.my_partner_id() or public.posso_gestire(partner_id));
alter policy activities_cancello_mie on public.activities
  using (partner_id = public.my_partner_id() or public.posso_gestire(partner_id));

alter policy goals_inserisco_miei on public.goals
  with check (partner_id = public.my_partner_id() or public.posso_gestire(partner_id));
alter policy goals_modifico_miei on public.goals
  using (partner_id = public.my_partner_id() or public.posso_gestire(partner_id))
  with check (partner_id = public.my_partner_id() or public.posso_gestire(partner_id));
alter policy goals_cancello_miei on public.goals
  using (partner_id = public.my_partner_id() or public.posso_gestire(partner_id));

alter policy mgoals_inserisco_miei on public.monthly_goals
  with check (partner_id = public.my_partner_id() or public.posso_gestire(partner_id));
alter policy mgoals_modifico_miei on public.monthly_goals
  using (partner_id = public.my_partner_id() or public.posso_gestire(partner_id))
  with check (partner_id = public.my_partner_id() or public.posso_gestire(partner_id));
alter policy mgoals_cancello_miei on public.monthly_goals
  using (partner_id = public.my_partner_id() or public.posso_gestire(partner_id));

-- ---- Conferma del punto di partenza ----

alter table public.partners
  add column if not exists partenza_confermata_il timestamptz,
  add column if not exists partenza_confermata_da uuid references public.partners(id) on delete set null;

-- Non c'è niente da confermare per chi parte da zero, per la radice e per chi è stato
-- aggiunto a mano (l'ha inserito la sua upline).
create or replace function public.partenza_da_confermare()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.partenza_confermata_il is null
     and ((new.qualifica_iniziale is null and new.percentuale_iniziale is null)
          or new.sponsor_id is null or new.stato = 'gestito') then
    new.partenza_confermata_il := now();
    if new.stato = 'gestito' then new.partenza_confermata_da := new.creato_da; end if;
  end if;
  return new;
end;
$$;

create trigger partners_partenza
before insert on public.partners
for each row execute function public.partenza_da_confermare();

update public.partners
   set partenza_confermata_il = coalesce(partenza_confermata_il, creato_il)
 where partenza_confermata_il is null
   and ((qualifica_iniziale is null and percentuale_iniziale is null) or sponsor_id is null or stato = 'gestito');

-- Lo sponsor (o chi sta sopra) conferma o corregge il punto di partenza dichiarato.
create or replace function public.conferma_partenza(
  p_partner          uuid,
  p_qualifica        text default null,
  p_percentuale      int  default null,
  p_qualifica_mese   date default null,
  p_pagamenti        int  default 0
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  io uuid := public.my_partner_id();
  p  public.partners;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  if p_partner = io or not public.is_in_downline(p_partner) then
    raise exception 'non_autorizzato';
  end if;
  if p_qualifica is not null
     and not exists (select 1 from public.stage_requirements s where s.chiave = p_qualifica) then
    raise exception 'qualifica_non_valida';
  end if;
  if p_percentuale is not null and p_percentuale not in (3, 6, 9, 12, 15, 18, 21) then
    raise exception 'percentuale_non_valida';
  end if;
  update public.partners
     set qualifica_iniziale = p_qualifica,
         percentuale_iniziale = p_percentuale,
         qualifica_iniziale_mese = date_trunc('month', p_qualifica_mese)::date,
         pagamenti_iniziali = coalesce(p_pagamenti, 0),
         partenza_confermata_il = now(),
         partenza_confermata_da = io
   where id = p_partner
  returning * into p;
  return to_jsonb(p) - 'chiave_hash';
end;
$$;

-- ---- Permessi ----

grant select (partenza_confermata_il, partenza_confermata_da) on public.partners to authenticated;

revoke execute on function public.posso_gestire(uuid), public.conferma_partenza(uuid, text, int, date, int),
  public.partenza_da_confermare() from public, anon, authenticated;
grant execute on function public.posso_gestire(uuid), public.conferma_partenza(uuid, text, int, date, int)
  to authenticated;

-- ============================================================
-- Growup Team — 008: inserire una persona "in mezzo" alla linea
-- Esempio: nell'app risulta Anna → Giulia, ma lo sponsor vero di Giulia è Paolo, che manca.
-- Si crea Paolo (senza app, gestito da chi lo inserisce) sotto Anna e si spostano sotto di lui
-- Giulia ed eventualmente altri che stavano sotto Anna, con tutto il loro gruppo.
-- Lo può fare chi sta sopra quel punto della linea. Lo storico dei mesi chiusi non cambia.
-- ============================================================

create or replace function public.inserisci_in_mezzo(
  p_nome               text,
  p_sotto              uuid[],
  p_data_iscrizione    date default null,
  p_qualifica          text default null,
  p_percentuale        int  default null,
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
  io      uuid := public.my_partner_id();
  sponsor uuid;
  quanti  int;
  p       public.partners;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  if length(btrim(coalesce(p_nome, ''))) = 0 then
    raise exception 'nome_mancante';
  end if;
  if p_sotto is null or cardinality(p_sotto) = 0 then
    raise exception 'posizione_non_valida';
  end if;
  -- tutti devono avere lo stesso sponsor, e quello sponsor devo essere io o qualcuno del mio gruppo
  select count(distinct x.sponsor_id), min(x.sponsor_id::text)::uuid into quanti, sponsor
    from public.partners x where x.id = any(p_sotto);
  if quanti <> 1 or sponsor is null or (select count(*) from public.partners x where x.id = any(p_sotto)) <> cardinality(p_sotto)
     or io = any(p_sotto) or not public.is_in_downline(sponsor) then
    raise exception 'posizione_non_valida';
  end if;
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

  insert into public.partners (nome, sponsor_id, stato, gestore_id, data_iscrizione,
                               qualifica_iniziale, percentuale_iniziale, qualifica_iniziale_mese,
                               pagamenti_iniziali, consenso_confermato_il, creato_da)
  values (btrim(p_nome), sponsor, 'gestito', io, p_data_iscrizione,
          p_qualifica, p_percentuale, date_trunc('month', p_qualifica_mese)::date,
          coalesce(p_pagamenti, 0), now(), io)
  returning * into p;

  update public.partners set sponsor_id = p.id where id = any(p_sotto);
  return to_jsonb(p) - 'chiave_hash';
end;
$$;

revoke execute on function public.inserisci_in_mezzo(text, uuid[], date, text, int, date, int) from public, anon, authenticated;
grant execute on function public.inserisci_in_mezzo(text, uuid[], date, text, int, date, int) to authenticated;

-- ============================================================
-- Growup Team — 009: cancellare una persona e cambiare sponsor
--   - cancella_partner: per i codici che Amway cancella a fine anno (o una richiesta di
--     cancellazione dei dati). Lo fanno lo sponsor e tutta l'upline. Chi stava sotto la
--     persona cancellata sale al suo sponsor, con tutto il suo gruppo; i dati della persona
--     (attività, obiettivi, storico, telefoni collegati) vengono cancellati con lei.
--   - cambia_sponsor: sposta una persona (con tutto il suo gruppo) sotto un altro sponsor.
--     Solo Stefano e Alessia (admin).
-- ============================================================

create or replace function public.cancella_partner(p_partner uuid)
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  io    uuid := public.my_partner_id();
  t     public.partners;
  saliti int;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  select * into t from public.partners where id = p_partner;
  if not found then
    raise exception 'partner_inesistente';
  end if;
  if t.sponsor_id is null or t.id = io or not public.is_in_downline(t.id) then
    raise exception 'non_autorizzato';
  end if;

  -- chi stava sotto sale al suo sponsor
  update public.partners set sponsor_id = t.sponsor_id where sponsor_id = t.id;
  get diagnostics saliti = row_count;
  -- i riferimenti alla persona cancellata passano a chi cancella o si svuotano
  update public.partners set gestore_id = io where gestore_id = t.id;
  update public.partners set creato_da = null where creato_da = t.id;

  delete from public.partners where id = t.id;
  return saliti;
end;
$$;

create or replace function public.cambia_sponsor(p_partner uuid, p_sponsor uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  p public.partners;
begin
  if not public.sono_admin() then
    raise exception 'non_autorizzato';
  end if;
  if p_partner = p_sponsor
     or not exists (select 1 from public.partners where id = p_sponsor)
     or (select sponsor_id from public.partners where id = p_partner) is null then
    raise exception 'posizione_non_valida';
  end if;
  -- il nuovo sponsor non può stare nel gruppo della persona che sposto
  if exists (
    with recursive su(id, sponsor_id, livello) as (
      select x.id, x.sponsor_id, 0 from public.partners x where x.id = p_sponsor
      union all
      select x.id, x.sponsor_id, su.livello + 1 from public.partners x join su on x.id = su.sponsor_id
      where su.livello < 200
    )
    select 1 from su where su.id = p_partner
  ) then
    raise exception 'posizione_non_valida';
  end if;

  update public.partners set sponsor_id = p_sponsor where id = p_partner returning * into p;
  return to_jsonb(p) - 'chiave_hash';
end;
$$;

revoke execute on function public.cancella_partner(uuid), public.cambia_sponsor(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cancella_partner(uuid), public.cambia_sponsor(uuid, uuid) to authenticated;

-- ============================================================
-- Growup Team — 011: cambiare sponsor anche verso qualcuno del proprio gruppo
-- Caso: per errore Marco risulta sopra Luca, ma è Luca lo sponsor di Marco.
-- "Metti Marco sotto Luca": Luca (con il suo gruppo) sale al posto di Marco, sotto lo sponsor
-- di Marco; poi Marco (con il resto del suo gruppo) passa sotto Luca. Niente giri.
-- Resta solo per Stefano e Alessia (admin). Sostituisce la funzione di 009.
-- ============================================================

create or replace function public.cambia_sponsor(p_partner uuid, p_sponsor uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  p          public.partners;
  vecchio    uuid;
begin
  if not public.sono_admin() then
    raise exception 'non_autorizzato';
  end if;
  select sponsor_id into vecchio from public.partners where id = p_partner;
  if p_partner = p_sponsor
     or not exists (select 1 from public.partners where id = p_sponsor)
     or vecchio is null then
    raise exception 'posizione_non_valida';
  end if;
  -- il nuovo sponsor sta nel gruppo della persona che sposto: prima sale lui al suo posto
  if exists (
    with recursive su(id, sponsor_id, livello) as (
      select x.id, x.sponsor_id, 0 from public.partners x where x.id = p_sponsor
      union all
      select x.id, x.sponsor_id, su.livello + 1 from public.partners x join su on x.id = su.sponsor_id
      where su.livello < 200
    )
    select 1 from su where su.id = p_partner
  ) then
    update public.partners set sponsor_id = vecchio where id = p_sponsor;
  end if;

  update public.partners set sponsor_id = p_sponsor where id = p_partner returning * into p;
  return to_jsonb(p) - 'chiave_hash';
end;
$$;

revoke execute on function public.cambia_sponsor(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cambia_sponsor(uuid, uuid) to authenticated;

-- ============================================================
-- Growup Team — 012: preferiti
-- Ognuno segna come preferite alcune persone del proprio gruppo, per seguirle da vicino: compaiono nella
-- sezione "Preferiti" della pagina Gruppo (al posto dell'imbuto). Sono del profilo, quindi uguali su tutti
-- i telefoni collegati (Stefano e Alessia vedono gli stessi). Nessuno vede i preferiti degli altri.
-- ============================================================

create table if not exists public.preferiti (
  partner_id   uuid not null references public.partners(id) on delete cascade,
  preferito_id uuid not null references public.partners(id) on delete cascade,
  creato_il    timestamptz not null default now(),
  primary key (partner_id, preferito_id),
  check (partner_id <> preferito_id)
);

alter table public.preferiti enable row level security;

drop policy if exists preferiti_leggi on public.preferiti;
create policy preferiti_leggi on public.preferiti for select to authenticated
  using (partner_id = public.my_partner_id());

drop policy if exists preferiti_aggiungi on public.preferiti;
create policy preferiti_aggiungi on public.preferiti for insert to authenticated
  with check (partner_id = public.my_partner_id() and preferito_id <> partner_id and public.is_in_downline(preferito_id));

drop policy if exists preferiti_togli on public.preferiti;
create policy preferiti_togli on public.preferiti for delete to authenticated
  using (partner_id = public.my_partner_id());

revoke all on public.preferiti from anon, authenticated;
grant select, insert, delete on public.preferiti to authenticated;

-- ============================================================
-- Growup Team — 013: il primo obiettivo
-- Ogni partner scrive quanto vuole guadagnare al mese, entro quando e perché. L'app traduce la cifra nella
-- prima tappa che la vale (guadagno_mese di stage_requirements) e mostra il percorso per arrivarci.
-- Il "perché" lo vede solo la persona: sponsor e upline leggono cifra e data con obiettivi_gruppo().
-- ============================================================

create table if not exists public.obiettivi (
  partner_id    uuid primary key references public.partners(id) on delete cascade,
  cifra_mese    numeric not null check (cifra_mese > 0 and cifra_mese < 1000000),
  entro         date not null,
  perche        text check (perche is null or length(perche) <= 1000),
  creato_il     timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

alter table public.obiettivi enable row level security;

drop policy if exists obiettivi_leggi on public.obiettivi;
create policy obiettivi_leggi on public.obiettivi for select to authenticated
  using (partner_id = public.my_partner_id());
drop policy if exists obiettivi_scrivi on public.obiettivi;
create policy obiettivi_scrivi on public.obiettivi for insert to authenticated
  with check (partner_id = public.my_partner_id());
drop policy if exists obiettivi_aggiorna on public.obiettivi;
create policy obiettivi_aggiorna on public.obiettivi for update to authenticated
  using (partner_id = public.my_partner_id()) with check (partner_id = public.my_partner_id());

revoke all on public.obiettivi from anon, authenticated;
grant select, insert, update on public.obiettivi to authenticated;

-- sponsor e upline: cifra e data di chi è nel loro gruppo, senza il perché
create or replace function public.obiettivi_gruppo()
returns table (partner_id uuid, cifra_mese numeric, entro date)
language sql
stable
security definer
set search_path = public
as $$
  select o.partner_id, o.cifra_mese, o.entro
  from public.obiettivi o
  where o.partner_id <> public.my_partner_id() and public.is_in_downline(o.partner_id)
$$;

revoke execute on function public.obiettivi_gruppo() from public, anon, authenticated;
grant execute on function public.obiettivi_gruppo() to authenticated;

-- ============================================================
-- Growup Team — 014: copia di sicurezza dei dati
-- Il piano gratuito di Supabase non fa copie automatiche. copia_dati() restituisce in un solo file (JSON)
-- tutte le tabelle dell'app: dall'app, Stefano e Alessia (admin) la scaricano con "Copia dei dati" una volta
-- al mese e la conservano (Google Drive). I collegamenti dei telefoni (accessi) non servono: si rientra con i link.
-- ============================================================

create or replace function public.copia_dati()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.sono_admin() then
    raise exception 'non_autorizzato';
  end if;
  return jsonb_build_object(
    'app', 'Growup Team',
    'creata_il', now(),
    'tabelle', jsonb_build_object(
      'partners',           coalesce((select jsonb_agg(to_jsonb(t) order by t.creato_il) from public.partners t), '[]'),
      'activities',         coalesce((select jsonb_agg(to_jsonb(t)) from public.activities t), '[]'),
      'goals',              coalesce((select jsonb_agg(to_jsonb(t)) from public.goals t), '[]'),
      'monthly_goals',      coalesce((select jsonb_agg(to_jsonb(t)) from public.monthly_goals t), '[]'),
      'monthly_totals',     coalesce((select jsonb_agg(to_jsonb(t)) from public.monthly_totals t), '[]'),
      'obiettivi',          coalesce((select jsonb_agg(to_jsonb(t)) from public.obiettivi t), '[]'),
      'preferiti',          coalesce((select jsonb_agg(to_jsonb(t)) from public.preferiti t), '[]'),
      'settings',           coalesce((select jsonb_agg(to_jsonb(t)) from public.settings t), '[]'),
      'stage_requirements', coalesce((select jsonb_agg(to_jsonb(t) order by t.ordine) from public.stage_requirements t), '[]'),
      'percent_levels',     coalesce((select jsonb_agg(to_jsonb(t)) from public.percent_levels t), '[]')
    )
  );
end;
$$;

revoke execute on function public.copia_dati() from public, anon, authenticated;
grant execute on function public.copia_dati() to authenticated;

-- ============================================================
-- Growup Team — 015: codice Amway Partner e import dei VPP dal report Amway (CSV)
-- Si lancia dopo 014 (anche in un'installazione da zero).
--   - codice_amway: il numero IBO di ogni persona (solo cifre, uno per persona). Chi aggiunge
--     a mano una persona lo scrive (obbligatorio); chi entra dal link d'invito può scriverlo dopo.
--   - imposta_codice_amway: il proprio codice, o quello di una persona senza app che gestisco.
--   - aggiungi_con_codice / inserisci_in_mezzo_con_codice: come aggiungi_partner e
--     inserisci_in_mezzo, con il codice obbligatorio, tutto in un colpo (se il codice è già
--     usato non si crea niente).
--   - importa_vpp: ognuno importa il CSV della propria linea, scaricato dal sito Amway; il file
--     resta sul telefono, arrivano solo persona e VPP. Aggiorna i VPP del mese per me e per le
--     persone senza app che gestisco (posso_gestire): chi usa l'app non viene mai toccato.
--     Registra la differenza come "Aggiorna il totale" (attività rettifica), come a mano.
-- ============================================================

alter table public.partners
  add column if not exists codice_amway text check (codice_amway ~ '^[0-9]{4,12}$');
create unique index if not exists partners_codice_amway_idx on public.partners (codice_amway);

grant select (codice_amway) on public.partners to authenticated;

create or replace function public.imposta_codice_amway(p_partner uuid, p_codice text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  io     uuid := public.my_partner_id();
  codice text := nullif(regexp_replace(coalesce(p_codice, ''), '[^0-9]', '', 'g'), '');
  p      public.partners;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  if p_partner is distinct from io and not public.posso_gestire(p_partner) then
    raise exception 'non_autorizzato';
  end if;
  if codice is not null and codice !~ '^[0-9]{4,12}$' then
    raise exception 'codice_amway_non_valido';
  end if;
  begin
    update public.partners set codice_amway = codice where id = p_partner returning * into p;
  exception when unique_violation then
    raise exception 'codice_amway_usato';
  end;
  return to_jsonb(p) - 'chiave_hash';
end;
$$;

create or replace function public.aggiungi_con_codice(
  p_nome               text,
  p_sponsor            uuid,
  p_codice_amway       text,
  p_data_iscrizione    date default null,
  p_qualifica          text default null,
  p_percentuale        int  default null,
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
  p jsonb;
begin
  if nullif(regexp_replace(coalesce(p_codice_amway, ''), '[^0-9]', '', 'g'), '') is null then
    raise exception 'codice_amway_mancante';
  end if;
  p := public.aggiungi_partner(p_nome, p_sponsor, p_data_iscrizione, p_qualifica, p_percentuale,
                               p_qualifica_mese, p_pagamenti);
  return public.imposta_codice_amway((p->>'id')::uuid, p_codice_amway);
end;
$$;

create or replace function public.inserisci_in_mezzo_con_codice(
  p_nome               text,
  p_sotto              uuid[],
  p_codice_amway       text,
  p_data_iscrizione    date default null,
  p_qualifica          text default null,
  p_percentuale        int  default null,
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
  p jsonb;
begin
  if nullif(regexp_replace(coalesce(p_codice_amway, ''), '[^0-9]', '', 'g'), '') is null then
    raise exception 'codice_amway_mancante';
  end if;
  p := public.inserisci_in_mezzo(p_nome, p_sotto, p_data_iscrizione, p_qualifica, p_percentuale,
                                 p_qualifica_mese, p_pagamenti);
  return public.imposta_codice_amway((p->>'id')::uuid, p_codice_amway);
end;
$$;

-- p_righe: [{ "partner_id": "…", "vpp": 123.45 }, …]. Il mese è quello scritto nel file:
-- il mese in corso, o il precedente fino al giorno di chiusura (dopo è congelato).
-- Reimportare lo stesso mese sostituisce il valore: si registra solo la differenza.
create or replace function public.importa_vpp(p_mese date, p_righe jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  io        uuid := public.my_partner_id();
  mese      date := date_trunc('month', p_mese)::date;
  oggi      date := (now() at time zone 'Europe/Rome')::date;
  giorno    date;
  r         jsonb;
  pid       uuid;
  vpp       numeric;
  attuale   numeric;
  diff      numeric;
  aggiornati int := 0;
  invariati  int := 0;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  if p_mese is null or jsonb_typeof(p_righe) is distinct from 'array' or jsonb_array_length(p_righe) > 5000 then
    raise exception 'import_non_valido';
  end if;
  giorno := case when mese = date_trunc('month', oggi)::date then oggi
                 else (mese + interval '1 month' - interval '1 day')::date end;
  if not public.mese_aperto(giorno) then
    raise exception 'mese_chiuso';
  end if;

  for r in select * from jsonb_array_elements(p_righe) loop
    pid := (r->>'partner_id')::uuid;
    vpp := round((r->>'vpp')::numeric, 2);
    if vpp is null or vpp < 0 or vpp > 100000 then
      raise exception 'import_non_valido';
    end if;
    if pid is distinct from io and not public.posso_gestire(pid) then
      raise exception 'non_autorizzato';
    end if;
    select coalesce(sum(a.vp), 0) into attuale from public.activities a
     where a.partner_id = pid and a.tipo in ('ordine', 'rettifica')
       and a.data >= mese and a.data < (mese + interval '1 month')::date;
    diff := vpp - attuale;
    if diff = 0 then
      invariati := invariati + 1;
    else
      insert into public.activities (partner_id, tipo, vp, data) values (pid, 'rettifica', diff, giorno);
      aggiornati := aggiornati + 1;
    end if;
  end loop;
  return jsonb_build_object('aggiornati', aggiornati, 'invariati', invariati);
end;
$$;

revoke execute on function public.imposta_codice_amway(uuid, text),
  public.aggiungi_con_codice(text, uuid, text, date, text, int, date, int),
  public.inserisci_in_mezzo_con_codice(text, uuid[], text, date, text, int, date, int),
  public.importa_vpp(date, jsonb) from public, anon, authenticated;
grant execute on function public.imposta_codice_amway(uuid, text),
  public.aggiungi_con_codice(text, uuid, text, date, text, int, date, int),
  public.inserisci_in_mezzo_con_codice(text, uuid[], text, date, text, int, date, int),
  public.importa_vpp(date, jsonb) to authenticated;

-- ============================================================
-- Growup Team — 016: la rete dal report Amway (struttura flessibile)
-- Si lancia dopo 015 (anche in un'installazione da zero).
--   - Le persone senza app ("gestito") arrivano solo dall'import del report Amway e le vede
--     SOLO chi le ha importate (gestore_id). Chi usa l'app lo vede tutta la sua upline.
--   - Chi usa l'app sta sempre sotto qualcuno che usa l'app (o la radice): la parte condivisa
--     della struttura è uguale per tutti; ognuno ci aggiunge le proprie persone importate.
--   - Si entra dal link d'invito con il codice Amway obbligatorio: se il codice è già stato
--     importato da qualcuno sopra, si prende quel profilo (diventa "usa l'app").
--   - VP di gruppo, linee e percentuale si calcolano per chi guarda; lo storico si congela
--     per chi guarda (monthly_totals.visto_da).
--   - Niente più inserimenti a mano, "in mezzo", cambia sponsor e link per i gestiti.
--   - Esclusi dell'import (solo codici) e persone nascoste: di ognuno, privati.
-- ============================================================

-- ---- Codici: unici tra chi usa l'app; tra le persone importate, unici per chi le importa ----

drop index if exists public.partners_codice_amway_idx;
create unique index if not exists partners_codice_condiviso_idx on public.partners (codice_amway)
  where stato <> 'gestito';
create unique index if not exists partners_codice_importato_idx on public.partners (gestore_id, codice_amway)
  where stato = 'gestito';

-- ---- Chi vedo: io; chi usa l'app nella mia downline; le persone che ho importato io ----

create or replace function public.vedo(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target = public.my_partner_id()
      or (public.is_in_downline(target)
          and exists (select 1 from public.partners p
                       where p.id = target and (p.stato <> 'gestito' or p.gestore_id = public.my_partner_id())))
$$;

-- Scrivo per un altro solo per le persone senza app che ho importato io.
create or replace function public.posso_gestire(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.partners p
    where p.id = target
      and p.stato = 'gestito'
      and p.gestore_id = public.my_partner_id()
      and p.id <> public.my_partner_id()
  )
$$;

alter policy partners_leggo_me_e_downline on public.partners using (public.vedo(id));
alter policy activities_leggo on public.activities using (public.vedo(partner_id));
alter policy goals_leggo on public.goals using (public.vedo(partner_id));
alter policy mgoals_leggo on public.monthly_goals using (public.vedo(partner_id));
alter policy preferiti_aggiungi on public.preferiti
  with check (partner_id = public.my_partner_id() and preferito_id <> partner_id and public.vedo(preferito_id));

create or replace function public.obiettivi_gruppo()
returns table (partner_id uuid, cifra_mese numeric, entro date)
language sql
stable
security definer
set search_path = public
as $$
  select o.partner_id, o.cifra_mese, o.entro
  from public.obiettivi o
  where o.partner_id <> public.my_partner_id() and public.vedo(o.partner_id)
$$;

-- ---- Il primo antenato che usa l'app (o la radice) ----

create or replace function public.antenato_con_app(p_partner uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  with recursive su(id, sponsor_id, stato, livello) as (
    select p.id, p.sponsor_id, p.stato, 0 from public.partners p
     where p.id = (select sponsor_id from public.partners where id = p_partner)
    union all
    select p.id, p.sponsor_id, p.stato, su.livello + 1
    from public.partners p join su on p.id = su.sponsor_id
    where su.stato = 'gestito' and su.livello < 200
  )
  select id from su where stato <> 'gestito' or sponsor_id is null order by livello limit 1
$$;

-- Un profilo importato diventa "usa l'app": sale sotto il primo antenato che usa l'app;
-- le copie dello stesso codice importate da altri spariscono e le loro persone passano sotto di lui.
create or replace function public.diventa_attivo(p_partner uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  t public.partners;
  c record;
begin
  select * into t from public.partners where id = p_partner;
  if t.stato <> 'gestito' then
    return;
  end if;
  if t.codice_amway is not null then
    for c in select id from public.partners
              where stato = 'gestito' and codice_amway = t.codice_amway and id <> t.id loop
      update public.partners set sponsor_id = t.id where sponsor_id = c.id;
      update public.partners set gestore_id = null where gestore_id = c.id;
      delete from public.partners where id = c.id;
    end loop;
  end if;
  begin
    update public.partners
       set stato = 'attivo', gestore_id = null,
           sponsor_id = coalesce(public.antenato_con_app(t.id), t.sponsor_id)
     where id = t.id;
  exception when unique_violation then
    raise exception 'codice_amway_attivo';
  end;
end;
$$;

-- Quanti livelli sopra una persona (la radice è 0): tra più copie importate vale quella di chi è più vicino.
create or replace function public.profondita(p_partner uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  with recursive su(id, sponsor_id, livello) as (
    select p.id, p.sponsor_id, 0 from public.partners p where p.id = p_partner
    union all
    select p.id, p.sponsor_id, su.livello + 1 from public.partners p join su on p.id = su.sponsor_id
    where su.livello < 200
  )
  select coalesce(max(livello), 0) from su
$$;

-- ---- Si entra dal link d'invito, con il codice Amway obbligatorio ----

create or replace function public.entra_con_invito(
  p_codice             text,
  p_nome               text,
  p_codice_amway       text,
  p_data_iscrizione    date default null,
  p_qualifica          text default null,
  p_qualifica_mese     date default null,
  p_pagamenti          int  default 0,
  p_percentuale        int  default null
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
  codice  text := nullif(regexp_replace(coalesce(p_codice_amway, ''), '[^0-9]', '', 'g'), '');
  chiave  text := public.nuova_chiave_segreta();
  copia   uuid;
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
  if length(btrim(coalesce(p_nome, ''))) = 0 then
    raise exception 'nome_mancante';
  end if;
  if codice is null then
    raise exception 'codice_amway_mancante';
  end if;
  if codice !~ '^[0-9]{4,12}$' then
    raise exception 'codice_amway_non_valido';
  end if;
  if exists (select 1 from public.partners where codice_amway = codice and stato <> 'gestito') then
    raise exception 'codice_amway_attivo';
  end if;
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

  -- il codice è già stato importato: si prende il profilo, solo se chi invita gli sta sopra
  if exists (select 1 from public.partners where codice_amway = codice and stato = 'gestito') then
    select x.id into copia from public.partners x
     where x.codice_amway = codice and x.stato = 'gestito'
       and exists (
         with recursive su(id, sponsor_id, livello) as (
           select y.id, y.sponsor_id, 0 from public.partners y where y.id = x.sponsor_id
           union all
           select y.id, y.sponsor_id, su.livello + 1 from public.partners y join su on y.id = su.sponsor_id
           where su.livello < 200
         )
         select 1 from su where su.id = sponsor)
     order by (x.gestore_id = sponsor) desc, public.profondita(x.gestore_id) desc, x.creato_il, x.id
     limit 1;
    if copia is null then
      raise exception 'codice_amway_altra_linea';
    end if;
    update public.partners
       set nome = btrim(p_nome), chiave_hash = public.impronta(chiave), data_iscrizione = p_data_iscrizione,
           qualifica_iniziale = p_qualifica, percentuale_iniziale = p_percentuale,
           qualifica_iniziale_mese = date_trunc('month', p_qualifica_mese)::date,
           pagamenti_iniziali = coalesce(p_pagamenti, 0), privacy_accettata_il = now(), ultimo_aggiornamento = now(),
           partenza_confermata_il = case when p_qualifica is null and p_percentuale is null then now() end,
           partenza_confermata_da = null
     where id = copia;
    perform public.diventa_attivo(copia);
    select * into p from public.partners where id = copia;
  else
    insert into public.partners (nome, sponsor_id, stato, chiave_hash, codice_amway, data_iscrizione,
                                 qualifica_iniziale, percentuale_iniziale, qualifica_iniziale_mese, pagamenti_iniziali,
                                 privacy_accettata_il, ultimo_aggiornamento)
    values (btrim(p_nome), sponsor, 'attivo', public.impronta(chiave), codice, p_data_iscrizione,
            p_qualifica, p_percentuale, date_trunc('month', p_qualifica_mese)::date, coalesce(p_pagamenti, 0),
            now(), now())
    returning * into p;
    update public.partners set creato_da = p.id where id = p.id returning * into p;
  end if;

  insert into public.accessi (user_id, partner_id) values (uid, p.id);
  return jsonb_build_object('profilo', to_jsonb(p) - 'chiave_hash', 'chiave', chiave);
end;
$$;

-- Con la chiave personale di un profilo importato (link mandati prima di questa versione):
-- diventa "usa l'app" con le stesse regole.
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

  if p.stato = 'gestito' then
    perform public.diventa_attivo(p.id);
  elsif p.stato <> 'attivo' then
    update public.partners set stato = 'attivo', gestore_id = null where id = p.id;
  end if;
  select * into p from public.partners where id = p.id;
  return to_jsonb(p) - 'chiave_hash';
end;
$$;

-- Chi ha scritto il dato non si cambia, ma se quella persona viene cancellata il riferimento si svuota
-- (prima il trigger lo rimetteva e la cancellazione falliva).
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
    new.inserito_da := case when new.inserito_da is null then null else old.inserito_da end;
    new.inserito_il := old.inserito_il;
  end if;
  return new;
end;
$$;

-- ---- Esclusi dell'import (solo i codici) e persone nascoste: di ognuno, privati ----

create table if not exists public.esclusi_import (
  partner_id  uuid not null references public.partners(id) on delete cascade,
  codice      text not null check (codice ~ '^[0-9]{4,12}$'),
  creato_il   timestamptz not null default now(),
  primary key (partner_id, codice)
);
alter table public.esclusi_import enable row level security;
drop policy if exists esclusi_leggi on public.esclusi_import;
create policy esclusi_leggi on public.esclusi_import for select to authenticated
  using (partner_id = public.my_partner_id());
drop policy if exists esclusi_togli on public.esclusi_import;
create policy esclusi_togli on public.esclusi_import for delete to authenticated
  using (partner_id = public.my_partner_id());
revoke all on public.esclusi_import from anon, authenticated;
grant select, delete on public.esclusi_import to authenticated;

-- Nascosta: sparisce dalla mia struttura (con il suo gruppo) ma i suoi VP contano lo stesso.
create table if not exists public.nascosti (
  partner_id   uuid not null references public.partners(id) on delete cascade,
  nascosto_id  uuid not null references public.partners(id) on delete cascade,
  creato_il    timestamptz not null default now(),
  primary key (partner_id, nascosto_id),
  check (partner_id <> nascosto_id)
);
alter table public.nascosti enable row level security;
drop policy if exists nascosti_leggi on public.nascosti;
create policy nascosti_leggi on public.nascosti for select to authenticated
  using (partner_id = public.my_partner_id());
drop policy if exists nascosti_aggiungi on public.nascosti;
create policy nascosti_aggiungi on public.nascosti for insert to authenticated
  with check (partner_id = public.my_partner_id() and nascosto_id <> partner_id and public.vedo(nascosto_id));
drop policy if exists nascosti_togli on public.nascosti;
create policy nascosti_togli on public.nascosti for delete to authenticated
  using (partner_id = public.my_partner_id());
revoke all on public.nascosti from anon, authenticated;
grant select, insert, delete on public.nascosti to authenticated;

-- ---- Cancellare: le mie persone importate (diventano escluse) o chi usa l'app (codice non rinnovato) ----

create or replace function public.cancella_partner(p_partner uuid)
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  io    uuid := public.my_partner_id();
  t     public.partners;
  saliti int;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  select * into t from public.partners where id = p_partner;
  if not found then
    raise exception 'partner_inesistente';
  end if;
  if t.sponsor_id is null or t.id = io or not public.vedo(t.id) then
    raise exception 'non_autorizzato';
  end if;

  -- chi stava sotto sale al suo sponsor (sotto chi usa l'app ci sono solo persone che usano l'app
  -- o persone importate, quindi la regola "chi usa l'app sta sotto chi usa l'app" resta vera)
  update public.partners set sponsor_id = t.sponsor_id where sponsor_id = t.id;
  get diagnostics saliti = row_count;
  update public.partners set gestore_id = null where gestore_id = t.id and stato <> 'gestito';
  -- le persone importate da chi viene cancellato non le vede più nessuno: si cancellano con lui
  delete from public.partners where gestore_id = t.id and stato = 'gestito';
  update public.partners set creato_da = null where creato_da = t.id;
  if t.stato = 'gestito' and t.codice_amway is not null then
    insert into public.esclusi_import (partner_id, codice) values (io, t.codice_amway) on conflict do nothing;
  end if;

  delete from public.partners where id = t.id;
  return saliti;
end;
$$;

-- ---- Import della rete dal report Amway ----
-- p_io:       { "codice": "1234567", "vpp": 400 }       (il mio codice si salva se non c'è)
-- p_persone:  [{ "codice", "nome", "sponsor", "vpp" }]     le mie persone importate (nuove o già presenti),
--             nell'ordine del report (prima lo sponsor); "sponsor" = codice della prima persona sopra di lei
--             presente nell'app (io, chi usa l'app, mie importate); null = sotto di me
-- p_attivi:   [{ "codice", "sponsor" }]                    chi usa l'app: il suo sponsor secondo il report
--             (codice del primo antenato che usa l'app)
-- p_esclusi:  codici da non riproporre;  p_cancella: mie persone importate non più nel report
create or replace function public.importa_rete(p_mese date, p_io jsonb, p_persone jsonb, p_attivi jsonb,
                                               p_esclusi text[], p_cancella uuid[])
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  io        uuid := public.my_partner_id();
  mio       text;
  r         jsonb;
  cod       text;
  sp        uuid;
  x         public.partners;
  righe     jsonb := '[]'::jsonb;
  aggiunte  int := 0;
  spostate  int := 0;
  cancellate int := 0;
  esito     jsonb;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  if jsonb_typeof(p_persone) is distinct from 'array' or jsonb_typeof(p_attivi) is distinct from 'array'
     or jsonb_array_length(p_persone) > 5000 then
    raise exception 'import_non_valido';
  end if;

  -- il mio codice
  select codice_amway into mio from public.partners where id = io;
  cod := nullif(regexp_replace(coalesce(p_io->>'codice', ''), '[^0-9]', '', 'g'), '');
  if mio is null and cod is not null then
    perform public.imposta_codice_amway(io, cod);
    mio := cod;
  elsif cod is distinct from mio then
    raise exception 'import_di_altri';
  end if;
  righe := righe || jsonb_build_object('partner_id', io, 'vpp', p_io->'vpp');

  -- le mie copie di persone che ora usano l'app: spariscono, le mie persone sotto di loro passano a chi usa l'app
  for x in select g.* from public.partners g
            where g.stato = 'gestito' and g.gestore_id = io and g.codice_amway is not null
              and exists (select 1 from public.partners a where a.codice_amway = g.codice_amway
                           and a.stato <> 'gestito' and public.vedo(a.id)) loop
    update public.partners set sponsor_id = (select a.id from public.partners a
                                               where a.codice_amway = x.codice_amway and a.stato <> 'gestito')
     where sponsor_id = x.id;
    delete from public.partners where id = x.id;
  end loop;

  -- le mie persone importate: si creano o si spostano nella posizione del report
  for r in select * from jsonb_array_elements(p_persone) loop
    cod := nullif(regexp_replace(coalesce(r->>'codice', ''), '[^0-9]', '', 'g'), '');
    if cod is null or cod !~ '^[0-9]{4,12}$' or cod = mio then
      raise exception 'import_non_valido';
    end if;
    sp := null;
    if r->>'sponsor' is not null and r->>'sponsor' <> mio then
      select a.id into sp from public.partners a
       where a.codice_amway = r->>'sponsor' and a.stato <> 'gestito' and public.vedo(a.id);
      if sp is null then
        select g.id into sp from public.partners g
         where g.codice_amway = r->>'sponsor' and g.stato = 'gestito' and g.gestore_id = io;
      end if;
    end if;
    sp := coalesce(sp, io);
    select * into x from public.partners g where g.codice_amway = cod and g.stato = 'gestito' and g.gestore_id = io;
    if found then
      if x.sponsor_id is distinct from sp and sp <> x.id and not exists (
           with recursive giu(id) as (
             select x.id union all select p.id from public.partners p join giu on p.sponsor_id = giu.id)
           select 1 from giu where giu.id = sp) then
        update public.partners set sponsor_id = sp where id = x.id;
        spostate := spostate + 1;
      end if;
    else
      if exists (select 1 from public.partners a where a.codice_amway = cod and a.stato <> 'gestito' and public.vedo(a.id)) then
        continue;   -- usa già l'app: non si importa
      end if;
      if length(btrim(coalesce(r->>'nome', ''))) = 0 then
        raise exception 'import_non_valido';
      end if;
      insert into public.partners (nome, sponsor_id, stato, gestore_id, codice_amway, consenso_confermato_il, creato_da)
      values (left(btrim(r->>'nome'), 80), sp, 'gestito', io, cod, now(), io)
      returning * into x;
      aggiunte := aggiunte + 1;
    end if;
    delete from public.esclusi_import where partner_id = io and codice = cod;
    if r ? 'vpp' then
      righe := righe || jsonb_build_object('partner_id', x.id, 'vpp', r->'vpp');
    end if;
  end loop;

  -- chi usa l'app: sotto il suo sponsor secondo il report (solo nel mio gruppo, mai in un giro)
  for r in select * from jsonb_array_elements(p_attivi) loop
    select * into x from public.partners a
     where a.codice_amway = r->>'codice' and a.stato <> 'gestito' and a.id <> io and public.vedo(a.id);
    if not found then
      continue;
    end if;
    sp := null;
    if r->>'sponsor' is null or r->>'sponsor' = mio then
      sp := io;
    else
      select a.id into sp from public.partners a
       where a.codice_amway = r->>'sponsor' and a.stato <> 'gestito' and public.vedo(a.id);
    end if;
    if sp is null or sp = x.sponsor_id or sp = x.id then
      continue;
    end if;
    if exists (with recursive giu(id) as (
                 select x.id union all select p.id from public.partners p join giu on p.sponsor_id = giu.id)
               select 1 from giu where giu.id = sp) then
      continue;
    end if;
    update public.partners set sponsor_id = sp where id = x.id;
    spostate := spostate + 1;
  end loop;

  -- non più nel report: solo le mie persone importate
  for x in select * from public.partners where id = any(coalesce(p_cancella, '{}')) loop
    if not public.posso_gestire(x.id) then
      raise exception 'non_autorizzato';
    end if;
    perform public.cancella_partner(x.id);
    cancellate := cancellate + 1;
  end loop;

  -- esclusi: non si ripropongono
  insert into public.esclusi_import (partner_id, codice)
  select io, c from unnest(coalesce(p_esclusi, '{}')) c where c ~ '^[0-9]{4,12}$'
  on conflict do nothing;

  esito := public.importa_vpp(p_mese, righe);
  return esito || jsonb_build_object('aggiunte', aggiunte, 'spostate', spostate, 'cancellate', cancellate);
end;
$$;

-- ---- Calcoli per chi guarda: chi usa l'app più le persone importate da chi guarda ----

create or replace function public.calcola_mese(p_mese date, p_radice uuid, p_chi uuid)
returns table (partner_id uuid, sponsor_id uuid, vp_personali numeric, vp_gruppo numeric,
               linee_attive int, percentuale int, qualifica text)
language sql
stable
security definer
set search_path = public
as $$
  with recursive
  albero(id, sponsor_id) as (
    select p.id, p.sponsor_id from public.partners p where p.id = p_radice
    union all
    select p.id, p.sponsor_id from public.partners p join albero a on p.sponsor_id = a.id
    where p.stato <> 'gestito' or p.gestore_id = p_chi
  ),
  sotto(antenato, discendente) as (
    select id, id from albero
    union all
    select s.antenato, a.id from sotto s join albero a on a.sponsor_id = s.discendente
  ),
  personali as (
    select a.id, a.sponsor_id,
           coalesce((select sum(x.vp) from public.activities x
                      where x.partner_id = a.id and x.tipo in ('ordine', 'rettifica')
                        and x.data >= date_trunc('month', p_mese)::date
                        and x.data < (date_trunc('month', p_mese) + interval '1 month')::date), 0) as vp
    from albero a
  ),
  gruppo as (
    select s.antenato as id, sum(p.vp) as vp
    from sotto s join personali p on p.id = s.discendente
    group by s.antenato
  ),
  soglia as (
    select coalesce((select (valore #>> '{}')::numeric from public.settings where chiave = 'soglia_linea_attiva'), 100) as v
  ),
  base as (
    select p.id, p.sponsor_id, p.vp as vp_personali, g.vp as vp_gruppo
    from personali p join gruppo g on g.id = p.id
  )
  select b.id, b.sponsor_id, b.vp_personali, b.vp_gruppo,
         (select count(*)::int from base f, soglia where f.sponsor_id = b.id and f.vp_gruppo >= soglia.v),
         (select max(l.percentuale) from public.percent_levels l where l.vp_gruppo <= b.vp_gruppo),
         (select s.chiave from public.stage_requirements s, soglia
           where s.ordine >= 3
             and b.vp_personali >= s.vp_personali
             and (s.vp_gruppo is null or b.vp_gruppo >= s.vp_gruppo)
             and (s.linee is null or
                  (select count(*) from base f where f.sponsor_id = b.id
                     and f.vp_gruppo >= coalesce(s.vp_linea, soglia.v)) >= s.linee)
           order by s.ordine desc limit 1)
  from base b
$$;

-- lo storico si congela per chi guarda: ognuno ritrova i suoi numeri di allora
alter table public.monthly_totals add column if not exists visto_da uuid references public.partners(id) on delete cascade;
update public.monthly_totals set visto_da = partner_id where visto_da is null;
alter table public.monthly_totals alter column visto_da set not null;
alter table public.monthly_totals drop constraint if exists monthly_totals_pkey;
alter table public.monthly_totals add primary key (visto_da, partner_id, mese);
alter policy totali_leggo on public.monthly_totals using (visto_da = public.my_partner_id());

create or replace function public.riepilogo_mese(p_mese date)
returns table (partner_id uuid, sponsor_id uuid, vp_personali numeric, vp_gruppo numeric,
               linee_attive int, percentuale int, qualifica text, chiuso boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  io uuid := public.my_partner_id();
  m  date := date_trunc('month', p_mese)::date;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  if exists (select 1 from public.monthly_totals t where t.visto_da = io and t.partner_id = io and t.mese = m) then
    return query
      select t.partner_id, p.sponsor_id, t.vp_personali, t.vp_gruppo, t.linee_attive,
             t.percentuale, t.qualifica, true
      from public.monthly_totals t join public.partners p on p.id = t.partner_id
      where t.visto_da = io and t.mese = m and public.vedo(t.partner_id);
  else
    return query
      select c.partner_id, c.sponsor_id, c.vp_personali, c.vp_gruppo, c.linee_attive,
             c.percentuale, c.qualifica, false
      from public.calcola_mese(m, io, io) c;
  end if;
end;
$$;

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
  where v.stato <> 'gestito'
  on conflict (visto_da, partner_id, mese) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---- Copia di sicurezza: anche le tabelle nuove ----

create or replace function public.copia_dati()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.sono_admin() then
    raise exception 'non_autorizzato';
  end if;
  return jsonb_build_object(
    'app', 'Growup Team',
    'creata_il', now(),
    'tabelle', jsonb_build_object(
      'partners',           coalesce((select jsonb_agg(to_jsonb(t) order by t.creato_il) from public.partners t), '[]'),
      'activities',         coalesce((select jsonb_agg(to_jsonb(t)) from public.activities t), '[]'),
      'goals',              coalesce((select jsonb_agg(to_jsonb(t)) from public.goals t), '[]'),
      'monthly_goals',      coalesce((select jsonb_agg(to_jsonb(t)) from public.monthly_goals t), '[]'),
      'monthly_totals',     coalesce((select jsonb_agg(to_jsonb(t)) from public.monthly_totals t), '[]'),
      'obiettivi',          coalesce((select jsonb_agg(to_jsonb(t)) from public.obiettivi t), '[]'),
      'preferiti',          coalesce((select jsonb_agg(to_jsonb(t)) from public.preferiti t), '[]'),
      'esclusi_import',     coalesce((select jsonb_agg(to_jsonb(t)) from public.esclusi_import t), '[]'),
      'nascosti',           coalesce((select jsonb_agg(to_jsonb(t)) from public.nascosti t), '[]'),
      'settings',           coalesce((select jsonb_agg(to_jsonb(t)) from public.settings t), '[]'),
      'stage_requirements', coalesce((select jsonb_agg(to_jsonb(t) order by t.ordine) from public.stage_requirements t), '[]'),
      'percent_levels',     coalesce((select jsonb_agg(to_jsonb(t)) from public.percent_levels t), '[]')
    )
  );
end;
$$;

-- ---- Chi usa l'app e oggi sta sotto una persona senza app sale sotto il primo antenato che usa l'app ----

update public.partners p set sponsor_id = public.antenato_con_app(p.id)
 where p.stato <> 'gestito'
   and exists (select 1 from public.partners s where s.id = p.sponsor_id and s.stato = 'gestito');

-- ---- Permessi: funzioni nuove; chiuse quelle degli inserimenti a mano ----

revoke execute on function public.vedo(uuid), public.antenato_con_app(uuid), public.diventa_attivo(uuid), public.profondita(uuid),
  public.entra_con_invito(text, text, text, date, text, date, int, int),
  public.importa_rete(date, jsonb, jsonb, jsonb, text[], uuid[]),
  public.calcola_mese(date, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.vedo(uuid), public.entra_con_invito(text, text, text, date, text, date, int, int),
  public.importa_rete(date, jsonb, jsonb, jsonb, text[], uuid[])
  to authenticated;

revoke execute on function public.iscrivi_con_codice(text, text, date, text, date, int, int),
  public.aggiungi_partner(text, uuid, date, text, int, date, int),
  public.aggiungi_con_codice(text, uuid, text, date, text, int, date, int),
  public.inserisci_in_mezzo(text, uuid[], date, text, int, date, int),
  public.inserisci_in_mezzo_con_codice(text, uuid[], text, date, text, int, date, int),
  public.cambia_sponsor(uuid, uuid), public.link_per_gestito(uuid)
  from public, anon, authenticated;

-- ============================================================
-- Growup Team — 017: inviti degli admin, struttura "ricucita", numeri ufficiali dal report Amway
-- Si lancia dopo 016 (anche in un'installazione da zero). Va incollata nell'SQL Editor.
--   - Inviti degli admin: "Invita sotto questa persona" (il codice d'invito di chiunque, anche di
--     una persona importata, per i gruppi dei Platino che il report non mostra) e "Invita chi manca
--     sopra" (link speciale, valido una volta: chi entra va tra lo sponsor e la persona).
--   - Struttura "ricucita": chi ha lo sponsor che io non vedo (per esempio sotto una persona
--     importata da altri) compare sotto il primo sopra di lui che vedo; i calcoli seguono la stessa regola.
--   - Numeri ufficiali dal report: chi importa salva VPP, VPG, percentuale e i VPG delle linee
--     frontali (solo numeri e codici) di sé e delle persone del report che ha nell'app. Il riepilogo
--     del mese e la chiusura usano questi numeri; la qualifica si calcola sulla struttura del report.
--   - Il codice Amway lo corregge solo un admin (errore di battitura all'ingresso).
-- ============================================================

-- ---- Inviti speciali degli admin ----

create table if not exists public.inviti_admin (
  codice      text primary key,
  sponsor_id  uuid not null references public.partners(id) on delete cascade,
  sopra_di    uuid[] not null,
  creato_da   uuid references public.partners(id) on delete set null,
  creato_il   timestamptz not null default now(),
  usato_il    timestamptz,
  usato_da    uuid references public.partners(id) on delete set null
);
alter table public.inviti_admin enable row level security;
revoke all on public.inviti_admin from anon, authenticated;   -- solo dalle funzioni

-- i codici d'invito non si ripetono neanche tra i link speciali
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
    exit when not exists (select 1 from public.partners where codice_invito = c)
          and not exists (select 1 from public.inviti_admin where codice = c);
  end loop;
  return c;
end;
$$;

-- "Invita chi manca sopra": la persona (e gli altri frontali spuntati dello stesso sponsor) passerà
-- sotto chi entra con questo link. Solo admin.
create or replace function public.crea_invito_sopra(p_partner uuid, p_altri uuid[] default '{}')
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  t public.partners;
  c text := public.nuovo_codice();
begin
  if not public.sono_admin() then
    raise exception 'non_autorizzato';
  end if;
  select * into t from public.partners where id = p_partner;
  if not found or t.sponsor_id is null or not public.vedo(t.id) then
    raise exception 'posizione_non_valida';
  end if;
  if exists (select 1 from unnest(coalesce(p_altri, '{}')) a
              where not exists (select 1 from public.partners x where x.id = a and x.sponsor_id = t.sponsor_id)) then
    raise exception 'posizione_non_valida';
  end if;
  insert into public.inviti_admin (codice, sponsor_id, sopra_di, creato_da)
  values (c, t.sponsor_id, array[t.id] || coalesce(p_altri, '{}'), public.my_partner_id());
  return c;
end;
$$;

-- Prima di entrare: il nome dello sponsor, anche per i link speciali.
create or replace function public.sponsor_da_codice(p_codice text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select btrim(nome) from public.partners where codice_invito = upper(btrim(p_codice))),
    (select btrim(p.nome) from public.inviti_admin i join public.partners p on p.id = i.sponsor_id
      where i.codice = upper(btrim(p_codice)) and i.usato_il is null))
$$;

create or replace function public.entra_con_invito(
  p_codice             text,
  p_nome               text,
  p_codice_amway       text,
  p_data_iscrizione    date default null,
  p_qualifica          text default null,
  p_qualifica_mese     date default null,
  p_pagamenti          int  default 0,
  p_percentuale        int  default null
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
  codice  text := nullif(regexp_replace(coalesce(p_codice_amway, ''), '[^0-9]', '', 'g'), '');
  chiave  text := public.nuova_chiave_segreta();
  copia   uuid;
  invito  public.inviti_admin;
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
    -- link speciale degli admin: "chi manca sopra", valido una volta sola
    select * into invito from public.inviti_admin ia where ia.codice = upper(btrim(p_codice)) and ia.usato_il is null;
    sponsor := invito.sponsor_id;
  end if;
  if sponsor is null then
    raise exception 'codice_non_valido';
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
  if exists (select 1 from public.partners where codice_amway = codice and stato <> 'gestito') then
    raise exception 'codice_amway_attivo';
  end if;
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

  -- il codice è già stato importato: si prende il profilo, solo se chi invita gli sta sopra
  if exists (select 1 from public.partners where codice_amway = codice and stato = 'gestito') then
    select x.id into copia from public.partners x
     where x.codice_amway = codice and x.stato = 'gestito'
       and exists (
         with recursive su(id, sponsor_id, livello) as (
           select y.id, y.sponsor_id, 0 from public.partners y where y.id = x.sponsor_id
           union all
           select y.id, y.sponsor_id, su.livello + 1 from public.partners y join su on y.id = su.sponsor_id
           where su.livello < 200
         )
         select 1 from su where su.id = sponsor)
     order by (x.gestore_id = sponsor) desc, public.profondita(x.gestore_id) desc, x.creato_il, x.id
     limit 1;
    if copia is null then
      raise exception 'codice_amway_altra_linea';
    end if;
    update public.partners
       set nome = btrim(p_nome), chiave_hash = public.impronta(chiave), data_iscrizione = p_data_iscrizione,
           qualifica_iniziale = p_qualifica, percentuale_iniziale = p_percentuale,
           qualifica_iniziale_mese = date_trunc('month', p_qualifica_mese)::date,
           pagamenti_iniziali = coalesce(p_pagamenti, 0), privacy_accettata_il = now(), ultimo_aggiornamento = now(),
           partenza_confermata_il = case when p_qualifica is null and p_percentuale is null then now() end,
           partenza_confermata_da = null
     where id = copia;
    perform public.diventa_attivo(copia);
    select * into p from public.partners where id = copia;
  else
    insert into public.partners (nome, sponsor_id, stato, chiave_hash, codice_amway, data_iscrizione,
                                 qualifica_iniziale, percentuale_iniziale, qualifica_iniziale_mese, pagamenti_iniziali,
                                 privacy_accettata_il, ultimo_aggiornamento)
    values (btrim(p_nome), sponsor, 'attivo', public.impronta(chiave), codice, p_data_iscrizione,
            p_qualifica, p_percentuale, date_trunc('month', p_qualifica_mese)::date, coalesce(p_pagamenti, 0),
            now(), now())
    returning * into p;
    update public.partners set creato_da = p.id where id = p.id returning * into p;
  end if;

  if invito.codice is not null then
    update public.partners set sponsor_id = p.id
     where id = any(invito.sopra_di) and sponsor_id = invito.sponsor_id and id <> p.id;
    update public.inviti_admin ia set usato_il = now(), usato_da = p.id where ia.codice = invito.codice;
  end if;

  insert into public.accessi (user_id, partner_id) values (uid, p.id);
  return jsonb_build_object('profilo', to_jsonb(p) - 'chiave_hash', 'chiave', chiave);
end;
$$;

-- ---- Il codice Amway lo corregge solo un admin ----

create or replace function public.imposta_codice_amway(p_partner uuid, p_codice text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  codice text := nullif(regexp_replace(coalesce(p_codice, ''), '[^0-9]', '', 'g'), '');
  p      public.partners;
begin
  if public.my_partner_id() is null then
    raise exception 'non_autenticato';
  end if;
  if not public.sono_admin() or not public.vedo(p_partner) then
    raise exception 'non_autorizzato';
  end if;
  if codice is null or codice !~ '^[0-9]{4,12}$' then
    raise exception 'codice_amway_non_valido';
  end if;
  begin
    update public.partners set codice_amway = codice where id = p_partner returning * into p;
  exception when unique_violation then
    raise exception 'codice_amway_usato';
  end;
  return to_jsonb(p) - 'chiave_hash';
end;
$$;

-- ---- Struttura "ricucita": io e chi vedo, ognuno sotto il primo sopra di lui che vedo ----

create or replace function public.struttura_visibile()
returns table (id uuid, nome text, sponsor_id uuid, stato text, gestore_id uuid, creato_il timestamptz,
               ultimo_aggiornamento timestamptz, codice_amway text, codice_invito text,
               qualifica_iniziale text, percentuale_iniziale int, qualifica_iniziale_mese date,
               pagamenti_iniziali int, partenza_confermata_il timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with recursive albero(id, visibile, sponsor_visibile) as (
    select p.id, true, null::uuid from public.partners p where p.id = public.my_partner_id()
    union all
    select p.id, (p.stato <> 'gestito' or p.gestore_id = public.my_partner_id()),
           case when a.visibile then a.id else a.sponsor_visibile end
    from public.partners p join albero a on p.sponsor_id = a.id
  )
  select p.id, p.nome, a.sponsor_visibile, p.stato, p.gestore_id, p.creato_il, p.ultimo_aggiornamento,
         p.codice_amway, p.codice_invito, p.qualifica_iniziale, p.percentuale_iniziale, p.qualifica_iniziale_mese,
         p.pagamenti_iniziali, p.partenza_confermata_il
  from albero a join public.partners p on p.id = a.id
  where a.visibile
  order by p.creato_il
$$;

-- ---- Calcoli per chi guarda, sulla struttura "ricucita" ----

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
    select p.id, (p.stato <> 'gestito' or p.gestore_id = p_chi),
           case when t.visibile then t.id else t.sponsor_visibile end
    from public.partners p join tutto t on p.sponsor_id = t.id
  ),
  albero(id, sponsor_id) as (
    select id, sponsor_visibile from tutto where visibile
  ),
  sotto(antenato, discendente) as (
    select id, id from albero
    union all
    select s.antenato, a.id from sotto s join albero a on a.sponsor_id = s.discendente
  ),
  personali as (
    select a.id, a.sponsor_id,
           coalesce((select sum(x.vp) from public.activities x
                      where x.partner_id = a.id and x.tipo in ('ordine', 'rettifica')
                        and x.data >= date_trunc('month', p_mese)::date
                        and x.data < (date_trunc('month', p_mese) + interval '1 month')::date), 0) as vp
    from albero a
  ),
  gruppo as (
    select s.antenato as id, sum(p.vp) as vp
    from sotto s join personali p on p.id = s.discendente
    group by s.antenato
  ),
  soglia as (
    select coalesce((select (valore #>> '{}')::numeric from public.settings where chiave = 'soglia_linea_attiva'), 100) as v
  ),
  base as (
    select p.id, p.sponsor_id, p.vp as vp_personali, g.vp as vp_gruppo
    from personali p join gruppo g on g.id = p.id
  )
  select b.id, b.sponsor_id, b.vp_personali, b.vp_gruppo,
         (select count(*)::int from base f, soglia where f.sponsor_id = b.id and f.vp_gruppo >= soglia.v),
         (select max(l.percentuale) from public.percent_levels l where l.vp_gruppo <= b.vp_gruppo),
         (select s.chiave from public.stage_requirements s, soglia
           where s.ordine >= 3
             and b.vp_personali >= s.vp_personali
             and (s.vp_gruppo is null or b.vp_gruppo >= s.vp_gruppo)
             and (s.linee is null or
                  (select count(*) from base f where f.sponsor_id = b.id
                     and f.vp_gruppo >= coalesce(s.vp_linea, soglia.v)) >= s.linee)
           order by s.ordine desc limit 1)
  from base b
$$;

-- ---- Numeri ufficiali dal report Amway (per chi importa) ----

create table if not exists public.numeri_report (
  visto_da        uuid not null references public.partners(id) on delete cascade,
  partner_id      uuid not null references public.partners(id) on delete cascade,
  mese            date not null check (extract(day from mese) = 1),
  vpp             numeric(12,2) not null default 0,
  vpg             numeric(12,2) not null default 0,
  percentuale     int,
  linee           jsonb not null default '[]',   -- [{ "codice": "…", "vpg": 123.4 }]: le linee frontali del report
  linee_nascoste  boolean not null default false, -- il report non mostra il gruppo (Platino)
  aggiornato_il   timestamptz not null default now(),
  primary key (visto_da, partner_id, mese)
);
alter table public.numeri_report enable row level security;
create policy numeri_report_leggo on public.numeri_report for select to authenticated
  using (visto_da = public.my_partner_id());
revoke all on public.numeri_report from anon, authenticated;
grant select on public.numeri_report to authenticated;

-- r: { "vpp", "vpg", "percentuale", "linee": [{codice, vpg}], "nascoste" }
create or replace function public.salva_numeri_report(p_chi uuid, p_partner uuid, p_mese date, r jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if r ? 'vpg' then
    insert into public.numeri_report (visto_da, partner_id, mese, vpp, vpg, percentuale, linee, linee_nascoste)
    values (p_chi, p_partner, date_trunc('month', p_mese)::date, coalesce((r->>'vpp')::numeric, 0),
            coalesce((r->>'vpg')::numeric, 0), nullif(r->>'percentuale', '')::int,
            case when jsonb_typeof(r->'linee') = 'array' then r->'linee' else '[]' end,
            coalesce((r->>'nascoste')::boolean, false))
    on conflict (visto_da, partner_id, mese) do update
      set vpp = excluded.vpp, vpg = excluded.vpg, percentuale = excluded.percentuale,
          linee = excluded.linee, linee_nascoste = excluded.linee_nascoste, aggiornato_il = now();
  end if;
end;
$$;

-- la qualifica del mese sui numeri del report: VPP, VPG e linee frontali del report
create or replace function public.qualifica_report(p_vpp numeric, p_vpg numeric, p_linee jsonb)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select s.chiave from public.stage_requirements s,
         (select coalesce((select (valore #>> '{}')::numeric from public.settings where chiave = 'soglia_linea_attiva'), 100) as v) soglia
   where s.ordine >= 3
     and p_vpp >= s.vp_personali
     and (s.vp_gruppo is null or p_vpg >= s.vp_gruppo)
     and (s.linee is null or
          (select count(*) from jsonb_array_elements(p_linee) l
            where (l->>'vpg')::numeric >= coalesce(s.vp_linea, soglia.v)) >= s.linee)
   order by s.ordine desc limit 1
$$;

-- il riepilogo del mese: dal vivo, con i numeri del report dove ci sono
drop function if exists public.riepilogo_mese(date);
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
  io uuid := public.my_partner_id();
  m  date := date_trunc('month', p_mese)::date;
  soglia numeric := coalesce((select (valore #>> '{}')::numeric from public.settings where chiave = 'soglia_linea_attiva'), 100);
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  if exists (select 1 from public.monthly_totals t where t.visto_da = io and t.partner_id = io and t.mese = m) then
    return query
      select t.partner_id, s.sponsor_id, t.vp_personali, t.vp_gruppo, t.linee_attive,
             t.percentuale, t.qualifica, true, n.partner_id is not null, n.linee, coalesce(n.linee_nascoste, false)
      from public.monthly_totals t
      join public.struttura_visibile() s on s.id = t.partner_id
      left join public.numeri_report n on n.visto_da = io and n.partner_id = t.partner_id and n.mese = m
      where t.visto_da = io and t.mese = m;
  else
    return query
      select c.partner_id, c.sponsor_id, c.vp_personali,
             coalesce(n.vpg, c.vp_gruppo),
             case when n.partner_id is null then c.linee_attive
                  else (select count(*)::int from jsonb_array_elements(n.linee) l where (l->>'vpg')::numeric >= soglia) end,
             coalesce(n.percentuale, c.percentuale),
             case when n.partner_id is null then c.qualifica else public.qualifica_report(c.vp_personali, n.vpg, n.linee) end,
             false, n.partner_id is not null, n.linee, coalesce(n.linee_nascoste, false)
      from public.calcola_mese(m, io, io) c
      left join public.numeri_report n on n.visto_da = io and n.partner_id = c.partner_id and n.mese = m;
  end if;
end;
$$;

-- la chiusura del mese congela gli stessi numeri che ognuno vede
create or replace function public.chiudi_mese(p_mese date)
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  m date := date_trunc('month', p_mese)::date;
  soglia numeric := coalesce((select (valore #>> '{}')::numeric from public.settings where chiave = 'soglia_linea_attiva'), 100);
  n int;
begin
  insert into public.monthly_totals (visto_da, partner_id, mese, vp_personali, vp_gruppo, linee_attive, percentuale, qualifica)
  select v.id, c.partner_id, m, c.vp_personali,
         coalesce(r.vpg, c.vp_gruppo),
         case when r.partner_id is null then c.linee_attive
              else (select count(*)::int from jsonb_array_elements(r.linee) l where (l->>'vpg')::numeric >= soglia) end,
         coalesce(r.percentuale, c.percentuale),
         case when r.partner_id is null then c.qualifica else public.qualifica_report(c.vp_personali, r.vpg, r.linee) end
  from public.partners v
  cross join lateral public.calcola_mese(m, v.id, v.id) c
  left join public.numeri_report r on r.visto_da = v.id and r.partner_id = c.partner_id and r.mese = m
  where v.stato <> 'gestito'
  on conflict (visto_da, partner_id, mese) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.importa_rete(p_mese date, p_io jsonb, p_persone jsonb, p_attivi jsonb,
                                               p_esclusi text[], p_cancella uuid[])
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  io        uuid := public.my_partner_id();
  mio       text;
  r         jsonb;
  cod       text;
  sp        uuid;
  x         public.partners;
  righe     jsonb := '[]'::jsonb;
  aggiunte  int := 0;
  spostate  int := 0;
  cancellate int := 0;
  esito     jsonb;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  if jsonb_typeof(p_persone) is distinct from 'array' or jsonb_typeof(p_attivi) is distinct from 'array'
     or jsonb_array_length(p_persone) > 5000 then
    raise exception 'import_non_valido';
  end if;

  -- il mio codice
  select codice_amway into mio from public.partners where id = io;
  cod := nullif(regexp_replace(coalesce(p_io->>'codice', ''), '[^0-9]', '', 'g'), '');
  if mio is null and cod is not null then
    begin
      update public.partners set codice_amway = cod where id = io;
    exception when unique_violation then
      raise exception 'codice_amway_usato';
    end;
    mio := cod;
  elsif cod is distinct from mio then
    raise exception 'import_di_altri';
  end if;
  righe := righe || jsonb_build_object('partner_id', io, 'vpp', p_io->'vpp');
  perform public.salva_numeri_report(io, io, p_mese, p_io);

  -- le mie copie di persone che ora usano l'app: spariscono, le mie persone sotto di loro passano a chi usa l'app
  for x in select g.* from public.partners g
            where g.stato = 'gestito' and g.gestore_id = io and g.codice_amway is not null
              and exists (select 1 from public.partners a where a.codice_amway = g.codice_amway
                           and a.stato <> 'gestito' and public.vedo(a.id)) loop
    update public.partners set sponsor_id = (select a.id from public.partners a
                                               where a.codice_amway = x.codice_amway and a.stato <> 'gestito')
     where sponsor_id = x.id;
    delete from public.partners where id = x.id;
  end loop;

  -- le mie persone importate: si creano o si spostano nella posizione del report
  for r in select * from jsonb_array_elements(p_persone) loop
    cod := nullif(regexp_replace(coalesce(r->>'codice', ''), '[^0-9]', '', 'g'), '');
    if cod is null or cod !~ '^[0-9]{4,12}$' or cod = mio then
      raise exception 'import_non_valido';
    end if;
    sp := null;
    if r->>'sponsor' is not null and r->>'sponsor' <> mio then
      select a.id into sp from public.partners a
       where a.codice_amway = r->>'sponsor' and a.stato <> 'gestito' and public.vedo(a.id);
      if sp is null then
        select g.id into sp from public.partners g
         where g.codice_amway = r->>'sponsor' and g.stato = 'gestito' and g.gestore_id = io;
      end if;
    end if;
    sp := coalesce(sp, io);
    select * into x from public.partners g where g.codice_amway = cod and g.stato = 'gestito' and g.gestore_id = io;
    if found then
      if x.sponsor_id is distinct from sp and sp <> x.id and not exists (
           with recursive giu(id) as (
             select x.id union all select p.id from public.partners p join giu on p.sponsor_id = giu.id)
           select 1 from giu where giu.id = sp) then
        update public.partners set sponsor_id = sp where id = x.id;
        spostate := spostate + 1;
      end if;
    else
      if exists (select 1 from public.partners a where a.codice_amway = cod and a.stato <> 'gestito' and public.vedo(a.id)) then
        continue;   -- usa già l'app: non si importa
      end if;
      if length(btrim(coalesce(r->>'nome', ''))) = 0 then
        raise exception 'import_non_valido';
      end if;
      insert into public.partners (nome, sponsor_id, stato, gestore_id, codice_amway, consenso_confermato_il, creato_da)
      values (left(btrim(r->>'nome'), 80), sp, 'gestito', io, cod, now(), io)
      returning * into x;
      aggiunte := aggiunte + 1;
    end if;
    delete from public.esclusi_import where partner_id = io and codice = cod;
    if r ? 'vpp' then
      righe := righe || jsonb_build_object('partner_id', x.id, 'vpp', r->'vpp');
    end if;
    perform public.salva_numeri_report(io, x.id, p_mese, r);
  end loop;

  -- chi usa l'app: sotto il suo sponsor secondo il report (solo nel mio gruppo, mai in un giro)
  for r in select * from jsonb_array_elements(p_attivi) loop
    select * into x from public.partners a
     where a.codice_amway = r->>'codice' and a.stato <> 'gestito' and a.id <> io and public.vedo(a.id);
    if not found then
      continue;
    end if;
    perform public.salva_numeri_report(io, x.id, p_mese, r);
    sp := null;
    if r->>'sponsor' is null or r->>'sponsor' = mio then
      sp := io;
    else
      select a.id into sp from public.partners a
       where a.codice_amway = r->>'sponsor' and a.stato <> 'gestito' and public.vedo(a.id);
    end if;
    if sp is null or sp = x.sponsor_id or sp = x.id then
      continue;
    end if;
    if exists (with recursive giu(id) as (
                 select x.id union all select p.id from public.partners p join giu on p.sponsor_id = giu.id)
               select 1 from giu where giu.id = sp) then
      continue;
    end if;
    update public.partners set sponsor_id = sp where id = x.id;
    spostate := spostate + 1;
  end loop;

  -- non più nel report: solo le mie persone importate
  for x in select * from public.partners where id = any(coalesce(p_cancella, '{}')) loop
    if not public.posso_gestire(x.id) then
      raise exception 'non_autorizzato';
    end if;
    perform public.cancella_partner(x.id);
    cancellate := cancellate + 1;
  end loop;

  -- esclusi: non si ripropongono
  insert into public.esclusi_import (partner_id, codice)
  select io, c from unnest(coalesce(p_esclusi, '{}')) c where c ~ '^[0-9]{4,12}$'
  on conflict do nothing;

  esito := public.importa_vpp(p_mese, righe);
  return esito || jsonb_build_object('aggiunte', aggiunte, 'spostate', spostate, 'cancellate', cancellate);
end;
$$;

-- ---- Copia di sicurezza: anche le tabelle nuove ----

create or replace function public.copia_dati()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.sono_admin() then
    raise exception 'non_autorizzato';
  end if;
  return jsonb_build_object(
    'app', 'Growup Team',
    'creata_il', now(),
    'tabelle', jsonb_build_object(
      'partners',           coalesce((select jsonb_agg(to_jsonb(t) order by t.creato_il) from public.partners t), '[]'),
      'activities',         coalesce((select jsonb_agg(to_jsonb(t)) from public.activities t), '[]'),
      'goals',              coalesce((select jsonb_agg(to_jsonb(t)) from public.goals t), '[]'),
      'monthly_goals',      coalesce((select jsonb_agg(to_jsonb(t)) from public.monthly_goals t), '[]'),
      'monthly_totals',     coalesce((select jsonb_agg(to_jsonb(t)) from public.monthly_totals t), '[]'),
      'numeri_report',      coalesce((select jsonb_agg(to_jsonb(t)) from public.numeri_report t), '[]'),
      'obiettivi',          coalesce((select jsonb_agg(to_jsonb(t)) from public.obiettivi t), '[]'),
      'preferiti',          coalesce((select jsonb_agg(to_jsonb(t)) from public.preferiti t), '[]'),
      'esclusi_import',     coalesce((select jsonb_agg(to_jsonb(t)) from public.esclusi_import t), '[]'),
      'nascosti',           coalesce((select jsonb_agg(to_jsonb(t)) from public.nascosti t), '[]'),
      'inviti_admin',       coalesce((select jsonb_agg(to_jsonb(t)) from public.inviti_admin t), '[]'),
      'settings',           coalesce((select jsonb_agg(to_jsonb(t)) from public.settings t), '[]'),
      'stage_requirements', coalesce((select jsonb_agg(to_jsonb(t) order by t.ordine) from public.stage_requirements t), '[]'),
      'percent_levels',     coalesce((select jsonb_agg(to_jsonb(t)) from public.percent_levels t), '[]')
    )
  );
end;
$$;

-- ---- Permessi ----

revoke execute on function public.crea_invito_sopra(uuid, uuid[]), public.struttura_visibile(),
  public.salva_numeri_report(uuid, uuid, date, jsonb), public.qualifica_report(numeric, numeric, jsonb),
  public.riepilogo_mese(date)
  from public, anon, authenticated;
grant execute on function public.crea_invito_sopra(uuid, uuid[]), public.struttura_visibile(), public.riepilogo_mese(date)
  to authenticated;

-- ============================================================
-- Growup Team — 018: nessuno cancella, import sempre completo, ognuno nasconde chi vuole
-- Si lancia dopo 017 (anche in un'installazione da zero). Va incollata nell'SQL Editor.
--   - Nessuno cancella persone dall'app (neanche gli admin): "Cancella dalla struttura" è chiusa.
--   - L'import è sempre completo: tutte le persone del report entrano nella struttura di chi importa.
--     Chi importa può nascondere le nuove persone (per esempio chi ha 0 VP) già nell'anteprima.
--   - Chi non è più nel report resta, segnato "non più nel report" e nascosto (si può rivedere).
--   - Le persone nascoste contano sempre nei VP personali e di gruppo.
--   - Gli esclusi della versione precedente diventano persone nascoste al primo import.
-- ============================================================

alter table public.partners add column if not exists fuori_report_dal date;
grant select (fuori_report_dal) on public.partners to authenticated;

-- nessuno cancella
revoke execute on function public.cancella_partner(uuid) from public, anon, authenticated;

-- l'import con le regole nuove (cambiano i nomi degli ultimi due parametri)
drop function if exists public.importa_rete(date, jsonb, jsonb, jsonb, text[], uuid[]);
create or replace function public.importa_rete(p_mese date, p_io jsonb, p_persone jsonb, p_attivi jsonb,
                                               p_nascondi text[], p_fuori uuid[])
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  io        uuid := public.my_partner_id();
  mio       text;
  r         jsonb;
  cod       text;
  sp        uuid;
  x         public.partners;
  righe     jsonb := '[]'::jsonb;
  aggiunte  int := 0;
  spostate  int := 0;
  fuori     int := 0;
  esito     jsonb;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  if jsonb_typeof(p_persone) is distinct from 'array' or jsonb_typeof(p_attivi) is distinct from 'array'
     or jsonb_array_length(p_persone) > 5000 then
    raise exception 'import_non_valido';
  end if;

  -- il mio codice
  select codice_amway into mio from public.partners where id = io;
  cod := nullif(regexp_replace(coalesce(p_io->>'codice', ''), '[^0-9]', '', 'g'), '');
  if mio is null and cod is not null then
    begin
      update public.partners set codice_amway = cod where id = io;
    exception when unique_violation then
      raise exception 'codice_amway_usato';
    end;
    mio := cod;
  elsif cod is distinct from mio then
    raise exception 'import_di_altri';
  end if;
  righe := righe || jsonb_build_object('partner_id', io, 'vpp', p_io->'vpp');
  perform public.salva_numeri_report(io, io, p_mese, p_io);

  -- le mie copie di persone che ora usano l'app: spariscono, le mie persone sotto di loro passano a chi usa l'app
  for x in select g.* from public.partners g
            where g.stato = 'gestito' and g.gestore_id = io and g.codice_amway is not null
              and exists (select 1 from public.partners a where a.codice_amway = g.codice_amway
                           and a.stato <> 'gestito' and public.vedo(a.id)) loop
    update public.partners set sponsor_id = (select a.id from public.partners a
                                               where a.codice_amway = x.codice_amway and a.stato <> 'gestito')
     where sponsor_id = x.id;
    delete from public.partners where id = x.id;
  end loop;

  -- le mie persone importate: si creano o si spostano nella posizione del report
  for r in select * from jsonb_array_elements(p_persone) loop
    cod := nullif(regexp_replace(coalesce(r->>'codice', ''), '[^0-9]', '', 'g'), '');
    if cod is null or cod !~ '^[0-9]{4,12}$' or cod = mio then
      raise exception 'import_non_valido';
    end if;
    sp := null;
    if r->>'sponsor' is not null and r->>'sponsor' <> mio then
      select a.id into sp from public.partners a
       where a.codice_amway = r->>'sponsor' and a.stato <> 'gestito' and public.vedo(a.id);
      if sp is null then
        select g.id into sp from public.partners g
         where g.codice_amway = r->>'sponsor' and g.stato = 'gestito' and g.gestore_id = io;
      end if;
    end if;
    sp := coalesce(sp, io);
    select * into x from public.partners g where g.codice_amway = cod and g.stato = 'gestito' and g.gestore_id = io;
    if found then
      if x.sponsor_id is distinct from sp and sp <> x.id and not exists (
           with recursive giu(id) as (
             select x.id union all select p.id from public.partners p join giu on p.sponsor_id = giu.id)
           select 1 from giu where giu.id = sp) then
        update public.partners set sponsor_id = sp where id = x.id;
        spostate := spostate + 1;
      end if;
    else
      if exists (select 1 from public.partners a where a.codice_amway = cod and a.stato <> 'gestito' and public.vedo(a.id)) then
        continue;   -- usa già l'app: non si importa
      end if;
      if length(btrim(coalesce(r->>'nome', ''))) = 0 then
        raise exception 'import_non_valido';
      end if;
      insert into public.partners (nome, sponsor_id, stato, gestore_id, codice_amway, consenso_confermato_il, creato_da)
      values (left(btrim(r->>'nome'), 80), sp, 'gestito', io, cod, now(), io)
      returning * into x;
      aggiunte := aggiunte + 1;
      -- nuova persona: nascosta se chi importa l'ha scelto (o l'aveva esclusa con la versione precedente)
      if cod = any(coalesce(p_nascondi, '{}'))
         or exists (select 1 from public.esclusi_import e where e.partner_id = io and e.codice = cod) then
        insert into public.nascosti (partner_id, nascosto_id) values (io, x.id) on conflict do nothing;
      end if;
    end if;
    delete from public.esclusi_import where partner_id = io and codice = cod;
    -- è (di nuovo) nel report
    update public.partners set fuori_report_dal = null where id = x.id and fuori_report_dal is not null;
    if r ? 'vpp' then
      righe := righe || jsonb_build_object('partner_id', x.id, 'vpp', r->'vpp');
    end if;
    perform public.salva_numeri_report(io, x.id, p_mese, r);
  end loop;

  -- chi usa l'app: sotto il suo sponsor secondo il report (solo nel mio gruppo, mai in un giro)
  for r in select * from jsonb_array_elements(p_attivi) loop
    select * into x from public.partners a
     where a.codice_amway = r->>'codice' and a.stato <> 'gestito' and a.id <> io and public.vedo(a.id);
    if not found then
      continue;
    end if;
    perform public.salva_numeri_report(io, x.id, p_mese, r);
    sp := null;
    if r->>'sponsor' is null or r->>'sponsor' = mio then
      sp := io;
    else
      select a.id into sp from public.partners a
       where a.codice_amway = r->>'sponsor' and a.stato <> 'gestito' and public.vedo(a.id);
    end if;
    if sp is null or sp = x.sponsor_id or sp = x.id then
      continue;
    end if;
    if exists (with recursive giu(id) as (
                 select x.id union all select p.id from public.partners p join giu on p.sponsor_id = giu.id)
               select 1 from giu where giu.id = sp) then
      continue;
    end if;
    update public.partners set sponsor_id = sp where id = x.id;
    spostate := spostate + 1;
  end loop;

  -- non più nel report: nessuno si cancella; restano segnate e nascoste (si possono rivedere)
  for x in select * from public.partners where id = any(coalesce(p_fuori, '{}')) loop
    if not public.posso_gestire(x.id) then
      raise exception 'non_autorizzato';
    end if;
    if x.fuori_report_dal is null then
      update public.partners set fuori_report_dal = date_trunc('month', p_mese)::date where id = x.id;
      insert into public.nascosti (partner_id, nascosto_id) values (io, x.id) on conflict do nothing;
      fuori := fuori + 1;
    end if;
  end loop;

  esito := public.importa_vpp(p_mese, righe);
  return esito || jsonb_build_object('aggiunte', aggiunte, 'spostate', spostate, 'fuori', fuori);
end;
$$;

-- la struttura con il segno "non più nel report" (cambia il risultato: si ricrea, e con lei il riepilogo che la usa)
drop function if exists public.riepilogo_mese(date);
drop function if exists public.struttura_visibile();
create or replace function public.struttura_visibile()
returns table (id uuid, nome text, sponsor_id uuid, stato text, gestore_id uuid, creato_il timestamptz,
               ultimo_aggiornamento timestamptz, codice_amway text, codice_invito text,
               qualifica_iniziale text, percentuale_iniziale int, qualifica_iniziale_mese date,
               pagamenti_iniziali int, partenza_confermata_il timestamptz, fuori_report_dal date)
language sql
stable
security definer
set search_path = public
as $$
  with recursive albero(id, visibile, sponsor_visibile) as (
    select p.id, true, null::uuid from public.partners p where p.id = public.my_partner_id()
    union all
    select p.id, (p.stato <> 'gestito' or p.gestore_id = public.my_partner_id()),
           case when a.visibile then a.id else a.sponsor_visibile end
    from public.partners p join albero a on p.sponsor_id = a.id
  )
  select p.id, p.nome, a.sponsor_visibile, p.stato, p.gestore_id, p.creato_il, p.ultimo_aggiornamento,
         p.codice_amway, p.codice_invito, p.qualifica_iniziale, p.percentuale_iniziale, p.qualifica_iniziale_mese,
         p.pagamenti_iniziali, p.partenza_confermata_il, p.fuori_report_dal
  from albero a join public.partners p on p.id = a.id
  where a.visibile
  order by p.creato_il
$$;

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
  io uuid := public.my_partner_id();
  m  date := date_trunc('month', p_mese)::date;
  soglia numeric := coalesce((select (valore #>> '{}')::numeric from public.settings where chiave = 'soglia_linea_attiva'), 100);
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  if exists (select 1 from public.monthly_totals t where t.visto_da = io and t.partner_id = io and t.mese = m) then
    return query
      select t.partner_id, s.sponsor_id, t.vp_personali, t.vp_gruppo, t.linee_attive,
             t.percentuale, t.qualifica, true, n.partner_id is not null, n.linee, coalesce(n.linee_nascoste, false)
      from public.monthly_totals t
      join public.struttura_visibile() s on s.id = t.partner_id
      left join public.numeri_report n on n.visto_da = io and n.partner_id = t.partner_id and n.mese = m
      where t.visto_da = io and t.mese = m;
  else
    return query
      select c.partner_id, c.sponsor_id, c.vp_personali,
             coalesce(n.vpg, c.vp_gruppo),
             case when n.partner_id is null then c.linee_attive
                  else (select count(*)::int from jsonb_array_elements(n.linee) l where (l->>'vpg')::numeric >= soglia) end,
             coalesce(n.percentuale, c.percentuale),
             case when n.partner_id is null then c.qualifica else public.qualifica_report(c.vp_personali, n.vpg, n.linee) end,
             false, n.partner_id is not null, n.linee, coalesce(n.linee_nascoste, false)
      from public.calcola_mese(m, io, io) c
      left join public.numeri_report n on n.visto_da = io and n.partner_id = c.partner_id and n.mese = m;
  end if;
end;
$$;

revoke execute on function public.importa_rete(date, jsonb, jsonb, jsonb, text[], uuid[]), public.struttura_visibile(),
  public.riepilogo_mese(date)
  from public, anon, authenticated;
grant execute on function public.importa_rete(date, jsonb, jsonb, jsonb, text[], uuid[]), public.struttura_visibile(),
  public.riepilogo_mese(date)
  to authenticated;

-- ============================================================
-- Growup Team — 019: il punto di partenza non lo conferma più nessuno (18 ottobre 2026).
-- Decisione di Stefano: ognuno è responsabile di dichiarare il giusto; i numeri veri arrivano dal report Amway.
-- Lo sponsor e l'upline non confermano né correggono più; ognuno può correggere solo il proprio.
-- Le colonne partenza_confermata_il / partenza_confermata_da restano (ferme): niente cancellazioni.

revoke execute on function public.conferma_partenza(uuid, text, int, date, int) from public, anon, authenticated;

create or replace function public.modifica_partenza(
  p_qualifica        text default null,
  p_percentuale      int  default null,
  p_qualifica_mese   date default null,
  p_pagamenti        int  default 0
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  io uuid := public.my_partner_id();
  p  public.partners;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  if p_qualifica is not null
     and not exists (select 1 from public.stage_requirements s where s.chiave = p_qualifica) then
    raise exception 'qualifica_non_valida';
  end if;
  if p_percentuale is not null and p_percentuale not in (3, 6, 9, 12, 15, 18, 21) then
    raise exception 'percentuale_non_valida';
  end if;
  update public.partners
     set qualifica_iniziale = p_qualifica,
         percentuale_iniziale = p_percentuale,
         qualifica_iniziale_mese = date_trunc('month', p_qualifica_mese)::date,
         pagamenti_iniziali = least(greatest(coalesce(p_pagamenti, 0), 0), 12)
   where id = io
  returning * into p;
  return to_jsonb(p) - 'chiave_hash';
end;
$$;

revoke execute on function public.modifica_partenza(text, int, date, int) from public, anon, authenticated;
grant execute on function public.modifica_partenza(text, int, date, int) to authenticated;

-- ============================================================
-- Growup Team — 020: la Lista dentro Growup (18 ottobre 2026).
-- Ognuno tiene qui le persone della sua lista e il percorso fino al sì (In lista → Contattato → Invitato → Piano →
-- Follow-up → Chiusura), come nella mini app "Dalla Lista al Sì".
-- Decisione di Stefano: nomi e dettagli li vede SOLO chi li inserisce (né sponsor, né upline, né admin);
-- l'upline vede soltanto i numeri (numeri_persone). La copia degli admin (copia_dati) non contiene queste tabelle.
-- Segnare un passo conta da solo l'attività: Contatto → contatto, Piano → piano, Chiusura "Cliente" → cliente.

create table if not exists public.persone (
  id             uuid primary key default gen_random_uuid(),
  proprietario   uuid not null default public.my_partner_id() references public.partners(id) on delete cascade,
  nome           text not null check (length(btrim(nome)) between 1 and 80),
  contatto       text check (length(contatto) <= 80),
  origine        text check (length(origine) <= 80),
  note           text check (length(note) <= 2000),
  -- il punto più avanti raggiunto nel percorso e, se chiusa, com'è finita: li calcola persona_ricalcola dai passi
  fase           text not null default 'lista' check (fase in ('lista', 'contattato', 'invitato', 'piano', 'followup')),
  esito          text check (esito in ('partner', 'cliente', 'non_ora', 'no')),
  prossima_data  date,
  prossima_nota  text check (length(prossima_nota) <= 200),
  creato_il      timestamptz not null default now(),
  aggiornato_il  timestamptz not null default now()
);
create index if not exists persone_proprietario_idx on public.persone (proprietario);

create table if not exists public.passi (
  id            uuid primary key default gen_random_uuid(),
  persona_id    uuid not null references public.persone(id) on delete cascade,
  proprietario  uuid not null default public.my_partner_id() references public.partners(id) on delete cascade,
  tipo          text not null check (tipo in ('contatto', 'invito', 'piano', 'followup', 'chiusura', 'riapri', 'nota')),
  data          date not null default (now() at time zone 'Europe/Rome')::date check (data >= date '2000-01-01'),
  come          text check (length(come) <= 60),
  reazione      text check (length(reazione) <= 80),
  esito         text check (esito in ('partner', 'cliente', 'non_ora', 'no')),
  nota          text check (length(nota) <= 1000),
  -- passi portati dalla vecchia app: raccontano il passato, non contano attività
  importato     boolean not null default false,
  attivita_id   uuid references public.activities(id) on delete set null,
  creato_il     timestamptz not null default now(),
  constraint passi_chiusura_check check ((tipo = 'chiusura') = (esito is not null))
);
create index if not exists passi_persona_idx on public.passi (persona_id, data);

-- ---- Il punto del percorso e l'esito si ricavano dai passi ----
create or replace function public.persona_ricalcola(p_persona uuid)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.persone p
     set fase = coalesce((select (array['contattato', 'invitato', 'piano', 'followup'])[max(case s.tipo
                            when 'contatto' then 1 when 'invito' then 2 when 'piano' then 3 when 'followup' then 4 end)]
                          from public.passi s where s.persona_id = p.id), 'lista'),
         esito = (select s.esito from public.passi s
                   where s.persona_id = p.id and s.tipo in ('chiusura', 'riapri')
                   order by s.data desc, s.creato_il desc limit 1),
         aggiornato_il = now()
   where p.id = p_persona
$$;

create or replace function public.persone_prima()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.fase := 'lista'; new.esito := null;
    new.creato_il := now();
  else
    new.proprietario := old.proprietario;
    new.creato_il := old.creato_il;
  end if;
  new.aggiornato_il := now();
  return new;
end;
$$;
drop trigger if exists persone_prima on public.persone;
create trigger persone_prima before insert or update on public.persone
for each row execute function public.persone_prima();

create or replace function public.passi_prima()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pr uuid;
  t  text;
begin
  select proprietario into pr from public.persone where id = new.persona_id;
  if pr is null or (auth.uid() is not null and pr is distinct from public.my_partner_id()) then
    raise exception 'non_autorizzato';
  end if;
  new.proprietario := pr;
  new.creato_il := clock_timestamp();  -- l'ordine dei passi dello stesso giorno
  -- il passo conta l'attività del giorno (mai per i passi importati)
  t := case new.tipo when 'contatto' then 'contatto' when 'piano' then 'piano'
         when 'chiusura' then case when new.esito = 'cliente' then 'cliente' end end;
  new.attivita_id := null;
  if t is not null and not new.importato then
    insert into public.activities (partner_id, tipo, data) values (pr, t, new.data) returning id into new.attivita_id;
  end if;
  return new;
end;
$$;
drop trigger if exists passi_prima on public.passi;
create trigger passi_prima before insert on public.passi
for each row execute function public.passi_prima();

create or replace function public.passi_dopo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- togliendo il passo si toglie l'attività contata; in un mese già chiuso resta (lo storico non cambia).
  -- Togliendo la persona dalla lista, invece, i numeri già contati restano.
  if tg_op = 'DELETE' and old.attivita_id is not null
     and exists (select 1 from public.persone where id = old.persona_id) then
    begin
      delete from public.activities where id = old.attivita_id;
    exception when others then null;
    end;
  end if;
  perform public.persona_ricalcola(coalesce(new.persona_id, old.persona_id));
  return null;
end;
$$;
drop trigger if exists passi_dopo on public.passi;
create trigger passi_dopo after insert or update or delete on public.passi
for each row execute function public.passi_dopo();

-- ---- Solo il proprietario ----
alter table public.persone enable row level security;
alter table public.passi enable row level security;

revoke all on public.persone, public.passi from anon, authenticated;
grant select, delete on public.persone to authenticated;
grant insert (id, nome, contatto, origine, note, prossima_data, prossima_nota) on public.persone to authenticated;
grant update (nome, contatto, origine, note, prossima_data, prossima_nota) on public.persone to authenticated;
grant select, delete on public.passi to authenticated;
grant insert (id, persona_id, tipo, data, come, reazione, esito, nota, importato) on public.passi to authenticated;
grant update (come, reazione, nota) on public.passi to authenticated;

drop policy if exists persone_mie on public.persone;
create policy persone_mie on public.persone for all to authenticated
  using (proprietario = public.my_partner_id()) with check (proprietario = public.my_partner_id());
drop policy if exists passi_miei on public.passi;
create policy passi_miei on public.passi for all to authenticated
  using (proprietario = public.my_partner_id()) with check (proprietario = public.my_partner_id());

-- ---- Per lo sponsor e l'upline: solo i numeri, mai i nomi ----
create or replace function public.numeri_persone(p_partner uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  m date := date_trunc('month', (now() at time zone 'Europe/Rome')::date)::date;
begin
  if public.my_partner_id() is null or not public.vedo(p_partner) then
    raise exception 'non_autorizzato';
  end if;
  return jsonb_build_object(
    'in_lista',  (select count(*) from public.persone where proprietario = p_partner and esito is null and fase = 'lista'),
    'in_corso',  (select count(*) from public.persone where proprietario = p_partner and esito is null and fase <> 'lista'),
    'piani_mese', (select count(*) from public.passi where proprietario = p_partner and tipo = 'piano' and data >= m),
    'si_mese',   (select count(*) from public.passi where proprietario = p_partner and tipo = 'chiusura'
                    and esito in ('partner', 'cliente') and data >= m),
    'totale',    (select count(*) from public.persone where proprietario = p_partner));
end;
$$;

revoke execute on function public.persona_ricalcola(uuid), public.passi_prima(), public.passi_dopo(),
  public.numeri_persone(uuid) from public, anon, authenticated;
grant execute on function public.numeri_persone(uuid) to authenticated;

-- ============================================================
-- Growup Team — 021: la Lista su Io (18 ottobre 2026).
-- Su Io compaiono come promemoria tutte le persone con cui è iniziato un percorso (da Contattato in poi).
-- Ognuno può toglierne una da Io e rimetterla dalla sua scheda: è solo una sua scelta di vista.

alter table public.persone add column if not exists nascosta_io boolean not null default false;
grant update (nascosta_io) on public.persone to authenticated;

-- ============================================================
-- Growup Team — 022: il Target dentro Growup (18 ottobre 2026).
-- Le otto domande per chi non conosci (dalla mini app "Target"): il partner crea un invito, lo manda su WhatsApp,
-- il contatto risponde da una pagina di Growup senza accesso e rimanda il codice delle risposte su WhatsApp.
-- Gli inviti li vede solo chi li crea (come la Lista). Il contatto non scrive niente nel database: può solo chiedere
-- se il suo link è ancora aperto (invito_target_aperto), con un identificativo casuale di 6 caratteri.

create table if not exists public.inviti_target (
  id            text primary key check (id ~ '^[A-Z0-9]{6}$'),
  proprietario  uuid not null default public.my_partner_id() references public.partners(id) on delete cascade,
  nome          text not null check (length(btrim(nome)) between 1 and 80),
  scade         date,
  bloccato      boolean not null default false,
  -- le otto risposte (0, 1 o 2 per domanda), quando il partner apre il codice ricevuto
  risposte      smallint[] check (risposte is null or (array_length(risposte, 1) = 8 and 0 <= all(risposte) and 2 >= all(risposte))),
  risposto_il   timestamptz,
  versione      text check (length(versione) <= 20),
  persona_id    uuid references public.persone(id) on delete set null,
  archiviato    boolean not null default false,
  creato_il     timestamptz not null default now()
);
create index if not exists inviti_target_proprietario_idx on public.inviti_target (proprietario);

alter table public.persone add column if not exists invito_target_id text references public.inviti_target(id) on delete set null;
grant insert (invito_target_id) on public.persone to authenticated;

create or replace function public.inviti_target_prima()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.creato_il := now();
    new.risposte := null; new.risposto_il := null; new.persona_id := null;
  else
    new.id := old.id;
    new.proprietario := old.proprietario;
    new.creato_il := old.creato_il;
    if new.risposte is distinct from old.risposte then new.risposto_il := now(); end if;
  end if;
  return new;
end;
$$;
drop trigger if exists inviti_target_prima on public.inviti_target;
create trigger inviti_target_prima before insert or update on public.inviti_target
for each row execute function public.inviti_target_prima();

alter table public.inviti_target enable row level security;
revoke all on public.inviti_target from anon, authenticated;
grant select, delete on public.inviti_target to authenticated;
grant insert (id, nome, scade) on public.inviti_target to authenticated;
grant update (nome, scade, bloccato, risposte, versione, persona_id, archiviato) on public.inviti_target to authenticated;
drop policy if exists inviti_target_miei on public.inviti_target;
create policy inviti_target_miei on public.inviti_target for all to authenticated
  using (proprietario = public.my_partner_id()) with check (proprietario = public.my_partner_id());

-- Per la pagina del contatto: il link è ancora aperto? (niente nomi, niente risposte)
create or replace function public.invito_target_aperto(p_id text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select case when i.bloccato then 'bloccato'
                               when i.risposte is not null then 'usato'
                               when i.scade < (now() at time zone 'Europe/Rome')::date then 'scaduto'
                               else 'ok' end
                     from public.inviti_target i where i.id = upper(p_id)), 'sconosciuto')
$$;
revoke execute on function public.invito_target_aperto(text), public.inviti_target_prima(),
  public.persone_prima() from public, anon, authenticated;  -- persone_prima: la funzione del trigger della Lista (020)
grant execute on function public.invito_target_aperto(text) to anon, authenticated;

-- ============================================================
-- Growup Team — 023: il Target anche per chi è già nella Lista (18 ottobre 2026).
-- Dalla scheda di una persona della lista si può mandarle le otto domande: l'invito si collega alla persona.

grant update (invito_target_id) on public.persone to authenticated;

-- ============================================================
-- Growup Team — 024: i Clienti dentro Growup (18 ottobre 2026).
-- Dalla mini app "Clienti e Riordini": chi ha preso cosa e quando, quando finisce, chi è da sentire.
-- Un cliente è una persona della Lista chiusa come "Cliente" (una sola scheda per tutto il percorso).
-- Gli ordini NON contano nei VP del mese (decisione di Stefano: i VP arrivano dal report Amway o da "+ Ordine").
-- Tutto visibile solo a chi lo scrive, come la Lista.

alter table public.persone add column if not exists compleanno text check (compleanno ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$');
alter table public.persone add column if not exists auguri_anno int check (auguri_anno between 2020 and 2100);
alter table public.persone add column if not exists non_compra boolean not null default false;
alter table public.persone add column if not exists lasciati text[] not null default '{}';  -- prodotti che non segue più
grant insert (compleanno) on public.persone to authenticated;
grant update (compleanno, auguri_anno, non_compra, lasciati) on public.persone to authenticated;

create table if not exists public.ordini (
  id            uuid primary key default gen_random_uuid(),
  proprietario  uuid not null default public.my_partner_id() references public.partners(id) on delete cascade,
  persona_id    uuid not null references public.persone(id) on delete cascade,
  data          date not null default (now() at time zone 'Europe/Rome')::date check (data >= date '2000-01-01'),
  modo          text not null default 'sito' check (modo in ('sito', 'io')),   -- dal sito Amway da solo, o fatto da me
  consegnato    date,
  pagato        date,
  verificato    date,   -- "come ti sei trovato" fatto
  nota          text check (length(nota) <= 500),
  creato_il     timestamptz not null default now()
);
create index if not exists ordini_persona_idx on public.ordini (persona_id, data);

create table if not exists public.righe_ordine (
  id            uuid primary key default gen_random_uuid(),
  ordine_id     uuid not null references public.ordini(id) on delete cascade,
  proprietario  uuid not null default public.my_partner_id() references public.partners(id) on delete cascade,
  codice        text not null check (length(codice) between 1 and 20),
  nome          text not null check (length(nome) between 1 and 160),
  quantita      int not null default 1 check (quantita between 1 and 99),
  prezzo        numeric(10,2) check (prezzo >= 0 and prezzo <= 100000)
);
create index if not exists righe_ordine_idx on public.righe_ordine (ordine_id);

-- quanto dura un prodotto per me (di base 30 giorni): vale per tutti i miei clienti
create table if not exists public.durate (
  proprietario  uuid not null default public.my_partner_id() references public.partners(id) on delete cascade,
  codice        text not null check (length(codice) between 1 and 20),
  giorni        int not null check (giorni between 1 and 3650),
  primary key (proprietario, codice)
);

-- l'ordine e le righe sono di chi ha la persona; nessuno scrive sulle persone degli altri
create or replace function public.ordini_prima()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pr uuid;
begin
  if tg_table_name = 'ordini' then
    select proprietario into pr from public.persone where id = new.persona_id;
  else
    select proprietario into pr from public.ordini where id = new.ordine_id;
  end if;
  if pr is null or (auth.uid() is not null and pr is distinct from public.my_partner_id()) then
    raise exception 'non_autorizzato';
  end if;
  new.proprietario := pr;
  return new;
end;
$$;
drop trigger if exists ordini_prima on public.ordini;
create trigger ordini_prima before insert on public.ordini for each row execute function public.ordini_prima();
drop trigger if exists righe_ordine_prima on public.righe_ordine;
create trigger righe_ordine_prima before insert on public.righe_ordine for each row execute function public.ordini_prima();

alter table public.ordini enable row level security;
alter table public.righe_ordine enable row level security;
alter table public.durate enable row level security;
revoke all on public.ordini, public.righe_ordine, public.durate from anon, authenticated;
grant select, delete on public.ordini, public.righe_ordine, public.durate to authenticated;
grant insert (id, persona_id, data, modo, consegnato, pagato, nota) on public.ordini to authenticated;
grant update (data, modo, consegnato, pagato, verificato, nota) on public.ordini to authenticated;
grant insert (id, ordine_id, codice, nome, quantita, prezzo) on public.righe_ordine to authenticated;
grant update (quantita, prezzo) on public.righe_ordine to authenticated;
grant insert (codice, giorni) on public.durate to authenticated;
grant update (giorni) on public.durate to authenticated;

drop policy if exists ordini_miei on public.ordini;
create policy ordini_miei on public.ordini for all to authenticated
  using (proprietario = public.my_partner_id()) with check (proprietario = public.my_partner_id());
drop policy if exists righe_ordine_mie on public.righe_ordine;
create policy righe_ordine_mie on public.righe_ordine for all to authenticated
  using (proprietario = public.my_partner_id()) with check (proprietario = public.my_partner_id());
drop policy if exists durate_mie on public.durate;
create policy durate_mie on public.durate for all to authenticated
  using (proprietario = public.my_partner_id()) with check (proprietario = public.my_partner_id());

revoke execute on function public.ordini_prima() from public, anon, authenticated;

-- I numeri per sponsor e upline: anche quanti clienti (mai i nomi)
create or replace function public.numeri_persone(p_partner uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  m date := date_trunc('month', (now() at time zone 'Europe/Rome')::date)::date;
begin
  if public.my_partner_id() is null or not public.vedo(p_partner) then
    raise exception 'non_autorizzato';
  end if;
  return jsonb_build_object(
    'in_lista',  (select count(*) from public.persone where proprietario = p_partner and esito is null and fase = 'lista'),
    'in_corso',  (select count(*) from public.persone where proprietario = p_partner and esito is null and fase <> 'lista'),
    'piani_mese', (select count(*) from public.passi where proprietario = p_partner and tipo = 'piano' and data >= m),
    'si_mese',   (select count(*) from public.passi where proprietario = p_partner and tipo = 'chiusura'
                    and esito in ('partner', 'cliente') and data >= m),
    'clienti',   (select count(*) from public.persone where proprietario = p_partner and esito = 'cliente' and not non_compra),
    'totale',    (select count(*) from public.persone where proprietario = p_partner));
end;
$$;

-- ============================================================
-- Growup Team — 025: gli ordini dei clienti dal sito Amway (19 ottobre 2026).
-- Il partner carica l'export "Ordini" del sito Amway (letto solo sul telefono): per ogni ordine nome, codice cliente,
-- data, numero d'ordine, VP e valore. I prodotti non ci sono: il partner li aggiunge a mano se vuole.
-- Il numero d'ordine evita di importare due volte lo stesso ordine (l'export parte sempre da settembre).

alter table public.persone add column if not exists codice_cliente text check (codice_cliente ~ '^[0-9]{4,15}$');
grant insert (codice_cliente) on public.persone to authenticated;
grant update (codice_cliente) on public.persone to authenticated;

alter table public.ordini add column if not exists numero_amway text check (numero_amway ~ '^[0-9]{4,20}$');
alter table public.ordini add column if not exists importo numeric(10,2) check (importo >= 0 and importo <= 100000);
alter table public.ordini add column if not exists vp numeric(10,2) check (vp >= 0 and vp <= 100000);
create unique index if not exists ordini_numero_amway_idx on public.ordini (proprietario, numero_amway) where numero_amway is not null;
grant insert (numero_amway, importo, vp) on public.ordini to authenticated;

-- Growup Team — 026: l'elenco dei clienti dal sito Amway (19 ottobre 2026).
-- Oltre all'export "Ordini", il partner può caricare l'export "Clienti" (letto solo sul telefono): si prendono solo nome,
-- codice cliente, telefono e data dell'ultimo ordine (niente email, niente indirizzo). L'ultimo ordine entra nello storico
-- senza numero; quando poi arriva l'export "Ordini" con lo stesso ordine, l'app ci scrive numero, valore e VP invece di
-- crearne un secondo: per questo servono i permessi di modifica su quelle tre colonne (sempre e solo sui propri ordini).

grant update (numero_amway, importo, vp) on public.ordini to authenticated;

-- Growup Team — 027: chi entra va confermato dal report Amway; si può togliere finché non lo è; l'admin blocca l'app (19 ottobre 2026).
--   - Chi usa l'app è "Da confermare" finché il suo codice Amway non compare in un report mappe importato (da lui stesso,
--     dal suo sponsor o da un upline). Chi prende il posto di una persona già importata è confermato subito.
--     Decisione di Stefano: anche chi è già nell'app riparte "Da confermare" (gli admin no).
--   - Finché è da confermare, sponsor, upline e admin possono toglierlo dalla struttura: il profilo e tutti i suoi dati
--     si cancellano, i suoi telefoni vedono "accesso tolto", il suo codice Amway non può rientrare finché un admin non
--     lo sblocca, e chi aveva già invitato passa sotto il suo sponsor. Dopo la conferma vale di nuovo "nessuno cancella".
--   - L'admin blocca e sblocca l'app di chiunque (non di sé né di un altro admin): il blocco è nel database
--     (my_partner_id non risponde più), i dati restano e i VP contano. Sponsor e upline vedono "Bloccato".

alter table public.partners add column if not exists confermato_il timestamptz;
alter table public.partners add column if not exists bloccato_il timestamptz;
alter table public.partners add column if not exists bloccato_da uuid references public.partners(id) on delete set null;
update public.partners set confermato_il = coalesce(confermato_il, now()) where is_admin;

-- i codici tolti (non rientrano) e i telefoni a cui è stato tolto l'accesso: li leggono solo le funzioni qui sotto
create table if not exists public.codici_tolti (
  codice_amway  text primary key,
  nome          text,
  tolto_il      timestamptz not null default now(),
  tolto_da      uuid references public.partners(id) on delete set null
);
create table if not exists public.accessi_tolti (
  user_id   uuid primary key,
  tolto_il  timestamptz not null default now()
);
alter table public.codici_tolti enable row level security;
alter table public.accessi_tolti enable row level security;
revoke all on public.codici_tolti, public.accessi_tolti from anon, authenticated;

-- un profilo bloccato non risponde più: niente dati, niente funzioni
create or replace function public.my_partner_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select a.partner_id from public.accessi a join public.partners p on p.id = a.partner_id
   where a.user_id = auth.uid() and p.bloccato_il is null
$$;

-- confermato dal report: ogni volta che l'import salva i numeri di chi usa l'app
create or replace function public.salva_numeri_report(p_chi uuid, p_partner uuid, p_mese date, r jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  update public.partners set confermato_il = now()
   where id = p_partner and stato <> 'gestito' and confermato_il is null;
  if r ? 'vpg' then
    insert into public.numeri_report (visto_da, partner_id, mese, vpp, vpg, percentuale, linee, linee_nascoste)
    values (p_chi, p_partner, date_trunc('month', p_mese)::date, coalesce((r->>'vpp')::numeric, 0),
            coalesce((r->>'vpg')::numeric, 0), nullif(r->>'percentuale', '')::int,
            case when jsonb_typeof(r->'linee') = 'array' then r->'linee' else '[]' end,
            coalesce((r->>'nascoste')::boolean, false))
    on conflict (visto_da, partner_id, mese) do update
      set vpp = excluded.vpp, vpg = excluded.vpg, percentuale = excluded.percentuale,
          linee = excluded.linee, linee_nascoste = excluded.linee_nascoste, aggiornato_il = now();
  end if;
end;
$$;

-- chi prende il posto di una persona già importata è confermato; un codice tolto non rientra
create or replace function public.partners_conferma()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.stato = 'gestito' and new.stato <> 'gestito' then
    new.confermato_il := coalesce(new.confermato_il, now());
  end if;
  if new.stato <> 'gestito' and new.codice_amway is not null
     and (tg_op = 'INSERT' or new.codice_amway is distinct from old.codice_amway or old.stato = 'gestito')
     and exists (select 1 from public.codici_tolti where codice_amway = new.codice_amway) then
    raise exception 'codice_tolto';
  end if;
  return new;
end;
$$;
drop trigger if exists partners_conferma on public.partners;
create trigger partners_conferma before insert or update on public.partners
for each row execute function public.partners_conferma();

-- conferma e blocco di chi vedo nella struttura (le etichette "Da confermare" e "Bloccato")
create or replace function public.accessi_struttura()
returns table (id uuid, confermato_il timestamptz, bloccato_il timestamptz, is_admin boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.confermato_il, p.bloccato_il, p.is_admin from public.partners p
   where p.stato <> 'gestito' and public.vedo(p.id)
$$;

-- il telefono: perché non c'è più un profilo (tolto dalla struttura o bloccato)
create or replace function public.stato_accesso()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (select 1 from public.accessi a join public.partners p on p.id = a.partner_id
                  where a.user_id = auth.uid() and p.bloccato_il is not null) then 'bloccato'
    when exists (select 1 from public.accessi_tolti where user_id = auth.uid()) then 'tolto'
    else null end
$$;

-- togliere dalla struttura chi non è ancora confermato: sponsor, upline e admin
create or replace function public.togli_dalla_struttura(p_partner uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  io  uuid := public.my_partner_id();
  t   public.partners;
  via uuid[];
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  select * into t from public.partners where id = p_partner;
  if not found or t.stato = 'gestito' or t.id = io or t.is_admin then
    raise exception 'non_autorizzato';
  end if;
  if not (public.sono_admin() or public.is_in_downline(t.id)) then
    raise exception 'non_autorizzato';
  end if;
  if t.confermato_il is not null then
    raise exception 'gia_confermato';
  end if;
  -- le persone importate da lui (solo sue) se ne vanno con lui; chi aveva invitato passa al suo sponsor
  via := array(select id from public.partners where gestore_id = t.id and stato = 'gestito') || t.id;
  update public.partners set sponsor_id = t.sponsor_id where sponsor_id = any(via) and not (id = any(via));
  update public.partners set gestore_id = null where gestore_id = any(via) and not (id = any(via));
  update public.partners set creato_da = null where creato_da = any(via) and not (id = any(via));
  update public.partners set bloccato_da = null where bloccato_da = any(via);
  if t.codice_amway is not null then
    insert into public.codici_tolti (codice_amway, nome, tolto_da) values (t.codice_amway, t.nome, io)
    on conflict (codice_amway) do update set nome = excluded.nome, tolto_il = now(), tolto_da = excluded.tolto_da;
  end if;
  insert into public.accessi_tolti (user_id) select user_id from public.accessi where partner_id = t.id
  on conflict (user_id) do update set tolto_il = now();
  delete from public.partners where id = any(via);
end;
$$;

-- l'admin blocca o sblocca l'app di qualcuno
create or replace function public.blocca_app(p_partner uuid, p_blocca boolean)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  io uuid := public.my_partner_id();
  t  public.partners;
begin
  if io is null or not public.sono_admin() then
    raise exception 'non_autorizzato';
  end if;
  select * into t from public.partners where id = p_partner;
  if not found or t.stato = 'gestito' or t.id = io or t.is_admin then
    raise exception 'non_autorizzato';
  end if;
  update public.partners
     set bloccato_il = case when p_blocca then coalesce(bloccato_il, now()) end,
         bloccato_da = case when p_blocca then io end
   where id = t.id;
end;
$$;

-- i codici tolti: l'admin li vede e li sblocca
create or replace function public.codici_tolti_elenco()
returns table (codice_amway text, nome text, tolto_il timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.sono_admin() then
    raise exception 'non_autorizzato';
  end if;
  return query select c.codice_amway, c.nome, c.tolto_il from public.codici_tolti c order by c.tolto_il desc;
end;
$$;
create or replace function public.sblocca_codice(p_codice text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.sono_admin() then
    raise exception 'non_autorizzato';
  end if;
  delete from public.codici_tolti where codice_amway = p_codice;
end;
$$;

grant select (confermato_il, bloccato_il) on public.partners to authenticated;
revoke execute on function public.partners_conferma(), public.accessi_struttura(), public.stato_accesso(),
  public.togli_dalla_struttura(uuid), public.blocca_app(uuid, boolean), public.codici_tolti_elenco(),
  public.sblocca_codice(text), public.salva_numeri_report(uuid, uuid, date, jsonb) from public, anon, authenticated;
grant execute on function public.accessi_struttura(), public.stato_accesso(), public.togli_dalla_struttura(uuid),
  public.blocca_app(uuid, boolean), public.codici_tolti_elenco(), public.sblocca_codice(text) to authenticated;

-- Growup Team — 028: il listino Amway nel database (20 ottobre 2026).
-- Il listino è "per l'incaricato": non sta più nel repository pubblico (catalogo.js tolto), ma qui, leggibile solo da chi
-- usa l'app (chi è bloccato no). Lo scrive solo l'admin: a mano (prodotti nuovi) o dal PDF Amway letto sul telefono.
-- Per ogni prodotto: prezzo al cliente, prezzo Partner e VP. I prodotti usciti dal listino non si cancellano: "attivo"
-- diventa falso (spariscono dalla ricerca, restano negli ordini già fatti).
-- Le righe degli ordini tengono anche prezzo Partner e VP del momento (i VP del mese restano quelli del report Amway).

create table if not exists public.listino (
  codice          text primary key check (codice ~ '^[0-9]{4,10}$'),
  nome            text not null check (length(btrim(nome)) between 1 and 200),
  formato         text check (length(formato) <= 80),
  categoria       text check (length(categoria) <= 120),
  prezzo_cliente  numeric(10,2) check (prezzo_cliente >= 0 and prezzo_cliente <= 100000),
  prezzo_partner  numeric(10,2) check (prezzo_partner >= 0 and prezzo_partner <= 100000),
  vp              numeric(10,2) check (vp >= 0 and vp <= 100000),
  attivo          boolean not null default true,
  aggiornato_il   timestamptz not null default now()
);

create or replace function public.listino_prima()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.aggiornato_il := now();
  return new;
end;
$$;
drop trigger if exists listino_prima on public.listino;
create trigger listino_prima before insert or update on public.listino
for each row execute function public.listino_prima();

alter table public.listino enable row level security;
revoke all on public.listino from anon, authenticated;
grant select on public.listino to authenticated;
grant insert (codice, nome, formato, categoria, prezzo_cliente, prezzo_partner, vp, attivo) on public.listino to authenticated;
-- anche codice: il salvataggio dall'app è un "inserisci o aggiorna" (upsert) che riscrive tutte le colonne
grant update (codice, nome, formato, categoria, prezzo_cliente, prezzo_partner, vp, attivo) on public.listino to authenticated;
drop policy if exists listino_leggo on public.listino;
create policy listino_leggo on public.listino for select to authenticated using (public.my_partner_id() is not null);
drop policy if exists listino_admin_nuovo on public.listino;
create policy listino_admin_nuovo on public.listino for insert to authenticated with check (public.sono_admin());
drop policy if exists listino_admin_cambia on public.listino;
create policy listino_admin_cambia on public.listino for update to authenticated
  using (public.sono_admin()) with check (public.sono_admin());
revoke execute on function public.listino_prima() from public, anon, authenticated;

-- le righe degli ordini: anche prezzo Partner e VP (per unità), per i totali dell'ordine
alter table public.righe_ordine add column if not exists prezzo_partner numeric(10,2) check (prezzo_partner >= 0 and prezzo_partner <= 100000);
alter table public.righe_ordine add column if not exists vp numeric(10,2) check (vp >= 0 and vp <= 100000);
grant insert (prezzo_partner, vp) on public.righe_ordine to authenticated;
grant update (prezzo_partner, vp) on public.righe_ordine to authenticated;

-- Growup Team — 029: i "sì" del mese divisi in partner e clienti (21 ottobre 2026).
-- Decisione di Stefano: "1 piano e 3 sì" confondeva (i sì contano anche i clienti aggiunti con "+ Un cliente" e quelli
-- importati dal sito Amway). Ora sponsor e upline vedono quanti nuovi partner e quanti nuovi clienti nel mese.
-- Si aggiungono due numeri; "si_mese" resta (la somma) per le versioni vecchie dell'app.

create or replace function public.numeri_persone(p_partner uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  m date := date_trunc('month', (now() at time zone 'Europe/Rome')::date)::date;
begin
  if public.my_partner_id() is null or not public.vedo(p_partner) then
    raise exception 'non_autorizzato';
  end if;
  return jsonb_build_object(
    'in_lista',  (select count(*) from public.persone where proprietario = p_partner and esito is null and fase = 'lista'),
    'in_corso',  (select count(*) from public.persone where proprietario = p_partner and esito is null and fase <> 'lista'),
    'piani_mese', (select count(*) from public.passi where proprietario = p_partner and tipo = 'piano' and data >= m),
    'si_mese',   (select count(*) from public.passi where proprietario = p_partner and tipo = 'chiusura'
                    and esito in ('partner', 'cliente') and data >= m),
    'partner_mese', (select count(*) from public.passi where proprietario = p_partner and tipo = 'chiusura'
                    and esito = 'partner' and data >= m),
    'clienti_mese', (select count(*) from public.passi where proprietario = p_partner and tipo = 'chiusura'
                    and esito = 'cliente' and data >= m),
    'clienti',   (select count(*) from public.persone where proprietario = p_partner and esito = 'cliente' and not non_compra),
    'totale',    (select count(*) from public.persone where proprietario = p_partner));
end;
$$;

-- Growup Team — 030: le qualifiche annuali oltre Argento e la prossima qualifica (21 ottobre 2026).
-- Dal documento Amway "Livelli di Qualifica" (dicembre 2025): da Oro a Diamante Fondatore. Si dichiarano (non si
-- calcolano dai numeri del mese: contano i mesi del Performance Year, 1° settembre - 31 agosto).
-- Chi dichiara Platino o più sceglie la prossima qualifica che vuole ottenere: la vedono anche sponsor e upline.
-- Solo aggiunte: nessun drop, nessuna cancellazione.

insert into public.stage_requirements (ordine, chiave, nome, descrizione) values
  (9,  'oro',                'Oro',                '3 mesi da Argento nel Performance Year, anche non consecutivi (la prima volta: in 12 mesi consecutivi)'),
  (10, 'platino',            'Platino',            '6 mesi da Argento nel Performance Year (la prima volta: in 12 mesi consecutivi, 3 dei quali consecutivi)'),
  (11, 'platino_fondatore',  'Platino Fondatore',  '12 mesi da Argento nel Performance Year, oppure 10-11 mesi e 144.000 VP di Volume Equivalente'),
  (12, 'rubino',             'Rubino',             'Da Platino: almeno 20.000 VP di Volume Rubino in un mese'),
  (13, 'rubino_fondatore',   'Rubino Fondatore',   'Da Platino: Rubino in tutti i 12 mesi del Performance Year'),
  (14, 'zaffiro',            'Zaffiro',            '6 mesi Zaffiro nel Performance Year: 4.000 VP di gruppo e 2 linee al 21%, oppure 3 linee al 21%'),
  (15, 'zaffiro_fondatore',  'Zaffiro Fondatore',  '12 mesi Zaffiro nel Performance Year, oppure 10-11 mesi e 345.600 VP di Volume Equivalente'),
  (16, 'smeraldo',           'Smeraldo',           'Da Platino: 3 linee frontali al 21% per almeno 6 mesi del Performance Year'),
  (17, 'smeraldo_fondatore', 'Smeraldo Fondatore', 'Da Platino: 3 linee frontali al 21% per tutti i 12 mesi del Performance Year'),
  (18, 'diamante',           'Diamante',           'Da Smeraldo: 6 linee frontali al 21% per almeno 6 mesi del Performance Year'),
  (19, 'diamante_fondatore', 'Diamante Fondatore', 'Da Smeraldo: 6 linee frontali al 21% per tutti i 12 mesi del Performance Year')
on conflict (chiave) do nothing;

-- La qualifica del mese (dai numeri dell'app o dal report) si calcola solo fino ad Argento: le qualifiche annuali
-- non hanno requisiti del mese e si dichiarano. Stesse funzioni della 017, con un limite in più.
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
    select p.id, (p.stato <> 'gestito' or p.gestore_id = p_chi),
           case when t.visibile then t.id else t.sponsor_visibile end
    from public.partners p join tutto t on p.sponsor_id = t.id
  ),
  albero(id, sponsor_id) as (
    select id, sponsor_visibile from tutto where visibile
  ),
  sotto(antenato, discendente) as (
    select id, id from albero
    union all
    select s.antenato, a.id from sotto s join albero a on a.sponsor_id = s.discendente
  ),
  personali as (
    select a.id, a.sponsor_id,
           coalesce((select sum(x.vp) from public.activities x
                      where x.partner_id = a.id and x.tipo in ('ordine', 'rettifica')
                        and x.data >= date_trunc('month', p_mese)::date
                        and x.data < (date_trunc('month', p_mese) + interval '1 month')::date), 0) as vp
    from albero a
  ),
  gruppo as (
    select s.antenato as id, sum(p.vp) as vp
    from sotto s join personali p on p.id = s.discendente
    group by s.antenato
  ),
  soglia as (
    select coalesce((select (valore #>> '{}')::numeric from public.settings where chiave = 'soglia_linea_attiva'), 100) as v
  ),
  base as (
    select p.id, p.sponsor_id, p.vp as vp_personali, g.vp as vp_gruppo
    from personali p join gruppo g on g.id = p.id
  )
  select b.id, b.sponsor_id, b.vp_personali, b.vp_gruppo,
         (select count(*)::int from base f, soglia where f.sponsor_id = b.id and f.vp_gruppo >= soglia.v),
         (select max(l.percentuale) from public.percent_levels l where l.vp_gruppo <= b.vp_gruppo),
         (select s.chiave from public.stage_requirements s, soglia
           where s.ordine >= 3
             and s.ordine <= (select x.ordine from public.stage_requirements x where x.chiave = 'argento')
             and b.vp_personali >= s.vp_personali
             and (s.vp_gruppo is null or b.vp_gruppo >= s.vp_gruppo)
             and (s.linee is null or
                  (select count(*) from base f where f.sponsor_id = b.id
                     and f.vp_gruppo >= coalesce(s.vp_linea, soglia.v)) >= s.linee)
           order by s.ordine desc limit 1)
  from base b
$$;

create or replace function public.qualifica_report(p_vpp numeric, p_vpg numeric, p_linee jsonb)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select s.chiave from public.stage_requirements s,
         (select coalesce((select (valore #>> '{}')::numeric from public.settings where chiave = 'soglia_linea_attiva'), 100) as v) soglia
   where s.ordine >= 3
     and s.ordine <= (select x.ordine from public.stage_requirements x where x.chiave = 'argento')
     and p_vpp >= s.vp_personali
     and (s.vp_gruppo is null or p_vpg >= s.vp_gruppo)
     and (s.linee is null or
          (select count(*) from jsonb_array_elements(p_linee) l
            where (l->>'vpg')::numeric >= coalesce(s.vp_linea, soglia.v)) >= s.linee)
   order by s.ordine desc limit 1
$$;

alter table public.partners add column if not exists prossima_qualifica text references public.stage_requirements(chiave);
grant select (prossima_qualifica) on public.partners to authenticated;

/* la prossima qualifica: solo per sé, solo da Platino in su e solo una qualifica sopra quella dichiarata (null la toglie) */
create or replace function public.imposta_prossima_qualifica(p_chiave text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  io  uuid := public.my_partner_id();
  p   public.partners;
  mia int;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  select s.ordine into mia from public.partners x join public.stage_requirements s on s.chiave = x.qualifica_iniziale where x.id = io;
  if p_chiave is not null and (coalesce(mia, 0) < (select ordine from public.stage_requirements where chiave = 'platino')
     or not exists (select 1 from public.stage_requirements s where s.chiave = p_chiave and s.ordine > mia)) then
    raise exception 'qualifica_non_valida';
  end if;
  update public.partners set prossima_qualifica = p_chiave where id = io returning * into p;
  return to_jsonb(p) - 'chiave_hash';
end;
$$;

/* cambiando il punto di partenza, la prossima qualifica resta solo se è ancora valida */
create or replace function public.modifica_partenza(
  p_qualifica        text default null,
  p_percentuale      int  default null,
  p_qualifica_mese   date default null,
  p_pagamenti        int  default 0
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  io uuid := public.my_partner_id();
  p  public.partners;
  ord int;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  if p_qualifica is not null
     and not exists (select 1 from public.stage_requirements s where s.chiave = p_qualifica) then
    raise exception 'qualifica_non_valida';
  end if;
  if p_percentuale is not null and p_percentuale not in (3, 6, 9, 12, 15, 18, 21) then
    raise exception 'percentuale_non_valida';
  end if;
  ord := (select ordine from public.stage_requirements where chiave = p_qualifica);
  update public.partners
     set qualifica_iniziale = p_qualifica,
         percentuale_iniziale = p_percentuale,
         qualifica_iniziale_mese = date_trunc('month', p_qualifica_mese)::date,
         pagamenti_iniziali = least(greatest(coalesce(p_pagamenti, 0), 0), 12),
         prossima_qualifica = case
           when coalesce(ord, 0) >= (select ordine from public.stage_requirements where chiave = 'platino')
                and (select ordine from public.stage_requirements where chiave = prossima_qualifica) > ord
           then prossima_qualifica end
   where id = io
  returning * into p;
  return to_jsonb(p) - 'chiave_hash';
end;
$$;

/* la prossima qualifica di chi vedo (io, la mia downline): sponsor e upline la leggono */
create or replace function public.prossime_qualifiche()
returns table (partner_id uuid, prossima_qualifica text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.prossima_qualifica
  from public.struttura_visibile() s join public.partners p on p.id = s.id
  where p.prossima_qualifica is not null
$$;

revoke execute on function public.imposta_prossima_qualifica(text), public.prossime_qualifiche() from public, anon, authenticated;
grant execute on function public.imposta_prossima_qualifica(text), public.prossime_qualifiche() to authenticated;
revoke execute on function public.modifica_partenza(text, int, date, int) from public, anon, authenticated;
grant execute on function public.modifica_partenza(text, int, date, int) to authenticated;

-- Growup Team — 031: i mesi da Argento dai report mappe, anche dei mesi passati (21 ottobre 2026).
-- Decisione di Stefano: il percorso prosegue Argento → Oro (3 mesi al 21%) → Platino (6 mesi, 3 di fila), contando
-- i mesi in cui il report mappe importato dà la persona al 21%. I report dei mesi chiusi si importano "solo numeri":
-- non spostano persone, non ne creano, non segnano "fuori report", non toccano i VPP.
-- Solo aggiunte: nessun drop, nessuna cancellazione.

/* i numeri del report degli ultimi 13 mesi di una persona che vedo (quelli importati da me) */
create or replace function public.mesi_report(p_partner uuid)
returns table (mese date, percentuale int, vpg numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  io uuid := public.my_partner_id();
begin
  if io is null or not public.vedo(p_partner) then
    raise exception 'non_autorizzato';
  end if;
  return query
    select n.mese, n.percentuale, n.vpg from public.numeri_report n
     where n.visto_da = io and n.partner_id = p_partner
       and n.mese >= (date_trunc('month', (now() at time zone 'Europe/Rome')::date) - interval '13 months')::date
     order by n.mese;
end;
$$;

/* il report di un mese chiuso: si salvano solo i numeri (21%, VPG, linee) per me e per chi vedo, per codice Amway.
   p_io: { codice, vpp, vpg, percentuale, linee, nascoste }; p_altri: [ { codice, vpp, vpg, percentuale, linee, nascoste } ] */
create or replace function public.salva_report_passato(p_mese date, p_io jsonb, p_altri jsonb)
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  io   uuid := public.my_partner_id();
  m    date := date_trunc('month', p_mese)::date;
  mio  text;
  r    jsonb;
  chi  uuid;
  n    int := 0;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  if m >= date_trunc('month', (now() at time zone 'Europe/Rome')::date)::date
     or m < (date_trunc('month', (now() at time zone 'Europe/Rome')::date) - interval '24 months')::date then
    raise exception 'import_non_valido';
  end if;
  if jsonb_typeof(p_altri) is distinct from 'array' or jsonb_array_length(p_altri) > 5000 then
    raise exception 'import_non_valido';
  end if;
  select codice_amway into mio from public.partners where id = io;
  if mio is null then
    raise exception 'codice_mancante';
  end if;
  if nullif(regexp_replace(coalesce(p_io->>'codice', ''), '[^0-9]', '', 'g'), '') is distinct from mio then
    raise exception 'import_di_altri';
  end if;
  perform public.salva_numeri_report(io, io, m, p_io);
  n := 1;
  for r in select * from jsonb_array_elements(p_altri) loop
    chi := null;
    select p.id into chi from public.partners p
     where p.codice_amway = r->>'codice' and p.id <> io
       and ((p.stato <> 'gestito' and public.vedo(p.id)) or (p.stato = 'gestito' and p.gestore_id = io))
     limit 1;
    if chi is not null then
      perform public.salva_numeri_report(io, chi, m, r);
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;

revoke execute on function public.mesi_report(uuid), public.salva_report_passato(date, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.mesi_report(uuid), public.salva_report_passato(date, jsonb, jsonb) to authenticated;

-- Growup Team — 032: le cifre al mese da Platino in su, e Argento senza incentivi Bronze (22 ottobre 2026).
-- Cifre indicative date da Stefano dal calcolatore dei guadagni Amway, calcolate con le linee qualificate che servono
-- alla qualifica più altre linee aperte (ideale 10.000 VP, almeno 4.000 VP). Le qualifiche Fondatori hanno la stessa
-- cifra della qualifica (è un mantenimento nel tempo): come obiettivo per la cifra l'app propone sempre quella senza
-- "Fondatore". Argento: 2.500 € al mese senza gli incentivi Bronze (circa 3.750 € se si arriva ad Argento mentre si
-- ricevono ancora). Solo aggiornamenti dei dati: nessun drop, nessuna cancellazione.

update public.stage_requirements set guadagno_mese = 2500,
  struttura_calcolo = '200 VP personali + 3 linee da 4.100 VP, senza incentivi Bronze (circa 3.750 € se arrivi ad Argento mentre ricevi ancora gli incentivi Bronze)'
 where chiave = 'argento';
update public.stage_requirements set guadagno_mese = 3000,
  struttura_calcolo = 'Argento ogni mese più altre linee aperte (ideale 10.000 VP, almeno 4.000 VP)'
 where chiave in ('platino', 'platino_fondatore');
update public.stage_requirements set guadagno_mese = 4000,
  struttura_calcolo = '20.000 VP di Volume Rubino al mese più altre linee aperte (ideale 10.000 VP, almeno 4.000 VP)'
 where chiave in ('rubino', 'rubino_fondatore');
update public.stage_requirements set guadagno_mese = 5000,
  struttura_calcolo = '2 linee al 21% più altre linee aperte (ideale 10.000 VP, almeno 4.000 VP)'
 where chiave in ('zaffiro', 'zaffiro_fondatore');
update public.stage_requirements set guadagno_mese = 8000,
  struttura_calcolo = '3 linee al 21% più altre linee aperte (ideale 10.000 VP, almeno 4.000 VP)'
 where chiave in ('smeraldo', 'smeraldo_fondatore');
update public.stage_requirements set guadagno_mese = 18000,
  struttura_calcolo = '6 linee al 21% più altre linee aperte (ideale 10.000 VP, almeno 4.000 VP)'
 where chiave in ('diamante', 'diamante_fondatore');

-- Growup Team — 033: una sola struttura, la mappa Amway (23 ottobre 2026).
-- Decisioni di Stefano: la struttura di Growup è sempre la copia della mappa ufficiale Amway, la stessa per tutti.
-- * Chi importa aggiorna posizioni e numeri di tutto il suo gruppo, anche se qualcuno sotto ha già importato.
-- * Vince il report più aggiornato: la data dei dati è la data e ora del file scaricato ("dati al"); un report più
--   vecchio di quello già salvato non cambia niente per quella persona (posizione) o per quel mese (numeri).
-- * Numeri ufficiali condivisi: una riga per persona e mese, li vedono la persona e tutta la sua upline.
-- * Persone senza app condivise: le vede tutta la upline (prima solo chi le aveva importate).
-- * Chi usa l'app ma non è ancora nella mappa ("in attesa") resta solo suo: l'upline non vede né lui né i suoi dati,
--   solo il nome nell'elenco "In attesa della mappa". Toglierlo può solo il suo sponsor diretto (o un admin).
-- * I VP personali: vale il report del mese, quando c'è; prima contano gli ordini dell'app.
-- Solo aggiunte e "create or replace": nessun drop, nessuna cancellazione. La tabella numeri_report resta (non si
-- scrive più); i numeri passano nella nuova numeri_mese.

-- ---- I numeri ufficiali: una riga per persona e mese ----
create table if not exists public.numeri_mese (
  partner_id      uuid not null references public.partners(id) on delete cascade,
  mese            date not null check (extract(day from mese) = 1),
  vpp             numeric(12,2) not null default 0,
  vpg             numeric(12,2) not null default 0,
  percentuale     int,
  linee           jsonb not null default '[]',
  linee_nascoste  boolean not null default false,
  dati_al         timestamptz not null,               -- data e ora del file del report
  importato_da    uuid references public.partners(id) on delete set null,
  aggiornato_il   timestamptz not null default now(),
  primary key (partner_id, mese)
);
alter table public.numeri_mese enable row level security;
revoke all on public.numeri_mese from anon, authenticated;
grant select on public.numeri_mese to authenticated;
create policy numeri_mese_leggo on public.numeri_mese for select to authenticated
  using (public.vedo(partner_id));

-- i numeri già importati (oggi di un solo importatore): si tiene il più recente per persona e mese
insert into public.numeri_mese (partner_id, mese, vpp, vpg, percentuale, linee, linee_nascoste, dati_al, importato_da, aggiornato_il)
select distinct on (n.partner_id, n.mese) n.partner_id, n.mese, n.vpp, n.vpg, n.percentuale, n.linee, n.linee_nascoste,
       n.aggiornato_il, n.visto_da, n.aggiornato_il
  from public.numeri_report n
 order by n.partner_id, n.mese, n.aggiornato_il desc
on conflict (partner_id, mese) do nothing;

-- la posizione nella struttura: da quale report viene (si sposta solo con un report più recente)
alter table public.partners add column if not exists posizione_al timestamptz;

/* salva i numeri di una persona per un mese, solo se il report è più recente di quello già salvato */
create or replace function public.salva_numero(p_chi uuid, p_partner uuid, p_mese date, r jsonb, p_dati_al timestamptz)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  m date := date_trunc('month', p_mese)::date;
  n int;
begin
  update public.partners set confermato_il = now()
   where id = p_partner and stato <> 'gestito' and confermato_il is null;
  if not (r ? 'vpg') then
    return false;
  end if;
  insert into public.numeri_mese (partner_id, mese, vpp, vpg, percentuale, linee, linee_nascoste, dati_al, importato_da)
  values (p_partner, m, coalesce((r->>'vpp')::numeric, 0), coalesce((r->>'vpg')::numeric, 0), nullif(r->>'percentuale', '')::int,
          case when jsonb_typeof(r->'linee') = 'array' then r->'linee' else '[]' end,
          coalesce((r->>'nascoste')::boolean, false), p_dati_al, p_chi)
  on conflict (partner_id, mese) do update
    set vpp = excluded.vpp, vpg = excluded.vpg, percentuale = excluded.percentuale, linee = excluded.linee,
        linee_nascoste = excluded.linee_nascoste, dati_al = excluded.dati_al, importato_da = excluded.importato_da,
        aggiornato_il = now()
    where public.numeri_mese.dati_al <= excluded.dati_al;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

/* la vecchia funzione (usata dalle versioni precedenti dell'app) scrive ora nei numeri condivisi */
create or replace function public.salva_numeri_report(p_chi uuid, p_partner uuid, p_mese date, r jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  perform public.salva_numero(p_chi, p_partner, p_mese, r, now());
end;
$$;

-- ---- Chi vedo: io, e nella mia downline chi è nella mappa (persone senza app e chi usa l'app confermato) ----
create or replace function public.vedo(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target = public.my_partner_id()
      or (public.is_in_downline(target)
          and exists (select 1 from public.partners p
                       where p.id = target and (p.stato = 'gestito' or p.confermato_il is not null or p.is_admin)))
$$;

/* le persone senza app le gestisce (contatti, piani, ordini a mano) chi le vede */
create or replace function public.posso_gestire(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target <> public.my_partner_id()
     and exists (select 1 from public.partners p where p.id = target and p.stato = 'gestito')
     and public.vedo(target)
$$;

create or replace function public.struttura_visibile()
returns table (id uuid, nome text, sponsor_id uuid, stato text, gestore_id uuid, creato_il timestamptz,
               ultimo_aggiornamento timestamptz, codice_amway text, codice_invito text,
               qualifica_iniziale text, percentuale_iniziale int, qualifica_iniziale_mese date,
               pagamenti_iniziali int, partenza_confermata_il timestamptz, fuori_report_dal date)
language sql
stable
security definer
set search_path = public
as $$
  with recursive albero(id, visibile, sponsor_visibile) as (
    select p.id, true, null::uuid from public.partners p where p.id = public.my_partner_id()
    union all
    select p.id, (p.stato = 'gestito' or p.confermato_il is not null or p.is_admin),
           case when a.visibile then a.id else a.sponsor_visibile end
    from public.partners p join albero a on p.sponsor_id = a.id
  )
  select p.id, p.nome, a.sponsor_visibile, p.stato, p.gestore_id, p.creato_il, p.ultimo_aggiornamento,
         p.codice_amway, p.codice_invito, p.qualifica_iniziale, p.percentuale_iniziale, p.qualifica_iniziale_mese,
         p.pagamenti_iniziali, p.partenza_confermata_il, p.fuori_report_dal
  from albero a join public.partners p on p.id = a.id
  where a.visibile
  order by p.creato_il
$$;

/* "In attesa della mappa": chi usa l'app nella mia downline ma non è ancora in un report importato (solo il nome) */
create or replace function public.in_attesa()
returns table (id uuid, nome text, sponsor_id uuid, sponsor_nome text, creato_il timestamptz, mio boolean, codice_amway text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.nome, p.sponsor_id, s.nome, p.creato_il, p.sponsor_id = public.my_partner_id(), p.codice_amway
    from public.partners p left join public.partners s on s.id = p.sponsor_id
   where p.stato <> 'gestito' and p.confermato_il is null and not p.is_admin
     and p.id <> public.my_partner_id() and public.is_in_downline(p.id)
   order by p.creato_il
$$;

/* togliere chi è in attesa: solo il suo sponsor diretto (o un admin) */
create or replace function public.togli_dalla_struttura(p_partner uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  io  uuid := public.my_partner_id();
  t   public.partners;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  select * into t from public.partners where id = p_partner;
  if not found or t.stato = 'gestito' or t.id = io or t.is_admin then
    raise exception 'non_autorizzato';
  end if;
  if not (public.sono_admin() or t.sponsor_id = io) then
    raise exception 'non_autorizzato';
  end if;
  if t.confermato_il is not null then
    raise exception 'gia_confermato';
  end if;
  -- chi aveva invitato passa al suo sponsor; le persone senza app restano nella struttura (sono della mappa)
  update public.partners set sponsor_id = t.sponsor_id where sponsor_id = t.id;
  update public.partners set gestore_id = null where gestore_id = t.id;
  update public.partners set creato_da = null where creato_da = t.id;
  update public.partners set bloccato_da = null where bloccato_da = t.id;
  if t.codice_amway is not null then
    insert into public.codici_tolti (codice_amway, nome, tolto_da) values (t.codice_amway, t.nome, io)
    on conflict (codice_amway) do update set nome = excluded.nome, tolto_il = now(), tolto_da = excluded.tolto_da;
  end if;
  insert into public.accessi_tolti (user_id) select user_id from public.accessi where partner_id = t.id
  on conflict (user_id) do update set tolto_il = now();
  delete from public.partners where id = t.id;
end;
$$;

-- ---- L'import della mappa: aggiorna tutto il mio gruppo, vince il report più aggiornato ----
/* p_io: { codice, vpp, vpg, percentuale, linee, nascoste }
   p_persone: [{ codice, nome, sponsor, vpp, vpg, percentuale, linee, nascoste }] in ordine dal più vicino a me
   (sponsor = codice del primo sopra di lui nel report: io o una persona già nella lista)
   p_nascondi: codici delle persone nuove da nascondere per me; p_fuori: persone mie non più nel report */
create or replace function public.importa_mappa(p_mese date, p_dati_al timestamptz, p_io jsonb, p_persone jsonb,
                                                p_nascondi text[], p_fuori uuid[])
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  io        uuid := public.my_partner_id();
  me        public.partners;
  m         date := date_trunc('month', p_mese)::date;
  al        timestamptz := least(coalesce(p_dati_al, now()), now());
  cod       text;
  r         jsonb;
  x         public.partners;
  sp        uuid;
  aggiunte  int := 0;
  spostate  int := 0;
  fuori     int := 0;
  numeri    int := 0;
  vecchi    int := 0;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  select * into me from public.partners where id = io;
  -- chi non è ancora nella mappa non può cambiare la struttura degli altri
  if me.confermato_il is null and not me.is_admin then
    raise exception 'in_attesa';
  end if;
  if jsonb_typeof(p_persone) is distinct from 'array' or jsonb_array_length(p_persone) > 5000 then
    raise exception 'import_non_valido';
  end if;
  cod := nullif(regexp_replace(coalesce(p_io->>'codice', ''), '[^0-9]', '', 'g'), '');
  if me.codice_amway is null and cod is not null then
    begin
      update public.partners set codice_amway = cod where id = io;
    exception when unique_violation then
      raise exception 'codice_amway_usato';
    end;
    me.codice_amway := cod;
  elsif cod is distinct from me.codice_amway then
    raise exception 'import_di_altri';
  end if;
  if public.salva_numero(io, io, m, p_io, al) then numeri := numeri + 1; else vecchi := vecchi + 1; end if;

  -- copie di persone che ora usano l'app (stesso codice): spariscono, chi sta sotto passa a chi usa l'app
  for x in select g.* from public.partners g
            where g.stato = 'gestito' and g.codice_amway is not null and public.is_in_downline(g.id)
              and exists (select 1 from public.partners a where a.codice_amway = g.codice_amway and a.stato <> 'gestito'
                           and public.is_in_downline(a.id)) loop
    update public.partners set sponsor_id = (select a.id from public.partners a
                                               where a.codice_amway = x.codice_amway and a.stato <> 'gestito')
     where sponsor_id = x.id;
    delete from public.partners where id = x.id;
  end loop;

  for r in select * from jsonb_array_elements(p_persone) loop
    cod := nullif(regexp_replace(coalesce(r->>'codice', ''), '[^0-9]', '', 'g'), '');
    if cod is null or cod !~ '^[0-9]{4,12}$' or cod = me.codice_amway then
      raise exception 'import_non_valido';
    end if;
    -- il primo sopra di lui nel report che è nell'app (io o una persona del mio gruppo)
    sp := null;
    if r->>'sponsor' is not null and r->>'sponsor' <> me.codice_amway then
      select p.id into sp from public.partners p
       where p.codice_amway = r->>'sponsor' and public.is_in_downline(p.id) limit 1;
    end if;
    sp := coalesce(sp, io);
    -- la persona: chi usa l'app nel mio gruppo (anche in attesa) o una persona senza app del mio gruppo
    select * into x from public.partners p
     where p.codice_amway = cod and p.id <> io and public.is_in_downline(p.id)
     order by (p.stato <> 'gestito') desc limit 1;
    if not found then
      if exists (select 1 from public.partners p where p.codice_amway = cod) then
        continue;   -- è in un altro gruppo dell'app: non si sposta da qui
      end if;
      if length(btrim(coalesce(r->>'nome', ''))) = 0 then
        raise exception 'import_non_valido';
      end if;
      insert into public.partners (nome, sponsor_id, stato, gestore_id, codice_amway, consenso_confermato_il, creato_da, posizione_al)
      values (left(btrim(r->>'nome'), 80), sp, 'gestito', io, cod, now(), io, al)
      returning * into x;
      aggiunte := aggiunte + 1;
      if cod = any(coalesce(p_nascondi, '{}'))
         or exists (select 1 from public.esclusi_import e where e.partner_id = io and e.codice = cod) then
        insert into public.nascosti (partner_id, nascosto_id) values (io, x.id) on conflict do nothing;
      end if;
    elsif x.posizione_al is null or x.posizione_al <= al then
      -- la posizione: solo con un report più recente, mai in un giro
      if x.sponsor_id is distinct from sp and sp <> x.id and not exists (
           with recursive giu(id) as (
             select x.id union all select p.id from public.partners p join giu on p.sponsor_id = giu.id)
           select 1 from giu where giu.id = sp) then
        update public.partners set sponsor_id = sp where id = x.id;
        spostate := spostate + 1;
      end if;
      update public.partners set posizione_al = al, fuori_report_dal = null,
             gestore_id = case when stato = 'gestito' then io else gestore_id end
       where id = x.id;
    end if;
    delete from public.esclusi_import where partner_id = io and codice = cod;
    if public.salva_numero(io, x.id, m, r, al) then numeri := numeri + 1; else vecchi := vecchi + 1; end if;
  end loop;

  -- non più nel report (solo se questo report è il più aggiornato per loro): nessuno si cancella
  for x in select * from public.partners where id = any(coalesce(p_fuori, '{}')) loop
    if not (x.stato = 'gestito' and public.vedo(x.id)) then
      raise exception 'non_autorizzato';
    end if;
    if x.fuori_report_dal is null and (x.posizione_al is null or x.posizione_al <= al) then
      update public.partners set fuori_report_dal = m, posizione_al = al where id = x.id;
      insert into public.nascosti (partner_id, nascosto_id) values (io, x.id) on conflict do nothing;
      fuori := fuori + 1;
    end if;
  end loop;

  return jsonb_build_object('aggiunte', aggiunte, 'spostate', spostate, 'fuori', fuori, 'aggiornati', numeri, 'piu_vecchi', vecchi);
end;
$$;

/* il report di un mese chiuso: solo numeri, per me e per il mio gruppo (vince il più aggiornato) */
create or replace function public.salva_mese_passato(p_mese date, p_dati_al timestamptz, p_io jsonb, p_altri jsonb)
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  io   uuid := public.my_partner_id();
  me   public.partners;
  m    date := date_trunc('month', p_mese)::date;
  al   timestamptz := least(coalesce(p_dati_al, now()), now());
  r    jsonb;
  chi  uuid;
  n    int := 0;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  select * into me from public.partners where id = io;
  if me.confermato_il is null and not me.is_admin then
    raise exception 'in_attesa';
  end if;
  if m >= date_trunc('month', (now() at time zone 'Europe/Rome')::date)::date
     or m < (date_trunc('month', (now() at time zone 'Europe/Rome')::date) - interval '24 months')::date then
    raise exception 'import_non_valido';
  end if;
  if jsonb_typeof(p_altri) is distinct from 'array' or jsonb_array_length(p_altri) > 5000 then
    raise exception 'import_non_valido';
  end if;
  if me.codice_amway is null then
    raise exception 'codice_mancante';
  end if;
  if nullif(regexp_replace(coalesce(p_io->>'codice', ''), '[^0-9]', '', 'g'), '') is distinct from me.codice_amway then
    raise exception 'import_di_altri';
  end if;
  if public.salva_numero(io, io, m, p_io, al) then n := n + 1; end if;
  for r in select * from jsonb_array_elements(p_altri) loop
    select p.id into chi from public.partners p
     where p.codice_amway = r->>'codice' and p.id <> io and public.is_in_downline(p.id) limit 1;
    if chi is not null and public.salva_numero(io, chi, m, r, al) then
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;

/* i mesi dei numeri ufficiali di una persona che vedo (da chiunque importati) */
create or replace function public.mesi_report(p_partner uuid)
returns table (mese date, percentuale int, vpg numeric)
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
    select n.mese, n.percentuale, n.vpg from public.numeri_mese n
     where n.partner_id = p_partner
       and n.mese >= (date_trunc('month', (now() at time zone 'Europe/Rome')::date) - interval '13 months')::date
     order by n.mese;
end;
$$;

-- ---- I numeri del mese: chi vedo, con i numeri ufficiali dove ci sono (VPP compresi: il report vince) ----
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
  sotto(antenato, discendente) as (
    select id, id from albero
    union all
    select s.antenato, a.id from sotto s join albero a on a.sponsor_id = s.discendente
  ),
  personali as (
    select a.id, a.sponsor_id,
           coalesce((select n.vpp from public.numeri_mese n where n.partner_id = a.id and n.mese = date_trunc('month', p_mese)::date),
             (select sum(x.vp) from public.activities x
               where x.partner_id = a.id and x.tipo in ('ordine', 'rettifica')
                 and x.data >= date_trunc('month', p_mese)::date
                 and x.data < (date_trunc('month', p_mese) + interval '1 month')::date), 0) as vp
    from albero a
  ),
  gruppo as (
    select s.antenato as id, sum(p.vp) as vp
    from sotto s join personali p on p.id = s.discendente
    group by s.antenato
  ),
  soglia as (
    select coalesce((select (valore #>> '{}')::numeric from public.settings where chiave = 'soglia_linea_attiva'), 100) as v
  ),
  base as (
    select p.id, p.sponsor_id, p.vp as vp_personali, g.vp as vp_gruppo
    from personali p join gruppo g on g.id = p.id
  )
  select b.id, b.sponsor_id, b.vp_personali, b.vp_gruppo,
         (select count(*)::int from base f, soglia where f.sponsor_id = b.id and f.vp_gruppo >= soglia.v),
         (select max(l.percentuale) from public.percent_levels l where l.vp_gruppo <= b.vp_gruppo),
         (select s.chiave from public.stage_requirements s, soglia
           where s.ordine >= 3
             and s.ordine <= (select x.ordine from public.stage_requirements x where x.chiave = 'argento')
             and b.vp_personali >= s.vp_personali
             and (s.vp_gruppo is null or b.vp_gruppo >= s.vp_gruppo)
             and (s.linee is null or
                  (select count(*) from base f where f.sponsor_id = b.id
                     and f.vp_gruppo >= coalesce(s.vp_linea, soglia.v)) >= s.linee)
           order by s.ordine desc limit 1)
  from base b
$$;

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
  io uuid := public.my_partner_id();
  m  date := date_trunc('month', p_mese)::date;
  soglia numeric := coalesce((select (valore #>> '{}')::numeric from public.settings where chiave = 'soglia_linea_attiva'), 100);
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  if exists (select 1 from public.monthly_totals t where t.visto_da = io and t.partner_id = io and t.mese = m) then
    return query
      select t.partner_id, s.sponsor_id, t.vp_personali, t.vp_gruppo, t.linee_attive,
             t.percentuale, t.qualifica, true, n.partner_id is not null, n.linee, coalesce(n.linee_nascoste, false)
      from public.monthly_totals t
      join public.struttura_visibile() s on s.id = t.partner_id
      left join public.numeri_mese n on n.partner_id = t.partner_id and n.mese = m
      where t.visto_da = io and t.mese = m;
  else
    return query
      select c.partner_id, c.sponsor_id, c.vp_personali,
             coalesce(n.vpg, c.vp_gruppo),
             case when n.partner_id is null then c.linee_attive
                  else (select count(*)::int from jsonb_array_elements(n.linee) l where (l->>'vpg')::numeric >= soglia) end,
             coalesce(n.percentuale, c.percentuale),
             case when n.partner_id is null then c.qualifica else public.qualifica_report(c.vp_personali, n.vpg, n.linee) end,
             false, n.partner_id is not null, n.linee, coalesce(n.linee_nascoste, false)
      from public.calcola_mese(m, io, io) c
      left join public.numeri_mese n on n.partner_id = c.partner_id and n.mese = m;
  end if;
end;
$$;

create or replace function public.chiudi_mese(p_mese date)
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  m date := date_trunc('month', p_mese)::date;
  soglia numeric := coalesce((select (valore #>> '{}')::numeric from public.settings where chiave = 'soglia_linea_attiva'), 100);
  n int;
begin
  insert into public.monthly_totals (visto_da, partner_id, mese, vp_personali, vp_gruppo, linee_attive, percentuale, qualifica)
  select v.id, c.partner_id, m, c.vp_personali,
         coalesce(r.vpg, c.vp_gruppo),
         case when r.partner_id is null then c.linee_attive
              else (select count(*)::int from jsonb_array_elements(r.linee) l where (l->>'vpg')::numeric >= soglia) end,
         coalesce(r.percentuale, c.percentuale),
         case when r.partner_id is null then c.qualifica else public.qualifica_report(c.vp_personali, r.vpg, r.linee) end
  from public.partners v
  cross join lateral public.calcola_mese(m, v.id, v.id) c
  left join public.numeri_mese r on r.partner_id = c.partner_id and r.mese = m
  where v.stato <> 'gestito'
  on conflict (visto_da, partner_id, mese) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.copia_dati()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.sono_admin() then
    raise exception 'non_autorizzato';
  end if;
  return jsonb_build_object(
    'app', 'Growup Team',
    'creata_il', now(),
    'tabelle', jsonb_build_object(
      'partners',           coalesce((select jsonb_agg(to_jsonb(t) order by t.creato_il) from public.partners t), '[]'),
      'activities',         coalesce((select jsonb_agg(to_jsonb(t)) from public.activities t), '[]'),
      'goals',              coalesce((select jsonb_agg(to_jsonb(t)) from public.goals t), '[]'),
      'monthly_goals',      coalesce((select jsonb_agg(to_jsonb(t)) from public.monthly_goals t), '[]'),
      'monthly_totals',     coalesce((select jsonb_agg(to_jsonb(t)) from public.monthly_totals t), '[]'),
      'numeri_report',      coalesce((select jsonb_agg(to_jsonb(t)) from public.numeri_report t), '[]'),
      'numeri_mese',        coalesce((select jsonb_agg(to_jsonb(t)) from public.numeri_mese t), '[]'),
      'obiettivi',          coalesce((select jsonb_agg(to_jsonb(t)) from public.obiettivi t), '[]'),
      'preferiti',          coalesce((select jsonb_agg(to_jsonb(t)) from public.preferiti t), '[]'),
      'esclusi_import',     coalesce((select jsonb_agg(to_jsonb(t)) from public.esclusi_import t), '[]'),
      'nascosti',           coalesce((select jsonb_agg(to_jsonb(t)) from public.nascosti t), '[]'),
      'inviti_admin',       coalesce((select jsonb_agg(to_jsonb(t)) from public.inviti_admin t), '[]'),
      'settings',           coalesce((select jsonb_agg(to_jsonb(t)) from public.settings t), '[]'),
      'stage_requirements', coalesce((select jsonb_agg(to_jsonb(t) order by t.ordine) from public.stage_requirements t), '[]'),
      'percent_levels',     coalesce((select jsonb_agg(to_jsonb(t)) from public.percent_levels t), '[]')
    )
  );
end;
$$;

revoke execute on function public.salva_numero(uuid, uuid, date, jsonb, timestamptz) from public, anon, authenticated;
revoke execute on function public.importa_mappa(date, timestamptz, jsonb, jsonb, text[], uuid[]), public.salva_mese_passato(date, timestamptz, jsonb, jsonb),
  public.in_attesa() from public, anon, authenticated;
grant execute on function public.importa_mappa(date, timestamptz, jsonb, jsonb, text[], uuid[]), public.salva_mese_passato(date, timestamptz, jsonb, jsonb),
  public.in_attesa() to authenticated;

-- ============================================================
-- Growup Team — 034: i miei ordini restano miei, e la bozza d'ordine (23 ottobre 2026).
-- Decisioni di Stefano:
-- * Gli ordini e le correzioni del totale scritti a mano da chi usa l'app li vede solo lui: sponsor e upline vedono solo
--   i numeri del report Amway (senza report: zero). Chi non ha l'app (gestito) resta com'è: valgono i VP scritti da chi
--   lo segue finché non c'è un report.
-- * Per me: VPP del report + gli ordini scritti da me dopo la data e ora del file del report (quelli prima sono già
--   dentro; quelli scritti da chi mi seguiva prima che entrassi nell'app restano al report).
--   Un report nuovo sposta la data in avanti: il totale torna al dato ufficiale.
-- * La bozza d'ordine e lo storico dei miei ordini: tabelle solo mie (RLS), una sola bozza aperta. Confermando, il totale
--   VP diventa un ordine del mese. Togliere un ordine si fa dall'app (righe, ordine e attività sono miei).
-- Solo aggiunte, "alter policy" e "create or replace": nessun drop, nessuna cancellazione.

-- ---- Ordini e correzioni di chi ha l'app: li legge solo lui ----
alter policy activities_leggo on public.activities using (
  public.vedo(partner_id)
  and (tipo not in ('ordine', 'rettifica')
       or partner_id = public.my_partner_id()
       or exists (select 1 from public.partners p where p.id = partner_id and p.stato = 'gestito'))
);

-- ---- I numeri del mese ----
-- VP personali: per me il report + i miei ordini dopo il report (senza report: i miei ordini); per chi ha l'app solo il
-- report (senza report: 0); per chi non ha l'app il report, altrimenti i VP scritti da chi lo segue.
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
  sotto(antenato, discendente) as (
    select id, id from albero
    union all
    select s.antenato, a.id from sotto s join albero a on a.sponsor_id = s.discendente
  ),
  personali as (
    select a.id, a.sponsor_id,
           case
             when a.id = p_chi then coalesce(n.vpp, 0) + coalesce((select sum(x.vp) from public.activities x
                  where x.partner_id = a.id and x.tipo in ('ordine', 'rettifica')
                    and x.data >= date_trunc('month', p_mese)::date
                    and x.data < (date_trunc('month', p_mese) + interval '1 month')::date
                    and (n.dati_al is null or (x.inserito_il > n.dati_al and x.inserito_da = a.id))), 0)
             when n.partner_id is not null then n.vpp
             when p.stato = 'gestito' then coalesce((select sum(x.vp) from public.activities x
                  where x.partner_id = a.id and x.tipo in ('ordine', 'rettifica')
                    and x.data >= date_trunc('month', p_mese)::date
                    and x.data < (date_trunc('month', p_mese) + interval '1 month')::date), 0)
             else 0
           end as vp
    from albero a
    join public.partners p on p.id = a.id
    left join public.numeri_mese n on n.partner_id = a.id and n.mese = date_trunc('month', p_mese)::date
  ),
  gruppo as (
    select s.antenato as id, sum(p.vp) as vp
    from sotto s join personali p on p.id = s.discendente
    group by s.antenato
  ),
  soglia as (
    select coalesce((select (valore #>> '{}')::numeric from public.settings where chiave = 'soglia_linea_attiva'), 100) as v
  ),
  base as (
    select p.id, p.sponsor_id, p.vp as vp_personali, g.vp as vp_gruppo
    from personali p join gruppo g on g.id = p.id
  )
  select b.id, b.sponsor_id, b.vp_personali, b.vp_gruppo,
         (select count(*)::int from base f, soglia where f.sponsor_id = b.id and f.vp_gruppo >= soglia.v),
         (select max(l.percentuale) from public.percent_levels l where l.vp_gruppo <= b.vp_gruppo),
         (select s.chiave from public.stage_requirements s, soglia
           where s.ordine >= 3
             and s.ordine <= (select x.ordine from public.stage_requirements x where x.chiave = 'argento')
             and b.vp_personali >= s.vp_personali
             and (s.vp_gruppo is null or b.vp_gruppo >= s.vp_gruppo)
             and (s.linee is null or
                  (select count(*) from base f where f.sponsor_id = b.id
                     and f.vp_gruppo >= coalesce(s.vp_linea, soglia.v)) >= s.linee)
           order by s.ordine desc limit 1)
  from base b
$$;

-- Nella mia riga, con il report: VPG del report + i miei ordini dopo il report; percentuale e qualifica ricalcolate.
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
  io uuid := public.my_partner_id();
  m  date := date_trunc('month', p_mese)::date;
  soglia numeric := coalesce((select (valore #>> '{}')::numeric from public.settings where chiave = 'soglia_linea_attiva'), 100);
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  if exists (select 1 from public.monthly_totals t where t.visto_da = io and t.partner_id = io and t.mese = m) then
    return query
      select t.partner_id, s.sponsor_id, t.vp_personali, t.vp_gruppo, t.linee_attive,
             t.percentuale, t.qualifica, true, n.partner_id is not null, n.linee, coalesce(n.linee_nascoste, false)
      from public.monthly_totals t
      join public.struttura_visibile() s on s.id = t.partner_id
      left join public.numeri_mese n on n.partner_id = t.partner_id and n.mese = m
      where t.visto_da = io and t.mese = m;
  else
    return query
      select x.partner_id, x.sponsor_id, x.vp_personali, x.vpg,
             case when x.n_id is null then x.linee_attive
                  else (select count(*)::int from jsonb_array_elements(x.linee) l where (l->>'vpg')::numeric >= soglia) end,
             case when x.n_id is null then x.percentuale
                  when x.extra = 0 then coalesce(x.n_perc, x.percentuale)
                  else (select max(l.percentuale) from public.percent_levels l where l.vp_gruppo <= x.vpg) end,
             case when x.n_id is null then x.qualifica else public.qualifica_report(x.vp_personali, x.vpg, x.linee) end,
             false, x.n_id is not null, x.linee, coalesce(x.nascoste, false)
      from (
        select c.partner_id, c.sponsor_id, c.vp_personali, c.linee_attive, c.percentuale, c.qualifica,
               n.partner_id as n_id, n.linee, n.linee_nascoste as nascoste, n.percentuale as n_perc,
               case when n.partner_id is not null and c.partner_id = io then c.vp_personali - n.vpp else 0 end as extra,
               case when n.partner_id is null then c.vp_gruppo
                    else n.vpg + case when c.partner_id = io then c.vp_personali - n.vpp else 0 end end as vpg
        from public.calcola_mese(m, io, io) c
        left join public.numeri_mese n on n.partner_id = c.partner_id and n.mese = m
      ) x;
  end if;
end;
$$;

create or replace function public.chiudi_mese(p_mese date)
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  m date := date_trunc('month', p_mese)::date;
  soglia numeric := coalesce((select (valore #>> '{}')::numeric from public.settings where chiave = 'soglia_linea_attiva'), 100);
  n int;
begin
  insert into public.monthly_totals (visto_da, partner_id, mese, vp_personali, vp_gruppo, linee_attive, percentuale, qualifica)
  select x.visto_da, x.partner_id, m, x.vp_personali, x.vpg,
         case when x.n_id is null then x.linee_attive
              else (select count(*)::int from jsonb_array_elements(x.linee) l where (l->>'vpg')::numeric >= soglia) end,
         case when x.n_id is null then x.percentuale
              when x.extra = 0 then coalesce(x.n_perc, x.percentuale)
              else (select max(l.percentuale) from public.percent_levels l where l.vp_gruppo <= x.vpg) end,
         case when x.n_id is null then x.qualifica else public.qualifica_report(x.vp_personali, x.vpg, x.linee) end
  from (
    select v.id as visto_da, c.partner_id, c.vp_personali, c.linee_attive, c.percentuale, c.qualifica,
           r.partner_id as n_id, r.linee, r.percentuale as n_perc,
           case when r.partner_id is not null and c.partner_id = v.id then c.vp_personali - r.vpp else 0 end as extra,
           case when r.partner_id is null then c.vp_gruppo
                else r.vpg + case when c.partner_id = v.id then c.vp_personali - r.vpp else 0 end end as vpg
    from public.partners v
    cross join lateral public.calcola_mese(m, v.id, v.id) c
    left join public.numeri_mese r on r.partner_id = c.partner_id and r.mese = m
    where v.stato <> 'gestito'
  ) x
  on conflict (visto_da, partner_id, mese) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---- La bozza d'ordine e lo storico dei miei ordini: solo miei ----
create table if not exists public.ordini_personali (
  id             uuid primary key default gen_random_uuid(),
  proprietario   uuid not null default public.my_partner_id() references public.partners(id) on delete cascade,
  stato          text not null default 'bozza' check (stato in ('bozza', 'confermato')),
  data           date not null default (now() at time zone 'Europe/Rome')::date check (data >= date '2020-01-01'),
  attivita_id    uuid references public.activities(id) on delete set null,
  vp             numeric(10,2),
  creato_il      timestamptz not null default now(),
  confermato_il  timestamptz
);
create unique index if not exists ordini_personali_una_bozza on public.ordini_personali (proprietario) where stato = 'bozza';
create index if not exists ordini_personali_idx on public.ordini_personali (proprietario, data);

create table if not exists public.righe_ordine_personale (
  id              uuid primary key default gen_random_uuid(),
  ordine_id       uuid not null references public.ordini_personali(id) on delete cascade,
  proprietario    uuid not null default public.my_partner_id() references public.partners(id) on delete cascade,
  codice          text not null check (length(codice) between 1 and 20),
  nome            text not null check (length(nome) between 1 and 160),
  quantita        int not null default 1 check (quantita between 1 and 99),
  vp              numeric(10,2) check (vp >= 0 and vp <= 100000),
  prezzo_partner  numeric(10,2) check (prezzo_partner >= 0 and prezzo_partner <= 100000),
  prezzo_cliente  numeric(10,2) check (prezzo_cliente >= 0 and prezzo_cliente <= 100000),
  unique (ordine_id, codice)
);
create index if not exists righe_ordine_personale_idx on public.righe_ordine_personale (ordine_id);

alter table public.ordini_personali enable row level security;
alter table public.righe_ordine_personale enable row level security;
revoke all on public.ordini_personali, public.righe_ordine_personale from anon, authenticated;
grant select, delete on public.ordini_personali, public.righe_ordine_personale to authenticated;
grant insert (id) on public.ordini_personali to authenticated;
grant insert (id, ordine_id, codice, nome, quantita, vp, prezzo_partner, prezzo_cliente) on public.righe_ordine_personale to authenticated;
grant update (quantita) on public.righe_ordine_personale to authenticated;

create policy ordini_personali_leggo on public.ordini_personali for select to authenticated
  using (proprietario = public.my_partner_id());
create policy ordini_personali_creo on public.ordini_personali for insert to authenticated
  with check (proprietario = public.my_partner_id() and stato = 'bozza');
create policy ordini_personali_tolgo on public.ordini_personali for delete to authenticated
  using (proprietario = public.my_partner_id());
create policy righe_personali_leggo on public.righe_ordine_personale for select to authenticated
  using (proprietario = public.my_partner_id());
create policy righe_personali_tolgo on public.righe_ordine_personale for delete to authenticated
  using (proprietario = public.my_partner_id());
-- le righe si aggiungono e si cambiano solo nella mia bozza
create policy righe_personali_creo on public.righe_ordine_personale for insert to authenticated
  with check (proprietario = public.my_partner_id() and exists (select 1 from public.ordini_personali o
    where o.id = ordine_id and o.proprietario = public.my_partner_id() and o.stato = 'bozza'));
create policy righe_personali_cambio on public.righe_ordine_personale for update to authenticated
  using (proprietario = public.my_partner_id() and exists (select 1 from public.ordini_personali o
    where o.id = ordine_id and o.proprietario = public.my_partner_id() and o.stato = 'bozza'))
  with check (proprietario = public.my_partner_id());

/* confermo la mia bozza: il totale VP diventa un ordine del mese (solo mio) e la bozza passa nello storico */
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
  att  uuid;
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
  if tot > 0 then
    insert into public.activities (partner_id, tipo, vp, data, inserito_da)
    values (io, 'ordine', least(tot, 100000), d, io) returning id into att;
  end if;
  update public.ordini_personali
     set stato = 'confermato', data = d, attivita_id = att, vp = tot, confermato_il = now()
   where id = o.id returning * into o;
  return to_jsonb(o);
end;
$$;

revoke execute on function public.conferma_ordine(uuid, date) from public, anon, authenticated;
grant execute on function public.conferma_ordine(uuid, date) to authenticated;

-- Growup Team — 035: la Guida per l'azione (26 ottobre 2026).
-- Decisioni di Stefano (tavola «Guida per l'azione» v4):
-- * Tabella «Stabilità» Cum Laude 21 con i numeri del partner:
--   - i suoi nuovi iscritti del mese = chi entra nell'app con il suo link (conta anche se poi l'import lo mette in
--     profondità): si segna all'ingresso (`invitato_da`, `invitato_il`);
--   - i nuovi nel gruppo del mese = codici comparsi nella mappa per la prima volta, solo dal secondo import in avanti
--     (il primo import di ognuno carica la struttura che c'era già): `in_mappa_dal`, con `primo_import_il` di chi importa;
--   - codici oltre 200 VP dai numeri ufficiali del mese;
--   - codici nell'app CumLaude21, al Training Day e alla Convention li scrive il partner (`numeri_cl21`, solo suoi).
-- * Abitudini: obiettivo a settimana scelto dal partner (`guida_obiettivi`) e spunte per giorno (`guida_fatti`), solo sue.
-- Solo aggiunte e "create or replace": nessun drop, nessuna cancellazione.

alter table public.partners add column if not exists invitato_da uuid references public.partners(id) on delete set null;
alter table public.partners add column if not exists invitato_il timestamptz;
alter table public.partners add column if not exists in_mappa_dal timestamptz;
alter table public.partners add column if not exists primo_import_il timestamptz;

-- chi ha già importato (prima di oggi) ha fatto il suo primo import: dal prossimo i codici nuovi contano
update public.partners p
   set primo_import_il = x.primo
  from (select importato_da as id, min(aggiornato_il) as primo from public.numeri_mese where importato_da is not null group by importato_da
        union all
        select visto_da, min(aggiornato_il) from public.numeri_report group by visto_da) x
 where p.id = x.id and (p.primo_import_il is null or x.primo < p.primo_import_il);

/* il primo import di ognuno: lo segna il primo numero ufficiale che salva */
create or replace function public.numeri_mese_import()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.importato_da is not null then
    update public.partners set primo_import_il = now() where id = new.importato_da and primo_import_il is null;
  end if;
  return null;
end;
$$;
create trigger numeri_mese_import
after insert or update on public.numeri_mese
for each row execute function public.numeri_mese_import();

/* chi entra con il link di qualcuno: il link resta segnato anche se l'import lo sposta. Un codice nuovo creato da un
   import (posizione_al) o confermato da un import è "nuovo nel gruppo" se chi importa aveva già fatto il primo import */
create or replace function public.partners_guida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chi uuid;
begin
  if tg_op = 'INSERT' then
    if new.stato <> 'gestito' and new.sponsor_id is not null then
      new.invitato_da := new.sponsor_id;
      new.invitato_il := now();
    end if;
    if new.stato = 'gestito' and new.posizione_al is not null and new.creato_da is not null
       and exists (select 1 from public.partners x where x.id = new.creato_da and x.primo_import_il < now()) then
      new.in_mappa_dal := now();
    end if;
  elsif old.confermato_il is null and new.confermato_il is not null and new.stato <> 'gestito' and old.stato <> 'gestito'
        and new.in_mappa_dal is null then
    chi := public.my_partner_id();
    if chi is not null and chi <> new.id
       and exists (select 1 from public.partners x where x.id = chi and x.primo_import_il < now()) then
      new.in_mappa_dal := now();
    end if;
  end if;
  return new;
end;
$$;
create trigger partners_guida
before insert or update on public.partners
for each row execute function public.partners_guida();

-- ---- I numeri scritti dal partner e le abitudini: solo suoi ----
create table if not exists public.numeri_cl21 (
  partner_id     uuid primary key default public.my_partner_id() references public.partners(id) on delete cascade,
  app_cl21       int check (app_cl21 between 0 and 100000),
  training_day   int check (training_day between 0 and 100000),
  convention     int check (convention between 0 and 100000),
  aggiornato_il  timestamptz not null default now()
);
create table if not exists public.guida_obiettivi (
  partner_id     uuid not null default public.my_partner_id() references public.partners(id) on delete cascade,
  chiave         text not null check (chiave in ('followup', 'formazione', 'sponsor')),
  a_settimana    int not null check (a_settimana between 0 and 50),
  primary key (partner_id, chiave)
);
create table if not exists public.guida_fatti (
  partner_id     uuid not null default public.my_partner_id() references public.partners(id) on delete cascade,
  chiave         text not null check (chiave in ('formazione', 'sponsor')),
  giorno         date not null check (giorno >= date '2026-01-01'),
  primary key (partner_id, chiave, giorno)
);

alter table public.numeri_cl21 enable row level security;
alter table public.guida_obiettivi enable row level security;
alter table public.guida_fatti enable row level security;
revoke all on public.numeri_cl21, public.guida_obiettivi, public.guida_fatti from anon, authenticated;
grant select, delete on public.numeri_cl21, public.guida_obiettivi, public.guida_fatti to authenticated;
grant insert (app_cl21, training_day, convention) on public.numeri_cl21 to authenticated;
grant update (app_cl21, training_day, convention) on public.numeri_cl21 to authenticated;
grant insert (chiave, a_settimana) on public.guida_obiettivi to authenticated;
grant update (a_settimana) on public.guida_obiettivi to authenticated;
grant insert (chiave, giorno) on public.guida_fatti to authenticated;

create policy numeri_cl21_miei on public.numeri_cl21 for all to authenticated
  using (partner_id = public.my_partner_id()) with check (partner_id = public.my_partner_id());
create policy guida_obiettivi_miei on public.guida_obiettivi for all to authenticated
  using (partner_id = public.my_partner_id()) with check (partner_id = public.my_partner_id());
create policy guida_fatti_miei on public.guida_fatti for all to authenticated
  using (partner_id = public.my_partner_id())
  with check (partner_id = public.my_partner_id() and giorno <= (now() at time zone 'Europe/Rome')::date);

/* i numeri della tabella «Stabilità» che l'app ricava: i miei nuovi iscritti del mese (entrati con il mio link), i
   nuovi codici nel mio gruppo (dal secondo import) e i codici del mio gruppo oltre 200 VP nel mese */
create or replace function public.guida_conteggi(p_mese date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  io uuid := public.my_partner_id();
  m  date := date_trunc('month', p_mese)::date;
  f  timestamptz;
  t  timestamptz;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  f := m::timestamp at time zone 'Europe/Rome';
  t := (m + interval '1 month')::timestamp at time zone 'Europe/Rome';
  return jsonb_build_object(
    'personali', (select count(*) from public.partners p where p.invitato_da = io and p.invitato_il >= f and p.invitato_il < t),
    'nuovi_gruppo', (select count(*) from public.partners p where p.in_mappa_dal >= f and p.in_mappa_dal < t
                       and p.id <> io and public.vedo(p.id)),
    'oltre_200', (select count(*) from public.numeri_mese n where n.mese = m and n.vpp > 200 and public.vedo(n.partner_id))
  );
end;
$$;

revoke execute on function public.guida_conteggi(date) from public, anon, authenticated;
grant execute on function public.guida_conteggi(date) to authenticated;
revoke execute on function public.numeri_mese_import(), public.partners_guida() from public, anon, authenticated;

-- Growup Team — 036: «Seguimi giorno per giorno» (26 ottobre 2026).
-- Decisioni di Stefano (tavola «Seguimi giorno per giorno» v2):
-- * chi lo attiva trova ogni giorno in «Il mio giorno» le azioni del giorno (al massimo 3 contatti, follow-up e piani,
--   clienti, VP del mese, formazione e chiamata con lo sponsor); le azioni del giorno restano quelle scelte al mattino;
-- * il partner sceglie se far vedere a sponsor e upline cosa fa: **solo i numeri** (proposte e fatte, per tipo, degli
--   ultimi 7 giorni), mai i nomi; se non lo sceglie l'upline non vede niente, neanche che l'ha attivato.
-- Solo aggiunte e "create or replace": nessun drop, nessuna cancellazione.

create table if not exists public.seguimi (
  partner_id     uuid primary key default public.my_partner_id() references public.partners(id) on delete cascade,
  attivo         boolean not null default true,
  condividi      boolean not null default false,
  aggiornato_il  timestamptz not null default now()
);
create table if not exists public.seguimi_giorni (
  partner_id     uuid not null default public.my_partner_id() references public.partners(id) on delete cascade,
  giorno         date not null check (giorno >= date '2026-01-01'),
  azioni         jsonb not null default '[]' check (jsonb_typeof(azioni) = 'array' and jsonb_array_length(azioni) <= 30),
  proposte       int not null default 0 check (proposte between 0 and 30),
  fatte          int not null default 0 check (fatte between 0 and 30),
  per_tipo       jsonb not null default '{}' check (jsonb_typeof(per_tipo) = 'object'),
  primary key (partner_id, giorno)
);

alter table public.seguimi enable row level security;
alter table public.seguimi_giorni enable row level security;
revoke all on public.seguimi, public.seguimi_giorni from anon, authenticated;
grant select on public.seguimi, public.seguimi_giorni to authenticated;
grant insert (attivo, condividi) on public.seguimi to authenticated;
grant update (attivo, condividi) on public.seguimi to authenticated;
grant insert (giorno, azioni, proposte, fatte, per_tipo) on public.seguimi_giorni to authenticated;
grant update (azioni, proposte, fatte, per_tipo) on public.seguimi_giorni to authenticated;

create policy seguimi_mio on public.seguimi for all to authenticated
  using (partner_id = public.my_partner_id()) with check (partner_id = public.my_partner_id());
create policy seguimi_giorni_miei on public.seguimi_giorni for all to authenticated
  using (partner_id = public.my_partner_id())
  with check (partner_id = public.my_partner_id() and giorno <= (now() at time zone 'Europe/Rome')::date);

/* per sponsor e upline: gli ultimi 7 giorni di un partner che ha scelto di condividerli, solo i numeri (mai le azioni
   con i nomi). Niente se non lo condivide, se non lo ha attivo o se non lo vedo. */
create or replace function public.seguimi_di(p_partner uuid)
returns table (giorno date, proposte int, fatte int, per_tipo jsonb)
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
     or not exists (select 1 from public.seguimi s where s.partner_id = p_partner and s.attivo and s.condividi) then
    return;
  end if;
  return query
    select g.giorno, g.proposte, g.fatte, g.per_tipo from public.seguimi_giorni g
     where g.partner_id = p_partner and g.giorno > (now() at time zone 'Europe/Rome')::date - 7
     order by g.giorno;
end;
$$;

revoke execute on function public.seguimi_di(uuid) from public, anon, authenticated;
grant execute on function public.seguimi_di(uuid) to authenticated;

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

-- Growup Team — 010: Fase 2, blocco 3 — soglie delle etichette del gruppo
-- Si tarano dal Table editor (tabella settings), senza toccare il codice.
--   giorni_da_chiamare   oltre questi giorni senza aggiornamenti: "Non aggiorna"
--   quota_contatti       sotto questa quota dell'obiettivo contatti (4 settimane): "Contatti sotto soglia"
--   piani_per_contatti   sotto questo rapporto piani/contatti: "Piani sotto soglia" (0,2 = 1 piano ogni 5 contatti)
--   piani_min_followup   da quanti piani in 4 settimane si guarda il follow-up
--   quota_vp_followup    sotto questa quota dell'obiettivo VP del mese: "VP sotto soglia"
--   ordini_per_piani     sotto questo rapporto ordini/piani l'imbuto segnala gli ordini sotto soglia
-- ============================================================

insert into public.settings (chiave, valore, nota) values
  ('soglie_etichette',
   '{"giorni_da_chiamare": 7, "quota_contatti": 0.5, "piani_per_contatti": 0.2, "piani_min_followup": 2, "quota_vp_followup": 0.5, "ordini_per_piani": 0.3}',
   'Etichette del gruppo (Non aggiorna, Contatti / Piani / VP sotto soglia, In crescita) e passaggi sotto soglia dell''imbuto')
on conflict (chiave) do nothing;

-- ============================================================
-- Growup Team — dati iniziali (Fase 1)
-- Requisiti delle tappe e guadagni come da brief (ottobre 2026).
-- Si aggiornano poi dal Table editor: stage_requirements e settings.
-- ============================================================

insert into public.stage_requirements
  (ordine, chiave, nome, percentuale, vp_personali, vp_gruppo, linee, vp_linea, linee_obiettivo,
   clienti, giorni_scadenza, linee_nuove_dal, pagamenti_max, mesi_finestra,
   guadagno_mese, struttura_calcolo, descrizione)
values
  (1, 'primo_ordine',  'Primo ordine',            null,  50, null, null, null, null,
   null, 30, null, null, null,
   null, null, 'Almeno 50 VP personali entro 30 giorni dall''iscrizione, per non pagare i 40 € di iscrizione'),
  (2, 'primi_clienti', 'Primi clienti',           null,   0, null, null, null, null,
   3, null, null, null, null,
   null, null, 'I primi 3 clienti, in totale e non nello stesso mese: chi si iscrive il 29 non ha il tempo di farli in due giorni'),
  (3, 'path_to_bronze','Path to Bronze',          null, 100, null, 3, 100, null,
   null, null, null, null, null,
   150, '100 VP personali + 3 linee da 100 VP', '3 prime linee da almeno 100 VP ciascuna, più 100 VP personali'),
  (4, 'foundation_9',  'Bronze Foundation 9%',      9, 100, 1200, 3, 200, null,
   null, null, null, 12, 18,
   360, '100 VP personali + 3 linee da 400 VP', '1.200 VP di gruppo, 3 linee frontali da almeno 200 VP, 100 VP personali'),
  (5, 'foundation_12', 'Bronze Foundation 12%',    12, 100, 2400, 3, 200, null,
   null, null, null, 12, 18,
   580, '100 VP personali + 3 linee da 800 VP', '2.400 VP di gruppo, 3 linee frontali da almeno 200 VP, 100 VP personali'),
  (6, 'builder_15',    'Bronze Builder 15%',       15, 200, 4000, 3, 600, null,
   null, null, null, 12, 18,
   1050, '200 VP personali + 3 linee da 1.300 VP', '4.000 VP di gruppo, 3 linee frontali da almeno 600 VP, 200 VP personali'),
  (7, 'builder_18',    'Bronze Builder 18%',       18, 200, 7000, 3, 600, null,
   null, null, null, 12, 18,
   1980, '200 VP personali + 3 linee da 2.600 VP', '7.000 VP di gruppo, 3 linee frontali da almeno 600 VP, 200 VP personali'),
  (8, 'argento',       'Argento 21%',              21,   0, 10000, 2, null, 3,
   null, null, null, null, null,
   3750, '200 VP personali + 3 linee da 4.100 VP', '10.000 VP di gruppo nel mese, su almeno 2 linee (obiettivo CL21: 3 linee attive)');

insert into public.settings (chiave, valore, nota) values
  ('soglia_linea_attiva',     '100',
   'VP di gruppo nel mese perché una linea frontale conti come attiva'),
  ('giorni_presa_in_carico',  '14',
   'Giorni senza aggiornamenti dopo cui compare "Prendi in carico" (Fase 3)'),
  ('obiettivi_proposti',      '{"contatti": 10, "piani": 3, "vp_mese": 100}',
   'Proposti a chi non ne ha ancora scelti: contatti e piani a settimana, VP al mese (se la tappa ne chiede di più, si propone quella)'),
  ('fonte_guadagni',          '"Simulatore di reddito ufficiale Amway, ottobre 2026"',
   'Citata accanto a ogni cifra'),
  ('avviso_guadagni',         '"Cifre indicative: i risultati dipendono dall''impegno di ciascuno e non sono garantiti."',
   'Mostrato sotto ogni cifra');

-- ------------------------------------------------------------
-- LA RADICE: Stefano e Alessia, un solo profilo e un solo codice d'invito.
-- Questo blocco stampa due link:
--   link_personale  → la vostra chiave: apritelo su entrambi i telefoni e tenetelo
--                     per voi (per esempio nei "Messaggi salvati" di Telegram)
--   link_invito     → da mandare ai vostri partner diretti
-- La chiave si vede SOLO adesso: nel database resta solo la sua impronta.
-- Se la perdete: select public.nuova_chiave_per(id) from public.partners where is_admin;
-- ------------------------------------------------------------
with nuova as (
  select public.nuova_chiave_segreta() as k
), radice as (
  insert into public.partners (nome, is_admin, stato, chiave_hash)
  select 'Stefano e Alessia', true, 'gestito', public.impronta(k) from nuova
  returning codice_invito
)
select 'https://cl21-aes.github.io/growup-team/#chiave=' || nuova.k as link_personale,
       'https://cl21-aes.github.io/growup-team/#' || radice.codice_invito as link_invito
from nuova, radice;
