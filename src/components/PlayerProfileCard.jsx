import PlayerCategories from './PlayerCategories';
import React, { useEffect, useState } from 'react';
import ImageWithFallback from './ImageWithFallback';
import { formatNum, getConfig } from '../services/api';

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

const statAliases = {
  Matches: ['Matches'], Runs: ['Runs'], "100's": ["100's",'hundreds'],
  "50's": ["50's",'fifties'], "30's": ["30's",'thirties'],
  SR: ['SR','Strike Rate'], Avg: ['Avg','Average','Batting Avg','Batting Average'],
  Wickets: ['Wickets'], '5 Wkts': ['5 Wkts','5 wickets','fiveWickets'],
  '3 Wkts': ['3 Wkts','3 wickets','threeWickets'], Economy: ['Economy','Econ','Economy Rate'],
  Catches: ['Catches'], Runouts: ['Runouts','Run Outs']
};

function useCareerStats(player, eventCode) {
  const name = getField(player,'Name','Player Name','Player').toLowerCase();
  const booking = getField(player,'Booking ID','id');
  const identity = JSON.stringify([eventCode,name,booking]);
  const [saved,setSaved] = useState(null);
  const rosterStats = Object.fromEntries(Object.entries(statAliases).map(([field,aliases]) => [field,getField(player,...aliases)]));
  const version = JSON.stringify(rosterStats);
  useEffect(() => {
    if (!name || !eventCode) return;
    const controller = new AbortController();
    async function refresh() {
      try {
        const config = await getConfig();
        if (!config.apps_script_url || controller.signal.aborted) return;
        const url = new URL(config.apps_script_url);
        url.searchParams.set('action','getPlayers');
        url.searchParams.set('eventCode',eventCode);
        const response = await fetch(url,{cache:'no-store',signal:controller.signal});
        const {players} = await response.json();
        const matches = (players || []).filter(row =>
          (getField(row,'Event Code','Event') || 'ESL2026').toUpperCase() === eventCode &&
          getField(row,'Name','Player Name','Player').toLowerCase() === name &&
          (!booking || getField(row,'Booking ID','id') === booking));
        if (matches.length !== 1 || controller.signal.aborted) return;
        const stats = {};
        for (const [field,aliases] of Object.entries(statAliases)) {
          const normalize = key => key.toLowerCase().replace(/[\s_'-]/g,'');
          const keys = aliases.map(normalize);
          if (Object.keys(matches[0]).some(key => keys.includes(normalize(key)))) stats[field] = getField(matches[0],...aliases);
        }
        setSaved({identity,version,stats});
      } catch (error) {
        if (!controller.signal.aborted) console.warn('Could not refresh career statistics',error);
      }
    }
    refresh();
    window.addEventListener('focus',refresh);
    return () => { controller.abort(); window.removeEventListener('focus',refresh); };
  }, [identity,version,name,booking,eventCode]);
  return saved?.identity === identity && saved.version === version ? {...rosterStats,...saved.stats} : rosterStats;
}

export default function PlayerProfileCard({ player, eventCode, tournament, liveData = {}, isSpectator = false, onEnlargePhoto }) {
  const stats = useCareerStats(player,eventCode);
  if (!player) return null;

  const name = getField(player, 'Name', 'name', 'playerName') || 'Unknown Player';
  const rawPhoto = getField(player, 'Photo', 'photoUrl', 'photo', 'image');
  const { affiliation, club, categories } = window.PlayerCategories.classify(player, tournament);
  const battingProfile = window.PlayerCategories.fieldValue(player,'Batting Profile');
  const battingPosition = getField(player, 'Batting position', 'battingPosition', 'Batting Position', 'batting order');
  const bowlingProfile = window.PlayerCategories.fieldValue(player,'Bowling Profile');
  const isWk = getField(player, 'Are you a wicket keeper?', 'wicketKeeper', 'Wicket Keeper', 'keeper').toLowerCase() === 'yes';

  // Base price
  const basePriceVal = window.PlayerPricing.resolve(player, tournament, liveData.baseValue);

  const { Matches: matches, Runs: runs, "100's": hundreds, "50's": fifties, "30's": thirties,
    SR: sr, Avg: avg, Wickets: wickets, '5 Wkts': fiveWkts, '3 Wkts': threeWkts, Economy: economy } = stats;

  // Extra details
  const age = window.PlayerCategories.fieldValue(player,'Age',tournament);
  const city = getField(player, 'Location', 'City', 'city', 'location');
  const jersey = getField(player, 'Jersey', 'Jersey Number', 'jerseyNumber');

  const badges = Array.isArray(player.badges) ? player.badges : [];

  const photoSize = isSpectator ? '140px' : '110px';
  const largePhoto = Boolean(onEnlargePhoto && rawPhoto);
  const PhotoFrame = largePhoto ? 'button' : 'div';
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
        <PhotoFrame
          type={largePhoto ? 'button' : undefined}
          aria-label={largePhoto ? `Enlarge photo of ${name}` : undefined}
          onClick={largePhoto ? () => onEnlargePhoto(rawPhoto) : undefined}
          style={{
          padding: 0,
          cursor: largePhoto ? 'zoom-in' : undefined,
          width: largePhoto ? 'min(480px, 100%)' : photoSize,
          height: largePhoto ? 'min(480px, 60vh)' : photoSize,
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
            size={largePhoto ? 'w1200' : 'w600'}
            style={largePhoto ? { objectFit: 'contain' } : undefined}
            fontSize={isSpectator ? '2.4rem' : '1.8rem'}
          />
        </PhotoFrame>

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
            {(affiliation || club) && <span className="badge badge-event">{affiliation || club}</span>}
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

          <PlayerCategories categories={categories} />

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
              <div style={{ fontSize: isSpectator ? '1.2rem' : '1.05rem', fontWeight: 800, color: '#FFFFFF' }}>{matches || '0'}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--slate-400)', textTransform: 'uppercase' }}>Matches</div>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '8px 6px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: isSpectator ? '1.2rem' : '1.05rem', fontWeight: 800, color: '#38BDF8' }}>{runs || '0'}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--slate-400)', textTransform: 'uppercase' }}>Runs</div>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '8px 6px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: isSpectator ? '1.2rem' : '1.05rem', fontWeight: 800, color: '#FCD34D' }}>{sr || '-'}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--slate-400)', textTransform: 'uppercase' }}>SR</div>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '8px 6px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: isSpectator ? '1.2rem' : '1.05rem', fontWeight: 800, color: '#4ADE80' }}>{avg || '-'}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--slate-400)', textTransform: 'uppercase' }}>Avg</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '8px' }}>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '6px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#F59E0B' }}>{hundreds || '0'}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--slate-400)' }}>100s</div>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '6px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#F59E0B' }}>{fifties || '0'}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--slate-400)' }}>50s</div>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '6px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#F59E0B' }}>{thirties || '0'}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--slate-400)' }}>30s</div>
            </div>
          </div>
        </div>

        {[
          { title: 'Bowling Record', icon: '🎯', accent: '#F472B6', tiles: [
            ['Wkts', wickets || '0', '#FB7185'], ['Econ', economy || '-', '#A78BFA'],
            ['5 Wkts', fiveWkts || '0', '#EF4444'], ['3 Wkts', threeWkts || '0', '#F97316']
          ] },
          { title: 'Fielding Record', icon: '🧤', accent: '#6EE7B7', tiles: [
            ['Catches', stats.Catches || '0', '#34D399'], ['Runouts', stats.Runouts || '0', '#5EEAD4']
          ] }
        ].map(({ title, icon, accent, tiles }) => (
        <div key={title} style={{
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
            color: accent,
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span aria-hidden="true">{icon}</span> {title}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))`, gap: '8px' }}>
            {tiles.map(([label, value, color]) => (
            <div key={label} style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '8px 6px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: isSpectator ? '1.2rem' : '1.05rem', fontWeight: 800, color }}>{value}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--slate-400)', textTransform: 'uppercase' }}>{label}</div>
            </div>
            ))}
          </div>
        </div>
        ))}
      </div>
    </div>
  );
}
