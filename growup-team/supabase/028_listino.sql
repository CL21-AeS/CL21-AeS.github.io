-- Growup Team — 028: il listino Amway nel database (20 ottobre 2026).
-- Il listino è "per l'incaricato": non sta più nel repository pubblico (catalogo.js tolto), ma qui, leggibile solo da chi
-- usa l'app (chi è bloccato no). Lo scrive solo l'admin: a mano (prodotti nuovi) o dal PDF Amway letto sul telefono.
-- Per ogni prodotto: prezzo al cliente, prezzo Partner e VP. I prodotti usciti dal listino non si cancellano: "attivo"
-- diventa falso (spariscono dalla ricerca, restano negli ordini già fatti).
-- Le righe degli ordini tengono anche prezzo Partner e VP del momento (i VP del mese restano quelli del report Amway).

create table if not exists public.listino (
  codice          text primary key check (codice ~ '^[0-9]{4,10}$'),
  nome            text not null check (length(btrim(nome)) between 1 and 200),
  formato         text check (length(formato) <= 80),
  categoria       text check (length(categoria) <= 120),
  prezzo_cliente  numeric(10,2) check (prezzo_cliente >= 0 and prezzo_cliente <= 100000),
  prezzo_partner  numeric(10,2) check (prezzo_partner >= 0 and prezzo_partner <= 100000),
  vp              numeric(10,2) check (vp >= 0 and vp <= 100000),
  attivo          boolean not null default true,
  aggiornato_il   timestamptz not null default now()
);

create or replace function public.listino_prima()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.aggiornato_il := now();
  return new;
end;
$$;
drop trigger if exists listino_prima on public.listino;
create trigger listino_prima before insert or update on public.listino
for each row execute function public.listino_prima();

alter table public.listino enable row level security;
revoke all on public.listino from anon, authenticated;
grant select on public.listino to authenticated;
grant insert (codice, nome, formato, categoria, prezzo_cliente, prezzo_partner, vp, attivo) on public.listino to authenticated;
grant update (nome, formato, categoria, prezzo_cliente, prezzo_partner, vp, attivo) on public.listino to authenticated;
drop policy if exists listino_leggo on public.listino;
create policy listino_leggo on public.listino for select to authenticated using (public.my_partner_id() is not null);
drop policy if exists listino_admin_nuovo on public.listino;
create policy listino_admin_nuovo on public.listino for insert to authenticated with check (public.sono_admin());
drop policy if exists listino_admin_cambia on public.listino;
create policy listino_admin_cambia on public.listino for update to authenticated
  using (public.sono_admin()) with check (public.sono_admin());
revoke execute on function public.listino_prima() from public, anon, authenticated;

-- le righe degli ordini: anche prezzo Partner e VP (per unità), per i totali dell'ordine
alter table public.righe_ordine add column if not exists prezzo_partner numeric(10,2) check (prezzo_partner >= 0 and prezzo_partner <= 100000);
alter table public.righe_ordine add column if not exists vp numeric(10,2) check (vp >= 0 and vp <= 100000);
grant insert (prezzo_partner, vp) on public.righe_ordine to authenticated;
grant update (prezzo_partner, vp) on public.righe_ordine to authenticated;
