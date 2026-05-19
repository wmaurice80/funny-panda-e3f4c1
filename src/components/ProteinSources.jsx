// src/components/ProteinSources.jsx
//
// Sprint 7C — Section "Sources de protéines" pré-configurées
// Reçoit onAjouter(aliment) en prop, gère son propre état d'affichage.

import { useState } from 'react';

// ─── Base de données ──────────────────────────────────────────────────────────

const PROTEIN_SOURCES = [
  // Suppléments
  { id: 'whey-dose', nom: 'Whey protéine', emoji: '🥤', portions: [
    { label: '1 dose (30g)', calories: 120, proteines: 24, portion: '1 dose (30g)' },
    { label: '2 doses (60g)', calories: 240, proteines: 48, portion: '2 doses (60g)' },
  ]},
  // Laitages protéinés
  { id: 'skyr', nom: 'Skyr nature', emoji: '🍶', portions: [
    { label: '100g', calories: 60, proteines: 10, portion: '100g' },
    { label: '1 pot (150g)', calories: 90, proteines: 15, portion: '1 pot (150g)' },
    { label: '1 grand pot (500g)', calories: 300, proteines: 50, portion: '1 grand pot (500g)' },
  ]},
  { id: 'petit-suisse', nom: 'Petit suisse 0%', emoji: '🧀', portions: [
    { label: '1 unité (60g)', calories: 40, proteines: 7, portion: '1 unité (60g)' },
    { label: '2 unités (120g)', calories: 80, proteines: 14, portion: '2 unités (120g)' },
  ]},
  { id: 'fromage-blanc', nom: 'Fromage blanc 0%', emoji: '🥛', portions: [
    { label: '100g', calories: 45, proteines: 8, portion: '100g' },
    { label: '1 c. à soupe (30g)', calories: 14, proteines: 2, portion: '1 c. à soupe (30g)' },
    { label: '1 pot (500g)', calories: 225, proteines: 40, portion: '1 pot (500g)' },
  ]},
  { id: 'yaourt-grec', nom: 'Yaourt grec 0%', emoji: '🍯', portions: [
    { label: '100g', calories: 59, proteines: 10, portion: '100g' },
    { label: '1 pot (150g)', calories: 89, proteines: 15, portion: '1 pot (150g)' },
  ]},
  { id: 'cottage', nom: 'Cottage cheese', emoji: '🧆', portions: [
    { label: '100g', calories: 84, proteines: 11, portion: '100g' },
    { label: '200g', calories: 168, proteines: 22, portion: '200g' },
  ]},
  { id: 'oeuf', nom: 'Oeuf entier', emoji: '🥚', portions: [
    { label: '1 oeuf (60g)', calories: 86, proteines: 7, portion: '1 oeuf (60g)' },
    { label: '2 oeufs', calories: 172, proteines: 14, portion: '2 oeufs (120g)' },
    { label: '3 oeufs', calories: 258, proteines: 21, portion: '3 oeufs (180g)' },
  ]},
  { id: 'blanc-oeuf', nom: "Blanc d'oeuf", emoji: '⬜', portions: [
    { label: '1 blanc (35g)', calories: 17, proteines: 4, portion: '1 blanc (35g)' },
    { label: '3 blancs', calories: 51, proteines: 12, portion: '3 blancs (105g)' },
    { label: '6 blancs', calories: 102, proteines: 24, portion: '6 blancs (210g)' },
  ]},
  { id: 'thon', nom: 'Thon en boîte', emoji: '🐟', portions: [
    { label: '1 boîte (140g égoutté)', calories: 147, proteines: 33, portion: '1 boîte (140g)' },
    { label: '100g', calories: 105, proteines: 24, portion: '100g' },
  ]},
  { id: 'poulet', nom: 'Blanc de poulet', emoji: '🍗', portions: [
    { label: '100g cuit', calories: 165, proteines: 31, portion: '100g cuit' },
    { label: '150g cuit', calories: 248, proteines: 47, portion: '150g cuit' },
  ]},
];

// ─── Composant ────────────────────────────────────────────────────────────────

export default function ProteinSources({ onAjouter }) {
  const [ouvert, setOuvert] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  function handleCardClick(id) {
    setSelectedId((prev) => (prev === id ? null : id));
  }

  function handlePortionClick(source, portion) {
    onAjouter({
      nom: source.nom,
      calories: portion.calories,
      proteines: portion.proteines,
      portion: portion.portion,
    });
    setSelectedId(null);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* En-tête cliquable */}
      <button
        onClick={() => {
          setOuvert((v) => !v);
          if (ouvert) setSelectedId(null);
        }}
        className="w-full flex items-center justify-between bg-[#1a1a2e] rounded-2xl px-4 py-3
                   border border-white/10 hover:border-violet-600/50 active:scale-[0.99]
                   transition-all duration-200"
      >
        <span className="text-sm font-semibold text-white">💪 Sources de protéines</span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${ouvert ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>

      {/* Contenu déplié */}
      {ouvert && (
        <div className="flex flex-col gap-2">
          {/* Grille 2 colonnes */}
          <div className="grid grid-cols-2 gap-2">
            {PROTEIN_SOURCES.map((source) => {
              const isSelected = selectedId === source.id;
              const maxProt = Math.max(...source.portions.map((p) => p.proteines));
              return (
                <div key={source.id} className="flex flex-col gap-1.5">
                  {/* Card aliment */}
                  <button
                    onClick={() => handleCardClick(source.id)}
                    className={`w-full flex flex-col items-start gap-1 rounded-xl p-3
                                transition-all duration-200 active:scale-95
                                ${isSelected
                                  ? 'bg-violet-900/50 border border-violet-500'
                                  : 'bg-[#22223b] border border-transparent hover:border-violet-700/50'}`}
                  >
                    <span className="text-2xl leading-none">{source.emoji}</span>
                    <span className="text-xs font-semibold text-white text-left leading-tight">
                      {source.nom}
                    </span>
                    <span className="text-cyan-400 text-xs font-bold">
                      jusqu'à {maxProt} g prot
                    </span>
                  </button>

                  {/* Chips de portions — visibles uniquement si cette card est sélectionnée */}
                  {isSelected && (
                    <div className="flex flex-col gap-1">
                      {source.portions.map((portion) => (
                        <button
                          key={portion.label}
                          onClick={() => handlePortionClick(source, portion)}
                          className="w-full bg-violet-600 hover:bg-violet-500 text-white text-xs
                                     rounded-xl px-3 py-1.5 font-medium active:scale-95
                                     transition-all duration-150 text-left"
                        >
                          <span className="block font-semibold">{portion.label}</span>
                          <span className="block text-violet-200 text-[10px]">
                            {portion.calories} kcal · {portion.proteines} g prot
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
