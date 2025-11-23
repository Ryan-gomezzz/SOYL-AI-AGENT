# Deploy Backend Service to ECS
# This script builds, tags, and pushes the backend Docker image to ECR, then updates ECS service

param(
    [string]$Version = "latest",
    [string]$Region = "us-east-1",
    [string]$AccountId = "381492072674",
    [string]$ProjectPrefix = "ai-ca-agent-staging"
)

$ErrorActionPreference = "Stop"

Write-Host "=== Deploying Backend Service to ECS ===" -ForegroundColor Cyan
Write-Host ""

# ECR Repository URL
$ECR_REPO = "${AccountId}.dkr.ecr.${Region}.amazonaws.com/${ProjectPrefix}/backend"
$CLUSTER_NAME = "${ProjectPrefix}-cluster"
$SERVICE_NAME = "${ProjectPrefix}-backend-service"

Write-Host "ECR Repository: $ECR_REPO" -ForegroundColor Yellow
Write-Host "ECS Cluster: $CLUSTER_NAME" -ForegroundColor Yellow
Write-Host "ECS Service: $SERVICE_NAME" -ForegroundColor Yellow
Write-Host "Version: $Version" -ForegroundColor Yellow
Write-Host ""

# Step 1: Authenticate to ECR
Write-Host "Step 1: Authenticating to ECR..." -ForegroundColor Green
try {
    $password = aws ecr get-login-password --region $Region
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to get ECR login password"
    }
    $password | docker login --username AWS --password-stdin "${AccountId}.dkr.ecr.${Region}.amazonaws.com"
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to login to ECR"
    }
    Write-Host "✓ Authenticated to ECR" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to authenticate to ECR: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 2: Build Docker Image
Write-Host "Step 2: Building Docker image..." -ForegroundColor Green
$BUILD_CONTEXT = "services/backend"
$IMAGE_NAME = "${ProjectPrefix}-backend"
try {
    docker build -t "${IMAGE_NAME}:${Version}" -f "${BUILD_CONTEXT}/Dockerfile" $BUILD_CONTEXT
    if ($LASTEXITCODE -ne 0) {
        throw "Docker build failed"
    }
    Write-Host "✓ Docker image built successfully" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to build Docker image: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 3: Tag Image for ECR
Write-Host "Step 3: Tagging image for ECR..." -ForegroundColor Green
try {
    docker tag "${IMAGE_NAME}:${Version}" "${ECR_REPO}:${Version}"
    if ($Version -ne "latest") {
        docker tag "${IMAGE_NAME}:${Version}" "${ECR_REPO}:latest"
        Write-Host "✓ Tagged as ${Version} and latest" -ForegroundColor Green
    } else {
        Write-Host "✓ Tagged as latest" -ForegroundColor Green
    }
} catch {
    Write-Host "✗ Failed to tag image: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 4: Push to ECR
Write-Host "Step 4: Pushing image to ECR..." -ForegroundColor Green
try {
    docker push "${ECR_REPO}:${Version}"
    if ($Version -ne "latest") {
        docker push "${ECR_REPO}:latest"
    }
    if ($LASTEXITCODE -ne 0) {
        throw "Docker push failed"
    }
    Write-Host "✓ Image pushed to ECR successfully" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to push image: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 5: Force ECS Service Update
Write-Host "Step 5: Updating ECS service..." -ForegroundColor Green
try {
    aws ecs update-service `
        --cluster $CLUSTER_NAME `
        --service $SERVICE_NAME `
        --force-new-deployment `
        --region $Region `
        --no-cli-pager
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to update ECS service"
    }
    Write-Host "✓ ECS service update initiated" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to update ECS service: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 6: Wait for service to stabilize
Write-Host "Step 6: Waiting for service to stabilize..." -ForegroundColor Green
Write-Host "This may take a few minutes..." -ForegroundColor Yellow
try {
    aws ecs wait services-stable `
        --cluster $CLUSTER_NAME `
        --services $SERVICE_NAME `
        --region $Region
    Write-Host "✓ Service is stable" -ForegroundColor Green
} catch {
    Write-Host "⚠ Service update initiated but may still be deploying" -ForegroundColor Yellow
    Write-Host "Check ECS console for deployment status" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "=== Deployment Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "View logs:" -ForegroundColor Yellow
Write-Host "  aws logs tail /ecs/${ProjectPrefix} --follow --region $Region" -ForegroundColor Gray
Write-Host ""
Write-Host "Check service status:" -ForegroundColor Yellow
Write-Host "  aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $Region" -ForegroundColor Gray

