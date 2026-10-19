-- Growup Team — 026: l'elenco dei clienti dal sito Amway (19 ottobre 2026).
-- Oltre all'export "Ordini", il partner può caricare l'export "Clienti" (letto solo sul telefono): si prendono solo nome,
-- codice cliente, telefono e data dell'ultimo ordine (niente email, niente indirizzo). L'ultimo ordine entra nello storico
-- senza numero; quando poi arriva l'export "Ordini" con lo stesso ordine, l'app ci scrive numero, valore e VP invece di
-- crearne un secondo: per questo servono i permessi di modifica su quelle tre colonne (sempre e solo sui propri ordini).

grant update (numero_amway, importo, vp) on public.ordini to authenticated;
