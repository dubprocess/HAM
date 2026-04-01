# Contributing to HAM

Thanks for your interest in contributing! HAM is an open source project and contributions of all kinds are welcome — bug fixes, new MDM/IdP provider support, docs improvements, and more.

---

## Ways to contribute

- **Bug fixes** — open an issue first if it's non-trivial
- **New MDM provider** — Jamf stub is ready, see [docs/jamf.md](docs/jamf.md)
- **New identity provider** — see [docs/identity-providers.md](docs/identity-providers.md)
- **Docs improvements** — always welcome
- **UI improvements** — React frontend in `frontend/src/`
- **Infrastructure** — Kubernetes Helm chart, GitHub Actions, etc.

---

## Getting started

### 1. Fork and clone

```bash
git clone https://github.com/your-username/HAM.git
cd HAM
```

### 2. Set up your dev environment

The fastest path — install dependencies from the lockfile without Docker:

```bash
brew install uv   # or: pip install uv
make setup
```

This runs `uv sync --frozen` in the `backend/` directory, installing all Python dependencies pinned to the exact versions in `uv.lock`. No venv setup needed — uv manages it automatically.

To run the backend after setup:

```bash
cd backend
uv run uvicorn main:app --reload
```

Then start just the database:

```bash
docker compose up postgres -d
make migrate
```

**Frontend (separate terminal):**

```bash
cd frontend
npm install
npm start
```

Or run everything with Docker if you prefer:

```bash
docker compose up --build
```

### 3. Load demo data for local development

You don't need a live Fleet MDM or Okta instance to work on HAM locally. Load realistic fake devices into the database:

```bash
make seed          # populate ~50 demo assets
make seed-clear    # wipe and reseed
make seed-wipe     # wipe demo data only
```

This gives you a fully populated UI to work against — all device types, statuses, ABM data, AppleCare coverage, and all dashboard states. See `backend/seed_data.py` for how it works.

### 4. Make your changes

- Backend code lives in `backend/`
- Frontend code lives in `frontend/src/`
- Docs live in `docs/`

### 5. Test your changes

```bash
make test    # pytest
make lint    # flake8
make build   # verify docker build still works
```

### 6. Open a PR

- Keep PRs focused — one feature or fix per PR
- Update relevant docs if you're changing behavior
- Add your provider to the integration table in `README.md` if adding MDM/IdP support
- Use the PR template if one applies

---

## Adding a new MDM provider

This is the highest-impact contribution area. Here's the short version:

1. Create `backend/{provider}_service.py` extending `BaseMDMService` from `backend/base_mdm_service.py`
2. Implement `sync_devices(db, triggered_by)` — see `fleet_service.py` as reference
3. Add env vars to `backend/.env.example` with comments
4. Add a `docs/{provider}.md` setup guide
5. Update the integration table in `README.md`
6. Update `main.py` to route `MDM_PROVIDER={provider}` to your service

See [docs/jamf.md](docs/jamf.md) for a detailed walkthrough of what's involved.

---

## Adding a new identity provider

1. Test if OIDC login already works — it often does out of the box
2. Implement a user enrichment adapter for department/location lookups
3. Add env vars and a setup guide
4. Update `docs/identity-providers.md` and `README.md`

See [docs/identity-providers.md](docs/identity-providers.md) for details.

---

## Dependency management

HAM uses [uv](https://github.com/astral-sh/uv) for Python dependency management.

- `backend/pyproject.toml` — direct dependencies, all pinned to exact versions
- `backend/uv.lock` — full transitive lockfile with cryptographic hashes

If you add or change a dependency, update `pyproject.toml` and regenerate the lockfile:

```bash
cd backend
uv lock
git add uv.lock
```

Do not edit `uv.lock` manually.

---

## Code style

- **Python**: PEP 8, type hints encouraged, no unused imports
- **JavaScript**: existing component patterns, functional components + hooks
- **Commits**: short present-tense subject line, e.g. `feat: add Jamf MDM service`

---

## Reporting bugs

Please use the [bug report issue template](.github/ISSUE_TEMPLATE/bug_report.md) and include:
- HAM version / commit hash
- MDM provider and version
- Steps to reproduce
- Expected vs actual behavior
- Relevant logs (`docker compose logs backend`)

---

## Questions?

Open a [GitHub Discussion](https://github.com/dubprocess/HAM/discussions) or file an issue with the `question` label.
