# PiGallery2 
![GitHub package.json version](https://img.shields.io/github/package-json/v/bpatrik/pigallery2)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/bpatrik/pigallery2.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/bpatrik/pigallery2/context:javascript)
[![Build Status](https://travis-ci.org/bpatrik/pigallery2.svg?branch=master)](https://travis-ci.org/bpatrik/pigallery2)
[![Coverage Status](https://coveralls.io/repos/github/bpatrik/pigallery2/badge.svg?branch=master)](https://coveralls.io/github/bpatrik/pigallery2?branch=master)
[![Docker build](https://github.com/bpatrik/pigallery2/workflows/docker-buildx/badge.svg)](https://github.com/bpatrik/pigallery2/actions)
[![dependencies Status](https://david-dm.org/bpatrik/pigallery2/status.svg)](https://david-dm.org/bpatrik/pigallery2)
 

Homepage: http://bpatrik.github.io/pigallery2/

This is a **fast** (like faster than your PC fast) **directory-first photo gallery website**, optimised for running on low resource servers (especially on raspberry pi).

✔️ Strengths:
 * ⚡ Fast, like for real.
 * ✔️ Simple. Point to your photos folder and to a temp folder and you are good to go.

⛔ Weakness:
 * 😥 Its simple. Shows what you have that's it. No gallery changes (photo delete, rotate, enhance, tag, organize, etc), your gallery folder is read-only.
 * 📁 Optimized for galleries with <100K photos with <5k photos/folder.
      * It will work on bigger galleries, but it will start to slow down.

[You wrote about pigallery2](docs/references/README.md).

## Live Demo
Live Demo @ render: https://pigallery2.onrender.com/ 
 - the demo page **first load** might take up **30s**: the time while the free webservice boots up

![PiGallery2 - Animated gif demo](docs/demo.gif)

## Table of contents
1. [Getting started](#1-getting-started-also-works-on-raspberry-pi)
2. [Translate the page to your own language](#2-translate-the-page-to-your-own-language)
3. [Feature list](#3-feature-list)
4. [Suggest/endorse new features](#4-suggestendorse-new-features)
5. [Known errors](#5-known-errors)
6. [Credits](#6-credits) 



## 1. Getting started (also works on Raspberry Pi)

### 1.1 [Install and Run with Docker (recommended)](docker/README.md)

[Docker](https://www.docker.com/) with [docker-compose](https://docs.docker.com/compose/) is the official and recommend way of installing and running *Pigallery2*.
It contains all necessary dependencies, auto restarts on reboot, supports https, easy to upgrade to newer versions.
For configuration and docker-compose files read more [here](docker/README.md) or check all builds [here](https://hub.docker.com/r/bpatrik/pigallery2/tags/).



### 1.2 Direct Install (if you are familiar with Node.js and building npm packages from source)
As an alternative, you can also directly [install Node.js](https://www.scaler.com/topics/javascript/install-node-js/) and the app and run it natively. 
### 1.2.0 [Install Node.js](https://nodejs.org/en/download/)
Download and extract
```bash
curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Full node install on raspberry pi description: https://www.w3schools.com/nodejs/nodejs_raspberrypi.asp
 
### 1.2.1 Install PiGallery2
#### 1.2.1-a Install from release

```bash
cd ~
wget https://github.com/bpatrik/pigallery2/releases/download/1.9.0/pigallery2-release.zip
unzip pigallery2-release.zip -d pigallery2
cd pigallery2
npm install
```
#### 1.2.1-b Install from source

**Note:** A build requires a machine with around 2GB or memory.


```bash
cd ~
wget https://github.com/bpatrik/pigallery2/archive/master.zip
unzip master.zip
cd pigallery2-master # enter the unzipped directory
npm install
npm run build
```

**Note**: It is recommended to create a release version with `npm run create-release` on a more powerful machine and deploy that to you server.

**Note**: you can use `npm run create-release -- --languages=fr,ro` to restrict building to the listed languages (English is added by default)

#### 1.2.2 Run PiGallery2
```bash
npm start
```
To configure it, run `PiGallery2` first to create `config.json` file, then edit it and restart.
The app has a nice UI for settings, you may use that too. 

Default user: `admin` pass: `admin`. (It is not possible to change the admin password, you need to create another user and delete the default `admin` user, see  [#220](https://github.com/bpatrik/pigallery2/issues/220))

**Note**: First run, you might have file access issues and port 80 issue, see [#115](https://github.com/bpatrik/pigallery2/issues/115).
Running `npm start -- --Server-port=8080` will start the app on port 8080 that does not require `root`
Adding read/write permissions to all files can solve the file access issue `chmod -R o-w .`, see [#98](https://github.com/bpatrik/pigallery2/issues/98).

##### 1.2.2.1 Run on startup
You can run the app up as a service to run it on startup. Read more at [#42](https://github.com/bpatrik/pigallery2/issues/42#issuecomment-458340945)

### 1.3 Advanced configuration
You can set up the app any of the following ways:
 1. Using the UI (recommended)
 2. Manually editing the `config.json`
 3. Through switches
    * Like: `node start -- --Server-port=3000 --Client-authenticationRequired=false`
    * You can check the generated `config.json` for the config hierarchy
 4. Through environmental variable
    * like set env. variable `Server-port` to `3000`   

Full list of configuration options are available at the [MANPAGE.md](MANPAGE.md).

### 1.4 Useful links/tips:

#### using nginx
It is recommended to use a reverse proxy like nginx before node
https://stackoverflow.com/questions/5009324/node-js-nginx-what-now

#### making https
With cerbot & nginx it is simple to set up secure connection. You have no excuse not doing so.
https://certbot.eff.org/

#### node install error:
If you get error during module installation, make sure you have everything to build node modules from source
```bash
apt-get install build-essential  libkrb5-dev gcc g++
```


## 2. Translate the page to your own language
1. [Install Pigallery2](#121-b-install-from-source) from source (with the release it won't work) 
2. add your language e.g: fr
   * copy `src/frontend/translate/messages.en.xls` to `src/frontend/translate/messages.fr.xls`
   * add the new translation to the `angular.json` `projects->pigallery2->i18n->locales` section 
3. translate the file by updating the `<target>` tags
4. test if it works:
   build and start the app
   ```bash
   npm install
   npm run build
   npm start
   ```
5. (optional) create a pull request at github to add your translation to the project.

**Note**: you can also build your own release with as described in [1.1.1-b Install from source](#121-b-install-from-source);



## 3. Feature list

See: http://bpatrik.github.io/pigallery2/
 
## 4. Suggest/endorse new features
  Unfortunately, I only have a limited time for this hobby project of mine. 
  And I mostly focus on those features that are align with my needs. Sorry :(.
  Although, I try to fix bugs ASAP (that can still take from a few days to months).
  **The recommended way of extending the projects is to implement the feature as an extension.** See [#743](https://github.com/bpatrik/pigallery2/issues/743).
  If the extension framweork is not powerfull enough, so you can't implement your feature, you are welcome to open a FR bug and I will consider adding that.
  If you really want to contribute and think that your feature has a place in the mainapp, look at [CONTRIBUTING.md](https://github.com/bpatrik/pigallery2/blob/master/CONTRIBUTING.md) for some guidance.

## 5. Known errors
* IOS map issue
  * Map on IOS prevents using the buttons in the image preview navigation, see #155
* Video support on weak servers (like raspberry pi) with low upload rate
  * video playback may use up too much resources and the server might not respond for a while. Enable video transcoding in the app, to transcode the videos to lover bitrate. 
* When using an Apache proxy, sub folders are not accessible
  * add `AllowEncodedSlashes On` in the configuration of the proxy

## 6. Supporting the project
I'm making this app for my own entertainment,
but I like to share it with others as the contributions and bug reports make the app better
and it also does not cost anything to me :)

There is [no way to donate](https://github.com/bpatrik/pigallery2/discussions/328#discussioncomment-894546) to this project at the moment. And I'm also not planning on monetizing it.
But it warms my hearth [seeing that it is useful for some people](docs/references/README.md). 


## 6. Credits
Crossbrowser testing sponsored by [Browser Stack](https://www.browserstack.com)
[<img src="https://camo.githubusercontent.com/a7b268f2785656ab3ca7b1cbb1633ee5affceb8f/68747470733a2f2f64677a6f7139623561736a67312e636c6f756466726f6e742e6e65742f70726f64756374696f6e2f696d616765732f6c61796f75742f6c6f676f2d6865616465722e706e67" alt="Browser Stack" height="31px" style="background: cornflowerblue;">](https://www.browserstack.com)
