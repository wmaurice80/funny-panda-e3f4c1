// src/pages/Activites.jsx
/**
 * Page /activites — Sprint 3 (US-10, US-11, US-12)
 *
 * NOTE — Intégration Garmin Connect (US-11) :
 * L'API officielle Garmin Health API nécessite une approbation Garmin (délai de plusieurs semaines)
 * et un backend OAuth2 dédié. Cette page implémente donc une solution MVP pratique en deux niveaux :
 *   - Import rapide : l'utilisateur colle le nom + calories depuis Garmin Connect → pré-remplit le formulaire.
 *   - Deep link : bouton qui ouvre Garmin Connect (web ou app mobile) pour récupérer les données manuellement.
 * Un vrai OAuth Garmin pourra être ajouté au Sprint 4 une fois l'approbation obtenue.
 */

import { useState, useEffect, useCallback } from 'react';
import { getActivitiesForDate } from '../db';
import { syncedAddActivity, syncedDeleteActivity } from '../lib/syncManager';
import { SPORT_TYPES } from '../utils/sports';
import ActivityCard from '../components/ActivityCard';

/** Formate la date courante en 'YYYY-MM-DD' */
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Formate l'heure courante en 'HH:MM' */
function currentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

const EMPTY_FORM = {
  type: 'course',
  dureeHeures: '',
  dureeMinutes: '',
  caloriesBrulees: '',
  date: todayISO(),
  heure: currentTime(),
  note: '',
};

