// src/pages/Migration.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProfile, getMeals, getActivities, getWeights } from '../db';
import { pushProfile, pushMeal, pushActivity, pushWeight } from '../lib/supabaseDb';
import { supabase } from '../lib/supabase';

const ETAPES = ['Profil', 'Repas', 'Activités', 'Pesées'];

export default function Migration() {
  const navigate = useNavigate();

  // Comptage des données locales
  const [comptage, setComptage] = useState(null); // { repas, activites, pesees, profil }

  // État de la migration
  const [statut, setStatut] = useState('idle'); // 'idle' | 'en_cours' | 'succes' | 'erreur'
  const [etapeIndex, setEtapeIndex] = useState(0); // 0-3
  const [messageEtape, setMessageEtape] = useState('');
  const [progres, setProgres] = useState(0); // 0-100
  const [recap, setRecap] = useState(null); // { repas, activites, pesees }
  const [erreur, setErreur] = useState('');

  // Chargement du comptage initial
  useEffect(() => {
    async function charger() {
      const [profile, meals, activities, weights] = await Promise.all([
        getProfile(),
        getMeals(),
        getActivities(),
        getWeights(),
      ]);
      setComptage({
        profil: profile ? 1 : 0,
        repas: meals.length,
        activites: activities.length,
        pesees: weights.length,
      });
    }
    charger();
  }, []);

  async function migrer() {
    setStatut('en_cours');
    setEtapeIndex(0);
    setProgres(0);
    setErreur('');

    try {
      // — Vérification connexion Supabase
      setMessageEtape('Vérification de la connexion...');
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw new Error(`Auth: ${authError.message}`);
      if (!user) throw new Error('Non connecté — connecte-toi d\'abord.');

      // Test rapide d'écriture
      const { error: testError } = await supabase.from('profiles').select('id').limit(1);
      if (testError) throw new Error(`Connexion Supabase: ${testError.message}`);

      // — Étape 1 : Profil (0 → 25%)
      setMessageEtape('Migration du profil...');
      setEtapeIndex(0);
      setProgres(5);
      const profile = await getProfile();
      if (profile) {
        const res = await pushProfile(profile);
        if (!res) throw new Error('Échec push profil — vérifie les RLS policies dans Supabase.');
      }
      setProgres(25);

      // — Étape 2 : Repas (25 → 50%)
      const meals = await getMeals();
      setMessageEtape(`Migration de ${meals.length} repas...`);
      setEtapeIndex(1);
      for (let i = 0; i < meals.length; i++) {
        await pushMeal(meals[i]);
        setProgres(25 + Math.round(((i + 1) / Math.max(meals.length, 1)) * 25));
      }
      setProgres(50);

      // — Étape 3 : Activités (50 → 75%)
      const activities = await getActivities();
      setMessageEtape(`Migration de ${activities.length} activités...`);
      setEtapeIndex(2);
      for (let i = 0; i < activities.length; i++) {
        await pushActivity(activities[i]);
        setProgres(50 + Math.round(((i + 1) / Math.max(activities.length, 1)) * 25));
      }
      setProgres(75);

      // — Étape 4 : Pesées (75 → 100%)
      const weights = await getWeights();
      setMessageEtape(`Migration de ${weights.length} pesées...`);
      setEtapeIndex(3);
      for (let i = 0; i < weights.length; i++) {
        await pushWeight(weights[i]);
        setProgres(75 + Math.round(((i + 1) / Math.max(weights.length, 1)) * 25));
      }
      setProgres(100);

      setRecap({
        repas: meals.length,
        activites: activities.length,
        pesees: weights.length,
      });
      setStatut('succes');
    } catch (err) {
      console.error('[Migration]', err);
      setErreur(err?.message ?? 'Une erreur est survenue pendant la migration.');
      setStatut('erreur');
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: '#0f0f1a' }}
    >
      {/* Header avec bouton retour */}
      <div className="px-5 pt-12 pb-4 flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-xl
                     bg-[#1a1a2e] border border-white/10
                     text-gray-400 hover:text-white hover:bg-[#22223b]
                     active:scale-95 transition-all duration-200"
          aria-label="Retour"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Migration des données ☁️</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Pousse tes données locales vers Supabase pour les retrouver sur tous tes appareils
          </p>
        </div>
      </div>

      {/* Card principale */}
      <div className="px-5 mt-4 flex-1">
        <div className="bg-[#1a1a2e] rounded-2xl p-6 shadow-xl">

          {/* ——— IDLE : comptage + bouton ——— */}
          {statut === 'idle' && (
            <div className="flex flex-col gap-6">
              {/* Comptage */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
                  Données locales détectées
                </p>
                {comptage === null ? (
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <div className="w-4 h-4 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
                    Chargement...
                  </div>
                ) : (
                  <p className="text-base font-semibold text-white">
                    {comptage.repas} repas
                    <span className="text-gray-500"> · </span>
                    {comptage.activites} activités
                    <span className="text-gray-500"> · </span>
                    {comptage.pesees} pesées
                    <span className="text-gray-500"> · </span>
                    <span className="text-violet-300">profil</span>
                  </p>
                )}
              </div>

              {/* Bouton migrer */}
              <button
                onClick={migrer}
                disabled={comptage === null}
                className="w-full py-4 rounded-2xl
                           bg-gradient-to-r from-violet-600 to-indigo-600
                           text-white font-bold text-base
                           flex items-center justify-center gap-2
                           hover:opacity-90 active:scale-95
                           disabled:opacity-40 disabled:pointer-events-none
                           transition-all duration-200 shadow-lg"
              >
                <span>🚀</span> Migrer vers le cloud
              </button>
            </div>
          )}

          {/* ——— EN COURS : barre de progression ——— */}
          {statut === 'en_cours' && (
            <div className="flex flex-col gap-5">
              {/* Étapes */}
              <div className="flex justify-between">
                {ETAPES.map((etape, i) => (
                  <div key={etape} className="flex flex-col items-center gap-1">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                        transition-all duration-300
                        ${i < etapeIndex
                          ? 'bg-violet-600 text-white'
                          : i === etapeIndex
                            ? 'bg-violet-500/40 border-2 border-violet-500 text-violet-300'
                            : 'bg-[#22223b] text-gray-600'
                        }`}
                    >
                      {i < etapeIndex ? '✓' : i + 1}
                    </div>
                    <span className={`text-[10px] font-medium ${
                      i <= etapeIndex ? 'text-violet-300' : 'text-gray-600'
                    }`}>
                      {etape}
                    </span>
                  </div>
                ))}
              </div>

              {/* Barre de progression */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs text-gray-400">{messageEtape}</span>
                  <span className="text-xs font-bold text-violet-300">{progres}%</span>
                </div>
                <div className="w-full h-3 bg-[#22223b] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-600 rounded-full transition-all duration-300"
                    style={{ width: `${progres}%` }}
                  />
                </div>
              </div>

              {/* Spinner */}
              <div className="flex items-center justify-center gap-3 pt-2">
                <div className="w-5 h-5 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
                <span className="text-sm text-gray-400">Migration en cours...</span>
              </div>
            </div>
          )}

          {/* ——— SUCCÈS ——— */}
          {statut === 'succes' && recap && (
            <div className="flex flex-col gap-5">
              <div className="bg-emerald-900/30 border border-emerald-700/40 rounded-xl p-4 text-center">
                <p className="text-2xl mb-1">✅</p>
                <p className="text-base font-bold text-emerald-400">Migration terminée</p>
                <p className="text-xs text-emerald-500/80 mt-0.5">Tes données sont maintenant dans le cloud</p>
              </div>

              {/* Récap */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">Récapitulatif</p>
                <RecapLigne emoji="🍽️" label="Repas migrés" valeur={recap.repas} />
                <RecapLigne emoji="🏃" label="Activités migrées" valeur={recap.activites} />
                <RecapLigne emoji="⚖️" label="Pesées migrées" valeur={recap.pesees} />
                <RecapLigne emoji="👤" label="Profil migré" valeur={1} />
              </div>

              {/* Bouton retour accueil */}
              <button
                onClick={() => navigate('/')}
                className="w-full py-3.5 rounded-2xl
                           bg-gradient-to-r from-emerald-700/60 to-teal-700/60
                           border border-emerald-600/40
                           text-emerald-200 font-semibold text-sm
                           flex items-center justify-center gap-2
                           hover:opacity-90 active:scale-95 transition-all duration-200"
              >
                Retour à l&apos;accueil
              </button>
            </div>
          )}

          {/* ——— ERREUR ——— */}
          {statut === 'erreur' && (
            <div className="flex flex-col gap-5">
              <div className="bg-red-900/30 border border-red-700/40 rounded-xl p-4">
                <p className="text-base font-bold text-red-400 mb-1">❌ Erreur de migration</p>
                <p className="text-xs text-red-400/80">{erreur}</p>
              </div>

              <button
                onClick={() => setStatut('idle')}
                className="w-full py-3.5 rounded-2xl border border-white/10 bg-[#22223b]
                           text-gray-300 font-medium text-sm
                           hover:bg-[#2a2a40] active:scale-95 transition-all duration-200"
              >
                Réessayer
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function RecapLigne({ emoji, label, valeur }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5">
      <div className="flex items-center gap-2">
        <span>{emoji}</span>
        <span className="text-sm text-gray-400">{label}</span>
      </div>
      <span className="text-sm font-bold text-white">{valeur}</span>
    </div>
  );
}
