# HAM — Project Overview

## What is HAM?

HAM (Hardware Asset Manager) is an open source IT asset management system built for IT teams managing device fleets at scale. It tracks hardware across its entire lifecycle — from procurement through retirement — and syncs automatically with your MDM, identity provider, and Apple Business Manager.

## Current capabilities

✅ **Fleet MDM Integration** — Nightly scheduled sync, intelligent auto-assignment, lock/unlock detection
✅ **Apple Business Manager** — Device procurement data, AppleCare warranty tracking
✅ **Okta OIDC Authentication** — Secure single sign-on with group-based admin access
✅ **Okta User Enrichment** — Department and location populated from Okta profiles during sync
✅ **Device Lock Detection** — Automatic LOCKED status management from MDM data
✅ **Slack Alerts** — Warranty expiry, sync failures, unassigned/locked device notifications
✅ **Location Inventory** — Per-office availability breakdown, configurable via env var
✅ **CSV Export** — Full asset export with Fleet, ABM, and AppleCare metadata
✅ **Modern React UI** — Dashboard, asset list, detail view, sync pages, settings
✅ **RESTful API** — FastAPI backend with Swagger docs at `/docs`
✅ **Docker Compose** — Single command to run the full stack

## Provider support

| Type | Provider | Status |
|---|---|---|
| MDM | Fleet | ✅ Fully implemented |
| MDM | Jamf Pro | 🚧 Stub ready — PRs welcome |
| MDM | Mosyle / Iru / Intune | 🚧 PRs welcome |
| Identity | Okta | ✅ Fully implemented |
| Identity | Azure AD / Entra ID | 🚧 PRs welcome |
| Identity | Google Workspace | 🚧 PRs welcome |
| Identity | Auth0 | 🚧 PRs welcome |

See [docs/jamf.md](docs/jamf.md) and [docs/identity-providers.md](docs/identity-providers.md) for contributor guides.

---

## File structure

```
HAM/
├── backend/
│   ├── main.py                  # FastAPI app, routes, APScheduler nightly sync
│   ├── models.py                # SQLAlchemy models (Asset, AuditLog, SyncLog, etc.)
│   ├── base_mdm_service.py      # Abstract MDM interface — extend to add new providers
│   ├── fleet_service.py         # Fleet MDM sync (fully implemented)
│   ├── jamf_service.py          # Jamf Pro sync (stub — PRs welcome)
│   ├── okta_service.py          # Okta API user profile enrichment
│   ├── abm_service.py           # Apple Business Manager + AppleCare integration
│   ├── slack_service.py         # Slack webhook alerts
│   ├── alert_service.py         # Alert logic (warranty, unassigned, locked)
│   ├── auth.py                  # Okta OIDC JWT verification
│   ├── init_db.py               # Database initialization helper
│   ├── migrations/              # Alembic migration scripts
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example             # All supported env vars with comments
│
├── frontend/
│   ├── src/
│   │   ├── App.js               # Root app + React Router routes
│   │   ├── App.css              # Global styles + CSS variables
│   │   └── components/
│   │       ├── Dashboard.js     # Stats cards, platform/location breakdown
│   │       ├── AssetList.js     # Asset table — search, filter, sort, paginate
│   │       ├── AssetDetail.js   # Detail view + assign + maintenance + audit log
│   │       ├── AssetCreate.js   # Manual asset creation form
│   │       ├── FleetSync.js     # Fleet sync UI + scheduler status
│   │       ├── ABMSync.js       # ABM sync UI + logs
│   │       ├── LocationInventory.js  # Per-office inventory breakdown
│   │       ├── Settings.js      # Alert thresholds + Slack test tools
│   │       ├── Layout.js        # Sidebar navigation + app shell
│   │       └── Login.js         # OIDC login page
│   │   └── utils/
│   │       └── api.js           # Axios client with auth interceptor
│   ├── .env.example
│   └── Dockerfile
│
├── docs/
│   ├── fleet.md                 # Fleet MDM setup guide
│   ├── okta.md                  # Okta OIDC + API token setup
│   ├── abm.md                   # Apple Business Manager setup
│   ├── applecare.md             # AppleCare rate limiting + troubleshooting
│   ├── jamf.md                  # Jamf Pro contributor guide + field mappings
│   └── identity-providers.md   # Azure AD, Google, Auth0 contributor guide
│
├── .github/
│   ├── workflows/ci.yml         # GitHub Actions — lint, test, docker build
│   └── ISSUE_TEMPLATE/          # Bug, feature, new MDM provider, new IdP templates
│
├── docker-compose.yml
├── Makefile                     # make start, make migrate, make sync-fleet, etc.
├── README.md
├── PROJECT_OVERVIEW.md          # This file
├── CONTRIBUTING.md
├── SECURITY.md
└── CHANGELOG.md
```

---

## Key concepts

### MDM sync — how it works

Fleet sync runs nightly (configurable) or on-demand. For each device returned from the MDM API, HAM:

