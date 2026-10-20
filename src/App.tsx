import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  X,
  Film,
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
  Bell,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
} from 'lucide-react';
import { MediaItem, Genre } from './types/media';
import { SAMPLE_CATALOG, ALL_GENRES } from './data/catalog';
import { HeroBanner } from './components/HeroBanner';
import { CarouselRow } from './components/CarouselRow';
import { MovieCard } from './components/MovieCard';
import { DetailsView } from './components/DetailsView';
import { AdBanner } from './components/AdBanner';
import { InfoModal, InfoModalType } from './components/InfoModal';
import { ContinueWatchingRow, WatchProgressEntry } from './components/ContinueWatchingRow';

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

type SortOption = 'featured' | 'year_desc' | 'year_asc' | 'title_asc' | 'title_desc';

const WATCHLIST_STORAGE_KEY = 'cinewave_watchlist_v1';
const ADS_STORAGE_KEY = 'cinewave_ads_enabled_v1';

const DEFAULT_PROGRESS: Record<string, WatchProgressEntry> = {
  'midnight-mischief-squad': {
    mediaId: 'midnight-mischief-squad',
    seasonEpisodeLabel: 'S1, Ep-3',
    remainingLabel: '30min 55sec',
    progressPercent: 48,
  },
  'legends-of-emerald-mist': {
    mediaId: 'legends-of-emerald-mist',
    seasonEpisodeLabel: 'S1, Ep-3',
    remainingLabel: '30min 55sec',
    progressPercent: 56,
  },
  'rise-of-last-guardian': {
    mediaId: 'rise-of-last-guardian',
    seasonEpisodeLabel: 'S1, Ep-3',
    remainingLabel: '30min 55sec',
    progressPercent: 42,
  },
  'tears-of-steel-horizon': {
    mediaId: 'tears-of-steel-horizon',
    seasonEpisodeLabel: 'S1, Ep-1',
    remainingLabel: '12min 14sec',
    progressPercent: 68,
  },
};

