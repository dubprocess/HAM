#!/bin/bash

echo "🚀 HAM — Hardware Asset Manager"
echo "================================="
echo ""

# Check if backend/.env exists
if [ ! -f backend/.env ]; then
    echo "⚠️  backend/.env not found. Creating from example..."
    cp backend/.env.example backend/.env
    echo ""
    echo "✅ Created backend/.env"
    echo ""
    echo "Before starting, edit backend/.env with your credentials:"
    echo ""
    echo "  Required:"
    echo "    OIDC_ISSUER        — your Okta (or other OIDC provider) issuer URL"
    echo "    OIDC_CLIENT_ID     — your OIDC client ID"
    echo "    OIDC_CLIENT_SECRET — your OIDC client secret"
    echo "    FLEET_URL          — your Fleet MDM instance URL"
    echo "    FLEET_API_TOKEN    — your Fleet API token"
    echo "    SECRET_KEY         — a random secret key (run: openssl rand -hex 32)"
    echo ""
    echo "  Optional:"
    echo "    ABM_CLIENT_ID / ABM_KEY_ID / ABM_PRIVATE_KEY_PATH — Apple Business Manager"
    echo "    SLACK_WEBHOOK_URL  — Slack alerts"
    echo "    LOCATIONS          — comma-separated office locations (default: HQ,Remote)"
    echo "    ASSET_TAG_PREFIX   — asset tag prefix (default: HAM)"
    echo ""
    echo "Once configured, run this script again."
    exit 1
fi

echo "📋 Checking prerequisites..."

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   https://docs.docker.com/get-docker/"
    exit 1
fi
echo "✅ Docker found"

# Check Docker Compose (v2 plugin style)
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
else
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    echo "   https://docs.docker.com/compose/install/"
    exit 1
fi
echo "✅ Docker Compose found ($COMPOSE_CMD)"

echo ""
echo "🏗️  Building and starting services..."
echo ""

$COMPOSE_CMD up -d --build

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check if backend is healthy
if $COMPOSE_CMD ps | grep -q "Up"; then
    echo ""
    echo "✅ HAM is running!"
    echo ""
    echo "📍 Access:"
    echo "   Frontend:  http://localhost:3000"
    echo "   API:       http://localhost:8000"
    echo "   API docs:  http://localhost:8000/docs"
    echo ""
    echo "🔐 Next steps:"
    echo "   1. Open http://localhost:3000"
    echo "   2. Sign in with your OIDC provider"
    echo "   3. Go to Fleet Sync → Sync Now to import devices"
    echo "   4. (Optional) Go to ABM Sync → Sync Now to enrich with Apple data"
    echo ""
    echo "🛠️  Useful commands:"
    echo "   make logs         — tail all logs"
    echo "   make sync-fleet   — trigger a Fleet sync"
    echo "   make sync-abm     — trigger an ABM sync"
    echo "   make stop         — stop all services"
    echo ""
else
    echo ""
    echo "❌ Services failed to start. Check logs with:"
    echo "   $COMPOSE_CMD logs"
    exit 1
fi
