# ZAPPY — TMDB Discovery, Authorized Video Resolver & Google IMA Advertising Upgrade

This upgrade rebrands the streaming platform to **ZAPPY** while preserving all existing working features, visual styling, and responsive layouts. It connects a server-side **TMDB Metadata Discovery Engine**, an **Authorized Video-Source Resolver** (`/api/playback/:mediaType/:tmdbId`) backed by an in-app **Admin Asset Manager**, multi-format **HLS/DASH/MP4 playback**, and **Google IMA HTML5 SDK Video Advertising** (pre-roll and optional mid-roll with transparent test-mode indicators).

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and UX decisions incorporate your confirmed answers from Phase 1 while ensuring strict separation between TMDB metadata, licensed video streams, and video ad tags.

- **Confirmed Decision 1 — Built-In Admin Asset Manager UI with Server Storage**: Site administrators can add, edit, or revoke authorized video assets (mapping a `mediaType` + `tmdbId` + optional season/episode to an MP4, HLS `.m3u8`, or DASH `.mpd` stream, rights status, territory restrictions, and permitted playback window) directly from an in-app Admin Studio modal persisted on the server.
- **Confirmed Decision 2 — Hybrid TMDB Metadata Discovery with Curated TMDB-ID Fallback**: When `TMDB_API_KEY` is configured on the server, ZAPPY fetches live TMDB trending, popular, search, movie details, and TV season/episode metadata server-side. When `TMDB_API_KEY` is not yet set, ZAPPY seamlessly serves a curated catalog enriched with real TMDB IDs and displays a non-intrusive configuration status indicator.
- **Confirmed Decision 3 — Pre-Roll & Optional Mid-Roll Video Ads with IMA Test Mode Toggle**: The player integrates the Google Interactive Media Ads (IMA) HTML5 SDK supporting custom VAST/VMAP tags provided by the site owner, plus an explicit **IMA Development Test Mode** toggle so pre-roll and mid-roll ad breaks can be tested immediately without fabricating revenue claims.

---

## 1. Overview & Core Concept

