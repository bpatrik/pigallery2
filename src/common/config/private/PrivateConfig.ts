/* eslint-disable @typescript-eslint/no-inferrable-types */
import 'reflect-metadata';
import {
  AfterJobTrigger,
  JobScheduleDTO,
  JobTrigger,
  JobTriggerType,
  NeverJobTrigger,
  PeriodicJobTrigger,
  ScheduledJobTrigger,
} from '../../entities/job/JobScheduleDTO';
import {
  ClientConfig,
  ClientGPXCompressingConfig,
  ClientMediaConfig,
  ClientMetaFileConfig,
  ClientPhotoConfig,
  ClientServiceConfig,
  ClientSharingConfig,
  ClientSortingConfig,
  ClientUserConfig,
  ClientVideoConfig,
  ConfigPriority,
  TAGS
} from '../public/ClientConfig';
import {ConfigProperty, SubConfigClass} from 'typeconfig/common';
import {DefaultsJobs} from '../../entities/job/JobDTO';
import {SearchQueryDTO, SearchQueryTypes, TextSearch,} from '../../entities/SearchQueryDTO';
import {SortByTypes} from '../../entities/SortingMethods';
import {UserRoles} from '../../entities/UserDTO';
import {MediaPickDTO} from '../../entities/MediaPickDTO';
import {ServerExtensionsConfig} from './subconfigs/ServerExtensionsConfig';
import {MessagingConfig} from './subconfigs/MessagingConfig';

declare let $localize: (s: TemplateStringsArray) => string;

if (typeof $localize === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  global.$localize = (s) => s;
}


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

export type videoCodecType = 'libvpx-vp9' | 'libx264' | 'libvpx' | 'libx265';
export type videoResolutionType =
  | 240
  | 360
  | 480
  | 720
  | 1080
  | 1440
  | 2160
  | 4320;
export type videoFormatType = 'mp4' | 'webm';

@SubConfigClass({softReadonly: true})
export class MySQLConfig {
  @ConfigProperty({
    envAlias: 'MYSQL_HOST',
    tags:
      {
        name: $localize`Host`,
        uiResetNeeded: {server: true},
        priority: ConfigPriority.advanced
      },
  })
  host: string = 'localhost';
  @ConfigProperty({
    envAlias: 'MYSQL_PORT', min: 0, max: 65535,
    tags:
      {
        name: $localize`Port`,
        uiResetNeeded: {server: true},
        priority: ConfigPriority.advanced
      },
  })
  port: number = 3306;
  @ConfigProperty({
    envAlias: 'MYSQL_DATABASE',
    tags:
      {
        name: $localize`Database`,
        uiResetNeeded: {server: true},
        priority: ConfigPriority.advanced
      },
  })
  database: string = 'pigallery2';
  @ConfigProperty({
    envAlias: 'MYSQL_USERNAME',
    tags:
      {
        name: $localize`Username`,
        uiResetNeeded: {server: true},
        priority: ConfigPriority.advanced
      },
  })
  username: string = '';
  @ConfigProperty({
    envAlias: 'MYSQL_PASSWORD', type: 'password',
    tags:
      {
        name: $localize`Password`,
        uiResetNeeded: {server: true},
        priority: ConfigPriority.advanced
      }
  })
  password: string = '';
}

@SubConfigClass({softReadonly: true})
export class SQLiteConfig {
  @ConfigProperty({
    tags:
      {
        name: $localize`Sqlite db filename`,
        uiResetNeeded: {server: true},
        priority: ConfigPriority.underTheHood
      },
    description: $localize`Sqlite will save the db with this filename.`,
  })
  DBFileName: string = 'sqlite.db';
}

@SubConfigClass({softReadonly: true})
export class UserConfig {
  @ConfigProperty({
    tags:
      {
        name: $localize`Name`,
        priority: ConfigPriority.underTheHood
      }
  })
  name: string;

  @ConfigProperty({
    type: UserRoles,
    tags:
      {
        name: $localize`Role`,
        priority: ConfigPriority.underTheHood
      },
  })
  role: UserRoles = UserRoles.User;

  @ConfigProperty<string, ServerConfig, TAGS>({
    type: 'string',
    tags:
      {
        name: $localize`Password`,
        priority: ConfigPriority.underTheHood,
        relevant: (c: UserConfig) => !c.encrypted
      },
    description: $localize`Unencrypted, temporary password. App will encrypt it and delete this.`
  })
  password: string;

