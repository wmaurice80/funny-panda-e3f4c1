// src/components/WeeklyTrends.jsx

/**
 * WeeklyTrends — Tendances hebdomadaires du mois
 *
 * @param {{ trends: Array<{week, label, avgIngested, avgBurned, trend, netBalance, fatKg}> }} props
 */
export default function WeeklyTrends({ trends }) {
  return (
    <div className="bg-[#1a1a2e] rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Tendances hebdomadaires
        </span>
        <span className="text-xl">📈</span>
      </div>

      {!trends || trends.length === 0 ? (
        <p className="text-gray-600 text-sm italic text-center py-2">
          Pas encore de données hebdomadaires pour ce mois 🌱
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {trends.map(({ week, label, avgIngested, avgBurned, trend, netBalance, fatKg }) => {
            const isSurplus = trend === 'surplus';
            const trendColor = isSurplus ? 'text-red-400' : 'text-emerald-400';
            const trendBg = isSurplus
              ? 'bg-red-900/20 border-red-700/30'
              : 'bg-emerald-900/20 border-emerald-700/30';
            const arrow = isSurplus ? '↑' : '↓';
            const diff = avgIngested - avgBurned;
            const diffSign = diff > 0 ? '+' : '';
            const fatSign = fatKg > 0 ? '+' : '';
            const fatColor = fatKg < 0 ? 'text-emerald-400' : 'text-red-400';

            return (
              <div
                key={week}
                className={`rounded-xl border px-4 py-3 flex items-center justify-between ${trendBg}`}
              >
                {/* Label semaine */}
                <div className="flex flex-col gap-1 flex-1">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    {label}
                  </span>
                  <div className="flex flex-col gap-0.5 mt-1">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span className="text-xs text-gray-500">
                        Ingérées : {avgIngested.toLocaleString('fr-FR')} kcal/j
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                      <span className="text-xs text-gray-500">
                        Dépensées : {avgBurned.toLocaleString('fr-FR')} kcal/j
                      </span>
                    </div>
                  </div>
                </div>

                {/* Indicateur tendance */}
                <div className="flex flex-col items-center gap-1 ml-4">
                  <span className={`text-2xl font-extrabold leading-none ${trendColor}`}>
                    {arrow}
                  </span>
                  <span className={`text-xs font-semibold ${trendColor}`}>
                    {diffSign}{diff.toLocaleString('fr-FR')}
                  </span>
                  <span className="text-[10px] text-gray-600 uppercase tracking-wide">
                    {isSurplus ? 'surplus' : 'déficit'}
                  </span>
                  {/* Solde net de masse grasse */}
                  <div className="mt-1.5 pt-1.5 border-t border-white/10">
                    <span className={`text-xs font-bold ${fatColor}`}>
                      {fatSign}{Math.abs(fatKg).toFixed(2)} kg
                    </span>
                    <span className="text-[10px] text-gray-600 block mt-0.5">
                      masse grasse
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
