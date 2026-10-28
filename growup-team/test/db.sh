#!/bin/sh
# Growup Team — controlli del database su un Postgres locale (16 o più recente).
# Crea un database vuoto, simula Supabase, installa tutto e lancia i controlli dei permessi.
# Si ferma al PRIMO errore (installazione o controlli) e in quel caso esce con codice 1:
# «TUTTI I CONTROLLI SUPERATI» compare solo se ogni passo è andato a buon fine.
# Uso, dalla cartella growup-team:   sh test/db.sh
# (serve un utente Postgres che possa creare database; il database di prova si cancella alla fine)
set -u
cd "$(dirname "$0")/.." || exit 1
DB="growup_prova_$$"
export PGOPTIONS="-c client_min_messages=warning"
PSQL="psql -X -q -v ON_ERROR_STOP=1 -d $DB"
esci(){ dropdb --if-exists "$DB" >/dev/null 2>&1; echo "$1"; exit "$2"; }

createdb "$DB" || esci "ERRORE: non riesco a creare il database di prova" 1

$PSQL -f test/stub_supabase.sql >/dev/null || esci "INSTALLAZIONE FALLITA in test/stub_supabase.sql (vedi l'errore qui sopra)" 1
$PSQL -f supabase/installa_tutto.sql >/dev/null || esci "INSTALLAZIONE FALLITA in supabase/installa_tutto.sql (vedi l'errore qui sopra)" 1

# L'installazione è completa? Ogni tabella e funzione creata in installa_tutto.sql deve esistere.
mancano=""
for t in $(grep -ioE 'create table (if not exists )?public\.[a-z0-9_]+' supabase/installa_tutto.sql | sed 's/.*public\.//' | sort -u); do
  [ "$($PSQL -At -c "select to_regclass('public.$t') is not null")" = t ] || mancano="$mancano tabella:$t"
done
for f in $(grep -ioE 'create (or replace )?function public\.[a-z0-9_]+' supabase/installa_tutto.sql | sed 's/.*public\.//' | sort -u); do
  [ "$($PSQL -At -c "select exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = '$f')")" = t ] || mancano="$mancano funzione:$f"
done
[ "$($PSQL -At -c "select count(*) from public.partners where is_admin")" = 1 ] || mancano="$mancano radice(Stefano e Alessia)"
[ -z "$mancano" ] || esci "INSTALLAZIONE INCOMPLETA, mancano:$mancano" 1

esito=$($PSQL -At -f supabase/tests_rls.sql 2>&1) || { echo "$esito" | grep -E "ERROR|ERRORE|FALLITO" | head -5; esci "CONTROLLI FALLITI" 1; }
echo "$esito" | tail -1 | grep -qx "TUTTI I CONTROLLI SUPERATI" || { echo "$esito" | tail -5; esci "CONTROLLI NON COMPLETATI" 1; }
esci "TUTTI I CONTROLLI SUPERATI" 0
