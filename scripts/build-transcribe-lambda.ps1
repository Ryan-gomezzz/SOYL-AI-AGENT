# Build script for Transcribe Worker Lambda function
# This script packages the transcribe worker for Lambda deployment

param(
    [string]$OutputPath = "services/worker/transcribe-worker.zip"
)

Write-Host "Building Transcribe Worker Lambda package..." -ForegroundColor Green

# Navigate to worker directory
$WorkerDir = "services/worker"
if (-not (Test-Path $WorkerDir)) {
    Write-Host "Error: Worker directory not found: $WorkerDir" -ForegroundColor Red
    exit 1
}

Push-Location $WorkerDir

try {
    # Install dependencies if node_modules doesn't exist
    if (-not (Test-Path "node_modules")) {
        Write-Host "Installing dependencies..." -ForegroundColor Yellow
        npm install --production
    }

    # Create temporary directory for packaging
    $TempDir = "lambda-package"
    if (Test-Path $TempDir) {
        Remove-Item -Recurse -Force $TempDir
    }
    New-Item -ItemType Directory -Path $TempDir | Out-Null

    Write-Host "Copying files..." -ForegroundColor Yellow
    
    # Copy source files
    Copy-Item -Recurse -Path "src" -Destination "$TempDir/src"
    
    # Copy node_modules (production dependencies only)
    Write-Host "Copying node_modules..." -ForegroundColor Yellow
    Copy-Item -Recurse -Path "node_modules" -Destination "$TempDir/node_modules"
    
    # Copy package.json
    Copy-Item -Path "package.json" -Destination "$TempDir/package.json"
    
    # Copy Lambda handler
    Copy-Item -Path "lambda-handler.js" -Destination "$TempDir/lambda-handler.js"

    # Create zip file
    Write-Host "Creating zip file..." -ForegroundColor Yellow
    $ZipPath = Join-Path (Get-Location).Path "transcribe-worker.zip"
    
    # Remove existing zip if it exists
    if (Test-Path $ZipPath) {
        Remove-Item -Force $ZipPath
    }

    # Use Compress-Archive (PowerShell 5.0+)
    Compress-Archive -Path "$TempDir/*" -DestinationPath $ZipPath -Force

    # Clean up temp directory
    Remove-Item -Recurse -Force $TempDir

    # Get file size
    $FileSize = (Get-Item $ZipPath).Length / 1MB
    Write-Host "✅ Lambda package created: $ZipPath ($([math]::Round($FileSize, 2)) MB)" -ForegroundColor Green

    # Check if file is too large (Lambda limit is 50MB unzipped, 250MB zipped)
    if ($FileSize -gt 50) {
        Write-Host "⚠️  Warning: Package size exceeds 50MB. Consider using Lambda layers." -ForegroundColor Yellow
    }

} catch {
    Write-Host "Error building Lambda package: $_" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}

Write-Host "Build complete!" -ForegroundColor Green

