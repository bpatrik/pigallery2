---
name: release
description: Walk the maintainer through releasing a new PiGallery2 version (man page, translations, Hungarian review, tests, docs screenshots, tag, GitHub release with notes and the CI zip, sample extension update). Use when the maintainer asks to do / prepare / cut a release.
---

# PiGallery2 release checklist

Run the steps in order. Keep a task list with one item per step. Stop and ask at every step marked **(ask)**.
The global rules still apply: never commit unasked (leave each step's changes for review in the IDE),
and pushing a tag or publishing a release is outward-facing, so confirm it first.

Versions: `master` carries `X.Y.Z-edge` in `package.json`; a release is `X.Y.Z` with a git tag of exactly that name.
The extension kit (`pigallery2-extension-kit`) needs no publish step: the tag's CI run publishes it with the app's version.
The sample extension that uses it is updated in step 8b.

Release candidate (since 3.8.0): do steps 0-5b with the version `X.Y.Z-rc.1` instead of `X.Y.Z` (branch `release-X.Y.Z-rc.1`)
and merge it without a tag. Its master CI run pushes Docker `edge` and publishes the kit `X.Y.Z-rc.1` with the npm dist-tag `edge`
(every prerelease version is published once, from master). The maintainer runs it for about a week; fixes land on master as usual
(bump to `-rc.2` only if the kit should be republished). Then the release itself is only step 4 with `X.Y.Z`
(rerun step 2/3 if strings changed since the RC), then steps 6-9.

## 0. Preconditions **(ask)**

- On `master`, clean, up to date with `origin/master`, and the latest CI run on master is green
  (`gh run list --workflow ci.yml --branch master --limit 3`).
- Soft rule: the maintainer runs the `edge` build on their own server for a while before a release.
  Ask how long the current edge has been running there and whether anything came up. If it's only been a short time, say so,
  but it's their call.
- Pick the version: list what changed since the last tag (`git describe --tags --abbrev=0`,
  `git log --oneline <last-tag>..master`) and propose `X.Y.Z` (usually `package.json` without `-edge`;
  breaking changes → bump major).
- Do the prep work on a branch `release-X.Y.Z` (PR into master), unless the maintainer says to do it on master directly.

## 1. Man page

- `npm run generate-man` regenerates `docs/user-guide/configuration.md` from the config classes.
- Show the diff summary; it should only reflect config changes since the last release.

## 2. Translations

- `npm run merge-new-translation`: extracts the strings (`ng extract-i18n`) and merges them into every
  `src/frontend/translate/messages.*.xlf`; new strings get a Google machine translation.
- Build and run the translation check: `npm run build-backend && npx mocha test/frontend/translation.spec.js`.

## 3. Hungarian review **(ask)**

The maintainer wants a clean Hungarian translation of everything a gallery user sees; admin/settings strings may stay
machine-translated or English.

Don't read `messages.hu.xlf` itself (~470 KB). Use the script next to this file:

- `node .claude/skills/release/translation-review.mjs export --out <scratchpad>/hu.json` writes a small JSON
  (`[{id, reason, where, source, target}]`) of the units that are new or whose English changed since the last tag
  (`--since <ref>` to change), plus units whose translation still equals the English. It skips units used only by the
  admin UI (settings, admin, duplicates, job texts, config); `--with-admin` includes them.
  Units listed in `translation-reviewed.hu.json` (reviewed earlier, including those that stay English on purpose: `FPS`, `OpenStreetMap`, ...) are skipped.
- Propose natural Hungarian wording for each, consistent with the terms the file already uses (to check a term, grep
  `<target>` lines for it rather than reading the file). Keep every `<x id="..." .../>` placeholder; write plain text
  (`&`, `<`, `>`), the script encodes it. Keep a translation that is right as it is.
- Show the proposals as a table (source / old / new, mark the ones you'd keep or leave English) and let the maintainer adjust.
- Write the agreed list as `[{id, target}]` to a JSON file and run
  `node .claude/skills/release/translation-review.mjs apply <file>`. It checks the placeholders, writes nothing if any
  unit is wrong, and adds every applied id to `translation-reviewed.hu.json` (commit it with the translations). Include the units that are fine as they are (with their current target), so they count as reviewed too.
- Run the export again: it should come out empty, apart from what the maintainer chose to leave for later.

## 4. Version bump

- `npm version X.Y.Z --no-git-tag-version` (updates `package.json` and `package-lock.json`).
- Suggested commit message: `Version bump to X.Y.Z`.

## 5. Everything builds and passes

Save the output to the scratchpad and read only the summaries (see AGENTS.md "Build and test"). Run long ones in the background.

- `npm run build-backend`
- `npm run lint`
- `npm run test-backend` with MySQL (the full suite is recommended before a release; see the local MySQL memory)
- `npm run test-frontend`
- `npm run build-en` (production build), then `npm run test-e2e`
- Report failures with their output; don't release over a red suite unless the maintainer says so.

## 5b. Docs screenshots **(ask)**

The docs images (`docs/assets/*.png`, used by `docs/features.md`) come from a Playwright spec, so they show the current UI.

- Needs the maintainer's docs photos in `demo/images2/docs/puerto rico` (not in git; ask if they're missing) and the
  production build in `dist` from step 5.
- `DOCS_SCREENSHOTS=true npm run test-e2e -- docs-screens` (it starts its own server, `start-docs-e2e-server`;
  stop any own server on 8080 first or set `E2E_PORT`). It writes `test/playwright/screenshots/*.png` (git-ignored).
- Look at every new screenshot (Read the PNGs) and compare it with the one in `docs/assets` with the same name:
  loading spinners, missing map tiles or thumbnails, toasts or dev-only UI mean a rerun, not a copy.
- Copy the good ones over the same names in `docs/assets/`. Images the spec doesn't make (`extension.png`, `events.png`,
  `demo.gif`, `demo.mp4`, icons) stay as they are; mention them if the UI they show changed a lot.
