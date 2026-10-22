# ZappyFun — Complete Codebase Audit & Compliance Remediation Plan

This artifact documents the complete **Read-Only Codebase, Security, Privacy, and Legal Audit** of the ZappyFun OTT streaming platform alongside the complete **Remediation Blueprint** ready for execution if you choose to proceed.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The audit below is strictly read-only—zero application files or database records have been modified. Review the audit findings and confirmed decisions below. You can keep this artifact purely as a reference, or click **Proceed** to execute all recommended security, privacy, and legal fixes.

- **Confirmed Decision 1 (Artifact Format)**: Structured as a comprehensive Read-Only Audit Report & Legal Fact Sheet paired with the full remediation blueprint.
- **Confirmed Decision 2 (Remediation Scope if Executed)**: Include **all** audit recommendations:
  1. Secure unauthenticated support API endpoints and store guest/user tickets safely.
  2. Synchronize the Admin Studio Firestore security rules snippet with the hardened root security rules (enforcing owner-only watchlist access and verified admin email checks).
  3. Update default Legal Pages (Privacy Policy, Terms of Use, Cookie Policy, Disclaimer) to disclose third-party embed players, metadata/image CDNs, support form fields, and effective dates.
  4. Add direct shareable URL query routing (`?legal=privacy`, `?legal=terms`, `?legal=cookies`, `?legal=disclaimer`, `?legal=about`) so external platforms (such as Google OAuth verification) can link directly to each legal policy.
  5. Add a self-service **"Delete Account & Data"** flow in **My Space** with confirmation modal to purge user watchlist records, local storage history, and Firebase Auth account.
  6. Restrict automatic episode catalog syncing writes to authenticated admins so regular viewers do not trigger rejected database writes.
- **Confirmed Decision 3 (Contact Email Correction)**: Update the platform contact address from `ContactZappyFun@gamil.com` to **`ContactZappyFun@gmail.com`** across all default legal configurations, support views, and admin studio defaults.

---

## 1. Overview & Core Concept (Executive Audit Summary)

### What ZappyFun Currently Is
ZappyFun is a full-stack React 19 + TypeScript + Express OTT streaming discovery and playback web application. Rather than hosting raw video files on its own servers, ZappyFun operates as a **curated entertainment metadata directory and third-party embed player aggregator**:
- **Frontend Experience**: Single-page application with view-state navigation (`home`, `movies_shows`, `movies`, `tv`, `categories`, `myspace`, `support`, `search`, `watchlist`, `details`), an 8-title scheduled Hero Banner rotation, local Watch Progress ("Continue Watching"), cloud-synced Watchlists, a Support ticket form, an interactive Legal/Info modal, an Admin Studio CMS, and a live DOM/CSS Visual UI Editor.
- **Backend Services**: Express server running on port `3000` that queries entertainment metadata providers (**JustWatch GraphQL**, **IMDb Suggestion API**, **TVMaze API**, **Wikipedia REST/Action API**, and optional **TMDB API**), resolves third-party embed player URLs (`https://vidly.pro`), and manages an in-memory support ticket queue.
- **Authentication & Database**: Uses **Firebase Authentication** (Google Sign-In popup only) and **Cloud Firestore** with runtime dual-project switching between the default provisioned project (`aibharix`) and the custom project (`zappyfun`).

### Top 5 Highest-Priority Audit Findings

| Priority | Category | Finding Summary | Impact |
| :--- | :--- | :--- | :--- |
| **1. CRITICAL** | Security & Privacy | **Unauthenticated Support API Endpoints**: Express routes for reading, updating, and deleting support tickets have no authentication or admin verification. | Any external caller can fetch all in-memory support tickets containing user names, emails, phone numbers, and messages, or delete tickets. |
| **2. HIGH** | Database Security | **Permissive Watchlist Rule in Admin Copy-Paste Snippet**: While the primary security rules enforce owner-only access on watchlists, the secondary project snippet inside Admin Studio allows any signed-in user to read or write all watchlists. | If pasted into the secondary Firebase project console, any signed-in user can inspect or overwrite another user's watchlist. |
| **3. HIGH** | Legal & Copyright | **Third-Party Video Player Embedding (`vidly.pro`)**: Playback mounts an external iframe to `vidly.pro` while backend metadata labels streams as `"Authorized Stream"`. | External iframes operate outside ZappyFun's cookie/script control, and stream licensing cannot be verified from source code alone. |
| **4. MEDIUM** | Operations & Legal | **Contact Email Domain Typo (`@gamil.com`)**: Default contact email is set to `ContactZappyFun@gamil.com` instead of `ContactZappyFun@gmail.com`. | Users attempting to send privacy deletion requests, copyright notices, or support emails via `mailto:` links will experience delivery failures. |
| **5. MEDIUM** | Privacy Compliance | **Missing Self-Service Account & Data Deletion**: Signed-in users can create cloud watchlist records and support tickets, but there is no self-service account deletion control in My Space. | Users cannot autonomously erase their authentication profile and associated cloud/local records without emailing support. |

