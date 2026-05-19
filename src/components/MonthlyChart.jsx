// src/components/MonthlyChart.jsx
import {
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

/** Noms de mois en français */
const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** Couleur de la ligne cible selon l'objectif */
const CIBLE_COLOR = {
  perte: '#ef4444',
  maintien: '#34d399',
  prise: '#60a5fa',
};

function CustomTooltip({ active, payload, label, month, year, cible, objectif }) {
  if (!active || !payload || payload.length === 0) return null;

  const nomMois = MOIS[(month ?? 1) - 1];
  const ingested = payload.find(p => p.dataKey === 'ingested');
  const burned = payload.find(p => p.dataKey === 'burned');
  const cibleColor = CIBLE_COLOR[objectif] ?? CIBLE_COLOR.maintien;

  return (
    <div className="bg-[#12122a] border border-white/10 rounded-xl p-3 text-sm shadow-2xl">
      <p className="text-gray-400 font-medium mb-2">
        {label} {nomMois} {year}
      </p>
      {ingested && ingested.value > 0 && (
        <p className="text-emerald-400">
          🥗 {ingested.value.toLocaleString('fr-FR')} kcal ingérées
        </p>
      )}
      {burned && burned.value > 0 && (
        <p className="text-violet-400">
          ⚡ {burned.value.toLocaleString('fr-FR')} kcal dépensées
        </p>
      )}
      {cible > 0 && (
        <p style={{ color: cibleColor }}>
          🎯 {cible.toLocaleString('fr-FR')} kcal cible
        </p>
      )}
      {(!ingested || ingested.value === 0) && (!burned || burned.value === 0) && (
        <p className="text-gray-600 italic">Aucune donnée</p>
      )}
    </div>
  );
}

/**
 * MonthlyChart — graphique linéaire calories ingérées vs dépensées
 * Affiche une ligne pointillée "Cible" si cible > 0.
 *
 * @param {{ data: Array<{day,date,ingested,burned}>, month: number, year: number, cible?: number, objectif?: string }} props
 */
export default function MonthlyChart({ data, month, year, cible, objectif }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[220px] text-gray-600 text-sm italic">
        Aucune donnée pour ce mois
      </div>
    );
  }

  // On n'affiche le point que si la valeur est > 0
  const dotIngested = ({ cx, cy, payload }) =>
    payload.ingested > 0 ? (
      <circle key={`dot-i-${payload.day}`} cx={cx} cy={cy} r={3} fill="#34d399" />
    ) : null;

  const dotBurned = ({ cx, cy, payload }) =>
    payload.burned > 0 ? (
      <circle key={`dot-b-${payload.day}`} cx={cx} cy={cy} r={3} fill="#8b5cf6" />
    ) : null;

  // Label de l'axe X : on affiche seulement les jours 1, 8, 15, 22, 28+
  const tickFormatter = (day) =>
    [1, 5, 10, 15, 20, 25].includes(day) ? String(day) : '';

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart
        data={data}
        margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey="day"
          tick={{ fill: '#6b7280', fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
          tickFormatter={tickFormatter}
        />
        <YAxis
          tick={{ fill: '#6b7280', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => v === 0 ? '' : `${(v / 1000).toFixed(1)}k`}
        />
        <Tooltip
          content={<CustomTooltip month={month} year={year} cible={cible} objectif={objectif} />}
          cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: '12px', paddingTop: '8px', color: '#9ca3af' }}
          formatter={(value) => {
            if (value === 'ingested') return 'Ingérées';
            if (value === 'burned') return 'Dépensées';
            return 'Cible';
          }}
        />
        {/* Ligne pointillée Cible */}
        {cible > 0 && (
          <ReferenceLine
            y={cible}
            stroke={CIBLE_COLOR[objectif] ?? CIBLE_COLOR.maintien}
            strokeDasharray="5 4"
            strokeWidth={1.5}
            label={{
              value: 'Cible',
              position: 'insideTopRight',
              fill: CIBLE_COLOR[objectif] ?? CIBLE_COLOR.maintien,
              fontSize: 10,
            }}
          />
        )}
        <Line
          type="monotone"
          dataKey="ingested"
          stroke="#34d399"
          strokeWidth={2}
          dot={dotIngested}
          activeDot={{ r: 5, fill: '#34d399' }}
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="burned"
          stroke="#8b5cf6"
          strokeWidth={2}
          dot={dotBurned}
          activeDot={{ r: 5, fill: '#8b5cf6' }}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
