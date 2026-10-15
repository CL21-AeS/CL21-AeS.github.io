-- ============================================================
-- Growup Team — INSTALLAZIONE COMPLETA (001 + 002 + 003 in un file solo)
-- Incolla tutto nell'SQL Editor di Supabase e premi Run, una volta sola.
-- Alla fine compaiono DUE LINK: copiali subito (il link personale si vede solo ora).
-- Generato da 001_schema.sql, 002_rls.sql, 003_seed.sql: si modificano quelli.
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
