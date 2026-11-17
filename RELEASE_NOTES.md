<!--
Release notes of the next release, written while working on it (see AGENTS.md "Release notes").
Admins read this file in the app ("What's new" popup, about page; from the first heading on, without empty sections);
the release checklist turns it into the GitHub release (it adds New contributors and the Full Changelog link).
Write for users, keep it short, link issues and PRs in full: [#1234](https://github.com/bpatrik/pigallery2/issues/1234).
-->

## Breaking changes
* The DB gets rebuilt on the first start, so the first indexing takes a while. Users are kept now; older updates (e.g. to 3.5.2) deleted them, then log in with `admin` / `admin`. [#1399](https://github.com/bpatrik/pigallery2/issues/1399)
* Docker: the images run on Node 26 and there is no `linux/arm/v7` image anymore. 32-bit Raspberry Pi OS users need a 64-bit OS (or stay on 3.5.2). [#1284](https://github.com/bpatrik/pigallery2/issues/1284)
* Extensions: the backend moved to Express 5 and TypeORM 1. Extension REST paths need the Express 5 path syntax (no regex params, `:id?` becomes `{:id}`, wildcards need a name like `*path`); a path that doesn't parse is logged and skipped. `getCacheForDirectory` gets a `DataSource` instead of a `Connection`, and `invalidateDirectoryCache` gets a `DirectoryPathDTO`. Update to the latest extension kit (now on npm, [#1319](https://github.com/bpatrik/pigallery2/issues/1319)). [#1291](https://github.com/bpatrik/pigallery2/issues/1291) [#1290](https://github.com/bpatrik/pigallery2/issues/1290)
<!-- TODO check: anything user-facing from cleaning up the Guest role (#1204)? -->
<!-- TODO check: is the new `Indexing.excludeFolderList` syntax compatible with old entries? -->

## Main new features
* Folder sharing [#1133](https://github.com/bpatrik/pigallery2/issues/1133) [#1076](https://github.com/bpatrik/pigallery2/issues/1076)
* Apple Live Photos support (`Media.LivePhoto.enabled`) by @bexelbie in [#1139](https://github.com/bpatrik/pigallery2/pull/1139) ([#609](https://github.com/bpatrik/pigallery2/issues/609))
* Hide hidden (dot) files and folders, plus a file name exclude list with `*` and `?` (`Indexing.excludeFilenameList`) [#803](https://github.com/bpatrik/pigallery2/issues/803) [#929](https://github.com/bpatrik/pigallery2/issues/929), by @cat101 in [#1141](https://github.com/bpatrik/pigallery2/pull/1141)
* Glob wildcards in `Indexing.excludeFolderList` by @cycsmail in [#1168](https://github.com/bpatrik/pigallery2/pull/1168) ([#192](https://github.com/bpatrik/pigallery2/issues/192))
* Date label next to the scrollbar while scrolling a date-sorted grid by @officialasishkumar in [#1369](https://github.com/bpatrik/pigallery2/pull/1369) ([#1209](https://github.com/bpatrik/pigallery2/issues/1209))
* Sorting and grouping by directory by @Berschi in [#1198](https://github.com/bpatrik/pigallery2/pull/1198)
* Per-user allow / block directory lists (`Users.allowDirectoryList`, `Users.blockDirectoryList`) [#1147](https://github.com/bpatrik/pigallery2/issues/1147)
* OIDC: role of auto-created users, and a strict security mode for providers where not everyone is trusted
* Accent-insensitive search on SQLite (`Database.sqlite.accentInsensitiveSearch`)
* Upload limits: `Upload.maxFileSizeMB` and `Upload.blockedExtensions`
* About page (in the menu, for everyone): what PiGallery2 is, links to the docs and the release notes, and how to support it. Admins also see the build details there, ready to copy into a bug report.
* Admins get a "What's new" popup with these notes once after every update.
* Let normal users create and delete albums (`Album.writeAccessMinRole`, default: Admin; needs a server restart) by @dasmaetthes in [#1400](https://github.com/bpatrik/pigallery2/pull/1400) ([#557](https://github.com/bpatrik/pigallery2/issues/557)). Albums are visible to everyone who can list them, and `Album.readAccessMinRole` can only be User or Admin.
* Nobody can give a role above their own: an Admin can't make a user Developer or set a role setting to Developer. Changing `Faces.writeAccessMinRole`, `Faces.readAccessMinRole` or `Upload.minimumRole` is marked as needing a server restart (it always needed one).

## Under the hood
This is the bulk of this release:
* Angular 19 → 22: zoneless, signals and `OnPush` everywhere, esbuild, lazy-loaded routes, fewer dependencies (Hammer.js, ngx-toastr, `@angular/animations` replaced) [#1219](https://github.com/bpatrik/pigallery2/issues/1219)
* Backend on Node 26, Express 5, TypeORM 1, strict TypeScript and type-aware linting [#1279](https://github.com/bpatrik/pigallery2/issues/1279)
* End-to-end tests for all main user journeys, and the bugs they found are fixed [#1254](https://github.com/bpatrik/pigallery2/issues/1254) [#1344](https://github.com/bpatrik/pigallery2/issues/1344)
* CodeQL alerts reviewed [#1302](https://github.com/bpatrik/pigallery2/issues/1302)

## Further changes
* Lightbox hides the mouse cursor with the controls by @cycsmail in [#1175](https://github.com/bpatrik/pigallery2/pull/1175) ([#736](https://github.com/bpatrik/pigallery2/issues/736))
* Search: the phone keyboard's Enter key starts the search by @patxixi in [#1214](https://github.com/bpatrik/pigallery2/pull/1214)
* Extensions: `contains` / `!contains` in media button `metadataFilter`, and in-place refresh after a metadata change by @patxixi in [#1200](https://github.com/bpatrik/pigallery2/pull/1200)
* Extensions: manual-install listings by @v-marinkov in [#1182](https://github.com/bpatrik/pigallery2/pull/1182)
* Grid: photos in grouped view have the same height when groups share a row [#1208](https://github.com/bpatrik/pigallery2/issues/1208)
* Random sort is no longer biased (Fisher-Yates) by @infinitejones in [#1131](https://github.com/bpatrik/pigallery2/pull/1131)
* Docker: the release images are rebuilt every week on fresh base images, so OS and Node security fixes arrive without a new release (same tags, e.g. `latest`; Watchtower picks them up). The release zip now ships a `package-lock.json`, so every build installs the npm versions that were tested.
* Only admins see the app version: it is no longer in the browser console or the page source of every visitor.
* The sponsor links moved from the bottom of the settings page to the about page.
* The server log tells when the DB got rebuilt, when the default `admin` / `admin` user was created, and when a login failed because the user does not exist. [#1399](https://github.com/bpatrik/pigallery2/issues/1399)

## Bug fixes
* Photos lost all metadata when their XMP segment started right before 64 KiB by @PhilippMundhenk in [#1270](https://github.com/bpatrik/pigallery2/pull/1270) ([#1269](https://github.com/bpatrik/pigallery2/issues/1269))
* Uploaded files with accented names got mangled names [#1263](https://github.com/bpatrik/pigallery2/issues/1263)
* Search keywords (`and`, `or`) are case-insensitive by @cycsmail in [#1177](https://github.com/bpatrik/pigallery2/pull/1177) ([#1090](https://github.com/bpatrik/pigallery2/issues/1090))
* Wrong share link with a different base URL by @galagithub in [#1170](https://github.com/bpatrik/pigallery2/pull/1170)
* Non-standard time offsets without zero padding by @grasdk in [#1138](https://github.com/bpatrik/pigallery2/pull/1138)
* Random link creator URLs returned errors [#1140](https://github.com/bpatrik/pigallery2/issues/1140)
* Can't create albums based on date [#1152](https://github.com/bpatrik/pigallery2/issues/1152)
* Search: negated ranges (e.g. `rating!:1..2`, `rating!=2`) found nothing, date searches (e.g. `date=2020-05-05`, `date<=2020-05-05`) missed the photos of their last day, and decimal resolutions and distances (e.g. `resolution>=0.5`, `1.5-km-from:Budapest`) were searched as plain text. The query builder showed an empty relation (`=` / `!=`) for non-text searches.
* Saving a search link without a query broke routing [#1176](https://github.com/bpatrik/pigallery2/issues/1176)
* Albums with an invalid search query are not saved; a broken entry of a `.saved_searches.pg2conf` is skipped with a warning to the admins instead of stopping the indexing.
* Memory leak during indexing [#1070](https://github.com/bpatrik/pigallery2/issues/1070)
* `vips_colourspace` error [#1122](https://github.com/bpatrik/pigallery2/issues/1122), `creationDate` null error [#1126](https://github.com/bpatrik/pigallery2/issues/1126), numeric tags shown twice [#1103](https://github.com/bpatrik/pigallery2/issues/1103)

<!-- For the GitHub release (release checklist step 7): New contributors and **Full Changelog**: https://github.com/bpatrik/pigallery2/compare/3.5.2...3.8.0
TODO check which of these are first-time: @officialasishkumar @hamidzr @PhilippMundhenk @patxixi @v-marinkov @cycsmail @galagithub @cat101 @bexelbie @infinitejones @moaz-ahmed -->
