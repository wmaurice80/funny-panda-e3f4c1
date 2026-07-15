# CalSnap — Contexte projet (Claude)
> Dernière mise à jour : 10 juin 2026 (session 5)

## Vision produit
Application mobile PWA de suivi calorique et protéique par photo de repas et saisie manuelle, avec synchronisation cloud Supabase et intégration Google Fit / Garmin.

**Utilisateur :** wmaurice (119 kg, 37.7% MG, LBM ~74 kg, 5 séances muscu/semaine, télétravail, TDEE Garmin mesuré 2 750 kcal)

---

## Stack technique
| Couche | Techno |
|---|---|
| Framework | React 18 + Vite |
| Style | Tailwind CSS |
| Routing | React Router v6 |
| Stockage local | IndexedDB via `idb` (DB_VERSION : 6) |
| Stockage cloud | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password, confirmation email désactivée) |
| Graphiques | Recharts |
| IA analyse photo | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) |
| IA estimation texte | Claude Haiku 4.5 |
| Base alimentaire | Open Food Facts API (gratuite) |
| Intégration santé | Garmin (Edge Function OAuth, TDEE réel) + Google Fit OAuth PKCE (fallback TDEE ou info) |
| Type | PWA installable Android + APK natif Capacitor |
| Hébergement | Netlify — https://calsnapwmp.netlify.app |
| Repo GitHub | https://github.com/wmaurice80/funny-panda-e3f4c1 |

---

## Supabase
- Project ID : lhcouyccseuyczcmatoa
- URL : https://lhcouyccseuyczcmatoa.supabase.co
- Tables : profiles, meals, activities, weights (RLS activé, GRANTs accordés)
- Colonne ajoutée : `profiles.tdee_sport` (integer, présente en base mais inutilisée en UI)
- Auth URL : https://calsnapwmp.netlify.app

## Google Fit OAuth
- Client ID : 1037089098433-8u13b923our1j9s4o4su4fru3lg4p5en.apps.googleusercontent.com
- Redirect URI : https://calsnapwmp.netlify.app/auth/google/callback
- Scopes : fitness.activity.read + fitness.body.read
- Tokens stockés dans localStorage (clés : gfit_access_token, gfit_refresh_token, gfit_expires_at)
- **Limitation** : Garmin ne sync pas `calories.expended` vers Google Fit — seuls pas, poids, FC disponibles
- **Rôle actuel** : affichage informatif uniquement (pas, cal détectées téléphone, FC) — n'impacte plus le calcul TDEE
- Garmin API officielle en attente d'approbation (demande soumise)

---

## Architecture fichiers clés
```
calsnap/src/
├── main.jsx (ErrorBoundary + AuthProvider + BrowserRouter)
├── App.jsx (routing + auth guard + sync spinner)
│   NO_NAV_ROUTES: /profil, /aliments, /migration, /auth/google/callback, /integrations
├── db.js (IndexedDB v5 — stores: profile, meals, activities, weights)
├── lib/
│   ├── supabase.js
│   ├── AuthContext.jsx (sync Supabase au SIGNED_IN ET à la restauration de session)
│   ├── supabaseDb.js (push*/pull* CRUD Supabase — inclut tdee_sport même si inutilisé UI)
│   ├── syncManager.js (dual-write IndexedDB + Supabase fire-and-forget)
│   └── googleFit.js (OAuth PKCE, fetchAllDayData, fetchDailyTDEE — info seulement)
├── utils/
│   ├── bmr.js (calculateBMR, calculateTDEE, getEffectiveTDEE, calculateCible, calculateProteinGoal)
│   │   ACTIVITY_FACTORS recalibrés hors sport : sédentaire 1.2 / léger 1.3 / modéré 1.38 / actif 1.5 / extrême 1.7
│   ├── stats.js (getMonthlyData, getMonthBilan, getWeeklyTrends — isSportDay si activités ce jour)
│   └── sports.js
├── pages/
│   ├── Dashboard.jsx (BilanCard, GoogleFitCard, ProteinCard, PoidsWidget)
│   ├── Profile.jsx (BMR, TDEE Garmin mesuré, % MG + estimation Navy, objectif)
│   ├── Repas.jsx (CameraCapture + galerie + AnalyseResult éditable)
│   ├── Aliments.jsx (Open Food Facts + IA texte + ProteinSources + DrinkSources)
│   ├── Activites.jsx (saisie manuelle — historique + impact TDEE)
│   ├── Stats.jsx (graphiques + navigateur journalier ← → + tendances semaines datées)
│   ├── Poids.jsx, Historique.jsx, Migration.jsx
│   ├── Auth.jsx, GoogleFitCallback.jsx, Integrations.jsx
│   └── Poids.jsx
└── components/
    ├── BottomNav.jsx (4 onglets : Accueil, Repas, Activités, Stats)
    ├── CameraCapture.jsx (getUserMedia — contourne bug Android capture)
    ├── GoogleFitCard.jsx (pas + cal détectées info + FC — TDEE dynamique supprimé)
    ├── AnalyseResult.jsx (items éditables + bouton ↻ IA par item)
    ├── ProteinSources.jsx, DrinkSources.jsx
    ├── MealCard.jsx, ActivityCard.jsx
    └── MonthlyChart.jsx, MonthBilan.jsx, WeeklyTrends.jsx
```

---

## Logique métier clé

### Calcul calorique
```
BMR = Mifflin-St Jeor

TDEE effectif = tdeeMesure Garmin (profil) si renseigné, sinon BMR × facteur activité
  → facteurs calibrés hors sport (sport géré via activités manuelles) :
    sédentaire 1.2 / léger 1.3 / modéré 1.38 (~2 800) / actif 1.5 / extrême 1.7

TDEE du jour = TDEE effectif + calories activités manuelles saisies ce jour

Cible = TDEE du jour − déficit objectif (perte −250/500/750, prise +250/500)

Bilan net = ingérées − cible
Déficit réel = TDEE du jour − ingérées

Barre de progression (tricolore) :
  Vert   : ingérées ≤ cible → déficit actif, perte de poids
  Orange : cible < ingérées ≤ TDEE → déficit annulé, maintien
  Rouge  : ingérées > TDEE → surplus, prise de poids
```

### Calcul protéines
```
Si masseGrasse renseigné → LBM = poids × (1 − MG%) → objectif = LBM × 2.3 g
Sinon → poids × PROTEIN_FACTORS[niveauActivite]
wmaurice : 74 kg LBM × 2.3 = 170 g/j

Seuil anti-catabolisme musculaire = 75% de l'objectif (= 1.6 g/kg LBM minimum)
Barre protéines tricolore :
  Rouge   : < 75% → risque catabolisme
  Orange  : 75–100% → zone attention
  Cyan    : ≥ 100% → objectif atteint
```

