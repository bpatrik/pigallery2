# Timeline implementation plan

Status: partially implemented. See "Work split and status" for per-task
progress.

## Goal

Add a Timeline tab next to Albums showing media from every permitted indexed
directory, newest first, reusing the existing grid, thumbnails, and viewer.
Folders stays the existing Home. Year/month navigation follows directly after
v1; a dense OneDrive-style layout comes later. Original media files are never
moved or modified.

Hard constraints:

- Timeline has its own backend API; it does not reuse the search endpoint
  (capped at `maxMediaResult + 1`, `SearchManager.ts`).
- Existing DB structures and architecture only (TypeORM entities, managers,
  routers/middlewares, `ObjectManagers`). No new tables, columns, indexes,
  entities, or persisted DTO fields; no `DataStructureVersion` bump.
- Config additions and transport-only DTOs are allowed.

## Design decisions

### Time base

`Config.Gallery.ignoreTimestampOffset` defaults to `true`; gallery date sorting
and grouping then use local time (`Utils.getTimeMS(creationDate, offset, true)`).
Timeline orders and groups by the same effective time:

- `effectiveTime = creationDate + offsetMinutes * 60000` when
  `ignoreTimestampOffset`, else `creationDate`. `offsetMinutes` is derived
  exactly as entity loading does (stored minutes → `getOffsetString` →
  `getOffsetMinutes`); unknown or invalid offsets contribute zero.
- Fix `Utils.getOffsetMinutes` for negative sub-hour offsets (`-00:30`
  currently parses as `+30` because `parseInt('-00')` is `-0`). Separate
  commit with its own test; affects Folders too. Already-indexed metadata is
  not corrected without re-indexing.
- Timestamps with unknown offset are stored as if UTC (`Utils.ts`), so their
  raw value is wall-clock time.
- `creationDate` is non-nullable; files without metadata dates carry the
  indexer's fallback value and sort where it falls.
- Viewer date labels keep their current behavior (always media offset); only
  grid grouping follows the rule above.

### Paging and cursors

Order: `(effectiveTime DESC, id DESC)`.

Two cursors, never mixed:

- **External page cursor** `(from, after)` = `(effectiveTime, id)` of the last
  item in the selected ordered prefix, taken *before* presentation
  post-processing. Returned to the client as `next`.
- **Internal scan state** `(creationDate, id)` over the raw index. Never leaves
  the server.

Algorithm for one page of `N` items strictly after `(from, after)`:

1. `W` = 14 h if `ignoreTimestampOffset`, else 0 (offsets are within ±14 h).
2. Scan raw rows `creationDate <= from + W` ordered `creationDate DESC, id DESC`
   in batches (e.g. `2N`), advancing the internal scan state.
3. Keep rows with `(effectiveTime, id) < (from, after)`; maintain the best `N`
   by `(effectiveTime DESC, id DESC)`.
4. Stop when the scan is exhausted, or when `N` are kept and
   `lastScannedCreationDate + W < effectiveTime(N-th kept)` (strict, so equal
   times with lower IDs are not missed).
5. Emit the `N` kept items in order; `next` is the last one's
   `(effectiveTime, id)`, or `null` when the scan was exhausted and fewer than
   `N` remained.

Request rules:

- Initial request: no cursor, no SQL upper bound (never bind infinity).
- Continuation: `from` and `after` both required.
- Calendar start: `before=<effectiveTime>` is an exclusive time bound, mutually
  exclusive with `from`/`after` (e.g. June 2015 → `before` = 1 July 2015
  00:00 effective time). Subsequent pages use `next`.
- Internal batches advance by raw `(creationDate, id)`, including timestamp
  ties.

Implemented as a pure function over a batch fetcher and unit-tested without a
DB. SQL range predicate stays index-friendly (`creationDate <= :upper`); ties
are resolved in memory, never with a bare top-level `OR`.

