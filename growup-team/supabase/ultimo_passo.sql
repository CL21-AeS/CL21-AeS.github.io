-- ============================================================
-- Growup Team — ULTIMO PASSO (da lanciare nell'SQL Editor, una volta sola)
-- Tabelle, regole e dati iniziali sono già stati installati da Claude.
-- Questo file:
--   1. aggiunge le due funzioni sulle chiavi (cambio chiave e chiave persa)
--   2. esegue i controlli dei permessi (dentro una transazione annullata: non lascia dati)
--   3. crea il profilo "Stefano e Alessia" e mostra i DUE LINK
-- Se un controllo fallisce si ferma con "CONTROLLO FALLITO" e il profilo NON viene creato.
-- Se tutto va bene, in Results compare una riga con link_personale e link_invito:
-- copiali subito. Il link personale si vede solo ora.
-- ============================================================

-- ---- 1. Funzioni sulle chiavi ----

create or replace function public.cambia_chiave()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid    uuid := auth.uid();
  pid    uuid := public.my_partner_id();
  chiave text := public.nuova_chiave_segreta();
begin
  if pid is null then
    raise exception 'non_autenticato';
  end if;
  update public.partners set chiave_hash = public.impronta(chiave) where id = pid;
  delete from public.accessi where partner_id = pid and user_id <> uid;
  return chiave;
end;
$$;

create or replace function public.nuova_chiave_per(p_partner uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  chiave text := public.nuova_chiave_segreta();
begin
  if auth.uid() is not null and not public.sono_admin() then
    raise exception 'non_autorizzato';
  end if;
  update public.partners set chiave_hash = public.impronta(chiave) where id = p_partner;
  if not found then
    raise exception 'partner_inesistente';
  end if;
  delete from public.accessi where partner_id = p_partner;
  return chiave;
end;
$$;

revoke execute on function public.cambia_chiave(), public.nuova_chiave_per(uuid) from public, anon, authenticated;
grant execute on function public.cambia_chiave(), public.nuova_chiave_per(uuid) to authenticated;

-- ---- 2. Controlli dei permessi ----

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
    perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'is_anonymous', true)::text, true);
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
insert into auth.users (id, aud, role) select
  ('00000000-0000-0000-0000-0000000000a' || i)::uuid, 'authenticated', 'authenticated'
from generate_series(1, 7) i;

insert into public.partners (nome, codice_invito, is_admin, stato)
values ('Radice Test', 'RRRR22', true, 'gestito');

create temp table ids (k text primary key, id uuid, chiave text);
grant select, insert, update on ids to anon, authenticated;
insert into ids select 'R', id, null from public.partners where codice_invito = 'RRRR22';
-- la chiave della radice, come la stampa 003_seed.sql
update ids set chiave = public.nuova_chiave_per(id) where k = 'R';
select pg_temp.ok(length((select chiave from ids where k='R')) = 32, 'chiave di 32 caratteri');
select pg_temp.ok((select chiave_hash from public.partners where codice_invito='RRRR22') <> (select chiave from ids where k='R'),
                  'nel database c''è solo l''impronta');

-- ---- Prima di entrare ----
select pg_temp.come(null);
select pg_temp.ok(public.sponsor_da_codice('rrrr22') = 'Radice Test', 'il link d''invito mostra il nome dello sponsor');
select pg_temp.deve_fallire('select id from public.partners', 'anon non legge i partner');
select pg_temp.deve_fallire('select id from public.activities', 'anon non legge le attività');
select pg_temp.deve_fallire($q$select public.entra_con_chiave('x')$q$, 'anon non entra senza sessione');

-- ---- Un telefono anonimo non collegato non vede niente ----
select pg_temp.come('00000000-0000-0000-0000-0000000000a7');
select pg_temp.ok(public.collega_profilo() is null, 'telefono nuovo: nessun profilo');
select pg_temp.ok((select count(*) from public.partners) = 0, 'telefono non collegato non vede partner');
select pg_temp.deve_fallire($q$select public.entra_con_chiave('00000000000000000000000000000000')$q$, 'chiave sbagliata');

-- ---- La radice entra con la sua chiave, da due telefoni (Stefano e Alessia) ----
select pg_temp.come('00000000-0000-0000-0000-0000000000a1');
select pg_temp.ok((public.entra_con_chiave((select chiave from ids where k='R')))->>'stato' = 'attivo', 'la radice entra e diventa attiva');
select pg_temp.ok(not (public.collega_profilo() ? 'chiave_hash'), 'il profilo non espone l''impronta');
select pg_temp.deve_fallire('select chiave_hash from public.partners', 'chiave_hash non leggibile');
select pg_temp.come('00000000-0000-0000-0000-0000000000a6');
select pg_temp.ok((public.entra_con_chiave(upper((select chiave from ids where k='R'))))->>'nome' = 'Radice Test', 'secondo telefono sullo stesso profilo');

