import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ShieldCheck,
  Plus,
  Trash2,
  Film,
  Tv,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Wand2,
  Loader2,
  LogIn,
  Image as ImageIcon,
  Play,
  Edit3,
  Users,
  MessageSquare,
  Mail,
  Phone,
  Clock,
  Eye,
  Search,
  Globe,
  ExternalLink,
  Layers,
  Database,
  Copy,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  getDoc,
} from 'firebase/firestore';
import {
  db,
  ADMIN_EMAIL,
  isUserAdmin,
  signInWithGoogle,
  handleFirestoreError,
  OperationType,
  ACTIVE_FIREBASE_PROJECT_ID,
  getActiveFirebaseTarget,
  setActiveFirebaseTarget,
} from '../firebase';
import {
  Genre,
  MediaItem,
  PersonCredit,
  SupportMessageItem,
  TMDBMediaType,
  VideoAdConfig,
} from '../types/media';
import { ALL_GENRES } from '../data/catalog';
import {
  createPosterDataUri,
  createBackdropDataUri,
} from '../utils/artworkGenerator';
import { VideoPlayer } from './VideoPlayer';

const LOGO_ASSET_URL =
  '/assets/aistudio/file_000000003a7c8208a896f64f3d00ee88-removebg-preview_03ffad4d.png';

const ZAPPYFUN_FIRESTORE_RULES_SNIPPET = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }
    function isAdmin() {
      return isSignedIn() && request.auth.token.email == 'pawarayushai1@gmail.com';
    }
    match /catalog/{mediaId} {
      allow read: if true;
      allow write: if isAdmin();
    }
    match /watchlists/{watchlistDocId} {
      allow read, write: if isSignedIn();
    }
    match /support_messages/{messageId} {
      allow create: if isSignedIn();
      allow read, update, delete: if isAdmin() || (isSignedIn() && resource.data.senderUid == request.auth.uid);
    }
    match /ui_config/{configId} {
      allow read: if true;
      allow write: if isAdmin();
    }
    match /ui_overrides/{overrideId} {
      allow read: if true;
      allow write: if isAdmin();
    }
  }
}`;

interface JustWatchBrowseCard {
  title: string;
  releaseYear: number;
  synopsis: string;
  tagline: string;
  durationMinutes: number;
  maturityRating: 'G' | 'PG' | 'PG-13' | 'TV-PG' | 'TV-14';
  genres: Genre[];
  tmdbId: number | null;
  imdbId: string | null;
  imdbScore: number | null;
  popularScore: number;
  mediaType: TMDBMediaType;
  contentType: 'movie' | 'series';
  seasonsCount: number;
  episodesCount: number;
  posterUrl: string;
  backdropUrl: string;
  extraBackdrops: string[];
  directorOrCreator: string;
  cast: string[];
  justWatchUrl: string;
  cinesrcEmbedUrl: string;
}

interface BatchLinkResultItem {
  index: number;
  rawInput: string;
  status: 'pending' | 'extracting' | 'extracted' | 'published' | 'error';
  errorText?: string;
  extractedData?: any;
  draftItem?: MediaItem;
}

interface AdminStudioModalProps {
  isOpen: boolean;
  currentUser: User | null;
  prefillMedia?: MediaItem | null;
  catalog: MediaItem[];
  videoAdConfig: VideoAdConfig;
  supportMessages?: SupportMessageItem[];
  initialTab?: 'catalog' | 'support';
  heroBatchInfo?: {
    activeBatchNumber: number;
    totalBatches: number;
    hoursUntilNextBatch: number;
    currentHeroMovies: MediaItem[];
  };
  onAdvanceHeroBatch?: () => Promise<void> | void;
  onResetHeroCycleNow?: () => Promise<void> | void;
  onUpdateSupportStatus?: (
    msg: SupportMessageItem,
    nextStatus: 'open' | 'resolved'
  ) => Promise<void>;
  onDeleteSupportMessage?: (msg: SupportMessageItem) => Promise<void>;
  onClose: () => void;
  onSelectMediaToWatch?: (item: MediaItem) => void;
  onPreviewDraftInApp?: (draftItem: MediaItem) => void;
  onLaunchVisualEditor?: () => void;
}

/**
 * Builds the EmbedMaster embed URL for a Movie or TV Show while preserving
 * both IMDb IDs (tt...) and numeric TMDB IDs without corrupting tmdbId.
 */
export function parseOrBuildCineSrcUrl(
  rawInput: string,
  fallbackType: TMDBMediaType,
  fallbackTmdbId: number
): {
  embedUrl: string;
  detectedType: TMDBMediaType;
  detectedTmdbId: number;
} {
  const trimmed = rawInput.trim();
  const streamRegex =
    /(?:https?:\/\/)?(?:www\.)?(?:embedmaster\.link|embedmaster\.com|cinesrc\.st|vidlink\.pro)(?:\/embed)?\/(movie|tv|series|show)\/(tt\d+|\d+)/i;

  const cleanFallbackTmdb =
    Number.isInteger(fallbackTmdbId) &&
    fallbackTmdbId > 0 &&
    fallbackTmdbId !== 10000
      ? fallbackTmdbId
      : 0;

  const match = trimmed.match(streamRegex);
  if (match) {
    const rawType = match[1].toLowerCase();
    const detectedType: TMDBMediaType =
      rawType === 'tv' || rawType === 'series' || rawType === 'show'
        ? 'tv'
        : 'movie';
    const rawId = match[2];
    const isImdb = /^tt\d+$/i.test(rawId);
    const detectedTmdbId = isImdb
      ? cleanFallbackTmdb || 157336
      : Number(rawId) || cleanFallbackTmdb || 157336;
    const streamId = isImdb ? rawId.toLowerCase() : String(detectedTmdbId);
    const embedUrl =
      detectedType === 'tv'
        ? `https://embedmaster.link/tv/${streamId}/1/1`
        : `https://embedmaster.link/movie/${streamId}`;
    return {
      embedUrl,
      detectedType,
      detectedTmdbId,
    };
  }

  const finalTmdbId = cleanFallbackTmdb || 157336;
  const embedUrl =
    fallbackType === 'tv'
      ? `https://embedmaster.link/tv/${finalTmdbId}/1/1`
      : `https://embedmaster.link/movie/${finalTmdbId}`;
  return {
    embedUrl,
    detectedType: fallbackType,
    detectedTmdbId: finalTmdbId,
  };
}

const RESERVED_NON_TITLE_PATHS = new Set([
  'search',
  'movies',
  'tv-shows',
  'tv-series',
  'popular',
  'new',
  'lists',
  'watchlist',
  'provider',
  'providers',
  'guide',
  'about',
]);

/**
 * Parses up to 150 JustWatch links or titles from any bulk text format:
 * - Comma-separated, newline-separated, semicolon-separated
 * - Space-separated URLs or glued URLs (https://...https://...)
 * - Automatically strips out bare non-title links like /in/search or /in/movies
 */
