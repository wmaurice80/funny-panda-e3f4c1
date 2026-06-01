// src/components/AnalyseResult.jsx
import { useState, useCallback } from 'react';
import { callClaude } from '../lib/claudeApi';

async function reestimer(nom, portion) {
  const json = await callClaude({
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: `Tu es un nutritionniste expert. Estime les calories et protéines pour : "${nom}", portion : "${portion}".
Retourne UNIQUEMENT un JSON valide (sans markdown) :
{"calories": 180, "proteines": 14.5}
IMPORTANT: Les protéines peuvent être des décimales (ex: 14.5). Sois précis.
Si impossible : {"erreur": "raison"}`,
    }],
  });
  const raw = json.content?.[0]?.text ?? '';
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Réponse inattendue');
  const parsed = JSON.parse(match[0]);
  if (parsed.erreur) throw new Error(parsed.erreur);
  return parsed;
}

function AlimentRow({ aliment, onChange, onDelete }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleReestimer() {
    if (!aliment.nom.trim() || !aliment.portion.trim()) return;
    setLoading(true);
    setError('');
    try {
      const result = await reestimer(aliment.nom, aliment.portion);
      onChange({ ...aliment, calories: result.calories, proteines: result.proteines ?? aliment.proteines });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <li className="flex flex-col gap-2 bg-[#0f0f1a] rounded-xl px-4 py-3 relative">
      {/* Bouton supprimer en haut à droite */}
      <button
        type="button"
        onClick={onDelete}
        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-900/30 border border-red-700/40
                   text-red-400 text-xs font-bold hover:bg-red-900/50 active:scale-95 transition-all duration-150
                   flex items-center justify-center"
        title="Supprimer cet aliment"
      >
        ×
      </button>

      {/* Nom éditable */}
      <input
        type="text"
        value={aliment.nom}
        onChange={e => onChange({ ...aliment, nom: e.target.value })}
        className="text-sm text-white font-medium bg-transparent border-b border-white/10
                   focus:outline-none focus:border-violet-500 transition-colors w-full"
      />

      {/* Portion + bouton IA */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={aliment.portion}
          onChange={e => onChange({ ...aliment, portion: e.target.value })}
          placeholder="ex. 150g"
          className="flex-1 text-xs text-gray-400 bg-[#1a1a2e] border border-white/10
                     rounded-lg px-2 py-1.5 focus:outline-none focus:border-violet-500 transition-colors"
        />
        <button
          type="button"
          onClick={handleReestimer}
          disabled={loading || !aliment.nom.trim() || !aliment.portion.trim()}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold
                     bg-violet-900/50 border border-violet-600/40 text-violet-300
                     disabled:opacity-40 hover:bg-violet-800/50 active:scale-95 transition-all duration-200"
        >
          {loading
            ? <div className="w-3 h-3 rounded-full border border-violet-300 border-t-transparent animate-spin" />
            : '↺'}
          {loading ? '' : 'IA'}
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Calories + protéines éditables */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 flex-1">
          <input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={aliment.calories}
            onChange={e => { const v = e.target.valueAsNumber; if (!isNaN(v)) onChange({ ...aliment, calories: v }); }}
            className="w-16 text-right bg-transparent text-violet-300 font-bold text-sm
                       border-b border-violet-600/50 focus:outline-none focus:border-violet-400"
          />
          <span className="text-xs text-gray-500">kcal</span>
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={aliment.proteines ?? 0}
            onChange={e => { const v = e.target.valueAsNumber; if (!isNaN(v)) onChange({ ...aliment, proteines: v }); }}
            className="w-12 text-right bg-transparent text-cyan-400 font-bold text-sm
                       border-b border-cyan-600/50 focus:outline-none focus:border-cyan-400"
          />
          <span className="text-xs text-gray-500">g prot</span>
        </div>
      </div>
    </li>
  );
}

export default function AnalyseResult({ result, onConfirm, onCancel }) {
  const [aliments, setAliments] = useState(
    (result.aliments ?? []).map(a => ({ ...a, portion: a.portion ?? '' }))
  );

  const totalCalories = aliments.reduce((s, a) => s + (a.calories ?? 0), 0);
  const totalProteines = aliments.reduce((s, a) => s + (a.proteines ?? 0), 0);

  const handleChange = useCallback((index, updated) => {
    setAliments(prev => prev.map((a, i) => i === index ? updated : a));
  }, []);

  const handleDelete = useCallback((index) => {
    setAliments(prev => prev.filter((_, i) => i !== index));
  }, []);

  const fiabiliteColor = {
    haute: 'text-emerald-400',
    moyenne: 'text-yellow-400',
    basse: 'text-red-400',
  }[result.fiabilite] ?? 'text-gray-400';

  return (
    <div className="bg-[#1a1a2e] rounded-2xl p-5 flex flex-col gap-4 shadow-xl animate-fade-in-up">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <h3 className="text-white font-bold text-lg">Résultat de l'analyse</h3>
        {result.fiabilite && (
          <span className={`text-xs font-semibold uppercase tracking-wider ${fiabiliteColor}`}>
            Fiabilité {result.fiabilite}
          </span>
        )}
      </div>

      <p className="text-xs text-gray-500 -mt-2">
        Modifie la description ou le grammage puis appuie sur <span className="text-violet-400 font-semibold">↺ IA</span> pour recalculer.
      </p>

      {/* Liste des aliments éditables */}
      {aliments.length > 0 && (
        <ul className="flex flex-col gap-2">
          {aliments.map((aliment, i) => (
            <AlimentRow
              key={i}
              aliment={aliment}
              onChange={updated => handleChange(i, updated)}
              onDelete={() => handleDelete(i)}
            />
          ))}
        </ul>
      )}

      {/* Remarque optionnelle */}
      {result.note && (
        <p className="text-xs text-gray-400 italic border-l-2 border-violet-700 pl-3">
          {result.note}
        </p>
      )}

      {/* Totaux */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between bg-[#0f0f1a] rounded-xl px-4 py-3">
          <span className="text-sm font-semibold text-gray-300">Total calories</span>
          <span className="text-xl font-extrabold text-white">
            {totalCalories} <span className="text-sm text-gray-400 font-normal">kcal</span>
          </span>
        </div>
        <div className="flex items-center justify-between bg-cyan-900/30 border border-cyan-700/40 rounded-xl px-4 py-3">
          <span className="text-sm font-semibold text-cyan-300">Total protéines</span>
          <span className="text-sm font-extrabold text-cyan-400">
            {Math.round(totalProteines * 10) / 10} g
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-3 rounded-2xl border border-white/10 bg-[#0f0f1a]
                     text-gray-400 font-medium text-sm
                     hover:bg-[#22223b] active:scale-95 transition-all duration-200"
        >
          Annuler
        </button>
        <button
          onClick={() => onConfirm(totalCalories, { ...result, aliments, totalCalories, totalProteines: Math.round(totalProteines * 10) / 10 })}
          className="flex-1 py-3 rounded-2xl
                     bg-gradient-to-r from-violet-600 to-indigo-500
                     text-white font-semibold text-sm shadow-lg shadow-violet-900/40
                     hover:opacity-90 active:scale-95 transition-all duration-200"
        >
          Ajouter au journal
        </button>
      </div>
    </div>
  );
}
