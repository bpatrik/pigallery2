# Agent Notes

## Main Goal

- Keep this fork as the integration base when bringing in useful upstream changes.
- Fetch the original repository as an `upstream` remote and fetch only the upstream branches or pull-request refs needed for review.
- Create local working branches from this fork for candidate changes. Port compatible commits with cherry-picks; when histories or fork-specific changes differ, adapt the patch locally instead of merging the whole upstream branch.
- Preserve existing fork commits and uncommitted user changes. Validate each port with focused tests before considering it complete.

## Project Setup

- Use Node.js 22 (`nvm use 22`). The project supports Node `>=22.12.0 <24`; native modules such as `better-sqlite3` must be built for the active Node ABI.
- To run the local app, build the English frontend with `npm run build-en`, then start the backend with `npm start -- --Server-port=8081`; open `http://localhost:8081/`. The backend serves the built frontend. Do not change Angular's serve configuration for this workflow.
- TypeScript under `src/` is authoritative. `npm run build-backend` compiles it; avoid hand-editing generated JavaScript.
- Backend tests run with `npm run test-backend`. To narrow Mocha tests, append a grep, for example `npm run test-backend -- --grep UploadRouter`.

## Running Tests (for AI agents)

- New terminals do not inherit Node 22. Prefix commands with `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null &&`; otherwise `better-sqlite3` fails with a `NODE_MODULE_VERSION` mismatch.
- Backend (Mocha): DB tests run on SQLite always and on MySQL only when one is reachable. Without MySQL, `mysql` "before all" hooks fail with `ECONNREFUSED`; that is environmental, not a regression.
- MySQL/MariaDB for tests: a local container `pigallery-db` (MariaDB 11.4, `127.0.0.1:3306`, user `pigallery`, password `password`) may exist; check with `podman exec pigallery-db healthcheck.sh --connect --innodb_initialized`. Run with `MYSQL_HOST=127.0.0.1 MYSQL_PORT=3306 MYSQL_USERNAME=pigallery MYSQL_PASSWORD=password TEST_MYSQL=true npm run test-backend`. Tests drop and recreate `pigallery2_test`; never point them at a database with real data.
- The full backend suite on both engines takes several minutes; redirect to a log (`> /tmp/pg-tests.log 2>&1`) and grep `passing|failing` plus `^\s+[0-9]+\) ` for failures instead of piping live output.
- Frontend (Karma): no Chrome is installed; use Brave via `CHROME_BIN=/usr/bin/brave-browser-stable npx ng test --watch=false`. Narrow with `--include='src/frontend/app/ui/timeline/**/*.spec.ts'` (repeatable).
- `ng test --watch=false` prints `TOTAL: N SUCCESS` but does not exit. Do not pipe it through `tail`/`grep` (they wait forever). Run it in the background writing to a log, poll the log for `TOTAL`, then `pkill -f "ng test"`.
- `karma.conf.js` resolves the Angular Karma plugin through `@angular-builders/custom-webpack`, because `@angular-devkit/build-angular` is only installed nested there; the plugin must be the builder's own instance. Keep it that way when touching dependencies.
- Without a browser, type-check frontend specs with `npx tsc -p src/frontend/tsconfig.spec.json --noEmit` (templates are not checked; `npm run build-en` covers them).
- End-to-End (Cypress):
  - `start-e2e-server` runs on port 8080 (`node ./test/folder-reset test/e2e && node ./src/backend/index --config-path=test/e2e/config.json --Database-dbFolder=test/e2e --Server-port=8080 --Users.suppressDefUserWarn=true`).
  - **`ELECTRON_RUN_AS_NODE=1` gotcha**: The assistant environment sets `ELECTRON_RUN_AS_NODE=1`. When Cypress runs Electron, it treats Electron as raw Node.js and crashes on flags like `--no-sandbox`. **Always prefix Cypress commands with `unset ELECTRON_RUN_AS_NODE &&`**.
  - **Sandbox / Xvfb gotcha**: Cypress headless requires X11/Xvfb display support (`spawn Xvfb ENOENT` occurs inside sandboxes). Run Cypress with `BypassSandbox: true`.
  - **Port 8080 conflict**: Podman container `src_searxng_1` might bind host port 8080. If `start-e2e-server` fails with `EADDRINUSE`, run `podman stop src_searxng_1` during tests, and `podman start src_searxng_1` when finished.
  - Run specific spec: `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && unset ELECTRON_RUN_AS_NODE && npx cypress run --spec test/cypress/e2e/share.cy.ts`.
  - Full suite: `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && unset ELECTRON_RUN_AS_NODE && npm run cypress:run`.
  - Overriding target server: Pass `CYPRESS_baseUrl=http://localhost:8081` to run Cypress specs against another running instance (such as the smoke test server on port 8081).
