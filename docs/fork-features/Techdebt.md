# Tech debt

Known debt in the fork. Items are deliberately outside the
[upgrade plan](UPGRADE_PLAN.md) unless an item says it blocks a step. Update the
status when an item is picked up or resolved.

Priority: **H** = security or blocks upgrades, **M** = deprecated / will break
later, **L** = cleanup.

## Frontend

| # | Item | Where | Priority | Notes |
|---|---|---|---|---|
| F1 | Angular 19 is unsupported; the bundled framework has XSS advisories | `package.json` | H | Upgraded to Angular 21.2.25 in Step 2; remaining migration to 22 covered by Step 3 |
| F2 | Legacy structural directives `*ngIf` / `*ngFor` (44 files) | `src/frontend/app/**` | M | Resolved: migrated to Angular block control flow (`@if`, `@for`, `@switch`) across all templates in upgrade step 1 |
| F3 | HammerJS gestures (`HammerModule`, `HAMMER_GESTURE_CONFIG`, `import 'hammerjs'`) | `main.ts`, `app.component.ts` | M | Deprecated but still present in Angular 21; retained in Step 2. Pointer-driven swipe/pinch passed the Brave smoke check. Replace with pointer events in a later step; [Angular 21 API](https://v21.angular.dev/api/platform-browser/HammerModule) |
| F4 | `@angular/animations` (`AnimationBuilder`, `provideAnimations`) | lightbox, `main.ts` | M | Deprecated since 20.2, with removal intended in v23; retained in Step 2. Open/close animation passed in a visible document in Brave. Replace with CSS / `animate.enter`/`leave`; [API status](https://angular.dev/api/animations/AnimationBuilder) |
| F5 | Webpack-based builder through `@angular-builders/custom-webpack` | `angular.json`, `angular.webpack.js`, `karma.conf.js` | M | Only customisation is one `IgnorePlugin`; moving to `@angular/build:application` changes the output layout and backend serving |
| F6 | Karma + Jasmine test runner | `karma.conf.js` | M | Angular is moving to Vitest; Karma is deprecated upstream. The nested plugin resolution workaround is fragile |
| F7 | zone.js change detection and newer ngx-bootstrap releases | `main.ts`, `polyfills.ts`, `package.json` | M | Step 2 explicitly retains `provideZoneChangeDetection()` and ngx-bootstrap 21.0.1. ngx-bootstrap 21.2+ requires zoneless and signal inputs, so the planned v22 library bump needs a separate transition or replacement; [breaking changes](https://github.com/valor-software/ngx-bootstrap/releases/tag/v21.2.0) |
| F8 | Possibly unmaintained Angular libraries: `ngx-clipboard` 16, `@ngx-loading-bar/core` 7 | `package.json` | M | Confirmed in step 0: `ngx-clipboard` has unbounded peers (`>=13.0.0`) but is stagnant (plan replacement in step 1 with navigator.clipboard / CDK); `@ngx-loading-bar/core` has unbounded peers (`>=16.0.0`) and installs cleanly |
| F9 | `ts-helpers` dependency | `package.json` | L | Likely obsolete with `importHelpers` / tslib; check usage and remove |

## Backend

| # | Item | Where | Priority | Notes |
|---|---|---|---|---|
| B1 | Express 4; `path-to-regexp` v1-style inline regex routes | `src/backend/routes/*` | M | Upgrade step 7 |
| B2 | `openid-client` 5 (legacy API), stale `@types/openid-client` 3.x | `OIDCAuthService.ts` | M | Upgrade step 5 |
| B3 | `fluent-ffmpeg` is archived | `FFmpegFactory.ts`, `MetadataLoader.ts`, `PhotoWorker.ts`, `VideoConverterWorker.ts` | M | Upgrade step 6 |
| B4 | `mysql` 2.18.1 driver is unmaintained | `optionalDependencies` | M | TypeORM supports `mysql2`; needs a driver switch plus MySQL/MariaDB test run |
| B5 | Node `engines` capped at `<24` | `package.json` | M | Upgrade step 4 |
| B6 | Backend uses legacy `moduleResolution: node` and `downlevelIteration` | `tsconfig.json`, frontend tsconfigs | M | Partly resolved in Step 2: frontend uses `bundler` and is excluded from the root backend compile. Shared base options remain; replace the backend's deprecated settings in Step 3 for TS 6 |
| B7 | `typescript` not a direct dependency | `package.json` | L | Resolved in Step 0; direct devDependency is now pinned to `5.9.3` after Step 2 |
| B8 | SQLite text searches miss literal `_` / `%` characters | `SearchManager.ts` (`convertGlobToLike`, `getLikeExpr`) | M | Found during Step 2 smoke validation in unchanged backend code: `IMG_5910.jpg` does not match, while `5910` does. Escaped LIKE patterns need an explicit SQLite `ESCAPE` clause. Fix separately with regression coverage for both database engines |

## Security follow-ups

| # | Item | Priority | Notes |
|---|---|---|---|
| S1 | Implicit cookie / CSRF policy | H | Define `SameSite`/`Secure` and CSRF protection; depends on proxy/HTTPS deployment |
| S2 | No visible login throttling | H | Add rate limiting / backoff on login and the OIDC callback |
| S3 | Upload memory use: multer memory storage, 50 MiB × 10 files per request, no concurrency cap | M | Consider disk storage or a global concurrent-upload limit |
| S4 | Full `npm audit`: 40 advisories in devDependencies/tooling | M | Step 2 snapshot, 2026-10-05: 1 low, 14 moderate, 23 high, 2 critical; `--omit=dev` is 0. Reduced from 48 after Step 1. Includes webpack build/serve tooling and Karma as well as the existing Mocha/Cypress/Gulp/coverage advisories |

## Tooling / repo hygiene

| # | Item | Priority | Notes |
|---|---|---|---|
| T1 | Generated `.js` / `.js.map` files next to TypeScript sources (e.g. `src/frontend/main.js`, `gulpfile.js`) | L | Make sure they are git-ignored, not edited by hand, and not picked up by tools |
| T2 | `gulp-typescript` 5 (unmaintained) in the release pipeline | L | Re-check against TS 6; possibly replace with plain `tsc` |
| T3 | `coveralls` 3 (deprecated package) | L | Replace or drop if coverage upload isn't used |
| T4 | `ts-node` 10 | L | Check compatibility with newer TypeScript / Node 24, or use `tsx` / Node type stripping |
| T5 | Backend test runner remains alive after final Mocha totals | L | Observed in Step 2: all 635 tests passed, but the process needed explicit termination. Review worker/timer cleanup so the suite exits naturally; Karma's similar behavior is documented in AGENTS.md |
