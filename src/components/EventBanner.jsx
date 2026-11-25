import React from 'react';
import ImageWithFallback from './ImageWithFallback';
import { getDriveFileId } from '../services/api';

export default function EventBanner({ event, className }) {
  if (!event) return null;
  const driveId = getDriveFileId(event.bannerUrl) || getDriveFileId(event.driveViewUrl) || event.driveFileId;
  const src = event.bannerUrl?.trim() || event.driveViewUrl?.trim() ||
    (driveId ? `https://drive.google.com/file/d/${driveId}/view` : '');
  if (!src) return null;
  return <div className={className} style={className ? undefined : {height: '100%'}}>
    <ImageWithFallback src={src} driveId={driveId} size="w1000" alt={event.eventName || event.eventCode || 'Tournament banner'} />
  </div>;
}
