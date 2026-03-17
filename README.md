# HAM — Hardware Asset Manager

> Open source IT hardware asset tracking with Fleet MDM, Okta, and Apple Business Manager integration.

HAM is a full-stack hardware asset management tool built for IT teams. It tracks devices across their entire lifecycle — from procurement through retirement — and syncs automatically with your MDM, identity provider, and Apple Business Manager.

## Features

- **Asset tracking** — laptops, desktops, mobile devices with full lifecycle management
- **Fleet MDM sync** — auto-import devices, sync assignments, lock/unlock status
- **Okta SCIM** — user identity enrichment and auto-assignment
- **Apple Business Manager** — device procurement data, AppleCare warranty status
- **Dashboard** — platform breakdown, location inventory, warranty expiry alerts
- **Slack alerts** — warranty expiry, sync failures, unassigned/locked device notifications
- **CSV export** — full asset export with ABM and Fleet metadata
- **Location inventory** — per-office availability tracking

## Tech Stack

- **Backend**: Python FastAPI + PostgreSQL + SQLAlchemy
- **Frontend**: React
- **Integrations**: Fleet MDM, Okta SCIM, Apple Business Manager, AppleCare API
- **Deployment**: Docker Compose

---

## Quick Start (Docker Compose)

### 1. Clone the repo

```bash
git clone https://github.com/dubprocess/HAM.git
cd HAM
```

### 2. Configure environment variables

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your credentials. At minimum you need:

```env
# Required
DATABASE_URL=postgresql://assetuser:changeme123@postgres:5432/asset_tracker
SECRET_KEY=your-random-secret-key

# Okta OIDC (required for login)
OKTA_ISSUER=https://your-domain.okta.com/oauth2/default
OKTA_CLIENT_ID=your_client_id
OKTA_CLIENT_SECRET=your_client_secret
OKTA_REDIRECT_URI=http://localhost:3000/callback
```

See [Integration Setup](#integration-setup) for Fleet, ABM, and Slack configuration.

### 3. Start

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs

---

## Configuration

All configuration is via environment variables in `backend/.env`.

### Locations

Configure your office locations as a comma-separated list:

```env
LOCATIONS=HQ,Branch,Remote
```

Defaults to `HQ,Remote` if not set.

### Asset Tag Prefix

```env
ASSET_TAG_PREFIX=HAM
```

Asset tags will be generated as `HAM-<serial_number>`.

### MDM / Identity Provider

HAM currently supports Fleet MDM and Okta. Future versions will support pluggable MDM and OIDC providers.

```env
MDM_PROVIDER=fleet
IDP_PROVIDER=okta
```

---

## Integration Setup

| Integration | Guide |
|---|---|
| Fleet MDM | [docs/fleet.md](docs/fleet.md) |
| Okta SCIM | [docs/okta.md](docs/okta.md) |
| Apple Business Manager | [docs/abm.md](docs/abm.md) |
| AppleCare | [docs/applecare.md](docs/applecare.md) |

---

## Kubernetes

HAM is designed to run on Docker Compose for self-hosted deployments. Kubernetes manifests are on the roadmap — community contributions welcome.

---

## Contributing

PRs are welcome! Areas where contributions are especially useful:

- Additional MDM provider support (Jamf, Mosyle, Kandji, etc.)
- Additional OIDC provider support (Azure AD, Google Workspace, etc.)
- Kubernetes Helm chart
- Additional alert channels (email, PagerDuty, etc.)

---

## License

MIT
