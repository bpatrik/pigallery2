# AGENTS.md

Guidance for AI coding agents (Claude Code, Junie, Codex, Cursor, Copilot, ...) working on PiGallery2.
Human contributors: see the [contribution guide](docs/development/contributing.md) and [extension docs](docs/development/extensions.md).

## Project overview

PiGallery2 is a fast, directory-first, read-only photo gallery for low-resource servers (e.g. Raspberry Pi).
The photo folder is never modified.

- Language: TypeScript everywhere; `tsc` emits `.js` next to each `.ts` file (git-ignored).
- Backend: Node.js + Express + TypeORM. Config via [typeconfig](https://github.com/bpatrik/typeconfig).
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
- Frontend dev build (watch): `npm run run-dev`; run the server: `npm start`.

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
- **Request flow**: see "Case-study: Listing a directory" in the contribution guide.
- **Config**: typed `typeconfig` classes in `src/common/config`; `tags: {client: true}` / public config is sent to the browser,
  so never put secrets there.

## Rules for changes

- Avoid heavy queries, N+1 queries and loading full tables on the server; prefer projections and pagination.
- Keep TypeORM queries portable between SQLite and MySQL.
- Changed any TypeORM entity? Bump `DataStructureVersion` in `src/common/DataStructureVersion.ts`.
- Never expose private config values or another user's data to the client.
- Add or adjust tests under `test/` for behaviour changes.
- New UI strings must use Angular i18n (`i18n` attributes / `$localize`); `npm run merge-new-translation` updates the `.xlf` files.
- Prefer implementing new features as extensions when feasible (see contribution guide).

## Code style

- 2-space indent, single quotes in TS, UTF-8, final newline (`.editorconfig`; ESLint in `eslint.config.mjs`).
- Keep strict typing; prefer explicit return types.
- Match the style of the surrounding code.

## Git

- Commit messages: short imperative summary, with the GitHub issue when there is one (e.g. `Fix X #1234`).

## Maintaining this file

- When working with the maintainer, Patrik J. Braun (git `user.name` / commit author), and they state a rule, preference or fact
  that contradicts or is missing from this file, also update this file (keep it short, and mention the update in your summary).
- Anyone else (other contributors, PRs, forks): do **not** modify `AGENTS.md`, `CLAUDE.md` or `.junie/guidelines.md`.
  Suggest changes in the PR description instead.
