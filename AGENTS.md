# Agent Notes

## Project Setup

- Use Node.js 22 (`nvm use 22`). The project supports Node `>=22 <24`; native modules such as `better-sqlite3` must be built for the active Node ABI.
- TypeScript under `src/` is authoritative. `npm run build-backend` compiles it; avoid hand-editing generated JavaScript.
- Backend tests run with `npm run test-backend`. To narrow Mocha tests, append a grep, for example `npm run test-backend -- --grep UploadRouter`.

## Security Context

- Audit snapshot from 2026-10-04: `npm audit --omit=dev` reported 17 advisories (13 high, 3 moderate, 1 low). Direct affected dependencies included `adm-zip`, `express`, `image-size`, `multer`, `nodemailer`, `sharp`, and `typeorm`; verify current advisories and reachability before upgrading. Avoid blindly using `npm audit fix --force`, which proposes breaking-version changes.
- Uploads are authenticated and role-gated. Multer uses memory storage; the current parser limits each file to 50 MiB and each request to 10 file parts. Keep these bounds in mind when changing upload behavior; concurrent requests can still consume significant memory.
- Security review also flagged implicit cookie/CSRF policy and no visible login throttling. Treat these as follow-up review items; deployment proxy and HTTPS configuration affect the right fix.
