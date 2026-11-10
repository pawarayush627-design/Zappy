interface NetlifyEvent {
  httpMethod: string;
  body: string | null;
  headers: Record<string, string | undefined>;
}

interface NetlifyResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-email',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

const JUSTWATCH_GENRE_MAP: Record<string, string> = {
  act: 'Action',
  ani: 'Animation',
  cmy: 'Comedy',
  crm: 'Crime',
  doc: 'Documentary',
  drm: 'Drama',
  fnt: 'Fantasy',
  hst: 'Drama',
  hrr: 'Horror',
  fml: 'Family',
  msc: 'Drama',
  rma: 'Romance',
  scf: 'Sci-Fi',
  spt: 'Action',
  trl: 'Thriller',
  war: 'Adventure',
  wsn: 'Adventure',
};

const RESERVED_JUSTWATCH_SEGMENTS = new Set([
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

function mapAgeCertification(
  rawCert: string | undefined | null
): 'G' | 'PG' | 'PG-13' | 'TV-PG' | 'TV-14' {
  const c = (rawCert || '').toUpperCase().trim();
  if (c === 'G' || c === 'U' || c === 'TV-G' || c === 'TV-Y') return 'G';
  if (c === 'PG' || c === 'UA' || c === 'U/A 7+') return 'PG';
  if (c === 'TV-PG' || c === 'U/A 13+') return 'TV-PG';
  return 'PG-13';
}

function createPersonAvatarSvgDataUri(
  name: string,
  role: 'DIRECTOR' | 'ACTOR'
): string {
  const parts = name.trim().split(/\s+/);
  const initials =
    parts.length >= 2
      ? `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase()
      : (name.slice(0, 2) || 'ZP').toUpperCase();
  const bg1 = role === 'DIRECTOR' ? '#2E1C44' : '#1E1830';
  const bg2 = role === 'DIRECTOR' ? '#161122' : '#120E1C';
  const accent = role === 'DIRECTOR' ? '#FF8A3D' : '#B892FF';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" width="200" height="240">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bg1}"/>
        <stop offset="100%" stop-color="${bg2}"/>
      </linearGradient>
    </defs>
    <rect width="200" height="240" rx="24" fill="url(#g)"/>
    <circle cx="100" cy="88" r="38" fill="${accent}" fill-opacity="0.18" stroke="${accent}" stroke-width="2"/>
    <path d="M44 206 C44 162 156 162 156 206" fill="${accent}" fill-opacity="0.14" stroke="${accent}" stroke-width="2"/>
    <text x="100" y="98" text-anchor="middle" fill="#FFFFFF" font-family="system-ui, sans-serif" font-weight="700" font-size="26">${initials}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const personPhotoCache = new Map<string, string>();

async function resolvePersonPhotosFast(
  rawCredits: Array<{
    name: string;
    role: 'DIRECTOR' | 'ACTOR';
    characterName?: string;
    personId?: number;
  }>
) {
  if (rawCredits.length === 0) return [];

  const uniqueNames = Array.from(
    new Set(rawCredits.map((c) => c.name.trim()).filter(Boolean))
  );
  const photoMap = new Map<string, string>();
  const uncachedNames: string[] = [];

  for (const name of uniqueNames) {
    const cached = personPhotoCache.get(name.toLowerCase());
    if (cached) {
      photoMap.set(name.toLowerCase(), cached);
    } else {
      uncachedNames.push(name);
    }
  }

  if (uncachedNames.length > 0) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1800);
      const titlesParam = uncachedNames.slice(0, 14).join('|');
      const wikiBatchUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
        titlesParam
      )}&prop=pageimages&format=json&pithumbsize=400&redirects=1`;

      const res = await fetch(wikiBatchUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'ZappyStreamingPlatform/1.0 (contact@zappy.app)',
        },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const queryObj = data?.query;
        const redirects = new Map<string, string>();
        if (Array.isArray(queryObj?.redirects)) {
          for (const r of queryObj.redirects) {
            if (r.from && r.to) {
              redirects.set(r.to.toLowerCase(), r.from.toLowerCase());
            }
          }
        }
        const pages = queryObj?.pages || {};
        for (const page of Object.values(pages) as any[]) {
          const thumbUrl = page?.thumbnail?.source;
          const pageTitle = (page?.title || '').toLowerCase();
          if (thumbUrl && pageTitle) {
            photoMap.set(pageTitle, thumbUrl);
            personPhotoCache.set(pageTitle, thumbUrl);
            const origFrom = redirects.get(pageTitle);
            if (origFrom) {
              photoMap.set(origFrom, thumbUrl);
              personPhotoCache.set(origFrom, thumbUrl);
            }
          }
        }
      }
    } catch {
      // Fast fallback if Wikipedia times out
    }
  }

  return rawCredits.map((c) => {
    const key = c.name.trim().toLowerCase();
    const matchedPhoto =
      photoMap.get(key) || createPersonAvatarSvgDataUri(c.name, c.role);
    return {
      name: c.name.trim(),
      role: c.role,
      characterName: c.characterName?.trim() || '',
      imageUrl: matchedPhoto,
      personId: c.personId,
    };
  });
}

