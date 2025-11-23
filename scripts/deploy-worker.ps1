# Deploy Worker Service to ECS
# This script builds, tags, and pushes the worker Docker image to ECR

param(
    [string]$Version = "latest",
    [string]$Region = "us-east-1",
    [string]$AccountId = "381492072674",
    [string]$ProjectPrefix = "ai-ca-agent-staging"
)

$ErrorActionPreference = "Stop"

Write-Host "=== Deploying Worker Service to ECR ===" -ForegroundColor Cyan
Write-Host ""

# ECR Repository URL
$ECR_REPO = "${AccountId}.dkr.ecr.${Region}.amazonaws.com/${ProjectPrefix}/worker"

Write-Host "ECR Repository: $ECR_REPO" -ForegroundColor Yellow
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
$BUILD_CONTEXT = "services/worker"
$IMAGE_NAME = "${ProjectPrefix}-worker"
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

Write-Host "=== Deployment Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Note: Worker service ECS task definition and service need to be created separately." -ForegroundColor Yellow
Write-Host "Check infra/terraform/ecs.tf for worker service configuration." -ForegroundColor Yellow

