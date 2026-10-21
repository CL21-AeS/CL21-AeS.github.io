-- Growup Team — 029: i "sì" del mese divisi in partner e clienti (21 ottobre 2026).
-- Decisione di Stefano: "1 piano e 3 sì" confondeva (i sì contano anche i clienti aggiunti con "+ Un cliente" e quelli
-- importati dal sito Amway). Ora sponsor e upline vedono quanti nuovi partner e quanti nuovi clienti nel mese.
-- Si aggiungono due numeri; "si_mese" resta (la somma) per le versioni vecchie dell'app.

create or replace function public.numeri_persone(p_partner uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  m date := date_trunc('month', (now() at time zone 'Europe/Rome')::date)::date;
begin
  if public.my_partner_id() is null or not public.vedo(p_partner) then
    raise exception 'non_autorizzato';
  end if;
  return jsonb_build_object(
    'in_lista',  (select count(*) from public.persone where proprietario = p_partner and esito is null and fase = 'lista'),
    'in_corso',  (select count(*) from public.persone where proprietario = p_partner and esito is null and fase <> 'lista'),
    'piani_mese', (select count(*) from public.passi where proprietario = p_partner and tipo = 'piano' and data >= m),
    'si_mese',   (select count(*) from public.passi where proprietario = p_partner and tipo = 'chiusura'
                    and esito in ('partner', 'cliente') and data >= m),
    'partner_mese', (select count(*) from public.passi where proprietario = p_partner and tipo = 'chiusura'
                    and esito = 'partner' and data >= m),
    'clienti_mese', (select count(*) from public.passi where proprietario = p_partner and tipo = 'chiusura'
                    and esito = 'cliente' and data >= m),
    'clienti',   (select count(*) from public.persone where proprietario = p_partner and esito = 'cliente' and not non_compra),
    'totale',    (select count(*) from public.persone where proprietario = p_partner));
end;
$$;
