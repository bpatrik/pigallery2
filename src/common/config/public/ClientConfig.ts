/* eslint-disable @typescript-eslint/no-inferrable-types */
import 'reflect-metadata';
import {SortingMethods} from '../../entities/SortingMethods';
import {UserRoles} from '../../entities/UserDTO';
import {ConfigProperty, SubConfigClass} from 'typeconfig/common';
import {IPrivateConfig} from '../private/PrivateConfig';

export enum MapProviders {
  OpenStreetMap = 1,
  Mapbox = 2,
  Custom = 3,
}

@SubConfigClass()
export class AutoCompleteConfig {
  @ConfigProperty()
  enabled: boolean = true;
  @ConfigProperty({type: 'unsignedInt'})
  targetItemsPerCategory: number = 5;
  @ConfigProperty({type: 'unsignedInt'})
  maxItems: number = 30;
  @ConfigProperty({type: 'unsignedInt'})
  cacheTimeout: number = 1000 * 60 * 60;
}

@SubConfigClass()
export class ClientSearchConfig {
  @ConfigProperty()
  enabled: boolean = true;
  @ConfigProperty({type: 'unsignedInt'})
  searchCacheTimeout: number = 1000 * 60 * 60;
  @ConfigProperty()
  AutoComplete: AutoCompleteConfig = new AutoCompleteConfig();
  @ConfigProperty({type: 'unsignedInt'})
  maxMediaResult: number = 10000;
  @ConfigProperty({
    description: 'Search returns also with directories, not just media',
  })
  listDirectories: boolean = false;
  @ConfigProperty({
    description:
      'Search also returns with metafiles from directories that contain a media file of the matched search result',
  })
  listMetafiles: boolean = true;
  @ConfigProperty({type: 'unsignedInt'})
  maxDirectoryResult: number = 200;
}

@SubConfigClass()
export class ClientAlbumConfig {
  @ConfigProperty()
  enabled: boolean = true;
}

@SubConfigClass()
export class ClientSharingConfig {
  @ConfigProperty()
  enabled: boolean = true;
  @ConfigProperty()
  passwordProtected: boolean = true;
}

@SubConfigClass()
export class ClientRandomPhotoConfig {
  @ConfigProperty({description: 'Enables random link generation.'})
  enabled: boolean = true;
}

@SubConfigClass()
export class MapLayers {
  @ConfigProperty()
  name: string = 'street';
  @ConfigProperty()
  url: string = '';
}

@SubConfigClass()
export class ClientMapConfig {
  @ConfigProperty<boolean, IPrivateConfig>({
    onNewValue: (value, config) => {
      if (value === false) {
        config.Client.MetaFile.gpx = false;
      }
    },
  })
  enabled: boolean = true;
  @ConfigProperty({
    type: 'unsignedInt',
    description:
      'Maximum number of markers to be shown on the map preview on the gallery page.',
  })
  maxPreviewMarkers: number = 50;
  @ConfigProperty()
  useImageMarkers: boolean = true;
  @ConfigProperty({type: MapProviders})
  mapProvider: MapProviders = MapProviders.OpenStreetMap;
  @ConfigProperty()
  mapboxAccessToken: string = '';
  @ConfigProperty({arrayType: MapLayers})
  customLayers: MapLayers[] = [new MapLayers()];
}

@SubConfigClass()
export class ClientThumbnailConfig {
  @ConfigProperty({type: 'unsignedInt', max: 100})
  iconSize: number = 45;
  @ConfigProperty({type: 'unsignedInt'})
  personThumbnailSize: number = 200;
  @ConfigProperty({arrayType: 'unsignedInt'})
  thumbnailSizes: number[] = [240, 480];
  @ConfigProperty({volatile: true})
  concurrentThumbnailGenerations: number = 1;

  /**
   * Generates a map for bitwise operation from icon and normal thumbnails
   */
  generateThumbnailMap(): { [key: number]: number } {
    const m: { [key: number]: number } = {};
    [this.iconSize, ...this.thumbnailSizes.sort()].forEach((v, i) => {
      m[v] = Math.pow(2, i + 1);
    });
    return m;
  }

  /**
   * Generates a map for bitwise operation from icon and normal thumbnails
   */
  generateThumbnailMapEntries(): { size: number, bit: number }[] {
    return Object.entries(this.generateThumbnailMap()).map(v => ({size: parseInt(v[0]), bit: v[1]}));
  }
}

@SubConfigClass()
export class NavBarConfig {
  @ConfigProperty()
  showItemCount: boolean = true;
}

