import React, { useState, useEffect } from 'react';
import { listenEvents, getDb } from '../services/api';

export default function TournamentHub({ onNavigate }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Initial read from localStorage
    try {
      const local = JSON.parse(localStorage.getItem('cricket_events') || '[]');
      if (Array.isArray(local) && local.length > 0) {
        setEvents(local);
        setLoading(false);
      }
    } catch (e) {}

    // 2. Realtime listener
    let unsubscribe = () => {};
    listenEvents(list => {
      if (list && list.length > 0) {
        setEvents(list);
        setLoading(false);
      }
    }).then(unsub => {
      unsubscribe = unsub;
    });

    return () => unsubscribe();
  }, []);

  const activeEvents = events.filter(e => {
    const st = String(e.status || '').toLowerCase();
    return !['draft', 'inactive', 'archived'].includes(st);
  });

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 20px' }}>
      {/* Hero Banner */}
      <div style={{
        textAlign: 'center',
        padding: '48px 24px',
        marginBottom: '40px',
        background: 'linear-gradient(180deg, rgba(79, 70, 229, 0.12) 0%, rgba(17, 24, 39, 0) 100%)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border-subtle)'
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 14px', borderRadius: 'var(--radius-full)', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#FBBF24', fontSize: '0.8rem', fontWeight: 700, marginBottom: '16px' }}>
          <span>⚡</span> Live Multi-Tournament Auction Platform
        </div>
        <h1 style={{ fontSize: '2.8rem', color: '#FFFFFF', marginBottom: '14px', letterSpacing: '-0.03em' }}>
          Cric<span style={{ color: '#F59E0B' }}>Bid</span> Tournaments
        </h1>
        <p style={{ color: 'var(--slate-400)', maxWidth: '640px', margin: '0 auto', fontSize: '1.05rem' }}>
          Select a tournament below to launch Franchise Owner bidding consoles, Spectator Broadcast stages, or registered player catalogs.
        </p>
      </div>

      {/* Tournaments Grid */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: '1.4rem', color: 'var(--text-main)' }}>Active Tournaments</h2>
        <span className="badge badge-live">
          ● {activeEvents.length} Active
        </span>
      </div>

      {loading && activeEvents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--slate-500)' }}>
          Loading active tournaments...
        </div>
      ) : activeEvents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--slate-500)' }}>
          No active tournaments found. Create one in the Admin Console.
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '24px'
        }}>
          {activeEvents.map(ev => {
            const evCode = ev.eventCode || 'ESL2026';
            const bannerUrl = ev.bannerUrl || '';

            return (
              <div 
                key={evCode}
                className="glass-panel"
                style={{
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
              >
                {/* Tournament Banner */}
                <div style={{
                  height: '160px',
                  background: 'linear-gradient(135deg, #1E1B4B 0%, #0F172A 100%)',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  {bannerUrl ? (
                    <img 
                      src={bannerUrl} 
                      alt={ev.eventName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                  ) : null}
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    display: 'flex',
                    gap: '6px'
                  }}>
                    <span className="badge badge-live">
                      ● {ev.status || 'Live'}
                    </span>
                    <span className="badge badge-event">
                      {evCode}
                    </span>
                  </div>
                </div>

                {/* Tournament Body */}
                <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '12px', color: '#FFFFFF' }}>
                    {ev.eventName || evCode}
                  </h3>

                  <div style={{ fontSize: '0.85rem', color: 'var(--slate-400)', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {ev.venue && <div>📍 Venue: <strong style={{ color: 'var(--slate-200)' }}>{ev.venue}</strong></div>}
                    {ev.startDate && <div>🗓️ Dates: <strong style={{ color: 'var(--slate-200)' }}>{ev.startDate} {ev.endDate ? `to ${ev.endDate}` : ''}</strong></div>}
                    {ev.budget && <div>💰 Team Budget: <strong style={{ color: '#FBBF24' }}>₹{Number(ev.budget).toLocaleString('en-IN')}</strong></div>}
                  </div>

                  {/* Actions */}
                  <div style={{ marginTop: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <button 
                      className="btn btn-gold btn-sm"
                      onClick={() => onNavigate(`/team-login/${evCode}`)}
                      id={`btn-team-login-${evCode}`}
                    >
                      👥 Team Login
                    </button>
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => onNavigate(`/spectator/${evCode}`)}
                      id={`btn-spectator-${evCode}`}
                    >
                      🖥️ Spectator Stage
                    </button>
                    <button 
                      className="btn btn-outline btn-sm"
                      onClick={() => onNavigate(`/players/${evCode}`)}
                      id={`btn-players-${evCode}`}
                      style={{ gridColumn: 'span 2' }}
                    >
                      🏃 Players
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
