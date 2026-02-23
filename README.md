# HAM — Hardware Asset Management

A comprehensive IT Asset Management system with Fleet MDM integration, Apple Business Manager (ABM) sync, and Okta OIDC authentication. Track laptops, phones, tablets, and other Apple hardware with automated device sync, intelligent auto-assignment, location enrichment, and AppleCare warranty tracking.

## 🌟 Features

### Core Features
- **Asset Inventory Management** — Track all IT hardware (Macs, iPhones, iPads, Apple TVs, peripherals)
- **Fleet MDM Integration** — Automatic device sync with nightly scheduled runs
- **Apple Business Manager Integration** — ABM device sync with purchase info, enrollment status, and AppleCare warranty data
- **Intelligent Auto-Assignment** — Multi-source assignment priority: Okta SCIM → Chrome profile → Fleet primary user
- **Okta OIDC Authentication** — Secure single sign-on
- **Location Enrichment** — Automatic office location mapping from Okta user profiles
- **Device Lock Detection** — Automatic detection of pin-locked devices from Fleet MDM data
- **AppleCare Warranty Tracking** — Coverage status, renewal eligibility, and expiration dates from ABM
- **CSV Export** — Export filtered asset data for reporting and compliance
- **Maintenance Tracking** — Log repairs, upgrades, and service history
- **Audit Logging** — Complete history of all changes with source attribution
- **File Attachments** — Upload receipts, warranties, and documentation

### Fleet MDM Capabilities
- Automatic device discovery and enrollment detection
- Real-time OS version and spec updates
- **Nightly scheduled sync** (default: 9:00 PM Pacific, configurable)
- Manual sync on demand via UI
- Multi-source user assignment with priority chain
- Corporate email domain filtering for Chrome profile assignments
- Device lock/unlock detection with automatic status transitions
- Override preservation — manual IT assignments are respected unless a different user logs in
- Last seen timestamp tracking
- Change detection and comprehensive audit logging

### Apple Business Manager Capabilities
- Full device catalog sync with pagination
- Serial number matching to enrich existing Fleet-synced devices
- Purchase info auto-population (order date, order number, supplier)
- Product family and capacity tracking
- **AppleCare coverage lookup** with concurrent batch fetching
- Coverage prioritization (AppleCare+ → AppleCare → Limited Warranty)
- Automatic warranty expiration date population

### User Interface
- Modern, responsive dashboard with clickable stat cards
- Platform breakdown with Apple/Windows/iOS/iPadOS/tvOS icons
- Location breakdown analytics
- Advanced search (asset tag, serial number, model, hostname, assignee)
- Filtering by status, platform, location, warranty, and Fleet enrollment
- Asset status tracking (Available, Assigned, Locked, Retired)
- Warranty expiration alerts (30-day window)
- CSV export with current filters applied

## 🏗️ Architecture

### Tech Stack

**Backend:**
- Python 3.11
- FastAPI — Modern, fast web framework
- SQLAlchemy — ORM for database operations
- PostgreSQL — Primary database
- Redis — Caching and background jobs
- APScheduler — Nightly Fleet sync scheduling
- Authlib — Okta OIDC integration
- httpx — Async HTTP client for Fleet, Okta, and ABM APIs

**Frontend:**
- React 18
- React Router — Navigation
- React Query — API state management
- Axios — HTTP client
- Lucide React — Icons
- Custom SVG platform icons

**Infrastructure:**
- Docker & Docker Compose
- Nginx (production)
- Celery (optional background tasks)

## 📋 Prerequisites

- Docker and Docker Compose
- Okta account with OIDC application configured
- Fleet MDM instance with API access
- (Optional) Apple Business Manager account with API credentials
- (Optional) Okta API token for location enrichment

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/dubprocess/HAM.git
cd HAM
```

### 2. Configure Environment Variables

```bash
cp backend/.env.example .env
```

Edit `.env` with your configuration:

```env
# Okta OIDC
OKTA_ISSUER=https://your-domain.okta.com/oauth2/default
OKTA_CLIENT_ID=your_okta_client_id
OKTA_CLIENT_SECRET=your_okta_client_secret
OKTA_REDIRECT_URI=http://localhost:3000/callback

# Okta API (for location enrichment — optional)
OKTA_API_TOKEN=your_okta_api_token

# Fleet MDM
FLEET_URL=https://your-fleet-instance.com
FLEET_API_TOKEN=your_fleet_api_token

# Corporate email domains for Chrome profile auto-assignment
ALLOWED_EMAIL_DOMAINS=your-company.com

# Location mapping — maps Okta city values to office codes (JSON)
LOCATION_MAPPING={"new york": "NYC", "san francisco": "SFO", "remote": "Remote"}

# Apple Business Manager (optional)
ABM_CLIENT_ID=BUSINESSAPI.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ABM_KEY_ID=your_key_id
ABM_PRIVATE_KEY_PATH=/app/keys/abm_private_key.pem

