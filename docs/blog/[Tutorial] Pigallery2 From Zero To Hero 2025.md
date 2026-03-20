# How I deploy pigallery2

After my 2021 post  https://github.com/bpatrik/pigallery2/discussions/292 and my 2023 follow-up https://github.com/bpatrik/pigallery2/discussions/738 on how I use the app, I decided to finally write down **how I actually deploy pigallery2**.

This is not meant to be the *only* way to run pigallery2, but rather **the setup I personally trust and use** in production.

In this post I’ll show how to deploy `pigallery2` using:

* **Docker**
* **Portainer** (container management)
* **Nginx Proxy Manager (NPM)** with SSL
* **Authentik** for single sign-on (optional, but recommended)

---

## Prerequisites

Before starting, make sure you have:

1. A domain name you control
   Example: `https://mypigallery2.com`

2. A server you can SSH into
   I assume a Debian-based Linux machine (Ubuntu, Debian, etc.)

3. Docker installed
   👉 [https://docs.docker.com/install/](https://docs.docker.com/install/)

That’s it. Everything else will run inside containers.

---

## Preparation

I like to keep **all configuration files in one place** so they’re easy to back up with a simple `cp` or `rsync`.

Create a config directory in your home folder:

```bash
cd ~
mkdir config
```

We’ll place all service configs under this directory.

---

## Portainer

**Official docs:**
[https://docs.portainer.io/start/install-ce/server/docker/linux#docker-compose](https://docs.portainer.io/start/install-ce/server/docker/linux#docker-compose)

[Portainer](https://www.portainer.io/) is a web-based Docker manager. It lets you:

* deploy Docker Compose stacks
* update and restart containers
* inspect logs
* manage volumes and networks

If you don’t pay for Portainer, you need to start it manually. The easiest way is still Docker Compose.

### Create the Portainer config

```bash
mkdir portainer
cd portainer
```

Create a `docker-compose.yml`:

```yaml
version: "3.9"
services:
  homer:
    image: portainer/portainer-ce:lts
    container_name: portainer
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - portainer_data:/data
    ports:
      - 9443:9443
    restart: always

volumes:
  portainer_data:
    external: true
```

Start it, then open:

```
https://localhost:9443
```

You should see the Portainer UI.

---

## Nginx Proxy Manager (NPM)

**Official guide:**
[https://nginxproxymanager.com/guide/](https://nginxproxymanager.com/guide/)

### Why NPM?

In 2025, **you should not expose any app to the internet without SSL**.
And you should **not trust any self-hosted app** — including mine.

I trust nginx to:

* terminate TLS
* handle HTTP quirks
* protect against basic abuse and misconfiguration

Nginx Proxy Manager makes nginx usable without turning your life into a YAML nightmare.

(An alternative would be Traefik, but NPM is easier to reason about.)

---

### Deploy NPM via Portainer

In Portainer, create a **new stack** and paste this compose file:

```yaml
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
      - /home/<user>/configs/nginx-proxy-manager/data:/data # change me
      - /home/<user>/configs/nginx-proxy-manager/letsencrypt:/etc/letsencrypt # change me
    networks:
      - frontend

networks:
  frontend:
    name: frontend
```

Replace `<user>` with your Linux username.

⚠️ **Important note about networks**

The `frontend` Docker network is **crucial**.
Every service you want to expose publicly **must be on the same Docker network**.

In my setup, this network is called `frontend`. Use the same name everywhere.

<img width="3506" height="1843" alt="kép" src="https://github.com/user-attachments/assets/36724048-f4bf-4bf8-9a15-fb11c53eb657" />

Deploy the stack.
Make sure ports `80`, `81`, and `443` are free on the host.

---

## Pigallery2

### Create the container

Go back to Portainer and create another **stack** with the following compose file:

```yaml
version: '3'
services:
  pigallery2:
    image: bpatrik/pigallery2:latest
    container_name: pigallery2
    environment:
      - NODE_ENV=production
      # - NODE_ENV=debug # uncomment for debugging
    volumes:
      - "/home/<user>/configs/pigallery2/config:/app/data/config" # CHANGE ME
      - "db-data:/app/data/db"
      - "<path>/images:/app/data/images:ro" # CHANGE ME, ':ro' means read-only
      - "<path>/tmp:/app/data/tmp" # CHANGE ME
    expose:
      - "80"
    restart: always
    networks:
      - frontend

volumes:
  db-data:

networks:
  frontend:
    name: frontend
    external: true
```

<img width="3524" height="1846" alt="kép" src="https://github.com/user-attachments/assets/6551feac-91bb-4e13-911d-7fc6f09ad6be" />

Key points:

* The container **only exposes port 80**, it does not bind it to the host
* NPM will reach it via Docker networking
* Images are mounted **read-only**
* The DB volume is disposable (as discussed in previous posts)

Deploy the stack.

---

## Add pigallery2 to Nginx Proxy Manager

In NPM, add a **new Proxy Host**.

<img width="814" height="964" alt="kép" src="https://github.com/user-attachments/assets/497b8117-31fc-455f-ad6c-b28c94bcd5af" />
<img width="804" height="593" alt="kép" src="https://github.com/user-attachments/assets/661e74de-e719-4f1f-b83c-704712fd1f4e" />

### Advanced configuration

Paste the following into the **Advanced** tab:

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

# Allow all HTTP methods for the API
# See https://github.com/bpatrik/pigallery2/issues/214
location /pgapi {
  proxy_pass http://pigallery2:80;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection 'upgrade';
  proxy_set_header Host $host;
  proxy_cache_bypass $http_upgrade;
}

# UI is GET-only
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

<img width="808" height="1661" alt="kép" src="https://github.com/user-attachments/assets/7c3aa14f-c717-46da-90b8-02d46e767d0e" />

Save the host.
NPM will automatically request SSL certificates.

Once finished, you should be able to access:

```
https://mypigallery2.com
```

---

## Authentik (optional, but recommended)

**Official docs:**
[https://docs.goauthentik.io/install-config/install/docker-compose/](https://docs.goauthentik.io/install-config/install/docker-compose/)

If you run multiple self-hosted services, you’ll eventually want **single sign-on**.

Authentik (or Authelia) solves this. Authentik is heavier, but it supports Google login and richer flows.

Since https://github.com/bpatrik/pigallery2/issues/1096, pigallery2 supports **OpenID Connect**, so Authentik integrates cleanly.

---

### Deploy Authentik in Portainer

I strongly recommend grabbing the latest compose file from their docs, but for reference, here’s mine:

```yaml
services:
  postgresql:
    env_file:
      - stack.env
    environment:
      POSTGRES_DB: ${PG_DB:-authentik}
      POSTGRES_PASSWORD: ${PG_PASS:?database password required}
      POSTGRES_USER: ${PG_USER:-authentik}
    healthcheck:
      interval: 30s
      retries: 5
      start_period: 20s
      test:
        - CMD-SHELL
        - pg_isready -d $${POSTGRES_DB} -U $${POSTGRES_USER}
      timeout: 5s
    image: docker.io/library/postgres:16-alpine
    restart: unless-stopped
    volumes:
      - database:/var/lib/postgresql/data

  server:
    command: server
    depends_on:
      postgresql:
        condition: service_healthy
    env_file:
      - stack.env
    environment:
      AUTHENTIK_POSTGRESQL__HOST: postgresql
      AUTHENTIK_POSTGRESQL__NAME: ${PG_DB:-authentik}
      AUTHENTIK_POSTGRESQL__PASSWORD: ${PG_PASS}
      AUTHENTIK_POSTGRESQL__USER: ${PG_USER:-authentik}
      AUTHENTIK_SECRET_KEY: ${AUTHENTIK_SECRET_KEY:?secret key required}
    image: ${AUTHENTIK_IMAGE:-ghcr.io/goauthentik/server}:${AUTHENTIK_TAG:-2025.10.2}
    ports:
      - ${COMPOSE_PORT_HTTP:-9000}:9000
      - ${COMPOSE_PORT_HTTPS:-9443}:9443
    restart: unless-stopped
    volumes:
      - ./media:/media
      - ./custom-templates:/templates

  worker:
    command: worker
    depends_on:
      postgresql:
        condition: service_healthy
    env_file:
      - stack.env
    environment:
      AUTHENTIK_POSTGRESQL__HOST: postgresql
      AUTHENTIK_POSTGRESQL__NAME: ${PG_DB:-authentik}
      AUTHENTIK_POSTGRESQL__PASSWORD: ${PG_PASS}
      AUTHENTIK_POSTGRESQL__USER: ${PG_USER:-authentik}
      AUTHENTIK_SECRET_KEY: ${AUTHENTIK_SECRET_KEY:?secret key required}
    image: ${AUTHENTIK_IMAGE:-ghcr.io/goauthentik/server}:${AUTHENTIK_TAG:-2025.10.2}
    restart: unless-stopped
    user: root
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./media:/media
      - ./certs:/certs
      - ./custom-templates:/templates

volumes:
  database:
    driver: local
```

Don’t forget to define environment variables:

<img width="3646" height="1365" alt="kép" src="https://github.com/user-attachments/assets/44add136-df09-43b2-9a43-977095bae3f5" />

---

### Configure Authentik

Create a new **Application**:

<img width="2925" height="1048" alt="kép" src="https://github.com/user-attachments/assets/b213087d-da70-4793-ae26-c0f103a778d6" />

* **Name:** pigallery2
* **Slug:** `pigallery2`

<img width="1656" height="758" alt="kép" src="https://github.com/user-attachments/assets/e6d4e3d1-0656-434a-9bdc-740dad24d58a" />

Select provider:

<img width="1678" height="1101" alt="kép" src="https://github.com/user-attachments/assets/1818c348-11d6-44e2-9156-356f724c56e2" />

* Provider type: **OAuth2 / OpenID Connect**

Set callback URL:

```
https://mypigallery2.com/pgapi/auth/oidc/callback
```

<img width="1680" height="1516" alt="kép" src="https://github.com/user-attachments/assets/909d862c-50ee-4a86-b4f3-9233d838d30b" />

Other settings:

* **Subject mode:** User’s hashed ID
* **Bindings:** none required

---

### Add Authentik to pigallery2

Finally, configure OIDC inside pigallery2:

<img width="2380" height="1314" alt="kép" src="https://github.com/user-attachments/assets/090d626f-dd41-4e54-8764-a9aefe482fce" />

At this point, pigallery2 will delegate authentication to Authentik.

---

## Closing thoughts

This setup might look heavy at first, but it gives me:

* TLS everywhere
* sane HTTP defaults
* isolation between services
* optional SSO
* zero trust in my own code 😄

If something breaks, I can tear everything down and rebuild it — which fits perfectly with pigallery2’s philosophy of **DB as cache and disk as source of truth**.

Hope this helps others running pigallery2 in the wild.
