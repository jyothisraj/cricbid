import React from 'react';
import ImageWithFallback from './ImageWithFallback';
import { formatNum } from '../services/api';

function getField(p, ...keys) {
  if (!p) return '';
  const searchKeys = keys.map(k => k.toLowerCase().replace(/[\s_'-]/g, ''));
  // 1. Direct key match
  for (const k of keys) {
    if (p[k] !== undefined && p[k] !== null && String(p[k]).trim() !== '') {
      return String(p[k]).trim();
    }
    if (p.details && p.details[k] !== undefined && p.details[k] !== null && String(p.details[k]).trim() !== '') {
      return String(p.details[k]).trim();
    }
  }
  // 2. Case and whitespace insensitive search across all object keys
  const allEntries = [
    ...Object.entries(p),
    ...(p.details ? Object.entries(p.details) : [])
  ];
  for (const [key, val] of allEntries) {
    if (val === undefined || val === null || String(val).trim() === '') continue;
    const cleanKey = key.toLowerCase().replace(/[\s_'-]/g, '');
    if (searchKeys.includes(cleanKey)) {
      return String(val).trim();
    }
  }
  return '';
}

export default function PlayerProfileCard({ player, liveData = {}, isSpectator = false }) {
  if (!player) return null;

  const name = getField(player, 'Name', 'name', 'playerName') || 'Unknown Player';
  const rawPhoto = getField(player, 'Photo', 'photoUrl', 'photo', 'image');
  const club = getField(player, 'Club', 'club').toLowerCase();
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
  const matches = getField(player, 'Matches', 'matches') || '0';
  const runs = getField(player, 'Runs', 'runs') || '0';
  const hundreds = getField(player, "100's", '100s', 'hundreds') || '0';
  const fifties = getField(player, "50's", '50s', 'fifties') || '0';
  const thirties = getField(player, "30's", '30s', 'thirties') || '0';
  const sr = getField(player, 'SR', 'Strike Rate', 'sr') || '-';
  const avg = getField(player, 'Avg', 'Average', 'avg') || '-';

  // Bowling Stats
  const wickets = getField(player, 'Wickets', 'wickets') || '0';
  const fiveWkts = getField(player, '5 Wkts', '5wkts', '5 wickets', 'fiveWickets') || '0';
  const threeWkts = getField(player, '3 Wkts', '3wkts', '3 wickets') || '0';
  const economy = getField(player, 'Economy', 'economy', 'Econ', 'economyRate') || '-';

  // Extra details
  const age = getField(player, 'Age', 'age');
  const city = getField(player, 'Location', 'City', 'city', 'location');
  const jersey = getField(player, 'Jersey', 'Jersey Number', 'jerseyNumber');

  const badges = Array.isArray(player.badges) ? player.badges : [];

  const photoSize = isSpectator ? '140px' : '110px';
  const nameSize = isSpectator ? '2rem' : '1.5rem';

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.75)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-medium)',
      padding: isSpectator ? '28px' : '22px',
      marginBottom: '20px',
      boxShadow: 'var(--shadow-md)'
    }}>
      {/* Top Section: Photo + Core Info */}
      <div style={{ display: 'flex', gap: '22px', flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div style={{
          width: photoSize,
          height: photoSize,
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
            fontSize={isSpectator ? '2.4rem' : '1.8rem'}
          />
        </div>

        <div style={{ flex: 1, minWidth: '220px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: nameSize, color: '#FFFFFF', margin: '0 0 6px 0', fontFamily: 'Outfit', fontWeight: 800 }}>
              {name}
            </h2>
            {basePriceVal > 0 && (
              <span className="badge" style={{
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#F59E0B',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                fontSize: isSpectator ? '0.95rem' : '0.85rem',
                fontWeight: 700,
                padding: '4px 14px'
              }}>
                💰 Base: {formatNum(basePriceVal)}
              </span>
            )}
          </div>

          {/* Badges Row */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {club && (
              <span className={`badge ${club === 'home' ? 'badge-live' : 'badge-event'}`} style={{ fontSize: isSpectator ? '0.84rem' : '0.78rem' }}>
                {club === 'home' ? '🏠 Home Club' : '✈️ Away Club'}
              </span>
            )}
            {battingProfile && (
              <span className="badge badge-event" style={{ fontSize: isSpectator ? '0.84rem' : '0.78rem' }}>
                🏏 {battingProfile}
              </span>
            )}
            {bowlingProfile && bowlingProfile.toLowerCase() !== 'none' && (
              <span className="badge badge-live" style={{ fontSize: isSpectator ? '0.84rem' : '0.78rem' }}>
                🎯 {bowlingProfile}
              </span>
            )}
            {isWk && (
              <span className="badge badge-gold" style={{ fontSize: isSpectator ? '0.84rem' : '0.78rem' }}>
                🧤 Wicket Keeper
              </span>
            )}
            {badges.map((b, i) => (
              <span key={i} className="badge badge-gold" style={{ fontSize: isSpectator ? '0.84rem' : '0.78rem' }}>
                ⭐ {b.type === 'icon' ? 'Icon' : b.type === 'owner' ? 'Owner' : 'Retained'} ({b.teamName})
              </span>
            ))}
          </div>

          {/* Sub-info */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: isSpectator ? '0.9rem' : '0.85rem', color: 'var(--slate-400)' }}>
            {battingPosition && (
              <div>
                Position: <strong style={{ color: 'var(--slate-200)' }}>{battingPosition}</strong>
              </div>
            )}
            {city && (
              <div>
                City: <strong style={{ color: 'var(--slate-200)' }}>{city}</strong>
              </div>
            )}
            {age && (
              <div>
                Age: <strong style={{ color: 'var(--slate-200)' }}>{age}</strong>
              </div>
            )}
            {jersey && (
              <div>
                Jersey: <strong style={{ color: 'var(--slate-200)' }}>#{jersey}</strong>
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
              <div style={{ fontSize: isSpectator ? '1.2rem' : '1.05rem', fontWeight: 800, color: '#FFFFFF' }}>{matches}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--slate-400)', textTransform: 'uppercase' }}>Matches</div>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '8px 6px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: isSpectator ? '1.2rem' : '1.05rem', fontWeight: 800, color: '#38BDF8' }}>{runs}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--slate-400)', textTransform: 'uppercase' }}>Runs</div>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '8px 6px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: isSpectator ? '1.2rem' : '1.05rem', fontWeight: 800, color: '#FCD34D' }}>{sr}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--slate-400)', textTransform: 'uppercase' }}>SR</div>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '8px 6px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: isSpectator ? '1.2rem' : '1.05rem', fontWeight: 800, color: '#4ADE80' }}>{avg}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--slate-400)', textTransform: 'uppercase' }}>Avg</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '8px' }}>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '6px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#F59E0B' }}>{hundreds}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--slate-400)' }}>100s</div>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '6px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#F59E0B' }}>{fifties}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--slate-400)' }}>50s</div>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '6px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#F59E0B' }}>{thirties}</div>
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
              <div style={{ fontSize: isSpectator ? '1.2rem' : '1.05rem', fontWeight: 800, color: '#FB7185' }}>{wickets}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--slate-400)', textTransform: 'uppercase' }}>Wkts</div>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '8px 6px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: isSpectator ? '1.2rem' : '1.05rem', fontWeight: 800, color: '#A78BFA' }}>{economy}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--slate-400)', textTransform: 'uppercase' }}>Econ</div>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '8px 6px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: isSpectator ? '1.2rem' : '1.05rem', fontWeight: 800, color: '#EF4444' }}>{fiveWkts}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--slate-400)', textTransform: 'uppercase' }}>5 Wkts</div>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '8px 6px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: isSpectator ? '1.2rem' : '1.05rem', fontWeight: 800, color: '#F97316' }}>{threeWkts}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--slate-400)', textTransform: 'uppercase' }}>3 Wkts</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
