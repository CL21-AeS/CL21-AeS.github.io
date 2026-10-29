-- ============================================================
-- Growup Team — controlli dei permessi (Fase 1)
-- Si lancia nell'SQL editor di Supabase dopo l'installazione.
-- Tutti i controlli stanno in un unico blocco che alla fine ANNULLA ogni dato di prova.
-- Se un controllo fallisce si ferma con "CONTROLLO FALLITO: ...".
-- Se arriva in fondo mostra "TUTTI I CONTROLLI SUPERATI".
--
-- Struttura di prova:     R (radice, admin)
--                        /         \
--                       A           C        A e C sono colleghi di pari livello
--                       |
--                       B
-- Ogni "telefono" è un utente anonimo di Supabase (u1 … u7).
-- ============================================================

create schema if not exists growup_test;
grant usage on schema growup_test to anon, authenticated;

-- diventare un telefono (uid) o un visitatore senza accesso (null)
create or replace function growup_test.come(uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  if uid is null then
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config('request.jwt.claims', '', true);
    execute 'set local role anon';
  else
    perform set_config('request.jwt.claim.sub', uid::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'is_anonymous', true)::text, true);
    execute 'set local role authenticated';
  end if;
end $$;

create or replace function growup_test.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'CONTROLLO FALLITO: %', msg; end if;
end $$;

