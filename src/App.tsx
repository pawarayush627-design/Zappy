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
  legacyDb,
  ACTIVE_FIREBASE_PROJECT_ID,
  ACTIVE_FIRESTORE_DATABASE_ID,
  LEGACY_FIREBASE_CONFIG,
  ADMIN_EMAIL,
  isUserAdmin,
  signInWithGoogle,
  signOutUser,
  handleFirestoreError,
  OperationType,
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
import { InfoModal, InfoModalType } from './components/InfoModal';
import {
  ContinueWatchingRow,
  WatchProgressEntry,
} from './components/ContinueWatchingRow';
import { AdminStudioModal } from './components/AdminStudioModal';
import { VisualUiEditor } from './components/VisualUiEditor';
import { MediaArtwork } from './components/MediaArtwork';

type NavView =
  | 'home'
  | 'movies_shows'
  | 'support'
  | 'subscriptions'
  | 'search'
  | 'watchlist'
  | 'details';

const WATCHLIST_STORAGE_KEY = 'zappy_watchlist_v2';
const COMPLETED_STORAGE_KEY = 'zappy_completed_v1';
const ADS_STORAGE_KEY = 'zappy_ads_enabled_v1';
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
    question: 'What is Zappy?',
    answer:
      'Zappy is an on-demand streaming platform that allows you to watch movies and TV shows in 4K UHD.',
  },
  {
    num: '02',
    question: 'How much does Zappy cost?',
    answer:
      'Plans start at $9.99/month for Basic, $12.99/month for Standard, and $14.99/month for Premium 4K UHD.',
  },
  {
    num: '03',
    question: 'What content is available on Zappy?',
    answer:
      'Enjoy blockbuster movies, original series, trending TV shows, documentaries, and curated titles across every genre.',
  },
  {
    num: '04',
    question: 'How can I watch Zappy?',
    answer:
      'You can watch directly on the web or across smartphones, tablets, Smart TVs, laptops, gaming consoles, and VR headsets.',
  },
  {
    num: '05',
    question: 'How do I sign up for Zappy?',
    answer:
      'Click Sign In to authenticate with Google in one click and sync your personal watchlist across all devices.',
  },
  {
    num: '06',
    question: 'What happens when I finish watching a title in my Watchlist?',
    answer:
      'Once you watch a movie or show fully on Zappy, it is automatically removed from your Watchlist so your list stays fresh.',
  },
  {
    num: '07',
    question: 'How do I contact Zappy customer support?',
    answer:
      'Visit our Support page at any time to send a direct message directly to the Zappy Admin inbox.',
  },
  {
    num: '08',
    question: 'What are the Zappy payment methods?',
    answer:
      'We accept all major credit/debit cards, UPI, NetBanking, PayPal, and digital wallets.',
  },
];

const ZAPPY_PLANS = [
  {
    name: 'Basic Plan',
    description:
      'Enjoy an extensive library of movies and shows, featuring a range of content, including recently released titles.',
    monthlyPrice: '$9.99',
    yearlyPrice: '$95.99',
  },
  {
    name: 'Standard Plan',
    description:
      'Access to a wider selection of movies and shows, including most new releases and exclusive content in Full HD.',
    monthlyPrice: '$12.99',
    yearlyPrice: '$124.99',
    popular: true,
  },
  {
    name: 'Premium Plan',
    description:
      'Access to the widest selection of movies and shows, including all new releases, 4K Ultra HD & Offline Viewing.',
    monthlyPrice: '$14.99',
    yearlyPrice: '$143.99',
  },
];

