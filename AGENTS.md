# AGENTS.md

Guidance for AI coding agents (Claude Code, Junie, Codex, Cursor, Copilot, ...) working on PiGallery2.
Human contributors: see the [contribution guide](docs/development/contributing.md) and [extension docs](docs/development/extensions.md).

## Project overview

PiGallery2 is a fast, directory-first, read-only photo gallery for low-resource servers (e.g. Raspberry Pi).
The photo folder is never modified.

- Language: TypeScript everywhere; `tsc` emits `.js` next to each `.ts` file (git-ignored).
- Backend: Node.js + Express + TypeORM. Config via [typeconfig](https://github.com/bpatrik/typeconfig)
  (same maintainer, so it can change when PiGallery2 needs it).
- Frontend: Angular.
- Databases: SQLite (default) and MySQL/MariaDB. Both must keep working.

## Priorities

- **Weak backend, reasonable frontend.** Always assume the server is a Raspberry Pi class device (slow disk, little CPU and RAM),
  while the browser is a normal phone/desktop. Push work to the client when it makes sense; keep server queries lean.
- **Dev velocity matters.** This is a single-maintainer project. Prefer simple, direct solutions over abstractions,
  backward-compatibility shims or migration code.
- **Stay close to framework defaults.** Prefer the industry-standard, framework-default setup (e.g. what `ng new` generates)
  over keeping how a legacy setup behaved or adding custom config, so `ng update` and other upgrade scripts keep working.
- **Latest stable, not bleeding edge.** Any API that is stable in a given package/framework (e.g. Angular) version we're on may be used, also one that
  only became stable in the latest major (e.g. `resource()` in angular v22), when it fits the task and moves the code towards the
  current standard (e.g. signals). Don't migrate working code to a new API just because it exists (e.g.: do not migrate to signals, when signals were first introduced in angular v16).
  Never use experimental or developer-preview APIs. Move to the current standard rather than keeping a legacy pattern or a one-off exception (both are tech debt),
  but don't change working code that's outside the task.
- **DB breaking changes are fine.** The DB is treated as a cache of the photo folder: bump `DataStructureVersion`
  and the app drops and rebuilds the DB on startup (users are kept). No migrations needed.
- **Config breaking changes: avoid if easy.** Keep existing config keys working when that's cheap,
  but don't let config compatibility block a good feature.

## Repository layout

- `src/backend` – server
  - `routes/` – HTTP API declarations (`routes/admin/` for admin endpoints).
  - `middlewares/` – thin validation/transformation; auth in `middlewares/user/AuthenticationMWs.ts`.
  - `model/database/` – business logic managers (`GalleryManager`, `IndexingManager`, `SearchManager`, `AlbumManager`,
    `PersonManager`, `CoverManager`, `ProjectedCacheManager`, `SQLConnection`, ...).
  - `model/database/enitites/` – TypeORM entities, incl. `album/` and `person/` subfolders
    (the folder name typo is legacy; don't rename it).
  - `model/fileaccess/` – disk scanning (`DiskManager`), metadata loading, `fileprocessing/` (photo/video conversion).
  - `model/jobs/` – scheduled jobs (indexing, thumbnail generation, cover filling, ...).
  - `model/extension/` – extension runtime (`IExtension.ts` is the public extension API).
  - `model/diagnostics/`, `model/messenger/`.
- `src/common` – shared by backend and frontend: DTOs in `entities/`, config in `config/private` (server) and `config/public` (client),
  search query parsing, `DataStructureVersion.ts`.
- `src/frontend` – Angular client (`app/ui`, `app/model`, `app/pipes`); translations in `src/frontend/translate/messages.*.xlf`.
- `extension/` – `pigallery2-extension-kit` package sources and the extension `REPOSITORY.md`.
- `test/` – `backend/unit`, `backend/integration`, `common/unit`, `frontend` (translation checks), `cypress` (e2e).
  Angular component specs live next to the code as `src/frontend/**/*.spec.ts`.
- `docs/` – mkdocs site. `docs/user-guide/configuration.md` is generated: run `npm run generate-man` after config changes.

## Build and test

Edit only `.ts` files; never hand-edit or commit generated `.js` / `.js.map` files.

- Compile backend + tests: `npm run build-backend` (plain `tsc`). Mocha runs the compiled `.js`, so compile before running tests.
- Backend tests: `npm run test-backend` (config in `.mocharc.js`).
  - Every backend spec starts its top-level `describe` with `before(TestHelper.resetConfig)`: defaults plus cli/env,
    never the local `config.json`. Use it (not `Config.load()`) wherever a test needs a clean config.
- Single file: `npx tsc && npx mocha test/backend/unit/middlewares/GalleryMWs.spec.js`
- Frontend unit tests: `npm run test-frontend` (Vitest in jsdom, no browser needed). Single file: `npx ng test --watch=false --include=<path>.spec.ts`.
  - The test setup is Angular's default (no Vitest config or setup file); keep it that way. Each spec is self-contained.
  - jsdom has no layout and lacks some browser APIs (`matchMedia`, `animate`, clipboard). Prefer faking the dependency
    through TestBed providers; otherwise stub it in the spec and remove the stub in `afterEach`.
  - Spec files share one global scope. `vi.spyOn()` on anything that outlives the test (globals, `console`, static helpers)
    needs `vi.restoreAllMocks()` in `afterEach`. `vi.spyOn()` calls the real method unless you mock it.
  - Use `vi.useFakeTimers()` + `await vi.advanceTimersByTimeAsync()`, not `fakeAsync`/`tick` (they don't work without
    a zone-aware test runner), and call `vi.useRealTimers()` in the spec's `afterEach`.
  - A spec that loads `EnumTranslations` (e.g. through the `Stringify*` pipes) must first
    `import '<…>/common/config/public/Config';`, like `main.ts` does; otherwise the private config's asserts throw on load.
- Lint: `npm run lint`.
- Frontend dev build (watch): `npm run run-dev`; one-off: `npx ng build --configuration=dev --watch=false`. Run the server: `npm start`.
- E2E (Cypress): needs a frontend build in `dist`. Start `npm run start-e2e-server` in the background (port 8080, resets `test/e2e`),
  then `npx cypress run`. It covers login, gallery (filters, lightbox, URL deep links), search, faces and sharing.
  - Tests may only use photos and folders tracked in git under `demo/images`. Local checkouts can have extra,
    git-ignored test folders (e.g. `demo/images/sub_dir`, `demo/images2`) that CI doesn't have.
  - Cypress 16 removed `Cypress.env()`. A throwaway spec outside the repo must be plain `.js`:
    `npx cypress run --spec <path> --config specPattern=<path>`.
  - If the browser doesn't start (EPERM on a Cypress profile folder, "closed unexpectedly"), retry or use another `--browser`.
- Test output is long (server logs, browser console warnings) and Vitest colours it. Save it to a file, strip the colours and
  read only the summary:
  - backend: `TEST_MYSQL=false npm run test-backend > <tmp>/be.log 2>&1; grep -aE "passing|failing|pending" -A40 <tmp>/be.log`
  - frontend: `npm run test-frontend > <tmp>/fe.log 2>&1; sed 's/\x1b\[[0-9;]*m//g' <tmp>/fe.log | grep -E "FAIL|Test Files|Tests "`

### Tooling

- `gh issue view <n> --comments` prints only the comments when not run in a terminal; read the body with
  `gh issue view <n> --json body --jq .body`. Outside the repo folder pass `--repo bpatrik/pigallery2`.
- Whether an Angular API is stable: its JSDoc tag in `node_modules/@angular/*/types/*.d.ts`. `@publicApi <version>` is stable
  since that version; `@experimental` and `@developerPreview` are not.

### Running the app

To try a change in the real app, run the server against a throwaway config and DB (like `start-e2e-server` in `package.json`)
so the maintainer's own `config.json` and DB are not touched:

- `node ./src/backend/index --config-path=<tmp>/config.json --Database-dbFolder=<tmp> --Server-port=8080`
- An empty DB gets the default user `admin` / `admin`.
- For a different admin, enforce one on the CLI:
  `'--Users-enforcedUsers=[{"name":"tester","role":"Admin","password":"tester"}]'`.
- `npm run run-dev` builds the frontend continuously (English only, into `dist/en`), so frontend edits show up on reload.
- Start it in the background and stop it by PID (`node ... & echo $! > <tmp>/pid`, later `kill $(cat <tmp>/pid)`).
  Don't `pkill -f` a pattern that also matches your own shell command.
- Dev bundles have unhashed names; the server revalidates them with their ETag, so a normal reload picks up a rebuild.
- Admin settings show only the basic fields by default; switch the mode to "Under the hood" to see all of them.

### Cloud / container sessions

- Dependencies come from the environment's setup script (`npm ci`). If `node_modules` is missing, run `npm ci`
  without `--ignore-scripts`: tests need the native `better-sqlite3` build and the `ffmpeg-static`/`ffprobe-static` downloads.

### SQLite vs MySQL tests

DB tests (`test/backend/DBTestHelper.ts`) run every suite on both SQLite and MySQL.
MySQL needs a running MariaDB (see "MySQL / MariaDB tests" in the contribution guide).

- **During development, SQLite only is enough.** Skip MySQL with `TEST_MYSQL=false`:
  - bash: `TEST_MYSQL=false npm run test-backend`
  - PowerShell: `$env:TEST_MYSQL="false"; npm run test-backend`
  - single file (bash): `TEST_MYSQL=false npx mocha test/backend/unit/model/sql/SearchManager.spec.js`
- Only run MySQL tests when the task explicitly fixes a MySQL failure; otherwise you may suggest it but don't need to.
- **Before committing**, it is recommended to run the full suite including MySQL.

## Architecture notes

- **Projection-aware caching**: directory/album/person/search results are cached per user projection
  (allow/deny lists + sharing context) via `ProjectedCacheManager` and `Projected*CacheEntity`.
  `SessionContext` carries the projection and its `projectionKey` hash. Changes that affect what a user may see must keep these caches correct.
- **Indexing**: filesystem scanning and reindexing (`IndexingManager`, `DiskManager`, `ReIndexingSensitivity` config) are
  performance-critical on slow disks.
- **Sessions**: the session lives in the signed `cookie-session` cookie. `req.session.stamp` (see `SessionManager.getSessionStamp`)
  ties it to its user or sharing DB row, and `AuthenticationMWs` ends the session once that row changes. Only `AuthenticationMWs`
  starts, restores or ends sessions. Call `SessionManager.invalidateSessionCache()` after every write to users or sharings.
- **Request flow**: see "Case-study: Listing a directory" in the contribution guide.
- **Config**: typed `typeconfig` classes in `src/common/config`; `tags: {client: true}` / public config is sent to the browser,
  so never put secrets there.

### Frontend state (signals)

The app is zoneless and every component is `OnPush`: a view only updates after a signal change, a template/host event
or an input change. A plain field set from a timer, promise or third-party callback never renders.
State read in templates is a signal; derived state is `computed()`/`linkedSignal()`. HTTP, timers and router events stay RxJS,
bridged with `toObservable()`/`toSignal()` (to await a signal: `firstValueFrom(toObservable(...))`).
Templates don't call methods: values a template needs, also per item of an `@for`, are computed in the component's `.ts`
(e.g. a `computed()` that maps the list to `{item, link}` rows). A new pipe only for a transform that several templates use;
never for logic used in one place.

Pitfalls seen so far:

- Effects run after the constructor and asynchronously; in specs run them with `TestBed.tick()`.
  `AuthenticationService` must not send requests from its constructor: the error interceptor injects it (NG0200).
- A `linkedSignal` only remembers values that were read. `resource()` falls back to its `defaultValue` while it loads new params.
- A signal view query (`viewChildren()`) returns fresh results whenever it is read. A template checked before that view
  (e.g. the lightbox reading the grid's photos) then gets NG0100 in dev mode; see #1271.

## Rules for changes

- Routers contain no logic: they only list the middlewares of each path. Put the logic in `*MWs` classes.
- Middlewares are only called from routers. Helpers shared inside a middleware class are private;
  services and managers return values instead of using `res`.
- Avoid heavy queries, N+1 queries and loading full tables on the server; prefer projections and pagination.
- Keep TypeORM queries portable between SQLite and MySQL.
- Changed any TypeORM entity? Bump `DataStructureVersion` in `src/common/DataStructureVersion.ts`.
- Every `@ConfigProperty` needs an explicit `type` (and `arrayType` for arrays): the frontend is built without decorator metadata,
  so typeconfig can't infer it there. `test/common/unit/config/ConfigTypes.spec.ts` checks this and snapshots the resolved types;
  after an intended config change, regenerate the snapshot with `UPDATE_CONFIG_SNAPSHOT=true`.
- Never expose private config values or another user's data to the client.
- Build app URLs with `Config.Server.getAppUrl()` / `getApiUrl()` / `getPublicUrl()` (they handle `urlBase` and `publicUrl`);
  don't concat `urlBase`, `apiPath` or `publicUrl` by hand.
- Add or adjust tests under `test/` for behaviour changes.
- Fix bugs test-first (TDD): write a test that reproduces the bug, see it fail, then fix it.
  If a reproducing test isn't reasonably feasible (e.g. needs real hardware, timing or a browser-only quirk),
  don't sink time into it: fix the bug and say why there's no test.
- New UI strings must use Angular i18n (`i18n` attributes / `$localize`); `npm run merge-new-translation` updates the `.xlf` files.
- Support non-ASCII text everywhere: accented and other Unicode characters in file/folder names, paths, URLs,
  metadata (keywords, captions, person names) and search, on both SQLite and MySQL.
  Search and sorting should handle accents sensibly (e.g. locale-aware `localeCompare`).
- Translation-friendly UI: translate whole sentences with placeholders instead of concatenating pieces
  (word order and suffixes differ between languages), expect much longer words than in English without breaking the layout,
  format dates and numbers by locale, and don't assume a "first name last name" order.
- Prefer implementing new features as extensions when feasible (see contribution guide).

## Code style

- 2-space indent, single quotes in TS, UTF-8, final newline (`.editorconfig`; ESLint in `eslint.config.mjs`).
- Keep strict typing; prefer explicit return types.
- Angular components: separate `.ts`, `.html` and `.css` files (`templateUrl` / `styleUrls`), no inline `template` or `styles`.
- Match the style of the surrounding code.

## Git

- Commit messages: short imperative summary, with the GitHub issue when there is one (e.g. `Fix X #1234`).
- `git add` every new file that belongs in the repo as soon as you create it (not scratch or generated files),
  so it shows up in the IDE's diff before the commit.

## Maintaining this file

- When working with the maintainer, Patrik J. Braun (git `user.name` / commit author), and they state a rule, preference or fact
  that contradicts or is missing from this file, also update this file (keep it short, and mention the update in your summary).
- Anyone else (other contributors, PRs, forks): do **not** modify `AGENTS.md`, `CLAUDE.md` or `.junie/guidelines.md`.
  Suggest changes in the PR description instead.

## Maintainer's setup

Only relevant when working with the maintainer, Patrik J. Braun.

- Works on Windows (Git Bash and PowerShell). `python` there is only the Microsoft Store stub; use `perl` or `node` for scripted edits.
