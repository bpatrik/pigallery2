# Platform upgrade plan

Status: Steps 0–3 completed and merged. Step 4 is completed and validated on
`upgrade/node-24`, based on the Angular 22 merge (`master` at `de0ce1c4`),
awaiting merge.

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
| typescript | ~5.8.3 / ~5.9.0 | ~5.9.0 | 6.0.3 | Current compiler-cli peers: Ng 20 (`>=5.8 <6.0`), Ng 21 (`>=5.9 <6.0`), Ng 22 (`>=6.0 <6.1`). Step 3 pins `6.0.3` |
| zone.js | ~0.15.1 | ~0.15.1 / 0.16.3 | 0.16.3 | Ng 20 supports `~0.15.0`; Ng 21 & 22 support `~0.15.0 \|\| ~0.16.0` |
| @angular-builders/custom-webpack | 20.0.0 | 21.1.0 | 22.0.1 | Official stable releases exist for all three versions (blocks resolved) |
| angular-eslint | 20.7.0 | 21.4.0 | 22.5.0 | Regular major releases match Angular versions |
| ngx-bootstrap | 20.0.2 | 21.0.1 | 22.0.0 | Step 3 adopts signal APIs and removes `forRoot()`, retaining zone.js subject to runtime validation. See the compatibility decision below |
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

- [x] `ng update @angular/core@22 @angular/cli@22`, plus the matrix bumps.
- [x] If TypeScript 6 is required: replace the deprecated `moduleResolution:
      node` and `downlevelIteration`. The frontend probably needs `bundler`
      and the backend `node16`/`nodenext`. The frontend already uses `bundler`
      and is excluded from the root compile since Step 2; finish separating
      backend settings instead of using `ignoreDeprecations`. Re-check
      `gulp-typescript` and `ts-node` against the new TypeScript.
- [x] Resolve the ngx-bootstrap zoneless requirement before the planned v22
      bump: review signals and change detection as a separate sub-plan, or
      choose a replacement. Step 2 deliberately retains zone.js and 21.0.1.
- [x] If `custom-webpack` has no v22 release, fall back to
      `@angular/build:application`. Replace the `IgnorePlugin` (for example
      by fixing the import or using `externalDependencies`), and adapt the
      backend static path for the `dist/<locale>/browser` layout. Treat this
      as a separate sub-plan.
- [x] Validation gate (2026-10-06): frontend app/spec and Cypress type checks,
      backend compile, all **16 locale** builds and lint pass; Mocha
      **635 passing** on SQLite and MariaDB/MySQL; Karma **145 SUCCESS** in
      Brave; **7/7 Cypress specs** pass (the six existing specs plus a new
      Bootstrap regression spec, run separately; **18 passing**, **12
      intentionally pending** documentation tests); additional Brave smoke
      **9/9 passing**; production audit **0 vulnerabilities**.

Implementation notes:

- Based on `master` at `08d3c531`, after the Angular 21 branch was merged.
  Official dependency updates and schematics are committed separately from
  manual compatibility fixes. Angular framework/CLI and schematic packages
  are **22.2.1**, custom-webpack **22.0.1**, angular-eslint **22.5.0**,
  typescript-eslint **8.71.1**, TypeScript **6.0.3**, zone.js **0.16.3**.
