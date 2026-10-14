-- ============================================================
-- Growup Team — controlli dei permessi (Fase 1)
-- Si lancia nell'SQL editor di Supabase DOPO 001, 002 e 003.
-- Lavora dentro una transazione e alla fine annulla tutto: non lascia dati.
-- Se un controllo fallisce si ferma con "CONTROLLO FALLITO: ...".
-- Se arriva in fondo stampa "TUTTI I CONTROLLI SUPERATI".
--
-- Struttura di prova:     R (radice)
--                        /         \
--                       A           C        A e C sono colleghi di pari livello
--                       |
--                       B
-- ============================================================

begin;

create function pg_temp.come(uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  if uid is null then
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config('request.jwt.claims', '', true);
    execute 'set local role anon';
  else
    perform set_config('request.jwt.claim.sub', uid::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
  end if;
end $$;

create function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'CONTROLLO FALLITO: %', msg; end if;
end $$;

create function pg_temp.deve_fallire(q text, msg text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    return;
  end;
  raise exception 'CONTROLLO FALLITO (doveva essere rifiutato): %', msg;
end $$;

-- conta le righe toccate da un update/delete (0 = la RLS l'ha nascosto)
create function pg_temp.righe(q text) returns int language plpgsql as $$
declare n int;
begin
  execute q; get diagnostics n = row_count; return n;
end $$;

-- ---- Preparazione (come amministratore del database) ----
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'test-r@growup.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a2', 'test-a@growup.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a3', 'test-b@growup.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a4', 'test-c@growup.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a5', 'test-d@growup.test', 'authenticated', 'authenticated');

insert into public.partners (user_id, nome, email, codice_invito)
values ('00000000-0000-0000-0000-0000000000a1', 'Radice Test', 'test-r@growup.test', 'RRRR22');

create temp table ids (k text primary key, id uuid);
grant select on ids to anon, authenticated;
insert into ids select 'R', id from public.partners where codice_invito = 'RRRR22';

-- ---- Prima del login ----
select pg_temp.come(null);
select pg_temp.ok(public.sponsor_da_codice('rrrr22') = 'Radice', 'il link mostra il nome dello sponsor');
select pg_temp.deve_fallire('select * from public.partners', 'anon non legge i partner');
select pg_temp.deve_fallire('select * from public.activities', 'anon non legge le attività');
select pg_temp.deve_fallire('select * from public.stage_requirements', 'anon non legge i requisiti');
select pg_temp.deve_fallire($q$select public.join_with_code('RRRR22','X',null)$q$, 'anon non si iscrive');

-- ---- Iscrizioni dai link ----
select pg_temp.come('00000000-0000-0000-0000-0000000000a2');
select pg_temp.ok(public.collega_profilo() is null, 'A non ha ancora un profilo');
select pg_temp.deve_fallire($q$select public.join_with_code('ZZZZ99','A',null)$q$, 'codice inesistente');
select pg_temp.deve_fallire($q$select public.join_with_code('RRRR22','A', current_date + 5)$q$, 'data di iscrizione nel futuro');
select pg_temp.ok((public.join_with_code('RRRR22', 'Anna Test', date '2026-07-01')).sponsor_id = (select id from ids where k='R'),
                  'A agganciata a R');
select pg_temp.deve_fallire($q$select public.join_with_code('RRRR22','A',null)$q$, 'secondo profilo per lo stesso account');
reset role;
insert into ids select 'A', id from public.partners where user_id = '00000000-0000-0000-0000-0000000000a2';
update public.partners set codice_invito = 'AAAA22' where id = (select id from ids where k='A');

select pg_temp.come('00000000-0000-0000-0000-0000000000a3');
select public.join_with_code('aaaa22', 'Bruno Test', null, 'path_to_bronze');
select pg_temp.come('00000000-0000-0000-0000-0000000000a4');
select public.join_with_code('RRRR22', 'Carla Test', null);
reset role;
insert into ids select 'B', id from public.partners where user_id = '00000000-0000-0000-0000-0000000000a3';
insert into ids select 'C', id from public.partners where user_id = '00000000-0000-0000-0000-0000000000a4';
select pg_temp.ok((select sponsor_id from public.partners where id = (select id from ids where k='B'))
                  = (select id from ids where k='A'), 'B agganciato ad A');

-- ---- Visibilità: io e la mia downline, mai sopra né di lato ----
select pg_temp.come('00000000-0000-0000-0000-0000000000a2');  -- A
select pg_temp.ok((select count(*) from public.partners) = 2, 'A vede solo sé e B');
select pg_temp.ok(not exists (select 1 from public.partners where id in (select id from ids where k in ('R','C'))),
                  'A non vede lo sponsor né la collega C');
select pg_temp.come('00000000-0000-0000-0000-0000000000a3');  -- B
select pg_temp.ok((select count(*) from public.partners) = 1, 'B vede solo sé');
select pg_temp.come('00000000-0000-0000-0000-0000000000a1');  -- R
select pg_temp.ok((select count(*) from public.partners) = 4, 'R vede tutta la downline a qualsiasi profondità');

-- ---- Attività ----
select pg_temp.come('00000000-0000-0000-0000-0000000000a2');  -- A
insert into public.activities (partner_id, tipo) select id, 'contatto' from ids where k='A';
insert into public.activities (partner_id, tipo, vp) select id, 'ordine', 60 from ids where k='A';
select pg_temp.ok((select inserito_da from public.activities where tipo='contatto') = (select id from ids where k='A'),
                  'inserito_da registrato dal server');
select pg_temp.deve_fallire($q$insert into public.activities (partner_id, tipo) select id, 'contatto' from ids where k='B'$q$,
                  'A non scrive attività di B (B è attivo)');
select pg_temp.deve_fallire($q$insert into public.activities (partner_id, tipo, inserito_da) select id, 'contatto', id from ids where k='A'$q$,
                  'inserito_da non si sceglie dal telefono');
select pg_temp.deve_fallire($q$insert into public.activities (partner_id, tipo) select id, 'ordine' from ids where k='A'$q$,
                  'un ordine senza VP');
select pg_temp.ok((select ultimo_aggiornamento from public.partners where id = (select id from ids where k='A')) is not null,
                  'ultimo_aggiornamento si muove quando A scrive');

select pg_temp.come('00000000-0000-0000-0000-0000000000a3');  -- B
insert into public.activities (partner_id, tipo) select id, 'piano' from ids where k='B';
select pg_temp.ok((select count(*) from public.activities) = 1, 'B non vede le attività di A');
select pg_temp.ok(pg_temp.righe('delete from public.activities where tipo = ''contatto''') = 0, 'B non cancella le attività di A');

select pg_temp.come('00000000-0000-0000-0000-0000000000a4');  -- C
select pg_temp.ok((select count(*) from public.activities) = 0, 'C non vede le attività della collega A');

select pg_temp.come('00000000-0000-0000-0000-0000000000a2');  -- A
select pg_temp.ok((select count(*) from public.activities) = 3, 'A vede le sue e quelle di B');
select pg_temp.ok(pg_temp.righe('update public.activities set quantita = 5 where tipo = ''piano''') = 0,
                  'A non modifica i dati di B (B è attivo)');
select pg_temp.ok(pg_temp.righe('delete from public.activities where tipo = ''contatto''') = 1, 'A cancella una sua attività');

-- ---- Obiettivi ----
insert into public.goals (partner_id, settimana, obiettivo_contatti, obiettivo_piani, obiettivo_vp)
select id, date '2026-10-12', 10, 3, 25 from ids where k='A';
-- così l'app salva le modifiche (upsert)
insert into public.goals (partner_id, settimana, obiettivo_contatti, obiettivo_piani, obiettivo_vp)
select id, date '2026-10-12', 12, 3, 25 from ids where k='A'
on conflict (partner_id, settimana) do update
  set partner_id = excluded.partner_id, settimana = excluded.settimana,
      obiettivo_contatti = excluded.obiettivo_contatti, obiettivo_piani = excluded.obiettivo_piani,
      obiettivo_vp = excluded.obiettivo_vp;
select pg_temp.ok((select obiettivo_contatti from public.goals) = 12, 'A modifica i suoi obiettivi');
select pg_temp.deve_fallire($q$insert into public.goals (partner_id, settimana) select id, date '2026-10-13' from ids where k='A'$q$,
                  'la settimana parte di lunedì');
select pg_temp.deve_fallire($q$insert into public.goals (partner_id, settimana) select id, date '2026-10-12' from ids where k='B'$q$,
                  'A non scrive gli obiettivi di B');
select pg_temp.come('00000000-0000-0000-0000-0000000000a3');  -- B
select pg_temp.ok((select count(*) from public.goals) = 0, 'B non vede gli obiettivi di A');

-- ---- Profilo: campi protetti ----
select pg_temp.come('00000000-0000-0000-0000-0000000000a2');  -- A
select pg_temp.deve_fallire($q$update public.partners set sponsor_id = null where user_id = auth.uid()$q$, 'A non cambia sponsor');
select pg_temp.deve_fallire($q$update public.partners set is_admin = true where user_id = auth.uid()$q$, 'A non si fa admin');
select pg_temp.deve_fallire($q$update public.partners set stato = 'gestito' where user_id = auth.uid()$q$, 'A non cambia stato');
select pg_temp.deve_fallire($q$insert into public.partners (nome) values ('Fantasma')$q$, 'nessun profilo fuori da join_with_code');
select pg_temp.ok(pg_temp.righe('update public.partners set nome = ''Anna T.'' where user_id = auth.uid()') = 1, 'A cambia il suo nome');
select pg_temp.ok(pg_temp.righe('update public.partners set nome = ''X'' where id = (select id from ids where k=''B'')') = 0,
                  'A non cambia il nome di B (attivo)');

-- ---- Amministrazione ----
select pg_temp.ok((select count(*) from public.stage_requirements) = 8, 'tutti leggono le 8 tappe');
select pg_temp.ok(pg_temp.righe('update public.stage_requirements set vp_personali = 1') = 0, 'A non modifica i requisiti');
reset role;
update public.partners set is_admin = true where id = (select id from ids where k='R');
select pg_temp.come('00000000-0000-0000-0000-0000000000a1');  -- R admin
select pg_temp.ok(pg_temp.righe('update public.stage_requirements set descrizione = descrizione') = 8, 'l''admin modifica i requisiti');

-- ---- Prendere possesso di un profilo già creato con la propria email ----
reset role;
insert into public.partners (nome, email, sponsor_id, stato, creato_da)
select 'Dario Test', 'TEST-D@growup.test', id, 'gestito', id from ids where k='A';
insert into public.activities (partner_id, tipo, inserito_da)
select p.id, 'contatto', (select id from ids where k='A') from public.partners p where p.nome = 'Dario Test';
select pg_temp.come('00000000-0000-0000-0000-0000000000a5');
select pg_temp.ok((public.collega_profilo()).stato = 'attivo', 'D prende possesso del profilo e diventa attivo');
select pg_temp.ok((select count(*) from public.activities) = 1, 'D ritrova il suo storico');
select pg_temp.ok((select count(*) from public.partners where nome = 'Dario Test') = 1, 'nessun duplicato');

-- ---- Nessuna tabella senza RLS ----
reset role;
select pg_temp.ok(not exists (select 1 from pg_tables where schemaname = 'public' and not rowsecurity),
                  'RLS attiva su tutte le tabelle');

do $$ begin raise notice 'TUTTI I CONTROLLI SUPERATI'; end $$;

rollback;
