export type LegalSectionKey =
  | 'about'
  | 'terms'
  | 'privacy'
  | 'disclaimer'
  | 'advertising';

export type InfoModalType = LegalSectionKey | 'contact' | null;

export interface LegalPageContent {
  title: string;
  subtitle: string;
  slug?: string;
  body: string;
}

export interface LegalPagesConfig {
  terms: LegalPageContent;
  privacy: LegalPageContent;
  advertising: LegalPageContent;
  disclaimer: LegalPageContent;
  about: LegalPageContent;
  contactEmail: string;
  updatedAtMs?: number;
}

export const OFFICIAL_CONTACT_EMAIL = 'ContactZappyFun@gmail.com';

export const LEGAL_ROUTE_SLUGS: Record<LegalSectionKey, string> = {
  terms: '/Terms-of-use',
  privacy: '/Privacy-policy',
  about: '/About',
  disclaimer: '/Disclaimer-and-copyright-policy',
  advertising: '/Cookie-policy',
};

/**
 * Authoritative Legal Documents stored directly in source code.
 * Whenever legal documents are updated in the application, the backend server
 * automatically writes the updated content back into this source file (/src/data/legalDocuments.ts).
 */
export const CODE_LEGAL_PAGES: LegalPagesConfig = {
  contactEmail: OFFICIAL_CONTACT_EMAIL,
  updatedAtMs: 1761148800000,
  about: {
    title: 'About ZappyFun',
    subtitle: 'On-Demand Movie & TV Series Discovery and Streaming Platform',
    slug: '/About',
    body: `1. Platform Overview
ZappyFun is a modern web-based movie and television series catalog discovery and streaming interface built with React, TypeScript, Express, Firebase Authentication, and Cloud Firestore. Our goal is to provide a clean, fast, and responsive viewing experience across desktops, laptops, tablets, smartphones, and smart TV browsers.

2. Core Capabilities & Features
• Curated Movie & TV Series Discovery: Browse trending releases, top-rated classics, and genre-specific collections with detailed cast, director, release year, maturity rating, and runtime metadata.
• Multi-Server Third-Party Embed Playback: Watch movies and series episodes through integrated third-party embedded video players with instant server switching and theater mode controls.
• Personal Cloud Watchlist: Sign in with your registered email and password (with 4-digit email OTP verification) or via GitHub OAuth using Firebase Authentication to save and synchronize your personal Watchlist across devices.
• Device-Local Continue Watching: Automatically resume where you left off using privacy-conscious local browser storage on your active device.
• Direct Customer Support & Transparency: Reach the ZappyFun administration team directly through our Support center or via our official contact email.

3. Metadata & Attribution
Catalog artwork, synopses, release dates, ratings, and cast/director credits displayed on ZappyFun are aggregated from public entertainment metadata sources including JustWatch, The Movie Database (TMDB), IMDb Suggestion API, TVMaze, and Wikipedia/Wikimedia Commons.

4. Official Contact Information
For general inquiries, feedback, partnership questions, or technical support, please contact us at:
Email: ContactZappyFun@gmail.com`,
  },
  terms: {
    title: 'Terms of Use',
    subtitle: 'Effective Date: October 2026 · Platform usage rules, user obligations, and service disclosures.',
    slug: '/Terms-of-use',
    body: `Effective Date: October 2026
Platform Name: ZappyFun
Official Contact Email: ContactZappyFun@gmail.com

1. Acceptance of Terms
Welcome to ZappyFun. By accessing, browsing, or using the ZappyFun website, web application, or any associated services (collectively, the "Service"), you acknowledge that you have read, understood, and agree to be bound by these Terms of Use ("Terms") and our Privacy Policy. If you do not agree to these Terms, please discontinue use of the Service immediately.

2. Nature of the Service & Third-Party Playback
ZappyFun operates as an entertainment metadata index and catalog discovery interface. Video playback within the Service is provided via embedded third-party iframe players (such as vidly.pro). ZappyFun does not host, upload, store, transcode, or distribute media files on its own servers. ZappyFun makes no representation or warranty regarding the availability, quality, or licensing status of streams served by external third-party embed providers.

3. User Accounts & Authentication
• Guest Browsing: You may browse the catalog, search titles, and view public pages without registering for an account.
• Authentication Methods: To synchronize your personal Watchlist across sessions and devices, you may register or sign in using your email and password (verified via a secure 4-digit OTP code sent from ZappyFun's official email via Gmail SMTP) or authenticate seamlessly via GitHub OAuth through Firebase Authentication.
• Account Responsibility: You are responsible for maintaining the security of your account credentials and for all activity that occurs under your signed-in session.
• Account Termination & Self-Service Deletion: You may sign out at any time or permanently delete your ZappyFun account and associated Cloud Firestore watchlist records through the "My Space" section of the application.

4. Watchlists & Local Playback Progress
• Cloud Watchlists: When signed in with a verified email address, titles you add to your Watchlist are stored in Cloud Firestore (/watchlists) and linked to your unique Firebase user ID (UID).
• Device-Local Progress: Your "Continue Watching" playback progress and completed-title markers are stored locally in your browser's localStorage on your current device only. Clearing your browser data will reset local playback progress.

5. Acceptable Use Conduct
When using ZappyFun, you agree not to:
• Attempt to bypass, disable, or interfere with security-related features of the Service or Cloud Firestore security rules.
• Use automated scrapers, bots, or scripts to flood the server or abuse API endpoints.
• Submit false, abusive, defamatory, or unlawful content through the Support & Contact form.
• Misrepresent your identity or impersonate any person or entity.

6. Content & Maturity Ratings
Displayed maturity classifications (such as G, PG, PG-13, TV-PG, or TV-14) are informational metadata retrieved from third-party databases. ZappyFun does not guarantee the accuracy of third-party maturity ratings and does not enforce technical age-verification gates. Viewers and parents/guardians are responsible for supervising age-appropriate viewing.

7. Disclaimer of Warranties & Limitation of Liability
The Service is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind, whether express or implied. To the fullest extent permitted by applicable law, ZappyFun and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of your access to or use of the Service or any third-party embedded players.

8. Changes to These Terms
We may update these Terms of Use from time to time to reflect changes in our features, technology, or legal requirements. Updated Terms will be posted on this page (/Terms-of-use) with a revised effective date.

9. Contact Us
If you have any questions or concerns regarding these Terms of Use, please contact us at ContactZappyFun@gmail.com.`,
  },
  privacy: {
    title: 'Privacy Policy',
    subtitle: 'Effective Date: October 2026 · How ZappyFun collects, uses, stores, and protects your information.',
    slug: '/Privacy-policy',
    body: `Effective Date: October 2026
Official Privacy & Grievance Contact: ContactZappyFun@gmail.com

1. Introduction
ZappyFun respects your privacy and is committed to complete transparency regarding the personal data and browser storage processed when you use our web application. This Privacy Policy explains what information is collected, how it is stored, how third-party services interact with your browser, and how you can delete your account and data at any time.

2. Information We Collect & Process
A. User Account Authentication Data (Optional)
When you register or sign in using email and password (with 4-digit email verification) or via Sign in with GitHub through Firebase Authentication, the application processes your:
• Unique Firebase User Identifier (UID)
• Email address and email-verification status
• Public profile display name and avatar (when authenticating via GitHub)
This information is used solely to authenticate your session, display your profile in "My Space", and secure your personal Watchlist in Cloud Firestore.

B. Cloud Firestore Watchlist Records
When a signed-in user saves a movie or TV series to their Watchlist, ZappyFun stores a document in Google Cloud Firestore under the /watchlists collection (/watchlists/{uid}_{mediaId}) containing:
• mediaId (the catalog identifier of the saved title)
• ownerId (your Firebase UID)
• createdAt (server timestamp)
Firestore Security Rules strictly restrict access so that only the authenticated owner (and verified platform administrators) can read or delete these watchlist documents.

C. Support & Contact Form Submissions
When you submit a message through our Support & Contact page, we collect the information you provide:
• First Name and Last Name
• Email Address
• Phone Number (optional)
• Message content, submission timestamp, and your Firebase UID (or "guest" if not signed in)
Support submissions are transmitted to our Express backend (/api/support) and, for verified signed-in users, stored in Cloud Firestore (/support_messages/{messageId}) so that verified administrators can review and respond to your inquiry. Support tickets are strictly private and accessible only to verified administrators.

3. Device-Local Browser Storage (localStorage)
ZappyFun does not use invasive first-party tracking cookies. Instead, we use standard browser localStorage on your device to store:
• zappy_watch_progress_v2: Your "Continue Watching" episode/movie progress on this browser.
• zappy_watchlist_v2: Local cache of your saved Watchlist IDs.
• zappy_completed_v1: List of titles marked as completed on this device.
• zappy_ads_enabled_v1: Your display preference for companion banner slots.
• zappy_legal_pages_v2 & UI configuration caches: Keeps legal disclosures and UI settings responsive.

4. Third-Party Services & Embedded Players
• Video Streaming Embeds (vidly.pro): When you press Play on a title, your browser loads an embedded iframe player from vidly.pro. As with any embedded webpage, the third-party provider receives your IP address and standard browser headers and may set its own cookies or local storage subject to its own privacy policy.
• Metadata & Artwork CDNs: Your browser may fetch movie posters, backdrops, cast portraits, and fonts directly from JustWatch (images.justwatch.com), TMDB (image.tmdb.org), Wikimedia Commons, TVMaze, and Google Fonts.

5. Self-Service Account & Data Deletion
You have full control over your data on ZappyFun:
• Clear Local Data: In "My Space", click "Clear Local Watch History" at any time to wipe your browser's local watch progress, completed markers, and local watchlist cache.
• Permanent Account & Cloud Data Deletion: Signed-in users can click "Delete Account & Data" in "My Space" to permanently delete all of their Cloud Firestore /watchlists documents, clear their local browser watch history, and permanently delete their Firebase Authentication user record.
• Support Ticket Erasure: To request deletion of a previously submitted support message, please email ContactZappyFun@gmail.com from the email address used in your ticket.

6. Data Security
We implement industry-standard security controls, including HTTPS encryption in transit, Firebase Authentication token verification on administrative API endpoints, and strict Firestore Security Rules that block unauthorized access to user watchlists and support messages.

7. Contact Us
For any privacy-related questions, data access requests, or grievance inquiries, please contact us at ContactZappyFun@gmail.com.`,
  },
  disclaimer: {
    title: 'Disclaimer & Copyright Policy',
    subtitle: 'Effective Date: October 2026 · Third-party streaming embeds, DMCA takedown procedures, and copyright disclosures.',
    slug: '/Disclaimer-and-copyright-policy',
    body: `Effective Date: October 2026
Designated Copyright & Takedown Contact: ContactZappyFun@gmail.com

1. No Media Hosting or File Storage
ZappyFun is a catalog indexing and metadata discovery web application. ZappyFun does not host, upload, store, transcode, or control any video files or media streams on its own servers or cloud infrastructure. All video playback functionality is provided exclusively via client-side embeds pointing to third-party external streaming providers (such as vidly.pro).

2. No Claim of Stream Licensing or Endorsement
ZappyFun does not claim ownership of, nor does it represent or warrant that it holds distribution licenses for, third-party embedded video streams. The presence of an embedded player or a metadata listing on ZappyFun does not constitute a representation of verified copyright authorization. Users access third-party embedded streams at their own discretion.

3. Intellectual Property & Metadata Attribution
All movie and television titles, logos, posters, backdrop images, character names, synopses, and cast/director photographs displayed on ZappyFun are the copyrighted property and trademarks of their respective studios, production companies, and rightsholders. Metadata and artwork are retrieved dynamically from publicly accessible entertainment databases including JustWatch, The Movie Database (TMDB), IMDb, TVMaze, and Wikipedia/Wikimedia Commons for informational and cataloging purposes.

4. Copyright Infringement & DMCA Takedown Procedure
ZappyFun respects the intellectual property rights of content creators and copyright owners. Although ZappyFun does not host video files on its servers, we promptly review and honor legitimate requests from copyright owners or their authorized agents to remove specific catalog listings or third-party embed references from the ZappyFun catalog.

To submit a copyright removal or takedown notice, please send a written communication to ContactZappyFun@gmail.com containing:
• Identification of the copyrighted work claimed to have been infringed.
• The exact title and ZappyFun URL (or catalog ID) of the listing you wish to have removed from our index.
• Your contact information, including your full name, organization, mailing address, telephone number, and email address.
• A statement that you have a good-faith belief that the disputed reference is not authorized by the copyright owner, its agent, or the law.
• A statement that the information in your notice is accurate and, under penalty of perjury, that you are the copyright owner or authorized to act on the copyright owner's behalf.

5. External Links Disclaimer
The Service may contain links or embeds pointing to external websites and third-party services that are not provided or maintained by ZappyFun. ZappyFun does not guarantee the accuracy, relevance, timeliness, or completeness of any information or media on these external websites.

6. Contact Information
All legal notices, copyright inquiries, and takedown requests should be directed to:
Email: ContactZappyFun@gmail.com`,
  },
  advertising: {
    title: 'Cookie & Local Storage Policy',
    subtitle: 'Effective Date: October 2026 · Browser localStorage keys, third-party embeds, and display preferences.',
    slug: '/Cookie-policy',
    body: `Effective Date: October 2026
Official Contact: ContactZappyFun@gmail.com

1. First-Party Browser Storage (localStorage)
ZappyFun does not set intrusive first-party advertising or cross-site tracking cookies. Instead, the application relies on standard HTML5 browser localStorage on your device to remember your preferences and playback progress:
• zappy_watch_progress_v2: Saves your device-local "Continue Watching" episode and timestamp progress.
• zappy_watchlist_v2: Caches your saved Watchlist items for instant loading.
• zappy_completed_v1: Remembers titles you have finished watching so they are automatically cleared from your active Watchlist.
• zappy_ads_enabled_v1: Stores your preference for whether optional companion display banner slots are enabled or hidden.
• zappy_legal_pages_v2: Caches the latest legal disclosures and contact details.

2. Third-Party Authentication & Embedded Player Storage
• Firebase Authentication (Email & Password): When you sign in, Firebase uses browser storage (IndexedDB / localStorage) to maintain your authenticated session token securely.
• Third-Party Video Embeds (vidly.pro): When you launch the embedded video player, the third-party iframe operates within its own domain context and may set cookies or local storage governed by its own privacy and cookie policies.

3. Managing or Clearing Your Browser Storage
You can clear ZappyFun's viewer storage at any time by visiting "My Space" and clicking "Clear Local Watch History", or by clearing site data in your web browser settings.`,
  },
};