  @ConfigProperty({
    tags:
      {
        name: $localize`Encrypted password`,
        priority: ConfigPriority.underTheHood,
        secret: true
      },
  })
  encryptedPassword: string | undefined;

  @ConfigProperty({
    tags:
      {
        priority: ConfigPriority.underTheHood,
        relevant: () => false // never render this on UI. Only used to indicate that encryption is done.
      } as TAGS,
  })
  encrypted: boolean;

  constructor(name?: string, password?: string, role?: UserRoles) {
    if (name) {
      this.name = name;
    }
    if (typeof role !== 'undefined') {
      this.role = role;
    }
    if (password) {
      this.password = password;
    }
  }
}

@SubConfigClass({softReadonly: true})
export class ServerDataBaseConfig {
  @ConfigProperty<DatabaseType, ServerConfig>({
    type: DatabaseType,
    tags:
      {
        name: $localize`Type`,
        priority: ConfigPriority.advanced,
        uiResetNeeded: {db: true},
        githubIssue: 573
      } as TAGS,
    description: $localize`SQLite is recommended.`
  })
  type: DatabaseType = DatabaseType.sqlite;

  @ConfigProperty({
    tags:
      {
        name: $localize`Database folder`,
        uiResetNeeded: {server: true},
        priority: ConfigPriority.advanced
      },
    description: $localize`All file-based data will be stored here (sqlite database, job history data).`,
  })
  dbFolder: string = 'db';

  @ConfigProperty({
    tags:
      {
        name: $localize`SQLite`,
        uiResetNeeded: {db: true},
        relevant: (c: any) => c.type === DatabaseType.sqlite,
      }
  })
  sqlite?: SQLiteConfig = new SQLiteConfig();

  @ConfigProperty({
    tags:
      {
        name: $localize`MySQL`,
        uiResetNeeded: {db: true},
        relevant: (c: any) => c.type === DatabaseType.mysql,
      }
  })
  mysql?: MySQLConfig = new MySQLConfig();


}


@SubConfigClass({softReadonly: true})
export class ServerUserConfig extends ClientUserConfig {
  @ConfigProperty({
    arrayType: UserConfig,
    tags:
      {
        name: $localize`Enforced users`,
        priority: ConfigPriority.underTheHood,
        uiResetNeeded: {server: true},
        uiOptional: true,
        githubIssue: 575
      } as TAGS,
    description: $localize`Creates these users in the DB during startup if they do not exist. If a user with this name exist, it won't be overwritten, even if the role is different.`,
  })
  enforcedUsers: UserConfig[] = [];
}


@SubConfigClass({softReadonly: true})
export class ServerPhotoConfig extends ClientPhotoConfig {
  @ConfigProperty({
    tags:
      {
        name: $localize`High quality resampling`,
        priority: ConfigPriority.underTheHood
      },
    description: $localize`if true, 'lanczos3' will used to scale photos, otherwise faster but lower quality 'nearest'.`
  })
  useLanczos3: boolean = true;
  @ConfigProperty({
    max: 100, min: 1, type: 'unsignedInt',
    tags:
      {
        name: $localize`Converted photo and thumbnail quality`,
        priority: ConfigPriority.underTheHood
      },
    description: $localize`Between 0-100.`
  })
  quality = 80;
  @ConfigProperty({
    type: 'boolean',
    tags:
      {
        name: $localize`Use chroma subsampling`,
        priority: ConfigPriority.underTheHood
      },
    description: $localize`Use high quality chroma subsampling in webp. See: https://sharp.pixelplumbing.com/api-output#webp.`
  })
  smartSubsample = true;

  @ConfigProperty({
    type: 'float',
    tags:
      {
        name: $localize`Person face margin`,
        priority: ConfigPriority.underTheHood
      },
    description: $localize`This ratio of the face bounding box will be added to the face as a margin. Higher number add more margin.`
  })
  personFaceMargin: number = 0.7; // in ratio [0-1]
  @ConfigProperty({
    type: 'boolean',
    tags:
      {
        name: $localize`Keep Gif animation`,
        priority: ConfigPriority.underTheHood
      },
    description: $localize`Converts Gif to animated webp.`
  })
  animateGif = true;
}

