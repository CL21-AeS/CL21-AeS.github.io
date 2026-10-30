-- ============================================================
-- Growup Team — 049: il perimetro dell'import (30 ottobre 2026).
-- Decisione di Stefano: la mappa di un partner contiene per natura solo lui e la sua downline. Come sola rete di
-- sicurezza il database ignora le righe che non appartengono alla downline di chi importa: una riga vale solo se il suo
-- sponsor è chi importa, una riga già accettata dello stesso file (l'app le manda dalla più vicina) o una persona già
-- nella sua downline. Così un file modificato non può toccare altre linee. Nessun'altra logica in più.
-- Si chiude anche la vecchia porta `importa_rete` (018): l'app non la usa più da ottobre e saltava tutte le regole nuove.
-- ============================================================

drop function if exists public.importa_rete(date, jsonb, jsonb, jsonb, text[], uuid[]);

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
  vecchie   int := 0;
  validi    text[];
  ignorate  int := 0;
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
  -- 048: si importa solo la propria mappa. Il codice della riga di livello 1 deve essere il codice Amway di chi importa,
  -- che arriva sempre dall'invito: chi non ce l'ha non importa (il file non lo salva più)
  cod := nullif(regexp_replace(coalesce(p_io->>'codice', ''), '[^0-9]', '', 'g'), '');
  if me.codice_amway is null then
    raise exception 'codice_mancante';
  elsif cod is distinct from me.codice_amway then
    raise exception 'import_di_altri';
  end if;
  -- 046: rifà la struttura solo la mappa con il mese più recente mai importato (per me); una mappa di un mese
  -- precedente salva solo i numeri (salva_mese_passato)
  -- il mese di competenza non può essere futuro né più vecchio di 24 mesi (bloccherebbe le mappe vere)
  if m > date_trunc('month', (now() at time zone 'Europe/Rome')::date)::date
     or m < (date_trunc('month', (now() at time zone 'Europe/Rome')::date) - interval '24 months')::date then
    raise exception 'import_non_valido';
  end if;
  if me.mappa_mese is not null and m < me.mappa_mese then
    raise exception 'mappa_vecchia';
  end if;
  update public.partners set mappa_mese = m where id = io;
  -- 047: le righe di altri Paesi non arrivano mai (l'app le scarta). p_esteri non si usa più: resta solo per le
  -- versioni dell'app già sui telefoni, e non nasconde né cancella niente.

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

  -- 049: il perimetro. La mappa di un partner contiene solo lui e la sua downline: come rete di sicurezza una riga vale
  -- solo se il suo sponsor è chi importa, una riga già accettata di questo file o una persona della sua downline;
  -- le altre (un file modificato) si ignorano e non toccano altre linee
  validi := array[me.codice_amway];
  for r in select * from jsonb_array_elements(p_persone) loop
    cod := nullif(regexp_replace(coalesce(r->>'codice', ''), '[^0-9]', '', 'g'), '');
    if cod is null or cod !~ '^[0-9]{4,12}$' or cod = me.codice_amway then
      raise exception 'import_non_valido';
    end if;
    if r->>'sponsor' is null or not (r->>'sponsor' = any(validi) or exists (
         select 1 from public.partners p where p.codice_amway = r->>'sponsor' and public.is_in_downline(p.id))) then
      ignorate := ignorate + 1;
      continue;
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
        ignorate := ignorate + 1;
        continue;   -- è in un altro gruppo dell'app: non si sposta da qui
      end if;
      if length(btrim(coalesce(r->>'nome', ''))) = 0 then
        raise exception 'import_non_valido';
      end if;
      insert into public.partners (nome, sponsor_id, stato, gestore_id, codice_amway, consenso_confermato_il, creato_da, posizione_al, mappa_mese,
                                   data_iscrizione)
      values (left(btrim(r->>'nome'), 80), sp, 'gestito', io, cod, now(), io, al, m, public.data_ingresso(r))
      returning * into x;
      aggiunte := aggiunte + 1;
      if cod = any(coalesce(p_nascondi, '{}'))
         or exists (select 1 from public.esclusi_import e where e.partner_id = io and e.codice = cod) then
        insert into public.nascosti (partner_id, nascosto_id) values (io, x.id) on conflict do nothing;
      end if;
    elsif x.mappa_mese is null or x.mappa_mese <= m then
      -- la posizione: solo con un report più recente, mai in un giro
      if x.sponsor_id is distinct from sp and sp <> x.id and not exists (
           with recursive giu(id) as (
             select x.id union all select p.id from public.partners p join giu on p.sponsor_id = giu.id)
           select 1 from giu where giu.id = sp) then
        update public.partners set sponsor_id = sp where id = x.id;
        spostate := spostate + 1;
      end if;
      -- chi era «non più nel report» e ricompare riprende il suo posto e i suoi dati; «Utente riservato» prende il nome
      -- vero quando il file lo mostra
      update public.partners set posizione_al = al, mappa_mese = m, fuori_report_dal = null,
             data_iscrizione = coalesce(public.data_ingresso(r), data_iscrizione),
             gestore_id = case when stato = 'gestito' then io else gestore_id end,
             nome = case when stato = 'gestito' and nome = 'Utente riservato' and length(btrim(coalesce(r->>'nome', ''))) > 0
                         then left(btrim(r->>'nome'), 80) else nome end
       where id = x.id;
    end if;
    validi := validi || cod;
    delete from public.esclusi_import where partner_id = io and codice = cod;
    if public.salva_numero(io, x.id, m, r, al) then numeri := numeri + 1; else vecchi := vecchi + 1; end if;
  end loop;

  -- non più nel report (solo se questo report è il più aggiornato per loro): nessuno si cancella
  for x in select * from public.partners where id = any(coalesce(p_fuori, '{}')) loop
    if not (x.stato = 'gestito' and public.vedo(x.id)) then
      raise exception 'non_autorizzato';
    end if;
    if x.fuori_report_dal is null and (x.mappa_mese is null or x.mappa_mese <= m) then
      update public.partners set fuori_report_dal = m, posizione_al = al, mappa_mese = m where id = x.id;
      insert into public.nascosti (partner_id, nascosto_id) values (io, x.id) on conflict do nothing;
      fuori := fuori + 1;
    end if;
  end loop;

  -- 046: un italiano fuori dalla mappa da 12 mesi (persona senza app della mia downline) si cancella con i suoi dati
  -- (chi stava sotto passa al suo sponsor). Come per i codici esteri, cancella solo l'import di un admin: per gli altri
  -- resta nascosto. Mai chi è nel file appena importato o chi ha messo al suo posto una mappa più recente.
  if me.is_admin then
    for x in select g.* from public.partners g
              where g.stato = 'gestito' and g.fuori_report_dal is not null and g.id <> io
                and g.fuori_report_dal <= (m - interval '12 months')::date and public.is_in_downline(g.id)
                and (g.mappa_mese is null or g.mappa_mese <= m)
                and not exists (select 1 from jsonb_array_elements(p_persone) j where j->>'codice' = g.codice_amway) loop
      update public.partners set sponsor_id = x.sponsor_id where sponsor_id = x.id;
      update public.partners set gestore_id = null where gestore_id = x.id;
      update public.partners set creato_da = null where creato_da = x.id;
      delete from public.partners where id = x.id;
      vecchie := vecchie + 1;
    end loop;
  end if;

  return jsonb_build_object('aggiunte', aggiunte, 'spostate', spostate, 'fuori', fuori, 'aggiornati', numeri, 'piu_vecchi', vecchi,
                            'cancellati', vecchie, 'ignorate', ignorate);
end;
$$;
