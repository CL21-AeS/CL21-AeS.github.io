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
