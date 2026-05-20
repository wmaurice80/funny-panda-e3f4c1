# CalSnap — Contexte projet (Claude)

## Vision produit
Application mobile PWA de suivi calorique et protéique par photo de repas et saisie manuelle, avec synchronisation cloud. Utilisateur : wmaurice (119 kg, 37.7% MG, LBM ~74 kg, 5 séances muscu/semaine, télétravail).

---

## Stack technique
| Couche | Techno |
|---|---|
| Framework | React 18 + Vite |
| Style | Tailwind CSS |
| Routing | React Router v6 |
| Stockage local | IndexedDB via `idb` (DB_VERSION actuelle : 5) |
| Stockage cloud | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Graphiques | Recharts |
| IA analyse photo | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) |
| IA estimation texte | Claude Haiku 4.5 |
| Base alimentaire | Open Food Facts API (gratuite, sans clé) |
| Type | PWA installable Android |
| Hébergement | Netlify — https://calsnapwmp.netlify.app |
| Repo GitHub | https://github.com/wmaurice80/funny-panda-e3f4c1 |

---

## Architecture fichiers
```
calsnap/
├── public/
│   ├── manifest.json (PWA)
│   ├── sw.js (service worker — network-first strategy)
│   └── icons/ (icon-192.png, icon-512.png)
├── src/
│   ├── main.jsx (ErrorBoundary + AuthProvider + BrowserRouter)
│   ├── App.jsx (routing + auth guard + sync spinner)
│   ├── db.js (IndexedDB v5 — stores: profile, meals, activities, weights)
│   ├── lib/
│   │   ├── supabase.js (createClient avec guard env vars)
│   │   ├── AuthContext.jsx (user, loading, syncing, signIn/Out/Up/Reset + syncFromSupabase au SIGNED_IN)
│   │   ├── supabaseDb.js (13 fonctions push*/pull* — CRUD Supabase)
│   │   └── syncManager.js (dual-write IndexedDB + Supabase fire-and-forget)
│   ├── utils/
│   │   ├── bmr.js (calculateBMR, calculateTDEE, getEffectiveTDEE, calculateCible, calculateProteinGoal, PROTEIN_FACTORS)
│   │   ├── stats.js (getMonthlyData, getMonthBilan, getWeeklyTrends — ne compte que les jours trackés)
│   │   └── sports.js (SPORT_TYPES avec emojis)
│   ├── pages/
│   │   ├── Dashboard.jsx (BilanCard avec bilan net 3 couleurs + déficit réel vs TDEE)
│   │   ├── Profile.jsx (profil + BMR + objectif + TDEE Garmin + % MG + bouton logout)
│   │   ├── Repas.jsx (photo → Claude Vision → AnalyseResult éditable)
│   │   ├── Aliments.jsx (Open Food Facts + IA texte + ProteinSources + DrinkSources)
│   │   ├── Activites.jsx (saisie manuelle sport + Garmin manuel)
│   │   ├── Historique.jsx (accordéon par jour)
│   │   ├── Stats.jsx (graphiques mensuels + bilan + tendances + poids)
│   │   ├── Poids.jsx (pesées + courbe recharts)
│   │   ├── Migration.jsx (one-shot IndexedDB → Supabase avec barre de progression)
│   │   └── Auth.jsx (login / register / reset password)
│   └── components/
│       ├── BottomNav.jsx (4 onglets : Accueil, Repas, Activités, Stats)
│       ├── MealCard.jsx (affiche totalProteines en cyan)
│       ├── ActivityCard.jsx
│       ├── AnalyseResult.jsx (items éditables nom/portion + bouton ↺ IA par item)
│       ├── ProteinSources.jsx (10 sources protéines pré-configurées)
│       ├── DrinkSources.jsx (12 boissons avec unités cl — bière, vin, soda, spiritueux)
│       ├── MonthlyChart.jsx (recharts — ligne cible pointillée selon objectif)
│       ├── MonthBilan.jsx (bilan mensuel + équivalence kg graisse)
│       └── WeeklyTrends.jsx (S1-S4 avec flèches ↑↓)
├── supabase/
│   ├── schema.sql (tables + RLS + index + trigger — à exécuter dans Supabase SQL Editor)
│   └── fix_grants.sql (GRANT SELECT/INSERT/UPDATE/DELETE aux rôles anon + authenticated)
├── netlify.toml (build: npm run build, publish: dist, redirects: /* → /index.html)
└── .env (VITE_ANTHROPIC_API_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
```