- Node remains on major 22; engines now require **>=22.22.3 <24**, matching
  [Angular 22's minimum](https://angular.dev/reference/versions).
  Validation uses Node **22.23.3** and npm **10.9.9**. Node 24 remains Step 4.
- `tsconfig.base.json` holds shared compiler options. The root backend config
  uses `NodeNext` module and resolution settings, and still emits CommonJS
  because the package has no ESM `type`. Frontend app/spec configs use
  `bundler`/`ES2022` independently, with strict Angular template checking.
  Removed `downlevelIteration`; no `ignoreDeprecations` workaround is used.
  Explicit types and `rootDir` account for TS 6 defaults, while `strict: false`
  preserves the prior TypeScript settings alongside `noImplicitAny: true`.
- TS 6 always enables CommonJS interop: callable imports use default imports,
  the cookie-session import loads its request augmentation, filesystem mocks
  mutate the actual module, and sharp's require types match its CommonJS
  export. Type-only frontend imports prevent interfaces in decorator metadata
  from becoming nonexistent runtime exports. `tslib` is now an explicit
  runtime dependency for emitted helpers.
- The builder's jiti migration removed `ts-node`; restored **10.9.2** for
  Gulp, then verified loading `gulpfile.ts` through ts-node and the
  `gulp-typescript` release backend build. Both tools remain in place.
- Angular 22's schematics add `ChangeDetectionStrategy.Eager` to preserve
  rendering and `withXhr()` to preserve upload progress. Safe-navigation
  wrappers preserve pre-v22 template semantics. Webpack and Karma remain;
  `dist/<locale>` serving and the nested Karma plugin lookup are unchanged.
- Angular 22 removes Hammer's Angular integration APIs. Replaced the lightbox
  bindings with a scoped pointer gesture directive (capture, swipe, drag,
  pinch, double tap and cancellation), removed HammerJS, and added seven
  gesture regression tests. Angular animations remain available and retained.
- Cypress **15.19.0** is required for TS 6: v14's preprocessor unconditionally
  sets deprecated `downlevelIteration`. Official TS 6 support starts at
  [15.14.0](https://docs.cypress.io/app/tooling/typescript-support#history).
  Added `marked-katex-extension` **5.1.6**, an optional ngx-markdown peer that
  its webpack-resolved dynamic import requires even without math rendering.

ngx-bootstrap compatibility decision and separate zoneless sub-plan:

- Retain `provideZoneChangeDetection()` for the app and upgrade ngx-bootstrap
  to **22.0.0**, importing its modules directly without `forRoot()`. Keeping
  21.0.1 is impossible: its component loader uses `ComponentFactoryResolver`,
  removed in Angular 22. No ngx-bootstrap peer override remains.
- The [21.2 migration guide](https://github.com/valor-software/ngx-bootstrap/releases/tag/v21.2.0)
  prescribes zoneless. Inspection of the published v22 implementation shows
  signal inputs, `createComponent`, explicit render notifications, and no
  zoneless bootstrap assertion. The zone-based combination is therefore a
  local compatibility choice. The full gate passed, including dropdown,
  popover, modal, datepicker and timepicker interactions. A persistent
  `test/cypress/e2e/bootstrap.cy.ts` regression spec covers these controls.
- ngx-toastr's latest release is still **20.0.5**, with Angular 21 peers.
  Keep a scoped npm override for its Angular common/core peers only; require
  a visible toast during upload validation. Remove it when a compatible
  release is available.
- A future zoneless branch should inventory async state writes in Gallery,
  Timeline, authentication, settings and upload services; replace implicit
  updates with signals, AsyncPipe or `markForCheck`; adapt reactive forms and
  third-party callbacks; switch bootstrap and tests together; then remove
  zone.js. Require the complete gate plus notification, job-progress, live-photo
  and nonzero Timeline Back restoration checks before merging.

Validation notes:

- The integrated browser was unavailable. The nine automated Brave smoke
  checks used a visible document and an isolated backend on **8081**, copied
  demo media, separate config/database/cache paths, and enabled uploads.
  Checked login/Folders Back, Timeline month and nonzero scroll restoration
  through in-app Back, lightbox keyboard/swipe/pinch and animation, map,
  search, upload progress and visible toast, share link, Bootstrap controls,
  and advancing video playback. Screenshots were visually inspected.
- The existing service on port 8080 and ignored `test/setup-local.js` were
  preserved. A temporary Mocha setup selected the test-only MariaDB database;
  temporary Cypress configs supplied Brave and consistent physical paths.
  Mocha and Karma were stopped only after capturing their final success
  totals; their existing keepalive behavior remains T5.
- TS 6 interop required filesystem mocks to import the actual `fs` module.
  The extreme-value indexing fixture now assigns distinct photo ratings to
  avoid an unrelated nondeterministic MySQL cover-selection tie (T6).
- Release `gulp build-backend`, `build-extension-interface`, and loading
  `gulpfile.ts` through ts-node pass. The selected dependency tree has no
  invalid Angular peers after the scoped ngx-toastr override.
- The frontend build retains existing translation/locale-data warnings and
  an initial-bundle warning (**2.13 MB** against **2 MB**; below the **5 MB**
  error threshold). Webpack, Karma, Angular animations and zone.js remain
  documented follow-up work. Full audit is **36 advisories** (1 low, 12
  moderate, 21 high, 2 critical), all in devDependencies/tooling.

Local validation artifacts: `/tmp/pg-angular22-build-en.log`,
`/tmp/pg-angular22-backend-final.log`, `/tmp/pg-angular22-karma-final.log`,
`/tmp/pg-angular22-cypress-final.log`, `/tmp/pg-angular22-bootstrap-cypress.log`,
`/tmp/pg-angular22-smoke-final.log`, `/tmp/pg-angular22-release-backend-final.log`,
`/tmp/pg-angular22-extension-final.log`, `/tmp/pg-angular22-ts-node.log`,
`/tmp/pg-angular22-selected-tree.log`, and
`/tmp/pg-angular22-audit-{prod,all}.json`. Temporary smoke spec/config:
`/tmp/pg-angular22-smoke.cy.js`, `/tmp/pg-angular22-smoke.config.cjs`;
screenshots: `/tmp/pg-angular22-smoke-screenshots/`.

### Step 4 – Node 24 and npm (branch `upgrade/node-24`)

- [x] Engines **>=24.15.0 <25** (Angular 22's Node 24 minimum);
      `@types/node` **24.19.1**. Node 22 is no longer supported.
- [x] better-sqlite3 **12.11.1**, with Node 24 prebuilds (ABI **137**,
      SQLite **3.53.2**), within TypeORM 0.3.31's supported peer range.
      Clean-installed and rebuilt bcrypt **6.0.0** and sharp **0.35.5**.
- [x] Regenerated the lockfile and verified `npm ci` with Node **24.21.0**
      and its bundled npm **11.19.0**; pinned `.nvmrc`, `packageManager` and
      npm engines. `npm ls --all` passes.
- [x] Updated all Docker base images, GitHub Actions, the legacy Travis
      configuration, the local Docker builder and Node setup instructions.
- [x] Validation gate (2026-10-06): frontend app/spec and Cypress type
      checks, backend compilation, all **16 locale** builds and lint pass;
      Mocha **635 passing** on SQLite and MariaDB; Karma **145 SUCCESS**;
      **7/7 Cypress specs** (**18 passing**, **12 intentionally pending**
      documentation tests); additional Brave smoke **9/9 passing**;
      production audit **0 vulnerabilities**.

Implementation notes:

- Based on merged Angular 22 at `master` **de0ce1c4**. The existing app
  architecture and database schema/`DataStructureVersion` remain unchanged.
  No Node 22 transition range or second runtime gate is retained.
- npm 12 was evaluated, but this step uses Node 24's bundled npm 11.19.0.
  npm 12 blocks dependency install scripts by default, including native
  binaries and Cypress/FFmpeg setup; explicit script approvals and some
  incomplete registry records in the inherited lockfile need review before
  that separate upgrade (Techdebt T7).
- Pin **chokidar 5.0.0** directly for Angular DevKit 22's optional peer.
  Lockfile regeneration otherwise drops its nested copies and resolves that
  peer to Mocha's Chokidar 4, yielding an invalid tree. The final tree passes
  a full `npm ls`; platform-specific optional binary entries are retained.
- Docker pins Node **24.21.0** on Alpine 3.23 and Debian Trixie. Official
  [Node 24 images](https://github.com/nodejs/docker-node/blob/main/versions.json)
  omit ARMv7, so both verification and publishing matrices now use amd64 and
  arm64. Raspberry Pi deployments need a 64-bit OS.
- Docker startup validation exposed two inherited release problems. Sharp
  0.35.5 has a separate build command and requires libvips **>=8.18.7**; the
  distributions provide 8.16.1 / 8.17.3. `docker/build-libvips.sh` downloads
  the pinned **8.18.7** release, checks its SHA-256 and builds against system
  codecs, including libheif and ImageMagick. Install under `/usr/local`,
  which Sharp searches before distribution pkg-config paths, and copy the
  libraries into the runtime stage. Explicitly build Sharp afterwards.
- `gulp-typescript`'s virtual filesystem emitted ESM under NodeNext despite
  successful compilation, causing packaged startup to fail on extensionless
  imports. The release task now calls plain `tsc` with
  `tsconfig.release.json`, preserving CommonJS and the existing release
  layout. All **194** emitted backend/common/benchmark JS files match the
  tested development output apart from source-map URLs. Removed
  gulp-typescript, gulp-sourcemaps and its types; Gulp and ts-node remain.

Validation notes:

- All **three amd64 Dockerfiles** build and pass their built-in diagnostics,
  including a complete `create-release` from source in the self-contained
  image. Native SQLite queries, bcrypt round trips and JPEG/PNG/HEIC/AVIF
  thumbnail decoding pass in all three images. Debian and Alpine entrypoints
  serve `/heartbeat` and the built frontend from isolated test containers.
  Hadolint passes with the repository's configured exclusions. Arm64 and
  hosted CI execution remain checks for the remote pipeline.
- The integrated browser was unavailable. Automated Brave smoke checks used
  a visible document and an isolated backend on **8081**, with copied demo
  media, separate config/database/cache paths and enabled uploads. Checked
  login/Folders Back, Timeline month and nonzero scroll restoration through
  in-app Back, lightbox keys/swipe/pinch and animation, map, search, upload
  progress and a visible toast, share links, Bootstrap controls and advancing
  video playback. Screenshots were visually inspected.
- Preserved the existing service on 8080, the database container and ignored
  `test/setup-local.js`. A temporary Mocha setup used only `pigallery2_test`;
  temporary Cypress configs supplied Brave and consistent physical paths.
  Stopped only the test processes/containers created for this step. The
  existing Mocha/Karma keepalive behavior remains T5.
- Loading `gulpfile.ts` with ts-node **10.9.2** passes on Node 24 / TS 6.0.3.
  Existing locale/translation warnings and the **2.13 MB** initial-bundle
  warning remain. Full audit is now **30 advisories** (1 low, 7 moderate,
  20 high, 2 critical), all in tooling, down from 36 after removing the old
  release compiler; production audit remains zero.

Local validation artifacts: `/tmp/pg-node24-install-final.log`,
`/tmp/pg-node24-build-final.log`, `/tmp/pg-node24-tooling-final.log`,
`/tmp/pg-node24-static-final.log`, `/tmp/pg-node24-backend-final.log`,
`/tmp/pg-node24-karma-final.log`, `/tmp/pg-node24-e2e.log`,
`/tmp/pg-node24-smoke.log`, `/tmp/pg-node24-smoke-screenshots/`,
`/tmp/pg-node24-release-backend-final.log`, `/tmp/pg-node24-ts-node-final.log`,
`/tmp/pg-node24-dependency-tree.log`, `/tmp/pg-node24-docker-{debian,alpine}-final.log`,
`/tmp/pg-node24-docker-selfcontained.log`, `/tmp/pg-node24-docker-lint.log`,
`/tmp/pg-node24-container-{native,http}.log`, and
`/tmp/pg-node24-audit-{prod,all}.json`. These are local temporary artifacts;
future runs must recreate their harnesses.

### Step 5 – openid-client 5 → 6 (branch `upgrade/openid-client-6`)

- [x] Before migrating, add a test for `OIDCAuthService.ts` with a mocked
      issuer covering discovery, the authorization URL, callback/code
      exchange, and userinfo/claims mapping.
      - Implemented unit tests in `test/backend/unit/middlewares/OIDCAuthService.spec.ts` (14 tests)
        and route integration tests in `test/backend/integration/routers/OIDCRouter.spec.ts` (4 tests).
      - Backed by native in-process `MockOIDCServer.ts` (Node crypto RS256 signing, JWKS, token endpoint).
      - 18 passing tests verified on `openid-client` 5.7.1 baseline.
      - Added local development IdP setup using Dex container (`test/dex.sample.yaml` -> `test/dex.yaml`).
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
| 2 Angular 21 | `upgrade/angular-21` | Completed, validated and merged |
| 3 Angular 22 | `upgrade/angular-22` | Completed, validated and merged |
| 4 Node 24 | `upgrade/node-24` | Completed, validated and merged |
| 5 openid-client 6 | `upgrade/openid-client-6` | Not started |
| 6 ffmpeg wrapper | `upgrade/ffmpeg-wrapper` | Not started |
| 7 Express 5 | `upgrade/express-5` | Not started |
