# How do I use PiGallery2
I figured, I write a blogish entry about how I (the developer behind it) use Pigallery2. What is my workflow, how do I see its future.

## My setup
**System**: Raspberry Pi 4 4G Model B, SandisK Mobile Ultra 32Gb CLass10, UHS-I, HDD: Western Digital Elements 1TB (WDBUZG0010BBK)
**OS**: Raspbian GNU/Linux 10 (buster)
I own a raspberry with this WD HDD since 2013 and I run one of my custom made gallery on it (currently pigallery2. Funfact: this is the 4th version actually, the first 2 did not made it to github).
I use the [default docker-compose](https://github.com/bpatrik/pigallery2/tree/master/docker/docker-compose/default) setup with the nightly-buster image (Earlier I had random file system errors when the host OS and the docker image version was different). I keep all setting on default (except I use mapbox, instead of OpenStreetMaps, it looks better). In others words: the default settings are optimized for RPi4.

## My workflow
### Taking the photos
I like photography. I own a Canon 77D and a gopro. I always took photos in raw (I like to underexpose them a bit then later retouch them. I found that this way the photo has a bit more details).

### Retouching the photos
A retouch all of my photos. I use Adobe Lightroom for this (I was considering to switch to an open source app, but I was lazy). Without a retouch no photos can end up in my photo gallery. I also do not show my photos to anyone before I would retouch them. (I’m strict about it, not as much as I was a few years ago, but still quite strict :) ).
* Once I finished retouching them, I annotate them:
* I assign keywords,
* tag faces. Ligthroom mediumly helpful with this. At some point I would like to implement face detection for pigallery2 #57. Until that is ready, I do it manually, so by the time it is ready, the ML model would already have some samples to classify the faces too.
* set geolocation. I usually track when I go for a hike or walk and I use the GPS track to set the location of a photo. Luckily Lightroom can do that for me automatically.

### Placing the photos
Once retouching is finished, photos go to their own folders. I use the following structure:
```
|-- Family
  |-- 2000
  |-- 2001
  |--2002
    |--2002.01.01 Event name 1
    |--2002.04.01 Event name 2
    |--2002.05.01-10 A long event
|-- Other
  |-- 2000
    |-- 2000.05.02 Some event name
```
I keep 3 replicas about all my photos: on my personal computer (I move it a lot, It can just die anytime), on my RPi4 server (for pigallery2), on an offline HDD (I happen to own a spare one, so just in case a backup my data there too). It is actually I good practice to physically separate the backups.
So far I my gallery is 170Gig with more than 60K photos in it.

### Making Pigallery to recognize the new photos
Once I copied the photos to my RPi, I let pigallery to index it (I use sqlite. It proved to be fast enough for me). If its only one small album, I just navigate there in the app, so it can recognize the new folder. If I add multiple new folders, I hit reindex in the settings. Reindexing takes a lot of time unfortunately, as it rereads all the photos from the HDD. I’m considering to implement a “quick reindexing” that would only reindex if the modified date of a folder changes.

I do the reindex with “jobs” so it also generates thumbnails, full HD preview images, converts videos and cleans up the temp folder. I do schedules jobs to do reindexing periodically. Once it can be triggered on folder change and it can do “quick reindexing”, I will probably give it a try. Until then I like to be in charge, when my RPi does anything ( I do not trust it :D).

If the temp folders needs to be recreated (temp photo name generation changed, or I got a new RPi that can handle videos with higher resolution), I use my own computer to run the app and generate all converted photos, videos. (converting one video on an RPi is ok, but multiple gig of videos are :O ).
The filenames and path in the temp folder only depends on the path and filename of the original file and quality (like: resolution) of the conversion. So it is safe to do the heavy lifting on a stronger machine and just copy the result to the RPi.

### Using Pigallery2.
At this point I have all my nicely edited photos in place, the app indexed them, created thumbnails, previews and converted the videos.
I have the following use-cases where I use the app:

1. Show the photos of an event: This is the most basic usage. I navigate to a folder and just show photos.

