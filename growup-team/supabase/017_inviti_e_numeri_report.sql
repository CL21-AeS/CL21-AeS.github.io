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
