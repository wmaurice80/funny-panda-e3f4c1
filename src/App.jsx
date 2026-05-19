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

function Spinner({ label }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4"
      style={{ backgroundColor: '#0f0f1a' }}>
      <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      {label && <p className="text-sm text-gray-400">{label}</p>}
    </div>
  );
}

export default function App() {
  const { user, loading, syncing } = useAuth();
  const { pathname } = useLocation();
  const showNav = !NO_NAV_ROUTES.includes(pathname);

  if (loading) return <Spinner />;
  if (syncing) return <Spinner label="Synchronisation des données…" />

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
