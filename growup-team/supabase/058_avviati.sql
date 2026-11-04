-- ============================================================
-- Growup Team — 058: il punto con l'upline e la fonte dei nomi nuovi (4 novembre 2026, consegna 6 del piano «nuova Io»)
-- Decisioni di Stefano: chi è iscritto da più di 30 giorni (avviato) vede «Per iniziare»: il suo perché, il punto con la
-- sua upline (generico: sceglie lui con chi farlo, si segna solo il giorno e quando è fatto) e l'import della mappa se ha
-- un gruppo. Quando aggiunge un nome alla Lista sceglie la fonte (Conoscenza, Dal vivo, Social), facoltativa; nel
-- cruscotto vede i nomi nuovi della settimana, senza obiettivo.
-- Il punto con l'upline lo scrive solo il partner stesso (policy partners_modifico_me: solo la propria riga); la fonte
-- sta sulla persona della Lista, che resta solo di chi l'ha scritta (RLS di persone, invariata).
-- Solo colonne nuove con i valori ammessi: nessuna tabella nuova, nessun drop, nessun dato toccato.
-- ============================================================

alter table public.partners add column if not exists punto_upline date
  check (punto_upline is null or punto_upline between date '2020-01-01' and date '2100-01-01');
alter table public.partners add column if not exists punto_upline_fatto date
  check (punto_upline_fatto is null or punto_upline_fatto between date '2020-01-01' and date '2100-01-01');
grant select (punto_upline, punto_upline_fatto), update (punto_upline, punto_upline_fatto) on public.partners to authenticated;

alter table public.persone add column if not exists fonte text check (fonte in ('conoscenza', 'dal_vivo', 'social'));
grant insert (fonte), update (fonte) on public.persone to authenticated;
