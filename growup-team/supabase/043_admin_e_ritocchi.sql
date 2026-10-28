-- Growup Team — 043: poteri da admin nel proprio gruppo, impostazioni solo con un profilo, notifica di prova limitata,
-- punto di partenza solo dalla sua funzione e ritocchi tecnici (28 ottobre 2026).
-- Decisioni di Stefano dopo il controllo di sicurezza del 28 ottobre (punti 4, 5, 6, 8 e 9):
-- * 4: nuovo link personale, blocco dell'app, togliere chi è in attesa e i codici tolti: l'admin li usa solo nel suo
--   gruppo (sé stesso e la sua downline), non più su tutta la struttura. La copia di sicurezza resta di tutto;
-- * 5: impostazioni, tappe e livelli percentuali si leggono solo con un profilo. La pagina d'ingresso, che non ha ancora un
--   profilo, riceve le qualifiche da invito_aperto, solo se l'invito è aperto;
-- * 6: il punto di partenza (qualifica, percentuale, mese, pagamenti) si cambia solo con modifica_partenza;
-- * 8: un telefono si iscrive alle notifiche solo con un servizio ufficiale (Google, Apple, Mozilla, Microsoft) e la notifica
--   di prova si manda al massimo una volta al minuto e 10 volte al giorno (notifiche_prova_ok, per la Edge Function);
-- * 9: search_path fisso in inizio_py, indici sulle chiavi esterne, regole di accesso con (select my_partner_id()) che si
--   calcola una volta per richiesta invece che per ogni riga. pg_net resta nello schema public: spostarlo vuol dire
--   toglierlo e rimetterlo, con il rischio di fermare le notifiche, per un avviso che non espone niente.
-- Si può rilanciare.

-- ---- 4: i poteri da admin nel proprio gruppo ----
create or replace function public.nuova_chiave_per(p_partner uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  chiave text := public.nuova_chiave_segreta();
begin
  -- dall'app: solo un admin e solo per sé o per il suo gruppo (dall'SQL Editor, senza utente, per chiunque)
  if auth.uid() is not null and (not public.sono_admin()
     or not (p_partner = public.my_partner_id() or public.is_in_downline(p_partner))) then
    raise exception 'non_autorizzato';
  end if;
  if exists (select 1 from public.partners where id = p_partner and stato = 'gestito' and not is_admin) then
    raise exception 'mai_entrato';
  end if;
  update public.partners set chiave_hash = public.impronta(chiave) where id = p_partner;
  if not found then
    raise exception 'partner_inesistente';
  end if;
  delete from public.accessi where partner_id = p_partner;
  return chiave;
end;
$$;