export function fixTypoEmail(text: string): string {
  return String(text || '').replace(
    /ContactZappyFun@gamil\.com/gi,
    OFFICIAL_CONTACT_EMAIL
  );
}

/**
 * Normalizes incoming or edited LegalPagesConfig while preserving all fields
 * and ensuring slugs and contact emails are always valid.
 */
export function normalizeLegalPagesConfig(
  raw?: Partial<LegalPagesConfig> | null
): LegalPagesConfig {
  if (!raw || typeof raw !== 'object') {
    return CODE_LEGAL_PAGES;
  }

  const rawEmail =
    typeof raw.contactEmail === 'string' ? raw.contactEmail.trim() : '';
  const contactEmail =
    !rawEmail || /^ContactZappyFun@gamil\.com$/i.test(rawEmail)
      ? OFFICIAL_CONTACT_EMAIL
      : fixTypoEmail(rawEmail);

  const sections: LegalSectionKey[] = [
    'terms',
    'privacy',
    'advertising',
    'disclaimer',
    'about',
  ];

  const result: LegalPagesConfig = {
    ...CODE_LEGAL_PAGES,
    contactEmail,
    updatedAtMs: raw.updatedAtMs || CODE_LEGAL_PAGES.updatedAtMs,
  };

  for (const key of sections) {
    const incomingSec = raw[key];
    const defaultSec = CODE_LEGAL_PAGES[key];
    if (
      !incomingSec ||
      typeof incomingSec !== 'object' ||
      !incomingSec.body ||
      !incomingSec.body.trim()
    ) {
      result[key] = defaultSec;
      continue;
    }

    const trimmedBody = incomingSec.body.trim();
    // If incoming data is the old short 4-paragraph placeholder from before full legal documents were added in code,
    // upgrade it to the complete CODE_LEGAL_PAGES version unless it was newer than CODE_LEGAL_PAGES.updatedAtMs
    const isShortLegacyPlaceholder =
      trimmedBody.length < 1400 &&
      (trimmedBody.includes('[Owner Input Required:') ||
        trimmedBody.includes(
          'Your personal watchlist and playback progress are synced automatically across sessions'
        ) ||
        trimmedBody.includes(
          'ZappyFun is a web-based movie and TV series discovery application built with React, TypeScript, Express, Firebase Authentication, and Cloud Firestore.\n\nKey Features:'
        ));

    if (
      isShortLegacyPlaceholder &&
      (!raw.updatedAtMs || raw.updatedAtMs <= (CODE_LEGAL_PAGES.updatedAtMs || 0))
    ) {
      result[key] = defaultSec;
    } else {
      result[key] = {
        title: fixTypoEmail(incomingSec.title?.trim() || defaultSec.title),
        subtitle: fixTypoEmail(
          incomingSec.subtitle?.trim() || defaultSec.subtitle
        ),
        slug: LEGAL_ROUTE_SLUGS[key],
        body: fixTypoEmail(incomingSec.body),
      };
    }
  }

  return result;
}

