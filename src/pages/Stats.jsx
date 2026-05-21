// src/pages/Stats.jsx
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProfile, getWeights } from '../db';
import { calculateBMR, calculateCible, calculateProteinGoal, getEffectiveTDEE } from '../utils/bmr';
import { getMonthlyData, getMonthBilan, getWeeklyTrends } from '../utils/stats';
import MonthlyChart from '../components/MonthlyChart';
import MonthBilan from '../components/MonthBilan';
import WeeklyTrends from '../components/WeeklyTrends';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';

/** Noms de mois en français */
const MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

/** Formate 'YYYY-MM-DD' en 'j mmm' (ex. '12 mai') */
function fmtDateShort(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/** Formate 'YYYY-MM-DD' en date longue FR */
function fmtDateLong(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

/** Tooltip poids pour Stats */
function WeightTooltipStats({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const { date, poids } = payload[0].payload;
  return (
    <div className="bg-[#22223b] border border-violet-700/50 rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="text-violet-300 font-semibold">{fmtDateLong(date)}</p>
      <p className="text-white font-bold">{poids.toFixed(1)} kg</p>
    </div>
  );
}

export default function Stats() {
  const navigate = useNavigate();
  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1..12

  const [tdee, setTdee] = useState(null);
  const [cible, setCible] = useState(null);
  const [objectif, setObjectif] = useState('maintien');
  const [proteinGoal, setProteinGoal] = useState(0);
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [monthlyData, setMonthlyData] = useState([]);
  const [bilan, setBilan] = useState(null);
  const [trends, setTrends] = useState([]);
  const [weightChartData, setWeightChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noProfile, setNoProfile] = useState(false);

  // Charge le profil, calcule le TDEE et la cible
  useEffect(() => {
    (async () => {
      const profile = await getProfile();
      if (!profile) {
        setNoProfile(true);
        setLoading(false);
        return;
      }
      const bmr = Math.round(calculateBMR(profile));
      const computedTdee = getEffectiveTDEE(profile, bmr);
      const computedCible = calculateCible(computedTdee, profile.objectif, profile.vitesseObjectif);
      setTdee(computedTdee);
      setCible(computedCible);
      setObjectif(profile.objectif ?? 'maintien');
      setProteinGoal(calculateProteinGoal(profile));
    })();
  }, []);

  // Réinitialise le navigateur journalier au jour le plus récent quand le mois change
  useEffect(() => { setSelectedDayIdx(0); }, [year, month]);

  // Charge les données statistiques dès que cible / mois / année changent
  const loadStats = useCallback(async () => {
    if (cible === null) return;
    setLoading(true);
    const prefix = `${String(year)}-${String(month).padStart(2, '0')}`;
    const [data, bil, trend, allWeights] = await Promise.all([
      getMonthlyData(year, month, tdee),
      getMonthBilan(year, month, tdee, cible),
      getWeeklyTrends(year, month, tdee),
      getWeights(),
    ]);
    setMonthlyData(data);
    setBilan(bil);
    setTrends(trend);
    // Filtrer les pesées du mois sélectionné
    setWeightChartData(
      allWeights
        .filter(w => w.date.startsWith(prefix))
        .map(w => ({ date: w.date, poids: w.poids }))
    );
    setLoading(false);
  }, [year, month, tdee, cible]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Navigation mois précédent / suivant
  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    const nextM = month === 12 ? 1 : month + 1;
    const nextY = month === 12 ? year + 1 : year;
    // Pas de navigation dans le futur au-delà du mois courant
    const limitY = now.getFullYear();
    const limitM = now.getMonth() + 1;
    if (nextY > limitY || (nextY === limitY && nextM > limitM)) return;
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth() + 1;

  if (noProfile) {
    return (
      <div className="flex flex-col min-h-screen bg-[#0f0f1a] items-center justify-center px-8 gap-5 pb-28">
        <span className="text-6xl">📊</span>
        <h2 className="text-xl font-bold text-white text-center">Profil requis</h2>
        <p className="text-sm text-gray-400 text-center">
          Crée ton profil pour activer les statistiques et le calcul de ton bilan calorique.
        </p>
        <button
          onClick={() => navigate('/profil')}
          className="px-6 py-3 rounded-2xl bg-violet-600 text-white font-semibold text-sm
                     hover:bg-violet-500 active:scale-95 transition-all duration-200"
        >
          Créer mon profil
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0f0f1a] pb-36">
      {/* Header */}
      <div className="px-5 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-white">Statistiques 📊</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Analyse de votre bilan calorique
        </p>
      </div>

      {/* Sélecteur de mois */}
      <div className="px-5 mb-4">
        <div className="bg-[#1a1a2e] rounded-2xl flex items-center justify-between px-4 py-3 shadow">
          <button
            onClick={prevMonth}
            className="w-9 h-9 rounded-xl flex items-center justify-center
                       text-gray-400 hover:text-white hover:bg-white/10
                       active:scale-90 transition-all duration-150"
            aria-label="Mois précédent"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              className="w-5 h-5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <span className="text-white font-semibold text-base">
            {MOIS[month - 1]} {year}
          </span>

          <button
            onClick={nextMonth}
            disabled={isCurrentMonth}
            className={`w-9 h-9 rounded-xl flex items-center justify-center
                        active:scale-90 transition-all duration-150
                        ${isCurrentMonth
                          ? 'text-gray-700 cursor-not-allowed'
                          : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
            aria-label="Mois suivant"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              className="w-5 h-5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1 pt-20">
          <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
        </div>
      ) : (
        <div className="px-5 flex flex-col gap-4">
          {/* Graphique mensuel */}
          <div className="bg-[#1a1a2e] rounded-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                Calories par jour
              </span>
              <div className="flex items-center gap-3 text-[10px] text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                  Ingérées
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-violet-400 inline-block" />
                  Dépensées
                </span>
              </div>
            </div>
            {monthlyData.every(d => d.ingested === 0 && d.burned === 0) ? (
              <div className="flex flex-col items-center justify-center h-[220px] gap-2">
                <span className="text-4xl">📊</span>
                <p className="text-gray-600 text-sm italic text-center">
                  Aucune donnée pour {MOIS[month - 1].toLowerCase()} {year}
                </p>
                <p className="text-gray-700 text-xs text-center">
                  Commencez à enregistrer vos repas et activités !
                </p>
              </div>
            ) : (
              <MonthlyChart data={monthlyData} month={month} year={year} cible={cible} objectif={objectif} />
            )}
          </div>

          {/* Bilan du mois */}
          <MonthBilan bilan={bilan} objectif={objectif} />

          {/* Tendances hebdomadaires */}
          <WeeklyTrends trends={trends} />

          {/* Bilan journalier — navigateur */}
          {(() => {
            const jours = monthlyData
              .filter(d => d.ingested > 0)
              .slice()
              .sort((a, b) => b.day - a.day); // plus récent en premier

            if (jours.length === 0) return (
              <div className="bg-[#1a1a2e] rounded-2xl p-4 shadow-xl">
                <p className="text-gray-600 text-sm italic text-center py-4">
                  Aucune donnée pour ce mois
                </p>
              </div>
            );

            const idx = Math.min(selectedDayIdx, jours.length - 1);
            const d = jours[idx];
            const delta = tdee > 0 && cible > 0 ? tdee - cible : 0;
            const cibleJour = Math.max(0, d.burned - delta);
            const bilanNet = d.ingested - cibleJour;
            const isOk = bilanNet <= 0;
            const isWarn = bilanNet > 0 && bilanNet <= 200;
            const bilanColor = isOk ? 'text-emerald-400' : isWarn ? 'text-orange-400' : 'text-red-400';
            const bilanIcon = isOk ? '✓' : isWarn ? '⚠' : '✗';

            return (
              <div className="bg-[#1a1a2e] rounded-2xl p-4 shadow-xl">
                {/* Header navigateur */}
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => setSelectedDayIdx(i => Math.min(i + 1, jours.length - 1))}
                    disabled={idx >= jours.length - 1}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150
                      ${idx >= jours.length - 1 ? 'text-gray-700 cursor-not-allowed' : 'text-gray-400 hover:text-white hover:bg-white/10 active:scale-90'}`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>

                  <div className="text-center">
                    <p className="text-white font-semibold text-sm">
                      {fmtDateLong(d.date)}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {idx + 1} / {jours.length} jours trackés
                    </p>
                  </div>

                  <button
                    onClick={() => setSelectedDayIdx(i => Math.max(i - 1, 0))}
                    disabled={idx <= 0}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150
                      ${idx <= 0 ? 'text-gray-700 cursor-not-allowed' : 'text-gray-400 hover:text-white hover:bg-white/10 active:scale-90'}`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </div>

                {/* Données du jour — 3 colonnes */}
                <div className="grid grid-cols-3 gap-3 text-center mb-4">
                  <div className="bg-[#0f0f1a] rounded-xl py-3">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Ingérées</p>
                    <p className="text-lg font-extrabold text-emerald-400">
                      {d.ingested.toLocaleString('fr-FR')}
                    </p>
                    <p className="text-[10px] text-gray-600">kcal</p>
                  </div>
                  <div className="bg-[#0f0f1a] rounded-xl py-3">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
                      {d.isSportDay ? 'Cible 🏋️' : 'Cible'}
                    </p>
                    <p className="text-lg font-extrabold text-violet-400">
                      {cibleJour.toLocaleString('fr-FR')}
                    </p>
                    <p className="text-[10px] text-gray-600">kcal</p>
                  </div>
                  <div className="bg-[#0f0f1a] rounded-xl py-3">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Bilan</p>
                    <p className={`text-lg font-extrabold ${bilanColor}`}>
                      {bilanNet > 0 ? '+' : ''}{bilanNet.toLocaleString('fr-FR')}
                    </p>
                    <p className={`text-[10px] font-bold ${bilanColor}`}>{bilanIcon}</p>
                  </div>
                </div>

                {/* Protéines */}
                {proteinGoal > 0 && (
                  <div className="border-t border-white/5 pt-3 flex items-center justify-between">
                    <span className="text-xs text-gray-500">💪 Protéines</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${d.proteines >= proteinGoal ? 'text-cyan-400' : 'text-gray-300'}`}>
                        {Math.round(d.proteines)} g
                      </span>
                      <span className="text-xs text-gray-600">/ {proteinGoal} g</span>
                      {d.proteines >= proteinGoal && <span className="text-xs text-cyan-400">✓</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Évolution du poids */}
          <div className="bg-[#1a1a2e] rounded-2xl p-4 shadow-xl">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">⚖️</span>
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                Évolution du poids
              </span>
            </div>
            {weightChartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[150px] gap-2">
                <span className="text-3xl">⚖️</span>
                <p className="text-gray-600 text-sm italic text-center">
                  Aucune pesée pour {MOIS[month - 1].toLowerCase()} {year}
                </p>
              </div>
            ) : (() => {
              const vals = weightChartData.map(w => w.poids);
              const yMin = Math.floor(Math.min(...vals) - 0.5);
              const yMax = Math.ceil(Math.max(...vals) + 0.5);
              return (
                <ResponsiveContainer width="100%" height={150}>
                  <LineChart
                    data={weightChartData}
                    margin={{ top: 6, right: 6, bottom: 0, left: -14 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0f" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={fmtDateShort}
                      tick={{ fill: '#6b7280', fontSize: 9 }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      domain={[yMin, yMax]}
                      tick={{ fill: '#6b7280', fontSize: 9 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<WeightTooltipStats />} />
                    <Line
                      type="monotone"
                      dataKey="poids"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#7c3aed', stroke: '#0f0f1a', strokeWidth: 1.5 }}
                      activeDot={{ r: 5, fill: '#7c3aed', stroke: '#0f0f1a', strokeWidth: 2 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
