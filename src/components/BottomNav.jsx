// src/components/BottomNav.jsx
import { NavLink } from 'react-router-dom';

const tabs = [
  {
    to: '/',
    label: 'Accueil',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'}
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="w-6 h-6">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    to: '/repas',
    label: 'Repas',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="w-6 h-6">
        <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
        <path d="M16 2v5M8 2v5" />
        <circle cx="12" cy="14" r="3" fill={active ? 'currentColor' : 'none'} />
        <path d="M21 2l-1 1" />
      </svg>
    ),
  },
  {
    to: '/activites',
    label: 'Activités',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="w-6 h-6">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    to: '/stats',
    label: 'Stats',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="w-6 h-6">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
        {active && (
          <>
            <rect x="15" y="10" width="6" height="10" rx="1" fill="currentColor" stroke="none" />
            <rect x="9" y="4" width="6" height="16" rx="1" fill="currentColor" stroke="none" />
            <rect x="3" y="14" width="6" height="6" rx="1" fill="currentColor" stroke="none" />
          </>
        )}
      </svg>
    ),
  },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50
                    bg-[#1a1a2e] border-t border-white/10
                    flex items-center justify-around
                    pb-safe" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}>
      {tabs.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition-colors duration-200
             ${isActive ? 'text-violet-400' : 'text-gray-500 hover:text-gray-300'}`
          }
        >
          {({ isActive }) => (
            <>
              {icon(isActive)}
              <span className="text-[10px] font-medium tracking-wide">{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
