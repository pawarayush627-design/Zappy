import React, { useState, useEffect } from 'react';
import { Film } from 'lucide-react';
import { MediaItem } from '../types/media';

interface MediaArtworkProps {
  src: string;
  alt: string;
  item: MediaItem;
  aspectRatio?: 'poster' | 'backdrop';
  className?: string;
  priority?: boolean;
}

export const MediaArtwork: React.FC<MediaArtworkProps> = ({
  src,
  alt,
  item,
  aspectRatio = 'poster',
  className = '',
  priority = false,
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(priority);

  useEffect(() => {
    setHasError(false);
    setIsLoaded(priority);
  }, [src, priority]);

  if (hasError || !src) {
    return (
      <div
        className={`relative overflow-hidden flex flex-col justify-end p-4 sm:p-5 select-none ${
          aspectRatio === 'poster' ? 'aspect-[2/3]' : 'aspect-video'
        } ${className}`}
        style={{
          background: `radial-gradient(circle at 65% 28%, ${item.visualTheme.accentHex}38, ${item.visualTheme.primaryHex} 58%, #08090D 100%)`,
        }}
        role="img"
        aria-label={alt}
      >
        <div className="absolute inset-0 flex items-center justify-center opacity-15 pointer-events-none">
          <Film className="w-14 h-14 text-white" />
        </div>
        <div className="relative z-10 space-y-1">
          <p className="text-[11px] font-semibold tracking-wider uppercase text-[#FFB800]/90 truncate">
            {item.genres[0] || 'Cinema'} · {item.releaseYear}
          </p>
          <p className="text-sm sm:text-base font-extrabold text-white line-clamp-2 font-display leading-snug">
            {item.title}
          </p>
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      onLoad={() => setIsLoaded(true)}
      onError={() => setHasError(true)}
      className={`object-cover transition-opacity duration-500 ease-out ${
        aspectRatio === 'poster' ? 'aspect-[2/3]' : 'aspect-video'
      } ${isLoaded ? 'opacity-100' : 'opacity-0 zf-skeleton-shimmer'} ${className}`}
    />
  );
};
