# Fail2Ban (Optional)

[Fail2Ban](https://github.com/fail2ban/fail2ban) reads logs and bans IPs that fail too often, e.g. password guessing on the login page.
PiGallery2 logs every failed login with the client's IP, so Fail2Ban can ban brute force attempts on the login page
and on password protected sharing links.

This guide works for any setup. With Portainer and Nginx Proxy Manager, the
[Fail2Ban section of the Portainer & NPM guide](advanced-docker-npm-portainer.md#6-fail2ban-optional) is the short version.

**Note:** Fail2Ban is not a replacement for rate limiting in your reverse proxy (see the `limit_req` lines in the
[default nginx.conf](https://github.com/bpatrik/pigallery2/blob/master/docker/docker-compose/default/nginx.conf)):
rate limiting slows every guess down, Fail2Ban stops a client that keeps guessing.

---

## What PiGallery2 logs

A failed login is logged as a warning, so the default log level (`info`) shows it:

```
11/20/2026, 9:18:03 PM[WARN_] AuthenticationMWs Failed login from IP `203.0.113.7` for user:"admin", bad password
11/20/2026, 9:18:04 PM[WARN_] AuthenticationMWs Failed login from IP `203.0.113.7` for user:"bob", the user does not exist
11/20/2026, 9:18:05 PM[WARN_] AuthenticationMWs Failed login from IP `203.0.113.7` with sharing:"abc123", bad password
11/20/2026, 9:18:06 PM[WARN_] AuthenticationMWs Failed login from IP `203.0.113.7` no user or password provided
```

The part up to the IP is stable, so filter on that. The user name and the sharing key are JSON-quoted (newlines are escaped),
so a client can't write a log line of its own. The date follows the server's locale and the level is coloured;
Fail2Ban doesn't need either (see the `systemd` backend below).

## 1. Log the real client IP

Behind a reverse proxy (nginx, Nginx Proxy Manager, Traefik, Caddy, ...), PiGallery2 sees the proxy's IP, not the client's.
Fail2Ban would then ban your proxy. Tell PiGallery2 which proxy to trust with `Server.trustProxy`
(Settings → Server, "Under the hood" mode), or as an environment variable in your `docker-compose.yml`:

```yaml
    environment:
      - Server-trustProxy=uniquelocal
```

- `uniquelocal` trusts the `X-Forwarded-For` header only when it comes from a private network address,
  like the Docker network of your proxy. This is what you want in most setups.
- Don't use `true`: it trusts every client, so anyone can send a fake `X-Forwarded-For` header and get someone else banned.
- Your proxy must send the header, e.g. `proxy_set_header X-Forwarded-For $remote_addr;` in nginx (the example configs do).

If a login request comes through a proxy that isn't trusted, PiGallery2 logs a warning and shows it on the admin page.

Without a reverse proxy (PiGallery2 listens on the internet directly) leave `Server.trustProxy` on `false`.

## 2. Make the log readable for Fail2Ban

Fail2Ban needs a log that stays at the same place. A Docker container's own log file
(`/var/lib/docker/containers/<id>/<id>-json.log`) gets a new path every time the container is re-created (e.g. on an update),
so send the container's log to the systemd journal with a fixed tag instead. Add this to the `pigallery2` service:

```yaml
    logging:
      driver: journald
      options:
        tag: pigallery2
```

`docker logs` keeps working. Check it with `journalctl CONTAINER_TAG=pigallery2 -f`.

**Direct install (no Docker):** run PiGallery2 as a systemd service named `pigallery2`; its output then goes to the journal too.
Use `journalmatch = _SYSTEMD_UNIT=pigallery2.service` instead of the one below.

## 3. Run Fail2Ban

Run it either in Docker (easiest with Portainer) or installed on the host. Both read the journal and ban in the host's firewall.

### A) In Docker

Deploy [this compose file](https://github.com/bpatrik/pigallery2/blob/master/docker/docker-compose/fail2ban/docker-compose.yml)
as its own stack (e.g. paste it into Portainer). It uses the `crazymax/fail2ban:debian` image and writes the filter and the jail
itself, so it needs no other files. Change `port`, `maxretry`, `bantime` or `ignoreip` in it if needed.

Check it with `docker logs fail2ban`. Run the `fail2ban-*` commands of step 4 in the container, e.g. `docker exec fail2ban fail2ban-client status pigallery2`.

### B) On the host

On Debian / Ubuntu: `sudo apt install fail2ban python3-systemd`.

Create the filter, `/etc/fail2ban/filter.d/pigallery2.conf`:

```ini
[Definition]
# the first "Failed login from IP" on the line; the user name comes after the IP
failregex = ^.*?\bAuthenticationMWs Failed login from IP `<ADDR>`(?: for user:| with sharing:| no user or password provided)
ignoreregex =

[Init]
# the tag of the journald log driver
journalmatch = CONTAINER_TAG=pigallery2
```

And the jail, `/etc/fail2ban/jail.d/pigallery2.local`:

```ini
[pigallery2]
enabled  = true
filter   = pigallery2
backend  = systemd
port     = http,https
# Docker: published ports bypass the INPUT chain, ban in DOCKER-USER instead.
# Direct install: remove the next two lines.
banaction = iptables-multiport
chain    = DOCKER-USER
maxretry = 5
findtime = 10m
bantime  = 1h
bantime.increment = true
# never ban your own network
ignoreip = 127.0.0.1/8 ::1 192.168.0.0/16 10.0.0.0/8 172.16.0.0/12
```

Then `sudo systemctl restart fail2ban`.

### Why `DOCKER-USER`

Traffic to a port that Docker publishes (`ports:` in a compose file) is forwarded to the container
and never passes the host's `INPUT` chain, where Fail2Ban bans by default. Docker's `DOCKER-USER` chain sees it.
The ports in that chain are the container's ports: if the container listens on a different port than the host
(e.g. `8080:80`), set `port` to the container port. Check that the chain exists with `sudo iptables -L DOCKER-USER`.
A ban blocks the IP for every container behind those ports (e.g. everything behind your reverse proxy), not only for PiGallery2.

## 4. Test it

1. Check the filter against the log: `sudo fail2ban-regex systemd-journal /etc/fail2ban/filter.d/pigallery2.conf`
2. Fail a login from a device outside your network (e.g. a phone on mobile data) a few times, then check that
   the logged IP is the phone's public IP, not a `172.x` Docker address: `journalctl CONTAINER_TAG=pigallery2 | grep "Failed login"`
3. `sudo fail2ban-client status pigallery2` lists the banned IPs. Unban one with
   `sudo fail2ban-client set pigallery2 unbanip <ip>`.

**Tip:** if the logged IP is a Docker address although `Server.trustProxy` is set, check that the request reaches your proxy
directly. For example, IPv6 requests to a Docker host without IPv6 support go through Docker's userland proxy, which hides
the client's IP.