### Estimation masse grasse (méthode Navy)
```
Hommes : BF% = 495 / (1.0324 - 0.19077 × log10(taille - cou) + 0.15456 × log10(hauteur)) - 450
Femmes : BF% = 495 / (1.29579 - 0.35004 × log10(taille + hanches - cou) + 0.22100 × log10(hauteur)) - 450
Disponible dans Profil → section rétractable sous le champ % MG
```

### Stats — navigateur journalier
```
Bilan par jour navigable ← → (remplace l'ancien tableau)
Affiche : date, ingérées, cible 🏋️/repos, bilan net, protéines
cibleJour = burned_ce_jour − déficit (burned = tdeeMesure + sport saisi ce jour)
Indicateur 🏋️ si activités enregistrées ce jour
Tendances hebdo : labels "1–7 mai", "8–14 mai"… (plus de S1/S2/S3)
```

### Google Fit — comportement actuel
- **Rôle** : affichage informatif uniquement (pas, calories actives détectées téléphone, FC)
- N'impacte plus le calcul TDEE ni la cible
- Garmin ne sync pas calories → Google Fit : confirmé définitivement
- En attente API Garmin officielle pour intégration native

### Sync multi-appareils
- Dual-write : IndexedDB en premier + Supabase fire-and-forget
- Au login ET à la restauration de session → pull Supabase → IndexedDB
- Service Worker : network-first (pas de cache stale)

---

## Profil utilisateur wmaurice
| Paramètre | Valeur |
|---|---|
| Poids | 119 kg |
| % Masse grasse | 37.7% |
| LBM | ~74 kg |
| TDEE mesuré Garmin (repos) | 2 750 kcal/j |
| TDEE Garmin jours de sport | ~3 500–4 000 kcal/j |
| Objectif protéines | 170 g/j (LBM × 2.3) |
| Seuil anti-catabolisme | 127 g/j (75% de 170 g) |
| Sport | 5 séances muscu/semaine — saisies manuellement dans Activités |
| Mode de vie | Télétravail (niveauActivite = modéré → ~2 800 kcal/j) |

---

## Sprints livrés
| Sprint | Contenu |
|---|---|
| S1-S4 | PWA + BMR + Photo IA + Journal + Sport + Graphiques |
| S5 | Catégories repas + Open Food Facts + Historique |
| S6 | Objectif calorique + Suivi poids + Build prod |
| S7 | Protéines (LBM) + Sources protéines + Boissons (cl) |
| M-S1 | Auth Supabase + Schéma SQL + RLS |
| M-S2 | Dual-write sync + Migration IndexedDB→Supabase |
| M-S3+ | Google Fit OAuth + Pas + FC (TDEE Fit abandonné — Garmin ne sync pas) |
| M-S4 | Refonte calcul TDEE + barre tricolore cible + barre protéines seuil 75% |
| M-S5 | Navigateur journalier Stats + tendances datées + estimation MG Navy |

---

## Bugs connus / décisions techniques
- **Caméra Android** : `capture="environment"` bugué → utilise `getUserMedia` (CameraCapture.jsx)
- **Garmin calories** : non disponibles via Google Fit — définitivement confirmé
- **Google Fit TDEE** : utilisé comme fallback si pas de Garmin today (disclaimer ambre affiché)
- **tdeeMesure critique** : doit être renseigné dans le profil (2 750) — si 0, fallback BMR×facteur
- **Stats bilan** : ne compte que les jours avec repas saisis (évite gonflement totalBurned)
- **APK — Google Fit OAuth** : origin `https://localhost` non autorisée par Google → Phase 3 (URL scheme custom)
- **APK — clé Anthropic exposée** : `VITE_ANTHROPIC_API_KEY` dans le bundle APK → Phase 4 (proxy Edge Function)
- **tdee_sport** : colonne présente en Supabase mais plus utilisée en UI (toggle abandonné)
- **Date de naissance Supabase** : colonne `date_naissance` à créer si pas encore présente (`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_naissance date`)

## Variables Netlify à maintenir
```
VITE_ANTHROPIC_API_KEY
VITE_SUPABASE_URL=https://lhcouyccseuyczcmatoa.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
VITE_GOOGLE_CLIENT_ID=1037089098433-...
VITE_GOOGLE_CLIENT_SECRET=GOCSPX-pCjmtfqYua5M-...
```