-- ---- Iscrizioni dai link d'invito ----
select pg_temp.come('00000000-0000-0000-0000-0000000000a2');
select pg_temp.deve_fallire($q$select public.join_with_code('ZZZZ99','A',null)$q$, 'codice inesistente');
select pg_temp.deve_fallire($q$select public.join_with_code('RRRR22','A', current_date + 5)$q$, 'data di iscrizione nel futuro');
insert into ids select 'R2', null, (public.join_with_code('RRRR22', 'Anna Test', date '2026-07-01'))->>'chiave';
insert into ids select 'A', (public.collega_profilo()->>'id')::uuid, null;
select pg_temp.ok((public.collega_profilo()->>'sponsor_id')::uuid = (select id from ids where k='R'), 'A agganciata a R');
select pg_temp.deve_fallire($q$select public.join_with_code('RRRR22','A',null)$q$, 'secondo profilo dallo stesso telefono');
reset role;
update public.partners set codice_invito = 'AAAA22' where id = (select id from ids where k='A');

select pg_temp.come('00000000-0000-0000-0000-0000000000a3');
insert into ids select 'B', ((public.join_with_code('aaaa22', 'Bruno Test', null, 'path_to_bronze'))->'profilo'->>'id')::uuid, null;
select pg_temp.come('00000000-0000-0000-0000-0000000000a4');
insert into ids select 'C', ((public.join_with_code('RRRR22', 'Carla Test', null))->'profilo'->>'id')::uuid, null;
reset role;
select pg_temp.ok((select sponsor_id from public.partners where id = (select id from ids where k='B'))
                  = (select id from ids where k='A'), 'B agganciato ad A');

-- ---- Visibilità: io e la mia downline, mai sopra né di lato ----
select pg_temp.come('00000000-0000-0000-0000-0000000000a2');  -- A
select pg_temp.ok((select count(*) from public.partners) = 2, 'A vede solo sé e B');
select pg_temp.ok(not exists (select 1 from public.partners where id in (select id from ids where k in ('R','C'))),
                  'A non vede lo sponsor né la collega C');
select pg_temp.deve_fallire('select * from public.accessi', 'accessi non leggibili');
select pg_temp.come('00000000-0000-0000-0000-0000000000a3');  -- B
select pg_temp.ok((select count(*) from public.partners) = 1, 'B vede solo sé');
select pg_temp.come('00000000-0000-0000-0000-0000000000a6');  -- R dal secondo telefono
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

-- ---- Obiettivi: settimana per contatti e piani, mese per i VP ----
insert into public.goals (partner_id, settimana, obiettivo_contatti, obiettivo_piani)
select id, date '2026-10-12', 10, 3 from ids where k='A';
insert into public.goals (partner_id, settimana, obiettivo_contatti, obiettivo_piani)
select id, date '2026-10-12', 12, 3 from ids where k='A'
on conflict (partner_id, settimana) do update
  set partner_id = excluded.partner_id, settimana = excluded.settimana,
      obiettivo_contatti = excluded.obiettivo_contatti, obiettivo_piani = excluded.obiettivo_piani;
select pg_temp.ok((select obiettivo_contatti from public.goals) = 12, 'A modifica i suoi obiettivi (upsert)');
insert into public.monthly_goals (partner_id, mese, obiettivo_vp) select id, date '2026-10-01', 100 from ids where k='A'
on conflict (partner_id, mese) do update set partner_id = excluded.partner_id, mese = excluded.mese, obiettivo_vp = excluded.obiettivo_vp;
select pg_temp.ok((select obiettivo_vp from public.monthly_goals) = 100, 'obiettivo VP del mese');
select pg_temp.deve_fallire($q$insert into public.goals (partner_id, settimana) select id, date '2026-10-13' from ids where k='A'$q$,
                  'la settimana parte di lunedì');
select pg_temp.deve_fallire($q$insert into public.monthly_goals (partner_id, mese) select id, date '2026-10-13' from ids where k='A'$q$,
                  'il mese parte dal giorno 1');
select pg_temp.deve_fallire($q$insert into public.goals (partner_id, settimana) select id, date '2026-10-12' from ids where k='B'$q$,
                  'A non scrive gli obiettivi di B');
select pg_temp.come('00000000-0000-0000-0000-0000000000a3');  -- B
select pg_temp.ok((select count(*) from public.goals) + (select count(*) from public.monthly_goals) = 0, 'B non vede gli obiettivi di A');

-- ---- Profilo: campi protetti ----
select pg_temp.come('00000000-0000-0000-0000-0000000000a2');  -- A
select pg_temp.deve_fallire($q$update public.partners set sponsor_id = null where id = public.my_partner_id()$q$, 'A non cambia sponsor');
select pg_temp.deve_fallire($q$update public.partners set is_admin = true where id = public.my_partner_id()$q$, 'A non si fa admin');
select pg_temp.deve_fallire($q$update public.partners set stato = 'gestito' where id = public.my_partner_id()$q$, 'A non cambia stato');
select pg_temp.deve_fallire($q$update public.partners set chiave_hash = 'x' where id = public.my_partner_id()$q$, 'A non scrive l''impronta');
select pg_temp.deve_fallire($q$insert into public.partners (nome) values ('Fantasma')$q$, 'nessun profilo fuori da join_with_code');
select pg_temp.deve_fallire($q$insert into public.accessi (user_id, partner_id) select auth.uid(), id from ids where k='R'$q$,
                  'nessuno si collega da solo a un altro profilo');
