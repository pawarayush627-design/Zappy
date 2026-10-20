import React, { useState, useEffect } from 'react';
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
  ExternalLink,
  Wand2,
  Loader2,
  LogIn,
  Image as ImageIcon,
  Play,
  Edit3,
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
} from '../firebase';
import {
  Genre,
  MediaItem,
  TMDBMediaType,
  VideoAdConfig,
} from '../types/media';
import { ALL_GENRES } from '../data/catalog';
import {
  createPosterDataUri,
  createBackdropDataUri,
} from '../utils/artworkGenerator';

interface AdminStudioModalProps {
  isOpen: boolean;
  currentUser: User | null;
  prefillMedia?: MediaItem | null;
  catalog: MediaItem[];
  videoAdConfig: VideoAdConfig;
  onClose: () => void;
  onSelectMediaToWatch?: (item: MediaItem) => void;
}

/**
 * Normalizes a CineSrc.st link or builds one from (mediaType, tmdbId).
 * Supports inputs like:
 * - "cinesrc.st/embed/movie/157336"
 * - "https://cinesrc.st/embed/tv/1399"
 * - "cinesrc.st/embed/series/1399"
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
  const regex =
    /(?:https?:\/\/)?(?:www\.)?cinesrc\.st\/embed\/(movie|tv|series|show)\/(\d+)/i;
  const match = trimmed.match(regex);
  if (match) {
    const rawType = match[1].toLowerCase();
    const detectedType: TMDBMediaType =
      rawType === 'tv' || rawType === 'series' || rawType === 'show'
        ? 'tv'
        : 'movie';
    const detectedTmdbId = Number(match[2]) || fallbackTmdbId || 1;
    return {
      embedUrl: `https://cinesrc.st/embed/${detectedType}/${detectedTmdbId}`,
      detectedType,
      detectedTmdbId,
    };
  }

  const cleanTmdbId =
    Number.isInteger(fallbackTmdbId) && fallbackTmdbId > 0
      ? fallbackTmdbId
      : 10000;
  return {
    embedUrl: `https://cinesrc.st/embed/${fallbackType}/${cleanTmdbId}`,
    detectedType: fallbackType,
    detectedTmdbId: cleanTmdbId,
  };
}

export const AdminStudioModal: React.FC<AdminStudioModalProps> = ({
  isOpen,
  currentUser,
  prefillMedia = null,
  catalog,
  onClose,
  onSelectMediaToWatch,
}) => {
  const isAdmin = isUserAdmin(currentUser?.email, currentUser?.emailVerified);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [justWatchUrl, setJustWatchUrl] = useState<string>('');
  const [isExtractingJw, setIsExtractingJw] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Movie / Show Form State
  const [mediaType, setMediaType] = useState<TMDBMediaType>('movie');
  const [tmdbIdInput, setTmdbIdInput] = useState<string>('');
  const [cinesrcInput, setCinesrcInput] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [tagline, setTagline] = useState<string>('');
  const [synopsis, setSynopsis] = useState<string>('');
  const [selectedGenres, setSelectedGenres] = useState<Genre[]>(['Action', 'Drama']);
  const [releaseYear, setReleaseYear] = useState<string>('2024');
  const [durationMinutes, setDurationMinutes] = useState<string>('120');
  const [maturityRating, setMaturityRating] = useState<
    'G' | 'PG' | 'PG-13' | 'TV-PG' | 'TV-14'
  >('PG-13');
  const [directorOrCreator, setDirectorOrCreator] =
    useState<string>('Featured Creator');
  const [castInput, setCastInput] = useState<string>('Lead Cast');
  const [posterUrl, setPosterUrl] = useState<string>('');
  const [backdropUrl, setBackdropUrl] = useState<string>('');
  const [seasonsCount, setSeasonsCount] = useState<string>('1');
  const [episodesCount, setEpisodesCount] = useState<string>('8');
  const [featured, setFeatured] = useState<boolean>(true);

  // Populate form when prefillMedia is provided
  useEffect(() => {
    if (prefillMedia) {
      populateFormFromItem(prefillMedia);
    }
  }, [prefillMedia]);

  // Auto-sync cinesrcInput whenever mediaType or tmdbIdInput changes
  useEffect(() => {
    const numId = Number(tmdbIdInput);
    if (numId > 0) {
      setCinesrcInput(`https://cinesrc.st/embed/${mediaType}/${numId}`);
    }
  }, [mediaType, tmdbIdInput]);

  const populateFormFromItem = (item: MediaItem) => {
    setEditingId(item.id);
    setMediaType(item.mediaType);
    setTmdbIdInput(String(item.tmdbId));
    setCinesrcInput(
      item.cinesrcEmbedUrl ||
        `https://cinesrc.st/embed/${item.mediaType}/${item.tmdbId}`
    );
    setJustWatchUrl(item.justWatchUrl || '');
    setTitle(item.title);
    setTagline(item.tagline);
    setSynopsis(item.synopsis);
    setSelectedGenres(item.genres.length > 0 ? item.genres : ['Drama']);
    setReleaseYear(String(item.releaseYear));
    setDurationMinutes(String(item.durationMinutes));
    setMaturityRating(item.maturityRating);
    setDirectorOrCreator(item.directorOrCreator);
    setCastInput(item.cast.join(', '));
    setPosterUrl(item.posterUrl);
    setBackdropUrl(item.backdropUrl);
    setSeasonsCount(String(item.seasonsCount || 1));
    setEpisodesCount(String(item.episodesCount || 8));
    setFeatured(Boolean(item.featured));
  };

  const resetForm = () => {
    setEditingId(null);
    setJustWatchUrl('');
    setMediaType('movie');
    setTmdbIdInput('');
    setCinesrcInput('');
    setTitle('');
    setTagline('');
    setSynopsis('');
    setSelectedGenres(['Action', 'Drama']);
    setReleaseYear('2024');
    setDurationMinutes('120');
    setMaturityRating('PG-13');
    setDirectorOrCreator('Featured Director');
    setCastInput('Featured Cast');
    setPosterUrl('');
    setBackdropUrl('');
    setSeasonsCount('1');
    setEpisodesCount('8');
    setFeatured(true);
  };

  const handleCineSrcInputChange = (val: string) => {
    setCinesrcInput(val);
    const regex =
      /(?:https?:\/\/)?(?:www\.)?cinesrc\.st\/embed\/(movie|tv|series|show)\/(\d+)/i;
    const match = val.trim().match(regex);
    if (match) {
      const rawType = match[1].toLowerCase();
      const nextType: TMDBMediaType =
        rawType === 'tv' || rawType === 'series' || rawType === 'show'
          ? 'tv'
          : 'movie';
      setMediaType(nextType);
      setTmdbIdInput(match[2]);
    }
  };

  const handleExtractFromJustWatch = async () => {
    if (!justWatchUrl.trim() && !title.trim()) {
      setErrorMessage(
        'Paste a JustWatch link (e.g. https://www.justwatch.com/us/movie/interstellar) first.'
      );
      return;
    }

    setIsExtractingJw(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/justwatch/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          justWatchUrl: justWatchUrl.trim(),
          title: title.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(
          data.error || 'Could not extract images from JustWatch link.'
        );
        return;
      }

      if (data.title) setTitle(data.title);
      if (data.releaseYear) setReleaseYear(String(data.releaseYear));
      if (data.synopsis) setSynopsis(data.synopsis);
      if (data.mediaType === 'tv' || data.mediaType === 'movie') {
        setMediaType(data.mediaType);
        setMaturityRating(data.mediaType === 'tv' ? 'TV-14' : 'PG-13');
      }
      if (data.durationMinutes) {
        setDurationMinutes(String(data.durationMinutes));
      }
      if (data.posterUrl) setPosterUrl(data.posterUrl);
      if (data.backdropUrl) setBackdropUrl(data.backdropUrl);
      if (data.tmdbId) {
        setTmdbIdInput(String(data.tmdbId));
        setCinesrcInput(
          `https://cinesrc.st/embed/${data.mediaType || mediaType}/${data.tmdbId}`
        );
      }

      setStatusMessage(
        `Extracted Banner/Backdrop & Poster from JustWatch for "${data.title}"${
          data.tmdbId ? ` (TMDB #${data.tmdbId})` : ''
        }!`
      );
    } catch {
      setErrorMessage('Network error while extracting from JustWatch.');
    } finally {
      setIsExtractingJw(false);
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

  const handleSaveToFirestore = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    if (!currentUser || !isAdmin) {
      setErrorMessage(
        `Only ${ADMIN_EMAIL} can add or update movies and TV shows.`
      );
      return;
    }

    const parsedCine = parseOrBuildCineSrcUrl(
      cinesrcInput,
      mediaType,
      Number(tmdbIdInput)
    );
    const finalMediaType = parsedCine.detectedType;
    const finalTmdbId = parsedCine.detectedTmdbId;
    const finalEmbedUrl = parsedCine.embedUrl;

    if (!title.trim()) {
      setErrorMessage('Please enter a Movie or TV Show title (or extract via JustWatch).');
      return;
    }

    if (!finalTmdbId || finalTmdbId <= 0) {
      setErrorMessage(
        'Please provide a valid TMDB ID or CineSrc link (e.g. cinesrc.st/embed/movie/157336).'
      );
      return;
    }

    const docId =
      editingId ||
      `${finalMediaType}-${finalTmdbId}`
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .slice(0, 120);

    const safeTitle = title.trim().slice(0, 200);
    const safeTagline = (
      tagline.trim() ||
      `Watch ${safeTitle} in HD via CineSrc.st`
    ).slice(0, 300);
    const safeSynopsis = (
      synopsis.trim() ||
      `Stream ${safeTitle} on ZAPPY.`
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

    // Fallback SVG artwork only if user didn't provide a JustWatch URL or image URL
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
      availabilityStatus: 'playable_demo',
      availabilityNote: `CineSrc.st Embed · TMDB #${finalTmdbId}`,
      visualTheme: {
        primaryHex: '#1A1625',
        secondaryHex: '#251E35',
        accentHex: '#B892FF',
        motif: 'horizon',
      },
    };

    const finalBackdropUrl = (
      backdropUrl.trim() ||
      posterUrl.trim() ||
      createBackdropDataUri(fallbackSeed)
    ).slice(0, 2048);

    const finalPosterUrl = (
      posterUrl.trim() ||
      backdropUrl.trim() ||
      createPosterDataUri(fallbackSeed)
    ).slice(0, 2048);

    setIsSaving(true);
    const docRef = doc(db, 'catalog', docId);

    try {
      const existingSnap = await getDoc(docRef);
      const isExisting = existingSnap.exists();
      const existingData = isExisting ? existingSnap.data() : null;

      const firestorePayload = {
        id: docId,
        tmdbId: finalTmdbId,
        mediaType: finalMediaType,
        contentType: finalMediaType === 'tv' ? 'series' : 'movie',
        title: safeTitle,
        tagline: safeTagline,
        synopsis: safeSynopsis,
        genres: safeGenres,
        releaseYear: Math.min(
          2100,
          Math.max(1900, Number(releaseYear) || 2024)
        ),
        durationMinutes: Math.min(
          1000,
          Math.max(1, Number(durationMinutes) || 120)
        ),
        maturityRating,
        directorOrCreator: safeDirector,
        cast: safeCast,
        posterUrl: finalPosterUrl,
        backdropUrl: finalBackdropUrl,
        cinesrcEmbedUrl: finalEmbedUrl.slice(0, 1024),
        justWatchUrl: justWatchUrl.trim().slice(0, 1024),
        featured: Boolean(featured),
        popularScore: 95,
        seasonsCount:
          finalMediaType === 'tv'
            ? Math.min(100, Math.max(1, Number(seasonsCount) || 1))
            : 0,
        episodesCount:
          finalMediaType === 'tv'
            ? Math.min(5000, Math.max(1, Number(episodesCount) || 8))
            : 0,
        visibility: 'public',
        authorUid: isExisting
          ? existingData?.authorUid || currentUser.uid
          : currentUser.uid,
        createdAt: isExisting
          ? existingData?.createdAt || serverTimestamp()
          : serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(docRef, firestorePayload);

      setStatusMessage(
        `Successfully published "${safeTitle}" (${finalEmbedUrl}) to Cloud Firestore!`
      );
      resetForm();
    } catch (error) {
      handleFirestoreError(
        error,
        editingId ? OperationType.UPDATE : OperationType.CREATE,
        `catalog/${docId}`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteFromFirestore = async (itemId: string, itemTitle: string) => {
    if (!currentUser || !isAdmin) return;
    try {
      await deleteDoc(doc(db, 'catalog', itemId));
      setStatusMessage(`Removed "${itemTitle}" from ZAPPY Firestore catalog.`);
      if (editingId === itemId) resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `catalog/${itemId}`);
    }
  };

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
            className="w-full max-w-5xl rounded-3xl bg-[#161220] border border-white/15 shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-white/10 flex items-center justify-between gap-4 bg-[#1C1729]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-[#B892FF]/20 border border-[#B892FF]/40 text-[#B892FF] flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2
                    id="admin-studio-title"
                    className="text-lg sm:text-xl font-bold text-white font-display truncate"
                  >
                    ZAPPY Admin Studio — CineSrc.st & JustWatch Publisher
                  </h2>
                  <p className="text-xs text-zinc-400 truncate">
                    {isAdmin
                      ? `Authenticated Admin: ${currentUser?.email} · Cloud Firestore Synced`
                      : `Restricted to ${ADMIN_EMAIL}`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="min-h-[40px] min-w-[40px] rounded-xl bg-white/[0.06] border border-white/10 text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
                aria-label="Close Admin Studio"
              >
                <X className="w-4 h-4" />
              </button>
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
                /* Non-Admin / Unauthenticated Gate */
                <div className="rounded-3xl bg-[#1C1729] border border-white/10 p-8 sm:p-10 text-center max-w-xl mx-auto my-6 space-y-5">
                  <div className="w-16 h-16 rounded-2xl bg-[#B892FF]/15 border border-[#B892FF]/40 flex items-center justify-center mx-auto text-[#B892FF]">
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white font-display">
                    Admin Panel Access Restricted
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                    Only <strong className="text-[#B892FF]">{ADMIN_EMAIL}</strong> has permission to add, edit, or delete movies and TV shows in ZAPPY&rsquo;s Cloud Firestore catalog.
                  </p>
                  {currentUser && (
                    <p className="text-xs text-amber-300 font-mono-tabular">
                      Currently signed in as: {currentUser.email}
                    </p>
                  )}
                  <div className="pt-2 flex justify-center">
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
                      className="min-h-[46px] px-6 py-3 rounded-2xl bg-[#B892FF] text-[#110E17] font-bold text-sm hover:bg-[#C9ABFF] transition-all flex items-center gap-2.5 cursor-pointer shadow-lg shadow-[#B892FF]/25"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Sign in with Google ({ADMIN_EMAIL})</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Admin Publisher Workspace */
                <div className="space-y-6">
                  {/* STEP 1: JustWatch Link Auto-Extractor */}
                  <div className="rounded-2xl bg-gradient-to-br from-[#231B36] to-[#181326] border border-[#B892FF]/30 p-4 sm:p-5 space-y-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Wand2 className="w-4 h-4 text-[#B892FF]" />
                        <h3 className="text-sm sm:text-base font-bold text-white font-display">
                          Step 1: Paste JustWatch Link (Auto Banner, Backdrop & Details)
                        </h3>
                      </div>
                      <span className="text-[11px] text-[#B892FF] font-mono-tabular">
                        Solo-Creator Auto Artwork Extractor
                      </span>
                    </div>

                    <p className="text-xs text-zinc-300">
                      Paste the JustWatch page link of any movie or TV show (for example <code className="text-[#B892FF]">https://www.justwatch.com/us/movie/interstellar</code> or <code className="text-[#B892FF]">https://www.justwatch.com/in/tv-show/breaking-bad</code>). ZAPPY will automatically grab its widescreen banner/backdrop image, poster, synopsis, release year, and TMDB ID!
                    </p>

                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <input
                        type="text"
                        value={justWatchUrl}
                        onChange={(e) => setJustWatchUrl(e.target.value)}
                        placeholder="https://www.justwatch.com/us/movie/..."
                        className="flex-1 min-h-[44px] px-4 rounded-xl bg-[#110E17] border border-white/15 text-xs sm:text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#B892FF] font-mono-tabular"
                      />
                      <button
                        type="button"
                        disabled={isExtractingJw}
                        onClick={handleExtractFromJustWatch}
                        className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#B892FF] text-[#110E17] font-bold text-xs sm:text-sm hover:bg-[#C9ABFF] transition-colors flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-60"
                      >
                        {isExtractingJw ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Extracting from JustWatch...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            <span>Auto-Fetch JustWatch Banner & Info</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* STEP 2 & 3: CineSrc.st Embed + Movie/Show Form */}
                  <form
                    onSubmit={handleSaveToFirestore}
                    className="rounded-2xl bg-[#1A1526] border border-white/10 p-4 sm:p-5 space-y-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                      <h3 className="text-sm sm:text-base font-bold text-white font-display flex items-center gap-2">
                        <Plus className="w-4 h-4 text-[#B892FF]" />
                        <span>
                          {editingId
                            ? `Editing: ${title || editingId}`
                            : 'Step 2: Configure CineSrc.st Embed & Publish to ZAPPY'}
                        </span>
                      </h3>
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

                    {/* CineSrc.st Builder Row */}
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
                          <option value="movie">Movie (cinesrc.st/embed/movie/...)</option>
                          <option value="tv">TV Series (cinesrc.st/embed/tv/...)</option>
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-xs text-zinc-400 mb-1">
                          TMDB ID
                        </label>
                        <input
                          type="number"
                          min={1}
                          required
                          value={tmdbIdInput}
                          onChange={(e) => setTmdbIdInput(e.target.value)}
                          placeholder="e.g. 157336 or 1399"
                          className="w-full min-h-[42px] px-3 rounded-xl bg-[#1A1625] border border-white/10 text-xs text-white font-mono-tabular"
                        />
                      </div>

                      <div className="sm:col-span-6">
                        <label className="block text-xs text-zinc-400 mb-1">
                          CineSrc.st Embed Link (Auto-generated or paste directly)
                        </label>
                        <input
                          type="text"
                          required
                          value={cinesrcInput}
                          onChange={(e) => handleCineSrcInputChange(e.target.value)}
                          placeholder="cinesrc.st/embed/movie/157336"
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
                              Total Seasons
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
                              Episodes per Season
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

                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">
                          Cast (Comma-separated)
                        </label>
                        <input
                          type="text"
                          value={castInput}
                          onChange={(e) => setCastInput(e.target.value)}
                          className="w-full min-h-[40px] px-3 rounded-xl bg-[#110E17] border border-white/10 text-xs text-white"
                        />
                      </div>
                    </div>

                    {/* Synopsis */}
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">
                        Synopsis / Description
                      </label>
                      <textarea
                        rows={2}
                        value={synopsis}
                        onChange={(e) => setSynopsis(e.target.value)}
                        placeholder="Plot overview (auto-filled when you fetch from JustWatch)..."
                        className="w-full p-3 rounded-xl bg-[#110E17] border border-white/10 text-xs text-white"
                      />
                    </div>

                    {/* JustWatch Extracted Banner/Backdrop & Poster URLs + Live Visual Preview */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3.5 rounded-xl bg-[#120E1A] border border-white/10">
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                          <ImageIcon className="w-3.5 h-3.5 text-[#B892FF]" />
                          <span>Banner / Backdrop Image URL (Auto-filled from JustWatch)</span>
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
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                          <ImageIcon className="w-3.5 h-3.5 text-[#B892FF]" />
                          <span>Poster Image URL (Auto-filled from JustWatch)</span>
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
                          Select Genres (up to 6):
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

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#B892FF] text-[#110E17] font-bold text-xs sm:text-sm hover:bg-[#C9ABFF] transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-[#B892FF]/25 disabled:opacity-60"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Saving to Firestore...</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4" />
                            <span>
                              {editingId
                                ? 'Update Movie / Show in Firestore'
                                : 'Publish Movie / Show to ZAPPY'}
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
                        Your catalog is currently empty (all demo titles removed). Paste a JustWatch link and TMDB ID above to publish your first movie or TV series!
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
                                <div className="flex items-center gap-1.5 text-[11px] font-mono-tabular text-[#B892FF]">
                                  {item.mediaType === 'tv' ? (
                                    <Tv className="w-3 h-3 shrink-0" />
                                  ) : (
                                    <Film className="w-3 h-3 shrink-0" />
                                  )}
                                  <span>
                                    {item.mediaType.toUpperCase()} #{item.tmdbId}
                                  </span>
                                  <span>·</span>
                                  <span>{item.releaseYear}</span>
                                </div>
                                <p className="text-xs sm:text-sm font-bold text-white truncate">
                                  {item.title}
                                </p>
                                <p className="text-[11px] text-zinc-400 truncate font-mono-tabular">
                                  {item.cinesrcEmbedUrl ||
                                    `https://cinesrc.st/embed/${item.mediaType}/${item.tmdbId}`}
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
