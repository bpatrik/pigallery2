# Pigallery2 user rights

The following users are supported in the app with these rights:

| id | Role          | rights                                  | who has it |
|----|---------------|-----------------------------------------|------------|
| 1  | Limited Guest | listing directory                       | using shared link |
| 2  | Guest         | + search                                | no one (you can set manually in the db, if necessary) |
| 3  | User          | + share, list faces, create random link | default role |
| 4  | Admin         | + settings, see duplicate photos        | default (pregenerated) user (also the default right if authentication is off) |
| 5  | Developer     | + see errors                            | no one (you can set manually in the db, if necessary) |

**Note:** If you would like to set a user rights and does not work with the role name (string) use its id.