@SubConfigClass({softReadonly: true})
export class ServerGPXCompressingConfig extends ClientGPXCompressingConfig {
  @ConfigProperty({
    tags:
      {
        name: $localize`OnTheFly *.gpx compression`,
        priority: ConfigPriority.advanced,
        uiDisabled: (sc: ServerGPXCompressingConfig, c: ServerConfig) => !c.Map.enabled || !sc.enabled || !c.MetaFile.gpx
      },
    description: $localize`Enables on the fly *.gpx compression.`,
  })
  onTheFly: boolean = true;
  @ConfigProperty({
    type: 'unsignedInt',
    tags:
      {
        name: $localize`Min distance`,
        priority: ConfigPriority.underTheHood,
        unit: 'm',
        uiDisabled: (sc: ServerGPXCompressingConfig, c: ServerConfig) => !c.Map.enabled || !sc.enabled || !c.MetaFile.gpx
      } as TAGS,
    description: $localize`Filters out entry that are closer than this to each other in meters.`
  })
  minDistance: number = 5;
  @ConfigProperty({
    type: 'unsignedInt',
    tags:
      {
        name: $localize`Max middle point deviance`,
        priority: ConfigPriority.underTheHood,
        unit: 'm',
        uiDisabled: (sc: ServerGPXCompressingConfig, c: ServerConfig) => !c.Map.enabled || !sc.enabled || !c.MetaFile.gpx
      } as TAGS,
    description: $localize`Filters out entry that would fall on the line if we would just connect the previous and the next points. This setting sets the sensitivity for that (higher number, more points are filtered).`
  })
  maxMiddleDeviance: number = 5;
  @ConfigProperty({
    type: 'unsignedInt',
    tags:
      {
        name: $localize`Min time delta`,
        priority: ConfigPriority.underTheHood,
        unit: 'ms',
        uiDisabled: (sc: ServerGPXCompressingConfig, c: ServerConfig) => !c.Map.enabled || !sc.enabled || !c.MetaFile.gpx
      } as TAGS,
    description: $localize`Filters out entry that are closer than this in time in milliseconds.`
  })
  minTimeDistance: number = 5000;
}

@SubConfigClass({softReadonly: true})
export class ServerMetaFileConfig extends ClientMetaFileConfig {
  @ConfigProperty({
    tags:
      {
        name: $localize`GPX compression`,
        priority: ConfigPriority.advanced,
        uiJob: [{
          job: DefaultsJobs[DefaultsJobs['GPX Compression']],
          relevant: (c) => c.MetaFile.GPXCompressing.enabled
        }, {
          job: DefaultsJobs[DefaultsJobs['Delete Compressed GPX']],
          relevant: (c) => c.MetaFile.GPXCompressing.enabled
        }]
      } as TAGS
  })
  GPXCompressing: ServerGPXCompressingConfig = new ServerGPXCompressingConfig();
}


@SubConfigClass({softReadonly: true})
export class ServerSharingConfig extends ClientSharingConfig {
  @ConfigProperty({
    type: 'unsignedInt',
    tags:
      {
        name: $localize`Update timeout`,
        priority: ConfigPriority.underTheHood,
        unit: 'ms'
      } as TAGS,
    description: $localize`After creating a sharing link, it can be updated for this long.`
  })
  updateTimeout: number = 1000 * 60 * 5;
}

@SubConfigClass({softReadonly: true})
export class ServerIndexingConfig {
  @ConfigProperty({
    type: 'unsignedInt',
    tags:
      {
        name: $localize`Index cache timeout`,
        priority: ConfigPriority.underTheHood,
        unit: 'ms'
      } as TAGS,
    description: $localize`If there was no indexing in this time, it reindexes. (skipped if indexes are in DB and sensitivity is low).`
  })
  cachedFolderTimeout: number = 1000 * 60 * 60; // Do not rescans the folder if seems ok
  @ConfigProperty({
    type: ReIndexingSensitivity,
    tags:
      {
        name: $localize`Folder reindexing sensitivity`,
        priority: ConfigPriority.advanced
      },
    description: $localize`Set the reindexing sensitivity. High value check the folders for change more often.  Setting to never only indexes if never indexed or explicit running the Indexing Job.`
  })
  reIndexingSensitivity: ReIndexingSensitivity = ReIndexingSensitivity.low;
  @ConfigProperty({
    arrayType: 'string',
    tags:
      {
        name: $localize`Exclude Folder List`,
        priority: ConfigPriority.advanced,
        uiResetNeeded: {server: true, db: true},
        uiOptional: true,
        uiAllowSpaces: true
      } as TAGS,
    description: $localize`Folders to exclude from indexing. If an entry starts with '/' it is treated as an absolute path. If it doesn't start with '/' but contains a '/', the path is relative to the image directory. If it doesn't contain a '/', any folder with this name will be excluded.`,
  })
  excludeFolderList: string[] = ['.Trash-1000', '.dtrash', '$RECYCLE.BIN'];
  @ConfigProperty({
    arrayType: 'string',
    tags:
      {
        name: $localize`Exclude File List`,
        priority: ConfigPriority.advanced,
        uiResetNeeded: {server: true, db: true},
        uiOptional: true,
        hint: $localize`.ignore;.pg2ignore`
      } as TAGS,
    description: $localize`Files that mark a folder to be excluded from indexing. Any folder that contains a file with this name will be excluded from indexing.`,
  })
  excludeFileList: string[] = [];
}

