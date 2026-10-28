-- Growup Team — 042: copia di sicurezza senza dati intimi, e di chi è in attesa l'upline vede solo il nome (28 ottobre 2026).
-- Decisioni di Stefano dopo il controllo di sicurezza del 28 ottobre:
-- * dalla copia di sicurezza escono il «perché» dell'obiettivo, l'email e l'impronta delle chiavi d'accesso; gli ordini e
--   le correzioni del totale scritti a mano restano (servono a ripristinare tutto);
-- * di chi è «in attesa della mappa» l'upline riceve solo il nome (non più il codice Amway). L'anteprima dell'import lo
--   riconosce chiedendo al database quali persone in attesa sono nel report che si sta importando (`attesa_nel_report`):
--   il codice torna all'app solo se era già nel file di chi importa; al massimo 30 richieste e 20.000 codici al giorno per partner.

-- ---- La copia di sicurezza ----
create or replace function public.copia_dati()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.sono_admin() then
    raise exception 'non_autorizzato';
  end if;
  return jsonb_build_object(
    'app', 'Growup Team',
    'creata_il', now(),
    'tabelle', jsonb_build_object(
      -- senza l'impronta delle chiavi d'accesso e senza email
      'partners',           coalesce((select jsonb_agg(to_jsonb(t) - 'chiave_hash' - 'email' order by t.creato_il) from public.partners t), '[]'),
      'activities',         coalesce((select jsonb_agg(to_jsonb(t)) from public.activities t), '[]'),
      'goals',              coalesce((select jsonb_agg(to_jsonb(t)) from public.goals t), '[]'),
      'monthly_goals',      coalesce((select jsonb_agg(to_jsonb(t)) from public.monthly_goals t), '[]'),
      'monthly_totals',     coalesce((select jsonb_agg(to_jsonb(t)) from public.monthly_totals t), '[]'),
      'numeri_report',      coalesce((select jsonb_agg(to_jsonb(t)) from public.numeri_report t), '[]'),
      'numeri_mese',        coalesce((select jsonb_agg(to_jsonb(t)) from public.numeri_mese t), '[]'),
      -- il «perché» resta solo della persona
      'obiettivi',          coalesce((select jsonb_agg(to_jsonb(t) - 'perche') from public.obiettivi t), '[]'),
      'preferiti',          coalesce((select jsonb_agg(to_jsonb(t)) from public.preferiti t), '[]'),
      'esclusi_import',     coalesce((select jsonb_agg(to_jsonb(t)) from public.esclusi_import t), '[]'),
      'nascosti',           coalesce((select jsonb_agg(to_jsonb(t)) from public.nascosti t), '[]'),
      'inviti_admin',       coalesce((select jsonb_agg(to_jsonb(t)) from public.inviti_admin t), '[]'),
      'settings',           coalesce((select jsonb_agg(to_jsonb(t)) from public.settings t), '[]'),
      'stage_requirements', coalesce((select jsonb_agg(to_jsonb(t) order by t.ordine) from public.stage_requirements t), '[]'),
      'percent_levels',     coalesce((select jsonb_agg(to_jsonb(t)) from public.percent_levels t), '[]')
    )
  );
end;
$$;

-- ---- Chi è in attesa: per l'upline solo il nome ----
drop function if exists public.in_attesa();
create function public.in_attesa()
returns table (id uuid, nome text, sponsor_id uuid, sponsor_nome text, creato_il timestamptz, mio boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.nome, p.sponsor_id, s.nome, p.creato_il, p.sponsor_id = public.my_partner_id()
    from public.partners p left join public.partners s on s.id = p.sponsor_id
   where p.stato <> 'gestito' and p.confermato_il is null and not p.is_admin
     and p.id <> public.my_partner_id() and public.is_in_downline(p.id)
   order by p.creato_il
$$;

-- per l'anteprima dell'import: quali persone in attesa del mio gruppo sono nel report che sto importando.
-- Il codice torna solo se l'ho mandato io (era nel mio file). Per non poter «provare» codici a caso, le richieste sono
-- contate: al massimo 30 al giorno per partner (un import ne usa una per file) e 20.000 codici in tutto, registrate in
-- attesa_richieste; le richieste della stessa persona passano una alla volta (blocco per partner).
create table if not exists public.attesa_richieste (
  partner_id  uuid not null references public.partners(id) on delete cascade,
  il          timestamptz not null default now(),
  codici      int not null
);
create index if not exists attesa_richieste_partner on public.attesa_richieste (partner_id, il);
alter table public.attesa_richieste enable row level security;
revoke all on public.attesa_richieste from anon, authenticated;

create or replace function public.attesa_nel_report(p_codici text[])
returns table (id uuid, nome text, codice text)
language plpgsql
security definer
set search_path = public
as $$
declare
  io uuid := public.my_partner_id();
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  if cardinality(coalesce(p_codici, '{}')) > 5000 then
    raise exception 'import_non_valido';
  end if;
  perform pg_advisory_xact_lock(hashtext('attesa_richieste:' || io::text));
  if (select count(*) >= 30 or coalesce(sum(r.codici), 0) + cardinality(coalesce(p_codici, '{}')) > 20000
        from public.attesa_richieste r where r.partner_id = io and r.il > now() - interval '1 day') then
    raise exception 'troppe_richieste';
  end if;
  insert into public.attesa_richieste (partner_id, codici) values (io, cardinality(coalesce(p_codici, '{}')));
  return query
    select p.id, p.nome, p.codice_amway
      from public.partners p
     where p.codice_amway = any(p_codici)
       and p.stato <> 'gestito' and p.confermato_il is null and not p.is_admin
       and p.id <> io and public.is_in_downline(p.id);
end;
$$;

revoke execute on function public.in_attesa(), public.attesa_nel_report(text[]) from public, anon, authenticated;
grant execute on function public.in_attesa(), public.attesa_nel_report(text[]) to authenticated;