@SubConfigClass()
export class ClientOtherConfig {
  @ConfigProperty()
  customHTMLHead: string = '';
  @ConfigProperty()
  enableCache: boolean = true;
  @ConfigProperty()
  enableOnScrollRendering: boolean = true;
  @ConfigProperty({type: SortingMethods})
  defaultPhotoSortingMethod: SortingMethods = SortingMethods.ascDate;
  @ConfigProperty({
    description:
      'If enabled directories will be sorted by date, like photos, otherwise by name. Directory date is the last modification time of that directory not the creation date of the oldest photo',
  })
  enableDirectorySortingByDate: boolean = false;
  @ConfigProperty()
  enableOnScrollThumbnailPrioritising: boolean = true;
  @ConfigProperty()
  NavBar: NavBarConfig = new NavBarConfig();
  @ConfigProperty()
  captionFirstNaming: boolean = false; // shows the caption instead of the filename in the photo grid
  @ConfigProperty()
  enableDownloadZip: boolean = false;
  @ConfigProperty({
    description:
      'Adds a button to flattens the file structure, by listing the content of all subdirectories.',
  })
  enableDirectoryFlattening: boolean = false;
  @ConfigProperty({
    description:
      'Enables using the left/right arrow key at the beginning/end of an album or directory to loop back to the beginning/end.',
  })
  enableDirectoryLoop: boolean = false;
}

@SubConfigClass()
export class ClientVideoConfig {
  @ConfigProperty()
  enabled: boolean = true;
}

@SubConfigClass()
export class PhotoConvertingConfig {
  @ConfigProperty()
  enabled: boolean = true;
}

@SubConfigClass()
export class ClientPhotoConfig {
  @ConfigProperty()
  Converting: PhotoConvertingConfig = new PhotoConvertingConfig();
  @ConfigProperty({
    description:
      'Enables loading the full resolution image on zoom in the ligthbox (preview).',
  })
  loadFullImageOnZoom: boolean = true;
}

@SubConfigClass()
export class ClientGPXCompressingConfig {
  @ConfigProperty()
  enabled: boolean = true;
}

@SubConfigClass()
export class ClientMediaConfig {
  @ConfigProperty()
  Thumbnail: ClientThumbnailConfig = new ClientThumbnailConfig();
  @ConfigProperty()
  Video: ClientVideoConfig = new ClientVideoConfig();
  @ConfigProperty()
  Photo: ClientPhotoConfig = new ClientPhotoConfig();
}

@SubConfigClass()
export class ClientMetaFileConfig {
  @ConfigProperty({
    description: 'Reads *.gpx files and renders them on the map.',
  })
  gpx: boolean = true;

  @ConfigProperty()
  GPXCompressing: ClientGPXCompressingConfig = new ClientGPXCompressingConfig();

  @ConfigProperty({
    description:
      'Reads *.md files in a directory and shows the next to the map.',
  })
  markdown: boolean = true;

  @ConfigProperty({
    description:
      'Reads *.pg2conf files (You can use it for custom sorting and save search (albums)).',
  })
  pg2conf: boolean = true;
}

@SubConfigClass()
export class ClientFacesConfig {
  @ConfigProperty()
  enabled: boolean = true;
  @ConfigProperty()
  keywordsToPersons: boolean = true;
  @ConfigProperty({type: UserRoles})
  writeAccessMinRole: UserRoles = UserRoles.Admin;
  @ConfigProperty({type: UserRoles})
  readAccessMinRole: UserRoles = UserRoles.User;
}

@SubConfigClass()
export class ClientConfig {
  @ConfigProperty()
  applicationTitle: string = 'PiGallery 2';
  @ConfigProperty()
  publicUrl: string = '';
  @ConfigProperty()
  urlBase: string = '';
  @ConfigProperty()
  Search: ClientSearchConfig = new ClientSearchConfig();
  @ConfigProperty()
  Sharing: ClientSharingConfig = new ClientSharingConfig();
  @ConfigProperty()
  Album: ClientAlbumConfig = new ClientAlbumConfig();
  @ConfigProperty()
  Map: ClientMapConfig = new ClientMapConfig();
  @ConfigProperty()
  RandomPhoto: ClientRandomPhotoConfig = new ClientRandomPhotoConfig();
  @ConfigProperty()
  Other: ClientOtherConfig = new ClientOtherConfig();
  @ConfigProperty()
  authenticationRequired: boolean = true;
  @ConfigProperty({type: UserRoles})
  unAuthenticatedUserRole: UserRoles = UserRoles.Admin;
  @ConfigProperty({arrayType: 'string', volatile: true})
  languages: string[] | undefined;
  @ConfigProperty()
  Media: ClientMediaConfig = new ClientMediaConfig();
  @ConfigProperty()
  MetaFile: ClientMetaFileConfig = new ClientMetaFileConfig();
  @ConfigProperty()
  Faces: ClientFacesConfig = new ClientFacesConfig();
}