1. Matches on `serial_number` — creates if new, updates if existing
2. Syncs hardware specs, OS, hostname, last seen
3. Resolves user assignment via priority chain:
   - **Okta SCIM** (highest) — IdP-linked user from Fleet's `end_users`
   - **Chrome Profile** — corporate email from browser profiles
   - **Fleet Primary User** — Fleet's built-in primary user field
4. Detects lock/unlock status and transitions asset status accordingly
5. Enriches location from Okta user profile if `IDP_API_TOKEN` is set
6. Preserves manual IT assignments unless a different user is detected

### Adding a new MDM provider

Extend `BaseMDMService` from `backend/base_mdm_service.py` and implement:
- `sync_devices(db, triggered_by)` → stats dict
- `get_all_devices()` → list of raw device records
- `map_device_to_asset(device)` → HAM asset field dict
- `is_device_locked(device)` → bool

Then route `MDM_PROVIDER=yourprovider` in `main.py`. See [docs/jamf.md](docs/jamf.md) for a full walkthrough.

### Locations

Locations are fully configurable via the `LOCATIONS` env var:

```env
LOCATIONS=HQ,NYC,London,Remote
```

The frontend location filter dropdown and the backend location inventory are both built dynamically from this list. No code changes needed.

### Asset tag prefix

```env
ASSET_TAG_PREFIX=HAM
```

Asset tags are generated as `HAM-<serial_number>`. Change to match your org's convention.

---

## Quick start

```bash
git clone https://github.com/dubprocess/HAM.git
cd HAM
cp backend/.env.example backend/.env
# edit backend/.env with your credentials
docker compose up --build
```

Or use the Makefile:

```bash
make start       # docker compose up --build
make logs        # tail all logs
make migrate     # run alembic migrations
make sync-fleet  # trigger a Fleet sync
make sync-abm    # trigger an ABM sync
```

- Frontend: http://localhost:3000
- API: http://localhost:8000
- API docs: http://localhost:8000/docs

---

## Environment variables

See `backend/.env.example` for the full reference with comments. Key variables:

| Variable | Description |
|---|---|
| `OIDC_ISSUER` | OIDC provider issuer URL |
| `OIDC_CLIENT_ID` | OIDC client ID |
| `OIDC_CLIENT_SECRET` | OIDC client secret |
| `IDP_PROVIDER` | Identity provider (`okta`, `azure`, `google`, `auth0`) |
| `IDP_API_TOKEN` | API token for user profile enrichment |
| `MDM_PROVIDER` | MDM provider (`fleet`, `jamf`) |
| `FLEET_URL` | Fleet instance URL |
| `FLEET_API_TOKEN` | Fleet API token |
| `LOCATIONS` | Comma-separated office locations |
| `ASSET_TAG_PREFIX` | Prefix for generated asset tags (default: `HAM`) |
| `SLACK_WEBHOOK_URL` | Slack webhook for alerts |
| `ABM_CLIENT_ID` | Apple Business Manager client ID |
| `ABM_KEY_ID` | ABM key ID |
| `ABM_PRIVATE_KEY_PATH` | Path to ABM `.pem` private key |

---

## API reference

Interactive docs at http://localhost:8000/docs when running.

| Endpoint | Description |
|---|---|
| `GET /api/assets` | List / search / filter assets |
| `GET /api/assets/export/csv` | Export to CSV |
| `POST /api/assets` | Create asset manually |
| `GET /api/assets/{id}` | Asset detail |
| `PUT /api/assets/{id}` | Update asset |
| `POST /api/assets/{id}/assign` | Assign to user |
| `POST /api/assets/{id}/return` | Return asset |
| `DELETE /api/assets/{id}` | Retire asset |
| `GET /api/config/locations` | Get configured locations |
| `POST /api/fleet/sync` | Trigger Fleet sync |
| `GET /api/fleet/sync-logs` | Fleet sync history |
| `POST /api/abm/sync` | Trigger ABM sync |
| `GET /api/abm/sync-logs` | ABM sync history |
| `GET /api/dashboard/stats` | Dashboard statistics |
| `GET /api/inventory/locations` | Per-office inventory |
| `GET /api/scheduler/status` | Nightly sync schedule |
| `GET /api/settings/alerts` | Alert threshold settings |
| `PUT /api/settings/alerts` | Update alert thresholds |
| `POST /api/alerts/test/{type}` | Send a test Slack alert |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to get started, and [docs/jamf.md](docs/jamf.md) / [docs/identity-providers.md](docs/identity-providers.md) for provider-specific contribution guides.

The highest-impact areas right now:
- **Jamf Pro** — stub is ready in `backend/jamf_service.py`, field mappings are written
- **Iru** — new `*_service.py` following the same interface as `fleet_service.py`
- **Azure AD / Google Workspace** — OIDC login likely works, needs user enrichment adapter
- **Kubernetes Helm chart**
- **Backend test coverage**
