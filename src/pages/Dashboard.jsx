// src/pages/Dashboard.jsx
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { getProfile, getMealsForDate, getActivitiesForDate, getLatestWeight, getWeights } from '../db';
import { calculateBMR, calculateCible, calculateProteinGoal, getEffectiveTDEE, ACTIVITY_LABELS } from '../utils/bmr';

/** Formate la date courante en 'YYYY-MM-DD' */
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function StatCard({ label, value, unit, icon, color, delay, badge }) {
  return (
    <div
      className="bg-[#1a1a2e] rounded-2xl p-5 flex flex-col gap-2 shadow-xl animate-fade-in-up"
      style={{ animationDelay: delay }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">{label}</span>
          {badge && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                             bg-emerald-900/40 text-emerald-400 border border-emerald-700/40">
              {badge}
            </span>
          )}
        </div>
        <span className="text-xl">{icon}</span>
      </div>
      <div className="flex items-end gap-1">
        <span className={`text-4xl font-extrabold ${color}`}>{value.toLocaleString('fr-FR')}</span>
        <span className="text-sm text-gray-400 mb-1">{unit}</span>
      </div>
    </div>
  );
}

/** Couleurs et labels selon l'objectif */
const OBJECTIF_STYLE = {
  perte:    { badge: 'bg-red-900/40 text-red-400 border-red-700/40',   bar: 'bg-gradient-to-r from-red-600 to-red-400',     dot: 'bg-red-400'     },
  maintien: { badge: 'bg-emerald-900/40 text-emerald-400 border-emerald-700/40', bar: 'bg-gradient-to-r from-emerald-600 to-emerald-400', dot: 'bg-emerald-400' },
  prise:    { badge: 'bg-blue-900/40 text-blue-400 border-blue-700/40', bar: 'bg-gradient-to-r from-blue-600 to-blue-400',   dot: 'bg-blue-400'    },
};

const OBJECTIF_LABEL = {
  perte: '🔻 Perte de poids',
  maintien: '⚖️ Maintien',
  prise: '💪 Prise de masse',
};

/**
 * BilanCard — Sprint 6A
 * Bilan net = ingérées − (cible + sport)
 * Barre de progression : ingérées / cible (sans sport)
 * Badge cible coloré selon objectif.
 * Phrase contextuelle sous le bilan net.
 */
