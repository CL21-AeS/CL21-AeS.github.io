-- ============================================================
-- Growup Team — 018: nessuno cancella, import sempre completo, ognuno nasconde chi vuole
-- Si lancia dopo 017 (anche in un'installazione da zero). Va incollata nell'SQL Editor.
--   - Nessuno cancella persone dall'app (neanche gli admin): "Cancella dalla struttura" è chiusa.
--   - L'import è sempre completo: tutte le persone del report entrano nella struttura di chi importa.
--     Chi importa può nascondere le nuove persone (per esempio chi ha 0 VP) già nell'anteprima.
--   - Chi non è più nel report resta, segnato "non più nel report" e nascosto (si può rivedere).
--   - Le persone nascoste contano sempre nei VP personali e di gruppo.
--   - Gli esclusi della versione precedente diventano persone nascoste al primo import.
-- ============================================================

alter table public.partners add column if not exists fuori_report_dal date;
grant select (fuori_report_dal) on public.partners to authenticated;

-- nessuno cancella
revoke execute on function public.cancella_partner(uuid) from public, anon, authenticated;

-- l'import con le regole nuove (cambiano i nomi degli ultimi due parametri)
drop function if exists public.importa_rete(date, jsonb, jsonb, jsonb, text[], uuid[]);
create or replace function public.importa_rete(p_mese date, p_io jsonb, p_persone jsonb, p_attivi jsonb,
                                               p_nascondi text[], p_fuori uuid[])
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  io        uuid := public.my_partner_id();
  mio       text;
  r         jsonb;
  cod       text;
  sp        uuid;
  x         public.partners;
  righe     jsonb := '[]'::jsonb;
  aggiunte  int := 0;
  spostate  int := 0;
  fuori     int := 0;
  esito     jsonb;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  if jsonb_typeof(p_persone) is distinct from 'array' or jsonb_typeof(p_attivi) is distinct from 'array'
     or jsonb_array_length(p_persone) > 5000 then
    raise exception 'import_non_valido';
  end if;

  -- il mio codice
  select codice_amway into mio from public.partners where id = io;
  cod := nullif(regexp_replace(coalesce(p_io->>'codice', ''), '[^0-9]', '', 'g'), '');
  if mio is null and cod is not null then
    begin
      update public.partners set codice_amway = cod where id = io;
    exception when unique_violation then
      raise exception 'codice_amway_usato';
    end;
    mio := cod;
  elsif cod is distinct from mio then
    raise exception 'import_di_altri';
  end if;
  righe := righe || jsonb_build_object('partner_id', io, 'vpp', p_io->'vpp');
  perform public.salva_numeri_report(io, io, p_mese, p_io);

  -- le mie copie di persone che ora usano l'app: spariscono, le mie persone sotto di loro passano a chi usa l'app
  for x in select g.* from public.partners g
            where g.stato = 'gestito' and g.gestore_id = io and g.codice_amway is not null
              and exists (select 1 from public.partners a where a.codice_amway = g.codice_amway
                           and a.stato <> 'gestito' and public.vedo(a.id)) loop
    update public.partners set sponsor_id = (select a.id from public.partners a
                                               where a.codice_amway = x.codice_amway and a.stato <> 'gestito')
     where sponsor_id = x.id;
    delete from public.partners where id = x.id;
  end loop;

  -- le mie persone importate: si creano o si spostano nella posizione del report
  for r in select * from jsonb_array_elements(p_persone) loop
    cod := nullif(regexp_replace(coalesce(r->>'codice', ''), '[^0-9]', '', 'g'), '');
    if cod is null or cod !~ '^[0-9]{4,12}$' or cod = mio then
      raise exception 'import_non_valido';
    end if;
    sp := null;
    if r->>'sponsor' is not null and r->>'sponsor' <> mio then
      select a.id into sp from public.partners a
       where a.codice_amway = r->>'sponsor' and a.stato <> 'gestito' and public.vedo(a.id);
      if sp is null then
        select g.id into sp from public.partners g
         where g.codice_amway = r->>'sponsor' and g.stato = 'gestito' and g.gestore_id = io;
      end if;
    end if;
    sp := coalesce(sp, io);
    select * into x from public.partners g where g.codice_amway = cod and g.stato = 'gestito' and g.gestore_id = io;
    if found then
      if x.sponsor_id is distinct from sp and sp <> x.id and not exists (
           with recursive giu(id) as (
             select x.id union all select p.id from public.partners p join giu on p.sponsor_id = giu.id)
           select 1 from giu where giu.id = sp) then
        update public.partners set sponsor_id = sp where id = x.id;
        spostate := spostate + 1;
      end if;
    else
      if exists (select 1 from public.partners a where a.codice_amway = cod and a.stato <> 'gestito' and public.vedo(a.id)) then
        continue;   -- usa già l'app: non si importa
      end if;
      if length(btrim(coalesce(r->>'nome', ''))) = 0 then
        raise exception 'import_non_valido';
      end if;
      insert into public.partners (nome, sponsor_id, stato, gestore_id, codice_amway, consenso_confermato_il, creato_da)
      values (left(btrim(r->>'nome'), 80), sp, 'gestito', io, cod, now(), io)
      returning * into x;
      aggiunte := aggiunte + 1;
      -- nuova persona: nascosta se chi importa l'ha scelto (o l'aveva esclusa con la versione precedente)
      if cod = any(coalesce(p_nascondi, '{}'))
         or exists (select 1 from public.esclusi_import e where e.partner_id = io and e.codice = cod) then
        insert into public.nascosti (partner_id, nascosto_id) values (io, x.id) on conflict do nothing;
      end if;
    end if;
    delete from public.esclusi_import where partner_id = io and codice = cod;
    -- è (di nuovo) nel report
    update public.partners set fuori_report_dal = null where id = x.id and fuori_report_dal is not null;
    if r ? 'vpp' then
      righe := righe || jsonb_build_object('partner_id', x.id, 'vpp', r->'vpp');
    end if;
    perform public.salva_numeri_report(io, x.id, p_mese, r);
  end loop;

  -- chi usa l'app: sotto il suo sponsor secondo il report (solo nel mio gruppo, mai in un giro)
  for r in select * from jsonb_array_elements(p_attivi) loop
    select * into x from public.partners a
     where a.codice_amway = r->>'codice' and a.stato <> 'gestito' and a.id <> io and public.vedo(a.id);
    if not found then
      continue;
    end if;
    perform public.salva_numeri_report(io, x.id, p_mese, r);
    sp := null;
    if r->>'sponsor' is null or r->>'sponsor' = mio then
      sp := io;
    else
      select a.id into sp from public.partners a
       where a.codice_amway = r->>'sponsor' and a.stato <> 'gestito' and public.vedo(a.id);
    end if;
    if sp is null or sp = x.sponsor_id or sp = x.id then
      continue;
    end if;
    if exists (with recursive giu(id) as (
                 select x.id union all select p.id from public.partners p join giu on p.sponsor_id = giu.id)
               select 1 from giu where giu.id = sp) then
      continue;
    end if;
    update public.partners set sponsor_id = sp where id = x.id;
    spostate := spostate + 1;
  end loop;

  -- non più nel report: nessuno si cancella; restano segnate e nascoste (si possono rivedere)
  for x in select * from public.partners where id = any(coalesce(p_fuori, '{}')) loop
    if not public.posso_gestire(x.id) then
      raise exception 'non_autorizzato';
    end if;
    if x.fuori_report_dal is null then
      update public.partners set fuori_report_dal = date_trunc('month', p_mese)::date where id = x.id;
      insert into public.nascosti (partner_id, nascosto_id) values (io, x.id) on conflict do nothing;
      fuori := fuori + 1;
    end if;
  end loop;

  esito := public.importa_vpp(p_mese, righe);
  return esito || jsonb_build_object('aggiunte', aggiunte, 'spostate', spostate, 'fuori', fuori);
