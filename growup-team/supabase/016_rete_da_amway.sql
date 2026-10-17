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
