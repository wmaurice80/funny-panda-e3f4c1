// src/components/DrinkSources.jsx
import { useState } from 'react';

const DRINKS = [
  {
    id: 'biere-blonde',
    nom: 'Bière blonde (5%)',
    emoji: '🍺',
    portions: [
      { label: 'Demi 25cl', calories: 108, proteines: 1, portion: '25 cl', alcoolG: 10 },
      { label: 'Canette 33cl', calories: 142, proteines: 1, portion: '33 cl', alcoolG: 13 },
      { label: 'Pinte 50cl', calories: 215, proteines: 2, portion: '50 cl', alcoolG: 20 },
    ],
  },
  {
    id: 'biere-50cl',
    nom: 'Bière 50cl',
    emoji: '🍺',
    portions: [
      { label: '50cl (5%)', calories: 215, proteines: 2, portion: '50 cl', alcoolG: 20 },
    ],
  },
  {
    id: 'biere-legere',
    nom: 'Bière légère (3%)',
    emoji: '🍻',
    portions: [
      { label: 'Demi 25cl', calories: 65, proteines: 1, portion: '25 cl', alcoolG: 6 },
      { label: 'Canette 33cl', calories: 86, proteines: 1, portion: '33 cl', alcoolG: 8 },
    ],
  },
  {
    id: 'biere-forte-8',
    nom: 'Bière forte (8%)',
    emoji: '🍺',
    portions: [
      { label: 'Demi 25cl', calories: 163, proteines: 1, portion: '25 cl', alcoolG: 16 },
      { label: 'Canette 33cl', calories: 215, proteines: 2, portion: '33 cl', alcoolG: 21 },
      { label: 'Bouteille 75cl', calories: 488, proteines: 3, portion: '75 cl', alcoolG: 47 },
    ],
  },
  {
    id: 'biere-forte-10',
    nom: 'Bière forte (10%)',
    emoji: '🍺',
    portions: [
      { label: 'Demi 25cl', calories: 200, proteines: 1, portion: '25 cl', alcoolG: 20 },
      { label: 'Canette 33cl', calories: 264, proteines: 2, portion: '33 cl', alcoolG: 26 },
      { label: 'Bouteille 75cl', calories: 600, proteines: 3, portion: '75 cl', alcoolG: 59 },
    ],
  },
  {
    id: 'vin-rouge',
    nom: 'Vin rouge',
    emoji: '🍷',
    portions: [
      { label: 'Verre 12cl', calories: 102, proteines: 0, portion: '12 cl', alcoolG: 12 },
      { label: 'Verre 15cl', calories: 128, proteines: 0, portion: '15 cl', alcoolG: 15 },
      { label: 'Demi-bouteille 37cl', calories: 315, proteines: 0, portion: '37 cl', alcoolG: 36 },
    ],
  },
  {
    id: 'vin-blanc',
    nom: 'Vin blanc sec',
    emoji: '🥂',
    portions: [
      { label: 'Verre 12cl', calories: 84, proteines: 0, portion: '12 cl', alcoolG: 11 },
      { label: 'Verre 15cl', calories: 105, proteines: 0, portion: '15 cl', alcoolG: 14 },
      { label: 'Demi-bouteille 37cl', calories: 259, proteines: 0, portion: '37 cl', alcoolG: 35 },
    ],
  },
  {
    id: 'champagne',
    nom: 'Champagne / Prosecco',
    emoji: '🍾',
    portions: [
      { label: 'Flûte 10cl', calories: 80, proteines: 0, portion: '10 cl', alcoolG: 9 },
      { label: 'Coupe 15cl', calories: 120, proteines: 0, portion: '15 cl', alcoolG: 14 },
    ],
  },
  {
    id: 'coca',
    nom: 'Coca-Cola',
    emoji: '🥤',
    portions: [
      { label: 'Verre 25cl', calories: 105, proteines: 0, portion: '25 cl' },
      { label: 'Canette 33cl', calories: 139, proteines: 0, portion: '33 cl' },
      { label: 'Bouteille 50cl', calories: 210, proteines: 0, portion: '50 cl' },
    ],
  },
  {
    id: 'coca-zero',
    nom: 'Coca-Cola Zéro / Light',
    emoji: '🫙',
    portions: [
      { label: 'Verre 25cl', calories: 1, proteines: 0, portion: '25 cl' },
      { label: 'Canette 33cl', calories: 1, proteines: 0, portion: '33 cl' },
    ],
  },
  {
    id: 'jus-orange',
    nom: "Jus d'orange",
    emoji: '🍊',
    portions: [
      { label: 'Verre 20cl', calories: 88, proteines: 1, portion: '20 cl' },
      { label: 'Grand verre 25cl', calories: 110, proteines: 1, portion: '25 cl' },
    ],
  },
  {
    id: 'lait',
    nom: 'Lait demi-écrémé',
    emoji: '🥛',
    portions: [
      { label: 'Verre 20cl', calories: 92, proteines: 6, portion: '20 cl' },
      { label: 'Grand verre 25cl', calories: 115, proteines: 8, portion: '25 cl' },
    ],
  },
  {
    id: 'cafe',
    nom: 'Café espresso',
    emoji: '☕',
    portions: [
      { label: 'Espresso 3cl', calories: 2, proteines: 0, portion: '3 cl' },
      { label: 'Double 6cl', calories: 4, proteines: 0, portion: '6 cl' },
      { label: 'Café allongé 15cl', calories: 5, proteines: 0, portion: '15 cl' },
    ],
  },
  {
    id: 'ti-punch-miel',
    nom: 'Ti Punch miel citron',
    emoji: '🍹',
    portions: [
      { label: 'Verre (4cl rhum)', calories: 140, proteines: 0, portion: '~8 cl', alcoolG: 16 },
    ],
  },
  {
    id: 'whisky',
    nom: 'Whisky / Rhum / Vodka',
    emoji: '🥃',
    portions: [
      { label: 'Shot 4cl', calories: 96, proteines: 0, portion: '4 cl', alcoolG: 13 },
      { label: 'Double shot 8cl', calories: 192, proteines: 0, portion: '8 cl', alcoolG: 25 },
    ],
  },
  {
    id: 'beurre-cacahuete-proteine',
    nom: 'Beurre cacahuète protéiné',
    emoji: '🥜',
    portions: [
      { label: '1 portion 34g (2 c.à.s)', calories: 195, proteines: 10, portion: '34 g' },
      { label: '2 portions 68g', calories: 390, proteines: 20, portion: '68 g' },
    ],
  },
  {
    id: 'ptit-suisse',
    nom: 'Petit-suisse nature',
    emoji: '🧀',
    portions: [
      { label: '1 pot 60g', calories: 80, proteines: 6, portion: '60 g' },
      { label: '2 pots 120g', calories: 160, proteines: 12, portion: '120 g' },
    ],
  },
  {
    id: 'eau',
    nom: 'Eau',
    emoji: '💧',
    portions: [
      { label: 'Verre 25cl', calories: 0, proteines: 0, portion: '25 cl' },
    ],
  },
];

