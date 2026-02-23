#!/bin/bash

echo "🚀 IT Inventory - Quick Start Script"
echo "========================================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from example..."
    cp backend/.env.example .env
    echo "✅ Created .env file. Please edit it with your configuration:"
    echo "   - Okta OIDC credentials"
    echo "   - Fleet MDM URL and API token"
    echo "   - Database settings (optional, defaults work for local dev)"
    echo ""
    echo "After editing .env, run this script again."
    exit 1
fi

echo "📋 Checking prerequisites..."

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi
echo "✅ Docker found"

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi
echo "✅ Docker Compose found"

echo ""
echo "🏗️  Building and starting services..."
echo ""

# Build and start services
docker-compose up -d --build

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check if services are running
if docker-compose ps | grep -q "Up"; then
    echo ""
    echo "✅ Application is running!"
    echo ""
    echo "📍 Access Points:"
    echo "   Frontend:  http://localhost:3000"
    echo "   Backend:   http://localhost:8000"
    echo "   API Docs:  http://localhost:8000/docs"
    echo ""
    echo "🔐 Next Steps:"
    echo "   1. Navigate to http://localhost:3000"
    echo "   2. Sign in with your Okta credentials"
    echo "   3. Go to 'Fleet Sync' and click 'Sync Now' to import devices"
    echo ""
    echo "📊 View logs:"
    echo "   docker-compose logs -f"
    echo ""
    echo "🛑 Stop application:"
    echo "   docker-compose down"
    echo ""
else
    echo "❌ Failed to start services. Check logs with:"
    echo "   docker-compose logs"
    exit 1
fi
