# Agent Notes

## Main Goal

- Keep this fork as the integration base when bringing in useful upstream changes.
- Fetch the original repository as an `upstream` remote and fetch only the upstream branches or pull-request refs needed for review.
- Create local working branches from this fork for candidate changes. Port compatible commits with cherry-picks; when histories or fork-specific changes differ, adapt the patch locally instead of merging the whole upstream branch.
- Preserve existing fork commits and uncommitted user changes. Validate each port with focused tests before considering it complete.

## Project Setup

- Use Node.js 22 (`nvm use 22`). The project supports Node `>=22 <24`; native modules such as `better-sqlite3` must be built for the active Node ABI.
- TypeScript under `src/` is authoritative. `npm run build-backend` compiles it; avoid hand-editing generated JavaScript.
- Backend tests run with `npm run test-backend`. To narrow Mocha tests, append a grep, for example `npm run test-backend -- --grep UploadRouter`.

## Security Context

- Security remediation snapshot from 2026-10-04: direct backend dependencies were upgraded to patched releases, and `npm audit --omit=dev` reports 0 vulnerabilities. Re-run the audit before relying on this snapshot.
- Full `npm audit` still reports 86 advisories (4 low, 35 moderate, 43 high, 4 critical). Several are development-tool transitive dependencies. Angular 19.2.15 is also bundled into the frontend and has high XSS advisories; the latest 19.2 release is still affected, while npm recommends Angular 22.2.1. Treat that framework-major migration as separate work and verify compatibility before upgrading.
- Uploads are authenticated and role-gated. Multer uses memory storage; the current parser limits each file to 50 MiB and each request to 10 file parts. Keep these bounds in mind when changing upload behavior; concurrent requests can still consume significant memory.
- Security review also flagged implicit cookie/CSRF policy and no visible login throttling. Treat these as follow-up review items; deployment proxy and HTTPS configuration affect the right fix.
