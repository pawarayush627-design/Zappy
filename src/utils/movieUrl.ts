import { MediaItem } from '../types/media';

export const DEFAULT_APP_TITLE =
  'ZappyFun — Stream Full Movies Online in 4K UHD';

const RESERVED_ROOT_PATHS = new Set([
  '',
  '/',
  'index.html',
  'terms-of-use',
  'privacy-policy',
  'about',
  'disclaimer-and-copyright-policy',
  'home',
  'movies',
  'categories',
  'watchlist',
  'myspace',
  'support',
  'search',
  'admin',
]);

/**
 * Converts a movie title into a clean, URL-safe path segment for:
 * https://www.zappyfun.netlify.app/(movie name)
 * Example: "The Dark Knight" -> "The-Dark-Knight"
 * Example: "Spider-Man: No Way Home" -> "Spider-Man-No-Way-Home"
 */
export function toMovieSlug(title: string): string {
  const cleaned = (title || '')
    .trim()
    .replace(/['’`]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'Movie';
}

/**
 * Returns the relative browser path for a movie, e.g. "/The-Dark-Knight"
 */
export function getMoviePath(item: Pick<MediaItem, 'title' | 'id'>): string {
  return `/${toMovieSlug(item.title || item.id)}`;
}

/**
 * Returns the full shareable URL for a movie, e.g. "https://www.zappyfun.netlify.app/The-Dark-Knight"
 */
export function getMovieShareUrl(item: Pick<MediaItem, 'title' | 'id'>): string {
  const path = getMoviePath(item);
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return `https://www.zappyfun.netlify.app${path}`;
}

function normalizeLookupToken(raw: string): string {
  return (raw || '')
    .trim()
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * Checks whether a pathname is a potential movie route (not `/` or a reserved legal/system route).
 */
export function isMovieRoutePathname(pathname: string): boolean {
  if (!pathname || pathname === '/') return false;
  if (pathname.startsWith('/api/') || pathname.startsWith('/.netlify/') || pathname.startsWith('/assets/')) {
    return false;
  }
  const cleanSegment = decodeURIComponent(pathname)
    .replace(/^\/+|\/+$/g, '')
    .trim()
    .toLowerCase();
  if (!cleanSegment || RESERVED_ROOT_PATHS.has(cleanSegment)) {
    return false;
  }
  return true;
}

/**
 * Finds a movie in the catalog from either:
 * 1. Clean URL path: `www.zappyfun.netlify.app/(movie name)` (supports hyphens, spaces, URL-encoded titles, case-insensitive)
 * 2. Legacy query parameter: `?title=<movieId or movieTitle>`
 */
export function findMovieByUrlLocation(
  pathname: string,
  search: string,
  catalog: MediaItem[]
): MediaItem | undefined {
  if (!Array.isArray(catalog) || catalog.length === 0) return undefined;

  // 1. Check clean pathname `/<movie-name>`
  if (isMovieRoutePathname(pathname)) {
    let decodedSegment = '';
    try {
      decodedSegment = decodeURIComponent(pathname)
        .replace(/^\/+|\/+$/g, '')
        .trim();
    } catch {
      decodedSegment = pathname.replace(/^\/+|\/+$/g, '').trim();
    }

    if (decodedSegment) {
      const lowerSegment = decodedSegment.toLowerCase();
      const normalizedTarget = normalizeLookupToken(decodedSegment);

      const matchedByPath = catalog.find((movie) => {
        const movieSlug = toMovieSlug(movie.title).toLowerCase();
        if (movieSlug === lowerSegment) return true;
        if (movie.title.trim().toLowerCase() === lowerSegment) return true;
        if (movie.id.trim().toLowerCase() === lowerSegment) return true;
        if (
          normalizedTarget &&
          normalizeLookupToken(movie.title) === normalizedTarget
        ) {
          return true;
        }
        return false;
      });

      if (matchedByPath) return matchedByPath;
    }
  }

  // 2. Fallback: check `?title=` query param for backward compatibility
  if (search) {
    try {
      const params = new URLSearchParams(search);
      const queryTitle = (params.get('title') || '').trim();
      if (queryTitle) {
        const lowerQuery = queryTitle.toLowerCase();
        const normQuery = normalizeLookupToken(queryTitle);
        return catalog.find(
          (movie) =>
            movie.id.toLowerCase() === lowerQuery ||
            toMovieSlug(movie.title).toLowerCase() === lowerQuery ||
            movie.title.trim().toLowerCase() === lowerQuery ||
            (normQuery && normalizeLookupToken(movie.title) === normQuery)
        );
      }
    } catch {
      // Ignore invalid search string
    }
  }

  return undefined;
}
