-- ============================================================
-- Growup Team — 004: ritocchi dopo il primo collaudo (15 ottobre 2026)
-- Applicato al progetto con il connettore Supabase. Per un'installazione da zero
-- non serve: 001, 002 e 003 contengono già tutto.
--   - pin raggiunto (3%…21%) anche senza qualifica Bronze
--   - Path to Bronze: valgono tutte le prime linee, non solo quelle dal 1° giugno 2026
--   - aggiunta a mano di persone che non usano l'app, e loro link personale
--   - l'iscrizione si chiama ora iscrivi_con_codice (con il pin); la vecchia
--     join_with_code non è più richiamabile (si può eliminare dall'SQL editor con
--     drop function public.join_with_code(text, text, date, text, date, int);)
-- ============================================================

alter table public.partners
  add column if not exists percentuale_iniziale int check (percentuale_iniziale in (3, 6, 9, 12, 15, 18, 21)),
  add column if not exists consenso_confermato_il timestamptz;

update public.stage_requirements
   set linee_nuove_dal = null,
       descrizione = '3 prime linee da almeno 100 VP ciascuna, più 100 VP personali'
 where chiave = 'path_to_bronze';

create or replace function public.iscrivi_con_codice(
  p_codice             text,
  p_nome               text,
  p_data_iscrizione    date,
  p_qualifica          text default null,
  p_qualifica_mese     date default null,
  p_pagamenti          int  default 0,
  p_percentuale        int  default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid     uuid := auth.uid();
  sponsor uuid;
  chiave  text := public.nuova_chiave_segreta();
  p       public.partners;
begin
  if uid is null then
    raise exception 'non_autenticato';
  end if;
  if exists (select 1 from public.accessi where user_id = uid) then
    raise exception 'profilo_esistente';
  end if;

  select id into sponsor from public.partners where codice_invito = upper(btrim(p_codice));
  if sponsor is null then
    raise exception 'codice_non_valido';
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

  insert into public.partners (nome, sponsor_id, stato, chiave_hash, data_iscrizione,
                               qualifica_iniziale, percentuale_iniziale, qualifica_iniziale_mese, pagamenti_iniziali,
                               privacy_accettata_il, ultimo_aggiornamento)
  values (btrim(p_nome), sponsor, 'attivo', public.impronta(chiave), p_data_iscrizione,
          p_qualifica, p_percentuale, date_trunc('month', p_qualifica_mese)::date, coalesce(p_pagamenti, 0),
          now(), now())
  returning * into p;

  update public.partners set creato_da = p.id where id = p.id returning * into p;
  insert into public.accessi (user_id, partner_id) values (uid, p.id);

  return jsonb_build_object('profilo', to_jsonb(p) - 'chiave_hash', 'chiave', chiave);
end;
$$;

create or replace function public.aggiungi_partner(
  p_nome               text,
  p_sponsor            uuid,
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
  io uuid := public.my_partner_id();
  p  public.partners;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  if p_sponsor is null or not public.is_in_downline(p_sponsor) then
    raise exception 'posizione_non_valida';
  end if;
  if length(btrim(coalesce(p_nome, ''))) = 0 then
    raise exception 'nome_mancante';
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
  values (btrim(p_nome), p_sponsor, 'gestito', io, p_data_iscrizione,
          p_qualifica, p_percentuale, date_trunc('month', p_qualifica_mese)::date,
          coalesce(p_pagamenti, 0), now(), io)
  returning * into p;
  return to_jsonb(p) - 'chiave_hash';
end;
$$;

create or replace function public.link_per_gestito(p_partner uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  io     uuid := public.my_partner_id();
  t      public.partners;
  chiave text := public.nuova_chiave_segreta();
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  select * into t from public.partners where id = p_partner;
  if not found or t.stato <> 'gestito' then
    raise exception 'non_gestito';
  end if;
  if not (t.gestore_id = io or (t.id <> io and public.is_in_downline(t.id))) then
    raise exception 'non_autorizzato';
  end if;
  update public.partners set chiave_hash = public.impronta(chiave) where id = p_partner;
  return chiave;
end;
$$;

grant select (percentuale_iniziale, consenso_confermato_il) on public.partners to authenticated;
grant update (percentuale_iniziale) on public.partners to authenticated;

revoke execute on function public.join_with_code(text, text, date, text, date, int) from public, anon, authenticated;
revoke execute on function public.iscrivi_con_codice(text, text, date, text, date, int, int),
  public.aggiungi_partner(text, uuid, date, text, int, date, int), public.link_per_gestito(uuid)
  from public, anon, authenticated;
grant execute on function public.iscrivi_con_codice(text, text, date, text, date, int, int),
  public.aggiungi_partner(text, uuid, date, text, int, date, int), public.link_per_gestito(uuid)
  to authenticated;