@SubConfigClass({softReadonly: true})
export class ServerDuplicatesConfig {
  @ConfigProperty({
    type: 'unsignedInt',
    tags:
      {
        name: $localize`Max duplicates`,
        priority: ConfigPriority.underTheHood
      },
    description: $localize`Maximum number of duplicates to list.`
  })
  listingLimit: number = 1000;
}

@SubConfigClass({softReadonly: true})
export class ServerLogConfig {
  @ConfigProperty({
    type: LogLevel,
    tags: {
      name: $localize`Level`,
      priority: ConfigPriority.advanced,
    },
    description: $localize`Logging level.`
  })
  level: LogLevel = LogLevel.info;
  @ConfigProperty({
    type: SQLLogLevel,
    tags: {
      name: $localize`Sql Level`,
      priority: ConfigPriority.underTheHood,
    },
    description: $localize`Logging level for SQL queries.`
  })
  sqlLevel: SQLLogLevel = SQLLogLevel.error;
  @ConfigProperty({
    tags: {
      name: $localize`Server timing`,
      priority: ConfigPriority.underTheHood,
    },
    description: $localize`If enabled, the app ads "Server-Timing" http header to the response.`
  })
  logServerTiming: boolean = false;
}

@SubConfigClass({softReadonly: true})
export class NeverJobTriggerConfig implements NeverJobTrigger {
  @ConfigProperty({type: JobTriggerType})
  readonly type = JobTriggerType.never;
}

@SubConfigClass({softReadonly: true})
export class ScheduledJobTriggerConfig implements ScheduledJobTrigger {
  @ConfigProperty({type: JobTriggerType})
  readonly type = JobTriggerType.scheduled;

  @ConfigProperty({type: 'unsignedInt'})
  time: number; // data time
}

@SubConfigClass({softReadonly: true})
export class PeriodicJobTriggerConfig implements PeriodicJobTrigger {
  @ConfigProperty({type: JobTriggerType})
  readonly type = JobTriggerType.periodic;
  @ConfigProperty({type: 'unsignedInt', max: 7})
  periodicity: number | undefined = 7; // 0-6: week days 7 every day
  @ConfigProperty({type: 'unsignedInt', max: 23 * 60 + 59})
  atTime: number | undefined = 0; // day time
}

@SubConfigClass({softReadonly: true})
export class AfterJobTriggerConfig implements AfterJobTrigger {
  @ConfigProperty({type: JobTriggerType})
  readonly type = JobTriggerType.after;
  @ConfigProperty()
  afterScheduleName: string | undefined; // runs after schedule

  constructor(afterScheduleName?: string) {
    this.afterScheduleName = afterScheduleName;
  }
}

@SubConfigClass({softReadonly: true})
export class JobScheduleConfig implements JobScheduleDTO {
  @ConfigProperty()
  name: string;
  @ConfigProperty()
  jobName: string;
  @ConfigProperty()
  config: Record<string, string | number | string[] | number[] | MediaPickDTO[]> = {};
  @ConfigProperty()
  allowParallelRun: boolean = false;
  @ConfigProperty({
    type: NeverJobTriggerConfig,
    typeBuilder: (v: JobTrigger) => {
      const type = typeof v.type === 'number' ? v.type : JobTriggerType[v.type];
      switch (type) {
        case JobTriggerType.after:
          return AfterJobTriggerConfig;
        case JobTriggerType.never:
          return NeverJobTriggerConfig;
        case JobTriggerType.scheduled:
          return ScheduledJobTriggerConfig;
        case JobTriggerType.periodic:
          return PeriodicJobTriggerConfig;
      }
      return null;
    },
  })
  trigger:
    | AfterJobTriggerConfig
    | NeverJobTriggerConfig
    | PeriodicJobTriggerConfig
    | ScheduledJobTriggerConfig;