/**
 * Resolves a URL pathname or query parameter to a LegalSectionKey, if it matches
 * any legal page route (case-insensitive):
 * - /Terms-of-use, /terms-of-use, /terms
 * - /Privacy-policy, /privacy-policy, /privacy
 * - /About, /about
 * - /Disclaimer-and-copyright-policy, /disclaimer-and-copyright-policy, /disclaimer
 * - /Cookie-policy, /cookie-policy, /cookies, /advertising
 */
export function resolveLegalSectionFromLocation(
  pathname: string,
  search: string
): LegalSectionKey | null {
  const cleanPath = decodeURIComponent(pathname || '')
    .trim()
    .replace(/\/+$/, '')
    .toLowerCase();

  if (
    cleanPath === '/terms-of-use' ||
    cleanPath === '/terms' ||
    cleanPath === '/termsofuse'
  ) {
    return 'terms';
  }
  if (
    cleanPath === '/privacy-policy' ||
    cleanPath === '/privacy' ||
    cleanPath === '/privacypolicy'
  ) {
    return 'privacy';
  }
  if (cleanPath === '/about' || cleanPath === '/about-us') {
    return 'about';
  }
  if (
    cleanPath === '/disclaimer-and-copyright-policy' ||
    cleanPath === '/disclaimer' ||
    cleanPath === '/dmca' ||
    cleanPath === '/copyright-policy'
  ) {
    return 'disclaimer';
  }
  if (
    cleanPath === '/cookie-policy' ||
    cleanPath === '/cookies' ||
    cleanPath === '/advertising' ||
    cleanPath === '/advertising-policy'
  ) {
    return 'advertising';
  }

  try {
    const params = new URLSearchParams(search || '');
    const legalParam = (params.get('legal') || '').trim().toLowerCase();
    if (legalParam === 'terms' || legalParam === 'terms-of-use') return 'terms';
    if (legalParam === 'privacy' || legalParam === 'privacy-policy')
      return 'privacy';
    if (legalParam === 'about') return 'about';
    if (
      legalParam === 'disclaimer' ||
      legalParam === 'disclaimer-and-copyright-policy' ||
      legalParam === 'dmca'
    ) {
      return 'disclaimer';
    }
    if (
      legalParam === 'cookies' ||
      legalParam === 'cookie-policy' ||
      legalParam === 'advertising'
    ) {
      return 'advertising';
    }
  } catch {
    // Ignore
  }

  return null;
}
