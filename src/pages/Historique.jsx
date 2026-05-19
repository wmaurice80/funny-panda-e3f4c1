// src/pages/Historique.jsx
//
// US-23 : Historique des repas par jour
// Accessible depuis le Dashboard (bouton "📋 Historique") et depuis /repas
// Les jours sont triés du plus récent au plus ancien (accordéon)

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMealsGroupedByDate, deleteMeal } from '../db';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Formate une date ISO 'YYYY-MM-DD' en libellé français (ex. "Lundi 19 mai 2026") */
function formatDateFR(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  // Construire la date en local pour éviter les décalages UTC
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Badge emoji de catégorie */
const CATEGORIE_EMOJI = {
  'petit-dejeuner': '🌅',
  dejeuner: '☀️',
  diner: '🌙',
  collation: '🍎',
  dessert: '🍰',
  'saisie-manuelle': '✏️',
};

function categorieEmoji(cat) {
  return CATEGORIE_EMOJI[cat] ?? '🍽️';
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

/** Ligne d'un repas dans l'accordéon */
function RepasRow({ repas, onSupprimer }) {
  const [confirming, setConfirming] = useState(false);

  function handleDelete() {
    if (confirming) {
      onSupprimer(repas.id);
    } else {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {/* Ligne principale */}
      <div className="flex items-center gap-2 pl-4 pr-2 py-2">
        <span className="text-base flex-shrink-0">{categorieEmoji(repas.categorie)}</span>
        <span className="text-xs font-semibold text-violet-300 bg-violet-900/30
                         border border-violet-700/40 px-2 py-0.5 rounded-full flex-shrink-0">
          {repas.heure}
        </span>
        <span className="text-sm font-semibold text-white flex-1 truncate">
          {repas.totalCalories} kcal
        </span>

        {/* Bouton supprimer */}
        <button
          onClick={handleDelete}
          className={`w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0
                      transition-all duration-200 active:scale-90
                      ${confirming
                        ? 'bg-red-500/20 border border-red-500 text-red-400'
                        : 'bg-[#0f0f1a] border border-white/10 text-gray-600 hover:text-red-400 hover:border-red-500/40'
                      }`}
          title={confirming ? 'Confirmer la suppression' : 'Supprimer ce repas'}
        >
          {confirming ? (
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          )}
        </button>
      </div>

      {/* Message confirmation */}
      {confirming && (
        <p className="pl-4 text-xs text-red-400 animate-pulse pb-1">
          Cliquer à nouveau pour confirmer
        </p>
      )}

      {/* Aliments en petit */}
      {repas.aliments && repas.aliments.length > 0 && (
        <ul className="pl-10 pr-4 pb-1 flex flex-col gap-0.5">
          {repas.aliments.map((a, i) => (
            <li key={i} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-1 h-1 rounded-full bg-violet-600 flex-shrink-0" />
                <span className="text-xs text-gray-500 truncate">{a.nom}</span>
                {a.portion && (
                  <span className="text-xs text-gray-700 flex-shrink-0">— {a.portion}</span>
                )}
              </div>
              <span className="text-xs text-gray-600 flex-shrink-0">{a.calories} kcal</span>
            </li>
          ))}
        </ul>
      )}

      {/* Note optionnelle */}
      {repas.note && (
        <p className="pl-10 pr-4 pb-1 text-xs text-gray-700 italic">{repas.note}</p>
      )}
    </div>
  );
}

/** Card d'un jour (en-tête + accordéon) */
function JourCard({ groupe, onSupprimer }) {
  const [ouvert, setOuvert] = useState(false);

  return (
    <div className="bg-[#1a1a2e] rounded-2xl overflow-hidden shadow-lg">
      {/* En-tête cliquable */}
      <button
        onClick={() => setOuvert((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-4
                   hover:bg-white/5 active:bg-white/10 transition-colors duration-200"
      >
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-sm font-semibold text-white capitalize">
            {formatDateFR(groupe.date)}
          </span>
          <span className="text-xs text-gray-500">
            {groupe.meals.length} repas
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-violet-300 bg-violet-900/40
                           border border-violet-700/40 px-3 py-1 rounded-full">
            {groupe.totalCalories.toLocaleString('fr-FR')} kcal
          </span>
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform duration-250 ${ouvert ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {/* Corps accordéon */}
      {ouvert && (
        <div className="border-t border-white/5 divide-y divide-white/5">
          {groupe.meals.map((repas) => (
            <RepasRow
              key={repas.id}
              repas={repas}
              onSupprimer={onSupprimer}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function Historique() {
  const navigate = useNavigate();
  const [groupes, setGroupes] = useState([]);
  const [loading, setLoading] = useState(true);

  const chargerHistorique = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMealsGroupedByDate();
      setGroupes(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    chargerHistorique();
  }, [chargerHistorique]);

  async function handleSupprimer(id) {
    await deleteMeal(id);
    await chargerHistorique();
  }

  // ── Rendu ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen bg-[#0f0f1a] pb-36">

      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#0f0f1a]/95 backdrop-blur px-5 pt-12 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-full
                       bg-[#1a1a2e] border border-white/10 text-gray-400
                       hover:text-white active:scale-90 transition-all duration-200"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Historique</h1>
            {!loading && groupes.length > 0 && (
              <p className="text-xs text-gray-500 mt-0.5">
                {groupes.length} jour{groupes.length > 1 ? 's' : ''} enregistré{groupes.length > 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="px-5 flex flex-col gap-3">

        {/* Chargement */}
        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          </div>
        )}

        {/* État vide */}
        {!loading && groupes.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-20 text-gray-600">
            <div className="text-6xl select-none">📅</div>
            <div className="text-center">
              <p className="text-base font-semibold text-gray-500">Aucun repas enregistré</p>
              <p className="text-sm text-gray-700 mt-1">
                Photographiez ou saisissez vos repas pour les retrouver ici.
              </p>
            </div>
            <button
              onClick={() => navigate('/repas')}
              className="mt-2 px-6 py-3 rounded-2xl
                         bg-gradient-to-r from-violet-700/60 to-indigo-700/60
                         border border-violet-600/40 text-violet-200 text-sm font-medium
                         hover:opacity-90 active:scale-95 transition-all duration-200"
            >
              📸 Ajouter un premier repas
            </button>
          </div>
        )}

        {/* Liste des jours */}
        {!loading && groupes.map((groupe) => (
          <JourCard
            key={groupe.date}
            groupe={groupe}
            onSupprimer={handleSupprimer}
          />
        ))}

      </div>
    </div>
  );
}