  constructor(
    name: string,
    jobName: string,
    trigger:
      | AfterJobTriggerConfig
      | NeverJobTriggerConfig
      | PeriodicJobTriggerConfig
      | ScheduledJobTriggerConfig,
    config: any = {},
    allowParallelRun: boolean = false
  ) {
    this.name = name;
    this.jobName = jobName;
    this.config = config;
    this.allowParallelRun = allowParallelRun;
    this.trigger = trigger;
  }
}

@SubConfigClass({softReadonly: true})
export class ServerJobConfig {
  @ConfigProperty({
    type: 'unsignedInt',
    tags:
      {
        name: $localize`Max saved progress`,
        priority: ConfigPriority.underTheHood
      },
    description: $localize`Job history size.`
  })
  maxSavedProgress: number = 20;
  @ConfigProperty({
    type: 'unsignedInt',
    tags:
      {
        name: $localize`Processing batch size`,
        priority: ConfigPriority.underTheHood
      },
    description: $localize`Jobs load this many photos or videos form the DB for processing at once.`
  })
  mediaProcessingBatchSize: number = 1000;
  @ConfigProperty({
    arrayType: JobScheduleConfig,
    tags: {
      name: $localize`Scheduled jobs`,
      priority: ConfigPriority.advanced
    }
  })
  scheduled: JobScheduleConfig[] = [
    new JobScheduleConfig(
      DefaultsJobs[DefaultsJobs.Indexing],
      DefaultsJobs[DefaultsJobs.Indexing],
      new NeverJobTriggerConfig(),
      {indexChangesOnly: true} // set config explicitly, so it is not undefined on the UI
    ),
    new JobScheduleConfig(
      DefaultsJobs[DefaultsJobs['Album Cover Filling']],
      DefaultsJobs[DefaultsJobs['Album Cover Filling']],
      new AfterJobTriggerConfig(DefaultsJobs[DefaultsJobs['Indexing']]),
      {}
    ),
    new JobScheduleConfig(
      DefaultsJobs[DefaultsJobs['Photo Converting']],
      DefaultsJobs[DefaultsJobs['Photo Converting']],
      new AfterJobTriggerConfig(DefaultsJobs[DefaultsJobs['Album Cover Filling']]),
      {sizes: [320], maxVideoSize: 800, indexedOnly: true}
    ),
    new JobScheduleConfig(
      DefaultsJobs[DefaultsJobs['Video Converting']],
      DefaultsJobs[DefaultsJobs['Video Converting']],
      new AfterJobTriggerConfig(DefaultsJobs[DefaultsJobs['Photo Converting']]),
      {indexedOnly: true}
    ),
    new JobScheduleConfig(
      DefaultsJobs[DefaultsJobs['GPX Compression']],
      DefaultsJobs[DefaultsJobs['GPX Compression']],
      new AfterJobTriggerConfig(DefaultsJobs[DefaultsJobs['Video Converting']]),
      {indexedOnly: true}
    ),
    new JobScheduleConfig(
      DefaultsJobs[DefaultsJobs['Temp Folder Cleaning']],
      DefaultsJobs[DefaultsJobs['Temp Folder Cleaning']],
      new AfterJobTriggerConfig(DefaultsJobs[DefaultsJobs['GPX Compression']]),
      {indexedOnly: true}
    ),
  ];
}

