import {Entity, Index, ManyToOne, PrimaryGeneratedColumn} from 'typeorm';
import {PersonEntry} from './PersonEntry';
import {MediaEntity} from './MediaEntity';


/**
 * This is a junction table between media and persons
 */
@Entity()
export class PersonJunctionTable {
  @Index()
  @PrimaryGeneratedColumn({unsigned: true})
  id: number;

  @Index()
  @ManyToOne(() => MediaEntity, (media) => media.metadata.faces, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  media: MediaEntity;

  @Index()
  @ManyToOne(() => PersonEntry, (person) => person.faces, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  person: PersonEntry;
}
