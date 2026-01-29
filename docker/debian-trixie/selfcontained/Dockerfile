#-----------------BUILDER-----------------
#-----------------------------------------
FROM node:22-trixie AS builder
# LABEL maintainer="Patrik J. Braun"

ENV SHARP_FORCE_GLOBAL_LIBVIPS=1

# inspired by: https://dev.to/ilyasa1211/converting-heic-image-extension-in-nodejs-with-the-sharp-library-39mg
# also see: https://github.com/bpatrik/pigallery2/issues/965

# Install build and vips dependencies
RUN apt-get update && apt-get install -y --no-install-recommends curl python3 git build-essential pkg-config \
  libvips-dev && \
  rm -rf /var/lib/apt/lists/*

# copying only package{-lock}.json to make node_modules cachable
RUN git clone https://github.com/bpatrik/pigallery2.git /build
WORKDIR /build
RUN npm install --unsafe-perm \
    && mkdir -p /build/release/data/config \
    && mkdir -p /build/release/data/db \
    && mkdir -p /build/release/data/images \
    && mkdir -p /build/release/data/tmp \
    && npm run create-release
WORKDIR /build/release
RUN npm install --unsafe-perm --no-package-lock node-addon-api@8.5.0 node-gyp@11.5.0

#-----------------MAIN--------------------
#-----------------------------------------
FROM node:22-trixie-slim AS main
WORKDIR /app
ENV NODE_ENV=production \
    # overrides only the default value of the settings (the actualy value can be overwritten through config.json)
    default-Database-dbFolder=/app/data/db \
    default-Media-folder=/app/data/images \
    default-Media-tempFolder=/app/data/tmp \
    default-Extensions-folder=/app/data/config/extensions \
    # flagging dockerized environemnt
    PI_DOCKER=true

EXPOSE 80
ARG TARGETARCH
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates wget ffmpeg libvips42 \
    && if [ "$TARGETARCH" = "amd64" ]; then \
        echo "Building for amd64, adding intel-media-va-driver" && \
        apt-get install -y --no-install-recommends intel-media-va-driver; \
    fi \
    && apt-get clean -q -y \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /build/release /app

# Run build time diagnostics to make sure the app would work after build is finished
RUN ["node", "--expose-gc", "./src/backend/index", "--run-diagnostics", "--config-path=/app/diagnostics-config.json", "--Server-Log-level=silly"]
HEALTHCHECK --interval=40s --timeout=30s --retries=3 --start-period=60s \
  CMD wget --quiet --tries=1 --no-check-certificate --spider \
  http://127.0.0.1:80/heartbeat || exit 1

# after a extensive job (like video converting), pigallery calls gc, to clean up everthing as fast as possible
# Exec form entrypoint is need otherwise (using shell form) ENV variables are not properly passed down to the app
ENTRYPOINT ["node", "--expose-gc", "./src/backend/index","--config-path=/app/data/config/config.json"]
