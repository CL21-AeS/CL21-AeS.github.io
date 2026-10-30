-- ============================================================
-- Growup Team — 050: chi esce dalla mappa (30 ottobre 2026).
-- Decisioni di Stefano: la mappa Amway fa fede. Chi non compare più nella mappa, con qualsiasi import (admin o partner):
-- * esce dalla struttura e non lo vede più nessuno (niente stato «nascosto» in attesa di conferme);
-- * se usava l'app, l'app gli si blocca e non può più usarla (`blocco_mappa`, separato dal blocco messo da un admin);
-- * i suoi dati restano conservati solo nel caso rientri: se ricompare in una mappa riprende posto e dati e l'app si
--   sblocca da sola;
-- * dopo 12 mesi senza comparire in nessuna mappa si cancella con tutti i suoi dati, con un controllo pianificato ogni
--   notte (`pulisci_fuori_mappa`, attività in 050b), senza che l'admin debba fare nulla. I 12 mesi si contano da
--   `fuori_mappa_il`, l'ora del server quando è uscito (non dal mese mandato dal telefono).
-- Via la cancellazione «solo con l'import dell'admin» della 046. Chi sta sotto un gruppo che la mappa non mostra
-- (per esempio sotto un Platino) non conta come uscito: l'app non lo manda in `p_fuori`.
-- ============================================================

alter table public.partners add column if not exists fuori_mappa_il timestamptz;
alter table public.partners add column if not exists blocco_mappa boolean not null default false;
grant select (fuori_mappa_il, blocco_mappa) on public.partners to authenticated;
update public.partners set fuori_mappa_il = fuori_report_dal::timestamptz where fuori_report_dal is not null and fuori_mappa_il is null;
-- chi era «non più nel report» non resta più tra le nascoste di chi aveva importato: ora è fuori per tutti
delete from public.nascosti n using public.partners p where p.id = n.nascosto_id and p.fuori_report_dal is not null;

-- ---- Chi è fuori dalla mappa non lo vede più nessuno ----
create or replace function public.vedo(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target = public.my_partner_id()
      or (public.is_in_downline(target)
          and exists (select 1 from public.partners p
                       where p.id = target and p.fuori_report_dal is null
                         and (p.stato = 'gestito' or p.confermato_il is not null or p.is_admin)))
$$;

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
    select p.id, (p.fuori_report_dal is null and (p.stato = 'gestito' or p.confermato_il is not null or p.is_admin)),
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

-- ---- Chi ha l'app bloccata perché fuori dalla mappa lo sa ----
create or replace function public.stato_accesso()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (select 1 from public.accessi a join public.partners p on p.id = a.partner_id
                  where a.user_id = auth.uid() and p.bloccato_il is not null and p.blocco_mappa) then 'fuori_mappa'
    when exists (select 1 from public.accessi a join public.partners p on p.id = a.partner_id
                  where a.user_id = auth.uid() and p.bloccato_il is not null) then 'bloccato'
    when exists (select 1 from public.accessi_tolti where user_id = auth.uid()) then 'tolto'
    else null end
$$;

-- ---- Il controllo di ogni notte: 12 mesi fuori dalla mappa → si cancella tutto ----
create or replace function public.pulisci_fuori_mappa()
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  x public.partners;
  n int := 0;
begin
  for x in select * from public.partners
            where fuori_mappa_il is not null and fuori_mappa_il <= now() - interval '12 months' and not is_admin loop
    -- chi stava sotto (non dovrebbe succedere: la mappa lo ha già spostato) passa al suo sponsor
    update public.partners set sponsor_id = x.sponsor_id where sponsor_id = x.id;
    update public.partners set gestore_id = null where gestore_id = x.id;
    update public.partners set creato_da = null where creato_da = x.id;
    update public.partners set bloccato_da = null where bloccato_da = x.id;
    -- i suoi telefoni vedono «accesso tolto»
    insert into public.accessi_tolti (user_id) select user_id from public.accessi where partner_id = x.id
    on conflict (user_id) do update set tolto_il = now();
    delete from public.partners where id = x.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke execute on function public.pulisci_fuori_mappa() from public, anon, authenticated;

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
      -- vero quando il file lo mostra. 050: se usava l'app e gli si era bloccata perché fuori dalla mappa, si sblocca
      -- (un blocco messo a mano da un admin resta)
      update public.partners set posizione_al = al, mappa_mese = m, fuori_report_dal = null, fuori_mappa_il = null,
             bloccato_il = case when blocco_mappa then null else bloccato_il end, blocco_mappa = false,
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
    if x.fuori_report_dal is null and (x.mappa_mese is null or x.mappa_mese <= m) then
      update public.partners set fuori_report_dal = m, fuori_mappa_il = now(), posizione_al = al, mappa_mese = m,
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
