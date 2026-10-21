import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Maximize,
  Minimize,
  RotateCcw,
  SkipForward,
  Loader2,
  CheckCircle2,
  Server,
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
  isCompleted?: boolean;
  resolvedImdbId?: string;
  resolvedTmdbId?: number;
  onOpenAdminStudio?: () => void;
  onNextEpisode?: () => void;
  onMarkWatched?: () => void;
}

export interface StreamTrackOption {
  id: string;
  label: string;
  buildUrl: (
    stablePrimaryId: string,
    tmdbNumericId: number,
    imdbId: string,
    isTv: boolean,
    s: number,
    e: number
  ) => string;
}

/**
 * Extracts a 100% deterministic stream identifier synchronously from the item.
 * Never depends on async network calls so the iframe URL never changes after mount.
 */
function extractImmediateIdentifiers(item: MediaItem): {
  stablePrimaryId: string;
  initialTmdbId: number;
  initialImdbId: string;
} {
  let initialTmdbId = Number(item.tmdbId) || 0;
  let initialImdbId = '';

  if (item.cinesrcEmbedUrl && item.cinesrcEmbedUrl.trim() !== '') {
    const raw = item.cinesrcEmbedUrl.trim();
    const imdbMatch = raw.match(/(tt\d{5,12})/i);
    if (imdbMatch?.[1]) {
      initialImdbId = imdbMatch[1].toLowerCase();
    }
    const numMatch = raw.match(/(?:movie|tv|series|show)\/(\d+)/i);
    if (numMatch?.[1]) {
      const parsedNum = Number(numMatch[1]);
      if (parsedNum > 0 && parsedNum !== 10000) {
        initialTmdbId = parsedNum;
      }
    }
  }

  if (initialTmdbId === 10000) {
    initialTmdbId = 0;
  }

  if (
    initialImdbId &&
    initialTmdbId > 0 &&
    String(initialTmdbId) ===
      initialImdbId.replace(/\D/g, '').replace(/^0+/, '')
  ) {
    initialTmdbId = 0;
  }

  const stablePrimaryId =
    initialImdbId ||
    (initialTmdbId > 0 ? String(initialTmdbId) : '157336');

  return {
    stablePrimaryId,
    initialTmdbId: initialTmdbId > 0 ? initialTmdbId : 157336,
    initialImdbId,
  };
}

const STREAM_TRACKS: StreamTrackOption[] = [
  {
    id: 'embedmaster-primary',
    label: 'EmbedMaster Primary (10+ Servers)',
    buildUrl: (stablePrimaryId, _tmdbNumericId, _imdbId, isTv, s, e) => {
      if (isTv) {
        return `https://embedmaster.link/tv/${stablePrimaryId}/${s}/${e}`;
      }
      return `https://embedmaster.link/movie/${stablePrimaryId}`;
    },
  },
  {
    id: 'embedmaster-alt',
    label: 'EmbedMaster Alt-ID (TMDB/IMDb)',
    buildUrl: (stablePrimaryId, tmdbNumericId, imdbId, isTv, s, e) => {
      const altToken =
        stablePrimaryId.startsWith('tt') && tmdbNumericId > 0
          ? String(tmdbNumericId)
          : imdbId || String(tmdbNumericId) || stablePrimaryId;
      if (isTv) {
        return `https://embedmaster.link/tv/${altToken}/${s}/${e}`;
      }
      return `https://embedmaster.link/movie/${altToken}`;
    },
  },
  {
    id: 'vidsrc-multi',
    label: 'Multi-Server Stream 2',
    buildUrl: (stablePrimaryId, tmdbNumericId, imdbId, isTv, s, e) => {
      const useImdb =
        imdbId || (stablePrimaryId.startsWith('tt') ? stablePrimaryId : '');
      if (isTv) {
        return useImdb
          ? `https://vidsrc.xyz/embed/tv?imdb=${useImdb}&season=${s}&episode=${e}`
          : `https://vidsrc.xyz/embed/tv?tmdb=${tmdbNumericId}&season=${s}&episode=${e}`;
      }
      return useImdb
        ? `https://vidsrc.xyz/embed/movie?imdb=${useImdb}`
        : `https://vidsrc.xyz/embed/movie?tmdb=${tmdbNumericId}`;
    },
  },
  {
    id: 'backup-cdn-1',
    label: 'Backup Server 1',
    buildUrl: (_stablePrimaryId, tmdbNumericId, _imdbId, isTv, s, e) => {
      if (isTv) {
        return `https://vidlink.pro/tv/${tmdbNumericId}/${s}/${e}?primaryColor=E50000&secondaryColor=141414&autoplay=true`;
      }
      return `https://vidlink.pro/movie/${tmdbNumericId}?primaryColor=E50000&secondaryColor=141414&autoplay=true`;
    },
  },
  {
    id: 'backup-cdn-2',
    label: 'Backup Server 2',
    buildUrl: (_stablePrimaryId, tmdbNumericId, _imdbId, isTv, s, e) => {
      if (isTv) {
        return `https://cinesrc.st/embed/tv/${tmdbNumericId}?s=${s}&e=${e}`;
      }
      return `https://cinesrc.st/embed/movie/${tmdbNumericId}`;
    },
  },
];

