-- Growup Team — 036: «Seguimi giorno per giorno» (26 ottobre 2026).
-- Decisioni di Stefano (tavola «Seguimi giorno per giorno» v2):
-- * chi lo attiva trova ogni giorno in «Il mio giorno» le azioni del giorno (al massimo 3 contatti, follow-up e piani,
--   clienti, VP del mese, formazione e chiamata con lo sponsor); le azioni del giorno restano quelle scelte al mattino;
-- * il partner sceglie se far vedere a sponsor e upline cosa fa: **solo i numeri** (proposte e fatte, per tipo, degli
--   ultimi 7 giorni), mai i nomi; se non lo sceglie l'upline non vede niente, neanche che l'ha attivato.
-- Solo aggiunte e "create or replace": nessun drop, nessuna cancellazione.

create table if not exists public.seguimi (
  partner_id     uuid primary key default public.my_partner_id() references public.partners(id) on delete cascade,
  attivo         boolean not null default true,
  condividi      boolean not null default false,
  aggiornato_il  timestamptz not null default now()
);
create table if not exists public.seguimi_giorni (
  partner_id     uuid not null default public.my_partner_id() references public.partners(id) on delete cascade,
  giorno         date not null check (giorno >= date '2026-01-01'),
  azioni         jsonb not null default '[]' check (jsonb_typeof(azioni) = 'array' and jsonb_array_length(azioni) <= 30),
  proposte       int not null default 0 check (proposte between 0 and 30),
  fatte          int not null default 0 check (fatte between 0 and 30),
  per_tipo       jsonb not null default '{}' check (jsonb_typeof(per_tipo) = 'object'),
  primary key (partner_id, giorno)
);

alter table public.seguimi enable row level security;
alter table public.seguimi_giorni enable row level security;
revoke all on public.seguimi, public.seguimi_giorni from anon, authenticated;
grant select on public.seguimi, public.seguimi_giorni to authenticated;
grant insert (attivo, condividi) on public.seguimi to authenticated;
grant update (attivo, condividi) on public.seguimi to authenticated;
grant insert (giorno, azioni, proposte, fatte, per_tipo) on public.seguimi_giorni to authenticated;
grant update (azioni, proposte, fatte, per_tipo) on public.seguimi_giorni to authenticated;

create policy seguimi_mio on public.seguimi for all to authenticated
  using (partner_id = public.my_partner_id()) with check (partner_id = public.my_partner_id());
create policy seguimi_giorni_miei on public.seguimi_giorni for all to authenticated
  using (partner_id = public.my_partner_id())
  with check (partner_id = public.my_partner_id() and giorno <= (now() at time zone 'Europe/Rome')::date);

/* per sponsor e upline: gli ultimi 7 giorni di un partner che ha scelto di condividerli, solo i numeri (mai le azioni
   con i nomi). Niente se non lo condivide, se non lo ha attivo o se non lo vedo. */
create or replace function public.seguimi_di(p_partner uuid)
returns table (giorno date, proposte int, fatte int, per_tipo jsonb)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  io uuid := public.my_partner_id();
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  if p_partner = io or not public.vedo(p_partner)
     or not exists (select 1 from public.seguimi s where s.partner_id = p_partner and s.attivo and s.condividi) then
    return;
  end if;
  return query
    select g.giorno, g.proposte, g.fatte, g.per_tipo from public.seguimi_giorni g
     where g.partner_id = p_partner and g.giorno > (now() at time zone 'Europe/Rome')::date - 7
     order by g.giorno;
end;
$$;

revoke execute on function public.seguimi_di(uuid) from public, anon, authenticated;
grant execute on function public.seguimi_di(uuid) to authenticated;
