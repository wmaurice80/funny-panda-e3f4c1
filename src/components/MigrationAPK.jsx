// src/components/MigrationAPK.jsx
// Gère la migration forcée PWA → APK Android.
//
// Phase 1 (avant CUTOFF_DATE) : bannière collante avec countdown + lien téléchargement
// Phase 2 (après CUTOFF_DATE) : mur complet — app inaccessible, seul le download reste
//
// Invisible sur l'APK natif (détection Capacitor.isNativePlatform).

import { useState, useEffect } from 'react';

// ── Config ─────────────────────────────────────────────────────────────────────
const CUTOFF_DATE    = new Date('2026-07-11T00:00:00');
const APK_URL        = 'https://github.com/wmaurice80/funny-panda-e3f4c1/releases/latest/download/calsnap.apk';
const RELEASES_URL   = 'https://github.com/wmaurice80/funny-panda-e3f4c1/releases/latest';

// Détecte si on tourne dans l'APK Capacitor (ne jamais afficher le mur dans l'APK)
const IS_NATIVE = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true;

function daysUntilCutoff() {
  const now  = new Date();
  const diff = CUTOFF_DATE - now;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// ── Mur complet post-coupure ───────────────────────────────────────────────────
export function MigrationWall() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 gap-8"
      style={{ backgroundColor: '#0f0f1a' }}
    >
      {/* Logo / Titre */}
      <div className="text-center">
        <div className="text-5xl mb-4">📱</div>
        <h1 className="text-2xl font-bold text-white mb-2">CalSnap est passé sur Android</h1>
        <p className="text-gray-400 text-sm max-w-xs">
          L'application web n'est plus disponible. Installe l'APK pour continuer à utiliser CalSnap — tes données sont préservées.
        </p>
      </div>

      {/* Téléchargement */}
      <div className="w-full max-w-xs flex flex-col gap-3">
        <a
          href={APK_URL}
          className="flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white font-semibold py-4 rounded-2xl text-center transition-colors"
          download
        >
          <span className="text-xl">⬇️</span>
          Télécharger CalSnap.apk
        </a>

        <a
          href={RELEASES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-center text-xs text-gray-500 hover:text-gray-400 underline"
        >
          Voir toutes les versions sur GitHub →
        </a>
      </div>

      {/* Instructions */}
      <div className="w-full max-w-xs bg-white/5 rounded-2xl p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-300 mb-2">Comment installer :</p>
        {[
          { n: '1', t: 'Télécharge le fichier .apk ci-dessus' },
          { n: '2', t: 'Ouvre le fichier depuis les notifications ou le dossier Téléchargements' },
          { n: '3', t: 'Si Android demande, autorise les "sources inconnues"' },
          { n: '4', t: 'Installe et connecte-toi avec ton compte — tes données se rechargent automatiquement' },
        ].map(({ n, t }) => (
          <div key={n} className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-violet-700 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
              {n}
            </span>
            <p className="text-xs text-gray-400">{t}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-600 text-center max-w-xs">
        Tes repas, poids et activités sont synchronisés via Supabase.<br />
        Aucune donnée n'est perdue.
      </p>
    </div>
  );
}

// ── Bannière pré-coupure ───────────────────────────────────────────────────────
export function MigrationBanner() {
  const [days, setDays]       = useState(daysUntilCutoff());
  const [visible, setVisible] = useState(true);

  // Rafraîchit le countdown chaque minute
  useEffect(() => {
    const id = setInterval(() => setDays(daysUntilCutoff()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!visible) return null;

  const urgency = days <= 3 ? 'bg-red-900/80 border-red-700/60'
                : days <= 7 ? 'bg-orange-900/80 border-orange-700/60'
                :              'bg-violet-900/60 border-violet-700/40';

  const label = days === 0
    ? 'Dernier jour !'
    : days === 1
    ? 'Plus qu\'1 jour'
    : `J-${days}`;

  return (
    <div className={`w-full border-b px-4 py-3 flex items-center gap-3 ${urgency}`} style={{ zIndex: 50 }}>
      {/* Badge countdown */}
      <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
        days <= 3 ? 'bg-red-500 text-white' : days <= 7 ? 'bg-orange-500 text-white' : 'bg-violet-500 text-white'
      }`}>
        {label}
      </span>

      {/* Message */}
      <p className="text-xs text-gray-200 flex-1">
        CalSnap migre sur APK Android le <strong>11 juillet</strong>.
      </p>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <a
          href={APK_URL}
          download
          className="text-xs bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
        >
          ⬇️ Télécharger
        </a>
        <button
          onClick={() => setVisible(false)}
          className="text-gray-500 hover:text-gray-300 text-lg leading-none"
          aria-label="Fermer"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// ── Hook principal ─────────────────────────────────────────────────────────────
// Retourne : { showWall, showBanner }
// showWall   : true si date dépassée ET pas natif
// showBanner : true si avant coupure ET pas natif
export function useMigration() {
  const now        = new Date();
  const isAfter    = now >= CUTOFF_DATE;

  if (IS_NATIVE) return { showWall: false, showBanner: false };

  return {
    showWall:   isAfter,
    showBanner: !isAfter,
  };
}
