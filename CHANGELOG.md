# Changelog

All notable changes to HAM will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.0] - 2026-03-17

First public open source release.

### Core features
- Full asset lifecycle management (create, assign, return, retire)
- Fleet MDM sync with nightly scheduling and manual trigger
- Okta OIDC authentication and user enrichment
- Apple Business Manager sync (procurement data, AppleCare warranty)
- Slack alerts (warranty expiry, sync failures, unassigned/locked devices)
- Location inventory with per-office availability breakdown
- CSV export with full ABM and Fleet metadata
- Dashboard with platform breakdown, location stats, warranty alerts
- Asset age tracking with color-coded indicators
- Maintenance records and audit logging
- File attachments per asset
- Docker Compose deployment
- Local auth mode (username/password login, no external IdP required)
- Demo seed data script (make seed)

### Open source readiness
- All internal references removed (locations, domains, credentials)
- Locations configurable via LOCATIONS env var
- Asset tag prefix configurable via ASSET_TAG_PREFIX env var (default: HAM)
- OKTA_* env vars replaced with OIDC_* for provider-agnostic naming
- IDP_API_TOKEN replaces internal API token var
- MDM_PROVIDER and IDP_PROVIDER env vars added for future provider extensibility
- Location filter dropdown dynamically loaded from /api/config/locations

### Contributor infrastructure
- backend/base_mdm_service.py - abstract MDM interface for new provider contributions
- backend/jamf_service.py - Jamf Pro stub with field mappings written, sync logic ready for implementation
- backend/seed_data.py - demo seed data script
- docs/fleet.md - Fleet MDM setup and troubleshooting guide
- docs/okta.md - Okta OIDC + API token setup guide
- docs/abm.md - Apple Business Manager setup guide
- docs/applecare.md - AppleCare rate limiting and troubleshooting
- docs/jamf.md - Jamf Pro contributor guide with full API field mappings
- docs/identity-providers.md - Azure AD, Google Workspace, Auth0 contributor guide
- docs/local-auth.md - local auth mode setup guide
- CONTRIBUTING.md - community contribution guide
- SECURITY.md - responsible disclosure policy
- CODE_OF_CONDUCT.md - Contributor Covenant v2.1
- Makefile - dev shortcuts (make start, make migrate, make seed, make sync-fleet, etc.)
- .github/workflows/ci.yml - GitHub Actions CI (lint, test, docker build)
- .github/ISSUE_TEMPLATE/ - bug report, feature request, new MDM provider, new IdP provider templates
- .github/PULL_REQUEST_TEMPLATE.md - PR template

### Known limitations
- Jamf Pro sync not yet implemented - stub + field mappings ready for contributors
- Azure AD, Google Workspace, Auth0 identity providers not yet implemented
- Kubernetes Helm chart not yet available

### Architecture
- Backend: Python 3.11 + FastAPI + SQLAlchemy + PostgreSQL
- Frontend: React 18 + React Query + React Router
- Integrations: Fleet MDM, Okta OIDC + SCIM, Apple Business Manager, AppleCare API, Slack
- Deployment: Docker Compose
