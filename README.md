# HAM — Hardware Asset Manager

> Open source IT hardware asset tracking with Fleet MDM, Okta, and Apple Business Manager integration.

HAM is a full-stack hardware asset management tool built for IT teams. It tracks devices across their entire lifecycle — from procurement through retirement — and syncs automatically with your MDM, identity provider, and Apple Business Manager.

👉 **[GETTING_STARTED.md](GETTING_STARTED.md)** — step-by-step guide for IT admins and contributors

## Features

- **Asset tracking** — laptops, desktops, mobile devices with full lifecycle management
- **Fleet MDM sync** — auto-import devices, sync assignments, lock/unlock status
- **Okta OIDC** — user identity enrichment and auto-assignment
- **Apple Business Manager** — device procurement data, AppleCare warranty status
- **Dashboard** — platform breakdown, location inventory, warranty expiry alerts
- **Slack alerts** — warranty expiry, sync failures, unassigned/locked device notifications
- **CSV export** — full asset export with ABM and Fleet metadata
- **Location inventory** — per-office availability tracking

## Tech Stack

- **Backend**: Python FastAPI + PostgreSQL + SQLAlchemy
- **Frontend**: React
- **Integrations**: Fleet MDM, Okta OIDC, Apple Business Manager, AppleCare API
- **Deployment**: Docker Compose

---

## Prerequisites

### What you need to hit the ground running

**Required today:**
- **Fleet MDM** — device sync, auto-assignment, and lock detection all require a Fleet instance
- **Okta** — HAM currently requires an OIDC provider to log in. Okta is the only fully implemented provider today

**Optional but recommended:**
- **Apple Business Manager** — adds procurement data and AppleCare warranty status to your devices
- **Slack** — enables alert notifications

> **No Okta?** Local auth mode (username/password login with no external IdP) is on the roadmap. Azure AD, Google Workspace, and Auth0 are also planned. See [docs/identity-providers.md](docs/identity-providers.md) if you want to contribute support.
>
> **No Fleet?** Jamf Pro support is stubbed and ready for contributors — see [docs/jamf.md](docs/jamf.md).

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

# OIDC login (required — Okta fully supported today)
OIDC_ISSUER=https://your-domain.okta.com/oauth2/default
OIDC_CLIENT_ID=your_client_id
OIDC_CLIENT_SECRET=your_client_secret
OIDC_REDIRECT_URI=http://localhost:3000/callback

# Fleet MDM (required for device sync)
FLEET_URL=https://your-fleet-instance.com
FLEET_API_TOKEN=your_fleet_api_token
```

See [Integration Setup](#integration-setup) for ABM and Slack configuration.

### 3. Start

```bash
docker compose up --build
```

Or use the Makefile:

```bash
make start
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs

For a full step-by-step walkthrough see **[GETTING_STARTED.md](GETTING_STARTED.md)**.

---

## Configuration

All configuration is via environment variables in `backend/.env`.

### Locations

Configure your office locations as a comma-separated list:

```env
LOCATIONS=HQ,Branch,Remote
```

Defaults to `HQ,Remote` if not set. The frontend location filter is built dynamically from this list.

### Asset Tag Prefix

```env
ASSET_TAG_PREFIX=HAM
```

Asset tags will be generated as `HAM-<serial_number>`. Change to match your org's convention.

### MDM + Identity Provider

HAM is designed to support pluggable MDM and OIDC providers:

```env
MDM_PROVIDER=fleet   # fleet | jamf (jamf: stub ready, PRs welcome)
IDP_PROVIDER=okta    # okta | azure | google | auth0 (okta fully implemented)
```

---

## Integration Setup

| Integration | Status | Guide |
|---|---|---|
| Fleet MDM | ✅ Fully implemented | [docs/fleet.md](docs/fleet.md) |
| Jamf Pro | 🚧 Stub ready, PRs welcome | [docs/jamf.md](docs/jamf.md) |
| Okta OIDC | ✅ Fully implemented | [docs/okta.md](docs/okta.md) |
| Azure AD / Entra ID | 🚧 PRs welcome | [docs/identity-providers.md](docs/identity-providers.md) |
| Google Workspace | 🚧 PRs welcome | [docs/identity-providers.md](docs/identity-providers.md) |
| Auth0 | 🚧 PRs welcome | [docs/identity-providers.md](docs/identity-providers.md) |
| Local auth (no IdP) | 🚧 Planned | [#1](https://github.com/dubprocess/HAM/issues/1) |
| Apple Business Manager | ✅ Fully implemented | [docs/abm.md](docs/abm.md) |
| AppleCare | ✅ Fully implemented | [docs/applecare.md](docs/applecare.md) |

---

## Contributing

PRS are welcome! Here's where contributions would have the most impact:

**Biggest barriers to adoption (high priority)**
- Local auth mode — allow login without an external IdP for evaluation and smaller deployments. See [issue #1](https://github.com/dubprocess/HAM/issues/1).
- Demo / seed data script — populate fake assets so people can evaluate the UI without a live MDM. See [issue #2](https://github.com/dubprocess/HAM/issues/2).

**MDM providers**
- Jamf Pro — stub is in `backend/jamf_service.py`, field mappings are written, sync logic needs implementing. See [docs/jamf.md](docs/jamf.md).
- Mosyle, Kandji, Intune — new `*_service.py` following the same interface as `fleet_service.py`

**Identity providers**
- Azure AD, Google Workspace, Auth0 — OIDC login likely works already, needs user enrichment adapter. See [docs/identity-providers.md](docs/identity-providers.md).

**Infrastructure**
- Kubernetes Helm chart
- Email / PagerDuty / Teams alert channels

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines or [GETTING_STARTED.md](GETTING_STARTED.md) for a full contributor walkthrough.

---

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for Docker Compose, bare metal, AWS, and Google Cloud deployment guides.

---

## Kubernetes

HAM runs on Docker Compose for self-hosted deployments. Kubernetes manifests are on the roadmap — community contributions welcome.

---

## License

MIT
