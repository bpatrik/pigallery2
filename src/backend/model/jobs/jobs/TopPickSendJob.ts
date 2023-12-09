import {ConfigTemplateEntry, DefaultsJobs,} from '../../../../common/entities/job/JobDTO';
import {Job} from './Job';
import {backendTexts} from '../../../../common/BackendTexts';
import {SortByTypes} from '../../../../common/entities/SortingMethods';
import {DatePatternFrequency, DatePatternSearch, SearchQueryTypes} from '../../../../common/entities/SearchQueryDTO';
import {ObjectManagers} from '../../ObjectManagers';
import {PhotoEntity} from '../../database/enitites/PhotoEntity';
import {EmailMediaMessenger} from '../../mediamessengers/EmailMediaMessenger';
import {MediaPickDTO} from '../../../../common/entities/MediaPickDTO';
import {MediaDTOUtils} from '../../../../common/entities/MediaDTO';


export class TopPickSendJob extends Job<{
  mediaPick: MediaPickDTO[],
  emailTo: string,
  emailFrom: string,
  emailSubject: string,
  emailText: string,
}> {
  public readonly Name = DefaultsJobs[DefaultsJobs['Top Pick Sending']];
  public readonly Supported: boolean = true;
  public readonly ConfigTemplate: ConfigTemplateEntry[] = [
    {
      id: 'mediaPick',
      type: 'MediaPickDTO-array',
      name: backendTexts.mediaPick.name,
      description: backendTexts.mediaPick.description,
      defaultValue: [{
        searchQuery: {
          type: SearchQueryTypes.date_pattern,
          daysLength: 7,
          frequency: DatePatternFrequency.every_year
        } as DatePatternSearch,
        sortBy: [{method: SortByTypes.Rating, ascending: false},
          {method: SortByTypes.PersonCount, ascending: false}],
        pick: 5
      }] as MediaPickDTO[],
    }, {
      id: 'emailTo',
      type: 'string-array',
      name: backendTexts.emailTo.name,
      description: backendTexts.emailTo.description,
      defaultValue: [],
    }, {
      id: 'emailSubject',
      type: 'string',
      name: backendTexts.emailSubject.name,
      description: backendTexts.emailSubject.description,
      defaultValue: 'Latest photos for you',
    }, {
      id: 'emailText',
      type: 'string',
      name: backendTexts.emailText.name,
      description: backendTexts.emailText.description,
      defaultValue: 'I hand picked these photos just for you:',
    },
  ];
  private status: 'Listing' | 'Sending' = 'Listing';
  private mediaList: PhotoEntity[] = [];


  protected async init(): Promise<void> {
    this.status = 'Listing';
    this.mediaList = [];
    this.Progress.Left = 2;
  }


  protected async step(): Promise<boolean> {

    switch (this.status) {
      case 'Listing':
        if (!await this.stepListing()) {
          this.status = 'Sending';
        }
        return true;
      case 'Sending':
        await this.stepSending();
    }
    return false;
  }

  private async stepListing(): Promise<boolean> {
    this.Progress.log('Collecting Photos and videos to Send.');
    this.mediaList = [];
    for (let i = 0; i < this.config.mediaPick.length; ++i) {
      const media = await ObjectManagers.getInstance().SearchManager
          .getNMedia(this.config.mediaPick[i].searchQuery, this.config.mediaPick[i].sortBy, this.config.mediaPick[i].pick);
      this.Progress.log('Find ' + media.length + ' photos and videos from ' + (i + 1) + '. load');
      this.mediaList = this.mediaList.concat(media);
    }

    // make the list unique
    this.mediaList = this.mediaList
        .filter((value, index, arr) =>
            arr.findIndex(m => MediaDTOUtils.equals(m, value)) === index);

    this.Progress.Processed++;
    // console.log(this.mediaList);
    return false;
  }

  private async stepSending(): Promise<boolean> {
    if (this.mediaList.length <= 0) {
      this.Progress.log('No photos found skipping e-mail sending.');
      this.Progress.Skipped++;
      return false;
    }
    this.Progress.log('Sending emails of ' + this.mediaList.length + ' photos.');
    const messenger = new EmailMediaMessenger();
    await messenger.sendMedia({
      to: this.config.emailTo,
      subject: this.config.emailSubject,
      text: this.config.emailText
    }, this.mediaList);
    this.Progress.Processed++;
    return false;
  }
}
