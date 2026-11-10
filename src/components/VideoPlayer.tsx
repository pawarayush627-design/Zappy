import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Maximize,
  Minimize,
  X,
  CheckCircle2,
  Loader2,
  RotateCcw,
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
  autoPlay = false,
  selectedTrackIndex = 0,
  reloadKey = 0,
  isCompleted = false,
  onClose,
  onMarkWatched,
  onWatchComplete,
  onPlaybackProgress,
  onWatchProgress,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const [isStreamActive, setIsStreamActive] = useState<boolean>(autoPlay);
  const [iframeLoaded, setIframeLoaded] = useState<boolean>(false);
  const [reloadNonce, setReloadNonce] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
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
    }, 3200);
    return () => clearTimeout(t);
  }, [embedUrl, reloadNonce, reloadKey]);

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

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () =>
      document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;
    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video rounded-xl overflow-hidden bg-[#0F0F0F] border border-[#262626] shadow-2xl select-none flex flex-col"
    >
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-2.5 bg-[#141414] border-b border-[#262626] z-20">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#E50000] text-white text-[10px] sm:text-xs font-bold uppercase tracking-wider shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            4K Stream
          </span>
          <span className="text-xs sm:text-sm font-semibold text-white truncate">
            {item.title}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => {
              setIframeLoaded(false);
              setReloadNonce((n) => n + 1);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-[#1A1A1A] hover:bg-[#262626] border border-[#262626] text-[11px] font-medium text-[#999999] hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
            title="Reload Stream"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Reload</span>
          </button>

          {(onWatchComplete || onMarkWatched) && (
            <button
              type="button"
              onClick={() => {
                setMarkedWatched(true);
                onWatchComplete?.(item);
                onMarkWatched?.();
              }}
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                markedWatched
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                  : 'bg-[#1A1A1A] hover:bg-emerald-500/15 border-[#262626] hover:border-emerald-500/40 text-white'
              }`}
              title="Mark as Watched Fully (Automatically removes from Watchlist)"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{markedWatched ? 'Watched ✓' : 'Finish'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-[#1A1A1A] hover:bg-[#262626] border border-[#262626] text-[#999999] hover:text-white transition-colors cursor-pointer"
            aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize className="w-4 h-4" />
            ) : (
              <Maximize className="w-4 h-4" />
            )}
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-[#1A1A1A] hover:bg-[#E50000] border border-[#262626] text-[#999999] hover:text-white transition-colors cursor-pointer"
              aria-label="Close Player"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Viewport */}
      <div className="relative flex-1 w-full h-full bg-black overflow-hidden">
        {!isStreamActive ? (
          <div className="relative w-full h-full flex flex-col items-center justify-center p-6 text-center">
            <img
              src={item.backdropUrl || item.posterUrl}
              alt={item.title}
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover opacity-45"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/60 to-black/40" />

            <div className="relative z-10 max-w-lg space-y-4">
              <h3 className="text-xl sm:text-3xl font-bold text-white font-display">
                {item.title}
              </h3>
              <p className="text-xs sm:text-sm text-[#999999] line-clamp-2">
                {item.synopsis}
              </p>
              <div className="pt-1 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsStreamActive(true);
                    onWatchProgress?.(item, 1, 1);
                  }}
                  className="px-7 py-3.5 rounded-lg bg-[#E50000] hover:bg-[#FF1A1A] text-white font-semibold text-sm flex items-center gap-2.5 transition-all cursor-pointer shadow-lg shadow-[#E50000]/30"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Play Now</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative w-full h-full bg-black">
            {!iframeLoaded && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0F0F0F]/90 gap-3 pointer-events-none">
                <Loader2 className="w-9 h-9 text-[#E50000] animate-spin" />
                <p className="text-xs sm:text-sm text-white font-medium">
                  Starting stream for {item.title}...
                </p>
              </div>
            )}

            <iframe
              key={`${embedUrl}-${reloadNonce}-${reloadKey}`}
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
    </div>
  );
};
