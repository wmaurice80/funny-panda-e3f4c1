-- =============================================================================
-- CalSnap — Schéma Supabase (PostgreSQL)
-- =============================================================================
-- Instructions :
--   1. Ouvrir le SQL Editor dans votre projet Supabase
--   2. Coller ce fichier en entier et cliquer sur "Run"
--   3. Ce script est IDEMPOTENT : il peut être rejoué sans erreur
--      (DROP IF EXISTS + CREATE OR REPLACE sur les fonctions/triggers)
--
-- Vérifications après exécution (voir section en bas du fichier) :
--   - Les 4 tables doivent apparaître dans Table Editor
--   - Authentication > Policies doit lister les RLS policies
--   - Les index sont visibles dans Database > Indexes
-- =============================================================================


-- =============================================================================
-- NETTOYAGE (idempotence)
-- =============================================================================

-- Les DROP TABLE CASCADE suppriment automatiquement les triggers associés
DROP TABLE IF EXISTS weights    CASCADE;
DROP TABLE IF EXISTS activities CASCADE;
DROP TABLE IF EXISTS meals      CASCADE;
DROP TABLE IF EXISTS profiles   CASCADE;

DROP FUNCTION IF EXISTS handle_updated_at() CASCADE;


-- =============================================================================
-- TABLE : profiles
-- Une ligne par utilisateur authentifié (id = auth.users.id)
-- =============================================================================

