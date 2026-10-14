/* Configurazione di Growup Team.
   Qui vanno SOLO l'indirizzo del progetto Supabase e la sua chiave PUBBLICA
   (anon / publishable): sono fatte per stare nel browser e sono sicure perché
   ogni tabella ha la Row Level Security attiva (supabase/002_rls.sql).
   MAI la chiave service_role o qualsiasi altra chiave segreta: il repository è pubblico. */
window.GROWUP_CONFIG = {
  supabaseUrl: "https://mxpuvmggexjyieylmfss.supabase.co",
  supabaseKey: "sb_publishable_4OGHTbJBMGDoonaKsDp_HQ_b3eCkAfo"
};
