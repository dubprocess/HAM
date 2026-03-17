# Changelog

All notable changes to HAM will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.0] — 2026-03-17

First public open source release.

### Added
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
- Jamf Pro MDM stub (`backend/jamf_service.py`) with field mappings ready
- Abstract MDM base class (`backend/base_mdm_service.py`) for contributor guidance
- Integration docs for Fleet, Okta, ABM, AppleCare, Jamf, and all major OIDC providers
- GitHub issue templates and CI workflow

### Architecture
- Backend: Python 3.11 + FastAPI + SQLAlchemy + PostgreSQL
- Frontend: React 18 + React Query + React Router
- Integrations: Fleet MDM, Okta SCIM, Apple Business Manager, AppleCare API, Slack
- Configurable locations, asset tag prefix, MDM provider, and identity provider via env vars
