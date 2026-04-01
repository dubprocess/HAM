# Getting Started with HAM

Welcome! This guide will help you get HAM up and running. There are two paths depending on what you're trying to do:

- **[I want to run HAM](#path-a-running-ham)** — IT admin / sysadmin evaluating or deploying HAM
- **[I want to contribute](#path-b-contributing-to-ham)** — Developer looking to add features or provider support

---

## Before you start

### What you need

| Requirement | Notes |
|---|---|
| Docker + Docker Compose | Required for both paths |
| Login method | Local auth (no IdP) or Okta OIDC — see options below |
| Fleet MDM instance | Optional — required for live device sync |
| Apple Business Manager | Optional — adds procurement + AppleCare data |
| Slack webhook | Optional — enables alert notifications |

> **No Okta or external IdP?** HAM now supports local auth mode — just set `LOCAL_AUTH=true` in `backend/.env` and `REACT_APP_LOCAL_AUTH=true` in `frontend/.env.local`. HAM creates a default admin user on first start and shows a username/password login form. No external services required. See [docs/local-auth.md](docs/local-auth.md).

> **Just want to evaluate the UI?** You can load ~50 realistic demo devices without any MDM or IdP connected — see [Step 4a](#step-4a-optional-load-demo-data) below.

---

## Path A: Running HAM

### Step 1 — Clone and configure

```bash
git clone https://github.com/dubprocess/HAM.git
cd HAM
cp backend/.env.example backend/.env
```

### Step 2 — Choose your login method

**Option A: Local auth (simplest — no external IdP required)**

Edit `backend/.env`:

```env
SECRET_KEY=your-secret-key   # generate with: openssl rand -hex 32
LOCAL_AUTH=true
LOCAL_AUTH_ADMIN_EMAIL=admin@example.com
LOCAL_AUTH_ADMIN_PASSWORD=changeme   # change this!
LOCAL_AUTH_ADMIN_NAME=HAM Admin
```

Create `frontend/.env.local`:

```env
REACT_APP_API_URL=http://localhost:8000
REACT_APP_LOCAL_AUTH=true
```

HAM will create the admin user automatically on first startup. You can add more users via the API at `/api/auth/local/users`.

**Option B: Okta OIDC**

Edit `backend/.env`:

```env
SECRET_KEY=your-secret-key
OIDC_ISSUER=https://your-domain.okta.com/oauth2/default
OIDC_CLIENT_ID=your_client_id
OIDC_CLIENT_SECRET=your_client_secret
OIDC_REDIRECT_URI=http://localhost:3000/callback
```

See [docs/okta.md](docs/okta.md) for full Okta setup.

**Optional but recommended (either mode):**

```env
IDP_API_TOKEN=your_okta_api_token   # enriches device assignments with dept + location
LOCATIONS=HQ,NYC,London,Remote
ASSET_TAG_PREFIX=HAM
```

See `backend/.env.example` for the full reference including Fleet, ABM, and Slack.

### Step 3 — Start

```bash
docker compose up --build
# or: make start
```

- Frontend: http://localhost:3000
- API docs: http://localhost:8000/docs

### Step 4 — Sign in and sync

**Local auth:** Open http://localhost:3000 and sign in with the email and password you set in `.env`.

**Okta:** Open http://localhost:3000 and sign in with your OIDC provider.

Once logged in:
1. Go to **Fleet Sync** → **Sync Now** to import your devices (if Fleet is configured)
2. (Optional) Go to **ABM Sync** → **Sync Now** to enrich with Apple data
3. Explore the **Dashboard** to see your fleet

### Step 4a (Optional) — Load demo data

Not connected to a live MDM yet, or just want to explore the UI first? Load ~50 realistic fake devices without any external dependencies:

```bash
make seed
```

This creates a mix of MacBooks, Windows laptops, iPhones, and iPads with realistic users, departments, locations, ABM data, AppleCare coverage, and all device statuses — so every part of the dashboard and asset list has real data to show.

When you're done evaluating and ready to connect your real MDM:

```bash
make seed-wipe   # remove demo data
make sync-fleet  # import your real devices
```

### Step 5 — Set up nightly sync (optional)

By default, Fleet sync runs nightly at 9:00 PM Pacific. Configure via:

```env
FLEET_SYNC_SCHEDULED=true
FLEET_SYNC_HOUR=21
FLEET_SYNC_MINUTE=0
FLEET_SYNC_TIMEZONE=US/Pacific
```

### Deeper dives

| Guide | What it covers |
|---|---|
| [docs/local-auth.md](docs/local-auth.md) | Local auth setup, adding users, production hardening |
| [docs/fleet.md](docs/fleet.md) | Fleet sync, auto-assignment, lock detection, troubleshooting |
| [docs/okta.md](docs/okta.md) | Okta OIDC setup, API token, admin groups |
| [docs/abm.md](docs/abm.md) | Apple Business Manager setup, key format notes |
| [docs/applecare.md](docs/applecare.md) | AppleCare data, rate limiting |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Bare metal, AWS, Google Cloud production deployment |

---

## Path B: Contributing to HAM

### Step 1 — Fork and clone

```bash
git clone https://github.com/your-username/HAM.git
cd HAM
```

### Step 2 — Set up your local environment

The fastest way to get up and running without Docker:

```bash
brew install uv   # or: pip install uv
make setup
```

`make setup` installs all Python backend dependencies from the lockfile via `uv sync --frozen`, ensuring you get the exact same package versions used in production.

To run the backend locally after setup:

```bash
cd backend
uv run uvicorn main:app --reload
```

**Database:**

```bash
docker compose up postgres -d
make migrate
make seed   # populate with demo data
```

**Frontend (React):**

```bash
cd frontend
npm install
cp .env.example .env.local
# Set REACT_APP_API_URL=http://localhost:8000
# Set REACT_APP_LOCAL_AUTH=true if using local auth
npm start
```

Or run everything with Docker:

```bash
make start
make seed
```

### Step 3 — Make your changes

```
backend/
  main.py             — all API routes (including /api/auth/* local auth endpoints)
  models.py           — SQLAlchemy models (includes LocalUser for local auth)
  auth.py             — OktaAuth + LocalAuth + unified get_current_user dependency
  seed_data.py        — demo data script
  fleet_service.py    — Fleet MDM sync (reference implementation)
  jamf_service.py     — Jamf stub (ready for implementation)
  base_mdm_service.py — abstract MDM interface

frontend/src/components/
  Login.js      — handles both local auth form and OIDC redirect
  Dashboard.js  — stats + breakdown
  AssetList.js  — asset table
  AssetDetail.js — detail + assign + audit
```

### Step 4 — Test and lint

```bash
make test
make lint
make build
```

### Step 5 — Open a PR

See [CONTRIBUTING.md](CONTRIBUTING.md) for full guidelines.

---

## Where to contribute

### 🟡 MDM providers

| Provider | Status | Where to start |
|---|---|---|
| Jamf Pro | Stub ready — field mappings written | `backend/jamf_service.py` + [docs/jamf.md](docs/jamf.md) |
| Mosyle | Not started | `backend/base_mdm_service.py` for interface |
| Iru (formerly Kandji) | Not started | `backend/base_mdm_service.py` for interface |
| Intune | Not started | `backend/base_mdm_service.py` for interface |

### 🟡 Identity providers

| Provider | Status | Where to start |
|---|---|---|
| Azure AD | OIDC login likely works — needs enrichment | [docs/identity-providers.md](docs/identity-providers.md) |
| Google Workspace | OIDC login likely works — needs enrichment | [docs/identity-providers.md](docs/identity-providers.md) |
| Auth0 | OIDC login likely works — needs enrichment | [docs/identity-providers.md](docs/identity-providers.md) |

---

## Getting help

- **Bug?** Open a [bug report](https://github.com/dubprocess/HAM/issues/new?template=bug_report.md)
- **Feature idea?** Open a [feature request](https://github.com/dubprocess/HAM/issues/new?template=feature_request.md)
- **Questions?** Open a [GitHub Discussion](https://github.com/dubprocess/HAM/discussions)
