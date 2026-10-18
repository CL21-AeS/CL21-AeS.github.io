-- Growup Team — 024: i Clienti dentro Growup (18 ottobre 2026).
-- Dalla mini app "Clienti e Riordini": chi ha preso cosa e quando, quando finisce, chi è da sentire.
-- Un cliente è una persona della Lista chiusa come "Cliente" (una sola scheda per tutto il percorso).
-- Gli ordini NON contano nei VP del mese (decisione di Stefano: i VP arrivano dal report Amway o da "+ Ordine").
-- Tutto visibile solo a chi lo scrive, come la Lista.

alter table public.persone add column if not exists compleanno text check (compleanno ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$');
alter table public.persone add column if not exists auguri_anno int check (auguri_anno between 2020 and 2100);
alter table public.persone add column if not exists non_compra boolean not null default false;
alter table public.persone add column if not exists lasciati text[] not null default '{}';  -- prodotti che non segue più
grant insert (compleanno) on public.persone to authenticated;
grant update (compleanno, auguri_anno, non_compra, lasciati) on public.persone to authenticated;

create table if not exists public.ordini (
  id            uuid primary key default gen_random_uuid(),
  proprietario  uuid not null default public.my_partner_id() references public.partners(id) on delete cascade,
  persona_id    uuid not null references public.persone(id) on delete cascade,
  data          date not null default (now() at time zone 'Europe/Rome')::date check (data >= date '2000-01-01'),
  modo          text not null default 'sito' check (modo in ('sito', 'io')),   -- dal sito Amway da solo, o fatto da me
  consegnato    date,
  pagato        date,
  verificato    date,   -- "come ti sei trovato" fatto
  nota          text check (length(nota) <= 500),
  creato_il     timestamptz not null default now()
);
create index if not exists ordini_persona_idx on public.ordini (persona_id, data);

create table if not exists public.righe_ordine (
  id            uuid primary key default gen_random_uuid(),
  ordine_id     uuid not null references public.ordini(id) on delete cascade,
  proprietario  uuid not null default public.my_partner_id() references public.partners(id) on delete cascade,
  codice        text not null check (length(codice) between 1 and 20),
  nome          text not null check (length(nome) between 1 and 160),
  quantita      int not null default 1 check (quantita between 1 and 99),
  prezzo        numeric(10,2) check (prezzo >= 0 and prezzo <= 100000)
);
create index if not exists righe_ordine_idx on public.righe_ordine (ordine_id);

-- quanto dura un prodotto per me (di base 30 giorni): vale per tutti i miei clienti
create table if not exists public.durate (
  proprietario  uuid not null default public.my_partner_id() references public.partners(id) on delete cascade,
  codice        text not null check (length(codice) between 1 and 20),
  giorni        int not null check (giorni between 1 and 3650),
  primary key (proprietario, codice)
);

-- l'ordine e le righe sono di chi ha la persona; nessuno scrive sulle persone degli altri
create or replace function public.ordini_prima()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pr uuid;
begin
  if tg_table_name = 'ordini' then
    select proprietario into pr from public.persone where id = new.persona_id;
  else
    select proprietario into pr from public.ordini where id = new.ordine_id;
  end if;
  if pr is null or (auth.uid() is not null and pr is distinct from public.my_partner_id()) then
    raise exception 'non_autorizzato';
  end if;
  new.proprietario := pr;
  return new;
end;
$$;
drop trigger if exists ordini_prima on public.ordini;
create trigger ordini_prima before insert on public.ordini for each row execute function public.ordini_prima();
drop trigger if exists righe_ordine_prima on public.righe_ordine;
create trigger righe_ordine_prima before insert on public.righe_ordine for each row execute function public.ordini_prima();

alter table public.ordini enable row level security;
alter table public.righe_ordine enable row level security;
alter table public.durate enable row level security;
revoke all on public.ordini, public.righe_ordine, public.durate from anon, authenticated;
grant select, delete on public.ordini, public.righe_ordine, public.durate to authenticated;
grant insert (id, persona_id, data, modo, consegnato, pagato, nota) on public.ordini to authenticated;
grant update (data, modo, consegnato, pagato, verificato, nota) on public.ordini to authenticated;
grant insert (id, ordine_id, codice, nome, quantita, prezzo) on public.righe_ordine to authenticated;
grant update (quantita, prezzo) on public.righe_ordine to authenticated;
grant insert (codice, giorni) on public.durate to authenticated;
grant update (giorni) on public.durate to authenticated;

drop policy if exists ordini_miei on public.ordini;
create policy ordini_miei on public.ordini for all to authenticated
  using (proprietario = public.my_partner_id()) with check (proprietario = public.my_partner_id());
drop policy if exists righe_ordine_mie on public.righe_ordine;
create policy righe_ordine_mie on public.righe_ordine for all to authenticated
  using (proprietario = public.my_partner_id()) with check (proprietario = public.my_partner_id());
drop policy if exists durate_mie on public.durate;
create policy durate_mie on public.durate for all to authenticated
  using (proprietario = public.my_partner_id()) with check (proprietario = public.my_partner_id());

revoke execute on function public.ordini_prima() from public, anon, authenticated;

-- I numeri per sponsor e upline: anche quanti clienti (mai i nomi)
create or replace function public.numeri_persone(p_partner uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  m date := date_trunc('month', (now() at time zone 'Europe/Rome')::date)::date;
begin
  if public.my_partner_id() is null or not public.vedo(p_partner) then
    raise exception 'non_autorizzato';
  end if;
  return jsonb_build_object(
    'in_lista',  (select count(*) from public.persone where proprietario = p_partner and esito is null and fase = 'lista'),
    'in_corso',  (select count(*) from public.persone where proprietario = p_partner and esito is null and fase <> 'lista'),
    'piani_mese', (select count(*) from public.passi where proprietario = p_partner and tipo = 'piano' and data >= m),
    'si_mese',   (select count(*) from public.passi where proprietario = p_partner and tipo = 'chiusura'
                    and esito in ('partner', 'cliente') and data >= m),
    'clienti',   (select count(*) from public.persone where proprietario = p_partner and esito = 'cliente' and not non_compra),
    'totale',    (select count(*) from public.persone where proprietario = p_partner));
end;
$$;
