// src/App.jsx
import { Routes, Route, useLocation } from 'react-router-dom';
import { useAuth } from './lib/AuthContext';
import BottomNav from './components/BottomNav';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Repas from './pages/Repas';
import Activites from './pages/Activites';
import Stats from './pages/Stats';
import Aliments from './pages/Aliments';
import Historique from './pages/Historique';
import Poids from './pages/Poids';
import Auth from './pages/Auth';
import Migration from './pages/Migration';

const NO_NAV_ROUTES = ['/profil', '/aliments', '/migration'];

export default function App() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const showNav = !NO_NAV_ROUTES.includes(pathname);

  // Vérification de session en cours
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: '#0f0f1a' }}
      >
        <svg
          className="animate-spin h-10 w-10 text-indigo-500"
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
      </div>
    );
  }

  // Non authentifié : afficher la page d'auth
  if (!user) {
    return <Auth />;
  }

  // Authentifié : afficher l'application normale
  return (
    <>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/profil" element={<Profile />} />
        <Route path="/repas" element={<Repas />} />
        <Route path="/activites" element={<Activites />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/aliments" element={<Aliments />} />
        <Route path="/historique" element={<Historique />} />
        <Route path="/poids" element={<Poids />} />
        <Route path="/migration" element={<Migration />} />
      </Routes>
      {showNav && <BottomNav />}
    </>
  );
}