- **What It Does**: ZAPPY lets viewers discover movies and TV series powered by TMDB metadata, check real-time streaming rights availability via a server-side playback resolver, watch verified open/authorized streams in a custom HTML5/HLS/DASH player with TV season/episode switching, and experience compliant pre-roll/mid-roll video ads via Google IMA.
- **Target Audience / Persona**: Viewers across Android mobile phones, tablets, laptops, and desktop browsers looking for a fast, free, ad-supported cinema experience, and site operators managing licensed video streams and VAST ad tags.
- **Key Value**: Separates discovery metadata (TMDB) from streaming rights verification (`/api/playback/:mediaType/:tmdbId`) and ad monetization (Google IMA), ensuring zero fabricated movie streams or exposed API keys.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **TMDB Discovery & Search Flow**: Users browse the ZAPPY dashboard (Hero Spotlight, Continue Watching, You Might Like, Trending, Popular Movies, TV Series, and Genres) or type in the instant search bar. Results display TMDB posters/backdrops, release years, ratings, and a real-time badge indicating whether an **Authorized Stream** is verified or if the title is **Metadata Only**.
  2. **Authorized Playback Resolution Flow**: Clicking a movie or TV episode requests `/api/playback/:mediaType/:tmdbId` (with optional `season` and `episode` parameters and territory header). If rights are verified and within the permitted date window, the player loads the authorized HLS, DASH, or MP4 stream; otherwise, the player displays a friendly **"Not available to stream yet"** panel with full TMDB metadata and related titles below.
  3. **Google IMA Video Ad Flow**: When playback starts on an authorized stream and video ads are enabled, the player requests the configured VAST/VMAP ad tag (or Google IMA's official test VAST tag when Development Test Mode is active). A clearly labeled **Video Ad Overlay** handles ad loading, countdown timer, skip controls (when permitted by the VAST creative), mid-roll cue points, and automatic fallback to main content if an ad fails or is blocked.
  4. **Admin Asset & Ad Tag Studio Flow**: Clicking **Admin Studio** in the sidebar opens a management workspace where the operator can register or update authorized video assets by TMDB ID (`movie` or `tv`), set rights status (`verified`, `expired`, `revoked`), configure territory codes (e.g., `ALL` or `US,CA,GB`), set valid start/end dates, and configure the VAST/VMAP ad tag URL and IMA Test Mode toggle.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Preserves the sleek dark plum-obsidian streaming workspace (`#110E17` canvas, `#1A1625` frosted sidebar with ambient radial glow) rebranded as **ZAPPY**.
  - *Color Palette & Mood*: Dominant `#110E17` neutral canvas (60%), `#1A1625` / `#221E2E` structural surfaces with `1px solid rgba(255,255,255,0.08)` borders (30%), and `#B892FF` lavender-violet primary accents paired with `#FF8A3D` trending highlights (10%).
  - *Typography & Hierarchy*: `Outfit` for bold display titles and the **ZAPPY** brand mark, `Plus Jakarta Sans` for scannable synopses and navigation, and `JetBrains Mono` (`tabular-nums`) for timecodes, TMDB IDs, ad countdowns, and rights windows.
  - *Component Styling & Layout*: Collapsible left sidebar ($256\text{px}$ expanded, $80\text{px}$ collapsed) on desktop + fixed 5-tab thumb-zone bar on mobile ($\le 15\%$ sticky viewport height, $\ge 44\text{px}$ touch targets).
- **Interactive Feedback & Motion**: Skeleton loading states during TMDB searches and playback resolution, explicit rate-limit (`HTTP 429`) and offline fallback notices, and instant toast confirmations when saving Favourites or updating Admin Asset mappings.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Server-Side TMDB Proxy with Curated TMDB-ID Fallback**
  - *Chosen Approach*: All TMDB API requests (`/search/multi`, `/trending/all/week`, `/movie/popular`, `/tv/popular`, `/movie/:id`, `/tv/:id/season/:season`) are routed through `/api/tmdb/*` on the Express backend using server environment variables (`TMDB_API_KEY` or `TMDB_READ_ACCESS_TOKEN`). When unconfigured, the server returns a curated dataset mapped to real TMDB IDs (e.g., *Tears of Steel* `tmdbId: 136631`, *Sintel* `tmdbId: 45745`, *Big Buck Bunny* `tmdbId: 10378`, *Elephants Dream* `tmdbId: 19004`).
  - *Why*: Protects private TMDB credentials from browser inspection while ensuring the app is 100% functional out of the box before secrets are added.
  - *Alternatives Considered*: Calling TMDB directly from the browser (rejected because it leaks API keys) or blocking the UI until a key is provided (rejected to preserve immediate usability).

- **Decision 2: Strict Separation of Metadata and Video Rights Resolution**
  - *Chosen Approach*: `/api/playback/:mediaType/:tmdbId` validates parameters, checks the server-side authorized asset registry for matching `mediaType` (`movie` or `tv`) and `tmdbId` (plus `season` and `episode` for TV), and verifies `rightsStatus === 'verified'`, territory eligibility, and current date against `validFrom` / `validUntil`.
  - *Why*: Guarantees ZAPPY never fabricates streaming links or assumes a TMDB ID implies streaming rights.
  - *Alternatives Considered*: Embedding video URLs directly inside TMDB metadata objects (rejected because metadata and licensing lifecycles are distinct).

- **Decision 3: Google IMA HTML5 SDK Integration with Explicit Test Mode**
  - *Chosen Approach*: Loads the official Google IMA HTML5 SDK (`//imasdk.googleapis.com/js/sdkloader/ima3.js`) inside a dedicated ad display container layered above the video player,แยก cleanly from page banner placeholders. Supports owner-supplied VAST/VMAP tags, an explicit **Development Test Mode** (using Google's documented sample VAST tag only when Test Mode is enabled), and graceful fallback if the SDK is blocked by browser privacy extensions.
  - *Why*: Provides real IMA `AdDisplayContainer`, `AdsLoader`, and `AdsManager` lifecycle handling (pre-roll, optional mid-roll, skip button, and error recovery) without ever faking ad revenue or interrupting playback with broken tags.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        ZAPPY CLIENT WORKSPACE (React)                      │
├──────────────────────┬─────────────────────────────────────────────────────┤
│  Left Sidebar & Nav  │  Main Viewport & Discovery                          │
│  ├─ Brand: ZAPPY     │  ├─ Top Search Bar, Notifications & Profile Menu    │
│  ├─ Home / Explore   │  ├─ Rounded Hero Spotlight Card                     │
│  ├─ Genres           │  ├─ Continue Watching (16:9 Progress Cards)         │
│  ├─ Favourites       │  ├─ TMDB Carousels & Discovery Grid                 │
│  ├─ Collections      │  ├─ Watch & Details View                            │
│  ├─ Downloads        │  │   ├─ In-Site Video Player (MP4 / HLS / DASH)     │
│  └─ Admin Studio     │  │   ├─ Google IMA HTML5 Ad Container (Pre/Mid)     │
│                      │  │   ├─ TV Season & Episode Selector                │
│                      │  │   └─ Friendly "Not Available Yet" Rights State   │
│                      │  └─ Admin Asset & IMA Config Studio Modal           │
└──────────┬───────────┴──────────────────────────┬──────────────────────────┘
           │                                      │
           ▼  GET /api/tmdb/*                     ▼  GET /api/playback/:type/:id
┌────────────────────────────────────────────────────────────────────────────┐
│                     EXPRESS BACKEND SERVER (Port 3000)                     │
├──────────────────────────────────────┬─────────────────────────────────────┤
│  TMDB Metadata Proxy & Rate Limiter  │  Authorized Video-Source Resolver   │
│  ├─ Parameter & ID Validation        │  ├─ Matches (mediaType, tmdbId,     │
│  ├─ Server-Side TMDB_API_KEY Auth    │  │   season, episode)               │
│  ├─ Response Cache & 429 Handling    │  ├─ Enforces Rights Status,         │
│  └─ Curated TMDB-ID Fallback Catalog │  │   Territory & Date Window        │
│                                      │  └─ Admin CRUD (/api/admin/assets)  │
└──────────────────────────────────────┴─────────────────────────────────────┘
```

### Data Model & State

- **TMDB Media Record (`MediaItem`)**:
  - `id`: Internal slug or composite key (`movie-136631`)
  - `tmdbId`: Numeric TMDB identifier (e.g., `136631`)
  - `mediaType`: `'movie' | 'tv'`
  - `title`, `synopsis`, `genres`, `releaseYear`, `durationMinutes`, `posterUrl`, `backdropUrl`, `seasonsCount`, `episodesCount`, `episodes`
- **Authorized Video Asset (`AuthorizedVideoAsset`)**:
  - `assetId`: Unique registry ID
  - `tmdbId`: Numeric TMDB ID
  - `mediaType`: `'movie' | 'tv'`
  - `seasonNumber?`: Optional season number for TV episodes
  - `episodeNumber?`: Optional episode number for TV episodes
  - `streamFormat`: `'mp4' | 'hls' | 'dash'`
  - `manifestOrFileUrl`: Authorized stream URL (`.mp4`, `.m3u8`, or `.mpd`)
  - `backupStreamUrl?`: Optional secondary authorized mirror URL
  - `rightsStatus`: `'verified' | 'pending' | 'expired' | 'revoked'`
  - `allowedTerritories`: Array of ISO territory codes or `['ALL']`
  - `validFrom`: ISO date string
  - `validUntil`: ISO date string
  - `licenseAttribution`: Explicit license and rights holder note
  - `midRollCueSeconds?`: Array of cue timestamps (e.g., `[120]`) for optional mid-roll ad breaks
- **Video Advertising Configuration (`VideoAdConfig`)**:
  - `imaEnabled`: Boolean toggle for video ads
  - `testMode`: Boolean toggle clearly labeling when a development test VAST tag is active
  - `vastTagUrl`: Custom owner-supplied VAST/VMAP tag URL
  - `enablePreRoll`: Boolean toggle for pre-roll ads before playback
  - `enableMidRoll`: Boolean toggle for mid-roll ad breaks on compatible streams

### Interactive Component & State Mapping

- **Search, Genre & TMDB Discovery Bar**: Typing a query or selecting a genre triggers debounced server calls to `/api/tmdb/discover` (with loading skeletons, empty state reset action, and rate-limit toast recovery).
- **Watch Page & Playback Resolver (`DetailsView` + `VideoPlayer`)**:
  - Selecting a movie or TV season/episode calls `GET /api/playback/:mediaType/:tmdbId?season=X&episode=Y`.
  - If `authorized: true` is returned, the player initializes the stream (using native HTML5 `<video>` or dynamic HLS/DASH playback adapter) and triggers the Google IMA pre-roll workflow if `imaEnabled` is active.
  - If `authorized: false` is returned (no asset registered, expired date window, or restricted territory), the player renders the **"Not available to stream yet"** state with the specific reason (`no_asset_registered`, `rights_expired`, or `territory_restricted`) while keeping all TMDB synopsis, cast, season/episode lists, and Favourites actions interactive.
- **Admin Asset & IMA Studio Modal (`AdminStudioModal`)**:
  - Form with client and server validation to add or update an `AuthorizedVideoAsset` by `tmdbId` and `mediaType`, toggle `rightsStatus`, edit permitted dates/territories, and configure Google IMA VAST settings. Changes immediately persist on the server and refresh the active playback state.