# Application
ALLOWED_ORIGINS=http://localhost:3000
SECRET_KEY=generate-a-secure-random-key-here
```

### 3. Start the Application

```bash
chmod +x start.sh
./start.sh
```

Or manually:

```bash
docker-compose up -d
docker-compose logs -f
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

### 4. Initial Setup

1. Navigate to http://localhost:3000
2. Sign in with Okta
3. Go to "Fleet Sync" → "Sync Now" to import devices
4. (Optional) Go to "ABM Sync" → "Sync Now" to enrich with Apple data

## 🔄 Auto-Assignment Logic

The Fleet sync process uses a priority-based assignment chain:

1. **Okta SCIM (highest priority)** — If Fleet reports an IdP-linked user via `end_users`, that user is assigned.
2. **Chrome Profile** — If no SCIM user exists, checks Chrome browser profiles for a corporate email (filtered by `ALLOWED_EMAIL_DOMAINS`). Personal Gmail accounts are ignored.
3. **Fleet Primary User (lowest priority)** — Falls back to Fleet's `primary_user` field.

### Override Behavior
- Manual IT assignments are preserved by default
- Overrides are only cleared when Fleet detects a **different user** on the device
- Returning a device clears the override

### Device Lock Detection
- Checks multiple Fleet MDM fields for lock indicators
- Locked devices are set to **LOCKED** status and unassigned
- When unlocked with a new user detected, automatically reassigned

### Location Enrichment
- When `OKTA_API_TOKEN` is configured, the sync looks up each user's city from Okta
- `LOCATION_MAPPING` maps city names to office codes (e.g., `"new york"` → `"NYC"`)
- Backfills missing locations for existing assignments
- Preserves last known location when devices are returned

## 🔧 Configuration

### Okta OIDC Setup

1. Create an Okta Application (OIDC → Single-Page Application)
2. Set redirect URIs: `http://localhost:3000/login/callback`
3. Note your Client ID and Issuer URL

### Fleet MDM Setup

1. Generate an API token with read permissions for hosts and users
2. Test: `curl -H "Authorization: Bearer TOKEN" https://your-fleet/api/v1/fleet/hosts`

### Apple Business Manager Setup (Optional)

1. Create API credentials in ABM
2. Download the ES256 private key (.pem)
3. Configure `ABM_CLIENT_ID`, `ABM_KEY_ID`, and `ABM_PRIVATE_KEY_PATH`

### Scheduled Sync

The nightly Fleet sync runs at 9:00 PM Pacific by default. Configure via env vars:

```env
FLEET_SYNC_SCHEDULED=true
FLEET_SYNC_HOUR=21
FLEET_SYNC_MINUTE=0
FLEET_SYNC_TIMEZONE=US/Pacific
```

## 📊 API Endpoints

Interactive docs at http://localhost:8000/docs when running.

| Endpoint | Description |
|---|---|
| `GET /api/assets` | List/search/filter assets |
| `GET /api/assets/export/csv` | Export to CSV |
| `POST /api/assets` | Create asset |
| `GET /api/assets/{id}` | Asset details |
| `PUT /api/assets/{id}` | Update asset |
| `POST /api/assets/{id}/assign` | Assign to employee |
| `POST /api/assets/{id}/return` | Return asset |
| `DELETE /api/assets/{id}` | Retire asset |
| `POST /api/fleet/sync` | Trigger Fleet sync |
| `GET /api/fleet/sync-logs` | Fleet sync history |
| `POST /api/abm/sync` | Trigger ABM sync |
| `GET /api/abm/sync-logs` | ABM sync history |
| `GET /api/dashboard/stats` | Dashboard statistics |
| `GET /api/scheduler/status` | Nightly sync schedule |

## 🛠️ Development

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm start
```

**Database Migrations:**
```bash
cd backend
alembic revision --autogenerate -m "description"
alembic upgrade head
```

## 🐛 Troubleshooting

**Fleet Sync Fails:** Verify API token and URL. Check sync logs in the UI.

**Assets Not Auto-Assigning:** Ensure `ALLOWED_EMAIL_DOMAINS` includes your domain. Check SCIM integration. Verify `assignment_override` is false.

**Location Not Populating:** Ensure `OKTA_API_TOKEN` is set and `LOCATION_MAPPING` JSON is valid.

**ABM Sync Fails:** Verify ABM credentials and private key path. Check key expiry.

```bash
docker-compose logs -f backend   # Backend logs
docker-compose logs -f frontend  # Frontend logs
```

## 🔄 Future Enhancements

- [ ] Email notifications (warranty expiring, assignments)
- [ ] Custom fields per device type
- [ ] QR code generation for assets
- [ ] Check-in/check-out workflow
- [ ] Depreciation tracking
- [ ] Advanced reporting and analytics
- [ ] Mobile app

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

**Built with ❤️ for IT teams managing hardware at scale**
