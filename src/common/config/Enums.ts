// Enums of the config. They have no imports, so the extension kit can ship them without the config classes.

export enum DatabaseType {
  mysql = 2,
  sqlite = 3,
}

export enum LogLevel {
  error = 1,
  warn = 2,
  info = 3,
  verbose = 4,
  debug = 5,
  silly = 6,
}

export enum SQLLogLevel {
  none = 1,
  error = 2,
  all = 3,
}

export enum ReIndexingSensitivity {
  // Order is important. It also used to do relative comparison.
  // Keep space between items for future
  never = 10,
  low = 20,
  medium = 30,
  high = 40,
}

export enum FFmpegPresets {
  ultrafast = 1,
  superfast = 2,
  veryfast = 3,
  faster = 4,
  fast = 5,
  medium = 6,
  slow = 7,
  slower = 8,
  veryslow = 9,
  placebo = 10,
}

export enum MapProviders {
  OpenStreetMap = 1,
  Mapbox = 2,
  Custom = 3,
}

export enum ConfigPriority {
  basic = 1, advanced, underTheHood
}

export enum ThemeModes {
  light = 1, dark, auto
}

export enum ScrollUpModes {
  never = 1, mobileOnly, always
}

export enum ScrollLabelModes {
  never = 1, date, always
}

/**
 * Used for lightbox titles
 */
export enum LightBoxTitleTexts {
  NONE = 1,
  file,
  resolution,
  size,

  caption,
  title,

  keywords,
  persons,
  location,
  date,

  camera,
  lens,
  iso,
  fstop,
  focal_length,
  directory,
  titleOrCaption,
  titleOrDirectory,
  titleOrCaptionOrDirectory

}

export enum NavigationLinkTypes {
  gallery = 1, faces, albums, search, url
}
