import React, { useState, useEffect } from 'react';
import { formatImageUrl, getDriveFileId, getInitials } from '../services/api';

export default function ImageWithFallback({
  src,
  alt = '',
  driveId: propDriveId,
  size = 'w600',
  style = {},
  containerStyle = {},
  className = '',
  onClick,
  fallbackType = 'player', // 'player' | 'team'
  fontSize = '1.1rem'
}) {
  const rawUrl = src || '';
  const driveId = propDriveId || getDriveFileId(rawUrl);
  const primaryUrl = formatImageUrl(rawUrl);

  const [currentSrc, setCurrentSrc] = useState(primaryUrl);
  const [triedDrive, setTriedDrive] = useState(false);
  const [hasError, setHasError] = useState(!primaryUrl);

  useEffect(() => {
    const formatted = formatImageUrl(rawUrl);
    setCurrentSrc(formatted);
    setTriedDrive(false);
    setHasError(!formatted);
  }, [rawUrl]);

  const handleError = () => {
    if (driveId && !triedDrive) {
      setTriedDrive(true);
      setCurrentSrc(`https://drive.google.com/thumbnail?id=${driveId}&sz=${size}`);
    } else {
      setHasError(true);
    }
  };

  const initials = getInitials(alt || '?');

  return (
    <div
      onClick={!hasError && currentSrc && onClick ? () => onClick(currentSrc) : undefined}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
        userSelect: 'none',
        ...containerStyle
      }}
      className={className}
    >
      {!hasError && currentSrc ? (
        <img
          src={currentSrc}
          alt={alt}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={handleError}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            ...style
          }}
        />
      ) : (
        <span
          style={{
            fontWeight: 800,
            color: 'var(--slate-300)',
            fontSize: fontSize,
            letterSpacing: '0.5px',
            textTransform: 'uppercase'
          }}
        >
          {initials}
        </span>
      )}
    </div>
  );
}
