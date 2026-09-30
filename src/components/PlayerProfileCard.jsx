import React from 'react';
import ImageWithFallback from './ImageWithFallback';
import { formatNum } from '../services/api';

function getField(p, ...keys) {
  if (!p) return '';
  for (const k of keys) {
    if (p[k] !== undefined && p[k] !== null && String(p[k]).trim() !== '') {
      return String(p[k]).trim();
    }
    if (p.details && p.details[k] !== undefined && p.details[k] !== null && String(p.details[k]).trim() !== '') {
      return String(p.details[k]).trim();
    }
  }
  return '';
}

export default function PlayerProfileCard({ player, liveData = {} }) {
  if (!player) return null;

  const name = getField(player, 'Name', 'name', 'playerName') || 'Unknown Player';
  const rawPhoto = getField(player, 'Photo', 'photoUrl', 'photo', 'image');
  const club = getField(player, 'Club', 'club');
  const battingProfile = getField(player, 'Batting Profile', 'battingProfile', 'Batting Style', 'role');
  const battingPosition = getField(player, 'Batting position', 'battingPosition', 'Batting Position', 'batting order');
  const bowlingProfile = getField(player, 'Bowling Profile', 'bowlingProfile', 'Bowling Style');
  const isWk = getField(player, 'Are you a wicket keeper?', 'wicketKeeper', 'Wicket Keeper', 'keeper').toLowerCase() === 'yes';

  // Base price
  const basePriceVal = parseFloat(
    liveData.baseValue ||
    getField(player, 'BasePrice', 'Base Price', 'basePrice', 'Ticket Price', 'price') ||
    10000
  );

  // Batting Stats
  const matches = getField(player, 'Matches', 'matches');
  const runs = getField(player, 'Runs', 'runs');
  const hundreds = getField(player, "100's", '100s', 'hundreds');
  const fifties = getField(player, "50's", '50s', 'fifties');
  const thirties = getField(player, "30's", '30s', 'thirties');
  const sr = getField(player, 'SR', 'Strike Rate', 'sr');
  const avg = getField(player, 'Avg', 'Average', 'avg');

  // Bowling Stats
  const wickets = getField(player, 'Wickets', 'wickets');
  const fiveWkts = getField(player, '5 Wkts', '5wkts', '5 wickets', 'fiveWickets');
  const threeWkts = getField(player, '3 Wkts', '3wkts', '3 wickets');
  const economy = getField(player, 'Economy', 'economy', 'Econ', 'economyRate');

  const badges = Array.isArray(player.badges) ? player.badges : [];

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.75)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-medium)',
      padding: '24px',
      marginBottom: '20px',
      boxShadow: 'var(--shadow-md)'
    }}>
      {/* Top Section: Photo + Core Info */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div style={{
          width: '120px',
          height: '120px',
          borderRadius: '16px',
          overflow: 'hidden',
          background: '#0F172A',
          border: '2px solid var(--border-medium)',
          boxShadow: 'var(--shadow-md)',
          flexShrink: 0
        }}>
          <ImageWithFallback
            src={rawPhoto}
            alt={name}
            size="w600"
            fontSize="1.8rem"
          />
        </div>

        <div style={{ flex: 1, minWidth: '220px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.6rem', color: '#FFFFFF', margin: '0 0 6px 0', fontFamily: 'Outfit' }}>
              {name}
            </h2>
            {basePriceVal > 0 && (
              <span className="badge" style={{
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#F59E0B',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                fontSize: '0.85rem',
                fontWeight: 700,
                padding: '4px 12px'
              }}>
                💰 Base: {formatNum(basePriceVal)}
              </span>
            )}
          </div>

          {/* Badges Row */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {club && (
              <span className={`badge ${club.toLowerCase() === 'home' ? 'badge-live' : 'badge-event'}`} style={{ fontSize: '0.78rem' }}>
                {club.toLowerCase() === 'home' ? '🏠 Home Club' : '✈️ Away Club'}
              </span>
            )}
            {battingProfile && (
              <span className="badge badge-event" style={{ fontSize: '0.78rem' }}>
                🏏 {battingProfile}
              </span>
            )}
            {bowlingProfile && bowlingProfile.toLowerCase() !== 'none' && (
              <span className="badge badge-live" style={{ fontSize: '0.78rem' }}>
                🎯 {bowlingProfile}
              </span>
            )}
            {isWk && (
              <span className="badge badge-gold" style={{ fontSize: '0.78rem' }}>
                🧤 Wicket Keeper
              </span>
            )}
            {badges.map((b, i) => (
              <span key={i} className="badge badge-gold" style={{ fontSize: '0.78rem' }}>
                ⭐ {b.type === 'icon' ? 'Icon' : b.type === 'owner' ? 'Owner' : 'Retained'} ({b.teamName})
              </span>
            ))}
          </div>

          {/* Sub-info */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--slate-400)' }}>
            {battingPosition && (
              <div>
                Position: <strong style={{ color: 'var(--slate-200)' }}>{battingPosition}</strong>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Record Container */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
        {/* Batting Record */}
        <div style={{
          background: 'rgba(30, 41, 59, 0.45)',
          borderRadius: '12px',
          border: '1px solid var(--border-subtle)',
          padding: '14px 16px'
        }}>
          <div style={{
            fontSize: '0.8rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: '#93C5FD',
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>🏏</span> Batting Record
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '8px 6px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF' }}>{matches || '0'}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--slate-400)', textTransform: 'uppercase' }}>Matches</div>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '8px 6px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#38BDF8' }}>{runs || '0'}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--slate-400)', textTransform: 'uppercase' }}>Runs</div>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '8px 6px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FCD34D' }}>{sr || '-'}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--slate-400)', textTransform: 'uppercase' }}>SR</div>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '8px 6px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#4ADE80' }}>{avg || '-'}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--slate-400)', textTransform: 'uppercase' }}>Avg</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '8px' }}>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '6px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#F59E0B' }}>{hundreds || '0'}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--slate-400)' }}>100s</div>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '6px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#F59E0B' }}>{fifties || '0'}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--slate-400)' }}>50s</div>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '6px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#F59E0B' }}>{thirties || '0'}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--slate-400)' }}>30s</div>
            </div>
          </div>
        </div>

        {/* Bowling Record */}
        <div style={{
          background: 'rgba(30, 41, 59, 0.45)',
          borderRadius: '12px',
          border: '1px solid var(--border-subtle)',
          padding: '14px 16px'
        }}>
          <div style={{
            fontSize: '0.8rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: '#F472B6',
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>🎯</span> Bowling Record
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '8px 6px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FB7185' }}>{wickets || '0'}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--slate-400)', textTransform: 'uppercase' }}>Wkts</div>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '8px 6px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#A78BFA' }}>{economy || '-'}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--slate-400)', textTransform: 'uppercase' }}>Econ</div>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '8px 6px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#EF4444' }}>{fiveWkts || '0'}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--slate-400)', textTransform: 'uppercase' }}>5 Wkts</div>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '8px 6px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#F97316' }}>{threeWkts || '0'}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--slate-400)', textTransform: 'uppercase' }}>3 Wkts</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
