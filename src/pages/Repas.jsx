// src/pages/Repas.jsx
//
// ⚠️  SÉCURITÉ : L'appel à l'API Anthropic est effectué directement depuis le navigateur.
// La clé VITE_ANTHROPIC_API_KEY est donc exposée dans le bundle JavaScript côté client.
// Pour une application de production, il faudrait obligatoirement passer par un backend proxy
// (ex. : une route /api/analyse-repas sur votre serveur) qui détient la clé en secret.
// Pour un usage personnel / démo, cette approche est acceptable.

import { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMealsForDate } from '../db';
import { syncedAddMeal, syncedDeleteMeal } from '../lib/syncManager';
import { callClaude, QuotaExceededError, AI_QUOTA_LIMIT, AI_QUOTA_WARNING_THRESHOLD } from '../lib/claudeApi';
import { getAiUsage } from '../lib/supabaseDb';
import AnalyseResult from '../components/AnalyseResult';
import MealCard from '../components/MealCard';
import CameraCapture from '../components/CameraCapture';
import { useAuth } from '../lib/AuthContext';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function nowHHMM() {
  return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function defaultCategorie() {
  const h = new Date().getHours();
  if (h < 10) return 'petit-dejeuner';
  if (h < 14) return 'dejeuner';
  if (h < 18) return 'collation';
  if (h < 22) return 'diner';
  return 'collation';
}

const CATEGORIES = [
  { key: 'petit-dejeuner', label: 'Petit-déj', emoji: '🌅' },
  { key: 'dejeuner',       label: 'Déjeuner',  emoji: '🍽️' },
  { key: 'diner',          label: 'Dîner',      emoji: '🌙' },
  { key: 'collation',      label: 'Collation',  emoji: '🍎' },
  { key: 'dessert',        label: 'Dessert',    emoji: '🍰' },
];

/**
 * Convertit un File en base64 (sans le préfixe data:...;base64,)
 * et retourne aussi le media_type.
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const [meta, data] = dataUrl.split(',');
      const mediaType = meta.match(/:(.*?);/)[1]; // ex. image/jpeg
      resolve({ data, mediaType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Appelle l'API Anthropic Claude pour analyser une image de repas.
 * Retourne l'objet JSON parsé.
 */
async function analyserRepas(base64Data, mediaType) {
  const json = await callClaude({
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: base64Data },
        },
        {
          type: 'text',
          text: `Tu es un nutritionniste expert. Analyse cette photo de repas et retourne UNIQUEMENT un objet JSON valide (sans markdown, sans explication) avec cette structure exacte:
{
  "aliments": [
    { "nom": "Nom de l'aliment", "calories": 150, "proteines": 12.5, "portion": "100g" }
  ],
  "totalCalories": 450,
  "totalProteines": 24.5,
  "fiabilite": "haute|moyenne|basse",
  "note": "Remarque courte si nécessaire"
}
IMPORTANT: Les protéines peuvent être des décimales (ex: 12.5). Sois précis.
Si tu ne peux pas analyser l'image, retourne: {"erreur": "Description du problème"}`,
        },
      ],
    }],
  });

  const rawText = json.content?.[0]?.text ?? '';
  const match = rawText.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Réponse inattendue de Claude : ' + rawText);
  const parsed = JSON.parse(match[0]);
  if (parsed.erreur) throw new Error(parsed.erreur);
  return parsed;
}

// ────────────────────────────────────────────────────────────────────────────

