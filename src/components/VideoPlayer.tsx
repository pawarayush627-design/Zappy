import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { MediaItem, PlaybackResolutionResponse } from '../types/media';

export interface VideoPlayerProps {
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
  hasProgress?: boolean;
  selectedTrackIndex?: number;
  reloadKey?: number;
  onOpenAdminStudio?: () => void;
  onNextEpisode?: () => void;
  onMarkWatched?: () => void;
  onStartOver?: () => void;
  onPlaybackProgress?: (
    progressPercent?: number,
    remainingMinutes?: number,
    seasonFromPlayer?: number,
    episodeFromPlayer?: number
  ) => void;
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

export const STREAM_TRACKS: StreamTrackOption[] = [
  {
    id: 'vidly-primary',
    label: 'Server 1',
    buildUrl: (_stablePrimaryId, tmdbNumericId, _imdbId, isTv, s, e) => {
      const tmdb = tmdbNumericId > 0 ? tmdbNumericId : 157336;
      if (isTv) {
        return `https://vidly.pro/tv/${tmdb}/${s}/${e}`;
      }
      return `https://vidly.pro/movie/${tmdb}`;
    },
  },
  {
    id: 'vidly-fast',
    label: 'Server 2',
    buildUrl: (_stablePrimaryId, tmdbNumericId, _imdbId, isTv, s, e) => {
      const tmdb = tmdbNumericId > 0 ? tmdbNumericId : 157336;
      if (isTv) {
        return `https://vidly.pro/tv/${tmdb}/${s}/${e}?autoplay=1`;
      }
      return `https://vidly.pro/movie/${tmdb}?autoplay=1`;
    },
  },
  {
    id: 'vidly-mirror',
    label: 'Server 3',
    buildUrl: (_stablePrimaryId, tmdbNumericId, _imdbId, isTv, s, e) => {
      const tmdb = tmdbNumericId > 0 ? tmdbNumericId : 157336;
      if (isTv) {
        return `https://vidly.pro/embed/tv/${tmdb}/${s}/${e}`;
      }
      return `https://vidly.pro/embed/movie/${tmdb}`;
    },
  },
];

export function buildVidlyUrl(
  item: MediaItem,
  seasonNumber = 1,
  episodeNumber = 1
): string {
  const isTv = item.mediaType === 'tv' || item.contentType === 'series';
  const s = Math.max(1, Number(seasonNumber) || 1);
  const e = Math.max(1, Number(episodeNumber) || 1);
  const { initialTmdbId } = extractImmediateIdentifiers(item);
  const tmdb = initialTmdbId > 0 ? initialTmdbId : 157336;
  if (isTv) {
    return `https://vidly.pro/tv/${tmdb}/${s}/${e}`;
  }
  return `https://vidly.pro/movie/${tmdb}`;
}

export const buildEmbedMasterUrl = buildVidlyUrl;
export const buildCineSrcEmbedUrl = buildVidlyUrl;
export const buildVidLinkEmbedUrl = buildVidlyUrl;
export const buildZappyStreamUrl = buildVidlyUrl;

export const VideoPlayer: React.FC<VideoPlayerProps> = React.memo(
  ({
    item,
    selectedSeason = 1,
    selectedEpisodeNumber = 1,
    selectedTrackIndex = 0,
    reloadKey = 0,
    onMarkWatched,
    onPlaybackProgress,
  }) => {
    const playerWrapperRef = useRef<HTMLDivElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const loaderOverlayRef = useRef<HTMLDivElement>(null);
    const markedWatchedRef = useRef<boolean>(false);
    const playbackStartedRef = useRef<boolean>(false);
    const lastReportedPercentRef = useRef<number>(0);
    const onMarkWatchedRef = useRef(onMarkWatched);
    onMarkWatchedRef.current = onMarkWatched;
    const onPlaybackProgressRef = useRef(onPlaybackProgress);
    onPlaybackProgressRef.current = onPlaybackProgress;

    const isTv = item.mediaType === 'tv' || item.contentType === 'series';
    const sNum = Math.max(1, Number(selectedSeason) || 1);
    const eNum = Math.max(1, Number(selectedEpisodeNumber) || 1);

    // 100% synchronous & locked per item so background fetches NEVER change the iframe src
    const immediateIds = useMemo(
      () => extractImmediateIdentifiers(item),
      [item.id, item.tmdbId, item.cinesrcEmbedUrl]
    );

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
    }, [embedUrl, reloadKey, showLoaderOverlay, hideLoaderOverlay]);

