// src/pages/GoogleFitCallback.jsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { handleCallback } from '../lib/googleFit'

export default function GoogleFitCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading') // 'loading' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const error = params.get('error')
    const state = params.get('state')

    if (error) {
      setErrorMessage(
        error === 'access_denied'
          ? "Accès refusé. Vous avez annulé la connexion à Google Fit."
          : `Erreur Google : ${error}`
      )
      setStatus('error')
      return
    }

    if (!code) {
      setErrorMessage("Aucun code d'autorisation reçu. Veuillez réessayer.")
      setStatus('error')
      return
    }

    // APK flow : relayer le code vers le custom scheme pour que l'app le reçoive
    // via appUrlOpen (le code_verifier est dans le localStorage du WebView Capacitor)
    if (state === 'calsnap_apk') {
      window.location.replace(
        `com.wmaurice.calsnap://auth/google/callback?code=${encodeURIComponent(code)}`
      )
      return
    }

    handleCallback(code)
      .then(() => {
        setStatus('success')
        setTimeout(() => navigate('/integrations'), 1500)
      })
      .catch((err) => {
        setErrorMessage(err.message || 'Une erreur inattendue est survenue.')
        setStatus('error')
      })
  }, [navigate])

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: '#0f0f1a' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 flex flex-col items-center gap-6 text-center"
        style={{ backgroundColor: '#1a1a2e', border: '1px solid #2d2d44' }}
      >
        {/* Logo Google Fit */}
        <div className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ backgroundColor: '#1e3a5f' }}>
          <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none">
            <path
              d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z"
              fill="#4285F4"
            />
            <path
              d="M8 12l3 3 5-6"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {status === 'loading' && (
          <>
            <div
              className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: '#6d28d9', borderTopColor: 'transparent' }}
            />
            <div>
              <p className="text-white font-semibold text-lg">Connexion en cours…</p>
              <p className="text-gray-400 text-sm mt-1">
                Échange du token avec Google
              </p>
            </div>
          </>
        )}

        {status === 'success' && (
          <>
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#14532d' }}
            >
              <span className="text-3xl">✅</span>
            </div>
            <div>
              <p className="text-white font-semibold text-lg">
                Google Fit connecté !
              </p>
              <p className="text-gray-400 text-sm mt-1">
                Redirection vers les intégrations…
              </p>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#450a0a' }}
            >
              <span className="text-3xl">❌</span>
            </div>
            <div>
              <p className="text-white font-semibold text-lg">Connexion échouée</p>
              <p className="text-red-400 text-sm mt-2">{errorMessage}</p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="mt-2 px-6 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ backgroundColor: '#2d2d44', color: '#a78bfa' }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = '#3d3d5c')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = '#2d2d44')
              }
            >
              ← Retour à l'accueil
            </button>
          </>
        )}
      </div>
    </div>
  )
}
