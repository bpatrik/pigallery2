# Platform upgrade plan

Status: Steps 0–2 completed and validated. Angular 21 is on the local
`upgrade/angular-21` branch; next is Step 3 (Angular 22).

## Goal

Bring the fork from Angular 19.2.15 (CLI 19.2.19, unsupported) to Angular
22.x. Then move to Node 24 and refresh npm. Then replace `openid-client` 5
and `fluent-ffmpeg`, and move to Express 5.

Hard constraints:

- Keep the existing architecture: the backend serves the built frontend,
  TypeORM managers/routers stay as they are, and there are no
  schema/`DataStructureVersion` changes.
- One upgrade step per branch, based on the latest completed upgrade step.
  The original baseline branch is `stack-upgrade`. Each branch merges only
  when its validation gate passes.
- Commit automatic migrations (`ng update`, schematics) separately from manual
  fixes, so the diffs are easy to review and later upstream cherry-picks can be
  adapted.
- Leave deprecated features in place unless they block a step. Record them in
  [Techdebt.md](Techdebt.md) instead.

## Starting state (before Step 0, 2026-10-05)

| Area | State |
|---|---|
| Bootstrap | `bootstrapApplication` in `src/frontend/main.ts`; all components are standalone; one `NgModule` (routing) |
| Templates | `strictTemplates` on; 44 files still use `*ngIf` / `*ngFor`; no `@if` / `@for` |
| Builder | `@angular-builders/custom-webpack` 19.0.1 for build, serve, extract-i18n and karma. Its only customisation is an `IgnorePlugin` for `config/private/Config` (`angular.webpack.js`) |
| Karma | `karma.conf.js` loads the Angular plugin through `custom-webpack`'s nested `@angular-devkit/build-angular` (see AGENTS.md) |
| TypeScript | Not a direct dependency; it comes in through Angular (`>=5.5 <5.9`). The root `tsconfig.json` is shared by the frontend and the CommonJS backend (`moduleResolution: node`, `downlevelIteration`) |
| i18n | 15 locales built from XLF |
| Deprecated APIs in use | HammerJS (`main.ts`, `app.component.ts`); `@angular/animations` `AnimationBuilder` (lightbox) |
| Angular libraries | ngx-bootstrap 19, @bluehalo/ngx-leaflet 19 (+ markercluster), ngx-markdown 19, ngx-toastr 19, ngx-cookie-service 19, ngx-device-detector 9, @ng-icons 31, ngx-clipboard 16, @ngx-loading-bar/core 7 |
| Overrides | `beasties` override; the note in `package.json` says to remove it after Angular 20 |
| Node | `engines: >=22 <24`; native modules: better-sqlite3 11.10, bcrypt 6, sharp 0.35 |
| Backend libs | express 4.22.3, openid-client 5.7.1 (+ stale `@types/openid-client` 3.x), fluent-ffmpeg 2.1.3 (archived) |

## Validation gate (every step)

1. `npx tsc -p src/frontend/tsconfig.app.json --noEmit` and
   `npx tsc -p src/frontend/tsconfig.spec.json --noEmit`
2. `npm run build-backend`
3. `npm run build-en`, then a build of every locale (catches i18n/XLF issues)
4. `npm run lint`
5. Backend Mocha on SQLite and MySQL (`pigallery-db` container), logged to a
   file
6. Karma via Brave (`CHROME_BIN=/usr/bin/brave-browser-stable`)
7. Cypress e2e (`start-e2e-server` + `cypress:run`)
8. Browser smoke test on port 8081: login, Folders, Timeline (including Back
   restore), lightbox (swipe/keys/animation), map, search, upload, share link,
   video playback
9. `npm audit --omit=dev`, with the result noted in AGENTS.md

## Steps

### Step 0 – Baseline and compatibility matrix

- [x] Run the full validation gate on current `stack-upgrade` / Node 22 and record any
      failures that already exist. (Validation passed: 0 failures; Mocha 635 passing on
      SQLite & MariaDB/MySQL, Karma 138 SUCCESS, build & lint clean, full gate passed).
- [x] Add `typescript` as a pinned direct devDependency, at the version
      currently resolved (`5.8.3`).
- [x] For Angular 20, 21 and 22, find the library versions whose peer ranges
      match (`npm view <pkg>@<ver> peerDependencies`). Check every library in
      the table above plus `@angular-builders/custom-webpack`,
      `angular-eslint`, `zone.js` and `typescript`. Fill in the matrix below.
- [x] For every library with no release for a target version, decide:
      upgrade, replace, remove, or a temporary `overrides` entry. Likely
      candidates: `ngx-clipboard`, `@ngx-loading-bar/core`.

