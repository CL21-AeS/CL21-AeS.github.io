-- ============================================================
-- Growup Team — 047: i codici esteri si scartano e basta (30 ottobre 2026).
-- Decisione di Stefano: le righe con Paese diverso da Italia non si salvano mai, con qualsiasi import (admin o partner).
-- Via la regola della 045 per cui il database riceveva i codici esteri per cancellarli (admin) o nasconderli (partner):
-- l'app non li manda più e il database ignora `p_esteri`. Un codice che non compare più nella mappa segue la regola di
-- tutti quelli che escono dalla mappa.
-- ============================================================

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
                            'cancellati', vecchie);
end;
$$;