function parseBulkJustWatchLinks(rawText: string): string[] {
  if (!rawText || !rawText.trim()) return [];

  // Ensure glued or space-separated URLs are separated by newlines before splitting
  const normalized = rawText
    .replace(/([^\s,;])\s*(https?:\/\/)/gi, '$1\n$2')
    .replace(/([^\s,;/])\s*((?:www\.)?justwatch\.com\/)/gi, '$1\nhttps://$2');

  const rawTokens = normalized
    .split(/[\n,;|\t]+/)
    .flatMap((chunk) => {
      const trimmedChunk = chunk.trim();
      if (!trimmedChunk) return [];
      const urlMatches = trimmedChunk.match(/https?:\/\/[^\s,;"'<>]+/gi);
      if (urlMatches && urlMatches.length > 1) {
        return urlMatches;
      }
      return [trimmedChunk];
    })
    .map((token) =>
      token
        .replace(/^\d+[\.\)\-:]\s*/, '')
        .replace(/^["'`]+|["'`.,;]+$/g, '')
        .trim()
    )
    .filter(Boolean);

  const unique: string[] = [];
  const seenKeys = new Set<string>();

  for (const token of rawTokens) {
    if (
      token.startsWith('http://') ||
      token.startsWith('https://') ||
      token.includes('justwatch.com')
    ) {
      try {
        const u = new URL(
          token.startsWith('http') ? token : `https://${token}`
        );
        const qParam = (
          u.searchParams.get('q') ||
          u.searchParams.get('query') ||
          u.searchParams.get('title') ||
          ''
        ).trim();
        const pathParts = decodeURIComponent(u.pathname)
          .replace(/\/+$/, '')
          .replace(/\/season-\d+.*$/i, '')
          .split('/')
          .filter(Boolean);
        const hasCountry = Boolean(
          pathParts[0] && /^[a-z]{2}$/i.test(pathParts[0])
        );
        const typeSeg = (
          hasCountry ? pathParts[1] || '' : pathParts[0] || ''
        ).toLowerCase();
        const slugSeg = (
          hasCountry ? pathParts[2] || '' : pathParts[1] || ''
        ).toLowerCase();

        // Skip bare navigation links like https://www.justwatch.com/in/search (with no ?q= and no movie slug)
        if (!qParam) {
          if (!typeSeg && !slugSeg) continue;
          if (
            RESERVED_NON_TITLE_PATHS.has(typeSeg) &&
            (!slugSeg || RESERVED_NON_TITLE_PATHS.has(slugSeg))
          ) {
            continue;
          }
          if (!slugSeg) continue;
        }
      } catch {
        // Keep token if URL parse fails
      }
    } else if (RESERVED_NON_TITLE_PATHS.has(token.toLowerCase())) {
      continue;
    }

    const dedupeKey = token.toLowerCase().replace(/\/+$/, '');
    if (!seenKeys.has(dedupeKey)) {
      seenKeys.add(dedupeKey);
      unique.push(token);
    }
    if (unique.length >= 150) break;
  }

  return unique;
}

function buildMediaItemFromExtractedData(extracted: any): {
  item: MediaItem;
  serializedCredits: string;
} {
  const finalMediaType: TMDBMediaType =
    extracted.mediaType === 'tv' ? 'tv' : 'movie';
  const rawTitle = String(extracted.title || 'Untitled').trim().slice(0, 200);
  const slugFallback = rawTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  const isInterstellar = rawTitle.toLowerCase().includes('interstellar');
  const rawTmdbNum = Number(extracted.tmdbId) || 0;
  const hasRealTmdbId =
    rawTmdbNum > 0 && (rawTmdbNum !== 157336 || isInterstellar);

  let finalTmdbId = hasRealTmdbId ? rawTmdbNum : 0;
  if (!finalTmdbId) {
    if (extracted.imdbId && /^tt\d+$/i.test(String(extracted.imdbId))) {
      finalTmdbId =
        Number(String(extracted.imdbId).replace(/\D/g, '').replace(/^0+/, '')) ||
        900000;
    } else {
      let hash = 0;
      const seedStr = `${finalMediaType}:${slugFallback}:${extracted.releaseYear || 2024}`;
      for (let i = 0; i < seedStr.length; i++) {
        hash = (hash * 31 + seedStr.charCodeAt(i)) % 90000000;
      }
      finalTmdbId = 10000000 + Math.abs(hash);
    }
  }

  const streamToken = extracted.imdbId
    ? String(extracted.imdbId).toLowerCase()
    : String(finalTmdbId);
  const finalEmbedUrl =
    finalMediaType === 'tv'
      ? `https://embedmaster.link/tv/${streamToken}/1/1`
      : `https://embedmaster.link/movie/${streamToken}`;

  const idToken = hasRealTmdbId
    ? String(finalTmdbId)
    : extracted.imdbId
    ? String(extracted.imdbId).toLowerCase()
    : `${slugFallback}-${extracted.releaseYear || 2024}`;

  const docId = `${finalMediaType}-${idToken}`
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 120);

  const safeTagline = String(
    extracted.tagline || `Watch ${rawTitle} in 4K UHD`
  )
    .trim()
    .slice(0, 300);
  const safeSynopsis = String(
    extracted.synopsis || `Stream ${rawTitle} in 4K UHD.`
  )
    .trim()
    .slice(0, 2000);
  const safeDirector = String(
    extracted.directorOrCreator || 'Featured Creator'
  )
    .trim()
    .slice(0, 160);

  const safeCast: string[] = Array.isArray(extracted.cast)
    ? extracted.cast
        .map((c: string) => String(c).trim().slice(0, 100))
        .filter(Boolean)
        .slice(0, 10)
    : ['Featured Cast'];
  if (safeCast.length === 0) safeCast.push('Featured Cast');

  const safeGenres: Genre[] =
    Array.isArray(extracted.genres) && extracted.genres.length > 0
      ? extracted.genres.slice(0, 6)
      : ['Drama'];

  const rawCreditsList: PersonCredit[] = Array.isArray(extracted.credits)
    ? extracted.credits.slice(0, 14)
    : [];

  let serializedCredits = '[]';
  try {
    const compactCredits = rawCreditsList.map((c) => ({
      name: String(c.name || '').slice(0, 80),
      role: c.role === 'DIRECTOR' ? 'DIRECTOR' : 'ACTOR',
      characterName: String(c.characterName || '').slice(0, 80),
      imageUrl: String(c.imageUrl || '').slice(0, 900),
    }));
    const rawJson = JSON.stringify(compactCredits);
    serializedCredits = rawJson.length <= 14800 ? rawJson : '[]';
  } catch {
    serializedCredits = '[]';
  }

  const fallbackSeed: Omit<MediaItem, 'posterUrl' | 'backdropUrl'> = {
    id: docId,
    tmdbId: finalTmdbId,
    mediaType: finalMediaType,
    title: rawTitle,
    tagline: safeTagline,
    synopsis: safeSynopsis,
    contentType: finalMediaType === 'tv' ? 'series' : 'movie',
    genres: safeGenres,
    releaseYear: Math.min(
      2100,
      Math.max(1900, Number(extracted.releaseYear) || 2024)
    ),
    durationMinutes: Math.min(
      1000,
      Math.max(1, Number(extracted.durationMinutes) || 120)
    ),
    maturityRating: extracted.maturityRating || 'PG-13',
    directorOrCreator: safeDirector,
    cast: safeCast,
    credits: rawCreditsList,
    cinesrcEmbedUrl: finalEmbedUrl.slice(0, 1024),
    justWatchUrl: String(extracted.justWatchUrl || '').slice(0, 1024),
    featured: true,
    popularScore: Math.min(
      100,
      Math.max(1, Math.round(Number(extracted.popularScore) || 92))
    ),
    seasonsCount:
      finalMediaType === 'tv'
        ? Math.min(100, Math.max(1, Number(extracted.seasonsCount) || 1))
        : 0,
    episodesCount:
      finalMediaType === 'tv'
        ? Math.min(5000, Math.max(1, Number(extracted.episodesCount) || 8))
        : 0,
    availabilityStatus: 'playable_demo',
    availabilityNote: '4K UHD · Instant Stream',
    visualTheme: {
      primaryHex: '#1A1625',
      secondaryHex: '#251E35',
      accentHex: '#B892FF',
      motif: 'horizon',
    },
  };

  const item: MediaItem = {
    ...fallbackSeed,
    backdropUrl: (
      String(extracted.backdropUrl || '').trim() ||
      String(extracted.posterUrl || '').trim() ||
      createBackdropDataUri(fallbackSeed)
    ).slice(0, 2048),
    posterUrl: (
      String(extracted.posterUrl || '').trim() ||
      String(extracted.backdropUrl || '').trim() ||
      createPosterDataUri(fallbackSeed)
    ).slice(0, 2048),
  };

  return { item, serializedCredits };
}

export const AdminStudioModal: React.FC<AdminStudioModalProps> = ({
  isOpen,
  currentUser,
  prefillMedia = null,
  catalog,
  supportMessages = [],
  initialTab = 'catalog',
  heroBatchInfo,
  onAdvanceHeroBatch,
  onResetHeroCycleNow,
  onUpdateSupportStatus,
  onDeleteSupportMessage,
  onClose,
  onSelectMediaToWatch,
  onPreviewDraftInApp,
  onLaunchVisualEditor,
}) => {
  const isAdmin = isUserAdmin(currentUser?.email, currentUser?.emailVerified);

  const [activeAdminTab, setActiveAdminTab] = useState<'catalog' | 'support'>(
    initialTab
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [justWatchUrl, setJustWatchUrl] = useState<string>('');
  const [isExtractingJw, setIsExtractingJw] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Multi-Link JustWatch Batch Importer State (Up to 100 Comma-Separated Links)
  const [multiLinksInput, setMultiLinksInput] = useState<string>('');
  const [isBatchRunning, setIsBatchRunning] = useState<boolean>(false);
  const [batchResults, setBatchResults] = useState<BatchLinkResultItem[]>([]);
  const [batchCompletedCount, setBatchCompletedCount] = useState<number>(0);
  const [batchTotalCount, setBatchTotalCount] = useState<number>(0);
  const cancelBatchRef = useRef<boolean>(false);

  // Firebase Project Switcher State
  const [rulesCopied, setRulesCopied] = useState<boolean>(false);
  const activeFirebaseTarget = getActiveFirebaseTarget();

  // Direct JustWatch Search & Browse State
  const [jwSearchQuery, setJwSearchQuery] = useState<string>('');
  const [jwTypeFilter, setJwTypeFilter] = useState<'ALL' | 'MOVIE' | 'SHOW'>(
    'ALL'
  );
  const [jwCountry, setJwCountry] = useState<'IN' | 'US' | 'GB'>('IN');
  const [jwResults, setJwResults] = useState<JustWatchBrowseCard[]>([]);
  const [isLoadingJwBrowse, setIsLoadingJwBrowse] = useState<boolean>(false);
  const [publishingCardKey, setPublishingCardKey] = useState<string | null>(
    null
  );

  // Movie / Show Form State
  const [mediaType, setMediaType] = useState<TMDBMediaType>('movie');
  const [tmdbIdInput, setTmdbIdInput] = useState<string>('');
  const [imdbIdState, setImdbIdState] = useState<string>('');
  const [cinesrcInput, setCinesrcInput] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [tagline, setTagline] = useState<string>('');
  const [synopsis, setSynopsis] = useState<string>('');
  const [selectedGenres, setSelectedGenres] = useState<Genre[]>([
    'Action',
    'Drama',
  ]);
  const [releaseYear, setReleaseYear] = useState<string>('2024');
  const [durationMinutes, setDurationMinutes] = useState<string>('120');
  const [maturityRating, setMaturityRating] = useState<
    'G' | 'PG' | 'PG-13' | 'TV-PG' | 'TV-14'
  >('PG-13');
  const [popularScore, setPopularScore] = useState<number>(92);
  const [directorOrCreator, setDirectorOrCreator] =
    useState<string>('Featured Creator');
  const [castInput, setCastInput] = useState<string>('Lead Cast');
  const [credits, setCredits] = useState<PersonCredit[]>([]);
  const [posterUrl, setPosterUrl] = useState<string>('');
  const [backdropUrl, setBackdropUrl] = useState<string>('');
  const [extraBackdrops, setExtraBackdrops] = useState<string[]>([]);
  const [seasonsCount, setSeasonsCount] = useState<string>('1');
  const [episodesCount, setEpisodesCount] = useState<string>('8');
  const [featured, setFeatured] = useState<boolean>(true);

  // Live Preview Modal State inside Admin Studio
  const [showLivePreview, setShowLivePreview] = useState<boolean>(false);
  const [previewSeason, setPreviewSeason] = useState<number>(1);
  const [previewEpisode, setPreviewEpisode] = useState<number>(1);

  const formRef = useRef<HTMLFormElement>(null);

  // Parse up to 150 comma/newline/space/glued JustWatch links while filtering out bare /search pages
  const parsedMultiLinks = useMemo(
    () => parseBulkJustWatchLinks(multiLinksInput),
    [multiLinksInput]
  );

  useEffect(() => {
    if (isOpen) {
      setActiveAdminTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (prefillMedia) {
      populateFormFromItem(prefillMedia);
      setActiveAdminTab('catalog');
    }
  }, [prefillMedia]);

  const fetchJustWatchCatalog = useCallback(
    async (
      queryStr: string,
      typeFilter: 'ALL' | 'MOVIE' | 'SHOW',
      countryCode: string
    ) => {
      setIsLoadingJwBrowse(true);
      try {
        const params = new URLSearchParams({
          q: queryStr.trim(),
          type: typeFilter,
          country: countryCode,
        });
        const res = await fetch(`/api/justwatch/search?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.items)) {
            setJwResults(data.items);
          }
        }
      } catch {
        // Ignore
      } finally {
        setIsLoadingJwBrowse(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!isOpen || !isAdmin || activeAdminTab !== 'catalog') return;
    const timer = window.setTimeout(() => {
      fetchJustWatchCatalog(jwSearchQuery, jwTypeFilter, jwCountry);
    }, 260);
    return () => window.clearTimeout(timer);
  }, [
    isOpen,
    isAdmin,
    activeAdminTab,
    jwSearchQuery,
    jwTypeFilter,
    jwCountry,
    fetchJustWatchCatalog,
  ]);

  useEffect(() => {
    const numId = Number(tmdbIdInput);
    const activeToken = imdbIdState || (numId > 0 ? String(numId) : '');
    if (activeToken) {
      setCinesrcInput(
        mediaType === 'tv'
          ? `https://embedmaster.link/tv/${activeToken}/1/1`
          : `https://embedmaster.link/movie/${activeToken}`
      );
    }
  }, [mediaType, tmdbIdInput, imdbIdState]);

  const populateFormFromItem = (item: MediaItem) => {
    setEditingId(item.id);
    setMediaType(item.mediaType);
    setTmdbIdInput(String(item.tmdbId));
    const imdbMatch = (item.cinesrcEmbedUrl || '').match(/(tt\d{5,12})/i);
    setImdbIdState(imdbMatch?.[1] ? imdbMatch[1].toLowerCase() : '');
    setCinesrcInput(
      item.cinesrcEmbedUrl && item.cinesrcEmbedUrl.includes('embedmaster.link')
        ? item.cinesrcEmbedUrl
        : item.mediaType === 'tv'
        ? `https://embedmaster.link/tv/${item.tmdbId}/1/1`
        : `https://embedmaster.link/movie/${item.tmdbId}`
    );
    setJustWatchUrl(item.justWatchUrl || '');
    setTitle(item.title);
    setTagline(item.tagline);
    setSynopsis(item.synopsis);
    setSelectedGenres(item.genres.length > 0 ? item.genres : ['Drama']);
    setReleaseYear(String(item.releaseYear));
    setDurationMinutes(String(item.durationMinutes));
    setMaturityRating(item.maturityRating);
    setPopularScore(item.popularScore || 92);
    setDirectorOrCreator(item.directorOrCreator);
    setCastInput(item.cast.join(', '));
    setCredits(Array.isArray(item.credits) ? item.credits : []);
    setPosterUrl(item.posterUrl);
    setBackdropUrl(item.backdropUrl);
    setExtraBackdrops([]);
    setSeasonsCount(String(item.seasonsCount || 1));
    setEpisodesCount(String(item.episodesCount || 8));
    setFeatured(Boolean(item.featured));
  };

  const resetForm = () => {
    setEditingId(null);
    setJustWatchUrl('');
    setMediaType('movie');
    setTmdbIdInput('');
    setImdbIdState('');
    setCinesrcInput('');
    setTitle('');
    setTagline('');
    setSynopsis('');
    setSelectedGenres(['Action', 'Drama']);
    setReleaseYear('2024');
    setDurationMinutes('120');
    setMaturityRating('PG-13');
    setPopularScore(92);
    setDirectorOrCreator('Featured Director');
    setCastInput('Featured Cast');
    setCredits([]);
    setPosterUrl('');
    setBackdropUrl('');
    setExtraBackdrops([]);
    setSeasonsCount('1');
    setEpisodesCount('8');
    setFeatured(true);
    setShowLivePreview(false);
  };

  const handleCineSrcInputChange = (val: string) => {
    setCinesrcInput(val);
    const streamRegex =
      /(?:https?:\/\/)?(?:www\.)?(?:embedmaster\.link|embedmaster\.com|vidlink\.pro|cinesrc\.st)(?:\/embed)?\/(movie|tv|series|show)\/(tt\d+|\d+)/i;
    const match = val.trim().match(streamRegex);
    if (match) {
      const rawType = match[1].toLowerCase();
      const nextType: TMDBMediaType =
        rawType === 'tv' || rawType === 'series' || rawType === 'show'
          ? 'tv'
          : 'movie';
      setMediaType(nextType);
      const idToken = match[2];
      if (/^tt\d+$/i.test(idToken)) {
        setImdbIdState(idToken.toLowerCase());
      } else if (/^\d+$/.test(idToken)) {
        setTmdbIdInput(idToken);
      }
    }
  };

  const applyExtractedDataToForm = (data: any) => {
    if (data.title) setTitle(data.title);
    if (data.releaseYear) setReleaseYear(String(data.releaseYear));
    if (data.synopsis) setSynopsis(data.synopsis);
    if (data.tagline) setTagline(data.tagline);
    if (data.mediaType === 'tv' || data.mediaType === 'movie') {
      setMediaType(data.mediaType);
    }
    if (data.maturityRating) {
      setMaturityRating(data.maturityRating);
    }
    if (data.durationMinutes) {
      setDurationMinutes(String(data.durationMinutes));
    }
    if (Array.isArray(data.genres) && data.genres.length > 0) {
      setSelectedGenres(data.genres);
    }
    if (typeof data.popularScore === 'number') {
      setPopularScore(data.popularScore);
    }
    if (data.seasonsCount) {
      setSeasonsCount(String(data.seasonsCount));
    }
    if (data.episodesCount) {
      setEpisodesCount(String(data.episodesCount));
    }
    if (data.directorOrCreator) {
      setDirectorOrCreator(data.directorOrCreator);
    }
    if (Array.isArray(data.cast) && data.cast.length > 0) {
      setCastInput(data.cast.join(', '));
    }
    if (Array.isArray(data.credits)) {
      setCredits(data.credits);
    }
    if (data.posterUrl) setPosterUrl(data.posterUrl);
    if (data.backdropUrl) setBackdropUrl(data.backdropUrl);
    if (Array.isArray(data.extraBackdrops)) {
      setExtraBackdrops(data.extraBackdrops);
    }
    if (data.justWatchUrl) {
      setJustWatchUrl(data.justWatchUrl);
    }
    if (data.imdbId) {
      setImdbIdState(String(data.imdbId).toLowerCase());
    }
    if (data.tmdbId) {
      setTmdbIdInput(String(data.tmdbId));
    }
    if (data.tmdbId || data.imdbId) {
      const detected = data.mediaType || mediaType;
      const streamToken = data.imdbId || data.tmdbId;
      setCinesrcInput(
        detected === 'tv'
          ? `https://embedmaster.link/tv/${streamToken}/1/1`
          : `https://embedmaster.link/movie/${streamToken}`
      );
    }
  };

  /**
   * Saves a built MediaItem + serializedCredits to Cloud Firestore /catalog/{id}
   */
  const persistMediaItemToFirestore = async (
    item: MediaItem,
    serializedCredits: string
  ) => {
    if (!currentUser || !isAdmin) return;
    const docRef = doc(db, 'catalog', item.id);
    const existingItem = catalog.find((c) => c.id === item.id);

    const payload: Record<string, any> = {
      id: item.id,
      tmdbId: item.tmdbId,
      mediaType: item.mediaType,
      contentType: item.contentType,
      title: item.title,
      tagline: item.tagline,
      synopsis: item.synopsis,
      genres: item.genres,
      releaseYear: item.releaseYear,
      durationMinutes: item.durationMinutes,
      maturityRating: item.maturityRating,
      directorOrCreator: item.directorOrCreator,
      cast: item.cast,
      creditsJson: serializedCredits,
      posterUrl: item.posterUrl,
      backdropUrl: item.backdropUrl,
      cinesrcEmbedUrl: (item.cinesrcEmbedUrl || '').slice(0, 1024),
      justWatchUrl: (item.justWatchUrl || '').slice(0, 1024),
      featured: Boolean(item.featured ?? true),
      heroAddedAtMs: existingItem?.heroAddedAtMs || Date.now(),
      popularScore: item.popularScore || 92,
      seasonsCount: item.mediaType === 'tv' ? item.seasonsCount || 1 : 0,
      episodesCount: item.mediaType === 'tv' ? item.episodesCount || 8 : 0,
      visibility: 'public',
      authorUid: existingItem?.authorUid || currentUser.uid,
      updatedAt: serverTimestamp(),
    };

    if (!existingItem) {
      payload.createdAt = serverTimestamp();
    }

    await setDoc(docRef, payload, { merge: true });
  };

  /**
   * Multi-Link JustWatch Batch Processor (Up to 100 Comma-Separated Links at One Time)
   */
  const handleRunMultiLinkBatch = async (
    autoPublishToFirestore: boolean,
    explicitLinks?: string[]
  ) => {
    const linksToProcess = (explicitLinks || parsedMultiLinks).slice(0, 150);
    if (linksToProcess.length === 0) {
      setErrorMessage(
        'Please paste valid JustWatch movie or TV show links (e.g. https://www.justwatch.com/in/movie/...).'
      );
      return;
    }

    if (autoPublishToFirestore && (!currentUser || !isAdmin)) {
      setErrorMessage(`Only ${ADMIN_EMAIL} can publish to the catalog.`);
      return;
    }

    cancelBatchRef.current = false;
    setIsBatchRunning(true);
    setErrorMessage(null);
    setStatusMessage(null);
    setBatchTotalCount(linksToProcess.length);
    setBatchCompletedCount(0);

    const initialItems: BatchLinkResultItem[] = linksToProcess.map(
      (raw, idx) => ({
        index: idx,
        rawInput: raw,
        status: 'pending',
      })
    );
    setBatchResults(initialItems);

    let successCount = 0;
    let failCount = 0;
    let nextCursor = 0;
    const concurrency = Math.min(6, linksToProcess.length);

    const worker = async () => {
      while (!cancelBatchRef.current) {
        const currentIndex = nextCursor;
        nextCursor += 1;
        if (currentIndex >= linksToProcess.length) break;

        const targetLink = linksToProcess[currentIndex];

        setBatchResults((prev) =>
          prev.map((entry) =>
            entry.index === currentIndex
              ? { ...entry, status: 'extracting' }
              : entry
          )
        );

        try {
          const isUrl =
            targetLink.includes('justwatch.com') ||
            targetLink.startsWith('http');
          const res = await fetch('/api/justwatch/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              justWatchUrl: isUrl ? targetLink : '',
              title: isUrl ? '' : targetLink,
            }),
          });

          const extracted = await res.json();
          if (!res.ok || !extracted?.title) {
            throw new Error(
              extracted?.error || 'Could not extract from JustWatch link'
            );
          }

          const { item, serializedCredits } =
            buildMediaItemFromExtractedData(extracted);

          if (autoPublishToFirestore) {
            await persistMediaItemToFirestore(item, serializedCredits);
          }

          successCount += 1;
          setBatchResults((prev) =>
            prev.map((entry) =>
              entry.index === currentIndex
                ? {
                    ...entry,
                    status: autoPublishToFirestore ? 'published' : 'extracted',
                    extractedData: extracted,
                    draftItem: item,
                  }
                : entry
            )
          );
        } catch (err: any) {
          failCount += 1;
          setBatchResults((prev) =>
            prev.map((entry) =>
              entry.index === currentIndex
                ? {
                    ...entry,
                    status: 'error',
                    errorText:
                      err instanceof Error ? err.message : 'Extraction failed',
                  }
                : entry
            )
          );
        } finally {
          setBatchCompletedCount((c) => c + 1);
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    setIsBatchRunning(false);
    if (autoPublishToFirestore) {
      setStatusMessage(
        `Multi-Link Batch Complete: ${successCount} of ${linksToProcess.length} movie(s)/show(s) extracted & published to the app!${
          failCount > 0 ? ` (${failCount} failed)` : ''
        }`
      );
    } else {
      setStatusMessage(
        `Multi-Link Extraction Complete: ${successCount} of ${linksToProcess.length} movie(s)/show(s) ready for preview or 1-click publish!`
      );
    }
  };

  /**
   * Publishes all already-extracted items in the batch queue in one click
   */
  const handlePublishAllExtractedBatch = async () => {
    if (!currentUser || !isAdmin) return;
    const readyItems = batchResults.filter(
      (b) => b.status === 'extracted' && b.draftItem && b.extractedData
    );
    if (readyItems.length === 0) return;

    setIsBatchRunning(true);
    let publishedNow = 0;

    for (const entry of readyItems) {
      try {
        const { item, serializedCredits } = buildMediaItemFromExtractedData(
          entry.extractedData
        );
        await persistMediaItemToFirestore(item, serializedCredits);
        publishedNow += 1;
        setBatchResults((prev) =>
          prev.map((b) =>
            b.index === entry.index ? { ...b, status: 'published' } : b
          )
        );
      } catch {
        // Continue publishing remaining items
      }
    }

    setIsBatchRunning(false);
    setStatusMessage(
      `Published ${publishedNow} extracted movie(s)/show(s) to the live catalog!`
    );
  };

  const handleExtractFromJustWatch = async (
    overrideUrl?: string,
    overrideTitle?: string,
    overrideType?: TMDBMediaType,
    openPreviewAfter = false
  ) => {
    const targetUrl =
      overrideUrl !== undefined ? overrideUrl.trim() : justWatchUrl.trim();
    const targetTitle =
      overrideTitle !== undefined ? overrideTitle.trim() : title.trim();

    if (!targetUrl && !targetTitle) {
      setErrorMessage(
        'Paste a JustWatch link or select a movie/show from JustWatch first.'
      );
      return;
    }

    // If user pasted multiple links (comma, space, or newline separated) into the single URL box, automatically extract & publish all!
    if (overrideUrl === undefined) {
      const splitList = parseBulkJustWatchLinks(targetUrl);
      if (splitList.length > 1) {
        setMultiLinksInput(splitList.join(',\n'));
        setJustWatchUrl('');
        await handleRunMultiLinkBatch(true, splitList);
        return;
      }
    }

    setIsExtractingJw(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/justwatch/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          justWatchUrl: targetUrl,
          title: targetTitle,
          mediaType: overrideType,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(
          data.error || 'Could not extract details from JustWatch.'
        );
        return;
      }

      applyExtractedDataToForm(data);

      if (openPreviewAfter) {
        setPreviewSeason(1);
        setPreviewEpisode(1);
        setShowLivePreview(true);
      } else {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      const castCount = Array.isArray(data.credits)
        ? data.credits.filter((c: PersonCredit) => c.role === 'ACTOR').length
        : 0;
      const dirCount = Array.isArray(data.credits)
        ? data.credits.filter((c: PersonCredit) => c.role === 'DIRECTOR').length
        : 0;

      setStatusMessage(
        `Loaded "${data.title}" (${data.releaseYear}) — ${dirCount} Director(s), ${castCount} Cast Members with Photos, Verified Stream & Episodes!`
      );
    } catch {
      setErrorMessage('Network error while extracting from JustWatch.');
    } finally {
      setIsExtractingJw(false);
    }
  };

  const buildDraftMediaItemFromForm = (): MediaItem | null => {
    const parsedCine = parseOrBuildCineSrcUrl(
      cinesrcInput,
      mediaType,
      Number(tmdbIdInput)
    );
    const finalMediaType = parsedCine.detectedType;
    const finalTmdbId = parsedCine.detectedTmdbId;
    const finalEmbedUrl = parsedCine.embedUrl;

    const safeTitle = (title.trim() || 'Untitled Preview').slice(0, 200);
    const docId =
      editingId ||
      `${finalMediaType}-${finalTmdbId}`
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .slice(0, 120);

    const safeTagline = (
      tagline.trim() || `Watch ${safeTitle} in 4K UHD`
    ).slice(0, 300);
    const safeSynopsis = (
      synopsis.trim() || `Stream ${safeTitle} in 4K UHD.`
    ).slice(0, 2000);
    const safeDirector = (
      directorOrCreator.trim() || 'Featured Creator'
    ).slice(0, 160);
    const safeCast = castInput
      .split(',')
      .map((s) => s.trim().slice(0, 100))
      .filter(Boolean)
      .slice(0, 10);
    if (safeCast.length === 0) safeCast.push('Featured Cast');

    const safeGenres: Genre[] =
      selectedGenres.length > 0 ? selectedGenres.slice(0, 6) : ['Drama'];

    const fallbackSeed: Omit<MediaItem, 'posterUrl' | 'backdropUrl'> = {
      id: docId,
      tmdbId: finalTmdbId,
      mediaType: finalMediaType,
      title: safeTitle,
      tagline: safeTagline,
      synopsis: safeSynopsis,
      contentType: finalMediaType === 'tv' ? 'series' : 'movie',
      genres: safeGenres,
      releaseYear: Math.min(2100, Math.max(1900, Number(releaseYear) || 2024)),
      durationMinutes: Math.min(
        1000,
        Math.max(1, Number(durationMinutes) || 120)
      ),
      maturityRating,
      directorOrCreator: safeDirector,
      cast: safeCast,
      credits: credits.slice(0, 14),
      cinesrcEmbedUrl: finalEmbedUrl,
      justWatchUrl: justWatchUrl.trim(),
      featured: Boolean(featured),
      popularScore: Math.min(100, Math.max(1, Math.round(popularScore || 92))),
      seasonsCount:
        finalMediaType === 'tv'
          ? Math.min(100, Math.max(1, Number(seasonsCount) || 1))
          : undefined,
      episodesCount:
        finalMediaType === 'tv'
          ? Math.min(5000, Math.max(1, Number(episodesCount) || 8))
          : undefined,
      availabilityStatus: 'playable_demo',
      availabilityNote: '4K UHD · Instant Stream',
      visualTheme: {
        primaryHex: '#1A1625',
        secondaryHex: '#251E35',
        accentHex: '#B892FF',
        motif: 'horizon',
      },
    };

    return {
      ...fallbackSeed,
      backdropUrl: (
        backdropUrl.trim() ||
        posterUrl.trim() ||
        createBackdropDataUri(fallbackSeed)
      ).slice(0, 2048),
      posterUrl: (
        posterUrl.trim() ||
        backdropUrl.trim() ||
        createPosterDataUri(fallbackSeed)
      ).slice(0, 2048),
    };
  };

  /**
   * 1-Click Direct Publish from a JustWatch Browse/Search Card
   */
  const handleDirectPublishFromJustWatchCard = async (
    card: JustWatchBrowseCard
  ) => {
    if (!currentUser || !isAdmin) return;
    const cardKey = `${card.mediaType}-${card.title}-${card.releaseYear}`;
    setPublishingCardKey(cardKey);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/justwatch/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          justWatchUrl: card.justWatchUrl,
          title: card.title,
          mediaType: card.mediaType,
        }),
      });
      const extracted = res.ok ? await res.json() : card;
      const { item, serializedCredits } =
        buildMediaItemFromExtractedData(extracted);

      await persistMediaItemToFirestore(item, serializedCredits);

      setStatusMessage(
        `Published "${item.title}" (${item.releaseYear}) directly from JustWatch to the app!`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'catalog');
    } finally {
      setPublishingCardKey(null);
    }
  };

  const toggleGenre = (genre: Genre) => {
    setSelectedGenres((prev) => {
      if (prev.includes(genre)) {
        return prev.length > 1 ? prev.filter((g) => g !== genre) : prev;
      }
      if (prev.length >= 6) return prev;
      return [...prev, genre];
    });
  };

  const handleSaveToFirestore = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    if (!currentUser || !isAdmin) {
      setErrorMessage(
        `Only ${ADMIN_EMAIL} can add or update movies and TV shows.`
      );
      return;
    }

    if (!title.trim()) {
      setErrorMessage(
        'Please enter a Movie or TV Show title (or select one from JustWatch).'
      );
      return;
    }

    const draftItem = buildDraftMediaItemFromForm();
    if (!draftItem) return;

    let serializedCredits = '[]';
    try {
      const compactCredits = credits.slice(0, 14).map((c) => ({
        name: String(c.name || '').slice(0, 80),
        role: c.role === 'DIRECTOR' ? 'DIRECTOR' : 'ACTOR',
        characterName: String(c.characterName || '').slice(0, 80),
        imageUrl: String(c.imageUrl || '').slice(0, 900),
      }));
      const rawJson = JSON.stringify(compactCredits);
      serializedCredits = rawJson.length <= 14800 ? rawJson : '[]';
    } catch {
      serializedCredits = '[]';
    }

    setIsSaving(true);
    try {
      await persistMediaItemToFirestore(draftItem, serializedCredits);
      setStatusMessage(
        `Successfully published "${draftItem.title}" to Cloud Firestore!`
      );
      resetForm();
    } catch (error) {
      handleFirestoreError(
        error,
        editingId ? OperationType.UPDATE : OperationType.CREATE,
        `catalog/${draftItem.id}`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteFromFirestore = async (
    itemId: string,
    itemTitle: string
  ) => {
    if (!currentUser || !isAdmin) return;
    try {
      await deleteDoc(doc(db, 'catalog', itemId));
      setStatusMessage(`Removed "${itemTitle}" from catalog.`);
      if (editingId === itemId) resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `catalog/${itemId}`);
    }
  };

  const openSupportCount = supportMessages.filter(
    (m) => m.status === 'open'
  ).length;

  const currentDraftPreviewItem =
    showLivePreview && title.trim() ? buildDraftMediaItemFromForm() : null;

  const extractedReadyCount = batchResults.filter(
    (b) => b.status === 'extracted'
  ).length;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-studio-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="w-full max-w-6xl rounded-3xl bg-[#161220] border border-white/15 shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]"
          >
            {/* Modal Header (Uses Attached Logo Without App Name Beside/Below It) */}
            <div className="p-4 sm:p-6 border-b border-white/10 flex flex-wrap items-center justify-between gap-4 bg-[#1C1729]">
              <div className="flex items-center gap-4 min-w-0">
                <div className="h-10 sm:h-11 w-28 sm:w-32 overflow-hidden flex items-center justify-center shrink-0">
                  <img
                    src={LOGO_ASSET_URL}
                    alt="Brand Logo"
                    className="w-full h-full object-contain scale-[1.55] select-none pointer-events-none"
                  />
                </div>
                <div className="min-w-0 border-l border-white/15 pl-4">
                  <h2
                    id="admin-studio-title"
                    className="text-base sm:text-lg font-bold text-white font-display truncate"
                  >
                    Admin Studio — Catalog & Support Center
                  </h2>
                  <p className="text-xs text-zinc-400 truncate">
                    {isAdmin
                      ? `Authenticated Admin: ${currentUser?.email} · Project: ${ACTIVE_FIREBASE_PROJECT_ID}`
                      : `Restricted to ${ADMIN_EMAIL}`}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(
                      ZAPPYFUN_FIRESTORE_RULES_SNIPPET
                    );
                    setRulesCopied(true);
                    setStatusMessage(
                      'Copied Firestore Security Rules to clipboard! Paste them into Firebase Console -> Firestore Database -> Rules.'
                    );
                    setTimeout(() => setRulesCopied(false), 3000);
                  }}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#B892FF]/20 hover:bg-[#B892FF]/30 border border-[#B892FF]/50 text-xs font-bold text-[#B892FF] flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>
                    {rulesCopied ? 'Rules Copied!' : 'Copy Security Rules'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const nextTarget =
                      activeFirebaseTarget === 'zappyfun'
                        ? 'default'
                        : 'zappyfun';
                    setActiveFirebaseTarget(nextTarget);
                    window.location.reload();
                  }}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer"
                >
                  <Database className="w-3.5 h-3.5 text-[#E50000]" />
                  <span>
                    {activeFirebaseTarget === 'zappyfun'
                      ? 'Using: zappyfun (Switch Back)'
                      : 'Switch to zappyfun'}
                  </span>
                </button>

                {isAdmin && (
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-[#110E17] border border-white/10">
                    <button
                      type="button"
                      onClick={() => setActiveAdminTab('catalog')}
                      className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                        activeAdminTab === 'catalog'
                          ? 'bg-[#E50000] text-white'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <Film className="w-3.5 h-3.5" />
                      <span>Catalog ({catalog.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveAdminTab('support')}
                      className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                        activeAdminTab === 'support'
                          ? 'bg-[#E50000] text-white'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Support Inbox ({supportMessages.length})</span>
                      {openSupportCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-white text-[#E50000] text-[10px] font-extrabold">
                          {openSupportCount}
                        </span>
                      )}
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[40px] min-w-[40px] rounded-xl bg-white/[0.06] border border-white/10 text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
                  aria-label="Close Admin Studio"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Status / Error Banner */}
            {(statusMessage || errorMessage) && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mx-4 sm:mx-6 mt-4 px-4 py-3 rounded-xl border text-xs flex items-center justify-between gap-3 shrink-0 ${
                  errorMessage
                    ? 'bg-red-500/10 border-red-500/30 text-red-200'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {errorMessage ? (
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  )}
                  <span>{errorMessage || statusMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setStatusMessage(null);
                  }}
                  className="text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
              {!isAdmin ? (
                <div className="rounded-3xl bg-[#1C1729] border border-white/10 p-8 sm:p-10 text-center max-w-xl mx-auto my-6 space-y-5">
                  <div className="w-16 h-16 rounded-2xl bg-[#E50000]/15 border border-[#E50000]/40 flex items-center justify-center mx-auto text-[#E50000]">
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white font-display">
                    Admin Panel Access Restricted
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                    Only <strong className="text-[#E50000]">{ADMIN_EMAIL}</strong> has permission to manage the catalog and read user support messages.
                  </p>
                  {currentUser && (
                    <p className="text-xs text-amber-300 font-mono-tabular">
                      Currently signed in as: {currentUser.email}
                    </p>
                  )}
                  <div className="pt-2 flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await signInWithGoogle();
                        } catch {
                          setErrorMessage(
                            'Google Sign-In popup was closed or blocked.'
                          );
                        }
                      }}
                      className="min-h-[46px] px-6 py-3 rounded-2xl bg-[#E50000] text-white font-bold text-sm hover:bg-[#FF1A1A] transition-all flex items-center gap-2.5 cursor-pointer shadow-lg shadow-[#E50000]/25"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Sign in with Google ({ADMIN_EMAIL})</span>
                    </button>
                  </div>
                </div>
              ) : activeAdminTab === 'support' ? (
                /* =========================================================
                    USER SUPPORT MESSAGES INBOX TAB
                ========================================================= */
                <div className="space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-white font-display flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-[#E50000]" />
                        <span>
                          User Support Messages ({supportMessages.length})
                        </span>
                      </h3>
                      <p className="text-xs text-zinc-400 mt-1">
                        Every message sent by users on the Support page appears here in real time.
                      </p>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-zinc-300 font-mono-tabular">
                      <span>Open: {openSupportCount}</span>
                      <span>·</span>
                      <span>
                        Resolved: {supportMessages.length - openSupportCount}
                      </span>
                    </div>
                  </div>

                  {supportMessages.length === 0 ? (
                    <div className="rounded-2xl bg-[#1A1526] border border-white/10 p-10 text-center space-y-3">
                      <MessageSquare className="w-10 h-10 text-zinc-500 mx-auto" />
                      <p className="text-sm font-bold text-white">
                        No Support Messages Yet
                      </p>
                      <p className="text-xs text-zinc-400 max-w-md mx-auto">
                        When users submit the contact form on the Support page, their message, email, and phone number will appear right here.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {supportMessages.map((msg) => {
                        const isResolved = msg.status === 'resolved';
                        return (
                          <div
                            key={msg.id}
                            className={`rounded-2xl border p-4 sm:p-5 space-y-3 transition-colors ${
                              isResolved
                                ? 'bg-[#14111D] border-white/10 opacity-80'
                                : 'bg-[#1C162B] border-[#E50000]/40'
                            }`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`text-xs font-bold uppercase tracking-wider ${
                                      isResolved
                                        ? 'text-emerald-400'
                                        : 'text-[#E50000]'
                                    }`}
                                  >
                                    {isResolved ? 'Resolved' : 'New / Open'}
                                  </span>
                                  <span className="text-zinc-500">·</span>
                                  <h4 className="text-sm sm:text-base font-bold text-white">
                                    {msg.firstName} {msg.lastName}
                                  </h4>
                                </div>

                                <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-300 pt-0.5">
                                  <span className="inline-flex items-center gap-1.5">
                                    <Mail className="w-3.5 h-3.5 text-[#E50000]" />
                                    <a
                                      href={`mailto:${msg.email}`}
                                      className="hover:underline text-white"
                                    >
                                      {msg.email}
                                    </a>
                                  </span>
                                  {msg.phone && (
                                    <span className="inline-flex items-center gap-1.5">
                                      <Phone className="w-3.5 h-3.5 text-zinc-400" />
                                      <span>{msg.phone}</span>
                                    </span>
                                  )}
                                  <span className="inline-flex items-center gap-1.5 text-zinc-400">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>
                                      {new Date(msg.createdAtMs).toLocaleString()}
                                    </span>
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {onUpdateSupportStatus && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onUpdateSupportStatus(
                                        msg,
                                        isResolved ? 'open' : 'resolved'
                                      )
                                    }
                                    className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                                      isResolved
                                        ? 'bg-white/10 hover:bg-white/15 text-white'
                                        : 'bg-emerald-500 hover:bg-emerald-400 text-black'
                                    }`}
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>
                                      {isResolved ? 'Reopen' : 'Mark Resolved'}
                                    </span>
                                  </button>
                                )}

                                {onDeleteSupportMessage && (
                                  <button
                                    type="button"
                                    onClick={() => onDeleteSupportMessage(msg)}
                                    className="min-h-[36px] px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                    title="Delete message"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Delete</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="p-3.5 rounded-xl bg-[#110E17] border border-white/10 text-xs sm:text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">
                              {msg.message}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* =========================================================
                    CATALOG, MULTI-LINK BATCH IMPORTER & DIRECT JUSTWATCH TAB
                ========================================================= */
                <div className="space-y-6">
                  {/* TOP ROW: Live UI Builder + Firebase Project Switcher (`zappyfun`) */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <div className="lg:col-span-7 rounded-2xl bg-gradient-to-r from-[#2D1E4A] via-[#211838] to-[#1A1429] border border-[#FF8A3D]/40 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
                      <div className="space-y-1">
                        <h3 className="text-sm sm:text-base font-bold text-white font-display">
                          Live UI Builder — Edit, Resize, Move, or Delete Any Element
                        </h3>
                        <p className="text-xs text-zinc-300">
                          Click any button, banner, card, or section on the screen to resize, move, recolor, or remove it permanently.
                        </p>
                      </div>

                      {onLaunchVisualEditor && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onLaunchVisualEditor();
                          }}
                          className="min-h-[42px] px-4 py-2 rounded-xl bg-[#FF8A3D] hover:bg-[#FF9E5E] text-[#110E17] font-bold text-xs transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer shadow-lg shadow-[#FF8A3D]/25"
                        >
                          <Sparkles className="w-4 h-4" />
                          <span>Launch UI Editor</span>
                        </button>
                      )}
                    </div>

                    {/* Firebase Project Switcher & Security Rules Copy Helper */}
                    <div className="lg:col-span-5 rounded-2xl bg-[#1A1526] border border-white/15 p-4 sm:p-5 flex flex-col justify-between gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <Database className="w-4 h-4 text-[#E50000]" />
                            <h3 className="text-xs sm:text-sm font-bold text-white font-display">
                              Firebase Project: {ACTIVE_FIREBASE_PROJECT_ID}
                            </h3>
                          </div>
                          <p className="text-[11px] text-zinc-400">
                            {activeFirebaseTarget === 'zappyfun'
                              ? 'Connected to zappyfun (Auto-migrating data from previous DB)'
                              : 'After enabling Firestore & Google Auth in zappyfun Console, click Switch below.'}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(
                              ZAPPYFUN_FIRESTORE_RULES_SNIPPET
                            );
                            setRulesCopied(true);
                            setTimeout(() => setRulesCopied(false), 2500);
                          }}
                          className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5 text-[#B892FF]" />
                          <span>
                            {rulesCopied
                              ? 'Rules Copied!'
                              : 'Copy Security Rules'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const nextTarget =
                              activeFirebaseTarget === 'zappyfun'
                                ? 'default'
                                : 'zappyfun';
                            setActiveFirebaseTarget(nextTarget);
                            window.location.reload();
                          }}
                          className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-[#E50000] hover:bg-[#FF1A1A] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>
                            {activeFirebaseTarget === 'zappyfun'
                              ? 'Switch Back to Previous DB'
                              : 'Switch to zappyfun Project'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* HERO BANNER 8-MOVIE DAILY CYCLE (24h Batch Rotation / 28h Movie Tenure) */}
                  {heroBatchInfo && (
                    <div className="rounded-2xl bg-[#1A1526] border border-[#E50000]/35 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Clock className="w-4 h-4 text-[#E50000]" />
                          <h3 className="text-xs sm:text-sm font-bold text-white font-display">
                            Hero Banner 8-Movie Daily Cycle — Batch #{heroBatchInfo.activeBatchNumber} of {heroBatchInfo.totalBatches} ({heroBatchInfo.currentHeroMovies.length} Movies Active)
                          </h3>
                        </div>
                        <p className="text-xs text-zinc-300">
                          Shows 8 movies for 24 hours (with a 28-hour spotlight tenure window per movie), then automatically rotates to the next 8 movies (Next rotation in ~{heroBatchInfo.hoursUntilNextBatch}h).
                        </p>
                        {heroBatchInfo.currentHeroMovies.length > 0 && (
                          <p className="text-[11px] text-[#B892FF] truncate max-w-3xl">
                            Current 8 Hero Movies:{' '}
                            {heroBatchInfo.currentHeroMovies
                              .map((m, idx) => `${idx + 1}. ${m.title}`)
                              .join(' · ')}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {onResetHeroCycleNow && (
                          <button
                            type="button"
                            onClick={() => onResetHeroCycleNow()}
                            className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white cursor-pointer"
                          >
                            Restart 24h Cycle Now
                          </button>
                        )}
                        {onAdvanceHeroBatch && (
                          <button
                            type="button"
                            onClick={() => onAdvanceHeroBatch()}
                            className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-[#E50000] hover:bg-[#FF1A1A] text-white text-xs font-bold cursor-pointer"
                          >
                            Rotate Next 8 Movies Now
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* =========================================================
                      MULTI-JUSTWATCH LINK BATCH IMPORTER (UP TO 100 COMMA-SEPARATED LINKS)
                  ========================================================= */}
                  <div className="rounded-2xl bg-gradient-to-br from-[#231B36] via-[#1B142C] to-[#141022] border-2 border-[#B892FF]/45 p-4 sm:p-6 space-y-4 shadow-xl">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-[#B892FF]" />
                          <h3 className="text-sm sm:text-base font-bold text-white font-display">
                            Multi-Link JustWatch Batch Importer (Up to 100 Comma-Separated Links at Once)
                          </h3>
                        </div>
                        <p className="text-xs text-zinc-300">
                          Paste up to 100 JustWatch movie or TV show links separated by commas (<code className="text-[#B892FF]">,</code>) or new lines to extract and publish them all in one go.
                        </p>
                      </div>

                      <div className="flex items-center gap-3 text-xs font-mono-tabular">
                        <span className="text-[#B892FF] font-bold">
                          {parsedMultiLinks.length} / 100 links detected
                        </span>
                        {multiLinksInput && (
                          <button
                            type="button"
                            disabled={isBatchRunning}
                            onClick={() => {
                              setMultiLinksInput('');
                              setBatchResults([]);
                            }}
                            className="text-zinc-400 hover:text-white underline cursor-pointer"
                          >
                            Clear All
                          </button>
                        )}
                      </div>
                    </div>

                    <textarea
                      rows={4}
                      value={multiLinksInput}
                      disabled={isBatchRunning}
                      onChange={(e) => setMultiLinksInput(e.target.value)}
                      placeholder="Paste up to 100 comma-separated JustWatch URLs here, e.g.:&#10;https://www.justwatch.com/in/movie/interstellar, https://www.justwatch.com/in/tv-show/breaking-bad, https://www.justwatch.com/in/movie/dune-part-two"
                      className="w-full p-3.5 rounded-xl bg-[#110E17] border border-white/15 text-xs sm:text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#B892FF] font-mono-tabular leading-relaxed"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-[11px] text-zinc-400">
                        Automatically extracts Title, Year, Synopsis, Poster, Backdrop, Cast Photos, Verified Stream & Seasons/Episodes for every link.
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        {isBatchRunning ? (
                          <button
                            type="button"
                            onClick={() => {
                              cancelBatchRef.current = true;
                            }}
                            className="min-h-[42px] px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 text-xs font-bold flex items-center gap-2 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                            <span>
                              Stop Batch ({batchCompletedCount}/{batchTotalCount})
                            </span>
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={parsedMultiLinks.length === 0}
                              onClick={() => handleRunMultiLinkBatch(false)}
                              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#B892FF]/20 hover:bg-[#B892FF]/30 border border-[#B892FF]/45 text-xs font-bold text-[#B892FF] flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                            >
                              <Eye className="w-4 h-4" />
                              <span>
                                Extract All ({parsedMultiLinks.length}) for Preview
                              </span>
                            </button>

                            <button
                              type="button"
                              disabled={parsedMultiLinks.length === 0}
                              onClick={() => handleRunMultiLinkBatch(true)}
                              className="min-h-[42px] px-5 py-2 rounded-xl bg-[#E50000] hover:bg-[#FF1A1A] text-white text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-[#E50000]/25 transition-colors disabled:opacity-50"
                            >
                              <Sparkles className="w-4 h-4" />
                              <span>
                                Extract & Publish All ({parsedMultiLinks.length}) to App
                              </span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Batch Progress & Per-Link Results Queue */}
                    {batchResults.length > 0 && (
                      <div className="pt-3 border-t border-white/10 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            {isBatchRunning && (
                              <Loader2 className="w-4 h-4 animate-spin text-[#E50000]" />
                            )}
                            <span className="font-bold text-white">
                              Batch Progress: {batchCompletedCount} / {batchTotalCount} processed
                            </span>
                          </div>

                          {extractedReadyCount > 0 && !isBatchRunning && (
                            <button
                              type="button"
                              onClick={handlePublishAllExtractedBatch}
                              className="min-h-[34px] px-4 py-1.5 rounded-xl bg-[#E50000] hover:bg-[#FF1A1A] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>
                                Publish All Extracted ({extractedReadyCount})
                              </span>
                            </button>
                          )}
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-2 rounded-full bg-[#110E17] overflow-hidden border border-white/10">
                          <div
                            className="h-full bg-[#E50000] transition-all duration-300"
                            style={{
                              width: `${
                                batchTotalCount > 0
                                  ? Math.round(
                                      (batchCompletedCount / batchTotalCount) *
                                        100
                                    )
                                  : 0
                              }%`,
                            }}
                          />
                        </div>

                        {/* Scrollable Batch Items Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[280px] overflow-y-auto pr-1">
                          {batchResults.map((entry) => {
                            const draft = entry.draftItem;
                            return (
                              <div
                                key={`${entry.index}-${entry.rawInput}`}
                                className="rounded-xl bg-[#110E17] border border-white/10 p-2.5 flex items-center justify-between gap-2.5"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {draft?.posterUrl ? (
                                    <img
                                      src={draft.posterUrl}
                                      alt={draft.title}
                                      referrerPolicy="no-referrer"
                                      className="w-10 h-14 rounded-lg object-cover border border-white/10 shrink-0 bg-black"
                                    />
                                  ) : (
                                    <div className="w-10 h-14 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-mono-tabular text-zinc-400 shrink-0">
                                      #{entry.index + 1}
                                    </div>
                                  )}

                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-white truncate">
                                      {draft
                                        ? `${draft.title} (${draft.releaseYear})`
                                        : entry.rawInput}
                                    </p>
                                    <p className="text-[11px] text-zinc-400 truncate font-mono-tabular">
                                      {entry.status === 'published' && (
                                        <span className="text-emerald-400 font-bold">
                                          Published to App ✓
                                        </span>
                                      )}
                                      {entry.status === 'extracted' && (
                                        <span className="text-[#B892FF] font-bold">
                                          Extracted · Ready to Preview/Publish
                                        </span>
                                      )}
                                      {entry.status === 'extracting' && (
                                        <span className="text-amber-300">
                                          Extracting metadata & stream...
                                        </span>
                                      )}
                                      {entry.status === 'pending' && (
                                        <span>Queued</span>
                                      )}
                                      {entry.status === 'error' && (
                                        <span className="text-red-400">
                                          {entry.errorText || 'Failed'}
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                </div>

                                {draft && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (entry.extractedData) {
                                          applyExtractedDataToForm(
                                            entry.extractedData
                                          );
                                          setPreviewSeason(1);
                                          setPreviewEpisode(1);
                                          setShowLivePreview(true);
                                        }
                                      }}
                                      className="px-2 py-1 rounded-lg bg-[#B892FF]/20 hover:bg-[#B892FF]/30 text-[#B892FF] text-[10px] font-bold cursor-pointer"
                                      title="Preview this item"
                                    >
                                      Preview
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* =========================================================
                      DIRECT JUSTWATCH CATALOG SEARCH, SELECT, PREVIEW & 1-CLICK PUBLISH
                  ========================================================= */}
                  <div className="rounded-2xl bg-gradient-to-br from-[#1F1833] to-[#141022] border border-[#E50000]/35 p-4 sm:p-6 space-y-4 shadow-xl">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-[#E50000]" />
                          <h3 className="text-sm sm:text-base font-bold text-white font-display">
                            Direct JustWatch Catalog — Search, Preview & Publish in 1 Click
                          </h3>
                        </div>
                        <p className="text-xs text-zinc-400">
                          Browse trending Movies & TV Shows on JustWatch or search any title directly below to preview or publish immediately.
                        </p>
                      </div>

                      {/* Type & Country Filters */}
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center p-1 rounded-xl bg-[#110E17] border border-white/10">
                          {(
                            [
                              { id: 'ALL', label: 'All' },
                              { id: 'MOVIE', label: 'Movies' },
                              { id: 'SHOW', label: 'TV Shows' },
                            ] as const
                          ).map((tab) => (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setJwTypeFilter(tab.id)}
                              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                                jwTypeFilter === tab.id
                                  ? 'bg-[#E50000] text-white'
                                  : 'text-zinc-400 hover:text-white'
                              }`}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>

                        <select
                          value={jwCountry}
                          onChange={(e) =>
                            setJwCountry(e.target.value as 'IN' | 'US' | 'GB')
                          }
                          aria-label="JustWatch Region"
                          className="h-8 px-2.5 rounded-xl bg-[#110E17] border border-white/10 text-xs font-semibold text-white cursor-pointer"
                        >
                          <option value="IN">India (IN)</option>
                          <option value="US">Global (US)</option>
                          <option value="GB">UK (GB)</option>
                        </select>
                      </div>
                    </div>

                    {/* Live JustWatch Search Bar */}
                    <div className="relative">
                      <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={jwSearchQuery}
                        onChange={(e) => setJwSearchQuery(e.target.value)}
                        placeholder="Search any Movie or TV Series directly on JustWatch (e.g. Breaking Bad, Stranger Things, Mirzapur, Dune, Interstellar)..."
                        className="w-full min-h-[44px] pl-10 pr-24 rounded-xl bg-[#110E17] border border-white/15 text-xs sm:text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#E50000]"
                      />
                      {jwSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setJwSearchQuery('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-white cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    {/* JustWatch Results Grid */}
                    {isLoadingJwBrowse ? (
                      <div className="py-10 flex flex-col items-center justify-center gap-2 text-zinc-400">
                        <Loader2 className="w-6 h-6 animate-spin text-[#E50000]" />
                        <span className="text-xs font-medium">
                          Fetching live titles from JustWatch...
                        </span>
                      </div>
                    ) : jwResults.length === 0 ? (
                      <div className="py-8 text-center text-xs text-zinc-400">
                        No JustWatch titles matched &ldquo;{jwSearchQuery}&rdquo;. Try another search term.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-h-[380px] overflow-y-auto pr-1">
                        {jwResults.map((card) => {
                          const cardKey = `${card.mediaType}-${card.title}-${card.releaseYear}`;
                          const isPublishingThis =
                            publishingCardKey === cardKey;
                          const alreadyInCatalog = catalog.some(
                            (c) =>
                              (card.tmdbId &&
                                c.tmdbId === card.tmdbId &&
                                c.mediaType === card.mediaType) ||
                              (c.title.toLowerCase() ===
                                card.title.toLowerCase() &&
                                c.releaseYear === card.releaseYear)
                          );

                          return (
                            <div
                              key={cardKey}
                              className="rounded-xl bg-[#110E17] border border-white/10 hover:border-[#B892FF]/50 p-2.5 flex flex-col justify-between gap-2.5 transition-colors"
                            >
                              <div className="flex gap-2.5 min-w-0">
                                <img
                                  src={card.posterUrl || card.backdropUrl}
                                  alt={card.title}
                                  referrerPolicy="no-referrer"
                                  className="w-14 h-20 rounded-lg object-cover border border-white/10 shrink-0 bg-black"
                                />
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-mono-tabular">
                                    <span
                                      className={`font-extrabold uppercase ${
                                        card.mediaType === 'tv'
                                          ? 'text-[#B892FF]'
                                          : 'text-[#E50000]'
                                      }`}
                                    >
                                      {card.mediaType === 'tv'
                                        ? 'TV SERIES'
                                        : 'MOVIE'}
                                    </span>
                                    <span className="text-zinc-500">·</span>
                                    <span className="text-zinc-400">
                                      {card.releaseYear}
                                    </span>
                                    {card.imdbScore && (
                                      <>
                                        <span className="text-zinc-500">·</span>
                                        <span className="text-amber-400 font-bold">
                                          ★ {card.imdbScore.toFixed(1)}
                                        </span>
                                      </>
                                    )}
                                  </div>

                                  <p
                                    className="text-xs font-bold text-white line-clamp-2 leading-snug"
                                    title={card.title}
                                  >
                                    {card.title}
                                  </p>

                                  <p className="text-[10px] text-zinc-400 truncate">
                                    {card.genres.slice(0, 3).join(' · ')}
                                  </p>
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-white/10">
                                <button
                                  type="button"
                                  disabled={isExtractingJw}
                                  onClick={() =>
                                    handleExtractFromJustWatch(
                                      card.justWatchUrl,
                                      card.title,
                                      card.mediaType,
                                      false
                                    )
                                  }
                                  className="min-h-[32px] px-2 py-1 rounded-lg bg-white/[0.07] hover:bg-white/[0.14] text-[11px] font-bold text-white flex items-center justify-center gap-1 cursor-pointer transition-colors"
                                  title="Load full details & cast photos into editor"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>Select</span>
                                </button>

                                <button
                                  type="button"
                                  disabled={isExtractingJw}
                                  onClick={() =>
                                    handleExtractFromJustWatch(
                                      card.justWatchUrl,
                                      card.title,
                                      card.mediaType,
                                      true
                                    )
                                  }
                                  className="min-h-[32px] px-2 py-1 rounded-lg bg-[#B892FF]/20 hover:bg-[#B892FF]/30 border border-[#B892FF]/40 text-[11px] font-bold text-[#B892FF] flex items-center justify-center gap-1 cursor-pointer transition-colors"
                                  title="Preview player & episodes before publishing"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Preview</span>
                                </button>

                                <button
                                  type="button"
                                  disabled={isPublishingThis}
                                  onClick={() =>
                                    handleDirectPublishFromJustWatchCard(card)
                                  }
                                  className={`min-h-[32px] px-2 py-1 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                                    alreadyInCatalog
                                      ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30'
                                      : 'bg-[#E50000] hover:bg-[#FF1A1A] text-white'
                                  }`}
                                  title="Directly extract and publish to app"
                                >
                                  {isPublishingThis ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : alreadyInCatalog ? (
                                    <>
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>Update</span>
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="w-3 h-3" />
                                      <span>Publish</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* STEP 1B: Paste Single JustWatch URL to Load Into Editor */}
                  <div className="rounded-2xl bg-gradient-to-br from-[#231B36] to-[#181326] border border-[#B892FF]/30 p-4 sm:p-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Wand2 className="w-4 h-4 text-[#B892FF]" />
                        <h3 className="text-sm sm:text-base font-bold text-white font-display">
                          Or Paste a Single JustWatch URL to Edit Before Publishing
                        </h3>
                      </div>
                      <span className="text-[11px] text-[#38BDF8] font-mono-tabular">
                        Title · Year · Cast & Director Photos · Verified Episodes
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <input
                        type="text"
                        value={justWatchUrl}
                        onChange={(e) => setJustWatchUrl(e.target.value)}
                        onPaste={(e) => {
                          const pasted = e.clipboardData?.getData('text') || '';
                          const bulk = parseBulkJustWatchLinks(pasted);
                          if (bulk.length > 1) {
                            e.preventDefault();
                            setMultiLinksInput(bulk.join(',\n'));
                            setJustWatchUrl('');
                            void handleRunMultiLinkBatch(true, bulk);
                          }
                        }}
                        placeholder="https://www.justwatch.com/in/movie/interstellar (or paste multiple links)"
                        className="flex-1 min-h-[44px] px-4 rounded-xl bg-[#110E17] border border-white/15 text-xs sm:text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#B892FF] font-mono-tabular"
                      />
                      <button
                        type="button"
                        disabled={isExtractingJw}
                        onClick={() => handleExtractFromJustWatch()}
                        className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#B892FF] text-[#110E17] font-bold text-xs sm:text-sm hover:bg-[#C9ABFF] transition-colors flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-60"
                      >
                        {isExtractingJw ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Extracting...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            <span>Auto-Extract from URL</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* =========================================================
                      ADMIN LIVE PREVIEW PANEL (BEFORE PUBLISHING TO THE APP)
                  ========================================================= */}
                  {currentDraftPreviewItem && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl bg-[#110E17] border-2 border-[#B892FF] p-4 sm:p-6 space-y-5 shadow-2xl"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-extrabold uppercase text-[#B892FF]">
                            Live Pre-Publish Preview
                          </span>
                          <span className="text-zinc-500">·</span>
                          <h3 className="text-base sm:text-lg font-bold text-white font-display">
                            {currentDraftPreviewItem.title} (
                            {currentDraftPreviewItem.releaseYear})
                          </h3>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {onPreviewDraftInApp && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onPreviewDraftInApp(currentDraftPreviewItem);
                              }}
                              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-[#B892FF]" />
                              <span>Open Full-Page App Preview</span>
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleSaveToFirestore()}
                            className="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#E50000] hover:bg-[#FF1A1A] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-[#E50000]/25"
                          >
                            {isSaving ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Plus className="w-3.5 h-3.5" />
                            )}
                            <span>Publish Now to App</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setShowLivePreview(false)}
                            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-zinc-300 cursor-pointer"
                          >
                            Close Preview
                          </button>
                        </div>
                      </div>

                      {/* Season & Episode Selector for Series Preview */}
                      {currentDraftPreviewItem.mediaType === 'tv' && (
                        <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-[#1A1526] border border-white/10">
                          <span className="text-xs font-bold text-[#B892FF] uppercase">
                            Test Series Episodes:
                          </span>
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-zinc-400">
                              Season:
                            </label>
                            <select
                              value={previewSeason}
                              onChange={(e) => {
                                setPreviewSeason(Number(e.target.value));
                                setPreviewEpisode(1);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-[#110E17] border border-white/15 text-xs text-white font-bold"
                            >
                              {Array.from(
                                {
                                  length: Math.max(
                                    1,
                                    currentDraftPreviewItem.seasonsCount || 1
                                  ),
                                },
                                (_, i) => i + 1
                              ).map((s) => (
                                <option key={s} value={s}>
                                  Season {s}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex items-center gap-2">
                            <label className="text-xs text-zinc-400">
                              Episode:
                            </label>
                            <select
                              value={previewEpisode}
                              onChange={(e) =>
                                setPreviewEpisode(Number(e.target.value))
                              }
                              className="px-2.5 py-1 rounded-lg bg-[#110E17] border border-white/15 text-xs text-white font-bold"
                            >
                              {Array.from(
                                {
                                  length: Math.max(
                                    1,
                                    currentDraftPreviewItem.episodesCount || 8
                                  ),
                                },
                                (_, i) => i + 1
                              ).map((ep) => (
                                <option key={ep} value={ep}>
                                  Episode {ep}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}

                      {/* Live Video Player Stream Test */}
                      <VideoPlayer
                        item={currentDraftPreviewItem}
                        selectedSeason={previewSeason}
                        selectedEpisodeNumber={previewEpisode}
                        onNextEpisode={
                          currentDraftPreviewItem.mediaType === 'tv'
                            ? () => setPreviewEpisode((e) => e + 1)
                            : undefined
                        }
                      />

                      {/* Banner & Metadata Card Preview */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 rounded-xl bg-[#1A1526] border border-white/10 items-center">
                        <div className="md:col-span-5 aspect-video rounded-xl overflow-hidden border border-white/10 bg-black relative">
                          <img
                            src={
                              currentDraftPreviewItem.backdropUrl ||
                              currentDraftPreviewItem.posterUrl
                            }
                            alt={currentDraftPreviewItem.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <div className="md:col-span-7 space-y-2">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-300">
                            <span className="text-[#E50000] font-bold uppercase">
                              {currentDraftPreviewItem.mediaType === 'tv'
                                ? 'Series'
                                : 'Movie'}
                            </span>
                            <span>·</span>
                            <span>{currentDraftPreviewItem.releaseYear}</span>
                            <span>·</span>
                            <span>
                              {currentDraftPreviewItem.maturityRating}
                            </span>
                            <span>·</span>
                            <span>
                              {currentDraftPreviewItem.genres.join(' / ')}
                            </span>
                          </div>
                          <h4 className="text-lg font-bold text-white font-display">
                            {currentDraftPreviewItem.title}
                          </h4>
                          <p className="text-xs text-zinc-300 line-clamp-3 leading-relaxed">
                            {currentDraftPreviewItem.synopsis}
                          </p>
                          <p className="text-[11px] text-zinc-400">
                            <strong className="text-white">Director:</strong>{' '}
                            {currentDraftPreviewItem.directorOrCreator} ·{' '}
                            <strong className="text-white">Cast:</strong>{' '}
                            {currentDraftPreviewItem.cast
                              .slice(0, 5)
                              .join(', ')}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* STEP 2: EmbedMaster Stream + Movie/Show Form */}
                  <form
                    ref={formRef}
                    onSubmit={handleSaveToFirestore}
                    className="rounded-2xl bg-[#1A1526] border border-white/10 p-4 sm:p-5 space-y-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                      <h3 className="text-sm sm:text-base font-bold text-white font-display flex items-center gap-2">
                        <Plus className="w-4 h-4 text-[#B892FF]" />
                        <span>
                          {editingId
                            ? `Editing: ${title || editingId}`
                            : 'Step 2: Review Details, Preview & Publish'}
                        </span>
                      </h3>
                      <div className="flex items-center gap-3">
                        {title.trim() && (
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewSeason(1);
                              setPreviewEpisode(1);
                              setShowLivePreview((prev) => !prev);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-[#B892FF]/20 hover:bg-[#B892FF]/30 border border-[#B892FF]/40 text-xs font-bold text-[#B892FF] flex items-center gap-1.5 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>
                              {showLivePreview
                                ? 'Hide Live Preview'
                                : 'Preview Movie / Series'}
                            </span>
                          </button>
                        )}
                        {editingId && (
                          <button
                            type="button"
                            onClick={resetForm}
                            className="text-xs text-zinc-400 hover:text-white underline cursor-pointer"
                          >
                            Cancel Edit & Create New
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Stream Endpoint Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 p-3.5 rounded-xl bg-[#120E1A] border border-white/10">
                      <div className="sm:col-span-3">
                        <label className="block text-xs text-zinc-400 mb-1">
                          Content Type
                        </label>
                        <select
                          value={mediaType}
                          onChange={(e) => {
                            const next = e.target.value as TMDBMediaType;
                            setMediaType(next);
                            setMaturityRating(next === 'tv' ? 'TV-14' : 'PG-13');
                          }}
                          className="w-full min-h-[42px] px-3 rounded-xl bg-[#1A1625] border border-white/10 text-xs text-white font-semibold"
                        >
                          <option value="movie">Movie</option>
                          <option value="tv">TV Series</option>
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-xs text-zinc-400 mb-1">
                          Catalog Code (Auto-extracted)
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={tmdbIdInput}
                          onChange={(e) => setTmdbIdInput(e.target.value)}
                          placeholder="Auto-filled"
                          className="w-full min-h-[42px] px-3 rounded-xl bg-[#1A1625] border border-white/10 text-xs text-white font-mono-tabular"
                        />
                      </div>

                      <div className="sm:col-span-6">
                        <label className="block text-xs text-zinc-400 mb-1">
                          Stream Endpoint (Auto-configured)
                        </label>
                        <input
                          type="text"
                          required
                          value={cinesrcInput}
                          onChange={(e) =>
                            handleCineSrcInputChange(e.target.value)
                          }
                          placeholder="Auto-configured on select/extract"
                          className="w-full min-h-[42px] px-3 rounded-xl bg-[#1A1625] border border-[#B892FF]/40 text-xs text-[#B892FF] font-mono-tabular"
                        />
                      </div>
                    </div>

                    {/* Title, Year, Duration, Rating, Seasons/Episodes */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                      <div className="sm:col-span-2">
                        <label className="block text-xs text-zinc-400 mb-1">
                          Title
                        </label>
                        <input
                          type="text"
                          required
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="e.g. Interstellar"
                          className="w-full min-h-[40px] px-3 rounded-xl bg-[#110E17] border border-white/10 text-xs text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">
                          Release Year
                        </label>
                        <input
                          type="number"
                          min={1900}
                          max={2100}
                          value={releaseYear}
                          onChange={(e) => setReleaseYear(e.target.value)}
                          className="w-full min-h-[40px] px-3 rounded-xl bg-[#110E17] border border-white/10 text-xs text-white font-mono-tabular"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">
                          Runtime (Minutes)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={1000}
                          value={durationMinutes}
                          onChange={(e) => setDurationMinutes(e.target.value)}
                          className="w-full min-h-[40px] px-3 rounded-xl bg-[#110E17] border border-white/10 text-xs text-white font-mono-tabular"
                        />
                      </div>

                      {mediaType === 'tv' && (
                        <>
                          <div>
                            <label className="block text-xs text-zinc-400 mb-1">
                              Total Aired Seasons
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={100}
                              value={seasonsCount}
                              onChange={(e) => setSeasonsCount(e.target.value)}
                              className="w-full min-h-[40px] px-3 rounded-xl bg-[#110E17] border border-white/10 text-xs text-white font-mono-tabular"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-zinc-400 mb-1">
                              Episodes in Season 1
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={500}
                              value={episodesCount}
                              onChange={(e) => setEpisodesCount(e.target.value)}
                              className="w-full min-h-[40px] px-3 rounded-xl bg-[#110E17] border border-white/10 text-xs text-white font-mono-tabular"
                            />
                          </div>
                        </>
                      )}

                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">
                          Director / Creator
                        </label>
                        <input
                          type="text"
                          value={directorOrCreator}
                          onChange={(e) => setDirectorOrCreator(e.target.value)}
                          className="w-full min-h-[40px] px-3 rounded-xl bg-[#110E17] border border-white/10 text-xs text-white"
                        />
                      </div>

                      <div className="sm:col-span-2 lg:col-span-3">
                        <label className="block text-xs text-zinc-400 mb-1">
                          Cast Names (Comma-separated, auto-extracted from JustWatch)
                        </label>
                        <input
                          type="text"
                          value={castInput}
                          onChange={(e) => setCastInput(e.target.value)}
                          className="w-full min-h-[40px] px-3 rounded-xl bg-[#110E17] border border-white/10 text-xs text-white"
                        />
                      </div>
                    </div>

                    {/* Extracted Director & Cast Portrait Gallery */}
                    {credits.length > 0 && (
                      <div className="p-4 rounded-2xl bg-[#120E1A] border border-[#B892FF]/25 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                            <Users className="w-4 h-4 text-[#B892FF]" />
                            <span>
                              Extracted Cast & Director Profiles with Photos ({credits.length})
                            </span>
                          </h4>
                          <span className="text-[11px] text-[#B892FF] font-mono-tabular">
                            Saved to Cloud Firestore
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2.5">
                          {credits.map((person, idx) => (
                            <div
                              key={`${person.name}-${idx}`}
                              className="rounded-xl bg-[#1A1526] border border-white/10 p-2 flex items-center gap-2.5 min-w-0"
                            >
                              <img
                                src={person.imageUrl}
                                alt={person.name}
                                referrerPolicy="no-referrer"
                                className="w-10 h-12 rounded-lg object-cover border border-white/15 shrink-0 bg-[#110E17]"
                              />
                              <div className="min-w-0 flex-1">
                                <span
                                  className={`block text-[9px] font-bold uppercase tracking-wider font-mono-tabular ${
                                    person.role === 'DIRECTOR'
                                      ? 'text-[#FF8A3D]'
                                      : 'text-[#B892FF]'
                                  }`}
                                >
                                  {person.role}
                                </span>
                                <p className="text-xs font-bold text-white truncate">
                                  {person.name}
                                </p>
                                {person.characterName && (
                                  <p className="text-[10px] text-zinc-400 truncate">
                                    {person.characterName}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Synopsis */}
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">
                        Synopsis / Description
                      </label>
                      <textarea
                        rows={2}
                        value={synopsis}
                        onChange={(e) => setSynopsis(e.target.value)}
                        placeholder="Plot overview (auto-filled when you select or extract from JustWatch)..."
                        className="w-full p-3 rounded-xl bg-[#110E17] border border-white/10 text-xs text-white"
                      />
                    </div>

                    {/* JustWatch Extracted Banner/Backdrop & Poster URLs + Live Visual Preview */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3.5 rounded-xl bg-[#120E1A] border border-white/10">
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                          <ImageIcon className="w-3.5 h-3.5 text-[#B892FF]" />
                          <span>
                            Banner / Backdrop Image URL (Auto-filled from JustWatch)
                          </span>
                        </label>
                        <input
                          type="text"
                          value={backdropUrl}
                          onChange={(e) => setBackdropUrl(e.target.value)}
                          placeholder="https://images.justwatch.com/backdrop/..."
                          className="w-full min-h-[38px] px-3 rounded-xl bg-[#1A1625] border border-white/10 text-xs text-white font-mono-tabular"
                        />
                        {backdropUrl && (
                          <div className="aspect-video w-full rounded-xl overflow-hidden border border-white/15 bg-black">
                            <img
                              src={backdropUrl}
                              alt="Backdrop preview"
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        {extraBackdrops.length > 1 && (
                          <div className="space-y-1 pt-1">
                            <span className="text-[10px] text-zinc-400">
                              Click another JustWatch backdrop to switch:
                            </span>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                              {extraBackdrops.map((bUrl, idx) => (
                                <button
                                  key={bUrl}
                                  type="button"
                                  onClick={() => setBackdropUrl(bUrl)}
                                  className={`h-11 w-20 rounded-lg overflow-hidden border shrink-0 cursor-pointer ${
                                    backdropUrl === bUrl
                                      ? 'border-[#B892FF] ring-2 ring-[#B892FF]/40'
                                      : 'border-white/15 opacity-70 hover:opacity-100'
                                  }`}
                                >
                                  <img
                                    src={bUrl}
                                    alt={`Backdrop option ${idx + 1}`}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover"
                                  />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                          <ImageIcon className="w-3.5 h-3.5 text-[#B892FF]" />
                          <span>
                            Poster Image URL (Auto-filled from JustWatch)
                          </span>
                        </label>
                        <input
                          type="text"
                          value={posterUrl}
                          onChange={(e) => setPosterUrl(e.target.value)}
                          placeholder="https://images.justwatch.com/poster/..."
                          className="w-full min-h-[38px] px-3 rounded-xl bg-[#1A1625] border border-white/10 text-xs text-white font-mono-tabular"
                        />
                        {posterUrl && (
                          <div className="h-36 w-28 rounded-xl overflow-hidden border border-white/15 bg-black">
                            <img
                              src={posterUrl}
                              alt="Poster preview"
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Genre Selection & Featured Toggle */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1.5">
                        <span className="block text-xs text-zinc-400">
                          Genres (Auto-selected from JustWatch, up to 6):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {ALL_GENRES.map((g) => {
                            const active = selectedGenres.includes(g);
                            return (
                              <button
                                key={g}
                                type="button"
                                onClick={() => toggleGenre(g)}
                                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                                  active
                                    ? 'bg-[#B892FF] text-[#110E17] font-bold'
                                    : 'bg-[#110E17] border border-white/10 text-zinc-400 hover:text-white'
                                }`}
                              >
                                {g}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <label className="flex items-center gap-2.5 text-xs text-zinc-200 cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={featured}
                          onChange={(e) => setFeatured(e.target.checked)}
                          className="w-4 h-4 accent-[#B892FF]"
                        />
                        <span>Feature in Hero Spotlight Banner</span>
                      </label>
                    </div>

                    {/* Action Buttons: Preview Before Publishing + Publish to App */}
                    <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!title.trim()) {
                            setErrorMessage(
                              'Select or extract a movie/show first to preview it.'
                            );
                            return;
                          }
                          setPreviewSeason(1);
                          setPreviewEpisode(1);
                          setShowLivePreview(true);
                        }}
                        className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#110E17] hover:bg-white/10 border border-[#B892FF]/50 text-[#B892FF] font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Preview Player & Layout</span>
                      </button>

                      {onPreviewDraftInApp && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!title.trim()) {
                              setErrorMessage(
                                'Select or extract a movie/show first to preview it.'
                              );
                              return;
                            }
                            const draft = buildDraftMediaItemFromForm();
                            if (draft) {
                              onClose();
                              onPreviewDraftInApp(draft);
                            }
                          }}
                          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-2"
                        >
                          <ExternalLink className="w-4 h-4 text-[#B892FF]" />
                          <span>Full-Page App Preview</span>
                        </button>
                      )}

                      <button
                        type="submit"
                        disabled={isSaving}
                        className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#E50000] hover:bg-[#FF1A1A] text-white font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-[#E50000]/25 disabled:opacity-60"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Publishing to App...</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4" />
                            <span>
                              {editingId
                                ? 'Update Movie / Show in App'
                                : 'Publish Movie / Show to App'}
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>

                  {/* Published Firestore Catalog List */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-white font-display">
                      Published Movies & TV Shows in Cloud Firestore ({catalog.length})
                    </h3>

                    {catalog.length === 0 ? (
                      <div className="rounded-2xl bg-[#1A1526] border border-white/10 p-6 text-center text-xs text-zinc-400">
                        Your catalog is currently empty. Select any Movie or TV Show from the JustWatch browser above or paste up to 100 links to publish!
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {catalog.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-2xl bg-[#1A1526] border border-white/10 p-3 flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <img
                                src={item.backdropUrl || item.posterUrl}
                                alt={item.title}
                                referrerPolicy="no-referrer"
                                className="w-20 h-12 rounded-lg object-cover border border-white/10 shrink-0 bg-black"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 text-[11px] font-mono-tabular text-[#38BDF8]">
                                  {item.mediaType === 'tv' ? (
                                    <Tv className="w-3 h-3 shrink-0" />
                                  ) : (
                                    <Film className="w-3 h-3 shrink-0" />
                                  )}
                                  <span>
                                    {item.mediaType === 'tv'
                                      ? 'SERIES'
                                      : 'MOVIE'}
                                  </span>
                                  <span>·</span>
                                  <span>{item.releaseYear}</span>
                                </div>
                                <p className="text-xs sm:text-sm font-bold text-white truncate">
                                  {item.title}
                                </p>
                                <p className="text-[10px] text-emerald-400 truncate font-mono-tabular">
                                  {item.genres.join(' · ')}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {onSelectMediaToWatch && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    onSelectMediaToWatch(item);
                                  }}
                                  className="min-h-[34px] px-2.5 py-1.5 rounded-lg bg-[#B892FF] text-[#110E17] text-xs font-bold flex items-center gap-1 cursor-pointer"
                                  title="Watch Stream"
                                >
                                  <Play className="w-3 h-3 fill-current" />
                                  <span>Play</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => populateFormFromItem(item)}
                                className="min-h-[34px] px-2.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs text-zinc-200 flex items-center gap-1 cursor-pointer"
                                title="Edit"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteFromFirestore(item.id, item.title)
                                }
                                className="min-h-[34px] px-2.5 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-xs text-red-300 flex items-center gap-1 cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