Indexing during traversal is best-effort: pages may reflect different DB
states; the client dedupes by media ID. No snapshot guarantee.

### Live photos

Existing pairing (`GalleryMWs.cleanUpGalleryResults`) matches by
`contentIdentifier + directory path`, not timestamp, sees only the current
response, and strips `contentIdentifier` afterwards. Timeline therefore pairs
on the server independently of page boundaries:

- When `Config.Media.LivePhoto.enabled` and video is enabled, after selecting
  the page:
  1. For page videos with a nonempty `contentIdentifier`, one query for
     permitted photos with the same identifier and directory ID. Drop videos
     that have one.
  2. For page photos with a nonempty `contentIdentifier`, one query for
     permitted companion videos (same identifier, same directory ID); attach
     the lowest media ID, as the existing pairing does.
- Both queries use the normal `media` alias and the unchanged
  `session.projectionQuery`. The projection builder in `SearchManager` only
  supports a `directory` alias and hardcodes `media.` throughout; it is not
  modified for Timeline.
- Pages may be shorter than `limit`; the cursor is taken before this filtering,
  so nothing is skipped.
- When video is disabled, videos are excluded in the scan query.
- Strip internal matching identifiers before rendering.
- Tests: permitted video + forbidden photo (video shown standalone), forbidden
  video + permitted photo (no companion attached), companion in another page's
  time range.
- The summary (milestone 2) must apply the same rule.

### Access control

Enforced server-side on every Timeline endpoint before querying or serving
cache:

- `TimelineMWs.checkAvailable`: `Config.Timeline.enabled`, user role
  `>= Config.Timeline.readAccessMinRole` (default `Guest`), and not a sharing
  session. Albums is not a template here (its route hardcodes `User`).
- All queries apply the complete `session.projectionQuery` (it may restrict
  individual media, not only directories).

### API

`TimelineRouter` + `TimelineManager` implementing `IObjectManager` directly
(not `ProjectionAwareManager`; its unbounded cache and DB-cache hooks do not
fit).

`GET /api/timeline/media?from=<ms>&after=<id>&limit=<n>`

- Chain: `authenticate → authorise(LimitedGuest) → checkAvailable →
  VersionMWs.injectGalleryVersion → TimelineMWs.listMedia →
  ServerTimingMWs.addServerTiming → RenderingMWs.renderResult`.
- `listMedia` processing: select ordered, permission-filtered page → live-photo
  filtering/attachment → thumbnail decoration via a helper extracted from
  `ThumbnailGeneratorMWs` that accepts `MediaDTO[]` (Folders keeps calling it
  through the existing middleware) → strip internal identifiers.
  `cleanUpGalleryResults` is not used.
- Validation (reject with 400, no silent clamping): `limit` safe integer in
  `[1, 200]`, default 100; `from`/`before` safe integers within supported date
  range; `after` non-negative safe integer; combination rules as above.
- Response: transport-only, unpacked
  `TimelinePageDTO {media: MediaDTO[]; next: {from: number; after: number} | null}`.
  Packing only if measured response sizes justify it.

`GET /api/timeline/summary` (milestone 2)

- Counts logical items (same exclusions as `/media`, so companion videos are
  not counted) per local day, folded into year → month in JS.
- Day bucket = `floor(effectiveTime / 86400000)` with true floor division in
  both dialects (pre-1970 dates exist); offset term uses the same
  normalization as the shared helper. Calendar folding in UTC on
  effective time.
- In-memory cache per `projectionKey`, LRU-capped, with a process-local
  generation counter bumped in `onNewDataVersion()`; a rebuild publishes only
  if the generation is unchanged. Concurrent requests share one rebuild.
- Month jump target: exclusive first instant of the following month in
  effective time, sent as `before`.

### Frontend

