# Agent Notes

## Main Goal

- Keep this fork as the integration base when bringing in useful upstream changes.
- Fetch the original repository as an `upstream` remote and fetch only the upstream branches or pull-request refs needed for review.
- Create local working branches from this fork for candidate changes. Port compatible commits with cherry-picks; when histories or fork-specific changes differ, adapt the patch locally instead of merging the whole upstream branch.
- Preserve existing fork commits and uncommitted user changes. Validate each port with focused tests before considering it complete.

## Upgrade Handoff

- Steps 0–3 of [UPGRADE_PLAN.md](docs/fork-features/UPGRADE_PLAN.md) are merged. Step 4 is completed and validated on `upgrade/node-24` (awaiting merge), based on `master` at `de0ce1c4` (the Angular 22 merge). Check branch/merge state before starting Step 5 and base it on the latest completed step, rather than the original `stack-upgrade` baseline.
- Step 4 validation on Node 24.21.0 / npm 11.19.0 passed: backend 635 tests on SQLite and MariaDB, Karma 145 tests, all 16 locale builds, seven Cypress specs (18 passing, 12 intentionally pending documentation tests), and nine automated Brave smoke checks. All three amd64 Dockerfiles build and pass diagnostics; native SQLite/bcrypt and HEIC/AVIF/JPEG/PNG decoding pass. Detailed results are in the upgrade plan and [Techdebt.md](docs/fork-features/Techdebt.md). Temporary `/tmp/pg-node24-*` harnesses and logs are local artifacts; future runs must not assume they exist. Arm64 image builds remain a CI check.
- Angular 22.2.1 requires TypeScript 6; this project pins 6.0.3. The backend uses NodeNext settings while emitting CommonJS; frontend configs use bundler resolution. ngx-bootstrap is now 22.0.0 with signal APIs and direct module imports; the app retains zone.js. A separate zoneless sub-plan is in the upgrade plan. Hammer integration was removed upstream and replaced with pointer gestures; Angular animations remain follow-up work.

## Project Setup

- Use Node.js 24 (`nvm use`, using `.nvmrc` at 24.21.0). The project supports Node `>=24.15.0 <25` and npm `>=11.19.0 <12`; install the pinned npm with `npm install --global npm@11.19.0`, then run `npm ci`. Native modules such as `better-sqlite3` must match the active Node ABI (137 on Node 24).
- To run the local app, build the English frontend with `npm run build-en`, then start the backend with `npm start -- --Server-port=8081`; open `http://localhost:8081/`. The backend serves the built frontend. Do not change Angular's serve configuration for this workflow.
- Despite its name, `npm run build-en` currently builds all locales: the Gulp frontend command does not forward the language filter. Check `dist/<locale>/index.html` outputs before scheduling a redundant full-locale build.
- TypeScript under `src/` is authoritative. `npm run build-backend` compiles it; avoid hand-editing generated JavaScript.
- Backend tests run with `npm run test-backend`. To narrow Mocha tests, append a grep, for example `npm run test-backend -- --grep UploadRouter`.

## Running Tests (for AI agents)

