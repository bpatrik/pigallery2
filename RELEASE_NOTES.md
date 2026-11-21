<!--
Release notes of the next release, written while working on it (see AGENTS.md "Release notes").
Admins read this file in the app ("What's new" popup, about page; from the first heading on, without empty sections);
the release checklist turns it into the GitHub release (it adds New contributors and the Full Changelog link).
Write for users, keep it short, link issues and PRs in full: [#1234](https://github.com/bpatrik/pigallery2/issues/1234).
-->

## Breaking changes
- The failed login log lines quote the user name and the sharing key (`for user:"admin"`), so a user name can't fake a log line. Fail2Ban filters that match up to the IP keep working [#519](https://github.com/bpatrik/pigallery2/issues/519)

## Main new features

## Under the hood

## Further changes
- New [Fail2Ban guide](https://bpatrik.github.io/pigallery2/setup/advanced/fail2ban/) (also in the Portainer & NPM guide) to ban IPs that keep failing to log in [#519](https://github.com/bpatrik/pigallery2/issues/519)
- New `Server.Log.file` setting: PiGallery2 can also write its log to a file (ISO dates, no colours, rotated at 10 MB), e.g. for Fail2Ban on hosts without journald like Unraid [#519](https://github.com/bpatrik/pigallery2/issues/519)
- PiGallery2 warns (in the log and on the admin page) when a login comes through a reverse proxy that `Server.trustProxy` doesn't trust, as failed logins then show the proxy's IP
- New default theme: `modern` (Settings → Gallery → Themes; `classic` is the old look): deeper colors, no tile borders, gradients behind the texts over photos and softer motion. The built-in themes (`classic`, `modern`) are always up to date and read-only in the settings; add a new theme to customize one. The look of the gallery is now set by CSS variables (e.g. `--item-radius`, `--overlay-background`), so custom themes can change it with a few lines.

## Bug fixes
- The info bar of a grid photo no longer leaves a line of the photo visible below it at some zoom levels
- Opening a photo that is cut by the bottom or top of the screen no longer makes the page jump: the lightbox opens from where the photo is
- Indexing no longer crashes and restarts the app on an empty or 1-byte photo file (Node 26, e.g. the Docker images) [#1408](https://github.com/bpatrik/pigallery2/issues/1408)
- Projection and saved-search caches no longer go stale on the next day when an allow/block query or album uses a relative date [#1405](https://github.com/bpatrik/pigallery2/issues/1405)
