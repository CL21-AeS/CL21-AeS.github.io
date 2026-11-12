-- ============================================================
-- Growup Team — 064: il primo ordine in attesa della mappa, visto dallo sponsor (13 novembre 2026)
-- Scelta di Stefano: il primo ordine confermato che la mappa non mostra ancora non ferma il percorso del nuovo; lo
-- sponsor in «I tuoi nuovi in partenza» vede la stessa fase e lo stesso «!».
-- Gli ordini del nuovo restano privati (RLS di ordini_personali): questa funzione dice soltanto QUALI nuovi hanno un
-- ordine confermato (senza cliente, dalla data di iscrizione) che nessuna mappa, dal mese di iscrizione, mostra ancora.
-- Né VP, né prodotti, né date. Stesse regole di partenze(): i nuovi che ho invitato, oppure uno solo che vedo o che ho
-- invitato (la scheda).
-- Solo aggiunte: una funzione nuova, nessuna tabella o dato toccato, nessun drop.
-- ============================================================

create or replace function public.ordini_in_attesa(p_partner uuid default null)
returns table (id uuid)
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
  if p_partner is not null and not public.vedo(p_partner) and not public.invitato_da_me(p_partner) then
    raise exception 'non_autorizzato';
  end if;
  return query
  select p.id
    from public.partners p
   where p.stato <> 'gestito'
     and (case when p_partner is null then p.invitato_da = io else p.id = p_partner end)
     and exists (select 1 from public.ordini_personali o
                  where o.proprietario = p.id and o.stato = 'confermato' and o.persona_id is null
                    and o.data >= coalesce(p.data_iscrizione, '2000-01-01'::date))
     and not exists (select 1 from public.numeri_mese n
                      where n.partner_id = p.id and n.vpp > 0
                        and n.mese >= date_trunc('month', coalesce(p.data_iscrizione, '2000-01-01'::date))::date);
end;
$$;
revoke execute on function public.ordini_in_attesa(uuid) from public, anon, authenticated;
grant execute on function public.ordini_in_attesa(uuid) to authenticated;
