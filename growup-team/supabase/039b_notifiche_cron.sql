-- ============================================================
-- Growup Team — 039b: l'invio delle notifiche ogni 15 minuti (solo su Supabase, come 006b)
-- pg_cron chiama la Edge Function «invia-notifiche» con un segreto generato qui e custodito in Vault:
-- nessuno lo vede e non sta nel repository. La funzione controlla il segreto con notifiche_segreto_ok.
-- ============================================================

create extension if not exists pg_net;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'growup_notifiche_cron') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'growup_notifiche_cron',
                                'Segreto della chiamata pianificata a invia-notifiche');
  end if;
end $$;

/* per la Edge Function: il segreto ricevuto è quello giusto? (solo per il server) */
create or replace function public.notifiche_segreto_ok(p_segreto text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p_segreto = (select decrypted_secret from vault.decrypted_secrets where name = 'growup_notifiche_cron'), false)
$$;
revoke execute on function public.notifiche_segreto_ok(text) from public, anon, authenticated;
grant execute on function public.notifiche_segreto_ok(text) to service_role;

select cron.schedule(
  'growup-notifiche',
  '*/15 * * * *',
  $$select net.http_post(
      url := 'https://mxpuvmggexjyieylmfss.supabase.co/functions/v1/invia-notifiche',
      headers := jsonb_build_object('Content-Type', 'application/json',
                   'x-growup-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'growup_notifiche_cron')),
      body := '{}'::jsonb)$$
);
