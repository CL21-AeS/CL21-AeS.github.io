-- ============================================================
-- Growup Team — 008: inserire una persona "in mezzo" alla linea
-- Esempio: nell'app risulta Anna → Giulia, ma lo sponsor vero di Giulia è Paolo, che manca.
-- Si crea Paolo (senza app, gestito da chi lo inserisce) sotto Anna e si spostano sotto di lui
-- Giulia ed eventualmente altri che stavano sotto Anna, con tutto il loro gruppo.
-- Lo può fare chi sta sopra quel punto della linea. Lo storico dei mesi chiusi non cambia.
-- ============================================================

create or replace function public.inserisci_in_mezzo(
  p_nome               text,
  p_sotto              uuid[],
  p_data_iscrizione    date default null,
  p_qualifica          text default null,
  p_percentuale        int  default null,
  p_qualifica_mese     date default null,
  p_pagamenti          int  default 0
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  io      uuid := public.my_partner_id();
  sponsor uuid;
  quanti  int;
  p       public.partners;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  if length(btrim(coalesce(p_nome, ''))) = 0 then
    raise exception 'nome_mancante';
  end if;
  if p_sotto is null or cardinality(p_sotto) = 0 then
    raise exception 'posizione_non_valida';
  end if;
  -- tutti devono avere lo stesso sponsor, e quello sponsor devo essere io o qualcuno del mio gruppo
  select count(distinct x.sponsor_id), min(x.sponsor_id::text)::uuid into quanti, sponsor
    from public.partners x where x.id = any(p_sotto);
  if quanti <> 1 or sponsor is null or (select count(*) from public.partners x where x.id = any(p_sotto)) <> cardinality(p_sotto)
     or io = any(p_sotto) or not public.is_in_downline(sponsor) then
    raise exception 'posizione_non_valida';
  end if;
  if p_data_iscrizione is not null and p_data_iscrizione > (now() at time zone 'Europe/Rome')::date then
    raise exception 'data_futura';
  end if;
  if p_qualifica is not null
     and not exists (select 1 from public.stage_requirements s where s.chiave = p_qualifica) then
    raise exception 'qualifica_non_valida';
  end if;
  if p_percentuale is not null and p_percentuale not in (3, 6, 9, 12, 15, 18, 21) then
    raise exception 'percentuale_non_valida';
  end if;

  insert into public.partners (nome, sponsor_id, stato, gestore_id, data_iscrizione,
                               qualifica_iniziale, percentuale_iniziale, qualifica_iniziale_mese,
                               pagamenti_iniziali, consenso_confermato_il, creato_da)
  values (btrim(p_nome), sponsor, 'gestito', io, p_data_iscrizione,
          p_qualifica, p_percentuale, date_trunc('month', p_qualifica_mese)::date,
          coalesce(p_pagamenti, 0), now(), io)
  returning * into p;

  update public.partners set sponsor_id = p.id where id = any(p_sotto);
  return to_jsonb(p) - 'chiave_hash';
end;
$$;

revoke execute on function public.inserisci_in_mezzo(text, uuid[], date, text, int, date, int) from public, anon, authenticated;
grant execute on function public.inserisci_in_mezzo(text, uuid[], date, text, int, date, int) to authenticated;
