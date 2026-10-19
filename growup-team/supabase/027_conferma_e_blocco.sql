-- Growup Team — 027: chi entra va confermato dal report Amway; si può togliere finché non lo è; l'admin blocca l'app (19 ottobre 2026).
--   - Chi usa l'app è "Da confermare" finché il suo codice Amway non compare in un report mappe importato (da lui stesso,
--     dal suo sponsor o da un upline). Chi prende il posto di una persona già importata è confermato subito.
--     Decisione di Stefano: anche chi è già nell'app riparte "Da confermare" (gli admin no).
--   - Finché è da confermare, sponsor, upline e admin possono toglierlo dalla struttura: il profilo e tutti i suoi dati
--     si cancellano, i suoi telefoni vedono "accesso tolto", il suo codice Amway non può rientrare finché un admin non
--     lo sblocca, e chi aveva già invitato passa sotto il suo sponsor. Dopo la conferma vale di nuovo "nessuno cancella".
--   - L'admin blocca e sblocca l'app di chiunque (non di sé né di un altro admin): il blocco è nel database
--     (my_partner_id non risponde più), i dati restano e i VP contano. Sponsor e upline vedono "Bloccato".

alter table public.partners add column if not exists confermato_il timestamptz;
alter table public.partners add column if not exists bloccato_il timestamptz;
alter table public.partners add column if not exists bloccato_da uuid references public.partners(id) on delete set null;
update public.partners set confermato_il = coalesce(confermato_il, now()) where is_admin;

-- i codici tolti (non rientrano) e i telefoni a cui è stato tolto l'accesso: li leggono solo le funzioni qui sotto
create table if not exists public.codici_tolti (
  codice_amway  text primary key,
  nome          text,
  tolto_il      timestamptz not null default now(),
  tolto_da      uuid references public.partners(id) on delete set null
);
create table if not exists public.accessi_tolti (
  user_id   uuid primary key,
  tolto_il  timestamptz not null default now()
);
alter table public.codici_tolti enable row level security;
alter table public.accessi_tolti enable row level security;
revoke all on public.codici_tolti, public.accessi_tolti from anon, authenticated;

-- un profilo bloccato non risponde più: niente dati, niente funzioni
create or replace function public.my_partner_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select a.partner_id from public.accessi a join public.partners p on p.id = a.partner_id
   where a.user_id = auth.uid() and p.bloccato_il is null
$$;

