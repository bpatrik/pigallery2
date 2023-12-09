import {ChildEntity, Column} from 'typeorm';
import {AlbumBaseEntity} from './AlbumBaseEntity';
import {SavedSearchDTO} from '../../../../../common/entities/album/SavedSearchDTO';
import {SearchQueryDTO} from '../../../../../common/entities/SearchQueryDTO';

@ChildEntity()
export class SavedSearchEntity
    extends AlbumBaseEntity
    implements SavedSearchDTO {
  @Column({
    type: 'text',
    nullable: false,
    transformer: {
      // used to deserialize your data from db field value
      from: (val: string) => {
        return JSON.parse(val);
      },
      // used to serialize your data to db field
      to: (val: object) => {
        return JSON.stringify(val);
      },
    },
  })
  searchQuery: SearchQueryDTO;
}