select pg_temp.ok(pg_temp.righe('update public.partners set nome = ''Anna T.'' where id = public.my_partner_id()') = 1, 'A cambia il suo nome');
select pg_temp.ok(pg_temp.righe('update public.partners set nome = ''X'' where id = (select id from ids where k=''B'')') = 0,
                  'A non cambia il nome di B (attivo)');

-- ---- Chiavi: cambio e recupero ----
-- A entra anche dal computer (u5) con la chiave ricevuta all'iscrizione
select pg_temp.come('00000000-0000-0000-0000-0000000000a5');
select pg_temp.ok((public.entra_con_chiave((select chiave from ids where k='R2')))->>'nome' = 'Anna T.', 'A entra dal secondo dispositivo');
-- poi la cambia: il computer resta dentro, il telefono (u2) viene scollegato, la vecchia chiave non vale più
insert into ids select 'R2b', null, public.cambia_chiave();
select pg_temp.come('00000000-0000-0000-0000-0000000000a2');
select pg_temp.ok(public.collega_profilo() is null, 'cambio chiave: gli altri dispositivi sono scollegati');
select pg_temp.deve_fallire($q$select public.entra_con_chiave((select chiave from ids where k='R2'))$q$, 'la vecchia chiave non vale più');
select pg_temp.come('00000000-0000-0000-0000-0000000000a5');
select pg_temp.ok(public.collega_profilo()->>'nome' = 'Anna T.', 'chi ha cambiato la chiave resta dentro');
-- solo un admin genera una chiave per un altro
select pg_temp.deve_fallire($q$select public.nuova_chiave_per((select id from ids where k='B'))$q$, 'A non genera chiavi per B');
select pg_temp.come('00000000-0000-0000-0000-0000000000a1');  -- R admin
select pg_temp.ok(length(public.nuova_chiave_per((select id from ids where k='B'))) = 32, 'l''admin genera una chiave nuova per B');
select pg_temp.come('00000000-0000-0000-0000-0000000000a3');  -- B
select pg_temp.ok(public.collega_profilo() is null, 'chiave rigenerata: i vecchi dispositivi di B sono scollegati');

-- ---- Amministrazione ----
select pg_temp.come('00000000-0000-0000-0000-0000000000a5');  -- A
select pg_temp.ok((select count(*) from public.stage_requirements) = 8, 'tutti leggono le 8 tappe');
select pg_temp.ok(pg_temp.righe('update public.stage_requirements set vp_personali = 1') = 0, 'A non modifica i requisiti');
select pg_temp.come('00000000-0000-0000-0000-0000000000a6');  -- R admin
select pg_temp.ok(pg_temp.righe('update public.stage_requirements set descrizione = descrizione') = 8, 'l''admin modifica i requisiti');

-- ---- Prendere possesso di un profilo creato da altri, con la sua chiave ----
reset role;
insert into public.partners (nome, sponsor_id, stato, creato_da)
select 'Dario Test', id, 'gestito', id from ids where k='A';
insert into ids select 'D', id, public.nuova_chiave_per(id) from public.partners where nome = 'Dario Test';
insert into public.activities (partner_id, tipo, inserito_da)
select (select id from ids where k='D'), 'contatto', (select id from ids where k='A');
select pg_temp.come('00000000-0000-0000-0000-0000000000a7');
select pg_temp.ok((public.entra_con_chiave((select chiave from ids where k='D')))->>'stato' = 'attivo', 'D prende possesso e diventa attivo');
select pg_temp.ok((select count(*) from public.activities) = 1, 'D ritrova il suo storico');
select pg_temp.ok((select count(*) from public.partners) = 1, 'nessun duplicato');

-- ---- Nessuna tabella senza RLS ----
reset role;
select pg_temp.ok(not exists (select 1 from pg_tables where schemaname = 'public' and not rowsecurity),
                  'RLS attiva su tutte le tabelle');

do $$ begin raise notice 'TUTTI I CONTROLLI SUPERATI'; end $$;

rollback;


-- ---- 3. Il vostro profilo e i due link ----

with nuova as (
  select public.nuova_chiave_segreta() as k
), radice as (
  insert into public.partners (nome, is_admin, stato, chiave_hash)
  select 'Stefano e Alessia', true, 'gestito', public.impronta(k) from nuova
  where not exists (select 1 from public.partners where is_admin)
  returning codice_invito
)
select 'https://cl21-aes.github.io/growup-team/#chiave=' || nuova.k as link_personale,
       'https://cl21-aes.github.io/growup-team/#' || radice.codice_invito as link_invito
from nuova, radice;
