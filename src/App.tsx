import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  X,
  Tv,
  Bookmark,
  Compass,
  Home,
  SlidersHorizontal,
  Play,
  Trash2,
  AlertTriangle,
  Layers,
  Clock,
  Folder,
  Download,
  Settings,
  LogOut,
  LogIn,
  Bell,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  ShieldCheck,
  Plus,
  Sparkles,
} from 'lucide-react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  auth,
  db,
  ADMIN_EMAIL,
  isUserAdmin,
  signInWithGoogle,
  signOutUser,
  handleFirestoreError,
  OperationType,
} from './firebase';
import { MediaItem, Genre, VideoAdConfig } from './types/media';
import { ALL_GENRES } from './data/catalog';
import { HeroBanner } from './components/HeroBanner';
import { CarouselRow } from './components/CarouselRow';
import { MovieCard } from './components/MovieCard';
import { DetailsView } from './components/DetailsView';
import { AdBanner } from './components/AdBanner';
import { InfoModal, InfoModalType } from './components/InfoModal';
import {
  ContinueWatchingRow,
  WatchProgressEntry,
} from './components/ContinueWatchingRow';
import { AdminStudioModal } from './components/AdminStudioModal';

type NavView =
  | 'home'
  | 'explore'
  | 'movies'
  | 'series'
  | 'genres'
  | 'watchlist'
  | 'continue_watching'
  | 'recently_added'
  | 'collections'
  | 'downloads'
  | 'details'
  | 'not_found';

type SortOption =
  | 'featured'
  | 'year_desc'
  | 'year_asc'
  | 'title_asc'
  | 'title_desc';

