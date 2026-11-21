# Apps & 3rd party tools

## Install PiGallery2 as an app (PWA)

PiGallery2 is a Progressive Web App (PWA), so you don't need a separate app on your phone:
open your gallery in the browser and install it as it is.

- **Android (Chrome)**: Menu -> *Add to Home screen* / *Install app*.
- **iPhone / iPad (Safari)**: Share -> *Add to Home Screen*.
- **Desktop (Chrome, Edge)**: the install icon in the address bar.

It then starts from its own icon, in its own window, without the browser's address bar.
Browsers only offer the install over HTTPS (or on `localhost`).

## 3rd party tools

!!! warning
    These tools are made and maintained by the community, not by the PiGallery2 maintainer.
    PiGallery2 takes no responsibility for them. In case of any issue, contact their developer.

### Extensions

Extensions add features to the server (and a bit of UI). The list of available extensions is in the
[extension repository](https://github.com/bpatrik/pigallery2/blob/master/extension/REPOSITORY.md);
the app reads the same list, so you can install them from the settings page.

Want to build your own? See [Extension Development](development/extensions.md).

### Native Android app

[PiGallery2 Android Client](https://github.com/dasmaetthes/pigallery2_android) by
[@dasmaetthes](https://github.com/dasmaetthes) is a native Android (and Android TV) app that browses
a PiGallery2 server: folders, albums, faces, search and map.
See its [announcement](https://github.com/bpatrik/pigallery2/discussions/1174) for details and feedback.

---

Did you build something for PiGallery2? Open a [discussion](https://github.com/bpatrik/pigallery2/discussions) or a PR that adds it here.