-- confermato dal report: ogni volta che l'import salva i numeri di chi usa l'app
create or replace function public.salva_numeri_report(p_chi uuid, p_partner uuid, p_mese date, r jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  update public.partners set confermato_il = now()
   where id = p_partner and stato <> 'gestito' and confermato_il is null;
  if r ? 'vpg' then
    insert into public.numeri_report (visto_da, partner_id, mese, vpp, vpg, percentuale, linee, linee_nascoste)
    values (p_chi, p_partner, date_trunc('month', p_mese)::date, coalesce((r->>'vpp')::numeric, 0),
            coalesce((r->>'vpg')::numeric, 0), nullif(r->>'percentuale', '')::int,
            case when jsonb_typeof(r->'linee') = 'array' then r->'linee' else '[]' end,
            coalesce((r->>'nascoste')::boolean, false))
    on conflict (visto_da, partner_id, mese) do update
      set vpp = excluded.vpp, vpg = excluded.vpg, percentuale = excluded.percentuale,
          linee = excluded.linee, linee_nascoste = excluded.linee_nascoste, aggiornato_il = now();
  end if;
end;
$$;

-- chi prende il posto di una persona già importata è confermato; un codice tolto non rientra
create or replace function public.partners_conferma()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.stato = 'gestito' and new.stato <> 'gestito' then
    new.confermato_il := coalesce(new.confermato_il, now());
  end if;
  if new.stato <> 'gestito' and new.codice_amway is not null
     and (tg_op = 'INSERT' or new.codice_amway is distinct from old.codice_amway or old.stato = 'gestito')
     and exists (select 1 from public.codici_tolti where codice_amway = new.codice_amway) then
    raise exception 'codice_tolto';
  end if;
  return new;
end;
$$;
drop trigger if exists partners_conferma on public.partners;
create trigger partners_conferma before insert or update on public.partners
for each row execute function public.partners_conferma();

-- conferma e blocco di chi vedo nella struttura (le etichette "Da confermare" e "Bloccato")
create or replace function public.accessi_struttura()
returns table (id uuid, confermato_il timestamptz, bloccato_il timestamptz, is_admin boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.confermato_il, p.bloccato_il, p.is_admin from public.partners p
   where p.stato <> 'gestito' and public.vedo(p.id)
$$;

-- il telefono: perché non c'è più un profilo (tolto dalla struttura o bloccato)
create or replace function public.stato_accesso()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (select 1 from public.accessi a join public.partners p on p.id = a.partner_id
                  where a.user_id = auth.uid() and p.bloccato_il is not null) then 'bloccato'
    when exists (select 1 from public.accessi_tolti where user_id = auth.uid()) then 'tolto'
    else null end
$$;

-- togliere dalla struttura chi non è ancora confermato: sponsor, upline e admin
create or replace function public.togli_dalla_struttura(p_partner uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  io  uuid := public.my_partner_id();
  t   public.partners;
  via uuid[];
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  select * into t from public.partners where id = p_partner;
  if not found or t.stato = 'gestito' or t.id = io or t.is_admin then
    raise exception 'non_autorizzato';
  end if;
  if not (public.sono_admin() or public.is_in_downline(t.id)) then
    raise exception 'non_autorizzato';
  end if;
  if t.confermato_il is not null then
    raise exception 'gia_confermato';
  end if;
  -- le persone importate da lui (solo sue) se ne vanno con lui; chi aveva invitato passa al suo sponsor
  via := array(select id from public.partners where gestore_id = t.id and stato = 'gestito') || t.id;
  update public.partners set sponsor_id = t.sponsor_id where sponsor_id = any(via) and not (id = any(via));
  update public.partners set gestore_id = null where gestore_id = any(via) and not (id = any(via));
  update public.partners set creato_da = null where creato_da = any(via) and not (id = any(via));
  update public.partners set bloccato_da = null where bloccato_da = any(via);
  if t.codice_amway is not null then
    insert into public.codici_tolti (codice_amway, nome, tolto_da) values (t.codice_amway, t.nome, io)
    on conflict (codice_amway) do update set nome = excluded.nome, tolto_il = now(), tolto_da = excluded.tolto_da;
  end if;
  insert into public.accessi_tolti (user_id) select user_id from public.accessi where partner_id = t.id
  on conflict (user_id) do update set tolto_il = now();
  delete from public.partners where id = any(via);
end;
$$;

-- l'admin blocca o sblocca l'app di qualcuno
create or replace function public.blocca_app(p_partner uuid, p_blocca boolean)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  io uuid := public.my_partner_id();
  t  public.partners;
begin
  if io is null or not public.sono_admin() then
    raise exception 'non_autorizzato';
  end if;
  select * into t from public.partners where id = p_partner;
  if not found or t.stato = 'gestito' or t.id = io or t.is_admin then
    raise exception 'non_autorizzato';
  end if;
  update public.partners
     set bloccato_il = case when p_blocca then coalesce(bloccato_il, now()) end,
         bloccato_da = case when p_blocca then io end
   where id = t.id;
end;
$$;

-- i codici tolti: l'admin li vede e li sblocca
create or replace function public.codici_tolti_elenco()
returns table (codice_amway text, nome text, tolto_il timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.sono_admin() then
    raise exception 'non_autorizzato';
  end if;
  return query select c.codice_amway, c.nome, c.tolto_il from public.codici_tolti c order by c.tolto_il desc;
end;
$$;
create or replace function public.sblocca_codice(p_codice text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.sono_admin() then
    raise exception 'non_autorizzato';
  end if;
  delete from public.codici_tolti where codice_amway = p_codice;
end;
$$;

grant select (confermato_il, bloccato_il) on public.partners to authenticated;
revoke execute on function public.partners_conferma(), public.accessi_struttura(), public.stato_accesso(),
  public.togli_dalla_struttura(uuid), public.blocca_app(uuid, boolean), public.codici_tolti_elenco(),
  public.sblocca_codice(text), public.salva_numeri_report(uuid, uuid, date, jsonb) from public, anon, authenticated;
grant execute on function public.accessi_struttura(), public.stato_accesso(), public.togli_dalla_struttura(uuid),
  public.blocca_app(uuid, boolean), public.codici_tolti_elenco(), public.sblocca_codice(text) to authenticated;
