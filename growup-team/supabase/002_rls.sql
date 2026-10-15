-- ============================================================
-- Growup Team — Row Level Security (Fase 1)
-- Il repository è pubblico e la chiave pubblica di Supabase sta nel codice:
-- è sicura SOLO perché ogni tabella qui sotto ha la RLS attiva.
-- Gli accessi anonimi di Supabase hanno il ruolo "authenticated": vedono qualcosa
-- solo dopo che entra_con_chiave o iscrivi_con_codice li ha collegati a un profilo.
-- ============================================================

alter table public.partners           enable row level security;
alter table public.accessi            enable row level security;
alter table public.activities         enable row level security;
alter table public.goals              enable row level security;
alter table public.monthly_goals      enable row level security;
alter table public.stage_requirements enable row level security;
alter table public.settings           enable row level security;

-- ---- Permessi di base: chi non è collegato a un profilo non legge niente ----

revoke all on public.partners, public.accessi, public.activities, public.goals, public.monthly_goals,
              public.stage_requirements, public.settings from anon, authenticated;

grant select on public.stage_requirements, public.settings to authenticated;
grant insert, update, delete on public.stage_requirements, public.settings to authenticated; -- filtrati dalle policy admin

-- Sul profilo si possono cambiare solo i campi propri: sponsor, stato, gestore,
-- chiave, admin e codice d'invito non si toccano dal telefono.
grant select (id, nome, email, sponsor_id, codice_invito, stato, gestore_id, data_iscrizione,
              qualifica_iniziale, percentuale_iniziale, qualifica_iniziale_mese, pagamenti_iniziali,
              privacy_accettata_il, consenso_confermato_il, is_admin, ultimo_aggiornamento, creato_da, creato_il)
  on public.partners to authenticated;                      -- chiave_hash resta fuori
grant update (nome, email, data_iscrizione, qualifica_iniziale, percentuale_iniziale, qualifica_iniziale_mese,
              pagamenti_iniziali, privacy_accettata_il)
  on public.partners to authenticated;

-- accessi: nessun permesso diretto, si passa solo dalle funzioni.

grant select, delete on public.activities to authenticated;
grant insert (partner_id, tipo, quantita, vp, data) on public.activities to authenticated;
grant update (quantita, vp, data) on public.activities to authenticated;

-- partner_id, settimana e mese servono all'upsert dell'app; i trigger li bloccano comunque.
grant select, delete on public.goals, public.monthly_goals to authenticated;
grant insert (partner_id, settimana, obiettivo_contatti, obiettivo_piani) on public.goals to authenticated;
grant update (partner_id, settimana, obiettivo_contatti, obiettivo_piani) on public.goals to authenticated;
grant insert (partner_id, mese, obiettivo_vp) on public.monthly_goals to authenticated;
grant update (partner_id, mese, obiettivo_vp) on public.monthly_goals to authenticated;

-- ---- Funzioni ----

revoke execute on function public.my_partner_id(), public.is_in_downline(uuid), public.sono_admin(),
  public.collega_profilo(), public.entra_con_chiave(text),
  public.iscrivi_con_codice(text, text, date, text, date, int, int),
  public.aggiungi_partner(text, uuid, date, text, int, date, int), public.link_per_gestito(uuid),
  public.cambia_chiave(), public.nuova_chiave_per(uuid),
  public.sponsor_da_codice(text), public.nuovo_codice(), public.nuova_chiave_segreta(), public.impronta(text)
  from public, anon, authenticated;

-- le funzioni dei trigger girano da sole: nessuno le chiama a mano
revoke execute on function public.attivita_prima(), public.attivita_dopo(),
  public.obiettivi_prima(), public.obiettivi_mese_prima()
  from public, anon, authenticated;

grant execute on function public.sponsor_da_codice(text) to anon, authenticated;
grant execute on function public.my_partner_id(), public.is_in_downline(uuid), public.sono_admin(),
  public.collega_profilo(), public.entra_con_chiave(text),
  public.iscrivi_con_codice(text, text, date, text, date, int, int),
  public.aggiungi_partner(text, uuid, date, text, int, date, int), public.link_per_gestito(uuid),
  public.cambia_chiave(), public.nuova_chiave_per(uuid)
  to authenticated;

-- ---- partners: io e la mia downline, a qualsiasi profondità. Mai chi sta sopra. ----

create policy partners_leggo_me_e_downline on public.partners
  for select to authenticated
  using (public.is_in_downline(id));

create policy partners_modifico_me on public.partners
  for update to authenticated
  using (id = public.my_partner_id())
  with check (id = public.my_partner_id());
-- Nessuna policy di insert/delete: il profilo nasce solo da iscrivi_con_codice.

-- ---- activities: scrivo solo le mie; leggo le mie e quelle della mia downline ----

create policy activities_leggo on public.activities
  for select to authenticated
  using (public.is_in_downline(partner_id));

create policy activities_inserisco_mie on public.activities
  for insert to authenticated
  with check (partner_id = public.my_partner_id());

create policy activities_modifico_mie on public.activities
  for update to authenticated
  using (partner_id = public.my_partner_id())
  with check (partner_id = public.my_partner_id());

create policy activities_cancello_mie on public.activities
  for delete to authenticated
  using (partner_id = public.my_partner_id());

-- ---- goals e monthly_goals: come le attività ----

create policy goals_leggo on public.goals
  for select to authenticated using (public.is_in_downline(partner_id));
create policy goals_inserisco_miei on public.goals
  for insert to authenticated with check (partner_id = public.my_partner_id());
create policy goals_modifico_miei on public.goals
  for update to authenticated
  using (partner_id = public.my_partner_id()) with check (partner_id = public.my_partner_id());
create policy goals_cancello_miei on public.goals
  for delete to authenticated using (partner_id = public.my_partner_id());

create policy mgoals_leggo on public.monthly_goals
  for select to authenticated using (public.is_in_downline(partner_id));
create policy mgoals_inserisco_miei on public.monthly_goals
  for insert to authenticated with check (partner_id = public.my_partner_id());
create policy mgoals_modifico_miei on public.monthly_goals
  for update to authenticated
  using (partner_id = public.my_partner_id()) with check (partner_id = public.my_partner_id());
create policy mgoals_cancello_miei on public.monthly_goals
  for delete to authenticated using (partner_id = public.my_partner_id());

-- ---- Amministrazione: tutti leggono, solo gli admin scrivono ----

create policy stage_leggo on public.stage_requirements
  for select to authenticated using (true);
create policy stage_admin_ins on public.stage_requirements
  for insert to authenticated with check (public.sono_admin());
create policy stage_admin_upd on public.stage_requirements
  for update to authenticated using (public.sono_admin()) with check (public.sono_admin());
create policy stage_admin_del on public.stage_requirements
  for delete to authenticated using (public.sono_admin());

create policy settings_leggo on public.settings
  for select to authenticated using (true);
create policy settings_admin_ins on public.settings
  for insert to authenticated with check (public.sono_admin());
create policy settings_admin_upd on public.settings
  for update to authenticated using (public.sono_admin()) with check (public.sono_admin());
create policy settings_admin_del on public.settings
  for delete to authenticated using (public.sono_admin());
