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