create or replace function growup_test.deve_fallire(q text, msg text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    return;
  end;
  raise exception 'CONTROLLO FALLITO (doveva essere rifiutato): %', msg;
end $$;

-- righe toccate da un update/delete (0 = la RLS l'ha nascosto)
create or replace function growup_test.righe(q text) returns int language plpgsql as $$
declare n int;
begin
  execute q; get diagnostics n = row_count; return n;
end $$;

-- 041: un invito personale creato direttamente, per preparare le prove (le regole di crea_invito hanno i loro controlli)
create or replace function growup_test.invito(da uuid, nome text, codice text) returns text
language plpgsql security definer set search_path = public as $$
declare c text := public.nuova_chiave_segreta();
begin
  insert into public.inviti (codice_hash, creato_da, nome, codice_amway, scade_il)
  values (public.impronta(c), da, nome, codice, now() + interval '7 days');
  return c;
end $$;

grant execute on all functions in schema growup_test to anon, authenticated;

do $test$
declare
  u1 constant uuid := '00000000-0000-0000-0000-0000000000a1';  -- R, telefono di Stefano
  u2 constant uuid := '00000000-0000-0000-0000-0000000000a2';  -- A
  u3 constant uuid := '00000000-0000-0000-0000-0000000000a3';  -- B
  u4 constant uuid := '00000000-0000-0000-0000-0000000000a4';  -- C
  u5 constant uuid := '00000000-0000-0000-0000-0000000000a5';  -- A, secondo dispositivo
  u6 constant uuid := '00000000-0000-0000-0000-0000000000a6';  -- R, telefono di Alessia
  u7 constant uuid := '00000000-0000-0000-0000-0000000000a7';  -- telefono nuovo, poi D
  u8 constant uuid := '00000000-0000-0000-0000-0000000000a8';  -- E, aggiunta a mano, poi entra
  r uuid; a uuid; b uuid; c uuid; d uuid; e uuid; f uuid; g uuid; h uuid; k uuid; x record; mese_prec date;
  pp uuid; pq uuid; att_prima int;
  k_r text; k_a text; k_a2 text; k_d text; k_e text;
begin
  begin  -- tutto quello che succede qui dentro viene annullato alla fine

  -- ---- Preparazione (come amministratore del database) ----
  insert into auth.users (id, aud, role)
  select ('00000000-0000-0000-0000-0000000000a' || i)::uuid, 'authenticated', 'authenticated'
  from generate_series(1, 8) i;

  insert into public.partners (nome, codice_invito, is_admin, stato)
  values ('Radice Test', 'RRRR22', true, 'gestito') returning id into r;
  k_r := public.nuova_chiave_per(r);
  perform growup_test.ok(length(k_r) = 32, 'chiave di 32 caratteri');
  perform growup_test.ok((select chiave_hash from public.partners where id = r) <> k_r, 'nel database c''è solo l''impronta');

  -- ---- Prima di entrare ----
  perform growup_test.come(null);
  perform growup_test.ok(to_regprocedure('public.sponsor_da_codice(text)') is null, '041: il link d''invito generico non esiste più');
  perform growup_test.ok(public.invito_aperto('RRRR22')->>'stato' = 'sconosciuto', '041: un vecchio codice d''invito non apre niente');
  perform growup_test.deve_fallire('select id from public.partners', 'anon non legge i partner');
  perform growup_test.deve_fallire('select id from public.activities', 'anon non legge le attività');
  perform growup_test.deve_fallire($q$select public.entra_con_chiave('x')$q$, 'anon non entra senza sessione');

  -- ---- Un telefono anonimo non collegato non vede niente ----
  perform growup_test.come(u7);
  perform growup_test.ok(public.collega_profilo() is null, 'telefono nuovo: nessun profilo');
  perform growup_test.ok((select count(*) from public.partners) = 0, 'telefono non collegato non vede partner');
  perform growup_test.deve_fallire($q$select public.entra_con_chiave('00000000000000000000000000000000')$q$, 'chiave sbagliata');

  -- ---- La radice entra con la sua chiave, da due telefoni (Stefano e Alessia) ----
  perform growup_test.come(u1);
  perform growup_test.ok(public.entra_con_chiave(k_r)->>'stato' = 'attivo', 'la radice entra e diventa attiva');
  perform growup_test.ok(not (public.collega_profilo() ? 'chiave_hash'), 'il profilo non espone l''impronta');
  perform growup_test.deve_fallire('select chiave_hash from public.partners', 'chiave_hash non leggibile');
  perform growup_test.come(u6);
  perform growup_test.ok(public.entra_con_chiave(upper(k_r))->>'nome' = 'Radice Test', 'secondo telefono sullo stesso profilo');

  -- ---- Iscrizioni dai link d'invito ----
  perform growup_test.come(u2);
  perform growup_test.deve_fallire($q$select public.entra_con_invito('RRRR22')$q$, '041: il vecchio link generico non fa entrare');
  perform growup_test.deve_fallire($q$select public.entra_con_invito('00000000000000000000000000000000')$q$, 'invito inesistente');
  k_e := growup_test.invito(r, 'Anna Test', '2000001');
  perform growup_test.deve_fallire(format('select public.entra_con_invito(%L, current_date + 5)', k_e), 'data di iscrizione nel futuro');
  k_a := public.entra_con_invito(k_e, date '2026-07-01')->>'chiave';
  a := (public.collega_profilo()->>'id')::uuid;
  perform growup_test.ok((public.collega_profilo()->>'sponsor_id')::uuid = r, 'A agganciata a R');
  perform growup_test.ok(public.collega_profilo()->>'nome' = 'Anna Test' and public.collega_profilo()->>'codice_amway' = '2000001',
                         '041: nome e codice Amway sono quelli scritti da chi invita');
  perform growup_test.deve_fallire(format('select public.entra_con_invito(%L)', growup_test.invito(r, 'A', '2000009')),
                                   'secondo profilo dallo stesso telefono');
  execute 'reset role';

  perform growup_test.come(u3);
  b := (public.entra_con_invito(growup_test.invito(a, 'Bruno Test', '2000002'), null, 'path_to_bronze')->'profilo'->>'id')::uuid;
  perform growup_test.come(u4);
  perform growup_test.deve_fallire(format('select public.entra_con_invito(%L, null, null, null, 0, 7)', growup_test.invito(r, 'C', '2000003')),
                                   'pin inesistente');
  c := (public.entra_con_invito(growup_test.invito(r, 'Carla Test', '2000003'), null, null, null, 0, 9)->'profilo'->>'id')::uuid;
  perform growup_test.ok((public.collega_profilo()->>'percentuale_iniziale')::int = 9, 'pin 9% registrato senza qualifica Bronze');
  execute 'reset role';
  perform growup_test.ok((select sponsor_id from public.partners where id = b) = a, 'B agganciato ad A');

  -- ---- 033: chi non è ancora nella mappa resta "in attesa": l'upline vede solo il nome ----
  perform growup_test.come(u2);  -- A (in attesa)
  perform growup_test.ok((select count(*) from public.partners) = 1, 'in attesa: A non vede B (in attesa anche lui), vede solo sé');
  perform growup_test.ok((select mio from public.in_attesa() where id = b) and (select count(*) from public.in_attesa()) = 1,
                         'A vede B per nome in «In attesa della mappa»');
  perform growup_test.come(u1);  -- R
  perform growup_test.ok(not exists (select 1 from public.partners where id in (a, b, c)), 'R non vede chi è in attesa');
  perform growup_test.ok((select count(*) from public.in_attesa()) = 3 and not (select mio from public.in_attesa() where id = b),
                         'R vede i tre in attesa per nome (B non è suo diretto)');
  perform growup_test.deve_fallire(format('select public.importa_mappa(current_date, now(), %L, %L, %L, %L)',
                         '{"codice":"2000001"}', '[]', '{}', '{}'), 'non per R: il report non è suo');
  perform growup_test.come(u2);
  perform growup_test.deve_fallire(format('select public.importa_mappa(current_date, now(), %L, %L, %L, %L)',
                         '{"codice":"2000001"}', '[]', '{}', '{}'), 'chi è in attesa non può importare');
  execute 'reset role';
  -- come dopo un import della mappa: A, B e C sono nel report
  update public.partners set confermato_il = now() where id in (a, b, c);

  -- ---- Visibilità: io e la mia downline, mai sopra né di lato ----
  perform growup_test.come(u2);  -- A
  perform growup_test.ok((select count(*) from public.partners) = 2, 'A vede solo sé e B');
  perform growup_test.ok(not exists (select 1 from public.partners where id in (r, c)), 'A non vede lo sponsor né la collega C');
  perform growup_test.deve_fallire('select * from public.accessi', 'accessi non leggibili');
  perform growup_test.come(u3);  -- B
  perform growup_test.ok((select count(*) from public.partners) = 1, 'B vede solo sé');
  perform growup_test.come(u6);  -- R dal secondo telefono
  perform growup_test.ok((select count(*) from public.partners) = 4, 'R vede tutta la downline a qualsiasi profondità');

  -- ---- Attività ----
  perform growup_test.come(u2);  -- A
  insert into public.activities (partner_id, tipo) values (a, 'contatto');
  insert into public.activities (partner_id, tipo, vp) values (a, 'ordine', 60);
  perform growup_test.ok((select inserito_da from public.activities where tipo = 'contatto') = a, 'inserito_da registrato dal server');
  perform growup_test.deve_fallire(format($q$insert into public.activities (partner_id, tipo) values (%L, 'contatto')$q$, b),
                                   'A non scrive attività di B (B è attivo)');
  perform growup_test.deve_fallire(format($q$insert into public.activities (partner_id, tipo, inserito_da) values (%L, 'contatto', %L)$q$, a, a),
                                   'inserito_da non si sceglie dal telefono');
  perform growup_test.deve_fallire(format($q$insert into public.activities (partner_id, tipo) values (%L, 'ordine')$q$, a), 'un ordine senza VP');
  perform growup_test.deve_fallire(format($q$insert into public.activities (partner_id, tipo, vp) values (%L, 'ordine', -5)$q$, a), 'un ordine negativo');
  insert into public.activities (partner_id, tipo, vp) values (a, 'rettifica', -10);
  perform growup_test.deve_fallire(format($q$insert into public.activities (partner_id, tipo, vp) values (%L, 'rettifica', 0)$q$, a), 'una rettifica a zero');
  perform growup_test.deve_fallire(format($q$insert into public.activities (partner_id, tipo, vp) values (%L, 'contatto', 5)$q$, a), 'VP su un contatto');
  delete from public.activities where tipo = 'rettifica';
  perform growup_test.ok((select ultimo_aggiornamento from public.partners where id = a) is not null, 'ultimo_aggiornamento si muove quando A scrive');

  perform growup_test.come(u3);  -- B
  insert into public.activities (partner_id, tipo) values (b, 'piano');
  perform growup_test.ok((select count(*) from public.activities) = 1, 'B non vede le attività di A');
  perform growup_test.ok(growup_test.righe($q$delete from public.activities where tipo = 'contatto'$q$) = 0, 'B non cancella le attività di A');

  perform growup_test.come(u4);  -- C
  perform growup_test.ok((select count(*) from public.activities) = 0, 'C non vede le attività della collega A');

  perform growup_test.come(u2);  -- A
  perform growup_test.ok((select count(*) from public.activities) = 3, 'A vede le sue e quelle di B');
  perform growup_test.ok(growup_test.righe($q$update public.activities set quantita = 5 where tipo = 'piano'$q$) = 0,
                         'A non modifica i dati di B (B è attivo)');
  perform growup_test.ok(growup_test.righe($q$delete from public.activities where tipo = 'contatto'$q$) = 1, 'A cancella una sua attività');

  -- ---- Obiettivi: settimana per contatti e piani, mese per i VP ----
  insert into public.goals (partner_id, settimana, obiettivo_contatti, obiettivo_piani) values (a, date '2026-10-12', 10, 3);
  insert into public.goals (partner_id, settimana, obiettivo_contatti, obiettivo_piani) values (a, date '2026-10-12', 12, 3)
  on conflict (partner_id, settimana) do update
    set partner_id = excluded.partner_id, settimana = excluded.settimana,
        obiettivo_contatti = excluded.obiettivo_contatti, obiettivo_piani = excluded.obiettivo_piani;
  perform growup_test.ok((select obiettivo_contatti from public.goals) = 12, 'A modifica i suoi obiettivi (upsert)');
  insert into public.monthly_goals (partner_id, mese, obiettivo_vp) values (a, date '2026-10-01', 100)
  on conflict (partner_id, mese) do update set partner_id = excluded.partner_id, mese = excluded.mese, obiettivo_vp = excluded.obiettivo_vp;
  perform growup_test.ok((select obiettivo_vp from public.monthly_goals) = 100, 'obiettivo VP del mese');
  perform growup_test.deve_fallire(format($q$insert into public.goals (partner_id, settimana) values (%L, date '2026-10-13')$q$, a), 'la settimana parte di lunedì');
  perform growup_test.deve_fallire(format($q$insert into public.monthly_goals (partner_id, mese) values (%L, date '2026-10-13')$q$, a), 'il mese parte dal giorno 1');
  perform growup_test.deve_fallire(format($q$insert into public.goals (partner_id, settimana) values (%L, date '2026-10-12')$q$, b), 'A non scrive gli obiettivi di B');
  perform growup_test.come(u3);  -- B
  perform growup_test.ok((select count(*) from public.goals) + (select count(*) from public.monthly_goals) = 0, 'B non vede gli obiettivi di A');

  -- ---- Profilo: campi protetti ----
  perform growup_test.come(u2);  -- A
  perform growup_test.deve_fallire('update public.partners set sponsor_id = null where id = public.my_partner_id()', 'A non cambia sponsor');
  perform growup_test.deve_fallire('update public.partners set is_admin = true where id = public.my_partner_id()', 'A non si fa admin');
  perform growup_test.deve_fallire($q$update public.partners set stato = 'gestito' where id = public.my_partner_id()$q$, 'A non cambia stato');
  perform growup_test.deve_fallire($q$update public.partners set chiave_hash = 'x' where id = public.my_partner_id()$q$, 'A non scrive l''impronta');
  perform growup_test.deve_fallire($q$insert into public.partners (nome) values ('Fantasma')$q$, 'nessun profilo fuori da entra_con_invito');
  perform growup_test.deve_fallire(format('insert into public.accessi (user_id, partner_id) values (auth.uid(), %L)', r),
                                   'nessuno si collega da solo a un altro profilo');
  perform growup_test.ok(growup_test.righe($q$update public.partners set nome = 'Anna T.' where id = public.my_partner_id()$q$) = 1, 'A cambia il suo nome');
  perform growup_test.ok(growup_test.righe(format($q$update public.partners set nome = 'X' where id = %L$q$, b)) = 0, 'A non cambia il nome di B (attivo)');

  -- ---- Chiavi: cambio e recupero ----
  perform growup_test.come(u5);  -- A dal computer, con la chiave ricevuta all'iscrizione
  perform growup_test.ok(public.entra_con_chiave(k_a)->>'nome' = 'Anna T.', 'A entra dal secondo dispositivo');
  k_a2 := public.cambia_chiave();   -- il computer resta dentro, il telefono (u2) viene scollegato
  perform growup_test.come(u2);
  perform growup_test.ok(public.collega_profilo() is null, 'cambio chiave: gli altri dispositivi sono scollegati');
  perform growup_test.deve_fallire(format('select public.entra_con_chiave(%L)', k_a), 'la vecchia chiave non vale più');
  perform growup_test.ok(public.entra_con_chiave(k_a2)->>'nome' = 'Anna T.', 'la chiave nuova funziona');
  perform growup_test.come(u5);
  perform growup_test.ok(public.collega_profilo()->>'nome' = 'Anna T.', 'chi ha cambiato la chiave resta dentro');
  perform growup_test.deve_fallire(format('select public.nuova_chiave_per(%L)', b), 'A non genera chiavi per B');
  perform growup_test.come(u1);  -- R admin
  perform growup_test.ok(length(public.nuova_chiave_per(b)) = 32, 'l''admin genera una chiave nuova per B');
  perform growup_test.come(u3);  -- B
  perform growup_test.ok(public.collega_profilo() is null, 'chiave rigenerata: i vecchi dispositivi di B sono scollegati');

  -- ---- Amministrazione ----
  perform growup_test.come(u5);  -- A
  perform growup_test.ok((select count(*) from public.stage_requirements) = 19, 'tutti leggono le 19 tappe e qualifiche');
  perform growup_test.ok(growup_test.righe('update public.stage_requirements set vp_personali = 1') = 0, 'A non modifica i requisiti');
  perform growup_test.come(u6);  -- R admin
  perform growup_test.ok(growup_test.righe('update public.stage_requirements set descrizione = descrizione') = 19, 'l''admin modifica i requisiti');

  -- ---- Prendere possesso di un profilo creato da altri, con la sua chiave ----
  execute 'reset role';
  insert into public.partners (nome, sponsor_id, stato, creato_da, codice_amway) values ('Dario Test', a, 'gestito', a, '2000004')
  returning id into d;
  perform growup_test.deve_fallire(format('select public.nuova_chiave_per(%L)', d), '041: niente link personale per chi non è mai entrato');
  update public.partners set chiave_hash = public.impronta('11111111111111111111111111111111') where id = d;
  insert into public.activities (partner_id, tipo, inserito_da) values (d, 'contatto', a);
  perform growup_test.come(u7);
  perform growup_test.deve_fallire($q$select public.entra_con_chiave('11111111111111111111111111111111')$q$,
                                   '041: chi non è mai entrato non entra con una chiave, solo con un invito');
  perform growup_test.ok(public.entra_con_invito(growup_test.invito(a, 'Dario Test', '2000004'))->'profilo'->>'stato' = 'attivo',
                         '041: D entra con l''invito di A, prende il suo profilo e diventa attivo');
  perform growup_test.ok((select count(*) from public.activities) = 1, 'D ritrova il suo storico');
  perform growup_test.ok((select count(*) from public.partners) = 1, 'nessun duplicato');

  -- ---- I codici Amway di chi usa l'app (dati all'ingresso; D li riceve qui) ----
  execute 'reset role';
  update public.partners set codice_amway = '2000004' where id = d;
  perform growup_test.ok((select codice_amway from public.partners where id = a) = '2000001'
                         and (select codice_amway from public.partners where id = b) = '2000002', 'il codice dato all''ingresso è salvato');
  insert into public.activities (partner_id, tipo, vp) values (r, 'ordine', 120), (b, 'ordine', 150), (c, 'ordine', 100);

  -- ---- Le funzioni degli inserimenti a mano sono chiuse ----
  perform growup_test.come(u1);  -- R admin
  perform growup_test.deve_fallire(format($q$select public.aggiungi_partner('X', %L)$q$, a), 'niente più inserimenti a mano');
  perform growup_test.deve_fallire(format($q$select public.aggiungi_con_codice('X', %L, '5555555')$q$, a), 'niente più inserimenti a mano con codice');
  perform growup_test.deve_fallire(format('select public.inserisci_in_mezzo(%L, array[%L]::uuid[])', 'X', b), 'niente più "manca qualcuno sopra"');
  perform growup_test.deve_fallire(format('select public.cambia_sponsor(%L, %L)', d, c), 'niente più "cambia sponsor", neanche per l''admin');
  perform growup_test.ok(to_regprocedure('public.link_per_gestito(uuid)') is null
                         and to_regprocedure('public.iscrivi_con_codice(text,text,date,text,date,integer,integer)') is null
                         and to_regprocedure('public.entra_con_invito(text,text,text,date,text,date,integer,integer)') is null,
                         '041: niente più link per le persone senza app né ingressi senza invito personale');

  -- ---- Import della rete (033: le persone importate le vede tutta la upline) ----
  perform growup_test.come(u5);  -- A
  perform growup_test.deve_fallire($q$select public.importa_rete(current_date, '{"codice":"9999999","vpp":0}', '[]', '[]', '{}', '{}')$q$,
                                   'il report di un altro partner è rifiutato');
  x := null;
  perform growup_test.ok((public.importa_rete(current_date, '{"codice":"2000001","vpp":60}',
      '[{"codice":"3000001","nome":"Elena Test","sponsor":"2000002","vpp":40},{"codice":"3000002","nome":"Fabio Test","sponsor":null,"vpp":0}]',
      '[{"codice":"2000002","sponsor":"2000001"}]', '{3000002}', '{}')->>'aggiunte')::int = 2, 'A importa E (sotto B) e F (sotto di lei)');
  e := (select id from public.partners where codice_amway = '3000001');
  f := (select id from public.partners where codice_amway = '3000002');
  perform growup_test.ok((select count(*) from public.partners where id in (e, f)) = 2, 'A vede le sue persone importate');
  perform growup_test.ok((select count(*) from public.nascosti where nascosto_id = f) = 1, 'F importata e già nascosta, come scelto nell''anteprima');
  execute 'reset role';
  perform growup_test.ok((select sponsor_id = b and stato = 'gestito' and gestore_id = a from public.partners where id = e),
                         'E è sotto B, senza app, importata da A');
  perform growup_test.come(u3);  -- B
  perform growup_test.come(u1);  -- B era stato scollegato dalla chiave rigenerata: l'admin gliene dà una nuova
  k_e := public.nuova_chiave_per(b);
  perform growup_test.come(u3);
  perform public.entra_con_chiave(k_e);
  perform growup_test.ok(exists (select 1 from public.partners where id = e), '033: B vede E, sotto di lui nella mappa, anche se l''ha importata A');
  perform growup_test.come(u1);  -- R
  perform growup_test.ok((select count(*) from public.partners where id in (e, f)) = 2, '033: R vede le persone importate da A (sono nella sua mappa)');
  perform growup_test.ok((select count(*) from public.nascosti) = 0, 'R non vede le persone nascoste da A');
  -- 033: R importa la sua mappa: E c'è già (una sola struttura), nessuna copia
  perform growup_test.ok((public.importa_mappa(current_date, now(),
      '{"codice":"1000000","vpp":120,"vpg":470,"percentuale":3,"linee":[{"codice":"2000001","vpg":250},{"codice":"2000003","vpg":100}]}',
      '[{"codice":"2000001","nome":"Anna","sponsor":"1000000"},{"codice":"2000002","nome":"Bruno","sponsor":"2000001"},{"codice":"3000001","nome":"Elena copia di R","sponsor":"2000002","vpp":45}]',
      '{}', '{}')->>'aggiunte')::int = 0, '033: R importa: E è già nella struttura, nessuna copia');
  perform growup_test.ok((select codice_amway from public.partners where id = r) = '1000000', 'il codice di R viene dalla prima riga');
  perform growup_test.come(u5);  -- A
  perform growup_test.ok((select count(*) from public.partners where codice_amway = '3000001') = 1, '033: una sola E per tutti');
  perform growup_test.deve_fallire(format('select public.imposta_codice_amway(%L, %L)', f, '3000001'), 'tra le mie importate il codice è unico');
  perform growup_test.deve_fallire(format('select public.imposta_codice_amway(%L, %L)', b, '2222222'), 'A non cambia il codice di B, che usa l''app');

  -- ---- Calcoli per chi guarda: nessun doppio conteggio ----
  -- vista di A: A 60, B 0 (034: i 150 VP scritti a mano da B li vede solo B), E 40, F 0, D 0 → A 100
  -- vista di R: dal suo report R 120 e 470 di gruppo con 2 linee; A 250 come per A
  perform growup_test.come(u5);  -- A
  select * into x from public.riepilogo_mese(current_date) where partner_id = a;
  perform growup_test.ok(x.vp_gruppo = 100, '034: A: VP di gruppo senza gli ordini a mano di B (' || x.vp_gruppo || ')');
  perform growup_test.ok((select count(*) from public.riepilogo_mese(current_date)) = 5, 'A: riepilogo di sé, B, D, E, F');
  perform growup_test.come(u1);  -- R
  select * into x from public.riepilogo_mese(current_date) where partner_id = a;
  perform growup_test.ok(x.vp_gruppo = 40, '034: R vede il gruppo di A senza gli ordini a mano di A e B, solo E che non ha l''app (' || x.vp_gruppo || ')');
  select * into x from public.riepilogo_mese(current_date) where partner_id = r;
  perform growup_test.ok(x.vp_gruppo = 470 and x.linee_attive = 2 and x.vp_personali = 120, 'R: dal report 120 personali, 470 di gruppo, 2 linee attive (' || x.vp_gruppo || ')');
  perform growup_test.come(u4);  -- C
  perform growup_test.ok((select count(*) from public.riepilogo_mese(current_date)) = 1, 'C vede solo sé');

  -- ---- Ingresso con il codice: chi è già importato prende il suo profilo ----
  execute 'reset role';
  insert into auth.users (id, aud, role) select ('00000000-0000-0000-0000-0000000000b' || i)::uuid, 'authenticated', 'authenticated'
  from generate_series(1, 4) i;
  perform growup_test.come('00000000-0000-0000-0000-0000000000b1');
  perform growup_test.deve_fallire(format('select public.entra_con_invito(%L)', growup_test.invito(r, 'Anna bis', '2000001')),
                                   'codice di chi usa già l''app: rifiutato');
  perform growup_test.deve_fallire(format('select public.entra_con_invito(%L)', growup_test.invito(c, 'Fabio', '3000002')),
                                   'codice importato in un''altra linea: rifiutato');
  perform growup_test.ok(public.entra_con_invito(growup_test.invito(b, 'Elena Vera', '3000001'))->'profilo'->>'id' = e::text,
                         'E entra dal link di B con il suo codice e prende il profilo importato da A');
  execute 'reset role';
  perform growup_test.ok((select stato = 'attivo' and sponsor_id = b and gestore_id is null and nome = 'Elena Vera' from public.partners where id = e),
                         'E ora usa l''app, sotto B');
  perform growup_test.ok((select count(*) from public.partners where codice_amway = '3000001') = 1, 'la copia di R è sparita');
  perform growup_test.ok((select sum(vp) from public.activities where partner_id = e) = 40, 'E ritrova i VPP importati');
  perform growup_test.come(u1);  -- R
  perform growup_test.ok(exists (select 1 from public.partners where id = e), 'ora R vede E');
  perform growup_test.come(u3);  -- B
  perform growup_test.ok(exists (select 1 from public.partners where id = e), 'ora B vede E');
  perform growup_test.come(u5);  -- A
  perform growup_test.deve_fallire(format($q$insert into public.activities (partner_id, tipo) values (%L, 'contatto')$q$, e),
                                   'E usa l''app: A non scrive più per lei');
  -- un codice nuovo: profilo nuovo sotto chi invita
  perform growup_test.come('00000000-0000-0000-0000-0000000000b2');
  perform growup_test.ok((public.entra_con_invito(growup_test.invito(c, 'Gino Test', '3000005'))->'profilo'->>'sponsor_id')::uuid = c,
                         'codice nuovo: sotto chi invita');
  g := public.my_partner_id();

  -- ---- L'import mette chi usa l'app sotto il suo sponsor del report ----
  perform growup_test.come(u5);  -- A: D (usa l'app, sotto A) secondo il report è di B
  perform growup_test.ok((public.importa_rete(current_date, '{"codice":"2000001","vpp":60}', '[]',
      '[{"codice":"2000004","sponsor":"2000002"},{"codice":"2000002","sponsor":"2000004"}]', '{}', '{}')->>'spostate')::int = 1,
      'A importa: D va sotto B; il giro B sotto D viene ignorato');
  execute 'reset role';
  perform growup_test.ok((select sponsor_id from public.partners where id = d) = b and (select sponsor_id from public.partners where id = b) = a,
                         'D sotto B, B resta sotto A');
  perform growup_test.come(u4);  -- C: chi non vede non sposta
  perform public.importa_rete(current_date, '{"codice":"2000003","vpp":100}',
      '[{"codice":"3000009","nome":"Ivo Test","sponsor":"2000001","vpp":0}]', '[{"codice":"2000004","sponsor":"2000003"}]', '{}', '{}');
  execute 'reset role';
  perform growup_test.ok((select sponsor_id from public.partners where id = d) = b, 'C non sposta D (non è nel suo gruppo)');
  perform growup_test.ok((select sponsor_id from public.partners where codice_amway = '3000009') = c,
                         'uno sponsor che C non vede: la persona va sotto C');

  -- ---- Non più nel report: nessuno si cancella, resta segnato e nascosto ----
  perform growup_test.come(u4);  -- C, un'altra linea
  perform growup_test.deve_fallire(format($q$select public.importa_mappa(current_date, now(), '{"codice":"2000003"}', '[]', '{}', '{%s}')$q$, f),
                                   '033: chi è in un''altra linea non segna F fuori dal report');
  perform growup_test.come(u5);  -- A
  perform growup_test.ok((public.importa_rete(current_date, '{"codice":"2000001","vpp":60}', '[]', '[]', '{}', array[f])->>'fuori')::int = 1,
                         'A: F non è più nel report');
  perform growup_test.ok(exists (select 1 from public.partners where id = f and fuori_report_dal is not null)
                         and exists (select 1 from public.nascosti where nascosto_id = f), 'F resta, segnata e nascosta');
  perform growup_test.ok((public.importa_rete(current_date, '{"codice":"2000001","vpp":60}',
      '[{"codice":"3000002","nome":"Fabio Test","sponsor":null,"vpp":0}]', '[]', '{}', '{}')->>'aggiunte')::int = 0, 'F torna nel report: niente doppioni');
  perform growup_test.ok(exists (select 1 from public.partners where id = f and fuori_report_dal is null), 'F torna nel report: segno tolto');

  -- ---- Nascoste: solo per chi le nasconde ----
  insert into public.nascosti (partner_id, nascosto_id) values (a, b);
  perform growup_test.deve_fallire(format('insert into public.nascosti (partner_id, nascosto_id) values (%L, %L)', a, c), 'A non nasconde chi non vede');
  perform growup_test.deve_fallire(format('insert into public.nascosti (partner_id, nascosto_id) values (%L, %L)', b, d), 'A non scrive le nascoste di B');
  perform growup_test.ok(exists (select 1 from public.riepilogo_mese(current_date) where partner_id = b), 'B nascosto resta nei numeri di A');
  perform growup_test.come(u1);  -- R
  perform growup_test.ok((select count(*) from public.nascosti) = 0, 'R non vede le nascoste di A');

  -- ---- Fase 2, blocco 2: conferma del punto di partenza ----
  execute 'reset role';
  perform growup_test.ok((select partenza_confermata_il is null from public.partners where id = c),
                         'C ha dichiarato il pin 9%: punto di partenza da confermare');
  perform growup_test.ok((select partenza_confermata_il is not null from public.partners where id = a),
                         'A partiva da zero: niente da confermare');
  -- 019: nessuno conferma più; ognuno corregge solo il proprio punto di partenza
  perform growup_test.come(u1);  -- R, sponsor di C
  perform growup_test.deve_fallire(format('select public.conferma_partenza(%L, null, 6)', c), 'lo sponsor non conferma più (funzione chiusa)');
  perform growup_test.come(u4);  -- C corregge il suo: 9% → 6%
  perform growup_test.ok((public.modifica_partenza(null, 6)->>'percentuale_iniziale')::int = 6, 'C corregge il proprio punto di partenza');
  perform growup_test.deve_fallire('select public.modifica_partenza(null, 7)', 'percentuale non valida rifiutata');
  perform growup_test.deve_fallire('select public.modifica_partenza(''inesistente'')', 'qualifica non valida rifiutata');
  perform growup_test.come(u1);  -- R: modifica_partenza cambia solo il proprio profilo
  perform public.modifica_partenza(null, null);
  execute 'reset role';
  perform growup_test.ok((select percentuale_iniziale = 6 from public.partners where id = c), 'R non tocca il punto di partenza di C');
  perform growup_test.ok(not has_function_privilege('anon', 'public.modifica_partenza(text, int, date, int)', 'execute'),
                         'chi non è entrato non può modificare');

  -- ---- Mesi chiusi e storico per chi guarda ----
  perform growup_test.come(u5);  -- A
  perform growup_test.deve_fallire(format($q$insert into public.activities (partner_id, tipo, vp, data) values (%L, 'ordine', 10, current_date - 70)$q$, a),
                                   'niente registrazioni in un mese chiuso');
  perform growup_test.deve_fallire(format($q$insert into public.activities (partner_id, tipo, data) values (%L, 'contatto', current_date + 3)$q$, a),
                                   'niente registrazioni nel futuro');
  perform growup_test.deve_fallire(format($q$select public.importa_rete(current_date - 100, '{"codice":"2000001","vpp":1}', '[]', '[]', '{}', '{}')$q$),
                                   'un mese chiuso non si importa');
  mese_prec := (date_trunc('month', current_date) - interval '1 day')::date;
  perform growup_test.ok(not public.mese_aperto(current_date - 70), 'mese_aperto: due mesi fa no');
  perform growup_test.ok(public.mese_aperto(current_date), 'mese_aperto: oggi sì');
  execute 'reset role';
  perform growup_test.ok(public.chiudi_mese(mese_prec) > 0, 'chiusura del mese precedente');
  perform growup_test.come(u5);  -- A
  perform growup_test.ok((select count(*) from public.riepilogo_mese(mese_prec) where chiuso) = (select count(*) from public.monthly_totals)
                         and (select count(*) from public.monthly_totals) > 0, 'A legge il mese chiuso come lo vedeva lei');
  perform growup_test.ok(not exists (select 1 from public.monthly_totals where visto_da <> a), 'A legge solo il suo storico');
  perform growup_test.deve_fallire(format($q$insert into public.monthly_totals (visto_da, partner_id, mese) values (%L, %L, date '2026-01-01')$q$, a, a),
                                   'lo storico non si scrive dal telefono');
  perform growup_test.deve_fallire('update public.monthly_totals set vp_gruppo = 99999', 'lo storico non si modifica');
  perform growup_test.deve_fallire('select public.chiudi_mese(current_date)', 'la chiusura non si lancia dal telefono');
  perform growup_test.ok((select count(*) from public.percent_levels) = 7, 'tutti leggono le soglie delle percentuali');
  perform growup_test.ok(growup_test.righe('update public.percent_levels set vp_gruppo = 1') = 0, 'A non modifica le soglie');

  -- ---- Nessuno cancella: né sponsor e upline, né l'admin ----
  perform growup_test.come(u5);  -- A
  perform growup_test.deve_fallire(format('select public.cancella_partner(%L)', d), 'A non cancella D');
  perform growup_test.deve_fallire(format('select public.cancella_partner(%L)', f), 'A non cancella F, che ha importato');
  perform growup_test.come(u1);  -- R admin
  perform growup_test.deve_fallire(format('select public.cancella_partner(%L)', d), 'neanche l''admin cancella');
  perform growup_test.deve_fallire(format('delete from public.partners where id = %L', d), 'niente cancellazioni dirette');
  execute 'reset role';
  perform growup_test.ok(exists (select 1 from public.partners where id = d), 'D c''è ancora');
  k := e;

  -- ---- Numeri ufficiali dal report e Platino (017) ----
  perform growup_test.come(u1);  -- R importa: P (Platino, gruppo nascosto) sotto A
  perform public.importa_rete(current_date,
    '{"codice":"1000000","vpp":120,"vpg":9500,"percentuale":18,"linee":[{"codice":"2000001","vpg":3173},{"codice":"2000003","vpg":2905},{"codice":"9000001","vpg":1528}]}',
    '[{"codice":"4100001","nome":"Bianca Platini","sponsor":"2000001","vpp":0,"vpg":5300,"percentuale":15,"linee":[],"nascoste":true}]',
    '[{"codice":"2000001","sponsor":"1000000","vpg":3173,"percentuale":12,"linee":[]}]', '{}', '{}');
  h := (select id from public.partners where codice_amway = '4100001');
  select * into x from public.riepilogo_mese(current_date) where partner_id = r;
  perform growup_test.ok(x.da_report and x.vp_gruppo = 9500 and x.percentuale = 18 and x.linee_attive = 3,
                         'R: VPG, percentuale e linee dal report');
  perform growup_test.ok(x.qualifica = 'foundation_12', 'R: qualifica calcolata sulla struttura del report (' || coalesce(x.qualifica, '-') || ')');
  select * into x from public.riepilogo_mese(current_date) where partner_id = h;
  perform growup_test.ok(x.vp_gruppo = 5300 and x.percentuale = 15 and x.linee_nascoste, 'Platino: VPG ufficiale, linee nascoste');
  select * into x from public.riepilogo_mese(current_date) where partner_id = a;
  perform growup_test.ok(x.vp_gruppo = 3173 and x.percentuale = 12, 'R vede i numeri ufficiali di A');
  perform growup_test.come(u5);  -- 033: A vede i suoi numeri ufficiali anche se il report l'ha importato R
  perform growup_test.ok((select da_report and vp_gruppo = 3173 from public.riepilogo_mese(current_date) where partner_id = a), '033: A ha i suoi numeri dal report di R');
  perform growup_test.ok(exists (select 1 from public.numeri_mese where partner_id = a) and not exists (select 1 from public.numeri_mese where partner_id = r),
                         '033: A legge i suoi numeri, non quelli di R (sopra di lei)');
  perform growup_test.come(u4);  -- C, altra linea
  perform growup_test.ok(not exists (select 1 from public.numeri_mese where partner_id in (a, r)), '033: un''altra linea non legge i numeri');

  -- ---- Chi entra in attesa va al suo posto con la mappa: sotto una persona importata ----
  execute 'reset role';
  insert into auth.users (id, aud, role) select ('00000000-0000-0000-0000-0000000000c' || i)::uuid, 'authenticated', 'authenticated'
  from generate_series(1, 3) i;
  perform growup_test.come('00000000-0000-0000-0000-0000000000c1');
  f := (public.entra_con_invito(growup_test.invito(r, 'Nora Sotto', '4000002'))->'profilo'->>'id')::uuid;
  execute 'reset role';
  perform growup_test.ok((select sponsor_id = r and confermato_il is null from public.partners where id = f), '041: N entra in attesa sotto chi l''ha invitata');
  update public.partners set sponsor_id = h, confermato_il = now() where id = f;  -- come dopo un import della mappa
  perform growup_test.come(u1);
  perform growup_test.ok((select sponsor_id from public.struttura_visibile() where id = f) = h, 'R vede N sotto il Platino');
  perform growup_test.come(u5);  -- 033: A vede anche il Platino importato da R, e N sotto di lui
  perform growup_test.ok((select sponsor_id from public.struttura_visibile() where id = f) = h
                         and exists (select 1 from public.struttura_visibile() where id = h), '033: A vede il Platino e N sotto di lui, come R');
  perform growup_test.ok(exists (select 1 from public.riepilogo_mese(current_date) where partner_id = f and sponsor_id = h), 'i numeri di A contano N');
  perform growup_test.ok(to_regprocedure('public.crea_invito_sopra(uuid,uuid[])') is null, '041: niente più «invito sopra»');

  -- ---- Il codice Amway lo corregge solo un admin ----
  perform growup_test.come(u5);  -- A
  perform growup_test.deve_fallire(format('select public.imposta_codice_amway(%L, %L)', a, '2000011'), 'A non cambia il suo codice');
  perform growup_test.come(u1);  -- R admin
  perform growup_test.ok(public.imposta_codice_amway(a, '2000011')->>'codice_amway' = '2000011', 'l''admin corregge il codice di A');
  perform public.imposta_codice_amway(a, '2000001');

  -- ---- Preferiti: solo persone del proprio gruppo, visibili solo a chi li ha segnati ----
  perform growup_test.come(u5);  -- A
  insert into public.preferiti (partner_id, preferito_id) values (a, b);
  perform growup_test.ok((select count(*) from public.preferiti) = 1, 'A segna B tra i preferiti');
  perform growup_test.deve_fallire(format('insert into public.preferiti (partner_id, preferito_id) values (%L, %L)', a, c), 'A non segna C (altra linea)');
  perform growup_test.deve_fallire(format('insert into public.preferiti (partner_id, preferito_id) values (%L, %L)', a, a), 'A non segna sé stessa');
  perform growup_test.deve_fallire(format('insert into public.preferiti (partner_id, preferito_id) values (%L, %L)', b, k), 'A non scrive i preferiti di B');
  perform growup_test.come(u4);  -- C
  perform growup_test.ok((select count(*) from public.preferiti) = 0, 'C non vede i preferiti di A');
  delete from public.preferiti;
  perform growup_test.come(u5);
  perform growup_test.ok((select count(*) from public.preferiti) = 1, 'C non cancella i preferiti di A');
  delete from public.preferiti where preferito_id = b;
  perform growup_test.ok((select count(*) from public.preferiti) = 0, 'A toglie B dai preferiti');

  -- ---- Il primo obiettivo: lo scrive solo la persona; l'upline vede cifra e data, non il perché ----
  perform growup_test.come(u3);  -- B
  insert into public.obiettivi (partner_id, cifra_mese, entro, perche) values (b, 360, current_date + 180, 'Per la famiglia');
  perform growup_test.ok((select perche from public.obiettivi) = 'Per la famiglia', 'B scrive e legge il suo obiettivo');
  update public.obiettivi set cifra_mese = 400 where partner_id = b;
  perform growup_test.ok((select cifra_mese from public.obiettivi) = 400, 'B corregge il suo obiettivo');
  perform growup_test.come(u5);  -- A, sponsor di B
  perform growup_test.ok((select count(*) from public.obiettivi) = 0, 'A non legge la tabella degli obiettivi di B');
  perform growup_test.ok((select cifra_mese from public.obiettivi_gruppo() where partner_id = b) = 400, 'A vede la cifra di B con obiettivi_gruppo()');
  perform growup_test.deve_fallire(format('insert into public.obiettivi (partner_id, cifra_mese, entro) values (%L, 100, current_date)', b), 'A non scrive l''obiettivo di B');
  update public.obiettivi set cifra_mese = 1 where partner_id = b;
  perform growup_test.come(u4);  -- C, altra linea
  perform growup_test.ok(not exists (select 1 from public.obiettivi_gruppo() where partner_id = b), 'C non vede l''obiettivo di B');
  execute 'reset role';
  perform growup_test.ok((select cifra_mese from public.obiettivi where partner_id = b) = 400, 'A non ha cambiato l''obiettivo di B');
  perform growup_test.ok(not exists (select 1 from pg_proc where proname = 'obiettivi_gruppo' and 'perche' = any(proargnames)),
                         'obiettivi_gruppo non restituisce il perché');

  -- ---- 020: la Lista — nomi solo miei, l'upline vede i numeri ----
  execute 'reset role';
  att_prima := (select count(*) from public.activities where partner_id = b);
  perform growup_test.come(u3);  -- B
  insert into public.persone (nome, contatto) values ('Persona Prova', '333') returning id into pp;
  perform growup_test.ok((select proprietario = b and fase = 'lista' and esito is null from public.persone where id = pp), 'B aggiunge un nome alla sua lista');
  insert into public.passi (persona_id, tipo, come, reazione) values (pp, 'contatto', 'Telefono', 'Aperto, incuriosito');
  perform growup_test.ok((select fase = 'contattato' from public.persone where id = pp), 'il contatto porta la persona a Contattato');
  insert into public.passi (persona_id, tipo) values (pp, 'piano') returning id into pq;
  perform growup_test.ok((select fase = 'piano' from public.persone where id = pp), 'il piano porta la persona a Piano');
  insert into public.passi (persona_id, tipo, esito) values (pp, 'chiusura', 'cliente');
  perform growup_test.ok((select esito = 'cliente' from public.persone where id = pp), 'chiusura: cliente');
  perform growup_test.deve_fallire(format('insert into public.passi (persona_id, tipo) values (%L, ''chiusura'')', pp), 'una chiusura senza esito è rifiutata');
  perform growup_test.deve_fallire(format('update public.persone set fase = ''followup'' where id = %L', pp), 'la fase non si scrive a mano');
  insert into public.passi (persona_id, tipo, data, importato) values (pp, 'contatto', date '2020-01-15', true);
  execute 'reset role';
  perform growup_test.ok((select count(*) from public.activities where partner_id = b) = att_prima + 3
                         and exists (select 1 from public.activities where partner_id = b and tipo = 'cliente'),
                         'contatto, piano e cliente contati da soli (non il passo importato)');
  perform growup_test.come(u3);
  insert into public.passi (persona_id, tipo) values (pp, 'riapri');
  perform growup_test.ok((select esito is null from public.persone where id = pp), 'Riapri il percorso');
  update public.persone set nascosta_io = true where id = pp;
  perform growup_test.ok((select nascosta_io from public.persone where id = pp), 'B toglie una persona da Io');
  delete from public.passi where id = pq;
  perform growup_test.ok((select fase = 'contattato' from public.persone where id = pp), 'togliendo il piano la fase torna indietro');
  execute 'reset role';
  perform growup_test.ok((select count(*) from public.activities where partner_id = b) = att_prima + 2, 'togliendo il passo si toglie anche l''attività contata');
  perform growup_test.come(u2);  -- A, sponsor di B
  perform growup_test.ok((select count(*) from public.persone) = 0 and (select count(*) from public.passi) = 0, 'lo sponsor non vede i nomi della lista di B');
  perform growup_test.ok(growup_test.righe(format('update public.persone set nome = ''X'' where id = %L', pp)) = 0, 'lo sponsor non modifica la lista di B');
  perform growup_test.ok(growup_test.righe(format('update public.persone set nascosta_io = true where id = %L', pp)) = 0, 'lo sponsor non nasconde i nomi di B da Io');
  perform growup_test.deve_fallire(format('insert into public.passi (persona_id, tipo) values (%L, ''nota'')', pp), 'lo sponsor non segna passi sulla lista di B');
  perform growup_test.ok((public.numeri_persone(b)->>'totale')::int = 1 and (public.numeri_persone(b)->>'in_corso')::int = 1,
                         'lo sponsor vede solo i numeri della lista di B');
  perform growup_test.come(u1);  -- R, admin
  perform growup_test.ok((select count(*) from public.persone) = 0, 'neanche l''admin vede i nomi');
  perform growup_test.come(u4);  -- C, altra linea
  perform growup_test.deve_fallire(format('select public.numeri_persone(%L)', b), 'un''altra linea non vede neanche i numeri');
  perform growup_test.come(null);
  perform growup_test.deve_fallire('select count(*) from public.persone', 'chi non è entrato non legge la lista');
  perform growup_test.come(u3);
  delete from public.persone where id = pp;
  perform growup_test.ok((select count(*) from public.passi) = 0, 'cancellando un nome spariscono i suoi passi');
  execute 'reset role';
  perform growup_test.ok((select count(*) from public.activities where partner_id = b) = att_prima + 2, 'togliendo un nome i numeri già contati restano');

  -- ---- 022: il Target — inviti solo miei, il contatto chiede solo se il link è aperto ----
  perform growup_test.come(u3);  -- B
  insert into public.inviti_target (id, nome, scade) values ('ABC234', 'Contatto Prova', current_date + 14);
  perform growup_test.ok((select proprietario = b and risposte is null from public.inviti_target where id = 'ABC234'), 'B crea un invito Target');
  perform growup_test.come(null);
  perform growup_test.ok(public.invito_target_aperto('ABC234') = 'ok', 'il contatto vede che il link è aperto');
  perform growup_test.ok(public.invito_target_aperto('ZZZ999') = 'sconosciuto', 'un link inventato non esiste');
  perform growup_test.deve_fallire('select count(*) from public.inviti_target', 'chi non è entrato non legge gli inviti');
  perform growup_test.come(u2);  -- A, sponsor di B
  perform growup_test.ok((select count(*) from public.inviti_target) = 0, 'lo sponsor non vede gli inviti di B');
  perform growup_test.ok(growup_test.righe('update public.inviti_target set bloccato = true where id = ''ABC234''') = 0, 'lo sponsor non blocca i link di B');
  perform growup_test.come(u3);
  update public.inviti_target set risposte = '{0,0,1,0,2,1,0,2}', versione = '2026-09-14' where id = 'ABC234';
  perform growup_test.ok((select risposto_il is not null from public.inviti_target where id = 'ABC234'), 'le risposte si salvano con la data');
  perform growup_test.deve_fallire('update public.inviti_target set risposte = ''{0,0,3,0,2,1,0,2}'' where id = ''ABC234''', 'risposte fuori scala rifiutate');
  perform growup_test.ok(public.invito_target_aperto('ABC234') = 'usato', 'dopo le risposte il link si chiude');
  insert into public.persone (nome, invito_target_id) values ('Contatto Prova', 'ABC234') returning id into pp;
  update public.inviti_target set persona_id = pp where id = 'ABC234';
  perform growup_test.ok((select persona_id = pp from public.inviti_target where id = 'ABC234'), 'Metti in lista: la persona porta con sé il Target');
  update public.persone set invito_target_id = 'ABC234' where id = pp;
  perform growup_test.ok((select invito_target_id = 'ABC234' from public.persone where id = pp), 'dalla Lista: la persona si collega al suo invito Target');
  insert into public.inviti_target (id, nome) values ('DEF567', 'Altro');
  update public.inviti_target set bloccato = true where id = 'DEF567';
  perform growup_test.ok(public.invito_target_aperto('DEF567') = 'bloccato', 'un link bloccato non si apre');
  delete from public.persone where id = pp;
  delete from public.inviti_target;
  execute 'reset role';

  -- ---- 024: i Clienti — ordini e durate solo miei ----
  perform growup_test.come(u3);  -- B
  insert into public.persone (nome) values ('Cliente Prova') returning id into pp;
  insert into public.passi (persona_id, tipo, esito) values (pp, 'chiusura', 'cliente');
  update public.persone set compleanno = '03-15' where id = pp;
  perform growup_test.deve_fallire(format('update public.persone set compleanno = ''13-40'' where id = %L', pp), 'compleanno non valido rifiutato');
  insert into public.ordini (persona_id, data, modo) values (pp, current_date, 'io') returning id into pq;
  insert into public.righe_ordine (ordine_id, codice, nome, quantita, prezzo) values (pq, '110415', 'Prodotto prova', 2, 30.5);
  insert into public.durate (codice, giorni) values ('110415', 45);
  perform growup_test.ok((select proprietario = b from public.ordini where id = pq)
                         and (select proprietario = b from public.righe_ordine where ordine_id = pq), 'B segna un ordine del suo cliente');
  update public.ordini set pagato = current_date, consegnato = current_date where id = pq;
  update public.persone set codice_cliente = '7000000001' where id = pp;
  insert into public.ordini (persona_id, data, modo, numero_amway, importo, vp) values (pp, current_date - 30, 'sito', '170000001', 45.38, 20.05);
  perform growup_test.deve_fallire(format('insert into public.ordini (persona_id, numero_amway) values (%L, ''170000001'')', pp), 'lo stesso ordine Amway non si importa due volte');
  -- 026: l'ultimo ordine dall'elenco clienti (senza numero) prende numero, valore e VP quando arriva l'export degli ordini
  insert into public.ordini (persona_id, data, modo) values (pp, current_date - 60, 'sito') returning id into pq;
  update public.ordini set numero_amway = '170000002', importo = 30, vp = 12 where id = pq;
  perform growup_test.ok((select numero_amway = '170000002' from public.ordini where id = pq), 'B unisce l''ultimo ordine all''ordine Amway');
  perform growup_test.deve_fallire(format('update public.ordini set numero_amway = ''170000001'' where id = %L', pq), 'due ordini non possono avere lo stesso numero Amway');
  perform growup_test.come(u2);  -- A, sponsor di B
  perform growup_test.ok((select count(*) from public.ordini) = 0 and (select count(*) from public.righe_ordine) = 0
                         and (select count(*) from public.durate) = 0, 'lo sponsor non vede ordini e durate di B');
  perform growup_test.deve_fallire(format('insert into public.ordini (persona_id) values (%L)', pp), 'lo sponsor non segna ordini sui clienti di B');
  perform growup_test.deve_fallire(format('insert into public.righe_ordine (ordine_id, codice, nome) values (%L, ''1'', ''x'')', pq), 'né righe sugli ordini di B');
  perform growup_test.ok((public.numeri_persone(b)->>'clienti')::int = 1, 'lo sponsor vede quanti clienti ha B');
  perform growup_test.ok((public.numeri_persone(b)->>'clienti_mese')::int = 1 and (public.numeri_persone(b)->>'partner_mese')::int = 0,
                         '029: i sì del mese divisi in nuovi clienti e nuovi partner');
  update public.ordini set vp = 99, numero_amway = '170000009';
  perform growup_test.come(u3);
  perform growup_test.ok((select count(*) from public.ordini where vp = 99 or numero_amway = '170000009') = 0, 'lo sponsor non cambia gli ordini di B');
  delete from public.persone where id = pp;
  perform growup_test.ok((select count(*) from public.ordini) = 0 and (select count(*) from public.righe_ordine) = 0, 'togliendo il cliente spariscono i suoi ordini');
  delete from public.durate;
  execute 'reset role';

  -- ---- 027: da confermare, togli dalla struttura, blocco dell'app ----
  execute 'reset role';
  insert into auth.users (id, aud, role) values ('00000000-0000-0000-0000-0000000000d1', 'authenticated', 'authenticated'),
    ('00000000-0000-0000-0000-0000000000d2', 'authenticated', 'authenticated');
  perform growup_test.come('00000000-0000-0000-0000-0000000000d1');
  g := (public.entra_con_invito(growup_test.invito(a, 'Zeta Test', '2000077'))->'profilo'->>'id')::uuid;
  perform growup_test.ok(public.stato_accesso() is null, 'chi è appena entrato ha l''accesso');
  execute 'reset role';
  perform growup_test.come('00000000-0000-0000-0000-0000000000d2');
  h := (public.entra_con_invito(growup_test.invito(g, 'Ypsilon Test', '2000078'))->'profilo'->>'id')::uuid;
  perform growup_test.come(u2);  -- A, sponsor di Z
  perform growup_test.ok(exists (select 1 from public.in_attesa() where id = g and mio) and not exists (select 1 from public.accessi_struttura() where id = g),
                         '033: Z è in attesa della mappa (solo il nome per lo sponsor)');
  perform growup_test.deve_fallire(format('select public.togli_dalla_struttura(%L)', h), '033: l''upline non toglie Y (lo toglie solo il suo sponsor Z)');
  perform growup_test.deve_fallire('select public.salva_numeri_report(null, null, current_date, ''{}'')', 'nessuno conferma a mano dall''app');
  perform growup_test.come(u3);  -- B, di lato
  perform growup_test.deve_fallire(format('select public.togli_dalla_struttura(%L)', g), 'chi è di lato non toglie');
  perform growup_test.come('00000000-0000-0000-0000-0000000000d2');  -- Y, sotto Z
  perform growup_test.deve_fallire(format('select public.togli_dalla_struttura(%L)', g), 'chi sta sotto non toglie il suo sponsor');
  perform growup_test.come(u2);
  perform public.togli_dalla_struttura(g);
  execute 'reset role';
  perform growup_test.ok(not exists (select 1 from public.partners where id = g) and (select sponsor_id from public.partners where id = h) = a,
                         'lo sponsor toglie Z: chi aveva invitato passa sotto lo sponsor');
  perform growup_test.come('00000000-0000-0000-0000-0000000000d1');
  perform growup_test.ok(public.collega_profilo() is null and public.stato_accesso() = 'tolto', 'il telefono di Z: accesso tolto');
  perform growup_test.deve_fallire(format('select public.entra_con_invito(%L)', growup_test.invito(a, 'Zeta Test', '2000077')),
                                   'il codice tolto non rientra');
  perform growup_test.come(u2);
  perform growup_test.deve_fallire('select * from public.codici_tolti_elenco()', 'solo l''admin vede i codici tolti');
  perform growup_test.deve_fallire('select public.sblocca_codice(''2000077'')', 'solo l''admin sblocca un codice');
  perform growup_test.come(u1);  -- R admin
  perform growup_test.ok(exists (select 1 from public.codici_tolti_elenco() where codice_amway = '2000077'), 'l''admin vede il codice tolto');
  perform public.sblocca_codice('2000077');
  perform growup_test.come('00000000-0000-0000-0000-0000000000d1');
  g := (public.entra_con_invito(growup_test.invito(a, 'Zeta Test', '2000077'))->'profilo'->>'id')::uuid;
  perform growup_test.ok(g is not null, 'sbloccato il codice, Z rientra');
  -- confermato dal report: non si toglie più
  execute 'reset role';
  perform public.salva_numeri_report(a, g, current_date, '{}');
  perform growup_test.come(u2);
  perform growup_test.ok((select confermato_il is not null from public.accessi_struttura() where id = g), 'il report conferma Z');
  perform growup_test.deve_fallire(format('select public.togli_dalla_struttura(%L)', g), 'confermato: non si toglie più');
  perform growup_test.come(u1);
  perform public.togli_dalla_struttura(h);
  perform growup_test.ok(not exists (select 1 from public.partners where id = h), 'l''admin toglie chi è da confermare');
  perform growup_test.deve_fallire(format('select public.togli_dalla_struttura(%L)', r), 'nessuno toglie un admin');
  -- il blocco dell'app: solo admin
  perform growup_test.come(u2);
  perform growup_test.deve_fallire(format('select public.blocca_app(%L, true)', b), 'solo l''admin blocca');
  perform growup_test.come(u1);
  perform growup_test.deve_fallire(format('select public.blocca_app(%L, true)', r), 'l''admin non blocca sé stesso');
  perform public.blocca_app(b, true);
  perform growup_test.come(u3);  -- B bloccato
  perform growup_test.ok(public.collega_profilo() is null and public.stato_accesso() = 'bloccato', 'B bloccato: niente profilo, accesso sospeso');
  perform growup_test.ok((select count(*) from public.partners) = 0 and (select count(*) from public.activities) = 0, 'B bloccato non vede niente');
  perform growup_test.deve_fallire(format('insert into public.activities (partner_id, tipo) values (%L, ''contatto'')', b), 'B bloccato non scrive');
  perform growup_test.come(u2);  -- A, sponsor di B
  perform growup_test.ok((select bloccato_il is not null from public.accessi_struttura() where id = b), 'lo sponsor vede che B è bloccato');
  perform growup_test.come(u1);
  perform public.blocca_app(b, false);
  perform growup_test.come(u3);
  perform growup_test.ok((public.collega_profilo()->>'id')::uuid = b, 'sbloccato: B ritrova il suo profilo');
  execute 'reset role';

  -- ---- 028: il listino: lo leggono solo gli utenti dell'app, lo scrive solo l'admin ----
  perform growup_test.come(null);
  perform growup_test.deve_fallire('select * from public.listino', 'anon non legge il listino');
  perform growup_test.come(u7);
  execute 'reset role';
  insert into auth.users (id, aud, role) values ('00000000-0000-0000-0000-0000000000e1', 'authenticated', 'authenticated');
  perform growup_test.come('00000000-0000-0000-0000-0000000000e1');
  perform growup_test.ok((select count(*) from public.listino) = 0, 'un telefono non collegato non legge il listino');
  perform growup_test.come(u1);  -- R admin
  insert into public.listino (codice, nome, formato, prezzo_cliente, prezzo_partner, vp) values ('900001', 'Prodotto prova', '1 pz', 10, 8.33, 3.5);
  update public.listino set prezzo_cliente = 11 where codice = '900001';
  -- come fa l'app: inserisci o aggiorna (upsert) su tutte le colonne
  insert into public.listino (codice, nome, formato, categoria, prezzo_cliente, prezzo_partner, vp, attivo)
  values ('900001', 'Prodotto prova', '1 pz', null, 11, 9.17, 3.6, true)
  on conflict (codice) do update set codice = excluded.codice, nome = excluded.nome, formato = excluded.formato, categoria = excluded.categoria,
    prezzo_cliente = excluded.prezzo_cliente, prezzo_partner = excluded.prezzo_partner, vp = excluded.vp, attivo = excluded.attivo;
  perform growup_test.ok((select vp from public.listino where codice = '900001') = 3.6, 'l''admin aggiorna il listino come fa l''app (upsert)');
  perform growup_test.ok((select prezzo_cliente from public.listino where codice = '900001') = 11, 'l''admin scrive il listino');
  perform growup_test.deve_fallire('delete from public.listino', 'il listino non si cancella (si mette non attivo)');
  perform growup_test.come(u2);  -- A
  perform growup_test.ok((select count(*) from public.listino where codice = '900001') = 1, 'chi usa l''app legge il listino');
  perform growup_test.deve_fallire($q$insert into public.listino (codice, nome) values ('900002', 'x')$q$, 'chi non è admin non aggiunge prodotti');
  update public.listino set prezzo_cliente = 0 where codice = '900001';
  perform growup_test.deve_fallire($q$insert into public.listino (codice, nome) values ('900001', 'x') on conflict (codice) do update set nome = excluded.nome$q$, 'chi non è admin non fa upsert sul listino');
  execute 'reset role';
  perform growup_test.ok((select prezzo_cliente from public.listino where codice = '900001') = 11, 'chi non è admin non cambia i prezzi');
  update public.partners set bloccato_il = now() where id = b;
  perform growup_test.come(u3);  -- B bloccato
  perform growup_test.ok((select count(*) from public.listino) = 0, 'chi è bloccato non legge il listino');
  execute 'reset role';
  update public.partners set bloccato_il = null where id = b;
  delete from public.listino where codice = '900001';

  -- ---- 030: le qualifiche oltre Argento e la prossima qualifica ----
  perform growup_test.come(u3);  -- B
  perform growup_test.deve_fallire($q$select public.imposta_prossima_qualifica('smeraldo')$q$, 'sotto Platino non si sceglie la prossima qualifica');
  perform public.modifica_partenza('platino');
  perform growup_test.deve_fallire($q$select public.imposta_prossima_qualifica('oro')$q$, 'la prossima qualifica deve stare sopra la propria');
  perform growup_test.ok(public.imposta_prossima_qualifica('smeraldo')->>'prossima_qualifica' = 'smeraldo', 'B (Platino) sceglie Smeraldo');
  perform growup_test.deve_fallire(format('update public.partners set prossima_qualifica = %L where id = %L', 'diamante', a),
                         'la prossima qualifica non si scrive direttamente (solo dalla funzione, solo la propria)');
  perform growup_test.come(u2);  -- A, sponsor di B
  perform growup_test.ok((select prossima_qualifica from public.prossime_qualifiche() where partner_id = b) = 'smeraldo', 'lo sponsor vede la prossima qualifica di B');
  perform growup_test.come(u1);  -- R, upline
  perform growup_test.ok((select prossima_qualifica from public.prossime_qualifiche() where partner_id = b) = 'smeraldo', 'l''upline la vede');
  perform growup_test.come(u4);  -- C, altra linea
  perform growup_test.ok(not exists (select 1 from public.prossime_qualifiche() where partner_id = b), 'chi è in un''altra linea non la vede');
  perform growup_test.come(u3);  -- B scende a Oro: la prossima qualifica si toglie
  perform growup_test.ok(public.modifica_partenza('oro')->>'prossima_qualifica' is null, 'scendendo sotto Platino la prossima qualifica si toglie');
  perform public.modifica_partenza('path_to_bronze');
  execute 'reset role';

  -- ---- 031: i mesi da Argento, anche dai report dei mesi passati (solo numeri) ----
  mese_prec := (date_trunc('month', (now() at time zone 'Europe/Rome')::date) - interval '2 months')::date;
  perform growup_test.come(u2);  -- A
  perform growup_test.ok(public.salva_report_passato(mese_prec, '{"codice":"2000001","vpp":120,"vpg":10500,"percentuale":21,"linee":[]}',
    '[{"codice":"2000002","vpp":50,"vpg":300,"percentuale":9},{"codice":"2000003","vpg":900,"percentuale":12}]') = 2,
    'report passato: salvati i numeri miei e di chi vedo (C, in un''altra linea, no)');
  perform growup_test.ok((select percentuale from public.mesi_report(a) where mese = mese_prec) = 21, 'A legge il suo mese al 21%');
  perform growup_test.ok((select count(*) from public.mesi_report(b)) >= 1, 'A legge i mesi di B (sua downline)');
  perform growup_test.deve_fallire(format('select * from public.mesi_report(%L)', c), 'A non legge i mesi di C (altra linea)');
  perform growup_test.deve_fallire($q$select public.salva_report_passato(current_date, '{"codice":"2000001"}', '[]')$q$, 'il mese in corso non è un report passato');
  perform growup_test.deve_fallire(format($q$select public.salva_report_passato(%L, '{"codice":"1000000"}', '[]')$q$, mese_prec), 'il report di un altro non si salva');
  perform growup_test.come(u1);  -- R
  perform growup_test.ok(exists (select 1 from public.mesi_report(b) where mese = mese_prec), '033: i numeri importati da A li vede anche R (upline)');
  perform growup_test.come(null);
  perform growup_test.deve_fallire(format('select * from public.mesi_report(%L)', a), 'anon non legge i mesi');
  execute 'reset role';
  perform growup_test.ok((select sponsor_id from public.partners where id = b) = a, 'il report passato non sposta nessuno');
  delete from public.numeri_mese where mese = mese_prec;

  -- ---- 033: l'import della mappa aggiorna tutto il gruppo; vince il report più aggiornato ----
  perform growup_test.come(u1);  -- R, report di ieri: Fabio sotto B
  perform public.importa_mappa(current_date, now() - interval '1 day', '{"codice":"1000000","vpp":120,"vpg":470}',
    '[{"codice":"2000001","nome":"Anna","sponsor":"1000000"},{"codice":"2000002","nome":"Bruno","sponsor":"2000001"},
      {"codice":"3000002","nome":"Fabio","sponsor":"2000002","vpp":80,"vpg":500,"percentuale":3}]', '{}', '{}');
  execute 'reset role';
  perform growup_test.ok((select sponsor_id from public.partners where codice_amway = '3000002') = b, '033: il report più recente sposta Fabio sotto B');
  perform growup_test.come(u1);  -- R, un file dello stesso mese scaricato prima: 046, decide il mese, non la data del file
  perform growup_test.ok((public.importa_mappa(current_date, now() - interval '2 days', '{"codice":"1000000","vpp":100,"vpg":400}',
    '[{"codice":"3000002","nome":"Fabio","sponsor":"1000000","vpp":10,"vpg":300,"percentuale":3}]', '{}', '{}')->>'aggiornati')::int = 2,
    '046: una mappa dello stesso mese sostituisce sempre i numeri');
  execute 'reset role';
  perform growup_test.ok((select sponsor_id from public.partners where codice_amway = '3000002') = r
                         and (select vpg from public.numeri_mese where partner_id = (select id from public.partners where codice_amway = '3000002')
                                and mese = date_trunc('month', current_date)::date) = 300, '046: e sostituisce la struttura (Fabio sotto R)');
  perform growup_test.come(u1);  -- una mappa di un mese precedente non tocca la struttura: si salva solo come numeri
  perform growup_test.deve_fallire($q$select public.importa_mappa((current_date - interval '1 month')::date, now(), '{"codice":"1000000","vpp":1,"vpg":1}',
    '[{"codice":"3000002","nome":"Fabio","sponsor":"2000001","vpp":1,"vpg":1}]', '{}', '{}')$q$, '046: la mappa di un mese precedente non rifà la struttura');
  perform growup_test.deve_fallire($q$select public.importa_mappa((current_date + interval '1 month')::date, now(), '{"codice":"1000000","vpp":1,"vpg":1}',
    '[]', '{}', '{}')$q$, '046: una mappa di un mese futuro è rifiutata (bloccherebbe le mappe vere)');
  perform growup_test.deve_fallire($q$select public.importa_mappa((current_date - interval '30 months')::date, now(), '{"codice":"1000000","vpp":1,"vpg":1}',
    '[]', '{}', '{}')$q$, '046: una mappa più vecchia di 24 mesi è rifiutata');
  execute 'reset role';
  perform growup_test.ok((select mappa_mese from public.partners where id = r) = date_trunc('month', current_date)::date
                         and (select mappa_mese from public.partners where codice_amway = '3000002') = date_trunc('month', current_date)::date,
                         '046: il mese della mappa è segnato per chi importa e per le persone');
  perform growup_test.come(u1);  -- R rimette Fabio sotto B, come nel file più recente
  perform public.importa_mappa(current_date, now(), '{"codice":"1000000","vpp":120,"vpg":470}',
    '[{"codice":"2000001","nome":"Anna","sponsor":"1000000"},{"codice":"2000002","nome":"Bruno","sponsor":"2000001"},
      {"codice":"3000002","nome":"Fabio","sponsor":"2000002","vpp":80,"vpg":500,"percentuale":3}]', '{}', '{}');
  execute 'reset role';
  perform growup_test.come(u3);  -- B importa adesso il suo report: lo vede tutta la sua upline
  perform public.importa_mappa(current_date, now(), '{"codice":"2000002","vpp":90,"vpg":1000}',
    '[{"codice":"3000002","nome":"Fabio","sponsor":"2000002","vpp":80,"vpg":777,"percentuale":6}]', '{}', '{}');
  perform growup_test.come(u5);  -- A, upline di B
  perform growup_test.ok((select vpg from public.numeri_mese where partner_id = (select id from public.partners where codice_amway = '3000002')
                           and mese = date_trunc('month', current_date)::date) = 777, '033: A vede i numeri importati da B (sotto di lei)');
  perform growup_test.ok((select vp_personali from public.riepilogo_mese(current_date) where partner_id = b) = 90,
                         '033: il VPP del report vince sugli ordini scritti nell''app');
  perform growup_test.come(u4);  -- C, altra linea: non vede
  perform growup_test.ok(not exists (select 1 from public.numeri_mese where partner_id = b), '033: un''altra linea non vede i numeri di B');
  execute 'reset role';

  -- ---- 034: gli ordini a mano di chi ha l'app li vede solo lui; per lui contano solo quelli dopo il report ----
  perform growup_test.come(u3);  -- B: i 150 VP scritti prima del report sono già dentro il report (90)
  perform growup_test.ok((select vp_personali from public.riepilogo_mese(current_date) where partner_id = b) = 90,
                         '034: per B gli ordini scritti prima del report non si sommano');
  execute 'reset role';
  update public.numeri_mese set dati_al = now() - interval '1 hour' where partner_id = b and mese = date_trunc('month', current_date)::date;
  perform growup_test.come(u3);  -- B scrive un ordine dopo il file del report (i 150 di prima li aveva scritti un altro)
  insert into public.activities (partner_id, tipo, vp) values (b, 'ordine', 60);
  select * into x from public.riepilogo_mese(current_date) where partner_id = b;
  perform growup_test.ok(x.vp_personali = 150 and x.vp_gruppo = 1060, '034: B vede report + i suoi ordini dopo il report (' || x.vp_personali || ', ' || x.vp_gruppo || ')');
  perform growup_test.ok(exists (select 1 from public.activities where partner_id = b and tipo = 'ordine'), '034: B legge i suoi ordini');
  perform growup_test.come(u5);  -- A, sponsor di B: solo il report
  select * into x from public.riepilogo_mese(current_date) where partner_id = b;
  perform growup_test.ok(x.vp_personali = 90 and x.vp_gruppo = 1000, '034: lo sponsor vede di B solo il report (' || x.vp_personali || ')');
  perform growup_test.ok(not exists (select 1 from public.activities where partner_id = b and tipo in ('ordine', 'rettifica')),
                         '034: lo sponsor non legge gli ordini a mano di B');
  perform growup_test.ok(exists (select 1 from public.activities where partner_id = b and tipo = 'piano'), '034: lo sponsor legge ancora i piani di B');
  execute 'reset role';
  pq := (select id from public.partners where codice_amway = '3000002');  -- Fabio, sotto B, non ha l'app
  insert into public.activities (partner_id, tipo, vp) values (pq, 'ordine', 25);
  perform growup_test.come(u1);  -- R: gli ordini di chi non ha l'app restano visibili alla upline
  perform growup_test.ok(exists (select 1 from public.activities where partner_id = pq and tipo = 'ordine' and vp = 25),
                         '034: l''upline legge gli ordini di chi non ha l''app');
  perform growup_test.ok(not exists (select 1 from public.activities where partner_id in (a, b) and tipo in ('ordine', 'rettifica')),
                         '034: l''upline non legge gli ordini a mano di chi ha l''app');
  execute 'reset role';
  update public.numeri_mese set dati_al = now() where partner_id = b and mese = date_trunc('month', current_date)::date;
  perform growup_test.come(u3);  -- B: un report nuovo assorbe gli ordini scritti prima
  perform growup_test.ok((select vp_personali from public.riepilogo_mese(current_date) where partner_id = b) = 90,
                         '034: con un report più nuovo il totale torna al dato del report');

  -- ---- 034: la bozza d'ordine e lo storico, solo miei ----
  insert into public.ordini_personali default values returning id into pp;
  insert into public.righe_ordine_personale (ordine_id, codice, nome, quantita, vp, prezzo_partner, prezzo_cliente)
    values (pp, '1001', 'Prodotto uno', 2, 10.5, 20, 26), (pp, '1002', 'Prodotto due', 1, 4, 9, 12);
  perform growup_test.deve_fallire('insert into public.ordini_personali default values', '034: una sola bozza aperta');
  perform growup_test.deve_fallire(format($q$insert into public.ordini_personali (proprietario) values (%L)$q$, a), '034: la bozza è solo mia');
  perform growup_test.deve_fallire(format($q$update public.ordini_personali set stato = 'confermato' where id = %L$q$, pp),
                                   '034: la bozza si conferma solo dalla funzione');
  perform growup_test.come(u5);  -- A
  perform growup_test.ok(not exists (select 1 from public.ordini_personali) and not exists (select 1 from public.righe_ordine_personale),
                         '034: lo sponsor non vede la bozza di B');
  perform growup_test.deve_fallire(format('select public.conferma_ordine(%L, null)', pp), '034: A non conferma la bozza di B');
  perform growup_test.ok(growup_test.righe(format('delete from public.ordini_personali where id = %L', pp)) = 0, '034: A non toglie la bozza di B');
  perform growup_test.come(null);
  perform growup_test.deve_fallire('select count(*) from public.ordini_personali', '034: anon non legge gli ordini');
  perform growup_test.deve_fallire(format('select public.conferma_ordine(%L, null)', pp), '034: anon non conferma');
  perform growup_test.come(u3);  -- B conferma: 25 VP nel mese, l'ordine passa nello storico
  att_prima := (select count(*) from public.activities where partner_id = b and tipo = 'ordine');
  perform growup_test.ok((public.conferma_ordine(pp, null)->>'vp')::numeric = 25, '034: confermando, il totale VP dell''ordine');
  perform growup_test.ok((select count(*) from public.activities where partner_id = b and tipo = 'ordine') = att_prima + 1
                         and exists (select 1 from public.ordini_personali where id = pp and stato = 'confermato' and attivita_id is not null),
                         '034: l''ordine confermato diventa un ordine del mese, collegato allo storico');
  perform growup_test.deve_fallire(format('select public.conferma_ordine(%L, null)', pp), '034: un ordine si conferma una volta sola');
  perform growup_test.deve_fallire(format($q$insert into public.righe_ordine_personale (ordine_id, codice, nome) values (%L, '1003', 'Tre')$q$, pp),
                                   '034: un ordine confermato non si cambia');
  perform growup_test.ok(growup_test.righe(format('update public.righe_ordine_personale set quantita = 5 where ordine_id = %L', pp)) = 0,
                         '034: le righe di un ordine confermato restano come sono');
  insert into public.ordini_personali default values returning id into pq;
  perform growup_test.deve_fallire(format('select public.conferma_ordine(%L, null)', pq), '034: una bozza vuota non si conferma');
  perform growup_test.ok(growup_test.righe(format('delete from public.activities where id = (select attivita_id from public.ordini_personali where id = %L)', pp)) = 1,
                         '034: B toglie l''ordine del mese collegato al suo ordine');
  att_prima := growup_test.righe(format('delete from public.ordini_personali where id = %L', pp));
  perform growup_test.ok(att_prima = 1
                         and not exists (select 1 from public.righe_ordine_personale where ordine_id = pp),
                         '034: B toglie il suo ordine dallo storico, con le sue righe');
  execute 'reset role';

  -- ---- 035: la Guida (tabella Stabilità e abitudini) ----
  execute 'reset role';
  insert into auth.users (id, aud, role) values ('00000000-0000-0000-0000-0000000000f7', 'authenticated', 'authenticated');
  perform growup_test.come(u5);  -- A: i suoi nuovi iscritti prima
  att_prima := (public.guida_conteggi(current_date)->>'personali')::int;
  k_a2 := growup_test.invito(a, 'Nuovo Guida', '8000001');
  perform growup_test.come('00000000-0000-0000-0000-0000000000f7');
  perform public.entra_con_invito(k_a2);
  perform growup_test.come(u5);
  perform growup_test.ok((public.guida_conteggi(current_date)->>'personali')::int = att_prima + 1, '035: chi entra con il link di A conta tra i suoi nuovi iscritti');
  execute 'reset role';
  update public.partners set sponsor_id = b where codice_amway = '8000001';  -- l'import lo sposta in profondità
  perform growup_test.come(u5);
  perform growup_test.ok((public.guida_conteggi(current_date)->>'personali')::int = att_prima + 1, '035: resta di A anche se va in profondità');
  perform growup_test.come(u3);  -- B non lo conta come suo
  perform growup_test.ok((public.guida_conteggi(current_date)->>'personali')::int = 0, '035: per B non è un nuovo iscritto personale');
  -- nuovi nel gruppo: il primo import non conta, dal secondo sì
  execute 'reset role';
  update public.partners set primo_import_il = null where id = r;
  perform growup_test.come(u1);  -- R
  att_prima := (public.guida_conteggi(current_date)->>'nuovi_gruppo')::int;
  perform public.importa_mappa(current_date, now(), '{"codice":"1000000","vpp":120,"vpg":470}',
    '[{"codice":"8100001","nome":"Primo Import","sponsor":"2000001","vpp":250,"vpg":250}]', '{}', '{}');
  perform growup_test.ok((public.guida_conteggi(current_date)->>'nuovi_gruppo')::int = att_prima, '035: il primo import non porta nuovi codici');
  execute 'reset role';
  perform growup_test.ok((select primo_import_il from public.partners where id = r) is not null, '035: il primo import di R è segnato');
  update public.partners set primo_import_il = now() - interval '1 day' where id = r;
  perform growup_test.come(u1);
  pp := null;
  att_prima := (public.guida_conteggi(current_date)->>'oltre_200')::int;
  perform public.importa_mappa(current_date, now(), '{"codice":"1000000","vpp":120,"vpg":470}',
    '[{"codice":"8100002","nome":"Secondo Import","sponsor":"2000001","vpp":300,"vpg":300}]', '{}', '{}');
  perform growup_test.ok((public.guida_conteggi(current_date)->>'nuovi_gruppo')::int = 1, '035: dal secondo import il codice nuovo conta nel gruppo');
  perform growup_test.ok((public.guida_conteggi(current_date)->>'oltre_200')::int = att_prima + 1, '035: i codici del gruppo oltre 200 VP');
  perform growup_test.ok((public.guida_conteggi(current_date)->>'con_mappa')::boolean
                         and not (public.guida_conteggi((current_date - interval '5 years')::date)->>'con_mappa')::boolean,
                         '044: i conteggi dicono se per il mese c''è una mappa importata');
  perform growup_test.come(u4);  -- C, altra linea
  perform growup_test.ok((public.guida_conteggi(current_date)->>'nuovi_gruppo')::int = 0, '035: un''altra linea non vede i nuovi codici di R');
  perform growup_test.come(null);
  perform growup_test.deve_fallire('select public.guida_conteggi(current_date)', '035: anon non legge i conteggi');
  -- numeri scritti e abitudini: solo miei
  perform growup_test.come(u5);  -- A
  insert into public.numeri_cl21 (app_cl21, training_day, convention) values (9, 10, 12);
  insert into public.guida_obiettivi (chiave, a_settimana) values ('formazione', 5);
  insert into public.guida_fatti (chiave, giorno) values ('formazione', current_date);
  perform growup_test.deve_fallire($q$insert into public.guida_fatti (chiave, giorno) values ('formazione', current_date + 2)$q$, '035: non si spunta un giorno futuro');
  perform growup_test.deve_fallire(format($q$insert into public.numeri_cl21 (partner_id, app_cl21) values (%L, 1)$q$, b), '035: i numeri di B non li scrive A');
  perform growup_test.come(u1);  -- R, upline di A
  perform growup_test.ok(not exists (select 1 from public.numeri_cl21) and not exists (select 1 from public.guida_obiettivi)
                         and not exists (select 1 from public.guida_fatti), '035: l''upline non vede numeri e abitudini di A');
  perform growup_test.come(null);
  perform growup_test.deve_fallire('select count(*) from public.guida_fatti', '035: anon non legge le abitudini');
  execute 'reset role';
  perform growup_test.deve_fallire('select public.partners_guida()', '035: la funzione del trigger non si chiama da fuori');

  -- ---- 036: Seguimi giorno per giorno: i numeri all'upline solo se il partner lo sceglie ----
  perform growup_test.come(u3);  -- B attiva il Seguimi, senza condividere
  insert into public.seguimi (attivo, condividi) values (true, false);
  insert into public.seguimi_giorni (giorno, azioni, proposte, fatte, per_tipo)
    values (current_date, '[{"tipo":"contatto","id":"x"}]', 5, 3, '{"contatti":2,"crescita":1}');
  perform growup_test.deve_fallire($q$insert into public.seguimi_giorni (giorno, proposte, fatte) values (current_date + 1, 1, 0)$q$, '036: non si scrive un giorno futuro');
  perform growup_test.come(u5);  -- A, sponsor di B
  perform growup_test.ok(not exists (select 1 from public.seguimi) and not exists (select 1 from public.seguimi_giorni), '036: lo sponsor non legge le tabelle del Seguimi di B');
  perform growup_test.ok(not exists (select 1 from public.seguimi_di(b)), '036: senza condividere lo sponsor non vede niente');
  perform growup_test.come(u3);
  update public.seguimi set condividi = true;
  perform growup_test.come(u5);
  select * into x from public.seguimi_di(b);
  perform growup_test.ok(x.proposte = 5 and x.fatte = 3 and (x.per_tipo->>'contatti')::int = 2, '036: condividendo, lo sponsor vede solo i numeri');
  perform growup_test.come(u1);  -- R, upline
  perform growup_test.ok(exists (select 1 from public.seguimi_di(b)), '036: anche l''upline vede i numeri');
  perform growup_test.come(u4);  -- C, altra linea
  perform growup_test.ok(not exists (select 1 from public.seguimi_di(b)), '036: un''altra linea non vede niente');
  perform growup_test.come(u3);
  update public.seguimi set attivo = false;
  perform growup_test.come(u5);
  perform growup_test.ok(not exists (select 1 from public.seguimi_di(b)), '036: Seguimi spento: lo sponsor non vede niente');
  perform growup_test.deve_fallire(format($q$insert into public.seguimi (partner_id, attivo) values (%L, true)$q$, b), '036: A non attiva il Seguimi di B');
  perform growup_test.come(null);
  perform growup_test.deve_fallire(format('select * from public.seguimi_di(%L)', b), '036: anon non legge');
  execute 'reset role';

  -- ---- 037: Analisi della persona e un solo interruttore per condividere ----
  perform growup_test.come(u5);  -- A, sponsor di B
  perform growup_test.ok((select count(*) from public.analisi_persona(b))
                         = (select count(*) from generate_series(public.inizio_py(current_date), date_trunc('month', current_date)::date, interval '1 month')),
                         '037: lo sponsor apre l''analisi di B: un rigo per mese dell''anno fiscale');
  perform growup_test.ok((select vpg from public.analisi_persona(b) where mese = date_trunc('month', current_date)::date) = 1000,
                         '037: l''analisi usa i numeri ufficiali del report');
  perform growup_test.come(u3);  -- B, la sua
  perform growup_test.ok(exists (select 1 from public.analisi_persona(b)), '037: B apre la sua analisi');
  perform growup_test.come(u4);  -- C, altra linea
  perform growup_test.deve_fallire(format('select * from public.analisi_persona(%L)', b), '037: un''altra linea non apre l''analisi di B');
  perform growup_test.come(null);
  perform growup_test.deve_fallire(format('select * from public.analisi_persona(%L)', b), '037: anon non apre analisi');
  perform growup_test.come(u3);  -- B condivide: con l'interruttore spento l'upline non vede numeri scritti e abitudini
  update public.seguimi set condividi = false;
  insert into public.numeri_cl21 (app_cl21, training_day, convention) values (4, 5, 6);
  perform growup_test.come(u5);
  perform growup_test.ok(public.dati_condivisi(b) is null, '037: senza condividere lo sponsor non vede i numeri scritti di B');
  perform growup_test.come(u3);
  update public.seguimi set condividi = true;
  perform growup_test.come(u5);
  perform growup_test.ok((public.dati_condivisi(b)->'cl21'->>'app_cl21')::int = 4, '037: condividendo, lo sponsor vede i numeri scritti di B');
  perform growup_test.come(u4);
  perform growup_test.ok(public.dati_condivisi(b) is null, '037: un''altra linea non vede i dati condivisi di B');
  perform growup_test.come(null);
  perform growup_test.deve_fallire(format('select public.dati_condivisi(%L)', b), '037: anon non legge i dati condivisi');
  execute 'reset role';

  -- ---- 038: il mese da Argento con una sola linea al 21% (servono 4.000 VP rimanenti) ----
  declare
    m38 date := (date_trunc('month', current_date) - interval '2 months')::date;
    x38 uuid := (select id from public.partners where codice_amway = '3000002');
  begin
    delete from public.numeri_mese where mese = m38 and partner_id in (b, x38);
    insert into public.numeri_mese (partner_id, mese, vpg, percentuale, dati_al)
      values (x38, m38, 9000, 21, now());
    insert into public.numeri_mese (partner_id, mese, vpg, percentuale, linee, dati_al)
      values (b, m38, 12000, 21, '[{"codice":"3000002","vpg":9000}]', now());
    perform growup_test.come(u5);  -- A, sponsor di B
    perform growup_test.ok((select not argento from public.mesi_qualifica(b) where mese = m38),
                           '038: 21% con una linea al 21% e 3.000 VP rimanenti: non è un mese da Argento');
    execute 'reset role';
    update public.numeri_mese set linee = '[{"codice":"3000002","vpg":7000}]' where partner_id = b and mese = m38;
    perform growup_test.come(u5);
    perform growup_test.ok((select argento from public.mesi_qualifica(b) where mese = m38),
                           '038: con 5.000 VP rimanenti il mese è da Argento');
    perform growup_test.come(u4);  -- C, altra linea
    perform growup_test.deve_fallire(format('select * from public.mesi_qualifica(%L)', b), '038: un''altra linea non legge i mesi di B');
    perform growup_test.come(null);
    perform growup_test.deve_fallire(format('select * from public.mesi_qualifica(%L)', b), '038: anon non legge');
    execute 'reset role';
    delete from public.numeri_mese where mese = m38 and partner_id in (b, x38);
  end;

  -- ---- 039: notifiche (telefoni e numeri solo propri; cosa inviare solo per il server) ----
  declare
    oggi39 date := (now() at time zone 'Europe/Rome')::date;
    alle  timestamptz := (oggi39 + time '08:31') at time zone 'Europe/Rome';
    corpo39 text; fuori39 int; dopo39 int;
  begin
    perform growup_test.come(u3);  -- B
    insert into public.notifiche_telefoni (endpoint, p256dh, auth) values ('https://fcm.googleapis.com/fcm/send/prova-b1', 'chiaveB', 'authB');
    insert into public.notifiche_previste (giorno, persone, clienti) values (oggi39, 3, 1);
    perform growup_test.ok((select count(*) from public.notifiche_telefoni) = 1, '039: B vede il suo telefono');
    perform growup_test.deve_fallire(format($q$insert into public.notifiche_previste (giorno, persone) values (%L, 1)$q$, oggi39 + 60),
                                     '039: niente numeri oltre un mese');
    perform growup_test.deve_fallire($q$select * from public.notifiche_inviate$q$, '039: gli invii non si leggono');
    perform growup_test.deve_fallire($q$select * from public.notifiche_chiavi$q$, '039: le chiavi non si leggono');
    perform growup_test.deve_fallire(format('select * from public.notifiche_da_inviare(%L)', alle), '039: cosa inviare: solo il server');
    perform growup_test.ok(public.chiave_pubblica_notifiche() is null, '039: la chiave pubblica si legge (vuota finché non c''è)');
    perform growup_test.come(u4);  -- C, altra linea
    perform growup_test.ok(not exists (select 1 from public.notifiche_telefoni) and not exists (select 1 from public.notifiche_previste),
                           '039: C non vede telefoni e numeri di B');
    perform growup_test.deve_fallire(format($q$insert into public.notifiche_telefoni (partner_id, endpoint, p256dh, auth)
                                     values (%L, 'https://fcm.googleapis.com/fcm/send/prova-x', 'k', 'a')$q$, b), '039: C non iscrive un telefono a nome di B');
    perform growup_test.come(null);
    perform growup_test.deve_fallire($q$select * from public.notifiche_telefoni$q$, '039: anon non legge i telefoni');
    execute 'reset role';
    execute 'set local role service_role';
    corpo39 := (select corpo from public.notifiche_da_inviare(alle) where partner_id = b and chiave like 'mattino-%');
    fuori39 := (select count(*) from public.notifiche_da_inviare(alle + interval '2 hours') where chiave like 'mattino-%');
    perform public.notifiche_segna(b, 'mattino-' || oggi39);
    dopo39 := (select count(*) from public.notifiche_da_inviare(alle) where partner_id = b and chiave like 'mattino-%');
    execute 'reset role';
    perform growup_test.ok(corpo39 like '3 persone da risentire · 1 cliente da sentire%', '039: alle 8:30 il riepilogo di B, senza nomi');
    perform growup_test.ok(fuori39 = 0, '039: fuori dalle 8:30 niente riepilogo');
    perform growup_test.ok(dopo39 = 0, '039: il riepilogo non si manda due volte');
    delete from public.notifiche_telefoni; delete from public.notifiche_previste; delete from public.notifiche_inviate;
  end;

  -- ---- 040: l'ora del prossimo passo e l'avviso 30 minuti prima (senza nomi) ----
  declare
    oggi40 date := (now() at time zone 'Europe/Rome')::date;
    alle10 timestamptz := (oggi40 + time '10:00') at time zone 'Europe/Rome';
    pp uuid; t40 text; c40 text; u40 text; n_prima int; n_dopo int; n_ancora int; c41 text;
  begin
    perform growup_test.come(u3);  -- B
    insert into public.notifiche_telefoni (endpoint, p256dh, auth) values ('https://fcm.googleapis.com/fcm/send/prova-b40', 'chiaveB', 'authB');
    insert into public.persone (nome, prossima_data, prossima_ora) values ('Nome Segreto', oggi40, time '10:30') returning id into pp;
    perform growup_test.ok((select prossima_ora from public.persone where id = pp) = time '10:30', '040: B salva l''ora del prossimo passo');
    perform growup_test.come(u4);  -- C
    perform growup_test.ok(not exists (select 1 from public.persone where id = pp), '040: C non vede la persona di B');
    execute 'reset role';
    execute 'set local role service_role';
    select titolo, corpo, url into t40, c40, u40 from public.notifiche_da_inviare(alle10) where chiave like 'passo-%';
    n_prima := (select count(*) from public.notifiche_da_inviare(alle10 - interval '15 minutes') where chiave like 'passo-%');
    n_dopo := (select count(*) from public.notifiche_da_inviare(alle10 + interval '15 minutes') where chiave like 'passo-%');
    perform public.notifiche_segna(b, 'passo-' || pp || '-' || oggi40 || '-10:30');
    n_ancora := (select count(*) from public.notifiche_da_inviare(alle10) where chiave like 'passo-%');
    execute 'reset role';
    update public.persone set esito = 'cliente' where id = pp;
    delete from public.notifiche_inviate where chiave like 'passo-%';
    execute 'set local role service_role';
    c41 := (select corpo from public.notifiche_da_inviare(alle10) where chiave like 'passo-%');
    execute 'reset role';
    perform growup_test.ok(t40 = 'Growup · alle 10:30' and c40 like 'Hai un passo da fare con una persona della tua Lista%'
                           and u40 = './?persona=' || pp and position('Segreto' in c40) = 0, '040: alle 10:00 l''avviso delle 10:30, senza nome');
    perform growup_test.ok(n_prima = 0 and n_dopo = 0, '040: né 45 minuti prima né 15 minuti prima');
    perform growup_test.ok(n_ancora = 0, '040: l''avviso non si manda due volte');
    perform growup_test.ok(c41 like 'Hai un passo da fare con un tuo cliente%', '040: per un cliente «con un tuo cliente»');
    delete from public.persone where id = pp; delete from public.notifiche_telefoni; delete from public.notifiche_inviate;
  end;

  -- ---- 041: si entra solo con un invito personale ----
  declare
    ua uuid; ub uuid; ur uuid;
    n1 constant uuid := '00000000-0000-0000-0000-0000000009a1';  -- entra con l'invito di A, in attesa
    n2 constant uuid := '00000000-0000-0000-0000-0000000009a2';  -- prova a riusare lo stesso invito
    n3 constant uuid := '00000000-0000-0000-0000-0000000009a3';  -- prende il posto di una persona già nella mappa
    n4 constant uuid := '00000000-0000-0000-0000-0000000009a4';  -- inviti scaduti, annullati, rigenerati
    inv jsonb; inv2 jsonb; na text; n_prima int; n_dopo int; k1 text; k_vecchio text; id1 uuid; id_inv uuid; mappa uuid; z uuid;
  begin
    execute 'reset role';
    insert into auth.users (id, aud, role) values (n1, 'authenticated', 'authenticated'), (n2, 'authenticated', 'authenticated'),
      (n3, 'authenticated', 'authenticated'), (n4, 'authenticated', 'authenticated');
    ua := (select user_id from public.accessi where partner_id = a limit 1);
    ub := (select user_id from public.accessi where partner_id = b limit 1);
    ur := (select user_id from public.accessi where partner_id = r limit 1);
    na := (select btrim(nome) from public.partners where id = a);
    insert into public.partners (nome, sponsor_id, stato, creato_da, codice_amway) values ('Mappa Prova', a, 'gestito', a, '9100009')
    returning id into mappa;
    perform growup_test.ok((select confermato_il is not null from public.partners where id = a)
                           and (select confermato_il is not null from public.partners where id = b), '041: A e B sono nella mappa');

    -- crea l'invito chi è nella mappa: nome e codice restano nel database, nel link solo un codice casuale
    perform growup_test.come(ua);
    inv := public.crea_invito('  Paola Prova ', '91-00001');
    k1 := inv->>'codice';
    perform growup_test.ok(k1 ~ '^[0-9a-f]{32}$', '041: il link ha solo un codice casuale di 32 caratteri');
    perform growup_test.ok((select nome = 'Paola Prova' and codice_amway = '9100001' and scade_il = now() + interval '7 days'
                              from public.inviti where id = (inv->>'id')::uuid), '041: nome e codice salvati, scade dopo 7 giorni');
    perform growup_test.deve_fallire('select codice_hash from public.inviti', '041: l''impronta del link non si legge');
    perform growup_test.deve_fallire($q$insert into public.inviti (codice_hash, creato_da, nome, codice_amway, scade_il)
                                     values ('x', public.my_partner_id(), 'X', '9100099', now() + interval '1 year')$q$,
                                     '041: gli inviti si creano solo con crea_invito');
    perform growup_test.deve_fallire(format($q$update public.inviti set nome = 'Altro', codice_amway = '9100098' where id = %L$q$, inv->>'id'),
                                     '041: nome e codice dell''invito non si cambiano');
    perform growup_test.deve_fallire($q$select public.crea_invito('', '9100003')$q$, '041: serve il nome');
    perform growup_test.deve_fallire($q$select public.crea_invito('X', '12')$q$, '041: serve un codice Amway valido');
    perform growup_test.deve_fallire($q$select public.crea_invito('X', '2000002')$q$, '041: non si invita chi usa già l''app');
    perform growup_test.come(ub);  -- B: «Mappa Prova» è nella mappa ma non sotto B (è sotto A)
    perform growup_test.deve_fallire($q$select public.crea_invito('Mappa Prova', '9100009')$q$,
                                     '041: chi è già nella mappa lo invita solo chi gli sta sopra');
    perform growup_test.ok(not exists (select 1 from public.inviti where id = (inv->>'id')::uuid), '041: B non vede gli inviti di A');
    perform growup_test.deve_fallire(format('select public.annulla_invito(%L)', inv->>'id'), '041: B non annulla l''invito di A');
    perform growup_test.deve_fallire(format('select public.rigenera_invito(%L)', inv->>'id'), '041: B non rigenera l''invito di A');

    -- la pagina d'ingresso: senza accesso vede solo se il link è aperto, e i nomi solo se lo è
    perform growup_test.come(null);
    perform growup_test.ok(public.invito_aperto(k1) - 'qualifiche' = jsonb_build_object('stato', 'ok', 'nome', 'Paola Prova', 'da', na),
                           '041: il link aperto mostra il nome dell''invitato e di chi invita');
    perform growup_test.ok(jsonb_array_length(public.invito_aperto(k1)->'qualifiche') = 19,
                           '043: con l''invito aperto arrivano le qualifiche per la pagina d''ingresso');
    perform growup_test.ok(not (public.invito_aperto(repeat('0', 32)) ? 'qualifiche'), '043: senza un invito aperto niente qualifiche');
    perform growup_test.deve_fallire('select chiave from public.stage_requirements', '043: anon non legge le tappe');
    perform growup_test.ok(public.invito_aperto(upper(k1))->>'stato' = 'ok', '041: il codice vale anche in maiuscolo');
    perform growup_test.ok(public.invito_aperto(repeat('0', 32)) = '{"stato":"sconosciuto"}'::jsonb, '041: un codice inventato non mostra niente');
    perform growup_test.deve_fallire('select * from public.inviti', '041: anon non legge gli inviti');
    perform growup_test.deve_fallire($q$select public.crea_invito('X', '9100004')$q$, '041: anon non crea inviti');
    perform growup_test.deve_fallire(format('select public.entra_con_invito(%L)', k1), '041: senza sessione non si entra');

    -- entra: in attesa sotto chi ha invitato, vede solo sé stesso; chi ha invitato riceve l'avviso
    perform growup_test.come(n1);
    id1 := (public.entra_con_invito(k1, date '2026-10-01')->'profilo'->>'id')::uuid;
    perform growup_test.ok((select count(*) from public.partners) = 1 and public.collega_profilo()->>'nome' = 'Paola Prova',
                           '041: chi entra vede solo sé stesso');
    perform growup_test.deve_fallire($q$select public.crea_invito('X', '9100005')$q$, '041: chi è in attesa non invita');
    perform growup_test.come(n2);
    perform growup_test.deve_fallire(format('select public.entra_con_invito(%L)', k1), '041: l''invito vale una volta sola');
    execute 'reset role';
    perform growup_test.ok((select sponsor_id = a and confermato_il is null and codice_amway = '9100001' from public.partners where id = id1),
                           '041: in attesa sotto chi ha invitato, con il codice scritto nell''invito');
    perform growup_test.ok((select usato_il is not null and usato_da = id1 from public.inviti where id = (inv->>'id')::uuid), '041: l''invito è segnato come usato');
    perform growup_test.ok(exists (select 1 from public.notifiche_eventi where partner_id = a and chiave = 'entrato-' || id1
                                     and position('Paola' in corpo) = 0), '041: chi ha invitato riceve l''avviso, senza nomi');
    perform growup_test.come(ua);
    perform growup_test.ok(exists (select 1 from public.in_attesa() where id = id1) and not exists (select 1 from public.partners where id = id1),
                           '041: chi ha invitato la vede in attesa, non nella struttura');
    perform growup_test.deve_fallire('select * from public.notifiche_eventi', '041: gli avvisi li legge solo il server');
    perform growup_test.deve_fallire(format('select public.annulla_invito(%L)', inv->>'id'), '041: un invito usato non si annulla');

    -- la mappa la mette al suo posto, sotto il suo sponsor vero (B): avvisi a chi ha invitato e a B
    perform growup_test.come(ur);
    perform public.importa_mappa(current_date, now(), '{"codice":"1000000","vpp":120,"vpg":470}',
      '[{"codice":"9100001","nome":"Paola dalla mappa","sponsor":"2000002","vpp":10}]', '{}', '{}');
    execute 'reset role';
    perform growup_test.ok((select sponsor_id = b and confermato_il is not null from public.partners where id = id1),
                           '041: la mappa la mette sotto il suo sponsor vero e la conferma');
    perform growup_test.ok(exists (select 1 from public.notifiche_eventi where partner_id = a and chiave = 'al-posto-' || id1)
                           and exists (select 1 from public.notifiche_eventi where partner_id = b and chiave = 'al-posto-' || id1),
                           '041: avvisati chi ha invitato e lo sponsor vero');
    insert into public.notifiche_telefoni (partner_id, endpoint, p256dh, auth) values (a, 'https://fcm.googleapis.com/fcm/send/prova-a41', 'k', 'a');
    execute 'set local role service_role';
    n_prima := (select count(*) from public.notifiche_da_inviare(now()) where partner_id = a and chiave in ('evento-entrato-' || id1, 'evento-al-posto-' || id1));
    perform public.notifiche_segna(a, 'evento-entrato-' || id1);
    n_dopo := (select count(*) from public.notifiche_da_inviare(now()) where partner_id = a and chiave in ('evento-entrato-' || id1, 'evento-al-posto-' || id1));
    execute 'reset role';
    perform growup_test.ok(n_prima = 2, '041: i due avvisi di A partono al primo giro (' || n_prima || ')');
    perform growup_test.ok(n_dopo = 1, '041: un avviso mandato non si ripete');
    delete from public.notifiche_telefoni where partner_id = a; delete from public.notifiche_inviate where partner_id = a;

    -- già nella mappa: lo invita chi gli sta sopra e chi entra prende subito il suo posto, confermato
    perform growup_test.come(ua);
    inv := public.crea_invito('Mappa Prova', '9100009');
    perform growup_test.come(ur);
    inv2 := public.crea_invito('Mappa Prova bis', '9100009');  -- anche R, che sta sopra
    perform growup_test.come(n3);
    perform growup_test.ok((public.entra_con_invito(inv->>'codice')->'profilo'->>'id')::uuid = mappa, '041: prende il profilo già nella mappa');
    execute 'reset role';
    perform growup_test.ok((select stato = 'attivo' and confermato_il is not null and sponsor_id = a from public.partners where id = mappa),
                           '041: subito confermato, al suo posto');
    perform growup_test.ok((select annullato_il is not null from public.inviti where id = (inv2->>'id')::uuid),
                           '041: gli altri inviti con lo stesso codice si chiudono');
    perform growup_test.ok(exists (select 1 from public.notifiche_eventi where partner_id = a and chiave = 'al-posto-' || mappa),
                           '041: chi ha invitato riceve l''avviso');
    perform growup_test.ok((select count(*) from public.notifiche_eventi where chiave = 'al-posto-' || mappa) = 1,
                           '041: un solo avviso se lo sponsor vero è chi ha invitato');

    -- scaduto, annullato, rigenerato
    perform growup_test.come(ua);
    inv := public.crea_invito('Scade Prova', '9100006');
    execute 'reset role';
    update public.inviti set scade_il = now() - interval '1 minute' where id = (inv->>'id')::uuid;
    perform growup_test.come(n4);
    perform growup_test.ok(public.invito_aperto(inv->>'codice')->>'stato' = 'scaduto', '041: dopo 7 giorni il link è scaduto');
    perform growup_test.deve_fallire(format('select public.entra_con_invito(%L)', inv->>'codice'), '041: con un link scaduto non si entra');
    perform growup_test.come(ua);
    perform public.annulla_invito((inv->>'id')::uuid);
    k_vecchio := inv->>'codice';
    inv := public.rigenera_invito((inv->>'id')::uuid);
    perform growup_test.ok(inv->>'codice' <> k_vecchio and (select annullato_il is null and scade_il > now() from public.inviti
                             where id = (inv->>'id')::uuid), '041: rigenerato: link nuovo, di nuovo aperto per 7 giorni');
    perform growup_test.come(n4);
    perform growup_test.ok(public.invito_aperto(k_vecchio)->>'stato' = 'sconosciuto', '041: il link vecchio non vale più');
    perform growup_test.come(ua);
    perform public.annulla_invito((inv->>'id')::uuid);
    perform growup_test.come(n4);
    perform growup_test.ok(public.invito_aperto(inv->>'codice')->>'stato' = 'annullato', '041: annullato da chi l''ha creato');
    perform growup_test.deve_fallire(format('select public.entra_con_invito(%L)', inv->>'codice'), '041: con un link annullato non si entra');
    perform growup_test.come(ua);
    inv := public.rigenera_invito((inv->>'id')::uuid);
    perform growup_test.come(n4);
    z := (public.entra_con_invito(inv->>'codice')->'profilo'->>'id')::uuid;
    perform growup_test.ok(z is not null, '041: con il link rigenerato si entra');

    -- chi invita viene bloccato: i suoi link non valgono più
    perform growup_test.come(ua);
    inv := public.crea_invito('Blocco Prova', '9100007');
    execute 'reset role';
    update public.partners set bloccato_il = now() where id = a;
    perform growup_test.come(null);
    perform growup_test.ok(public.invito_aperto(inv->>'codice')->>'stato' = 'sconosciuto', '041: chi è bloccato non fa entrare nessuno');
    execute 'reset role';
    update public.partners set bloccato_il = null where id = a;

    -- i permessi: senza accesso solo invito_aperto
    perform growup_test.ok(has_function_privilege('anon', 'public.invito_aperto(text)', 'execute')
                           and not has_function_privilege('anon', 'public.crea_invito(text,text)', 'execute')
                           and not has_function_privilege('anon', 'public.entra_con_invito(text,date,text,date,integer,integer)', 'execute')
                           and not has_function_privilege('authenticated', 'public.avvisa(uuid,text,text)', 'execute'),
                           '041: permessi delle funzioni degli inviti');
  end;

  -- ---- 042: di chi è in attesa l'upline riceve solo il nome ----
  declare
    ua uuid; ub uuid; n5 constant uuid := '00000000-0000-0000-0000-0000000009b1'; w uuid;
  begin
    execute 'reset role';
    insert into auth.users (id, aud, role) values (n5, 'authenticated', 'authenticated');
    ua := (select user_id from public.accessi where partner_id = a limit 1);
    ub := (select user_id from public.accessi where partner_id = b limit 1);
    perform growup_test.come(n5);
    w := (public.entra_con_invito(growup_test.invito(a, 'Walter Attesa', '9200001'))->'profilo'->>'id')::uuid;
    perform growup_test.come(ua);
    perform growup_test.ok(exists (select 1 from public.in_attesa() where id = w and nome = 'Walter Attesa'), '042: A vede Walter in attesa, con il nome');
    perform growup_test.ok((select count(*) from jsonb_object_keys((select to_jsonb(q42) from public.in_attesa() q42 where q42.id = w))) = 6
                           and not ((select to_jsonb(q42) from public.in_attesa() q42 where q42.id = w) ? 'codice_amway'),
                           '042: in_attesa non dà il codice Amway');
    perform growup_test.ok((select codice from public.attesa_nel_report(array['9200001', '9999998']) where id = w) = '9200001',
                           '042: l''anteprima dell''import riconosce Walter se il suo codice è nel report');
    perform growup_test.ok(not exists (select 1 from public.attesa_nel_report(array['9999998'])), '042: senza il suo codice nel report, niente');
    execute 'reset role';   -- 20.000 codici al giorno: oltre, rifiutato anche con poche richieste
    insert into public.attesa_richieste (partner_id, codici) values (a, 19999);
    perform growup_test.come(ua);
    perform growup_test.deve_fallire($q$select * from public.attesa_nel_report(array['9200001', '9200002'])$q$,
                                     '042: oltre 20.000 codici al giorno, rifiutato');
    execute 'reset role';
    delete from public.attesa_richieste where partner_id = a and codici = 19999;
    -- 30 richieste al giorno: la trentunesima è rifiutata (niente codici provati a caso)
    insert into public.attesa_richieste (partner_id, codici) select a, 1 from generate_series(1, 30 - (select count(*)::int
      from public.attesa_richieste where partner_id = a));
    perform growup_test.come(ua);
    perform growup_test.deve_fallire($q$select * from public.attesa_nel_report(array['9200001'])$q$, '042: oltre 30 richieste al giorno, rifiutato');
    perform growup_test.deve_fallire('select * from public.attesa_richieste', '042: le richieste non si leggono dall''app');
    perform growup_test.come(ub);  -- B è di lato rispetto a Walter (sotto A)
    perform growup_test.ok(not exists (select 1 from public.attesa_nel_report(array['9200001'])), '042: chi è di lato non lo riconosce');
    perform growup_test.come(null);
    perform growup_test.deve_fallire($q$select * from public.attesa_nel_report(array['9200001'])$q$, '042: anon non chiede niente');
  end;

  -- ---- 043: admin nel proprio gruppo, impostazioni con un profilo, punto di partenza, notifiche ----
  declare
    ra uuid; rx uuid; ua uuid; ur uuid; u9 constant uuid := '00000000-0000-0000-0000-0000000009c1';
    ok1 boolean; ok2 boolean; ok_n int := 0;
  begin
    execute 'reset role';
    insert into auth.users (id, aud, role) values (u9, 'authenticated', 'authenticated');
    ua := (select user_id from public.accessi where partner_id = a limit 1);
    ur := (select user_id from public.accessi where partner_id = r limit 1);
    -- un secondo admin dentro la linea di A, e una persona con l'app fuori dal suo gruppo (sotto R, di lato ad A)
    update public.partners set is_admin = true where id = a;
    insert into public.partners (nome, sponsor_id, stato, codice_amway, confermato_il, chiave_hash)
    values ('Fuori Gruppo', r, 'attivo', '9300001', now(), public.impronta('22222222222222222222222222222222')) returning id into rx;
    insert into public.accessi (user_id, partner_id) values (u9, rx);
    perform growup_test.come(ua);   -- A, admin: solo nel suo gruppo
    perform growup_test.deve_fallire(format('select public.nuova_chiave_per(%L)', rx), '043: un admin non crea link per chi è fuori dal suo gruppo');
    perform growup_test.deve_fallire(format('select public.blocca_app(%L, true)', rx), '043: un admin non blocca chi è fuori dal suo gruppo');
    perform growup_test.ok(length(public.nuova_chiave_per(b)) = 32, '043: un admin crea il link per chi è nel suo gruppo');
    perform growup_test.come(ur);   -- R, admin in cima: tutto il suo gruppo
    perform public.blocca_app(rx, true);
    perform public.blocca_app(rx, false);
    perform growup_test.ok(true, '043: l''admin in cima blocca e sblocca chi è nel suo gruppo');
    execute 'reset role';
    update public.partners set is_admin = false where id = a;
    delete from public.accessi where partner_id = rx; delete from public.partners where id = rx;

    -- impostazioni, tappe e livelli: solo con un profilo
    perform growup_test.come(u9);   -- telefono senza profilo (il suo profilo è stato tolto)
    perform growup_test.ok((select count(*) from public.settings) = 0 and (select count(*) from public.stage_requirements) = 0
                           and (select count(*) from public.percent_levels) = 0, '043: senza profilo non si leggono impostazioni, tappe e livelli');
    perform growup_test.come(ua);
    perform growup_test.ok((select count(*) from public.stage_requirements) = 19 and (select count(*) from public.settings) > 0,
                           '043: con un profilo sì');
    perform growup_test.ok(jsonb_array_length((select valore->'livelli' from public.settings where chiave = 'stabilita_cl21')) = 7
                           and (select bool_and(jsonb_array_length(rg->'soglie') = 7) from public.settings s,
                                jsonb_array_elements(s.valore->'righe') rg where s.chiave = 'stabilita_cl21'),
                           '044: i riferimenti della Stabilità (7 livelli, una soglia per livello) si leggono con un profilo');
    perform growup_test.ok(growup_test.righe($q$update public.settings set valore = '{}' where chiave = 'stabilita_cl21'$q$) = 0,
                           '044: un partner non cambia i riferimenti della Stabilità');

    -- il punto di partenza solo da modifica_partenza
    perform growup_test.deve_fallire($q$update public.partners set qualifica_iniziale = 'argento', pagamenti_iniziali = 3
                                     where id = public.my_partner_id()$q$, '043: il punto di partenza non si scrive direttamente');
    perform growup_test.ok(public.modifica_partenza('foundation_9', null, current_date, 2)->>'qualifica_iniziale' = 'foundation_9',
                           '043: con modifica_partenza sì');
    perform public.modifica_partenza(null, null, null, 0);

    -- notifiche: solo servizi ufficiali, e la prova con un limite
    perform growup_test.deve_fallire($q$insert into public.notifiche_telefoni (endpoint, p256dh, auth)
                                     values ('https://sito-qualsiasi.example/push', 'k', 'a')$q$, '043: un indirizzo che non è un servizio di notifiche è rifiutato');
    perform growup_test.deve_fallire(format('select public.notifiche_prova_ok(%L)', a), '043: notifiche_prova_ok solo per il server');
    execute 'reset role';
  end;
  declare
    ok1 boolean; ok2 boolean;
  begin
    execute 'set local role service_role';
    ok1 := public.notifiche_prova_ok(a);
    ok2 := public.notifiche_prova_ok(a);
    execute 'reset role';
    perform growup_test.ok(ok1 and not ok2, '043: la notifica di prova al massimo una volta al minuto');
    update public.notifiche_inviate set inviata_il = now() - interval '2 hours' where partner_id = a and chiave like 'prova-%';
    insert into public.notifiche_inviate (partner_id, chiave, inviata_il)
    select a, 'prova-x' || q9, now() - interval '2 hours' from generate_series(1, 9) q9;
    execute 'set local role service_role';
    ok1 := public.notifiche_prova_ok(a);
    execute 'reset role';
    perform growup_test.ok(not ok1, '043: al massimo 10 prove al giorno');
    delete from public.notifiche_inviate where partner_id = a and chiave like 'prova-%';
  end;

  -- ---- Copia dei dati: solo admin, con tutte le tabelle ----
  perform growup_test.come(u5);  -- A
  perform growup_test.deve_fallire('select public.copia_dati()', 'A non scarica la copia dei dati (non è admin)');
  perform growup_test.come(u1);  -- R admin
  perform growup_test.ok((select count(*) from jsonb_object_keys(public.copia_dati()->'tabelle')) = 15
                         and jsonb_array_length(public.copia_dati()->'tabelle'->'partners') >= 3, 'l''admin scarica la copia con tutte le tabelle');
  perform growup_test.ok(not exists (select 1 from jsonb_array_elements(public.copia_dati()->'tabelle'->'partners') j
                                      where j ? 'chiave_hash' or j ? 'email'), '042: nella copia né l''impronta delle chiavi né le email');
  perform growup_test.ok(jsonb_array_length(public.copia_dati()->'tabelle'->'obiettivi') >= 1
                         and not exists (select 1 from jsonb_array_elements(public.copia_dati()->'tabelle'->'obiettivi') j where j ? 'perche'),
                         '042: nella copia gli obiettivi senza il «perché»');
  perform growup_test.ok(exists (select 1 from jsonb_array_elements(public.copia_dati()->'tabelle'->'activities') j where j->>'tipo' = 'ordine'),
                         '042: gli ordini restano nella copia (servono a ripristinare)');
  execute 'reset role';

  -- ---- 045: solo Italia. I codici esteri già importati si cancellano con i loro dati ----
  declare
    est uuid; est_c uuid; it uuid;
  begin
    perform growup_test.come(u1);  -- R importa: un estero sotto A (con un italiano sotto, dati vecchi) e uno sotto C
    perform public.importa_mappa(current_date, now(), '{"codice":"1000000","vpp":120,"vpg":470}',
      '[{"codice":"8500001","nome":"Estero Uno","sponsor":"2000001","vpp":10,"vpg":10},
        {"codice":"8500002","nome":"Italiano Sotto","sponsor":"8500001","vpp":5,"vpg":5},
        {"codice":"8500003","nome":"Estero Due","sponsor":"2000003","vpp":7,"vpg":7}]', '{}', '{}');
    execute 'reset role';
    est := (select id from public.partners where codice_amway = '8500001');
    est_c := (select id from public.partners where codice_amway = '8500003');
    it := (select id from public.partners where codice_amway = '8500002');
    insert into public.activities (partner_id, tipo, inserito_da) values (est, 'contatto', a);
    perform growup_test.come(u5);  -- A: dalla sua mappa un codice estero non si salva, e non può essere tra le persone
    perform growup_test.deve_fallire($q$select public.importa_mappa(current_date, now(), '{"codice":"2000001"}',
      '[{"codice":"8500001","nome":"Estero Uno","sponsor":"2000001"}]', '{}', '{}', '{8500001}')$q$, '045: un codice estero non entra tra le persone');
    perform growup_test.ok((public.importa_mappa(current_date, now(), '{"codice":"2000001","vpp":60}',
      '[{"codice":"8500002","nome":"Italiano Sotto","sponsor":"2000001","vpp":5,"vpg":5}]', '{}', '{}', '{8500001,8500003}')->>'esteri_nascosti')::int = 1,
      '045: A (non admin) non cancella: il codice estero della sua downline resta nascosto e segnato');
    execute 'reset role';
    perform growup_test.ok(exists (select 1 from public.partners where id = est and fuori_report_dal is not null)
                           and exists (select 1 from public.nascosti where partner_id = a and nascosto_id = est),
                           '045: un codice arrivato dal telefono di chi non è admin non cancella nessuno');
    perform growup_test.come(u1);  -- R (admin) importa: il codice estero della sua downline si cancella
    perform growup_test.ok((public.importa_mappa(current_date, now(), '{"codice":"1000000","vpp":120,"vpg":470}',
      '[{"codice":"8500002","nome":"Italiano Sotto","sponsor":"2000001","vpp":5,"vpg":5}]', '{}', '{}', '{8500001}')->>'esteri')::int = 1,
      '045: l''admin cancella il codice estero della sua downline');
    execute 'reset role';
    perform growup_test.ok(not exists (select 1 from public.partners where id = est)
                           and not exists (select 1 from public.numeri_mese where partner_id = est)
                           and not exists (select 1 from public.activities where partner_id = est), '045: l''estero sparisce con numeri e attività');
    perform growup_test.ok((select sponsor_id from public.partners where id = it) = a, '045: l''italiano che era sotto va sotto il suo sponsor del file');
    perform growup_test.ok(exists (select 1 from public.partners where id = est_c), '045: il codice estero indicato da A in un''altra linea (C) non si tocca');
    perform growup_test.ok(exists (select 1 from public.partners where id = a and codice_amway = '2000001'), '045: chi usa l''app non si cancella');
    perform growup_test.come(u4);
    perform growup_test.deve_fallire($q$select public.importa_mappa(current_date, now(), '{"codice":"2000003"}', '[]', '{}', '{}', '{2000003}')$q$,
                                     '045: il proprio codice non è estero');
    perform growup_test.come(u1);  -- R (admin) cancella anche quello sotto C (è nella sua downline)
    perform public.importa_mappa(current_date, now(), '{"codice":"1000000","vpp":120,"vpg":470}', '[]', '{}', '{}', '{8500003}');
    execute 'reset role';
    perform growup_test.ok(not exists (select 1 from public.partners where id = est_c), '045: l''admin cancella il codice estero sotto C');
    delete from public.numeri_mese where partner_id = it; delete from public.partners where id = it;
  end;

  -- ---- 046: fuori dalla mappa da 12 mesi si cancella (solo con l'import di un admin); chi ricompare riprende i suoi dati ----
  declare
    vecchio uuid; ritorna uuid; ris uuid; m0 date := date_trunc('month', current_date)::date;
  begin
    perform growup_test.come(u1);  -- R
    perform public.importa_mappa(current_date, now(), '{"codice":"1000000","vpp":120,"vpg":470}',
      '[{"codice":"8600001","nome":"Uscito Da Tanto","sponsor":"2000001","vpp":1,"vpg":1},
        {"codice":"8600002","nome":"Torna Presto","sponsor":"2000001","vpp":1,"vpg":1},
        {"codice":"8600003","nome":"Utente riservato","sponsor":"2000001","vpp":1,"vpg":1},
        {"codice":"8600004","nome":"Sotto Uscito","sponsor":"8600001","vpp":1,"vpg":1},
        {"codice":"8600005","nome":"Nel File","sponsor":"2000001","vpp":1,"vpg":1},
        {"codice":"8600006","nome":"Mappa Piu Nuova","sponsor":"2000001","vpp":1,"vpg":1}]', '{}', '{}');
    execute 'reset role';
    -- segni «fuori» vecchi che non devono portare alla cancellazione: chi è nel file e chi ha una mappa più recente
    update public.partners set fuori_report_dal = (m0 - interval '13 months')::date, mappa_mese = (m0 + interval '1 month')::date
     where codice_amway in ('8600005', '8600006');
    vecchio := (select id from public.partners where codice_amway = '8600001');
    ritorna := (select id from public.partners where codice_amway = '8600002');
    ris := (select id from public.partners where codice_amway = '8600003');
    insert into public.activities (partner_id, tipo, inserito_da) values (ritorna, 'contatto', r);
    update public.partners set fuori_report_dal = (m0 - interval '12 months')::date where id = vecchio;
    update public.partners set fuori_report_dal = (m0 - interval '11 months')::date where id = ritorna;
    perform growup_test.come(u5);  -- A non è admin: non cancella
    perform growup_test.ok((public.importa_mappa(current_date, now(), '{"codice":"2000001","vpp":60}', '[]', '{}', '{}')->>'cancellati')::int = 0,
                           '046: chi non è admin non cancella chi è fuori da 12 mesi');
    perform growup_test.come(u1);  -- R (admin): Torna e Utente riservato (col nome vero) sono nel file, Uscito no
    perform growup_test.ok((public.importa_mappa(current_date, now(), '{"codice":"1000000","vpp":120,"vpg":470}',
      '[{"codice":"8600002","nome":"Torna Presto","sponsor":"2000001","vpp":2,"vpg":2},
        {"codice":"8600003","nome":"Rita Vera","sponsor":"2000001","vpp":2,"vpg":2},
        {"codice":"8600004","nome":"Sotto Uscito","sponsor":"2000001","vpp":2,"vpg":2},
        {"codice":"8600005","nome":"Nel File","sponsor":"2000001","vpp":2,"vpg":2}]', '{}', '{}')->>'cancellati')::int = 1,
      '046: l''admin cancella chi è fuori dalla mappa da 12 mesi');
    execute 'reset role';
    perform growup_test.ok(not exists (select 1 from public.partners where id = vecchio)
                           and not exists (select 1 from public.numeri_mese where partner_id = vecchio), '046: cancellato con i suoi numeri');
    perform growup_test.ok((select sponsor_id from public.partners where codice_amway = '8600004') = a, '046: chi stava sotto resta, al suo posto nel file');
    perform growup_test.ok((select fuori_report_dal is null from public.partners where id = ritorna)
                           and exists (select 1 from public.activities where partner_id = ritorna), '046: chi ricompare entro 12 mesi riprende i suoi dati');
    perform growup_test.ok((select nome from public.partners where id = ris) = 'Rita Vera', '046: «Utente riservato» prende il nome vero dal file');
    perform growup_test.ok((select count(*) from public.partners where codice_amway in ('8600005', '8600006')) = 2,
                           '046: non si cancella chi è nel file appena importato né chi ha messo al suo posto una mappa più recente');
    -- una mappa di un mese precedente salva sempre i numeri di quel mese (anche se il file è più vecchio)
    perform growup_test.come(u1);
    perform public.salva_mese_passato((m0 - interval '1 month')::date, now(), '{"codice":"1000000","vpp":11,"vpg":111}', '[]');
    perform public.salva_mese_passato((m0 - interval '1 month')::date, now() - interval '3 days', '{"codice":"1000000","vpp":22,"vpg":222}', '[]');
    execute 'reset role';
    perform growup_test.ok((select vpg from public.numeri_mese where partner_id = r and mese = (m0 - interval '1 month')::date) = 222,
                           '046: i numeri del mese sono quelli dell''ultimo file importato');
    delete from public.numeri_mese where partner_id = r and mese = (m0 - interval '1 month')::date;
    delete from public.numeri_mese where partner_id in (select id from public.partners where codice_amway like '86000%');
    delete from public.activities where partner_id = ritorna;
    delete from public.partners where codice_amway like '86000%';
  end;

  -- ---- Nessuna tabella senza RLS ----
  execute 'reset role';
  perform growup_test.ok(not exists (select 1 from pg_tables where schemaname = 'public' and not rowsecurity),
                         'RLS attiva su tutte le tabelle');

  raise exception 'FINE_CONTROLLI';   -- annulla tutti i dati di prova
  exception when others then
    if sqlerrm <> 'FINE_CONTROLLI' then raise; end if;
  end;
  raise notice 'TUTTI I CONTROLLI SUPERATI';
  perform set_config('growup_test.esito', 'superati', false);  -- solo se si arriva qui senza errori
end $test$;

drop schema growup_test cascade;

-- l'esito si legge dal blocco qui sopra: se un controllo è fallito (o non è partito), qui non c'è scritto «superati»
select case when current_setting('growup_test.esito', true) = 'superati' then 'TUTTI I CONTROLLI SUPERATI'
            else 'CONTROLLI NON COMPLETATI: guarda il primo errore qui sopra' end as esito;
