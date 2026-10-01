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

    if (timerData.running) {
      const getSeconds = () => {
        if (timerData.seconds !== undefined) return timerData.seconds;
        if (timerData.remaining !== undefined) return timerData.remaining;
        if (timerData.endsAt) return Math.max(0, Math.ceil((timerData.endsAt - Date.now()) / 1000));
        return 30;
      };
      setSecondsLeft(getSeconds());
      const interval = setInterval(() => {
        setSecondsLeft(getSeconds());
      }, 250);
      return () => clearInterval(interval);
    } else {
      const rem = timerData.seconds !== undefined ? timerData.seconds 
        : (timerData.remaining !== undefined ? timerData.remaining 
        : (timerData.timeLeft !== undefined ? timerData.timeLeft : (timerData.totalSeconds || 30)));
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

  // Auction Statistics & Record Highest Bid
  const soldList = auctionLog.sold || [];
  const unsoldList = auctionLog.unsold || [];

  const highestSoldPlayer = soldList.length > 0 
    ? soldList.reduce((max, curr) => {
        const p = parseFloat(curr.price || curr.soldPrice || 0);
        const mp = parseFloat(max.price || max.soldPrice || 0);
        return p > mp ? curr : max;
      }, soldList[0])
    : null;
  const overallHighestBid = highestSoldPlayer ? parseFloat(highestSoldPlayer.price || highestSoldPlayer.soldPrice || 0) : 0;
  const totalAuctionSpent = soldList.reduce((sum, s) => sum + (parseFloat(s.price || s.soldPrice) || 0), 0);

  const [selectedTeamFilter, setSelectedTeamFilter] = useState('ALL');
  const filteredTeams = selectedTeamFilter === 'ALL'
    ? teams
    : teams.filter(t => (t.teamName || '').toLowerCase() === selectedTeamFilter.toLowerCase());

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', padding: '24px 20px' }}>
      {/* Header */}
      <div className="glass-panel" style={{
        padding: '16px 24px',
        marginBottom: '20px',
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

      {/* Tournament Highlights: Record High Bid & KPI Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {/* Highest Bid Record Card */}
        <div className="glass-panel" style={{
          padding: '18px 22px',
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(220, 38, 38, 0.08) 100%)',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.74rem', color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800 }}>
              🔥 AUCTION HIGHEST BID
            </span>
            <span style={{ fontSize: '1.25rem' }}>👑</span>
          </div>
          <div style={{ fontSize: '1.9rem', fontFamily: 'Outfit', fontWeight: 900, color: '#F59E0B', lineHeight: 1.1, marginBottom: '6px' }}>
            {overallHighestBid > 0 ? formatNum(overallHighestBid) : '₹0'}
          </div>
          <div style={{ fontSize: '0.84rem', color: 'var(--slate-200)', fontWeight: 600 }}>
            {highestSoldPlayer ? (
              <span>
                <strong>{highestSoldPlayer.playerName || highestSoldPlayer.player}</strong>
                <span style={{ color: 'var(--slate-400)', marginLeft: '6px' }}>• {highestSoldPlayer.team}</span>
              </span>
            ) : (
              <span style={{ color: 'var(--slate-400)' }}>Waiting for first completed bid</span>
            )}
          </div>
        </div>

        {/* Total Spend */}
        <div className="glass-panel" style={{ padding: '18px 22px' }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--slate-400)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: '6px' }}>
            💰 TOTAL AUCTION SPEND
          </div>
          <div style={{ fontSize: '1.9rem', fontFamily: 'Outfit', fontWeight: 900, color: '#10B981', lineHeight: 1.1, marginBottom: '6px' }}>
            {formatNum(totalAuctionSpent)}
          </div>
          <div style={{ fontSize: '0.84rem', color: 'var(--slate-400)' }}>
            Across {soldList.length} sold player{soldList.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Players Sold / Unsold */}
        <div className="glass-panel" style={{ padding: '18px 22px' }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--slate-400)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: '6px' }}>
            🏏 PLAYERS AUCTIONED
          </div>
          <div style={{ fontSize: '1.9rem', fontFamily: 'Outfit', fontWeight: 900, color: '#38BDF8', lineHeight: 1.1, marginBottom: '6px' }}>
            {soldList.length} <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--slate-400)' }}>Sold</span>
          </div>
          <div style={{ fontSize: '0.84rem', color: 'var(--slate-400)' }}>
            {unsoldList.length} unsold player{unsoldList.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Franchises */}
        <div className="glass-panel" style={{ padding: '18px 22px' }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--slate-400)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: '6px' }}>
            🛡️ TOURNAMENT TEAMS
          </div>
          <div style={{ fontSize: '1.9rem', fontFamily: 'Outfit', fontWeight: 900, color: '#A78BFA', lineHeight: 1.1, marginBottom: '6px' }}>
            {teams.length}
          </div>
          <div style={{ fontSize: '0.84rem', color: 'var(--slate-400)' }}>
            Tournament {currentEvent}
          </div>
        </div>
      </div>

      {/* Main Broadcast Stage: Spotlight Player & Leaderboard */}
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

          <div>
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
                    <tr key={t.teamName} style={{ cursor: 'pointer' }} onClick={() => setSelectedTeamFilter(t.teamName)}>
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

      {/* Franchise Squads Section: Displays Each Team Squad (Player, Bid Amount) */}
      <div style={{ marginTop: '36px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          marginBottom: '20px'
        }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', color: '#FFFFFF', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>👥</span> Franchise Squad Rosters
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: 'var(--slate-400)' }}>
              Complete squad breakdown with acquired players and bid amounts for each team
            </p>
          </div>

          {/* Quick Team Filter Pills */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setSelectedTeamFilter('ALL')}
              className={`btn btn-sm ${selectedTeamFilter === 'ALL' ? 'btn-primary' : 'btn-outline'}`}
              style={{ fontSize: '0.78rem', padding: '5px 12px' }}
            >
              All Teams ({teams.length})
            </button>
            {teams.map(t => (
              <button
                key={t.teamName}
                onClick={() => setSelectedTeamFilter(t.teamName)}
                className={`btn btn-sm ${selectedTeamFilter === t.teamName ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '0.78rem', padding: '5px 12px' }}
              >
                {t.teamName}
              </button>
            ))}
          </div>
        </div>

        {/* Squad Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '20px'
        }}>
          {filteredTeams.map(t => {
            const teamBought = soldList.filter(s => (s.team || '').toLowerCase() === (t.teamName || '').toLowerCase());
            const teamSpent = teamBought.reduce((sum, s) => sum + (parseFloat(s.price || s.soldPrice) || 0), 0);
            const teamTopBuy = teamBought.length > 0
              ? Math.max(...teamBought.map(s => parseFloat(s.price || s.soldPrice) || 0))
              : 0;

            const ownerList = Array.isArray(t.owners) && t.owners.length > 0
              ? t.owners.filter(Boolean)
              : (t.ownerName ? t.ownerName.split(',').map(s => s.trim()).filter(Boolean) : []);

            const iconList = Array.isArray(t.iconPlayers) && t.iconPlayers.length > 0
              ? t.iconPlayers.filter(Boolean)
              : (t.iconPlayer ? t.iconPlayer.split(',').map(s => s.trim()).filter(Boolean) : []);

            const retainedList = Array.isArray(t.retainedPlayers) && t.retainedPlayers.length > 0
              ? t.retainedPlayers.filter(Boolean)
              : (t.retainedPlayer ? t.retainedPlayer.split(',').map(s => s.trim()).filter(Boolean) : []);

            const squadCount = ownerList.length + iconList.length + retainedList.length + teamBought.length;
            const maxPlayers = parseInt(t.maxPlayers) || 13;

            const squadItems = [
              ...ownerList.map(name => ({ name, tag: 'Owner', tagColor: '#F59E0B', tagBg: 'rgba(245, 158, 11, 0.18)', priceStr: 'Pre-assigned', isPreassigned: true })),
              ...iconList.map(name => ({ name, tag: 'Icon', tagColor: '#38BDF8', tagBg: 'rgba(56, 189, 248, 0.18)', priceStr: 'Pre-assigned', isPreassigned: true })),
              ...retainedList.map(name => ({ name, tag: 'Retained', tagColor: '#A78BFA', tagBg: 'rgba(167, 139, 250, 0.18)', priceStr: 'Retained', isPreassigned: true })),
              ...teamBought.map(s => ({ name: s.playerName || s.player, tag: '', priceStr: formatNum(s.price || s.soldPrice), price: parseFloat(s.price || s.soldPrice) || 0 }))
            ];

            return (
              <div key={t.teamName} className="glass-panel" style={{ padding: '22px', display: 'flex', flexDirection: 'column' }}>
                {/* Team Card Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {t.logoUrl ? (
                      <div style={{ width: '40px', height: '40px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                        <ImageWithFallback src={t.logoUrl} alt={t.teamName} size="w100" fontSize="1rem" />
                      </div>
                    ) : null}
                    <div>
                      <h3 style={{ fontSize: '1.1rem', color: '#FFFFFF', margin: 0, fontWeight: 700 }}>
                        {t.teamName}
                      </h3>
                      <div style={{ fontSize: '0.72rem', color: 'var(--slate-400)' }}>
                        {ownerList.length > 0 ? `Owner: ${ownerList.join(', ')}` : ''}
                      </div>
                    </div>
                  </div>

                  <span className="badge badge-live" style={{ fontSize: '0.82rem', padding: '4px 10px' }}>
                    {squadCount} / {maxPlayers}
                  </span>
                </div>

                {/* Team Financial Mini Stats */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px',
                  background: 'rgba(15, 23, 42, 0.5)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px',
                  marginBottom: '14px',
                  textAlign: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--slate-400)', textTransform: 'uppercase' }}>Purse</div>
                    <div style={{ fontSize: '0.92rem', fontFamily: 'Outfit', fontWeight: 800, color: '#F59E0B' }}>
                      {formatNum(t.purseRemaining)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--slate-400)', textTransform: 'uppercase' }}>Spent</div>
                    <div style={{ fontSize: '0.92rem', fontFamily: 'Outfit', fontWeight: 800, color: 'var(--slate-200)' }}>
                      {formatNum(teamSpent)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--slate-400)', textTransform: 'uppercase' }}>Top Buy</div>
                    <div style={{ fontSize: '0.92rem', fontFamily: 'Outfit', fontWeight: 800, color: '#10B981' }}>
                      {teamTopBuy > 0 ? formatNum(teamTopBuy) : '-'}
                    </div>
                  </div>
                </div>

                {/* Squad Members Table (Player & Bid Amount) */}
                <div style={{ flex: 1 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.72rem',
                    textTransform: 'uppercase',
                    color: 'var(--slate-400)',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    padding: '4px 6px 8px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
                  }}>
                    <span>Player ({squadCount})</span>
                    <span>Bid Amount</span>
                  </div>

                  {squadItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--slate-500)', fontSize: '0.84rem' }}>
                      No players acquired yet.
                    </div>
                  ) : (
                    <div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <tbody>
                          {squadItems.map((item, idx) => (
                            <tr key={idx} style={{
                              borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                              transition: 'background 0.15s ease'
                            }}>
                              <td style={{ padding: '8px 6px', color: '#FFFFFF', fontWeight: 600 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span>{item.isPreassigned ? (item.tag === 'Owner' ? '👑' : item.tag === 'Icon' ? '⭐' : '🔒') : '🏏'}</span>
                                  <span>{item.name}</span>
                                  {item.tag ? (
                                    <span style={{
                                      fontSize: '0.65rem',
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      background: item.tagBg,
                                      color: item.tagColor,
                                      fontWeight: 700
                                    }}>
                                      {item.tag}
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                              <td style={{
                                padding: '8px 6px',
                                textAlign: 'right',
                                fontFamily: item.isPreassigned ? 'inherit' : 'Outfit',
                                fontWeight: item.isPreassigned ? 500 : 700,
                                color: item.isPreassigned ? 'var(--slate-400)' : '#F59E0B',
                                fontSize: item.isPreassigned ? '0.78rem' : '0.92rem'
                              }}>
                                {item.priceStr}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