export function buildEmbedMasterUrl(
  item: MediaItem,
  seasonNumber = 1,
  episodeNumber = 1
): string {
  const isTv = item.mediaType === 'tv' || item.contentType === 'series';
  const s = Math.max(1, Number(seasonNumber) || 1);
  const e = Math.max(1, Number(episodeNumber) || 1);
  const { stablePrimaryId, initialTmdbId, initialImdbId } =
    extractImmediateIdentifiers(item);
  return STREAM_TRACKS[0].buildUrl(
    stablePrimaryId,
    initialTmdbId,
    initialImdbId,
    isTv,
    s,
    e
  );
}

export const buildCineSrcEmbedUrl = buildEmbedMasterUrl;
export const buildVidLinkEmbedUrl = buildEmbedMasterUrl;
export const buildZappyStreamUrl = buildEmbedMasterUrl;

export const VideoPlayer: React.FC<VideoPlayerProps> = React.memo(
  ({
    item,
    selectedSeason = 1,
    selectedEpisodeNumber = 1,
    episodeTitle,
    isCompleted = false,
    onNextEpisode,
    onMarkWatched,
  }) => {
    const playerWrapperRef = useRef<HTMLDivElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const loaderOverlayRef = useRef<HTMLDivElement>(null);
    const markedWatchedRef = useRef<boolean>(false);
    const onMarkWatchedRef = useRef(onMarkWatched);
    onMarkWatchedRef.current = onMarkWatched;

    const isTv = item.mediaType === 'tv' || item.contentType === 'series';
    const sNum = Math.max(1, Number(selectedSeason) || 1);
    const eNum = Math.max(1, Number(selectedEpisodeNumber) || 1);

    // 100% synchronous & locked per item so background fetches NEVER change the iframe src
    const immediateIds = useMemo(
      () => extractImmediateIdentifiers(item),
      [item.id, item.tmdbId, item.cinesrcEmbedUrl]
    );

    const [selectedTrackIndex, setSelectedTrackIndex] = useState<number>(0);
    const [reloadNonce, setReloadNonce] = useState<number>(0);
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

    const activeTrack = STREAM_TRACKS[selectedTrackIndex] || STREAM_TRACKS[0];

    const embedUrl = useMemo(
      () =>
        activeTrack.buildUrl(
          immediateIds.stablePrimaryId,
          immediateIds.initialTmdbId,
          immediateIds.initialImdbId,
          isTv,
          sNum,
          eNum
        ),
      [
        activeTrack,
        immediateIds.stablePrimaryId,
        immediateIds.initialTmdbId,
        immediateIds.initialImdbId,
        isTv,
        sNum,
        eNum,
      ]
    );

    const hideLoaderOverlay = useCallback(() => {
      if (loaderOverlayRef.current) {
        loaderOverlayRef.current.style.opacity = '0';
        loaderOverlayRef.current.style.pointerEvents = 'none';
      }
    }, []);

    const showLoaderOverlay = useCallback(() => {
      if (loaderOverlayRef.current) {
        loaderOverlayRef.current.style.opacity = '1';
      }
    }, []);

    // Pure DOM opacity fade on initial stream load only (Zero React state re-render!)
    useEffect(() => {
      showLoaderOverlay();
      const timer = window.setTimeout(() => {
        hideLoaderOverlay();
      }, 650);
      return () => window.clearTimeout(timer);
    }, [embedUrl, reloadNonce, showLoaderOverlay, hideLoaderOverlay]);

    useEffect(() => {
      markedWatchedRef.current = false;
    }, [item.id]);

    // Listen for EmbedMaster postMessage events (ready, play, time, ended)
    useEffect(() => {
      const handleMessage = (event: MessageEvent) => {
        const data = event.data;
        if (!data || typeof data !== 'object') return;

        if (data.source === 'embedmaster_player') {
          hideLoaderOverlay();
          const ev = String(data.event || '').toLowerCase();
          if (ev === 'ended' || ev === 'finish' || ev === 'complete') {
            if (!markedWatchedRef.current && onMarkWatchedRef.current) {
              markedWatchedRef.current = true;
              onMarkWatchedRef.current();
            }
          } else if (ev === 'time' || ev === 'timeupdate') {
            const info = data.info;
            const current = Number(info?.currentTime ?? info?.time ?? 0);
            const total = Number(info?.duration ?? 0);
            if (total > 60 && current / total >= 0.9) {
              if (!markedWatchedRef.current && onMarkWatchedRef.current) {
                markedWatchedRef.current = true;
                onMarkWatchedRef.current();
              }
            }
          }
        }
      };

      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }, [hideLoaderOverlay]);

    useEffect(() => {
      const onFsChange = () => {
        setIsFullscreen(Boolean(document.fullscreenElement));
      };
      document.addEventListener('fullscreenchange', onFsChange);
      return () => document.removeEventListener('fullscreenchange', onFsChange);
    }, []);

    const toggleFullscreen = useCallback(async () => {
      const wrapper = playerWrapperRef.current;
      if (!wrapper) return;
      try {
        if (!document.fullscreenElement) {
          await wrapper.requestFullscreen();
        } else {
          await document.exitFullscreen();
        }
      } catch {
        // Ignore
      }
    }, []);

    return (
      <div className="w-full rounded-xl overflow-hidden bg-[#0F0F0F] border border-[#262626] shadow-2xl">
        {/* Static Control Bar Outside Video Surface */}
        <div className="px-3.5 py-2.5 bg-[#141414] border-b border-[#262626] flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 flex items-center gap-2.5">
            <span className="px-2 py-0.5 rounded bg-[#E50000] text-white text-[11px] font-bold tracking-wide uppercase shrink-0">
              {isTv ? `S${sNum} · E${eNum}` : 'MOVIE'}
            </span>
            <p className="text-xs sm:text-sm font-bold text-white truncate font-display">
              {item.title}
              {episodeTitle ? ` — ${episodeTitle}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {/* Stream Server Switcher */}
            <div className="flex items-center gap-1 bg-[#0F0F0F] border border-[#262626] rounded-lg px-2 py-1">
              <Server className="w-3.5 h-3.5 text-[#E50000] shrink-0" />
              <select
                value={selectedTrackIndex}
                onChange={(e) => setSelectedTrackIndex(Number(e.target.value))}
                aria-label="Select streaming server"
                className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer pr-1"
              >
                {STREAM_TRACKS.map((track, idx) => (
                  <option
                    key={track.id}
                    value={idx}
                    className="bg-[#141414] text-white"
                  >
                    {track.label}
                  </option>
                ))}
              </select>
            </div>

            {onMarkWatched && (
              <button
                type="button"
                onClick={() => {
                  markedWatchedRef.current = true;
                  onMarkWatched();
                }}
                className={`min-h-[32px] px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  isCompleted
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-[#1A1A1A] hover:bg-[#262626] border-[#262626] text-zinc-200 hover:text-white'
                }`}
                title="Mark as fully watched (automatically removes from Watchlist)"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-[#E50000]" />
                <span>{isCompleted ? 'Watched' : 'Mark Watched'}</span>
              </button>
            )}

            {isTv && onNextEpisode && (
              <button
                type="button"
                onClick={onNextEpisode}
                className="min-h-[32px] px-2.5 py-1 rounded-lg bg-[#1A1A1A] hover:bg-[#262626] border border-[#262626] text-xs font-semibold text-white flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                title="Next Episode"
              >
                <SkipForward className="w-3.5 h-3.5 text-[#E50000]" />
                <span className="hidden sm:inline">Next Ep</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                showLoaderOverlay();
                setReloadNonce((n) => n + 1);
              }}
              className="min-h-[32px] min-w-[32px] rounded-lg bg-[#1A1A1A] hover:bg-[#262626] border border-[#262626] text-zinc-200 hover:text-white flex items-center justify-center cursor-pointer"
              title="Reload Stream"
              aria-label="Reload Stream"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              className="min-h-[32px] min-w-[32px] rounded-lg bg-[#1A1A1A] hover:bg-[#262626] border border-[#262626] text-zinc-200 hover:text-white flex items-center justify-center cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? (
                <Minimize className="w-3.5 h-3.5" />
              ) : (
                <Maximize className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Pure Unobstructed 16:9 Video Container */}
        <div
          ref={playerWrapperRef}
          className="relative aspect-video w-full bg-black overflow-hidden"
        >
          <div
            ref={loaderOverlayRef}
            style={{ opacity: 1, transition: 'opacity 150ms ease-out' }}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0F0F0F] pointer-events-none"
          >
            <Loader2 className="w-8 h-8 text-[#E50000] animate-spin mb-2" />
            <p className="text-xs sm:text-sm font-semibold text-white">
              Loading {item.title}
              {isTv ? ` · S${sNum} E${eNum}` : ''}...
            </p>
          </div>

          <iframe
            id="embedmaster_iframe"
            ref={iframeRef}
            key={`${embedUrl}-${reloadNonce}`}
            src={embedUrl}
            title={`${item.title} Stream`}
            allow="autoplay *; fullscreen *; picture-in-picture *; encrypted-media *"
            allowFullScreen
            onLoad={hideLoaderOverlay}
            className="w-full h-full border-0 bg-black block"
          />
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.item.id === next.item.id &&
    prev.item.cinesrcEmbedUrl === next.item.cinesrcEmbedUrl &&
    prev.item.tmdbId === next.item.tmdbId &&
    prev.selectedSeason === next.selectedSeason &&
    prev.selectedEpisodeNumber === next.selectedEpisodeNumber &&
    prev.isCompleted === next.isCompleted
);
