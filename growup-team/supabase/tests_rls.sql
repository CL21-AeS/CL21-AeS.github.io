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
  r uuid; a uuid; b uuid; c uuid; d uuid; e uuid; f uuid; x record; mese_prec date;
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
  perform growup_test.deve_fallire($q$select public.iscrivi_con_codice('ZZZZ99','A',null)$q$, 'codice inesistente');
  perform growup_test.deve_fallire($q$select public.iscrivi_con_codice('RRRR22','A', current_date + 5)$q$, 'data di iscrizione nel futuro');
  k_a := public.iscrivi_con_codice('RRRR22', 'Anna Test', date '2026-07-01')->>'chiave';
  a := (public.collega_profilo()->>'id')::uuid;
  perform growup_test.ok((public.collega_profilo()->>'sponsor_id')::uuid = r, 'A agganciata a R');
  perform growup_test.deve_fallire($q$select public.iscrivi_con_codice('RRRR22','A',null)$q$, 'secondo profilo dallo stesso telefono');
  execute 'reset role';
  update public.partners set codice_invito = 'AAAA22' where id = a;

  perform growup_test.come(u3);
  b := (public.iscrivi_con_codice('aaaa22', 'Bruno Test', null, 'path_to_bronze')->'profilo'->>'id')::uuid;
  perform growup_test.come(u4);
  perform growup_test.deve_fallire($q$select public.iscrivi_con_codice('RRRR22','C',null,null,null,0,7)$q$, 'pin inesistente');
  c := (public.iscrivi_con_codice('RRRR22', 'Carla Test', null, null, null, 0, 9)->'profilo'->>'id')::uuid;
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
  perform growup_test.deve_fallire($q$insert into public.partners (nome) values ('Fantasma')$q$, 'nessun profilo fuori da iscrivi_con_codice');
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

  -- ---- Aggiungere a mano una persona che non usa l'app ----
  perform growup_test.come(u5);  -- A (dal computer)
  e := (public.aggiungi_partner('Elena Test', b, null, null, 6)->>'id')::uuid;
  execute 'reset role';
  perform growup_test.ok((select sponsor_id = b and stato = 'gestito' and gestore_id = a and consenso_confermato_il is not null
                          from public.partners where id = e), 'E aggiunta sotto B, gestita da A, con consenso');
  perform growup_test.come(u5);
  perform growup_test.ok(exists (select 1 from public.partners where id = e), 'A vede E nella sua struttura');
  perform growup_test.deve_fallire(format($q$select public.aggiungi_partner('X', %L)$q$, r), 'A non aggiunge persone sopra di sé');
  perform growup_test.deve_fallire(format($q$select public.aggiungi_partner('X', %L)$q$, c), 'A non aggiunge persone in un''altra linea');
  perform growup_test.deve_fallire(format($q$select public.aggiungi_partner('', %L)$q$, a), 'serve il nome');
  perform growup_test.deve_fallire(format('select public.link_per_gestito(%L)', b), 'niente link per chi usa già l''app');
  perform growup_test.come(u4);  -- C, altra linea
  perform growup_test.deve_fallire(format('select public.link_per_gestito(%L)', e), 'C non genera il link di E');
  perform growup_test.ok(public.collega_profilo() is not null and not exists (select 1 from public.partners where id = e), 'C non vede E');
  perform growup_test.come(u1);  -- R, upline di E
  perform growup_test.ok(length(public.link_per_gestito(e)) = 32, 'chi sta sopra genera il link di E');
  perform growup_test.come(u5);  -- A, gestore di E
  k_e := public.link_per_gestito(e);
  perform growup_test.come(u8);
  perform growup_test.ok(public.entra_con_chiave(k_e)->>'stato' = 'attivo', 'E apre il suo link e diventa attiva');
  perform growup_test.come(u5);
  perform growup_test.deve_fallire(format('select public.link_per_gestito(%L)', e), 'E è attiva: niente più link dal gestore');

  -- ---- Fase 2: i calcoli del mese ----
  -- R ha tre linee frontali: A (con B, D ed E sotto), C e F.
  execute 'reset role';
  insert into public.partners (nome, sponsor_id, stato) values ('Fabio Test', r, 'gestito') returning id into f;
  insert into public.activities (partner_id, tipo, vp) values
    (r, 'ordine', 120), (b, 'ordine', 150), (c, 'ordine', 100), (f, 'ordine', 110), (e, 'rettifica', 40);
  -- personali: R 120, A 60, B 150, E 40, C 100, F 110, D 0
  -- gruppo:    B 190, A 250, C 100, F 110, R 580
  perform growup_test.come(u1);  -- R
  perform growup_test.ok((select count(*) from public.riepilogo_mese(current_date)) = 7, 'R vede 7 righe nel riepilogo');
  select * into x from public.riepilogo_mese(current_date) where partner_id = r;
  perform growup_test.ok(x.vp_personali = 120 and x.vp_gruppo = 580, 'VP personali e di gruppo di R');
  perform growup_test.ok(x.linee_attive = 3, 'R ha 3 linee attive (A 250, C 100, F 110)');
  perform growup_test.ok(x.percentuale = 3, 'R: 580 VP di gruppo = 3%');
  perform growup_test.ok(x.qualifica = 'path_to_bronze', 'R qualifica Path to Bronze nel mese');
  perform growup_test.ok(x.chiuso = false, 'il mese in corso è dal vivo');
  perform growup_test.come(u5);  -- A
  perform growup_test.ok((select count(*) from public.riepilogo_mese(current_date)) = 4, 'A vede solo sé, B, D ed E');
  perform growup_test.ok(not exists (select 1 from public.riepilogo_mese(current_date) where partner_id in (r, c, f)), 'A non vede sponsor né colleghi');
  select * into x from public.riepilogo_mese(current_date) where partner_id = a;
  perform growup_test.ok(x.vp_gruppo = 250 and x.linee_attive = 1 and x.percentuale = 3 and x.qualifica is null,
                         'A: 250 di gruppo, 1 linea attiva, 3%, nessuna qualifica (manca la terza linea)');
  perform growup_test.come(u4);  -- C
  perform growup_test.ok((select count(*) from public.riepilogo_mese(current_date)) = 1, 'C vede solo sé');
  perform growup_test.come(null);
  perform growup_test.deve_fallire('select * from public.riepilogo_mese(current_date)', 'anon non vede i riepiloghi');

  -- mesi chiusi: si registra nel mese in corso e, fino al giorno 5, nel precedente
  perform growup_test.come(u5);  -- A
  perform growup_test.deve_fallire(format($q$insert into public.activities (partner_id, tipo, vp, data) values (%L, 'ordine', 10, current_date - 70)$q$, a),
                                   'niente registrazioni in un mese chiuso');
  perform growup_test.deve_fallire(format($q$insert into public.activities (partner_id, tipo, data) values (%L, 'contatto', current_date + 3)$q$, a),
                                   'niente registrazioni nel futuro');
  mese_prec := (date_trunc('month', current_date) - interval '1 day')::date;
  if extract(day from (now() at time zone 'Europe/Rome')) > 5 then
    perform growup_test.deve_fallire(format($q$insert into public.activities (partner_id, tipo, vp, data) values (%L, 'rettifica', 10, %L)$q$, a, mese_prec),
                                     'dopo il giorno 5 il mese precedente è chiuso');
  else
    insert into public.activities (partner_id, tipo, vp, data) values (a, 'rettifica', 10, mese_prec);
  end if;
  perform growup_test.ok(not public.mese_aperto(current_date - 70), 'mese_aperto: due mesi fa no');
  perform growup_test.ok(public.mese_aperto(current_date), 'mese_aperto: oggi sì');

  -- storico: chiusura del mese precedente
  execute 'reset role';
  perform growup_test.ok(public.chiudi_mese(mese_prec) >= 7, 'chiusura del mese precedente');
  perform growup_test.come(u5);  -- A
  perform growup_test.ok((select count(*) from public.riepilogo_mese(mese_prec) where chiuso) = 4, 'A legge il mese chiuso, solo il suo gruppo');
  perform growup_test.ok((select count(*) from public.monthly_totals) = 4, 'A legge lo storico, solo il suo gruppo');
  perform growup_test.deve_fallire(format($q$insert into public.monthly_totals (partner_id, mese) values (%L, date '2026-01-01')$q$, a),
                                   'lo storico non si scrive dal telefono');
  perform growup_test.deve_fallire('update public.monthly_totals set vp_gruppo = 99999', 'lo storico non si modifica');
  perform growup_test.deve_fallire('select public.chiudi_mese(current_date)', 'la chiusura non si lancia dal telefono');
  perform growup_test.ok((select count(*) from public.percent_levels) = 7, 'tutti leggono le soglie delle percentuali');
  perform growup_test.ok(growup_test.righe('update public.percent_levels set vp_gruppo = 1') = 0, 'A non modifica le soglie');

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