export default function App() {
  const [catalog, setCatalog] = useState<MediaItem[]>(SAMPLE_CATALOG);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(false);
  const [apiErrorBanner, setApiErrorBanner] = useState<string | null>(null);

  const [activeView, setActiveView] = useState<NavView>('home');
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [autoPlayOnOpen, setAutoPlayOnOpen] = useState<boolean>(false);
  const [activeHeroIndex, setActiveHeroIndex] = useState<number>(0);

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
  const [selectedContentType, setSelectedContentType] = useState<'all' | 'movie' | 'series'>('all');
  const [onlyPlayableDemo, setOnlyPlayableDemo] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<SortOption>('featured');

  // Watchlist / Favourites State (persisted to localStorage)
  const [watchlistIds, setWatchlistIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(WATCHLIST_STORAGE_KEY);
      if (!raw) {
        return [
          'dimensional-kids-adventure',
          'midnight-mischief-squad',
          'legends-of-emerald-mist',
        ];
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? Array.from(new Set(parsed)) : [];
    } catch {
      return [];
    }
  });

  // Continue Watching Progress State
  const [watchProgressMap, setWatchProgressMap] =
    useState<Record<string, WatchProgressEntry>>(DEFAULT_PROGRESS);

  // Configurable Ad-Supported Placeholder State
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

  // Fetch server catalog & handle URL query params
  useEffect(() => {
    let isMounted = true;
    const fetchServerCatalog = async () => {
      setIsLoadingCatalog(true);
      try {
        const res = await fetch('/api/catalog');
        if (!res.ok) {
          throw new Error(`Server responded with status ${res.status}`);
        }
        const data = await res.json();
        if (isMounted && Array.isArray(data.items) && data.items.length > 0) {
          setCatalog(data.items);
          setApiErrorBanner(null);
        }
      } catch {
        if (isMounted) {
          setCatalog(SAMPLE_CATALOG);
          setApiErrorBanner(
            'Live catalog endpoint unreachable — running seamlessly on built-in sample catalog.'
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingCatalog(false);
        }
      }
    };

    fetchServerCatalog();

    const params = new URLSearchParams(window.location.search);
    const requestedTitleId = params.get('title');
    if (requestedTitleId) {
      const match = SAMPLE_CATALOG.find((item) => item.id === requestedTitleId);
      if (match) {
        setSelectedMedia(match);
        setActiveView('details');
      } else {
        setActiveView('not_found');
      }
    }

    return () => {
      isMounted = false;
    };
  }, []);

  // Update document title dynamically
  useEffect(() => {
    if (activeView === 'details' && selectedMedia) {
      document.title = `Watch ${selectedMedia.title} (${selectedMedia.releaseYear}) — CineWave`;
    } else if (activeView === 'watchlist') {
      document.title = `Favourites (${watchlistIds.length}) — CineWave`;
    } else if (activeView === 'explore' || activeView === 'movies' || activeView === 'series') {
      document.title = 'Explore Films & Series — CineWave';
    } else if (activeView === 'genres') {
      document.title = `${selectedGenre === 'All' ? 'All Genres' : selectedGenre} — CineWave`;
    } else if (activeView === 'not_found') {
      document.title = 'Title Not Found (404) — CineWave';
    } else {
      document.title = 'CineWave — Free Ad-Supported Movies & TV Shows';
    }
  }, [activeView, selectedMedia, watchlistIds.length, selectedGenre]);

  const showToast = (msg: string) => {
    setSessionToast(msg);
    setTimeout(() => setSessionToast(null), 3000);
  };

  const handleToggleWatchlist = (item: MediaItem, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setWatchlistIds((prev) => {
      if (prev.includes(item.id)) {
        return prev.filter((id) => id !== item.id);
      }
      return Array.from(new Set([...prev, item.id]));
    });
  };

  const handleSelectMedia = (item: MediaItem, autoPlay = false) => {
    setSelectedMedia(item);
    setAutoPlayOnOpen(autoPlay);
    setActiveView('details');
    setNotificationsOpen(false);
    setProfileMenuOpen(false);
    setMobileMenuOpen(false);

    // Record item in Continue Watching when opened for playback
    if (autoPlay && !watchProgressMap[item.id]) {
      setWatchProgressMap((prev) => ({
        [item.id]: {
          mediaId: item.id,
          seasonEpisodeLabel: item.contentType === 'series' ? 'S1, Ep-1' : 'Feature',
          remainingLabel: `${item.durationMinutes}min 00sec`,
          progressPercent: 18,
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

  // Featured items for the Hero Banner (Dimensional Kids on an Adventure first!)
  const featuredItems = useMemo(
    () =>
      catalog
        .filter((item) => item.featured || item.availabilityStatus === 'playable_demo')
        .slice(0, 4),
    [catalog]
  );

  // Continue Watching items matching the reference image order
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

  // "You Might Like" & Categorized Rows
  const youMightLikeItems = useMemo(
    () =>
      [...catalog]
        .filter((i) => i.id !== 'dimensional-kids-adventure')
        .sort((a, b) => (b.popularScore || 0) - (a.popularScore || 0)),
    [catalog]
  );

  const trendingItems = useMemo(
    () =>
      [...catalog]
        .filter((i) => i.trendingRank !== undefined)
        .sort((a, b) => (a.trendingRank || 99) - (b.trendingRank || 99)),
    [catalog]
  );

  const popularMovies = useMemo(
    () =>
      catalog
        .filter((i) => i.contentType === 'movie')
        .sort((a, b) => (b.popularScore || 0) - (a.popularScore || 0)),
    [catalog]
  );

  const recentlyAdded = useMemo(
    () => catalog.filter((i) => i.recentlyAdded),
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
      .filter(
        (item) =>
          item.id !== selectedMedia.id &&
          item.genres.some((g) => selectedMedia.genres.includes(g))
      )
      .slice(0, 6);
  }, [catalog, selectedMedia]);

  // Filtered and sorted items for Search & Explore views
  const filteredCatalog = useMemo(() => {
    let result = [...catalog];

    if (activeView === 'recently_added') {
      result = result.filter((item) => item.recentlyAdded);
    } else if (activeView === 'downloads') {
      result = result.filter((item) => item.availabilityStatus === 'playable_demo');
    } else if (activeView === 'continue_watching') {
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
      result = result.filter((item) => item.genres.includes(selectedGenre as Genre));
    }

    if (onlyPlayableDemo) {
      result = result.filter((item) => item.availabilityStatus === 'playable_demo');
    }

    if (searchQuery.trim() !== '') {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.synopsis.toLowerCase().includes(q) ||
          item.directorOrCreator.toLowerCase().includes(q) ||
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
    } else {
      result.sort((a, b) => (b.popularScore || 0) - (a.popularScore || 0));
    }

    return result;
  }, [
    catalog,
    activeView,
    selectedContentType,
    selectedGenre,
    onlyPlayableDemo,
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
    { id: 'continue_watching' as NavView, label: 'Continue Watching', icon: Play },
    { id: 'recently_added' as NavView, label: 'Recently Added', icon: Clock },
    { id: 'collections' as NavView, label: 'My Collections', icon: Folder },
    { id: 'downloads' as NavView, label: 'Downloads', icon: Download },
  ];

  return (
    <div className="min-h-screen w-full bg-[#110E17] text-[#F5F5F7] flex flex-col lg:flex-row p-0 sm:p-3 lg:p-4 gap-0 lg:gap-6 pb-16 lg:pb-4 overflow-x-hidden">
      {/* MOBILE DRAWER OVERLAY */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* LEFT SIDEBAR NAVIGATION (Exact Match to Reference Image) */}
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
          {/* Brand Logo + Collapse Button */}
          <div className="flex items-center justify-between gap-2 px-1">
            <a
              href="#home"
              onClick={(e) => {
                e.preventDefault();
                handleNavigate('home');
              }}
              className="flex items-center gap-3 min-w-0 group"
            >
              {/* Lavender TV Play Logo Box matching reference */}
              <div className="w-9 h-9 rounded-xl bg-[#B892FF] text-[#110E17] flex items-center justify-center shrink-0 shadow-md shadow-[#B892FF]/25">
                <Tv className="w-5 h-5 stroke-[2.4]" />
              </div>
              {!sidebarCollapsed && (
                <span className="text-xl font-bold tracking-tight text-white font-display truncate">
                  CineWave
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
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Primary Navigation Group: Home, Explore, Genres, Favourites */}
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

          {/* Secondary Library Group: Continue Watching, Recently Added, My Collections, Downloads */}
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

          {/* Settings Item */}
          <div>
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

        {/* Bottom Pinned Logout / Reset Session Button */}
        <div className="pt-4 border-t border-white/[0.05]">
          <button
            type="button"
            onClick={() => {
              resetAllFilters();
              handleNavigate('home');
              showToast('Session filters reset — browsing as Guest Profile.');
            }}
            className="w-full min-h-[44px] px-3 py-2.5 rounded-xl flex items-center gap-3.5 text-sm text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer"
            title={sidebarCollapsed ? 'Logout / Reset Session' : undefined}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* RIGHT MAIN WORKSPACE COLUMN */}
      <div className="flex-1 min-w-0 flex flex-col px-4 sm:px-3 lg:px-2">
        {/* TOP HEADER BAR: Search Input on Left + Notification & Avatar on Right */}
        <header className="sticky top-0 z-30 py-3 sm:py-3.5 bg-[#110E17]/90 backdrop-blur-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 max-w-xl">
            {/* Mobile Hamburger Trigger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden min-h-[42px] min-w-[42px] rounded-xl bg-[#1A1625] border border-white/[0.08] text-zinc-200 flex items-center justify-center shrink-0 cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Rounded Search Input matching reference UI */}
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
                placeholder="Search for films, directors, or actors..."
                aria-label="Search for films, directors, or actors"
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

          {/* Right Header Controls: Movies/TV Quick Links + Notification Bell + User Avatar */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0 relative">
            <div className="hidden xl:flex items-center gap-2 mr-1">
              <button
                type="button"
                onClick={() => handleNavigate('movies')}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  activeView === 'movies'
                    ? 'bg-[#B892FF] text-[#110E17]'
                    : 'bg-[#1A1625] border border-white/[0.08] text-zinc-300 hover:text-white'
                }`}
              >
                Movies
              </button>
              <button
                type="button"
                onClick={() => handleNavigate('series')}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  activeView === 'series'
                    ? 'bg-[#B892FF] text-[#110E17]'
                    : 'bg-[#1A1625] border border-white/[0.08] text-zinc-300 hover:text-white'
                }`}
              >
                TV Shows
              </button>
            </div>

            {/* Notification Bell Button */}
            <button
              type="button"
              onClick={() => {
                setNotificationsOpen((prev) => !prev);
                setProfileMenuOpen(false);
              }}
              className="relative min-h-[42px] min-w-[42px] rounded-full bg-[#1A1625] hover:bg-[#241E33] border border-white/[0.08] text-zinc-200 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="View notifications and new releases"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#FF5E5E]" />
            </button>

            {/* User Profile Avatar Button */}
            <button
              type="button"
              onClick={() => {
                setProfileMenuOpen((prev) => !prev);
                setNotificationsOpen(false);
              }}
              className="min-h-[42px] min-w-[42px] rounded-full p-0.5 bg-gradient-to-tr from-[#B892FF] to-[#FF8A3D] cursor-pointer"
              aria-label="Open user profile menu"
            >
              <div className="w-9 h-9 rounded-full bg-[#1A1625] flex items-center justify-center text-xs font-bold text-white font-display">
                CW
              </div>
            </button>

            {/* Notifications Dropdown Popover */}
            {notificationsOpen && (
              <div className="absolute right-0 top-14 w-80 rounded-2xl bg-[#1A1625] border border-white/15 p-4 shadow-2xl z-50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    New Releases & Streams
                  </span>
                  <button
                    type="button"
                    onClick={() => setNotificationsOpen(false)}
                    className="text-xs text-zinc-400 hover:text-white cursor-pointer"
                  >
                    Close
                  </button>
                </div>
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
                        <p className="text-[11px] text-[#B892FF] truncate">
                          Authorized HD Stream Ready
                        </p>
                      </div>
                      <Play className="w-3.5 h-3.5 text-[#B892FF] fill-current shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Profile Dropdown Popover */}
            {profileMenuOpen && (
              <div className="absolute right-0 top-14 w-56 rounded-2xl bg-[#1A1625] border border-white/15 p-3 shadow-2xl z-50 space-y-1">
                <div className="px-3 py-2 border-b border-white/[0.08]">
                  <p className="text-xs font-bold text-white">CineWave Viewer</p>
                  <p className="text-[11px] text-zinc-400">
                    {watchlistIds.length} Saved in Favourites
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleNavigate('watchlist')}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs text-zinc-200 hover:bg-white/[0.07] cursor-pointer"
                >
                  My Favourites ({watchlistIds.length})
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigate('continue_watching')}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs text-zinc-200 hover:bg-white/[0.07] cursor-pointer"
                >
                  Continue Watching
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    setActiveModal('advertising');
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs text-zinc-200 hover:bg-white/[0.07] cursor-pointer"
                >
                  Ad Slot Settings ({adsEnabled ? 'On' : 'Off'})
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Session Feedback Toast */}
        {sessionToast && (
          <div className="my-2 px-4 py-2.5 rounded-xl bg-[#221D30] border border-[#B892FF]/40 text-xs text-zinc-100 flex items-center justify-between">
            <span>{sessionToast}</span>
            <button
              type="button"
              onClick={() => setSessionToast(null)}
              className="text-zinc-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* API Fallback Notice */}
        {apiErrorBanner && (
          <div className="my-2 bg-[#1A1625] border border-white/10 rounded-xl px-4 py-2 text-center text-xs text-zinc-300">
            {apiErrorBanner}
          </div>
        )}

        {/* MAIN VIEWPORT CONTENT */}
        <main className="flex-1 space-y-8 pt-2 pb-10">
          {activeView === 'details' && selectedMedia ? (
            <DetailsView
              item={selectedMedia}
              relatedItems={relatedForSelected}
              watchlistIds={watchlistIds}
              inWatchlist={watchlistIds.includes(selectedMedia.id)}
              autoPlayInitial={autoPlayOnOpen}
              adsEnabled={adsEnabled}
              onBack={() => setActiveView('home')}
              onSelectMedia={handleSelectMedia}
              onToggleWatchlist={handleToggleWatchlist}
              onSelectGenre={(genre) => {
                setSelectedGenre(genre);
                setActiveView('genres');
              }}
              onToggleAds={() => setAdsEnabled((prev) => !prev)}
              onOpenAdPolicy={() => setActiveModal('advertising')}
            />
          ) : activeView === 'not_found' ? (
            <section className="max-w-2xl mx-auto px-4 py-16 text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-[#1A1625] border border-white/10 flex items-center justify-center mx-auto text-[#B892FF]">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <p className="text-xs font-mono-tabular uppercase tracking-widest text-[#B892FF]">
                ERROR 404 · TITLE NOT FOUND
              </p>
              <h1 className="text-2xl sm:text-4xl font-bold text-white font-display">
                This Title Isn&rsquo;t in the CineWave Vault
              </h1>
              <p className="text-sm text-zinc-400">
                The movie or episode you requested could not be found. Return home or explore our full streaming catalog.
              </p>
              <div className="pt-2 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => handleNavigate('home')}
                  className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#B892FF] text-[#110E17] font-bold text-sm hover:bg-[#C9ABFF] transition-colors cursor-pointer"
                >
                  Back to Home
                </button>
              </div>
            </section>
          ) : activeView === 'watchlist' ? (
            /* FAVOURITES / MY LIST VIEW */
            <section className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.07] pb-5">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white font-display">
                    Favourites & My List
                  </h1>
                  <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                    Saved locally in your browser so your personal list persists after refreshing.
                  </p>
                </div>

                {watchlistItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setWatchlistIds([])}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-[#1A1625] border border-white/10 text-xs font-medium text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5 self-start cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-[#B892FF]" />
                    <span>Clear Favourites</span>
                  </button>
                )}
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
                    Add movies or TV shows to your Favourites from any card or banner to access them quickly here.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleNavigate('home')}
                    className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#B892FF] text-[#110E17] font-bold text-sm hover:bg-[#C9ABFF] transition-colors cursor-pointer"
                  >
                    Discover Movies & Series
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
            </section>
          ) : activeView === 'collections' ? (
            /* MY COLLECTIONS VIEW */
            <section className="space-y-8">
              <div className="border-b border-white/[0.07] pb-4">
                <h1 className="text-2xl sm:text-3xl font-bold text-white font-display">
                  My Collections
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                  Curated thematic anthologies and open-movie festival selections
                </p>
              </div>

              <CarouselRow
                title="Blender Open Movie Anthology (Playable HD)"
                subtitle="Verified Creative Commons short films with full HTML5 streaming"
                items={catalog.filter((i) => i.availabilityStatus === 'playable_demo')}
                watchlistIds={watchlistIds}
                onSelectMedia={handleSelectMedia}
                onToggleWatchlist={handleToggleWatchlist}
              />

              <CarouselRow
                title="Magical Worlds & Family Quests"
                subtitle="Dimensional portals, clockwork sprites, and animated adventures"
                items={getItemsByGenre('Family')}
                watchlistIds={watchlistIds}
                onSelectMedia={handleSelectMedia}
                onToggleWatchlist={handleToggleWatchlist}
              />
            </section>
          ) : activeView === 'home' && !isSearchingOrFilteringOnHome ? (
            /* HOME DASHBOARD (Exact Match to Reference UI: Hero Card -> Continue Watching -> You Might Like -> Genre Carousels) */
            <div className="space-y-8">
              <HeroBanner
                featuredItems={featuredItems}
                activeHeroIndex={activeHeroIndex}
                onSelectHeroIndex={setActiveHeroIndex}
                watchlistIds={watchlistIds}
                onPlayMedia={(item) => handleSelectMedia(item, true)}
                onOpenDetails={(item) => handleSelectMedia(item, false)}
                onToggleWatchlist={handleToggleWatchlist}
              />

              {/* Continue Watching Landscape Row (Matching Reference Image) */}
              <ContinueWatchingRow
                items={continueWatchingItems}
                onSelectMedia={handleSelectMedia}
                onSeeAll={() => handleNavigate('continue_watching')}
              />

              {/* You Might Like Row (Matching Reference Image) */}
              <CarouselRow
                title="You Might Like"
                items={youMightLikeItems}
                watchlistIds={watchlistIds}
                onSelectMedia={handleSelectMedia}
                onToggleWatchlist={handleToggleWatchlist}
                onExploreAll={() => handleNavigate('explore')}
              />

              <CarouselRow
                title="Trending Now"
                items={trendingItems}
                showRankNumbers
                watchlistIds={watchlistIds}
                onSelectMedia={handleSelectMedia}
                onToggleWatchlist={handleToggleWatchlist}
                onExploreAll={() => handleNavigate('explore')}
              />

              {/* Configurable Ad-Supported Banner Placeholder */}
              <AdBanner
                enabled={adsEnabled}
                slotId="CW-HOME-MID-LEADERBOARD-01"
                placementLabel="Homepage Mid-Feed Sponsor Slot"
                onToggleAds={() => setAdsEnabled((prev) => !prev)}
                onOpenAdPolicy={() => setActiveModal('advertising')}
              />

              <CarouselRow
                title="Popular Movies"
                items={popularMovies}
                watchlistIds={watchlistIds}
                onSelectMedia={handleSelectMedia}
                onToggleWatchlist={handleToggleWatchlist}
                onExploreAll={() => handleNavigate('movies')}
              />

              <CarouselRow
                title="Recently Added"
                items={recentlyAdded}
                watchlistIds={watchlistIds}
                onSelectMedia={handleSelectMedia}
                onToggleWatchlist={handleToggleWatchlist}
                onExploreAll={() => handleNavigate('recently_added')}
              />

              <CarouselRow
                title="TV Shows & Series"
                items={tvSeriesItems}
                watchlistIds={watchlistIds}
                onSelectMedia={handleSelectMedia}
                onToggleWatchlist={handleToggleWatchlist}
                onExploreAll={() => handleNavigate('series')}
              />

              <CarouselRow
                title="Action"
                items={getItemsByGenre('Action')}
                watchlistIds={watchlistIds}
                onSelectMedia={handleSelectMedia}
                onToggleWatchlist={handleToggleWatchlist}
                onExploreAll={() => {
                  setSelectedGenre('Action');
                  setActiveView('genres');
                }}
              />

              <CarouselRow
                title="Comedy"
                items={getItemsByGenre('Comedy')}
                watchlistIds={watchlistIds}
                onSelectMedia={handleSelectMedia}
                onToggleWatchlist={handleToggleWatchlist}
                onExploreAll={() => {
                  setSelectedGenre('Comedy');
                  setActiveView('genres');
                }}
              />

              <CarouselRow
                title="Drama"
                items={getItemsByGenre('Drama')}
                watchlistIds={watchlistIds}
                onSelectMedia={handleSelectMedia}
                onToggleWatchlist={handleToggleWatchlist}
                onExploreAll={() => {
                  setSelectedGenre('Drama');
                  setActiveView('genres');
                }}
              />

              <CarouselRow
                title="Thriller"
                items={getItemsByGenre('Thriller')}
                watchlistIds={watchlistIds}
                onSelectMedia={handleSelectMedia}
                onToggleWatchlist={handleToggleWatchlist}
                onExploreAll={() => {
                  setSelectedGenre('Thriller');
                  setActiveView('genres');
                }}
              />

              <CarouselRow
                title="Family"
                items={getItemsByGenre('Family')}
                watchlistIds={watchlistIds}
                onSelectMedia={handleSelectMedia}
                onToggleWatchlist={handleToggleWatchlist}
                onExploreAll={() => {
                  setSelectedGenre('Family');
                  setActiveView('genres');
                }}
              />
            </div>
          ) : (
            /* EXPLORE / SEARCH / GENRES / DOWNLOADS / CONTINUE WATCHING GRID VIEW */
            <section className="space-y-6">
              {/* Filter & Sort Controls Bar */}
              <div className="rounded-2xl bg-[#1A1625] border border-white/[0.08] p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-white font-display">
                      {activeView === 'movies'
                        ? 'Movies'
                        : activeView === 'series'
                        ? 'TV Shows & Series'
                        : activeView === 'genres'
                        ? `${selectedGenre === 'All' ? 'All Genres' : selectedGenre}`
                        : activeView === 'continue_watching'
                        ? 'Continue Watching'
                        : activeView === 'recently_added'
                        ? 'Recently Added'
                        : activeView === 'downloads'
                        ? 'Playable Open Streams (Downloads)'
                        : 'Explore Catalog'}
                    </h1>
                    <p className="text-xs text-zinc-400 mt-0.5 font-mono-tabular">
                      Showing {filteredCatalog.length}{' '}
                      {filteredCatalog.length === 1 ? 'title' : 'titles'}
                      {searchQuery ? ` matching "${searchQuery}"` : ''}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Content Type Segmented Controls */}
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
                          onClick={() => setSelectedContentType(typeOpt.value)}
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

                    {/* Playable Demo Toggle */}
                    <button
                      type="button"
                      onClick={() => setOnlyPlayableDemo((prev) => !prev)}
                      className={`min-h-[40px] px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                        onlyPlayableDemo
                          ? 'bg-[#B892FF]/20 border-[#B892FF] text-[#B892FF]'
                          : 'bg-[#120F1A] border-white/[0.08] text-zinc-300 hover:text-white'
                      }`}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Playable Only</span>
                    </button>

                    {/* Sort Select */}
                    <div className="flex items-center gap-2 bg-[#120F1A] border border-white/[0.08] rounded-xl px-3 min-h-[40px]">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-[#B892FF] shrink-0" />
                      <select
                        aria-label="Sort titles"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                        className="bg-transparent text-xs font-semibold text-white focus:outline-none py-1.5 cursor-pointer"
                      >
                        <option value="featured" className="bg-[#1A1625]">
                          Sort: Popular
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

                    {(searchQuery ||
                      selectedGenre !== 'All' ||
                      selectedContentType !== 'all' ||
                      onlyPlayableDemo ||
                      sortBy !== 'featured') && (
                      <button
                        type="button"
                        onClick={resetAllFilters}
                        className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#241E33] text-xs font-semibold text-zinc-200 hover:text-white cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Genre Filter Pills */}
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
                  Loading catalog...
                </div>
              ) : filteredCatalog.length === 0 ? (
                <div className="rounded-3xl bg-[#1A1625] border border-white/[0.08] p-10 text-center max-w-lg mx-auto my-6 space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#241E33] flex items-center justify-center mx-auto text-[#B892FF]">
                    <Search className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-bold text-white font-display">
                    No Matching Titles Found
                  </h2>
                  <p className="text-sm text-zinc-400">
                    No films or series matched your active filters. Reset your filters to browse the full catalog.
                  </p>
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
            </section>
          )}
        </main>

        {/* Responsive Footer */}
        <footer className="border-t border-white/[0.07] mt-auto pt-8 pb-6 text-xs text-zinc-400 space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-[#B892FF] text-[#110E17] flex items-center justify-center font-bold">
                <Tv className="w-3.5 h-3.5" />
              </div>
              <span className="text-sm font-bold text-white font-display">
                CineWave
              </span>
              <span>·</span>
              <span>Free Ad-Supported Streaming Concept</span>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-zinc-300 font-medium">
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
              <button
                type="button"
                onClick={() => setActiveModal('advertising')}
                className="hover:text-[#B892FF] transition-colors cursor-pointer"
              >
                Advertising
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
            { id: 'continue_watching' as NavView, label: 'Continue', icon: Play },
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
