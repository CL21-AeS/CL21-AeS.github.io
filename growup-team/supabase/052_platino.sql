-- ============================================================
-- Growup Team — 052: il gruppo di un Platino che non usa l'app (30 ottobre 2026).
-- Decisioni di Stefano. La mappa dell'admin non mostra il gruppo di un Platino («linee nascoste»), finché è il Platino
-- a importarla. Se il Platino non usa l'app e non importa:
-- * l'admin può invitare una persona «sotto il Platino»: chi entra così è nel gruppo del Platino (`area_platino`) e
--   può importare subito la propria mappa, anche se è ancora in attesa; la sua mappa lo conferma e lo mette sotto il suo
--   sponsor vero se è già nell'app, altrimenti resta sotto il Platino; poi invita le persone del suo gruppo, che la sua
--   mappa mette al posto giusto;
-- * solo l'admin, e solo nel gruppo di un Platino così, può inserire una persona tra chi usa già l'app e il suo
--   sponsor (l'invito «sopra di»): nessun inserimento a mano nelle altre parti della mappa;
-- * se il Platino comincia a usare l'app, la sua mappa mostra tutti e rimette ognuno al suo posto (normalità);
-- * i VP non fanno cumulo: i VP di gruppo del Platino sono quelli ufficiali della mappa (numeri_mese), già comprensivi
--   di chi gli sta sotto.
-- ============================================================

alter table public.partners add column if not exists area_platino uuid references public.partners(id) on delete set null;
create index if not exists partners_area_platino_idx on public.partners (area_platino);
grant select (area_platino) on public.partners to authenticated;
alter table public.inviti add column if not exists sotto_id uuid references public.partners(id) on delete set null;
alter table public.inviti add column if not exists sopra_di uuid references public.partners(id) on delete set null;
alter table public.inviti add column if not exists area_platino uuid references public.partners(id) on delete set null;
create index if not exists inviti_sotto_id on public.inviti (sotto_id);
create index if not exists inviti_sopra_di on public.inviti (sopra_di);
create index if not exists inviti_area_platino on public.inviti (area_platino);

/* p_persona sta (anche in profondità) sotto p_antenato? */
create or replace function public.sotto_di(p_antenato uuid, p_persona uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with recursive su(id, sponsor_id, livello) as (
    select p.id, p.sponsor_id, 0 from public.partners p where p.id = p_persona
    union all
    select p.id, p.sponsor_id, su.livello + 1 from public.partners p join su on p.id = su.sponsor_id where su.livello < 200
  )
  select exists (select 1 from su where su.sponsor_id = p_antenato)
$$;

/* un Platino «nascosto»: non usa l'app (quindi non importa) e la mappa più recente non mostra il suo gruppo */
create or replace function public.platino_nascosto(p uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.partners x where x.id = p and x.stato = 'gestito' and x.fuori_report_dal is null)
     and coalesce((select n.linee_nascoste from public.numeri_mese n where n.partner_id = p order by n.mese desc limit 1), false)
$$;

/* il primo Platino nascosto sopra una persona (se c'è) */
create or replace function public.area_platino_di(q uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  with recursive su(id, livello) as (
    select p.sponsor_id, 1 from public.partners p where p.id = q
    union all
    select p.sponsor_id, su.livello + 1 from public.partners p join su on p.id = su.id where su.livello < 200 and p.sponsor_id is not null
  )
  select su.id from su where su.id is not null and public.platino_nascosto(su.id) order by su.livello limit 1
$$;
revoke execute on function public.sotto_di(uuid, uuid), public.platino_nascosto(uuid), public.area_platino_di(uuid)
  from public, anon, authenticated;

/* l'invito nel gruppo di un Platino nascosto, solo per l'admin:
   p_sotto = il Platino (la persona entra sotto di lui), oppure p_sopra_di = chi usa già l'app nel gruppo del Platino
   (la persona entra tra lui e il suo sponsor) */
create or replace function public.crea_invito_platino(p_nome text, p_codice_amway text, p_sotto uuid default null,
                                                      p_sopra_di uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  io     uuid := public.my_partner_id();
  codice text := nullif(regexp_replace(coalesce(p_codice_amway, ''), '[^0-9]', '', 'g'), '');
  chiave text := public.nuova_chiave_segreta();
  q      public.partners;
  sotto  uuid;
  area   uuid;
  i      public.inviti;
begin
  if io is null or not public.sono_admin() then
    raise exception 'non_autorizzato';
  end if;
  if (p_sotto is null) = (p_sopra_di is null) then
    raise exception 'non_autorizzato';
  end if;
  if p_sopra_di is null then
    -- sotto il Platino: deve essere nella mia downline, senza app e con il gruppo nascosto nella mappa
    if not public.is_in_downline(p_sotto) or not public.platino_nascosto(p_sotto) then
      raise exception 'non_platino_nascosto';
    end if;
    sotto := p_sotto; area := p_sotto;
  else
    -- in mezzo: sopra chi usa già l'app, solo nel gruppo di un Platino nascosto
    select * into q from public.partners where id = p_sopra_di;
    if not found or q.stato = 'gestito' or not public.is_in_downline(q.id) then
      raise exception 'non_autorizzato';
    end if;
    area := public.area_platino_di(q.id);
    if area is null then
      raise exception 'non_platino_nascosto';
    end if;
    sotto := q.sponsor_id;
  end if;
  if length(btrim(coalesce(p_nome, ''))) = 0 then
    raise exception 'nome_mancante';
  end if;
  if codice is null then
    raise exception 'codice_amway_mancante';
  end if;
  if codice !~ '^[0-9]{4,12}$' then
    raise exception 'codice_amway_non_valido';
  end if;
  if exists (select 1 from public.codici_tolti where codice_amway = codice) then
    raise exception 'codice_tolto';
  end if;
  if exists (select 1 from public.partners where codice_amway = codice and stato <> 'gestito') then
    raise exception 'codice_amway_attivo';
  end if;
  -- chi è già nella mappa (anche senza app) si invita con l'invito di sempre
  if exists (select 1 from public.partners where codice_amway = codice) then
    raise exception 'codice_nella_mappa';
  end if;
  if (select count(*) from public.inviti where creato_da = io and usato_il is null and annullato_il is null
        and scade_il > now()) >= 50 then
    raise exception 'troppi_inviti';
  end if;
  insert into public.inviti (codice_hash, creato_da, nome, codice_amway, scade_il, sotto_id, sopra_di, area_platino)
  values (public.impronta(chiave), io, left(btrim(p_nome), 80), codice, now() + interval '7 days', sotto, p_sopra_di, area)
  returning * into i;
  return jsonb_build_object('id', i.id, 'codice', chiave, 'scade_il', i.scade_il);
end;
$$;
revoke execute on function public.crea_invito_platino(text, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.crea_invito_platino(text, text, uuid, uuid) to authenticated;

create or replace function public.entra_con_invito(p_codice text, p_data_iscrizione date default null,
  p_qualifica text default null, p_qualifica_mese date default null, p_pagamenti integer default 0,
  p_percentuale integer default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid     uuid := auth.uid();
  chiave  text := public.nuova_chiave_segreta();
  i       public.inviti;
  copia   uuid;
  p       public.partners;
begin
  if uid is null then
    raise exception 'non_autenticato';
  end if;
  if exists (select 1 from public.accessi where user_id = uid) then
    raise exception 'profilo_esistente';
  end if;
  if coalesce(p_codice, '') !~* '^[0-9a-f]{32}$' then
    raise exception 'invito_non_valido';
  end if;
  select * into i from public.inviti where codice_hash = public.impronta(p_codice) for update;
  if not found or not exists (select 1 from public.partners s where s.id = i.creato_da and s.bloccato_il is null) then
    raise exception 'invito_non_valido';
  end if;
  if i.usato_il is not null then raise exception 'invito_usato'; end if;
  if i.annullato_il is not null then raise exception 'invito_annullato'; end if;
  if i.scade_il <= now() then raise exception 'invito_scaduto'; end if;
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
  if exists (select 1 from public.partners where codice_amway = i.codice_amway and stato <> 'gestito') then
    raise exception 'codice_amway_attivo';
  end if;

  if exists (select 1 from public.partners where codice_amway = i.codice_amway and stato = 'gestito') then
    -- già nella mappa: prende il suo posto, solo se chi ha invitato le sta sopra
    select x.id into copia from public.partners x
     where x.codice_amway = i.codice_amway and x.stato = 'gestito'
       and exists (
         with recursive su(id, sponsor_id, livello) as (
           select y.id, y.sponsor_id, 0 from public.partners y where y.id = x.sponsor_id
           union all
           select y.id, y.sponsor_id, su.livello + 1 from public.partners y join su on y.id = su.sponsor_id
           where su.livello < 200
         )
         select 1 from su where su.id = i.creato_da)
     order by (x.gestore_id = i.creato_da) desc, public.profondita(x.gestore_id) desc, x.creato_il, x.id
     limit 1;
    if copia is null then
      raise exception 'codice_amway_altra_linea';
    end if;
    -- l'invito si segna prima: partners_avvisi lo legge per avvisare chi ha invitato
    update public.inviti set usato_il = now(), usato_da = copia where id = i.id;
    update public.partners
       set nome = i.nome, chiave_hash = public.impronta(chiave), data_iscrizione = p_data_iscrizione,
           qualifica_iniziale = p_qualifica, percentuale_iniziale = p_percentuale,
           qualifica_iniziale_mese = date_trunc('month', p_qualifica_mese)::date,
           pagamenti_iniziali = coalesce(p_pagamenti, 0), privacy_accettata_il = now(), ultimo_aggiornamento = now(),
           partenza_confermata_il = case when p_qualifica is null and p_percentuale is null then now() end,
           partenza_confermata_da = null
     where id = copia;
    perform public.diventa_attivo(copia);   -- confermato subito; l'avviso «al suo posto» parte da partners_avvisi
    select * into p from public.partners where id = copia;
  else
    -- non ancora nella mappa: resta in attesa sotto chi l'ha invitato
    -- 052: invitato dall'admin nel gruppo di un Platino nascosto: entra sotto il Platino (o tra chi usa l'app e il suo
    -- sponsor) e può importare la sua mappa anche se è in attesa
    insert into public.partners (nome, sponsor_id, stato, chiave_hash, codice_amway, data_iscrizione,
                                 qualifica_iniziale, percentuale_iniziale, qualifica_iniziale_mese, pagamenti_iniziali,
                                 privacy_accettata_il, ultimo_aggiornamento, area_platino)
    values (i.nome, coalesce(i.sotto_id, i.creato_da), 'attivo', public.impronta(chiave), i.codice_amway, p_data_iscrizione,
            p_qualifica, p_percentuale, date_trunc('month', p_qualifica_mese)::date, coalesce(p_pagamenti, 0),
            now(), now(), i.area_platino)
    returning * into p;
    update public.partners set creato_da = p.id where id = p.id returning * into p;
    if i.sopra_di is not null then
      update public.partners set sponsor_id = p.id where id = i.sopra_di and sponsor_id is not distinct from i.sotto_id;
    end if;
    perform public.avvisa(i.creato_da, 'entrato-' || p.id,
      'Una persona che hai invitato è entrata in Growup. Resta in attesa finché una mappa importata non la mette al suo posto.');
  end if;

  update public.inviti set usato_il = now(), usato_da = p.id where id = i.id;
  -- gli altri inviti aperti con lo stesso codice non servono più
  update public.inviti set annullato_il = now()
   where codice_amway = i.codice_amway and id <> i.id and usato_il is null and annullato_il is null;
  insert into public.accessi (user_id, partner_id) values (uid, p.id);
  return jsonb_build_object('profilo', to_jsonb(p) - 'chiave_hash', 'chiave', chiave);
end;
$$;

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

  return jsonb_build_object('aggiunte', aggiunte, 'spostate', spostate, 'fuori', fuori, 'aggiornati', numeri, 'piu_vecchi', vecchi,
                            'bloccati', bloccati, 'ignorate', ignorate);
end;
$$;
