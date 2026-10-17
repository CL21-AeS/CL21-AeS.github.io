-- ============================================================
-- Growup Team — 015: codice Amway Partner e import dei VPP dal report Amway (CSV)
-- Si lancia dopo 014 (anche in un'installazione da zero).
--   - codice_amway: il numero IBO di ogni persona (solo cifre, uno per persona). Chi aggiunge
--     a mano una persona lo scrive (obbligatorio); chi entra dal link d'invito può scriverlo dopo.
--   - imposta_codice_amway: il proprio codice, o quello di una persona senza app che gestisco.
--   - aggiungi_con_codice / inserisci_in_mezzo_con_codice: come aggiungi_partner e
--     inserisci_in_mezzo, con il codice obbligatorio, tutto in un colpo (se il codice è già
--     usato non si crea niente).
--   - importa_vpp: ognuno importa il CSV della propria linea, scaricato dal sito Amway; il file
--     resta sul telefono, arrivano solo persona e VPP. Aggiorna i VPP del mese per me e per le
--     persone senza app che gestisco (posso_gestire): chi usa l'app non viene mai toccato.
--     Registra la differenza come "Aggiorna il totale" (attività rettifica), come a mano.
-- ============================================================

alter table public.partners
  add column if not exists codice_amway text check (codice_amway ~ '^[0-9]{4,12}$');
create unique index if not exists partners_codice_amway_idx on public.partners (codice_amway);

grant select (codice_amway) on public.partners to authenticated;

create or replace function public.imposta_codice_amway(p_partner uuid, p_codice text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  io     uuid := public.my_partner_id();
  codice text := nullif(regexp_replace(coalesce(p_codice, ''), '[^0-9]', '', 'g'), '');
  p      public.partners;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  if p_partner is distinct from io and not public.posso_gestire(p_partner) then
    raise exception 'non_autorizzato';
  end if;
  if codice is not null and codice !~ '^[0-9]{4,12}$' then
    raise exception 'codice_amway_non_valido';
  end if;
  begin
    update public.partners set codice_amway = codice where id = p_partner returning * into p;
  exception when unique_violation then
    raise exception 'codice_amway_usato';
  end;
  return to_jsonb(p) - 'chiave_hash';
end;
$$;

create or replace function public.aggiungi_con_codice(
  p_nome               text,
  p_sponsor            uuid,
  p_codice_amway       text,
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
  p jsonb;
begin
  if nullif(regexp_replace(coalesce(p_codice_amway, ''), '[^0-9]', '', 'g'), '') is null then
    raise exception 'codice_amway_mancante';
  end if;
  p := public.aggiungi_partner(p_nome, p_sponsor, p_data_iscrizione, p_qualifica, p_percentuale,
                               p_qualifica_mese, p_pagamenti);
  return public.imposta_codice_amway((p->>'id')::uuid, p_codice_amway);
end;
$$;

create or replace function public.inserisci_in_mezzo_con_codice(
  p_nome               text,
  p_sotto              uuid[],
  p_codice_amway       text,
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
  p jsonb;
begin
  if nullif(regexp_replace(coalesce(p_codice_amway, ''), '[^0-9]', '', 'g'), '') is null then
    raise exception 'codice_amway_mancante';
  end if;
  p := public.inserisci_in_mezzo(p_nome, p_sotto, p_data_iscrizione, p_qualifica, p_percentuale,
                                 p_qualifica_mese, p_pagamenti);
  return public.imposta_codice_amway((p->>'id')::uuid, p_codice_amway);
end;
$$;

-- p_righe: [{ "partner_id": "…", "vpp": 123.45 }, …]. Il mese è quello scritto nel file:
-- il mese in corso, o il precedente fino al giorno di chiusura (dopo è congelato).
-- Reimportare lo stesso mese sostituisce il valore: si registra solo la differenza.
create or replace function public.importa_vpp(p_mese date, p_righe jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  io        uuid := public.my_partner_id();
  mese      date := date_trunc('month', p_mese)::date;
  oggi      date := (now() at time zone 'Europe/Rome')::date;
  giorno    date;
  r         jsonb;
  pid       uuid;
  vpp       numeric;
  attuale   numeric;
  diff      numeric;
  aggiornati int := 0;
  invariati  int := 0;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  if p_mese is null or jsonb_typeof(p_righe) is distinct from 'array' or jsonb_array_length(p_righe) > 5000 then
    raise exception 'import_non_valido';
  end if;
  giorno := case when mese = date_trunc('month', oggi)::date then oggi
                 else (mese + interval '1 month' - interval '1 day')::date end;
  if not public.mese_aperto(giorno) then
    raise exception 'mese_chiuso';
  end if;

  for r in select * from jsonb_array_elements(p_righe) loop
    pid := (r->>'partner_id')::uuid;
    vpp := round((r->>'vpp')::numeric, 2);
    if vpp is null or vpp < 0 or vpp > 100000 then
      raise exception 'import_non_valido';
    end if;
    if pid is distinct from io and not public.posso_gestire(pid) then
      raise exception 'non_autorizzato';
    end if;
    select coalesce(sum(a.vp), 0) into attuale from public.activities a
     where a.partner_id = pid and a.tipo in ('ordine', 'rettifica')
       and a.data >= mese and a.data < (mese + interval '1 month')::date;
    diff := vpp - attuale;
    if diff = 0 then
      invariati := invariati + 1;
    else
      insert into public.activities (partner_id, tipo, vp, data) values (pid, 'rettifica', diff, giorno);
      aggiornati := aggiornati + 1;
    end if;
  end loop;
  return jsonb_build_object('aggiornati', aggiornati, 'invariati', invariati);
end;
$$;

revoke execute on function public.imposta_codice_amway(uuid, text),
  public.aggiungi_con_codice(text, uuid, text, date, text, int, date, int),
  public.inserisci_in_mezzo_con_codice(text, uuid[], text, date, text, int, date, int),
  public.importa_vpp(date, jsonb) from public, anon, authenticated;
grant execute on function public.imposta_codice_amway(uuid, text),
  public.aggiungi_con_codice(text, uuid, text, date, text, int, date, int),
  public.inserisci_in_mezzo_con_codice(text, uuid[], text, date, text, int, date, int),
  public.importa_vpp(date, jsonb) to authenticated;
