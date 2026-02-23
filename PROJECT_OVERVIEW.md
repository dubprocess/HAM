# HAM — Project Overview

## What You Have

A complete, production-ready IT Asset Management system with:

✅ **Fleet MDM Integration** — Automatic device sync with nightly scheduled runs and intelligent auto-assignment
✅ **Apple Business Manager Integration** — ABM device sync with AppleCare warranty tracking
✅ **Okta OIDC Authentication** — Secure single sign-on
✅ **Okta Location Enrichment** — Automatic office location mapping from user profiles
✅ **Device Lock Detection** — Automatic lock/unlock status management from Fleet MDM
✅ **CSV Export** — Export filtered asset data for reporting and compliance
✅ **Modern Web Interface** — React-based responsive UI with platform analytics
✅ **RESTful API** — FastAPI backend with full documentation
✅ **Docker Ready** — Complete containerization
✅ **Production Deployment Guides** — AWS, GCP, Azure, and manual server

## Quick Start (5 minutes)

1. **Navigate to the project folder:**
   ```bash
   cd HAM
   ```

2. **Configure your credentials:**
   ```bash
   cp backend/.env.example .env
   # Edit .env with your Okta, Fleet, and (optionally) ABM credentials
   ```

3. **Start the application:**
   ```bash
   chmod +x start.sh
   ./start.sh
   ```

4. **Access the app:**
   - Open http://localhost:3000
   - Sign in with Okta
   - Go to "Fleet Sync" → Click "Sync Now"
   - (Optional) Go to "ABM Sync" → Click "Sync Now"

## File Structure

```
HAM/
├── backend/
│   ├── main.py              # Main API app + APScheduler for nightly sync
│   ├── models.py            # Database models (Asset, Employee, AuditLog, etc.)
│   ├── fleet_service.py     # Fleet MDM sync + auto-assignment + lock detection
│   ├── okta_service.py      # Okta API for user location lookups
│   ├── abm_service.py       # Apple Business Manager + AppleCare integration
│   ├── auth.py              # Okta OIDC authentication
│   ├── init_db.py           # Database initialization
│   ├── migrations/          # Database migration scripts
│   ├── requirements.txt     # Python dependencies
│   ├── Dockerfile
│   └── .env.example         # Environment variable template
│
├── frontend/
│   ├── public/              # Static assets (HTML, SVG logos)
│   ├── src/
│   │   ├── App.js           # Main app + routing
│   │   ├── App.css          # Global styles
│   │   └── components/
│   │       ├── Dashboard.js   # Stats, platform breakdown, location breakdown
│   │       ├── AssetList.js   # Asset table with search/filter/export
│   │       ├── AssetDetail.js # Detail view + assign + maintenance + audit log
│   │       ├── AssetCreate.js # Manual asset creation
│   │       ├── FleetSync.js   # Fleet sync UI + scheduler status
│   │       ├── ABMSync.js     # ABM sync UI + logs
│   │       ├── Layout.js      # App layout + sidebar navigation
│   │       └── Login.js       # Okta login page
│   └── utils/
│       └── api.js             # Axios client with auth interceptor
│
├── docker-compose.yml
├── start.sh
├── README.md
├── PROJECT_OVERVIEW.md     # This file
├── DEPLOYMENT.md           # Production deployment guides
└── CONTRIBUTING.md         # Contribution guidelines
```

## Key Features Explained

### Fleet MDM Sync

**Nightly Scheduled Sync** — Runs automatically at 9:00 PM Pacific (configurable via `FLEET_SYNC_HOUR`, `FLEET_SYNC_MINUTE`, `FLEET_SYNC_TIMEZONE` env vars). Can also be triggered manually.

**Auto-Assignment Priority Chain:**
1. **Okta SCIM** (highest priority) — IdP-linked user from Fleet's `end_users` array
2. **Chrome Profile** — Corporate email from Chrome browser profiles, filtered by `ALLOWED_EMAIL_DOMAINS`
3. **Fleet Primary User** (fallback) — Fleet's built-in primary user field

**Override Behavior:**
- Manual IT assignments are preserved by default
- Overrides are only cleared when Fleet detects a **different user** on the device
- Returning a device clears the override flag

**Device Lock Detection:**
- Checks multiple Fleet MDM fields for lock indicators
- Locked devices are automatically set to LOCKED status and unassigned
- When unlocked with a new user detected, automatically reassigned

### Apple Business Manager Integration

- Syncs all organizational devices from ABM with pagination
- Matches existing assets by serial number for enrichment
- Auto-populates purchase date, order number, and supplier
- Tracks product family, capacity, and color
- **AppleCare coverage** — Fetches warranty data concurrently for all devices
- Prioritizes coverage: AppleCare+ → AppleCare → Limited Warranty
- Auto-populates warranty expiration date from latest coverage end date

### Location Enrichment

When `OKTA_API_TOKEN` is configured:
- Looks up each assigned user's city from their Okta profile
- Maps city to an office code via `LOCATION_MAPPING` env var (JSON)
- Example: `{"new york": "NYC", "san francisco": "SFO", "remote": "Remote"}`
- Backfills missing locations for existing assignments
- Preserves last known location when devices are returned (for IT closet tracking)
- Results cached per sync run for efficiency

### Asset Management
- Track Macs, iPhones, iPads, Apple TVs, and other hardware
- Four statuses: **Available**, **Assigned**, **Locked**, **Retired**
- Complete device specifications from Fleet
- Purchase and warranty tracking from ABM
- Maintenance history logging
- File attachments for receipts and warranties
- Full audit trail with source attribution