---

## 2. User Experience, Legal Readiness & Visual Design

### Complete Personal Data & Storage Inventory

#### A. Cloud Firestore Collections
| Collection Path | Document Key Pattern | Stored Fields | Read Access | Write / Delete Access | Retention Policy |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Catalog** (`/catalog/{mediaId}`) | Custom slug or JustWatch ID | Title, synopsis, genres, release year, duration, maturity rating, cast, director, poster/backdrop URLs, embed URL, JustWatch URL, featured status, hero timestamp, season/episode counts, visibility, author UID, timestamps | Public when `visibility == 'public'`; Admin otherwise | Admin only (`pawarayushai1@gmail.com` or `admin@zappy.app`) | Permanent until deleted by Admin in Studio |
| **Watchlists** (`/watchlists/{docId}`) | `{userUid}_{mediaId}` | `mediaId`, `ownerId` (Firebase Auth UID), `createdAt` | Document Owner (`ownerId == request.auth.uid`) or Admin | Document Owner or Admin | Permanent until user removes item or deletes account |
| **Support Messages** (`/support_messages/{id}`) | `msg-{timestamp}-{rand}` | `id`, `firstName`, `lastName`, `email`, `phone`, `message`, `senderUid`, `status` (`open` \| `resolved`), `createdAtMs`, `createdAt`, `updatedAt` | Sender (`senderUid == request.auth.uid`) or Admin | **Create**: Verified signed-in user (`senderUid == request.auth.uid`)<br>**Update/Delete**: Admin only | Permanent until Admin deletes ticket in Studio Inbox |
| **UI Config — Global** (`/ui_config/global`) | Literal `global` | `id`, `overridesJson` (Visual UI Editor text, style, visibility, and custom CSS), `authorUid`, `updatedAt` | Public | Admin only | Overwritten on Admin save/reset |
| **UI Config — Legal** (`/ui_config/legal_pages`) | Literal `legal_pages` | `terms`, `privacy`, `advertising` (Cookie Policy), `disclaimer`, `about`, `contactEmail`, `updatedAtMs`, `updatedAt` | Public | Admin only | Overwritten on Admin save |
| **UI Config — Hero** (`/ui_config/hero_cycle`) | Literal `hero_cycle` | `epochMs`, `manualBatchOffset`, `updatedAt` | Public | Admin only | Overwritten on Admin rotation change |

#### B. Browser Local Storage (`localStorage`) Keys
| Storage Key | Data Stored | Scope & Purpose |
| :--- | :--- | :--- |
| `zappy_watch_progress_v2` | Map of `{ mediaId, seasonNumber, episodeNumber, seasonEpisodeLabel, remainingLabel, progressPercent, updatedAtMs }` | Powers "Continue Watching" row and "Resume Sx:Ex" buttons. Stored **exclusively on-device** (never transmitted to Firestore). |
| `zappy_watchlist_v2` | Array of `mediaId` strings | Local cache and guest fallback for Watchlist items. |
| `zappy_completed_v1` | Array of `mediaId` strings | Tracks titles watched to completion ($\ge 95\%$). |
| `zappy_ads_enabled_v1` | Boolean string (`true` / `false`) | Stores user preference toggle inside the Cookie Policy modal. |
| `zappy_legal_pages_v1` | JSON object of legal page texts & contact email | Instant-load local cache of admin-customized legal disclosures. |
| `zappy_hero_8movie_cycle_v1` | JSON object `{ epochMs, manualBatchOffset }` | Local cache of Hero Banner 8-title rotation schedule. |
| `zappy_visual_ui_overrides_v1` | JSON object of DOM/CSS overrides | Local cache of Admin Visual UI Editor customizations. |
| `zappy_active_firebase_project_v1` | `'zappyfun'` or `'default'` | Controls which Firebase project configuration initializes on boot. |

---

### Legal-Page Fact Sheet (Verified Ground Truth)

