-- ============================================================
-- Growup Team — 066: chi ha invitato, anche per chi era già nella mappa (18 novembre 2026)
-- Difetto trovato preparando la versione di prova (STATO.md, 13 novembre): se un nuovo era già nella mappa importata
-- ed entrava con l'invito, entra_con_invito (052) non segnava invitato_da e invitato_il. Così lo sponsor non lo vedeva
-- in «I tuoi nuovi in partenza» né in «Da seguire oggi», e non contava tra i nuovi iscritti personali della Verifica.
-- Per chi entra prima di essere in una mappa (in attesa) li segnava già il trigger partners_guida (035), all'inserimento.
-- Correzione: la funzione è quella della 052 con due campi in più nell'aggiornamento di chi è già nella mappa
-- (invitato_da = chi ha creato l'invito, invitato_il = adesso). Solo "create or replace": nessuna tabella nuova, nessun
-- dato esistente cambiato, nessun oggetto tolto. Per tornare indietro basta rilanciare la funzione della 052.
-- ============================================================

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
           partenza_confermata_da = null,
           -- 066: chi ha invitato si segna anche per chi era già nella mappa (prima solo per chi entrava in attesa)
           invitato_da = i.creato_da, invitato_il = now()
     where id = copia;
    perform public.diventa_attivo(copia);   -- confermato subito; l'avviso «al suo posto» parte da partners_avvisi
    select * into p from public.partners where id = copia;
  else
    -- non ancora nella mappa: resta in attesa sotto chi l'ha invitato
    -- 052: invitato dall'admin nel gruppo di un Platino nascosto: entra sotto il Platino (o tra chi usa l'app e il suo
    -- sponsor) e può importare la sua mappa anche se è in attesa. Si ricontrolla adesso: se nel frattempo il Platino usa
    -- l'app (o il posto non è più nel suo gruppo), l'invito non vale più
    if i.area_platino is not null and (not public.platino_nascosto(i.area_platino)
         or (i.sotto_id is distinct from i.area_platino and not public.sotto_di(i.area_platino, i.sotto_id))) then
      raise exception 'invito_non_valido';
    end if;
    insert into public.partners (nome, sponsor_id, stato, chiave_hash, codice_amway, data_iscrizione,
                                 qualifica_iniziale, percentuale_iniziale, qualifica_iniziale_mese, pagamenti_iniziali,
                                 privacy_accettata_il, ultimo_aggiornamento, area_platino)
    values (i.nome, coalesce(i.sotto_id, i.creato_da), 'attivo', public.impronta(chiave), i.codice_amway, p_data_iscrizione,
            p_qualifica, p_percentuale, date_trunc('month', p_qualifica_mese)::date, coalesce(p_pagamenti, 0),
            now(), now(), i.area_platino)
    returning * into p;
    update public.partners set creato_da = p.id where id = p.id returning * into p;
    if i.sopra_di is not null and public.area_platino_di(i.sopra_di) is not distinct from i.area_platino then
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