function parseJustWatchUrl(rawUrl: string): {
  slugTitle: string;
  country: string;
  urlPath: string;
} {
  const trimmedInput = rawUrl.trim();
  if (
    !trimmedInput.startsWith('http://') &&
    !trimmedInput.startsWith('https://') &&
    !trimmedInput.includes('justwatch.com')
  ) {
    return {
      slugTitle: trimmedInput,
      country: 'IN',
      urlPath: '',
    };
  }

  try {
    const parsed = new URL(
      trimmedInput.startsWith('http') ? trimmedInput : `https://${trimmedInput}`
    );

    const queryTitle = (
      parsed.searchParams.get('q') ||
      parsed.searchParams.get('query') ||
      parsed.searchParams.get('title') ||
      parsed.searchParams.get('search') ||
      ''
    ).trim();

    const cleanedPathname = decodeURIComponent(parsed.pathname)
      .replace(/\/+$/, '')
      .replace(/\/season-\d+.*$/i, '')
      .replace(/\/episode-\d+.*$/i, '');

    const parts = cleanedPathname.split('/').filter(Boolean);
    const hasCountryPrefix = Boolean(parts[0] && /^[a-z]{2}$/i.test(parts[0]));
    const country = hasCountryPrefix ? parts[0].toUpperCase() : 'IN';

    const typeSegment = (hasCountryPrefix ? parts[1] || '' : parts[0] || '')
      .toLowerCase()
      .trim();
    const rawSlugCandidate = (
      hasCountryPrefix ? parts[2] || '' : parts[1] || ''
    ).trim();

    if (
      typeSegment === 'search' ||
      RESERVED_JUSTWATCH_SEGMENTS.has(typeSegment) ||
      RESERVED_JUSTWATCH_SEGMENTS.has(rawSlugCandidate.toLowerCase())
    ) {
      if (
        queryTitle &&
        !RESERVED_JUSTWATCH_SEGMENTS.has(queryTitle.toLowerCase())
      ) {
        return {
          slugTitle: queryTitle,
          country,
          urlPath: '',
        };
      }
      if (
        rawSlugCandidate &&
        !RESERVED_JUSTWATCH_SEGMENTS.has(rawSlugCandidate.toLowerCase())
      ) {
        const slugTitleFromCandidate = rawSlugCandidate
          .split('-')
          .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
          .join(' ')
          .trim();
        return {
          slugTitle: slugTitleFromCandidate,
          country,
          urlPath: cleanedPathname,
        };
      }
      return {
        slugTitle: '',
        country,
        urlPath: '',
      };
    }

    if (queryTitle && !rawSlugCandidate) {
      return {
        slugTitle: queryTitle,
        country,
        urlPath: '',
      };
    }

    const slugTitle = rawSlugCandidate
      .split('-')
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
      .join(' ')
      .trim();

    return {
      slugTitle: slugTitle || queryTitle || '',
      country,
      urlPath: rawSlugCandidate ? cleanedPathname : '',
    };
  } catch {
    return {
      slugTitle: trimmedInput,
      country: 'IN',
      urlPath: '',
    };
  }
}

const JUSTWATCH_FRAGMENT_FIELDS = `
  id
  objectId
  objectType
  content(country: $country, language: $language) {
    title
    fullPath
    originalReleaseYear
    shortDescription
    runtime
    ageCertification
    externalIds {
      tmdbId
      imdbId
    }
    scoring {
      imdbScore
      tmdbScore
    }
    genres {
      shortName
      translation(language: $language)
    }
    credits {
      role
      name
      characterName
      personId
    }
    posterUrl(profile: S718, format: JPG)
    backdrops(profile: S1920, format: JPG) {
      backdropUrl
    }
  }
`;

