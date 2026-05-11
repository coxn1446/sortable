# Sortable - Architecture Documentation

> **IMPORTANT**: Keep this file updated as features are added or architecture changes.

## Last Updated
2026-05-11 (**OAuth dev tunnel + native return**) — Public HTTPS dev (e.g. **ngrok**): set **`DEFAULT_CLIENT_URL`** and **`CAP_DEV_URL` / `CAP_SERVER_URL_DEV` / `CAPACITOR_DEV_SERVER_URL`** to the **same** tunnel origin so Passport **`callbackURL`**, session cookies, and the Capacitor WebView share one host. Run **`npm run dev`** (Vite **3000** + API **8080**), then tunnel **3000** (see **`npm run ngrok`**). Regenerate provider redirect/return URLs for that origin. When **`DEFAULT_CLIENT_URL`** is an **`https:`** URL but **`NODE_ENV`** is not production, the API uses **`SameSite=None` + `Secure`** session cookies so **Apple Sign In** `form_post` callbacks keep the session. Optional **`CAP_ALLOW_NAVIGATION_HOSTS`**: comma-separated extra hostnames merged into Capacitor **`server.allowNavigation`** (dev flavor also adds the hostname of **`CAP_DEV_URL`** automatically). Native OAuth completion can redirect via **`Sortable://sortable.net…`** when the client starts the flow with **`return_native=1`** (see **OAuth (Google & Apple)**).

