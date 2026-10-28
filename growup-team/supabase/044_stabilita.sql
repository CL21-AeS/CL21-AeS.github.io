-- ============================================================
-- Growup Team — 044: i riferimenti della tabella «Verifica la tua attività - Stabilità» di Cum Laude 21 (28 ottobre 2026).
-- Sono i numeri che servono per SOSTENERE nel tempo la percentuale raggiunta con il fatturato (non per raggiungerla).
-- Stanno nelle impostazioni: se Cum Laude 21 li cambia si aggiornano dal Table editor (tabella settings, chiave
-- stabilita_cl21), senza toccare il codice. «livelli» sono le colonne; ogni riga ha una soglia per colonna.
-- Le chiavi delle righe dicono all'app da dove prende il numero: nuovi_gruppo e oltre_200 dalle mappe importate,
-- app_cl21, training_day e convention li scrive il partner.
-- ============================================================

insert into public.settings (chiave, valore, nota) values
  ('stabilita_cl21',
   '{"livelli": [3, 6, 9, 12, 15, 18, 21],
     "righe": [
       {"k": "nuovi_gruppo", "nome": "Nuovi iscritti nel gruppo del mese", "soglie": [1, 3, 5, 8, 10, 15, 20]},
       {"k": "oltre_200",    "nome": "Codici che fatturano più di 200 VP", "soglie": [1, 3, 5, 10, 17, 30, 42]},
       {"k": "app_cl21",     "nome": "Codici iscritti all''app CumLaude21", "soglie": [1, 2, 3, 7, 12, 21, 30]},
       {"k": "training_day", "nome": "Codici al Training Day",             "soglie": [1, 3, 5, 10, 17, 30, 42]},
       {"k": "convention",   "nome": "Codici alla Convention",             "soglie": [1, 2, 3, 7, 12, 21, 30]}]}',
   'Tabella «Verifica la tua attività - Stabilità» di Cum Laude 21: per ogni livello (colonne) i numeri che sostengono la qualifica')
on conflict (chiave) do update set valore = excluded.valore, nota = excluded.nota;

-- i conteggi della Stabilità: «con_mappa» dice se per quel mese c'è almeno una mappa importata nella mia rete
-- (senza mappa i codici oltre 200 VP non si contano: l'app scrive «disponibile dopo l'import della mappa»).
-- I codici oltre 200 VP: il mio più quelli della mia rete, ciascuno con più di 200 VP nel mese, solo dalle mappe.
create or replace function public.guida_conteggi(p_mese date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  io uuid := public.my_partner_id();
  m  date := date_trunc('month', p_mese)::date;
  f  timestamptz;
  t  timestamptz;
begin
  if io is null then
    raise exception 'non_autenticato';
  end if;
  f := m::timestamp at time zone 'Europe/Rome';
  t := (m + interval '1 month')::timestamp at time zone 'Europe/Rome';
  return jsonb_build_object(
    'personali', (select count(*) from public.partners p where p.invitato_da = io and p.invitato_il >= f and p.invitato_il < t),
    'nuovi_gruppo', (select count(*) from public.partners p where p.in_mappa_dal >= f and p.in_mappa_dal < t
                       and p.id <> io and public.vedo(p.id)),
    'oltre_200', (select count(*) from public.numeri_mese n where n.mese = m and n.vpp > 200 and public.vedo(n.partner_id)),
    'con_mappa', exists (select 1 from public.numeri_mese n where n.mese = m and public.vedo(n.partner_id))
  );
end;
$$;

revoke execute on function public.guida_conteggi(date) from public, anon, authenticated;
grant execute on function public.guida_conteggi(date) to authenticated;
