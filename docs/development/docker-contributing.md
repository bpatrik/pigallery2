# PiGallery2 Docker Contribution Guide

Remember to update all the Dockerfiles.

## Linting
To quality check your Dockerfile changes, you can use hadolint:

1. Start the Docker daemon if it's not already started: `sudo dockerd`
2. Change directory to the `docker/` folder.
3. Run hadolint on the Dockerfiles:
```bash
docker run --rm -i -v ./.config/hadolint.yml:/.config/hadolint.yaml hadolint/hadolint < ./alpine/Dockerfile.build
docker run --rm -i -v ./.config/hadolint.yml:/.config/hadolint.yaml hadolint/hadolint < ./debian-trixie/Dockerfile.build
docker run --rm -i -v ./.config/hadolint.yml:/.config/hadolint.yaml hadolint/hadolint < ./debian-trixie/selfcontained/Dockerfile
```

Fix errors and warnings or add them to the ignore list of the [hadolint configuration file](https://github.com/bpatrik/pigallery2/blob/master/docker/.config/hadolint.yml) if there is a good reason for that. Read more [here](https://github.com/hadolint/hadolint).

### Building the docker image locally (Docs are as-it-is, no further support provided for this)

Get the latest release from github (the source code is not enough, it needs to be built and packed, you can do that fropm source with `npm run create-release`)

```bash
wget https://github.com/bpatrik/pigallery2/releases/download/3.1.0/pigallery2-release.zip
unzip pigallery2-release.zip -d pigallery2
cd pigallery2
$ sudo docker build --progress=plain   -t local-pg .
```