| Compliance Dimension | Verified Implementation in ZappyFun | Audit Status |
| :--- | :--- | :--- |
| **Platform Name** | ZappyFun | Verified |
| **Primary Contact Email** | `ContactZappyFun@gmail.com` *(corrected from `@gamil.com`)* | Verified & Scheduled for Fix |
| **Operator Legal Identity / Jurisdiction** | Not stated in code (`+91` phone prefix in Support form indicates India). Requires owner input in Admin Legal Editor if formal entity/Grievance Officer disclosure is mandated. | `UNKNOWN — REQUIRES OWNER INPUT` |
| **Authentication Provider** | Google Sign-In via Firebase Authentication (`GoogleAuthProvider` popup). No password storage or anonymous auth. | Verified |
| **Video Streaming Architecture** | Embeds third-party iframe players from **`https://vidly.pro`** (`/movie/{id}` and `/tv/{id}/{s}/{e}`). ZappyFun does not host media files. | Verified |
| **Copyright Licensing Status** | Cannot be verified from code. Backend playback helper sets `licenseNotice: 'Authorized Stream'`, while Disclaimer states ZappyFun only indexes metadata and embeds third-party players. | `NOT VERIFIABLE FROM CODE` |
| **Third-Party Metadata & Image CDNs** | JustWatch (`apis.justwatch.com`, `images.justwatch.com`), IMDb (`v3.sg.media-imdb.com`), TVMaze (`api.tvmaze.com`), Wikipedia/Wikimedia (`en.wikipedia.org`, `upload.wikimedia.org`), TMDB (`api.themoviedb.org`, `image.tmdb.org`), Google Fonts (`fonts.googleapis.com`). | Verified |
| **Cookies & Third-Party Trackers** | No first-party analytics SDK is initialized (`measurementId: 'G-8TWLVE24VB'` is present in config but `getAnalytics()` is never called). Embedded `vidly.pro` iframes may set third-party cookies or ad scripts during playback. | Verified |
| **Admin Legal Editor Security** | Renders paragraphs via standard React text nodes (`whitespace-pre-wrap`), preventing XSS injection. Accessible without login via Footer and Support page. | Verified |

---

### Visual Design & UX Enhancements (For Remediation Execution)
- **Aesthetic Direction**: Retains ZappyFun's signature dark cinematic OTT palette (`#07070b` obsidian canvas, `#0f1016` elevated cards, `#e50914` / `#f59e0b` high-contrast action accents, `Outfit` display headers, `Inter` body prose, and `JetBrains Mono` tabular metadata).
- **Direct Legal Page URLs**: Opening `/?legal=privacy`, `/?legal=terms`, `/?legal=cookies`, `/?legal=disclaimer`, or `/?legal=about` automatically opens the corresponding `<InfoModal />` and updates the browser URL cleanly so external compliance reviewers and OAuth consent screens can link directly to any policy.
- **Self-Service Account & Data Deletion UI**: In **My Space**, signed-in users gain a clear **"Delete Account & Data"** control next to **Sign Out**, protected by an inline confirmation prompt that purges their cloud `/watchlists` items, clears all `zappy_*` `localStorage` keys, and deletes their Firebase Authentication user record.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Hardening Support Ticket Storage & Express Endpoints**
  - *Chosen Approach*: Remove unauthenticated public read/update/delete access from `/api/support` by requiring admin authentication headers on `/api/support` management routes and allowing verified/guest support tickets to be safely managed without exposing user PII (`firstName`, `lastName`, `email`, `phone`, `message`) to unauthenticated GET requests.
  - *Why*: Eliminates the #1 critical PII leak while preserving the existing Support submission form and Admin Studio Support Inbox workflow.
- **Decision 2: Unifying Firestore Security Rules Across Both Projects**
  - *Chosen Approach*: Enforce `request.auth.token.email_verified == true` inside `isAdmin()` in the root security rules and update the Admin Studio copy-paste rules snippet (`ZAPPYFUN_FIRESTORE_RULES_SNIPPET`) so `/watchlists`, `/support_messages`, and `/ui_config` have identical owner and admin protections on both `aibharix` and `zappyfun`.
  - *Why*: Prevents accidental deployment of an insecure `/watchlists` rule when syncing to the secondary Firebase project.
- **Decision 3: Aligning Code & Legal Disclosures on Third-Party Streams**
  - *Chosen Approach*: Update default legal copy in `InfoModal` (and remove misleading hardcoded `"Authorized Stream"` labels) to transparently disclose third-party iframe players (`vidly.pro`), metadata/image CDNs, support form fields, and `ContactZappyFun@gmail.com`.
  - *Why*: Ensures technical truth matches legal disclosures and eliminates contradictory copyright claims.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### System Architecture & Remediation Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           ZAPPYFUN CLIENT (React 19 SPA)                         │
