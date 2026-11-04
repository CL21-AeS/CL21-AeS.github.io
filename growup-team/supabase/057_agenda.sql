-- ============================================================
-- Growup Team — 057: l'agenda di Lista e Clienti (4 novembre 2026, consegna 4 del piano «nuova Io»)
-- Decisioni di Stefano (tavola «Growup · pagina Io, prove», PIANO_IO.md): su ogni riga di Lista e Clienti un'icona
-- calendario apre «In agenda · nome» con Per cosa, Quando, Ora (facoltativa, avviso 30 minuti prima come in 040), Come e
-- Nota. Il giorno scelto la persona entra nella lista di oggi. «Fatto» chiede com'è andata e solo la risposta segna il
-- passo. Giorno, ora e nota usano le colonne che ci sono già (prossima_data, prossima_ora, prossima_nota); qui si
-- aggiungono soltanto «per cosa» e «come», con i valori ammessi. Nessuna tabella nuova, nessun drop, nessun dato toccato.
-- ============================================================

alter table public.persone add column if not exists prossima_per text
  check (prossima_per in ('contatto', 'contatto_persona', 'fissare_piano', 'piano', 'followup',
                          'consegna', 'riordino', 'come_trovato', 'far_provare', 'auguri', 'altro'));
alter table public.persone add column if not exists prossima_come text
  check (prossima_come in ('telefono', 'whatsapp', 'persona'));

-- come le altre colonne della prossima cosa: le scrive solo chi ha la persona (RLS di persone, invariata)
grant insert (prossima_per, prossima_come), update (prossima_per, prossima_come) on public.persone to authenticated;
