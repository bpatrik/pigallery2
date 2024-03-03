import {MediaDTOWithThPath, Messenger} from './Messenger';
import {DynamicConfig} from '../../../common/entities/DynamicConfig';
import {DefaultMessengers} from '../../../common/entities/job/JobDTO';

export class StdoutMessenger extends Messenger {
  public readonly Name = DefaultMessengers[DefaultMessengers.Stdout];
  public readonly ConfigTemplate: DynamicConfig[] = [];

  constructor() {
    super();
  }


  protected async sendMedia(config: never, media: MediaDTOWithThPath[]) {
    console.log(media.map(m => m.thumbnailPath));
  }
}
