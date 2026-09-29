import React, { useState, useEffect } from 'react';
import TournamentHub from './pages/TournamentHub';
import TeamLogin from './pages/TeamLogin';
import PublicDashboard from './pages/PublicDashboard';
import PlayerExplorer from './pages/PlayerExplorer';
import Admin from './pages/Admin';

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.hash.replace(/^#/, '') || '/');

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#/, '') || '/';
      setCurrentPath(hash);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (path) => {
    window.location.hash = path;
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Route matching:
  // /team-login/:eventCode (alias: /team-view/:eventCode)
  // /spectator/:eventCode (alias: /public-dashboard/:eventCode)
  // /players/:eventCode
  // /admin
  // /
  const cleanPath = currentPath.split('?')[0];
  const queryParams = new URLSearchParams(currentPath.includes('?') ? currentPath.split('?')[1] : window.location.search);
  const segments = cleanPath.split('/').filter(Boolean);
  const route = segments[0] || '';
  const paramEventCode = segments[1] || queryParams.get('event') || queryParams.get('code') || 'ESL2026';

  let pageContent = null;
  if (route === 'team-login' || route === 'team-view' || route === 'team_view') {
    pageContent = <TeamLogin eventCode={paramEventCode} onNavigate={navigate} />;
  } else if (route === 'spectator' || route === 'public-dashboard' || route === 'dashboard') {
    pageContent = <PublicDashboard eventCode={paramEventCode} onNavigate={navigate} />;
  } else if (route === 'players') {
    pageContent = <PlayerExplorer eventCode={paramEventCode} onNavigate={navigate} />;
  } else if (route === 'admin') {
    pageContent = <Admin eventCode={paramEventCode} onNavigate={navigate} />;
  } else {
    pageContent = <TournamentHub onNavigate={navigate} />;
  }

  const isHome = cleanPath === '/' || cleanPath === '';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar */}
      <nav className="glass-header" style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Brand */}
        <div 
          onClick={() => navigate('/')} 
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <span style={{ fontSize: '1.4rem' }}>🏏</span>
          <span style={{ fontFamily: 'Outfit', fontSize: '1.35rem', fontWeight: 800, color: '#FFFFFF' }}>
            Cric<span style={{ color: '#F59E0B' }}>Bid</span>
          </span>
        </div>
      </nav>

      {/* Main Content */}
      <main style={{ flex: 1 }}>
        {pageContent}
      </main>

      {/* Footer */}
      <footer style={{
        padding: '24px',
        textAlign: 'center',
        borderTop: '1px solid var(--border-subtle)',
        fontSize: '0.8rem',
        color: 'var(--slate-500)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        flexWrap: 'wrap'
      }}>
        <span>CricBid © 2026 — Modern Multi-Tournament Live Cricket Auction System.</span>
        <button 
          onClick={() => navigate('/admin')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--slate-500)',
            cursor: 'pointer',
            fontSize: '0.78rem',
            textDecoration: 'underline',
            padding: 0
          }}
        >
          ⚙️ Admin Console
        </button>
      </footer>
    </div>
  );
}
