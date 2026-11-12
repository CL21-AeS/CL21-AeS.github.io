-- ============================================================
-- Growup Team — 065: l'avviso allo sponsor quando il nuovo chiude una fase del percorso (13 novembre 2026)
-- Scelte di Stefano:
-- * Una notifica quando il nuovo chiude la fase 2 (incontro fissato e 30 nomi nella Lista), la fase 3 (primo ordine nella
--   mappa) e la fase 4 (primo piano e primo cliente). Ogni fase da sola, in qualunque ordine; una volta sola per fase.
-- * La ricevono chi l'ha invitato e, se lo sponsor reale è un altro e usa l'app, anche lui: la regola degli avvisi di oggi
--   (public.avvisa, notifiche_eventi, partners_avvisi della 041). Senza nomi.
-- * Parte dal server, anche se il nuovo non apre l'app (il primo ordine arriva con l'import di un upline).
-- * Nei trigger, se la persona non è un nuovo nel percorso non ancora finito, si esce subito. Per la mappa il controllo
--   parte una volta sola per import, alla fine di importa_mappa e di salva_mese_passato (non una volta per riga).
-- * Toccando la notifica si apre la scheda della persona: l'indirizzo è «./?partner=<id interno>» (mai nome o codice
--   Amway). Vale anche per gli avvisi che c'erano già («è entrata in Growup», «è ora al suo posto nella mappa»).
-- Solo aggiunte: funzioni, trigger e un indice nuovi; importa_mappa e salva_mese_passato sono quelle di prima (052 e 033)
-- con una riga in più alla fine. Nessuna tabella nuova, nessun dato cancellato o cambiato, nessun drop.
-- ============================================================

-- ---- Chi è un nuovo nel percorso di partenza (come percorsoAttivo() nell'app) ----
-- usa l'app, non ha finito la partenza, ed è entrato entro 30 giorni dalla data di iscrizione
create or replace function public.in_percorso(p public.partners)
returns boolean
language sql
stable
set search_path = public
as $$
  select p.stato <> 'gestito' and p.partenza_completata_il is null and p.data_iscrizione is not null
     and coalesce(p.privacy_accettata_il, p.creato_il)::date - p.data_iscrizione <= 30
$$;

-- ---- L'indirizzo della notifica: la scheda della persona di cui si parla ----
-- Gli avvisi su una persona hanno la chiave «<tipo>-<id>»: l'indirizzo diventa «./?partner=<id>» (solo l'id interno).
create or replace function public.notifiche_eventi_link()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.url = './' and new.chiave ~ '^(entrato|al-posto|fase[234])-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    new.url := './?partner=' || substring(new.chiave from '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
  end if;
  return new;
end;
$$;
drop trigger if exists notifiche_eventi_link on public.notifiche_eventi;
create trigger notifiche_eventi_link before insert on public.notifiche_eventi
  for each row execute function public.notifiche_eventi_link();
-- «la fase è già stata annunciata?» si cerca per chiave
create index if not exists notifiche_eventi_chiave_idx on public.notifiche_eventi (chiave);

