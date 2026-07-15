// src/pages/Aide.jsx
import { useState } from 'react';

const GLOSSAIRE = [
  {
    terme: 'Alcool et lipolyse',
    label: "Pourquoi l'alcool freine la perte de gras",
    emoji: '🍷',
    definition: "L'alcool (7 kcal/g) ne peut pas être stocké : ton corps le brûle en priorité absolue. Pendant ce temps (~0,1 g par kg de poids et par heure), la combustion des graisses est quasi stoppée — même en déficit calorique. Sur la semaine, le déficit reste le facteur n°1, mais l'alcool retarde la lipolyse, favorise le stockage des graisses mangées en même temps et provoque une rétention d'eau qui masque la perte sur la balance pendant 2-3 jours.",
    formule: "Alcool (g) = volume(ml) × %vol × 0,789 — pause lipolyse ≈ g ÷ (0,1 × poids)",
    exemple: "2 pintes (40 g d'alcool) à 119 kg → ~3,4 h sans brûlage de gras + 280 kcal. Visible dans Stats : écart Estimé vs Balance des semaines 🍷",
  },
  {
    terme: 'BMR',
    label: 'Métabolisme de base',
    emoji: '🔥',
    definition: "Nombre de calories que ton corps brûle au repos pour assurer ses fonctions vitales (respiration, circulation, digestion…). Calculé ici avec la formule Mifflin-St Jeor.",
    formule: "BMR = 10 × poids(kg) + 6.25 × taille(cm) − 5 × âge + 5 (homme)",
    exemple: "119 kg, 180 cm, 37 ans → BMR ≈ 2 100 kcal/j",
  },
  {
    terme: 'TDEE',
    label: 'Dépense énergétique totale',
    emoji: '⚡',
    definition: "Calories totales que tu brûles sur une journée, en intégrant ton niveau d'activité habituel. C'est le point de référence central : manger exactement ce chiffre = maintien du poids.",
    formule: "TDEE = BMR × facteur d'activité (ou valeur mesurée Garmin)",
    exemple: "BMR 2 100 × 1.38 (modéré) ≈ 2 900 kcal/j — ou directement 2 750 kcal/j si mesuré Garmin",
  },
  {
    terme: 'TDEE du jour',
    label: 'Dépense réelle du jour',
    emoji: '📅',
    definition: "Ton TDEE de base augmenté des calories brûlées lors des activités sportives saisies ce jour-là. Varie donc chaque jour selon ton sport.",
    formule: "TDEE du jour = TDEE effectif + calories activités manuelles",
    exemple: "2 750 + 650 (séance muscu) = 3 400 kcal un jour de sport",
  },
  {
    terme: 'Cible',
    label: 'Objectif calorique du jour',
    emoji: '🎯',
    definition: "Nombre de calories à consommer pour atteindre ton objectif (perte, maintien ou prise). Calculée en soustrayant ou ajoutant un déficit/surplus à ton TDEE du jour.",
    formule: "Cible = TDEE du jour − déficit (ou + surplus)",
    exemple: "3 400 − 500 (déficit modéré) = 2 900 kcal à manger",
  },
  {
    terme: 'Déficit calorique',
    label: 'Manque par rapport au TDEE',
    emoji: '📉',
    definition: "Différence entre ce que tu brûles et ce que tu manges. Un déficit crée une perte de poids. Les niveaux proposés dans CalSnap : léger −250, modéré −500, agressif −750 kcal/j.",
    formule: "Déficit = TDEE du jour − calories ingérées",
    exemple: "−500 kcal/j ≈ −0.5 kg/semaine théorique (1 kg graisse ≈ 7 700 kcal)",
  },
  {
    terme: 'Surplus calorique',
    label: 'Excédent par rapport au TDEE',
    emoji: '📈',
    definition: "Manger plus que tu ne brûles. Utilisé pour la prise de masse musculaire. Les niveaux : léger +250, modéré +500 kcal/j. Un surplus trop important favorise la prise de graisse.",
    formule: "Surplus = calories ingérées − TDEE du jour",
    exemple: "+250 kcal/j = prise de masse lente et propre recommandée",
  },
  {
    terme: 'Bilan net',
    label: 'Écart ingérées vs cible',
    emoji: '⚖️',
    definition: "Différence entre ce que tu as mangé et ta cible du jour. Négatif = tu es en dessous de ta cible (bon si objectif perte). Positif = tu l'as dépassée.",
    formule: "Bilan net = ingérées − cible",
    exemple: "1 800 ingérées − 2 900 cible = −1 100 kcal (bilan très négatif)",
  },
  {
    terme: 'Déficit réel',
    label: 'Écart ingérées vs TDEE',
    emoji: '🔬',
    definition: "Comparaison directe entre tes calories brûlées et ingérées. Vert = tu es en déficit et tu perds du poids. Rouge = surplus, tu prends du poids.",
    formule: "Déficit réel = TDEE du jour − ingérées",
    exemple: "3 400 brûlées − 1 800 ingérées = +1 600 kcal de déficit réel",
  },
  {
    terme: 'LBM',
    label: 'Masse maigre (Lean Body Mass)',
    emoji: '💪',
    definition: "Poids de ton corps sans la graisse : muscles, os, organes, eau. Utilisé pour calculer l'objectif protéique de façon précise.",
    formule: "LBM = poids × (1 − % masse grasse / 100)",
    exemple: "119 kg × (1 − 0.377) = 74 kg de masse maigre",
  },
  {
    terme: '% MG',
    label: 'Pourcentage de masse grasse',
    emoji: '📊',
    definition: "Part de ton poids total constituée de graisse. Calculable via la méthode Navy (tour de taille, tour de cou, taille) dans ton profil, ou lu depuis ta balance connectée Garmin.",
    formule: "Méthode Navy (homme) : BF% = 495 / (1.0324 − 0.19077 × log10(taille−cou) + 0.15456 × log10(hauteur)) − 450",
    exemple: "37.7% MG → obésité classe 2 selon les normes hommes (> 25% = surpoids)",
  },
  {
    terme: 'Objectif protéines',
    label: 'Apport journalier en protéines',
    emoji: '🥩',
    definition: "Quantité de protéines à consommer chaque jour pour préserver et développer ta masse musculaire. Calculé selon ta masse maigre (LBM) et ton niveau d'activité.",
    formule: "Si % MG renseigné → objectif = LBM × 2.3 g  |  Sinon → poids × facteur activité",
    exemple: "74 kg LBM × 2.3 = 170 g/j de protéines",
  },
  {
    terme: 'Seuil anti-catabolisme',
    label: 'Minimum protéines pour protéger les muscles',
    emoji: '🛡️',
    definition: "En dessous de ce seuil, ton corps commence à puiser dans le muscle pour produire de l'énergie (catabolisme). Fixé à 75% de ton objectif, soit 1.6 g/kg LBM minimum.",
    formule: "Seuil = objectif protéines × 75%",
    exemple: "170 g × 0.75 = 127 g/j — barre rouge si tu es en dessous",
  },
  {
    terme: 'Macronutriments',
    label: 'Protéines, glucides, lipides',
    emoji: '🍽️',
    definition: "Les 3 grands nutriments énergétiques. CalSnap suit principalement les calories totales et les protéines. Chaque gramme fournit : protéines 4 kcal, glucides 4 kcal, lipides 9 kcal.",
    exemple: "100 g protéines = 400 kcal · 100 g glucides = 400 kcal · 100 g lipides = 900 kcal",
  },
  {
    terme: 'kcal',
    label: 'Kilocalorie (Calorie alimentaire)',
    emoji: '🔢',
    definition: "Unité d'énergie alimentaire. Ce qu'on appelle couramment 'calorie' sur les étiquettes alimentaires est en réalité une kilocalorie. 1 kcal = 1 000 calories (au sens physique).",
    exemple: "Un repas à 600 kcal apporte 600 kilocalories d'énergie",
  },
  {
    terme: 'Barre tricolore',
    label: 'Indicateur visuel du bilan',
    emoji: '🟢🟠🔴',
    definition: "Vert : tu es sous ta cible → déficit actif, perte de poids en cours. Orange : entre cible et TDEE → déficit annulé, maintien. Rouge : au-dessus du TDEE → surplus, prise de poids.",
    formule: "Vert ≤ cible < Orange ≤ TDEE < Rouge",
  },
  {
    terme: 'Mifflin-St Jeor',
    label: 'Formule de calcul du BMR',
    emoji: '🧮',
    definition: "Formule scientifique de référence pour estimer le métabolisme de base. Plus précise que la formule Harris-Benedict (1919) qu'elle a remplacée comme standard clinique.",
    formule: "Homme : 10P + 6.25T − 5A + 5  |  Femme : 10P + 6.25T − 5A − 161  (P=kg, T=cm, A=ans)",
  },
];