## Table of Contents
- [Overview](#overview)
- [Tech Stack Summary](#tech-stack-summary)
- [System Architecture](#system-architecture)
  - [High-Level Diagram](#high-level-diagram)
- [Frontend Architecture](#frontend-architecture)
  - [Component Hierarchy](#component-hierarchy)
  - [Layout System](#layout-system)
  - [State Management](#state-management)
  - [Routing](#routing)
  - [Key Contexts](#key-contexts)
  - [Firebase Client SDK](#firebase-client-sdk)
  - [Configuration Files](#configuration-files)
  - [Icon System](#icon-system)
  - [Styling System](#styling-system)
- [Backend Architecture](#backend-architecture)
  - [Request Flow](#request-flow)
  - [Service Layer Pattern](#service-layer-pattern)
  - [Authentication Flow](#authentication-flow)
- [Database Architecture](#database-architecture)
  - [Connection Management](#connection-management)
  - [Query Organization](#query-organization)
  - [Schema Documentation](#schema-documentation)
- [API Endpoints](#api-endpoints)
- [Features](#features)
- [Integration Points](#integration-points)
- [Security](#security)
- [Performance Optimizations](#performance-optimizations)
- [Deployment](#deployment)
- [Development Workflow](#development-workflow)
- [Testing Strategy](#testing-strategy)
- [Known Issues & Limitations](#known-issues--limitations)
- [Future Improvements](#future-improvements)
- [Notes](#notes)

## Overview

Sortable is a collaborative **pairwise ranking** web and iOS app. Users create lists of options, make repeated **this vs. that** choices, and the system produces a ranked list per contributor (adaptive insertion sort) plus an **aggregate** ranking across everyone's comparisons (Elo-style ratings on `item_aggregate`). Lists can be **public** (surfaced on Discover) or **private** (shareable only by link); canonical URLs use **`/list/:list_id`** (legacy **`/l/:share_slug`** redirects by resolving the slug to an id).

The same codebase deploys to **development**, **QA** (`qa.sortable.net`, Postgres schema `qa`), and **production** (`sortable.net`, schema `public`). Schema selection is via `ENVIRONMENT` (**`qa`** match is case-insensitive); see [server/utils/dbSchema.js](../server/utils/dbSchema.js) and [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md).

Original app-shell template reference: `App Shell Documentation/APP_SHELL_PROMPT.md` (sibling repo/folder).

## Tech Stack Summary
- Frontend: React 18, Redux Toolkit, Tailwind CSS v4 (design tokens in `tailwind.config.js`), Ionic React (base styles), Capacitor 6 (iOS), Vite 5, TypeScript (dev only; Capacitor CLI reads `capacitor.config.ts`)
- Backend: Node.js LTS, Express 4, Passport (local + Google + Apple), `express-session` + `connect-pg-simple`
- Ranking: pure JS adaptive binary-insertion sort (`server/services/ranking/adaptiveSort.js`) + Elo updates (`server/services/ranking/elo.js`)
- Database: PostgreSQL (`pg`), two logical schemas: `public` (prod/dev default) and `qa` (when `ENVIRONMENT` is `qa`, case-insensitive)
- Cloud: Google Cloud Secret Manager, optional GCS uploads, Firebase Admin (push plumbing only in v1)

## System Architecture

### High-Level Diagram
```
[Client App] → [Express Server] → [PostgreSQL]
                    ↓
              [External Services]
```

## Frontend Architecture

### Component Hierarchy
```
App (NativeProvider)
├── PolicyConsentModal (blocking when `privacy_policy_agreed` or `terms_agreed` is false — opens elevated policy reader modals sharing `src/legal/policyDocuments.js`; `POST /api/users/me/accept-policies` or Sign out)
├── Nav (brand; guests: top bar with logo link to home only — no drawer or sidebar; signed-in: mobile menu + desktop sidebar with full primary links, Profile, and Log out)
├── Routes (lazy)
│   ├── Home — guests: splash hero with compact Register / Sign In `ChoiceCard` pair + Discover preview + legal footer; signed-in: hero + Discover preview
│   ├── Privacy — `/privacy` — boilerplate policy (replace before production)
│   ├── Terms — `/terms` — boilerplate terms (replace before production)
│   ├── CreateList — shared `CreateListForm`; title, items, optional exclude button label, public toggle
│   ├── ListPage — `/list/:id` — sub-nav Choose / Results / Settings (owner); Choose = pairwise compare; Results = rankings; Settings = owner edits title/description, add/remove items, option photo URLs (`image_url`), delete list
│   ├── Discover, Activity (paginated + search), Profile (account + lists teaser + activity preview), ListsPage (`/lists`), Login, Register, NotFound
└── Toaster (`react-hot-toast`, **`top-center`**) — portaled to `#sortable-toast-host` on `<html>` (see `src/index.js` / `ensureToastPortalHost.js`) so fixed toasts are not clipped by the Capacitor `#root` overflow chain; iOS safe-area offsets in `index.css`
```

Shared UI primitives live under `src/components/ui/` (`Button`, `Card`, `ChoiceCard`, `RankedList`, `EmptyState`, `SortableLogoLink`, `SortableSelect`, `SortableNativeSelect`, `ProfileAvatar`).

### Layout System

- Outer column: **`flex h-screen min-h-0 flex-col`** (`App.js`).
- **`main`** is **`flex-1 min-h-0 overflow-y-auto`** so the nav stays visible and scrollable content is contained within the viewport height.

### State Management
- **Redux Store Structure**:
  - `auth`: Current user, session loading
  - `global`: Modal / lightweight UI flags
  - `native`: Capacitor platform hints (keyboard, etc.)
  - `lists`: List metadata by id, `myListIds`, `discoverIds`, `itemsByListId`, current `pairByListId`, `rankingByListId` — selectors `selectMyLists` / `selectDiscoverLists` are memoized with `createSelector`.

### Routing
- **Public**: `/`, `/privacy`, `/terms`, `/login`, `/register`, `/discover`, **`/list/:listId`** (Choose — default), **`/list/:listId/results`**, **`/list/:listId/settings`** (owner only in UI; others get redirected), optional **`?reset=1`** on Choose to clear the current user’s comparisons. Legacy: `/l/:slug` (client redirect to id), `/lists/:id/compare` → `/list/:id`, `/lists/:id/results` → `/list/:id/results`
- **Private** (session required): `/lists/new`; **`/lists`** (all lists you own or participate in — client search/filters on `GET /api/lists/me` data); pairwise flow under **`/list/:id`** Choose when incomplete; `/profile` (account, lists preview + `/lists`, last 10 comparisons + `/activity`); **`/activity`** (paginated comparisons + optional `q` search).
- **Lazy Loading**: Route components use `React.lazy`

### Key Contexts
- `NativeContext`: Capacitor platform, StatusBar on iOS, keyboard listeners

### Firebase Client SDK
[If using Firebase client SDK, document it here]
- **Configuration**: Firebase client SDK initialization location
- **Initialization**: When and how Firebase is initialized
- **Services**: Which Firebase services are used (Auth, Analytics, etc.)
- **Usage**: How components access Firebase services

### Configuration Files
- **Capacitor** (`capacitor.config.ts`): Loaded by the Capacitor CLI (requires **`typescript`** as a devDependency). **`CAP_APP_ENV`** selects the native bundle, **`appName`** (home screen / **`CFBundleDisplayName`**: **`Sortable Dev`**, **`Sortable QA`**, **`Sortable Prod`**), and **`server.url`** (**`npm run s:dev`**, **`s:qa`**, or **`s:prod`**). Dev URL from **`CAP_DEV_URL`** / **`CAP_SERVER_URL_DEV`** / **`CAPACITOR_DEV_SERVER_URL`** (fallback `http://localhost:3000`); QA/prod default to **`https://qa.sortable.net`** / **`https://sortable.net`**, overridable with **`CAP_QA_URL`** / **`CAP_PROD_URL`**. **`server.cleartext`** is **`false`** for `https:` URLs. **`server.allowNavigation`** is built in [`server/utils/capacitorFlavor.js`](../server/utils/capacitorFlavor.js): default Sortable hosts plus **`CAP_ALLOW_NAVIGATION_HOSTS`** (comma-separated) and, in **dev**, the hostname of the resolved dev server URL (ngrok/LAN). [`scripts/capacitor-env.js`](../scripts/capacitor-env.js) loads **`.env`** for sync. Dev TLS: **`npm run cert`** or **`npm run generate-cert:selfsigned`** + **`SSL_CRT_FILE`** / **`SSL_KEY_FILE`** per [`vite.config.mjs`](../vite.config.mjs); trust **`certs/ca.pem`** on device. **Keyboard** (iOS): **`resize: 'none'`** in config so the keyboard overlays the WebView instead of shrinking layout and shifting the top bar; [`NativeContext.js`](../src/utils/NativeContext.js) calls **`Keyboard.setResizeMode({ mode: None })`** on startup.
- **iOS app icon & launch screen**: Source mark [`resources/icon.png`](../resources/icon.png) (**≥ ~900px** square is accepted; ideal **1024×1024** for [`@capacitor/assets`](https://www.npmjs.com/package/@capacitor/assets)). Run **`npm run cap:assets`** to refresh **`AppIcon`**, **`Splash`** (asset catalog; legacy full-bleed fallbacks), and **`LaunchMark`** (via [`scripts/sync-launch-mark.js`](../scripts/sync-launch-mark.js)) used by [`LaunchScreen.storyboard`](../ios/App/App/Base.lproj/LaunchScreen.storyboard). **Capacitor’s splash plugin reuses that storyboard** (centered **`LaunchMark`**, “Sortable” label, plate **`sortable.splash`** **`#504AED`** — RGB sampled from `resources/icon.png` edge pixels). Web static shell: [`public/splash-shell.css`](../public/splash-shell.css) + [`index.html`](../index.html) (skipped on native after the Capacitor bridge is available). Dark-mode asset plates use **`sortable.bg`** (**`#0F172A`**).
- **Client Config** (`src/config/`): Client-side configuration files
- **Server Config** (`server/config/`): Server-side configuration files
- **Legal copy** (`src/legal/policyDocuments.js`): Single source for Privacy/Terms section bodies and the shared effective-date boilerplate line; `/privacy` and `/terms` compose page chrome around these exports; `PolicyConsentModal` opens elevated `Modal` readers with the same sections.

### Icon System
[If you have a centralized icon system, document it here]
- **Centralized Icon Management**: Where icons are imported and exported from
- **Library**: Which icon library is used
- **Dynamic Icon Rendering**: Utilities for rendering icons by name string

### Utility Components
[Document reusable utility components]
- **ComponentName**: Description and usage

### Profile Picture Component
- **ProfileAvatar** (`src/components/ui/ProfileAvatar.js`): Rounded avatar; shows `profile_picture` when set (with `onError` fallback like Aurasphere’s `UserAvatar`), otherwise the **same deterministic animal emoji + hex palette** as Aurasphere (`DEFAULT_AVATAR_EMOJIS` / `DEFAULT_AVATAR_COLORS` in `src/helpers/avatarHelpers.js`, matching `aurasphere/src/helpers/usersHelpers.js`).

### Styling System
[Document your styling approach]
- **Standardized Utilities**: Custom utilities defined in tailwind.config.js (`sortable.*`); OAuth button colors under **`sortable.oauth`** (Google multi-color logo paths use **`fill-sortable-oauth-googleBlue`** etc.). `maxHeight.nav-dropdown` supports the mobile nav sheet on dynamic viewports (`dvh`).
- **Spacing System**: Consistent padding, margins, and gaps
- **Capacitor / iOS shell**: [`src/index.css`](../src/index.css) sets **`100dvh`** min-heights, **`overflow-x: hidden`**, **`safe-area-pt` / `safe-area-pb`** (used in [`Nav.js`](../src/components/Nav/Nav.js) and [`App.js`](../src/components/App.js)), and **`font-size: 1rem`** on **`input` / `textarea` / `select`** (excluding checkbox/radio/range/file) to avoid WKWebView focus zoom.

## Backend Architecture

### Request Flow
```
HTTP Request
  → Express Middleware (CORS, body parsing, sessions, rate limiting)
  → Route Handler
  → Service Layer (business logic)
  → Query Layer (database queries)
  → Response
```

### Service Layer Pattern
- **Routes** (`server/routes/`): Handle HTTP, validation, call services
- **Services** (`server/services/`): Business logic, orchestration
- **Queries** (`server/queries/`): Raw SQL queries, data access

### Authentication Flow
1. User submits credentials (local), or starts an OAuth redirect (Google / Apple).
2. Passport strategy validates (local bcrypt, OAuth profile).
3. For **Google**, if the Google subject is unknown but the **verified email** already belongs to a **local (password) account** with no `google_id`, the server stores **`pendingGoogleLink`** on the session and redirects to `/login?google_link=1`. The user **must POST** ` /api/auth/google/complete-link` with their **account password** before `google_id` is written. Other collisions (email tied to a **different** `google_id`, or **OAuth-only** account without a password) redirect back to login with a specific `error=` query for the toast message.
4. **While signed in**, **`GET /api/auth/google/link-account`** or **`GET /api/auth/apple/link-account`** sets a short-lived **`oauthProviderLinkIntent`** (must match the current session user on callback), then redirects into the normal OAuth authorize URL. On success the callback redirects to **`/profile?linked=google`** or **`/profile?linked=apple`** (or **`/profile?oauth_error=...`** on failure). Linking enforces: provider subject not already on another user; account email (if set) must match the email returned by the provider when the provider supplies one.
5. User serialized to session (`user_id`).
6. Session stored in PostgreSQL
7. Subsequent requests deserialize user from session

## Database Architecture

### Connection Management
- Connection pooling via `pg.Pool`
- Health checks with retries
- Graceful shutdown handling
- **Schema routing**: when `ENVIRONMENT` selects `qa`, the pool wrapper sets `search_path` to `qa, public` so QA Cloud Run (`qa.sortable.net`) uses isolated tables alongside production (`public`) in the same database. The session store (`connect-pg-simple`) also sets **`schemaName: 'qa'`** so session rows always use **`qa.session`** (avoids mis-resolving `"session"` if `search_path` ever differs).

### Query Organization
- Queries grouped by feature domain
- Reusable query fragments
- Parameterized queries for security
- Complex queries use CTEs

## API Endpoints

### Authentication
- `POST /api/auth/login` - Local login
- `POST /api/auth/register` - User registration
- `GET /api/auth/google` - Initiate Google OAuth flow
- `GET /api/auth/google/link-account` - **Session required** (otherwise redirect to `/login?next=/profile`). Starts an in-session **link** to attach Google to the current user, then redirects through `GET /api/auth/google`. Success → **`/profile?linked=google`**; failure → **`/profile?oauth_error=...`**
- `GET /api/auth/google/callback` - Google OAuth callback (redirects: default success → `/` or **`oauthPostSuccessRedirect`** when set; pending anonymous link → `/login?google_link=1`; failures → `/login?error=...` or **`/profile?oauth_error=...`** when linking from profile)
- `GET /api/auth/google/link-pending` - Returns `{ pending, email?, username?, expired? }` for the Google **link-in-progress** session state (no secrets)
- `POST /api/auth/google/complete-link` - Body `{ password }`. Verifies password for the account matching the pending link, sets `google_id` (when still unset), establishes session. Errors use `code`: `GOOGLE_LINK_*` (see handler)
- `POST /api/auth/google/cancel-link` - Clears a pending Google link attempt (`{ ok: true }`)
- `GET /api/auth/apple` - Initiate Apple Sign In flow
- `GET /api/auth/apple/link-account` - **Session required**. Same pattern as Google; success **`/profile?linked=apple`**
- `POST /api/auth/apple/callback` - Apple Sign In callback (same redirect semantics as Google for link flow vs default `/` or `/login?error=apple`)
- `POST /api/auth/logout` - Logout and destroy session
- `GET /api/auth/me` - Get current authenticated user (public fields; includes **`has_google`**, **`has_apple`** booleans — not stored columns, derived from provider ids)

### Current user (session)
- `GET /api/users/me` — Same public user shape as `GET /api/auth/me` (authenticated); response via `toPublicUser`. Includes **`has_google`**, **`has_apple`**, and **`has_password`** (derived server-side; not literal table columns on the wire). Includes **`google_email`** / **`apple_email`** when the IdP last supplied an address (for Log in Settings). Includes **`privacy_policy_agreed`** and **`terms_agreed`** (boolean). When either is **`false`**, the client shows a blocking policy modal; most write APIs return **403** `POLICY_CONSENT_REQUIRED` until resolved.
- `POST /api/users/me/accept-policies` — Body `{ accept_privacy: boolean, accept_terms: boolean }`. For each column currently **`false`**, the matching body flag must be **`true`**; sets acknowledged flags to **`true`**. Returns `{ user }`. **400** with `PRIVACY_ACCEPTANCE_REQUIRED` / `TERMS_ACCEPTANCE_REQUIRED` when a required acknowledgment is missing.
- `PATCH /api/users/me` — Update `username` (trimmed, max 64, **case-insensitive unique**), `email` (nullable), and/or `profile_picture` (nullable image URL). Returns `{ user }`. **409** with `USERNAME_TAKEN` or `EMAIL_TAKEN` when applicable. **Blocked** (via `requirePolicyConsent`) when policy flags are **`false`**.
- `PATCH /api/users/me/password` — Body `{ new_password }` or `{ current_password, new_password }` when a password already exists. **Auth** + policy consent + rate limit. Returns `{ user }`. **400** with codes such as `CURRENT_PASSWORD_REQUIRED`, `CURRENT_PASSWORD_WRONG`, `PASSWORD_TOO_SHORT`.
- `POST /api/users/me/unlink-oauth` — Body `{ provider: 'google' | 'apple' }`. Removes the provider link only if another credential remains (**password** and/or the other provider). **400** `SET_PASSWORD_REQUIRED` when this would leave the account with no sign-in path. **Auth** + policy consent + rate limit. Returns `{ user }`.

### Lists & ranking
- `POST /api/lists` — Create list (body: `title`, `description`, `items`[], `is_public`, optional `exclude_choice_label` max 50 for the pairwise exclude button label). Auth required.
- `GET /api/lists/me` — Lists you own or contribute to (each row includes derived `my_rank_complete` from `user_sort_state.is_complete` for the requesting user).
- `GET /api/lists/discover` — Public lists (no auth).
- `GET /api/lists/activity` — Comparisons for the current user (auth). Query: `limit` (default 20, max 50), `offset`, optional `q` (substring match on list title or winner/loser item labels). Response `{ comparisons, has_more }`.
- `GET /api/lists/:id` — List + items (access rules apply).
- `GET /api/lists/by-slug/:slug` — Resolve by share slug (public lists readable without auth).
- `PATCH /api/lists/:id` — Owner-only metadata update (`title`, `description`, `is_public`, optional `exclude_choice_label`; blank clears stored label so UI uses default **Remove**).
- `DELETE /api/lists/:id` — Owner-only delete.
- `POST /api/lists/:id/items` — Owner-only add item.
- `PATCH /api/lists/:id/items/:itemId` — Owner-only update option (`label` and/or `image_url`; **`null`** or blank **`image_url`** clears stored URL).
- `DELETE /api/lists/:id/items/:itemId` — Owner-only remove item.
- `GET /api/lists/:id/next-pair` — Next comparison pair for current user (starts adaptive sort).
- `POST /api/lists/:id/comparisons` — Body `{ winner_id, loser_id }`; records comparison, updates Elo/aggregate, returns progression / next pair.
- `GET /api/lists/:id/ranking` — Returns `aggregate`, the current user’s `personal` when signed in, `participants` (signed-in only: users with rank rows, with `username`, `profile_picture`, and `is_finalized`), and optional `viewed_personal` when `?view_user_id=<id>` is provided (signed-in only; target must appear in `participants`).
- `POST /api/lists/:id/my-ranking/exclude` — Body `{ item_id }`; persists this user’s exclusion for that item (`user_list_item_exclusions`), drops their comparisons referencing that item, replays adaptive state on eligible items only, rebuilds **`item_aggregate`** from all comparisons still on the list (auth + list access required).
- `POST /api/lists/:id/my-ranking/reset` — Clears the current user’s exclusions, comparisons, ranks, and sort state for the list, then rebuilds `item_aggregate` from all remaining comparisons on that list (auth + list access required).

## Features

### Lists & items
- **Description**: CRUD for lists and line items (including **`PATCH /api/lists/:id`** for metadata, **`PATCH /api/lists/:id/items/:itemId`** for option **`label`** / **`image_url`**, and **`DELETE`** list/item owner endpoints); share via `share_slug`. Owners add option photos from **`/list/:id/settings`** by uploading via **`POST /api/uploads`** (multipart `file`), then **`image_url`** is set on that item.
- **Routes**: **`/lists/new`** create flow; **`/`** splash (guest pairwise Register / Sign In) + Discover preview; signed-in hero + **`/lists/new`** entry + Discover preview; **`/lists`** owned + participating lists (search / filter UI); **`/profile`** account editor, lists teaser + `/lists`, activity preview + `/activity`; **`/discover`** full Discover grid
- **State**: `lists` Redux slice; server is source of truth after mutations
- **Database**: `lists` (incl. optional `exclude_choice_label`), `list_items`, `list_contributors`

### Pairwise comparisons
- **Description**: Adaptive insertion sort picks the next pair; each choice persisted in `comparisons`. **`ChoiceCard`** shows the option **`label`** at the top with **`image_url`** beneath when set; when **`image_url`** is absent the card shows only the centered **`label`**. Optional **`compact`** prop reduces min-height / typography for tight layouts (e.g. guest home hero Register vs Sign In); optional **`elevatedSurface`** applies **`sortable-cardRaised`** on nested cards. Each Choice card exposes a secondary action to exclude an option from *this viewer’s* ranking (copy from `exclude_choice_label` or default **Remove**) without deleting the underlying `list_item` (`onExclude` omitted ⇒ no exclude row).
- **Routes**: **`/list/:listId`** (Choose / Results / Settings sub-navigation); **`?reset=1`** clears the viewer’s comparisons via `POST /my-ranking/reset` (also clears exclusions)
- **Components**: `ChoiceCard`, `ComparePanel`
- **Database**: `comparisons`, `user_sort_state`, `user_item_ranks`, **`user_list_item_exclusions`**

### Aggregate ranking (Elo)
- **Description**: `item_aggregate` holds `elo_rating` and match counts; updated after each comparison per plan in `elo.js`.
- **Database**: `item_aggregate`

### Sharing
- **Description**: Public lists; **`share_slug` remains a stable DB identifier** — legacy **`/l/:slug`** redirects to **`/list/:list_id`**. The list page uses Choose / Results / Settings sub-navigation (ranking selector on Results; pairwise compare on Choose when applicable).
- **Routes**: **`/list/:listId`**, `/l/:slug` (canonical redirect only)

## Integration Points

### External Services
- **Google Cloud Secret Manager (latest)**: Secrets management
- **Google Cloud Storage (latest)**: File storage
- **Firebase (latest)**: Push notifications
- **Stripe (latest)**: Payments
- **Google Places API (latest)**: Location services

### OAuth (Google & Apple)

Passport registers Google and Apple strategies when the corresponding env vars are set ([`server/loaders/passport.js`](../server/loaders/passport.js)). Callback URLs are always:

- `{DEFAULT_CLIENT_URL}/api/auth/google/callback`
- `{DEFAULT_CLIENT_URL}/api/auth/apple/callback`

**`DEFAULT_CLIENT_URL` per environment** (must match the browser origin users use — see [vite.config.mjs](../vite.config.mjs) dev proxy):

| Environment | Typical `DEFAULT_CLIENT_URL` |
| --- | --- |
| Local dev (Vite + Express) | `http://localhost:3000` |
| Public HTTPS dev tunnel (ngrok, etc.) | `https://<your-subdomain>.ngrok-free.app` (must match **`CAP_DEV_URL`**) |
| QA (`qa.sortable.net`) | `https://qa.sortable.net` |
| Production (`sortable.net`) | `https://sortable.net` |

**Public HTTPS dev (ngrok)** — **`npm run dev`** then tunnel port **3000** (Vite proxies `/api` to the API on **8080**). Use **`npm run ngrok`**, which matches Vite’s **HTTP vs HTTPS** (if **`SSL_CRT_FILE`** + **`SSL_KEY_FILE`** are set and files exist, the script tunnels to **`https://127.0.0.1:3000`**; otherwise **`http://…`**). Tunneling with **`http://`** while Vite is serving **HTTPS** causes **ERR_NGROK_3004** (TLS bytes mistaken for HTTP). Ensure **`npm run dev`** is running before starting the tunnel. Set **`DEFAULT_CLIENT_URL`** to the tunnel origin; add the same origin and **`…/api/auth/google/callback`** / **`…/api/auth/apple/callback`** in Google Cloud Console and Apple Services ID return URLs. Set **`CAP_DEV_URL`** (or **`CAP_SERVER_URL_DEV` / `CAPACITOR_DEV_SERVER_URL`**) to that origin so the iOS WebView and OAuth share cookies. Ngrok terminates TLS for the device; local **`SSL_*`** certs are for **LAN** **`https://` Vite** only. Optional **`CAP_ALLOW_NAVIGATION_HOSTS`**: extra Domains (comma-separated) if an IdP or tunnel hostname is not already covered.

**Google Cloud Console (OAuth 2.0 Web client)** — either one client listing all redirect URIs, or separate clients per environment with matching `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` per Cloud Run service:

- **Authorized JavaScript origins**: `http://localhost:3000`, tunnel origin when used, `https://qa.sortable.net`, `https://sortable.net` (add `https://www.sortable.net` if that origin is used).
- **Authorized redirect URIs**: matching origins with path `/api/auth/google/callback` (e.g. localhost, QA, prod, and tunnel when used).

**Apple (Sign in with Apple)** — Services ID web configuration:

- **Return URLs**: same absolute origins as Google, each with path `/api/auth/apple/callback` (include tunnel URL when testing via ngrok).
- **Env**: `APPLE_CLIENT_ID` (Services ID), `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_KEY` (`.p8` private key contents). In `.env`, multi-line PEM is often stored as a single line with `\n` escapes.

**Secrets (QA / production)**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_KEY` load from Secret Manager when unset on the process ([`server/utils/secrets.js`](../server/utils/secrets.js)).

**Native WebView** — `Main.storyboard` uses Capacitor’s **`CAPBridgeViewController`**. With **`SplashScreen` `launchAutoHide: false`**, JS must call **`SplashScreen.hide()`** when the web app is ready (see `capacitor.config.ts`).

**Native OAuth return (`return_native=1`)** — On Capacitor, [`src/helpers/authHelpers.js`](../src/helpers/authHelpers.js) appends **`return_native=1`** to **`/api/auth/google`** and **`/api/auth/apple`** (including **`link-account`**) so the server issues a final redirect to **`Sortable://sortable.net<path>`** (custom scheme + [`capacitor.config.ts`](../capacitor.config.ts) **`server.hostname`**) after OAuth succeeds or fails. For **sign-in / sign-up**, [`GoogleButton`](../src/components/Auth/GoogleButton.js) and [`AppleButton`](../src/components/Auth/AppleButton.js) call **`openSystemBrowserForOAuthStart`** → [`@capacitor/browser`](../package.json) **`Browser.open`**, so Google and Apple run in the **system browser** (SFSafariViewController on iOS) instead of the main WKWebView — avoiding **WebKit error 102** / “Frame load interrupted” on **`accounts.google.com`**. **Link-account** (`linkAccount` prop) keeps a normal `<a href>` so the WebView sends the **session cookie** to **`/api/auth/…/link-account`**. The server embeds return-to-app intent in a short-lived JWT inside the OAuth **`state`** parameter ([`server/services/authService.js`](../server/services/authService.js) **`createOAuthReturnNativeState`** / **`hydrateOAuthReturnToNativeFromOAuthState`**, signed with **`SESSION_SECRET`) so **`return_native`** survives when the IdP runs outside the WebView session. **`req.logIn`** regenerates the session, so the callback passes **`returnNativeFromSignedState`** into **`takeOAuthClientRedirect`** (see [`server/routes/auth.js`](../server/routes/auth.js)) rather than relying on a pre-login session flag alone. [`src/utils/sortableAppUrl.js`](../src/utils/sortableAppUrl.js) maps inbound custom-scheme URLs; [`src/components/App.js`](../src/components/App.js) listens with **`@capacitor/app`** **`appUrlOpen`** and **`navigate`**s. Troubleshooting logs use the **`[oauth-native]`** (API) and **`[oauth-native-client]`** (WKWebView) prefixes. **`Sortable://`** targets are only emitted for safe internal paths (`/` + relative path, no protocol-relative URLs).

### Native Integrations
- **Capacitor (latest)**: iOS/Android native features
- **Push Notifications**: Firebase Cloud Messaging
- **Camera**: Image capture
- **Keyboard**: Native keyboard handling

## Security

### Authentication
- Session-based authentication
- Password hashing with bcrypt (latest)
- OAuth integration (Google, Apple)
- Session stored in database

### Authorization
- Route-level authentication middleware
- User-based access control
- Role-based permissions (if applicable)

### Data Protection
- SQL injection prevention (parameterized queries)
- XSS prevention (CSP headers)
- CSRF protection (sameSite cookies)
- Rate limiting

## Performance Optimizations

### Frontend
- Code splitting by routes
- Lazy loading components
- Image optimization
- Redux state normalization

### Backend
- Database connection pooling
- Query optimization
- Compression middleware
- Rate limiting

## Deployment

### Cloud Run (recommended)

Deploy **two** services from the same image (see [README.md](../README.md)):

| Service | Domain | Env | Postgres `search_path` |
| --- | --- | --- | --- |
| `sortable` | `sortable.net` | `NODE_ENV=production`, `ENVIRONMENT=production` or unset | `public` |
| `sortable-qa` | `qa.sortable.net` | `NODE_ENV=production`, `ENVIRONMENT=qa` (case-insensitive) | `qa`, then `public` |

1. Apply the **Initial Setup SQL** from [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) in `public`, then `CREATE SCHEMA IF NOT EXISTS qa` and mirror the same DDL into `qa` (documented in that file).
2. Map custom domains in Cloud Run; point DNS records at Google as shown by `gcloud run domain-mappings`.
3. Set `DEFAULT_CLIENT_URL` per service (`https://sortable.net` vs `https://qa.sortable.net`) for OAuth.
4. **Cloud SQL socket on Cloud Run**: pass `--add-cloudsql-instances=PROJECT:REGION:INSTANCE` on deploy (or set the same on the service) so the Unix socket exists under `/cloudsql/`. Production instance **`sortable-pg`** is in **`northamerica-northeast1`** (project `sortable-495623`). Cloud Run for `sortable` may run in **`us-central1`** with cross-region attachment; without the flag, startup fails at DB connect (`ENOENT` on the socket). Other config (`DB_*`, `SESSION_SECRET`, OAuth, etc.) loads from Secret Manager when unset in the service env—see [server/utils/secrets.js](../server/utils/secrets.js) and `.env.example`.
5. **Service env (non-secret)**: at minimum `NODE_ENV=production`, `GOOGLE_CLOUD_PROJECT`, `ENVIRONMENT`, and `DEFAULT_CLIENT_URL`; `PORT` is **8080** from the Dockerfile (`EXPOSE 8080` / `ENV PORT=8080`), matching Cloud Run’s default.

### Environment Setup
- **Development**: local Postgres, `.env`, schema `public`, `ENVIRONMENT=development`.
- **QA / Production**: Cloud Run + Cloud SQL or hosted Postgres; Secret Manager for secrets.

### QA Environment

#### Purpose
The QA environment serves as a staging environment that mirrors production for:
- Pre-production testing
- Client/stakeholder demos
- Integration testing with external services
- Performance testing
- User acceptance testing (UAT)

#### QA Environment Setup
1. **Create QA App Engine Service**:
   - Separate App Engine service for QA (e.g., `qa-service`)
   - QA-specific configuration in `app-qa.yaml`
   - QA-specific environment variables

2. **Database Setup**:
   - Create separate Cloud SQL instance for QA
   - Use same schema as production (sync from production or migrations)
   - Use test data (anonymized production data or synthetic data)
   - Regular database snapshots from production for realistic testing

3. **Storage Setup**:
   - Create separate Cloud Storage bucket for QA (e.g., `[project]-qa-storage`)
   - Separate folders for different asset types
   - Test data/images separate from production

4. **Secrets Management**:
   - Create QA-specific secrets in Google Cloud Secret Manager
   - Use test API keys for external services (Stripe test mode, etc.)
   - QA-specific OAuth credentials (if applicable)
   - QA-specific Firebase project (recommended)

5. **Configuration**:
   - iOS QA bundle: **`npm run s:qa`** ( **`CAP_APP_ENV=qa`**, `net.sortable.qa`, **`server.url`** `https://qa.sortable.net` or **`CAP_QA_URL`**)
   - QA-specific CORS origins
   - QA-specific rate limiting (may be more lenient)
   - QA-specific logging levels (more verbose for debugging)

#### QA Deployment Process
1. **Pre-Deployment Checklist**:
   - [ ] All tests passing locally
   - [ ] Code reviewed and approved
   - [ ] Database migrations tested locally
   - [ ] Environment variables updated in Secret Manager
   - [ ] Build tested locally (`npm run build`)

2. **Deployment Steps**:
   ```bash
   # Build for QA
   npm run build
   
   # Deploy to QA App Engine service
   gcloud app deploy app-qa.yaml --version=[version] --project=[qa-project-id]
   
   # Or use specific service
   gcloud app deploy --service=qa-service --version=[version]
   ```

3. **Post-Deployment Verification**:
   - [ ] Health check endpoint responds (`/api/health`)
   - [ ] Database connection successful
   - [ ] Authentication flows work
   - [ ] Critical user paths tested
   - [ ] External service integrations verified
   - [ ] Logs checked for errors

#### QA Testing Procedures
1. **Smoke Testing**: Basic functionality verification
   - User registration/login
   - Core feature workflows
   - API endpoints responding

2. **Regression Testing**: Ensure existing features still work
   - Run full test suite
   - Manual testing of critical paths
   - Cross-browser testing (if web app)

3. **Integration Testing**: Verify external service integrations
   - Payment processing (Stripe test mode)
   - OAuth providers (test accounts)
   - File storage operations
   - Push notifications (test tokens)

4. **Performance Testing**: Verify performance under load
   - Response times
   - Database query performance
   - File upload/download speeds

5. **User Acceptance Testing (UAT)**: Stakeholder verification
   - Client/stakeholder review
   - Feature completeness verification
   - UI/UX review

#### QA Environment Variables
- `NODE_ENV=qa` or `NODE_ENV=staging`
- `QA_CLIENT_URL` - QA frontend URL
- `QA_DB_INSTANCE_UNIX_SOCKET` - QA Cloud SQL connection
- `QA_GOOGLE_CLOUD_STORAGE_BUCKET` - QA storage bucket
- Test API keys for external services
- QA-specific OAuth credentials

#### QA Data Management
- **Test Data**: Use anonymized production data or synthetic test data
- **Data Refresh**: Regular sync from production (anonymized) or reset scripts
- **Data Privacy**: Ensure no real user data in QA (GDPR/compliance)
- **Database Snapshots**: Create snapshots before major testing cycles

#### QA Rollback Procedure
If issues are found in QA:
1. Identify the problematic version
2. Rollback to previous stable version:
   ```bash
   gcloud app versions list --service=qa-service
   gcloud app versions migrate [previous-version] --service=qa-service
   ```
3. Document the issue
4. Fix and redeploy

#### QA Environment Maintenance
- **Regular Updates**: Keep QA environment in sync with production codebase
- **Database Sync**: Periodically sync QA database schema from production (anonymize data)
- **Secret Rotation**: Rotate QA secrets regularly (less critical than production but good practice)
- **Storage Cleanup**: Regularly clean up test files from QA storage bucket
- **Version Management**: Keep track of deployed versions and clean up old versions periodically
- **Monitoring**: Set up basic monitoring/alerts for QA (less critical than production)
- **Access Control**: Limit access to QA environment (separate from production access)

### Deployment Checklist

#### Pre-Production Deployment (via QA)
- [ ] Feature tested and approved in QA environment
- [ ] All QA tests passing
- [ ] Stakeholder approval received (if required)
- [ ] Database migrations tested in QA
- [ ] Performance tested in QA
- [ ] Security review completed (if applicable)
- [ ] Rollback plan documented

#### Production Deployment
- [ ] QA environment verified and stable
- [ ] Production secrets updated in Secret Manager
- [ ] Database backup created (if migrations included)
- [ ] Build tested locally
- [ ] Deploy to production
- [ ] Post-deployment verification
- [ ] Monitor logs and metrics
- [ ] Verify critical user paths

### Build Process
1. `npm run build` - Build React app
2. Deploy to QA environment for testing
3. After QA approval, deploy to production
4. Database migrations (if needed) - test in QA first

## Development Workflow

### Adding a New Feature
1. Create route file in `server/routes/`
2. Create service file in `server/services/`
3. Create query file in `server/queries/`
4. Create Redux reducer in `src/store/`
5. Create components in `src/components/[Feature]/`
6. Add route in `src/components/App.js`
7. Update documentation (this file and DATABASE_SCHEMA.md)
8. Add tests

### Database Changes
1. Make database change (incremental SQL under `server/db/migrations/` for existing databases; keep `scripts/init.sql` in sync for new installs).
2. **IMMEDIATELY update DATABASE_SCHEMA.md**
3. Update queries if needed
4. Test thoroughly

## Testing Strategy

### Unit Tests
- Component tests
- Service tests
- Utility function tests

### Integration Tests
- API endpoint tests
- Database query tests

### Test Files Location
- `src/tests/` - Frontend tests
- `server/tests/` - Backend tests (if applicable)
- Conventions: [TESTING_GUIDELINES.md](TESTING_GUIDELINES.md)

## Known Issues & Limitations

- **QA `session` table without PRIMARY KEY on `sid`**: If `qa.session` was provisioned with older Initial Setup SQL, login/register can fail with Postgres **`42P10`** (*no unique or exclusion constraint matching the ON CONFLICT specification*) because `connect-pg-simple` upserts on **`sid`**. Apply [server/db/migrations/04_session_primary_key_fix.sql](../server/db/migrations/04_session_primary_key_fix.sql) with `search_path` set to **`qa`** (see file header).
- [Performance considerations]
- [Scalability notes]

## Future Improvements

- [Planned improvements]
- [Technical debt]
- [Architecture evolution plans]

## Notes

- [Any important notes about the architecture]
- [Configuration details]
- [Integration specifics]
