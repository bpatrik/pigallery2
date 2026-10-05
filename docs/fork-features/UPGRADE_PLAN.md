# Platform upgrade plan

Status: not started. Plan only; no dependency has been changed yet.

## Goal

Bring the fork from Angular 19.2.15 (CLI 19.2.19, unsupported) to Angular
22.x. Then move to Node 24 and refresh npm. Then replace `openid-client` 5
and `fluent-ffmpeg`, and move to Express 5.

Hard constraints:

- Keep the existing architecture: the backend serves the built frontend,
  TypeORM managers/routers stay as they are, and there are no
  schema/`DataStructureVersion` changes.
- One upgrade step per branch, created from `stack-upgrade`. Each branch merges only
  when its validation gate passes.
- Commit automatic migrations (`ng update`, schematics) separately from manual
  fixes, so the diffs are easy to review and later upstream cherry-picks can be
  adapted.
- Leave deprecated features in place unless they block a step. Record them in
  [Techdebt.md](Techdebt.md) instead.

## Current state (2026-10-05)

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
| typescript | ~5.8.3 / ~5.9.0 | ~5.9.0 / ~6.0.0 | ~6.0.0 | Compiler-cli peer ranges: Ng 20 (`>=5.8 <6.0`), Ng 21 (`>=5.9 <6.1`), Ng 22 (`>=6.0 <6.1`). Directly pinned to `5.8.3` in Step 0 |
| zone.js | ~0.15.1 | ~0.15.1 / 0.16.3 | 0.16.3 | Ng 20 supports `~0.15.0`; Ng 21 & 22 support `~0.15.0 \|\| ~0.16.0` |
| @angular-builders/custom-webpack | 20.0.0 | 21.1.0 | 22.0.1 | Official stable releases exist for all three versions (blocks resolved) |
| angular-eslint | 20.7.0 | 21.4.0 | 22.5.0 | Regular major releases match Angular versions |
| ngx-bootstrap | 20.0.2 | 21.2.2 | 22.0.0 | Synchronized with Angular releases |
| @bluehalo/ngx-leaflet (+ markercluster) | 20.0.0 (cluster: 20.0.3) | 21.2.1 (cluster: 21.1.0) | 22.0.0 (cluster: 22.0.0) | Synchronized with Angular releases |
| ngx-markdown | 20.1.0 | 21.3.0 | 22.1.0 | Synchronized with Angular releases |
| ngx-toastr | 19.1.0 | 20.0.5 | 20.0.5 (overrides) | 19.1.0 peer is `>=16.0.0-0` (works on 20); 20.0.5 peer is `^21.0.0` (works on 21); for Ng 22, use npm overrides or local toast service |
| ngx-cookie-service | 20.1.1 | 21.3.1 | 22.0.0 | Synchronized with Angular releases |
| ngx-device-detector | 10.1.0 | 11.0.0 | 12.0.0 | Versioned independently (v10 for Ng 20, v11 for Ng 21, v12 for Ng 22) |
| @ng-icons/core, ionicons | 32.0.0 | 34.0.0 | 36.1.0 | Versioned independently (v32 for Ng 20, v34 for Ng 21, v36 for Ng 22) |
| ngx-clipboard | 16.0.0 | 16.0.0 | 16.0.0 | Unmaintained (peer is `>=13.0.0`, installs cleanly). Decision: replace with native `navigator.clipboard` or `@angular/cdk/clipboard` in Step 1 |
| @ngx-loading-bar/core | 7.0.1 | 7.0.1 | 7.0.1 | Peer is `>=16.0.0` (installs cleanly). Decision: retain 7.0.1 or replace with lightweight local progress bar component in Step 1 |

### Step 1 – Angular 19 → 20 (branch `upgrade/angular-20`)

- [ ] `ng update @angular/core@20 @angular/cli@20` (commit as is).
- [ ] Bump TypeScript, `custom-webpack`, `angular-eslint`, zone.js and the
      ngx-* libraries to the step 0 matrix versions.
- [ ] Remove the `beasties` override and the related `notes` entry.
- [ ] Check that `karma.conf.js` still resolves the builder's own Karma plugin.
- [ ] Separate commit: run the control-flow migration
      (`ng g @angular/core:control-flow`), since `*ngIf` / `*ngFor` are
      deprecated from v20. Review the templates that use `else` / `trackBy`
      by hand.
- [ ] Validation gate.

### Step 2 – Angular 20 → 21 (branch `upgrade/angular-21`)

- [ ] `ng update @angular/core@21 @angular/cli@21`, plus the matrix bumps.
- [ ] Keep the webpack builder and Karma. Don't adopt the new project
      defaults (zoneless, Vitest) here.
- [ ] Check the HammerJS and `@angular/animations` deprecation status. Act
      only if something is removed.
- [ ] Validation gate.

### Step 3 – Angular 21 → 22 (branch `upgrade/angular-22`)

- [ ] `ng update @angular/core@22 @angular/cli@22`, plus the matrix bumps.
- [ ] If TypeScript 6 is required: replace the deprecated `moduleResolution:
      node` and `downlevelIteration`. The frontend probably needs `bundler`
      and the backend `node16`/`nodenext`, so split the settings between
      `src/frontend/tsconfig*.json` and the backend tsconfig instead of using
      `ignoreDeprecations`. Re-check `gulp-typescript` and `ts-node` against
      the new TypeScript.
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
| 1 Angular 20 | `upgrade/angular-20` | Not started |
| 2 Angular 21 | `upgrade/angular-21` | Not started |
| 3 Angular 22 | `upgrade/angular-22` | Not started |
| 4 Node 24 | `upgrade/node-24` | Not started |
| 5 openid-client 6 | `upgrade/openid-client-6` | Not started |
| 6 ffmpeg wrapper | `upgrade/ffmpeg-wrapper` | Not started |
| 7 Express 5 | `upgrade/express-5` | Not started |

