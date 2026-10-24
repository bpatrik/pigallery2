import {Column, Entity, Index, OneToMany, OneToOne, PrimaryGeneratedColumn, Unique,} from 'typeorm';
import {PersonJunctionTable} from './PersonJunctionTable';
import {columnCharsetCS} from '../EntityUtils';
import {PersonDTO} from '../../../../../common/entities/PersonDTO';
import {ProjectedPersonCacheEntity} from './ProjectedPersonCacheEntity';

@Entity()
@Unique(['name'])
export class PersonEntry implements PersonDTO {
  @Index()
  @PrimaryGeneratedColumn({unsigned: true})
  id: number;

  @Column(columnCharsetCS)
  name: string;

  @Column({default: false})
  isFavourite: boolean;

  @OneToMany(() => PersonJunctionTable, (junctionTable) => junctionTable.person)
  public faces: PersonJunctionTable[];


  @OneToOne(() => ProjectedPersonCacheEntity, (ppc) => ppc.person)
  public cache: ProjectedPersonCacheEntity;

  // does not store in the DB, temporal fields populated from cache/joins
  missingThumbnail?: boolean;
}
