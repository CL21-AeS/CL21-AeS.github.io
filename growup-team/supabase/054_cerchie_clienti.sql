-- ============================================================
-- Growup Team — 054: le cerchie anche nei Clienti (2 novembre 2026).
-- Decisione di Stefano: le cerchie dei Clienti (per esempio Bellezza, Casa, Nutrizione) sono separate da quelle
-- della Lista: in Clienti si vedono solo le cerchie dei clienti, nella Lista solo quelle della Lista.
-- Una cerchia ha un tipo ('lista' o 'clienti'), scelto quando si crea e poi fisso; il nome è unico per tipo.
-- Le regole di accesso restano quelle della 053: le cerchie le vede e le cambia solo chi le crea.
-- ============================================================

alter table public.cerchie add column if not exists tipo text not null default 'lista';
alter table public.cerchie drop constraint if exists cerchie_tipo_check;
alter table public.cerchie add constraint cerchie_tipo_check check (tipo in ('lista', 'clienti'));

drop index if exists public.cerchie_nome_unico;
create unique index if not exists cerchie_nome_unico on public.cerchie (proprietario, tipo, lower(btrim(nome)));

-- il tipo si sceglie solo creando la cerchia (si rinomina solo il nome)
grant insert (id, nome, tipo) on public.cerchie to authenticated;
