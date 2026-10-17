-- ============================================================
-- Growup Team — 014: copia di sicurezza dei dati
-- Il piano gratuito di Supabase non fa copie automatiche. copia_dati() restituisce in un solo file (JSON)
-- tutte le tabelle dell'app: dall'app, Stefano e Alessia (admin) la scaricano con "Copia dei dati" una volta
-- al mese e la conservano (Google Drive). I collegamenti dei telefoni (accessi) non servono: si rientra con i link.
-- ============================================================

create or replace function public.copia_dati()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.sono_admin() then
    raise exception 'non_autorizzato';
  end if;
  return jsonb_build_object(
    'app', 'Growup Team',
    'creata_il', now(),
    'tabelle', jsonb_build_object(
      'partners',           coalesce((select jsonb_agg(to_jsonb(t) order by t.creato_il) from public.partners t), '[]'),
      'activities',         coalesce((select jsonb_agg(to_jsonb(t)) from public.activities t), '[]'),
      'goals',              coalesce((select jsonb_agg(to_jsonb(t)) from public.goals t), '[]'),
      'monthly_goals',      coalesce((select jsonb_agg(to_jsonb(t)) from public.monthly_goals t), '[]'),
      'monthly_totals',     coalesce((select jsonb_agg(to_jsonb(t)) from public.monthly_totals t), '[]'),
      'obiettivi',          coalesce((select jsonb_agg(to_jsonb(t)) from public.obiettivi t), '[]'),
      'preferiti',          coalesce((select jsonb_agg(to_jsonb(t)) from public.preferiti t), '[]'),
      'settings',           coalesce((select jsonb_agg(to_jsonb(t)) from public.settings t), '[]'),
      'stage_requirements', coalesce((select jsonb_agg(to_jsonb(t) order by t.ordine) from public.stage_requirements t), '[]'),
      'percent_levels',     coalesce((select jsonb_agg(to_jsonb(t)) from public.percent_levels t), '[]')
    )
  );
end;
$$;

revoke execute on function public.copia_dati() from public, anon, authenticated;
grant execute on function public.copia_dati() to authenticated;