function GlossaireCard({ item, isOpen, onToggle }) {
  return (
    <div
      className="bg-[#1a1a2e] border border-white/10 rounded-xl overflow-hidden transition-all duration-200"
      onClick={onToggle}
    >
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer select-none">
        <div className="flex items-center gap-3">
          <span className="text-xl">{item.emoji}</span>
          <div>
            <span className="font-bold text-white text-sm">{item.terme}</span>
            <span className="text-gray-400 text-xs ml-2">— {item.label}</span>
          </div>
        </div>
        <svg
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {isOpen && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-2">
          <p className="text-gray-300 text-sm leading-relaxed">{item.definition}</p>
          {item.formule && (
            <div className="bg-[#0f0f1a] rounded-lg px-3 py-2 mt-2">
              <p className="text-violet-300 text-xs font-mono leading-relaxed">{item.formule}</p>
            </div>
          )}
          {item.exemple && (
            <p className="text-gray-500 text-xs italic">→ {item.exemple}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function Aide() {
  const [openIndex, setOpenIndex] = useState(null);
  const [recherche, setRecherche] = useState('');

  const filtered = GLOSSAIRE.filter(item =>
    item.terme.toLowerCase().includes(recherche.toLowerCase()) ||
    item.label.toLowerCase().includes(recherche.toLowerCase())
  );

  return (
    <div className="min-h-screen pb-28" style={{ backgroundColor: '#0f0f1a' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 pt-10 pb-4"
        style={{ backgroundColor: '#0f0f1a', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <h1 className="text-xl font-bold text-white mb-1">Glossaire</h1>
        <p className="text-gray-400 text-xs mb-3">Tous les termes techniques expliqués</p>
        <div className="relative">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Rechercher un terme…"
            value={recherche}
            onChange={e => setRecherche(e.target.value)}
            className="w-full bg-[#1a1a2e] border border-white/10 rounded-xl pl-9 pr-4 py-2.5
                       text-sm text-white placeholder-gray-500 outline-none focus:border-violet-500/50"
          />
        </div>
      </div>

      {/* Liste */}
      <div className="px-4 pt-4 space-y-2">
        {filtered.length === 0 ? (
          <p className="text-center text-gray-500 text-sm mt-10">Aucun terme trouvé</p>
        ) : (
          filtered.map((item, i) => (
            <GlossaireCard
              key={item.terme}
              item={item}
              isOpen={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))
        )}
      </div>

      {/* Footer info */}
      <div className="px-4 mt-6 mb-2">
        <div className="bg-violet-900/20 border border-violet-500/20 rounded-xl px-4 py-3">
          <p className="text-violet-300 text-xs text-center leading-relaxed">
            💡 Tape sur un terme pour voir sa définition, sa formule et un exemple concret.
          </p>
        </div>
      </div>
    </div>
  );
}
