import React, { useState, useEffect } from 'react';
import { 
  authenticateTeam, 
  listenLiveAuction, 
  listenTimer, 
  listenTeams, 
  listenAuctionLog,
  getDb,
  formatNum,
  formatImageUrl,
  getDriveFileId
} from '../services/api';

export default function TeamLogin({ eventCode = 'ESL2026', onNavigate }) {
  const currentEvent = (eventCode || 'ESL2026').toUpperCase();

  // Authentication State
  const [loggedInTeam, setLoggedInTeam] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Live Auction State
  const [liveData, setLiveData] = useState(null);
  const [timerData, setTimerData] = useState(null);
  const [allTeams, setAllTeams] = useState([]);
  const [auctionLog, setAuctionLog] = useState({ sold: [], unsold: [] });
  const [bidAmount, setBidAmount] = useState('');

  // Check existing session
  useEffect(() => {
    try {
      const sess = sessionStorage.getItem(`cricbid_team_${currentEvent}`);
      if (sess) {
        const parsed = JSON.parse(sess);
        if (parsed && (parsed.eventCode || currentEvent) === currentEvent) {
          setLoggedInTeam(parsed);
        }
      }
    } catch (e) {}
  }, [currentEvent]);

  // Realtime Listeners for Live Auction
  useEffect(() => {
    if (!loggedInTeam) return;

    let unsubLive = () => {};
    let unsubTimer = () => {};
    let unsubTeams = () => {};
    let unsubLog = () => {};

    listenLiveAuction(currentEvent, data => setLiveData(data)).then(u => { unsubLive = u; });
    listenTimer(currentEvent, data => setTimerData(data)).then(u => { unsubTimer = u; });
    listenTeams(currentEvent, list => setAllTeams(list)).then(u => { unsubTeams = u; });
    listenAuctionLog(currentEvent, log => setAuctionLog(log)).then(u => { unsubLog = u; });

    return () => {
      unsubLive();
      unsubTimer();
      unsubTeams();
      unsubLog();
    };
  }, [loggedInTeam, currentEvent]);

  // Keep my team's purse and roster synchronized with allTeams
  const currentTeamInfo = allTeams.find(t => 
    loggedInTeam && (t.teamName || '').toLowerCase() === (loggedInTeam.teamName || '').toLowerCase()
  ) || loggedInTeam;

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setLoginError('Please enter username and password');
      return;
    }

    setLoggingIn(true);
    setLoginError('');

    try {
      const res = await authenticateTeam(currentEvent, username, password);
      if (res.success && res.team) {
        setLoggedInTeam(res.team);
        sessionStorage.setItem(`cricbid_team_${currentEvent}`, JSON.stringify(res.team));
      } else {
        setLoginError(res.error || `Invalid credentials for tournament ${currentEvent}`);
      }
    } catch (err) {
      setLoginError(err.message || 'Login failed');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(`cricbid_team_${currentEvent}`);
    setLoggedInTeam(null);
    setUsername('');
    setPassword('');
  };

  const handlePlaceBid = async (inc = 10000) => {
    if (!liveData || !liveData.currentPlayer) return;
    const currentBid = Number(liveData.currentBid || liveData.baseValue || 10000);
    const newBid = currentBid + inc;

    if (currentTeamInfo && currentTeamInfo.purseRemaining < newBid) {
      alert('Insufficient purse to place this bid!');
      return;
    }

    const db = await getDb();
    if (db) {
      try {
        await db.ref(`auctions/${currentEvent}/live`).update({
          currentBid: newBid,
          currentBidder: currentTeamInfo.teamName,
          lastBidTime: Date.now()
        });
        // Reset timer to 30s
        await db.ref(`auctions/${currentEvent}/timer`).set({
          timeLeft: 30,
          running: true,
          updatedAt: Date.now()
        });
      } catch (err) {
        console.error('Bid error:', err);
      }
    }
  };

  // ---------------- VIEW 1: Login Form (NO Event Dropdown, Scoped to URL event) ----------------
  if (!loggedInTeam) {
    return (
      <div style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px'
      }}>
        <div className="glass-panel" style={{
          width: '100%',
          maxWidth: '420px',
          padding: '36px 32px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Subtle Accent Glow */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #4F46E5 0%, #F59E0B 100%)'
          }} />

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <h1 style={{ fontSize: '2.2rem', marginBottom: '4px' }}>
              Cric<span style={{ color: '#F59E0B' }}>Bid</span>
            </h1>
            <div style={{ color: 'var(--slate-400)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>
              Team Owner Console
            </div>

            {/* Fixed Tournament Badge (NO Dropdown) */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(79, 70, 229, 0.15)',
              border: '1px solid rgba(79, 70, 229, 0.3)',
              color: '#A5B4FC',
              fontSize: '0.82rem',
              fontWeight: 700
            }}>
              <span>🏆</span>
              <span>Tournament: <strong>{currentEvent}</strong></span>
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="loginUser">Team Username</label>
              <input 
                id="loginUser"
                type="text" 
                placeholder="e.g. wolves_owner"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div style={{ marginBottom: '22px' }}>
              <label htmlFor="loginPass">Password</label>
              <input 
                id="loginPass"
                type="password" 
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            {loginError && (
              <div style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#FCA5A5',
                fontSize: '0.82rem',
                marginBottom: '18px',
                fontWeight: 600
              }}>
                ❌ {loginError}
              </div>
            )}

            <button 
              type="submit" 
              className="btn btn-gold" 
              style={{ width: '100%', padding: '12px' }}
              disabled={loggingIn}
              id="btnLoginSubmit"
            >
              {loggingIn ? 'Logging in...' : 'Login to Auction'}
            </button>
          </form>

          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <button 
              onClick={() => onNavigate('/')} 
              style={{ background: 'none', border: 'none', color: 'var(--slate-500)', fontSize: '0.82rem', cursor: 'pointer', fontWeight: 600 }}
            >
              ← Back to Tournament Hub
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- VIEW 2: Team Owner Console (Live Auction) ----------------
  const myPlayers = (auctionLog.sold || []).filter(s => 
    (s.team || '').toLowerCase() === (currentTeamInfo.teamName || '').toLowerCase()
  );

  const retainedList = Array.isArray(currentTeamInfo.retainedPlayers) && currentTeamInfo.retainedPlayers.length > 0
    ? currentTeamInfo.retainedPlayers.filter(Boolean)
    : (currentTeamInfo.retainedPlayer ? currentTeamInfo.retainedPlayer.split(',').map(s => s.trim()).filter(Boolean) : []);

  const totalSquadCount = myPlayers.length + retainedList.length;

  const cp = liveData?.currentPlayer;
  const isMyBid = liveData && (liveData.currentBidder || '').toLowerCase() === (currentTeamInfo.teamName || '').toLowerCase();

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 20px' }}>
      {/* Franchise Top Bar */}
      <div className="glass-panel" style={{
        padding: '16px 24px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {currentTeamInfo.logoUrl ? (
            <img 
              src={formatImageUrl(currentTeamInfo.logoUrl)} 
              alt={currentTeamInfo.teamName} 
              onError={(e) => {
                const fid = getDriveFileId(currentTeamInfo.logoUrl);
                if (fid && !e.currentTarget.dataset.tried) {
                  e.currentTarget.dataset.tried = '1';
                  e.currentTarget.src = `https://drive.google.com/thumbnail?id=${fid}&sz=w600`;
                } else {
                  e.currentTarget.style.display = 'none';
                  if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'flex';
                }
              }}
              style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover', background: '#0F172A' }} 
            />
          ) : null}
          <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'var(--primary)', color: '#FFF', display: currentTeamInfo.logoUrl ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 800 }}>
            {(currentTeamInfo.teamName || 'T')[0]}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.3rem', color: '#FFFFFF', margin: 0 }}>{currentTeamInfo.teamName}</h2>
              <span className="badge badge-event">{currentEvent}</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--slate-400)' }}>
              {Array.isArray(currentTeamInfo.owners) && currentTeamInfo.owners.length > 1 ? (
                <>Owners: <strong style={{ color: 'var(--slate-200)' }}>{currentTeamInfo.owners.join(', ')}</strong></>
              ) : currentTeamInfo.ownerName && currentTeamInfo.ownerName.includes(',') ? (
                <>Owners: <strong style={{ color: 'var(--slate-200)' }}>{currentTeamInfo.ownerName}</strong></>
              ) : (
                <>Owner: <strong style={{ color: 'var(--slate-200)' }}>{currentTeamInfo.ownerName || (Array.isArray(currentTeamInfo.owners) && currentTeamInfo.owners[0]) || 'Franchise Owner'}</strong></>
              )}
            </div>
          </div>
        </div>

        {/* Purse & Squad Summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--slate-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Purse Remaining</div>
            <div style={{ fontSize: '1.4rem', fontFamily: 'Outfit', fontWeight: 800, color: '#F59E0B' }}>
              {formatNum(currentTeamInfo.purseRemaining)}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--slate-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Squad Count</div>
            <div style={{ fontSize: '1.4rem', fontFamily: 'Outfit', fontWeight: 800, color: '#10B981' }}>
              {totalSquadCount} / {currentTeamInfo.maxPlayers || 11}
            </div>
          </div>

          <button onClick={handleLogout} className="btn btn-outline btn-sm" id="btnTeamLogout">
            Logout
          </button>
        </div>
      </div>

      {/* Main Grid: Live Auction + My Squad */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.4fr) minmax(300px, 1fr)', gap: '24px' }}>
        {/* Left Column: Live Bidding Stage */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', margin: 0 }}>⚡ Live Bidding Console</h3>
            {timerData && timerData.running && (
              <span className="badge badge-live" style={{ fontSize: '0.85rem', padding: '4px 12px' }}>
                ⏱️ {timerData.timeLeft}s
              </span>
            )}
          </div>

          {cp ? (
            <div>
              {/* Player Card */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.6)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)',
                padding: '20px',
                marginBottom: '20px',
                display: 'flex',
                gap: '20px',
                flexWrap: 'wrap'
              }}>
                <div style={{ width: '110px', height: '110px', borderRadius: '12px', overflow: 'hidden', background: '#0F172A', border: '1px solid var(--border-medium)', flexShrink: 0 }}>
                  {cp.Photo || cp.photoUrl ? (
                    <img 
                      src={formatImageUrl(cp.Photo || cp.photoUrl)} 
                      alt={cp.Name || cp.name} 
                      onError={(e) => {
                        const fid = getDriveFileId(cp.Photo || cp.photoUrl);
                        if (fid && !e.currentTarget.dataset.tried) {
                          e.currentTarget.dataset.tried = '1';
                          e.currentTarget.src = `https://drive.google.com/thumbnail?id=${fid}&sz=w600`;
                        } else {
                          e.currentTarget.style.display = 'none';
                          if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'flex';
                        }
                      }}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                  ) : null}
                  <div style={{ width: '100%', height: '100%', display: (cp.Photo || cp.photoUrl) ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--slate-400)', fontWeight: 700, fontSize: '1.4rem' }}>
                    {(cp.Name || cp.name || '?')[0]}
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '1.4rem', color: '#FFFFFF', marginBottom: '6px' }}>{cp.Name || cp.name}</h3>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    {cp['Batting Profile'] && <span className="badge badge-event">🏏 {cp['Batting Profile']}</span>}
                    {cp['Bowling Profile'] && <span className="badge badge-live">🎯 {cp['Bowling Profile']}</span>}
                    {cp['Are you a wicket keeper?'] === 'Yes' && <span className="badge badge-gold">🧤 WK</span>}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--slate-400)' }}>
                    Club: <strong style={{ color: 'var(--slate-200)' }}>{cp.Club || cp.club || 'General'}</strong>
                  </div>
                </div>
              </div>

              {/* Bidding Info */}
              <div style={{
                background: isMyBid ? 'rgba(16, 185, 129, 0.12)' : 'rgba(30, 41, 59, 0.6)',
                border: `1px solid ${isMyBid ? 'rgba(16, 185, 129, 0.4)' : 'var(--border-subtle)'}`,
                borderRadius: 'var(--radius-md)',
                padding: '16px 20px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)', textTransform: 'uppercase' }}>Current Highest Bid</div>
                  <div style={{ fontSize: '1.8rem', fontFamily: 'Outfit', fontWeight: 800, color: isMyBid ? '#10B981' : '#F59E0B' }}>
                    {formatNum(liveData.currentBid || liveData.baseValue || 10000)}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)', textTransform: 'uppercase' }}>Leading Team</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: isMyBid ? '#10B981' : '#FFFFFF' }}>
                    {isMyBid ? '🏆 You are winning!' : (liveData.currentBidder || 'Opening Bid')}
                  </div>
                </div>
              </div>

              {/* Bid Controls */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  className="btn btn-gold" 
                  style={{ flex: 1, padding: '14px', fontSize: '1.05rem' }}
                  onClick={() => handlePlaceBid(10000)}
                  id="btnPlaceBid10k"
                >
                  ⚡ Bid +₹10,000
                </button>
                <button 
                  className="btn btn-primary" 
                  style={{ flex: 1, padding: '14px', fontSize: '1.05rem' }}
                  onClick={() => handlePlaceBid(25000)}
                  id="btnPlaceBid25k"
                >
                  ⚡ Bid +₹25,000
                </button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--slate-400)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>⏳</div>
              <h4 style={{ color: '#FFFFFF', marginBottom: '6px' }}>Auction Waiting</h4>
              <p style={{ fontSize: '0.88rem' }}>Waiting for the auctioneer to bring the next player to the bidding block.</p>
            </div>
          )}
        </div>

        {/* Right Column: My Squad */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '16px' }}>
            👥 My Squad ({totalSquadCount})
          </h3>

          {totalSquadCount === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--slate-500)', fontSize: '0.88rem' }}>
              No players purchased or retained yet in this auction.
            </div>
          ) : (
            <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {retainedList.map((rp, idx) => (
                    <tr key={`ret_${idx}`}>
                      <td style={{ fontWeight: 600, color: '#FFFFFF' }}>
                        🔒 {rp} <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', background: '#334155', color: '#94A3B8', marginLeft: '6px' }}>Retained</span>
                      </td>
                      <td style={{ color: '#94A3B8', fontWeight: 600, fontSize: '0.85rem' }}>Retained</td>
                    </tr>
                  ))}
                  {myPlayers.map((p, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600, color: '#FFFFFF' }}>{p.player}</td>
                      <td style={{ color: '#F59E0B', fontWeight: 700 }}>{formatNum(p.soldPrice || p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
