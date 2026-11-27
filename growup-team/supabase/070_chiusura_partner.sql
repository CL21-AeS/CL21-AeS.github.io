-- ============================================================
-- Growup Team — 070: chiusura come Partner = contatto, invito e piano fatti (27 novembre 2026, richiesta di Stefano)
-- Regola di Stefano: nessuno diventa Partner senza contatto, invito e piano. Il follow-up invece non è automatico
-- (si può sponsorizzare subito dopo il piano).
-- * Quando si segna un passo «chiusura» con esito «partner», non importato, il database aggiunge da solo i passi che
--   mancano tra «contatto», «invito» e «piano», ciascuno SOLO se la persona non ha già almeno un passo di quel tipo
--   (importati compresi): nessun doppio conteggio. Il follow-up non si aggiunge mai.
-- * Stessa data della chiusura, creati un istante prima (1, 2, 3 millesimi) e in quest'ordine: contatto, invito, piano,
--   poi la chiusura; così nell'elenco dei passi si leggono in sequenza.
-- * Ognuno è segnato come automatico e collegato alla sua chiusura: colonna nuova passi.segnato_con (l'id della chiusura;
--   vuota per tutti gli altri passi). Dal telefono non si scrive (manca nel permesso di insert): la mette solo il trigger.
-- * Il contatto e il piano automatici contano l'attività come quelli segnati a mano (la regola di passi_prima, 020);
--   l'invito non conta attività, come oggi. La fase diventa «piano».
-- * Cancellando la chiusura si cancellano anche i passi automatici collegati (on delete cascade) e le loro attività (la
--   regola di passi_dopo, 020). «Riapri il percorso» invece non li toglie.
-- * Solo l'esito Partner: Cliente, No, Non ora e Chiuso senza risposta restano come oggi.
-- Solo aggiunte e «create or replace»: una colonna nuova (vuota), il suo indice, una funzione e un trigger nuovi,
-- passi_prima che lascia l'istante scelto dal trigger ai passi automatici. Nessun dato cambiato: niente passi aggiunti
-- all'indietro alle chiusure già segnate. RLS invariata: i passi automatici hanno il proprietario della persona.
-- Per tornare a com'era: 070_chiusura_partner_togli.sql.
-- ============================================================

-- ---- Il passo automatico: collegato alla chiusura che l'ha creato ----
alter table public.passi add column if not exists segnato_con uuid references public.passi(id) on delete cascade;
create index if not exists passi_segnato_con_idx on public.passi (segnato_con) where segnato_con is not null;
comment on column public.passi.segnato_con is
  '070: passo aggiunto in automatico dalla chiusura come Partner (id della chiusura); vuoto per i passi segnati a mano';

-- ---- passi_prima (020): uguale, ma un passo automatico tiene l'istante che gli dà il trigger della chiusura ----
create or replace function public.passi_prima()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pr uuid;
  t  text;
begin
  select proprietario into pr from public.persone where id = new.persona_id;
  if pr is null or (auth.uid() is not null and pr is distinct from public.my_partner_id()) then
    raise exception 'non_autorizzato';
  end if;
  new.proprietario := pr;
  -- l'ordine dei passi dello stesso giorno; i passi automatici (070) stanno un istante prima della loro chiusura
  if new.segnato_con is null or new.creato_il is null then
    new.creato_il := clock_timestamp();
  end if;
  -- il passo conta l'attività del giorno (mai per i passi importati)
  t := case new.tipo when 'contatto' then 'contatto' when 'piano' then 'piano'
         when 'chiusura' then case when new.esito = 'cliente' then 'cliente' end end;
  new.attivita_id := null;
  if t is not null and not new.importato then
    insert into public.activities (partner_id, tipo, data) values (pr, t, new.data) returning id into new.attivita_id;
  end if;
  return new;
end;
$$;

-- ---- La chiusura come Partner aggiunge i passi che mancano ----
create or replace function public.passi_chiusura_partner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t text;
  k int := 0;
begin
  -- una chiusura alla volta per persona: niente doppioni se due arrivano insieme
  perform 1 from public.persone where id = new.persona_id for update;
  foreach t in array array['contatto', 'invito', 'piano'] loop
    k := k + 1;
    if not exists (select 1 from public.passi s where s.persona_id = new.persona_id and s.tipo = t) then
      insert into public.passi (persona_id, tipo, data, segnato_con, creato_il)
      values (new.persona_id, t, new.data, new.id, new.creato_il - make_interval(secs => (4 - k) / 1000.0));
    end if;
  end loop;
  return null;
end;
$$;
drop trigger if exists passi_chiusura_partner on public.passi;
create trigger passi_chiusura_partner after insert on public.passi
for each row when (new.tipo = 'chiusura' and new.esito = 'partner' and not new.importato)
execute function public.passi_chiusura_partner();

revoke execute on function public.passi_prima(), public.passi_chiusura_partner() from public, anon, authenticated;