export default function Repas() {
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const navigate = useNavigate();
  const { user } = useAuth();


  // États catégorie + date/heure
  const [categorie, setCategorie] = useState(defaultCategorie);
  const [repasDate, setRepasDate] = useState(todayISO);
  const [repasHeure, setRepasHeure] = useState(nowHHMM);

  // États de la flow analyse
  const [analysing, setAnalysing] = useState(false);
  const [analyseResult, setAnalyseResult] = useState(null);
  const [analyseError, setAnalyseError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [showCamera, setShowCamera] = useState(false);

  // Quota IA
  const [aiUsageCount, setAiUsageCount] = useState(null); // null = chargement

  // Journal du jour
  const [meals, setMeals] = useState([]);
  const [loadingMeals, setLoadingMeals] = useState(true);

  // Charger les repas du jour
  const loadMeals = useCallback(async () => {
    const data = await getMealsForDate(todayISO());
    // Trier par heure croissante
    data.sort((a, b) => a.heure.localeCompare(b.heure));
    setMeals(data);
    setLoadingMeals(false);
  }, []);

  // Charger le quota IA
  const loadAiUsage = useCallback(async () => {
    if (!user?.id) { setAiUsageCount(0); return; }
    const count = await getAiUsage();
    setAiUsageCount(count);
  }, [user?.id]);

  useEffect(() => {
    loadMeals();
  }, [loadMeals]);

  useEffect(() => {
    loadAiUsage();
  }, [loadAiUsage]);

  // Listener natif sur l'input caméra — contourne le bug Android avec capture="environment"
  useEffect(() => {
    const input = cameraInputRef.current;
    if (!input) return;
    const handler = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setAnalyseResult(null);
      setAnalyseError(null);
      setPreviewUrl(URL.createObjectURL(file));
      lancerAnalyse(file);
    };
    input.addEventListener('change', handler);
    return () => input.removeEventListener('change', handler);
  }, []);

  // ── Sélection / capture de la photo ──────────────────────────────────────

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Réinitialiser l'état précédent
    setAnalyseResult(null);
    setAnalyseError(null);

    // Aperçu local immédiat
    setPreviewUrl(URL.createObjectURL(file));

    // Lancer l'analyse
    lancerAnalyse(file);
  }

  async function lancerAnalyse(file) {
    setAnalysing(true);
    try {
      const { data, mediaType } = await fileToBase64(file);
      const result = await analyserRepas(data, mediaType);
      setAnalyseResult(result);
      // Rafraîchir le compteur après une analyse réussie
      loadAiUsage();
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        setAnalyseError(`Quota mensuel atteint (${AI_QUOTA_LIMIT} analyses/mois). Revenez le mois prochain.`);
      } else {
        setAnalyseError(err.message ?? 'Erreur inconnue');
      }
    } finally {
      setAnalysing(false);
    }
  }

  // ── Validation et enregistrement ─────────────────────────────────────────

  async function handleConfirm(finalCalories, result) {
    const meal = {
      date: repasDate,
      heure: repasHeure,
      categorie,
      aliments: result.aliments ?? [],
      totalCalories: finalCalories,
      totalProteines: result.totalProteines ?? 0,
      note: result.note ?? '',
      fiabilite: result.fiabilite ?? '',
    };
    await syncedAddMeal(meal);

    // Réinitialiser l'UI
    setAnalyseResult(null);
    setPreviewUrl(null);
    if (galleryInputRef.current) galleryInputRef.current.value = '';

    // Recharger le journal
    await loadMeals();
  }

  function handleCancel() {
    setAnalyseResult(null);
    setAnalyseError(null);
    setPreviewUrl(null);
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  }

  function handleCameraCapture(file) {
    setShowCamera(false);
    setAnalyseResult(null);
    setAnalyseError(null);
    setPreviewUrl(URL.createObjectURL(file));
    lancerAnalyse(file);
  }

  // ── Suppression d'un repas ────────────────────────────────────────────────

  async function handleDeleteMeal(id) {
    await syncedDeleteMeal(id);
    await loadMeals();
  }

  // ── Total kcal du jour ────────────────────────────────────────────────────

  const totalJour = meals.reduce((sum, m) => sum + (m.totalCalories ?? 0), 0);

  // ── Quota IA ──────────────────────────────────────────────────────────────

  const quotaAtteint = aiUsageCount !== null && aiUsageCount >= AI_QUOTA_LIMIT;
  const quotaAlerte = aiUsageCount !== null && aiUsageCount >= AI_QUOTA_WARNING_THRESHOLD;

  // ────────────────────────────────────────────────────────────────────────

  return (
    <>
    {showCamera && (
      <CameraCapture
        onCapture={handleCameraCapture}
        onCancel={() => setShowCamera(false)}
      />
    )}
    <div className="flex flex-col min-h-screen bg-[#0f0f1a] pb-36">
      {/* Header */}
      <div className="px-5 pt-12 pb-6">
        <p className="text-sm text-gray-500 font-medium">
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <h1 className="text-2xl font-bold text-white mt-0.5">Repas 📸</h1>
      </div>

      <div className="px-5 flex flex-col gap-5">

        {/* ── Catégorie du repas (US-21) ───────────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {CATEGORIES.map(({ key, label, emoji }) => (
            <button
              key={key}
              onClick={() => setCategorie(key)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200
                ${categorie === key
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/40'
                  : 'bg-[#1a1a2e] text-gray-400 border border-white/10'}`}
            >
              <span>{emoji}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* ── Date et heure du repas (US-22) ───────────────────────────────── */}
        <div className="bg-[#1a1a2e] rounded-2xl p-4 flex gap-3">
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-xs text-gray-500 font-medium">Date</label>
            <input
              type="date"
              value={repasDate}
              onChange={e => setRepasDate(e.target.value)}
              className="bg-[#22223b] border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-xs text-gray-500 font-medium">Heure</label>
            <input
              type="time"
              value={repasHeure}
              onChange={e => setRepasHeure(e.target.value)}
              className="bg-[#22223b] border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>
        </div>

        {/* ── Zone analyse ─────────────────────────────────────────────────── */}

        {/* Compteur quota IA */}
        {aiUsageCount !== null && (
          <div className={`flex items-center justify-end gap-1.5 text-xs font-medium
            ${quotaAlerte ? 'text-red-400' : 'text-gray-500'}`}>
            <span>Analyses IA ce mois :</span>
            <span className={`px-2 py-0.5 rounded-full border
              ${quotaAlerte
                ? 'bg-red-950/50 border-red-700/50 text-red-300'
                : 'bg-[#1a1a2e] border-white/10 text-gray-400'}`}>
              {aiUsageCount} / {AI_QUOTA_LIMIT}
            </span>
          </div>
        )}

        {/* Boutons (visible si pas d'analyse en cours / résultat affiché) */}
        {!analysing && !analyseResult && (
          <>
            {/* Input galerie — masqué si non autorisé */}
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {quotaAtteint ? (
                /* Quota atteint — bouton désactivé */
                <div className="flex flex-col items-center justify-center gap-3 w-full py-10
                                rounded-3xl bg-[#1a1a2e] border border-red-800/50 text-center px-6">
                  <span className="text-4xl">🚫</span>
                  <span className="text-red-300 font-semibold text-sm">Quota mensuel atteint</span>
                  <span className="text-red-500 text-xs">
                    Tu as utilisé {AI_QUOTA_LIMIT}/{AI_QUOTA_LIMIT} analyses IA ce mois-ci.
                    Reviens le mois prochain.
                  </span>
                </div>
            ) : (
              /* Bouton caméra principal */
              <button
                type="button"
                onClick={() => setShowCamera(true)}
                className="flex flex-col items-center justify-center gap-3 w-full py-10
                           rounded-3xl
                           bg-gradient-to-br from-violet-700 to-indigo-600
                           shadow-xl shadow-violet-900/40
                           hover:opacity-90 active:scale-95 transition-all duration-200"
              >
                <span className="text-5xl">📸</span>
                <span className="text-white font-semibold text-base tracking-wide">
                  Photographier un repas
                </span>
                <span className="text-violet-200 text-xs">
                  L'IA analysera les calories et protéines
                </span>
              </button>
            )}

            {/* Boutons secondaires */}
            <div className="flex gap-2">
              {!quotaAtteint && (
                <button
                  type="button"
                  onClick={() => { if (galleryInputRef.current) { galleryInputRef.current.value = ''; galleryInputRef.current.click(); } }}
                  className="flex-1 py-3.5 rounded-2xl border border-white/10 bg-[#1a1a2e]
                             text-gray-300 font-medium text-sm flex items-center justify-center gap-2
                             hover:bg-[#22223b] active:scale-95 transition-all duration-200"
                >
                  <span>🖼️</span> Galerie
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate('/aliments', { state: { categorie, date: repasDate, heure: repasHeure } })}
                className="flex-1 py-3.5 rounded-2xl border border-white/10 bg-[#1a1a2e]
                           text-gray-300 font-medium text-sm flex items-center justify-center gap-2
                           hover:bg-[#22223b] active:scale-95 transition-all duration-200"
              >
                <span>➕</span> Manuel
              </button>
            </div>
          </>
        )}

        {/* Loader pendant l'analyse */}
        {analysing && (
          <div className="flex flex-col items-center justify-center gap-4 py-12
                          bg-[#1a1a2e] rounded-3xl shadow-xl">
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Aperçu du repas"
                className="w-40 h-40 object-cover rounded-2xl opacity-60"
              />
            )}
            <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
            <p className="text-gray-300 font-medium text-sm">Analyse en cours…</p>
            <p className="text-gray-600 text-xs">Claude identifie les aliments</p>
          </div>
        )}

        {/* Erreur d'analyse */}
        {analyseError && !analysing && (
          <div className="bg-red-950/40 border border-red-800/50 rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-red-400 text-lg">⚠️</span>
              <span className="text-red-300 font-semibold text-sm">Analyse impossible</span>
            </div>
            <p className="text-red-400 text-sm">{analyseError}</p>
            <button
              onClick={handleCancel}
              className="self-start text-xs text-gray-400 underline underline-offset-2
                         hover:text-white transition-colors"
            >
              Réessayer
            </button>
          </div>
        )}

        {/* Résultat de l'analyse */}
        {analyseResult && !analysing && (
          <>
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Photo analysée"
                className="w-full max-h-56 object-cover rounded-2xl shadow-lg"
              />
            )}
            <AnalyseResult
              result={analyseResult}
              onConfirm={handleConfirm}
              onCancel={handleCancel}
            />
          </>
        )}

        {/* ── Journal du jour ───────────────────────────────────────────────── */}

        <div className="flex flex-col gap-3 mt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500">
              Repas du jour
            </h2>
            {meals.length > 0 && (
              <span className="text-xs font-bold text-violet-300 bg-violet-900/40
                               border border-violet-700/50 px-2.5 py-1 rounded-full">
                {totalJour.toLocaleString('fr-FR')} kcal
              </span>
            )}
          </div>

          {loadingMeals && (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
            </div>
          )}

          {!loadingMeals && meals.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <span className="text-5xl">🍽️</span>
              <p className="text-base font-semibold text-gray-300">Ajoute ton premier repas</p>
              <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
                Utilise la recherche manuelle pour enregistrer ce que tu manges et suivre tes calories.
              </p>
              <button
                onClick={() => navigate('/aliments', { state: { categorie, date: repasDate, heure: repasHeure } })}
                className="mt-1 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500
                           active:scale-95 text-white font-semibold text-sm
                           shadow-lg shadow-violet-900/40 transition-all duration-200 flex items-center gap-2"
              >
                <span>➕</span> Recherche manuelle
              </button>
            </div>
          )}

          {!loadingMeals && meals.map((meal) => (
            <MealCard
              key={meal.id}
              meal={meal}
              onDelete={handleDeleteMeal}
            />
          ))}
        </div>

        {/* Lien historique */}
        <button
          onClick={() => navigate('/historique')}
          className="w-full py-3 text-sm text-gray-500 flex items-center justify-center gap-2
                     hover:text-gray-300 transition-colors"
        >
          <span>📋</span> Voir l'historique complet
        </button>

      </div>
    </div>
    </>
  );
}
