// src/components/InstallBanner.jsx
import { useInstallPrompt } from '../hooks/useInstallPrompt';

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

export default function InstallBanner() {
  const { canInstall, install, isInstalled, dismissed, dismiss, isMobile } = useInstallPrompt();

  // Ne rien afficher si : déjà installé, déjà dismissed, ou pas mobile
  if (isInstalled || dismissed || !isMobile) return null;

  const ios = isIOS();

  // Android : on a le deferredPrompt natif
  if (canInstall) {
    return (
      <div className="mx-5 mb-4 rounded-2xl bg-violet-900/40 border border-violet-600/40 px-4 py-3
                      flex items-start gap-3 animate-fade-in-up shadow-lg">
        <span className="text-2xl flex-shrink-0 mt-0.5">📲</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-violet-100 leading-snug">
            Installe CalSnap sur ton téléphone pour un accès rapide&nbsp;!
          </p>
          <div className="flex gap-2 mt-2.5">
            <button
              onClick={install}
              className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500
                         active:scale-95 text-white font-semibold text-xs
                         shadow-md shadow-violet-900/40 transition-all duration-200 flex-shrink-0"
            >
              Installer
            </button>
            <button
              onClick={dismiss}
              className="px-3 py-1.5 rounded-xl bg-transparent border border-violet-600/40
                         text-violet-300 font-medium text-xs hover:bg-violet-900/30
                         active:scale-95 transition-all duration-200 flex-shrink-0"
            >
              Plus tard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // iOS Safari (pas de beforeinstallprompt)
  if (ios) {
    return (
      <div className="mx-5 mb-4 rounded-2xl bg-violet-900/40 border border-violet-600/40 px-4 py-3
                      flex items-start gap-3 animate-fade-in-up shadow-lg">
        <span className="text-2xl flex-shrink-0 mt-0.5">📲</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-violet-100 leading-snug">
            Pour installer : appuie sur{' '}
            <span className="inline-flex items-center gap-1 align-middle">
              {/* Icône partager iOS */}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4 inline text-violet-300"
                aria-hidden="true"
              >
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            </span>
            {' '}puis{' '}
            <span className="font-bold text-violet-200">"Sur l'écran d'accueil"</span>
          </p>
          <button
            onClick={dismiss}
            className="mt-2.5 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500
                       active:scale-95 text-white font-semibold text-xs
                       shadow-md shadow-violet-900/40 transition-all duration-200"
          >
            OK, compris
          </button>
        </div>
      </div>
    );
  }

  // Aucun cas applicable (ex. desktop non mobile) → rien
  return null;
}
