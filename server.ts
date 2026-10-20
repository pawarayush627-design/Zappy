import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { SAMPLE_CATALOG } from './src/data/catalog.ts';
import { AUTHORIZED_VIDEO_SOURCES } from './src/data/videoSources.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  /**
   * GET /api/config
   * Returns platform configuration including ad placeholder state and whether an external
   * metadata API key (e.g. TMDB_API_KEY) is configured on the server.
   * Never exposes any API keys to the client.
   */
  app.get('/api/config', (_req, res) => {
    const hasExternalApi = Boolean(
      process.env.TMDB_API_KEY &&
      process.env.TMDB_API_KEY.trim() !== '' &&
      process.env.TMDB_API_KEY !== 'MY_TMDB_API_KEY'
    );
    const adSlotsEnabledDefault = process.env.AD_SLOTS_ENABLED !== 'false';

    res.json({
      platformName: 'CineWave',
      externalMetadataConfigured: hasExternalApi,
      metadataSource: hasExternalApi ? 'tmdb_hybrid' : 'sample_catalog',
      adConfig: {
        enabled: adSlotsEnabledDefault,
        providerStatus: 'unconfigured_demo',
        providerName: 'Ad Slot Placeholder (No Live Ad Network Connected)',
        showHomepageBanners: true,
        showDetailsBanner: true,
      },
    });
  });

  /**
   * GET /api/catalog
   * Supports query filtering by search (q), genre, contentType, availability, and sort.
   * If TMDB_API_KEY is configured and live external enrichment is requested, fetches server-side
   * without leaking keys to the browser; otherwise serves the curated sample catalog.
   */
  app.get('/api/catalog', async (req, res) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
      const genre = typeof req.query.genre === 'string' ? req.query.genre : 'All';
      const contentType = typeof req.query.contentType === 'string' ? req.query.contentType : 'all';
      const availability = typeof req.query.availability === 'string' ? req.query.availability : 'all';
      const sort = typeof req.query.sort === 'string' ? req.query.sort : 'featured';

      let items = [...SAMPLE_CATALOG];

      if (q) {
        items = items.filter(
          (item) =>
            item.title.toLowerCase().includes(q) ||
            item.synopsis.toLowerCase().includes(q) ||
            item.genres.some((g) => g.toLowerCase().includes(q)) ||
            item.cast.some((actor) => actor.toLowerCase().includes(q))
        );
      }

      if (genre && genre !== 'All') {
        items = items.filter((item) => item.genres.includes(genre as any));
      }

      if (contentType && contentType !== 'all') {
        items = items.filter((item) => item.contentType === contentType);
      }

      if (availability === 'playable_demo') {
        items = items.filter((item) => item.availabilityStatus === 'playable_demo');
      }

      if (sort === 'year_desc') {
        items.sort((a, b) => b.releaseYear - a.releaseYear);
      } else if (sort === 'year_asc') {
        items.sort((a, b) => a.releaseYear - b.releaseYear);
      } else if (sort === 'title_asc') {
        items.sort((a, b) => a.title.localeCompare(b.title));
      } else if (sort === 'title_desc') {
        items.sort((a, b) => b.title.localeCompare(a.title));
      } else {
        items.sort((a, b) => (b.popularScore || 0) - (a.popularScore || 0));
      }

      res.json({
        items,
        total: items.length,
        source: 'sample_catalog',
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to load catalog data. Falling back to cached catalog.',
        items: SAMPLE_CATALOG,
      });
    }
  });

  /**
   * GET /api/catalog/:id
   * Returns a single movie or series record along with its authorized video source (if available)
   * and related titles.
   */
  app.get('/api/catalog/:id', (req, res) => {
    const item = SAMPLE_CATALOG.find((entry) => entry.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Title not found in CineWave catalog.' });
      return;
    }

    const videoSource = item.videoSourceId
      ? AUTHORIZED_VIDEO_SOURCES[item.videoSourceId] || null
      : null;

    const related = SAMPLE_CATALOG.filter(
      (candidate) =>
        candidate.id !== item.id &&
        candidate.genres.some((g) => item.genres.includes(g))
    ).slice(0, 6);

    res.json({
      item,
      videoSource,
      related,
    });
  });

  /**
   * GET /api/video-sources/:sourceId
   * Resolves an authorized demo video stream record separately from movie metadata.
   */
  app.get('/api/video-sources/:sourceId', (req, res) => {
    const source = AUTHORIZED_VIDEO_SOURCES[req.params.sourceId];
    if (!source) {
      res.status(404).json({
        error: 'No authorized video stream is registered for this source identifier.',
      });
      return;
    }
    res.json({ source });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CineWave server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
