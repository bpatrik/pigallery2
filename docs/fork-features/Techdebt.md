# Tech debt

Known debt in the fork. Items are deliberately outside the
[upgrade plan](UPGRADE_PLAN.md) unless an item says it blocks a step. Update the
status when an item is picked up or resolved.

Priority: **H** = security or blocks upgrades, **M** = deprecated / will break
later, **L** = cleanup.

## Frontend

| # | Item | Where | Priority | Notes |
|---|---|---|---|---|
| F1 | Angular 19 is unsupported; the bundled framework has XSS advisories | `package.json` | H | Covered by [UPGRADE_PLAN.md](UPGRADE_PLAN.md) steps 1–3 |
| F2 | Legacy structural directives `*ngIf` / `*ngFor` (44 files) | `src/frontend/app/**` | M | Deprecated in v20; migrated in upgrade step 1 |
| F3 | HammerJS gestures (`HammerModule`, `HAMMER_GESTURE_CONFIG`, `import 'hammerjs'`) | `main.ts`, `app.component.ts` | M | Deprecated by Angular; replace with pointer events in the lightbox and other gesture users |
| F4 | `@angular/animations` (`AnimationBuilder`, `provideAnimations`) | lightbox, `main.ts` | M | Deprecated in favour of CSS / `animate.enter`/`leave`; check the lightbox open/close animation in a visible tab |
| F5 | Webpack-based builder through `@angular-builders/custom-webpack` | `angular.json`, `angular.webpack.js`, `karma.conf.js` | M | Only customisation is one `IgnorePlugin`; moving to `@angular/build:application` changes the output layout and backend serving |
| F6 | Karma + Jasmine test runner | `karma.conf.js` | M | Angular is moving to Vitest; Karma is deprecated upstream. The nested plugin resolution workaround is fragile |
| F7 | zone.js change detection | `polyfills.ts` | L | Zoneless is the new default; adopt only after a signals review |
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
| B6 | Root `tsconfig.json` shared by the frontend and the CommonJS backend, using `moduleResolution: node` and `downlevelIteration` | `tsconfig.json` | M | Deprecated in TS 6; split the configs (upgrade step 3) |
| B7 | `typescript` not a direct dependency | `package.json` | L | Resolved: pinned to `5.8.3` as devDependency in upgrade step 0 |

## Security follow-ups

| # | Item | Priority | Notes |
|---|---|---|---|
| S1 | Implicit cookie / CSRF policy | H | Define `SameSite`/`Secure` and CSRF protection; depends on proxy/HTTPS deployment |
| S2 | No visible login throttling | H | Add rate limiting / backoff on login and the OIDC callback |
| S3 | Upload memory use: multer memory storage, 50 MiB × 10 files per request, no concurrency cap | M | Consider disk storage or a global concurrent-upload limit |
| S4 | Full `npm audit`: 86 advisories (mostly dev-tool transitive dependencies) | M | Re-check after each upgrade step; `--omit=dev` was 0 at the 2026-10-04 snapshot |

## Tooling / repo hygiene

| # | Item | Priority | Notes |
|---|---|---|---|
| T1 | Generated `.js` / `.js.map` files next to TypeScript sources (e.g. `src/frontend/main.js`, `gulpfile.js`) | L | Make sure they are git-ignored, not edited by hand, and not picked up by tools |
| T2 | `gulp-typescript` 5 (unmaintained) in the release pipeline | L | Re-check against TS 6; possibly replace with plain `tsc` |
| T3 | `coveralls` 3 (deprecated package) | L | Replace or drop if coverage upload isn't used |
| T4 | `ts-node` 10 | L | Check compatibility with newer TypeScript / Node 24, or use `tsx` / Node type stripping |

