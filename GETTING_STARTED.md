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
| Fleet MDM instance | Required for device sync |
| Okta account | Required for login today — see note below |
| Apple Business Manager | Optional — adds procurement + AppleCare data |
| Slack webhook | Optional — enables alert notifications |

> **On the Okta requirement:** HAM currently requires an OIDC provider to log in. Okta is the only fully implemented provider today. If you're running Azure AD, Google Workspace, or Auth0, OIDC login may work out of the box — see [docs/identity-providers.md](docs/identity-providers.md). Local auth mode (no external IdP) is planned in [issue #1](https://github.com/dubprocess/HAM/issues/1).

---

## Path A: Running HAM

### Step 1 — Clone and configure

```bash
git clone https://github.com/dubprocess/HAM.git
cd HAM
```

Run the quick start script — it will check prerequisites and create your `.env` if it doesn't exist:

```bash
chmod +x start.sh
./start.sh
```

If it's your first run, it will create `backend/.env` from the example and ask you to fill it in before continuing.

### Step 2 — Fill in your credentials

Open `backend/.env` and set at minimum:

```env
# Generate with: openssl rand -hex 32
SECRET_KEY=your-secret-key

# Okta OIDC (or other OIDC provider — see docs/okta.md)
OIDC_ISSUER=https://your-domain.okta.com/oauth2/default
OIDC_CLIENT_ID=your_client_id
OIDC_CLIENT_SECRET=your_client_secret
OIDC_REDIRECT_URI=http://localhost:3000/callback

# Fleet MDM
FLEET_URL=https://your-fleet-instance.com
FLEET_API_TOKEN=your_fleet_api_token
```

**Optional but recommended:**

```env
# Okta API token — enriches device assignments with user department + location
IDP_API_TOKEN=your_okta_api_token

# Your office locations (comma-separated) — used for inventory breakdown
LOCATIONS=HQ,NYC,London,Remote

# Your asset tag prefix (default: HAM)
ASSET_TAG_PREFIX=HAM
```

See `backend/.env.example` for the full reference including ABM and Slack.

### Step 3 — Start

```bash
./start.sh
# or: make start
```

- Frontend: http://localhost:3000
- API docs: http://localhost:8000/docs

### Step 4 — Sign in and sync

1. Open http://localhost:3000 and sign in with your OIDC provider
2. Go to **Fleet Sync** → **Sync Now** to import your devices
3. (Optional) Go to **ABM Sync** → **Sync Now** to enrich with Apple data
4. Explore the **Dashboard** to see your fleet

### Step 5 — Set up nightly sync (optional)

By default, Fleet sync runs nightly at 9:00 PM Pacific. Configure via:

```env
FLEET_SYNC_SCHEDULED=true
FLEET_SYNC_HOUR=21
FLEET_SYNC_MINUTE=0
FLEET_SYNC_TIMEZONE=US/Pacific
```

Check the current schedule anytime with:

```bash
make scheduler-status
```

### Deeper dives

Once you're up and running, these guides cover each integration in detail:

| Guide | What it covers |
|---|---|
| [docs/fleet.md](docs/fleet.md) | Fleet sync, auto-assignment, lock detection, troubleshooting |
| [docs/okta.md](docs/okta.md) | Okta OIDC setup, API token, admin groups |
| [docs/abm.md](docs/abm.md) | Apple Business Manager setup, key format notes |
| [docs/applecare.md](docs/applecare.md) | AppleCare data, rate limiting |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Bare metal, AWS, Google Cloud production deployment |

---

## Path B: Contributing to HAM

### Step 1 — Fork and clone

```bash
# Fork on GitHub first, then:
git clone https://github.com/your-username/HAM.git
cd HAM
```

### Step 2 — Set up your local environment

**Backend (Python):**

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env — at minimum set DATABASE_URL and SECRET_KEY
```

**Database:**

```bash
# Start just Postgres
docker compose up postgres -d

# Run migrations
make migrate
```

**Run the backend:**

```bash
uvicorn main:app --reload
# API available at http://localhost:8000
# Swagger docs at http://localhost:8000/docs
```

**Frontend (React):**

```bash
cd frontend
npm install
cp .env.example .env.local
# Set REACT_APP_API_URL=http://localhost:8000
npm start
# Frontend available at http://localhost:3000
```

Or run everything with Docker:

```bash
make start
```

### Step 3 — Make your changes

The codebase is straightforward:

```
backend/
  main.py           — all API routes
  models.py         — SQLAlchemy models
  fleet_service.py  — Fleet MDM sync (reference implementation)
  jamf_service.py   — Jamf stub (ready for implementation)
  base_mdm_service.py — abstract MDM interface

frontend/src/components/
  Dashboard.js      — stats + breakdown
  AssetList.js      — asset table
  AssetDetail.js    — detail + assign + audit
  FleetSync.js      — sync UI
  Settings.js       — alert settings
```

### Step 4 — Test and lint

```bash
make test    # pytest
make lint    # flake8
make build   # verify docker build still works
```

### Step 5 — Open a PR

- Keep PRs focused — one feature or fix per PR
- Update docs if you're changing behavior
- Add your provider to the integration table in `README.md` if adding MDM/IdP support

See [CONTRIBUTING.md](CONTRIBUTING.md) for full guidelines.

---

## Where to contribute

The highest-impact areas right now:

### 🔴 Biggest barriers to adoption

| Issue | What's needed |
|---|---|
| [#1 — Local auth mode](https://github.com/dubprocess/HAM/issues/1) | Login without an external IdP |
| [#2 — Demo / seed data](https://github.com/dubprocess/HAM/issues/2) | Fake assets for evaluation without a live MDM |

### 🟡 MDM providers

| Provider | Status | Where to start |
|---|---|---|
| Jamf Pro | Stub ready — field mappings written | `backend/jamf_service.py` + [docs/jamf.md](docs/jamf.md) |
| Mosyle | Not started | `backend/base_mdm_service.py` for interface |
| Kandji | Not started | `backend/base_mdm_service.py` for interface |
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
- **Adding a provider?** Use the [MDM provider](https://github.com/dubprocess/HAM/issues/new?template=new_mdm_provider.md) or [IdP provider](https://github.com/dubprocess/HAM/issues/new?template=new_idp_provider.md) templates
- **Questions?** Open a [GitHub Discussion](https://github.com/dubprocess/HAM/discussions)