Compatibility matrix (fill in during step 0):

| Package | Ng 20 | Ng 21 | Ng 22 | Notes |
|---|---|---|---|---|
| typescript | ~5.8.3 / ~5.9.0 | ~5.9.0 / ~6.0.0 | ~6.0.0 | Compiler-cli peer ranges: Ng 20 (`>=5.8 <6.0`), Ng 21 (`>=5.9 <6.1`), Ng 22 (`>=6.0 <6.1`). Directly pinned to `5.8.3` in Step 0, then `5.9.3` in Step 2 |
| zone.js | ~0.15.1 | ~0.15.1 / 0.16.3 | 0.16.3 | Ng 20 supports `~0.15.0`; Ng 21 & 22 support `~0.15.0 \|\| ~0.16.0` |
| @angular-builders/custom-webpack | 20.0.0 | 21.1.0 | 22.0.1 | Official stable releases exist for all three versions (blocks resolved) |
| angular-eslint | 20.7.0 | 21.4.0 | 22.5.0 | Regular major releases match Angular versions |
| ngx-bootstrap | 20.0.2 | 21.0.1 | 22.0.0 (requires zoneless review) | Step 2 retains 21.0.1: 21.2+ requires zoneless and signal inputs, incompatible with this step's constraints |
| @bluehalo/ngx-leaflet (+ markercluster) | 20.0.0 (cluster: 20.0.3) | 21.2.1 (cluster: 21.1.0) | 22.0.0 (cluster: 22.0.0) | Synchronized with Angular releases |
| ngx-markdown | 20.1.0 | 21.3.0 | 22.1.0 | Synchronized with Angular releases |
| ngx-toastr | 19.1.0 | 20.0.5 | 20.0.5 (overrides) | 19.1.0 peer is `>=16.0.0-0` (works on 20); 20.0.5 peer is `^21.0.0` (works on 21); for Ng 22, use npm overrides or local toast service |
| ngx-cookie-service | 20.1.1 | 21.3.1 | 22.0.0 | Synchronized with Angular releases |
| ngx-device-detector | 10.1.0 | 11.0.0 | 12.0.0 | Versioned independently (v10 for Ng 20, v11 for Ng 21, v12 for Ng 22) |
| @ng-icons/core, ionicons | 32.0.0 | 34.0.0 | 36.1.0 | Versioned independently (v32 for Ng 20, v34 for Ng 21, v36 for Ng 22) |
| ngx-clipboard | 16.0.0 | 16.0.0 | 16.0.0 | Unmaintained (peer is `>=13.0.0`, installs cleanly). Decision: replace with native `navigator.clipboard` or `@angular/cdk/clipboard` in Step 1 |
| @ngx-loading-bar/core | 7.0.1 | 7.0.1 | 7.0.1 | Peer is `>=16.0.0` (installs cleanly). Decision: retain 7.0.1 or replace with lightweight local progress bar component in Step 1 |

### Step 1 – Angular 19 → 20 (branch `upgrade/angular-20`)

- [x] `ng update @angular/core@20 @angular/cli@20` (commit as is).
- [x] Bump TypeScript, `custom-webpack`, `angular-eslint`, zone.js and the
      ngx-* libraries to the step 0 matrix versions.
- [x] Remove the `beasties` override and the related `notes` entry.
- [x] Check that `karma.conf.js` still resolves the builder's own Karma plugin.
- [x] Separate commit: run the control-flow migration
      (`ng g @angular/core:control-flow`), since `*ngIf` / `*ngFor` are
      deprecated from v20. Review the templates that use `else` / `trackBy`
      by hand.
- [x] Validation gate (Gates 1–9 passed: clean tsc, Mocha 635 passing on SQLite & MySQL, Karma 138 SUCCESS, Cypress 6/6 specs passing, browser smoke test on 8081 passing 8/8, 0 vulnerabilities in production audit).

### Step 2 – Angular 20 → 21 (branch `upgrade/angular-21`)

- [x] `ng update @angular/core@21 @angular/cli@21`, plus the matrix bumps.
- [x] Keep the webpack builder and Karma. Don't adopt the new project
      defaults (zoneless, Vitest) here.
- [x] Check the HammerJS and `@angular/animations` deprecation status. Act
      only if something is removed.
- [x] Validation gate (2026-10-05–06): frontend app/spec type checks, backend
      compile, production build of all 16 locales, and lint pass; Mocha
      **635 passing** on SQLite and MariaDB/MySQL; Karma **138 SUCCESS** in
      Brave; Cypress **6/6 specs** pass (**17 passing, 12 intentionally
      pending documentation screenshot tests**); additional Brave smoke
      **8/8 passing**; production audit **0 vulnerabilities**.

