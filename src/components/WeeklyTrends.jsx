// src/components/WeeklyTrends.jsx

/**
 * WeeklyTrends — Tendances hebdomadaires du mois
 *
 * Confronte l'estimation calorique (netBalance / 7700) à la variation
 * mesurée sur la balance, avec l'alcool de la semaine comme facteur
 * explicatif de l'écart (rétention d'eau + lipolyse en pause).
 *
 * @param {{ trends: Array<{week, label, avgIngested, avgBurned, trend, netBalance, fatKg, alcoholG, alcoholDays, scaleKg, gapKg}> }} props
 */
function SignedKg({ value, invertColors = false }) {
  if (value === null || value === undefined) {
    return <span className="text-sm font-bold text-gray-600">—</span>;
  }
  const good = invertColors ? value <= 0.1 : value <= 0;
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return (
    <span className={`text-sm font-bold ${good ? 'text-emerald-400' : 'text-red-400'}`}>
      {sign}{Math.abs(value).toFixed(2)} kg
    </span>
  );
}
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
          {trends.map(({ week, label, avgIngested, avgBurned, trend, fatKg, alcoholG, alcoholDays, scaleKg, gapKg }) => {
            const isSurplus = trend === 'surplus';
            const trendColor = isSurplus ? 'text-red-400' : 'text-emerald-400';
            const trendBg = isSurplus
              ? 'bg-red-900/20 border-red-700/30'
              : 'bg-emerald-900/20 border-emerald-700/30';
            const arrow = isSurplus ? '↑' : '↓';
            const diff = avgIngested - avgBurned;
            const diffSign = diff > 0 ? '+' : '';
            const hasAlcohol = alcoholDays > 0;
            // Écart notable : la balance a « rendu » nettement moins que l'estimation
            const gapWarn = hasAlcohol && gapKg !== null && gapKg > 0.15;

            return (
              <div
                key={week}
                className={`rounded-xl border px-4 py-3 ${trendBg}`}
              >
                <div className="flex items-center justify-between">
                  {/* Label semaine */}
                  <div className="flex flex-col gap-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        {label}
                      </span>
                      {hasAlcohol && (
                        <span className="text-[10px] font-semibold text-amber-400 bg-amber-900/30 border border-amber-700/30 rounded-full px-2 py-0.5">
                          🍷 {alcoholDays}j · {alcoholG} g
                        </span>
                      )}
                    </div>
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
                  </div>
                </div>

                {/* Estimé (kcal) vs Balance (mesuré) vs Écart */}
                <div className="grid grid-cols-3 gap-2 text-center mt-3 pt-3 border-t border-white/10">
                  <div>
                    <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-0.5">Estimé</p>
                    <SignedKg value={fatKg} />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-0.5">⚖️ Balance</p>
                    <SignedKg value={scaleKg} />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-0.5">Écart</p>
                    <SignedKg value={gapKg} invertColors />
                  </div>
                </div>

                {gapWarn && (
                  <p className="text-[10px] text-amber-400/90 mt-2 leading-snug">
                    🍷 Semaine alcoolisée : l'écart balance vs estimé reflète surtout la
                    rétention d'eau et la combustion des graisses mise en pause par l'alcool.
                  </p>
                )}
                {scaleKg === null && (
                  <p className="text-[10px] text-gray-600 mt-2">
                    Pas assez de pesées cette semaine pour comparer à la balance.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
