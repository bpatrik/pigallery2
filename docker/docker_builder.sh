#!/bin/bash
# PiGallery2: Build -> Release -> Docker (Debian Trixie) -> Diagnostics
# This is a helper script for building docker locally. Its a best effort file ans provided as it is, do not expect significant support for this if it gets our of sync from the project. 

set -e # Stop on any error

# Configuration
REPO_URL="${PIGALLERY2_REPO_URL:-https://github.com/GitchalWoo/pigallery2.5.git}"
REPO_REF="${PIGALLERY2_REF:-master}"
BUILD_DIR="pigallery2_local_build"
IMAGE_NAME="pigallery2-custom:local"

echo "--- 1. Pre-flight Environment Check ---"

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "Error: node is not installed. Please install Node.js 24 (>=24.15.0)."
    exit 1
else
    NODE_VER=$(node -v)
    echo "Found Node.js: $NODE_VER"
    node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major !== 24 || minor < 15) { console.error("Node.js >=24.15.0 <25 is required."); process.exit(1); }'
fi

# Check for npm
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed."
    exit 1
else
    NPM_VER=$(npm -v)
    echo "Found npm: $NPM_VER"
    node -e 'const [major, minor] = process.argv[1].split(".").map(Number); if (major !== 11 || minor < 19) { console.error("npm >=11.19.0 <12 is required (npm install --global npm@11.19.0)."); process.exit(1); }' "$NPM_VER"
fi

# Check for Docker (required for the build-docker step)
if ! command -v docker &> /dev/null; then
    echo "Error: docker is not installed. Required for building the container."
    exit 1
fi

# Check for Git
if ! command -v git &> /dev/null; then
    echo "Error: git is not installed."
    exit 1
fi

echo "--- 2. Preparing Repository ---"
if [ -d "$BUILD_DIR" ]; then 
    echo "Cleaning up old build directory..."
    rm -rf "$BUILD_DIR"
fi
git clone --depth 1 --branch "$REPO_REF" "$REPO_URL" "$BUILD_DIR"
cd $BUILD_DIR

echo "--- 3. Installing Build Dependencies ---"
npm ci

echo "--- 4. Creating Production Release ---"
# This mirrors the GitHub Action workflow you provided
npm run create-release -- --skip-opt-packages=ffmpeg-static,ffprobe-static --force-opt-packages

echo "--- 5. Building Docker Image (Debian Trixie) ---"
# Match the Dockerfile expectation: rename 'release' to 'pigallery2-release'
if [ -d "release" ]; then
    mv release pigallery2-release
else
    echo "Error: Release folder was not created by gulp."
    exit 1
fi

# You might need to run this with sudo
docker build -t $IMAGE_NAME \
             -f docker/debian-trixie/Dockerfile.build .

echo "--- 6. Running Post-Build Diagnostics ---"
# The Dockerfile runs diagnostics during build, but this verifies the final image layer
# You might need to run this with sudo
docker run --rm $IMAGE_NAME node ./src/backend/index --run-diagnostics --Server-Log-level=silly

echo "------------------------------------------------"
echo "SUCCESS: $IMAGE_NAME is ready."
echo "------------------------------------------------"
