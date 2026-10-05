# Tech debt

Known debt in the fork. Items are deliberately outside the
[upgrade plan](UPGRADE_PLAN.md) unless an item says it blocks a step. Update the
status when an item is picked up or resolved.

Priority: **H** = security or blocks upgrades, **M** = deprecated / will break
later, **L** = cleanup.

## Frontend

| # | Item | Where | Priority | Notes |
|---|---|---|---|---|
| F1 | Angular 19 is unsupported; the bundled framework has XSS advisories | `package.json` | H | Resolved in Step 3: Angular 22.2.1 with TypeScript 6.0.3; production audit remains zero |
| F2 | Legacy structural directives `*ngIf` / `*ngFor` (44 files) | `src/frontend/app/**` | M | Resolved: migrated to Angular block control flow (`@if`, `@for`, `@switch`) across all templates in upgrade step 1 |
| F3 | HammerJS gestures (`HammerModule`, `HAMMER_GESTURE_CONFIG`, `import 'hammerjs'`) | `main.ts`, `app.component.ts` | M | Resolved in Step 3: Angular 22 removed its Hammer integration. Replaced with `LightboxGesturesDirective`, including pointer capture, swipe, drag, pinch, tap and cancellation; seven new Karma regression tests and Brave gesture smoke checks |
| F4 | `@angular/animations` (`AnimationBuilder`, `provideAnimations`) | lightbox, `main.ts` | M | Deprecated since 20.2, with removal intended in v23; still available and retained in Step 3. Open/close animation passed in a visible document in Brave. Replace with CSS / `animate.enter`/`leave`; [API status](https://angular.dev/api/animations/AnimationBuilder) |
| F5 | Webpack-based builder through `@angular-builders/custom-webpack` | `angular.json`, `angular.webpack.js`, `karma.conf.js` | M | Only customisation is one `IgnorePlugin`; custom-webpack 22.0.1 retains the output layout. Angular 22 now explicitly warns that webpack support is deprecated; moving to `@angular/build:application` changes output layout and backend serving |
| F6 | Karma + Jasmine test runner | `karma.conf.js` | M | Angular is moving to Vitest; Karma is deprecated upstream. The nested plugin resolution workaround is fragile |
| F7 | zone.js change detection and newer ngx-bootstrap releases | `main.ts`, `polyfills.ts`, `package.json` | M | Step 3 retains `provideZoneChangeDetection()` with ngx-bootstrap 22.0.0 signal APIs and direct module imports. Its published guide prescribes zoneless; the inspected implementation uses signals/explicit render notifications without a bootstrap assertion. This is a locally validated compatibility choice; separate zoneless sub-plan in UPGRADE_PLAN.md. ngx-toastr 20.0.5 still has Angular 21 peers, overridden only for common/core |
| F8 | Possibly unmaintained Angular libraries: `ngx-clipboard` 16, `@ngx-loading-bar/core` 7 | `package.json` | M | Confirmed in step 0: `ngx-clipboard` has unbounded peers (`>=13.0.0`) but is stagnant (plan replacement in step 1 with navigator.clipboard / CDK); `@ngx-loading-bar/core` has unbounded peers (`>=16.0.0`) and installs cleanly |
| F9 | `ts-helpers` dependency | `package.json` | L | Likely obsolete with `importHelpers` / tslib; check usage and remove |

## Backend

| # | Item | Where | Priority | Notes |
|---|---|---|---|---|
| B1 | Express 4; `path-to-regexp` v1-style inline regex routes | `src/backend/routes/*` | M | Upgrade step 7 |
| B2 | `openid-client` 5 (legacy API), stale `@types/openid-client` 3.x | `OIDCAuthService.ts` | M | Upgrade step 5 |
| B3 | `fluent-ffmpeg` is archived | `FFmpegFactory.ts`, `MetadataLoader.ts`, `PhotoWorker.ts`, `VideoConverterWorker.ts` | M | Upgrade step 6 |
| B4 | `mysql` 2.18.1 driver is unmaintained | `optionalDependencies` | M | TypeORM supports `mysql2`; needs a driver switch plus MySQL/MariaDB test run |
| B5 | Node `engines` capped at `<24` | `package.json` | M | Resolved in Step 4: Node >=24.15.0 <25, npm 11.19.0, Node 24 types and better-sqlite3 12.11.1; native runtime and both database engines validated |
| B6 | Backend uses legacy `moduleResolution: node` and `downlevelIteration` | `tsconfig.json`, frontend tsconfigs | M | Resolved in Step 3: shared `tsconfig.base.json`, backend NodeNext settings with CommonJS output, independent frontend bundler settings; `downlevelIteration` removed without `ignoreDeprecations` |
| B7 | `typescript` not a direct dependency | `package.json` | L | Resolved in Step 0; direct devDependency is now pinned to `6.0.3` after Step 3 |
| B8 | SQLite text searches miss literal `_` / `%` characters | `SearchManager.ts` (`convertGlobToLike`, `getLikeExpr`) | M | Found during Step 2 smoke validation in unchanged backend code: `IMG_5910.jpg` does not match, while `5910` does. Escaped LIKE patterns need an explicit SQLite `ESCAPE` clause. Fix separately with regression coverage for both database engines |

## Security follow-ups

| # | Item | Priority | Notes |
|---|---|---|---|
| S1 | Implicit cookie / CSRF policy | H | Define `SameSite`/`Secure` and CSRF protection; depends on proxy/HTTPS deployment |
| S2 | No visible login throttling | H | Add rate limiting / backoff on login and the OIDC callback |
| S3 | Upload memory use: multer memory storage, 50 MiB × 10 files per request, no concurrency cap | M | Consider disk storage or a global concurrent-upload limit |
| S4 | Full `npm audit`: 30 advisories in devDependencies/tooling | M | Step 4 snapshot, 2026-10-06: 30 advisories (1 low, 7 moderate, 20 high, 2 critical); `--omit=dev` is 0. Removing the obsolete release compiler reduced the Step 3 total from 36. Includes webpack build/serve tooling, Karma and Mocha/Cypress/Gulp/coverage advisories |

## Tooling / repo hygiene

| # | Item | Priority | Notes |
|---|---|---|---|
| T1 | Generated `.js` / `.js.map` files next to TypeScript sources (e.g. `src/frontend/main.js`, `gulpfile.js`) | L | Make sure they are git-ignored, not edited by hand, and not picked up by tools |
| T2 | `gulp-typescript` 5 (unmaintained) in the release pipeline | L | Resolved in Step 4: Docker startup exposed ESM output from its virtual filesystem under NodeNext, despite a successful compile in Step 3. The release task now uses plain `tsc` and `tsconfig.release.json`; removed gulp-typescript, gulp-sourcemaps and its types. All 194 release JS files match the tested development CommonJS output (excluding source-map URLs) |
| T3 | `coveralls` 3 (deprecated package) | L | Replace or drop if coverage upload isn't used |
| T4 | `ts-node` 10 | L | TS 6.0.3 check passed: ts-node 10.9.2 loads `gulpfile.ts`. Restored after custom-webpack 22 migration removed it for the builder. Node 24 compatibility passed in Step 4 with TypeScript 6.0.3 and ts-node 10.9.2 |
| T5 | Backend test runner remains alive after final Mocha totals | L | Observed in Step 2: all 635 tests passed, but the process needed explicit termination. Review worker/timer cleanup so the suite exits naturally; Karma's similar behavior is documented in AGENTS.md |
| T6 | Backend test fixtures can tie when selecting unrated album covers | L | Found in Step 3: the MySQL extreme-value test sometimes expected Photo1 while the DB selected Photo2. That test now assigns distinct ratings; audit other tied-cover fixtures separately |
| T7 | npm 12 dependency install-script policy | M | Step 4 pins the npm 11.19.0 release bundled with Node 24.21.0. npm 12 blocks dependency install scripts by default, including native binaries and Cypress/FFmpeg setup. Review explicit script approvals and incomplete registry metadata in the inherited lockfile before lifting the npm engine cap |
