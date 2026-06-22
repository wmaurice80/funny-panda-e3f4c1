// src/pages/Integrations.jsx
// US-F01 : Page Intégrations
// US-F02 : Import calories actives → Activités
// US-F03 : Sync poids depuis Google Fit
// US-F04 : Déconnecter Google Fit

import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  isConnected,
  hasRefreshToken,
  initiateGoogleAuth,
  disconnect,
  fetchAllDayData,
  fetchLatestWeight,
  fetchDebugInfo,
} from '../lib/googleFit';
import { getActivitiesForDate } from '../db';
import { syncedAddActivity, syncedAddWeight, syncGarminDaily, syncGarminActivities } from '../lib/syncManager';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import {
  isHealthConnectAvailable,
  requestHealthConnectPermissions,
  checkHealthConnectPermissions,
  readRecentDailyData,
} from '../lib/healthConnect';
import { pushGarminDaily } from '../lib/supabaseDb';

/** Formate la date courante en 'YYYY-MM-DD' */
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Badge de statut de connexion */
function ConnectedBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full
                     bg-emerald-900/30 border border-emerald-700/40 text-emerald-400">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      Connecté
    </span>
  );
}

/** Badge en attente */
function PendingBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full
                     bg-orange-900/30 border border-orange-700/40 text-orange-400">
      <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
      En attente d&apos;approbation API
    </span>
  );
}

/** Spinner inline */
function Spinner() {
  return (
    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin inline-block" />
  );
}

const GARMIN_OWNER_EMAIL = 'wmaurice.peroumal@gmail.com';

