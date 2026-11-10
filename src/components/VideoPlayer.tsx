import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Loader2,
} from 'lucide-react';
import { MediaItem } from '../types/media';

export interface StreamTrackOption {
  id: string;
  label: string;
  buildUrl: (tmdbId: number) => string;
}

export const STREAM_TRACKS: StreamTrackOption[] = [
  {
    id: 'vidly',
    label: 'Server 1 (Vidly 4K)',
    buildUrl: (tmdbId) => `https://vidly.pro/movie/${tmdbId}`,
  },
  {
    id: 'vidlink',
    label: 'Server 2 (VidLink HD)',
    buildUrl: (tmdbId) => `https://vidlink.pro/movie/${tmdbId}`,
  },
  {
    id: 'embedmaster',
    label: 'Server 3 (Backup)',
    buildUrl: (tmdbId) => `https://embedmaster.link/movie/${tmdbId}`,
  },
];

interface VideoPlayerProps {
  item: MediaItem;
  autoPlay?: boolean;
  selectedTrackIndex?: number;
  reloadKey?: number;
  isCompleted?: boolean;
  hasProgress?: boolean;
  onClose?: () => void;
  onMarkWatched?: () => void;
  onWatchComplete?: (item: MediaItem) => void;
  onPlaybackProgress?: (
    progressPercent: number,
    remainingMinutes: number,
    seasonNumber?: number,
    episodeNumber?: number
  ) => void;
  onWatchProgress?: (
    item: MediaItem,
    seasonNumber: number,
    episodeNumber: number,
    progressPercent?: number,
    remainingMinutes?: number
  ) => void;
}

/**
 * Builds the Vidly.pro embed URL for a Movie using the numeric TMDb ID.
 */
export function buildVidlyEmbedUrl(
  item: MediaItem,
  trackIndex = 0
): string {
  const numMatch = (item.cinesrcEmbedUrl || '').match(
    /(?:movie|tv|series|show)\/(\d+)/i
  );
  const rawTmdb =
    Number(item.tmdbId) || (numMatch?.[1] ? Number(numMatch[1]) : 0);
  const tmdb = rawTmdb > 0 && rawTmdb !== 10000 ? rawTmdb : 157336;
  const track = STREAM_TRACKS[trackIndex] || STREAM_TRACKS[0];
  return track.buildUrl(tmdb);
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  item,
  autoPlay = true,
  selectedTrackIndex = 0,
  reloadKey = 0,
  isCompleted = false,
  onMarkWatched,
  onWatchComplete,
  onPlaybackProgress,
  onWatchProgress,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const [isStreamActive, setIsStreamActive] = useState<boolean>(autoPlay);
  const [iframeLoaded, setIframeLoaded] = useState<boolean>(false);
  const [markedWatched, setMarkedWatched] = useState<boolean>(isCompleted);
  const elapsedSecondsRef = useRef<number>(0);

  const embedUrl = buildVidlyEmbedUrl(item, selectedTrackIndex);

  useEffect(() => {
    setIframeLoaded(false);
    setMarkedWatched(isCompleted);
    elapsedSecondsRef.current = 0;
    if (autoPlay) {
      setIsStreamActive(true);
    }
  }, [item.id, item.tmdbId, autoPlay, selectedTrackIndex, reloadKey, isCompleted]);

  useEffect(() => {
    const t = setTimeout(() => {
      setIframeLoaded(true);
    }, 3000);
    return () => clearTimeout(t);
  }, [embedUrl, reloadKey]);

  useEffect(() => {
    if (!isStreamActive) return;

    const totalMinutes = Math.max(15, item.durationMinutes || 110);
    const totalSeconds = totalMinutes * 60;

    onWatchProgress?.(item, 1, 1);

    const interval = setInterval(() => {
      elapsedSecondsRef.current += 10;
      const simulatedElapsed = elapsedSecondsRef.current * 4;
      const pct = Math.min(
        98,
        Math.max(4, Math.round((simulatedElapsed / totalSeconds) * 100))
      );
      const remainingMins = Math.max(
        1,
        Math.round(((100 - pct) / 100) * totalMinutes)
      );

      onWatchProgress?.(item, 1, 1, pct, remainingMins);
      onPlaybackProgress?.(pct, remainingMins, 1, 1);

      if (pct >= 95 && !markedWatched) {
        setMarkedWatched(true);
        onWatchComplete?.(item);
        onMarkWatched?.();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [
    item,
    isStreamActive,
    markedWatched,
    onWatchProgress,
    onPlaybackProgress,
    onWatchComplete,
    onMarkWatched,
  ]);

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video min-h-[250px] sm:min-h-[440px] lg:min-h-[560px] rounded-xl overflow-hidden bg-black border border-[#232632] shadow-2xl select-none"
    >
      {!isStreamActive ? (
        <div
          onClick={() => {
            setIsStreamActive(true);
            onWatchProgress?.(item, 1, 1);
          }}
          className="relative w-full h-full flex items-center justify-center cursor-pointer group"
        >
          <img
            src={item.backdropUrl || item.posterUrl}
            alt={item.title}
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
          <div className="absolute inset-0 bg-black/35 group-hover:bg-black/25 transition-colors" />

          <div className="relative z-10 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-r from-[#FFB800] via-[#FF5A36] to-[#FF168B] text-white flex items-center justify-center shadow-2xl transition-transform duration-200 group-hover:scale-110">
            <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-current ml-1" />
          </div>
        </div>
      ) : (
        <div className="relative w-full h-full bg-black">
          {!iframeLoaded && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#08090D] gap-3 pointer-events-none">
              <Loader2 className="w-9 h-9 text-[#FFB800] animate-spin" />
              <p className="text-xs sm:text-sm text-white font-medium">
                Loading {item.title}...
              </p>
            </div>
          )}

          <iframe
            key={`${embedUrl}-${reloadKey}`}
            src={embedUrl}
            title={`${item.title} Video Stream`}
            className="w-full h-full border-0 bg-black"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            allowFullScreen
            referrerPolicy="origin"
            onLoad={() => setIframeLoaded(true)}
          />
        </div>
      )}
    </div>
  );
};