-- ---- Gli avvisi delle fasi di un nuovo ----
create or replace function public.avvisa_fasi_partenza(p_partner uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  p     public.partners;
  chi   uuid;
  sopra uuid;
  f     text;
  cosa  text;
begin
  select * into p from public.partners where id = p_partner;
  if not found or not public.in_percorso(p) then
    return;   -- non è un nuovo nel percorso: niente da fare
  end if;
  -- chi ha invitato: dall'invito usato (041) o, per chi è entrato prima, da invitato_da (035); lo sponsor reale se è un
  -- altro e usa l'app (come partners_avvisi)
  chi := coalesce((select i.creato_da from public.inviti i where i.usato_da = p.id order by i.usato_il desc limit 1), p.invitato_da);
  sopra := case when p.sponsor_id is distinct from chi
                 and exists (select 1 from public.partners s where s.id = p.sponsor_id and s.stato <> 'gestito')
                then p.sponsor_id end;
  foreach f in array array['2', '3', '4'] loop
    -- una volta sola per fase: se è già stata annunciata (a chiunque) non si ripete, nemmeno a un nuovo sponsor
    continue when exists (select 1 from public.notifiche_eventi e where e.chiave = 'fase' || f || '-' || p.id);
    if f = '2' then
      continue when p.incontro_sponsor is null
        or (select count(*) from public.persone x where x.proprietario = p.id and x.esito is distinct from 'cliente') < 30;
      cosa := 'ha fissato il primo incontro con il suo sponsor e scritto 30 nomi nella Lista.';
    elsif f = '3' then
      continue when not exists (select 1 from public.numeri_mese n
                                 where n.partner_id = p.id and n.vpp > 0
                                   and n.mese >= date_trunc('month', p.data_iscrizione)::date);
      cosa := 'ha fatto il primo ordine: è il momento di un complimento.';
    else
      continue when not exists (select 1 from public.activities a where a.partner_id = p.id and a.tipo = 'piano')
                 or not exists (select 1 from public.activities a where a.partner_id = p.id and a.tipo = 'cliente');
      cosa := 'ha mostrato il primo piano e ha il primo cliente: è il momento di un complimento.';
    end if;
    perform public.avvisa(chi, 'fase' || f || '-' || p.id, 'Una persona che hai invitato ' || cosa);
    if sopra is not null then
      perform public.avvisa(sopra, 'fase' || f || '-' || p.id, 'Un nuovo partner del tuo gruppo, sotto di te, ' || cosa);
    end if;
  end loop;
end;
$$;

-- ---- Fase 2: l'incontro fissato (una riga dei partner) ----
create or replace function public.fasi_da_partners()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.avvisa_fasi_partenza(new.id);
  return null;
end;
$$;
drop trigger if exists partners_fasi on public.partners;
create trigger partners_fasi after update of incontro_sponsor on public.partners
  for each row when (new.incontro_sponsor is not null and old.incontro_sponsor is distinct from new.incontro_sponsor
                     and new.partenza_completata_il is null and new.stato <> 'gestito')
  execute function public.fasi_da_partners();

-- ---- Fase 2: i nomi nella Lista (una volta per istruzione, anche con più nomi insieme) ----
create or replace function public.fasi_da_persone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  x uuid;
begin
  for x in select distinct n.proprietario from nuove n join public.partners p on p.id = n.proprietario
            where n.esito is distinct from 'cliente' and public.in_percorso(p) loop
    perform public.avvisa_fasi_partenza(x);
  end loop;
  return null;
end;
$$;
drop trigger if exists persone_fasi on public.persone;
create trigger persone_fasi after insert on public.persone
  referencing new table as nuove for each statement execute function public.fasi_da_persone();

-- ---- Fase 4: il primo piano e il primo cliente (una volta per istruzione) ----
create or replace function public.fasi_da_activities()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  x uuid;
begin
  for x in select distinct n.partner_id from nuove n join public.partners p on p.id = n.partner_id
            where n.tipo in ('piano', 'cliente') and public.in_percorso(p) loop
    perform public.avvisa_fasi_partenza(x);
  end loop;
  return null;
end;
$$;
drop trigger if exists activities_fasi on public.activities;
create trigger activities_fasi after insert on public.activities
  referencing new table as nuove for each statement execute function public.fasi_da_activities();

-- ---- Fase 3: il primo ordine nella mappa, una volta per import ----
-- solo i nuovi nel percorso con una mappa (dal mese di iscrizione) che mostra dei VP e la fase 3 non ancora annunciata
create or replace function public.avvisa_primi_ordini()
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  x uuid;
begin
  for x in select p.id from public.partners p
            where p.partenza_completata_il is null and p.data_iscrizione is not null and p.stato <> 'gestito'
              and public.in_percorso(p)
              and exists (select 1 from public.numeri_mese n where n.partner_id = p.id and n.vpp > 0
                            and n.mese >= date_trunc('month', p.data_iscrizione)::date)
              and not exists (select 1 from public.notifiche_eventi e where e.chiave = 'fase3-' || p.id) loop
    perform public.avvisa_fasi_partenza(x);
  end loop;
exception when others then
  null;   -- un avviso che non parte non deve mai fermare l'import della mappa
end;
$$;

-- importa_mappa (052) e salva_mese_passato (033): le stesse, con la chiamata alla fine
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
  bloccati  int := 0;
  validi    text[];
  ignorate  int := 0;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  select * into me from public.partners where id = io;
  -- chi non è ancora nella mappa non può cambiare la struttura degli altri
  -- 052: chi è entrato sotto un Platino che non usa l'app importa la sua mappa anche se è ancora in attesa
  -- (nessuna mappa della upline lo mostrerà mai)
  -- (vale solo finché il Platino è ancora senza app e io sono nel suo gruppo)
  if me.area_platino is not null and not (public.platino_nascosto(me.area_platino) and public.sotto_di(me.area_platino, io)) then
    me.area_platino := null;
  end if;
  if me.confermato_il is null and not me.is_admin and me.area_platino is null then
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
  -- 052: nel gruppo di un Platino nascosto, la mia mappa mi mette sotto il mio sponsor vero (prima riga, colonna
  -- «Codice Amway Partner Sponsor»), se è già nell'app nel gruppo del Platino; altrimenti resto sotto il Platino
  if me.area_platino is not null and p_io->>'sponsor' is not null then
    select p.id into sp from public.partners p
     where p.codice_amway = p_io->>'sponsor' and p.id <> io
       and (p.id = me.area_platino or public.sotto_di(me.area_platino, p.id))
       and not public.sotto_di(io, p.id)
     limit 1;
    if sp is not null and sp is distinct from me.sponsor_id then
      update public.partners set sponsor_id = sp where id = io;
    end if;
  end if;
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
                                   data_iscrizione, posizione_importata_il)
      values (left(btrim(r->>'nome'), 80), sp, 'gestito', io, cod, now(), io, al, m, public.data_ingresso(r), now())
      returning * into x;
      aggiunte := aggiunte + 1;
      if cod = any(coalesce(p_nascondi, '{}'))
         or exists (select 1 from public.esclusi_import e where e.partner_id = io and e.codice = cod) then
        insert into public.nascosti (partner_id, nascosto_id) values (io, x.id) on conflict do nothing;
      end if;
    elsif x.mappa_mese is null or x.mappa_mese < m
          or (x.mappa_mese = m and (me.is_admin or x.posizione_al is null or x.posizione_al <= al)) then
      -- 051: nello stesso mese la mappa dell'admin fa sempre fede; quella di un partner aggiorna solo se è stata scaricata
      -- dopo quella in vigore per questa persona (posizione_al = data e ora di scaricamento della mappa in vigore)
      -- la posizione: solo con un report più recente, mai in un giro
      if x.sponsor_id is distinct from sp and sp <> x.id and not exists (
           with recursive giu(id) as (
             select x.id union all select p.id from public.partners p join giu on p.sponsor_id = giu.id)
           select 1 from giu where giu.id = sp) then
        update public.partners set sponsor_id = sp where id = x.id;
        spostate := spostate + 1;
      end if;
      -- chi era «non più nel report» e ricompare riprende il suo posto e i suoi dati; «Utente riservato» prende il nome
      -- vero quando il file lo mostra. 050: se usava l'app e gli si era bloccata perché fuori dalla mappa, si sblocca
      -- (un blocco messo a mano da un admin resta)
      update public.partners set posizione_al = al, posizione_importata_il = now(), mappa_mese = m, fuori_report_dal = null, fuori_mappa_il = null,
             -- 051: al rientro si toglie solo il blocco della mappa, mai uno messo da un admin (bloccato_da)
             bloccato_il = case when blocco_mappa and bloccato_da is null then null else bloccato_il end, blocco_mappa = false,
             fuori_mappa_da = null,
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
  -- 050: chi non è più nella mappa esce dalla struttura e non lo vede più nessuno (struttura_visibile e vedo lo
  -- escludono); se usa l'app, l'app gli si blocca. I dati restano: se ricompare in una mappa riprende posto e dati.
  -- Dopo 12 mesi fuori (contati da `fuori_mappa_il`, l'ora del server) li cancella il controllo di ogni notte.
  -- Vale con qualsiasi import (admin o partner), solo per chi è nella mia downline e non è nel file.
  for x in select * from public.partners where id = any(coalesce(p_fuori, '{}')) loop
    if x.id = io or not public.is_in_downline(x.id) or not public.vedo(x.id) then
      raise exception 'non_autorizzato';
    end if;
    -- un admin non si blocca mai; chi è nel file non è uscito
    if x.is_admin or exists (select 1 from jsonb_array_elements(p_persone) j where j->>'codice' = x.codice_amway) then
      continue;
    end if;
    if x.fuori_report_dal is null and (x.mappa_mese is null or x.mappa_mese < m
         or (x.mappa_mese = m and (me.is_admin or x.posizione_al is null or x.posizione_al <= al))) then
      update public.partners set fuori_report_dal = m, fuori_mappa_il = now(), fuori_mappa_da = io,
             posizione_al = al, posizione_importata_il = now(), mappa_mese = m,
             blocco_mappa = case when stato <> 'gestito' and bloccato_il is null then true else blocco_mappa end,
             bloccato_il = case when stato <> 'gestito' then coalesce(bloccato_il, now()) else bloccato_il end
       where id = x.id;
      fuori := fuori + 1;
      if x.stato <> 'gestito' then bloccati := bloccati + 1; end if;
    end if;
  end loop;

  -- 065: una volta sola per import, alla fine: i nuovi nel percorso che ora la mappa mostra con il primo ordine
  perform public.avvisa_primi_ordini();

  return jsonb_build_object('aggiunte', aggiunte, 'spostate', spostate, 'fuori', fuori, 'aggiornati', numeri, 'piu_vecchi', vecchi,
                            'bloccati', bloccati, 'ignorate', ignorate);
end;
$$;

create or replace function public.salva_mese_passato(p_mese date, p_dati_al timestamptz, p_io jsonb, p_altri jsonb)
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  io   uuid := public.my_partner_id();
  me   public.partners;
  m    date := date_trunc('month', p_mese)::date;
  al   timestamptz := least(coalesce(p_dati_al, now()), now());
  r    jsonb;
  chi  uuid;
  n    int := 0;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  select * into me from public.partners where id = io;
  if me.confermato_il is null and not me.is_admin then
    raise exception 'in_attesa';
  end if;
  if m >= date_trunc('month', (now() at time zone 'Europe/Rome')::date)::date
     or m < (date_trunc('month', (now() at time zone 'Europe/Rome')::date) - interval '24 months')::date then
    raise exception 'import_non_valido';
  end if;
  if jsonb_typeof(p_altri) is distinct from 'array' or jsonb_array_length(p_altri) > 5000 then
    raise exception 'import_non_valido';
  end if;
  if me.codice_amway is null then
    raise exception 'codice_mancante';
  end if;
  if nullif(regexp_replace(coalesce(p_io->>'codice', ''), '[^0-9]', '', 'g'), '') is distinct from me.codice_amway then
    raise exception 'import_di_altri';
  end if;
  if public.salva_numero(io, io, m, p_io, al) then n := n + 1; end if;
  for r in select * from jsonb_array_elements(p_altri) loop
    select p.id into chi from public.partners p
     where p.codice_amway = r->>'codice' and p.id <> io and public.is_in_downline(p.id) limit 1;
    if chi is not null and public.salva_numero(io, chi, m, r, al) then
      n := n + 1;
    end if;
  end loop;
  -- 065: una volta sola per import, alla fine
  perform public.avvisa_primi_ordini();
  return n;
end;
$$;

revoke execute on function public.in_percorso(public.partners), public.notifiche_eventi_link(), public.avvisa_fasi_partenza(uuid),
  public.fasi_da_partners(), public.fasi_da_persone(), public.fasi_da_activities(), public.avvisa_primi_ordini()
  from public, anon, authenticated;
revoke execute on function public.importa_mappa(date, timestamptz, jsonb, jsonb, text[], uuid[], text[]),
  public.salva_mese_passato(date, timestamptz, jsonb, jsonb) from public, anon;
grant execute on function public.importa_mappa(date, timestamptz, jsonb, jsonb, text[], uuid[], text[]),
  public.salva_mese_passato(date, timestamptz, jsonb, jsonb) to authenticated;