2. Keep track, where I have already been: I go the Faces -> click on my name then click on the map. (since the latest map cluster updates, finally it works smoothly. #256)

3.  `Grandma mode`: My grandma loves watching old family photos. (Since the Advanced Search #58 is finally ready ), I can search for queries like: `2-of:(person:”name1” person:”name2” person:”name3” person:”name4”)`. This would show all family photos that contains at least 2 persons from the listed 4. I plan to implement “logical albums” #45  which would be saved search queries placed in the gallery structure. Or some similar feature, where I can save a family photo search query and just load them with one click. With the angular 11 upgrade #255 , pigallery finally works on our older smart tv, so my family can enjoy the photos on a big screen.

4. Get family photos from the last year (List and download them).
  * Every year, we create family calendars as a Christmas present. With developments of the last year, now I can list all family photos from the last year and download them (kudos to mcdamo@, #278 ).
  * Family quiz: From time-to-time I create a kahoot from our family photos to entertain our broader family. I get family photos and ask questions, like when/where was it taken, how is on it, how old are they, etc… I was thinking about implementing this quiz like feature to the app, but that would be too out of line from the core app. If I ever implement add-on capability, it would be a good candidate for that.

## Future plans, nice to have features
I have plenty of ideas about the future of the app.
Disclaimer: No promises here. It’s only a hobby project. Ever since I started working for real, I cannot look at code at nights. So only weekends are left. And I expect them to get busier once Covid is somewhat over. Thar is why I started inviting people to contribute and started writing [CONTRIBUTING.md](https://github.com/bpatrik/pigallery2/blob/master/CONTRIBUTING.md). I’m still cautious is this, we are talking about “my precious” here. :) I spent years on it. I’m particularly picky about the design and performance. My aim is to provide high quality experience (like big tech company high quality) but only using a Raspberry. And the UI should be “mom safe”. (The average user should find everything intuitive). In other words: user experience > features.
So about the ideas:

1. Adding ML to recognize faces. #57  (I do not expect to be ready in 2021)
  * Improvement here could be to auto tag photos too (Should not be too hard to add, once faces are there)
  * Super fancy improvement would be here to see if it is possible to analyze emotions on the photos. If you have photos about your whole life, you could plot what part of the life were you happy. (Do not expect to ever implement)
2. Timeline view. #174  Basically show all the photos at once, grouped by data and the scrollbar shows the dates while you scroll. Basically what the famous big photo galleries can do. (do not expect to get implemented in full extend this year)
  * Technically it is possible to do something similar even today (searching for something like `.`), but in big galleries (50k+ photos) both the backend and fronted will be slow.
    * On the backend one bottleneck that all photo info that goes back to to client contains if thumbnail exist for that photo (does a HDD read, for 50k+ photos, 2-3 thumbnails sizes, that is a lot of `fileExist` check)
    * Rending all 50k+ photos on the page at once would trigger 50k+ http image download from the server. (RPi would just go kaboom from this :/). So some load prioritization is needed here. -> needs to be implemented.
      Furthermore, not sure, how a browser would behave If the app wants to show 50k+ photos on one html page.
    * Timeline view only make sense if pigallery could detect filesystem changes on its own (without navigating there in the app). Otherwise, people add new photos to the gallery but that wont show up in the timeline view. They would scratch their head and open tickets on github :)
  * I can imagen a partial solution, where the app can automatically detect the changes but only shows the last X (=~5k) photos. That would serve most of the use-cases, (like you open the app and sees all new photos), but the app would still be able to handle it.
3. Adding local filters. see #287 . Loading data from the server takes long, adding local filters can serve to purpose (I would need 1-2 rainy weekend for this):
  * Filtering quickly locally based on all available metadata
  * It can also provide some statistic about the rendered photos. (Like: You can filter based on keywords. To do so the app would list all available keywords with their frequency)
4. Saved search / “logical albums” #45  (I need 1-2 rainy weekend for this)
  * I plan to add this, so I can shave my family search queries, so I can show family photos to my grandma with a single click.
5. Themes / nigh modes #140  (It does not affect me closely, so it in my mind with a low priority)
  * There were already effort and PRs to make this happen, but I could not merge it in the current form. I also wanted to make it more universal, where people can define their own themes with both light and night mode)
6. Blog-ish feature: Basically the app would recognize `README.md` files in the folders and would render them once you open a folder in the app. In this case, we could add some notes, storiette to the individual folders (like memories about your holidays)
