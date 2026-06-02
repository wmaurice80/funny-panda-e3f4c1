// src/pages/Auth.jsx
import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'

export default function Auth() {
  const { signIn, signUp, resetPassword } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'register' | 'reset'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  function translateError(msg) {
    if (!msg) return ''
    if (msg.includes('Invalid login credentials')) return 'Email ou mot de passe incorrect.'
    if (msg.includes('Email not confirmed')) return 'Confirmez votre email avant de vous connecter.'
    if (msg.includes('User already registered') || msg.includes('already been registered'))
      return 'Cet email est déjà utilisé.'
    if (msg.includes('Password should be at least'))
      return 'Le mot de passe doit contenir au moins 6 caractères.'
    if (msg.includes('Unable to validate email address'))
      return 'Adresse email invalide.'
    if (msg.includes('For security purposes')) return 'Trop de tentatives. Réessayez dans quelques minutes.'
    return msg
  }

  function resetForm() {
    setError('')
    setMessage('')
    setPassword('')
    setConfirmPassword('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setMessage('')

    if (mode === 'register' && password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password)
        if (error) setError(translateError(error.message))
      } else if (mode === 'register') {
        const { error } = await signUp(email, password)
        if (error) {
          setError(translateError(error.message))
        } else {
          setMessage('Compte créé ! Vérifiez votre email pour confirmer votre inscription, puis connectez-vous.')
        }
      } else if (mode === 'reset') {
        const { error } = await resetPassword(email)
        if (error) {
          setError(translateError(error.message))
        } else {
          setMessage(`📧 Un lien de réinitialisation a été envoyé à ${email}`)
        }
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

        {/* Titre du mode */}
        <h2 className="text-white text-lg font-semibold mb-6 text-center">
          {mode === 'login' && 'Connexion'}
          {mode === 'register' && 'Créer un compte'}
          {mode === 'reset' && 'Réinitialiser le mot de passe'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Adresse email</label>
            <input
              type="email"
              required
              className={inputClass}
              placeholder="toi@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          {/* Password (login + register) */}
          {mode !== 'reset' && (
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Mot de passe</label>
              <input
                type="password"
                required
                className={inputClass}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              />
            </div>
          )}

          {/* Confirm password (register only) */}
          {mode === 'register' && (
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
          )}

          {/* Message d'erreur */}
          {error && (
            <p className="text-red-400 text-xs bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-2.5">
              {error}
            </p>
          )}

          {/* Message de succès */}
          {message && (
            <p className="text-emerald-400 text-xs bg-emerald-900/20 border border-emerald-800/40 rounded-xl px-4 py-2.5">
              {message}
            </p>
          )}

          {/* Bouton principal */}
          <button
            type="submit"
            disabled={loading}
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
                Chargement…
              </>
            ) : (
              <>
                {mode === 'login' && 'Se connecter'}
                {mode === 'register' && 'Créer mon compte'}
                {mode === 'reset' && 'Envoyer le lien'}
              </>
            )}
          </button>
        </form>

        {/* Liens de navigation entre modes */}
        <div className="mt-6 space-y-2 text-center text-xs">
          {mode === 'login' && (
            <>
              <button
                onClick={() => { setMode('reset'); resetForm() }}
                className="block w-full text-gray-400 hover:text-indigo-400 transition"
              >
                Mot de passe oublié ?
              </button>
              <button
                onClick={() => { setMode('register'); resetForm() }}
                className="block w-full text-indigo-400 hover:text-indigo-300 font-medium transition"
              >
                Créer un compte
              </button>
            </>
          )}
          {(mode === 'register' || mode === 'reset') && (
            <button
              onClick={() => { setMode('login'); resetForm() }}
              className="block w-full text-gray-400 hover:text-indigo-400 transition"
            >
              ← Retour à la connexion
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
