# Sortable

Pairwise ranking app (web + Capacitor iOS): users pick between two options at a time; the server builds personal rankings (adaptive sort) and aggregate Elo scores. Deployable to Google Cloud Run; iOS via Capacitor 6.

## Stack

- **Frontend**: Vite, React 18, Redux Toolkit, React Router v6, Ionic React, Tailwind CSS v4, React Hot Toast
- **Native**: Capacitor 6 (iOS)
- **Backend**: Node.js, Express, Passport (Local + Google + Apple), `express-session` + `connect-pg-simple`, bcrypt, multer
- **Database**: PostgreSQL via `pg` (raw queries, no ORM)
- **Cloud**: Google Cloud Secret Manager, Google Cloud Storage, Firebase Admin (push)
- **Excluded** (intentionally): Socket.io, Stripe, App Engine

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Set up your local environment
cp .env.example .env
# Edit .env and set SESSION_SECRET + DB credentials

# 3. Create the local database (Postgres must be running)
createdb sortable
psql sortable < scripts/init.sql   # If you have a init.sql; otherwise paste from DATABASE_SCHEMA.md

# 4. Run the dev servers (Vite on :3000, Express on :8080)
npm run dev
```

The Vite dev server proxies `/api/*` requests to the Express server at `http://localhost:8080`.

### Initial database setup

The full schema (including ranking tables) is documented in [documentation/DATABASE_SCHEMA.md](documentation/DATABASE_SCHEMA.md). Copy the **Initial Setup SQL** block into a new database (and into both `public` and `qa` schemas for hosted QA—see below).

## QA and production (`qa.sortable.net` vs `sortable.net`)

Use **one** Postgres instance and **two** Postgres schemas:

- **`public`** — used when `ENVIRONMENT` is not `qa` (local dev default, production Cloud Run for `sortable.net`).
- **`qa`** — used when `ENVIRONMENT=qa` (QA Cloud Run for `qa.sortable.net`). The server sets `search_path` to `qa, public` on each connection.

Deploy **two** Cloud Run services with the same container, different env:

```bash
# Production
gcloud run deploy sortable --source . --region=us-central1 \
  --set-env-vars=NODE_ENV=production,ENVIRONMENT=production,DEFAULT_CLIENT_URL=https://sortable.net,...

# QA
gcloud run deploy sortable-qa --source . --region=us-central1 \
  --set-env-vars=NODE_ENV=production,ENVIRONMENT=qa,DEFAULT_CLIENT_URL=https://qa.sortable.net,...
```

Map custom domains (`gcloud beta run domain-mappings create`) and add the DNS records Google shows for each.

## Documentation

- [documentation/ARCHITECTURE.md](documentation/ARCHITECTURE.md) — architecture and API overview.
- [documentation/DATABASE_SCHEMA.md](documentation/DATABASE_SCHEMA.md) — must be updated on every DB change.
- [documentation/TESTING_GUIDELINES.md](documentation/TESTING_GUIDELINES.md) — test conventions.

## Capacitor (iOS)

The first time you set up iOS (requires Xcode):

```bash
npx cap add ios
npm run build
npm run s     # npx cap sync ios
npx cap open ios
```

After adding `resources/icon.png` and `resources/splash.png` (from the brand logo), generate asset catalogs:

```bash
npx @capacitor/assets generate --ios
```

Subsequent updates: `npm run build && npm run s`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Start the production server (`node serverIndex.js`) |
| `npm run dev` | Run Vite + Express together with autoreload |
| `npm run start:dev` | Vite dev server only |
| `npm run server:dev` | Express server only (nodemon) |
| `npm run build` | Build the client (`vite build`, output to `build/`) |
| `npm run preview` | Preview the production build |
| `npm test` | Jest |
| `npm run s` | `npx cap sync ios` |
| `npm run check-secrets` | Verify required env vars are set |

## Deploying cheaply on Google Cloud

This shell is opinionated against App Engine. The cheapest viable GCP setup is:

1. **Hosting: Cloud Run** — scales to zero, generous always-free tier (~2M requests / 360k vCPU-seconds / 180k GiB-seconds per month). One command:

   ```bash
   gcloud run deploy sortable \
     --source . \
     --region=us-central1 \
     --allow-unauthenticated \
     --set-env-vars=NODE_ENV=production,GOOGLE_CLOUD_PROJECT=YOUR_PROJECT
   ```

   This builds the included [Dockerfile](Dockerfile) with Cloud Build and deploys it.

2. **Database** — pick one of:
   - **Cloud SQL `db-f1-micro`** (~$7-10/mo) if you want everything in GCP. Connect via the [Cloud SQL Auth Proxy or `INSTANCE_CONNECTION_NAME`](https://cloud.google.com/sql/docs/postgres/connect-run).
   - **Neon** or **Supabase** free tier (zero cost; both speak Postgres). Just point `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE` at them — no code changes.

3. **Storage: Cloud Storage** (5 GB always-free). Set `GOOGLE_CLOUD_STORAGE_BUCKET` and uploads will go there; otherwise they fall back to a local `uploads/` directory.

4. **Secrets: Secret Manager** (always-free for 6 versions and 10k accesses/mo). Set `GOOGLE_CLOUD_PROJECT` and put the secrets listed in [server/utils/secrets.js](server/utils/secrets.js) into Secret Manager. They are loaded at server startup in production.

5. **Push notifications: Firebase Cloud Messaging** (free). Drop a service-account JSON into the `FIREBASE_SERVICE_ACCOUNT_JSON` secret to enable.

You only pay real money for the Cloud SQL instance — and even that is optional if you use a third-party Postgres free tier.

## Project layout

```
sortable/
├── index.html              Vite entry
├── vite.config.mjs
├── serverIndex.js
├── server/                 Express app, loaders, routes, services, queries
├── src/                    React app (components, routes, store, helpers, hooks, utils)
├── public/                 Static assets (manifest, icons)
├── scripts/                dev.js, check-secrets.js
└── ios/                    (created by `npx cap add ios`)
```

## License

UNLICENSED — private project.
