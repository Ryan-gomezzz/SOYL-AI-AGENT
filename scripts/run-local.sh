#!/bin/bash
# Local development script
# Runs Docker Compose with Postgres, Redis, and backend service

set -e

echo "Starting local development environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "Error: docker-compose is not installed. Please install docker-compose and try again."
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
    else
        cat > .env <<EOF
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ai_ca_agent_db
DB_USER=postgres
DB_PASSWORD=postgres

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Application
NODE_ENV=development
PORT=3000
EOF
    fi
fi

# Start services with docker-compose
echo "Starting Docker Compose services..."
docker-compose up -d

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 5

# Check if services are running
if docker-compose ps | grep -q "Up"; then
    echo "Services are running!"
    echo ""
    echo "Backend service: http://localhost:3000"
    echo "PostgreSQL: localhost:5432"
    echo "Redis: localhost:6379"
    echo ""
    echo "To view logs: docker-compose logs -f"
    echo "To stop services: docker-compose down"
else
    echo "Error: Some services failed to start. Check logs with: docker-compose logs"
    exit 1
fi

# Run unit tests if requested
if [ "$1" == "--test" ]; then
    echo "Running unit tests..."
    cd services/backend
    npm test
    cd ../..
fi

