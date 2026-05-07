# Sortable - Architecture Documentation

> **IMPORTANT**: Keep this file updated as features are added or architecture changes.

## Last Updated
2026-05-07 (option photos / `PATCH /api/lists/:id/items/:itemId`; Settings + ChoiceCard; auth UI: centered Login/Register; guest nav Home + Discover + Sign up footer; list Choose CTA uses sidebar link style)

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

The same codebase deploys to **development**, **QA** (`qa.sortable.net`, Postgres schema `qa`), and **production** (`sortable.net`, schema `public`). Schema selection is via `ENVIRONMENT`; see [server/utils/dbSchema.js](../server/utils/dbSchema.js) and [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md).

Original app-shell template reference: `App Shell Documentation/APP_SHELL_PROMPT.md` (sibling repo/folder).

## Tech Stack Summary
- Frontend: React 18, Redux Toolkit, Tailwind CSS v4 (design tokens in `tailwind.config.js`), Ionic React (base styles), Capacitor 6 (iOS), Vite 5
- Backend: Node.js LTS, Express 4, Passport (local + Google + Apple), `express-session` + `connect-pg-simple`
- Ranking: pure JS adaptive binary-insertion sort (`server/services/ranking/adaptiveSort.js`) + Elo updates (`server/services/ranking/elo.js`)
- Database: PostgreSQL (`pg`), two logical schemas: `public` (prod/dev default) and `qa` (when `ENVIRONMENT=qa`)
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
├── Nav (brand; signed-in: full primary links, Profile, username/avatar, and Sign out; mobile: brand + profile row when signed in; guests: Home and Discover only, plus Sign up in the footer — Sign in is still linked from Home hero, list pages, and Register)
├── Routes (lazy)
│   ├── Home — hero + Create List CTA + Discover preview (“View more” → `/discover`)
│   ├── CreateList — shared `CreateListForm`; title, items, optional exclude button label, public toggle
│   ├── ListPage — `/list/:id` — sub-nav Choose / Results / Settings (owner); Choose = pairwise compare; Results = rankings; Settings = owner edits title/description, add/remove items, option photo URLs (`image_url`), delete list
│   ├── Discover, Activity (paginated + search), Profile (account + lists teaser + activity preview), ListsPage (`/lists`), Login, Register, NotFound
└── Toaster
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
- **Public**: `/`, `/login`, `/register`, `/discover`, **`/list/:listId`** (Choose — default), **`/list/:listId/results`**, **`/list/:listId/settings`** (owner only in UI; others get redirected), optional **`?reset=1`** on Choose to clear the current user’s comparisons. Legacy: `/l/:slug` (client redirect to id), `/lists/:id/compare` → `/list/:id`, `/lists/:id/results` → `/list/:id/results`
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
- **Client Config** (`src/config/`): Client-side configuration files
- **Server Config** (`server/config/`): Server-side configuration files

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
- **Standardized Utilities**: Custom utilities defined in tailwind.config.js
- **Spacing System**: Consistent padding, margins, and gaps

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
1. User submits credentials
2. Passport strategy validates
3. User serialized to session
4. Session stored in PostgreSQL
5. Subsequent requests deserialize user from session

## Database Architecture

### Connection Management
- Connection pooling via `pg.Pool`
- Health checks with retries
- Graceful shutdown handling
- **Schema routing**: when `ENVIRONMENT=qa`, the pool wrapper sets `search_path` to `qa, public` so QA Cloud Run (`qa.sortable.net`) uses isolated tables alongside production (`public`) in the same database.

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
- `GET /api/auth/google/callback` - Google OAuth callback
- `GET /api/auth/apple` - Initiate Apple Sign In flow
- `POST /api/auth/apple/callback` - Apple Sign In callback
- `POST /api/auth/logout` - Logout and destroy session
- `GET /api/auth/me` - Get current authenticated user (public fields)

### Current user (session)
- `GET /api/users/me` — Same public user shape as `GET /api/auth/me` (authenticated); response via `toPublicUser`.
- `PATCH /api/users/me` — Update `username` (trimmed, max 64, **case-insensitive unique**), `email` (nullable), and/or `profile_picture` (nullable image URL). Returns `{ user }`. **409** with `USERNAME_TAKEN` or `EMAIL_TAKEN` when applicable.

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
- **Routes**: **`/lists/new`** create flow; **`/`** hero + Create List + Discover preview; **`/lists`** owned + participating lists (search / filter UI); **`/profile`** account editor, lists teaser + `/lists`, activity preview + `/activity`; **`/discover`** full Discover grid
- **State**: `lists` Redux slice; server is source of truth after mutations
- **Database**: `lists` (incl. optional `exclude_choice_label`), `list_items`, `list_contributors`

### Pairwise comparisons
- **Description**: Adaptive insertion sort picks the next pair; each choice persisted in `comparisons`. **`ChoiceCard`** shows the option **`label`** at the top with **`image_url`** beneath when set; when **`image_url`** is absent the card shows only the centered **`label`**. Each Choice card exposes a secondary action to exclude an option from *this viewer’s* ranking (copy from `exclude_choice_label` or default **Remove**) without deleting the underlying `list_item`.
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
| `sortable-qa` | `qa.sortable.net` | `NODE_ENV=production`, `ENVIRONMENT=qa` | `qa`, then `public` |

1. Apply the **Initial Setup SQL** from [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) in `public`, then `CREATE SCHEMA IF NOT EXISTS qa` and mirror the same DDL into `qa` (documented in that file).
2. Map custom domains in Cloud Run; point DNS records at Google as shown by `gcloud run domain-mappings`.
3. Set `DEFAULT_CLIENT_URL` per service (`https://sortable.net` vs `https://qa.sortable.net`) for OAuth.

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
   - QA-specific `capacitor.config.ts` settings
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

## Known Issues & Limitations

- [List any known issues]
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