## Commandes
```bash
npm run dev -- --host   # dev local
npm run build           # build prod
git add -A && git commit -m "..." && git push  # deploy auto Netlify

# APK Capacitor
npm run build && npx cap sync android   # sync dist → Android
# Puis Android Studio : Build → Build APK(s)
# APK : android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Résumé de session — 22 mai 2026

### Corrections et améliorations livrées
| # | Fichier(s) | Description |
|---|---|---|
| 1 | `src/lib/claudeApi.js` (nouveau) | Wrapper centralisé appels Anthropic — retry backoff exponentiel 3×(1s/2s/4s) sur 529/503 |
| 2 | `Repas.jsx`, `Aliments.jsx`, `AnalyseResult.jsx` | Refacto : utilisent tous `callClaude()` — suppression de la duplication fetch |
| 3 | `Dashboard.jsx` | Barre protéines : seuil "atteint" à 95% (au lieu de 100%) → cyan dès 95% |
| 4 | `Activites.jsx` | Suppression encart warning Google Fit |
| 5 | `Activites.jsx` | Section Garmin rendue dépliable (fermée par défaut, badge "À venir") |
| 6 | `utils/stats.js` | Fix tendances hebdo : `getWeeklyTrends` filtre `ingested > 0` comme `getMonthBilan` — les jours sans repas ne tiraient plus la moyenne à la baisse |
| 7 | `Dashboard.jsx` | Réorganisation accueil : BilanCard → ProteinCard → TDEE+BMR côte à côte (grid) → reste. `StatCard` prop `compact` pour demi-largeur |

### Git
- Tag `v1.0.0-webapp` créé sur `main` — snapshot PWA stable
- Branche `roadmap/native-monetisation` créée pour les sprints backlog P1/P2/P3

---

## Résumé de session — 26 mai 2026

### Corrections et améliorations livrées
| # | Fichier(s) | Description |
|---|---|---|
| 1 | `Repas.jsx`, `AnalyseResult.jsx` | Prompts IA modifiés : protéines avec décimales (ex: 12.5g au lieu de 12g) — précision nutritionnelle accrue |
| 2 | `AnalyseResult.jsx` | Bouton supprimer (×) en haut à droite de chaque aliment détecté — permet de retirer les faux positifs avant validation |
| 3 | `Activites.jsx` | Formulaire durée : 2 champs séparés (heures + minutes) au lieu d'un seul champ "minutes" — UX améliorée pour séances longues |
| 4 | `Activites.jsx` | Import rapide Garmin parse maintenant aussi les heures (ex: "2h 30min 350 kcal") |
| 5 | `utils/stats.js`, `WeeklyTrends.jsx` | Calcul et affichage du solde net de masse grasse hebdomadaire (formule : netBalance / 7700 kcal = kg) — vert si perte, rouge si gain |
| 6 | `utils/bmr.js` | Validation formules : Mifflin-St Jeor (BMR) + facteurs d'activité calibrés = optimales, rien à changer |

### Git
- Commits `7f89650`, `748ed42` (fix syntaxe), `3e67399` pushés sur `main`
- Merge `roadmap/native-monetisation` → `main` pour déploiement Netlify

### Bugs corrigés
- **Erreur build Netlify** : balise `</div>` en trop dans `Activites.jsx` empêchait la compilation — corrigée avant déploiement
- **Cache navigateur/PWA** : changements invisibles jusqu'à hard refresh + merge vers `main`

---

## Epic GARMIN-SYNC — Synchronisation Python → Supabase
> Ajouté le 26 mai 2026 | Branche : feature/garmin-python-sync | Tag base : v1.0.2

### Sprint 1 — Fondations & Fetch

#### US-01 · Auth Garmin sécurisée
- Credentials depuis `.env` (GARMIN_EMAIL, GARMIN_PASSWORD)
- Token `garth` mis en cache dans `~/.garth` (évite re-login à chaque run, valide ~60 jours)
- `GarminConnectAuthenticationError` → arrêt immédiat, jamais de retry (intervention humaine)
- `python sync.py --test-auth` → `✓ Connecté en tant que [prénom]`

#### US-02 · Fetch daily summary (TDEE mesuré)
- `get_stats(date)` → champ `totalKilocalories`
- UPDATE `profiles.tdee_mesure` uniquement si valeur > 0
- Si données absentes (journée incomplète) → skip + warning

#### US-03 · Fetch activités du jour
- `get_activities_by_date(date, date)` — durée en secondes ÷ 60 = minutes
- Mapping `activityType.typeKey` → type CalSnap : running→course, cycling→velo, swimming→natation, walking→marche, strength_training→musculation, hiit→hiit, yoga→yoga, *→autre
- Déduplication via `garmin_activity_id` (UPSERT — nécessite migration Supabase)
- Note auto : `"Importé Garmin — [activityName]"`

#### US-04 · Push Supabase robuste
- Auth via `SUPABASE_SERVICE_ROLE_KEY` (bypass RLS)
- Retry 3× backoff exponentiel (1s/2s/4s) sur 5xx
- Erreurs 4xx → log + skip (pas de retry)

### Sprint 2 — Robustesse & Poids

#### US-05 · Fetch poids Garmin
- `get_body_composition(startdate, enddate)`
- **Conversion** : `weight` retourné en **grammes** → ÷ 1000 → arrondi à 0.1 kg
  - Exemple : `79500 g ÷ 1000 = 79.5 kg`
- Si `weight = null` ou `weight = 0` → skip silencieux (pas de Garmin Scale ce jour)
- UPSERT sur contrainte UNIQUE(user_id, date)
- Si `bodyFat` disponible → UPDATE `profiles.masse_grasse` (arrondi à 0.1)
- Log : `[POIDS] 2026-05-26 → 79.5 kg (MG: 37.5%)`

#### US-06 · Mode --dry-run
- Affiche toutes les opérations sans écrire en base

#### US-07 · Fetch historique N jours
- `--days N` (défaut : 1) — délai 1s entre chaque jour

#### US-08 · Circuit breaker & rate limit
- Délai 1s entre appels Garmin
- HTTP 429 → wait Retry-After (défaut 60s) + retry 1×
- 3 erreurs consécutives → circuit breaker ouvert + arrêt
- Timeout par requête : 10s

#### US-09 · Config .env + config.yaml
- `.env` : GARMIN_EMAIL, GARMIN_PASSWORD, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CALSNAP_USER_ID
- `.env.example` + `config.example.yaml` fournis, `.env` dans `.gitignore`

#### US-10 · Cron automatique (P2)
- Cron 7h00 macOS (launchd) — log `~/.calsnap/sync.log`

### Migration Supabase requise
```sql
ALTER TABLE activities ADD COLUMN garmin_activity_id BIGINT;
CREATE UNIQUE INDEX idx_activities_garmin_id ON activities(user_id, garmin_activity_id);
```
Impact appli : zéro — colonne nullable, ignorée par le code React.

### Risques clés
- Auth MFA headless → token cache garth, re-auth manuelle max 1x/60j
- SSO Garmin instable → pin version `garminconnect==X.Y.Z`
- Poids en grammes (pas kg) → conversion ÷1000 impérative

---

## Résumé de session — 27 mai 2026

### Objectif
Intégration Garmin sync mobile-first : Edge Function Supabase + bouton manuel dans l'app (pas un script Mac).

### Livré
| # | Fichier(s) | Description |
|---|---|---|
| 1 | `garmin_sync/` | Script Python complet (US-01→10) : auth, fetch TDEE/activités/poids, circuit breaker, dry-run, historique |
| 2 | `supabase/functions/garmin-sync/` | Edge Function Deno/TS fetch natif (zéro npm) — auth via tokens OAuth2 `GARMIN_TOKENS` |
| 3 | `supabase/functions/garmin-sync/garmin.ts` | loadTokens, refreshAccessToken auto, fetchDailySummary/Activities/Weight |
| 4 | `supabase/functions/garmin-sync/index.ts` | Orchestrateur POST, CORS calsnapwmp.netlify.app, rapport JSON |
| 5 | `supabase/functions/garmin-sync/cron.sql` | pg_cron 0 5 * * * (7h Paris) pour sync automatique |
| 6 | `src/pages/Integrations.jsx` | Card Garmin active : bouton "Sync Garmin maintenant", états résultat/erreur |
| 7 | `garmin_sync/migrations/001_add_garmin_activity_id.sql` | Colonne déduplication (nullable, zéro impact app) |
| 8 | `garmin_sync/garmin_auth.py` | Script one-shot pour générer tokens garth |

### Git
- Branche `feature/garmin-python-sync` → mergée sur `main` (commit `738806b`)
- Edge Function déployée sur Supabase : `lhcouyccseuyczcmatoa`
- Netlify auto-déployé depuis `main`

### Secrets Supabase configurés
- `CALSNAP_USER_ID` ✅
- `GARMIN_EMAIL` ✅
- `GARMIN_PASSWORD` ✅ (plus nécessaire — peut être supprimé)
- `GARMIN_TOKENS` ❌ **MANQUANT — bloquant**

### ⚠️ Blocage actuel — GARMIN_TOKENS manquant
L'Edge Function est déployée mais retourne `{"success":false,"error":"GARMIN_TOKENS non configuré"}` jusqu'à ce que le secret soit renseigné.

**Cause :** rate limit Garmin au niveau du compte (trop de tentatives d'auth programmatiques).
**Solution :** attendre 48-72h sans aucune tentative, puis exécuter :
```bash
GARMIN_EMAIL=wmaurice.peroumal@gmail.com \
GARMIN_PASSWORD=ton_mdp_garmin \
.venv/bin/python3 /Users/wmaurice/projects/calsnap/garmin_sync/garmin_auth.py
```
Le script affiche le JSON → copier dans Supabase :
```bash
supabase secrets set \
  GARMIN_TOKENS='{"access_token":"...","refresh_token":"...","expires_at":...,"token_type":"Bearer"}' \
  --project-ref lhcouyccseuyczcmatoa
