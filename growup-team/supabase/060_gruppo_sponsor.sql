-- ============================================================
-- Growup Team — 060: lo sponsor e i suoi nuovi in partenza (4 novembre 2026, consegna 8 del piano «nuova Io»)
-- Decisioni di Stefano: nel Gruppo «I tuoi nuovi in partenza» mostra solo chi ho invitato io e usa l'app, finché non ha
-- finito (nuovi: fase N di 5; avviati: per iniziare). La × li toglie solo da lì, con Annulla, e tornano se riprendono
-- (se vanno avanti di fase). La scheda del nuovo mostra il percorso, solo numeri.
-- * partenze(p_partner): i numeri della partenza. Senza argomento: chi ho invitato io; con un partner: lui, se lo vedo.
--   Solo numeri e date: mai i nomi della Lista, mai il testo del perché (solo se c'è).
-- * partenza_tolti: chi ho tolto con la ×, con la fase in cui era; righe solo mie.
-- Nessun drop, nessun dato toccato.
-- ============================================================

/* chi ho invitato io (anche se è ancora «in attesa della mappa», fuori dalla struttura) */
create or replace function public.invitato_da_me(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.partners x where x.id = target and x.invitato_da = public.my_partner_id())
$$;
revoke execute on function public.invitato_da_me(uuid) from public, anon, authenticated;
grant execute on function public.invitato_da_me(uuid) to authenticated;

create table if not exists public.partenza_tolti (
  partner_id uuid not null default public.my_partner_id() references public.partners(id) on delete cascade,
  nuovo_id   uuid not null references public.partners(id) on delete cascade,
  fase       int  not null check (fase between 1 and 5),
  tolto_il   timestamptz not null default now(),
  primary key (partner_id, nuovo_id)
);
alter table public.partenza_tolti enable row level security;
drop policy if exists partenza_tolti_mie on public.partenza_tolti;
create policy partenza_tolti_mie on public.partenza_tolti for all to authenticated
  using (partner_id = public.my_partner_id())
  with check (partner_id = public.my_partner_id()
              and (public.vedo(nuovo_id) or public.invitato_da_me(nuovo_id)));
revoke all on public.partenza_tolti from public, anon, authenticated;
grant select, delete on public.partenza_tolti to authenticated;
grant insert (nuovo_id, fase), update (fase, tolto_il) on public.partenza_tolti to authenticated;

create or replace function public.partenze(p_partner uuid default null)
returns table (id uuid, nome text, stato text, data_iscrizione date, ingresso date, incontro_sponsor date,
               partenza_completata_il timestamptz, punto_upline date, punto_upline_fatto date, ha_perche boolean,
               nomi_lista int, vp_dal_ingresso numeric, contatti int, invitati int, piani int, clienti int,
               ha_gruppo boolean, mappa_importata boolean, invitato_da_me boolean)
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
  /* chi ho invitato lo vedo anche mentre è «in attesa della mappa» (ancora fuori dalla struttura) */
  if p_partner is not null and not public.vedo(p_partner) and not public.invitato_da_me(p_partner) then
    raise exception 'non_autorizzato';
  end if;
  return query
  select p.id, p.nome, p.stato, p.data_iscrizione,
         coalesce(p.privacy_accettata_il, p.creato_il)::date,
         p.incontro_sponsor, p.partenza_completata_il, p.punto_upline, p.punto_upline_fatto,
         exists (select 1 from public.obiettivi o where o.partner_id = p.id and length(btrim(coalesce(o.perche, ''))) > 0),
         (select count(*)::int from public.persone x where x.proprietario = p.id and x.esito is distinct from 'cliente'),
         (select coalesce(sum(a.vp), 0) from public.activities a where a.partner_id = p.id and a.tipo in ('ordine', 'rettifica')
            and a.data >= coalesce(p.data_iscrizione, '2000-01-01'::date)),
         (select coalesce(sum(a.quantita), 0)::int from public.activities a where a.partner_id = p.id and a.tipo = 'contatto'),
         (select count(*)::int from public.passi s where s.proprietario = p.id and s.tipo = 'invito'),
         (select coalesce(sum(a.quantita), 0)::int from public.activities a where a.partner_id = p.id and a.tipo = 'piano'),
         (select coalesce(sum(a.quantita), 0)::int from public.activities a where a.partner_id = p.id and a.tipo = 'cliente'),
         exists (select 1 from public.partners f where f.sponsor_id = p.id),
         exists (select 1 from public.numeri_mese n where n.importato_da = p.id),
         p.invitato_da = io
    from public.partners p
   where p.stato <> 'gestito'
     and (case when p_partner is null then p.invitato_da = io else p.id = p_partner end);
end;
$$;
revoke execute on function public.partenze(uuid) from public, anon, authenticated;
grant execute on function public.partenze(uuid) to authenticated;
