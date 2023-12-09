import {PersonDTO} from '../../../../common/entities/PersonDTO';
import {Config} from '../../../../common/config/public/Config';
import {Utils} from '../../../../common/Utils';

export class Person implements PersonDTO {
  isFavourite: boolean;
  count: number;
  id: number;
  name: string;


  public static getThumbnailUrl(that: PersonDTO): string {
    return Utils.concatUrls(
        Config.Server.urlBase,
        Config.Server.apiPath + '/person/',
        encodeURIComponent(that.name),
        '/thumbnail'
    );
  }
}
