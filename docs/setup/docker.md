# PiGallery2 Docker Installation

[Docker](https://www.docker.com/) with [docker-compose](https://docs.docker.com/compose/) is the **official and recommended** way of installing and running PiGallery2. 

You can use [docker](https://docs.docker.com/install/) to run PiGallery2. See all available docker tags [here](https://hub.docker.com/r/bpatrik/pigallery2/tags/).
available tags:
 - `v*` (stable): built from the release with the same version name.
 - `latest` (stable): same as the latest `v*`, built with debian buster.
 - `edge` : built from the current state of `master`. This might break from time to time.

**Note**: Some changes may require database reset or config changes, see [#317](https://github.com/bpatrik/pigallery2/issues/317) (If you want to reduce the frequency of those, use stable builds (`latest`)

We support multiple architectures, including `amd64`, `arm64v8`, `arm32v7` (deprecated [see](https://github.com/bpatrik/pigallery2/issues/1027)).

It contains all necessary dependencies, auto-restarts on reboot, supports HTTPS, and is easy to upgrade.

## 0. Install Docker (recommended)
Official installation guide [here](https://docs.docker.com/install/), but this will most likely do the trick on a Raspberry Pi ([source](https://dev.to/rohansawant/installing-docker-and-docker-compose-on-the-raspberry-pi-in-5-simple-steps-3mgl)): 
```bash
curl -sSL https://get.docker.com | sh
``` 

## I. Docker Compose
It is recommended to use [docker-compose](https://docs.docker.com/compose/) to run PiGallery2.

### I.0 Install Docker Compose
Official installation guide [here](https://docs.docker.com/compose/install/), or try this ([source](https://dev.to/rohansawant/installing-docker-and-docker-compose-on-the-raspberry-pi-in-5-simple-steps-3mgl)):
Install dependencies:
```bash
sudo apt-get install libffi-dev libssl-dev
sudo apt-get install -y python3 python3-pip
sudo apt-get remove python-configparser
```
Install docker-compose:
```bash
sudo pip3 install docker-compose
``` 
Check success with `docker-compose --version`.

### I.1 Get docker-compose.yml file
Download [docker-compose/default/docker-compose.yml](https://github.com/bpatrik/pigallery2/blob/master/docker/docker-compose/default/docker-compose.yml) and 
[docker-compose/default/nginx.conf](https://github.com/bpatrik/pigallery2/blob/master/docker/docker-compose/default/nginx.conf).

Edit `docker-compose.yml` at the `# CHANGE ME` lines to point the volumes to the right `image` and `tmp` directories.
Edit `nginx.conf` at the `# CHANGE ME` lines by replacing `yourdomain.com` with your domain address.

**Note**: Do not change the `image` and `tmp` paths in the `config.json` or UI; only use Docker `volume` settings. See [here](https://github.com/bpatrik/pigallery2/issues/114#issuecomment-570006336) and [here](https://github.com/bpatrik/pigallery2/issues/119).

**Note:** We are using nginx as reverse proxy to handle https and do proper HTTP queuing, gzipping, etc. Full nginx-based docker-compose tutorial [here](https://www.domysee.com/blogposts/reverse-proxy-nginx-docker-compose).

**Note 2:** You can skip nginx, by using [docker-compose/pigallery2-only/docker-compose.yml](https://github.com/bpatrik/pigallery2/blob/master/docker/docker-compose/pigallery2-only/docker-compose.yml).

### I.1.a Get SSL Certificate with Certbot
Install Certbot: https://certbot.eff.org/. (Certbot uses letsencrypt to get free certificate).
Then get your certificate: 
```bash
certbot certonly --standalone -d yourdomain.com
```
**Note:** if you get an error like `Problem binding to port 80: Could not bind to IPv4 or IPv6.` then a service is running on port 80. If it's a fresh raspberry install, it's potentially nginx, you can disable it with `sudo systemctl disable nginx` [details here](https://askubuntu.com/questions/177041/nginx-disable-autostart).

### I.1.b Start Docker Compose
In the folder that has `docker-compose.yml`:
```bash
docker-compose up -d
```
`-d` runs it as a daemon. Remove it, so you will see the logs. 

After the containers are up and running, go to `yourdomain.com` and log in with user: `admin` pass: `admin` and set up the page in the settings. 
Full list of configuration options are available at the [MANPAGE.md](https://github.com/bpatrik/pigallery2/blob/master/MANPAGE.md).

**Note:** `docker-compose.yml` contains `restart:always`, so the containers will be automatically started after reboot ([read more here](https://stackoverflow.com/questions/43671482/how-to-run-docker-compose-up-d-at-system-start-up)).

### I.2 Upgrade to newer version

```bash
docker-compose pull # get new version
docker-compose down # stop running container
docker system prune # from time to time its nice to clean up docker
docker-compose up -d # start containers
```

## II. Without Docker Compose
If you want to run the container by yourself, here you go:

```bash
docker run \
   -p 80:80 \
   -e NODE_ENV=production \
   -v <path to your config file folder>:/app/data/config \
   -v <path to your db file folder>:/app/data/db \
   -v <path to your images folder>:/app/data/images \
   -v <path to your temp folder>:/app/data/tmp \
   bpatrik/pigallery2:latest
```

After the container is up and running, go to `http://localhost` and log in with user: `admin` pass: `admin` and set up the page in the settings. 

**Note**: even with `memory` db, pigallery2 creates a db file for storing user credentials (if enabled), so mounting (with `-v`) the `/app/data/db` folder is recommended.

**Note 2**: Do not change the `image` and `tmp` paths in the `config.json` or UI; only use Docker `volume` settings. See [here](https://github.com/bpatrik/pigallery2/issues/114#issuecomment-570006336) and [here](https://github.com/bpatrik/pigallery2/issues/119).

### II.a before v1.7.0
There was a breaking change in Docker files after v1.7.0. Use this to run earlier versions:

```bash
docker run \
   -p 80:80 \
   -e NODE_ENV=production \
   -v <path to your config file folder>/config.json:/pigallery2-release/config.json \
   -v <path to your db file folder>/sqlite.db:/pigallery2-release/sqlite.db \
   -v <path to your images folder>:/pigallery2-release/demo/images \
   -v <path to your temp folder>:/pigallery2-release/demo/TEMP \
   bpatrik/pigallery2:1.7.0-stretch
```
Make sure that a file at `<path to your config file folder>/config.json` and `sqlite.db` files exists before running it. 

You do not need the `<path to your db file folder>/sqlite.db` line if you don't use the sqlite database.

## Build the Docker image on your own
 
You can clone the repository and build the image, or you can just use the 'self-contained' Dockerfile: [debian-trixie/selfcontained/Dockerfile](https://github.com/bpatrik/pigallery2/blob/master/docker/debian-trixie/selfcontained/Dockerfile)
Note: 'self-contained' is not well tested, bug fix PRs are welcome.

## Contributing to Docker
See the [Docker Contribution Guide](../development/docker-contributing.md).
