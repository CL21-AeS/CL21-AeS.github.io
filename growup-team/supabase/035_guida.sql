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
