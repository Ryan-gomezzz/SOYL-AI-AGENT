#!/bin/bash
# bring up a local dev stack: Postgres, Redis, backend

set -e

docker-compose up -d postgres redis
cd services/backend && npm install && npm run dev

