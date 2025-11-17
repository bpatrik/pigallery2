# PiGallery2 Docker Contribution guide (draft)

Remember to update all the Dockerfiles.

## Linting
To quality check your dockerfile changes you can use hadolint:

1. Start the docker daemon if it's not already started: `sudo dockerd`
2. Change dir to the docker folder.
3. Run hadolint on the alpine dockerfile: `docker run --rm -i -v ./.config/hadolint.yml:/.config/hadolint.yaml hadolint/hadolint < ./alpine/Dockerfile.build`
4. Run hadolint on the debian-trixie dockerfile: `docker run --rm -i -v ./.config/hadolint.yml:/.config/hadolint.yaml hadolint/hadolint < ./debian-trixie/Dockerfile.build`
7. Run hadolint on the debian-trixie selfcontained dockerfile: `docker run --rm -i -v ./.config/hadolint.yml:/.config/hadolint.yaml hadolint/hadolint < ./debian-trixie/selfcontained/Dockerfile`
8. Fix errors and warnings or add them to ignore list of the [hadolint configuration file](./.config/hadolint.yml) if there is a good reason for that. Read more [here](https://github.com/hadolint/hadolint).

### Building the docker image locally
TBD


### Building a docker image from a specific commit ID
When you fork this repo, you can build an image using the `docker-buildx-from-commit` github actions workflow. It requires that you set this github secret for your fork
- `REGISTRY_NAMESPACE`

When you run the workflow / github action, it will ask you for a commit ID and whether you want to `push` to docker hub or generate a `tar`. For local testing you should just generate a `tar`. When the action has run successfully, you can click it and click the appropriate run, then scroll to the bottom and you will see the artifacts there. Download the one you need and import it into your local docker.

The `push` option is there if you want to publish your particular build to docker hub. In that case you need to have the following github secrets set for your fork:
- `REGISTRY_USERNAME`
- `REGISTRY_PASSWORD`
