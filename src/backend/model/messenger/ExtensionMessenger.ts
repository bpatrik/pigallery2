import {MediaDTOWithThPath, Messenger} from './Messenger';
import {DynamicConfig} from '../../../common/entities/DynamicConfig';

export class ExtensionMessenger<C extends Record<string, unknown> = Record<string, unknown>> extends Messenger<C> {

  constructor(public readonly Name: string,
              public readonly ConfigTemplate: DynamicConfig[],
              private readonly callbacks: { sendMedia: (config: C, media: MediaDTOWithThPath[]) => Promise<void> }) {
    super();
  }

  protected sendMedia(config: C, media: MediaDTOWithThPath[]): Promise<void> {
    return this.callbacks.sendMedia(config, media);
  }
}
