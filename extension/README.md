# PiGallery2 Extension

This folder contains the core of the extension system.

For extension development and usage, please see the [documentation](https://bpatrik.github.io/pigallery2/development/extensions/).

## The `pigallery2-extension-kit` package

`npm run build-extension-interface` builds the package content here (`lib/`, `index.js`, `index.d.ts`).
CI publishes it to npm with the app's version (see "Releasing" in the [contribution guide](../docs/development/contributing.md)),
so the `version` in this `package.json` is not maintained by hand.
