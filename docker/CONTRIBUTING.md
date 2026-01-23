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

Instructions below are incomplete, but might get you started.
```
$ git clone https://github.com/bpatrik/pigallery2.git
$ cd pigallery2/
$ npm install
$ npm run create-release
$ mkdir pigallery2-release
$ cp pigallery2.zip pigallery2-release/
$ cd pigallery2-release/
$ unzip pigallery2.zip
$ rm pigallery2.zip
$ docker buildx build \
  --platform linux/amd64 \
  -t pigallery2_test \
  -f ./docker/alpine/Dockerfile.build \
  . \
  --output=type=docker,dest=pigallery2-test
```

Note, when builing locally, you may build for different architecture, but you cannot create a docker image without QEMU. It is beyond this guide to instruct in the use of QEMU.

If you need to build an image for a different architecture, you can use the manual custom build action in github under Actions... See [this section](building-a-docker-image-using-github-actions).

### Building a docker image using github actions

Need to build for another architecture than what you're working on?

With the github actions workflow defined [here](../.github/build-custom.yml), you can both build it and make the ready image available on your private docker hub account. After you're done, you can delete the images again.

The workflow is made to be as generic as possible, to help you. When you fork the repo, you may adapt it for your own purposes. It is meant as a helping hand/tool or template, but is not an integral part of pigallery2.

The workflow roughly works like this to be future proof:

1. Check out source code (default is latest, but you may enter a commit-id to build a specific version)
2. Detect node version (future proofing)
3. Sets up build preconditions (node and dependencies)
4. Builds pigallery2 (optionally tests it too)
5. Detects which docker images to build (future proofing)
6. Builds the docker images
7. Publishes the images to YOUR docker hub repository

This may help you to adapt the workflow to your own needs.

#### Preconditions

1. You need a docker-hub account!
   - https://app.docker.com/signup
2. You need a github account!
   - https://github.com/signup
3. You need to fork pigallery2
   - https://github.com/bpatrik/pigallery2/fork
4. You need to go to Settings -> Secrets and variables -> Actions for your fork and set these three values (with info from your docker-hub account)
   - `REGISTRY_NAMESPACE` (your docker-hub namespace - typically your username)
   - `REGISTRY_USERNAME` (your docker-hub username)
   - `REGISTRY_PASSWORD` (your generated Personal Access Token from docker-hub - needs to have read and write privileges)

#### Usage


Build and publish an image using the `docker-buildx-custom` github actions workflow.

I should be available on your fork in github.com under `Actions`. Typically at this URL: `https://github.com/`**_`<youruserid>`_**`/pigallery2/actions`

When you run the workflow / github action, it will ask you for a commit ID, an architecture, an overriding version number and whether to run tests. Each has a default, so you don't need to input anything:
- `Commit ID`: Default is blank. If blank a build will be made from the head of selected branch. Enter a commit-id if you need to build an image from a particular time / commit. Useful for comparison or recreation of older edge versions.
- `Architecture`: Default is 'all'. In which case images will be made for all architectures supported. To save time, you can limit the architecture to the one of your choice.
  > _Note: If you want to test on a specific supported architecture, input this to speed up the build-process._
- `Override version`: Default is blank. If blank the version will be 0.0.0-unstable-YYMMDD-SHORT_SHA, e.g. `0.0.0-unstable.20260103220501.cf6386e`. You may use the field to name your version anything... e.g. `mytestversion`.
- `Run tests`: Default is false. If false no tests will be run. If true tests will run.

![image showing github actions workflow](image.png)

After the job is done, you will have your images uploaded to docker hub, from where you can pull and run them.