function BilanCard({ tdee, cible, objectif, caloriesIngerees, totalSport, delay }) {
  const totalDepense = cible + totalSport;
  const bilan = caloriesIngerees - totalDepense; // négatif = dans la cible, positif = dépassé
  const isOk = bilan <= 0;

  // Barre : ingérées vs cible seule (sans sport)
  const progressPct = cible > 0
    ? Math.min(100, Math.round((caloriesIngerees / cible) * 100))
    : 0;

  const style = OBJECTIF_STYLE[objectif] ?? OBJECTIF_STYLE.maintien;
  const bilanColor = isOk ? 'text-emerald-400' : 'text-red-400';

  const resteOuDepasse = Math.abs(bilan);
  const phraseContextuelle = isOk
    ? `Il te reste ${(cible - caloriesIngerees + totalSport).toLocaleString('fr-FR')} kcal`
    : `Tu as dépassé ta cible de ${resteOuDepasse.toLocaleString('fr-FR')} kcal`;

  return (
    <div
      className="bg-[#1a1a2e] rounded-2xl p-5 shadow-xl animate-fade-in-up"
      style={{ animationDelay: delay }}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">Bilan du jour</span>
        <span className="text-xl">📊</span>
      </div>

      <div className="flex flex-col gap-3">
        {/* Badge cible */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${style.dot}`} />
            <span className="text-sm text-gray-400">Cible</span>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${style.badge}`}>
            {OBJECTIF_LABEL[objectif] ?? '⚖️ Maintien'} — {cible.toLocaleString('fr-FR')} kcal
          </span>
        </div>

        {/* Calories ingérées */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-sm text-gray-400">Ingérées</span>
          </div>
          <span className="font-bold text-emerald-400">
            {caloriesIngerees.toLocaleString('fr-FR')} kcal
          </span>
        </div>

        {/* Calories sport — affichées seulement si > 0 */}
        {totalSport > 0 && (
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-400" />
              <span className="text-sm text-gray-400">Sport</span>
            </div>
            <span className="font-bold text-orange-400">-{totalSport.toLocaleString('fr-FR')} kcal</span>
          </div>
        )}

        {/* Total dépensé (séparateur) */}
        {totalSport > 0 && (
          <div className="flex justify-between items-center border-t border-white/5 pt-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gray-500" />
              <span className="text-sm text-gray-500">Total dépensé</span>
            </div>
            <span className="font-semibold text-gray-400">{totalDepense.toLocaleString('fr-FR')} kcal</span>
          </div>
        )}

        {/* Bilan net */}
        <div className="border-t border-white/10 pt-3 flex justify-between items-center">
          <span className="text-sm font-semibold text-gray-300">Bilan net</span>
          <span className={`font-extrabold ${bilanColor}`}>
            {isOk ? '' : '+'}{bilan.toLocaleString('fr-FR')} kcal
          </span>
        </div>

        {/* Phrase contextuelle */}
        <p className={`text-sm font-bold text-center ${isOk ? 'text-emerald-400' : 'text-red-400'}`}>
          {phraseContextuelle}
        </p>

        {/* Barre de progression : ingérées / cible */}
        <div className="w-full h-2 bg-[#22223b] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${style.bar}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Label pourcentage */}
        <p className="text-xs text-gray-600 text-center">
          {progressPct}% de la cible journalière
          {caloriesIngerees === 0 && (
            <span> — ajoutez un repas 📸</span>
          )}
        </p>
      </div>
    </div>
  );
}

/**
 * ProteinCard — Sprint 7B
 * Affiche la progression des protéines journalières.
 */
function ProteinCard({ ingested, goal, delay }) {
  const progressPct = goal > 0 ? Math.min(100, Math.round((ingested / goal) * 100)) : 0;
  const isReached = ingested >= goal;
  const isOver = ingested > goal;
  const overBy = ingested - goal;

  return (
    <div
      className="bg-[#1a1a2e] rounded-2xl p-5 shadow-xl animate-fade-in-up"
      style={{ animationDelay: delay }}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">Protéines du jour</span>
        <span className="text-xl">💪</span>
      </div>

      <div className="flex flex-col gap-3">
        {/* Valeur ingérée */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-400">Consommées</span>
          <span className="text-lg font-extrabold text-cyan-400">
            {ingested} g <span className="text-sm font-normal text-gray-500">/ {goal} g</span>
          </span>
        </div>

        {/* Barre de progression */}
        <div className="w-full h-2 bg-[#22223b] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 bg-cyan-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Message contextuel */}
        {isOver ? (
          <p className="text-sm font-bold text-center text-orange-400">
            Dépassé de +{overBy} g
          </p>
        ) : isReached ? (
          <p className="text-sm font-bold text-center text-emerald-400">
            Objectif atteint ✓
          </p>
        ) : (
          <p className="text-xs text-gray-600 text-center">
            {progressPct}% de l&apos;objectif journalier
          </p>
        )}
      </div>
    </div>
  );
}

/** Formate 'YYYY-MM-DD' en 'j mois' court (ex. '12 mai') */
function formatDateShortFR(iso) {
  if (!iso) return '';
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

/** Widget poids compact pour le Dashboard */
function PoidsWidget({ latestWeight, evolution30, onNavigate }) {
  if (!latestWeight) {
    return (
      <div className="bg-[#1a1a2e] rounded-2xl p-4 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚖️</span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Mon poids</p>
            <p className="text-sm text-gray-400 mt-0.5">Aucune pesée enregistrée</p>
          </div>
        </div>
        <button
          onClick={onNavigate}
          className="px-3 py-1.5 rounded-xl bg-violet-700/60 border border-violet-600/40
                     text-violet-200 font-medium text-xs
                     hover:opacity-90 active:scale-95 transition-all duration-200 whitespace-nowrap"
        >
          Enregistrer
        </button>
      </div>
    );
  }

  const evo = evolution30 !== null ? parseFloat(evolution30) : null;
  const evoColor = evo === null
    ? 'text-gray-400'
    : evo < 0 ? 'text-emerald-400' : evo > 0 ? 'text-red-400' : 'text-gray-300';
  const evoLabel = evo === null
    ? null
    : `${evo > 0 ? '+' : ''}${evo.toFixed(1)} kg / 30j`;

  return (
    <div className="bg-[#1a1a2e] rounded-2xl p-4 shadow-xl flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-2xl">⚖️</span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Mon poids</p>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-xl font-extrabold text-white">{latestWeight.poids.toFixed(1)} kg</span>
            {evoLabel && (
              <span className={`text-xs font-semibold ${evoColor}`}>{evoLabel}</span>
            )}
          </div>
          <p className="text-xs text-gray-600 mt-0.5">{formatDateShortFR(latestWeight.date)}</p>
        </div>
      </div>
      <button
        onClick={onNavigate}
        className="px-3 py-1.5 rounded-xl bg-violet-700/60 border border-violet-600/40
                   text-violet-200 font-medium text-xs
                   hover:opacity-90 active:scale-95 transition-all duration-200 whitespace-nowrap"
      >
        Mettre à jour
      </button>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [caloriesIngerees, setCaloriesIngerees] = useState(0);
  const [totalSport, setTotalSport] = useState(0);
  const [totalProteinesJour, setTotalProteinesJour] = useState(0);
  const [latestWeight, setLatestWeight] = useState(undefined);
  const [evolution30, setEvolution30] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const today = todayISO();
    const [p, meals, acts, lw, allWeights] = await Promise.all([
      getProfile(),
      getMealsForDate(today),
      getActivitiesForDate(today),
      getLatestWeight(),
      getWeights(),
    ]);

    if (!p) {
      navigate('/profil', { replace: true });
      setLoading(false);
      return;
    }

    setProfile(p);
    setCaloriesIngerees(meals.reduce((sum, m) => sum + (m.totalCalories ?? 0), 0));
    setTotalSport(acts.reduce((sum, a) => sum + (a.caloriesBrulees ?? 0), 0));
    setTotalProteinesJour(meals.reduce((sum, m) => sum + (m.totalProteines ?? 0), 0));
    setLatestWeight(lw ?? null);

    // Calcul évolution 30 jours
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const iso30 = thirtyDaysAgo.toISOString().slice(0, 10);
    const w30 = allWeights.filter(w => w.date >= iso30);
    if (w30.length >= 2) {
      setEvolution30((w30[w30.length - 1].poids - w30[0].poids).toFixed(1));
    } else {
      setEvolution30(null);
    }

    setLoading(false);
  }, [navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Rafraîchir quand la page reprend le focus
  // (retour depuis /repas, /activites ou /poids après un ajout)
  useEffect(() => {
    const onFocus = async () => {
      const today = todayISO();
      const [meals, acts, lw, allWeights] = await Promise.all([
        getMealsForDate(today),
        getActivitiesForDate(today),
        getLatestWeight(),
        getWeights(),
      ]);
      setCaloriesIngerees(meals.reduce((sum, m) => sum + (m.totalCalories ?? 0), 0));
      setTotalSport(acts.reduce((sum, a) => sum + (a.caloriesBrulees ?? 0), 0));
      setTotalProteinesJour(meals.reduce((sum, m) => sum + (m.totalProteines ?? 0), 0));
      setLatestWeight(lw ?? null);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const iso30 = thirtyDaysAgo.toISOString().slice(0, 10);
      const w30 = allWeights.filter(w => w.date >= iso30);
      if (w30.length >= 2) {
        setEvolution30((w30[w30.length - 1].poids - w30[0].poids).toFixed(1));
      } else {
        setEvolution30(null);
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0f0f1a]">
        <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!profile) return null;

  const bmr = Math.round(calculateBMR(profile));
  const tdee = getEffectiveTDEE(profile, bmr);
  const cible = calculateCible(tdee, profile.objectif, profile.vitesseObjectif);
  const objectif = profile.objectif ?? 'maintien';
  const proteinGoal = calculateProteinGoal(profile);

  return (
    <div className="flex flex-col min-h-screen bg-[#0f0f1a] pb-36">
      {/* Header */}
      <div className="px-5 pt-12 pb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="text-2xl font-bold text-white mt-0.5">
            Bonjour {profile.prenom}&nbsp;👋
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Sync
            </span>
          )}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-600 to-indigo-500
                          flex items-center justify-center text-white font-bold text-lg shadow-lg">
            {profile.prenom[0].toUpperCase()}
          </div>
        </div>
      </div>

      {/* Niveau d'activité badge */}
      <div className="px-5 mb-5">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-300
                         bg-violet-900/40 border border-violet-700/50 px-3 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
          {ACTIVITY_LABELS[profile.niveauActivite]}
        </span>
      </div>

      {/* Cards */}
      <div className="px-5 flex flex-col gap-4">
        <StatCard
          label="BMR — Métabolisme de base"
          value={bmr}
          unit="kcal / jour"
          icon="🔥"
          color="text-orange-400"
          delay="0ms"
        />
        <StatCard
          label="TDEE — Dépense totale"
          value={tdee}
          unit="kcal / jour"
          icon="⚡"
          color="text-violet-400"
          delay="60ms"
          badge={profile.tdeeMesure > 0 ? '⌚ Garmin' : undefined}
        />
        <BilanCard
          tdee={tdee}
          cible={cible}
          objectif={objectif}
          caloriesIngerees={caloriesIngerees}
          totalSport={totalSport}
          delay="120ms"
        />
        <ProteinCard
          ingested={totalProteinesJour}
          goal={proteinGoal}
          delay="180ms"
        />
        {latestWeight !== undefined && (
          <PoidsWidget
            latestWeight={latestWeight}
            evolution30={evolution30}
            onNavigate={() => navigate('/poids')}
          />
        )}
      </div>

      {/* Raccourcis rapides */}
      <div className="px-5 mt-4 flex flex-col gap-3">
        <button
          onClick={() => navigate('/repas')}
          className="w-full py-3.5 rounded-2xl
                     bg-gradient-to-r from-violet-700/60 to-indigo-700/60
                     border border-violet-600/40
                     text-violet-200 font-medium text-sm flex items-center justify-center gap-2
                     hover:opacity-90 active:scale-95 transition-all duration-200"
        >
          <span>📸</span>
          Ajouter un repas
        </button>
        <button
          onClick={() => navigate('/activites')}
          className="w-full py-3.5 rounded-2xl
                     bg-gradient-to-r from-orange-700/40 to-amber-700/40
                     border border-orange-600/30
                     text-orange-200 font-medium text-sm flex items-center justify-center gap-2
                     hover:opacity-90 active:scale-95 transition-all duration-200"
        >
          <span>🏃</span>
          Enregistrer une activité
        </button>
      </div>

      {/* Bouton Historique */}
      <div className="px-5 mt-3">
        <button
          onClick={() => navigate('/historique')}
          className="w-full py-3.5 rounded-2xl border border-white/10 bg-[#1a1a2e]
                     text-gray-300 font-medium text-sm flex items-center justify-center gap-2
                     hover:bg-[#22223b] active:scale-95 transition-all duration-200"
        >
          <span>📋</span>
          Historique des repas
        </button>
      </div>

      {/* Bouton modifier profil */}
      <div className="px-5 mt-3">
        <button
          onClick={() => navigate('/profil')}
          className="w-full py-3.5 rounded-2xl border border-white/10 bg-[#1a1a2e]
                     text-gray-300 font-medium text-sm flex items-center justify-center gap-2
                     hover:bg-[#22223b] active:scale-95 transition-all duration-200"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Modifier mon profil
        </button>
      </div>

      {/* Bouton migration — visible uniquement si connecté */}
      {user && (
        <div className="px-5 mt-4 mb-2 flex justify-center">
          <button
            onClick={() => navigate('/migration')}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors duration-200
                       flex items-center gap-1.5 py-1"
          >
            <span>☁️</span>
            Migrer mes données vers le cloud
          </button>
        </div>
      )}
    </div>
  );
}
