// src/components/ActivityCard.jsx
import { SPORT_TYPES } from '../utils/sports';

/**
 * ActivityCard — US-12
 * Affiche une activité sportive dans le journal du jour.
 * Props :
 *   activity  — objet { id, type, duree, caloriesBrulees, date, heure, note, createdAt }
 *   onDelete  — callback(id)
 */
export default function ActivityCard({ activity, onDelete }) {
  const sport = SPORT_TYPES[activity.type] ?? SPORT_TYPES.autre;

  return (
    <div className="bg-[#1a1a2e] rounded-2xl p-4 flex items-center gap-4 shadow-lg">
      {/* Emoji sport */}
      <div className="w-12 h-12 rounded-xl bg-orange-500/15 flex items-center justify-center text-2xl flex-shrink-0">
        {sport.emoji}
      </div>

      {/* Infos */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-white truncate">{sport.label}</span>
          <span className="font-extrabold text-orange-400 whitespace-nowrap text-sm">
            -{activity.caloriesBrulees} kcal
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-gray-500">⏱ {activity.duree} min</span>
          {activity.heure && (
            <span className="text-xs text-gray-600">{activity.heure}</span>
          )}
        </div>
        {activity.note && (
          <p className="text-xs text-gray-600 mt-1 truncate">{activity.note}</p>
        )}
      </div>

      {/* Bouton supprimer */}
      <button
        onClick={() => onDelete(activity.id)}
        className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center
                   text-red-400 hover:bg-red-500/25 active:scale-90 transition-all duration-150"
        aria-label="Supprimer l'activité"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4h6v2" />
        </svg>
      </button>
    </div>
  );
}
