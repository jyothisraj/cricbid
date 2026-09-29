import React, { useEffect, useState } from 'react';

export default function Admin({ eventCode = 'ESL2026', onNavigate }) {
  const [targetEvent, setTargetEvent] = useState(eventCode || 'ESL2026');

  const adminSrc = `/admin.html?event=${encodeURIComponent(targetEvent)}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 65px)' }}>
      {/* Top Bar Navigation */}
      <div className="glass-header" style={{
        padding: '10px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ fontSize: '1.15rem', color: '#FFFFFF', margin: 0 }}>
            ⚙️ CricBid Admin Console
          </h2>
          <span className="badge badge-event">{targetEvent}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <a 
            href={adminSrc} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="btn btn-outline btn-sm"
          >
            ↗ Open in New Window
          </a>
          <button 
            onClick={() => onNavigate('/')} 
            className="btn btn-outline btn-sm"
          >
            ← Back to Hub
          </button>
        </div>
      </div>

      {/* Admin Full Console Container */}
      <iframe 
        src={adminSrc} 
        style={{
          width: '100%',
          flex: 1,
          border: 'none',
          background: '#0B0F19'
        }}
        title="Admin Console"
        id="adminConsoleFrame"
      />
    </div>
  );
}