│                                                                                  │
│  ┌─────────────────────┐   ┌─────────────────────────┐   ┌────────────────────┐  │
│  │  Discovery & Player │   │   My Space & Account    │   │ Legal & Support UI │  │
│  │  - HeroBanner       │   │  - Google Sign-In Popup │   │ - ?legal= URL Sync │  │
│  │  - DetailsView      │   │  - Watchlist Sync       │   │ - InfoModal (Safe) │  │
│  │  - VideoPlayer      │   │  - Delete Account &     │   │ - Support Form     │  │
│  │    (vidly.pro)      │   │    Data Purge Flow      │   │   (@gmail.com)     │  │
│  └─────────┬───────────┘   └────────────┬────────────┘   └─────────┬──────────┘  │
└────────────┼────────────────────────────┼──────────────────────────┼─────────────┘
             │                            │                          │
             ▼                            ▼                          ▼
┌────────────────────────┐   ┌─────────────────────────┐   ┌───────────────────────┐
│  BROWSER LOCAL STORAGE │   │   FIREBASE CLOUD SERVICES   │   EXPRESS BACKEND     │
│  - watch_progress_v2   │   │  - Firebase Auth (OAuth)│   │  - /api/justwatch/*   │
│  - watchlist_v2        │   │  - Firestore Rules:     │   │  - /api/tv-info       │
│  - completed_v1        │   │    • /catalog (Public R)│   │  - /api/support       │
│  - legal_pages_v1      │   │    • /watchlists (Owner)│   │    (Admin-Guarded     │
│  - hero_8movie_cycle   │   │    • /support_messages  │   │     Read/Patch/Delete)│
└────────────────────────┘   │    • /ui_config (Admin) │   └───────────────────────┘
                             └─────────────────────────┘
```

### Interactive Component & State Mapping (When Executed)
1. **Support API Protection (`server.ts` & Admin Studio)**:
   - `POST /api/support` validates payload lengths and stores incoming tickets.
   - `GET /api/support`, `PATCH /api/support/:id`, `DELETE /api/support/:id`, and `POST /api/admin/ima-config` require an authenticated admin header (`x-admin-email` / verified token check) so anonymous requests receive `403 Forbidden`.
2. **Firestore Security Rules & Admin Snippet Sync**:
   - `isAdmin()` requires `request.auth.token.email_verified == true` alongside the admin email allowlist (`pawarayushai1@gmail.com`, `admin@zappy.app`).
   - `ZAPPYFUN_FIRESTORE_RULES_SNIPPET` in Admin Studio is updated to enforce `resource.data.ownerId == request.auth.uid` on `/watchlists` and strict admin/sender rules on `/support_messages` and `/ui_config`.
3. **Contact Email & Legal Disclosures (`ContactZappyFun@gmail.com`)**:
   - Default `contactEmail` is updated to `ContactZappyFun@gmail.com` across app state, `InfoModal`, and `AdminStudioModal`, with automatic migration if the cached value is still `ContactZappyFun@gamil.com`.
   - URL query parameter `?legal=terms|privacy|cookies|disclaimer|about` opens `<InfoModal />` directly on page load and syncs via `window.history.pushState`.
4. **Self-Service Account & Data Deletion (`My Space`)**:
   - Clicking **Delete Account & Data** in **My Space** opens a confirmation state, batch-deletes all `/watchlists` documents owned by `currentUser.uid`, clears all `zappy_*` keys from `localStorage`, and invokes Firebase Auth `deleteUser(currentUser)` (with graceful fallback to `signOut` and re-authentication prompt if `auth/requires-recent-login` is triggered).
5. **Admin-Only Catalog Auto-Sync Guard**:
   - `handleAutoSyncEpisodes` only calls `updateDoc` on `/catalog/{id}` when `isAdmin` is true, keeping local state updated for regular viewers without generating rejected Firestore write attempts.

---

## Manual Verification Checklist (For Platform Owner)

- [ ] **Firebase Console (`zappyfun` Project)**: After clicking Proceed (or manually), copy the updated Firestore Rules from **Admin Studio -> Firebase Setup** and publish them in the `zappyfun` Firebase Console.
- [ ] **Authorized OAuth Domains**: In Firebase Console -> Authentication -> Settings -> Authorized domains, verify your production domain is listed for Google Sign-In popups.
- [ ] **Operator Identity in Legal Editor**: Open **Admin Studio -> Legal Pages** and add your legal entity name, governing jurisdiction, and Grievance Officer contact details if required by your local regulations.
