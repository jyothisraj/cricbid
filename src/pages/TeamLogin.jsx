import React, { useState, useEffect } from 'react';
import { 
  authenticateTeam, 
  listenLiveAuction, 
  listenTimer, 
  listenTeams, 
  listenAuctionLog,
  listenPlayers,
  listenAuctionSettings,
  getDb,
  formatNum
} from '../services/api';
import ImageWithFallback from '../components/ImageWithFallback';
import PlayerProfileCard from '../components/PlayerProfileCard';

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
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [allTeams, setAllTeams] = useState([]);
  const [allPlayers, setAllPlayers] = useState([]);
  const [auctionLog, setAuctionLog] = useState({ sold: [], unsold: [] });
  const [auctionSettings, setAuctionSettings] = useState(null);
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
    let unsubPlayers = () => {};
    let unsubSettings = () => {};

    listenLiveAuction(currentEvent, data => setLiveData(data)).then(u => { unsubLive = u; });
    listenTimer(currentEvent, data => setTimerData(data)).then(u => { unsubTimer = u; });
    listenTeams(currentEvent, list => setAllTeams(list)).then(u => { unsubTeams = u; });
    listenAuctionLog(currentEvent, log => setAuctionLog(log)).then(u => { unsubLog = u; });
    listenPlayers(currentEvent, list => setAllPlayers(list)).then(u => { unsubPlayers = u; });
    listenAuctionSettings(currentEvent, s => setAuctionSettings(s)).then(u => { unsubSettings = u; });

    return () => {
      unsubLive();
      unsubTimer();
      unsubTeams();
      unsubLog();
      unsubPlayers();
      unsubSettings();
    };
  }, [loggedInTeam, currentEvent]);

  // Smooth countdown ticker for timerData
  useEffect(() => {
    if (!timerData) {
      setSecondsLeft(30);
      return;
    }

    if (timerData.running && timerData.endsAt) {
      const calc = () => Math.max(0, Math.ceil((timerData.endsAt - Date.now()) / 1000));
      setSecondsLeft(calc());
      const interval = setInterval(() => {
        setSecondsLeft(calc());
      }, 250);
      return () => clearInterval(interval);
    } else {
      const rem = timerData.remaining !== undefined 
        ? timerData.remaining 
        : (timerData.timeLeft !== undefined ? timerData.timeLeft : (timerData.totalSeconds || 30));
      setSecondsLeft(rem !== undefined ? rem : 30);
    }
  }, [timerData]);

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

  const handleBidBasePrice = async () => {
    if (!liveData || !liveData.currentPlayer) return;
    const basePrice = Number(liveData.baseValue || liveData.currentPlayer.basePrice || liveData.currentPlayer.BasePrice || 10000);
    if (basePrice > maxBidAmount) {
      alert(`Base price (${formatNum(basePrice)}) exceeds your maximum allowable reserve of ${formatNum(maxBidAmount)}!`);
      return;
    }

    const db = await getDb();
    if (db) {
      try {
        await db.ref(`auctions/${currentEvent}/live`).update({
          currentBid: basePrice,
          currentBidder: currentTeamInfo.teamName,
          lastBidTime: Date.now()
        });
        const timerDuration = 30;
        await db.ref(`auctions/${currentEvent}/timer`).set({
          running: true,
          endsAt: Date.now() + (timerDuration * 1000),
          totalSeconds: timerDuration,
          remaining: timerDuration
        });
      } catch (err) {
        console.error('Bid base price error:', err);
      }
    }
  };

  const handlePlaceBid = async (inc = 1000) => {
    if (!liveData || !liveData.currentPlayer) return;
    const basePrice = Number(liveData.baseValue || liveData.currentPlayer.basePrice || liveData.currentPlayer.BasePrice || 10000);
    const currentBid = liveData.currentBidder
      ? Number(liveData.currentBid || basePrice)
      : basePrice;
    const newBid = currentBid + inc;

    if (newBid > maxBidAmount) {
      alert(`Bid of ${formatNum(newBid)} exceeds your maximum allowable reserve of ${formatNum(maxBidAmount)}!`);
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
        // Reset timer to 30s with endsAt for synchronized countdown
        const timerDuration = 30;
        await db.ref(`auctions/${currentEvent}/timer`).set({
          running: true,
          endsAt: Date.now() + (timerDuration * 1000),
          totalSeconds: timerDuration,
          remaining: timerDuration
        });
      } catch (err) {
        console.error('Bid error:', err);
      }
    }
  };

  const handlePlaceMaxBid = async () => {
    if (!liveData || !liveData.currentPlayer) return;
    const basePrice = Number(liveData.baseValue || liveData.currentPlayer.basePrice || liveData.currentPlayer.BasePrice || 10000);
    const currentBid = liveData.currentBidder
      ? Number(liveData.currentBid || basePrice)
      : basePrice;
    if (maxBidAmount <= currentBid) {
      alert(`Max allowable bid (${formatNum(maxBidAmount)}) is not higher than current bid (${formatNum(currentBid)})!`);
      return;
    }
    const confirmed = window.confirm(`Confirm MAX BID of ${formatNum(maxBidAmount)} on ${liveData.currentPlayer.Name || liveData.currentPlayer.name}?`);
    if (!confirmed) return;

    const db = await getDb();
    if (db) {
      try {
        await db.ref(`auctions/${currentEvent}/live`).update({
          currentBid: maxBidAmount,
          currentBidder: currentTeamInfo.teamName,
          lastBidTime: Date.now()
        });
        const timerDuration = 30;
        await db.ref(`auctions/${currentEvent}/timer`).set({
          running: true,
          endsAt: Date.now() + (timerDuration * 1000),
          totalSeconds: timerDuration,
          remaining: timerDuration
        });
      } catch (err) {
        console.error('Max bid error:', err);
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

  const ownerList = Array.isArray(currentTeamInfo.owners) && currentTeamInfo.owners.length > 0
    ? currentTeamInfo.owners.filter(Boolean)
    : (currentTeamInfo.ownerName ? currentTeamInfo.ownerName.split(',').map(s => s.trim()).filter(Boolean) : []);

  const iconList = Array.isArray(currentTeamInfo.iconPlayers) && currentTeamInfo.iconPlayers.length > 0
    ? currentTeamInfo.iconPlayers.filter(Boolean)
    : (currentTeamInfo.iconPlayer ? currentTeamInfo.iconPlayer.split(',').map(s => s.trim()).filter(Boolean) : []);

  const retainedList = Array.isArray(currentTeamInfo.retainedPlayers) && currentTeamInfo.retainedPlayers.length > 0
    ? currentTeamInfo.retainedPlayers.filter(Boolean)
    : (currentTeamInfo.retainedPlayer ? currentTeamInfo.retainedPlayer.split(',').map(s => s.trim()).filter(Boolean) : []);

  // Pre-assigned members (Owner, Icon, Retained) count towards the squad from the beginning
  const totalSquadCount = ownerList.length + iconList.length + retainedList.length + myPlayers.length;

  const minPlayerValue = parseInt(auctionSettings?.min_player_value) || 10000;
  const maxPlayers = parseInt(auctionSettings?.max_players_per_team) || parseInt(currentTeamInfo?.maxPlayers) || 13;
  const slotsNeeded = Math.max(0, maxPlayers - totalSquadCount - 1);
  const maxBidAmount = Math.max(0, (currentTeamInfo?.purseRemaining || 0) - (slotsNeeded * minPlayerValue));

  const cp = liveData?.currentPlayer;
  const fullPlayer = cp ? (allPlayers.find(p => 
    (p.Name || p.name || '').trim().toLowerCase() === (cp.Name || cp.name || '').trim().toLowerCase()
  ) || {}) : null;
  const mergedPlayer = cp ? Object.assign({}, fullPlayer, cp, {
    details: Object.assign({}, fullPlayer.details || {}, cp.details || {})
  }) : null;

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
          <div style={{ width: '48px', height: '48px', borderRadius: '10px', overflow: 'hidden', background: 'var(--primary)', flexShrink: 0 }}>
            <ImageWithFallback
              src={currentTeamInfo.logoUrl}
              alt={currentTeamInfo.teamName}
              size="w300"
              fontSize="1.2rem"
            />
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
              {totalSquadCount} / {maxPlayers}
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
            <span className={`badge ${secondsLeft <= 5 && timerData?.running ? 'badge-urgent' : 'badge-live'}`} style={{
              fontSize: '0.88rem',
              padding: '4px 14px',
              fontWeight: 700,
              background: secondsLeft <= 5 && timerData?.running ? 'rgba(239, 68, 68, 0.25)' : undefined,
              color: secondsLeft <= 5 && timerData?.running ? '#EF4444' : undefined,
              borderColor: secondsLeft <= 5 && timerData?.running ? 'rgba(239, 68, 68, 0.5)' : undefined
            }}>
              ⏱️ {secondsLeft}s {!timerData?.running ? '(Ready)' : ''}
            </span>
          </div>

          {cp ? (
            <div>
              {/* Complete Player Profile Card */}
              <PlayerProfileCard player={mergedPlayer} liveData={liveData} />

              {/* Bidding Info & Controls */}
              {(() => {
                const basePrice = Number(liveData.baseValue || liveData.currentPlayer?.basePrice || liveData.currentPlayer?.BasePrice || 10000);
                const hasBidder = Boolean(liveData.currentBidder);
                const currentBidAmount = hasBidder ? Number(liveData.currentBid || basePrice) : basePrice;

                return (
                  <div>
                    {/* Bidding Status Card */}
                    <div style={{
                      background: isMyBid ? 'rgba(16, 185, 129, 0.12)' : 'rgba(30, 41, 59, 0.6)',
                      border: `1px solid ${isMyBid ? 'rgba(16, 185, 129, 0.4)' : 'var(--border-subtle)'}`,
                      borderRadius: 'var(--radius-md)',
                      padding: '16px 20px',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)', textTransform: 'uppercase' }}>
                          {hasBidder ? 'Current Highest Bid' : 'Starting Base Price'}
                        </div>
                        <div style={{ fontSize: '1.8rem', fontFamily: 'Outfit', fontWeight: 800, color: hasBidder ? (isMyBid ? '#10B981' : '#F59E0B') : '#38BDF8' }}>
                          {formatNum(hasBidder ? currentBidAmount : basePrice)}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)', textTransform: 'uppercase' }}>
                          {hasBidder ? 'Leading Team' : 'Auction Status'}
                        </div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: isMyBid ? '#10B981' : (hasBidder ? '#FFFFFF' : 'var(--slate-300)') }}>
                          {isMyBid ? '🏆 You are winning!' : (liveData.currentBidder || 'Waiting for Opening Bid')}
                        </div>
                      </div>
                    </div>

                    {/* Opening Bid Action Banner (Visible when no team has bid yet) */}
                    {!hasBidder && (
                      <div style={{ marginBottom: '14px' }}>
                        <button 
                          className="btn btn-primary"
                          style={{
                            width: '100%',
                            padding: '15px 20px',
                            fontSize: '1.15rem',
                            fontWeight: 800,
                            background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                            borderColor: '#2563EB',
                            boxShadow: '0 4px 16px rgba(37, 99, 235, 0.35)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            letterSpacing: '0.5px'
                          }}
                          onClick={handleBidBasePrice}
                          id="btnBidBasePriceMain"
                          disabled={basePrice > maxBidAmount}
                        >
                          <span>🎯</span>
                          <span>BID WITH BASE PRICE ({formatNum(basePrice)})</span>
                        </button>
                      </div>
                    )}

                    {/* Bid Controls: +1000, +2000, +5000, +10000, Max Amount */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px' }}>
                      <button 
                        className="btn btn-outline" 
                        style={{ padding: '12px 6px', fontSize: '0.92rem', fontWeight: 700 }}
                        onClick={() => handlePlaceBid(1000)}
                        id="btnPlaceBid1k"
                        disabled={isMyBid || (currentBidAmount + 1000 > maxBidAmount)}
                      >
                        ⚡ +₹1,000
                      </button>
                      <button 
                        className="btn btn-outline" 
                        style={{ padding: '12px 6px', fontSize: '0.92rem', fontWeight: 700 }}
                        onClick={() => handlePlaceBid(2000)}
                        id="btnPlaceBid2k"
                        disabled={isMyBid || (currentBidAmount + 2000 > maxBidAmount)}
                      >
                        ⚡ +₹2,000
                      </button>
                      <button 
                        className="btn btn-gold" 
                        style={{ padding: '12px 6px', fontSize: '0.92rem', fontWeight: 700 }}
                        onClick={() => handlePlaceBid(5000)}
                        id="btnPlaceBid5k"
                        disabled={isMyBid || (currentBidAmount + 5000 > maxBidAmount)}
                      >
                        ⚡ +₹5,000
                      </button>
                      <button 
                        className="btn btn-gold" 
                        style={{ padding: '12px 6px', fontSize: '0.92rem', fontWeight: 700 }}
                        onClick={() => handlePlaceBid(10000)}
                        id="btnPlaceBid10k"
                        disabled={isMyBid || (currentBidAmount + 10000 > maxBidAmount)}
                      >
                        ⚡ +₹10,000
                      </button>
                      <button 
                        className="btn btn-primary" 
                        style={{ 
                          padding: '12px 6px', 
                          fontSize: '0.92rem', 
                          fontWeight: 800, 
                          background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)', 
                          borderColor: '#DC2626' 
                        }}
                        onClick={handlePlaceMaxBid}
                        id="btnPlaceBidMax"
                        disabled={isMyBid || maxBidAmount <= currentBidAmount}
                      >
                        🔥 Max ({formatNum(maxBidAmount)})
                      </button>
                    </div>
                  </div>
                );
              })()}
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
                  {ownerList.map((owner, idx) => (
                    <tr key={`owner_${idx}`}>
                      <td style={{ fontWeight: 600, color: '#FFFFFF' }}>
                        👑 {owner} <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.2)', color: '#F59E0B', marginLeft: '6px' }}>Owner</span>
                      </td>
                      <td style={{ color: '#F59E0B', fontWeight: 600, fontSize: '0.85rem' }}>Pre-assigned</td>
                    </tr>
                  ))}
                  {iconList.map((icon, idx) => (
                    <tr key={`icon_${idx}`}>
                      <td style={{ fontWeight: 600, color: '#FFFFFF' }}>
                        ⭐ {icon} <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.2)', color: '#60A5FA', marginLeft: '6px' }}>Icon</span>
                      </td>
                      <td style={{ color: '#60A5FA', fontWeight: 600, fontSize: '0.85rem' }}>Pre-assigned</td>
                    </tr>
                  ))}
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
                      <td style={{ fontWeight: 600, color: '#FFFFFF' }}>{p.playerName || p.player}</td>
                      <td style={{ color: '#F59E0B', fontWeight: 700 }}>{formatNum(p.price || p.soldPrice || p.amount)}</td>
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
