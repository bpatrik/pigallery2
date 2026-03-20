# Past and present
Before we dive into the future of the app, let's first understand the past and present of the app.

I started working on pigallery2 7 years ago. Pigallery2 is my second open-source gallery app, but my 3rd/4th gallery app altogether.
The existence of pigallery2 is threefold: 1) I wanted an app where I can share my photos with all their metadata with my family. I could have just used something like dropbox, 2) but I have a highly organized gallery that I don't like to upload to any 3rd party place. I could have used one of the available self hosted solutions, but none of them fitted my needs and 3) I like building stuff.

## Evolution
PiGallery2 evolved from a simple 'list and show photos directly from HDD' app to where it is now. Now PiGallery2 reads photo metadata, indexes photos to DB, resizes them for a blazing fast user experience. The app also supports searching, sharing, blogging, rendering photos on the map and minimal user control (see full list of features [here](http://bpatrik.github.io/pigallery2/)). At the beginning none of these features existed.

### Photo transcoding
Originally, the application ran on a raspberry pi 1 with HDD. However, this solution had some limitations. Firstly, as my photos are usually between 5-10MB JPG in size. It was extremely slow to show hundreds of them in a browser window in their full size. Browsers are not good for showing 1GB (100 x 10MB) JPG files on one page.
In addition, due to the network limitations (my server was on a home network with a few 100 kbps upload speed), it took forever to download 1 GB.
Thus, to overcome the above mentioned obstacles,I added thumbnail generation that first generated small `jpg`, later `webm` files. The app supports multiple sizes of thumbnails. When a photo is rendered, the app checks the best thumbnail size and loads that. This way the app does not download any unnecessary bytes, making the experience smoother.

I had the same issue with the previews (lightbox). My photos are usually 5-10MBs, but most of the time I only watch them on a full HD or at max on a 4K screen. Transcoding the photos to fhd or 4k saves a lot on transportation data and makes the whole experience way better.

Downloading a lot of data was also an important aspect when I used the app on a metered mobile network. I wanted to save on every bit.

### Indexing and Caching in DB
Now as the photos are small, scanning a directory all the time was still slow. Especially when the app also started reading more and more metadata. So with every directory open (load), the app needed to also read all the photos in that directory. This means opening and reading a few hundred megabytes from an external HDD at every directory open. That took seconds. During that the client could only show a boring loading animation. This is not acceptable in the world of webpages (on web users only wait 2-3s top).
So I added multi layer caching:
1. The app scans the directory when the user first navigates to it
  * no change up-to this point
2. App stores the scanned file structure in DB for future reuse and also sends that data to the client
3. The client stores the scanned file structure in a local cache and shows that to the user.

This way the app, in some cases, doesn't even have to communicate with the server to show a directory that you recently visited. This way a lot of network and computation data is saved in exchange for some caching storage. Of course caching introduces another problem: cache invalidation. So I had to add multiple hooks where the app checks if the client or the server side (the DB) is still valid. Cache can be invalid if the user changes anything in a given directory (like uploading a new photo).

Having photo transcoding and caching is what make pigallery2 truly shine, making it even faster than browsing my photos on my personal laptop.

## Lack of mainstream features
I have to admit that there are important features that pigallery2 is lacking. Let me explain why.

### Reminder for myself
First of all, I need to remind everyone and most of all myself, what this app is for. This is a hobby project. Mainly developed by one person in their free time. There is no studio of 2000 developers and a well thought business case behind it. Furthermore, I have a bit of a [niche use-cases](https://github.com/bpatrik/pigallery2/discussions/292) by having a highly organized gallery of photos. This means, I will never be able to compete with those apps that have a huge corporation behind them or just any reasonable business case. I would need to quit my job, hire people, work full time on it and charge money for it. With that, I would just kill pigallery2 as it is today: being a fun hobby project.
So, I need to set boundaries on some features and prioritize those that I actually use.

### Editing
Any sort of editing is a frequently asked feature (well,not that much after I said in the Readme that there is no editing support :) ). There are two reasons for no editing support: :
1. I don't want my family to touch my photos in any way as I carefully edited them
  * So I just have no incentive to implement it.
2. The app is made from bottom to top with the assumption that the DB write path is infrequent but the read path is frequent
  * So adding this feature would require heavy write path optimization. That would include better cache invalidation.

### Source of truth is the disk: DB is only a cache
I also frequently get feature requests about only doing edits in the DB. Like manually setting directory cover, hiding photos, adding keywords.

I'm not allowing it because of two reasons:
1. I want the app to show the best possible look with the least possible human configuration
  * This means the app should be able to select the best photo show in a directory without manually picking them.
2. Developer velocity
  * The DB is only a cache that should be possible to delete and rebuild anytime. This is mainly because I don't want to slow down developer velocity by writing and debugging DB upgrade scripts. I rather move fast and break the DB, it's only a cache. I estimate that backend related changes would be 50% slower if I would implement db upgrade scripts. And let's be honest, the dev velocity is already not great with 1-2 yearly releases.
  * You can argue that I could just make a huge warning that any DB only changes can be dropped any time. Believe me that would cause a lot of frustration and angry issues on github. I just don't want to deal with those.

### User control
I frequently get requests to add support for some advanced user control. I mainly mean being able to restrict users to some subset of the gallery.  Or allow search in shared directories or just being able to search at all.

Although I find these features also useful and I would like to see them in the app, I need to remind myself what pigallery2 is. It's a hobby project and I just don't have time for all features and I should prioritize those that I also use.

### Timeline view
Having a full timeline view is something that I also wanted to have. Unfortunately, the app is built up with the focus on directory first approach. The app expects all data to be available at the first load time. Mainly the local filters and the map needs it. This is a lot of data. Even with compression, sending all metadata for 200k or more photos at once is just not an option.

## Development velocity
I would like to keep the developer velocity as high as possible. This means there are certain features that I just can't support. I prefer to move fast and break things. In the end that is more fun than writing docs :)

1. I'm not adding DB upgrade scripts.
  * So the DB is only a cache that can be deleted anytime. So no 'only in DB edits'(#183)
2. I'm not adding proper api documentation.
  * The best I can do is code comments.
3. No user docs
  * I'm actually thinking about setting up a FAQ page. For now, I want to add a lot of explanation to the settings with links to github issues of a given feature.


# Future of pigallery2
As we understand the past and the present of the app, let's talk about the future of it.
Vision
Let’s discuss some of the main areas where the app can improve and where I will focus in the future (I’m talking about far future, so like years, I will still work on it 3 years from now)

## Time to Gallery
This is one of the main areas I want to improve. If you read my previous post on [how do I use the app](https://github.com/bpatrik/pigallery2/discussions/292), I spend a lot of time on organizing my photos  (collecting all raw photos, selecting good ones, retouching, keyword tagging, face tagging, geotagging, uploading to the gallery). I want to improve on it by:
* Allowing raw photo to show up in the app, so before I have time to do proper edits, my family can already enjoy those photos
* Allowing photo uploads a “not yet organized raw” folder. I might just do it a 3rd party app, like nextcloud or allow add-ons in pigallery and create an upload addon. I don’t see this to be part of the main app.
* Let the app auto face keyword tag the photos and use gpx tracks to auto assign gps coordinates to the photos

## Discoverability
This is the other main focus for me. I want to improve on how people can discover new photos. This includes ideas like:
* Auto sending weekly photos
  * This already possible with mails, but would be better to post to FB messenger chats
* Easier sharing
* A stretch idea: Autocreate kahoot like games to play at family gatherings.
  * Like: where was this photo taken or who is on the photo (and showing an old photo)

## Scalability
Scalability is threefold:
1. Better user support. As explained above, I’m not going to invest in this area.
2. Improving performance. I will keep investing here, but there was recently a bug update on it, so I don't expect major improvements in this area.
3. Improved developer velocity / more features. I’m significantly considering adding add-on support at some sort, so people can do easy alteration of the logic without touching the main app.
  * This would give me a lower bar to get a working code to the app (as I wont code review the addons) and also faster development.

## Usability
I still have some minimal ideas to improve useability, but the current 2.0 release meant to improve UX/UI, so I do not expect much movement in this area.

## Reliability
I consider the app rather reliable in terms of low number of annoying bugs and also rather stable. So I do not plan to do significant development in this area.Main feature in the future

## TL,DR
To sum up the discussed areas, I plan to invest in the following 3 features soonish:
1. AI support for auto tagging photos
2. Add-on support
3. Raw photo support