### Dashboard
- Total asset count with clickable stat cards
- Status breakdown: Assigned, Available, Locked
- Warranty expiring soon (30-day window)
- Fleet enrolled count
- ABM enrolled count
- **Platform breakdown** with Apple/Windows/iOS/iPadOS/tvOS icons
- **Location breakdown** across all office codes

### CSV Export
- Export all assets or filtered subsets
- Includes Fleet, ABM, and AppleCare data
- Platform auto-resolved from OS type, product family, and device type

## Configuration Required

### 1. Okta Setup
- Create OIDC application in Okta (Single-Page Application)
- Configure redirect URIs: `http://localhost:3000/login/callback`
- Note Client ID and Issuer URL
- (Optional) Generate an Okta API token for location enrichment

### 2. Fleet MDM Setup
- Generate API token with read access to hosts and users
- Note Fleet URL and token

### 3. Apple Business Manager Setup (Optional)
- Create API credentials in ABM
- Download the ES256 private key (.pem)
- Note the Client ID and Key ID

### 4. Environment Variables (.env)
```env
# Required
OKTA_ISSUER=https://your-domain.okta.com/oauth2/default
OKTA_CLIENT_ID=your_client_id
OKTA_CLIENT_SECRET=your_client_secret
FLEET_URL=https://your-fleet-instance.com
FLEET_API_TOKEN=your_fleet_api_token
ALLOWED_EMAIL_DOMAINS=your-company.com

# Recommended
OKTA_API_TOKEN=your_okta_api_token
LOCATION_MAPPING={"new york": "NYC", "san francisco": "SFO", "remote": "Remote"}

# Optional (ABM)
ABM_CLIENT_ID=BUSINESSAPI.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ABM_KEY_ID=your_key_id
ABM_PRIVATE_KEY_PATH=/app/keys/abm_private_key.pem

# Optional (defaults provided)
DATABASE_URL=postgresql://assetuser:changeme123@postgres:5432/asset_tracker
ALLOWED_ORIGINS=http://localhost:3000
SECRET_KEY=change-this-in-production
FLEET_SYNC_SCHEDULED=true
FLEET_SYNC_HOUR=21
FLEET_SYNC_MINUTE=0
FLEET_SYNC_TIMEZONE=US/Pacific
```

## API Documentation

Once running, visit:
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

Key endpoints:
- `GET /api/assets` — List/search/filter assets
- `GET /api/assets/export/csv` — Export to CSV
- `POST /api/assets/{id}/assign` — Assign to employee
- `POST /api/assets/{id}/return` — Return asset
- `POST /api/fleet/sync` — Trigger Fleet sync
- `POST /api/abm/sync` — Trigger ABM sync
- `GET /api/dashboard/stats` — Dashboard statistics
- `GET /api/scheduler/status` — Check nightly sync schedule

## Database Schema

### Assets Table
- Device info (serial, model, hostname, specs)
- Assignment details (email, username, department, location, override flag)
- Status: Available, Assigned, Locked, Retired
- Fleet integration (device ID, last seen, enrolled)
- ABM integration (device ID, order info, product family, capacity, color)
- AppleCare (status, description, start/end dates, agreement number, renewable, payment type)
- Purchase and warranty tracking
- Audit timestamps

### Supporting Tables
- **Employees** — Okta-synced user records
- **Maintenance Records** — Service history per asset
- **Audit Logs** — Complete change history with user and source attribution
- **Attachments** — File uploads per asset
- **Fleet Sync Logs** — Sync run history and statistics
- **ABM Sync Logs** — ABM sync run history and statistics

## Common Workflows

### Syncing from Fleet
1. Go to Fleet Sync
2. Click "Sync Now" (or wait for the nightly run)
3. Review sync results and logs
4. Devices appear with auto-assignments

### Syncing from ABM
1. Go to ABM Sync
2. Click "Sync Now"
3. Existing devices are enriched with purchase info and AppleCare data
4. New ABM-only devices are created

### Assigning a Device
1. Open asset detail page
2. Click "Assign Asset"
3. Enter employee email and name
4. Optionally check "Override Fleet Auto-Sync"
5. Save

### Tracking Maintenance
1. Open asset detail
2. Click "Add Record" in Maintenance section
3. Select type (repair, upgrade, etc.)
4. Enter details and cost
5. Save

## Deployment Options

### Local Development
```bash
./start.sh
```

### Production (Docker)
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Cloud Platforms
See `DEPLOYMENT.md` for AWS, GCP, and Azure guides.

## Troubleshooting

**Fleet Sync Fails:** Verify API token, check URL accessibility, review sync logs in UI.

**Assets Not Auto-Assigning:** Ensure `ALLOWED_EMAIL_DOMAINS` includes your domain, verify SCIM integration, check `assignment_override` flag.

**Location Not Populating:** Ensure `OKTA_API_TOKEN` is set and `LOCATION_MAPPING` JSON is valid.

**ABM Sync Fails:** Verify ABM credentials and private key path, check key expiry.

```bash
docker-compose logs -f backend   # Backend logs
docker-compose logs -f frontend  # Frontend logs
```

## Future Enhancements

- [ ] Email notifications (warranty expiring, assignments)
- [ ] Custom fields per device type
- [ ] QR code generation for assets
- [ ] Check-in/check-out workflow
- [ ] Depreciation tracking
- [ ] Advanced reporting and analytics
- [ ] Mobile app

---

**Built for IT teams managing hardware at scale 🚀**