end;
$$;

-- la struttura con il segno "non più nel report" (cambia il risultato: si ricrea, e con lei il riepilogo che la usa)
drop function if exists public.riepilogo_mese(date);
drop function if exists public.struttura_visibile();
create or replace function public.struttura_visibile()
returns table (id uuid, nome text, sponsor_id uuid, stato text, gestore_id uuid, creato_il timestamptz,
               ultimo_aggiornamento timestamptz, codice_amway text, codice_invito text,
               qualifica_iniziale text, percentuale_iniziale int, qualifica_iniziale_mese date,
               pagamenti_iniziali int, partenza_confermata_il timestamptz, fuori_report_dal date)
language sql
stable
security definer
set search_path = public
as $$
  with recursive albero(id, visibile, sponsor_visibile) as (
    select p.id, true, null::uuid from public.partners p where p.id = public.my_partner_id()
    union all
    select p.id, (p.stato <> 'gestito' or p.gestore_id = public.my_partner_id()),
           case when a.visibile then a.id else a.sponsor_visibile end
    from public.partners p join albero a on p.sponsor_id = a.id
  )
  select p.id, p.nome, a.sponsor_visibile, p.stato, p.gestore_id, p.creato_il, p.ultimo_aggiornamento,
         p.codice_amway, p.codice_invito, p.qualifica_iniziale, p.percentuale_iniziale, p.qualifica_iniziale_mese,
         p.pagamenti_iniziali, p.partenza_confermata_il, p.fuori_report_dal
  from albero a join public.partners p on p.id = a.id
  where a.visibile
  order by p.creato_il
