<!--
Release notes of the next release, written while working on it (see AGENTS.md "Release notes").
Admins read this file in the app ("What's new" popup, about page; from the first heading on, without empty sections);
the release checklist turns it into the GitHub release (it adds New contributors and the Full Changelog link).
Write for users, keep it short, link issues and PRs in full: [#1234](https://github.com/bpatrik/pigallery2/issues/1234).
-->

## Breaking changes

## Main new features

## Under the hood

## Further changes
- New default theme: `modern` (Settings → Gallery → Themes; `classic` is the old look): deeper colors, no tile borders, gradients behind the texts over photos and softer motion. The built-in themes (`classic`, `modern`) are always up to date and read-only in the settings; add a new theme to customize one. The look of the gallery is now set by CSS variables (e.g. `--item-radius`, `--overlay-background`), so custom themes can change it with a few lines.

## Bug fixes
- Indexing no longer crashes and restarts the app on an empty or 1-byte photo file (Node 26, e.g. the Docker images) [#1408](https://github.com/bpatrik/pigallery2/issues/1408)
