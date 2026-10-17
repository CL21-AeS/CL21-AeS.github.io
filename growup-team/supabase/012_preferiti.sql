-- ============================================================
-- Growup Team — 012: preferiti
-- Ognuno segna come preferite alcune persone del proprio gruppo, per seguirle da vicino: compaiono nella
-- sezione "Preferiti" della pagina Gruppo (al posto dell'imbuto). Sono del profilo, quindi uguali su tutti
-- i telefoni collegati (Stefano e Alessia vedono gli stessi). Nessuno vede i preferiti degli altri.
-- ============================================================

create table if not exists public.preferiti (
  partner_id   uuid not null references public.partners(id) on delete cascade,
  preferito_id uuid not null references public.partners(id) on delete cascade,
  creato_il    timestamptz not null default now(),
  primary key (partner_id, preferito_id),
  check (partner_id <> preferito_id)
);

alter table public.preferiti enable row level security;

drop policy if exists preferiti_leggi on public.preferiti;
create policy preferiti_leggi on public.preferiti for select to authenticated
  using (partner_id = public.my_partner_id());

drop policy if exists preferiti_aggiungi on public.preferiti;
create policy preferiti_aggiungi on public.preferiti for insert to authenticated
  with check (partner_id = public.my_partner_id() and preferito_id <> partner_id and public.is_in_downline(preferito_id));

drop policy if exists preferiti_togli on public.preferiti;
create policy preferiti_togli on public.preferiti for delete to authenticated
  using (partner_id = public.my_partner_id());

revoke all on public.preferiti from anon, authenticated;
grant select, insert, delete on public.preferiti to authenticated;
