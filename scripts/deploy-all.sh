#!/bin/bash
# Deploy Both Backend and Worker Services to ECS
# Usage: ./scripts/deploy-all.sh [version]

set -e

VERSION=${1:-"latest"}
REGION="us-east-1"
ACCOUNT_ID="381492072674"
PROJECT_PREFIX="ai-ca-agent-staging"

echo "=== Deploying All Services to ECS ==="
echo ""
echo "ECR Region: $REGION"
echo "Account ID: $ACCOUNT_ID"
echo "Version: $VERSION"
echo ""

# ECR Base URL
ECR_BASE="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

# Authenticate to ECR
echo "Step 1: Authenticating to ECR..."
aws ecr get-login-password --region $REGION | \
    docker login --username AWS --password-stdin $ECR_BASE

# Deploy Backend
echo ""
echo "=== Deploying Backend Service ==="
BACKEND_REPO="${ECR_BASE}/${PROJECT_PREFIX}/backend"
BACKEND_IMAGE="${PROJECT_PREFIX}-backend"

docker build -t "${BACKEND_IMAGE}:${VERSION}" -f services/backend/Dockerfile services/backend
docker tag "${BACKEND_IMAGE}:${VERSION}" "${BACKEND_REPO}:${VERSION}"
if [ "$VERSION" != "latest" ]; then
    docker tag "${BACKEND_IMAGE}:${VERSION}" "${BACKEND_REPO}:latest"
fi
docker push "${BACKEND_REPO}:${VERSION}"
if [ "$VERSION" != "latest" ]; then
    docker push "${BACKEND_REPO}:latest"
fi

# Force ECS update for backend
aws ecs update-service \
    --cluster "${PROJECT_PREFIX}-cluster" \
    --service "${PROJECT_PREFIX}-backend-service" \
    --force-new-deployment \
    --region $REGION

echo "✓ Backend deployed"

# Deploy Worker
echo ""
echo "=== Deploying Worker Service ==="
WORKER_REPO="${ECR_BASE}/${PROJECT_PREFIX}/worker"
WORKER_IMAGE="${PROJECT_PREFIX}-worker"

docker build -t "${WORKER_IMAGE}:${VERSION}" -f services/worker/Dockerfile services/worker
docker tag "${WORKER_IMAGE}:${VERSION}" "${WORKER_REPO}:${VERSION}"
if [ "$VERSION" != "latest" ]; then
    docker tag "${WORKER_IMAGE}:${VERSION}" "${WORKER_REPO}:latest"
fi
docker push "${WORKER_REPO}:${VERSION}"
if [ "$VERSION" != "latest" ]; then
    docker push "${WORKER_REPO}:latest"
fi

echo "✓ Worker deployed to ECR"
echo "Note: Worker service ECS task definition and service need to be created separately."

echo ""
echo "=== All Services Deployed ==="

