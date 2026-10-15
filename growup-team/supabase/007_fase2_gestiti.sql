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
