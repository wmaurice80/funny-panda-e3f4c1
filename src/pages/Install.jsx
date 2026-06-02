// src/pages/Install.jsx
import { useNavigate } from 'react-router-dom';

function Step({ number, children }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-full bg-violet-700/60 border border-violet-500/50
                      flex-shrink-0 flex items-center justify-center
                      text-violet-200 font-bold text-sm">
        {number}
      </div>
      <p className="text-sm text-gray-300 leading-relaxed pt-0.5">{children}</p>
    </div>
  );
}

export default function Install() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen bg-[#0f0f1a] pb-16">
      {/* Header */}
      <div className="px-5 pt-12 pb-6 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-xl
                     bg-[#1a1a2e] border border-white/10 text-gray-400
                     hover:text-white active:scale-90 transition-all duration-200"
          aria-label="Retour"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Installer CalSnap</h1>
          <p className="text-sm text-gray-400 mt-0.5">Accès rapide depuis ton téléphone</p>
        </div>
      </div>

      <div className="px-5 flex flex-col gap-6">

        {/* Intro */}
        <div className="bg-violet-900/30 border border-violet-700/40 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-3xl">📲</span>
          <p className="text-sm text-violet-200 leading-relaxed">
            CalSnap peut s'installer directement sur ton écran d'accueil, comme une vraie app — sans passer par l'App Store ni le Play Store.
          </p>
        </div>

        {/* Android */}
        <div className="bg-[#1a1a2e] rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🤖</span>
            <h2 className="text-base font-bold text-white">Android (Chrome)</h2>
          </div>
          <div className="flex flex-col gap-4">
            <Step number={1}>
              Ouvre CalSnap dans <span className="font-semibold text-violet-300">Google Chrome</span> sur ton Android.
            </Step>
            <Step number={2}>
              Appuie sur le menu <span className="font-semibold text-violet-300">⋮</span> en haut à droite (trois points verticaux).
            </Step>
            <Step number={3}>
              Sélectionne <span className="font-semibold text-violet-300">"Ajouter à l'écran d'accueil"</span>.
            </Step>
            <Step number={4}>
              Confirme en appuyant sur <span className="font-semibold text-violet-300">"Ajouter"</span> dans la fenêtre qui s'affiche.
            </Step>
            <Step number={5}>
              CalSnap apparaît sur ton écran d'accueil — appuie dessus pour l'ouvrir en plein écran.
            </Step>
          </div>
          <div className="mt-4 bg-emerald-900/20 border border-emerald-700/30 rounded-xl px-3 py-2.5">
            <p className="text-xs text-emerald-400 font-medium">
              Astuce : Chrome peut afficher une bannière d'installation automatique en bas de l'écran. Appuie dessus pour installer encore plus vite.
            </p>
          </div>
        </div>

        {/* iOS */}
        <div className="bg-[#1a1a2e] rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🍎</span>
            <h2 className="text-base font-bold text-white">iPhone / iPad (Safari)</h2>
          </div>
          <div className="flex flex-col gap-4">
            <Step number={1}>
              Ouvre CalSnap dans <span className="font-semibold text-violet-300">Safari</span> sur ton iPhone ou iPad.
            </Step>
            <Step number={2}>
              Appuie sur l'icône{' '}
              <span className="inline-flex items-center gap-1 align-middle">
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
                <span className="font-semibold text-violet-300">Partager</span>
              </span>
              {' '}en bas de l'écran (carré avec une flèche vers le haut).
            </Step>
            <Step number={3}>
              Fais défiler la liste vers le bas et appuie sur{' '}
              <span className="font-semibold text-violet-300">"Sur l'écran d'accueil"</span>.
            </Step>
            <Step number={4}>
              Appuie sur <span className="font-semibold text-violet-300">"Ajouter"</span> en haut à droite.
            </Step>
            <Step number={5}>
              CalSnap apparaît sur ton écran d'accueil comme une vraie app.
            </Step>
          </div>
          <div className="mt-4 bg-amber-900/20 border border-amber-700/30 rounded-xl px-3 py-2.5">
            <p className="text-xs text-amber-400 font-medium">
              Important : utilise bien Safari, pas Chrome ou Firefox — l'installation PWA n'est disponible que via Safari sur iOS.
            </p>
          </div>
        </div>

        {/* Bénéfices */}
        <div className="bg-[#1a1a2e] rounded-2xl p-5 shadow-xl">
          <h2 className="text-base font-bold text-white mb-3">Pourquoi installer l'app ?</h2>
          <div className="flex flex-col gap-2.5">
            {[
              ['⚡', 'Ouverture instantanée, sans passer par le navigateur'],
              ['📴', 'Fonctionne en mode hors-ligne (données locales)'],
              ['🖥', 'Affichage plein écran, sans barre d\'adresse'],
              ['🔔', 'Accès rapide depuis l\'écran d\'accueil'],
            ].map(([icon, text]) => (
              <div key={text} className="flex items-center gap-3">
                <span className="text-lg flex-shrink-0">{icon}</span>
                <p className="text-sm text-gray-300">{text}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
