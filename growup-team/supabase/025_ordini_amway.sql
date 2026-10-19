-- Growup Team — 025: gli ordini dei clienti dal sito Amway (19 ottobre 2026).
-- Il partner carica l'export "Ordini" del sito Amway (letto solo sul telefono): per ogni ordine nome, codice cliente,
-- data, numero d'ordine, VP e valore. I prodotti non ci sono: il partner li aggiunge a mano se vuole.
-- Il numero d'ordine evita di importare due volte lo stesso ordine (l'export parte sempre da settembre).

alter table public.persone add column if not exists codice_cliente text check (codice_cliente ~ '^[0-9]{4,15}$');
grant insert (codice_cliente) on public.persone to authenticated;
grant update (codice_cliente) on public.persone to authenticated;

alter table public.ordini add column if not exists numero_amway text check (numero_amway ~ '^[0-9]{4,20}$');
alter table public.ordini add column if not exists importo numeric(10,2) check (importo >= 0 and importo <= 100000);
alter table public.ordini add column if not exists vp numeric(10,2) check (vp >= 0 and vp <= 100000);
create unique index if not exists ordini_numero_amway_idx on public.ordini (proprietario, numero_amway) where numero_amway is not null;
grant insert (numero_amway, importo, vp) on public.ordini to authenticated;
