import React, { useState, useEffect } from 'react';
import { listenPlayers, listenAuctionLog, formatNum } from '../services/api';

export default function PlayerExplorer({ eventCode = 'ESL2026', onNavigate }) {
  const currentEvent = (eventCode || 'ESL2026').toUpperCase();

  const [players, setPlayers] = useState([]);
  const [auctionLog, setAuctionLog] = useState({ sold: [], unsold: [] });
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  useEffect(() => {
    let unsubPlayers = () => {};
    let unsubLog = () => {};

    listenPlayers(currentEvent, list => setPlayers(list)).then(u => { unsubPlayers = u; });
    listenAuctionLog(currentEvent, log => setAuctionLog(log)).then(u => { unsubLog = u; });

    return () => {
      unsubPlayers();
      unsubLog();
    };
  }, [currentEvent]);

  // Filtering
  const filtered = players.filter(p => {
    const name = (p.Name || p.name || '').toLowerCase();
    const club = (p.Club || p.club || '').toLowerCase();
    const bat = (p['Batting Profile'] || p.battingProfile || '').toLowerCase();
    const bowl = (p['Bowling Profile'] || p.bowlingProfile || '').toLowerCase();
    const isWk = (p['Are you a wicket keeper?'] || p.wicketKeeper || '').toLowerCase() === 'yes';

    // Search query
    const q = search.toLowerCase();
    const matchesSearch = !q || name.includes(q) || club.includes(q) || bat.includes(q) || bowl.includes(q);
    if (!matchesSearch) return false;

    // Role filter
    if (roleFilter === 'WK' && !isWk) return false;
    if (roleFilter === 'BATSMAN' && (bowl && bowl !== 'none')) return false;
    if (roleFilter === 'BOWLER' && (!bowl || bowl === 'none')) return false;
    if (roleFilter === 'ALLROUNDER' && (!bowl || bowl === 'none' || !bat)) return false;

    // Status filter
    const isSold = (auctionLog.sold || []).some(s => (s.player || '').toLowerCase() === name);
    const isUnsold = (auctionLog.unsold || []).some(s => (s.player || '').toLowerCase() === name);

    if (statusFilter === 'SOLD' && !isSold) return false;
    if (statusFilter === 'UNSOLD' && !isUnsold) return false;
    if (statusFilter === 'AVAILABLE' && (isSold || isUnsold)) return false;

    return true;
  });

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 20px' }}>
      {/* Header */}
      <div className="glass-panel" style={{
        padding: '16px 24px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ fontSize: '1.4rem', color: '#FFFFFF', margin: 0 }}>
            🏃 Registered Players
          </h1>
          <span className="badge badge-event">{currentEvent}</span>
          <span className="badge badge-gold">{filtered.length} Players</span>
        </div>

        <div>
          <button onClick={() => onNavigate('/')} className="btn btn-outline btn-sm">
            ← Tournament Hub
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1', minWidth: '240px' }}>
          <input 
            type="text" 
            placeholder="🔍 Search by player name, club, role..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div style={{ width: '160px' }}>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="ALL">All Roles</option>
            <option value="BATSMAN">Batsmen</option>
            <option value="BOWLER">Bowlers</option>
            <option value="ALLROUNDER">All-Rounders</option>
            <option value="WK">Wicket Keepers</option>
          </select>
        </div>

        <div style={{ width: '160px' }}>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="ALL">All Statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="SOLD">Sold</option>
            <option value="UNSOLD">Unsold</option>
          </select>
        </div>
      </div>

      {/* Players Grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--slate-500)' }}>
          No players match current filters.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
          {filtered.map((p, idx) => {
            const name = p.Name || p.name || 'Unknown';
            const photo = p.Photo || p.photoUrl || '';
            const isSold = (auctionLog.sold || []).find(s => (s.player || '').toLowerCase() === name.toLowerCase());

            return (
              <div key={idx} className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', gap: '14px', marginBottom: '14px', alignItems: 'center' }}>
                  <div 
                    onClick={() => photo && setSelectedPhoto(photo)}
                    style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      background: '#0F172A',
                      flexShrink: 0,
                      cursor: photo ? 'pointer' : 'default',
                      border: '1px solid var(--border-medium)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {photo ? (
                      <img src={photo} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontWeight: 800, color: 'var(--slate-400)' }}>{name[0]}</span>
                    )}
                  </div>

                  <div>
                    <h3 style={{ fontSize: '1.05rem', color: '#FFFFFF', marginBottom: '4px' }}>{name}</h3>
                    <div style={{ fontSize: '0.78rem', color: 'var(--slate-400)' }}>
                      Club: <strong style={{ color: 'var(--slate-200)' }}>{p.Club || p.club || 'General'}</strong>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  {p['Batting Profile'] && <span className="badge badge-event" style={{ fontSize: '0.68rem' }}>🏏 {p['Batting Profile']}</span>}
                  {p['Bowling Profile'] && <span className="badge badge-live" style={{ fontSize: '0.68rem' }}>🎯 {p['Bowling Profile']}</span>}
                  {p['Are you a wicket keeper?'] === 'Yes' && <span className="badge badge-gold" style={{ fontSize: '0.68rem' }}>🧤 WK</span>}
                </div>

                <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--slate-400)' }}>Base Price</span>
                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#F59E0B' }}>
                      ₹{Number(p.BasePrice || p['Base Price'] || p.basePrice || p['Ticket Price'] || 10000).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div>
                    {isSold ? (
                      <span className="badge badge-live">Sold to {isSold.team}</span>
                    ) : (
                      <span className="badge badge-event">Available</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Modal */}
      {selectedPhoto && (
        <div 
          onClick={() => setSelectedPhoto(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div style={{ maxWidth: '480px', width: '100%', position: 'relative' }}>
            <img src={selectedPhoto} alt="Player" style={{ width: '100%', borderRadius: '16px', boxShadow: 'var(--shadow-lg)' }} />
          </div>
        </div>
      )}
    </div>
  );
}
