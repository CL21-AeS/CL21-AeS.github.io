-- ============================================================
-- Growup Team — 010: Fase 2, blocco 3 — soglie delle etichette del gruppo
-- Si tarano dal Table editor (tabella settings), senza toccare il codice.
--   giorni_da_chiamare   oltre questi giorni senza aggiornamenti: "Da chiamare"
--   quota_contatti       sotto questa quota dell'obiettivo contatti (4 settimane): "Lista nomi"
--   piani_per_contatti   sotto questo rapporto piani/contatti: "Invito" (0,2 = 1 piano ogni 5 contatti)
--   piani_min_followup   da quanti piani in 4 settimane si guarda il follow-up
--   quota_vp_followup    sotto questa quota dell'obiettivo VP del mese: "Follow-up"
--   ordini_per_piani     sotto questo rapporto ordini/piani l'imbuto segnala il follow-up
-- ============================================================

insert into public.settings (chiave, valore, nota) values
  ('soglie_etichette',
   '{"giorni_da_chiamare": 7, "quota_contatti": 0.5, "piani_per_contatti": 0.2, "piani_min_followup": 2, "quota_vp_followup": 0.5, "ordini_per_piani": 0.3}',
   'Etichette del gruppo (Da chiamare, Lista nomi, Invito, Follow-up, In crescita) e collo di bottiglia dell''imbuto')
on conflict (chiave) do nothing;
