-- ============================================================
-- Growup Team — 053: le cerchie della Lista (2 novembre 2026).
-- Decisioni di Stefano: nella Lista (Persone) ognuno può creare delle «cerchie» (per esempio Palestra, Colleghi,
-- Famiglia), mettere in una cerchia un nome nuovo o quelli già nella Lista, e filtrare la Lista per cerchia (una seconda
-- riga di filtri, che si combina con quella degli stati). Una persona può stare in più cerchie.
-- Come la Lista, le cerchie le vede e le cambia solo chi le crea: né lo sponsor, né l'upline, né gli admin.
-- Cancellare una cerchia non cancella le persone: escono solo dalla cerchia.
-- ============================================================

create table if not exists public.cerchie (
  id            uuid primary key default gen_random_uuid(),
  proprietario  uuid not null default public.my_partner_id() references public.partners(id) on delete cascade,
  nome          text not null check (length(btrim(nome)) between 1 and 40),
  creato_il     timestamptz not null default now()
);
create unique index if not exists cerchie_nome_unico on public.cerchie (proprietario, lower(btrim(nome)));

create table if not exists public.persone_cerchie (
  persona_id    uuid not null references public.persone(id) on delete cascade,
  cerchia_id    uuid not null references public.cerchie(id) on delete cascade,
  proprietario  uuid not null default public.my_partner_id() references public.partners(id) on delete cascade,
  primary key (persona_id, cerchia_id)
);
create index if not exists persone_cerchie_cerchia_idx on public.persone_cerchie (cerchia_id);
create index if not exists persone_cerchie_proprietario_idx on public.persone_cerchie (proprietario);

alter table public.cerchie enable row level security;
alter table public.persone_cerchie enable row level security;
revoke all on public.cerchie, public.persone_cerchie from anon, authenticated;
grant select, delete on public.cerchie to authenticated;
grant insert (id, nome) on public.cerchie to authenticated;
grant update (nome) on public.cerchie to authenticated;
grant select, insert (persona_id, cerchia_id), delete on public.persone_cerchie to authenticated;

drop policy if exists cerchie_mie on public.cerchie;
create policy cerchie_mie on public.cerchie for all to authenticated
  using (proprietario = (select public.my_partner_id())) with check (proprietario = (select public.my_partner_id()));
-- si lega solo una mia persona a una mia cerchia
drop policy if exists persone_cerchie_mie on public.persone_cerchie;
create policy persone_cerchie_mie on public.persone_cerchie for all to authenticated
  using (proprietario = (select public.my_partner_id()))
  with check (proprietario = (select public.my_partner_id())
    and exists (select 1 from public.persone p where p.id = persona_id and p.proprietario = (select public.my_partner_id()))
    and exists (select 1 from public.cerchie c where c.id = cerchia_id and c.proprietario = (select public.my_partner_id())));
