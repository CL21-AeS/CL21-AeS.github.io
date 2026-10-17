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
