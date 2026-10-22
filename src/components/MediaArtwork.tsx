import React, { useState } from 'react';
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

  if (hasError || !src) {
    return (
      <div
        className={`relative overflow-hidden flex flex-col justify-end p-5 select-none ${className}`}
        style={{
          background: `radial-gradient(circle at 60% 35%, ${item.visualTheme.accentHex}33, ${item.visualTheme.primaryHex} 55%, #070709 100%)`,
        }}
        role="img"
        aria-label={alt}
      >
        <div className="absolute inset-0 flex items-center justify-center opacity-20">
          <Film className="w-16 h-16 text-white" />
        </div>
        <div className="relative z-10">
          <p className="text-xs font-medium tracking-wider uppercase text-zinc-400">
            {item.genres[0]} · {item.releaseYear}
          </p>
          <p className="text-base font-bold text-white mt-1 line-clamp-2 font-display">
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
      onError={() => setHasError(true)}
      className={`object-cover ${
        aspectRatio === 'poster' ? 'aspect-[2/3]' : 'aspect-video'
      } ${className}`}
    />
  );
};
