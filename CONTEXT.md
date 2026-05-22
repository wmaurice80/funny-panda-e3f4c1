# CalSnap — Contexte projet (Claude)
> Dernière mise à jour : 22 mai 2026

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
| Stockage local | IndexedDB via `idb` (DB_VERSION : 5) |
| Stockage cloud | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password, confirmation email désactivée) |
| Graphiques | Recharts |
| IA analyse photo | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) |
| IA estimation texte | Claude Haiku 4.5 |
| Base alimentaire | Open Food Facts API (gratuite) |
| Intégration santé | Google Fit OAuth PKCE (info seulement — pas, FC) |
| Type | PWA installable Android |
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
- **Google Fit TDEE** : abandonné comme source de calcul (données téléphone trop imprécises)
- **tdeeMesure critique** : doit être renseigné dans le profil (2 750) — si 0, fallback BMR×facteur
- **Stats bilan** : ne compte que les jours avec repas saisis (évite gonflement totalBurned)
- **Garmin API** : approbation en attente — intégration OAuth Garmin prévue dès réponse
- **tdee_sport** : colonne présente en Supabase mais plus utilisée en UI (toggle abandonné)

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
```
