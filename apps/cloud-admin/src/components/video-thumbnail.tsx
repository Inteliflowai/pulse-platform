'use client';

import { useState, useRef, useEffect } from 'react';
import { Film } from 'lucide-react';

interface VideoThumbnailProps {
  src: string | null;
  filename: string;
  mimeType: string | null;
  className?: string;
}

export function VideoThumbnail({ src, filename, mimeType, className = '' }: VideoThumbnailProps) {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!src || !mimeType?.startsWith('video/')) return;

    // Generate thumbnail from video
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'metadata';

    video.onloadeddata = () => {
      video.currentTime = Math.min(1, video.duration * 0.1); // 10% into the video
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 90;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          setThumbnail(canvas.toDataURL('image/jpeg', 0.7));
        }
      } catch {
        setError(true);
      }
      video.src = '';
    };

    video.onerror = () => setError(true);
    video.src = src;

    return () => { video.src = ''; };
  }, [src, mimeType]);

  if (thumbnail) {
    return <img src={thumbnail} alt={filename} className={`rounded object-cover ${className}`} />;
  }

  const isVideo = mimeType?.startsWith('video/');
  const isImage = mimeType?.startsWith('image/');

  if (isImage && src) {
    return <img src={src} alt={filename} className={`rounded object-cover ${className}`} />;
  }

  return (
    <div className={`rounded bg-brand-bg flex items-center justify-center ${className}`}>
      <Film className="h-5 w-5 text-gray-600" />
    </div>
  );
}
