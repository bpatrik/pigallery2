# Frequently Asked Questions (FAQ)

??? info "Why are there no albums, only logical albums (saved search)?"
    PiGallery2 follows a philosophy where the **disk is the source of truth and the database is only a cache**. The application is designed to show your photos as they are organized on your storage.

    Because the database is treated as a cache, it can be deleted and rebuilt at any time without losing your photo organization. "Logical albums" (saved search queries) are used instead of traditional database-only albums to maintain this directory-first approach and ensure that your gallery remains portable and easy to rebuild.

    If you still need traditional album-like behavior, you can use one of these workarounds:

    1. **Custom Keywords**: Add a unique keyword to your photos in their metadata (e.g., using Lightroom or DigiKam). You can then create a **Logical Album** in PiGallery2 by searching for that keyword.
    2. **Extensions**: You can develop an extension that automatically adds the keywords and creates albums for you. (see [discussion 1110](https://github.com/bpatrik/pigallery2/discussions/1110)

??? info "Why are there breaking changes in the database or config?"
    To maintain high **development velocity**, we do not provide database upgrade scripts. PiGallery2 is a hobby project, and implementing/debugging complex migration scripts would significantly slow down the addition of new features.

    As the database is only a cache, it is expected that users might need to delete the database and/or restart the configuration after a new release. This allows the project to move fast and evolve without being held back by legacy structures.

??? info "Why are there no regular releases?"
    PiGallery2 is a **hobby project** developed in free time. The developer does not get paid for this work and maintains it alongside a full-time job and other life commitments. Releases happen when new features are ready and time permits, rather than on a fixed schedule.
