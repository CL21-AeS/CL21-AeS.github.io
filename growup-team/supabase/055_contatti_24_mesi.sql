-- ============================================================
-- Growup Team — 055: i contatti si cancellano 24 mesi dopo l'ultimo passo (3 novembre 2026, scelte di Stefano)
-- Lista, Target e Clienti: ogni persona si cancella da sola 24 mesi dopo l'ultima cosa fatta su di lei. Conta la più
-- recente tra: inserimento, modifica, passo, ordine (scelta A: chi compra resta). Ogni nuovo passo fa ripartire i 24 mesi.
-- 30 giorni prima l'app avvisa chi l'ha inserita (contatti_in_scadenza): basta un passo per tenerla.
-- Con la persona si cancellano i suoi passi, ordini, cerchie e inviti del Target; i numeri già contati restano
-- (come quando la si toglie a mano). Gli inviti del Target senza persona seguono la stessa regola.
-- La cancellazione la fa solo il server, ogni notte (055b, pg_cron). Solo aggiunte e "create or replace": nessun drop.
-- ============================================================

-- ---- Quando si cancella ogni persona (per tutti: la usano solo le due funzioni qui sotto) ----
create or replace function public.contatti_scadenze()
returns table (persona_id uuid, proprietario uuid, ultima timestamptz, si_cancella_il timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.proprietario, u.ultima, u.ultima + interval '24 months'
    from public.persone p
    cross join lateral (
      select least(now(), greatest(
               p.creato_il, p.aggiornato_il,
               (select max(greatest(s.creato_il, s.data::timestamptz)) from public.passi s where s.persona_id = p.id),
               (select max(greatest(o.creato_il, o.data::timestamptz)) from public.ordini o where o.persona_id = p.id)
             )) as ultima
    ) u
$$;
revoke execute on function public.contatti_scadenze() from public, anon, authenticated;

-- ---- Per l'app: le MIE persone che si cancellano entro 30 giorni ----
create or replace function public.contatti_in_scadenza()
returns table (persona_id uuid, si_cancella_il date)
language sql
stable
security definer
set search_path = public
as $$
  select c.persona_id, (c.si_cancella_il at time zone 'Europe/Rome')::date
    from public.contatti_scadenze() c
   where public.my_partner_id() is not null
     and c.proprietario = public.my_partner_id()
     and c.si_cancella_il <= now() + interval '30 days'
   order by c.si_cancella_il
$$;
revoke execute on function public.contatti_in_scadenza() from public, anon;
grant execute on function public.contatti_in_scadenza() to authenticated;

-- ---- Il controllo di ogni notte: 24 mesi senza niente → si cancella ----
create or replace function public.pulisci_contatti_scaduti()
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  ids uuid[];
begin
  select coalesce(array_agg(persona_id), '{}') into ids
    from public.contatti_scadenze() where si_cancella_il <= now();
  delete from public.inviti_target where persona_id = any(ids);
  delete from public.persone where id = any(ids);
  -- inviti del Target mai collegati a una persona: 24 mesi dalla creazione o dall'ultima risposta
  delete from public.inviti_target
   where persona_id is null and greatest(creato_il, coalesce(risposto_il, creato_il)) <= now() - interval '24 months';
  return coalesce(array_length(ids, 1), 0);
end;
$$;
revoke execute on function public.pulisci_contatti_scaduti() from public, anon, authenticated;
