import {IExtensionMessengers} from './IExtension';
import {DynamicConfig} from '../../../common/entities/DynamicConfig';
import {MediaDTOWithThPath, Messenger} from '../messenger/Messenger';
import {ExtensionMessenger} from '../messenger/ExtensionMessenger';
import {MessengerRepository} from '../messenger/MessengerRepository';
import {ILogger} from '../../Logger';

export class ExtensionMessengerHandler implements IExtensionMessengers {

  messengers: Messenger[] = [];


  constructor(private readonly extLogger: ILogger) {
  }


  addMessenger<C extends Record<string, unknown>>(name: string, config: DynamicConfig[], callbacks: {
    sendMedia: (config: C, media: MediaDTOWithThPath[]) => Promise<void>
  }): void {
    if (MessengerRepository.Instance.get(name)) {
      this.extLogger.silly('Messenger already exist. Overriding it:', name);
      MessengerRepository.Instance.remove({Name: name});
    } else {
      this.extLogger.silly('Adding new Messenger:', name);
    }
    const em = new ExtensionMessenger(name, config, callbacks);
    this.messengers.push(em);
    MessengerRepository.Instance.register(em);
  }

  cleanUp() {
    this.extLogger.silly('Removing Messenger');
    this.messengers.forEach(m => MessengerRepository.Instance.remove(m));
  }

}
