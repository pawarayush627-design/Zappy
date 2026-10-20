import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Maximize2,
  Tv,
  Film,
} from 'lucide-react';
import { MediaItem, PlaybackResolutionResponse } from '../types/media';

interface VideoPlayerProps {
  item: MediaItem;
  playbackResolution?: PlaybackResolutionResponse | null;
  isResolvingPlayback?: boolean;
  selectedSeason?: number;
  selectedEpisodeNumber?: number;
  episodeTitle?: string;
  autoPlay?: boolean;
  onOpenAdminStudio?: () => void;
}

/**
 * Resolves the exact CineSrc.st embed URL for a Movie or TV Series episode:
 * - Movie: https://cinesrc.st/embed/movie/{tmdbId}
 * - TV Series: https://cinesrc.st/embed/tv/{tmdbId}?s={season}&e={episode}
 */
export function buildCineSrcEmbedUrl(
  item: MediaItem,
  seasonNumber = 1,
  episodeNumber = 1
): string {
  if (item.cinesrcEmbedUrl && item.cinesrcEmbedUrl.trim() !== '') {
    let base = item.cinesrcEmbedUrl.trim();
    if (!base.startsWith('http')) {
      base = `https://${base.replace(/^\/+/, '')}`;
    }
    // Normalize /embed/series/ to /embed/tv/ if needed
    base = base.replace(/\/embed\/(series|show)\//i, '/embed/tv/');

    if (item.mediaType === 'tv' || item.contentType === 'series') {
      const urlObj = new URL(base);
      urlObj.searchParams.set('s', String(seasonNumber));
      urlObj.searchParams.set('e', String(episodeNumber));
      return urlObj.toString();
    }
    return base;
  }

  if (item.mediaType === 'tv' || item.contentType === 'series') {
    return `https://cinesrc.st/embed/tv/${item.tmdbId}?s=${seasonNumber}&e=${episodeNumber}`;
  }
  return `https://cinesrc.st/embed/movie/${item.tmdbId}`;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  item,
  selectedSeason = 1,
  selectedEpisodeNumber = 1,
  episodeTitle,
}) => {
  const [iframeLoading, setIframeLoading] = useState<boolean>(true);
  const embedUrl = buildCineSrcEmbedUrl(
    item,
    selectedSeason,
    selectedEpisodeNumber
  );

  useEffect(() => {
    setIframeLoading(true);
  }, [embedUrl, item.id]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="relative aspect-video w-full rounded-3xl overflow-hidden bg-black border border-white/15 shadow-2xl select-none"
    >
      {/* Top CineSrc.st Stream Status Header Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 p-3 sm:p-4 bg-gradient-to-b from-black/90 via-black/40 to-transparent flex items-center justify-between gap-3 pointer-events-none">
        <div className="min-w-0 flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-[#B892FF]/20 border border-[#B892FF]/40 text-[#B892FF] text-[11px] font-mono-tabular font-bold flex items-center gap-1.5 shrink-0">
            {item.mediaType === 'tv' ? (
              <Tv className="w-3.5 h-3.5" />
            ) : (
              <Film className="w-3.5 h-3.5" />
            )}
            <span>CINESRC.ST EMBED</span>
          </span>
          <p className="text-xs sm:text-sm font-bold text-white truncate font-display">
            {item.title}{' '}
            {item.mediaType === 'tv'
              ? `— S${selectedSeason}:E${selectedEpisodeNumber}`
              : ''}{' '}
            {episodeTitle ? `(${episodeTitle})` : ''}
          </p>
        </div>

        <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 border border-white/10 text-[11px] font-mono-tabular text-zinc-300">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>TMDB #{item.tmdbId}</span>
        </span>
      </div>

      {/* Loading Indicator while CineSrc.st Embed Loads */}
      {iframeLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0D0A14]/90 pointer-events-none">
          <Loader2 className="w-10 h-10 text-[#B892FF] animate-spin mb-3" />
          <p className="text-xs sm:text-sm font-bold text-white font-display">
            Loading CineSrc.st Stream ({item.title})...
          </p>
          <p className="text-[11px] text-zinc-400 font-mono-tabular mt-1">
            {embedUrl}
          </p>
        </div>
      )}

      {/* Embedded CineSrc.st Player Iframe */}
      <iframe
        key={embedUrl}
        src={embedUrl}
        title={`${item.title} CineSrc.st Video Player`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
        allowFullScreen
        referrerPolicy="origin"
        onLoad={() => setIframeLoading(false)}
        className="w-full h-full border-0 bg-black"
      />
    </motion.div>
  );
};
