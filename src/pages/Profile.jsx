// src/pages/Profile.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProfile } from '../db';
import { syncedSaveProfile } from '../lib/syncManager';
import { ACTIVITY_LABELS, calculateProteinGoal } from '../utils/bmr';
import { useAuth } from '../lib/AuthContext';

const INITIAL = {
  prenom: '',
  poids: '',
  taille: '',
  age: '',
  sexe: 'homme',
  niveauActivite: 'modere',
  objectif: 'maintien',
  vitesseObjectif: 'moderee',
  tdeeMesure: '',
  tdeeSport: '',
  masseGrasse: '',
};

const OBJECTIF_OPTIONS = [
  { key: 'perte', label: '🔻 Perdre du poids' },
  { key: 'maintien', label: '⚖️ Maintien' },
  { key: 'prise', label: '💪 Prendre de la masse' },
];

const VITESSE_OPTIONS = [
  { key: 'lente', label: 'Lente' },
  { key: 'moderee', label: 'Modérée' },
  { key: 'rapide', label: 'Rapide' },
];

const ACTIVITY_KEYS = Object.keys(ACTIVITY_LABELS);

/** Description succincte de chaque niveau d'activité (US-24) */
const ACTIVITY_DESCRIPTIONS = {
  sedentaire: 'Bureau toute la journée, peu ou pas de sport (ex. télétravail sédentaire)',
  leger: '1 à 3 séances sport légères/semaine ou marche quotidienne',
  modere: '3 à 5 séances sport/semaine (ex. salle de sport régulière)',
  actif: 'Sport intense 6-7j/semaine ou travail physique (ex. maçon, sportif amateur)',
  extreme: 'Athlète professionnel ou travail physique très intense quotidien',
};

