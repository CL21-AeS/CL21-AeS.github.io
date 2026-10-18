-- Growup Team — 020: la Lista dentro Growup (18 ottobre 2026).
-- Ognuno tiene qui le persone della sua lista e il percorso fino al sì (In lista → Contattato → Invitato → Piano →
-- Follow-up → Chiusura), come nella mini app "Dalla Lista al Sì".
-- Decisione di Stefano: nomi e dettagli li vede SOLO chi li inserisce (né sponsor, né upline, né admin);
-- l'upline vede soltanto i numeri (numeri_persone). La copia degli admin (copia_dati) non contiene queste tabelle.
-- Segnare un passo conta da solo l'attività: Contatto → contatto, Piano → piano, Chiusura "Cliente" → cliente.

create table if not exists public.persone (
  id             uuid primary key default gen_random_uuid(),
  proprietario   uuid not null default public.my_partner_id() references public.partners(id) on delete cascade,
  nome           text not null check (length(btrim(nome)) between 1 and 80),
  contatto       text check (length(contatto) <= 80),
  origine        text check (length(origine) <= 80),
  note           text check (length(note) <= 2000),
  -- il punto più avanti raggiunto nel percorso e, se chiusa, com'è finita: li calcola persona_ricalcola dai passi
  fase           text not null default 'lista' check (fase in ('lista', 'contattato', 'invitato', 'piano', 'followup')),
  esito          text check (esito in ('partner', 'cliente', 'non_ora', 'no')),
  prossima_data  date,
  prossima_nota  text check (length(prossima_nota) <= 200),
  creato_il      timestamptz not null default now(),
  aggiornato_il  timestamptz not null default now()
);
create index if not exists persone_proprietario_idx on public.persone (proprietario);

create table if not exists public.passi (
  id            uuid primary key default gen_random_uuid(),
  persona_id    uuid not null references public.persone(id) on delete cascade,
  proprietario  uuid not null default public.my_partner_id() references public.partners(id) on delete cascade,
  tipo          text not null check (tipo in ('contatto', 'invito', 'piano', 'followup', 'chiusura', 'riapri', 'nota')),
  data          date not null default (now() at time zone 'Europe/Rome')::date check (data >= date '2000-01-01'),
  come          text check (length(come) <= 60),
  reazione      text check (length(reazione) <= 80),
  esito         text check (esito in ('partner', 'cliente', 'non_ora', 'no')),
  nota          text check (length(nota) <= 1000),
  -- passi portati dalla vecchia app: raccontano il passato, non contano attività
  importato     boolean not null default false,
  attivita_id   uuid references public.activities(id) on delete set null,
  creato_il     timestamptz not null default now(),
  constraint passi_chiusura_check check ((tipo = 'chiusura') = (esito is not null))
);
create index if not exists passi_persona_idx on public.passi (persona_id, data);

-- ---- Il punto del percorso e l'esito si ricavano dai passi ----
create or replace function public.persona_ricalcola(p_persona uuid)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.persone p
     set fase = coalesce((select (array['contattato', 'invitato', 'piano', 'followup'])[max(case s.tipo
                            when 'contatto' then 1 when 'invito' then 2 when 'piano' then 3 when 'followup' then 4 end)]
                          from public.passi s where s.persona_id = p.id), 'lista'),
         esito = (select s.esito from public.passi s
                   where s.persona_id = p.id and s.tipo in ('chiusura', 'riapri')
                   order by s.data desc, s.creato_il desc limit 1),
         aggiornato_il = now()
   where p.id = p_persona
$$;

create or replace function public.persone_prima()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.fase := 'lista'; new.esito := null;
    new.creato_il := now();
  else
    new.proprietario := old.proprietario;
    new.creato_il := old.creato_il;
  end if;
  new.aggiornato_il := now();
  return new;
end;
$$;
drop trigger if exists persone_prima on public.persone;
create trigger persone_prima before insert or update on public.persone
for each row execute function public.persone_prima();

create or replace function public.passi_prima()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pr uuid;
  t  text;
begin
  select proprietario into pr from public.persone where id = new.persona_id;
  if pr is null or (auth.uid() is not null and pr is distinct from public.my_partner_id()) then
    raise exception 'non_autorizzato';
  end if;
  new.proprietario := pr;
  new.creato_il := clock_timestamp();  -- l'ordine dei passi dello stesso giorno
  -- il passo conta l'attività del giorno (mai per i passi importati)
  t := case new.tipo when 'contatto' then 'contatto' when 'piano' then 'piano'
         when 'chiusura' then case when new.esito = 'cliente' then 'cliente' end end;
  new.attivita_id := null;
  if t is not null and not new.importato then
    insert into public.activities (partner_id, tipo, data) values (pr, t, new.data) returning id into new.attivita_id;
  end if;
  return new;
end;
$$;
drop trigger if exists passi_prima on public.passi;
create trigger passi_prima before insert on public.passi
for each row execute function public.passi_prima();

create or replace function public.passi_dopo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- togliendo il passo si toglie l'attività contata; in un mese già chiuso resta (lo storico non cambia).
  -- Togliendo la persona dalla lista, invece, i numeri già contati restano.
  if tg_op = 'DELETE' and old.attivita_id is not null
     and exists (select 1 from public.persone where id = old.persona_id) then
    begin
      delete from public.activities where id = old.attivita_id;
    exception when others then null;
    end;
  end if;
  perform public.persona_ricalcola(coalesce(new.persona_id, old.persona_id));
  return null;
end;
$$;
drop trigger if exists passi_dopo on public.passi;
create trigger passi_dopo after insert or update or delete on public.passi
for each row execute function public.passi_dopo();

-- ---- Solo il proprietario ----
alter table public.persone enable row level security;
alter table public.passi enable row level security;

revoke all on public.persone, public.passi from anon, authenticated;
grant select, delete on public.persone to authenticated;
grant insert (id, nome, contatto, origine, note, prossima_data, prossima_nota) on public.persone to authenticated;
grant update (nome, contatto, origine, note, prossima_data, prossima_nota) on public.persone to authenticated;
grant select, delete on public.passi to authenticated;
grant insert (id, persona_id, tipo, data, come, reazione, esito, nota, importato) on public.passi to authenticated;
grant update (come, reazione, nota) on public.passi to authenticated;

drop policy if exists persone_mie on public.persone;
create policy persone_mie on public.persone for all to authenticated
  using (proprietario = public.my_partner_id()) with check (proprietario = public.my_partner_id());
drop policy if exists passi_miei on public.passi;
create policy passi_miei on public.passi for all to authenticated
  using (proprietario = public.my_partner_id()) with check (proprietario = public.my_partner_id());

-- ---- Per lo sponsor e l'upline: solo i numeri, mai i nomi ----
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
    'totale',    (select count(*) from public.persone where proprietario = p_partner));
end;
$$;

revoke execute on function public.persona_ricalcola(uuid), public.passi_prima(), public.passi_dopo(),
  public.numeri_persone(uuid) from public, anon, authenticated;
grant execute on function public.numeri_persone(uuid) to authenticated;
