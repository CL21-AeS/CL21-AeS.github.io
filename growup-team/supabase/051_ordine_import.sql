-- ============================================================
-- Growup Team — 051: l'ordine degli import dentro lo stesso mese (30 ottobre 2026).
-- Decisioni di Stefano:
-- * la data di riferimento di una mappa è la data e ora in cui è stata SCARICATA (la data di ultima modifica del file,
--   letta dall'app; se manca, l'ora dell'import); si salva insieme alla data e ora dell'import;
-- * la mappa dell'admin copre tutta la struttura: quando viene caricata torna a fare fede su tutto (posizioni e numeri),
--   anche se è stata scaricata prima;
-- * dopo, gli import dei partner aggiornano solo la loro parte, e solo con una mappa scaricata dopo quella in vigore per
--   quelle persone (posizione) o per quel mese (numeri).
-- Il mese di competenza decide sempre per primo (046): una mappa di un mese più recente sostituisce quella vecchia.
-- In più (controllo di sicurezza): chi rientra nella mappa ritrova l'app solo se era bloccata dalla mappa, mai se l'ha
-- bloccata un admin; e resta scritto chi ha segnato una persona «fuori dalla mappa» (`fuori_mappa_da`).
-- ============================================================

alter table public.partners add column if not exists posizione_importata_il timestamptz;
grant select (posizione_importata_il) on public.partners to authenticated;
-- chi ha segnato una persona «fuori dalla mappa» (con il suo import): resta scritto, si può sempre ricostruire
alter table public.partners add column if not exists fuori_mappa_da uuid references public.partners(id) on delete set null;
create index if not exists partners_fuori_mappa_da_idx on public.partners (fuori_mappa_da);

/* i numeri di una persona per un mese: quelli dell'admin fanno sempre fede; quelli di un partner sostituiscono solo
   numeri di una mappa scaricata prima (dati_al = data e ora di scaricamento; aggiornato_il = ora dell'import) */
create or replace function public.salva_numero(p_chi uuid, p_partner uuid, p_mese date, r jsonb, p_dati_al timestamptz)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  m     date := date_trunc('month', p_mese)::date;
  admin boolean := coalesce((select is_admin from public.partners where id = p_chi), false);
  n     int;
begin
  update public.partners set confermato_il = now()
   where id = p_partner and stato <> 'gestito' and confermato_il is null;
  if not (r ? 'vpg') then
    return false;
  end if;
  insert into public.numeri_mese (partner_id, mese, vpp, vpg, percentuale, linee, linee_nascoste, dati_al, importato_da)
  values (p_partner, m, coalesce((r->>'vpp')::numeric, 0), coalesce((r->>'vpg')::numeric, 0), nullif(r->>'percentuale', '')::int,
          case when jsonb_typeof(r->'linee') = 'array' then r->'linee' else '[]' end,
          coalesce((r->>'nascoste')::boolean, false), p_dati_al, p_chi)
  on conflict (partner_id, mese) do update
    set vpp = excluded.vpp, vpg = excluded.vpg, percentuale = excluded.percentuale, linee = excluded.linee,
        linee_nascoste = excluded.linee_nascoste, dati_al = excluded.dati_al, importato_da = excluded.importato_da,
        aggiornato_il = now()
    where admin or public.numeri_mese.dati_al <= excluded.dati_al;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;
revoke execute on function public.salva_numero(uuid, uuid, date, jsonb, timestamptz) from public, anon, authenticated;

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
