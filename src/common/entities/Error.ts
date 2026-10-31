import type {Request} from 'express';

export enum ErrorCodes {
  NOT_AUTHENTICATED = 1,
  NOT_AUTHENTICATED_SHARING = 11,

  ALREADY_AUTHENTICATED = 2,
  NOT_AUTHORISED = 3,
  PERMISSION_DENIED = 4,
  CREDENTIAL_NOT_FOUND = 5,

  USER_CREATION_ERROR = 20,

  GENERAL_ERROR = 31,
  THUMBNAIL_GENERATION_ERROR = 32,
  PHOTO_GENERATION_ERROR = 33,
  PERSON_ERROR = 34,
  METAFILE_ERROR = 35,

  USER_MANAGEMENT_DISABLED = 40,

  INPUT_ERROR = 50,
  PATH_ERROR = 51,
  // Directory does not exist or the user can't access it. These two cases are intentionally not distinguished.
  DIRECTORY_NOT_FOUND = 52,

  SETTINGS_ERROR = 60,
  TASK_ERROR = 61,
  JOB_ERROR = 62,
  LocationLookUp_ERROR = 63,

  ALBUM_ERROR = 70,
  UPLOAD_ERROR = 80,
  INTERNAL = 500
}

export class ErrorDTO {
  public detailsStr: string;
  public request: {
    method: string;
    url: string;
  } = {method: '', url: ''};

  constructor(
    public code: ErrorCodes,
    public message?: string,
    public details?: any,
    req?: Request
  ) {
    this.detailsStr =
      (this.details ? this.details.toString() : '') || ErrorCodes[code];
    if (req) {
      this.request = {
        method: req.method,
        url: req.url,
      };
    }
  }

  toString(): string {
    return '[' + ErrorCodes[this.code] + '] ' + this.message + this.detailsStr;
  }
}