    useEffect(() => {
      markedWatchedRef.current = false;
      playbackStartedRef.current = false;
      lastReportedPercentRef.current = 0;
    }, [item.id, sNum, eNum]);

    // Detect user clicking into the embedded player iframe to start playback
    useEffect(() => {
      const handleWindowBlur = () => {
        if (
          document.activeElement === iframeRef.current &&
          !playbackStartedRef.current
        ) {
          playbackStartedRef.current = true;
          onPlaybackProgressRef.current?.(undefined, undefined, sNum, eNum);
        }
      };
      window.addEventListener('blur', handleWindowBlur);
      return () => window.removeEventListener('blur', handleWindowBlur);
    }, [sNum, eNum]);

    // Listen for Vidly & iframe postMessage events (VIDLY_PLAYER_EVENT, SYNC_HISTORY, play, timeupdate, ended)
    useEffect(() => {
      const handleMessage = (event: MessageEvent) => {
        const data = event.data;
        if (!data || typeof data !== 'object') return;

        if (
          data.type === 'VIDLY_PLAYER_EVENT' ||
          data.type === 'SYNC_HISTORY' ||
          data.source === 'vidly_player' ||
          data.source === 'embedmaster_player' ||
          data.event ||
          data.type
        ) {
          hideLoaderOverlay();
          const inner = data.data || data.info || data;
          const ev = String(
            inner?.event || data.event || data.type || ''
          ).toLowerCase();

          const reportedSeason =
            Number(inner?.season) >= 1 ? Number(inner.season) : sNum;
          const reportedEpisode =
            Number(inner?.episode) >= 1 ? Number(inner.episode) : eNum;

          if (ev === 'play' || ev === 'playing') {
            if (!playbackStartedRef.current) {
              playbackStartedRef.current = true;
              onPlaybackProgressRef.current?.(
                undefined,
                undefined,
                reportedSeason,
                reportedEpisode
              );
            }
          } else if (ev === 'ended' || ev === 'finish' || ev === 'complete') {
            if (!markedWatchedRef.current && onMarkWatchedRef.current) {
              markedWatchedRef.current = true;
              onMarkWatchedRef.current();
            }
          } else if (
            ev === 'time' ||
            ev === 'timeupdate' ||
            data.type === 'SYNC_HISTORY'
          ) {
            const current = Number(
              inner?.currentTime ?? inner?.watched ?? inner?.time ?? 0
            );
            const total = Number(inner?.duration ?? 0);
            if (total > 0 && current > 0) {
              const pct = Math.min(
                99,
                Math.max(1, Math.round((current / total) * 100))
              );
              const remMins = Math.max(1, Math.round((total - current) / 60));
              if (
                !playbackStartedRef.current ||
                Math.abs(pct - lastReportedPercentRef.current) >= 2
              ) {
                playbackStartedRef.current = true;
                lastReportedPercentRef.current = pct;
                onPlaybackProgressRef.current?.(
                  pct,
                  remMins,
                  reportedSeason,
                  reportedEpisode
                );
              }
            }
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
    }, [hideLoaderOverlay, sNum, eNum]);

    return (
      <div className="-mx-3 sm:mx-0 w-[calc(100%+1.5rem)] sm:w-full rounded-none sm:rounded-2xl overflow-hidden bg-[#08090D] border-y sm:border border-[#292C35] shadow-2xl">
        {/* Spacious Mobile Player + 16:9 Widescreen Desktop Container */}
        <div
          ref={playerWrapperRef}
          className="relative w-full min-h-[265px] h-[44vh] max-h-[390px] sm:min-h-0 sm:h-auto sm:max-h-none sm:aspect-video bg-black overflow-hidden"
        >
          <div
            ref={loaderOverlayRef}
            style={{ opacity: 1, transition: 'opacity 150ms ease-out' }}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#08090D] pointer-events-none"
          >
            <Loader2 className="w-8 h-8 text-[#FFC400] animate-spin mb-2" />
            <p className="text-xs sm:text-sm font-semibold text-white">
              Loading {item.title}
              {isTv ? ` · S${sNum} E${eNum}` : ''}...
            </p>
          </div>

          <iframe
            id="vidly_iframe"
            ref={iframeRef}
            key={`${embedUrl}-${reloadKey}`}
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
    prev.selectedTrackIndex === next.selectedTrackIndex &&
    prev.reloadKey === next.reloadKey &&
    prev.isCompleted === next.isCompleted &&
    prev.hasProgress === next.hasProgress
);
