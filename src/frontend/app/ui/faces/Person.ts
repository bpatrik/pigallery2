import {PersonCacheDTO, PersonDTO} from '../../../../common/entities/PersonDTO';
import {Config} from '../../../../common/config/public/Config';

export class Person implements PersonDTO {
  isFavourite: boolean;
  count: number;
  id: number;
  name: string;
  cache:PersonCacheDTO;


  public static getThumbnailUrl(that: PersonDTO): string {
    return Config.Server.getApiUrl(
        '/person/',
        encodeURIComponent(that.name),
        '/thumbnail'
    );
  }
}
