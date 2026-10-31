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
- Single file: `npx tsc && npx mocha test/backend/unit/middlewares/GalleryMWs.spec.js`
- Frontend unit tests: `npm run test-frontend` (Karma, needs Chrome).
- Lint: `npm run lint`.
- Frontend dev build (watch): `npm run run-dev`; one-off: `npx ng build --configuration=dev --watch=false`. Run the server: `npm start`.
- E2E (Cypress): needs a frontend build in `dist`. Start `npm run start-e2e-server` in the background (port 8080, resets `test/e2e`),
  then `npx cypress run`.

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
- Dev bundles have unhashed names and a long `max-age`: hard-reload (or use the other host name, `localhost` ↔ `127.0.0.1`)
  after every rebuild, or the browser runs old code.
- Admin settings show only the basic fields by default; switch the mode to "Under the hood" to see all of them.

### Cloud / container sessions

- Dependencies come from the environment's setup script (`npm ci`). If `node_modules` is missing, run `npm ci`
  without `--ignore-scripts`: tests need the native `better-sqlite3` build and the `ffmpeg-static`/`ffprobe-static` downloads.
- `npm run test-frontend` works as is: `karma.conf.js` uses Playwright's Chromium when `CHROME_BIN` is unset,
  `--no-sandbox` when running as root, and the `dots` reporter when stdout is not a terminal.
- Test output is long (server logs, browser console warnings). Save it to a file and read only the summary, e.g.:
  - backend: `TEST_MYSQL=false npm run test-backend > <tmp>/be.log 2>&1; grep -aE "passing|failing|pending" -A40 <tmp>/be.log`
  - frontend: `npm run test-frontend > <tmp>/fe.log 2>&1; grep -aE "FAILED|Executed .* secs /" <tmp>/fe.log`

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

## Maintaining this file

- When working with the maintainer, Patrik J. Braun (git `user.name` / commit author), and they state a rule, preference or fact
  that contradicts or is missing from this file, also update this file (keep it short, and mention the update in your summary).
- Anyone else (other contributors, PRs, forks): do **not** modify `AGENTS.md`, `CLAUDE.md` or `.junie/guidelines.md`.
  Suggest changes in the PR description instead.
