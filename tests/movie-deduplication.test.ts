import assert from 'node:assert';
import { findDuplicateMovie } from '../src/components/AdminStudioModal';
import { MediaItem } from '../src/types/media';
import {
  toMovieSlug,
  getMoviePath,
  getMovieShareUrl,
  findMovieByUrlLocation,
} from '../src/utils/movieUrl';

console.log('Running ZappyFun Movie Deduplication & URL Routing Tests...');

const mockCatalog: MediaItem[] = [
  {
    id: 'movie-157336',
    tmdbId: 157336,
    mediaType: 'movie',
    title: 'Interstellar',
    tagline: 'Mankind was born on Earth. It was never meant to die here.',
    synopsis: 'A team of explorers travel through a wormhole in space in an attempt to ensure humanity survival.',
    contentType: 'movie',
    genres: ['Sci-Fi', 'Drama'],
    releaseYear: 2014,
    durationMinutes: 169,
    maturityRating: 'PG-13',
    directorOrCreator: 'Christopher Nolan',
    cast: ['Matthew McConaughey', 'Anne Hathaway', 'Jessica Chastain'],
    credits: [],
    cinesrcEmbedUrl: 'https://vidly.pro/movie/157336',
    justWatchUrl: 'https://www.justwatch.com/in/movie/interstellar',
    featured: true,
    popularScore: 98,
    posterUrl: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    backdropUrl: 'https://image.tmdb.org/t/p/w1280/xJHokMbljvjADYdit5fK5VQsXEG.jpg',
    availabilityStatus: 'playable_demo',
    availabilityNote: '4K UHD',
    visualTheme: {
      primaryHex: '#1A1625',
      secondaryHex: '#251E35',
      accentHex: '#B892FF',
      motif: 'horizon',
    },
  },
  {
    id: 'movie-693134',
    tmdbId: 693134,
    mediaType: 'movie',
    title: 'Dune: Part Two',
    tagline: 'Long live the fighters.',
    synopsis: 'Paul Atreides unites with Chani and the Fremen while seeking revenge.',
    contentType: 'movie',
    genres: ['Sci-Fi', 'Adventure'],
    releaseYear: 2024,
    durationMinutes: 166,
    maturityRating: 'PG-13',
    directorOrCreator: 'Denis Villeneuve',
    cast: ['Timothée Chalamet', 'Zendaya'],
    credits: [],
    cinesrcEmbedUrl: 'https://vidly.pro/movie/693134',
    justWatchUrl: 'https://www.justwatch.com/in/movie/dune-part-two',
    featured: true,
    popularScore: 96,
    posterUrl: '',
    backdropUrl: '',
    availabilityStatus: 'playable_demo',
    availabilityNote: '4K UHD',
    visualTheme: {
      primaryHex: '#1A1625',
      secondaryHex: '#251E35',
      accentHex: '#B892FF',
      motif: 'horizon',
    },
  },
];

// Test 1: Title match (case-insensitive and trimmed)
const dupByTitle = findDuplicateMovie({ title: '  interstellar  ' }, mockCatalog);
assert(dupByTitle !== undefined, 'Should detect duplicate by normalized title');
assert.strictEqual(dupByTitle?.id, 'movie-157336');
console.log('✅ Test 1 passed: Duplicate detected by case-insensitive title');

// Test 2: TMDB ID match
const dupByTmdb = findDuplicateMovie({ tmdbId: 693134 }, mockCatalog);
assert(dupByTmdb !== undefined, 'Should detect duplicate by TMDB ID');
assert.strictEqual(dupByTmdb?.title, 'Dune: Part Two');
console.log('✅ Test 2 passed: Duplicate detected by TMDB ID');

// Test 3: JustWatch URL match
const dupByJw = findDuplicateMovie(
  { justWatchUrl: 'https://www.justwatch.com/in/movie/interstellar' },
  mockCatalog
);
assert(dupByJw !== undefined, 'Should detect duplicate by JustWatch URL');
console.log('✅ Test 3 passed: Duplicate detected by JustWatch URL');

// Test 4: Editing existing item does NOT trigger false duplicate
const editSelf = findDuplicateMovie(
  {
    id: 'movie-157336',
    title: 'Interstellar',
    tmdbId: 157336,
  },
  mockCatalog,
  'movie-157336' // currentEditId
);
assert.strictEqual(editSelf, undefined, 'Editing existing item should not be flagged as a duplicate of itself');
console.log('✅ Test 4 passed: Editing existing item correctly allowed without false duplicate warning');

// Test 5: Unique candidate is not flagged as duplicate
const uniqueCandidate = findDuplicateMovie(
  {
    title: 'Inception',
    tmdbId: 27205,
    justWatchUrl: 'https://www.justwatch.com/in/movie/inception',
  },
  mockCatalog
);
assert.strictEqual(uniqueCandidate, undefined, 'Brand new movie should not be flagged as duplicate');
console.log('✅ Test 5 passed: Brand new unique movie allowed for upload');

// Test 6: Movie-specific clean URLs (www.zappyfun.netlify.app/(movie name))
assert.strictEqual(toMovieSlug('Interstellar'), 'Interstellar');
assert.strictEqual(toMovieSlug('Dune: Part Two'), 'Dune-Part-Two');
assert.strictEqual(getMoviePath(mockCatalog[0]), '/Interstellar');
assert.strictEqual(
  getMovieShareUrl(mockCatalog[1]),
  'https://www.zappyfun.netlify.app/Dune-Part-Two'
);
assert.strictEqual(
  findMovieByUrlLocation('/Interstellar', '', mockCatalog)?.id,
  'movie-157336'
);
assert.strictEqual(
  findMovieByUrlLocation('/dune-part-two', '', mockCatalog)?.id,
  'movie-693134'
);
assert.strictEqual(
  findMovieByUrlLocation('/Dune%20Part%20Two', '', mockCatalog)?.id,
  'movie-693134'
);
assert.strictEqual(
  findMovieByUrlLocation('/Terms-of-use', '', mockCatalog),
  undefined
);
console.log('✅ Test 6 passed: Movie-specific clean URLs (/Interstellar, /Dune-Part-Two) resolve accurately');

console.log('🎉 All movie deduplication & URL routing tests passed!');
process.exit(0);