---

## Supabase
- **Project ID** : lhcouyccseuyczcmatoa
- **URL** : https://lhcouyccseuyczcmatoa.supabase.co
- **Tables** : profiles, meals, activities, weights (RLS activé, GRANT accordés)
- **Auth** : email/password, confirmation email désactivée (usage perso)
- **Site URL** : https://calsnapwmp.netlify.app

---

## Profil utilisateur wmaurice
| Paramètre | Valeur |
|---|---|
| Poids | 119 kg |
| % Masse grasse | 37.7% |
| LBM | ~74 kg |
| TDEE mesuré Garmin | 2 750 kcal/j (sans sport) |
| Objectif protéines | 170 g/j (74 kg × 2.3 g/kg LBM) |
| Sport | 5 séances muscu/semaine |
| Mode de vie | Télétravail (sédentaire sans sport) |

---

## Logique métier clé

### Calcul calorique
```
BMR = Mifflin-St Jeor (poids/taille/âge/sexe)
TDEE effectif = tdeeMesure (Garmin) si renseigné, sinon BMR × facteur activité
Cible = TDEE - déficit (selon objectif + vitesse)
  - Perte lente : -250 kcal | modérée : -500 | rapide : -750
  - Maintien : 0 | Prise lente : +250 | modérée : +500
Bilan net = ingérées - (cible + sport du jour) → objectif = 0
Déficit réel = TDEE Garmin - ingérées (affiché séparément)
```

### Calcul protéines
```
Si masseGrasse renseigné :
  LBM = poids × (1 - masseGrasse/100)
  Objectif = LBM × 2.3 g (+ 10% si prise de masse)
Sinon :
  Objectif = poids × PROTEIN_FACTORS[niveauActivite]
  (sédentaire 0.8 → extrêmement actif 2.2 g/kg)
```

### Bilan net — code couleur
- ≤ 0 → vert (dans les clous)
- 0 à +200 → orange (légèrement au-dessus)
- > +200 → rouge (dépassement)

### Sync Supabase
- **Dual-write** : toutes les écritures → IndexedDB d'abord + Supabase fire-and-forget
- **Pull au login** : SIGNED_IN → syncFromSupabase() → spinner "Synchronisation des données…"
- **Migration one-shot** : /migration → pousse IndexedDB existant vers Supabase

---

## Historique des sprints

| Sprint | Contenu |
|---|---|
| S1 | PWA + Profil + BMR/TDEE + IndexedDB |
| S2 | Photo → Claude Vision → AnalyseResult + Journal repas du jour |
| S3 | Activités sport + Garmin manuel + Bilan net |
| S4 | Stats mensuelles (graphiques recharts + bilan + tendances) |
| S5 | Catégories repas + Date/heure + Open Food Facts + Historique par jour |
| S6 | Objectif calorique + Suivi poids + Build PWA production |
| S7 | Protéines par aliment/repas + Objectif journalier LBM + Sources protéines + Boissons |
| M-S1 | Supabase Auth (login/register/reset) + Schéma SQL + RLS |
| M-S2 | Dual-write sync + SyncManager + Migration IndexedDB→Supabase |
| Corrections | TDEE Garmin mesuré, bilan net 3 couleurs, SW network-first, écran blanc Android |

---

## Bugs connus / décisions techniques
- **Service worker** : network-first depuis v3 — les anciennes versions nécessitaient un clear cache manuel
- **Garmin OAuth** : non implémenté (approbation Garmin requise) — saisie manuelle des calories sport
- **API Anthropic** : exposée côté browser (acceptable pour usage perso) — pour prod : backend proxy requis
- **Confirmation email Supabase** : désactivée (usage personnel single-user)
- **Bilan stats** : ne compte que les jours avec au moins 1 repas ou activité trackée (évite gonflement du total dépensé)
- **NO_NAV_ROUTES** : /profil, /aliments, /migration (pas de BottomNav sur ces pages)

---

## Variables d'environnement (dans .env local ET Netlify)
```
VITE_ANTHROPIC_API_KEY=...
VITE_SUPABASE_URL=https://lhcouyccseuyczcmatoa.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

---

## Commandes utiles
```bash
# Dev local
npm run dev -- --host

# Build production
npm run build

# Deploy (auto via git push → Netlify)
git add -A && git commit -m "..." && git push
```
