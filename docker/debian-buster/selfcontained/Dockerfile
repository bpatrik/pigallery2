#-----------------BUILDER-----------------
#-----------------------------------------
FROM node:18-buster AS builder
# LABEL maintainer="Patrik J. Braun"
# copying only package{-lock}.json to make node_modules cachable
RUN git clone https://github.com/xuthus83/pigallery2.git /build
WORKDIR /build
RUN npm install --unsafe-perm \
    && mkdir -p /build/release/data/config \
    && mkdir -p /build/release/data/db \
    && mkdir -p /build/release/data/images \
    && mkdir -p /build/release/data/tmp \
    && npm run create-release \
    && cd /build/release \
    && npm install --unsafe-perm

#-----------------MAIN--------------------
#-----------------------------------------
FROM node:18-buster-slim AS main
WORKDIR /app
ENV NODE_ENV=production \
    # overrides only the default value of the settings (the actualy value can be overwritten through config.json)
    default-Database-dbFolder=/app/data/db \
    default-Media-folder=/app/data/images \
    default-Media-tempFolder=/app/data/tmp \
    # flagging dockerized environemnt
    PI_DOCKER=true

EXPOSE 80
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates wget ffmpeg \
    && apt-get clean -q -y \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /build/release /app
VOLUME ["/app/data/config", "/app/data/db", "/app/data/images", "/app/data/tmp"]

# Run build time diagnostics to make sure the app would work after build is finished
RUN ["node", "./src/backend/index", "--expose-gc",  "--run-diagnostics", "--config-path=/app/diagnostics-config.json"]
HEALTHCHECK --interval=40s --timeout=30s --retries=3 --start-period=60s \
  CMD wget --quiet --tries=1 --no-check-certificate --spider \
  http://localhost:80/heartbeat || exit 1

# after a extensive job (like video converting), pigallery calls gc, to clean up everthing as fast as possible
# Exec form entrypoint is need otherwise (using shell form) ENV variables are not properly passed down to the app
ENTRYPOINT ["node", "./src/backend/index", "--expose-gc",  "--config-path=/app/data/config/config.json"]

