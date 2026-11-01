import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  X,
  Tv,
  Bookmark,
  Play,
  Bell,
  Menu,
  ShieldCheck,
  Plus,
  Minus,
  Sparkles,
  LogIn,
  LogOut,
  ArrowRight,
  ArrowLeft,
  Smartphone,
  Tablet,
  Laptop,
  Gamepad2,
  Glasses,
  MessageSquare,
  Home,
  Film,
  Compass,
  Layers,
  User as UserIcon,
  SlidersHorizontal,
  Palette,
  Trash2,
  Mail,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  auth,
  db,
  ACTIVE_FIREBASE_PROJECT_ID,
  ACTIVE_FIRESTORE_DATABASE_ID,
  ADMIN_EMAIL,
  isUserAdmin,
  signInWithEmail,
  signOutUser,
  reauthenticateWithEmail,
  deleteUserAccount,
  handleFirestoreError,
  OperationType,
  handleGithubRedirectResult,
  getFriendlyAuthErrorMessage,
  getCachedUserProfile,
} from './firebase';
import {
  MediaItem,
  Genre,
  SupportMessageItem,
  VideoAdConfig,
} from './types/media';
import { ALL_GENRES } from './data/catalog';
import { HeroBanner } from './components/HeroBanner';
import { CarouselRow } from './components/CarouselRow';
import { MovieCard } from './components/MovieCard';
import { DetailsView } from './components/DetailsView';
import {
  InfoModal,
  InfoModalType,
  LegalDocumentPage,
  LegalPagesConfig,
  LegalSectionKey,
  LEGAL_ROUTE_SLUGS,
  DEFAULT_LEGAL_PAGES,
  OFFICIAL_CONTACT_EMAIL,
  normalizeLegalPagesConfig,
  resolveLegalSectionFromLocation,
} from './components/InfoModal';
import {
  ContinueWatchingRow,
  WatchProgressEntry,
} from './components/ContinueWatchingRow';
import { AdminStudioModal } from './components/AdminStudioModal';
import { VisualUiEditor } from './components/VisualUiEditor';
import { MediaArtwork } from './components/MediaArtwork';
import { AuthModal } from './components/AuthModal';
import { CinematicSplashScreen } from './components/CinematicSplashScreen';

type NavView =
  | 'home'
  | 'movies_shows'
  | 'movies'
  | 'tv'
  | 'categories'
  | 'myspace'
  | 'support'
  | 'search'
  | 'watchlist'
  | 'details'
  | 'legal';

const WATCHLIST_STORAGE_KEY = 'zappy_watchlist_v2';
const COMPLETED_STORAGE_KEY = 'zappy_completed_v1';
const ADS_STORAGE_KEY = 'zappy_ads_enabled_v1';
const WATCH_PROGRESS_STORAGE_KEY = 'zappy_watch_progress_v2';
const LEGAL_PAGES_STORAGE_KEY = 'zappy_legal_pages_v2';
const HERO_CYCLE_STORAGE_KEY = 'zappy_hero_8movie_cycle_v1';
const HERO_DAILY_BATCH_SIZE = 8;
const HERO_BATCH_CYCLE_MS = 24 * 60 * 60 * 1000; // 24-hour daily 8-movie batch rotation
const HERO_MOVIE_TENURE_MS = 28 * 60 * 60 * 1000; // 28-hour spotlight tenure window per movie

const ZAPPY_DEVICES = [
  {
    title: 'Smartphones',
    icon: Smartphone,
    description:
      'Zappy is optimized for both Android and iOS smartphones. Stream smoothly on mobile browsers or install as an app.',
  },
  {
    title: 'Tablet',
    icon: Tablet,
    description:
      'Zappy is optimized for both Android and iOS tablets. Enjoy crisp widescreen playback on the go from anywhere.',
  },
  {
    title: 'Smart TV',
    icon: Tv,
    description:
      'Watch in 4K UHD directly on your living room Smart TV, Android TV, Apple TV, or Fire TV Stick.',
  },
  {
    title: 'Laptops',
    icon: Laptop,
    description:
      'Stream seamlessly in any modern desktop or laptop browser with instant adaptive bitrate and keyboard shortcuts.',
  },
  {
    title: 'Gaming Consoles',
    icon: Gamepad2,
    description:
      'Experience high-frame-rate cinema and series playback on PlayStation and Xbox gaming consoles.',
  },
  {
    title: 'VR Headsets',
    icon: Glasses,
    description:
      'Immerse yourself in a virtual theater environment with support for next-generation VR and spatial headsets.',
  },
];