create or replace function public.blocca_app(p_partner uuid, p_blocca boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  io uuid := public.my_partner_id();
  t  public.partners;
begin
  if io is null or not public.sono_admin() then
    raise exception 'non_autorizzato';
  end if;
  select * into t from public.partners where id = p_partner;
  if not found or t.stato = 'gestito' or t.id = io or t.is_admin or not public.is_in_downline(t.id) then
    raise exception 'non_autorizzato';
  end if;
  update public.partners
     set bloccato_il = case when p_blocca then coalesce(bloccato_il, now()) end,
         bloccato_da = case when p_blocca then io end
   where id = t.id;
end;
$$;

create or replace function public.togli_dalla_struttura(p_partner uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  io  uuid := public.my_partner_id();
  t   public.partners;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  select * into t from public.partners where id = p_partner;
  if not found or t.stato = 'gestito' or t.id = io or t.is_admin then
    raise exception 'non_autorizzato';
  end if;
  -- lo sponsor diretto, o un admin che gli sta sopra
  if not (t.sponsor_id = io or (public.sono_admin() and public.is_in_downline(t.id))) then
    raise exception 'non_autorizzato';
  end if;
  if t.confermato_il is not null then
    raise exception 'gia_confermato';
  end if;
  -- chi aveva invitato passa al suo sponsor; le persone senza app restano nella struttura (sono della mappa)
  update public.partners set sponsor_id = t.sponsor_id where sponsor_id = t.id;
  update public.partners set gestore_id = null where gestore_id = t.id;
  update public.partners set creato_da = null where creato_da = t.id;
  update public.partners set bloccato_da = null where bloccato_da = t.id;
  if t.codice_amway is not null then
    insert into public.codici_tolti (codice_amway, nome, tolto_da) values (t.codice_amway, t.nome, io)
    on conflict (codice_amway) do update set nome = excluded.nome, tolto_il = now(), tolto_da = excluded.tolto_da;
  end if;
  insert into public.accessi_tolti (user_id) select user_id from public.accessi where partner_id = t.id
  on conflict (user_id) do update set tolto_il = now();
  delete from public.partners where id = t.id;
end;
$$;

-- i codici tolti: l'admin vede e sblocca quelli tolti da sé o da qualcuno del suo gruppo
create or replace function public.codici_tolti_elenco()
returns table (codice_amway text, nome text, tolto_il timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  io uuid := public.my_partner_id();
begin
  if not public.sono_admin() then
    raise exception 'non_autorizzato';
  end if;
  return query select c.codice_amway, c.nome, c.tolto_il from public.codici_tolti c
   where c.tolto_da is null or c.tolto_da = io or public.is_in_downline(c.tolto_da)
   order by c.tolto_il desc;
end;
$$;

create or replace function public.sblocca_codice(p_codice text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  io uuid := public.my_partner_id();
begin
  if not public.sono_admin() then
    raise exception 'non_autorizzato';
  end if;
  delete from public.codici_tolti c
   where c.codice_amway = p_codice and (c.tolto_da is null or c.tolto_da = io or public.is_in_downline(c.tolto_da));
end;
$$;

-- ---- 5: impostazioni, tappe e livelli solo con un profilo ----
alter policy settings_leggo on public.settings using ((select public.my_partner_id()) is not null);
alter policy stage_leggo on public.stage_requirements using ((select public.my_partner_id()) is not null);
alter policy livelli_leggo on public.percent_levels using ((select public.my_partner_id()) is not null);

-- la pagina d'ingresso riceve le qualifiche con l'invito, solo se è aperto
create or replace function public.invito_aperto(p_codice text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  i public.inviti;
begin
  if coalesce(p_codice, '') !~* '^[0-9a-f]{32}$' then
    return jsonb_build_object('stato', 'sconosciuto');
  end if;
  select * into i from public.inviti where codice_hash = public.impronta(p_codice);
  if not found or not exists (select 1 from public.partners s where s.id = i.creato_da and s.bloccato_il is null) then
    return jsonb_build_object('stato', 'sconosciuto');
  end if;
  if i.usato_il is not null then return jsonb_build_object('stato', 'usato'); end if;
  if i.annullato_il is not null then return jsonb_build_object('stato', 'annullato'); end if;
  if i.scade_il <= now() then return jsonb_build_object('stato', 'scaduto'); end if;
  return jsonb_build_object('stato', 'ok', 'nome', i.nome,
                            'da', (select btrim(s.nome) from public.partners s where s.id = i.creato_da),
                            'qualifiche', coalesce((select jsonb_agg(to_jsonb(q) order by q.ordine) from public.stage_requirements q), '[]'));
end;
$$;

-- ---- 6: il punto di partenza solo da modifica_partenza (che controlla i valori) ----
revoke update (qualifica_iniziale, percentuale_iniziale, qualifica_iniziale_mese, pagamenti_iniziali)
  on public.partners from authenticated;

-- ---- 8: notifiche solo dai servizi ufficiali; la prova con un limite ----
alter table public.notifiche_telefoni drop constraint if exists notifiche_telefoni_servizio_check;
alter table public.notifiche_telefoni add constraint notifiche_telefoni_servizio_check check (endpoint ~ ('^https://(fcm\.googleapis\.com'
  || '|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/'));

-- per la Edge Function: si può mandare una prova adesso? (al massimo una al minuto e 10 al giorno); se sì la segna
create or replace function public.notifiche_prova_ok(p_partner uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext('notifiche_prova:' || p_partner::text));
  if exists (select 1 from public.notifiche_inviate where partner_id = p_partner and chiave like 'prova-%'
               and inviata_il > now() - interval '1 minute')
     or (select count(*) from public.notifiche_inviate where partner_id = p_partner and chiave like 'prova-%'
           and inviata_il > now() - interval '1 day') >= 10 then
    return false;
  end if;
  insert into public.notifiche_inviate (partner_id, chiave) values (p_partner, 'prova-' || gen_random_uuid());
  return true;
end;
$$;
revoke execute on function public.notifiche_prova_ok(uuid) from public, anon, authenticated;
grant execute on function public.notifiche_prova_ok(uuid) to service_role;

-- ---- 9: ritocchi tecnici ----
alter function public.inizio_py(date) set search_path = public;

create index if not exists activities_inserito_da_idx on public.activities (inserito_da);
create index if not exists codici_tolti_tolto_da_idx on public.codici_tolti (tolto_da);
create index if not exists inviti_admin_creato_da_idx on public.inviti_admin (creato_da);
create index if not exists inviti_admin_sponsor_id_idx on public.inviti_admin (sponsor_id);
create index if not exists inviti_admin_usato_da_idx on public.inviti_admin (usato_da);
create index if not exists inviti_target_persona_id_idx on public.inviti_target (persona_id);
create index if not exists monthly_totals_partner_id_idx on public.monthly_totals (partner_id);
create index if not exists monthly_totals_qualifica_idx on public.monthly_totals (qualifica);
create index if not exists nascosti_nascosto_id_idx on public.nascosti (nascosto_id);
create index if not exists notifiche_telefoni_partner_id_idx on public.notifiche_telefoni (partner_id);
create index if not exists numeri_mese_importato_da_idx on public.numeri_mese (importato_da);
create index if not exists numeri_report_partner_id_idx on public.numeri_report (partner_id);
create index if not exists ordini_personali_attivita_id_idx on public.ordini_personali (attivita_id);
create index if not exists partners_bloccato_da_idx on public.partners (bloccato_da);
create index if not exists partners_creato_da_idx on public.partners (creato_da);
create index if not exists partners_invitato_da_idx on public.partners (invitato_da);
create index if not exists partners_partenza_confermata_da_idx on public.partners (partenza_confermata_da);
create index if not exists partners_prossima_qualifica_idx on public.partners (prossima_qualifica);
create index if not exists partners_qualifica_iniziale_idx on public.partners (qualifica_iniziale);
create index if not exists passi_attivita_id_idx on public.passi (attivita_id);
create index if not exists passi_proprietario_idx on public.passi (proprietario);
create index if not exists persone_invito_target_id_idx on public.persone (invito_target_id);
create index if not exists preferiti_preferito_id_idx on public.preferiti (preferito_id);
create index if not exists righe_ordine_personale_proprietario_idx on public.righe_ordine_personale (proprietario);
create index if not exists righe_ordine_proprietario_idx on public.righe_ordine (proprietario);

-- le regole di accesso: (select my_partner_id()) e (select sono_admin()) si calcolano una volta per richiesta
alter policy activities_cancello_mie on public.activities
  using (((partner_id = (select public.my_partner_id())) OR posso_gestire(partner_id)));
alter policy activities_inserisco_mie on public.activities
  with check (((partner_id = (select public.my_partner_id())) OR posso_gestire(partner_id)));
alter policy activities_leggo on public.activities
  using ((vedo(partner_id) AND ((tipo <> ALL (ARRAY['ordine'::text, 'rettifica'::text])) OR (partner_id = (select public.my_partner_id())) OR (EXISTS ( SELECT 1 FROM partners p WHERE ((p.id = activities.partner_id) AND (p.stato = 'gestito'::text)))))));
alter policy activities_modifico_mie on public.activities
  using (((partner_id = (select public.my_partner_id())) OR posso_gestire(partner_id)))
  with check (((partner_id = (select public.my_partner_id())) OR posso_gestire(partner_id)));
alter policy durate_mie on public.durate
  using ((proprietario = (select public.my_partner_id())))
  with check ((proprietario = (select public.my_partner_id())));
alter policy esclusi_leggi on public.esclusi_import
  using ((partner_id = (select public.my_partner_id())));
alter policy esclusi_togli on public.esclusi_import
  using ((partner_id = (select public.my_partner_id())));
alter policy goals_cancello_miei on public.goals
  using (((partner_id = (select public.my_partner_id())) OR posso_gestire(partner_id)));
alter policy goals_inserisco_miei on public.goals
  with check (((partner_id = (select public.my_partner_id())) OR posso_gestire(partner_id)));
alter policy goals_modifico_miei on public.goals
  using (((partner_id = (select public.my_partner_id())) OR posso_gestire(partner_id)))
  with check (((partner_id = (select public.my_partner_id())) OR posso_gestire(partner_id)));
alter policy guida_fatti_miei on public.guida_fatti
  using ((partner_id = (select public.my_partner_id())))
  with check (((partner_id = (select public.my_partner_id())) AND (giorno <= ((now() AT TIME ZONE 'Europe/Rome'::text))::date)));
alter policy guida_obiettivi_miei on public.guida_obiettivi
  using ((partner_id = (select public.my_partner_id())))
  with check ((partner_id = (select public.my_partner_id())));
alter policy inviti_miei on public.inviti
  using ((creato_da = (select public.my_partner_id())));
alter policy inviti_target_miei on public.inviti_target
  using ((proprietario = (select public.my_partner_id())))
  with check ((proprietario = (select public.my_partner_id())));
alter policy listino_admin_cambia on public.listino
  using ((select public.sono_admin()))
  with check ((select public.sono_admin()));
alter policy listino_admin_nuovo on public.listino
  with check ((select public.sono_admin()));
alter policy listino_leggo on public.listino
  using (((select public.my_partner_id()) IS NOT NULL));
alter policy mgoals_cancello_miei on public.monthly_goals
  using (((partner_id = (select public.my_partner_id())) OR posso_gestire(partner_id)));
alter policy mgoals_inserisco_miei on public.monthly_goals
  with check (((partner_id = (select public.my_partner_id())) OR posso_gestire(partner_id)));
alter policy mgoals_modifico_miei on public.monthly_goals
  using (((partner_id = (select public.my_partner_id())) OR posso_gestire(partner_id)))
  with check (((partner_id = (select public.my_partner_id())) OR posso_gestire(partner_id)));
alter policy totali_leggo on public.monthly_totals
  using ((visto_da = (select public.my_partner_id())));
alter policy nascosti_aggiungi on public.nascosti
  with check (((partner_id = (select public.my_partner_id())) AND (nascosto_id <> partner_id) AND vedo(nascosto_id)));
alter policy nascosti_leggi on public.nascosti
  using ((partner_id = (select public.my_partner_id())));
alter policy nascosti_togli on public.nascosti
  using ((partner_id = (select public.my_partner_id())));
alter policy notifiche_previste_mie on public.notifiche_previste
  using ((partner_id = (select public.my_partner_id())))
  with check (((partner_id = (select public.my_partner_id())) AND ((giorno >= (((now() AT TIME ZONE 'Europe/Rome'::text))::date - 1)) AND (giorno <= (((now() AT TIME ZONE 'Europe/Rome'::text))::date + 31)))));
alter policy notifiche_telefoni_miei on public.notifiche_telefoni
  using ((partner_id = (select public.my_partner_id())))
  with check ((partner_id = (select public.my_partner_id())));
alter policy numeri_cl21_miei on public.numeri_cl21
  using ((partner_id = (select public.my_partner_id())))
  with check ((partner_id = (select public.my_partner_id())));
alter policy numeri_report_leggo on public.numeri_report
  using ((visto_da = (select public.my_partner_id())));
alter policy obiettivi_aggiorna on public.obiettivi
  using ((partner_id = (select public.my_partner_id())))
  with check ((partner_id = (select public.my_partner_id())));
alter policy obiettivi_leggi on public.obiettivi
  using ((partner_id = (select public.my_partner_id())));
alter policy obiettivi_scrivi on public.obiettivi
  with check ((partner_id = (select public.my_partner_id())));
alter policy ordini_miei on public.ordini
  using ((proprietario = (select public.my_partner_id())))
  with check ((proprietario = (select public.my_partner_id())));
alter policy ordini_personali_creo on public.ordini_personali
  with check (((proprietario = (select public.my_partner_id())) AND (stato = 'bozza'::text)));
alter policy ordini_personali_leggo on public.ordini_personali
  using ((proprietario = (select public.my_partner_id())));
alter policy ordini_personali_tolgo on public.ordini_personali
  using ((proprietario = (select public.my_partner_id())));
alter policy partners_modifico_me on public.partners
  using ((id = (select public.my_partner_id())))
  with check ((id = (select public.my_partner_id())));
alter policy passi_miei on public.passi
  using ((proprietario = (select public.my_partner_id())))
  with check ((proprietario = (select public.my_partner_id())));
alter policy livelli_admin_del on public.percent_levels
  using ((select public.sono_admin()));
alter policy livelli_admin_ins on public.percent_levels
  with check ((select public.sono_admin()));
alter policy livelli_admin_upd on public.percent_levels
  using ((select public.sono_admin()))
  with check ((select public.sono_admin()));
alter policy persone_mie on public.persone
  using ((proprietario = (select public.my_partner_id())))
  with check ((proprietario = (select public.my_partner_id())));
alter policy preferiti_aggiungi on public.preferiti
  with check (((partner_id = (select public.my_partner_id())) AND (preferito_id <> partner_id) AND vedo(preferito_id)));
alter policy preferiti_leggi on public.preferiti
  using ((partner_id = (select public.my_partner_id())));
alter policy preferiti_togli on public.preferiti
  using ((partner_id = (select public.my_partner_id())));
alter policy righe_ordine_mie on public.righe_ordine
  using ((proprietario = (select public.my_partner_id())))
  with check ((proprietario = (select public.my_partner_id())));
alter policy righe_personali_cambio on public.righe_ordine_personale
  using (((proprietario = (select public.my_partner_id())) AND (EXISTS ( SELECT 1 FROM ordini_personali o WHERE ((o.id = righe_ordine_personale.ordine_id) AND (o.proprietario = (select public.my_partner_id())) AND (o.stato = 'bozza'::text))))))
  with check ((proprietario = (select public.my_partner_id())));
alter policy righe_personali_creo on public.righe_ordine_personale
  with check (((proprietario = (select public.my_partner_id())) AND (EXISTS ( SELECT 1 FROM ordini_personali o WHERE ((o.id = righe_ordine_personale.ordine_id) AND (o.proprietario = (select public.my_partner_id())) AND (o.stato = 'bozza'::text))))));
alter policy righe_personali_leggo on public.righe_ordine_personale
  using ((proprietario = (select public.my_partner_id())));
alter policy righe_personali_tolgo on public.righe_ordine_personale
  using ((proprietario = (select public.my_partner_id())));
alter policy seguimi_mio on public.seguimi
  using ((partner_id = (select public.my_partner_id())))
  with check ((partner_id = (select public.my_partner_id())));
alter policy seguimi_giorni_miei on public.seguimi_giorni
  using ((partner_id = (select public.my_partner_id())))
  with check (((partner_id = (select public.my_partner_id())) AND (giorno <= ((now() AT TIME ZONE 'Europe/Rome'::text))::date)));
alter policy settings_admin_del on public.settings
  using ((select public.sono_admin()));
alter policy settings_admin_ins on public.settings
  with check ((select public.sono_admin()));
alter policy settings_admin_upd on public.settings
  using ((select public.sono_admin()))
  with check ((select public.sono_admin()));
alter policy stage_admin_del on public.stage_requirements
  using ((select public.sono_admin()));
alter policy stage_admin_ins on public.stage_requirements
  with check ((select public.sono_admin()));
alter policy stage_admin_upd on public.stage_requirements
  using ((select public.sono_admin()))
  with check ((select public.sono_admin()));

revoke execute on function public.nuova_chiave_per(uuid), public.blocca_app(uuid, boolean), public.togli_dalla_struttura(uuid),
  public.codici_tolti_elenco(), public.sblocca_codice(text), public.invito_aperto(text) from public, anon;
grant execute on function public.nuova_chiave_per(uuid), public.blocca_app(uuid, boolean), public.togli_dalla_struttura(uuid),
  public.codici_tolti_elenco(), public.sblocca_codice(text) to authenticated;
grant execute on function public.invito_aperto(text) to anon, authenticated;
