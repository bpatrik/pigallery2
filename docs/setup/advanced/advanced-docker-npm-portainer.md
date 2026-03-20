# Advanced Setup: Portainer and NPM

This tutorial covers an advanced deployment scenario using **Portainer** for container management and **Nginx Proxy Manager (NPM)** as a reverse proxy.

This setup is ideal for users who want:
- A GUI to manage Docker containers (Portainer).
- Automatic SSL/TLS certificates (NPM + Let's Encrypt).
- Optimized Nginx configuration for PiGallery2.
- A shared configuration structure.

---

## Prerequisites

1.  **Docker and Docker Compose** installed on your server.
2.  **A Domain Name** with DNS records pointing to your server's IP address.
3.  **Ports 80 and 443** open on your firewall.

---

## Preparation

It is recommended to keep all configuration files in a centralized location for easy backups.

```bash
mkdir -p ~/configs/nginx-proxy-manager/data
mkdir -p ~/configs/nginx-proxy-manager/letsencrypt
mkdir -p ~/configs/pigallery2/config
```

---

## 1. Portainer Setup

Portainer provides a web UI for managing Docker stacks, containers, and networks.

### Deploy Portainer

Run the following command to start Portainer:

```bash
docker run -d -p 8000:8000 -p 9443:9443 --name portainer --restart=always -v /var/run/docker.sock:/var/run/docker.sock -v portainer_data:/data portainer/portainer-ce:latest
```

Access it at `https://<your-server-ip>:9443`.

---

## 2. Shared Network

To allow NPM to communicate with other containers, we use a shared Docker network named `frontend`.

In Portainer, go to **Networks** -> **Add network**:
- **Name:** `frontend`
- **Driver:** `bridge`

---

## 3. Nginx Proxy Manager (NPM) Stack

NPM will handle SSL termination and routing.

In Portainer, create a new **Stack** (Docker Compose) named `nginx-proxy-manager`:

![screen](assets/portainer.png)

```yaml
version: '3.8'
services:
  app:
    container_name: nginx-proxy-manager
    image: 'jc21/nginx-proxy-manager:latest'
    restart: unless-stopped
    ports:
      - '80:80'
      - '81:81'
      - '443:443'
    volumes:
      - /home/<user>/configs/nginx-proxy-manager/data:/data
      - /home/<user>/configs/nginx-proxy-manager/letsencrypt:/etc/letsencrypt
    networks:
      - frontend

networks:
  frontend:
    external: true
```
*Replace `<user>` with your actual username.*

---

## 4. PiGallery2 Stack

Deploy PiGallery2 and connect it to the `frontend` network.

Create a new **Stack** named `pigallery2` and copy the content of [this compose file (original)](https://github.com/bpatrik/pigallery2/blob/master/docker/docker-compose/pigallery2-only/docker-compose.yml):

![screen](assets/portainer2.png)

```yaml
version: '3'
services:
  pigallery2:
    image: bpatrik/pigallery2:latest
    container_name: pigallery2
    deploy:
      resources:
        limits:
          memory: 3G # <1GB RAM might also work. It will trigger GC more often. GC is slow. See https://github.com/bpatrik/pigallery2/issues/1080
    environment:
      - NODE_ENV=production
      - # - NODE_OPTIONS=--enable-source-maps # enable source map support on the backend  for development
    volumes:
      - "/home/<user>/configs/pigallery2/config:/app/data/config"
      - "db-data:/app/data/db"
      - "/mnt/images:/app/data/images:ro" # Path to your photos
      - "/mnt/pigallery2-tmp:/app/data/tmp" # Path to a tmp folder
    expose:
      - "80"
    restart: always
    networks:
      - frontend

volumes:
  db-data:

networks:
  frontend:
    external: true
```

---

## 5. Configuring NPM

Access the NPM admin interface at `http://<your-server-ip>:81`.

### Add PiGallery2 Proxy Host

1.  **Domain Names:** `photos.yourdomain.com`
2.  **Scheme:** `http`
3.  **Forward Hostname / IP:** `pigallery2`
4.  **Forward Port:** `80`
5.  **SSL Tab:** Select "Request a new SSL Certificate", enable "Force SSL" and "HTTP/2 Support".

![screen](assets/npm.png)]
![screen](assets/npm2.png)

#### Advanced Tab
Paste the following to enable Gzip compression and handle API/UI routing correctly:

![screen](assets/npm3.png)

```nginx
gzip on;
gzip_proxied any;
gzip_comp_level 6;
gzip_types
    text/css
    text/plain
    text/javascript
    text/markdown
    application/javascript
    application/json
    application/gpx+xml
    application/x-javascript
    application/xml
    application/xml+rss
    application/xhtml+xml
    application/x-font-ttf
    application/x-font-opentype
    application/vnd.ms-fontobject
    image/svg+xml
    image/x-icon
    application/rss+xml
    application/atom_xml;
gzip_disable "MSIE [1-6]\.(?!.*SV1)";

# API handles all methods (GET, POST, PUT, DELETE, etc.)
location /pgapi {
    proxy_pass http://pigallery2:80;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}

# UI is restricted to GET for security
location / {
    limit_except GET {
        deny all;
    }
    proxy_pass http://pigallery2:80;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

---

## Summary

With this setup, you have:
- **Portainer** to easily manage and update your containers.
- **Nginx Proxy Manager** providing SSL and routing.
- **PiGallery2** securely accessible via your own subdomain.
- A **shared Docker network** allowing internal communication between the proxy and the app.
