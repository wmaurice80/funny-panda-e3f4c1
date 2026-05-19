// src/components/MonthBilan.jsx

/**
 * MonthBilan — Card "Bilan du mois"
 * Affiche total ingéré, total dépensé, solde net et équivalence en graisse.
 *
 * @param {{ bilan: { totalIngested, totalBurned, netBalance, fatKg } }} props
 */
export default function MonthBilan({ bilan }) {
  if (!bilan) return null;

  const { totalIngested, totalBurned, netBalance, fatKg } = bilan;
  const isDeficit = netBalance <= 0;
  const bilanColor = isDeficit ? 'text-emerald-400' : 'text-red-400';
  const bilanBg = isDeficit ? 'bg-emerald-900/20 border-emerald-700/30' : 'bg-red-900/20 border-red-700/30';
  const fatSign = fatKg <= 0 ? '' : '+';
  const kcalSign = netBalance <= 0 ? '' : '+';

  // Pas encore de données
  const noData = totalIngested === 0 && totalBurned === 0;

  return (
    <div className="bg-[#1a1a2e] rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Bilan du mois
        </span>
        <span className="text-xl">🗓️</span>
      </div>

      {noData ? (
        <p className="text-gray-600 text-sm italic text-center py-2">
          Commencez à enregistrer vos repas et activités pour voir votre bilan mensuel 🌱
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Total ingéré */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-sm text-gray-400">Total ingéré</span>
            </div>
            <span className="font-bold text-emerald-400">
              {totalIngested.toLocaleString('fr-FR')} kcal
            </span>
          </div>

          {/* Total dépensé */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-violet-400" />
              <span className="text-sm text-gray-400">Total dépensé</span>
            </div>
            <span className="font-bold text-violet-400">
              {totalBurned.toLocaleString('fr-FR')} kcal
            </span>
          </div>

          {/* Séparateur */}
          <div className="border-t border-white/10" />

          {/* Solde net */}
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-gray-300">Solde net</span>
            <span className={`font-extrabold text-lg ${bilanColor}`}>
              {kcalSign}{netBalance.toLocaleString('fr-FR')} kcal
            </span>
          </div>

          {/* Équivalence graisse */}
          <div className={`rounded-xl px-4 py-3 border ${bilanBg}`}>
            <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide font-medium">
              Équivalence en masse grasse
            </p>
            <p className={`font-bold text-base ${bilanColor}`}>
              {kcalSign}{netBalance.toLocaleString('fr-FR')} kcal
              {' = '}
              {fatSign}{fatKg.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              {isDeficit
                ? '✓ Déficit calorique — vous perdez de la masse grasse'
                : '▲ Surplus calorique — vous stockez de la masse grasse'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
