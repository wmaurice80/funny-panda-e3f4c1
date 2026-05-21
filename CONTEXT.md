# CalSnap — Contexte projet (Claude)
> Dernière mise à jour : 21 mai 2026

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
| Intégration santé | Google Fit OAuth PKCE |
| Type | PWA installable Android |
| Hébergement | Netlify — https://calsnapwmp.netlify.app |
| Repo GitHub | https://github.com/wmaurice80/funny-panda-e3f4c1 |

---

## Supabase
- Project ID : lhcouyccseuyczcmatoa
- URL : https://lhcouyccseuyczcmatoa.supabase.co
- Tables : profiles, meals, activities, weights (RLS activé, GRANTs accordés)
- Auth URL : https://calsnapwmp.netlify.app

## Google Fit OAuth
- Client ID : 1037089098433-8u13b923our1j9s4o4su4fru3lg4p5en.apps.googleusercontent.com
- Redirect URI : https://calsnapwmp.netlify.app/auth/google/callback
- Scopes : fitness.activity.read + fitness.body.read
- Tokens stockés dans localStorage (clés : gfit_access_token, gfit_refresh_token, gfit_expires_at)
- **Limitation** : Garmin ne sync pas `calories.expended` vers Google Fit — seuls pas, poids, FC disponibles
- TDEE dynamique = calories.expended si > BMR, sinon TDEE Garmin mesuré (fallback)

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
│   ├── supabaseDb.js (push*/pull* CRUD Supabase)
│   ├── syncManager.js (dual-write IndexedDB + Supabase fire-and-forget)
│   └── googleFit.js (OAuth PKCE, fetchAllDayData, fetchDailyTDEE, etc.)
├── utils/
│   ├── bmr.js (calculateBMR, calculateTDEE, getEffectiveTDEE, calculateCible, calculateProteinGoal)
│   ├── stats.js (getMonthlyData, getMonthBilan — compte uniquement les jours trackés)
│   └── sports.js
├── pages/
│   ├── Dashboard.jsx (BilanCard, GoogleFitCard, ProteinCard, PoidsWidget)
│   ├── Profile.jsx (BMR, TDEE Garmin mesuré, % MG, objectif)
│   ├── Repas.jsx (CameraCapture + galerie + AnalyseResult éditable)
│   ├── Aliments.jsx (Open Food Facts + IA texte + ProteinSources + DrinkSources)
│   ├── Activites.jsx (saisie manuelle + avertissement Google Fit)
│   ├── Stats.jsx (graphiques + bilan journalier tableau)
│   ├── Poids.jsx, Historique.jsx, Migration.jsx
│   ├── Auth.jsx, GoogleFitCallback.jsx, Integrations.jsx
│   └── Poids.jsx
└── components/
    ├── BottomNav.jsx (4 onglets : Accueil, Repas, Activités, Stats)
    ├── CameraCapture.jsx (getUserMedia — contourne bug Android capture)
    ├── GoogleFitCard.jsx (TDEE dynamique + pas + FC + heure dernière sync)
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
TDEE dynamique = calories.expended Google Fit si > BMR, sinon TDEE effectif

Cible = TDEE dynamique − déficit objectif (perte −250/500/750, prise +250/500)
Cible min = BMR (protection physiologique)

Bilan net = ingérées − (cible + sport manuel)
Déficit réel = TDEE Garmin − ingérées
```

### Calcul protéines
```
Si masseGrasse renseigné → LBM = poids × (1 − MG%) → objectif = LBM × 2.3 g
Sinon → poids × PROTEIN_FACTORS[niveauActivite]
wmaurice : 74 kg LBM × 2.3 = 170 g/j
```

### Google Fit — comportement
- Seuls **pas**, **poids**, **FC** sont disponibles via Garmin → Google Fit
- `calories.expended` = total dépense Garmin (BMR + mouvement) — disponible parfois
- **Workflow sport** : Garmin enregistre séance → sync Garmin Connect → tap ↻ sur CalSnap
- ⚠️ Si Google Fit connecté : NE PAS ajouter les séances manuellement dans Activités (double comptage)
- Garmin API officielle en attente d'approbation (demande soumise)

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
| TDEE mesuré Garmin | 2 750 kcal/j (sans sport) |
| Objectif protéines | 170 g/j |
| Sport | 5 séances muscu/semaine (sans téléphone) |
| Mode de vie | Télétravail |

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
| M-S3+ | Google Fit OAuth + TDEE dynamique + Pas + FC + Sync |

---

## Bugs connus / décisions techniques
- **Caméra Android** : `capture="environment"` bugué → utilise `getUserMedia` (CameraCapture.jsx)
- **Garmin calories** : non disponibles via Google Fit/Health Connect
- **Cible min BMR** : protection ajoutée (cible ≥ BMR toujours)
- **Google Fit TDEE partiel** : ignoré si < BMR (données mid-day incomplètes)
- **Stats bilan** : ne compte que les jours avec données (évite gonflement totalBurned)
- **Garmin API** : approbation en attente — intégration OAuth Garmin prévue dès réponse

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
