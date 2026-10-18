-- Growup Team — 022: il Target dentro Growup (18 ottobre 2026).
-- Le otto domande per chi non conosci (dalla mini app "Target"): il partner crea un invito, lo manda su WhatsApp,
-- il contatto risponde da una pagina di Growup senza accesso e rimanda il codice delle risposte su WhatsApp.
-- Gli inviti li vede solo chi li crea (come la Lista). Il contatto non scrive niente nel database: può solo chiedere
-- se il suo link è ancora aperto (invito_target_aperto), con un identificativo casuale di 6 caratteri.

create table if not exists public.inviti_target (
  id            text primary key check (id ~ '^[A-Z0-9]{6}$'),
  proprietario  uuid not null default public.my_partner_id() references public.partners(id) on delete cascade,
  nome          text not null check (length(btrim(nome)) between 1 and 80),
  scade         date,
  bloccato      boolean not null default false,
  -- le otto risposte (0, 1 o 2 per domanda), quando il partner apre il codice ricevuto
  risposte      smallint[] check (risposte is null or (array_length(risposte, 1) = 8 and 0 <= all(risposte) and 2 >= all(risposte))),
  risposto_il   timestamptz,
  versione      text check (length(versione) <= 20),
  persona_id    uuid references public.persone(id) on delete set null,
  archiviato    boolean not null default false,
  creato_il     timestamptz not null default now()
);
create index if not exists inviti_target_proprietario_idx on public.inviti_target (proprietario);

alter table public.persone add column if not exists invito_target_id text references public.inviti_target(id) on delete set null;
grant insert (invito_target_id) on public.persone to authenticated;

create or replace function public.inviti_target_prima()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.creato_il := now();
    new.risposte := null; new.risposto_il := null; new.persona_id := null;
  else
    new.id := old.id;
    new.proprietario := old.proprietario;
    new.creato_il := old.creato_il;
    if new.risposte is distinct from old.risposte then new.risposto_il := now(); end if;
  end if;
  return new;
end;
$$;
drop trigger if exists inviti_target_prima on public.inviti_target;
create trigger inviti_target_prima before insert or update on public.inviti_target
for each row execute function public.inviti_target_prima();

alter table public.inviti_target enable row level security;
revoke all on public.inviti_target from anon, authenticated;
grant select, delete on public.inviti_target to authenticated;
grant insert (id, nome, scade) on public.inviti_target to authenticated;
grant update (nome, scade, bloccato, risposte, versione, persona_id, archiviato) on public.inviti_target to authenticated;
drop policy if exists inviti_target_miei on public.inviti_target;
create policy inviti_target_miei on public.inviti_target for all to authenticated
  using (proprietario = public.my_partner_id()) with check (proprietario = public.my_partner_id());

-- Per la pagina del contatto: il link è ancora aperto? (niente nomi, niente risposte)
create or replace function public.invito_target_aperto(p_id text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select case when i.bloccato then 'bloccato'
                               when i.risposte is not null then 'usato'
                               when i.scade < (now() at time zone 'Europe/Rome')::date then 'scaduto'
                               else 'ok' end
                     from public.inviti_target i where i.id = upper(p_id)), 'sconosciuto')
$$;
revoke execute on function public.invito_target_aperto(text), public.inviti_target_prima(),
  public.persone_prima() from public, anon, authenticated;  -- persone_prima: la funzione del trigger della Lista (020)
grant execute on function public.invito_target_aperto(text) to anon, authenticated;
