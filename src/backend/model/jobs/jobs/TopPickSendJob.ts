import {DefaultMessengers, DefaultsJobs,} from '../../../../common/entities/job/JobDTO';
import {Job} from './Job';
import {backendTexts} from '../../../../common/BackendTexts';
import {SortByTypes} from '../../../../common/entities/SortingMethods';
import {DatePatternFrequency, DatePatternSearch, SearchQueryTypes} from '../../../../common/entities/SearchQueryDTO';
import {ObjectManagers} from '../../ObjectManagers';
import {PhotoEntity} from '../../database/enitites/PhotoEntity';
import {MediaPickDTO} from '../../../../common/entities/MediaPickDTO';
import {MediaDTOUtils} from '../../../../common/entities/MediaDTO';
import {DynamicConfig} from '../../../../common/entities/DynamicConfig';
import {MessengerRepository} from '../../messenger/MessengerRepository';
import {Utils} from '../../../../common/Utils';


export class TopPickSendJob extends Job<{
  mediaPick: MediaPickDTO[],
  messenger: string,
  emailTo: string,
  emailSubject: string,
  emailText: string,
}> {
  public readonly Name = DefaultsJobs[DefaultsJobs['Top Pick Sending']];
  public readonly Supported: boolean = true;
  public readonly ConfigTemplate: DynamicConfig[];
  private status: 'Listing' | 'Sending' = 'Listing';
  private mediaList: PhotoEntity[] = [];

  constructor() {
    super();
    this.ConfigTemplate = [
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
        id: 'messenger',
        type: 'messenger',
        name: backendTexts.messenger.name,
        description: backendTexts.messenger.description,
        defaultValue: DefaultMessengers[DefaultMessengers.Email]
      }
    ];

    // add all messenger's config to the config template
    MessengerRepository.Instance.getAll()
      .forEach(msgr => Utils.clone(msgr.ConfigTemplate)
        .forEach(ct => {
          const c = Utils.clone(ct);
          c.validIf = {configFiled: 'messenger', equalsValue: msgr.Name};
          this.ConfigTemplate.push(c);
        }));
  }


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
    return false;
  }

  private async stepSending(): Promise<boolean> {
    if (this.mediaList.length <= 0) {
      this.Progress.log('No photos found skipping sending.');
      this.Progress.Skipped++;
      return false;
    }
    const msgr = MessengerRepository.Instance.get(this.config.messenger);
    if (!msgr) {
      throw new Error('Can\t find "' + this.config.messenger + '" messenger.');
    }
    this.Progress.log('Sending ' + this.mediaList.length + ' photos.');
    await msgr.send(this.config, this.mediaList);
    this.Progress.Processed++;
    return false;
  }
}