function parseJustWatchNode(node: any) {
  const content = node?.content;
  if (!content) return null;

  const title = content.title || 'Untitled';
  const releaseYear = Number(content.originalReleaseYear) || 2024;
  const synopsis = content.shortDescription || '';
  const durationMinutes = Number(content.runtime) || 120;
  const maturityRating = mapAgeCertification(content.ageCertification);

  const mappedGenres: string[] = [];
  if (Array.isArray(content.genres)) {
    for (const g of content.genres) {
      const mapped = JUSTWATCH_GENRE_MAP[(g?.shortName || '').toLowerCase()];
      if (mapped && !mappedGenres.includes(mapped)) {
        mappedGenres.push(mapped);
      }
    }
  }
  if (mappedGenres.length === 0) {
    mappedGenres.push('Drama');
  }

  const tmdbId = Number(content.externalIds?.tmdbId) || undefined;
  const imdbId = content.externalIds?.imdbId || undefined;
  const imdbScore = Number(content.scoring?.imdbScore) || undefined;
  const tmdbScore = Number(content.scoring?.tmdbScore) || undefined;
  const bestScore = imdbScore || tmdbScore || 8.5;
  const popularScore = Math.min(99, Math.max(60, Math.round(bestScore * 10)));

  const posterUrl = content.posterUrl
    ? `https://images.justwatch.com${content.posterUrl
        .replace('{profile}', 's718')
        .replace('{format}', 'jpg')}`
    : '';

  const extraBackdrops: string[] = Array.isArray(content.backdrops)
    ? content.backdrops
        .map((b: any) =>
          b?.backdropUrl
            ? `https://images.justwatch.com${b.backdropUrl
                .replace('{profile}', 's1920')
                .replace('{format}', 'jpg')}`
            : ''
        )
        .filter(Boolean)
    : [];

  const backdropUrl = extraBackdrops[0] || posterUrl;

  const allCredits = Array.isArray(content.credits) ? content.credits : [];
  const directorCredits = allCredits
    .filter((c: any) => c?.role === 'DIRECTOR' && c?.name)
    .slice(0, 3)
    .map((c: any) => ({
      name: String(c.name).trim(),
      role: 'DIRECTOR' as const,
      characterName: 'Director',
      personId: Number(c.personId) || undefined,
    }));

  const actorCredits = allCredits
    .filter((c: any) => c?.role === 'ACTOR' && c?.name)
    .slice(0, 10)
    .map((c: any) => ({
      name: String(c.name).trim(),
      role: 'ACTOR' as const,
      characterName: c.characterName ? String(c.characterName).trim() : '',
      personId: Number(c.personId) || undefined,
    }));

  const directorOrCreator =
    directorCredits.length > 0
      ? directorCredits.map((d: { name: string }) => d.name).join(', ')
      : 'Featured Creator';

  const cast =
    actorCredits.length > 0
      ? actorCredits.map((a: { name: string }) => a.name)
      : ['Featured Cast'];

  const taglineParts = [
    imdbScore ? `IMDb ${imdbScore.toFixed(1)}` : null,
    `${releaseYear}`,
    directorCredits[0] ? `Directed by ${directorCredits[0].name}` : null,
  ].filter(Boolean);

  const fullPath =
    typeof content.fullPath === 'string' && content.fullPath.startsWith('/')
      ? `https://www.justwatch.com${content.fullPath}`
      : '';

  return {
    title,
    releaseYear,
    synopsis,
    tagline: taglineParts.join(' · ') || `Watch ${title} (${releaseYear})`,
    durationMinutes,
    maturityRating,
    genres: mappedGenres.slice(0, 6),
    tmdbId,
    imdbId,
    imdbScore,
    popularScore,
    posterUrl,
    backdropUrl,
    extraBackdrops,
    directorOrCreator,
    cast,
    justWatchUrl: fullPath,
    rawCredits: [...directorCredits, ...actorCredits],
  };
}