CREATE TABLE profiles (
  id               UUID          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  prenom           TEXT,
  poids            NUMERIC(5,1),                          -- kg, ex : 72.5
  taille           INTEGER,                               -- cm, ex : 175
  age              INTEGER,
  sexe             TEXT          CHECK (sexe IN ('homme', 'femme')),
  niveau_activite  TEXT,                                  -- sedentaire, leger, modere, actif, tres_actif
  objectif         TEXT          CHECK (objectif IN ('perte', 'maintien', 'prise')),
  vitesse_objectif TEXT,                                  -- lente, moderee, rapide
  tdee_mesure      INTEGER,                               -- kcal/jour mesuré
  masse_grasse     NUMERIC(4,1),                          -- %, ex : 18.5
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  profiles              IS 'Profil utilisateur CalSnap (1 ligne par compte)';
COMMENT ON COLUMN profiles.tdee_mesure  IS 'TDEE mesuré en kcal/jour (peut différer du calcul théorique)';
COMMENT ON COLUMN profiles.masse_grasse IS 'Pourcentage de masse grasse';


-- =============================================================================
-- TABLE : meals
-- Repas journaliers avec liste d'aliments en JSONB
-- Structure JSONB aliments : [{ nom, calories, proteines, portion }]
-- =============================================================================

CREATE TABLE meals (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date            DATE          NOT NULL,
  heure           TIME,                                   -- ex : 12:30
  categorie       TEXT,                                   -- petit_dejeuner, dejeuner, diner, collation
  aliments        JSONB         NOT NULL DEFAULT '[]',    -- tableau d'aliments
  total_calories  INTEGER       NOT NULL DEFAULT 0,       -- kcal
  total_proteines NUMERIC(6,1)  NOT NULL DEFAULT 0,       -- g
  note            TEXT,
  fiabilite       TEXT,                                   -- exacte, estimee, approximative
  synced_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  local_id        INTEGER                                 -- id IndexedDB (migration uniquement)
);

COMMENT ON TABLE  meals          IS 'Repas enregistrés par l''utilisateur';
COMMENT ON COLUMN meals.aliments IS 'JSON Array : [{ "nom": "Poulet", "calories": 165, "proteines": 31, "portion": 100 }]';
COMMENT ON COLUMN meals.local_id IS 'Référence à l''id autoIncrement IndexedDB — utile pour la migration, peut être NULL après';


-- =============================================================================
-- TABLE : activities
-- Activités physiques journalières
-- =============================================================================

CREATE TABLE activities (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date             DATE         NOT NULL,
  heure            TIME,
  type             TEXT,                                  -- course, velo, natation, musculation, etc.
  duree            INTEGER,                               -- minutes
  calories_brulees INTEGER      NOT NULL DEFAULT 0,       -- kcal
  note             TEXT,
  synced_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  local_id         INTEGER                                -- id IndexedDB (migration uniquement)
);

COMMENT ON TABLE  activities          IS 'Activités physiques enregistrées';
COMMENT ON COLUMN activities.duree    IS 'Durée en minutes';
COMMENT ON COLUMN activities.local_id IS 'Référence à l''id autoIncrement IndexedDB — utile pour la migration';


-- =============================================================================
-- TABLE : weights
-- Pesées quotidiennes (1 entrée par jour maximum)
-- =============================================================================

CREATE TABLE weights (
  id        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date      DATE          NOT NULL,
  poids     NUMERIC(5,1)  NOT NULL,                       -- kg
  synced_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT weights_user_date_unique UNIQUE (user_id, date)  -- 1 pesée par jour par user
);

COMMENT ON TABLE weights IS 'Pesées quotidiennes (une entrée par jour maximum par utilisateur)';


-- =============================================================================
-- INDEX
-- Optimisation des requêtes filtrées par user_id + date
-- =============================================================================

-- meals : liste des repas d'un jour
CREATE INDEX idx_meals_user_date
  ON meals (user_id, date DESC);

-- meals : recherche par user uniquement (dashboard, stats globales)
CREATE INDEX idx_meals_user_id
  ON meals (user_id);

-- activities : activités d'un jour
CREATE INDEX idx_activities_user_date
  ON activities (user_id, date DESC);

-- weights : courbe de poids
CREATE INDEX idx_weights_user_date
  ON weights (user_id, date DESC);

-- Index GIN sur JSONB aliments pour les requêtes sur les noms d'aliments
CREATE INDEX idx_meals_aliments_gin
  ON meals USING GIN (aliments);


-- =============================================================================
-- TRIGGER : updated_at automatique sur profiles
-- =============================================================================

CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();


-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- Chaque utilisateur ne peut lire/écrire que ses propres données
-- =============================================================================

-- ---- profiles ---------------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: select own"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles: insert own"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles: update own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles: delete own"
  ON profiles FOR DELETE
  USING (auth.uid() = id);

-- ---- meals ------------------------------------------------------------------
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meals: select own"
  ON meals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "meals: insert own"
  ON meals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "meals: update own"
  ON meals FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "meals: delete own"
  ON meals FOR DELETE
  USING (auth.uid() = user_id);

-- ---- activities -------------------------------------------------------------
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activities: select own"
  ON activities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "activities: insert own"
  ON activities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "activities: update own"
  ON activities FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "activities: delete own"
  ON activities FOR DELETE
  USING (auth.uid() = user_id);

-- ---- weights ----------------------------------------------------------------
ALTER TABLE weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weights: select own"
  ON weights FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "weights: insert own"
  ON weights FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "weights: update own"
  ON weights FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "weights: delete own"
  ON weights FOR DELETE
  USING (auth.uid() = user_id);


-- =============================================================================
-- VÉRIFICATIONS (à coller séparément dans le SQL Editor si besoin)
-- =============================================================================

-- 1. Lister les tables créées
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--   ORDER BY table_name;

-- 2. Vérifier que RLS est activé
-- SELECT tablename, rowsecurity
--   FROM pg_tables
--   WHERE schemaname = 'public';

-- 3. Lister toutes les RLS policies
-- SELECT schemaname, tablename, policyname, cmd, qual
--   FROM pg_policies
--   WHERE schemaname = 'public'
--   ORDER BY tablename, policyname;

-- 4. Lister les index
-- SELECT indexname, tablename, indexdef
--   FROM pg_indexes
--   WHERE schemaname = 'public'
--   ORDER BY tablename, indexname;

-- 5. Vérifier le trigger updated_at
-- SELECT trigger_name, event_object_table, action_timing, event_manipulation
--   FROM information_schema.triggers
--   WHERE trigger_schema = 'public';

-- 6. Tester la structure d'un repas (hors RLS, en tant que service_role)
-- SELECT id, user_id, date, categorie, aliments, total_calories
--   FROM meals
--   LIMIT 5;

-- =============================================================================
-- FIN DU SCHÉMA
-- =============================================================================
