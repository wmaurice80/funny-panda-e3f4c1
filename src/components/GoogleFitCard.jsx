// src/components/GoogleFitCard.jsx
// Affiche les données Google Fit du jour sur le Dashboard.
// Props :
//   data       — { tdee, steps, heartRate, activities } depuis fetchAllDayData, ou null
//   loading    — boolean
//   tdeeGarmin — number (TDEE fixe Garmin du profil)
//   onRefresh  — callback déclenché au clic ↻

import { useNavigate } from 'react-router-dom';
import { getLastSync } from '../lib/googleFit';

/** Emojis par type d'activité (correspondance partielle sur le nom) */
function activityEmoji(name = '') {
  const n = name.toLowerCase();
  if (n.includes('course') || n.includes('running')) return '🏃';
  if (n.includes('vélo') || n.includes('cyclisme')) return '🚴';
  if (n.includes('natation') || n.includes('swim')) return '🏊';
  if (n.includes('yoga')) return '🧘';
  if (n.includes('muscu') || n.includes('force')) return '🏋️';
  if (n.includes('marche') || n.includes('walk')) return '🚶';
  if (n.includes('hiit')) return '⚡';
  if (n.includes('foot')) return '⚽';
  if (n.includes('rando')) return '🥾';
  return '🤸';
}

/** Formate un nombre avec séparateur de milliers français */
function fmtNum(n) {
  if (n == null || isNaN(n)) return '—';
  return Math.round(n).toLocaleString('fr-FR');
}

export default function GoogleFitCard({ data, loading, tdeeGarmin, tdeeEffectif, tdeeSource, onRefresh }) {
  const navigate = useNavigate();

  // ── État vide ──────────────────────────────────────────────────────────────
  if (!loading && !data) {
    return (
      <div className="bg-[#1a1a2e] rounded-2xl p-5 shadow-xl border border-white/5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏃</span>
            <span className="text-sm font-bold text-white">Google Fit</span>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full
                           bg-emerald-900/30 border border-emerald-700/40 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Connecté
          </span>
        </div>
        <p className="text-sm text-gray-400 text-center py-2">
          Sync pour voir tes données
        </p>
        <button
          onClick={() => navigate('/integrations')}
          className="w-full py-2.5 rounded-xl bg-violet-700/40 border border-violet-600/40
                     text-violet-200 font-medium text-sm flex items-center justify-center gap-2
                     hover:opacity-90 active:scale-95 transition-all duration-200"
        >
          <span>🔄</span>
          Aller aux intégrations
        </button>
      </div>
    );
  }

  // ── Chargement ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-[#1a1a2e] rounded-2xl p-5 shadow-xl border border-white/5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏃</span>
            <span className="text-sm font-bold text-white">Google Fit</span>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full
                           bg-emerald-900/30 border border-emerald-700/40 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Connecté
          </span>
        </div>
        <div className="flex items-center justify-center py-6">
          <div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  // ── Données disponibles ────────────────────────────────────────────────────
  const { tdee, steps, heartRate, activities } = data;

  // total = TDEE mesuré complet (calories.expended)
  // active = portion active seule (hors BMR)
  const tdeeFitTotal  = tdee?.total  ?? 0;
  const tdeeFitActive = tdee?.active ?? 0;
  const isUsedAsTDEE  = tdeeSource === 'gfit';

  // Max 3 activités
  const visibleActivities = Array.isArray(activities)
    ? activities.filter((a) => a.calories > 0 || a.dureeMin > 0).slice(0, 3)
    : [];

  return (
    <div className="bg-[#1a1a2e] rounded-2xl p-5 shadow-xl border border-white/5 flex flex-col gap-4 animate-fade-in-up">

      {/* ── En-tête ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏃</span>
          <span className="text-sm font-bold text-white">Google Fit</span>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full
                           bg-emerald-900/30 border border-emerald-700/40 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Connecté
          </span>
        </div>
        {onRefresh && (
          <div className="flex flex-col items-end gap-0.5">
            <button
              onClick={onRefresh}
              className="w-7 h-7 flex items-center justify-center rounded-lg
                         bg-[#22223b] border border-white/10 text-gray-400
                         hover:text-violet-300 hover:border-violet-700/50
                         active:scale-90 transition-all duration-200 text-base"
              title="Rafraîchir"
              aria-label="Rafraîchir Google Fit"
            >
              ↻
            </button>
            {(() => {
              const lastSync = getLastSync()
              if (!lastSync) return null
              const heure = new Date(lastSync).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
              return (
                <span className="text-xs text-gray-600">Sync : {heure}</span>
              )
            })()}
          </div>
        )}
      </div>

      {/* ── Grille métriques ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Pas */}
        <div className="bg-[#22223b] rounded-xl p-3 flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-base">👟</span>
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">Pas</span>
          </div>
          <span className="text-cyan-400 text-xl font-extrabold leading-none">
            {steps?.steps > 0 ? fmtNum(steps.steps) : '—'}
          </span>
          <span className="text-xs text-gray-600">pas aujourd'hui</span>
        </div>

        {/* TDEE total GFit (ou cal. actives si total indisponible) */}
        <div className={`rounded-xl p-3 flex flex-col gap-0.5 ${isUsedAsTDEE ? 'bg-violet-900/30 border border-violet-700/40' : 'bg-[#22223b]'}`}>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-base">🔥</span>
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
              {isUsedAsTDEE ? 'TDEE mesuré' : 'Cal. totales'}
            </span>
          </div>
          <span className={`text-xl font-extrabold leading-none ${isUsedAsTDEE ? 'text-violet-300' : 'text-orange-400'}`}>
            {tdeeFitTotal > 0 ? fmtNum(tdeeFitTotal) : '—'}
          </span>
          <span className="text-xs text-gray-600">
            {isUsedAsTDEE ? '✓ utilisé dans le bilan' : 'kcal détectées'}
          </span>
          {/* Décomposition BMR / actif si disponible */}
          {tdeeFitActive > 0 && tdee?.bmr > 0 && (
            <span className="text-[10px] text-gray-600 mt-0.5">
              BMR {fmtNum(tdee.bmr)} + actif {fmtNum(tdeeFitActive)}
            </span>
          )}
        </div>

        {/* Fréquence cardiaque */}
        {heartRate != null && (
          <div className="bg-[#22223b] rounded-xl p-3 flex flex-col gap-0.5 col-span-2">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-base">❤️</span>
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">Fréquence cardiaque</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-red-400 text-xl font-extrabold leading-none">
                moy. {fmtNum(heartRate.avg)} bpm
              </span>
              {heartRate.max > 0 && (
                <span className="text-xs text-gray-500">max {fmtNum(heartRate.max)} bpm</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Activités du jour ───────────────────────────────────────────────── */}
      {visibleActivities.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Activités du jour
          </span>
          {visibleActivities.map((act, i) => (
            <div
              key={i}
              className="bg-[#22223b] rounded-xl px-3 py-2 flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base flex-shrink-0">{activityEmoji(act.name)}</span>
                <span className="text-sm text-gray-200 font-medium truncate">{act.name}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 text-xs text-gray-400">
                {act.dureeMin > 0 && <span>{act.dureeMin} min</span>}
                {act.calories > 0 && (
                  <span className="text-orange-400 font-semibold">{fmtNum(act.calories)} kcal</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
