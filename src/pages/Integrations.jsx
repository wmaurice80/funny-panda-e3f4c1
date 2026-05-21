// src/pages/Integrations.jsx
// US-F01 : Page Intégrations
// US-F02 : Import calories actives → Activités
// US-F03 : Sync poids depuis Google Fit
// US-F04 : Déconnecter Google Fit

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  isConnected,
  initiateGoogleAuth,
  disconnect,
  fetchAllDayData,
  fetchLatestWeight,
  fetchDebugInfo,
} from '../lib/googleFit';
import { getActivitiesForDate } from '../db';
import { syncedAddActivity, syncedAddWeight } from '../lib/syncManager';

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

export default function Integrations() {
  const navigate = useNavigate();
  const [connected, setConnected] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null); // { activities, kcal, poids } | null
  const [syncError, setSyncError] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const [debugging, setDebugging] = useState(false);

  // Vérification initiale de la connexion
  const checkConnection = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const status = await isConnected();
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
                Connectez Google Fit pour importer automatiquement vos activités
                et votre poids dans CalSnap.
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
                <p className="text-xs text-gray-500">Activités &amp; données santé</p>
              </div>
            </div>
            <PendingBadge />
          </div>
          <p className="text-sm text-gray-400 leading-relaxed">
            Demande d&apos;accès soumise — disponible après approbation Garmin (2-4 semaines).
          </p>
        </div>

      </div>
    </div>
  );
}