@SubConfigClass({softReadonly: true})
export class VideoTranscodingConfig {
  @ConfigProperty({
    type: 'unsignedInt',
    tags:
      {
        name: $localize`Bit rate`,
        priority: ConfigPriority.advanced,
        unit: 'bps'
      },
    description: $localize`Target bit rate of the output video will be scaled down this this. This should be less than the upload rate of your home server.`
  })
  bitRate: number = 5 * 1024 * 1024;
  @ConfigProperty({
    type: 'unsignedInt',
    tags:
      {
        name: $localize`Resolution`,
        priority: ConfigPriority.advanced,
        uiOptions: [720, 1080, 1440, 2160, 4320],
        unit: 'px'
      },
    description: $localize`The height of the output video will be scaled down to this, while keeping the aspect ratio.`
  })
  resolution: videoResolutionType = 720;
  @ConfigProperty({
    type: 'positiveFloat',
    tags:
      {
        name: $localize`FPS`,
        priority: ConfigPriority.underTheHood,
        uiOptions: [24, 25, 30, 48, 50, 60]
      },
    description: $localize`Target frame per second (fps) of the output video will be scaled down this this.`
  })
  fps: number = 25;
  @ConfigProperty({
    tags:
      {
        name: $localize`Format`,
        priority: ConfigPriority.advanced,
        uiOptions: ['mp4', 'webm']
      }
  })
  format: videoFormatType = 'mp4';
  @ConfigProperty({
    tags:
      {
        name: $localize`MP4 codec`,
        priority: ConfigPriority.underTheHood,
        uiOptions: ['libx264', 'libx265'],
        relevant: (c: any) => c.format === 'mp4'
      }
  })
  mp4Codec: videoCodecType = 'libx264';
  @ConfigProperty({
    tags:
      {
        name: $localize`Webm Codec`,
        priority: ConfigPriority.underTheHood,
        uiOptions: ['libvpx', 'libvpx-vp9'],
        relevant: (c: any) => c.format === 'webm'
      }
  })
  webmCodec: videoCodecType = 'libvpx';
  @ConfigProperty({
    type: 'unsignedInt', max: 51,
    tags:
      {
        name: $localize`CRF`,
        priority: ConfigPriority.underTheHood,
      },
    description: $localize`The range of the Constant Rate Factor (CRF) scale is 0–51, where 0 is lossless, 23 is the default, and 51 is worst quality possible.`,

  })
  crf: number = 23;
  @ConfigProperty({
    type: FFmpegPresets,
    tags:
      {
        name: $localize`Preset`,
        priority: ConfigPriority.advanced,
      },
    description: $localize`A preset is a collection of options that will provide a certain encoding speed to compression ratio. A slower preset will provide better compression (compression is quality per filesize).`,
  })
  preset: FFmpegPresets = FFmpegPresets.medium;

  @ConfigProperty({
    arrayType: 'string',
    tags: {
      name: $localize`Custom Output Options`,
      priority: ConfigPriority.underTheHood,
      hint: '-pass 2;-minrate 1M;-maxrate 1M;-bufsize 2M',
      uiAllowSpaces: true
    },
    description: $localize`It will be sent to ffmpeg as it is, as custom output options.`,
  })
  customOutputOptions: string[] = [];

  @ConfigProperty({
    arrayType: 'string',
    tags: {
      name: $localize`Custom Input Options`,
      priority: ConfigPriority.underTheHood,
      hint: '-option1; -option2 param2; -option3; -option4 param4',
      githubIssue: 592,
      uiAllowSpaces: true
    } as TAGS,
    description: $localize`It will be sent to ffmpeg as it is, as custom input options.`,
  })
  customInputOptions: string[] = [];

}

@SubConfigClass({softReadonly: true})
export class ServerVideoConfig extends ClientVideoConfig {
  @ConfigProperty({
    tags: {
      name: $localize`Video transcoding`,
      priority: ConfigPriority.advanced,
      uiDisabled: (sb: ClientVideoConfig) => !sb.enabled
    },
    description: $localize`To ensure smooth video playback, video transcoding is recommended to a lower bit rate than the server's upload rate.   The transcoded videos will be save to the thumbnail folder.  You can trigger the transcoding manually, but you can also create an automatic encoding job in advanced settings mode.`
  })
  transcoding: VideoTranscodingConfig = new VideoTranscodingConfig();
}


@SubConfigClass({softReadonly: true})
export class ServerAlbumCoverConfig {
  @ConfigProperty({
    type: 'object',
    tags: {
      name: $localize`Cover Filter query`,
      uiResetNeeded: {db: true},
      priority: ConfigPriority.advanced,
      uiType: 'SearchQuery'
    },
    description: $localize`Filters the sub-folders with this search query. If filter results no photo, the app will search again without the filter.`,
  })
  SearchQuery: SearchQueryDTO = {
    type: SearchQueryTypes.any_text,
    text: '',
  } as TextSearch;
  @ConfigProperty({
    arrayType: ClientSortingConfig,
    tags: {
      name: $localize`Cover Sorting`,
      uiResetNeeded: {db: true},
      priority: ConfigPriority.advanced
    },
    description: $localize`If multiple cover is available sorts them by these methods and selects the first one.`,
  })
  Sorting: ClientSortingConfig[] = [
    new ClientSortingConfig(SortByTypes.Rating, false),
    new ClientSortingConfig(SortByTypes.Date, false),
    new ClientSortingConfig(SortByTypes.PersonCount, false)
  ];
}

