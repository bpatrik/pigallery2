import {Messenger} from './Messenger';
import {EmailMessenger} from './EmailMessenger';
import {StdoutMessenger} from './StdoutMessenger';

export class MessengerRepository {

  private static instance: MessengerRepository = null;
  messengers: { [key: string]: Messenger } = {};

  public static get Instance(): MessengerRepository {
    if (MessengerRepository.instance == null) {
      MessengerRepository.instance = new MessengerRepository();
    }
    return MessengerRepository.instance;
  }

  getAll(): Messenger[] {
    return Object.values(this.messengers);
  }

  remove(m: { Name: string }): void {
    if (!this.messengers[m.Name]) {
      throw new Error('Messenger does not exist:' + m.Name);
    }
    delete this.messengers[m.Name];
  }

  register(msgr: Messenger): void {
    if (typeof this.messengers[msgr.Name] !== 'undefined') {
      throw new Error('Messenger already exist:' + msgr.Name);
    }
    this.messengers[msgr.Name] = msgr;
  }

  get(name: string): Messenger {
    return this.messengers[name];
  }
}

MessengerRepository.Instance.register(new EmailMessenger());
MessengerRepository.Instance.register(new StdoutMessenger());
