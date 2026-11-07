import {PersonDTO} from '../../../../common/entities/PersonDTO';
import {Config} from '../../../../common/config/public/Config';

export class Person {
  public static getThumbnailUrl(that: PersonDTO): string {
    return Config.Server.getApiUrl(
        '/person/',
        encodeURIComponent(that.name),
        '/thumbnail'
    );
  }
}
