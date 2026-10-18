-- Growup Team — 021: la Lista su Io (18 ottobre 2026).
-- Su Io compaiono come promemoria tutte le persone con cui è iniziato un percorso (da Contattato in poi).
-- Ognuno può toglierne una da Io e rimetterla dalla sua scheda: è solo una sua scelta di vista.

alter table public.persone add column if not exists nascosta_io boolean not null default false;
grant update (nascosta_io) on public.persone to authenticated;
