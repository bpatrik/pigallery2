import {UserRoles} from '../UserDTO';


export type IClientMediaFields = 'title' | 'caption' | 'cameraData' | 'positionData' |
  'faces' | 'keywords' | 'size' | 'creationDate' | 'creationDateOffset' | 'bitRate' |
  'duration' | 'fileSize' | 'fps';

export interface IClientSVGIconConfig {
  /**
   * SVG path viewBox. See: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/viewBox
   */
  viewBox: string;
  /**
   * Content elements (paths, circles, rects) of the SVG icon. Icons used on the map: fontawesome.com/icons.
   */
  items: string;
}

export interface IClientMediaButtonPopupFields {
  /**
   * Id of the field. This how it will be listed in the body.
   */
  id: string;
  /**
   * Type of the field.
   */
  type: 'string' | 'number' | 'boolean';
  /**
   * Label of the field. This string will be shown in the popup.
   */
  label: string;
  /**
   * Default value of the field. Should appropriately to the type.
   */
  defaultValue?: string | number | boolean;
  /**
   * Keep value across popups. Use this if you would like to use the same value on multiple popups (e.g.: like adding the same keyword to multiple photos).
   */
  keepValue?: boolean;
  /**
   * If true, the field will be required.
   * If boolean, the field will be required to be true to click the button.
   */
  required?: boolean;
}

export interface IClientMediaButtonPopupConfig {
  /**
   * Header of the popup.
   */
  header?: string;
  /**
   * Body of the popup.
   */
  body?: string;
  /**
   * Button text on the action button.
   */
  buttonString?: string;
  /**
   * Fields to show in the popup as editable text fields.
   */
  fields?: IClientMediaFields[];
  /**
   * Custom fields to show in the popup.
   */
  customFields?: IClientMediaButtonPopupFields[];
}

/**
 * Data that will be sent to the server side when the media button is clicked.
 * The data will be sent as a JSON object.
 * The keys of the object will be the field names.
 * The values will be the field values.
 */
export interface IMediaRequestBodyData {
  /**
   * Existing metadata fields of a media.
   */
  fields?: {
    title?: string,
    caption?: string,
    cameraData?: string,
    positionData?: string,
    faces?: string,
    size?: string,
    creationDate?: string,
    creationDateOffset?: string,
    bitRate?: string,
    duration?: string,
    fileSize?: string,
    fps?: string,
    keywords?: string
  };
  customFields?: Record<string, any>;
}


export interface IClientMediaButtonConfig {
  /**
   * Name of the button. This is also used as id.
   */
  name: string;
  /**
   * Icon of the button. This will be shown in the gallery and also in the lightbox.
   * You can look for icons here: https://fontawesome.com
   */
  svgIcon: IClientSVGIconConfig;
  /**
   * If true, the button will be hidden on photos
   */
  skipPhotos?: boolean;
  /**
   * If true, the button will be hidden on videos
   */
  skipVideos?: boolean;
  /**
   * If set, the button will only be shown if the metadata matches this filter.
   * example values:
   * [
   *   {field: 'rating', comparator: '==', value: 4}, // matches if rating is 4
   *   {field: 'size.width', comparator: '>=', value: 400} // matches if width is >= 400px
   * ]
   */
  metadataFilter?: { field: string, comparator: '>=' | '<=' | '==', value: string | number }[];
  /**
   * If true, the button will always be visible, not only on hover.
   */
  alwaysVisible?: boolean;
  /**
   * Path to the server side function that will be called when the button is clicked.
   * If it is not set, it will be a fake button. (i.e.: only shows up but does not do anything)
   */
  apiPath?: string;
  /**
   * Popup config. IF you want conformation before calling the apiPath or want to change media metedata, set this.
   */
  popup?: IClientMediaButtonPopupConfig;
  /**
   * If true, after calling the apiPath, the gallery content will be reloaded.  (faster than reloadContent)
   */
  reloadContent?: boolean;
  /**
   * If true, after calling the apiPath, the whole webpage will be reloaded. (slower than reloadSite)
   */
  reloadSite?: boolean;

  /**
   * If set, the button will only be shown to users with this role or higher.
   */
  minUserRole?: UserRoles;
  /**
   * If set, the button click will not invalidate the directory.
   * Upon invalidation, the whole directory will be recalculated.
   * If you change any media file, you should set this to false.
   */
  skipDirectoryInvalidation?: boolean;
}

export interface UIExtensionDTO {
  extensionBasePath: string;
  mediaButtons: IClientMediaButtonConfig[];
}