- **Dedicated container**: `TimelineComponent` with its own
  `TimelineStore` service, hosting the existing grid and lightbox components.
  It does not use `ContentLoaderService`, `ContentService`,
  `FilterService`, or `GallerySortingService` (app-level providers that
  filter, sort, mutate groups, poll, and cache to localStorage). Folders state
  stays untouched.
- **Store** (root-provided, outlives the component): loaded items, `next`,
  selected start boundary, active media ID, scroll anchor (media ID + viewport
  offset), loading/error state. No localStorage. Requests are cancelled when
  leaving Timeline; data is retained for Back. Cleared on logout and on
  user/projection change. On gallery version change: keep the list, show a
  "New photos — back to newest" notice.
- **`loadNextPage()`**: the single loading operation used by both the scroll
  sentinel and the viewer. Coalesces concurrent calls, rejects stale
  responses, dedupes by media ID, and advances the cursor even when dedupe
  adds nothing. Errors require explicit retry.
- **Grid presentation inputs**: extract from the grid only what Timeline
  needs: media groups, group-header style, inline blog on/off, media ID
  function, open/select callbacks, and a "reveal media ID" request. Folders
  passes its current values. The grid stops consulting
  `QueryService`/`isSearchResult()` for media identity.
- **Grouping**: fixed to local day, built from consecutive runs in server
  order. Grid input is appended groups only; completed rows are never
  rearranged.
- **Loading**: automatic when the end of the list scrolls into view
  (intersection sentinel), with visible loading and retry states.
- **Data-driven viewer**: the lightbox navigates a `LightboxSource`
  (`items`, `index`, `next()`, `prev()`, optional `animationTarget(id)`)
  instead of rendered `GalleryPhotoComponent`s. A Folders adapter wraps
  current behavior; the Timeline adapter calls `loadNextPage()` at the end of
  loaded data and selects the next item without waiting for its thumbnail.
  Photo/video renderer, controls, and info panel are reused unchanged. On
  close, the grid reveals the active item. Slideshow pauses while loading;
  errors show a retry in the viewer. This also keeps photos viewable once
  windowed rendering exists.
- **URLs and IDs**: full-path media IDs. Opening and closing a photo preserves
  timeline query params. Back from viewer or from Folders restores loaded
  pages and scroll anchor after render.
- **Navigation**: append `NavigationLinkTypes.timeline` without renumbering;
  rendered only when `isTimelineAvailable()`. `toDefault()` gets a fallback
  so an unavailable first link is skipped. Custom `NavBar.links` lists are not
  modified automatically; admins add the link.
- **Config**: `ClientTimelineConfig { enabled = true, readAccessMinRole = Guest }`.
- **Hidden in Timeline**: sort/group/filter controls, zip download, share,
  random link, map, blog/README, metafiles, filter stats.
- **i18n**: template `i18n`/`i18n-*` attributes and `$localize`, with
  translation updates.

## Milestones

### 1. Timeline v1

Backend:

- `getOffsetMinutes` fix (separate commit, own test).
- Effective-time helper and paging function with unit tests: ties across
  batches, mixed/missing/invalid offsets, `ignoreTimestampOffset` on/off,
  window boundary, initial request, `before`, EOF.
- Thumbnail helper extraction (Folders behavior unchanged).
- `TimelineManager`, `TimelineMWs` (availability, validation, listing),
  `TimelineRouter`, live-photo filtering and attachment.
- DB tests on SQLite and MySQL: full traversal returns every logical item
  exactly once in order; restricted user (directory and media-level
  projection) sees only permitted media; companion video in another page's
  time range is still paired and never listed standalone; video disabled;
  availability and role enforcement; invalid parameters rejected.
- Performance: synthetic library with a dense burst (thousands of items within
  28 h) and a restrictive projection; record rows examined and latency per
  page on both engines.

Frontend:

- Config, nav link with `toDefault()` fallback, `/timeline` route,
  `TimelineComponent` + `TimelineStore`, grid presentation inputs,
  `LightboxSource` with Folders and Timeline adapters, day grouping,
  auto-load, state restore, hidden features, i18n.
