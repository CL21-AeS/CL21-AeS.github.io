-- Growup Team — 042b: un limite alle richieste di attesa_nel_report (28 ottobre 2026).
-- Dopo la 042 la revisione di sicurezza automatica ha notato che, senza un limite, un'upline poteva mandare migliaia di
-- codici e scoprire il codice Amway di chi è in attesa (aggirando «solo il nome»). Ora al massimo 30 richieste e
-- 20.000 codici al giorno per partner (un import ne usa una per file), contate in attesa_richieste (solo per il server);
-- le richieste della stessa persona passano una alla volta. Si può rilanciare.

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

revoke execute on function public.attesa_nel_report(text[]) from public, anon, authenticated;
grant execute on function public.attesa_nel_report(text[]) to authenticated;
