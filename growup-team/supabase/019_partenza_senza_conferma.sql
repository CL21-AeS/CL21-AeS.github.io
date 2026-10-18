-- Growup Team — 019: il punto di partenza non lo conferma più nessuno (18 ottobre 2026).
-- Decisione di Stefano: ognuno è responsabile di dichiarare il giusto; i numeri veri arrivano dal report Amway.
-- Lo sponsor e l'upline non confermano né correggono più; ognuno può correggere solo il proprio.
-- Le colonne partenza_confermata_il / partenza_confermata_da restano (ferme): niente cancellazioni.

revoke execute on function public.conferma_partenza(uuid, text, int, date, int) from public, anon, authenticated;

create or replace function public.modifica_partenza(
  p_qualifica        text default null,
  p_percentuale      int  default null,
  p_qualifica_mese   date default null,
  p_pagamenti        int  default 0
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  io uuid := public.my_partner_id();
  p  public.partners;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  if p_qualifica is not null
     and not exists (select 1 from public.stage_requirements s where s.chiave = p_qualifica) then
    raise exception 'qualifica_non_valida';
  end if;
  if p_percentuale is not null and p_percentuale not in (3, 6, 9, 12, 15, 18, 21) then
    raise exception 'percentuale_non_valida';
  end if;
  update public.partners
     set qualifica_iniziale = p_qualifica,
         percentuale_iniziale = p_percentuale,
         qualifica_iniziale_mese = date_trunc('month', p_qualifica_mese)::date,
         pagamenti_iniziali = least(greatest(coalesce(p_pagamenti, 0), 0), 12)
   where id = io
  returning * into p;
  return to_jsonb(p) - 'chiave_hash';
end;
$$;

revoke execute on function public.modifica_partenza(text, int, date, int) from public, anon, authenticated;
grant execute on function public.modifica_partenza(text, int, date, int) to authenticated;
