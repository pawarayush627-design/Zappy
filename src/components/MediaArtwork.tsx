import React, { useState, useEffect, useRef, useMemo } from 'react';
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

/**
 * Normalizes and sanitizes artwork URLs so JustWatch / TMDB / Wikimedia / data URIs
 * never fail due to unresolved placeholders or mixed-content http URLs.
 */
function normalizeArtworkUrl(rawUrl: string | undefined | null, aspectRatio: 'poster' | 'backdrop'): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let cleaned = rawUrl.trim();
  if (!cleaned || cleaned === 'undefined' || cleaned === 'null') return '';

  // Fix unresolved JustWatch template placeholders if any exist in stored Firestore docs
  if (cleaned.includes('{profile}')) {
    cleaned = cleaned.replace('{profile}', aspectRatio === 'backdrop' ? 's1920' : 's718');
  }
  if (cleaned.includes('{format}')) {
    cleaned = cleaned.replace(/\.?\{format\}/g, '.webp');
  }
  if (cleaned.startsWith('//')) {
    cleaned = `https:${cleaned}`;
  } else if (cleaned.startsWith('http://')) {
    cleaned = `https://${cleaned.slice(7)}`;
  }
  return cleaned;
}

function toFastWebpArtworkUrl(url: string, aspectRatio: 'poster' | 'backdrop'): string {
  if (!url || !url.includes('images.justwatch.com')) return '';
  let fast = url;
  if (aspectRatio === 'backdrop') {
    fast = fast.replace('/s1920/', '/s1440/');
  } else {
    fast = fast.replace('/s718/', '/s592/');
  }
  fast = fast.replace(/\.(jpg|jpeg|png)$/i, '.webp');
  return fast !== url ? fast : '';
}

export const MediaArtwork: React.FC<MediaArtworkProps> = ({
  src,
  alt,
  item,
  aspectRatio = 'poster',
  className = '',
  priority = false,
}) => {
  const isBackdropOrPriority = aspectRatio === 'backdrop' || priority;
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Build ordered candidate URLs: try compressed WebP first (60-70% smaller for instant load),
  // then original URL, then alternate artwork URL before showing the stylized fallback card.
  const candidateUrls = useMemo(() => {
    const primary = normalizeArtworkUrl(src, aspectRatio);
    const primaryFastWebp = toFastWebpArtworkUrl(primary, aspectRatio);
    const secondary = normalizeArtworkUrl(
      aspectRatio === 'backdrop' ? item.posterUrl : item.backdropUrl,
      aspectRatio
    );
    const tertiary = normalizeArtworkUrl(
      aspectRatio === 'backdrop' ? item.backdropUrl : item.posterUrl,
      aspectRatio
    );
    const tertiaryFastWebp = toFastWebpArtworkUrl(tertiary, aspectRatio);
    const unique: string[] = [];
    for (const url of [primaryFastWebp, primary, tertiaryFastWebp, tertiary, secondary]) {
      if (url && !unique.includes(url)) {
        unique.push(url);
      }
    }
    return unique;
  }, [src, item.posterUrl, item.backdropUrl, aspectRatio]);

  const [candidateIndex, setCandidateIndex] = useState<number>(0);
  const [allFailed, setAllFailed] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState<boolean>(true);

  const activeUrl = candidateUrls[candidateIndex] || '';

  useEffect(() => {
    setCandidateIndex(0);
    setAllFailed(candidateUrls.length === 0);
  }, [candidateUrls]);

  // Immediately mark loaded if the browser already has the image in memory cache
  useEffect(() => {
    if (!activeUrl) {
      setAllFailed(true);
      return;
    }

    const imgEl = imgRef.current;
    if (imgEl && imgEl.complete && imgEl.naturalWidth > 0) {
      setIsLoaded(true);
      return;
    }

    // Backdrops and priority images stay visible immediately while decoding so they never flash blank
    setIsLoaded(isBackdropOrPriority);
  }, [activeUrl, isBackdropOrPriority]);

  const handleImageError = () => {
    if (candidateIndex + 1 < candidateUrls.length) {
      setCandidateIndex((prev) => prev + 1);
    } else {
      setAllFailed(true);
    }
  };

  const primaryHex = item.visualTheme?.primaryHex || '#14161D';
  const accentHex = item.visualTheme?.accentHex || '#FFB800';

  if (allFailed || !activeUrl) {
    return (
      <div
        className={`relative overflow-hidden flex flex-col justify-end p-4 sm:p-5 select-none ${
          aspectRatio === 'poster' ? 'aspect-[2/3]' : 'aspect-video'
        } ${className}`}
        style={{
          background: `radial-gradient(circle at 65% 28%, ${accentHex}38, ${primaryHex} 58%, #08090D 100%)`,
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
      ref={imgRef}
      src={activeUrl}
      alt={alt}
      referrerPolicy="no-referrer"
      loading={isBackdropOrPriority ? 'eager' : 'lazy'}
      decoding={isBackdropOrPriority ? 'sync' : 'async'}
      fetchPriority={isBackdropOrPriority ? 'high' : 'auto'}
      onLoad={() => setIsLoaded(true)}
      onError={handleImageError}
      style={{
        background: `radial-gradient(circle at 60% 30%, ${accentHex}22, ${primaryHex} 70%, #08090D 100%)`,
      }}
      className={`object-cover transition-opacity duration-300 ease-out ${
        aspectRatio === 'poster' ? 'aspect-[2/3]' : 'aspect-video'
      } ${isLoaded ? 'opacity-100' : 'opacity-90 zf-skeleton-shimmer'} ${className}`}
    />
  );
};
