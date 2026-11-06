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
  FileText,
  Save,
  RotateCcw,
  KeyRound,
  Send,
  Server,
  RefreshCw,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  getDoc,
  getDocs,
  collection,
} from 'firebase/firestore';
import {
  db,
  ADMIN_EMAIL,
  isUserAdmin,
  signInWithEmail,
  sendPasswordReset,
  signInWithGithub,
  getFriendlyAuthErrorMessage,
  handleFirestoreError,
  OperationType,
  ACTIVE_FIREBASE_PROJECT_ID,
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
import {
  LegalPagesConfig,
  LegalPageContent,
  DEFAULT_LEGAL_PAGES,
  OFFICIAL_CONTACT_EMAIL,
  normalizeLegalPagesConfig,
} from './InfoModal';
import { safeApiFetchJson } from '../utils/apiClient';

const LOGO_ASSET_URL =
  '/assets/aistudio/20261023_170257_6e6b6602.png';

export const ZAPPYFUN_FIRESTORE_RULES_SNIPPET = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
    function isSignedIn() {
      return request.auth != null;
    }
    function isVerifiedUser() {
      return isSignedIn() && request.auth.token.email_verified == true;
    }
    function isAdmin() {
      return isSignedIn() && (
        (request.auth.token.email_verified == true && (
          request.auth.token.email == 'pawarayushai1@gmail.com' ||
          request.auth.token.email == 'admin@zappy.app'
        )) ||
        exists(/databases/$(database)/documents/admins/$(request.auth.uid))
      );
    }
    match /catalog/{mediaId} {
      allow get: if resource.data.visibility == 'public' || isAdmin();
      allow list: if true;
      allow create, update, delete: if isAdmin();
    }
    match /watchlists/{watchlistDocId} {
      allow get, list, delete: if isVerifiedUser() && (resource.data.ownerId == request.auth.uid || isAdmin());
      allow create: if isVerifiedUser() && request.resource.data.ownerId == request.auth.uid;
      allow update: if false;
    }
    match /support_messages/{messageId} {
      allow get, list: if isAdmin();
      allow create: if isVerifiedUser() && request.resource.data.senderUid == request.auth.uid;
      allow update, delete: if isVerifiedUser() && isAdmin();
    }
    match /ui_config/{configId} {
      allow get: if true;
      allow list: if false;
      allow create, update, delete: if isAdmin();
    }
    match /ui_overrides/{overrideId} {
      allow get: if true;
      allow list: if false;
      allow create, update, delete: if isAdmin();
    }
    match /admins/{adminUid} {
      allow get: if isVerifiedUser() && (request.auth.uid == adminUid || isAdmin());
      allow list, create, update, delete: if false;
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
  initialTab?: 'catalog' | 'support' | 'legal';
  legalPages?: LegalPagesConfig;
  onSaveLegalPages?: (nextLegal: LegalPagesConfig) => Promise<void> | void;
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
 * Checks if a candidate movie already exists in the catalog to prevent duplicate uploads.
 * Matches by doc ID, TMDB ID, normalized title, or JustWatch URL.
 */
export function findDuplicateMovie(
  candidate: {
    id?: string;
    title?: string;
    tmdbId?: number | string | null;
    justWatchUrl?: string;
  },
  catalogList: MediaItem[],
  currentEditId?: string | null
): MediaItem | undefined {
  if (!candidate || !catalogList || catalogList.length === 0) return undefined;
  const normTitle = (candidate.title || '').trim().toLowerCase();
  const candTmdb = Number(candidate.tmdbId) || 0;
  const candJw = (candidate.justWatchUrl || '').trim().toLowerCase();
  const candId = (candidate.id || '').trim().toLowerCase();

  return catalogList.find((item) => {
    // If editing existing movie, skip self
    if (currentEditId && item.id === currentEditId) {
      return false;
    }
    // Check if doc ID matches
    if (candId && item.id.toLowerCase() === candId) {
      return true;
    }
    // Check if real TMDB ID matches (excluding fallback dummy id 157336 unless title matches)
    const itemTmdb = Number(item.tmdbId) || 0;
    if (candTmdb > 0 && candTmdb !== 157336 && itemTmdb === candTmdb) {
      return true;
    }
    // Check if normalized title matches
    if (normTitle && item.title.trim().toLowerCase() === normTitle) {
      return true;
    }
    // Check if JustWatch URL matches
    if (
      candJw &&
      item.justWatchUrl &&
      item.justWatchUrl.trim().toLowerCase() === candJw
    ) {
      return true;
    }
    return false;
  });
}

/**
 * Builds the Vidly.pro embed URL for a Movie or TV Show using the numeric TMDb ID.
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
    /(?:https?:\/\/)?(?:www\.)?(?:vidly\.pro|embedmaster\.link|embedmaster\.com|cinesrc\.st|vidlink\.pro)(?:\/embed)?\/(movie|tv|series|show)\/(tt\d+|\d+)/i;

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
    const embedUrl =
      detectedType === 'tv'
        ? `https://vidly.pro/tv/${detectedTmdbId}/1/1`
        : `https://vidly.pro/movie/${detectedTmdbId}`;
    return {
      embedUrl,
      detectedType,
      detectedTmdbId,
    };
  }

  const finalTmdbId = cleanFallbackTmdb || 157336;
  const embedUrl =
    fallbackType === 'tv'
      ? `https://vidly.pro/tv/${finalTmdbId}/1/1`
      : `https://vidly.pro/movie/${finalTmdbId}`;
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
  // ZappyFun is strictly a movies-only platform
  const finalMediaType: TMDBMediaType = 'movie';
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

  const streamTmdbId = finalTmdbId > 0 ? finalTmdbId : 157336;
  const finalEmbedUrl = `https://vidly.pro/movie/${streamTmdbId}`;

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
    contentType: 'movie',
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
    seasonsCount: 0,
    episodesCount: 0,
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
  legalPages = DEFAULT_LEGAL_PAGES,
  onSaveLegalPages,
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

  const [activeAdminTab, setActiveAdminTab] = useState<
    'catalog' | 'support' | 'legal' | 'smtp'
  >(initialTab);

  // Admin Email Sign In State
  const [adminEmailInput, setAdminEmailInput] = useState<string>(ADMIN_EMAIL);
  const [adminPasswordInput, setAdminPasswordInput] = useState<string>('');
  const [isAdminLoggingIn, setIsAdminLoggingIn] = useState<boolean>(false);
  const [isAdminGithubLoading, setIsAdminGithubLoading] = useState<boolean>(false);

  // SMTP Settings State
  const [smtpForm, setSmtpForm] = useState({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    user: 'pawarayushai1@gmail.com',
    pass: '',
    from: 'ZappyFun Verification <pawarayushai1@gmail.com>',
  });
  const [smtpStatus, setSmtpStatus] = useState<{
    configured: boolean;
    host: string;
    port: number;
    user: string;
    from: string;
    hasPassword: boolean;
  } | null>(null);
  const [isSavingSmtp, setIsSavingSmtp] = useState<boolean>(false);
  const [isTestingSmtp, setIsTestingSmtp] = useState<boolean>(false);
  const [smtpTestResult, setSmtpTestResult] = useState<string | null>(null);
  const [showSmtpPassword, setShowSmtpPassword] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [justWatchUrl, setJustWatchUrl] = useState<string>('');
  const [isExtractingJw, setIsExtractingJw] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Legal & Policies Editor State
  const [legalDraft, setLegalDraft] = useState<LegalPagesConfig>(() =>
    normalizeLegalPagesConfig(legalPages)
  );
  const [activeLegalSection, setActiveLegalSection] = useState<
    'terms' | 'privacy' | 'advertising' | 'disclaimer' | 'about'
  >('terms');
  const [isSavingLegal, setIsSavingLegal] = useState<boolean>(false);

  useEffect(() => {
    if (legalPages) {
      setLegalDraft(normalizeLegalPagesConfig(legalPages));
    }
  }, [legalPages]);

  const handleSaveLegalToFirestore = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentUser || !isAdmin) {
      setErrorMessage(`Only ${ADMIN_EMAIL} can update legal pages.`);
      return;
    }
    setIsSavingLegal(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const cleaned: LegalPagesConfig = {
        ...legalDraft,
        contactEmail:
          legalDraft.contactEmail
            .trim()
            .replace(/ContactZappyFun@gamil\.com/gi, OFFICIAL_CONTACT_EMAIL) ||
          OFFICIAL_CONTACT_EMAIL,
        updatedAtMs: Date.now(),
      };
      if (onSaveLegalPages) {
        await onSaveLegalPages(cleaned);
      } else {
        await setDoc(
          doc(db, 'ui_config', 'legal_pages'),
          {
            ...cleaned,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
      setStatusMessage(
        'Saved Terms, Privacy Policy, Legal Pages & Contact Email to live app!'
      );
    } catch (err) {
      setErrorMessage(
        `Failed to save legal pages: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    } finally {
      setIsSavingLegal(false);
    }
  };

  const updateLegalSectionField = (
    sectionKey: 'terms' | 'privacy' | 'advertising' | 'disclaimer' | 'about',
    field: keyof LegalPageContent,
    value: string
  ) => {
    setLegalDraft((prev) => ({
      ...prev,
      [sectionKey]: {
        ...(prev[sectionKey] || DEFAULT_LEGAL_PAGES[sectionKey]),
        [field]: value,
      },
    }));
  };

  // Multi-Link JustWatch Batch Importer State (Up to 100 Comma-Separated Links)
  const [multiLinksInput, setMultiLinksInput] = useState<string>('');
  const [isBatchRunning, setIsBatchRunning] = useState<boolean>(false);
  const [batchResults, setBatchResults] = useState<BatchLinkResultItem[]>([]);
  const [batchCompletedCount, setBatchCompletedCount] = useState<number>(0);
  const [batchTotalCount, setBatchTotalCount] = useState<number>(0);
  const cancelBatchRef = useRef<boolean>(false);

  // Firebase Project Switcher & Security Rules Drawer State
  const [rulesCopied, setRulesCopied] = useState<boolean>(false);
  const [showRulesDrawer, setShowRulesDrawer] = useState<boolean>(false);

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

  const loadSmtpStatus = useCallback(async () => {
    try {
      const { ok, data } = await safeApiFetchJson<any>('/api/auth/smtp-status');
      if (ok && data) {
        setSmtpStatus(data);
        setSmtpForm((prev) => ({
          ...prev,
          host: data.host || prev.host,
          port: data.port || prev.port,
          secure: data.secure ?? prev.secure,
          user: data.user || prev.user,
          from: data.from || prev.from,
        }));
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadSmtpStatus();
    }
  }, [isOpen, loadSmtpStatus]);

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSavingSmtp(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const token = await currentUser.getIdToken();
      const { ok, data } = await safeApiFetchJson<any>('/api/admin/smtp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(smtpForm),
      });
      if (!ok) throw new Error(data?.error || 'Failed to save SMTP settings.');
      setSmtpStatus(data.status);
      setStatusMessage('SMTP configuration saved successfully! Gmail verification is active.');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error saving SMTP settings.');
    } finally {
      setIsSavingSmtp(false);
    }
  };

  const handleTestSmtp = async () => {
    if (!currentUser) return;
    setIsTestingSmtp(true);
    setSmtpTestResult(null);
    try {
      const token = await currentUser.getIdToken();
      const { data } = await safeApiFetchJson<any>('/api/admin/test-smtp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: smtpForm.user || ADMIN_EMAIL }),
      });
      setSmtpTestResult(data?.message || (data?.success ? 'Test email sent successfully!' : 'Test email failed.'));
    } catch (err: unknown) {
      setSmtpTestResult(err instanceof Error ? err.message : 'Failed to send test email.');
    } finally {
      setIsTestingSmtp(false);
    }
  };

  const handleAdminEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdminLoggingIn(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await signInWithEmail(adminEmailInput.trim(), adminPasswordInput);
      setStatusMessage('Signed in successfully as administrator.');
    } catch (err: unknown) {
      const errObj = err as { code?: string; message?: string };
      setErrorMessage(errObj.message || 'Incorrect email or password.');
    } finally {
      setIsAdminLoggingIn(false);
    }
  };

  const handleAdminPasswordReset = async () => {
    try {
      await sendPasswordReset(adminEmailInput.trim() || ADMIN_EMAIL);
      setStatusMessage(`Password reset link sent to ${adminEmailInput.trim() || ADMIN_EMAIL}.`);
    } catch (err: unknown) {
      const errObj = err as { code?: string; message?: string };
      setErrorMessage(errObj.message || 'Failed to send password reset email.');
    }
  };

  const handleAdminGithubSignIn = async () => {
    setIsAdminGithubLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const result = await signInWithGithub();
      if (result && result.user) {
        setStatusMessage(`Signed in as ${result.user.email}`);
      }
    } catch (err: unknown) {
      const friendly = getFriendlyAuthErrorMessage(err);
      setErrorMessage(friendly);
    } finally {
      setIsAdminGithubLoading(false);
    }
  };

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
        const { ok, data } = await safeApiFetchJson<{ items?: JustWatchBrowseCard[] }>(
          `/api/justwatch/search?${params.toString()}`
        );
        if (ok && Array.isArray(data?.items)) {
          setJwResults(data.items);
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
    const tmdb = numId > 0 ? numId : 157336;
    setCinesrcInput(
      mediaType === 'tv'
        ? `https://vidly.pro/tv/${tmdb}/1/1`
        : `https://vidly.pro/movie/${tmdb}`
    );
  }, [mediaType, tmdbIdInput]);

  const populateFormFromItem = (item: MediaItem) => {
    setEditingId(item.id);
    setMediaType(item.mediaType);
    setTmdbIdInput(String(item.tmdbId));
    const imdbMatch = (item.cinesrcEmbedUrl || '').match(/(tt\d{5,12})/i);
    setImdbIdState(imdbMatch?.[1] ? imdbMatch[1].toLowerCase() : '');
    const numId = Number(item.tmdbId) || 157336;
    setCinesrcInput(
      item.cinesrcEmbedUrl && item.cinesrcEmbedUrl.includes('vidly.pro')
        ? item.cinesrcEmbedUrl
        : item.mediaType === 'tv'
        ? `https://vidly.pro/tv/${numId}/1/1`
        : `https://vidly.pro/movie/${numId}`
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
      /(?:https?:\/\/)?(?:www\.)?(?:vidly\.pro|embedmaster\.link|embedmaster\.com|vidlink\.pro|cinesrc\.st)(?:\/embed)?\/(movie|tv|series|show)\/(tt\d+|\d+)/i;
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
      const tmdb = Number(data.tmdbId) || 157336;
      setCinesrcInput(
        detected === 'tv'
          ? `https://vidly.pro/tv/${tmdb}/1/1`
          : `https://vidly.pro/movie/${tmdb}`
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

    // Strict duplicate check: prevent uploading the same movie twice
    const duplicate = findDuplicateMovie(item, catalog, editingId);
    if (duplicate && duplicate.id !== item.id) {
      throw new Error(
        `Duplicate Movie Detected: "${duplicate.title}" (${duplicate.releaseYear}) is already in your catalog! You cannot upload the same movie twice.`
      );
    }

    const docRef = doc(db, 'catalog', item.id);
    const existingItem = catalog.find((c) => c.id === item.id);

    const payload: Record<string, any> = {
      id: item.id,
      tmdbId: item.tmdbId,
      mediaType: 'movie',
      contentType: 'movie',
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
      seasonsCount: 0,
      episodesCount: 0,
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
          const { ok, data: extracted } = await safeApiFetchJson<any>(
            '/api/justwatch/extract',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                justWatchUrl: isUrl ? targetLink : '',
                title: isUrl ? '' : targetLink,
              }),
            }
          );

          if (!ok || !extracted?.title) {
            throw new Error(
              extracted?.error || 'Could not extract from JustWatch link'
            );
          }

          const { item, serializedCredits } =
            buildMediaItemFromExtractedData(extracted);

          const existingDuplicate = findDuplicateMovie(item, catalog);
          if (existingDuplicate) {
            failCount += 1;
            setBatchResults((prev) =>
              prev.map((entry) =>
                entry.index === currentIndex
                  ? {
                      ...entry,
                      status: 'error',
                      errorText: `Duplicate movie skipped: "${existingDuplicate.title}" is already in catalog`,
                      extractedData: extracted,
                      draftItem: item,
                    }
                  : entry
              )
            );
            continue;
          }

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
        const existingDuplicate = findDuplicateMovie(item, catalog);
        if (existingDuplicate) {
          setBatchResults((prev) =>
            prev.map((b) =>
              b.index === entry.index
                ? {
                    ...b,
                    status: 'error',
                    errorText: `Duplicate skipped: "${existingDuplicate.title}" is already in catalog`,
                  }
                : b
            )
          );
          continue;
        }
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
      const { ok, data } = await safeApiFetchJson<any>(
        '/api/justwatch/extract',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            justWatchUrl: targetUrl,
            title: targetTitle,
            mediaType: overrideType,
          }),
        }
      );

      if (!ok || !data) {
        setErrorMessage(
          data?.error || 'Could not extract details from JustWatch.'
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
        `Loaded "${data.title}" (${data.releaseYear}) — ${dirCount} Director(s), ${castCount} Cast Members with Photos, Embed Stream & Episodes!`
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
    const finalMediaType: TMDBMediaType = 'movie';
    const finalTmdbId = parsedCine.detectedTmdbId;
    const finalEmbedUrl = `https://vidly.pro/movie/${finalTmdbId}`;

    const safeTitle = (title.trim() || 'Untitled Preview').slice(0, 200);
    const docId =
      editingId ||
      `movie-${finalTmdbId}`
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
      mediaType: 'movie',
      title: safeTitle,
      tagline: safeTagline,
      synopsis: safeSynopsis,
      contentType: 'movie',
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
      seasonsCount: undefined,
      episodesCount: undefined,
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
    setErrorMessage(null);
    setStatusMessage(null);

    const duplicate = findDuplicateMovie(
      {
        title: card.title,
        tmdbId: card.tmdbId,
        justWatchUrl: card.justWatchUrl,
      },
      catalog
    );
    if (duplicate) {
      setErrorMessage(
        `Duplicate Movie Detected: "${duplicate.title}" (${duplicate.releaseYear}) is already in your catalog! You cannot upload the same movie twice.`
      );
      return;
    }

    const cardKey = `${card.mediaType}-${card.title}-${card.releaseYear}`;
    setPublishingCardKey(cardKey);

    try {
      const { ok, data } = await safeApiFetchJson<any>(
        '/api/justwatch/extract',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            justWatchUrl: card.justWatchUrl,
            title: card.title,
            mediaType: 'movie',
          }),
        }
      );
      const extracted = ok && data ? data : card;
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
        `Only ${ADMIN_EMAIL} can add or update movies in the catalog.`
      );
      return;
    }

    if (!title.trim()) {
      setErrorMessage(
        'Please enter a Movie title (or select one from JustWatch).'
      );
      return;
    }

    const draftItem = buildDraftMediaItemFromForm();
    if (!draftItem) return;

    const duplicate = findDuplicateMovie(draftItem, catalog, editingId);
    if (duplicate && duplicate.id !== editingId) {
      setErrorMessage(
        `Duplicate Movie Detected: "${duplicate.title}" (${duplicate.releaseYear}) is already in your catalog! You cannot upload the same movie twice.`
      );
      return;
    }

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
        `Successfully ${editingId ? 'updated' : 'published'} "${draftItem.title}" in Cloud Firestore!`
      );
      resetForm();
    } catch (error) {
      console.error('Failed to save media item to Firestore:', error);
      setStatusMessage(
        `Failed to save "${draftItem.title}": ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const [isClearingAll, setIsClearingAll] = useState<boolean>(false);
  const [confirmingClearAll, setConfirmingClearAll] = useState<boolean>(false);

  const handleClearEntireCatalog = async () => {
    if (!currentUser || !isAdmin) return;
    setIsClearingAll(true);
    setConfirmingClearAll(false);
    try {
      const snap = await getDocs(collection(db, 'catalog'));
      const batchPromises = snap.docs.map((docSnap) =>
        deleteDoc(doc(db, 'catalog', docSnap.id)).catch(() => {})
      );
      await Promise.all(batchPromises);
      setStatusMessage(
        `Successfully removed all ${snap.size} movies and TV shows from the catalog.`
      );
      resetForm();
    } catch (error) {
      console.error('Failed to clear entire catalog:', error);
      setStatusMessage(
        `Failed to clear catalog: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      setIsClearingAll(false);
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
      console.error('Failed to delete media item from Firestore:', error);
      setStatusMessage(
        `Failed to delete "${itemTitle}": ${
          error instanceof Error ? error.message : String(error)
        }`
      );
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
          data-admin-studio="true"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-5 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-studio-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="w-full max-w-6xl rounded-3xl bg-[#0F1117] border border-[#292C35] shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]"
          >
            {/* Tier 1: Modal Identity & Global Utility Actions */}
            <div className="px-4 py-3.5 sm:px-6 sm:py-4 border-b border-[#292C35] bg-[#14161D] flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                  <div className="h-9 sm:h-10 flex items-center justify-center shrink-0">
                    <img
                      src={LOGO_ASSET_URL}
                      alt="ZappyFun Logo"
                      className="h-9 sm:h-10 w-auto max-w-[136px] object-contain select-none pointer-events-none"
                    />
                  </div>
                  <div className="min-w-0 border-l border-[#292C35] pl-3 sm:pl-4">
                    <h2
                      id="admin-studio-title"
                      className="text-sm sm:text-lg font-bold text-white font-display truncate"
                    >
                      Admin Studio — Catalog &amp; Support Center
                    </h2>
                    <p className="text-[11px] sm:text-xs text-[#A7A9B4] truncate">
                      {isAdmin
                        ? `Admin: ${currentUser?.email} · DB: ${ACTIVE_FIREBASE_PROJECT_ID}`
                        : `Restricted to ${ADMIN_EMAIL}`}
                    </p>
                  </div>
                </div>

                {/* Global Utility Toolbar + Close Button */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {isAdmin && onLaunchVisualEditor && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onLaunchVisualEditor();
                      }}
                      className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#08090D] hover:bg-[#252832] border border-[#292C35] text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#FFC400] shrink-0" />
                      <span>Live UI Editor</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(
                        ZAPPYFUN_FIRESTORE_RULES_SNIPPET
                      );
                      setRulesCopied(true);
                      setShowRulesDrawer((prev) => !prev);
                      setStatusMessage(
                        'Copied updated Firestore Security Rules to clipboard! Paste them into Firebase Console -> Firestore Database -> Rules.'
                      );
                      setTimeout(() => setRulesCopied(false), 3000);
                    }}
                    className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#252832] hover:bg-[#292C35] border border-[#FFC400]/40 text-xs font-bold text-[#FFC400] flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {rulesCopied
                        ? 'Rules Copied!'
                        : showRulesDrawer
                          ? 'Hide Security Rules'
                          : 'Security Rules'}
                    </span>
                  </button>

                  <div
                    className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#08090D] border border-[#292C35] text-xs font-bold text-white/90 flex items-center gap-1.5 whitespace-nowrap select-none"
                    title="Running exclusively on ZappyFun Firebase"
                  >
                    <Database className="w-3.5 h-3.5 text-[#22C55E] shrink-0" />
                    <span>DB: zappyfun</span>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="h-9 w-9 rounded-xl bg-[#08090D] hover:bg-[#252832] border border-[#292C35] text-[#A7A9B4] hover:text-white flex items-center justify-center cursor-pointer shrink-0 transition-colors"
                    aria-label="Close Admin Studio"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Tier 2: Dedicated Navigation Tab Bar */}
              {isAdmin && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-[#292C35]/80">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveAdminTab('catalog')}
                      className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                        activeAdminTab === 'catalog'
                          ? 'bg-[#FFC400] text-[#08090D] shadow-sm'
                          : 'bg-[#08090D] border border-[#292C35] text-[#A7A9B4] hover:text-white'
                      }`}
                    >
                      <Film className="w-3.5 h-3.5 shrink-0" />
                      <span>Catalog Management ({catalog.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveAdminTab('support')}
                      className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                        activeAdminTab === 'support'
                          ? 'bg-[#FFC400] text-[#08090D] shadow-sm'
                          : 'bg-[#08090D] border border-[#292C35] text-[#A7A9B4] hover:text-white'
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                      <span>Support Inbox ({supportMessages.length})</span>
                      {openSupportCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-md bg-[#08090D] text-[#FFC400] text-[10px] font-extrabold">
                          {openSupportCount}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveAdminTab('legal')}
                      className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                        activeAdminTab === 'legal'
                          ? 'bg-[#FFC400] text-[#08090D] shadow-sm'
                          : 'bg-[#08090D] border border-[#292C35] text-[#A7A9B4] hover:text-white'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5 shrink-0" />
                      <span>Legal &amp; Policies</span>
                    </button>
                  </div>

                  <span className="text-[11px] text-[#747784] font-mono-tabular hidden sm:inline">
                    Active Cloud DB: {ACTIVE_FIREBASE_PROJECT_ID}
                  </span>
                </div>
              )}
            </div>

            {/* Expandable Firestore Security Rules Drawer */}
            {showRulesDrawer && (
              <div className="mx-4 sm:mx-6 mt-4 rounded-2xl bg-[#14161D] border border-[#FFC400]/50 p-4 space-y-2.5 shrink-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-[#D4D6DF]">
                    <span className="font-bold text-[#FFC400]">
                      Updated Firestore Security Rules ({ACTIVE_FIREBASE_PROJECT_ID})
                    </span>{' '}
                    — Paste into{' '}
                    <strong className="text-white">
                      Firebase Console → Firestore Database → Rules
                    </strong>{' '}
                    and click <strong className="text-white">Publish</strong>.
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(
                          ZAPPYFUN_FIRESTORE_RULES_SNIPPET
                        );
                        setRulesCopied(true);
                        setTimeout(() => setRulesCopied(false), 3000);
                      }}
                      className="px-3 py-1 rounded-lg bg-[#FFC400] hover:bg-[#FFD54A] text-[#08090D] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{rulesCopied ? 'Copied!' : 'Copy Code'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRulesDrawer(false)}
                      className="px-2.5 py-1 rounded-lg bg-[#08090D] border border-[#292C35] text-xs text-[#A7A9B4] hover:text-white cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
                <pre className="p-3 rounded-xl bg-[#08090D] border border-[#292C35] text-[11px] text-[#D4D6DF] font-mono overflow-x-auto max-h-48 select-all">
                  {ZAPPYFUN_FIRESTORE_RULES_SNIPPET}
                </pre>
              </div>
            )}

            {/* Status / Error Banner */}
            {(statusMessage || errorMessage) && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mx-4 sm:mx-6 mt-4 px-4 py-3 rounded-xl border text-xs flex items-center justify-between gap-3 shrink-0 ${
                  errorMessage
                    ? 'bg-red-500/10 border-red-500/30 text-red-200'
                    : 'bg-[#FFC400]/10 border-[#FFC400]/40 text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  {errorMessage ? (
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-[#FFC400]" />
                  )}
                  <span>{errorMessage || statusMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setStatusMessage(null);
                  }}
                  className="text-[#A7A9B4] hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
              {!isAdmin ? (
                <div className="rounded-3xl bg-[#14161D] border border-[#292C35] p-8 sm:p-10 text-center max-w-xl mx-auto my-6 space-y-5">
                  <div className="w-16 h-16 rounded-2xl bg-[#FFC400]/15 border border-[#FFC400]/40 flex items-center justify-center mx-auto text-[#FFC400]">
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white font-display">
                    Admin Panel Access Restricted
                  </h3>
                  <p className="text-xs sm:text-sm text-[#A7A9B4] leading-relaxed">
                    Only <strong className="text-[#FFC400]">{ADMIN_EMAIL}</strong> has permission to manage the catalog and read user support messages.
                  </p>
                  {currentUser && (
                    <p className="text-xs text-[#FFC400] font-mono-tabular">
                      Currently signed in as: {currentUser.email}
                    </p>
                  )}
                  <form
                    onSubmit={handleAdminEmailSignIn}
                    className="max-w-md mx-auto space-y-3.5 text-left pt-2"
                  >
                    <div>
                      <label className="block text-xs font-bold text-[#A7A9B4] uppercase tracking-wider mb-1">
                        Admin Email
                      </label>
                      <input
                        type="email"
                        value={adminEmailInput}
                        onChange={(e) => setAdminEmailInput(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090D] border border-[#292C35] text-xs text-white placeholder-[#5A5E70] focus:outline-none focus:border-[#FFC400]"
                        placeholder={ADMIN_EMAIL}
                        required
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-[#A7A9B4] uppercase tracking-wider">
                          Password
                        </label>
                        <button
                          type="button"
                          onClick={handleAdminPasswordReset}
                          className="text-xs text-[#FFC400] hover:underline"
                        >
                          Reset password?
                        </button>
                      </div>
                      <input
                        type="password"
                        value={adminPasswordInput}
                        onChange={(e) => setAdminPasswordInput(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090D] border border-[#292C35] text-xs text-white placeholder-[#5A5E70] focus:outline-none focus:border-[#FFC400]"
                        placeholder="••••••••"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isAdminLoggingIn}
                      className="w-full py-3 rounded-xl bg-[#FFC400] text-[#08090D] font-bold text-xs hover:bg-[#FFD54A] flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#FFC400]/20 disabled:opacity-50 transition-all"
                    >
                      {isAdminLoggingIn ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Signing In...</span>
                        </>
                      ) : (
                        <>
                          <LogIn className="w-3.5 h-3.5" />
                          <span>Sign in as Admin ({ADMIN_EMAIL})</span>
                        </>
                      )}
                    </button>

                    <div className="relative my-3">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-[#292C35]" />
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="px-3 bg-[#14161D] text-[#7E8292] uppercase font-bold tracking-wider text-[10px]">
                          Or authenticate with
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAdminGithubSignIn}
                      disabled={isAdminLoggingIn || isAdminGithubLoading}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#08090D] hover:bg-[#1A1D27] border border-[#292C35] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isAdminGithubLoading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                          <span>Connecting to GitHub...</span>
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-3.5 h-3.5 fill-current text-white shrink-0"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              fillRule="evenodd"
                              clipRule="evenodd"
                              d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                            />
                          </svg>
                          <span>Continue with GitHub ({ADMIN_EMAIL})</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              ) : activeAdminTab === 'legal' ? (
                /* =========================================================
                    LEGAL & POLICIES EDITOR TAB
                ========================================================= */
                <form
                  onSubmit={handleSaveLegalToFirestore}
                  className="space-y-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#292C35] pb-4">
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-white font-display flex items-center gap-2">
                        <FileText className="w-5 h-5 text-[#FFC400]" />
                        <span>Legal Documents &amp; Official Contact Editor</span>
                      </h3>
                      <p className="text-xs text-[#A7A9B4] mt-1">
                        Edit Terms of Use, Privacy Policy, Cookie Policy, Disclaimer, and About pages.
                      </p>
                    </div>
                    <button
                      type="submit"
                      disabled={isSavingLegal}
                      className="min-h-[38px] px-4 py-2 rounded-xl bg-[#FFC400] hover:bg-[#FFD54A] text-[#08090D] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-[#FFC400]/20 disabled:opacity-60"
                    >
                      {isSavingLegal ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>Save All Legal Pages</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {(
                      [
                        { id: 'terms', label: 'Terms of Use' },
                        { id: 'privacy', label: 'Privacy Policy' },
                        { id: 'about', label: 'About' },
                        { id: 'disclaimer', label: 'Disclaimer & Copyright' },
                        { id: 'advertising', label: 'Cookie Policy' },
                      ] as const
                    ).map((sec) => (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => setActiveLegalSection(sec.id)}
                        className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                          activeLegalSection === sec.id
                            ? 'bg-[#FFC400] text-[#08090D]'
                            : 'bg-[#14161D] border border-[#292C35] text-[#A7A9B4] hover:text-white'
                        }`}
                      >
                        {sec.label}
                      </button>
                    ))}
                  </div>

                  <div className="rounded-2xl bg-[#14161D] border border-[#292C35] p-4 sm:p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#A7A9B4] mb-1">
                          Section Title
                        </label>
                        <input
                          type="text"
                          value={
                            legalDraft[activeLegalSection]?.title ||
                            DEFAULT_LEGAL_PAGES[activeLegalSection].title
                          }
                          onChange={(e) =>
                            updateLegalSectionField(
                              activeLegalSection,
                              'title',
                              e.target.value
                            )
                          }
                          className="w-full h-10 px-3 rounded-xl bg-[#08090D] border border-[#292C35] text-xs sm:text-sm text-white font-bold focus:outline-none focus:border-[#FFC400]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#A7A9B4] mb-1">
                          Subtitle / Effective Date
                        </label>
                        <input
                          type="text"
                          value={
                            legalDraft[activeLegalSection]?.subtitle ||
                            DEFAULT_LEGAL_PAGES[activeLegalSection].subtitle
                          }
                          onChange={(e) =>
                            updateLegalSectionField(
                              activeLegalSection,
                              'subtitle',
                              e.target.value
                            )
                          }
                          className="w-full h-10 px-3 rounded-xl bg-[#08090D] border border-[#292C35] text-xs sm:text-sm text-[#FFC400] focus:outline-none focus:border-[#FFC400]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#A7A9B4] mb-1">
                          Official Contact Email
                        </label>
                        <input
                          type="email"
                          value={legalDraft.contactEmail || OFFICIAL_CONTACT_EMAIL}
                          onChange={(e) =>
                            setLegalDraft((prev) => ({
                              ...prev,
                              contactEmail: e.target.value,
                            }))
                          }
                          className="w-full h-10 px-3 rounded-xl bg-[#08090D] border border-[#292C35] text-xs sm:text-sm text-white focus:outline-none focus:border-[#FFC400]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#A7A9B4] mb-1">
                        Document Body
                      </label>
                      <textarea
                        rows={12}
                        value={
                          legalDraft[activeLegalSection]?.body ||
                          DEFAULT_LEGAL_PAGES[activeLegalSection].body
                        }
                        onChange={(e) =>
                          updateLegalSectionField(
                            activeLegalSection,
                            'body',
                            e.target.value
                          )
                        }
                        className="w-full p-3.5 rounded-xl bg-[#08090D] border border-[#292C35] text-xs sm:text-sm text-white leading-relaxed focus:outline-none focus:border-[#FFC400]"
                      />
                    </div>
                  </div>
                </form>
              ) : activeAdminTab === 'support' ? (
                /* =========================================================
                    USER SUPPORT MESSAGES INBOX TAB
                ========================================================= */
                <div className="space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#292C35] pb-4">
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-white font-display flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-[#FFC400]" />
                        <span>
                          User Support Messages ({supportMessages.length})
                        </span>
                      </h3>
                      <p className="text-xs text-[#A7A9B4] mt-1">
                        Every message sent by users on the Support page appears here in real time.
                      </p>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-[#A7A9B4] font-mono-tabular">
                      <span>Open: {openSupportCount}</span>
                      <span>·</span>
                      <span>
                        Resolved: {supportMessages.length - openSupportCount}
                      </span>
                    </div>
                  </div>

                  {supportMessages.length === 0 ? (
                    <div className="rounded-2xl bg-[#14161D] border border-[#292C35] p-10 text-center space-y-3">
                      <MessageSquare className="w-10 h-10 text-[#747784] mx-auto" />
                      <p className="text-sm font-bold text-white">
                        No Support Messages Yet
                      </p>
                      <p className="text-xs text-[#A7A9B4] max-w-md mx-auto">
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
                                ? 'bg-[#08090D] border-[#292C35] opacity-80'
                                : 'bg-[#14161D] border-[#FFC400]/50'
                            }`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`text-xs font-bold uppercase tracking-wider ${
                                      isResolved
                                        ? 'text-emerald-400'
                                        : 'text-[#FFC400]'
                                    }`}
                                  >
                                    {isResolved ? 'Resolved' : 'New / Open'}
                                  </span>
                                  <span className="text-[#747784]">·</span>
                                  <h4 className="text-sm sm:text-base font-bold text-white">
                                    {msg.firstName} {msg.lastName}
                                  </h4>
                                </div>

                                <div className="flex flex-wrap items-center gap-4 text-xs text-[#A7A9B4] pt-0.5">
                                  <span className="inline-flex items-center gap-1.5">
                                    <Mail className="w-3.5 h-3.5 text-[#FFC400]" />
                                    <a
                                      href={`mailto:${msg.email}`}
                                      className="hover:underline text-white"
                                    >
                                      {msg.email}
                                    </a>
                                  </span>
                                  {msg.phone && (
                                    <span className="inline-flex items-center gap-1.5">
                                      <Phone className="w-3.5 h-3.5 text-[#747784]" />
                                      <span>{msg.phone}</span>
                                    </span>
                                  )}
                                  <span className="inline-flex items-center gap-1.5 text-[#747784]">
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
                                        ? 'bg-[#252832] hover:bg-[#292C35] text-white'
                                        : 'bg-[#FFC400] hover:bg-[#FFD54A] text-[#08090D]'
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

                            <div className="p-3.5 rounded-xl bg-[#08090D] border border-[#292C35] text-xs sm:text-sm text-white whitespace-pre-wrap leading-relaxed">
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

                  {/* HERO BANNER 8-MOVIE DAILY CYCLE (24h Batch Rotation / 28h Movie Tenure) */}
                  {heroBatchInfo && (
                    <div className="rounded-2xl bg-[#14161D] border border-[#292C35] p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Clock className="w-4 h-4 text-[#FFC400]" />
                          <h3 className="text-xs sm:text-sm font-bold text-white font-display">
                            Hero Banner 8-Movie Daily Cycle — Batch #{heroBatchInfo.activeBatchNumber} of {heroBatchInfo.totalBatches} ({heroBatchInfo.currentHeroMovies.length} Movies Active)
                          </h3>
                        </div>
                        <p className="text-xs text-[#A7A9B4]">
                          Shows 8 movies for 24 hours (with a 28-hour spotlight tenure window per movie), then automatically rotates to the next 8 movies (Next rotation in ~{heroBatchInfo.hoursUntilNextBatch}h).
                        </p>
                        {heroBatchInfo.currentHeroMovies.length > 0 && (
                          <p className="text-[11px] text-[#FFC400] truncate max-w-3xl">
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
                            className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#08090D] hover:bg-[#252832] border border-[#292C35] text-xs font-semibold text-white cursor-pointer"
                          >
                            Restart 24h Cycle Now
                          </button>
                        )}
                        {onAdvanceHeroBatch && (
                          <button
                            type="button"
                            onClick={() => onAdvanceHeroBatch()}
                            className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-[#FFC400] hover:bg-[#FFD54A] text-[#08090D] text-xs font-bold cursor-pointer"
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
                  <div className="rounded-2xl bg-[#14161D] border border-[#FFC400]/45 p-4 sm:p-6 space-y-4 shadow-xl">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-[#FFC400]" />
                          <h3 className="text-sm sm:text-base font-bold text-white font-display">
                            Multi-Link JustWatch Batch Importer (Up to 100 Comma-Separated Links at Once)
                          </h3>
                        </div>
                        <p className="text-xs text-[#A7A9B4]">
                          Paste up to 100 JustWatch movie or TV show links separated by commas (<code className="text-[#FFC400]">,</code>) or new lines to extract and publish them all in one go.
                        </p>
                      </div>

                      <div className="flex items-center gap-3 text-xs font-mono-tabular">
                        <span className="text-[#FFC400] font-bold">
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
                            className="text-[#A7A9B4] hover:text-white underline cursor-pointer"
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
                      className="w-full p-3.5 rounded-xl bg-[#08090D] border border-[#292C35] text-xs sm:text-sm text-white placeholder:text-[#747784] focus:outline-none focus:border-[#FFC400] font-mono-tabular leading-relaxed"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-[11px] text-[#747784]">
                        Automatically extracts Title, Year, Synopsis, Poster, Backdrop, Cast Photos, Verified Stream &amp; Seasons/Episodes for every link.
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
                              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#08090D] hover:bg-[#252832] border border-[#292C35] text-xs font-bold text-white flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                            >
                              <Eye className="w-4 h-4 text-[#FFC400]" />
                              <span>
                                Extract All ({parsedMultiLinks.length}) for Preview
                              </span>
                            </button>

                            <button
                              type="button"
                              disabled={parsedMultiLinks.length === 0}
                              onClick={() => handleRunMultiLinkBatch(true)}
                              className="min-h-[42px] px-5 py-2 rounded-xl bg-[#FFC400] hover:bg-[#FFD54A] text-[#08090D] text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-[#FFC400]/20 transition-colors disabled:opacity-50"
                            >
                              <Sparkles className="w-4 h-4" />
                              <span>
                                Extract &amp; Publish All ({parsedMultiLinks.length}) to App
                              </span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Batch Progress & Per-Link Results Queue */}
                    {batchResults.length > 0 && (
                      <div className="pt-3 border-t border-[#292C35] space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            {isBatchRunning && (
                              <Loader2 className="w-4 h-4 animate-spin text-[#FFC400]" />
                            )}
                            <span className="font-bold text-white">
                              Batch Progress: {batchCompletedCount} / {batchTotalCount} processed
                            </span>
                          </div>

                          {extractedReadyCount > 0 && !isBatchRunning && (
                            <button
                              type="button"
                              onClick={handlePublishAllExtractedBatch}
                              className="min-h-[34px] px-4 py-1.5 rounded-xl bg-[#FFC400] hover:bg-[#FFD54A] text-[#08090D] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>
                                Publish All Extracted ({extractedReadyCount})
                              </span>
                            </button>
                          )}
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-2 rounded-full bg-[#08090D] overflow-hidden border border-[#292C35]">
                          <div
                            className="h-full bg-[#FFC400] transition-all duration-300"
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
                                className="rounded-xl bg-[#08090D] border border-[#292C35] p-2.5 flex items-center justify-between gap-2.5"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {draft?.posterUrl ? (
                                    <img
                                      src={draft.posterUrl}
                                      alt={draft.title}
                                      referrerPolicy="no-referrer"
                                      className="w-10 h-14 rounded-lg object-cover border border-[#292C35] shrink-0 bg-black"
                                    />
                                  ) : (
                                    <div className="w-10 h-14 rounded-lg bg-[#14161D] border border-[#292C35] flex items-center justify-center text-[10px] font-mono-tabular text-[#747784] shrink-0">
                                      #{entry.index + 1}
                                    </div>
                                  )}

                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-white truncate">
                                      {draft
                                        ? `${draft.title} (${draft.releaseYear})`
                                        : entry.rawInput}
                                    </p>
                                    <p className="text-[11px] text-[#A7A9B4] truncate font-mono-tabular">
                                      {entry.status === 'published' && (
                                        <span className="text-emerald-400 font-bold">
                                          Published to App ✓
                                        </span>
                                      )}
                                      {entry.status === 'extracted' && (
                                        <span className="text-[#FFC400] font-bold">
                                          Extracted · Ready to Preview/Publish
                                        </span>
                                      )}
                                      {entry.status === 'extracting' && (
                                        <span className="text-[#FFD54A]">
                                          Extracting metadata &amp; stream...
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
                                      className="px-2 py-1 rounded-lg bg-[#252832] hover:bg-[#FFC400] text-white hover:text-[#08090D] text-[10px] font-bold cursor-pointer transition-colors"
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
                  <div className="rounded-2xl bg-[#14161D] border border-[#292C35] p-4 sm:p-6 space-y-4 shadow-xl">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-[#FFC400]" />
                          <h3 className="text-sm sm:text-base font-bold text-white font-display">
                            Direct JustWatch Catalog — Search, Preview &amp; Publish in 1 Click
                          </h3>
                        </div>
                        <p className="text-xs text-[#A7A9B4]">
                          Browse trending Movies &amp; TV Shows on JustWatch or search any title directly below to preview or publish immediately.
                        </p>
                      </div>

                      {/* Country Filter & Movies Badge */}
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#08090D] border border-[#292C35] text-xs font-bold text-[#FFC400]">
                          <Film className="w-3.5 h-3.5" />
                          <span>Movies Only (4K UHD)</span>
                        </div>

                        <select
                          value={jwCountry}
                          onChange={(e) =>
                            setJwCountry(e.target.value as 'IN' | 'US' | 'GB')
                          }
                          aria-label="JustWatch Region"
                          className="h-8 px-2.5 rounded-xl bg-[#08090D] border border-[#292C35] text-xs font-semibold text-white cursor-pointer"
                        >
                          <option value="IN">India (IN)</option>
                          <option value="US">Global (US)</option>
                          <option value="GB">UK (GB)</option>
                        </select>
                      </div>
                    </div>

                    {/* Live JustWatch Search Bar */}
                    <div className="relative">
                      <Search className="w-4 h-4 text-[#747784] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={jwSearchQuery}
                        onChange={(e) => setJwSearchQuery(e.target.value)}
                        placeholder="Search any Movie directly on JustWatch (e.g. Interstellar, Dune, Inception, Avengers, Oppenheimer)..."
                        className="w-full min-h-[44px] pl-10 pr-24 rounded-xl bg-[#08090D] border border-[#292C35] text-xs sm:text-sm text-white placeholder:text-[#747784] focus:outline-none focus:border-[#FFC400]"
                      />
                      {jwSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setJwSearchQuery('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#A7A9B4] hover:text-white cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    {/* JustWatch Results Grid */}
                    {isLoadingJwBrowse ? (
                      <div className="py-10 flex flex-col items-center justify-center gap-2 text-[#A7A9B4]">
                        <Loader2 className="w-6 h-6 animate-spin text-[#FFC400]" />
                        <span className="text-xs font-medium">
                          Fetching live movies from JustWatch...
                        </span>
                      </div>
                    ) : jwResults.length === 0 ? (
                      <div className="py-8 text-center text-xs text-[#747784]">
                        No JustWatch movies matched &ldquo;{jwSearchQuery}&rdquo;. Try another search term.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-h-[380px] overflow-y-auto pr-1">
                        {jwResults.map((card) => {
                          const cardKey = `movie-${card.title}-${card.releaseYear}`;
                          const isPublishingThis =
                            publishingCardKey === cardKey;
                          const duplicateMovie = findDuplicateMovie(
                            {
                              title: card.title,
                              tmdbId: card.tmdbId,
                              justWatchUrl: card.justWatchUrl,
                            },
                            catalog
                          );
                          const isDuplicate = Boolean(duplicateMovie);

                          return (
                            <div
                              key={cardKey}
                              className="rounded-xl bg-[#08090D] border border-[#292C35] hover:border-[#FFC400]/60 p-2.5 flex flex-col justify-between gap-2.5 transition-colors"
                            >
                              <div className="flex gap-2.5 min-w-0">
                                <img
                                  src={card.posterUrl || card.backdropUrl}
                                  alt={card.title}
                                  referrerPolicy="no-referrer"
                                  className="w-14 h-20 rounded-lg object-cover border border-[#292C35] shrink-0 bg-black"
                                />
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-mono-tabular">
                                    <span className="font-extrabold uppercase text-[#FFC400]">
                                      MOVIE
                                    </span>
                                    <span className="text-[#747784]">·</span>
                                    <span className="text-[#A7A9B4]">
                                      {card.releaseYear}
                                    </span>
                                    {card.imdbScore && (
                                      <>
                                        <span className="text-[#747784]">·</span>
                                        <span className="text-[#FFC400] font-bold">
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

                                  <p className="text-[10px] text-[#747784] truncate">
                                    {card.genres.slice(0, 3).join(' · ')}
                                  </p>
                                </div>
                              </div>

                              <div className="space-y-1.5 pt-2 border-t border-[#292C35]">
                                <div className="grid grid-cols-2 gap-1.5">
                                  <button
                                    type="button"
                                    disabled={isExtractingJw}
                                    onClick={() =>
                                      handleExtractFromJustWatch(
                                        card.justWatchUrl,
                                        card.title,
                                        'movie',
                                        false
                                      )
                                    }
                                    className="min-h-[32px] px-2.5 py-1 rounded-lg bg-[#14161D] hover:bg-[#252832] border border-[#292C35] text-[11px] font-bold text-white flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                                    title="Load full details & cast photos into editor"
                                  >
                                    <Edit3 className="w-3 h-3 shrink-0" />
                                    <span>Select</span>
                                  </button>

                                  <button
                                    type="button"
                                    disabled={isExtractingJw}
                                    onClick={() =>
                                      handleExtractFromJustWatch(
                                        card.justWatchUrl,
                                        card.title,
                                        'movie',
                                        true
                                      )
                                    }
                                    className="min-h-[32px] px-2.5 py-1 rounded-lg bg-[#14161D] hover:bg-[#252832] border border-[#292C35] text-[11px] font-bold text-[#FFC400] flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                                    title="Preview movie player before publishing"
                                  >
                                    <Eye className="w-3 h-3 shrink-0" />
                                    <span>Preview</span>
                                  </button>
                                </div>

                                <button
                                  type="button"
                                  disabled={isPublishingThis || isDuplicate}
                                  onClick={() => {
                                    if (isDuplicate) return;
                                    handleDirectPublishFromJustWatchCard(card);
                                  }}
                                  className={`w-full min-h-[34px] px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                                    isDuplicate
                                      ? 'bg-[#14161D] border border-emerald-500/40 text-emerald-400 cursor-not-allowed opacity-90'
                                      : 'bg-[#FFC400] hover:bg-[#FFD54A] text-[#08090D] cursor-pointer'
                                  }`}
                                  title={
                                    isDuplicate
                                      ? `Already in your catalog ("${duplicateMovie?.title}") — duplicate uploads are blocked`
                                      : 'Directly extract and publish movie to app'
                                  }
                                >
                                  {isPublishingThis ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                                      <span>Publishing...</span>
                                    </>
                                  ) : isDuplicate ? (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                      <span>Already in Catalog</span>
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="w-3.5 h-3.5 shrink-0" />
                                      <span>1-Click Publish Movie</span>
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
                  <div className="rounded-2xl bg-[#14161D] border border-[#292C35] p-4 sm:p-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Wand2 className="w-4 h-4 text-[#FFC400]" />
                        <h3 className="text-sm sm:text-base font-bold text-white font-display">
                          Or Paste a Single JustWatch URL to Edit Before Publishing
                        </h3>
                      </div>
                      <span className="text-[11px] text-[#A7A9B4] font-mono-tabular">
                        Title · Year · Cast &amp; Director Photos · Verified Episodes
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
                        className="flex-1 min-h-[44px] px-4 rounded-xl bg-[#08090D] border border-[#292C35] text-xs sm:text-sm text-white placeholder:text-[#747784] focus:outline-none focus:border-[#FFC400] font-mono-tabular"
                      />
                      <button
                        type="button"
                        disabled={isExtractingJw}
                        onClick={() => handleExtractFromJustWatch()}
                        className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#FFC400] text-[#08090D] font-bold text-xs sm:text-sm hover:bg-[#FFD54A] transition-colors flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-60"
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
                      className="rounded-2xl bg-[#08090D] border-2 border-[#FFC400] p-4 sm:p-6 space-y-5 shadow-2xl"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#292C35] pb-4">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-extrabold uppercase text-[#FFC400]">
                            Live Pre-Publish Preview
                          </span>
                          <span className="text-[#747784]">·</span>
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
                              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#14161D] hover:bg-[#252832] border border-[#292C35] text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-[#FFC400]" />
                              <span>Open Full-Page App Preview</span>
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleSaveToFirestore()}
                            className="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#FFC400] hover:bg-[#FFD54A] text-[#08090D] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-[#FFC400]/20"
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
                            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#14161D] hover:bg-[#252832] border border-[#292C35] text-xs text-[#A7A9B4] cursor-pointer"
                          >
                            Close Preview
                          </button>
                        </div>
                      </div>

                      {/* Live Video Player Stream Test (4K UHD Movie) */}
                      <VideoPlayer
                        item={currentDraftPreviewItem}
                      />

                      {/* Banner & Metadata Card Preview */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 rounded-xl bg-[#14161D] border border-[#292C35] items-center">
                        <div className="md:col-span-5 aspect-video rounded-xl overflow-hidden border border-[#292C35] bg-black relative">
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
                          <div className="flex flex-wrap items-center gap-2 text-xs text-[#A7A9B4]">
                            <span className="text-[#FFC400] font-bold uppercase">
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
                          <p className="text-xs text-[#A7A9B4] line-clamp-3 leading-relaxed">
                            {currentDraftPreviewItem.synopsis}
                          </p>
                          <p className="text-[11px] text-[#747784]">
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

                  {/* STEP 2: Vidly.pro Stream + Movie/Show Form */}
                  <form
                    ref={formRef}
                    onSubmit={handleSaveToFirestore}
                    className="rounded-2xl bg-[#14161D] border border-[#292C35] p-4 sm:p-5 space-y-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#292C35] pb-3">
                      <h3 className="text-sm sm:text-base font-bold text-white font-display flex items-center gap-2">
                        <Plus className="w-4 h-4 text-[#FFC400]" />
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
                            className="px-3 py-1.5 rounded-lg bg-[#08090D] hover:bg-[#252832] border border-[#FFC400]/50 text-xs font-bold text-[#FFC400] flex items-center gap-1.5 cursor-pointer"
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
                            className="text-xs text-[#A7A9B4] hover:text-white underline cursor-pointer"
                          >
                            Cancel Edit &amp; Create New
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Stream Endpoint Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 p-3.5 rounded-xl bg-[#08090D] border border-[#292C35]">
                      <div className="sm:col-span-3">
                        <label className="block text-xs text-[#A7A9B4] mb-1">
                          Media Type
                        </label>
                        <div className="w-full min-h-[42px] px-3 rounded-xl bg-[#14161D] border border-[#292C35] text-xs text-white font-semibold flex items-center gap-2">
                          <Film className="w-3.5 h-3.5 text-[#FFC400]" />
                          <span>Movie (4K UHD)</span>
                        </div>
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-xs text-[#A7A9B4] mb-1">
                          Catalog Code (Auto-extracted)
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={tmdbIdInput}
                          onChange={(e) => setTmdbIdInput(e.target.value)}
                          placeholder="Auto-filled"
                          className="w-full min-h-[42px] px-3 rounded-xl bg-[#14161D] border border-[#292C35] text-xs text-white font-mono-tabular"
                        />
                      </div>

                      <div className="sm:col-span-6">
                        <label className="block text-xs text-[#A7A9B4] mb-1">
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
                          className="w-full min-h-[42px] px-3 rounded-xl bg-[#14161D] border border-[#FFC400]/40 text-xs text-[#FFC400] font-mono-tabular"
                        />
                      </div>
                    </div>

                    {/* Title, Year, Duration, Rating */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                      <div className="sm:col-span-2">
                        <label className="block text-xs text-[#A7A9B4] mb-1">
                          Title
                        </label>
                        <input
                          type="text"
                          required
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="e.g. Interstellar"
                          className="w-full min-h-[40px] px-3 rounded-xl bg-[#08090D] border border-[#292C35] text-xs text-white focus:outline-none focus:border-[#FFC400]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-[#A7A9B4] mb-1">
                          Release Year
                        </label>
                        <input
                          type="number"
                          min={1900}
                          max={2100}
                          value={releaseYear}
                          onChange={(e) => setReleaseYear(e.target.value)}
                          className="w-full min-h-[40px] px-3 rounded-xl bg-[#08090D] border border-[#292C35] text-xs text-white font-mono-tabular focus:outline-none focus:border-[#FFC400]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-[#A7A9B4] mb-1">
                          Runtime (Minutes)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={1000}
                          value={durationMinutes}
                          onChange={(e) => setDurationMinutes(e.target.value)}
                          className="w-full min-h-[40px] px-3 rounded-xl bg-[#08090D] border border-[#292C35] text-xs text-white font-mono-tabular focus:outline-none focus:border-[#FFC400]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-[#A7A9B4] mb-1">
                          Director / Creator
                        </label>
                        <input
                          type="text"
                          value={directorOrCreator}
                          onChange={(e) => setDirectorOrCreator(e.target.value)}
                          className="w-full min-h-[40px] px-3 rounded-xl bg-[#08090D] border border-[#292C35] text-xs text-white focus:outline-none focus:border-[#FFC400]"
                        />
                      </div>

                      <div className="sm:col-span-2 lg:col-span-3">
                        <label className="block text-xs text-[#A7A9B4] mb-1">
                          Cast Names (Comma-separated, auto-extracted from JustWatch)
                        </label>
                        <input
                          type="text"
                          value={castInput}
                          onChange={(e) => setCastInput(e.target.value)}
                          className="w-full min-h-[40px] px-3 rounded-xl bg-[#08090D] border border-[#292C35] text-xs text-white focus:outline-none focus:border-[#FFC400]"
                        />
                      </div>
                    </div>

                    {/* Extracted Director & Cast Portrait Gallery */}
                    {credits.length > 0 && (
                      <div className="p-4 rounded-2xl bg-[#08090D] border border-[#292C35] space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                            <Users className="w-4 h-4 text-[#FFC400]" />
                            <span>
                              Extracted Cast &amp; Director Profiles with Photos ({credits.length})
                            </span>
                          </h4>
                          <span className="text-[11px] text-[#FFC400] font-mono-tabular">
                            Saved to Cloud Firestore
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2.5">
                          {credits.map((person, idx) => (
                            <div
                              key={`${person.name}-${idx}`}
                              className="rounded-xl bg-[#14161D] border border-[#292C35] p-2 flex items-center gap-2.5 min-w-0"
                            >
                              <img
                                src={person.imageUrl}
                                alt={person.name}
                                referrerPolicy="no-referrer"
                                className="w-10 h-12 rounded-lg object-cover border border-[#292C35] shrink-0 bg-[#08090D]"
                              />
                              <div className="min-w-0 flex-1">
                                <span className="block text-[9px] font-bold uppercase tracking-wider font-mono-tabular text-[#FFC400]">
                                  {person.role}
                                </span>
                                <p className="text-xs font-bold text-white truncate">
                                  {person.name}
                                </p>
                                {person.characterName && (
                                  <p className="text-[10px] text-[#747784] truncate">
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
                      <label className="block text-xs text-[#A7A9B4] mb-1">
                        Synopsis / Description
                      </label>
                      <textarea
                        rows={2}
                        value={synopsis}
                        onChange={(e) => setSynopsis(e.target.value)}
                        placeholder="Plot overview (auto-filled when you select or extract from JustWatch)..."
                        className="w-full p-3 rounded-xl bg-[#08090D] border border-[#292C35] text-xs text-white focus:outline-none focus:border-[#FFC400]"
                      />
                    </div>

                    {/* JustWatch Extracted Banner/Backdrop & Poster URLs + Live Visual Preview */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3.5 rounded-xl bg-[#08090D] border border-[#292C35]">
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-[#A7A9B4] flex items-center gap-1.5">
                          <ImageIcon className="w-3.5 h-3.5 text-[#FFC400]" />
                          <span>
                            Banner / Backdrop Image URL (Auto-filled from JustWatch)
                          </span>
                        </label>
                        <input
                          type="text"
                          value={backdropUrl}
                          onChange={(e) => setBackdropUrl(e.target.value)}
                          placeholder="https://images.justwatch.com/backdrop/..."
                          className="w-full min-h-[38px] px-3 rounded-xl bg-[#14161D] border border-[#292C35] text-xs text-white font-mono-tabular focus:outline-none focus:border-[#FFC400]"
                        />
                        {backdropUrl && (
                          <div className="aspect-video w-full rounded-xl overflow-hidden border border-[#292C35] bg-black">
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
                            <span className="text-[10px] text-[#747784]">
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
                                      ? 'border-[#FFC400] ring-2 ring-[#FFC400]/40'
                                      : 'border-[#292C35] opacity-70 hover:opacity-100'
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
                        <label className="block text-xs font-semibold text-[#A7A9B4] flex items-center gap-1.5">
                          <ImageIcon className="w-3.5 h-3.5 text-[#FFC400]" />
                          <span>
                            Poster Image URL (Auto-filled from JustWatch)
                          </span>
                        </label>
                        <input
                          type="text"
                          value={posterUrl}
                          onChange={(e) => setPosterUrl(e.target.value)}
                          placeholder="https://images.justwatch.com/poster/..."
                          className="w-full min-h-[38px] px-3 rounded-xl bg-[#14161D] border border-[#292C35] text-xs text-white font-mono-tabular focus:outline-none focus:border-[#FFC400]"
                        />
                        {posterUrl && (
                          <div className="h-36 w-28 rounded-xl overflow-hidden border border-[#292C35] bg-black">
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
                        <span className="block text-xs text-[#A7A9B4]">
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
                                    ? 'bg-[#FFC400] text-[#08090D] font-bold'
                                    : 'bg-[#08090D] border border-[#292C35] text-[#A7A9B4] hover:text-white'
                                }`}
                              >
                                {g}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <label className="flex items-center gap-2.5 text-xs text-white cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={featured}
                          onChange={(e) => setFeatured(e.target.checked)}
                          className="w-4 h-4 accent-[#FFC400]"
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
                        className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#08090D] hover:bg-[#252832] border border-[#292C35] text-[#FFC400] font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Preview Player &amp; Layout</span>
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
                          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#08090D] hover:bg-[#252832] border border-[#292C35] text-white font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-2"
                        >
                          <ExternalLink className="w-4 h-4 text-[#FFC400]" />
                          <span>Full-Page App Preview</span>
                        </button>
                      )}

                      <button
                        type="submit"
                        disabled={isSaving}
                        className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#FFC400] hover:bg-[#FFD54A] text-[#08090D] font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-[#FFC400]/20 disabled:opacity-60"
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
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-white font-display">
                        Published Movies &amp; TV Shows in Cloud Firestore ({catalog.length})
                      </h3>
                      {catalog.length > 0 && (
                        confirmingClearAll ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-red-300 font-semibold">
                              Confirm remove all {catalog.length} titles?
                            </span>
                            <button
                              type="button"
                              disabled={isClearingAll}
                              onClick={handleClearEntireCatalog}
                              className="min-h-[32px] px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold cursor-pointer"
                            >
                              Yes, Remove All
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingClearAll(false)}
                              className="min-h-[32px] px-3 py-1 rounded-lg bg-[#08090D] border border-[#292C35] text-xs text-[#A7A9B4] hover:text-white cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={isClearingAll}
                            onClick={() => setConfirmingClearAll(true)}
                            className="min-h-[32px] px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            {isClearingAll ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Removing All Titles...</span>
                              </>
                            ) : (
                              <>
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Remove Every Movie &amp; TV Show</span>
                              </>
                            )}
                          </button>
                        )
                      )}
                    </div>

                    {catalog.length === 0 ? (
                      <div className="rounded-2xl bg-[#14161D] border border-[#292C35] p-6 text-center text-xs text-[#747784]">
                        Your catalog is currently empty. Select any Movie or TV Show from the JustWatch browser above or paste up to 100 links to publish!
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {catalog.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-2xl bg-[#14161D] border border-[#292C35] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <img
                                src={item.backdropUrl || item.posterUrl}
                                alt={item.title}
                                referrerPolicy="no-referrer"
                                className="w-20 h-12 rounded-lg object-cover border border-[#292C35] shrink-0 bg-black"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 text-[11px] font-mono-tabular text-[#FFC400]">
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
                                <p className="text-[10px] text-[#A7A9B4] truncate font-mono-tabular">
                                  {item.genres.join(' · ')}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#292C35]/60">
                              {onSelectMediaToWatch && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    onSelectMediaToWatch(item);
                                  }}
                                  className="min-h-[34px] px-3 py-1.5 rounded-lg bg-[#FFC400] hover:bg-[#FFD54A] text-[#08090D] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                                  title="Watch Stream"
                                >
                                  <Play className="w-3 h-3 fill-current shrink-0" />
                                  <span>Play</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => populateFormFromItem(item)}
                                className="min-h-[34px] px-3 py-1.5 rounded-lg bg-[#08090D] hover:bg-[#252832] border border-[#292C35] text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                                title="Edit"
                              >
                                <Edit3 className="w-3 h-3 shrink-0" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteFromFirestore(item.id, item.title)
                                }
                                className="min-h-[34px] px-2.5 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-xs text-red-300 flex items-center justify-center cursor-pointer transition-colors shrink-0"
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
