// src/components/MealCard.jsx
import { useState } from 'react';

/**
 * Carte représentant un repas enregistré dans le journal du jour.
 *
 * Props :
 *   meal      : objet repas (id, heure, aliments, totalCalories, note)
 *   onDelete  : (id) => void — appelé après confirmation de suppression
 */
export default function MealCard({ meal, onDelete }) {
  const [confirming, setConfirming] = useState(false);

  function handleDeleteClick() {
    if (confirming) {
      onDelete(meal.id);
    } else {
      setConfirming(true);
      // Revenir à l'état normal après 3 s si pas de 2e clic
      setTimeout(() => setConfirming(false), 3000);
    }
  }

  return (
    <div className="bg-[#1a1a2e] rounded-2xl p-4 flex flex-col gap-3 shadow-lg animate-fade-in-up">
      {/* En-tête : heure + total + bouton supprimer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-violet-300 bg-violet-900/40
                           border border-violet-700/50 px-2 py-0.5 rounded-full">
            {meal.heure}
          </span>
          <span className="font-bold text-white text-base">
            {meal.totalCalories} kcal
          </span>
          {(meal.totalProteines ?? 0) > 0 && (
            <span className="text-xs font-semibold text-cyan-400 bg-cyan-900/30
                             border border-cyan-700/40 px-2 py-0.5 rounded-full">
              {meal.totalProteines} g prot
            </span>
          )}
        </div>
        <button
          onClick={handleDeleteClick}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200
                      active:scale-90
                      ${confirming
                        ? 'bg-red-500/20 border border-red-500 text-red-400'
                        : 'bg-[#0f0f1a] border border-white/10 text-gray-500 hover:text-red-400 hover:border-red-500/50'
                      }`}
          title={confirming ? 'Confirmer la suppression' : 'Supprimer ce repas'}
        >
          {confirming ? (
            // Icône de confirmation (check)
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            // Icône croix
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          )}
        </button>
      </div>

      {/* Message de confirmation */}
      {confirming && (
        <p className="text-xs text-red-400 text-center animate-pulse">
          Cliquer à nouveau pour confirmer la suppression
        </p>
      )}

      {/* Liste des aliments */}
      {meal.aliments && meal.aliments.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {meal.aliments.map((aliment, i) => (
            <li key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0" />
                <span className="text-xs text-gray-400">{aliment.nom}</span>
                {aliment.portion && (
                  <span className="text-xs text-gray-600">— {aliment.portion}</span>
                )}
              </div>
              <span className="text-xs text-gray-500">{aliment.calories} kcal</span>
            </li>
          ))}
        </ul>
      )}

      {/* Note optionnelle */}
      {meal.note && (
        <p className="text-xs text-gray-600 italic">{meal.note}</p>
      )}
    </div>
  );
}
