-- ============================================================
-- Growup Team — Row Level Security (Fase 1)
-- Il repository è pubblico e la chiave pubblica di Supabase sta nel codice:
-- è sicura SOLO perché ogni tabella qui sotto ha la RLS attiva.
-- ============================================================

alter table public.partners           enable row level security;
alter table public.activities         enable row level security;
alter table public.goals              enable row level security;
alter table public.stage_requirements enable row level security;
alter table public.settings           enable row level security;

-- ---- Permessi di base: chi non ha fatto login non legge niente ----

revoke all on public.partners, public.activities, public.goals,
              public.stage_requirements, public.settings from anon, authenticated;

grant select on public.stage_requirements, public.settings to authenticated;
grant insert, update, delete on public.stage_requirements, public.settings to authenticated; -- filtrati dalle policy admin

-- Sul profilo si possono cambiare solo i campi propri: sponsor, stato, gestore,
-- email, admin e codice d'invito non si toccano dal telefono.
grant select on public.partners to authenticated;
grant update (nome, data_iscrizione, qualifica_iniziale, qualifica_iniziale_mese,
              pagamenti_iniziali, privacy_accettata_il)
  on public.partners to authenticated;

grant select, delete on public.activities to authenticated;
grant insert (partner_id, tipo, quantita, vp, data) on public.activities to authenticated;
grant update (quantita, vp, data) on public.activities to authenticated;

grant select, delete on public.goals to authenticated;
grant insert (partner_id, settimana, obiettivo_contatti, obiettivo_piani, obiettivo_vp)
  on public.goals to authenticated;
-- partner_id e settimana servono all'upsert dell'app; il trigger goals_prima li blocca comunque.
grant update (partner_id, settimana, obiettivo_contatti, obiettivo_piani, obiettivo_vp)
  on public.goals to authenticated;

-- ---- Funzioni ----

revoke execute on function public.my_partner_id(), public.is_in_downline(uuid),
  public.collega_profilo(), public.join_with_code(text, text, date, text, date, int),
  public.sponsor_da_codice(text), public.nuovo_codice()
  from public, anon, authenticated;

grant execute on function public.sponsor_da_codice(text) to anon, authenticated;
grant execute on function public.my_partner_id(), public.is_in_downline(uuid),
  public.collega_profilo(), public.join_with_code(text, text, date, text, date, int)
  to authenticated;

-- ---- partners: io e la mia downline, a qualsiasi profondità. Mai chi sta sopra. ----

create policy partners_leggo_me_e_downline on public.partners
  for select to authenticated
  using (public.is_in_downline(id));

create policy partners_modifico_me on public.partners
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
-- Nessuna policy di insert/delete: il profilo nasce solo da join_with_code.

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

-- ---- goals: come le attività ----

create policy goals_leggo on public.goals
  for select to authenticated
  using (public.is_in_downline(partner_id));

create policy goals_inserisco_miei on public.goals
  for insert to authenticated
  with check (partner_id = public.my_partner_id());

create policy goals_modifico_miei on public.goals
  for update to authenticated
  using (partner_id = public.my_partner_id())
  with check (partner_id = public.my_partner_id());

create policy goals_cancello_miei on public.goals
  for delete to authenticated
  using (partner_id = public.my_partner_id());

-- ---- Amministrazione: tutti leggono, solo gli admin scrivono ----

create or replace function public.sono_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.partners where user_id = auth.uid()), false)
$$;
revoke execute on function public.sono_admin() from public, anon;
grant execute on function public.sono_admin() to authenticated;

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