function Field({ label, error, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-300">{label}</label>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

const inputClass =
  'w-full bg-[#22223b] border border-white/10 rounded-xl px-4 py-3 text-white ' +
  'placeholder-gray-600 focus:outline-none focus:border-violet-500 focus:ring-1 ' +
  'focus:ring-violet-500 transition-colors text-base';

export default function Profile() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [form, setForm] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [isEdit, setIsEdit] = useState(false);

  useEffect(() => {
    getProfile().then((profile) => {
      if (profile) {
        setIsEdit(true);
        setForm({
          prenom: profile.prenom ?? '',
          poids: String(profile.poids ?? ''),
          taille: String(profile.taille ?? ''),
          age: String(profile.age ?? ''),
          sexe: profile.sexe ?? 'homme',
          niveauActivite: profile.niveauActivite ?? 'modere',
          objectif: profile.objectif ?? 'maintien',
          vitesseObjectif: profile.vitesseObjectif ?? 'moderee',
          tdeeMesure: profile.tdeeMesure ? String(profile.tdeeMesure) : '',
          tdeeSport: profile.tdeeSport ? String(profile.tdeeSport) : '',
          masseGrasse: profile.masseGrasse ? String(profile.masseGrasse) : '',
        });
      }
    });
  }, []);

  function validate() {
    const e = {};
    if (!form.prenom.trim()) e.prenom = 'Le prénom est requis.';
    const poids = Number(form.poids);
    if (!form.poids || isNaN(poids) || poids < 20 || poids > 300)
      e.poids = 'Poids invalide (20 – 300 kg).';
    const taille = Number(form.taille);
    if (!form.taille || isNaN(taille) || taille < 50 || taille > 250)
      e.taille = 'Taille invalide (50 – 250 cm).';
    const age = Number(form.age);
    if (!form.age || isNaN(age) || age < 10 || age > 120)
      e.age = 'Âge invalide (10 – 120 ans).';
    if (!['homme', 'femme'].includes(form.sexe)) e.sexe = 'Sexe invalide.';
    if (!ACTIVITY_KEYS.includes(form.niveauActivite))
      e.niveauActivite = 'Niveau d\'activité invalide.';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const e2 = validate();
    if (Object.keys(e2).length) { setErrors(e2); return; }
    setSaving(true);
    await syncedSaveProfile({
      prenom: form.prenom.trim(),
      poids: Number(form.poids),
      taille: Number(form.taille),
      age: Number(form.age),
      sexe: form.sexe,
      niveauActivite: form.niveauActivite,
      objectif: form.objectif,
      vitesseObjectif: form.vitesseObjectif,
      tdeeMesure: form.tdeeMesure ? Number(form.tdeeMesure) : 0,
      tdeeSport: form.tdeeSport ? Number(form.tdeeSport) : 0,
      masseGrasse: form.masseGrasse ? Number(form.masseGrasse) : 0,
    });
    setSaving(false);
    navigate('/');
  }

  function set(key) {
    return (e) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
      setErrors((er) => ({ ...er, [key]: undefined }));
    };
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0f0f1a] pb-12">
      {/* Header */}
      <div className="px-5 pt-12 pb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isEdit ? 'Mon profil' : 'Créer mon profil'}
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Ces informations permettent de calculer vos besoins caloriques.
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <button
            type="button"
            onClick={signOut}
            className="w-9 h-9 flex items-center justify-center rounded-xl
                       bg-[#1a1a2e] border border-white/10 text-gray-400
                       hover:text-red-400 hover:border-red-800/50 active:scale-90 transition-all duration-200"
            title="Se déconnecter"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
          <button
            form="profile-form"
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500
                       active:scale-95 text-white font-semibold text-sm shadow-lg
                       shadow-violet-900/50 transition-all duration-200 disabled:opacity-60 flex-shrink-0"
          >
          {saving ? '…' : 'Enregistrer'}
          </button>
        </div>
      </div>

      <form id="profile-form" onSubmit={handleSubmit} className="px-5 flex flex-col gap-5 animate-fade-in-up pb-8">
        {/* Prénom */}
        <Field label="Prénom" error={errors.prenom}>
          <input
            className={inputClass}
            type="text"
            placeholder="ex. Marie"
            value={form.prenom}
            onChange={set('prenom')}
            autoComplete="given-name"
          />
        </Field>

        {/* Poids + Taille sur une ligne */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Poids (kg)" error={errors.poids}>
            <input
              className={inputClass}
              type="number"
              inputMode="decimal"
              placeholder="70"
              min="20"
              max="300"
              value={form.poids}
              onChange={set('poids')}
            />
          </Field>
          <Field label="Taille (cm)" error={errors.taille}>
            <input
              className={inputClass}
              type="number"
              inputMode="decimal"
              placeholder="170"
              min="50"
              max="250"
              value={form.taille}
              onChange={set('taille')}
            />
          </Field>
        </div>

        {/* % Masse grasse (optionnel) */}
        <div className="bg-[#0d1117] border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
          <div>
            <p className="text-xs font-semibold text-gray-400">% Masse grasse (optionnel)</p>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">
              Permet de calculer l'objectif protéines sur la masse maigre (LBM) — plus précis.
            </p>
          </div>
          <input
            className={inputClass}
            type="number"
            inputMode="decimal"
            placeholder="ex. 25"
            min="5"
            max="60"
            step="0.5"
            value={form.masseGrasse}
            onChange={set('masseGrasse')}
          />
          {form.masseGrasse && Number(form.masseGrasse) > 0 && Number(form.masseGrasse) < 60 && form.poids && Number(form.poids) >= 20 ? (() => {
            const lbm = (Number(form.poids) * (1 - Number(form.masseGrasse) / 100)).toFixed(1);
            const goal = Math.round(Number(lbm) * 2.3);
            return (
              <p className="text-xs font-semibold text-cyan-400">
                💪 LBM estimée : {lbm} kg — Objectif protéines : {goal} g/j
              </p>
            );
          })() : (
            <p className="text-xs text-gray-600">Si renseigné, améliore la précision de l'objectif protéines</p>
          )}
        </div>

        {/* Âge */}
        <Field label="Âge" error={errors.age}>
          <input
            className={inputClass}
            type="number"
            inputMode="numeric"
            placeholder="30"
            min="10"
            max="120"
            value={form.age}
            onChange={set('age')}
          />
        </Field>

        {/* Sexe */}
        <Field label="Sexe" error={errors.sexe}>
          <div className="grid grid-cols-2 gap-3">
            {['homme', 'femme'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => { setForm((f) => ({ ...f, sexe: s })); setErrors((er) => ({ ...er, sexe: undefined })); }}
                className={`py-3 rounded-xl font-medium text-sm transition-all duration-200
                  ${form.sexe === s
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/40'
                    : 'bg-[#22223b] text-gray-400 border border-white/10'}`}
              >
                {s === 'homme' ? '♂ Homme' : '♀ Femme'}
              </button>
            ))}
          </div>
        </Field>

        {/* Niveau d'activité */}
        <Field label="Niveau d'activité" error={errors.niveauActivite}>
          <div className="flex flex-col gap-2">
            {ACTIVITY_KEYS.map((key) => (
              <div key={key} className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => { setForm((f) => ({ ...f, niveauActivite: key })); setErrors((er) => ({ ...er, niveauActivite: undefined })); }}
                  className={`w-full py-3 px-4 rounded-xl text-left text-sm font-medium transition-all duration-200
                    ${form.niveauActivite === key
                      ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/40'
                      : 'bg-[#22223b] text-gray-400 border border-white/10'}`}
                >
                  {ACTIVITY_LABELS[key]}
                </button>
                {form.niveauActivite === key && (
                  <p
                    className="text-xs text-gray-400 italic px-1 animate-fade-in"
                    style={{ animation: 'fadeIn 0.3s ease-in-out' }}
                  >
                    {ACTIVITY_DESCRIPTIONS[key]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Field>

        {/* TDEE mesuré Garmin (optionnel) */}
        <div className="bg-[#0d1117] border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
          <div>
            <p className="text-xs font-semibold text-gray-400">⌚ TDEE mesuré par Garmin</p>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">
              Renseigne ta dépense calorique moyenne d'une journée sans sport (moyenne de plusieurs mesures Garmin).
              Si renseigné, remplace le calcul automatique.
            </p>
          </div>
          <input
            className={inputClass}
            type="number"
            inputMode="numeric"
            placeholder="ex. 2 750"
            min="500"
            max="8000"
            value={form.tdeeMesure}
            onChange={set('tdeeMesure')}
          />
          {form.tdeeMesure && Number(form.tdeeMesure) > 0 ? (
            <p className="text-xs font-semibold text-emerald-400">✓ Utilisé comme base de calcul</p>
          ) : (
            <p className="text-xs text-gray-600">Calcul automatique actif (Mifflin-St Jeor)</p>
          )}
        </div>

        {/* TDEE jour de sport */}
        <div className="bg-[#0d1117] border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
          <div>
            <p className="text-xs font-semibold text-gray-400">🏋️ TDEE mesuré — jours de sport</p>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">
              Dépense calorique Garmin les jours avec séance (moyenne mesurée). Activé via le toggle "Jour de sport" sur l'accueil.
            </p>
          </div>
          <input
            className={inputClass}
            type="number"
            inputMode="numeric"
            placeholder="ex. 3 500"
            min="500"
            max="8000"
            value={form.tdeeSport}
            onChange={set('tdeeSport')}
          />
          {form.tdeeSport && Number(form.tdeeSport) > 0 ? (
            <p className="text-xs font-semibold text-violet-400">✓ Utilisé les jours de sport</p>
          ) : (
            <p className="text-xs text-gray-600">Utilisera tdeeMesure si non renseigné</p>
          )}
        </div>

        {/* Mon objectif */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-300">Mon objectif</label>
          <div className="flex flex-col gap-2">
            {OBJECTIF_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setForm((f) => ({ ...f, objectif: key }))}
                className={`w-full py-3 px-4 rounded-xl text-left text-sm font-medium transition-all duration-200
                  ${form.objectif === key
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/40'
                    : 'bg-[#22223b] text-gray-400 border border-white/10'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Sous-sélecteur vitesse — masqué si maintien */}
          {form.objectif !== 'maintien' && (
            <div className="mt-1 flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-1">
                Vitesse
              </label>
              <div className="flex gap-2">
                {VITESSE_OPTIONS
                  .filter(({ key }) => !(form.objectif === 'prise' && key === 'rapide'))
                  .map(({ key, label }) => {
                    const delta = key === 'lente' ? 250 : key === 'moderee' ? 500 : 750;
                    const sign = form.objectif === 'perte' ? '−' : '+';
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, vitesseObjectif: key }))}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all duration-200
                          ${form.vitesseObjectif === key
                            ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/40'
                            : 'bg-[#22223b] text-gray-400 border border-white/10'}`}
                      >
                        {label}
                        <span className="block text-[10px] opacity-70 mt-0.5">{sign}{delta} kcal</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Info card objectif protéines — calculé en temps réel */}
          {form.poids && !isNaN(Number(form.poids)) && Number(form.poids) >= 20 && (
            <div className="mt-3 flex items-center gap-3 bg-[#0f2027]/60 border border-cyan-900/40 rounded-xl px-4 py-3">
              <span className="text-lg">💪</span>
              <p className="text-sm text-gray-300">
                Objectif protéines estimé :{' '}
                <span className="font-bold text-cyan-400">
                  {calculateProteinGoal({
                    poids: Number(form.poids),
                    niveauActivite: form.niveauActivite,
                    objectif: form.objectif,
                    masseGrasse: form.masseGrasse ? Number(form.masseGrasse) : 0,
                  })} g / jour
                </span>
                {form.masseGrasse && Number(form.masseGrasse) > 0 && Number(form.masseGrasse) < 60 && (
                  <span className="block text-xs text-gray-500 mt-0.5">
                    Calculé sur la masse maigre (LBM)
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

      </form>

    </div>
  );
}