const WATCHLIST_STORAGE_KEY = 'zappy_watchlist_v2';
const ADS_STORAGE_KEY = 'zappy_ads_enabled_v1';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);

  const [catalog, setCatalog] = useState<MediaItem[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(true);
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

  // Admin Studio Modal State
  const [adminStudioOpen, setAdminStudioOpen] = useState<boolean>(false);
  const [adminPrefillMedia, setAdminPrefillMedia] =
    useState<MediaItem | null>(null);

  // Sidebar collapsed state on desktop + drawer state on mobile
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Header popovers (Notifications & Profile menu)
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState<boolean>(false);
  const [sessionToast, setSessionToast] = useState<string | null>(null);

  // Search, Filter & Sort State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [selectedContentType, setSelectedContentType] = useState<
    'all' | 'movie' | 'series'
  >('all');
  const [onlyPlayableDemo, setOnlyPlayableDemo] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<SortOption>('featured');

  // Watchlist / Favourites State (synced with Firestore when logged in, localStorage for guests)
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

  const isAdmin = isUserAdmin(currentUser?.email, currentUser?.emailVerified);

  const showToast = (msg: string) => {
    setSessionToast(msg);
    setTimeout(() => setSessionToast(null), 3500);
  };

  // 1. Listen to Firebase Authentication State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // 2. Real-time Cloud Firestore Catalog Subscription (/catalog where visibility == 'public')
  useEffect(() => {
    setIsLoadingCatalog(true);
    const catalogQuery = query(
      collection(db, 'catalog'),
      where('visibility', '==', 'public')
    );

    const unsubscribe = onSnapshot(
      catalogQuery,
      (snapshot) => {
        const items: MediaItem[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const mediaType = data.mediaType === 'tv' ? 'tv' : 'movie';
          return {
            id: data.id || docSnap.id,
            tmdbId: Number(data.tmdbId) || 1,
            mediaType,
            title: data.title || 'Untitled',
            tagline: data.tagline || '',
            synopsis: data.synopsis || '',
            contentType:
              data.contentType === 'series' || mediaType === 'tv'
                ? 'series'
                : 'movie',
            genres:
              Array.isArray(data.genres) && data.genres.length > 0
                ? data.genres
                : ['Drama'],
            releaseYear: Number(data.releaseYear) || 2024,
            durationMinutes: Number(data.durationMinutes) || 120,
            maturityRating: data.maturityRating || 'PG-13',
            directorOrCreator: data.directorOrCreator || 'Featured Creator',
            cast: Array.isArray(data.cast) ? data.cast : ['Featured Cast'],
            posterUrl: data.posterUrl || '',
            backdropUrl: data.backdropUrl || data.posterUrl || '',
            cinesrcEmbedUrl:
              data.cinesrcEmbedUrl ||
              `https://cinesrc.st/embed/${mediaType}/${data.tmdbId}`,
            justWatchUrl: data.justWatchUrl || '',
            visibility: data.visibility || 'public',
            authorUid: data.authorUid || '',
            availabilityStatus: 'playable_demo',
            availabilityNote: `CineSrc.st Stream · TMDB #${data.tmdbId}`,
            featured: Boolean(data.featured),
            popularScore: Number(data.popularScore) || 92,
            recentlyAdded: true,
            seasonsCount: Number(data.seasonsCount) || 1,
            episodesCount: Number(data.episodesCount) || 8,
            visualTheme: {
              primaryHex: '#1A1625',
              secondaryHex: '#251E35',
              accentHex: '#B892FF',
              motif: 'horizon',
            },
          };
        });

        setCatalog(items);
        setIsLoadingCatalog(false);

        // Keep selectedMedia in sync if it was edited
        setSelectedMedia((prev) => {
          if (!prev) return null;
          return items.find((i) => i.id === prev.id) || prev;
        });

        // Handle deep link if present in URL
        const params = new URLSearchParams(window.location.search);
        const requestedTitleId = params.get('title');
        const requestedTmdbId = params.get('tmdbId');
        if ((requestedTitleId || requestedTmdbId) && items.length > 0) {
          const match = items.find(
            (item) =>
              item.id === requestedTitleId ||
              (requestedTmdbId && item.tmdbId === Number(requestedTmdbId))
          );
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

  // 3. Real-time Cloud Firestore Watchlist Subscription for Authenticated Users
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

  // Sync Watchlist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlistIds));
    } catch {
      // Ignore storage errors
    }
  }, [watchlistIds]);

  // Sync Ad Setting to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(ADS_STORAGE_KEY, String(adsEnabled));
    } catch {
      // Ignore storage errors
    }
  }, [adsEnabled]);

  // Update document title dynamically
  useEffect(() => {
    if (activeView === 'details' && selectedMedia) {
      document.title = `Watch ${selectedMedia.title} — ZAPPY`;
    } else if (activeView === 'watchlist') {
      document.title = `Favourites (${watchlistIds.length}) — ZAPPY`;
    } else if (
      activeView === 'explore' ||
      activeView === 'movies' ||
      activeView === 'series'
    ) {
      document.title = 'Explore Films & Series — ZAPPY';
    } else if (activeView === 'genres') {
      document.title = `${
        selectedGenre === 'All' ? 'All Genres' : selectedGenre
      } — ZAPPY`;
    } else {
      document.title = 'ZAPPY — Free Ad-Supported Movies & TV Discovery';
    }
  }, [activeView, selectedMedia, watchlistIds.length, selectedGenre]);

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithGoogle();
      if (isUserAdmin(result.user.email, result.user.emailVerified)) {
        showToast(
          `Welcome Admin (${result.user.email})! Admin Studio unlocked.`
        );
      } else {
        showToast(`Signed in as ${result.user.displayName || result.user.email}`);
      }
    } catch {
      showToast('Google Sign-In was cancelled or blocked.');
    }
  };

  const handleLogout = async () => {
    try {
      await signOutUser();
      setProfileMenuOpen(false);
      showToast('Signed out of ZAPPY.');
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

    // Optimistic local state update
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

  const handleSelectMedia = (item: MediaItem, autoPlay = false) => {
    setSelectedMedia(item);
    setAutoPlayOnOpen(autoPlay);
    setActiveView('details');
    setNotificationsOpen(false);
    setProfileMenuOpen(false);
    setMobileMenuOpen(false);

    if (!watchProgressMap[item.id]) {
      setWatchProgressMap((prev) => ({
        [item.id]: {
          mediaId: item.id,
          seasonEpisodeLabel:
            item.contentType === 'series' ? 'S1, Ep-1' : 'Feature',
          remainingLabel: `${item.durationMinutes}min`,
          progressPercent: 22,
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

    if (view === 'movies') {
      setSelectedContentType('movie');
    } else if (view === 'series') {
      setSelectedContentType('series');
    } else if (view === 'downloads') {
      setOnlyPlayableDemo(true);
    } else if (view === 'home') {
      setSelectedContentType('all');
      setSelectedGenre('All');
      setOnlyPlayableDemo(false);
      setSearchQuery('');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetAllFilters = () => {
    setSearchQuery('');
    setSelectedGenre('All');
    setSelectedContentType('all');
    setOnlyPlayableDemo(false);
    setSortBy('featured');
  };

  const openAdminStudio = (mediaItem: MediaItem | null = null) => {
    setAdminPrefillMedia(mediaItem);
    setAdminStudioOpen(true);
    setMobileMenuOpen(false);
    setProfileMenuOpen(false);
  };

  const featuredItems = useMemo(() => {
    const feat = catalog.filter((item) => item.featured);
    return (feat.length > 0 ? feat : catalog).slice(0, 5);
  }, [catalog]);

  const continueWatchingItems = useMemo(() => {
    const entries: { item: MediaItem; progress: WatchProgressEntry }[] = [];
    Object.values(watchProgressMap).forEach((progress) => {
      const found = catalog.find((c) => c.id === progress.mediaId);
      if (found) {
        entries.push({ item: found, progress });
      }
    });
    return entries;
  }, [catalog, watchProgressMap]);

  const popularMovies = useMemo(
    () => catalog.filter((i) => i.contentType === 'movie'),
    [catalog]
  );

  const tvSeriesItems = useMemo(
    () => catalog.filter((i) => i.contentType === 'series'),
    [catalog]
  );

  const getItemsByGenre = (genre: Genre) =>
    catalog.filter((i) => i.genres.includes(genre));

  const watchlistItems = useMemo(
    () => catalog.filter((item) => watchlistIds.includes(item.id)),
    [catalog, watchlistIds]
  );

  const relatedForSelected = useMemo(() => {
    if (!selectedMedia) return [];
    return catalog
      .filter((item) => item.id !== selectedMedia.id)
      .slice(0, 6);
  }, [catalog, selectedMedia]);

  const filteredCatalog = useMemo(() => {
    let result = [...catalog];

    if (activeView === 'continue_watching') {
      result = result.filter((item) => Boolean(watchProgressMap[item.id]));
    }

    const effectiveType =
      activeView === 'movies'
        ? 'movie'
        : activeView === 'series'
        ? 'series'
        : selectedContentType;

    if (effectiveType !== 'all') {
      result = result.filter((item) => item.contentType === effectiveType);
    }

    if (selectedGenre !== 'All') {
      result = result.filter((item) =>
        item.genres.includes(selectedGenre as Genre)
      );
    }

    if (searchQuery.trim() !== '') {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.synopsis.toLowerCase().includes(q) ||
          item.directorOrCreator.toLowerCase().includes(q) ||
          String(item.tmdbId).includes(q) ||
          item.genres.some((g) => g.toLowerCase().includes(q)) ||
          item.cast.some((actor) => actor.toLowerCase().includes(q)) ||
          String(item.releaseYear).includes(q)
      );
    }

    if (sortBy === 'year_desc') {
      result.sort((a, b) => b.releaseYear - a.releaseYear);
    } else if (sortBy === 'year_asc') {
      result.sort((a, b) => a.releaseYear - b.releaseYear);
    } else if (sortBy === 'title_asc') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'title_desc') {
      result.sort((a, b) => b.title.localeCompare(a.title));
    }

    return result;
  }, [
    catalog,
    activeView,
    selectedContentType,
    selectedGenre,
    searchQuery,
    sortBy,
    watchProgressMap,
  ]);

  const isSearchingOrFilteringOnHome =
    activeView === 'home' &&
    (searchQuery.trim() !== '' ||
      selectedGenre !== 'All' ||
      selectedContentType !== 'all' ||
      onlyPlayableDemo ||
      sortBy !== 'featured');

  const mainNavItems = [
    { id: 'home' as NavView, label: 'Home', icon: Home },
    { id: 'explore' as NavView, label: 'Explore', icon: Compass },
    { id: 'genres' as NavView, label: 'Genres', icon: Layers },
    { id: 'watchlist' as NavView, label: 'Favourites', icon: Bookmark },
  ];

  const secondaryNavItems = [
    {
      id: 'continue_watching' as NavView,
      label: 'Continue Watching',
      icon: Play,
    },
    { id: 'recently_added' as NavView, label: 'Recently Added', icon: Clock },
    { id: 'collections' as NavView, label: 'My Collections', icon: Folder },
    { id: 'downloads' as NavView, label: 'All Streams', icon: Download },
  ];

  return (
    <div className="min-h-screen w-full bg-[#110E17] text-[#F5F5F7] flex flex-col lg:flex-row p-0 sm:p-3 lg:p-4 gap-0 lg:gap-6 pb-16 lg:pb-4 overflow-x-hidden">
      {/* MOBILE DRAWER OVERLAY */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* LEFT SIDEBAR NAVIGATION */}
      <aside
        aria-label="Sidebar Navigation"
        className={`fixed lg:sticky top-0 lg:top-4 bottom-0 left-0 z-50 lg:z-30 flex flex-col justify-between rounded-none lg:rounded-3xl border-r lg:border border-white/[0.08] sidebar-ambient-glow transition-all duration-200 shrink-0 ${
          sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'
        } ${
          mobileMenuOpen
            ? 'translate-x-0 w-64 p-5'
            : '-translate-x-full lg:translate-x-0 p-5'
        } lg:h-[calc(100vh-2rem)]`}
      >
        <div className="space-y-6 overflow-y-auto no-scrollbar">
          {/* Brand Logo: ZAPPY */}
          <div className="flex items-center justify-between gap-2 px-1">
            <a
              href="#home"
              onClick={(e) => {
                e.preventDefault();
                handleNavigate('home');
              }}
              className="flex items-center gap-3 min-w-0 group"
            >
              <div className="w-9 h-9 rounded-xl bg-[#B892FF] text-[#110E17] flex items-center justify-center shrink-0 shadow-md shadow-[#B892FF]/25">
                <Tv className="w-5 h-5 stroke-[2.4]" />
              </div>
              {!sidebarCollapsed && (
                <span className="text-xl font-bold tracking-tight text-white font-display truncate">
                  ZAPPY
                </span>
              )}
            </a>

            <button
              type="button"
              onClick={() => {
                if (mobileMenuOpen) {
                  setMobileMenuOpen(false);
                } else {
                  setSidebarCollapsed((prev) => !prev);
                }
              }}
              className="min-h-[36px] min-w-[36px] rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.06] flex items-center justify-center transition-colors cursor-pointer shrink-0"
              aria-label={
                sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'
              }
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Primary Navigation */}
          <nav aria-label="Main Menu" className="space-y-1">
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigate(item.id)}
                  className={`w-full min-h-[44px] px-3 py-2.5 rounded-xl flex items-center gap-3.5 text-sm transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-white/[0.07] text-white font-semibold'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]'
                  }`}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-[#B892FF]' : 'text-zinc-400'
                    }`}
                  />
                  {!sidebarCollapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="border-t border-white/[0.07]" />

          {/* Secondary Library Group */}
          <nav aria-label="Library Menu" className="space-y-1">
            {secondaryNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigate(item.id)}
                  className={`w-full min-h-[44px] px-3 py-2.5 rounded-xl flex items-center gap-3.5 text-sm transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-white/[0.07] text-white font-semibold'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]'
                  }`}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-[#B892FF]' : 'text-zinc-400'
                    }`}
                  />
                  {!sidebarCollapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="border-t border-white/[0.07]" />

          {/* Admin Panel Button (Visible & Unlocked for pawarayushai1@gmail.com) */}
          <div className="space-y-1">
            {isAdmin && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => openAdminStudio(null)}
                className="w-full min-h-[44px] px-3 py-2.5 rounded-xl flex items-center gap-3.5 text-sm text-[#110E17] bg-[#B892FF] hover:bg-[#C9ABFF] font-bold transition-colors cursor-pointer shadow-lg shadow-[#B892FF]/25"
                title={sidebarCollapsed ? 'Admin Panel' : undefined}
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && (
                  <span className="truncate">Admin Panel</span>
                )}
              </motion.button>
            )}

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setActiveModal('advertising');
              }}
              className="w-full min-h-[44px] px-3 py-2.5 rounded-xl flex items-center gap-3.5 text-sm text-zinc-300 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer"
              title={sidebarCollapsed ? 'Settings' : undefined}
            >
              <Settings className="w-4 h-4 text-zinc-400 shrink-0" />
              {!sidebarCollapsed && <span>Settings</span>}
            </button>
          </div>
        </div>

        {/* Bottom Auth Action (Google Sign-In or Logout) */}
        <div className="pt-4 border-t border-white/[0.05]">
          {currentUser ? (
            <button
              type="button"
              onClick={handleLogout}
              className="w-full min-h-[44px] px-3 py-2.5 rounded-xl flex items-center gap-3.5 text-sm text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer"
              title={sidebarCollapsed ? 'Sign Out' : undefined}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span className="truncate">Sign Out</span>}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full min-h-[44px] px-3 py-2.5 rounded-xl flex items-center gap-3.5 text-sm text-[#B892FF] bg-[#B892FF]/10 hover:bg-[#B892FF]/20 font-semibold transition-colors cursor-pointer"
              title={sidebarCollapsed ? 'Sign in with Google' : undefined}
            >
              <LogIn className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && (
                <span className="truncate">Google Sign-In</span>
              )}
            </button>
          )}
        </div>
      </aside>

      {/* RIGHT MAIN WORKSPACE COLUMN */}
      <div className="flex-1 min-w-0 flex flex-col px-4 sm:px-3 lg:px-2">
        {/* TOP HEADER BAR */}
        <header className="sticky top-0 z-30 py-3 sm:py-3.5 bg-[#110E17]/90 backdrop-blur-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 max-w-xl">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden min-h-[42px] min-w-[42px] rounded-xl bg-[#1A1625] border border-white/[0.08] text-zinc-200 flex items-center justify-center shrink-0 cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (activeView === 'details' || activeView === 'not_found') {
                    setActiveView('home');
                  }
                }}
                placeholder="Search movies, TV shows, TMDB IDs, or actors..."
                aria-label="Search movies, TV shows, TMDB IDs, or actors"
                className="w-full min-h-[44px] pl-11 pr-9 py-2 rounded-2xl bg-[#1A1625] border border-white/[0.08] text-xs sm:text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#B892FF] transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 min-h-[32px] min-w-[32px] rounded-lg text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 relative">
            {isAdmin && (
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={() => openAdminStudio(null)}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#B892FF] text-[#110E17] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#B892FF]/20"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add Movie / Show</span>
              </motion.button>
            )}

            {!currentUser && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={handleGoogleLogin}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#1A1625] border border-[#B892FF]/40 text-xs font-semibold text-[#B892FF] hover:bg-[#B892FF]/15 flex items-center gap-1.5 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </motion.button>
            )}

            <button
              type="button"
              onClick={() => {
                setNotificationsOpen((prev) => !prev);
                setProfileMenuOpen(false);
              }}
              className="relative min-h-[42px] min-w-[42px] rounded-full bg-[#1A1625] hover:bg-[#241E33] border border-white/[0.08] text-zinc-200 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="View notifications"
            >
              <Bell className="w-4 h-4" />
              {catalog.length > 0 && (
                <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#FF5E5E]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setProfileMenuOpen((prev) => !prev);
                setNotificationsOpen(false);
              }}
              className="min-h-[42px] min-w-[42px] rounded-full p-0.5 bg-gradient-to-tr from-[#B892FF] to-[#FF8A3D] cursor-pointer"
              aria-label="Open user profile menu"
            >
              {currentUser?.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || 'User'}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-full object-cover"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[#1A1625] flex items-center justify-center text-xs font-bold text-white font-display">
                  {currentUser?.email
                    ? currentUser.email.slice(0, 2).toUpperCase()
                    : 'ZP'}
                </div>
              )}
            </button>

            {/* Notifications Dropdown Popover */}
            <AnimatePresence>
              {notificationsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.18 }}
                  className="absolute right-0 top-14 w-80 rounded-2xl bg-[#1A1625] border border-white/15 p-4 shadow-2xl z-50 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Latest on ZAPPY
                    </span>
                    <button
                      type="button"
                      onClick={() => setNotificationsOpen(false)}
                      className="text-xs text-zinc-400 hover:text-white cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                  {featuredItems.length === 0 ? (
                    <p className="text-xs text-zinc-400">
                      No movies added yet. Sign in as {ADMIN_EMAIL} to add movies via CineSrc.st & JustWatch!
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {featuredItems.slice(0, 3).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectMedia(item, true)}
                          className="w-full text-left p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] transition-colors flex items-center justify-between gap-2 cursor-pointer"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">
                              {item.title}
                            </p>
                            <p className="text-[11px] text-[#B892FF] truncate font-mono-tabular">
                              TMDB #{item.tmdbId} · CineSrc.st Ready
                            </p>
                          </div>
                          <Play className="w-3.5 h-3.5 text-[#B892FF] fill-current shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Profile Dropdown Popover */}
            <AnimatePresence>
              {profileMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.18 }}
                  className="absolute right-0 top-14 w-64 rounded-2xl bg-[#1A1625] border border-white/15 p-3 shadow-2xl z-50 space-y-1"
                >
                  <div className="px-3 py-2 border-b border-white/[0.08]">
                    <p className="text-xs font-bold text-white truncate">
                      {currentUser
                        ? currentUser.displayName || currentUser.email
                        : 'Guest Viewer'}
                    </p>
                    <p className="text-[11px] text-zinc-400 truncate">
                      {currentUser
                        ? isAdmin
                          ? 'Verified ZAPPY Admin'
                          : currentUser.email
                        : 'Sign in with Google to sync Favourites'}
                    </p>
                  </div>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => openAdminStudio(null)}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-[#B892FF] hover:bg-white/[0.07] cursor-pointer flex items-center gap-2"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Open Admin Panel</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleNavigate('watchlist')}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs text-zinc-200 hover:bg-white/[0.07] cursor-pointer"
                  >
                    My Favourites ({watchlistIds.length})
                  </button>

                  {currentUser ? (
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs text-red-300 hover:bg-white/[0.07] cursor-pointer"
                    >
                      Sign Out
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-[#B892FF] hover:bg-white/[0.07] cursor-pointer"
                    >
                      Sign in with Google
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        {/* Session Feedback Toast */}
        <AnimatePresence>
          {sessionToast && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="my-2 px-4 py-2.5 rounded-xl bg-[#221D30] border border-[#B892FF]/40 text-xs text-zinc-100 flex items-center justify-between"
            >
              <span>{sessionToast}</span>
              <button
                type="button"
                onClick={() => setSessionToast(null)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* MAIN VIEWPORT CONTENT WITH ANIMATED PAGE TRANSITIONS */}
        <main className="flex-1 space-y-8 pt-2 pb-10">
          <AnimatePresence mode="wait">
            {activeView === 'details' && selectedMedia ? (
              <motion.div
                key={`details-${selectedMedia.id}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.28 }}
              >
                <DetailsView
                  item={selectedMedia}
                  relatedItems={relatedForSelected}
                  watchlistIds={watchlistIds}
                  inWatchlist={watchlistIds.includes(selectedMedia.id)}
                  autoPlayInitial={autoPlayOnOpen}
                  adsEnabled={adsEnabled}
                  isAdmin={isAdmin}
                  onBack={() => setActiveView('home')}
                  onSelectMedia={handleSelectMedia}
                  onToggleWatchlist={handleToggleWatchlist}
                  onSelectGenre={(genre) => {
                    setSelectedGenre(genre);
                    setActiveView('genres');
                  }}
                  onToggleAds={() => setAdsEnabled((prev) => !prev)}
                  onOpenAdPolicy={() => setActiveModal('advertising')}
                  onOpenAdminStudio={(mediaItem) => openAdminStudio(mediaItem)}
                />
              </motion.div>
            ) : activeView === 'watchlist' ? (
              <motion.section
                key="watchlist-view"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.07] pb-5">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white font-display">
                      Favourites & My List
                    </h1>
                    <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                      {currentUser
                        ? `Synced with Cloud Firestore for ${currentUser.email}`
                        : 'Saved in your browser — sign in with Google to sync across devices.'}
                    </p>
                  </div>
                </div>

                {watchlistItems.length === 0 ? (
                  <div className="rounded-3xl bg-[#1A1625] border border-white/[0.08] p-10 text-center max-w-lg mx-auto my-6 space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#241E33] flex items-center justify-center mx-auto text-[#B892FF]">
                      <Bookmark className="w-6 h-6" />
                    </div>
                    <h2 className="text-xl font-bold text-white font-display">
                      Your Favourites List Is Empty
                    </h2>
                    <p className="text-sm text-zinc-400">
                      Add movies or TV shows to your Favourites to access them quickly here.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleNavigate('home')}
                      className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#B892FF] text-[#110E17] font-bold text-sm hover:bg-[#C9ABFF] transition-colors cursor-pointer"
                    >
                      Back to Home
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5">
                    {watchlistItems.map((item) => (
                      <MovieCard
                        key={item.id}
                        item={item}
                        inWatchlist={watchlistIds.includes(item.id)}
                        onSelect={handleSelectMedia}
                        onToggleWatchlist={handleToggleWatchlist}
                      />
                    ))}
                  </div>
                )}
              </motion.section>
            ) : catalog.length === 0 && !isLoadingCatalog ? (
              /* EMPTY FIRESTORE CATALOG STATE (All Demo Movies/Shows Removed) */
              <motion.section
                key="empty-catalog-stage"
                initial={{ opacity: 0, scale: 0.97, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="rounded-3xl bg-gradient-to-br from-[#1E172E] via-[#161222] to-[#110E17] border border-white/10 p-8 sm:p-14 text-center max-w-3xl mx-auto my-8 space-y-6 shadow-2xl"
              >
                <div className="w-16 h-16 rounded-2xl bg-[#B892FF]/20 border border-[#B892FF]/40 flex items-center justify-center mx-auto text-[#B892FF]">
                  <Sparkles className="w-8 h-8" />
                </div>

                <div className="space-y-2">
                  <span className="px-3 py-1 rounded-full bg-white/[0.06] border border-white/10 text-xs font-mono-tabular text-[#B892FF]">
                    DEMO MOVIES & SHOWS REMOVED · CLOUD FIRESTORE READY
                  </span>
                  <h1 className="text-2xl sm:text-4xl font-bold text-white font-display pt-2">
                    Welcome to Your Clean ZAPPY Streaming Vault
                  </h1>
                  <p className="text-xs sm:text-base text-zinc-300 max-w-xl mx-auto leading-relaxed">
                    All sample demo movies and TV shows have been removed. Sign in with <strong className="text-[#B892FF]">{ADMIN_EMAIL}</strong> to open the Admin Panel, paste any <strong>JustWatch</strong> link for automatic banner/backdrop artwork, and connect <strong>CineSrc.st</strong> (<code className="text-[#B892FF]">cinesrc.st/embed/movie/TMDB_ID</code>) streams!
                  </p>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                  {isAdmin ? (
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      type="button"
                      onClick={() => openAdminStudio(null)}
                      className="min-h-[48px] px-7 py-3 rounded-2xl bg-[#B892FF] text-[#110E17] font-bold text-sm hover:bg-[#C9ABFF] transition-all flex items-center gap-2 cursor-pointer shadow-xl shadow-[#B892FF]/25"
                    >
                      <Plus className="w-5 h-5" />
                      <span>Open Admin Panel to Add Movies & Shows</span>
                    </motion.button>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      type="button"
                      onClick={handleGoogleLogin}
                      className="min-h-[48px] px-7 py-3 rounded-2xl bg-[#B892FF] text-[#110E17] font-bold text-sm hover:bg-[#C9ABFF] transition-all flex items-center gap-2 cursor-pointer shadow-xl shadow-[#B892FF]/25"
                    >
                      <LogIn className="w-5 h-5" />
                      <span>Sign in with Google ({ADMIN_EMAIL})</span>
                    </motion.button>
                  )}
                </div>
              </motion.section>
            ) : activeView === 'home' && !isSearchingOrFilteringOnHome ? (
              <motion.div
                key="home-dashboard"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="space-y-8"
              >
                <HeroBanner
                  featuredItems={featuredItems}
                  activeHeroIndex={activeHeroIndex}
                  onSelectHeroIndex={setActiveHeroIndex}
                  watchlistIds={watchlistIds}
                  onPlayMedia={(item) => handleSelectMedia(item, true)}
                  onOpenDetails={(item) => handleSelectMedia(item, false)}
                  onToggleWatchlist={handleToggleWatchlist}
                />

                {continueWatchingItems.length > 0 && (
                  <ContinueWatchingRow
                    items={continueWatchingItems}
                    onSelectMedia={handleSelectMedia}
                    onSeeAll={() => handleNavigate('continue_watching')}
                  />
                )}

                <CarouselRow
                  title="Recently Added on ZAPPY"
                  items={catalog}
                  watchlistIds={watchlistIds}
                  onSelectMedia={handleSelectMedia}
                  onToggleWatchlist={handleToggleWatchlist}
                  onExploreAll={() => handleNavigate('explore')}
                />

                {popularMovies.length > 0 && (
                  <CarouselRow
                    title="Movies"
                    items={popularMovies}
                    watchlistIds={watchlistIds}
                    onSelectMedia={handleSelectMedia}
                    onToggleWatchlist={handleToggleWatchlist}
                    onExploreAll={() => handleNavigate('movies')}
                  />
                )}

                {tvSeriesItems.length > 0 && (
                  <CarouselRow
                    title="TV Shows & Series"
                    items={tvSeriesItems}
                    watchlistIds={watchlistIds}
                    onSelectMedia={handleSelectMedia}
                    onToggleWatchlist={handleToggleWatchlist}
                    onExploreAll={() => handleNavigate('series')}
                  />
                )}

                {ALL_GENRES.map((genre) => {
                  const genreItems = getItemsByGenre(genre);
                  if (genreItems.length === 0) return null;
                  return (
                    <CarouselRow
                      key={genre}
                      title={genre}
                      items={genreItems}
                      watchlistIds={watchlistIds}
                      onSelectMedia={handleSelectMedia}
                      onToggleWatchlist={handleToggleWatchlist}
                      onExploreAll={() => {
                        setSelectedGenre(genre);
                        setActiveView('genres');
                      }}
                    />
                  );
                })}
              </motion.div>
            ) : (
              <motion.section
                key={`grid-${activeView}`}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                <div className="rounded-2xl bg-[#1A1625] border border-white/[0.08] p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h1 className="text-xl sm:text-2xl font-bold text-white font-display">
                        {activeView === 'movies'
                          ? 'Movies'
                          : activeView === 'series'
                          ? 'TV Shows & Series'
                          : activeView === 'genres'
                          ? `${
                              selectedGenre === 'All'
                                ? 'All Genres'
                                : selectedGenre
                            }`
                          : 'Explore ZAPPY Catalog'}
                      </h1>
                      <p className="text-xs text-zinc-400 mt-0.5 font-mono-tabular">
                        Showing {filteredCatalog.length}{' '}
                        {filteredCatalog.length === 1 ? 'title' : 'titles'}
                        {searchQuery ? ` matching "${searchQuery}"` : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div
                        role="group"
                        aria-label="Filter by content type"
                        className="flex items-center bg-[#120F1A] p-1 rounded-xl border border-white/[0.08]"
                      >
                        {(
                          [
                            { value: 'all', label: 'All' },
                            { value: 'movie', label: 'Movies' },
                            { value: 'series', label: 'TV Shows' },
                          ] as const
                        ).map((typeOpt) => (
                          <button
                            key={typeOpt.value}
                            type="button"
                            onClick={() =>
                              setSelectedContentType(typeOpt.value)
                            }
                            className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                              selectedContentType === typeOpt.value
                                ? 'bg-[#B892FF] text-[#110E17] font-bold'
                                : 'text-zinc-400 hover:text-white'
                            }`}
                          >
                            {typeOpt.label}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 bg-[#120F1A] border border-white/[0.08] rounded-xl px-3 min-h-[40px]">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-[#B892FF] shrink-0" />
                        <select
                          aria-label="Sort titles"
                          value={sortBy}
                          onChange={(e) =>
                            setSortBy(e.target.value as SortOption)
                          }
                          className="bg-transparent text-xs font-semibold text-white focus:outline-none py-1.5 cursor-pointer"
                        >
                          <option value="featured" className="bg-[#1A1625]">
                            Sort: Featured
                          </option>
                          <option value="year_desc" className="bg-[#1A1625]">
                            Year (Newest)
                          </option>
                          <option value="year_asc" className="bg-[#1A1625]">
                            Year (Oldest)
                          </option>
                          <option value="title_asc" className="bg-[#1A1625]">
                            Title (A–Z)
                          </option>
                          <option value="title_desc" className="bg-[#1A1625]">
                            Title (Z–A)
                          </option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
                    {['All', ...ALL_GENRES].map((genre) => {
                      const active = selectedGenre === genre;
                      return (
                        <button
                          key={genre}
                          type="button"
                          onClick={() => setSelectedGenre(genre)}
                          className={`min-h-[36px] px-3.5 py-1 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            active
                              ? 'bg-[#B892FF] text-[#110E17] font-bold'
                              : 'bg-[#120F1A] border border-white/[0.08] text-zinc-300 hover:text-white'
                          }`}
                        >
                          {genre}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {isLoadingCatalog ? (
                  <div className="py-16 text-center text-sm text-zinc-400">
                    Loading ZAPPY Firestore catalog...
                  </div>
                ) : filteredCatalog.length === 0 ? (
                  <div className="rounded-3xl bg-[#1A1625] border border-white/[0.08] p-10 text-center max-w-lg mx-auto my-6 space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#241E33] flex items-center justify-center mx-auto text-[#B892FF]">
                      <Search className="w-6 h-6" />
                    </div>
                    <h2 className="text-xl font-bold text-white font-display">
                      No Matching Titles Found
                    </h2>
                    <button
                      type="button"
                      onClick={resetAllFilters}
                      className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#B892FF] text-[#110E17] font-bold text-sm hover:bg-[#C9ABFF] transition-colors cursor-pointer"
                    >
                      Clear Filters
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5">
                    {filteredCatalog.map((item) => (
                      <MovieCard
                        key={item.id}
                        item={item}
                        inWatchlist={watchlistIds.includes(item.id)}
                        onSelect={handleSelectMedia}
                        onToggleWatchlist={handleToggleWatchlist}
                      />
                    ))}
                  </div>
                )}
              </motion.section>
            )}
          </AnimatePresence>
        </main>

        {/* Responsive Footer */}
        <footer className="border-t border-white/[0.07] mt-auto pt-8 pb-6 text-xs text-zinc-400 space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-[#B892FF] text-[#110E17] flex items-center justify-center font-bold">
                <Tv className="w-3.5 h-3.5" />
              </div>
              <span className="text-sm font-bold text-white font-display">
                ZAPPY
              </span>
              <span>·</span>
              <span>Powered by Firebase, CineSrc.st & JustWatch</span>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-zinc-300 font-medium">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => openAdminStudio(null)}
                  className="text-[#B892FF] hover:underline cursor-pointer"
                >
                  Admin Panel
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveModal('about')}
                className="hover:text-[#B892FF] transition-colors cursor-pointer"
              >
                About
              </button>
              <button
                type="button"
                onClick={() => setActiveModal('contact')}
                className="hover:text-[#B892FF] transition-colors cursor-pointer"
              >
                Contact
              </button>
              <button
                type="button"
                onClick={() => setActiveModal('privacy')}
                className="hover:text-[#B892FF] transition-colors cursor-pointer"
              >
                Privacy
              </button>
              <button
                type="button"
                onClick={() => setActiveModal('terms')}
                className="hover:text-[#B892FF] transition-colors cursor-pointer"
              >
                Terms
              </button>
            </div>
          </div>
        </footer>
      </div>

      {/* Mobile Bottom Tab Bar (< 1024px) */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-14 bg-[#15121E]/95 backdrop-blur-xl border-t border-white/10 grid grid-cols-5 items-center"
      >
        {(
          [
            { id: 'home' as NavView, label: 'Home', icon: Home },
            { id: 'explore' as NavView, label: 'Explore', icon: Compass },
            { id: 'genres' as NavView, label: 'Genres', icon: Layers },
            { id: 'watchlist' as NavView, label: 'Favourites', icon: Bookmark },
            {
              id: 'continue_watching' as NavView,
              label: 'Continue',
              icon: Play,
            },
          ] as const
        ).map((item) => {
          const IconComponent = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigate(item.id)}
              className={`relative min-h-[44px] h-full flex flex-col items-center justify-center transition-colors cursor-pointer ${
                isActive ? 'text-[#B892FF]' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {isActive && (
                <span className="absolute top-0 w-7 h-0.5 rounded-full bg-[#B892FF]" />
              )}
              <IconComponent className="w-5 h-5" />
              <span className="text-[10px] font-semibold tracking-tight mt-0.5 whitespace-nowrap">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Admin Studio Modal */}
      <AdminStudioModal
        isOpen={adminStudioOpen}
        currentUser={currentUser}
        prefillMedia={adminPrefillMedia}
        catalog={catalog}
        videoAdConfig={videoAdConfig}
        onClose={() => setAdminStudioOpen(false)}
        onSelectMediaToWatch={(item) => handleSelectMedia(item, true)}
      />

      {/* Footer & Settings Info Modal */}
      <InfoModal
        modalType={activeModal}
        adsEnabled={adsEnabled}
        onToggleAds={() => setAdsEnabled((prev) => !prev)}
        onClose={() => setActiveModal(null)}
      />
    </div>
  );
}
