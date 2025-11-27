#!/bin/bash
# Build script for Transcribe Worker Lambda function
# This script packages the transcribe worker for Lambda deployment

set -e

OUTPUT_PATH="${1:-services/worker/transcribe-worker.zip}"
WORKER_DIR="services/worker"

echo "Building Transcribe Worker Lambda package..."

# Check if worker directory exists
if [ ! -d "$WORKER_DIR" ]; then
    echo "Error: Worker directory not found: $WORKER_DIR"
    exit 1
fi

cd "$WORKER_DIR"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install --production
fi

# Create temporary directory for packaging
TEMP_DIR="lambda-package"
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

echo "Copying files..."

# Copy source files
cp -r src "$TEMP_DIR/src"

# Copy node_modules (production dependencies only)
echo "Copying node_modules..."
cp -r node_modules "$TEMP_DIR/node_modules"

# Copy package.json
cp package.json "$TEMP_DIR/package.json"

# Copy Lambda handler
cp lambda-handler.js "$TEMP_DIR/lambda-handler.js"

# Create zip file
echo "Creating zip file..."
cd "$TEMP_DIR"
zip -r "../transcribe-worker.zip" . -q
cd ..

# Clean up temp directory
rm -rf "$TEMP_DIR"

# Get file size
FILE_SIZE=$(du -h transcribe-worker.zip | cut -f1)
echo "✅ Lambda package created: transcribe-worker.zip ($FILE_SIZE)"

# Check if file is too large (Lambda limit is 50MB unzipped, 250MB zipped)
FILE_SIZE_BYTES=$(stat -f%z transcribe-worker.zip 2>/dev/null || stat -c%s transcribe-worker.zip 2>/dev/null || echo "0")
FILE_SIZE_MB=$((FILE_SIZE_BYTES / 1024 / 1024))

if [ "$FILE_SIZE_MB" -gt 50 ]; then
    echo "⚠️  Warning: Package size exceeds 50MB. Consider using Lambda layers."
fi

echo "Build complete!"