- New terminals do not inherit Node 24. Prefix commands with `source ~/.nvm/nvm.sh && nvm use >/dev/null &&`; otherwise `better-sqlite3` fails with a `NODE_MODULE_VERSION` mismatch.
- Backend (Mocha): DB tests run on SQLite always and on MySQL only when one is reachable. Without MySQL, `mysql` "before all" hooks fail with `ECONNREFUSED`; that is environmental, not a regression.
- MySQL/MariaDB for tests: a local container `pigallery-db` (MariaDB 11.4, `127.0.0.1:3306`, user `pigallery`, password `password`) may exist; check with `podman exec pigallery-db healthcheck.sh --connect --innodb_initialized`. Run with `MYSQL_HOST=127.0.0.1 MYSQL_PORT=3306 MYSQL_USERNAME=pigallery MYSQL_PASSWORD=password TEST_MYSQL=true npm run test-backend`. Tests drop and recreate `pigallery2_test`; never point them at a database with real data.
- `.mocharc.js` loads the ignored `test/setup-local.js`. Inspect it before choosing test connection settings: local assignments can override command-line `MYSQL_*` environment variables. Preserve the user's local setup. When using a temporary setup with `--no-config`, retain `--recursive --timeout=20000` and explicitly exclude `test/folder-reset.js`; the script's basename-only exclusion does not match that path.
- The full backend suite on both engines takes several minutes; redirect to a log (`> /tmp/pg-tests.log 2>&1`) and grep `passing|failing` plus `^\s+[0-9]+\) ` for failures instead of piping live output.
- Mocha can remain alive after its final totals (Techdebt T5). Capture the runner PID/process group, verify the complete result, then stop only processes started for that run.
- Frontend (Karma): no Chrome is installed; use Brave via `CHROME_BIN=/usr/bin/brave-browser-stable npx ng test --watch=false`. Narrow with `--include='src/frontend/app/ui/timeline/**/*.spec.ts'` (repeatable).
- `ng test --watch=false` prints `TOTAL: N SUCCESS` but does not exit. Do not pipe it through `tail`/`grep` (they wait forever). Run it in the background writing to a log, capture its PID/process group, poll for the final `TOTAL`, then stop only that run's processes.
- `karma.conf.js` resolves the Angular Karma plugin through `@angular-builders/custom-webpack`, because `@angular-devkit/build-angular` is only installed nested there; the plugin must be the builder's own instance. Keep it that way when touching dependencies.
- Without a browser, type-check frontend specs with `npx tsc -p src/frontend/tsconfig.spec.json --noEmit` (templates are not checked; `npm run build-en` covers them).
- End-to-End (Cypress):
  - `start-e2e-server` runs on port 8080 (`node ./test/folder-reset test/e2e && node ./src/backend/index --config-path=test/e2e/config.json --Database-dbFolder=test/e2e --Server-port=8080 --Users.suppressDefUserWarn=true`).
  - **`ELECTRON_RUN_AS_NODE=1` gotcha**: The assistant environment sets `ELECTRON_RUN_AS_NODE=1`. When Cypress runs Electron, it treats Electron as raw Node.js and crashes on flags like `--no-sandbox`. **Always prefix Cypress commands with `unset ELECTRON_RUN_AS_NODE &&`**.
  - **Sandbox / Xvfb gotcha**: Cypress headless requires X11/Xvfb display support (`spawn Xvfb ENOENT` occurs inside sandboxes). Use the tool's sandbox escalation option (`sandbox_permissions: "require_escalated"` with `exec_command`).
  - **Port 8080 conflict**: Podman container `src_searxng_1` might bind host port 8080. Prefer a separate backend on an available port and override `CYPRESS_baseUrl`. If temporarily stopping the container is necessary, restore it after testing.
  - Run specific spec: `source ~/.nvm/nvm.sh && nvm use >/dev/null && unset ELECTRON_RUN_AS_NODE && npx cypress run --spec test/cypress/e2e/share.cy.ts`.
  - Full suite: `source ~/.nvm/nvm.sh && nvm use >/dev/null && unset ELECTRON_RUN_AS_NODE && npm run cypress:run`.
  - Overriding target server: Pass `CYPRESS_baseUrl=http://localhost:8081` to run Cypress specs against another running instance (such as the smoke test server on port 8081).
  - Cypress 15.19.0 is required for TypeScript 6; Cypress 14 hardcodes deprecated `downlevelIteration`. A temporary `setupNodeEvents` browser definition works for Brave with `family: 'chromium'`, `name: 'chromium'`, `channel: 'stable'`, the installed browser version, and `/usr/bin/brave-browser-stable`; run with `--browser chromium`. Configs outside the repo need explicit project/support paths. Resolve all of these paths consistently: mixing `/home/...` symlinks and `/mnt/...` real paths can trigger TS 6 `rootDir` errors.
- Browser checks: build with `npm run build-en`, start the backend on 8081, and drive it with the integrated browser tools. Timeline/Folders client state is in memory, so test Back restore with in-app navigation, not full reloads.
- If the integrated browser is unavailable, use automated browser smoke checks and record that distinction. For upload checks, copy demo media into an isolated fixture with separate config/database/cache paths and enable uploads there. Timeline Back checks must restore a nonzero scroll position in the same document; lazily rendered gallery items may require repeated scrolling before assertions.
- If another server already holds 8081, start a second one on 8082 instead of killing it. When the integrated browser tab is not visible (`document.visibilityState === 'hidden'`), `requestAnimationFrame` and animations pause and Playwright clicks/keys never complete; use `page.evaluate(() => el.click())` and verify viewer animations in a visible tab.

## Agent Learnings & Gotchas (Framework Upgrades & Core Architecture)

- **Root `tsconfig.json` vs CommonJS Backend**:
  - `ng update` attempts to set `"moduleResolution": "bundler"` in root `tsconfig.json`.
  - The backend remains CommonJS, so bundler resolution must not be applied to the root config. Since Step 3 it uses `"module": "NodeNext"` / `"moduleResolution": "NodeNext"`; absence of a package ESM `type` preserves CommonJS output. Do not restore deprecated `node` resolution or `downlevelIteration` under TS 6.
  - Shared options are in `tsconfig.base.json`. Frontend app/spec configs inherit that base independently of backend settings and use `bundler`/`ES2022`. Keep strict Angular template checking in the frontend config and frontend sources excluded from the backend compile.
  - TS 6 defaults differ: retain explicit `rootDir`, `types`, and `strict: false` alongside the existing `noImplicitAny: true`. Callable CommonJS modules need default imports; mocks must mutate the module itself, rather than the read-only namespace wrapper. `tslib` is a direct runtime dependency for emitted helpers.
