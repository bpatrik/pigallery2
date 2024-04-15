# PiGallery2 Contribution guide (draft)

## Intro

This project reached to a point when I cannot maintain it alone. 
I'm happy to see that some people already submitted some pull requests (PR) so everyone can benefit their changes.
In general, I'm happy to merge PRs, but I recommend filling a ticket and ask first if it is OK.



## How to develop

1. Download the source files
2. install dependencies `npm install`
3. Build client  `npm run run-dev`
   * This will build the client with english localization and will keep building if you change the source files. 
   * Note: This process does not exit, so you need another terminal to run the next step.
4. Build the backend `npm run build-backend`
   * This runs `tsc` that transpiles `.ts` files to `.js` so node can run them. 
     * To rebuild on change run `tsc -w`
   * Note: you can skip this test if you use and IDE that supports typescript (e.g.: webstorm, vscode)
5. Run the server `npm start`

## Developer docs

### Project structure
Overview:
```
|-- benchmark --A benchmark tool to test the speed of the app (not needed for development)
|-- demo -- contains some sample photo for https://pigallery2.onrender.com/  (not needed for development)
|-- docker -- contains all docker and docker realted configurations (this is the recommended way for app deplyoment)
|-- docs -- webpage for http://bpatrik.github.io/pigallery2/

|-- src -- contains the rource files <-------- This is what you need
|-- test -- contains the unit and integration tets <----- be nice and write tests to your feature
```

Source structure:
```
|-- src -- contains the rource files <-------- This is what you need
  |-- backend -- nodejs backend code
  |-- common -- shared files (mostly DTOs) between the frontend and the backend
  |-- frontend -- angular based frontend
```

Backend structure:
```
|-- src -- contains the rource files <-------- This is what you need
  |-- backend -- nodejs backend code
    |-- middlewares -- contains the middlewares. These make minimal input validation and transforamtion
    |-- model -- contains the business logic
	  |-- database -- these return with the gallery related data
	    |-- interfaces -- common, database independent inerfaces
		|-- memory -- business logic for memory "database"
		|-- sql  -- business logic for sql database
	  |-- diagnostics -- contains the checks for the startup diagnostics (checks if all the settings are valid, all packeges are avaiale, image folder exists, etc.)
      |-- fileprocessing -- photo and video converting code
      |-- jobs -- code about job scheduling (crontab like feature)	  
	  |-- threading -- code that runs on a separate threading
	    |-- DiskManagerWorker.ts -- scans a direcory
		|-- Metadataloader.ts -- parses a photo / video for metadata
		|-- *Worker.ts -- queues and helper classes to convert video / photo, parse a directory
	|-- routers -- contains the declarations of the HTTP Api endpoints
	|-- index.ts -- here starts the Server up (callst server.ts)
	|-- server.ts -- this is HTTP server startup code
	|-- ProjectPath.ts -- singleton, contains the project related paths
```
## Case-study: Listing a directory

Scenario: Web UI wants to show the `/demoDir` directory, usind SQL database with low reindexing severity.

Client side:
1. Navigating to `http://<domain>/demoDir` 
2. URL changed: [gallery.component.ts]: `onRoute` triggered
3. Calling: [gallery.component.ts]: `galleryService.loadDirectory('/demoDir')`
4. Loding data from local_storage: [gallery.service.ts]: `galleryCacheService.getDirectory('/demoDir')`
5. Make a call to backend if the content changed [gallery.service.ts]: `networkService.getJson<ContentWrapperWithError>('/gallery/content/' + '/testDir', params)`
    * params contains last modification and last scanned date that is know from the local_storage cache

Server side:

6. Requests hits the server in [GalleryRouter.ts]: `protected static addDirectoryList(app: Express)`:
https://github.com/bpatrik/pigallery2/blob/b79d62840c7496b5068d6af73f10d95b9ac48fdd/src/backend/routes/GalleryRouter.ts#L32-L46

7. Authenticating user: [AuthenticationMWs.ts]: `AuthenticationMWs.authenticate`
    * On fail return with error
8. Normalizing `directory` path parameter (in this case `/testDir`): [AuthenticationMWs.ts]: `AuthenticationMWs.normalizePathParam('directory')`
    * Makes sure that path does not go out of the allowed paths (gallery itself)
9. Cheking if the path exists and the User has rights to access it: [AuthenticationMWs.ts]:`AuthenticationMWs.authorisePath('directory', true)`
    * returns 403 if not accessable
10. Injecting gallery version to the HTTP header: [VersionMWs.ts]:`VersionMWs.injectGalleryVersion`
    * gallery version is a hash that represents the current gallery status (latest modified date, number of photos/videos, etc)
11. Getting the content of `/testDir`   [GalleryMWs]: GalleryMWs.listDirectory
    1. If the last modificatoin and scan date of `/testDir` equals with what the client have sent, returning empty result to the client (skipping the rest)
    2. If last modification date is different from what the client knew, reindexing `/testDir`: `IndexingManager.indexDirectory(relativeDirectoryName)`
        * Scans a directory, asyncronously saves it to DB, while directly retourns with raw results from `DiskManagerWorker.ts`
    3. If Last scan heppened a while ago, reindex it asyncronously and return data from DB
12. Attaching Thumbnails data to the photos/videos: [ThumbnailGeneratorMWs]: `ThumbnailGeneratorMWs.addThumbnailInformation`
    * Checks if a photo already has a generated thumbnail image 
13. Removes empty properties and circular dependencies: [GalleryMWs.ts]: `GalleryMWs.cleanUpGalleryResults`
14. Rending http body and ending HTTP call: [RenderingMWs.ts]: `RenderingMWs.renderResult`

Client side:

15. Setting `content` BehaviorSubject (rxjs) with the `ContentWrapperWithError` from the server.
16. Rendering gallery: UI is data binded to the `galleryService.content` [gallery.component.html]
   
