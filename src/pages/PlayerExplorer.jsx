import React, { useState, useEffect, useMemo } from 'react';
import { listenPlayers, listenAuctionLog, listenTeams, formatNum } from '../services/api';
import ImageWithFallback from '../components/ImageWithFallback';
import PlayerProfileCard from '../components/PlayerProfileCard';

function cleanName(n) {
  return String(n || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function getPlayerRole(p) {
  const explicitRole = String(p.Role || p.role || p['Player Role'] || p.Category || p['Player Category'] || '').trim().toLowerCase();
  const isWk = String(p['Are you a wicket keeper?'] || p.wicketKeeper || p['Wicket Keeper'] || '').trim().toLowerCase() === 'yes';
  const batPos = String(p['Batting position'] || p.battingPosition || '').trim().toLowerCase();
  const batStyle = String(p['Batting Profile'] || p.battingProfile || '').trim().toLowerCase();
  const bowlStyle = String(p['Bowling Profile'] || p.bowlingProfile || '').trim().toLowerCase();
  const hasBowling = bowlStyle && bowlStyle !== 'none' && !bowlStyle.includes('not applicable');

  // 1. Explicit Role or Wicket Keeper
  if (isWk || explicitRole.includes('wk') || explicitRole.includes('keeper')) {
    return 'WK';
  }
  if (explicitRole.includes('bowler')) {
    return 'BOWLER';
  }
  if (explicitRole.includes('all-rounder') || explicitRole.includes('allrounder')) {
    return 'ALLROUNDER';
  }
  if (explicitRole.includes('batsman') || explicitRole.includes('batter')) {
    return 'BATSMAN';
  }

  // 2. Infer from Batting position and Bowling profile
  if (!hasBowling) {
    return 'BATSMAN';
  }
  if (batPos.includes('lower')) {
    return 'BOWLER';
  }
  if (batPos.includes('top') || batPos.includes('open')) {
    return 'BATSMAN';
  }
  if (batPos.includes('middle')) {
    return 'ALLROUNDER';
  }

  // Fallback
  return hasBowling && batStyle ? 'ALLROUNDER' : (hasBowling ? 'BOWLER' : 'BATSMAN');
}

export default function PlayerExplorer({ eventCode = 'ESL2026', onNavigate }) {
  const currentEvent = (eventCode || 'ESL2026').toUpperCase();

  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [auctionLog, setAuctionLog] = useState({ sold: [], unsold: [] });
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  useEffect(() => {
    let unsubPlayers = () => {};
    let unsubTeams = () => {};
    let unsubLog = () => {};

    listenPlayers(currentEvent, list => setPlayers(list || [])).then(u => { unsubPlayers = u; });
    listenTeams(currentEvent, list => setTeams(list || [])).then(u => { unsubTeams = u; });
    listenAuctionLog(currentEvent, log => setAuctionLog(log || { sold: [], unsold: [] })).then(u => { unsubLog = u; });

    return () => {
      unsubPlayers();
      unsubTeams();
      unsubLog();
    };
  }, [currentEvent]);

  // Pre-assigned Maps: Owners, Icons, Retained
  const { ownerMap, iconMap, retainedMap } = useMemo(() => {
    const oMap = new Map();
    const iMap = new Map();
    const rMap = new Map();

    (teams || []).forEach(t => {
      const teamName = t.teamName || 'Unknown Team';

      // 1. Owners
      const owners = Array.isArray(t.owners)
        ? t.owners
        : (t.ownerName ? [t.ownerName] : []);
      owners.forEach(o => {
        const cn = cleanName(o);
        if (cn) oMap.set(cn, { team: teamName, role: 'Owner' });
      });

      // 2. Icon Players
      const icons = Array.isArray(t.iconPlayers)
        ? t.iconPlayers
        : (t.iconPlayer ? [t.iconPlayer] : []);
      icons.forEach(i => {
        const cn = cleanName(i);
        if (cn) iMap.set(cn, { team: teamName, role: 'Icon' });
      });

      // 3. Retained Players
      const retained = Array.isArray(t.retainedPlayers)
        ? t.retainedPlayers
        : (t.retainedPlayer ? [t.retainedPlayer] : []);
      retained.forEach(r => {
        const cn = cleanName(r);
        if (cn) rMap.set(cn, { team: teamName, role: 'Retained' });
      });
    });

    return { ownerMap: oMap, iconMap: iMap, retainedMap: rMap };
  }, [teams]);

  // Auction Log Maps: Sold & Unsold
  const { soldMap, unsoldSet } = useMemo(() => {
    const sMap = new Map();
    const uSet = new Set();

    const rawSold = auctionLog && auctionLog.sold
      ? (Array.isArray(auctionLog.sold) ? auctionLog.sold : Object.values(auctionLog.sold))
      : [];
    const rawUnsold = auctionLog && auctionLog.unsold
      ? (Array.isArray(auctionLog.unsold) ? auctionLog.unsold : Object.values(auctionLog.unsold))
      : [];

    rawSold.forEach(s => {
      const pName = cleanName(s.playerName || s.player || s.name || s.Name);
      if (pName) {
        sMap.set(pName, {
          team: s.team || s.teamName || s.winningTeam || 'Unknown Team',
          price: s.price !== undefined ? Number(s.price) : Number(s.soldPrice || 0),
          raw: s
        });
      }
    });

    rawUnsold.forEach(u => {
      const pName = cleanName(u.playerName || u.player || u.name || u.Name);
      if (pName) {
        uSet.add(pName);
      }
    });

    return { soldMap: sMap, unsoldSet: uSet };
  }, [auctionLog]);

  // Status Summary Counts
  const stats = useMemo(() => {
    let available = 0;
    let sold = 0;
    let unsold = 0;
    let owners = 0;

    players.forEach(p => {
      const cn = cleanName(p.Name || p.name);
      if (soldMap.has(cn)) {
        sold++;
      } else if (unsoldSet.has(cn)) {
        unsold++;
      } else if (ownerMap.has(cn) || iconMap.has(cn) || retainedMap.has(cn)) {
        owners++;
      } else {
        available++;
      }
    });

    return {
      total: players.length,
      available,
      sold,
      unsold,
      owners
    };
  }, [players, soldMap, unsoldSet, ownerMap, iconMap, retainedMap]);

  // Filtering Logic
  const filtered = useMemo(() => {
    return players.filter(p => {
      const name = p.Name || p.name || '';
      const cn = cleanName(name);
      const club = (p.Club || p.club || '').toLowerCase();
      const batStyle = (p['Batting Profile'] || p.battingProfile || '').toLowerCase();
      const bowlStyle = (p['Bowling Profile'] || p.bowlingProfile || '').toLowerCase();
      const batPos = (p['Batting position'] || p.battingPosition || '').toLowerCase();
      const isWk = String(p['Are you a wicket keeper?'] || p.wicketKeeper || '').toLowerCase() === 'yes';

      const soldInfo = soldMap.get(cn);
      const isUnsold = unsoldSet.has(cn);
      const ownerInfo = ownerMap.get(cn);
      const iconInfo = iconMap.get(cn);
      const retainedInfo = retainedMap.get(cn);
      const preassignedInfo = ownerInfo || iconInfo || retainedInfo;

      const playerRole = getPlayerRole(p);

      // 1. Search Query
      const q = search.trim().toLowerCase();
      if (q) {
        const matchesSearch =
          name.toLowerCase().includes(q) ||
          club.includes(q) ||
          batStyle.includes(q) ||
          bowlStyle.includes(q) ||
          batPos.includes(q) ||
          playerRole.toLowerCase().includes(q) ||
          (soldInfo && soldInfo.team.toLowerCase().includes(q)) ||
          (ownerInfo && ownerInfo.team.toLowerCase().includes(q));

        if (!matchesSearch) return false;
      }

      // 2. Role Filter
      if (roleFilter !== 'ALL') {
        if (roleFilter === 'WK' && !isWk && playerRole !== 'WK') return false;
        if (roleFilter === 'BATSMAN' && playerRole !== 'BATSMAN') return false;
        if (roleFilter === 'BOWLER' && playerRole !== 'BOWLER') return false;
        if (roleFilter === 'ALLROUNDER' && playerRole !== 'ALLROUNDER') return false;
      }

      // 3. Status Filter
      if (statusFilter === 'AVAILABLE') {
        // Owners, icons, retained, sold, and unsold players must NOT be in Available!
        if (soldInfo || isUnsold || preassignedInfo) return false;
      } else if (statusFilter === 'SOLD') {
        if (!soldInfo) return false;
      } else if (statusFilter === 'UNSOLD') {
        if (!isUnsold) return false;
      } else if (statusFilter === 'OWNER') {
        if (!preassignedInfo) return false;
      }

      return true;
    });
  }, [players, search, roleFilter, statusFilter, soldMap, unsoldSet, ownerMap, iconMap, retainedMap]);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 20px' }}>
      {/* Header */}
      <div className="glass-panel" style={{
        padding: '18px 24px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: '1.4rem', color: '#FFFFFF', margin: 0, fontFamily: 'Outfit', fontWeight: 800 }}>
            🏃 Registered Players
          </h1>
          <span className="badge badge-event">{currentEvent}</span>
          <span className="badge badge-gold">{filtered.length} Displayed</span>
        </div>

        <div>
          <button onClick={() => onNavigate('/')} className="btn btn-outline btn-sm">
            ← Tournament Hub
          </button>
        </div>
      </div>

      {/* Quick Status Chips */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <button
          onClick={() => setStatusFilter('ALL')}
          className="badge"
          style={{
            cursor: 'pointer',
            background: statusFilter === 'ALL' ? 'rgba(99, 102, 241, 0.4)' : 'rgba(255, 255, 255, 0.05)',
            color: statusFilter === 'ALL' ? '#FFFFFF' : 'var(--slate-300)',
            border: statusFilter === 'ALL' ? '1px solid #6366F1' : '1px solid var(--border-medium)',
            padding: '6px 14px',
            fontSize: '0.8rem',
            transition: 'all 0.2s ease'
          }}
        >
          All Players ({stats.total})
        </button>

        <button
          onClick={() => setStatusFilter('AVAILABLE')}
          className="badge"
          style={{
            cursor: 'pointer',
            background: statusFilter === 'AVAILABLE' ? 'rgba(99, 102, 241, 0.35)' : 'rgba(99, 102, 241, 0.1)',
            color: statusFilter === 'AVAILABLE' ? '#A5B4FC' : 'var(--slate-300)',
            border: statusFilter === 'AVAILABLE' ? '1px solid #818CF8' : '1px solid rgba(99, 102, 241, 0.25)',
            padding: '6px 14px',
            fontSize: '0.8rem',
            transition: 'all 0.2s ease'
          }}
        >
          ✨ Available ({stats.available})
        </button>

        <button
          onClick={() => setStatusFilter('SOLD')}
          className="badge"
          style={{
            cursor: 'pointer',
            background: statusFilter === 'SOLD' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(16, 185, 129, 0.1)',
            color: statusFilter === 'SOLD' ? '#34D399' : 'var(--slate-300)',
            border: statusFilter === 'SOLD' ? '1px solid #10B981' : '1px solid rgba(16, 185, 129, 0.25)',
            padding: '6px 14px',
            fontSize: '0.8rem',
            transition: 'all 0.2s ease'
          }}
        >
          🏆 Sold ({stats.sold})
        </button>

        <button
          onClick={() => setStatusFilter('UNSOLD')}
          className="badge"
          style={{
            cursor: 'pointer',
            background: statusFilter === 'UNSOLD' ? 'rgba(239, 68, 68, 0.35)' : 'rgba(239, 68, 68, 0.1)',
            color: statusFilter === 'UNSOLD' ? '#F87171' : 'var(--slate-300)',
            border: statusFilter === 'UNSOLD' ? '1px solid #EF4444' : '1px solid rgba(239, 68, 68, 0.25)',
            padding: '6px 14px',
            fontSize: '0.8rem',
            transition: 'all 0.2s ease'
          }}
        >
          ❌ Unsold ({stats.unsold})
        </button>

        <button
          onClick={() => setStatusFilter('OWNER')}
          className="badge"
          style={{
            cursor: 'pointer',
            background: statusFilter === 'OWNER' ? 'rgba(245, 158, 11, 0.35)' : 'rgba(245, 158, 11, 0.1)',
            color: statusFilter === 'OWNER' ? '#FBBF24' : 'var(--slate-300)',
            border: statusFilter === 'OWNER' ? '1px solid #F59E0B' : '1px solid rgba(245, 158, 11, 0.25)',
            padding: '6px 14px',
            fontSize: '0.8rem',
            transition: 'all 0.2s ease'
          }}
        >
          👑 Owners / Pre-assigned ({stats.owners})
        </button>
      </div>

      {/* Search and Dropdown Filters */}
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1', minWidth: '240px' }}>
          <input 
            type="text" 
            placeholder="🔍 Search by player name, club, role, team..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div style={{ width: '180px' }}>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="ALL">All Roles</option>
            <option value="BATSMAN">🏏 Batsmen</option>
            <option value="BOWLER">🎯 Bowlers</option>
            <option value="ALLROUNDER">⚡ All-Rounders</option>
            <option value="WK">🧤 Wicket Keepers</option>
          </select>
        </div>

        <div style={{ width: '210px' }}>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="ALL">All Statuses ({stats.total})</option>
            <option value="AVAILABLE">✨ Available ({stats.available})</option>
            <option value="SOLD">🏆 Sold ({stats.sold})</option>
            <option value="UNSOLD">❌ Unsold ({stats.unsold})</option>
            <option value="OWNER">👑 Owners / Pre-assigned ({stats.owners})</option>
          </select>
        </div>
      </div>

      {/* Players Grid */}
      {filtered.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--slate-400)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🔍</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '6px' }}>No players found</div>
          <p style={{ fontSize: '0.88rem', margin: '0 0 16px 0' }}>No registered players match the current search or filters.</p>
          <button 
            onClick={() => { setSearch(''); setRoleFilter('ALL'); setStatusFilter('ALL'); }}
            className="btn btn-outline btn-sm"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
          {filtered.map((p, idx) => {
            const name = p.Name || p.name || 'Unknown';
            const cn = cleanName(name);
            const rawPhoto = p.Photo || p.photoUrl || '';
            const club = p.Club || p.club || '';
            const batStyle = p['Batting Profile'] || p.battingProfile || '';
            const bowlStyle = p['Bowling Profile'] || p.bowlingProfile || '';
            const batPos = p['Batting position'] || p.battingPosition || '';
            const isWk = String(p['Are you a wicket keeper?'] || p.wicketKeeper || '').toLowerCase() === 'yes';

            const soldInfo = soldMap.get(cn);
            const isUnsold = unsoldSet.has(cn);
            const ownerInfo = ownerMap.get(cn);
            const iconInfo = iconMap.get(cn);
            const retainedInfo = retainedMap.get(cn);

            const playerRole = getPlayerRole(p);
            const basePrice = Number(p.BasePrice || p['Base Price'] || p.basePrice || p['Ticket Price'] || 10000);

            return (
              <div 
                key={idx} 
                className="glass-panel" 
                style={{ 
                  padding: '18px', 
                  display: 'flex', 
                  flexDirection: 'column',
                  transition: 'transform 0.2s ease, border-color 0.2s ease',
                  border: soldInfo 
                    ? '1px solid rgba(16, 185, 129, 0.4)' 
                    : ownerInfo 
                      ? '1px solid rgba(245, 158, 11, 0.4)' 
                      : '1px solid var(--border-medium)'
                }}
              >
                {/* Top Row: Photo + Header */}
                <div style={{ display: 'flex', gap: '14px', marginBottom: '14px', alignItems: 'center' }}>
                  <div 
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      background: '#0F172A',
                      flexShrink: 0,
                      cursor: rawPhoto ? 'pointer' : 'default',
                      border: '1px solid var(--border-medium)',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                    }}
                    title={rawPhoto ? 'Click to enlarge photo' : ''}
                    onClick={() => {
                      if (rawPhoto) setSelectedPhoto(rawPhoto);
                    }}
                  >
                    <ImageWithFallback
                      src={rawPhoto}
                      alt={name}
                      size="w600"
                      onClick={(fullSrc) => setSelectedPhoto(fullSrc)}
                    />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 
                      style={{ 
                        fontSize: '1.05rem', 
                        color: '#FFFFFF', 
                        margin: '0 0 4px 0', 
                        fontFamily: 'Outfit', 
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                      title={name}
                    >
                      {name}
                    </h3>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {club && (
                        <span style={{ fontSize: '0.74rem', color: club.toLowerCase() === 'home' ? '#34D399' : '#A5B4FC', fontWeight: 600 }}>
                          {club.toLowerCase() === 'home' ? '🏠 Home' : '✈️ Away'}
                        </span>
                      )}
                      <button
                        onClick={() => setSelectedPlayer(p)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#38BDF8',
                          fontSize: '0.74rem',
                          cursor: 'pointer',
                          padding: 0,
                          textDecoration: 'underline'
                        }}
                      >
                        View Profile
                      </button>
                    </div>
                  </div>
                </div>

                {/* Role and Attributes Badges */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
                  {/* Primary Role Badge */}
                  {playerRole === 'BATSMAN' && (
                    <span className="badge badge-event" style={{ fontSize: '0.7rem' }}>🏏 Batsman</span>
                  )}
                  {playerRole === 'BOWLER' && (
                    <span className="badge badge-live" style={{ fontSize: '0.7rem' }}>🎯 Bowler</span>
                  )}
                  {playerRole === 'ALLROUNDER' && (
                    <span className="badge badge-gold" style={{ fontSize: '0.7rem' }}>⚡ All-Rounder</span>
                  )}
                  {playerRole === 'WK' && (
                    <span className="badge badge-gold" style={{ fontSize: '0.7rem' }}>🧤 Wicket Keeper</span>
                  )}

                  {/* Skills & Attributes */}
                  {batStyle && (
                    <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--slate-300)', fontSize: '0.68rem', border: '1px solid var(--border-subtle)' }}>
                      {batStyle}
                    </span>
                  )}
                  {bowlStyle && bowlStyle.toLowerCase() !== 'none' && (
                    <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--slate-300)', fontSize: '0.68rem', border: '1px solid var(--border-subtle)' }}>
                      {bowlStyle}
                    </span>
                  )}
                  {batPos && (
                    <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--slate-400)', fontSize: '0.68rem', border: '1px solid var(--border-subtle)' }}>
                      📍 {batPos}
                    </span>
                  )}
                </div>

                {/* Card Footer: Price / Bid Amount & Status Badge */}
                <div style={{ 
                  marginTop: 'auto', 
                  paddingTop: '12px', 
                  borderTop: '1px solid var(--border-subtle)', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  {/* Price Section */}
                  {soldInfo ? (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: 600 }}>Winning Bid</span>
                      <span style={{ fontSize: '1rem', fontWeight: 800, color: '#10B981' }}>
                        {formatNum(soldInfo.price)}
                      </span>
                    </div>
                  ) : ownerInfo ? (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--slate-400)' }}>Team Assignment</span>
                      <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#F59E0B' }}>
                        Pre-assigned
                      </span>
                    </div>
                  ) : iconInfo ? (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--slate-400)' }}>Team Assignment</span>
                      <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#38BDF8' }}>
                        Pre-assigned
                      </span>
                    </div>
                  ) : retainedInfo ? (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--slate-400)' }}>Team Assignment</span>
                      <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#A78BFA' }}>
                        Pre-assigned
                      </span>
                    </div>
                  ) : isUnsold ? (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--slate-400)' }}>Base Price</span>
                      <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--slate-300)' }}>
                        {formatNum(basePrice)}
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--slate-400)' }}>Base Price</span>
                      <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#F59E0B' }}>
                        {formatNum(basePrice)}
                      </span>
                    </div>
                  )}

                  {/* Status Badge */}
                  <div>
                    {soldInfo ? (
                      <span 
                        className="badge" 
                        style={{ 
                          background: 'rgba(16, 185, 129, 0.18)', 
                          color: '#10B981', 
                          border: '1px solid rgba(16, 185, 129, 0.4)', 
                          fontWeight: 700, 
                          fontSize: '0.74rem',
                          padding: '4px 10px'
                        }}
                      >
                        🏆 Sold to {soldInfo.team}
                      </span>
                    ) : ownerInfo ? (
                      <span 
                        className="badge" 
                        style={{ 
                          background: 'rgba(245, 158, 11, 0.18)', 
                          color: '#F59E0B', 
                          border: '1px solid rgba(245, 158, 11, 0.4)', 
                          fontWeight: 700, 
                          fontSize: '0.74rem',
                          padding: '4px 10px'
                        }}
                      >
                        👑 Owner ({ownerInfo.team})
                      </span>
                    ) : iconInfo ? (
                      <span 
                        className="badge" 
                        style={{ 
                          background: 'rgba(56, 189, 248, 0.18)', 
                          color: '#38BDF8', 
                          border: '1px solid rgba(56, 189, 248, 0.4)', 
                          fontWeight: 700, 
                          fontSize: '0.74rem',
                          padding: '4px 10px'
                        }}
                      >
                        ⭐ Icon ({iconInfo.team})
                      </span>
                    ) : retainedInfo ? (
                      <span 
                        className="badge" 
                        style={{ 
                          background: 'rgba(167, 139, 250, 0.18)', 
                          color: '#A78BFA', 
                          border: '1px solid rgba(167, 139, 250, 0.4)', 
                          fontWeight: 700, 
                          fontSize: '0.74rem',
                          padding: '4px 10px'
                        }}
                      >
                        🔒 Retained ({retainedInfo.team})
                      </span>
                    ) : isUnsold ? (
                      <span 
                        className="badge" 
                        style={{ 
                          background: 'rgba(239, 68, 68, 0.18)', 
                          color: '#EF4444', 
                          border: '1px solid rgba(239, 68, 68, 0.4)', 
                          fontWeight: 700, 
                          fontSize: '0.74rem',
                          padding: '4px 10px'
                        }}
                      >
                        Unsold
                      </span>
                    ) : (
                      <span 
                        className="badge badge-event" 
                        style={{ 
                          fontWeight: 700, 
                          fontSize: '0.74rem',
                          padding: '4px 10px'
                        }}
                      >
                        Available
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Player Profile Modal */}
      {selectedPlayer && (
        <div 
          onClick={() => setSelectedPlayer(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(6px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div 
            onClick={e => e.stopPropagation()} 
            style={{ 
              maxWidth: '820px', 
              width: '100%', 
              maxHeight: '90vh', 
              overflowY: 'auto',
              position: 'relative' 
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
              <button 
                onClick={() => setSelectedPlayer(null)}
                className="btn btn-outline btn-sm"
                style={{ background: 'rgba(15, 23, 42, 0.9)', borderRadius: '50%', width: '36px', height: '36px', padding: 0 }}
              >
                ✕
              </button>
            </div>
            {/* Render full PlayerProfileCard with stats */}
            <PlayerProfileCard 
              player={selectedPlayer} 
              liveData={{
                baseValue: Number(selectedPlayer.BasePrice || selectedPlayer['Base Price'] || selectedPlayer.basePrice || selectedPlayer['Ticket Price'] || 10000)
              }} 
            />
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {selectedPhoto && (
        <div 
          onClick={() => setSelectedPhoto(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.88)',
            backdropFilter: 'blur(4px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div style={{ maxWidth: '480px', width: '100%', position: 'relative' }}>
            <img 
              src={selectedPhoto} 
              alt="Player" 
              referrerPolicy="no-referrer" 
              style={{ width: '100%', borderRadius: '16px', boxShadow: 'var(--shadow-lg)' }} 
            />
          </div>
        </div>
      )}
    </div>
  );
}