- The maintainer checks the image diff in the IDE.

Then the maintainer commits, the release PR is merged, and CI on master must be green
(`gh run list --workflow ci.yml --branch master --limit 1`).

## 6. Tag **(ask)**

- On the merged master commit whose `package.json` says `X.Y.Z`: `git tag X.Y.Z` and `git push origin X.Y.Z`.
- The tag's CI run (`gh run list --workflow ci.yml --branch X.Y.Z`) builds the release zip and pushes the Docker images
  (`X.Y.Z`, `latest`, `latest-<distro>`).
- Don't watch it in a loop: start the next step and check the run once it should be done (~20-30 min).

## 7. Release notes **(ask)**

- Collect: `git log --oneline <last-tag>..X.Y.Z`, merged PRs since the last release
  (`gh pr list --state merged --base master --search "merged:>=<last-release-date>" --limit 200 --json number,title,author,body`),
  issues closed by them, and first-time contributors.
- Look specifically for:
  - a `DataStructureVersion` bump (`git diff <last-tag>..X.Y.Z -- src/common/DataStructureVersion.ts`) → the DB is rebuilt on first start (users kept),
  - config changes that need user action (diff of `docs/user-guide/configuration.md`),
  - extension API breaking changes (PR descriptions list them; `extension/` and `src/backend/model/extension/IExtension.ts` diffs).
- Draft in the style of earlier releases (`gh release view <last-tag>`): **Breaking changes**, **Main new features**
  (with issue/PR links), **Further changes**, **New Contributors**, and
  `**Full Changelog**: https://github.com/bpatrik/pigallery2/compare/<last-tag>...X.Y.Z`.
- Write the draft to a file in the scratchpad (give the full path) and let the maintainer edit it.
  These notes are written by the maintainer about their own project; don't add an AI footer unless they want one.

## 8. GitHub release with the CI zip **(ask)**

- Download the `pigallery2-release` artifact of the tag's CI run as the same zip the web UI gives
  (earlier releases attach it as `pigallery2-release.zip`):
  - `gh api repos/bpatrik/pigallery2/actions/runs/<run-id>/artifacts --jq '.artifacts[] | select(.name=="pigallery2-release") | .id'`
  - `gh api repos/bpatrik/pigallery2/actions/artifacts/<artifact-id>/zip > <scratchpad>/pigallery2-release.zip`
  - Sanity-check it: `unzip -l` shows `package.json`, `src/backend/index.js` and the `dist/` languages.
- `gh release create X.Y.Z --title X.Y.Z --notes-file <draft> --verify-tag <scratchpad>/pigallery2-release.zip`
  (add `--draft` if the maintainer wants a last look on GitHub), then give the release URL.

## 8b. Sample extension **(ask)**

The [sample extension](https://github.com/bpatrik/pigallery2-sample-extension) (listed in `extension/REPOSITORY.md`)
must work with the new release. Its local checkout is `extensions/pigallery2-sample-extension` (its own git repo, branch `main`).

- Wait until the tag's CI run has published the kit: `npm view pigallery2-extension-kit@X.Y.Z version`.
- In the sample's `package.json`: set `version` and `pigallery2-extension-kit` to `X.Y.Z`, and the devDependencies that the
  app also has (`typescript`, `typeconfig`, `typeorm`, `@types/node`, `@types/express`) to the app's versions. Bump `lodash` to its latest.
- `npm install`, then `npm run build`. Fix compile errors against the new kit and TypeScript (keep its `tsconfig.json`
  close to the app's: `module: nodenext`, CommonJS output). `server.js` / `server.js.map` / `config.js` are committed there, so rebuild them.
- Its CI (`.github/workflows/ci.yml`) builds on the Node versions of the app's `ci.yml` matrix; keep that matrix and the
  action versions in line with the app's.
- Try it in the real app (see AGENTS.md "Running the app"), with `--Extensions-folder=<abs path>/extensions` and a throwaway config/DB:
  the log should show `Running init on extension: pigallery2-sample-extension`, its routes and `SampleMessenger`, and no errors;
  after logging in as `admin`, `GET /pgapi/extension/pigallery2-sample-extension/sample` returns the saved rows.
- Leave the changes for review; the maintainer commits and pushes them in that repo.

## 9. Back to edge

- Bump master to the next prerelease, e.g. `npm version X.(Y+1).0-edge --no-git-tag-version`
  (commit `Version bump to X.(Y+1).0-edge`, like `42af9167`).
- Wrap up with what was released, links (release, Docker Hub), and anything left open.

## Improving this checklist

When the maintainer changes the process during a release, update this file in the same session.
