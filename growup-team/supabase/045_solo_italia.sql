-- ============================================================
-- Growup Team — 045: dalla mappa Amway solo le righe con Paese = Italia (29 ottobre 2026).
-- Decisione di Stefano: le righe di altri Paesi si scartano del tutto (l'app le toglie dal file prima di mandare
-- qualcosa al database) e un codice italiano non sta mai sotto un codice estero (l'app ferma l'import).
-- Un codice estero già importato prima di questa regola si cancella al primo import con tutti i suoi dati:
-- l'app manda solo i codici delle righe estere (p_esteri), nient'altro. Si cancellano solo persone senza app
-- (stato 'gestito') nella downline di chi importa, e solo se importa un admin: i codici arrivano dal telefono e non
-- si possono verificare, quindi per gli altri partner restano solo nascosti e segnati «non più nel report».
-- La funzione cambia firma (un parametro in più, facoltativo): la vecchia si toglie.
-- ============================================================

drop function if exists public.importa_mappa(date, timestamptz, jsonb, jsonb, text[], uuid[]);

-- p_esteri: i codici delle righe di altri Paesi del file (solo i codici)
create or replace function public.importa_mappa(p_mese date, p_dati_al timestamptz, p_io jsonb, p_persone jsonb,
                                                p_nascondi text[], p_fuori uuid[], p_esteri text[] default '{}')
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  io        uuid := public.my_partner_id();
  me        public.partners;
  m         date := date_trunc('month', p_mese)::date;
  al        timestamptz := least(coalesce(p_dati_al, now()), now());
  cod       text;
  r         jsonb;
  x         public.partners;
  sp        uuid;
  aggiunte  int := 0;
  spostate  int := 0;
  fuori     int := 0;
  numeri    int := 0;
  vecchi    int := 0;
  esteri    int := 0;
  esteri_nascosti int := 0;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  select * into me from public.partners where id = io;
  -- chi non è ancora nella mappa non può cambiare la struttura degli altri
  if me.confermato_il is null and not me.is_admin then
    raise exception 'in_attesa';
  end if;
  if jsonb_typeof(p_persone) is distinct from 'array' or jsonb_array_length(p_persone) > 5000 then
    raise exception 'import_non_valido';
  end if;
  cod := nullif(regexp_replace(coalesce(p_io->>'codice', ''), '[^0-9]', '', 'g'), '');
  if me.codice_amway is null and cod is not null then
    begin
      update public.partners set codice_amway = cod where id = io;
    exception when unique_violation then
      raise exception 'codice_amway_usato';
    end;
    me.codice_amway := cod;
  elsif cod is distinct from me.codice_amway then
    raise exception 'import_di_altri';
  end if;
  -- 045: le righe di altri Paesi non arrivano; arrivano solo i loro codici, per cancellare chi era già stato importato
  if coalesce(array_length(p_esteri, 1), 0) > 5000
     or exists (select 1 from jsonb_array_elements(p_persone) j where j->>'codice' = any(coalesce(p_esteri, '{}')))
     or me.codice_amway = any(coalesce(p_esteri, '{}')) then
    raise exception 'import_non_valido';
  end if;
  -- un codice estero già nella mia struttura (persona senza app): se importa un admin si cancella con tutti i suoi
  -- dati (chi stava sotto, non dovrebbe succedere, passa al suo sponsor e la mappa lo rimette al suo posto qui sotto).
  -- Se importa un altro partner non si cancella niente: il codice arriva dal telefono e non si può verificare, quindi
  -- resta segnato «non più nel report» e nascosto finché non importa un admin.
  for x in select g.* from public.partners g
            where g.stato = 'gestito' and g.codice_amway = any(coalesce(p_esteri, '{}')) and g.id <> io
              and public.is_in_downline(g.id) loop
    if me.is_admin then
      update public.partners set sponsor_id = x.sponsor_id where sponsor_id = x.id;
      update public.partners set gestore_id = null where gestore_id = x.id;
      update public.partners set creato_da = null where creato_da = x.id;
      delete from public.partners where id = x.id;
      esteri := esteri + 1;
    else
      update public.partners set fuori_report_dal = coalesce(fuori_report_dal, m) where id = x.id;
      insert into public.nascosti (partner_id, nascosto_id) values (io, x.id) on conflict do nothing;
      esteri_nascosti := esteri_nascosti + 1;
    end if;
  end loop;

  -- 044b: la data di ingresso della mappa fa fede, anche per chi importa
  update public.partners set data_iscrizione = coalesce(public.data_ingresso(p_io), data_iscrizione) where id = io;
  if public.salva_numero(io, io, m, p_io, al) then numeri := numeri + 1; else vecchi := vecchi + 1; end if;

  -- copie di persone che ora usano l'app (stesso codice): spariscono, chi sta sotto passa a chi usa l'app
  for x in select g.* from public.partners g
            where g.stato = 'gestito' and g.codice_amway is not null and public.is_in_downline(g.id)
              and exists (select 1 from public.partners a where a.codice_amway = g.codice_amway and a.stato <> 'gestito'
                           and public.is_in_downline(a.id)) loop
    update public.partners set sponsor_id = (select a.id from public.partners a
                                               where a.codice_amway = x.codice_amway and a.stato <> 'gestito')
     where sponsor_id = x.id;
    delete from public.partners where id = x.id;
  end loop;

  for r in select * from jsonb_array_elements(p_persone) loop
    cod := nullif(regexp_replace(coalesce(r->>'codice', ''), '[^0-9]', '', 'g'), '');
    if cod is null or cod !~ '^[0-9]{4,12}$' or cod = me.codice_amway then
      raise exception 'import_non_valido';
    end if;
    -- il primo sopra di lui nel report che è nell'app (io o una persona del mio gruppo)
    sp := null;
    if r->>'sponsor' is not null and r->>'sponsor' <> me.codice_amway then
      select p.id into sp from public.partners p
       where p.codice_amway = r->>'sponsor' and public.is_in_downline(p.id) limit 1;
    end if;
    sp := coalesce(sp, io);
    -- la persona: chi usa l'app nel mio gruppo (anche in attesa) o una persona senza app del mio gruppo
    select * into x from public.partners p
     where p.codice_amway = cod and p.id <> io and public.is_in_downline(p.id)
     order by (p.stato <> 'gestito') desc limit 1;
    if not found then
      if exists (select 1 from public.partners p where p.codice_amway = cod) then
        continue;   -- è in un altro gruppo dell'app: non si sposta da qui
      end if;
      if length(btrim(coalesce(r->>'nome', ''))) = 0 then
        raise exception 'import_non_valido';
      end if;
      insert into public.partners (nome, sponsor_id, stato, gestore_id, codice_amway, consenso_confermato_il, creato_da, posizione_al,
                                   data_iscrizione)
      values (left(btrim(r->>'nome'), 80), sp, 'gestito', io, cod, now(), io, al, public.data_ingresso(r))
      returning * into x;
      aggiunte := aggiunte + 1;
      if cod = any(coalesce(p_nascondi, '{}'))
         or exists (select 1 from public.esclusi_import e where e.partner_id = io and e.codice = cod) then
        insert into public.nascosti (partner_id, nascosto_id) values (io, x.id) on conflict do nothing;
      end if;
    elsif x.posizione_al is null or x.posizione_al <= al then
      -- la posizione: solo con un report più recente, mai in un giro
      if x.sponsor_id is distinct from sp and sp <> x.id and not exists (
           with recursive giu(id) as (
             select x.id union all select p.id from public.partners p join giu on p.sponsor_id = giu.id)
           select 1 from giu where giu.id = sp) then
        update public.partners set sponsor_id = sp where id = x.id;
        spostate := spostate + 1;
      end if;
      update public.partners set posizione_al = al, fuori_report_dal = null,
             data_iscrizione = coalesce(public.data_ingresso(r), data_iscrizione),
             gestore_id = case when stato = 'gestito' then io else gestore_id end
       where id = x.id;
    end if;
    delete from public.esclusi_import where partner_id = io and codice = cod;
    if public.salva_numero(io, x.id, m, r, al) then numeri := numeri + 1; else vecchi := vecchi + 1; end if;
  end loop;

  -- non più nel report (solo se questo report è il più aggiornato per loro): nessuno si cancella
  for x in select * from public.partners where id = any(coalesce(p_fuori, '{}')) loop
    if not (x.stato = 'gestito' and public.vedo(x.id)) then
      raise exception 'non_autorizzato';
    end if;
    if x.fuori_report_dal is null and (x.posizione_al is null or x.posizione_al <= al) then
      update public.partners set fuori_report_dal = m, posizione_al = al where id = x.id;
      insert into public.nascosti (partner_id, nascosto_id) values (io, x.id) on conflict do nothing;
      fuori := fuori + 1;
    end if;
  end loop;

  return jsonb_build_object('aggiunte', aggiunte, 'spostate', spostate, 'fuori', fuori, 'aggiornati', numeri, 'piu_vecchi', vecchi,
                            'esteri', esteri, 'esteri_nascosti', esteri_nascosti);
end;
$$;

revoke execute on function public.importa_mappa(date, timestamptz, jsonb, jsonb, text[], uuid[], text[]) from public, anon, authenticated;
grant execute on function public.importa_mappa(date, timestamptz, jsonb, jsonb, text[], uuid[], text[]) to authenticated;