Implementation notes:

- Branch based on `master` at `5a7795c4`, which includes the merged Angular
  20 step and the original `stack-upgrade` baseline. Official migrations
  and dependency updates are committed separately from manual fixes.
- Angular framework/CLI **21.2.25**, TypeScript **5.9.3**, custom-webpack
  **21.1.0**, angular-eslint **21.4.0**, typescript-eslint **8.56.1**.
  The lint tool update is required for TypeScript 5.9. Angular schematic
  peers are pinned to 21.2.25 so ng-icons' unbounded peers cannot pull v22.
- The automatic migration adds `provideZoneChangeDetection()`. zone.js
  remains **0.15.1**. The matrix's initial ngx-bootstrap 21.2.2 choice was
  corrected to **21.0.1**, because the [21.2 breaking changes](https://github.com/valor-software/ngx-bootstrap/releases/tag/v21.2.0)
  require zoneless and remove APIs currently used by this app.
- Package exports in Angular 21 and ngx-bootstrap require `bundler`
  resolution for frontend app/spec configs. This part of Step 3 had to be
  brought forward: the root CommonJS backend compile retains `node`
  resolution and excludes frontend sources. Its TS 6 settings remain
  deferred. Node engines now require **>=22.12.0 <24**, matching Angular's
  Node 22 minimum; validation used Node **22.23.3**, npm **10.9.9**.
- Removed the obsolete `marked/marked.min.js` global script entry;
  ngx-markdown imports its supported Marked peer directly. Fixed stricter
  host-listener checks for parameterless resize handlers and Hammer pinch
  objects. HammerJS and `AnimationBuilder` are deprecated but still present
  in v21, so both are retained.
- The backend still serves `dist/<locale>`. `npm run build-en` currently
  builds every locale because the Gulp frontend command does not forward
  its language filter; all 16 `index.html` outputs were checked. The build
  reports the existing missing-translation warnings, the `pt-br` → `pt`
  locale-data fallback, and an initial-bundle warning (2.14 MB against the
  2 MB warning threshold; the 5 MB error threshold is not exceeded).
- The integrated browser was unavailable. Smoke checks used Cypress with
  an explicit Brave browser definition and `document.visibilityState ===
  'visible'`, on an isolated backend at **8081** with copied demo media,
  uploads enabled, and a Timeline navigation link. Checked login/Folders,
  Timeline month and nonzero scroll restoration through in-app Back,
  lightbox open/close, keyboard/swipe/pinch, map, search, upload, share,
  and advancing video playback. Screenshots were visually inspected.
  The existing full Cypress suite used the same server via
  `CYPRESS_baseUrl=http://localhost:8081`, leaving the service on 8080 intact.
- Initial PublicRouter failures were caused by missing `dist/en/index.html`
  before the build completed; the complete backend rerun passed. An existing
  SQLite search issue involving literal `_` / `%` was recorded as B8 in
  [Techdebt.md](Techdebt.md); the smoke search used `5910` successfully.
  Mocha and Karma runner processes remained alive after their final success
  totals and were stopped explicitly; test-process cleanup is recorded as T5.
- Full audit: **40 advisories** (1 low, 14 moderate, 23 high, 2 critical),
  all in devDependencies/tooling. Production audit remains zero.

Local validation artifacts: `/tmp/pg-angular21-build-en.log`,
`/tmp/pg-angular21-backend-final.log`, `/tmp/pg-angular21-karma-final.log`,
`/tmp/pg-angular21-cypress.log`, `/tmp/pg-angular21-smoke.log`, and
`/tmp/pg-angular21-audit-{prod,all}.json`. The temporary smoke spec/config
are `/tmp/pg-angular21-smoke.cy.js` and `/tmp/pg-angular21-smoke.config.cjs`;
screenshots are under `/tmp/pg-angular21-smoke-screenshots/`.

### Step 3 – Angular 21 → 22 (branch `upgrade/angular-22`)

- [ ] `ng update @angular/core@22 @angular/cli@22`, plus the matrix bumps.
- [ ] If TypeScript 6 is required: replace the deprecated `moduleResolution:
      node` and `downlevelIteration`. The frontend probably needs `bundler`
      and the backend `node16`/`nodenext`. The frontend already uses `bundler`
      and is excluded from the root compile since Step 2; finish separating
      backend settings instead of using `ignoreDeprecations`. Re-check
      `gulp-typescript` and `ts-node` against the new TypeScript.
- [ ] Resolve the ngx-bootstrap zoneless requirement before the planned v22
      bump: review signals and change detection as a separate sub-plan, or
      choose a replacement. Step 2 deliberately retains zone.js and 21.0.1.
- [ ] If `custom-webpack` has no v22 release, fall back to
      `@angular/build:application`. Replace the `IgnorePlugin` (for example
      by fixing the import or using `externalDependencies`), and adapt the
      backend static path for the `dist/<locale>/browser` layout. Treat this
      as a separate sub-plan.
- [ ] Validation gate.

### Step 4 – Node 24 and npm (branch `upgrade/node-24`)

Can start any time after step 1, since Angular 20+ supports Node 24.

- [ ] `engines` → `>=24 <25` (or `>=22 <25` during the transition);
      `@types/node` 24.
- [ ] Bump better-sqlite3 to a release with Node 24 prebuilds; rebuild bcrypt
      and sharp.
- [ ] Regenerate `package-lock.json` with npm on Node 24.
- [ ] Update the Docker base images, CI, and the Node instructions in
      AGENTS.md.
- [ ] Validation gate on Node 24 (and Node 22 if both stay supported).

### Step 5 – openid-client 5 → 6 (branch `upgrade/openid-client-6`)

- [ ] Before migrating, add a test for `OIDCAuthService.ts` with a mocked
      issuer covering discovery, the authorization URL, callback/code
      exchange, and userinfo/claims mapping.
- [ ] Rewrite against the v6 API (functional, ESM-only). The backend loads it
      through `require(esm)` (Node ≥ 22.12).
- [ ] Remove `@types/openid-client`.
- [ ] Run the test and do a manual login against a real or dev provider if
      one is available.

### Step 6 – Replace fluent-ffmpeg (branch `upgrade/ffmpeg-wrapper`)

- [ ] Pin down current behaviour: ffprobe metadata output for sample videos in
      the test fixtures, and the generated ffmpeg arguments for thumbnail and
      transcode jobs.
- [ ] Add a small typed `spawn` wrapper for ffmpeg/ffprobe behind
      `FFmpegFactory`. Keep `ffmpeg-static` / `ffprobe-static`.
- [ ] Port `MetadataLoader`, `PhotoWorker` and `VideoConverterWorker`; remove
      `fluent-ffmpeg` and its types.
- [ ] Compare against the recorded behaviour; manually check video thumbnails
      and transcode jobs.

### Step 7 – Express 4 → 5 (branch `upgrade/express-5`)

- [ ] Before upgrading, add route-matching tests for every path pattern:
      encoded names, nested folders, dots, extension filters, and trailing
      slashes.
- [ ] Rewrite the patterns that `path-to-regexp` v8 rejects:
  - `GalleryRouter.ts`: `:mediaPath(*\\.(…))` (8 routes) → `RegExp` routes,
    or a named wildcard plus an extension-check middleware.
  - `:directory(*)`, `:searchQueryDTO(*)`, `:value(*)`, `:file(*)` (Gallery,
    Sharing, Upload, Public routers) → `*name`; the value becomes `string[]`,
    so join it with `/` in one shared helper.
  - Bare wildcards: `'/gallery*'`, `'/search*'`, `'/share*'`,
    `'/node_modules*'`, `apiPath + '/*'`, `apiPath + '*'` (Public, Error,
    Logger routers).
- [ ] Review the other v5 changes: `req.query` is read-only, `req.body` is
      undefined without a parser, rejected promises go to the error handler,
      and removed methods/signatures (`res.sendfile`, `req.param`, etc.).
- [ ] `@types/express` 5. Check multer, cookie-parser and cookie-session
      compatibility.
- [ ] Validation gate, with extra manual checks of the upload, zip and share
      flows.

## Risks

| Risk | Mitigation |
|---|---|
| `custom-webpack` lags behind Angular releases | Matrix in step 0; esbuild fallback in step 3 |
| Unmaintained Angular libraries | Decide in step 0; small libraries (clipboard, loading bar) can be replaced in a few lines |
| TS 6 settings break the shared backend/frontend tsconfig | Split the configs in step 3 |
| Express 5 changes how paths are matched or decoded | Route tests written before the upgrade |
| Fork drifts further from upstream | Small per-step branches; record adapted cherry-picks |

## Work split and status

| Step | Branch | Status |
|---|---|---|
| 0 Baseline / matrix | `stack-upgrade` | Completed |
| 1 Angular 20 | `upgrade/angular-20` | Completed |
| 2 Angular 21 | `upgrade/angular-21` | Completed and validated (local branch) |
| 3 Angular 22 | `upgrade/angular-22` | Not started |
| 4 Node 24 | `upgrade/node-24` | Not started |
| 5 openid-client 6 | `upgrade/openid-client-6` | Not started |
| 6 ffmpeg wrapper | `upgrade/ffmpeg-wrapper` | Not started |
| 7 Express 5 | `upgrade/express-5` | Not started |