- Tests: stale/cancelled/coalesced loads, same-day group continuing across
  pages, viewer at page boundary, Back restore, logout clears state.
- Folders regression check right after the lightbox change: open,
  next/previous, slideshow, close animation, deep links.

### 2. Summary and month navigation

- Summary endpoint, LRU + generation-checked cache, floor-division buckets on
  both dialects (tests include pre-1970 dates and offset normalization).
- Year/month rail (desktop), picker (mobile), keyboard accessible;
  `?at=YYYY-MM` validated, preserved across viewer open/close, handled
  separately from photo params. A jump resets the list and loads from the
  target; top action "Back to newest".
- Tests: summary counts equal a full traversal grouped by month; restricted
  users get only their counts.

### 3. Dense layout

- Justified rows with bounded heights, narrow gaps, preserved aspect ratios;
  compact date labels; several small days per row where feasible;
  thumbnail-size control; visible-photo anchoring on resize.

### 4. Scale (only as measurements require)

- Windowed rendering of complete rows, bounded page caches, upward paging
  with a `before` cursor, photo deep-link anchors with a defined fallback for
  unavailable photos, sharing support, scan work budget.

## Work split and status

Overall difficulty: Opus-level project, split by risk. The hard part is many
correct changes to shared, lightly tested frontend code, not new algorithms.
Rough v1 size: 1.5–2.5k lines including tests.

Owner legend: **Luna** = implements; **Luna + Opus check** = Luna implements,
Opus reviews the named tests/diff before merge; **Opus** = Opus implements.

Status legend: `todo`, `in progress`, `review`, `done`.

| # | Task | Milestone | Difficulty | Owner | Status |
|---|---|---|---|---|---|
| 1 | `getOffsetMinutes` negative sub-hour fix + test (separate commit) | 1 | Routine | Luna | done |
| 2 | Effective-time helper + paging function (window, two cursors, `before`, ties across batches) with unit tests | 1 | Subtle, fully specified | Luna + Opus check (tests reviewed first) | done |
| 3 | Thumbnail helper extraction from `ThumbnailGeneratorMWs` (Folders unchanged) | 1 | Routine | Luna | done |
| 4 | `TimelineManager`, `TimelineMWs` (availability, validation), `TimelineRouter` | 1 | Routine | Luna | done |
| 5 | Live-photo filtering/attachment with permission rules | 1 | Moderate | Luna + Opus check (permission tests) | done |
| 6 | Both-DB tests (SQLite + MySQL) and dense-burst performance check | 1 | Laborious | Luna | done |
| 7 | `ClientTimelineConfig`, nav enum + `toDefault()` fallback, `/timeline` route, i18n | 1 | Routine | Luna | done |
| 8 | Grid presentation inputs (remove global-loader identity dependency) | 1 | Medium–high, shared Folders code | Opus | done |
| 9 | `LightboxSource` with Folders and Timeline adapters (data-driven viewer) | 1 | Highest risk | Opus + manual Folders check | done |
| 10 | `TimelineStore` + `loadNextPage()` (coalescing, stale responses, Back/scroll restore, logout) | 1 | Medium–high, races | Opus | done |
| 11 | `TimelineComponent` wiring, day grouping, auto-load sentinel, hidden features | 1 | Medium | Opus | done |
| 12 | Summary endpoint, SQL day buckets on both dialects, LRU + generation cache | 2 | Moderate | Luna + Opus check | done |
| 13 | Year/month rail, mobile picker, `?at=YYYY-MM` | 2 | Medium | Opus | review |
| 14 | Dense justified layout, thumbnail-size control | 3 | UI design | Opus (iterating with maintainer) | deferred |
| 15 | Windowed rendering and other scale items | 4 | As measured | Opus | deferred |