- **Angular 22 & zone.js / ngx-bootstrap**:
  - Keep `provideZoneChangeDetection()` and explicit `ChangeDetectionStrategy.Eager` to preserve the app's current rendering behavior. Keep `withXhr()` for upload progress; Angular 22 otherwise defaults to fetch.
  - ngx-bootstrap **22.0.0** uses signal inputs and direct module imports (no `forRoot()`). The published 21.2 guide prescribes zoneless, but the inspected v22 implementation has no bootstrap assertion and uses explicit render notifications. Retaining zone.js is a local compatibility choice; exercise all Bootstrap controls when updating this combination.
  - Do not revert to ngx-bootstrap 21.0.1 on Angular 22: its `ComponentFactoryResolver` dependency was removed. ngx-toastr **20.0.5** still needs a scoped Angular common/core peer override; verify a visible toast and remove the override when a compatible release exists.
- **Angular Tooling Dependency Pins**:
  - Keep `@angular-devkit/schematics` and `@schematics/angular` aligned with the CLI (currently `22.2.1`). ng-icons has unbounded peer ranges; inspect `npm ls` after updates.
  - `typescript-eslint` **8.71.1** supports TypeScript 6. Check compiler support when updating lint tooling.
  - Keep the obsolete `marked/marked.min.js` entry out of Angular's global scripts. ngx-markdown imports its supported Marked peer directly.
  - ngx-markdown 22's optional `marked-katex-extension` peer must be installed for webpack to resolve its dynamic import, even when math rendering is unused.
  - custom-webpack 22 uses jiti for build configs. Its migration removed ts-node, but this project still needs **10.9.2** to load `gulpfile.ts`; do not remove it merely because the builder no longer needs it. ts-node was checked with TS 6 and Node 24. Since Step 4 the release backend uses plain `tsc` with `tsconfig.release.json`, because gulp-typescript did not preserve CommonJS emission under NodeNext.
- **Angular 22 Type Checking and Gestures**:
  - A resize handler with no parameters must use `@HostListener('window:resize')`, without an event argument.
  - Interfaces in decorated frontend classes need explicit type-only imports under TS 6 to avoid nonexistent runtime exports. Do not change runtime class imports used as injection tokens to type-only imports.
  - Angular removed its Hammer APIs in v22. `LightboxGesturesDirective` now handles pointer capture, swipe/pan/pinch/tap and cancellation only on the lightbox gesture surface. Preserve its interactive-child exclusions and regression tests.
- **Backend Tests Need a Built Frontend**:
  - Build the frontend before running the full backend suite. `PublicRouter` sharing tests read `dist/en/index.html` and fail with `ENOENT` if it is absent.
- **Known SQLite Search Issue (Techdebt B8)**:
  - Literal `_` / `%` searches can miss matches because escaped LIKE patterns lack an explicit SQLite `ESCAPE` clause. Step 2 reproduced this in unchanged backend code: `IMG_5910.jpg` missed while `5910` matched. Fix separately with regression coverage for both database engines.
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
- **Node 24 / npm and Docker native builds**:
  - Keep the Node 24 minimum at 24.15.0 for Angular 22. `.nvmrc` pins the validated patch; CI and Docker use npm 11.19.0. Node 22 is no longer supported by this fork.
  - Angular DevKit 22 has an optional Chokidar 5 peer. Pin `chokidar` 5.0.0 directly: regenerating the lockfile can otherwise drop its nested copies and resolve the peer to Mocha's Chokidar 4, producing an invalid tree. Check `npm ls --all` after lockfile changes. npm 12 is deferred: its new default blocks dependency install scripts; review explicit approvals before removing the npm <12 cap (Techdebt T7).
  - Sharp 0.35.5 no longer builds itself during `npm install` / `npm rebuild`. Docker explicitly runs its `build` script. It needs libvips >=8.18.7; `docker/build-libvips.sh` builds the pinned, checksum-verified version with the distribution codec libraries and HEIC support. Preserve `/usr/local/lib`, its loader path and the Docker context exception in `.dockerignore`.
  - Official Node 24 images do not support ARMv7. Build amd64 and arm64 images; Raspberry Pi deployments require a 64-bit OS.
- **Git Operations in Sandbox**:
  - `.git` is protected/read-only in standard sandbox mode. Git mutations require the tool's sandbox escalation option (`sandbox_permissions: "require_escalated"` with `exec_command`).

## Security Context

- Security remediation snapshot from 2026-10-06 (Node 24 migration): `npm audit --omit=dev` reports 0 vulnerabilities.
- Full `npm audit` reports 30 advisories (1 low, 7 moderate, 20 high, 2 critical), reduced from 36 after removing the obsolete release compiler in Step 4; all remaining advisories are in devDependencies/tooling, including webpack build/serve dependencies, Karma, mocha, cypress, coveralls, nyc and gulp. Angular is now 22.2.1, with TypeScript 6.0.3.
- Uploads are authenticated and role-gated. Multer uses memory storage; the current parser limits each file to 50 MiB and each request to 10 file parts. Keep these bounds in mind when changing upload behavior; concurrent requests can still consume significant memory.
- Security review also flagged implicit cookie/CSRF policy and no visible login throttling. Treat these as follow-up review items; deployment proxy and HTTPS configuration affect the right fix.
