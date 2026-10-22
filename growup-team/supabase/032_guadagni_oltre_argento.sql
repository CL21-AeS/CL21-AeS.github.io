-- Growup Team — 032: le cifre al mese da Platino in su, e Argento senza incentivi Bronze (22 ottobre 2026).
-- Cifre indicative date da Stefano dal calcolatore dei guadagni Amway, calcolate con le linee qualificate che servono
-- alla qualifica più altre linee aperte (ideale 10.000 VP, almeno 4.000 VP). Le qualifiche Fondatori hanno la stessa
-- cifra della qualifica (è un mantenimento nel tempo): come obiettivo per la cifra l'app propone sempre quella senza
-- "Fondatore". Argento: 2.500 € al mese senza gli incentivi Bronze (circa 3.750 € se si arriva ad Argento mentre si
-- ricevono ancora). Solo aggiornamenti dei dati: nessun drop, nessuna cancellazione.

update public.stage_requirements set guadagno_mese = 2500,
  struttura_calcolo = '200 VP personali + 3 linee da 4.100 VP, senza incentivi Bronze (circa 3.750 € se arrivi ad Argento mentre ricevi ancora gli incentivi Bronze)'
 where chiave = 'argento';
update public.stage_requirements set guadagno_mese = 3000,
  struttura_calcolo = 'Argento ogni mese più altre linee aperte (ideale 10.000 VP, almeno 4.000 VP)'
 where chiave in ('platino', 'platino_fondatore');
update public.stage_requirements set guadagno_mese = 4000,
  struttura_calcolo = '20.000 VP di Volume Rubino al mese più altre linee aperte (ideale 10.000 VP, almeno 4.000 VP)'
 where chiave in ('rubino', 'rubino_fondatore');
update public.stage_requirements set guadagno_mese = 5000,
  struttura_calcolo = '2 linee al 21% più altre linee aperte (ideale 10.000 VP, almeno 4.000 VP)'
 where chiave in ('zaffiro', 'zaffiro_fondatore');
update public.stage_requirements set guadagno_mese = 8000,
  struttura_calcolo = '3 linee al 21% più altre linee aperte (ideale 10.000 VP, almeno 4.000 VP)'
 where chiave in ('smeraldo', 'smeraldo_fondatore');
update public.stage_requirements set guadagno_mese = 18000,
  struttura_calcolo = '6 linee al 21% più altre linee aperte (ideale 10.000 VP, almeno 4.000 VP)'
 where chiave in ('diamante', 'diamante_fondatore');
