// src/pages/Poids.jsx
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Dot,
} from 'recharts';
import { getWeights } from '../db';
import { syncedAddWeight, syncedDeleteWeight } from '../lib/syncManager';

/** Formate 'YYYY-MM-DD' en 'j mmm' (ex. '12 mai') */
function formatDateFR(iso) {
  if (!iso) return '';
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/** Formate 'YYYY-MM-DD' en 'j mois année' long (ex. '12 mai 2025') */
function formatDateLongFR(iso) {
  if (!iso) return '';
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Date du jour en 'YYYY-MM-DD' */
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Tooltip personnalisé pour recharts */
function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const { date, poids } = payload[0].payload;
  return (
    <div className="bg-[#22223b] border border-violet-700/50 rounded-xl px-3 py-2 shadow-lg text-sm">
      <p className="text-violet-300 font-semibold">{formatDateLongFR(date)}</p>
      <p className="text-white font-bold">{poids.toFixed(1)} kg</p>
    </div>
  );
}

/** Point personnalisé — visible même avec une seule pesée */
function CustomDot(props) {
  const { cx, cy, payload, index, activeIndex } = props;
  const isActive = index === activeIndex;
  return (
    <Dot
      cx={cx}
      cy={cy}
      r={isActive ? 6 : 4}
      fill={isActive ? '#7c3aed' : '#8b5cf6'}
      stroke="#0f0f1a"
      strokeWidth={2}
    />
  );
}

export default function Poids() {
  const navigate = useNavigate();
  const [weights, setWeights] = useState([]);
  const [date, setDate] = useState(todayISO());
  const [poids, setPoids] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeIndex, setActiveIndex] = useState(null);

  const load = useCallback(async () => {
    const data = await getWeights();
    setWeights(data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(e) {
    e.preventDefault();
    const val = parseFloat(poids);
    if (!date || isNaN(val) || val <= 0) return;
    setSaving(true);
    await syncedAddWeight({ date, poids: val });
    await load();
    setPoids('');
    setDate(todayISO());
    setSaving(false);
  }

  async function handleDelete(id) {
    await syncedDeleteWeight(id);
    await load();
  }

  // ── Calculs stats ──────────────────────────────────────────────────────────
  const sorted = [...weights]; // déjà triés ASC par db
  const latest = sorted[sorted.length - 1];
  const oldest = sorted[0];

  const evolutionTotal =
    sorted.length >= 2
      ? (latest.poids - oldest.poids).toFixed(1)
      : null;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoISO = thirtyDaysAgo.toISOString().slice(0, 10);
  const weightsBefore30 = sorted.filter(w => w.date >= thirtyDaysAgoISO);
  const evolution30 =
    weightsBefore30.length >= 2
      ? (
          weightsBefore30[weightsBefore30.length - 1].poids -
          weightsBefore30[0].poids
        ).toFixed(1)
      : null;

  // Données graphique : on affiche tous les points
  const chartData = sorted.map(w => ({ date: w.date, poids: w.poids }));

  // Domaine Y : min-0.5 / max+0.5 pour éviter que la courbe colle aux bords
  const poidsValues = sorted.map(w => w.poids);
  const yMin = poidsValues.length ? Math.floor(Math.min(...poidsValues) - 0.5) : 0;
  const yMax = poidsValues.length ? Math.ceil(Math.max(...poidsValues) + 0.5) : 100;

  return (
    <div className="flex flex-col min-h-screen bg-[#0f0f1a] pb-36">
      {/* Header */}
      <div className="px-5 pt-12 pb-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl bg-[#1a1a2e] flex items-center justify-center
                     text-gray-400 hover:text-white active:scale-90 transition-all"
          aria-label="Retour"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-white">Mon poids ⚖️</h1>
      </div>

      <div className="px-5 flex flex-col gap-4">
        {/* ── Card saisie ─────────────────────────────────────────────────── */}
        <div className="bg-[#1a1a2e] rounded-2xl p-5 shadow-xl">
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Ajouter une pesée
          </span>
          <form onSubmit={handleSave} className="mt-3 flex flex-col gap-3">
            <div className="flex gap-3">
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-xs text-gray-500">Date</label>
                <input
                  type="date"
                  value={date}
                  max={todayISO()}
                  onChange={e => setDate(e.target.value)}
                  className="bg-[#0f0f1a] border border-white/10 rounded-xl px-3 py-2
                             text-white text-sm focus:outline-none focus:border-violet-500
                             focus:ring-1 focus:ring-violet-500 transition-all"
                />
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-xs text-gray-500">Poids (kg)</label>
                <input
                  type="number"
                  value={poids}
                  onChange={e => setPoids(e.target.value)}
                  step="0.1"
                  min="20"
                  max="300"
                  placeholder="72.5"
                  className="bg-[#0f0f1a] border border-white/10 rounded-xl px-3 py-2
                             text-white text-sm focus:outline-none focus:border-violet-500
                             focus:ring-1 focus:ring-violet-500 transition-all"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={saving || !poids || !date}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-700 to-indigo-700
                         text-white font-semibold text-sm
                         disabled:opacity-40 disabled:cursor-not-allowed
                         hover:opacity-90 active:scale-95 transition-all duration-200"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </form>
        </div>

        {/* ── Stats rapides (si ≥ 2 pesées) ──────────────────────────────── */}
        {sorted.length >= 2 && (
          <div className="grid grid-cols-3 gap-3">
            {/* Poids actuel */}
            <div className="bg-[#1a1a2e] rounded-2xl p-3 flex flex-col items-center gap-1 shadow">
              <span className="text-[10px] text-gray-500 uppercase tracking-widest text-center">Actuel</span>
              <span className="text-xl font-extrabold text-white">{latest.poids.toFixed(1)}</span>
              <span className="text-[10px] text-gray-500">kg</span>
            </div>

            {/* Évolution totale */}
            <div className="bg-[#1a1a2e] rounded-2xl p-3 flex flex-col items-center gap-1 shadow">
              <span className="text-[10px] text-gray-500 uppercase tracking-widest text-center">Total</span>
              <span className={`text-xl font-extrabold ${
                parseFloat(evolutionTotal) < 0
                  ? 'text-emerald-400'
                  : parseFloat(evolutionTotal) > 0
                  ? 'text-red-400'
                  : 'text-gray-300'
              }`}>
                {parseFloat(evolutionTotal) > 0 ? '+' : ''}{evolutionTotal}
              </span>
              <span className="text-[10px] text-gray-500">kg</span>
            </div>

            {/* Évolution 30 jours */}
            <div className="bg-[#1a1a2e] rounded-2xl p-3 flex flex-col items-center gap-1 shadow">
              <span className="text-[10px] text-gray-500 uppercase tracking-widest text-center">30 jours</span>
              {evolution30 !== null ? (
                <>
                  <span className={`text-xl font-extrabold ${
                    parseFloat(evolution30) < 0
                      ? 'text-emerald-400'
                      : parseFloat(evolution30) > 0
                      ? 'text-red-400'
                      : 'text-gray-300'
                  }`}>
                    {parseFloat(evolution30) > 0 ? '+' : ''}{evolution30}
                  </span>
                  <span className="text-[10px] text-gray-500">kg</span>
                </>
              ) : (
                <span className="text-xs text-gray-600 text-center mt-1">—</span>
              )}
            </div>
          </div>
        )}

        {/* ── Graphique ────────────────────────────────────────────────────── */}
        <div className="bg-[#1a1a2e] rounded-2xl p-4 shadow-xl">
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Courbe d'évolution
          </span>

          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[200px] gap-2">
              <span className="text-4xl">⚖️</span>
              <p className="text-gray-600 text-sm italic text-center">
                Aucune pesée enregistrée
              </p>
              <p className="text-gray-700 text-xs text-center">
                Ajoutez votre premier poids ci-dessus
              </p>
            </div>
          ) : (
            <div className="mt-3">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart
                  data={chartData}
                  margin={{ top: 8, right: 8, bottom: 0, left: -10 }}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0f" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateFR}
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[yMin, yMax]}
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v => `${v}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="poids"
                    stroke="#8b5cf6"
                    strokeWidth={2.5}
                    dot={<CustomDot activeIndex={activeIndex} />}
                    activeDot={{
                      r: 6,
                      fill: '#7c3aed',
                      stroke: '#0f0f1a',
                      strokeWidth: 2,
                      onMouseOver: (_, index) => setActiveIndex(index),
                    }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* ── Historique ───────────────────────────────────────────────────── */}
        <div className="bg-[#1a1a2e] rounded-2xl p-4 shadow-xl">
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Historique
          </span>

          {sorted.length === 0 ? (
            <p className="text-gray-600 text-sm italic mt-3 text-center">
              Aucune pesée pour le moment
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {[...sorted].reverse().map(w => (
                <li
                  key={w.id}
                  className="flex items-center justify-between py-2.5 px-3
                             bg-[#0f0f1a] rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base">⚖️</span>
                    <div>
                      <p className="text-white font-semibold text-sm">
                        {w.poids.toFixed(1)} kg
                      </p>
                      <p className="text-gray-500 text-xs">{formatDateLongFR(w.date)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(w.id)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center
                               text-gray-600 hover:text-red-400 hover:bg-red-900/20
                               active:scale-90 transition-all duration-150"
                    aria-label="Supprimer"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      className="w-4 h-4">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14H6L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4h6v2" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