@SubConfigClass({softReadonly: true})
export class ServerMediaConfig extends ClientMediaConfig {
  @ConfigProperty({

    tags: {
      name: $localize`Images folder`,
      priority: ConfigPriority.basic,
      uiResetNeeded: {server: true},
      dockerSensitive: true
    },
    description: $localize`Images are loaded from this folder (read permission required)`,

  })
  folder: string = 'demo/images';
  @ConfigProperty({
    tags: {
      name: $localize`Temp folder`,
      uiResetNeeded: {server: true},
      priority: ConfigPriority.basic,
      dockerSensitive: true
    },
    description: $localize`Thumbnails, converted photos, videos will be stored here (write permission required)`,
  })
  tempFolder: string = 'demo/tmp';

  @ConfigProperty({
    type: 'unsignedInt',
    tags: {
      name: $localize`Metadata read buffer`,
      priority: ConfigPriority.underTheHood,
      uiResetNeeded: {db: true, server: true},
      githubIssue: 398,
      unit: 'bytes'
    } as TAGS,
    description: $localize`Only this many bites will be loaded when scanning photo/video for metadata. Increase this number if your photos shows up as square.`,
  })
  photoMetadataSize: number = 512 * 1024; // only this many bites will be loaded when scanning photo for metadata

  @ConfigProperty({
    tags: {
      name: $localize`Video`,
      uiIcon: 'ionVideocamOutline',
      priority: ConfigPriority.advanced,
      uiJob: [
        {
          job: DefaultsJobs[DefaultsJobs['Video Converting']],
          relevant: (c) => c.Media.Video.enabled
        }]
    } as TAGS,
    description: $localize`Video support uses ffmpeg. ffmpeg and ffprobe binaries need to be available in the PATH or the @ffmpeg-installer/ffmpeg and @ffprobe-installer/ffprobe optional node packages need to be installed.`
  })
  Video: ServerVideoConfig = new ServerVideoConfig();
  @ConfigProperty({
    tags: {
      name: $localize`Photo`,
      uiIcon: 'ionCameraOutline',
      priority: ConfigPriority.advanced,
      uiJob: [{job: DefaultsJobs[DefaultsJobs['Photo Converting']]}]
    } as TAGS
  })
  Photo: ServerPhotoConfig = new ServerPhotoConfig();
}

@SubConfigClass({softReadonly: true})
export class ServerServiceConfig extends ClientServiceConfig {
  @ConfigProperty({
    arrayType: 'string',
    tags: {
      secret: true,
      name: 'sessionSecret'
    }
  })
  sessionSecret: string[] = [];

  @ConfigProperty({
    type: 'unsignedInt',
    tags: {
      name: $localize`Session Timeout`,
      priority: ConfigPriority.underTheHood,
      unit: 'ms'
    },
    description: $localize`Users kept logged in for this long time.`,
  })
  sessionTimeout: number = 1000 * 60 * 60 * 24 * 7; // in ms

  @ConfigProperty({
    tags: {
      name: $localize`Port`,
      priority: ConfigPriority.advanced,
      uiResetNeeded: {server: true},
      dockerSensitive: true
    },
    description: $localize`Port number. Port 80 is usually what you need.`,
    type: 'unsignedInt', envAlias: 'PORT', min: 0, max: 65535
  })
  port: number = 80;

  @ConfigProperty({
    tags: {
      name: $localize`Host`,
      priority: ConfigPriority.advanced,
      uiResetNeeded: {server: true},
      dockerSensitive: true
    },
    description: $localize`Server will accept connections from this IPv6 or IPv4 address.`,
  })
  host: string = '0.0.0.0';

  @ConfigProperty({
    tags: {
      name: $localize`Logs`,
      priority: ConfigPriority.advanced,
    }
  })
  Log: ServerLogConfig = new ServerLogConfig();
}