/** Section d'aide dépliable pour Google Fit */
function GoogleFitHelp() {
  const [open, setOpen] = useState(false);
  const bodyRef = useRef(null);

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      {/* Toggle */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3
                   bg-[#0f0f1a] text-left hover:bg-[#1a1a2e] transition-colors"
      >
        <span className="text-xs font-semibold text-gray-400 flex items-center gap-2">
          <span>❓</span> Comment ça marche ?
        </span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Corps */}
      {open && (
        <div ref={bodyRef} className="bg-[#0f0f1a] px-4 pb-4 flex flex-col gap-4 border-t border-white/10">

          {/* Étapes */}
          <div className="flex flex-col gap-3 pt-3">
            {[
              {
                n: '1',
                icon: '📱',
                title: 'Installer Google Fit',
                desc: 'Télécharge l\'app Google Fit depuis le Play Store sur ton Android.',
              },
              {
                n: '2',
                icon: '⌚',
                title: 'Connecter ta montre ou ton tracker',
                desc: 'Dans Google Fit, associe ta montre connectée (Fitbit, Samsung Health, Wear OS, Polar…). C\'est elle qui fournit les calories mesurées.',
              },
              {
                n: '3',
                icon: '🔗',
                title: 'Connecter Google Fit à CalSnap',
                desc: 'Clique sur "Connecter Google Fit" ci-dessus et autorise l\'accès aux activités et au poids.',
              },
              {
                n: '4',
                icon: '🔄',
                title: 'Synchroniser',
                desc: 'Reviens ici et clique "Synchroniser" pour importer activités et poids. Répète après chaque séance.',
              },
            ].map(step => (
              <div key={step.n} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-violet-700/50 border border-violet-600/40
                                flex items-center justify-center text-[11px] font-bold text-violet-300 flex-shrink-0 mt-0.5">
                  {step.n}
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                    <span>{step.icon}</span> {step.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Rôle dans CalSnap */}
          <div className="bg-violet-900/20 border border-violet-700/30 rounded-xl px-3 py-2.5">
            <p className="text-xs font-semibold text-violet-300 mb-1">⚡ Rôle dans le bilan</p>
            <p className="text-xs text-gray-400 leading-relaxed">
              Si Google Fit mesure une dépense supérieure à ton TDEE de profil,
              CalSnap l'utilise automatiquement dans le bilan du jour — comme
              le fait Garmin. Un badge <span className="text-violet-300 font-semibold">🏃 GFit</span> apparaît
              sur la carte TDEE.
            </p>
          </div>

          {/* Montres compatibles */}
          <div className="bg-[#1a1a2e] border border-white/10 rounded-xl px-3 py-2.5">
            <p className="text-xs font-semibold text-gray-400 mb-2">🎯 Précision selon la source</p>
            <div className="flex flex-col gap-1.5">
              {[
                { label: 'Fitbit, Polar, Suunto',       quality: '★★★★★', color: 'text-emerald-400' },
                { label: 'Wear OS / Google Pixel Watch', quality: '★★★★☆', color: 'text-emerald-400' },
                { label: 'Samsung (via S Health)',       quality: '★★★☆☆', color: 'text-yellow-400'  },
                { label: 'Téléphone seul (capteurs)',    quality: '★★☆☆☆', color: 'text-orange-400'  },
                { label: 'Garmin',                       quality: '✗ calories non dispo', color: 'text-red-400' },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">{row.label}</span>
                  <span className={`font-semibold ${row.color}`}>{row.quality}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-600 mt-2">
              * Garmin ne synchronise pas les calories vers Google Fit — utilise la carte Garmin dédiée ci-dessous.
            </p>
          </div>

        </div>
      )}
    </div>
  );
}

export default function Integrations() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isGarminOwner = user?.email === GARMIN_OWNER_EMAIL;
  const [connected, setConnected] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null); // { activities, kcal, poids } | null
  const [syncError, setSyncError] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const [debugging, setDebugging] = useState(false);
  const [garminSyncing, setGarminSyncing] = useState(false)
  const [garminResult, setGarminResult] = useState(null) // { summary } | null
  const [garminError, setGarminError] = useState(null)
  const [garminDebug, setGarminDebug] = useState(null)
  const [garminDebugging, setGarminDebugging] = useState(false)

  // Health Connect
  const [hcAvailable, setHcAvailable] = useState(null) // null = loading, true/false
  const [hcPermissionsGranted, setHcPermissionsGranted] = useState(false)
  const [hcSyncing, setHcSyncing] = useState(false)
  const [hcResult, setHcResult] = useState(null) // Array<{ date, total_kcal, active_kcal, steps }> | null
  const [hcError, setHcError] = useState(null)

  // Vérification initiale de la connexion
  const checkConnection = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const status = isConnected() || hasRefreshToken();
      setConnected(status);
    } catch {
      setConnected(false);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // Vérification disponibilité + permissions Health Connect au montage
  useEffect(() => {
    let cancelled = false
    async function checkHC() {
      try {
        // Timeout 4s : si le plugin ne répond pas, on considère HC indisponible
        const timeout = new Promise(resolve => setTimeout(() => resolve(false), 4000))
        const available = await Promise.race([isHealthConnectAvailable(), timeout])
        if (cancelled) return
        setHcAvailable(available)
        if (available) {
          const perms = await Promise.race([
            checkHealthConnectPermissions(),
            new Promise(resolve => setTimeout(() => resolve(false), 3000)),
          ])
          if (!cancelled) setHcPermissionsGranted(perms)
        }
      } catch {
        if (!cancelled) setHcAvailable(false)
      }
    }
    checkHC()
    return () => { cancelled = true }
  }, [])

  const [hcChecking, setHcChecking] = useState(false)

  const handleHcConnect = async () => {
    setHcError(null)
    try {
      // Pas de timeout ici — le dialogue HC attend l'interaction utilisateur
      const granted = await requestHealthConnectPermissions()
      setHcPermissionsGranted(granted)
      if (!granted) {
        setHcError('Permissions refusées ou dialogue fermé. Réessaie ou accorde les permissions manuellement dans Santé Connect.')
      }
    } catch (err) {
      setHcError(err?.message ?? 'Erreur lors de la demande de permissions')
    }
  }

  const handleHcCheckPermissions = async () => {
    setHcChecking(true)
    setHcError(null)
    try {
      const granted = await checkHealthConnectPermissions()
      setHcPermissionsGranted(granted)
      if (!granted) {
        setHcError('Permissions non trouvées. Suis le guide ci-dessous puis réessaie.')
      }
    } catch (err) {
      setHcError(err?.message ?? 'Erreur vérification permissions')
    } finally {
      setHcChecking(false)
    }
  }

  const handleHcSync = async () => {
    setHcSyncing(true)
    setHcResult(null)
    setHcError(null)
    try {
      const entries = await readRecentDailyData()
      if (!entries.length) {
        setHcResult([])
        return
      }
      if (!user?.id) {
        setHcError('Utilisateur non connecté — impossible de sauvegarder.')
        return
      }
      await pushGarminDaily(user.id, entries)
      window.dispatchEvent(new CustomEvent('garmin-synced'))
      setHcResult(entries)
    } catch (err) {
      setHcError(err?.message ?? 'Erreur de synchronisation Health Connect')
    } finally {
      setHcSyncing(false)
    }
  }

  // US-F04 : Déconnexion
  const handleDisconnect = async () => {
    try {
      await disconnect();
      setConnected(false);
      setSyncResult(null);
      setSyncError(null);
    } catch (err) {
      setSyncError('Erreur lors de la déconnexion : ' + (err?.message ?? 'inconnue'));
    }
  };

  // US-F02 + F03 : Synchronisation
  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    setSyncError(null);

    try {
      const today = todayISO();
      let importedActivities = 0;
      let importedKcal = 0;
      let importedPoids = null;

      // ── Récupération de toutes les données du jour en parallèle ───────────
      const allDay = await fetchAllDayData(today);
      const sessions = allDay.activities ?? [];

      // ── US-F02 : Activités → Activités CalSnap ────────────────────────────
      if (sessions.length > 0) {
        // Récupère les activités existantes pour éviter les doublons
        const existing = await getActivitiesForDate(today);

        for (const session of sessions) {
          const kcal = Math.round(session.calories ?? 0);
          if (kcal <= 0 && (session.dureeMin ?? 0) <= 0) continue;

          const typeName = session.name || 'Google Fit';

          // Déduplication : même date + même type
          const isDuplicate = existing.some(
            (a) => a.date === today && a.type === typeName
          );

          if (!isDuplicate) {
            await syncedAddActivity({
              date: today,
              heure: '00:00',
              type: typeName,
              duree: session.dureeMin ?? 0,
              caloriesBrulees: kcal,
              note: 'Importé depuis Google Fit',
            });
            importedActivities += 1;
            importedKcal += kcal;
          }
        }
      }

      // ── US-F03 : Poids ─────────────────────────────────────────────────────
      const weight = await fetchLatestWeight();
      if (weight && weight.poids) {
        await syncedAddWeight({ date: weight.date, poids: weight.poids });
        importedPoids = weight.poids;
      }

      setSyncResult({
        activities: importedActivities,
        kcal: importedKcal,
        poids: importedPoids,
        tdee: allDay.tdee?.tdee ?? null,
        steps: allDay.steps?.steps ?? null,
        heartRateAvg: allDay.heartRate?.avg ?? null,
      });
    } catch (err) {
      setSyncError('Erreur de synchronisation : ' + (err?.message ?? 'inconnue'));
    } finally {
      setSyncing(false);
    }
  };

  const handleGarminSync = async () => {
    setGarminSyncing(true)
    setGarminResult(null)
    setGarminError(null)
    try {
      const { data, error } = await supabase.functions.invoke('garmin-sync', {
        body: { days: 2 }
      })
      if (error) throw error
      if (!data.success) throw new Error(data.error ?? 'Erreur inconnue')
      setGarminResult(data.summary)
      if (user?.id) {
        // Calcule les dates syncées (même logique que l'Edge Function : days=2, offset=0)
        const syncedDates = Array.from({ length: 2 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - i);
          return d.toISOString().slice(0, 10);
        });
        await syncGarminDaily(user.id).catch(() => {});
        await syncGarminActivities(user.id, syncedDates).catch(() => {});
        window.dispatchEvent(new CustomEvent('garmin-synced'));
      }
    } catch (err) {
      setGarminError(err?.message ?? 'Erreur de synchronisation Garmin')
    } finally {
      setGarminSyncing(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0f0f1a] pb-16">
      {/* Header */}
      <div className="px-5 pt-12 pb-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-xl
                     bg-[#1a1a2e] border border-white/10 text-gray-300
                     hover:text-white active:scale-90 transition-all duration-200"
          aria-label="Retour"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-white">Intégrations ⚙️</h1>
      </div>

      <div className="px-5 flex flex-col gap-4">

        {/* ── Card Google Fit ──────────────────────────────────────────────── */}
        <div className="bg-[#1a1a2e] rounded-2xl p-5 shadow-xl border border-white/5">
          {/* Titre card */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏃</span>
              <div>
                <p className="text-sm font-bold text-white">Google Fit</p>
                <p className="text-xs text-gray-500">Activités &amp; poids</p>
              </div>
            </div>
            {!loadingStatus && connected && <ConnectedBadge />}
          </div>

          {/* État de chargement */}
          {loadingStatus ? (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
            </div>
          ) : connected ? (
            /* ── Connecté ── */
            <div className="flex flex-col gap-3">
              {/* Bouton Synchroniser */}
              <button
                onClick={handleSync}
                disabled={syncing}
                className="w-full py-3 rounded-xl
                           bg-gradient-to-r from-violet-600 to-indigo-600
                           text-white font-semibold text-sm
                           flex items-center justify-center gap-2
                           hover:opacity-90 active:scale-95 transition-all duration-200
                           disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {syncing ? (
                  <>
                    <Spinner />
                    Synchronisation…
                  </>
                ) : (
                  <>
                    <span>🔄</span>
                    Synchroniser maintenant
                  </>
                )}
              </button>

              {/* Bouton Déconnecter */}
              <button
                onClick={handleDisconnect}
                disabled={syncing}
                className="w-full py-2.5 rounded-xl border border-red-800/50
                           text-red-400 font-medium text-sm
                           flex items-center justify-center gap-2
                           hover:bg-red-900/20 active:scale-95 transition-all duration-200
                           disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span>🔌</span>
                Déconnecter
              </button>

              {/* Résultats de sync */}
              {syncResult !== null && (
                <div className="rounded-xl px-4 py-3 bg-emerald-900/20 border border-emerald-700/30
                                flex flex-col gap-1.5">
                  <p className="text-sm font-bold text-emerald-400">
                    Synchronisation terminée ✓
                  </p>

                  {/* Activités */}
                  {syncResult.activities > 0 ? (
                    <p className="text-xs text-emerald-300">
                      🏃 {syncResult.activities} séance{syncResult.activities > 1 ? 's' : ''} importée{syncResult.activities > 1 ? 's' : ''} — {syncResult.kcal.toLocaleString('fr-FR')} kcal
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400">
                      Aucune nouvelle activité à importer
                    </p>
                  )}

                  {/* TDEE du jour */}
                  {syncResult.tdee != null && syncResult.tdee > 0 && (
                    <p className="text-xs text-violet-300">
                      ⚡ TDEE du jour : {syncResult.tdee.toLocaleString('fr-FR')} kcal
                    </p>
                  )}

                  {/* Pas */}
                  {syncResult.steps != null && syncResult.steps > 0 && (
                    <p className="text-xs text-cyan-300">
                      👟 Pas : {syncResult.steps.toLocaleString('fr-FR')}
                    </p>
                  )}

                  {/* FC moyenne */}
                  {syncResult.heartRateAvg != null && syncResult.heartRateAvg > 0 && (
                    <p className="text-xs text-red-300">
                      ❤️ FC moyenne : {syncResult.heartRateAvg} bpm
                    </p>
                  )}

                  {/* Poids */}
                  {syncResult.poids !== null ? (
                    <p className="text-xs text-emerald-300">
                      ⚖️ Poids synchronisé : {syncResult.poids} kg
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400">
                      Aucun poids trouvé sur Google Fit
                    </p>
                  )}
                </div>
              )}

              {/* Erreur de sync */}
              {syncError && (
                <div className="rounded-xl px-4 py-3 bg-red-900/20 border border-red-700/30">
                  <p className="text-xs text-red-400">{syncError}</p>
                </div>
              )}

              {/* Aide — toujours accessible même quand connecté */}
              <GoogleFitHelp />

              {/* Debug — données brutes Google Fit */}
              <button
                onClick={async () => {
                  setDebugging(true);
                  try {
                    const today = new Date().toISOString().slice(0, 10);
                    const info = await fetchDebugInfo(today);
                    setDebugInfo(info);
                  } catch (e) {
                    setDebugInfo({ erreur: e.message });
                  } finally {
                    setDebugging(false);
                  }
                }}
                disabled={debugging}
                className="w-full py-2 rounded-xl border border-white/10 bg-[#0f0f1a]
                           text-gray-500 font-medium text-xs flex items-center justify-center gap-2
                           hover:text-gray-300 transition-colors"
              >
                {debugging ? '⏳ Analyse...' : '🔍 Diagnostiquer les données Google Fit'}
              </button>
              {debugInfo && (
                <div className="bg-[#0f0f1a] rounded-xl p-3 border border-white/10">
                  <p className="text-xs font-semibold text-gray-400 mb-2">Données aujourd'hui :</p>
                  {Object.entries(debugInfo).map(([key, val]) => (
                    <div key={key} className="flex justify-between text-xs py-1 border-b border-white/5">
                      <span className="text-gray-500 truncate">{key.replace('com.google.', '')}</span>
                      <span className={`font-bold ml-2 ${typeof val === 'number' && val > 0 ? 'text-emerald-400' : 'text-gray-600'}`}>
                        {val}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* ── Non connecté ── */
            <div className="flex flex-col gap-3">
              <p className="text-sm text-gray-400 leading-relaxed">
                Connectez Google Fit pour importer activités et poids,
                et améliorer la précision de votre TDEE.
              </p>
              <button
                onClick={initiateGoogleAuth}
                className="w-full py-3 rounded-xl
                           bg-gradient-to-r from-violet-600 to-indigo-600
                           text-white font-semibold text-sm
                           flex items-center justify-center gap-2
                           hover:opacity-90 active:scale-95 transition-all duration-200"
              >
                <span>🔗</span>
                Connecter Google Fit
              </button>
              <GoogleFitHelp />
            </div>
          )}
        </div>

        {/* ── Card Garmin Connect ──────────────────────────────────────────── */}
        <div className="bg-[#1a1a2e] rounded-2xl p-5 shadow-xl border border-white/5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⌚</span>
              <div>
                <p className="text-sm font-bold text-white">Garmin Connect</p>
                <p className="text-xs text-gray-500">TDEE · Activités · Poids</p>
              </div>
            </div>
            {isGarminOwner ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full
                               bg-emerald-900/30 border border-emerald-700/40 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Actif
              </span>
            ) : (
              <PendingBadge />
            )}
          </div>

          {isGarminOwner ? (
            /* ── Vue propriétaire : sync complète ── */
            <>
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                Synchronise ton TDEE mesuré, tes séances et ton poids directement depuis Garmin Connect.
                La sync automatique tourne chaque matin à 7h.
              </p>

              <button
                onClick={handleGarminSync}
                disabled={garminSyncing}
                className="w-full py-3 rounded-xl
                           bg-gradient-to-r from-teal-600 to-cyan-600
                           text-white font-semibold text-sm
                           flex items-center justify-center gap-2
                           hover:opacity-90 active:scale-95 transition-all duration-200
                           disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {garminSyncing ? (
                  <><Spinner />Synchronisation Garmin…</>
                ) : (
                  <><span>🔄</span>Sync Garmin maintenant</>
                )}
              </button>

              {garminResult && (
                <div className="mt-3 rounded-xl px-4 py-3 bg-emerald-900/20 border border-emerald-700/30
                                flex flex-col gap-1.5">
                  <p className="text-sm font-bold text-emerald-400">Sync Garmin terminée ✓</p>
                  <p className="text-xs text-gray-400">TDEE mis à jour : {garminResult.tdeeOk ? '✓' : '—'}</p>
                  <p className="text-xs text-gray-400">
                    Activités importées : {garminResult.activitesOk}
                    {garminResult.activitesErr > 0 && (
                      <span className="text-orange-400"> ({garminResult.activitesErr} erreur{garminResult.activitesErr > 1 ? 's' : ''})</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">
                    Poids : {garminResult.poidsOk ? '✓ synchronisé' : '— aucune pesée'}
                  </p>
                </div>
              )}

              {garminError && (
                <div className="mt-3 rounded-xl px-4 py-3 bg-red-900/20 border border-red-700/30">
                  <p className="text-xs text-red-400">{garminError}</p>
                </div>
              )}

              <button
                onClick={async () => {
                  setGarminDebugging(true)
                  setGarminDebug(null)
                  try {
                    const { data, error } = await supabase.functions.invoke('garmin-sync', { body: { debug: true } })
                    if (error) throw error
                    setGarminDebug(data)
                  } catch (err) {
                    setGarminDebug({ error: err?.message ?? 'Erreur inconnue' })
                  } finally {
                    setGarminDebugging(false)
                  }
                }}
                disabled={garminDebugging}
                className="mt-2 w-full py-2 rounded-xl border border-white/10 bg-[#0f0f1a]
                           text-gray-500 font-medium text-xs flex items-center justify-center gap-2
                           hover:text-gray-300 transition-colors disabled:opacity-50"
              >
                {garminDebugging ? '⏳ Analyse...' : '🔍 Diagnostiquer API Garmin'}
              </button>

              {garminDebug && (
                <div className="mt-2 bg-[#0f0f1a] rounded-xl p-3 border border-white/10 overflow-x-auto">
                  <p className="text-xs font-semibold text-gray-400 mb-2">Réponse brute Garmin :</p>
                  <pre className="text-[10px] text-gray-400 whitespace-pre-wrap break-all">
                    {JSON.stringify(garminDebug, null, 2)}
                  </pre>
                </div>
              )}
            </>
          ) : (
            /* ── Vue autres users : à venir ── */
            <p className="text-sm text-gray-500 leading-relaxed">
              La synchronisation Garmin n'est pas encore disponible pour tous les utilisateurs.
              En attendant, tu peux saisir ton TDEE manuellement dans ton profil, ou importer
              tes activités via Google Fit.
            </p>
          )}
        </div>

        {/* ── Card Health Connect ──────────────────────────────────────────── */}
        <div className="bg-[#1a1a2e] rounded-2xl p-5 shadow-xl border border-white/5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">❤️</span>
              <div>
                <p className="text-sm font-bold text-white">Health Connect</p>
                <p className="text-xs text-gray-500">Calories · Pas · Activités</p>
              </div>
            </div>
            {hcAvailable === true && hcPermissionsGranted && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full
                               bg-emerald-900/30 border border-emerald-700/40 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Connecté
              </span>
            )}
          </div>

          {/* Chargement initial */}
          {hcAvailable === null ? (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
            </div>
          ) : hcAvailable === false ? (
            /* HC non disponible (PWA ou HC non installé) */
            <div className="flex flex-col gap-3">
              <div className="rounded-xl px-4 py-3 bg-orange-900/20 border border-orange-700/30">
                <p className="text-xs font-semibold text-orange-400 mb-1">Non disponible</p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Health Connect n&apos;est pas disponible sur cet appareil. Assure-toi d&apos;utiliser
                  l&apos;APK CalSnap sur Android et d&apos;avoir installé{' '}
                  <span className="text-orange-300 font-semibold">Health Connect</span> depuis le Play Store.
                </p>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                Health Connect centralise les données de santé sur Android (Android 14+ intégré,
                Android 9–13 via Play Store). Il agrège Garmin, Samsung Health, Fitbit et d&apos;autres sources.
              </p>
            </div>
          ) : !hcPermissionsGranted ? (
            /* HC disponible mais pas de permissions */
            <div className="flex flex-col gap-3">
              <p className="text-sm text-gray-400 leading-relaxed">
                Connecte Santé Connect pour importer automatiquement tes calories brûlées
                et ton nombre de pas depuis Garmin.
              </p>

              {/* Bouton principal — ouvre le dialogue Santé Connect */}
              <button
                onClick={handleHcConnect}
                className="w-full py-3 rounded-xl
                           bg-gradient-to-r from-rose-600 to-pink-600
                           text-white font-semibold text-sm
                           flex items-center justify-center gap-2
                           hover:opacity-90 active:scale-95 transition-all duration-200"
              >
                <span>🔗</span>Connecter Santé Connect
              </button>

              {/* Bouton secondaire — si dialogue ne s'ouvre pas */}
              <button
                onClick={handleHcCheckPermissions}
                disabled={hcChecking}
                className="w-full py-2.5 rounded-xl border border-white/10 bg-[#0f0f1a]
                           text-gray-400 font-medium text-xs
                           flex items-center justify-center gap-2
                           hover:text-white transition-colors
                           disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {hcChecking ? <><Spinner />Vérification…</> : <><span>✅</span>Permissions déjà accordées ? Vérifier</>}
              </button>

              {hcError && (
                <div className="rounded-xl px-4 py-3 bg-red-900/20 border border-red-700/30">
                  <p className="text-xs text-red-400">{hcError}</p>
                </div>
              )}
            </div>
          ) : (
            /* HC connecté avec permissions */
            <div className="flex flex-col gap-3">
              <p className="text-xs text-gray-500 leading-relaxed">
                Importe les calories brûlées et les pas des 2 derniers jours depuis Health Connect.
              </p>
              <button
                onClick={handleHcSync}
                disabled={hcSyncing}
                className="w-full py-3 rounded-xl
                           bg-gradient-to-r from-rose-600 to-pink-600
                           text-white font-semibold text-sm
                           flex items-center justify-center gap-2
                           hover:opacity-90 active:scale-95 transition-all duration-200
                           disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {hcSyncing ? (
                  <><Spinner />Synchronisation HC…</>
                ) : (
                  <><span>🔄</span>Synchroniser Health Connect</>
                )}
              </button>

              {hcResult !== null && (
                <div className="rounded-xl px-4 py-3 bg-emerald-900/20 border border-emerald-700/30
                                flex flex-col gap-1.5">
                  <p className="text-sm font-bold text-emerald-400">Sync Health Connect terminée ✓</p>
                  {hcResult.length === 0 ? (
                    <p className="text-xs text-gray-400">Aucune donnée trouvée sur les 2 derniers jours.</p>
                  ) : (
                    hcResult.map(entry => (
                      <div key={entry.date} className="flex flex-col gap-0.5">
                        <p className="text-xs font-semibold text-gray-300">
                          {new Date(entry.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </p>
                        {entry.total_kcal > 0 && (
                          <p className="text-xs text-violet-300">
                            ⚡ Total : {entry.total_kcal.toLocaleString('fr-FR')} kcal
                            {entry.active_kcal > 0 && ` (actif : ${entry.active_kcal.toLocaleString('fr-FR')} kcal)`}
                          </p>
                        )}
                        {entry.steps > 0 && (
                          <p className="text-xs text-cyan-300">
                            👟 Pas : {entry.steps.toLocaleString('fr-FR')}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {hcError && (
                <div className="rounded-xl px-4 py-3 bg-red-900/20 border border-red-700/30">
                  <p className="text-xs text-red-400">{hcError}</p>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
