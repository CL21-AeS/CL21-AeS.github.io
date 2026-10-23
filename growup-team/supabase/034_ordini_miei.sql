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
