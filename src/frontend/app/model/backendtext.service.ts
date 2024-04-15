import {Injectable} from '@angular/core';
import {backendText, backendTexts} from '../../../common/BackendTexts';
import {DefaultsJobs} from '../../../common/entities/job/JobDTO';

@Injectable()
export class BackendtextService {

  public get(id: backendText | string): string {
    if (typeof id === 'string') {
      return id;
    }
    switch (id) {
      case backendTexts.sizeToGenerate.name:
        return $localize`Size to generate`;
      case backendTexts.sizeToGenerate.description:
        return $localize`These thumbnails will be generated. The list should be a subset of the enabled thumbnail sizes`;
      case backendTexts.maxVideoSize.name:
        return $localize`Max video size`;
      case backendTexts.maxVideoSize.description:
        return $localize`Sizes bigger than this value won't be generated for videos. Videos does not use photo based previews, so it is not needed to generate big previews for them.`;
      case backendTexts.indexedFilesOnly.name:
        return $localize`Indexed only`;
      case backendTexts.indexedFilesOnly.description:
        return $localize`Only checks indexed files.`;
      case backendTexts.indexChangesOnly.name:
        return $localize`Index changes only`;
      case backendTexts.indexChangesOnly.description:
        return $localize`Only indexes a folder if it got changed.`;
      case backendTexts.mediaPick.name:
        return $localize`Media selectors`;
      case backendTexts.mediaPick.description:
        return $localize`Set these search queries to find photos and videos to email.`;
      case backendTexts.emailTo.name:
        return $localize`E-mail to`;
      case backendTexts.emailTo.description:
        return $localize`E-mail address of the recipient.`;
      case backendTexts.emailSubject.name:
        return $localize`Subject`;
      case backendTexts.emailSubject.description:
        return $localize`E-mail subject.`;
      case backendTexts.emailText.name:
        return $localize`Message`;
      case backendTexts.emailText.description:
        return $localize`E-mail text.`;
      case backendTexts.messenger.name:
        return $localize`Messenger`;
      case backendTexts.messenger.description:
        return $localize`Messenger to send this message with.`;
      default:
        return null;
    }
  }

  public getJobName(job: DefaultsJobs | string): string {
    if (typeof job === 'string') {
      job = DefaultsJobs[job as any];
    }
    switch (job as DefaultsJobs) {
      case DefaultsJobs.Indexing:
        return $localize`Indexing`;
      case DefaultsJobs['Gallery Reset']:
        return $localize`Gallery reset`;
      case DefaultsJobs['Album Reset']:
        return $localize`Album reset`;
      case DefaultsJobs['Photo Converting']:
        return $localize`Photo converting`;
      case DefaultsJobs['Video Converting']:
        return $localize`Video converting`;
      case DefaultsJobs['Temp Folder Cleaning']:
        return $localize`Temp folder cleaning`;
      case DefaultsJobs['Album Cover Filling']:
        return $localize`Cover filling`;
      case DefaultsJobs['Album Cover Reset']:
        return $localize`Cover reset`;
      case DefaultsJobs['GPX Compression']:
        return $localize`GPX compression`;
      case DefaultsJobs['Delete Compressed GPX']:
        return $localize`Delete Compressed GPX`;
      case DefaultsJobs['Top Pick Sending']:
        return $localize`Top Pick Sending`;
      default:
        return null;
    }
  }

  public getJobDescription(job: DefaultsJobs | string): string {
    if (typeof job === 'string') {
      job = DefaultsJobs[job as any];
    }
    switch (job as DefaultsJobs) {
      case DefaultsJobs.Indexing:
        return $localize`Scans the whole gallery from disk and indexes it to the DB.`;
      case DefaultsJobs['Gallery Reset']:
        return $localize`Deletes all directories, photos and videos from the DB.`;
      case DefaultsJobs['Album Reset']:
        return $localize`Removes all albums from the DB`;
       case DefaultsJobs['Photo Converting']:
        return $localize`Generates thumbnails and high-res photos from all media files and stores them in the tmp folder. Smaller sizes will be used for thumbnail (in the grid view), bigger sizes for previews (in the lightbox). Videos does not use photo previews (the app loads the video file instead).`;
      case DefaultsJobs['Video Converting']:
        return $localize`Transcodes all videos and stores them in the tmp folder.`;
      case DefaultsJobs['Temp Folder Cleaning']:
        return $localize`Removes unnecessary files from the tmp folder.`;
      case DefaultsJobs['Album Cover Filling']:
        return $localize`Updates the cover photo of all albums (both directories and saved searches) and faces.`;
      case DefaultsJobs['Album Cover Reset']:
        return $localize`Deletes the cover photo of all albums and faces`;
      case DefaultsJobs['GPX Compression']:
        return $localize`Compresses all gpx files`;
      case DefaultsJobs['Delete Compressed GPX']:
        return $localize`Deletes all compressed GPX files`;
      case DefaultsJobs['Top Pick Sending']:
        return $localize`Gets the top photos of the selected search queries and sends them over email. You need to set up the SMTP server connection to send e-mails.`;
      default:
        return null;
    }
  }
}
