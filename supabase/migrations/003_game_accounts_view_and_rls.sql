-- ======================================
-- GAME_ACCOUNTS VIEW + RLS GAME_ACCOUNT_LINKS
-- ======================================
-- 
-- Objectif : Architecture API-first
-- - game_account_links = source de vérité (écriture via Edge Functions uniquement)
-- - game_accounts = VIEW dérivée (lecture frontend uniquement)
--
-- ======================================

-- 1. CRÉER LA VIEW game_accounts
--    Dérivée de game_account_links avec jointure games
--    Filtre : revoked_at IS NULL

CREATE OR REPLACE VIEW public.game_accounts AS
SELECT 
  gal.id,
  gal.user_id,
  gal.game_id,
  COALESCE(g.name, g.slug, 'Unknown') AS game,
  gal.username,
  CASE 
    WHEN gal.provider = 'steam' THEN 'Steam'
    ELSE gal.provider
  END AS platform,
  CASE 
    WHEN gal.provider = 'steam' THEN true
    ELSE false
  END AS verified,
  gal.external_account_id,
  gal.linked_at AS created_at,
  gal.updated_at
FROM public.game_account_links gal
LEFT JOIN public.games g ON g.id = gal.game_id
WHERE gal.revoked_at IS NULL;

-- 2. GRANT SELECT sur la VIEW pour authenticated
GRANT SELECT ON public.game_accounts TO authenticated;

-- 3. RLS POUR game_account_links
--    - SELECT : user_id = auth.uid()
--    - INSERT/UPDATE/DELETE : interdits pour authenticated

-- Activer RLS sur game_account_links si pas déjà fait
ALTER TABLE public.game_account_links ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes policies INSERT/UPDATE/DELETE pour authenticated
DROP POLICY IF EXISTS "insert_own_game_account_links" ON public.game_account_links;
DROP POLICY IF EXISTS "update_own_game_account_links" ON public.game_account_links;
DROP POLICY IF EXISTS "delete_own_game_account_links" ON public.game_account_links;

-- Créer/remplacer la policy SELECT uniquement
DROP POLICY IF EXISTS "read_own_game_account_links" ON public.game_account_links;
CREATE POLICY "read_own_game_account_links" ON public.game_account_links
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 4. RLS POUR game_accounts (VIEW)
--    Les vues héritent des RLS de la table sous-jacente
--    Mais on peut ajouter une policy explicite pour plus de clarté

-- Activer RLS sur la VIEW
ALTER VIEW public.game_accounts SET (security_invoker = true);

-- Note: Les vues avec RLS utilisent les policies de la table sous-jacente
-- La policy SELECT sur game_account_links s'applique automatiquement

-- ======================================
-- VÉRIFICATION
-- ======================================
-- Après cette migration :
-- ✅ authenticated peut SELECT game_account_links (user_id = auth.uid())
-- ❌ authenticated NE PEUT PAS INSERT/UPDATE/DELETE game_account_links
-- ✅ authenticated peut SELECT game_accounts (VIEW, filtre automatique)
-- ✅ service_role peut tout faire (via RLS par défaut)
-- ======================================
