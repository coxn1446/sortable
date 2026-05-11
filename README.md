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

Use `DEFAULT_CLIENT_URL=http://localhost:3000` locally so OAuth redirect URIs match the Vite origin; for hosted QA/production redirect URIs, see **OAuth (Google & Apple)** in [documentation/ARCHITECTURE.md](documentation/ARCHITECTURE.md).

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

Three **native bundles** (AuraSphere-style), selected only when you run **`npx cap sync ios`** — **`CAP_APP_ENV`**, not `NODE_ENV`:

| Script | Bundle ID | Default `server.url` |
| --- | --- | --- |
| `npm run s:dev` | `net.sortable.dev` | Display **Sortable Dev** · LAN URL from `.env` |
| `npm run s:qa` | `net.sortable.qa` | Display **Sortable QA** · `CAP_QA_URL` or `https://qa.sortable.net` |
| `npm run s:prod` | `net.sortable.prod` | Display **Sortable Prod** · `CAP_PROD_URL` or `https://sortable.net` |

Register **`net.sortable.dev`**, **`net.sortable.qa`**, and **`net.sortable.prod`** in Apple Developer if you install all three side by side.

The **same** Xcode project and asset catalogs (**`AppIcon`**, **`Splash`**) are used for every flavor; only `appId`, display name, and dev-server URL change when you sync.

The first time you set up iOS (requires Xcode):

```bash
npx cap add ios
npm run build
npm run s:dev    # or s:qa / s:prod
npx cap open ios
```

**Icon & splash** (see [Capacitor — Splash Screens and Icons](https://capacitorjs.com/docs/guides/splash-screens-and-icons)): put the brand mark at **`resources/icon.png`** (canonical source; optional duplicate **`resources/splash.png`** is unused by the generator). Install deps then whenever the logo changes, regenerate native assets and sync:

```bash
npm install
npm run cap:assets
npm run s:dev   # or the QA/prod sync script you need
```

`cap:assets` runs **`@capacitor/assets`** in “easy” mode against **`resources/`** with plate colors **`#504AED`** (**`sortable.splash`**, sampled from the icon PNG background) and **`#0F172A`** (`sortable-bg`) for dark variants, then copies the mark into **`LaunchMark.imageset`** — matching [`capacitor.config.ts`](capacitor.config.ts) and [`LaunchScreen.storyboard`](ios/App/App/Base.lproj/LaunchScreen.storyboard).

Subsequent updates: `npm run build` then the **sync script for the flavor** you are working on (e.g. `npm run s:dev` for dev).

**Physical iPhone (recommended: HTTPS + self-signed, same pattern as AuraSphere):**

1. `npm run cert` (or `npm run generate-cert:selfsigned`) — writes `certs/cert.pem`, `key.pem`, `ca.pem` (includes **`192.168.0.171`** and other LAN SANs; edit the script to add more IPs if needed).
2. In `.env`, set `SSL_CRT_FILE=./certs/cert.pem`, `SSL_KEY_FILE=./certs/key.pem`, **`CAPACITOR_DEV_SERVER_URL=https://192.168.0.171:3000`** (use your Mac’s IP), and **`DEFAULT_CLIENT_URL`** to the same `https://…:3000` origin for OAuth.
3. AirDrop **`certs/ca.pem`** to the phone → **Settings → General → About → Certificate Trust Settings** → enable full trust for that cert.
4. `npm run s:dev`, then **`npm run dev`** and launch from Xcode. **`scripts/dev.js` loads `.env` before Vite starts**, so `SSL_*` is picked up and Vite serves **HTTPS** on :3000 (required when `CAPACITOR_DEV_SERVER_URL` is `https://`). If you see **ERR_SSL_PROTOCOL_ERROR**, the dev server is still on HTTP — check for a `[vite] … no TLS` warning and confirm **`SSL_CRT_FILE` / `SSL_KEY_FILE`** paths exist. The WebView must not use `localhost` on device (that targets the phone itself).

Simulator over HTTP: omit `SSL_*` and LAN dev URL env vars (dev flavor defaults to `http://localhost:3000`).

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
| `npm run s:dev` | `CAP_APP_ENV=dev` **`npx cap sync ios`** — **`net.sortable.dev`** + dev `server.url` from `.env` |
| `npm run s:qa` | `CAP_APP_ENV=qa` — **`net.sortable.qa`** → `https://qa.sortable.net` (or `CAP_QA_URL`) |
| `npm run s:prod` | `CAP_APP_ENV=prod` — **`net.sortable.prod`** → `https://sortable.net` (or `CAP_PROD_URL`) |
| `npm run cap:assets` | Regenerate iOS **AppIcon** + **Splash** from `resources/icon.png` via `@capacitor/assets` |
| `npm run cert` | Writes `certs/*.pem` for Vite HTTPS (Aura-style LAN SAN list) |
| `npm run generate-cert:selfsigned` | Same as `npm run cert` |
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
├── resources/              Native asset source: `icon.png` for `@capacitor/assets` (`npm run cap:assets`)
├── public/                 Static assets (manifest, icons)
├── scripts/                dev.js, check-secrets.js
└── ios/                    (created by `npx cap add ios`)
```

## License

UNLICENSED — private project.