export default function Activites() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [formOpen, setFormOpen] = useState(true);
  const [garminOpen, setGarminOpen] = useState(false);
  const [garminInput, setGarminInput] = useState('');
  const [activities, setActivities] = useState([]);
  const [saving, setSaving] = useState(false);

  // Charge les activités du jour
  const loadActivities = useCallback(async () => {
    const list = await getActivitiesForDate(todayISO());
    // Tri anti-chronologique (les plus récentes en premier)
    list.sort((a, b) => b.createdAt - a.createdAt);
    setActivities(list);
  }, []);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  // Recharger quand la fenêtre reprend le focus (retour depuis une autre page)
  useEffect(() => {
    window.addEventListener('focus', loadActivities);
    return () => window.removeEventListener('focus', loadActivities);
  }, [loadActivities]);

  /* ── Validation ────────────────────────────────────────────────────────── */
  function validate() {
    const e = {};
    if (!form.type) e.type = 'Choisissez un type';

    const heures = Number(form.dureeHeures) || 0;
    const minutes = Number(form.dureeMinutes) || 0;
    const totalMinutes = heures * 60 + minutes;

    if (totalMinutes <= 0) {
      e.duree = 'Durée invalide (ex : 1h 30min)';
    }

    if (!form.caloriesBrulees || isNaN(Number(form.caloriesBrulees)) || Number(form.caloriesBrulees) < 0)
      e.caloriesBrulees = 'Calories invalides (ex : 250)';
    if (!form.date) e.date = 'Date requise';
    return e;
  }

  /* ── Soumission du formulaire ──────────────────────────────────────────── */
  async function handleSubmit(e) {
    e.preventDefault();
    const e2 = validate();
    if (Object.keys(e2).length > 0) { setErrors(e2); return; }
    setErrors({});
    setSaving(true);
    try {
      const heures = Number(form.dureeHeures) || 0;
      const minutes = Number(form.dureeMinutes) || 0;
      const totalMinutes = heures * 60 + minutes;

      await syncedAddActivity({
        type:            form.type,
        duree:           totalMinutes,
        caloriesBrulees: Number(form.caloriesBrulees),
        date:            form.date,
        heure:           form.heure,
        note:            form.note.trim(),
      });
      setForm({ ...EMPTY_FORM, date: form.date, heure: currentTime() });
      setGarminInput('');
      await loadActivities();
    } finally {
      setSaving(false);
    }
  }

  /* ── Suppression ───────────────────────────────────────────────────────── */
  async function handleDelete(id) {
    await syncedDeleteActivity(id);
    await loadActivities();
  }

  /* ── Import rapide Garmin ──────────────────────────────────────────────── */
  /**
   * L'utilisateur colle un texte du style : "Course à pied – 350 kcal"
   * ou "Vélo 45 min 280 kcal". On essaie de détecter le type et les calories.
   */
  function parseGarminInput(raw) {
    const text = raw.toLowerCase();
    let detectedType = 'autre';
    const typeMap = {
      course: ['course', 'running', 'run'],
      velo: ['vélo', 'velo', 'cyclisme', 'cycling', 'bike'],
      natation: ['natation', 'nage', 'swimming'],
      marche: ['marche', 'walking', 'walk'],
      musculation: ['musculation', 'strength', 'poids'],
      hiit: ['hiit', 'interval'],
      yoga: ['yoga', 'pilates'],
    };
    for (const [key, keywords] of Object.entries(typeMap)) {
      if (keywords.some((kw) => text.includes(kw))) {
        detectedType = key;
        break;
      }
    }
    // Cherche un nombre suivi (ou précédé) de "kcal" ou "cal"
    const calMatch = raw.match(/(\d+)\s*(?:kcal|cal)/i);
    const calories = calMatch ? calMatch[1] : '';
    // Cherche un nombre suivi de "min" ou "h"
    const durMatchMin = raw.match(/(\d+)\s*min/i);
    const durMatchHeure = raw.match(/(\d+)\s*h/i);
    const minutes = durMatchMin ? durMatchMin[1] : '';
    const heures = durMatchHeure ? durMatchHeure[1] : '';

    setForm((prev) => ({
      ...prev,
      type:            detectedType,
      caloriesBrulees: calories || prev.caloriesBrulees,
      dureeMinutes:    minutes  || prev.dureeMinutes,
      dureeHeures:     heures   || prev.dureeHeures,
    }));
  }

  /* ── Helpers UI ────────────────────────────────────────────────────────── */
  function field(label, children, error) {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-widest text-gray-500">{label}</label>
        {children}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  const inputCls =
    'w-full rounded-xl bg-[#22223b] border border-white/10 px-4 py-3 text-sm text-white ' +
    'placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors';

  const totalSportCalories = activities.reduce((s, a) => s + (a.caloriesBrulees ?? 0), 0);

  return (
    <div className="flex flex-col min-h-screen bg-[#0f0f1a] pb-36">

      {/* Header */}
      <div className="px-5 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-white">Activités sportives</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>


      <div className="px-5 flex flex-col gap-4">

        {/* ── Section formulaire (dépliable) ─────────────────────────────── */}
        <div className="bg-[#1a1a2e] rounded-2xl shadow-xl overflow-hidden">
          <button
            onClick={() => setFormOpen((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-4
                       text-white font-semibold text-sm hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span>➕</span>
              <span>Ajouter une session sport</span>
            </div>
            <svg
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${formOpen ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {formOpen && (
            <form onSubmit={handleSubmit} className="px-5 pb-5 flex flex-col gap-4 border-t border-white/10">

              {/* Import rapide Garmin dans le formulaire */}
              <div className="mt-4">
                <label className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5 block">
                  Import rapide Garmin (optionnel)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={garminInput}
                    onChange={(e) => setGarminInput(e.target.value)}
                    placeholder='ex : "Course à pied 45 min 380 kcal"'
                    className={inputCls + ' flex-1'}
                  />
                  <button
                    type="button"
                    onClick={() => parseGarminInput(garminInput)}
                    disabled={!garminInput.trim()}
                    className="px-3 py-2 rounded-xl bg-orange-600/20 border border-orange-500/30
                               text-orange-400 text-xs font-semibold hover:bg-orange-600/35
                               disabled:opacity-40 transition-colors whitespace-nowrap"
                  >
                    Pré-remplir
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Collez le récapitulatif copié depuis Garmin Connect pour pré-remplir le formulaire.
                </p>
              </div>

              {/* Type d'activité */}
              {field('Type d\'activité', (
                <select
                  value={form.type}
                  onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                  className={inputCls}
                >
                  {Object.entries(SPORT_TYPES).map(([key, { label, emoji }]) => (
                    <option key={key} value={key}>{emoji} {label}</option>
                  ))}
                </select>
              ), errors.type)}

              {/* Durée (heures + minutes) + Calories */}
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5 block">
                    Durée
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number" min="0" inputMode="numeric"
                      value={form.dureeHeures}
                      onChange={(e) => setForm((p) => ({ ...p, dureeHeures: e.target.value }))}
                      placeholder="0"
                      className={inputCls + ' text-center'}
                    />
                    <input
                      type="number" min="0" max="59" inputMode="numeric"
                      value={form.dureeMinutes}
                      onChange={(e) => setForm((p) => ({ ...p, dureeMinutes: e.target.value }))}
                      placeholder="30"
                      className={inputCls + ' text-center'}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <p className="text-xs text-gray-600 text-center">heures</p>
                    <p className="text-xs text-gray-600 text-center">minutes</p>
                  </div>
                  {errors.duree && <p className="text-xs text-red-400 mt-1.5">{errors.duree}</p>}
                </div>

                {field('Calories brûlées', (
                  <input
                    type="number" min="0" inputMode="numeric"
                    value={form.caloriesBrulees}
                    onChange={(e) => setForm((p) => ({ ...p, caloriesBrulees: e.target.value }))}
                    placeholder="350"
                    className={inputCls}
                  />
                ), errors.caloriesBrulees)}
              </div>

              {/* Date + Heure côte à côte */}
              <div className="grid grid-cols-2 gap-3">
                {field('Date', (
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                    className={inputCls}
                  />
                ), errors.date)}

                {field('Heure', (
                  <input
                    type="time"
                    value={form.heure}
                    onChange={(e) => setForm((p) => ({ ...p, heure: e.target.value }))}
                    className={inputCls}
                  />
                ), null)}
              </div>

              {/* Note optionnelle */}
              {field('Note (optionnel)', (
                <input
                  type="text"
                  value={form.note}
                  onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                  placeholder="Sortie matinale, cardio…"
                  className={inputCls}
                />
              ), null)}

              {/* Bouton enregistrer */}
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3.5 rounded-2xl font-semibold text-sm
                           bg-gradient-to-r from-orange-600 to-amber-500
                           text-white shadow-lg hover:opacity-90 active:scale-95
                           disabled:opacity-50 transition-all duration-200 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                ) : (
                  <span>💾</span>
                )}
                {saving ? 'Enregistrement…' : 'Enregistrer la session'}
              </button>
            </form>
          )}
        </div>

        {/* ── Section Import Garmin (dépliable — intégration OAuth en attente) ── */}
        <div className="bg-[#1a1a2e] rounded-2xl shadow-xl overflow-hidden">
          <button
            onClick={() => setGarminOpen((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-4
                       text-white font-semibold text-sm hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span>🏃‍♂️</span>
              <span>Importer depuis Garmin Connect</span>
              <span className="text-[10px] font-medium bg-amber-500/15 text-amber-400
                               border border-amber-500/30 px-2 py-0.5 rounded-full">
                À venir
              </span>
            </div>
            <svg
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${garminOpen ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {garminOpen && (
            <div className="px-5 pb-5 border-t border-white/10">
              <p className="text-xs text-gray-500 mt-4 mb-3">
                L'intégration OAuth Garmin est en attente d'approbation. En attendant, tu peux
                copier manuellement les données depuis Garmin Connect.
              </p>
              <ol className="flex flex-col gap-2 mb-4">
                {[
                  'Ouvrez Garmin Connect sur mobile ou web',
                  'Sélectionnez l\'activité souhaitée',
                  'Notez le nom de l\'activité et les calories brûlées',
                  'Collez ces infos dans le champ "Import rapide" du formulaire ci-dessus',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-orange-500/15 text-orange-400
                                     flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-xs text-gray-400">{step}</span>
                  </li>
                ))}
              </ol>
              <a
                href="https://connect.garmin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl
                           bg-[#22223b] border border-white/10 text-sm font-medium text-gray-300
                           hover:bg-[#2a2a40] active:scale-95 transition-all duration-150"
              >
                <span>🌐</span>
                Ouvrir Garmin Connect
              </a>
            </div>
          )}
        </div>

        {/* ── Activités du jour ───────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500">
              Activités du jour
            </h2>
            {totalSportCalories > 0 && (
              <span className="text-xs font-bold text-orange-400">
                -{totalSportCalories} kcal total
              </span>
            )}
          </div>

          {activities.length === 0 ? (
            <div className="bg-[#1a1a2e] rounded-2xl p-6 flex flex-col items-center gap-2 text-center">
              <span className="text-3xl">🏅</span>
              <p className="text-sm text-gray-500">Aucune activité enregistrée aujourd'hui</p>
              <p className="text-xs text-gray-700">Ajoutez votre première session ci-dessus</p>
            </div>
          ) : (
            activities.map((a) => (
              <ActivityCard key={a.id} activity={a} onDelete={handleDelete} />
            ))
          )}
        </div>

      </div>
    </div>
  );
}
