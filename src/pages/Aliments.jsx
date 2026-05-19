// src/pages/Aliments.jsx
//
// US-20 : Recherche aliments Open Food Facts + saisie manuelle
// Accessible depuis /repas via le bouton "➕ Ajouter manuellement"
// Après enregistrement du repas, retour vers /repas

import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { syncedAddMeal } from '../lib/syncManager';
import ProteinSources from '../components/ProteinSources';
import DrinkSources from '../components/DrinkSources';

// ─── Constantes ──────────────────────────────────────────────────────────────

const OFF_SEARCH_URL = (query) =>
  `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10&fields=product_name,nutriments,serving_size,brands`;

const FETCH_TIMEOUT_MS = 5000;

/** Envoie une description textuelle à Claude Haiku pour estimer les calories et protéines */
async function estimerAlimentIA(description) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `Tu es un nutritionniste expert. Estime les calories et les protéines pour l'aliment ou la description suivante : "${description}".
Retourne UNIQUEMENT un objet JSON valide (sans markdown) :
{"calories": 180, "proteines": 14, "portion": "2 unités / 100g / etc.", "note": "estimation basée sur..."}
Si impossible à estimer, retourne : {"erreur": "raison courte"}`,
      }],
    }),
  });
  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`API ${response.status}: ${errBody}`);
  }
  const json = await response.json();
  const raw = json.content?.[0]?.text ?? '';
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Réponse inattendue');
  const parsed = JSON.parse(match[0]);
  if (parsed.erreur) throw new Error(parsed.erreur);
  return parsed; // { calories, proteines, portion, note }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function nowHHMM() {
  return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/** Extrait les kcal/100g depuis l'objet nutriments d'Open Food Facts */
function getKcalPer100g(nutriments) {
  return (
    nutriments?.['energy-kcal_100g'] ??
    nutriments?.['energy-kcal'] ??
    nutriments?.['energy_100g'] ??
    null
  );
}

/** Extrait les protéines/100g depuis l'objet nutriments d'Open Food Facts */
function getProtPer100g(nutriments) {
  return nutriments?.['proteins_100g'] ?? nutriments?.['proteins'] ?? null;
}

/** Fetch avec timeout via AbortController */
async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

/** Spinner centré */
function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
    </div>
  );
}

