.PHONY: start stop build logs shell-backend shell-db migrate test lint

# Start all services
start:
	docker compose up --build

# Start in detached mode
start-d:
	docker compose up --build -d

# Stop all services
stop:
	docker compose down

# Rebuild images without cache
build:
	docker compose build --no-cache

# Tail logs
logs:
	docker compose logs -f

# Backend logs only
logs-backend:
	docker compose logs -f backend

# Open a shell in the backend container
shell-backend:
	docker compose exec backend bash

# Open a psql shell
shell-db:
	docker compose exec postgres psql -U assetuser -d asset_tracker

# Run database migrations
migrate:
	docker compose exec backend alembic upgrade head

# Create a new migration
migration:
	docker compose exec backend alembic revision --autogenerate -m "$(msg)"

# Run backend tests
test:
	docker compose exec backend pytest

# Run backend linting
lint:
	docker compose exec backend python -m flake8 . --max-line-length=120 --exclude=migrations,venv

# Trigger a Fleet sync manually
sync-fleet:
	curl -X POST http://localhost:8000/api/fleet/sync

# Trigger an ABM sync manually
sync-abm:
	curl -X POST http://localhost:8000/api/abm/sync

# Check scheduler status
scheduler-status:
	curl http://localhost:8000/api/scheduler/status | python3 -m json.tool