export default function DrinkSources({ onAjouter }) {
  const [ouvert, setOuvert] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  function handleSelectPortion(drink, portion) {
    onAjouter({
      nom: `${drink.nom} (${portion.label})`,
      calories: portion.calories,
      proteines: portion.proteines,
      portion: portion.portion,
      ...(portion.alcoolG ? { alcoolG: portion.alcoolG } : {}),
    });
    setSelectedId(null);
  }

  return (
    <div className="bg-[#1a1a2e] rounded-2xl overflow-hidden">
      {/* En-tête accordéon */}
      <button
        type="button"
        onClick={() => { setOuvert(v => !v); setSelectedId(null); }}
        className="w-full flex items-center justify-between px-4 py-3.5
                   hover:bg-white/5 transition-colors duration-200"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🍺</span>
          <span className="text-sm font-semibold text-white">Boissons</span>
          <span className="text-xs text-gray-500">unités en cl</span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${ouvert ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>

      {ouvert && (
        <div className="px-3 pb-3">
          {/* Grille 2 colonnes */}
          <div className="grid grid-cols-2 gap-2">
            {DRINKS.map(drink => (
              <div key={drink.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(selectedId === drink.id ? null : drink.id)}
                  className={`w-full flex flex-col items-center gap-1 p-3 rounded-xl text-center
                              transition-all duration-200 active:scale-95
                              ${selectedId === drink.id
                                ? 'bg-violet-900/50 border border-violet-500'
                                : 'bg-[#22223b] border border-white/5 hover:border-violet-600/30'}`}
                >
                  <span className="text-2xl">{drink.emoji}</span>
                  <span className="text-xs font-medium text-white leading-tight">{drink.nom}</span>
                  <span className="text-[10px] text-gray-500">
                    {drink.portions[0].calories} kcal / {drink.portions[0].portion}
                  </span>
                </button>

                {/* Chips portions */}
                {selectedId === drink.id && (
                  <div className="flex flex-col gap-1.5 mt-1.5">
                    {drink.portions.map((p, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSelectPortion(drink, p)}
                        className="w-full flex items-center justify-between
                                   bg-violet-600 hover:bg-violet-500 active:scale-95
                                   text-white text-xs font-medium px-3 py-2 rounded-xl
                                   transition-all duration-200"
                      >
                        <span>{p.label}</span>
                        <span className="font-bold">{p.calories} kcal</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
