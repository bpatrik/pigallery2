import {Column, Entity, Index, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique,} from 'typeorm';
import {PersonJunctionTable} from './PersonJunctionTable';
import {columnCharsetCS} from './EntityUtils';
import {PersonDTO} from '../../../../common/entities/PersonDTO';

@Entity()
@Unique(['name'])
export class PersonEntry implements PersonDTO {
  @Index()
  @PrimaryGeneratedColumn({unsigned: true})
  id: number;

  @Column(columnCharsetCS)
  name: string;

  @Column('int', {unsigned: true, default: 0})
  count: number;

  @Column({default: false})
  isFavourite: boolean;

  @OneToMany(() => PersonJunctionTable, (junctionTable) => junctionTable.person)
  public faces: PersonJunctionTable[];

  @ManyToOne(() => PersonJunctionTable, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  sampleRegion: PersonJunctionTable;

  // does not store in the DB, temporal field
  missingThumbnail?: boolean;
}