@SubConfigClass({softReadonly: true})
export class ServerEnvironmentConfig {
  @ConfigProperty({volatile: true})
  upTime: string | undefined;
  @ConfigProperty({volatile: true})
  appVersion: string | undefined;
  @ConfigProperty({volatile: true})
  buildTime: string | undefined;
  @ConfigProperty({volatile: true})
  buildCommitHash: string | undefined;
  @ConfigProperty({volatile: true})
  isDocker: boolean | undefined;
}


@SubConfigClass<TAGS>({softReadonly: true})
export class ServerConfig extends ClientConfig {

  @ConfigProperty({volatile: true})
  Environment: ServerEnvironmentConfig = new ServerEnvironmentConfig();

  @ConfigProperty({
    tags: {
      name: $localize`Server`,
      uiIcon: 'ionCloudOutline'
    } as TAGS,
  })
  Server: ServerServiceConfig = new ServerServiceConfig();

  @ConfigProperty({
    tags: {
      name: $localize`Database`,
      uiIcon: 'ionServerOutline'
    } as TAGS
  })
  Database: ServerDataBaseConfig = new ServerDataBaseConfig();

  @ConfigProperty({
    tags: {
      name: $localize`Users`,
      uiIcon: 'ionPersonOutline'
    } as TAGS,
  })
  Users: ServerUserConfig = new ServerUserConfig();

  @ConfigProperty({
    tags: {
      name: $localize`Indexing`,
      uiIcon: 'ionFileTrayFullOutline',
      uiJob: [
        {
          job: DefaultsJobs[DefaultsJobs.Indexing],
          description: $localize`If you add a new folder to your gallery, the site indexes it automatically.  If you would like to trigger indexing manually, click index button. (Note: search only works among the indexed directories.)`
        }, {
          job: DefaultsJobs[DefaultsJobs['Gallery Reset']],
          hideProgress: true
        }]
    } as TAGS
  })
  Indexing: ServerIndexingConfig = new ServerIndexingConfig();

  @ConfigProperty({
    tags: {
      name: $localize`Media`,
      uiIcon: 'ionImagesOutline'
    } as TAGS,
  })
  Media: ServerMediaConfig = new ServerMediaConfig();

  @ConfigProperty({
    tags: {
      name: $localize`Meta file`,
      uiIcon: 'ionDocumentOutline'
    } as TAGS,
  })
  MetaFile: ServerMetaFileConfig = new ServerMetaFileConfig();

  @ConfigProperty({
    tags: {
      name: $localize`Album cover`,
      uiIcon: 'ionImageOutline',
      githubIssue: 679,
      uiJob: [
        {
          job: DefaultsJobs[DefaultsJobs['Album Cover Filling']],
        }, {
          job: DefaultsJobs[DefaultsJobs['Album Cover Reset']],
          hideProgress: true
        }]
    } as TAGS,
    description: $localize`Specify a search query and sorting that the app can use to pick the best photo for an album and folder cover. There is no way to manually pick folder and album cover in the app. You can tag some of your photos with 'cover' and set that as search query or rate them to 5 and set sorting to descending by rating.`
  })
  AlbumCover: ServerAlbumCoverConfig = new ServerAlbumCoverConfig();

  @ConfigProperty({
    tags: {
      name: $localize`Sharing`,
      uiIcon: 'ionShareSocialOutline'
    } as TAGS,
  })
  Sharing: ServerSharingConfig = new ServerSharingConfig();

  @ConfigProperty({
    tags: {
      name: $localize`Duplicates`,
      uiIcon: 'ionCopyOutline'
    } as TAGS
  })
  Duplicates: ServerDuplicatesConfig = new ServerDuplicatesConfig();

  @ConfigProperty({
    tags: {
      name: $localize`Messaging`,
      uiIcon: 'ionChatboxOutline',
      githubIssue: 683
    } as TAGS,
    description: $localize`The App can send messages (like photos on the same day a year ago. aka: "Top Pick"). Here you can configure the delivery method.`
  })
  Messaging: MessagingConfig = new MessagingConfig();


  @ConfigProperty({
    tags: {
      name: $localize`Extensions`,
      uiIcon: 'ionCloudOutline'
    } as TAGS,
  })
  Extensions: ServerExtensionsConfig = new ServerExtensionsConfig();

  @ConfigProperty({
    tags: {
      name: $localize`Jobs`,
      uiIcon: 'ionPlayOutline'
    } as TAGS
  })
  Jobs: ServerJobConfig = new ServerJobConfig();
}