/** Formulaire de saisie de quantité pour un produit OFF sélectionné */
function QuantiteForm({ produit, onAjouter, onAnnuler }) {
  const [grammes, setGrammes] = useState('');
  const kcalPer100g = getKcalPer100g(produit.nutriments);
  const protPer100g = getProtPer100g(produit.nutriments);

  const calories =
    grammes && kcalPer100g !== null
      ? Math.round((kcalPer100g * Number(grammes)) / 100)
      : null;

  const proteines =
    grammes && protPer100g !== null
      ? Math.round((protPer100g * Number(grammes)) / 100)
      : null;

  function handleSubmit(e) {
    e.preventDefault();
    if (!grammes || Number(grammes) <= 0) return;
    onAjouter({
      nom: produit.product_name || 'Produit inconnu',
      calories: calories ?? 0,
      proteines: proteines ?? 0,
      portion: `${grammes} g`,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[#22223b] border border-violet-700/40 rounded-2xl p-4 mt-2 flex flex-col gap-3"
    >
      <div>
        <p className="text-sm font-semibold text-white truncate">
          {produit.product_name || 'Produit inconnu'}
        </p>
        {produit.brands && (
          <p className="text-xs text-gray-500">{produit.brands}</p>
        )}
        {kcalPer100g !== null && (
          <p className="text-xs text-violet-400 mt-0.5">
            {Math.round(kcalPer100g)} kcal / 100 g
            {protPer100g !== null && (
              <span className="text-cyan-400 ml-2">· {Math.round(protPer100g)} g prot / 100 g</span>
            )}
          </p>
        )}
        {kcalPer100g === null && (
          <p className="text-xs text-amber-500 mt-0.5">
            Valeur énergétique non disponible — saisie en kcal directe
          </p>
        )}
      </div>

      {kcalPer100g !== null ? (
        <>
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-400 whitespace-nowrap">Quantité (g)</label>
            <input
              type="number"
              min="1"
              max="9999"
              value={grammes}
              onChange={(e) => setGrammes(e.target.value)}
              placeholder="ex. 150"
              className="flex-1 bg-[#0f0f1a] border border-white/10 rounded-xl px-3 py-2
                         text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
              autoFocus
            />
          </div>
          {calories !== null && (
            <div className="flex items-center justify-center gap-3">
              <p className="text-sm font-bold text-emerald-400">≈ {calories} kcal</p>
              {proteines !== null && (
                <p className="text-sm font-bold text-cyan-400">· {proteines} g prot</p>
              )}
            </div>
          )}
        </>
      ) : (
        /* Fallback : saisie directe des kcal quand la valeur nutritive est absente */
        <ManualKcalInput
          nom={produit.product_name || 'Produit inconnu'}
          marque={produit.brands}
          onAjouter={onAjouter}
          onAnnuler={onAnnuler}
          inline
        />
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onAnnuler}
          className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm
                     hover:bg-white/5 active:scale-95 transition-all duration-200"
        >
          Annuler
        </button>
        {kcalPer100g !== null && (
          <button
            type="submit"
            disabled={!grammes || Number(grammes) <= 0}
            className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold
                       disabled:opacity-40 hover:bg-violet-500 active:scale-95 transition-all duration-200"
          >
            Ajouter à mon repas
          </button>
        )}
      </div>
    </form>
  );
}

/** Formulaire de saisie libre avec estimation IA */
function ManualKcalInput({ nom: nomInitial = '', onAjouter, onAnnuler, inline = false }) {
  const [nom, setNom] = useState(nomInitial);
  const [kcal, setKcal] = useState('');
  const [proteines, setProteines] = useState('');
  const [portion, setPortion] = useState('');
  const [estimating, setEstimating] = useState(false);
  const [iaNote, setIaNote] = useState('');
  const [iaError, setIaError] = useState('');

  async function handleEstimer() {
    if (!nom.trim()) return;
    setEstimating(true);
    setIaError('');
    setIaNote('');
    try {
      const result = await estimerAlimentIA(nom.trim());
      setKcal(String(result.calories));
      if (result.proteines != null) setProteines(String(result.proteines));
      if (result.portion) setPortion(result.portion);
      if (result.note) setIaNote(result.note);
    } catch (err) {
      setIaError(err.message ?? 'Estimation impossible');
    } finally {
      setEstimating(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!nom.trim() || !kcal || Number(kcal) <= 0) return;
    onAjouter({
      nom: nom.trim(),
      calories: Math.round(Number(kcal)),
      proteines: Number(proteines) || 0,
      portion: portion || 'saisie manuelle',
    });
    setNom(''); setKcal(''); setProteines(''); setPortion(''); setIaNote(''); setIaError('');
  }

  const inputCls = 'bg-[#0f0f1a] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors';

  if (inline) {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400 whitespace-nowrap w-24">Calories (kcal)</label>
          <input type="number" min="1" value={kcal} onChange={e => setKcal(e.target.value)}
            placeholder="ex. 250" className="flex-1 bg-[#0f0f1a] border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors" autoFocus />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400 whitespace-nowrap w-24">Protéines (g)</label>
          <input type="number" min="0" step="0.1" inputMode="decimal" value={proteines} onChange={e => setProteines(e.target.value)}
            placeholder="ex. 12.5" className="flex-1 bg-[#0f0f1a] border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500 transition-colors" />
        </div>
        <button type="submit" disabled={!kcal || Number(kcal) <= 0}
          className="py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold disabled:opacity-40 hover:bg-violet-500 active:scale-95 transition-all duration-200">
          Ajouter à mon repas
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
        Saisie manuelle
      </p>

      {/* Nom + bouton IA */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-gray-400">Décris l'aliment</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={nom}
            onChange={e => { setNom(e.target.value); setIaNote(''); setIaError(''); }}
            placeholder="ex. 2 oeufs au plat, 1 banane…"
            className={`flex-1 ${inputCls}`}
          />
          <button
            type="button"
            onClick={handleEstimer}
            disabled={!nom.trim() || estimating}
            className="flex-shrink-0 px-3 py-2 rounded-xl bg-violet-900/50 border border-violet-600/50
                       text-violet-300 text-xs font-semibold
                       disabled:opacity-40 hover:bg-violet-800/50 active:scale-95 transition-all duration-200
                       flex items-center gap-1.5"
          >
            {estimating
              ? <div className="w-3 h-3 rounded-full border border-violet-300 border-t-transparent animate-spin" />
              : <span>✨</span>}
            {estimating ? 'Calcul…' : 'IA'}
          </button>
        </div>
        {iaNote && <p className="text-xs text-violet-400 italic">{iaNote}</p>}
        {iaError && <p className="text-xs text-red-400">{iaError}</p>}
      </div>

      {/* Calories — auto-rempli par l'IA, éditable */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-gray-400">
          Calories (kcal){kcal && portion ? <span className="text-gray-600"> — {portion}</span> : ''}
        </label>
        <input
          type="number"
          min="1"
          value={kcal}
          onChange={e => setKcal(e.target.value)}
          placeholder="ex. 350  (ou laisse l'IA calculer ↑)"
          className={inputCls}
        />
      </div>

      {/* Protéines — auto-rempli par l'IA, éditable, optionnel */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-cyan-400/70">Protéines (g) — optionnel</label>
        <input
          type="number"
          min="0"
          value={proteines}
          onChange={e => setProteines(e.target.value)}
          placeholder="ex. 12  (ou laisse l'IA calculer ↑)"
          className="bg-[#0f0f1a] border border-cyan-900/40 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500 transition-colors"
        />
      </div>

      <div className="flex gap-2 mt-1">
        {onAnnuler && (
          <button type="button" onClick={onAnnuler}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm hover:bg-white/5 active:scale-95 transition-all duration-200">
            Annuler
          </button>
        )}
        <button type="submit" disabled={!nom.trim() || !kcal || Number(kcal) <= 0}
          className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold disabled:opacity-40 hover:bg-violet-500 active:scale-95 transition-all duration-200">
          Ajouter au panier
        </button>
      </div>
    </form>
  );
}

/** Card d'un résultat de recherche OFF */
function ResultCard({ produit, onSelect, selected }) {
  const kcal = getKcalPer100g(produit.nutriments);
  return (
    <button
      onClick={() => onSelect(produit)}
      className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 active:scale-98
                  ${selected
                    ? 'bg-violet-900/40 border-violet-600'
                    : 'bg-[#1a1a2e] border-white/10 hover:border-violet-600/50'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {produit.product_name || <span className="text-gray-500 italic">Nom inconnu</span>}
          </p>
          {produit.brands && (
            <p className="text-xs text-gray-500 truncate mt-0.5">{produit.brands}</p>
          )}
        </div>
        {kcal !== null && (
          <span className="flex-shrink-0 text-xs font-bold text-violet-300 bg-violet-900/50
                           border border-violet-700/40 px-2 py-1 rounded-full whitespace-nowrap">
            {Math.round(kcal)} kcal/100g
          </span>
        )}
        {kcal === null && (
          <span className="flex-shrink-0 text-xs text-gray-600 italic">kcal n/d</span>
        )}
      </div>
    </button>
  );
}

/** Item du panier en bas de page */
function PanierItem({ item, onRetirer }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-gray-300 truncate flex-1">{item.nom}</span>
      <span className="text-xs text-violet-300 flex-shrink-0">{item.calories} kcal</span>
      <button
        onClick={onRetirer}
        className="w-5 h-5 flex items-center justify-center rounded-full bg-red-900/40
                   text-red-400 hover:bg-red-500/30 transition-colors flex-shrink-0"
        title="Retirer du panier"
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function Aliments() {
  const navigate = useNavigate();

  // Recherche
  const [query, setQuery] = useState('');
  const [resultats, setResultats] = useState(null);   // null = pas encore cherché
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [networkFallback, setNetworkFallback] = useState(false);

  // Produit sélectionné (affiche le formulaire de quantité)
  const [produitSelectionne, setProduitSelectionne] = useState(null);

  // Panier d'aliments à enregistrer
  const [panier, setPanier] = useState([]);

  // Enregistrement en cours
  const [saving, setSaving] = useState(false);

  // Accordéon panier
  const [panierOuvert, setPanierOuvert] = useState(false);

  const inputRef = useRef(null);

  // ── Recherche OFF ───────────────────────────────────────────────────────────

  const lancerRecherche = useCallback(async (q) => {
    if (!q.trim()) return;
    setSearching(true);
    setSearchError(null);
    setNetworkFallback(false);
    setProduitSelectionne(null);
    setResultats(null);

    try {
      const res = await fetchWithTimeout(OFF_SEARCH_URL(q.trim()), FETCH_TIMEOUT_MS);
      if (!res.ok) throw new Error(`Erreur réseau (${res.status})`);
      const json = await res.json();
      const produits = (json.products ?? []).filter(
        (p) => p.product_name && p.product_name.trim() !== ''
      );
      setResultats(produits);
      if (produits.length === 0) {
        setNetworkFallback(false); // on a eu une réponse, juste vide
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setSearchError('La recherche a expiré (timeout 5 s). Vérifiez votre connexion.');
      } else {
        setSearchError('Impossible de contacter Open Food Facts.');
      }
      setNetworkFallback(true);
      setResultats([]);
    } finally {
      setSearching(false);
    }
  }, []);

  function handleSearchSubmit(e) {
    e.preventDefault();
    lancerRecherche(query);
  }

  // ── Gestion du panier ───────────────────────────────────────────────────────

  function ajouterAuPanier(aliment) {
    setPanier((prev) => [...prev, aliment]);
    setProduitSelectionne(null);
    setPanierOuvert(true);
  }

  function retirerDuPanier(index) {
    setPanier((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Enregistrement du repas ─────────────────────────────────────────────────

  async function enregistrerRepas() {
    if (panier.length === 0) return;
    setSaving(true);
    try {
      const totalCalories = panier.reduce((sum, a) => sum + a.calories, 0);
      const totalProteines = panier.reduce((s, a) => s + (a.proteines ?? 0), 0);
      await syncedAddMeal({
        date: todayISO(),
        heure: nowHHMM(),
        aliments: panier,
        totalCalories,
        totalProteines,
        categorie: 'saisie-manuelle',
        fiabilite: 'haute',
        note: '',
      });
      navigate('/repas');
    } catch {
      setSaving(false);
    }
  }

  const totalPanier = panier.reduce((sum, a) => sum + a.calories, 0);

  // ── Rendu ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen bg-[#0f0f1a]" style={{ paddingBottom: panier.length > 0 ? '180px' : '90px' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-[#0f0f1a]/95 backdrop-blur px-5 pt-12 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate('/repas')}
            className="w-9 h-9 flex items-center justify-center rounded-full
                       bg-[#1a1a2e] border border-white/10 text-gray-400
                       hover:text-white active:scale-90 transition-all duration-200"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-white">Ajouter des aliments</h1>
        </div>

        {/* Barre de recherche */}
        <form onSubmit={handleSearchSubmit} className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un aliment… (ex. yaourt, banane)"
            className="w-full bg-[#1a1a2e] border border-white/10 rounded-2xl
                       pl-11 pr-24 py-3.5 text-white text-sm
                       focus:outline-none focus:border-violet-500 transition-colors
                       placeholder:text-gray-600"
          />
          <button
            type="submit"
            disabled={!query.trim() || searching}
            className="absolute right-2 top-1/2 -translate-y-1/2
                       bg-violet-600 text-white text-xs font-semibold
                       px-3 py-1.5 rounded-xl
                       disabled:opacity-40 hover:bg-violet-500 active:scale-95 transition-all duration-200"
          >
            Chercher
          </button>
        </form>
      </div>

      {/* ── Contenu ─────────────────────────────────────────────────────────── */}
      <div className="px-5 flex flex-col gap-4">

        {/* Spinner */}
        {searching && <Spinner />}

        {/* Erreur réseau */}
        {searchError && !searching && (
          <div className="bg-amber-950/40 border border-amber-700/50 rounded-2xl p-4 flex items-start gap-3">
            <span className="text-amber-400 text-lg flex-shrink-0">⚠️</span>
            <p className="text-amber-300 text-sm">{searchError}</p>
          </div>
        )}

        {/* Résultats */}
        {!searching && resultats !== null && resultats.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest">
              {resultats.length} résultat{resultats.length > 1 ? 's' : ''}
            </p>
            {resultats.map((produit, i) => (
              <div key={i}>
                <ResultCard
                  produit={produit}
                  onSelect={setProduitSelectionne}
                  selected={produitSelectionne === produit}
                />
                {produitSelectionne === produit && (
                  <QuantiteForm
                    produit={produit}
                    onAjouter={ajouterAuPanier}
                    onAnnuler={() => setProduitSelectionne(null)}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Aucun résultat (recherche effectuée, pas d'erreur réseau) */}
        {!searching && resultats !== null && resultats.length === 0 && !networkFallback && (
          <div className="flex flex-col items-center gap-2 py-6 text-gray-600">
            <span className="text-4xl">🔍</span>
            <p className="text-sm text-center">
              Aucun résultat pour <strong className="text-gray-400">"{query}"</strong>
            </p>
          </div>
        )}

        {/* Sources de protéines pré-configurées */}
        {!searching && <ProteinSources onAjouter={ajouterAuPanier} />}
        {!searching && <DrinkSources onAjouter={ajouterAuPanier} />}

        {/* Bloc saisie libre — affiché si : aucun résultat OU erreur réseau OU jamais cherché */}
        {!searching && (networkFallback || (resultats !== null && resultats.length === 0) || resultats === null) && (
          <div className="flex flex-col gap-2">
            {resultats !== null && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs text-gray-600 px-2">ou saisie libre</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
            )}
            {resultats === null && (
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest">
                Saisie manuelle
              </p>
            )}
            <ManualKcalInput onAjouter={ajouterAuPanier} />
          </div>
        )}

      </div>

      {/* ── Panier flottant ─────────────────────────────────────────────────── */}
      {panier.length > 0 && (
        <div className="fixed bottom-[72px] left-1/2 -translate-x-1/2 w-full max-w-[480px] px-4 z-40">
          <div className="bg-[#1a1a2e] border border-violet-700/60 rounded-2xl shadow-2xl shadow-violet-900/40">

            {/* En-tête du panier — cliquable pour déplier/replier */}
            <button
              onClick={() => setPanierOuvert((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-2xl"
            >
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 flex items-center justify-center rounded-full
                                 bg-violet-600 text-white text-xs font-bold">
                  {panier.length}
                </span>
                <span className="text-sm font-semibold text-white">
                  {panier.length} aliment{panier.length > 1 ? 's' : ''} — {totalPanier} kcal
                </span>
              </div>
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${panierOuvert ? 'rotate-180' : ''}`}
                viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </button>

            {/* Liste des items du panier */}
            {panierOuvert && (
              <div className="px-4 pb-2 flex flex-col gap-2 max-h-40 overflow-y-auto">
                {panier.map((item, i) => (
                  <PanierItem key={i} item={item} onRetirer={() => retirerDuPanier(i)} />
                ))}
              </div>
            )}

            {/* Bouton enregistrer */}
            <div className="px-4 pb-4 pt-1">
              <button
                onClick={enregistrerRepas}
                disabled={saving}
                className="w-full py-3 rounded-xl
                           bg-gradient-to-r from-violet-600 to-indigo-600
                           text-white font-semibold text-sm
                           disabled:opacity-60 hover:opacity-90 active:scale-95 transition-all duration-200
                           flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Enregistrement…
                  </>
                ) : (
                  <>
                    ✅ Enregistrer le repas ({panier.length} aliment{panier.length > 1 ? 's' : ''} — {totalPanier} kcal)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
