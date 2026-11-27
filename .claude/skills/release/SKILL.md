---
name: release
description: Walk the maintainer through releasing a new PiGallery2 version (man page, translations, Hungarian review, tests, docs screenshots, tag, GitHub release with notes and the CI zip, sample extension update, announcement post reminder). Use when the maintainer asks to do / prepare / cut a release.
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
(rerun step 2/3 if strings changed since the RC, and step 3b if anything landed), then steps 6-9.

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

Other languages, when the maintainer asks for them: the same script with `--lang <code> --with-admin` lists what still
equals the English; translate only those (keep good existing translations, keep product names like SQLite as they are),
apply, and commit each language on its own (`translation-reviewed.<lang>.json` with it). Order used so far: merge, hu, fr, es, de,
then the rest by number of speakers. Check with `npx ng build --configuration production --localize --output-path=<scratchpad>/dist`.

## 3b. Release notes **(ask)**

`RELEASE_NOTES.md` collects the notes while the release is developed (AGENTS.md "Release notes"). It ships in the release
zip, and admins see it in the app ("What's new" popup once per version, about page), so finish it before the version bump.

- Collect what it may miss: `git log --oneline <last-tag>..HEAD`, merged PRs since the last release
  (`gh pr list --state merged --base master --search "merged:>=<last-release-date>" --limit 200 --json number,title,author,body`)
  and the issues closed by them.
- Look specifically for:
  - a `DataStructureVersion` bump (`git diff <last-tag> -- src/common/DataStructureVersion.ts`) → the DB is rebuilt on first start (users kept),
  - config changes that need user action (diff of `docs/user-guide/configuration.md`),
  - extension API breaking changes (PR descriptions list them; `extension/` and `src/backend/model/extension/IExtension.ts` diffs).
- Cross-check with GitHub's generated notes, which list every merged PR (also before the tag exists):
  `gh api repos/bpatrik/pigallery2/releases/generate-notes -f tag_name=X.Y.Z -f target_commitish=master -f previous_tag_name=<last-tag> --jq .body`
  (or the maintainer pastes them from a release draft). Look for user-visible PRs the notes miss, and for PRs that were
  reverted later (`Revert "..."`), which must not be listed.
- Highlight: lead "Main new features" with the headline feature in bold, and open "Under the hood" with a one-line
  summary (bug fixes, security fixes, tech upgrades) followed by one line that collects the security fixes.
- Update the file in the style of earlier releases (`gh release view <last-tag>`): `## Breaking changes`, `## Main new features`,
  `## Under the hood`, `## Further changes`, `## Bug fixes`, with full issue/PR links (the app does not link a bare `#1234`)
  and the contributors (`by @name in [#1234](...)`). Drop empty sections. Resolve the `TODO` comments with the maintainer.
  Keep the comment at the top. The maintainer edits it in the IDE.
- For a release after its RC, rerun this step if anything landed since the RC.

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
- The maintainer may skip the local runs: then open the release PR and let its CI run the full suite (backend incl. MySQL,
  frontend, e2e, Docker builds) and merge it once green. A red `coverage/coveralls` status of a few hundredths of a percent
  on a PR without code changes is noise.

## 5b. Docs screenshots **(ask)**

The docs images (`docs/assets/*.png`, used by `docs/features.md`) and the `demo.gif` / `demo.mp4` tour of the docs main page
come from a Playwright spec, so they show the current UI.

- Uses the demo photos in `demo/images` and needs the production build in `dist` from step 5.
- `DOCS_SCREENSHOTS=true npm run test-e2e -- docs-screens` (it starts its own server, `start-docs-e2e-server`;
  stop any own server on 8080 first or set `E2E_PORT`). It writes `test/playwright/screenshots/*.png`, `demo.gif` and `demo.mp4` (git-ignored).
  The tour is recorded twice (the first run warms up the thumbnails and map tiles), so the run takes a few minutes.