```

**Alternative browser (si rate limit persiste) :** sur connect.garmin.com connecté, DevTools Console :
```javascript
JSON.stringify(Object.fromEntries(Object.keys(localStorage).filter(k => k.match(/token|auth|oauth|jwt|garmin/i)).map(k => [k, localStorage.getItem(k)])))
```

### Architecture finale Garmin sync
```
Mobile PWA → bouton "Sync Garmin" dans Intégrations
  → supabase.functions.invoke('garmin-sync', { body: { days: 1 } })
  → Edge Function Supabase (Deno, 81KB, fetch natif)
  → API connectapi.garmin.com (Bearer token)
  → Supabase : UPDATE profiles.tdee_mesure + UPSERT activities + UPSERT weights
  → App relit via sync login → données à jour

Cron automatique : 0 5 * * * (7h Paris) — pg_cron Supabase
Refresh token : automatique si access_token expiré
Re-auth manuelle : max 1x/60 jours (garmin_auth.py)
```

### Migration SQL à appliquer (si pas encore fait)
```sql
-- Dans Supabase SQL Editor
ALTER TABLE activities ADD COLUMN IF NOT EXISTS garmin_activity_id BIGINT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_activities_garmin_id ON activities(user_id, garmin_activity_id) WHERE garmin_activity_id IS NOT NULL;
```

### Notes techniques
- `npm:garmin-connect` incompatible Deno → remplacé par fetch natif
- `garth` 0.8.0 dépréciée mais fonctionnelle pour génération one-shot des tokens
- `GARMIN_EMAIL`/`GARMIN_PASSWORD` dans Supabase secrets inutiles désormais (peuvent être supprimés après génération tokens)
- Tokens valides ~60 jours, refresh_token relance sans re-auth

---

## Résumé de session — 27 mai 2026 (session 2)

### Fonctionnalité ajoutée
| # | Fichier(s) | Description |
|---|---|---|
| 1 | `src/pages/Stats.jsx` | Nouvelle ligne "📉 Déficit réel vs TDEE" dans le navigateur journalier ← → — affichée sous les 3 colonnes (Ingérées / Cible / Bilan), au-dessus des Protéines |

### Logique
```
Déficit réel = burned - ingested
  Vert  (-XXX kcal) : burned > ingested → déficit actif, perte de poids
  Rouge (+XXX kcal) : burned < ingested → surplus, prise de poids
Condition d'affichage : d.burned > 0 (jour avec données TDEE)
```

### Clarification technique
- **Tendances hebdomadaires** (`WeeklyTrends`) : utilisent la **dépense réelle** (`burned = tdee + sport`), pas la cible — confirmé dans `utils/stats.js` ligne 46
- **Déficit réel déjà présent dans Dashboard** (`BilanCard`) mais conditionnel à `caloriesIngerees > 0`

### Git
- Commit `a007c85` pushé sur `main` — Netlify auto-déployé

---

## Résumé de session — 27 mai 2026 (session 3)

### Fonctionnalité ajoutée
| # | Fichier(s) | Description |
|---|---|---|
| 1 | `src/pages/Aide.jsx` (nouveau) | Page glossaire interactive — 15 termes nutritionnels dépliables avec définition, formule et exemple concret |
| 2 | `src/App.jsx` | Import + route `/aide` ajoutée |
| 3 | `src/components/BottomNav.jsx` | 5ème onglet "Aide" avec icône point d'interrogation — padding réduit px-4→px-2 pour tenir sur mobile |

### Termes couverts dans le glossaire
BMR, TDEE, TDEE du jour, Cible, Déficit calorique, Surplus calorique, Bilan net, Déficit réel, LBM, % MG, Objectif protéines, Seuil anti-catabolisme, Macronutriments, kcal, Barre tricolore, Mifflin-St Jeor

### UX
- Cartes dépliables (accordéon) — une seule ouverte à la fois
- Barre de recherche filtrante par terme ou label
- Formules en `font-mono` sur fond sombre
- Exemples concrets basés sur le profil wmaurice (119 kg, LBM 74 kg, TDEE 2 750)

### Git
- Commit `3752e59` pushé sur `main` — Netlify auto-déployé

---

## Résumé de session — 1er juin 2026

### Objectifs
- Corriger la saisie décimale des protéines
- Faire fonctionner le sync Garmin (tokens + Edge Function)
- Implémenter la table `garmin_daily` pour stocker le TDEE réel par jour

### Corrections & fonctionnalités livrées
| # | Fichier(s) | Description |
|---|---|---|
| 1 | `src/components/AnalyseResult.jsx` | Fix saisie décimale : `Number()` → `valueAsNumber` + NaN guard — évite reset à 0 quand user tape "12." |
| 2 | `src/components/AnalyseResult.jsx` | Fix enregistrement bloqué : `step="0.5"` → `step="any"` + `inputMode="decimal"` — évite état invalide mobile sur valeurs IA comme 12.3g |
| 3 | `src/pages/Aliments.jsx` | Fix saisie manuelle protéines : ajout `step="0.1"` + `inputMode="decimal"` sur le champ protéines |
| 4 | `garmin_sync/garmin_auth.py` | Migration `garth` (déprécié) → `garminconnect 0.3.3` — 5 stratégies d'auth, extraction `di_token`/`di_refresh_token`/`di_client_id`/`display_name` |
| 5 | `supabase/functions/garmin-sync/garmin.ts` | Fix endpoint refresh → `diauth.garmin.com/di-oauth2-service/oauth/token` + Basic auth `di_client_id` ; `display_name` lu depuis GARMIN_TOKENS (plus d'appel API profile) |
| 6 | `supabase/functions/garmin-sync/index.ts` | `garmin_daily` upsert au lieu de `profiles.tdee_mesure` ; paramètre `offset` ajouté à `generateDates` |
| 7 | `supabase/functions/garmin-sync/cron.sql` | Cron mis à jour : `5 22 * * *` (UTC) = 00h05 Paris — sync avec `offset:1` (hier = journée complète à 23h59) |
| 8 | `garmin_sync/migrations/002_garmin_daily.sql` | Nouvelle table `garmin_daily(user_id, date, total_kcal, active_kcal, bmr_kcal, steps, synced_at)` |
| 9 | `src/lib/supabaseDb.js` | Ajout `pullGarminDaily(userId)` |
| 10 | `src/db.js` | DB_VERSION 5→6, store `garminDaily` + `putGarminDaily` + `getAllGarminDaily` |
| 11 | `src/lib/syncManager.js` | Ajout `syncGarminDaily(userId)` |
| 12 | `src/lib/AuthContext.jsx` | Branchement `syncGarminDaily` au login/session restore |
| 13 | `src/utils/stats.js` | Paramètre `garminDailyMap` — jours passés utilisent `garmin_daily.total_kcal` comme `burned` |
| 14 | `src/pages/Stats.jsx` | Chargement `garminDailyMap` depuis IndexedDB + badge `🔥 Garmin mesuré : X kcal` dans navigateur journalier |
| 15 | `src/pages/Dashboard.jsx` | Encart **Garmin mesuré** (dernière sync) — total kcal + décomposition BMR / Actif / Pas |

### Architecture TDEE — règle définitive
```
Jour en cours (live) :
  Cible = profiles.tdee_mesure (2 800 fixe) + sport manuel du jour − déficit
  → profiles.tdee_mesure jamais touché par les syncs

