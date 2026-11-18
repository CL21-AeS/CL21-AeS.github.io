-- ============================================================
-- Growup Team — 067: le caselle della strategia (18 novembre 2026, «La tua strategia» in Io, punto 3)
-- Le caselle di lavoro che il partner sceglie con «Cambia» (prima si ricordavano solo sul telefono).
-- Regole di Stefano:
-- * le vede e le modifica SOLO il partner (nessun upline, nessun admin); la persona scelta non riceve avvisi
--   (nessun trigger di notifica, nessuna funzione che la legga per altri);
-- * al massimo 3 caselle sotto Argento, 20 da Argento in su (qualifica dichiarata, 21% dichiarato o un mese al 21% in una
--   mappa importata): controllato anche qui, non solo nell'app;
-- * «Persona che aiuti» solo nella propria downline (una persona che il partner vede, mai sé stesso);
-- * «Nuovo in profondità»: la linea dev'essere una propria linea frontale.
-- SOLO COSE NUOVE: una tabella, due funzioni, un trigger sulla tabella nuova. Nessuna tabella o funzione esistente cambia.
-- Per toglierla: 067_strategia_caselle_togli.sql.
-- ============================================================

/* da Argento in su: la propria qualifica dichiarata, il 21% dichiarato o un mese al 21% in una mappa importata */
create or replace function public.strategia_caselle_max()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select case when exists (
           select 1 from public.partners p
            where p.id = public.my_partner_id()
              and (coalesce((select s.ordine from public.stage_requirements s where s.chiave = p.qualifica_iniziale), 0)
                     >= (select s.ordine from public.stage_requirements s where s.chiave = 'argento')
                   or coalesce(p.percentuale_iniziale, 0) >= 21))
         or exists (select 1 from public.numeri_mese n where n.partner_id = public.my_partner_id() and n.percentuale >= 21)
       then 20 else 3 end
$$;
revoke execute on function public.strategia_caselle_max() from public, anon, authenticated;
grant execute on function public.strategia_caselle_max() to authenticated;

create table if not exists public.strategia_caselle (
  partner_id  uuid not null default public.my_partner_id() references public.partners(id) on delete cascade,
  posizione   int  not null check (posizione between 1 and 20),
  tipo        text not null check (tipo in ('aiuta', 'profondita', 'nuova_linea', 'libera')),
  persona_id  uuid references public.partners(id) on delete cascade,   -- solo «Persona che aiuti»
  linea_id    uuid references public.partners(id) on delete cascade,   -- solo «Nuovo in profondità»
  creato_il   timestamptz not null default now(),                       -- da quando la casella è così (cambia con il tipo)
  aggiornato_il timestamptz not null default now(),
  primary key (partner_id, posizione),
  check ((tipo = 'aiuta') = (persona_id is not null)),
  check ((tipo = 'profondita') = (linea_id is not null)),
  check (persona_id is null or persona_id <> partner_id)
);
create index if not exists strategia_caselle_persona_idx on public.strategia_caselle (persona_id) where persona_id is not null;
create index if not exists strategia_caselle_linea_idx on public.strategia_caselle (linea_id) where linea_id is not null;

/* creato_il resta quello di prima se la casella non cambia (serve a riconoscere chi è stato invitato «per» quella casella) */
create or replace function public.strategia_caselle_date()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.aggiornato_il := now();
  if tg_op = 'UPDATE' and (new.tipo is distinct from old.tipo or new.persona_id is distinct from old.persona_id
                           or new.linea_id is distinct from old.linea_id) then
    new.creato_il := now();   -- (dal telefono creato_il non si scrive: senza cambiamenti resta quella di prima)
  end if;
  return new;
end;
$$;
drop trigger if exists strategia_caselle_date on public.strategia_caselle;
create trigger strategia_caselle_date before insert or update on public.strategia_caselle
  for each row execute function public.strategia_caselle_date();

alter table public.strategia_caselle enable row level security;
drop policy if exists strategia_caselle_mie on public.strategia_caselle;
create policy strategia_caselle_mie on public.strategia_caselle for all to authenticated
  using (partner_id = (select public.my_partner_id()))
  with check (partner_id = (select public.my_partner_id())
              and posizione <= (select public.strategia_caselle_max())
              and (tipo <> 'aiuta' or public.vedo(persona_id))
              and (tipo <> 'profondita' or exists (select 1 from public.partners f
                                                     where f.id = linea_id and f.sponsor_id = partner_id and public.vedo(f.id))));
revoke all on public.strategia_caselle from public, anon, authenticated;
grant select, delete on public.strategia_caselle to authenticated;
grant insert (posizione, tipo, persona_id, linea_id), update (posizione, tipo, persona_id, linea_id) on public.strategia_caselle to authenticated;
