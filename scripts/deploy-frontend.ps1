# Frontend Deployment Script - S3 + CloudFront
# This script builds and deploys the frontend to S3 and invalidates CloudFront cache

param(
    [string]$Region = "us-east-1",
    [string]$BucketName = "ai-ca-agent-staging-static-us-east-1",
    [string]$ApiUrl = "https://px9q707kr6.execute-api.us-east-1.amazonaws.com/staging"
)

Write-Host "=== Frontend Deployment to S3 + CloudFront ===" -ForegroundColor Yellow
Write-Host ""

# Step 1: Build Frontend
Write-Host "Step 1: Building frontend..." -ForegroundColor Cyan
Set-Location frontend

if (-not (Test-Path "node_modules")) {
    Write-Host "  Installing dependencies..." -ForegroundColor Gray
    npm install
}

# Create production environment file
Write-Host "  Configuring API URL: $ApiUrl" -ForegroundColor Gray
"VITE_API_URL=$ApiUrl" | Out-File -FilePath ".env.production" -Encoding utf8 -NoNewline

# Build
Write-Host "  Building production bundle..." -ForegroundColor Gray
npm run build

if (-not (Test-Path "dist")) {
    Write-Host "❌ Build failed - dist folder not found" -ForegroundColor Red
    Set-Location ..
    exit 1
}

Write-Host "✅ Build successful!" -ForegroundColor Green
Set-Location ..

# Step 2: Upload to S3
Write-Host ""
Write-Host "Step 2: Uploading to S3..." -ForegroundColor Cyan
Write-Host "  Bucket: $BucketName" -ForegroundColor Gray

# Upload static assets with long cache
Write-Host "  Uploading static assets..." -ForegroundColor Gray
aws s3 sync frontend/dist/ s3://$BucketName/ `
    --delete `
    --region $Region `
    --cache-control "public, max-age=31536000, immutable" `
    --exclude "*.map" `
    --exclude "index.html" `
    --exclude ".DS_Store" 2>&1 | Out-Null

# Upload index.html with no cache
Write-Host "  Uploading index.html..." -ForegroundColor Gray
aws s3 cp frontend/dist/index.html s3://$BucketName/index.html `
    --region $Region `
    --content-type "text/html" `
    --cache-control "public, max-age=0, must-revalidate" 2>&1 | Out-Null

Write-Host "✅ Files uploaded to S3!" -ForegroundColor Green

# Step 3: Invalidate CloudFront Cache
Write-Host ""
Write-Host "Step 3: Invalidating CloudFront cache..." -ForegroundColor Cyan

$cfDist = aws cloudfront list-distributions `
    --region $Region `
    --query "DistributionList.Items[?contains(Origins.Items[0].DomainName, '$BucketName') || contains(Comment, 'ai-ca-agent')].Id" `
    --output text

if ([string]::IsNullOrWhiteSpace($cfDist)) {
    # Try to get any distribution
    $cfDist = aws cloudfront list-distributions `
        --region $Region `
        --query "DistributionList.Items[0].Id" `
        --output text
}

if ($cfDist) {
    Write-Host "  Distribution ID: $cfDist" -ForegroundColor Gray
    $invalidation = aws cloudfront create-invalidation `
        --distribution-id $cfDist `
        --paths "/*" `
        --region $Region `
        --output json | ConvertFrom-Json
    
    Write-Host "✅ Cache invalidation created!" -ForegroundColor Green
    Write-Host "  Invalidation ID: $($invalidation.Invalidation.Id)" -ForegroundColor Gray
    Write-Host "  Status: $($invalidation.Invalidation.Status)" -ForegroundColor Gray
} else {
    Write-Host "⚠️ CloudFront distribution not found" -ForegroundColor Yellow
}

# Step 4: Get CloudFront URL
Write-Host ""
Write-Host "Step 4: Getting CloudFront URL..." -ForegroundColor Cyan

$cfInfo = aws cloudfront list-distributions `
    --region $Region `
    --query "DistributionList.Items[?contains(Origins.Items[0].DomainName, '$BucketName') || contains(Comment, 'ai-ca-agent')].{DomainName:DomainName,Status:Status}" `
    --output json | ConvertFrom-Json

if (-not $cfInfo) {
    $cfInfo = aws cloudfront list-distributions `
        --region $Region `
        --query "DistributionList.Items[0].{DomainName:DomainName,Status:Status}" `
        --output json | ConvertFrom-Json
}

if ($cfInfo) {
    Write-Host ""
    Write-Host "=== Deployment Complete ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "✅ Frontend deployed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "CloudFront URL: https://$($cfInfo.DomainName)" -ForegroundColor Cyan
    Write-Host "Status: $($cfInfo.Status)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Note: Cache invalidation may take 1-2 minutes to complete" -ForegroundColor Yellow
    Write-Host "Visit the URL above to see your deployed frontend" -ForegroundColor Cyan
} else {
    Write-Host "⚠️ Could not retrieve CloudFront URL" -ForegroundColor Yellow
}