Jours passés (stats/historique) :
  Burned = garmin_daily.total_kcal (mesuré complet à 23h59)
  → cron 00h05 Paris avec offset=1 écrit la journée complète de la veille
```

### Secrets Supabase configurés
- `CALSNAP_USER_ID` = `12726d58-685b-43fc-b739-55ec4e52f9cb` ✅
- `GARMIN_TOKENS` (inclut `display_name`, `di_client_id`, `expires_at`) ✅
- `GARMIN_EMAIL` / `GARMIN_PASSWORD` (inutiles désormais, peuvent être supprimés)

### SQL manuel appliqué dans Supabase
```sql
-- Migration 002
CREATE TABLE garmin_daily (...) + RLS + GRANT authenticated
-- Permissions service_role
GRANT SELECT, INSERT, UPDATE ON public.garmin_daily TO service_role;
-- Cron pg_cron
SELECT cron.schedule('garmin-daily-sync', '5 22 * * *', $$...$$);
```

### Blocages résolus
- **garth déprécié** → Cloudflare Garmin bloquait l'User-Agent → migré vers `garminconnect 0.3.3`
- **CALSNAP_USER_ID placeholder** → FK constraint silencieuse → UUID réel configuré
- **`service_role` sans GRANT** → `permission denied for table garmin_daily` → GRANT appliqué
- **`display_name` introuvable** → endpoint `/personal-information` structure différente avec DI tokens → stocké dans GARMIN_TOKENS lors de `garmin_auth.py`

### Git
- Commits `491c032`, `fa532dc`, `870a213`, `90f592e`, `ec783bb`, `8ee7582`, `756e9b8`, `ba3f616` pushés sur `main`
- Dernière sync Garmin peuplée sur 14 jours (18–31 mai 2026)

---

## Résumé de session — 2 juin 2026

### Objectifs
Corriger tous les bugs du pipeline Garmin sync (Edge Function → Supabase → IndexedDB → UI).

### Bugs corrigés & fonctionnalités livrées
| # | Fichier(s) | Description |
|---|---|---|
| 1 | `garmin.ts` | `garminActivityId` : `Number(id ?? 0)` → `id != null ? Number(id) : null` — évite violation contrainte unique sur 0 |
| 2 | `garmin.ts` | `fetchWeight` : champ `dailyWeightSummaries` → `dateWeightList` (vrai nom retourné par l'API Garmin) → poids enfin détecté |
| 3 | `index.ts` | UPSERT activités : si `garmin_activity_id` null → INSERT simple (pas d'UPSERT sur clé nulle) |
| 4 | `Stats.jsx` | Ajout listener `garmin-synced` pour rafraîchir `garminDailyMap` après sync manuelle |
| 5 | `Integrations.jsx` | Sync manuelle envoie `days:2` (aujourd'hui + hier) pour corriger les données de la veille |
| 6 | `index.ts` | Mode `debug:true` : retourne `rawDailySummary` + `rawWeight` + `rawActivities` bruts pour diagnostic |
| 7 | SQL Supabase | `GRANT SELECT, INSERT, UPDATE ON activities TO service_role` + idem sur `weights` |
| 8 | SQL Supabase | Index `idx_activities_garmin_id` : partiel `WHERE IS NOT NULL` → index standard (PostgREST ne supporte pas les index partiels pour `onConflict`) |
| 9 | `supabaseDb.js` | Ajout `pullGarminActivitiesForDates(userId, dates)` |
| 10 | `syncManager.js` | Ajout `syncGarminActivities(userId, dates)` — dédup par date+note, insère dans IndexedDB |
| 11 | `Integrations.jsx` | Appel `syncGarminActivities` après sync → activités visibles dans Activités + bilan du jour |
| 12 | `Dashboard.jsx` | Bouton ⟳ dans encart Garmin mesuré — sync complète (TDEE + activités + poids) sans quitter l'accueil |
| 13 | `Dashboard.jsx` | `garmin-synced` recharge aussi `totalSport` (pas seulement `lastGarminEntry`) |
| 14 | `Dashboard.jsx` | Feedback visuel ✓ vert / ✗ rouge 3-4s après sync — plus de spinner muet |
| 15 | `garmin.ts` | `stats.steps` → `stats.totalSteps` (vrai champ Garmin) — Pas enfin correct (était 0) |
| 16 | `types.ts` + `garmin.ts` + `index.ts` | Stockage de `lastSyncTimestampGMT` dans `garmin_daily.device_last_sync` |
| 17 | `supabaseDb.js` | Pull `device_last_sync` depuis Supabase |
| 18 | `Dashboard.jsx` | Affiche "⌚ Montre sync à HH:MM" sous le total kcal — indique la fraîcheur de la donnée |
| 19 | `Activites.jsx` | Suppression encart "Importer depuis Garmin Connect — À venir" (intégration réelle dans Intégrations) |
| 20 | `AuthContext.jsx` | Fix restauration activités Garmin après déco/reco : `id: null` → `DataError` IDB silencieuse → dédup par date+note + strip id avant `addActivity` |

### SQL manuel appliqué dans Supabase (cette session)
```sql
-- Index activités : partiel → standard (requis par PostgREST onConflict)
DROP INDEX IF EXISTS idx_activities_garmin_id;
CREATE UNIQUE INDEX idx_activities_garmin_id ON activities(user_id, garmin_activity_id);

-- GRANTs service_role manquants sur tables existantes
GRANT SELECT, INSERT, UPDATE ON public.activities TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.weights TO service_role;

-- Colonne fraîcheur sync device
ALTER TABLE garmin_daily ADD COLUMN IF NOT EXISTS device_last_sync timestamptz;
```

### Architecture sync Garmin — flux complet
```
Bouton ⟳ Dashboard (ou Sync dans Intégrations)
  → supabase.functions.invoke('garmin-sync', { days: 2 })
  → Edge Function : fetch daily summary + activités + poids
  → UPSERT garmin_daily + UPSERT activities (si garmin_activity_id) + UPSERT weights
  → syncGarminDaily(userId)  → garminDaily IndexedDB mis à jour
  → syncGarminActivities(userId, dates)  → activités Garmin dans IndexedDB (dédup note+date)
  → dispatchEvent('garmin-synced')
     ├── Dashboard : reload garminRows + activities → lastGarminEntry + totalSport mis à jour
     └── Stats     : reload garminDailyMap → burned jours passés mis à jour

