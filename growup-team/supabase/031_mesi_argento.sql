-- Growup Team — 031: i mesi da Argento dai report mappe, anche dei mesi passati (21 ottobre 2026).
-- Decisione di Stefano: il percorso prosegue Argento → Oro (3 mesi al 21%) → Platino (6 mesi, 3 di fila), contando
-- i mesi in cui il report mappe importato dà la persona al 21%. I report dei mesi chiusi si importano "solo numeri":
-- non spostano persone, non ne creano, non segnano "fuori report", non toccano i VPP.
-- Solo aggiunte: nessun drop, nessuna cancellazione.

/* i numeri del report degli ultimi 13 mesi di una persona che vedo (quelli importati da me) */
create or replace function public.mesi_report(p_partner uuid)
returns table (mese date, percentuale int, vpg numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  io uuid := public.my_partner_id();
begin
  if io is null or not public.vedo(p_partner) then
    raise exception 'non_autorizzato';
  end if;
  return query
    select n.mese, n.percentuale, n.vpg from public.numeri_report n
     where n.visto_da = io and n.partner_id = p_partner
       and n.mese >= (date_trunc('month', (now() at time zone 'Europe/Rome')::date) - interval '13 months')::date
     order by n.mese;
end;
$$;

/* il report di un mese chiuso: si salvano solo i numeri (21%, VPG, linee) per me e per chi vedo, per codice Amway.
   p_io: { codice, vpp, vpg, percentuale, linee, nascoste }; p_altri: [ { codice, vpp, vpg, percentuale, linee, nascoste } ] */
create or replace function public.salva_report_passato(p_mese date, p_io jsonb, p_altri jsonb)
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  io   uuid := public.my_partner_id();
  m    date := date_trunc('month', p_mese)::date;
  mio  text;
  r    jsonb;
  chi  uuid;
  n    int := 0;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  if m >= date_trunc('month', (now() at time zone 'Europe/Rome')::date)::date
     or m < (date_trunc('month', (now() at time zone 'Europe/Rome')::date) - interval '24 months')::date then
    raise exception 'import_non_valido';
  end if;
  if jsonb_typeof(p_altri) is distinct from 'array' or jsonb_array_length(p_altri) > 5000 then
    raise exception 'import_non_valido';
  end if;
  select codice_amway into mio from public.partners where id = io;
  if mio is null then
    raise exception 'codice_mancante';
  end if;
  if nullif(regexp_replace(coalesce(p_io->>'codice', ''), '[^0-9]', '', 'g'), '') is distinct from mio then
    raise exception 'import_di_altri';
  end if;
  perform public.salva_numeri_report(io, io, m, p_io);
  n := 1;
  for r in select * from jsonb_array_elements(p_altri) loop
    chi := null;
    select p.id into chi from public.partners p
     where p.codice_amway = r->>'codice' and p.id <> io
       and ((p.stato <> 'gestito' and public.vedo(p.id)) or (p.stato = 'gestito' and p.gestore_id = io))
     limit 1;
    if chi is not null then
      perform public.salva_numeri_report(io, chi, m, r);
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;

revoke execute on function public.mesi_report(uuid), public.salva_report_passato(date, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.mesi_report(uuid), public.salva_report_passato(date, jsonb, jsonb) to authenticated;