const PLAN_COMPARISON_ROWS = [
  {
    feature: 'Price',
    basic: '$9.99/Month',
    standard: '$12.99/Month',
    premium: '$14.99/Month',
  },
  {
    feature: 'Content',
    basic: 'Access to a wide selection of movies and shows, including some new releases.',
    standard:
      'Access to a wider selection of movies and shows, including most new releases and exclusive content',
    premium:
      'Access to a widest selection of movies and shows, including all new releases and Offline Viewing',
  },
  {
    feature: 'Devices',
    basic: 'Watch on one device simultaneously',
    standard: 'Watch on Two device simultaneously',
    premium: 'Watch on Four device simultaneously',
  },
  {
    feature: 'Free Trial',
    basic: '7 Days',
    standard: '7 Days',
    premium: '7 Days',
  },
  {
    feature: 'Cancel Anytime',
    basic: 'Yes',
    standard: 'Yes',
    premium: 'Yes',
  },
  {
    feature: 'HDR',
    basic: 'No',
    standard: 'Yes',
    premium: 'Yes',
  },
  {
    feature: 'Dolby Atmos',
    basic: 'No',
    standard: 'Yes',
    premium: 'Yes',
  },
  {
    feature: 'Ad - Free',
    basic: 'No',
    standard: 'Yes',
    premium: 'Yes',
  },
  {
    feature: 'Offline Viewing',
    basic: 'No',
    standard: 'Yes, for select titles.',
    premium: 'Yes, for all titles.',
  },
  {
    feature: 'Family Sharing',
    basic: 'No',
    standard: 'Yes, up to 5 family members.',
    premium: 'Yes, up to 6 family members.',
  },
];

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);

  const [catalog, setCatalog] = useState<MediaItem[]>([]);
  const [, setIsLoadingCatalog] = useState<boolean>(true);
  const [videoAdConfig] = useState<VideoAdConfig>({
    imaEnabled: true,
    testMode: true,
    vastTagUrl: '',
    enablePreRoll: true,
    enableMidRoll: true,
  });

  const [activeView, setActiveView] = useState<NavView>('home');
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [autoPlayOnOpen, setAutoPlayOnOpen] = useState<boolean>(false);
  const [activeHeroIndex, setActiveHeroIndex] = useState<number>(0);

  // Admin Studio Modal & Live Visual UI Editor State
  const [adminStudioOpen, setAdminStudioOpen] = useState<boolean>(false);
  const [adminInitialTab, setAdminInitialTab] = useState<'catalog' | 'support'>(
    'catalog'
  );
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

  // Search & Filter State
  const [searchBarOpen, setSearchBarOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [searchTypeFilter, setSearchTypeFilter] = useState<
    'all' | 'movie' | 'series'
  >('all');
  const [searchSortBy, setSearchSortBy] = useState<
    'relevance' | 'newest' | 'popular' | 'title'
  >('relevance');

  // Genre Pagination State (allows cycling through all genres)
  const [genrePageIndex, setGenrePageIndex] = useState<number>(0);

  // Home / FAQ / Pricing Interactive State
  const [openFaqId, setOpenFaqId] = useState<string>('01');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>(
    'monthly'
  );
  const [mobileShowsTab, setMobileShowsTab] = useState<'movies' | 'shows'>(
    'movies'
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

  // Continue Watching Progress State
  const [watchProgressMap, setWatchProgressMap] = useState<
    Record<string, WatchProgressEntry>
  >({});

  // Configurable Display Ad-Supported Placeholder State
  const [adsEnabled, setAdsEnabled] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(ADS_STORAGE_KEY);
      return raw === null ? true : raw === 'true';
    } catch {
      return true;
    }
  });

  const [activeModal, setActiveModal] = useState<InfoModalType>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // 1. Listen to Firebase Authentication State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

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
          const imdbMatch = rawEmbedStr.match(/(tt\d{5,12})/i);
          const numMatch = rawEmbedStr.match(
            /(?:movie|tv|series|show)\/(\d+)/i
          );
          const resolvedNumericId =
            Number(data.tmdbId) || (numMatch?.[1] ? Number(numMatch[1]) : 1);
          const resolvedStreamId = imdbMatch?.[1]
            ? imdbMatch[1].toLowerCase()
            : String(resolvedNumericId);
          const normalizedEmbedMasterUrl =
            mediaType === 'tv'
              ? `https://embedmaster.link/tv/${resolvedStreamId}/1/1`
              : `https://embedmaster.link/movie/${resolvedStreamId}`;

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
            cinesrcEmbedUrl: normalizedEmbedMasterUrl,
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

  // 2B. Automatic Data Recovery & Migration from Previous Firebase Project (when switching projects)
  useEffect(() => {
    const isDifferentProject =
      ACTIVE_FIREBASE_PROJECT_ID !== LEGACY_FIREBASE_CONFIG.projectId ||
      ACTIVE_FIRESTORE_DATABASE_ID !==
        LEGACY_FIREBASE_CONFIG.firestoreDatabaseId;

    if (!isDifferentProject) return;

    let cancelled = false;
    async function recoverAndMigrateFromLegacyProject() {
      try {
        const legacyCatalogSnap = await getDocs(
          query(
            collection(legacyDb, 'catalog'),
            where('visibility', '==', 'public')
          )
        );
        if (cancelled || legacyCatalogSnap.empty) return;

        // If current catalog is empty, hydrate UI immediately from legacy snapshot
        setCatalog((currentItems) => {
          if (currentItems.length > 0) return currentItems;
          return legacyCatalogSnap.docs.map((docSnap) => {
            const data = docSnap.data();
            const mediaType = data.mediaType === 'tv' ? 'tv' : 'movie';
            return {
              id: data.id || docSnap.id,
              tmdbId: Number(data.tmdbId) || 157336,
              mediaType,
              title: data.title || 'Untitled',
              tagline: data.tagline || '',
              synopsis: data.synopsis || '',
              contentType: mediaType === 'tv' ? 'series' : 'movie',
              genres: Array.isArray(data.genres) ? data.genres : ['Drama'],
              releaseYear: Number(data.releaseYear) || 2024,
              durationMinutes: Number(data.durationMinutes) || 120,
              maturityRating: data.maturityRating || 'PG-13',
              directorOrCreator: data.directorOrCreator || 'Featured Creator',
              cast: Array.isArray(data.cast) ? data.cast : ['Featured Cast'],
              posterUrl: data.posterUrl || '',
              backdropUrl: data.backdropUrl || data.posterUrl || '',
              cinesrcEmbedUrl: data.cinesrcEmbedUrl || '',
              justWatchUrl: data.justWatchUrl || '',
              featured: Boolean(data.featured),
              popularScore: Number(data.popularScore) || 92,
              seasonsCount: Number(data.seasonsCount) || 1,
              episodesCount: Number(data.episodesCount) || 8,
              availabilityStatus: 'playable_demo',
              availabilityNote: '4K UHD · Instant Stream',
              visualTheme: {
                primaryHex: '#141414',
                secondaryHex: '#1A1A1A',
                accentHex: '#E50000',
                motif: 'horizon',
              },
            };
          });
        });

        // If signed in as Admin, automatically copy all legacy catalog & UI overrides into the new Firebase project
        if (currentUser && isAdmin) {
          let migratedCount = 0;
          for (const docSnap of legacyCatalogSnap.docs) {
            const targetRef = doc(db, 'catalog', docSnap.id);
            const existing = await getDoc(targetRef);
            if (!existing.exists()) {
              const raw = docSnap.data();
              await setDoc(targetRef, {
                ...raw,
                id: raw.id || docSnap.id,
                authorUid: currentUser.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
              migratedCount += 1;
            }
          }

          const legacyUiSnap = await getDocs(
            collection(legacyDb, 'ui_overrides')
          );
          for (const uiDoc of legacyUiSnap.docs) {
            const targetUiRef = doc(db, 'ui_overrides', uiDoc.id);
            const existingUi = await getDoc(targetUiRef);
            if (!existingUi.exists()) {
              await setDoc(targetUiRef, {
                ...uiDoc.data(),
                updatedBy: currentUser.email || ADMIN_EMAIL,
                updatedAt: serverTimestamp(),
              });
            }
          }

          if (migratedCount > 0 && !cancelled) {
            setSessionToast(
              `Automatically recovered & migrated ${migratedCount} title(s) into your new Firebase project (${ACTIVE_FIREBASE_PROJECT_ID})!`
            );
          }
        }
      } catch {
        // Ignore if legacy project is unreachable
      }
    }

    recoverAndMigrateFromLegacyProject();
    return () => {
      cancelled = true;
    };
  }, [currentUser, isAdmin]);

  // 3. Real-time Cloud Firestore Watchlist Subscription
  useEffect(() => {
    if (!isAuthReady || !currentUser || !currentUser.emailVerified) return;

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
        handleFirestoreError(error, OperationType.LIST, 'watchlists');
      }
    );

    return () => unsubscribe();
  }, [isAuthReady, currentUser]);

  // 4. Real-time Admin Support Messages Subscription (Firestore + Backend API)
  const fetchServerSupportMessages = useCallback(async () => {
    try {
      const res = await fetch('/api/support');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.messages)) {
          setServerSupportMessages(data.messages);
        }
      }
    } catch {
      // Ignore network error
    }
  }, []);

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

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithGoogle();
      if (isUserAdmin(result.user.email, result.user.emailVerified)) {
        showToast(
          `Welcome Admin (${result.user.email})! Zappy Admin Studio unlocked.`
        );
      } else {
        showToast(
          `Signed in as ${result.user.displayName || result.user.email}`
        );
      }
    } catch {
      showToast('Google Sign-In was cancelled or blocked.');
    }
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

    if (currentUser && currentUser.emailVerified) {
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
        handleFirestoreError(
          error,
          alreadySaved ? OperationType.DELETE : OperationType.CREATE,
          `watchlists/${docId}`
        );
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

  const handleSelectMedia = (item: MediaItem, autoPlay = false) => {
    setSelectedMedia(item);
    setAutoPlayOnOpen(autoPlay);
    setActiveView('details');
    setNotificationsOpen(false);
    setProfileMenuOpen(false);
    setMobileMenuOpen(false);

    if (!watchProgressMap[item.id] && !completedIds.includes(item.id)) {
      setWatchProgressMap((prev) => ({
        [item.id]: {
          mediaId: item.id,
          seasonEpisodeLabel:
            item.contentType === 'series' ? 'S1 · E1' : 'Movie',
          remainingLabel: `${item.durationMinutes}m`,
          progressPercent: 28,
        },
        ...prev,
      }));
    }
  };

  const handleNavigate = (view: NavView) => {
    setActiveView(view);
    setMobileMenuOpen(false);
    setNotificationsOpen(false);
    setProfileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openAdminStudio = (
    mediaItem: MediaItem | null = null,
    tab: 'catalog' | 'support' = 'catalog'
  ) => {
    setAdminPrefillMedia(mediaItem);
    setAdminInitialTab(tab);
    setAdminStudioOpen(true);
    setMobileMenuOpen(false);
    setProfileMenuOpen(false);
  };

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
    try {
      await fetch(`/api/support/${encodeURIComponent(msg.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      setServerSupportMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, status: nextStatus } : m))
      );

      if (currentUser && isAdmin) {
        const docRef = doc(db, 'support_messages', msg.id);
        await updateDoc(docRef, {
          status: nextStatus,
          updatedAt: serverTimestamp(),
        });
      }
    } catch {
      // Ignore if document is only in backend memory
    }
  };

  const handleDeleteSupportMessage = async (msg: SupportMessageItem) => {
    try {
      await fetch(`/api/support/${encodeURIComponent(msg.id)}`, {
        method: 'DELETE',
      });
      setServerSupportMessages((prev) => prev.filter((m) => m.id !== msg.id));

      if (currentUser && isAdmin) {
        await deleteDoc(doc(db, 'support_messages', msg.id));
      }
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
    Object.values(watchProgressMap).forEach((progress) => {
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

    const rawQuery = searchQuery.trim().toLowerCase();
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
    searchQuery,
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
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white font-display">
              {sectionTitle}
            </h2>
            {sectionSubtitle && (
              <p className="text-xs sm:text-sm text-[#999999] mt-1.5 max-w-2xl">
                {sectionSubtitle}
              </p>
            )}
          </div>

          <div className="inline-flex items-center gap-3 p-2 rounded-xl bg-[#0F0F0F] border border-[#1F1F1F] self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() =>
                setGenrePageIndex(
                  (prev) => (prev - 1 + totalPages) % totalPages
                )
              }
              className="w-9 h-9 rounded-lg bg-[#1A1A1A] hover:bg-[#262626] border border-[#1F1F1F] text-white flex items-center justify-center cursor-pointer"
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
                      ? 'w-5 bg-[#E50000]'
                      : 'w-3 bg-[#333333] hover:bg-[#555555]'
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
              className="w-9 h-9 rounded-lg bg-[#1A1A1A] hover:bg-[#262626] border border-[#1F1F1F] text-white flex items-center justify-center cursor-pointer"
              aria-label="Next genre page"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-5">
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
                className="group rounded-xl bg-[#1A1A1A] border border-[#262626] hover:border-[#E50000]/60 p-4 sm:p-5 flex flex-col justify-between gap-3 transition-all cursor-pointer cinema-card-shadow"
              >
                {/* 2x2 Poster Mosaic with Bottom Fade */}
                <div className="relative grid grid-cols-2 gap-2 aspect-square overflow-hidden rounded-lg bg-[#141414]">
                  {[0, 1, 2, 3].map((slotIdx) => {
                    const posterItem = fourPosters[slotIdx];
                    return (
                      <div
                        key={slotIdx}
                        className="w-full h-full overflow-hidden rounded-md bg-[#0F0F0F]"
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
                          <div className="w-full h-full bg-gradient-to-br from-[#222222] to-[#141414] flex items-center justify-center text-[10px] font-semibold text-zinc-600">
                            {genre}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1A] via-[#1A1A1A]/25 to-transparent pointer-events-none" />
                </div>

                {/* Bottom Genre Label + Count + Right Arrow */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="min-w-0">
                    {showTop10Badge && (
                      <span className="inline-block px-2 py-0.5 rounded bg-[#E50000] text-white text-[10px] font-semibold mb-1">
                        Top 10 In
                      </span>
                    )}
                    <h3 className="text-sm sm:text-base font-semibold text-white group-hover:text-[#E50000] transition-colors truncate">
                      {genre}
                    </h3>
                    <p className="text-[11px] text-[#999999]">
                      {matching.length}{' '}
                      {matching.length === 1 ? 'title' : 'titles'}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1 group-hover:text-[#E50000] transition-all shrink-0" />
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
    <section className="space-y-8" aria-label="Frequently Asked Questions">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white font-display">
            Frequently Asked Questions
          </h2>
          <p className="text-xs sm:text-sm text-[#999999] mt-1.5 max-w-2xl">
            Got questions? We&apos;ve got answers! Check out our FAQ section to
            find answers to the most common questions about Zappy.
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleNavigate('support')}
          className="min-h-[46px] px-5 py-3 rounded-lg bg-[#E50000] hover:bg-[#FF1A1A] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer self-start sm:self-auto shrink-0"
        >
          Ask a Question
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-2">
        {ZAPPY_FAQS.map((faq) => {
          const isOpen = openFaqId === faq.num;
          return (
            <div key={faq.num} className="pt-4 pb-5 relative">
              <button
                type="button"
                onClick={() => setOpenFaqId(isOpen ? '' : faq.num)}
                className="w-full flex items-start justify-between gap-4 text-left cursor-pointer"
              >
                <div className="flex items-start gap-4">
                  <span className="w-12 h-12 rounded-xl bg-[#1F1F1F] border border-[#262626] text-white font-bold text-sm flex items-center justify-center shrink-0">
                    {faq.num}
                  </span>
                  <div className="space-y-2 pt-2.5">
                    <h3 className="text-base sm:text-lg font-medium text-white">
                      {faq.question}
                    </h3>
                    {isOpen && (
                      <p className="text-xs sm:text-sm text-[#999999] leading-relaxed pr-2">
                        {faq.answer}
                      </p>
                    )}
                  </div>
                </div>

                <span className="pt-3 text-white shrink-0">
                  {isOpen ? (
                    <Minus className="w-5 h-5" />
                  ) : (
                    <Plus className="w-5 h-5" />
                  )}
                </span>
              </button>
              <div className="h-[1px] w-full sv-faq-divider mt-5" />
            </div>
          );
        })}
      </div>
    </section>
  );

  // Reusable Pricing Section
  const renderPricingSection = () => (
    <section className="space-y-8" aria-label="Subscription Plans">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white font-display">
            Choose the plan that&apos;s right for you
          </h2>
          <p className="text-xs sm:text-sm text-[#999999] mt-1.5 max-w-2xl">
            Join Zappy and select from our flexible subscription options
            tailored to suit your viewing preferences. Get ready for non-stop
            entertainment!
          </p>
        </div>

        <div className="inline-flex items-center p-2 rounded-xl bg-[#0F0F0F] border border-[#262626] self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            className={`px-5 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
              billingCycle === 'monthly'
                ? 'bg-[#1F1F1F] text-white'
                : 'text-[#999999] hover:text-white'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('yearly')}
            className={`px-5 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
              billingCycle === 'yearly'
                ? 'bg-[#1F1F1F] text-white'
                : 'text-[#999999] hover:text-white'
            }`}
          >
            Yearly
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
        {ZAPPY_PLANS.map((plan) => (
          <div
            key={plan.name}
            className="rounded-xl bg-[#1A1A1A] border border-[#262626] p-6 sm:p-8 flex flex-col justify-between gap-6"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg sm:text-xl font-bold text-white font-display">
                  {plan.name}
                </h3>
                {plan.popular && (
                  <span className="px-2.5 py-0.5 rounded bg-[#E50000] text-white text-[11px] font-semibold">
                    Popular
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-[#999999] leading-relaxed">
                {plan.description}
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-4xl font-bold text-white font-display">
                  {billingCycle === 'monthly'
                    ? plan.monthlyPrice
                    : plan.yearlyPrice}
                </span>
                <span className="text-xs sm:text-sm font-medium text-[#999999]">
                  /{billingCycle === 'monthly' ? 'month' : 'year'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleNavigate('movies_shows')}
                  className="min-h-[46px] px-4 py-3 rounded-lg bg-[#141414] hover:bg-[#262626] border border-[#262626] text-xs sm:text-sm font-semibold text-white transition-colors cursor-pointer"
                >
                  Start Free Trial
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigate('movies_shows')}
                  className="min-h-[46px] px-4 py-3 rounded-lg bg-[#E50000] hover:bg-[#FF1A1A] text-xs sm:text-sm font-semibold text-white transition-colors cursor-pointer"
                >
                  Choose Plan
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  const topNavTabs: { id: NavView; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'movies_shows', label: 'Movies & Shows' },
    { id: 'support', label: 'Support' },
    { id: 'subscriptions', label: 'Subscriptions' },
  ];

  const openSupportTicketsCount = mergedSupportMessages.filter(
    (m) => m.status === 'open'
  ).length;

  return (
    <div className="min-h-screen w-full bg-[#141414] text-white flex flex-col overflow-x-hidden">
      {/* TOP ZAPPY NAVIGATION BAR (Compact 64px/68px height so Navbar + Hero fit 100% inside viewport without scrolling) */}
      <header className="sticky top-0 z-40 w-full bg-[#141414]/95 backdrop-blur-xl border-b border-[#262626]/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-[4.25rem] flex items-center justify-between gap-4">
          {/* Left: Attached Brand Logo Only (No App Name Text Beside or Below) */}
          <a
            href="#home"
            onClick={(e) => {
              e.preventDefault();
              handleNavigate('home');
            }}
            aria-label="Home"
            className="h-11 sm:h-12 w-32 sm:w-36 overflow-hidden flex items-center justify-center shrink-0 group"
          >
            <img
              src="/assets/aistudio/file_000000003a7c8208a896f64f3d00ee88-removebg-preview_03ffad4d.png"
              alt="Brand Logo"
              className="w-full h-full object-contain scale-[1.55] group-hover:scale-[1.62] transition-transform select-none pointer-events-none"
            />
          </a>

          {/* Center: Navigation Bar */}
          <nav
            aria-label="Primary Navigation"
            className="hidden lg:flex items-center gap-1 p-1.5 rounded-xl bg-[#0F0F0F] border-2 border-[#1F1F1F]"
          >
            {topNavTabs.map((tab) => {
              const isActive =
                activeView === tab.id ||
                (tab.id === 'movies_shows' && activeView === 'details');
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleNavigate(tab.id)}
                  className={`px-4 py-2 rounded-lg text-xs sm:text-sm transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#1A1A1A] text-white font-semibold shadow-sm'
                      : 'text-[#BFBFBF] hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Right: Search Icon, Watchlist, Notifications, Admin Studio, Profile */}
          <div className="flex items-center gap-2 sm:gap-2.5 relative">
            <button
              type="button"
              onClick={() => {
                setSearchBarOpen((prev) => !prev);
                if (activeView !== 'search') {
                  setActiveView('search');
                }
                setTimeout(() => searchInputRef.current?.focus(), 60);
              }}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                activeView === 'search'
                  ? 'bg-[#E50000] border-[#E50000] text-white'
                  : 'bg-[#1A1A1A] border-[#262626] text-white hover:border-[#E50000]'
              }`}
              aria-label="Search movies and shows"
              title="Search"
            >
              <Search className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => handleNavigate('watchlist')}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg border flex items-center justify-center transition-colors cursor-pointer relative ${
                activeView === 'watchlist'
                  ? 'bg-[#E50000] border-[#E50000] text-white'
                  : 'bg-[#1A1A1A] border-[#262626] text-white hover:border-[#E50000]'
              }`}
              aria-label="Watchlist"
              title="Watchlist"
            >
              <Bookmark className="w-4 h-4" />
              {watchlistItems.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#E50000] text-[10px] font-bold text-white flex items-center justify-center">
                  {watchlistItems.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setNotificationsOpen((prev) => !prev);
                setProfileMenuOpen(false);
              }}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[#1A1A1A] border border-[#262626] hover:border-[#E50000] text-white flex items-center justify-center transition-colors cursor-pointer relative"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {catalog.length > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#E50000]" />
              )}
            </button>

            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => openAdminStudio(null, 'support')}
                  className="hidden md:flex min-h-[38px] px-3 py-1.5 rounded-lg bg-[#1A1A1A] border border-[#262626] hover:border-[#E50000] text-white text-xs font-semibold items-center gap-1.5 cursor-pointer relative"
                  title="User Support Messages Inbox"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[#E50000]" />
                  <span>Support Inbox</span>
                  {openSupportTicketsCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-[#E50000] text-white text-[10px] font-bold">
                      {openSupportTicketsCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setVisualEditorActive((prev) => !prev)}
                  className={`hidden sm:flex min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold items-center gap-1.5 cursor-pointer transition-colors ${
                    visualEditorActive
                      ? 'bg-[#E50000] text-white'
                      : 'bg-[#1A1A1A] border border-[#262626] text-white hover:border-[#E50000]'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#E50000]" />
                  <span>{visualEditorActive ? 'Exit UI Editor' : 'Edit UI'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => openAdminStudio(null, 'catalog')}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#E50000] hover:bg-[#FF1A1A] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Admin Studio</span>
                </button>
              </>
            )}

            {!currentUser ? (
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#1A1A1A] hover:bg-[#262626] border border-[#262626] text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 text-[#E50000]" />
                <span className="hidden sm:inline">Sign In</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen((prev) => !prev);
                  setNotificationsOpen(false);
                }}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg overflow-hidden border border-[#262626] hover:border-[#E50000] bg-[#1A1A1A] flex items-center justify-center cursor-pointer"
                aria-label="User Profile"
              >
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'User'}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs font-bold text-white">
                    {currentUser.email?.slice(0, 2).toUpperCase() || 'ZP'}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="lg:hidden w-9 h-9 rounded-lg bg-[#1A1A1A] border border-[#262626] text-white flex items-center justify-center cursor-pointer"
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>

            {/* Notifications Dropdown */}
            <AnimatePresence>
              {notificationsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  className="absolute right-0 top-12 w-80 rounded-xl bg-[#1A1A1A] border border-[#262626] p-4 shadow-2xl z-50 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Latest Additions
                    </span>
                    <button
                      type="button"
                      onClick={() => setNotificationsOpen(false)}
                      className="text-xs text-[#999999] hover:text-white cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                  {featuredItems.length === 0 ? (
                    <p className="text-xs text-[#999999]">
                      No titles published yet. Sign in as {ADMIN_EMAIL} to add movies and shows!
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {featuredItems.slice(0, 3).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectMedia(item, true)}
                          className="w-full text-left p-2.5 rounded-lg bg-[#141414] hover:bg-[#262626] border border-[#262626] flex items-center justify-between gap-2 cursor-pointer"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">
                              {item.title}
                            </p>
                            <p className="text-[11px] text-[#999999] truncate">
                              {item.releaseYear} · {item.genres.slice(0, 2).join(', ')}
                            </p>
                          </div>
                          <Play className="w-3.5 h-3.5 text-[#E50000] fill-current shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Profile Dropdown */}
            <AnimatePresence>
              {profileMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  className="absolute right-0 top-12 w-64 rounded-xl bg-[#1A1A1A] border border-[#262626] p-3 shadow-2xl z-50 space-y-1"
                >
                  <div className="px-3 py-2 border-b border-[#262626]">
                    <p className="text-xs font-bold text-white truncate">
                      {currentUser?.displayName || currentUser?.email}
                    </p>
                    <p className="text-[11px] text-[#999999] truncate">
                      {isAdmin ? 'Zappy Administrator' : currentUser?.email}
                    </p>
                  </div>
                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={() => openAdminStudio(null, 'catalog')}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-[#E50000] hover:bg-[#141414] flex items-center gap-2 cursor-pointer"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Open Admin Studio</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openAdminStudio(null, 'support')}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-white hover:bg-[#141414] flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <MessageSquare className="w-3.5 h-3.5 text-[#E50000]" />
                          <span>Support Messages</span>
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-[#E50000] text-white text-[10px] font-bold">
                          {mergedSupportMessages.length}
                        </span>
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => handleNavigate('watchlist')}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs text-white hover:bg-[#141414] cursor-pointer"
                  >
                    My Watchlist ({watchlistItems.length})
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs text-red-400 hover:bg-[#141414] flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Mobile Dropdown Navigation Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="lg:hidden bg-[#0F0F0F] border-t border-[#262626] px-4 py-4 space-y-2"
            >
              {topNavTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleNavigate(tab.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium cursor-pointer ${
                    activeView === tab.id
                      ? 'bg-[#1A1A1A] text-white'
                      : 'text-[#BFBFBF]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              {isAdmin && (
                <div className="pt-2 border-t border-[#262626] flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openAdminStudio(null, 'catalog')}
                    className="flex-1 py-2.5 rounded-lg bg-[#E50000] text-white text-xs font-bold cursor-pointer"
                  >
                    Admin Studio
                  </button>
                  <button
                    type="button"
                    onClick={() => openAdminStudio(null, 'support')}
                    className="flex-1 py-2.5 rounded-lg bg-[#1A1A1A] border border-[#262626] text-white text-xs font-bold cursor-pointer"
                  >
                    Support Inbox ({mergedSupportMessages.length})
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Session Toast */}
      <AnimatePresence>
        {sessionToast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-2"
          >
            <div className="px-4 py-3 rounded-xl bg-[#1A1A1A] border border-[#E50000]/50 text-xs text-white flex items-center justify-between">
              <span>{sessionToast}</span>
              <button
                type="button"
                onClick={() => setSessionToast(null)}
                className="text-[#999999] hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN PAGE CONTENT (Tight top padding pt-3 sm:pt-4 so Navbar + Hero fit 100% inside 100dvh without scrolling) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-3 sm:pt-4 pb-10 space-y-16 sm:space-y-24">
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
                onBack={() => {
                  setPreviewDraftItem(null);
                  setActiveView('movies_shows');
                }}
                onSelectMedia={(item, auto) => {
                  setPreviewDraftItem(null);
                  handleSelectMedia(item, auto);
                }}
                onToggleWatchlist={handleToggleWatchlist}
                onMarkWatched={handleWatchComplete}
                onSelectGenre={(genre) => {
                  setPreviewDraftItem(null);
                  setSelectedGenre(genre);
                  setActiveView('search');
                }}
                onToggleAds={() => setAdsEnabled((prev) => !prev)}
                onOpenAdPolicy={() => setActiveModal('advertising')}
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
              className="space-y-8"
            >
              <div className="rounded-2xl bg-[#1A1A1A] border border-[#262626] p-5 sm:p-7 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h1 className="text-xl sm:text-3xl font-bold text-white font-display">
                      Search & Genre Explorer
                    </h1>
                    <p className="text-xs text-[#999999] mt-0.5">
                      Showing {filteredSearchCatalog.length} of {catalog.length}{' '}
                      published titles
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Content Type Filter */}
                    <div className="inline-flex items-center p-1 rounded-xl bg-[#141414] border border-[#262626]">
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
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                            searchTypeFilter === tab.id
                              ? 'bg-[#E50000] text-white'
                              : 'text-[#999999] hover:text-white'
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
                      className="h-9 px-3 rounded-xl bg-[#141414] border border-[#262626] text-xs font-semibold text-white focus:outline-none focus:border-[#E50000]"
                    >
                      <option value="relevance">Sort: Relevance</option>
                      <option value="popular">Sort: Top Rated</option>
                      <option value="newest">Sort: Newest Release</option>
                      <option value="title">Sort: Title (A-Z)</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => {
                        setSearchBarOpen(false);
                        setActiveView('home');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#141414] border border-[#262626] text-xs text-[#999999] hover:text-white cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="w-5 h-5 text-[#999999] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by movie or show title, actor, director, release year, or genre..."
                    className="w-full h-13 pl-12 pr-12 rounded-xl bg-[#141414] border border-[#262626] text-sm sm:text-base text-white placeholder:text-[#999999] focus:outline-none focus:border-[#E50000]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#999999] hover:text-white cursor-pointer"
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
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                      selectedGenre === 'All'
                        ? 'bg-[#E50000] text-white'
                        : 'bg-[#141414] border border-[#262626] text-[#999999] hover:text-white'
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
                        className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                          selectedGenre === g
                            ? 'bg-[#E50000] text-white'
                            : 'bg-[#141414] border border-[#262626] text-[#999999] hover:text-white'
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
                <div className="rounded-2xl bg-[#1A1A1A] border border-[#262626] p-10 text-center max-w-lg mx-auto space-y-4">
                  <p className="text-base font-bold text-white">
                    No matching titles found
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedGenre('All');
                      setSearchTypeFilter('all');
                    }}
                    className="px-5 py-2.5 rounded-lg bg-[#E50000] text-white text-xs font-semibold cursor-pointer"
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
              className="space-y-8"
            >
              <div>
                <h1 className="text-2xl sm:text-4xl font-bold text-white font-display">
                  My Watchlist ({watchlistItems.length})
                </h1>
                <p className="text-xs sm:text-sm text-[#999999] mt-1">
                  Saved movies and shows synced with your account. Titles you watch fully are automatically cleared from your watchlist.
                </p>
              </div>

              {watchlistItems.length === 0 ? (
                <div className="rounded-2xl bg-[#1A1A1A] border border-[#262626] p-10 text-center max-w-lg mx-auto space-y-4">
                  <Bookmark className="w-10 h-10 text-[#E50000] mx-auto" />
                  <h2 className="text-lg font-bold text-white">
                    Your Watchlist Is Empty
                  </h2>
                  <p className="text-xs sm:text-sm text-[#999999]">
                    Click the + button on any movie or show to save it here.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleNavigate('movies_shows')}
                    className="px-6 py-3 rounded-lg bg-[#E50000] text-white text-xs font-semibold cursor-pointer"
                  >
                    Browse Movies & Shows
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
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
              PAGE 2: MOVIES & SHOWS PAGE
          ========================================================= */
          activeView === 'movies_shows' ? (
            <motion.div
              key="movies-shows-page"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-16 sm:space-y-24"
            >
              {featuredItems.length > 0 && (
                <HeroBanner
                  featuredItems={featuredItems}
                  activeHeroIndex={activeHeroIndex}
                  onSelectHeroIndex={setActiveHeroIndex}
                  watchlistIds={activeWatchlistIds}
                  onPlayMedia={(item) => handleSelectMedia(item, true)}
                  onOpenDetails={(item) => handleSelectMedia(item, false)}
                  onToggleWatchlist={handleToggleWatchlist}
                />
              )}

              {/* Mobile Movies / Shows Switcher */}
              <div className="flex sm:hidden p-2 rounded-xl bg-[#0F0F0F] border border-[#262626]">
                <button
                  type="button"
                  onClick={() => setMobileShowsTab('movies')}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    mobileShowsTab === 'movies'
                      ? 'bg-[#1F1F1F] text-white'
                      : 'text-[#999999]'
                  }`}
                >
                  Movies
                </button>
                <button
                  type="button"
                  onClick={() => setMobileShowsTab('shows')}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    mobileShowsTab === 'shows'
                      ? 'bg-[#1F1F1F] text-white'
                      : 'text-[#999999]'
                  }`}
                >
                  Shows
                </button>
              </div>

              {/* BORDERED CONTAINER 1: MOVIES */}
              <div
                className={`relative rounded-2xl border border-[#262626] p-5 sm:p-10 lg:p-12 space-y-14 sm:space-y-20 ${
                  mobileShowsTab === 'shows' ? 'hidden sm:block' : 'block'
                }`}
              >
                <span className="hidden sm:inline-block absolute -top-4 left-10 px-5 py-2 rounded-lg bg-[#E50000] text-white text-sm font-semibold shadow-md">
                  Movies
                </span>

                {renderGenre2x2GridSection(
                  'Our Movie Genres',
                  undefined,
                  false,
                  'movie'
                )}
                {renderGenre2x2GridSection(
                  'Popular Top 10 In Genres',
                  undefined,
                  true,
                  'movie'
                )}

                <CarouselRow
                  title="Trending Movies Now"
                  items={moviesList.length > 0 ? moviesList : catalog}
                  watchlistIds={activeWatchlistIds}
                  onSelectMedia={handleSelectMedia}
                  onToggleWatchlist={handleToggleWatchlist}
                />

                <CarouselRow
                  title="New Releases"
                  cardVariant="release"
                  items={moviesList.length > 0 ? moviesList : catalog}
                  watchlistIds={activeWatchlistIds}
                  onSelectMedia={handleSelectMedia}
                  onToggleWatchlist={handleToggleWatchlist}
                />

                <CarouselRow
                  title="Must - Watch Movies"
                  cardVariant="must_watch"
                  items={moviesList.length > 0 ? moviesList : catalog}
                  watchlistIds={activeWatchlistIds}
                  onSelectMedia={handleSelectMedia}
                  onToggleWatchlist={handleToggleWatchlist}
                />
              </div>

              {/* BORDERED CONTAINER 2: SHOWS */}
              <div
                className={`relative rounded-2xl border border-[#262626] p-5 sm:p-10 lg:p-12 space-y-14 sm:space-y-20 ${
                  mobileShowsTab === 'movies' ? 'hidden sm:block' : 'block'
                }`}
              >
                <span className="hidden sm:inline-block absolute -top-4 left-10 px-5 py-2 rounded-lg bg-[#E50000] text-white text-sm font-semibold shadow-md">
                  Shows
                </span>

                {renderGenre2x2GridSection(
                  'Our Show Genres',
                  undefined,
                  false,
                  'series'
                )}
                {renderGenre2x2GridSection(
                  'Popular Top 10 In Genres',
                  undefined,
                  true,
                  'series'
                )}

                <CarouselRow
                  title="Trending Shows Now"
                  items={showsList.length > 0 ? showsList : catalog}
                  watchlistIds={activeWatchlistIds}
                  onSelectMedia={handleSelectMedia}
                  onToggleWatchlist={handleToggleWatchlist}
                />

                <CarouselRow
                  title="New Releases Shows"
                  cardVariant="release"
                  items={showsList.length > 0 ? showsList : catalog}
                  watchlistIds={activeWatchlistIds}
                  onSelectMedia={handleSelectMedia}
                  onToggleWatchlist={handleToggleWatchlist}
                />

                <CarouselRow
                  title="Must - Watch Shows"
                  cardVariant="must_watch"
                  items={showsList.length > 0 ? showsList : catalog}
                  watchlistIds={activeWatchlistIds}
                  onSelectMedia={handleSelectMedia}
                  onToggleWatchlist={handleToggleWatchlist}
                />
              </div>
            </motion.div>
          ) : /* =========================================================
              PAGE 5: SUPPORT PAGE (Sends messages directly to Admin Panel)
          ========================================================= */
          activeView === 'support' ? (
            <motion.div
              key="support-page"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-20"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
                {/* Left 5 Cols: Welcome Heading + 4x4 Poster Grid Frame */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="space-y-2.5">
                    <h1 className="text-2xl sm:text-4xl font-bold text-white font-display leading-tight">
                      Welcome to our support page!
                    </h1>
                    <p className="text-xs sm:text-sm text-[#999999] leading-relaxed">
                      We&apos;re here to help you with any problems you may be
                      having with Zappy. Every message sent here goes directly
                      to our Admin Studio inbox.
                    </p>
                  </div>

                  <div className="rounded-xl bg-[#0F0F0F] border-4 border-[#262626] p-4 grid grid-cols-4 gap-2.5 aspect-[4/3.6] overflow-hidden">
                    {Array.from({ length: 16 }, (_, idx) => {
                      const item =
                        catalog.length > 0
                          ? catalog[idx % catalog.length]
                          : null;
                      return (
                        <div
                          key={idx}
                          className="rounded-lg overflow-hidden bg-[#1A1A1A]"
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
                            <div className="w-full h-full bg-gradient-to-br from-[#262626] to-[#141414]" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right 7 Cols: Contact Form Box */}
                <form
                  onSubmit={handleSupportSubmit}
                  className="lg:col-span-7 rounded-xl bg-[#0F0F0F] border border-[#262626] p-6 sm:p-10 space-y-6"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
                        className="w-full h-12 px-4 rounded-lg bg-[#141414] border border-[#262626] text-xs sm:text-sm text-white placeholder:text-[#999999] focus:outline-none focus:border-[#E50000]"
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
                        className="w-full h-12 px-4 rounded-lg bg-[#141414] border border-[#262626] text-xs sm:text-sm text-white placeholder:text-[#999999] focus:outline-none focus:border-[#E50000]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
                        className="w-full h-12 px-4 rounded-lg bg-[#141414] border border-[#262626] text-xs sm:text-sm text-white placeholder:text-[#999999] focus:outline-none focus:border-[#E50000]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs sm:text-sm font-semibold text-white">
                        Phone Number
                      </label>
                      <div className="flex gap-2">
                        <span className="h-12 px-3 rounded-lg bg-[#141414] border border-[#262626] text-xs font-semibold text-white flex items-center shrink-0">
                          🇮🇳 +91
                        </span>
                        <input
                          type="tel"
                          value={supportPhone}
                          onChange={(e) => setSupportPhone(e.target.value)}
                          placeholder="Enter Phone Number"
                          className="flex-1 h-12 px-4 rounded-lg bg-[#141414] border border-[#262626] text-xs sm:text-sm text-white placeholder:text-[#999999] focus:outline-none focus:border-[#E50000]"
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
                      className="w-full p-4 rounded-lg bg-[#141414] border border-[#262626] text-xs sm:text-sm text-white placeholder:text-[#999999] focus:outline-none focus:border-[#E50000]"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                    <label className="flex items-center gap-2.5 text-xs sm:text-sm text-[#999999] cursor-pointer">
                      <input
                        type="checkbox"
                        required
                        checked={supportAgreed}
                        onChange={(e) => setSupportAgreed(e.target.checked)}
                        className="w-4 h-4 accent-[#E50000]"
                      />
                      <span>
                        I agree with Terms of Use and Privacy Policy
                      </span>
                    </label>

                    <button
                      type="submit"
                      disabled={isSendingSupport}
                      className="min-h-[48px] px-6 py-3 rounded-lg bg-[#E50000] hover:bg-[#FF1A1A] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60"
                    >
                      {isSendingSupport ? 'Sending...' : 'Send Message'}
                    </button>
                  </div>
                </form>
              </div>

              {renderFaqSection()}
            </motion.div>
          ) : /* =========================================================
              PAGE 6: SUBSCRIPTIONS PAGE
          ========================================================= */
          activeView === 'subscriptions' ? (
            <motion.div
              key="subscriptions-page"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-20"
            >
              {renderPricingSection()}

              {/* Plan Comparison Table Section */}
              <section className="space-y-8" aria-label="Compare Plans">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white font-display">
                    Compare our plans and find the right one for you
                  </h2>
                  <p className="text-xs sm:text-sm text-[#999999] mt-1.5 max-w-3xl">
                    Zappy offers three different plans to fit your needs: Basic,
                    Standard, and Premium. Compare the features of each plan and
                    choose the one that&apos;s right for you.
                  </p>
                </div>

                <div className="overflow-x-auto rounded-xl border border-[#262626]">
                  <table className="w-full text-left border-collapse min-w-[680px]">
                    <thead>
                      <tr className="bg-[#0F0F0F] border-b border-[#262626] text-sm sm:text-base font-semibold text-white">
                        <th className="p-5 border-r border-[#262626] w-1/4">
                          Features
                        </th>
                        <th className="p-5 border-r border-[#262626] w-1/4">
                          Basic
                        </th>
                        <th className="p-5 border-r border-[#262626] w-1/4">
                          <span className="inline-flex items-center gap-2">
                            <span>Standard</span>
                            <span className="px-2 py-0.5 rounded bg-[#E50000] text-white text-[10px] font-semibold">
                              Popular
                            </span>
                          </span>
                        </th>
                        <th className="p-5 w-1/4">Premium</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#262626] text-xs sm:text-sm text-[#999999] bg-[#141414]">
                      {PLAN_COMPARISON_ROWS.map((row) => (
                        <tr key={row.feature}>
                          <td className="p-5 border-r border-[#262626] font-medium text-[#BFBFBF]">
                            {row.feature}
                          </td>
                          <td className="p-5 border-r border-[#262626]">
                            {row.basic}
                          </td>
                          <td className="p-5 border-r border-[#262626]">
                            {row.standard}
                          </td>
                          <td className="p-5">{row.premium}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </motion.div>
          ) : (
            /* =========================================================
              PAGE 1: HOME PAGE (Hero Banner + Upside Navbar fit 100% in 100dvh without scrolling)
          ========================================================= */
            <motion.div
              key="home-page"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-16 sm:space-y-24"
            >
              {/* SECTION 1: HERO SPOTLIGHT BANNER OR MOSAIC (Fits 100% inside initial viewport with Navbar) */}
              {featuredItems.length > 0 ? (
                <HeroBanner
                  featuredItems={featuredItems}
                  activeHeroIndex={activeHeroIndex}
                  onSelectHeroIndex={setActiveHeroIndex}
                  watchlistIds={activeWatchlistIds}
                  onPlayMedia={(item) => handleSelectMedia(item, true)}
                  onOpenDetails={(item) => handleSelectMedia(item, false)}
                  onToggleWatchlist={handleToggleWatchlist}
                />
              ) : (
                <section className="relative h-[calc(100dvh-5.25rem)] min-h-[380px] max-h-[650px] rounded-2xl overflow-hidden border border-[#262626] bg-[#0F0F0F] flex flex-col justify-end">
                  <div className="absolute inset-0 overflow-hidden">
                    <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-9 gap-2.5 p-3 opacity-55">
                      {Array.from({ length: 36 }, (_, idx) => {
                        const item =
                          catalog.length > 0
                            ? catalog[idx % catalog.length]
                            : null;
                        return (
                          <div
                            key={idx}
                            className="aspect-[3/4] rounded-xl overflow-hidden bg-[#1A1A1A]"
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
                              <div className="w-full h-full bg-gradient-to-br from-[#262626] to-[#141414]" />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="absolute inset-0 bg-gradient-to-b from-[#141414] via-transparent to-[#141414]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/65 to-transparent" />

                    <div className="absolute inset-0 flex items-center justify-center pb-28 pointer-events-none">
                      <div className="px-6 py-3 rounded-3xl bg-black/55 border border-white/15 backdrop-blur-md flex items-center justify-center shadow-2xl">
                        <div className="h-16 sm:h-20 w-44 sm:w-56 overflow-hidden flex items-center justify-center">
                          <img
                            src="/assets/aistudio/file_000000003a7c8208a896f64f3d00ee88-removebg-preview_03ffad4d.png"
                            alt="Brand Logo"
                            className="w-full h-full object-contain scale-[1.55] select-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative z-10 px-4 pb-8 sm:pb-10 text-center max-w-4xl mx-auto space-y-4">
                    <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white font-display tracking-tight">
                      The Best Streaming Experience on Zappy
                    </h1>
                    <p className="text-xs sm:text-sm text-[#999999] leading-relaxed max-w-2xl mx-auto">
                      Zappy is the best streaming experience for watching your
                      favorite movies and shows on demand, anytime, anywhere.
                    </p>
                    <div className="pt-1 flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleNavigate('movies_shows')}
                        className="min-h-[48px] px-6 py-3 rounded-lg bg-[#E50000] hover:bg-[#FF1A1A] text-white font-semibold text-sm flex items-center gap-2.5 cursor-pointer shadow-xl shadow-[#E50000]/25 transition-colors"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>Start Watching Now</span>
                      </button>

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => openAdminStudio(null, 'catalog')}
                          className="min-h-[48px] px-5 py-3 rounded-lg bg-[#1A1A1A] hover:bg-[#262626] border border-[#262626] text-white font-semibold text-sm flex items-center gap-2 cursor-pointer"
                        >
                          <Plus className="w-4 h-4 text-[#E50000]" />
                          <span>Add Movies / Shows</span>
                        </button>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* Continue Watching Row */}
              {continueWatchingItems.length > 0 && (
                <ContinueWatchingRow
                  items={continueWatchingItems}
                  onSelectMedia={handleSelectMedia}
                  onSeeAll={() => handleNavigate('movies_shows')}
                />
              )}

              {/* Live Published Catalog Carousels right on Home */}
              {catalog.length > 0 && (
                <CarouselRow
                  title="Trending Movies & Shows"
                  subtitle="Click any poster to stream immediately in 4K UHD"
                  items={catalog}
                  watchlistIds={activeWatchlistIds}
                  onSelectMedia={handleSelectMedia}
                  onToggleWatchlist={handleToggleWatchlist}
                />
              )}

              {/* SECTION 2: "Explore our wide variety of categories" */}
              {renderGenre2x2GridSection(
                'Explore our wide variety of categories',
                "Whether you're looking for a comedy to make you laugh, a drama to make you think, or a documentary to learn something new"
              )}

              {/* SECTION 3: "We Provide you streaming experience across various devices." */}
              <section
                className="space-y-8"
                aria-label="Supported Streaming Devices"
              >
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white font-display">
                    We Provide you streaming experience across various devices.
                  </h2>
                  <p className="text-xs sm:text-sm text-[#999999] mt-1.5 max-w-3xl">
                    With Zappy, you can enjoy your favorite movies and TV shows
                    anytime, anywhere. Our platform is designed to be compatible
                    with a wide range of devices, ensuring that you never miss a
                    moment of entertainment.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                  {ZAPPY_DEVICES.map((device) => {
                    const Icon = device.icon;
                    return (
                      <div
                        key={device.title}
                        className="sv-device-card rounded-xl border border-[#262626] p-6 sm:p-8 space-y-5"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="w-12 h-12 rounded-xl bg-[#141414] border border-[#1F1F1F] text-[#E50000] flex items-center justify-center shrink-0">
                            <Icon className="w-6 h-6" />
                          </div>
                          <h3 className="text-lg sm:text-xl font-semibold text-white font-display">
                            {device.title}
                          </h3>
                        </div>
                        <p className="text-xs sm:text-sm text-[#999999] leading-relaxed">
                          {device.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* SECTION 4: FREQUENTLY ASKED QUESTIONS */}
              {renderFaqSection()}

              {/* SECTION 5: CHOOSE THE PLAN THAT'S RIGHT FOR YOU */}
              {renderPricingSection()}
            </motion.div>
          )}
        </AnimatePresence>

        {/* BOTTOM FREE TRIAL CTA BANNER */}
        <section
          aria-label="Free Trial Call to Action"
          className="relative rounded-xl overflow-hidden border border-[#262626] bg-[#0F0F0F] p-8 sm:p-12 lg:p-16"
        >
          <div className="absolute inset-0 grid grid-cols-4 sm:grid-cols-8 gap-2 opacity-25 pointer-events-none">
            {Array.from({ length: 16 }, (_, idx) => {
              const item =
                catalog.length > 0 ? catalog[idx % catalog.length] : null;
              return (
                <div key={idx} className="w-full h-full overflow-hidden">
                  {item && (
                    <MediaArtwork
                      src={item.posterUrl}
                      alt={item.title}
                      item={item}
                      aspectRatio="poster"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(90deg, #0F0F0F 2%, rgba(20, 15, 15, 0.96) 25%, rgba(34, 14, 14, 0.90) 55%, rgba(229, 0, 0, 0.35) 100%)',
            }}
          />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white font-display">
                Start your free trial today!
              </h2>
              <p className="text-xs sm:text-sm text-[#999999]">
                Sign up for a free trial of Zappy and stream your favorite
                movies and series in 4K UHD.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleNavigate('movies_shows')}
              className="min-h-[48px] px-6 py-3.5 rounded-lg bg-[#E50000] hover:bg-[#FF1A1A] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer self-start lg:self-auto shrink-0"
            >
              Start a Free Trial
            </button>
          </div>
        </section>
      </main>

      {/* 6-COLUMN DARK FOOTER (#0F0F0F) */}
      <footer className="mt-auto bg-[#0F0F0F] border-t border-[#262626] pt-14 pb-10 px-4 sm:px-6 lg:px-8 text-xs sm:text-sm text-[#999999]">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-8">
            <div className="space-y-3">
              <h3 className="text-white font-semibold text-base">Home</h3>
              <ul className="space-y-2">
                <li>
                  <button
                    type="button"
                    onClick={() => handleNavigate('home')}
                    className="hover:text-white cursor-pointer"
                  >
                    Categories
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleNavigate('home')}
                    className="hover:text-white cursor-pointer"
                  >
                    Devices
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleNavigate('subscriptions')}
                    className="hover:text-white cursor-pointer"
                  >
                    Pricing
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleNavigate('support')}
                    className="hover:text-white cursor-pointer"
                  >
                    FAQ
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
                    onClick={() => handleNavigate('movies_shows')}
                    className="hover:text-white cursor-pointer"
                  >
                    Genres
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleNavigate('movies_shows')}
                    className="hover:text-white cursor-pointer"
                  >
                    Trending
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleNavigate('movies_shows')}
                    className="hover:text-white cursor-pointer"
                  >
                    New Release
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleNavigate('movies_shows')}
                    className="hover:text-white cursor-pointer"
                  >
                    Popular
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-white font-semibold text-base">Shows</h3>
              <ul className="space-y-2">
                <li>
                  <button
                    type="button"
                    onClick={() => handleNavigate('movies_shows')}
                    className="hover:text-white cursor-pointer"
                  >
                    Genres
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleNavigate('movies_shows')}
                    className="hover:text-white cursor-pointer"
                  >
                    Trending
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleNavigate('movies_shows')}
                    className="hover:text-white cursor-pointer"
                  >
                    New Release
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleNavigate('movies_shows')}
                    className="hover:text-white cursor-pointer"
                  >
                    Popular
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-white font-semibold text-base">Support</h3>
              <ul className="space-y-2">
                <li>
                  <button
                    type="button"
                    onClick={() => handleNavigate('support')}
                    className="hover:text-white cursor-pointer"
                  >
                    Contact Us
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-white font-semibold text-base">
                Subscription
              </h3>
              <ul className="space-y-2">
                <li>
                  <button
                    type="button"
                    onClick={() => handleNavigate('subscriptions')}
                    className="hover:text-white cursor-pointer"
                  >
                    Plans
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleNavigate('subscriptions')}
                    className="hover:text-white cursor-pointer"
                  >
                    Features
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-white font-semibold text-base">
                Connect With Us
              </h3>
              <div className="flex items-center gap-2.5">
                {['FB', 'TW', 'IN'].map((social) => (
                  <button
                    key={social}
                    type="button"
                    onClick={() => handleNavigate('support')}
                    className="w-10 h-10 rounded-lg bg-[#1A1A1A] hover:bg-[#262626] border border-[#262626] text-white text-xs font-bold flex items-center justify-center cursor-pointer"
                  >
                    {social}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#999999]">
            <div className="flex items-center gap-4">
              <div className="h-9 w-28 overflow-hidden flex items-center justify-center shrink-0">
                <img
                  src="/assets/aistudio/file_000000003a7c8208a896f64f3d00ee88-removebg-preview_03ffad4d.png"
                  alt="Brand Logo"
                  className="w-full h-full object-contain scale-[1.55] select-none pointer-events-none"
                />
              </div>
              <p className="border-l border-[#262626] pl-4">
                © 2026 All Rights Reserved
              </p>
            </div>
            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={() => setActiveModal('terms')}
                className="hover:text-white cursor-pointer"
              >
                Terms of Use
              </button>
              <span className="text-[#262626]">|</span>
              <button
                type="button"
                onClick={() => setActiveModal('privacy')}
                className="hover:text-white cursor-pointer"
              >
                Privacy Policy
              </button>
              <span className="text-[#262626]">|</span>
              <button
                type="button"
                onClick={() => setActiveModal('advertising')}
                className="hover:text-white cursor-pointer"
              >
                Cookie Policy
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* ADMIN STUDIO MODAL (Catalog + User Support Messages Inbox) */}
      <AdminStudioModal
        isOpen={adminStudioOpen}
        currentUser={currentUser}
        prefillMedia={adminPrefillMedia}
        catalog={catalog}
        videoAdConfig={videoAdConfig}
        supportMessages={mergedSupportMessages}
        initialTab={adminInitialTab}
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
          handleSelectMedia(item, true);
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

      {/* INFO & PREFERENCES MODAL */}
      <InfoModal
        modalType={activeModal}
        adsEnabled={adsEnabled}
        onToggleAds={() => setAdsEnabled((prev) => !prev)}
        onClose={() => setActiveModal(null)}
      />
    </div>
  );
}