Login / session restore (AuthContext) :
  → pullAllActivities → activités manuelles (id valide) : addActivity direct
                     → activités Garmin (id null)       : dédup date+note, addActivity sans id
```

### Note sur le délai TDEE Garmin
La montre sync vers Garmin Connect app (Bluetooth) puis l'app sync vers serveurs Garmin.
L'API retourne `totalKilocalories` uniquement après la 2ème étape.
`device_last_sync` (affiché dans l'encart) indique l'heure réelle des dernières données disponibles.
Le cron de 00h05 Paris enregistre le total définitif de la veille (journée complète).

### Git
- Commits `e54e5ad` → `6e445af` pushés sur `main`
- Edge Function redéployée à chaque fix

---

---

## Résumé de session — 10 juin 2026

### Objectifs
- Garmin TDEE en temps réel (pas seulement dernier jour sync)
- Google Fit comme source TDEE de fallback pour APK sans Garmin
- Guide aide Google Fit dans Intégrations
- APK Android via Capacitor (Phase 0 — build + tests)
- Fix Stats : cible = même logique que Dashboard TDEE
- Fix Profil : âge dynamique depuis date de naissance
- Fix APK : CORS Garmin sync, permissions caméra

### Livraisons
| # | Fichier(s) | Description |
|---|---|---|
| 1 | `Dashboard.jsx` | TDEE priorité : Garmin aujourd'hui > Google Fit > tdeeMesure+sport. `todayGarminEntry` state séparé (date = today). Badge `⌚ Garmin` / `🏃 GFit` / `🏋️`. |
| 2 | `googleFit.js` | Fix double-BMR : `total = expended` (BMR inclus), `active = expended - bmr` — plus de double-compte |
| 3 | `GoogleFitCard.jsx` | Prop `tdeeSource` → tuile violet + "✓ utilisé dans le bilan" si `gfit` actif. Décomposition BMR/actif. |
| 4 | `Integrations.jsx` | Accordéon `GoogleFitHelp` : 4 étapes setup, rôle TDEE, tableau précision par type d'appareil |
| 5 | `utils/stats.js` | `burned` : utilise Garmin dès qu'il dépasse tdee+sport (aujourd'hui inclus, plus seulement jours passés) |
| 6 | `utils/bmr.js` | Export `getAge(profile)` : calcul dynamique depuis `dateNaissance`, fallback `profile.age ?? 30`. `calculateBMR` accepte full profile. |
| 7 | `Profile.jsx` | Champ date de naissance (remplace âge statique). Label "X ans". Validation tolère legacy sans `dateNaissance`. |
| 8 | `supabaseDb.js` | `pushProfile`/`pullProfile` : `date_naissance` ↔ `dateNaissance`. Rétrocompat `age` préservée. |
| 9 | `capacitor.config.ts` | Config Capacitor : appId `com.wmaurice.calsnap`, `androidScheme: 'https'` (WebView origin = `https://localhost`) |
| 10 | `android/app/build.gradle` | Fix kotlin-stdlib duplicate class : force `1.8.22` sur jdk7/jdk8/stdlib via `resolutionStrategy` |
| 11 | `android/AndroidManifest.xml` | Permissions : CAMERA, READ_MEDIA_IMAGES, READ_EXTERNAL_STORAGE (maxSdkVersion=32) |
| 12 | `supabase/functions/garmin-sync/index.ts` | CORS dynamique : `ALLOWED_ORIGINS` = Netlify + `https://localhost` + `capacitor://localhost` — fix sync APK |
| 13 | `package.json` | `@capacitor/cli@^8.4.0` + `@capacitor/android@^8.4.0` en devDeps. Scripts `cap:sync`, `cap:build`. |

### Règle TDEE définitive (après cette session)
```
Garmin aujourd'hui (total_kcal > 0)  → TDEE = max(garmin, tdeeMesure+sport)
Google Fit aujourd'hui (total > 0)   → TDEE = gfit total (fallback si pas Garmin)
Sinon                                → TDEE = tdeeMesure + sport manuel
```
- Garmin présent → GFit ignoré pour le calcul (mais affiché dans GoogleFitCard)
- GFit utilisé → disclaimer ambre affiché sur Dashboard

### APK Capacitor — état phase 0 (✅ livré)
- Build APK généré : `android/app/build/outputs/apk/debug/app-debug.apk`
- Installé sur Android, testé :
  - ✅ App charge, connexion OK
  - ✅ Sync Garmin fonctionne (après fix CORS Edge Function + redéploiement manuel Dashboard)
  - ✅ Camera accès OK (après ajout permissions AndroidManifest)
  - ✅ Google Fit, IndexedDB, Supabase — fonctionnels
- Branche : `feature/capacitor-android` — **merge main en cours de validation**

### Bugs corrigés (APK)
- **CORS Garmin sync** : Edge Function n'autorisait que Netlify → ajout `https://localhost` + `capacitor://localhost`
- **Camera refusée** : AndroidManifest.xml manquait CAMERA + READ_MEDIA_IMAGES
- **Kotlin stdlib duplicate** : `jdk7/jdk8 1.6.21` vs `stdlib 1.8.x` → force `1.8.22` via resolutionStrategy
- **SDK Android path** : dossier `/Users/wmaurice/Library/Android/sdk` à créer manuellement avant setup

### Branches actives
| Branche | État | Description |
|---|---|---|
| `main` | ✅ stable | PWA + stats/profile fixes + CORS fix |
| `feature/capacitor-android` | 🔄 validation | APK build + Capacitor config |

### Prochaines phases APK (backlog)
| Phase | Tickets | Description |
|---|---|---|
| Phase 3 | APK-11 à 15 | OAuth Custom URL Scheme Google Fit (origin `https://localhost` non autorisée par Google) |
| Phase 4 | APK-16 à 18 | Proxy clé API Anthropic via Edge Function (clé exposée dans APK bundle) |
| Phase 5 | APK-19 à 25 | Publication Play Store |

### SQL appliqué cette session
```sql
-- Aucun nouveau SQL — colonne date_naissance ajoutée côté app uniquement (supabaseDb.js)
-- (La colonne date_naissance dans profiles doit être créée si besoin)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_naissance date;
```

