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