async function queryJustWatchGraphQL(
  searchQuery: string,
  country = 'IN',
  urlPath = ''
) {
  const safeCountry =
    (country || 'IN').toUpperCase() === 'UK'
      ? 'GB'
      : (country || 'IN').toUpperCase();

  if (urlPath) {
    try {
      const urlQuery = {
        operationName: 'GetUrlTitleDetails',
        variables: {
          fullPath: urlPath,
          country: safeCountry,
          language: 'en',
        },
        query: `
          query GetUrlTitleDetails($fullPath: String!, $country: Country!, $language: Language!) {
            urlV2(fullPath: $fullPath) {
              node {
                ... on MovieOrShow {
                  ${JUSTWATCH_FRAGMENT_FIELDS}
                }
              }
            }
          }
        `,
      };

      const res = await fetch('https://apis.justwatch.com/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(urlQuery),
      });

      if (res.ok) {
        const json = await res.json();
        const parsed = parseJustWatchNode(json?.data?.urlV2?.node);
        if (parsed) return parsed;
      }
    } catch {
      // Fallback to search query
    }
  }

  if (searchQuery) {
    try {
      const searchGql = {
        operationName: 'GetSearchTitles',
        variables: {
          searchTitlesFilter: {
            searchQuery,
            objectTypes: ['MOVIE'],
          },
          country: safeCountry,
          language: 'en',
          first: 5,
        },
        query: `
          query GetSearchTitles($searchTitlesFilter: TitleFilter!, $country: Country!, $language: Language!, $first: Int!) {
            popularTitles(country: $country, filter: $searchTitlesFilter, first: $first) {
              edges {
                node {
                  ... on MovieOrShow {
                    ${JUSTWATCH_FRAGMENT_FIELDS}
                  }
                }
              }
            }
          }
        `,
      };

      const searchRes = await fetch('https://apis.justwatch.com/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchGql),
      });

      if (searchRes.ok) {
        const searchJson = await searchRes.json();
        const edges = searchJson?.data?.popularTitles?.edges;
        if (Array.isArray(edges) && edges.length > 0) {
          for (const edge of edges) {
            const parsed = parseJustWatchNode(edge?.node);
            if (parsed) return parsed;
          }
        }
      }
    } catch {
      // Ignore search error
    }
  }

  return null;
}

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const justWatchUrl =
      typeof body?.justWatchUrl === 'string' ? body.justWatchUrl.trim() : '';
    const fallbackTitle =
      typeof body?.title === 'string' ? body.title.trim() : '';

    if (!justWatchUrl && !fallbackTitle) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: 'Please provide a JustWatch URL or movie title.',
        }),
      };
    }

    const parsedInfo = parseJustWatchUrl(justWatchUrl || fallbackTitle);
    const extractedTitleCandidate = (
      fallbackTitle ||
      parsedInfo.slugTitle ||
      ''
    ).trim();

    if (
      (!extractedTitleCandidate ||
        RESERVED_JUSTWATCH_SEGMENTS.has(extractedTitleCandidate.toLowerCase())) &&
      !parsedInfo.urlPath
    ) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error:
            'Skipped blank/non-title JustWatch page. Please use a valid movie link.',
        }),
      };
    }

    const gqlResult = await queryJustWatchGraphQL(
      extractedTitleCandidate,
      parsedInfo.country,
      parsedInfo.urlPath
    );

    const extractedTitle = gqlResult?.title || extractedTitleCandidate;
    if (
      !extractedTitle ||
      RESERVED_JUSTWATCH_SEGMENTS.has(extractedTitle.trim().toLowerCase())
    ) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: 'Could not find a valid movie title for this link.',
        }),
      };
    }

    const extractedYear = gqlResult?.releaseYear || 2024;
    const rawCredits = gqlResult?.rawCredits || [];
    const creditsWithPhotos = await resolvePersonPhotosFast(rawCredits);

    let finalTmdbId =
      gqlResult?.tmdbId && gqlResult.tmdbId > 0 ? gqlResult.tmdbId : 0;
    if (!finalTmdbId) {
      if (gqlResult?.imdbId && /^tt\d+$/i.test(gqlResult.imdbId)) {
        finalTmdbId =
          Number(gqlResult.imdbId.replace(/\D/g, '').replace(/^0+/, '')) ||
          900000;
      } else {
        let hash = 0;
        const seedStr = `movie:${extractedTitle.toLowerCase()}:${extractedYear}`;
        for (let i = 0; i < seedStr.length; i++) {
          hash = (hash * 31 + seedStr.charCodeAt(i)) % 90000000;
        }
        finalTmdbId = 10000000 + Math.abs(hash);
      }
    }

    const cinesrcEmbedUrl = `https://vidly.pro/movie/${finalTmdbId}`;

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        title: extractedTitle,
        releaseYear: extractedYear,
        synopsis:
          gqlResult?.synopsis ||
          `Stream ${extractedTitle} (${extractedYear}) in 4K UHD.`,
        tagline:
          gqlResult?.tagline || `Watch ${extractedTitle} (${extractedYear}) in 4K UHD`,
        durationMinutes: gqlResult?.durationMinutes || 120,
        maturityRating: gqlResult?.maturityRating || 'PG-13',
        genres: gqlResult?.genres || ['Drama'],
        popularScore: gqlResult?.popularScore || 92,
        imdbScore: gqlResult?.imdbScore || null,
        imdbId: gqlResult?.imdbId || null,
        posterUrl: gqlResult?.posterUrl || '',
        backdropUrl: gqlResult?.backdropUrl || gqlResult?.posterUrl || '',
        extraBackdrops: gqlResult?.extraBackdrops || [],
        tmdbId: finalTmdbId,
        mediaType: 'movie',
        contentType: 'movie',
        seasonsCount: 0,
        episodesCount: 0,
        seasons: [],
        directorOrCreator: gqlResult?.directorOrCreator || 'Featured Creator',
        cast: gqlResult?.cast || ['Featured Cast'],
        credits: creditsWithPhotos,
        justWatchUrl: gqlResult?.justWatchUrl || justWatchUrl,
        cinesrcEmbedUrl,
      }),
    };
  } catch (err) {
    console.error('Netlify justwatch-extract error:', err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: 'Failed to extract metadata from JustWatch.',
      }),
    };
  }
};
