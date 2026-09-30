import React, { useState, useEffect } from 'react';
import { 
  listenLiveAuction, 
  listenTimer, 
  listenTeams, 
  listenAuctionLog,
  listenPlayers,
  formatNum
} from '../services/api';
import ImageWithFallback from '../components/ImageWithFallback';
import PlayerProfileCard from '../components/PlayerProfileCard';

export default function PublicDashboard({ eventCode = 'ESL2026', onNavigate }) {
  const currentEvent = (eventCode || 'ESL2026').toUpperCase();

  const [liveData, setLiveData] = useState(null);
  const [timerData, setTimerData] = useState(null);
  const [teams, setTeams] = useState([]);
  const [allPlayers, setAllPlayers] = useState([]);
  const [auctionLog, setAuctionLog] = useState({ sold: [], unsold: [] });

  useEffect(() => {
    let unsubLive = () => {};
    let unsubTimer = () => {};
    let unsubTeams = () => {};
    let unsubLog = () => {};
    let unsubPlayers = () => {};

    listenLiveAuction(currentEvent, data => setLiveData(data)).then(u => { unsubLive = u; });
    listenTimer(currentEvent, data => setTimerData(data)).then(u => { unsubTimer = u; });
    listenTeams(currentEvent, list => setTeams(list)).then(u => { unsubTeams = u; });
    listenAuctionLog(currentEvent, log => setAuctionLog(log)).then(u => { unsubLog = u; });
    listenPlayers(currentEvent, list => setAllPlayers(list)).then(u => { unsubPlayers = u; });

    return () => {
      unsubLive();
      unsubTimer();
      unsubTeams();
      unsubLog();
      unsubPlayers();
    };
  }, [currentEvent]);

  const [secondsLeft, setSecondsLeft] = useState(30);

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

  const cp = liveData?.currentPlayer;
  const cpName = ((cp && (cp.Name || cp.name)) || '').trim().toLowerCase();
  const fullPlayer = cp ? (allPlayers.find(p => 
    (p.Name || p.name || '').trim().toLowerCase() === cpName
  ) || {}) : null;
  const mergedPlayer = cp ? Object.assign({}, fullPlayer, cp, {
    details: Object.assign({}, fullPlayer.details || {}, cp.details || {})
  }) : null;

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', padding: '24px 20px' }}>
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
            🖥️ Spectator Stage
          </h1>
          <span className="badge badge-event">{currentEvent}</span>
          <span className="badge badge-live">● LIVE STAGE</span>
        </div>

        <div>
          <button onClick={() => onNavigate('/')} className="btn btn-outline btn-sm">
            ← Tournament Hub
          </button>
        </div>
      </div>

      {/* Main Broadcast Stage */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1.6fr) minmax(300px, 1fr)', gap: '24px' }}>
        {/* Spotlight Player Card */}
        <div className="glass-panel" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--slate-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              CURRENT BIDDING SPOTLIGHT
            </span>
            <span className={`badge ${secondsLeft <= 5 && timerData?.running ? 'badge-urgent' : 'badge-live'}`} style={{
              fontSize: '1.1rem',
              padding: '6px 16px',
              fontWeight: 800,
              background: secondsLeft <= 5 && timerData?.running ? 'rgba(239, 68, 68, 0.25)' : undefined,
              color: secondsLeft <= 5 && timerData?.running ? '#EF4444' : undefined,
              borderColor: secondsLeft <= 5 && timerData?.running ? 'rgba(239, 68, 68, 0.5)' : undefined
            }}>
              ⏱️ {secondsLeft}s {!timerData?.running ? '(Ready)' : ''}
            </span>
          </div>

          {cp ? (
            <div>
              <PlayerProfileCard player={mergedPlayer} liveData={liveData} isSpectator={true} />

              {/* Price Banner */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.15) 0%, rgba(245, 158, 11, 0.15) 100%)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-lg)',
                padding: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px'
              }}>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--slate-400)', textTransform: 'uppercase' }}>CURRENT HIGHEST BID</div>
                  <div style={{ fontSize: '2.8rem', fontFamily: 'Outfit', fontWeight: 900, color: '#F59E0B' }}>
                    {formatNum(liveData.currentBid || liveData.baseValue || 10000)}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--slate-400)', textTransform: 'uppercase' }}>HOLDING TEAM</div>
                  <div style={{ fontSize: '1.4rem', fontFamily: 'Outfit', fontWeight: 800, color: '#FFFFFF' }}>
                    {liveData.currentBidder || 'Starting Base Value'}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--slate-400)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🏏</div>
              <h3 style={{ color: '#FFFFFF', marginBottom: '8px' }}>Waiting for Next Player</h3>
              <p style={{ fontSize: '0.95rem' }}>The auctioneer will call the next player shortly.</p>
            </div>
          )}
        </div>

        {/* Right Column: Teams Leaderboard */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.2rem', color: '#FFFFFF', marginBottom: '16px' }}>
            🏆 Franchise Leaderboard
          </h3>

          <div style={{ maxHeight: '460px', overflowY: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Purse</th>
                  <th>Squad</th>
                </tr>
              </thead>
              <tbody>
                {teams.map(t => {
                  const teamBoughtCount = (auctionLog.sold || []).filter(s => 
                    (s.team || '').toLowerCase() === (t.teamName || '').toLowerCase()
                  ).length;
                  const ownerCount = Array.isArray(t.owners) && t.owners.length > 0
                    ? t.owners.filter(Boolean).length
                    : (t.ownerName ? t.ownerName.split(',').map(s => s.trim()).filter(Boolean).length : 0);
                  const iconCount = Array.isArray(t.iconPlayers) && t.iconPlayers.length > 0
                    ? t.iconPlayers.filter(Boolean).length
                    : (t.iconPlayer ? t.iconPlayer.split(',').map(s => s.trim()).filter(Boolean).length : 0);
                  const retCount = Array.isArray(t.retainedPlayers) && t.retainedPlayers.length > 0
                    ? t.retainedPlayers.filter(Boolean).length
                    : (t.retainedPlayer ? t.retainedPlayer.split(',').map(s => s.trim()).filter(Boolean).length : 0);
                  const totalSquad = ownerCount + iconCount + retCount + teamBoughtCount;
                  const maxSquad = parseInt(t.maxPlayers) || 13;

                  return (
                    <tr key={t.teamName}>
                      <td style={{ fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {t.logoUrl ? (
                          <div style={{ width: '24px', height: '24px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0 }}>
                            <ImageWithFallback
                              src={t.logoUrl}
                              alt={t.teamName}
                              size="w100"
                              fontSize="0.75rem"
                            />
                          </div>
                        ) : null}
                        <span>{t.teamName}</span>
                      </td>
                      <td style={{ color: '#F59E0B', fontWeight: 700 }}>{formatNum(t.purseRemaining)}</td>
                      <td style={{ color: '#10B981', fontWeight: 600 }}>{totalSquad} / {maxSquad}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