Luna progress (2026-10-04): Tasks 1 and 3 are complete; task 2 is implemented
and its paging tests are ready for Opus review. Tasks 4 and 5 are implemented,
with task 5's projection/companion tests passing on SQLite. Task 6's dense-burst
probe scanned 1,204 rows in 128 ms on SQLite; MySQL could not be reached in this
environment. Task 7's config, navigation, and translation catalogs are updated;
the Angular route depends on the `TimelineComponent` owned by task 11. Task 12's
summary endpoint, SQL bucket expressions, and generation-checked LRU are in
place and pass SQLite coverage; MySQL and Opus review remain outstanding.

Opus review (2026-10-04): paging and live-photo logic match the plan; tasks 2
and 5 accepted. Added tests for equal effective times split across pages, an
empty final page at exact EOF, seeded full traversals with mixed offsets (both
time bases, with and without `before`), directory-level projection, and
positive companion attachment. `/timeline` is now served by `PublicRouter`;
`toDefault()` skips custom URL links instead of leaving the app. Still open:
MySQL run for tasks 6 and 12, and the dense-burst cost (each page scans the
whole burst plus the 14 h window).

Opus frontend (2026-10-04): tasks 8–11 implemented; task 7 done with the
`/timeline` route. The grid takes `mediaIdFn`, `groupHeaderMethod`,
`showInlineBlog`, `revealMediaId` and emits `mediaOpen`/`missingMedia`; Folders
supplies the old `QueryService` behavior. The lightbox navigates a
`LightboxSource` (`GridLightboxSource` for Folders, `TimelineLightboxSource`
over the store). Cancellation drops stale responses (epoch) rather than
aborting HTTP. Deep links to items outside loaded pages drop `p` (milestone 4
fallback). Browser-checked on the demo library: full traversal, viewer
next/prev/close, deep link, slideshow, Back restore (±1 px); Folders and
search viewer, slideshow and inline blog unchanged. Karma specs
(`timeline.store.spec.ts`, paged-source lightbox spec) type-check but were not
run: no Chrome in this environment. The browser follow-up below verified a
page boundary with a temporary page size of 8.

