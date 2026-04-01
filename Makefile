.PHONY: help setup start start-d stop build logs logs-backend shell-backend shell-db migrate migration test lint sync-fleet sync-abm scheduler-status seed seed-clear seed-wipe

# Default target — show available commands
help:
	@echo ""
	@echo "HAM — Hardware Asset Manager"
	@echo "============================="
	@echo ""
	@echo "Usage: make <target>"
	@echo ""
	@echo "Setup:"
	@echo "  setup             install Python deps locally via uv (no Docker required)"
	@echo ""
	@echo "Dev:"
	@echo "  start             docker compose up --build (foreground)"
	@echo "  start-d           docker compose up --build (detached)"
	@echo "  stop              docker compose down"
	@echo "  build             rebuild images without cache"
	@echo "  logs              tail all service logs"
	@echo "  logs-backend      tail backend logs only"
	@echo ""
	@echo "Database:"
	@echo "  shell-db          open psql shell"
	@echo "  migrate           run alembic migrations (upgrade head)"
	@echo "  migration msg=... create a new alembic migration"
	@echo "  seed              populate database with ~50 demo assets"
	@echo "  seed-clear        wipe assets and reseed"
	@echo "  seed-wipe         wipe assets only, no reseed"
	@echo ""
	@echo "Backend:"
	@echo "  shell-backend     open bash shell in backend container"
	@echo "  test              run pytest"
	@echo "  lint              run flake8"
	@echo ""
	@echo "Sync:"
	@echo "  sync-fleet        trigger a Fleet MDM sync"
	@echo "  sync-abm          trigger an ABM sync"
	@echo "  scheduler-status  check nightly sync schedule"
	@echo ""

# ── Setup ─────────────────────────────────────────────────────────────────────

setup:
	@echo "Installing Python dependencies via uv..."
	@command -v uv >/dev/null 2>&1 || { echo "uv not found. Install it with: brew install uv"; exit 1; }
	cd backend && uv sync --frozen
	@echo ""
	@echo "Done. To run the backend locally:"
	@echo "  cd backend && uv run uvicorn main:app --reload"

# ── Dev ───────────────────────────────────────────────────────────────────────

start:
	docker compose up --build

start-d:
	docker compose up --build -d

stop:
	docker compose down

build:
	docker compose build --no-cache

logs:
	docker compose logs -f

logs-backend:
	docker compose logs -f backend

# ── Database ──────────────────────────────────────────────────────────────────

shell-db:
	docker compose exec postgres psql -U assetuser -d asset_tracker

migrate:
	docker compose exec backend alembic upgrade head

migration:
	docker compose exec backend alembic revision --autogenerate -m "$(msg)"

seed:
	docker compose exec backend python seed_data.py

seed-clear:
	docker compose exec backend python seed_data.py --clear

seed-wipe:
	docker compose exec backend python seed_data.py --wipe

# ── Backend ───────────────────────────────────────────────────────────────────

shell-backend:
	docker compose exec backend bash

test:
	docker compose exec backend pytest

lint:
	docker compose exec backend python -m flake8 . --max-line-length=120 --exclude=migrations,venv

# ── Sync ──────────────────────────────────────────────────────────────────────

sync-fleet:
	curl -s -X POST http://localhost:8000/api/fleet/sync | python3 -m json.tool

sync-abm:
	curl -s -X POST http://localhost:8000/api/abm/sync | python3 -m json.tool

scheduler-status:
	curl -s http://localhost:8000/api/scheduler/status | python3 -m json.tool