- Browser checks: build with `npm run build-en`, start the backend on 8081, and drive it with the integrated browser tools. Timeline/Folders client state is in memory, so test Back restore with in-app navigation, not full reloads.
- If another server already holds 8081, start a second one on 8082 instead of killing it. When the integrated browser tab is not visible (`document.visibilityState === 'hidden'`), `requestAnimationFrame` and animations pause and Playwright clicks/keys never complete; use `page.evaluate(() => el.click())` and verify viewer animations in a visible tab.

## Agent Learnings & Gotchas (Framework Upgrades & Core Architecture)

- **Root `tsconfig.json` vs CommonJS Backend**:
  - `ng update` attempts to set `"moduleResolution": "bundler"` in root `tsconfig.json`.
  - Because the backend compiles to CommonJS (`"module": "CommonJS"`), TypeScript rejects `"bundler"` (`TS5095: Option 'bundler' can only be used when 'module' is set to 'es2015' or later`).
  - The root `tsconfig.json` MUST keep `"moduleResolution": "node"` while the backend remains CommonJS. Since Step 2 it excludes `src/frontend/**/*`; frontend app and spec configs override resolution to `bundler` and reset `exclude` so their own files remain included. Angular 21 package exports require this separation already, before the TS 6 backend work in Step 3.
- **Angular 21 & zone.js / ngx-bootstrap**:
  - Keep `provideZoneChangeDetection()` in the application bootstrap to preserve zone.js behavior; Angular 21 defaults to zoneless.
  - `ngx-bootstrap` is pinned to `21.0.1`. Releases `21.2+` require zoneless change detection, change inputs to signals, and remove `forRoot()`; don't bump to them without a separate migration.
- **Angular 21 Host Listener Type Checking**:
  - A resize handler with no parameters must use `@HostListener('window:resize')`, without an event argument.
  - Hammer pinch callbacks receive gesture objects, not DOM Events. The host-listener bindings use `$any($event)` while retaining the typed `{scale: number}` handler parameters.
- **Backend Tests Need a Built Frontend**:
  - Build the frontend before running the full backend suite. `PublicRouter` sharing tests read `dist/en/index.html` and fail with `ENOENT` if it is absent.
- **Leaflet & MarkerCluster Typing**:
  - `@bluehalo/ngx-leaflet-markercluster` 20+ no longer ambiently exports/imports the `leaflet.markercluster` module.
  - Any file referencing `MarkerClusterGroup` or `L.markerClusterGroup` must explicitly include `import 'leaflet.markercluster';`.
- **Angular Block Control-Flow Schematic (`@if`, `@for`, `@switch`)**:
  - The automated migration (`ng g @angular/core:control-flow`) fails if there is stray whitespace or text nodes between `[ngSwitch]` cases. Strip intermediate text nodes beforehand.
  - Check transformed `track` expressions: schematics may produce `track trackByIndex(i, $item)` when `trackBy` existed; simplify to `track $index` or `track item.id` if compilation flags method signature mismatches.
  - Audit templates for unclosed or malformed HTML tags (like unclosed `<option>` tags), which cause template parse errors when converted to block syntax.
- **`ErrorInterceptor` & 401 Infinite Logout Loop**:
  - An HTTP 401 from endpoints like `/user/me` (session check) or `/login` (bad credentials) must NOT trigger `authService.logout()`. If `logout()` is called, it attempts to fetch the sharing session (`getSessionUser()`), which calls `/user/me`, resulting in 401, infinitely looping.
  - Keep 401 interceptor auto-logout guarded: only trigger logout if `authService.isAuthenticated()` is true and the request URL does not include `/user/me`, `/login`, or `/logout`.
- **Backend CLI Configuration Flags**:
  - Backend configuration uses `typeconfig`. Command-line flags map to nested keys with hyphens, e.g. `--Server-port=8081` and `--Upload-enabled=true`.
  - By default, `Upload.enabled` is `false`. When testing upload workflows against a standalone server instance, start with `--Upload-enabled=true`.
- **Git Operations in Sandbox**:
  - `.git` is protected/read-only in standard sandbox mode. All `git add`, `git commit`, `git checkout` operations must run with `BypassSandbox: true`.

## Security Context

- Security remediation snapshot from 2026-10-05 (Angular 21 migration): `npm audit --omit=dev` reports 0 vulnerabilities.
- Full `npm audit` reports 40 advisories (1 low, 14 moderate, 23 high, 2 critical), reduced from 48 after Step 1; all remaining advisories are in devDependencies/tooling, including webpack build/serve dependencies, Karma, mocha, cypress, coveralls, nyc and gulp. Angular is now 21.2.25, with TypeScript 5.9.3.
- Uploads are authenticated and role-gated. Multer uses memory storage; the current parser limits each file to 50 MiB and each request to 10 file parts. Keep these bounds in mind when changing upload behavior; concurrent requests can still consume significant memory.
- Security review also flagged implicit cookie/CSRF policy and no visible login throttling. Treat these as follow-up review items; deployment proxy and HTTPS configuration affect the right fix.