- Look at every new screenshot (Read the PNGs; for the GIF, a contact sheet of its frames:
  `node_modules/ffmpeg-static/ffmpeg -i test/playwright/screenshots/demo.mp4 -vf "fps=1/2,scale=480:-1,tile=5x5" -frames:v 1 <tmp>/sheet.png`) and compare it with the one in `docs/assets` with the same name:
  loading spinners, missing map tiles or thumbnails, toasts or dev-only UI mean a rerun, not a copy.
- Copy the good ones over the same names in `docs/assets/`. Images the spec doesn't make (`extension.png`, `events.png`, icons) stay as they are; mention them if the UI they show changed a lot.
- The maintainer checks the image diff in the IDE.

Then the maintainer commits, the release PR is merged, and CI on master must be green
(`gh run list --workflow ci.yml --branch master --limit 1`).

## 6. Tag **(ask)**

Cloud sessions can push only their own branch (no tags) and can't create releases or upload release assets. There the
maintainer does steps 6 and 8 in the GitHub web UI (also from a phone): Draft a new release, tag `X.Y.Z` "Create new tag on publish"
with the target `master`. Publishing creates the tag from `master` at that moment, so merge every PR that changes `RELEASE_NOTES.md`
before publishing (the zip and the in-app "What's new" ship the tag's file). The draft can be saved before the notes are final.

- On the merged master commit whose `package.json` says `X.Y.Z`: `git tag X.Y.Z` and `git push origin X.Y.Z`.
- The tag's CI run (`gh run list --workflow ci.yml --branch X.Y.Z`) builds the release zip and pushes the Docker images
  (`X.Y.Z`, `latest`, `latest-<distro>`).
- Don't watch it in a loop: start the next step and check the run once it should be done (~20-30 min).

## 7. Release notes **(ask)**

- Start from `RELEASE_NOTES.md` of the tag (step 3b), without its comments (the top one, `TODO`s, the contributor list at the end). Add **New Contributors**
  (first-time contributors of the merged PRs since the last release) and
  `**Full Changelog**: https://github.com/bpatrik/pigallery2/compare/<last-tag>...X.Y.Z`,
  with a `## ❤️ Support` section right before it: the sponsor line of `README.md` (GitHub Sponsors and Ko-fi).
- Above `## Breaking changes` (GitHub release only, not `RELEASE_NOTES.md`): leave room for a 2-3 sentence intro that the
  maintainer writes in their own words (what the release is about), and one image of the headline feature
  (a `docs/assets/` screenshot, or a GIF). The full notes are long; most readers only see this part.
- Write the draft to a file in the scratchpad (give the full path) and let the maintainer edit it.
  These notes are written by the maintainer about their own project; don't add an AI footer unless they want one.

## 8. GitHub release with the CI zip **(ask)**

- Download the `pigallery2-release` artifact of the tag's CI run as the same zip the web UI gives
  (earlier releases attach it as `pigallery2-release.zip`):
  - `gh api repos/bpatrik/pigallery2/actions/runs/<run-id>/artifacts --jq '.artifacts[] | select(.name=="pigallery2-release") | .id'`
  - `gh api repos/bpatrik/pigallery2/actions/artifacts/<artifact-id>/zip > <scratchpad>/pigallery2-release.zip`
  - Sanity-check it: `unzip -l` shows `package.json`, `src/backend/index.js` and the `dist/` languages.
- `gh release create X.Y.Z --title X.Y.Z --notes-file <draft> --verify-tag --discussion-category General <scratchpad>/pigallery2-release.zip`
  (add `--draft` if the maintainer wants a last look on GitHub), then give the release URL. The discussion gives the
  release a comment thread; link it from the announcement posts.
- In a cloud session: download the artifact (or give its link from the tag's run page), check it, and send it to the
  maintainer to attach as `pigallery2-release.zip` with "Edit release".

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

## 8c. Announce the release **(ask)**

Donations come in spikes around releases, and this is the only recurring donation work (no sponsor rewards to deliver).
Remind the maintainer to post it; they post it themselves. Read "Past announcements" at the end of this file first.

- **The maintainer writes the Reddit post in their own words.** r/selfhosted readers spot and dislike AI-written posts,
  and the post's flair must say whether AI was used (3.8.0: an AI-written post under the "No AI" flair drew a mod-bot thread
  on top and few upvotes). Collect the material into the scratchpad (give the full path), not a finished post:
  - title ideas that name the main benefit, not the version (e.g. "Folder sharing with password and expiry is back in PiGallery2"),
  - one line on what PiGallery2 is and isn't next to Immich / PhotoPrism: uses your folders as they are, read-only, no ML, runs on a Pi,
  - 3-5 user-facing highlights from the release notes, and the breaking changes in one line,
  - one image or GIF of the headline feature (`docs/assets/`),
  - 1-2 concrete questions for readers (e.g. which feature should become an official extension), to put in the post itself,
  - links: the release, its discussion, the demo, and the closing line: free and open source, built in spare time,
    [GitHub Sponsors](https://github.com/sponsors/bpatrik) / [Ko-fi](https://ko-fi.com/pigallery2) if it's useful to you.
  If the maintainer still wants a drafted post, say it needs the sub's AI-assisted flair.
- Before posting, check the sub's current self-promotion and AI rules and its flairs.
- Timing: a weekday, about 14:00-16:00 UTC (morning in the US). Reddit ranks a post in its first hour or two, so the
  maintainer should be around then to reply. Open the demo (it sleeps when idle) right before posting, so the first
  visitors don't wait; don't put a "slow first load" warning in the post.
- Where: r/selfhosted, the selfh.st newsletter (submit the release to its weekly roundup), and a Ko-fi post
  (keeps the Ko-fi feed alive).
- Length limits: the selfh.st form (https://selfh.st/submit/) takes at most 200 characters, and a Ko-fi post at most 800.
  Draft a separate short version for each (count with `node`), and leave the Ko-fi link out of the Ko-fi post.
- Listings (since 2026-11): PiGallery2 is listed on [The Noted Wire](https://noted.lol/wire/) (description max 500
  characters) and [AlternativeTo](https://alternativeto.net/) (plain text: emoji break there). When the release adds a
  headline feature or changes a claim (read-only, formats, platforms), remind the maintainer to update both descriptions.
- Expectations: release reactions and GitHub traffic (Insights → Traffic, UTC, lags about a day) come in over days;
  judge them after 2-3 days, not on release day.

## 9. Back to edge

- Bump master to the next patch prerelease: `npm version X.Y.(Z+1)-edge --no-git-tag-version`
  (commit `Version bump to X.Y.(Z+1)-edge`); the next release decides whether it becomes a minor or major.
- Reset `RELEASE_NOTES.md` to its top comment and the five empty headings (Breaking changes, Main new features,
  Under the hood, Further changes, Bug fixes), in the same commit. Edge never opens the "What's new" popup by itself.
- Wrap up with what was released, links (release, Docker Hub), and anything left open.
- A few days after the release (or at the next release's step 8c, if nobody did it then), ask how the announcement went and
  add a line to "Past announcements": reactions, Reddit views / upvotes / comments, and what to do differently.

## Improving this checklist

When the maintainer changes the process during a release, update this file in the same session.

## Past announcements

- 3.8.0 (2026-11-18): GitHub release 2 reactions on day 1 (3.0.0: 12, 2.0.0: 24 in total). r/selfhosted: 9.9K views,
  14 upvotes, few comments, all from happy long-time users. The post was AI-written under the "No AI" flair (mod-bot AI thread
  on top), had a version-number title and a changelog body, never said why to pick it over Immich, warned about a 60 s demo
  load, and asked for feedback only in a comment 12 hours later. The 13k-character release notes opened with breaking changes and had no image.