### Commandes Capacitor
```bash
npm run build && npx cap sync android   # sync dist → Android
# Puis Android Studio : Build → Build Bundle(s)/APK(s) → Build APK(s)
# APK : android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Résumé de session — 12 juin 2026

### Objectifs
- Fix libellé "déficit annulé" → "déficit réduit"
- P1-02 : Fallback Gemini 2.0 Flash si Claude indisponible
- Migration forcée PWA → APK (bannière + mur au 11 juillet)
- Distribution APK : keystore release + GitHub Releases
- Bandeau mise à jour automatique dans l'APK
- Phase 4 : proxy clés API via Supabase Edge Function `ai-proxy`
- Numéro de version affiché dans le Profil

### Livraisons
| # | Fichier(s) | Description |
|---|---|---|
| 1 | `Dashboard.jsx` | "déficit annulé" → "déficit réduit" en zone orange (ingérées > cible mais < TDEE) |
| 2 | `src/lib/claudeApi.js` | Fallback Gemini 2.0 Flash si Claude échoue — `callGemini()` traduit format Anthropic → Gemini, retour compatible |
| 3 | `src/components/MigrationAPK.jsx` (nouveau) | `MigrationBanner` (countdown J-30→J-0), `MigrationWall` (mur post-11/07), `useMigration()`, `useUpdateCheck()`, `UpdateBanner` |
| 4 | `src/App.jsx` | Intègre `MigrationWall` (avant loading), `MigrationBanner` + `UpdateBanner` (après auth) |
| 5 | `android/app/build.gradle` | `signingConfigs release` via `keystore.properties`, versionCode/Name auto-incrémentés |
| 6 | `android/keystore.properties.example` | Template keystore (gitignore sur `.keystore` + `keystore.properties`) |
| 7 | `scripts/release-apk.sh` (nouveau) | Script release : met à jour APP_VERSION + versionCode/Name, build web + cap sync, commit + push + instructions |
| 8 | `supabase/functions/ai-proxy/index.ts` (nouveau) | Edge Function Deno — JWT validé, CORS restreint, whitelist champs Anthropic (modèle fixé serveur-side), fallback Gemini, `Deno.serve` natif |
| 9 | `src/lib/claudeApi.js` | Refacto Phase 4 — tous les appels via `supabase.functions.invoke('ai-proxy')`, fallback local conditionné à `DEV===true`, interface publique inchangée |
| 10 | `src/pages/Profile.jsx` | Numéro de version `APP_VERSION` en bas de page (discret, gris) |
| 11 | `src/pages/Repas.jsx` | Commentaire de sécurité obsolète mis à jour |

### APK — versions publiées
| Version | versionCode | Contenu |
|---|---|---|
| v1.1.0 | 2 | Première release signée — distribution migration PWA |
| v1.2.0 | 3 | Phase 4 proxy IA (clés côté serveur) + Gemini fallback |
| v1.2.1 | 4 | Numéro de version dans le Profil |

### Keystore release
- Fichier : `calsnap-release.keystore` (racine projet, gitignore)
- Alias : `calsnap` — RSA 2048 bits, valide 10 000 jours
- Config : `android/keystore.properties` (gitignore)
- **⚠️ Sauvegarder impérativement — sans ce fichier impossible de mettre à jour l'APK**

### Distribution APK
- Repo GitHub rendu **public** (nécessaire pour le téléchargement des releases sans auth)
- APK hébergé sur GitHub Releases : `https://github.com/wmaurice80/funny-panda-e3f4c1/releases/latest/download/calsnap.apk`
- Migration PWA forcée le **11 juillet 2026** (mur complet dans la PWA, invisible dans l'APK)

### Phase 4 — Edge Function ai-proxy
- Déployée via API REST Supabase (CLI bloqué DNS en local)
- Secrets configurés : `ANTHROPIC_API_KEY` ✅ — `GEMINI_API_KEY` ❌ (à configurer pour activer fallback Gemini)
- JWT Supabase requis (401 si absent) — modèle fixé serveur-side (non surchargeable)
- `VITE_ANTHROPIC_API_KEY` à supprimer de Netlify pour finaliser la sécurisation
- Commande redéploiement futur :
  ```bash
  curl -s -X PATCH \
    "https://api.supabase.com/v1/projects/lhcouyccseuyczcmatoa/functions/ai-proxy" \
    -H "Authorization: Bearer <SUPABASE_ACCESS_TOKEN>" \
    -H "Content-Type: application/json" \
    -d "{\"body\": $(jq -Rs . < supabase/functions/ai-proxy/index.ts)}"
  ```

### Workflow release (règle permanente)
Toute modification doit être déployée sur **les deux cibles** :
1. **PWA** : `git push` → Netlify auto
2. **APK** : `./scripts/release-apk.sh vX.Y.Z` → Android Studio (Generate Signed APK → Release) → `gh release create vX.Y.Z calsnap.apk`

### Prochaines étapes
- Phase 5 : Publication Play Store (non prioritaire — distribution via GitHub Releases)
- P2-02 : TensorFlow.js food-101 offline
- P2-04 : Build iOS / TestFlight

---

## Résumé de session — 14 juin 2026

### Objectifs
- Configurer GEMINI_API_KEY (fallback IA)
- Supprimer VITE_ANTHROPIC_API_KEY de Netlify (sécurisation Phase 4)
- Phase 3 : OAuth Google Fit fonctionnel dans l'APK
- P2-01 : Caméra native Capacitor

### Livraisons
| # | Fichier(s) | Description |
|---|---|---|
| 1 | Supabase secrets | `GEMINI_API_KEY` configuré → fallback Gemini actif dans `ai-proxy` |
| 2 | Netlify | `VITE_ANTHROPIC_API_KEY` supprimé → Phase 4 sécurisation complète |
| 3 | `supabase/functions/gfit-callback/index.ts` | Edge Function OAuth callback : échange code↔token server-side, redirect vers custom scheme APK |
| 4 | `src/lib/googleFit.js` | Flux natif : `Browser.open()` + `handleNativeCallback()` (tokens via deep link), pas de PKCE. PWA : PKCE inchangé |
| 5 | `src/pages/GoogleFitCallback.jsx` | Détecte `access_token` (APK) vs `code` (PWA) et route vers le bon handler |
| 6 | `src/App.jsx` | `appUrlOpen` listener : intercepte `com.wmaurice.calsnap://auth/google/callback` → navigate |
| 7 | `android/app/src/main/AndroidManifest.xml` | Intent filter custom scheme `com.wmaurice.calsnap://` |
| 8 | `src/components/CameraCapture.jsx` | P2-01 : détecte Capacitor → `Camera.getPhoto()` natif (APK) vs `getUserMedia` (PWA) |
| 9 | `android/variables.gradle` | `minSdkVersion` 23→24 (requis par `@capacitor/camera`) |
| 10 | `android/variables.gradle` + `build.gradle` | `compileSdk/targetSdk` 35→36, AGP 8.7.2→8.9.1 (requis par `androidx.browser:1.9.0`) |
| 11 | Supabase secrets | `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` configurés (échange server-side) |

### Packages installés
- `@capacitor/browser@8.0.3` — Chrome Custom Tab pour OAuth
- `@capacitor/app@8.1.0` — deep link handler (`appUrlOpen`)
- `@capacitor/camera@8.2.0` — caméra native Android

### Architecture OAuth Google Fit APK — flux final
```
APK → Browser.open(authUrl) [pas de PKCE]
  → Chrome Custom Tab → Google OAuth
  → Google redirect → Supabase gfit-callback
  → Edge Function : POST /token (server-side) → tokens
  → HTTP 302 → com.wmaurice.calsnap://auth/google/callback?access_token=...
  → Android intercepte custom scheme → ferme Custom Tab
  → appUrlOpen → navigate /auth/google/callback
  → GoogleFitCallback.jsx détecte access_token → handleNativeCallback() → storeTokens()
```

### Google Cloud Console — redirect URIs autorisés
- `https://calsnapwmp.netlify.app/auth/google/callback` (PWA)
- `https://lhcouyccseuyczcmatoa.supabase.co/functions/v1/gfit-callback` (APK)

### APK versions publiées cette session
| Version | versionCode | Contenu |
|---|---|---|
| v1.3.0 | 5 | Phase 3 init (custom scheme — non fonctionnel) |
| v1.3.1 | 6 | Tentative App Links (assetlinks.json non commité) |
| v1.3.2 | 7 | Supabase Edge Function relay (JS redirect — bloqué Chrome) |
| v1.3.3 | 8 | P2-01 caméra native + AGP/SDK upgrades |
| v1.3.4 | 9 | Sans PKCE natif (token exchange côté client — 400) |
| v1.3.5 | 10 | ✅ Final : échange token server-side Supabase, `GOOGLE_CLIENT_SECRET` hors APK |

### Notes techniques
- Chrome Custom Tab bloque les redirections JS (`window.location.replace`) vers custom schemes → server-side 302 requis
- App Links (HTTPS) nécessitent `assetlinks.json` déployé ET vérifié à l'installation — fragile
- PKCE impossible dans le flux natif : le WebView peut être recréé entre `Browser.open()` et le retour du deep link → `code_verifier` perdu
- Solution définitive : échange server-side dans Edge Function → deep link avec tokens directement

---

## Backlog stratégique — IA locale + App native + Monétisation
> Ajouté le 22 mai 2026

### Architecture cible : Hybride 3 niveaux
```
Photo → [Niveau 1] Modèle local TF.js food-101 (offline, gratuit)
      → [Niveau 2] API cloud économique (Gemini Flash / OpenRouter) si connecté
      → [Niveau 3] Anthropic Haiku (actuel, premium)
```

### PRIORITÉ HAUTE — court terme
- [x] **P1-01** Retry avec backoff exponentiel sur erreurs 529/503 Anthropic ✅
- [x] **P1-02** Fallback Gemini Flash vision ✅ (via Edge Function ai-proxy)
- [x] **P1-03** Setup Capacitor + build Android test ✅ (feature/capacitor-android)

### PRIORITÉ MOYENNE — moyen terme
- [x] **P2-01** Plugin Capacitor Camera natif (remplace getUserMedia) ✅ v1.3.3
- [ ] **P2-02** TensorFlow.js food-101 local (analyse offline)
- [ ] **P2-03** Pipeline local → lookup Open Food Facts → macros
- [ ] **P2-04** Build iOS + soumission TestFlight

### PRIORITÉ BASSE — long terme
- [ ] **P3-01** RevenueCat + paywall in-app
- [ ] **P3-02** Gate photo IA = premium uniquement (colonne `profiles.plan`)
- [ ] **P3-03** Gemini Nano on-device Android (Pixel 8+ / Samsung S24+)
- [ ] **P3-04** Apple VisionKit food recognition (iOS)
- [ ] **P3-05** API Garmin native (quand approuvée)

### Modèle freemium cible
| Tier | Prix | Features |
|---|---|---|
| Gratuit | 0€ | Saisie manuelle, Open Food Facts, stats, sync cloud |
| Premium | ~3-5€/mois ou ~25€/an | Analyse photo IA, historique illimité, export CSV |

---

## Résumé de session — 15 juillet 2026

### 1. Fix synchro Garmin (tokens expirés)
- Refresh token du 1er juin arrivé en fin de vie (~60 j) → regénéré via `garmin_auth.py` (auth OK du 1er coup)
- Secret `GARMIN_TOKENS` mis à jour via `supabase secrets set` — **prochaine regénération attendue ~mi-septembre 2026**
- Sync testée : 14-15 juillet remontés (TDEE + activités)

### 2. Feature Alcool — impact sur la perte de gras
> Principe : ne PAS fausser les calculs kcal (le bilan énergétique reste roi), mais rendre visible
> la pause de lipolyse et l'écart balance vs estimation les semaines alcoolisées.

| # | Fichier(s) | Description |
|---|---|---|
| 1 | `DrinkSources.jsx` | Champ `alcoolG` sur toutes les portions alcoolisées (= cl × %vol × 0,789) — transmis dans l'item du panier |
| 2 | `utils/stats.js` | `getMonthlyData` : `alcoholG`/jour (somme des items). `getWeeklyTrends` : + `alcoholG`, `alcoholDays`, `scaleKg` (variation balance : moyenne pesées semaine vs réf 7 j précédents, fallback dernière pesée ≤14 j), `gapKg` (balance − estimé) |
| 3 | `WeeklyTrends.jsx` | Par semaine : ligne **Estimé / ⚖️ Balance / Écart** (kg) + badge `🍷 Xj · Yg` + message explicatif si semaine alcoolisée et écart > +0,15 kg |
| 4 | `Stats.jsx` | Navigateur journalier : ligne `🍷 Alcool : Xg · ~Yh sans brûlage de gras` (Y = g ÷ (0,1 × poids)) |
| 5 | `Dashboard.jsx` | `AlcoolCard` ambre sous la BilanCard (jours avec alcool) : grammes, kcal, durée de pause lipolyse |
| 6 | `Aide.jsx` | Entrée glossaire « Alcool et lipolyse » (formules + exemple 119 kg) |
| 7 | `MigrationAPK.jsx` | Le mur/bannière migration ne s'affiche plus en dev local (`import.meta.env.DEV`) |

### Notes techniques
- `alcoolG` vit dans le JSON `aliments` des repas → **zéro migration Supabase/IndexedDB**
- Constante physiologique : élimination éthanol ~0,1 g/kg/h ; alcool = 7 kcal/g
- Validé : build prod OK + test logique getWeeklyTrends sur données synthétiques
  (semaine déficit −500/j + 55 g alcool → Estimé −0,38 / Balance −0,07 / Écart +0,31 🍷)
- Les repas photo/IA ne détectent pas encore l'alcool — seule la saisie via Boissons compte (backlog)
- **Non commité** — la working tree contenait déjà du travail en cours (Health Connect, v1.7.x)