MariaDB 11.4 run (2026-10-04): all 29 Timeline backend tests pass on SQLite and
MariaDB, including summary day buckets with a pre-1970 date and both
projection kinds. Dense burst (1,200 equal-time rows, `limit=2`): 1,204 rows
examined, 132 ms SQLite, 703 ms MariaDB. The probe is pessimistic: batches are
`2 × limit` = 4 rows, so it issues ~300 queries; at the default `limit=100`
the same burst takes ~7 batches. Task 6 done; task 12 awaits the Opus check.
Full backend suite on both engines: 567 passing, 8 failing, all MariaDB-only and
all from a pre-existing `origin/master` bug unrelated to Timeline:
`SearchManager` emits `ESCAPE '\'` (glob support, `4d4c9f42`/`b1be11f8`), which
MariaDB parses as an unterminated string with default backslash escaping.
Albums/covers/saved searches then fail; the Timeline DB suite hits it only via
leftover cover rebuilds and passes in isolation. Fixed separately: the explicit
`ESCAPE` is now SQLite-only (MySQL's default LIKE escape is already `\`), with
a both-engine regression test; affected suites pass on SQLite and MariaDB.

Luna follow-up (2026-10-04): SQLite Timeline suite passed (21 tests); dense
burst measured 1,204 rows examined and 132.52 ms. Temporarily lowering
`TimelineStore.PAGE_SIZE` to 8 confirmed scroll auto-load and viewer next at the
page boundary (the next photo opened after loading); the source was restored to
100. With a temporary Timeline-first `Gallery.NavBar.links`, the link rendered
on desktop and in the mobile menu; with Timeline disabled, `/` fell through to
`/gallery/`. The temporary config changes were restored. `npm run build-en` and
`npx tsc -p src/frontend/tsconfig.spec.json --noEmit` passed. The Karma run
stopped before Chrome launch because `@angular-devkit/build-angular/plugins/karma`
is missing from this environment.

Open before closing milestone 1:

- Run `npm run test-frontend -- --watch=false` with Chrome and the Karma plugin
  available. The last attempt stopped before browser launch because
  `@angular-devkit/build-angular/plugins/karma` is missing. Root cause: the
  package is only installed nested under
  `@angular-builders/custom-webpack/node_modules` (not hoisted), while
  `karma.conf.js` requires it from the top level; likely since the dependency
  update in `f77bb81f`. Not Timeline-specific. Fixed in `karma.conf.js` by
  resolving the plugin through the builder; with Brave as `CHROME_BIN` the full
  Karma suite passes (127/127), including the Timeline store/grouping and
  paged-source lightbox specs (20/20 when run alone). Milestone 1 has no open
  items left; tasks 8–11 marked done after the maintainer's review. Tasks 14
  and 15 are deferred by the maintainer; task 13 is next, then a test release.

Opus task 13 (2026-10-04): implemented. `TimelineStore.loadSummary()` loads the
per-month counts once (dropped on user/projection change, refreshed by "Back
to newest" after new data). Desktop shows a fixed year/month rail (buttons
with full month name and count as accessible label; the month of the first
visible photo is highlighted); below `md` a native `<select>` picker replaces
it. `?at=YYYY-MM` is validated (invalid values are removed), maps to `before` =
first instant of the following month in effective time, resets the list and
loads from there; a "Showing from … / Back to newest" bar appears. Viewer
open/close keeps `at` (the Timeline lightbox source merges page params); Back
from Folders restores the same `at` position; history Back/Forward between
jumps works. Specs: month parsing/boundaries (including pre-1970 and years
< 100), effective-time month, summary load/coalesce/clear, `at` kept by the
lightbox source. Full Karma suite 133/133; browser-checked on the demo
library (rail counts total 42, jump, empty month, invalid `at`, Back to
newest, history). The viewer with `at` was checked by spec only: the
integrated browser tab was hidden, which pauses viewer animations.

Opus task 12 review (2026-10-04): accepted. Cache invalidation is wired
(`onDataChange` → `onNewDataVersion` bumps the generation); in-flight builds
are shared and only publish when the generation is unchanged; failed builds are
not cached. Fixed: the cache key now includes `ignoreTimestampOffset`,
`Video.enabled` and `LivePhoto.enabled`, since settings changes do not bump the
data version. Added a test that summary counts equal a full traversal grouped
by month in both time bases, with fixtures 1 ms before a month end (also
pre-1970) and one whose offset moves it into the next month. Checked on
MariaDB that `FLOOR(x / 86400000)` is exact at those boundaries (no
`div_precision_increment` rounding). 33 tests pass on SQLite and MariaDB.

Accepted v1 gaps: leaving Timeline drops in-flight responses instead of
aborting them; deep links outside loaded pages drop `p`; dense bursts scan the
whole burst plus the 14 h window per page (all milestone 4 if measured).

Suggested order: close the items above, then milestone 2 (task 13; the store
already supports a `before` start), then milestone 3 (task 14), then
milestone 4 (task 15) as measurements require.

Main risks: Folders lightbox regressions (task 9), scroll/Back restore and
loading races (task 10). Backend risk is concentrated in task 2 and covered by
its tests.

## Verification

- Unchanged fixture: every logical item exactly once, in effective-time order,
  including ties and mixed offsets.
- Restricted users see neither inaccessible media nor their counts.
- Timeline and Folders remain independently usable; Back restores position.
- No DB schema diff: entities and `DataStructureVersion` unchanged.
- Month jumps, rail buckets, and day labels agree at month and offset
  boundaries.
- Dev data: `demo/images/flatten-test/` (nested folders plus a prefix-named
  sibling) appears completely.

Committed tests use synthetic/public fixtures only.
