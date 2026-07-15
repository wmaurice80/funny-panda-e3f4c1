// src/pages/Dashboard.jsx
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { getProfile, getMealsForDate, getActivitiesForDate, getLatestWeight, getWeights, getAllGarminDaily } from '../db';
import { calculateBMR, calculateCible, calculateProteinGoal, getEffectiveTDEE, ACTIVITY_LABELS } from '../utils/bmr';
import { isConnected, hasRefreshToken, fetchAllDayData } from '../lib/googleFit';
import { syncedDeleteActivity, syncGarminDaily, syncGarminActivities } from '../lib/syncManager';
import { supabase } from '../lib/supabase';
import GoogleFitCard from '../components/GoogleFitCard';
import InstallBanner from '../components/InstallBanner';

/** Formate la date courante en 'YYYY-MM-DD' */
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function StatCard({ label, value, unit, icon, color, delay, badge, compact = false }) {
  return (
    <div
      className="bg-[#1a1a2e] rounded-2xl p-4 flex flex-col gap-2 shadow-xl animate-fade-in-up"
      style={{ animationDelay: delay }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">{label}</span>
          {badge && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                             bg-emerald-900/40 text-emerald-400 border border-emerald-700/40">
              {badge}
            </span>
          )}
        </div>
        <span className={compact ? 'text-lg' : 'text-xl'}>{icon}</span>
      </div>
      <div className="flex items-end gap-1">
        <span className={`font-extrabold ${compact ? 'text-2xl' : 'text-4xl'} ${color}`}>
          {value.toLocaleString('fr-FR')}
        </span>
        <span className="text-xs text-gray-400 mb-0.5">{unit}</span>
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
  const bilan = caloriesIngerees - cible; // négatif = dans la cible, positif = dépassé
  const isOk = bilan <= 0;
  const isWarning = bilan > 0 && bilan <= 200;

  const progressPct = cible > 0
    ? Math.min(100, Math.round((caloriesIngerees / cible) * 100))
    : 0;

  // Couleur barre : vert = déficit ok, orange = cible dépassée mais < TDEE, rouge = surplus vs TDEE
  const barColor = caloriesIngerees <= cible
    ? 'bg-emerald-500'
    : caloriesIngerees <= tdee
    ? 'bg-orange-400'
    : 'bg-red-500';

  const style = OBJECTIF_STYLE[objectif] ?? OBJECTIF_STYLE.maintien;
  const bilanColor = isOk ? 'text-emerald-400' : isWarning ? 'text-orange-400' : 'text-red-400';

  const deficitReel = tdee - caloriesIngerees;
  const resteOuDepasse = Math.abs(bilan);
  const phraseContextuelle = isOk
    ? `Il te reste ${resteOuDepasse.toLocaleString('fr-FR')} kcal`
    : isWarning
    ? `Légèrement au-dessus (+${resteOuDepasse.toLocaleString('fr-FR')} kcal)`
    : `Cible dépassée de +${resteOuDepasse.toLocaleString('fr-FR')} kcal`;

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

        {/* Dépense estimée */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-violet-400" />
            <span className="text-sm text-gray-400">
              Dépense {totalSport > 0 ? '🏋️' : '😴'}
            </span>
          </div>
          <span className="font-bold text-violet-400">
            {tdee.toLocaleString('fr-FR')} kcal
          </span>
        </div>

        {/* Détail sport si activité ce jour */}
        {totalSport > 0 && (
          <div className="flex justify-between items-center pl-4">
            <span className="text-xs text-gray-600">dont sport</span>
            <span className="text-xs font-semibold text-orange-400">
              +{totalSport.toLocaleString('fr-FR')} kcal
            </span>
          </div>
        )}

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

        {/* Bilan net */}
        <div className="border-t border-white/10 pt-3 flex justify-between items-center">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-gray-300">Bilan net</span>
            <span className="text-xs text-gray-600">🎯 Objectif : 0 kcal</span>
          </div>
          <span className={`font-extrabold text-lg ${bilanColor}`}>
            {bilan > 0 ? '+' : ''}{bilan.toLocaleString('fr-FR')} kcal
          </span>
        </div>

        {/* Phrase contextuelle */}
        <p className={`text-sm font-bold text-center ${bilanColor}`}>
          {phraseContextuelle}
        </p>

        {/* Déficit réel vs TDEE */}
        {caloriesIngerees > 0 && tdee > 0 && (
          <div className={`rounded-xl px-3 py-2 flex items-center justify-between text-xs
            ${deficitReel >= 0 ? 'bg-emerald-900/20 border border-emerald-700/30' : 'bg-red-900/20 border border-red-700/30'}`}>
            <span className="text-gray-400">Déficit réel vs TDEE</span>
            <span className={`font-bold ${deficitReel >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {deficitReel >= 0 ? '-' : '+'}{Math.abs(deficitReel).toLocaleString('fr-FR')} kcal
            </span>
          </div>
        )}


        {/* Barre de progression : ingérées / cible */}
        <div className="w-full h-2 bg-[#22223b] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Label pourcentage */}
        <p className="text-xs text-gray-600 text-center">
          {progressPct}% de la cible
          {caloriesIngerees === 0
            ? ' — ajoutez un repas 📸'
            : caloriesIngerees > tdee
            ? ' — surplus calorique 🔴'
            : caloriesIngerees > cible
            ? ' — déficit réduit 🟠'
            : ''}
        </p>
      </div>
    </div>
  );
}

/**
 * ProteinCard — Sprint 7B
 * Affiche la progression des protéines journalières.
 */
const PROTEIN_THRESHOLD = 75; // % minimum pour préserver la masse musculaire (1.6 g/kg LBM)
const PROTEIN_REACHED  = 95; // % considéré comme objectif atteint (marge de ~5%)

function ProteinCard({ ingested, goal, delay }) {
  const rawPct = goal > 0 ? (ingested / goal) * 100 : 0;
  const progressPct = Math.min(100, Math.round(rawPct));
  const isReached = rawPct >= PROTEIN_REACHED;
  const isOver = ingested > goal;
  const overBy = Math.round(ingested - goal);
  const remaining = Math.round(goal - ingested);

  // Couleur selon zone
  const barColor = rawPct >= PROTEIN_REACHED
    ? 'bg-cyan-500'
    : rawPct >= PROTEIN_THRESHOLD
    ? 'bg-orange-400'
    : 'bg-red-500';

  const valueColor = rawPct >= PROTEIN_REACHED
    ? 'text-cyan-400'
    : rawPct >= PROTEIN_THRESHOLD
    ? 'text-orange-400'
    : 'text-red-400';

  // Position du marqueur 75% sur la barre
  const thresholdLeft = `${PROTEIN_THRESHOLD}%`;

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
          <span className={`text-lg font-extrabold ${valueColor}`}>
            {Math.round(ingested)} g{' '}
            <span className="text-sm font-normal text-gray-500">/ {goal} g</span>
          </span>
        </div>

        {/* Barre de progression avec marqueur 75% */}
        <div className="relative w-full h-3 bg-[#22223b] rounded-full overflow-visible">
          {/* Barre remplie */}
          <div
            className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${progressPct}%` }}
          />
          {/* Marqueur seuil 75% */}
          <div
            className="absolute top-[-3px] h-[18px] w-[2px] bg-white/40 rounded-full"
            style={{ left: thresholdLeft }}
            title="Seuil minimum préservation musculaire"
          />
        </div>

        {/* Légende seuil */}
        <div className="flex justify-between items-center text-[10px] text-gray-600">
          <span>0 g</span>
          <span className={rawPct < PROTEIN_THRESHOLD ? 'text-red-500 font-semibold' : 'text-gray-600'}>
            ⚠ seuil muscu {Math.round(goal * PROTEIN_THRESHOLD / 100)} g
          </span>
          <span>{goal} g</span>
        </div>

        {/* Message contextuel */}
        {isOver ? (
          <p className="text-sm font-bold text-center text-orange-400">
            Dépassé de +{overBy} g
          </p>
        ) : isReached ? (
          <p className="text-sm font-bold text-center text-cyan-400">
            Objectif atteint ✓
          </p>
        ) : rawPct < PROTEIN_THRESHOLD ? (
          <p className="text-sm font-bold text-center text-red-400">
            ⚠ Risque catabolisme — encore {remaining} g
          </p>
        ) : (
          <p className="text-xs text-gray-500 text-center">
            {progressPct}% — encore {remaining} g
          </p>
        )}
      </div>
    </div>
  );
}

/** Somme les grammes d'alcool des items alcoolG de tous les repas du jour */
function sumAlcool(meals) {
  return meals.reduce(
    (s, m) => s + (m.aliments ?? []).reduce((s2, a) => s2 + (a.alcoolG ?? 0), 0),
    0
  );
}

/**
 * AlcoolCard — visible uniquement les jours avec alcool saisi.
 * L'éthanol est oxydé en priorité (~0,1 g/kg/h) : pendant ce temps la
 * lipolyse est quasi stoppée, même en déficit calorique.
 */
function AlcoolCard({ alcoolG, poids, delay }) {
  if (!alcoolG || alcoolG <= 0) return null;
  const kcal = Math.round(alcoolG * 7);
  const heures = poids > 0 ? Math.round((alcoolG / (0.1 * poids)) * 10) / 10 : null;
  return (
    <div
      className="bg-amber-900/20 border border-amber-700/30 rounded-2xl p-4 shadow-xl animate-fade-in-up"
      style={{ animationDelay: delay }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold uppercase tracking-widest text-amber-400/80">
          Alcool aujourd'hui
        </span>
        <span className="text-xl">🍷</span>
      </div>
      <p className="text-sm text-white font-bold">
        {Math.round(alcoolG)} g d'alcool
        <span className="text-xs font-medium text-gray-400 ml-1.5">({kcal} kcal)</span>
      </p>
      {heures !== null && (
        <p className="text-xs text-amber-400/90 mt-1 leading-snug">
          ⏸ Combustion des graisses en pause ~{heures.toLocaleString('fr-FR')} h — même en
          déficit, ton corps brûle l'alcool en priorité avant de re-puiser dans les graisses.
        </p>
      )}
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
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState(null);
  const [caloriesIngerees, setCaloriesIngerees] = useState(0);
  const [totalSport, setTotalSport] = useState(0);
  const [totalProteinesJour, setTotalProteinesJour] = useState(0);
  const [alcoolJour, setAlcoolJour] = useState(0);
  const [latestWeight, setLatestWeight] = useState(undefined);
  const [evolution30, setEvolution30] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gfitData, setGfitData] = useState(null);
  const [gfitLoading, setGfitLoading] = useState(false);
  const [lastGarminEntry, setLastGarminEntry] = useState(null);
  const [todayGarminEntry, setTodayGarminEntry] = useState(null);
  const [garminSyncing, setGarminSyncing] = useState(false);
  const [garminSyncOk, setGarminSyncOk] = useState(null); // true | false | null

  const loadData = useCallback(async () => {
    const today = todayISO();
    const [p, meals, acts, lw, allWeights, garminRows] = await Promise.all([
      getProfile(),
      getMealsForDate(today),
      getActivitiesForDate(today),
      getLatestWeight(),
      getWeights(),
      getAllGarminDaily(),
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
    setAlcoolJour(sumAlcool(meals));
    setLatestWeight(lw ?? null);

    // Dernière entrée Garmin (triée par date desc) + entrée du jour
    if (garminRows?.length) {
      const sorted = [...garminRows].sort((a, b) => b.date.localeCompare(a.date));
      setLastGarminEntry(sorted[0]);
    }
    setTodayGarminEntry(garminRows?.find(g => g.date === today) ?? null);

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

    // ── Google Fit : chargement parallèle ──────────────────────────────────
    if (isConnected() || hasRefreshToken()) {
      setGfitLoading(true);
      fetchAllDayData(today)
        .then(async (d) => {
          setGfitData(d);
          setGfitLoading(false);

          // Nettoyer les activités Google Fit mal importées précédemment
          {
            const existantes = await getActivitiesForDate(today);
            for (const e of existantes) {
              if (e.note === 'Importé depuis Google Fit') {
                await syncedDeleteActivity(e.id);
              }
            }
            // Recalculer le sport sans les faux imports Google Fit
            const updatedActivities = await getActivitiesForDate(today);
            setTotalSport(updatedActivities.reduce((s, a) => s + (a.caloriesBrulees ?? 0), 0));
          }
        })
        .catch(() => setGfitLoading(false));
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
      const [meals, acts, lw, allWeights, garminRows] = await Promise.all([
        getMealsForDate(today),
        getActivitiesForDate(today),
        getLatestWeight(),
        getWeights(),
        getAllGarminDaily(),
      ]);
      setCaloriesIngerees(meals.reduce((sum, m) => sum + (m.totalCalories ?? 0), 0));
      setTotalSport(acts.reduce((sum, a) => sum + (a.caloriesBrulees ?? 0), 0));
      setTotalProteinesJour(meals.reduce((sum, m) => sum + (m.totalProteines ?? 0), 0));
      setAlcoolJour(sumAlcool(meals));
      setLatestWeight(lw ?? null);
      setTodayGarminEntry(garminRows?.find(g => g.date === today) ?? null);

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

  // Rafraîchir toutes les valeurs après un sync Garmin (depuis Intégrations ou le bouton accueil)
  useEffect(() => {
    const onGarminSynced = async () => {
      const today = todayISO();
      const [garminRows, acts] = await Promise.all([
        getAllGarminDaily(),
        getActivitiesForDate(today),
      ]);
      if (garminRows?.length) {
        const sorted = [...garminRows].sort((a, b) => b.date.localeCompare(a.date));
        setLastGarminEntry(sorted[0]);
      }
      setTodayGarminEntry(garminRows?.find(g => g.date === today) ?? null);
      setTotalSport(acts.reduce((s, a) => s + (a.caloriesBrulees ?? 0), 0));
    };
    window.addEventListener('garmin-synced', onGarminSynced);
    return () => window.removeEventListener('garmin-synced', onGarminSynced);
  }, []);

  const handleGarminSync = async () => {
    setGarminSyncing(true);
    setGarminSyncOk(null);
    try {
      const { data, error } = await supabase.functions.invoke('garmin-sync', { body: { days: 2 } });
      if (error) throw error;
      if (!data.success) throw new Error(data.error ?? 'Erreur inconnue');
      const syncedDates = Array.from({ length: 2 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - i);
        return d.toISOString().slice(0, 10);
      });
      await syncGarminDaily(user?.id).catch(() => {});
      await syncGarminActivities(user?.id, syncedDates).catch(() => {});
      window.dispatchEvent(new CustomEvent('garmin-synced'));
      setGarminSyncOk(true);
      setTimeout(() => setGarminSyncOk(null), 3000);
    } catch {
      setGarminSyncOk(false);
      setTimeout(() => setGarminSyncOk(null), 4000);
    } finally {
      setGarminSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0f0f1a]">
        <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!profile) return null;

  // Profil incomplet : poids ou prénom manquant → afficher un encart d'invitation plutôt que des 0
  const profileIncomplet = !profile.poids || profile.poids === 0 || !profile.prenom;

  if (profileIncomplet) {
    return (
      <div className="flex flex-col min-h-screen bg-[#0f0f1a] pb-36">
        {/* Header */}
        <div className="px-5 pt-12 pb-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 className="text-2xl font-bold text-white mt-0.5">Bonjour&nbsp;👋</h1>
          </div>
          <button
            onClick={signOut}
            className="w-9 h-9 flex items-center justify-center rounded-xl
                       bg-[#1a1a2e] border border-white/10 text-gray-400
                       hover:text-red-400 hover:border-red-800/50 active:scale-90 transition-all duration-200"
            title="Se déconnecter"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
        <div className="px-5 flex flex-col gap-4 mt-4">
          <div className="bg-[#1a1a2e] rounded-2xl p-6 flex flex-col items-center gap-4 shadow-xl text-center border border-violet-800/30">
            <span className="text-5xl">👤</span>
            <h2 className="text-lg font-bold text-white">Configure ton profil</h2>
            <p className="text-sm text-gray-400 leading-relaxed">
              Il manque ton poids ou ton prénom. Renseigne-les pour voir tes besoins caloriques personnalisés.
            </p>
            <button
              onClick={() => navigate('/profil')}
              className="w-full py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-500
                         active:scale-95 text-white font-semibold text-sm
                         shadow-lg shadow-violet-900/40 transition-all duration-200"
            >
              Compléter mon profil
            </button>
          </div>
        </div>
      </div>
    );
  }

  const bmr = Math.round(calculateBMR(profile));
  const tdee = getEffectiveTDEE(profile, bmr);

  // TDEE de base (Garmin mesuré profil ou BMR×facteur) + sport manuel du jour
  const tdeeBase = profile.tdeeMesure > 0 ? profile.tdeeMesure : tdee;
  const tdeeManuel = tdeeBase + totalSport;

  // Priorité : Garmin today > Google Fit > manuel
  // Règle : si Garmin a une entrée aujourd'hui → logique Garmin inchangée, GFit ignoré
  const garminTodayKcal = todayGarminEntry?.total_kcal ?? 0;
  const gfitTodayKcal   = gfitData?.tdee?.total ?? 0;

  let tdeeEffectif, tdeeSource;
  if (garminTodayKcal > 0) {
    // Garmin présent → comportement identique à avant
    tdeeEffectif = garminTodayKcal > tdeeManuel ? garminTodayKcal : tdeeManuel;
    tdeeSource   = 'garmin';
  } else if (gfitTodayKcal > tdeeManuel) {
    // Pas de Garmin + GFit dépasse le calcul manuel → GFit devient la source
    tdeeEffectif = gfitTodayKcal;
    tdeeSource   = 'gfit';
  } else {
    tdeeEffectif = tdeeManuel;
    tdeeSource   = 'manual';
  }

  const cible = calculateCible(tdeeEffectif, profile.objectif, profile.vitesseObjectif);
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
          <button
            onClick={signOut}
            className="w-9 h-9 flex items-center justify-center rounded-xl
                       bg-[#1a1a2e] border border-white/10 text-gray-400
                       hover:text-red-400 hover:border-red-800/50 active:scale-90 transition-all duration-200"
            title="Se déconnecter"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
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

      {/* Bannière installation PWA */}
      <InstallBanner />

      {/* Cards */}
      <div className="px-5 flex flex-col gap-4">

        {/* 1 — Bilan du jour */}
        <BilanCard
          tdee={tdeeEffectif}
          cible={cible}
          objectif={objectif}
          caloriesIngerees={caloriesIngerees}
          totalSport={totalSport}
          delay="0ms"
        />

        {/* 1bis — Alcool du jour (lipolyse en pause) */}
        <AlcoolCard
          alcoolG={alcoolJour}
          poids={profile.poids}
          delay="30ms"
        />

        {/* 2 — Protéines */}
        <ProteinCard
          ingested={totalProteinesJour}
          goal={proteinGoal}
          delay="60ms"
        />

        {/* 3 — TDEE + BMR côte à côte */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="TDEE"
            value={tdeeEffectif}
            unit="kcal/j"
            icon="⚡"
            color="text-violet-400"
            delay="120ms"
            badge={
              tdeeSource === 'garmin' ? '⌚ Garmin'
              : tdeeSource === 'gfit' ? '🏃 GFit'
              : totalSport > 0 ? '🏋️'
              : profile.tdeeMesure > 0 ? '⌚'
              : undefined
            }
            compact
          />
          <StatCard
            label="BMR"
            value={bmr}
            unit="kcal/j"
            icon="🔥"
            color="text-orange-400"
            delay="150ms"
            compact
          />
        </div>

        {/* Disclaimer GFit — affiché uniquement quand GFit est la source TDEE */}
        {tdeeSource === 'gfit' && (
          <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl px-4 py-3
                          flex items-start gap-2 animate-fade-in-up">
            <span className="text-amber-400 text-base mt-0.5">⚠</span>
            <div>
              <p className="text-xs font-semibold text-amber-300">TDEE estimé via Google Fit</p>
              <p className="text-xs text-amber-500/80 mt-0.5">
                Précision variable selon votre montre connectée. Connectez une montre Fitbit,
                Samsung ou Wear OS pour de meilleures mesures.
              </p>
            </div>
          </div>
        )}

        {/* 4 — Garmin dernière mesure + bouton sync */}
        {lastGarminEntry && (
          <div className="bg-gray-800/60 rounded-2xl p-4 border border-violet-800/30">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">⌚</span>
                <span className="text-sm font-semibold text-violet-300">Garmin mesuré</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  {new Date(lastGarminEntry.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                </span>
                <button
                  onClick={handleGarminSync}
                  disabled={garminSyncing}
                  className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all duration-150
                    active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed
                    ${garminSyncOk === true  ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400'
                    : garminSyncOk === false ? 'bg-red-600/20 border-red-500/40 text-red-400'
                    : 'bg-violet-600/20 border-violet-500/30 text-violet-400 hover:bg-violet-600/40'}`}
                  aria-label="Synchroniser Garmin"
                >
                  {garminSyncing
                    ? <span className="w-3.5 h-3.5 rounded-full border-2 border-violet-400 border-t-transparent animate-spin block" />
                    : garminSyncOk === true  ? <span className="text-[11px] font-bold">✓</span>
                    : garminSyncOk === false ? <span className="text-[11px] font-bold">✗</span>
                    : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
                  }
                </button>
              </div>
            </div>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-2xl font-bold text-white">{lastGarminEntry.total_kcal.toLocaleString('fr-FR')}</span>
              <span className="text-sm text-gray-400 mb-0.5">kcal total</span>
            </div>
            {lastGarminEntry.device_last_sync && (
              <p className="text-[10px] text-gray-600 mb-3">
                ⌚ Montre sync à {new Date(lastGarminEntry.device_last_sync).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-gray-700/50 rounded-xl p-2">
                <div className="text-xs text-gray-400 mb-0.5">BMR</div>
                <div className="text-sm font-semibold text-orange-400">{lastGarminEntry.bmr_kcal.toLocaleString('fr-FR')}</div>
              </div>
              <div className="bg-gray-700/50 rounded-xl p-2">
                <div className="text-xs text-gray-400 mb-0.5">Actif</div>
                <div className="text-sm font-semibold text-green-400">{lastGarminEntry.active_kcal.toLocaleString('fr-FR')}</div>
              </div>
              <div className="bg-gray-700/50 rounded-xl p-2">
                <div className="text-xs text-gray-400 mb-0.5">Pas</div>
                <div className="text-sm font-semibold text-blue-400">{(lastGarminEntry.steps ?? 0).toLocaleString('fr-FR')}</div>
              </div>
            </div>
          </div>
        )}

        {/* 5 — Suite */}
        {(isConnected() || hasRefreshToken()) && (
          <GoogleFitCard
            data={gfitData}
            loading={gfitLoading}
            tdeeGarmin={tdee}
            tdeeEffectif={tdeeEffectif}
            tdeeSource={tdeeSource}
            onRefresh={() => {
              setGfitLoading(true);
              fetchAllDayData(todayISO())
                .then((d) => { setGfitData(d); setGfitLoading(false); })
                .catch(() => setGfitLoading(false));
            }}
          />
        )}
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

      {/* Bouton Intégrations */}
      <div className="px-5 mb-4 flex justify-center">
        <button
          onClick={() => navigate('/integrations')}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors duration-200
                     flex items-center gap-1.5 py-1"
        >
          <span>⚙️</span>
          Intégrations
        </button>
      </div>
    </div>
  );
}