$$;

create or replace function public.riepilogo_mese(p_mese date)
returns table (partner_id uuid, sponsor_id uuid, vp_personali numeric, vp_gruppo numeric,
               linee_attive int, percentuale int, qualifica text, chiuso boolean,
               da_report boolean, linee_report jsonb, linee_nascoste boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  io uuid := public.my_partner_id();
  m  date := date_trunc('month', p_mese)::date;
  soglia numeric := coalesce((select (valore #>> '{}')::numeric from public.settings where chiave = 'soglia_linea_attiva'), 100);
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  if exists (select 1 from public.monthly_totals t where t.visto_da = io and t.partner_id = io and t.mese = m) then
    return query
      select t.partner_id, s.sponsor_id, t.vp_personali, t.vp_gruppo, t.linee_attive,
             t.percentuale, t.qualifica, true, n.partner_id is not null, n.linee, coalesce(n.linee_nascoste, false)
      from public.monthly_totals t
      join public.struttura_visibile() s on s.id = t.partner_id
      left join public.numeri_report n on n.visto_da = io and n.partner_id = t.partner_id and n.mese = m
      where t.visto_da = io and t.mese = m;
  else
    return query
      select c.partner_id, c.sponsor_id, c.vp_personali,
             coalesce(n.vpg, c.vp_gruppo),
             case when n.partner_id is null then c.linee_attive
                  else (select count(*)::int from jsonb_array_elements(n.linee) l where (l->>'vpg')::numeric >= soglia) end,
             coalesce(n.percentuale, c.percentuale),
             case when n.partner_id is null then c.qualifica else public.qualifica_report(c.vp_personali, n.vpg, n.linee) end,
             false, n.partner_id is not null, n.linee, coalesce(n.linee_nascoste, false)
      from public.calcola_mese(m, io, io) c
      left join public.numeri_report n on n.visto_da = io and n.partner_id = c.partner_id and n.mese = m;
  end if;
end;
$$;

revoke execute on function public.importa_rete(date, jsonb, jsonb, jsonb, text[], uuid[]), public.struttura_visibile(),
  public.riepilogo_mese(date)
  from public, anon, authenticated;
grant execute on function public.importa_rete(date, jsonb, jsonb, jsonb, text[], uuid[]), public.struttura_visibile(),
  public.riepilogo_mese(date)
  to authenticated;
