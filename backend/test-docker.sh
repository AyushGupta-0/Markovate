#!/bin/bash

echo "Running tests with Docker PostgreSQL and Redis..."

# Start test dependencies
docker compose up -d postgres redis

# Wait for services to be healthy
echo "Waiting for services to be ready..."
sleep 5

# Run tests
npm test

# Cleanup
docker compose down
