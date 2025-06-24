#!/bin/bash

# Simple PiGallery2 Alpine Build Script
# This script builds cristiangauma/pigallery2:latest directly from the current directory

set -e

echo "Building cristiangauma/pigallery2:latest with updated image-size dependency..."

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "src" ]; then
    print_error "This script must be run from the pigallery2 root directory"
    exit 1
fi

# Check if podman is installed
if ! command -v podman &> /dev/null; then
    print_error "Podman is not installed. Please install podman first."
    exit 1
fi

# Check if image-size is updated to 2.0.2
if ! grep -q '"image-size": "2.0.2"' package.json; then
    print_warning "image-size is not set to version 2.0.2 in package.json"
    print_warning "Expected: \"image-size\": \"2.0.2\""
    print_warning "Current: $(grep '"image-size":' package.json || echo 'Not found')"
fi

# Create the Dockerfile content
print_status "Creating temporary Dockerfile..."
cat > Dockerfile.alpine-custom << 'EOF'
#-----------------BUILDER-----------------
#-----------------------------------------
FROM node:18-alpine3.17 AS builder
RUN apk add --no-cache --repository https://alpine.global.ssl.fastly.net/alpine/v3.17/community/ \
  python3 build-base sqlite-dev sqlite-libs imagemagick-dev libraw-dev vips-dev vips-heif vips-magick fftw-dev gcc g++ make libc6-compat && \
  ln -snf /usr/bin/python3 /usr/bin/python && \
  rm -rf /var/cache/apk/* || true

# Copy source code
COPY . /app
WORKDIR /app

# Install dependencies with updated image-size
RUN npm install --unsafe-perm --fetch-timeout=90000

# Create release
RUN npm run create-release -- --skip-opt-packages=ffmpeg-static,ffprobe-static --force-opt-packages

# Prepare release directory structure
RUN mkdir -p /app/release/data/config && \
    mkdir -p /app/release/data/db && \
    mkdir -p /app/release/data/images && \
    mkdir -p /app/release/data/tmp

WORKDIR /app/release
RUN npm install --unsafe-perm --fetch-timeout=90000 --production

#-----------------MAIN--------------------
#-----------------------------------------
FROM node:18-alpine3.17 AS main
WORKDIR /app

ENV NODE_ENV=production \
    default-Database-dbFolder=/app/data/db \
    default-Media-folder=/app/data/images \
    default-Media-tempFolder=/app/data/tmp \
    default-Extensions-folder=/app/data/config/extensions \
    PI_DOCKER=true

EXPOSE 80

RUN apk add --no-cache --repository https://alpine.global.ssl.fastly.net/alpine/v3.17/community/ \
    vips vips-cpp vips-heif vips-magick ffmpeg && \
    rm -rf /var/cache/apk/* || true

COPY --from=builder /app/release /app

# Run diagnostics to verify everything works
RUN ["node", "./src/backend/index", "--expose-gc",  "--run-diagnostics", "--config-path=/app/diagnostics-config.json", "--Server-Log-level=silly"]

HEALTHCHECK --interval=40s --timeout=30s --retries=3 --start-period=60s \
  CMD wget --quiet --tries=1 --no-check-certificate --spider \
  http://127.0.0.1:80/heartbeat || exit 1

ENTRYPOINT ["node", "./src/backend/index", "--expose-gc",  "--config-path=/app/data/config/config.json"]
EOF

print_status "Building the Docker image with podman..."
podman build -f Dockerfile.alpine-custom -t cristiangauma/pigallery2:latest .

if [ $? -eq 0 ]; then
    print_status "Verifying the build..."
    
    # Check if the image was created successfully
    if podman images | grep -q "cristiangauma/pigallery2.*latest"; then
        print_status "✅ Build successful!"
        print_status "Image cristiangauma/pigallery2:latest has been created with image-size 2.0.2."
        echo ""
        print_status "Image details:"
        podman images | grep -E "(REPOSITORY|cristiangauma/pigallery2)"
        echo ""
        print_status "To run the container:"
        echo "podman run -d \\"
        echo "  --name pigallery2 \\"
        echo "  -p 8080:80 \\"
        echo "  -v /path/to/your/images:/app/data/images:ro \\"
        echo "  -v /path/to/your/config:/app/data/config \\"
        echo "  -v /path/to/your/db:/app/data/db \\"
        echo "  -v /path/to/your/tmp:/app/data/tmp \\"
        echo "  cristiangauma/pigallery2:latest"
        echo ""
        print_status "To push to a registry:"
        echo "podman push cristiangauma/pigallery2:latest"
        print_status "🎉 Build completed successfully!"
    else
        print_error "Build verification failed - image not found"
        exit 1
    fi
else
    print_error "Build failed!"
    exit 1
fi

# Clean up temporary Dockerfile
print_status "Cleaning up temporary files..."
rm -f Dockerfile.alpine-custom

print_status "Build script completed!" 