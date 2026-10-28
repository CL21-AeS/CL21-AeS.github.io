-- Imitazione minima di Supabase per i test locali
do $$ begin create role anon nologin; exception when others then null; end $$; do $$ begin create role authenticated nologin; exception when others then null; end $$;
-- service_role: il ruolo del server (Edge Function delle notifiche, 039); senza, l'installazione si ferma alla 039
do $$ begin create role service_role nologin; exception when others then null; end $$;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, aud text, role text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(current_setting('request.jwt.claim.sub', true),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')), '')::uuid $$;
grant usage on schema auth, public to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
