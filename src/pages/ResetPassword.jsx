// src/pages/ResetPassword.jsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false) // true quand le token PASSWORD_RECOVERY est détecté
  const [expired, setExpired] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    // Supabase détecte automatiquement les tokens dans le hash fragment (#access_token=...)
    // et émet l'event PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })

    // Si PASSWORD_RECOVERY n'est pas émis dans les 10s, le lien est expiré
    const timeout = setTimeout(() => {
      setExpired(true)
    }, 10000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  function translateError(msg) {
    if (!msg) return ''
    if (msg.includes('Password should be at least'))
      return 'Le mot de passe doit contenir au moins 6 caractères.'
    if (msg.includes('same password'))
      return 'Le nouveau mot de passe doit être différent de l\'ancien.'
    if (msg.includes('Auth session missing') || msg.includes('invalid'))
      return 'Lien expiré ou invalide. Veuillez refaire une demande de réinitialisation.'
    return 'Une erreur est survenue. Réessaie.'
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setMessage('')

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.')
      return
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setError(translateError(error.message))
      } else {
        setMessage('✅ Mot de passe mis à jour !')
        timerRef.current = setTimeout(() => navigate('/'), 2000)
      }
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full rounded-xl bg-[#22223b] border border-[#3d3d5c] text-white px-4 py-3 text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition'

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: '#0f0f1a' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 shadow-2xl"
        style={{ backgroundColor: '#1a1a2e' }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center mb-3 shadow-lg shadow-indigo-900/40">
            <span className="text-white text-2xl font-black">C</span>
          </div>
          <h1 className="text-white text-2xl font-bold tracking-tight">CalSnap</h1>
          <p className="text-gray-400 text-xs mt-1">Ton journal nutritionnel</p>
        </div>

        <h2 className="text-white text-lg font-semibold mb-2 text-center">
          Nouveau mot de passe
        </h2>

        {expired ? (
          // Lien expiré : timeout de 10s sans événement PASSWORD_RECOVERY
          <div className="text-center py-6">
            <p className="text-red-400 text-sm font-medium mb-2">Lien expiré ou invalide.</p>
            <p className="text-gray-400 text-xs mb-4">
              Ce lien de réinitialisation n'est plus valide.
            </p>
            <button
              onClick={() => navigate('/')}
              className="text-indigo-400 hover:text-indigo-300 underline text-sm transition"
            >
              Refaire une demande
            </button>
          </div>
        ) : !ready ? (
          // En attente de la détection du token
          <div className="text-center py-6">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mx-auto mb-4" />
            <p className="text-gray-400 text-sm">Vérification du lien en cours…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">
                Nouveau mot de passe
              </label>
              <input
                type="password"
                required
                className={inputClass}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">
                Confirmer le mot de passe
              </label>
              <input
                type="password"
                required
                className={inputClass}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            {/* Message d'erreur */}
            {error && (
              <p className="text-red-400 text-xs bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-2.5">
                {error}
              </p>
            )}

            {/* Message de succès */}
            {message && (
              <p className="text-emerald-400 text-xs bg-emerald-900/20 border border-emerald-800/40 rounded-xl px-4 py-2.5">
                {message} Redirection en cours…
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !!message}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2 text-sm shadow-lg shadow-indigo-900/30"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Mise à jour…
                </>
              ) : (
                'Mettre à jour'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
