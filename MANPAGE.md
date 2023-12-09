# Pigallery 2 man page
pigallery2 uses [typeconfig](https://github.com/bpatrik/typeconfig) for configuration

`npm start -- --help` prints the following:

```
Usage: <appname> [options] 

Meta cli options: 
--help                           prints this manual 
--config-path                    sets the config file location 
--config-attachState             prints the value state (default, readonly, volatile, etc..) to the config file 
--config-attachDesc              prints description to the config file 
--config-rewrite-cli             updates the config file with the options from cli switches 
--config-rewrite-env             updates the config file with the options from environmental variables 
--config-string-enum             enums are stored as string in the config file (instead of numbers) 
--config-save-if-not-exist       creates config file if not exist 
--config-save-and-exist          creates config file and terminates 

<appname> can be configured through the configuration file, cli switches and environmental variables. 
All settings are case-sensitive. 
Example for setting config MyConf through cli: '<appname> --MyConf=5' 
and through env variable: 'SET MyConf=5' . 

Default values can be also overwritten by prefixing the options with 'default-', 
 like '<appname> --default-MyConf=5' and  'SET default-MyConf=5'

App CLI options: 
  --Server-applicationTitle                                                  (default: 'PiGallery 2')
  --Server-publicUrl                                                        If you access the page form local network its good to know the public url for creating sharing link. (default: '')
  --Server-urlBase                                                          If you access the gallery under a sub url (like: http://mydomain.com/myGallery), set it here. If it is not working you might miss the '/' from the beginning of the url. (default: '')
  --Server-apiPath                                                          PiGallery api path. (default: '/pgapi')
  --Server-customHTMLHead                                                   Injects the content of this between the <head></head> HTML tags of the app. (You can use it add analytics or custom code to the app). (default: '')
  --Server-svgIcon-viewBox                                                  SVG path viewBox. See: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/viewBox (default: '0 0 512 512')
  --Server-svgIcon-items                                                    Content elements (paths, circles, rects) of the SVG icon. Icons used on the map: fontawesome.com/icons. (default: '<path d="m185.92 0.042372c-3.1045 0.19567-6.2676 1.0899-9.1546 3.163-16.085-8.0588-25.565 1.6894-23.504 14.76-5.3047 4.0078-10.768 7.8463-6.3153 20.688-4.8283 4.5113-5.2702 11.17-1.2227 20.894-4.5731 7.1343-3.0927 13.944 1.4676 20.445-5.0506 10.26 3.7514 20.507 6.2389 23.943-0.99909 6.6761-0.49742 13.458 11.016 21.392-1.2207 10.005 5.7492 14.415 12.419 19.045 12.567 8.1824 17.213 7.2406 27.088 10.328l-0.13366-1.1862c-15.833 3e-3 -31.017 6.2997-42.211 17.506l-24.715 24.736c-11.194 11.206-26.378 17.503-42.211 17.506h-34.984c-32.972 3.6e-4 -59.702 26.751-59.701 59.749v179.24c3.6312e-4 32.997 26.729 59.746 59.701 59.747h358.21c32.972-3.6e-4 59.7-26.75 59.701-59.747v-179.24c-0.0162-23.02-13.245-43.983-34.008-53.889 3.0728-1.7781 5.0617-4.3071 6.7327-7.0379 4.1124-1.032 17.438-3.2179 20.159-14.327 7.7661-2.0112 13.273-6.2767 14.255-14.719 9.3465-4.8456 13.285-10.23 12.484-16.792 11.694-7.0704 9.9759-13.526 8.4511-19.912 9.9742-8.687 8.874-22.288-8.6236-26.461-3.1292-12.25-18.501-15.32-20.733-16.133-1.3931-4.0275-3.7026-7.9496-14.353-10.399-4.4451-8.3291-12.211-9.9464-20.904-9.9225-6.4476-10.379-14.548-6.8393-22.216-7.2124-9.6958-7.4917-13.951-3.6525-20.032-3.5572-11.02-6.8739-16.687-2.7782-24.497 0.86675l-6.6602-2.5355c-21.868 3.9146-38.57 22.031-45.765 31.84 0.78895-12.143-0.36806-36.764-14.606-53.831l-6.7327-2.3414c-3.6422-7.8167-5.3526-14.6-18.209-16.423-4.7287-3.9225-5.388-9.6636-17.627-10.162-3.9701-2.9861-7.0841-7.4205-11.972-9.091-2.5588-0.82206-5.6927-0.97346-9.6817 0.32356-6.6078-5.7069-13.63-9.3648-22.385-5.8437-9.7319-4.9749-14.082-3.5883-17.674-1.2668-1.3952-0.50821-7.2885-3.6439-14.018-4.1239-1.0094-0.071996-2.0376-0.084841-3.0724-0.019609zm1.017 13.578c10.104 0.93027 18.591 7.2129 24.705 11.86 3.989-1.297 1.8817-5.4748-0.67601-9.9264 7.4731 3.9321 13.922 8.2611 19.542 13.058 4.4921-1.7738-6e-3 -6.9333-1.6283-10.934 11.32 6.6532 15.299 11.732 19.277 16.811 4.96-2.1534 2.5609-6.4373 1.1326-10.368 7.9224 6.6257 11.087 12.731 14.482 18.808 2.4625-1.6331 5.6853-2.3301 4.5577-8.9008 5.1605 6.0597 8.5191 12.233 10.344 18.398 4.8979-1.076 4.6167-5.1376 5.7471-8.2459 4.8158 7.9142 7.0028 15.201 10.195 22.743 1.3502-0.38818 3.143-2.596 5.5002-6.3575 10.495 21.313 19.172 68.475-19.542 71.864-19.845-33.079-47.35-62.019-80.099-88.028 39.018 41.712 59.701 71.578 68.828 93.932-5.6123 8.2892-13.186 12.888-21.423 15.182h-31.496c-9.0855-1.8937-17.047-4.8048-21.968-6.9301 3.5034-0.26396 6.761-1.0578 8.553-3.265-2.8932-4.1339-16.942-6.6095-24.423-15.054 3.8384 0.62815 5.771 0.45179 8.3395-1.4727-7.7461-5.9015-16.277-11.759-20.149-18.339 3.0088 1.096 5.5764 2.7998 10.448 1.4943-6.3427-7.0404-13.489-13.382-17.696-22.065 4.1118 1.3877 8.4445 3.0751 10.271 1.9806-5.5926-6.9871-9.844-14.035-12.948-21.216 5.3821 2.7304 8.0206 3.0315 9.7326 2.5551-3.457-7.4192-8.6517-14.592-9.4172-22.461 3.6436 2.9772 7.3478 4.8776 10.904 3.8631-0.36036-4.7513-7.3377-10.044-8.4022-21.322 4.3234 2.0148 8.7693 4.2946 10.093 3.6768 0.9645-8.9987-0.93024-14.97-2.5963-20.967 9.547 3.3675 23.877 8.6978 23.48 7.6733zm202.89 68.954c-1.1657 3.2054-4.0535 6.0044-0.89552 10.015 5.3574-3.5486 11.898-6.1175 19.744-7.4399-5.0841 4.3081-3.1624 6.8795-2.228 9.7499 6.5043-2.4708 12.815-5.0123 23.175-5.0887-3.6187 2.0919-8.2066 3.8292-5.7902 8.6694 6.3098-1.3316 12.62-2.6636 25.565-0.47848-3.8128 2.0212-10.67 3.0443-8.2709 7.3281 7.289-0.095 15.142 0.67658 23.357 2.5689-4.9157 1.7295-9.1161 3.6077-6.8934 7.1673 7.6683 0.37321 18.204 1.0216 26.541 6.8085l-7.9768 3.8043c-0.96209 0.52956 13.473 5.5674 22.914 9.2263-5.2605 3.5839-10.415 6.8757-15.456 14.39 0.61731 1.3249 5.4871 2.4391 10.093 3.6768-8.059 7.9545-16.768 7.4235-20.131 10.928 2.0376 3.1622 6.0354 3.9567 10.836 4.0553-5.7375 5.5002-14.227 7.6885-21.64 11.148 1.0057 1.4663 3.2192 2.9338 9.0958 4.3043-6.9901 3.5039-14.773 6.1675-23.545 7.9223 0.73194 1.9166 5.0978 3.5087 9.1389 5.0907-8.7991 3.945-18.346 4.207-27.726 5.5201 2.9287 4.0367 5.9538 4.4791 8.9626 5.575-7.1926 2.5501-17.455 1.4514-27.215 1.0864 0.46776 2.1663 1.3155 3.4454 2.7961 4.6612h-13.75c-5.1274-1.4192-9.4503-2.9189-11.788-2.2747-0.0214 0.78201 0.12538 1.5366 0.37044 2.2747h-6.1841c-2.2143-0.16717-4.4175-0.45785-6.5995-0.87068-17.23-8.2945-37.615-23.515-35.198-47.897 21.35-11.254 56.342-20.728 113.06-27.679-41.792-1.1427-81.452 3.3317-117.9 15.905-27.674-27.57 9.2662-58.115 30.995-67.691-0.70716 4.3624-0.65582 7.2407 0.12836 8.4067 7.2901-3.7246 13.646-7.8991 22.418-10.864zm-186.04 100.82h69.97c7.9167 2e-3 15.508 3.1505 21.105 8.7538l24.717 24.736c16.798 16.816 39.584 26.262 63.343 26.259h34.984c16.486 1.9e-4 29.85 13.375 29.85 29.873v179.24c-1.9e-4 16.499-13.365 29.873-29.85 29.873h-358.21c-16.486-1.8e-4 -29.85-13.375-29.85-29.873v-179.24c1.88e-4 -16.499 13.365-29.873 29.85-29.873h34.984c23.739-0.0128 46.501-9.4579 63.285-26.259l24.775-24.736c5.582-5.5884 13.149-8.736 21.045-8.7538zm35.016 59.749c-57.625 0.10848-104.28 46.889-104.28 104.56 0 57.669 46.656 104.45 104.28 104.56 57.625-0.10848 104.28-46.889 104.28-104.56 0-57.669-46.656-104.45-104.28-104.56zm-164.18 29.873c-8.2429 9e-5 -14.925 6.6874-14.925 14.937 0.03875 8.2218 6.7096 14.866 14.925 14.866s14.886-6.6446 14.925-14.866c-9.1e-5 -8.2493-6.6823-14.937-14.925-14.937zm164.18 0c41.206 0.0135 74.603 33.447 74.603 74.684 0 41.238-33.397 74.671-74.603 74.684-41.206-0.0135-74.603-33.447-74.603-74.684 0-41.238 33.397-74.671 74.603-74.684z"/>')
  --Server-sessionSecret                                                     (default: [])
  --Server-sessionTimeout                                                   Users kept logged in for this long time. (default: 604800000)
  --Server-port                                                             Port number. Port 80 is usually what you need. (default: 80)
  --Server-host                                                             Server will accept connections from this IPv6 or IPv4 address. (default: '0.0.0.0')
  --Server-Threading-enabled                                                [Deprecated, will be removed in the next release] Runs directory scanning and thumbnail generation in a different thread. (default: false)
  --Server-Threading-thumbnailThreads                                       Number of threads that are used to generate thumbnails. If 0, number of 'CPU cores -1' threads will be used. (default: 0)
  --Server-Log-level                                                        Logging level. (default: 'info')
  --Server-Log-sqlLevel                                                     Logging level for SQL queries. (default: 'error')
  --Server-Log-logServerTiming                                              If enabled, the app ads "Server-Timing" http header to the response. (default: false)
  --Users-authenticationRequired                                            Enables user management with login to password protect the gallery. (default: true)
  --Users-unAuthenticatedUserRole                                           Default user right when password protection is disabled. (default: 'Admin')
  --Users-enforcedUsers                                                     Creates these users in the DB during startup if they do not exist. If a user with this name exist, it won't be overwritten, even if the role is different. (default: [])
  --Gallery-enableCache                                                     Caches directory contents and search results for better performance. (default: true)
  --Gallery-enableOnScrollRendering                                         Those thumbnails get higher priority that are visible on the screen. (default: true)
  --Gallery-enableDirectorySortingByDate                                    If enabled, directories will be sorted by date, like photos, otherwise by name. Directory date is the last modification time of that directory not the creation date of the oldest photo. (default: false)
  --Gallery-enableOnScrollThumbnailPrioritising                             Those thumbnails will be rendered first that are in view. (default: true)
  --Gallery-NavBar-enableDownloadZip                                        Enable download zip of a directory contents Directory flattening. (Does not work for searches.) (default: false)
  --Gallery-NavBar-enableDirectoryFlattening                                Adds a button to flattens the file structure, by listing the content of all subdirectories. (Won't work if the gallery has multiple folders with the same path.) (default: false)
  --Gallery-NavBar-defaultGidSize                                           Default grid size that is used to render photos and videos. (default: 'medium')
  --Gallery-NavBar-showItemCount                                            Shows the number photos and videos on the navigation bar. (default: true)
  --Gallery-NavBar-links                                                    Visible links in the top menu. (default: [{"type":1},{"type":3},{"type":2}])
  --Gallery-NavBar-NavbarShowDelay                                          Ratio of the page height, you need to scroll to show the navigation bar. (default: 0.3)
  --Gallery-NavBar-NavbarHideDelay                                          Ratio of the page height, you need to scroll to hide the navigation bar. (default: 0.15)
  --Gallery-NavBar-showScrollUpButton                                       Set when the floating scroll-up button should be visible. (default: 'mobileOnly')
  --Gallery-NavBar-SortingGrouping-defaultPhotoSortingMethod-method          (default: 'Date')
  --Gallery-NavBar-SortingGrouping-defaultPhotoSortingMethod-ascending       (default: true)
  --Gallery-NavBar-SortingGrouping-defaultSearchSortingMethod-method         (default: 'Date')
  --Gallery-NavBar-SortingGrouping-defaultSearchSortingMethod-ascending      (default: false)
  --Gallery-NavBar-SortingGrouping-defaultPhotoGroupingMethod-method         (default: 'Date')
  --Gallery-NavBar-SortingGrouping-defaultPhotoGroupingMethod-ascending      (default: true)
  --Gallery-NavBar-SortingGrouping-defaultSearchGroupingMethod-method        (default: 'Date')
  --Gallery-NavBar-SortingGrouping-defaultSearchGroupingMethod-ascending     (default: false)
  --Gallery-captionFirstNaming                                              Show the caption (IPTC 120) tags from the EXIF data instead of the filenames. (default: false)
  --Gallery-Lightbox-defaultSlideshowSpeed                                  Default time interval for displaying a photo in the slide show. (default: 5)
  --Gallery-Lightbox-captionAlwaysOn                                        If enabled, lightbox will always show caption by default, not only on hover. (default: false)
  --Gallery-Lightbox-facesAlwaysOn                                          If enabled, lightbox will always show faces by default, not only on hover. (default: false)
  --Gallery-Lightbox-loopVideos                                             If enabled, lightbox will loop videos by default. (default: false)
  --Gallery-Themes-enabled                                                  Enable themes and color modes. (default: true)
  --Gallery-Themes-defaultMode                                              Sets the default theme mode that is used for the application. (default: 'auto')
  --Gallery-Themes-selectedTheme                                            Selected theme to use on the site. (default: 'classic')
  --Gallery-Themes-availableThemes                                          Adds these css settings as it is to the end of the body tag of the page. (default: [{"name":"classic","theme":":root nav.navbar {\n--bs-navbar-color: rgba(255, 255, 255, 0.55);\n--bs-navbar-hover-color: rgba(255, 255, 255, 0.75);\n--bs-navbar-disabled-color: rgba(255, 255, 255, 0.25);\n--bs-navbar-active-color: #fff;\n--bs-navbar-brand-color: #fff;\n--bs-navbar-brand-hover-color: #fff;\n--bs-bg-opacity: 1;\nbackground-color: rgba(var(--bs-dark-rgb), var(--bs-bg-opacity)) !important;\n}"}])
  --Gallery-InlineBlogStartsOpen                                            Makes inline blog (*.md files content) to be auto open. (default: false)
  --Gallery-TopBlogStartsOpen                                               Makes inline blog (*.md files content) to be auto open. (default: false)
  --Media-Thumbnail-iconSize                                                Icon size (used on maps). (default: 45)
  --Media-Thumbnail-personThumbnailSize                                     Person (face) thumbnail size. (default: 200)
  --Media-Thumbnail-thumbnailSizes                                          Size of the thumbnails. The best matching size will be generated. More sizes give better quality, but use more storage and CPU to render. If size is 240, that shorter side of the thumbnail will have 160 pixels. (default: [240,480])
  --Media-Thumbnail-useLanczos3                                             if true, 'lanczos3' will used to scale photos, otherwise faster but lower quality 'nearest'. (default: true)
  --Media-Thumbnail-quality                                                 Between 0-100. (default: 80)
  --Media-Thumbnail-smartSubsample                                          Use high quality chroma subsampling in webp. See: https://sharp.pixelplumbing.com/api-output#webp. (default: true)
  --Media-Thumbnail-personFaceMargin                                        This ratio of the face bounding box will be added to the face as a margin. Higher number add more margin. (default: 0.7)
  --Media-Video-enabled                                                      (default: true)
  --Media-Video-supportedFormatsWithTranscoding                             Video formats that are supported after transcoding (with the build-in ffmpeg support). (default: ["avi","mkv","mov","wmv","flv","mts","m2ts","mpg","3gp","m4v","mpeg","vob","divx","xvid","ts"])
  --Media-Video-supportedFormats                                            Video formats that are supported also without transcoding. Browser supported formats: https://www.w3schools.com/html/html5_video.asp (default: ["mp4","webm","ogv","ogg"])
  --Media-Video-transcoding-bitRate                                         Target bit rate of the output video will be scaled down this this. This should be less than the upload rate of your home server. (default: 5242880)
  --Media-Video-transcoding-resolution                                      The height of the output video will be scaled down to this, while keeping the aspect ratio. (default: 720)
  --Media-Video-transcoding-fps                                             Target frame per second (fps) of the output video will be scaled down this this. (default: 25)
  --Media-Video-transcoding-format                                           (default: 'mp4')
  --Media-Video-transcoding-mp4Codec                                         (default: 'libx264')
  --Media-Video-transcoding-webmCodec                                        (default: 'libvpx')
  --Media-Video-transcoding-crf                                             The range of the Constant Rate Factor (CRF) scale is 0–51, where 0 is lossless, 23 is the default, and 51 is worst quality possible. (default: 23)
  --Media-Video-transcoding-preset                                          A preset is a collection of options that will provide a certain encoding speed to compression ratio. A slower preset will provide better compression (compression is quality per filesize). (default: 'medium')
  --Media-Video-transcoding-customOutputOptions                             It will be sent to ffmpeg as it is, as custom output options. (default: [])
  --Media-Video-transcoding-customInputOptions                              It will be sent to ffmpeg as it is, as custom input options. (default: [])
  --Media-Photo-Converting-enabled                                          Enable photo converting. (default: true)
  --Media-Photo-Converting-loadFullImageOnZoom                              Enables loading the full resolution image on zoom in the ligthbox (preview). (default: true)
  --Media-Photo-Converting-onTheFly                                         Converts photos on the fly, when they are requested. (default: true)
  --Media-Photo-Converting-resolution                                       The shorter edge of the converted photo will be scaled down to this, while keeping the aspect ratio. (default: 1080)
  --Media-Photo-supportedFormats                                            Photo formats that are supported. Browser needs to support these formats natively. Also sharp (libvips) package should be able to convert these formats. (default: ["gif","jpeg","jpg","jpe","png","webp","svg"])
  --Media-folder                                                            Images are loaded from this folder (read permission required) (default: 'demo/images')
  --Media-tempFolder                                                        Thumbnails, converted photos, videos will be stored here (write permission required) (default: 'demo/tmp')
  --Media-photoMetadataSize                                                 Only this many bites will be loaded when scanning photo/video for metadata. Increase this number if your photos shows up as square. (default: 524288)
  --MetaFile-gpx                                                            Reads *.gpx files and renders them on the map. (default: true)
  --MetaFile-GPXCompressing-enabled                                         Enables lossy (based on delta time and distance. Too frequent points are removed) GPX compression. (default: true)
  --MetaFile-GPXCompressing-onTheFly                                        Enables on the fly *.gpx compression. (default: true)
  --MetaFile-GPXCompressing-minDistance                                     Filters out entry that are closer than this to each other in meters. (default: 5)
  --MetaFile-GPXCompressing-maxMiddleDeviance                               Filters out entry that would fall on the line if we would just connect the previous and the next points. This setting sets the sensitivity for that (higher number, more points are filtered). (default: 5)
  --MetaFile-GPXCompressing-minTimeDistance                                 Filters out entry that are closer than this in time in milliseconds. (default: 5000)
  --MetaFile-markdown                                                       Reads *.md files in a directory and shows the next to the map. (default: true)
  --MetaFile-pg2conf                                                        Reads *.pg2conf files (You can use it for custom sorting and saved search (albums)). (default: true)
  --MetaFile-supportedFormats                                               The app will read and process these files. (default: ["gpx","pg2conf","md"])
  --Album-enabled                                                            (default: true)
  --Search-enabled                                                          Enables searching. (default: true)
  --Search-searchCacheTimeout                                               Search cache timeout. (default: 3600000)
  --Search-AutoComplete-enabled                                             Show hints while typing search query. (default: true)
  --Search-AutoComplete-ItemsPerCategory-maxItems                           Maximum number autocomplete items shown at once. If there is not enough items to reach this value, it takes upto double of the individual items. (default: 20)
  --Search-AutoComplete-ItemsPerCategory-fileName                           Maximum number autocomplete items shown per photo category. (default: 2)
  --Search-AutoComplete-ItemsPerCategory-directory                          Maximum number autocomplete items shown per directory category. (default: 2)
  --Search-AutoComplete-ItemsPerCategory-caption                            Maximum number autocomplete items shown per caption category. (default: 3)
  --Search-AutoComplete-ItemsPerCategory-position                           Maximum number autocomplete items shown per position category. (default: 3)
  --Search-AutoComplete-ItemsPerCategory-person                             Maximum number autocomplete items shown per faces category. (default: 5)
  --Search-AutoComplete-ItemsPerCategory-keyword                            Maximum number autocomplete items shown per keyword category. (default: 5)
  --Search-AutoComplete-cacheTimeout                                        Autocomplete cache timeout.  (default: 3600000)
  --Search-maxMediaResult                                                   Maximum number of photos and videos that are listed in one search result. (default: 10000)
  --Search-maxDirectoryResult                                               Maximum number of directories that are listed in one search result. (default: 200)
  --Search-listDirectories                                                  Search returns also with directories, not just media. (default: false)
  --Search-listMetafiles                                                    Search also returns with metafiles from directories that contain a media file of the matched search result. (default: true)
  --Sharing-enabled                                                         Enables sharing. (default: true)
  --Sharing-passwordProtected                                               Enables password protected sharing links. (default: true)
  --Sharing-updateTimeout                                                   After creating a sharing link, it can be updated for this long. (default: 300000)
  --Map-enabled                                                              (default: true)
  --Map-useImageMarkers                                                     Map will use thumbnail images as markers instead of the default pin. (default: true)
  --Map-mapProvider                                                          (default: 'OpenStreetMap')
  --Map-mapboxAccessToken                                                   MapBox needs an access token to work, create one at https://www.mapbox.com. (default: '')
  --Map-customLayers                                                        The map module will use these urls to fetch the map tiles. (default: [{"name":"street","url":"","darkLayer":false}])
  --Map-maxPreviewMarkers                                                   Maximum number of markers to be shown on the map preview on the gallery page. (default: 50)
  --Map-MapPathGroupConfig                                                  Markers are grouped and themed by these settings (default: [{"name":"Transportation","matchers":[{"matchers":["flight","flying"],"theme":{"color":"var(--bs-orange)","dashArray":"4 8","svgIcon":{"viewBox":"0 0 567 512","items":"<path d=\"M482.3 192c34.2 0 93.7 29 93.7 64c0 36-59.5 64-93.7 64l-116.6 0L265.2 495.9c-5.7 10-16.3 16.1-27.8 16.1l-56.2 0c-10.6 0-18.3-10.2-15.4-20.4l49-171.6L112 320 68.8 377.6c-3 4-7.8 6.4-12.8 6.4l-42 0c-7.8 0-14-6.3-14-14c0-1.3 .2-2.6 .5-3.9L32 256 .5 145.9c-.4-1.3-.5-2.6-.5-3.9c0-7.8 6.3-14 14-14l42 0c5 0 9.8 2.4 12.8 6.4L112 192l102.9 0-49-171.6C162.9 10.2 170.6 0 181.2 0l56.2 0c11.5 0 22.1 6.2 27.8 16.1L365.7 192l116.6 0z\"/>"}}},{"matchers":["drive","driving"],"theme":{"color":"var(--bs-orange)","dashArray":"4 8","svgIcon":{"viewBox":"0 0 640 512","items":"<path d=\"M171.3 96H224v96H111.3l30.4-75.9C146.5 104 158.2 96 171.3 96zM272 192V96h81.2c9.7 0 18.9 4.4 25 12l67.2 84H272zm256.2 1L428.2 68c-18.2-22.8-45.8-36-75-36H171.3c-39.3 0-74.6 23.9-89.1 60.3L40.6 196.4C16.8 205.8 0 228.9 0 256V368c0 17.7 14.3 32 32 32H65.3c7.6 45.4 47.1 80 94.7 80s87.1-34.6 94.7-80H385.3c7.6 45.4 47.1 80 94.7 80s87.1-34.6 94.7-80H608c17.7 0 32-14.3 32-32V320c0-65.2-48.8-119-111.8-127zM434.7 368a48 48 0 1 1 90.5 32 48 48 0 1 1 -90.5-32zM160 336a48 48 0 1 1 0 96 48 48 0 1 1 0-96z\"/>"}}},{"matchers":["ship","sailing","cruise"],"theme":{"color":"var(--bs-orange)","dashArray":"4 8","svgIcon":{"viewBox":"0 0 576 512","items":"<path d=\"M256 16c0-7 4.5-13.2 11.2-15.3s13.9 .4 17.9 6.1l224 320c3.4 4.9 3.8 11.3 1.1 16.6s-8.2 8.6-14.2 8.6H272c-8.8 0-16-7.2-16-16V16zM212.1 96.5c7 1.9 11.9 8.2 11.9 15.5V336c0 8.8-7.2 16-16 16H80c-5.7 0-11-3-13.8-8s-2.9-11-.1-16l128-224c3.6-6.3 11-9.4 18-7.5zM5.7 404.3C2.8 394.1 10.5 384 21.1 384H554.9c10.6 0 18.3 10.1 15.4 20.3l-4 14.3C550.7 473.9 500.4 512 443 512H133C75.6 512 25.3 473.9 9.7 418.7l-4-14.3z\"/>"}}}]},{"name":"Sport","matchers":[{"matchers":["run"],"theme":{"color":"var(--bs-primary)","dashArray":"","svgIcon":{"viewBox":"0 0 417 512","items":"<path d=\"M320 48a48 48 0 1 0 -96 0 48 48 0 1 0 96 0zM125.7 175.5c9.9-9.9 23.4-15.5 37.5-15.5c1.9 0 3.8 .1 5.6 .3L137.6 254c-9.3 28 1.7 58.8 26.8 74.5l86.2 53.9-25.4 88.8c-4.9 17 5 34.7 22 39.6s34.7-5 39.6-22l28.7-100.4c5.9-20.6-2.6-42.6-20.7-53.9L238 299l30.9-82.4 5.1 12.3C289 264.7 323.9 288 362.7 288H384c17.7 0 32-14.3 32-32s-14.3-32-32-32H362.7c-12.9 0-24.6-7.8-29.5-19.7l-6.3-15c-14.6-35.1-44.1-61.9-80.5-73.1l-48.7-15c-11.1-3.4-22.7-5.2-34.4-5.2c-31 0-60.8 12.3-82.7 34.3L57.4 153.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l23.1-23.1zM91.2 352H32c-17.7 0-32 14.3-32 32s14.3 32 32 32h69.6c19 0 36.2-11.2 43.9-28.5L157 361.6l-9.5-6c-17.5-10.9-30.5-26.8-37.9-44.9L91.2 352z\"/>"}}},{"matchers":["walk"],"theme":{"color":"var(--bs-primary)","dashArray":"","svgIcon":{"viewBox":"0 0 320 512","items":"<path d=\"M160 48a48 48 0 1 1 96 0 48 48 0 1 1 -96 0zM126.5 199.3c-1 .4-1.9 .8-2.9 1.2l-8 3.5c-16.4 7.3-29 21.2-34.7 38.2l-2.6 7.8c-5.6 16.8-23.7 25.8-40.5 20.2s-25.8-23.7-20.2-40.5l2.6-7.8c11.4-34.1 36.6-61.9 69.4-76.5l8-3.5c20.8-9.2 43.3-14 66.1-14c44.6 0 84.8 26.8 101.9 67.9L281 232.7l21.4 10.7c15.8 7.9 22.2 27.1 14.3 42.9s-27.1 22.2-42.9 14.3L247 287.3c-10.3-5.2-18.4-13.8-22.8-24.5l-9.6-23-19.3 65.5 49.5 54c5.4 5.9 9.2 13 11.2 20.8l23 92.1c4.3 17.1-6.1 34.5-23.3 38.8s-34.5-6.1-38.8-23.3l-22-88.1-70.7-77.1c-14.8-16.1-20.3-38.6-14.7-59.7l16.9-63.5zM68.7 398l25-62.4c2.1 3 4.5 5.8 7 8.6l40.7 44.4-14.5 36.2c-2.4 6-6 11.5-10.6 16.1L54.6 502.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L68.7 398z\"/>"}}},{"matchers":["hike","hiking"],"theme":{"color":"var(--bs-primary)","dashArray":"","svgIcon":{"viewBox":"0 0 384 512","items":"<path d=\"M192 48a48 48 0 1 1 96 0 48 48 0 1 1 -96 0zm51.3 182.7L224.2 307l49.7 49.7c9 9 14.1 21.2 14.1 33.9V480c0 17.7-14.3 32-32 32s-32-14.3-32-32V397.3l-73.9-73.9c-15.8-15.8-22.2-38.6-16.9-60.3l20.4-84c8.3-34.1 42.7-54.9 76.7-46.4c19 4.8 35.6 16.4 46.4 32.7L305.1 208H336V184c0-13.3 10.7-24 24-24s24 10.7 24 24v55.8c0 .1 0 .2 0 .2s0 .2 0 .2V488c0 13.3-10.7 24-24 24s-24-10.7-24-24V272H296.6c-16 0-31-8-39.9-21.4l-13.3-20zM81.1 471.9L117.3 334c3 4.2 6.4 8.2 10.1 11.9l41.9 41.9L142.9 488.1c-4.5 17.1-22 27.3-39.1 22.8s-27.3-22-22.8-39.1zm55.5-346L101.4 266.5c-3 12.1-14.9 19.9-27.2 17.9l-47.9-8c-14-2.3-22.9-16.3-19.2-30L31.9 155c9.5-34.8 41.1-59 77.2-59h4.2c15.6 0 27.1 14.7 23.3 29.8z\"/>"}}},{"matchers":["bike","biking","cycling"],"theme":{"color":"var(--bs-primary)","dashArray":"","svgIcon":{"viewBox":"0 0 640 512","items":"<path d=\"M400 96a48 48 0 1 0 0-96 48 48 0 1 0 0 96zm27.2 64l-61.8-48.8c-17.3-13.6-41.7-13.8-59.1-.3l-83.1 64.2c-30.7 23.8-28.5 70.8 4.3 91.6L288 305.1V416c0 17.7 14.3 32 32 32s32-14.3 32-32V288c0-10.7-5.3-20.7-14.2-26.6L295 232.9l60.3-48.5L396 217c5.7 4.5 12.7 7 20 7h64c17.7 0 32-14.3 32-32s-14.3-32-32-32H427.2zM56 384a72 72 0 1 1 144 0A72 72 0 1 1 56 384zm200 0A128 128 0 1 0 0 384a128 128 0 1 0 256 0zm184 0a72 72 0 1 1 144 0 72 72 0 1 1 -144 0zm200 0a128 128 0 1 0 -256 0 128 128 0 1 0 256 0z\"/>"}}},{"matchers":["skiing","ski"],"theme":{"color":"var(--bs-primary)","dashArray":"","svgIcon":{"viewBox":"0 0 512 512","items":"<path d=\"M380.7 48a48 48 0 1 1 96 0 48 48 0 1 1 -96 0zM2.7 268.9c6.1-11.8 20.6-16.3 32.4-10.2L232.7 361.3l46.2-69.2-75.1-75.1c-14.6-14.6-20.4-33.9-18.4-52.1l108.8 52 39.3 39.3c16.2 16.2 18.7 41.5 6 60.6L289.8 391l128.7 66.8c13.6 7.1 29.8 7.2 43.6 .3l15.2-7.6c11.9-5.9 26.3-1.1 32.2 10.7s1.1 26.3-10.7 32.2l-15.2 7.6c-27.5 13.7-59.9 13.5-87.2-.7L12.9 301.3C1.2 295.2-3.4 280.7 2.7 268.9zM118.9 65.6L137 74.2l8.7-17.4c4-7.9 13.6-11.1 21.5-7.2s11.1 13.6 7.2 21.5l-8.5 16.9 54.7 26.2c1.5-.7 3.1-1.4 4.7-2.1l83.4-33.4c34.2-13.7 72.8 4.2 84.5 39.2l17.1 51.2 52.1 26.1c15.8 7.9 22.2 27.1 14.3 42.9s-27.1 22.2-42.9 14.3l-58.1-29c-11.4-5.7-20-15.7-24.1-27.8l-5.8-17.3-27.3 12.1-6.8 3-6.7-3.2L151.5 116.7l-9.2 18.4c-4 7.9-13.6 11.1-21.5 7.2s-11.1-13.6-7.2-21.5l9-18-17.6-8.4c-8-3.8-11.3-13.4-7.5-21.3s13.4-11.3 21.3-7.5z\"/>"}}}]},{"name":"Other paths","matchers":[{"matchers":[],"theme":{"color":"var(--bs-secondary)","dashArray":"","svgIcon":{"viewBox":"0 0 512 512","items":""}}}]}])
  --Map-bendLongPathsTrigger                                                Map will bend the path if two points are this far apart on latititude axes. This intended to bend flight if only the end and the start points are given. (default: 0.5)
  --Faces-enabled                                                            (default: true)
  --Faces-keywordsToPersons                                                 If a photo has the same face (person) name and keyword, the app removes the duplicate, keeping the face only. (default: true)
  --Faces-writeAccessMinRole                                                Required minimum right to star (favourite) a face. (default: 'Admin')
  --Faces-readAccessMinRole                                                 Required minimum right to show the faces tab. (default: 'User')
  --RandomPhoto-enabled                                                     Enables random link generation. (default: true)
  --Database-type                                                           SQLite is recommended. (default: 'sqlite')
  --Database-dbFolder                                                       All file-based data will be stored here (sqlite database, job history data). (default: 'db')
  --Database-sqlite-DBFileName                                              Sqlite will save the db with this filename. (default: 'sqlite.db')
  --Database-mysql-host                                                      (default: 'localhost')
  --Database-mysql-port                                                      (default: 3306)
  --Database-mysql-database                                                  (default: 'pigallery2')
  --Database-mysql-username                                                  (default: '')
  --Database-mysql-password                                                  (default: '')
  --Indexing-cachedFolderTimeout                                            If there was no indexing in this time, it reindexes. (skipped if indexes are in DB and sensitivity is low). (default: 3600000)
  --Indexing-reIndexingSensitivity                                          Set the reindexing sensitivity. High value check the folders for change more often.  Setting to never only indexes if never indexed or explicit running the Indexing Job. (default: 'low')
  --Indexing-excludeFolderList                                              Folders to exclude from indexing. If an entry starts with '/' it is treated as an absolute path. If it doesn't start with '/' but contains a '/', the path is relative to the image directory. If it doesn't contain a '/', any folder with this name will be excluded. (default: [".Trash-1000",".dtrash","$RECYCLE.BIN"])
  --Indexing-excludeFileList                                                Files that mark a folder to be excluded from indexing. Any folder that contains a file with this name will be excluded from indexing. (default: [])
  --AlbumCover-SearchQuery                                                  Filters the sub-folders with this search query. If filter results no photo, the app will search again without the filter. (default: {"type":100,"text":""})
  --AlbumCover-Sorting                                                      If multiple cover is available sorts them by these methods and selects the first one. (default: [{"method":30,"ascending":false},{"method":20,"ascending":false},{"method":40,"ascending":false}])
  --Duplicates-listingLimit                                                 Maximum number of duplicates to list. (default: 1000)
  --Messaging-Email-emailFrom                                               Some services do not allow sending from random e-mail addresses. Set this accordingly. (default: 'noreply@pigallery2.com')
  --Messaging-Email-smtp-host                                               SMTP host server (default: '')
  --Messaging-Email-smtp-port                                               SMTP server's port (default: 587)
  --Messaging-Email-smtp-secure                                             Is the connection secure. See https://nodemailer.com/smtp/#tls-options for more details (default: false)
  --Messaging-Email-smtp-requireTLS                                         if this is true and secure is false then Nodemailer (used library in the background) tries to use STARTTLS. See https://nodemailer.com/smtp/#tls-options for more details (default: true)
  --Messaging-Email-smtp-user                                               User to connect to the SMTP server. (default: '')
  --Messaging-Email-smtp-password                                           Password to connect to the SMTP server. (default: '')
  --Jobs-maxSavedProgress                                                   Job history size. (default: 20)
  --Jobs-mediaProcessingBatchSize                                           Jobs load this many photos or videos form the DB for processing at once. (default: 1000)
  --Jobs-scheduled                                                           (default: [{"name":"Indexing","jobName":"Indexing","config":{"indexChangesOnly":true},"allowParallelRun":false,"trigger":{"type":1}},{"name":"Album Cover Filling","jobName":"Album Cover Filling","config":{},"allowParallelRun":false,"trigger":{"type":4,"afterScheduleName":"Indexing"}},{"name":"Thumbnail Generation","jobName":"Thumbnail Generation","config":{"sizes":[240],"indexedOnly":true},"allowParallelRun":false,"trigger":{"type":4,"afterScheduleName":"Album Cover Filling"}},{"name":"Photo Converting","jobName":"Photo Converting","config":{"indexedOnly":true},"allowParallelRun":false,"trigger":{"type":4,"afterScheduleName":"Thumbnail Generation"}},{"name":"Video Converting","jobName":"Video Converting","config":{"indexedOnly":true},"allowParallelRun":false,"trigger":{"type":4,"afterScheduleName":"Photo Converting"}},{"name":"GPX Compression","jobName":"GPX Compression","config":{"indexedOnly":true},"allowParallelRun":false,"trigger":{"type":4,"afterScheduleName":"Video Converting"}},{"name":"Temp Folder Cleaning","jobName":"Temp Folder Cleaning","config":{"indexedOnly":true},"allowParallelRun":false,"trigger":{"type":4,"afterScheduleName":"GPX Compression"}}])

Environmental variables: 
  Server-applicationTitle                                                (default: 'PiGallery 2')
  Server-publicUrl                                                      If you access the page form local network its good to know the public url for creating sharing link. (default: '')
  Server-urlBase                                                        If you access the gallery under a sub url (like: http://mydomain.com/myGallery), set it here. If it is not working you might miss the '/' from the beginning of the url. (default: '')
  Server-apiPath                                                        PiGallery api path. (default: '/pgapi')
  Server-customHTMLHead                                                 Injects the content of this between the <head></head> HTML tags of the app. (You can use it add analytics or custom code to the app). (default: '')
  Server-svgIcon-viewBox                                                SVG path viewBox. See: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/viewBox (default: '0 0 512 512')
  Server-svgIcon-items                                                  Content elements (paths, circles, rects) of the SVG icon. Icons used on the map: fontawesome.com/icons. (default: '<path d="m185.92 0.042372c-3.1045 0.19567-6.2676 1.0899-9.1546 3.163-16.085-8.0588-25.565 1.6894-23.504 14.76-5.3047 4.0078-10.768 7.8463-6.3153 20.688-4.8283 4.5113-5.2702 11.17-1.2227 20.894-4.5731 7.1343-3.0927 13.944 1.4676 20.445-5.0506 10.26 3.7514 20.507 6.2389 23.943-0.99909 6.6761-0.49742 13.458 11.016 21.392-1.2207 10.005 5.7492 14.415 12.419 19.045 12.567 8.1824 17.213 7.2406 27.088 10.328l-0.13366-1.1862c-15.833 3e-3 -31.017 6.2997-42.211 17.506l-24.715 24.736c-11.194 11.206-26.378 17.503-42.211 17.506h-34.984c-32.972 3.6e-4 -59.702 26.751-59.701 59.749v179.24c3.6312e-4 32.997 26.729 59.746 59.701 59.747h358.21c32.972-3.6e-4 59.7-26.75 59.701-59.747v-179.24c-0.0162-23.02-13.245-43.983-34.008-53.889 3.0728-1.7781 5.0617-4.3071 6.7327-7.0379 4.1124-1.032 17.438-3.2179 20.159-14.327 7.7661-2.0112 13.273-6.2767 14.255-14.719 9.3465-4.8456 13.285-10.23 12.484-16.792 11.694-7.0704 9.9759-13.526 8.4511-19.912 9.9742-8.687 8.874-22.288-8.6236-26.461-3.1292-12.25-18.501-15.32-20.733-16.133-1.3931-4.0275-3.7026-7.9496-14.353-10.399-4.4451-8.3291-12.211-9.9464-20.904-9.9225-6.4476-10.379-14.548-6.8393-22.216-7.2124-9.6958-7.4917-13.951-3.6525-20.032-3.5572-11.02-6.8739-16.687-2.7782-24.497 0.86675l-6.6602-2.5355c-21.868 3.9146-38.57 22.031-45.765 31.84 0.78895-12.143-0.36806-36.764-14.606-53.831l-6.7327-2.3414c-3.6422-7.8167-5.3526-14.6-18.209-16.423-4.7287-3.9225-5.388-9.6636-17.627-10.162-3.9701-2.9861-7.0841-7.4205-11.972-9.091-2.5588-0.82206-5.6927-0.97346-9.6817 0.32356-6.6078-5.7069-13.63-9.3648-22.385-5.8437-9.7319-4.9749-14.082-3.5883-17.674-1.2668-1.3952-0.50821-7.2885-3.6439-14.018-4.1239-1.0094-0.071996-2.0376-0.084841-3.0724-0.019609zm1.017 13.578c10.104 0.93027 18.591 7.2129 24.705 11.86 3.989-1.297 1.8817-5.4748-0.67601-9.9264 7.4731 3.9321 13.922 8.2611 19.542 13.058 4.4921-1.7738-6e-3 -6.9333-1.6283-10.934 11.32 6.6532 15.299 11.732 19.277 16.811 4.96-2.1534 2.5609-6.4373 1.1326-10.368 7.9224 6.6257 11.087 12.731 14.482 18.808 2.4625-1.6331 5.6853-2.3301 4.5577-8.9008 5.1605 6.0597 8.5191 12.233 10.344 18.398 4.8979-1.076 4.6167-5.1376 5.7471-8.2459 4.8158 7.9142 7.0028 15.201 10.195 22.743 1.3502-0.38818 3.143-2.596 5.5002-6.3575 10.495 21.313 19.172 68.475-19.542 71.864-19.845-33.079-47.35-62.019-80.099-88.028 39.018 41.712 59.701 71.578 68.828 93.932-5.6123 8.2892-13.186 12.888-21.423 15.182h-31.496c-9.0855-1.8937-17.047-4.8048-21.968-6.9301 3.5034-0.26396 6.761-1.0578 8.553-3.265-2.8932-4.1339-16.942-6.6095-24.423-15.054 3.8384 0.62815 5.771 0.45179 8.3395-1.4727-7.7461-5.9015-16.277-11.759-20.149-18.339 3.0088 1.096 5.5764 2.7998 10.448 1.4943-6.3427-7.0404-13.489-13.382-17.696-22.065 4.1118 1.3877 8.4445 3.0751 10.271 1.9806-5.5926-6.9871-9.844-14.035-12.948-21.216 5.3821 2.7304 8.0206 3.0315 9.7326 2.5551-3.457-7.4192-8.6517-14.592-9.4172-22.461 3.6436 2.9772 7.3478 4.8776 10.904 3.8631-0.36036-4.7513-7.3377-10.044-8.4022-21.322 4.3234 2.0148 8.7693 4.2946 10.093 3.6768 0.9645-8.9987-0.93024-14.97-2.5963-20.967 9.547 3.3675 23.877 8.6978 23.48 7.6733zm202.89 68.954c-1.1657 3.2054-4.0535 6.0044-0.89552 10.015 5.3574-3.5486 11.898-6.1175 19.744-7.4399-5.0841 4.3081-3.1624 6.8795-2.228 9.7499 6.5043-2.4708 12.815-5.0123 23.175-5.0887-3.6187 2.0919-8.2066 3.8292-5.7902 8.6694 6.3098-1.3316 12.62-2.6636 25.565-0.47848-3.8128 2.0212-10.67 3.0443-8.2709 7.3281 7.289-0.095 15.142 0.67658 23.357 2.5689-4.9157 1.7295-9.1161 3.6077-6.8934 7.1673 7.6683 0.37321 18.204 1.0216 26.541 6.8085l-7.9768 3.8043c-0.96209 0.52956 13.473 5.5674 22.914 9.2263-5.2605 3.5839-10.415 6.8757-15.456 14.39 0.61731 1.3249 5.4871 2.4391 10.093 3.6768-8.059 7.9545-16.768 7.4235-20.131 10.928 2.0376 3.1622 6.0354 3.9567 10.836 4.0553-5.7375 5.5002-14.227 7.6885-21.64 11.148 1.0057 1.4663 3.2192 2.9338 9.0958 4.3043-6.9901 3.5039-14.773 6.1675-23.545 7.9223 0.73194 1.9166 5.0978 3.5087 9.1389 5.0907-8.7991 3.945-18.346 4.207-27.726 5.5201 2.9287 4.0367 5.9538 4.4791 8.9626 5.575-7.1926 2.5501-17.455 1.4514-27.215 1.0864 0.46776 2.1663 1.3155 3.4454 2.7961 4.6612h-13.75c-5.1274-1.4192-9.4503-2.9189-11.788-2.2747-0.0214 0.78201 0.12538 1.5366 0.37044 2.2747h-6.1841c-2.2143-0.16717-4.4175-0.45785-6.5995-0.87068-17.23-8.2945-37.615-23.515-35.198-47.897 21.35-11.254 56.342-20.728 113.06-27.679-41.792-1.1427-81.452 3.3317-117.9 15.905-27.674-27.57 9.2662-58.115 30.995-67.691-0.70716 4.3624-0.65582 7.2407 0.12836 8.4067 7.2901-3.7246 13.646-7.8991 22.418-10.864zm-186.04 100.82h69.97c7.9167 2e-3 15.508 3.1505 21.105 8.7538l24.717 24.736c16.798 16.816 39.584 26.262 63.343 26.259h34.984c16.486 1.9e-4 29.85 13.375 29.85 29.873v179.24c-1.9e-4 16.499-13.365 29.873-29.85 29.873h-358.21c-16.486-1.8e-4 -29.85-13.375-29.85-29.873v-179.24c1.88e-4 -16.499 13.365-29.873 29.85-29.873h34.984c23.739-0.0128 46.501-9.4579 63.285-26.259l24.775-24.736c5.582-5.5884 13.149-8.736 21.045-8.7538zm35.016 59.749c-57.625 0.10848-104.28 46.889-104.28 104.56 0 57.669 46.656 104.45 104.28 104.56 57.625-0.10848 104.28-46.889 104.28-104.56 0-57.669-46.656-104.45-104.28-104.56zm-164.18 29.873c-8.2429 9e-5 -14.925 6.6874-14.925 14.937 0.03875 8.2218 6.7096 14.866 14.925 14.866s14.886-6.6446 14.925-14.866c-9.1e-5 -8.2493-6.6823-14.937-14.925-14.937zm164.18 0c41.206 0.0135 74.603 33.447 74.603 74.684 0 41.238-33.397 74.671-74.603 74.684-41.206-0.0135-74.603-33.447-74.603-74.684 0-41.238 33.397-74.671 74.603-74.684z"/>')
  Server-sessionSecret                                                   (default: [])
  Server-sessionTimeout                                                 Users kept logged in for this long time. (default: 604800000)
  Server-port                                                           Port number. Port 80 is usually what you need. (default: 80)
  PORT                                                                   same as Server-port
  Server-host                                                           Server will accept connections from this IPv6 or IPv4 address. (default: '0.0.0.0')
  Server-Threading-enabled                                              [Deprecated, will be removed in the next release] Runs directory scanning and thumbnail generation in a different thread. (default: false)
  Server-Threading-thumbnailThreads                                     Number of threads that are used to generate thumbnails. If 0, number of 'CPU cores -1' threads will be used. (default: 0)
  Server-Log-level                                                      Logging level. (default: 'info')
  Server-Log-sqlLevel                                                   Logging level for SQL queries. (default: 'error')
  Server-Log-logServerTiming                                            If enabled, the app ads "Server-Timing" http header to the response. (default: false)
  Users-authenticationRequired                                          Enables user management with login to password protect the gallery. (default: true)
  Users-unAuthenticatedUserRole                                         Default user right when password protection is disabled. (default: 'Admin')
  Users-enforcedUsers                                                   Creates these users in the DB during startup if they do not exist. If a user with this name exist, it won't be overwritten, even if the role is different. (default: [])
  Gallery-enableCache                                                   Caches directory contents and search results for better performance. (default: true)
  Gallery-enableOnScrollRendering                                       Those thumbnails get higher priority that are visible on the screen. (default: true)
  Gallery-enableDirectorySortingByDate                                  If enabled, directories will be sorted by date, like photos, otherwise by name. Directory date is the last modification time of that directory not the creation date of the oldest photo. (default: false)
  Gallery-enableOnScrollThumbnailPrioritising                           Those thumbnails will be rendered first that are in view. (default: true)
  Gallery-NavBar-enableDownloadZip                                      Enable download zip of a directory contents Directory flattening. (Does not work for searches.) (default: false)
  Gallery-NavBar-enableDirectoryFlattening                              Adds a button to flattens the file structure, by listing the content of all subdirectories. (Won't work if the gallery has multiple folders with the same path.) (default: false)
  Gallery-NavBar-defaultGidSize                                         Default grid size that is used to render photos and videos. (default: 'medium')
  Gallery-NavBar-showItemCount                                          Shows the number photos and videos on the navigation bar. (default: true)
  Gallery-NavBar-links                                                  Visible links in the top menu. (default: [{"type":1},{"type":3},{"type":2}])
  Gallery-NavBar-NavbarShowDelay                                        Ratio of the page height, you need to scroll to show the navigation bar. (default: 0.3)
  Gallery-NavBar-NavbarHideDelay                                        Ratio of the page height, you need to scroll to hide the navigation bar. (default: 0.15)
  Gallery-NavBar-showScrollUpButton                                     Set when the floating scroll-up button should be visible. (default: 'mobileOnly')
  Gallery-NavBar-SortingGrouping-defaultPhotoSortingMethod-method        (default: 'Date')
  Gallery-NavBar-SortingGrouping-defaultPhotoSortingMethod-ascending     (default: true)
  Gallery-NavBar-SortingGrouping-defaultSearchSortingMethod-method       (default: 'Date')
  Gallery-NavBar-SortingGrouping-defaultSearchSortingMethod-ascending    (default: false)
  Gallery-NavBar-SortingGrouping-defaultPhotoGroupingMethod-method       (default: 'Date')
  Gallery-NavBar-SortingGrouping-defaultPhotoGroupingMethod-ascending    (default: true)
  Gallery-NavBar-SortingGrouping-defaultSearchGroupingMethod-method      (default: 'Date')
  Gallery-NavBar-SortingGrouping-defaultSearchGroupingMethod-ascending   (default: false)
  Gallery-captionFirstNaming                                            Show the caption (IPTC 120) tags from the EXIF data instead of the filenames. (default: false)
  Gallery-Lightbox-defaultSlideshowSpeed                                Default time interval for displaying a photo in the slide show. (default: 5)
  Gallery-Lightbox-captionAlwaysOn                                      If enabled, lightbox will always show caption by default, not only on hover. (default: false)
  Gallery-Lightbox-facesAlwaysOn                                        If enabled, lightbox will always show faces by default, not only on hover. (default: false)
  Gallery-Lightbox-loopVideos                                           If enabled, lightbox will loop videos by default. (default: false)
  Gallery-Themes-enabled                                                Enable themes and color modes. (default: true)
  Gallery-Themes-defaultMode                                            Sets the default theme mode that is used for the application. (default: 'auto')
  Gallery-Themes-selectedTheme                                          Selected theme to use on the site. (default: 'classic')
  Gallery-Themes-availableThemes                                        Adds these css settings as it is to the end of the body tag of the page. (default: [{"name":"classic","theme":":root nav.navbar {\n--bs-navbar-color: rgba(255, 255, 255, 0.55);\n--bs-navbar-hover-color: rgba(255, 255, 255, 0.75);\n--bs-navbar-disabled-color: rgba(255, 255, 255, 0.25);\n--bs-navbar-active-color: #fff;\n--bs-navbar-brand-color: #fff;\n--bs-navbar-brand-hover-color: #fff;\n--bs-bg-opacity: 1;\nbackground-color: rgba(var(--bs-dark-rgb), var(--bs-bg-opacity)) !important;\n}"}])
  Gallery-InlineBlogStartsOpen                                          Makes inline blog (*.md files content) to be auto open. (default: false)
  Gallery-TopBlogStartsOpen                                             Makes inline blog (*.md files content) to be auto open. (default: false)
  Media-Thumbnail-iconSize                                              Icon size (used on maps). (default: 45)
  Media-Thumbnail-personThumbnailSize                                   Person (face) thumbnail size. (default: 200)
  Media-Thumbnail-thumbnailSizes                                        Size of the thumbnails. The best matching size will be generated. More sizes give better quality, but use more storage and CPU to render. If size is 240, that shorter side of the thumbnail will have 160 pixels. (default: [240,480])
  Media-Thumbnail-useLanczos3                                           if true, 'lanczos3' will used to scale photos, otherwise faster but lower quality 'nearest'. (default: true)
  Media-Thumbnail-quality                                               Between 0-100. (default: 80)
  Media-Thumbnail-smartSubsample                                        Use high quality chroma subsampling in webp. See: https://sharp.pixelplumbing.com/api-output#webp. (default: true)
  Media-Thumbnail-personFaceMargin                                      This ratio of the face bounding box will be added to the face as a margin. Higher number add more margin. (default: 0.7)
  Media-Video-enabled                                                    (default: true)
  Media-Video-supportedFormatsWithTranscoding                           Video formats that are supported after transcoding (with the build-in ffmpeg support). (default: ["avi","mkv","mov","wmv","flv","mts","m2ts","mpg","3gp","m4v","mpeg","vob","divx","xvid","ts"])
  Media-Video-supportedFormats                                          Video formats that are supported also without transcoding. Browser supported formats: https://www.w3schools.com/html/html5_video.asp (default: ["mp4","webm","ogv","ogg"])
  Media-Video-transcoding-bitRate                                       Target bit rate of the output video will be scaled down this this. This should be less than the upload rate of your home server. (default: 5242880)
  Media-Video-transcoding-resolution                                    The height of the output video will be scaled down to this, while keeping the aspect ratio. (default: 720)
  Media-Video-transcoding-fps                                           Target frame per second (fps) of the output video will be scaled down this this. (default: 25)
  Media-Video-transcoding-format                                         (default: 'mp4')
  Media-Video-transcoding-mp4Codec                                       (default: 'libx264')
  Media-Video-transcoding-webmCodec                                      (default: 'libvpx')
  Media-Video-transcoding-crf                                           The range of the Constant Rate Factor (CRF) scale is 0–51, where 0 is lossless, 23 is the default, and 51 is worst quality possible. (default: 23)
  Media-Video-transcoding-preset                                        A preset is a collection of options that will provide a certain encoding speed to compression ratio. A slower preset will provide better compression (compression is quality per filesize). (default: 'medium')
  Media-Video-transcoding-customOutputOptions                           It will be sent to ffmpeg as it is, as custom output options. (default: [])
  Media-Video-transcoding-customInputOptions                            It will be sent to ffmpeg as it is, as custom input options. (default: [])
  Media-Photo-Converting-enabled                                        Enable photo converting. (default: true)
  Media-Photo-Converting-loadFullImageOnZoom                            Enables loading the full resolution image on zoom in the ligthbox (preview). (default: true)
  Media-Photo-Converting-onTheFly                                       Converts photos on the fly, when they are requested. (default: true)
  Media-Photo-Converting-resolution                                     The shorter edge of the converted photo will be scaled down to this, while keeping the aspect ratio. (default: 1080)
  Media-Photo-supportedFormats                                          Photo formats that are supported. Browser needs to support these formats natively. Also sharp (libvips) package should be able to convert these formats. (default: ["gif","jpeg","jpg","jpe","png","webp","svg"])
  Media-folder                                                          Images are loaded from this folder (read permission required) (default: 'demo/images')
  Media-tempFolder                                                      Thumbnails, converted photos, videos will be stored here (write permission required) (default: 'demo/tmp')
  Media-photoMetadataSize                                               Only this many bites will be loaded when scanning photo/video for metadata. Increase this number if your photos shows up as square. (default: 524288)
  MetaFile-gpx                                                          Reads *.gpx files and renders them on the map. (default: true)
  MetaFile-GPXCompressing-enabled                                       Enables lossy (based on delta time and distance. Too frequent points are removed) GPX compression. (default: true)
  MetaFile-GPXCompressing-onTheFly                                      Enables on the fly *.gpx compression. (default: true)
  MetaFile-GPXCompressing-minDistance                                   Filters out entry that are closer than this to each other in meters. (default: 5)
  MetaFile-GPXCompressing-maxMiddleDeviance                             Filters out entry that would fall on the line if we would just connect the previous and the next points. This setting sets the sensitivity for that (higher number, more points are filtered). (default: 5)
  MetaFile-GPXCompressing-minTimeDistance                               Filters out entry that are closer than this in time in milliseconds. (default: 5000)
  MetaFile-markdown                                                     Reads *.md files in a directory and shows the next to the map. (default: true)
  MetaFile-pg2conf                                                      Reads *.pg2conf files (You can use it for custom sorting and saved search (albums)). (default: true)
  MetaFile-supportedFormats                                             The app will read and process these files. (default: ["gpx","pg2conf","md"])
  Album-enabled                                                          (default: true)
  Search-enabled                                                        Enables searching. (default: true)
  Search-searchCacheTimeout                                             Search cache timeout. (default: 3600000)
  Search-AutoComplete-enabled                                           Show hints while typing search query. (default: true)
  Search-AutoComplete-ItemsPerCategory-maxItems                         Maximum number autocomplete items shown at once. If there is not enough items to reach this value, it takes upto double of the individual items. (default: 20)
  Search-AutoComplete-ItemsPerCategory-fileName                         Maximum number autocomplete items shown per photo category. (default: 2)
  Search-AutoComplete-ItemsPerCategory-directory                        Maximum number autocomplete items shown per directory category. (default: 2)
  Search-AutoComplete-ItemsPerCategory-caption                          Maximum number autocomplete items shown per caption category. (default: 3)
  Search-AutoComplete-ItemsPerCategory-position                         Maximum number autocomplete items shown per position category. (default: 3)
  Search-AutoComplete-ItemsPerCategory-person                           Maximum number autocomplete items shown per faces category. (default: 5)
  Search-AutoComplete-ItemsPerCategory-keyword                          Maximum number autocomplete items shown per keyword category. (default: 5)
  Search-AutoComplete-cacheTimeout                                      Autocomplete cache timeout.  (default: 3600000)
  Search-maxMediaResult                                                 Maximum number of photos and videos that are listed in one search result. (default: 10000)
  Search-maxDirectoryResult                                             Maximum number of directories that are listed in one search result. (default: 200)
  Search-listDirectories                                                Search returns also with directories, not just media. (default: false)
  Search-listMetafiles                                                  Search also returns with metafiles from directories that contain a media file of the matched search result. (default: true)
  Sharing-enabled                                                       Enables sharing. (default: true)
  Sharing-passwordProtected                                             Enables password protected sharing links. (default: true)
  Sharing-updateTimeout                                                 After creating a sharing link, it can be updated for this long. (default: 300000)
  Map-enabled                                                            (default: true)
  Map-useImageMarkers                                                   Map will use thumbnail images as markers instead of the default pin. (default: true)
  Map-mapProvider                                                        (default: 'OpenStreetMap')
  Map-mapboxAccessToken                                                 MapBox needs an access token to work, create one at https://www.mapbox.com. (default: '')
  Map-customLayers                                                      The map module will use these urls to fetch the map tiles. (default: [{"name":"street","url":"","darkLayer":false}])
  Map-maxPreviewMarkers                                                 Maximum number of markers to be shown on the map preview on the gallery page. (default: 50)
  Map-MapPathGroupConfig                                                Markers are grouped and themed by these settings (default: [{"name":"Transportation","matchers":[{"matchers":["flight","flying"],"theme":{"color":"var(--bs-orange)","dashArray":"4 8","svgIcon":{"viewBox":"0 0 567 512","items":"<path d=\"M482.3 192c34.2 0 93.7 29 93.7 64c0 36-59.5 64-93.7 64l-116.6 0L265.2 495.9c-5.7 10-16.3 16.1-27.8 16.1l-56.2 0c-10.6 0-18.3-10.2-15.4-20.4l49-171.6L112 320 68.8 377.6c-3 4-7.8 6.4-12.8 6.4l-42 0c-7.8 0-14-6.3-14-14c0-1.3 .2-2.6 .5-3.9L32 256 .5 145.9c-.4-1.3-.5-2.6-.5-3.9c0-7.8 6.3-14 14-14l42 0c5 0 9.8 2.4 12.8 6.4L112 192l102.9 0-49-171.6C162.9 10.2 170.6 0 181.2 0l56.2 0c11.5 0 22.1 6.2 27.8 16.1L365.7 192l116.6 0z\"/>"}}},{"matchers":["drive","driving"],"theme":{"color":"var(--bs-orange)","dashArray":"4 8","svgIcon":{"viewBox":"0 0 640 512","items":"<path d=\"M171.3 96H224v96H111.3l30.4-75.9C146.5 104 158.2 96 171.3 96zM272 192V96h81.2c9.7 0 18.9 4.4 25 12l67.2 84H272zm256.2 1L428.2 68c-18.2-22.8-45.8-36-75-36H171.3c-39.3 0-74.6 23.9-89.1 60.3L40.6 196.4C16.8 205.8 0 228.9 0 256V368c0 17.7 14.3 32 32 32H65.3c7.6 45.4 47.1 80 94.7 80s87.1-34.6 94.7-80H385.3c7.6 45.4 47.1 80 94.7 80s87.1-34.6 94.7-80H608c17.7 0 32-14.3 32-32V320c0-65.2-48.8-119-111.8-127zM434.7 368a48 48 0 1 1 90.5 32 48 48 0 1 1 -90.5-32zM160 336a48 48 0 1 1 0 96 48 48 0 1 1 0-96z\"/>"}}},{"matchers":["ship","sailing","cruise"],"theme":{"color":"var(--bs-orange)","dashArray":"4 8","svgIcon":{"viewBox":"0 0 576 512","items":"<path d=\"M256 16c0-7 4.5-13.2 11.2-15.3s13.9 .4 17.9 6.1l224 320c3.4 4.9 3.8 11.3 1.1 16.6s-8.2 8.6-14.2 8.6H272c-8.8 0-16-7.2-16-16V16zM212.1 96.5c7 1.9 11.9 8.2 11.9 15.5V336c0 8.8-7.2 16-16 16H80c-5.7 0-11-3-13.8-8s-2.9-11-.1-16l128-224c3.6-6.3 11-9.4 18-7.5zM5.7 404.3C2.8 394.1 10.5 384 21.1 384H554.9c10.6 0 18.3 10.1 15.4 20.3l-4 14.3C550.7 473.9 500.4 512 443 512H133C75.6 512 25.3 473.9 9.7 418.7l-4-14.3z\"/>"}}}]},{"name":"Sport","matchers":[{"matchers":["run"],"theme":{"color":"var(--bs-primary)","dashArray":"","svgIcon":{"viewBox":"0 0 417 512","items":"<path d=\"M320 48a48 48 0 1 0 -96 0 48 48 0 1 0 96 0zM125.7 175.5c9.9-9.9 23.4-15.5 37.5-15.5c1.9 0 3.8 .1 5.6 .3L137.6 254c-9.3 28 1.7 58.8 26.8 74.5l86.2 53.9-25.4 88.8c-4.9 17 5 34.7 22 39.6s34.7-5 39.6-22l28.7-100.4c5.9-20.6-2.6-42.6-20.7-53.9L238 299l30.9-82.4 5.1 12.3C289 264.7 323.9 288 362.7 288H384c17.7 0 32-14.3 32-32s-14.3-32-32-32H362.7c-12.9 0-24.6-7.8-29.5-19.7l-6.3-15c-14.6-35.1-44.1-61.9-80.5-73.1l-48.7-15c-11.1-3.4-22.7-5.2-34.4-5.2c-31 0-60.8 12.3-82.7 34.3L57.4 153.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l23.1-23.1zM91.2 352H32c-17.7 0-32 14.3-32 32s14.3 32 32 32h69.6c19 0 36.2-11.2 43.9-28.5L157 361.6l-9.5-6c-17.5-10.9-30.5-26.8-37.9-44.9L91.2 352z\"/>"}}},{"matchers":["walk"],"theme":{"color":"var(--bs-primary)","dashArray":"","svgIcon":{"viewBox":"0 0 320 512","items":"<path d=\"M160 48a48 48 0 1 1 96 0 48 48 0 1 1 -96 0zM126.5 199.3c-1 .4-1.9 .8-2.9 1.2l-8 3.5c-16.4 7.3-29 21.2-34.7 38.2l-2.6 7.8c-5.6 16.8-23.7 25.8-40.5 20.2s-25.8-23.7-20.2-40.5l2.6-7.8c11.4-34.1 36.6-61.9 69.4-76.5l8-3.5c20.8-9.2 43.3-14 66.1-14c44.6 0 84.8 26.8 101.9 67.9L281 232.7l21.4 10.7c15.8 7.9 22.2 27.1 14.3 42.9s-27.1 22.2-42.9 14.3L247 287.3c-10.3-5.2-18.4-13.8-22.8-24.5l-9.6-23-19.3 65.5 49.5 54c5.4 5.9 9.2 13 11.2 20.8l23 92.1c4.3 17.1-6.1 34.5-23.3 38.8s-34.5-6.1-38.8-23.3l-22-88.1-70.7-77.1c-14.8-16.1-20.3-38.6-14.7-59.7l16.9-63.5zM68.7 398l25-62.4c2.1 3 4.5 5.8 7 8.6l40.7 44.4-14.5 36.2c-2.4 6-6 11.5-10.6 16.1L54.6 502.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L68.7 398z\"/>"}}},{"matchers":["hike","hiking"],"theme":{"color":"var(--bs-primary)","dashArray":"","svgIcon":{"viewBox":"0 0 384 512","items":"<path d=\"M192 48a48 48 0 1 1 96 0 48 48 0 1 1 -96 0zm51.3 182.7L224.2 307l49.7 49.7c9 9 14.1 21.2 14.1 33.9V480c0 17.7-14.3 32-32 32s-32-14.3-32-32V397.3l-73.9-73.9c-15.8-15.8-22.2-38.6-16.9-60.3l20.4-84c8.3-34.1 42.7-54.9 76.7-46.4c19 4.8 35.6 16.4 46.4 32.7L305.1 208H336V184c0-13.3 10.7-24 24-24s24 10.7 24 24v55.8c0 .1 0 .2 0 .2s0 .2 0 .2V488c0 13.3-10.7 24-24 24s-24-10.7-24-24V272H296.6c-16 0-31-8-39.9-21.4l-13.3-20zM81.1 471.9L117.3 334c3 4.2 6.4 8.2 10.1 11.9l41.9 41.9L142.9 488.1c-4.5 17.1-22 27.3-39.1 22.8s-27.3-22-22.8-39.1zm55.5-346L101.4 266.5c-3 12.1-14.9 19.9-27.2 17.9l-47.9-8c-14-2.3-22.9-16.3-19.2-30L31.9 155c9.5-34.8 41.1-59 77.2-59h4.2c15.6 0 27.1 14.7 23.3 29.8z\"/>"}}},{"matchers":["bike","biking","cycling"],"theme":{"color":"var(--bs-primary)","dashArray":"","svgIcon":{"viewBox":"0 0 640 512","items":"<path d=\"M400 96a48 48 0 1 0 0-96 48 48 0 1 0 0 96zm27.2 64l-61.8-48.8c-17.3-13.6-41.7-13.8-59.1-.3l-83.1 64.2c-30.7 23.8-28.5 70.8 4.3 91.6L288 305.1V416c0 17.7 14.3 32 32 32s32-14.3 32-32V288c0-10.7-5.3-20.7-14.2-26.6L295 232.9l60.3-48.5L396 217c5.7 4.5 12.7 7 20 7h64c17.7 0 32-14.3 32-32s-14.3-32-32-32H427.2zM56 384a72 72 0 1 1 144 0A72 72 0 1 1 56 384zm200 0A128 128 0 1 0 0 384a128 128 0 1 0 256 0zm184 0a72 72 0 1 1 144 0 72 72 0 1 1 -144 0zm200 0a128 128 0 1 0 -256 0 128 128 0 1 0 256 0z\"/>"}}},{"matchers":["skiing","ski"],"theme":{"color":"var(--bs-primary)","dashArray":"","svgIcon":{"viewBox":"0 0 512 512","items":"<path d=\"M380.7 48a48 48 0 1 1 96 0 48 48 0 1 1 -96 0zM2.7 268.9c6.1-11.8 20.6-16.3 32.4-10.2L232.7 361.3l46.2-69.2-75.1-75.1c-14.6-14.6-20.4-33.9-18.4-52.1l108.8 52 39.3 39.3c16.2 16.2 18.7 41.5 6 60.6L289.8 391l128.7 66.8c13.6 7.1 29.8 7.2 43.6 .3l15.2-7.6c11.9-5.9 26.3-1.1 32.2 10.7s1.1 26.3-10.7 32.2l-15.2 7.6c-27.5 13.7-59.9 13.5-87.2-.7L12.9 301.3C1.2 295.2-3.4 280.7 2.7 268.9zM118.9 65.6L137 74.2l8.7-17.4c4-7.9 13.6-11.1 21.5-7.2s11.1 13.6 7.2 21.5l-8.5 16.9 54.7 26.2c1.5-.7 3.1-1.4 4.7-2.1l83.4-33.4c34.2-13.7 72.8 4.2 84.5 39.2l17.1 51.2 52.1 26.1c15.8 7.9 22.2 27.1 14.3 42.9s-27.1 22.2-42.9 14.3l-58.1-29c-11.4-5.7-20-15.7-24.1-27.8l-5.8-17.3-27.3 12.1-6.8 3-6.7-3.2L151.5 116.7l-9.2 18.4c-4 7.9-13.6 11.1-21.5 7.2s-11.1-13.6-7.2-21.5l9-18-17.6-8.4c-8-3.8-11.3-13.4-7.5-21.3s13.4-11.3 21.3-7.5z\"/>"}}}]},{"name":"Other paths","matchers":[{"matchers":[],"theme":{"color":"var(--bs-secondary)","dashArray":"","svgIcon":{"viewBox":"0 0 512 512","items":""}}}]}])
  Map-bendLongPathsTrigger                                              Map will bend the path if two points are this far apart on latititude axes. This intended to bend flight if only the end and the start points are given. (default: 0.5)
  Faces-enabled                                                          (default: true)
  Faces-keywordsToPersons                                               If a photo has the same face (person) name and keyword, the app removes the duplicate, keeping the face only. (default: true)
  Faces-writeAccessMinRole                                              Required minimum right to star (favourite) a face. (default: 'Admin')
  Faces-readAccessMinRole                                               Required minimum right to show the faces tab. (default: 'User')
  RandomPhoto-enabled                                                   Enables random link generation. (default: true)
  Database-type                                                         SQLite is recommended. (default: 'sqlite')
  Database-dbFolder                                                     All file-based data will be stored here (sqlite database, job history data). (default: 'db')
  Database-sqlite-DBFileName                                            Sqlite will save the db with this filename. (default: 'sqlite.db')
  Database-mysql-host                                                    (default: 'localhost')
  MYSQL_HOST                                                             same as Database-mysql-host
  Database-mysql-port                                                    (default: 3306)
  MYSQL_PORT                                                             same as Database-mysql-port
  Database-mysql-database                                                (default: 'pigallery2')
  MYSQL_DATABASE                                                         same as Database-mysql-database
  Database-mysql-username                                                (default: '')
  MYSQL_USERNAME                                                         same as Database-mysql-username
  Database-mysql-password                                                (default: '')
  MYSQL_PASSWORD                                                         same as Database-mysql-password
  Indexing-cachedFolderTimeout                                          If there was no indexing in this time, it reindexes. (skipped if indexes are in DB and sensitivity is low). (default: 3600000)
  Indexing-reIndexingSensitivity                                        Set the reindexing sensitivity. High value check the folders for change more often.  Setting to never only indexes if never indexed or explicit running the Indexing Job. (default: 'low')
  Indexing-excludeFolderList                                            Folders to exclude from indexing. If an entry starts with '/' it is treated as an absolute path. If it doesn't start with '/' but contains a '/', the path is relative to the image directory. If it doesn't contain a '/', any folder with this name will be excluded. (default: [".Trash-1000",".dtrash","$RECYCLE.BIN"])
  Indexing-excludeFileList                                              Files that mark a folder to be excluded from indexing. Any folder that contains a file with this name will be excluded from indexing. (default: [])
  AlbumCover-SearchQuery                                                Filters the sub-folders with this search query. If filter results no photo, the app will search again without the filter. (default: {"type":100,"text":""})
  AlbumCover-Sorting                                                    If multiple cover is available sorts them by these methods and selects the first one. (default: [{"method":30,"ascending":false},{"method":20,"ascending":false},{"method":40,"ascending":false}])
  Duplicates-listingLimit                                               Maximum number of duplicates to list. (default: 1000)
  Messaging-Email-emailFrom                                             Some services do not allow sending from random e-mail addresses. Set this accordingly. (default: 'noreply@pigallery2.com')
  Messaging-Email-smtp-host                                             SMTP host server (default: '')
  Messaging-Email-smtp-port                                             SMTP server's port (default: 587)
  Messaging-Email-smtp-secure                                           Is the connection secure. See https://nodemailer.com/smtp/#tls-options for more details (default: false)
  Messaging-Email-smtp-requireTLS                                       if this is true and secure is false then Nodemailer (used library in the background) tries to use STARTTLS. See https://nodemailer.com/smtp/#tls-options for more details (default: true)
  Messaging-Email-smtp-user                                             User to connect to the SMTP server. (default: '')
  Messaging-Email-smtp-password                                         Password to connect to the SMTP server. (default: '')
  Jobs-maxSavedProgress                                                 Job history size. (default: 20)
  Jobs-mediaProcessingBatchSize                                         Jobs load this many photos or videos form the DB for processing at once. (default: 1000)
  Jobs-scheduled                                                         (default: [{"name":"Indexing","jobName":"Indexing","config":{"indexChangesOnly":true},"allowParallelRun":false,"trigger":{"type":1}},{"name":"Album Cover Filling","jobName":"Album Cover Filling","config":{},"allowParallelRun":false,"trigger":{"type":4,"afterScheduleName":"Indexing"}},{"name":"Thumbnail Generation","jobName":"Thumbnail Generation","config":{"sizes":[240],"indexedOnly":true},"allowParallelRun":false,"trigger":{"type":4,"afterScheduleName":"Album Cover Filling"}},{"name":"Photo Converting","jobName":"Photo Converting","config":{"indexedOnly":true},"allowParallelRun":false,"trigger":{"type":4,"afterScheduleName":"Thumbnail Generation"}},{"name":"Video Converting","jobName":"Video Converting","config":{"indexedOnly":true},"allowParallelRun":false,"trigger":{"type":4,"afterScheduleName":"Photo Converting"}},{"name":"GPX Compression","jobName":"GPX Compression","config":{"indexedOnly":true},"allowParallelRun":false,"trigger":{"type":4,"afterScheduleName":"Video Converting"}},{"name":"Temp Folder Cleaning","jobName":"Temp Folder Cleaning","config":{"indexedOnly":true},"allowParallelRun":false,"trigger":{"type":4,"afterScheduleName":"GPX Compression"}}])
```

 ### `config.json` sample:
```json
{
    "Server": {
        "applicationTitle": "PiGallery 2",
        "//[publicUrl]": [
            "If you access the page form local network its good to know the public url for creating sharing link."
        ],
        "publicUrl": "",
        "//[urlBase]": [
            "If you access the gallery under a sub url (like: http://mydomain.com/myGallery), set it here. If it is not working you might miss the '/' from the beginning of the url."
        ],
        "urlBase": "",
        "//[apiPath]": "PiGallery api path.",
        "apiPath": "/pgapi",
        "//[customHTMLHead]": [
            "Injects the content of this between the <head></head> HTML tags of the app. (You can use it add analytics or custom code to the app)."
        ],
        "customHTMLHead": "",
        "//[svgIcon]": [
            "Sets the icon of the app"
        ],
        "svgIcon": {
            "//[viewBox]": [
                "SVG path viewBox. See: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/viewBox"
            ],
            "viewBox": "0 0 512 512",
            "//[items]": [
                "Content elements (paths, circles, rects) of the SVG icon. Icons used on the map: fontawesome.com/icons."
            ],
            "items": "<path d=\"m185.92 0.042372c-3.1045 0.19567-6.2676 1.0899-9.1546 3.163-16.085-8.0588-25.565 1.6894-23.504 14.76-5.3047 4.0078-10.768 7.8463-6.3153 20.688-4.8283 4.5113-5.2702 11.17-1.2227 20.894-4.5731 7.1343-3.0927 13.944 1.4676 20.445-5.0506 10.26 3.7514 20.507 6.2389 23.943-0.99909 6.6761-0.49742 13.458 11.016 21.392-1.2207 10.005 5.7492 14.415 12.419 19.045 12.567 8.1824 17.213 7.2406 27.088 10.328l-0.13366-1.1862c-15.833 3e-3 -31.017 6.2997-42.211 17.506l-24.715 24.736c-11.194 11.206-26.378 17.503-42.211 17.506h-34.984c-32.972 3.6e-4 -59.702 26.751-59.701 59.749v179.24c3.6312e-4 32.997 26.729 59.746 59.701 59.747h358.21c32.972-3.6e-4 59.7-26.75 59.701-59.747v-179.24c-0.0162-23.02-13.245-43.983-34.008-53.889 3.0728-1.7781 5.0617-4.3071 6.7327-7.0379 4.1124-1.032 17.438-3.2179 20.159-14.327 7.7661-2.0112 13.273-6.2767 14.255-14.719 9.3465-4.8456 13.285-10.23 12.484-16.792 11.694-7.0704 9.9759-13.526 8.4511-19.912 9.9742-8.687 8.874-22.288-8.6236-26.461-3.1292-12.25-18.501-15.32-20.733-16.133-1.3931-4.0275-3.7026-7.9496-14.353-10.399-4.4451-8.3291-12.211-9.9464-20.904-9.9225-6.4476-10.379-14.548-6.8393-22.216-7.2124-9.6958-7.4917-13.951-3.6525-20.032-3.5572-11.02-6.8739-16.687-2.7782-24.497 0.86675l-6.6602-2.5355c-21.868 3.9146-38.57 22.031-45.765 31.84 0.78895-12.143-0.36806-36.764-14.606-53.831l-6.7327-2.3414c-3.6422-7.8167-5.3526-14.6-18.209-16.423-4.7287-3.9225-5.388-9.6636-17.627-10.162-3.9701-2.9861-7.0841-7.4205-11.972-9.091-2.5588-0.82206-5.6927-0.97346-9.6817 0.32356-6.6078-5.7069-13.63-9.3648-22.385-5.8437-9.7319-4.9749-14.082-3.5883-17.674-1.2668-1.3952-0.50821-7.2885-3.6439-14.018-4.1239-1.0094-0.071996-2.0376-0.084841-3.0724-0.019609zm1.017 13.578c10.104 0.93027 18.591 7.2129 24.705 11.86 3.989-1.297 1.8817-5.4748-0.67601-9.9264 7.4731 3.9321 13.922 8.2611 19.542 13.058 4.4921-1.7738-6e-3 -6.9333-1.6283-10.934 11.32 6.6532 15.299 11.732 19.277 16.811 4.96-2.1534 2.5609-6.4373 1.1326-10.368 7.9224 6.6257 11.087 12.731 14.482 18.808 2.4625-1.6331 5.6853-2.3301 4.5577-8.9008 5.1605 6.0597 8.5191 12.233 10.344 18.398 4.8979-1.076 4.6167-5.1376 5.7471-8.2459 4.8158 7.9142 7.0028 15.201 10.195 22.743 1.3502-0.38818 3.143-2.596 5.5002-6.3575 10.495 21.313 19.172 68.475-19.542 71.864-19.845-33.079-47.35-62.019-80.099-88.028 39.018 41.712 59.701 71.578 68.828 93.932-5.6123 8.2892-13.186 12.888-21.423 15.182h-31.496c-9.0855-1.8937-17.047-4.8048-21.968-6.9301 3.5034-0.26396 6.761-1.0578 8.553-3.265-2.8932-4.1339-16.942-6.6095-24.423-15.054 3.8384 0.62815 5.771 0.45179 8.3395-1.4727-7.7461-5.9015-16.277-11.759-20.149-18.339 3.0088 1.096 5.5764 2.7998 10.448 1.4943-6.3427-7.0404-13.489-13.382-17.696-22.065 4.1118 1.3877 8.4445 3.0751 10.271 1.9806-5.5926-6.9871-9.844-14.035-12.948-21.216 5.3821 2.7304 8.0206 3.0315 9.7326 2.5551-3.457-7.4192-8.6517-14.592-9.4172-22.461 3.6436 2.9772 7.3478 4.8776 10.904 3.8631-0.36036-4.7513-7.3377-10.044-8.4022-21.322 4.3234 2.0148 8.7693 4.2946 10.093 3.6768 0.9645-8.9987-0.93024-14.97-2.5963-20.967 9.547 3.3675 23.877 8.6978 23.48 7.6733zm202.89 68.954c-1.1657 3.2054-4.0535 6.0044-0.89552 10.015 5.3574-3.5486 11.898-6.1175 19.744-7.4399-5.0841 4.3081-3.1624 6.8795-2.228 9.7499 6.5043-2.4708 12.815-5.0123 23.175-5.0887-3.6187 2.0919-8.2066 3.8292-5.7902 8.6694 6.3098-1.3316 12.62-2.6636 25.565-0.47848-3.8128 2.0212-10.67 3.0443-8.2709 7.3281 7.289-0.095 15.142 0.67658 23.357 2.5689-4.9157 1.7295-9.1161 3.6077-6.8934 7.1673 7.6683 0.37321 18.204 1.0216 26.541 6.8085l-7.9768 3.8043c-0.96209 0.52956 13.473 5.5674 22.914 9.2263-5.2605 3.5839-10.415 6.8757-15.456 14.39 0.61731 1.3249 5.4871 2.4391 10.093 3.6768-8.059 7.9545-16.768 7.4235-20.131 10.928 2.0376 3.1622 6.0354 3.9567 10.836 4.0553-5.7375 5.5002-14.227 7.6885-21.64 11.148 1.0057 1.4663 3.2192 2.9338 9.0958 4.3043-6.9901 3.5039-14.773 6.1675-23.545 7.9223 0.73194 1.9166 5.0978 3.5087 9.1389 5.0907-8.7991 3.945-18.346 4.207-27.726 5.5201 2.9287 4.0367 5.9538 4.4791 8.9626 5.575-7.1926 2.5501-17.455 1.4514-27.215 1.0864 0.46776 2.1663 1.3155 3.4454 2.7961 4.6612h-13.75c-5.1274-1.4192-9.4503-2.9189-11.788-2.2747-0.0214 0.78201 0.12538 1.5366 0.37044 2.2747h-6.1841c-2.2143-0.16717-4.4175-0.45785-6.5995-0.87068-17.23-8.2945-37.615-23.515-35.198-47.897 21.35-11.254 56.342-20.728 113.06-27.679-41.792-1.1427-81.452 3.3317-117.9 15.905-27.674-27.57 9.2662-58.115 30.995-67.691-0.70716 4.3624-0.65582 7.2407 0.12836 8.4067 7.2901-3.7246 13.646-7.8991 22.418-10.864zm-186.04 100.82h69.97c7.9167 2e-3 15.508 3.1505 21.105 8.7538l24.717 24.736c16.798 16.816 39.584 26.262 63.343 26.259h34.984c16.486 1.9e-4 29.85 13.375 29.85 29.873v179.24c-1.9e-4 16.499-13.365 29.873-29.85 29.873h-358.21c-16.486-1.8e-4 -29.85-13.375-29.85-29.873v-179.24c1.88e-4 -16.499 13.365-29.873 29.85-29.873h34.984c23.739-0.0128 46.501-9.4579 63.285-26.259l24.775-24.736c5.582-5.5884 13.149-8.736 21.045-8.7538zm35.016 59.749c-57.625 0.10848-104.28 46.889-104.28 104.56 0 57.669 46.656 104.45 104.28 104.56 57.625-0.10848 104.28-46.889 104.28-104.56 0-57.669-46.656-104.45-104.28-104.56zm-164.18 29.873c-8.2429 9e-5 -14.925 6.6874-14.925 14.937 0.03875 8.2218 6.7096 14.866 14.925 14.866s14.886-6.6446 14.925-14.866c-9.1e-5 -8.2493-6.6823-14.937-14.925-14.937zm164.18 0c41.206 0.0135 74.603 33.447 74.603 74.684 0 41.238-33.397 74.671-74.603 74.684-41.206-0.0135-74.603-33.447-74.603-74.684 0-41.238 33.397-74.671 74.603-74.684z\"/>"
        },
        "sessionSecret": [],
        "//[sessionTimeout]": [
            "Users kept logged in for this long time."
        ],
        "sessionTimeout": 604800000,
        "//[port]": [
            "Port number. Port 80 is usually what you need."
        ],
        "port": 80,
        "//[host]": [
            "Server will accept connections from this IPv6 or IPv4 address."
        ],
        "host": "0.0.0.0",
        "Threading": {
            "//[enabled]": [
                "[Deprecated, will be removed in the next release] Runs directory scanning and thumbnail generation in a different thread."
            ],
            "enabled": false,
            "//[thumbnailThreads]": [
                "Number of threads that are used to generate thumbnails. If 0, number of 'CPU cores -1' threads will be used."
            ],
            "thumbnailThreads": 0
        },
        "Log": {
            "//[level]": [
                "Logging level."
            ],
            "level": "info",
            "//[sqlLevel]": [
                "Logging level for SQL queries."
            ],
            "sqlLevel": "error",
            "//[logServerTiming]": [
                "If enabled, the app ads \"Server-Timing\" http header to the response."
            ],
            "logServerTiming": false
        }
    },
    "Users": {
        "//[authenticationRequired]": [
            "Enables user management with login to password protect the gallery."
        ],
        "authenticationRequired": true,
        "//[unAuthenticatedUserRole]": [
            "Default user right when password protection is disabled."
        ],
        "unAuthenticatedUserRole": "Admin",
        "//[enforcedUsers]": [
            "Creates these users in the DB during startup if they do not exist. If a user with this name exist, it won't be overwritten, even if the role is different."
        ],
        "enforcedUsers": []
    },
    "Gallery": {
        "//[enableCache]": [
            "Caches directory contents and search results for better performance."
        ],
        "enableCache": true,
        "//[enableOnScrollRendering]": [
            "Those thumbnails get higher priority that are visible on the screen."
        ],
        "enableOnScrollRendering": true,
        "//[enableDirectorySortingByDate]": [
            "If enabled, directories will be sorted by date, like photos, otherwise by name. Directory date is the last modification time of that directory not the creation date of the oldest photo."
        ],
        "enableDirectorySortingByDate": false,
        "//[enableOnScrollThumbnailPrioritising]": [
            "Those thumbnails will be rendered first that are in view."
        ],
        "enableOnScrollThumbnailPrioritising": true,
        "NavBar": {
            "//[enableDownloadZip]": [
                "Enable download zip of a directory contents Directory flattening. (Does not work for searches.)"
            ],
            "enableDownloadZip": false,
            "//[enableDirectoryFlattening]": [
                "Adds a button to flattens the file structure, by listing the content of all subdirectories. (Won't work if the gallery has multiple folders with the same path.)"
            ],
            "enableDirectoryFlattening": false,
            "//[defaultGidSize]": [
                "Default grid size that is used to render photos and videos."
            ],
            "defaultGidSize": "medium",
            "//[showItemCount]": [
                "Shows the number photos and videos on the navigation bar."
            ],
            "showItemCount": true,
            "//[links]": [
                "Visible links in the top menu."
            ],
            "links": [
                {
                    "type": "gallery"
                },
                {
                    "type": "albums"
                },
                {
                    "type": "faces"
                }
            ],
            "//[NavbarShowDelay]": [
                "Ratio of the page height, you need to scroll to show the navigation bar."
            ],
            "NavbarShowDelay": 0.3,
            "//[NavbarHideDelay]": [
                "Ratio of the page height, you need to scroll to hide the navigation bar."
            ],
            "NavbarHideDelay": 0.15,
            "//[showScrollUpButton]": [
                "Set when the floating scroll-up button should be visible."
            ],
            "showScrollUpButton": "mobileOnly",
            "SortingGrouping": {
                "//[defaultPhotoSortingMethod]": [
                    "Default sorting method for photo and video in a directory results."
                ],
                "defaultPhotoSortingMethod": {
                    "method": "Date",
                    "ascending": true
                },
                "//[defaultSearchSortingMethod]": [
                    "Default sorting method for photo and video in a search results."
                ],
                "defaultSearchSortingMethod": {
                    "method": "Date",
                    "ascending": false
                },
                "//[defaultPhotoGroupingMethod]": [
                    "Default grouping method for photo and video in a directory results."
                ],
                "defaultPhotoGroupingMethod": {
                    "method": "Date",
                    "ascending": true
                },
                "//[defaultSearchGroupingMethod]": [
                    "Default grouping method for photo and video in a search results."
                ],
                "defaultSearchGroupingMethod": {
                    "method": "Date",
                    "ascending": false
                }
            }
        },
        "//[captionFirstNaming]": [
            "Show the caption (IPTC 120) tags from the EXIF data instead of the filenames."
        ],
        "captionFirstNaming": false,
        "Lightbox": {
            "//[defaultSlideshowSpeed]": [
                "Default time interval for displaying a photo in the slide show."
            ],
            "defaultSlideshowSpeed": 5,
            "//[captionAlwaysOn]": [
                "If enabled, lightbox will always show caption by default, not only on hover."
            ],
            "captionAlwaysOn": false,
            "//[facesAlwaysOn]": [
                "If enabled, lightbox will always show faces by default, not only on hover."
            ],
            "facesAlwaysOn": false,
            "//[loopVideos]": [
                "If enabled, lightbox will loop videos by default."
            ],
            "loopVideos": false
        },
        "//[Themes]": [
            "Pigallery2 uses Bootstrap 5.3 (https://getbootstrap.com/docs/5.3) for design (css, layout). In dark mode it sets 'data-bs-theme=\"dark\"' to the <html> to take advantage bootstrap's color modes. For theming, read more at: https://getbootstrap.com/docs/5.3/customize/color-modes/"
        ],
        "Themes": {
            "//[enabled]": [
                "Enable themes and color modes."
            ],
            "enabled": true,
            "//[defaultMode]": [
                "Sets the default theme mode that is used for the application."
            ],
            "defaultMode": "auto",
            "//[selectedTheme]": [
                "Selected theme to use on the site."
            ],
            "selectedTheme": "classic",
            "//[availableThemes]": [
                "Adds these css settings as it is to the end of the body tag of the page."
            ],
            "availableThemes": [
                {
                    "//[name]": [
                        "Name of the theme"
                    ],
                    "name": "classic",
                    "//[theme]": [
                        "Adds these css settings as it is to the end of the body tag of the page."
                    ],
                    "theme": ":root nav.navbar {\n--bs-navbar-color: rgba(255, 255, 255, 0.55);\n--bs-navbar-hover-color: rgba(255, 255, 255, 0.75);\n--bs-navbar-disabled-color: rgba(255, 255, 255, 0.25);\n--bs-navbar-active-color: #fff;\n--bs-navbar-brand-color: #fff;\n--bs-navbar-brand-hover-color: #fff;\n--bs-bg-opacity: 1;\nbackground-color: rgba(var(--bs-dark-rgb), var(--bs-bg-opacity)) !important;\n}"
                }
            ]
        },
        "//[InlineBlogStartsOpen]": [
            "Makes inline blog (*.md files content) to be auto open."
        ],
        "InlineBlogStartsOpen": false,
        "//[TopBlogStartsOpen]": [
            "Makes inline blog (*.md files content) to be auto open."
        ],
        "TopBlogStartsOpen": false
    },
    "Media": {
        "Thumbnail": {
            "//[iconSize]": [
                "Icon size (used on maps)."
            ],
            "iconSize": 45,
            "//[personThumbnailSize]": [
                "Person (face) thumbnail size."
            ],
            "personThumbnailSize": 200,
            "//[thumbnailSizes]": [
                "Size of the thumbnails. The best matching size will be generated. More sizes give better quality, but use more storage and CPU to render. If size is 240, that shorter side of the thumbnail will have 160 pixels."
            ],
            "thumbnailSizes": [
                240,
                480
            ],
            "//[useLanczos3]": [
                "if true, 'lanczos3' will used to scale photos, otherwise faster but lower quality 'nearest'."
            ],
            "useLanczos3": true,
            "//[quality]": [
                "Between 0-100."
            ],
            "quality": 80,
            "//[smartSubsample]": [
                "Use high quality chroma subsampling in webp. See: https://sharp.pixelplumbing.com/api-output#webp."
            ],
            "smartSubsample": true,
            "//[personFaceMargin]": [
                "This ratio of the face bounding box will be added to the face as a margin. Higher number add more margin."
            ],
            "personFaceMargin": 0.7
        },
        "//[Video]": [
            "Video support uses ffmpeg. ffmpeg and ffprobe binaries need to be available in the PATH or the @ffmpeg-installer/ffmpeg and @ffprobe-installer/ffprobe optional node packages need to be installed."
        ],
        "Video": {
            "enabled": true,
            "//[supportedFormatsWithTranscoding]": [
                "Video formats that are supported after transcoding (with the build-in ffmpeg support)."
            ],
            "supportedFormatsWithTranscoding": [
                "avi",
                "mkv",
                "mov",
                "wmv",
                "flv",
                "mts",
                "m2ts",
                "mpg",
                "3gp",
                "m4v",
                "mpeg",
                "vob",
                "divx",
                "xvid",
                "ts"
            ],
            "//[supportedFormats]": [
                "Video formats that are supported also without transcoding. Browser supported formats: https://www.w3schools.com/html/html5_video.asp"
            ],
            "supportedFormats": [
                "mp4",
                "webm",
                "ogv",
                "ogg"
            ],
            "//[transcoding]": [
                "To ensure smooth video playback, video transcoding is recommended to a lower bit rate than the server's upload rate.   The transcoded videos will be save to the thumbnail folder.  You can trigger the transcoding manually, but you can also create an automatic encoding job in advanced settings mode."
            ],
            "transcoding": {
                "//[bitRate]": [
                    "Target bit rate of the output video will be scaled down this this. This should be less than the upload rate of your home server."
                ],
                "bitRate": 5242880,
                "//[resolution]": [
                    "The height of the output video will be scaled down to this, while keeping the aspect ratio."
                ],
                "resolution": 720,
                "//[fps]": [
                    "Target frame per second (fps) of the output video will be scaled down this this."
                ],
                "fps": 25,
                "format": "mp4",
                "mp4Codec": "libx264",
                "webmCodec": "libvpx",
                "//[crf]": [
                    "The range of the Constant Rate Factor (CRF) scale is 0–51, where 0 is lossless, 23 is the default, and 51 is worst quality possible."
                ],
                "crf": 23,
                "//[preset]": [
                    "A preset is a collection of options that will provide a certain encoding speed to compression ratio. A slower preset will provide better compression (compression is quality per filesize)."
                ],
                "preset": "medium",
                "//[customOutputOptions]": [
                    "It will be sent to ffmpeg as it is, as custom output options."
                ],
                "customOutputOptions": [],
                "//[customInputOptions]": [
                    "It will be sent to ffmpeg as it is, as custom input options."
                ],
                "customInputOptions": []
            }
        },
        "Photo": {
            "Converting": {
                "//[enabled]": [
                    "Enable photo converting."
                ],
                "enabled": true,
                "//[loadFullImageOnZoom]": [
                    "Enables loading the full resolution image on zoom in the ligthbox (preview)."
                ],
                "loadFullImageOnZoom": true,
                "//[onTheFly]": [
                    "Converts photos on the fly, when they are requested."
                ],
                "onTheFly": true,
                "//[resolution]": [
                    "The shorter edge of the converted photo will be scaled down to this, while keeping the aspect ratio."
                ],
                "resolution": 1080
            },
            "//[supportedFormats]": [
                "Photo formats that are supported. Browser needs to support these formats natively. Also sharp (libvips) package should be able to convert these formats."
            ],
            "supportedFormats": [
                "gif",
                "jpeg",
                "jpg",
                "jpe",
                "png",
                "webp",
                "svg"
            ]
        },
        "//[folder]": [
            "Images are loaded from this folder (read permission required)"
        ],
        "folder": "demo/images",
        "//[tempFolder]": [
            "Thumbnails, converted photos, videos will be stored here (write permission required)"
        ],
        "tempFolder": "demo/tmp",
        "//[photoMetadataSize]": [
            "Only this many bites will be loaded when scanning photo/video for metadata. Increase this number if your photos shows up as square."
        ],
        "photoMetadataSize": 524288
    },
    "MetaFile": {
        "//[gpx]": [
            "Reads *.gpx files and renders them on the map."
        ],
        "gpx": true,
        "GPXCompressing": {
            "//[enabled]": [
                "Enables lossy (based on delta time and distance. Too frequent points are removed) GPX compression."
            ],
            "enabled": true,
            "//[onTheFly]": [
                "Enables on the fly *.gpx compression."
            ],
            "onTheFly": true,
            "//[minDistance]": [
                "Filters out entry that are closer than this to each other in meters."
            ],
            "minDistance": 5,
            "//[maxMiddleDeviance]": [
                "Filters out entry that would fall on the line if we would just connect the previous and the next points. This setting sets the sensitivity for that (higher number, more points are filtered)."
            ],
            "maxMiddleDeviance": 5,
            "//[minTimeDistance]": [
                "Filters out entry that are closer than this in time in milliseconds."
            ],
            "minTimeDistance": 5000
        },
        "//[markdown]": [
            "Reads *.md files in a directory and shows the next to the map."
        ],
        "markdown": true,
        "//[pg2conf]": [
            "Reads *.pg2conf files (You can use it for custom sorting and saved search (albums))."
        ],
        "pg2conf": true,
        "//[supportedFormats]": [
            "The app will read and process these files."
        ],
        "supportedFormats": [
            "gpx",
            "pg2conf",
            "md"
        ]
    },
    "Album": {
        "enabled": true
    },
    "Search": {
        "//[enabled]": [
            "Enables searching."
        ],
        "enabled": true,
        "//[searchCacheTimeout]": [
            "Search cache timeout."
        ],
        "searchCacheTimeout": 3600000,
        "AutoComplete": {
            "//[enabled]": [
                "Show hints while typing search query."
            ],
            "enabled": true,
            "//[ItemsPerCategory]": [
                "Maximum number autocomplete items shown per category."
            ],
            "ItemsPerCategory": {
                "//[maxItems]": [
                    "Maximum number autocomplete items shown at once. If there is not enough items to reach this value, it takes upto double of the individual items."
                ],
                "maxItems": 20,
                "//[fileName]": [
                    "Maximum number autocomplete items shown per photo category."
                ],
                "fileName": 2,
                "//[directory]": [
                    "Maximum number autocomplete items shown per directory category."
                ],
                "directory": 2,
                "//[caption]": [
                    "Maximum number autocomplete items shown per caption category."
                ],
                "caption": 3,
                "//[position]": [
                    "Maximum number autocomplete items shown per position category."
                ],
                "position": 3,
                "//[person]": [
                    "Maximum number autocomplete items shown per faces category."
                ],
                "person": 5,
                "//[keyword]": [
                    "Maximum number autocomplete items shown per keyword category."
                ],
                "keyword": 5
            },
            "//[cacheTimeout]": [
                "Autocomplete cache timeout. "
            ],
            "cacheTimeout": 3600000
        },
        "//[maxMediaResult]": [
            "Maximum number of photos and videos that are listed in one search result."
        ],
        "maxMediaResult": 10000,
        "//[maxDirectoryResult]": [
            "Maximum number of directories that are listed in one search result."
        ],
        "maxDirectoryResult": 200,
        "//[listDirectories]": [
            "Search returns also with directories, not just media."
        ],
        "listDirectories": false,
        "//[listMetafiles]": [
            "Search also returns with metafiles from directories that contain a media file of the matched search result."
        ],
        "listMetafiles": true
    },
    "Sharing": {
        "//[enabled]": [
            "Enables sharing."
        ],
        "enabled": true,
        "//[passwordProtected]": [
            "Enables password protected sharing links."
        ],
        "passwordProtected": true,
        "//[updateTimeout]": [
            "After creating a sharing link, it can be updated for this long."
        ],
        "updateTimeout": 300000
    },
    "Map": {
        "enabled": true,
        "//[useImageMarkers]": [
            "Map will use thumbnail images as markers instead of the default pin."
        ],
        "useImageMarkers": true,
        "mapProvider": "OpenStreetMap",
        "//[mapboxAccessToken]": [
            "MapBox needs an access token to work, create one at https://www.mapbox.com."
        ],
        "mapboxAccessToken": "",
        "//[customLayers]": [
            "The map module will use these urls to fetch the map tiles."
        ],
        "customLayers": [
            {
                "//[name]": [
                    "Name of a map layer."
                ],
                "name": "street",
                "//[url]": [
                    "Url of a map layer."
                ],
                "url": "",
                "//[darkLayer]": [
                    "Sets if the layer is dark (used as default in the dark mode)."
                ],
                "darkLayer": false
            }
        ],
        "//[maxPreviewMarkers]": [
            "Maximum number of markers to be shown on the map preview on the gallery page."
        ],
        "maxPreviewMarkers": 50,
        "//[MapPathGroupConfig]": [
            "Markers are grouped and themed by these settings"
        ],
        "MapPathGroupConfig": [
            {
                "//[name]": [
                    "Name of the marker and path group on the map."
                ],
                "name": "Transportation",
                "//[matchers]": [
                    "Matchers for a given map and path theme."
                ],
                "matchers": [
                    {
                        "//[matchers]": [
                            "List of regex string to match the name of the path. Case insensitive. Empty list matches everything."
                        ],
                        "matchers": [
                            "flight",
                            "flying"
                        ],
                        "//[theme]": [
                            "List of regex string to match the name of the path."
                        ],
                        "theme": {
                            "//[color]": [
                                "Color of the path. Use any valid css colors."
                            ],
                            "color": "var(--bs-orange)",
                            "//[dashArray]": [
                                "Dash pattern of the path. Represents the spacing and length of the dash. Read more about dash array at: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dasharray."
                            ],
                            "dashArray": "4 8",
                            "//[svgIcon]": [
                                "Set the icon of the map marker pin."
                            ],
                            "svgIcon": {
                                "//[viewBox]": [
                                    "SVG path viewBox. See: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/viewBox"
                                ],
                                "viewBox": "0 0 567 512",
                                "//[items]": [
                                    "Content elements (paths, circles, rects) of the SVG icon. Icons used on the map: fontawesome.com/icons."
                                ],
                                "items": "<path d=\"M482.3 192c34.2 0 93.7 29 93.7 64c0 36-59.5 64-93.7 64l-116.6 0L265.2 495.9c-5.7 10-16.3 16.1-27.8 16.1l-56.2 0c-10.6 0-18.3-10.2-15.4-20.4l49-171.6L112 320 68.8 377.6c-3 4-7.8 6.4-12.8 6.4l-42 0c-7.8 0-14-6.3-14-14c0-1.3 .2-2.6 .5-3.9L32 256 .5 145.9c-.4-1.3-.5-2.6-.5-3.9c0-7.8 6.3-14 14-14l42 0c5 0 9.8 2.4 12.8 6.4L112 192l102.9 0-49-171.6C162.9 10.2 170.6 0 181.2 0l56.2 0c11.5 0 22.1 6.2 27.8 16.1L365.7 192l116.6 0z\"/>"
                            }
                        }
                    },
                    {
                        "//[matchers]": [
                            "List of regex string to match the name of the path. Case insensitive. Empty list matches everything."
                        ],
                        "matchers": [
                            "drive",
                            "driving"
                        ],
                        "//[theme]": [
                            "List of regex string to match the name of the path."
                        ],
                        "theme": {
                            "//[color]": [
                                "Color of the path. Use any valid css colors."
                            ],
                            "color": "var(--bs-orange)",
                            "//[dashArray]": [
                                "Dash pattern of the path. Represents the spacing and length of the dash. Read more about dash array at: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dasharray."
                            ],
                            "dashArray": "4 8",
                            "//[svgIcon]": [
                                "Set the icon of the map marker pin."
                            ],
                            "svgIcon": {
                                "//[viewBox]": [
                                    "SVG path viewBox. See: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/viewBox"
                                ],
                                "viewBox": "0 0 640 512",
                                "//[items]": [
                                    "Content elements (paths, circles, rects) of the SVG icon. Icons used on the map: fontawesome.com/icons."
                                ],
                                "items": "<path d=\"M171.3 96H224v96H111.3l30.4-75.9C146.5 104 158.2 96 171.3 96zM272 192V96h81.2c9.7 0 18.9 4.4 25 12l67.2 84H272zm256.2 1L428.2 68c-18.2-22.8-45.8-36-75-36H171.3c-39.3 0-74.6 23.9-89.1 60.3L40.6 196.4C16.8 205.8 0 228.9 0 256V368c0 17.7 14.3 32 32 32H65.3c7.6 45.4 47.1 80 94.7 80s87.1-34.6 94.7-80H385.3c7.6 45.4 47.1 80 94.7 80s87.1-34.6 94.7-80H608c17.7 0 32-14.3 32-32V320c0-65.2-48.8-119-111.8-127zM434.7 368a48 48 0 1 1 90.5 32 48 48 0 1 1 -90.5-32zM160 336a48 48 0 1 1 0 96 48 48 0 1 1 0-96z\"/>"
                            }
                        }
                    },
                    {
                        "//[matchers]": [
                            "List of regex string to match the name of the path. Case insensitive. Empty list matches everything."
                        ],
                        "matchers": [
                            "ship",
                            "sailing",
                            "cruise"
                        ],
                        "//[theme]": [
                            "List of regex string to match the name of the path."
                        ],
                        "theme": {
                            "//[color]": [
                                "Color of the path. Use any valid css colors."
                            ],
                            "color": "var(--bs-orange)",
                            "//[dashArray]": [
                                "Dash pattern of the path. Represents the spacing and length of the dash. Read more about dash array at: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dasharray."
                            ],
                            "dashArray": "4 8",
                            "//[svgIcon]": [
                                "Set the icon of the map marker pin."
                            ],
                            "svgIcon": {
                                "//[viewBox]": [
                                    "SVG path viewBox. See: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/viewBox"
                                ],
                                "viewBox": "0 0 576 512",
                                "//[items]": [
                                    "Content elements (paths, circles, rects) of the SVG icon. Icons used on the map: fontawesome.com/icons."
                                ],
                                "items": "<path d=\"M256 16c0-7 4.5-13.2 11.2-15.3s13.9 .4 17.9 6.1l224 320c3.4 4.9 3.8 11.3 1.1 16.6s-8.2 8.6-14.2 8.6H272c-8.8 0-16-7.2-16-16V16zM212.1 96.5c7 1.9 11.9 8.2 11.9 15.5V336c0 8.8-7.2 16-16 16H80c-5.7 0-11-3-13.8-8s-2.9-11-.1-16l128-224c3.6-6.3 11-9.4 18-7.5zM5.7 404.3C2.8 394.1 10.5 384 21.1 384H554.9c10.6 0 18.3 10.1 15.4 20.3l-4 14.3C550.7 473.9 500.4 512 443 512H133C75.6 512 25.3 473.9 9.7 418.7l-4-14.3z\"/>"
                            }
                        }
                    }
                ]
            },
            {
                "//[name]": [
                    "Name of the marker and path group on the map."
                ],
                "name": "Sport",
                "//[matchers]": [
                    "Matchers for a given map and path theme."
                ],
                "matchers": [
                    {
                        "//[matchers]": [
                            "List of regex string to match the name of the path. Case insensitive. Empty list matches everything."
                        ],
                        "matchers": [
                            "run"
                        ],
                        "//[theme]": [
                            "List of regex string to match the name of the path."
                        ],
                        "theme": {
                            "//[color]": [
                                "Color of the path. Use any valid css colors."
                            ],
                            "color": "var(--bs-primary)",
                            "//[dashArray]": [
                                "Dash pattern of the path. Represents the spacing and length of the dash. Read more about dash array at: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dasharray."
                            ],
                            "dashArray": "",
                            "//[svgIcon]": [
                                "Set the icon of the map marker pin."
                            ],
                            "svgIcon": {
                                "//[viewBox]": [
                                    "SVG path viewBox. See: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/viewBox"
                                ],
                                "viewBox": "0 0 417 512",
                                "//[items]": [
                                    "Content elements (paths, circles, rects) of the SVG icon. Icons used on the map: fontawesome.com/icons."
                                ],
                                "items": "<path d=\"M320 48a48 48 0 1 0 -96 0 48 48 0 1 0 96 0zM125.7 175.5c9.9-9.9 23.4-15.5 37.5-15.5c1.9 0 3.8 .1 5.6 .3L137.6 254c-9.3 28 1.7 58.8 26.8 74.5l86.2 53.9-25.4 88.8c-4.9 17 5 34.7 22 39.6s34.7-5 39.6-22l28.7-100.4c5.9-20.6-2.6-42.6-20.7-53.9L238 299l30.9-82.4 5.1 12.3C289 264.7 323.9 288 362.7 288H384c17.7 0 32-14.3 32-32s-14.3-32-32-32H362.7c-12.9 0-24.6-7.8-29.5-19.7l-6.3-15c-14.6-35.1-44.1-61.9-80.5-73.1l-48.7-15c-11.1-3.4-22.7-5.2-34.4-5.2c-31 0-60.8 12.3-82.7 34.3L57.4 153.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l23.1-23.1zM91.2 352H32c-17.7 0-32 14.3-32 32s14.3 32 32 32h69.6c19 0 36.2-11.2 43.9-28.5L157 361.6l-9.5-6c-17.5-10.9-30.5-26.8-37.9-44.9L91.2 352z\"/>"
                            }
                        }
                    },
                    {
                        "//[matchers]": [
                            "List of regex string to match the name of the path. Case insensitive. Empty list matches everything."
                        ],
                        "matchers": [
                            "walk"
                        ],
                        "//[theme]": [
                            "List of regex string to match the name of the path."
                        ],
                        "theme": {
                            "//[color]": [
                                "Color of the path. Use any valid css colors."
                            ],
                            "color": "var(--bs-primary)",
                            "//[dashArray]": [
                                "Dash pattern of the path. Represents the spacing and length of the dash. Read more about dash array at: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dasharray."
                            ],
                            "dashArray": "",
                            "//[svgIcon]": [
                                "Set the icon of the map marker pin."
                            ],
                            "svgIcon": {
                                "//[viewBox]": [
                                    "SVG path viewBox. See: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/viewBox"
                                ],
                                "viewBox": "0 0 320 512",
                                "//[items]": [
                                    "Content elements (paths, circles, rects) of the SVG icon. Icons used on the map: fontawesome.com/icons."
                                ],
                                "items": "<path d=\"M160 48a48 48 0 1 1 96 0 48 48 0 1 1 -96 0zM126.5 199.3c-1 .4-1.9 .8-2.9 1.2l-8 3.5c-16.4 7.3-29 21.2-34.7 38.2l-2.6 7.8c-5.6 16.8-23.7 25.8-40.5 20.2s-25.8-23.7-20.2-40.5l2.6-7.8c11.4-34.1 36.6-61.9 69.4-76.5l8-3.5c20.8-9.2 43.3-14 66.1-14c44.6 0 84.8 26.8 101.9 67.9L281 232.7l21.4 10.7c15.8 7.9 22.2 27.1 14.3 42.9s-27.1 22.2-42.9 14.3L247 287.3c-10.3-5.2-18.4-13.8-22.8-24.5l-9.6-23-19.3 65.5 49.5 54c5.4 5.9 9.2 13 11.2 20.8l23 92.1c4.3 17.1-6.1 34.5-23.3 38.8s-34.5-6.1-38.8-23.3l-22-88.1-70.7-77.1c-14.8-16.1-20.3-38.6-14.7-59.7l16.9-63.5zM68.7 398l25-62.4c2.1 3 4.5 5.8 7 8.6l40.7 44.4-14.5 36.2c-2.4 6-6 11.5-10.6 16.1L54.6 502.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L68.7 398z\"/>"
                            }
                        }
                    },
                    {
                        "//[matchers]": [
                            "List of regex string to match the name of the path. Case insensitive. Empty list matches everything."
                        ],
                        "matchers": [
                            "hike",
                            "hiking"
                        ],
                        "//[theme]": [
                            "List of regex string to match the name of the path."
                        ],
                        "theme": {
                            "//[color]": [
                                "Color of the path. Use any valid css colors."
                            ],
                            "color": "var(--bs-primary)",
                            "//[dashArray]": [
                                "Dash pattern of the path. Represents the spacing and length of the dash. Read more about dash array at: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dasharray."
                            ],
                            "dashArray": "",
                            "//[svgIcon]": [
                                "Set the icon of the map marker pin."
                            ],
                            "svgIcon": {
                                "//[viewBox]": [
                                    "SVG path viewBox. See: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/viewBox"
                                ],
                                "viewBox": "0 0 384 512",
                                "//[items]": [
                                    "Content elements (paths, circles, rects) of the SVG icon. Icons used on the map: fontawesome.com/icons."
                                ],
                                "items": "<path d=\"M192 48a48 48 0 1 1 96 0 48 48 0 1 1 -96 0zm51.3 182.7L224.2 307l49.7 49.7c9 9 14.1 21.2 14.1 33.9V480c0 17.7-14.3 32-32 32s-32-14.3-32-32V397.3l-73.9-73.9c-15.8-15.8-22.2-38.6-16.9-60.3l20.4-84c8.3-34.1 42.7-54.9 76.7-46.4c19 4.8 35.6 16.4 46.4 32.7L305.1 208H336V184c0-13.3 10.7-24 24-24s24 10.7 24 24v55.8c0 .1 0 .2 0 .2s0 .2 0 .2V488c0 13.3-10.7 24-24 24s-24-10.7-24-24V272H296.6c-16 0-31-8-39.9-21.4l-13.3-20zM81.1 471.9L117.3 334c3 4.2 6.4 8.2 10.1 11.9l41.9 41.9L142.9 488.1c-4.5 17.1-22 27.3-39.1 22.8s-27.3-22-22.8-39.1zm55.5-346L101.4 266.5c-3 12.1-14.9 19.9-27.2 17.9l-47.9-8c-14-2.3-22.9-16.3-19.2-30L31.9 155c9.5-34.8 41.1-59 77.2-59h4.2c15.6 0 27.1 14.7 23.3 29.8z\"/>"
                            }
                        }
                    },
                    {
                        "//[matchers]": [
                            "List of regex string to match the name of the path. Case insensitive. Empty list matches everything."
                        ],
                        "matchers": [
                            "bike",
                            "biking",
                            "cycling"
                        ],
                        "//[theme]": [
                            "List of regex string to match the name of the path."
                        ],
                        "theme": {
                            "//[color]": [
                                "Color of the path. Use any valid css colors."
                            ],
                            "color": "var(--bs-primary)",
                            "//[dashArray]": [
                                "Dash pattern of the path. Represents the spacing and length of the dash. Read more about dash array at: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dasharray."
                            ],
                            "dashArray": "",
                            "//[svgIcon]": [
                                "Set the icon of the map marker pin."
                            ],
                            "svgIcon": {
                                "//[viewBox]": [
                                    "SVG path viewBox. See: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/viewBox"
                                ],
                                "viewBox": "0 0 640 512",
                                "//[items]": [
                                    "Content elements (paths, circles, rects) of the SVG icon. Icons used on the map: fontawesome.com/icons."
                                ],
                                "items": "<path d=\"M400 96a48 48 0 1 0 0-96 48 48 0 1 0 0 96zm27.2 64l-61.8-48.8c-17.3-13.6-41.7-13.8-59.1-.3l-83.1 64.2c-30.7 23.8-28.5 70.8 4.3 91.6L288 305.1V416c0 17.7 14.3 32 32 32s32-14.3 32-32V288c0-10.7-5.3-20.7-14.2-26.6L295 232.9l60.3-48.5L396 217c5.7 4.5 12.7 7 20 7h64c17.7 0 32-14.3 32-32s-14.3-32-32-32H427.2zM56 384a72 72 0 1 1 144 0A72 72 0 1 1 56 384zm200 0A128 128 0 1 0 0 384a128 128 0 1 0 256 0zm184 0a72 72 0 1 1 144 0 72 72 0 1 1 -144 0zm200 0a128 128 0 1 0 -256 0 128 128 0 1 0 256 0z\"/>"
                            }
                        }
                    },
                    {
                        "//[matchers]": [
                            "List of regex string to match the name of the path. Case insensitive. Empty list matches everything."
                        ],
                        "matchers": [
                            "skiing",
                            "ski"
                        ],
                        "//[theme]": [
                            "List of regex string to match the name of the path."
                        ],
                        "theme": {
                            "//[color]": [
                                "Color of the path. Use any valid css colors."
                            ],
                            "color": "var(--bs-primary)",
                            "//[dashArray]": [
                                "Dash pattern of the path. Represents the spacing and length of the dash. Read more about dash array at: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dasharray."
                            ],
                            "dashArray": "",
                            "//[svgIcon]": [
                                "Set the icon of the map marker pin."
                            ],
                            "svgIcon": {
                                "//[viewBox]": [
                                    "SVG path viewBox. See: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/viewBox"
                                ],
                                "viewBox": "0 0 512 512",
                                "//[items]": [
                                    "Content elements (paths, circles, rects) of the SVG icon. Icons used on the map: fontawesome.com/icons."
                                ],
                                "items": "<path d=\"M380.7 48a48 48 0 1 1 96 0 48 48 0 1 1 -96 0zM2.7 268.9c6.1-11.8 20.6-16.3 32.4-10.2L232.7 361.3l46.2-69.2-75.1-75.1c-14.6-14.6-20.4-33.9-18.4-52.1l108.8 52 39.3 39.3c16.2 16.2 18.7 41.5 6 60.6L289.8 391l128.7 66.8c13.6 7.1 29.8 7.2 43.6 .3l15.2-7.6c11.9-5.9 26.3-1.1 32.2 10.7s1.1 26.3-10.7 32.2l-15.2 7.6c-27.5 13.7-59.9 13.5-87.2-.7L12.9 301.3C1.2 295.2-3.4 280.7 2.7 268.9zM118.9 65.6L137 74.2l8.7-17.4c4-7.9 13.6-11.1 21.5-7.2s11.1 13.6 7.2 21.5l-8.5 16.9 54.7 26.2c1.5-.7 3.1-1.4 4.7-2.1l83.4-33.4c34.2-13.7 72.8 4.2 84.5 39.2l17.1 51.2 52.1 26.1c15.8 7.9 22.2 27.1 14.3 42.9s-27.1 22.2-42.9 14.3l-58.1-29c-11.4-5.7-20-15.7-24.1-27.8l-5.8-17.3-27.3 12.1-6.8 3-6.7-3.2L151.5 116.7l-9.2 18.4c-4 7.9-13.6 11.1-21.5 7.2s-11.1-13.6-7.2-21.5l9-18-17.6-8.4c-8-3.8-11.3-13.4-7.5-21.3s13.4-11.3 21.3-7.5z\"/>"
                            }
                        }
                    }
                ]
            },
            {
                "//[name]": [
                    "Name of the marker and path group on the map."
                ],
                "name": "Other paths",
                "//[matchers]": [
                    "Matchers for a given map and path theme."
                ],
                "matchers": [
                    {
                        "//[matchers]": [
                            "List of regex string to match the name of the path. Case insensitive. Empty list matches everything."
                        ],
                        "matchers": [],
                        "//[theme]": [
                            "List of regex string to match the name of the path."
                        ],
                        "theme": {
                            "//[color]": [
                                "Color of the path. Use any valid css colors."
                            ],
                            "color": "var(--bs-secondary)",
                            "//[dashArray]": [
                                "Dash pattern of the path. Represents the spacing and length of the dash. Read more about dash array at: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dasharray."
                            ],
                            "dashArray": "",
                            "//[svgIcon]": [
                                "Set the icon of the map marker pin."
                            ],
                            "svgIcon": {
                                "//[viewBox]": [
                                    "SVG path viewBox. See: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/viewBox"
                                ],
                                "viewBox": "0 0 512 512",
                                "//[items]": [
                                    "Content elements (paths, circles, rects) of the SVG icon. Icons used on the map: fontawesome.com/icons."
                                ],
                                "items": ""
                            }
                        }
                    }
                ]
            }
        ],
        "//[bendLongPathsTrigger]": [
            "Map will bend the path if two points are this far apart on latititude axes. This intended to bend flight if only the end and the start points are given."
        ],
        "bendLongPathsTrigger": 0.5
    },
    "Faces": {
        "enabled": true,
        "//[keywordsToPersons]": [
            "If a photo has the same face (person) name and keyword, the app removes the duplicate, keeping the face only."
        ],
        "keywordsToPersons": true,
        "//[writeAccessMinRole]": [
            "Required minimum right to star (favourite) a face."
        ],
        "writeAccessMinRole": "Admin",
        "//[readAccessMinRole]": [
            "Required minimum right to show the faces tab."
        ],
        "readAccessMinRole": "User"
    },
    "//[RandomPhoto]": [
        "This feature enables you to generate 'random photo' urls. That URL returns a photo random selected from your gallery. You can use the url with 3rd party application like random changing desktop background. Note: With the current implementation, random link also requires login."
    ],
    "RandomPhoto": {
        "//[enabled]": [
            "Enables random link generation."
        ],
        "enabled": true
    },
    "Database": {
        "//[type]": [
            "SQLite is recommended."
        ],
        "type": "sqlite",
        "//[dbFolder]": [
            "All file-based data will be stored here (sqlite database, job history data)."
        ],
        "dbFolder": "db",
        "sqlite": {
            "//[DBFileName]": [
                "Sqlite will save the db with this filename."
            ],
            "DBFileName": "sqlite.db"
        },
        "mysql": {
            "host": "localhost",
            "port": 3306,
            "database": "pigallery2",
            "username": "",
            "password": ""
        }
    },
    "Indexing": {
        "//[cachedFolderTimeout]": [
            "If there was no indexing in this time, it reindexes. (skipped if indexes are in DB and sensitivity is low)."
        ],
        "cachedFolderTimeout": 3600000,
        "//[reIndexingSensitivity]": [
            "Set the reindexing sensitivity. High value check the folders for change more often.  Setting to never only indexes if never indexed or explicit running the Indexing Job."
        ],
        "reIndexingSensitivity": "low",
        "//[excludeFolderList]": [
            "Folders to exclude from indexing. If an entry starts with '/' it is treated as an absolute path. If it doesn't start with '/' but contains a '/', the path is relative to the image directory. If it doesn't contain a '/', any folder with this name will be excluded."
        ],
        "excludeFolderList": [
            ".Trash-1000",
            ".dtrash",
            "$RECYCLE.BIN"
        ],
        "//[excludeFileList]": [
            "Files that mark a folder to be excluded from indexing. Any folder that contains a file with this name will be excluded from indexing."
        ],
        "excludeFileList": []
    },
    "//[AlbumCover]": [
        "Specify a search query and sorting that the app can use to pick the best photo for an album and folder cover. There is no way to manually pick folder and album cover in the app. You can tag some of your photos with 'cover' and set that as search query or rate them to 5 and set sorting to descending by rating."
    ],
    "AlbumCover": {
        "//[SearchQuery]": [
            "Filters the sub-folders with this search query. If filter results no photo, the app will search again without the filter."
        ],
        "SearchQuery": {
            "type": 100,
            "text": ""
        },
        "//[Sorting]": [
            "If multiple cover is available sorts them by these methods and selects the first one."
        ],
        "Sorting": [
            {
                "method": "Rating",
                "ascending": false
            },
            {
                "method": "Date",
                "ascending": false
            },
            {
                "method": "PersonCount",
                "ascending": false
            }
        ]
    },
    "Duplicates": {
        "//[listingLimit]": [
            "Maximum number of duplicates to list."
        ],
        "listingLimit": 1000
    },
    "//[Messaging]": [
        "The App can send messages (like photos on the same day a year ago. aka: \"Top Pick\"). Here you can configure the delivery method."
    ],
    "Messaging": {
        "//[Email]": [
            "The app uses Nodemailer in the background for sending e-mails. Refer to https://nodemailer.com/usage/ if some options are not clear."
        ],
        "Email": {
            "//[emailFrom]": [
                "Some services do not allow sending from random e-mail addresses. Set this accordingly."
            ],
            "emailFrom": "noreply@pigallery2.com",
            "smtp": {
                "//[host]": [
                    "SMTP host server"
                ],
                "host": "",
                "//[port]": [
                    "SMTP server's port"
                ],
                "port": 587,
                "//[secure]": [
                    "Is the connection secure. See https://nodemailer.com/smtp/#tls-options for more details"
                ],
                "secure": false,
                "//[requireTLS]": [
                    "if this is true and secure is false then Nodemailer (used library in the background) tries to use STARTTLS. See https://nodemailer.com/smtp/#tls-options for more details"
                ],
                "requireTLS": true,
                "//[user]": [
                    "User to connect to the SMTP server."
                ],
                "user": "",
                "//[password]": [
                    "Password to connect to the SMTP server."
                ],
                "password": ""
            }
        }
    },
    "Jobs": {
        "//[maxSavedProgress]": [
            "Job history size."
        ],
        "maxSavedProgress": 20,
        "//[mediaProcessingBatchSize]": [
            "Jobs load this many photos or videos form the DB for processing at once."
        ],
        "mediaProcessingBatchSize": 1000,
        "scheduled": [
            {
                "name": "Indexing",
                "jobName": "Indexing",
                "config": {
                    "indexChangesOnly": true
                },
                "allowParallelRun": false,
                "trigger": {
                    "type": "never"
                }
            },
            {
                "name": "Album Cover Filling",
                "jobName": "Album Cover Filling",
                "config": {},
                "allowParallelRun": false,
                "trigger": {
                    "type": "after",
                    "afterScheduleName": "Indexing"
                }
            },
            {
                "name": "Thumbnail Generation",
                "jobName": "Thumbnail Generation",
                "config": {
                    "sizes": [
                        240
                    ],
                    "indexedOnly": true
                },
                "allowParallelRun": false,
                "trigger": {
                    "type": "after",
                    "afterScheduleName": "Album Cover Filling"
                }
            },
            {
                "name": "Photo Converting",
                "jobName": "Photo Converting",
                "config": {
                    "indexedOnly": true
                },
                "allowParallelRun": false,
                "trigger": {
                    "type": "after",
                    "afterScheduleName": "Thumbnail Generation"
                }
            },
            {
                "name": "Video Converting",
                "jobName": "Video Converting",
                "config": {
                    "indexedOnly": true
                },
                "allowParallelRun": false,
                "trigger": {
                    "type": "after",
                    "afterScheduleName": "Photo Converting"
                }
            },
            {
                "name": "GPX Compression",
                "jobName": "GPX Compression",
                "config": {
                    "indexedOnly": true
                },
                "allowParallelRun": false,
                "trigger": {
                    "type": "after",
                    "afterScheduleName": "Video Converting"
                }
            },
            {
                "name": "Temp Folder Cleaning",
                "jobName": "Temp Folder Cleaning",
                "config": {
                    "indexedOnly": true
                },
                "allowParallelRun": false,
                "trigger": {
                    "type": "after",
                    "afterScheduleName": "GPX Compression"
                }
            }
        ]
    }
}```