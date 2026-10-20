# ZAPPY Firestore Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Default Deny**: All unmatched paths in `/databases/{database}/documents/{document=**}` are unconditionally denied (`allow read, write: if false;`).
2. **Admin Exclusive Catalog Writes**: Only an authenticated user with `request.auth.token.email_verified == true` and (`request.auth.token.email == 'pawarayushai1@gmail.com'` or an existing `/admins/$(request.auth.uid)` record) can `create`, `update`, or `delete` documents in `/catalog/{mediaId}`.
3. **Public Catalog Visibility Enforcement**: Visitors and users can `get` or `list` `/catalog/{mediaId}` ONLY when `resource.data.visibility == 'public'` (or if the caller is `isAdmin()`).
4. **Strict Schema & Volumetric Bounds**: Every string field enforces `.size() <= maxLength`, every ID enforces `^[a-zA-Z0-9_\-]+$`, arrays (`genres`, `cast`) enforce strict `.size()` bounds and first-element type validation, and `createdAt` / `updatedAt` must equal `request.time`.
5. **Watchlist Owner Isolation**: A `/watchlists/{watchlistDocId}` document can only be read (`get`/`list`), created, or deleted by its `ownerId == request.auth.uid` with `email_verified == true` and a verified existing `/catalog/$(incoming().mediaId)` parent record.

## 2. The "Dirty Dozen" Payloads
1. **Unverified Admin Email Spoof**: Caller has `email == 'pawarayushai1@gmail.com'` but `email_verified == false` attempting to create `/catalog/movie-1`. -> `PERMISSION_DENIED`.
2. **Non-Admin Catalog Creation**: Regular verified user (`user@example.com`) attempts to create `/catalog/movie-2`. -> `PERMISSION_DENIED`.
3. **Shadow Field Injection on Create**: Admin sends valid `/catalog/movie-3` payload plus extra `"isSuperFeatured": true` key not in `hasOnly()`. -> `PERMISSION_DENIED`.
4. **Author UID Spoofing**: Admin attempts to create `/catalog/movie-4` with `authorUid: "someone-else-uid"` instead of `request.auth.uid`. -> `PERMISSION_DENIED`.
5. **Forged Client Timestamp**: Admin attempts to create `/catalog/movie-5` with a past/future `createdAt` instead of `request.time`. -> `PERMISSION_DENIED`.
6. **Immutable Field Mutation on Update**: Admin attempts to update `/catalog/movie-1` by changing `createdAt` or `authorUid`. -> `PERMISSION_DENIED`.
7. **Value Poisoning on Update**: Admin updates `/catalog/movie-1` with a 5,000-character `title` exceeding `maxLength: 200`. -> `PERMISSION_DENIED`.
8. **Hidden Catalog Scraping**: Unauthenticated user or non-admin queries `/catalog` where `visibility == 'hidden'`. -> `PERMISSION_DENIED`.
9. **Path ID Poisoning**: Caller attempts `get` or `create` on `/catalog/invalid$id!with*chars`. -> `PERMISSION_DENIED`.
10. **Orphaned Watchlist Creation**: Verified user attempts to create `/watchlists/w-1` referencing a non-existent `/catalog/non-existent-id`. -> `PERMISSION_DENIED`.
11. **Cross-User Watchlist Read/List**: User A attempts to `list` or `get` `/watchlists` belonging to `ownerId: "user-b"`. -> `PERMISSION_DENIED`.
12. **Self-Assigned Admin Escalation**: Regular user attempts to write `/admins/their-own-uid`. -> `PERMISSION_DENIED`.
