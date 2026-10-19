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
  perform growup_test.ok(public.sponsor_da_codice('rrrr22') = 'Radice Test', 'il link d''invito mostra il nome dello sponsor');
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
  perform growup_test.deve_fallire($q$select public.entra_con_invito('ZZZZ99','A','2000009')$q$, 'codice inesistente');
  perform growup_test.deve_fallire($q$select public.entra_con_invito('RRRR22','A','2000009', current_date + 5)$q$, 'data di iscrizione nel futuro');
  k_a := public.entra_con_invito('RRRR22', 'Anna Test', '2000001', date '2026-07-01')->>'chiave';
  a := (public.collega_profilo()->>'id')::uuid;
  perform growup_test.ok((public.collega_profilo()->>'sponsor_id')::uuid = r, 'A agganciata a R');
  perform growup_test.deve_fallire($q$select public.entra_con_invito('RRRR22','A','2000009')$q$, 'secondo profilo dallo stesso telefono');
  execute 'reset role';
  update public.partners set codice_invito = 'AAAA22' where id = a;

  perform growup_test.come(u3);
  b := (public.entra_con_invito('aaaa22', 'Bruno Test', '2000002', null, 'path_to_bronze')->'profilo'->>'id')::uuid;
  perform growup_test.come(u4);
  perform growup_test.deve_fallire($q$select public.entra_con_invito('RRRR22','C','2000003',null,null,null,0,7)$q$, 'pin inesistente');
  c := (public.entra_con_invito('RRRR22', 'Carla Test', '2000003', null, null, null, 0, 9)->'profilo'->>'id')::uuid;
  perform growup_test.ok((public.collega_profilo()->>'percentuale_iniziale')::int = 9, 'pin 9% registrato senza qualifica Bronze');
  execute 'reset role';
  perform growup_test.ok((select sponsor_id from public.partners where id = b) = a, 'B agganciato ad A');

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
  perform growup_test.ok((select count(*) from public.stage_requirements) = 8, 'tutti leggono le 8 tappe');
  perform growup_test.ok(growup_test.righe('update public.stage_requirements set vp_personali = 1') = 0, 'A non modifica i requisiti');
  perform growup_test.come(u6);  -- R admin
  perform growup_test.ok(growup_test.righe('update public.stage_requirements set descrizione = descrizione') = 8, 'l''admin modifica i requisiti');

  -- ---- Prendere possesso di un profilo creato da altri, con la sua chiave ----
  execute 'reset role';
  insert into public.partners (nome, sponsor_id, stato, creato_da) values ('Dario Test', a, 'gestito', a) returning id into d;
  k_d := public.nuova_chiave_per(d);
  insert into public.activities (partner_id, tipo, inserito_da) values (d, 'contatto', a);
  perform growup_test.come(u7);
  perform growup_test.ok(public.entra_con_chiave(k_d)->>'stato' = 'attivo', 'D prende possesso e diventa attivo');
  perform growup_test.ok((select count(*) from public.activities) = 1, 'D ritrova il suo storico');
  perform growup_test.ok((select count(*) from public.partners) = 1, 'nessun duplicato');

  -- ---- I codici Amway di chi usa l'app (dati all'ingresso; D li riceve qui) ----
  execute 'reset role';
  update public.partners set codice_amway = '2000004' where id = d;
  update public.partners set codice_invito = 'BBBB22' where id = b;
  update public.partners set codice_invito = 'CCCC22' where id = c;
  perform growup_test.ok((select codice_amway from public.partners where id = a) = '2000001'
                         and (select codice_amway from public.partners where id = b) = '2000002', 'il codice dato all''ingresso è salvato');
  insert into public.activities (partner_id, tipo, vp) values (r, 'ordine', 120), (b, 'ordine', 150), (c, 'ordine', 100);

  -- ---- Le funzioni degli inserimenti a mano sono chiuse ----
  perform growup_test.come(u1);  -- R admin
  perform growup_test.deve_fallire(format($q$select public.aggiungi_partner('X', %L)$q$, a), 'niente più inserimenti a mano');
  perform growup_test.deve_fallire(format($q$select public.aggiungi_con_codice('X', %L, '5555555')$q$, a), 'niente più inserimenti a mano con codice');
  perform growup_test.deve_fallire(format('select public.inserisci_in_mezzo(%L, array[%L]::uuid[])', 'X', b), 'niente più "manca qualcuno sopra"');
  perform growup_test.deve_fallire(format('select public.cambia_sponsor(%L, %L)', d, c), 'niente più "cambia sponsor", neanche per l''admin');
  perform growup_test.deve_fallire(format('select public.link_per_gestito(%L)', d), 'niente più link per le persone senza app');
  perform growup_test.deve_fallire($q$select public.iscrivi_con_codice('RRRR22', 'X', null)$q$, 'niente più ingresso senza codice Amway');

  -- ---- Import della rete: le persone importate le vede solo chi le importa ----
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
  perform growup_test.ok(not exists (select 1 from public.partners where id = e), 'B non vede E, anche se è sotto di lui: l''ha importata A');
  perform growup_test.come(u1);  -- R
  perform growup_test.ok(not exists (select 1 from public.partners where id in (e, f)), 'R non vede le persone importate da A');
  perform growup_test.ok((select count(*) from public.nascosti) = 0, 'R non vede le persone nascoste da A');
  perform growup_test.deve_fallire(format($q$insert into public.activities (partner_id, tipo) values (%L, 'contatto')$q$, e), 'R non scrive per E');
  -- R importa anche lui E: la sua copia
  perform growup_test.ok((public.importa_rete(current_date, '{"codice":"1000000","vpp":120}',
      '[{"codice":"3000001","nome":"Elena copia di R","sponsor":"2000002","vpp":45}]', '[]', '{}', '{}')->>'aggiunte')::int = 1,
      'R importa la sua copia di E');
  perform growup_test.ok((select codice_amway from public.partners where id = r) = '1000000', 'il codice di R viene dalla prima riga');
  perform growup_test.come(u5);  -- A
  perform growup_test.ok((select count(*) from public.partners where codice_amway = '3000001') = 1, 'A vede solo la sua copia di E');
  perform growup_test.deve_fallire(format('select public.imposta_codice_amway(%L, %L)', f, '3000001'), 'tra le mie importate il codice è unico');
  perform growup_test.deve_fallire(format('select public.imposta_codice_amway(%L, %L)', b, '2222222'), 'A non cambia il codice di B, che usa l''app');

  -- ---- Calcoli per chi guarda: nessun doppio conteggio ----
  -- vista di A: A 60, B 150, E 40 (copia di A), F 0, D 0 → A 250
  -- vista di R: R 120, A 60, B 150, E 45 (copia di R), D 0, C 100 → A 255, R 475
  perform growup_test.come(u5);  -- A
  select * into x from public.riepilogo_mese(current_date) where partner_id = a;
  perform growup_test.ok(x.vp_gruppo = 250, 'A: VP di gruppo con le sue persone importate (' || x.vp_gruppo || ')');
  perform growup_test.ok((select count(*) from public.riepilogo_mese(current_date)) = 5, 'A: riepilogo di sé, B, D, E, F');
  perform growup_test.come(u1);  -- R
  select * into x from public.riepilogo_mese(current_date) where partner_id = a;
  perform growup_test.ok(x.vp_gruppo = 255, 'R vede il gruppo di A con la propria copia di E (' || x.vp_gruppo || ')');
  select * into x from public.riepilogo_mese(current_date) where partner_id = r;
  perform growup_test.ok(x.vp_gruppo = 475 and x.linee_attive = 2, 'R: 475 di gruppo, 2 linee attive (' || x.vp_gruppo || ')');
  perform growup_test.come(u4);  -- C
  perform growup_test.ok((select count(*) from public.riepilogo_mese(current_date)) = 1, 'C vede solo sé');

  -- ---- Ingresso con il codice: chi è già importato prende il suo profilo ----
  execute 'reset role';
  insert into auth.users (id, aud, role) select ('00000000-0000-0000-0000-0000000000b' || i)::uuid, 'authenticated', 'authenticated'
  from generate_series(1, 4) i;
  perform growup_test.come('00000000-0000-0000-0000-0000000000b1');
  perform growup_test.deve_fallire($q$select public.entra_con_invito('BBBB22', 'Elena', '')$q$, 'il codice Amway è obbligatorio');
  perform growup_test.deve_fallire($q$select public.entra_con_invito('RRRR22', 'Anna bis', '2000001')$q$, 'codice di chi usa già l''app: rifiutato');
  perform growup_test.deve_fallire($q$select public.entra_con_invito('CCCC22', 'Fabio', '3000002')$q$, 'codice importato in un''altra linea: rifiutato');
  perform growup_test.ok(public.entra_con_invito('BBBB22', 'Elena Vera', '3000001')->'profilo'->>'id' = e::text,
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
  perform growup_test.ok((public.entra_con_invito('CCCC22', 'Gino Test', '3000005')->'profilo'->>'sponsor_id')::uuid = c, 'codice nuovo: sotto chi invita');
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
  perform growup_test.come(u1);  -- R
  perform growup_test.deve_fallire(format($q$select public.importa_rete(current_date, '{"codice":"1000000","vpp":120}', '[]', '[]', '{}', '{%s}')$q$, f),
                                   'R non segna le persone importate da A');
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
  perform growup_test.ok((select vp_gruppo from public.riepilogo_mese(current_date) where partner_id = a) >= 210, 'B nascosto conta ancora nel VP di A');
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
  perform growup_test.come(u5);  -- A non ha importato quei numeri: per lei restano i suoi
  perform growup_test.ok(not (select da_report from public.riepilogo_mese(current_date) where partner_id = a), 'A: numeri calcolati, il report è di R');
  perform growup_test.ok((select count(*) from public.numeri_report) = 0, 'A non legge i numeri importati da R');

  -- ---- Inviti degli admin: sotto una persona importata, e "chi manca sopra" ----
  perform growup_test.come(u1);
  k_e := (select codice_invito from public.partners where id = h);
  execute 'reset role';
  insert into auth.users (id, aud, role) select ('00000000-0000-0000-0000-0000000000c' || i)::uuid, 'authenticated', 'authenticated'
  from generate_series(1, 3) i;
  perform growup_test.come('00000000-0000-0000-0000-0000000000c1');
  f := (public.entra_con_invito(k_e, 'Nora Sotto', '4000002')->'profilo'->>'id')::uuid;
  execute 'reset role';
  perform growup_test.ok((select sponsor_id from public.partners where id = f) = h, 'N entra sotto il Platino importato da R');
  perform growup_test.come(u1);
  perform growup_test.ok((select sponsor_id from public.struttura_visibile() where id = f) = h, 'R vede N sotto il Platino');
  perform growup_test.come(u5);  -- A non vede il Platino (importato da R): N è sotto A
  perform growup_test.ok((select sponsor_id from public.struttura_visibile() where id = f) = a
                         and not exists (select 1 from public.struttura_visibile() where id = h), 'A vede N sotto di sé, struttura ricucita');
  perform growup_test.ok(exists (select 1 from public.riepilogo_mese(current_date) where partner_id = f and sponsor_id = a), 'i numeri di A contano N');
  perform growup_test.deve_fallire(format('select public.crea_invito_sopra(%L)', f), 'A non crea inviti speciali (non è admin)');
  perform growup_test.come(u1);
  k_e := public.crea_invito_sopra(f);
  perform growup_test.come(null);
  perform growup_test.ok(public.sponsor_da_codice(k_e) = 'Bianca Platini', 'il link speciale mostra lo sponsor');
  perform growup_test.come('00000000-0000-0000-0000-0000000000c2');
  g := (public.entra_con_invito(k_e, 'Mirco Mezzo', '4000003')->'profilo'->>'id')::uuid;
  execute 'reset role';
  perform growup_test.ok((select sponsor_id from public.partners where id = g) = h and (select sponsor_id from public.partners where id = f) = g,
                         'M entra tra il Platino e N');
  perform growup_test.come('00000000-0000-0000-0000-0000000000c3');
  perform growup_test.deve_fallire(format($q$select public.entra_con_invito(%L, 'Altro', '4000004')$q$, k_e), 'il link speciale vale una volta sola');

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
  update public.ordini set vp = 99, numero_amway = '170000009';
  perform growup_test.come(u3);
  perform growup_test.ok((select count(*) from public.ordini where vp = 99 or numero_amway = '170000009') = 0, 'lo sponsor non cambia gli ordini di B');
  delete from public.persone where id = pp;
  perform growup_test.ok((select count(*) from public.ordini) = 0 and (select count(*) from public.righe_ordine) = 0, 'togliendo il cliente spariscono i suoi ordini');
  delete from public.durate;
  execute 'reset role';

  -- ---- Copia dei dati: solo admin, con tutte le tabelle ----
  perform growup_test.come(u5);  -- A
  perform growup_test.deve_fallire('select public.copia_dati()', 'A non scarica la copia dei dati (non è admin)');
  perform growup_test.come(u1);  -- R admin
  perform growup_test.ok((select count(*) from jsonb_object_keys(public.copia_dati()->'tabelle')) = 14
                         and jsonb_array_length(public.copia_dati()->'tabelle'->'partners') >= 3, 'l''admin scarica la copia con tutte le tabelle');
  execute 'reset role';

  -- ---- Nessuna tabella senza RLS ----
  execute 'reset role';
  perform growup_test.ok(not exists (select 1 from pg_tables where schemaname = 'public' and not rowsecurity),
                         'RLS attiva su tutte le tabelle');

  raise exception 'FINE_CONTROLLI';   -- annulla tutti i dati di prova
  exception when others then
    if sqlerrm <> 'FINE_CONTROLLI' then raise; end if;
  end;
  raise notice 'TUTTI I CONTROLLI SUPERATI';
end $test$;

drop schema growup_test cascade;

select 'TUTTI I CONTROLLI SUPERATI' as esito;