const ZAPPY_FAQS = [
  {
    num: '01',
    question: 'What is ZappyFun?',
    answer:
      'ZappyFun is an on-demand streaming platform that allows you to watch movies and TV shows in 4K UHD.',
  },
  {
    num: '02',
    question: 'What content is available on ZappyFun?',
    answer:
      'Enjoy blockbuster movies, original series, trending TV shows, documentaries, and curated titles across every genre.',
  },
  {
    num: '03',
    question: 'How can I watch ZappyFun?',
    answer:
      'You can watch directly on the web across smartphones, tablets, Smart TVs, laptops, gaming consoles, and VR headsets.',
  },
  {
    num: '04',
    question: 'How do I sign in to ZappyFun?',
    answer:
      'Click Sign In to authenticate using your email and password. New users can register instantly with a secure 4-digit verification code sent to their email.',
  },
  {
    num: '05',
    question: 'What happens when I finish watching a title in my Watchlist?',
    answer:
      'Once you watch a movie or show fully on ZappyFun, it is automatically removed from your Watchlist so your list stays fresh.',
  },
  {
    num: '06',
    question: 'How do I contact ZappyFun customer support?',
    answer:
      'Visit our Support page to send a direct message to the ZappyFun Admin inbox or email us at ContactZappyFun@gmail.com.',
  },
];

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);

  const [catalog, setCatalog] = useState<MediaItem[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(true);

  // Cinematic Splash Screen State (shown on cold startup and browser reload)
  const [showSplash, setShowSplash] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined') {
        const perfNav = window.performance?.getEntriesByType?.('navigation')?.[0] as
          | PerformanceNavigationTiming
          | undefined;
        const isReload = perfNav?.type === 'reload';
        if (isReload) return true;

        const alreadyShown = window.sessionStorage.getItem('zappy_splash_shown_v1');
        return !alreadyShown;
      }
    } catch {
      // Fallback
    }
    return true;
  });

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('zappy_splash_shown_v1', '1');
      }
    } catch {
      // Ignore
    }
  }, []);

  const isAppReady = isAuthReady && (!isLoadingCatalog || catalog.length > 0);

  const [videoAdConfig] = useState<VideoAdConfig>({
    imaEnabled: true,
    testMode: true,
    vastTagUrl: '',
    enablePreRoll: true,
    enableMidRoll: true,
  });

  const [activeLegalSection, setActiveLegalSection] =
    useState<LegalSectionKey>(() => {
      try {
        return (
          resolveLegalSectionFromLocation(
            window.location.pathname,
            window.location.search
          ) || 'terms'
        );
      } catch {
        return 'terms';
      }
    });

  const [activeView, setActiveView] = useState<NavView>(() => {
    try {
      const matchedLegal = resolveLegalSectionFromLocation(
        window.location.pathname,
        window.location.search
      );
      if (matchedLegal) return 'legal';
    } catch {
      // Ignore
    }
    return 'home';
  });
  const [previousView, setPreviousView] = useState<NavView>('home');
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [autoPlayOnOpen, setAutoPlayOnOpen] = useState<boolean>(false);
  const [resumeSavedOnOpen, setResumeSavedOnOpen] = useState<boolean>(false);
  const [activeHeroIndex, setActiveHeroIndex] = useState<number>(0);

  // Admin Studio Modal & Live Visual UI Editor State
  const [adminStudioOpen, setAdminStudioOpen] = useState<boolean>(false);
  const [adminInitialTab, setAdminInitialTab] = useState<
    'catalog' | 'support' | 'legal'
  >('catalog');
  const [adminPrefillMedia, setAdminPrefillMedia] =
    useState<MediaItem | null>(null);
  const [previewDraftItem, setPreviewDraftItem] =
    useState<MediaItem | null>(null);
  const [isPublishingDraft, setIsPublishingDraft] = useState<boolean>(false);
  const [visualEditorActive, setVisualEditorActive] = useState<boolean>(false);

  // Mobile Menu & Header Popovers
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState<boolean>(false);
  const [sessionToast, setSessionToast] = useState<string | null>(null);

  // Search & Filter State (with Debounced Input)
  const [searchBarOpen, setSearchBarOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('');
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [searchTypeFilter, setSearchTypeFilter] = useState<
    'all' | 'movie' | 'series'
  >('all');
  const [searchSortBy, setSearchSortBy] = useState<
    'relevance' | 'newest' | 'popular' | 'title'
  >('relevance');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  // Genre Pagination State (allows cycling through all genres)
  const [genrePageIndex, setGenrePageIndex] = useState<number>(0);

  // Home / FAQ Interactive State
  const [openFaqId, setOpenFaqId] = useState<string>('01');

  // Auto-Add newly aired episodes to ZappyFun catalog & Cloud Firestore (Admin only for Firestore writes)
  const handleAutoSyncEpisodes = useCallback(
    async (targetItem: MediaItem, newSeasons: number, newEpisodes: number) => {
      setCatalog((prev) =>
        prev.map((c) =>
          c.id === targetItem.id
            ? { ...c, seasonsCount: newSeasons, episodesCount: newEpisodes }
            : c
        )
      );
      if (
        !auth.currentUser ||
        !isUserAdmin(auth.currentUser.email, auth.currentUser.emailVerified)
      ) {
        return;
      }
      try {
        const docRef = doc(db, 'catalog', targetItem.id);
        await updateDoc(docRef, {
          seasonsCount: newSeasons,
          episodesCount: newEpisodes,
          updatedAt: serverTimestamp(),
        });
        setSessionToast(
          `✨ Automatically added ${newEpisodes} episodes for "${targetItem.title}" to ZappyFun!`
        );
        setTimeout(() => setSessionToast(null), 5000);
      } catch {
        // Guest or offline fallback is preserved in local state
      }
    },
    []
  );

  // Support Form & Admin Support Messages State
  const [supportFirstName, setSupportFirstName] = useState<string>('');
  const [supportLastName, setSupportLastName] = useState<string>('');
  const [supportEmail, setSupportEmail] = useState<string>('');
  const [supportPhone, setSupportPhone] = useState<string>('');
  const [supportMessage, setSupportMessage] = useState<string>('');
  const [supportAgreed, setSupportAgreed] = useState<boolean>(false);
  const [isSendingSupport, setIsSendingSupport] = useState<boolean>(false);
  const [firestoreSupportMessages, setFirestoreSupportMessages] = useState<
    SupportMessageItem[]
  >([]);
  const [serverSupportMessages, setServerSupportMessages] = useState<
    SupportMessageItem[]
  >([]);

  // Completed / Watched Fully IDs (ensures watched items do not stay in Watchlist)
  const [completedIds, setCompletedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(COMPLETED_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? Array.from(new Set(parsed)) : [];
    } catch {
      return [];
    }
  });

  // Watchlist State
  const [watchlistIds, setWatchlistIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(WATCHLIST_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? Array.from(new Set(parsed)) : [];
    } catch {
      return [];
    }
  });

  // Continue Watching Progress State (Persisted to localStorage)
  const [watchProgressMap, setWatchProgressMap] = useState<
    Record<string, WatchProgressEntry>
  >(() => {
    try {
      const raw = localStorage.getItem(WATCH_PROGRESS_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  });

  // Configurable Display Ad-Supported Placeholder State
  const [adsEnabled, setAdsEnabled] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(ADS_STORAGE_KEY);
      return raw === null ? true : raw === 'true';
    } catch {
      return true;
    }
  });

  // Code-Backed & Admin-Editable Legal Pages State (/src/data/legalDocuments.ts + Firestore ui_config/legal_pages)
  const [legalPages, setLegalPages] = useState<LegalPagesConfig>(() => {
    try {
      localStorage.removeItem('zappy_legal_pages_v1');
      const raw = localStorage.getItem(LEGAL_PAGES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return normalizeLegalPagesConfig(parsed);
        }
      }
    } catch {
      // Ignore
    }
    return DEFAULT_LEGAL_PAGES;
  });

  const [activeModal, setActiveModal] = useState<InfoModalType>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync browser URL Back/Forward buttons for Legal routes (/Terms-of-use, /Privacy-policy, /About, /Disclaimer-and-copyright-policy)
  useEffect(() => {
    const handlePopState = () => {
      const matchedLegal = resolveLegalSectionFromLocation(
        window.location.pathname,
        window.location.search
      );
      if (matchedLegal) {
        setActiveLegalSection(matchedLegal);
        setActiveView('legal');
      } else {
        setActiveView((prev) => (prev === 'legal' ? 'home' : prev));
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        LEGAL_PAGES_STORAGE_KEY,
        JSON.stringify(legalPages)
      );
    } catch {
      // Ignore
    }
  }, [legalPages]);

  // Fetch authoritative legal pages from /api/legal (backed by /src/data/legalDocuments.ts)
  useEffect(() => {
    fetch('/api/legal')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.legalPages && typeof data.legalPages === 'object') {
          setLegalPages((prev) =>
            normalizeLegalPagesConfig({
              ...prev,
              ...data.legalPages,
            })
          );
        }
      })
      .catch(() => {
        // Ignore network error
      });
  }, []);

  useEffect(() => {
    const legalDocRef = doc(db, 'ui_config', 'legal_pages');
    const unsubscribe = onSnapshot(
      legalDocRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data && typeof data === 'object') {
            setLegalPages((prev) =>
              normalizeLegalPagesConfig({
                ...prev,
                ...(data as Partial<LegalPagesConfig>),
              })
            );
          }
        }
      },
      () => {
        // Ignore if not yet created
      }
    );
    return () => unsubscribe();
  }, []);

  // Hero Banner 8-Movie Daily Cycle State (24h batch rotation & 28h per-movie tenure)
  const [heroCycleConfig, setHeroCycleConfig] = useState<{
    epochMs: number;
    manualBatchOffset: number;
  }>(() => {
    try {
      const raw = localStorage.getItem(HERO_CYCLE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.epochMs === 'number' && parsed.epochMs > 0) {
          return {
            epochMs: parsed.epochMs,
            manualBatchOffset: Number(parsed.manualBatchOffset) || 0,
          };
        }
      }
    } catch {
      // Ignore
    }
    const initial = { epochMs: Date.now(), manualBatchOffset: 0 };
    try {
      localStorage.setItem(HERO_CYCLE_STORAGE_KEY, JSON.stringify(initial));
    } catch {
      // Ignore
    }
    return initial;
  });

  const [cycleNowMs, setCycleNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCycleNowMs(Date.now());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        HERO_CYCLE_STORAGE_KEY,
        JSON.stringify(heroCycleConfig)
      );
    } catch {
      // Ignore
    }
  }, [heroCycleConfig]);

  // Sync Hero Banner 8-Movie Daily Cycle config across all users via Firestore /ui_config/hero_cycle
  useEffect(() => {
    const cycleDocRef = doc(db, 'ui_config', 'hero_cycle');
    const unsubscribe = onSnapshot(
      cycleDocRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (typeof data?.epochMs === 'number' && data.epochMs > 0) {
            setHeroCycleConfig({
              epochMs: data.epochMs,
              manualBatchOffset: Number(data.manualBatchOffset) || 0,
            });
          }
        }
      },
      () => {
        // Ignore if not yet created
      }
    );
    return () => unsubscribe();
  }, []);

  const isAdmin = isUserAdmin(currentUser?.email, currentUser?.emailVerified);

  const showToast = useCallback((msg: string) => {
    setSessionToast(msg);
    setTimeout(() => setSessionToast(null), 3800);
  }, []);

  // 1. Listen to Firebase Authentication State & Process GitHub Redirect Results
  useEffect(() => {
    // Process redirect result if arriving back from GitHub OAuth (mobile / Netlify)
    handleGithubRedirectResult()
      .then((result) => {
        if (result && result.user) {
          const email = result.user.email || '';
          if (isUserAdmin(email, result.user.emailVerified)) {
            showToast(`Welcome Admin (${email})! Zappy Admin Studio unlocked.`);
          } else {
            showToast(
              `Signed in with GitHub as ${result.user.displayName || email || 'User'}`
            );
          }
        }
      })
      .catch((err) => {
        console.warn('GitHub redirect result notice:', err);
        const friendly = getFriendlyAuthErrorMessage(err);
        showToast(friendly);
      });

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, [showToast]);

  // 2. Real-time Cloud Firestore Catalog Subscription
  useEffect(() => {
    setIsLoadingCatalog(true);
    const catalogQuery = query(
      collection(db, 'catalog'),
      where('visibility', '==', 'public')
    );

    const unsubscribe = onSnapshot(
      catalogQuery,
      (snapshot) => {
        const validDocs = snapshot.docs.filter((docSnap) => {
          const data = docSnap.data();
          const rawTitle = String(data.title || '').trim().toLowerCase();
          const rawEmbed = String(data.cinesrcEmbedUrl || '').toLowerCase();
          const isBogusSearchEntry =
            rawTitle === 'search' ||
            docSnap.id === 'movie-tt29730964' ||
            docSnap.id === 'movie-search' ||
            rawEmbed.includes('tt29730964');
          if (isBogusSearchEntry) {
            if (
              auth.currentUser &&
              isUserAdmin(auth.currentUser.email, auth.currentUser.emailVerified)
            ) {
              deleteDoc(doc(db, 'catalog', docSnap.id)).catch(() => {});
            }
            return false;
          }
          return true;
        });

        const items: MediaItem[] = validDocs.map((docSnap) => {
          const data = docSnap.data();
          const mediaType = data.mediaType === 'tv' ? 'tv' : 'movie';
          let parsedCredits = [];
          if (typeof data.creditsJson === 'string' && data.creditsJson.trim()) {
            try {
              const parsed = JSON.parse(data.creditsJson);
              if (Array.isArray(parsed)) parsedCredits = parsed;
            } catch {
              parsedCredits = [];
            }
          }
          const cleanTagline =
            typeof data.tagline === 'string'
              ? data.tagline
                  .replace(
                    /CineSrc\.st|VidLink\.pro|EmbedMaster|TMDB\s*#?\d*/gi,
                    ''
                  )
                  .replace(/via\s*$/i, '')
                  .trim()
              : '';

          const rawEmbedStr =
            typeof data.cinesrcEmbedUrl === 'string'
              ? data.cinesrcEmbedUrl.trim()
              : '';
          const numMatch = rawEmbedStr.match(
            /(?:movie|tv|series|show)\/(\d+)/i
          );
          const rawTmdbNum =
            Number(data.tmdbId) || (numMatch?.[1] ? Number(numMatch[1]) : 0);
          const resolvedNumericId =
            rawTmdbNum > 0 && rawTmdbNum !== 10000 ? rawTmdbNum : 157336;
          const normalizedVidlyUrl =
            mediaType === 'tv'
              ? `https://vidly.pro/tv/${resolvedNumericId}/1/1`
              : `https://vidly.pro/movie/${resolvedNumericId}`;

          if (
            auth.currentUser &&
            isUserAdmin(auth.currentUser.email, auth.currentUser.emailVerified) &&
            (!rawEmbedStr.includes('vidly.pro') || !data.cinesrcEmbedUrl)
          ) {
            updateDoc(doc(db, 'catalog', docSnap.id), {
              cinesrcEmbedUrl: normalizedVidlyUrl,
              tmdbId: resolvedNumericId,
              updatedAt: serverTimestamp(),
            }).catch(() => {});
          }

          return {
            id: data.id || docSnap.id,
            tmdbId: resolvedNumericId,
            mediaType,
            title: data.title || 'Untitled',
            tagline: cleanTagline,
            synopsis: data.synopsis || '',
            contentType:
              data.contentType === 'series' || mediaType === 'tv'
                ? 'series'
                : 'movie',
            genres:
              Array.isArray(data.genres) && data.genres.length > 0
                ? data.genres
                : ['Action'],
            releaseYear: Number(data.releaseYear) || 2024,
            durationMinutes: Number(data.durationMinutes) || 120,
            maturityRating: data.maturityRating || 'PG-13',
            directorOrCreator: data.directorOrCreator || 'Featured Creator',
            cast: Array.isArray(data.cast) ? data.cast : ['Featured Cast'],
            credits: parsedCredits,
            creditsJson:
              typeof data.creditsJson === 'string' ? data.creditsJson : '[]',
            posterUrl: data.posterUrl || '',
            backdropUrl: data.backdropUrl || data.posterUrl || '',
            cinesrcEmbedUrl: normalizedVidlyUrl,
            justWatchUrl: data.justWatchUrl || '',
            visibility: data.visibility || 'public',
            authorUid: data.authorUid || '',
            availabilityStatus: 'playable_demo',
            availabilityNote: '4K UHD · Instant Stream',
            featured: Boolean(data.featured ?? true),
            heroAddedAtMs: Number(data.heroAddedAtMs) || undefined,
            popularScore: Number(data.popularScore) || 92,
            recentlyAdded: true,
            seasonsCount: Number(data.seasonsCount) || 1,
            episodesCount: Number(data.episodesCount) || 8,
            visualTheme: {
              primaryHex: '#141414',
              secondaryHex: '#1A1A1A',
              accentHex: '#E50000',
              motif: 'horizon',
            },
          };
        });

        setCatalog(items);
        setIsLoadingCatalog(false);

        setSelectedMedia((prev) => {
          if (!prev) return null;
          const updated = items.find((i) => i.id === prev.id);
          if (!updated) return prev;
          if (
            updated.title === prev.title &&
            updated.cinesrcEmbedUrl === prev.cinesrcEmbedUrl &&
            updated.tmdbId === prev.tmdbId &&
            updated.posterUrl === prev.posterUrl &&
            updated.backdropUrl === prev.backdropUrl &&
            updated.synopsis === prev.synopsis
          ) {
            return prev;
          }
          return updated;
        });

        const params = new URLSearchParams(window.location.search);
        const requestedTitleId = params.get('title');
        if (requestedTitleId && items.length > 0) {
          const match = items.find((item) => item.id === requestedTitleId);
          if (match) {
            setSelectedMedia(match);
            setActiveView('details');
          }
        }
      },
      (error) => {
        setIsLoadingCatalog(false);
        handleFirestoreError(error, OperationType.LIST, 'catalog');
      }
    );

    return () => unsubscribe();
  }, []);

  // 3. Real-time Cloud Firestore Watchlist Subscription
  useEffect(() => {
    if (!isAuthReady || !currentUser) return;

    const watchlistQuery = query(
      collection(db, 'watchlists'),
      where('ownerId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      watchlistQuery,
      (snapshot) => {
        const ids = snapshot.docs
          .map((d) => d.data().mediaId as string)
          .filter(Boolean);
        setWatchlistIds(Array.from(new Set(ids)));
      },
      (error) => {
        console.error('Watchlist subscription error:', error);
      }
    );

    return () => unsubscribe();
  }, [isAuthReady, currentUser]);

  // 4. Real-time Admin Support Messages Subscription (Firestore + Backend API with Verified Admin Token)
  const fetchServerSupportMessages = useCallback(async () => {
    if (!currentUser || !isAdmin) {
      setServerSupportMessages([]);
      return;
    }
    try {
      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/support', {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.messages)) {
          setServerSupportMessages(data.messages);
        }
      }
    } catch {
      // Ignore network error
    }
  }, [currentUser, isAdmin]);

  useEffect(() => {
    fetchServerSupportMessages();
  }, [fetchServerSupportMessages, adminStudioOpen]);

  useEffect(() => {
    if (!isAuthReady || !currentUser || !isAdmin) {
      setFirestoreSupportMessages([]);
      return;
    }

    const supportQuery = query(collection(db, 'support_messages'));
    const unsubscribe = onSnapshot(
      supportQuery,
      (snapshot) => {
        const msgs: SupportMessageItem[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: d.id || docSnap.id,
            firstName: d.firstName || 'User',
            lastName: d.lastName || '',
            email: d.email || '',
            phone: d.phone || '',
            message: d.message || '',
            status: d.status === 'resolved' ? 'resolved' : 'open',
            senderUid: d.senderUid || '',
            createdAtMs: Number(d.createdAtMs) || Date.now(),
          };
        });
        setFirestoreSupportMessages(msgs);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'support_messages');
      }
    );

    return () => unsubscribe();
  }, [isAuthReady, currentUser, isAdmin]);

  // Merged Support Messages for Admin Panel (deduplicated by ID, newest first)
  const mergedSupportMessages = useMemo(() => {
    const map = new Map<string, SupportMessageItem>();
    serverSupportMessages.forEach((m) => map.set(m.id, m));
    firestoreSupportMessages.forEach((m) => map.set(m.id, m));
    return Array.from(map.values()).sort(
      (a, b) => b.createdAtMs - a.createdAtMs
    );
  }, [serverSupportMessages, firestoreSupportMessages]);

  useEffect(() => {
    try {
      localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlistIds));
    } catch {
      // Ignore
    }
  }, [watchlistIds]);

  useEffect(() => {
    try {
      localStorage.setItem(COMPLETED_STORAGE_KEY, JSON.stringify(completedIds));
    } catch {
      // Ignore
    }
  }, [completedIds]);

  useEffect(() => {
    try {
      localStorage.setItem(ADS_STORAGE_KEY, String(adsEnabled));
    } catch {
      // Ignore
    }
  }, [adsEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem(
        WATCH_PROGRESS_STORAGE_KEY,
        JSON.stringify(watchProgressMap)
      );
    } catch {
      // Ignore
    }
  }, [watchProgressMap]);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'register'>('signin');
  const [deleteAccountPassword, setDeleteAccountPassword] = useState<string>('');

  const handleOpenAuthModal = (mode: 'signin' | 'register' = 'signin') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const handleLogout = async () => {
    try {
      await signOutUser();
      setProfileMenuOpen(false);
      showToast('Signed out.');
    } catch {
      // Ignore
    }
  };

  const [isPurgingCatalog, setIsPurgingCatalog] = useState<boolean>(false);
  const [confirmingPurgeCatalog, setConfirmingPurgeCatalog] =
    useState<boolean>(false);

  // Self-Service Account & Personal Data Deletion State (My Space)
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] =
    useState<boolean>(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState<boolean>(false);
  const [deleteAccountNeedsReauth, setDeleteAccountNeedsReauth] =
    useState<boolean>(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(
    null
  );
  const [deleteAccountSuccessBanner, setDeleteAccountSuccessBanner] = useState<
    string | null
  >(null);

  const handleClearLocalViewerDataOnly = () => {
    try {
      localStorage.removeItem(WATCHLIST_STORAGE_KEY);
      localStorage.removeItem(COMPLETED_STORAGE_KEY);
      localStorage.removeItem(WATCH_PROGRESS_STORAGE_KEY);
    } catch {
      // Ignore storage error
    }
    setWatchlistIds([]);
    setCompletedIds([]);
    setWatchProgressMap({});
    showToast(
      'Cleared local watchlist, watch history, and completed records on this browser.'
    );
  };

  const handleDeleteAccountAndData = async (reauthFirst = false) => {
    if (!currentUser) return;
    setIsDeletingAccount(true);
    setDeleteAccountError(null);
    setDeleteAccountSuccessBanner(null);

    try {
      // 1. Password re-authentication when required by Firebase Auth
      if (reauthFirst) {
        if (!deleteAccountPassword) {
          setDeleteAccountError('Please enter your account password to confirm deletion.');
          setIsDeletingAccount(false);
          return;
        }
        await reauthenticateWithEmail(currentUser, deleteAccountPassword);
        setDeleteAccountNeedsReauth(false);
      }

      // 2. Delete all Cloud Firestore /watchlists documents owned by this user
      const userWatchlistQuery = query(
        collection(db, 'watchlists'),
        where('ownerId', '==', currentUser.uid)
      );
      const watchlistSnap = await getDocs(userWatchlistQuery);
      if (!watchlistSnap.empty) {
        await Promise.all(
          watchlistSnap.docs.map((docSnap) =>
            deleteDoc(doc(db, 'watchlists', docSnap.id))
          )
        );
      }

      // 3. Delete the Firebase Authentication user record
      await deleteUserAccount(currentUser);

      // 4. Clear ONLY user-specific localStorage keys (preserve global app config keys)
      try {
        localStorage.removeItem(WATCHLIST_STORAGE_KEY);
        localStorage.removeItem(COMPLETED_STORAGE_KEY);
        localStorage.removeItem(WATCH_PROGRESS_STORAGE_KEY);
      } catch {
        // Ignore storage error
      }

      setWatchlistIds([]);
      setCompletedIds([]);
      setWatchProgressMap({});
      setDeleteAccountPassword('');
      setShowDeleteAccountConfirm(false);
      setDeleteAccountNeedsReauth(false);
      setDeleteAccountSuccessBanner(
        'Your ZappyFun account, Cloud Firestore watchlist records, and local watch history on this browser have been permanently deleted.'
      );
      showToast(
        'Your ZappyFun account and personal data have been permanently deleted.'
      );
    } catch (err: unknown) {
      const errObj = err as { code?: string; message?: string };
      const errCode = String(errObj?.code || '');
      const errMsg = String(errObj?.message || err || '');

      if (
        errCode === 'auth/requires-recent-login' ||
        errMsg.includes('requires-recent-login')
      ) {
        setDeleteAccountNeedsReauth(true);
        setDeleteAccountError(
          'For your security, please enter your password below to confirm account deletion.'
        );
      } else if (
        errCode === 'auth/wrong-password' ||
        errCode === 'auth/invalid-credential'
      ) {
        setDeleteAccountError(
          'Incorrect password. Please enter your correct account password.'
        );
      } else {
        setDeleteAccountError(
          `Account deletion could not be completed: ${errMsg || 'Unexpected error'}. Your account remains signed in so you can retry.`
        );
      }
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleClearEntireCatalog = async () => {
    if (!currentUser || !isAdmin) {
      showToast('Please sign in as Admin to clear the catalog.');
      return;
    }
    setIsPurgingCatalog(true);
    setConfirmingPurgeCatalog(false);
    try {
      const snap = await getDocs(collection(db, 'catalog'));
      const batchPromises = snap.docs.map((docSnap) =>
        deleteDoc(doc(db, 'catalog', docSnap.id)).catch(() => {})
      );
      await Promise.all(batchPromises);
      setCatalog([]);
      setSelectedMedia(null);
      showToast(
        `Successfully removed all ${snap.size} movies and TV shows from the catalog.`
      );
    } catch (error) {
      console.error('Failed to clear catalog:', error);
      showToast(
        'Failed to clear catalog: ' +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setIsPurgingCatalog(false);
    }
  };

  const handleToggleWatchlist = async (
    item: MediaItem,
    e?: React.MouseEvent
  ) => {
    if (e) {
      e.stopPropagation();
    }

    const alreadySaved = watchlistIds.includes(item.id);

    // If re-adding to watchlist manually, unmark from completedIds so it shows in Watchlist
    if (!alreadySaved && completedIds.includes(item.id)) {
      setCompletedIds((prev) => prev.filter((id) => id !== item.id));
    }

    setWatchlistIds((prev) =>
      alreadySaved
        ? prev.filter((id) => id !== item.id)
        : Array.from(new Set([...prev, item.id]))
    );

    if (currentUser) {
      const docId = `${currentUser.uid}_${item.id}`.replace(
        /[^a-zA-Z0-9_-]/g,
        '_'
      );
      try {
        if (alreadySaved) {
          await deleteDoc(doc(db, 'watchlists', docId));
        } else {
          await setDoc(doc(db, 'watchlists', docId), {
            mediaId: item.id,
            ownerId: currentUser.uid,
            createdAt: serverTimestamp(),
          });
        }
      } catch (error) {
        console.error('Watchlist sync error:', error);
      }
    }
  };

  /**
   * Automatically removes a movie/show from the user's Watchlist once watched fully
   */
  const handleWatchComplete = useCallback(
    async (item: MediaItem) => {
      setCompletedIds((prev) => Array.from(new Set([...prev, item.id])));
      setWatchlistIds((prev) => prev.filter((id) => id !== item.id));
      setWatchProgressMap((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });

      if (currentUser && currentUser.emailVerified) {
        const docId = `${currentUser.uid}_${item.id}`.replace(
          /[^a-zA-Z0-9_-]/g,
          '_'
        );
        try {
          await deleteDoc(doc(db, 'watchlists', docId));
        } catch {
          // Ignore if not present in Firestore
        }
      }

      showToast(
        `Watched "${item.title}" fully — automatically removed from your Watchlist.`
      );
    },
    [currentUser, showToast]
  );

  const handleUpdateWatchProgress = useCallback(
    (
      item: MediaItem,
      seasonNumber: number,
      episodeNumber: number,
      progressPercent?: number,
      remainingMinutes?: number
    ) => {
      if (completedIds.includes(item.id)) return;
      setWatchProgressMap((prev) => {
        const existing = prev[item.id];
        const totalMins = Math.max(
          15,
          item.durationMinutes || (item.contentType === 'series' ? 45 : 110)
        );
        const sameEpisode =
          existing &&
          existing.seasonNumber === seasonNumber &&
          existing.episodeNumber === episodeNumber;

        const resolvedPercent =
          typeof progressPercent === 'number' && progressPercent > 0
            ? Math.min(99, Math.max(1, Math.round(progressPercent)))
            : sameEpisode && existing.progressPercent
            ? existing.progressPercent
            : 5;

        const resolvedRemaining =
          typeof remainingMinutes === 'number' && remainingMinutes > 0
            ? `${Math.max(1, Math.round(remainingMinutes))}m`
            : sameEpisode &&
              existing.remainingLabel &&
              typeof progressPercent !== 'number'
            ? existing.remainingLabel
            : `${Math.max(
                1,
                Math.round(totalMins * (1 - resolvedPercent / 100))
              )}m`;

        return {
          [item.id]: {
            mediaId: item.id,
            seasonNumber,
            episodeNumber,
            seasonEpisodeLabel:
              item.contentType === 'series'
                ? `S${seasonNumber} · E${episodeNumber}`
                : 'Movie',
            remainingLabel: resolvedRemaining,
            progressPercent: resolvedPercent,
            updatedAtMs: Date.now(),
          },
          ...prev,
        };
      });
    },
    [completedIds]
  );

  const handleSelectMedia = (
    item: MediaItem,
    autoPlay = false,
    resumeSaved = false
  ) => {
    if (activeView !== 'details') {
      setPreviousView(activeView);
    }
    setSelectedMedia(item);
    setAutoPlayOnOpen(autoPlay);
    setResumeSavedOnOpen(Boolean(resumeSaved));
    setActiveView('details');
    setNotificationsOpen(false);
    setProfileMenuOpen(false);
    setMobileMenuOpen(false);
    try {
      if (
        resolveLegalSectionFromLocation(
          window.location.pathname,
          window.location.search
        )
      ) {
        window.history.pushState({}, '', '/');
      }
    } catch {
      // Ignore
    }

    if (autoPlay && !completedIds.includes(item.id)) {
      const existing = watchProgressMap[item.id];
      const startSeason = resumeSaved ? existing?.seasonNumber || 1 : 1;
      const startEpisode = resumeSaved ? existing?.episodeNumber || 1 : 1;
      handleUpdateWatchProgress(item, startSeason, startEpisode);
    }
  };

  const handleRemoveWatchProgress = useCallback(
    (mediaId: string, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      setWatchProgressMap((prev) => {
        const next = { ...prev };
        delete next[mediaId];
        return next;
      });
    },
    []
  );

  const openLegalPage = useCallback(
    (section: LegalSectionKey) => {
      if (activeView !== 'legal' && activeView !== 'details') {
        setPreviousView(activeView);
      }
      setSearchBarOpen(false);
      setActiveModal(null);
      setActiveLegalSection(section);
      setActiveView('legal');
      setMobileMenuOpen(false);
      setNotificationsOpen(false);
      setProfileMenuOpen(false);
      try {
        const targetSlug = LEGAL_ROUTE_SLUGS[section] || '/Terms-of-use';
        if (window.location.pathname !== targetSlug) {
          window.history.pushState({ legalSection: section }, '', targetSlug);
        }
      } catch {
        // Ignore history push error
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [activeView]
  );

  const handleNavigate = (view: NavView) => {
    if (activeView !== 'details' && activeView !== 'legal') {
      setPreviousView(activeView);
    }
    setSearchBarOpen(false);
    setActiveModal(null);
    setActiveView(view);
    setMobileMenuOpen(false);
    setNotificationsOpen(false);
    setProfileMenuOpen(false);
    if (view !== 'legal') {
      try {
        if (
          resolveLegalSectionFromLocation(
            window.location.pathname,
            window.location.search
          )
        ) {
          window.history.pushState({}, '', '/');
        }
      } catch {
        // Ignore
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openAdminStudio = (
    mediaItem: MediaItem | null = null,
    tab: 'catalog' | 'support' | 'legal' = 'catalog'
  ) => {
    setAdminPrefillMedia(mediaItem);
    setAdminInitialTab(tab);
    setAdminStudioOpen(true);
    setMobileMenuOpen(false);
    setProfileMenuOpen(false);
  };

  const handleSaveLegalPages = useCallback(
    async (nextLegal: LegalPagesConfig) => {
      const normalized = normalizeLegalPagesConfig({
        ...nextLegal,
        updatedAtMs: Date.now(),
      });
      setLegalPages(normalized);

      // 1. Persist directly into source code (/src/data/legalDocuments.ts) via backend API
      try {
        await fetch('/api/legal', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ legalPages: normalized }),
        });
      } catch {
        // Ignore network error
      }

      // 2. Also sync to Cloud Firestore if signed in as admin
      if (currentUser && isAdmin) {
        try {
          await setDoc(
            doc(db, 'ui_config', 'legal_pages'),
            {
              ...normalized,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } catch {
          // Ignore Firestore error
        }
      }

      showToast(
        'Legal documents saved and synced directly into /src/data/legalDocuments.ts!'
      );
    },
    [currentUser, isAdmin, showToast]
  );

  const handlePreviewDraftInApp = (draftItem: MediaItem) => {
    setPreviewDraftItem(draftItem);
    setSelectedMedia(draftItem);
    setAutoPlayOnOpen(true);
    setActiveView('details');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePublishDraftFromPreview = async (draftItem: MediaItem) => {
    if (!currentUser || !isAdmin) return;
    setIsPublishingDraft(true);
    const docRef = doc(db, 'catalog', draftItem.id);
    try {
      const existingSnap = await getDoc(docRef);
      const isExisting = existingSnap.exists();
      const existingData = isExisting ? existingSnap.data() : null;

      let serializedCredits = '[]';
      try {
        const rawCredits = Array.isArray(draftItem.credits)
          ? draftItem.credits
          : [];
        const compactCredits = rawCredits.slice(0, 14).map((c) => ({
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

      await setDoc(docRef, {
        id: draftItem.id,
        tmdbId: draftItem.tmdbId,
        mediaType: draftItem.mediaType,
        contentType: draftItem.contentType,
        title: draftItem.title,
        tagline: draftItem.tagline,
        synopsis: draftItem.synopsis,
        genres: draftItem.genres,
        releaseYear: draftItem.releaseYear,
        durationMinutes: draftItem.durationMinutes,
        maturityRating: draftItem.maturityRating,
        directorOrCreator: draftItem.directorOrCreator,
        cast: draftItem.cast,
        creditsJson: serializedCredits,
        posterUrl: draftItem.posterUrl,
        backdropUrl: draftItem.backdropUrl,
        cinesrcEmbedUrl: (draftItem.cinesrcEmbedUrl || '').slice(0, 1024),
        justWatchUrl: (draftItem.justWatchUrl || '').slice(0, 1024),
        featured: Boolean(draftItem.featured ?? true),
        popularScore: draftItem.popularScore || 92,
        seasonsCount:
          draftItem.mediaType === 'tv' ? draftItem.seasonsCount || 1 : 0,
        episodesCount:
          draftItem.mediaType === 'tv' ? draftItem.episodesCount || 8 : 0,
        visibility: 'public',
        authorUid: isExisting
          ? existingData?.authorUid || currentUser.uid
          : currentUser.uid,
        createdAt: isExisting
          ? existingData?.createdAt || serverTimestamp()
          : serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setPreviewDraftItem(null);
      setSessionToast(
        `Published "${draftItem.title}" to the live catalog!`
      );
      setTimeout(() => setSessionToast(null), 4000);
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.CREATE,
        `catalog/${draftItem.id}`
      );
    } finally {
      setIsPublishingDraft(false);
    }
  };

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportFirstName.trim() || !supportEmail.trim() || !supportMessage.trim()) {
      return;
    }

    setIsSendingSupport(true);
    const messageId = `msg-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;
    const nowMs = Date.now();

    const newTicket: SupportMessageItem = {
      id: messageId,
      firstName: supportFirstName.trim().slice(0, 80),
      lastName: (supportLastName.trim() || '-').slice(0, 80),
      email: supportEmail.trim().slice(0, 160),
      phone: supportPhone.trim().slice(0, 40),
      message: supportMessage.trim().slice(0, 2000),
      status: 'open',
      senderUid: currentUser?.uid || 'guest',
      createdAtMs: nowMs,
    };

    try {
      // 1. Send to backend /api/support so any user (guest or signed-in) reaches Admin Inbox immediately
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTicket),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ticket) {
          setServerSupportMessages((prev) => [data.ticket, ...prev]);
        }
      }

      // 2. If signed in with a verified email, also persist in Cloud Firestore /support_messages/{messageId}
      if (currentUser && currentUser.emailVerified) {
        await setDoc(doc(db, 'support_messages', messageId), {
          id: messageId,
          firstName: newTicket.firstName,
          lastName: newTicket.lastName,
          email: newTicket.email,
          phone: newTicket.phone,
          message: newTicket.message,
          status: 'open',
          senderUid: currentUser.uid,
          createdAtMs: nowMs,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      showToast(
        `Thanks ${newTicket.firstName}! Your message has been sent to the Zappy Admin Panel.`
      );
      setSupportFirstName('');
      setSupportLastName('');
      setSupportEmail('');
      setSupportPhone('');
      setSupportMessage('');
      setSupportAgreed(false);
    } catch {
      showToast('Could not send support message. Please try again.');
    } finally {
      setIsSendingSupport(false);
    }
  };

  const handleUpdateSupportStatus = async (
    msg: SupportMessageItem,
    nextStatus: 'open' | 'resolved'
  ) => {
    if (!currentUser || !isAdmin) return;
    try {
      const idToken = await currentUser.getIdToken();
      const res = await fetch(`/api/support/${encodeURIComponent(msg.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        setServerSupportMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, status: nextStatus } : m))
        );
      }

      const docRef = doc(db, 'support_messages', msg.id);
      await updateDoc(docRef, {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Ignore if document is only in backend memory
    }
  };

  const handleDeleteSupportMessage = async (msg: SupportMessageItem) => {
    if (!currentUser || !isAdmin) return;
    try {
      const idToken = await currentUser.getIdToken();
      const res = await fetch(`/api/support/${encodeURIComponent(msg.id)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      if (res.ok) {
        setServerSupportMessages((prev) => prev.filter((m) => m.id !== msg.id));
      }

      await deleteDoc(doc(db, 'support_messages', msg.id));
    } catch {
      // Ignore
    }
  };

  /**
   * Hero Banner 8-Movie Daily Cycle:
   * - Displays 8 movies at a time in the Hero Banner.
   * - From now to +24 hours: shows the current batch of 8 movies; after 24 hours: automatically
   *   rotates to the next 8 movies, continuing this cycle across the entire catalog.
   * - Each movie also has a 28-hour spotlight tenure window (HERO_MOVIE_TENURE_MS) so newly
   *   featured movies remain in the Hero Banner for 28 hours before cycling out.
   */
  const {
    featuredItems,
    activeHeroBatchNumber,
    totalHeroBatches,
    hoursUntilNextHeroBatch,
  } = useMemo(() => {
    if (catalog.length === 0) {
      return {
        featuredItems: [] as MediaItem[],
        activeHeroBatchNumber: 1,
        totalHeroBatches: 1,
        hoursUntilNextHeroBatch: 24,
      };
    }

    // Prioritize movies for the 8-movie Hero Banner cycle; include other catalog items only if fewer than 8 movies exist
    const moviesOnly = catalog.filter(
      (item) => item.contentType === 'movie' || item.mediaType === 'movie'
    );
    const featuredMovies = moviesOnly.filter((item) => item.featured !== false);
    let pool: MediaItem[] =
      featuredMovies.length >= HERO_DAILY_BATCH_SIZE
        ? featuredMovies
        : moviesOnly.length >= HERO_DAILY_BATCH_SIZE
        ? moviesOnly
        : catalog;

    // Sort deterministically so every 24h batch of 8 movies cycles cleanly without shuffling
    pool = [...pool].sort((a, b) => {
      const timeA = a.heroAddedAtMs || 0;
      const timeB = b.heroAddedAtMs || 0;
      if (timeA !== timeB) return timeB - timeA;
      return a.id.localeCompare(b.id);
    });

    const elapsedMs = Math.max(0, cycleNowMs - heroCycleConfig.epochMs);
    const elapsedDays = Math.floor(elapsedMs / HERO_BATCH_CYCLE_MS);
    const msIntoCurrentDay = elapsedMs % HERO_BATCH_CYCLE_MS;
    const hoursRemaining = Math.max(
      1,
      Math.ceil((HERO_BATCH_CYCLE_MS - msIntoCurrentDay) / (1000 * 60 * 60))
    );

    const totalBatches = Math.max(
      1,
      Math.ceil(pool.length / HERO_DAILY_BATCH_SIZE)
    );
    const rawBatchIndex =
      elapsedDays + Math.max(0, heroCycleConfig.manualBatchOffset || 0);
    const currentBatchIdx = rawBatchIndex % totalBatches;

    const batchSize = Math.min(HERO_DAILY_BATCH_SIZE, pool.length);
    const startOffset = (rawBatchIndex * HERO_DAILY_BATCH_SIZE) % pool.length;

    const selected: MediaItem[] = [];
    const seenIds = new Set<string>();

    // First include any movies still within their 28-hour spotlight tenure window
    // (when transitioning between 24h and 28h, or newly added movies)
    const activeBatchStartMs =
      heroCycleConfig.epochMs + elapsedDays * HERO_BATCH_CYCLE_MS;
    for (const item of pool) {
      if (selected.length >= batchSize) break;
      if (
        item.heroAddedAtMs &&
        cycleNowMs - item.heroAddedAtMs >= 0 &&
        cycleNowMs - item.heroAddedAtMs <= HERO_MOVIE_TENURE_MS &&
        item.heroAddedAtMs >= activeBatchStartMs - 4 * 60 * 60 * 1000
      ) {
        selected.push(item);
        seenIds.add(item.id);
      }
    }

    // Fill the 8 slots from the current 24-hour batch slice
    for (let i = 0; i < pool.length && selected.length < batchSize; i++) {
      const candidate = pool[(startOffset + i) % pool.length];
      if (candidate && !seenIds.has(candidate.id)) {
        selected.push(candidate);
        seenIds.add(candidate.id);
      }
    }

    return {
      featuredItems: selected,
      activeHeroBatchNumber: currentBatchIdx + 1,
      totalHeroBatches: totalBatches,
      hoursUntilNextHeroBatch: hoursRemaining,
    };
  }, [catalog, cycleNowMs, heroCycleConfig]);

  const handleAdvanceHeroBatch = useCallback(async () => {
    const nextConfig = {
      epochMs: heroCycleConfig.epochMs,
      manualBatchOffset: (heroCycleConfig.manualBatchOffset || 0) + 1,
    };
    setHeroCycleConfig(nextConfig);
    setActiveHeroIndex(0);
    if (currentUser && isAdmin) {
      try {
        await setDoc(
          doc(db, 'ui_config', 'hero_cycle'),
          {
            ...nextConfig,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch {
        // Ignore
      }
    }
    showToast('Rotated Hero Banner to the next batch of 8 movies!');
  }, [heroCycleConfig, currentUser, isAdmin, showToast]);

  const handleResetHeroCycleNow = useCallback(async () => {
    const nextConfig = {
      epochMs: Date.now(),
      manualBatchOffset: 0,
    };
    setHeroCycleConfig(nextConfig);
    setCycleNowMs(Date.now());
    setActiveHeroIndex(0);
    if (currentUser && isAdmin) {
      try {
        await setDoc(
          doc(db, 'ui_config', 'hero_cycle'),
          {
            ...nextConfig,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch {
        // Ignore
      }
    }
    showToast(
      'Started fresh 24h / 28h Hero Banner cycle (8 movies per day) from right now!'
    );
  }, [currentUser, isAdmin, showToast]);

  const continueWatchingItems = useMemo(() => {
    const entries: { item: MediaItem; progress: WatchProgressEntry }[] = [];
    Object.values(watchProgressMap)
      .sort((a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0))
      .forEach((progress) => {
        if (completedIds.includes(progress.mediaId)) return;
        const found = catalog.find((c) => c.id === progress.mediaId);
        if (found) {
          entries.push({ item: found, progress });
        }
      });
    return entries;
  }, [catalog, watchProgressMap, completedIds]);

  const moviesList = useMemo(
    () => catalog.filter((i) => i.contentType === 'movie'),
    [catalog]
  );

  const showsList = useMemo(
    () => catalog.filter((i) => i.contentType === 'series'),
    [catalog]
  );

  // Filter out any completed items so watched titles never remain in Watchlist
  const activeWatchlistIds = useMemo(
    () => watchlistIds.filter((id) => !completedIds.includes(id)),
    [watchlistIds, completedIds]
  );

  const watchlistItems = useMemo(
    () => catalog.filter((item) => activeWatchlistIds.includes(item.id)),
    [catalog, activeWatchlistIds]
  );

  const relatedForSelected = useMemo(() => {
    if (!selectedMedia) return [];
    const sameGenre = catalog.filter(
      (item) =>
        item.id !== selectedMedia.id &&
        item.genres.some((g) => selectedMedia.genres.includes(g))
    );
    const others = catalog.filter(
      (item) =>
        item.id !== selectedMedia.id &&
        !sameGenre.some((s) => s.id === item.id)
    );
    return [...sameGenre, ...others].slice(0, 6);
  }, [catalog, selectedMedia]);

  // Optimized Genre Distribution: sorts genres by catalog count first so populated genres are highlighted
  const genreCountsMap = useMemo(() => {
    const counts: Record<string, number> = {};
    ALL_GENRES.forEach((g) => {
      counts[g] = 0;
    });
    catalog.forEach((item) => {
      item.genres.forEach((g) => {
        counts[g] = (counts[g] || 0) + 1;
      });
    });
    return counts;
  }, [catalog]);

  const orderedGenres = useMemo(() => {
    return [...ALL_GENRES].sort((a, b) => {
      const diff = (genreCountsMap[b] || 0) - (genreCountsMap[a] || 0);
      return diff !== 0 ? diff : ALL_GENRES.indexOf(a) - ALL_GENRES.indexOf(b);
    });
  }, [genreCountsMap]);

  // Optimized Multi-Token Relevance Search + Genre + ContentType + Sort
  const filteredSearchCatalog = useMemo(() => {
    let result = [...catalog];

    if (searchTypeFilter !== 'all') {
      result = result.filter((item) => item.contentType === searchTypeFilter);
    }

    if (selectedGenre !== 'All') {
      result = result.filter((item) =>
        item.genres.some(
          (g) => g.toLowerCase() === selectedGenre.toLowerCase()
        )
      );
    }

    const rawQuery = debouncedSearchQuery.trim().toLowerCase();
    const tokens = rawQuery.split(/\s+/).filter(Boolean);

    if (tokens.length > 0) {
      const scored = result
        .map((item) => {
          const titleLower = item.title.toLowerCase();
          const directorLower = item.directorOrCreator.toLowerCase();
          const synopsisLower = item.synopsis.toLowerCase();
          const genresLower = item.genres.map((g) => g.toLowerCase());
          const castLower = item.cast.map((c) => c.toLowerCase());
          const yearStr = String(item.releaseYear);

          let score = 0;
          let matchedAllTokens = true;

          for (const token of tokens) {
            let tokenMatched = false;
            if (titleLower === token) {
              score += 120;
              tokenMatched = true;
            } else if (titleLower.startsWith(token)) {
              score += 80;
              tokenMatched = true;
            } else if (titleLower.includes(token)) {
              score += 50;
              tokenMatched = true;
            }

            if (genresLower.some((g) => g.includes(token))) {
              score += 35;
              tokenMatched = true;
            }
            if (castLower.some((c) => c.includes(token))) {
              score += 30;
              tokenMatched = true;
            }
            if (directorLower.includes(token)) {
              score += 25;
              tokenMatched = true;
            }
            if (yearStr.includes(token)) {
              score += 20;
              tokenMatched = true;
            }
            if (synopsisLower.includes(token)) {
              score += 10;
              tokenMatched = true;
            }

            if (!tokenMatched) {
              matchedAllTokens = false;
              break;
            }
          }

          return { item, score, matchedAllTokens };
        })
        .filter((entry) => entry.matchedAllTokens && entry.score > 0);

      if (searchSortBy === 'relevance') {
        scored.sort((a, b) => b.score - a.score);
      }
      result = scored.map((entry) => entry.item);
    }

    if (searchSortBy === 'newest') {
      result.sort((a, b) => b.releaseYear - a.releaseYear);
    } else if (searchSortBy === 'popular') {
      result.sort((a, b) => (b.popularScore || 0) - (a.popularScore || 0));
    } else if (searchSortBy === 'title') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    }

    return result;
  }, [
    catalog,
    searchTypeFilter,
    selectedGenre,
    debouncedSearchQuery,
    searchSortBy,
  ]);

  // Build 2x2 Poster Grid Category Cards with Interactive Pagination & Accurate Genre Distribution
  const renderGenre2x2GridSection = (
    sectionTitle: string,
    sectionSubtitle?: string,
    showTop10Badge = false,
    filterContentType?: 'movie' | 'series'
  ) => {
    const pageSize = 5;
    const totalPages = Math.max(1, Math.ceil(orderedGenres.length / pageSize));
    const safePage = genrePageIndex % totalPages;
    const displayGenres = orderedGenres.slice(
      safePage * pageSize,
      safePage * pageSize + pageSize
    );

    const sourceList = filterContentType
      ? catalog.filter((i) => i.contentType === filterContentType)
      : catalog;

    return (
      <section className="space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2.5">
          <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white font-display">
            {sectionTitle}
          </h2>

          <div className="inline-flex items-center gap-2.5 p-1.5 rounded-xl bg-[#0F1117] border border-[#292C35] self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() =>
                setGenrePageIndex(
                  (prev) => (prev - 1 + totalPages) % totalPages
                )
              }
              className="w-8 h-8 rounded-lg bg-[#14161D] hover:bg-[#252832] border border-[#292C35] text-white flex items-center justify-center cursor-pointer transition-colors"
              aria-label="Previous genre page"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setGenrePageIndex(idx)}
                  className={`h-1 rounded-full transition-all cursor-pointer ${
                    idx === safePage
                      ? 'w-5 bg-[#FFC400]'
                      : 'w-3 bg-[#292C35] hover:bg-[#747784]'
                  }`}
                  aria-label={`Genre page ${idx + 1}`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                setGenrePageIndex((prev) => (prev + 1) % totalPages)
              }
              className="w-8 h-8 rounded-lg bg-[#14161D] hover:bg-[#252832] border border-[#292C35] text-white flex items-center justify-center cursor-pointer transition-colors"
              aria-label="Next genre page"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {displayGenres.map((genre) => {
            const matching = sourceList.filter((i) =>
              i.genres.includes(genre)
            );
            const fourPosters = matching.slice(0, 4);

            return (
              <div
                key={`${sectionTitle}-${genre}`}
                onClick={() => {
                  setSelectedGenre(genre);
                  if (filterContentType) {
                    setSearchTypeFilter(filterContentType);
                  } else {
                    setSearchTypeFilter('all');
                  }
                  handleNavigate('search');
                }}
                className="group rounded-xl bg-[#14161D] border border-[#292C35] hover:border-[#FFC400]/60 p-3 sm:p-3.5 flex flex-col justify-between gap-2.5 transition-all cursor-pointer cinema-card-shadow"
              >
                {/* 2x2 Poster Mosaic with Bottom Fade */}
                <div className="relative grid grid-cols-2 gap-2 aspect-square overflow-hidden rounded-lg bg-[#0F1117]">
                  {[0, 1, 2, 3].map((slotIdx) => {
                    const posterItem = fourPosters[slotIdx];
                    return (
                      <div
                        key={slotIdx}
                        className="w-full h-full overflow-hidden rounded-md bg-[#08090D]"
                      >
                        {posterItem ? (
                          <MediaArtwork
                            src={posterItem.posterUrl}
                            alt={posterItem.title}
                            item={posterItem}
                            aspectRatio="poster"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-[#252832] to-[#14161D] flex items-center justify-center text-[10px] font-semibold text-[#747784]">
                            {genre}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#14161D] via-[#14161D]/25 to-transparent pointer-events-none" />
                </div>

                {/* Bottom Genre Label + Count + Right Arrow */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="min-w-0">
                    {showTop10Badge && (
                      <span className="inline-block px-2 py-0.5 rounded bg-[#FFC400] text-[#08090D] text-[10px] font-bold mb-1">
                        Top 10 In
                      </span>
                    )}
                    <h3 className="text-sm sm:text-base font-semibold text-white group-hover:text-[#FFC400] transition-colors truncate">
                      {genre}
                    </h3>
                    <p className="text-[11px] text-[#747784]">
                      {matching.length}{' '}
                      {matching.length === 1 ? 'title' : 'titles'}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1 group-hover:text-[#FFC400] transition-all shrink-0" />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  // Reusable FAQ Section
  const renderFaqSection = () => (
    <section className="space-y-4" aria-label="Frequently Asked Questions">
      <h2 className="text-xl sm:text-2xl font-bold text-white font-display">
        FAQ
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-1">
        {ZAPPY_FAQS.map((faq) => {
          const isOpen = openFaqId === faq.num;
          return (
            <div key={faq.num} className="py-3 relative">
              <button
                type="button"
                onClick={() => setOpenFaqId(isOpen ? '' : faq.num)}
                className="w-full flex items-start justify-between gap-3 text-left cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <span className="w-10 h-10 rounded-xl bg-[#14161D] border border-[#292C35] text-[#FFC400] font-bold text-xs flex items-center justify-center shrink-0">
                    {faq.num}
                  </span>
                  <div className="space-y-1.5 pt-1.5">
                    <h3 className="text-sm sm:text-base font-medium text-white">
                      {faq.question}
                    </h3>
                    {isOpen && (
                      <p className="text-xs sm:text-sm text-[#A7A9B4] leading-relaxed pr-2">
                        {faq.answer}
                      </p>
                    )}
                  </div>
                </div>

                <span className="pt-2 text-[#FFC400] shrink-0">
                  {isOpen ? (
                    <Minus className="w-4 h-4" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                </span>
              </button>
              <div className="h-[1px] w-full sv-faq-divider mt-3" />
            </div>
          );
        })}
      </div>
    </section>
  );

  const navRailItems: { id: NavView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'myspace', label: 'My Space', icon: UserIcon },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'home', label: 'Home', icon: Home },
    { id: 'tv', label: 'TV Shows', icon: Tv },
    { id: 'movies', label: 'Movies', icon: Film },
    { id: 'categories', label: 'Categories', icon: Layers },
  ];

  const openSupportTicketsCount = mergedSupportMessages.filter(
    (m) => m.status === 'open'
  ).length;

  return (
    <div className="min-h-screen w-full bg-[#08090D] text-white flex flex-col md:pl-32 lg:pl-36 pb-20 md:pb-0 overflow-x-hidden transition-[padding] duration-300">
      {/* =========================================================
          ZAPPYFUN DESKTOP LEFT NAVIGATION RAIL (Full Logo Always Visible)
      ========================================================= */}
      <aside
        aria-label="Sidebar Navigation"
        className="hidden md:flex fixed left-0 top-0 bottom-0 z-40 w-32 lg:w-36 hover:w-60 bg-[#14161D]/95 backdrop-blur-2xl border-r border-[#292C35] transition-all duration-300 group flex-col justify-between py-5 px-3 select-none shadow-2xl"
      >
        {/* Top: Original ZappyFun Logo (Fully Visible) */}
        <div className="flex flex-col items-center group-hover:items-start gap-5 w-full">
          <button
            type="button"
            onClick={() => handleNavigate('home')}
            className="flex items-center justify-center group-hover:justify-start w-full px-1.5 py-1.5 rounded-2xl hover:bg-[#1F1B2B]/60 cursor-pointer transition-all active:scale-95 group/logo"
            title="ZappyFun Home"
          >
            <div className="w-11 h-11 rounded-2xl overflow-hidden shadow-lg shadow-black/80 shrink-0 border border-[#231E30] bg-black flex items-center justify-center p-0.5">
              <img
                src="/assets/aistudio/1792738076429_2_1a521405.jpg"
                alt="ZappyFun Play Button Logo"
                className="w-full h-full object-contain select-none"
              />
            </div>
            <span className="hidden group-hover:inline-block ml-3 font-display font-black text-lg tracking-tight text-white whitespace-nowrap">
              ZAPPY<span className="bg-gradient-to-r from-[#FFB800] via-[#FF5A36] to-[#FF168B] bg-clip-text text-transparent">FUN</span>
            </span>
          </button>

          {/* Navigation Links */}
          <nav className="w-full flex flex-col gap-1">
            {navRailItems.map((tab) => {
              const Icon = tab.icon;
              const isActive =
                activeView === tab.id ||
                (tab.id === 'movies' && activeView === 'movies_shows') ||
                (tab.id === 'home' && activeView === 'details');
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleNavigate(tab.id)}
                  className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#252832] text-white font-semibold border-l-2 border-[#FFC400] shadow-sm'
                      : 'text-[#A7A9B4] hover:text-white hover:bg-[#252832]/60'
                  }`}
                  title={tab.label}
                >
                  <Icon
                    className={`w-5 h-5 shrink-0 transition-colors ${
                      isActive ? 'text-[#FFC400]' : 'group-hover:text-[#FFD54A]'
                    }`}
                  />
                  <span className="truncate text-xs font-semibold">
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom: Admin Studio, Visual UI Editor, and Profile */}
        <div className="w-full flex flex-col gap-1.5 pt-3 border-t border-[#292C35]">
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => openAdminStudio(null, 'catalog')}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl bg-[#FFC400]/15 hover:bg-[#FFC400]/25 border border-[#FFC400]/30 text-[#FFC400] transition-colors cursor-pointer"
                title="Admin Studio (Catalog & Content Manager)"
              >
                <SlidersHorizontal className="w-4 h-4 shrink-0" />
                <span className="truncate text-xs font-bold">
                  Admin Studio
                </span>
              </button>

              <button
                type="button"
                onClick={() => setVisualEditorActive((prev) => !prev)}
                className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-xl transition-colors cursor-pointer ${
                  visualEditorActive
                    ? 'bg-[#FFC400] text-[#08090D] font-bold'
                    : 'hover:bg-[#252832] text-[#A7A9B4] hover:text-white'
                }`}
                title="Visual UI Component Editor"
              >
                <Palette
                  className={`w-4 h-4 shrink-0 ${
                    visualEditorActive ? 'text-[#08090D]' : 'text-[#FFC400]'
                  }`}
                />
                <span className="truncate text-xs font-semibold">
                  {visualEditorActive ? 'Exit Editor' : 'Edit UI'}
                </span>
              </button>
            </>
          )}

          {currentUser ? (
            <button
              type="button"
              onClick={() => handleNavigate('myspace')}
              className="flex items-center gap-2.5 w-full px-2 py-2 rounded-xl hover:bg-[#252832] transition-colors cursor-pointer"
              title={currentUser.displayName || currentUser.email || 'My Space'}
            >
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt="User"
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-[#FFC400]/40"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#FFC400]/20 text-[#FFC400] font-bold text-xs flex items-center justify-center shrink-0 border border-[#FFC400]/30">
                  {currentUser.email?.slice(0, 2).toUpperCase() || 'ME'}
                </div>
              )}
              <div className="text-left truncate min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">
                  {currentUser.displayName || currentUser.email?.split('@')[0]}
                </p>
                <p className="text-[10px] text-[#747784] truncate">
                  {isAdmin ? 'Admin' : 'My Space'}
                </p>
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleOpenAuthModal('signin')}
              className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-xl bg-[#FFC400] hover:bg-[#FFD54A] text-[#08090D] font-bold transition-colors cursor-pointer shadow-md"
              title="Sign In"
            >
              <LogIn className="w-4 h-4 shrink-0 text-[#08090D]" />
              <span className="truncate text-xs font-bold">
                Sign In
              </span>
            </button>
          )}
        </div>
      </aside>

      {/* =========================================================
          MOBILE TOP HEADER (Original ZappyFun Logo, Search, Admin Pill, Profile)
      ========================================================= */}
      <header className="md:hidden sticky top-0 z-40 w-full bg-[#14161D]/95 backdrop-blur-xl border-b border-[#292C35] px-4 h-14 flex items-center justify-between">
        <button
          type="button"
          onClick={() => handleNavigate('home')}
          className="flex items-center gap-2.5 cursor-pointer py-1"
          title="ZappyFun Home"
        >
          <div className="w-9 h-9 rounded-xl overflow-hidden shadow-md shadow-black/80 shrink-0 border border-[#231E30] bg-black flex items-center justify-center p-0.5">
            <img
              src="/assets/aistudio/1792738076429_2_1a521405.jpg"
              alt="ZappyFun"
              className="w-full h-full object-contain"
            />
          </div>
          <span className="font-display font-black text-base tracking-tight text-white">
            ZAPPY<span className="bg-gradient-to-r from-[#FFB800] via-[#FF5A36] to-[#FF168B] bg-clip-text text-transparent">FUN</span>
          </span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleNavigate('search')}
            className="w-9 h-9 rounded-lg bg-[#252832] border border-[#292C35] flex items-center justify-center text-white hover:text-[#FFC400] cursor-pointer transition-colors"
            aria-label="Search"
          >
            <Search className="w-4 h-4" />
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => openAdminStudio(null, 'catalog')}
              className="px-3 py-1.5 rounded-lg bg-[#FFC400] hover:bg-[#FFD54A] text-[#08090D] text-[11px] font-bold cursor-pointer"
            >
              Admin
            </button>
          )}

          <button
            type="button"
            onClick={() => handleNavigate('myspace')}
            className="w-9 h-9 rounded-full overflow-hidden bg-[#252832] border border-[#292C35] flex items-center justify-center cursor-pointer"
            aria-label="Profile"
          >
            {currentUser?.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : currentUser ? (
              <span className="text-[10px] font-bold text-[#FFC400]">
                {currentUser.email?.slice(0, 2).toUpperCase()}
              </span>
            ) : (
              <UserIcon className="w-4 h-4 text-[#FFC400]" />
            )}
          </button>
        </div>
      </header>

      {/* =========================================================
          MOBILE BOTTOM NAVIGATION RAIL
      ========================================================= */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-[#14161D]/95 backdrop-blur-xl border-t border-[#292C35] flex items-center justify-around px-2 select-none safe-bottom-nav"
      >
        {[
          { id: 'home', label: 'Home', icon: Home },
          { id: 'search', label: 'Search', icon: Search },
          { id: 'tv', label: 'TV', icon: Tv },
          { id: 'movies', label: 'Movies', icon: Film },
          { id: 'categories', label: 'Genres', icon: Layers },
          { id: 'myspace', label: 'My Space', icon: UserIcon },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive =
            activeView === tab.id ||
            (tab.id === 'movies' && activeView === 'movies_shows') ||
            (tab.id === 'home' && activeView === 'details');
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleNavigate(tab.id as NavView)}
              className={`min-h-[44px] min-w-[48px] flex flex-col items-center justify-center py-1 px-2 rounded-lg cursor-pointer transition-colors ${
                isActive ? 'text-[#FFC400]' : 'text-[#A7A9B4] hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium mt-0.5">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Session Toast */}
      <AnimatePresence>
        {sessionToast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-2"
          >
            <div className="px-4 py-3 rounded-xl bg-[#14161D] border border-[#FFC400]/50 text-xs text-white flex items-center justify-between shadow-xl">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#FFC400] shrink-0" />
                <span>{sessionToast}</span>
              </span>
              <button
                type="button"
                onClick={() => setSessionToast(null)}
                className="text-[#A7A9B4] hover:text-white cursor-pointer"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN PAGE CONTENT */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-5 lg:px-6 pt-2 sm:pt-3 pb-6 space-y-6 sm:space-y-8">
        {activeView === 'legal' ? (
          <LegalDocumentPage
            section={activeLegalSection}
            legalPages={legalPages}
            adsEnabled={adsEnabled}
            isAdmin={isAdmin}
            onToggleAds={() => setAdsEnabled((prev) => !prev)}
            onSelectSection={(sec) => openLegalPage(sec)}
            onBackHome={() =>
              handleNavigate(
                previousView &&
                  previousView !== 'legal' &&
                  previousView !== 'details'
                  ? previousView
                  : 'home'
              )
            }
            onOpenSupport={() => handleNavigate('support')}
            onSaveLegalPages={handleSaveLegalPages}
          />
        ) : isLoadingCatalog ? (
          <div className="space-y-5 animate-pulse" aria-busy="true" aria-label="Loading catalog">
            <div className="w-full h-[280px] sm:h-[360px] rounded-2xl bg-[#14161D] border border-[#292C35]" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
              {Array.from({ length: 5 }, (_, i) => (
                <div
                  key={i}
                  className="aspect-[2/3] rounded-2xl bg-[#14161D] border border-[#292C35]"
                />
              ))}
            </div>
          </div>
        ) : (
        <AnimatePresence mode="wait">
          {/* =========================================================
              MOVIE & SHOW DETAILS + STREAMING PLAYER PAGE
          ========================================================= */}
          {activeView === 'details' && selectedMedia ? (
            <div key={`details-${selectedMedia.id}`}>
              <DetailsView
                item={selectedMedia}
                relatedItems={relatedForSelected}
                watchlistIds={activeWatchlistIds}
                inWatchlist={activeWatchlistIds.includes(selectedMedia.id)}
                isCompleted={completedIds.includes(selectedMedia.id)}
                autoPlayInitial={autoPlayOnOpen}
                adsEnabled={adsEnabled}
                isAdmin={isAdmin}
                isPreviewDraft={Boolean(
                  previewDraftItem && selectedMedia.id === previewDraftItem.id
                )}
                isPublishingDraft={isPublishingDraft}
                initialSeason={
                  resumeSavedOnOpen
                    ? watchProgressMap[selectedMedia.id]?.seasonNumber || 1
                    : 1
                }
                initialEpisode={
                  resumeSavedOnOpen
                    ? watchProgressMap[selectedMedia.id]?.episodeNumber || 1
                    : 1
                }
                savedSeason={watchProgressMap[selectedMedia.id]?.seasonNumber}
                savedEpisode={watchProgressMap[selectedMedia.id]?.episodeNumber}
                hasProgress={Boolean(watchProgressMap[selectedMedia.id])}
                onBack={() => {
                  setPreviewDraftItem(null);
                  setActiveView(
                    previousView && previousView !== 'details'
                      ? previousView
                      : 'home'
                  );
                }}
                onSelectMedia={(item, auto, resumeSaved) => {
                  setPreviewDraftItem(null);
                  handleSelectMedia(item, auto, resumeSaved);
                }}
                onToggleWatchlist={handleToggleWatchlist}
                onMarkWatched={handleWatchComplete}
                onUpdateProgress={(seasonNum, epNum, pct, remMins) =>
                  handleUpdateWatchProgress(
                    selectedMedia,
                    seasonNum,
                    epNum,
                    pct,
                    remMins
                  )
                }
                onStartOver={() => {
                  handleUpdateWatchProgress(selectedMedia, 1, 1, 5);
                  showToast(`Restarted ${selectedMedia.title} from the beginning.`);
                }}
                onSelectGenre={(genre) => {
                  setPreviewDraftItem(null);
                  setSelectedGenre(genre);
                  setActiveView('search');
                }}
                onToggleAds={() => setAdsEnabled((prev) => !prev)}
                onOpenAdPolicy={() => openLegalPage('advertising')}
                onOpenAdminStudio={(mediaItem) =>
                  openAdminStudio(mediaItem, 'catalog')
                }
                onReturnToAdminStudio={() => {
                  const draft = previewDraftItem || selectedMedia;
                  openAdminStudio(draft, 'catalog');
                }}
                onPublishPreviewDraft={
                  previewDraftItem
                    ? () => handlePublishDraftFromPreview(previewDraftItem)
                    : undefined
                }
                onAutoSyncEpisodes={handleAutoSyncEpisodes}
              />
            </div>
          ) : /* =========================================================
              OPTIMIZED SEARCH & GENRE DISTRIBUTION VIEW
          ========================================================= */
          activeView === 'search' || searchBarOpen ? (
            <motion.section
              key="search-view"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-5"
            >
              <div className="rounded-2xl bg-[#14161D] border border-[#292C35] p-4 sm:p-5 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <h1 className="text-lg sm:text-2xl font-bold text-white font-display">
                      Search
                    </h1>
                    <span className="text-xs font-semibold text-[#A7A9B4] tabular-nums">
                      ({filteredSearchCatalog.length})
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {(searchQuery.trim() !== '' ||
                      selectedGenre !== 'All' ||
                      searchTypeFilter !== 'all' ||
                      searchSortBy !== 'relevance') && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setDebouncedSearchQuery('');
                          setSelectedGenre('All');
                          setSearchTypeFilter('all');
                          setSearchSortBy('relevance');
                        }}
                        className="h-9 px-3 rounded-xl bg-[#252832] hover:bg-[#FFC400] text-[#FFC400] hover:text-[#08090D] border border-[#FFC400]/40 text-xs font-bold cursor-pointer transition-colors"
                      >
                        Reset
                      </button>
                    )}

                    {/* Content Type Filter */}
                    <div className="inline-flex items-center p-1 rounded-xl bg-[#08090D] border border-[#292C35]">
                      {(
                        [
                          { id: 'all', label: 'All' },
                          { id: 'movie', label: 'Movies' },
                          { id: 'series', label: 'TV Shows' },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setSearchTypeFilter(tab.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                            searchTypeFilter === tab.id
                              ? 'bg-[#FFC400] text-[#08090D]'
                              : 'text-[#A7A9B4] hover:text-white'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Sort Order */}
                    <select
                      value={searchSortBy}
                      onChange={(e) =>
                        setSearchSortBy(
                          e.target.value as
                            | 'relevance'
                            | 'newest'
                            | 'popular'
                            | 'title'
                        )
                      }
                      aria-label="Sort results"
                      className="h-9 px-3 rounded-xl bg-[#08090D] border border-[#292C35] text-xs font-semibold text-white focus:outline-none focus:border-[#FFC400]"
                    >
                      <option value="relevance">Relevance</option>
                      <option value="popular">Top Rated</option>
                      <option value="newest">Newest</option>
                      <option value="title">Title (A-Z)</option>
                    </select>
                  </div>
                </div>

                <div className="relative">
                  <Search className="w-5 h-5 text-[#A7A9B4] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Movies, shows, cast, or genres"
                    className="w-full h-12 sm:h-13 pl-12 pr-12 rounded-xl bg-[#08090D] border border-[#292C35] text-sm sm:text-base text-white placeholder:text-[#747784] focus:outline-none focus:border-[#FFC400] transition-colors"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setDebouncedSearchQuery('');
                      }}
                      aria-label="Clear search query"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#A7A9B4] hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Genre Distribution Bar with Live Counts */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedGenre('All')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                      selectedGenre === 'All'
                        ? 'bg-[#FFC400] text-[#08090D]'
                        : 'bg-[#08090D] border border-[#292C35] text-[#A7A9B4] hover:text-white hover:border-[#FFC400]/50'
                    }`}
                  >
                    <span>All Genres</span>
                    <span className="opacity-75">({catalog.length})</span>
                  </button>
                  {orderedGenres.map((g) => {
                    const count = genreCountsMap[g] || 0;
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setSelectedGenre(g)}
                        className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                          selectedGenre === g
                            ? 'bg-[#FFC400] text-[#08090D]'
                            : 'bg-[#08090D] border border-[#292C35] text-[#A7A9B4] hover:text-white hover:border-[#FFC400]/50'
                        }`}
                      >
                        <span>{g}</span>
                        <span className="opacity-75">({count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {filteredSearchCatalog.length === 0 ? (
                <div className="rounded-2xl bg-[#14161D] border border-[#292C35] p-10 text-center max-w-lg mx-auto space-y-4">
                  <p className="text-base font-bold text-white">
                    No matching titles found
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setDebouncedSearchQuery('');
                      setSelectedGenre('All');
                      setSearchTypeFilter('all');
                      setSearchSortBy('relevance');
                    }}
                    className="px-5 py-2.5 rounded-lg bg-[#FFC400] hover:bg-[#FFD54A] text-[#08090D] text-xs font-bold cursor-pointer"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
                  {filteredSearchCatalog.map((item) => (
                    <MovieCard
                      key={item.id}
                      item={item}
                      inWatchlist={activeWatchlistIds.includes(item.id)}
                      onSelect={handleSelectMedia}
                      onToggleWatchlist={handleToggleWatchlist}
                    />
                  ))}
                </div>
              )}
            </motion.section>
          ) : /* =========================================================
              WATCHLIST VIEW (Automatically excludes fully watched titles)
          ========================================================= */
          activeView === 'watchlist' ? (
            <motion.section
              key="watchlist-view"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-5"
            >
              <h1 className="text-xl sm:text-3xl font-bold text-white font-display">
                Watchlist ({watchlistItems.length})
              </h1>

              {watchlistItems.length === 0 ? (
                <div className="rounded-2xl bg-[#14161D] border border-[#292C35] p-8 text-center max-w-lg mx-auto space-y-3">
                  <Bookmark className="w-9 h-9 text-[#FFC400] mx-auto" />
                  <h2 className="text-base font-bold text-white">
                    No Saved Titles
                  </h2>
                  <button
                    type="button"
                    onClick={() => handleNavigate('movies_shows')}
                    className="px-5 py-2.5 rounded-lg bg-[#FFC400] hover:bg-[#FFD54A] text-[#08090D] text-xs font-bold cursor-pointer"
                  >
                    Browse Catalog
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                  {watchlistItems.map((item) => (
                    <MovieCard
                      key={item.id}
                      item={item}
                      inWatchlist={activeWatchlistIds.includes(item.id)}
                      onSelect={handleSelectMedia}
                      onToggleWatchlist={handleToggleWatchlist}
                    />
                  ))}
                </div>
              )}
            </motion.section>
          ) : /* =========================================================
              ZAPPYFUN VIEW: MOVIES
          ========================================================= */
          activeView === 'movies' ? (
            <motion.section
              key="movies-view"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-xl sm:text-3xl font-black text-white font-display tracking-tight">
                  Movies
                </h1>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => openAdminStudio(null, 'catalog')}
                    className="px-4 py-2 rounded-xl bg-[#FFC400] hover:bg-[#FFD54A] text-[#08090D] text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Movies</span>
                  </button>
                )}
              </div>

              {moviesList.length === 0 ? (
                <div className="rounded-2xl bg-[#14161D] border border-[#292C35] p-8 text-center max-w-xl mx-auto space-y-3">
                  <Film className="w-10 h-10 text-[#FFC400] mx-auto opacity-80" />
                  <h2 className="text-lg font-bold text-white">
                    No Movies Available
                  </h2>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => openAdminStudio(null, 'catalog')}
                      className="px-5 py-2 rounded-xl bg-[#FFC400] hover:bg-[#FFD54A] text-[#08090D] text-xs font-bold cursor-pointer"
                    >
                      Open Admin Studio
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  <CarouselRow
                    title="Top 10 Movies"
                    items={moviesList.slice(0, 10)}
                    watchlistIds={activeWatchlistIds}
                    isTop10Row={true}
                    onSelectMedia={handleSelectMedia}
                    onToggleWatchlist={handleToggleWatchlist}
                  />

                  <div className="space-y-3">
                    <h2 className="text-lg sm:text-xl font-bold text-white font-display">
                      All Movies ({moviesList.length})
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                      {moviesList.map((item) => (
                        <MovieCard
                          key={item.id}
                          item={item}
                          inWatchlist={activeWatchlistIds.includes(item.id)}
                          onSelect={handleSelectMedia}
                          onToggleWatchlist={handleToggleWatchlist}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.section>
          ) : /* =========================================================
              ZAPPYFUN VIEW: TV SHOWS
          ========================================================= */
          activeView === 'tv' ? (
            <motion.section
              key="tv-view"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-xl sm:text-3xl font-black text-white font-display tracking-tight">
                  TV Shows
                </h1>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => openAdminStudio(null, 'catalog')}
                    className="px-4 py-2 rounded-xl bg-[#FFC400] hover:bg-[#FFD54A] text-[#08090D] text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Shows</span>
                  </button>
                )}
              </div>

              {showsList.length === 0 ? (
                <div className="rounded-2xl bg-[#14161D] border border-[#292C35] p-8 text-center max-w-xl mx-auto space-y-3">
                  <Tv className="w-10 h-10 text-[#FFC400] mx-auto opacity-80" />
                  <h2 className="text-lg font-bold text-white">
                    No TV Shows Available
                  </h2>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => openAdminStudio(null, 'catalog')}
                      className="px-5 py-2 rounded-xl bg-[#FFC400] hover:bg-[#FFD54A] text-[#08090D] text-xs font-bold cursor-pointer"
                    >
                      Open Admin Studio
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  <CarouselRow
                    title="Top 10 Series"
                    items={showsList.slice(0, 10)}
                    watchlistIds={activeWatchlistIds}
                    isTop10Row={true}
                    onSelectMedia={handleSelectMedia}
                    onToggleWatchlist={handleToggleWatchlist}
                  />

                  <div className="space-y-3">
                    <h2 className="text-lg sm:text-xl font-bold text-white font-display">
                      All TV Shows ({showsList.length})
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                      {showsList.map((item) => (
                        <MovieCard
                          key={item.id}
                          item={item}
                          inWatchlist={activeWatchlistIds.includes(item.id)}
                          onSelect={handleSelectMedia}
                          onToggleWatchlist={handleToggleWatchlist}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.section>
          ) : /* =========================================================
              ZAPPYFUN VIEW: CATEGORIES & GENRE HUB
          ========================================================= */
          activeView === 'categories' ? (
            <motion.section
              key="categories-view"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-5"
            >
              <h1 className="text-xl sm:text-3xl font-black text-white font-display tracking-tight flex items-center gap-2.5">
                <Layers className="w-7 h-7 text-[#FFC400]" />
                <span>Categories</span>
              </h1>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {ALL_GENRES.map((genre) => {
                  const count = catalog.filter((i) => i.genres.includes(genre)).length;
                  return (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => {
                        setSelectedGenre(genre);
                        setActiveView('search');
                      }}
                      className="relative h-24 sm:h-28 rounded-2xl overflow-hidden bg-gradient-to-br from-[#252832] to-[#14161D] border border-[#292C35] hover:border-[#FFC400] p-4 text-left flex flex-col justify-between transition-all group cursor-pointer shadow-lg hover:shadow-[#FFC400]/10"
                    >
                      <div className="flex items-center justify-between">
                        <span className="w-2 h-2 rounded-full bg-[#FFC400]" />
                        <span className="text-[11px] font-bold text-[#A7A9B4]">
                          {count} {count === 1 ? 'title' : 'titles'}
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-[#FFC400] transition-colors">
                        {genre}
                      </h3>
                    </button>
                  );
                })}
              </div>
            </motion.section>
          ) : /* =========================================================
              ZAPPYFUN VIEW: MY SPACE (Dashboard, Watchlist, Admin Controls)
          ========================================================= */
          activeView === 'myspace' ? (
            <motion.section
              key="myspace-view"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-6"
            >
              {/* Profile Card */}
              <div className="rounded-2xl bg-[#14161D] border border-[#292C35] p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {currentUser?.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt="Profile"
                      className="w-16 h-16 rounded-2xl object-cover ring-2 ring-[#FFC400]/40"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FFC400] to-[#FFD54A] text-[#08090D] font-black text-xl flex items-center justify-center shadow-lg">
                      {currentUser?.email ? currentUser.email.slice(0, 2).toUpperCase() : 'ZF'}
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl sm:text-2xl font-bold text-white font-display">
                        {currentUser?.displayName || currentUser?.email || 'Guest Viewer'}
                      </h2>
                      {isAdmin && (
                        <span className="px-2.5 py-0.5 rounded-full bg-[#FFC400] text-[#08090D] text-[10px] font-black uppercase tracking-wider">
                          Admin
                        </span>
                      )}
                    </div>
                    {currentUser?.email && (
                      <p className="text-xs text-[#A7A9B4] flex flex-wrap items-center gap-2">
                        <span>{currentUser.email}</span>
                        {currentUser?.uid && getCachedUserProfile(currentUser.uid)?.age && (
                          <span className="px-2 py-0.5 rounded-full bg-[#1A1D27] border border-[#2B3142] text-[10px] font-semibold text-[#FFC400]">
                            Age {getCachedUserProfile(currentUser.uid)?.age}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {!currentUser ? (
                    <button
                      type="button"
                      onClick={() => handleOpenAuthModal('signin')}
                      className="px-5 py-2.5 rounded-xl bg-[#FFC400] hover:bg-[#FFD54A] text-[#08090D] text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-[#FFC400]/20"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Sign In</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="px-4 py-2 rounded-xl bg-[#252832] hover:bg-[#292C35] border border-[#292C35] text-white text-xs font-semibold flex items-center gap-2 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-[#FFC400]" />
                      <span>Sign Out</span>
                    </button>
                  )}
                </div>
              </div>

              {/* ADMIN CONTROL HUB */}
              {isAdmin && (
                <div className="rounded-2xl bg-gradient-to-br from-[#252832]/80 via-[#14161D] to-[#14161D] border border-[#FFC400]/30 p-6 sm:p-8 space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-[#FFC400]" />
                      <span>Admin Studio</span>
                    </h3>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openAdminStudio(null, 'catalog')}
                        className="px-4 py-2 rounded-xl bg-[#FFC400] hover:bg-[#FFD54A] text-[#08090D] text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-[#FFC400]/20"
                      >
                        <SlidersHorizontal className="w-4 h-4" />
                        <span>Open Admin Studio</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openAdminStudio(null, 'legal')}
                        className="px-4 py-2 rounded-xl bg-[#252832] hover:bg-[#292C35] border border-[#FFC400]/40 text-[#FFC400] text-xs font-bold flex items-center gap-2 cursor-pointer"
                      >
                        <FileText className="w-4 h-4" />
                        <span>Edit Legal &amp; Policies</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setVisualEditorActive(true)}
                        className="px-4 py-2 rounded-xl bg-[#252832] hover:bg-[#292C35] border border-[#292C35] text-white text-xs font-semibold flex items-center gap-2 cursor-pointer"
                      >
                        <Palette className="w-4 h-4 text-[#FFC400]" />
                        <span>Visual UI Editor</span>
                      </button>

                      {confirmingPurgeCatalog ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isPurgingCatalog}
                            onClick={handleClearEntireCatalog}
                            className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>
                              {isPurgingCatalog
                                ? 'Purging...'
                                : 'Confirm Purge All'}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingPurgeCatalog(false)}
                            className="px-2.5 py-2 rounded-xl bg-[#252832] hover:bg-[#292C35] border border-[#292C35] text-xs font-semibold text-[#A7A9B4] hover:text-white cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={isPurgingCatalog}
                          onClick={() => setConfirmingPurgeCatalog(true)}
                          className="px-4 py-2 rounded-xl bg-[#252832] hover:bg-red-600/30 border border-[#292C35] hover:border-red-500/40 text-[#A7A9B4] hover:text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                          title="Remove every movie and TV show from the database"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                          <span>
                            {isPurgingCatalog
                              ? 'Purging...'
                              : 'Remove Every Movie & TV Show'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Hero Cycle Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-[#08090D] border border-[#292C35] text-xs">
                    <div>
                      <span className="text-[#747784] block">Hero Rotation Cycle</span>
                      <span className="font-bold text-white">Daily 8 Movies (Batch #{activeHeroBatchNumber})</span>
                    </div>
                    <div>
                      <span className="text-[#747784] block">Tenure Window</span>
                      <span className="font-bold text-white">28 Hours per Spotlight Movie</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[#747784] block">Next Daily Batch</span>
                        <span className="font-bold text-[#FFC400]">{hoursUntilNextHeroBatch}h remaining</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleAdvanceHeroBatch}
                        className="px-2.5 py-1 rounded-lg bg-[#252832] hover:bg-[#FFC400] text-white hover:text-[#08090D] text-[11px] font-bold cursor-pointer transition-colors"
                      >
                        Rotate Now
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Saved Watchlist Shelf */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white font-display flex items-center gap-2">
                    <Bookmark className="w-5 h-5 text-[#FFC400]" />
                    <span>My Watchlist ({watchlistItems.length})</span>
                  </h3>
                  {watchlistItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleNavigate('watchlist')}
                      className="text-xs text-[#FFC400] hover:text-[#FFD54A] cursor-pointer font-semibold"
                    >
                      View All
                    </button>
                  )}
                </div>

                {watchlistItems.length === 0 ? (
                  <div className="rounded-2xl bg-[#14161D] border border-[#292C35] p-8 text-center max-w-md mx-auto space-y-3">
                    <p className="text-xs sm:text-sm text-[#A7A9B4]">
                      No saved titles
                    </p>
                    <button
                      type="button"
                      onClick={() => handleNavigate('movies')}
                      className="px-4 py-2 rounded-xl bg-[#FFC400] hover:bg-[#FFD54A] text-[#08090D] text-xs font-bold cursor-pointer"
                    >
                      Browse Movies
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                    {watchlistItems.slice(0, 5).map((item) => (
                      <MovieCard
                        key={item.id}
                        item={item}
                        inWatchlist={true}
                        onSelect={handleSelectMedia}
                        onToggleWatchlist={handleToggleWatchlist}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Continue Watching Shelf */}
              {continueWatchingItems.length > 0 && (
                <ContinueWatchingRow
                  items={continueWatchingItems}
                  onSelectMedia={handleSelectMedia}
                  onSeeAll={() => handleNavigate('movies_shows')}
                  onRemoveProgress={handleRemoveWatchProgress}
                />
              )}

              {/* App Preferences & Legal / Help */}
              <div className="rounded-2xl bg-[#14161D] border border-[#292C35] p-5 sm:p-6 space-y-4">
                <h3 className="text-base font-bold text-white font-display">
                  Preferences, Legal &amp; Contact
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setAdsEnabled((prev) => !prev)}
                    className="p-4 rounded-xl bg-[#08090D] border border-[#292C35] text-left flex items-center justify-between cursor-pointer hover:border-[#FFC400]/50 transition-colors"
                  >
                    <div>
                      <p className="text-xs font-bold text-white">Display Preferences</p>
                      <p className="text-[11px] text-[#A7A9B4]">{adsEnabled ? 'Standard Mode' : 'Clean Mode'}</p>
                    </div>
                    <span className={`w-3 h-3 rounded-full shrink-0 ${adsEnabled ? 'bg-[#FFC400]' : 'bg-[#747784]'}`} />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNavigate('support')}
                    className="p-4 rounded-xl bg-[#08090D] border border-[#292C35] text-left flex items-center justify-between cursor-pointer hover:border-[#FFC400]/50 transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold text-white">Support &amp; Contact</p>
                      <p className="text-[11px] text-[#FFC400] truncate">
                        {legalPages.contactEmail || OFFICIAL_CONTACT_EMAIL}
                      </p>
                    </div>
                    <MessageSquare className="w-4 h-4 text-[#FFC400] shrink-0" />
                  </button>

                  <a
                    href="/Terms-of-use"
                    onClick={(e) => {
                      e.preventDefault();
                      openLegalPage('terms');
                    }}
                    className="p-4 rounded-xl bg-[#08090D] border border-[#292C35] text-left flex items-center justify-between cursor-pointer hover:border-[#FFC400]/50 transition-colors"
                  >
                    <div>
                      <p className="text-xs font-bold text-white">Terms &amp; Privacy Policy</p>
                      <p className="text-[11px] text-[#A7A9B4]">/Terms-of-use · /Privacy-policy</p>
                    </div>
                    <FileText className="w-4 h-4 text-[#FFC400] shrink-0" />
                  </a>
                </div>
              </div>

              {/* Account & Data Privacy Controls (Self-Service Account Deletion + Local Data Clear) */}
              <div className="rounded-2xl bg-[#14161D] border border-[#292C35] p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#FFC400]" />
                      <span>Account &amp; Personal Data Controls</span>
                    </h3>
                    <p className="text-xs text-[#A7A9B4] mt-0.5">
                      Manage your local browser watch data or permanently delete your ZappyFun account and cloud watchlist.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleClearLocalViewerDataOnly}
                      className="px-3.5 py-2 rounded-xl bg-[#08090D] hover:bg-[#252832] border border-[#292C35] text-xs font-semibold text-[#D4D6DF] hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-[#FFC400]" />
                      <span>Clear Local Watch History</span>
                    </button>

                    {currentUser && !showDeleteAccountConfirm && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowDeleteAccountConfirm(true);
                          setDeleteAccountError(null);
                          setDeleteAccountSuccessBanner(null);
                        }}
                        className="px-4 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-300 hover:text-red-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Account &amp; Data</span>
                      </button>
                    )}
                  </div>
                </div>

                {deleteAccountSuccessBanner && (
                  <div
                    role="status"
                    className="rounded-xl bg-emerald-500/10 border border-emerald-500/40 p-4 flex items-start gap-3 text-xs text-emerald-200"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold text-white">
                        Account &amp; Personal Data Deleted
                      </p>
                      <p className="leading-relaxed">
                        {deleteAccountSuccessBanner}
                      </p>
                    </div>
                  </div>
                )}

                {currentUser && showDeleteAccountConfirm && (
                  <div className="rounded-xl bg-[#08090D] border border-red-500/40 p-4 sm:p-5 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div className="space-y-1.5">
                        <h4 className="text-sm font-bold text-white">
                          Permanently Delete Your ZappyFun Account ({currentUser.email})?
                        </h4>
                        <p className="text-xs text-[#A7A9B4] leading-relaxed">
                          This action is permanent and cannot be undone. Please review what will be removed immediately and what requires a separate support request:
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="rounded-xl bg-[#14161D] border border-[#292C35] p-3.5 space-y-1.5">
                        <span className="font-bold text-emerald-400 block">
                          Deleted Immediately by Self-Service:
                        </span>
                        <ul className="list-disc pl-4 space-y-1 text-[#D4D6DF]">
                          <li>
                            Your Cloud Firestore watchlist documents (<code className="text-[#FFC400]">/watchlists</code> where <code className="text-[#FFC400]">ownerId == {currentUser.uid.slice(0, 8)}…</code>).
                          </li>
                          <li>
                            Your browser&apos;s local watchlist (<code className="text-[#FFC400]">zappy_watchlist_v2</code>), completed titles (<code className="text-[#FFC400]">zappy_completed_v1</code>), and Continue Watching progress (<code className="text-[#FFC400]">zappy_watch_progress_v2</code>).
                          </li>
                          <li>
                            Your Firebase Authentication user account (<code className="text-[#FFC400]">{currentUser.email}</code>).
                          </li>
                        </ul>
                      </div>

                      <div className="rounded-xl bg-[#14161D] border border-[#292C35] p-3.5 space-y-1.5">
                        <span className="font-bold text-[#FFC400] block">
                          Requires Separate Deletion Request:
                        </span>
                        <ul className="list-disc pl-4 space-y-1 text-[#D4D6DF]">
                          <li>
                            Previously submitted support messages stored in <code className="text-[#FFC400]">/support_messages</code> or server memory cannot be self-deleted by client accounts (to protect other users&apos; support tickets). Email{' '}
                            <a
                              href={`mailto:${legalPages.contactEmail || OFFICIAL_CONTACT_EMAIL}`}
                              className="text-[#FFC400] underline font-semibold"
                            >
                              {legalPages.contactEmail || OFFICIAL_CONTACT_EMAIL}
                            </a>{' '}
                            to request support ticket erasure.
                          </li>
                          <li>
                            Third-party embedded player (<code className="text-[#FFC400]">vidly.pro</code>) browser storage is governed by that third-party domain and can be cleared via your browser settings.
                          </li>
                        </ul>
                      </div>
                    </div>

                    {deleteAccountError && (
                      <div
                        role="alert"
                        className="rounded-xl bg-red-500/10 border border-red-500/40 p-3.5 text-xs text-red-200 leading-relaxed"
                      >
                        {deleteAccountError}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
                      <button
                        type="button"
                        disabled={isDeletingAccount}
                        onClick={() => {
                          setShowDeleteAccountConfirm(false);
                          setDeleteAccountNeedsReauth(false);
                          setDeleteAccountError(null);
                        }}
                        className="px-4 py-2 rounded-xl bg-[#14161D] hover:bg-[#252832] border border-[#292C35] text-xs font-semibold text-[#A7A9B4] hover:text-white cursor-pointer disabled:opacity-50"
                      >
                        Cancel
                      </button>

                      {deleteAccountNeedsReauth ? (
                        <div className="flex flex-col sm:flex-row items-center gap-2">
                          <input
                            type="password"
                            placeholder="Enter account password"
                            value={deleteAccountPassword}
                            onChange={(e) => setDeleteAccountPassword(e.target.value)}
                            className="px-3 py-1.5 rounded-xl bg-[#08090D] border border-[#292C35] text-xs text-white placeholder-[#5A5E70] focus:border-[#FFC400]"
                          />
                          <button
                            type="button"
                            disabled={isDeletingAccount || !deleteAccountPassword}
                            onClick={() => handleDeleteAccountAndData(true)}
                            className="px-4 py-2 rounded-xl bg-[#FFC400] hover:bg-[#FFD54A] text-[#08090D] text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-[#FFC400]/20 disabled:opacity-50"
                          >
                            {isDeletingAccount ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Verifying &amp; Deleting...</span>
                              </>
                            ) : (
                              <>
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Confirm Password &amp; Delete</span>
                              </>
                            )}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={isDeletingAccount}
                          onClick={() => handleDeleteAccountAndData(false)}
                          className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-red-600/25 disabled:opacity-50"
                        >
                          {isDeletingAccount ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Deleting Account &amp; Data...</span>
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Permanently Delete My Account</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.section>
          ) : /* =========================================================
              VIEW: MOVIES & SHOWS (Combined)
          ========================================================= */
          activeView === 'movies_shows' ? (
            <motion.div
              key="movies-shows-page"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-xl sm:text-3xl font-black text-white font-display tracking-tight">
                  Movies &amp; Shows
                </h1>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => openAdminStudio(null, 'catalog')}
                    className="px-4 py-2 rounded-xl bg-[#FFC400] hover:bg-[#FFD54A] text-[#08090D] text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-[#FFC400]/20"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Admin Studio</span>
                  </button>
                )}
              </div>

              {catalog.length === 0 ? (
                <div className="rounded-2xl bg-[#14161D] border border-[#292C35] p-8 text-center max-w-xl mx-auto space-y-3">
                  <Film className="w-10 h-10 text-[#FFC400] mx-auto opacity-80" />
                  <h2 className="text-lg font-bold text-white">
                    Catalog Empty
                  </h2>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => openAdminStudio(null, 'catalog')}
                      className="px-5 py-2 rounded-xl bg-[#FFC400] hover:bg-[#FFD54A] text-[#08090D] text-xs font-bold cursor-pointer"
                    >
                      Open Admin Studio
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {moviesList.length > 0 && (
                    <CarouselRow
                      title="Popular Movies"
                      items={moviesList}
                      watchlistIds={activeWatchlistIds}
                      onSelectMedia={handleSelectMedia}
                      onToggleWatchlist={handleToggleWatchlist}
                    />
                  )}
                  {showsList.length > 0 && (
                    <CarouselRow
                      title="TV Series"
                      items={showsList}
                      watchlistIds={activeWatchlistIds}
                      onSelectMedia={handleSelectMedia}
                      onToggleWatchlist={handleToggleWatchlist}
                    />
                  )}
                </div>
              )}
            </motion.div>
          ) : /* =========================================================
              SUPPORT PAGE (Sends messages directly to Admin Panel + ContactZappyFun@gamil.com)
          ========================================================= */
          activeView === 'support' ? (
            <motion.div
              key="support-page"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
                {/* Left 5 Cols: Heading + Direct Contact Info + 4x4 Poster Grid Frame */}
                <div className="lg:col-span-5 space-y-4">
                  <h1 className="text-xl sm:text-3xl font-bold text-white font-display leading-tight">
                    Support &amp; Contact
                  </h1>

                  {/* Official Contact Email Card */}
                  <div className="rounded-xl bg-[#14161D] border border-[#FFC400]/40 p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#FFC400]/15 border border-[#FFC400]/30 text-[#FFC400] flex items-center justify-center shrink-0">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-[#A7A9B4]">
                          Direct Email Support
                        </span>
                        <a
                          href={`mailto:${legalPages.contactEmail || OFFICIAL_CONTACT_EMAIL}`}
                          className="text-xs sm:text-sm font-bold text-[#FFC400] hover:underline truncate block"
                        >
                          {legalPages.contactEmail || OFFICIAL_CONTACT_EMAIL}
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#0F1117] border-4 border-[#292C35] p-4 grid grid-cols-4 gap-2.5 aspect-[4/3.6] overflow-hidden">
                    {Array.from({ length: 16 }, (_, idx) => {
                      const item =
                        catalog.length > 0
                          ? catalog[idx % catalog.length]
                          : null;
                      return (
                        <div
                          key={idx}
                          className="rounded-lg overflow-hidden bg-[#14161D]"
                        >
                          {item ? (
                            <MediaArtwork
                              src={item.posterUrl}
                              alt={item.title}
                              item={item}
                              aspectRatio="poster"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-[#252832] to-[#14161D]" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right 7 Cols: Contact Form Box */}
                <form
                  onSubmit={handleSupportSubmit}
                  className="lg:col-span-7 rounded-xl bg-[#14161D] border border-[#292C35] p-5 sm:p-8 space-y-5"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-xs sm:text-sm font-semibold text-white">
                        First Name
                      </label>
                      <input
                        type="text"
                        required
                        value={supportFirstName}
                        onChange={(e) => setSupportFirstName(e.target.value)}
                        placeholder="Enter First Name"
                        className="w-full h-11 px-4 rounded-lg bg-[#08090D] border border-[#292C35] text-xs sm:text-sm text-white placeholder:text-[#747784] focus:outline-none focus:border-[#FFC400]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs sm:text-sm font-semibold text-white">
                        Last Name
                      </label>
                      <input
                        type="text"
                        required
                        value={supportLastName}
                        onChange={(e) => setSupportLastName(e.target.value)}
                        placeholder="Enter Last Name"
                        className="w-full h-11 px-4 rounded-lg bg-[#08090D] border border-[#292C35] text-xs sm:text-sm text-white placeholder:text-[#747784] focus:outline-none focus:border-[#FFC400]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-xs sm:text-sm font-semibold text-white">
                        Email
                      </label>
                      <input
                        type="email"
                        required
                        value={supportEmail}
                        onChange={(e) => setSupportEmail(e.target.value)}
                        placeholder="Enter your Email"
                        className="w-full h-11 px-4 rounded-lg bg-[#08090D] border border-[#292C35] text-xs sm:text-sm text-white placeholder:text-[#747784] focus:outline-none focus:border-[#FFC400]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs sm:text-sm font-semibold text-white">
                        Phone Number
                      </label>
                      <div className="flex gap-2">
                        <span className="h-11 px-3 rounded-lg bg-[#08090D] border border-[#292C35] text-xs font-semibold text-white flex items-center shrink-0">
                          IN +91
                        </span>
                        <input
                          type="tel"
                          value={supportPhone}
                          onChange={(e) => setSupportPhone(e.target.value)}
                          placeholder="Enter Phone Number"
                          className="flex-1 min-w-0 h-11 px-4 rounded-lg bg-[#08090D] border border-[#292C35] text-xs sm:text-sm text-white placeholder:text-[#747784] focus:outline-none focus:border-[#FFC400]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs sm:text-sm font-semibold text-white">
                      Message
                    </label>
                    <textarea
                      rows={4}
                      required
                      value={supportMessage}
                      onChange={(e) => setSupportMessage(e.target.value)}
                      placeholder="Enter your Message"
                      className="w-full p-4 rounded-lg bg-[#08090D] border border-[#292C35] text-xs sm:text-sm text-white placeholder:text-[#747784] focus:outline-none focus:border-[#FFC400]"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                    <label className="flex items-center gap-2.5 text-xs sm:text-sm text-[#A7A9B4] cursor-pointer">
                      <input
                        type="checkbox"
                        required
                        checked={supportAgreed}
                        onChange={(e) => setSupportAgreed(e.target.checked)}
                        className="w-4 h-4 accent-[#FFC400] shrink-0"
                      />
                      <span>
                        I agree with{' '}
                        <a
                          href="/Terms-of-use"
                          onClick={(e) => {
                            e.preventDefault();
                            openLegalPage('terms');
                          }}
                          className="text-[#FFC400] hover:underline cursor-pointer"
                        >
                          Terms of Use
                        </a>{' '}
                        and{' '}
                        <a
                          href="/Privacy-policy"
                          onClick={(e) => {
                            e.preventDefault();
                            openLegalPage('privacy');
                          }}
                          className="text-[#FFC400] hover:underline cursor-pointer"
                        >
                          Privacy Policy
                        </a>
                      </span>
                    </label>

                    <button
                      type="submit"
                      disabled={isSendingSupport}
                      className="min-h-[44px] px-6 py-2.5 rounded-lg bg-[#FFC400] hover:bg-[#FFD54A] text-[#08090D] text-xs sm:text-sm font-bold transition-colors cursor-pointer disabled:opacity-60 shrink-0"
                    >
                      {isSendingSupport ? 'Sending...' : 'Send Message'}
                    </button>
                  </div>
                </form>
              </div>

              {renderFaqSection()}
            </motion.div>
          ) : (
            /* =========================================================
              PAGE 1: HOME PAGE
          ========================================================= */
            <motion.div
              key="home-page"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-6 sm:space-y-8"
            >
              {/* SECTION 1: HERO SPOTLIGHT BANNER OR WELCOME BILLBOARD */}
              {featuredItems.length > 0 ? (
                <>
                  <HeroBanner
                    featuredItems={featuredItems}
                    activeHeroIndex={activeHeroIndex}
                    onSelectHeroIndex={setActiveHeroIndex}
                    watchlistIds={activeWatchlistIds}
                    onPlayMedia={(item) => handleSelectMedia(item, true, false)}
                    onOpenDetails={(item) => handleSelectMedia(item, false, false)}
                    onToggleWatchlist={handleToggleWatchlist}
                  />

                  {continueWatchingItems.length > 0 && (
                    <ContinueWatchingRow
                      items={continueWatchingItems}
                      onSelectMedia={handleSelectMedia}
                      onSeeAll={() => handleNavigate('movies_shows')}
                      onRemoveProgress={handleRemoveWatchProgress}
                    />
                  )}

                  {/* Top 10 Today Row */}
                  <CarouselRow
                    title="Top 10 Today"
                    items={catalog.slice(0, 10)}
                    watchlistIds={activeWatchlistIds}
                    isTop10Row={true}
                    onSelectMedia={handleSelectMedia}
                    onToggleWatchlist={handleToggleWatchlist}
                  />

                  {moviesList.length > 0 && (
                    <CarouselRow
                      title="Popular Movies"
                      items={moviesList}
                      watchlistIds={activeWatchlistIds}
                      onSelectMedia={handleSelectMedia}
                      onToggleWatchlist={handleToggleWatchlist}
                    />
                  )}

                  {showsList.length > 0 && (
                    <CarouselRow
                      title="TV Shows"
                      items={showsList}
                      watchlistIds={activeWatchlistIds}
                      onSelectMedia={handleSelectMedia}
                      onToggleWatchlist={handleToggleWatchlist}
                    />
                  )}
                </>
              ) : (
                <section className="relative min-h-[340px] rounded-2xl overflow-hidden border border-[#292C35] bg-gradient-to-b from-[#14161D] to-[#08090D] p-8 sm:p-12 flex flex-col justify-center items-center text-center shadow-2xl">
                  <div className="space-y-4 max-w-xl">
                    <div className="h-16 w-16 mx-auto rounded-2xl bg-black border border-[#231E30] flex items-center justify-center p-2.5 shadow-xl">
                      <img
                        src="/assets/aistudio/1792738076429_2_1a521405.jpg"
                        alt="ZappyFun"
                        className="h-full w-full object-contain rounded-xl select-none"
                      />
                    </div>
                    <h1 className="text-2xl sm:text-4xl font-black text-white font-display tracking-tight">
                      No Titles Available
                    </h1>
                    <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                      {isAdmin ? (
                        <button
                          type="button"
                          onClick={() => openAdminStudio(null, 'catalog')}
                          className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#FFB800] via-[#FF5A36] to-[#FF168B] hover:brightness-110 text-white font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-xl shadow-[#FF5A36]/25 transition-transform active:scale-95"
                        >
                          <SlidersHorizontal className="w-4 h-4" />
                          <span>Open Admin Studio</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenAuthModal('signin')}
                          className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#FFB800] via-[#FF5A36] to-[#FF168B] hover:brightness-110 text-white font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-xl shadow-[#FF5A36]/25"
                        >
                          <LogIn className="w-4 h-4" />
                          <span>Sign In</span>
                        </button>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* Categories Row */}
              {renderGenre2x2GridSection('Categories')}
            </motion.div>
          )}
        </AnimatePresence>
        )}
      </main>

      {/* DARK FOOTER (#08090D) */}
      <footer className="mt-auto bg-[#08090D] border-t border-[#292C35] pt-6 pb-8 px-4 sm:px-6 lg:px-8 text-xs sm:text-sm text-[#747784]">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
            <div className="space-y-3">
              <h3 className="text-white font-semibold text-base">Browse</h3>
              <ul className="space-y-2">
                <li>
                  <button
                    type="button"
                    onClick={() => handleNavigate('home')}
                    className="hover:text-[#FFC400] transition-colors cursor-pointer"
                  >
                    Home
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleNavigate('categories')}
                    className="hover:text-[#FFC400] transition-colors cursor-pointer"
                  >
                    Categories
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleNavigate('watchlist')}
                    className="hover:text-[#FFC400] transition-colors cursor-pointer"
                  >
                    Watchlist
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-white font-semibold text-base">Movies</h3>
              <ul className="space-y-2">
                <li>
                  <button
                    type="button"
                    onClick={() => handleNavigate('movies')}
                    className="hover:text-[#FFC400] transition-colors cursor-pointer"
                  >
                    All Movies
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTypeFilter('movie');
                      setSearchSortBy('popular');
                      handleNavigate('search');
                    }}
                    className="hover:text-[#FFC400] transition-colors cursor-pointer"
                  >
                    Top Rated
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTypeFilter('movie');
                      setSearchSortBy('newest');
                      handleNavigate('search');
                    }}
                    className="hover:text-[#FFC400] transition-colors cursor-pointer"
                  >
                    New Releases
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-white font-semibold text-base">TV Shows</h3>
              <ul className="space-y-2">
                <li>
                  <button
                    type="button"
                    onClick={() => handleNavigate('tv')}
                    className="hover:text-[#FFC400] transition-colors cursor-pointer"
                  >
                    All Shows
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTypeFilter('series');
                      setSearchSortBy('popular');
                      handleNavigate('search');
                    }}
                    className="hover:text-[#FFC400] transition-colors cursor-pointer"
                  >
                    Top Rated
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTypeFilter('series');
                      setSearchSortBy('newest');
                      handleNavigate('search');
                    }}
                    className="hover:text-[#FFC400] transition-colors cursor-pointer"
                  >
                    New Episodes
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-white font-semibold text-base">Legal</h3>
              <ul className="space-y-2">
                <li>
                  <a
                    href="/Terms-of-use"
                    onClick={(e) => {
                      e.preventDefault();
                      openLegalPage('terms');
                    }}
                    className="hover:text-[#FFC400] transition-colors cursor-pointer block"
                  >
                    Terms of Use
                  </a>
                </li>
                <li>
                  <a
                    href="/Privacy-policy"
                    onClick={(e) => {
                      e.preventDefault();
                      openLegalPage('privacy');
                    }}
                    className="hover:text-[#FFC400] transition-colors cursor-pointer block"
                  >
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a
                    href="/Disclaimer-and-copyright-policy"
                    onClick={(e) => {
                      e.preventDefault();
                      openLegalPage('disclaimer');
                    }}
                    className="hover:text-[#FFC400] transition-colors cursor-pointer block"
                  >
                    Disclaimer &amp; Copyright Policy
                  </a>
                </li>
                <li>
                  <a
                    href="/About"
                    onClick={(e) => {
                      e.preventDefault();
                      openLegalPage('about');
                    }}
                    className="hover:text-[#FFC400] transition-colors cursor-pointer block"
                  >
                    About ZappyFun
                  </a>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-white font-semibold text-base">Contact &amp; Help</h3>
              <ul className="space-y-2">
                <li>
                  <button
                    type="button"
                    onClick={() => handleNavigate('support')}
                    className="hover:text-[#FFC400] transition-colors cursor-pointer"
                  >
                    Support &amp; FAQ
                  </button>
                </li>
                <li>
                  <a
                    href={`mailto:${legalPages.contactEmail || OFFICIAL_CONTACT_EMAIL}`}
                    className="text-[#FFC400] hover:underline break-all block"
                  >
                    {legalPages.contactEmail || OFFICIAL_CONTACT_EMAIL}
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-[#292C35] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#747784]">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="h-9 w-9 rounded-xl bg-black border border-[#231E30] flex items-center justify-center p-1 shadow-md overflow-hidden">
                  <img
                    src="/assets/aistudio/1792738076429_2_1a521405.jpg"
                    alt="ZappyFun Logo"
                    className="h-full w-full object-contain rounded-lg select-none pointer-events-none"
                  />
                </div>
                <span className="font-display font-black text-sm tracking-wider zf-gradient-text">
                  ZAPPYFUN
                </span>
              </div>
              <p className="border-l border-[#292C35] pl-4">
                © 2026 ZappyFun · {legalPages.contactEmail || OFFICIAL_CONTACT_EMAIL}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <a
                href="/About"
                onClick={(e) => {
                  e.preventDefault();
                  openLegalPage('about');
                }}
                className="hover:text-white cursor-pointer"
              >
                About
              </a>
              <span className="text-[#292C35]">|</span>
              <a
                href="/Terms-of-use"
                onClick={(e) => {
                  e.preventDefault();
                  openLegalPage('terms');
                }}
                className="hover:text-white cursor-pointer"
              >
                Terms of Use
              </a>
              <span className="text-[#292C35]">|</span>
              <a
                href="/Privacy-policy"
                onClick={(e) => {
                  e.preventDefault();
                  openLegalPage('privacy');
                }}
                className="hover:text-white cursor-pointer"
              >
                Privacy Policy
              </a>
              <span className="text-[#292C35]">|</span>
              <a
                href="/Cookie-policy"
                onClick={(e) => {
                  e.preventDefault();
                  openLegalPage('advertising');
                }}
                className="hover:text-white cursor-pointer"
              >
                Cookie Policy
              </a>
              <span className="text-[#292C35]">|</span>
              <a
                href="/Disclaimer-and-copyright-policy"
                onClick={(e) => {
                  e.preventDefault();
                  openLegalPage('disclaimer');
                }}
                className="hover:text-white cursor-pointer"
              >
                Disclaimer &amp; Copyright Policy
              </a>
              <span className="text-[#292C35]">|</span>
              <button
                type="button"
                onClick={() => setShowSplash(true)}
                className="hover:text-[#FFB800] transition-colors cursor-pointer flex items-center gap-1 text-[11px] text-[#A7A9B4]"
                title="Replay ZappyFun Cinematic Opening"
              >
                <span>🎬 Replay Intro</span>
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* ADMIN STUDIO MODAL (Catalog + Support Inbox + Legal & Policies Editor) */}
      <AdminStudioModal
        isOpen={adminStudioOpen}
        currentUser={currentUser}
        prefillMedia={adminPrefillMedia}
        catalog={catalog}
        videoAdConfig={videoAdConfig}
        supportMessages={mergedSupportMessages}
        initialTab={adminInitialTab}
        legalPages={legalPages}
        onSaveLegalPages={handleSaveLegalPages}
        heroBatchInfo={{
          activeBatchNumber: activeHeroBatchNumber,
          totalBatches: totalHeroBatches,
          hoursUntilNextBatch: hoursUntilNextHeroBatch,
          currentHeroMovies: featuredItems,
        }}
        onAdvanceHeroBatch={handleAdvanceHeroBatch}
        onResetHeroCycleNow={handleResetHeroCycleNow}
        onUpdateSupportStatus={handleUpdateSupportStatus}
        onDeleteSupportMessage={handleDeleteSupportMessage}
        onClose={() => setAdminStudioOpen(false)}
        onSelectMediaToWatch={(item) => {
          setPreviewDraftItem(null);
          handleSelectMedia(item, true, false);
        }}
        onPreviewDraftInApp={handlePreviewDraftInApp}
        onLaunchVisualEditor={() => setVisualEditorActive(true)}
      />

      {/* LIVE VISUAL UI COMPONENT EDITOR */}
      <VisualUiEditor
        isActive={visualEditorActive}
        currentUser={currentUser}
        onCloseEditor={() => setVisualEditorActive(false)}
      />

      {/* INFO, LEGAL & PREFERENCES MODAL */}
      <InfoModal
        modalType={activeModal}
        adsEnabled={adsEnabled}
        legalPages={legalPages}
        onToggleAds={() => setAdsEnabled((prev) => !prev)}
        onClose={() => setActiveModal(null)}
      />

      {/* EMAIL / OTP AUTHENTICATION MODAL */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authModalMode}
        onSuccess={() => {
          showToast('Signed in successfully!');
        }}
      />

      {/* CINEMATIC STARTUP SPLASH SCREEN & ANIMATED LOGO REVEAL */}
      <AnimatePresence>
        {showSplash && (
          <CinematicSplashScreen
            isReady={isAppReady}
            minDurationMs={4000}
            onComplete={handleSplashComplete}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
