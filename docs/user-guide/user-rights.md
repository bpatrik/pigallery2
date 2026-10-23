# Pigallery2 user rights

The following users are supported in the app with these rights:

| id | Role          | rights                                  | who has it |
|----|---------------|-----------------------------------------|------------|
| 1  | Limited Guest | listing the shared directories, search in the shared photos | using shared link |
| 2  | Guest         | + search                                | no one (you can set manually in the db, if necessary) |
| 3  | User          | + share, list faces, create random link | default role |
| 4  | Admin         | + settings, see duplicate photos        | default (pregenerated) user (also the default right if authentication is off) |
| 5  | Developer     | + see errors                            | no one (you can set manually in the db, if necessary) |

**Note:** If you would like to set a user rights and does not work with the role name (string) use its id.

On top of the roles, you can limit what a user can see with allow and block lists.

## Allow and block lists

There are two kinds of lists. Both can be set for the whole gallery in the settings (`Users` section)
and can be overridden for every user separately (Settings / Users / edit user / *Override allow/block list*).

| List                 | Setting                     | What it filters |
|----------------------|-----------------------------|-----------------|
| Media allow list     | `Users.allowQuery`          | Only photos and videos matching this search query are shown. |
| Media block list     | `Users.blockQuery`          | Photos and videos matching this search query are hidden. |
| Directory allow list | `Users.allowDirectoryList`  | Only directories matching any of these directory searches are shown, together with their photos, videos and metafiles. |
| Directory block list | `Users.blockDirectoryList`  | Directories matching any of these directory searches are hidden, together with their photos, videos and metafiles. |

The block list always wins over the allow list.

The media lists only filter photos and videos. To hide a directory, use the directory lists.
A `directory:` search in a media list hides the photos and videos of the matching directories,
but the directories themselves are still listed and can be opened (users see them as empty).

### Directory searches

The directory lists are lists of directory searches (the same as `directory:` searches in the search bar).
The path is relative to the images folder and matching is case-insensitive.

| Match type    | Example              | Matches |
|---------------|----------------------|---------|
| exact match   | `/photos/2024`       | only `/photos/2024` |
| like          | `2024`               | every directory whose path contains `2024` (this is the default for directory searches) |
| glob          | `/photos/2024/*`     | `/photos/2024` and everything below it |
| glob          | `/photos/2024/?*`    | everything below `/photos/2024`, but not the directory itself |
| glob          | `/photos/20??`       | `/photos/2023`, `/photos/2024`, ... (`?` matches one character, `*` matches anything, including `/`) |
| negate (`not`)| `not /photos/*`      | every directory that is not `/photos` or below it |

**Note:** A trailing `/*` always means *the directory itself and everything below it*, in the search bar too.

### What a user can open

Every directory is in one of these states for a user:

| State         | When | What the user sees |
|---------------|------|--------------------|
| available     | The directory is not blocked and matches the allow list (or there is no allow list). | Its photos, videos, metafiles (`.md`, `.gpx`, `.pg2conf`) and its available subdirectories. Opening it can trigger indexing. |
| parent        | The directory is not blocked and an available directory is below it. | Only the subdirectories that lead to available directories. No photos, videos or metafiles. Opening it can trigger indexing. |
| not available | Everything else. | The directory can't be opened. |

Parents are found from the path for exact and `path/*` searches (e.g.: allowing `/photos/2024/trip` makes `/` and `/photos` and `/photos/2024` parents).
For other searches (like, negated or other globs), parents are found from the already indexed directories.

Opening a not available directory gives the same "directory not found" (`404`) error as opening a directory that does not exist,
so it is not possible to find out what directories exist.
The same applies to photos, videos and metafiles: a not available one answers `404`, like a not existing one.
The app then navigates back to the default view.
The breadcrumb (directory path at the top) only links the parent directories that can be opened.

Metafiles belong to their directory: they are shown if their directory is available, regardless of the photos in it.
To hide the metafiles of a directory, block the directory.

Search and autocomplete only list available directories (not parents).

## Sharing

A sharing link works like a user with its own allow lists, on top of the lists of the user who created the sharing:

| Sharing property | Works as | Example |
|------------------|----------|---------|
| search query     | media allow list | `keyword:holiday` |
| directory query  | directory allow list (a single directory search) | `/photos/2024` (exact) or `/photos/2024/*` (with subdirectories) |

* At least one of them has to be set, otherwise the sharing is invalid.
* A sharing never shows more than the user who created it can see (their media and directory lists also apply).
* Sharing users can't open parent directories: the shared directory is the top of their tree.
* The default directory or search view of a sharing is only where the sharing opens. It does not limit what the sharing user can see.

### Directory sharing

When sharing a directory, the sharing gets a directory query: the exact directory, or the directory with all of its subdirectories (*Include subfolders* in the sharing dialog).
The sharing user can open these directories, see all their photos, videos and metafiles (also in empty directories),
and opening them can trigger indexing (e.g.: for a newly added subdirectory).

### Search sharing

When sharing a search result, the sharing has only a search query.
The sharing user can only open directories that contain at least one shared photo or video,
and the parents of these directories (without their content).
Opening these directories does not trigger indexing.
